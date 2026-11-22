import type { VfxTextures } from './textures';
import type { Handle, SpawnOptions, Vec3, VfxWorld } from './vfx-world';
import type { Palette } from './recipes';
import { telegraph } from './recipes';
import { clamp01, colorRamp, envelope, inQuad, lerp, outCubic, outQuad, pick, rand } from './ease';
import { fireTextures } from './fire-textures';
import { fireDragonTextures } from './fire-dragon-textures';
import { group } from './group';
import { curlDrift } from './noise';
import { Distortion } from './postfx';

const TAU = 2 * Math.PI;
const WHITE = 0xfff5d3;
const AIR = 0x796967;
const SOOT = 0x2a262b;
const ground = { layer: 'ground', groundAligned: true } as const;

function tongue(p: Palette, size: number, life: number, phase: number) {
  const fade = envelope(0.09, 0.79, 0.83);
  return {
    texture: pick(fireTextures().flames), anchorX: 0.27, life,
    scaleX: [size * 0.58, size * 1.34, outCubic],
    scaleY: [size * 0.53, size * 1.05, outQuad],
    alpha: (t: number) => fade(t) * (0.86 + 0.14 * Math.sin(phase + t * 21)),
    tint: colorRamp(0xffffff, p.main, p.dark, 0.55),
  } satisfies Partial<SpawnOptions>;
}

function smoke(size: number, life: number, drift: number, opacity = 0.56) {
  return {
    texture: pick(fireTextures().smoke), life, blend: 'normal',
    scale: [size * 0.55, size * 1.4, outCubic],
    alpha: envelope(0.22, 0.74, opacity), tint: [AIR, SOOT],
    rotation: rand(0, TAU), spin: rand(-0.8, 0.8), onUpdate: curlDrift(drift, 66, 0.9),
  } satisfies Partial<SpawnOptions>;
}

export function fireCharge(w: VfxWorld, tex: VfxTextures, o: {
  origin: () => Vec3; palette: Palette; duration: number; size?: number; onDone?: () => void;
}): Handle {
  const p = o.palette, size = o.size ?? 1;
  const g = group(w, o.duration, o.onDone, 55);
  g.add(w.spawn({
    texture: tex.glow, x: 0, y: 0, follow: o.origin, life: o.duration, zBias: 7,
    scale: [0.18 * size, 0.82 * size, inQuad], tint: p.main,
    alpha: (t) => 0.62 + 0.18 * Math.sin(t * 24),
  }));
  g.add(w.spawn({
    texture: tex.glow, x: 0, y: 0, follow: o.origin, life: o.duration, zBias: 8,
    scale: [0.04 * size, 0.25 * size, inQuad], tint: WHITE, alpha: 0.9,
  }));
  g.addHandle(w.stream({
    rate: 48,
    make: (i) => {
      const a = rand(-Math.PI, 0), k = size * (0.4 + Math.min(1, i / (o.duration * 0.035)) * 0.6);
      return {
        ...tongue(p, k * rand(0.24, 0.42), rand(145, 260), a),
        x: rand(-7, 7) * k, y: 0, z: rand(-5, 6) * k, follow: o.origin, zBias: 9,
        vz: rand(25, 70), rotation: a, spin: rand(-2.7, 2.7), onUpdate: curlDrift(38, 37),
      };
    },
  }));
  return g;
}

function fireFlight(w: VfxWorld, tex: VfxTextures, o: {
  from: Vec3; to: Vec3; palette: Palette; duration: number; arc: number; size: number;
  rock?: boolean; onHit?: (at: Vec3) => void;
}): Handle {
  const { from, to, duration, arc, size, rock, palette: p } = o;
  const fz = from.z ?? 40, tz = to.z ?? 40, pos = { ...from, z: fz };
  const base = { x: pos.x, y: pos.y };
  let elapsed = 0;
  const direction = (t: number) => Math.atan2(to.y - from.y - (tz - fz + 4 * arc * (1 - 2 * t)), to.x - from.x);
  let angle = direction(0);
  const g = group(w, Infinity, undefined, 48);
  g.addHandle(w.addUpdater((dt) => {
    elapsed += dt;
    const t = duration > 0 ? clamp01(elapsed / duration) : 1;
    pos.x = base.x = lerp(from.x, to.x, t);
    pos.y = base.y = lerp(from.y, to.y, t);
    pos.z = lerp(fz, tz, t) + 4 * arc * t * (1 - t);
    angle = direction(t);
    if (t === 1) {
      g.stop();
      o.onHit?.({ ...pos });
    }
  }));
  g.add(w.spawn({
    ...ground, texture: tex.glow, x: 0, y: 0, follow: () => base, life: Infinity, tint: p.main, scale: size * 1.05,
    alpha: 0.45, onUpdate: (q) => { q.alphaMul = 1 / (1 + Math.max(0, pos.z) / 76); },
  }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: () => pos, life: Infinity, scale: size * (rock ? 1.12 : 0.76), alpha: 0.72, tint: p.main, zBias: 8 }));
  g.add(w.spawn({
    texture: rock ? fireTextures().meteor : tex.glow, x: 0, y: 0, follow: () => pos, life: Infinity,
    scale: (rock ? 0.66 : 0.33) * size, alpha: rock ? 1 : 0.92, tint: rock ? 0xffffff : WHITE,
    blend: rock ? 'normal' : 'add', zBias: 11,
    onUpdate: (q) => { q.rotation = angle + (rock ? elapsed * 0.0021 : 0); },
  }));
  g.addHandle(w.stream({
    rate: rock ? 74 : 66,
    make: () => {
      const a = angle + Math.PI + rand(-0.51, 0.51), speed = rand(65, 164) * size;
      const life = rand(200, 360);
      return {
        ...tongue(p, size * rand(0.46, 0.72), life, a),
        x: pos.x + rand(-9, 9) * size, y: pos.y, z: pos.z + rand(-8, 8) * size,
        vx: Math.cos(a) * speed, vz: -Math.sin(a) * speed + 30, drag: 2.8, zBias: 9,
        rotation: a, spin: rand(-2.4, 2.4), onUpdate: curlDrift(65, 52),
      };
    },
  }));
  g.addHandle(w.stream({
    rate: rock ? 34 : 17,
    make: () => ({
      ...smoke(size * rand(0.58, 0.91), rand(520, 820), 68, rock ? 0.76 : 0.51),
      x: pos.x, y: pos.y, z: pos.z, vx: rand(-37, 37), vz: rand(38, 105), drag: 0.75, zBias: 5,
    }),
  }));
  g.addHandle(w.stream({
    rate: 24,
    make: () => ({
      texture: tex.streak, x: pos.x + rand(-8, 8) * size, y: pos.y, z: pos.z + rand(-8, 8) * size,
      vx: -Math.cos(angle) * 170 + rand(-44, 44), vz: Math.sin(angle) * 160 + rand(28, 140),
      life: rand(340, 590), drag: 1.6, faceVelocity: true, scaleX: rand(0.07, 0.22), scaleY: rand(0.17, 0.41),
      alpha: [0.92, 0, inQuad], tint: colorRamp(WHITE, p.main, p.dark), zBias: 10,
    }),
  }));
  return g;
}

export function fireball(w: VfxWorld, tex: VfxTextures, o: {
  from: Vec3; to: Vec3; palette: Palette; speed?: number; size?: number; onHit?: (at: Vec3) => void;
}): Handle {
  const dist = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
  return fireFlight(w, tex, { ...o, duration: dist / (o.speed ?? 720) * 1000, arc: dist * 0.12, size: o.size ?? 1 });
}

export function fireImpact(w: VfxWorld, tex: VfxTextures, o: {
  x: number; y: number; radius: number; palette: Palette; meteor?: boolean;
}) {
  const { x, y, radius, palette: p, meteor } = o;
  const size = radius / 90;
  const decal = { ...ground, x, y };
  w.spawn({ ...decal, texture: fireTextures().scorch, blend: 'normal', life: 2400, tint: 0xffffff, scale: radius / 51, alpha: envelope(0.015, 0.48, 0.97) });
  w.spawn({ ...decal, texture: tex.glow, life: 790, scale: [radius / 47, radius / 36], alpha: [0.85, 0, outQuad], tint: p.main });
  w.spawn({ texture: tex.glow, x, y, z: 18 * size, zBias: 13, life: 135, scale: [0.6 * size, 1.6 * size, outQuad], alpha: [0.93, 0, outQuad], tint: WHITE });
  w.burst(meteor ? 23 : 17, () => {
    const a = rand(0, TAU), v = rand(60, 250) * size;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v * w.groundSquash, vz = rand(70, 270) * size;
    return {
      ...tongue(p, size * rand(0.49, 0.95), rand(320, 630), a), x, y, z: rand(2, 28) * size,
      vx, vy, vz, drag: 3.1, zBias: 12, spin: rand(-4, 4),
      rotation: Math.atan2(vy - vz, vx), onUpdate: curlDrift(86, 56),
    };
  });
  w.burst(meteor ? 14 : 9, () => {
    const a = rand(0, TAU), v = rand(28, 150) * size;
    return {
      ...smoke(size * rand(0.75, 1.4), rand(1020, 1510), 82), x, y, z: rand(15, 45) * size,
      delay: rand(100, 280), vx: Math.cos(a) * v, vy: Math.sin(a) * v * w.groundSquash,
      vz: rand(55, 125) * size, drag: 0.9, zBias: 7,
    };
  });
  w.burst(meteor ? 23 : 17, () => {
    const a = rand(0, TAU), v = rand(115, 390) * size;
    return {
      texture: tex.streak, x, y, z: rand(5, 20) * size, life: rand(410, 860), zBias: 14,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v * w.groundSquash, vz: rand(130, 415) * size,
      gravity: 490, drag: 1.5, killOnGround: true, faceVelocity: true, stretch: 0.0012,
      scaleX: rand(0.07, 0.19), scaleY: rand(0.16, 0.42), alpha: [0.95, 0, inQuad], tint: colorRamp(WHITE, p.main, p.dark),
    };
  });
  if (meteor) w.burst(12, () => {
    const a = rand(0, TAU), v = rand(90, 335) * size;
    return {
      texture: tex.rock, blend: 'normal', x, y, z: rand(2, 18) * size, life: rand(480, 970), zBias: 10,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v * w.groundSquash, vz: rand(150, 360),
      gravity: 940, bounce: 0.35, spin: rand(-7, 7), scale: rand(0.14, 0.38) * size,
      alpha: envelope(0.02, 0.35), tint: [0xce804e, 0x55434d],
    };
  });
  w.plugin(Distortion)?.shockwave(w, x, y, radius * 1.5, { duration: 560 });
  w.shake(meteor ? 12 : 7 * size, 300);
  w.hitStop(meteor ? 70 : 50);
}

export function fireMeteor(w: VfxWorld, tex: VfxTextures, o: {
  x: number; y: number; radius: number; palette: Palette; castMs: number; onHit?: () => void;
}) {
  const { x, y, radius, palette, castMs } = o;
  telegraph(w, tex, { x, y, radius, palette, duration: castMs, finishAlpha: 0 });
  const duration = Math.min(castMs, 380);
  w.after(castMs - duration, () => fireFlight(w, tex, {
    from: { x: x - 160, y: y - 20, z: 560 }, to: { x, y, z: 0 },
    duration, arc: 0, size: 1.24, palette, rock: true,
    onHit: () => { fireImpact(w, tex, { x, y, radius, palette, meteor: true }); o.onHit?.(); },
  }));
}

export function fireBreath(w: VfxWorld, tex: VfxTextures, o: {
  origin: () => Vec3; angle: () => number; palette: Palette; range: number; spread: number; duration: number;
}): Handle {
  const { range, duration, spread, palette: p } = o;
  const g = group(w, duration, undefined, 140);
  const speed = range / 0.43;
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: o.origin, life: Infinity, scale: 0.4, tint: WHITE, alpha: 0.78, zBias: 11 }));
  g.addHandle(w.stream({
    rate: 66,
    make: () => {
      const at = o.origin(), a = o.angle() + rand(-0.5, 0.5) * spread;
      const v = speed * rand(0.77, 1.19), vx = Math.cos(a) * v, vy = Math.sin(a) * v * w.groundSquash;
      const vz = rand(10, 94), s = rand(0.53, 1.19);
      return {
        ...tongue(p, s, rand(405, 565), rand(0, TAU)), ...at, z: (at.z ?? 40) + rand(-8, 8), zBias: 8,
        vx, vy, vz, drag: 0.85, rotation: Math.atan2(vy - vz, vx) + rand(-0.19, 0.19),
        spin: rand(-1.5, 1.5), onUpdate: curlDrift(96, 61),
      };
    },
  }));
  g.addHandle(w.stream({
    rate: 21,
    make: () => {
      const at = o.origin(), a = o.angle() + rand(-0.54, 0.54) * spread, d = range * rand(0.26, 0.91);
      return {
        ...smoke(rand(0.7, 1.15), rand(630, 985), 77), x: at.x + Math.cos(a) * d,
        y: at.y + Math.sin(a) * d * w.groundSquash, z: (at.z ?? 40) + rand(21, 54),
        vx: Math.cos(a) * rand(75, 170), vy: Math.sin(a) * 100 * w.groundSquash, vz: rand(58, 107), drag: 1.4, zBias: 5,
      };
    },
  }));
  g.addHandle(w.stream({
    rate: 24,
    make: () => {
      const at = o.origin(), a = o.angle() + rand(-0.55, 0.55) * spread, v = speed * rand(0.65, 1.13);
      return {
        ...at, texture: tex.streak, vx: Math.cos(a) * v, vy: Math.sin(a) * v * w.groundSquash, vz: rand(28, 175),
        drag: 1.05, life: rand(360, 660), faceVelocity: true, zBias: 10,
        scaleX: rand(0.08, 0.19), scaleY: rand(0.19, 0.35), alpha: [0.9, 0, inQuad], tint: colorRamp(WHITE, p.main, p.dark),
      };
    },
  }));
  g.addHandle(w.stream({
    rate: 15,
    make: () => {
      const at = o.origin(), a = o.angle() + rand(-0.38, 0.38) * spread, d = range * rand(0.14, 0.93);
      return {
        ...ground, texture: tex.glow, x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d * w.groundSquash,
        life: 395, scale: [0.49, 1.54], alpha: envelope(0.18, 0.68, 0.32), tint: p.main,
      };
    },
  }));
  w.plugin(Distortion)?.haze(() => {
    const at = o.origin(), a = o.angle(), d = range * 0.57;
    return { x: at.x + Math.cos(a) * d, y: at.y - (at.z ?? 0) + Math.sin(a) * d * w.groundSquash };
  }, { radius: range * 0.22, duration, rise: 26, strength: 0.68 });
  return g;
}

export function burnFlames(w: VfxWorld, target: () => Vec3, height: number, duration: number, p: Palette): Handle {
  const size = height / 70, g = group(w, duration);
  g.addHandle(w.stream({
    rate: 29,
    make: () => {
      const a = rand(-2.25, -0.9);
      return {
        ...tongue(p, rand(0.27, 0.46) * size, rand(220, 410), a), x: rand(-17, 17) * size,
        y: rand(-5, 5), z: rand(0.07, 0.6) * height, follow: target, zBias: 5,
        vx: rand(-16, 16), vz: rand(55, 130), rotation: a, spin: rand(-2, 2), onUpdate: curlDrift(53, 45),
      };
    },
  }));
  g.addHandle(w.stream({
    rate: 7,
    make: () => {
      const at = target();
      return {
        ...smoke(rand(0.31, 0.48) * size, rand(520, 790), 53, 0.55), ...at,
        z: (at.z ?? 0) + rand(0.35, 0.8) * height, vx: rand(-21, 21), vz: rand(54, 98), zBias: 4,
      };
    },
  }));
  return g;
}

/** A screen-space capsule along a visible piece of the dragon. */
export interface FireDragonContact {
  x: number;
  y: number;
  angle: number;
  halfLength: number;
  radius: number;
}

/** A sweeping fire dragon. onCross checks its visible head and coils, not the ground trail. */
export function fireDragonCrossing(w: VfxWorld, tex: VfxTextures, o: {
  from: Vec3; toward: Vec3; palette: Palette; facing?: number; onCross?: (contact: FireDragonContact) => void;
}): Handle {
  const { from, toward, palette: p } = o;
  const dx = toward.x - from.x, dy = (toward.y - from.y) / w.groundSquash;
  const aimDistance = Math.hypot(dx, dy);
  const angle = aimDistance > 1 ? Math.atan2(dy, dx) : o.facing === -1 ? Math.PI : 0;
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const wave = Math.max(190, aimDistance);
  const reach = Math.max(wave + 155, 380);
  const speed = reach / 1.13;
  const amplitude = Math.min(84, wave * 0.21);
  const point = (s: number) => {
    const oscillation = Math.sin(s / wave * TAU);
    const side = amplitude * oscillation;
    return {
      x: from.x + ux * s - uy * side,
      y: from.y + (uy * s + ux * side) * w.groundSquash,
      z: lerp(from.z ?? 54, 44, clamp01(s / 180)) - oscillation * 21 * clamp01(s / 82),
    };
  };
  const { head, coil } = fireDragonTextures();
  const g = group(w, Infinity, undefined, 65);
  let distance = 0, crossAt = 0, trailAt = 20;
  const pieces = Array.from({ length: 20 }, (_, i) => {
    const at = point(0);
    const size = i === 0 ? 0.66 : 0.68 * (1 - (i / 20) ** 1.42 * 0.81);
    const part = g.add(w.spawn({
      x: 0, y: 0, follow: () => at, texture: i === 0 ? head : coil, anchorX: i === 0 ? 0.59 : 0.5,
      anchorY: i === 0 ? 0.58 : 0.63, life: Infinity, scale: size, alpha: 0, blend: 'normal',
      zBias: 10 + (20 - i) * 0.5,
    }));
    return { at, part, size, delay: i * 14, isHead: i === 0 };
  });
  const pose = (s: number, { size, delay }: typeof pieces[number]) => {
    const at = point(Math.max(0, s)), next = point(Math.max(0, s) + 1);
    return {
      at, angle: Math.atan2(next.y - at.y - (next.z - at.z), next.x - at.x),
      flip: next.x < at.x, scale: size * (0.95 + 0.05 * Math.sin(s / 19 + delay)),
      alpha: clamp01(s / 57) * (1 - clamp01((s - reach) / 74)),
    };
  };
  const contact = ({ at, angle, scale, alpha }: ReturnType<typeof pose>, head: boolean) => {
    if (!o.onCross || alpha < 0.3) return;
    const offset = head ? 16 * scale : 0;
    o.onCross({
      x: at.x + Math.cos(angle) * offset,
      y: at.y - at.z + Math.sin(angle) * offset,
      angle, halfLength: scale * (head ? 36 : 23), radius: scale * (head ? 24 : 19),
    });
  };
  g.addHandle(w.addUpdater((dt) => {
    distance += speed * dt / 1000;
    const front = Math.min(reach, distance);
    while (o.onCross && crossAt < Math.min(distance, reach + 74)) {
      contact(pose(crossAt, pieces[0]), true);
      crossAt += 11;
    }
    while (trailAt <= front) {
      const at = point(trailAt), next = point(trailAt + 1);
      const rotation = Math.atan2((next.y - at.y) / w.groundSquash, next.x - at.x);
      const decal = { ...ground, x: at.x, y: at.y, rotation };
      w.spawn({
        ...decal, texture: fireTextures().scorch, life: 1760, blend: 'normal',
        scaleX: 0.82, scaleY: 0.48, alpha: envelope(0.05, 0.52, 0.78),
      });
      w.spawn({
        ...decal, texture: tex.glow, life: 720, tint: p.main,
        scaleX: 0.94, scaleY: 0.71, alpha: envelope(0.08, 0.73, 0.57),
      });
      trailAt += 31;
    }
    for (const piece of pieces) {
      const { at, part, delay, isHead } = piece;
      if (!part && !o.onCross) continue;
      const current = pose(distance - delay, piece);
      if (part) {
        Object.assign(at, current.at);
        part.rotation = current.angle;
        part.o.scaleY = current.flip ? -1 : 1;
        part.o.scale = current.scale;
        part.o.alpha = current.alpha;
      }
      contact(current, isHead);
    }
    if (distance >= reach + pieces[pieces.length - 1].delay + 74) g.stop();
  }));
  g.addHandle(w.stream({
    rate: 39,
    make: (i) => {
      const s = distance - rand(24, 192);
      if (s < 0 || s > reach) return null;
      const at = point(s), tail = point(s - 1);
      const a = Math.atan2(tail.y - at.y - (tail.z - at.z), tail.x - at.x) + rand(-0.62, 0.62);
      if (i % 4 === 0) return {
        ...smoke(rand(0.54, 0.88), rand(620, 940), 54), ...at, z: at.z + rand(2, 14),
        vx: rand(-24, 24), vz: rand(58, 107), zBias: 4,
      };
      if (i % 3 === 0) return {
        ...tongue(p, rand(0.31, 0.58), rand(240, 440), a), ...at, z: at.z + rand(-7, 13),
        vx: Math.cos(a) * 85, vz: rand(40, 112), drag: 2, rotation: a, spin: rand(-2.4, 2.4), zBias: 27,
        onUpdate: curlDrift(73, 53),
      };
      return {
        ...at, texture: tex.streak, life: rand(460, 740), z: at.z + rand(-12, 18), zBias: 22,
        vx: Math.cos(a) * rand(42, 125), vz: rand(44, 138), drag: 1.25, faceVelocity: true,
        scaleX: rand(0.08, 0.21), scaleY: rand(0.19, 0.36), alpha: [0.92, 0, inQuad], tint: colorRamp(WHITE, p.main, p.dark),
      };
    },
  }));
  return g;
}
