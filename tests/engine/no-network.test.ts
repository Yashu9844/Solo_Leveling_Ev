// Loop 15.4: the app makes no network call but one: its own static files, from its own origin, which the service worker has cached. A source scan
// (and, when a build exists, a scan of the bundle) so a new dependency or a careless `fetch` cannot slip in; the browser half is the adaptive-offline e2e.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const NETWORK_PRIMITIVES = /\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource\(|navigator\.connection|importScripts\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}
const rel = (path: string): string => path.slice(ROOT.length + 1).replace(/\\/g, '/');

describe('the source', () => {
  const sources = walk(join(ROOT, 'src'));

  it('uses a network primitive in one place only: the voice pack reading its own static files', () => {
    const using = sources.filter((path) => NETWORK_PRIMITIVES.test(readFileSync(path, 'utf8'))).map(rel);
    expect(using).toEqual(['src/ui/speech/voicePackAudio.ts']);
  });

  it('and there it asks for same-origin paths', () => {
    const text = readFileSync(join(ROOT, 'src/ui/speech/voicePackAudio.ts'), 'utf8');
    expect(text).toMatch(/MANIFEST_URL = '\/voice\/manifest\.json'/);
    expect(text).toMatch(/`\/voice\/\$\{encodeURIComponent\(messageId\)\}\.mp3`/);
    const calls = [...text.matchAll(/fetch\(([^)]*)\)/g)].map((match) => match[1]);
    expect(calls).toEqual(['MANIFEST_URL', 'clipUrl(messageId']);
  });

  it('writes no absolute URL into code that could be requested (links in comments and namespaces are not requests)', () => {
    const offenders: string[] = [];
    for (const path of sources) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (/['"`]https?:\/\//.test(code) && !/xmlns|w3\.org/.test(code)) offenders.push(`${rel(path)}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('the page', () => {
  it('loads nothing from another origin: no external script, stylesheet, font or preconnect', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect([...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((match) => match[1])).toEqual([]);
    expect(html).not.toMatch(/rel="preconnect"|rel="dns-prefetch"/);
  });
});

describe('the bundle (when one has been built)', () => {
  const build = ['dist', 'dist-adaptive'].map((name) => join(ROOT, name, 'assets')).find((path) => existsSync(path));

  it.skipIf(!build)('contains the same two fetches as the source, and no other way to reach the network', () => {
    const scripts = readdirSync(build!).filter((name) => name.endsWith('.js')).map((name) => readFileSync(join(build!, name), 'utf8'));
    const joined = scripts.join('\n');
    expect(joined.match(/\bfetch\(/g)?.length ?? 0).toBe(2);
    expect(joined).not.toMatch(/XMLHttpRequest|sendBeacon|new WebSocket|EventSource\(/);
  });
});
