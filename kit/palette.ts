import type { Palette } from './recipes';
import { clamp01, lerpColor } from './ease';

/** Derive highlights and shadows; explicit overrides preserve art-directed colors. */
export function paletteFrom(main: number, o: { core?: number; dark?: number } = {}): Palette {
  return {
    core: o.core ?? lerpColor(lerpColor(main, 0xffdca8, 0.18), 0xffffff, 0.85),
    main,
    dark: o.dark ?? lerpColor(lerpColor(main, 0x4240a0, 0.22), 0, 0.65),
  };
}

/** Hue is in degrees, saturation is a multiplier, lightness an additive 0..1 offset. */
export function shiftPalette(p: Palette, o: { hue?: number; sat?: number; light?: number }): Palette {
  const shift = (color: number) => {
    const r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo, light = (hi + lo) / 2;
    let hue = 0;
    if (d) hue = (hi === r ? (g - b) / d : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    hue = ((hue + (o.hue ?? 0)) % 360 + 360) % 360;
    const sat = clamp01((d ? d / (1 - Math.abs(2 * light - 1)) : 0) * (o.sat ?? 1));
    const l = clamp01(light + (o.light ?? 0)), c = (1 - Math.abs(2 * l - 1)) * sat;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = l - c / 2;
    const rgb = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
    return rgb.reduce((result, v) => (result << 8) | Math.round((v + m) * 255), 0);
  };
  return { core: shift(p.core), main: shift(p.main), dark: shift(p.dark) };
}
