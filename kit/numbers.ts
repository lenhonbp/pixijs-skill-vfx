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
  /** Lifetime in ms; shorten for preceding hits in a combo to keep the finisher clear. */
  duration?: number;
}

// Recent numbers per world, so hits that land together stack instead of overlapping.
const recent = new WeakMap<VfxWorld, { x: number; y: number; at: number; until: number }[]>();
const STACK_MS = 450;

function stackSlot(w: VfxWorld, x: number, y: number, life: number) {
  const list = (recent.get(w) ?? []).filter((r) => w.now < r.until && w.now >= r.at);
  const slot = list.filter((r) => Math.abs(r.x - x) < 48 && Math.abs(r.y - y) < 32).length;
  list.push({ x, y, at: w.now, until: w.now + Math.min(life, STACK_MS) });
  recent.set(w, list);
  return slot;
}

export function damageNumber(w: VfxWorld, tex: VfxTextures, o: NumberOptions) {
  const text = String(o.value) + (o.crit ? '!' : '');
  const h = (o.size ?? 22) * (o.crit ? 1.45 : 1);
  const k = h / M.digitHeight;
  const adv = M.digitWidth * k;
  const life = o.duration ?? (o.crit ? 1100 : 850);
  if (!Number.isFinite(life) || life <= 0) throw new RangeError('Damage number duration must be finite and positive');
  const slot = stackSlot(w, o.x, o.y, life);
  const side = slot === 0 ? 0 : slot % 2 ? 1 : -1;
  const pos = { x: o.x + rand(-4, 4) + side * 18, y: o.y, z: (o.z ?? 70) + 10 + slot * h * 0.95 };
  const drift = rand(-25, 25);
  const pop = o.crit ? 1.6 : 1.25;
  let t = 0;
  const popScale = () => {
    const q = t / life;
    return q < 0.15 ? pop - (pop - 1) * outBack(q / 0.15) : 1;
  };
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
    const glyph = { ...pos };
    w.spawn({
      texture: g, layer: 'top', blend: 'normal', x: 0, y: 0, life, tint: o.color ?? 0xffffff,
      follow: () => {
        glyph.x = pos.x + off * popScale();
        glyph.y = pos.y;
        glyph.z = pos.z;
        return glyph;
      },
      scale: () => k * popScale(),
      alpha: (q) => (q < 0.7 ? 1 : 1 - outQuad((q - 0.7) / 0.3)),
    });
  });
}
