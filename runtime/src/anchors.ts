// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Normalized anchor map: points on a unit as fractions of its height (x forward along its aim, y up from the feet),
// so any sprite, billboard or skeleton can tell a pack where it casts from. See docs/pack-format.md#anchors.
export type AnchorName = 'feet_ground' | 'chest' | 'head' | 'mouth' | 'hand_r' | 'hand_l' | 'weapon_tip' | 'back' | 'overhead';
export interface NormalizedAnchor { x: number; y: number }

export const ANCHOR_NAMES: readonly AnchorName[] = ['feet_ground', 'chest', 'head', 'mouth', 'hand_r', 'hand_l', 'weapon_tip', 'back', 'overhead'];
/** Default humanoid table the packs are baked with (a pack carries its own copy in `manifest.anchors.map`). */
export const ANCHOR_MAP: Readonly<Record<AnchorName, Readonly<NormalizedAnchor>>> = Object.freeze({
  feet_ground: Object.freeze({ x: 0, y: 0 }), chest: Object.freeze({ x: 0.05, y: 0.55 }), head: Object.freeze({ x: 0.05, y: 0.9 }),
  mouth: Object.freeze({ x: 0.15, y: 0.85 }), hand_r: Object.freeze({ x: 0.3, y: 0.62 }), hand_l: Object.freeze({ x: -0.18, y: 0.58 }),
  weapon_tip: Object.freeze({ x: 0.55, y: 0.7 }), back: Object.freeze({ x: -0.12, y: 0.6 }), overhead: Object.freeze({ x: 0, y: 1.15 }),
});
/** Where a missing anchor falls back to, in order; every chain ends at `feet_ground`. */
export const ANCHOR_FALLBACKS: Readonly<Record<AnchorName, readonly AnchorName[]>> = Object.freeze({
  feet_ground: [], chest: ['feet_ground'], head: ['chest', 'feet_ground'], mouth: ['head', 'chest', 'feet_ground'],
  hand_r: ['chest', 'feet_ground'], hand_l: ['hand_r', 'chest', 'feet_ground'], weapon_tip: ['hand_r', 'chest', 'feet_ground'],
  back: ['chest', 'feet_ground'], overhead: ['head', 'chest', 'feet_ground'],
});

/** The name `name` resolves to among the keys of `table` (its own entry, else the first fallback present), or null. */
export function resolveAnchorName(table: object, name: string): AnchorName | null {
  if (Object.prototype.hasOwnProperty.call(table, name)) return name as AnchorName;
  const chain = ANCHOR_FALLBACKS[name as AnchorName];
  if (!chain) return null;
  for (let i = 0; i < chain.length; i++) if (Object.prototype.hasOwnProperty.call(table, chain[i])) return chain[i];
  return null;
}

/** Common bone names of Spine, DragonBones, Mixamo and Blender rigs, matched case-insensitively. */
export const SKELETON_ALIASES: Readonly<Record<AnchorName, readonly string[]>> = Object.freeze({
  feet_ground: ['root', 'feet', 'ground'],
  chest: ['chest', 'spine2', 'spine_02', 'mixamorig:spine2', 'upperchest', 'torso'],
  head: ['head', 'mixamorig:head'],
  mouth: ['mouth', 'jaw'],
  hand_r: ['hand_r', 'hand.r', 'r_hand', 'righthand', 'mixamorig:righthand', 'hand_right'],
  hand_l: ['hand_l', 'hand.l', 'l_hand', 'lefthand', 'mixamorig:lefthand', 'hand_left'],
  weapon_tip: ['weapon_tip', 'weapon', 'sword_tip', 'blade_tip', 'staff_tip'],
  back: ['back', 'spine', 'spine1', 'mixamorig:spine1'],
  overhead: ['overhead', 'head_top', 'headtop_end'],
});
export interface SkeletonPose {
  /** Bone (or slot) positions in screen px, y down, e.g. a Spine skeleton's bone world positions. */
  bones: Record<string, { x: number; y: number }>;
  feet: { x: number; y: number };
  /** On-screen height of the unit in px. */
  height: number;
  /** +1 when the rig faces right (default), -1 when it faces left. */
  facing?: number;
  /** Extra bone names per anchor, tried first. */
  aliases?: Partial<Record<AnchorName, readonly string[]>>;
}
/** Normalized anchors (facing +x) from a posed 2D skeleton, for `PlayOptions.anchors`. Anchors without a bone are left out. */
export function anchorsFromSkeleton(pose: SkeletonPose): Partial<Record<AnchorName, NormalizedAnchor>> {
  if (!(pose.height > 0) || !Number.isFinite(pose.feet?.x) || !Number.isFinite(pose.feet?.y)) throw new RangeError('Skeleton pose needs feet and a positive height');
  const facing = (pose.facing ?? 1) < 0 ? -1 : 1, lower = new Map<string, { x: number; y: number }>();
  for (const name of Object.keys(pose.bones)) lower.set(name.toLowerCase(), pose.bones[name]);
  const out: Partial<Record<AnchorName, NormalizedAnchor>> = {};
  for (const name of ANCHOR_NAMES) {
    if (name === 'feet_ground') continue;
    for (const alias of [...(pose.aliases?.[name] ?? []), ...SKELETON_ALIASES[name]]) {
      const bone = lower.get(alias.toLowerCase());
      if (!bone || !Number.isFinite(bone.x) || !Number.isFinite(bone.y)) continue;
      out[name] = { x: Math.round((bone.x - pose.feet.x) * facing / pose.height * 1000) / 1000, y: Math.round((pose.feet.y - bone.y) / pose.height * 1000) / 1000 };
      break;
    }
  }
  return out;
}
