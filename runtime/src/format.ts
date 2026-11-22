// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
export type Frame = [number, number, number, number, number, number, number] | null;
export interface Cue { t: number; type: string; id?: string; amp?: number; ms?: number }
export type ActorName = 'caster' | 'target';
export type ActorFrame = [number, number, number, number];
export interface ActorTrack { frames: ActorFrame[] }
export interface Manifest {
  format: 'lenhon-vfx'; version: 1; id: string; name: { en: string; vi: string };
  element: string; category: string; fps: number; frameCount: number; durationMs: number; scale: number;
  origin: { x: number; y: number }; target: { x: number; y: number }; anchor: 'caster' | 'target';
  layers: { name: string; blend: 'normal' | 'add'; scale?: number; sheets: string[]; frames: Frame[] }[];
  cues: Cue[];
  actors?: Partial<Record<ActorName, ActorTrack>>;
}
export function validate(value: unknown): Manifest {
  const m = value as Manifest;
  const point = (p: { x: number; y: number }) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (!m || m.format !== 'lenhon-vfx' || m.version !== 1 || typeof m.id !== 'string' || !m.id ||
    !Number.isFinite(m.fps) || m.fps <= 0 || !Number.isInteger(m.frameCount) || m.frameCount < 1 ||
    !Number.isFinite(m.durationMs) || m.durationMs <= 0 || !Number.isFinite(m.scale) || m.scale <= 0 ||
    !point(m.origin) || !point(m.target) || !['caster', 'target'].includes(m.anchor) || !Array.isArray(m.layers) || !m.layers.length || !Array.isArray(m.cues)) throw Error('Invalid lenhon-vfx manifest');
  for (const l of m.layers) {
    if (l.scale !== undefined && (!Number.isFinite(l.scale) || l.scale <= 0)) throw Error('Invalid VFX layer scale');
    if (!['normal', 'add'].includes(l.blend) || !Array.isArray(l.sheets) || !l.sheets.every(s => typeof s === 'string' && s.length) || !Array.isArray(l.frames) || l.frames.length !== m.frameCount) throw Error('Invalid VFX layer');
    for (const f of l.frames) if (f !== null && (!Array.isArray(f) || f.length !== 7 || !f.every(Number.isFinite) || !Number.isInteger(f[0]) || f[0] < 0 || f[0] >= l.sheets.length || f[1] < 0 || f[2] < 0 || f[3] <= 0 || f[4] <= 0)) throw Error('Invalid VFX frame');
  }
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
