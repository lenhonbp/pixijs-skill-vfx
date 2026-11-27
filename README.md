# PixiJS Skill VFX

[![Live demo](https://img.shields.io/badge/Live_demo-Cast_a_spell-d6b477?style=flat-square)](https://vfx-store.pages.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-83bfd6?style=flat-square)](LICENSE)

**Free runtime. Instant magic.** 28 ready-to-play skills.
A lightweight, zero-runtime-dependency atlas player for **PixiJS v7 and v8**,
with a responsive, interactive showcase. Commercial use welcome.

[Try the live collection →](https://vfx-store.pages.dev/) · [Runtime docs](runtime/README.md) · [Pack format](docs/pack-format.md)

## Quick start

```ts
import { VfxPlayer } from '@lenhonbp/pixijs-vfx-runtime';
const vfx = await VfxPlayer.create(app, { packs: ['packs/free/hoa-fireball.vfxb'] });
vfx.play('hoa-fireball', { from: caster, to: target });
```

```sh
npm install @lenhonbp/pixijs-vfx-runtime
```

Get packs from the showcase's **Desktop pack / Mobile pack** buttons, from
hosted release (see [docs/pack-hosting.md](docs/pack-hosting.md)), or with the
agent skill's fetch script below, and serve them from your app's public directory.

## Use it from an AI coding agent

[`skills/lenhon-vfx`](skills/lenhon-vfx/SKILL.md) is an agent skill (Claude Code,
Codex and other `SKILL.md`-compatible agents) that wires the free packs into an
existing PixiJS project: it installs the runtime, downloads the chosen packs and
writes the integration. It plays baked effects only; it does not author new ones.

```sh
npx skills add lenhonbp/pixijs-skill-vfx   # or copy skills/lenhon-vfx into your agent's skills folder
```

Then ask your agent, for example: *"add Lenhon's fireball and chain lightning to
my PixiJS game, played from the hero to the enemy"*. The bundled script also works
on its own:

```sh
node skills/lenhon-vfx/scripts/fetch-packs.mjs --list
node skills/lenhon-vfx/scripts/fetch-packs.mjs hoa-fireball --out public/vfx
```

## Built for your game

- **28 free skills** — fire, ice, lightning, wind, metal, wood, earth and
  utility, each with a desktop and a mobile pack.
- **Actor tracks** — `handle.pose('caster')` / `handle.pose('target')` provide
  interpolated movement, lift, visibility and facing. Dashes and flight move
  the showcase's swordsman, with grounded shadows and hit reactions.
- **Ordered, independently scaled layers** — crisp details and additive glow,
  with per-skill quality presets and selective 60 FPS. Most casts use up to three
  ordered layers; Stone Skin preserves its exact five-layer draw order.
- **Desktop and mobile packs** — the showcase lazy-loads only the selected
  skill, and releases the previous pack.
- **Gameplay feedback** — pooling, cue events, optional screen shake and
  hit-stop. The showcase adds sound hints, looping and a release-synchronized sword cast.
- **Measured zero-GC** — 50-100 concurrent skills at 60 and 120 FPS stay under
  100 B/frame of runtime allocation with no major GC; `npm run bench` gates it
  and writes [benchmarks/latest.md](benchmarks/latest.md).
- **Spritesheet demo caster** — a feet-anchored swordsman with a 24-frame,
  680 ms source clip, time-warped to align its 270 ms release with each effect.
  The drawn caster is retained only if the character sheet fails to load.
- **English + Vietnamese** names, searchable collection, shareable skill links,
  copyable integration snippets and per-skill desktop/mobile pack downloads.

Only baked assets are distributed: no procedural authoring factory or baker
implementation is included. The runtime and showcase remain MIT.

The showcase pairs a searchable effect library with a live stage. Preview all
eight cast directions against Stage, Dark, Light or Alpha backgrounds, then
download the complete effect kit or copy its integration code. The mobile layout
keeps browsing and playback together, with technical details below the library.

## Collection size and loading

The 28 skills include **256 desktop/mobile containers across their baked
directions**: 296,395,974 bytes desktop + 104,670,426 bytes mobile = **401,066,400
bytes**. The binaries live outside git on the pack host (see
[docs/pack-hosting.md](docs/pack-hosting.md)); `showcase/public/packs/free/` keeps
only the index. You only need the packs selected for your game; the showcase
loads the selected skill and direction on demand. Each manifest specifies its
playback frame rate. To work on the showcase or run `check:runtime` locally,
fetch the packs once:

```sh
node skills/lenhon-vfx/scripts/fetch-packs.mjs --all --out showcase/public/packs/free
```

This also saves the live release's `index.json` into that folder (overwriting the committed copy in your working
tree), so the packs and the index always match even when a newer release has been published.

Measured before this presentation refresh, on 2026-11-22, the default Fireball
cold first load was **2,195,377 bytes
desktop / 1,444,150 bytes mobile**, including the application, character artwork
and HTTP overhead on a local uncompressed server. See
[download sizes and measurement conditions](docs/pack-format.md#current-free-collection-and-download-sizes)
for the full breakdown.

## Current collection and future releases

**All 28 effects in the current collection are Free.** The current priority is a
polished, useful showcase for those effects. Premium VFX will be developed later;
there are no Premium product listings, trailers, prices or checkout links in the
production catalog.

The catalog keeps support for future Premium releases in its data model and
isolated test fixtures. Those fixtures do not represent announced products and
are not included in the deployed page.

See [storefront catalog maintenance](docs/storefront-catalog.md) for product data,
release requirements and the boundary between public previews and paid delivery.

## Run the showcase locally

```sh
npm install
npm run dev:showcase
# Production: npm run build
# Browser smoke (build first): npm run check:runtime
# Types: npm run typecheck
# Catalog: npm run check:catalog
```

GitHub Pages deploys the Vite showcase.

## License

© 2026 lenhonbp <lenhonbp@gmail.com> · [MIT license](LICENSE).
The runtime, showcase code, Free collection and public format examples are MIT
licensed. Keep the copyright and license notice when redistributing runtime code.
Character artwork (c) 2026 lenhonbp; excluded from the MIT licence.
Any future Premium release will state its customer terms separately. Existing
MIT grants on previously published material remain unchanged.
