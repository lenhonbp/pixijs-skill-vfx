import type { VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import type { OnUnit, ShieldHandle } from './status';
import { type Palette, hitSpark, shockwave } from './recipes';
import { WUXING } from './elements';
import { group } from './group';
import { clamp01, envelope, inQuad, outQuad, rand } from './ease';

/** A temple-bell ward: gather, drop, ring on hit, and fracture on break. */
export function goldenBell(w: VfxWorld, tex: VfxTextures,
  o: OnUnit & { palette?: Palette; duration?: number; onBreak?: () => void }): ShieldHandle {
  const h = o.height ?? 70, s = h / 70, p = o.palette ?? WUXING.kim.palette;
  const windup = 250, landing = 430, k = h * 1.5 / 300, radius = 110 * k;
  const g = group(w, landing + (o.duration ?? 3000), undefined, 180);
  let age = 0, landed = false, ringAge = Infinity;
  g.addHandle(w.stream({ rate: 30, duration: windup, make: () => {
    const x = rand(-35, 35) * s;
    return { texture: tex.streak, x, y: 0, z: h * 1.6 + rand(0, 20) * s, follow: o.target,
      life: 220, vx: -x / 0.22, vz: -35 * s, faceVelocity: true, scale: [0.16 * s, 0.03 * s],
      alpha: [0.6, 0], tint: p.main };
  } }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 1.55, follow: o.target,
    life: windup, scale: [0.3 * s, 0.7 * s], alpha: envelope(0.7, 0.15, 0.3), tint: p.main }));
  const bell = g.add(w.spawn({ texture: tex.bell, blend: 'normal', x: 0, y: 0, follow: o.target,
    delay: windup, life: Infinity, anchorY: 308 / 320, scale: k, alpha: 0.95, tint: p.main, zBias: 30,
    onUpdate: (q) => {
      const fall = clamp01((age - windup) / (landing - windup));
      const drop = h * 1.6 * (1 - inQuad(fall));
      const squash = age >= landing ? Math.sin(clamp01((age - landing) / 220) * Math.PI) * 0.12 : 0;
      const wobble = Number.isFinite(ringAge) ? Math.sin(ringAge * 0.065) * Math.exp(-ringAge / 180) : 0;
      q.pz = drop; q.px = wobble * 4 * s;
      const at = o.target();
      q.sprite.position.set(at.x + q.px, at.y - (at.z ?? 0) - drop);
      q.sprite.scale.set(k * (1 + squash + wobble * 0.045), k * (1 - squash));
    },
  }));
  g.add(w.spawn({ texture: tex.bell, x: 0, y: 0, follow: o.target,
    delay: windup, life: Infinity, anchorY: 308 / 320, scale: k, alpha: 0.045, tint: p.main, zBias: 31,
    onUpdate: (q) => {
      if (!bell) return;
      q.sprite.position.copyFrom(bell.sprite.position);
      q.sprite.scale.copyFrom(bell.sprite.scale);
    },
  }));
  g.add(w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true, x: 0, y: 0,
    follow: o.target, delay: landing, life: Infinity, scale: radius / 120, alpha: 0.4, tint: p.main }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.6, follow: o.target,
    delay: landing, life: Infinity, scaleX: 0.9 * s, scaleY: 1.3 * s, alpha: 0.09, tint: p.main, zBias: -10 }));
  g.addHandle(w.addUpdater((dt) => {
    age += dt; ringAge += dt;
    if (!landed && age >= landing) {
      landed = true;
      const at = o.target();
      shockwave(w, tex, { ...at, radius: radius * 1.6, palette: { ...p, core: p.main }, duration: 330 });
      w.burst(12, () => {
        const a = rand(0, Math.PI * 2);
        return { texture: tex.puff, blend: 'normal', x: at.x + Math.cos(a) * radius, y: at.y,
          z: at.z ?? 0, life: 550, vx: Math.cos(a) * 45 * s, vy: Math.sin(a) * 25 * s,
          vz: 15 * s, scale: [0.13 * s, 0.35 * s], alpha: [0.24, 0], tint: p.dark };
      });
      w.shake(3 * s, 150);
      g.addHandle(w.stream({ rate: 12, make: () => ({ texture: tex.streak,
        x: ((age % 2400) / 1200 - 1) * radius * 0.75, y: 0, z: h * 0.65, follow: o.target,
        life: 280, rotation: -Math.PI / 2, scaleX: 0.55 * s, scaleY: 0.25 * s,
        alpha: envelope(0.2, 0.5, 0.16), tint: p.main, zBias: 31,
      }) }));
    }
  }));
  return {
    get alive() { return g.alive; },
    stop: () => g.stop(),
    hit(angle = 0) {
      if (!g.alive || !landed) return;
      ringAge = 0;
      const at = o.target();
      hitSpark(w, tex, { x: at.x + Math.cos(angle) * radius, y: at.y,
        z: (at.z ?? 0) + h * 0.65 - Math.sin(angle) * radius,
        palette: { ...p, core: p.main }, angle, size: 0.4 * s });
      for (let i = 0; i < 3; i++) w.spawn({ texture: tex.ring, x: 0, y: 0, z: h * 0.6,
        follow: o.target, life: 650, delay: i * 80, scaleX: [radius / 120, radius * 2.2 / 120, outQuad],
        scaleY: [radius / 240, radius * 1.1 / 120, outQuad], alpha: [0.35, 0], tint: p.main, zBias: 32 });
    },
    break() {
      if (!g.alive) return;
      const at = o.target(), drop = bell?.pz ?? 0;
      g.stop();
      w.spawn({ texture: tex.bellCracks, blend: 'normal', ...at, z: (at.z ?? 0) + drop,
        anchorY: 308 / 320, life: 180, scale: k, alpha: [0.95, 0], tint: p.dark, zBias: 32 });
      w.burst(28, () => ({ texture: tex.shard, blend: 'normal',
        x: at.x + rand(-radius, radius), y: at.y, z: (at.z ?? 0) + drop + rand(10, h * 1.3),
        life: 950, vx: rand(-110, 110) * s, vz: rand(70, 170) * s, gravity: 650 * s,
        bounce: 0.2, rotation: rand(0, Math.PI * 2), spin: rand(-8, 8),
        scale: [rand(0.2, 0.4) * s, 0.06 * s], alpha: [0.9, 0], tint: [p.main, p.dark], zBias: 31,
      }));
      w.spawn({ texture: tex.glow, ...at, z: (at.z ?? 0) + h * 0.65 + drop, delay: 100,
        life: 250, scale: [0.7 * s, 1.5 * s], alpha: [0.3, 0], tint: p.main, zBias: 33 });
      w.shake(4 * s, 180);
      o.onBreak?.();
    },
  };
}
