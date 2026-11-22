---
name: pixijs-skill-vfx
description: Build skill/ability VFX (slashes, projectiles, explosions, AoE telegraphs, lightning, beams, cone breath, heals, shields, buffs/debuffs, damage-over-time, stun/freeze/slow/root, dash/blink/leap, summon circles, damage numbers, Wu Xing five-element skills) drawn in code for 2.5D PixiJS (v7 or v8) HTML5 canvas games. Use when asked to create, improve, port or debug a skill effect, particle effect, hit effect, or "juice" (screen shake, hit-stop, flashes) in a PixiJS game.
---

# PixiJS 2.5D skill VFX

You are building game skill effects that are drawn by code (no artist sprite sheets) in a
PixiJS HTML5 game with a 2.5D (top-down/angled or isometric) camera. This skill ships a small,
tested runtime in `kit/` (works unchanged on PixiJS 7.4 and 8.x) plus recipes for the common
skill types. Use it; do not write a new particle system from scratch.

## 1. Inspect the game first (do not skip)

Before writing any effect, find and note:

1. **Pixi version**: `pixi.js` in `package.json`. v8 needs `await app.init()`, string blend
   modes and the new Graphics API; v7 uses `new Application(opts)`, numeric `BLEND_MODES`,
   `beginFill/lineStyle`. See `references/pixi-v7-v8.md`. The kit hides these differences.
2. **Coordinates**: how a unit's ground position maps to the screen, and whether there is a
   height/jump offset. The kit uses ground point `(x, y)` in screen px plus height `z`; screen
   position is `(x, y - z)`. Isometric tile games convert tile -> screen first, then pass that.
3. **Depth sorting**: which container y-sorts units (`sortableChildren` + `zIndex = y`, or a
   manual sort). VFX that must pass in front of / behind units go in that same container.
4. **Ground squash**: how flattened a circle on the floor looks (the ratio height/width of a
   unit's shadow or a tile). 0.5 for 2:1 iso, usually 0.55-0.75 for angled top-down.
   **If characters are 3D renders from Blender** (pre-rendered sprites), do not guess: get the
   camera Rotation X, ortho scale and sun from the Blender scene with `tools/blender_vfx_rig.py`
   and use `rigFromBlender` for squash, height scale and shadow direction, and anchor sprites at
   the feet. Read `references/blender-2-5d.md` first.
5. **Game loop**: where `app.ticker` (or a custom loop) updates units, and whether there is a
   camera container that moves (needed for shake).
6. **Existing VFX code**: reuse its conventions; if effects already exist, port them onto the
   kit only if asked.

## 2. Install the kit

Copy `kit/` into the game's source (e.g. `src/vfx/kit/`) and wire it once:

```ts
import { VfxWorld, createVfxTextures } from './vfx/kit';

// Use the game's own containers when it has them; otherwise createLayers makes
// ground (decals) / body (y-sorted, put units here) / top (overlays).
const layers = VfxWorld.createLayers(worldContainer);
export const vfx = new VfxWorld({ ...layers, camera: worldContainer, groundSquash: 0.6 });
// Blender-rendered sprites: const rig = rigFromBlender(camera, sun) and pass
// { groundSquash: rig.groundSquash, shadow: rig.shadow } instead (see references/blender-2-5d.md).
export const vfxTex = createVfxTextures(); // bake ONCE, after the renderer exists

app.ticker.add(() => vfx.update(app.ticker.deltaMS));
// Hit-stop: skip unit animation/AI updates while vfx.frozen is true.
```

If the game already has its own y-sorted unit container, pass it as `body` and keep
`zIndex = groundY` on units; the kit sets `zIndex = y + zBias` on its body-layer sprites.

## 3. Design the effect before coding

Write a 5-line brief in a comment above the effect function:

- **Fantasy**: one sentence ("frost blade: cold, fast, brittle").
- **Palette**: `core` (near white), `main` (signature hue), `dark` (falloff/smoke). Use
  `PALETTES` or add one. Never more than one hue family plus white and a dark.
- **Phases with ms timings**: anticipation (cast/windup) -> release -> travel -> impact ->
  dissipation. Impact must be the brightest, fastest moment; dissipation the longest and softest.
- **Layers**: what lies on the ground (rings, decals, shadows), what is in the body layer at
  which height, what goes on top (screen flashes).
- **Gameplay sync**: which frame deals damage (`onHit` callbacks), which units flash.

Timing defaults that feel good: windup 150-400 ms, melee swing 150-250 ms, projectile 500-900 px/s,
impact flash 80-140 ms, hit-stop 40-80 ms (bigger skills longer), shake 3-12 px for 120-350 ms,
smoke/aftermath 0.8-2.5 s.

## 4. Build it from primitives

### Activation tiers and evolution

Use `skillActivation` before a cast and `skillEvolution` for a tier transition.
The [activation contract](references/recipes.md#activation-and-evolution) covers release
scheduling, cast-local world facades and aura ownership. Both one-shots return void;
`empoweredAura` may return undefined. Pass `element` to `empoweredHit` for elemental
material feedback. The demo's `__vfxDebug` helpers require `?debug` in the URL.

Read `references/recipes.md` for the recipe catalog and `kit/recipes.ts` for the code. Start from
the closest recipe, copy it into the game as a named skill function, and tune it. Core API:

```ts
vfx.spawn({ texture, layer, x, y, z, vx, vy, vz, gravity, drag, life, delay,
            alpha, scale, scaleX, scaleY, rotation, spin, tint, blend,
            groundAligned, faceVelocity, stretch, killOnGround, bounce, zBias,
            follow, onUpdate, onDeath });       // one pooled sprite
vfx.burst(n, (i, n) => opts);                    // n at once
vfx.stream({ rate, duration, make });            // continuous (trails, auras), returns { stop }
vfx.after(ms, fn); vfx.addUpdater(dt => ...);    // sequencing, custom motion
vfx.hitStop(ms); vfx.shake(px, ms);              // impact feel
```

Curves (`alpha`, `scale`, ...) accept a number, `[from, to]`, `[from, to, ease]` or `t => value`
(t = 0..1 over life). `tint` takes the same, with colors; `colorRamp(core, main, dark)` gives the
classic hot-to-cold fade, `envelope(in, out, peak)` a fade-in/hold/fade-out alpha.

Choose the closest specialized family; see the [exported API index](references/api.md)
for every public name and the [recipe catalog](references/recipes.md) for options:

- Hỏa: `fireCharge`, `fireball`, `fireBreath`, `fireImpact`, `fireMeteor`,
  `fireDragonCrossing` and its swept `FireDragonContact` callback.
- Mộc: `woodCharge`, `seedFlight`, `springBloom`, `toxicSporeCloud`, `vineBind`/`root`.
- Thủy: `frostNova`, `glacierPath`, `tidalBeam`.
- Lôi: `stormCloud`, `lightningCharge`, `lightningWarning`, `lightningStrike`,
  `lightningImpact`, `lightningStun`, `lightningChain`, `staticField`.
- Phong: `windPressure` (air intake and impact), `windRush` (slipstream step),
  `windSweep`, `windSlash`, `tornado`, `vortex`, `windWisps`, `gustLines`.
- Kim and Thổ: `swordSalute`, `swordRain`, `metalSlash`, `metalSparks`, `goldenBell`,
  `spikeLine`, `stoneArmor`, `mountainCrash`. Summons can use `spiritGuardian`.
- Shared: generic impacts/projectiles, movement, channels, `floorRing`, numbers and
  [statuses](references/extending.md#status-catalog). Use `group` for owned lifetimes.
- Synchronization: `SkillTiming`, `hitTimes`, `onHits`, `hitSkin`, `rockBack`;
  see [timing and reactions](references/extending.md#skill-timing).
- Advanced: ribbons, noise, distortion, bloom and quality tiers;
  see [advanced effects](references/advanced-fx.md).
- Utility: `sigilCharge`, `sunderingMark`, `battleCry`, `shadowStep`, `shadowSlash`,
  `hexField`, `frailty`, `projectile({ seal: true })`; swept `summonCircle` and bottom-up
  guardian reveal/upward dissolve. `FloorRingOptions.sweep(t)` preserves split occlusion;
  `VfxTextures.skull` is a tintable 64×72 weakened glyph. Keep timing, uses and docs in step;
  status contacts use `SkillHit.effectOnly`, not gameplay damage. See
  [utility composition](references/recipes.md#utility-composition-and-timing).

Elements: `WUXING` in `elements.ts` gives the five elements (Kim, Mộc, Thủy, Hỏa, Thổ) with
palette and shape language, plus variants `PHONG` (wind) and `LOI` (lightning); `ELEMENTS` has
all seven. Read `references/elements.md` before designing an element skill.
`examples/skills.ts` has 29 complete skills (16 Wu Xing, 4 wind, 3 lightning, 6 utility) wired
through a small `SkillContext`; copy the closest one. For `defineElement` / `getElement`,
`paletteFrom` / `shiftPalette`, custom recipes and composition, read [Extending the kit](references/extending.md).

2.5D helpers: `rigFromBlender`, `anchorAtFeet`, `unitPoints(x, y, heightPx)` (feet / knee /
chest / head / above), `socketPoint(feet, sockets, dir)`, `vfx.shadowPoint(pos)`.

## 5. Rules that make code-drawn VFX look good

- **Blend by material.** Use `blend: 'add'` for light (fire, magic, sparks) and
  `'normal'` for solid matter: metal, rock, ice, leaves, vines, smoke, shadows and scorch.
  Many light textures are white and tinted; material textures can have baked colors.
  Additive light reads as a dim `main` glow with a small bright `core`.
- **Additive light saturates to white when it stacks.** Keep big overlapping additive puffs at
  low alpha (0.3-0.5) and tint them `main` -> `dark`; only small, short cores use `core`.
  If the impact reads as a white blob, lower alpha/size before touching color.
- **Smoke is not mud**: draw it with normal blend behind the fire (lower `zBias`), start it as
  the fire fades (`delay`), keep it thin (alpha <= 0.35) and cool grey, and let it rise.
- **Value contrast beats saturation.** Every effect needs a white-hot center and a dark or
  transparent falloff. Effects read against the floor, so check them on the game's real background.
- **Shape language per element**: fire = puffs rising (`vz` up, `drag`), ice = `shard`s and sharp
  stops, lightning = jagged `beam`s that flicker, holy = `star`s and vertical columns,
  nature/heal = slow rising motes with sway, arcane = rings and orbiting dots.
- **Easing**: things burst out fast and settle slow (`outCubic`/`outExpo` on scale, `inQuad` on
  alpha fade). Linear motion looks cheap. Overshoot (`outBack`) for pops and UI-like buffs.
- **Randomize every particle** (`rand`) in speed, life, size and angle; never spawn identical copies.
- **Sell the 2.5D depth**: ordinary floor effects use `layer: 'ground'` + `groundAligned: true`;
  unit-centered rings use [floorRing](references/recipes.md#floor-rings-around-units)
  so the near half can sort in the body layer;
  airborne things cast a shadow on the ground (`dropShadow`, offset by the sun via `shadow`); debris uses `gravity` and dies or
  `bounce`s at z = 0; horizontal velocities are multiplied by `groundSquash` on the y axis.
- **Sort correctly**: effects at a unit's position use `layer: 'body'` (default) so units in
  front cover them; use `zBias` (+/- a few px) to force in front of the caster or target. Full
  screen flashes go on `top`.
- **Impact = 3 things at once**: flash + particles + feedback (hit-stop, shake, `hitFlash` on the
  target). Scale them with the skill's power; small hits get no shake.
- **Telegraph enemy AoE on the ground** before it lands (`telegraph`), filling over the cast time.
- **Choreograph the release**: a 1–2 frame white hero frame gives the eye a clean peak;
  follow it with many small events varied in size, speed, timing and lifetime, not a uniform burst.
- **Landings have consequences**: kick up dust; landed fire keeps burning briefly (a blaze).
  Debris tumbles, bounces, settles and fades rather than vanishing in flight.
- **Leave readable aftermath**: hits last roughly 0.3–0.8 s; big effects linger 2–4 s.
  Keep the peak short and let secondary motion decay, rather than holding everything at full strength.

## 6. Performance budget (mobile H5)

- Bake the shared set once with `createVfxTextures`. Specialized fire, dragon, wood and
  water sets are cached lazily on first use; prewarm those caches if first-cast allocation
  matters. Reuse textures, never regenerate them per frame. See [texture sets](references/recipes.md#texture-sets).
- Never create `Graphics`, `Text` or filters per particle or per frame. No `BlurFilter` / glow
  filters on particles; fake glow with the `glow` texture.
- Sprites are pooled by the kit; keep `maxParticles` (default 1500). One skill should stay under
  ~150 live particles, a screen-filling ultimate under ~600. Lower counts on low-end devices
  (scale `burst` counts with a quality setting rather than removing layers).
- Additive overdraw is the real cost: prefer fewer, bigger, shorter-lived glows over many large ones.
- Effects that loop (auras, buffs) must return a handle and be stopped when the buff ends or
  the unit dies. Call `vfx.clear()` on scene change.
- Scale with a quality tier, not by deleting layers: `w.density` (1 / 0.65 / 0.4) plus Bloom and
  Distortion on/off (`references/advanced-fx.md`). Cap renderer resolution at ~1.5 on phones.
- Post FX cost one extra offscreen render each; attach them once at startup, never per skill.
- On v8 with >2000 tiny particles, consider `ParticleContainer`; otherwise the kit is enough.

## 7. Iterate until it reads

Draft, capture, inspect, fix the worst problem and repeat. Compare at game zoom against
Tidal Beam (`thuy-tidal-beam`), Sword Rain (`kim-sword-rain`) or Mountain Crash
(`tho-mountain-leap`) with the same seed and camera. Do at least three visual rounds;
counts alone do not establish readability. Report reference skills, round count and
contact-sheet paths, and state plainly if visual inspection was not possible.

Run `npm run check:docs`, `npm run typecheck`, `npm run build` and `npm run check`.
The [verification guide](references/extending.md#verification-and-reproducibility) is
the canonical source for setup, capture flags, checkpoints, budgets and test commands.

## Files

The [API index](references/api.md) lists each barrel export. This map includes internal
modules too; copy all of `kit/`, not just selected recipe files.

### Runtime

| File | Purpose |
|---|---|
| `kit/index.ts` | public export barrel; canonical name index in references/api.md |
| `kit/vfx-world.ts` | pool, curves, physics, world clock, layers and cleanup ownership |
| `kit/textures.ts` | shared procedural texture set and feature metrics |
| `kit/recipes.ts` | generic attacks, impacts, telegraphs, healing and palettes |
| `kit/ease.ts` | curves, interpolation and seeded random helpers |
| `kit/pixi-compat.ts` | Pixi v7/v8 shims |
| `kit/blender.ts` | camera, sun, feet anchors and sockets |
| `kit/group.ts` | owned lifetimes and fade cleanup |
| `kit/elements.ts` | built-in elements and custom registry |
| `kit/palette.ts` | palette construction and shifts |
| `kit/activation.ts` | activation and evolution one-shots, cast-local tier feedback |
| `kit/skill-timing.ts` | timing metadata and hit scheduling |
| `kit/hit-reaction.ts` | sprite hit skins and pivot recoil |
| `kit/floor-ring.ts` | depth-split unit floor rings |
| `kit/numbers.ts` | baked-glyph floating numbers |
| `kit/status.ts` | buff, debuff, CC and DoT visuals |
| `kit/motion.ts` | dash, blink, leap, slam and afterimages |
| `kit/channel.ts` | generic beam, breath, charge and summon circles |
| `kit/elemental.ts` | rock/ice spikes and sword rain |
| `kit/metal.ts` | metal cuts, sparks and sword salute |
| `kit/metal-surfaces.ts` | steel/bronze material builders and bell fragments |
| `kit/bell.ts` | cast-bronze bell ward |
| `kit/stone-armor.ts` | attached rock plates |
| `kit/mountain-crash.ts` | falling mountain impact |
| `kit/spirit-guardian.ts` | flying spectral summon |
| `kit/vine-bind.ts` | thorned binding vines |
| `kit/thunder.ts` | clouds, charge, warnings, strikes, fields and electrical control |
| `kit/lightning-bolt.ts` | direct-module ribbon bolt primitive |
| `kit/fire.ts` | specialized fire recipes and crossing dragon |
| `kit/fire-textures.ts` | lazy flame, smoke, scorch and meteor cache |
| `kit/fire-dragon-textures.ts` | lazy dragon head/coil cache |
| `kit/wood.ts` | specialized seed, bloom and spore recipes |
| `kit/wood-textures.ts` | lazy colored vegetation cache |
| `kit/water.ts` | specialized ice and torrent recipes |
| `kit/water-textures.ts` | lazy crystal, frost and foam cache |
| `kit/wind.ts` | wind cuts, funnels, vortices and wisps |
| `kit/trail.ts` | following and parametric mesh ribbons |
| `kit/noise.ts` | value noise and curl drift |
| `kit/postfx.ts` | optional distortion and bloom plugins |

### Examples, demo and references

- `examples/skills.ts` — 29 gameplay-agnostic samples and the sample context/types.
- `demo/main.ts`, `demo/index.html`, `demo/preview.png` — interactive showcase, controls and preview; `demo/demo.js` is generated by build.
- `references/api.md` — canonical public export index and direct-module import boundaries.
- `references/recipes.md` — recipe options, floor rings, texture sets and canonical activation contract.
- `references/extending.md` — custom elements, recoloring, timing, reactions, canonical status catalog and verification instructions.
- `references/elements.md` — element shape/material language and matching samples.
- `references/advanced-fx.md` — ribbons, noise, post effects and quality tiers.
- `references/blender-2-5d.md` — Blender projection, anchors, sockets and lighting.
- `references/pixi-v7-v8.md` — compatibility notes.
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` — root skill and marketplace registration.
- `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml` — commands, type checking, validation and demo deployment.

### Tools

`npm run check` does not run every regression script. Unless noted otherwise, run a test
with `node tools/NAME.mjs`; browser tests require Playwright Chromium. See the
[verification guide](references/extending.md#verification-and-reproducibility).

| File | Purpose | Run by npm run check? |
|---|---|---|
| `tools/check.mjs` | Seeded lifecycle, pool, RNG, budget, tier and Sword Rain contracts | Entry point |
| `tools/check-baseline.json` | Existing particle overages; regressions fail | Read by check |
| `tools/capture-frames.mjs` | Deterministic contact sheets and counts; npm run capture | No |
| `tools/check-docs.mjs` | Export coverage, file map and sample-count gate; npm run check:docs | No; separate CI step |
| `tools/blender_vfx_rig.py` | Run in Blender to print camera/sun values | No |
| `tools/test-activation.mjs` | tier facade isolation, density and aura cleanup | No |
| `tools/test-fire-dragon.mjs` | swept dragon contacts, burn ticks and collision misses; exports checkFireDragon(browser) | Yes; imported helper, not a standalone runner |
| `tools/test-floor-ring.mjs` | depth, following, mask cleanup and WebGL seam/occlusion pixels | No |
| `tools/test-hit.mjs` | hit-skin restoration, replacement and recoil transforms | No |
| `tools/test-lightning.mjs` | bolt ribbons, storm canopy, charge, warnings and fields | No |
| `tools/test-loi.mjs` | element registry, palettes and lightning contracts | No |
| `tools/test-spirit-guardian.mjs` | flight, weapon grip, contact timing, retargeting and summon AoE | No |
| `tools/test-status.mjs` | status lifecycles, bell, armor, guardian, spikes, swords and vines | No |
| `tools/test-timing.mjs` | nominal timing, feedback and sample damage windows | No |
| `tools/test-wood.mjs` | vegetation cache, seed flight, bloom/spore timing and cleanup | No |
| `tools/test-docs.mjs` | documentation checker normal, empty, alias, cycle and error cases | No; run with node --test |
