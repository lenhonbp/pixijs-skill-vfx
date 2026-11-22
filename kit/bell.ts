import type { VfxWorld } from './vfx-world';
import { type VfxTextures, TEX_METRICS as M } from './textures';
import type { OnUnit, ShieldHandle } from './status';
import type { Palette } from './recipes';
import { WUXING } from './elements';
import { group } from './group';
import { clamp01, envelope, inQuad, lerpColor, outQuad, rand } from './ease';
import { bellFragments } from './metal-surfaces';
import { metalSparks } from './metal';

/** A cast-bronze temple bell: drop, ring on hit, and fracture on break. */
export function goldenBell(w: VfxWorld, tex: VfxTextures,
  o: OnUnit & { palette?: Palette; duration?: number; onBreak?: () => void }): ShieldHandle {
  const h = o.height ?? 70, s = h / 70, p = o.palette ?? WUXING.kim.palette;
  const windup = 250, landing = 430, k = h * 1.65 / 300, radius = 110 * k;
  const g = group(w, landing + (o.duration ?? 3000), undefined, 80);
  let age = 0, landed = false, ringAge = Infinity, hits = 0;
  const landedness = () => inQuad(clamp01((age - windup) / (landing - windup)));
  const drop = () => h * 1.52 * (1 - landedness());
  const vibration = () => Number.isFinite(ringAge) ? Math.sin(ringAge * 0.075) * Math.exp(-ringAge / 130) : 0;
  const pose = () => {
    const at = o.target();
    return { x: at.x + vibration() * 5 * s, y: at.y, z: (at.z ?? 0) + drop() };
  };
  const shell = { x: 0, y: 0, blend: 'normal', follow: o.target, anchorY: 312 / 320, scale: k } as const;
  const metalTint = p.main === WUXING.kim.palette.main ? 0xffffff : lerpColor(0xffffff, p.main, 0.55);
  g.add(w.spawn({ ...shell, texture: tex.bell, delay: windup, life: Infinity, tint: metalTint, zBias: 30,
    onUpdate: (q) => {
      const at = pose();
      q.sprite.position.set(at.x, at.y - at.z);
      q.sprite.rotation = vibration() * 0.025;
    },
  }));
  g.add(w.spawn({ ...shell, texture: tex.bellCracks, delay: landing, life: Infinity, alpha: 0, tint: 0x34211b, zBias: 31,
    onUpdate: (q) => {
      const at = pose();
      q.sprite.position.set(at.x, at.y - at.z);
      q.sprite.rotation = vibration() * 0.025;
      q.sprite.alpha = hits > 1 ? 0.88 : 0;
    },
  }));
  g.add(w.spawn({ texture: tex.puff, blend: 'normal', layer: 'ground', groundAligned: true,
    x: 0, y: 0, follow: o.target, delay: windup, life: Infinity, tint: 0x111016, alpha: 0,
    onUpdate: (q) => {
      const amount = landedness();
      q.sprite.alpha = 0.14 + 0.48 * amount;
      q.sprite.scale.set(k * (2.6 - amount * 0.8), k * (2.6 - amount * 0.8) * w.groundSquash);
    },
  }));
  g.add(w.spawn({ texture: tex.star, x: 0, y: 0, follow: o.target, life: 295, delay: 145,
    scale: [0.24 * s, 0.06 * s], alpha: envelope(0.24, 0.66, 0.72), tint: p.core, zBias: 32,
    onUpdate: (q, t) => {
      const at = pose();
      q.sprite.position.set(at.x - radius * (0.12 + t * 0.28), at.y - at.z - h * (1.57 - t * 0.41));
    },
  }));
  g.addHandle(w.addUpdater((dt) => {
    age += dt; ringAge += dt;
    if (landed || age < landing) return;
    landed = true;
    ringAge = 0;
    const at = o.target();
    w.spawn({ ...at, z: 0, layer: 'ground', groundAligned: true, texture: tex.ring,
      life: 320, scale: [radius / M.ringRadius, radius * 1.7 / M.ringRadius, outQuad], alpha: [0.42, 0], tint: p.main });
    w.burst(10, () => {
      const a = rand(0, Math.PI * 2);
      return { texture: tex.puff, blend: 'normal', x: at.x + Math.cos(a) * radius * 0.9,
        y: at.y + Math.sin(a) * radius * w.groundSquash, z: (at.z ?? 0) + 4 * s, life: rand(260, 490),
        vx: Math.cos(a) * rand(30, 62) * s, vy: Math.sin(a) * 25 * s * w.groundSquash,
        vz: rand(4, 22) * s, scale: [0.15 * s, 0.41 * s], alpha: [0.43, 0], tint: 0x8c7460 };
    });
    metalSparks(w, tex, { ...at, z: (at.z ?? 0) + 7 * s }, p, 7, undefined, 0.75 * s);
    g.addHandle(w.stream({ rate: 2, make: () => ({
      texture: tex.star, x: -radius * rand(0.18, 0.33), y: 0, z: h * rand(0.97, 1.1), follow: o.target,
      life: rand(135, 220), scale: [0.06 * s, 0.17 * s], rotation: rand(-0.3, 0.3),
      alpha: envelope(0.31, 0.69, 0.69), tint: p.core, zBias: 32,
    }) }));
    w.shake(3 * s, 150);
  }));
  return {
    get alive() { return g.alive; },
    stop: () => g.stop(),
    hit(angle = 0) {
      if (!g.alive || !landed) return;
      hits += 1;
      ringAge = 0;
      const at = o.target();
      const impact = { x: at.x + Math.cos(angle) * radius * 0.81, y: at.y,
        z: (at.z ?? 0) + h * 0.60 - Math.sin(angle) * radius * 0.8 };
      metalSparks(w, tex, impact, p, 10, angle, 0.82 * s);
      w.spawn({ ...impact, texture: tex.star, life: 140, zBias: 35, scale: [0.26 * s, 0.04 * s],
        alpha: [0.92, 0], tint: p.core });
      for (let i = 0; i < 2; i++) w.spawn({ texture: tex.ring, x: 0, y: 0, z: h * 0.59,
        follow: o.target, life: 460, delay: i * 85, scaleX: [radius / M.ringRadius, radius * 2.3 / M.ringRadius, outQuad],
        scaleY: [radius / 290, radius / 125, outQuad], alpha: [0.31 - i * 0.08, 0], tint: p.main, zBias: 32 });
    },
    break() {
      if (!g.alive) return;
      const at = pose(), delay = 57;
      g.stop();
      w.spawn({ ...at, texture: tex.bellCracks, anchorY: shell.anchorY, life: 125,
        scale: k, alpha: envelope(0, 0.9, 0.74), tint: p.core, zBias: 34 });
      const pieces = bellFragments(tex.bell);
      if (pieces) {
        for (const piece of pieces) {
          const x = piece.x - 128;
          w.spawn({ texture: piece.texture, blend: 'normal', x: at.x + x * k, y: at.y, z: at.z + (312 - piece.y) * k,
            life: rand(610, 930), delay, vx: x * rand(0.85, 1.9) * s,
            vy: rand(-45, 48) * s * w.groundSquash, vz: rand(80, 210) * s, gravity: 760 * s, bounce: 0.27,
            spin: rand(-6, 6), scale: k, alpha: envelope(0, 0.37), tint: metalTint, zBias: 31 });
        }
      }
      w.burst(16, () => {
        const x = rand(-radius, radius);
        return { texture: tex.shard, blend: 'normal', x: at.x + x, y: at.y,
          z: at.z + rand(6, h * 1.45), life: rand(490, 810), delay, vx: x * rand(1.5, 4),
          vy: rand(-70, 70) * s * w.groundSquash, vz: rand(70, 225) * s, gravity: 740 * s, bounce: 0.32,
          rotation: rand(0, Math.PI * 2), spin: rand(-12, 12), scale: rand(0.075, 0.25) * s,
          alpha: envelope(0, 0.48, 0.9), tint: [p.core, 0x8e552f], zBias: 31 };
      });
      metalSparks(w, tex, { ...at, z: at.z + h * 0.65 }, p, 16, undefined, s);
      w.shake(4 * s, 180);
      o.onBreak?.();
    },
  };
}
