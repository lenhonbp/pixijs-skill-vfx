// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// 1D gradient ramps (look-up tables). A pack baked with `--mono` stores its energy layers as a luminance mask; the shader reads
// the mask as a position along a ramp, so one atlas plays as any element. All ramps live as rows of ONE 256 x 64 texture, so
// different elements share a draw call.
import { Texture } from 'pixi.js';

/** `[position 0-1, 0xRRGGBB]` stops, ascending. Position 0 should be black so additive glow fades to nothing. */
export type RampStops = readonly (readonly [number, number])[];
export interface RampPreset { id: string; stops: RampStops; aliases: readonly string[] }

const fromPalette = (dark: number, main: number, core: number): RampStops => [[0, 0x000000], [0.3, dark], [0.65, main], [1, core]];
/**
 * Ngu Hanh element ramps (black, shadow, hue, core from the element palettes) and the named looks Metal/Gold, Fire/Crimson and
 * Lightning/Cyan. Generated from the factory's kit/ramps.ts; the factory checks that the two agree.
 */
export const RAMP_PRESETS: readonly RampPreset[] = [
  { id: 'kim', aliases: ['metal'], stops: fromPalette(0x8a6a2a, 0xffe08a, 0xffffff) },
  { id: 'moc', aliases: ['wood', 'nature'], stops: fromPalette(0x2c6b24, 0x7ee05a, 0xf2ffd8) },
  { id: 'thuy', aliases: ['water', 'ice'], stops: fromPalette(0x174a9a, 0x4fc3ff, 0xeaffff) },
  { id: 'hoa', aliases: ['fire'], stops: fromPalette(0x8a1a05, 0xff7a1a, 0xfff3c4) },
  { id: 'tho', aliases: ['earth', 'stone'], stops: fromPalette(0x5a3a1a, 0xd9a050, 0xfff0d0) },
  { id: 'loi', aliases: ['lightning', 'storm'], stops: fromPalette(0x3a2a9a, 0xa8b4ff, 0xffffff) },
  { id: 'phong', aliases: ['wind'], stops: fromPalette(0x2a7f78, 0x8ff0d0, 0xffffff) },
  { id: 'gold', aliases: [], stops: [[0, 0x000000], [0.3, 0x5a3a08], [0.65, 0xffc23a], [1, 0xfff6d0]] },
  { id: 'crimson', aliases: [], stops: [[0, 0x000000], [0.3, 0x400408], [0.65, 0xd01030], [1, 0xffd0b0]] },
  { id: 'cyan', aliases: [], stops: [[0, 0x000000], [0.3, 0x06304a], [0.65, 0x22d4ff], [1, 0xe8ffff]] },
];

const SIZE = 256, ROWS = 64;
function lerpColor(a: number, b: number, t: number): [number, number, number] {
  return [(a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * t, (a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * t, (a & 255) + ((b & 255) - (a & 255)) * t];
}

/**
 * The ramp texture: 256 x 64 RGBA, one ramp per row (64 KB for all of them). Rows are written when a ramp is registered,
 * never per frame. A pack's own native ramp takes a row while the pack is loaded.
 */
export class RampSet {
  readonly texture: Texture;
  readonly rows = ROWS;
  private canvas = document.createElement('canvas');
  private image: ImageData;
  private ids = new Map<string, number>();
  private aliases = new Map<string, string>();
  private used = new Uint8Array(ROWS);

  constructor() {
    this.canvas.width = SIZE; this.canvas.height = ROWS;
    this.image = this.canvas.getContext('2d')!.createImageData(SIZE, ROWS);
    this.texture = Texture.from(this.canvas);
    const style = (this.texture.source as any)?.style;   // Pixi 7 has no `source` (and no ramp shader: only colorAt() is used there)
    if (style) { style.addressMode = 'clamp-to-edge'; style.scaleMode = 'linear'; }
    for (const preset of RAMP_PRESETS) { this.add(preset.id, preset.stops); for (const alias of preset.aliases) this.aliases.set(alias, preset.id); }
  }
  /** Registers (or replaces) a ramp from stops. Returns its row. */
  add(id: string, stops: RampStops): number {
    const row = this.claim(id);
    for (let i = 0; i < SIZE; i++) {
      const t = i / (SIZE - 1);
      let k = 1; while (k < stops.length - 1 && t > stops[k][0]) k++;
      const [p0, c0] = stops[k - 1], [p1, c1] = stops[k], f = Math.max(0, Math.min(1, (t - p0) / (p1 - p0 || 1))), [r, g, b] = lerpColor(c0, c1, f);
      this.put(row, i, r, g, b);
    }
    this.upload(); return row;
  }
  /** Registers a ramp from 256 RGB triples (768 bytes), e.g. a pack's native ramp. Returns its row. */
  addLut(id: string, rgb: Uint8Array): number {
    if (rgb.length !== SIZE * 3) throw Error('A ramp LUT is 256 RGB triples');
    const row = this.claim(id);
    for (let i = 0; i < SIZE; i++) this.put(row, i, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    this.upload(); return row;
  }
  /** Frees a row (a pack unloaded). Presets cannot be removed. */
  remove(id: string): void {
    const row = this.ids.get(id);
    if (row === undefined || RAMP_PRESETS.some(p => p.id === id)) return;
    this.ids.delete(id); this.used[row] = 0;
  }
  has(name: string): boolean { return this.ids.has(name) || this.ids.has(this.aliases.get(name) ?? ''); }
  /** Row of a ramp by id or alias (`'fire'`, `'hoa'`, a custom id). A registered id beats an alias of the same name. Throws for unknown names. */
  rowOf(name: string): number {
    const row = this.ids.get(name) ?? this.ids.get(this.aliases.get(name) ?? '');
    if (row === undefined) throw Error(`Unknown ramp: ${name}`);
    return row;
  }
  /** 0xRRGGBB of a row at `t` (0-1): what a plain sprite tint should be where the shader is unavailable. */
  colorAt(row: number, t: number): number {
    const i = (row * SIZE + Math.round(Math.max(0, Math.min(1, t)) * (SIZE - 1))) * 4, d = this.image.data;
    return d[i] << 16 | d[i + 1] << 8 | d[i + 2];
  }
  private claim(id: string): number {
    let row = this.ids.get(id);
    if (row === undefined) { row = this.used.indexOf(0); if (row < 0) throw Error(`Out of ramp rows (${ROWS})`); this.used[row] = 1; this.ids.set(id, row); }
    return row;
  }
  private put(row: number, i: number, r: number, g: number, b: number) {
    const o = (row * SIZE + i) * 4, d = this.image.data;
    d[o] = Math.round(r); d[o + 1] = Math.round(g); d[o + 2] = Math.round(b); d[o + 3] = 255;
  }
  private upload() { this.canvas.getContext('2d')!.putImageData(this.image, 0, 0); ((this.texture.source ?? (this.texture as any).baseTexture) as any)?.update?.(); }
  destroy() { this.texture.destroy(true); }
}
