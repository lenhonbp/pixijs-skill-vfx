// Screen-space post effects, the way engines do them, on stock PixiJS v7/v8 filters:
// - Distortion: effects draw "displacement sprites" into an offscreen buffer that a single
//   DisplacementFilter reads (shockwave refraction, heat haze, portal warps). The filter is
//   only attached while something is distorting, so it costs nothing when idle.
// - Bloom: the scene is rendered at reduced resolution, a colour matrix keeps only the bright
//   pixels, a blur spreads them, and the result is added on top. Glows look hot, not flat.
// Both attach to a world with `w.use(...)`, update with it and reset on `w.clear()`.
import * as PIXI from 'pixi.js';
import type { Container, Texture } from 'pixi.js';
import { isPixiV8, renderToTexture, textureFromCanvas } from './pixi-compat';
import { random, clamp01, outCubic } from './ease';
import type { VfxWorld, WorldPlugin } from './vfx-world';

const V8 = isPixiV8();


const filtersSupported = (r: any) => !!(r?.gl || r?.gpu);

function makeRT(width: number, height: number, resolution: number) {
  return (PIXI as any).RenderTexture.create({ width, height, resolution });
}

/** Displacement map textures: RGB encodes the push direction around 128 grey, alpha the strength. */
function vectorTexture(size: number, f: (dx: number, dy: number, r: number) => [number, number, number]): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
      const [vx, vy, a] = f(dx, dy, Math.hypot(dx, dy));
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(128 + 127 * Math.max(-1, Math.min(1, vx)));
      img.data[i + 1] = Math.round(128 + 127 * Math.max(-1, Math.min(1, vy)));
      img.data[i + 2] = 128;
      img.data[i + 3] = Math.round(255 * clamp01(a));
    }
  }
  ctx.putImageData(img, 0, 0);
  return textureFromCanvas(c);
}

export interface DistortionOptions {
  renderer: any;
  /** Container that gets distorted (usually your camera/world container, not the UI). */
  target: Container;
  width: number;
  height: number;
  /** Max displacement in px at full strength. */
  scale?: number;
  /** Buffer resolution (0.5 = half-res, plenty for refraction). */
  resolution?: number;
}

/** Offscreen displacement buffer + one DisplacementFilter on `target`. */
export class Distortion implements WorldPlugin {
  enabled = true;
  /** False on renderers without filter support (Canvas fallback): the pass is skipped. */
  readonly supported: boolean;
  readonly sources: Container;
  private rt: any;
  private filter: any;
  private ringTex: Texture;
  private hazeTex: Texture;
  private active: { s: any; age: number; life: number; step: (s: any, t: number, dt: number) => void }[] = [];
  private attached = false;

  constructor(private o: DistortionOptions) {
    this.supported = filtersSupported(o.renderer);
    this.rt = makeRT(o.width, o.height, o.resolution ?? 0.5);
    this.sources = new (PIXI as any).Container();
    const bg = new (PIXI as any).Sprite((PIXI as any).Texture.WHITE);
    bg.tint = 0x808080;
    bg.width = o.width;
    bg.height = o.height;
    this.sources.addChild(bg);
    // Not added to the stage: its identity transform maps the buffer 1:1 onto the screen.
    const map = new (PIXI as any).Sprite(this.rt);
    const scale = o.scale ?? 28;
    this.filter = V8 ? new (PIXI as any).DisplacementFilter({ sprite: map, scale }) : new (PIXI as any).DisplacementFilter(map, scale);
    // Outward push on a soft ring: refraction at a shockwave's front.
    this.ringTex = vectorTexture(128, (dx, dy, r) => {
      const band = Math.exp(-Math.pow((r - 0.78) / 0.12, 2));
      return r > 0 ? [dx / r, dy / r, band] : [0, 0, 0];
    });
    // Swirly noise vectors: shimmer for heat haze and wind.
    this.hazeTex = vectorTexture(64, (dx, dy, r) => {
      const a = Math.sin(dx * 9.1 + Math.cos(dy * 7.3) * 2) * 0.8;
      return [Math.cos(a * 3 + dy * 5), Math.sin(a * 3 + dx * 5), Math.pow(clamp01(1 - r), 1.5)];
    });
  }

  /** Expanding refraction ring on the ground (ellipse squashed like the ground plane). */
  shockwave(w: VfxWorld, x: number, y: number, radius: number, o: { duration?: number; strength?: number } = {}) {
    const s = new (PIXI as any).Sprite(this.ringTex);
    s.anchor.set(0.5);
    s.position.set(x, y);
    const k = o.strength ?? 1;
    this.add(s, o.duration ?? 520, (sp, t) => {
      const r = radius * (0.15 + 0.85 * outCubic(t)) / 50;
      sp.scale.set(r, r * w.groundSquash);
      sp.alpha = k * (1 - t);
    });
  }

  /** Shimmering heat/wind haze around a point that follows `at` (screen-space x, y). */
  haze(at: () => { x: number; y: number }, o: { radius?: number; duration?: number; strength?: number; rise?: number } = {}) {
    const radius = o.radius ?? 60;
    const k = o.strength ?? 0.7;
    const rise = o.rise ?? 40;
    for (let i = 0; i < 3; i++) {
      const s = new (PIXI as any).Sprite(this.hazeTex);
      s.anchor.set(0.5);
      const ph = random() * 6.28;
      this.add(s, o.duration ?? 900, (sp, t, age) => {
        const p = at();
        sp.position.set(p.x + Math.sin(age / 180 + ph) * radius * 0.2, p.y - rise * ((t * 3 + i / 3) % 1));
        sp.scale.set((radius / 32) * (0.8 + 0.2 * Math.sin(age / 90 + ph)));
        sp.rotation = age / 400 + ph;
        sp.alpha = k * Math.sin(Math.PI * t) * 0.8;
      });
    }
  }

  /** Add your own displacement sprite (vector texture); `step` animates it, t in 0..1. */
  add(s: any, life: number, step: (s: any, t: number, ageMs: number) => void) {
    this.sources.addChild(s);
    this.active.push({ s, age: 0, life, step });
  }

  update(dt: number) {
    for (const a of this.active) {
      a.age += dt;
      a.step(a.s, Math.min(1, a.age / a.life), a.age);
    }
    for (const a of this.active) if (a.age >= a.life) a.s.destroy();
    this.active = this.active.filter((a) => a.age < a.life);
    const on = this.enabled && this.supported && this.active.length > 0;
    if (on) renderToTexture(this.o.renderer, this.sources, this.rt);
    if (on !== this.attached) {
      const t = this.o.target as any;
      const rest = (t.filters ?? []).filter((f: any) => f !== this.filter);
      t.filters = on ? [...rest, this.filter] : rest.length ? rest : null;
      this.attached = on;
    }
  }

  clear() {
    for (const a of this.active) a.s.destroy();
    this.active = [];
    this.update(0);
  }

  get count() {
    return this.active.length;
  }
}

export interface BloomOptions {
  renderer: any;
  /** What to bloom (usually the camera/world container). */
  source: Container;
  /** Where to add the bloom sprite (a container above `source`, e.g. app.stage). */
  parent: Container;
  width: number;
  height: number;
  /** 0..1: brightness below this does not bloom. */
  threshold?: number;
  /** Bloom brightness multiplier. */
  intensity?: number;
  /** Blur radius in px. */
  blur?: number;
  /** Buffer resolution (0.25-0.5). */
  resolution?: number;
  /** Skip the pass while this returns false (e.g. `() => vfx.count > 0`). */
  active?: () => boolean;
}

/** Bright-pass + blur + additive composite. */
export class Bloom implements WorldPlugin {
  enabled = true;
  /** False on renderers without filter support (Canvas fallback): the pass is skipped. */
  readonly supported: boolean;
  readonly sprite: any;
  private rt: any;
  constructor(private o: BloomOptions) {
    this.supported = filtersSupported(o.renderer);
    const res = o.resolution ?? 0.35;
    this.rt = makeRT(o.width, o.height, res);
    this.sprite = new (PIXI as any).Sprite(this.rt);
    this.sprite.blendMode = V8 ? 'add' : 1;
    const th = o.threshold ?? 0.55;
    const gain = (o.intensity ?? 1) / Math.max(0.05, 1 - th);
    const cm = new (PIXI as any).ColorMatrixFilter();
    // out = (in - threshold) * gain, per channel: only highlights survive.
    cm.matrix = [gain, 0, 0, 0, -th * gain, 0, gain, 0, 0, -th * gain, 0, 0, gain, 0, -th * gain, 0, 0, 0, 1, 0];
    const strength = o.blur ?? 10;
    const blur = V8 ? new (PIXI as any).BlurFilter({ strength, quality: 2 }) : new (PIXI as any).BlurFilter(strength, 2);
    // Filtered output composites with the last filter's blend mode, so that one must be additive.
    blur.blendMode = V8 ? 'add' : 1;
    // The filters only see a blurry low-res buffer, so run them at that resolution too.
    cm.resolution = blur.resolution = res;
    this.sprite.filters = [cm, blur];
    o.parent.addChild(this.sprite);
  }

  update() {
    const on = this.enabled && this.supported && (this.o.active?.() ?? true);
    this.sprite.visible = on;
    if (!on) return;
    const s = this.o.source as any;
    // Render the source untransformed into the buffer and line the sprite up with it.
    renderToTexture(this.o.renderer, s, this.rt);
  }

  clear() {
    this.sprite.visible = false;
  }
}
