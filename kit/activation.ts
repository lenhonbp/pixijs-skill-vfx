import { Container, Sprite, Texture } from 'pixi.js';
import { VfxWorld, Vec3, Curve, SpawnOptions, Handle } from './vfx-world';
import { VfxTextures } from './textures';
import { Palette } from './recipes';
import { envelope, outCubic, rand } from './ease';
import { group } from './group';
import { blend, isPixiV8 } from './pixi-compat';
import { lightningBolt } from './lightning-bolt';
import { fireTextures, isFireEnergyTexture } from './fire-textures';
import { waterTextures, isWaterEnergyTexture } from './water-textures';
import { woodTextures, isWoodEnergyTexture } from './wood-textures';
import { flowRibbon } from './trail';

export type ActivationTier = 1 | 2 | 3;
type Caster = { at: () => Vec3; height: number; palette: Palette; element?: string };
const TAU = Math.PI * 2;
const groundAt = (at: () => Vec3) => () => { const p = at(); return { x: p.x, y: p.y, z: 0 }; };
export const activationRelease = (tier: ActivationTier) => tier === 1 ? 0 : tier === 2 ? 250 : 400;

const curveAt = (curve: Curve | undefined, t: number, fallback = 1): number => {
  if (curve === undefined) return fallback;
  if (typeof curve === 'number') return curve;
  if (typeof curve === 'function') return curve(t);
  const u = curve[2]?.(t) ?? t;
  return curve[0] + (curve[1] - curve[0]) * u;
};

/** Cast-local styling: callbacks retain their scope, never mutate the shared world. */
export function empoweredWorld(w: VfxWorld, o: { tier: ActivationTier; palette: Palette; textures?: VfxTextures }): VfxWorld {
  if (o.tier === 1) return w;
  const factor = o.tier === 3 ? 1.45 : 1.2, heat = o.tier === 3 ? 0.22 : 0.1;
  const energyTextures = new Set(o.textures ? [o.textures.glow, o.textures.dot, o.textures.ring,
    o.textures.streak, o.textures.beam, o.textures.star, o.textures.crescent,
    o.textures.shard, o.textures.drop, o.textures.disc] : []);
  const energyTexture = (texture: Texture) => !!o.textures && (energyTextures.has(texture) ||
    isFireEnergyTexture(texture) || isWaterEnergyTexture(texture) || isWoodEnergyTexture(texture));
  const energySprite = (root: Container): root is Sprite => root instanceof Sprite &&
    root.blendMode === blend('add') && energyTexture(root.texture);
  const ropes = new WeakSet<Container>();
  const styleRope = (root: Container) => {
    const mesh = root as Container & { texture?: Texture; geometry?: { points?: unknown[] } };
    if (!o.textures || !Array.isArray(mesh.geometry?.points) || !mesh.texture || mesh.blendMode !== blend('add')) return false;
    if (!ropes.has(root)) {
      const source = mesh.texture, orig = source.orig.clone();
      orig.height *= factor;
      const texture: Texture = isPixiV8() ? new Texture({ source: source.source, frame: source.frame,
        orig, trim: source.trim, rotate: source.rotate }) :
        new (Texture as any)((source as any).baseTexture, source.frame, orig, source.trim, source.rotate);
      mesh.texture = texture;
      const unown = w.own(() => { if (!texture.destroyed) texture.destroy(false); });
      root.once('destroyed', () => { if (!texture.destroyed) texture.destroy(false); unown(); });
      ropes.add(root);
    }
    return true;
  };
  const roots = new Map<Container, { sx: number; sy: number; alpha: number }>();
  const restore = () => {
    for (const [root, base] of roots) {
      if (root.destroyed || !root.parent) { roots.delete(root); continue; }
      root.scale.set(base.sx, base.sy); root.alpha = base.alpha;
    }
  };
  const styleRoots = () => {
    for (const root of roots.keys()) {
      if (root.destroyed || !root.parent) { roots.delete(root); continue; }
      const base = { sx: root.scale.x, sy: root.scale.y, alpha: root.alpha };
      roots.set(root, base);
      if (energySprite(root)) {
        root.scale.set(base.sx * factor, base.sy * factor);
        root.alpha = Math.min(1, base.alpha * (1 + heat));
      } else if (styleRope(root)) root.alpha = Math.min(1, base.alpha * (1 + heat));
    }
  };
  let depth = 0;
  const run = <T>(fn: () => T): T => {
    if (depth) return fn();
    restore(); depth++;
    try { return fn(); } finally { depth--; styleRoots(); }
  };
  const layers = Object.fromEntries(Object.entries(w.layers).map(([name, layer]) => [name, new Proxy(layer, {
    get(target, key) {
      if (key === 'addChild') return (...children: Container[]) => run(() => {
        const result = target.addChild(...children);
        for (const child of children) roots.set(child, { sx: child.scale.x, sy: child.scale.y, alpha: child.alpha });
        return result;
      });
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  })])) as VfxWorld['layers'];
  const methods = new Map<PropertyKey, unknown>();
  const scoped = new Proxy(w, {
    get(target, key) {
      if (key === 'layers') return layers;
      if (key === 'energyScale') return o.textures ? factor : 1;
      if (key === 'spawn') return (p: SpawnOptions) => {
        const energy = (p.blend ?? 'add') === 'add' && energyTexture(p.texture);
        const particle = target.spawn({ ...p,
          alpha: energy ? t => Math.min(1, curveAt(p.alpha, t) * (1 + heat)) : p.alpha,
          onUpdate: (q, t, dt) => {
            run(() => p.onUpdate?.(q, t, dt));
            if (energy) q.sprite.scale.set(q.sprite.scale.x * factor, q.sprite.scale.y * factor);
          },
          onDeath: p.onDeath && (q => run(() => p.onDeath!(q))),
        });
        if (particle && energy) particle.sprite.scale.set(particle.sprite.scale.x * factor, particle.sprite.scale.y * factor);
        return particle;
      };
      if (key === 'addUpdater') return (fn: (dt: number) => boolean | void) => target.addUpdater(dt => run(() => fn(dt)));
      if (key === 'shake') return (amplitude: number, ms: number) => target.shake(amplitude * factor, ms);
      if (key === 'hitStop') return (ms: number) => target.hitStop(ms * factor);
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!methods.has(key)) methods.set(key, value.bind(['burst', 'stream', 'after'].includes(String(key)) ? scoped : target));
      return methods.get(key);
    },
    set(target, key, value) { return Reflect.set(target, key, value, target); },
  });
  return scoped;
}

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
  w.spawn({ texture: tex.glow, layer: 'ground', x: 0, y: 0, z: o.height, follow: o.at, life: 520,
    scaleX: [0.3 * size, 0.7 * size], scaleY: [o.height / 40, o.height / 22], alpha: [0.16, 0], tint: p.main });
  if (!major) return;
  w.shake(7, 220); w.hitStop(45);
}

/** Fantasy: the caster's elemental seal wakes, then vents stored power.
 * Palette: any element's core / main / dark, including neutral.
 * Phases: windup 0-250/400; release 0/250/400; peak +80; fade to 400/770/1200 ms.
 * Layers: tier-1 seal/motes; evolved elemental motif and behind-caster pillar.
 * Sync: tier 1 casts immediately; tiers 2/3 release at activationRelease(tier).
 */
export function skillActivation(w: VfxWorld, tex: VfxTextures, o: Caster & { tier: ActivationTier; duration?: number }) {
  const tier = o.tier, p = o.palette, time = activationRelease(tier);
  if (tier > 1) {
    empoweredAura(w, tex, { ...o, duration: time });
    if (o.element === 'tho') w.spawn({ texture: tex.fissure, layer: 'ground', groundAligned: true,
      x: 0, y: 0, follow: groundAt(o.at), life: time + 140, scale: [0.2, 0.6], blend: 'normal',
      alpha: envelope(0.1, 0.3, 0.5), tint: p.dark });
    w.after(time, () => release(w, tex, o, tier === 3 ? 1.5 : 0.8, tier === 3));
    return;
  }
  const life = 400;
  sigil(w, tex, o, 38 + tier * 10, life, 0.4);
  w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, x: 0, y: 0, follow: groundAt(o.at),
    life, scale: [0.6, 1.5], alpha: envelope(0.1, 0.6, 0.4), tint: p.main });
  w.burst(5, () => ({ texture: tex.dot, x: rand(-25, 25), y: rand(-8, 8), follow: o.at,
    life: 400, vz: rand(50, 110), scale: [0.09, 0], tint: p.core, alpha: envelope(0.1, 0.6) }));
  w.spawn({ texture: tex.glow, layer: 'body', x: 0, y: 0, z: o.height * 0.65, follow: o.at, delay: time,
    life: 220, scale: [0.35, 0.8], alpha: [0.6, 0], tint: p.main, zBias: 3 });
}

/** Elemental gather, transformation and ground stamp; ready at 1600 ms. */
export function skillEvolution(w: VfxWorld, tex: VfxTextures, o: Caster & { fromTier: ActivationTier; toTier: ActivationTier }) {
  const p = o.palette, element = o.element;
  const metal = element === 'kim', wood = element === 'moc', water = element === 'thuy';
  const fire = element === 'hoa', earth = element === 'tho', wind = element === 'phong', storm = element === 'loi';
  const material = metal || wood || earth;
  const texture = metal ? tex.blade : wood ? tex.tendril : water ? tex.drop :
    fire ? fireTextures().flames[0] : earth ? tex.rock : wind ? tex.crescent : tex.ring;
  const count = metal ? 5 : wood || water ? 4 : fire ? 6 : earth ? 7 : wind || storm ? 0 : 2;
  const phase = rand(0, TAU);
  if (wood || water || wind) for (let i = 0; i < (wind ? 3 : 2); i++) flowRibbon(w, {
    life: 950, width: wood ? 5 : water ? 9 : 7, segments: 48, layer: 'ground', blend: wood ? 'normal' : 'add',
    tint: p.main, alpha: age => Math.min(1, age / 120, (950 - age) / 200) * (wood ? 0.8 : 0.6),
    point: (u, age, out) => {
      const at = o.at(), growth = Math.min(1, age / 600);
      const a = phase + i * TAU / (wind ? 3 : 2) + u * TAU * (wind ? 2.4 : water ? 1.5 : 1) + age / (wind ? 150 : water ? 220 : 900);
      const r = wind ? 20 + u * 52 : water ? 62 * (1 - u * 0.65) : 46 - u * 15;
      out.x = at.x + Math.cos(a) * r; out.y = at.y + Math.sin(a) * r * w.groundSquash;
      out.z = (at.z ?? 0) + 5 + u * o.height * (wood ? 1.5 : 1.9) * growth;
    },
  });
  for (let i = 0; i < count; i++) {
    const angle = phase + i / count * TAU;
    w.spawn({ texture, layer: 'ground', x: 0, y: 0, follow: o.at, life: 950,
      blend: material ? 'normal' : 'add', tint: metal ? 0xffffff : p.main,
      alpha: envelope(0.1, 0.12, material ? 0.85 : 0.55),
      scaleX: fire ? 1.15 : wind ? 0.9 : wood ? 0.55 : 0.4,
      scaleY: fire ? 0.6 : wind ? 0.28 : wood ? 0.65 : earth ? 0.6 : 0.75,
      groundAligned: !material && !water && !fire,
      onUpdate: (q, t) => {
        const gather = Math.min(1, t / 0.35), transform = Math.max(0, (t - 0.35) / 0.65);
        const a = angle + (metal || earth ? 0.3 : wind ? 11 : wood ? 4 : 7) * t;
        const r = metal ? 82 * (1 - gather) + 22 : earth ? 55 * (1 - transform * 0.7) :
          wind ? 65 - transform * 30 : (fire ? 52 : 60) * (1 - transform * 0.65);
        q.px = Math.cos(a) * r; q.py = Math.sin(a) * r * w.groundSquash;
        q.pz = earth ? 8 + Math.sin(t * Math.PI) * o.height * 1.6 :
          metal ? o.height * (0.3 + gather * 1.2) :
          (fire || water || wood || wind) ? 6 + ((t * (wind ? 2 : 1.6) + i / count) % 1) * o.height * 1.9 : 0;
        q.rotation = metal ? -Math.PI / 4 + angle * (1 - gather) : earth ? a :
          fire ? -Math.PI / 2 + Math.sin(a) * 0.2 : a + Math.PI / 2;
      } });
  }
  if (storm) for (const delay of [0, 180, 360, 540, 720]) w.after(delay, () => {
    const at = o.at();
    for (let i = 0; i < 4; i++) {
      const a = phase + i / 4 * TAU;
      lightningBolt(w, tex, { x: at.x + Math.cos(a) * 66, y: at.y + Math.sin(a) * 24, z: (at.z ?? 0) + 8 },
        { x: at.x + Math.cos(a + 0.5) * 40, y: at.y + Math.sin(a + 0.5) * 18, z: (at.z ?? 0) + o.height * 1.8 },
        { ...p, core: p.main }, { layer: 'ground', life: 210, width: 2, branches: 1, halo: 0,
          alpha: 0.55, coreAlpha: 0.4, leader: false, hold: 180 });
    }
  });
  const crestTextures = metal ? [tex.blade] : wood ? woodTextures().petals : water ? waterTextures().crystals : earth ? [tex.rock] : [];
  for (let i = 0; i < (crestTextures.length ? 5 : 0); i++) w.spawn({ texture: crestTextures[i % crestTextures.length], layer: 'ground',
    x: (i - 2) * 12, y: 0, follow: o.at, delay: 600, life: 500, blend: 'normal',
    tint: metal || wood ? 0xffffff : water ? p.core : p.main, alpha: envelope(0.15, 0.2, 0.85),
    scaleX: water ? 0.28 : wood ? 0.9 : 0.45, scaleY: water ? 0.5 : wood ? 0.7 : 0.65, rotation: (i - 2) * 0.35,
    onUpdate: (q, t) => { q.pz = o.height * 1.7 * (t < 0.7 ? 1 : 1 - outCubic((t - 0.7) / 0.3)); } });
  w.after(950, () => {
    empoweredAura(w, tex, { ...o, tier: o.toTier, duration: 650 });
    w.spawn({ texture: earth || storm ? tex.fissure : wood ? tex.vineSegment : wind ? tex.crescent : tex.ring,
      layer: 'ground', groundAligned: true, x: 0, y: 0, follow: groundAt(o.at), life: 650,
      blend: earth || storm || wood ? 'normal' : 'add', scale: [0.25, 1.45, outCubic],
      alpha: [0.55, 0], tint: p.main, spin: wind ? 4 : 0 });
    if (fire || wood || water) w.burst(8, (i, n) => {
      const a = i / n * TAU;
      return { texture: wood ? woodTextures().petals[i % 3] : water ? tex.shard : tex.streak, layer: 'ground',
        x: Math.cos(a) * 55, y: Math.sin(a) * 22, z: 4, follow: o.at, life: 550,
        blend: wood ? 'normal' : 'add', vx: Math.cos(a) * 35, vz: fire ? 110 : 45,
        scale: [wood ? 0.6 : 0.28, 0], rotation: a, alpha: [0.65, 0], tint: wood ? 0xffffff : p.main };
    });
    if (storm) {
      const at = o.at();
      lightningBolt(w, tex, { ...at, z: (at.z ?? 0) + o.height * 2 }, { ...at, z: at.z ?? 0 },
        { ...p, core: p.main }, { layer: 'ground', life: 350, width: 3, halo: 0, branches: 3,
          alpha: 0.55, coreAlpha: 0.4, hold: 220 });
    }
    w.shake(6, 180); w.hitStop(35);
  });
}

const hitAccents = new WeakMap<VfxWorld, Map<string, { until: number; particle: ReturnType<VfxWorld['spawn']>; options: SpawnOptions }>>();

/** Fantasy: restrained elemental accents surround the damage point.
 * Palette: supplied main colour, without a white core.
 * Phases: release 0; accents fade by 240-520 ms, depending on element and tier.
 * Layers: behind-target glints/leaves/embers/arcs/debris; grounded ring.
 * Sync: positive hits only; throttled per ground position; ticks use one small accent.
 */
export function empoweredHit(w: VfxWorld, tex: VfxTextures, o: { at: Vec3; palette: Palette; tier: ActivationTier; tick?: boolean; element?: string }) {
  if (o.tier === 1) return;
  const p = o.palette, big = o.tier === 3, s = (big ? 1.4 : 0.8) * (o.tick ? 0.5 : 1);
  let hits = hitAccents.get(w);
  if (!hits) { hits = new Map(); hitAccents.set(w, hits); }
  for (const [key, hit] of hits) if (w.now >= hit.until || hit.particle?.o !== hit.options || hit.particle.dead) hits.delete(key);
  const key = `${Math.round(o.at.x / 16)},${Math.round(o.at.y / 16)}`;
  if (hits.has(key)) return;
  if (!o.tick && ['moc', 'thuy', 'loi'].includes(o.element ?? '')) {
    const ice = o.element === 'thuy', wood = o.element === 'moc';
    const life = big ? 520 : 380;
    const options: SpawnOptions = { texture: wood ? tex.vineSegment : ice ? tex.ring : tex.fissure,
      layer: 'ground', groundAligned: true, x: o.at.x, y: o.at.y, z: 0, life,
      blend: ice ? 'add' : 'normal', tint: p.main, scale: [0.28, big ? 0.95 : 0.6, outCubic],
      alpha: envelope(0.04, 0.45, 0.55) };
    const particle = w.spawn(options);
    if (particle) hits.set(key, { until: w.now + life, particle, options: particle.o });
    if (!ice && !wood) {
      for (const side of [-1, 1]) lightningBolt(w, tex,
        { x: o.at.x + side * 62 * s, y: o.at.y, z: 12 },
        { x: o.at.x + side * 18, y: o.at.y, z: 85 * s }, { ...p, core: p.main },
        { layer: 'ground', width: big ? 2.8 : 1.6, life, branches: 2, depth: 3,
          alpha: 0.55, coreAlpha: 0.5, halo: 0, leader: false, restrikes: 2, afterglow: 0.6 });
    } else for (let i = 0; i < (big ? 6 : 4); i++) {
      const a = i / (big ? 6 : 4) * TAU;
      w.spawn({ texture: wood ? tex.vineSegment : tex.shard, layer: 'ground',
        x: o.at.x + Math.cos(a) * 44 * s, y: o.at.y + Math.sin(a) * 18 * s,
        z: 3, life, blend: wood ? 'normal' : 'add', tint: i % 2 ? p.main : p.core,
        rotation: Math.cos(a) * 0.6, scaleX: [wood ? 0.32 : 0.24, wood ? 0.55 : 0.38],
        scaleY: [0.05, (wood ? 1.1 : 1.35) * s, outCubic],
        alpha: envelope(0.04, 0.45, 0.55), vz: wood ? 18 : 55 });
    }
    w.shake(big ? 3 : 1.5, 100);
    return;
  }
  const ring: SpawnOptions = { texture: tex.ring, layer: 'ground', groundAligned: true,
    x: o.at.x, y: o.at.y, z: 0, life: o.tick ? 160 : 280,
    scale: [0.18, (o.tick ? 0.32 : 0.6) * s, outCubic], alpha: [o.tick ? 0.2 : 0.4, 0], tint: p.main };
  const elemental = ['kim', 'moc', 'hoa', 'phong', 'tho', 'thuy', 'loi'].includes(o.element ?? '');
  const spawn = (options: SpawnOptions) => {
    const particle = w.spawn(options);
    if (particle && !hits.has(key)) hits.set(key, { until: w.now + (o.tick ? 160 : 280), particle, options: particle.o });
  };
  if (!elemental || o.element === 'kim') spawn(ring);
  if (!elemental) return;
  const at = { x: o.at.x, y: o.at.y, layer: 'ground' as const };
  for (let i = 0; i < (o.tick || o.element === 'tho' ? 1 : 2); i++) {
    const side = i ? 1 : -1;
    const base: SpawnOptions = { ...at, texture: tex.dot, z: 4, life: o.tick ? 160 : 240, tint: p.main,
      alpha: [o.tick ? 0.25 : 0.45, 0], x: at.x + side * 28 * s, scale: [0.18 * s, 0], vz: 65 };
    switch (o.element) {
      case 'kim':
        spawn({ ...base, texture: tex.streak, x: at.x, z: 18, rotation: side * 0.6,
          scaleX: [0.45 * s, 0.1], scaleY: 0.12, vz: 0 }); break;
      case 'moc':
        spawn({ ...base, texture: tex.leaf, blend: 'normal', rotation: side * 0.7,
          scale: [0.1, 0.65 * s], alpha: envelope(0.15, 0.5, 0.55), vz: 40 }); break;
      case 'hoa': spawn({ ...base, texture: tex.streak, vx: side * 20, vz: 100,
        scaleX: [0.13 * s, 0], scaleY: [0.6 * s, 0], rotation: side * 0.2 }); break;
      case 'phong':
        spawn({ ...base, texture: tex.crescent, x: at.x, z: 0, groundAligned: true,
          rotation: i * Math.PI, spin: 7, scale: [0.28 * s, 0.5 * s], vz: 0, alpha: [0.3, 0] }); break;
      case 'tho':
      case 'thuy':
      case 'loi': {
        const earth = o.element === 'tho', ice = o.element === 'thuy';
        spawn({ ...base, texture: earth ? tex.rock : ice ? tex.shard : tex.streak,
          blend: earth ? 'normal' : 'add', rotation: side * 0.7,
          vx: side * 90 * s, vz: 90 * s, gravity: earth ? 500 : 80,
          scaleX: [0.4 * s, 0.1], scaleY: [0.65 * s, 0.1], alpha: [0.5, 0] }); break;
      }
    }
  }
  w.shake(big ? 3 : 1.5, 100);
}

/** Fantasy: an evolved caster leaks restrained power throughout the skill.
 * Palette: element-specific silhouettes, using the supplied skill colours.
 * Phases: ease in 120 ms; sustained orbit; final 300 ms fade.
 * Layers: grounded rings; orbiting pieces behind the caster, never a body glow.
 * Sync: duration is the skill length, beginning at gameplay release.
 */
export function empoweredAura(w: VfxWorld, tex: VfxTextures, o: Caster & { tier: ActivationTier; duration: number; idle?: boolean }) {
  if (o.tier === 1 || o.duration <= 0) return;
  const big = o.tier === 3, life = o.duration;
  const g = group(w, life, undefined, 140);
  const peak = big ? 0.42 : 0.25;
  const alpha = life === Infinity ? peak : envelope(Math.min(0.2, 120 / life), Math.min(0.5, 300 / life), peak);
  const base: SpawnOptions = { texture: tex.ring, layer: 'ground', x: 0, y: 0, follow: o.at,
    life, alpha, tint: o.palette.main };
  const floor = (scale: number, spin = 0) => g.add(w.spawn({ ...base, groundAligned: true,
    follow: groundAt(o.at), scale, spin }));
  const element = o.element;
  if (element === 'kim' || element === 'hoa') floor(big ? 0.62 : 0.48, 0.2);
  if (element === 'thuy') { floor(big ? 0.7 : 0.55); floor(big ? 0.46 : 0.33, -0.3); }
  if (!['kim', 'moc', 'thuy', 'hoa', 'tho', 'phong', 'loi'].includes(element ?? '')) {
    g.add(w.spawn({ ...base, groundAligned: true, follow: groundAt(o.at), scale: big ? 0.9 : 0.65,
      alpha: life === Infinity ? (big ? 0.5 : 0.3) : envelope(0.15, 0.3, big ? 0.5 : 0.3), spin: 0.15 }));
    return g;
  }
  if (element === 'loi') {
    floor(big ? 0.85 : 0.65, -0.2);
    const interval = big ? 85 : 115;
    let arcs: Handle[] = [], left = interval;
    const flash = () => {
      for (const arc of arcs) arc.stop();
      arcs = [];
      const at = o.at(), phase = rand(0, TAU), n = big ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = phase + i / n * TAU;
        const from = { x: at.x + Math.cos(a) * 56, y: at.y + Math.sin(a) * 22,
          z: (at.z ?? 0) + 8 + (i % 2) * 15 };
        const to = { x: at.x + Math.cos(a + 1.4) * 56, y: at.y + Math.sin(a + 1.4) * 22, z: from.z + 22 };
        arcs.push(lightningBolt(w, tex, from, to, { ...o.palette, core: o.palette.main }, {
          layer: 'ground', width: big ? 2.6 : 1.6, life: interval + 100, depth: 3, branches: 1,
          leader: false, restrikes: 1, halo: 0, alpha: big ? 0.95 : 0.65, coreAlpha: 0.7, hold: interval + 100 }));
      }
    };
    const loop = w.addUpdater(dt => { left -= dt; if (left <= 0) { left = interval; flash(); } });
    const stop = () => { loop.stop(); for (const arc of arcs) arc.stop(); arcs = []; };
    const unown = w.own(stop);
    g.addHandle({ stop: () => { stop(); unown(); }, get alive() { return loop.alive; } });
    flash();
    return g;
  }
  const n = element === 'kim' || element === 'moc' ? (big ? 4 : 3) : element === 'thuy' || element === 'tho' ? 2 : big ? 3 : 2;
  const texture = element === 'kim' ? tex.blade : element === 'moc' ? tex.leaf :
    element === 'thuy' ? tex.shard : element === 'hoa' ? tex.puff :
    element === 'tho' ? tex.rock : tex.crescent;
  const phase = rand(0, TAU);
  for (let i = 0; i < n; i++) g.add(w.spawn({ ...base, texture,
    blend: element === 'tho' || element === 'moc' || element === 'kim' ? 'normal' : 'add',
    tint: element === 'kim' ? 0xffffff : element === 'moc' && i === n - 1 ? o.palette.core : o.palette.main,
    alpha: element === 'kim' || element === 'moc' || element === 'tho' ? (big ? 0.85 : 0.6) : alpha,
    scaleX: element === 'phong' ? 0.55 : element === 'hoa' ? 0.38 : element === 'moc' ? 0.7 : element === 'tho' ? 0.5 : 0.26,
    scaleY: element === 'phong' ? 0.2 : element === 'hoa' ? 1.2 : element === 'moc' ? 0.85 : element === 'tho' ? 0.6 : 0.35,
    onUpdate: q => {
      const a = phase + i / n * TAU + q.age / 900;
      const rise = (q.age / 1050 + i / n) % 1;
      const r = element === 'kim' ? 42 : element === 'tho' ? 64 : element === 'moc' ? 46 : element === 'phong' ? 36 : 32;
      q.px = Math.cos(a) * r; q.py = Math.sin(a) * r * (element === 'tho' ? 0.18 : w.groundSquash);
      q.pz = element === 'tho' ? 5 + Math.sin(a * 2) * 3 :
        element === 'moc' || element === 'hoa' ? 8 + rise * o.height :
        o.height * 0.55 + Math.sin(a * 2) * 18;
      q.rotation = element === 'kim' ? a + Math.PI / 2 : element === 'hoa' ? -0.15 * Math.sin(a) : a;
      q.alphaMul = element === 'hoa' ? Math.sin(rise * Math.PI) : element === 'moc' ? 0.35 + 0.65 * Math.sin(rise * Math.PI) : element === 'tho' ? 1 : 0.65 + Math.sin(a) * 0.35;
    } }));
  if (element === 'tho') g.add(w.spawn({ ...base, texture: tex.ring, groundAligned: true,
    follow: groundAt(o.at), blend: 'normal', tint: o.palette.main, scale: big ? 0.85 : 0.65,
    alpha: life === Infinity ? 0.55 : envelope(0.1, 0.3, 0.55), spin: 0.2 }));
  if (element === 'moc') {
    floor(big ? 0.48 : 0.4);
    for (let i = 0; i < 2; i++) g.add(w.spawn({ ...base, texture: tex.vineSegment,
      groundAligned: true, follow: groundAt(o.at), scaleX: big ? 1.05 : 0.85, scaleY: 0.45,
      blend: 'normal', alpha: big ? 0.8 : 0.55,
      onUpdate: q => { const a = phase + i * Math.PI + q.age / 1600;
        q.px = Math.cos(a) * 44; q.py = Math.sin(a) * 44 * w.groundSquash;
        q.rotation = a + Math.PI / 2; } }));
  }
  if (element === 'hoa') g.add(w.spawn({ ...base, texture: tex.dot, scale: 0.1,
    onUpdate: q => { const t = q.age / 900 % 1; q.px = Math.sin(q.age / 400) * 28;
      q.pz = t * o.height * 1.2; q.alphaMul = Math.sin(t * Math.PI); } }));
  return g;
}
