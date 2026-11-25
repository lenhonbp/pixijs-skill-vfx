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
import { catalogSmoke } from '../../showcase/test/catalog-smoke.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(root, 'showcase/dist');
const formatBundle = await build({ entryPoints: [resolve(root, 'runtime/src/format.ts')], bundle: true, write: false, format: 'esm', platform: 'node' });
const { readContainer, validate } = await import(`data:text/javascript;base64,${Buffer.from(formatBundle.outputFiles[0].contents).toString('base64')}`);
const example = await readFile(resolve(dist, 'packs/free/hoa-fireball.vfxb'));
const buffer = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const decoded = readContainer(buffer(example));
const collection = JSON.parse(await readFile(resolve(dist, 'packs/free/index.json'), 'utf8'));
let verifiedFiles = 0;
assert.equal(collection.length, 25);
assert.ok(collection.every(p => !('evolved' in p) && p.files.length === 2 && Object.values(p.directions ?? {}).every(d => d.files.length === 2)));
for (const pack of collection) for (const file of [...pack.files, ...Object.values(pack.directions ?? {}).flatMap(d => d.files)]) {
  const bytes = await readFile(resolve(dist, 'packs/free', file.name));
  const manifest = readContainer(buffer(bytes)).manifest;
  assert.equal(bytes.length, file.bytes);
  const [, id, direction] = file.name.match(/^(.+?)(?:@(-?\d+))?(?:\.m)?\.vfxb$/);
  assert.equal(manifest.id, id);
  assert.equal(manifest.direction ?? 0, Number(direction ?? 0), `${file.name} direction`);
  if (direction) assert.ok(pack.directions[direction].files.includes(file));
  assert.ok(bytes.length <= (file.name.endsWith('.m.vfxb') ? 1500000 : 4000000), `${file.name} exceeds pack budget`);
  verifiedFiles++;
}
console.log(`Pack collection: PASS (${collection.length} skills; ${verifiedFiles} containers validated, sizes match index)`);
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

// Impact block: validated against its own pack, ignored when the schema version is unknown.
const tier = (id, n, anchor, frame, layers, extra = {}) => ({ tier: n, id, role: id.replace('_', '-'), anchor_type: anchor.type, anchor_point: anchor.point, pivot: 'center', y_sort: 0,
  recommended_blend_mode: anchor.blend, default_z_layer: anchor.z, start_frame: frame, layers, ...extra });
const impactBlock = () => ({ schema_version: 1, hit_vector: { x: 1, y: 0, angle_deg: 0 }, sequence_timing: { unit: 'frames', fps: 10, ordered: true }, tiers: [
  tier('hit_point', 1, { type: 'contact_normal', point: { x: 360, y: -52.8 }, blend: 'ADD', z: 'foreground' }, 0, ['hit-point-glow'], { normal_deg: 180 }),
  tier('ground_feedback', 2, { type: 'ground_center', point: { x: 360, y: 0 }, blend: 'NORMAL', z: 'background' }, 0, ['ground-feedback-base']),
  tier('body_residual', 3, { type: 'body_center', point: { x: 360, y: -48 }, blend: 'SCREEN', z: 'target_overlay' }, 1, ['body-residual-glow'])] });
const flat = structuredClone(decoded.manifest);
const withImpact = structuredClone(flat);
withImpact.impact = { ...impactBlock(), tiers: [
  tier('hit_point', 1, { type: 'contact_normal', point: { x: 360, y: -52.8 }, blend: 'ADD', z: 'foreground' }, 0, [flat.layers[0].name]),
  tier('ground_feedback', 2, { type: 'ground_center', point: { x: 360, y: 0 }, blend: 'NORMAL', z: 'background' }, 0, [flat.layers[1].name]),
  tier('body_residual', 3, { type: 'body_center', point: { x: 360, y: -48 }, blend: 'SCREEN', z: 'target_overlay' }, 1, [flat.layers[2].name])] };
assert.equal(validate(structuredClone(withImpact)).impact.tiers.length, 3);
const futureVersion = structuredClone(withImpact); futureVersion.impact.schema_version = 2;
assert.equal(validate(futureVersion).impact, undefined, 'unknown impact schema must be ignored, not rejected');
for (const [name, mutate] of [
  ['tier id', m => { m.impact.tiers[0].id = 'sparkle'; }],
  ['duplicate tier', m => { m.impact.tiers[1].id = 'hit_point'; }],
  ['anchor enum', m => { m.impact.tiers[0].anchor_type = 'feet'; }],
  ['blend enum', m => { m.impact.tiers[2].recommended_blend_mode = 'MULTIPLY'; }],
  ['z enum', m => { m.impact.tiers[1].default_z_layer = 'top'; }],
  ['anchor point', m => { m.impact.tiers[0].anchor_point = { x: NaN, y: 0 }; }],
  ['start frame', m => { m.impact.tiers[2].start_frame = m.frameCount; }],
  ['missing layer', m => { m.impact.tiers[0].layers = ['nope']; }],
  ['layer claimed twice', m => { m.impact.tiers[1].layers = m.impact.tiers[0].layers; }],
  ['hit vector', m => { m.impact.hit_vector = { x: 1 }; }],
  ['no tiers', m => { m.impact.tiers = []; }],
]) { const m = structuredClone(withImpact); mutate(m); assert.throws(() => validate(m), /Invalid VFX impact block/, name); }
console.log('Impact block validation: PASS (valid block, unknown version ignored, 11 malformed cases rejected)');
const impactSheets = new Map();
const impactFrame = (x, y) => [0, 0, 0, 16, 16, x, y];
const impactManifest = (version = 1) => ({ ...empty, id: version === 1 ? 'impact' : 'impact-v2', durationMs: 300, frameCount: 3, fps: 10, scale: 1, origin: { x: 0, y: 0 }, target: { x: 360, y: 0 }, groundSquash: 0.6, anchor: 'caster', cues: [],
  layers: [
    { name: 'ground-feedback-base', blend: 'normal', scale: 1, sheets: ['ordered-0.png'], frames: [impactFrame(352, -8), impactFrame(352, -8), null] },
    { name: 'base', blend: 'normal', scale: 1, sheets: ['ordered-1.png'], frames: [impactFrame(100, -20), impactFrame(120, -20), impactFrame(140, -20)] },
    { name: 'body-residual-glow', blend: 'add', scale: 1, sheets: ['ordered-2.png'], frames: [null, impactFrame(352, -56), impactFrame(352, -56)] },
    { name: 'hit-point-glow', blend: 'add', scale: 1, sheets: ['ordered-3.png'], frames: [impactFrame(352, -61), null, null] }],
  impact: { ...impactBlock(), schema_version: version } });
validate(impactManifest());
const juiceManifest = { ...impactManifest(), id: 'juice', cues: [{ t: 100, type: 'hit' }, { t: 100, type: 'hitstop', ms: 100 }, { t: 100, type: 'shake', amp: 6, ms: 200 }] };
validate(juiceManifest);
// Ramp (grayscale + gradient) packs: validation, then a fixture whose mask is a left-to-right gradient.
const greenLut = Buffer.from(Uint8Array.from({ length: 768 }, (_, i) => i % 3 === 1 ? Math.floor(i / 3) : 0)).toString('base64');
const rampManifest = (id = 'ramped') => ({ ...empty, id, durationMs: 200, frameCount: 2, fps: 10, scale: 1, origin: { x: 0, y: 0 }, target: { x: 360, y: 0 }, groundSquash: 0.6, anchor: 'caster', cues: [],
  layers: [
    { name: 'base', blend: 'normal', scale: 1, sheets: ['ordered-0.png'], frames: [impactFrame(100, -20), impactFrame(100, -20)] },
    { name: 'glow', blend: 'add', scale: 1, ramp: true, sheets: ['ramp-mask.png'], frames: [impactFrame(140, -20), impactFrame(140, -20)] }],
  color: { mode: 'ramp', channel: 'value', ramp: 'hoa', lut: greenLut } });
validate(rampManifest());
{
  const bare = rampManifest(); delete bare.color.lut; validate(bare);                              // the native ramp is optional
  const future = rampManifest(); future.color = { mode: 'palette', channel: 'hue' }; assert.equal(validate(future).color, undefined, 'unknown colour mode is ignored');
  for (const [name, mutate] of [
    ['channel', m => { m.color.channel = 'alpha'; }], ['ramp id', m => { m.color.ramp = 'Not A Ramp'; }], ['short lut', m => { m.color.lut = 'AAAA'; }],
    ['normal-blend ramp layer', m => { m.layers[0].ramp = true; }], ['ramp: false', m => { m.layers[1].ramp = false; }],
  ]) { const m = rampManifest(); mutate(m); assert.throws(() => validate(m), /Invalid VFX colour mode/, name); }
  console.log('Ramp colour block validation: PASS (native lut optional, unknown mode ignored, 5 malformed cases rejected)');
}
const rampSheets = new Map();
const actors = structuredClone(feedback);
actors.id = 'actors';
actors.actors = { caster: { frames: [[0, 0, 0, 1], [20, 10, 30, 2]] }, target: { frames: [[0, 0, 0, 1], [-10, 4, 12, 1]] } };
validate(actors);
for (const value of [null, [], { stranger: { frames: [[0, 0, 0, 1], [0, 0, 0, 1]] } }, { caster: null }, { caster: { frames: [] } }, { caster: { frames: [[0, 0, 0, 4], [0, 0, 0, 1]] } }, { caster: { frames: [[NaN, 0, 0, 1], [0, 0, 0, 1]] } }, { caster: { frames: [[0, 0, 0], [0, 0, 0, 1]] } }]) {
  assert.throws(() => validate({ ...actors, actors: value }));
}
const aimed = Object.fromEntries([0, 90].map(direction => {
  const m = structuredClone(actors);
  Object.assign(m, { id: 'aimed', direction, groundSquash: 0.6, origin: { x: 0, y: 0 }, target: direction ? { x: 0, y: 216 } : { x: 360, y: 0 } });
  validate(m); return [direction, m];
}));
for (const value of [91, -91, NaN]) assert.throws(() => validate({ ...aimed[0], direction: value }));
assert.throws(() => validate({ ...aimed[0], groundSquash: 0 }));
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
    await player.load(['/aimed.vfxb', '/aimed@90.vfxb']);
    check(JSON.stringify(player.directions('aimed')) === '[0,90]', 'loaded directions');
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    const pair = (to, fitDistance = false) => {
      const ref = player.play('actors', { from: { x: 0, y: 0 } }), h = player.play('aimed', { from: { x: 0, y: 0 }, to, fitDistance });
      player.update(150);
      const out = [ref.pose('caster'), h.pose('caster')]; ref.stop(); h.stop(); return out;
    };
    let [r, p] = pair({ x: 0, y: 216 });
    check(r.x > 0 && near(p.x, r.x) && near(p.y, r.y) && p.facing === r.facing, 'exact baked direction plays untransformed');
    [r, p] = pair({ x: -360, y: 0 });
    check(near(p.x, -r.x) && near(p.y, r.y) && p.facing === -r.facing, 'left cast mirrors the right bake');
    [r, p] = pair({ x: 0, y: 432 }, true);
    check(near(p.x, r.x) && near(p.y, 2 * r.y), 'fitDistance stretches along the cast');
    [r, p] = pair({ x: 300, y: 30 });
    check(p.x < r.x && p.y > r.y, 'near-horizontal cast bends the right bake toward its target');
    player.unload('aimed@90');
    check(JSON.stringify(player.directions('aimed')) === '[0]', 'direction unload');
    player.unload('aimed'); check(player.directions('aimed').length === 0, 'family unload');
    await player.load('/packs/free/kim-golden-edge.vfxb');
    const dash = player.play('kim-golden-edge', { from: { x: 0, y: 0 } });
    player.update(200);
    check(dash.pose('caster')?.x > 0, 'shipped actor track');
    dash.stop();
  } finally { player.destroy(); }
}
async function impactSmoke(engine) {
  const { app, vfx: existing } = engine === 'v8' ? window.__showcase : window.__v7;
  const Player = engine === 'v8' ? existing.constructor : window.__v7.VfxPlayer;
  const Box = app.stage.constructor, player = new Player(app);
  const check = (ok, message) => { if (!ok) throw Error(`${engine} impact: ${message}`); };
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const blend = { screen: engine === 'v8' ? 'screen' : 3, add: engine === 'v8' ? 'add' : 1 };
  const parent = new Box(), bg = new Box(), ov = new Box(), fg = new Box(); app.stage.addChild(parent, bg, ov, fg);
  try {
    await player.load(['/impact.vfxb', '/impact-v2.vfxb']);
    // Right cast, fitDistance: tiers land exactly on the target, one root per tier, bottom to top.
    const events = []; const listener = e => events.push(e); player.on('tier', listener);
    const from = { x: 100, y: 200 }, to = { x: 460, y: 200 };
    let h = player.play('impact', { from, to, fitDistance: true, parent });
    const [ground, main, body, hit] = parent.children;
    check(parent.children.length === 4, 'one root per tier plus the pack root: ' + parent.children.length);
    check([ground, main, body, hit].map(r => r.zIndex).join() === '-1,0,1,2', 'depth biases ' + [ground, main, body, hit].map(r => r.zIndex));
    check(near(ground.x, 460) && near(ground.y, 200), 'ground tier on the target feet');
    check(near(body.x, 460) && near(body.y, 152), 'body tier at the body centre');
    check(near(hit.x, 460) && near(hit.y, 200 - 52.8), 'hit tier at the contact point');
    check([ground, body, hit].every(r => r.scale.x === 1 && r.scale.y === 1 && r.skew.x === 0), 'tiers are not scaled or sheared');
    check(ground.children[0].x === -8 && ground.children[0].y === -8, 'frames are drawn around the tier anchor');
    check(main.children.length === 1 && main.children[0].x === 100 && main.x === 100, 'untagged layers keep the pack root and offsets');
    check(hit.children[0].visible && ground.children[0].visible && !body.children[0].visible, 'frame 0 visibility');
    check(events.map(e => e.tier).join() === 'hit_point,ground_feedback', 'tiers fire in order at their start: ' + events.map(e => e.tier));
    check(near(events[0].point.x, 460) && near(events[0].point.y, 147.2) && events[0].normalDeg === 180 && events[0].anchorType === 'contact_normal' && events[0].zLayer === 'foreground' && events[0].tierNumber === 1, 'hit tier event');
    check(events[1].normalDeg === undefined && events[1].blend === 'NORMAL', 'ground tier event');
    player.update(100);
    check(events.length === 3 && events[2].tier === 'body_residual' && events[2].startMs === 100, 'body tier fires at its start frame');
    check(body.children[0].visible && !hit.children[0].visible, 'frame 1 visibility');
    player.update(50); check(events.length === 3, 'a tier fires once');
    check(body.children[0].blendMode === blend.screen && hit.children[0].blendMode === blend.add, 'recommended blend: SCREEN for the body residual, ADD for the hit');
    h.stop(); check(parent.children.length === 0, 'stop removes every tier root');
    const pooled = player.stats().pooled;
    // Left cast mirrors the tiers without shearing them.
    events.length = 0;
    h = player.play('impact', { from: { x: 100, y: 200 }, to: { x: -260, y: 200 }, fitDistance: true, parent });
    const [lg, , , lh] = parent.children;
    check(lg.scale.x === -1 && near(lg.x, -260) && near(lh.x, -260), 'left cast mirrors tiers onto the target');
    check(events[0].normalDeg === 0, 'normal is mirrored for left casts: ' + events[0].normalDeg);
    h.stop();
    // Depth slots, tier switches and blend advice.
    events.length = 0;
    h = player.play('impact', { from, to, fitDistance: true, parent, layers: { background: bg, overlay: ov, foreground: fg }, recommendedBlend: false, tiers: { hit_point: false } });
    check(parent.children.length === 1 && bg.children.length === 1 && ov.children.length === 1 && fg.children.length === 0, 'tiers go to their slots; disabled tier is not attached');
    player.update(1);
    check(ov.children[0].children[0].blendMode === blend.add, 'recommendedBlend: false keeps the baked additive blend');
    check(!events.some(e => e.tier === 'hit_point'), 'a disabled tier does not fire');
    h.stop(); check(bg.children.length + ov.children.length + fg.children.length + parent.children.length === 0, 'slot cleanup');
    // Loops re-fire each cycle.
    events.length = 0;
    h = player.play('impact', { from, to, parent, loop: true });
    player.update(350);
    check(events.filter(e => e.tier === 'hit_point').length === 2, 'loop fires the tiers again each cycle: ' + events.map(e => e.tier));
    h.stop(); player.off('tier', listener);
    // Replays reuse pooled sprites and roots; an unknown schema version plays flat.
    for (let i = 0; i < 3; i++) { const r = player.play('impact', { from, to, parent }); r.stop(); }
    check(player.stats().pooled === pooled, 'replay pool grew');
    const flat = player.play('impact-v2', { from, to, parent });
    check(parent.children.length === 1 && parent.children[0].children.length === 4 && player.getManifest('impact-v2').impact === undefined, 'unknown impact version plays as flat layers');
    flat.stop();
  } finally { player.destroy(); [parent, bg, ov, fg].forEach(c => c.destroy({ children: true })); }
}
async function juiceSmoke({ engine, mode }) {
  // mode 'filter': Pixi's ColorMatrixFilter is handed to the player (exact flat silhouette); 'overlay': the default, two additive sprites.
  const g = engine === 'v8' ? window.__v8 : window.__v7, { app, Container, Sprite, Texture, VfxPlayer } = g;
  const check = (ok, message) => { if (!ok) throw Error(`${engine} juice: ${message}`); };
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  const stage = new Container(), camera = new Container(); app.stage.addChild(camera); camera.addChild(stage); camera.position.set(100, 50);
  const target = new Sprite(Texture.WHITE); target.width = 24; target.height = 24; target.tint = mode === 'filter' ? 0xff0000 : 0x808080; target.anchor.set(0.5); target.position.set(460, 200); stage.addChild(target);
  const player = new VfxPlayer(app, { shake: { target: camera }, colorMatrixFilter: mode === 'filter' ? g.ColorMatrixFilter : undefined });
  // Flash overlays are sprites sharing the target's texture: none may be left over once a flash is over.
  const overlays = () => stage.children.filter(c => c !== target && c.texture === target.texture).length;
  const clear = () => mode === 'filter' ? !target.filters?.length : overlays() === 0;
  const frame = ms => { player.update(ms); app.render(); };
  const white = () => { // colour at the target's lower-right corner, clear of the 16 px effect sprites drawn over its centre
    const canvas = app.canvas ?? app.view, copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0);
    const r = app.renderer.resolution, p = ctx.getImageData(Math.floor((camera.x + target.x + 10) * r), Math.floor((camera.y + target.y + 10) * r), 1, 1).data;
    return [p[0], p[1], p[2]];
  };
  try {
    await player.load('/juice.vfxb');
    const from = { x: 100, y: 200 };
    // `target` is both the flash subject and the default destination (read live: its x/y are the feet).
    let h = player.play('juice', { from, fitDistance: true, parent: stage, hitstop: true, target });
    const ground = stage.children[0];
    check(near(ground.x, 460) && near(ground.y, 200), 'target is the default destination');
    player.update(99); app.render();
    check(!player.frozen && clear() && camera.x === 100, 'nothing happens before contact');
    check(white().join() === (mode === 'filter' ? '255,0,0' : '128,128,128'), 'target colour before the flash: ' + white());
    player.update(1);   // contact at t = 100 ms
    check(player.frozen, 'contact freezes the player');
    check(near(camera.x - 100, 2.5) && camera.y === 50, `camera kicks 2.5 px along the blow (right): ${camera.x - 100},${camera.y - 50}`);
    app.render();
    check(white().join() === '255,255,255', `full-strength flash (${mode}) is white: ` + white());
    const t0 = h.elapsedMs;
    frame(16); check(h.elapsedMs === t0 && player.frozen, 'frame 1 of the micro-freeze');
    frame(16); check(h.elapsedMs === t0, 'frame 2 of the micro-freeze (the pack\'s own 100 ms hitstop is replaced, not added)');
    frame(16); check(h.elapsedMs > t0 && !player.frozen, 'playback resumes after 32 ms: ' + (h.elapsedMs - t0));
    for (let i = 0; i < 3; i++) frame(16);   // overlays saturate until the flash is below half strength, ~75 ms in
    check(white().join() !== '255,255,255', 'flash has decayed after the hold: ' + white());
    for (let i = 0; i < 30; i++) frame(16);
    check(camera.x === 100 && camera.y === 50, 'camera is back exactly where it started: ' + camera.x + ',' + camera.y);
    check(clear(), 'flash removed again: ' + overlays() + ' overlays, ' + target.filters?.length + ' filters');
    h.stop();
    // Left cast kicks the other way; the pack's own jitter shake is replaced by the impulse.
    target.position.set(-260, 200);
    h = player.play('juice', { from, fitDistance: true, parent: stage, hitstop: 16, target });
    player.update(100);
    check(near(camera.x - 100, -2.5), 'left cast kicks left: ' + (camera.x - 100));
    frame(16); const cut = h.elapsedMs; frame(16); check(h.elapsedMs > cut, 'hitstop: 16 is a single frame');
    for (let i = 0; i < 20; i++) frame(16);
    check(camera.x === 100 && camera.y === 50, 'camera restored after the left kick');
    h.stop();
    // Opt-outs: flash false and impulse false leave only the freeze.
    target.position.set(460, 200);
    h = player.play('juice', { from, fitDistance: true, parent: stage, hitstop: true, target, flash: false, impulse: false });
    player.update(100);
    check(player.frozen && camera.x === 100 && clear(), 'flash:false and impulse:false opt out');
    h.stop(); for (let i = 0; i < 4; i++) frame(16);
    // Plain plays keep the 1.x behaviour: no juice, the pack's own cues are ignored unless the player enables them.
    h = player.play('juice', { from, to: { x: 460, y: 200 }, fitDistance: true, parent: stage });
    player.update(100);
    check(!player.frozen && clear(), 'a play without juice options adds no freeze and no flash');
    check(Math.hypot(camera.x - 100, camera.y - 50) <= 6, 'the pack\'s own non-directional shake cue still works as before');
    h.stop(); for (let i = 0; i < 20; i++) frame(16);
    check(camera.x === 100 && camera.y === 50, 'legacy jitter settles back exactly');
    // A second contact while flashing restarts the flash instead of stacking filters.
    h = player.play('juice', { from, fitDistance: true, parent: stage, target, loop: true });
    player.update(100); frame(16);
    const count = () => mode === 'filter' ? target.filters.length : overlays(), stacked = count(); player.update(300);
    check(count() <= stacked && stacked <= 2, 'repeated hits never stack flash filters or overlays: ' + stacked);
    h.stop(); for (let i = 0; i < 12; i++) frame(16);
    check(clear(), 'flash ends after the loop is stopped');
    // reuseEvents hands out one object per type.
    const shared = new VfxPlayer(app, { reuseEvents: true }), seen = [];
    await shared.load('/juice.vfxb');
    shared.on('tier', e => seen.push(e)); shared.on('cue', e => seen.push(e));
    const r = shared.play('juice', { from, to: { x: 460, y: 200 }, fitDistance: true, parent: stage });
    shared.update(150);
    const tiers = seen.filter(e => e.tier), cues = seen.filter(e => e.type);
    check(tiers.length >= 2 && tiers.every(e => e === tiers[0]) && cues.length >= 1 && cues.every(e => e === cues[0]), 'reuseEvents shares one object per type');
    r.stop(); shared.destroy();
    // Playback records are pooled: a handle that is over stays inert even after its record is reused.
    const pooled = new VfxPlayer(app), plain = { from, to: { x: 460, y: 200 }, fitDistance: true, parent: stage };
    await pooled.load('/juice.vfxb');
    const first = pooled.play('juice', plain); first.stop();
    const second = pooled.play('juice', plain);
    first.stop();
    check(first !== second && first.elapsedMs === 0 && pooled.stats().active === 1, 'a stale handle cannot stop the play that reused its record: ' + pooled.stats().active);
    await first.finished;
    second.stop(); pooled.destroy();
    const recycled = new VfxPlayer(app, { recycleHandles: true });
    await recycled.load('/juice.vfxb');
    const one = recycled.play('juice', plain); one.stop();
    const two = recycled.play('juice', plain);
    check(one === two && recycled.stats().active === 1 && two.elapsedMs === 0, 'recycleHandles reuses one handle object');
    two.stop(); recycled.update(16); const three = recycled.play('juice', plain);
    check(three === one, 'recycled handle comes back after the record is released'); three.stop(); recycled.destroy();
  } finally { player.destroy(); camera.destroy({ children: true }); }
}
async function flowSmoke(engine) {
  const g = engine === 'v8' ? window.__v8 : window.__v7, { app, Container, FlowTrail, makeNoiseTexture } = g;
  const check = (ok, message) => { if (!ok) throw Error(`${engine} flow: ${message}`); };
  if (engine === 'v7') {
    check(!FlowTrail.supported(app), 'Pixi 7 is not supported');
    let message = ''; try { new FlowTrail({ texture: g.Texture.WHITE }); } catch (error) { message = String(error); }
    check(/needs Pixi 8/.test(message), 'constructing on Pixi 7 throws a clear error: ' + message);
    return;
  }
  check(FlowTrail.supported(app) && !FlowTrail.supported({ renderer: { name: 'webgpu' } }), 'supported only on WebGL');
  // The shipped noise tiles: the step across the wrap seam is no bigger than a typical neighbouring step.
  const noise = makeNoiseTexture(), pix = noise.source.resource.getContext('2d').getImageData(0, 0, 64, 64).data, at = (x, y) => pix[(y * 64 + x) * 4];
  let seam = 0, inner = 0;
  for (let y = 0; y < 64; y++) { seam += Math.abs(at(63, y) - at(0, y)) + Math.abs(at(y, 63) - at(y, 0)); for (let x = 0; x < 63; x++) inner += Math.abs(at(x, y) - at(x + 1, y)) + Math.abs(at(y, x) - at(y, x + 1)); }
  check(seam / 128 <= (inner / (63 * 128)) * 1.5 + 1, `noise seam ${seam / 128} vs neighbours ${inner / (63 * 128)}`);
  check(pix[0] !== pix[4] || pix[4] !== pix[8], 'noise has structure');
  // Energy texture with hard bands, so scrolling visibly changes the picture.
  const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffd890' : '#401800'; x.fillRect(i * 8, 0, 8, 16); }
  const parent = new Container(); app.stage.addChild(parent);
  const trail = new FlowTrail({ texture: g.Texture.from(c), width: 40, points: 16, turbulence: 0.2 });
  parent.addChild(trail.mesh); trail.reset(20, 100);
  for (let i = 0; i < 16; i++) { trail.push(20 + i * 12, 100); trail.update(0); }
  const grab = () => { app.render(); const canvas = app.canvas, copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0); const r = app.renderer.resolution; return ctx.getImageData(0, Math.floor(70 * r), Math.floor(260 * r), Math.floor(60 * r)).data; };
  const lit = d => { let n = 0; for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2]; return n; };
  const diff = (p, q) => { let n = 0; for (let i = 0; i < p.length; i += 4) n += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]); return n; };
  const a = grab(), again = (trail.update(0), grab());
  check(lit(a) > 1000, 'the trail draws something: ' + lit(a));
  check(diff(a, again) === 0, 'the same time and positions give the same picture');
  trail.update(120); const later = grab();
  check(diff(a, later) > lit(a) * 0.02, 'the energy scrolls and warps with time: ' + diff(a, later) + ' vs ' + lit(a));
  trail.dissolve = 0.5; trail.update(0); const half = grab();
  check(lit(half) < lit(later) * 0.85 && lit(half) > 0, `half dissolved is dimmer but present: ${lit(half)} < ${lit(later)}`);
  trail.dissolve = 1; trail.update(0); const gone = grab();
  check(lit(gone) < lit(a) * 0.01, 'fully dissolved leaves nothing: ' + lit(gone));
  trail.dissolve = 0; trail.alpha = 0.5; trail.update(0); const faint = grab();
  check(lit(faint) < lit(later) * 0.75, 'alpha dims the trail');
  // No per-frame allocation in the trail itself: the same typed arrays are reused through thousands of updates.
  const positions = trail.mesh.geometry.getBuffer('aPosition').data, before = trail.points.map(p => p);
  for (let i = 0; i < 3000; i++) { trail.push(20 + (i % 200), 100 + Math.sin(i) * 20); trail.update(16.7); }
  check(trail.mesh.geometry.getBuffer('aPosition').data === positions && trail.points.every((p, i) => p === before[i]), 'vertex buffer and points are reused');
  trail.destroy(); parent.destroy({ children: true });
}
async function rampSmoke(engine) {
  const g = engine === 'v8' ? window.__v8 : window.__v7, { app, Container, VfxPlayer } = g;
  const check = (ok, message) => { if (!ok) throw Error(`${engine} ramp: ${message}`); };
  const gpu = engine === 'v8';
  const parent = new Container(); app.stage.addChild(parent);
  const player = new VfxPlayer(app, { ramps: { ice: [[0, 0], [0.5, 0x2040ff], [1, 0xffffff]] } });
  const px = (x, y) => { const canvas = app.canvas ?? app.view, copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0); const r = app.renderer.resolution; return [...ctx.getImageData(Math.floor(x * r), Math.floor(y * r), 1, 1).data].slice(0, 3); };
  const draw = () => { player.update(1); app.render(); };
  const near = (p, q, e = 6) => p.every((v, i) => Math.abs(v - q[i]) <= e);
  try {
    await player.load('/ramped.vfxb');
    const from = { x: 50, y: 200 };
    // The energy layer sits at x 190-206 (50 + 140): level 0 at its left edge, 255 at its right edge.
    let h = player.play('ramped', { from, to: { x: 410, y: 200 }, parent, fitDistance: true, element: 'fire' });
    draw();
    if (gpu) {
      check(near(px(205.5, 188), [255, 243, 196], 8), 'fire ramp: core colour at the brightest column: ' + px(205.5, 188));
      check(px(190.5, 188).every(v => v < 30), 'level 0 is black (additive adds nothing): ' + px(190.5, 188));
      const mid = px(198.5, 188); check(mid[0] > mid[2] + 40, 'fire ramp mid-level is warm: ' + mid);
      h.stop(); h = player.play('ramped', { from, to: { x: 410, y: 200 }, parent, fitDistance: true, element: 'cyan' }); draw();
      const cy = px(205.5, 188); check(near(cy, [232, 255, 255], 8) && px(198.5, 188)[2] > px(198.5, 188)[0] + 40, 'the same atlas recoloured by element: cyan ' + cy + ' mid ' + px(198.5, 188));
      h.stop(); h = player.play('ramped', { from, to: { x: 410, y: 200 }, parent, fitDistance: true }); draw();
      const nat = px(198.5, 188); check(nat[1] > 100 && nat[0] < 10 && nat[2] < 10, 'no element: the pack\'s native ramp (green) is used: ' + nat);
      h.stop(); h = player.play('ramped', { from, to: { x: 410, y: 200 }, parent, fitDistance: true, element: 'ice' }); draw();
      check(near(px(205.5, 188), [255, 255, 255], 8) && px(198.5, 188)[2] > px(198.5, 188)[0] + 60, 'custom ramps registered with the player: core ' + px(205.5, 188) + ' mid ' + px(198.5, 188));
      h.stop();
      // Left cast: the layer is mirrored with the rest of the pack (bright edge now on the left of the quad).
      h = player.play('ramped', { from: { x: 500, y: 200 }, to: { x: 140, y: 200 }, parent, fitDistance: true, element: 'fire' }); draw();
      check(near(px(500 - 140 - 15.5, 188), [255, 243, 196], 8) && px(500 - 140 - 0.5, 188).every(v => v < 30), 'left cast mirrors the ramp layer');
      h.stop();
      // Many plays, many elements: one batched mesh per sheet, so the draw calls do not grow with the number of plays.
      const gl = app.renderer.gl; let draws = 0;
      for (const name of ['drawElements', 'drawArrays']) { const orig = gl[name].bind(gl); gl[name] = (...a) => { draws++; return orig(...a); }; }
      const plays = ['fire', 'kim', 'thuy', 'moc', 'loi', 'tho'].map((element, i) => player.play('ramped', { from: { x: 50 + i * 40, y: 200 }, to: { x: 410 + i * 40, y: 200 }, parent, fitDistance: true, element }));
      player.update(1); draws = 0; app.render();
      check(player.stats().quadBatches === 1, 'six plays share one ramp batch: ' + player.stats().quadBatches);
      check(draws <= 4, `six recoloured plays render in few draw calls (${draws}): one ramp mesh plus the material sprites`);
      plays.forEach(p => p.stop());
      check(player.stats().quadBatches === 0, 'finished plays release their quads');
    } else {
      // Pixi 7 has no ramp shader: the layer is its mask tinted with the ramp's hue, drawn by an ordinary sprite.
      const root = parent.children[0], sprites = root.children;
      check(sprites.length === 2 && sprites[0].tint === 0xffffff && sprites[1].tint !== 0xffffff, 'fallback: the energy layer is a tinted sprite, materials stay white');
      const t = sprites[1].tint, r = t >> 16 & 255, gg = t >> 8 & 255, b = t & 255;
      check(r > 240 && gg > 140 && gg < 175 && b > 55 && b < 95, 'fallback tint is the fire ramp at 75%: ' + t.toString(16));
      check(player.stats().quadBatches === 0, 'no batches without the shader');
      h.stop();
    }
    let unknown = false; try { player.play('ramped', { from, parent, element: 'plasma' }); } catch (e) { unknown = /Unknown ramp/.test(String(e)); }
    check(unknown, 'an unknown element is an error, not a silent default');
    // Loading and unloading must give the native ramp's row back: more cycles than there are rows.
    for (let i = 0; i < 80; i++) { await player.load('/ramped.vfxb'); player.unload('ramped'); }
    await player.load('/ramped.vfxb'); player.play('ramped', { from, parent }).stop();
  } finally { player.destroy(); parent.destroy({ children: true }); }
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
const orderedSheetSize = 16;
const orderedSheets = new Map();
const orderedManifest = count => ({ ...empty, id: `ordered-${count}`, durationMs: 200, frameCount: 2, fps: 10, origin: { x: 0, y: 0 }, scale: 1,
  layers: orderedColors.slice(0, count).map((_, i) => ({ name: `ordered-${i}`, blend: i % 2 ? 'normal' : 'add', scale: [1, 0.5, 2][i % 3], sheets: [`ordered-${i}.png`], frames: [[0, 0, 0, orderedSheetSize, orderedSheetSize, 0, 0], i === 1 ? null : [0, 0, 0, orderedSheetSize, orderedSheetSize, 0, 0]] })),
});
async function orderedSmoke({ engine, colors, sheetSize }) {
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
        // Sample the center of the smallest (scale 1/2) layer, away from MSAA edges at fractional responsive resolutions.
        const xy = Math.floor((20 + sheetSize / 4) * app.renderer.resolution), actual = ctx.getImageData(xy, xy, 1, 1).data;
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
  stdin: { contents: `import * as PIXI from 'pixi.js'; import { Application, Container, Sprite, Texture } from 'pixi.js'; import { VfxPlayer, FlowTrail, makeNoiseTexture } from './runtime/src/index'; const app = new Application({width:1000,height:580}); document.body.appendChild(app.view); const vfx = await VfxPlayer.create(app); window.__v7 = {app,vfx,Container,Sprite,Texture,VfxPlayer,FlowTrail,makeNoiseTexture,ColorMatrixFilter: PIXI.ColorMatrixFilter ?? PIXI.filters.ColorMatrixFilter};`, resolveDir: root },
  bundle: true, format: 'esm', write: false, alias: { 'pixi.js': 'pixi7' },
});
const v8Bundle = await build({
  stdin: { contents: `import { Application, Container, Sprite, Texture, ColorMatrixFilter } from 'pixi.js'; import { VfxPlayer, FlowTrail, makeNoiseTexture } from './runtime/src/index'; const app = new Application(); await app.init({ width: 1000, height: 580, preference: 'webgl' }); document.body.appendChild(app.canvas); const vfx = await VfxPlayer.create(app); window.__v8 = {app,vfx,Container,Sprite,Texture,VfxPlayer,FlowTrail,makeNoiseTexture,ColorMatrixFilter};`, resolveDir: root },
  bundle: true, format: 'esm', write: false,
});
const catalogFixtureBundle = await build({
  entryPoints: [resolve(root, 'showcase/test/catalog-fixture.ts')], bundle: true, format: 'esm', write: false,
});
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/catalog-fixture.html') { res.setHeader('Content-Type', 'text/html'); res.end('<link rel="icon" href="data:,"><script type="module" src="/catalog-fixture.js"></script>'); return; }
    if (path === '/catalog-fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(catalogFixtureBundle.outputFiles[0].contents); return; }
    if (path === '/v8.html') { res.setHeader('Content-Type', 'text/html'); res.end('<link rel="icon" href="data:,"><script type="module" src="/v8.js"></script>'); return; }
    if (path === '/v8.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(v8Bundle.outputFiles[0].contents); return; }
    if (path === '/ramped.vfxb') { res.end(fixture(rampManifest(), rampSheets)); return; }
    if (path === '/juice.vfxb') { res.end(fixture(juiceManifest, impactSheets)); return; }
    if (path === '/v7.html') { res.setHeader('Content-Type', 'text/html'); res.end('<link rel="icon" href="data:,"><script type="module" src="/v7.js"></script>'); return; }
    if (path === '/v7.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(v7Bundle.outputFiles[0].contents); return; }
    if (path === '/feedback.vfxb' || path === '/invalid.vfxb') { res.end(path === '/feedback.vfxb' ? fixture(feedback, new Map()) : Buffer.from('invalid')); return; }
    if (path === '/offset.vfxb') { res.end(fixture(offset, decoded.sheets)); return; }
    if (path === '/offset.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(offset)); return; }
    if (/^\/ordered-[36]\.vfxb$/.test(path)) { res.end(fixture(orderedManifest(Number(path[9])), orderedSheets)); return; }
    if (path === '/destroy-cue.vfxb') { res.end(fixture(destroyCue, decoded.sheets)); return; }
    if (path === '/loop-cues.vfxb') { res.end(fixture(loopCues, new Map())); return; }
    if (path === '/impact.vfxb' || path === '/impact-v2.vfxb') { res.end(fixture(impactManifest(path === '/impact.vfxb' ? 1 : 2), impactSheets)); return; }
    if (path === '/actors.vfxb') { res.end(fixture(actors, new Map())); return; }
    if (path === '/aimed.vfxb' || path === '/aimed@90.vfxb') { res.end(fixture(aimed[path === '/aimed.vfxb' ? 0 : 90], new Map())); return; }
    if (path === '/slow.vfxb') { await new Promise(resolve => setTimeout(resolve, 40)); res.end(fixture(decoded.manifest, decoded.sheets)); return; }
    if (path === '/custom.vfxb' || path === '/plain.vfxb' || path === '/empty.vfxb') { res.end(path === '/custom.vfxb' ? custom : path === '/empty.vfxb' ? fixture(empty, new Map()) : plainContainer); return; }
    const local = path.replace(/^\/collection/, '') || '/';
    const folder = path.startsWith('/format-examples/') ? resolve(root, 'docs/format-examples') : dist;
    const relative = path.startsWith('/format-examples/') ? path.slice('/format-examples'.length) : local;
    const file = resolve(folder, '.' + (relative.endsWith('/') ? relative + 'index.html' : relative));
    if (!file.startsWith(folder + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm' }[extname(file)] ?? 'application/octet-stream');
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
    // Packs published with an impact block must fire exactly one tier event per tier (none today: harmless until a release carries it).
    const tierEvents = []; const tierListener = e => tierEvents.push(e.tier); vfx.on('tier', tierListener); let tiered = 0;
    for (const pack of packs) {
      await vfx.load(`./packs/free/${pack.id}.vfxb`);
      tierEvents.length = 0;
      const first = vfx.play(pack.id, { from, to });
      for (let ms = 0; ms < 16000; ms += 34) { vfx.update(34); if (ms === 1020) app.render(); }
      await first.finished; check(vfx.stats().active === 0, `${pack.id}: cleanup`);
      const expectedTiers = vfx.getManifest(pack.id)?.impact?.tiers.length ?? 0;
      check(tierEvents.length === expectedTiers, `${pack.id}: expected ${expectedTiers} tier events, got ${tierEvents.length}`);
      if (expectedTiers) tiered++;
      const pooled = vfx.stats().pooled;
      const second = vfx.play(pack.id, { from, to, speed: 2 });
      for (let ms = 0; ms < 16000; ms += 34) vfx.update(34);
      await second.finished; check(vfx.stats().pooled === pooled, `${pack.id}: pool grew`);
      vfx.unload(pack.id);
    }
    check(cues > 25, 'No cues'); vfx.off('cue', listener); vfx.off('tier', tierListener);
    await vfx.load('/format-examples/hoa-fireball.vfx.json');
    const handle = vfx.play('hoa-fireball', { from: to, to: from, fitDistance: true, loop: true });
    for (let ms = 0; ms < 12000; ms += 34) vfx.update(34);
    check(vfx.stats().active === 1, 'Loop stopped');
    handle.stop(); await handle.finished; check(vfx.stats().active === 0, 'Stop failed');
    let rejected = false; try { vfx.play('missing', { from }); } catch { rejected = true; } check(rejected, 'Unknown id accepted');
    rejected = false; try { vfx.play('hoa-fireball', { from, speed: 0 }); } catch { rejected = true; } check(rejected, 'Invalid speed accepted');
    return { count: packs.length, cues, pooled: vfx.stats().pooled, tiered };
  });
  console.log(`Pixi v8: PASS (${result.count} packs + plain JSON, cleanup, replay pool=${result.pooled}, ${result.cues} cues, ${result.tiered} packs with impact tiers, loop/stop/errors)`);
  const pngs = await page.evaluate(({ colors, sheetSize }) => colors.map(color => {
    const c = document.createElement('canvas'); c.width = c.height = sheetSize; const ctx = c.getContext('2d');
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`; ctx.fillRect(0, 0, sheetSize, sheetSize); return c.toDataURL('image/png').split(',')[1];
  }), { colors: orderedColors, sheetSize: orderedSheetSize });
  pngs.forEach((png, i) => orderedSheets.set(`ordered-${i}.png`, Buffer.from(png, 'base64')));
  pngs.forEach((png, i) => impactSheets.set(`ordered-${i}.png`, Buffer.from(png, 'base64')));
  pngs.forEach((png, i) => rampSheets.set(`ordered-${i}.png`, Buffer.from(png, 'base64')));
  rampSheets.set('ramp-mask.png', Buffer.from(await page.evaluate(() => { // 16x16 mask, level 0 at the left edge up to 255 at the right edge
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) { x.fillStyle = `rgb(${i * 17},${i * 17},${i * 17})`; x.fillRect(i, 0, 1, 16); }
    return c.toDataURL('image/png').split(',')[1]; }), 'base64'));
  await page.evaluate(orderedSmoke, { engine: 'v8', colors: orderedColors, sheetSize: orderedSheetSize });
  await page.evaluate(impactSmoke, 'v8');
  console.log('Pixi v8 impact tiers: PASS (tier roots, anchors on the target, mirror without shear, depth slots, switches, blend advice, tier events, loop, pool, unknown version)');
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
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  assert.equal(await page.locator('.skill').count(), 2);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.locator('#search').fill('fireball'); assert.equal(await page.locator('.skill').count(), 1);
  await page.locator('#search').fill('');
  await page.locator('#loop').check(); await page.locator('#sound').check();
  await page.waitForFunction(() => window.__showcase.audioState() === 'running');
  console.log('Showcase sound toggle: PASS (AudioContext starts while an existing loop is active)');
  await page.evaluate(() => { const event = new Event('pagehide'); Object.defineProperty(event, 'persisted', { value: true }); dispatchEvent(event); });
  if (!(await page.evaluate(() => window.__showcase.vfx.stats().packs))) throw Error('Persisted pagehide destroyed showcase');
  console.log('Showcase bfcache lifecycle: PASS (persisted pagehide keeps player alive)');
  await showcaseSmoke({ page, browser, url, collection });
  await catalogSmoke({ page, browser, url, collection });
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
  await page.evaluate(orderedSmoke, { engine: 'v7', colors: orderedColors, sheetSize: orderedSheetSize });
  await page.evaluate(impactSmoke, 'v7');
  for (const mode of ['overlay', 'filter']) await page.evaluate(juiceSmoke, { engine: 'v7', mode });
  await page.evaluate(flowSmoke, 'v7');
  await page.evaluate(rampSmoke, 'v7');
  console.log('Pixi v7 ramp packs: PASS (tinted-sprite fallback, no batches, unknown element)');
  console.log('Pixi v7 combat juice: PASS (micro-freeze, camera impulse along the blow, silhouette flash)');
  console.log('Pixi v7 impact tiers: PASS (same contract on Pixi 7)');
  await page.evaluate(actorSmoke, 'v7');
  console.log('Pixi v7 actors: PASS (interpolation, mirror/fit, hitstop, legacy, stop/end/reset, loop)');
  console.log('Pixi v7 ordered layers: PASS (3/6 layers, pixel-checked blend order, mixed scales, null frames, replay)');
  await page.goto(`${url}/v8.html`); await page.waitForFunction(() => window.__v8);
  for (const mode of ['overlay', 'filter']) await page.evaluate(juiceSmoke, { engine: 'v8', mode });
  await page.evaluate(flowSmoke, 'v8');
  await page.evaluate(rampSmoke, 'v8');
  console.log('Pixi v8 ramp packs: PASS (element/preset/custom/native ramps on one atlas, mirror, one batch for six plays, few draw calls, row reuse)');
  console.log('Pixi v8 flow trails: PASS (WebGL-only support check, seamless 64x64 noise, deterministic render, scrolling/warping over time, dissolve 0/0.5/1, alpha, reused typed arrays)');
  console.log('Pixi v8 combat juice: PASS (default target as destination, 32 ms micro-freeze replacing the pack hitstop, 2.5 px impulse along the blow and its exact restore, flat white silhouette flash then decay, opt-outs, no stacked filters, reuseEvents, pooled playback records with stale-handle safety, recycleHandles)');
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
  assert.ok(first.transfer <= 1600000, `Mobile first-load budget exceeded: ${first.transfer} B`);
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
