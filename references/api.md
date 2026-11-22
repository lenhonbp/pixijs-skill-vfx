# Exported API index

This is the canonical name index for imports from `kit/index.ts` (for example,
`import { fireball } from "../kit"`). Types and runtime values are both listed.
Follow the linked guides for options and lifecycle details; unlinked entries point to
source-only contracts. Copy the whole kit, including its internal texture modules.

## kit/ease.ts

- `Ease` — Normalized-time easing function type — [Curves and randomness](extending.md#curves-and-randomness).
- `linear` — Linear easing — [Curves and randomness](extending.md#curves-and-randomness).
- `inQuad` — Quadratic ease-in — [Curves and randomness](extending.md#curves-and-randomness).
- `outQuad` — Quadratic ease-out — [Curves and randomness](extending.md#curves-and-randomness).
- `inCubic` — Cubic ease-in — [Curves and randomness](extending.md#curves-and-randomness).
- `outCubic` — Cubic ease-out — [Curves and randomness](extending.md#curves-and-randomness).
- `outQuart` — Quartic ease-out — [Curves and randomness](extending.md#curves-and-randomness).
- `outExpo` — Exponential ease-out — [Curves and randomness](extending.md#curves-and-randomness).
- `inOutSine` — Sinusoidal ease-in/out — [Curves and randomness](extending.md#curves-and-randomness).
- `outBack` — Overshooting ease-out — [Curves and randomness](extending.md#curves-and-randomness).
- `clamp01` — Clamp a number to 0..1 — [Curves and randomness](extending.md#curves-and-randomness).
- `lerp` — Linear numeric interpolation — [Curves and randomness](extending.md#curves-and-randomness).
- `setRng` — Replace the process-global random source — [Curves and randomness](extending.md#curves-and-randomness).
- `random` — Sample the active random source — [Curves and randomness](extending.md#curves-and-randomness).
- `mulberry32` — Create a seeded random source — [Curves and randomness](extending.md#curves-and-randomness).
- `rand` — Random number between bounds — [Curves and randomness](extending.md#curves-and-randomness).
- `randSign` — Random -1 or +1 — [Curves and randomness](extending.md#curves-and-randomness).
- `pick` — Random array entry; undefined for an empty array — [Curves and randomness](extending.md#curves-and-randomness).
- `lerpColor` — Interpolate RGB colors — [Curves and randomness](extending.md#curves-and-randomness).
- `colorRamp` — Three-color interpolation curve — [Curves and randomness](extending.md#curves-and-randomness).
- `envelope` — Fade-in/hold/fade-out curve — [Curves and randomness](extending.md#curves-and-randomness).

## kit/pixi-compat.ts

- `BlendName` — Supported blend-mode names — [Pixi compatibility](pixi-v7-v8.md).
- `isPixiV8` — Detect the loaded Pixi major version — [Pixi compatibility](pixi-v7-v8.md).
- `blend` — Resolve a portable blend name — [Pixi compatibility](pixi-v7-v8.md).
- `textureFromCanvas` — Create a texture from a canvas — [Pixi compatibility](pixi-v7-v8.md).
- `renderToTexture` — Render a container to a texture across Pixi versions — [Pixi compatibility](pixi-v7-v8.md).

## kit/textures.ts

- `VfxTextures` — Shared procedural texture-set interface — [Texture sets](recipes.md#texture-sets).
- `TEX_METRICS` — Feature sizes used to convert pixels to texture scales — [Texture sets](recipes.md#texture-sets).
- `createVfxTextures` — Bake the shared texture set — [Texture sets](recipes.md#texture-sets).

## kit/vfx-world.ts

- `Curve` — Numeric particle-curve input type — [World and ownership](extending.md#world-and-ownership).
- `LayerName` — Ground/body/top layer union — [World and ownership](extending.md#world-and-ownership).
- `Vec3` — Ground x/y plus optional height z — [World and ownership](extending.md#world-and-ownership).
- `SpawnOptions` — Particle spawn, physics and appearance options — [World and ownership](extending.md#world-and-ownership).
- `Handle` — Stoppable lifetime interface — [World and ownership](extending.md#world-and-ownership).
- `Particle` — Pooled sprite particle — [World and ownership](extending.md#world-and-ownership).
- `VfxWorldOptions` — World layers, camera, RNG, budget and projection options — [World and ownership](extending.md#world-and-ownership).
- `WorldPlugin` — World-clock update/clear plugin interface — [World and ownership](extending.md#world-and-ownership).
- `VfxWorld` — Particle pool, world clock and effect ownership — [World and ownership](extending.md#world-and-ownership).
- `setGroundTransform` — Apply the ground-plane sprite transform — [World and ownership](extending.md#world-and-ownership).

## kit/recipes.ts

- `ShadowSlashOptions` — Crossed shadow slash options — [Utility composition](recipes.md#utility-composition-and-timing).
- `shadowSlash` — Violet-edged crossing ink crescents — [Utility composition](recipes.md#utility-composition-and-timing).
- `ProjectileOptions` — Arc projectile and seal-head options — [Recipe catalog](recipes.md).

- `Palette` — Core/main/dark color interface — [Recipe catalog](recipes.md).
- `PALETTES` — Generic named palettes — [Recipe catalog](recipes.md).
- `hitSpark` — Localized contact burst — [Recipe catalog](recipes.md).
- `activeHitFlashes` — Registry of active additive hit-flash sprites — [Recipe catalog](recipes.md).
- `hitFlash` — Temporary additive copy of a target sprite — [Recipe catalog](recipes.md).
- `slash` — Generic crescent slash — [Recipe catalog](recipes.md).
- `telegraph` — Timed ground-area warning — [Recipe catalog](recipes.md).
- `shockwave` — Expanding ground rings and optional refraction — [Recipe catalog](recipes.md).
- `explosion` — Generic layered explosion — [Recipe catalog](recipes.md).
- `dropShadow` — Following ground shadow for an airborne point — [Recipe catalog](recipes.md).
- `projectile` — Arcing bolt with ribbon and onHit callback — [Recipe catalog](recipes.md).
- `meteor` — Generic telegraph and falling projectile — [Recipe catalog](recipes.md).
- `lightningChain` — Staggered forked bolts between points — [Recipe catalog](recipes.md).
- `healAura` — Following healing light and rings — [Recipe catalog](recipes.md).

## kit/blender.ts

- `BlenderCamera` — Camera projection inputs — [Blender rig](blender-2-5d.md).
- `BlenderSun` — Shadow angle and sun elevation inputs — [Blender rig](blender-2-5d.md).
- `Rig25D` — Derived projection and shadow settings — [Blender rig](blender-2-5d.md).
- `rigFromBlender` — Derive a 2.5D rig from Blender camera/sun values — [Blender rig](blender-2-5d.md).
- `anchorAtFeet` — Set a sprite anchor from foot pixels — [Blender rig](blender-2-5d.md).
- `unitPoints` — Resolve feet/knee/chest/head/above points — [Blender rig](blender-2-5d.md).
- `socketPoint` — Resolve a facing-specific socket offset — [Blender rig](blender-2-5d.md).

## kit/group.ts

- `fadeKill` — Fade and release a particle — [Composition and cleanup](extending.md#compose-a-skill-and-synchronize-gameplay).
- `Group` — Handle owning particles and child handles — [Composition and cleanup](extending.md#compose-a-skill-and-synchronize-gameplay).
- `group` — Create an effect lifetime group — [Composition and cleanup](extending.md#compose-a-skill-and-synchronize-gameplay).
- `ms` — Millisecond-based particle envelope helpers — [Composition and cleanup](extending.md#compose-a-skill-and-synchronize-gameplay).

## kit/elements.ts

- `ElementName` — Five base-element names — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `VariantElementName` — Phong and Loi variant names — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `AnyElementName` — All seven built-in element names — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `ElementId` — Built-in or custom element identifier — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `Element` — Element palette, shape language and optional hit skin — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `WUXING` — Five base-element definitions — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `PHONG` — Wind variant definition — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `LOI` — Lightning variant definition — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `ELEMENTS` — Seven built-in definitions; not the custom registry — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `defineElement` — Register or replace an element in the runtime registry — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `getElement` — Look up a registered element; undefined if unknown — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).
- `litFlip` — Choose the sun-facing texture mirror sign — [Element registry](extending.md#register-a-custom-element-and-give-it-a-signature).

## kit/palette.ts

- `paletteFrom` — Derive a palette from a main color — [Recoloring](extending.md#recolor-without-changing-geometry).
- `shiftPalette` — Return a hue/saturation/lightness-adjusted palette — [Recoloring](extending.md#recolor-without-changing-geometry).

## kit/thunder.ts

- `StormCloudHandle` — Cloud handle with flash and source-point methods — [Loi helpers](recipes.md#loi-lightning).
- `stormCloud` — Shaded storm canopy with lifetime and flash control — [Loi helpers](recipes.md#loi-lightning).
- `lightningCharge` — Caster lightning anticipation and release callback — [Loi helpers](recipes.md#loi-lightning).
- `lightningStun` — Crawling lightning control ambience — [Loi helpers](recipes.md#loi-lightning).
- `lightningWarning` — Ground lightning warning and completion callback — [Loi helpers](recipes.md#loi-lightning).
- `lightningImpact` — Ground lightning contact flash, sparks and scorch — [Loi helpers](recipes.md#loi-lightning).
- `lightningStrike` — Instant cloud-to-ground strike and onHit callback — [Loi helpers](recipes.md#loi-lightning).
- `staticField` — Sustained thunder field with 500 ms ticks — [Loi helpers](recipes.md#loi-lightning).

## kit/numbers.ts

- `NumberOptions` — Floating-number options — [Recipe catalog](recipes.md).
- `damageNumber` — Baked digit-sprite damage or healing number — [Recipe catalog](recipes.md).

## kit/status.ts

- `SigilChargeOptions` — Hand-sigil windup options — [Utility composition](recipes.md#utility-composition-and-timing).
- `sigilCharge` — Rotating hand rune or crosshair — [Utility composition](recipes.md#utility-composition-and-timing).
- `SunderingMarkOptions` — Reticle/fracture options with impact callback — [Utility composition](recipes.md#utility-composition-and-timing).
- `sunderingMark` — Armor-fracturing lock-on reticle — [Utility composition](recipes.md#utility-composition-and-timing).
- `HexFieldOptions` — Spreading ground-hex options — [Utility composition](recipes.md#utility-composition-and-timing).
- `hexField` — Open curse circle with curling shadows — [Utility composition](recipes.md#utility-composition-and-timing).
- `FrailtyOptions` — Draining binding/recoil options — [Utility composition](recipes.md#utility-composition-and-timing).
- `frailty` — Rising bindings, downward pulse and sickly sustain — [Utility composition](recipes.md#utility-composition-and-timing).

- `withDamageTickFeedback` — Cast-local observer for positive status damage ticks — [Status catalog](extending.md#status-catalog).
- `OnUnit` — Feet-following status target and height options — [Status catalog](extending.md#status-catalog).
- `SustainedStatusOptions` — Common palette/duration status options — [Status catalog](extending.md#status-catalog).
- `silence` — Crossed sealing rune status — [Status catalog](extending.md#status-catalog).
- `blind` — Eye-obscuring mist status — [Status catalog](extending.md#status-catalog).
- `armorBreak` — Cracked-shield debuff status — [Status catalog](extending.md#status-catalog).
- `mark` — Target-lock sigil status — [Status catalog](extending.md#status-catalog).
- `fear` — Dark warning-wisp status — [Status catalog](extending.md#status-catalog).
- `aura` — Configurable sustained ground/body aura — [Status catalog](extending.md#status-catalog).
- `regen` — Healing ambience and periodic numbers/callback — [Status catalog](extending.md#status-catalog).
- `haste` — Speed-line buff ambience — [Status catalog](extending.md#status-catalog).
- `empower` — Warm sustained buff ambience — [Status catalog](extending.md#status-catalog).
- `shock` — Crawling electrical arcs and optional ticks — [Status catalog](extending.md#status-catalog).
- `DotKind` — Poison/burn/bleed union — [Status catalog](extending.md#status-catalog).
- `DOT_STYLE` — Default DoT palettes and number colors — [Status catalog](extending.md#status-catalog).
- `damageOverTime` — Timed per-kind ambience, damage numbers and callback — [Status catalog](extending.md#status-catalog).
- `stun` — Orbiting control stars — [Status catalog](extending.md#status-catalog).
- `freeze` — Ice enclosure with shatter callback — [Status catalog](extending.md#status-catalog).
- `slow` — Cold feet arcs and descending chevrons — [Status catalog](extending.md#status-catalog).
- `root` — Vine-bind status wrapper — [Status catalog](extending.md#status-catalog).
- `ShieldHandle` — Shield lifetime plus hit/break methods — [Status catalog](extending.md#status-catalog).
- `shield` — Following bubble barrier — [Status catalog](extending.md#status-catalog).
- `statChange` — Rising or falling stat-change indicator — [Status catalog](extending.md#status-catalog).

## kit/bell.ts

- `goldenBell` — Cast-bronze bell ward with hit/break methods — [Recipe catalog](recipes.md).

## kit/metal.ts

- `metalSlash` — Solid metal cut — [Recipe catalog](recipes.md).
- `metalSparks` — Ballistic metal contact sparks — [Recipe catalog](recipes.md).
- `swordSalute` — Following sword gather, hover and aimed launch — [Recipe catalog](recipes.md).

## kit/stone-armor.ts

- `stoneArmor` — Following rock-plate armor with hit/break methods — [Status catalog](extending.md#status-catalog).

## kit/spirit-guardian.ts

- `SpiritGuardianOptions` — Floating guardian reveal, targeting and strike options — [Recipe catalog](recipes.md).

- `spiritGuardian` — Flying spectral attacker or idle summon — [Recipe catalog](recipes.md).

## kit/mountain-crash.ts

- `mountainCrash` — Falling mountain with contact callback — [Recipe catalog](recipes.md).

## kit/vine-bind.ts

- `VineBindHandle` — Vine lifetime with squeeze pulse method — [Status catalog](extending.md#status-catalog).
- `vineBind` — Depth-sorted thorned binding vines — [Status catalog](extending.md#status-catalog).

## kit/skill-timing.ts

- `HitSkinName` — Eleven target reaction styles — [Skill timing](extending.md#skill-timing).
- `SkillHit` — Nominal hit timing and feedback metadata — [Skill timing](extending.md#skill-timing).
- `SkillTiming` — Windup, hit opportunities and recovery metadata — [Skill timing](extending.md#skill-timing).
- `hitTimes` — Resolve nominal hit times and optional travel distance — [Skill timing](extending.md#skill-timing).
- `onHits` — Schedule nominal hits and stop/shake feedback — [Skill timing](extending.md#skill-timing).

## kit/hit-reaction.ts

- `hitSkin` — Temporary color-mix reaction on the actual sprite — [Hit skins and rock-back](extending.md#element-hit-skins-and-rock-back).
- `rockBack` — Visual spring recoil through sprite pivot — [Hit skins and rock-back](extending.md#element-hit-skins-and-rock-back).

## kit/floor-ring.ts

- `FloorRingOptions` — Split unit-ring options — [Floor rings](recipes.md#floor-rings-around-units).
- `FloorRingHandle` — Ring lifetime with nullable far/near particles — [Floor rings](recipes.md#floor-rings-around-units).
- `floorRing` — Depth-split ground ring around a unit — [Floor rings](recipes.md#floor-rings-around-units).

## kit/motion.ts

- `ShadowStepOptions` — Dark smoke passage and arrival callbacks — [Utility composition](recipes.md#utility-composition-and-timing).
- `shadowStep` — Violet-rimmed shadow teleport — [Utility composition](recipes.md#utility-composition-and-timing).

- `afterimage` — Fading copy of a moving unit sprite — [Recipe catalog](recipes.md).
- `dash` — Ground movement with onMove callback — [Recipe catalog](recipes.md).
- `blink` — Vanish and reappear at separate points — [Recipe catalog](recipes.md).
- `leap` — Arcing movement with landing callback — [Recipe catalog](recipes.md).
- `slam` — Ground-impact feedback — [Recipe catalog](recipes.md).

## kit/channel.ts

- `BattleCryOptions` — Braced roar and fiery aura options — [Utility composition](recipes.md#utility-composition-and-timing).
- `battleCry` — Chest-height roar arcs and ember aura — [Utility composition](recipes.md#utility-composition-and-timing).
- `SummonCircleOptions` — Swept summon rune, pillar and linger options — [Recipe catalog](recipes.md).

- `beam` — Following laser or water-style channel — [Recipe catalog](recipes.md).
- `BreathStyle` — Fire/frost/poison/wind cone styles — [Recipe catalog](recipes.md).
- `coneBreath` — Generic following cone emission — [Recipe catalog](recipes.md).
- `chargeUp` — Generic convergence and release callback — [Recipe catalog](recipes.md).
- `summonCircle` — Portal runes and summon callback — [Recipe catalog](recipes.md).

## kit/activation.ts

- `ActivationTier` — Numeric activation tier: 1, 2 or 3 — [Activation contract](recipes.md#activation-and-evolution).
- `activationRelease` — Activation pre-roll delay for a tier — [Activation contract](recipes.md#activation-and-evolution).
- `empoweredWorld` — Cast-local tier styling facade — [Activation contract](recipes.md#activation-and-evolution).
- `skillActivation` — Void cast-start one-shot — [Activation contract](recipes.md#activation-and-evolution).
- `skillEvolution` — Void tier-transition one-shot — [Activation contract](recipes.md#activation-and-evolution).
- `empoweredHit` — Localized tier feedback; optional element and tick style — [Activation contract](recipes.md#activation-and-evolution).
- `empoweredAura` — Tier aura; handle or undefined for tier 1/nonpositive duration — [Activation contract](recipes.md#activation-and-evolution).

## kit/elemental.ts

- `stoneTint` — Derive a darker stone color — [Recipe catalog](recipes.md).
- `dustTint` — Derive a dust color — [Recipe catalog](recipes.md).
- `spike` — Single rock or ice spike — [Recipe catalog](recipes.md).
- `spikeLine` — Sequential ground spikes — [Recipe catalog](recipes.md).
- `spikeRing` — Radial ground spikes — [Recipe catalog](recipes.md).
- `swordRain` — Falling steel blades with gameplay impact callbacks — [Recipe catalog](recipes.md).

## kit/noise.ts

- `noise3` — Smooth deterministic 3D value noise — [Curl noise](advanced-fx.md#curl-noise-kitnoisets).
- `curl2` — 2D curl flow vector — [Curl noise](advanced-fx.md#curl-noise-kitnoisets).
- `curlDrift` — Particle update callback for organic drift — [Curl noise](advanced-fx.md#curl-noise-kitnoisets).

## kit/trail.ts

- `RibbonOptions` — Following-ribbon options — [Ribbon trails](advanced-fx.md#ribbon-trails-kittrailts).
- `RibbonHandle` — Ribbon lifetime with rope mesh access — [Ribbon trails](advanced-fx.md#ribbon-trails-kittrailts).
- `flowRibbon` — Timed parametric ground/height ribbon — [Ribbon trails](advanced-fx.md#ribbon-trails-kittrailts).
- `ribbonTrail` — Mesh trail through recent target positions — [Ribbon trails](advanced-fx.md#ribbon-trails-kittrailts).
- `ribbonTexture` — Cached tapered ribbon texture — [Ribbon trails](advanced-fx.md#ribbon-trails-kittrailts).

## kit/postfx.ts

- `DistortionOptions` — Screen refraction setup options — [Post effects](advanced-fx.md).
- `Distortion` — Optional displacement-buffer world plugin — [Post effects](advanced-fx.md).
- `BloomOptions` — Bloom buffer and threshold options — [Post effects](advanced-fx.md).
- `Bloom` — Optional bloom world plugin — [Post effects](advanced-fx.md).

## kit/wind.ts

- `TornadoOptions` — Moving funnel options — [Wind recipes](recipes.md#wind).
- `TornadoHandle` — Funnel lifetime with current position — [Wind recipes](recipes.md#wind).
- `tornado` — Traveling funnel with tick callback — [Wind recipes](recipes.md#wind).
- `windSlash` — Banking flying crescent and ribbons — [Wind recipes](recipes.md#wind).
- `windSweep` — Following short parametric wind cut — [Wind recipes](recipes.md#wind).
- `vortex` — Inward or outward spiral field — [Wind recipes](recipes.md#wind).
- `windWisps` — Following helical ribbon aura — [Wind recipes](recipes.md#wind).
- `gustLines` — Directional speed-line burst — [Wind recipes](recipes.md#wind).
- `windPressure` — Sector of converging or expanding air sheets and dust — [Wind recipes](recipes.md#wind).
- `windRush` — Short ground step with twin slipstream trails and movement callbacks — [Wind recipes](recipes.md#wind).

## kit/fire.ts

- `fireball` — Specialized arcing fire projectile — [Fire recipes](recipes.md#hoa-fire).
- `fireBreath` — Specialized following flame cone — [Fire recipes](recipes.md#hoa-fire).
- `fireCharge` — Specialized flame gather at an origin — [Fire recipes](recipes.md#hoa-fire).
- `fireDragonCrossing` — Segmented crossing dragon with swept contacts — [Fire recipes](recipes.md#hoa-fire).
- `fireImpact` — Specialized flame explosion and scorch — [Fire recipes](recipes.md#hoa-fire).
- `fireMeteor` — Specialized telegraphed fire meteor — [Fire recipes](recipes.md#hoa-fire).
- `FireDragonContact` — Swept ground-contact center, angle, half-length and radius — [Fire recipes](recipes.md#hoa-fire).

## kit/wood.ts

- `woodCharge` — Seed and leaf gather; no shared texture argument — [Wood recipes](recipes.md#moc-wood).
- `seedFlight` — Physical seed projectile; no shared texture argument — [Wood recipes](recipes.md#moc-wood).
- `springBloom` — Grass and flowers; no shared texture argument — [Wood recipes](recipes.md#moc-wood).
- `toxicSporeCloud` — Mushrooms and warning-to-bloom cloud — [Wood recipes](recipes.md#moc-wood).

## kit/wood-textures.ts

- `woodTextures` — Cached colored vegetation texture set — [Texture sets](recipes.md#texture-sets).

## kit/water.ts

- `frostNova` — Crystal enclosure, radial spikes and shatter — [Water recipes](recipes.md#thuy-water).
- `glacierPath` — Sequential fractured glacier ridge — [Water recipes](recipes.md#thuy-water).
- `tidalBeam` — Following foamy pressure torrent — [Water recipes](recipes.md#thuy-water).

## Direct-module-only helpers

These names are not re-exported by `kit/index.ts`. Import from the named file,
not `../kit`. They are lower-level building blocks; prefer the public recipes unless
integrating a custom effect. Read their source for full signatures.

- `lightningBolt` — forked ribbon bolt — `kit/lightning-bolt.ts`.
- `burnFlames` — attached flame ambience — `kit/fire.ts`.
- `clingingSpores` — attached spore ambience — `kit/wood.ts`.
- `fireTextures` — cached flame, smoke, scorch and meteor textures — `kit/fire-textures.ts`.
- `waterTextures` — cached crystals, frost, water and foam — `kit/water-textures.ts`.
- `fireDragonTextures` — cached dragon head and coil surfaces — `kit/fire-dragon-textures.ts`.
- `makeSteelBlade`, `makeBellSurfaces`, `bellFragments` — metal material builders and bell fragment lookup — `kit/metal-surfaces.ts`.

`woodTextures` is different: it is a public barrel export. Specialized texture caches are
lazy and shared; stopping an effect must not destroy those cached textures.
