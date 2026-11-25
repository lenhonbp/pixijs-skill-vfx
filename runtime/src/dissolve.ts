// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Procedural noise erosion for expiring ground decals: the decal is eaten away along a 64x64 wrapping noise texture, with a
// burning rim on the boundary, instead of fading out uniformly. Pixi 8 + WebGL only (see GroundDissolveFilter.supported).
import * as PIXI from 'pixi.js';
import type { Texture } from 'pixi.js';
import { v8 } from './compat.js';
import { repeat, sharedNoiseTexture } from './flow.js';

// Pixi 8's default filter vertex shader (it is not exported from the package).
const VERTEX = /* glsl */`
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

// The noise is sampled in screen pixels (not filter UVs, which change with the decal's bounds), so the erosion pattern stays
// put on the ground. The threshold runs from 0 to 1 + uEdgeWidth, so progress 0 keeps every pixel and 1 removes every pixel.
// Inputs are premultiplied: scaling the whole colour by alpha erodes it, and the rim adds light only where the decal has coverage.
const FRAGMENT = /* glsl */`
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uNoise;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
// x: progress, y: edge width, z: edge intensity, w: noise scale (one vec4, so the player can write progress into a typed array).
uniform vec4 uParams;
uniform vec3 uEdgeColor;
uniform vec2 uNoiseOffset;
void main(void) {
  float uProgress = uParams.x, uEdgeWidth = uParams.y, uEdgeIntensity = uParams.z, uNoiseScale = uParams.w;
  vec4 color = texture(uTexture, vTextureCoord);
  vec2 screen = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  float noiseVal = texture(uNoise, screen / uNoiseScale + uNoiseOffset).r;
  float threshold = uProgress * (1.0 + uEdgeWidth);
  float alpha = smoothstep(threshold - uEdgeWidth, threshold, noiseVal);
  float rim = alpha * (1.0 - smoothstep(threshold, threshold + uEdgeWidth, noiseVal)) * step(0.0001, uProgress);
  finalColor = color * alpha;
  finalColor.rgb += uEdgeColor * (uEdgeIntensity * rim * color.a);
}`;

export interface GroundDissolveOptions {
  /** Wrapping greyscale noise (red channel). Default: the 64x64 procedural texture FlowTrail also uses. */
  noise?: Texture;
  /** Width of the soft eroding band, in noise units 0-1. Default 0.12. */
  edgeWidth?: number;
  /** Colour of the burning rim. Default 0xff8a2a. */
  edgeColor?: number;
  /** Brightness of the rim added on top of the decal. Default 1.5. */
  edgeIntensity?: number;
  /** Screen pixels covered by one tile of the noise. Default 96. */
  noiseScale?: number;
}

/**
 * Erodes whatever it is applied to along a noise texture: `progress` 0 is untouched, 1 is fully gone, and the boundary glows
 * `edgeColor * edgeIntensity`. Pass the class as `PlayerOptions.groundDissolve.filter` and the player runs it on every pack's
 * ground layers as they expire, from a pool (one filter per dissolving play, reused). Setting properties writes uniforms in
 * place: nothing is allocated per frame.
 */
export class GroundDissolveFilter extends (PIXI.Filter as unknown as new (options: any) => PIXI.Filter) {
  private readonly u: any;
  /** The shader's `uParams`: progress (0-1), edge width, edge intensity, noise scale. Writing `params[0]` is `progress` without the clamp. */
  readonly params!: Float32Array;

  /** True when the renderer can run the shader: Pixi 8 on WebGL. Elsewhere ground layers keep their baked fade. */
  static supported(app: { renderer: { name?: string } }): boolean { return v8 && app.renderer.name === 'webgl'; }

  constructor(options: GroundDissolveOptions = {}) {
    if (!v8) throw Error('GroundDissolveFilter needs Pixi 8');
    const noise = options.noise ?? sharedNoiseTexture();
    repeat(noise);
    const glProgram = (PIXI as any).GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: 'lenhon-ground-dissolve' });
    super({
      glProgram,
      resources: {
        dissolve: {
          uParams: { value: new Float32Array([0, 0.12, 1.5, 96]), type: 'vec4<f32>' },
          uEdgeColor: { value: new Float32Array(3), type: 'vec3<f32>' }, uNoiseOffset: { value: new Float32Array(2), type: 'vec2<f32>' },
        },
        uNoise: noise.source,
      },
    });
    this.u = (this as any).resources.dissolve.uniforms;
    this.params = this.u.uParams;
    this.edgeWidth = options.edgeWidth ?? 0.12;
    this.edgeColor = options.edgeColor ?? 0xff8a2a;
    this.edgeIntensity = options.edgeIntensity ?? 1.5;
    this.noiseScale = options.noiseScale ?? 96;
  }
  /** Erosion, 0 (untouched) to 1 (gone). */
  get progress(): number { return this.params[0]; }
  set progress(value: number) { this.params[0] = value < 0 ? 0 : value > 1 ? 1 : value; }
  get edgeWidth(): number { return this.params[1]; }
  set edgeWidth(value: number) { this.params[1] = Math.max(1e-3, Math.min(1, value)); }
  get edgeIntensity(): number { return this.params[2]; }
  set edgeIntensity(value: number) { this.params[2] = Math.max(0, value); }
  get noiseScale(): number { return this.params[3]; }
  set noiseScale(value: number) { this.params[3] = Math.max(1, value); }
  set edgeColor(value: number) { const c = this.u.uEdgeColor; c[0] = (value >> 16 & 255) / 255; c[1] = (value >> 8 & 255) / 255; c[2] = (value & 255) / 255; }
  /** Shifts the noise so decals that dissolve side by side do not erode in the same pattern. Any number; only its fraction matters. */
  seed(value: number): void { const o = this.u.uNoiseOffset; o[0] = value * 0.618034 % 1; o[1] = value * 0.414214 % 1; }
}
