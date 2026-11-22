// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Match VFX to characters pre-rendered from Blender (3D -> 2.5D sprites).
// All numbers come from the Blender scene: the camera, the render size and the sun.
// Run tools/blender_vfx_rig.py inside Blender to print them, or fill them in by hand.
import { Sprite } from 'pixi.js';
import type { Vec3 } from './vfx-world';

const DEG = Math.PI / 180;

export interface BlenderCamera {
  /** Camera Rotation X in Blender (0 = straight down, 90 = horizontal). 2:1 iso is 60, "true" iso 54.736. */
  rotationXDeg: number;
  /** Orthographic Scale of the camera (meters across the larger render side). */
  orthoScale: number;
  /** Render resolution of the larger side in px, times the in-game sprite scale. */
  renderSizePx: number;
}

export interface BlenderSun {
  /**
   * Direction the baked shadows point ON SCREEN, in degrees: 0 = right, 90 = down (toward the
   * camera), 180 = left, 270 = up (away from the camera). Read it off a rendered character's shadow.
   */
  shadowScreenAngleDeg: number;
  /** Sun elevation above the ground plane in degrees (90 = noon, shadow under the feet). */
  elevationDeg: number;
}

export interface Rig25D {
  /** Pass to VfxWorld({ groundSquash }). */
  groundSquash: number;
  /** Pass to VfxWorld({ shadow }): ground offset (screen px) of a shadow per px of z. */
  shadow: { x: number; y: number };
  /** Screen px per meter along the ground X axis. */
  pxPerMeter: number;
  /** Screen px per meter of height (multiply a height in meters by this to get z). */
  zPxPerMeter: number;
}

/**
 * Orthographic camera tilted down by `90 - rotationX` degrees:
 * - ground depth shrinks by sin(tilt)  -> groundSquash
 * - vertical height shrinks by cos(tilt) -> z px per meter
 * Perspective cameras: use the values at the center of the play area (close enough for VFX).
 */
export function rigFromBlender(cam: BlenderCamera, sun?: BlenderSun): Rig25D {
  const tilt = (90 - cam.rotationXDeg) * DEG;
  const pxPerMeter = cam.renderSizePx / cam.orthoScale;
  const groundSquash = Math.sin(tilt);
  const zPxPerMeter = pxPerMeter * Math.cos(tilt);
  let shadow = { x: 0, y: 0 };
  if (sun) {
    const a = sun.shadowScreenAngleDeg * DEG;
    // Shadow length on the ground (meters) for 1 m of height, split into screen-right and
    // ground-depth parts, then converted to screen px per screen px of z.
    const len = 1 / Math.tan(Math.max(1, sun.elevationDeg) * DEG);
    const gx = Math.cos(a) * len;
    const gy = Math.sin(a) * len;
    shadow = { x: (gx * pxPerMeter) / zPxPerMeter, y: (gy * pxPerMeter * groundSquash) / zPxPerMeter };
  }
  return { groundSquash, shadow, pxPerMeter, zPxPerMeter };
}

/**
 * Anchor a rendered sprite at the pixel between its feet (the Blender origin), so
 * sprite.position is the ground point every VFX recipe uses. footX/footY are in texture px.
 */
export function anchorAtFeet(sprite: Sprite, footX: number, footY: number) {
  const f = sprite.texture.frame;
  sprite.anchor.set(footX / f.width, footY / f.height);
}

/**
 * Standard attach points for a unit standing at ground (x, y). `heightPx` is the character's
 * height as z (meters * zPxPerMeter). Aim hits at `chest`, buffs at `feet`, auras over `head`.
 */
export function unitPoints(x: number, y: number, heightPx: number) {
  const p = (k: number): Vec3 => ({ x, y, z: heightPx * k });
  return { feet: p(0), knee: p(0.25), chest: p(0.6), head: p(0.9), above: p(1.15) };
}

/**
 * A socket (hand, weapon tip, muzzle) exported per facing direction from Blender, as an
 * offset from the feet: x right in screen px, y ground depth px, z height px.
 * `dir` is the sprite's facing index (e.g. 0..7 for 8-direction renders).
 */
export function socketPoint(feet: { x: number; y: number }, sockets: readonly Vec3[], dir: number): Vec3 {
  const s = sockets[((dir % sockets.length) + sockets.length) % sockets.length];
  return { x: feet.x + s.x, y: feet.y + s.y, z: s.z ?? 0 };
}
