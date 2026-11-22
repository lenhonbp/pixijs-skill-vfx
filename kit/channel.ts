// Channeled and cast-time effects: beams, cone breath, charge-up, summon circles.
import type { VfxWorld, Vec3, Handle, Particle } from './vfx-world';
import type { Sprite } from 'pixi.js';
import { VfxTextures, TEX_METRICS as M } from './textures';
import { shockwave, type Palette } from './recipes';
import { floorRing } from './floor-ring';
import { group, ms } from './group';
import { Distortion } from './postfx';
import { burnFlames } from './fire';
import { clamp01, envelope, inQuad, lerp, lerpColor, outBack, outCubic, outQuad, rand } from './ease';

const TAU = Math.PI * 2;

export interface BattleCryOptions {
  target: () => Vec3;
  height: number;
  facing: number;
  palette: Palette;
  sprite?: Sprite;
  windup?: number;
  duration?: number;
}

/** Braced breath-in, directional sound fronts, then a single ember-wreathed rune. */
export function battleCry(w: VfxWorld, tex: VfxTextures, o: BattleCryOptions): Handle {
  const windup = o.windup ?? 340, duration = o.duration ?? 2800, h = o.height, s = h / 96, p = o.palette;
  const g = group(w, windup + duration, undefined, 250);
  if (o.sprite) {
    const sprite = o.sprite, sy = sprite.scale.y, rotation = sprite.rotation;
    let age = 0, bracing = true;
    const restore = () => {
      if (bracing && !sprite.destroyed) { sprite.scale.y = sy; sprite.rotation = rotation; }
      bracing = false;
    };
    const unown = w.own(restore);
    g.addHandle({ stop: () => { restore(); unown(); }, get alive() { return bracing; } });
    g.addHandle(w.addUpdater((dt) => {
      age += dt;
      if (sprite.destroyed || age >= windup + 180) { restore(); unown(); return false; }
      const brace = age < windup ? outCubic(age / windup) : 1 - outQuad((age - windup) / 180);
      sprite.scale.y = sy * (1 - brace * 0.09); sprite.rotation = rotation - o.facing * brace * 0.055;
    }));
  }
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: o.target, layer: 'ground', groundAligned: true,
    life: windup + 450, scale: [0.2 * s, 1.1 * s, outCubic], alpha: envelope(0.4, 0.5, 0.4), tint: p.main }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.55, follow: o.target,
    life: windup, scale: [0.15 * s, 0.65 * s], alpha: [0.05, 0.32], tint: p.main, zBias: 4 }));
  for (let i = 0; i < 22; i++) {
    const a = rand(0, TAU), r = rand(35, 75) * s, dust = i % 3 === 0;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    g.add(w.spawn({ texture: dust ? tex.puff : tex.streak, blend: dust ? 'normal' : 'add',
      x, y: 0, z: h * 0.55 + z, follow: o.target, life: windup, vx: -x / windup * 1000,
      vz: -z / windup * 1000, faceVelocity: !dust, scaleX: dust ? 0.12 * s : [0.12 * s, 0.3 * s],
      scaleY: dust ? 0.18 * s : 0.22 * s, alpha: envelope(0.15, 0.65, dust ? 0.3 : 0.65),
      tint: dust ? 0x8c5841 : p.main }));
  }
  g.addHandle(w.after(windup, () => {
    const at = o.target();
    shockwave(w, tex, { ...at, radius: 100 * s, palette: p, duration: 450 });
    w.shake(3, 180);
    for (let i = 0; i < 3; i++) g.add(w.spawn({ texture: tex.crescent, ...at, z: h * 0.65,
      delay: i * 85, life: 430, vx: o.facing * 75 * s, rotation: o.facing > 0 ? 0 : Math.PI,
      scaleX: [0.15 * s, 0.95 * s, outCubic], scaleY: [0.2 * s, 0.85 * s, outCubic],
      alpha: [0.6 - i * 0.1, 0], tint: i === 0 ? p.core : p.main, zBias: 8 }));
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 + rand(-0.1, 0.1), speed = rand(65, 130) * s;
      g.add(w.spawn({ texture: tex.puff, blend: 'normal', ...at, z: 3, life: rand(550, 850),
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * w.groundSquash, vz: rand(8, 25), drag: 2,
        scale: [0.15 * s, 0.5 * s], alpha: envelope(0.1, 0.3, 0.28), tint: 0x98745b, spin: rand(-1, 1) }));
    }
    const rune = floorRing(w, tex, { around: o.target, texture: tex.rune, textureRadius: M.runeRadius,
      radius: 44 * s, palette: p, duration, alpha: ms.env(duration, 180, 500, 0.65), spin: 0.25 });
    g.add(rune.far); g.add(rune.near);
    g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.42, follow: o.target,
      life: duration, scaleX: 0.6 * s, scaleY: 1.2 * s, alpha: ms.env(duration, 200, 650, 0.15), tint: p.main, zBias: -1 }));
    g.addHandle(w.stream({ rate: 20, duration: duration - 300, make: () => ({ texture: tex.dot,
      x: rand(-22, 22) * s, y: rand(-8, 8) * s, z: rand(3, h * 0.35), follow: o.target,
      life: rand(600, 1000), vz: rand(35, 75) * s, vx: rand(-9, 9) * s,
      scale: [rand(0.045, 0.09) * s, 0], alpha: envelope(0.1, 0.5, 0.75), tint: [p.core, p.main] }) }));
    g.addHandle(burnFlames(w, o.target, h * 0.85, duration - 400, p));
  }));
  return g;
}

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

export interface SummonCircleOptions {
  x: number;
  y: number;
  palette: Palette;
  radius?: number;
  duration?: number;
  linger?: number;
  columnAlpha?: number;
  onSummon?: () => void;
}

/** Rune circle on the ground that charges for `duration`, then a pillar of light and onSummon. */
export function summonCircle(w: VfxWorld, tex: VfxTextures, o: SummonCircleOptions): Handle {
  const p = o.palette;
  const r = o.radius ?? 70;
  const dur = o.duration ?? 1300;
  const k = r / M.runeRadius;
  const gnd = { layer: 'ground', groundAligned: true, x: o.x, y: o.y } as const;
  const total = dur + (o.linger ?? 700);
  const g = group(w, total, undefined, 180);
  const open = (t: number) => outCubic(clamp01((t * total) / 300)) * (1 - outCubic(clamp01((t * total - total + 450) / 450)));
  g.add(w.spawn({ ...gnd, texture: tex.glow, life: total, scale: r / 48, alpha: ms.env(total, 300, 500, 0.12), tint: p.main }));
  const outer = floorRing(w, tex, { x: o.x, y: o.y, texture: tex.rune, textureRadius: M.runeRadius,
    radius: r, palette: p, duration: total, spin: 0.12, scale: (t) => k * open(t),
    sweep: (t) => t * total / (dur * 0.85), alpha: ms.env(total, 160, 500, 0.85) });
  const inner = floorRing(w, tex, { x: o.x, y: o.y, radius: r * 0.62, palette: p, duration: total,
    scale: (t) => r * 0.62 / M.ringRadius * open(t),
    sweep: (t) => (t * total - 160) / (dur * 0.8), alpha: ms.env(total, 280, 500, 0.5) });
  for (const ring of [outer, inner]) { g.add(ring.far); g.add(ring.near); }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    g.add(w.spawn({
      texture: tex.rune, x: o.x, y: o.y, z: 4, life: 900, delay: 250 + i * 150, zBias: 2,
      scale: [0.028, 0.018], alpha: envelope(0.15, 0.5, 0.7), tint: p.main, spin: 1.5, vz: 55,
      onUpdate: (q, t) => { q.px = Math.cos(a + t * 1.8) * r * 0.8; q.py = Math.sin(a + t * 1.8) * r * 0.8 * w.groundSquash; },
    }));
  }
  g.addHandle(w.stream({
    rate: 10, duration: dur,
    make: () => {
      const a0 = rand(0, TAU), spin = 2.5;
      return {
        texture: tex.dot, x: o.x, y: o.y, z: 2, life: 500, zBias: 3, vz: rand(20, 50), scale: [0.075, 0], alpha: [0.65, 0], tint: p.main,
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
    const a = o.columnAlpha ?? 0.7;
    g.add(w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: 80, life: 700, zBias: 8,
      scaleX: [0.18, 0.3, outCubic], scaleY: [0.4, 2.5, outCubic], alpha: envelope(0.1, 0.3, a), tint: p.main }));
    g.add(w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: 80, life: 500, zBias: 9,
      scaleX: [0.06, 0.1], scaleY: [0.5, 2.2], alpha: [a * 0.65, 0], tint: p.core }));
    w.burst(10, () => {
      const a = rand(0, TAU), sp = rand(15, 45);
      return { texture: tex.dot, x: o.x, y: o.y, z: rand(4, 30), life: rand(400, 650), zBias: 7,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(60, 140),
        scale: [0.09, 0], alpha: [0.7, 0], tint: p.main };
    });
    w.shake(2, 140);
    o.onSummon?.();
  }));
  return g;
}
