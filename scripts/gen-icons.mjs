// Generates the three placeholder PWA icons: a #0A0B0D square with a
// #4DA3FF circular glyph (final/09-PHASE-0-PROMPT.md Step 8). Pure Node
// (zlib only) — no image-library dependency for a one-off placeholder.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0x0a, 0x0b, 0x0d];
const ACCENT = [0x4d, 0xa3, 0xff];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * @param {number} size
 * @param {{ safeZoneRatio: number }} opts safeZoneRatio: glyph radius as a
 *   fraction of size. Maskable icons need the glyph within the ~40% radius
 *   safe zone; regular icons can use a slightly larger glyph.
 */
function generatePng(size, { safeZoneRadiusRatio }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * safeZoneRadiusRatio;

  const rowBytes = size * 4 + 1; // filter byte + RGBA per row
  const raw = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const inGlyph = dx * dx + dy * dy <= r * r;
      const [rr, gg, bb] = inGlyph ? ACCENT : BG;
      const px = rowStart + 1 + x * 4;
      raw[px] = rr;
      raw[px + 1] = gg;
      raw[px + 2] = bb;
      raw[px + 3] = 255;
    }
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const idatData = deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Regular icons: a generous glyph. Maskable: kept inside the ~80%-diameter
// safe zone (i.e. <= 40% radius) so nothing is clipped by an OS mask.
writeFileSync('public/icon-192.png', generatePng(192, { safeZoneRadiusRatio: 0.34 }));
writeFileSync('public/icon-512.png', generatePng(512, { safeZoneRadiusRatio: 0.34 }));
writeFileSync('public/icon-maskable-512.png', generatePng(512, { safeZoneRadiusRatio: 0.38 }));

console.log('Generated icon-192.png, icon-512.png, icon-maskable-512.png');
