// Plays a released .vfxb from the R2 CDN through the same runtime and Pixi version as the showcase.
// This chunk (PixiJS + runtime) loads only when a VFX preview is first opened.
import 'pixi.js/unsafe-eval';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GroundDissolveFilter, ISO_GROUND_SQUASH, VfxPlayer, type ActorPose, type Playback } from '../../../runtime/src/index.ts';
import runtimePkg from '../../../runtime/package.json' with { type: 'json' };
import type { VfxPreview } from '../data/catalog.ts';
import { BACKGROUNDS, type Background, type Engine, type Loaded, type Variant, pad3 } from './engine.ts';

// Same stage as the showcase: caster and target 360 px apart on a ground squashed by 0.6.
const W = 960, H = 600, SQUASH = 0.6;
const FROM = { x: 300, y: 372 }, TO = { x: 660, y: 372 };

// Actor Dummy, two small vector assets rasterised once at 2.5x their 96 × 130 box, feet_ground at (48, 122):
//  - caster: an unarmed clay mannequin in a neutral ready stance (suits spells, blades and strikes alike),
//  - target: a padded wooden training post planted in the ground (symmetric, so never mirrored).
const CASTER_URL = '/media/actor-caster.svg', TARGET_URL = '/media/actor-target.svg';
const DUMMY_RASTER = 2.5, DUMMY_FEET = { x: 48 / 96, y: 122 / 130 };
const CASTER_DECAL_RX = 22, TARGET_DECAL_RX = 26, TARGET_ZONE_RX = 52;

/**
 * Draw order, back to front: backdrop < ground (the packs' ground-under layers and background impact tiers)
 * < actor decals < actor bodies < world (the packs' main layers: the "roof") < body (residual auras over the target).
 */
interface Stage {
  app: Application; player: VfxPlayer; backdrop: Graphics;
  ground: Container; decals: Container; actors: Container; world: Container; body: Container;
}
let shared: Promise<Stage> | null = null;

function stage(host: HTMLElement): Promise<Stage> {
  shared ??= (async () => {
    const app = new Application();
    await app.init({ width: W, height: H, background: BACKGROUNDS.studio.fill, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true, preference: 'webgl', autoStart: false, sharedTicker: false });
    const backdrop = new Graphics(), ground = new Container(), decals = new Container(), actors = new Container(), world = new Container(), body = new Container();
    app.stage.addChild(backdrop, ground, decals, actors, world, body);
    // No hitstop or camera shake: the inspector keeps time linear so the scrubber maps 1:1 to frames.
    const player = await VfxPlayer.create(app, {
      maxResidentDirections: 1,
      groundDissolve: GroundDissolveFilter.supported(app) ? { filter: GroundDissolveFilter } : undefined,
    });
    return { app, player, backdrop, ground, decals, actors, world, body };
  })();
  return shared.then(s => { if (s.app.canvas.parentElement !== host) host.replaceChildren(s.app.canvas); return s; });
}

interface Dummy { casterTexture: Texture; targetTexture: Texture; caster: Sprite; target: Sprite; casterDecal: Graphics; targetDecal: Graphics }

async function rasterise(url: string): Promise<Texture> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return Texture.from(image);
}

/** Loads both silhouettes and builds the two stations; nothing exists until the toggle is first switched on. */
async function createDummy(s: Stage): Promise<Dummy> {
  const [casterTexture, targetTexture] = await Promise.all([rasterise(CASTER_URL), rasterise(TARGET_URL)]);
  const body = (texture: Texture) => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(DUMMY_FEET.x, DUMMY_FEET.y);
    s.actors.addChild(sprite);
    return sprite;
  };
  // Contact decals locked to feet_ground (0, 0), every ellipse in the 1/√3 isometric ground ratio (0.57735):
  // an AO disc with a lead rim and a centre tick. The target's also marks the skill's contact zone with an
  // outer ring and four ticks, so the landing point and the area around it can be read against any effect.
  const decal = (rx: number, zone: number) => {
    const ratio = ISO_GROUND_SQUASH, g = new Graphics();
    g.ellipse(0, 0, rx, rx * ratio).fill({ color: 0x05070a, alpha: 0.5 })
      .ellipse(0, 0, rx * 0.6, rx * 0.6 * ratio).fill({ color: 0x05070a, alpha: 0.35 })
      .ellipse(0, 0, rx, rx * ratio).stroke({ width: 1.2, color: 0x30363d, alpha: 1 });
    if (zone) {
      g.ellipse(0, 0, zone, zone * ratio).stroke({ width: 1, color: 0x30363d, alpha: 0.7 });
      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.moveTo(x * (zone - 4), y * (zone - 4) * ratio).lineTo(x * (zone + 4), y * (zone + 4) * ratio);
      g.stroke({ width: 1.2, color: 0x4a525d, alpha: 0.9 });
    }
    g.moveTo(-5, 0).lineTo(5, 0).moveTo(0, -5 * ratio).lineTo(0, 5 * ratio).stroke({ width: 1, color: 0x6e7681, alpha: 0.85 });
    s.decals.addChild(g);
    return g;
  };
  return {
    casterTexture, targetTexture,
    caster: body(casterTexture), target: body(targetTexture),
    casterDecal: decal(CASTER_DECAL_RX, 0), targetDecal: decal(TARGET_DECAL_RX, TARGET_ZONE_RX),
  };
}

function destroyDummy(d: Dummy) {
  for (const node of [d.caster, d.target, d.casterDecal, d.targetDecal]) node.destroy();
  for (const texture of [d.casterTexture, d.targetTexture]) texture.destroy(true); // frees the GPU copy and the source image
}

let loadedId: string | null = null;

export async function createVfxEngine(host: HTMLElement, preview: VfxPreview): Promise<Engine> {
  const s = await stage(host);
  const { app, player } = s;
  const layers = { background: s.ground, overlay: s.body };
  let handle: Playback | null = null, fps = 30, durationMs = 1, frames = 1;
  let playing = true, speed = 1, raf = 0, last = 0, frame = -1, dirty = true, bg: Background = 'studio';
  let dummy: Dummy | null = null, dummyOn = false, dummyLoad: Promise<Dummy> | null = null;
  // Reused every frame for the packs' actor tracks (dashes, knock-backs, lifts). Seeded with fractional values so
  // V8 lays the fields out as doubles up front and the runtime's per-frame writes never change their shape.
  const casterPose: ActorPose = { x: 0.5, y: 0.5, lift: 0.5, visible: true, facing: 1 };
  const targetPose: ActorPose = { x: 0.5, y: 0.5, lift: 0.5, visible: true, facing: 1 };

  const play = () => player.play(preview.id, { from: FROM, to: TO, groundSquash: SQUASH, parent: s.world, layers, loop: true });

  function drawBackdrop() {
    const g = s.backdrop, c = BACKGROUNDS[bg];
    g.clear().rect(0, 0, W, H).fill(c.fill);
    if (bg === 'grid') {
      // Isometric ground grid on the effect's own ground plane (squash 0.6), centred between caster and target.
      const cx = (FROM.x + TO.x) / 2, cy = FROM.y, step = 60;
      for (let k = -24; k <= 24; k++) {
        const ox = k * step;
        g.moveTo(cx + ox - 1200, cy - 1200 * SQUASH).lineTo(cx + ox + 1200, cy + 1200 * SQUASH);
        g.moveTo(cx + ox - 1200, cy + 1200 * SQUASH).lineTo(cx + ox + 1200, cy - 1200 * SQUASH);
      }
      g.stroke({ width: 1, color: c.line, alpha: 0.9 });
    } else if (bg === 'scorch') {
      // Burnt earth: a few soft, darker rings under the target to judge how ground decals blend.
      for (let r = 5; r >= 1; r--) g.ellipse(TO.x, TO.y, 40 * r, 40 * r * SQUASH).fill({ color: 0x120d08, alpha: 0.12 });
      for (let r = 3; r >= 1; r--) g.ellipse(FROM.x, FROM.y, 26 * r, 26 * r * SQUASH).fill({ color: 0x120d08, alpha: 0.1 });
    }
    // Caster and target marks on the ground (the dummy's own decal replaces them while it is shown).
    if (!dummyOn) {
      g.ellipse(FROM.x, FROM.y, 26, 26 * SQUASH).stroke({ width: 1.5, color: c.mark, alpha: 1 });
      g.ellipse(TO.x, TO.y, 26, 26 * SQUASH).stroke({ width: 1.5, color: c.mark, alpha: 1 });
    }
    dirty = true;
  }

  // Track offsets are relative to each station. The caster looks at the target and a set facing bit turns it
  // around; the training post is symmetric, so it never mirrors.
  function place(body: Sprite, decal: Graphics, home: { x: number; y: number }, p: ActorPose | null, turns: boolean) {
    const x = home.x + (p ? p.x : 0), y = home.y + (p ? p.y : 0), lift = p && p.lift > 0 ? p.lift : 0;
    const shown = !p || p.visible;
    body.visible = decal.visible = shown;
    body.position.set(x, y - lift);
    body.scale.set((turns && p ? p.facing : 1) / DUMMY_RASTER, 1 / DUMMY_RASTER);
    decal.position.set(x, y); // the decal stays on the ground and shrinks as the body lifts
    const k = 1 / (1 + lift / 48);
    decal.scale.set(k, k);
  }

  function placeDummy() {
    if (!dummy || !dummyOn) return;
    place(dummy.caster, dummy.casterDecal, FROM, handle ? handle.pose('caster', casterPose) : null, true);
    place(dummy.target, dummy.targetDecal, TO, handle ? handle.pose('target', targetPose) : null, false);
  }

  // One closure for the life of the engine: the loop itself allocates nothing per frame.
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    if (playing && handle) { player.update(dt * speed); dirty = true; }
    if (!dirty) return;
    dirty = false;
    placeDummy();
    app.render();
    if (!handle) return;
    const i = Math.min(frames - 1, ((handle.elapsedMs * fps) / 1000) | 0);
    if (i !== frame) { frame = i; engine.onFrame(i); }
  };

  const engine: Engine = {
    onFrame: () => {},
    async load(variant: Variant): Promise<Loaded> {
      handle?.stop(); handle = null;
      if (loadedId) player.unload(loadedId);
      const pack = preview.packs[variant];
      await player.load(pack.url);
      loadedId = preview.id;
      const m = player.getManifest(preview.id)!;
      fps = m.fps; durationMs = m.durationMs; frames = m.frameCount;
      // Bounds of everything drawn in each frame, in pack pixels (layer frames are stored at their own scale).
      const minX = new Float32Array(frames).fill(Infinity), minY = new Float32Array(frames).fill(Infinity);
      const maxX = new Float32Array(frames).fill(-Infinity), maxY = new Float32Array(frames).fill(-Infinity);
      for (const layer of m.layers) {
        const k = 1 / (layer.scale ?? m.scale);
        layer.frames.forEach((f, i) => {
          if (!f) return;
          minX[i] = Math.min(minX[i], f[5]); minY[i] = Math.min(minY[i], f[6]);
          maxX[i] = Math.max(maxX[i], f[5] + f[3] * k); maxY[i] = Math.max(maxY[i], f[6] + f[4] * k);
        });
      }
      const total = (durationMs / 1000).toFixed(2);
      const loaded: Loaded = {
        frames,
        frameLabels: Array.from({ length: frames }, (_, i) => `${pad3(i + 1)} / ${frames} @ ${fps} FPS`),
        timeLabels: Array.from({ length: frames }, (_, i) => `${(i / fps).toFixed(2)} / ${total} s`),
        dimLabels: Array.from({ length: frames }, (_, i) => (maxX[i] > minX[i] ? `${Math.round(maxX[i] - minX[i])}×${Math.round(maxY[i] - minY[i])} px` : 'empty')),
        runtime: `pixijs-vfx ${runtimePkg.version} · PixiJS 8 · ${String((app.renderer as { name?: string }).name ?? 'gl').toUpperCase()}`,
        source: `${preview.id}${variant === 'mobile' ? '.m' : ''}.vfxb · ${(pack.bytes / 1e6).toFixed(2)} MB`,
        vramBytes: pack.vram,
        sheets: `${pack.sheets} WebP sheets ≤ ${pack.maxSheet}px`,
      };
      handle = play(); player.update(0); frame = -1; dirty = true;
      return loaded;
    },
    setPlaying(on) { playing = on; last = 0; },
    setSpeed(x) { speed = x; },
    seek(i) {
      const t = (Math.max(0, Math.min(frames - 1, i)) * 1000) / fps;
      if (handle && t >= handle.elapsedMs) player.update(t - handle.elapsedMs); // looping plays never end on their own
      else { handle?.stop(); handle = play(); player.update(t); }
      dirty = true;
    },
    setBackground(next) { bg = next; drawBackdrop(); },
    async setDummy(on) {
      dummyOn = on;
      if (on && !dummy) {
        const load = (dummyLoad ??= createDummy(s));
        const made = await load;
        if (load !== dummyLoad) return; // released while loading; release() destroys it
        dummy = made;
      }
      if (dummy) s.decals.visible = s.actors.visible = dummyOn;
      drawBackdrop();
    },
    // Live GL textures. Pixi (>= 8.15) nulls a freed entry instead of deleting it, so count only live ones.
    gpuTextures: () => {
      const list = (app.renderer as unknown as { texture?: { managedTextures?: readonly unknown[] } }).texture?.managedTextures;
      if (!list) return -1;
      let n = 0;
      for (let i = 0; i < list.length; i++) if (list[i]) n++;
      return n;
    },
    start() { if (!raf) { last = 0; dirty = true; raf = requestAnimationFrame(tick); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    release() {
      handle?.stop(); handle = null;
      if (loadedId) { player.unload(loadedId); loadedId = null; }
      // The dummy belongs to this inspector session: free its texture with the pack.
      const pending = dummyLoad;
      dummyLoad = null; dummyOn = false;
      if (dummy) { destroyDummy(dummy); dummy = null; } else void pending?.then(destroyDummy, () => {});
      player.update(0); app.render();
    },
  };
  drawBackdrop();
  return engine;
}
