# lenhon.dev Hub

Static landing page and Asset Explorer for **lenhon.dev**: it links the VFX store
([vfx.lenhon.dev](https://vfx.lenhon.dev), this repo's showcase) and **Iso Props (Powered by
Isobaker)** ([props.lenhon.dev](https://props.lenhon.dev)), with a card for every released
effect and prop pack.

Vite + vanilla TypeScript + Tailwind CSS v4. Every card is rendered into `index.html`
at build time from the specs snapshots, so the deployed page is plain HTML/CSS with a
~7 kB entry script for tabs, filters, hover previews, copy and downloads. Fonts are
self-hosted; nothing is loaded from third parties except packs from the R2 CDN.

```sh
cd hub
npm ci
npm run dev       # http://localhost:5173
npm run build     # typecheck → vite build → scripts/check-dist.mjs gate
```

## What the page does

- **Cards** carry exactly four spec badges: `PixiJS 8.x`, `WebP Atlas`, `Zero-GC` and the
  tier badge. The tier comes from one rule applied to the measured decoded VRAM (the mobile
  pack for effects, the albedo + shadow atlas for props): ≤ 45 MB is **A15 Verified** /
  *Mobile Tier (A15 <45MB)* with an emerald bar; above it is **Desktop Tier** / *Desktop /
  Heavy Tier* with the overflow past the A15 line in amber. The FPS line separates the bake
  rate of the frames from the 60–120 FPS game-loop target.
- **Inspector** (click a preview, or open `/#inspect/<id>`): play/pause, a frame scrubber,
  0.5× / 1.0× speed, Dark Studio / Iso Grid / Ground Scorch backdrops and a live HUD (VRAM,
  frame, time, bounds). Effects play the released `.vfxb` from the R2 CDN through this repo's
  runtime (`../runtime/src`) on PixiJS 8.23, with the showcase's ground squash, impact layers
  and ground dissolve; hitstop and shake are off so the scrubber maps 1:1 to frames. A
  desktop/mobile switch loads either pack. Props turn their landmark prop through the eight
  facings of Isobaker's native 2× bake on a 2D canvas over a 1/√3 grid. PixiJS and the
  runtime load only when an effect is first inspected; the inspector frame loop swaps
  precomputed HUD strings and allocates nothing of its own.
- **Actor Dummy** (inspector toolbar, or the `A` key; off by default, effects only): two small vector
  assets in clay/AO lead grey (`#21262d`, `#30363d` rim) that load on first use. The caster
  (`src/assets/actor-caster.svg`, ~4 kB) is an unarmed humanoid mannequin, about seven heads tall,
  in a neutral ready stance with open hands, so it suits spells, blades and strikes alike. The target
  (`src/assets/actor-target.svg`, ~3 kB) is a padded wooden training post planted in an earth collar, with a
  chest-height ring marking where most blows land; it is symmetric and never mirrors. Both follow the
  packs' actor tracks (dashes, knock-backs, lifts, visibility) and stand on contact decals locked to
  `feet_ground` (0, 0) in the 1/√3 (0.57735) ground ratio; the target's decal adds a centre tick and
  an outer ring with four ticks for the skill's landing point and contact zone. Draw order:
  ground-under layers < decals < actor bodies < the effect's main layers < body residuals. Closing
  the inspector destroys both textures with the pack's. The HUD's GPU row counts live textures
  (Pixi ≥ 8.15 keeps freed slots as `null`, so only live entries are counted).
- **Downloads**: `.vfxb` links straight to the R2 container. **JSON + WebP** fetches the same
  container, unpacks it in the browser with the runtime's `readContainer` and saves the plain
  encoding (`<id>.vfx.json` + WebP sheets + README) as a ZIP; `vfx.load('<id>.vfx.json')`
  plays it. Prop packs link their release ZIP (WebP atlas + JSON + PNGs) on props.lenhon.dev,
  which is where Isobaker publishes them (they are not on R2).
- **Tech Docs** in the nav jumps to the on-page `#pipeline` section (marked *Docs v1.4 · soon*)
  until docs.lenhon.dev is deployed; `/docs` and `/#docs` land there too.

## Responsive rules

Tested at 320, 360, 375, 390, 430 (phones), 844×390 (landscape phone), 768, 1024, 1280, 1440, 1920 and 2560 px.
No horizontal overflow at any of them; every image has intrinsic `width`/`height` (zero layout shift).

- **Breakpoints**: `sm` 640 (2 columns), `lg` 1024 (3), `xl` 1280 (4), `2xl` 1536 (5, the shell widens to 96 rem).
  The header switches to the full nav on a custom `desk` variant: ≥1280 px, or ≥1024 px with a mouse
  (`pointer: fine`), so a tablet in landscape keeps the menu button instead of a cramped nav row.
  Every grid is `grid-cols-1` first (`minmax(0, 1fr)`); an implicit `auto` column let a long install
  command widen the hero past the screen.
- **Touch** (`pointer: coarse`, tablets included): buttons, tabs, chips, the scrubber, menu links, footer
  links and the Copy / Pause buttons are ≥ 44 px (small controls get an invisible hit-area halo).
- **Type**: nothing below 11 px; the faint text colour meets WCAG AA (4.5:1) on every surface.
- **Phones** (≤ 639 px, and landscape phones): the asset grid turns into compact tiles (poster, name, VRAM
  figure and tier). A full card is ~560 px tall, so 28 of them made a 23,000 px page; the tiles bring it to
  ~8,900 px (landscape: 12,800 → 5,500 px). A tap anywhere on a tile opens the inspector, which carries the
  description, specs, Test Live and every download. The hidden card parts stay in the HTML.
- **Landscape phones** get a two-column inspector (stage | controls) and a header that scrolls away.
- The mobile menu closes on a link, Escape, an outside tap and when the viewport becomes desktop-sized;
  a back-to-top button appears once the explorer has scrolled past the top.

## Deploy (Cloudflare Pages)

Project **`lenhon-hub`**, connected to this repository:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `hub` |
| Build command | `npm run build` |
| Build output | `dist` |
| Build watch paths | include `hub/*`, `showcase/public/packs-release.json`, `showcase/public/packs/free/index.json` |

Add `lenhon.dev` as its custom domain (the apex needs the zone on Cloudflare DNS).
Setting `hub/*` as an *exclude* watch path on the `vfx-store` project avoids rebuilding
the showcase for Hub-only changes. The build also reads `../runtime` and `../showcase/src/zip.ts`,
which Pages has because it clones the whole repository.

There is deliberately no `wrangler.toml`: Pages would treat it as the source of truth and
ignore dashboard environment variables such as `HUB_GUMROAD_URL`. `.node-version` pins
Node 22 for the build image (Vite 8 needs ≥ 22.12).

The build writes `dist/_headers`: a self-only CSP whose single outside origin is the R2 CDN
from the release pointer (`connect-src`), `blob:` images for the runtime's sheet decoding,
and a one-year `immutable` cache for `/assets` and `/media`. That is safe because neither is ever
referenced by a fixed name: Vite hashes `/assets` files (the two actor SVGs live there too), and every
`/media` URL carries `?v=<first 10 hex of the file's SHA-256>` computed at build time
(`catalog.ts#media`). A re-captured poster therefore gets a new URL and no browser or CDN can keep
showing the old one; `check-dist` fails the build if a media reference is unversioned or its hash
does not match the shipped file. `public/_redirects` adds `/vfx`, `/props`,
`/github` and `/docs` short links.

## Configuration

`src/site.config.ts` holds every outbound link. Two can be set as Pages environment
variables without a code change:

- `HUB_GUMROAD_URL`: Gumroad storefront. While empty, cards show no Gumroad button and the
  footer store card says **coming soon**. Per-asset product links go in `gumroadProducts`.
- `HUB_CONTACT`: contact link (default: the `mailto:` from this repo's package.json).

The VFX download and inspector URLs follow `showcase/public/packs-release.json`, so a factory
release PR moves them with the showcase. Outside this repository the committed
`src/data/release.json` snapshot is used. `HUB_PACKS_BASE` points a build at another copy of
the same release (for local browser tests against same-origin packs).

## Keeping up with a Free release

The Hub's numbers and pictures are snapshots of one Free release, and its download and inspector
links follow `showcase/public/packs-release.json`. After a factory release PR moves that pointer,
refresh the snapshot so the two agree (a stale snapshot is only a build warning, so it is easy to miss):

```sh
node skills/lenhon-vfx/scripts/fetch-packs.mjs --all --out showcase/public/packs/free
node hub/scripts/vfx-specs.mjs showcase/public/packs/free > hub/src/data/vfx-specs.json
# capture + frame the media (see the next section), then update src/data/release.json to the pointer
```

A rebake changes frame counts, so re-check each rebaked effect's poster frame: the ids go to
`vfx-media.py` as separate arguments (`python3 -I hub/scripts/vfx-media.py <frames> <out> id1 id2 … [reel]`),
and its `PEAK` table holds the chosen frame per effect (the 2026-11-28-7f72be2 rebake re-picked Sword Rain and Frost Nova).

Tiers follow from the new sizes automatically (the 2026-11-28-efdfd3a rebake moved Dragon Breath from
45.2 to 44.3 MB, i.e. from Desktop Tier into A15 Verified).

## Data and media (all generated)

| File | Produced by |
| --- | --- |
| `src/data/vfx-specs.json` | `node hub/scripts/vfx-specs.mjs showcase/public/packs/free`: decodes every desktop and mobile pack (FPS, frames, layers, sheets, decoded VRAM) |
| `public/media/vfx/<id>.webp` / `.mp4`, `reel.mp4` | `hub/scripts/capture-vfx.mjs` (deterministic 30 FPS frames of the showcase canvas, **pure VFX**: caster, dummy, shadows, stage floor and compass hidden, `#0d1117` background) → `hub/scripts/vfx-media.py` (frames each effect from where it actually draws; the poster frame for each effect is chosen by eye in its `PEAK` table, the moment the effect is fully formed) |
| `src/data/props-specs.json`, `public/media/props/*` | `python3 -I hub/scripts/props-media.py <iso-prop-tile-baker> hub` after `npm run pages:build` there (card art, hover strip, 2× inspector turntable, sprite sizes, 1/√3 projection check) |

The build warns when `showcase/public/packs/free/index.json` no longer matches the specs
snapshot, i.e. when a new release needs the media and specs regenerated. `check-dist`
fails the build if either Actor Dummy asset is missing or not under 100 kB (or a stale actor asset ships), if a card's badges are not the standard four, if a tier badge disagrees with
the measured VRAM, if the CSP does not allow the pack CDN, or if the entry script grows past
20 kB.
