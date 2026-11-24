#!/usr/bin/env node
// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Downloads free Lenhon VFX packs into a project. Node 18+, no dependencies.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const usage = `Usage: node fetch-packs.mjs <id...|--all> [--out public/vfx] [--tier both|desktop|mobile] [--source URL]
       node fetch-packs.mjs --list`;
const args = process.argv.slice(2), ids = [];
const site = 'https://vfx-store.pages.dev/';
const opts = { out: 'public/vfx', tier: 'both', source: null };
// The active pack release is named by the site's pointer file; older deployments serve packs/free/ directly.
async function activeSource() {
  try {
    const response = await fetch(site + 'packs-release.json');
    if (response.ok) {
      const { base, release } = await response.json();
      if (typeof base === 'string' && /^https:\/\/[^\s?#]+$/.test(base) && typeof release === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(release)) return `${base.replace(/\/+$/, '')}/${release}/`;
    }
  } catch { /* fall back below */ }
  return site + 'packs/free/';
}
let all = false, list = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--all') all = true;
  else if (a === '--list') list = true;
  else if (a === '--help' || a === '-h') { console.log(usage); process.exit(0); }
  else if (['--out', '--tier', '--source'].includes(a) && args[i + 1]) opts[a.slice(2)] = args[++i];
  else if (a.startsWith('--')) { console.error(`Unknown option ${a}\n${usage}`); process.exit(2); }
  else ids.push(a);
}
if (!['both', 'desktop', 'mobile'].includes(opts.tier)) { console.error(`--tier must be both, desktop or mobile\n${usage}`); process.exit(2); }
const chosen = opts.source ?? await activeSource();
const source = chosen.endsWith('/') ? chosen : chosen + '/';
const response = await fetch(source + 'index.json');
if (!response.ok) throw Error(`Could not read ${source}index.json (HTTP ${response.status})`);
const collection = await response.json();
if (list) {
  for (const p of collection) console.log(`${p.id.padEnd(26)} ${p.element.padEnd(8)} ${p.category.padEnd(8)} ${p.name.en} / ${p.name.vi}`);
  process.exit(0);
}
if (!all && !ids.length) { console.error(usage); process.exit(2); }
const wanted = [], unknown = [], missing = [];
for (const arg of all ? collection.map(p => p.id) : ids) {
  const at = arg.lastIndexOf('@'), id = at < 0 ? arg : arg.slice(0, at), dir = at < 0 ? null : arg.slice(at + 1);
  const entry = collection.find(p => p.id === id);
  if (!entry) { unknown.push(arg); continue; }
  if (dir === null) { wanted.push(entry); continue; }
  const variant = dir === '0' ? { files: entry.files } : entry.directions?.[dir];
  if (!variant) { missing.push(arg); continue; }
  wanted.push({ ...entry, files: variant.files, directions: undefined });
}
if (unknown.length) { console.error(`Unknown pack id: ${unknown.join(', ')}. Run with --list.`); process.exit(2); }
if (missing.length) { console.error(`Pack has no direction bake: ${missing.join(', ')}. Directional ids look like hoa-fireball@90.`); process.exit(2); }
const files = wanted.flatMap(p => [...p.files, ...Object.values(p.directions ?? {}).flatMap(d => d.files)]).filter(f => opts.tier === 'both' || f.name.endsWith('.m.vfxb') === (opts.tier === 'mobile'));
const out = resolve(opts.out);
await mkdir(out, { recursive: true });
for (const file of files) {
  if (!/^[a-z0-9-]+(?:@-?\d+)?(?:\.m)?\.vfxb$/.test(file.name) || !Number.isSafeInteger(file.bytes)) throw Error(`Refusing unexpected index entry ${JSON.stringify(file.name)}`);
  const res = await fetch(source + file.name);
  if (!res.ok) throw Error(`${file.name}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length !== file.bytes) throw Error(`${file.name}: expected ${file.bytes} bytes, got ${bytes.length}`);
  await writeFile(resolve(out, file.name), bytes);
  console.log(`${file.name}  ${(bytes.length / 1e6).toFixed(2)} MB`);
}
console.log(`Saved ${files.length} file(s) to ${out}`);
