import type { Texture } from 'pixi.js';
import { clamp01, envelope, inOutSine, inQuad, lerp, outBack, outCubic, rand } from './ease';
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

export function swordSalute(w: VfxWorld, tex: VfxTextures, at: () => Vec3, height: number, p: Palette, duration: number, aimAt?: () => Vec3) {
  if (duration <= 0 || height <= 0) return;
  for (let i = -2; i <= 2; i++) {
    const delay = duration * Math.abs(i) * (i < 0 ? 0.065 : 0.047);
    const life = duration - delay;
    const phase = i * 1.38 + rand(-0.24, 0.24);
    const launchAt = 0.8 + Math.abs(i) * 0.024;
    const scale = height / 273;
    const pose = (t: number) => {
      const origin = at(), target = aimAt?.();
      const aim = target ? Math.atan2(target.y - origin.y, target.x - origin.x) : 0;
      const dx = target ? Math.cos(aim) : 0, dy = target ? Math.sin(aim) : 0;
      const riseT = clamp01(t * life / (duration * 0.36));
      const rise = outBack(riseT);
      const age = (t * life + delay) / duration;
      const oscillation = age * 9.6 + phase;
      const gather = inOutSine(clamp01((age - 0.62) / 0.19));
      const launch = inQuad(clamp01((age - launchAt) / (1 - launchAt)));
      const float = outCubic(riseT) * (1 - gather * 0.8);
      const spread = i * (0.12 + 0.2 * rise - 0.1 * gather);
      const lift = 0.16 + rise * (0.95 - Math.abs(i) * 0.075) + Math.sin(oscillation) * 0.11 * float;
      const stagger = gather * (0.085 + i * dx * 0.065);
      const travel = launch * 3.15;
      const x = origin.x + height * (-dx * 0.23 + spread + Math.cos(oscillation) * 0.046 * float + dx * travel);
      const y = origin.y + height * (-0.1 + 0.022 * i + dy * travel);
      const z = (origin.z ?? 0) + height * (lift - stagger + launch * 1.7);
      const hoverAngle = -Math.PI + i * (0.09 + 0.19 * rise) + Math.sin(oscillation + 0.6) * 0.145 * float;
      const launchAngle = Math.atan2(dy * 3.15 - 1.7, dx * 3.15) - Math.PI / 2;
      const turn = Math.atan2(Math.sin(launchAngle - hoverAngle), Math.cos(launchAngle - hoverAngle));
      return { x, y, z, rotation: hoverAngle + turn * gather, roll: 1 - 0.17 * Math.cos(oscillation) * float };
    };
    const alpha = envelope(0.18, 0.14, 0.96);
    w.spawn({
      texture: tex.blade, blend: 'normal', x: 0, y: 0, life, delay, scale, alpha,
      onUpdate: (q, t) => {
        const { x, y, z, rotation, roll } = pose(t);
        q.sprite.position.set(x, y - z);
        q.sprite.zIndex = y;
        q.sprite.rotation = rotation;
        q.sprite.scale.x = scale * roll;
      },
    });
    w.spawn({
      texture: tex.glow, blend: 'normal', layer: 'ground', groundAligned: true,
      x: 0, y: 0, life, delay, alpha: 0, tint: 0x100d17,
      onUpdate: (q, t) => {
        const sword = pose(t), shadow = w.shadowPoint(sword);
        const softness = clamp01(sword.z / (height * 2.7));
        const size = (height / 128) * lerp(0.39, 0.65, softness);
        q.sprite.position.set(shadow.x, shadow.y);
        q.sprite.scale.set(size, size * w.groundSquash * 0.8);
        q.sprite.alpha = alpha(t) * lerp(0.56, 0.15, softness);
      },
    });
  }
  w.spawn({ texture: tex.star, x: -height * 0.16, y: 0, z: height * 1.02, follow: at, delay: duration * 0.72, life: duration * 0.23,
    scaleX: [0.06, 0.24], scaleY: [0.04, 0.07], alpha: envelope(0.32, 0.68, 0.55), tint: p.core, zBias: 9 });
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
