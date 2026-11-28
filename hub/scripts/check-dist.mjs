// Post-build gate: the static page must be complete and self-contained before it reaches Pages.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const fail = [];

if (/\{\{\w+\}\}|<!--hub:|<!--gumroad:/.test(html)) fail.push('unfilled template token in index.html');

// Every same-origin reference (src, href, poster, lazy data-src / data-spin) must exist in dist.
const refs = new Set([...html.matchAll(/\s(?:src|href|data-src|data-spin)="(\/[^"#?]*)"/g)].map(m => m[1]));
for (const ref of refs) {
  const file = join(dist, ref === '/' ? 'index.html' : ref);
  if (!existsSync(file)) fail.push(`missing ${ref}`);
}

// No third-party code or fonts: scripts, styles and fonts are bundled.
for (const m of html.matchAll(/<(script|link)\b[^>]*\b(?:src|href)="(https?:[^"]+)"/g)) {
  if (m[1] === 'script' || /stylesheet|preload|modulepreload/.test(m[0])) fail.push(`external ${m[1]}: ${m[2]}`);
}

const cards = (kind) => (html.match(new RegExp(`data-kind="${kind}"`, 'g')) ?? []).length;
const vfx = cards('vfx'), props = cards('props');
if (vfx < 1 || props < 1) fail.push(`expected cards in both tabs, found vfx=${vfx} props=${props}`);

const assets = readdirSync(join(dist, 'assets'));
const size = (ext) => assets.filter(f => f.endsWith(ext)).reduce((n, f) => n + statSync(join(dist, 'assets', f)).size, 0);
const js = size('.js'), css = size('.css');
if (js > 20_000) fail.push(`JS bundle ${js} B exceeds 20 kB`);
if (css > 60_000) fail.push(`CSS bundle ${css} B exceeds 60 kB`);

if (fail.length) {
  console.error('Hub dist check failed:\n  ' + fail.join('\n  '));
  process.exit(1);
}
console.log(`Hub dist OK: ${vfx} VFX + ${props} props cards, ${refs.size} local refs, JS ${js} B, CSS ${css} B, HTML ${Buffer.byteLength(html)} B`);
