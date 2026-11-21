export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const inQuad: Ease = (t) => t * t;
export const outQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const inCubic: Ease = (t) => t * t * t;
export const outCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const outQuart: Ease = (t) => 1 - Math.pow(1 - t, 4);
export const outExpo: Ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const inOutSine: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const outBack: Ease = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);
export const pick = <T>(items: readonly T[]): T => items[(Math.random() * items.length) | 0];

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(lerp(ar, br, t)) << 16) |
    (Math.round(lerp(ag, bg, t)) << 8) |
    Math.round(lerp(ab, bb, t))
  );
}

/** Three-stop color ramp, e.g. white-hot core -> main color -> dark smoke. */
export function colorRamp(c0: number, c1: number, c2: number, mid = 0.35): (t: number) => number {
  return (t) => (t < mid ? lerpColor(c0, c1, t / mid) : lerpColor(c1, c2, (t - mid) / (1 - mid)));
}

/** Alpha envelope: fade in over `inPart`, hold, fade out over the last `outPart` of life. */
export function envelope(inPart = 0.1, outPart = 0.6, peak = 1): (t: number) => number {
  return (t) => {
    if (t < inPart) return (t / inPart) * peak;
    if (t > 1 - outPart) return ((1 - t) / outPart) * peak;
    return peak;
  };
}
