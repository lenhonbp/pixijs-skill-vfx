// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Container, Sprite, Texture } from 'pixi.js';
import type { Application } from 'pixi.js';
import { frameTexture, setBlend, setMatrix, v8 } from './compat.js';
import { readContainer, validate } from './format.js';
import type { ActorName, AnchorType, BlendAdvice, Cue, ImpactTier, Manifest, TierId, ZLayer } from './format.js';
export type { ActorName, ActorFrame, ActorTrack, AnchorType, BlendAdvice, Cue, ImpactMeta, ImpactTier, Manifest, Frame, TierId, ZLayer } from './format.js';
export interface Point { x: number; y: number }
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
  /** Draw a tier's additive layers with its recommended blend (SCREEN for body residual). Default true. */
  recommendedBlend?: boolean;
  /** Your camera's ground squash (ground y / screen y). Defaults to the pack's bake value. */
  groundSquash?: number;
}
export interface PlayerOptions {
  packs?: string[]; loadKey?: string; shake?: { target: Container }; hitstop?: boolean;
}
export interface ActorPose { x: number; y: number; lift: number; visible: boolean; facing: number }
export interface Playback { stop(): void; finished: Promise<void>; readonly elapsedMs: number; readonly manifest: Manifest; pose(name: ActorName): ActorPose | null }
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
interface Active {
  pack: Pack; options: PlayOptions; legacy: boolean; matrix: [number, number, number, number]; root: Container; sprites: Sprite[]; time: number; cue: number; freeze: number;
  /** Impact tiers (empty for packs without an impact block), the plan owning each layer, tiers by start time, next tier to fire. */
  tiers: TierPlan[]; tierOf: (TierPlan | undefined)[]; tierOrder: TierPlan[]; tierCursor: number;
  handle: Playback; resolve(): void;
}
const MAX_LOOP_CYCLES_PER_UPDATE = 32;
export class VfxPlayer {
  shakeEnabled: boolean;
  hitstopEnabled: boolean;
  private packs = new Map<string, Pack>();
  private families = new Map<string, Pack[]>();
  private active = new Set<Active>();
  private sprites: Sprite[] = [];
  private roots: Container[] = [];
  private listeners = new Set<(event: CueEvent) => void>();
  private tierListeners = new Set<(event: TierEvent) => void>();
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
    const root = this.roots.pop() ?? new Container();
    root.zIndex = base;
    // Impact tiers get a root each so they can sit in their own depth slot; everything else stays in `root`.
    const tiers: TierPlan[] = (manifest.impact?.tiers ?? []).map(tier => {
      const tierRoot = this.roots.pop() ?? new Container();
      tierRoot.zIndex = base + Z_BIAS[tier.default_z_layer];
      return { tier, root: tierRoot, enabled: options.tiers?.[tier.id] !== false, startMs: tier.start_frame * 1000 / manifest.fps };
    });
    const tierOf = manifest.layers.map(layer => tiers.find(t => t.tier.layers.includes(layer.name)));
    const sprites = manifest.layers.map((layer, li) => {
      const sprite = this.sprites.pop() ?? new Sprite(); sprite.anchor.set(0); sprite.visible = false;
      const plan = tierOf[li];
      setBlend(sprite, layer.blend === 'add', !!plan && options.recommendedBlend !== false && plan.tier.recommended_blend_mode === 'SCREEN');
      (plan ? plan.root : root).addChild(sprite); return sprite;
    });
    // Display order bottom to top: background tiers, the pack's own layers, target overlay, foreground.
    const slot = (z: ZLayer) => z === 'background' ? options.layers?.background : z === 'target_overlay' ? options.layers?.overlay : options.layers?.foreground;
    const attach = (plan: TierPlan) => { if (plan.enabled) (slot(plan.tier.default_z_layer) ?? parent).addChild(plan.root); };
    tiers.filter(t => t.tier.default_z_layer === 'background').forEach(attach);
    parent.addChild(root);
    tiers.filter(t => t.tier.default_z_layer === 'target_overlay').forEach(attach);
    tiers.filter(t => t.tier.default_z_layer === 'foreground').forEach(attach);
    let resolve!: () => void;
    const finished = new Promise<void>(done => { resolve = done; });
    const resets = new Set<ActorName>();
    const player = this;
    const pose = (name: ActorName): ActorPose | null => {
      const track = pack.manifest.actors?.[name];
      if (!track) return null;
      if (!this.active.has(a)) {
        if (resets.has(name)) return null;
        resets.add(name);
        return { x: 0, y: 0, lift: 0, visible: true, facing: 1 };
      }
      const frame = Math.min(pack.manifest.frameCount - 1, a.time * pack.manifest.fps / 1000);
      const i = Math.floor(frame), t = frame - i, f = track.frames[i], next = track.frames[Math.min(i + 1, track.frames.length - 1)];
      const lerp = (k: number) => f[k] + (next[k] - f[k]) * t, x = lerp(0), y = lerp(1), [ma, mb, mc, md] = a.matrix;
      return { x: ma * x + mc * y, y: mb * x + md * y, lift: lerp(2), visible: !!(f[3] & 1), facing: (f[3] & 2 ? -1 : 1) * Math.sign(ma || 1) };
    };
    const a: Active = { pack, options, legacy, matrix: [1, 0, 0, 1], root, sprites, time: 0, cue: 0, freeze: 0, tiers, tierOf, tierOrder: [...tiers].sort((x, y) => x.tier.start_frame - y.tier.start_frame), tierCursor: 0, resolve, handle: { finished, pose, get manifest() { return structuredClone(pack.manifest); }, get elapsedMs() { return player.active.has(a) ? a.time : 0; }, stop: () => this.finish(a) } };
    this.active.add(a); this.draw(a); this.emitCues(a);
    return a.handle;
  }
  on(type: 'cue', listener: (event: CueEvent) => void): this;
  /** Fires once when an impact tier starts (hit point, then ground feedback, then body residual), with its live anchor. */
  on(type: 'tier', listener: (event: TierEvent) => void): this;
  on(type: 'cue' | 'tier', listener: any): this { (type === 'cue' ? this.listeners : this.tierListeners).add(listener); return this; }
  off(type: 'cue', listener: (event: CueEvent) => void): this;
  off(type: 'tier', listener: (event: TierEvent) => void): this;
  off(type: 'cue' | 'tier', listener: any): this { (type === 'cue' ? this.listeners : this.tierListeners).delete(listener); return this; }
  stats() { return { active: this.active.size, pooled: this.sprites.length, packs: this.packs.size }; }
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
   */
  private matrix(a: Active): [number, number, number, number] {
    const m = a.pack.manifest, o = a.options, to = o.to ?? o.from;
    if (a.legacy) {
      const mirror = to.x < o.from.x ? -1 : 1, span = Math.abs(m.target.x - m.origin.x);
      const fit = o.fitDistance && span > 0 ? Math.abs(to.x - o.from.x) / span : 1;
      return [mirror * fit, 0, 0, 1];
    }
    const squash = o.groundSquash ?? m.groundSquash ?? 0.6, s = to.x < o.from.x ? -1 : 1;
    const tx = m.target.x - m.origin.x, ty = m.target.y - m.origin.y, t2 = tx * tx + ty * ty;
    let dx = s * (to.x - o.from.x), dy = to.y - o.from.y;
    const ground = (x: number, y: number) => Math.hypot(x, y / squash), dLen = ground(dx, dy);
    if (t2 === 0 || dLen < 1e-6) return [s, 0, 0, 1];
    if (!o.fitDistance) { const k = ground(tx, ty) / dLen; dx *= k; dy *= k; }
    const dot = dx * tx + dy * ty;
    if (dot <= 0.3 * Math.sqrt((dx * dx + dy * dy) * t2)) {
      const p = dot / t2, q = (dx * ty - dy * tx) / t2;
      return [s * p, s * q, -q, p];
    }
    const ex = (dx - tx) / t2, ey = (dy - ty) / t2;
    return [s * (1 + ex * tx), ey * tx, s * ex * ty, 1 + ey * ty];
  }
  getManifest(id: string): Manifest | undefined {
    const manifest = (this.packs.get(id) ?? this.families.get(id)?.[0])?.manifest;
    return manifest ? structuredClone(manifest) : undefined;
  }
  private draw(a: Active) {
    const m = a.pack.manifest, o = a.options, to = o.to ?? o.from, anchor = m.anchor === 'target' ? to : o.from;
    a.matrix = this.matrix(a);
    setMatrix(a.root, ...a.matrix, anchor.x, anchor.y);
    for (const plan of a.tiers) { const p = this.tierPoint(a, plan, a.matrix), s = Math.sign(a.matrix[0]) || 1; setMatrix(plan.root, s, 0, 0, 1, p.x, p.y); }
    const index = Math.min(m.frameCount - 1, Math.floor(a.time * m.fps / 1000));
    a.sprites.forEach((s, li) => {
      const f = m.layers[li].frames[index], t = a.pack.frames[li][index], plan = a.tierOf[li];
      s.visible = !!f && (!plan || plan.enabled);
      // A tier's frames are drawn around its anchor, so the tier root alone decides where the impact lands.
      if (f && t) { s.texture = t; s.position.set(plan ? f[5] - plan.tier.anchor_point.x : f[5], plan ? f[6] - plan.tier.anchor_point.y : f[6]); s.scale.set(1 / (m.layers[li].scale ?? m.scale)); }
    });
  }
  /**
   * Where an impact tier is anchored in the parent's space: the baked target's feet mapped by the pack's own
   * placement (so tiers land where the rest of the pack does; exactly on `to` with fitDistance), then the tier's
   * own height above the feet. Tiers are translated and mirrored only, never sheared or stretched.
   */
  private tierPoint(a: Active, plan: TierPlan, matrix: [number, number, number, number]): Point {
    const m = a.pack.manifest, to = a.options.to ?? a.options.from, [ma, mb, mc, md] = matrix, s = Math.sign(ma) || 1, at = plan.tier.anchor_point;
    const feet = m.anchor === 'target' ? to : { x: a.options.from.x + ma * m.target.x + mc * m.target.y, y: a.options.from.y + mb * m.target.x + md * m.target.y };
    return { x: feet.x + s * (at.x - m.target.x), y: feet.y + (at.y - m.target.y) };
  }
  private emitTiers(a: Active): boolean {
    while (a.tierCursor < a.tierOrder.length && a.tierOrder[a.tierCursor].startMs <= a.time) {
      const plan = a.tierOrder[a.tierCursor++];
      if (!plan.enabled || !this.tierListeners.size) continue;
      const matrix = this.matrix(a), t = plan.tier, s = Math.sign(matrix[0]) || 1;
      const event: TierEvent = { tier: t.id, tierNumber: t.tier, packId: a.pack.manifest.id, handle: a.handle, point: this.tierPoint(a, plan, matrix),
        anchorType: t.anchor_type, zLayer: t.default_z_layer, blend: t.recommended_blend_mode, startMs: plan.startMs,
        ...(t.normal_deg === undefined ? {} : { normalDeg: ((s < 0 ? 180 - t.normal_deg : t.normal_deg) % 360 + 360) % 360 }) };
      for (const listener of this.tierListeners) listener(event);
      if (this.dead || !this.active.has(a)) return false;
    }
    return true;
  }
  private emitCues(a: Active) {
    if (!this.emitTiers(a)) return false;
    const cues = a.pack.manifest.cues;
    while (a.cue < cues.length && cues[a.cue].t <= a.time) {
      const cue = cues[a.cue++];
      if (cue.type === 'hitstop' && this.hitstopEnabled) a.freeze = Math.max(a.freeze, cue.ms ?? 0);
      if (cue.type === 'shake' && this.shakeEnabled) Object.assign(this.shake, { age: 0, duration: cue.ms ?? 0, amp: cue.amp ?? 0 });
      for (const listener of this.listeners) listener({ ...cue, packId: a.pack.manifest.id, handle: a.handle });
      if (this.dead || !this.active.has(a)) return false;
    }
    return !this.dead && this.active.has(a);
  }
  update(dtMs: number) {
    if (this.dead) return;
    if (!Number.isFinite(dtMs) || dtMs < 0) throw Error('Invalid delta');
    this.updateShake(dtMs);
    for (const a of this.active) {
      let remaining = dtMs;
      if (a.freeze > 0 && this.hitstopEnabled) { const paused = Math.min(remaining, a.freeze); a.freeze -= paused; remaining -= paused; }
      else a.freeze = 0;
      a.time += remaining * (a.options.speed ?? 1);
      const duration = a.pack.manifest.durationMs;
      let cycles = 0;
      while (a.time >= duration) {
        this.emitCues(a);
        if (this.dead || !this.active.has(a)) break;
        if (!a.options.loop) { this.finish(a); break; }
        a.time -= duration; a.cue = 0; a.tierCursor = 0; cycles++;
        if (cycles >= MAX_LOOP_CYCLES_PER_UPDATE && a.time >= duration) {
          a.time %= duration; a.cue = 0; a.tierCursor = 0; break;
        }
      }
      if (this.dead || !this.active.has(a)) continue;
      this.emitCues(a);
      if (this.dead || !this.active.has(a)) continue;
      this.draw(a);
    }
  }
  private updateShake(dt: number) {
    const target = this.options.shake?.target, s = this.shake;
    if (!target) return;
    target.x -= s.x; target.y -= s.y; s.x = s.y = 0;
    s.age += dt;
    if (this.shakeEnabled && s.age < s.duration) {
      const amp = s.amp * (1 - s.age / s.duration);
      s.x = Math.sin(s.age * 0.19) * amp; s.y = Math.cos(s.age * 0.23) * amp;
      target.x += s.x; target.y += s.y;
    }
  }
  private finish(a: Active) {
    if (!this.active.delete(a)) return;
    for (const root of [a.root, ...a.tiers.map(t => t.root)]) { root.removeFromParent(); root.removeChildren(); this.roots.push(root); }
    a.sprites.forEach(s => { s.visible = false; s.texture = Texture.EMPTY; this.sprites.push(s); });
    a.resolve();
  }
  unload(id: string) {
    const at = id.indexOf('@'), family = at < 0 ? id : id.slice(0, at);
    if (at < 0) this.cancelledLoads.set(family, this.requestSerial);
    const doomed = at < 0 ? this.families.get(id) ?? [] : [this.packs.get(id)].filter((p): p is Pack => !!p);
    for (const pack of doomed) {
      for (const a of this.active) if (a.pack === pack) this.finish(a);
      pack.frames.flat().forEach(t => t?.destroy()); pack.sheets.forEach(t => t.destroy(true)); this.packs.delete(keyOf(pack.manifest));
    }
    const rest = (this.families.get(family) ?? []).filter(p => !doomed.includes(p));
    if (rest.length) this.families.set(family, rest); else this.families.delete(family);
  }
  destroy() {
    if (this.dead) return;
    this.dead = true; this.app.ticker.remove(this.tick);
    for (const id of [...this.families.keys()]) this.unload(id);
    this.shakeEnabled = false; this.updateShake(0);
    this.sprites.forEach(s => s.destroy()); this.roots.forEach(r => r.destroy());
    this.sprites = []; this.roots = []; this.listeners.clear(); this.tierListeners.clear();
  }
}
