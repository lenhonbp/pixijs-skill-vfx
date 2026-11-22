// Ribbon trails: a textured triangle strip (Pixi MeshRope / SimpleRope) that follows a moving
// point. Use for blades, dashes, wind and projectiles: smooth continuous streaks that
// particle trails cannot match, at the cost of one mesh per ribbon.
import * as PIXI from 'pixi.js';
import type { Texture } from 'pixi.js';
import { blend, isPixiV8, BlendName, textureFromCanvas } from './pixi-compat';
import type { Handle, Vec3, VfxWorld } from './vfx-world';

export interface RibbonOptions {
  /** Point to follow every frame (ground x, y, height z). */
  target: () => Vec3;
  /** Texture mapped along the ribbon, tail on the left, head on the right. Default: ribbonTexture(width). */
  texture?: Texture;
  /** Ribbon thickness in px at the head (a rope is as thick as its texture is tall). */
  width?: number;
  /** Number of history points; length on screen = segments x distance moved per frame. */
  segments?: number;
  tint?: number;
  blend?: BlendName;
  alpha?: number;
  /** Total lifetime in ms; the ribbon fades over the last `fadeMs`. Infinity = until stop(). */
  life?: number;
  fadeMs?: number;
  /** Sort with characters like body particles (zIndex = y + zBias). */
  zBias?: number;
  layer?: 'body' | 'top';
}

const V8 = isPixiV8();

type RopeMesh = PIXI.Container & { geometry: { destroy(destroyBuffers?: boolean): void } };

function makeRope(texture: Texture, points: PIXI.Point[]): RopeMesh {
  // Looked up by name: each class only exists in one major version.
  const Rope = (PIXI as Record<string, any>)[V8 ? 'MeshRope' : 'SimpleRope'];
  return V8 ? new Rope({ texture, points, textureScale: 0 }) : new Rope(texture, points, 0);
}

function destroyRope(rope: RopeMesh) {
  if (rope.destroyed) return;
  // v8 Mesh does not dispose its geometry; v7 Mesh releases the geometry it owns.
  const geometry = rope.geometry;
  rope.destroy();
  if (V8) geometry.destroy(true);
}

export interface RibbonHandle extends Handle {
  readonly rope: PIXI.Container;
}

/** A tapered ribbon on a moving curve. Samples are in ground coordinates and height. */
export function flowRibbon(w: VfxWorld, o: {
  point: (u: number, age: number, out: Vec3) => void;
  alpha: (age: number) => number;
  life: number;
  width: number;
  tint: number;
  blend?: BlendName;
  layer?: 'ground' | 'body';
}): Handle {
  const segments = 10;
  const points = Array.from({ length: segments + 1 }, () => new PIXI.Point());
  const rope = makeRope(makeRibbonTexture(o.width, true), points);
  (rope as any).tint = o.tint;
  (rope as any).blendMode = blend(o.blend ?? 'add');
  const layer = o.layer ?? 'body';
  const at: Vec3 = { x: 0, y: 0, z: 0 };
  let age = 0;
  const place = () => {
    rope.alpha = o.alpha(age);
    rope.visible = rope.alpha > 0;
    if (!rope.visible) return;
    for (let i = 0; i <= segments; i++) {
      o.point(i / segments, age, at);
      points[i].set(at.x, at.y - (at.z ?? 0));
      if (layer === 'body' && i === segments / 2) rope.zIndex = at.y;
    }
  };
  place();
  w.layers[layer].addChild(rope);
  const dispose = () => {
    unown();
    destroyRope(rope);
  };
  const unown = w.own(dispose);
  const update = w.addUpdater((dt) => {
    age += dt;
    if (age >= o.life) { dispose(); return false; }
    place();
  });
  return {
    stop() { update.stop(); dispose(); },
    get alive() { return update.alive && !rope.destroyed; },
  };
}

/** A ribbon that trails behind `target`. Stopping it lets the tail catch up, then removes it. */
export function ribbonTrail(w: VfxWorld, o: RibbonOptions): RibbonHandle {
  const n = Math.max(4, o.segments ?? 18);
  const start = o.target();
  const pts = Array.from({ length: n }, () => new PIXI.Point(start.x, start.y - (start.z ?? 0)));
  const rope = makeRope(o.texture ?? ribbonTexture(o.width ?? 16), pts);
  (rope as any).tint = o.tint ?? 0xffffff;
  (rope as any).blendMode = blend(o.blend ?? 'add');
  rope.alpha = o.alpha ?? 1;
  const layer = w.layers[o.layer ?? 'body'];
  layer.addChild(rope);
  const life = o.life ?? Infinity;
  const fadeMs = o.fadeMs ?? 160;
  let age = 0;
  let stopping = false;
  let left = 0;
  const done = () => {
    unown();
    destroyRope(rope);
  };
  const unown = w.own(done);
  const u = w.addUpdater((dt) => {
    if (rope.destroyed) return false;
    age += dt;
    const head = o.target();
    for (let i = 0; i < n - 1; i++) pts[i].copyFrom(pts[i + 1]);
    if (!stopping) pts[n - 1].set(head.x, head.y - (head.z ?? 0));
    if (o.layer !== 'top') rope.zIndex = (head.y ?? 0) + (o.zBias ?? 0);
    const base = o.alpha ?? 1;
    if (stopping) {
      left -= dt;
      rope.alpha = base * Math.max(0, left / fadeMs);
      if (left <= 0) { done(); return false; }
    } else if (age > life - fadeMs) {
      rope.alpha = base * Math.max(0, (life - age) / fadeMs);
      if (age >= life) { done(); return false; }
    }
  });
  return {
    rope,
    stop() {
      if (!stopping && u.alive) { stopping = true; left = fadeMs; }
    },
    get alive() {
      return u.alive && !rope.destroyed;
    },
  };
}

const ribbonCache = new Map<number, Texture>();
const flowCache = new Map<number, Texture>();

/**
 * White ribbon texture `width` px tall, cached per width: transparent tail on the left, tapering
 * to a bright full-width head on the right, with a hot centre line. Tint colours it.
 */
export function ribbonTexture(width = 16): Texture {
  return makeRibbonTexture(width, false);
}

function makeRibbonTexture(width: number, flow: boolean): Texture {
  const h = Math.max(4, Math.round(width));
  const cache = flow ? flowCache : ribbonCache;
  const hit = cache.get(h);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(128, h);
  for (let x = 0; x < 128; x++) {
    const u = x / 127;
    const taper = Math.pow(Math.sin(u * Math.PI), 0.7);
    const half = flow ? 0.5 * (0.22 + 0.78 * taper) : (0.15 + 0.85 * Math.pow(u, 0.7)) * 0.5;
    const a = flow ? taper : Math.pow(u, 1.6) * (u > 0.97 ? (1 - u) / 0.03 : 1);
    for (let y = 0; y < h; y++) {
      const d = Math.abs((y + 0.5) / h - 0.5);
      const edge = Math.max(0, 1 - d / half);
      const v = a * Math.pow(edge, 0.8) * (0.55 + 0.45 * Math.pow(edge, 4));
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * Math.min(1, v));
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = textureFromCanvas(c);
  cache.set(h, t);
  return t;
}
