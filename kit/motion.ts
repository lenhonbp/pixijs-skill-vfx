// Movement skills. The recipe drives a position over time and calls onMove(pos) every frame:
// move your unit there (feet + z). Gameplay (collision, i-frames) stays in your code.
import type { Sprite } from 'pixi.js';
import type { VfxWorld, Vec3, Handle, Particle } from './vfx-world';
import { VfxTextures, TEX_METRICS as M } from './textures';
import { dropShadow, shockwave, type Palette } from './recipes';
import { envelope, inOutSine, inQuad, lerp, outCubic, outQuad, rand } from './ease';

const TAU = Math.PI * 2;

/** Fading additive copy of a unit sprite at a ground position (motion ghosts). */
export function afterimage(w: VfxWorld, sprite: Sprite, at: Vec3, o: { tint?: number; life?: number; alpha?: number } = {}): Particle | null {
  return w.spawn({
    texture: sprite.texture, x: at.x, y: at.y, z: at.z ?? 0, life: o.life ?? 260, zBias: -1,
    anchorX: sprite.anchor.x, anchorY: sprite.anchor.y, scaleX: sprite.scale.x, scaleY: sprite.scale.y,
    alpha: [o.alpha ?? 0.55, 0, outQuad], tint: o.tint ?? 0xffffff,
  });
}

function dust(w: VfxWorld, tex: VfxTextures, at: Vec3, n: number, size: number, color = 0xb8ab98) {
  w.burst(n, () => {
    const a = rand(0, TAU), sp = rand(40, 130) * size;
    return {
      texture: tex.puff, blend: 'normal', x: at.x, y: at.y, z: rand(2, 10), life: rand(500, 800), zBias: -2,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(10, 50), drag: 3, rotation: rand(0, TAU), spin: rand(-1, 1),
      scale: [0.35 * size, rand(0.8, 1.1) * size, outCubic], alpha: envelope(0.1, 0.4, 0.5), tint: color,
    };
  });
}

/** Ground dash with motion ghosts, speed lines and dust. */
export function dash(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: Vec3; to: Vec3; palette: Palette; duration?: number; height?: number; sprite?: Sprite; onMove?: (p: Vec3) => void; onEnd?: () => void },
): Handle {
  const dur = o.duration ?? 220;
  const h = o.height ?? 70;
  const p = o.palette;
  const pos = { x: o.from.x, y: o.from.y, z: 0 };
  const ang = Math.atan2(o.to.y - o.from.y, o.to.x - o.from.x);
  const screenAng = Math.atan2((o.to.y - o.from.y), o.to.x - o.from.x);
  dust(w, tex, o.from, 6, 0.8);
  w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true, x: o.from.x, y: o.from.y, life: 260, scale: [0.05, 0.3, outCubic], alpha: [0.8, 0], tint: p.main });
  let t = 0, ghost = 0;
  return w.addUpdater((dt) => {
    t = Math.min(1, t + dt / dur);
    const e = outCubic(t);
    pos.x = lerp(o.from.x, o.to.x, e);
    pos.y = lerp(o.from.y, o.to.y, e);
    o.onMove?.(pos);
    ghost -= dt;
    if (ghost <= 0) {
      ghost = 24;
      if (o.sprite) afterimage(w, o.sprite, pos, { tint: p.main, life: 240 });
      w.spawn({ texture: tex.glow, x: pos.x, y: pos.y, z: h * 0.5, life: 200, zBias: -2, scaleX: 0.9, scaleY: 1.4, alpha: [0.35, 0], tint: p.main });
    }
    for (let i = 0; i < 2; i++) {
      w.spawn({
        texture: tex.streak, x: pos.x - Math.cos(ang) * rand(10, 40), y: pos.y - Math.sin(ang) * rand(4, 14), z: h * rand(0.1, 0.95), life: rand(140, 220), zBias: 2,
        rotation: screenAng, scaleX: [rand(0.6, 1.1), 0.2], scaleY: 0.35, alpha: [0.8, 0], tint: [p.core, p.main],
      });
    }
    if (t >= 1) {
      dust(w, tex, pos, 7, 0.9);
      o.onEnd?.();
      return false;
    }
  });
}

/** Teleport: implode at `from`, reappear in a light column at `to`. */
export function blink(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: Vec3; to: Vec3; palette: Palette; height?: number; gapMs?: number; onVanish?: () => void; onAppear?: () => void },
) {
  const h = o.height ?? 70;
  const p = o.palette;
  const gap = o.gapMs ?? 180;
  const column = (at: Vec3, appear: boolean) => {
    w.spawn({ texture: tex.glow, x: at.x, y: at.y, z: h * 0.6, life: 260, zBias: 4, scaleX: appear ? [0.15, 0.9, outCubic] : [0.9, 0.1, inQuad], scaleY: [3, 2.2], alpha: [0.9, 0], tint: p.main });
    w.spawn({ texture: tex.glow, x: at.x, y: at.y, z: h * 0.6, life: 180, zBias: 5, scaleX: appear ? [0.1, 0.4] : [0.4, 0.05], scaleY: 2.4, alpha: [1, 0], tint: p.core });
    w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true, x: at.x, y: at.y, life: 320, scale: appear ? [0.05, 0.45, outCubic] : [0.4, 0.02, inQuad], alpha: [0.9, 0], tint: p.main });
    w.spawn({ texture: tex.star, x: at.x, y: at.y, z: h * 0.5, life: 220, zBias: 6, rotation: rand(0, TAU), spin: 4, scale: [1.1, 0], tint: p.core });
  };
  column(o.from, false);
  w.burst(16, () => {
    const a = rand(0, TAU), r = rand(35, 55);
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
    return { texture: tex.dot, x: o.from.x + ox, y: o.from.y, z: h * 0.5 + oz, life: 160, zBias: 5, vx: (-ox / 160) * 1000, vz: (-oz / 160) * 1000, scale: [0.35, 0.1], tint: [p.main, p.core] };
  });
  // faint trail between both points
  const a = { x: o.from.x, y: o.from.y - h * 0.5 }, b = { x: o.to.x, y: o.to.y - h * 0.5 };
  const gy = Math.max(o.from.y, o.to.y);
  w.spawn({ texture: tex.beam, x: a.x, y: gy, z: gy - a.y, anchorX: 0, rotation: Math.atan2(b.y - a.y, b.x - a.x), scaleX: Math.hypot(b.x - a.x, b.y - a.y) / M.beamLength, scaleY: [0.8, 0.1], delay: 60, life: gap + 80, alpha: [0.35, 0], tint: p.main });
  w.after(80, () => o.onVanish?.());
  w.after(gap, () => {
    column(o.to, true);
    w.burst(16, () => {
      const ang = rand(0, TAU), sp = rand(120, 260);
      return { texture: tex.dot, x: o.to.x, y: o.to.y, z: h * rand(0.2, 0.8), life: rand(300, 500), zBias: 5, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * w.groundSquash, vz: rand(20, 120), drag: 4, scale: [0.35, 0], tint: [p.core, p.main] };
    });
    o.onAppear?.();
  });
}

/** Jump to `to` in an arc and slam the ground (shadow, trail, shockwave, cracks, debris). */
export function leap(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: Vec3; to: Vec3; palette: Palette; arc?: number; duration?: number; height?: number; radius?: number; onMove?: (p: Vec3) => void; onLand?: (at: Vec3) => void },
): Handle {
  const dur = o.duration ?? 620;
  const arc = o.arc ?? 150;
  const h = o.height ?? 70;
  const r = o.radius ?? 90;
  const p = o.palette;
  const pos = { x: o.from.x, y: o.from.y, z: 0 };
  dust(w, tex, o.from, 8, 1);
  const shadow = dropShadow(w, tex, () => pos, 1.1);
  const trail = w.stream({
    rate: 60,
    make: () => ({ texture: tex.dot, x: pos.x + rand(-6, 6), y: pos.y, z: pos.z + h * rand(0.3, 0.7), life: rand(220, 380), scale: [rand(0.3, 0.5), 0], tint: [p.core, p.main] }),
  });
  let t = 0;
  const mover = w.addUpdater((dt) => {
    t = Math.min(1, t + dt / dur);
    const e = inOutSine(t);
    pos.x = lerp(o.from.x, o.to.x, e);
    pos.y = lerp(o.from.y, o.to.y, e);
    pos.z = 4 * arc * t * (1 - t);
    o.onMove?.(pos);
    if (t < 1) return;
    trail.stop();
    shadow?.kill();
    pos.z = 0;
    slam(w, tex, { x: pos.x, y: pos.y, radius: r, palette: p });
    o.onLand?.({ ...pos });
    return false;
  });
  return {
    stop: () => { if (mover.alive) { mover.stop(); trail.stop(); shadow?.kill(); } },
    get alive() { return mover.alive; },
  };
}

/** Heavy ground impact: shockwave, radial cracks, dust ring, rock debris, shake + hit-stop. */
export function slam(w: VfxWorld, tex: VfxTextures, o: { x: number; y: number; radius?: number; palette: Palette; debris?: number }) {
  const r = o.radius ?? 90;
  const s = r / 90;
  const p = o.palette;
  const g = { layer: 'ground', groundAligned: true, x: o.x, y: o.y } as const;
  w.spawn({ ...g, texture: tex.glow, life: 350, scale: [s * 1.5, s * 2.6, outQuad], alpha: [0.75, 0], tint: p.main });
  w.spawn({ ...g, texture: tex.glow, blend: 'normal', life: 2200, scale: 1.6 * s, alpha: ms2(0.55), tint: 0x1a120a });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rand(-0.25, 0.25);
    const len = rand(0.6, 1) * r;
    w.spawn({ ...g, texture: tex.shard, blend: 'normal', x: o.x + Math.cos(a) * len * 0.5, y: o.y + Math.sin(a) * len * 0.5 * w.groundSquash, rotation: a, life: 2200, scaleX: len / 60, scaleY: rand(0.18, 0.28), alpha: ms2(0.8), tint: 0x1a1008 });
  }
  shockwave(w, tex, { x: o.x, y: o.y, radius: r * 1.3, palette: p });
  dust(w, tex, o, 12, 1.3 * s);
  w.burst(o.debris ?? 12, () => {
    const a = rand(0, TAU), sp = rand(120, 320) * s;
    return {
      texture: tex.rock, blend: 'normal', x: o.x, y: o.y, z: 4, life: rand(700, 1100), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(220, 480) * s,
      gravity: 1300, bounce: 0.3, drag: 0.5, rotation: rand(0, TAU), spin: rand(-10, 10), scale: rand(0.18, 0.4) * s, alpha: envelope(0, 0.8), tint: 0x8a7458,
    };
  });
  w.shake(10 * s, 320);
  w.hitStop(70);
}

function ms2(peak: number) {
  return (t: number) => (t < 0.03 ? (peak * t) / 0.03 : t > 0.6 ? (peak * (1 - t)) / 0.4 : peak);
}

