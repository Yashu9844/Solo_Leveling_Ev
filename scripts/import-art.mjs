#!/usr/bin/env node
/**
 * Art import — design/00-DESIGN-SYSTEM.md §2.6.
 *
 * Reads design/art.manifest.json and, for every slot with a source that
 * exists, emits into src/assets/art/:
 *
 *   <slot>-440.webp   phone at 1x
 *   <slot>-880.webp   phone at 2x, and the 430px desktop frame at 2x
 *
 * plus a 20px blurred LQIP inlined as a data URI, and a typed index.ts.
 *
 * The app is a 430px column at every breakpoint, so 880 already covers
 * 2x on the widest frame it will ever draw — 1280 would ship pixels
 * nothing can display. It was 480/960 until task 12.4 measured the
 * library at 2.2 MB against a 1.6 MB budget: 960 was 23% wider than the
 * largest thing that can be shown, and width costs area, so trimming to
 * 880 gave back a third of the weight for pixels no screen was using.
 *
 * Idempotent. New art is a manifest line plus `npm run art`; no
 * component ever changes.
 */
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'design', 'art.manifest.json');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'art');

const WIDTHS = [440, 880];
// These plates always sit under a 45-85% scrim, and often at
// --art-opacity 0.45 in dim mode. Quality above ~60 is bytes the user
// can never perceive, so the larger variant is tuned low deliberately.
const QUALITY = { 440: 58, 880: 37 };
const LQIP_WIDTH = 20;

// Budgets. Art is decorative — every slot has a gradient fallback — so a
// blown budget is a bug, not a judgement call.
//
// The per-file cap is the one that matters: a screen loads exactly one
// plate, so this IS the per-screen art weight a phone pays. The total is
// only a sanity ceiling, because art is deliberately NOT precached (see
// vite.config.ts) — it is runtime-cached on first view, so the sum on
// disk is never downloaded in one go. Capping the total tightly would
// just mean every new plate forced a quality cut on the existing ones.
const MAX_FILE_BYTES = 170 * 1024;
// design/01 task 12.4's art budget. Not a per-screen limit — MAX_FILE_BYTES
// above is that, and it is the one a user feels, since no screen loads
// more than one plate. This is the whole-library ceiling: art is not
// precached (vite.config.ts keeps webp out of globPatterns and caches it
// at runtime instead), so it is what a device accumulates over a few
// days of use rather than what it downloads on install.
const MAX_TOTAL_BYTES = 1.6 * 1024 * 1024;

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

function camel(slot) {
  return slot.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const { sourceDir, slots } = manifest;

  await mkdir(OUT_DIR, { recursive: true });

  // Clear stale output so a removed or re-pointed slot cannot leave an
  // orphan behind that the generated module no longer references.
  for (const f of await readdir(OUT_DIR).catch(() => [])) {
    if (f.endsWith('.webp')) await unlink(path.join(OUT_DIR, f));
  }

  const entries = [];
  const imports = [];
  let total = 0;
  let filled = 0;
  const missing = [];
  const oversize = [];

  for (const [slot, spec] of Object.entries(slots)) {
    const src = spec.source ? path.join(sourceDir, spec.source) : null;

    if (!src || !existsSync(src)) {
      if (spec.source) missing.push(`${slot} -> ${spec.source}`);
      entries.push(`  '${slot}': null,`);
      continue;
    }

    const meta = await sharp(src).metadata();
    const varName = camel(slot);

    for (const w of WIDTHS) {
      const out = path.join(OUT_DIR, `${slot}-${w}.webp`);
      const info = await sharp(src)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: QUALITY[w], effort: 6 })
        .toFile(out);

      total += info.size;
      if (info.size > MAX_FILE_BYTES) {
        oversize.push(`${slot}-${w}.webp is ${kb(info.size)} (cap ${kb(MAX_FILE_BYTES)})`);
      }
      console.log(`  ${slot}-${w}.webp  ${kb(info.size)}`);
      imports.push(`import ${varName}${w} from './${slot}-${w}.webp';`);
    }

    const lqipBuf = await sharp(src)
      .resize({ width: LQIP_WIDTH })
      .blur(1.2)
      .webp({ quality: 40 })
      .toBuffer();
    const lqip = `data:image/webp;base64,${lqipBuf.toString('base64')}`;

    const [small, large] = WIDTHS;
    entries.push(
      `  '${slot}': {\n` +
        `    src: ${varName}${small},\n` +
        `    srcSet: \`\${${varName}${small}} ${small}w, \${${varName}${large}} ${large}w\`,\n` +
        `    lqip: '${lqip}',\n` +
        `    width: ${meta.width},\n` +
        `    height: ${meta.height},\n` +
        `    mood: '${spec.mood}',\n` +
        `    focal: '${spec.focal ?? '50% 50%'}',\n` +
        `    hasText: ${spec.text === true},\n` +
        `    zoom: ${spec.zoom ?? 1},\n` +
        `  },`
    );
    filled += 1;
  }

  const slotNames = Object.keys(slots);
  const module = `// GENERATED by scripts/import-art.mjs — do not edit.
// Source of truth: design/art.manifest.json. Re-run \`npm run art\`.
${imports.join('\n')}

export type ArtSlot =
${slotNames.map((s) => `  | '${s}'`).join('\n')};

export type ArtMood = 'blue' | 'gold' | 'boss';

export interface ArtAsset {
  src: string;
  srcSet: string;
  /** 20px blurred placeholder, inlined — paints instantly, no request. */
  lqip: string;
  width: number;
  height: number;
  /** blue = effort, gold = evidence, boss = BOSS surfaces only. */
  mood: ArtMood;
  /** CSS object-position, keeping the figure clear of the copy. */
  focal: string;
  /** The plate carries its own tagline; do not overlay another. */
  hasText: boolean;
  /**
   * Default crop scale.
   *
   * Several plates carry their own lettering down a margin. A phone
   * viewport is narrower than the source aspect, so \`cover\` crops the
   * sides and slices that text mid-word — and half a word reads as a
   * rendering fault, which is worse than not showing it. The scale that
   * pushes it cleanly out of frame belongs to the plate, not to
   * whichever screen happens to use it first.
   */
  zoom: number;
}

/** null means the slot has no art yet — ArtLayer renders its procedural
 * gradient instead, and the screen still looks finished. */
export const ART: Record<ArtSlot, ArtAsset | null> = {
${entries.join('\n')}
};
`;

  await writeFile(path.join(OUT_DIR, 'index.ts'), module, 'utf8');

  console.log(
    `\n${filled}/${slotNames.length} slots filled · ${kb(total)} total ` +
      `(cap ${kb(MAX_TOTAL_BYTES)})`
  );
  if (missing.length) {
    console.log(`\nUnfilled (gradient fallback):\n  ${missing.join('\n  ')}`);
  }

  const failures = [
    ...oversize,
    ...(total > MAX_TOTAL_BYTES ? [`total ${kb(total)} exceeds ${kb(MAX_TOTAL_BYTES)}`] : []),
  ];
  if (failures.length) {
    console.error(`\nBUDGET EXCEEDED:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
