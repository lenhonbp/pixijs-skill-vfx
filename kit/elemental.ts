// Signature element effects (Wu Xing) that need their own shapes: spikes, sword rain.
import type { VfxWorld, Vec3 } from './vfx-world';
import { VfxTextures, TEX_METRICS as M } from './textures';
import type { Palette } from './recipes';
import { WUXING, litFlip } from './elements';
import { random, envelope, inQuad, lerp, lerpColor, outBack, outCubic, outQuad, rand } from './ease';
import { metalSparks } from './metal';

const TAU = Math.PI * 2;

/** Natural rock color carrying a hint of the palette, for grey baked stone textures (rock, rockSpike, mountain, rockPlate). */
export function stoneTint(p: Palette, k = 0.32): number {
  return lerpColor(0xd8d2c8, p.main, k);
}

/** Dust color for an earth palette: dry soil, not glow. */
export function dustTint(p: Palette): number {
  return lerpColor(0x8a7d6c, p.main, 0.2);
}

/** One spike erupting from the ground: rises, holds, sinks. Rock (earth) or ice (water).
 *  `lean` tilts it (radians, + = right); `fx: false` skips debris and dust for cheap side spikes. */
export function spike(w: VfxWorld, tex: VfxTextures, o: Vec3 & { palette: Palette; height?: number; width?: number; life?: number; ice?: boolean; lean?: number; fx?: boolean }) {
  const h = o.height ?? 90;
  const life = o.life ?? 900;
  const flip = litFlip(w);
  const p = o.palette;
  const rise = (t: number) => {
    const a = t * life;
    return a < 120 ? outBack(a / 120) : a > life - 220 ? Math.max(0, (life - a) / 220) : 1;
  };
  if (o.ice) {
    w.spawn({
      texture: tex.spike, blend: 'normal', x: o.x, y: o.y, life, anchorY: 1, rotation: o.lean ?? rand(-0.12, 0.12),
      scaleX: flip * ((o.width ?? 1) * h * 0.5) / 64, scaleY: (t) => (h / M.spikeHeight) * rise(t),
      alpha: 0.85, tint: lerpColor(p.core, p.main, 0.35),
    });
    w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: h * 0.5, life, zBias: 1, scaleX: 0.25, scaleY: h / 70, alpha: (t) => 0.08 * rise(t), tint: p.main });
    w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, blend: 'normal', x: o.x, y: o.y, life: life + 400, scale: h / 70, alpha: envelope(0.05, 0.5, 0.5), tint: p.dark });
    if (o.fx === false) return;
    w.burst(2, () => {
      const a = rand(0, TAU), sp = rand(60, 180);
      return {
        texture: tex.shard, blend: 'normal', x: o.x, y: o.y, z: 6, life: rand(280, 440), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash,
        vz: rand(150, 330), gravity: 1200, bounce: 0.3, rotation: rand(0, TAU), spin: rand(-10, 10), scale: rand(0.25, 0.45), tint: p.core,
      };
    });
    w.burst(1, () => {
      const a = rand(0, TAU), sp = rand(20, 70);
      return { texture: tex.puff, blend: 'normal', x: o.x, y: o.y, z: 4, life: 350, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: 20, drag: 2, scale: [0.65, 1.15, outCubic], alpha: envelope(0.1, 0.5, 0.17), tint: p.main };
    });
    return;
  }
  // Rock: punches up with a little overshoot and ground heave, holds, then sinks back through its own rubble.
  const stone = lerpColor(stoneTint(p), p.dark, rand(0.12, 0.35)), dust = dustTint(p);
  const sink = (t: number) => {
    const a = t * life;
    return a < 110 ? outBack(a / 110) : a > life - 260 ? Math.max(0, (life - a) / 260) ** 0.7 : 1;
  };
  w.spawn({
    texture: tex.rockSpike, blend: 'normal', x: o.x, y: o.y, life, anchorY: 1, rotation: o.lean ?? rand(-0.1, 0.1),
    scaleX: flip * ((o.width ?? 1) * h * 0.55) / 64 * (random() < 0.5 ? 1 : 0.85), scaleY: (t) => (h / M.spikeHeight) * sink(t),
    tint: stone,
  });
  w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, blend: 'normal', x: o.x, y: o.y, life: life + 300, scale: h / 85, alpha: envelope(0.04, 0.45, 0.6), tint: 0x140d06 });
  if (o.fx === false) return;
  w.spawn({ texture: tex.fissure, layer: 'ground', groundAligned: true, blend: 'normal', x: o.x, y: o.y, life: life + 900, rotation: rand(0, TAU),
    scaleX: h / 220, scaleY: h / 110, alpha: envelope(0.03, 0.4, 0.85), tint: stone });
  w.burst(5, () => {
    const a = rand(0, TAU), sp = rand(50, 160);
    return {
      texture: tex.rock, blend: 'normal', x: o.x, y: o.y, z: 6, life: rand(650, 950), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash,
      vz: rand(160, 340), gravity: 1300, bounce: 0.25, drag: 0.6, rotation: rand(0, TAU), spin: rand(-9, 9), scale: rand(0.14, 0.3),
      alpha: envelope(0, 0.25), tint: lerpColor(stone, 0x6a5a48, rand(0, 0.5)),
    };
  });
  w.burst(3, () => {
    const a = rand(0, TAU), sp = rand(25, 70);
    return { texture: tex.puff, blend: 'normal', x: o.x + rand(-8, 8), y: o.y, z: rand(4, h * 0.3), life: rand(900, 1300), zBias: 3,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(14, 34), drag: 1.6, rotation: rand(0, TAU), spin: rand(-0.6, 0.6),
      scale: [0.35, rand(0.9, 1.2), outCubic], alpha: envelope(0.08, 0.6, 0.38), tint: lerpColor(dust, 0x5a4e40, rand(0, 0.4)) };
  });
  // crumble: chips fall off the top as it sinks
  w.after(life - 260, () => w.burst(3, () => ({
    texture: tex.rock, blend: 'normal', x: o.x + rand(-h * 0.12, h * 0.12), y: o.y, z: h * rand(0.35, 0.8), life: rand(450, 650),
    vx: rand(-40, 40), vz: rand(10, 70), gravity: 1100, bounce: 0.2, rotation: rand(0, TAU), spin: rand(-6, 6), scale: rand(0.12, 0.22),
    alpha: envelope(0, 0.3), tint: stone,
  })));
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
  const along = (d: number) => ({ x: o.from.x + Math.cos(o.angle) * d, y: o.from.y + Math.sin(o.angle) * d * w.groundSquash, z: 0 });
  for (let i = 0; i < n; i++) {
    w.after(i * (o.intervalMs ?? 65), () => {
      const d = (i + 1) * sp;
      const at = along(d);
      const h = (o.height ?? 80) * (0.75 + 0.5 * (i / n));
      if (!o.ice) {
        // the ground tears open ahead of each spike
        const seg = along(d - sp * 0.5);
        w.spawn({ texture: tex.fissure, layer: 'ground', groundAligned: true, blend: 'normal', ...seg, life: 1900 - i * 40,
          rotation: o.angle + rand(-0.08, 0.08), scaleX: [sp * 0.6 / 256, sp * 1.25 / 256, outCubic], scaleY: [0.4, 0.9 + i / n * 0.5, outCubic],
          alpha: envelope(0.02, 0.35, 0.9), tint: stoneTint(p) });
      }
      spike(w, tex, { ...at, palette: p, height: h, ice: o.ice });
      for (const side of [-1, 1]) {
        const ox = -Math.sin(o.angle) * side * rand(14, 22), oy = Math.cos(o.angle) * side * rand(8, 12);
        spike(w, tex, { x: at.x + ox, y: at.y + oy, palette: p, height: h * rand(0.35, 0.55), ice: o.ice, life: 800,
          ...(o.ice ? {} : { lean: Math.sign(ox || side) * rand(0.18, 0.38), fx: false }) });
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

/** Steel swords fall across an area and stick in the ground. */
export function swordRain(
  w: VfxWorld,
  tex: VfxTextures,
  o: { x: number; y: number; radius?: number; count?: number; duration?: number; height?: number; palette?: Palette; onImpact?: (at: Vec3) => void },
) {
  const p = o.palette ?? WUXING.kim.palette;
  const r = o.radius ?? 100;
  const n = o.count ?? 14, dur = o.duration ?? 900, height = o.height ?? 70;
  const fall = 150;
  w.spawn({ layer: 'ground', groundAligned: true, x: o.x, y: o.y,
    texture: tex.ring, life: dur + 380, scale: r / M.ringRadius, alpha: envelope(0.08, 0.43, 0.31), tint: p.main });
  const visualCount = n + Math.round(n * 0.5 * w.density);
  for (let i = 0; i < visualCount; i++) {
    const t0 = Math.max(0, ((i % n) / n) * dur + rand(-30, 30));
    const a = rand(0, TAU), d = Math.sqrt(random()) * r * 0.9;
    const x = o.x + Math.cos(a) * d, y = o.y + Math.sin(a) * d * w.groundSquash;
    const tilt = rand(-0.25, 0.25), length = height * rand(0.88, 1.14);
    const k = length / 160, z0 = height * 3.55;
    const blade = { texture: tex.blade, blend: 'normal', x, y, anchorY: 1, rotation: tilt, scale: k } as const;
    w.after(t0, () => {
      w.spawn({ texture: tex.puff, layer: 'ground', groundAligned: true, blend: 'normal', x, y,
        life: fall, scale: [0.31, 0.14, inQuad], alpha: [0.1, 0.72, inQuad], tint: 0x17131b });
      w.spawn({ ...blade, life: fall, onUpdate: (q, t) => {
        const z = z0 * (1 - inQuad(t));
        q.sprite.position.set(x + Math.sin(tilt) * z, y - z);
        q.sprite.scale.x = k * lerp(0.6, 1, t);
      } });
      w.spawn({ texture: tex.streak, x, y, life: fall, anchorX: 1, rotation: Math.PI / 2 + tilt,
        scaleX: [0.12, 0.68, inQuad], scaleY: [0.2, 0.52], alpha: envelope(0.22, 0.22, 0.52),
        tint: lerpColor(p.main, 0xc5def3, 0.68), onUpdate: (q, t) => {
          const z = z0 * (1 - inQuad(t)) + length * 0.48;
          q.sprite.position.set(x + Math.sin(tilt) * z, y - z);
        },
      });
    });
    w.after(t0 + fall, () => {
      const life = rand(760, 930);
      const phase = rand(0, TAU);
      w.spawn({ ...blade, z: -5, life, alpha: envelope(0, 0.28),
        onUpdate: (q, t) => {
          q.sprite.rotation = tilt + Math.sin(t * 43) * Math.exp(-t * 25) * 0.12;
          q.sprite.scale.x = k * (0.94 + Math.cos(phase + t * 9) * Math.exp(-t * 8) * 0.09);
        },
      });
      w.spawn({ texture: tex.swordCrack, layer: 'ground', groundAligned: true, blend: 'normal', x, y,
        life, rotation: rand(0, TAU), scale: rand(0.57, 0.85), alpha: envelope(0, 0.3, 0.89) });
      if (i < n) {
        w.spawn({ texture: tex.puff, layer: 'ground', blend: 'normal', groundAligned: true, x, y, life: 260,
          scale: [0.12, 0.37, outCubic], alpha: [0.38, 0], tint: 0x8e7c68 });
        w.spawn({ texture: tex.star, x, y, z: 3, life: 110, rotation: rand(-0.5, 0.5), zBias: 2,
          scaleX: [0.18, 0.03], scaleY: [0.09, 0.02], alpha: [0.85, 0], tint: p.core });
        w.shake(2.5, 90);
        o.onImpact?.({ x, y, z: 0 });
      }
      metalSparks(w, tex, { x, y, z: 4 }, p, 3, undefined, 0.64);
      if (i % 2 === 0) {
        const z = length * rand(0.55, 0.77);
        w.spawn({ texture: tex.star, x: x + Math.sin(tilt) * z, y, z, delay: rand(150, 430), life: 160,
          zBias: 2, rotation: tilt, scale: [0.17, 0.028], alpha: envelope(0.12, 0.82, 0.72), tint: p.core });
      }
    });
  }
}
