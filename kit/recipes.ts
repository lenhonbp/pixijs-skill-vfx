// Ready-made skill effects built only from VfxWorld primitives. Copy one, then
// tune timing/colors per skill. Every recipe takes ground coords (x, y) + z.
import { Sprite } from 'pixi.js';
import { VfxWorld, Handle, Vec3, Particle } from './vfx-world';
import { VfxTextures, TEX_METRICS as M } from './textures';
import { blend } from './pixi-compat';
import { colorRamp, envelope, inQuad, outCubic, outExpo, outQuad, rand, lerp, lerpColor } from './ease';

export interface Palette {
  /** Hottest color, near white. */
  core: number;
  /** Signature color of the element. */
  main: number;
  /** Dark falloff / smoke color. */
  dark: number;
}

export const PALETTES = {
  fire: { core: 0xfff3c4, main: 0xff7a1a, dark: 0x8a1a05 },
  ice: { core: 0xf0ffff, main: 0x55c8ff, dark: 0x1a3a8a },
  holy: { core: 0xffffff, main: 0xffd75e, dark: 0xb07a10 },
  nature: { core: 0xf4ffe0, main: 0x6dff7a, dark: 0x1f6b2a },
  arcane: { core: 0xffe8ff, main: 0xb45cff, dark: 0x3a0f7a },
  lightning: { core: 0xffffff, main: 0x8fd8ff, dark: 0x3050ff },
  poison: { core: 0xf0ffd0, main: 0x9cff3a, dark: 0x3a5a05 },
  blood: { core: 0xffd0d0, main: 0xff2a3a, dark: 0x5a0010 },
} satisfies Record<string, Palette>;

const TAU = Math.PI * 2;

/** Small directional impact burst: use on every hit. `angle` is screen-space (0 = right, -PI/2 = up). */
export function hitSpark(w: VfxWorld, tex: VfxTextures, o: Vec3 & { angle?: number; palette: Palette; size?: number }) {
  const { x, y } = o;
  const z = o.z ?? 30;
  const size = o.size ?? 1;
  const angle = o.angle ?? 0;
  w.spawn({ texture: tex.glow, x, y, z, life: 110, zBias: 5, scale: [0.9 * size, 1.6 * size, outQuad], alpha: [1, 0], tint: o.palette.core });
  w.spawn({ texture: tex.star, x, y, z, life: 160, zBias: 6, rotation: rand(0, TAU), spin: 3, scale: [0.9 * size, 0.2 * size, outQuad], tint: o.palette.main });
  w.burst(8, () => {
    const a = angle + rand(-0.9, 0.9);
    const sp = rand(260, 520) * size;
    return {
      texture: tex.streak, x, y, z, zBias: 5, life: rand(140, 240),
      vx: Math.cos(a) * sp, vz: -Math.sin(a) * sp, drag: 6,
      faceVelocity: true, scaleX: [0.5 * size, 0.1 * size], scaleY: 0.6 * size,
      tint: colorRamp(o.palette.core, o.palette.main, o.palette.dark, 0.3),
    };
  });
}

/** Make a character sprite flash white (works for Sprite/AnimatedSprite, v7 and v8). */
export function hitFlash(w: VfxWorld, target: Sprite, ms = 120, color = 0xffffff) {
  const f = new Sprite(target.texture);
  f.anchor.copyFrom(target.anchor);
  f.blendMode = blend('add');
  f.tint = color;
  target.addChild(f);
  let age = 0;
  w.addUpdater((dt) => {
    age += dt;
    f.alpha = 1 - age / ms;
    if (age >= ms) {
      f.destroy();
      return false;
    }
  });
}

/** Horizontal weapon swing at chest height. `angle` = facing on the ground (0 = right, PI/2 = toward camera). */
export function slash(
  w: VfxWorld,
  tex: VfxTextures,
  o: Vec3 & { angle: number; palette: Palette; radius?: number; sweep?: number; duration?: number; clockwise?: boolean },
) {
  const z = o.z ?? 38;
  const radius = o.radius ?? 90;
  const sweep = o.sweep ?? 2.0;
  const dur = o.duration ?? 200;
  const dir = o.clockwise === false ? -1 : 1;
  const k = radius / M.crescentRadius;
  const start = o.angle - (dir * sweep) / 2;
  const spin = (dir * sweep) / (dur / 1000);
  const base = { x: o.x, y: o.y, z, groundAligned: true, zBias: 3 } as const;
  // dark trailing smear, behind
  w.spawn({ ...base, texture: tex.crescent, life: dur * 1.4, rotation: start - dir * 0.35, spin, blend: 'normal', scale: [k * 0.95, k * 1.08, outCubic], alpha: [0.35, 0, inQuad], tint: o.palette.dark, zBias: 2 });
  // main colored arc
  w.spawn({ ...base, texture: tex.crescent, life: dur, rotation: start, spin, scale: [k * 0.85, k * 1.12, outCubic], scaleY: [1, 0.7], alpha: [1, 0, inQuad], tint: o.palette.main });
  // white-hot leading edge
  w.spawn({ ...base, texture: tex.crescent, life: dur * 0.6, rotation: start + dir * 0.15, spin, scale: [k * 0.8, k * 1.0, outCubic], scaleY: [0.55, 0.3], alpha: [1, 0], tint: o.palette.core });
  // sparks flung off the end of the swing
  w.after(dur * 0.55, () => {
    const endA = o.angle + (dir * sweep) / 2;
    const ex = o.x + Math.cos(endA) * radius;
    const ey = o.y + Math.sin(endA) * radius * w.groundSquash;
    w.burst(7, () => {
      const a = endA + dir * Math.PI / 2 + rand(-0.6, 0.6);
      const sp = rand(200, 420);
      return {
        texture: tex.streak, x: ex, y: ey, z, life: rand(180, 300), zBias: 4,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(0, 160), gravity: 500, drag: 3,
        faceVelocity: true, scaleX: [0.45, 0.1], scaleY: 0.5, tint: [o.palette.core, o.palette.main],
      };
    });
  });
}

/** Ground circle that fills up over `duration` (cast-time telegraph). Calls onDone at the end. */
export function telegraph(
  w: VfxWorld,
  tex: VfxTextures,
  o: { x: number; y: number; radius: number; duration: number; palette: Palette; onDone?: () => void },
): Handle {
  const k = o.radius / M.ringRadius;
  const kd = o.radius / M.discRadius;
  const ground = { x: o.x, y: o.y, layer: 'ground', groundAligned: true } as const;
  const parts: (Particle | null)[] = [
    w.spawn({ ...ground, texture: tex.ring, life: o.duration, scale: [k * 1.15, k, outCubic], alpha: (t) => 0.6 + 0.4 * Math.sin(t * 30), tint: o.palette.main }),
    w.spawn({ ...ground, texture: tex.disc, life: o.duration, scale: kd, alpha: 0.12, tint: o.palette.main }),
    w.spawn({ ...ground, texture: tex.disc, life: o.duration, scale: [0, kd], alpha: [0.1, 0.35], tint: o.palette.main }),
  ];
  return w.after(o.duration, () => {
    w.spawn({ ...ground, texture: tex.disc, life: 160, scale: kd, alpha: [0.6, 0], tint: o.palette.core });
    o.onDone?.();
    for (const p of parts) p?.kill();
  });
}

/** Expanding ring on the ground. */
export function shockwave(w: VfxWorld, tex: VfxTextures, o: { x: number; y: number; radius: number; palette: Palette; duration?: number }) {
  const k = o.radius / M.ringRadius;
  const life = o.duration ?? 380;
  const g = { x: o.x, y: o.y, layer: 'ground', groundAligned: true } as const;
  w.spawn({ ...g, texture: tex.ring, life, scale: [k * 0.15, k, outExpo], alpha: [1, 0, inQuad], tint: o.palette.main });
  w.spawn({ ...g, texture: tex.ring, life: life * 0.7, scale: [k * 0.1, k * 0.8, outExpo], scaleY: 1, alpha: [0.9, 0, inQuad], tint: o.palette.core });
}

/** Big AoE impact: flash, fireballs, sparks, smoke, shockwave, scorch decal, shake + hit-stop. */
export function explosion(
  w: VfxWorld,
  tex: VfxTextures,
  o: Vec3 & { radius?: number; palette: Palette; shake?: number; hitStopMs?: number; smoke?: boolean },
) {
  const { x, y } = o;
  const z = o.z ?? 0;
  const r = o.radius ?? 90;
  const p = o.palette;
  const s = r / 90;
  // Flash: short and smaller than the blast so the color, not white, reads.
  w.spawn({ texture: tex.glow, layer: 'top', x, y, z: z + 30 * s, life: 90, scale: [s * 1.0, s * 1.9, outQuad], alpha: [0.8, 0, outQuad], tint: p.core });
  w.spawn({ texture: tex.glow, layer: 'top', x, y, z: z + 30 * s, life: 220, scale: [s * 2.0, s * 3.2, outQuad], alpha: [0.45, 0, outQuad], tint: p.main });
  w.burst(12, () => {
    const a = rand(0, TAU);
    const sp = rand(60, 220) * s;
    return {
      texture: tex.puff, x, y, z: z + rand(5, 30) * s, life: rand(380, 650), zBias: 10, rotation: rand(0, TAU), spin: rand(-2, 2),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(60, 200) * s, drag: 3.5,
      // Additive puffs stack up fast and saturate to white: low alpha, tints from `main` down to `dark`.
      scale: [rand(0.7, 1.1) * s, rand(1.4, 2.0) * s, outCubic], alpha: envelope(0.05, 0.7, 0.4),
      tint: colorRamp(p.main, lerpColor(p.main, p.dark, 0.5), p.dark, 0.4),
    };
  });
  if (o.smoke !== false) {
    w.burst(7, () => {
      const a = rand(0, TAU);
      const sp = rand(30, 100) * s;
      return {
        // Smoke appears as the fire fades, rises, and stays thin and cool-grey so it never
        // mixes with the additive fire into brown mud.
        texture: tex.puff, x, y, z: z + rand(30, 60) * s, delay: rand(180, 320), life: rand(1000, 1500), blend: 'normal', zBias: 8,
        rotation: rand(0, TAU), spin: rand(-0.6, 0.6),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(70, 130) * s, drag: 1.2,
        scale: [0.9 * s, 2.2 * s, outCubic], alpha: envelope(0.25, 0.3, 0.3), tint: [lerpColor(p.dark, 0x4a4a52, 0.6), 0x6a6a72],
      };
    });
  }
  w.burst(18, () => {
    const a = rand(0, TAU);
    const sp = rand(250, 560) * s;
    return {
      texture: tex.streak, x, y, z: z + 15 * s, life: rand(450, 800), zBias: 11,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(150, 450) * s, gravity: 900, drag: 1.2,
      killOnGround: true, faceVelocity: true, stretch: 0.0015, scaleX: 0.25, scaleY: [0.6, 0.3], tint: [p.core, p.main],
    };
  });
  shockwave(w, tex, { x, y, radius: r * 1.4, palette: p });
  w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x, y, life: 2500, blend: 'normal', scale: r / 40, alpha: envelope(0.02, 0.6, 0.55), tint: 0x140806 });
  w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x, y, life: 900, scale: r / 45, alpha: [0.8, 0, outQuad], tint: p.main });
  w.shake(o.shake ?? 7 * s, 300);
  if (o.hitStopMs !== 0) w.hitStop(o.hitStopMs ?? 50);
}

/**
 * Soft blob shadow on the ground under something airborne. It lands where the baked sun
 * of your renders puts shadows (VfxWorld `shadow`), and fades/widens with height.
 * Lives until you kill() the returned particle.
 */
export function dropShadow(w: VfxWorld, tex: VfxTextures, target: () => Vec3, size = 1): Particle | null {
  const at = { x: 0, y: 0, z: 0 };
  return w.spawn({
    texture: tex.glow, layer: 'ground', groundAligned: true, blend: 'normal', x: 0, y: 0, life: Infinity, tint: 0x000000,
    follow: () => w.shadowPoint(target(), at),
    onUpdate: (q) => {
      const k = 1 / (1 + Math.max(0, target().z ?? 0) / 250);
      q.o.alpha = 0.4 * k;
      q.o.scale = 0.7 * size * (1.6 - 0.6 * k);
    },
  });
}

/** Homing-free projectile with an arc, glow core, ember trail and ground shadow. */
export function projectile(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: Vec3; to: Vec3; palette: Palette; speed?: number; arcHeight?: number; size?: number; onHit?: (at: Vec3) => void },
): Handle {
  const fz = o.from.z ?? 40, tz = o.to.z ?? 40;
  const dist = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
  const duration = (dist / (o.speed ?? 650)) * 1000;
  const arc = o.arcHeight ?? dist * 0.12;
  const size = o.size ?? 1;
  const p = o.palette;
  const pos = { x: o.from.x, y: o.from.y, z: fz };
  let t = 0;
  const follow = () => pos;
  const parts = [
    w.spawn({ texture: tex.glow, x: 0, y: 0, follow, life: Infinity, scale: 1.3 * size, alpha: 0.8, tint: p.main, zBias: 2 }),
    w.spawn({ texture: tex.dot, x: 0, y: 0, follow, life: Infinity, scale: 0.75 * size, tint: p.core, zBias: 3 }),
  ];
  parts.push(dropShadow(w, tex, () => pos, size));
  const trail = w.stream({
    rate: 90,
    make: () => ({
      texture: tex.dot, x: pos.x + rand(-4, 4), y: pos.y + rand(-3, 3), z: pos.z + rand(-4, 4), life: rand(250, 420),
      vz: rand(10, 50), drag: 2, scale: [rand(0.5, 0.8) * size, 0, inQuad], tint: colorRamp(p.core, p.main, p.dark, 0.25),
    }),
  });
  return w.addUpdater((dt) => {
    t = Math.min(1, t + dt / duration);
    pos.x = lerp(o.from.x, o.to.x, t);
    pos.y = lerp(o.from.y, o.to.y, t);
    pos.z = lerp(fz, tz, t) + 4 * arc * t * (1 - t);
    if (t >= 1) {
      trail.stop();
      for (const q of parts) q?.kill();
      o.onHit?.({ ...pos });
      return false;
    }
  });
}

/** Meteor: telegraph on the ground, falls from the sky, then a big explosion. */
export function meteor(w: VfxWorld, tex: VfxTextures, o: { x: number; y: number; radius?: number; palette: Palette; castMs?: number; onHit?: () => void }) {
  const r = o.radius ?? 110;
  const cast = o.castMs ?? 800;
  telegraph(w, tex, { x: o.x, y: o.y, radius: r, duration: cast, palette: o.palette });
  const fall = 380;
  w.after(cast - fall, () => {
    projectile(w, tex, {
      from: { x: o.x - 160, y: o.y - 20, z: 560 }, to: { x: o.x, y: o.y, z: 0 },
      speed: Math.hypot(160, 20) / (fall / 1000), arcHeight: 0, size: 2.2, palette: o.palette,
      onHit: () => {
        explosion(w, tex, { x: o.x, y: o.y, radius: r, palette: o.palette, shake: 12, hitStopMs: 70 });
        o.onHit?.();
      },
    });
  });
}

function jagged(a: { x: number; y: number }, b: { x: number; y: number }, depth: number, disp: number, out: { x: number; y: number }[]) {
  if (depth === 0) {
    out.push(b);
    return;
  }
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const m = { x: (a.x + b.x) / 2 + (-dy / len) * rand(-disp, disp), y: (a.y + b.y) / 2 + (dx / len) * rand(-disp, disp) };
  jagged(a, m, depth - 1, disp / 2, out);
  jagged(m, b, depth - 1, disp / 2, out);
}

/** Chain lightning through `points` (caster first). Re-rolls the bolt a few times for flicker. */
export function lightningChain(w: VfxWorld, tex: VfxTextures, o: { points: Vec3[]; palette: Palette; flickers?: number; width?: number }) {
  const p = o.palette;
  const width = o.width ?? 1;
  const flickers = o.flickers ?? 4;
  const screen = o.points.map((q) => ({ x: q.x, y: q.y - (q.z ?? 40), gy: q.y }));
  const bolt = () => {
    for (let i = 0; i < screen.length - 1; i++) {
      const a = screen[i], b = screen[i + 1];
      const pts = [a];
      jagged(a, b, 5, Math.hypot(b.x - a.x, b.y - a.y) * 0.18, pts);
      const gy = Math.max(a.gy, b.gy) + 5;
      for (let j = 0; j < pts.length - 1; j++) {
        const s = pts[j], e = pts[j + 1];
        const len = Math.hypot(e.x - s.x, e.y - s.y);
        const rot = Math.atan2(e.y - s.y, e.x - s.x);
        const seg = { texture: tex.beam, x: s.x, y: gy, z: gy - s.y, anchorX: 0, rotation: rot, scaleX: (len + 1) / M.beamLength, life: 90 } as const;
        w.spawn({ ...seg, scaleY: 1.6 * width, alpha: [0.55, 0], tint: p.main });
        w.spawn({ ...seg, scaleY: 0.4 * width, alpha: [1, 0.2], tint: p.core, zBias: 1 });
      }
    }
  };
  for (let f = 0; f < flickers; f++) w.after(f * 65, bolt);
  o.points.forEach((q, i) => {
    w.spawn({ texture: tex.glow, x: q.x, y: q.y, z: q.z ?? 40, life: flickers * 65 + 80, scale: i === 0 ? 1.2 : 1.8, alpha: (t) => (1 - t) * (0.6 + 0.4 * Math.random()), tint: p.main, zBias: 3 });
    if (i > 0) w.after(20 + i * 30, () => hitSpark(w, tex, { x: q.x, y: q.y, z: q.z ?? 40, angle: rand(0, TAU), palette: p }));
  });
  w.shake(4, 200);
}

/** Healing / buff aura around a (possibly moving) target. Returns a handle; it also ends after `duration`. */
export function healAura(w: VfxWorld, tex: VfxTextures, o: { target: () => Vec3; palette: Palette; radius?: number; duration?: number }): Handle {
  const r = o.radius ?? 46;
  const p = o.palette;
  const duration = o.duration ?? 1600;
  const kr = r / M.ringRadius;
  const ground = { layer: 'ground', groundAligned: true, x: 0, y: 0, follow: o.target } as const;
  const column = w.spawn({ texture: tex.glow, x: 0, y: 0, z: 45, follow: o.target, life: duration, zBias: 1, scaleX: 1.3 * r / 46, scaleY: 2.6, alpha: envelope(0.15, 0.4, 0.45), tint: p.main });
  const pad = w.spawn({ ...ground, texture: tex.glow, life: duration, scale: (r / 46) * 1.8, alpha: envelope(0.1, 0.4, 0.6), tint: p.main });
  const rings = w.stream({ rate: 3.5, duration, make: () => ({ ...ground, texture: tex.ring, life: 700, scale: [kr * 1.2, kr * 0.4, outQuad], alpha: [0, 0.9], tint: p.main }) });
  const motes = w.stream({
    rate: 40, duration,
    make: () => {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * r;
      const phase = rand(0, TAU);
      return {
        texture: Math.random() < 0.15 ? tex.star : tex.dot, x: Math.cos(a) * d, y: Math.sin(a) * d * w.groundSquash, z: rand(0, 20), follow: o.target,
        vz: rand(50, 110), life: rand(700, 1100), zBias: Math.sin(a) * d * w.groundSquash,
        scale: [rand(0.35, 0.6), 0], alpha: envelope(0.2, 0.5), tint: [p.core, p.main],
        onUpdate: (q, t) => { q.px = Math.sin(phase + t * 6) * 6; },
      };
    },
  });
  const all = w.after(duration, () => {});
  return {
    stop: () => { rings.stop(); motes.stop(); column?.kill(); pad?.kill(); all.stop(); },
    get alive() { return all.alive; },
  };
}
