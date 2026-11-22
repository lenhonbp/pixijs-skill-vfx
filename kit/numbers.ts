// Floating combat numbers from baked glyph sprites (no Text objects per hit).
import type { VfxTextures } from './textures';
import { TEX_METRICS as M } from './textures';
import type { VfxWorld, Vec3 } from './vfx-world';
import { outBack, outQuad, rand } from './ease';
import { textureFromCanvas } from './pixi-compat';

export interface NumberOptions extends Vec3 {
  value: number | string;
  /** Fill color: damage 0xffffff/0xffd04a, heal 0x7cff6a, poison 0x9cff3a, burn 0xff8a2a. */
  color?: number;
  /** Bigger, longer, with a pop and a '!' suffix. */
  crit?: boolean;
  /** Glyph height in px. */
  size?: number;
  /** Bake the glyphs into one temporary sprite instead of one particle per glyph. */
  compact?: boolean;
}

// Recent numbers per world, so hits that land together stack instead of overlapping.
const recent = new WeakMap<VfxWorld, { x: number; y: number; at: number }[]>();
const STACK_MS = 450;

function stackSlot(w: VfxWorld, x: number, y: number) {
  const list = (recent.get(w) ?? []).filter((r) => w.now - r.at < STACK_MS && w.now >= r.at);
  const slot = list.filter((r) => Math.abs(r.x - x) < 48 && Math.abs(r.y - y) < 32).length;
  list.push({ x, y, at: w.now });
  recent.set(w, list);
  return slot;
}

export function damageNumber(w: VfxWorld, tex: VfxTextures, o: NumberOptions) {
  const text = String(o.value) + (o.crit ? '!' : '');
  if (o.compact && !text) return;
  const h = (o.size ?? 22) * (o.crit ? 1.45 : 1);
  const k = h / M.digitHeight;
  const adv = 30 * k;
  const life = o.crit ? 1100 : 850;
  const slot = stackSlot(w, o.x, o.y);
  const side = slot === 0 ? 0 : slot % 2 ? 1 : -1;
  const pos = { x: o.x + rand(-4, 4) + side * 18, y: o.y, z: (o.z ?? 70) + 10 + slot * h * 0.95 };
  const drift = rand(-25, 25);
  const pop = o.crit ? 1.6 : 1.25;
  let t = 0;
  w.addUpdater((dt) => {
    t += dt;
    const u = Math.min(1, t / life);
    pos.x += (drift * dt) / 1000;
    pos.z += (u < 0.25 ? 90 : 25) * (dt / 1000);
    return u < 1;
  });
  if (o.compact) {
    const sources = [...text].map(ch => {
      const glyph = tex.digits[ch] as any;
      return glyph?.source?.resource ?? glyph?.baseTexture?.resource?.source;
    });
    if (sources.every(source => source && typeof source.getContext === 'function')) {
      const canvas = document.createElement('canvas');
      canvas.width = 44 + (text.length - 1) * 30; canvas.height = M.digitHeight;
      const ctx = canvas.getContext('2d')!;
      sources.forEach((source, i) => ctx.drawImage(source, i * 30, 0));
      const texture = textureFromCanvas(canvas);
      const p = w.spawn({ texture, layer: 'top', blend: 'normal', x: 0, y: 0, follow: () => pos,
        life, tint: o.color ?? 0xffffff,
        scale: q => k * (q < 0.15 ? pop - (pop - 1) * outBack(q / 0.15) : 1),
        alpha: q => q < 0.7 ? 1 : 1 - outQuad((q - 0.7) / 0.3) });
      let disposed = false;
      const dispose = () => { if (!disposed) { disposed = true; texture.destroy(true); } };
      if (!p) dispose();
      else {
        const unown = w.own(dispose);
        w.after(life + 50, () => { dispose(); unown(); });
      }
      return;
    }
  }
  [...text].forEach((ch, i) => {
    const g = tex.digits[ch];
    if (!g) return;
    const off = (i - (text.length - 1) / 2) * adv;
    w.spawn({
      texture: g, layer: 'top', blend: 'normal', x: off, y: 0, follow: () => pos, life, tint: o.color ?? 0xffffff,
      scale: (q) => k * (q < 0.15 ? pop - (pop - 1) * outBack(q / 0.15) : 1),
      alpha: (q) => (q < 0.7 ? 1 : 1 - outQuad((q - 0.7) / 0.3)),
    });
  });
}
