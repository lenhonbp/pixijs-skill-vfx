import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { Container } from 'pixi.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const { Container, VfxWorld, createVfxTextures, woodTextures } = kit;
    const tex = createVfxTextures(), wood = woodTextures(), at = { x: 100, y: 200, z: 0 };
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const world = () => new VfxWorld({ ...VfxWorld.createLayers(new Container()), seed: 12345 });
    const step = (w, ms) => {
      for (let left = ms; left > 0; left -= 16) {
        w.update(Math.min(16, left));
        for (const p of w.particles) check([p.sprite.x, p.sprite.y, p.sprite.alpha, p.sprite.scale.x, p.sprite.scale.y, p.sprite.rotation]
          .every(Number.isFinite), 'finite wood transforms');
      }
    };
    const clean = (w) => { step(w, 6500); check(!w.count && !w.updaters.length, 'wood cleanup'); };
    check(wood === woodTextures() && wood.leaves.every((t) => t !== tex.leaf), 'cached wood-only textures');
    const factories = [
      (w, duration) => kit.springBloom(w, { target: () => at, duration }),
      (w, duration) => kit.toxicSporeCloud(w, { at, duration }),
      (w, duration) => kit.root(w, tex, { target: () => at, duration }),
    ];
    for (const factory of factories) {
      for (const duration of [undefined, 0, 600]) {
        const w = world(), h = factory(w, duration);
        step(w, 700); if (duration !== 0) check(w.count > 0, 'wood draws'); clean(w); check(!h.alive, 'wood handle ends');
      }
      const w = world(), h = factory(w, 4000); step(w, 700); h.stop(); h.stop(); clean(w); check(!h.alive, 'idempotent wood stop');
    }
    let w = world(), hits = 0;
    kit.seedFlight(w, { from: at, to: { ...at, x: 400, z: 35 }, onHit: () => hits++ });
    step(w, 200); check(w.particles.some((p) => p.o.texture === wood.seed && p.o.blend === 'normal'), 'physical seed');
    clean(w); check(hits === 1, 'seed hits once');
    w = world();
    kit.seedFlight(w, { from: at, to: at, onHit: () => hits++ }); clean(w); check(hits === 2, 'zero-distance seed');
    w = world();
    const cancelled = kit.seedFlight(w, { from: at, to: { ...at, x: 400 }, onHit: () => hits++ });
    cancelled.stop(); clean(w); check(hits === 2, 'cancelled seed does not hit');
    for (const invoke of [
      (w) => kit.seedFlight(w, { from: at, to: at, speed: 0 }),
      (w) => kit.springBloom(w, { target: () => at, duration: -1 }),
      (w) => kit.toxicSporeCloud(w, { at, duration: NaN }),
    ]) {
      w = world(); let error; try { invoke(w); } catch (e) { error = e; }
      check(error instanceof RangeError, 'invalid wood options rejected'); clean(w);
    }
    w = world(); let blooms = 0;
    const cloud = kit.toxicSporeCloud(w, { at, onBloom: () => blooms++ });
    step(w, 448); check(blooms === 0, 'spore warning lasts 450ms'); step(w, 16); check(blooms === 1, 'spore bloom dispatch');
    cloud.stop(); clean(w); check(blooms === 1, 'spore bloom once');
    w = world(); const cancelledCloud = kit.toxicSporeCloud(w, { at, onBloom: () => blooms++ });
    cancelledCloud.stop(); clean(w); check(blooms === 1, 'cancelled cloud does not bloom');
    w = world(); const empty = kit.toxicSporeCloud(w, { at, duration: 0, onBloom: () => blooms++ });
    clean(w); check(blooms === 1 && !empty.alive, 'empty cloud does not bloom');
    w = world(); const bad = kit.seedFlight(w, { from: at, to: at, onHit: () => { throw new Error('seed callback'); } });
    let error; try { step(w, 16); } catch (e) { error = e.message; }
    check(error === 'seed callback' && !bad.alive, 'callback error propagates after seed stops'); clean(w);
    w = world(); const badCloud = kit.toxicSporeCloud(w, { at, onBloom: () => { throw new Error('spore callback'); } });
    error = undefined; try { step(w, 464); } catch (e) { error = e.message; }
    check(error === 'spore callback' && !badCloud.alive, 'callback error stops spore cloud'); clean(w);
    w = world(); let feet = { ...at };
    const vines = kit.root(w, tex, { target: () => feet, duration: 1800 });
    step(w, 1000);
    const coils = w.particles.filter((p) => p.o.texture === wood.stem && p.o.zBias !== undefined);
    check(coils.length === 60 && coils.some((p) => p.o.zBias < 0) && coils.some((p) => p.o.zBias > 0), 'tapered vines depth sort');
    const width = Math.max(...coils.map((p) => Math.abs(p.px)));
    vines.pulse(); step(w, 144); check(Math.max(...coils.map((p) => Math.abs(p.px))) < width * 0.85, 'vines squeeze');
    feet = { x: 400, y: 350, z: 20 }; step(w, 300);
    check(coils.every((p) => p.sprite.x === feet.x + p.px && p.sprite.y === feet.y - feet.z + p.py - p.pz), 'vines follow moving airborne unit');
    const green = coils[0].sprite.tint; step(w, 300); check(coils[0].sprite.tint !== green, 'vines wither brown'); clean(w);
    for (const variant of [undefined, 'spores']) {
      w = world(); let ticks = 0;
      kit.damageOverTime(w, tex, { target: () => at, kind: 'poison', poisonVisual: variant, duration: 1200, tickMs: 300, onTick: () => ticks++ });
      step(w, 400);
      check(w.particles.some((p) => p.o.texture === (variant ? wood.spore : tex.bubble)), 'poison variant texture');
      check(!variant || !w.particles.some((p) => p.o.texture === tex.bubble), 'no spore bubbles');
      clean(w); check(ticks === 4, 'poison final tick preserved');
    }
    return [
      'Wood textures: cached, independent of shared leaf PASS',
      'Wood recipes: normal/default/zero duration, stop, finite transforms and cleanup PASS',
      'Seed: physical sprite, impact/cancellation/zero distance and callback errors PASS',
      'Wood options: invalid duration/speed rejected PASS',
      'Spores: warning dispatch, cancellation, empty cloud, callback errors; vines: depth/movement/squeeze/wither PASS',
      'Poison: default bubbles unchanged, opt-in grains and final ticks PASS',
    ];
  });
  assert.equal(results.length, 6);
  console.log(results.join('\n'));
} finally { await browser.close(); }
