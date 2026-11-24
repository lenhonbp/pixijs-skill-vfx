// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./fetch-packs.mjs', import.meta.url));
const file = (name, text) => ({ name, bytes: Buffer.byteLength(text), text });
const files = [file('alpha.vfxb', 'alpha desktop'), file('alpha.m.vfxb', 'alpha mobile'), file('beta.vfxb', 'beta desktop'), file('beta.m.vfxb', 'beta mobile')];
const index = JSON.stringify([
  { id: 'alpha', name: { en: 'Alpha', vi: 'Alpha' }, element: 'hoa', category: 'attack', files: files.slice(0, 2).map(({ name, bytes }) => ({ name, bytes })) },
  { id: 'beta', name: { en: 'Beta', vi: 'Beta' }, element: 'kim', category: 'attack', files: files.slice(2).map(({ name, bytes }) => ({ name, bytes })) },
]);

async function withRelease(run) {
  const server = createServer((req, res) => {
    const name = new URL(req.url, 'http://x').pathname.slice(1);
    if (name === 'index.json') return res.end(index);
    const hit = files.find(f => f.name === name);
    return hit ? res.end(hit.text) : res.writeHead(404).end();
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  try { await run(`http://127.0.0.1:${server.address().port}/`); } finally { server.close(); }
}
// Asynchronous on purpose: the fake release server lives in this process and must keep answering.
const fetchPacks = (source, out, ...args) => new Promise(done => execFile(process.execPath, [script, ...args, '--out', out, '--source', source], { encoding: 'utf8', timeout: 30000 },
  (error, stdout, stderr) => done({ status: error ? error.code ?? 1 : 0, stdout, stderr })));

test('--all saves the release index next to the packs, byte for byte, replacing a stale copy', async () => {
  await withRelease(async source => {
    const out = await mkdtemp(join(tmpdir(), 'fetch-packs-'));
    await writeFile(join(out, 'index.json'), '[{"id":"stale"}]');
    const run = await fetchPacks(source, out, '--all');
    assert.equal(run.status, 0, run.stderr);
    assert.equal(await readFile(join(out, 'index.json'), 'utf8'), index);
    assert.deepEqual((await readdir(out)).sort(), ['alpha.m.vfxb', 'alpha.vfxb', 'beta.m.vfxb', 'beta.vfxb', 'index.json']);
  });
});

test('a partial download never writes an index that lists files it did not fetch', async () => {
  await withRelease(async source => {
    for (const args of [['alpha'], ['--all', '--tier', 'desktop']]) {
      const out = await mkdtemp(join(tmpdir(), 'fetch-packs-'));
      const run = await fetchPacks(source, out, ...args);
      assert.equal(run.status, 0, run.stderr);
      assert.ok(!(await readdir(out)).includes('index.json'), `index.json written for ${args.join(' ')}`);
    }
  });
});

test('a size mismatch fails before any index is saved', async () => {
  const server = createServer((req, res) => {
    const name = new URL(req.url, 'http://x').pathname.slice(1);
    res.end(name === 'index.json' ? index : 'wrong length');
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  try {
    const out = await mkdtemp(join(tmpdir(), 'fetch-packs-'));
    const run = await fetchPacks(`http://127.0.0.1:${server.address().port}/`, out, '--all');
    assert.notEqual(run.status, 0);
    assert.ok(!(await readdir(out)).includes('index.json'));
  } finally { server.close(); }
});
