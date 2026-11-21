// Tiny 2.5D VFX runtime: pooled sprites, curves over lifetime, z-height with
// gravity, ground-plane projection, streams, timers, hit-stop and screen shake.
//
// Coordinates: (x, y) is the point on the GROUND in screen pixels (what most
// 2.5D Pixi games already use for y-sorting); z is height above the ground in
// pixels. Screen position = (x, y - z). Body-layer sprites get zIndex = y + zBias
// so effects sort with characters.
import { Container, Sprite, Texture } from 'pixi.js';
import { blend, BlendName } from './pixi-compat';
import { Ease, clamp01, lerp, lerpColor, linear } from './ease';

export type Curve =
  | number
  | readonly [number, number]
  | readonly [number, number, Ease]
  | ((t: number) => number);

export type LayerName = 'ground' | 'body' | 'top';

export interface Vec3 {
  x: number;
  y: number;
  z?: number;
}

export interface SpawnOptions {
  texture: Texture;
  /** 'ground' = decals under everything, 'body' = y-sorted with characters (default), 'top' = over everything. */
  layer?: LayerName;
  x: number;
  y: number;
  z?: number;
  /** Velocities in px/s. vz > 0 moves up. */
  vx?: number;
  vy?: number;
  vz?: number;
  ax?: number;
  ay?: number;
  /** Pulls z down, px/s^2. */
  gravity?: number;
  /** Exponential velocity damping per second (3 = loses ~95% of speed in 1s). */
  drag?: number;
  /** Lifetime in ms. Infinity = lives until kill(). */
  life: number;
  /** Delay before the particle appears, ms. */
  delay?: number;
  alpha?: Curve;
  scale?: Curve;
  scaleX?: Curve;
  scaleY?: Curve;
  rotation?: number;
  /** rad/s */
  spin?: number;
  /** Color multiplier; a number, [from, to] or (t) => color. Textures are white so this is the color. */
  tint?: number | readonly [number, number] | readonly [number, number, Ease] | ((t: number) => number);
  blend?: BlendName;
  anchorX?: number;
  anchorY?: number;
  /** Lay the sprite flat on the ground plane (rotation happens on the ground, then Y is squashed). */
  groundAligned?: boolean;
  /** Rotate to face screen-space velocity. */
  faceVelocity?: boolean;
  /** Extra scaleX per px/s of speed (motion stretch). 0.002 is a good start. */
  stretch?: number;
  /** Die when z goes below 0 (unless bounce > 0). */
  killOnGround?: boolean;
  /** 0..1 restitution when hitting the ground. */
  bounce?: number;
  zBias?: number;
  /** Attach to a moving point; velocities then become an offset from it. */
  follow?: () => Vec3;
  onUpdate?: (p: Particle, t: number, dtSec: number) => void;
  onDeath?: (p: Particle) => void;
}

export interface Handle {
  stop(): void;
  readonly alive: boolean;
}

function evalCurve(c: Curve | undefined, t: number, fallback: number): number {
  if (c === undefined) return fallback;
  if (typeof c === 'number') return c;
  if (typeof c === 'function') return c(t);
  const ease = (c as readonly [number, number, Ease])[2] ?? linear;
  return lerp(c[0], c[1], ease(t));
}

function evalTint(c: SpawnOptions['tint'], t: number): number {
  if (c === undefined) return 0xffffff;
  if (typeof c === 'number') return c;
  if (typeof c === 'function') return c(t);
  const ease = (c as readonly [number, number, Ease])[2] ?? linear;
  return lerpColor(c[0], c[1], ease(t));
}

export class Particle {
  sprite!: Sprite;
  o!: SpawnOptions;
  age = 0;
  dead = false;
  /** Offset from the origin / follow point. */
  px = 0;
  py = 0;
  pz = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  rotation = 0;
  /** Free slot for recipe state. */
  data: any = undefined;
  /** Extra alpha multiplier an onUpdate can set (e.g. fade the back side of an orbit). */
  alphaMul = 1;
  /** Current world position (ground x, ground y, height z). */
  x = 0;
  y = 0;
  z = 0;

  kill() {
    this.dead = true;
  }
}

export interface VfxWorldOptions {
  ground: Container;
  body: Container;
  top: Container;
  /** Container to shake. Shake is applied as a delta, so your own camera movement still works. */
  camera?: Container;
  /** Y squash for circles on the ground: 0.5 for 2:1 isometric, ~0.6-0.75 for typical 2.5D. */
  groundSquash?: number;
  /**
   * Where shadows of airborne effects land, as ground offset (screen px) per px of height z.
   * Match the baked sun of pre-rendered sprites: rigFromBlender(...).shadow. Default: straight down.
   */
  shadow?: { x: number; y: number };
  maxParticles?: number;
}

/** Something that updates and resets with the world (post effects, custom systems). */
export interface WorldPlugin {
  /** Called every frame with scaled VFX dt (also during hit-stop with dt = 0). */
  update(dtMs: number): void;
  clear(): void;
}

export class VfxWorld {
  readonly layers: Record<LayerName, Container>;
  /** VFX clock in ms (scaled by timeScale, paused by hit-stop). */
  now = 0;
  groundSquash: number;
  shadow: { x: number; y: number };
  maxParticles: number;
  camera?: Container;
  /** Multiplies dt for VFX (slow-mo). */
  timeScale = 1;
  /** VFX clock in ms (stops during hit-stop). */
  time = 0;
  /**
   * Particle density multiplier for quality tiers (1 = high, ~0.6 medium, ~0.35 low).
   * Scales burst() counts and stream() rates; recipes stay readable at every tier.
   */
  density = 1;
  private plugins: WorldPlugin[] = [];
  private disposers = new Set<() => void>();

  private particles: Particle[] = [];
  private pool: Sprite[] = [];
  private particlePool: Particle[] = [];
  private updaters: { fn: (dtMs: number) => boolean | void; alive: boolean }[] = [];
  private freezeMs = 0;
  private shakeAmp = 0;
  private shakeDur = 0;
  private shakeAge = 0;
  private shakeX = 0;
  private shakeY = 0;

  constructor(opts: VfxWorldOptions) {
    this.layers = { ground: opts.ground, body: opts.body, top: opts.top };
    this.camera = opts.camera;
    this.groundSquash = opts.groundSquash ?? 0.6;
    this.maxParticles = opts.maxParticles ?? 1500;
    this.shadow = opts.shadow ?? { x: 0, y: 0 };
  }

  /** Ground point where the shadow of something at `p` falls (uses `shadow`). */
  shadowPoint(p: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
    const z = Math.max(0, p.z ?? 0);
    out.x = p.x + this.shadow.x * z;
    out.y = p.y + this.shadow.y * z;
    out.z = 0;
    return out;
  }

  /** Creates ground/body/top containers under `parent` (body is y-sorted). Put your characters in `body`. */
  static createLayers(parent: Container) {
    const ground = new Container();
    const body = new Container();
    body.sortableChildren = true;
    const top = new Container();
    parent.addChild(ground, body, top);
    return { ground, body, top };
  }

  get count() {
    return this.particles.length;
  }

  /** True during hit-stop. Freeze your character animations while this is true. */
  get frozen() {
    return this.freezeMs > 0;
  }

  spawn(o: SpawnOptions): Particle | null {
    if (this.particles.length >= this.maxParticles) return null;
    const p = this.particlePool.pop() ?? new Particle();
    const s = this.pool.pop() ?? new Sprite(o.texture);
    s.texture = o.texture;
    s.anchor.set(o.anchorX ?? 0.5, o.anchorY ?? 0.5);
    s.blendMode = blend(o.blend ?? 'add');
    s.skew.set(0, 0);
    s.rotation = 0;
    s.visible = false;
    s.alpha = 1;
    s.tint = 0xffffff;
    this.layers[o.layer ?? 'body'].addChild(s);
    p.sprite = s;
    p.o = o;
    p.age = -(o.delay ?? 0);
    p.dead = false;
    p.px = p.py = p.pz = 0;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.rotation = o.rotation ?? 0;
    p.data = undefined;
    p.alphaMul = 1;
    this.particles.push(p);
    this.place(p, 0);
    return p;
  }

  /** Spawn n particles; `make(i, n)` returns the options for each. */
  burst(n: number, make: (i: number, n: number) => SpawnOptions): Particle[] {
    const out: Particle[] = [];
    if (this.density !== 1 && n > 1) n = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < n; i++) {
      const p = this.spawn(make(i, n));
      if (p) out.push(p);
    }
    return out;
  }

  /** Emit `rate` particles per second for `duration` ms (Infinity until stop()). */
  stream(opts: { rate: number; duration?: number; make: (i: number) => SpawnOptions | null }): Handle {
    let acc = 0;
    let elapsed = 0;
    let i = 0;
    const duration = opts.duration ?? Infinity;
    return this.addUpdater((dt) => {
      elapsed += dt;
      if (elapsed > duration) return false;
      acc += (opts.rate * this.density * dt) / 1000;
      while (acc >= 1) {
        acc -= 1;
        const o = opts.make(i++);
        if (o) this.spawn(o);
      }
    });
  }

  /** Run `fn(dtMs)` every VFX frame until it returns false or the handle is stopped. */
  addUpdater(fn: (dtMs: number) => boolean | void): Handle {
    const u = { fn, alive: true };
    this.updaters.push(u);
    return {
      stop: () => {
        u.alive = false;
      },
      get alive() {
        return u.alive;
      },
    };
  }

  /** Call fn after `ms` of VFX time (respects hit-stop and timeScale). */
  after(ms: number, fn: () => void): Handle {
    let left = ms;
    return this.addUpdater((dt) => {
      left -= dt;
      if (left <= 0) {
        fn();
        return false;
      }
    });
  }

  /** Freeze VFX time for `ms` (impact feel). Check `frozen` to pause gameplay animations too. */
  hitStop(ms: number) {
    this.freezeMs = Math.max(this.freezeMs, ms);
  }

  /** Screen shake on `camera`, amplitude in px, decays over `ms`. */
  shake(amplitude: number, ms: number) {
    if (amplitude >= this.shakeAmp * (1 - this.shakeAge / Math.max(1, this.shakeDur))) {
      this.shakeAmp = amplitude;
      this.shakeDur = ms;
      this.shakeAge = 0;
    }
  }

  /** Call every frame with real elapsed ms, e.g. `app.ticker.add(() => vfx.update(app.ticker.deltaMS))`. */
  update(realDtMs: number) {
    const dtReal = Math.min(realDtMs, 50);
    this.updateShake(dtReal);
    if (this.freezeMs > 0) {
      this.freezeMs -= dtReal;
      for (const pl of this.plugins) pl.update(0);
      return;
    }
    const dt = dtReal * this.timeScale;
    this.now += dt;
    this.time += dt;

    for (let i = 0; i < this.updaters.length; i++) {
      const u = this.updaters[i];
      if (u.alive && u.fn(dt) === false) u.alive = false;
    }
    this.updaters = this.updaters.filter((u) => u.alive);

    const ps = this.particles;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p.dead) this.step(p, dt);
      if (p.dead) this.release(p);
      else ps[w++] = p;
    }
    ps.length = w;
    for (const pl of this.plugins) pl.update(dt);
  }

  /** Attach a plugin (Distortion, Bloom, your own system); returns it for chaining. */
  use<T extends WorldPlugin>(plugin: T): T {
    this.plugins.push(plugin);
    return plugin;
  }

  /** First attached plugin of a class, e.g. `w.plugin(Distortion)?.shockwave(...)`. */
  plugin<T extends WorldPlugin>(cls: abstract new (...a: any[]) => T): T | undefined {
    return this.plugins.find((p) => p instanceof cls) as T | undefined;
  }

  /** Remove every particle, updater and shake. */
  /** Re-applies plugin settings without advancing time (e.g. a toggle while the game is paused). */
  refreshPlugins() {
    for (const pl of this.plugins) pl.update(0);
  }

  /**
   * Registers cleanup for a non-particle display object (rope, mesh, sprite) so `clear()` removes
   * it too. Call the returned function when the object goes away on its own.
   */
  own(dispose: () => void): () => void {
    this.disposers.add(dispose);
    return () => this.disposers.delete(dispose);
  }

  clear() {
    for (const d of [...this.disposers]) d();
    this.disposers.clear();
    for (const p of this.particles) this.release(p);
    this.particles.length = 0;
    this.updaters.length = 0;
    this.freezeMs = 0;
    this.shakeAmp = 0;
    this.updateShake(0);
    for (const pl of this.plugins) pl.clear();
  }

  private step(p: Particle, dtMs: number) {
    p.age += dtMs;
    if (p.age < 0) return;
    const o = p.o;
    const dt = dtMs / 1000;
    if (o.ax) p.vx += o.ax * dt;
    if (o.ay) p.vy += o.ay * dt;
    if (o.gravity) p.vz -= o.gravity * dt;
    if (o.drag) {
      const k = Math.exp(-o.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.vz *= k;
    }
    p.px += p.vx * dt;
    p.py += p.vy * dt;
    p.pz += p.vz * dt;
    if (o.spin) p.rotation += o.spin * dt;
    const t = o.life === Infinity ? 0 : clamp01(p.age / o.life);
    this.place(p, t);
    if (p.z < 0 && (o.killOnGround || o.bounce)) {
      if (o.bounce && Math.abs(p.vz) > 30) {
        p.pz -= p.z;
        p.vz = -p.vz * o.bounce;
        p.vx *= 0.7;
        p.vy *= 0.7;
      } else p.dead = true;
    }
    o.onUpdate?.(p, t, dt);
    if (p.age >= o.life) p.dead = true;
  }

  private place(p: Particle, t: number) {
    const o = p.o;
    const s = p.sprite;
    let bx = o.x, by = o.y, bz = o.z ?? 0;
    if (o.follow) {
      const f = o.follow();
      bx += f.x;
      by += f.y;
      bz += f.z ?? 0;
    }
    p.x = bx + p.px;
    p.y = by + p.py;
    p.z = bz + p.pz;
    s.visible = p.age >= 0;
    s.position.set(p.x, p.y - p.z);
    if (o.layer === undefined || o.layer === 'body') s.zIndex = p.y + (o.zBias ?? 0);

    s.alpha = evalCurve(o.alpha, t, 1) * p.alphaMul;
    const k = evalCurve(o.scale, t, 1);
    let sx = k * evalCurve(o.scaleX, t, 1);
    const sy = k * evalCurve(o.scaleY, t, 1);
    let rot = p.rotation;
    if (o.faceVelocity || o.stretch) {
      const svx = p.vx, svy = p.vy - p.vz;
      if (o.faceVelocity && (svx || svy)) rot = Math.atan2(svy, svx);
      if (o.stretch) sx *= 1 + o.stretch * Math.hypot(svx, svy);
    }
    if (o.groundAligned) setGroundTransform(s, rot, sx, sy, this.groundSquash);
    else {
      s.rotation = rot;
      s.scale.set(sx, sy);
    }
    s.tint = evalTint(o.tint, t);
  }

  private release(p: Particle) {
    p.o.onDeath?.(p);
    const s = p.sprite;
    s.parent?.removeChild(s);
    s.visible = false;
    this.pool.push(s);
    p.o = undefined as any;
    p.sprite = undefined as any;
    this.particlePool.push(p);
  }

  private updateShake(dt: number) {
    let nx = 0, ny = 0;
    if (this.shakeAmp > 0) {
      this.shakeAge += dt;
      const k = 1 - this.shakeAge / this.shakeDur;
      if (k <= 0) this.shakeAmp = 0;
      else {
        const a = this.shakeAmp * k * k;
        nx = (Math.random() * 2 - 1) * a;
        ny = (Math.random() * 2 - 1) * a;
      }
    }
    if (this.camera) {
      this.camera.x += nx - this.shakeX;
      this.camera.y += ny - this.shakeY;
    }
    this.shakeX = nx;
    this.shakeY = ny;
  }
}

/**
 * Rotate a sprite by `rot` ON THE GROUND PLANE, then squash Y by `squash`
 * (world-space). Done with skew so it needs no wrapper container.
 */
export function setGroundTransform(s: Sprite, rot: number, sx: number, sy: number, squash: number) {
  const c = Math.cos(rot), n = Math.sin(rot);
  s.rotation = 0;
  s.skew.set(-Math.atan2(n, squash * c), Math.atan2(squash * n, c));
  s.scale.set(sx * Math.sqrt(c * c + squash * squash * n * n), sy * Math.sqrt(n * n + squash * squash * c * c));
}
