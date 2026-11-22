import { Container, Sprite, Texture } from 'pixi.js';
import { VfxWorld, Vec3, Curve, SpawnOptions, Handle } from './vfx-world';
import { VfxTextures } from './textures';
import { Palette } from './recipes';
import { envelope, outCubic, rand } from './ease';
import { group } from './group';
import { blend, isPixiV8 } from './pixi-compat';
import { lightningBolt } from './lightning-bolt';
import { isFireEnergyTexture } from './fire-textures';
import { isWaterEnergyTexture } from './water-textures';
import { isWoodEnergyTexture } from './wood-textures';

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
    o.textures.shard, o.textures.drop] : []);
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
    empoweredAura(w, tex, { ...o, tier: o.toTier, duration: 650 });
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

const hitAccents = new WeakMap<VfxWorld, Map<string, { until: number; particle: ReturnType<VfxWorld['spawn']>; options: SpawnOptions }>>();

/** Fantasy: restrained elemental accents surround the damage point.
 * Palette: supplied main colour, without a white core.
 * Phases: release 0; accents fade by 240 ms; ground ring by 280 ms.
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
    g.add(w.spawn({ ...base, groundAligned: true, follow: groundAt(o.at), scale: big ? 0.55 : 0.45,
      alpha: life === Infinity ? (big ? 0.18 : 0.12) : envelope(0.15, 0.3, big ? 0.18 : 0.12), spin: 0.15 }));
    return g;
  }
  if (element === 'loi') {
    const interval = big ? 85 : 115;
    let arcs: Handle[] = [], left = interval;
    const flash = () => {
      for (const arc of arcs) arc.stop();
      arcs = [];
      const at = o.at(), phase = rand(0, TAU), n = big ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = phase + i / n * TAU;
        const from = { x: at.x + Math.cos(a) * 56, y: at.y + Math.sin(a) * 22,
          z: (at.z ?? 0) + o.height * 0.55 + Math.sin(a * 2) * 20 };
        const to = { x: from.x + Math.cos(a + 1) * 20, y: from.y, z: from.z + 22 };
        arcs.push(lightningBolt(w, tex, from, to, { ...o.palette, core: o.palette.main }, {
          layer: 'ground', width: big ? 1.6 : 1, life: interval + 30, depth: 2, branches: 0,
          leader: false, restrikes: 1, halo: 0, alpha: big ? 0.85 : 0.5, coreAlpha: 0.55 }));
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
    alpha: element === 'kim' || element === 'moc' ? (big ? 0.85 : 0.6) : alpha,
    scaleX: element === 'phong' ? 0.55 : element === 'hoa' ? 0.38 : element === 'moc' ? 0.7 : 0.26,
    scaleY: element === 'phong' ? 0.2 : element === 'hoa' ? 1.2 : element === 'moc' ? 0.85 : 0.35,
    onUpdate: q => {
      const a = phase + i / n * TAU + q.age / 900;
      const rise = (q.age / 1050 + i / n) % 1;
      const r = element === 'kim' ? 42 : element === 'tho' ? 64 : element === 'moc' ? 46 : element === 'phong' ? 36 : 32;
      q.px = Math.cos(a) * r; q.py = Math.sin(a) * r * (element === 'tho' ? 0.18 : w.groundSquash);
      q.pz = element === 'tho' ? 5 + Math.sin(a * 2) * 3 :
        element === 'moc' || element === 'hoa' ? 8 + rise * o.height :
        o.height * 0.55 + Math.sin(a * 2) * 18;
      q.rotation = element === 'kim' ? a + Math.PI / 2 : element === 'hoa' ? -0.15 * Math.sin(a) : a;
      q.alphaMul = element === 'hoa' ? Math.sin(rise * Math.PI) : element === 'moc' ? 0.35 + 0.65 * Math.sin(rise * Math.PI) : 0.65 + Math.sin(a) * 0.35;
    } }));
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
