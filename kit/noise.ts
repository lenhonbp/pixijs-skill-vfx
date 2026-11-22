// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Smooth 2D/3D value noise and curl noise for organic, divergence-free particle motion
// (wind, smoke, spores, magic wisps). Curl noise swirls without clumping or draining.
import type { Particle } from './vfx-world';

const PERM = new Uint8Array(512);
(() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const hash = (x: number, y: number, z: number) => PERM[PERM[PERM[x & 255] + (y & 255)] + (z & 255)] / 255;

/** Smooth value noise in [-1, 1]. */
export function noise3(x: number, y: number, z = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  const n = l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
  return n * 2 - 1;
}

/** Curl of a noise potential at (x, y) and time t: a swirling, divergence-free 2D flow (unit-ish length). */
export function curl2(x: number, y: number, t = 0, out = { x: 0, y: 0 }) {
  const e = 0.01;
  const dndy = (noise3(x, y + e, t) - noise3(x, y - e, t)) / (2 * e);
  const dndx = (noise3(x + e, y, t) - noise3(x - e, y, t)) / (2 * e);
  out.x = dndy * 0.5;
  out.y = -dndx * 0.5;
  return out;
}

/**
 * `onUpdate` for SpawnOptions: pushes a particle along a curl-noise flow.
 * `strength` in px/s, `scale` = feature size in px (bigger = broader swirls).
 * Moves on the screen plane (x and z), which reads best for wisps and smoke in 2.5D.
 */
export function curlDrift(strength = 60, scale = 90, speed = 0.6) {
  const v = { x: 0, y: 0 };
  return (p: Particle, _t: number, dt: number) => {
    curl2(p.x / scale, (p.y - p.z) / scale, p.age * 0.001 * speed, v);
    p.px += v.x * strength * dt;
    p.pz -= v.y * strength * dt;
  };
}
