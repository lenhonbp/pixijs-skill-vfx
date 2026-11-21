// Small shims so the kit runs unchanged on PixiJS v7 and v8.
import { Application, Texture } from 'pixi.js';

export type BlendName = 'normal' | 'add' | 'screen' | 'multiply';

/** PixiJS v7 BLEND_MODES enum values (stable since v5). */
const V7_BLEND: Record<BlendName, number> = { normal: 0, add: 1, multiply: 2, screen: 3 };

/** True on PixiJS v8+ (Application needs `await app.init()`). */
export function isPixiV8(): boolean {
  return typeof (Application.prototype as any).init === 'function';
}

const V8 = isPixiV8();

/** v7 wants the numeric BLEND_MODES enum, v8 wants the string name. */
export function blend(name: BlendName): any {
  return V8 ? name : V7_BLEND[name];
}

export function textureFromCanvas(canvas: HTMLCanvasElement): Texture {
  return (Texture as any).from(canvas);
}
