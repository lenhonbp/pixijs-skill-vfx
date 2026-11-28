import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { facts, fill } from './src/render';
import specs from './src/data/vfx-specs.json' with { type: 'json' };

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

// The VFX release the Hub links to follows the showcase's release pointer, so a factory release PR
// moves the Free Sample links too. Outside this repository, the committed snapshot is used.
function release(): { base: string; release: string } {
  const pointer = here('../showcase/public/packs-release.json');
  const r = readJson(existsSync(pointer) ? pointer : here('./src/data/release.json'));
  if (r?.version !== 1 || !/^https:\/\/[^\s?#]+$/.test(r.base) || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(r.release)) throw new Error('Invalid packs release pointer');
  return { base: r.base, release: r.release };
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

const HERO_VFX = 'hoa-fire-dragon-crossing';

function hub(): Plugin {
  const data = facts(release());
  const cdn = cdnTotals();
  const hero = data.vfx.find(c => c.id === HERO_VFX);
  if (!hero) throw new Error(`Hero effect ${HERO_VFX} is not in the collection`);
  const tokens = { heroVfx: hero.id, heroName: hero.title, cdnMB: Math.round(cdn.bytes / 1e6), cdnFiles: cdn.files };
  return {
    name: 'lenhon-hub',
    buildStart: checkSnapshot,
    transformIndexHtml: { order: 'pre', handler: html => fill(html, data, tokens) },
  };
}

export default defineConfig({
  plugins: [hub(), tailwindcss()],
  build: { target: 'es2022', assetsInlineLimit: 0, cssMinify: true },
});
