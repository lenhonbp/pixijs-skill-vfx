// Signature element effects (Wu Xing) that need their own shapes: spikes, sword rain.
import type { VfxWorld, Vec3 } from './vfx-world';
import { VfxTextures, TEX_METRICS as M } from './textures';
import type { Palette } from './recipes';
import { WUXING, litFlip } from './elements';
import { envelope, lerpColor, outBack, outCubic, outQuad, rand } from './ease';

const TAU = Math.PI * 2;

/** One spike erupting from the ground: rises, holds, sinks. Rock (earth) or ice (water). */
export function spike(w: VfxWorld, tex: VfxTextures, o: Vec3 & { palette: Palette; height?: number; width?: number; life?: number; ice?: boolean }) {
  const h = o.height ?? 90;
  const life = o.life ?? 900;
  const flip = litFlip(w);
  const p = o.palette;
  const rise = (t: number) => {
    const a = t * life;
    return a < 120 ? outBack(a / 120) : a > life - 220 ? Math.max(0, (life - a) / 220) : 1;
  };
  w.spawn({
    texture: tex.spike, blend: 'normal', x: o.x, y: o.y, life, anchorY: 1, rotation: rand(-0.12, 0.12),
    scaleX: flip * ((o.width ?? 1) * h * 0.5) / 64, scaleY: (t) => (h / M.spikeHeight) * rise(t),
    alpha: o.ice ? 0.85 : 1, tint: o.ice ? lerpColor(p.core, p.main, 0.35) : lerpColor(p.main, p.dark, 0.35),
  });
  if (o.ice) w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: h * 0.5, life, zBias: 1, scaleX: 0.25, scaleY: h / 70, alpha: (t) => 0.08 * rise(t), tint: p.main });
  w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, blend: 'normal', x: o.x, y: o.y, life: life + 400, scale: h / 70, alpha: envelope(0.05, 0.5, 0.5), tint: o.ice ? p.dark : 0x1a1008 });
  w.burst(o.ice ? 5 : 7, () => {
    const a = rand(0, TAU), sp = rand(60, 180);
    return {
      texture: o.ice ? tex.shard : tex.rock, blend: 'normal', x: o.x, y: o.y, z: 6, life: rand(500, 800), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash,
      vz: rand(150, 330), gravity: 1200, bounce: 0.3, rotation: rand(0, TAU), spin: rand(-10, 10), scale: rand(0.15, 0.3), tint: o.ice ? p.core : 0x8a7458,
    };
  });
  w.burst(4, () => {
    const a = rand(0, TAU), sp = rand(20, 70);
    return { texture: tex.puff, blend: 'normal', x: o.x, y: o.y, z: 4, life: 700, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: 20, drag: 2, scale: [0.4, o.ice ? 0.65 : 0.9, outCubic], alpha: envelope(0.1, o.ice ? 0.5 : 0.35, o.ice ? 0.12 : 0.5), tint: o.ice ? p.main : 0xb8a080 };
  });
}

/** A line of spikes erupting one after another along ground angle `angle` (earth fissure, ice path). */
export function spikeLine(
  w: VfxWorld,
  tex: VfxTextures,
  o: { from: Vec3; angle: number; palette?: Palette; count?: number; spacing?: number; intervalMs?: number; height?: number; ice?: boolean; onSpike?: (at: Vec3, i: number) => void },
) {
  const p = o.palette ?? (o.ice ? WUXING.thuy.palette : WUXING.tho.palette);
  const n = o.count ?? 7;
  const sp = o.spacing ?? 42;
  for (let i = 0; i < n; i++) {
    w.after(i * (o.intervalMs ?? 65), () => {
      const d = (i + 1) * sp;
      const at = { x: o.from.x + Math.cos(o.angle) * d, y: o.from.y + Math.sin(o.angle) * d * w.groundSquash, z: 0 };
      const h = (o.height ?? 80) * (0.75 + 0.5 * (i / n));
      spike(w, tex, { ...at, palette: p, height: h, ice: o.ice });
      for (const side of [-1, 1]) {
        const ox = -Math.sin(o.angle) * side * rand(14, 22), oy = Math.cos(o.angle) * side * rand(8, 12);
        spike(w, tex, { x: at.x + ox, y: at.y + oy, palette: p, height: h * rand(0.35, 0.55), ice: o.ice, life: 800 });
      }
      w.shake(o.ice ? 2 : 4, 120);
      o.onSpike?.(at, i);
    });
  }
}

/** Ring of spikes bursting outward from a center (frost nova, earth prison). */
export function spikeRing(w: VfxWorld, tex: VfxTextures, o: { x: number; y: number; radius?: number; count?: number; palette?: Palette; height?: number; ice?: boolean }) {
  const p = o.palette ?? (o.ice ? WUXING.thuy.palette : WUXING.tho.palette);
  const n = o.count ?? 12;
  const r = o.radius ?? 90;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(-0.1, 0.1);
    const delay = (i % 2) * 40;
    w.after(delay, () => spike(w, tex, { x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r * w.groundSquash, palette: p, height: (o.height ?? 70) * rand(0.7, 1.1), ice: o.ice }));
  }
}

/** Swords of light fall from the sky across an area and stick in the ground (metal). */
export function swordRain(
  w: VfxWorld,
  tex: VfxTextures,
  o: { x: number; y: number; radius?: number; count?: number; duration?: number; palette?: Palette; onImpact?: (at: Vec3) => void },
) {
  const p = o.palette ?? WUXING.kim.palette;
  const r = o.radius ?? 100;
  const n = o.count ?? 14;
  const dur = o.duration ?? 900;
  const g = { layer: 'ground', groundAligned: true, x: o.x, y: o.y } as const;
  w.spawn({ ...g, texture: tex.ring, life: dur + 500, scale: (r * 1.05) / M.ringRadius, alpha: envelope(0.1, 0.8, 0.4), tint: p.main });
  w.spawn({ ...g, texture: tex.glow, life: dur + 500, scale: r / 40, alpha: envelope(0.1, 0.25, 0.4), tint: p.main });
  const fall = 150;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * dur + rand(-30, 30);
    const a = rand(0, TAU), d = Math.sqrt(Math.random()) * r * 0.9;
    const x = o.x + Math.cos(a) * d, y = o.y + Math.sin(a) * d * w.groundSquash;
    const tilt = rand(-0.18, 0.18);
    const k = rand(0.5, 0.65);
    w.after(Math.max(0, t0), () => {
      const z0 = 380;
      w.spawn({ texture: tex.blade, blend: 'normal', x, y, z: z0, vz: -z0 / (fall / 1000), life: fall, anchorY: 1, rotation: tilt, scale: k, tint: 0xf4f0e6 });
      w.spawn({ texture: tex.streak, x, y, z: z0 + 45 * k, vz: -z0 / (fall / 1000), life: fall, anchorX: 1, rotation: Math.PI / 2 + tilt, scaleX: 0.5, scaleY: 0.25, alpha: [0.2, 0.6], tint: p.main });
    });
    w.after(Math.max(0, t0) + fall, () => {
      const life = dur - t0 + 600;
      w.spawn({ texture: tex.blade, blend: 'normal', x, y, z: -6, life, anchorY: 1, rotation: tilt, scale: k, alpha: ms3(life), tint: 0xf4f0e6 });
      w.spawn({ texture: tex.blade, x, y, z: -6, life: 260, anchorY: 1, rotation: tilt, scale: k, alpha: [0.9, 0, outQuad], tint: p.main, zBias: 1 });
      w.spawn({ texture: tex.star, x, y, z: 4, life: 200, zBias: 2, rotation: rand(0, TAU), scale: [0.8, 0], tint: p.core });
      w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true, x, y, life: 260, scale: [0.02, 0.12, outCubic], alpha: [0.9, 0], tint: p.main });
      w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, blend: 'normal', x, y, life: life + 200, scale: 0.35, alpha: envelope(0.05, 0.5, 0.4), tint: 0x1a1408 });
      w.burst(5, () => {
        const b = rand(0, TAU), sp = rand(150, 320);
        return { texture: tex.streak, x, y, z: 4, life: rand(150, 260), vx: Math.cos(b) * sp, vy: Math.sin(b) * sp * w.groundSquash, vz: rand(100, 250), gravity: 900, faceVelocity: true, scaleX: [0.35, 0.05], scaleY: 0.35, tint: [p.core, p.main] };
      });
      w.shake(2.5, 90);
      o.onImpact?.({ x, y, z: 0 });
    });
  }
}

function ms3(life: number) {
  return (t: number) => (t * life > life - 250 ? Math.max(0, (life - t * life) / 250) : 1);
}
