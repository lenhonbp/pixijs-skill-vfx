// Floating combat numbers from baked glyph sprites (no Text objects per hit).
import type { VfxTextures } from './textures';
import { TEX_METRICS as M } from './textures';
import type { VfxWorld, Vec3 } from './vfx-world';
import { outBack, outQuad, rand } from './ease';

export interface NumberOptions extends Vec3 {
  value: number | string;
  /** Fill color: damage 0xffffff/0xffd04a, heal 0x7cff6a, poison 0x9cff3a, burn 0xff8a2a. */
  color?: number;
  /** Bigger, longer, with a pop and a '!' suffix. */
  crit?: boolean;
  /** Glyph height in px. */
  size?: number;
}

export function damageNumber(w: VfxWorld, tex: VfxTextures, o: NumberOptions) {
  const text = String(o.value) + (o.crit ? '!' : '');
  const h = (o.size ?? 22) * (o.crit ? 1.45 : 1);
  const k = h / M.digitHeight;
  const adv = 30 * k;
  const life = o.crit ? 1100 : 850;
  const pos = { x: o.x + rand(-10, 10), y: o.y, z: (o.z ?? 70) + 10 };
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
