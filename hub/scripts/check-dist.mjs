// Post-build gate: the static page must be complete, self-contained and consistent before it reaches Pages.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const fail = [];

if (/\{\{\w+\}\}|<!--hub:|<!--gumroad:/.test(html)) fail.push('unfilled template token in index.html');

// Every same-origin reference (src, href, lazy data-src / data-spin) must exist in dist.
const refs = new Set([...html.matchAll(/\s(?:src|href|data-src|data-spin)="(\/[^"#?]*)(?:\?[^"#]*)?"/g)].map(m => m[1]));
for (const ref of refs) {
  if (!existsSync(join(dist, ref === '/' ? 'index.html' : ref))) fail.push(`missing ${ref}`);
}

// Media is served immutable for a year, so every /media reference (markup and preview data) must carry ?v=<hash>
// and the hash must match the file that actually ships; otherwise a changed poster could be served stale.
const versioned = new Set();
const checkVersion = (url) => {
  if (versioned.has(url)) return;
  versioned.add(url);
  const m = url.match(/^(\/media\/[^?]+)\?v=([0-9a-f]{10})$/);
  if (!m) { fail.push(`unversioned media reference ${url}`); return; }
  const file = join(dist, m[1]);
  if (!existsSync(file)) { fail.push(`missing ${m[1]}`); return; }
  if (createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10) !== m[2]) fail.push(`stale version on ${url}`);
};
for (const m of html.matchAll(/\s(?:src|href|data-src|data-spin)="(\/media\/[^"#]*)"/g)) checkVersion(m[1]);

// No third-party code or fonts: scripts, styles and fonts are bundled.
for (const m of html.matchAll(/<(script|link)\b[^>]*\b(?:src|href)="(https?:[^"]+)"/g)) {
  if (m[1] === 'script' || /stylesheet|preload|modulepreload/.test(m[0])) fail.push(`external ${m[1]}: ${m[2]}`);
}

// Preview data for the inspector: every card has an entry and every lazily loaded media file exists.
const json = html.match(/<script type="application\/json" id="hub-data">([\s\S]*?)<\/script>/);
const previews = json ? JSON.parse(json[1]).previews : {};
const cardIds = [...html.matchAll(/data-open-preview="([^"]+)"/g)].map(m => m[1]);
for (const id of cardIds) if (!previews[id]) fail.push(`no preview data for ${id}`);
for (const p of Object.values(previews)) {
  for (const src of [p.turntable?.src, p.poster, p.spin].filter(Boolean)) checkVersion(src);
}

// Spec badges: exactly the four standard ones, and the tier badge must agree with the measured VRAM.
const A15 = 45_000_000;
const cards = [...html.matchAll(/<article class="card[\s\S]*?<\/article>/g)].map(m => m[0]);
for (const card of cards) {
  const id = card.match(/data-open-preview="([^"]+)"/)?.[1];
  const badges = [...card.matchAll(/<li class="badge[^"]*"[^>]*>([^<]+)<\/li>/g)].map(m => m[1]);
  const tier = badges[3];
  if (badges.slice(0, 3).join() !== 'PixiJS 8.x,WebP Atlas,Zero-GC' || !['A15 Verified', 'Desktop Tier'].includes(tier)) fail.push(`${id}: non-standard badges ${badges.join(' | ')}`);
  const p = previews[id];
  if (!p) continue;
  const vram = p.kind === 'vfx' ? p.packs.mobile.vram : p.vram;
  const expected = vram <= A15 ? 'A15 Verified' : 'Desktop Tier';
  if (tier !== expected || p.tier !== (vram <= A15 ? 'mobile' : 'heavy')) fail.push(`${id}: tier badge "${tier}" contradicts ${(vram / 1e6).toFixed(1)} MB`);
  if (!card.includes(vram <= A15 ? 'Mobile Tier (A15 &lt;45MB)' : 'Desktop / Heavy Tier')) fail.push(`${id}: VRAM bar label missing`);
}
const vfx = cards.filter(c => c.includes('data-kind="vfx"')).length, props = cards.length - vfx;
if (vfx < 1 || props < 1) fail.push(`expected cards in both tabs, found vfx=${vfx} props=${props}`);
const heavy = cards.filter(c => c.includes('data-tier="heavy"')).map(c => c.match(/data-open-preview="([^"]+)"/)[1]);

// Inspector Actor Dummy: two vector assets (caster mannequin, target training post), hashed by Vite into /assets,
// loaded only on demand, each under 100 kB.
const built = readdirSync(join(dist, 'assets'));
for (const name of ['actor-caster', 'actor-target']) {
  const file = built.find(f => new RegExp(`^${name}-[\\w-]+\\.svg$`).test(f));
  if (!file) fail.push(`missing hashed assets/${name}-*.svg`);
  else if (statSync(join(dist, 'assets', file)).size >= 100_000) fail.push(`${file} is ${statSync(join(dist, 'assets', file)).size} B (budget 100 kB)`);
}
// No character asset may ship under /media (old single-model dummy, showcase swordsman) or as a sprite sheet.
const media = (dir) => (existsSync(join(dist, dir)) ? readdirSync(join(dist, dir)) : []);
for (const f of [...media('media'), ...media('actors')]) if (/^actor-|swordsman|son-ha-kiem/.test(f)) fail.push(`stale character asset ${f}`);
if (existsSync(join(dist, 'actors'))) fail.push('stale actors/ directory in dist');

// Cloudflare headers: the CSP must let the inspector reach the pack CDN (and nothing else outside).
const headers = existsSync(join(dist, '_headers')) ? readFileSync(join(dist, '_headers'), 'utf8') : '';
const cdn = Object.values(previews).find(p => p.kind === 'vfx')?.packs.desktop.url;
if (!cdn || !headers.includes(`connect-src 'self' ${new URL(cdn).origin}`)) fail.push('_headers CSP does not allow the pack CDN');

// Bundle budget: the page itself stays tiny; the inspector (PixiJS + runtime) loads only on demand.
const assets = built;
const size = f => statSync(join(dist, 'assets', f)).size;
const entry = html.match(/<script type="module"[^>]*src="\/assets\/([^"]+\.js)"/)?.[1];
const entryJs = entry ? size(entry) : 0;
const lazyJs = assets.filter(f => f.endsWith('.js') && f !== entry).reduce((n, f) => n + size(f), 0);
const css = assets.filter(f => f.endsWith('.css')).reduce((n, f) => n + size(f), 0);
if (!entry) fail.push('no entry script');
if (entryJs > 20_000) fail.push(`entry JS ${entryJs} B exceeds 20 kB`);
if (lazyJs > 900_000) fail.push(`lazy JS ${lazyJs} B exceeds 900 kB`);
if (css > 70_000) fail.push(`CSS bundle ${css} B exceeds 70 kB`);

// Not a failure, but loud: the specs and media are a snapshot of one Free release; if the showcase index has moved on
// (a new release was pointed at), the numbers on the cards no longer match what the CDN serves.
const indexFile = new URL('../../showcase/public/packs/free/index.json', import.meta.url).pathname;
if (existsSync(indexFile)) {
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  const drift = index.filter(e => {
    const v = previews[e.id];
    return !v || v.packs.desktop.bytes !== e.desktopBytes || v.packs.mobile.bytes !== e.mobileBytes;
  }).map(e => e.id);
  if (drift.length) console.warn(`WARNING: the card specs and media are stale for ${drift.length} effect(s) (${drift.slice(0, 4).join(', ')}${drift.length > 4 ? ', …' : ''}); regenerate them (see "Keeping up with a Free release" in hub/README.md).`);
}

if (fail.length) {
  console.error('Hub dist check failed:\n  ' + fail.join('\n  '));
  process.exit(1);
}
console.log(`Hub dist OK: ${vfx} VFX + ${props} props cards (heavy tier: ${heavy.join(', ') || 'none'}), ${refs.size} local refs, entry JS ${entryJs} B, lazy JS ${lazyJs} B, CSS ${css} B, HTML ${Buffer.byteLength(html)} B`);
