// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { showcaseSmoke } from '../../showcase/test/smoke.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(root, 'showcase/dist');
const formatBundle = await build({ entryPoints: [resolve(root, 'runtime/src/format.ts')], bundle: true, write: false, format: 'esm', platform: 'node' });
const { readContainer, validate } = await import(`data:text/javascript;base64,${Buffer.from(formatBundle.outputFiles[0].contents).toString('base64')}`);
const example = await readFile(resolve(dist, 'packs/free/hoa-fireball.vfxb'));
const buffer = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const decoded = readContainer(buffer(example));
const collection = JSON.parse(await readFile(resolve(dist, 'packs/free/index.json'), 'utf8'));
let verifiedFiles = 0;
for (const pack of collection.flatMap(p => p.evolved ? [p, p.evolved] : [p])) for (const file of pack.files) {
  const bytes = await readFile(resolve(dist, 'packs/free', file.name));
  const manifest = readContainer(buffer(bytes)).manifest;
  assert.equal(bytes.length, file.bytes);
  assert.equal(manifest.id, file.name.replace(/(?:\.m)?\.vfxb$/, ''));
  assert.ok(bytes.length <= (file.name.endsWith('.m.vfxb') ? 1500000 : 4000000), `${file.name} exceeds pack budget`);
  verifiedFiles++;
}
console.log(`Pack collection: PASS (${collection.length} base, ${collection.filter(p => p.evolved).length} evolved; ${verifiedFiles} containers validated, sizes match index)`);
assert.equal(decoded.manifest.id, 'hoa-fireball');
assert.throws(() => readContainer(buffer(example), 'wrong-key'));
assert.throws(() => readContainer(buffer(example.subarray(0, 20))));
assert.throws(() => readContainer(new ArrayBuffer(0)));
assert.throws(() => validate({}));
const invalid = structuredClone(decoded.manifest); invalid.layers[0].frames.pop(); assert.throws(() => validate(invalid));
for (const scale of [0, -1, NaN, Infinity, '0.5', null]) {
  const badScale = structuredClone(decoded.manifest); badScale.layers[0].scale = scale;
  assert.throws(() => validate(badScale), /Invalid VFX layer scale/);
}
const legacy = structuredClone(decoded.manifest); legacy.layers.forEach(l => { delete l.scale; }); validate(legacy);
const empty = structuredClone(decoded.manifest); empty.layers.forEach(l => { l.sheets = []; l.frames.fill(null); }); empty.cues = []; validate(empty);
const feedback = structuredClone(empty);
feedback.durationMs = 200; feedback.frameCount = 2; feedback.fps = 10;
feedback.layers.forEach(l => { l.frames = [null, null]; });
feedback.cues = [{ t: 0, type: 'hitstop', ms: 100 }, { t: 0, type: 'shake', amp: 6, ms: 200 }, { t: 50, type: 'hit' }];
const destroyCue = structuredClone(decoded.manifest);
destroyCue.cues = [{ t: 50, type: 'hit' }];
const loopCues = structuredClone(empty);
loopCues.durationMs = 100; loopCues.frameCount = 1; loopCues.fps = 10;
loopCues.layers.forEach(l => { l.frames = [null]; });
loopCues.cues = [{ t: 0, type: 'hit' }, { t: 50, type: 'hit' }];
const offset = structuredClone(decoded.manifest);
offset.origin = { x: 100, y: 50 }; offset.target = { x: 460, y: 50 }; offset.anchor = 'target';
offset.durationMs = 1000; offset.frameCount = 1; offset.fps = 1; offset.cues = [];
offset.layers.forEach(l => { l.frames = [l.frames.find(f => f !== null)]; });
offset.layers.forEach((l, i) => { l.scale = i ? 0.25 : 0.8; });

const actors = structuredClone(feedback);
actors.id = 'actors';
actors.actors = { caster: { frames: [[0, 0, 0, 1], [20, 10, 30, 2]] }, target: { frames: [[0, 0, 0, 1], [-10, 4, 12, 1]] } };
validate(actors);
for (const value of [null, [], { stranger: { frames: [[0, 0, 0, 1], [0, 0, 0, 1]] } }, { caster: null }, { caster: { frames: [] } }, { caster: { frames: [[0, 0, 0, 4], [0, 0, 0, 1]] } }, { caster: { frames: [[NaN, 0, 0, 1], [0, 0, 0, 1]] } }, { caster: { frames: [[0, 0, 0], [0, 0, 0, 1]] } }]) {
  assert.throws(() => validate({ ...actors, actors: value }));
}
async function actorSmoke(engine) {
  const { app, vfx: existing } = engine === 'v8' ? window.__showcase : window.__v7;
  const Player = engine === 'v8' ? existing.constructor : window.__v7.VfxPlayer;
  const player = new Player(app, { hitstop: true });
  const check = (ok, message) => { if (!ok) throw Error(engine + ': ' + message); };
  try {
    await player.load('/actors.vfxb');
    check(player.getManifest('missing') === undefined, 'missing manifest');
    const metadata = player.getManifest('actors'); metadata.cues.length = 0;
    check(player.getManifest('actors').cues.length > 0, 'manifest snapshot mutated player');
    const h = player.play('actors', { from: { x: 720, y: 0 }, to: { x: 0, y: 0 }, fitDistance: true });
    player.update(50);
    check(h.elapsedMs === 0, 'elapsed clock ignored hitstop');
    check(h.pose('caster').x === 0, 'actor hitstop');
    player.update(100);
    check(h.elapsedMs === 50, 'elapsed clock did not advance');
    const c = h.pose('caster'), t = h.pose('target');
    check(c.x === -20 && c.y === 5 && c.lift === 15 && c.visible && c.facing === -1, 'interpolated mirrored/fit pose');
    check(t.x === 10 && t.y === 2 && t.lift === 6, 'target pose');
    player.update(50);
    check(!h.pose('caster').visible && h.pose('caster').facing === 1, 'stepped flags');
    h.stop();
    check(h.elapsedMs === 0, 'stopped clock did not reset');
    check(JSON.stringify(h.pose('caster')) === JSON.stringify({ x: 0, y: 0, lift: 0, visible: true, facing: 1 }), 'stopped home pose');
    check(h.pose('caster') === null && h.pose('target')?.x === 0 && h.pose('target') === null, 'one reset per tracked actor');
    const end = player.play('actors', { from: { x: 0, y: 0 } });
    player.update(100); player.update(200); await end.finished;
    check(end.pose('caster')?.visible && end.pose('caster') === null, 'natural end reset');
    await player.load('/empty.vfxb');
    const legacy = player.play('hoa-fireball', { from: { x: 0, y: 0 } });
    check(legacy.pose('caster') === null && legacy.pose('target') === null, 'legacy track absent');
    legacy.stop(); check(legacy.pose('caster') === null, 'legacy stop');
    const loop = player.play('actors', { from: { x: 0, y: 0 }, loop: true });
    player.update(100); player.update(200);
    check(loop.pose('caster') !== null, 'loop remains tracked');
    check(loop.elapsedMs === 0, 'loop clock did not wrap');
    loop.stop();
    await player.load('/packs/free/kim-golden-edge.evolved.vfxb');
    const evolved = player.play('kim-golden-edge.evolved', { from: { x: 0, y: 0 } });
    player.update(200);
    check(evolved.pose('caster')?.x > 0, 'shipped evolved actor track');
    evolved.stop();
  } finally { player.destroy(); }
}
// Independent wire fixture: JSON and WebP payloads framed with little-endian fields.
function fixture(manifest, sheets, key) {
  const chunks = [], u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
  const json = Buffer.from(JSON.stringify(manifest)); chunks.push(u32(json.length), json, u32(sheets.size));
  for (const [name, bytes] of sheets) { const n = Buffer.from(name), length = Buffer.alloc(2); length.writeUInt16LE(n.length); chunks.push(length, n, u32(bytes.length), bytes); }
  const bytes = Buffer.concat(chunks);
  if (key) {
    let seed = 2166136261;
    for (const byte of Buffer.from(key)) seed = Math.imul(seed ^ byte, 16777619) >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let word = Math.imul(seed ^ seed >>> 15, seed | 1);
      word ^= word + Math.imul(word ^ word >>> 7, word | 61);
      bytes[i] ^= (word ^ word >>> 14) >>> 24;
    }
  }
  return Buffer.concat([Buffer.from([76, 86, 70, 88, 1, key ? 1 : 0, 0, 0]), bytes]);
}
const custom = fixture(decoded.manifest, decoded.sheets, 'test-custom-火');
const plainContainer = fixture(decoded.manifest, decoded.sheets);
const orderedColors = [[0, 30, 0, 255], [80, 20, 10, 192], [30, 0, 0, 255], [0, 0, 80, 128], [10, 20, 0, 255], [20, 40, 10, 128]];
const orderedSheets = new Map();
const orderedManifest = count => ({ ...empty, id: `ordered-${count}`, durationMs: 200, frameCount: 2, fps: 10, origin: { x: 0, y: 0 }, scale: 1,
  layers: orderedColors.slice(0, count).map((_, i) => ({ name: `ordered-${i}`, blend: i % 2 ? 'normal' : 'add', scale: [1, 0.5, 2][i % 3], sheets: [`ordered-${i}.png`], frames: [[0, 0, 0, 4, 4, 0, 0], i === 1 ? null : [0, 0, 0, 4, 4, 0, 0]] })),
});
async function orderedSmoke({ engine, colors }) {
  const { app, vfx: existing } = engine === 'v8' ? window.__showcase : window.__v7;
  const Player = engine === 'v8' ? existing.constructor : window.__v7.VfxPlayer;
  const visible = app.stage.children.map(c => c.visible), children = [...app.stage.children];
  const background = app.renderer.background ?? app.renderer;
  const oldColor = background.color ?? background.backgroundColor, oldAlpha = background.alpha ?? background.backgroundAlpha;
  const setBackground = (color, alpha) => { if (app.renderer.background) { background.color = color; background.alpha = alpha; } else { app.renderer.backgroundColor = color; app.renderer.backgroundAlpha = alpha; } };
  const parent = new app.stage.constructor(); app.stage.addChild(parent);
  children.forEach(c => { c.visible = false; }); setBackground(0x121620, 1);
  const player = new Player(app);
  try {
    for (const count of [3, 6]) {
      const id = `ordered-${count}`; await player.load(`/ordered-${count}.vfxb`);
      const checkFrame = second => {
        const root = parent.children[0];
        if (root.children.length !== count) throw Error(`${engine}: N-layer sprite count`);
        let expected = [18, 22, 32];
        root.children.forEach((sprite, i) => {
          if (sprite.visible !== !(second && i === 1)) throw Error(`${engine}: N-layer null frame`);
          if (sprite.scale.x !== 1 / [1, 0.5, 2][i % 3]) throw Error(`${engine}: N-layer scale/order`);
          if (second && i === 1) return;
          const color = colors[i], a = color[3] / 255;
          expected = expected.map((v, c) => Math.min(255, i % 2 ? v * (1 - a) + color[c] * a : v + color[c] * a));
        });
        app.render();
        const canvas = app.canvas ?? app.view, copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0);
        const xy = Math.floor(20.75 * app.renderer.resolution), actual = ctx.getImageData(xy, xy, 1, 1).data;
        if (expected.some((v, c) => Math.abs(v - actual[c]) > 4)) throw Error(`${engine}: ${count}-layer compositing/order ${[...actual]} != ${expected}`);
      };
      const handle = player.play(id, { from: { x: 20, y: 20 }, parent }); checkFrame(false);
      player.update(100.001); checkFrame(true); handle.stop(); await handle.finished;
      const pooled = player.stats().pooled;
      const replay = player.play(id, { from: { x: 20, y: 20 }, parent }); checkFrame(false); replay.stop();
      if (player.stats().pooled !== pooled) throw Error(`${engine}: N-layer replay pool grew`);
      player.unload(id);
    }
  } finally {
    player.destroy(); parent.destroy({ children: true }); children.forEach((c, i) => { c.visible = visible[i]; }); setBackground(oldColor, oldAlpha);
  }
}
assert.deepEqual(readContainer(buffer(custom), 'test-custom-火').manifest, decoded.manifest);
assert.deepEqual(readContainer(buffer(plainContainer)).manifest, decoded.manifest);
console.log('Format contracts: PASS (default/custom keys, unscrambled, empty layers, malformed data)');
const v7Bundle = await build({
  stdin: { contents: `import { Application, Container } from 'pixi.js'; import { VfxPlayer } from './runtime/src/index'; const app = new Application({width:1000,height:580}); document.body.appendChild(app.view); const vfx = await VfxPlayer.create(app); window.__v7 = {app,vfx,Container,VfxPlayer};`, resolveDir: root },
  bundle: true, format: 'esm', write: false, alias: { 'pixi.js': 'pixi7' },
});
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/v7.html') { res.setHeader('Content-Type', 'text/html'); res.end('<link rel="icon" href="data:,"><script type="module" src="/v7.js"></script>'); return; }
    if (path === '/v7.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(v7Bundle.outputFiles[0].contents); return; }
    if (path === '/feedback.vfxb' || path === '/invalid.vfxb') { res.end(path === '/feedback.vfxb' ? fixture(feedback, new Map()) : Buffer.from('invalid')); return; }
    if (path === '/offset.vfxb') { res.end(fixture(offset, decoded.sheets)); return; }
    if (path === '/offset.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(offset)); return; }
    if (/^\/ordered-[36]\.vfxb$/.test(path)) { res.end(fixture(orderedManifest(Number(path[9])), orderedSheets)); return; }
    if (path === '/destroy-cue.vfxb') { res.end(fixture(destroyCue, decoded.sheets)); return; }
    if (path === '/loop-cues.vfxb') { res.end(fixture(loopCues, new Map())); return; }
    if (path === '/actors.vfxb') { res.end(fixture(actors, new Map())); return; }
    if (path === '/slow.vfxb') { await new Promise(resolve => setTimeout(resolve, 40)); res.end(fixture(decoded.manifest, decoded.sheets)); return; }
    if (path === '/custom.vfxb' || path === '/plain.vfxb' || path === '/empty.vfxb') { res.end(path === '/custom.vfxb' ? custom : path === '/empty.vfxb' ? fixture(empty, new Map()) : plainContainer); return; }
    const local = path.replace(/^\/collection/, '') || '/';
    const folder = path.startsWith('/format-examples/') ? resolve(root, 'docs/format-examples') : dist;
    const relative = path.startsWith('/format-examples/') ? path.slice('/format-examples'.length) : local;
    const file = resolve(folder, '.' + (relative.endsWith('/') ? relative + 'index.html' : relative));
    if (!file.startsWith(folder + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' }[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
let browser;
const errors = [];
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${url}/collection/`); await page.waitForFunction(() => window.__showcase);
  const desktopFirst = await page.evaluate(() => {
    const resources = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return { transfer: resources.reduce((n, r) => n + r.transferSize, 0), body: resources.reduce((n, r) => n + r.encodedBodySize, 0) };
  });
  console.log(`Desktop first load: ${desktopFirst.transfer} transferred bytes incl. HTTP overhead; ${desktopFirst.body} body bytes (index + selected hi pack only)`);
  assert.ok(desktopFirst.transfer <= 3000000, 'Desktop first-load budget exceeded');
  const result = await page.evaluate(async () => {
    const { vfx, app, packs, from, to } = window.__showcase; app.stop();
    const check = (condition, message) => { if (!condition) throw Error(message); };
    check(packs.length === 25, 'Expected 25 packs');
    check(packs.every(p => p.desktopBytes <= 4000000), 'Desktop pack budget exceeded');
    let cues = 0; const listener = () => cues++; vfx.on('cue', listener); vfx.hitstopEnabled = false;
    for (const pack of packs) {
      await vfx.load(`./packs/free/${pack.id}.vfxb`);
      const first = vfx.play(pack.id, { from, to });
      for (let ms = 0; ms < 16000; ms += 34) { vfx.update(34); if (ms === 1020) app.render(); }
      await first.finished; check(vfx.stats().active === 0, `${pack.id}: cleanup`);
      const pooled = vfx.stats().pooled;
      const second = vfx.play(pack.id, { from, to, speed: 2 });
      for (let ms = 0; ms < 16000; ms += 34) vfx.update(34);
      await second.finished; check(vfx.stats().pooled === pooled, `${pack.id}: pool grew`);
      vfx.unload(pack.id);
    }
    check(cues > 25, 'No cues'); vfx.off('cue', listener);
    await vfx.load('/format-examples/hoa-fireball.vfx.json');
    const handle = vfx.play('hoa-fireball', { from: to, to: from, fitDistance: true, loop: true });
    for (let ms = 0; ms < 12000; ms += 34) vfx.update(34);
    check(vfx.stats().active === 1, 'Loop stopped');
    handle.stop(); await handle.finished; check(vfx.stats().active === 0, 'Stop failed');
    let rejected = false; try { vfx.play('missing', { from }); } catch { rejected = true; } check(rejected, 'Unknown id accepted');
    rejected = false; try { vfx.play('hoa-fireball', { from, speed: 0 }); } catch { rejected = true; } check(rejected, 'Invalid speed accepted');
    return { count: packs.length, cues, pooled: vfx.stats().pooled };
  });
  console.log(`Pixi v8: PASS (${result.count} packs + plain JSON, cleanup, replay pool=${result.pooled}, ${result.cues} cues, loop/stop/errors)`);
  const pngs = await page.evaluate(colors => colors.map(color => {
    const c = document.createElement('canvas'); c.width = c.height = 4; const ctx = c.getContext('2d');
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`; ctx.fillRect(0, 0, 4, 4); return c.toDataURL('image/png').split(',')[1];
  }), orderedColors);
  pngs.forEach((png, i) => orderedSheets.set(`ordered-${i}.png`, Buffer.from(png, 'base64')));
  await page.evaluate(orderedSmoke, { engine: 'v8', colors: orderedColors });
  await page.evaluate(actorSmoke, 'v8');
  console.log('Pixi v8 actors: PASS (validation, interpolation, mirror/fit, hitstop, stepped flags, legacy, stop/end/reset, loop)');
  console.log('Pixi v8 ordered layers: PASS (3/6 layers, pixel-checked blend order, mixed scales, null frames, replay)');
  await page.evaluate(async () => {
    const { vfx, world, scene } = window.__showcase;
    vfx.unload('hoa-fireball'); await vfx.load('/offset.vfxb');
    const h = vfx.play('hoa-fireball', { from: {x:0,y:0}, parent: world });
    const root = world.children.at(-1);
    if (root.children[0].scale.x !== 1 / 0.8 || root.children[1].scale.x !== 4) throw Error('v8 layer scale ignored');
    h.stop(); vfx.unload('hoa-fireball');
    scene.cue({type:'sound',id:'windup'}, 0xff9060); scene.animate(50);
    if (scene.state.castAge !== 50 || scene.orb.width <= 24) throw Error('Windup did not flare orb');
    scene.cue({type:'sound',id:'release'}, 0xff9060); scene.animate(16);
    if (scene.state.releaseAge !== 16) throw Error('Release did not recoil');
    scene.cue({type:'hit'}, 0xff9060); scene.animate(40);
    if (!(scene.dummy.scale.y < 1 && scene.floorFlash.alpha > 0 && Math.abs(scene.dummy.rotation) > 0.01)) throw Error('Dummy/floor hit response missing');
    for (let i = 0; i < 100; i++) scene.animate(50);
    if (Math.abs(scene.dummy.scale.y - 1) > 0.001 || !Number.isFinite(scene.dummy.x)) throw Error('Dummy did not settle');
    await vfx.load('./packs/free/hoa-fireball.vfxb');
  });
  console.log('Layer scale + stage: PASS (v8 mixed scales, legacy fallback validation, invalid scales, windup/release/hit/settle)');
  await page.getByRole('button', { name: 'Thủy', exact: true }).click();
  assert.equal(await page.locator('.skill').count(), 2);
  await page.getByRole('button', { name: 'All elements', exact: true }).click();
  await page.locator('#search').fill('fireball'); assert.equal(await page.locator('.skill').count(), 1);
  await page.locator('#search').fill('');
  await page.locator('#loop').check(); await page.locator('#sound').check();
  await page.waitForFunction(() => window.__showcase.audioState() === 'running');
  console.log('Showcase sound toggle: PASS (AudioContext starts while an existing loop is active)');
  await page.evaluate(() => { const event = new Event('pagehide'); Object.defineProperty(event, 'persisted', { value: true }); dispatchEvent(event); });
  if (!(await page.evaluate(() => window.__showcase.vfx.stats().packs))) throw Error('Persisted pagehide destroyed showcase');
  console.log('Showcase bfcache lifecycle: PASS (persisted pagehide keeps player alive)');
  await showcaseSmoke({ page, browser, url, collection });
  await page.evaluate(async () => {
    const s = window.__showcase; s.select('hoa-fire-dragon-crossing');
    await s.vfx.load('./packs/free/hoa-fire-dragon-crossing.vfxb');
    s.vfx.play('hoa-fire-dragon-crossing', { from: s.from, to: s.to, parent: s.world });
    s.vfx.update(1300); s.app.render();
  });
  if (process.env.VFX_SCREENSHOT) { await page.screenshot({ path: process.env.VFX_SCREENSHOT, fullPage: true }); console.log(`Screenshot: ${process.env.VFX_SCREENSHOT}`); }
  await page.evaluate(() => window.__showcase.vfx.destroy());
  await page.goto(`${url}/v7.html`); await page.waitForFunction(() => window.__v7);
  await page.evaluate(async () => {
    const { app, vfx, Container, VfxPlayer } = window.__v7; app.stop();
    const from = { x: 100, y: 300 }, to = { x: -620, y: 300 }, parent = new Container(); app.stage.addChild(parent);
    await vfx.load('/collection/packs/free/hoa-fireball.vfxb');
    const h = vfx.play('hoa-fireball', { from, to, parent, fitDistance: true, zIndex: 7 });
    vfx.update(500); app.render();
    const root = parent.children[0];
    if (root.scale.x !== -2 || root.zIndex !== 7 || root.x !== 100 || !root.children.some(s => s.visible)) throw Error('v7 placement/render failed');
    h.stop(); await h.finished; const pooled = vfx.stats().pooled;
    const replay = vfx.play('hoa-fireball', { from }); vfx.update(16000); await replay.finished;
    if (vfx.stats().active || vfx.stats().pooled !== pooled) throw Error('v7 cleanup/pool failed');
    await vfx.load('/format-examples/hoa-fireball.vfx.json'); vfx.destroy();
    if (vfx.stats().packs || vfx.stats().active || vfx.stats().pooled) throw Error('Destroy failed');
    const custom = await VfxPlayer.create(app, { loadKey: 'test-custom-火', packs: ['/custom.vfxb'] }); custom.destroy();
    const plain = await VfxPlayer.create(app, { packs: ['/plain.vfxb', '/empty.vfxb'] }); plain.destroy();
    const empty = await VfxPlayer.create(app, { packs: ['/empty.vfxb'] });
    const e = empty.play('hoa-fireball', { from }); empty.update(16000); await e.finished; empty.destroy();
    const camera = new Container(); camera.position.set(100, 50);
    const feedback = await VfxPlayer.create(app, { packs: ['/feedback.vfxb'], hitstop: true, shake: { target: camera } });
    let hits = 0; feedback.on('cue', cue => { if (cue.type === 'hit') hits++; });
    const f = feedback.play('hoa-fireball', { from }); feedback.update(50);
    if (hits || camera.x === 100) throw Error('Hit-stop/shake did not activate');
    feedback.shakeEnabled = false; feedback.hitstopEnabled = false; feedback.update(50);
    if (hits !== 1 || camera.x !== 100 || camera.y !== 50) throw Error('Feedback toggles failed');
    feedback.update(150); await f.finished; feedback.destroy();
    const destroyed = await VfxPlayer.create(app, { packs: ['/destroy-cue.vfxb'] });
    destroyed.on('cue', () => destroyed.destroy());
    const destroyedHandle = destroyed.play('hoa-fireball', { from });
    destroyed.draw = () => { throw Error('Playback drawn after cue destroyed player'); };
    destroyed.update(50); await destroyedHandle.finished;
    const late = new VfxPlayer(app);
    const lateLoad = late.load('/slow.vfxb');
    await new Promise(resolve => setTimeout(resolve, 5)); late.unload('hoa-fireball');
    let cancelled = false; try { await lateLoad; } catch { cancelled = true; }
    if (!cancelled || late.stats().packs) throw Error('Unload did not cancel in-flight load');
    late.destroy();
    const loopCuesPlayer = await VfxPlayer.create(app, { packs: ['/loop-cues.vfxb'] });
    let loopCueCount = 0; loopCuesPlayer.on('cue', cue => { if (cue.type === 'hit') loopCueCount++; });
    const loopCuesHandle = loopCuesPlayer.play('hoa-fireball', { from, loop: true });
    loopCuesPlayer.update(250);
    if (loopCueCount !== 6) throw Error(`Loop cues skipped cycles: ${loopCueCount}`);
    loopCuesHandle.stop(); loopCuesPlayer.destroy();
    let rejected = false;
    try { await VfxPlayer.create(app, { packs: ['/invalid.vfxb'] }); } catch { rejected = true; }
    if (!rejected) throw Error('Invalid pack load accepted');
    const offset = await VfxPlayer.create(app, { packs: ['/offset.vfxb'] });
    const handle = offset.play('hoa-fireball', { from, to: { x: 460, y: 350 }, parent });
    const offsetRoot = parent.children[0];
    if (offsetRoot.x !== 460 || offsetRoot.y !== 350) throw Error('Target anchor failed');
    const response = await fetch('/offset.json'), manifest = await response.json();
    offsetRoot.children.forEach((sprite, i) => {
      const frame = manifest.layers[i].frames.find(f => f !== null);
      if (sprite.x !== frame[5] || sprite.y !== frame[6]) throw Error('Origin-relative offsets shifted twice');
      if (sprite.scale.x !== 1 / manifest.layers[i].scale) throw Error('v7 layer scale ignored');
    });
    handle.stop(); offset.destroy();
  });
  assert.deepEqual(errors, []);
  console.log('Pixi v7: PASS (WebGL render, mirror/fitDistance/parent/zIndex, target anchor/nonzero origin, cleanup/pool, custom key, unscrambled, empty pack, shake/hitstop toggles, invalid load, destroy)');
  await page.evaluate(orderedSmoke, { engine: 'v7', colors: orderedColors });
  await page.evaluate(actorSmoke, 'v7');
  console.log('Pixi v7 actors: PASS (interpolation, mirror/fit, hitstop, legacy, stop/end/reset, loop)');
  console.log('Pixi v7 ordered layers: PASS (3/6 layers, pixel-checked blend order, mixed scales, null frames, replay)');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  mobile.on('pageerror', e => errors.push(e.message)); mobile.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const requests = [];
  mobile.on('request', r => requests.push(new URL(r.url()).pathname));
  await mobile.goto(`${url}/collection/`); await mobile.waitForFunction(() => window.__showcase);
  const first = await mobile.evaluate(() => {
    const resources = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return {
      transfer: resources.reduce((n, r) => n + r.transferSize, 0), body: resources.reduce((n, r) => n + r.encodedBodySize, 0),
      backingWidth: window.__showcase.app.canvas.width, displayWidth: document.getElementById('stage').clientWidth,
      overflow: document.documentElement.scrollWidth > innerWidth, packs: window.__showcase.vfx.stats().packs,
      bytes: window.__showcase.packs.map(p => [p.id, p.mobileBytes, p.desktopBytes]),
    };
  });
  assert.deepEqual(requests.filter(p => p.includes('/packs/')).sort(), ['/collection/packs/free/hoa-fireball.m.vfxb', '/collection/packs/free/index.json']);
  assert.equal(first.packs, 1); assert.equal(first.overflow, false); assert.ok(first.backingWidth <= first.displayWidth * 2 + 1);
  assert.equal(await mobile.locator('.integration pre').evaluate(pre => getComputedStyle(pre).whiteSpace === 'pre-wrap' && pre.scrollWidth <= pre.clientWidth), true);
  console.log('Mobile integration snippet: PASS (wrapped without horizontal clipping)');
  assert.ok(first.transfer <= 1600000, 'Mobile first-load budget exceeded');
  for (const [id, mobileBytes] of first.bytes) assert.ok(mobileBytes <= 1500000, `${id} exceeds mobile pack budget`);
  await mobile.locator('.skill').filter({ hasText: 'Dragon Cyclone' }).tap();
  await mobile.waitForFunction(() => window.__showcase.vfx.stats().active === 1);
  assert.equal(await mobile.evaluate(() => window.__showcase.vfx.stats().packs), 1);
  const timing = await mobile.evaluate(async () => {
    const times = []; let previous = performance.now();
    await new Promise(done => { const frame = now => { times.push(now - previous); previous = now; if (times.length < 90) requestAnimationFrame(frame); else done(); }; requestAnimationFrame(frame); });
    return { average: times.reduce((a, b) => a + b, 0) / times.length, max: Math.max(...times) };
  });
  await mobile.evaluate(() => {
    const s = window.__showcase; s.app.stop(); s.app.render();
  });
  if (process.env.VFX_MOBILE_SCREENSHOT) {
    await mobile.evaluate(async () => {
      const s = window.__showcase;
      for (const pack of s.packs) s.vfx.unload(pack.id);
      s.select('hoa-fire-dragon-crossing');
      await s.vfx.load('./packs/free/hoa-fire-dragon-crossing.m.vfxb');
      s.vfx.play('hoa-fire-dragon-crossing', { from: s.from, to: s.to, parent: s.world });
      s.vfx.update(1300); s.app.render();
    });
    await mobile.screenshot({ path: process.env.VFX_MOBILE_SCREENSHOT, fullPage: true });
    console.log(`Mobile Fire Dragon Crossing screenshot: ${process.env.VFX_MOBILE_SCREENSHOT}`);
  }
  console.log(`Mobile 390x844 / DPR 3: PASS (touch selection, no overflow, backing width ${first.backingWidth}px <= 2x display, one resident pack)`);
  console.log(`First load: ${first.transfer} transferred bytes incl. HTTP overhead; ${first.body} body bytes (uncompressed local server; index + selected pack only)`);
  console.log(`Mobile emulation RAF: average ${timing.average.toFixed(1)}ms, max ${timing.max.toFixed(1)}ms over 90 frames (not a physical-device benchmark)`);
  console.log('Per-skill download bytes:');
  for (const [id, mobileBytes, desktopBytes] of first.bytes) console.log(`${id}: mobile ${mobileBytes}; desktop ${desktopBytes}`);
  console.log('Showcase UI filters/search: PASS; browser console/page errors: 0');
  assert.deepEqual(errors, []);
} finally { await browser?.close(); await new Promise(ok => server.close(ok)); }
