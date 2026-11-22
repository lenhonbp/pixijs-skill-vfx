import { Graphics, type Texture } from 'pixi.js';
import type { Handle, Particle, SpawnOptions, Vec3, VfxWorld } from './vfx-world';
import { TEX_METRICS as M, type VfxTextures } from './textures';
import type { Palette } from './recipes';
import { isPixiV8 } from './pixi-compat';

export type FloorRingOptions = Pick<SpawnOptions,
  'alpha' | 'scale' | 'scaleX' | 'scaleY' | 'rotation' | 'spin' | 'blend' | 'tint' | 'delay' | 'onUpdate'> & {
  x?: number; y?: number; radius: number; palette: Palette; duration?: number;
  /** When following, x/y are offsets from this ground point; height is ignored. */
  around?: () => Vec3;
  texture?: Texture;
  textureRadius?: number;
  zBias?: number;
};

export interface FloorRingHandle extends Handle {
  readonly far: Particle | null;
  readonly near: Particle | null;
}

/** Screen-space halves stay joined even while an elliptical rune rotates on the floor. */
export function floorRing(w: VfxWorld, tex: VfxTextures, o: FloorRingOptions): FloorRingHandle {
  const life = o.duration ?? 380, metric = o.textureRadius ?? M.ringRadius;
  if (!Number.isFinite(o.radius) || o.radius < 0 || !Number.isFinite(metric) || metric <= 0 ||
    !(life === Infinity || Number.isFinite(life))) throw new RangeError('floorRing needs a finite nonnegative radius and valid duration/textureRadius');
  const records: { p: Particle; options: SpawnOptions; mask: Graphics }[] = [];
  let unown: (() => void) | undefined, updater: Handle | undefined;
  const follow = o.around ? () => { const at = o.around!(); return { x: at.x, y: at.y }; } : undefined;
  const cleanup = (record: typeof records[number]) => {
    const i = records.indexOf(record);
    if (i < 0) return;
    records.splice(i, 1);
    record.p.sprite.mask = null;
    record.mask.destroy();
    if (!records.length) { updater?.stop(); unown?.(); }
  };
  const half = (near: boolean) => {
    const p = w.spawn({ texture: o.texture ?? tex.ring, x: o.x ?? 0, y: o.y ?? 0,
      follow, life, layer: near ? 'body' : 'ground', groundAligned: true,
      zBias: near ? o.zBias ?? 0.1 : undefined, scale: o.scale ?? o.radius / metric,
      scaleX: o.scaleX, scaleY: o.scaleY, alpha: o.alpha, tint: o.tint ?? o.palette.main,
      blend: o.blend, rotation: o.rotation, spin: o.spin, delay: o.delay,
      onUpdate: (q, t, dt) => { o.onUpdate?.(q, t, dt); record.mask.position.copyFrom(q.sprite.position); },
      onDeath: () => cleanup(record),
    });
    if (!p) return null;
    const mask = new Graphics();
    const size = 1e6;
    if (isPixiV8()) mask.rect(-size, near ? 0 : -size, size * 2, size).fill(0xffffff);
    else (mask as any).beginFill(0xffffff).drawRect(-size, near ? 0 : -size, size * 2, size).endFill();
    p.sprite.parent!.addChild(mask);
    p.sprite.mask = mask;
    const record = { p, options: p.o, mask };
    records.push(record);
    return p;
  };
  const handle: FloorRingHandle = {
    far: null, near: null,
    get alive() { return records.some(({ p, options }) => p.o === options && !p.dead); },
    stop() {
      for (const record of [...records]) {
        if (record.p.o === record.options) { record.p.kill(); record.p.sprite.visible = false; }
        cleanup(record);
      }
    },
  };
  if (life <= 0 || o.radius === 0 || w.count + 2 > w.maxParticles) return handle;
  Object.assign(handle, { far: half(false), near: half(true) });
  const sync = () => {
    const at = follow?.() ?? { x: 0, y: 0 };
    for (const { mask, p } of records) mask.position.set((o.x ?? 0) + at.x + p.px, (o.y ?? 0) + at.y + p.py - p.pz);
  };
  sync();
  if (records.length) {
    unown = w.own(() => handle.stop());
    updater = w.addUpdater(() => {
      for (const record of [...records]) if (record.p.dead || record.p.o !== record.options) cleanup(record);
      sync();
      return records.length > 0;
    });
  }
  return handle;
}
