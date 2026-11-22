# lenhon-vfx pack format · version 1

One effect is one pack, with two equivalent delivery formats:

- Plain: `<id>.vfx.json` and its named WebP atlas sheets.
- Container: `<id>.vfxb`, including the same manifest and WebP bytes.

The free collection ships containers for every effect and plain examples for
Fireball and Frost Nova in `docs/format-examples/` (outside the deployed site). All are MIT licensed.
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

Draw layers in array order, normally base then glow. Base contains normal-blend
pixels on transparent; glow contains additive light on black and plays with
additive blending. Frames exclude unit sprites, damage/healing numbers and UI.
Hit-stop and shake are metadata, not baked frozen frames or camera movement.
The free bake uses seeded recipe timing at 30 fps, with separate base/glow scales
(desktop 1.0/0.5 and mobile 0.6/0.36, with per-pack base reductions to fit budgets), drains particles
and timers through the fade, and has a 15-second safety cap (`capped` extension).

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
`category`, `frameCount`, `files: [{name, bytes}]` and aggregate `bytes`.
The showcase index lists only files shipped in this repository, not the factory's
additional plain output. Container and plain examples are alternatives, not
two downloads required by the runtime.
