// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `
  export { Container, Texture } from 'pixi.js';
  export { VfxWorld } from './kit/vfx-world';
  export { spiritGuardian } from './kit/spirit-guardian';
  export { SKILLS } from './examples/skills';
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { Container, Texture, VfxWorld, spiritGuardian, SKILLS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const tex = new Proxy({}, { get: () => Texture.EMPTY });
const palette = { main: 0xffdd88, core: 0xffffff, dark: 0x554422 };
const make = () => new VfxWorld({ ...VfxWorld.createLayers(new Container()), seed: 42 });
const advance = (w, ms) => { for (let t = 0; t < ms; t += 16) w.update(Math.min(16, ms - t)); };
const empty = (w) => { assert.equal(w.count, 0); assert.equal(w.stats.updaters, 0); };

{
  const w = make(), hits = [], target = { x: -200, y: 80, z: 0 };
  const handle = spiritGuardian(w, tex, { x: 20, y: 40, palette, target: () => target,
    onStrike: (i, at) => {
      const body = w.layers.body.children.find((s) => s.anchor?.x === 88 / 192);
      const weapon = w.layers.body.children.find((s) => s.anchor?.x === 154 / 192);
      const angle = (weapon.rotation - body.rotation) / Math.sign(body.scale.x);
      assert(Math.abs(angle - [1.8, 1.6, 2.9][i]) < 1e-6, 'callback sees the exact halberd contact pose');
      assert(Math.abs(body.scale.y - 100 / 240 * 0.9) < 1e-6, 'impact squash is applied before callback');
      assert(w.now >= 1312 + i * 650 && w.now < 1328 + i * 650, 'callback fires on first frame crossing contact time');
      if (i === 2) assert(Math.abs(body.position.y - (body.zIndex - 20)) < 1e-6, 'slam dives to ground at contact');
      hits.push({ i, at }); target.x -= 5;
    } });
  advance(w, 700);
  const flyer = w.layers.body.children.find((s) => s.anchor?.x === 88 / 192);
  const shadow = w.layers.ground.children[0];
  const altitude = flyer.zIndex - 20 - flyer.position.y;
  assert(altitude >= 30 && altitude <= 50, 'glide hovers 30–50px above ground');
  assert.equal(shadow.position.y, flyer.zIndex - 20, 'shadow stays on ground');
  assert(shadow.scale.x < 100 / 180 && shadow.alpha < 0.4, 'shadow shrinks and fades in flight');
  advance(w, 400);
  const body = w.layers.body.children.find((s) => s.anchor?.x === 88 / 192);
  assert(body.position.x < 20 && body.position.x > target.x, 'guardian advances and stops short');
  assert(body.scale.x < 0, 'guardian faces left toward target');
  const weapon = w.layers.body.children.find((s) => s.anchor?.x === 154 / 192);
  assert((weapon.rotation - body.rotation) / -1 < -0.5, 'weapon winds back independently of body');
  const lx = 66 * body.scale.x, ly = -116 * body.scale.y;
  assert(Math.abs(weapon.position.x - body.position.x - lx * Math.cos(body.rotation) + ly * Math.sin(body.rotation)) < 1e-6, 'weapon grip stays attached to transformed hand');
  assert(Math.abs(weapon.position.y - body.position.y - lx * Math.sin(body.rotation) - ly * Math.cos(body.rotation)) < 1e-6, 'hand and grip share screen height');
  advance(w, 4000);
  assert.deepEqual(hits.map(({ i }) => i), [0, 1, 2]);
  assert.deepEqual(hits.map(({ at }) => at.x), [-200, -205, -210], 'target re-read per strike');
  assert.equal(handle.alive, false); empty(w);
}
{
  const w = make(); let hits = 0;
  spiritGuardian(w, tex, { x: 10, y: 20, palette, onStrike: () => hits++ });
  advance(w, 2400); assert.equal(hits, 0); empty(w);
  spiritGuardian(w, tex, { x: 0, y: 0, palette, target: () => ({ x: 0, y: 0 }), strikes: 0, onStrike: () => hits++ });
  advance(w, 1800); assert.equal(hits, 0); empty(w);
}
{
  const w = make(); let hits = 0;
  const handle = spiritGuardian(w, tex, { x: 0, y: 0, palette, target: () => ({ x: 200, y: 0 }), onStrike: () => hits++ });
  advance(w, 700); handle.stop(); handle.stop();
  advance(w, 4000); assert.equal(hits, 0); empty(w);
}
console.log('Guardian contracts: PASS (flight altitude, ground shadow, facing, grip attachment, wind-up, exact contact pose/timing, ground slam, retarget, idle, zero strikes, cancellation, cleanup)');
{
  const w = make(), hits = [], rings = [];
  w.groundSquash = 0.5;
  const unit = (x, y) => ({ feet: { x, y, z: 0 }, height: 96, facing: 1 });
  const caster = unit(330, 405), targets = [unit(790, 405), unit(900, 330), unit(905, 490), unit(1021, 405)];
  const spawn = w.spawn.bind(w);
  w.spawn = (o) => { if (o.life === 420 && o.layer === 'ground') rings.push(o); return spawn(o); };
  SKILLS.find((s) => s.id === 'summon-spirit').cast({ w, tex, caster, target: targets[0], targets,
    hurt: (u, amount, o) => hits.push({ target: targets.indexOf(u), amount, crit: o.crit }) });
  advance(w, 7000);
  assert.deepEqual(hits, [
    { target: 0, amount: 92, crit: false }, { target: 0, amount: 92, crit: false },
    { target: 0, amount: 185, crit: true }, { target: 1, amount: 185, crit: true }, { target: 2, amount: 185, crit: true },
  ]);
  assert.equal(rings.length, 2);
  assert.equal(rings[0].scale[1] * 120, caster.height * 2.4, 'outer shockwave radius matches damage radius');
  empty(w);
  console.log('Summon AoE: PASS (3 demo enemies take 185 crit; outside enemy excluded; visual radius = hit radius = 230.4)');
}
