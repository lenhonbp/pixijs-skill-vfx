import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `
  export { Container, Texture } from 'pixi.js';
  export { VfxWorld } from './kit/vfx-world';
  export { spiritGuardian } from './kit/spirit-guardian';
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { Container, Texture, VfxWorld, spiritGuardian } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const tex = Object.fromEntries(['guardian', 'glow', 'dot', 'puff', 'star', 'crescent', 'ring', 'rock'].map((key) => [key, Texture.EMPTY]));
const palette = { main: 0xffdd88, core: 0xffffff, dark: 0x554422 };
const make = () => new VfxWorld({ ...VfxWorld.createLayers(new Container()), seed: 42 });
const advance = (w, ms) => { for (let t = 0; t < ms; t += 16) w.update(Math.min(16, ms - t)); };
const empty = (w) => { assert.equal(w.count, 0); assert.equal(w.stats.updaters, 0); };

{
  const w = make(), hits = [], target = { x: -200, y: 80, z: 0 };
  const handle = spiritGuardian(w, tex, { x: 20, y: 40, palette, target: () => target,
    onStrike: (i, at) => { hits.push({ i, at }); target.x -= 5; } });
  advance(w, 1100);
  const body = w.layers.body.children.find((s) => s.anchor?.x === 88 / 192);
  assert(body.position.x < 20 && body.position.x > target.x, 'guardian advances and stops short');
  assert(body.scale.x < 0, 'guardian faces left toward target');
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
console.log('Guardian contracts: PASS (advance, facing, three impacts, retarget, idle, zero strikes, cancellation, cleanup)');
