import type { VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import type { OnUnit, ShieldHandle } from './status';
import { type Palette, hitSpark } from './recipes';
import { WUXING } from './elements';
import { group } from './group';
import { stoneTint, dustTint } from './elemental';
import { clamp01, envelope, lerpColor, outCubic, rand } from './ease';

/** Rising stone plates lock onto shoulders, torso, hips and shins. */
export function stoneArmor(w: VfxWorld, tex: VfxTextures,
  o: OnUnit & { palette?: Palette; duration?: number; onBreak?: () => void }): ShieldHandle {
  const h = o.height ?? 70, s = h / 70, p = o.palette ?? WUXING.tho.palette;
  // [x, height fraction, rotation, scale]: broad pauldrons, overlapping chest slabs, tapering tassets and greaves
  const slots = [[-15, 0.8, -0.32, 0.34], [15, 0.8, 0.3, 0.33], [-7, 0.6, -0.1, 0.3], [8, 0.58, 0.14, 0.28],
    [-11, 0.38, -0.22, 0.25], [12, 0.37, 0.2, 0.24], [-8, 0.15, -0.06, 0.2], [9, 0.15, 0.1, 0.19]];
  const stone = stoneTint(p, 0.28), dust = dustTint(p);
  const plateTint = slots.map((_, i) => lerpColor(stone, p.dark, 0.06 + (i % 3) * 0.07));
  let age = 0, pulse = Infinity;
  const locked = new Set<number>();
  const g = group(w, 650 + (o.duration ?? 2200), () => {
    const at = o.target();
    slots.forEach(([x, z, rotation, k], i) => {
      const t = outCubic(clamp01((age - 230 - i * 25) / 240));
      w.spawn({ texture: tex.rockPlate, blend: 'normal', x: at.x + (x + Math.sign(x) * 45 * (1 - t)) * s,
        y: at.y, z: (at.z ?? 0) + z * h * t, life: 1100, scale: k * s,
        rotation, spin: rand(-4, 4), vx: Math.sign(x) * rand(15, 45) * s, vz: 30 * s,
        gravity: 650 * s, alpha: envelope(0, 0.7), tint: plateTint[i], zBias: 32,
        onUpdate: (q) => {
          if (q.z < 0) { q.pz -= q.z; q.vz = 0; q.vx *= 0.8; q.o.spin = 0; }
        } });
    });
  }, 50);
  g.addHandle(w.addUpdater((dt) => { age += dt; pulse += dt; }));
  g.addHandle(w.stream({ rate: 35, duration: 300, make: () => {
    const x = rand(-40, 40) * s;
    return { texture: tex.rock, blend: 'normal', x, y: 0, z: 2, follow: o.target,
      life: 430, vx: -x * 1.5, vz: rand(60, 120) * s, gravity: 120 * s,
      scale: rand(0.12, 0.22) * s, rotation: rand(0, 6.3), spin: rand(-4, 4), alpha: [0.9, 0], tint: lerpColor(stone, p.dark, rand(0, 0.4)) };
  } }));
  // the ground cracks open where the plates are pulled from
  {
    const at = o.target();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rand(-0.4, 0.4), len = rand(34, 50) * s;
      g.add(w.spawn({ texture: tex.fissure, blend: 'normal', layer: 'ground', groundAligned: true,
        x: at.x + Math.cos(a) * len * 0.5, y: at.y + Math.sin(a) * len * 0.5 * w.groundSquash, rotation: a,
        life: 1800, scaleX: [len * 0.4 / 256, len / 256, outCubic], scaleY: 0.5 * s, alpha: envelope(0.03, 0.45, 0.85), tint: stone }));
    }
  }
  for (let i = 0; i < 3; i++) {
    g.add(w.spawn({ texture: tex.puff, blend: 'normal', x: rand(-14, 14) * s, y: 0, z: 4, follow: o.target, delay: i * 60,
      life: 900, vx: rand(-30, 30) * s, vz: rand(10, 24) * s, drag: 1.5, rotation: rand(0, 6.3),
      scale: [0.3 * s, 0.95 * s, outCubic], alpha: envelope(0.1, 0.6, 0.32), tint: lerpColor(dust, 0x5a4e40, i * 0.15) }));
  }
  slots.forEach(([x, z, rotation, k], i) => {
    g.add(w.spawn({ texture: tex.rockPlate, blend: 'normal', x: 0, y: 0, follow: o.target,
      delay: 230 + i * 25, life: Infinity, scale: k * s, tint: plateTint[i], zBias: 30 + i * 0.01,
      onUpdate: (q) => {
        const t = outCubic(clamp01((age - 230 - i * 25) / 240));
        const jolt = pulse < 220 ? Math.sin(pulse * 0.1) * (1 - pulse / 220) * 2 * s : 0;
        q.px = (x + Math.sign(x) * 45 * (1 - t)) * s + jolt; q.pz = z * h * t;
        q.sprite.rotation = rotation + (1 - t) * Math.sign(x);
        const at = o.target(); q.sprite.position.set(at.x + q.px, at.y - (at.z ?? 0) - q.pz);
        if (t === 1 && !locked.has(i)) {
          locked.add(i);
          w.spawn({ texture: tex.puff, blend: 'normal', x: at.x + x * s, y: at.y, z: (at.z ?? 0) + z * h,
            life: 320, scale: [0.08 * s, 0.3 * s], alpha: [0.35, 0], tint: dust });
          if (i === slots.length - 1) w.shake(2 * s, 100);
        }
      },
    }));
  });
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.5, follow: o.target,
    delay: 650, life: Infinity, scaleX: 0.55 * s, scaleY: 0.9 * s, alpha: 0.05, tint: p.main, zBias: 29 }));
  g.addHandle(w.stream({ rate: 3, make: () => age < 650 ? null : ({ texture: tex.rock, blend: 'normal',
    x: rand(-17, 17) * s, y: 0, z: rand(0.2, 0.7) * h, follow: o.target,
    life: 650, gravity: 250 * s, scale: rand(0.06, 0.1) * s, rotation: rand(0, 6.3), alpha: [0.8, 0], tint: lerpColor(stone, p.dark, 0.4) }) }));
  return {
    get alive() { return g.alive; },
    stop: () => g.stop(),
    hit(angle = 0) {
      if (!g.alive || age < 650) return;
      pulse = 0;
      const at = o.target();
      hitSpark(w, tex, { ...at, z: (at.z ?? 0) + h * 0.6, palette: { ...p, core: p.main }, size: 0.25 * s, angle });
    },
    break() { if (!g.alive) return; g.stop(); o.onBreak?.(); },
  };
}
