# Recipe catalog

Recipes are exported from `kit/index.ts` and implemented in the modules below. Most take
ground coordinates `(x, y)` plus height `z`, and a `Palette` (`{ core, main, dark }`). Copy the closest one and change it; recipes are examples,
not a framework to extend with options. The [API index](api.md) covers every barrel export.

| Recipe | Layers it builds | Typical use | Key knobs |
|---|---|---|---|
| `hitSpark` | small core glow, spinning star, 8 streaks in a cone | every hit, crits (size 1.5+) | `angle` (away from attacker), `size`, `coreAlpha` (default 1; 0 omits core glow but retains star/streaks) |
| `hitFlash` | additive copy of the target's texture fading out | target feedback | `ms`, `color` (red for damage, green for heal), `opacity` (default 1) |
| `slash` | dark smear + main crescent + white edge, all ground-aligned at chest height, sparks off the end | melee swings, dash cuts | `angle` facing, `radius`, `sweep`, `duration`, `clockwise` |
| `projectile` | glow + core following an arc, ribbon + ember trail, ground shadow; `seal: true` substitutes a spinning rune head and chain links | fireball, arrow, sealing rune | `ProjectileOptions`: `speed`, `arcHeight`, `size`, `alpha` (default 1), `seal`, `onHit` |
| `shadowSlash` | crossed dark ink crescents, violet-white edges, tiny local flash and sparks | shadow melee contact | `ShadowSlashOptions`: position, `facing`, `height`, `palette`; returns void |
| `explosion` | top flash, additive fire puffs, normal-blend smoke, gravity sparks, shockwave, scorch decal, shake + hit-stop | AoE impact, fireball hit | `radius`, `shake`, `hitStopMs`, `smoke` |
| `shockwave` | two expanding ground rings + screen refraction when `Distortion` is attached; optional depth-split halves | slams, landings, nova | `radius`, `duration`, `around` (unit feet; opts into split rings) |
| `floorRing` (`floor-ring.ts`) | far arc in ground, near arc in y-sorted body | rings that encircle a unit | `radius`, `palette`, `around`, `duration`, alpha/scale curves, `texture`, `spin` |
| `telegraph` | pulsing ground ring, faint area, fill that grows over the cast | enemy AoE warnings, cast bars on the ground | `radius`, `duration`, `onDone`, `finishAlpha` (0 disables the finish flash) |
| `meteor` | `telegraph` -> `projectile` from the sky -> big `explosion` | ultimates; shows composition | `radius`, `castMs` |
| `lightningChain` | forked ribbon bolts, staggered hops, restrained impact sparks and afterglow | chain lightning, tethers | `points`, `flickers`, `width`, `impactIntensity` (default 1), `hopMs` (default 40) |
| `lightningStrike` (`thunder.ts`) | cloud-to-ground forked bolt, flash, scorch and sparks | instant impact; caller supplies warning | `x`, `y`, `palette`, `radius`, `delay`, `onHit`, `cloud`, `height`, `hitStop`, `shake`; see [Loi helpers](#loi-lightning) |
| `staticField` (`thunder.ts`) | storm canopy, ground channels, rim sparks and strikes toward targets | sustained lightning AoE; returns handle | `x`, `y`, `radius`, `palette`, `duration`, `onTick` (every 500 ms), `targets`, `cloud`; see [Loi helpers](#loi-lightning) |
| `healAura` | ground pad + shrinking rings, vertical column glow, rising swaying motes, some stars | heals, buffs, auras (return handle) | `target` (follow fn), `radius`, `duration` |
| `damageNumber` | baked outlined digit sprites in `top`, pop scales glyph spacing as well as size | every hit/heal/tick | `value`, `color`, `crit`, `size`, `duration` (ms; default 850, 1100 for crits); place `z` above any health bar |
| `dash` | afterimages of the unit sprite, speed lines, dust | dash, charge | `sprite`, `duration`, `onMove`, `onEnd` |
| `blink` | implode + light column at `from`, faint trail, column + burst at `to` | teleport, shadow step | `gapMs`, `onVanish`, `onAppear` |
| `leap` / `slam` | dust, airborne shadow, trail; slam: shockwave, cracks, dust ring, rock debris, shake | jump attacks, ground pound | `arc`, `duration`, `radius`, `onLand` |
| `beam` | laser: stacked beams, motes and end glows; water: rolling puffs, droplets, splash spray, foam rings and wet ground glow | lasers, water jets, drains | `from`, `to` (functions), `width`, `duration`, `style: 'laser' \| 'water'`, `impactSparks` |
| `coneBreath` | puffs fanned along a moving angle, element bits (embers/shards/leaves), lit ground | dragon breath, frost spray, poison spray | `style`, `range`, `spread`, `angle()` |
| `chargeUp` | streaks converging on a point, growing glow, shrinking rings, release flash | any windup | `duration`, `onDone`, `release: { color, size, coreSize, alpha }` (optional; defaults unchanged) |
| `sigilCharge` (`status.ts`) | rotating hand rune, contracting ring, optional closing crosshair | visible caster windup | `SigilChargeOptions`: `target`, `palette`, `duration`, `reticle` |
| `sunderingMark` (`status.ts`) | dropping reticle, armor fracture/cracks, bouncing metal shards and orange sparks, cracked emblem and crumble | armor debuff | `SunderingMarkOptions`: `target`, `height`, `palette`, `duration`, `onImpact` (at 260 ms, replaces default stop/shake) |
| `hexField` (`status.ts`) | open expanding violet rune, green line glow and curling dark tendrils | area curse release | `HexFieldOptions`: position, positive `radius`, `palette`, `duration` (default 2300); invalid radius throws |
| `frailty` (`status.ts`) | rising shadow bindings, downward pulse and muted chevrons, sickly drips/skull, sinking fade | weakened status | `FrailtyOptions`: `target`, `height`, `palette`, `duration`, `sprite` (optional recoil), `onImpact` (at 240 ms; replaces recoil, may return an owned reaction Handle) |
| `battleCry` (`channel.ts`) | braced inward breath, three chest roar arcs, ground shockwave/dust, one flame-and-ember rune | war cry buff | `BattleCryOptions`: `target`, `height`, `facing`, `palette`, `sprite`, `windup` (340), `duration` (2800); reuses attached Distortion |
| `shadowStep` (`motion.ts`) | dark pools/tendrils with violet edges, curling ground smoke/glints, arrival smoke and afterimages | shadow teleport; slash/damage supplied by caller | `ShadowStepOptions`: `from`, `to`, `palette`, `height`, `sprite`, `windup` (260), `travel` (160), `onVanish`, `onAppear` |
| `summonCircle` | split gold rune sweep, four lifting glyphs, sparse motes, focused pillar and closing circle | summons, portals | `SummonCircleOptions`: position, `palette`, `radius`, `duration`, `linger` (hold after release, default 700), `columnAlpha` (default 0.7), `onSummon` |
| `spiritGuardian` (`spirit-guardian.ts`) | bottom-up masked reveal with rising gold motes/edge; levitating approach and separate grip-pivoted halberd cleave, sweep and dive-slam; upward edge dissolve | visible summoned attacker; damage stays in caller | `SpiritGuardianOptions`: position, `palette`, `height?` (100), `target?: () => Vec3` (feet, re-read per strike), `strikes?` (3), `slamRadius?` (1.1 × height; match gameplay radius), `onStrike?(i, at)` (at contact pose), `facing?` (±1). No target: idle with `duration?` hold (1200). Reveal 350 ms, glide 650 ms, 650 ms per strike (contact at 48%), dissolve 450 ms; returns Handle |
| `mountainCrash` (`mountain-crash.ts`) | craggy solid mountain forms overhead, slams base-first, cracks the ground, bursts into falling boulders and fading rubble | Mount Tai crushing attacks | `x`, `y`, `radius`, `palette`, `height` (peak height, default 160), `delay` (before formation), `onHit` (once, 320 ms after formation starts); returns Handle. Pair with `leap({ impact: false })` to avoid a duplicate landing slam |
| `spike` / `spikeLine` / `spikeRing` | lit spikes that rise, hold and sink, crater, debris, dust; `ice` variant | earth fissure, ice path, frost nova | `count`, `spacing`, `height`, `onSpike` |
| `swordRain` | gold-hilted steel blades accelerate down, dig into cracked ground and settle amid sparks and glints | metal ultimates | `radius`, `count` (gameplay impacts; quality-scaled cosmetic swords add density without extra callbacks), `height` (unit height, default 70; blades about as tall as the unit), `duration`, `palette`, `onImpact` |
| `swordSalute` | steel swords rise in staggered order, hover above soft shadows, gather and launch | metal windups | `at` (follow fn), `height`, palette, motion duration, optional `aimAt` (target follow fn) and extra `hoverHold` (ms) |
| `metalSlash` / `metalSparks` (`metal.ts`) | solid sword and narrow gold-edged cut; ballistic contact sparks | crossing metal cuts, struck metal | `angle`, `span`, `palette`, `reverse` for cuts; palette, count, angle and size for sparks |
| `tornado` | sheared funnel with layered mist, carried leaves/rocks and a travelling dust skirt | tornado, cyclone, pull + lift CC | `at`, `to`, `height`, `radius`, `duration`, `onTick(pos)`, `tickMs` |
| `windPressure` | curved air sheets and ground dust gather inward or fan out in a sector | windup, impact, landing | `at`, `angle` (ground radians), `radius`, `spread` (radians), `duration`, `inward` |
| `windRush` | ground step with ankle and shoulder trails, displaced dust and optional motion ghosts | dash-in, haste showcase | `from`, `to`, `height`, `duration`, `sprite`, `onMove(pos)`, `onEnd`; move your unit in `onMove` |
| `windSlash` | banking crescent with twin wakes; its tip reaches the target at impact | wind blade, sonic slash | `from`, `to`, `size`, `speed`, `onHit` |
| `windSweep` | staggered cuts that open outward without forming a full ring | spin attacks, blade release | `target` (follow fn), `angle`, `radius`, `height`, `duration` |
| `vortex` | curved ground eddies and detached dust that spiral in or out | pulls, wind fields, spin attacks | `at` (point or fn), `radius`, `inward` |
| `windWisps` | suspended wisps orbit a unit and stream behind its facing direction | haste, tailwind, wind aura | `target`, `radius`, `height`, `facing`, `duration` |
| `gustLines` | burst of horizontal speed lines along a ground angle | knockback, dash, tailwind | `angle`, `count`, `spread` |
| `ribbonTrail` | rope mesh through the target's recent positions | any fast mover (see advanced-fx.md) | `width`, `segments`, `tint`, `fadeMs` |

## Utility composition and timing

All utility functions and option interfaces above are exported through `kit/index.ts`.
`createVfxTextures()` includes `VfxTextures.skull`: a tintable 64×72 hollow-eyed,
fractured-jaw glyph used by Frailty. Bake once, reuse it, and destroy with the texture set.
The seven new recipes are `sigilCharge`, `sunderingMark`, `hexField`, `frailty`,
`battleCry`, `shadowStep` and `shadowSlash`; seal projectiles, silence/armor fractures,
summon-circle sweeps and guardian reveal/dissolve extend existing recipes.

The six neutral samples retain a 150-live-particle budget and seeded randomness. Timings
below are nominal VFX-clock ms (frame rounding/hit-stop can shift rendered frames):

| Sample | Windup/release | Declared contacts |
|---|---|---|
| Silencing Seal | 300 ms hand sigil | `300 + hand-to-target distance / 950 × 1000`; projectile `onHit` owns status application |
| Sundering Mark | 300 ms reticle charge | Fractures at 560, 740, 920 ms for three targets (`hitTimes` schedules each reticle 260 ms early) |
| War Cry | 340 ms brace | 340 ms roar/shockwave and local shake, no damage |
| Shadow Step | 260 ms gather, 160 ms passage | Slash at 480 ms, `onHits` damage at 580 ms, relative to actual arrival |
| Curse of Frailty | 350 ms hand sigil/hex release | Downward binding pulses at 850, 990, 1130 ms (`hitTimes` schedules growth 240 ms early) |
| Summon Guardian | 1200 ms circle, 200 ms summon delay | Contact-pose callbacks at 2712, 3362, 4012 ms; final slam uses radius-filtered targets |

Seal, Sunder, War Cry and Frailty contacts are `SkillHit.effectOnly`, not damage/healing
calls. Sunder/Frailty rebuild staggered opportunities for the actual target count; their
static metadata describes the three-enemy showcase. The existing activation dispatcher
waits for `activationRelease(tier)`, then gives each cast its own `empoweredWorld`;
the recipe's own windup follows and delayed callbacks retain that facade.
Continue using the supplied world rather than adding per-cast postfx
plugins. War Cry's shockwave uses the demo's already attached Distortion.

`node tools/test-utility.mjs` checks these contacts and callback/cancellation contracts;
`node tools/test-timing.mjs` checks damage timings and declared stop/shake feedback.

## Floor rings around units

`FloorRingOptions.sweep?: (t: number) => number` clips both halves with one clockwise
angular reveal (normalized particle age and reveal fraction 0–1). Use `sweep: t => t`
to draw a rune, or return a falling fraction to close it. Split occlusion and cleanup
remain intact; the helper owns and destroys its sweep masks.

Use `floorRing` rather than a single ground sprite when the unit should stand **inside**
a ring. The far half (screen y < center) stays in `ground`; the near half is ground-aligned
in `body` at `center.y + 0.1`. It draws over the center unit's feet but behind a foreground
unit with a larger ground y. Put characters in the sortable body layer with zIndex = feet.y.
Do not use the top layer or sort the near half at the front edge of the ellipse.

```ts
const ring = floorRing(w, tex, {
  around: () => unit.feet, radius: 32, palette: element.palette,
  duration: 1200, alpha: [0.7, 0],
});
// Or use fixed ground coordinates: { x, y, radius, palette, ... }.
// ring.stop() cancels both halves; w.clear() also removes their masks.
```

`around` follows ground x/y and ignores airborne height. With it, optional x/y are offsets
from the target, not absolute coordinates. `duration` defaults to 380 ms; Infinity lasts
until stopped. Zero radius/nonpositive duration is an inert handle. Invalid radius,
duration or texture radius throws; insufficient particle budget draws neither half.

The helper accepts existing `alpha`, `scale`, `scaleX`, `scaleY`, `rotation`, `spin`,
`blend`, `tint`, `delay` and `onUpdate` particle options. An explicit scale overrides
`radius / textureRadius`; `textureRadius` defaults to 120 (the standard ring). For runes,
use `texture: tex.rune, textureRadius: 236`. Both halves use the same full texture with
complementary, axis-aligned stencil masks, so even rotating, nonuniform runes have no gap
or doubled-bright seam. `onUpdate` runs per half; keep gameplay side effects outside it.

The handle exposes `far` and `near` particles (nullable when nothing was spawned). For a
sustained recipe's fade-out, add each to its group with `g.add(ring.far)` and
`g.add(ring.near)`. Masks follow during the fade and are destroyed when particles die.
Avoid retaining these pooled particle references after they die. The helper owns mask
cleanup and does not destroy shared textures.

Shield, aura, regen, haste, empower, healing rings, Golden Bell's lip/slam, staticField,
summon runes, freeze-shatter and stat-change rings use the split. Stone Armor has no
separate floor ring; its sample's defense-up statChange ring gets the same treatment.
`shockwave({ around: targetFeet, ... })` opts into split unit-centered rings; without
`around`, ordinary area impacts and non-unit rings retain their existing ground layering.
The War Cry sample is unchanged: its kit-level aura/haste/empower rings are split, while
its outgoing area shockwave stays ground-only.

See [verification](extending.md#verification-and-reproducibility) for the floor-ring
pixel/depth regression command and other focused tests.

## Status effects

The [status catalog](extending.md#status-catalog) is the canonical list of CC, buffs,
debuffs, DoTs, bell and armor wards, including their options, handles and cleanup.
Do not infer gameplay restrictions from visuals; your game owns those systems.

## Making a new skill

`beam` defaults to `style: 'laser'`, preserving the narrow luminous beam. Use
`beam(w, tex, { from: hand, to: chest, palette, style: 'water', width: 1.1, duration: 1500 })`
for a wider blue torrent: normal-blended puffs roll along the moving endpoints, droplets
flow downstream, and spray and expanding foam rings mark the target above a wet ground glow.
`width` scales the body and spray; `impactSparks: false` disables the water style's target
spray and foam rings (or the laser style's sparks). Both return the same handle, stop their streams on `stop()`, and
let finite droplets dissipate naturally.

1. Brief it (fantasy, palette, phases in ms, layers) as described in SKILL.md section 3.
2. Compose: most skills are `windup` + `travel` + `impact` + `aftermath`, chained with
   `vfx.after` or the `onHit` / `onDone` callbacks.
   - Windup ideas: particles converging on the caster (spawn on a circle with velocity toward
     the center, `life` = distance / speed), a growing `glow` at the hand, a ground `telegraph`.
   - Travel: `projectile`, a dash trail (`stream` of the unit's own texture tinted, alpha fading
     = afterimages), a `beam` stretched from caster to target.
   - Impact: `hitSpark` / `explosion` / `shockwave` + `hitFlash` + hit-stop + shake.
   - Aftermath: smoke, embers, a decal on the ground that fades over 1-3 s.
3. Element variants should change shape and motion, not only the palette (see SKILL.md section 5).
   An ice version of `explosion`: swap puffs for `shard` particles (`faceVelocity`, no `drag`,
   short life), a white `ring`, no smoke, frost decal in `ice.main` at low alpha.

## Patterns

- **Moving source**: pass `follow: () => ({ x: unit.x, y: unit.y, z: 40 })`; the particle's own
  velocity becomes an offset from it. For trails, do NOT follow: spawn at the current position
  so particles stay behind.
- **Orbit**: `onUpdate: (p, t) => { p.px = Math.cos(a + t * 8) * r; p.py = Math.sin(a + t * 8) * r * vfx.groundSquash; }`
  with `follow` on the unit; set `p.o.zBias = p.py` in the same `onUpdate` so the back half sorts behind the unit.
- **Converge (charge-up)**: spawn on a ring of radius r with `vx = -cos(a) * r / (life / 1000)`.
- **Afterimage**: `vfx.spawn({ texture: unit.texture, blend: 'add', tint: palette.main, alpha: [0.6, 0], life: 250, anchorY: <unit anchor>, x: unit.x, y: unit.y })` every 30 ms during a dash.
- **Beam**: `texture: tex.beam, anchorX: 0, rotation: atan2(dy, dx), scaleX: len / 64` in screen
  space (put `y` = ground y of the lower end and `z` = groundY - screenY so it sorts).
- **Damage sync**: deal damage in the recipe's `onHit` / at the same `vfx.after` as the impact,
  never on a separate timer, so hit-stop keeps them in sync.

## Activation and evolution

`skillActivation(w, tex, { at, height, palette, element?, tier, duration? })` follows caster
feet live. Cơ bản (1): unchanged sigil, motes, chest light. Thức tỉnh (2) uses a
lighter version of Tiến hoá (3)'s element motif, with stronger tier-3 shake/hit-stop.
Tiers 2/3 replace the shared rune/wisps and chest light with
behind-caster layers; the main-coloured release pillar has alpha <=0.16.
Start gameplay immediately at tier 1, or after `activationRelease(tier)` (250/400 ms).
`duration` remains accepted for compatibility but has no effect; use `empoweredAura`
for a sustained remnant rather than stacking extra activation floor overlays.

`skillEvolution(w, tex, { at, height, palette, element?, fromTier, toTier })` gathers
0–330 ms, transforms 330–950 ms and stamps at 950 ms, finishing by 1600 ms.
Metal blades converge into a crest; vines spiral and bloom; water spirals freeze
into a crystal crest; fire forms a flame vortex; rocks rise and slam into a crest;
wind forms a cyclone; lightning cages the caster then strikes down. Curved spirals
use `flowRibbon` with `segments: 48` (default 10) for smooth paths. Utility uses
grounded palette rings. No shared shatter/helix/rune-stack or bright body overlay.
`empoweredAura(w, tex, { at, height, palette, element?, tier, duration, idle? })`
sustains the same motif during gameplay or idle (one to seven sprites, or two/three
short filterless lightning ribbons plus a floor ring, replaced every 115/85 ms and disposed on stop/clear): metal
blades/ring, wood leaf spiral with two ground vines/ring, water ripples/shards,
fire tongues/embers, wide shin-height earth rocks/dust ring, wind spirals or continuous feet/leg lightning arcs.
Earth cracks appear only during activation.
All motifs render behind the caster; floor rings follow x/y with z=0. Unknown
elements use a clearly visible ground halo (alpha <=0.5) in the supplied skill palette.
`empoweredHit(w, tex, { at: chestPosition, palette, tier, element, tick? })` adds
behind-target accents: `kim` crossed glints, `moc` six sprouting thorned vines,
`hoa` embers, `phong` crescents, `tho` rocks, `thuy` six shards plus an ice ring,
`loi` branching arcs plus violet scorch. The three stronger signatures last 520 ms
at tier 3, 380 ms at tier 2. Utility/unknown elements get
only their supplied palette's ring. Repeat hits at the same ground position are
throttled for the accent's lifetime; `tick: true` uses one smaller elemental accent.
Native `hitSpark` and authored hit feedback
must still run at every tier; this helper is an additional accent, never a replacement.
For native feedback that bleaches a target, `hitSpark.coreAlpha: 0` omits only
the core glow, keeping the star/eight streaks. Fissure opts in through
`SkillContext.hurt(..., { coreAlpha: 0, feedback: 0.18, palette })` with a warm core.
Lightning reads `VfxWorld.energyScale` (1 normally, 1.2/1.45 through textured
empowerment facades) to widen channels/halos without changing endpoints or alpha.
For repeated hits use `hitSpark(..., { ..., refresh: true })` to re-trigger all
native sparks at that target, reusing still-living particles rather than stacking
bursts. Defaults are unchanged. `damageNumber(..., { ..., compact: true })` bakes
the full number into one temporary sprite, keeping crit styling and lifetime;
the texture is disposed on completion/clear. The evolved demo uses both
options to retain full skill density within the total budget.
Both helpers skip tier 1; no full-screen white flashes are used.
Use `empoweredWorld(w, { tier, palette, textures: tex })` as the skill context's world
for cast-local 1.2x/1.45x additive energy and stronger impact feedback. Private flame,
water foam and wood halo/shaft textures are recognized without eagerly creating
their caches. Additive rope ribbons widen without moving any centerline point;
their temporary texture views are cast-local and disposed on stop/clear. Authored
materials, tint, density and trail proportions are unchanged; without `textures`,
visual transforms are disabled. The total cast must satisfy its ordinary budget.
The facade retains delayed callbacks without changing other casts. For idle power,
keep the handle from `empoweredAura(..., { ..., duration: Infinity, idle: true })`
and stop it on tier changes. Debug captures/checks disable this persistent aura. Open the demo with `?debug`
to access `__vfxDebug.idleAura(true)`; debug mode also stops its ticker.
All palettes are accepted; floor pieces stay at z=0 even during jumps.
See [verification](extending.md#verification-and-reproducibility) for baseline/tiered
captures and activation/evolution pseudo-IDs.

## dropShadow (ground blob)

Blob shadow under anything airborne (projectiles, meteors, jumping units). Lands where the
baked sun puts shadows (`VfxWorld` `shadow`, from `rigFromBlender`), fades and widens with
height. `const sh = dropShadow(vfx, tex, () => pos, size)`; `sh?.kill()` when it lands.


## Texture sets

Call `createVfxTextures()` once after renderer setup for the shared `VfxTextures` set.
It includes light masks and material surfaces (steel blades, bronze bell, guardian,
mountain, rock and vines). `TEX_METRICS` records feature dimensions for pixel-to-scale
conversion. Not every texture is white: preserve baked shading on material surfaces
and use normal blending for solid matter.

Utility masks include `skull` (64×72), `sealGlyph` (128×128, bold circular inscription
and crossed strokes) and `chainLink` (64×40, thick elliptical link). Silence layers the
seal at 0.6× target height with violet underglow, a bright slowly rotating/pulsing core,
three linked body bands and split ground-seal halves; it does not use a stage flash.

Fire, dragon, wood and water recipes also use lazy cached texture sets. Their first
call can allocate textures; prewarm them after renderer setup if needed. Only
`woodTextures` is exported by the barrel; see the [direct-module list](api.md#direct-module-only-helpers)
for other cache imports. Do not destroy shared cache textures when one effect ends.

## Hoa (fire)

These functions take `(w, tex, options)`. They are distinct from the generic
`projectile`, `explosion`, `meteor` and `coneBreath` recipes.

| Function | Options and behavior |
|---|---|
| `fireCharge` | `origin: () => Vec3`, `palette`, `duration`, optional `size`, `onDone`; flame gather, returns Handle. |
| `fireball` | `from`, `to`, `palette`, optional `speed` (720), `size`, `onHit(at)`; arcing flame projectile, returns Handle. Caller owns impact damage and can add `fireImpact`. |
| `fireImpact` | `x`, `y`, `radius`, `palette`, optional `meteor`; finite flame/scorch/smoke burst with shake/hit-stop, returns void. |
| `fireMeteor` | `x`, `y`, `radius`, `palette`, `castMs`, optional `onHit()`; warning, falling meteor and impact, returns void. |
| `fireBreath` | `origin: () => Vec3`, `angle: () => number`, `palette`, `range`, `spread`, `duration`; flame cone, returns Handle. Gameplay ticks stay in the caller. |
| `fireDragonCrossing` | `from`, `toward`, `palette`, optional `facing`, `onCross(contact)`; crossing segmented dragon, returns Handle. |

`FireDragonContact` has `x`, `y`, `angle`, `halfLength`, `radius`. The callback
runs repeatedly for visible head/coil swept contacts, not once per target and not for
the lingering ground trail. Check collision against the oriented ground capsule:
un-squash target dy by `w.groundSquash`, rotate into `contact.angle`, then measure
distance to the segment from `-halfLength` to `halfLength` with the supplied radius.
Track per-target hit/cooldown state in gameplay to avoid damage every callback.
The current sample is Fire Dragon Crossing / Hỏa Long Quá Giang
(`hoa-fire-dragon-crossing`).

## Moc (wood)

These functions take `(w, options)`, **not** `(w, tex, options)`, and return Handles.
They use their own colored vegetation cache and do not accept a palette.

| Function | Options and behavior |
|---|---|
| `woodCharge` | `target: () => Vec3`, optional `duration` (300), `onDone()`; seed and leaf gather. |
| `seedFlight` | `from`, `to`, optional `speed` (620), `onHit(at)`; physical seed flight. |
| `springBloom` | `target: () => Vec3`, optional `radius` (58), `duration` (2000); grass and opening flowers. Healing stays in the caller. |
| `toxicSporeCloud` | `at: Vec3`, optional `radius` (120), `duration` (2600), `onBloom()`; mushrooms, spores and a warning before bloom at 450 ms. Apply poison through gameplay/status callbacks. |
| `woodTextures` | No arguments; cached leaves, petals, mushrooms, clouds, seed, stem, thorn, grass, center, spores, soil, moss, shaft and halo. |

Wood durations must be finite and nonnegative; zero bloom/cloud duration is inert.
Negative/nonfinite durations and nonpositive/nonfinite seed speed throw RangeError.
Stop handles on interruption; finite emitted particles
can have a fading tail. For binding vines, use `vineBind` or its `root` wrapper from
the [status catalog](extending.md#status-catalog).

## Thuy (water)

These functions take `(w, tex, options)` and return Handles. They use the lazy
crystal/water/foam cache in addition to shared textures.

| Function | Options and behavior |
|---|---|
| `frostNova` | `target: () => Vec3`, `height`, `palette`, optional `duration` (2200, minimum 300), `radius` (75), `onShatter()`; ice enclosure, radial crystals and shatter. |
| `glacierPath` | `from`, `angle`, `palette`, optional `count` (9, capped at 14), `spacing` (44), `height` (80), `onSpike(at)`; fractured ridge advancing every 85 ms. |
| `tidalBeam` | `from: () => Vec3`, `to: () => Vec3`, `palette`, optional `duration` (1500); rolling pressure body and breaking foam crown following live endpoints. |

These visuals do not apply damage or CC automatically. Keep damage, slow and freeze
state aligned with recipe callbacks or the cast's timing data.

## Loi (lightning)

All helpers below take `(w, tex, options)`. The low-level `lightningBolt` is a
[direct-module import](api.md#direct-module-only-helpers), not a barrel export.

| Function | Options and behavior |
|---|---|
| `stormCloud` | `x`, `y`, `palette`, optional `width` (330), `height` (235), `duration` (1800; Infinity supported). Returns `StormCloudHandle` with `flash()` and `source(x): Vec3` as well as `stop()/alive`. Source x is clamped within the canopy. |
| `lightningCharge` | `target: () => Vec3`, `palette`, optional `duration` (300), `size` (1), `onDone()`; returns Handle. |
| `lightningWarning` | `x`, `y`, `radius`, `palette`, `duration`, optional `onDone()`; returns Handle. |
| `lightningStun` | `target: () => Vec3`, `duration`, `palette`, optional `height`; electrical control ambience, returns Handle. |
| `lightningImpact` | `x`, `y`, `palette`, optional `radius`; finite ground flash/scorch/sparks, returns void. |
| `lightningStrike` | `x`, `y`, `palette`, optional `radius` (45), `delay`, `onHit()`, `cloud`, `height` (235), `hitStop` (25), `shake` (4); returns void. Zero feedback values disable stop/shake. Creates a finite cloud if none is supplied. |
| `staticField` | `x`, `y`, `radius`, `palette`, `duration`, optional `onTick()`, `targets: () => Vec3[]`, `cloud: StormCloudHandle \| false`; returns Handle, ticks every 500 ms. Default creates a canopy; false disables it. A supplied cloud joins the field's cleanup ownership. |

`lightningChain(w, tex, { points, palette, flickers?, width?, impactIntensity?, hopMs? })`
returns a Handle. Hops default to 40 ms; default bolt life is 320 ms with a 240 ms
hold, followed by a thinner afterglow bolt. Explicit flicker counts adjust life and
restrikes; it is not the old fixed 65 ms reroll loop.

## Wind

Use `windSweep(w, { target: () => Vec3, angle, radius, palette, height?, duration? })`
for a short following cut. It returns a Handle and uses parametric ribbons rather than
a projectile. Default duration is 410 ms and height is 38 px.
`windPressure` is a short, fixed-origin effect; reverse it with `inward: true` to
draw air into a cast. `windRush` drives a moving slipstream; use `onMove` to move a
unit the same way as the effect. The caller owns collision and gameplay.
`windSlash` travels, `vortex` spirals around an area, `tornado` moves a funnel,
`windWisps` follows a unit and `gustLines` emits a directional burst; see the catalog
above and the [API index](api.md). The underlying `flowRibbon` is described in
[advanced effects](advanced-fx.md#parametric-ribbons).
