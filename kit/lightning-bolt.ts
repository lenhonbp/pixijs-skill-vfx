import type { Vec3, VfxWorld } from './vfx-world';
import { TEX_METRICS as M, type VfxTextures } from './textures';
import type { Palette } from './recipes';
import { rand } from './ease';

function jagged(a: Vec3, b: Vec3, depth: number, disp: number, out: Vec3[]) {
  if (depth === 0) { out.push(b); return; }
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const m = { x: (a.x + b.x) / 2 - dy / len * rand(-disp, disp), y: (a.y + b.y) / 2 + dx / len * rand(-disp, disp) };
  jagged(a, m, depth - 1, disp / 2, out);
  jagged(m, b, depth - 1, disp / 2, out);
}

/** One finite jagged bolt, projected from world endpoints. No endpoint flashes or timers. */
export function lightningBolt(w: VfxWorld, tex: VfxTextures, a: Vec3, b: Vec3, p: Palette,
  o: { width?: number; life?: number; alpha?: number; coreAlpha?: number; depth?: number; halo?: number } = {}) {
  const start = { x: a.x, y: a.y - (a.z ?? 40) }, end = { x: b.x, y: b.y - (b.z ?? 40) };
  const pts: Vec3[] = [start];
  jagged(start, end, o.depth ?? 5, Math.hypot(end.x - start.x, end.y - start.y) * 0.18, pts);
  const gy = Math.max(a.y, b.y) + 5, width = o.width ?? 1;
  for (let j = 0; j < pts.length - 1; j++) {
    const s = pts[j], e = pts[j + 1], len = Math.hypot(e.x - s.x, e.y - s.y);
    const seg = { texture: tex.beam, x: s.x, y: gy, z: gy - s.y, anchorX: 0, rotation: Math.atan2(e.y - s.y, e.x - s.x), scaleX: (len + 1) / M.beamLength, life: o.life ?? 90 } as const;
    if (o.halo) w.spawn({ ...seg, scaleY: 4 * width, alpha: [o.halo, 0], tint: p.main });
    w.spawn({ ...seg, scaleY: 1.6 * width, alpha: [o.alpha ?? 0.55, 0], tint: p.main });
    w.spawn({ ...seg, scaleY: 0.4 * width, alpha: [o.coreAlpha ?? 1, o.coreAlpha === undefined ? 0.2 : 0], tint: p.core, zBias: 1 });
  }
}
