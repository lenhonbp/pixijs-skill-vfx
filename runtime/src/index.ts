// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Container, Sprite, Texture } from 'pixi.js';
import type { Application } from 'pixi.js';
import { colorMatrixFilterClass, frameTexture, setBlend, setMatrix, v8 } from './compat.js';
import { readContainer, validate } from './format.js';
import type { ActorName, AnchorType, BlendAdvice, Cue, ImpactTier, Manifest, TierId, ZLayer } from './format.js';
export type { ActorName, ActorFrame, ActorTrack, AnchorType, BlendAdvice, Cue, ImpactMeta, ImpactTier, Manifest, Frame, TierId, ZLayer } from './format.js';
export interface Point { x: number; y: number }
export { FlowTrail, makeNoiseTexture } from './flow.js';
export type { FlowTrailOptions } from './flow.js';
/** Where the three depth slots of an impact draw. Missing slots fall back to `PlayOptions.parent` (or the stage). */
export interface ImpactLayers {
  /** Ground feedback (decals, shockwaves): put it under every actor. */
  background?: Container;
  /** Body residual (aura, wisps): put it right above the target's sprite. */
  overlay?: Container;
  /** Hit point (flash, sparks): put it above everything. */
  foreground?: Container;
}
export interface PlayOptions {
  from: Point; to?: Point; parent?: Container; zIndex?: number; speed?: number; fitDistance?: boolean; loop?: boolean;
  /** Containers for the impact tiers' depth slots (packs with an `impact` block only). */
  layers?: ImpactLayers;
  /** Switch impact tiers off, for example `{ body_residual: false }` on low-end devices. All on by default. */
  tiers?: Partial<Record<TierId, boolean>>;
  /** Draw a tier's additive layers with its recommended blend (SCREEN for the body residual). Default true. */
  recommendedBlend?: boolean;
  /**
   * Combat juice at every contact (each `hit` cue of the pack). `true` freezes the player for 2 frames (32 ms); a number
   * is the freeze in ms (0-100). Freezes every playback, not just this one, and sets `player.frozen`.
   */
  hitstop?: boolean | number;
  /** Entity the blow lands on. Flashed at contact, and used as `to` when `to` is omitted (read live: its x/y are the feet). */
  target?: FlashTarget;
  /** Silhouette flash of `target` at contact. Default (with a `target`): 100% white, held 2 frames, then a short decay. `false` disables it. */
  flash?: false | { color?: number; frames?: number; decayMs?: number };
  /**
   * Camera impulse along the blow direction, in px (default 2.5 when `hitstop` or a `target` is given and the player was
   * created with `shake: { target }`). `false` disables it. Replaces the pack's own non-directional shake cue for this play.
   */
  impulse?: false | number;
  /** Your camera's ground squash (ground y / screen y). Defaults to the pack's bake value. */
  groundSquash?: number;
}
/** Anything with a position that can carry a filter: a Sprite, or a Container holding sprites. */
export type FlashTarget = Container & { x: number; y: number };
export interface PlayerOptions {
  packs?: string[]; loadKey?: string; shake?: { target: Container }; hitstop?: boolean;
  /**
   * Hand listeners one shared event object per type instead of a fresh one per event. Nothing is allocated when a cue or
   * tier fires, but the object is only valid inside the callback (copy what you need). Default false.
   */
  reuseEvents?: boolean;
}
export interface ActorPose { x: number; y: number; lift: number; visible: boolean; facing: number }
export interface Playback {
  stop(): void;
  /** Resolves on natural end, stop, unload or destroy. Created on first read, so plays that never look at it allocate no Promise. */
  readonly finished: Promise<void>;
  readonly elapsedMs: number; readonly manifest: Manifest;
  /** Pose of a tracked actor. Pass `out` (a reusable object) to avoid allocating one per call. */
  pose(name: ActorName, out?: ActorPose): ActorPose | null;
}
export type CueEvent = Cue & { packId: string; handle: Playback };
/** Fired once when an impact tier starts. `point` is where the tier is anchored in the parent's space, right now. */
export interface TierEvent {
  tier: TierId; tierNumber: 1 | 2 | 3; packId: string; handle: Playback;
  point: Point; anchorType: AnchorType;
  /** contact_normal tiers: surface normal in degrees (0 = right), mirrored for left casts. */
  normalDeg?: number;
  zLayer: ZLayer; blend: BlendAdvice; startMs: number;
}
interface Pack { manifest: Manifest; sheets: Texture[]; frames: (Texture | null)[][] }
/** Ground-plane directions (degrees) the free packs are baked in; left-facing casts mirror them. */
export const PACK_DIRECTIONS = [0, 45, 90, -45, -90] as const;
const keyOf = (m: Manifest) => m.direction ? `${m.id}@${m.direction}` : m.id;
/**
 * Nearest baked direction for a cast from `from` to `to`, and whether it plays mirrored.
 * Load `<id>@<direction>.vfxb` (or `<id>.vfxb` for 0) before playing, if the pack ships directions.
 */
export function packDirection(from: Point, to: Point, groundSquash = 0.6, available: readonly number[] = PACK_DIRECTIONS): { direction: number; mirror: boolean } {
  const dx = to.x - from.x, dy = (to.y - from.y) / groundSquash;
  if (Math.hypot(dx, dy) < 1e-6) return { direction: available.includes(0) ? 0 : available[0], mirror: false };
  const angle = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
  const direction = available.reduce((best, d) => Math.abs(d - angle) < Math.abs(best - angle) ? d : best, available[0]);
  return { direction, mirror: dx < 0 };
}
/** One impact tier of a playing pack: its own root, so it can sit in a different depth slot than the rest. */
interface TierPlan { tier: ImpactTier; root: Container; enabled: boolean; startMs: number }
const Z_BIAS: Record<ZLayer, number> = { background: -1, target_overlay: 1, foreground: 2 };
/**
 * Minimal object pool. `acquire()` hands back a released item (or makes one the first time) and `release()` takes it
 * back, so steady-state play allocates nothing. The player pools every sprite and root container this way.
 */
export class Pool<T> {
  private items: T[] = [];
  constructor(private make: () => T) {}
  acquire(): T { return this.items.length ? this.items.pop() as T : this.make(); }
  release(item: T): void { this.items.push(item); }
  get size(): number { return this.items.length; }
  /** Empties the pool, optionally disposing each item first. */
  drain(each?: (item: T) => void): void { if (each) for (let i = 0; i < this.items.length; i++) each(this.items[i]); this.items.length = 0; }
}
interface Active {
  pack: Pack; options: PlayOptions; legacy: boolean; matrix: [number, number, number, number]; root: Container; sprites: Sprite[]; time: number; cue: number;
  /** Where the blow lands: `to`, else the live target, else `from`. */
  dest: Point;
  /** Impact tiers (empty for packs without an impact block), the plan owning each layer, tiers by start time, next tier to fire. */
  tiers: TierPlan[]; tierOf: (TierPlan | undefined)[]; tierOrder: TierPlan[]; tierCursor: number;
  /** Juice requested for this play (resolved once at play time). */
  juice: boolean; freezeMs: number; impulsePx: number; flashColor: number; flashFrames: number; flashDecayMs: number;
  done: boolean; poseResets: number; handle: Playback; promise: Promise<void> | null; resolve: (() => void) | null;
}
/** One running silhouette flash: the filter lives on the target until the flash ends. */
interface Flash { target: Container | null; filter: any; list: any[]; prev: any; age: number; color: number; hold: number; decay: number }
const MAX_LOOP_CYCLES_PER_UPDATE = 32;
export class VfxPlayer {
  shakeEnabled: boolean;
  hitstopEnabled: boolean;
  private packs = new Map<string, Pack>();
  private families = new Map<string, Pack[]>();
  private list: Active[] = [];
  private live = 0;
  private updating = false;
  private sprites = new Pool<Sprite>(() => { const sprite = new Sprite(); sprite.anchor.set(0); return sprite; });
  private roots = new Pool<Container>(() => new Container());
  private listeners: ((event: CueEvent) => void)[] = [];
  private tierListeners: ((event: TierEvent) => void)[] = [];
  // Event objects are reused for every emit: read them inside the listener, do not keep them.
  private cueEvent = { t: 0, type: '', id: undefined, amp: undefined, ms: undefined, packId: '', handle: null } as unknown as CueEvent;
  private tierEvent = { tier: 'hit_point', tierNumber: 1, packId: '', handle: null, point: { x: 0, y: 0 }, anchorType: 'contact_normal', normalDeg: undefined, zLayer: 'foreground', blend: 'ADD', startMs: 0 } as unknown as TierEvent;
  private scratch: [number, number, number, number] = [1, 0, 0, 1];
  private point: Point = { x: 0, y: 0 };
  private freezeLeft = 0;
  /** Freeze requested by a pack's own hitstop cue: switched off together with `hitstopEnabled`. */
  private cueFreeze = 0;
  private impulse = { age: 0, duration: 0, amp: 0, dx: 0, dy: 0, x: 0, y: 0 };
  private flashes: Flash[] = [];
  private flashPool = new Pool<Flash>(() => ({ target: null, filter: null, list: [], prev: null, age: 0, color: 0xffffff, hold: 0, decay: 0 }));
  private filters = new Pool<any>(() => new (colorMatrixFilterClass())());
  private dead = false;
  private loading = new Map<string, Promise<void>>();
  private requestSerial = 0;
  private cancelledLoads = new Map<string, number>();
  private shake = { age: 0, duration: 0, amp: 0, x: 0, y: 0 };
  private tick = (ticker: any) => this.update(v8 ? ticker.deltaMS : (this.app.ticker as any).deltaMS);
  constructor(private app: Application, private options: PlayerOptions = {}) {
    this.shakeEnabled = !!options.shake; this.hitstopEnabled = !!options.hitstop;
    app.ticker.add(this.tick);
  }
  static async create(app: Application, options: PlayerOptions = {}) {
    const player = new VfxPlayer(app, options);
    try { if (options.packs) await player.load(options.packs); return player; }
    catch (error) { player.destroy(); throw error; }
  }
  async load(urls: string | string[]): Promise<void> {
    if (this.dead) throw Error('VfxPlayer is destroyed');
    for (const url of typeof urls === 'string' ? [urls] : urls) {
      let task = this.loading.get(url);
      if (!task) {
        task = this.loadOne(url, ++this.requestSerial); this.loading.set(url, task);
        task.finally(() => this.loading.delete(url)).catch(() => {});
      }
      await task;
    }
  }
  private async loadOne(url: string, request: number) {
    const response = await fetch(url);
    if (!response.ok) throw Error(`VFX load failed (${response.status}): ${url}`);
    const binary = new URL(url, document.baseURI).pathname.endsWith('.vfxb');
    const decoded = binary ? readContainer(await response.arrayBuffer(), this.options.loadKey) : null;
    const manifest = decoded?.manifest ?? validate(await response.json());
    manifest.cues = manifest.cues.slice().sort((a, b) => a.t - b.t);
    if (this.dead) throw Error('VfxPlayer is destroyed');
    const key = keyOf(manifest);
    if ((this.cancelledLoads.get(manifest.id) ?? 0) >= request) throw Error(`VFX load cancelled: ${manifest.id}`);
    if (this.packs.has(key)) return;
    const textures = new Map<string, Texture>(), frames: (Texture | null)[][] = [];
    try {
      for (const name of new Set(manifest.layers.flatMap(l => l.sheets))) {
        let src: string;
        if (decoded) {
          const bytes = decoded.sheets.get(name); if (!bytes) throw Error(`Missing sheet: ${name}`);
          src = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/webp' }));
        } else src = new URL(name, new URL(url, document.baseURI)).href;
        try {
          const image = new Image(); image.crossOrigin = 'anonymous'; image.src = src; await image.decode();
          textures.set(name, Texture.from(image));
        } finally { if (decoded) URL.revokeObjectURL(src); }
      }
      for (const layer of manifest.layers) {
        const row: (Texture | null)[] = []; frames.push(row);
        for (const frame of layer.frames) {
          if (!frame) { row.push(null); continue; }
          const [sheet, x, y, w, h] = frame, texture = textures.get(layer.sheets[sheet])!;
          if (x + w > texture.width || y + h > texture.height) throw Error('Frame outside sheet');
          row.push(frameTexture(texture, x, y, w, h));
        }
      }
      if (this.dead) throw Error('VfxPlayer is destroyed');
      if ((this.cancelledLoads.get(manifest.id) ?? 0) >= request) throw Error(`VFX load cancelled: ${manifest.id}`);
      if (this.packs.has(key)) { frames.flat().forEach(t => t?.destroy()); textures.forEach(t => t.destroy(true)); return; }
      const pack = { manifest, sheets: [...textures.values()], frames };
      this.packs.set(key, pack);
      this.families.set(manifest.id, [...(this.families.get(manifest.id) ?? []), pack]);
    } catch (error) { frames.flat().forEach(t => t?.destroy()); textures.forEach(t => t.destroy(true)); throw error; }
  }
  play(id: string, options: PlayOptions): Playback {
    if (this.dead) throw Error('VfxPlayer is destroyed');
    if (!this.families.get(id)?.length) throw Error(`Pack not loaded: ${id}`);
    if (!options?.from || !Number.isFinite(options.from.x) || !Number.isFinite(options.from.y) || (options.to && (!Number.isFinite(options.to.x) || !Number.isFinite(options.to.y))) || (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed <= 0))) throw Error('Invalid playback options');
    const { pack, legacy } = this.aim(id, options);
    const manifest = pack.manifest, base = options.zIndex ?? 0, parent = options.parent ?? this.app.stage;
    const root = this.roots.acquire();
    root.zIndex = base;
    // Impact tiers get a root each so they can sit in their own depth slot; everything else stays in `root`.
    const impactTiers = manifest.impact?.tiers, tiers: TierPlan[] = [];
    if (impactTiers) for (let i = 0; i < impactTiers.length; i++) {
      const tier = impactTiers[i], tierRoot = this.roots.acquire();
      tierRoot.zIndex = base + Z_BIAS[tier.default_z_layer];
      tiers.push({ tier, root: tierRoot, enabled: options.tiers?.[tier.id] !== false, startMs: tier.start_frame * 1000 / manifest.fps });
    }
    const tierOf: (TierPlan | undefined)[] = [], sprites: Sprite[] = [];
    for (let li = 0; li < manifest.layers.length; li++) {
      const layer = manifest.layers[li];
      let plan: TierPlan | undefined;
      for (let t = 0; t < tiers.length && !plan; t++) if (tiers[t].tier.layers.includes(layer.name)) plan = tiers[t];
      tierOf.push(plan);
      const sprite = this.sprites.acquire(); sprite.visible = false;
      setBlend(sprite, layer.blend === 'add', !!plan && options.recommendedBlend !== false && plan.tier.recommended_blend_mode === 'SCREEN');
      (plan ? plan.root : root).addChild(sprite); sprites.push(sprite);
    }
    // Display order bottom to top: background tiers, the pack's own layers, target overlay, foreground.
    const attach = (z: ZLayer) => {
      for (let i = 0; i < tiers.length; i++) {
        const plan = tiers[i];
        if (plan.tier.default_z_layer !== z || !plan.enabled) continue;
        ((z === 'background' ? options.layers?.background : z === 'target_overlay' ? options.layers?.overlay : options.layers?.foreground) ?? parent).addChild(plan.root);
      }
    };
    attach('background'); parent.addChild(root); attach('target_overlay'); attach('foreground');
    const target = options.target, targetOk = !!target && Number.isFinite(target.x) && Number.isFinite(target.y);
    const juice = options.hitstop !== undefined && options.hitstop !== false || targetOk;
    const flash = options.flash === false ? null : options.flash ?? {};
    const player = this;
    const a: Active = { pack, options, legacy, matrix: [1, 0, 0, 1], root, sprites, time: 0, cue: 0, dest: options.to ?? (targetOk ? target as Point : options.from),
      tiers, tierOf, tierOrder: tiers.slice().sort((x, y) => x.tier.start_frame - y.tier.start_frame), tierCursor: 0,
      juice, freezeMs: options.hitstop === true ? 32 : typeof options.hitstop === 'number' ? Math.max(0, Math.min(100, options.hitstop)) : 0,
      impulsePx: options.impulse === false ? 0 : options.impulse ?? (juice ? 2.5 : 0),
      flashColor: flash?.color ?? 0xffffff, flashFrames: flash ? Math.max(0, flash.frames ?? 2) : 0, flashDecayMs: flash?.decayMs ?? 80,
      done: false, poseResets: 0, promise: null, resolve: null,
      handle: {
        get finished() { if (!a.promise) a.promise = a.done ? Promise.resolve() : new Promise<void>(done => { a.resolve = done; }); return a.promise; },
        pose(name: ActorName, out?: ActorPose): ActorPose | null { return player.pose(a, name, out); },
        get manifest() { return structuredClone(pack.manifest); },
        get elapsedMs() { return a.done ? 0 : a.time; },
        stop: () => this.finish(a),
      } as Playback };
    this.list.push(a); this.live++; this.draw(a); this.emitCues(a);
    return a.handle;
  }
  /** Actor pose for a playback; see `Playback.pose`. */
  private pose(a: Active, name: ActorName, out?: ActorPose): ActorPose | null {
    const manifest = a.pack.manifest, track = manifest.actors?.[name];
    if (!track) return null;
    const result = out ?? { x: 0, y: 0, lift: 0, visible: true, facing: 1 };
    if (a.done) {
      const bit = name === 'caster' ? 1 : 2;
      if (a.poseResets & bit) return null;
      a.poseResets |= bit;
      result.x = 0; result.y = 0; result.lift = 0; result.visible = true; result.facing = 1;
      return result;
    }
    const frame = Math.min(manifest.frameCount - 1, a.time * manifest.fps / 1000);
    const i = Math.floor(frame), t = frame - i, f = track.frames[i], next = track.frames[Math.min(i + 1, track.frames.length - 1)];
    const x = f[0] + (next[0] - f[0]) * t, y = f[1] + (next[1] - f[1]) * t, m = a.matrix;
    result.x = m[0] * x + m[2] * y; result.y = m[1] * x + m[3] * y; result.lift = f[2] + (next[2] - f[2]) * t;
    result.visible = !!(f[3] & 1); result.facing = (f[3] & 2 ? -1 : 1) * Math.sign(m[0] || 1);
    return result;
  }
  on(type: 'cue', listener: (event: CueEvent) => void): this;
  /** Fires once when an impact tier starts (hit point, then ground feedback, then body residual), with its live anchor. */
  on(type: 'tier', listener: (event: TierEvent) => void): this;
  // Listener lists are copy-on-write: an emit in progress keeps iterating the list it started with.
  on(type: 'cue' | 'tier', listener: any): this { if (type === 'cue') this.listeners = [...this.listeners, listener]; else this.tierListeners = [...this.tierListeners, listener]; return this; }
  off(type: 'cue', listener: (event: CueEvent) => void): this;
  off(type: 'tier', listener: (event: TierEvent) => void): this;
  off(type: 'cue' | 'tier', listener: any): this { if (type === 'cue') this.listeners = this.listeners.filter(l => l !== listener); else this.tierListeners = this.tierListeners.filter(l => l !== listener); return this; }
  stats() { return { active: this.live, pooled: this.sprites.size, packs: this.packs.size }; }
  /** True while a hit-stop freeze is running. Pause your own game logic on it so everything stops together. */
  get frozen(): boolean { return this.freezeLeft > 0 || (this.hitstopEnabled && this.cueFreeze > 0); }
  /** Freezes every playback for `ms` (0-1000); overlapping freezes keep the longest. Playback resumes where it stopped. */
  freeze(ms: number): void { if (ms > 0) this.freezeLeft = Math.max(this.freezeLeft, Math.min(ms, 1000)); }
  /** Baked directions loaded for a pack id, in degrees. */
  directions(id: string): number[] { return (this.families.get(id) ?? []).map(p => p.manifest.direction ?? 0); }
  /**
   * Picks the loaded bake nearest the cast's ground direction. Packs without a bake direction
   * (all 1.0 packs) are "legacy": they keep the left/right mirror from 1.0.
   */
  private aim(id: string, o: PlayOptions): { pack: Pack; legacy: boolean } {
    const list = this.families.get(id)!, to = o.to ?? o.from, base = list.find(p => !p.manifest.direction) ?? list[0];
    if (base.manifest.direction === undefined && list.length === 1) return { pack: base, legacy: true };
    const squash = o.groundSquash ?? base.manifest.groundSquash ?? 0.6;
    const { direction } = packDirection(o.from, to, squash, list.map(p => p.manifest.direction ?? 0));
    return { pack: list.find(p => (p.manifest.direction ?? 0) === direction)!, legacy: false };
  }
  /**
   * Root transform landing the pack's baked target on `to` right now: x mirrored for left casts,
   * then the smallest linear correction for the remaining angle and distance. Past ~70 degrees of
   * correction the shear degenerates, so the bake is rotated and scaled onto the cast instead.
   * Recomputed per draw so live endpoints keep tracking; legacy packs keep the 1.0 per-frame mirror.
   * Writes [a, b, c, d] into `out` (no allocation).
   */
  private matrix(a: Active, out: [number, number, number, number]): void {
    const m = a.pack.manifest, o = a.options, to = a.dest;
    if (a.legacy) {
      const mirror = to.x < o.from.x ? -1 : 1, span = Math.abs(m.target.x - m.origin.x);
      const fit = o.fitDistance && span > 0 ? Math.abs(to.x - o.from.x) / span : 1;
      out[0] = mirror * fit; out[1] = 0; out[2] = 0; out[3] = 1;
      return;
    }
    const squash = o.groundSquash ?? m.groundSquash ?? 0.6, s = to.x < o.from.x ? -1 : 1;
    const tx = m.target.x - m.origin.x, ty = m.target.y - m.origin.y, t2 = tx * tx + ty * ty;
    let dx = s * (to.x - o.from.x), dy = to.y - o.from.y;
    const dLen = Math.hypot(dx, dy / squash);
    if (t2 === 0 || dLen < 1e-6) { out[0] = s; out[1] = 0; out[2] = 0; out[3] = 1; return; }
    if (!o.fitDistance) { const k = Math.hypot(tx, ty / squash) / dLen; dx *= k; dy *= k; }
    const dot = dx * tx + dy * ty;
    if (dot <= 0.3 * Math.sqrt((dx * dx + dy * dy) * t2)) {
      const p = dot / t2, q = (dx * ty - dy * tx) / t2;
      out[0] = s * p; out[1] = s * q; out[2] = -q; out[3] = p;
      return;
    }
    const ex = (dx - tx) / t2, ey = (dy - ty) / t2;
    out[0] = s * (1 + ex * tx); out[1] = ey * tx; out[2] = s * ex * ty; out[3] = 1 + ey * ty;
  }
  getManifest(id: string): Manifest | undefined {
    const manifest = (this.packs.get(id) ?? this.families.get(id)?.[0])?.manifest;
    return manifest ? structuredClone(manifest) : undefined;
  }
  private draw(a: Active) {
    const m = a.pack.manifest, o = a.options, to = a.dest, anchor = m.anchor === 'target' ? to : o.from, mx = a.matrix;
    this.matrix(a, mx);
    setMatrix(a.root, mx[0], mx[1], mx[2], mx[3], anchor.x, anchor.y);
    const s = Math.sign(mx[0]) || 1;
    for (let i = 0; i < a.tiers.length; i++) { const plan = a.tiers[i]; this.tierPoint(a, plan, mx, this.point); setMatrix(plan.root, s, 0, 0, 1, this.point.x, this.point.y); }
    const index = Math.min(m.frameCount - 1, Math.floor(a.time * m.fps / 1000)), layers = m.layers;
    for (let li = 0; li < a.sprites.length; li++) {
      const sprite = a.sprites[li], f = layers[li].frames[index], t = a.pack.frames[li][index], plan = a.tierOf[li];
      sprite.visible = !!f && (!plan || plan.enabled);
      // A tier's frames are drawn around its anchor, so the tier root alone decides where the impact lands.
      if (f && t) {
        sprite.texture = t;
        if (plan) sprite.position.set(f[5] - plan.tier.anchor_point.x, f[6] - plan.tier.anchor_point.y); else sprite.position.set(f[5], f[6]);
        const k = 1 / (layers[li].scale ?? m.scale); sprite.scale.set(k, k);
      }
    }
  }
  /**
   * Where an impact tier is anchored in the parent's space: the baked target's feet as the pack places them
   * (so tiers land where the rest of the pack does; exactly on `to` with fitDistance), then the tier's own height
   * above the feet. Tiers are translated and mirrored only, never sheared or stretched. Writes into `out`.
   */
  private tierPoint(a: Active, plan: TierPlan, matrix: [number, number, number, number], out: Point): void {
    const m = a.pack.manifest, s = Math.sign(matrix[0]) || 1, at = plan.tier.anchor_point;
    let fx: number, fy: number;
    if (m.anchor === 'target') { fx = a.dest.x; fy = a.dest.y; }
    else { fx = a.options.from.x + matrix[0] * m.target.x + matrix[2] * m.target.y; fy = a.options.from.y + matrix[1] * m.target.x + matrix[3] * m.target.y; }
    out.x = fx + s * (at.x - m.target.x); out.y = fy + (at.y - m.target.y);
  }
  private emitTiers(a: Active): boolean {
    while (a.tierCursor < a.tierOrder.length && a.tierOrder[a.tierCursor].startMs <= a.time) {
      const plan = a.tierOrder[a.tierCursor++], ls = this.tierListeners;
      if (!plan.enabled || !ls.length) continue;
      const mx = this.scratch, t = plan.tier, s = (this.matrix(a, mx), Math.sign(mx[0]) || 1);
      const ev = this.options.reuseEvents ? this.tierEvent : { point: { x: 0, y: 0 } } as TierEvent;
      this.tierPoint(a, plan, mx, ev.point);
      ev.tier = t.id; ev.tierNumber = t.tier; ev.packId = a.pack.manifest.id; ev.handle = a.handle; ev.anchorType = t.anchor_type;
      ev.zLayer = t.default_z_layer; ev.blend = t.recommended_blend_mode; ev.startMs = plan.startMs;
      ev.normalDeg = t.normal_deg === undefined ? undefined : ((s < 0 ? 180 - t.normal_deg : t.normal_deg) % 360 + 360) % 360;
      for (let i = 0; i < ls.length; i++) ls[i](ev);
      if (this.dead || a.done) return false;
    }
    return true;
  }
  private emitCues(a: Active) {
    if (!this.emitTiers(a)) return false;
    const cues = a.pack.manifest.cues, camera = this.options.shake?.target;
    while (a.cue < cues.length && cues[a.cue].t <= a.time) {
      const cue = cues[a.cue++];
      if (cue.type === 'hit' && a.juice) this.juiceHit(a);
      // A play that asks for juice owns the freeze and the shake: the pack's own cues would double up.
      if (cue.type === 'hitstop' && this.hitstopEnabled && !(a.juice && a.freezeMs > 0)) this.cueFreeze = Math.max(this.cueFreeze, Math.min(cue.ms ?? 0, 1000));
      if (cue.type === 'shake' && this.shakeEnabled && !(a.juice && a.impulsePx > 0 && camera)) { const s = this.shake; s.age = 0; s.duration = cue.ms ?? 0; s.amp = cue.amp ?? 0; }
      const ev = this.options.reuseEvents ? this.cueEvent : { t: 0, type: '', packId: '' } as CueEvent, ls = this.listeners;
      ev.t = cue.t; ev.type = cue.type; ev.id = cue.id; ev.amp = cue.amp; ev.ms = cue.ms; ev.packId = a.pack.manifest.id; ev.handle = a.handle;
      for (let i = 0; i < ls.length; i++) ls[i](ev);
      if (this.dead || a.done) return false;
    }
    return !this.dead && !a.done;
  }
  /** Contact: micro-freeze, camera impulse along the blow, silhouette flash of the target. */
  private juiceHit(a: Active) {
    if (a.freezeMs > 0) this.freeze(a.freezeMs);
    const camera = this.options.shake?.target;
    if (a.impulsePx > 0 && camera) {
      const mx = this.scratch, hv = a.pack.manifest.impact?.hit_vector;
      let dx: number, dy: number;
      if (hv) { this.matrix(a, mx); dx = hv.x * (Math.sign(mx[0]) || 1); dy = hv.y; }
      else { dx = a.dest.x - a.options.from.x; dy = a.dest.y - a.options.from.y; }
      const len = Math.hypot(dx, dy), im = this.impulse;
      camera.x -= im.x; camera.y -= im.y;   // a kick still ringing out is replaced, not stacked
      im.age = 0; im.duration = 220; im.amp = a.impulsePx; im.dx = len > 1e-6 ? dx / len : 1; im.dy = len > 1e-6 ? dy / len : 0;
      // The first frame of the kick lands at the moment of contact; updateShake carries it from there.
      im.x = im.dx * im.amp; im.y = im.dy * im.amp; camera.x += im.x; camera.y += im.y;
    }
    if (a.flashFrames > 0 && a.options.target) this.startFlash(a.options.target, a.flashColor, a.flashFrames * 1000 / 60, a.flashDecayMs);
  }
  private startFlash(target: Container, color: number, hold: number, decay: number) {
    let f: Flash | undefined;
    for (let i = 0; i < this.flashes.length; i++) if (this.flashes[i].target === target) f = this.flashes[i];
    if (f) { f.age = 0; f.color = color; f.hold = hold; f.decay = decay; return; }   // already flashing: restart, never stack filters
    f = this.flashPool.acquire();
    if (!f.filter) f.filter = this.filters.acquire();
    f.target = target; f.age = 0; f.color = color; f.hold = hold; f.decay = decay;
    f.prev = target.filters;
    f.list.length = 0;
    if (Array.isArray(f.prev)) for (let i = 0; i < f.prev.length; i++) f.list.push(f.prev[i]); else if (f.prev) f.list.push(f.prev);
    f.list.push(f.filter);
    this.setFlash(f, 1);
    target.filters = f.list;
    this.flashes.push(f);
  }
  /** Mixes the target's colour towards `color` by `amount`, alpha untouched: a full-strength flash is a flat silhouette. */
  private setFlash(f: Flash, amount: number) {
    const m: number[] = f.filter.matrix, k = amount, r = (f.color >> 16 & 255) / 255, g = (f.color >> 8 & 255) / 255, b = (f.color & 255) / 255;
    m[0] = 1 - k; m[1] = 0; m[2] = 0; m[3] = 0; m[4] = k * r;
    m[5] = 0; m[6] = 1 - k; m[7] = 0; m[8] = 0; m[9] = k * g;
    m[10] = 0; m[11] = 0; m[12] = 1 - k; m[13] = 0; m[14] = k * b;
    m[15] = 0; m[16] = 0; m[17] = 0; m[18] = 1; m[19] = 0;
    f.filter.matrix = m;
  }
  private endFlash(index: number) {
    const f = this.flashes[index], last = this.flashes.length - 1;
    f.target!.filters = f.prev ?? null; f.target = null; f.prev = null; f.list.length = 0;
    this.flashes[index] = this.flashes[last]; this.flashes.length = last;
    this.flashPool.release(f);
  }
  private updateFlashes(dt: number) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      if (f.age >= f.hold + f.decay) { this.endFlash(i); continue; }
      this.setFlash(f, f.age < f.hold ? 1 : 1 - (f.age - f.hold) / f.decay);
    }
  }
  update(dtMs: number) {
    if (this.dead) return;
    if (!Number.isFinite(dtMs) || dtMs < 0) throw Error('Invalid delta');
    this.updateShake(dtMs); this.updateFlashes(dtMs);
    let step = dtMs;
    if (!this.hitstopEnabled) this.cueFreeze = 0;
    const hold = Math.max(this.cueFreeze, this.freezeLeft);
    if (hold > 0) {
      const paused = Math.min(step, hold);
      this.cueFreeze = Math.max(0, this.cueFreeze - paused); this.freezeLeft = Math.max(0, this.freezeLeft - paused); step -= paused;
    }
    this.updating = true;
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (a.done) continue;
      a.time += step * (a.options.speed ?? 1);
      const duration = a.pack.manifest.durationMs;
      let cycles = 0;
      while (a.time >= duration) {
        this.emitCues(a);
        if (this.dead || a.done) break;
        if (!a.options.loop) { this.finish(a); break; }
        a.time -= duration; a.cue = 0; a.tierCursor = 0; cycles++;
        if (cycles >= MAX_LOOP_CYCLES_PER_UPDATE && a.time >= duration) {
          a.time %= duration; a.cue = 0; a.tierCursor = 0; break;
        }
      }
      if (this.dead || a.done) continue;
      this.emitCues(a);
      if (this.dead || a.done) continue;
      this.draw(a);
    }
    this.updating = false; this.compact();
  }
  private compact() {
    let w = 0;
    for (let r = 0; r < this.list.length; r++) { const a = this.list[r]; if (!a.done) this.list[w++] = a; }
    this.list.length = w;
  }
  private updateShake(dt: number) {
    const target = this.options.shake?.target, s = this.shake, im = this.impulse;
    if (!target) return;
    target.x -= s.x + im.x; target.y -= s.y + im.y; s.x = s.y = im.x = im.y = 0;
    s.age += dt; im.age += dt;
    if (this.shakeEnabled && s.age < s.duration) {
      const amp = s.amp * (1 - s.age / s.duration);
      s.x = Math.sin(s.age * 0.19) * amp; s.y = Math.cos(s.age * 0.23) * amp;
    }
    // A kick along the blow that rings out: 14 Hz, settling in ~200 ms.
    if (im.age < im.duration) {
      const k = im.amp * Math.exp(-im.age / 70) * Math.cos(im.age * 0.0880);
      im.x = im.dx * k; im.y = im.dy * k;
    }
    target.x += s.x + im.x; target.y += s.y + im.y;
  }
  private finish(a: Active) {
    if (a.done) return;
    a.done = true; this.live--;
    for (let i = -1; i < a.tiers.length; i++) { const root = i < 0 ? a.root : a.tiers[i].root; root.removeFromParent(); root.removeChildren(); this.roots.release(root); }
    for (let i = 0; i < a.sprites.length; i++) { const sprite = a.sprites[i]; sprite.visible = false; sprite.texture = Texture.EMPTY; this.sprites.release(sprite); }
    if (a.resolve) a.resolve();
    if (!this.updating) this.compact();
  }
  unload(id: string) {
    const at = id.indexOf('@'), family = at < 0 ? id : id.slice(0, at);
    if (at < 0) this.cancelledLoads.set(family, this.requestSerial);
    const doomed = at < 0 ? this.families.get(id) ?? [] : [this.packs.get(id)].filter((p): p is Pack => !!p);
    for (const pack of doomed) {
      for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].pack === pack) this.finish(this.list[i]);
      pack.frames.flat().forEach(t => t?.destroy()); pack.sheets.forEach(t => t.destroy(true)); this.packs.delete(keyOf(pack.manifest));
    }
    const rest = (this.families.get(family) ?? []).filter(p => !doomed.includes(p));
    if (rest.length) this.families.set(family, rest); else this.families.delete(family);
  }
  destroy() {
    if (this.dead) return;
    this.dead = true; this.app.ticker.remove(this.tick);
    for (const id of [...this.families.keys()]) this.unload(id);
    while (this.flashes.length) this.endFlash(this.flashes.length - 1);
    this.shakeEnabled = false; this.impulse.duration = 0; this.updateShake(0);
    this.sprites.drain(s => s.destroy()); this.roots.drain(r => r.destroy());
    this.flashPool.drain(f => f.filter?.destroy?.()); this.filters.drain(f => f.destroy?.());
    this.listeners = []; this.tierListeners = [];
  }
}
