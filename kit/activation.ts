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
  w.spawn({ texture: tex.glow, x: 0, y: 0, z: o.height * 1.2, follow: o.at, life: 300,
    scaleX: [0.09, 0.16], scaleY: o.height / 25, alpha: [0.45, 0], tint: p.core, zBias: 5 });
  w.spawn({ texture: tex.glow, layer: 'top', x: 0, y: 0, z: o.height, follow: o.at,
    life: 90, scale: 2.8, alpha: [0.16, 0], tint: p.main });
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

/** Fantasy: the old seal shatters, rising into a crest that stamps the new tier.
 * Palette: any element's main, white-hot core and dark aftermath.
 * Phases: fracture 0-200 ms; helix 200-650; crest/hold 650-850; stamp 950; fade 950-1600.
 * Layers: broken ground seal; body shard helix, stacked runes and overhead crown; local top glow.
 * Sync: evolution stamps at 950 ms; the new tier is ready at 1600 ms.
 */
export function skillEvolution(w: VfxWorld, tex: VfxTextures, o: Caster & { fromTier: ActivationTier; toTier: ActivationTier }) {
  const p = o.palette;
  w.spawn({ texture: tex.rune, layer: 'ground', groundAligned: true, x: 0, y: 0,
    follow: groundAt(o.at), life: 240, scale: [0.3, 0.36], alpha: [0.8, 0], tint: p.main });
  w.burst(18, (i, n) => {
    const angle = i / n * TAU;
    return { texture: tex.shard, x: 0, y: 0, follow: o.at, life: 850,
      scale: [0.55, 0.18], alpha: envelope(0.07, 0.18, 0.8), tint: [p.main, p.core], zBias: 5,
      onUpdate: (q, t) => {
        const a = angle + t * 7, r = (55 + o.fromTier * 8) * (1 - t * t);
        q.px = Math.cos(a) * r; q.py = Math.sin(a) * r * w.groundSquash;
        q.pz = 5 + t * o.height * 1.9; q.rotation = a + Math.PI / 2;
      } };
  });
  for (let i = 0; i < o.toTier; i++) {
    w.spawn({ texture: tex.rune, x: 0, y: 0, follow: o.at, delay: 200 + i * 120,
      life: 1000 - i * 120, groundAligned: true, zBias: 4, spin: i % 2 ? -0.8 : 0.8,
      scale: [0.22 + i * 0.035, 0.13], alpha: envelope(0.18, 0.5, 0.45), tint: p.main,
      onUpdate: (q, t) => { q.pz = o.height * (0.3 + i * 0.4 + t * 0.5); } });
  }
  const crest = () => ({ ...o.at(), z: (o.at().z ?? 0) + o.height * 1.9 });
  w.spawn({ texture: tex.star, x: 0, y: 0, follow: crest, delay: 600, life: 350,
    scale: [0.1, 0.7], alpha: envelope(0.25, 0.1, 0.65), tint: p.core, zBias: 7 });
  w.burst(9, (i, n) => ({ texture: tex.streak, x: 0, y: 0, follow: o.at, delay: 600, life: 350,
    rotation: Math.PI + i / (n - 1) * Math.PI, anchorX: 0, scaleX: [0.15, 0.65], scaleY: 0.65,
    alpha: envelope(0.2, 0.2, 0.65), tint: p.main, zBias: 6,
    onUpdate: (q, t) => { q.pz = o.height * 1.9 * (t < 0.65 ? 1 : 1 - outCubic((t - 0.65) / 0.35)); } }));
  w.after(950, () => {
    sigil(w, tex, o, 85 + o.toTier * 18, 650, 0.2);
    w.spawn({ texture: tex.glow, layer: 'top', x: 0, y: 0, z: 12, follow: o.at, life: 200,
      scaleX: [1, 2.4], scaleY: [0.6, 0.2], alpha: [0.24, 0], tint: p.main });
    for (let i = 0; i < 2; i++) w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true,
      x: 0, y: 0, follow: groundAt(o.at), delay: i * 80, life: 500, scale: [0.2, 1.6 + i * 0.35, outCubic],
      alpha: [0.55, 0], tint: i ? p.main : p.core });
    w.burst(14, (i, n) => {
      const a = i / n * TAU;
      return { texture: tex.star, x: Math.cos(a) * 75, y: Math.sin(a) * 75 * w.groundSquash,
        z: 4, follow: o.at, life: 550, vz: rand(70, 150), scale: [0.17, 0], tint: [p.core, p.main] };
    });
    w.shake(6, 180); w.hitStop(35);
  });
}

/** Fantasy: evolved magic blossoms at the damage point, never across the screen.
 * Palette: elemental main with a brief core edge and dark debris.
 * Phases: release 0; crown peak 40 ms; sparks/debris fade 80-260 ms.
 * Layers: grounded shock rings; chest crown/rays and embers in body.
 * Sync: call for positive damage only; tier 1 is unchanged.
 */
export function empoweredHit(w: VfxWorld, tex: VfxTextures, o: { at: Vec3; palette: Palette; tier: ActivationTier }) {
  if (o.tier === 1) return;
  const p = o.palette, big = o.tier === 3, s = big ? 1.4 : 0.8;
  const body = { x: o.at.x, y: o.at.y, z: o.at.z ?? 0 };
  w.spawn({ ...body, texture: tex.crescent, life: 200, rotation: -Math.PI / 2,
    scale: [0.12 * s, 0.6 * s, outCubic], alpha: [0.85, 0], tint: p.main, zBias: 8 });
  w.spawn({ ...body, texture: tex.star, life: 150, scale: [0.5 * s, 0.1], alpha: [0.7, 0], tint: p.core, zBias: 9 });
  for (let i = 0; i < (big ? 2 : 1); i++) w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true,
    x: o.at.x, y: o.at.y, z: 0, delay: i * 45, life: 230, scale: [0.05, (0.45 + i * 0.2) * s, outCubic],
    alpha: [0.6, 0], tint: p.main });
  if (big) w.burst(4, (i, n) => ({ ...body, texture: tex.streak, life: 160, rotation: i / n * TAU + 0.4,
    anchorX: 0, scaleX: [0.2, 0.9], scaleY: [0.8, 0], alpha: [0.75, 0], tint: p.main, zBias: 6 }));
  w.burst(3, (i, n) => {
    const a = i / n * TAU;
    return { ...body, texture: big ? tex.rock : tex.streak, life: 240, rotation: a,
      vx: Math.cos(a) * 160 * s, vy: Math.sin(a) * 80 * s, vz: 45, gravity: 450,
      scaleX: [big ? 0.3 : 0.35, 0.05], scaleY: 0.25, alpha: [0.8, 0], tint: big ? [p.main, p.dark] : [p.core, p.main], zBias: 7 };
  });
  if (big) w.shake(2, 90);
}

/** Fantasy: an evolved caster leaks restrained power throughout the skill.
 * Palette: elemental wisps and shards over a dark floor remnant.
 * Phases: ease in 120 ms; sustained orbit; final 300 ms fade.
 * Layers: grounded glow/sigil; licking body tongues and orbiting shards.
 * Sync: duration is the skill length, beginning at gameplay release.
 */
export function empoweredAura(w: VfxWorld, tex: VfxTextures, o: Caster & { tier: ActivationTier; duration: number }) {
  if (o.tier === 1 || o.duration <= 0) return;
  const big = o.tier === 3, life = o.duration;
  const alpha = envelope(Math.min(0.2, 120 / life), Math.min(0.5, 300 / life), big ? 0.38 : 0.22);
  w.spawn({ texture: big ? tex.rune : tex.glow, layer: 'ground', groundAligned: true,
    x: 0, y: 0, follow: groundAt(o.at), life, scale: big ? 0.23 : 0.85, alpha, tint: o.palette.main, spin: 0.2 });
  w.burst(big ? 4 : 3, (i, n) => ({ texture: tex.puff, x: 0, y: 0, follow: o.at, life,
    scaleX: big ? 0.22 : 0.15, scaleY: big ? 0.7 : 0.45, alpha, tint: o.palette.main,
    onUpdate: (q) => {
      const cycle = (q.age / 650 + i / n) % 1, a = i / n * TAU + q.age / 850;
      q.px = Math.cos(a) * 30; q.py = Math.sin(a) * 30 * w.groundSquash;
      q.pz = 8 + cycle * o.height * 0.85; q.alphaMul = Math.sin(cycle * Math.PI);
      q.rotation = Math.sin(a) * 0.4;
    } }));
  if (big) w.burst(3, (i, n) => ({ texture: tex.shard, x: 0, y: 0, follow: o.at, life,
    scale: 0.23, alpha, tint: o.palette.core,
    onUpdate: (q) => {
      const a = i / n * TAU + q.age / 500;
      q.px = Math.cos(a) * 42; q.py = Math.sin(a) * 42 * w.groundSquash;
      q.pz = o.height * 0.45 + Math.sin(a * 2) * 12; q.rotation = a;
    } }));
}
