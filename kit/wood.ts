// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import type { Handle, Vec3, VfxWorld } from './vfx-world';
import { group } from './group';
import { clamp01, envelope, lerp, outCubic, pick, rand } from './ease';
import { woodTextures } from './wood-textures';

const TAU = Math.PI * 2;

function duration(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Wood duration must be finite and non-negative');
  return value;
}

export function woodCharge(w: VfxWorld, o: { target: () => Vec3; duration?: number; onDone?: () => void }): Handle {
  const dur = duration(o.duration ?? 300), t = woodTextures(), g = group(w, Infinity, undefined, 65);
  let age = 0;
  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    if (age >= dur) { g.stop(); o.onDone?.(); }
  }));
  g.add(w.spawn({ texture: t.halo, x: 0, y: 0, follow: o.target, life: Infinity, blend: 'add',
    scale: () => 0.65 + clamp01(age / Math.max(1, dur)) * 0.45, alpha: 0.65, zBias: 6 }));
  g.add(w.spawn({ texture: t.seed, x: 0, y: 0, follow: o.target, life: Infinity, blend: 'normal',
    scale: () => 0.3 + clamp01(age / Math.max(1, dur)) * 0.45, rotation: -0.5, spin: 0.6, zBias: 8 }));
  for (let i = 0; i < 7; i++) {
    const phase = i / 7 * TAU;
    g.add(w.spawn({ texture: t.leaves[i % 3], x: 0, y: 0, follow: o.target, life: Infinity, blend: 'normal',
      scale: 0.2 + i % 3 * 0.035, zBias: 7,
      onUpdate: (q) => {
        const u = clamp01(age / Math.max(1, dur)), a = phase + u * 2.2, r = 30 * (1 - u) + 4;
        q.px = Math.cos(a) * r; q.pz = Math.sin(a) * r * 0.65;
        q.rotation = a - 0.5; q.o.alpha = 1 - u * 0.55;
      } }));
  }
  return g;
}

export function seedFlight(w: VfxWorld, o: { from: Vec3; to: Vec3; speed?: number; onHit?: (at: Vec3) => void }): Handle {
  if (!Number.isFinite(o.speed ?? 620) || (o.speed ?? 620) <= 0) throw new RangeError('Seed speed must be positive and finite');
  const t = woodTextures(), pos = { ...o.from }, duration = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y) / (o.speed ?? 620) * 1000;
  let age = 0;
  const g = group(w, Infinity, undefined, 20);
  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    const u = clamp01(age / Math.max(1, duration));
    pos.x = lerp(o.from.x, o.to.x, u); pos.y = lerp(o.from.y, o.to.y, u);
    pos.z = lerp(o.from.z ?? 0, o.to.z ?? 0, u) + Math.sin(u * Math.PI) * 50;
    if (u === 1) { g.stop(); o.onHit?.({ ...pos }); }
  }));
  g.add(w.spawn({ texture: t.seed, x: 0, y: 0, follow: () => pos, life: Infinity,
    blend: 'normal', scale: 0.85, spin: 1.4, rotation: -0.2, zBias: 5 }));
  g.add(w.spawn({ texture: t.halo, x: 0, y: 0, follow: () => pos, life: Infinity,
    blend: 'add', scale: 0.85, alpha: 0.55, zBias: 4 }));
  g.addHandle(w.stream({ rate: 16, make: () => ({ texture: pick(t.leaves), ...pos, life: 380,
    blend: 'normal', scale: [rand(0.18, 0.28), 0.06], alpha: [0.95, 0], vx: rand(-35, -5), vz: -18,
    rotation: rand(0, TAU), spin: rand(-2, 2) }) }));
  return g;
}

export function springBloom(w: VfxWorld, o: { target: () => Vec3; radius?: number; duration?: number }): Handle {
  const dur = duration(o.duration ?? 2000), g = group(w, dur > 0 ? dur + 500 : 0);
  if (!dur) return g;
  const t = woodTextures(), r = o.radius ?? 58;
  const life = dur + 350, fade = envelope(0.13, 0.78, 1);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, d = r * rand(0.4, 1), x = Math.cos(a) * d, y = Math.sin(a) * d * w.groundSquash;
    const scale = rand(0.22, 0.38), delay = i * 25;
    g.add(w.spawn({ texture: t.grass, x, y, z: 0, follow: o.target, life, delay, anchorY: 1, blend: 'normal',
      scaleX: scale, scaleY: (u) => scale * clamp01(u * 7) * (1 - clamp01((u - 0.78) / 0.22) * 0.55), alpha: fade,
      rotation: rand(-0.15, 0.15), zBias: y }));
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4 + 0.5, d = r * rand(0.45, 0.95), x = Math.cos(a) * d, y = Math.sin(a) * d * w.groundSquash;
    const h = rand(24, 42), delay = i * 65, size = rand(0.23, 0.32), petal = t.petals[i % 3];
    const growth = (u: number) => outCubic(clamp01(u * life / 470));
    const bend = (u: number) => Math.sin(u * 6 + a) * 3 + clamp01((u - 0.8) * 5) * 9;
    g.add(w.spawn({ texture: t.stem, x, y, follow: o.target, life, delay, blend: 'normal', anchorX: 0,
      rotation: -Math.PI / 2, scaleX: (u) => h / 96 * growth(u), scaleY: 0.14, alpha: fade, zBias: y }));
    for (let j = 0; j < 2; j++) g.add(w.spawn({ texture: t.leaves[j], x, y, z: h * (0.3 + j * 0.22), follow: o.target,
      life, delay, anchorX: 0.08, blend: 'normal', rotation: j ? -2.6 : -0.5, scale: (u) => 0.22 * growth(u), alpha: fade, zBias: y + 1 }));
    for (let j = 0; j < 6; j++) {
      const angle = j / 6 * TAU;
      g.add(w.spawn({ texture: petal, x, y, follow: o.target, life, delay, blend: 'normal', anchorY: 0.95,
        alpha: fade, zBias: y + 2, scaleX: size * 0.3, scaleY: size * 0.45,
        onUpdate: (q, u) => {
          const open = outCubic(clamp01((u * life - 230 - j * 38) / 370));
          q.pz = h * growth(u); q.px = bend(u);
          q.o.scaleX = size * (0.3 + open * 0.7); q.o.scaleY = size * (0.45 + open * 0.55);
          q.rotation = angle * open + clamp01((u - 0.78) * 5) * 0.7;
        } }));
    }
    g.add(w.spawn({ texture: t.center, x, y, follow: o.target, life, delay, blend: 'normal', alpha: fade, zBias: y + 3,
      scale: (u) => 0.28 * clamp01((u * life - 430) / 300), onUpdate: (q, u) => { q.pz = h * growth(u); q.px = bend(u); } }));
  }
  for (let i = 0; i < 3; i++) g.add(w.spawn({ texture: t.shaft, x: (i - 1) * 25, y: 0, z: 53, follow: o.target,
    life: dur, blend: 'add', scaleX: 0.45, scaleY: 0.65, alpha: envelope(0.2, 0.7, 0.18), zBias: -8 }));
  g.addHandle(w.stream({ rate: 11, duration: dur - 200, make: () => ({ texture: t.spore, x: rand(-r, r), y: rand(-18, 18), z: 4,
    follow: o.target, life: 900, blend: 'normal', vz: rand(25, 50), vx: rand(-8, 8), scale: rand(0.12, 0.22),
    alpha: envelope(0.15, 0.7, 0.8), tint: 0xffe7a6 }) }));
  g.addHandle(w.stream({ rate: 7, duration: dur - 200, make: () => {
    const phase = rand(0, TAU);
    return { texture: pick([...t.petals, ...t.leaves]), x: rand(-r, r), y: rand(-18, 18), z: rand(95, 125), follow: o.target,
      life: 1250, blend: 'normal', vz: -65, vx: rand(-7, 7), scale: rand(0.12, 0.2), rotation: phase, spin: rand(-2, 2),
      alpha: envelope(0.1, 0.7, 0.9), onUpdate: (q, u) => { q.px = Math.sin(phase + u * 8) * 12; q.o.scaleX = 0.55 + Math.sin(phase + u * 10) * 0.4; } };
  } }));
  return g;
}

export function clingingSpores(w: VfxWorld, target: () => Vec3, height: number, duration: number): Handle {
  const t = woodTextures(), g = group(w, duration);
  g.addHandle(w.stream({ rate: 9, duration, make: () => {
    const phase = rand(0, TAU);
    return { texture: t.spore, x: rand(-16, 16), y: rand(-6, 6), z: rand(0.15, 0.85) * height, follow: target,
      life: 900, blend: 'normal', scale: rand(0.16, 0.25), vz: rand(3, 12), alpha: envelope(0.2, 0.6, 0.85),
      tint: pick([0xb9bf76, 0xcab88b, 0x9b8195]), zBias: 5,
      onUpdate: (q, u) => { q.px = Math.sin(phase + u * 9) * 4; q.py = Math.cos(phase + u * 7) * 2; } };
  } }));
  return g;
}

export function toxicSporeCloud(w: VfxWorld, o: { at: Vec3; radius?: number; duration?: number; onBloom?: () => void }): Handle {
  const dur = duration(o.duration ?? 2600), g = group(w, dur > 0 ? dur + 1800 : 0);
  if (!dur) return g;
  const t = woodTextures(), r = o.radius ?? 120;
  const c = o.at;
  g.add(w.spawn({ texture: t.moss, ...c, layer: 'ground', groundAligned: true, life: dur + 900,
    blend: 'normal', scale: r / 110, alpha: envelope(0.08, 0.8, 0.8) }));
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, d = r * rand(0.3, 0.7), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * w.groundSquash;
    const size = rand(0.3, 0.47);
    g.add(w.spawn({ texture: t.mushrooms[i % 2], x, y, z: c.z, anchorY: 1, life: dur + 700, delay: 220 + i * 40,
      blend: 'normal', scaleX: size, scaleY: (u) => size * outCubic(clamp01(u * 8)) * (1 - clamp01((u - 0.8) * 5) * 0.5),
      alpha: envelope(0.05, 0.85, 1), rotation: rand(-0.16, 0.16) }));
    g.addHandle(w.stream({ rate: 2.6, duration: dur, make: () => ({ texture: pick(t.clouds), x, y, z: (c.z ?? 0) + 75 * size,
      life: 1300, delay: 450, blend: 'normal', scale: [0.25, rand(1.3, 1.8), outCubic], alpha: envelope(0.2, 0.65, 0.72),
      tint: pick([0xa2ab62, 0x8c9559, 0x887285]), vz: rand(7, 16), vx: rand(-12, 12), vy: rand(-4, 4), spin: rand(-0.3, 0.3), rotation: rand(0, TAU) }) }));
  }
  g.addHandle(w.stream({ rate: 25, duration: dur, make: () => {
    const a = rand(0, TAU), d = Math.sqrt(rand(0, 1)) * r * 0.85, phase = rand(0, TAU);
    return { texture: t.spore, x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * w.groundSquash, z: (c.z ?? 0) + rand(8, 38),
      life: 1250, delay: 450, blend: 'normal', scale: rand(0.12, 0.23), alpha: envelope(0.15, 0.65, 0.9), vz: rand(3, 12), vx: rand(-7, 7),
      onUpdate: (q, u) => { q.px = Math.sin(phase + u * 9) * 5 + Math.sin(phase * 2 + u * 23) * 1.5; q.py = Math.cos(phase + u * 11) * 3; } };
  } }));
  g.addHandle(w.after(450, () => {
    try { o.onBloom?.(); } catch (error) { g.stop(); throw error; }
  }));
  return g;
}
