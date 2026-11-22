import type { Texture } from 'pixi.js';
import { clamp01, envelope, lerp, outCubic, rand } from './ease';
import { textureFromCanvas } from './pixi-compat';
import type { Palette } from './recipes';
import { type VfxTextures, TEX_METRICS as M } from './textures';
import type { Vec3, VfxWorld } from './vfx-world';

export function metalSparks(w: VfxWorld, tex: VfxTextures, at: Vec3, p: Palette, count: number, angle?: number, size = 1) {
  w.burst(count, () => {
    const a = angle === undefined ? rand(0, Math.PI * 2) : angle + rand(-0.9, 0.9);
    const speed = rand(125, 330) * size;
    return {
      ...at, texture: tex.streak, life: rand(105, 230), zBias: 5,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * w.groundSquash,
      vz: rand(35, 140) * size, gravity: 780, killOnGround: true, faceVelocity: true,
      scaleX: [rand(0.07, 0.22) * size, 0.016], scaleY: rand(0.07, 0.15) * size,
      alpha: [0.95, 0], tint: [p.core, p.main],
    };
  });
}

export function swordSalute(w: VfxWorld, tex: VfxTextures, at: () => Vec3, height: number, p: Palette, duration: number) {
  for (let i = -2; i <= 2; i++) {
    const delay = Math.abs(i) * 22;
    const life = duration - delay;
    w.spawn({
      texture: tex.blade, blend: 'normal', x: 0, y: 0, follow: at, rotation: Math.PI,
      life, delay, scale: height / 273, alpha: envelope(0.16, 0.2, 0.92), zBias: 8,
      onUpdate: (q, t) => {
        const origin = at(), spread = outCubic(clamp01(t * 2.9));
        const release = clamp01((t - 0.76) / 0.24);
        q.sprite.rotation = Math.PI + i * 0.29 * spread;
        q.sprite.position.set(origin.x + i * height * (0.31 * spread + 0.1 * release),
          origin.y - (origin.z ?? 0) - height * (0.6 + spread * 0.44 - Math.abs(i) * 0.1 + release ** 2));
      },
    });
  }
  w.spawn({ texture: tex.star, x: 0, y: 0, z: height, follow: at, delay: duration - 100, life: 150,
    scale: [0.1, 0.23], alpha: envelope(0.2, 0.65, 0.7), tint: p.core, zBias: 9 });
}

let cutTexture: Texture | undefined;
function metalCutTexture(): Texture {
  if (cutTexture) return cutTexture;
  const c = document.createElement('canvas');
  c.width = 320; c.height = 120;
  const ctx = c.getContext('2d')!;
  const face = ctx.createLinearGradient(136, 32, 167, 85);
  face.addColorStop(0, 'rgba(43,34,26,0)');
  face.addColorStop(0.35, '#635449');
  face.addColorStop(0.57, '#383542');
  face.addColorStop(0.82, '#a99168');
  face.addColorStop(1, '#f5cf7e');
  ctx.beginPath();
  ctx.moveTo(11, 34); ctx.bezierCurveTo(101, 75, 211, 83, 310, 24);
  ctx.bezierCurveTo(247, 100, 121, 112, 11, 34); ctx.closePath();
  ctx.fillStyle = face; ctx.fill();
  const edge = ctx.createLinearGradient(11, 0, 310, 0);
  edge.addColorStop(0, 'rgba(173,114,61,0)');
  edge.addColorStop(0.3, '#b87e45');
  edge.addColorStop(0.52, '#ffe9ab');
  edge.addColorStop(0.69, '#fffdf0');
  edge.addColorStop(0.86, '#edc57f');
  edge.addColorStop(1, '#fff4cf');
  ctx.strokeStyle = edge; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(11, 34); ctx.bezierCurveTo(121, 112, 247, 100, 310, 24); ctx.stroke();
  ctx.strokeStyle = 'rgba(249,224,171,0.46)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(58, 57); ctx.quadraticCurveTo(124, 89, 205, 75);
  ctx.moveTo(179, 82); ctx.quadraticCurveTo(221, 83, 276, 54);
  ctx.stroke();
  cutTexture = textureFromCanvas(c);
  return cutTexture;
}

/** An upright metal cut with a real sword following the edge of its wake. */
export function metalSlash(w: VfxWorld, tex: VfxTextures, at: Vec3,
  o: { angle: number; span: number; palette: Palette; reverse?: boolean }) {
  const { angle, span, palette: p } = o;
  const k = span / 320, dir = o.reverse ? -1 : 1;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  w.spawn({
    ...at, texture: metalCutTexture(), blend: 'normal', life: 415, rotation: angle, zBias: 15,
    scaleX: [k * 0.75, k * 1.03, outCubic], scaleY: [dir * k * 0.74, dir * k, outCubic],
    alpha: envelope(0.09, 0.64, 0.92),
  });
  w.spawn({
    ...at, texture: tex.blade, blend: 'normal', life: 158, zBias: 16,
    scale: span / 365, alpha: envelope(0.11, 0.32),
    onUpdate: (q, t) => {
      const u = outCubic(t), x = lerp(-span * 0.47, span * 0.48, u);
      const y = (Math.sin(u * Math.PI) * 33 - 24) * k * dir;
      q.sprite.position.set(at.x + x * cos - y * sin, at.y - (at.z ?? 0) + x * sin + y * cos);
      q.sprite.rotation = angle - Math.PI / 2 + dir * lerp(-0.9, 0.53, u);
    },
  });
  w.spawn({
    ...at, texture: tex.streak, life: 160, delay: 35, rotation: angle,
    scaleX: [span / M.streakLength * 0.62, 0.1], scaleY: [0.26, 0.06],
    alpha: [0.55, 0], tint: p.core, zBias: 16,
  });
}
