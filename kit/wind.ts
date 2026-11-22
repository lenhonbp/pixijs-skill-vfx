// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Wind reads through motion: open wisps, swept-up debris and their depth around a target.
import type { Sprite } from 'pixi.js';
import { clamp01, envelope, lerp, lerpColor, outCubic, outQuad, rand } from './ease';
import { afterimage } from './motion';
import { Distortion } from './postfx';
import type { Palette } from './recipes';
import type { VfxTextures } from './textures';
import { flowRibbon, ribbonTrail } from './trail';
import type { Handle, Vec3, VfxWorld } from './vfx-world';

const TAU = Math.PI * 2;
const DUST = 0xb5a696;

function radial(out: Vec3, c: Vec3, squash: number, a: number, r: number, z: number) {
  out.x = c.x + Math.cos(a) * r;
  out.y = c.y + Math.sin(a) * r * squash;
  out.z = (c.z ?? 0) + z;
}

export interface TornadoOptions {
  at: Vec3;
  /** Optional ground point to travel to over the duration. */
  to?: Vec3;
  palette: Palette;
  /** Funnel height and top radius in screen px. */
  height?: number;
  radius?: number;
  duration?: number;
  /** Carry leaves (tex.leaf) instead of rock debris. */
  leaves?: boolean;
  /** Called every ~`tickMs` with the funnel's current ground position (pull, damage ticks). */
  onTick?: (at: Vec3) => void;
  tickMs?: number;
}

export interface TornadoHandle extends Handle {
  /** Current ground position of the funnel. */
  readonly pos: Vec3;
}

/** A travelling, sheared funnel: air bands turn around a dusty neck and lift debris from the floor. */
export function tornado(w: VfxWorld, tex: VfxTextures, o: TornadoOptions): TornadoHandle {
  const H = o.height ?? 190;
  const R = o.radius ?? 54;
  const dur = Math.max(1, o.duration ?? 2400);
  const pal = o.palette;
  const pos = { x: o.at.x, y: o.at.y, z: 0 };
  const from = { ...pos };
  const to = o.to ?? from;
  const direction = Math.sign(to.x - from.x) || 1;
  let age = 0;
  let tickLeft = 0;
  const env = () => outCubic(clamp01(age / 340)) * clamp01((dur - age) / 460);
  const radiusAt = (h: number) => R * (0.16 + 0.84 * Math.pow(h, 1.30));
  const leanAt = (h: number) => R * h * h * (direction * 0.45 + Math.sin(age / 300 + h * 3) * 0.44);
  const update = w.addUpdater((dt) => {
    age = Math.min(dur, age + dt);
    const t = outQuad(age / dur);
    pos.x = lerp(from.x, to.x, t) + Math.sin(age / 210) * 6;
    pos.y = lerp(from.y, to.y, t) + Math.sin(age / 260) * 4;
    if (o.onTick && (tickLeft -= dt) <= 0) {
      tickLeft += Math.max(dt, o.tickMs ?? 250);
      o.onTick({ ...pos });
    }
    if (age >= dur) return false;
  });

  const count = Math.max(14, Math.round(36 * w.density));
  const bands = Array.from({ length: count }, (_, i) => {
    const h0 = (i + 0.5) / count;
    const phase = i * 2.4;
    const span = rand(1.6, 2.75);
    const r0 = rand(0.86, 1.16);
    const fog = i % 2 === 0;
    const opacity = fog ? rand(0.65, 0.88) : rand(0.64, 0.96);
    const angle = () => phase + age * 0.010 / (0.62 + h0 * 0.58);
    return flowRibbon(w, {
      life: dur, width: (fog ? rand(28, 45) : rand(5, 11)) * (0.68 + h0 * 0.62),
      tint: fog ? lerpColor(pal.core, pal.dark, 0.50) : lerpColor(pal.main, pal.core, i % 3 === 0 ? 0.8 : 0.42),
      blend: fog ? 'normal' : 'add',
      alpha: () => env() * opacity * (0.64 + Math.sin(angle() - span / 2) * 0.24),
      point: (u, _, out) => {
        const a = angle() - span * (1 - u);
        const h = clamp01(h0 + (u - 0.5) * 0.13 + Math.sin(a * 1.4 + h0 * 7) * 0.023);
        const r = radiusAt(h) * r0 * (0.63 + env() * 0.37);
        radial(out, pos, w.groundSquash, a, r, h * H * (0.81 + 0.19 * env()));
        out.x += leanAt(h);
      },
    });
  });
  const follow = () => pos;
  const skirt = vortex(w, tex, { at: follow, radius: R * 1.5, palette: pal, duration: dur });
  const mist = w.stream({
    rate: 34, duration: Math.max(0, dur - 360), make: () => {
      const h0 = rand(0.06, 0.77), phase = rand(0, TAU), orbit = rand(0.35, 0.88);
      return {
        texture: tex.puff, x: 0, y: 0, follow, life: rand(460, 780), blend: 'normal',
        scaleX: [0.21 + h0 * 0.29, 0.35 + h0 * 0.48], scaleY: rand(0.15, 0.28),
        tint: lerpColor(DUST, pal.core, rand(0.42, 0.65)), alpha: envelope(0.22, 0.56, 0.49),
        onUpdate: (p, t) => {
          const h = h0 + t * 0.19;
          const a = phase + t * 5.6, r = radiusAt(h) * orbit;
          p.px = leanAt(h) + Math.cos(a) * r;
          p.py = Math.sin(a) * r * w.groundSquash;
          p.pz = h * H;
          p.rotation = -Math.cos(a) * 0.35;
          p.alphaMul = env();
        },
      };
    },
  });
  const debris = w.stream({
    rate: 18, duration: Math.max(0, dur - 420), make: () => {
      const phase = rand(0, TAU), rise = rand(0.58, 1.04), r0 = rand(0.85, 1.6);
      const life = rand(560, 1050);
      return {
        texture: o.leaves ? tex.leaf : tex.rock, x: 0, y: 0, follow, life, blend: 'normal',
        scale: o.leaves ? rand(0.26, 0.56) : rand(0.13, 0.24), spin: rand(-10, 10),
        tint: o.leaves ? lerpColor(0xbbae79, pal.main, 0.18) : DUST,
        alpha: envelope(0.10, 0.50, 0.82),
        onUpdate: (p, t) => {
          const h = rise * t, a = phase + 10 * (t - t * t * 0.21);
          const r = radiusAt(h) * r0;
          p.px = Math.cos(a) * r + leanAt(h);
          p.py = Math.sin(a) * r * w.groundSquash;
          p.pz = h * H;
          p.alphaMul = env();
        },
      };
    },
  });
  const dust = w.stream({
    rate: 32, duration: Math.max(0, dur - 300), make: () => {
      // Ejected dust stays in world space, so the funnel leaves a wake instead of dragging a decal.
      const a = rand(0, TAU);
      const r = rand(R * 0.25, R * 0.90);
      const speed = rand(70, 140);
      return {
        texture: tex.puff, x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r * w.groundSquash,
        z: rand(1, 9), life: rand(420, 730), blend: 'normal',
        vx: Math.cos(a + 0.9) * speed, vy: Math.sin(a + 0.9) * speed * w.groundSquash,
        vz: rand(6, 24), drag: 2.3, scale: [0.25, 0.80, outQuad], tint: DUST,
        alpha: envelope(0.16, 0.75, 0.53 * env()), spin: rand(-2, 2),
      };
    },
  });
  w.plugin(Distortion)?.haze(() => ({ x: pos.x, y: pos.y - H * 0.24 }), {
    radius: R, duration: dur, rise: H * 0.51, strength: 0.26,
  });

  return {
    pos,
    stop() {
      update.stop();
      skirt.stop();
      debris.stop();
      mist.stop();
      dust.stop();
      for (const band of bands) band.stop();
      age = dur;
    },
    get alive() { return update.alive; },
  };
}

/** An airfoil that banks along its flight path; the wake splits into two thin ribbons. */
export function windSlash(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: Vec3; to: Vec3; palette: Palette; size?: number; speed?: number; onHit?: (at: Vec3) => void },
): Handle {
  const pal = o.palette, size = o.size ?? 1;
  const squash = w.groundSquash;
  const z0 = o.from.z ?? 40, z1 = o.to.z ?? 40;
  const dx = o.to.x - o.from.x, dy = o.to.y - o.from.y;
  const dur = Math.max(1, Math.hypot(dx, dy / squash) / (o.speed ?? 950) * 1000);
  const angle = Math.atan2(dy / squash, dx);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pos = { x: o.from.x, y: o.from.y, z: z0 };
  let age = 0;
  const edge = (u: number, offset: number, out: Vec3) => {
    const bank = -(Math.sign(cos) || 1) * (0.35 + Math.sin(age / dur * Math.PI * 1.7) * 0.28);
    const wing = u * 47 * size;
    const bow = (Math.pow(Math.max(0, 1 - u * u), 0.8) * 27 - offset - 27) * size;
    out.x = pos.x + cos * bow - sin * wing * Math.cos(bank);
    out.y = pos.y + (sin * bow + cos * wing * Math.cos(bank)) * squash;
    out.z = pos.z + wing * Math.sin(bank) + Math.sin(u * Math.PI) * 5 * size;
  };
  const wake = [
    { side: -0.68, width: 8, tint: pal.main, alpha: 0.65 },
    { side: 0.62, width: 5, tint: pal.core, alpha: 0.48 },
  ];
  const tails: Handle[] = [];
  const blades: Handle[] = [];
  const wakePoints = wake.map(() => ({ ...pos }));
  const release = () => {
    for (const tail of tails) tail.stop();
    for (const blade of blades) blade.stop();
  };
  const update = w.addUpdater((dt) => {
    age += dt;
    const t = clamp01(age / dur);
    pos.x = o.from.x + dx * t;
    pos.y = o.from.y + dy * t;
    pos.z = lerp(z0, z1, t) + Math.sin(t * Math.PI) * 10;
    wake.forEach(({ side }, i) => edge(side, 11, wakePoints[i]));
    if (t >= 1) {
      release();
      gustLines(w, tex, { ...pos, angle, palette: pal, count: 9, spread: 18 });
      o.onHit?.({ ...pos });
      return false;
    }
  });
  for (const { offset, from, to, width, tint, alpha } of [
    { offset: 10, from: -1, to: 1, width: 26, tint: pal.main, alpha: 0.48 },
    { offset: 0, from: -1, to: 0.54, width: 11, tint: pal.core, alpha: 0.99 },
    { offset: 6, from: 0.96, to: -0.30, width: 8, tint: pal.main, alpha: 0.88 },
    { offset: 22, from: 0.76, to: -0.55, width: 5, tint: pal.core, alpha: 0.67 },
  ]) {
    blades.push(flowRibbon(w, {
      width: width * size, tint, life: dur, alpha: (ms) => alpha * clamp01(ms / 55),
      point: (u, _, out) => edge(lerp(from, to, u), offset, out),
    }));
  }
  wake.forEach(({ side, width, tint, alpha }, i) => {
    edge(side, 11, wakePoints[i]);
    tails.push(ribbonTrail(w, {
      target: () => wakePoints[i], width: width * size, segments: 11, tint, alpha, fadeMs: 210,
    }));
  });
  return {
    stop() { update.stop(); release(); },
    get alive() { return update.alive; },
  };
}

/** A fast, deep arc that spills outward rather than leaving a closed slash ring. */
export function windSweep(
  w: VfxWorld,
  o: { target: () => Vec3; angle: number; radius: number; height?: number; palette: Palette; duration?: number },
): Handle {
  const dur = Math.max(1, o.duration ?? 410);
  const height = o.height ?? 38;
  const strokes = Array.from({ length: 5 }, (_, i) => {
    const delay = i * Math.min(14, dur * 0.065);
    const fade = envelope(0.20, 0.62, i === 0 ? 0.95 : i <= 2 ? 0.72 : 0.40);
    const span = [2.2, 1.9, 1.5, 1.6, 1.15][i];
    return flowRibbon(w, {
      life: dur, width: [16, 9, 8, 28, 9][i], tint: i === 0 || i === 4 ? o.palette.core : o.palette.main,
      alpha: (ms) => fade(clamp01((ms - delay) / (dur - delay))),
      point: (u, ms, out) => {
        const t = clamp01((ms - delay) / (dur - delay));
        const a = o.angle + outQuad(t) * TAU - (1 - u) * span - i * 0.66;
        const r = o.radius * (0.43 + 0.56 * outCubic(t) + (u - 0.5) * 0.18 - i * 0.035);
        radial(out, o.target(), w.groundSquash, a, r, height + (u - 0.55) * 24 - i * 6 + Math.sin(t * Math.PI) * 12);
      },
    });
  });
  return {
    stop() { for (const stroke of strokes) stroke.stop(); },
    get alive() { return strokes[0].alive; },
  };
}

/** Ground eddies follow the centre, while small dust puffs break loose and drift away. */
export function vortex(
  w: VfxWorld,
  tex: VfxTextures,
  o: { at: Vec3 | (() => Vec3); radius?: number; palette: Palette; duration?: number; inward?: boolean },
): Handle {
  const R = o.radius ?? 110;
  const dur = Math.max(1, o.duration ?? 1600);
  const at = typeof o.at === 'function' ? o.at : () => o.at as Vec3;
  const dir = o.inward === false ? -1 : 1;
  const fade = envelope(0.14, 0.40);
  const eddies = Array.from({ length: 6 }, (_, i) => {
    const phase = i * 2.4;
    const base = 0.40 + i * 0.086;
    return flowRibbon(w, {
      layer: 'ground', life: dur, width: i % 3 === 0 ? 16 : 7,
      tint: i % 3 === 0 ? DUST : lerpColor(o.palette.main, o.palette.core, 0.24),
      blend: i % 3 === 0 ? 'normal' : 'add',
      alpha: (ms) => fade(ms / dur) * (0.28 + 0.13 * Math.sin(ms / 110 + phase)),
      point: (u, ms, out) => {
        const a = phase + dir * (ms * 0.007 - (1 - u) * (0.9 + i * 0.12));
        const r = R * base * (1 + dir * ((1 - u) * 0.44 - ms / dur * 0.47));
        radial(out, at(), w.groundSquash, a, r, 0);
      },
    });
  });
  const dust = w.stream({
    rate: 18, duration: Math.max(0, dur - 250), make: () => {
      const c = at(), a = rand(0, TAU), r = rand(R * 0.30, R * 0.66), k = rand(46, 110);
      const heading = a + dir * 1.9;
      return {
        texture: tex.puff, x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * w.groundSquash,
        z: rand(1, 4), life: rand(300, 560), blend: 'normal',
        vx: Math.cos(heading) * k, vy: Math.sin(heading) * k * w.groundSquash, vz: rand(3, 18), drag: 2.8,
        scale: [0.12, 0.44, outQuad], tint: DUST, alpha: envelope(0.18, 0.66, 0.33),
      };
    },
  });
  return {
    stop() { dust.stop(); for (const eddy of eddies) eddy.stop(); },
    get alive() { return eddies[0].alive; },
  };
}

/** Looser wisps circle the unit without snapping from head to feet at the end of an orbit. */
export function windWisps(
  w: VfxWorld,
  tex: VfxTextures,
  o: { target: () => Vec3; height?: number; radius?: number; palette: Palette; duration?: number; facing?: number },
): Handle {
  const H = o.height ?? 80, R = o.radius ?? 34, dur = Math.max(1, o.duration ?? 2400);
  const facing = o.facing ?? 0;
  const fade = envelope(0.16, 0.32);
  const wisps = Array.from({ length: 6 }, (_, i) => {
    const phase = i * TAU / 6;
    return flowRibbon(w, {
      life: dur, width: i % 3 === 0 ? 16 : 8,
      tint: i % 3 === 0 ? o.palette.main : lerpColor(o.palette.main, o.palette.core, 0.58),
      alpha: (ms) => fade(ms / dur) * (0.57 + Math.sin(ms / 190 + phase) * 0.20),
      point: (u, ms, out) => {
        const a = phase + ms * 0.0074 - (1 - u) * 1.8;
        const h = H * ((0.22 + i * 0.10) + 0.064 * Math.sin(ms / 190 + a) + (u - 0.5) * 0.19);
        const r = R * (0.88 + i * 0.055 + (1 - u) * 0.28);
        radial(out, o.target(), w.groundSquash, a, r, h);
        out.x -= facing * (1 - u) * R * (0.75 + i * 0.14);
      },
    });
  });
  const loose = w.stream({
    rate: 18, duration: Math.max(0, dur - 360), make: () => {
      const c = o.target(), a = rand(0, TAU);
      return {
        texture: tex.streak, x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R * w.groundSquash,
        z: (c.z ?? 0) + rand(0.12, 0.70) * H, life: rand(160, 360), drag: 2.5,
        vx: -Math.sin(a) * 75 - facing * rand(85, 175), vy: Math.cos(a) * 48,
        vz: rand(16, 55), faceVelocity: true, scaleX: [0.28, 0.09], scaleY: 0.26,
        tint: o.palette.main, alpha: envelope(0.16, 0.67, 0.45),
      };
    },
  });
  return {
    stop() { loose.stop(); for (const wisp of wisps) wisp.stop(); },
    get alive() { return wisps[0].alive; },
  };
}

/** Directional speed lines loosen and fan out as they lose momentum. */
export function gustLines(w: VfxWorld, tex: VfxTextures, o: Vec3 & { angle: number; palette: Palette; count?: number; spread?: number }) {
  const sp = o.spread ?? 40;
  w.burst(o.count ?? 8, () => {
    const a = o.angle + rand(-0.34, 0.34);
    const speed = rand(280, 590);
    return {
      texture: tex.streak, x: o.x + rand(-sp, sp), y: o.y + rand(-sp, sp) * w.groundSquash,
      z: (o.z ?? 30) + rand(-sp, sp) * 0.56,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * w.groundSquash, vz: rand(-22, 38), drag: 3.5,
      life: rand(160, 330), faceVelocity: true,
      scaleX: [rand(0.42, 0.84), 0.12, outQuad], scaleY: rand(0.16, 0.30),
      alpha: envelope(0.10, 0.76, 0.83), tint: lerpColor(o.palette.main, o.palette.core, rand(0, 0.70)),
    };
  });
}

/** A short, directional pressure front: curved air sheets above a separate layer of blown dust. */
export function windPressure(w: VfxWorld, tex: VfxTextures, o: {
  at: Vec3; angle: number; palette: Palette; radius?: number; spread?: number; duration?: number; inward?: boolean;
}): void {
  const R = o.radius ?? 88, dur = Math.max(1, o.duration ?? 360), span = o.spread ?? Math.PI * 0.84;
  const { angle, palette, inward } = o, at = { ...o.at };
  const sq = w.groundSquash;
  for (let i = 0; i < 5; i++) {
    const onFloor = i === 4;
    const delay = dur * i * 0.038;
    const fade = envelope(0.13, inward ? 0.17 : 0.75, [1, 0.80, 0.72, 0.58, 0.78][i]);
    flowRibbon(w, {
      layer: onFloor ? 'ground' : 'body', blend: i === 2 || onFloor ? 'normal' : 'add',
      life: dur, width: [13, 8, 34, 6, 23][i],
      tint: [palette.core, palette.main, lerpColor(palette.dark, palette.core, 0.60), palette.core, DUST][i],
      alpha: (ms) => fade(clamp01((ms - delay) / (dur - delay))),
      point: (u, ms, out) => {
        const t = clamp01((ms - delay) / (dur - delay));
        const fan = (u - 0.5) * span * (1 - i * 0.10);
        const a = angle + fan + (i % 3 - 1) * span * 0.13 + t * 0.25;
        const p = inward ? (1 - t) ** 1.6 : outCubic(t);
        const r = R * (0.06 + p * (1 - i * 0.09) * (1 - Math.abs(u - 0.5) * 0.40));
        radial(out, at, sq, a, r, onFloor ? -(at.z ?? 0) + 3 : (i - 1.7) * R * 0.075 + Math.sin(u * Math.PI) * 8);
      },
    });
  }
  w.burst(13, () => {
    const a = angle + rand(-span * 0.52, span * 0.52), r = R * rand(0.42, 0.88);
    const travel = inward ? -1 : 1, life = dur * rand(0.67, 1.1);
    const vx = Math.cos(a) * r, vy = Math.sin(a) * r * sq;
    return {
      texture: tex.puff, blend: 'normal', x: at.x + (inward ? vx : vx * 0.18), y: at.y + (inward ? vy : vy * 0.18),
      z: rand(2, 12), life, vx: vx * travel * 1000 / life, vy: vy * travel * 1000 / life, vz: rand(9, 25),
      scale: inward ? [0.5, 0.18] : [0.22, 0.73, outQuad],
      alpha: envelope(0.13, 0.66, 0.62), tint: DUST, rotation: a, spin: travel,
    };
  });
}

/** A quick ground step with an ankle wake and a longer shoulder slipstream. The caller moves the unit. */
export function windRush(w: VfxWorld, tex: VfxTextures, o: {
  from: Vec3; to: Vec3; palette: Palette; duration?: number; height?: number;
  sprite?: Sprite; onMove: (p: Vec3) => void; onEnd?: () => void;
}): Handle {
  const dur = Math.max(1, o.duration ?? 260), H = o.height ?? 80;
  const from = { ...o.from }, to = { ...o.to }, pos = { ...from, z: from.z ?? 0 };
  const angle = Math.atan2((to.y - from.y) / w.groundSquash, to.x - from.x);
  const sign = Math.sign(to.x - from.x) || 1;
  const points = [{ ...pos, z: (pos.z ?? 0) + 8 }, { ...pos, z: (pos.z ?? 0) + H * 0.62 }];
  let age = 0, nextTrail = 0;
  const update = w.addUpdater((dt) => {
    age += dt;
    const t = clamp01(age / dur), e = outCubic(t);
    pos.x = lerp(from.x, to.x, e);
    pos.y = lerp(from.y, to.y, e);
    pos.z = t === 1 ? (to.z ?? 0) : lerp(from.z ?? 0, to.z ?? 0, e) + Math.sin(t * Math.PI) * 9;
    o.onMove(pos);
    Object.assign(points[0], { x: pos.x - sign * 8, y: pos.y + 6, z: pos.z + 8 });
    Object.assign(points[1], { x: pos.x - sign * 23, y: pos.y - 6, z: pos.z + H * (0.55 + 0.14 * Math.sin(t * Math.PI)) });
    if (age >= nextTrail && t < 0.78) {
      nextTrail = age + 45;
      if (o.sprite) afterimage(w, o.sprite, pos, { tint: o.palette.main, life: 220, alpha: 0.48 });
      gustLines(w, tex, { ...pos, z: pos.z + H * 0.36, angle: angle + Math.PI, palette: o.palette, count: 3, spread: 19 });
    }
    if (t >= 1) {
      wake.forEach((h) => h.stop());
      o.onEnd?.();
      return false;
    }
  });
  const wake = points.map((p, i) => ribbonTrail(w, {
    target: () => p, width: i ? 17 : 10, tint: i ? o.palette.core : o.palette.main,
    alpha: i ? 0.91 : 0.73, segments: 16, fadeMs: 230,
  }));
  windPressure(w, tex, { at: from, angle: angle + Math.PI, palette: o.palette, radius: 62, duration: 410 });
  return {
    stop() { update.stop(); wake.forEach((h) => h.stop()); },
    get alive() { return update.alive; },
  };
}
