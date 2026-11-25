// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Batched ramp quads: every ramp (energy) layer of every active playback that shares an atlas sheet, a blend and a parent is
// written into ONE dynamic mesh, so N playbacks cost one draw call per sheet instead of one per playback. Quads carry their
// ramp row as a vertex attribute, so different elements share that draw call too. Pixi 8 + WebGL only.
import * as PIXI from 'pixi.js';
import type { Container, Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { RampSet } from './ramp.js';

// Static `(PIXI as any).Name` member access only: `BufferUsage` does not exist on Pixi 7 (this module must still bundle there; it is only
// used on Pixi 8), and aliasing the namespace (`const P = PIXI`) would stop bundlers tree-shaking Pixi, costing ~100 KB on every page.

const VERTEX = /* glsl */`
in vec2 aPosition;
in vec2 aUV;
in float aRamp;
out vec2 vUV;
out float vRamp;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vRamp = aRamp;
}`;
// The mask level is a position along the quad's ramp row. Sampling at the centre of the row keeps neighbouring ramps out.
const FRAGMENT = /* glsl */`
precision highp float;
in vec2 vUV;
in float vRamp;
uniform sampler2D uTexture;
uniform sampler2D uRamp;
uniform float uRows;
void main() {
  float level = texture(uTexture, vUV).r;
  gl_FragColor = vec4(texture(uRamp, vec2(level, (vRamp + 0.5) / uRows)).rgb, 1.0);
}`;

/** One mesh: up to `capacity` quads, grown (rarely, by doubling) when full. A freed or hidden quad is collapsed to a point. */
export class QuadBatch {
  readonly mesh: Mesh;
  /** Draw calls this batch costs while it has quads: always one. */
  readonly sheet: Texture;
  capacity = 0;
  live = 0;
  private geometry!: MeshGeometry;
  private positions!: Float32Array;
  private uvs!: Float32Array;
  private rows!: Float32Array;
  private free: number[] = [];
  private shader: any;
  private dirty = false;

  constructor(sheet: Texture, ramps: RampSet, additive: boolean) {
    this.sheet = sheet;
    this.shader = (PIXI as any).Shader.from({
      gl: { vertex: VERTEX, fragment: FRAGMENT },
      resources: { uTexture: sheet.source, uSampler: (sheet.source as any).style, uRamp: ramps.texture.source, uRampSampler: (ramps.texture.source as any).style, ramp: { uRows: { value: ramps.rows, type: 'f32' } } },
    });
    this.grow(64);
    this.mesh = new (PIXI as any).Mesh({ geometry: this.geometry, shader: this.shader });
    this.mesh.blendMode = (additive ? 'add' : 'normal') as any;
    this.mesh.visible = false;
  }
  private grow(capacity: number) {
    const oldPositions = this.positions, oldUvs = this.uvs, oldRows = this.rows, old = this.capacity;
    const indices = new Uint32Array(capacity * 6);
    for (let q = 0; q < capacity; q++) { const v = q * 4, i = q * 6; indices[i] = v; indices[i + 1] = v + 1; indices[i + 2] = v + 2; indices[i + 3] = v + 1; indices[i + 4] = v + 3; indices[i + 5] = v + 2; }
    this.positions = new Float32Array(capacity * 8); this.uvs = new Float32Array(capacity * 8); this.rows = new Float32Array(capacity * 4);
    if (oldPositions) { this.positions.set(oldPositions); this.uvs.set(oldUvs); this.rows.set(oldRows); }
    for (let q = capacity - 1; q >= old; q--) this.free.push(q);
    const geometry: MeshGeometry = new (PIXI as any).MeshGeometry({ positions: this.positions, uvs: this.uvs, indices });
    geometry.addAttribute('aRamp', { buffer: new (PIXI as any).Buffer({ data: this.rows, usage: (PIXI as any).BufferUsage.VERTEX | (PIXI as any).BufferUsage.COPY_DST }), format: 'float32', stride: 4, offset: 0 });
    const previous = this.geometry; this.geometry = geometry; this.capacity = capacity;
    if (this.mesh) { this.mesh.geometry = geometry; previous?.destroy(); }
    this.dirty = true;
  }
  /** Reserves a quad. Starts hidden. */
  alloc(): number {
    if (!this.free.length) this.grow(this.capacity * 2);
    const slot = this.free.pop()!;
    this.live++; this.hide(slot);
    return slot;
  }
  release(slot: number): void { this.hide(slot); this.free.push(slot); this.live--; }
  /** Collapses the quad to nothing. */
  hide(slot: number): void { const p = this.positions, o = slot * 8; for (let i = 0; i < 8; i++) p[o + i] = 0; this.dirty = true; }
  /** Writes a quad: corners (x0,y0) top-left, (x1,y1) top-right, (x2,y2) bottom-left, (x3,y3) bottom-right; UV rect; ramp row. */
  set(slot: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, u0: number, v0: number, u1: number, v1: number, row: number): void {
    const p = this.positions, t = this.uvs, o = slot * 8;
    p[o] = x0; p[o + 1] = y0; p[o + 2] = x1; p[o + 3] = y1; p[o + 4] = x2; p[o + 5] = y2; p[o + 6] = x3; p[o + 7] = y3;
    t[o] = u0; t[o + 1] = v0; t[o + 2] = u1; t[o + 3] = v0; t[o + 4] = u0; t[o + 5] = v1; t[o + 6] = u1; t[o + 7] = v1;
    const r = this.rows, q = slot * 4; r[q] = r[q + 1] = r[q + 2] = r[q + 3] = row;
    this.dirty = true;
  }
  /** Uploads the buffers if anything changed this frame and shows the mesh only while it has quads. */
  flush(): void {
    this.mesh.visible = this.live > 0;
    if (!this.dirty || !this.live) return;
    this.dirty = false;
    this.geometry.getBuffer('aPosition').update(); this.geometry.getBuffer('aUV').update(); this.geometry.getBuffer('aRamp').update();
  }
  destroy(): void { this.mesh.removeFromParent(); this.mesh.destroy(); this.geometry.destroy(); }
}

/** Finds or creates the batch for (parent, sheet, blend) and flushes them all once per update. */
export class BatchSet {
  /** parent → sheet source → [normal, additive] batch. Keyed by object, so a lookup builds no key string. */
  private batches = new Map<object, Map<object, (QuadBatch | undefined)[]>>();
  private list: QuadBatch[] = [];
  constructor(private ramps: RampSet) {}
  /** The batch drawing `sheet` additively (or normally) inside `parent`; moved on top of its siblings so energy draws above materials. */
  get(parent: Container, sheet: Texture, additive: boolean): QuadBatch {
    let bySource = this.batches.get(parent);
    if (!bySource) this.batches.set(parent, bySource = new Map());
    let pair = bySource.get(sheet.source);
    if (!pair) bySource.set(sheet.source, pair = [undefined, undefined]);
    let batch = pair[additive ? 1 : 0];
    if (!batch) { batch = pair[additive ? 1 : 0] = new QuadBatch(sheet, this.ramps, additive); this.list.push(batch); }
    parent.addChild(batch.mesh);
    return batch;
  }
  flush(): void { for (let i = 0; i < this.list.length; i++) this.list[i].flush(); }
  /** Drops the batches that draw `sheet` (its pack was unloaded). */
  dropSheet(sheet: Texture): void {
    for (const bySource of this.batches.values()) {
      const pair = bySource.get(sheet.source);
      if (!pair) continue;
      for (const batch of pair) if (batch) { batch.destroy(); this.list.splice(this.list.indexOf(batch), 1); }
      bySource.delete(sheet.source);
    }
  }
  /** Draw calls the batches would issue right now (one per batch holding live quads). */
  get activeBatches(): number { let n = 0; for (let i = 0; i < this.list.length; i++) if (this.list[i].live > 0) n++; return n; }
  destroy(): void { for (const batch of this.list) batch.destroy(); this.batches.clear(); this.list.length = 0; }
}
