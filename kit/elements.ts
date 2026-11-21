// Wu Xing (Ngũ Hành) element palettes and the visual language of each element.
// Use one element per skill; mix only on purpose (e.g. Thủy + Mộc for a healing rain).
import type { Palette } from './recipes';
import type { VfxWorld } from './vfx-world';

export type ElementName = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho';

export interface Element {
  name: ElementName;
  /** Display names. */
  vi: string;
  en: string;
  palette: Palette;
  /** Secondary accent for highlights (sparks, rims). */
  accent: number;
  /** Shape language to follow when designing a new skill of this element. */
  shapes: string;
}

export const WUXING: Record<ElementName, Element> = {
  kim: {
    name: 'kim', vi: 'Kim', en: 'Metal',
    palette: { core: 0xffffff, main: 0xffe08a, dark: 0x8a6a2a }, accent: 0xdfe8ff,
    shapes: 'blades, sharp streaks, star glints, hard stops; fast in, fast out; gold + steel white',
  },
  moc: {
    name: 'moc', vi: 'Mộc', en: 'Wood',
    palette: { core: 0xf2ffd8, main: 0x7ee05a, dark: 0x2c6b24 }, accent: 0xffe0f0,
    shapes: 'leaves, vines, spores, slow rising motes with sway; organic curves; grows then withers',
  },
  thuy: {
    name: 'thuy', vi: 'Thủy', en: 'Water',
    palette: { core: 0xeaffff, main: 0x4fc3ff, dark: 0x174a9a }, accent: 0xb8f0ff,
    shapes: 'droplets, splash rings, flowing beams; ice = shards and spikes that shatter; smooth easing',
  },
  hoa: {
    name: 'hoa', vi: 'Hỏa', en: 'Fire',
    palette: { core: 0xfff3c4, main: 0xff7a1a, dark: 0x8a1a05 }, accent: 0xffd04a,
    shapes: 'rising puffs, embers, heat flashes, scorch decals; violent burst, long smoky tail',
  },
  tho: {
    name: 'tho', vi: 'Thổ', en: 'Earth',
    palette: { core: 0xfff0d0, main: 0xd9a050, dark: 0x5a3a1a }, accent: 0xc8b090,
    shapes: 'rock spikes, debris with gravity and bounce, dust clouds, cracks; heavy, slow, big shake',
  },
};

/** +1 or -1: mirror lit-from-the-left textures (rock, spike, blade) so their lit side faces the sun. */
export function litFlip(w: VfxWorld): 1 | -1 {
  return w.shadow.x >= 0 ? 1 : -1;
}
