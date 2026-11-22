// Buffs, debuffs and crowd control that sit on a unit. Every effect takes `target`, a function
// returning the unit's FEET (ground x, y, z = 0 unless airborne), and `height`, the unit's
// on-screen height in px (feet to top of head), so it fits any sprite size.
import type { VfxWorld, Vec3, Handle, SpawnOptions } from './vfx-world';
import { VfxTextures, TEX_METRICS as M } from './textures';
import type { Palette } from './recipes';
import { damageNumber } from './numbers';
import { group, ms } from './group';
import { WUXING, LOI } from './elements';
import { lightningBolt } from './lightning-bolt';
import { vineBind, type VineBindHandle } from './vine-bind';
import { burnFlames } from './fire';
import { clingingSpores } from './wood';
import { floorRing, type FloorRingOptions } from './floor-ring';
import { clamp01, envelope, inQuad, outBack, outCubic, outQuad, rand, lerpColor } from './ease';

const TAU = Math.PI * 2;

export interface OnUnit {
  /** Feet of the unit (follows it while it moves). */
  target: () => Vec3;
  /** Unit height in screen px. Default 70. */
  height?: number;
}

export type SustainedStatusOptions = OnUnit & { duration?: number; palette?: Palette };

function sustained(w: VfxWorld, o: SustainedStatusOptions, duration: number) {
  const h = o.height ?? 70, s = h / 70, dur = o.duration ?? duration;
  const g = group(w, dur, undefined, 180);
  const attach = (spawn: Omit<SpawnOptions, 'x' | 'y' | 'life'> & { x?: number; y?: number }) =>
    g.add(w.spawn({ ...spawn, x: spawn.x ?? 0, y: spawn.y ?? 0, follow: o.target, life: Infinity,
      onUpdate: (q, t, dt) => { spawn.onUpdate?.(q, t, dt); q.sprite.alpha *= clamp01(q.age / 140); },
    }));
  const floor = (tex: VfxTextures, spawn: FloorRingOptions) => {
    const ring = floorRing(w, tex, { ...spawn, around: o.target, duration: Infinity,
      onUpdate: (q, t, dt) => { spawn.onUpdate?.(q, t, dt); q.sprite.alpha *= clamp01(q.age / 140); } });
    g.add(ring.far); g.add(ring.near);
    return ring;
  };
  return { g, h, s, dur, attach, floor };
}

/** Crossed sealing rune above the head, enclosed by an orbiting chain of links. */
export function silence(w: VfxWorld, tex: VfxTextures, o: SustainedStatusOptions): Handle {
  const { g, h, s, attach } = sustained(w, o, 2200);
  const p = o.palette ?? { core: 0xeadbff, main: 0xa77de8, dark: 0x40225e };
  attach({ texture: tex.glow, z: h + 22 * s, scale: 0.65 * s, alpha: 0.22, tint: p.main, zBias: 9 });
  attach({ texture: tex.rune, z: h + 22 * s, scale: 0.085 * s, alpha: 0.8, tint: p.main, spin: 0.7, zBias: 10 });
  for (const angle of [-Math.PI / 4, Math.PI / 4]) attach({ texture: tex.beam, z: h + 22 * s,
    rotation: angle, scaleX: 0.55 * s, scaleY: 0.17 * s, alpha: 0.8, tint: p.main, zBias: 11 });
  for (let i = 0; i < 6; i++) attach({ texture: tex.ring, z: h + 22 * s,
    scaleX: 0.033 * s, scaleY: 0.021 * s, alpha: 0.7, tint: p.main, zBias: 9,
    onUpdate: (q) => { const a = i * TAU / 6 + q.age * 0.0015; q.px = Math.cos(a) * 27 * s; q.pz = Math.sin(a) * 16 * s; q.rotation = a; },
  });
  return g;
}

/** Normal-blended mist obscures the eyes rather than adding light over them. */
export function blind(w: VfxWorld, tex: VfxTextures, o: SustainedStatusOptions): Handle {
  const { g, h, s, dur, attach } = sustained(w, o, 2200);
  const p = o.palette ?? { core: 0x665278, main: 0x302439, dark: 0x0c0716 };
  attach({ texture: tex.puff, blend: 'normal', z: h * 0.85, scaleX: 0.55 * s, scaleY: 0.19 * s,
    alpha: 0.96, tint: p.dark, zBias: 15 });
  g.addHandle(w.stream({ rate: 12, duration: dur, make: () => ({ texture: tex.puff, blend: 'normal',
    x: rand(-19, 19) * s, y: 0, z: h * rand(0.76, 0.96), follow: o.target, life: 1100,
    vx: rand(-7, 7) * s, vz: rand(2, 8) * s, scale: [0.1 * s, 0.2 * s],
    alpha: envelope(0.15, 0.5, 0.65), tint: p.main, zBias: 14,
  }) }));
  return g;
}

/** Broken shield silhouette, with fragments falling from the crack. */
export function armorBreak(w: VfxWorld, tex: VfxTextures, o: SustainedStatusOptions): Handle {
  const { g, h, s, dur, attach } = sustained(w, o, 2500);
  const p = o.palette ?? { core: 0xffb18a, main: 0xc45b46, dark: 0x54251d };
  attach({ texture: tex.crackedShield, blend: 'normal', z: h + 25 * s, scale: 0.5 * s, alpha: 0.95,
    tint: p.main, zBias: 12, onUpdate: (q) => { q.pz = Math.sin(q.age * 0.004) * 2 * s; } });
  attach({ texture: tex.glow, z: h * 0.5, scaleX: 0.45 * s, scaleY: 0.75 * s, alpha: 0.1, tint: p.main });
  g.addHandle(w.stream({ rate: 6, duration: dur, make: () => ({ texture: tex.shard, blend: 'normal',
    x: rand(-11, 11) * s, y: 0, z: h + 14 * s, follow: o.target, life: 700,
    vx: rand(-15, 15) * s, vz: -20 * s, gravity: 180 * s, spin: rand(-4, 4), rotation: rand(0, TAU),
    scale: [0.16 * s, 0.06 * s], alpha: [0.8, 0], tint: [p.main, p.dark], zBias: 13,
  }) }));
  return g;
}

/** A ground sigil and a pulsing, rotating target-lock crosshair. */
export function mark(w: VfxWorld, tex: VfxTextures, o: SustainedStatusOptions): Handle {
  const { g, h, s, attach } = sustained(w, o, 2800);
  const p = o.palette ?? { core: 0xffbd9b, main: 0xef6b5b, dark: 0x64223c };
  attach({ texture: tex.rune, layer: 'ground', groundAligned: true, scale: 0.12 * s,
    alpha: 0.35, tint: p.main, spin: -0.45 });
  attach({ texture: tex.ring, z: h * 0.48, scale: 0.17 * s, alpha: 0.4, tint: p.main, zBias: 16,
    onUpdate: (q) => { q.sprite.alpha *= 0.8 + Math.sin(q.age * 0.008) * 0.2; } });
  for (let i = 0; i < 4; i++) attach({ texture: tex.beam, z: h * 0.48,
    scaleX: 0.12 * s, scaleY: 0.12 * s, alpha: 0.65, tint: p.main, zBias: 16,
    onUpdate: (q) => { const a = i * TAU / 4 + q.age * 0.001; q.px = Math.cos(a) * 23 * s; q.pz = Math.sin(a) * 23 * s; q.rotation = -a; },
  });
  return g;
}

/** Fleeing violet-black wisps and a trembling procedural warning glyph. */
export function fear(w: VfxWorld, tex: VfxTextures, o: SustainedStatusOptions): Handle {
  const { g, h, s, dur, attach } = sustained(w, o, 2000);
  const p = o.palette ?? { core: 0xc998ef, main: 0x8050ae, dark: 0x21102e };
  attach({ texture: tex.digits['!'], blend: 'normal', z: h + 62 * s, scale: 0.4 * s,
    alpha: 0.9, tint: p.main, zBias: 13, onUpdate: (q) => { q.px = Math.sin(q.age * 0.035) * 3 * s; } });
  g.addHandle(w.stream({ rate: 16, duration: dur, make: (i) => ({ texture: tex.puff, blend: 'normal',
    x: rand(-20, 20) * s, y: 0, z: h * rand(0.4, 0.9), follow: o.target, life: 900,
    vx: rand(-15, 15) * s, vz: rand(45, 75) * s, scaleX: [0.12 * s, 0.04 * s], scaleY: [0.4 * s, 0.16 * s],
    alpha: envelope(0.1, 0.5, 0.7), tint: i % 3 ? p.dark : p.main, zBias: 7,
  }) }));
  return g;
}

/** A palette-driven base for custom buffs, with optional translucent column. */
export function aura(w: VfxWorld, tex: VfxTextures,
  o: SustainedStatusOptions & { radius?: number; intensity?: number; column?: boolean }): Handle {
  const { g, h, s, dur, attach, floor } = sustained(w, o, 3000);
  const p = o.palette ?? { core: 0xe6f4ff, main: 0x88bded, dark: 0x294d75 };
  const r = o.radius ?? 34 * s, intensity = clamp01(o.intensity ?? 1);
  floor(tex, { texture: tex.rune, textureRadius: M.runeRadius, radius: r, palette: p,
    alpha: 0.3 * intensity, spin: 0.7,
    onUpdate: (q) => { q.sprite.alpha *= 0.8 + Math.sin(q.age * 0.005) * 0.2; } });
  if (o.column) attach({ texture: tex.glow, z: h * 0.5, scaleX: r / 60, scaleY: h / 50,
    alpha: 0.12 * intensity, tint: p.main });
  g.addHandle(w.stream({ rate: 13, duration: dur, make: () => {
    const a = rand(0, TAU), d = rand(0.3, 1) * r;
    return { texture: tex.dot, x: Math.cos(a) * d, y: Math.sin(a) * d * w.groundSquash, z: 3,
      follow: o.target, life: 1200, vz: rand(25, 55) * s, scale: [0.1 * s, 0],
      alpha: envelope(0.15, 0.5, 0.45 * intensity), tint: p.main, zBias: 4 };
  } }));
  return g;
}

/** Healing ticks report positive amounts; the caller applies healing to its own game. */
export function regen(w: VfxWorld, tex: VfxTextures,
  o: SustainedStatusOptions & { tickMs?: number; heal?: number | (() => number); numbers?: boolean; onTick?: (amount: number) => void }): Handle {
  const duration = o.duration ?? 3000, p = o.palette ?? WUXING.moc.palette;
  const tickMs = Math.max(16, o.tickMs ?? 700);
  const { g, h, s, attach, floor } = sustained(w, { ...o, duration: duration > 0 ? duration + tickMs / 2 : 0 }, duration);
  floor(tex, { radius: M.ringRadius * 0.23 * s, palette: p, alpha: 0.22 });
  g.addHandle(w.stream({ rate: 7, duration, make: () => ({ texture: tex.plus,
    x: rand(-20, 20) * s, y: 0, z: rand(5, 25) * s, follow: o.target, life: 1100, vz: rand(30, 55) * s,
    scale: [0.2 * s, 0.08 * s], alpha: envelope(0.15, 0.5, 0.6), tint: p.main, zBias: 7,
  }) }));
  let age = 0, ticks = 0;
  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    while (g.alive && (ticks + 1) * tickMs <= Math.min(age, duration)) {
      ticks++;
      const amount = typeof o.heal === 'function' ? o.heal() : o.heal ?? 18;
      o.onTick?.(amount);
      if (o.numbers !== false) {
        const at = o.target();
        damageNumber(w, tex, { ...at, z: (at.z ?? 0) + h + 8 * s, value: amount, color: 0x88ef98, size: 18 * s });
      }
    }
  }));
  return g;
}

/** Trailing speed streaks and wind-tinted dust follow the unit's direction of motion. */
export function haste(w: VfxWorld, tex: VfxTextures, o: SustainedStatusOptions): Handle {
  const { g, h, s, dur, attach, floor } = sustained(w, o, 3000), p = o.palette ?? { core: 0xd7fff1, main: 0x8fddc8, dark: 0x345f59 };
  for (let i = 0; i < 2; i++) floor(tex, { texture: tex.crescent, radius: M.ringRadius * 0.34 * s,
    palette: p, alpha: 0.8, rotation: i * Math.PI, spin: 2.8 });
  let last = { ...o.target() }, direction = 1;
  g.addHandle(w.stream({ rate: 22, duration: dur, make: (i) => {
    const at = o.target();
    if (Math.abs(at.x - last.x) > 0.1) direction = Math.sign(at.x - last.x);
    last = { ...at };
    return i % 3 ? { texture: tex.streak, blend: 'normal',
      x: at.x - direction * rand(12, 28) * s, y: at.y, z: (at.z ?? 0) + rand(0.15, 0.8) * h,
      life: 400, vx: -direction * 55 * s, scaleX: [0.55 * s, 0.15 * s], scaleY: 0.45 * s,
      alpha: [0.6, 0], tint: p.main, zBias: 3,
    } : { texture: tex.puff, blend: 'normal', x: at.x - direction * 10 * s, y: at.y,
      z: at.z ?? 0, life: 550, vx: -direction * 35 * s, vz: 12 * s, scale: [0.12 * s, 0.25 * s],
      alpha: [0.18, 0], tint: p.main };
  } }));
  return g;
}

/** Flaring feet, warm embers and a low-alpha pulsing body glow. */
export function empower(w: VfxWorld, tex: VfxTextures, o: SustainedStatusOptions): Handle {
  const { g, h, s, dur, attach, floor } = sustained(w, o, 3000);
  const p = o.palette ?? { core: 0xffd58a, main: 0xf5783d, dark: 0x8a2424 };
  attach({ texture: tex.bubble, z: h * 0.45, scaleX: 0.24 * s, scaleY: h / 175,
    alpha: 0.22, tint: p.main, onUpdate: (q) => { q.sprite.alpha *= 0.75 + Math.sin(q.age * 0.009) * 0.25; } });
  attach({ texture: tex.glow, layer: 'ground', groundAligned: true, scale: 0.8 * s, alpha: 0.13, tint: p.main });
  floor(tex, { radius: M.ringRadius * 0.27 * s, palette: p, alpha: 0.65,
    onUpdate: (q) => { q.sprite.alpha *= 0.85 + Math.sin(q.age * 0.007) * 0.15; } });
  for (let i = 0; i < 5; i++) attach({ texture: tex.crescent, z: h * 0.4, scaleX: 0.17 * s, scaleY: 0.3 * s,
    rotation: i % 2 ? Math.PI : 0, alpha: 0.4, tint: p.main, zBias: 6,
    onUpdate: (q) => {
      q.px = (i - 2) * 10 * s + Math.sin(q.age * 0.011 + i * 2) * 3 * s;
      q.pz = Math.sin(q.age * 0.008 + i) * 8 * s;
      q.sprite.alpha *= 0.7 + Math.sin(q.age * 0.017 + i * 2) * 0.3;
    },
  });
  g.addHandle(w.stream({ rate: 26, duration: dur, make: (i) => ({ texture: i % 3 ? tex.shard : tex.dot,
    x: rand(-18, 18) * s, y: rand(-5, 5) * s, z: 3, follow: o.target, life: rand(450, 800),
    vz: rand(45, 90) * s, rotation: -Math.PI / 2, scaleX: [0.3 * s, 0.08 * s], scaleY: 0.2 * s,
    alpha: envelope(0.1, 0.7, 0.8), tint: [p.main, p.dark], zBias: 5,
  }) }));
  return g;
}

/** Small crawling arcs follow the body; stop() cancels arcs and gameplay ticks. */
export function shock(w: VfxWorld, tex: VfxTextures,
  o: OnUnit & { duration?: number; palette?: Palette; tickMs?: number; onTick?: () => void }): Handle {
  const duration = o.duration ?? 1500, p = o.palette ?? LOI.palette, h = o.height ?? 70;
  const tickMs = Math.max(16, o.tickMs ?? 500), g = group(w, duration > 0 ? duration + tickMs / 2 : 0);
  let arc = 0, age = 0, ticks = 0;
  g.addHandle(w.addUpdater((dt) => {
    arc += dt; age += dt;
    if (age < duration && arc >= 80) {
      arc %= 80;
      const at = o.target(), s = h / 70;
      lightningBolt(w, tex, { x: at.x + rand(-14, 14) * s, y: at.y, z: (at.z ?? 0) + rand(0.1, 0.45) * h },
        { x: at.x + rand(-14, 14) * s, y: at.y, z: (at.z ?? 0) + rand(0.55, 0.95) * h }, p,
        { width: 0.22 * s, alpha: 0.14, coreAlpha: 0.18, life: 65, depth: 3 });
      w.spawn({ texture: tex.streak, ...at, z: (at.z ?? 0) + 3, life: 180, vz: 50,
        scale: [0.1 * s, 0], rotation: rand(0, Math.PI * 2), alpha: [0.4, 0], tint: p.main });
    }
    while (g.alive && (ticks + 1) * tickMs <= Math.min(age, duration)) { ticks++; o.onTick?.(); }
  }));
  return g;
}

// ---------------------------------------------------------------- damage over time

export type DotKind = 'poison' | 'burn' | 'bleed';

export const DOT_STYLE: Record<DotKind, { palette: Palette; number: number }> = {
  poison: { palette: { core: 0xf0ffd0, main: 0x9cff3a, dark: 0x2f4a05 }, number: 0xb4ff4a },
  burn: { palette: { core: 0xfff3c4, main: 0xff7a1a, dark: 0x8a1a05 }, number: 0xffa040 },
  bleed: { palette: { core: 0xffd0d0, main: 0xe0152a, dark: 0x4a0008 }, number: 0xff5a6a },
};

/**
 * Poison / burn / bleed on a unit, with a pulse and a floating number every tick.
 * `damage` returns the tick value (or pass a number); `onTick` is where you apply it.
 */
export function damageOverTime(
  w: VfxWorld,
  tex: VfxTextures,
  o: OnUnit & { kind: DotKind; duration?: number; tickMs?: number; damage?: number | (() => number); numbers?: boolean; onTick?: (dmg: number) => void; poisonVisual?: 'spores' },
): Handle {
  const { palette: p, number: numColor } = DOT_STYLE[o.kind];
  const h = o.height ?? 70;
  const dur = o.duration ?? 3000;
  const tick = o.tickMs ?? 600;
  const T = o.target;
  const g = group(w, dur + tick / 2);
  const s = h / 70;

  // sickly / hot / wounded tint over the body
  const spores = o.kind === 'poison' && o.poisonVisual === 'spores';
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.5, follow: T, life: dur, zBias: 2, scaleX: 0.9 * s, scaleY: 1.3 * s, alpha: ms.env(dur, 200, 300, spores ? 0.07 : o.kind === 'bleed' ? 0.12 : 0.22), tint: spores ? 0x8a8953 : p.main }));
  if (spores) {
    g.addHandle(clingingSpores(w, T, h, dur));
  } else if (o.kind === 'poison') {
    g.add(w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: T, life: dur, scale: 1.1 * s, alpha: ms.env(dur, 250, 300, 0.4), tint: p.main }));
    g.addHandle(w.stream({
      rate: 14, duration: dur,
      make: () => {
        const a = rand(0, TAU);
        const phase = rand(0, TAU);
        return {
          texture: tex.bubble, x: Math.cos(a) * 14 * s, y: Math.sin(a) * 6 * s, z: rand(0.2, 0.8) * h, follow: T, life: rand(600, 900),
          vz: rand(30, 60), zBias: 4, scale: [rand(0.04, 0.08) * s, rand(0.09, 0.13) * s, outQuad], alpha: envelope(0.15, 0.85, 0.9), tint: [p.core, p.main],
          onUpdate: (q, t) => { q.px = Math.cos(a) * 14 * s + Math.sin(phase + t * 9) * 4; },
        };
      },
    }));
  } else if (o.kind === 'burn') {
    g.addHandle(burnFlames(w, T, h, dur, p));
    g.addHandle(w.stream({
      rate: 10, duration: dur,
      make: () => ({ texture: tex.dot, x: rand(-12, 12) * s, y: 0, z: rand(0.3, 0.9) * h, follow: T, life: rand(500, 900), vx: rand(-30, 30), vz: rand(80, 150), drag: 1, zBias: 5, scale: [0.18, 0], tint: [p.core, p.main] }),
    }));
  } else {
    g.addHandle(w.stream({
      rate: 7, duration: dur,
      make: () => drop(w, tex, T(), h, p, s, rand(-30, 30), rand(0, 40)),
    }));
  }

  // Ticks land at tick, 2*tick, ... up to duration; the group outlives duration by half a tick
  // so a tick due exactly at duration still fires.
  const maxTicks = Math.floor(dur / tick);
  let n = 0;
  g.addHandle(w.addUpdater(((acc) => (dt) => {
    if (n >= maxTicks) return false;
    acc += dt;
    if (acc < tick) return;
    acc -= tick;
    n++;
    const at = T();
    const dmg = typeof o.damage === 'function' ? o.damage() : o.damage ?? 12;
    o.onTick?.(dmg);
    w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.55, follow: T, life: 220, zBias: 3, scaleX: [0.9 * s, 1.4 * s, outQuad], scaleY: [1.3 * s, 1.8 * s, outQuad], alpha: [spores ? 0.06 : 0.55, 0, outQuad], tint: spores ? 0x8a8953 : p.main });
    if (o.kind === 'poison' && !spores) {
      w.burst(6, () => ({ texture: tex.dot, x: at.x, y: at.y, z: h * rand(0.3, 0.7), life: rand(300, 500), vx: rand(-90, 90), vz: rand(40, 140), gravity: 300, zBias: 5, scale: [0.3, 0], tint: p.main }));
    } else if (o.kind === 'burn') {
      w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.4, follow: T, life: 180, zBias: 4, scale: [0.6 * s, 1.1 * s], alpha: [0.8, 0], tint: p.core });
    } else if (o.kind === 'bleed') {
      const side = n % 2 ? 1 : -1;
      w.burst(5, () => drop(w, tex, at, h, p, s, side * rand(60, 140), rand(40, 120)));
      w.spawn({ texture: tex.streak, x: at.x, y: at.y, z: h * 0.55, life: 160, zBias: 6, rotation: side * 0.6, scaleX: [0.6 * s, 0.9 * s], scaleY: 0.45, alpha: [1, 0], tint: p.core });
    }
    if (o.numbers !== false) damageNumber(w, tex, { x: at.x, y: at.y, z: h + 6, value: dmg, color: numColor, size: 18 });
  })(0)));
  return g;
}

function drop(w: VfxWorld, tex: VfxTextures, at: Vec3, h: number, p: Palette, s: number, vx: number, vz: number) {
  return {
    texture: tex.drop, blend: 'normal' as const, x: at.x + rand(-8, 8) * s, y: at.y + rand(-2, 2), z: h * rand(0.35, 0.7), life: 1200, zBias: 6,
    vx, vz, gravity: 900, killOnGround: true, scale: rand(0.3, 0.45) * s, tint: p.main, alpha: 0.95,
    onDeath: (q: { x: number; y: number }) => {
      const x = q.x, y = q.y;
      w.after(0, () => w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, blend: 'normal', x, y, life: 900, scale: [0.08, 0.2, outQuad], alpha: [0.8, 0, inQuad], tint: p.dark }));
    },
  };
}

// ---------------------------------------------------------------- crowd control

/** Stars circling over the head. */
export function stun(w: VfxWorld, tex: VfxTextures, o: OnUnit & { duration?: number; palette?: Palette; stars?: number }): Handle {
  const h = o.height ?? 70;
  const dur = o.duration ?? 2000;
  const p = o.palette ?? { core: 0xffffff, main: 0xffd84a, dark: 0xb07a10 };
  const T = o.target;
  const n = o.stars ?? 3;
  const r = 20 * (h / 70);
  const g = group(w, dur);
  const head = { x: 0, y: 0, z: h + 12 };
  const angleAt = (q: { age: number }, i: number) => (i / n) * TAU + q.age * 0.0065;
  g.add(w.spawn({ texture: tex.ring, groundAligned: true, x: 0, y: 0, z: head.z, follow: T, life: dur, zBias: 1, scale: (r * 1.15) / M.ringRadius, alpha: ms.env(dur, 150, 200, 0.35), tint: p.main }));
  for (let i = 0; i < n; i++) {
    g.add(w.spawn({
      texture: tex.star, x: 0, y: 0, z: head.z, follow: T, life: dur, alpha: ms.env(dur, 120, 200), tint: p.core,
      scale: (t) => 0.42 * outBack(clamp01((t * dur) / 220)),
      onUpdate: (q) => {
        const a = angleAt(q, i);
        q.px = Math.cos(a) * r;
        q.py = Math.sin(a) * r * w.groundSquash;
        q.rotation = q.age * 0.004;
        q.sprite.tint = Math.sin(a) > 0 ? p.core : p.main;
      },
    }));
  }
  g.addHandle(w.stream({
    rate: 50, duration: dur,
    make: (k) => {
      const a = (k % n) / n * TAU + w.now * 0.0065;
      return { texture: tex.dot, x: Math.cos(a) * r, y: Math.sin(a) * r * w.groundSquash, z: head.z, follow: T, life: 260, scale: [0.22, 0], alpha: 0.7, tint: p.main };
    },
  }));
  return g;
}

/** Ice encasement. Ends (or stop()) with a shatter; onShatter is where you resume the unit. */
export function freeze(w: VfxWorld, tex: VfxTextures, o: OnUnit & { duration?: number; palette?: Palette; glowIntensity?: number; onShatter?: () => void }): Handle {
  const h = o.height ?? 70;
  const dur = o.duration ?? 2500;
  const p = o.palette ?? WUXING.thuy.palette;
  const T = o.target;
  const s = h / 70;
  const glow = o.glowIntensity ?? 1;
  const shatter = () => {
    const at = T();
    w.spawn({ texture: tex.glow, x: at.x, y: at.y, z: h * 0.5, life: 160, zBias: 20, scale: [1.2 * s * Math.sqrt(glow), 2.2 * s * Math.sqrt(glow), outQuad], alpha: [0.9 * glow, 0], tint: glow < 1 ? p.main : p.core });
    w.burst(18, () => {
      const a = rand(0, TAU);
      const sp = rand(120, 320);
      return {
        texture: tex.shard, blend: glow < 1 ? 'normal' : 'add', x: at.x + rand(-10, 10) * s, y: at.y, z: h * rand(0.2, 0.9), life: rand(500, 800), zBias: 8,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(80, 300), gravity: 1100, bounce: 0.3, rotation: rand(0, TAU), spin: rand(-12, 12),
        scale: rand(0.25, 0.45) * s, alpha: envelope(0, 0.7), tint: [p.core, p.main],
      };
    });
    w.burst(10, () => ({ texture: tex.star, x: at.x + rand(-20, 20) * s, y: at.y, z: h * rand(0.1, 1), life: rand(250, 450), zBias: 9, scale: [0.35, 0], alpha: Math.sqrt(glow), rotation: rand(0, TAU), tint: glow < 1 ? p.main : p.core }));
    floorRing(w, tex, { x: at.x, y: at.y, radius: M.ringRadius * 0.35 * s, palette: p,
      duration: 300, scale: [0.1 * s, 0.35 * s, outCubic], alpha: [0.8, 0] });
    w.hitStop(40);
    w.shake(3, 150);
    o.onShatter?.();
  };
  const g = group(w, dur, shatter, 60);
  const grow = (t: number) => outBack(clamp01((t * dur) / 200));
  g.add(w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: T, life: dur, scale: 1.4 * s, alpha: ms.env(dur, 150, 100, 0.55 * glow), tint: p.main }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + rand(-0.2, 0.2);
    g.add(w.spawn({ texture: tex.shard, layer: 'ground', groundAligned: true, x: Math.cos(a) * 30 * s, y: Math.sin(a) * 30 * s * w.groundSquash, follow: T, life: dur, rotation: a, scale: (t) => rand(0.35, 0.5) * s * grow(t), alpha: 0.5, tint: p.core }));
  }
  // crystals around the body: back ones sort behind the sprite, front ones in front
  const crystals = 9;
  for (let i = 0; i < crystals; i++) {
    const a = (i / crystals) * TAU + rand(-0.25, 0.25);
    const ox = Math.cos(a) * 17 * s, oy = Math.sin(a) * 8 * s;
    const tall = (h * rand(0.7, 1.08)) / M.spikeHeight;
    const wide = rand(0.32, 0.5) * s;
    g.add(w.spawn({
      texture: tex.spike, blend: 'normal', x: ox, y: oy, follow: T, life: dur, anchorY: 1, rotation: (ox / (17 * s)) * 0.35,
      scaleX: wide, scaleY: (t) => tall * grow(t), alpha: 0.62, tint: lerpColor(p.core, p.main, rand(0.2, 0.6)),
    }));
  }
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.5, follow: T, life: dur, zBias: 12, scaleX: 0.8 * s, scaleY: 1.3 * s, alpha: ms.env(dur, 100, 100, 0.35 * glow), tint: glow < 1 ? p.main : p.core }));
  g.addHandle(w.stream({
    rate: 6, duration: dur,
    make: () => ({ texture: tex.star, x: rand(-16, 16) * s, y: rand(0, 6), z: rand(0.1, 1) * h, follow: T, life: 400, zBias: 14, rotation: rand(0, TAU), scale: (t) => 0.3 * Math.sin(t * Math.PI), tint: p.core }),
  }));
  g.addHandle(w.stream({
    rate: 5, duration: dur,
    make: () => {
      const a = rand(0, TAU);
      return { texture: tex.puff, blend: 'normal', x: Math.cos(a) * 20 * s, y: Math.sin(a) * 8 * s, z: 4, follow: T, life: 1100, vx: Math.cos(a) * 20, vy: Math.sin(a) * 10, zBias: -2, scale: [0.4 * s, 0.9 * s], alpha: envelope(0.3, 0.25, 0.4), tint: 0xdff6ff };
    },
  }));
  return g;
}

/** Slow: a cold, heavy swirl at the feet and drops dripping off the body. */
export function slow(w: VfxWorld, tex: VfxTextures, o: OnUnit & { duration?: number; palette?: Palette }): Handle {
  const h = o.height ?? 70;
  const dur = o.duration ?? 3000;
  const p = o.palette ?? WUXING.thuy.palette;
  const T = o.target;
  const s = h / 70;
  const g = group(w, dur);
  const k = (36 * s) / M.crescentRadius;
  for (let i = 0; i < 3; i++) {
    g.add(w.spawn({ texture: tex.crescent, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: T, life: dur, rotation: (i / 3) * TAU, spin: 1.4, scale: k * (1 - i * 0.12), alpha: ms.env(dur, 200, 300, 0.55), tint: i ? p.main : p.core }));
  }
  g.add(w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: T, life: dur, scale: 1.1 * s, alpha: ms.env(dur, 200, 300, 0.35), tint: p.dark }));
  g.addHandle(w.stream({
    rate: 5, duration: dur,
    make: () => ({ texture: tex.chevron, x: rand(-14, 14) * s, y: 0, z: h * rand(0.5, 0.9), follow: T, life: 700, rotation: Math.PI, vz: -55, zBias: 5, scale: 0.28 * s, alpha: envelope(0.2, 0.5, 0.6), tint: p.main }),
  }));
  g.addHandle(w.stream({
    rate: 9, duration: dur,
    make: () => ({ texture: tex.drop, blend: 'normal', x: rand(-15, 15) * s, y: rand(-2, 2), z: h * rand(0.3, 0.8), follow: T, life: 900, vz: -20, gravity: 260, killOnGround: true, zBias: 6, scale: 0.28 * s, alpha: 0.8, tint: p.main }),
  }));
  return g;
}

/** Root: thorned vines coil around legs and torso, then wither. */
export function root(w: VfxWorld, tex: VfxTextures, o: OnUnit & { duration?: number; palette?: Palette }): VineBindHandle {
  return vineBind(w, tex, o);
}

// ---------------------------------------------------------------- shields

export interface ShieldHandle extends Handle {
  /** Absorb a hit coming from screen angle `fromAngle` (0 = from the right). */
  hit(fromAngle?: number): void;
  /** Shatter the shield now. */
  break(): void;
}

/** Barrier bubble that ripples on hit and shatters on break (or fades at the end). */
export function shield(w: VfxWorld, tex: VfxTextures, o: OnUnit & { duration?: number; palette?: Palette; radius?: number; onBreak?: () => void }): ShieldHandle {
  const h = o.height ?? 70;
  const dur = o.duration ?? Infinity;
  const p = o.palette ?? WUXING.kim.palette;
  const T = o.target;
  const R = o.radius ?? h * 0.62;
  const k = R / M.bubbleRadius;
  const cz = h * 0.48;
  const g = group(w, dur, undefined, 250);
  let flash = 0;
  const bubble = g.add(w.spawn({
    texture: tex.bubble, x: 0, y: 0, z: cz, follow: T, life: Infinity, zBias: 30, tint: p.main, scale: k,
    onUpdate: (q) => {
      flash = Math.max(0, flash - 0.004 * 16);
      q.o.scale = k * outBack(clamp01(q.age / 260)) * (1 + 0.025 * Math.sin(q.age * 0.005));
      q.o.alpha = 0.55 + 0.1 * Math.sin(q.age * 0.003) + flash;
    },
  }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: cz, follow: T, life: Infinity, zBias: -30, scale: k * 2.6, alpha: 0.18, tint: p.main }));
  const rim = floorRing(w, tex, { around: T, radius: R * 0.95, palette: p, duration: Infinity, alpha: 0.55 });
  g.add(rim.far); g.add(rim.near);
  g.add(w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: T, life: Infinity, scale: R / 40, alpha: 0.22, tint: p.main }));
  // cast pop
  w.spawn({ texture: tex.ring, x: 0, y: 0, z: cz, follow: T, life: 280, zBias: 31, scale: [k * 0.4, k * 1.15, outCubic], alpha: [0.9, 0], tint: p.core });
  g.addHandle(w.stream({
    rate: 10,
    make: () => {
      const a = rand(0, TAU);
      return { texture: tex.star, x: Math.cos(a) * R * 0.92, y: 0, z: cz + Math.sin(a) * R * 0.92, follow: T, life: 450, zBias: 31, rotation: rand(0, TAU), scale: (t) => 0.28 * Math.sin(t * Math.PI), tint: p.core };
    },
  }));
  const api: ShieldHandle = {
    stop: () => g.stop(),
    get alive() { return g.alive; },
    hit(fromAngle = 0) {
      if (!g.alive) return;
      flash = 0.45;
      const at = T();
      const hx = at.x + Math.cos(fromAngle) * R * 0.9, hz = cz - Math.sin(fromAngle) * R * 0.9;
      w.spawn({ texture: tex.glow, x: hx, y: at.y, z: hz, life: 180, zBias: 32, scale: [0.5, 1.1, outQuad], alpha: [0.9, 0], tint: p.core });
      w.spawn({ texture: tex.ring, x: at.x, y: at.y, z: cz, life: 320, zBias: 32, scale: [k * 0.3, k * 1.0, outCubic], alpha: [0.7, 0], tint: p.main });
      w.burst(6, () => {
        const a = fromAngle + rand(-1, 1);
        return { texture: tex.streak, x: hx, y: at.y, z: hz, life: 200, zBias: 33, vx: Math.cos(a) * 300, vz: -Math.sin(a) * 300, drag: 5, faceVelocity: true, scaleX: [0.35, 0.05], scaleY: 0.4, tint: p.core };
      });
    },
    break() {
      if (!g.alive) return;
      const at = T();
      g.stop();
      if (bubble && !bubble.dead) bubble.kill();
      w.spawn({ texture: tex.glow, x: at.x, y: at.y, z: cz, life: 200, zBias: 32, scale: [k * 2, k * 3.5, outQuad], alpha: [0.8, 0], tint: p.core });
      w.burst(22, () => {
        const a = rand(0, TAU);
        const sp = rand(160, 360);
        return {
          texture: tex.shard, x: at.x + Math.cos(a) * R * 0.8, y: at.y, z: cz - Math.sin(a) * R * 0.8, life: rand(450, 750), zBias: 31,
          vx: Math.cos(a) * sp, vz: -Math.sin(a) * sp + 80, gravity: 900, bounce: 0.25, rotation: rand(0, TAU), spin: rand(-14, 14),
          scale: rand(0.25, 0.42), alpha: envelope(0, 0.6), tint: [p.core, p.main],
        };
      });
      floorRing(w, tex, { x: at.x, y: at.y, radius: R * 2.2, palette: p,
        duration: 380, scale: [R / M.ringRadius, (R * 2.2) / M.ringRadius, outCubic], alpha: [0.9, 0] });
      w.shake(5, 200);
      w.hitStop(60);
      o.onBreak?.();
    },
  };
  return api;
}

// ---------------------------------------------------------------- stat up / down

/** Stat buff (up) or debuff (down): chevrons climbing or sinking through a light column. */
export function statChange(w: VfxWorld, tex: VfxTextures, o: OnUnit & { up: boolean; palette?: Palette; duration?: number }): Handle {
  const h = o.height ?? 70;
  const dur = o.duration ?? 1400;
  const p = o.palette ?? (o.up ? { core: 0xfff8d0, main: 0xffc23a, dark: 0x9a5a00 } : { core: 0xf0d8ff, main: 0x9a4cff, dark: 0x2a0850 });
  const T = o.target;
  const s = h / 70;
  const g = group(w, dur);
  const dir = o.up ? 1 : -1;
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.55, follow: T, life: dur, zBias: -4, scaleX: 0.75 * s, scaleY: 2.2 * s, alpha: ms.env(dur, 150, 500, 0.35), tint: p.main }));
  if (!o.up) g.add(w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, blend: 'normal', x: 0, y: 0, follow: T, life: dur, scale: 1.2 * s, alpha: ms.env(dur, 150, 400, 0.5), tint: p.dark }));
  const rim = floorRing(w, tex, { around: T, radius: M.ringRadius * 0.32 * s, palette: p, duration: 600,
    scale: o.up ? [0.05 * s, 0.32 * s, outCubic] : [0.32 * s, 0.08 * s, outCubic], alpha: [0.9, 0] });
  g.add(rim.far); g.add(rim.near);
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      g.add(w.spawn({
        texture: tex.chevron, x: side * 13 * s, y: 2, z: o.up ? h * 0.15 : h * 0.95, follow: T, life: 650, delay: i * 140 + (side > 0 ? 70 : 0), zBias: 6,
        rotation: o.up ? 0 : Math.PI, vz: dir * h * 1.1, scale: [0.42 * s, 0.3 * s], alpha: envelope(0.15, 0.55, 0.95), tint: [p.core, p.main],
      }));
    }
  }
  g.addHandle(w.stream({
    rate: 22, duration: dur * 0.8,
    make: () => ({ texture: tex.dot, x: rand(-18, 18) * s, y: rand(-3, 3), z: o.up ? rand(0, 0.3) * h : rand(0.7, 1) * h, follow: T, life: 600, vz: dir * rand(60, 120), zBias: 5, scale: [0.25, 0], tint: p.main }),
  }));
  return g;
}
