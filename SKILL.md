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

Ready recipes (see `references/recipes.md` for what each is made of):

- Attacks and impacts (`recipes.ts`): `hitSpark`, `hitFlash`, `slash`, `projectile`, `explosion`,
  `shockwave`, `telegraph`, `meteor`, `lightningChain`, `healAura`, `dropShadow`.
- On-unit status (`status.ts`): `damageOverTime` (poison / burn / bleed with tick numbers),
  `stun`, `freeze` (shatters at the end), `slow`, `root`, `shield` (returns `hit()` / `break()`),
  `statChange`, `shock`, `silence`, `blind`, `armorBreak`, `mark`, `fear`, `aura`, `regen`,
  `haste`, `empower`. All take `target: () => feet` and `height` in px;
  see the [status catalog](references/extending.md#status-catalog) for options.
- Lightning (`thunder.ts`): `lightningStrike` (instant forked sky bolt), `staticField` (ground arcs).
- Movement (`motion.ts`): `dash` (afterimages), `blink`, `leap` (arc + `slam`), `afterimage`, `slam`.
- Channeled / cast (`channel.ts`): `beam`, `coneBreath`, `chargeUp`, `summonCircle`.
- Element shapes (`elemental.ts`): `spike`, `spikeLine`, `spikeRing` (rock or `ice`), `swordRain`.
- Wind (`wind.ts`): `tornado` (travels, pulls, lifts; returns `pos`), `windSlash` (crescent gust
  with ribbons), `vortex` (inward/outward ground spiral), `windWisps` (buff aura), `gustLines`.
- Advanced (`trail.ts`, `noise.ts`, `postfx.ts`): `ribbonTrail`, `curlDrift` / `curl2`,
  `Distortion` (`shockwave`, `haze`), `Bloom`, `w.density` quality tiers. Read
  `references/advanced-fx.md` before using them.
- Feedback: `damageNumber` (`numbers.ts`, baked glyphs, crits pop).
- Sustained effects return a `Handle` (`stop()`, `alive`); build your own with `group()`.

Elements: `WUXING` in `elements.ts` gives the five elements (Kim, Mộc, Thủy, Hỏa, Thổ) with
palette and shape language, plus variants `PHONG` (wind) and `LOI` (lightning); `ELEMENTS` has
all seven. Read `references/elements.md` before designing an element skill.
`examples/skills.ts` has 28 complete skills (15 Wu Xing, 4 wind, 3 lightning, 6 utility) wired
through a small `SkillContext`; copy the closest one. For `defineElement` / `getElement`,
`paletteFrom` / `shiftPalette`, custom recipes and composition, read [Extending the kit](references/extending.md).

2.5D helpers: `rigFromBlender`, `anchorAtFeet`, `unitPoints(x, y, heightPx)` (feet / knee /
chest / head / above), `socketPoint(feet, sockets, dir)`, `vfx.shadowPoint(pos)`.

## 5. Rules that make code-drawn VFX look good

- **Additive glow on white textures.** All kit textures are white; color comes from `tint`.
  Use `blend: 'add'` for light (fire, magic, sparks); `'normal'` only for smoke, shadows,
  scorch marks and dark trails. Add layers stack: a big dim `main` glow + a small bright `core`.
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
- **Sell the 2.5D depth**: anything on the floor uses `layer: 'ground'` + `groundAligned: true`;
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

- Textures are baked once (`createVfxTextures`), never per frame or per cast.
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

Use the draft → contact sheet → look → fix the worst thing → repeat method shared by
[pixelfx](https://github.com/patch-gg/pixelfx), inspired by Hugo Duprez's VFX workflow.
Code is only the draft; the rendered effect is the deliverable.

1. Draft the phases and type-check/build the game.
2. Run `npm run capture -- --skills YOUR-ID,thuy-tidal-beam,kim-sword-rain,tho-mountain-leap --out ~/audit/round-1/`.
   Register new effects in the demo first. Compare at the **same size**, camera and seed against
   two or three named references: Tidal Beam (`thuy-tidal-beam`), Sword Rain
   (`kim-sword-rain`), and Mountain Crash (`tho-mountain-leap`).
3. **Look at the contact sheet**, not just the counts. Check silhouette, release readability,
   depth sorting with units in front/behind, timing, aftermath and distracting pops.
4. Pick the single worst problem, fix it, capture again into the next round directory and
   compare. Do **at least three rounds**; use more for showpieces. Do not call an unseen
   render finished or stop just because the code compiles.
5. Run `npm run check`: it **must pass**. It checks seeded repeat casts, cleanup, pool growth,
   particle budgets and direct unseeded RNG calls. Type-check and build must also pass.
   Existing overages in `tools/check-baseline.json` warn (regressions >5% fail); shrink peaks as skills improve and delete entries when they pass budget.
6. Report what changed visually, the reference skills, round count, contact-sheet paths and
   check results. State plainly if visual inspection could not be done.

### Frame captures

For the kit demo, run `npm install` and `npx playwright install chromium` once, then
`npm run capture -- --skills thuy-tidal-beam,kim-sword-rain --out ~/audit/after/`.
Pass comma-separated IDs (`--skills a,b`) or omit `--skills` for all skills. The harness
builds and serves the demo, seeds randomness, stops the ticker and steps deterministically.
It writes labeled contact sheets and `counts.json` at each skill's length + 1500 ms.
Output defaults to `~/audit/before/`; use the same `--seed` (default 12345) for comparisons.
Inspect the sheets as well as the counts.

## Files

- `kit/` - runtime: `vfx-world.ts` (VfxWorld, curves, physics, ground transform), `textures.ts`
  (procedural textures), `recipes.ts` (effects + palettes), `blender.ts` (camera/sun/feet
  matching for pre-rendered sprites), `ease.ts`, `pixi-compat.ts` (v7/v8 shims).
- `kit/status.ts`, `kit/motion.ts`, `kit/channel.ts`, `kit/elemental.ts`, `kit/numbers.ts`,
  `kit/elements.ts`, `kit/group.ts` - buff/debuff/CC, movement, channeled, element effects.
- `kit/wind.ts`, `kit/trail.ts`, `kit/noise.ts`, `kit/postfx.ts` - wind recipes, ribbon trails,
  curl noise, distortion and bloom.
- `examples/skills.ts` - 28 gameplay-agnostic samples across Wu Xing, wind, lightning and utility.
- `references/extending.md` - custom elements, recolors, phase template, lifecycle and status catalog.
- `references/advanced-fx.md` - ribbons, curl noise, distortion, bloom, quality tiers.
- `references/elements.md` - Wu Xing design language and per-element recipes.
- `tools/blender_vfx_rig.py` - run in Blender to print camera and sun numbers for `rigFromBlender`.
- `references/blender-2-5d.md` - matching VFX to Blender-rendered sprites.
- `references/recipes.md` - what each recipe is made of and how to tune or combine them.
- `references/pixi-v7-v8.md` - API differences that break VFX code between versions.
- `demo/` - showcase app that plays every sample skill (`npm run build`, open `demo/index.html`).
