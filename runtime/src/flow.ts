// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Flowmap ribbons: high-velocity energy, flame and wind trails from ONE small energy texture and ONE 64x64 wrapping noise
// texture, animated on the GPU instead of baked into dozens of frames. Pixi 8 + WebGL only (see FlowTrail.supported).
import { Mesh, Point, RopeGeometry, Shader, Texture } from 'pixi.js';
import { v8 } from './compat.js';

const VERTEX = /* glsl */`
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

// vUV.x runs head (0) to tail (1), vUV.y across the ribbon. The noise is sampled twice at a scrolling offset: once to warp the
// energy texture's UVs (organic turbulence) and once as the dissolve mask that eats the ribbon from its tail.
const FRAGMENT = /* glsl */`
precision highp float;
in vec2 vUV;
uniform sampler2D uTexture;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uSpeed;
uniform float uStretch;
uniform float uTurbulence;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uDissolve;
uniform float uEdge;
uniform float uTail;
uniform float uRim;
uniform float uAlpha;
uniform vec3 uTint;
void main() {
  vec2 nuv = vec2(vUV.x * uNoiseScale - uTime * uNoiseSpeed, vUV.y * uNoiseScale * 0.5 + uTime * uNoiseSpeed * 0.37);
  float n = texture(uNoise, nuv).r;
  float n2 = texture(uNoise, nuv + vec2(0.37, 0.61)).r;
  // Turbulence grows away from the head, so the ribbon stays attached to what it follows.
  vec2 warp = (vec2(n, n2) - 0.5) * uTurbulence * (0.25 + vUV.x);
  vec2 uv = vec2(vUV.x * uStretch - uTime * uSpeed, vUV.y) + warp;
  vec4 energy = texture(uTexture, uv);
  float cut = (uDissolve * (1.0 + uTail * vUV.x)) * (1.0 + uEdge) - uEdge;
  float keep = smoothstep(cut, cut + uEdge, n);
  float rim = keep * (1.0 - smoothstep(cut + uEdge, cut + uEdge * 2.5, n));
  vec4 color = energy * keep;
  color.rgb = color.rgb * uTint + energy.a * rim * uRim;
  gl_FragColor = color * uAlpha;
}`;

/** Mulberry32, so the shipped noise is the same on every device. */
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ a >>> 15, a | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/**
 * A seamlessly tileable greyscale value-noise texture (default 64x64: 16 KB of GPU memory). Two octaves of smooth lattice
 * noise whose lattice wraps, so UVs can scroll forever without a seam. Set `source.style` to repeat addressing.
 */
export function makeNoiseTexture(seed = 1, size = 64): Texture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size), random = rng(seed);
  const lattice = (cells: number) => Float32Array.from({ length: cells * cells }, random);
  const octaves = [{ cells: 4, grid: lattice(4), weight: 0.65 }, { cells: 8, grid: lattice(8), weight: 0.35 }];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let value = 0;
    for (const { cells, grid, weight } of octaves) {
      const fx = x / size * cells, fy = y / size * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
      const at = (i: number, j: number) => grid[(j % cells) * cells + (i % cells)];
      value += weight * ((at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty);
    }
    const v = Math.round(value * 255), i = (y * size + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  repeat(texture);
  return texture;
}
/** @internal Switches a texture to repeat addressing, so its UVs can scroll forever. */
export function repeat(texture: Texture) { const style = (texture.source as any)?.style; if (style) style.addressMode = 'repeat'; }
let sharedNoise: Texture | null = null;
/** @internal The one procedural noise texture FlowTrail and GroundDissolveFilter share when given none. */
export function sharedNoiseTexture(): Texture { return sharedNoise ??= makeNoiseTexture(); }

export interface FlowTrailOptions {
  /** Energy texture: stretches along the ribbon (x) and across it (y). Should tile in x (it scrolls). */
  texture: Texture;
  /** 64x64 wrapping noise. Default: one shared procedural texture. */
  noise?: Texture;
  /** Ribbon width in px. Default 40. */
  width?: number;
  /** History points, i.e. ribbon smoothness and length in samples. Default 24. */
  points?: number;
  /** Energy scroll along the ribbon, texture widths per second. Default 1.6. */
  speed?: number;
  /** Texture repeats along the ribbon. Default 1.5. */
  stretch?: number;
  /** UV warp by noise, 0-1. Default 0.25. */
  turbulence?: number;
  /** Noise tiles along the ribbon. Default 1.5. */
  noiseScale?: number;
  /** Noise scroll speed. Default 0.6. */
  noiseSpeed?: number;
  /** Softness of the dissolving edge, 0-1. Default 0.12. */
  edge?: number;
  /** How much later the tail dissolves than the head, 0-2. Default 0.7. */
  tail?: number;
  /** Extra brightness on the dissolving rim. Default 0.6. */
  rim?: number;
  /** Colour multiplier. Default white. */
  tint?: number;
  blend?: 'add' | 'normal';
}

/**
 * A trail you feed with positions (`push`) and tick (`update`). One quad strip, one draw call, no per-frame allocation:
 * positions are written into a preallocated Float32Array and the only uniforms touched are two floats.
 * `dissolve` 0 (fully formed) to 1 (gone) eats the ribbon from its tail along the noise; animate it for organic dissipation.
 */
export class FlowTrail {
  readonly mesh: Mesh;
  /** History, head first. Mutate in place or use `push`. */
  readonly points: Point[];
  alpha = 1;
  private geometry: any;
  private uniforms: any;
  private time = 0;
  private dissolveValue = 0;

  /** True when the renderer can run the shader: Pixi 8 on WebGL. Check it and fall back to a baked pack otherwise. */
  static supported(app: { renderer: { name?: string } }): boolean { return v8 && app.renderer.name === 'webgl'; }

  constructor(options: FlowTrailOptions) {
    if (!v8) throw Error('FlowTrail needs Pixi 8');
    const { texture } = options, noise = options.noise ?? sharedNoiseTexture();
    repeat(texture); repeat(noise);
    this.points = Array.from({ length: Math.max(2, options.points ?? 24) }, () => new Point());
    this.geometry = new RopeGeometry({ width: options.width ?? 40, points: this.points, textureScale: 0 });
    const tint = options.tint ?? 0xffffff;
    const shader = (Shader as any).from({
      gl: { vertex: VERTEX, fragment: FRAGMENT },
      resources: {
        uTexture: texture.source, uSampler: (texture.source as any).style, uNoise: noise.source, uNoiseSampler: (noise.source as any).style,
        flow: {
          uTime: { value: 0, type: 'f32' }, uSpeed: { value: options.speed ?? 1.6, type: 'f32' }, uStretch: { value: options.stretch ?? 1.5, type: 'f32' },
          uTurbulence: { value: options.turbulence ?? 0.25, type: 'f32' }, uNoiseScale: { value: options.noiseScale ?? 1.5, type: 'f32' },
          uNoiseSpeed: { value: options.noiseSpeed ?? 0.6, type: 'f32' }, uDissolve: { value: 0, type: 'f32' }, uEdge: { value: options.edge ?? 0.12, type: 'f32' },
          uTail: { value: options.tail ?? 0.7, type: 'f32' }, uRim: { value: options.rim ?? 0.6, type: 'f32' }, uAlpha: { value: 1, type: 'f32' },
          uTint: { value: new Float32Array([(tint >> 16 & 255) / 255, (tint >> 8 & 255) / 255, (tint & 255) / 255]), type: 'vec3<f32>' },
        },
      },
    });
    this.uniforms = shader.resources.flow.uniforms;
    this.mesh = new Mesh({ geometry: this.geometry, shader });
    this.mesh.blendMode = (options.blend === 'normal' ? 'normal' : 'add') as any;
  }
  /** 0 = fully formed, 1 = fully dissolved. */
  get dissolve(): number { return this.dissolveValue; }
  set dissolve(value: number) { this.dissolveValue = Math.max(0, Math.min(1, value)); }
  /** Puts every history point at (x, y): a trail that starts here. */
  reset(x: number, y: number): void { for (let i = 0; i < this.points.length; i++) this.points[i].set(x, y); }
  /** New head position; the history shifts one step towards the tail. */
  push(x: number, y: number): void {
    const p = this.points;
    for (let i = p.length - 1; i > 0; i--) p[i].set(p[i - 1].x, p[i - 1].y);
    p[0].set(x, y);
  }
  /** Advances the animation clock and uploads the current positions. */
  update(dtMs: number): void {
    this.time += dtMs / 1000;
    const u = this.uniforms;
    u.uTime = this.time; u.uDissolve = this.dissolveValue; u.uAlpha = this.alpha;
    this.geometry.updateVertices();
  }
  destroy(): void { this.mesh.destroy(); this.geometry.destroy?.(); }
}
