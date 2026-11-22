# lenhon-vfx pack format · version 1

One effect is one pack, with two equivalent delivery formats:

- Plain: `<id>.vfx.json` and its named WebP atlas sheets.
- Container: `<id>.vfxb`, including the same manifest and WebP bytes.

The free collection ships containers for every effect and plain examples for
Fireball and Frost Nova in `docs/format-examples/` (outside the deployed site). These
legacy two-layer, uniform-scale examples demonstrate compatibility, not the current
collection's quality presets. All VFX packs and format examples are MIT licensed;
the showcase's character artwork is separate and is not covered by that licence.
Only baked output is needed to play an effect. No factory or baker is distributed here.

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

Snapshot verified on 2026-11-22: **25 skills**, each with desktop and mobile
assets, for **50 containers**. All containers are referenced by the 25-entry
index; there are no orphan or missing containers.

| Assets | Bytes |
|---|---:|
| Desktop containers | 57,462,676 |
| Mobile containers | 20,832,436 |
| All containers | 78,295,112 |
| `index.json` | 15,944 |
| Pack directory including index | 78,311,056 |
| Largest desktop: Glacier Path | 3,300,689 |
| Largest mobile: Tornado | 1,304,145 |

Bytes are decimal file sizes, not decoded texture memory or complete page loads.
Every container fits the collection's 4,000,000-byte desktop / 1,500,000-byte mobile
pack limits. The showcase downloads only its selected skill, not this total.
18 desktop and 15 mobile packs use 60 FPS; the others use 30 FPS.

Cold first loads of the built showcase, measured on the same date over a local
uncompressed HTTP server, include code, character artwork, index, selected pack
and HTTP overhead. Desktop viewport was 1440×900; mobile was 390×844 at DPR 3.

| Initial hash | Desktop transfer bytes | Mobile transfer bytes |
|---|---:|---:|
| `#hoa-fireball` (default) | 2,195,377 | 1,444,150 |
| `#hoa-fire-dragon-crossing` | 3,019,015 | 1,622,625 |
| `#thuy-glacier-path` (largest desktop pack) | 3,875,904 | 1,868,189 |

Non-pack overhead was 575,215 bytes in these measurements. The default meets the
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
