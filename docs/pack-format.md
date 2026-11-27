# lenhon-vfx pack format · version 1

One effect is one pack, with two equivalent delivery formats:

- Plain: `<id>.vfx.json` and its named WebP atlas sheets.
- Container: `<id>.vfxb`, including the same manifest and WebP bytes.

The free collection ships containers for every effect and plain examples for
Fireball and Frost Nova in `docs/format-examples/` (outside the deployed site). These
legacy two-layer, uniform-scale examples demonstrate compatibility, not the current
collection's quality presets. The Free collection and these public format examples are MIT licensed;
the showcase's character artwork is separate and is not covered by that licence.
Only baked output is needed to play an effect. No factory or baker is distributed here.
Future Premium deliveries have their own customer terms, announced at release.
The current public catalog contains only the 28 Free effects.

## Manifest

```json
{
  "format": "lenhon-vfx", "version": 1,
  "id": "hoa-fireball", "name": { "en": "Fireball", "vi": "Hỏa Cầu Thuật" },
  "element": "hoa", "category": "attack",
  "fps": 30, "frameCount": 72, "durationMs": 2400, "scale": 0.5,
  "origin": { "x": 0, "y": 0 }, "target": { "x": 360, "y": 0 },
  "anchor": "caster",
  "layers": [
    { "name": "base", "blend": "normal", "sheets": ["hoa-fireball-base-0.webp"],
      "frames": [null, [0, 1, 1, 64, 32, -20, -70]] },
    { "name": "glow", "blend": "add", "sheets": ["hoa-fireball-glow-0.webp"],
      "frames": [null, [0, 1, 1, 100, 64, -40, -100]] }
  ],
  "cues": [
    { "t": 0, "type": "sound", "id": "windup" },
    { "t": 620, "type": "sound", "id": "release" },
    { "t": 900, "type": "hit" },
    { "t": 900, "type": "shake", "amp": 6, "ms": 180 },
    { "t": 900, "type": "hitstop", "ms": 60 },
    { "t": 900, "type": "sound", "id": "impact" }
  ]
}
```

The illustrative frame arrays above are shortened: a real layer has exactly
`frameCount` entries. A frame is `null` (no pixels) or
`[sheetIndex, x, y, width, height, offX, offY]`. Rectangle coordinates are atlas
pixels, while offsets are **world pixels before bake scaling**. The player draws
the rectangle at `1 / (layer.scale ?? scale)`; thus a half-scale atlas preserves world size.
Each layer may supply an optional positive finite `scale`, overriding the pack
scale for its atlas rectangles. Offsets remain world pixels and are never scaled
again. Missing layer scales retain the original v1 behavior. For example a base
layer at `scale: 1.0` and glow layer at `scale: 0.5` retain the same world size
while storing sharp detail and softer light separately. This is a backwards-
compatible manifest extension for this reader; older readers that ignore it
must use packs with uniform scales.
Sheets are at most 2048 × 2048. Filenames resolve relative to the manifest URL.

Origin and target are ground positions in world-pixel frame space. The anchor
(`caster` or `target`) chooses the real unit on which to position the effect's
origin. Offsets preserve baked choreography. Free packs use caster anchoring,
origin `(0, 0)` and reference target `(360, 0)`, including target-area effects.
For target anchoring, author frame offsets relative to that anchor's origin.
Mirror horizontally when the real target is left of the caster; optional
`fitDistance` scales X by real horizontal distance / baked horizontal distance.
Never rotate the effect to aim: that would break the 2.5D projection.

Draw layers in array order; names do not determine blend mode or ordering. Most
free casts use up to three ordered layers: `glow-back` (add), `base` (normal),
then `glow` (add), omitting empty layers. This groups interleaved draws into an
approximation. Stone Skin (`tho-stone-skin`) instead preserves consecutive
same-blend runs in exact draw order (five layers, within its eight-layer cap). The runtime supports arbitrary ordered layer counts,
not only this collection's three-role layout.

### Grayscale ramp mode (optional)

A pack baked with `--mono true` stores each **energy** layer (additive blend) as a luminance mask (`R = G = B = max(r, g, b)`) and flags
it `ramp: true`; material layers keep their colours. An optional `color` object describes how to colour the masks:

```json
"color": { "mode": "ramp", "channel": "value", "ramp": "hoa", "lut": "<base64, 768 bytes>" }
```

`lut` is the pack's native ramp: 256 RGB triples, the mean original colour of every mask level, fitted at bake time. Playing a ramp
layer through it reproduces the baked look; any other 1D ramp (black at 0, hottest colour at 1) restyles it. `ramp` suggests a preset id.
A `ramp` layer must be additive. Readers that do not know `color.mode` should ignore the block and play the layers as they are.
`@lenhonbp/pixijs-vfx-runtime` 1.3 colours ramp layers on the GPU (see its README).

### Ground layers (optional)

Sprites on the factory's `ground` layer that are not part of an impact tier (runes, rings, floor glows, scorch) are kept apart
in layers named `ground-under-*` (`ground-under-glow-back`, `ground-under-base`, `ground-under-glow`) and marked
`"default_z_layer": "background"`. A reader draws such a layer beneath the characters, in its own root, instead of in the
pack's own depth slot, which would paint the decal over their feet. Layers are ordered bottom to top: ground feedback,
ground under, untagged, body residual, hit point. A layer owned by an impact tier takes its depth from the tier and never
carries the field. `background` is the only value a plain layer may use today; a reader should ignore any other string. The field is
additive: `version` stays 1, and readers that ignore it still draw every layer in array order.
`@lenhonbp/pixijs-vfx-runtime` 1.4 places these layers (see its README).

### Ground dissolve colour (optional)

`"ground_dissolve": { "edge_color": "#7a2410" }` gives the rim colour a reader's ground dissolve (noise erosion of expiring
ground layers) burns this pack's decals with, instead of the reader's own colour. Readers without a ground dissolve ignore it.
`@lenhonbp/pixijs-vfx-runtime` 2.3 sets it on `GroundDissolveFilter.edgeColor` while the filter is on that pack. The factory
writes it for every pack with ground layers, from the element's ground palette (Mộc `#3ccf8e`, Hỏa `#7a2410`, Thủy `#4fc3ff`,
Phong `#8ff0d0`, Lôi `#8a7dff`, Kim `#dfe8ff`, Thổ and neutral `#2b231a`), and its QA rejects a pack whose rim is not its
element's or whose ground layers of a cool element (Mộc, Thủy, Phong, Lôi, neutral) carry orange/amber pixels. Runtime 2.4
falls back to the same element rims for packs without the block.

### Impact tiers (optional)

Impact sprites tagged by the factory are kept in their own layers (`hit-point-*`, `ground-feedback-*`,
`body-residual-*`; untagged layers keep `glow-back`, `base`, `glow`) and described by an optional
`impact` object. It is additive: `version` stays 1, and readers that ignore it still draw every layer
in array order. Layers are ordered bottom to top: ground feedback, untagged, body residual, hit point.

```json
"impact": {
  "schema_version": 1,
  "hit_vector": { "x": 1, "y": 0, "angle_deg": 0 },
  "sequence_timing": { "unit": "frames", "fps": 30, "ordered": true,
    "hit_point": { "start_frame": 27, "offset_frames": 0 },
    "ground_feedback": { "start_frame": 27, "offset_frames": 0 },
    "body_residual": { "start_frame": 32, "offset_frames": 5 } },
  "tiers": [{
    "tier": 2, "id": "ground_feedback", "role": "ground-feedback",
    "anchor_type": "ground_center", "anchor_point": { "x": 360, "y": 0 },
    "pivot": "bottom_center", "y_sort": 0,
    "recommended_blend_mode": "ADD", "default_z_layer": "background",
    "start_frame": 27, "layers": ["ground-feedback-glow-back", "ground-feedback-base"]
  }]
}
```

`id` is `hit_point` (tier 1), `ground_feedback` (2) or `body_residual` (3). `anchor_type` is
`contact_normal`, `ground_center` or `body_center`; `anchor_point` is in frame-offset space (origin =
caster's feet, y down), and `contact_normal` tiers add `normal_deg`, the direction back toward the source.
`recommended_blend_mode` (`ADD`, `SCREEN`, `NORMAL`) applies to the tier's additive layers.
`default_z_layer` is `foreground`, `target_overlay` or `background`. `start_frame` values are measured
from the baked frames. A tier's layers exist in `layers`, belong to one tier, and do not draw before its
`start_frame`. A reader should ignore an `impact` object with an unknown `schema_version`.
`@lenhonbp/pixijs-vfx-runtime` 1.2 places and sorts the tiers (see its README).

Normal-blend pixels are stored on transparent; additive light is stored on black
and plays with additive blending. Frames exclude unit sprites, damage/healing numbers and UI.
Hit-stop and shake are metadata, not baked frozen frames or camera movement.
The free collection uses per-skill desktop/mobile scales and quality settings,
with selective 60 FPS for fast casts and 30 FPS elsewhere. Desktop normal scales
reach 1.5 and additive scales 1.25; mobile scales reach 0.75 for both roles.
Both additive roles use the additive scale; exact-order runs use the scale for
their blend mode. Per-pack budget reductions lower only the normal scale, not
additive scale, quality or FPS. Read each loaded manifest's actual layer scales
and FPS rather than assuming one fixed pair of scales or a shared frame rate.
Effects drain particles and timers through the fade, with a 15-second safety cap
(`capped` extension).

Cues use animation-clock milliseconds. Types include `hit`, `shake` (`amp`, `ms`),
`hitstop` (`ms`), and `sound` (`id`). Sound IDs are hints:
`windup | release | impact | buff | debuff | loop-end`. The game chooses audio
and gameplay meaning. Unknown cue types may be forwarded without built-in action.
Additional manifest fields may be ignored by readers.

## Anchors

Optional `anchors` (`schema_version: 1`) describes the cast and hit anchors the
pack was baked with, so a game can line its own character up with the effect.

- `map`: the normalized anchor table, `{ [name]: { x, y } }`. `x` is forward
  along the unit's ground aim and `y` is up from its feet, both in unit heights;
  `feet_ground` is `(0, 0)`. Names: `feet_ground`, `chest`, `head`, `mouth`,
  `hand_r`, `hand_l`, `weapon_tip`, `back`, `overhead`.
- `origin`: the caster anchor the effect leaves from.
- `heights`: unit height in pack px per actor (`caster`, `target`).
- `points`: frame-0 position of every anchor per actor in pack px (origin at
  the caster's feet, y down, height folded into y). Every actor has `feet_ground`.
- `tracks` (optional): `{ [actor]: { [name]: number[] } }`, one `x, y` pair per
  frame (`frameCount * 2` numbers) for anchors that move during the cast.

A missing anchor falls back in order: `mouth` → `head` → `chest`;
`hand_l` → `hand_r` → `chest`; `weapon_tip` → `hand_r` → `chest`;
`overhead` → `head` → `chest`; `head`, `hand_r`, `back` → `chest`; and every
chain ends at `feet_ground`. Runtimes ignore an unknown `schema_version`;
`@lenhonbp/pixijs-vfx-runtime` 1.5 reads the block through `handle.anchor()`
and earlier versions play the pack unchanged.

## LVFX binary container

All integers are unsigned, little-endian. Strings use UTF-8 byte lengths.

| Field | Encoding |
|---|---|
| Magic | 4 bytes, ASCII `LVFX` |
| Version | u8, `1` |
| Flags | u8, bit 0 = scrambled; other bits reserved |
| Reserved | u16, `0` |
| Manifest length | u32 |
| Manifest | UTF-8 JSON bytes |
| Sheet count | u32 |
| Each sheet | u16 name length, name bytes, u32 payload length, WebP bytes |

Only the first 8 bytes are always clear. If flag bit 0 is set, XOR **every byte
after that header**, including lengths, with the following byte stream:

1. Compute 32-bit FNV-1a over the key's UTF-8 bytes (offset `2166136261`, prime
   `16777619`, wrapping 32-bit multiplication).
2. Use the resulting unsigned value as the mulberry32 state.
3. For each payload byte, advance mulberry32 once and take
   `floor(randomFloat * 256)` (equivalently the upper 8 bits of its output word).
4. XOR that stream byte with the payload byte. Decoding repeats the same operation.

The default key is **`lenhon-vfx`**. A custom bake key must be supplied as
`loadKey` to the player. Wrong keys or truncated input fail decoding. This scheme
is **anti-scrape deterrence, not DRM, cryptographic encryption or access control**.
A client necessarily holds enough information to decode it.

## Collection index

`index.json` is an array of entries with `id`, `name: {en, vi}`, `element`,
`category`, `frameCount`, `files: [{name, bytes}]`, `bytes`, `desktopBytes` and
`mobileBytes`. The showcase index lists only shipped desktop `<id>.vfxb` and mobile
`<id>.m.vfxb` containers, not additional plain output. `bytes` equals
`desktopBytes`, not the sum of the two files; each size is an actual container
byte count. Optional `desktopScales` / `mobileScales` map layer names to scales.
The single index `frameCount` is the desktop count. Some mobile casts use a lower
FPS and a different frame count; use the loaded manifest's `fps`, `frameCount`
and `durationMs` for playback. Container and plain examples are alternatives,
not two downloads required by the runtime.

### Current free collection and download sizes

Snapshot verified on 2026-11-23: **25 skills**, with desktop and mobile assets
across their baked directions, for **226 containers** (113 desktop and 113
mobile). All containers are referenced by the 25-entry index; there are no
orphan or missing containers.

| Assets | Bytes |
|---|---:|
| Desktop containers | 272,854,709 |
| Mobile containers | 97,535,753 |
| All containers | 370,390,462 |
| `index.json` | 46,961 |
| Pack directory including index | 370,437,423 |
| Largest desktop: Dragon Breath, 90° | 3,947,129 |
| Largest mobile: Dragon Breath, −45° | 1,443,772 |

Bytes are decimal file sizes, not decoded texture memory or complete page loads.
Every container fits the collection's 4,000,000-byte desktop / 1,500,000-byte mobile
pack limits. The showcase downloads its selected skill and direction on demand,
not this total. Use each loaded manifest's frame rate for playback.

The following historical cold first loads were measured on 2026-11-22 over a local
uncompressed HTTP server, include code, character artwork, index, selected pack
and HTTP overhead. Desktop viewport was 1440×900; mobile was 390×844 at DPR 3.

| Initial hash | Desktop transfer bytes | Mobile transfer bytes |
|---|---:|---:|
| `#hoa-fireball` (default) | 2,195,377 | 1,444,150 |
| `#hoa-fire-dragon-crossing` | 3,019,015 | 1,622,625 |
| `#thuy-glacier-path` (largest desktop pack) | 3,875,904 | 1,868,189 |

Non-pack overhead was 575,215 bytes in these measurements. In that snapshot, the default met the
3,000,000-byte desktop / 1,600,000-byte mobile first-load targets. Deep links to
heavier skills exceed them because the selected pack alone is larger.
Container limits do not guarantee whole-page first-load limits. These are local
measurements, not CDN-compressed transfer sizes or physical-device benchmarks;
remeasure after asset or application changes.

## Actor tracks and playback poses

Optional `actors` is an object with `caster` and/or `target` tracks. Each track
has `frames: [dx, dy, lift, flags][]`, exactly `frameCount` entries. Offsets are
finite screen-space ground pixels relative to that actor's home; lift is height
above ground (render at ground y minus lift). The baker rounds to 0.1 px and
omits unchanged actors. Flags are integers 0–3: bit 0 visible, bit 1 facing flipped.
Malformed lengths, tuples, numbers, flags and unknown actor names are rejected.
This optional field does not change the v1 format; old packs remain valid.

`handle.pose('caster' | 'target')` returns `{ x, y, lift, visible, facing }`
or null when that actor has no track. Numeric values interpolate by the same
playback clock as VFX, including speed, looping and hitstop. Visibility/facing
step at frame boundaries. Coordinates are relative to actor home in the chosen
parent's local space: mirroring reverses x and facing; `fitDistance` scales x
only, matching the runtime's horizontal VFX fit (y/lift are unchanged).
After stop or natural end, each tracked actor returns
`{ x: 0, y: 0, lift: 0, visible: true, facing: 1 }` once, then null.
Untracked actors always return null, including after stop. No pose event is emitted.

```ts
const handle = player.play('kim-golden-edge', { from: home, to: target });
app.ticker.add(() => {
  const pose = handle.pose('caster');
  if (pose) hero.position.set(home.x + pose.x, home.y + pose.y - pose.lift);
});
```
