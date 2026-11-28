import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { facts, fill } from './src/render.ts';
import { media } from './src/data/catalog.ts';
import { site } from './src/site.config.ts';
import specs from './src/data/vfx-specs.json' with { type: 'json' };

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

// The VFX release the Hub links to follows the showcase's release pointer, so a factory release PR
// moves the Free Sample links too. Outside this repository, the committed snapshot is used.
function release(): { base: string; release: string } {
  const pointer = here('../showcase/public/packs-release.json');
  const r = readJson(existsSync(pointer) ? pointer : here('./src/data/release.json'));
  if (r?.version !== 1 || !/^https:\/\/[^\s?#]+$/.test(r.base) || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(r.release)) throw new Error('Invalid packs release pointer');
  // HUB_PACKS_BASE points the page at another copy of the same release (local browser tests).
  const override = process.env.HUB_PACKS_BASE?.trim();
  if (override && !/^https?:\/\/[^\s?#]+$/.test(override)) throw new Error('Invalid HUB_PACKS_BASE');
  return { base: override || r.base, release: r.release };
}

// Size of the whole Free release on the CDN (every direction, desktop + mobile), from the showcase index.
function cdnTotals(): { bytes: number; files: number } {
  const index = here('../showcase/public/packs/free/index.json');
  if (!existsSync(index)) { const r = readJson(here('./src/data/release.json')); return { bytes: r.cdnBytes, files: r.cdnFiles }; }
  type Variant = { desktopBytes: number; mobileBytes: number };
  let bytes = 0, files = 0;
  for (const p of readJson(index) as (Variant & { directions?: Record<string, Variant> })[]) {
    for (const v of [p, ...Object.values(p.directions ?? {})]) { bytes += v.desktopBytes + v.mobileBytes; files += 2; }
  }
  return { bytes, files };
}

// Warn when the published collection changed since the specs snapshot was decoded.
function checkSnapshot() {
  const index = here('../showcase/public/packs/free/index.json');
  if (!existsSync(index)) return;
  const live = readJson(index) as { id: string; desktopBytes: number; mobileBytes: number }[];
  const snap = new Map(specs.map(s => [s.id, s]));
  const stale = live.filter(p => snap.get(p.id)?.desktop.bytes !== p.desktopBytes || snap.get(p.id)?.mobile.bytes !== p.mobileBytes).map(p => p.id);
  if (stale.length || live.length !== specs.length) {
    console.warn(`[hub] VFX specs snapshot is stale for: ${stale.join(', ') || '(count changed)'} — rerun hub/scripts/vfx-specs.mjs and capture media.`);
  }
}

/** The optional analytics endpoint must be https; its origin is the only extra origin the page may call. */
function analyticsOrigin(): string {
  if (!site.analytics) return '';
  if (!/^https:\/\/[^\s?#]+$/.test(site.analytics)) throw new Error('HUB_ANALYTICS_ENDPOINT must be an https URL');
  return new URL(site.analytics).origin;
}

const HERO_VFX = 'hoa-fire-dragon-crossing';

// Response headers for Cloudflare Pages. Everything under /assets and /media is referenced by a content-hashed URL
// (Vite's file names, or `?v=<hash>` from catalog.ts#media), so a year-long immutable cache can never serve a stale file. The CSP allows exactly the outside origins the page calls: the R2 CDN the inspector
// and the JSON + WebP export fetch packs from, and the optional analytics endpoint. Pack sheets become blob: images inside the runtime.
function headers(origins: string[]): string {
  const csp = [
    "default-src 'self'", "script-src 'self'", "style-src 'self'", "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:", "media-src 'self'", "font-src 'self'", `connect-src ${['self', ...origins].map(o => (o === 'self' ? "'self'" : o)).join(' ')}`,
    "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-ancestors 'none'",
  ].join('; ');
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  X-Frame-Options: DENY
  Content-Security-Policy: ${csp}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/media/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

function hub(): Plugin {
  const rel = release();
  const data = facts(rel);
  const cdn = cdnTotals();
  const analytics = analyticsOrigin();
  const hero = data.vfx.find(c => c.id === HERO_VFX);
  if (!hero) throw new Error(`Hero effect ${HERO_VFX} is not in the collection`);
  const tokens = { heroPoster: media(`/media/vfx/${hero.id}.webp`), heroReel: media('/media/vfx/reel.mp4'), heroName: hero.title, cdnMB: Math.round(cdn.bytes / 1e6), cdnFiles: cdn.files, analyticsUrl: site.analytics };
  return {
    name: 'lenhon-hub',
    buildStart: checkSnapshot,
    generateBundle() { this.emitFile({ type: 'asset', fileName: '_headers', source: headers([new URL(rel.base).origin, ...(analytics ? [analytics] : [])]) }); },
    transformIndexHtml: { order: 'pre', handler: html => fill(html, data, tokens) },
  };
}

export default defineConfig({
  plugins: [hub(), tailwindcss()],
  // The inspector plays packs through this repo's runtime (../runtime/src), against the Hub's own PixiJS.
  resolve: { dedupe: ['pixi.js'] },
  server: { fs: { allow: [here('..')] } },
  build: { target: 'es2022', assetsInlineLimit: 0, cssMinify: true },
});
