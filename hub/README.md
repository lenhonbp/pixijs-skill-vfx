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
- **Actor Dummy** (inspector toolbar, or the `A` key; off by default, effects only): one vector
  silhouette (`public/media/actor-dummy.svg`, ~3.5 kB, clay/AO lead grey `#21262d` with a `#30363d`
  rim) standing at the caster and the target. It loads on first use, follows the packs' actor
  tracks (dashes, knock-backs, lifts, visibility; facing relative to each station), and sits on a
  contact decal locked to `feet_ground` (0, 0) in the 1/√3 (0.57735) isometric ratio. Draw order:
  ground-under layers < decals < actor bodies < the effect's main layers < body residuals. Closing
  the inspector destroys its texture with the pack's. The HUD's GPU row counts live textures
  (Pixi ≥ 8.15 keeps freed slots as `null`, so only live entries are counted).
- **Downloads**: `.vfxb` links straight to the R2 container. **JSON + WebP** fetches the same
  container, unpacks it in the browser with the runtime's `readContainer` and saves the plain
  encoding (`<id>.vfx.json` + WebP sheets + README) as a ZIP; `vfx.load('<id>.vfx.json')`
  plays it. Prop packs link their release ZIP (WebP atlas + JSON + PNGs) on props.lenhon.dev,
  which is where Isobaker publishes them (they are not on R2).
- **Tech Docs** in the nav jumps to the on-page `#pipeline` section (marked *Docs v1.4 · soon*)
  until docs.lenhon.dev is deployed; `/docs` and `/#docs` land there too.

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
and long-lived caching for hashed assets. `public/_redirects` adds `/vfx`, `/props`,
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

## Data and media (all generated)

| File | Produced by |
| --- | --- |
| `src/data/vfx-specs.json` | `node hub/scripts/vfx-specs.mjs showcase/public/packs/free`: decodes every desktop and mobile pack (FPS, frames, layers, sheets, decoded VRAM) |
| `public/media/vfx/<id>.webp` / `.mp4`, `reel.mp4` | `hub/scripts/capture-vfx.mjs` (deterministic 30 FPS frames from the showcase) → `hub/scripts/vfx-media.py` |
| `src/data/props-specs.json`, `public/media/props/*` | `python3 -I hub/scripts/props-media.py <iso-prop-tile-baker> hub` after `npm run pages:build` there (card art, hover strip, 2× inspector turntable, sprite sizes, 1/√3 projection check) |

The build warns when `showcase/public/packs/free/index.json` no longer matches the specs
snapshot, i.e. when a new release needs the media and specs regenerated. `check-dist`
fails the build if the Actor Dummy asset is missing or not under 100 kB, if a card's badges are not the standard four, if a tier badge disagrees with
the measured VRAM, if the CSP does not allow the pack CDN, or if the entry script grows past
20 kB.
