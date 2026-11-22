// Channeled and cast-time effects: beams, cone breath, charge-up, summon circles.
import type { VfxWorld, Vec3, Handle, Particle } from './vfx-world';
import { VfxTextures, TEX_METRICS as M } from './textures';
import { shockwave, type Palette } from './recipes';
import { group, ms } from './group';
import { Distortion } from './postfx';
import { clamp01, envelope, inQuad, lerp, lerpColor, outBack, outCubic, outQuad, rand } from './ease';

const TAU = Math.PI * 2;

/** Lay a beam sprite (anchorX 0) between two 3D points; sorted at the nearer end. */
function placeSegment(q: Particle, a: Vec3, b: Vec3, scaleY: number) {
  const ay = a.y - (a.z ?? 0), by = b.y - (b.z ?? 0);
  const gy = Math.max(a.y, b.y);
  q.o.x = a.x;
  q.o.y = gy;
  q.o.z = gy - ay;
  q.rotation = Math.atan2(by - ay, b.x - a.x);
  q.o.scaleX = (Math.hypot(b.x - a.x, by - ay) + 1) / M.beamLength;
  q.o.scaleY = scaleY;
}

/**
 * Continuous beam between two moving points (hand socket -> target chest). Lives for `duration`
 * (Infinity = until stop()). Use for lasers, water jets, life drain.
 */
export function beam(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: () => Vec3; to: () => Vec3; palette: Palette; width?: number; duration?: number; impactSparks?: boolean; style?: 'laser' | 'water' },
): Handle {
  if (o.style === 'water') return waterBeam(w, tex, o);
  const p = o.palette;
  const wd = o.width ?? 1;
  const g = group(w, o.duration ?? Infinity, undefined, 140);
  const ramp = (age: number) => outBack(clamp01(age / 140));
  const layers: [number, number, number, number][] = [
    [2.6, 0.3, p.dark, 0],
    [1.5, 0.75, p.main, 1],
    [0.45, 1, p.core, 2],
  ];
  for (const [sy, alpha, tint, zb] of layers) {
    g.add(w.spawn({
      texture: tex.beam, x: 0, y: 0, anchorX: 0, life: Infinity, zBias: zb, tint, alpha,
      onUpdate: (q) => placeSegment(q, o.from(), o.to(), sy * wd * ramp(q.age) * (1 + 0.12 * Math.sin(q.age * 0.045 + zb))),
    }));
  }
  const ends = (f: () => Vec3, sc: number) => {
    g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: f, life: Infinity, zBias: 3, tint: p.main, alpha: 0.8, onUpdate: (q) => { q.o.scale = sc * wd * (1 + 0.15 * Math.sin(q.age * 0.06)); } }));
    g.add(w.spawn({ texture: tex.dot, x: 0, y: 0, follow: f, life: Infinity, zBias: 4, tint: p.core, scale: 0.6 * sc * wd }));
  };
  ends(o.from, 1.0);
  ends(o.to, 1.5);
  const ground = () => { const t = o.to(); return { x: t.x, y: t.y, z: 0 }; };
  g.add(w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: ground, life: Infinity, scale: 1.6 * wd, alpha: 0.5, tint: p.main }));
  g.addHandle(w.stream({
    rate: 70,
    make: () => {
      const a = o.from(), b = o.to();
      const u = rand(0, 0.85);
      const len = Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)) || 1;
      const sp = 900;
      const life = ((1 - u) * len) / sp * 1000;
      return {
        texture: tex.dot, x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z ?? 0, b.z ?? 0, u) + rand(-5, 5) * wd, life, zBias: 3,
        vx: ((b.x - a.x) / len) * sp, vy: ((b.y - a.y) / len) * sp, vz: (((b.z ?? 0) - (a.z ?? 0)) / len) * sp,
        scale: rand(0.25, 0.45) * wd, tint: p.core,
      };
    },
  }));
  if (o.impactSparks !== false) {
    g.addHandle(w.stream({
      rate: 45,
      make: () => {
        const t = o.to();
        const a = rand(0, TAU), sp = rand(150, 380);
        return { texture: tex.streak, x: t.x, y: t.y, z: t.z ?? 40, life: rand(150, 260), zBias: 5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash * 0.3, vz: Math.sin(a) * sp, gravity: 500, drag: 3, faceVelocity: true, scaleX: [0.4, 0.05], scaleY: 0.4, tint: [p.core, p.main] };
      },
    }));
  }
  return g;
}

function waterBeam(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: () => Vec3; to: () => Vec3; palette: Palette; width?: number; duration?: number; impactSparks?: boolean },
): Handle {
  const p = o.palette, wd = o.width ?? 1;
  const g = group(w, o.duration ?? Infinity, undefined, 180);
  g.add(w.spawn({
    texture: tex.beam, blend: 'normal', x: 0, y: 0, anchorX: 0, life: Infinity, tint: p.dark, alpha: 0.55,
    onUpdate: (q) => placeSegment(q, o.from(), o.to(), 2.6 * wd * outCubic(clamp01(q.age / 180))),
  }));
  g.addHandle(w.stream({
    rate: 95,
    make: () => {
      const start = rand(0, 0.85), phase = rand(0, TAU), radius = rand(7, 17) * wd;
      return {
        texture: tex.puff, blend: 'normal', x: 0, y: 0, life: 560, zBias: 2,
        scaleX: rand(0.6, 0.9) * wd, scaleY: rand(0.4, 0.6) * wd,
        alpha: envelope(0.1, 0.3, 0.65), tint: [lerpColor(p.main, p.core, 0.25), p.main],
        onUpdate: (q, t) => {
          const a = o.from(), b = o.to(), u = start + (1 - start) * t;
          const dx = b.x - a.x, dy = b.y - (b.z ?? 0) - a.y + (a.z ?? 0);
          const len = Math.hypot(dx, dy) || 1;
          const wave = Math.sin(phase + t * TAU * 1.5) * radius;
          q.o.x = lerp(a.x, b.x, u) - dy / len * wave;
          q.o.y = lerp(a.y, b.y, u);
          q.o.z = lerp(a.z ?? 0, b.z ?? 0, u) - dx / len * wave;
          q.rotation = Math.atan2(dy, dx) + Math.sin(phase + t * TAU) * 0.5;
        },
      };
    },
  }));
  g.addHandle(w.stream({
    rate: 35,
    make: () => {
      const a = o.from(), b = o.to(), u = rand(0, 0.9), life = 450;
      return {
        texture: tex.drop, blend: 'normal', x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z ?? 0, b.z ?? 0, u) + rand(-13, 13) * wd,
        life, vx: (b.x - a.x) * (1 - u) / (life / 1000), vy: (b.y - a.y) * (1 - u) / (life / 1000),
        vz: ((b.z ?? 0) - (a.z ?? 0)) * (1 - u) / (life / 1000),
        faceVelocity: true, scale: rand(0.35, 0.55) * wd, alpha: envelope(0.1, 0.2, 0.8), tint: p.core, zBias: 3,
      };
    },
  }));
  const ground = () => { const t = o.to(); return { x: t.x, y: t.y, z: 0 }; };
  g.add(w.spawn({ texture: tex.glow, blend: 'normal', layer: 'ground', groundAligned: true, x: 0, y: 0, follow: ground, life: Infinity, scale: 1.8 * wd, alpha: 0.4, tint: p.main }));
  if (o.impactSparks !== false) {
    g.addHandle(w.stream({
      rate: 50,
      make: () => {
        const t = o.to(), angle = rand(0, TAU), speed = rand(70, 180) * wd;
        return {
          texture: tex.drop, blend: 'normal', x: t.x, y: t.y, z: t.z ?? 40, life: rand(380, 650), zBias: 4,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * w.groundSquash, vz: rand(60, 170), gravity: 650,
          faceVelocity: true, scale: rand(0.35, 0.6) * wd, alpha: envelope(0.05, 0.4, 0.8), tint: [p.core, p.main],
        };
      },
    }));
    g.addHandle(w.stream({
      rate: 6,
      make: () => {
        const t = o.to();
        return { texture: tex.ring, layer: 'ground', groundAligned: true, x: t.x, y: t.y, life: 550, scale: [0.08 * wd, 0.38 * wd, outQuad], alpha: [0.45, 0], tint: p.main };
      },
    }));
    g.addHandle(w.stream({
      rate: 8,
      make: () => {
        const t = o.to();
        return { texture: tex.ring, blend: 'normal', groundAligned: true, x: t.x, y: t.y, z: t.z ?? 40, zBias: 5, life: 380, scale: [0.05 * wd, 0.22 * wd, outQuad], alpha: [0.8, 0], tint: p.core };
      },
    }));
  }
  return g;
}

export type BreathStyle = 'fire' | 'frost' | 'poison' | 'wind';

/** Cone breath / spray from `origin` toward ground angle `angle()`. */
export function coneBreath(
  w: VfxWorld,
  tex: VfxTextures,
  o: { origin: () => Vec3; angle: () => number; palette: Palette; range?: number; spread?: number; duration?: number; style?: BreathStyle },
): Handle {
  const p = o.palette;
  const range = o.range ?? 230;
  const spread = o.spread ?? 0.55;
  const style = o.style ?? 'fire';
  const g = group(w, o.duration ?? 1500, undefined, 200);
  const life = 520;
  const sp = (range / life) * 1000 * 1.25;
  const additive = style !== 'poison';
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: o.origin, life: Infinity, zBias: 3, scale: 1.1, alpha: 0.85, tint: p.main }));
  if (style === 'fire') {
    // Heat haze over the middle of the cone.
    w.plugin(Distortion)?.haze(() => {
      const s = o.origin(), a = o.angle();
      return { x: s.x + Math.cos(a) * range * 0.55, y: s.y - (s.z ?? 0) + Math.sin(a) * range * 0.55 * w.groundSquash };
    }, { radius: range * 0.3, duration: o.duration ?? 1500, rise: 26, strength: 0.8 });
  }
  g.addHandle(w.stream({
    rate: 75,
    make: () => {
      const s = o.origin();
      const a = o.angle() + rand(-spread / 2, spread / 2);
      const v = sp * rand(0.85, 1.1);
      return {
        texture: tex.puff, blend: additive ? 'add' : 'normal', x: s.x, y: s.y, z: s.z ?? 40, life: life * rand(0.8, 1.1), zBias: 6,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v * w.groundSquash, vz: style === 'frost' ? -20 : style === 'fire' ? 30 : 0, drag: 2.2,
        rotation: rand(0, TAU), spin: rand(-3, 3), scale: [0.25, rand(1.2, 1.6), outCubic],
        alpha: additive ? envelope(0.08, 0.55, 0.6) : envelope(0.1, 0.45, 0.5),
        tint: (t) => (t < 0.3 ? lerpColor(p.core, p.main, t / 0.3) : lerpColor(p.main, p.dark, (t - 0.3) / 0.7)),
      };
    },
  }));
  g.addHandle(w.stream({
    rate: 40,
    make: () => {
      const s = o.origin();
      const a = o.angle() + rand(-spread / 2, spread / 2) * 0.8;
      const v = sp * rand(1, 1.4);
      const tx = style === 'frost' ? tex.shard : style === 'wind' ? tex.leaf : tex.streak;
      return {
        texture: tx, x: s.x, y: s.y, z: (s.z ?? 40) + rand(-6, 6), life: rand(300, 460), zBias: 7, vx: Math.cos(a) * v, vy: Math.sin(a) * v * w.groundSquash,
        vz: style === 'fire' ? rand(0, 80) : 0, drag: 1.5, faceVelocity: true, scaleX: style === 'fire' ? [0.4, 0.1] : 0.3, scaleY: style === 'fire' ? 0.4 : 0.3, tint: [p.core, p.main],
      };
    },
  }));
  g.addHandle(w.stream({
    rate: 18,
    make: () => {
      const s = o.origin();
      const a = o.angle() + rand(-spread / 2, spread / 2) * 0.7;
      const d = rand(0.3, 1) * range;
      return { texture: tex.glow, layer: 'ground', groundAligned: true, x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d * w.groundSquash, life: 380, scale: 0.5 + d / range, alpha: envelope(0.2, 0.3, 0.5), tint: p.main };
    },
  }));
  return g;
}

/** Gather energy at a point (hand, staff tip) for `duration`, then flash and call onDone. */
export function chargeUp(w: VfxWorld, tex: VfxTextures, o: { target: () => Vec3; palette: Palette; duration?: number; size?: number; release?: { color?: number; size?: number; coreSize?: number; alpha?: number }; onDone?: () => void }): Handle {
  const p = o.palette;
  const dur = o.duration ?? 800;
  const s = o.size ?? 1;
  const g = group(w, dur, () => {
    const t = o.target();
    const releaseSize = s * (o.release?.size ?? 0.65);
    w.spawn({ texture: tex.glow, x: t.x, y: t.y, z: t.z ?? 40, life: 160, zBias: 6, scale: [1.2 * releaseSize, 2.4 * releaseSize, outQuad], alpha: [o.release?.alpha ?? 0.4, 0], tint: o.release?.color ?? p.main });
    w.spawn({ texture: tex.star, x: t.x, y: t.y, z: t.z ?? 40, life: 200, zBias: 7, rotation: rand(0, TAU), scale: [1.3 * s * (o.release?.coreSize ?? 0.2), 0], tint: p.core });
    o.onDone?.();
  }, 60);
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: o.target, life: dur, zBias: 5, scale: [0.3 * s, 1.3 * s, inQuad], alpha: (t) => 0.6 + 0.3 * Math.sin(t * 60), tint: p.main }));
  g.add(w.spawn({ texture: tex.dot, x: 0, y: 0, follow: o.target, life: dur, zBias: 6, scale: [0.2 * s, 0.7 * s, inQuad], tint: p.core }));
  g.addHandle(w.stream({ rate: 5, duration: dur, make: () => ({ texture: tex.ring, x: 0, y: 0, follow: o.target, life: 320, zBias: 5, scale: [0.3 * s, 0.02, inQuad], alpha: [0, 0.8], tint: p.main }) }));
  g.addHandle(w.stream({
    rate: 60, duration: dur - 120,
    make: () => {
      const a = rand(0, TAU), r = rand(40, 70) * s, life = 260;
      const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
      return { texture: tex.streak, x: ox, y: 0, z: oz, follow: o.target, life, zBias: 6, vx: (-ox / life) * 1000, vz: (-oz / life) * 1000, faceVelocity: true, scaleX: [0.15, 0.45], scaleY: 0.35, alpha: [0.2, 1], tint: [p.main, p.core] };
    },
  }));
  return g;
}

/** Rune circle on the ground that charges for `duration`, then a pillar of light and onSummon. */
export function summonCircle(w: VfxWorld, tex: VfxTextures, o: { x: number; y: number; palette: Palette; radius?: number; duration?: number; columnAlpha?: number; onSummon?: () => void }): Handle {
  const p = o.palette;
  const r = o.radius ?? 70;
  const dur = o.duration ?? 1300;
  const k = r / M.runeRadius;
  const gnd = { layer: 'ground', groundAligned: true, x: o.x, y: o.y } as const;
  const total = dur + 700;
  const g = group(w, total, undefined, 300);
  const open = (t: number) => outBack(clamp01((t * total) / 320));
  g.add(w.spawn({ ...gnd, texture: tex.glow, life: total, scale: r / 34, alpha: ms.env(total, 200, 500, 0.45), tint: p.main }));
  g.add(w.spawn({ ...gnd, texture: tex.rune, life: total, spin: 0.5, scale: (t) => k * open(t), alpha: ms.env(total, 150, 500, 0.95), tint: p.main }));
  g.add(w.spawn({ ...gnd, texture: tex.rune, life: total, spin: -0.9, rotation: 0.4, scale: (t) => k * 0.55 * open(t), alpha: ms.env(total, 250, 500, 0.7), tint: p.core }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    g.add(w.spawn({
      texture: tex.glow, x: o.x + Math.cos(a) * r * 0.88, y: o.y + Math.sin(a) * r * 0.88 * w.groundSquash, z: 30, life: dur, delay: 150 + i * 60, zBias: 2,
      scaleX: 0.22, scaleY: [0.2, 1.6, outCubic], alpha: envelope(0.2, 0.7, 0.3), tint: p.main,
    }));
  }
  g.addHandle(w.stream({
    rate: 45, duration: dur,
    make: () => {
      const a0 = rand(0, TAU), spin = 2.5;
      return {
        texture: tex.dot, x: o.x, y: o.y, z: 2, life: 700, zBias: 3, vz: rand(20, 60), scale: [0.35, 0.1], tint: [p.main, p.core],
        onUpdate: (q, t) => {
          const rr = r * (1 - outQuad(t)) * 0.95;
          const a = a0 + t * spin;
          q.px = Math.cos(a) * rr;
          q.py = Math.sin(a) * rr * w.groundSquash;
        },
      };
    },
  }));
  g.addHandle(w.after(dur, () => {
    const a = o.columnAlpha ?? 1;
    w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: 90, life: 600, zBias: 8, scaleX: [0.6, 1.4, outCubic], scaleY: [2, 6, outCubic], alpha: [0.9 * a, 0, inQuad], tint: p.main });
    w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: 90, life: 380, zBias: 9, scaleX: [0.3, 0.5], scaleY: [2, 5], alpha: [a, 0], tint: p.core });
    shockwave(w, tex, { x: o.x, y: o.y, radius: r * 1.6, palette: p });
    w.burst(20, () => {
      const a = rand(0, TAU), sp = rand(100, 260);
      return { texture: tex.star, x: o.x, y: o.y, z: rand(10, 80), life: rand(400, 700), zBias: 7, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(50, 200), drag: 3, rotation: rand(0, TAU), spin: 4, scale: [0.45, 0], tint: [p.core, p.main] };
    });
    w.shake(6, 260);
    o.onSummon?.();
  }));
  return g;
}
