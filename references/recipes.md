# Recipe catalog

Recipes are exported from `kit/index.ts` and implemented in the modules below. Most take
ground coordinates `(x, y)` plus height `z`, and a `Palette` (`{ core, main, dark }`). Copy the closest one and change it; recipes are examples,
not a framework to extend with options.

| Recipe | Layers it builds | Typical use | Key knobs |
|---|---|---|---|
| `hitSpark` | small core glow, spinning star, 8 streaks in a cone | every hit, crits (size 1.5+) | `angle` (away from attacker), `size` |
| `hitFlash` | additive copy of the target's texture fading out | target feedback | `ms`, `color` (red for damage, green for heal), `opacity` (default 1) |
| `slash` | dark smear + main crescent + white edge, all ground-aligned at chest height, sparks off the end | melee swings, dash cuts | `angle` facing, `radius`, `sweep`, `duration`, `clockwise` |
| `projectile` | glow + core following a path with an arc, ribbon trail + ember stream, ground shadow | fireball, arrow, magic bolt | `speed`, `arcHeight`, `size`, `alpha` (glow/core/ribbon/motes multiplier, default 1), `onHit` |
| `explosion` | top flash, additive fire puffs, normal-blend smoke, gravity sparks, shockwave, scorch decal, shake + hit-stop | AoE impact, fireball hit | `radius`, `shake`, `hitStopMs`, `smoke` |
| `shockwave` | two expanding ground rings + screen refraction when `Distortion` is attached; optional depth-split halves | slams, landings, nova | `radius`, `duration`, `around` (unit feet; opts into split rings) |
| `floorRing` (`floor-ring.ts`) | far arc in ground, near arc in y-sorted body | rings that encircle a unit | `radius`, `palette`, `around`, `duration`, alpha/scale curves, `texture`, `spin` |
| `telegraph` | pulsing ground ring, faint area, fill that grows over the cast | enemy AoE warnings, cast bars on the ground | `radius`, `duration`, `onDone`, `finishAlpha` (0 disables the finish flash) |
| `meteor` | `telegraph` -> `projectile` from the sky -> big `explosion` | ultimates; shows composition | `radius`, `castMs` |
| `lightningChain` | jagged beams (glow + core) between points, re-rolled every 65 ms, glows and sparks at each hit | chain lightning, beams, tethers | `points`, `flickers`, `width`, `impactIntensity` (default 1) |
| `lightningStrike` (`thunder.ts`) | heavy forked sky bolt with violet halo, three flickers, colored impact flash, scorch, sparks, shockwave, shake and hit-stop | instant lightning impact; caller supplies telegraph | `x`, `y`, `palette`, `radius`, `delay`, `onHit` (once) |
| `staticField` (`thunder.ts`) | violet ground glow/ring, frequent jagged arcs, rim sparks | sustained lightning AoE; returns handle | `x`, `y`, `radius`, `palette`, `duration`, `onTick` (every 500 ms) |
| `healAura` | ground pad + shrinking rings, vertical column glow, rising swaying motes, some stars | heals, buffs, auras (return handle) | `target` (follow fn), `radius`, `duration` |
| `damageNumber` | baked outlined digit sprites in `top`, pop + drift | every hit/heal/tick | `value`, `color`, `crit`, `size` |
| `damageOverTime` | body tint + per-kind ambience (poison bubbles, burn flames/embers, bleed drops with ground splats), tick pulse + number | poison, burn, bleed | `kind`, `duration`, `tickMs`, `damage`, `onTick` |
| `stun` | stars orbiting over the head, depth-sorted front/back, ring + trail | stun, daze | `duration`, `stars`, `palette` |
| `freeze` | frost decal, ice crystals growing around the body, cold mist; shatter burst at end | freeze, petrify (rock palette) | `duration`, `onShatter`, `glowIntensity` (default 1) |
| `slow` | spinning cold arcs at the feet, sinking chevrons, drips | slow, snare | `duration`, `palette` |
| `root` / `vineBind` (`vine-bind.ts`) | four thick outlined, thorned green vines spiral from the ground to 80% of unit height; near/far coils wrap around the body, leaves, brown wither and bark crumble | root, entangle | `target`, `height`, `duration` (default 2500; Infinity until stopped), `palette`; handle: `stop()`, `pulse()` (call alongside each gameplay damage tick to squeeze coils). `root` delegates to `vineBind` |
| `shield` | rim-lit bubble with pulse, ground ring, crawling glints; `hit(angle)` ripple, `break()` shards | barriers, absorbs, invulnerability | `radius`, `duration`, `onBreak` |
| `goldenBell` (`bell.ts`) | cast-bronze temple bell with engraved bands and flared mouth; landing dust, struck-metal ripples, cracks and tumbling pieces of the shell | bell-shaped ward, distinct from a spherical shield | `target`, `height`, `palette`, `duration` (sustain after landing, default 3000; Infinity until stopped), `onBreak`; handle: `hit(angle?)`, `break()`, `stop()` |
| `stoneArmor` (`stone-armor.ts`) | rising pebbles, eight solid beveled plates snapping onto shoulders, torso, hips and shins; lock-in dust, earthy glow, falling rubble on end | attached rock armor rather than a bubble | `target`, `height`, `palette` (earth default), `duration` (sustain after 650 ms assembly, default 2200; Infinity supported), `onBreak`; handle: `hit(angle?)`, `break()`, `stop()` |
| `statChange` | light column, chevrons climbing (up) or sinking (down), ground ring | attack/defense/speed buffs and debuffs | `up`, `palette`, `duration` |
| `dash` | afterimages of the unit sprite, speed lines, dust | dash, charge | `sprite`, `duration`, `onMove`, `onEnd` |
| `blink` | implode + light column at `from`, faint trail, column + burst at `to` | teleport, shadow step | `gapMs`, `onVanish`, `onAppear` |
| `leap` / `slam` | dust, airborne shadow, trail; slam: shockwave, cracks, dust ring, rock debris, shake | jump attacks, ground pound | `arc`, `duration`, `radius`, `onLand` |
| `beam` | laser: stacked beams, motes and end glows; water: rolling puffs, droplets, splash spray, foam rings and wet ground glow | lasers, water jets, drains | `from`, `to` (functions), `width`, `duration`, `style: 'laser' \| 'water'`, `impactSparks` |
| `coneBreath` | puffs fanned along a moving angle, element bits (embers/shards/leaves), lit ground | dragon breath, frost spray, poison spray | `style`, `range`, `spread`, `angle()` |
| `chargeUp` | streaks converging on a point, growing glow, shrinking rings, release flash | any windup | `duration`, `onDone`, `release: { color, size, coreSize, alpha }` (optional; defaults unchanged) |
| `summonCircle` | two counter-rotating rune circles, rising pillars, spiralling motes, light column + shockwave | summons, portals | `radius`, `duration`, `columnAlpha` (default 1), `onSummon` |
| `spiritGuardian` (`spirit-guardian.ts`) | spectral warrior levitates about 40 px, glides with wisps/ghosts and altitude-scaled shadow; separate grip-pivoted halberd winds up, cleaves, sweeps and dive-slams with body recoil and blade-tip trails, then dissolves | visible summoned attacker; damage stays in caller | `x`, `y`, `z?`, `palette`, `height?` (default 100), `target?: () => Vec3` (enemy feet, re-read per strike), `strikes?` (default 3), `slamRadius?` (outer shockwave ground radius, default 1.1 × height; match gameplay radius), `onStrike?(i, at)` (zero-based, fires at the contact pose), `facing?` (±1, otherwise derived from target). Without target, composed guardian stays idle and `duration?` remains hold time (default 1200). Reveal 350 ms, glide 650 ms, 650 ms per strike (contact at 48%), dissolve 450 ms; returns stoppable Handle |
| `mountainCrash` (`mountain-crash.ts`) | craggy solid mountain forms overhead, slams base-first, cracks the ground, bursts into falling boulders and fading rubble | Mount Tai crushing attacks | `x`, `y`, `radius`, `palette`, `height` (peak height, default 160), `delay` (before formation), `onHit` (once, 320 ms after formation starts); returns Handle. Pair with `leap({ impact: false })` to avoid a duplicate landing slam |
| `spike` / `spikeLine` / `spikeRing` | lit spikes that rise, hold and sink, crater, debris, dust; `ice` variant | earth fissure, ice path, frost nova | `count`, `spacing`, `height`, `onSpike` |
| `swordRain` | gold-hilted steel blades accelerate down, dig into cracked ground and settle amid sparks and glints | metal ultimates | `radius`, `count` (gameplay impacts; quality-scaled cosmetic swords add density without extra callbacks), `height` (unit height, default 70; blades about as tall as the unit), `duration`, `palette`, `onImpact` |
| `swordSalute` | fan of steel swords rises over the caster and lifts off | metal windups | `at` (follow fn), `height`, palette, duration |
| `metalSlash` / `metalSparks` (`metal.ts`) | solid sword and narrow gold-edged cut; ballistic contact sparks | crossing metal cuts, struck metal | `angle`, `span`, `palette`, `reverse` for cuts; palette, count, angle and size for sparks |
| `tornado` | funnel of orbiting streaks and puffs (front/back depth fade), carried leaves/rocks, dust ring, ground swirl, heat haze | tornado, cyclone, pull + lift CC | `at`, `to`, `height`, `radius`, `duration`, `onTick(pos)` |
| `windSlash` | twin crescents flying along a path, two side ribbons + a core ribbon, speed lines, release burst | wind blade, sonic slash | `from`, `to`, `size`, `speed`, `onHit` |
| `vortex` | counter-rotating ground rings, streaks spiralling in (or out) | pulls, wind fields, spin attacks | `at` (point or fn), `radius`, `inward` |
| `windWisps` | three ribbon helices orbiting the unit, curl-noise motes | haste, tailwind, wind aura | `target`, `radius`, `height`, `duration` |
| `gustLines` | burst of horizontal speed lines along a ground angle | knockback, dash, tailwind | `angle`, `count`, `spread` |
| `ribbonTrail` | rope mesh through the target's recent positions | any fast mover (see advanced-fx.md) | `width`, `segments`, `tint`, `fadeMs` |

## Floor rings around units

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

`node tools/test-floor-ring.mjs` checks depth, following, cleanup, actual WebGL occlusion
pixels and integer/subpixel seam equivalence against an unsplit rotating rune.

## Extended statuses

`kit/status.ts` also exports `shock`, `silence`, `blind`, `armorBreak`, `mark`, `fear`,
`aura`, `regen`, `haste` and `empower`. They use `target: () => feet`, optional height,
palette and duration, and return handles. The nine additions after `shock` support Infinity
until `stop()`. See the [complete status catalog](extending.md#status-catalog) for silhouettes,
buff/debuff/CC roles, tick options and cleanup, and the [composition guide](extending.md#compose-a-skill-and-synchronize-gameplay)
for phase timing and gameplay callbacks.

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

## dropShadow

Blob shadow under anything airborne (projectiles, meteors, jumping units). Lands where the
baked sun puts shadows (`VfxWorld` `shadow`, from `rigFromBlender`), fades and widens with
height. `const sh = dropShadow(vfx, tex, () => pos, size)`; `sh?.kill()` when it lands.
