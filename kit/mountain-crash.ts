import type { Handle, VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import type { Palette } from './recipes';
import { slam } from './motion';
import { group } from './group';
import { clamp01, inQuad, rand } from './ease';

/** A mountain forms overhead, drops base-first, then collapses into falling rubble. */
export function mountainCrash(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; radius: number; palette: Palette; height?: number; delay?: number; onHit?: () => void }): Handle {
  const delay = o.delay ?? 0, fall = 320, impact = delay + fall;
  const h = o.height ?? 160, p = o.palette, s = h / 160;
  let age = 0, hit = false;
  const g = group(w, impact + 2300, undefined, 100);
  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    if (!hit && age >= impact) {
      hit = true;
      slam(w, tex, { x: o.x, y: o.y, radius: o.radius, palette: p, debris: 26 });
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        w.spawn({ texture: tex.swordCrack, blend: 'normal', layer: 'ground', groundAligned: true,
          x: o.x + Math.cos(a) * o.radius * 0.6, y: o.y + Math.sin(a) * o.radius * 0.6 * w.groundSquash,
          rotation: a, life: 2200, scaleX: o.radius / 55, scaleY: 0.8, alpha: [0.85, 0], tint: p.dark });
      }
      w.burst(22, () => ({ texture: tex.rock, blend: 'normal',
        x: o.x + rand(-o.radius, o.radius), y: o.y + rand(-12, 12), z: rand(15, h),
        life: 1700, vx: rand(-90, 90) * s, vz: rand(35, 110) * s, gravity: 650 * s,
        rotation: rand(0, 6.3), spin: rand(-5, 5), scale: rand(0.4, 0.85) * s,
        alpha: (t) => t < 0.55 ? 1 : (1 - t) / 0.45, tint: p.main,
        onUpdate: (q) => { if (q.z < 0) { q.pz -= q.z; q.vz = 0; q.vx *= 0.8; q.o.spin = 0; } },
      }));
      o.onHit?.();
    }
  }));
  g.add(w.spawn({ texture: tex.mountain, blend: 'normal', x: o.x, y: o.y,
    delay, life: fall + 260, anchorY: 1, scaleX: o.radius * 2.5 / 320, scaleY: h / 256,
    tint: p.main, zBias: 35,
    alpha: () => clamp01((age - delay) / 120) * (1 - clamp01((age - impact) / 260)),
    onUpdate: (q) => {
      const drop = inQuad(clamp01((age - delay - 130) / 190));
      q.pz = h * 1.25 * (1 - drop);
      q.sprite.position.set(o.x, o.y - q.pz);
    },
  }));
  return g;
}
