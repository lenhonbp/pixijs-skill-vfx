# pixijs-skill-vfx

[Live VFX showcase](https://lenhonbp.github.io/pixijs-skill-vfx/) · [Runtime docs](runtime/README.md) · [Pack format](docs/pack-format.md)

## Free runtime. Instant magic.

**Runtime is free forever (MIT)** — a zero-runtime-dependency atlas player for
PixiJS v7 and v8, with 25 free baked effects, English/Vietnamese names, additive
glow, pooling, cue events, optional shake and hit-stop. Commercial use welcome;
keep the MIT copyright and license notice in copies of the runtime.
The [interactive showcase](showcase/) lets you filter, cast, replay and loop the
collection, try synthesized sound hints, and copy integration code.

```ts
import { VfxPlayer } from '@lenhon/pixijs-vfx-runtime';
const vfx = await VfxPlayer.create(app, { packs: ['packs/free/hoa-fireball.vfxb'] });
vfx.play('hoa-fireball', { from: caster, to: target });
```

The 1.0.0 runtime package is prepared for publishing; see [local installation](runtime/README.md#install)
until the npm release is available. Baked packs live in `showcase/public/packs/free/`.
Only baked assets are distributed: no offline factory or baker code is included.

### Premium Skill Packs — coming soon

The runtime stays free; optional art collections will expand your library:

| Collection | Theme | Stores (placeholder links; coming soon) |
|---|---|---|
| **Kiếm Hiệp** | Martial legends, sword auras and flying blades | [Gumroad](#gumroad-link-tbd) · [itch.io](#itch-link-tbd) |
| **Ngũ Hành** | Metal, wood, water, fire and earth | [Gumroad](#gumroad-link-tbd) · [itch.io](#itch-link-tbd) |
| **Ultimate Boss** | Arena-shaking final encounters | [Gumroad](#gumroad-link-tbd) · [itch.io](#itch-link-tbd) |

### Run the showcase locally

```sh
npm install
npm run dev:showcase
# Production: npm run build:runtime && npm run build:showcase
# Browser smoke (build first): npm run check:runtime
```

GitHub Pages deploys the Vite showcase.

## License

© 2026 lenhonbp <lenhonbp@gmail.com> · [MIT license](LICENSE).
The runtime and showcase are MIT licensed. Keep the copyright and license notice when redistributing runtime code.
