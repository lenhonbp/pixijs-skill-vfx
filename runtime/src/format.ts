// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
export type Frame = [number, number, number, number, number, number, number] | null;
export interface Cue { t: number; type: string; id?: string; amp?: number; ms?: number }
export type ActorName = 'caster' | 'target';
export type ActorFrame = [number, number, number, number];
export interface ActorTrack { frames: ActorFrame[] }
export type TierId = 'hit_point' | 'ground_feedback' | 'body_residual';
export type AnchorType = 'contact_normal' | 'ground_center' | 'body_center';
export type BlendAdvice = 'ADD' | 'SCREEN' | 'NORMAL';
export type ZLayer = 'foreground' | 'target_overlay' | 'background';
/** One tier of a baked impact: the layers that draw it and where, when and how to place them. */
export interface ImpactTier {
  /** 1 = hit point (cause), 2 = ground feedback (effect), 3 = body residual (aftermath). */
  tier: 1 | 2 | 3; id: TierId; role: string;
  anchor_type: AnchorType;
  /** Pivot in the pack's pixel space (origin = caster's feet, y down). Frame offsets share this space. */
  anchor_point: { x: number; y: number };
  /** contact_normal tiers only: direction (degrees, 0 = right) the surface normal faces, back toward the source. */
  normal_deg?: number;
  pivot: string; y_sort: number;
  recommended_blend_mode: BlendAdvice; default_z_layer: ZLayer;
  start_frame: number;
  /** Names of the manifest layers that make up this tier. */
  layers: string[];
}
export interface ImpactMeta {
  schema_version: 1;
  hit_vector: { x: number; y: number; angle_deg: number };
  sequence_timing: { unit: 'frames'; fps: number; ordered?: boolean } & Partial<Record<TierId, { start_frame: number; offset_frames: number }>>;
  tiers: ImpactTier[];
}
export interface Manifest {
  format: 'lenhon-vfx'; version: 1; id: string; name: { en: string; vi: string };
  element: string; category: string; fps: number; frameCount: number; durationMs: number; scale: number;
  origin: { x: number; y: number }; target: { x: number; y: number }; anchor: 'caster' | 'target';
  /** Ground-plane bake direction in degrees (0 = right, 90 = toward the camera). Absent on packs that look the same in every direction. */
  direction?: number;
  /** Camera squash (ground y / screen y) the pack was baked with. */
  groundSquash?: number;
  /** `ramp: true` marks an energy layer stored as a luminance mask (see `color`). */
  /**
   * `default_z_layer: 'background'` marks ground decals, runes and floor glows: draw the layer beneath the characters, in its own root,
   * instead of in the pack's depth slot. Layers owned by an impact tier take their depth from the tier. Other values are reserved.
   */
  layers: { name: string; blend: 'normal' | 'add'; scale?: number; sheets: string[]; frames: Frame[]; ramp?: boolean; default_z_layer?: 'background' }[];
  cues: Cue[];
  /**
   * Present on packs baked with grayscale energy layers: the masks are coloured through a gradient ramp.
   * `lut` is the pack's native ramp (256 RGB triples, base64) that reproduces the baked look; `ramp` suggests a preset.
   * An unknown `mode` is ignored (the pack plays as plain layers).
   */
  color?: { mode: 'ramp'; channel: 'value'; ramp?: string; lut?: string };
  /** Present on packs whose impact was baked in tiers; see ImpactMeta. Absent or unknown versions are ignored. */
  impact?: ImpactMeta;
  actors?: Partial<Record<ActorName, ActorTrack>>;
}
const TIER_IDS = ['hit_point', 'ground_feedback', 'body_residual'];
const ANCHORS = ['contact_normal', 'ground_center', 'body_center'];
const BLENDS = ['ADD', 'SCREEN', 'NORMAL'];
const Z_LAYERS = ['foreground', 'target_overlay', 'background'];
/**
 * An impact block with a schema version this runtime does not know is dropped (the pack still plays as flat
 * layers); a version-1 block that contradicts its own pack is an error.
 */
function validateImpact(m: Manifest) {
  const i = m.impact as any;
  if (!i || typeof i !== 'object' || i.schema_version !== 1) { delete m.impact; return; }
  const bad = (why: string): never => { throw Error(`Invalid VFX impact block: ${why}`); };
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  if (!i.hit_vector || !finite(i.hit_vector.x) || !finite(i.hit_vector.y) || !finite(i.hit_vector.angle_deg)) bad('hit_vector');
  if (!i.sequence_timing || i.sequence_timing.unit !== 'frames') bad('sequence_timing');
  if (!Array.isArray(i.tiers) || !i.tiers.length) bad('tiers');
  const layers = new Set(m.layers.map(l => l.name)), claimed = new Set<string>(), seen = new Set<string>();
  for (const t of i.tiers) {
    if (!t || !TIER_IDS.includes(t.id) || seen.has(t.id) || ![1, 2, 3].includes(t.tier)) bad('tier id');
    seen.add(t.id);
    if (!ANCHORS.includes(t.anchor_type) || !BLENDS.includes(t.recommended_blend_mode) || !Z_LAYERS.includes(t.default_z_layer)) bad(`${t.id} enums`);
    if (!t.anchor_point || !finite(t.anchor_point.x) || !finite(t.anchor_point.y) || (t.normal_deg !== undefined && !finite(t.normal_deg))) bad(`${t.id} anchor`);
    if (!Number.isInteger(t.start_frame) || t.start_frame < 0 || t.start_frame >= m.frameCount) bad(`${t.id} start_frame`);
    if (!Array.isArray(t.layers) || !t.layers.length) bad(`${t.id} layers`);
    for (const name of t.layers) {
      if (!layers.has(name) || claimed.has(name)) bad(`${t.id} layer ${name}`);
      claimed.add(name);
    }
  }
}
/** A ramp block of a mode this runtime does not know is dropped; a ramp block that contradicts its layers is an error. */
function validateColor(m: Manifest) {
  const c = m.color as any;
  if (!c || typeof c !== 'object' || c.mode !== 'ramp') { delete m.color; return; }
  const bad = (why: string): never => { throw Error(`Invalid VFX colour mode: ${why}`); };
  if (c.channel !== 'value') bad('channel');
  if (c.ramp !== undefined && (typeof c.ramp !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(c.ramp))) bad('ramp id');
  if (c.lut !== undefined && (typeof c.lut !== 'string' || !/^[A-Za-z0-9+/]{1024}$/.test(c.lut))) bad('lut');
  for (const layer of m.layers) if (layer.ramp !== undefined && (layer.ramp !== true || layer.blend !== 'add')) bad(`layer ${layer.name} must be additive to be a ramp layer`);
}
/** A depth hint this runtime does not know is dropped (the layer then keeps the pack's depth); a malformed one, or one on a tier's layer, is an error. */
function validateLayerDepth(m: Manifest) {
  const owned = new Set((m.impact?.tiers ?? []).flatMap(t => t.layers));
  for (const layer of m.layers) {
    const z = layer.default_z_layer as unknown;
    if (z === undefined) continue;
    if (typeof z !== 'string') throw Error(`Invalid VFX layer depth: layer ${layer.name}`);
    if (z !== 'background') { delete layer.default_z_layer; continue; }
    if (owned.has(layer.name)) throw Error(`Invalid VFX layer depth: layer ${layer.name} belongs to an impact tier`);
  }
}
export function validate(value: unknown): Manifest {
  const m = value as Manifest;
  const point = (p: { x: number; y: number }) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (!m || m.format !== 'lenhon-vfx' || m.version !== 1 || typeof m.id !== 'string' || !m.id ||
    !Number.isFinite(m.fps) || m.fps <= 0 || !Number.isInteger(m.frameCount) || m.frameCount < 1 ||
    !Number.isFinite(m.durationMs) || m.durationMs <= 0 || !Number.isFinite(m.scale) || m.scale <= 0 ||
    !point(m.origin) || !point(m.target) || !['caster', 'target'].includes(m.anchor) || !Array.isArray(m.layers) || !m.layers.length || !Array.isArray(m.cues)) throw Error('Invalid lenhon-vfx manifest');
  if (m.direction !== undefined && (!Number.isFinite(m.direction) || m.direction < -90 || m.direction > 90)) throw Error('Invalid VFX direction');
  if (m.groundSquash !== undefined && (!Number.isFinite(m.groundSquash) || m.groundSquash <= 0 || m.groundSquash > 1)) throw Error('Invalid VFX ground squash');
  for (const l of m.layers) {
    if (l.scale !== undefined && (!Number.isFinite(l.scale) || l.scale <= 0)) throw Error('Invalid VFX layer scale');
    if (!['normal', 'add'].includes(l.blend) || !Array.isArray(l.sheets) || !l.sheets.every(s => typeof s === 'string' && s.length) || !Array.isArray(l.frames) || l.frames.length !== m.frameCount) throw Error('Invalid VFX layer');
    for (const f of l.frames) if (f !== null && (!Array.isArray(f) || f.length !== 7 || !f.every(Number.isFinite) || !Number.isInteger(f[0]) || f[0] < 0 || f[0] >= l.sheets.length || f[1] < 0 || f[2] < 0 || f[3] <= 0 || f[4] <= 0)) throw Error('Invalid VFX frame');
  }
  if (m.color !== undefined) validateColor(m);
  if (m.impact !== undefined) validateImpact(m);
  validateLayerDepth(m);
  if (m.actors !== undefined) {
    if (!m.actors || typeof m.actors !== 'object' || Array.isArray(m.actors)) throw Error('Invalid VFX actors');
    for (const [name, track] of Object.entries(m.actors)) {
      if (!['caster', 'target'].includes(name) || !track || !Array.isArray(track.frames) || track.frames.length !== m.frameCount) throw Error('Invalid VFX actor track');
      for (const f of track.frames) if (!Array.isArray(f) || f.length !== 4 || !f.every(Number.isFinite) || !Number.isInteger(f[3]) || f[3] < 0 || f[3] > 3) throw Error('Invalid VFX actor frame');
    }
  }
  for (const c of m.cues) if (!Number.isFinite(c.t) || c.t < 0 || typeof c.type !== 'string' || (c.ms !== undefined && (!Number.isFinite(c.ms) || c.ms < 0)) || (c.amp !== undefined && !Number.isFinite(c.amp))) throw Error('Invalid VFX cue');
  return m;
}
export function readContainer(buffer: ArrayBuffer, key = 'lenhon-vfx'): { manifest: Manifest; sheets: Map<string, Uint8Array> } {
  const file = new Uint8Array(buffer), header = new DataView(buffer);
  const text = new TextDecoder('utf-8', { fatal: true });
  if (file.length < 8 || text.decode(file.subarray(0, 4)) !== 'LVFX' || file[4] !== 1 || file[5] > 1 || header.getUint16(6, true)) throw Error('Invalid LVFX header');
  const data = file.slice(8);
  if (file[5] & 1) {
    let state = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(key)) state = Math.imul(state ^ byte, 0x01000193) >>> 0;
    for (let i = 0; i < data.length; i++) {
      let n = state = (state + 0x6d2b79f5) >>> 0;
      n = Math.imul(n ^ (n >>> 15), n | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      data[i] ^= Math.floor(((n ^ (n >>> 14)) >>> 0) / 0x100000000 * 256);
    }
  }
  let cursor = 0;
  const take = (n: number) => { if (cursor + n > data.length) throw Error('Truncated LVFX or incorrect key'); const b = data.subarray(cursor, cursor + n); cursor += n; return b; };
  const u32 = () => { const b = take(4); return new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true); };
  const manifest = validate(JSON.parse(text.decode(take(u32()))));
  const sheets = new Map<string, Uint8Array>();
  for (let count = u32(); count > 0; count--) {
    const len = take(2), name = text.decode(take(len[0] | len[1] << 8));
    if (sheets.has(name)) throw Error('Duplicate LVFX sheet');
    sheets.set(name, take(u32()));
  }
  if (cursor !== data.length) throw Error('Trailing LVFX bytes');
  return { manifest, sheets };
}
