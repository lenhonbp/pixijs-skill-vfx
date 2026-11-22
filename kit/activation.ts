import { VfxWorld, Vec3 } from './vfx-world';
import { VfxTextures } from './textures';
import { Palette } from './recipes';
import { envelope, outCubic, rand } from './ease';

export type ActivationTier = 1 | 2 | 3;
type Caster = { at: () => Vec3; height: number; palette: Palette };
const TAU = Math.PI * 2;
const groundAt = (at: () => Vec3) => () => { const p = at(); return { x: p.x, y: p.y, z: 0 }; };
export const activationRelease = (tier: ActivationTier) => tier === 1 ? 0 : tier === 2 ? 250 : 400;

function sigil(w: VfxWorld, tex: VfxTextures, o: Caster, radius: number, life: number, spin: number) {
  w.spawn({ texture: tex.rune, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: groundAt(o.at),
    life, spin, scale: t => radius / 236 * (0.65 + 0.35 * outCubic(Math.min(1, t * 5))),
    alpha: envelope(0.12, 0.5, 0.75), tint: o.palette.main });
}

function gather(w: VfxWorld, tex: VfxTextures, o: Caster, count: number, life: number, radius: number) {
  w.burst(count, (i, n) => {
    const a = i / n * TAU, phase = rand(0, 1);
    return { texture: tex.shard, x: 0, y: 0, follow: o.at, life, zBias: 4,
      scaleX: [0.35, 0.08], scaleY: 0.4, alpha: envelope(0.15, 0.1, 0.85), tint: [o.palette.main, o.palette.core],
      onUpdate: (q, t) => {
        const angle = a + t * 3, r = radius * (1 - t * t);
        q.px = Math.cos(angle) * r; q.py = Math.sin(angle) * r * w.groundSquash;
        q.pz = o.height * (0.2 + 0.45 * t) + Math.sin(t * Math.PI) * 25 * phase;
        q.rotation = angle - Math.PI / 2;
      } };
  });
}

function release(w: VfxWorld, tex: VfxTextures, o: Caster, size: number, major: boolean) {
  const p = o.palette;
  w.spawn({ texture: tex.glow, x: 0, y: 0, z: o.height * 0.7, follow: o.at, life: 260,
    scale: [0.7 * size, 1.7 * size], alpha: [0.75, 0], tint: p.core, zBias: 6 });
  w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: groundAt(o.at),
    life: 450, scale: [0.15, size * 0.95, outCubic], alpha: [0.65, 0], tint: p.main });
  w.spawn({ texture: tex.glow, x: 0, y: 0, z: o.height, follow: o.at, life: 520, zBias: 3,
    scaleX: [0.3 * size, 0.7 * size], scaleY: [o.height / 40, o.height / 22], alpha: [0.5, 0], tint: p.main });
  if (!major) return;
  w.spawn({ texture: tex.glow, x: 0, y: 0, z: o.height * 1.2, follow: o.at, life: 350,
    scaleX: [0.13, 0.3], scaleY: o.height / 18, alpha: [0.9, 0], tint: 0xffffff, zBias: 5 });
  w.spawn({ texture: tex.glow, layer: 'top', x: 0, y: 0, z: o.height, follow: o.at,
    life: 120, scale: 22, alpha: [0.28, 0], tint: p.core });
  w.burst(18, (i, n) => {
    const a = i / n * TAU, speed = rand(120, 240) * size;
    return { texture: tex.shard, x: 0, y: 0, z: o.height * 0.6, follow: o.at, life: rand(380, 650),
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * w.groundSquash, vz: rand(50, 140), drag: 2,
      rotation: a, spin: 2, scale: [0.4, 0], alpha: [1, 0], tint: [p.core, p.main], zBias: 6 };
  });
  w.shake(7, 220); w.hitStop(45);
}

/** Fantasy: the caster's elemental seal wakes, then vents stored power.
 * Palette: any element's core / main / dark, including neutral.
 * Phases: windup 0-250/400; release 0/250/400; peak +80; fade to 400/770/1500 ms.
 * Layers: ground seals/cracks; body motes, tongues and pillar; top flash at tier 3.
 * Sync: tier 1 casts immediately; tiers 2/3 release at activationRelease(tier).
 */
export function skillActivation(w: VfxWorld, tex: VfxTextures, o: Caster & { tier: ActivationTier; duration?: number }) {
  const tier = o.tier, p = o.palette, time = activationRelease(tier);
  const life = tier === 1 ? 400 : tier === 2 ? 700 : 1000;
  sigil(w, tex, o, 38 + tier * 10, life, 0.4);
  w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: groundAt(o.at),
    life, scale: [0.6, 1.5], alpha: envelope(0.1, 0.6, 0.4), tint: p.main });
  w.burst(5, () => ({ texture: tex.dot, x: rand(-25, 25), y: rand(-8, 8), follow: o.at,
    life: 400, vz: rand(50, 110), scale: [0.09, 0], tint: p.core, alpha: envelope(0.1, 0.6) }));
  w.spawn({ texture: tex.glow, x: 0, y: 0, z: o.height * 0.65, follow: o.at, delay: time,
    life: 220, scale: [0.35, 0.8], alpha: [0.6, 0], tint: p.main, zBias: 3 });
  if (tier < 2) return;
  sigil(w, tex, o, 78, life, -0.9);
  w.burst(tier === 3 ? 14 : 9, (i, n) => {
    const a = i / n * TAU;
    return { texture: tex.puff, x: 0, y: 0, follow: o.at, life: life - 80, delay: i * 9,
      scaleX: [0.13, 0.32], scaleY: [0.25, 0.85], alpha: envelope(0.18, 0.55, 0.48),
      tint: [p.main, p.dark], blend: 'add',
      onUpdate: (q, t) => {
        const angle = a + t * 1.8, r = 30 + Math.sin(t * Math.PI) * 12;
        q.px = Math.cos(angle) * r; q.py = Math.sin(angle) * r * w.groundSquash;
        q.pz = t * o.height * 1.4; q.rotation = Math.sin(a + t * 5) * 0.35;
      } };
  });
  w.after(time, () => release(w, tex, o, tier === 3 ? 1.5 : 0.8, tier === 3));
  if (tier < 3) return;
  sigil(w, tex, o, 106, 1200, 0.7);
  gather(w, tex, o, 16, time, 115);
  w.after(time, () => {
    const at = o.at();
    w.burst(5, (i) => ({ texture: tex.swordCrack, layer: 'ground', groundAligned: true,
      x: at.x, y: at.y, life: 1800, rotation: i * TAU / 5, scale: 1.7,
      blend: 'normal', tint: p.dark, alpha: [0.65, 0] }));
    w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: groundAt(o.at),
      life: o.duration ?? 1500, scale: 1.7, alpha: [0.35, 0], tint: p.main });
  });
}

/** Fantasy: an elemental ascension, pulled tight before a radiant coronation.
 * Palette: any element's main, white-hot core and dark aftermath.
 * Phases: gather 0-550 ms; hold 550-650; release/peak 650-750; settle/fade 750-1600.
 * Layers: ground double shock/seal; body inward shards, crown/pillar/rising sparks; top flash.
 * Sync: evolution releases at 650 ms; the new tier is ready at 1600 ms.
 */
export function skillEvolution(w: VfxWorld, tex: VfxTextures, o: Caster & { fromTier: ActivationTier; toTier: ActivationTier }) {
  gather(w, tex, o, 24, 550, 150 + o.fromTier * 10);
  sigil(w, tex, o, 75, 650, -1);
  w.spawn({ texture: tex.glow, x: 0, y: 0, z: o.height * 0.7, follow: o.at, life: 650,
    scale: [0.1, 1.1], alpha: [0.1, 0.8], tint: o.palette.core });
  w.after(650, () => {
    release(w, tex, o, 2, true);
    sigil(w, tex, o, 55 + o.toTier * 20, 950, 0.35);
    w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: groundAt(o.at),
      delay: 100, life: 650, scale: [0.3, 2.2, outCubic], alpha: [0.8, 0], tint: o.palette.core });
    w.burst(12, (i, n) => ({ texture: tex.streak, x: 0, y: 0, z: o.height * 0.8, follow: o.at,
      life: 650, rotation: i / n * TAU, scaleX: [0.15, 1.8, outCubic], scaleY: [1.4, 0],
      alpha: envelope(0.08, 0.8, 0.8), tint: [o.palette.core, o.palette.main], zBias: 5 }));
    w.burst(22, (i, n) => {
      const a = i / n * TAU;
      return { texture: tex.star, x: Math.cos(a) * 65, y: Math.sin(a) * 65 * w.groundSquash,
        z: 8, follow: o.at, life: 850, vz: rand(80, 170), spin: 2, scale: [0.18, 0],
        alpha: envelope(0.1, 0.7), tint: [o.palette.core, o.palette.main] };
    });
  });
}
