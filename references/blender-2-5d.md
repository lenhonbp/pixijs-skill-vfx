# Matching VFX to Blender-rendered sprites

Many 2.5D games render 3D characters in Blender to sprite sheets. Code-drawn VFX look
pasted on unless they use the same camera, the same feet point and the same sun as the renders.
Three numbers fix most of it.

## 1. Get the numbers from Blender

Open the scene the sprites are rendered from, then Scripting tab -> open
`tools/blender_vfx_rig.py` -> Run Script. It prints:

```json
{
  "camera": { "rotationXDeg": 60.0, "orthoScale": 20.0, "renderSizePx": 960 },
  "sun": { "shadowScreenAngleDeg": 25.0, "elevationDeg": 50.0 }
}
```

Set `SPRITE_SCALE` at the top of the script if the game draws the rendered frames scaled
(e.g. 0.5 for half-size). Without Blender access, read them off a render: `rotationXDeg` from
the camera's Rotation X, `shadowScreenAngleDeg` from the direction a character's baked shadow
points on screen (0 = right, 90 = down), `elevationDeg` from how long that shadow is
(shadow length / height = 1 / tan(elevation)).

## 2. Feed them to the kit

```ts
import { rigFromBlender, VfxWorld, anchorAtFeet, unitPoints } from './vfx/kit';

const rig = rigFromBlender(
  { rotationXDeg: 60, orthoScale: 20, renderSizePx: 960 },
  { shadowScreenAngleDeg: 25, elevationDeg: 50 },
);
const vfx = new VfxWorld({ ...layers, groundSquash: rig.groundSquash, shadow: rig.shadow });
```

- `groundSquash = sin(90 - rotationX)`: rings, telegraphs, decals and radial bursts flatten
  exactly like the rendered floor. 2:1 isometric (Rotation X 60) gives 0.5.
- `rig.zPxPerMeter = pxPerMeter * cos(90 - rotationX)`: converts heights in meters to `z`.
  A 1.8 m character is `1.8 * rig.zPxPerMeter` px tall as z; aim hits at `unitPoints(...).chest`.
- `shadow`: ground offset per px of height. `vfx.shadowPoint(pos)` and the `dropShadow`
  recipe put the shadow of a projectile, meteor or jumping unit where the baked sun would.

Perspective cameras: the script estimates `orthoScale` at the camera distance. Squash then
varies across the screen; the value at the center of the play area is close enough for VFX.

## 3. Anchor sprites at the feet

Every recipe takes the ground point under the unit. Render with the character origin between
the feet and export that pixel per frame or per sheet (it is the same pixel when the camera
and origin do not move). Then:

```ts
anchorAtFeet(sprite, footX, footY); // texture px
sprite.position.set(groundX, groundY); // the same (x, y) you pass to VFX
sprite.zIndex = groundY;               // y-sort with body-layer VFX
```

If the sheet has padding/trimming (TexturePacker trim), use the untrimmed frame size the
packer reports or the anchor will drift per frame.

## 4. Sockets for hands, weapons, muzzles

For effects that start from a hand or weapon tip, add an Empty to the bone in Blender, and
export its screen offset from the feet for each facing direction (8 or 16 renders). Store
them as `{ x, y, z }` per direction (x = screen right px, y = ground depth px, z = height px)
and use `socketPoint(feet, sockets, dir)` as the projectile `from` or slash center.

## 5. Light and color

- Effects that are light sources (fire, magic) are additive and are not shaded by the sun.
- Things that are not light (smoke, debris, rocks, ice chunks) should be tinted lighter on the
  sun side: rotate their highlight toward `-shadowScreenAngleDeg`.
- Shadows of effects should use the same darkness as the baked shadows (sample one in the
  render; usually alpha 0.3-0.45 black with normal blending).
- Pre-rendered characters have baked lighting, so a code `hitFlash` (additive white copy of
  the frame) reads well; tint it toward the skill palette for elemental hits.

For reactions on the actual character texture, use [hitSkin and rockBack](extending.md#element-hit-skins-and-rock-back).
They preserve material detail and restore the original tint/pivot; `hitFlash` remains
a separate additive-overlay option.
