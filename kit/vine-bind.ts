// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import type { Handle, Particle, VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import type { OnUnit } from './status';
import type { Palette } from './recipes';
import { WUXING } from './elements';
import { group } from './group';
import { clamp01, lerpColor, rand } from './ease';
import { woodTextures } from './wood-textures';

export interface VineBindHandle extends Handle {
  /** Squeeze the coils in sync with a gameplay damage tick. */
  pulse(): void;
}

/** Tapered vines grow from the feet and coil around the unit in depth. */
export function vineBind(w: VfxWorld, tex: VfxTextures,
  o: OnUnit & { palette?: Palette; duration?: number }): VineBindHandle {
  const h = o.height ?? 70, s = h / 70, dur = o.duration ?? 2500, p = o.palette ?? WUXING.moc.palette, wood = woodTextures();
  let age = 0, pulseAge = Infinity;
  const parts: Particle[] = [];
  const g = group(w, dur, () => {
    for (const q of parts) {
      q.o.tint = 0x795333;
      q.o.scale = 1;
      q.o.scaleX = q.sprite.scale.x; q.o.scaleY = q.sprite.scale.y;
      q.rotation = q.sprite.rotation;
    }
    const at = o.target();
    w.burst(16, (i) => ({ texture: i % 2 ? wood.leaves[i % 3] : tex.rock, blend: 'normal',
      x: at.x + rand(-18, 18) * s, y: at.y, z: (at.z ?? 0) + rand(0.05, 0.8) * h,
      life: 750, vx: rand(-35, 35) * s, vz: rand(10, 40) * s, gravity: 230 * s,
      rotation: rand(0, 6.3), spin: rand(-5, 5), scale: [rand(0.12, 0.22) * s, 0],
      alpha: [0.85, 0], tint: 0x795333 }));
  }, 280);
  g.addHandle(w.addUpdater((dt) => { age += dt; pulseAge += dt; }));
  const tint = (u: number) => lerpColor(lerpColor(0xc1a27c, 0xe4f3b9, u), 0x795333, clamp01((age - dur + 320) / 320));
  const squeeze = () => Number.isFinite(pulseAge) && pulseAge < 300 ? Math.sin(pulseAge / 300 * Math.PI) * 0.2 : 0;
  const point = (u: number, vine: number) => {
    const a = u * Math.PI * (2.7 + vine * 0.2) + vine * 2.3 + Math.sin(u * 7 + vine) * 0.38;
    const r = h * (0.26 + Math.sin(u * 9 + vine * 2) * 0.045) * (1 - squeeze()) * (1 - u * 0.38);
    return { x: Math.cos(a) * r, depth: Math.sin(a) * r * 0.4, z: (u * 0.85 + Math.sin(u * 5 + vine) * u * 0.04) * h };
  };
  for (let vine = 0; vine < 3; vine++) {
    for (let j = 0; j < 20; j++) {
      const u = j / 20, v = (j + 1) / 20;
      const q = g.add(w.spawn({ texture: wood.stem, blend: 'normal', x: 0, y: 0, follow: o.target,
        life: Infinity, tint: tint(u), scaleX: 0, scaleY: 0.3 * s, zBias: 8,
        onUpdate: (q) => {
          const a = point(u, vine), b = point(v, vine);
          const growth = clamp01((age - u * 460 - vine * 55) / 170);
          const dx = b.x - a.x, dy = b.depth - b.z - a.depth + a.z;
          q.px = (a.x + b.x) / 2; q.py = (a.depth + b.depth) / 2; q.pz = (a.z + b.z) / 2;
          q.rotation = Math.atan2(dy, dx);
          q.o.scaleX = (Math.hypot(dx, dy) + 1.5 * s) / 96 * growth;
          q.o.scaleY = 0.3 * s * growth * (1 - u * 0.85);
          q.o.tint = tint(u);
          q.o.zBias = q.py >= 0 ? 8 : -8;
          const at = o.target();
          q.sprite.position.set(at.x + q.px, at.y - (at.z ?? 0) + q.py - q.pz);
          q.sprite.scale.set(q.o.scaleX as number, q.o.scaleY as number);
          q.sprite.rotation = q.rotation; q.sprite.tint = q.o.tint;
          q.sprite.zIndex = at.y + q.o.zBias;
        },
      }));
      if (q) parts.push(q);
    }
    for (const u of [0.18, 0.37, 0.57, 0.76, 0.94]) {
      const size = rand(0.16, 0.3) * s, angle = rand(-0.7, 0.7) + (u < 0.5 ? 0 : Math.PI);
      const q = g.add(w.spawn({ texture: wood.leaves[vine], blend: 'normal', x: 0, y: 0, follow: o.target,
        life: Infinity, scale: 0, tint: tint(u), anchorX: 0.05,
        onUpdate: (q) => {
          const a = point(u, vine), growth = clamp01((age - u * 460 - vine * 55 - 140) / 240);
          q.px = a.x; q.py = a.depth; q.pz = a.z;
          q.o.zBias = a.depth >= 0 ? 9 : -9;
          q.o.scale = size * growth; q.rotation = angle + Math.sin(age * 0.003 + vine + u * 5) * 0.12;
          q.o.tint = lerpColor(0xe0e9c3, 0x795333, clamp01((age - dur + 320) / 320));
          const at = o.target();
          q.sprite.position.set(at.x + a.x, at.y - (at.z ?? 0) + a.depth - a.z);
          q.sprite.scale.set(q.o.scale); q.sprite.rotation = q.rotation; q.sprite.tint = q.o.tint;
          q.sprite.zIndex = at.y + q.o.zBias;
        },
      }));
      if (q) parts.push(q);
    }
    const u = 0.4 + vine * 0.12;
    g.add(w.spawn({ texture: wood.thorn, blend: 'normal', x: 0, y: 0, follow: o.target, life: Infinity, scale: 0.16 * s, alpha: 0,
      onUpdate: (q) => { const a = point(u, vine); q.px = a.x; q.py = a.depth; q.pz = a.z;
        q.o.alpha = clamp01((age - 600) / 200); q.o.tint = tint(u); q.rotation = vine * 2; } }));
  }
  for (let branch = 0; branch < 2; branch++) for (let j = 0; j < 7; j++) {
    const tip = (u: number) => {
      const a = point(0.66, branch), angle = u * Math.PI * 1.7;
      return { x: a.x + (branch ? -1 : 1) * (Math.sin(angle) * 11 + u * 8) * s,
        depth: a.depth, z: a.z + (u * 28 + (1 - Math.cos(angle)) * 8) * s };
    };
    g.add(w.spawn({ texture: wood.stem, blend: 'normal', x: 0, y: 0, follow: o.target, life: Infinity, scaleX: 0,
      onUpdate: (q) => {
        const a = tip(j / 7), b = tip((j + 1) / 7), growth = clamp01((age - 500 - j * 40) / 140);
        q.px = (a.x + b.x) / 2; q.py = a.depth; q.pz = (a.z + b.z) / 2;
        q.rotation = Math.atan2(a.z - b.z, b.x - a.x);
        q.o.scaleX = (Math.hypot(b.x - a.x, b.z - a.z) + 1) / 96 * growth;
        q.o.scaleY = (0.13 - j * 0.016) * s * growth;
        q.o.tint = tint(0.7 + j * 0.04);
      } }));
  }
  const at = o.target();
  g.add(w.spawn({ texture: wood.soil, ...at, layer: 'ground', groundAligned: true, blend: 'normal', life: dur,
    scale: [0.12 * s, 0.7 * s], alpha: [0.8, 0.2] }));
  w.burst(10, () => ({ texture: tex.rock, blend: 'normal', x: at.x + rand(-18, 18) * s, y: at.y,
    z: at.z ?? 0, life: 500, vx: rand(-45, 45), vz: rand(40, 100), gravity: 400,
    scale: [0.17 * s, 0], tint: 0x6d513b }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, z: h * 0.4, follow: o.target,
    life: Infinity, scale: 0.7 * s, alpha: () => squeeze() * 0.15, tint: p.main, zBias: -9 }));
  return {
    get alive() { return g.alive; },
    stop: () => g.stop(),
    pulse() { if (g.alive) pulseAge = 0; },
  };
}
