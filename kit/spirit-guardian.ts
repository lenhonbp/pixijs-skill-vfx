import type { Handle, VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import type { Palette } from './recipes';
import { group } from './group';
import { clamp01, rand } from './ease';

/** Spectral halberd warrior: upward materialization, quiet hold, rising-mote dissolve. */
export function spiritGuardian(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; z?: number; palette: Palette; height?: number; duration?: number }): Handle {
  const h = o.height ?? 100, k = h / 240, hold = o.duration ?? 1200;
  const reveal = 350, dissolve = 450, total = reveal + hold + dissolve;
  const g = group(w, total, undefined, 100);
  let age = 0;
  g.addHandle(w.addUpdater((dt) => { age += dt; }));
  const opacity = () => clamp01(age / reveal) * (1 - clamp01((age - reveal - hold) / dissolve));
  for (const rim of [false, true]) g.add(w.spawn({ texture: tex.guardian, blend: rim ? 'add' : 'normal',
    x: o.x, y: o.y, z: o.z ?? 0, life: Infinity, anchorX: 88 / 192, anchorY: 244 / 256,
    scale: k, tint: o.palette.main, alpha: () => opacity() * (rim ? 0.065 : 0.85), zBias: rim ? 21 : 20,
    onUpdate: (q) => {
      q.pz = -h * 0.22 * (1 - clamp01(age / reveal)) + Math.sin(age / 380) * h * 0.025;
      q.sprite.position.set(o.x, o.y - (o.z ?? 0) - q.pz);
    },
  }));
  g.add(w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: (o.z ?? 0) + h * 0.55,
    life: Infinity, scaleX: h / 180, scaleY: h / 105,
    alpha: () => opacity() * (0.055 + Math.sin(age / 280) * 0.015), tint: o.palette.main, zBias: 19 }));
  g.addHandle(w.stream({ rate: 28, make: () => ({ texture: tex.dot,
    x: o.x + rand(-0.28, 0.4) * h, y: o.y, z: (o.z ?? 0) + rand(0, 0.9) * h,
    life: 500, vz: h * 0.45, scale: [0.065 * h / 100, 0], alpha: [0.45, 0], tint: o.palette.main, zBias: 22 }) }));
  return g;
}
