// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Container, Sprite, Texture } from 'pixi.js';
import type { Application } from 'pixi.js';
import { frameTexture, setBlend, v8 } from './compat.js';
import { readContainer, validate } from './format.js';
import type { Cue, Manifest } from './format.js';
export type { Cue, Manifest, Frame } from './format.js';
export interface Point { x: number; y: number }
export interface PlayOptions {
  from: Point; to?: Point; parent?: Container; zIndex?: number; speed?: number; fitDistance?: boolean; loop?: boolean;
}
export interface PlayerOptions {
  packs?: string[]; loadKey?: string; shake?: { target: Container }; hitstop?: boolean;
}
export interface Playback { stop(): void; finished: Promise<void> }
export type CueEvent = Cue & { packId: string; handle: Playback };
interface Pack { manifest: Manifest; sheets: Texture[]; frames: (Texture | null)[][] }
interface Active {
  pack: Pack; options: PlayOptions; root: Container; sprites: Sprite[]; time: number; cue: number; freeze: number;
  handle: Playback; resolve(): void;
}
export class VfxPlayer {
  shakeEnabled: boolean;
  hitstopEnabled: boolean;
  private packs = new Map<string, Pack>();
  private active = new Set<Active>();
  private sprites: Sprite[] = [];
  private roots: Container[] = [];
  private listeners = new Set<(event: CueEvent) => void>();
  private dead = false;
  private loading = new Map<string, Promise<void>>();
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
        task = this.loadOne(url); this.loading.set(url, task);
        task.finally(() => this.loading.delete(url)).catch(() => {});
      }
      await task;
    }
  }
  private async loadOne(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw Error(`VFX load failed (${response.status}): ${url}`);
    const binary = new URL(url, document.baseURI).pathname.endsWith('.vfxb');
    const decoded = binary ? readContainer(await response.arrayBuffer(), this.options.loadKey) : null;
    const manifest = decoded?.manifest ?? validate(await response.json());
    manifest.cues = manifest.cues.slice().sort((a, b) => a.t - b.t);
    if (this.dead) throw Error('VfxPlayer is destroyed');
    if (this.packs.has(manifest.id)) return;
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
      if (this.packs.has(manifest.id)) { frames.flat().forEach(t => t?.destroy()); textures.forEach(t => t.destroy(true)); return; }
      this.packs.set(manifest.id, { manifest, sheets: [...textures.values()], frames });
    } catch (error) { frames.flat().forEach(t => t?.destroy()); textures.forEach(t => t.destroy(true)); throw error; }
  }
  play(id: string, options: PlayOptions): Playback {
    if (this.dead) throw Error('VfxPlayer is destroyed');
    const pack = this.packs.get(id); if (!pack) throw Error(`Pack not loaded: ${id}`);
    if (!options?.from || !Number.isFinite(options.from.x) || !Number.isFinite(options.from.y) || (options.to && (!Number.isFinite(options.to.x) || !Number.isFinite(options.to.y))) || (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed <= 0))) throw Error('Invalid playback options');
    const root = this.roots.pop() ?? new Container();
    root.zIndex = options.zIndex ?? 0;
    const sprites = pack.manifest.layers.map(layer => {
      const sprite = this.sprites.pop() ?? new Sprite(); sprite.anchor.set(0); sprite.visible = false;
      setBlend(sprite, layer.blend === 'add'); root.addChild(sprite); return sprite;
    });
    (options.parent ?? this.app.stage).addChild(root);
    let resolve!: () => void;
    const finished = new Promise<void>(done => { resolve = done; });
    const a: Active = { pack, options, root, sprites, time: 0, cue: 0, freeze: 0, resolve, handle: { finished, stop: () => this.finish(a) } };
    this.active.add(a); this.draw(a); this.emitCues(a);
    return a.handle;
  }
  on(type: 'cue', listener: (event: CueEvent) => void): this { if (type === 'cue') this.listeners.add(listener); return this; }
  off(type: 'cue', listener: (event: CueEvent) => void): this { if (type === 'cue') this.listeners.delete(listener); return this; }
  stats() { return { active: this.active.size, pooled: this.sprites.length, packs: this.packs.size }; }
  private draw(a: Active) {
    const m = a.pack.manifest, o = a.options, to = o.to ?? o.from, anchor = m.anchor === 'target' ? to : o.from;
    const direction = to.x < o.from.x ? -1 : 1;
    const distance = Math.abs(to.x - o.from.x);
    const fit = o.fitDistance && Math.abs(m.target.x - m.origin.x) > 0 ? distance / Math.abs(m.target.x - m.origin.x) : 1;
    a.root.position.set(anchor.x, anchor.y); a.root.scale.set(direction * fit, 1);
    const index = Math.min(m.frameCount - 1, Math.floor(a.time * m.fps / 1000));
    a.sprites.forEach((s, li) => {
      const f = m.layers[li].frames[index], t = a.pack.frames[li][index];
      s.visible = !!f;
      if (f && t) { s.texture = t; s.position.set(f[5], f[6]); s.scale.set(1 / m.scale); }
    });
  }
  private emitCues(a: Active) {
    const cues = a.pack.manifest.cues;
    while (a.cue < cues.length && cues[a.cue].t <= a.time) {
      const cue = cues[a.cue++];
      if (cue.type === 'hitstop' && this.hitstopEnabled) a.freeze = Math.max(a.freeze, cue.ms ?? 0);
      if (cue.type === 'shake' && this.shakeEnabled) Object.assign(this.shake, { age: 0, duration: cue.ms ?? 0, amp: cue.amp ?? 0 });
      for (const listener of this.listeners) listener({ ...cue, packId: a.pack.manifest.id, handle: a.handle });
      if (!this.active.has(a)) break;
    }
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
      this.emitCues(a);
      if (!this.active.has(a)) continue;
      if (a.time >= duration) {
        if (!a.options.loop) { this.finish(a); continue; }
        a.time %= duration; a.cue = 0; this.emitCues(a);
      }
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
    a.root.removeFromParent(); a.root.removeChildren();
    a.sprites.forEach(s => { s.visible = false; s.texture = Texture.EMPTY; this.sprites.push(s); });
    this.roots.push(a.root); a.resolve();
  }
  unload(id: string) {
    const pack = this.packs.get(id); if (!pack) return;
    for (const a of this.active) if (a.pack === pack) this.finish(a);
    pack.frames.flat().forEach(t => t?.destroy()); pack.sheets.forEach(t => t.destroy(true)); this.packs.delete(id);
  }
  destroy() {
    if (this.dead) return;
    this.dead = true; this.app.ticker.remove(this.tick);
    for (const id of this.packs.keys()) this.unload(id);
    this.shakeEnabled = false; this.updateShake(0);
    this.sprites.forEach(s => s.destroy()); this.roots.forEach(r => r.destroy());
    this.sprites = []; this.roots = []; this.listeners.clear();
  }
}
