import type { Handle, VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import { type Palette, shockwave } from './recipes';
import { stoneTint, dustTint } from './elemental';
import { group } from './group';
import { clamp01, envelope, inQuad, lerpColor, outCubic, outQuad, rand } from './ease';

const TAU = Math.PI * 2;

/** A mountain forms overhead, its shadow spreads, it drops base-first, sits embedded for a beat,
 *  then collapses into tumbling boulders and a rolling dust cloud. */
export function mountainCrash(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; radius: number; palette: Palette; height?: number; delay?: number; onHit?: () => void }): Handle {
  const delay = o.delay ?? 0, fall = 320, impact = delay + fall, hold = 260, crumble = 520;
  const h = o.height ?? 160, p = o.palette, s = h / 160, r = o.radius;
  const stone = stoneTint(p), dust = dustTint(p);
  const ground = { layer: 'ground', groundAligned: true, x: o.x, y: o.y } as const;
  let age = 0, hit = false, broke = false;
  const g = group(w, impact + 2400, undefined, 100);

  // the shadow of the falling mass darkens and tightens before the hit
  g.add(w.spawn({ ...ground, texture: tex.glow, blend: 'normal', delay, life: fall + 40,
    scale: (t) => (r / 50) * (1.5 - 0.5 * t), alpha: (t) => 0.15 + 0.4 * t, tint: 0x0e0905 }));

  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    if (!hit && age >= impact) {
      hit = true;
      impactFx();
      o.onHit?.();
    }
    if (!broke && age >= impact + hold) {
      broke = true;
      w.shake(4 * s, 260);
      w.burst(10, (i) => {
        const a = (i / 10) * TAU + rand(-0.3, 0.3), sp = rand(40, 120) * s;
        return { texture: tex.rock, blend: 'normal', x: o.x + Math.cos(a) * r * 0.35, y: o.y + Math.sin(a) * 8, z: rand(0.2, 0.75) * h,
          life: rand(1300, 1700), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(40, 140) * s,
          gravity: 900, bounce: 0.25, drag: 0.4, rotation: rand(0, TAU), spin: rand(-5, 5), scale: rand(0.55, 1.05) * s,
          alpha: envelope(0, 0.75), tint: lerpColor(stone, p.dark, rand(0, 0.3)),
          onUpdate: (q) => { if (q.z <= 0 && q.vz <= 0) q.o.spin = (q.o.spin as number) * 0.85; } };
      });
      for (let i = 0; i < 7; i++) {
        const x = rand(-r, r) * 0.8;
        w.spawn({ texture: tex.puff, blend: 'normal', x: o.x + x, y: o.y + rand(-6, 6), z: rand(0.1, 0.5) * h, life: rand(1300, 1800), zBias: 36,
          vx: x * 0.4, vz: rand(18, 40) * s, drag: 1.2, rotation: rand(0, TAU), spin: rand(-0.4, 0.4),
          scale: [0.6 * s, rand(1.1, 1.5) * s, outCubic], alpha: envelope(0.12, 0.55, 0.3), tint: lerpColor(dust, 0x5a4e40, rand(0, 0.35)) });
      }
    }
  }));

  function impactFx() {
    w.spawn({ ...ground, texture: tex.glow, life: 260, scale: [r / 45, r / 25, outQuad], alpha: [0.35, 0], tint: p.main });
    w.spawn({ ...ground, texture: tex.glow, blend: 'normal', life: 2300, scale: r / 40, alpha: envelope(0.02, 0.6, 0.65), tint: 0x140d06 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rand(-0.3, 0.3), len = rand(0.9, 1.4) * r;
      w.spawn({ ...ground, texture: tex.fissure, blend: 'normal', x: o.x + Math.cos(a) * len * 0.5, y: o.y + Math.sin(a) * len * 0.5 * w.groundSquash,
        rotation: a, life: 2300, scaleX: [len * 0.5 / 256, len / 256, outCubic], scaleY: rand(0.7, 1.1) * s,
        alpha: envelope(0.02, 0.5, 0.95), tint: stone });
    }
    shockwave(w, tex, { x: o.x, y: o.y, radius: r * 1.5, palette: { ...p, main: dust, core: lerpColor(dust, 0xffffff, 0.4) }, duration: 460 });
    // dust rolls out low along the ground, then lifts
    w.burst(16, (i) => {
      const a = (i / 16) * TAU + rand(-0.15, 0.15), sp = rand(150, 260) * s;
      return { texture: tex.puff, blend: 'normal', x: o.x + Math.cos(a) * r * 0.4, y: o.y + Math.sin(a) * r * 0.4 * w.groundSquash, z: rand(4, 14),
        life: rand(1400, 2000), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(6, 24), drag: 2.6,
        rotation: rand(0, TAU), spin: rand(-0.5, 0.5), scale: [0.45 * s, rand(0.9, 1.3) * s, outCubic],
        alpha: envelope(0.04, 0.4, 0.26), tint: lerpColor(dust, 0x5a4e40, rand(0, 0.4)) };
    });
    w.burst(18, () => {
      const a = rand(0, TAU), sp = rand(140, 340) * s;
      return { texture: tex.rock, blend: 'normal', x: o.x + Math.cos(a) * r * 0.5, y: o.y + Math.sin(a) * r * 0.5 * w.groundSquash, z: 6,
        life: rand(800, 1200), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * w.groundSquash, vz: rand(220, 480) * s,
        gravity: 1300, bounce: 0.3, drag: 0.5, rotation: rand(0, TAU), spin: rand(-10, 10), scale: rand(0.16, 0.38) * s,
        alpha: envelope(0, 0.8), tint: lerpColor(stone, 0x6a5a48, rand(0, 0.6)) };
    });
    w.shake(12 * s, 360);
    w.hitStop(80);
  }

  g.add(w.spawn({ texture: tex.mountain, blend: 'normal', x: o.x, y: o.y,
    delay, life: fall + hold + crumble, anchorY: 1, scaleX: r * 2.5 / 320, scaleY: h / 256,
    tint: stone, zBias: 35,
    alpha: () => clamp01((age - delay) / 120) * (1 - clamp01((age - impact - hold - crumble * 0.35) / (crumble * 0.65)) ** 1.5),
    onUpdate: (q) => {
      const drop = inQuad(clamp01((age - delay - 130) / 190));
      q.pz = h * 1.25 * (1 - drop);
      q.sprite.position.set(o.x, o.y - q.pz);
      const since = age - impact;
      const squash = since > 0 && since < 160 ? Math.sin(since / 160 * Math.PI) * 0.08 : 0;
      const sink = 1 - 0.6 * outQuad(clamp01((since - hold) / crumble));
      q.sprite.scale.set((r * 2.5 / 320) * (1 + squash * 0.6) * (1 + (1 - sink) * 0.25), (h / 256) * (1 - squash) * sink);
    },
  }));
  return g;
}
