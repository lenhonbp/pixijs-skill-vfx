// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Container, Sprite, Texture } from 'pixi.js';
import type { Application } from 'pixi.js';
import { frameTexture, setBlend, setMatrix, v8 } from './compat.js';
import { BatchSet, QuadBatch } from './batch.js';
import { RAMP_PRESETS, RampSet } from './ramp.js';
import type { RampStops } from './ramp.js';
import { readContainer, validate } from './format.js';
import { resolveAnchorName } from './anchors.js';
import type { AnchorName, NormalizedAnchor } from './anchors.js';
import type { ActorName, AnchorType, BlendAdvice, Cue, Frame, ImpactTier, Manifest, TierId, ZLayer } from './format.js';
export type { ActorName, ActorFrame, ActorTrack, AnchorMeta, AnchorType, BlendAdvice, Cue, ImpactMeta, ImpactTier, Manifest, Frame, TierId, ZLayer } from './format.js';
export interface Point { x: number; y: number }
export { FlowTrail, makeNoiseTexture } from './flow.js';
export { GroundDissolveFilter } from './dissolve.js';
export type { GroundDissolveOptions } from './dissolve.js';
export { ANCHOR_FALLBACKS, ANCHOR_MAP, ANCHOR_NAMES, SKELETON_ALIASES, anchorsFromSkeleton, resolveAnchorName } from './anchors.js';
export type { AnchorName, NormalizedAnchor, SkeletonPose } from './anchors.js';
export { RAMP_PRESETS, RampSet } from './ramp.js';
export type { RampPreset, RampStops } from './ramp.js';
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
  /**
   * Colour the pack's energy layers with this ramp: an element (`'fire'`, `'kim'`, `'thuy'`, ...), a preset (`'gold'`, `'crimson'`,
   * `'cyan'`) or a ramp you registered. Only packs baked with `--mono` have recolourable layers; without it a pack with a native
   * ramp plays in its baked colours.
   */
  element?: string;
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
  /**
   * Your caster's own anchor table (normalized: x forward in heights, y up in heights), e.g. from `anchorsFromSkeleton`.
   * `Playback.anchor()` moves the pack's caster anchors by the difference to the table the pack was baked with.
   */
  anchors?: Partial<Record<AnchorName, NormalizedAnchor>>;
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
  /**
   * Hand out the same `Playback` object every time a pooled playback record is reused, so `play()` allocates nothing.
   * The handle then belongs to the play that is running: once it has finished (or been stopped) do not call it again, because a
   * later `play()` may be using the same object. Default false: each `play()` returns a fresh handle (one small object) that stays
   * safely inert after its play ends.
   */
  recycleHandles?: boolean;
  /**
   * Pixi's `ColorMatrixFilter` class (`import { ColorMatrixFilter } from 'pixi.js'`). With it the target flash is an exact flat
   * silhouette of any Sprite or Container; without it the flash is two additive overlay sprites that burn a Sprite out towards the
   * flash colour. It is passed in rather than imported so games that never flash do not pay for Pixi's filter system (~140 KB).
   */
  colorMatrixFilter?: new () => any;
  /** Extra ramps by id, as `[position, 0xRRGGBB]` stops from black (0) to the hottest colour (1). Usable as `play(id, { element })`. */
  ramps?: Record<string, RampStops>;
  /**
   * Bake directions of one skill kept in GPU memory at once. Loading another direction of a skill that is at the limit evicts
   * the least recently used one (loaded or played longest ago), stops its plays and destroys its textures. Default 1: only the
   * direction being cast stays resident. Use 2 to cross-fade between directions, `Infinity` to keep every loaded direction.
   */
  maxResidentDirections?: number;
  /**
   * Erode ground layers with noise as they expire instead of fading them out: `{ filter: GroundDissolveFilter }` (exported by
   * this package; passed in like `colorMatrixFilter`, so games without it do not pay for Pixi's filter system). The last `ms`
   * (default 600, at most 40% of their run) of a pack's ground layers (`default_z_layer: 'background'`, and background impact
   * tiers) hold the frame they reached and dissolve through one pooled filter per ground layer, composited with that
   * layer's own blend mode. Pixi 8 + WebGL only; elsewhere, and for
   * ramp layers drawn by the batched shader, ground layers keep their baked fade.
   */
  groundDissolve?: GroundDissolveSettings;
}
/** The player's ground dissolve: the filter class plus its look. See `PlayerOptions.groundDissolve`. */
export interface GroundDissolveSettings {
  filter: new (options?: { edgeWidth?: number; edgeColor?: number; edgeIntensity?: number; noiseScale?: number }) => DissolveFilter;
  /** Length of the erosion in ms. Default 600. */
  ms?: number;
  edgeWidth?: number; edgeColor?: number; edgeIntensity?: number; noiseScale?: number;
}
/** What the player needs from a dissolve filter: GroundDissolveFilter, or your own with the same members. */
/** `params`, when present, is a typed array whose [0] the player writes progress into (no setter call per frame). */
export interface DissolveFilter { progress: number; params?: Float32Array; blendMode: unknown; seed(value: number): void; destroy(): void }
export interface ActorPose { x: number; y: number; lift: number; visible: boolean; facing: number }
export interface Playback {
  stop(): void;
  /** Resolves on natural end, stop, unload or destroy. Created on first read, so plays that never look at it allocate no Promise. */
  readonly finished: Promise<void>;
  readonly elapsedMs: number; readonly manifest: Manifest;
  /** Pose of a tracked actor. Pass `out` (a reusable object) to avoid allocating one per call. */
  pose(name: ActorName, out?: ActorPose): ActorPose | null;
  /**
   * Where an anchor of an actor (`'hand_r'`, `'mouth'`, `'chest'`, ...; falls back like ANCHOR_FALLBACKS) is in the
   * parent's space right now, or null when the pack has no anchors or the playback is over. Pass `out` to avoid allocating.
   */
  anchor(name: AnchorName | string, actor?: ActorName, out?: Point): Point | null;
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
/**
 * Per layer: the sheet textures of a ramp layer drawn by the batched shader (null for layers drawn as sprites), and the row of
 * the pack's native ramp when it ships one.
 */
interface Pack {
  manifest: Manifest; sheets: Texture[]; frames: (Texture | null)[][]; rampSheets: (Texture[] | null)[]; nativeRow: number;
  /** Residency clock value of the last load or play: the lowest one in a family is evicted first. */
  lastUsed: number;
  /** Ground dissolve windows; null when the player does not dissolve or the pack has no ground layers to dissolve. */
  ground: GroundPlan | null;
  /** Event numbers held as heap numbers, so copying one into a reused event allocates nothing: per impact tier its normal
   *  facing right then left, per cue its amp then ms (undefined where the pack has none). */
  tierNormals: (number | undefined)[]; cueNums: (number | undefined)[];
}
/**
 * Where a pack's ground layers dissolve. Slot 0 is the under root, slot 1 + i impact tier i (background tiers only).
 * `window[2s]..window[2s + 1]` are the first and last frames of slot s's erosion (-1 when it has none). A layer with
 * `holdFrom[li] >= 0` shows that frame through `holdTo[li]` instead of its baked fade, eroding over its slot `slot[li]`'s window.
 */
interface GroundPlan { window: Int32Array; holdFrom: Int32Array; holdTo: Int32Array; slot: Int32Array }
/** A quad of a ramp layer: one per sheet of the layer, only the sheet the current frame uses is visible. */
interface QuadRef { batch: QuadBatch; slot: number }
/** Ground-plane directions (degrees) the free packs are baked in; left-facing casts mirror them. */
export const PACK_DIRECTIONS = [0, 45, 90, -45, -90] as const;
const keyOf = (m: Manifest) => m.direction ? `${m.id}@${m.direction}` : m.id;
/**
 * Nearest baked direction for a cast from `from` to `to`, and whether it plays mirrored.
 * Load `<id>@<direction>.vfxb` (or `<id>.vfxb` for 0) before playing, if the pack ships directions.
 */
export function packDirection(from: Point, to: Point, groundSquash = 0.6, available: readonly number[] = PACK_DIRECTIONS): { direction: number; mirror: boolean } {
  return { direction: nearestDirection(from, to, groundSquash, available), mirror: to.x - from.x < 0 && Math.sqrt((to.x - from.x) ** 2 + ((to.y - from.y) / groundSquash) ** 2) >= 1e-6 };
}
/** The direction of packDirection() without its result object, for play(). */
function nearestDirection(from: Point, to: Point, groundSquash: number, available: readonly number[]): number {
  const dx = to.x - from.x, dy = (to.y - from.y) / groundSquash;
  if (Math.sqrt(dx * dx + dy * dy) < 1e-6) { for (let i = 0; i < available.length; i++) if (available[i] === 0) return 0; return available[0]; }
  const angle = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
  let best = available[0];
  for (let i = 1; i < available.length; i++) if (Math.abs(available[i] - angle) < Math.abs(best - angle)) best = available[i];
  return best;
}
/** Shortens an array in place. `length = 0` would let V8 drop the backing store, so the next push allocates a new one; pop() keeps it. */
/** Shrinks an array to `length` (at least 1: V8 frees the backing store of an array emptied to length 0). */
function truncate(list: unknown[], length: number): void { while (list.length > length) list.pop(); }
/** Writes `list[i]`, growing the array by one when `i` is its length. */
function put<T>(list: T[], i: number, value: T): void { if (i < list.length) list[i] = value; else list.push(value); }
/** Sets an array to `length` copies of `value` in place, without shrinking its backing store. */
function resize<T>(list: T[], length: number, value: T): void {
  truncate(list, length);
  for (let i = 0; i < list.length; i++) list[i] = value;
  while (list.length < length) list.push(value);
}
/**
 * Clears number-or-undefined fields of a reused event. Starting as a number and then undefined gives the field a
 * representation that takes both; a field that starts undefined takes only objects and deoptimizes on every small integer.
 */
function untag<T extends object>(o: T, ...keys: (keyof T)[]): T { for (const k of keys) (o as any)[k] = undefined; return o; }
/** An array of tagged elements: a fractional number stored in it stays a heap number instead of turning the array into raw doubles. */
function tagged(length: number): (number | undefined)[] { return new Array(length).fill(undefined); }
const NO_FLASH_OPTIONS: { color?: number; frames?: number; decayMs?: number } = Object.freeze({});
/** Adds the enabled tiers of one depth slot to the container the play's options give that slot. */
function attachTiers(tiers: TierPlan[], count: number, z: ZLayer, options: PlayOptions, parent: Container): void {
  for (let i = 0; i < count; i++) {
    const plan = tiers[i];
    if (plan.tier.default_z_layer !== z || !plan.enabled) continue;
    ((z === 'background' ? options.layers?.background : z === 'target_overlay' ? options.layers?.overlay : options.layers?.foreground) ?? parent).addChild(plan.root);
  }
}
/** One impact tier of a playing pack: its own root, so it can sit in a different depth slot than the rest. */
interface TierPlan { tier: ImpactTier; index: number; root: Container; enabled: boolean; startMs: number }
/** See Pack.tierNormals. */
function tierNormals(m: Manifest): (number | undefined)[] {
  const tiers = m.impact?.tiers ?? [], out = tagged(2 * tiers.length);
  for (let i = 0; i < tiers.length; i++) {
    const n = tiers[i].normal_deg;
    if (n !== undefined) { out[2 * i] = (n % 360 + 360) % 360; out[2 * i + 1] = ((180 - n) % 360 + 360) % 360; }
  }
  return out;
}
/** See Pack.cueNums. */
function cueNums(m: Manifest): (number | undefined)[] {
  const out = tagged(2 * m.cues.length);
  for (let k = 0; k < m.cues.length; k++) { out[2 * k] = m.cues[k].amp; out[2 * k + 1] = m.cues[k].ms; }
  return out;
}
/** Dissolve windows of a pack's ground layers (see GroundPlan), or null when it has none worth dissolving. */
function groundPlan(m: Manifest, rampSheets: (Texture[] | null)[], ms: number): GroundPlan | null {
  const tiers = m.impact?.tiers ?? [], slots = 1 + tiers.length, layers = m.layers;
  const window = new Int32Array(2 * slots).fill(-1), holdFrom = new Int32Array(layers.length).fill(-1), holdTo = new Int32Array(layers.length).fill(-1), slot = new Int32Array(layers.length).fill(-1);
  const slotOf = (li: number) => {
    const t = tiers.findIndex(tier => tier.layers.includes(layers[li].name));
    if (t >= 0) return tiers[t].default_z_layer === 'background' ? 1 + t : -1;
    return layers[li].default_z_layer === 'background' ? 0 : -1;
  };
  const span = (li: number) => { const f = layers[li].frames; let first = -1, last = -1; for (let i = 0; i < f.length; i++) if (f[i]) { if (first < 0) first = i; last = i; } return [first, last]; };
  let any = false;
  for (let s = 0; s < slots; s++) {
    let first = Infinity, last = -1;
    for (let li = 0; li < layers.length; li++) if (!rampSheets[li] && slotOf(li) === s) { const [a, b] = span(li); if (a >= 0) { first = Math.min(first, a); last = Math.max(last, b); } }
    if (last < 0) continue;
    const frames = Math.min(Math.round(ms * m.fps / 1000), Math.floor((last - first + 1) * 0.4));
    if (frames < 2) continue;
    const from = last + 1 - frames;
    window[2 * s] = from; window[2 * s + 1] = last; any = true;
    // Each layer holds the first frame it shows inside the window: one that only appears later erodes from then on.
    for (let li = 0; li < layers.length; li++) {
      if (rampSheets[li] || slotOf(li) !== s) continue;
      const f = layers[li].frames; let hold = from;
      while (hold <= last && !f[hold]) hold++;
      if (hold <= last) { holdFrom[li] = hold; holdTo[li] = last; slot[li] = s; }
    }
  }
  return any ? { window, holdFrom, holdTo, slot } : null;
}
const Z_BIAS: Record<ZLayer, number> = { background: -1, target_overlay: 1, foreground: 2 };
/**
 * Minimal object pool. `acquire()` hands back a released item (or makes one the first time) and `release()` takes it
 * back, so steady-state play allocates nothing. The player pools every sprite and root container this way.
 */
export class Pool<T> {
  // A count over a never-shrinking array: V8 drops an array's backing store whenever its length reaches 0, so a pool that
  // emptied with pop() would reallocate on the next release.
  private items: T[] = [];
  private n = 0;
  constructor(private make: () => T) {}
  acquire(): T { return this.n ? this.items[--this.n] : this.make(); }
  release(item: T): void { put(this.items, this.n++, item); }
  get size(): number { return this.n; }
  /** Empties the pool, optionally disposing each item first. */
  drain(each?: (item: T) => void): void { if (each) for (let i = 0; i < this.n; i++) each(this.items[i]); this.items.length = 0; this.n = 0; }
}
interface Active {
  pack: Pack; options: PlayOptions; legacy: boolean; matrix: Float64Array; root: Container;
  /** The matrix, `from` and `dest` the roots were last placed with (NaN forces a placement), and the frame each layer last drew (-1: none). */
  placed: Float64Array; shown: number[];
  /** Root of the pack's `default_z_layer: 'background'` layers (ground decals and floor glows); null when it has none. Shares `root`'s transform. */
  under: Container | null; sprites: (Sprite | null)[]; time: number; cue: number;
  /** Ramp layers: their quads, and the ramp row they are coloured with (-1 when the pack has no ramp layers). */
  quads: (QuadRef[] | null)[]; rampRow: number;
  /** Where the blow lands: `to`, else the live target, else `from`. */
  dest: Point;
  /** Impact tiers (empty for packs without an impact block), the plan owning each layer, tiers by start time, next tier to fire. */
  /** `tiers` and `tierOrder` hold `tierCount` entries; past that are stale plans of an earlier play. */
  tiers: TierPlan[]; tierCount: number; tierOf: (TierPlan | undefined)[]; tierOrder: TierPlan[]; tierCursor: number;
  /** Juice requested for this play (resolved once at play time). */
  juice: boolean; freezeMs: number; impulsePx: number; flashColor: number; flashFrames: number; flashDecayMs: number;
  /** Bumped every time the record is reused, so a stale handle can tell its play is over. */
  done: boolean; gen: number; handle: Handle;
  /** Reusable quad refs per layer (kept across plays; `quads[li]` points at the live prefix). */
  quadStore: QuadRef[][];
  /** Dissolve filter running on each layer's sprite (see GroundPlan), null where none is; and this play's noise seed. */
  dissolves: (DissolveFilter | null)[]; dissolveSeed: number;
}
/** The object `play()` returns. Reads the pooled record only while its own play is still the record's current one. */
class Handle implements Playback {
  gen = 0; poseResets = 0; promise: Promise<void> | null = null; resolve: (() => void) | null = null;
  constructor(private player: VfxPlayer, public a: Active, public pack: Pack) {}
  private get over(): boolean { return this.gen !== this.a.gen || this.a.done; }
  get finished(): Promise<void> { if (!this.promise) this.promise = this.over ? Promise.resolve() : new Promise<void>(done => { this.resolve = done; }); return this.promise; }
  pose(name: ActorName, out?: ActorPose): ActorPose | null { return this.player.poseOf(this, name, out); }
  anchor(name: string, actor: ActorName = 'caster', out?: Point): Point | null { return this.player.anchorOf(this, name, actor, out); }
  get manifest(): Manifest { return structuredClone(this.pack.manifest); }
  get elapsedMs(): number { return this.over ? 0 : this.a.time; }
  stop(): void { if (!this.over) this.player.finishPlay(this.a); }
  get isOver(): boolean { return this.over; }
}
/** One running silhouette flash: the filter lives on the target until the flash ends. */
interface Flash { target: Container | null; filter: any; list: any[]; prev: any; overlays: Sprite[]; age: number; color: number; hold: number; decay: number }
const MAX_LOOP_CYCLES_PER_UPDATE = 32;
export class VfxPlayer {
  shakeEnabled: boolean;
  hitstopEnabled: boolean;
  private packs = new Map<string, Pack>();
  private families = new Map<string, Pack[]>();
  private list: Active[] = [];
  private actives: Pool<Active> | null = null;
  private plans = new Pool<TierPlan>(() => ({ tier: null as unknown as ImpactTier, index: 0, root: null as unknown as Container, enabled: true, startMs: 0.5 }));
  private quadRefs = new Pool<QuadRef>(() => ({ batch: null as unknown as QuadBatch, slot: 0 }));
  private spent: Active[] = [];
  private spentCount = 0;
  private dirs = new Map<string, number[]>();
  private residentLimit: number;
  private useClock = 0;
  private aimPack!: Pack; private aimLegacy = false;
  private live = 0;
  private updating = false;
  private sprites = new Pool<Sprite>(() => { const sprite = new Sprite(); sprite.anchor.set(0); return sprite; });
  private roots = new Pool<Container>(() => new Container());
  private listeners: ((event: CueEvent) => void)[] = [];
  private tierListeners: ((event: TierEvent) => void)[] = [];
  // Event objects are reused for every emit: read them inside the listener, do not keep them.
  private cueEvent = untag({ t: 0, type: '', id: undefined, amp: 0, ms: 0, packId: '', handle: null }, 'amp', 'ms') as unknown as CueEvent;
  private tierEvent = untag({ tier: 'hit_point', tierNumber: 1, packId: '', handle: null, point: { x: 0, y: 0 }, anchorType: 'contact_normal', normalDeg: 0, zLayer: 'foreground', blend: 'ADD', startMs: 0 }, 'normalDeg') as unknown as TierEvent;
  private scratch = new Float64Array([1, 0, 0, 1]);
  private anchorMatrix = new Float64Array([1, 0, 0, 1]);
  private point: Point = { x: 0, y: 0 };
  private freezeLeft = 0;
  /** Freeze requested by a pack's own hitstop cue: switched off together with `hitstopEnabled`. */
  private cueFreeze = 0;
  private impulse = { age: 0, duration: 0, amp: 0, dx: 0, dy: 0, x: 0, y: 0 };
  private flashes: Flash[] = [];
  private flashPool = new Pool<Flash>(() => ({ target: null, filter: null, list: [], prev: null, overlays: [], age: 0, color: 0xffffff, hold: 0, decay: 0 }));
  private rampSet_: RampSet | null = null;
  private batchSet_: BatchSet | null = null;
  /** The ramp shader runs on Pixi 8 + WebGL only; elsewhere ramp layers are drawn as tinted sprites. */
  private rampGpu: boolean;
  private dead = false;
  private dissolve: { settings: GroundDissolveSettings; ms: number; pool: Pool<DissolveFilter>; lists: Map<DissolveFilter, DissolveFilter[]>; seed: number } | null = null;
  private loading = new Map<string, Promise<void>>();
  private requestSerial = 0;
  private cancelledLoads = new Map<string, number>();
  private shake = { age: 0, duration: 0, amp: 0, x: 0, y: 0 };
  private tick = (ticker: any) => this.update(v8 ? ticker.deltaMS : (this.app.ticker as any).deltaMS);
  constructor(private app: Application, private options: PlayerOptions = {}) {
    this.shakeEnabled = !!options.shake; this.hitstopEnabled = !!options.hitstop;
    const limit = options.maxResidentDirections ?? 1;
    if (!(limit >= 1)) throw Error(`Invalid maxResidentDirections: ${limit}`);
    this.residentLimit = Math.floor(limit);
    this.rampGpu = v8 && (app.renderer as any).name === 'webgl';
    const dissolve = options.groundDissolve;
    if (dissolve) {
      if (typeof dissolve.filter !== 'function' || (dissolve.ms !== undefined && !(dissolve.ms > 0))) throw Error('Invalid groundDissolve');
      if (this.rampGpu) {
        const { filter: Filter, ms, ...look } = dissolve;
        this.dissolve = { settings: dissolve, ms: ms ?? 600, pool: new Pool(() => new Filter(look)), lists: new Map(), seed: 0 };
      }
    }
    app.ticker.add(this.tick);
    if (options.ramps) for (const id of Object.keys(options.ramps)) this.addRamp(id, options.ramps[id]);
  }
  private ramps(): RampSet { return this.rampSet_ ??= new RampSet(); }
  private batchSet(): BatchSet { return this.batchSet_ ??= new BatchSet(this.ramps()); }
  /** Registers a ramp (`[position, 0xRRGGBB]` stops, black at 0) for `play(id, { element })`. */
  addRamp(id: string, stops: RampStops): void {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) throw Error(`Invalid ramp id: ${id}`);
    this.ramps().add(id, stops);
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
    if (this.touch(key)) return;
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
      const rampSheets: (Texture[] | null)[] = [];
      for (const layer of manifest.layers) {
        const row: (Texture | null)[] = []; frames.push(row);
        // Ramp layers go through the batched shader, which reads the sheet directly: they need no per-frame textures.
        if (this.rampGpu && manifest.color && layer.ramp) { rampSheets.push(layer.sheets.map(name => textures.get(name)!)); continue; }
        rampSheets.push(null);
        for (const frame of layer.frames) {
          if (!frame) { row.push(null); continue; }
          const [sheet, x, y, w, h] = frame, texture = textures.get(layer.sheets[sheet])!;
          if (x + w > texture.width || y + h > texture.height) throw Error('Frame outside sheet');
          row.push(frameTexture(texture, x, y, w, h));
        }
      }
      if (this.dead) throw Error('VfxPlayer is destroyed');
      if ((this.cancelledLoads.get(manifest.id) ?? 0) >= request) throw Error(`VFX load cancelled: ${manifest.id}`);
      if (this.touch(key)) { frames.flat().forEach(t => t?.destroy()); textures.forEach(t => t.destroy(true)); return; }
      let nativeRow = -1;
      if (manifest.color?.lut) nativeRow = this.ramps().addLut(`native:${key}`, Uint8Array.from(atob(manifest.color.lut), ch => ch.charCodeAt(0)));
      const pack: Pack = { manifest, sheets: [...textures.values()], frames, rampSheets, nativeRow, lastUsed: ++this.useClock, ground: this.dissolve ? groundPlan(manifest, rampSheets, this.dissolve.ms) : null,
        tierNormals: tierNormals(manifest), cueNums: cueNums(manifest) };
      this.packs.set(key, pack);
      this.families.set(manifest.id, [...(this.families.get(manifest.id) ?? []), pack]);
      this.dirs.delete(manifest.id);
    } catch (error) { frames.flat().forEach(t => t?.destroy()); textures.forEach(t => t.destroy(true)); throw error; }
    this.evictOver(manifest.id);
  }
  /** Marks a resident pack as just used, so loading it again protects it from eviction. */
  private touch(key: string): boolean {
    const pack = this.packs.get(key);
    if (pack) pack.lastUsed = ++this.useClock;
    return !!pack;
  }
  /** Evicts the least recently used directions of a family until it fits `maxResidentDirections`. */
  private evictOver(id: string): void {
    let list = this.families.get(id);
    while (list && list.length > this.residentLimit) {
      let lru = list[0];
      for (let i = 1; i < list.length; i++) if (list[i].lastUsed < lru.lastUsed) lru = list[i];
      this.evict(lru);
      list = this.families.get(id);
    }
  }
  play(id: string, options: PlayOptions): Playback {
    if (this.dead) throw Error('VfxPlayer is destroyed');
    if (!this.families.get(id)?.length) throw Error(`Pack not loaded: ${id}`);
    if (!options?.from || !Number.isFinite(options.from.x) || !Number.isFinite(options.from.y) || (options.to && (!Number.isFinite(options.to.x) || !Number.isFinite(options.to.y))) || (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed <= 0))) throw Error('Invalid playback options');
    this.aim(id, options);
    const pack = this.aimPack, legacy = this.aimLegacy;
    pack.lastUsed = ++this.useClock;
    const manifest = pack.manifest, base = options.zIndex ?? 0, parent = options.parent ?? this.app.stage;
    const a = (this.actives ??= new Pool<Active>(() => this.makeActive())).acquire();
    a.gen++;
    const root = this.roots.acquire();
    root.zIndex = base;
    // Impact tiers get a root each so they can sit in their own depth slot; everything else stays in `root`.
    const impactTiers = manifest.impact?.tiers, tiers = a.tiers;
    let tc = 0;
    if (impactTiers) for (let i = 0; i < impactTiers.length; i++) {
      const tier = impactTiers[i], tierRoot = this.roots.acquire();
      tierRoot.zIndex = base + Z_BIAS[tier.default_z_layer];
      const plan = this.plans.acquire();
      plan.tier = tier; plan.index = i; plan.root = tierRoot; plan.enabled = options.tiers?.[tier.id] !== false; plan.startMs = tier.start_frame * 1000 / manifest.fps;
      put(tiers, tc++, plan);
    }
    a.tierCount = tc;
    // Ramp layers (energy stored as a luminance mask) take their colour from a ramp row: the requested element, else the
    // pack's native ramp, else its suggested preset.
    const colored = manifest.color?.mode === 'ramp';
    const rampRow = !colored ? -1 : options.element !== undefined ? this.ramps().rowOf(options.element) : pack.nativeRow >= 0 ? pack.nativeRow : this.ramps().rowOf(manifest.color!.ramp ?? 'hoa');
    const tierOf = a.tierOf, sprites = a.sprites, quads = a.quads;
    // Ground layers go into their own root, below the characters, whatever tiers the pack has; they move with the pack matrix like `root`.
    let under: Container | null = null;
    for (let li = 0; li < manifest.layers.length; li++) {
      const layer = manifest.layers[li];
      let plan: TierPlan | undefined;
      for (let t = 0; t < tc && !plan; t++) if (tiers[t].tier.layers.includes(layer.name)) plan = tiers[t];
      const floor = !plan && layer.default_z_layer === 'background';
      if (floor && !under) { under = this.roots.acquire(); under.zIndex = base + Z_BIAS.background; }
      put(tierOf, li, plan); put(quads, li, null);
      if (pack.rampSheets[li]) { put(sprites, li, null); continue; }       // drawn by the batched shader below
      const sprite = this.sprites.acquire(); sprite.visible = false;
      setBlend(sprite, layer.blend === 'add', !!plan && options.recommendedBlend !== false && plan.tier.recommended_blend_mode === 'SCREEN');
      // Where the shader is unavailable (Pixi 7, WebGPU) a ramp layer degrades to its mask tinted with the ramp's hue.
      sprite.tint = colored && layer.ramp ? this.ramps().colorAt(rampRow, 0.75) : 0xffffff;
      (plan ? plan.root : floor ? under! : root).addChild(sprite); put(sprites, li, sprite);
    }
    truncate(tierOf, manifest.layers.length); truncate(quads, manifest.layers.length); truncate(sprites, manifest.layers.length);
    // Display order bottom to top: background tiers, the pack's own layers, target overlay, foreground.
    attachTiers(tiers, tc, 'background', options, parent); if (under) (options.layers?.background ?? parent).addChild(under); parent.addChild(root);
    attachTiers(tiers, tc, 'target_overlay', options, parent); attachTiers(tiers, tc, 'foreground', options, parent);
    // Batched ramp quads are added last, so each batch mesh ends on top of the materials in its parent.
    for (let li = 0; li < manifest.layers.length; li++) {
      const sheets = pack.rampSheets[li]; if (!sheets) continue;
      const plan = tierOf[li], z = plan ? plan.tier.default_z_layer : manifest.layers[li].default_z_layer;
      const home = (z === 'background' ? options.layers?.background : z === 'target_overlay' ? options.layers?.overlay : z === 'foreground' ? options.layers?.foreground : undefined) ?? parent;
      const refs = a.quadStore[li] ??= [];
      for (let si = 0; si < sheets.length; si++) {
        const batch = this.batchSet().get(home, sheets[si], true);
        let ref = refs[si];
        if (!ref) refs.push(ref = this.quadRefs.acquire());
        ref.batch = batch; ref.slot = batch.alloc();
      }
      // Refs this pack does not need go back to the player, so a record that plays packs of different sheet counts reuses them.
      while (refs.length > sheets.length) this.quadRefs.release(refs.pop()!);
      quads[li] = refs;
    }
    const target = options.target, targetOk = !!target && Number.isFinite(target.x) && Number.isFinite(target.y);
    const juice = options.hitstop !== undefined && options.hitstop !== false || targetOk;
    const flash = options.flash === false ? null : options.flash ?? NO_FLASH_OPTIONS;
    const dissolves = a.dissolves, slots = pack.ground ? manifest.layers.length : 0;
    resize(dissolves, slots, null);
    if (pack.ground) a.dissolveSeed = ++this.dissolve!.seed;
    resize(a.shown, manifest.layers.length, -1); a.placed[0] = NaN;
    a.pack = pack; a.options = options; a.legacy = legacy; a.root = root; a.under = under; a.rampRow = rampRow; a.time = 0; a.cue = 0; a.done = false;
    a.matrix[0] = 1; a.matrix[1] = 0; a.matrix[2] = 0; a.matrix[3] = 1;
    a.dest = options.to ?? (targetOk ? target as Point : options.from);
    a.tierCursor = 0; a.juice = juice;
    // Tiers by start time, into the record's own array (insertion sort: a handful of items, no allocation).
    const order = a.tierOrder;
    for (let t = 0; t < tc; t++) { let k = t; put(order, t, tiers[t]); while (k > 0 && order[k - 1].tier.start_frame > tiers[t].tier.start_frame) { order[k] = order[k - 1]; k--; } order[k] = tiers[t]; }
    a.freezeMs = options.hitstop === true ? 32 : typeof options.hitstop === 'number' ? Math.max(0, Math.min(100, options.hitstop)) : 0;
    a.impulsePx = options.impulse === false ? 0 : options.impulse ?? (juice ? 2.5 : 0);
    a.flashColor = flash?.color ?? 0xffffff; a.flashFrames = flash ? Math.max(0, flash.frames ?? 2) : 0; a.flashDecayMs = flash?.decayMs ?? 80;
    const handle = this.options.recycleHandles ? a.handle : a.handle = new Handle(this, a, pack);
    handle.gen = a.gen; handle.pack = pack; handle.poseResets = 0; handle.promise = null; handle.resolve = null;
    this.list.push(a); this.live++; this.draw(a); this.emitCues(a);
    this.batchSet_?.flush();
    return handle;
  }
  private makeActive(): Active {
    // Every field exists from the start, so all records share one shape and numeric fields keep an unboxed representation.
    const a = { pack: null, options: null, legacy: false, matrix: new Float64Array(4), placed: new Float64Array(8), shown: [], root: null, under: null, sprites: [],
      time: 0, cue: 0, quads: [], rampRow: -1, dest: null, tiers: [], tierCount: 0, tierOf: [], tierOrder: [], tierCursor: 0, juice: false, freezeMs: 0, impulsePx: 0,
      flashColor: 0, flashFrames: 0, flashDecayMs: 0, done: true, gen: 0, handle: null, quadStore: [], dissolves: [], dissolveSeed: 0 } as unknown as Active;
    a.handle = new Handle(this, a, null as unknown as Pack);
    return a;
  }
  /** Actor pose for a playback; see `Playback.pose`. */
  /** @internal used by Handle */
  poseOf(h: Handle, name: ActorName, out?: ActorPose): ActorPose | null {
    const a = h.a, manifest = h.pack.manifest, track = manifest.actors?.[name];
    if (!track) return null;
    const result = out ?? { x: 0, y: 0, lift: 0, visible: true, facing: 1 };
    if (h.isOver) {
      const bit = name === 'caster' ? 1 : 2;
      if (h.poseResets & bit) return null;
      h.poseResets |= bit;
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
  /** Anchor of an actor for a playback; see `Playback.anchor`. */
  /** @internal used by Handle */
  anchorOf(h: Handle, name: string, actor: ActorName, out?: Point): Point | null {
    const a = h.a, m = h.pack.manifest, meta = m.anchors, points = meta?.points[actor];
    if (!meta || !points || h.isOver) return null;
    const key = resolveAnchorName(points, name);
    if (!key) return null;
    const frame = Math.min(m.frameCount - 1, a.time * m.fps / 1000), i = Math.floor(frame), t = frame - i;
    const track = meta.tracks?.[actor]?.[key], p = points[key];
    let x: number, y: number;
    if (track) {
      const j = i * 2, k = Math.min(i + 1, m.frameCount - 1) * 2;
      x = track[j] + (track[k] - track[j]) * t; y = track[j + 1] + (track[k + 1] - track[j + 1]) * t;
    } else {
      x = p[0]; y = p[1];
      const frames = m.actors?.[actor]?.frames;
      if (frames) {
        const f = frames[i], n = frames[Math.min(i + 1, frames.length - 1)], f0 = frames[0];
        x += f[0] + (n[0] - f[0]) * t - f0[0];
        y += f[1] + (n[1] - f[1]) * t - f0[1] - (f[2] + (n[2] - f[2]) * t - f0[2]);
      }
    }
    // A rig override moves the anchor by its offset from the baked table, forward along the actor's baked aim.
    const own = actor === 'caster' ? a.options.anchors?.[key as AnchorName] : undefined, base = meta.map[key], h0 = meta.heights[actor] ?? 0;
    if (own && base) {
      const sq = m.groundSquash ?? 0.6, ang = Math.atan2((m.target.y - m.origin.y) / sq, m.target.x - m.origin.x), dir = actor === 'caster' ? 1 : -1;
      const dx = (own.x - base.x) * h0 * dir;
      x += Math.cos(ang) * dx; y += Math.sin(ang) * dx * sq - (own.y - base.y) * h0;
    }
    // Points share the layers' frame-offset space (placed like tierPoint). Fresh transform: a cue listener may ask
    // before this frame's draw refreshes `a.matrix`.
    const mx = this.anchorMatrix, result = out ?? { x: 0, y: 0 }, tx = m.target.x, ty = m.target.y;
    this.matrix(a, mx);
    let ox = a.options.from.x, oy = a.options.from.y;
    if (m.anchor === 'target') { ox = a.dest.x - (mx[0] * tx + mx[2] * ty); oy = a.dest.y - (mx[1] * tx + mx[3] * ty); }
    result.x = ox + mx[0] * x + mx[2] * y; result.y = oy + mx[1] * x + mx[3] * y;
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
  /**
   * `quadBatches`: draw calls the ramp shader costs right now, one per atlas sheet however many plays are active.
   * `sheets` / `textureBytes`: resident atlas sheets and their decoded size in GPU memory (width x height x 4).
   */
  /** Plays running right now (stats().active without building the stats object). */
  get playing(): number { return this.live; }
  stats() {
    let sheets = 0, textureBytes = 0;
    for (const pack of this.packs.values()) for (const t of pack.sheets) { sheets++; textureBytes += t.width * t.height * 4; }
    let dissolving = 0;
    for (let i = 0; i < this.list.length; i++) { const d = this.list[i].dissolves; if (!this.list[i].done) for (let s = 0; s < d.length; s++) if (d[s]) dissolving++; }
    return { active: this.live, pooled: this.sprites.size, packs: this.packs.size, quadBatches: this.batchSet_?.activeBatches ?? 0, sheets, textureBytes, dissolving };
  }
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
  private aim(id: string, o: PlayOptions): void {
    const list = this.families.get(id)!, to = o.to ?? o.from;
    let base = list[0];
    for (let i = 0; i < list.length; i++) if (!list[i].manifest.direction) { base = list[i]; break; }
    if (base.manifest.direction === undefined && list.length === 1) { this.aimPack = base; this.aimLegacy = true; return; }
    const squash = o.groundSquash ?? base.manifest.groundSquash ?? 0.6;
    let dirs = this.dirs.get(id);
    if (!dirs) this.dirs.set(id, dirs = list.map(p => p.manifest.direction ?? 0));
    const direction = nearestDirection(o.from, to, squash, dirs);
    for (let i = 0; i < list.length; i++) if ((list[i].manifest.direction ?? 0) === direction) { this.aimPack = list[i]; break; }
    this.aimLegacy = false;
  }
  /**
   * Root transform landing the pack's baked target on `to` right now: x mirrored for left casts,
   * then the smallest linear correction for the remaining angle and distance. Past ~70 degrees of
   * correction the shear degenerates, so the bake is rotated and scaled onto the cast instead.
   * Recomputed per draw so live endpoints keep tracking; legacy packs keep the 1.0 per-frame mirror.
   * Writes [a, b, c, d] into `out` (no allocation).
   */
  private matrix(a: Active, out: Float64Array): void {
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
    const dLen = Math.sqrt(dx * dx + dy * dy / (squash * squash));
    if (t2 === 0 || dLen < 1e-6) { out[0] = s; out[1] = 0; out[2] = 0; out[3] = 1; return; }
    if (!o.fitDistance) { const k = Math.sqrt(tx * tx + ty * ty / (squash * squash)) / dLen; dx *= k; dy *= k; }
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
    const m = a.pack.manifest, o = a.options, to = a.dest, anchor = m.anchor === 'target' ? to : o.from, mx = a.matrix, p = a.placed;
    this.matrix(a, mx);
    // Placement and frames are only rewritten when they change: at 120 FPS a 30 FPS pack holds each frame for 4 updates.
    const moved = p[0] !== mx[0] || p[1] !== mx[1] || p[2] !== mx[2] || p[3] !== mx[3] || p[4] !== o.from.x || p[5] !== o.from.y || p[6] !== to.x || p[7] !== to.y;
    if (moved) {
      p[0] = mx[0]; p[1] = mx[1]; p[2] = mx[2]; p[3] = mx[3]; p[4] = o.from.x; p[5] = o.from.y; p[6] = to.x; p[7] = to.y;
      setMatrix(a.root, mx[0], mx[1], mx[2], mx[3], anchor.x, anchor.y);
      if (a.under) setMatrix(a.under, mx[0], mx[1], mx[2], mx[3], anchor.x, anchor.y);
      const s = Math.sign(mx[0]) || 1;
      for (let i = 0; i < a.tierCount; i++) { const plan = a.tiers[i]; this.tierPoint(a, plan, mx, this.point); setMatrix(plan.root, s, 0, 0, 1, this.point.x, this.point.y); }
    }
    const index = Math.min(m.frameCount - 1, Math.floor(a.time * m.fps / 1000)), layers = m.layers, ground = a.pack.ground, shown = a.shown;
    for (let li = 0; li < a.sprites.length; li++) {
      const sprite = a.sprites[li], plan = a.tierOf[li];
      if (!sprite) {
        const f = layers[li].frames[index], key = !f || (plan && !plan.enabled) ? -2 : index;
        if (moved || key !== shown[li]) { shown[li] = key; this.drawQuads(a, li, f, plan, mx, anchor); }
        continue;
      }
      // A dissolving ground layer holds the frame its erosion started on.
      const fi = ground && ground.holdFrom[li] >= 0 && index >= ground.holdFrom[li] && index <= ground.holdTo[li] ? ground.holdFrom[li] : index;
      const f = layers[li].frames[fi], t = a.pack.frames[li][fi];
      sprite.visible = !!f && (!plan || plan.enabled);
      // A tier's frames are drawn around its anchor, so the tier root alone decides where the impact lands.
      if (f && t && fi !== shown[li]) {
        shown[li] = fi;
        sprite.texture = t;
        if (plan) sprite.position.set(f[5] - plan.tier.anchor_point.x, f[6] - plan.tier.anchor_point.y); else sprite.position.set(f[5], f[6]);
        const k = 1 / (layers[li].scale ?? m.scale); sprite.scale.set(k, k);
      }
      if (ground && ground.slot[li] >= 0) this.drawDissolve(a, ground, li, sprite, index);
    }
  }
  /**
   * Runs, advances or ends the dissolve filter of one ground layer. The filter sits on the sprite, not its root, so each
   * layer composites with its own blend mode: an additive glow keeps adding light instead of covering the ground.
   */
  private drawDissolve(a: Active, ground: GroundPlan, li: number, sprite: Sprite, index: number) {
    const s = ground.slot[li], from = ground.window[2 * s], to = ground.window[2 * s + 1];
    let filter = a.dissolves[li];
    if (!sprite.visible || index < from || index > to) { if (filter) this.endDissolve(a, li); return; }
    if (!filter) {
      const d = this.dissolve!;
      filter = a.dissolves[li] = d.pool.acquire();
      filter.seed(a.dissolveSeed); filter.blendMode = sprite.blendMode;
      let list = d.lists.get(filter);
      if (!list) d.lists.set(filter, list = [filter]);
      (sprite as any).filters = list;
    }
    const frameMs = 1000 / a.pack.manifest.fps, t = (a.time - from * frameMs) / ((to + 1 - from) * frameMs);
    // A typed-array write: a setter call with a fractional argument boxes it when the call site is not inlined.
    const params = filter.params, progress = t < 0 ? 0 : t > 1 ? 1 : t;
    if (params) params[0] = progress; else filter.progress = progress;
  }
  private endDissolve(a: Active, li: number) {
    const filter = a.dissolves[li]!, sprite = a.sprites[li];
    if (sprite) (sprite as any).filters = null;
    filter.progress = 0; a.dissolves[li] = null; this.dissolve!.pool.release(filter);
  }
  /** Writes a ramp layer's quad for the current frame: into the tier's anchored space, or through the pack matrix. */
  private drawQuads(a: Active, li: number, f: Frame, plan: TierPlan | undefined, mx: Float64Array, anchor: Point) {
    const refs = a.quads[li]!, m = a.pack.manifest, sheets = a.pack.rampSheets[li]!;
    if (!f || (plan && !plan.enabled)) { for (let i = 0; i < refs.length; i++) refs[i].batch.hide(refs[i].slot); return; }
    const k = 1 / (m.layers[li].scale ?? m.scale), w = f[3] * k, h = f[4] * k;
    let ox: number, oy: number, ax: number, ay: number, s = 1;
    if (plan) { this.tierPoint(a, plan, mx, this.point); ax = this.point.x; ay = this.point.y; s = Math.sign(mx[0]) || 1; ox = f[5] - plan.tier.anchor_point.x; oy = f[6] - plan.tier.anchor_point.y; }
    else { ax = anchor.x; ay = anchor.y; ox = f[5]; oy = f[6]; }
    const x1 = ox + w, y1 = oy + h;
    for (let si = 0; si < refs.length; si++) {
      const ref = refs[si];
      if (f[0] !== si) { ref.batch.hide(ref.slot); continue; }
      const sheet = sheets[si], sw = sheet.width, sh = sheet.height;
      if (plan) ref.batch.set(ref.slot, ax + s * ox, ay + oy, ax + s * x1, ay + oy, ax + s * ox, ay + y1, ax + s * x1, ay + y1, f[1] / sw, f[2] / sh, (f[1] + f[3]) / sw, (f[2] + f[4]) / sh, a.rampRow);
      else ref.batch.set(ref.slot,
        ax + mx[0] * ox + mx[2] * oy, ay + mx[1] * ox + mx[3] * oy, ax + mx[0] * x1 + mx[2] * oy, ay + mx[1] * x1 + mx[3] * oy,
        ax + mx[0] * ox + mx[2] * y1, ay + mx[1] * ox + mx[3] * y1, ax + mx[0] * x1 + mx[2] * y1, ay + mx[1] * x1 + mx[3] * y1,
        f[1] / sw, f[2] / sh, (f[1] + f[3]) / sw, (f[2] + f[4]) / sh, a.rampRow);
    }
  }
  /**
   * Where an impact tier is anchored in the parent's space: the baked target's feet as the pack places them
   * (so tiers land where the rest of the pack does; exactly on `to` with fitDistance), then the tier's own height
   * above the feet. Tiers are translated and mirrored only, never sheared or stretched. Writes into `out`.
   */
  private tierPoint(a: Active, plan: TierPlan, matrix: Float64Array, out: Point): void {
    const m = a.pack.manifest, s = Math.sign(matrix[0]) || 1, at = plan.tier.anchor_point;
    let fx: number, fy: number;
    if (m.anchor === 'target') { fx = a.dest.x; fy = a.dest.y; }
    else { fx = a.options.from.x + matrix[0] * m.target.x + matrix[2] * m.target.y; fy = a.options.from.y + matrix[1] * m.target.x + matrix[3] * m.target.y; }
    out.x = fx + s * (at.x - m.target.x); out.y = fy + (at.y - m.target.y);
  }
  private emitTiers(a: Active): boolean {
    while (a.tierCursor < a.tierCount && a.tierOrder[a.tierCursor].startMs <= a.time) {
      const plan = a.tierOrder[a.tierCursor++], ls = this.tierListeners;
      if (!plan.enabled || !ls.length) continue;
      const mx = this.scratch, t = plan.tier, s = (this.matrix(a, mx), Math.sign(mx[0]) || 1);
      const ev = this.options.reuseEvents ? this.tierEvent : { point: { x: 0, y: 0 } } as TierEvent;
      this.tierPoint(a, plan, mx, ev.point);
      ev.tier = t.id; ev.tierNumber = t.tier; ev.packId = a.pack.manifest.id; ev.handle = a.handle; ev.anchorType = t.anchor_type;
      ev.zLayer = t.default_z_layer; ev.blend = t.recommended_blend_mode; ev.startMs = plan.startMs;
      ev.normalDeg = a.pack.tierNormals[2 * plan.index + (s < 0 ? 1 : 0)];
      for (let i = 0; i < ls.length; i++) ls[i](ev);
      if (this.dead || a.done) return false;
    }
    return true;
  }
  private emitCues(a: Active) {
    if (!this.emitTiers(a)) return false;
    const cues = a.pack.manifest.cues, camera = this.options.shake?.target;
    while (a.cue < cues.length && cues[a.cue].t <= a.time) {
      const k = a.cue++, cue = cues[k], nums = a.pack.cueNums;
      if (cue.type === 'hit' && a.juice) this.juiceHit(a);
      // A play that asks for juice owns the freeze and the shake: the pack's own cues would double up.
      if (cue.type === 'hitstop' && this.hitstopEnabled && !(a.juice && a.freezeMs > 0)) this.cueFreeze = Math.max(this.cueFreeze, Math.min(cue.ms ?? 0, 1000));
      if (cue.type === 'shake' && this.shakeEnabled && !(a.juice && a.impulsePx > 0 && camera)) { const s = this.shake; s.age = 0; s.duration = cue.ms ?? 0; s.amp = cue.amp ?? 0; }
      const ev = this.options.reuseEvents ? this.cueEvent : { t: 0, type: '', packId: '' } as CueEvent, ls = this.listeners;
      ev.t = cue.t; ev.type = cue.type; ev.id = cue.id; ev.amp = nums[2 * k]; ev.ms = nums[2 * k + 1]; ev.packId = a.pack.manifest.id; ev.handle = a.handle;
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
      const len = Math.sqrt(dx * dx + dy * dy), im = this.impulse;
      camera.x -= im.x; camera.y -= im.y;   // a kick still ringing out is replaced, not stacked
      im.age = 0; im.duration = 220; im.amp = a.impulsePx; im.dx = len > 1e-6 ? dx / len : 1; im.dy = len > 1e-6 ? dy / len : 0;
      // The first frame of the kick lands at the moment of contact; updateShake carries it from there.
      im.x = im.dx * im.amp; im.y = im.dy * im.amp; camera.x += im.x; camera.y += im.y;
    }
    if (a.flashFrames > 0 && a.options.target) this.startFlash(a.options.target, a.flashColor, a.flashFrames * 1000 / 60, a.flashDecayMs);
  }
  private startFlash(target: Container, color: number, hold: number, decay: number) {
    const Filter = this.options.colorMatrixFilter;
    if (!Filter && !(target instanceof Sprite)) return;   // the overlay flash needs a Sprite; a Container needs the filter
    let f: Flash | undefined;
    for (let i = 0; i < this.flashes.length; i++) if (this.flashes[i].target === target) f = this.flashes[i];
    if (f) { f.age = 0; f.color = color; f.hold = hold; f.decay = decay; return; }   // already flashing: restart, never stack
    f = this.flashPool.acquire();
    f.target = target; f.age = 0; f.color = color; f.hold = hold; f.decay = decay;
    if (Filter) {
      if (!f.filter) f.filter = new Filter();
      f.prev = target.filters;
      truncate(f.list, 0);
      if (Array.isArray(f.prev)) for (let i = 0; i < f.prev.length; i++) f.list.push(f.prev[i]); else if (f.prev) f.list.push(f.prev);
      f.list.push(f.filter);
      target.filters = f.list;
    } else {
      // Two additive copies of the sprite right above it: at full strength they push any colour at least 4x brighter.
      while (f.overlays.length < 2) f.overlays.push(this.sprites.acquire());
      for (let i = 0; i < 2; i++) { const o = f.overlays[i]; o.blendMode = (v8 ? 'add' : 1) as any; target.parent?.addChild(o); }
    }
    this.setFlash(f, 1);
    this.flashes.push(f);
  }
  /** Mixes the target towards `color` by `amount` (1 = flash colour at full strength). */
  private setFlash(f: Flash, amount: number) {
    if (f.filter && f.list.length) {
      // Filter mode: out = (1 - k) * in + k * colour, alpha untouched, so full strength is a flat silhouette.
      const m: number[] = f.filter.matrix, k = amount, r = (f.color >> 16 & 255) / 255, g = (f.color >> 8 & 255) / 255, b = (f.color & 255) / 255;
      m[0] = 1 - k; m[1] = 0; m[2] = 0; m[3] = 0; m[4] = k * r;
      m[5] = 0; m[6] = 1 - k; m[7] = 0; m[8] = 0; m[9] = k * g;
      m[10] = 0; m[11] = 0; m[12] = 1 - k; m[13] = 0; m[14] = k * b;
      m[15] = 0; m[16] = 0; m[17] = 0; m[18] = 1; m[19] = 0;
      f.filter.matrix = m;
      return;
    }
    const t = f.target as Sprite, parent = t.parent;
    for (let i = 0; i < f.overlays.length; i++) {
      const o = f.overlays[i];
      if (parent && o.parent !== parent) parent.addChild(o);
      // Follow the target frame by frame: texture, anchor and transform.
      o.texture = t.texture; o.anchor.set(t.anchor.x, t.anchor.y); o.position.set(t.x, t.y); o.scale.set(t.scale.x, t.scale.y);
      o.rotation = t.rotation; o.skew.set(t.skew.x, t.skew.y); o.zIndex = t.zIndex + 0.001; o.visible = t.visible; o.tint = f.color; o.alpha = amount;
    }
  }
  private endFlash(index: number) {
    const f = this.flashes[index], last = this.flashes.length - 1;
    if (f.list.length) { f.target!.filters = f.prev ?? null; truncate(f.list, 0); f.prev = null; }
    for (let i = 0; i < f.overlays.length; i++) { const o = f.overlays[i]; o.removeFromParent(); o.texture = Texture.EMPTY; o.visible = false; o.alpha = 1; o.tint = 0xffffff; this.sprites.release(o); }
    truncate(f.overlays, 0);
    f.target = null;
    this.flashes[index] = this.flashes[last]; truncate(this.flashes, last);
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
    this.batchSet_?.flush();
  }
  private compact() {
    let w = 0;
    for (let r = 0; r < this.list.length; r++) { const a = this.list[r]; if (!a.done) this.list[w++] = a; }
    truncate(this.list, w);
    // Finished records go back to the pool only now, when nothing is iterating the list any more.
    // Record arrays keep their length and backing store; the next play overwrites them (see Pool for why nothing empties to 0).
    for (let r = this.spentCount - 1; r >= 0; r--) {
      const a = this.spent[r];
      for (let i = 0; i < a.tierCount; i++) this.plans.release(a.tiers[i]);
      a.tierCount = 0;
      (a as any).options = null; (a as any).pack = null; (a as any).root = null; a.under = null;
      this.actives!.release(a);
    }
    this.spentCount = 0;
  }
  private updateShake(dt: number) {
    const target = this.options.shake?.target, s = this.shake, im = this.impulse;
    if (!target) return;
    // Nothing shaking and nothing to undo: leave the camera alone (writing its position would mark it dirty every frame).
    if (s.x === 0 && s.y === 0 && im.x === 0 && im.y === 0 && s.age >= s.duration && im.age >= im.duration) { s.age += dt; im.age += dt; return; }
    // The camera is written once per axis (each write of a fractional value to Pixi's setter boxes a number).
    const ox = s.x + im.x, oy = s.y + im.y; s.x = s.y = im.x = im.y = 0;
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
    // Old offset off, new one on, in that order: once the shake settles the camera lands exactly where it was.
    const nx = s.x + im.x, ny = s.y + im.y;
    if (nx !== ox) target.x = target.x - ox + nx;
    if (ny !== oy) target.y = target.y - oy + ny;
  }
  /** @internal used by Handle */
  finishPlay(a: Active): void { this.finish(a); }
  private finish(a: Active) {
    if (a.done) return;
    a.done = true; this.live--;
    for (let s = 0; s < a.dissolves.length; s++) if (a.dissolves[s]) this.endDissolve(a, s);
    for (let i = -2; i < a.tierCount; i++) {
      const root = i === -2 ? a.under : i < 0 ? a.root : a.tiers[i].root;
      if (root) { root.removeFromParent(); root.removeChildren(); this.roots.release(root); }
    }
    for (let i = 0; i < a.sprites.length; i++) {
      const sprite = a.sprites[i], refs = a.quads[i];
      if (sprite) { sprite.visible = false; sprite.texture = Texture.EMPTY; this.sprites.release(sprite); }
      if (refs) for (let q = 0; q < refs.length; q++) refs[q].batch.release(refs[q].slot);
    }
    const h = a.handle; if (h.resolve) h.resolve();
    put(this.spent, this.spentCount++, a);
    if (!this.updating) { this.compact(); this.batchSet_?.flush(); }
  }
  /**
   * Stops a pack's plays and destroys its textures. `unload('id')` frees every loaded direction of the skill (and cancels its
   * pending loads); `unload('id', 90)` or `unload('id@90')` frees only that direction, keeping the others resident.
   */
  unload(id: string, direction?: number) {
    const at = id.indexOf('@'), family = at < 0 ? id : id.slice(0, at);
    const dir = direction ?? (at < 0 ? undefined : Number(id.slice(at + 1)));
    const list = this.families.get(family);
    if (dir === undefined) {
      this.cancelledLoads.set(family, this.requestSerial);
      if (list) for (const pack of [...list]) this.evict(pack);
      return;
    }
    const pack = list?.find(p => (p.manifest.direction ?? 0) === dir);
    if (pack) this.evict(pack);
  }
  /** Drops one direction pack: its plays end, and its sheets leave the GPU and Pixi's texture caches. */
  private evict(pack: Pack): void {
    const id = pack.manifest.id;
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].pack === pack) this.finish(this.list[i]);
    if (this.batchSet_) for (const sheet of pack.sheets) this.batchSet_.dropSheet(sheet);
    this.rampSet_?.remove(`native:${keyOf(pack.manifest)}`);
    for (const row of pack.frames) for (const t of row) t?.destroy();
    for (const sheet of pack.sheets) sheet.destroy(true);
    // A stale handle may still reference the pack: let go of the destroyed textures so they can be collected.
    pack.frames.length = 0; pack.sheets.length = 0; pack.rampSheets.length = 0;
    this.packs.delete(keyOf(pack.manifest));
    this.dirs.delete(id);
    const rest = (this.families.get(id) ?? []).filter(p => p !== pack);
    if (rest.length) this.families.set(id, rest); else this.families.delete(id);
  }
  destroy() {
    if (this.dead) return;
    this.dead = true; this.app.ticker.remove(this.tick);
    for (const id of [...this.families.keys()]) this.unload(id);
    while (this.flashes.length) this.endFlash(this.flashes.length - 1);
    this.shakeEnabled = false; this.impulse.duration = 0; this.updateShake(0);
    this.batchSet_?.destroy(); this.rampSet_?.destroy();
    this.sprites.drain(s => s.destroy()); this.roots.drain(r => r.destroy());
    this.flashPool.drain(f => f.filter?.destroy?.());
    if (this.dissolve) { this.dissolve.pool.drain(f => f.destroy()); this.dissolve.lists.clear(); }
    this.listeners = []; this.tierListeners = [];
  }
}
