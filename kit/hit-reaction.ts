// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { ColorMatrixFilter, type Sprite } from 'pixi.js';
import type { Handle, VfxWorld } from './vfx-world';
import type { HitSkinName } from './skill-timing';
import { clamp01, lerpColor, outCubic } from './ease';

const skins: Record<HitSkinName, number> = {
  char: 0xb94a12, ice: 0x80eaff, shock: 0xb18aff, holy: 0xffe8a0,
  shadow: 0x642898, poison: 0xa2c62a, earth: 0x99704a, metal: 0xffc94c,
  wind: 0x9cf0cb, nature: 0x48c754, red: 0xff3030,
};
const tints = new WeakMap<Sprite, Handle>();
const offsets = new WeakMap<Sprite, Handle>();

function reaction(w: VfxWorld, sprite: Sprite, active: WeakMap<Sprite, Handle>, duration: number,
  apply: (t: number, age: number) => void, restore: () => void): Handle {
  let alive = true, age = 0;
  let updater: Handle | undefined, unown: (() => void) | undefined;
  const handle: Handle = {
    get alive() { return alive; },
    stop() {
      if (!alive) return;
      alive = false;
      updater?.stop(); unown?.();
      if (active.get(sprite) === handle) {
        active.delete(sprite);
        restore();
      }
    },
  };
  if (sprite.destroyed || duration <= 0) {
    alive = false;
    return handle;
  }
  active.set(sprite, handle);
  unown = w.own(() => handle.stop());
  apply(0, 0);
  updater = w.addUpdater((dt) => {
    age += dt;
    if (sprite.destroyed || age >= duration) { handle.stop(); return false; }
    apply(clamp01(age / duration), age);
  });
  return handle;
}

/** Replace any previous skin, then ease back to the true pre-reaction tint. */
export function hitSkin(w: VfxWorld, sprite: Sprite, skin: HitSkinName,
  o: { duration?: number; strength?: number } = {}): Handle {
  const duration = o.duration ?? (skin === 'holy' ? 110 : skin === 'wind' ? 120 : 300);
  const strength = o.strength ?? (skin === 'holy' ? 0.35 : skin === 'wind' ? 0.40 : 0.9);
  if (!Number.isFinite(duration) || !Number.isFinite(strength)) throw new RangeError('hitSkin options must be finite');
  tints.get(sprite)?.stop();
  if (sprite.destroyed) return reaction(w, sprite, tints, 0, () => {}, () => {});
  const original = sprite.tint;
  if (duration <= 0 || strength <= 0) return reaction(w, sprite, tints, 0, () => {}, () => {});
  const filter = new ColorMatrixFilter();
  const originalFilters = sprite.filters;
  sprite.filters = [...(originalFilters ?? []), filter];
  return reaction(w, sprite, tints, duration, (t, age) => {
    const color = skin === 'char' ? lerpColor(skins.char, 0x211017, clamp01(t * 4))
      : skin === 'shock' ? lerpColor(skins.shock, 0xeee1ff, (Math.sin(age * 0.13) + 1) / 2)
      : skins[skin];
    const fade = skin === 'char' ? clamp01((t - 0.2) / 0.8) : t;
    const a = clamp01(strength) * (1 - outCubic(fade)), k = 1 - a;
    const gray = skin === 'holy' ? 0 : k * clamp01(a * 2), keep = k - gray;
    const r = gray * 0.2126, g = gray * 0.7152, b = gray * 0.0722;
    filter.matrix = [keep + r, g, b, 0, ((color >> 16) & 255) / 255 * a,
      r, keep + g, b, 0, ((color >> 8) & 255) / 255 * a,
      r, g, keep + b, 0, (color & 255) / 255 * a,
      0, 0, 0, 1, 0];
  }, () => {
    if (!sprite.destroyed) {
      sprite.tint = original;
      const remaining = (sprite.filters ?? []).filter((f) => f !== filter);
      sprite.filters = remaining.length ? remaining : originalFilters === null ? null : [];
    }
    filter.destroy();
  });
}

/** A parent-space impulse via pivot, leaving movement-owned position untouched. */
export function rockBack(w: VfxWorld, sprite: Sprite,
  o: { push: number; angle: number; duration?: number }): Handle {
  const duration = o.duration ?? 320;
  if (![duration, o.push, o.angle].every(Number.isFinite) || o.push < 0) throw new RangeError('rockBack options must be finite with nonnegative push');
  offsets.get(sprite)?.stop();
  if (sprite.destroyed) return reaction(w, sprite, offsets, 0, () => {}, () => {});
  const x = sprite.pivot.x, y = sprite.pivot.y;
  return reaction(w, sprite, offsets, o.push === 0 ? 0 : duration, (t) => {
    const spring = Math.sin(t * Math.PI * 2) * Math.exp(-4 * t) / 0.45;
    const dx = Math.cos(o.angle) * o.push * spring, dy = Math.sin(o.angle) * o.push * spring;
    const c = Math.cos(sprite.rotation), s = Math.sin(sprite.rotation);
    sprite.pivot.set(x - (c * dx + s * dy) / (sprite.scale.x || 1),
      y - (-s * dx + c * dy) / (sprite.scale.y || 1));
  }, () => { if (!sprite.destroyed) sprite.pivot.set(x, y); });
}
