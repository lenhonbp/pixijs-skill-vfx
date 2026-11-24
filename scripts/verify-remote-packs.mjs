#!/usr/bin/env node
// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Checks that a remote copy of the Free packs (CDN/R2/other) matches index.json: every listed file
// exists with the exact byte size, and the host answers browser requests from the showcase origin.
// Read-only. Node 18+, no dependencies.
//   node scripts/verify-remote-packs.mjs <base-url> [--origin https://lenhonbp.github.io] [--index showcase/public/packs/free/index.json]
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const usage = 'Usage: node scripts/verify-remote-packs.mjs <base-url> [--origin URL] [--index FILE]';
const opts = { origin: 'https://lenhonbp.github.io', index: 'showcase/public/packs/free/index.json' };
let baseUrl;
for (let i = 0; i < args.length; i++) {
  if (['--origin', '--index'].includes(args[i]) && args[i + 1]) opts[args[i].slice(2)] = args[++i];
  else if (args[i].startsWith('--')) { console.error(`Unknown option ${args[i]}\n${usage}`); process.exit(2); }
  else baseUrl = args[i];
}
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) { console.error(usage); process.exit(2); }
const base = baseUrl.replace(/\/+$/, '') + '/';

const index = JSON.parse(await readFile(opts.index, 'utf8'));
const files = new Map();
const add = list => { for (const f of list ?? []) files.set(f.name, f.bytes); };
for (const p of index) { add(p.files); for (const d of Object.values(p.directions ?? {})) add(d.files); }
if (!files.size) { console.error(`No files listed in ${opts.index}`); process.exit(2); }

const failures = [];
const check = async ([name, bytes]) => {
  if (!/^[A-Za-z0-9@._-]+$/.test(name)) { failures.push(`${name}: unsafe file name in index`); return; }
  try {
    const res = await fetch(base + name, { method: 'HEAD', headers: { Origin: opts.origin }, redirect: 'follow' });
    if (!res.ok) return void failures.push(`${name}: HTTP ${res.status}`);
    const length = Number(res.headers.get('content-length'));
    if (length !== bytes) failures.push(`${name}: ${length} B remote, index says ${bytes} B`);
    const allow = res.headers.get('access-control-allow-origin');
    if (allow !== '*' && allow !== opts.origin) failures.push(`${name}: CORS does not allow ${opts.origin} (got ${allow ?? 'none'})`);
  } catch (error) { failures.push(`${name}: ${error.message}`); }
};
const queue = [...files];
await Promise.all(Array.from({ length: 8 }, async () => { for (let item; (item = queue.shift());) await check(item); }));

for (const failure of failures.sort()) console.error(`FAIL ${failure}`);
console.log(`Checked ${files.size} files at ${base}: ${failures.length} failures.`);
if (failures.length) process.exit(1);
