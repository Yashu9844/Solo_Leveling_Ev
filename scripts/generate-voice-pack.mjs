/**
 * Renders the System's voice pack to static audio, once, at build time.
 *
 *   node scripts/generate-voice-pack.mjs            # fill in what is missing
 *   node scripts/generate-voice-pack.mjs --force    # re-render everything
 *   node scripts/generate-voice-pack.mjs --only morning-zero-001
 *
 * Why a build step rather than a call from the app:
 *
 *  1. `api.fish.audio` serves no CORS headers — its preflight 404s — so a
 *     browser cannot call it at all. Any in-app design would have needed
 *     a proxy the Player has to host.
 *  2. The library is 156 fixed lines. They do not vary by Player, by day
 *     or by state, so there is nothing to generate at runtime; rendering
 *     the same 156 files on every device forever would be a per-play cost
 *     and a per-play wait for an identical result.
 *  3. It keeps the API key out of the browser entirely. A key shipped to
 *     the client is a key anyone who opens devtools can spend.
 *  4. The app stays offline-first (design/04 §18). Static files under
 *     /voice are served by the app's own origin and cached by the service
 *     worker, so the System speaks on a phone in aeroplane mode.
 *
 * The key is read from .env.local (gitignored) or the environment. It is
 * never written into any file this script produces.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'voice');
const MANIFEST = join(OUT_DIR, 'manifest.json');

/** The one model that renders on a zero balance — the dashboard's
 * "S2.1 Pro is now free for developers". Paid models answer 402. */
const MODEL = 's2.1-pro-free';
const ENDPOINT = 'https://api.fish.audio/v1/tts';

/** Speech at 64 kbps mono is transparent, and halves what the phone stores. */
const BITRATE = 64;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

function loadEnv() {
  const path = join(ROOT, '.env.local');
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  }
}

/**
 * Pulls id/text straight out of the TypeScript library rather than keeping
 * a second copy here. A drifted duplicate would mean the System's mouth
 * and the System's words disagreeing, which is the one bug in this feature
 * nobody would think to look for.
 */
function readVoicePack() {
  const source = readFileSync(join(ROOT, 'src', 'engine', 'voicePack.ts'), 'utf8');
  const entries = [];
  const pattern = /\n\s*m\(\s*'([^']+)'\s*,\s*(['"])((?:\\.|(?!\2).)*)\2/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const text = match[3]
      .replace(/\\u2019/g, '’')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    entries.push({ id: match[1], text });
  }
  return entries;
}

async function render(text, voiceId, key) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      model: MODEL,
    },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: 'mp3',
      mp3_bitrate: BITRATE,
      normalize: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${detail.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  // A JSON error body can arrive with a 200 on some gateways; an MP3
  // frame header is the only proof the bytes are actually audio.
  if (buffer.length < 1024 || !(buffer[0] === 0xff || buffer.subarray(0, 3).toString() === 'ID3')) {
    throw new Error(`not audio (${buffer.length} bytes)`);
  }
  return buffer;
}

async function main() {
  loadEnv();
  const key = process.env.FISH_API_KEY;
  const voiceId = process.env.FISH_VOICE_ID;

  if (!key || !voiceId) {
    console.error(
      'Missing FISH_API_KEY or FISH_VOICE_ID.\n' +
        'Put them in .env.local (gitignored):\n\n' +
        '  FISH_API_KEY=sk-fish-...\n' +
        '  FISH_VOICE_ID=<model id from fish.audio>\n'
    );
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const onlyIndex = process.argv.indexOf('--only');
  const only = onlyIndex === -1 ? null : process.argv[onlyIndex + 1];

  mkdirSync(OUT_DIR, { recursive: true });

  let lines = readVoicePack();
  if (only) lines = lines.filter((l) => l.id === only);
  if (lines.length === 0) {
    console.error('No lines matched. Is src/engine/voicePack.ts intact?');
    process.exit(1);
  }

  const pending = lines.filter(
    (l) => force || !existsSync(join(OUT_DIR, `${l.id}.mp3`))
  );

  console.log(
    `voice pack: ${lines.length} lines, ${pending.length} to render, ` +
      `voice ${voiceId.slice(0, 8)}…, model ${MODEL}`
  );

  let done = 0;
  const failures = [];
  const queue = [...pending];

  async function worker() {
    for (;;) {
      const line = queue.shift();
      if (!line) return;

      let lastError;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const audio = await render(line.text, voiceId, key);
          writeFileSync(join(OUT_DIR, `${line.id}.mp3`), audio);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          // Back off rather than hammering: the free tier is shared.
          await new Promise((r) => setTimeout(r, attempt * 1500));
        }
      }

      done += 1;
      if (lastError) {
        failures.push({ id: line.id, error: String(lastError.message ?? lastError) });
        process.stdout.write(`\r  ${done}/${pending.length}  FAILED ${line.id}\n`);
      } else {
        process.stdout.write(`\r  ${done}/${pending.length}  ${line.id}`.padEnd(60));
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');

  // The manifest is what the app reads: a line with no entry falls back to
  // the device's own speech engine rather than requesting a missing file.
  const present = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.mp3'))
    .map((f) => f.replace(/\.mp3$/, ''));

  const bytes = present.reduce((sum, id) => sum + statSync(join(OUT_DIR, `${id}.mp3`)).size, 0);

  writeFileSync(
    MANIFEST,
    `${JSON.stringify({ voiceId, model: MODEL, bitrate: BITRATE, ids: present.sort() }, null, 2)}\n`
  );

  console.log(
    `\n${present.length} clips, ${(bytes / 1024 / 1024).toFixed(1)} MB total, ` +
      `manifest written to public/voice/manifest.json`
  );
  if (failures.length > 0) {
    console.log(`\n${failures.length} failed — re-run to retry just those:`);
    for (const f of failures.slice(0, 10)) console.log(`  ${f.id}: ${f.error}`);
    process.exitCode = 1;
  }
}

await main();
