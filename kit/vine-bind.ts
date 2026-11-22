import type { Handle, Particle, VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import type { OnUnit } from './status';
import type { Palette } from './recipes';
import { WUXING } from './elements';
import { group } from './group';
import { clamp01, lerpColor, rand } from './ease';

export interface VineBindHandle extends Handle {
  /** Squeeze the coils in sync with a gameplay damage tick. */
  pulse(): void;
}

/** Four thorned vines spiral from the feet to the torso, split around the unit in depth. */
export function vineBind(w: VfxWorld, tex: VfxTextures,
  o: OnUnit & { palette?: Palette; duration?: number }): VineBindHandle {
  const h = o.height ?? 70, s = h / 70, dur = o.duration ?? 2500, p = o.palette ?? WUXING.moc.palette;
  let age = 0, pulseAge = Infinity;
  const parts: Particle[] = [];
  const g = group(w, dur, () => {
    for (const q of parts) {
      q.o.tint = 0x795333;
      q.o.scale = 1;
      q.o.scaleX = q.sprite.scale.x; q.o.scaleY = q.sprite.scale.y;
      q.rotation = q.sprite.rotation;
    }
    const at = o.target();
    w.burst(24, (i) => ({ texture: i % 2 ? tex.leaf : tex.rock, blend: 'normal',
      x: at.x + rand(-18, 18) * s, y: at.y, z: (at.z ?? 0) + rand(0.05, 0.8) * h,
      life: 750, vx: rand(-35, 35) * s, vz: rand(10, 40) * s, gravity: 230 * s,
      rotation: rand(0, 6.3), spin: rand(-5, 5), scale: [rand(0.12, 0.22) * s, 0],
      alpha: [0.85, 0], tint: 0x795333 }));
  }, 280);
  g.addHandle(w.addUpdater((dt) => { age += dt; pulseAge += dt; }));
  const tint = () => lerpColor(p.main, 0x795333, clamp01((age - dur + 320) / 320));
  const squeeze = () => Number.isFinite(pulseAge) && pulseAge < 300 ? Math.sin(pulseAge / 300 * Math.PI) * 0.2 : 0;
  const point = (u: number, vine: number) => {
    const a = u * Math.PI * 2.4 + vine * Math.PI / 2;
    const r = h * 0.23 * (1 - squeeze()) * (1 - u * 0.12);
    return { x: Math.cos(a) * r, depth: Math.sin(a) * r * 0.33, z: u * h * 0.8 };
  };
  for (let vine = 0; vine < 4; vine++) {
    for (let j = 0; j < 18; j++) {
      const u = j / 18, v = (j + 1) / 18;
      const q = g.add(w.spawn({ texture: tex.vineSegment, blend: 'normal', x: 0, y: 0, follow: o.target,
        life: Infinity, tint: p.main, scaleY: 0.3 * s, zBias: 8,
        onUpdate: (q) => {
          const a = point(u, vine), b = point(v, vine), at = o.target();
          const growth = clamp01((age - u * 280 - vine * 22) / 110);
          const dx = b.x - a.x, dy = b.depth - b.z - a.depth + a.z;
          q.px = (a.x + b.x) / 2; q.py = (a.depth + b.depth) / 2; q.pz = (a.z + b.z) / 2;
          q.sprite.position.set(at.x + q.px, at.y - (at.z ?? 0) + q.py - q.pz);
          q.sprite.rotation = Math.atan2(dy, dx);
          q.sprite.scale.set(Math.hypot(dx, dy) / 90 * growth, 0.3 * s * growth * (1 - u * 0.25));
          q.sprite.tint = tint();
          q.o.zBias = q.py >= 0 ? 8 : -8;
          q.sprite.zIndex = at.y + q.o.zBias;
        },
      }));
      if (q) parts.push(q);
    }
    for (const u of [0.3, 0.72]) {
      const q = g.add(w.spawn({ texture: tex.leaf, blend: 'normal', x: 0, y: 0, follow: o.target,
        life: Infinity, scale: 0.25 * s, tint: p.main,
        onUpdate: (q) => {
          const a = point(u, vine), at = o.target(), growth = clamp01((age - 350) / 150);
          q.px = a.x; q.py = a.depth; q.pz = a.z;
          q.sprite.position.set(at.x + a.x, at.y - (at.z ?? 0) + a.depth - a.z);
          q.o.zBias = a.depth >= 0 ? 9 : -9;
          q.sprite.zIndex = at.y + q.o.zBias;
          q.sprite.scale.set(0.25 * s * growth); q.sprite.rotation = vine * 1.7 + u;
          q.sprite.tint = tint();
        },
      }));
      if (q) parts.push(q);
    }
  }
  const at = o.target();
  w.burst(10, () => ({ texture: tex.rock, blend: 'normal', x: at.x + rand(-18, 18) * s, y: at.y,
    z: at.z ?? 0, life: 500, vx: rand(-45, 45), vz: rand(40, 100), gravity: 400,
    scale: [0.12 * s, 0], tint: p.dark }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.4, follow: o.target,
    life: Infinity, scale: 0.7 * s, alpha: 0.045, tint: p.main, zBias: -9 }));
  return {
    get alive() { return g.alive; },
    stop: () => g.stop(),
    pulse() { if (g.alive) pulseAge = 0; },
  };
}
