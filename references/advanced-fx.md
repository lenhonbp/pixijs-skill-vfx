# Advanced effects: ribbons, curl noise, distortion, bloom, quality tiers

These are the techniques that separate "particles on a canvas" from shipped game VFX. All of
them run on stock PixiJS v7 and v8 (no extra packages) and are optional: the base recipes look
fine without them, and every effect degrades cleanly when a plugin is missing or disabled.

## Ribbon trails (`kit/trail.ts`)

`ribbonTrail(w, { target, width, segments, tint, blend, life, fadeMs, zBias })` draws a
textured triangle strip (`MeshRope` on v8, `SimpleRope` on v7) through the last `segments`
positions of `target()`. One mesh replaces dozens of trail particles and never shows gaps at
high speed.

- Width is the texture height: `ribbonTexture(width)` bakes a tapered, hot-centre strip and
  caches it per width. Pass your own texture for patterned ribbons.
- `stop()` lets the tail catch up and fade over `fadeMs`, so ribbons never pop.
- Used by `projectile` (every bolt has one), `windSlash`, `windWisps`. Good for blade arcs,
  dashes, homing missiles, spirit tails.
- Budget: one mesh = one draw call. Keep it to a handful on screen; use particles for sparkle.

## Curl noise (`kit/noise.ts`)

`curl2(x, y, t)` returns a divergence-free flow: particles following it swirl and fold like
smoke and wind without clumping or draining into sinks, which plain random jitter cannot do.
`curlDrift(strength, scale, speed)` is a ready `onUpdate` for any `spawn` / `stream`:

```ts
w.stream({ rate: 20, make: () => ({ texture: tex.puff, /* ... */, onUpdate: curlDrift(22, 80) }) });
```

`strength` is px/s, `scale` the swirl size in px. Use for smoke, spores, wisps, embers, magic
motes. `noise3(x, y, t)` is a smooth value noise in [-1, 1] for flicker and wobble.

## Screen-space distortion (`Distortion` in `kit/postfx.ts`)

Engine-style refraction: effects draw vector sprites into an offscreen buffer and one
`DisplacementFilter` on your world container reads it. The filter is attached only while
something distorts, so idle cost is zero.

```ts
const distortion = w.use(new Distortion({ renderer: app.renderer, target: camera, width, height }));
distortion.shockwave(w, x, y, radius);          // refraction ring on the ground plane
distortion.haze(() => ({ x, y }), { radius });   // heat haze / wind shimmer that follows a point
```

Recipes call it automatically through `w.plugin(Distortion)`: every `shockwave` (and so every
`explosion`, `slam`, nova) refracts, fire `coneBreath` shimmers, `tornado` warps the air. Put
UI and damage numbers outside `target` so they stay sharp (the demo distorts the camera only).
Positions are screen space inside `target`: use `y - z` for airborne points.

## Bloom (`Bloom` in `kit/postfx.ts`)

The scene renders into a reduced-resolution buffer, a colour matrix keeps only pixels above
`threshold`, a blur spreads them, and the result is added on top. Hot cores glow onto their
surroundings instead of looking like flat stickers.

```ts
w.use(new Bloom({ renderer: app.renderer, source: camera, parent: app.stage, width, height,
                  threshold: 0.66, intensity: 0.75, blur: 8, resolution: 0.35 }));
```

Bloom amplifies additive stacking: if impacts blow out to white with bloom on, lower alpha of
the overlapping glows first (see SKILL.md section 5), then raise `threshold`.

## Quality tiers

`w.density` scales every `burst()` count and `stream()` rate. Combine it with the post FX:

| Tier | `density` | Bloom | Distortion | When |
|---|---|---|---|---|
| High | 1 | on | on | desktop, flagship phones |
| Medium | 0.65 | off | on | default on phones (`pointer: coarse`) |
| Low | 0.4 | off | off | old devices, many units on screen |

The demo starts phones on Medium, caps the renderer resolution at 1.5x on touch devices, and
steps down one tier when frames stay over 24 ms for ~2.5 s. Copy that logic into the game's
settings instead of removing effect layers.

## Plugins

`w.use(plugin)` attaches anything with `update(dtMs)` and `clear()`; it updates with the VFX
clock (dt = 0 during hit-stop) and resets on `w.clear()`. `w.plugin(Class)` finds one, so
recipes can use optional systems without hard dependencies.
