import type { Handle, Vec3, VfxWorld } from './vfx-world';
import { TEX_METRICS as M, type VfxTextures } from './textures';
import type { Palette } from './recipes';
import { afterimage } from './motion';
import { group } from './group';
import { clamp01, lerp, outCubic, rand } from './ease';

/** Spectral halberd warrior: reveal, advance, cleave and slam, rising-mote dissolve. */
export function spiritGuardian(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; z?: number; palette: Palette; height?: number; duration?: number;
    target?: () => Vec3; strikes?: number; slamRadius?: number; onStrike?: (i: number, at: Vec3) => void; facing?: number }): Handle {
  const h = o.height ?? 100, k = h / 240, count = Math.max(0, Math.floor(o.strikes ?? 3));
  const reveal = 350, advance = 650, cycle = 650, dissolve = 450;
  const end = reveal + (o.target ? advance + count * cycle : (o.duration ?? 1200));
  const g = group(w, end + dissolve, undefined, 80);
  const pos = { x: o.x, y: o.y, z: o.z ?? 0 };
  let aim: Vec3 = { ...pos }, dest = { ...pos };
  let age = 0, facing = o.facing ?? 1, lean = 0, lift = 0, step = -1, ghost = 0, strike = -1, hit = -1;
  const opacity = () => clamp01(age / reveal) * (1 - clamp01((age - end) / dissolve));
  const dust = () => {
    for (let i = 0; i < 3; i++) g.add(w.spawn({ texture: tex.puff, blend: 'normal',
      x: pos.x + rand(-0.12, 0.12) * h, y: pos.y, z: 2, life: 360,
      vx: -facing * rand(12, 35), vz: rand(8, 20), drag: 3,
      scale: [h / 650, h / 330], alpha: [0.18, 0], tint: o.palette.main }));
  };
  const impact = (i: number) => {
    const heavy = i % 3 === 2, sweep = i % 3 === 1;
    const angle = Math.atan2((aim.y - pos.y) / w.groundSquash, aim.x - pos.x);
    const radius = h * (sweep ? 0.95 : 0.8);
    for (const core of [false, true]) g.add(w.spawn({ texture: tex.crescent,
      x: pos.x, y: pos.y, z: pos.z + h * 0.4, life: heavy ? 260 : 220, zBias: 25,
      rotation: heavy ? -Math.PI / 2 : angle - (sweep ? 1.4 : 0.8),
      spin: facing * (heavy ? 5 : 12), groundAligned: sweep,
      scaleX: radius / M.crescentRadius, scaleY: radius / M.crescentRadius * (core ? 0.55 : 1),
      alpha: [core ? 0.95 : 0.7, 0], tint: core ? o.palette.core : o.palette.main }));
    if (heavy) {
      for (const core of [false, true]) g.add(w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true,
        x: aim.x, y: aim.y, life: 420, scale: [0.05, (o.slamRadius ?? h * 1.1) / M.ringRadius * (core ? 0.8 : 1), outCubic],
        alpha: [0.85, 0], tint: core ? o.palette.core : o.palette.main }));
      for (let j = 0; j < 10; j++) {
        const a = rand(0, Math.PI * 2), speed = rand(30, 100);
        g.add(w.spawn({ texture: tex.rock, blend: 'normal', x: aim.x, y: aim.y, z: 2,
          life: 520, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * w.groundSquash,
          vz: rand(45, 110), gravity: 320, scale: [rand(0.08, 0.18), 0],
          rotation: a, spin: rand(-4, 4), alpha: [0.65, 0], tint: o.palette.dark }));
      }
    }
    w.hitStop(heavy ? 65 : 28); w.shake(heavy ? 5 : 2, heavy ? 220 : 100);
    o.onStrike?.(i, { ...aim });
  };
  g.addHandle(w.addUpdater((dt) => {
    age += dt; lean = 0; lift = 0;
    if (!o.target || age < reveal || age >= end) return;
    if (age - dt <= reveal) {
      aim = { ...o.target() };
      const dx = aim.x - o.x, dy = aim.y - o.y, distance = Math.hypot(dx, dy);
      const travel = Math.max(0, distance - h * 0.45) / Math.max(1, distance);
      dest = { x: o.x + dx * travel, y: o.y + dy * travel, z: pos.z };
      facing = dx === 0 ? facing : Math.sign(dx);
    }
    const t = age - reveal;
    if (t < advance) {
      const p = t / advance;
      pos.x = lerp(o.x, dest.x, p); pos.y = lerp(o.y, dest.y, p);
      lift = Math.abs(Math.sin(p * Math.PI * 3)) * h * 0.035;
      lean = facing * (0.08 + Math.sin(p * Math.PI * 6) * 0.035);
      if (Math.floor(p * 3) !== step) { step = Math.floor(p * 3); dust(); }
      ghost -= dt;
      if (ghost <= 0 && body) { ghost = 110; g.add(afterimage(w, body.sprite, pos, { tint: o.palette.main, alpha: 0.13, life: 200 })); }
      return;
    }
    pos.x = dest.x; pos.y = dest.y;
    const i = Math.floor((t - advance) / cycle), phase = ((t - advance) % cycle) / cycle;
    if (i !== strike) {
      strike = i; aim = { ...o.target() };
      facing = aim.x === pos.x ? facing : Math.sign(aim.x - pos.x);
      g.add(w.spawn({ texture: tex.star, x: 0, y: 0, follow: () => ({ x: pos.x + facing * h * 0.38, y: pos.y, z: pos.z + h * 0.92 }),
        life: 220, scale: [0.05, 0.28], alpha: [0.1, 0.85], tint: o.palette.core, spin: 4, zBias: 24 }));
    }
    lean = facing * (phase < 0.36 ? -0.26 * phase / 0.36 : phase < 0.52 ? lerp(-0.26, 0.4, (phase - 0.36) / 0.16) : 0.4 * (1 - phase) / 0.48);
    if (i % 3 === 2 && phase < 0.5) lift = Math.sin(phase / 0.5 * Math.PI) * h * 0.25;
    if (phase >= 0.48 && hit < i) { hit = i; impact(i); }
  }));
  let body: ReturnType<VfxWorld['spawn']> = null;
  for (const rim of [false, true]) {
    const p = g.add(w.spawn({ texture: tex.guardian, blend: rim ? 'add' : 'normal',
      x: 0, y: 0, life: Infinity, anchorX: 88 / 192, anchorY: 244 / 256,
      follow: () => pos, scaleX: () => k * facing, scaleY: k,
      tint: o.palette.main, alpha: () => opacity() * (rim ? 0.065 : 0.85), zBias: rim ? 21 : 20,
      onUpdate: (q) => {
        q.pz = -h * 0.22 * (1 - clamp01(age / reveal)) + lift + Math.sin(age / 380) * h * 0.015;
        q.rotation = lean;
      },
    }));
    if (!rim) body = p;
  }
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, layer: 'ground', groundAligned: true, blend: 'normal', follow: () => pos,
    life: Infinity, scaleX: h / 180, scaleY: h / 300, tint: 0x101020, alpha: () => opacity() * 0.4 }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: () => pos, z: h * 0.5,
    life: Infinity, scaleX: h / 180, scaleY: h / 105, alpha: () => opacity() * 0.055, tint: o.palette.main, zBias: 19 }));
  g.addHandle(w.stream({ rate: 18, make: () => ({ texture: tex.dot,
    x: pos.x + rand(-0.28, 0.4) * h, y: pos.y, z: pos.z + rand(0, 0.9) * h,
    life: 400, vz: h * 0.45, scale: [0.065 * h / 100, 0], alpha: [0.45 * opacity(), 0], tint: o.palette.main, zBias: 22,
    onUpdate: (q) => { if (!g.alive) q.kill(); } }) }));
  return g;
}
