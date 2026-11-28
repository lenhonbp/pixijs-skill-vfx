// Everything the Hub links to lives here. Evaluated at build time (Node), so the storefront
// links can also be set from Cloudflare Pages environment variables without a code change.
const env = (name: string, fallback = ''): string => (process.env[name] ?? fallback).trim();

export const site = {
  domain: 'lenhon.dev',
  url: 'https://lenhon.dev',
  /** Cloudflare Pages project `vfx-store` (pixijs-skill-vfx showcase). Effects deep-link as `#<id>`. */
  vfx: 'https://vfx.lenhon.dev',
  /** Cloudflare Pages project `isobaker`. Packs live at `/<id>/`, their ZIP next to the page. */
  props: 'https://props.lenhon.dev',
  github: 'https://github.com/lenhonbp',
  githubHandle: '@lenhonbp',
  repo: 'https://github.com/lenhonbp/pixijs-skill-vfx',
  /**
   * Gumroad storefront, e.g. `https://<name>.gumroad.com`. Empty = the Gumroad buttons render as
   * "coming soon" instead of pointing at a listing that does not exist yet.
   */
  gumroad: env('HUB_GUMROAD_URL'),
  /** Per-asset Gumroad product links (`id` → URL). Assets without one fall back to the store. */
  gumroadProducts: {} as Record<string, string>,
  contact: env('HUB_CONTACT', 'mailto:lenhonbp@gmail.com'),
} as const;
