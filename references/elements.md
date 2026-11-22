# Wu Xing (Ngũ Hành), Phong and Lôi element design

`ELEMENTS` in `kit/elements.ts` holds all seven built-in palettes and shape languages;
`WUXING` contains only the five base elements. A good
element skill changes **shape, motion and blend**, not only the colour. Use this table when you
design a new skill, and pick the matching sample in `examples/skills.ts` as a starting point.

| Element | Palette (core / main / dark) | Shapes | Motion | Blend | Signature recipes | Samples |
|---|---|---|---|---|---|---|
| Kim / Metal | white / gold / bronze | beveled steel, cutting edges, cast bronze, sparks | fast in, hard stop, precise | normal steel and bronze, additive glints | `swordRain`, `metalSlash`, `goldenBell` | Sword Rain, Golden Edge (+bleed), Golden Bell |
| Mộc / Wood | pale lime / green / forest | leaves, vines, spores, bubbles | grows, sways, drifts up, withers | normal leaves/vines, additive motes | `woodCharge`, `seedFlight`, `springBloom`, `toxicSporeCloud`, `root` | Vine Bind, Spring Bloom, Toxic Spores |
| Thủy / Water | ice white / sky blue / deep blue | drops, beams, shards, spikes | smooth, flowing; ice snaps and shatters | additive water, normal ice | `frostNova`, `tidalBeam`, `glacierPath`, `slow` | Frost Nova, Tidal Beam, Glacier Path |
| Hỏa / Fire | cream / orange / ember red | puffs, embers, flashes, scorch | violent burst, rising, long smoky tail | additive fire, normal smoke | `fireCharge`, `fireball`, `fireBreath`, `fireMeteor`, `fireDragonCrossing` | Fireball (+burn), Dragon Breath, Heavenfall Meteor, Fire Dragon Crossing (Hỏa Long Quá Giang) |
| Thổ / Earth | sand / ochre / umber | rock spikes, debris, dust, cracks | heavy, gravity, bounce, big shake | normal (rocks and dust are not light) | `spikeLine`, `mountainCrash`, `stoneArmor`, `leap`, `stun` | Earth Fissure, Mountain Crash, Stone Skin |
| Phong / Wind (variant) | white / mint / teal | crescent gusts, spiralling streaks, ribbons, carried leaves and dust | fast, curving, orbiting; pulls and lifts; curl-noise drift | additive and translucent, normal for carried debris | `tornado`, `windSweep`, `windSlash`, `vortex`, `windWisps`, `gustLines`, `ribbonTrail` | Gale Blades, Whirlwind, Dragon Cyclone, Tailwind |
| Lôi / Lightning (variant) | white / violet-blue (`0xa8b4ff`) / deep violet (`0x3a2a9a`) | jagged forked bolts, crawling body arcs, sparks and scorch | instant strike, fast fade, arcs re-roll; no projectile travel | low-alpha additive violet halos, tiny white impact cores, normal scorch | `lightningStrike`, `staticField`, `lightningChain`, `shock` | Chain Lightning, Heavenly Thunder, Thunder Domain |

Rules of thumb:

- One element per skill. Mix two only for a reason (Thủy + Mộc healing rain) and keep one dominant.
- Solid matter (rock, ice, blades, leaves, smoke) uses `blend: 'normal'` and a darker tint on the
  shadow side; light (fire, glints, magic) uses additive at low alpha so stacks do not clip to white.
- Lit-from-the-left textures (`spike`, `rock`, `blade`) are mirrored with `litFlip(w)` so their lit
  side matches the baked sun of your Blender renders.
- Heavier elements get longer hit-stop and bigger shake (Thổ 60-80 ms / 8-12 px, Kim 30-50 ms / 3-5 px).
- Wind has no mass: it reads only through motion and what it carries. Sort orbiting streaks in
  front of and behind the target (dim the back half via `p.alphaMul`), and always carry
  something (dust, leaves, debris) so the swirl has visible matter in it.
- `PHONG` and `LOI` are variant elements outside the Wu Xing cycle, so `WUXING` stays five
  entries; use `ELEMENTS` for all seven built-ins. Lôi leans violet to stay distinct from
  Thủy's sky blue. A caster can charge before release, but the released sky strike is instant.
- Register your own element with `defineElement` and look it up with `getElement`. See
  [Extending the kit](extending.md) for custom shape language, signature recipes and recolors.

See the [recipe catalog](recipes.md) for specialized signatures and the
[API index](api.md) for the full exported surface.
