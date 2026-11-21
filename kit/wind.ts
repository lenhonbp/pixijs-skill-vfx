// Wind (Phong) recipes: tornado funnel, wind blade, ground vortex, gust lines and wisps.
// Wind has no mass, so it reads through motion: orbiting streaks sorted in front of and behind
// the target, ribbons, curl-noise drift, and whatever it carries (dust, leaves, debris).
import { clamp01, envelope, inQuad, lerp, outCubic, outQuad, rand } from './ease';
import { curlDrift } from './noise';
import { Distortion } from './postfx';
import type { Palette } from './recipes';
import type { VfxTextures } from './textures';
import { ribbonTrail } from './trail';
import type { Handle, Vec3, VfxWorld } from './vfx-world';

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

/** A spinning funnel: streak bands orbiting a cone, dust ring at the base, debris lifted up. */
export function tornado(w: VfxWorld, tex: VfxTextures, o: TornadoOptions): TornadoHandle {
  const H = o.height ?? 190;
  const R = o.radius ?? 54;
  const dur = o.duration ?? 2400;
  const pal = o.palette;
  const pos = { x: o.at.x, y: o.at.y, z: 0 };
  const from = { ...pos };
  const to = o.to ?? from;
  let age = 0;
  let tickLeft = 0;
  // 0..1 build-up and wind-down of the whole funnel.
  const env = () => clamp01(age / 280) * clamp01((dur - age) / 360);
  const radiusAt = (u: number) => R * (0.18 + 0.82 * Math.pow(u, 1.25));
  const follow = () => pos;

  const orbit = (h0: number, spinBase: number) => (p: any, t: number, dt: number) => {
    const d = (p.data ??= { a: rand(0, Math.PI * 2), u: Math.pow(Math.random(), 0.8) * 0.9, rise: rand(0.25, 0.6), rk: rand(0.8, 1.15) });
    d.a += (spinBase / (0.4 + d.u)) * dt;
    d.u = Math.min(1, d.u + d.rise * dt);
    const r = radiusAt(d.u) * (0.6 + 0.4 * env()) * d.rk;
    p.px = Math.cos(d.a) * r;
    p.py = Math.sin(d.a) * r * w.groundSquash;
    p.pz = h0 + d.u * H;
    p.rotation = -Math.sin(d.a) * 0.25;
    // Back of the funnel is dimmer, so the spin reads in depth.
    p.alphaMul = env() * (0.4 + 0.6 * clamp01(Math.sin(d.a) + 0.6));
  };

  const streams: Handle[] = [];
  // Main band streaks: elongated along the orbit direction.
  streams.push(w.stream({
    rate: 120, duration: dur - 300, make: () => ({
      texture: tex.streak, x: 0, y: 0, follow, life: rand(500, 900), blend: 'add',
      scaleX: rand(0.5, 0.9), scaleY: rand(0.35, 0.6), tint: Math.random() < 0.3 ? pal.core : pal.main,
      alpha: envelope(0.15, 0.4), onUpdate: orbit(0, 6.5),
    }),
  }));
  // Soft translucent body: big puffs in the dark tone for volume.
  streams.push(w.stream({
    rate: 40, duration: dur - 300, make: () => ({
      texture: tex.puff, x: 0, y: 0, follow, life: rand(700, 1100), blend: 'normal',
      scale: [0.35, 0.7], alpha: envelope(0.2, 0.5, 0.35), tint: pal.dark, spin: rand(-2, 2),
      onUpdate: orbit(0, 4.5),
    }),
  }));
  // Debris / leaves caught in the flow.
  streams.push(w.stream({
    rate: 16, duration: dur - 500, make: () => ({
      texture: o.leaves ? tex.leaf : tex.rock, x: 0, y: 0, follow, life: rand(900, 1300), blend: 'normal',
      scale: o.leaves ? rand(0.3, 0.45) : rand(0.18, 0.3), spin: rand(-8, 8), tint: o.leaves ? pal.main : 0xb8a080,
      onUpdate: orbit(4, 5.5),
    }),
  }));
  // Ground: dust ring rolling outward and a rotating swirl decal.
  streams.push(w.stream({
    rate: 26, duration: dur - 300, make: () => {
      const a = rand(0, Math.PI * 2);
      return {
        texture: tex.puff, x: 0, y: 0, follow, z: 2, life: rand(500, 800), blend: 'normal',
        vx: Math.cos(a) * 110, vy: Math.sin(a) * 110 * w.groundSquash, vz: rand(10, 40), drag: 2.5,
        scale: [0.25, 0.6, outQuad], alpha: envelope(0.15, 0.7, 0.5), tint: 0xcdbb98, spin: rand(-1.5, 1.5),
      };
    },
  }));
  const swirl = w.spawn({
    texture: tex.ring, layer: 'ground', groundAligned: true, x: 0, y: 0, follow, life: dur, spin: -5,
    tint: pal.main, alpha: envelope(0.12, 0.15, 0.3), scale: (R * 1.6) / 128,
  });

  const distortion = w.plugin(Distortion);
  distortion?.haze(() => ({ x: pos.x, y: pos.y - H * 0.45 }), { radius: R * 1.4, duration: dur, rise: H * 0.5, strength: 0.6 });

  const u = w.addUpdater((dt) => {
    age += dt;
    const t = clamp01(age / dur);
    pos.x = lerp(from.x, to.x, outQuad(t)) + Math.sin(age / 210) * 6;
    pos.y = lerp(from.y, to.y, outQuad(t)) + Math.cos(age / 260) * 4;
    if (o.onTick && (tickLeft -= dt) <= 0) {
      tickLeft = o.tickMs ?? 250;
      o.onTick({ ...pos });
    }
    if (age >= dur) return false;
  });
  return {
    pos,
    stop() {
      u.stop();
      for (const s of streams) s.stop();
      swirl?.kill();
    },
    get alive() {
      return u.alive;
    },
  };
}

/** Wind blade: a spinning crescent gust that flies `from` -> `to` with twin ribbon trails. */
export function windSlash(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: Vec3; to: Vec3; palette: Palette; size?: number; speed?: number; onHit?: (at: Vec3) => void },
): Handle {
  const pal = o.palette;
  const size = o.size ?? 1;
  const z0 = o.from.z ?? 40;
  const z1 = o.to.z ?? 40;
  const dx = o.to.x - o.from.x, dy = o.to.y - o.from.y;
  const dist = Math.hypot(dx, dy / w.groundSquash);
  const dur = (dist / (o.speed ?? 950)) * 1000;
  const ang = Math.atan2(dy / w.groundSquash, dx);
  const pos = { x: o.from.x, y: o.from.y, z: z0 };
  const side = (k: number) => () => ({ x: pos.x - Math.sin(ang) * 18 * k * size, y: pos.y + Math.cos(ang) * 18 * k * size * w.groundSquash, z: pos.z });
  const follow = () => pos;
  const ribbons = [
    ribbonTrail(w, { target: side(1), width: 10 * size, segments: 14, tint: pal.main, zBias: 4 }),
    ribbonTrail(w, { target: side(-1), width: 10 * size, segments: 14, tint: pal.main, zBias: 4 }),
    ribbonTrail(w, { target: follow, width: 18 * size, segments: 10, tint: pal.core, alpha: 0.8, zBias: 5 }),
  ];
  // The blade: two crescents facing the flight direction, the inner one white-hot.
  const blade = [
    w.spawn({ texture: tex.crescent, x: 0, y: 0, follow, life: Infinity, groundAligned: true, zBias: 6, rotation: ang, tint: pal.main, scale: 0.55 * size, alpha: 0.95 }),
    w.spawn({ texture: tex.crescent, x: 0, y: 0, follow, life: Infinity, groundAligned: true, zBias: 7, rotation: ang, tint: pal.core, scale: 0.42 * size, scaleY: 0.6 }),
  ];
  const lines = w.stream({
    rate: 90, make: () => ({
      texture: tex.streak, x: pos.x + rand(-14, 14), y: pos.y + rand(-10, 10), z: pos.z + rand(-16, 16), life: rand(160, 260), zBias: 3,
      vx: -Math.cos(ang) * 160, vy: -Math.sin(ang) * 160 * w.groundSquash, rotation: Math.atan2(Math.sin(ang) * w.groundSquash, Math.cos(ang)),
      scaleX: [0.6, 0.1], scaleY: 0.3, tint: pal.main, alpha: [0.8, 0],
    }),
  });
  let age = 0;
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    lines.stop();
    for (const r of ribbons) r.stop();
    for (const b of blade) b?.kill();
  };
  const u = w.addUpdater((dt) => {
    age += dt;
    const t = clamp01(age / Math.max(1, dur));
    pos.x = o.from.x + dx * t;
    pos.y = o.from.y + dy * t;
    pos.z = lerp(z0, z1, t) + Math.sin(t * Math.PI) * 10;
    if (t >= 1) {
      end();
      // Release: a burst of sideways gust lines and a puff ring.
      w.burst(10, (i, n) => {
        const a = ang + (i / n - 0.5) * 2.4;
        const sp = rand(220, 380);
        return {
          texture: tex.streak, x: pos.x, y: pos.y, z: pos.z, life: rand(200, 320), zBias: 4, faceVelocity: true,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(-40, 60), drag: 4, scaleX: [0.7, 0.1], scaleY: 0.4, tint: [pal.core, pal.main],
        };
      });
      w.spawn({ texture: tex.ring, x: pos.x, y: pos.y, z: pos.z, life: 260, zBias: 5, rotation: ang, scaleX: [0.15 * size, 0.5 * size, outCubic], scaleY: [0.3 * size, 0.9 * size, outCubic], alpha: [0.9, 0, inQuad], tint: pal.core });
      o.onHit?.({ ...pos });
      return false;
    }
  });
  return {
    stop() {
      u.stop();
      end();
    },
    get alive() {
      return u.alive;
    },
  };
}

/** Ground vortex: streaks spiralling inward to a point, rotating rings. Good for pulls and wind fields. */
export function vortex(
  w: VfxWorld,
  tex: VfxTextures,
  o: { at: Vec3 | (() => Vec3); radius?: number; palette: Palette; duration?: number; inward?: boolean },
): Handle {
  const R = o.radius ?? 110;
  const dur = o.duration ?? 1600;
  const pal = o.palette;
  const at = typeof o.at === 'function' ? o.at : () => o.at as Vec3;
  const sign = o.inward === false ? -1 : 1;
  const g = { layer: 'ground', groundAligned: true, x: 0, y: 0, follow: at, life: dur } as const;
  w.spawn({ ...g, texture: tex.ring, spin: -3 * sign, tint: pal.main, alpha: envelope(0.15, 0.3, 0.6), scale: [(R * 2.1) / 256, (R * 1.8) / 256] });
  w.spawn({ ...g, texture: tex.ring, spin: -6 * sign, tint: pal.core, alpha: envelope(0.2, 0.3, 0.35), scale: (R * 1.1) / 256 });
  w.spawn({ ...g, texture: tex.glow, tint: pal.dark, blend: 'normal', alpha: envelope(0.2, 0.3, 0.3), scale: (R * 2) / 128 });
  return w.stream({
    rate: 70, duration: dur - 350, make: () => {
      const a0 = rand(0, Math.PI * 2);
      return {
        texture: tex.streak, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: at, life: rand(450, 650),
        scaleX: [0.5, 0.2], scaleY: 0.35, tint: Math.random() < 0.3 ? pal.core : pal.main, alpha: envelope(0.2, 0.4, 0.9),
        onUpdate: (p, t) => {
          const u = sign > 0 ? t : 1 - t;
          const r = R * (1 - outQuad(u)) + 6;
          const a = a0 + u * 3.2 * sign;
          p.px = Math.cos(a) * r;
          p.py = Math.sin(a) * r;
          p.rotation = a + Math.PI / 2 * sign + 0.5 * sign;
        },
      };
    },
  });
}

/** Wind wisps curling around a unit (buff aura): ribbon helices plus curl-noise motes. */
export function windWisps(
  w: VfxWorld,
  tex: VfxTextures,
  o: { target: () => Vec3; height?: number; radius?: number; palette: Palette; duration?: number },
): Handle {
  const H = o.height ?? 80;
  const R = o.radius ?? 34;
  const dur = o.duration ?? 2400;
  const pal = o.palette;
  let age = 0;
  const helix = (ph: number, speed: number) => () => {
    const c = o.target();
    const a = age / 1000 * speed + ph;
    const u = (age / 900 + ph / 6.28) % 1;
    return { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R * w.groundSquash, z: (c.z ?? 0) + 6 + u * H * 0.9 };
  };
  const u = w.addUpdater((dt) => {
    age += dt;
    if (age >= dur) return false;
  });
  const ribbons = [0, 2.1, 4.2].map((ph, i) =>
    ribbonTrail(w, { target: helix(ph, 7 + i), width: 7, segments: 16, tint: i === 1 ? pal.core : pal.main, alpha: 0.85, life: dur, fadeMs: 300 }),
  );
  const motes = w.stream({
    rate: 22, duration: dur - 400, make: () => {
      const c = o.target();
      const a = rand(0, Math.PI * 2);
      return {
        texture: tex.dot, x: c.x + Math.cos(a) * R * 1.2, y: c.y + Math.sin(a) * R * w.groundSquash, z: (c.z ?? 0) + rand(0, H * 0.6), life: rand(600, 1000),
        vz: rand(30, 70), scale: rand(0.12, 0.22), tint: pal.core, alpha: envelope(0.2, 0.5, 0.9), onUpdate: curlDrift(70, 50),
      };
    },
  });
  return {
    stop() {
      u.stop();
      motes.stop();
      for (const r of ribbons) r.stop();
    },
    get alive() {
      return u.alive;
    },
  };
}

/** Horizontal speed lines along `angle` (ground radians): dashes, knockback, tailwind. */
export function gustLines(w: VfxWorld, tex: VfxTextures, o: Vec3 & { angle: number; palette: Palette; count?: number; spread?: number }) {
  const sp = o.spread ?? 40;
  const rot = Math.atan2(Math.sin(o.angle) * w.groundSquash, Math.cos(o.angle));
  w.burst(o.count ?? 8, () => {
    const speed = rand(380, 620);
    return {
      texture: tex.streak, x: o.x + rand(-sp, sp), y: o.y + rand(-sp, sp) * w.groundSquash, z: (o.z ?? 30) + rand(-sp, sp) * 0.8,
      vx: Math.cos(o.angle) * speed, vy: Math.sin(o.angle) * speed * w.groundSquash, drag: 3, life: rand(220, 360), rotation: rot,
      scaleX: [0.9, 0.2], scaleY: rand(0.25, 0.4), alpha: [0.85, 0], tint: Math.random() < 0.4 ? o.palette.core : o.palette.main,
    };
  });
}
