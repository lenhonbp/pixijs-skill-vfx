# Wu Xing (Ngũ Hành) element design

`WUXING` in `kit/elements.ts` holds the palette and shape language for each element. A good
element skill changes **shape, motion and blend**, not only the colour. Use this table when you
design a new skill, and pick the matching sample in `examples/skills.ts` as a starting point.

| Element | Palette (core / main / dark) | Shapes | Motion | Blend | Signature recipes | Samples |
|---|---|---|---|---|---|---|
| Kim / Metal | white / gold / bronze | blades, streaks, star glints, rings | fast in, hard stop, precise | additive glints, normal blades | `swordRain`, `slash`, `shield` | Sword Rain, Golden Edge (+bleed), Golden Bell |
| Mộc / Wood | pale lime / green / forest | leaves, vines, spores, bubbles | grows, sways, drifts up, withers | normal leaves/vines, additive motes | `root`, `healAura`, `damageOverTime('poison')` | Vine Bind, Spring Bloom, Toxic Spores |
| Thủy / Water | ice white / sky blue / deep blue | drops, beams, shards, spikes | smooth, flowing; ice snaps and shatters | additive water, normal ice | `beam`, `freeze`, `slow`, `spikeRing({ ice })` | Frost Nova, Tidal Beam, Glacier Path |
| Hỏa / Fire | cream / orange / ember red | puffs, embers, flashes, scorch | violent burst, rising, long smoky tail | additive fire, normal smoke | `explosion`, `coneBreath`, `meteor`, `damageOverTime('burn')` | Fireball (+burn), Dragon Breath, Heavenfall Meteor |
| Thổ / Earth | sand / ochre / umber | rock spikes, debris, dust, cracks | heavy, gravity, bounce, big shake | normal (rocks and dust are not light) | `spikeLine`, `leap`/`slam`, `stun`, `shield` | Earth Fissure, Mountain Crash, Stone Skin |

Rules of thumb:

- One element per skill. Mix two only for a reason (Thủy + Mộc healing rain) and keep one dominant.
- Solid matter (rock, ice, blades, leaves, smoke) uses `blend: 'normal'` and a darker tint on the
  shadow side; light (fire, glints, magic) uses additive at low alpha so stacks do not clip to white.
- Lit-from-the-left textures (`spike`, `rock`, `blade`) are mirrored with `litFlip(w)` so their lit
  side matches the baked sun of your Blender renders.
- Heavier elements get longer hit-stop and bigger shake (Thổ 60-80 ms / 8-12 px, Kim 30-50 ms / 3-5 px).
