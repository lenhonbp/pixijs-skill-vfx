# lenhon.dev Hub

Static landing page and Asset Explorer for **lenhon.dev**: it links the VFX store
([vfx.lenhon.dev](https://vfx.lenhon.dev), this repo's showcase) and the Isometric Props
store ([props.lenhon.dev](https://props.lenhon.dev), Isobaker), with a card for every
released effect and prop pack.

Vite + vanilla TypeScript + Tailwind CSS v4. Every card is rendered into `index.html`
at build time from the specs snapshots, so the deployed page is plain HTML/CSS with a
~4 kB script for tabs, filters and hover previews. Fonts are self-hosted; nothing is
loaded from third parties.

```sh
cd hub
npm ci
npm run dev       # http://localhost:5173
npm run build     # typecheck → vite build → scripts/check-dist.mjs gate
```

## Deploy (Cloudflare Pages)

Create a Pages project connected to this repository:

| Setting | Value |
| --- | --- |
| Project name | `lenhon-hub` |
| Production branch | `main` |
| Root directory | `hub` |
| Build command | `npm run build` |
| Build output | `dist` |
| Build watch paths (optional) | include `hub/*`, `showcase/public/packs-release.json`, `showcase/public/packs/free/index.json` |

Then add `lenhon.dev` as its custom domain (the apex needs the zone on Cloudflare DNS).
Setting `hub/*` as an *exclude* watch path on the `vfx-store` project avoids rebuilding
the showcase for Hub-only changes. `npx wrangler pages deploy` also works with the
included `wrangler.toml` for a direct upload.

`public/_headers` sets a strict CSP (self-only) and long-lived caching for hashed
assets; `public/_redirects` adds `/vfx`, `/props`, `/github` and `/docs` short links.

## Configuration

`src/site.config.ts` holds every outbound link. Two can be set as Pages environment
variables without a code change:

- `HUB_GUMROAD_URL` — Gumroad storefront. While empty, the Gumroad buttons and the
  footer store card show **coming soon** instead of linking to a listing that does not
  exist. Per-asset product links go in `gumroadProducts`.
- `HUB_CONTACT` — contact link (default: the `mailto:` from this repo's package.json).

The VFX **Free Sample** links follow `showcase/public/packs-release.json`, so a factory
release PR moves them with the showcase. Outside this repository the committed
`src/data/release.json` snapshot is used.

## Data and media (all generated)

| File | Produced by |
| --- | --- |
| `src/data/vfx-specs.json` | `node hub/scripts/vfx-specs.mjs showcase/public/packs/free` — decodes every desktop and mobile pack: FPS, frames, layers, decoded VRAM |
| `public/media/vfx/<id>.webp` / `.mp4`, `reel.mp4` | `hub/scripts/capture-vfx.mjs` (deterministic 30 FPS frames from the showcase) → `hub/scripts/vfx-media.py` |
| `src/data/props-specs.json`, `public/media/props/*` | `python3 -I hub/scripts/props-media.py <iso-prop-tile-baker> hub` after `npm run pages:build` there |

The build warns when `showcase/public/packs/free/index.json` no longer matches the specs
snapshot, i.e. when a new release needs the media and specs regenerated. The VRAM badge
is the mobile pack's decoded RGBA size, green when it fits the A15 tier's 45 MB
per-direction line and amber when it is over it.
