// Reads every desktop and mobile pack (direction 0) and writes the per-effect specs the Hub cards show.
// Usage (from the repo root, after `npm run build:runtime` and fetching the packs):
//   node hub/scripts/vfx-specs.mjs showcase/public/packs/free > hub/src/data/vfx-specs.json
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readContainer } from '../../runtime/dist/format.js';

const dir = process.argv[2];
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));

/** Decoded RGBA8888 bytes of every WebP sheet, read from the VP8/VP8L/VP8X header. */
function webpSize(b) {
  const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (tag === 'VP8X') return [1 + (b[24] | b[25] << 8 | b[26] << 16), 1 + (b[27] | b[28] << 8 | b[29] << 16)];
  if (tag === 'VP8L') { const v = b[21] | b[22] << 8 | b[23] << 16 | b[24] << 24; return [1 + (v & 0x3fff), 1 + ((v >>> 14) & 0x3fff)]; }
  if (tag === 'VP8 ') return [(b[26] | b[27] << 8) & 0x3fff, (b[28] | b[29] << 8) & 0x3fff];
  throw Error('Unknown WebP chunk ' + tag);
}
function read(file) {
  const buf = readFileSync(join(dir, file));
  const { manifest: m, sheets } = readContainer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  let texture = 0, maxSide = 0;
  for (const bytes of sheets.values()) { const [w, h] = webpSize(bytes); texture += w * h * 4; maxSide = Math.max(maxSide, w, h); }
  return { fps: m.fps, frames: m.frameCount, durationMs: m.durationMs, layers: m.layers.length, sheets: sheets.size, maxSheet: maxSide,
    vram: m.estimatedVramBytes ?? texture, measuredVram: texture, budget: m.tierBudget ?? null, bytes: buf.byteLength };
}
const out = index.map(e => {
  const d = read(`${e.id}.vfxb`), mo = read(`${e.id}.m.vfxb`);
  if (d.vram !== d.measuredVram || mo.vram !== mo.measuredVram) console.warn('VRAM mismatch', e.id);
  return { id: e.id, en: e.name.en, vi: e.name.vi, element: e.element, category: e.category,
    directions: 1 + Object.keys(e.directions ?? {}).length, desktop: d, mobile: mo };
});
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
