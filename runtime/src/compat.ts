// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import * as PIXI from 'pixi.js';
export const v8 = Number(PIXI.VERSION.split('.')[0]) >= 8;
export function frameTexture(sheet: PIXI.Texture, x: number, y: number, width: number, height: number): PIXI.Texture {
  const rect = new PIXI.Rectangle(x, y, width, height);
  const Texture = PIXI.Texture as any;
  return v8 ? new Texture({ source: sheet.source, frame: rect }) : new Texture((sheet as any).baseTexture, rect);
}
export function setBlend(sprite: PIXI.Sprite, additive: boolean) {
  sprite.blendMode = (v8 ? additive ? 'add' : 'normal' : additive ? 1 : 0) as any;
}
