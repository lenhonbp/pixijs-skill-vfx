// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Wu Xing (Ngũ Hành) element palettes and the visual language of each element.
// Use one element per skill; mix only on purpose (e.g. Thủy + Mộc for a healing rain).
import type { Palette } from './recipes';
import type { VfxWorld } from './vfx-world';
import type { HitSkinName } from './skill-timing';

export type ElementName = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho';

/** Variant elements (biến dị) outside the Wu Xing cycle. */
export type VariantElementName = 'phong' | 'loi';
export type AnyElementName = ElementName | VariantElementName;
export type ElementId = AnyElementName | (string & {});

export interface Element {
  name: ElementId;
  /** Display names. */
  vi: string;
  en: string;
  palette: Palette;
  /** Secondary accent for highlights (sparks, rims). */
  accent: number;
  /** Shape language to follow when designing a new skill of this element. */
  shapes: string;
  /** Default target reaction; custom elements fall back to red when omitted. */
  hitSkin?: HitSkinName;
}

export const WUXING: Record<ElementName, Element> = {
  kim: {
    name: 'kim', vi: 'Kim', en: 'Metal', hitSkin: 'metal',
    palette: { core: 0xffffff, main: 0xffe08a, dark: 0x8a6a2a }, accent: 0xdfe8ff,
    shapes: 'blades, sharp streaks, star glints, hard stops; fast in, fast out; gold + steel white',
  },
  moc: {
    name: 'moc', vi: 'Mộc', en: 'Wood', hitSkin: 'nature',
    palette: { core: 0xf2ffd8, main: 0x7ee05a, dark: 0x2c6b24 }, accent: 0xffe0f0,
    shapes: 'leaves, vines, spores, slow rising motes with sway; organic curves; grows then withers',
  },
  thuy: {
    name: 'thuy', vi: 'Thủy', en: 'Water', hitSkin: 'ice',
    palette: { core: 0xeaffff, main: 0x4fc3ff, dark: 0x174a9a }, accent: 0xb8f0ff,
    shapes: 'droplets, splash rings, flowing beams; ice = shards and spikes that shatter; smooth easing',
  },
  hoa: {
    name: 'hoa', vi: 'Hỏa', en: 'Fire', hitSkin: 'char',
    palette: { core: 0xfff3c4, main: 0xff7a1a, dark: 0x8a1a05 }, accent: 0xffd04a,
    shapes: 'rising puffs, embers, heat flashes, scorch decals; violent burst, long smoky tail',
  },
  tho: {
    name: 'tho', vi: 'Thổ', en: 'Earth', hitSkin: 'earth',
    palette: { core: 0xfff0d0, main: 0xd9a050, dark: 0x5a3a1a }, accent: 0xc8b090,
    shapes: 'rock spikes, debris with gravity and bounce, dust clouds, cracks; heavy, slow, big shake',
  },
};

/** Phong (Wind): variant element. Fast, curving, mostly translucent; reads through motion, not mass. */
export const PHONG: Element = {
  name: 'phong', vi: 'Phong', en: 'Wind', hitSkin: 'wind',
  palette: { core: 0xffffff, main: 0x8ff0d0, dark: 0x2a7f78 }, accent: 0xe4fff6,
  shapes: 'crescent gusts, spiralling streaks and ribbons, dust and leaves caught in the flow; curl-noise motion, pull/lift; additive and translucent, never solid',
};

/** Lôi (Lightning): instantaneous, forked and violet-white rather than water blue. */
export const LOI: Element = {
  name: 'loi', vi: 'Lôi', en: 'Lightning', hitSkin: 'shock',
  palette: { core: 0xffffff, main: 0xa8b4ff, dark: 0x3a2a9a }, accent: 0xd8c4ff,
  shapes: 'jagged forked bolts, instant strikes, crackling arcs that re-roll every frame, white-hot flash then fast fade; zero anticipation travel, all impact; sparks and scorch',
};

/** Built-in elements, Wu Xing plus variants. Custom elements live in the runtime registry. */
export const ELEMENTS: Record<AnyElementName, Element> = { ...WUXING, phong: PHONG, loi: LOI };

const registry = new Map<string, Element>(Object.values(ELEMENTS).map((element) => [element.name, element]));

/** Register or replace a runtime element without changing the five-element Wu Xing cycle. */
export function defineElement(def: Element): Element {
  registry.set(def.name, def);
  return def;
}

/** Unknown names return undefined. */
export function getElement(name: ElementId): Element | undefined {
  return registry.get(name);
}

/** +1 or -1: mirror lit-from-the-left textures (rock, spike, blade) so their lit side faces the sun. */
export function litFlip(w: VfxWorld): 1 | -1 {
  return w.shadow.x >= 0 ? 1 : -1;
}
