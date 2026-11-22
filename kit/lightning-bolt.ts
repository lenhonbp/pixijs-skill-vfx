// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { BlurFilter, Container, Graphics } from 'pixi.js';
import type { Handle, Vec3, VfxWorld } from './vfx-world';
import type { VfxTextures } from './textures';
import type { Palette } from './recipes';
import { blend, isPixiV8 } from './pixi-compat';
import { lerpColor, rand } from './ease';

type Point = { x: number; y: number };

function jagged(a: Point, b: Point, depth: number, displacement: number): Point[] {
  if (depth <= 0) return [a, b];
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const offset = rand(-displacement, displacement);
  const m = { x: (a.x + b.x) / 2 - dy / length * offset, y: (a.y + b.y) / 2 + dx / length * offset };
  return [...jagged(a, m, depth - 1, displacement * 0.48).slice(0, -1), ...jagged(m, b, depth - 1, displacement * 0.48)];
}

function ribbon(g: Graphics, points: Point[], width: number, color: number, alpha: number) {
  const left: number[] = [], right: number[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const taper = 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * i / (points.length - 1)), 0.35);
    const nx = -dy / length * width * taper / 2, ny = dx / length * width * taper / 2;
    left.push(p.x + nx, p.y + ny); right.unshift(p.x - nx, p.y - ny);
  });
  const polygon = [...left, ...right];
  if (isPixiV8()) g.poly(polygon).fill({ color, alpha });
  else (g as any).beginFill(color, alpha).drawPolygon(polygon).endFill();
}

/** A tapered channel with stable large kinks, finer restrike jitter and terminating forks. */
export function lightningBolt(w: VfxWorld, tex: VfxTextures, a: Vec3, b: Vec3, p: Palette,
  o: { width?: number; life?: number; alpha?: number; coreAlpha?: number; depth?: number; halo?: number;
    branches?: number; layer?: 'ground' | 'body' | 'top'; leader?: boolean; restrikes?: number; afterglow?: number;
    hold?: number; haloWidth?: number } = {}): Handle {
  const life = o.life ?? 210, width = o.width ?? 1, restrikes = o.restrikes ?? 2;
  if (![life, width, a.x, a.y, a.z ?? 40, b.x, b.y, b.z ?? 40, o.depth ?? 4, o.afterglow ?? 0, o.hold ?? 0, o.haloWidth ?? 0].every(Number.isFinite) ||
    (o.hold ?? 0) < 0 || (o.haloWidth ?? 0) < 0 ||
    (o.branches !== undefined && (!Number.isInteger(o.branches) || o.branches < 0 || o.branches > 8)) ||
    !Number.isSafeInteger(restrikes) || restrikes < 0)
    throw new RangeError('Lightning needs finite endpoints, life, width, depth and 0..8 branches');
  if (life <= 0 || width <= 0) return { alive: false, stop() {} };
  const start = { x: a.x, y: a.y - (a.z ?? 40) }, end = { x: b.x, y: b.y - (b.z ?? 40) };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 0.1) return { alive: false, stop() {} };
  const coarse = jagged(start, end, Math.max(1, Math.min(4, o.depth ?? 4)), length * 0.18);
  const paths = [coarse];
  const forks = o.branches ?? (length > 70 ? 3 : 1);
  for (let i = 0; i < forks; i++) {
    const root = coarse[Math.min(coarse.length - 2, 1 + Math.floor((i + 1) / (forks + 1) * (coarse.length - 2)))];
    const dx = end.x - start.x, dy = end.y - start.y, side = i % 2 ? -1 : 1;
    const fork = { x: root.x + dx * 0.14 - dy * side * rand(0.08, 0.2), y: root.y + dy * 0.14 + dx * side * rand(0.08, 0.2) };
    paths.push(jagged(root, fork, 2, length * 0.025));
  }
  const root = new Container(), halo = new Graphics(), glow = new Graphics(), core = new Graphics();
  halo.blendMode = glow.blendMode = blend('add');
  const blur = width >= 1 ? (isPixiV8() ? new BlurFilter({ strength: 2.8, quality: 2 }) : new (BlurFilter as any)(2.8, 2)) : undefined;
  if (blur) { blur.blendMode = blend('add'); halo.filters = [blur]; }
  root.addChild(halo, glow, core); root.zIndex = Math.max(a.y, b.y) + 6;
  w.layers[o.layer ?? 'body'].addChild(root);
  let age = 0, phase = -1, alive = true, updater: Handle | undefined, unown: (() => void) | undefined;
  const stop = () => {
    if (!alive) return;
    alive = false; updater?.stop(); unown?.(); root.destroy({ children: true }); blur?.destroy();
  };
  const draw = () => {
    const t = age / life;
    const spacing = 0.24 / Math.max(1, restrikes - 1), stroke = Math.floor((t - 0.32) / spacing);
    const strokeWidth = Math.min(0.12, spacing / 2);
    const next = t < 0.08 ? 0 : t < 0.32 || !restrikes ? 1 : Math.min(restrikes - 1, stroke) + 2;
    if (next !== phase) {
      phase = next; halo.clear(); glow.clear(); core.clear();
      paths.forEach((path, i) => {
        const fine: Point[] = [];
        for (let j = 0; j < path.length - 1; j++) fine.push(...jagged(path[j], path[j + 1], 1, Math.min(2.4, length * 0.007)).slice(0, -1));
        fine.push(path[path.length - 1]);
        const branch = i === 0 ? 1 : 0.58, wd = width * branch;
        const haloWidth = o.haloWidth === undefined ? 9 * wd : o.haloWidth * branch;
        ribbon(halo, fine, haloWidth, p.main, (o.halo ?? 0.11) * branch);
        ribbon(halo, fine, haloWidth * 2 / 3, p.main, (o.halo ?? 0.11) * branch);
        ribbon(halo, fine, haloWidth / 3, p.main, (o.halo ?? 0.11) * branch);
        ribbon(glow, fine, 3.5 * wd, p.main, (o.alpha ?? 0.5) * branch);
        ribbon(core, fine, 1.9 * wd, lerpColor(p.core, 0xf7f3ff, 0.85), (o.coreAlpha ?? 0.95) * branch);
      });
    }
    const end = restrikes === 0 ? 0.23 : 0.32 + (restrikes - 1) * spacing + strokeWidth;
    const pulse = t < 0.08 ? (o.leader === false ? 1 : 0.09) : t < 0.23 ? 1 :
      stroke >= 0 && stroke < restrikes && t < 0.32 + stroke * spacing + strokeWidth ? Math.max(0.2, 0.8 - stroke * 0.25) :
      t >= end ? 0.16 * Math.pow((1 - t) / (1 - end), 2) : t < 0.32 ? 0.05 : 0.04;
    const held = o.hold ? 0.82 * Math.pow(Math.min(1, (life - age) / Math.max(1, life - o.hold)), 1.5) : 0;
    core.alpha = t < 0.08 ? pulse : Math.max(pulse, held, (o.afterglow ?? 0) * Math.pow(1 - t, 0.6));
    glow.alpha = core.alpha * 0.8 + (1 - t) * 0.12;
    halo.alpha = (o.hold ? core.alpha : pulse) * 0.6 + (1 - t) * 0.2;
  };
  draw(); unown = w.own(stop);
  updater = w.addUpdater((dt) => { age += dt; if (age >= life) { stop(); return false; } draw(); });
  return { get alive() { return alive; }, stop };
}
