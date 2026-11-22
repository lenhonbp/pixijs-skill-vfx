import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { lightningBolt } from './kit/lightning-bolt'; export { Container } from 'pixi.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const { Container, VfxWorld, createVfxTextures, lightningBolt, lightningChain, lightningStrike,
      lightningCharge, lightningWarning, stormCloud, staticField, LOI } = kit;
    const tex = createVfxTextures(), p = LOI.palette, results = [];
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const world = () => new VfxWorld({ ...VfxWorld.createLayers(new Container()), rng: kit.mulberry32(12345) });
    const step = (w, time) => { for (let left = time; left > 0; left -= 16) w.update(Math.min(left, 16)); };
    const children = (w) => Object.values(w.layers).reduce((n, layer) => n + layer.children.length, 0);
    const clean = (w) => {
      step(w, 3000);
      check(!w.count && !w.updaters.length && !w.disposers.size && !children(w), 'lightning: no particles, updaters, owned resources or display children left');
    };
    const a = { x: 20, y: 250, z: 200 }, b = { x: 140, y: 250, z: 0 };
    let w = world(), bolt = lightningBolt(w, tex, a, b, p, { life: 210, width: 2, branches: 3 });
    const root = w.layers.body.children[0], core = root.children[2];
    check(w.count === 0 && root.children.length === 3 && core.alpha === 0.09, 'bolt: Graphics ribbons and faint leader, no segment particles');
    check(core.context.instructions.length === 4, 'bolt: main channel plus three terminating forks');
    step(w, 32); check(core.alpha === 1, 'bolt: bright return stroke');
    const first = core.context.instructions[0];
    const bounds = { ...core.getLocalBounds() };
    step(w, 32); check(core.alpha === 0.05, 'bolt: gap before restrike');
    step(w, 16); check(core.alpha === 0.8 && core.context.instructions[0] !== first, 'bolt: restrike regenerates fine jitter');
    const next = core.getLocalBounds();
    check(Math.abs(next.minX - bounds.minX) < 8 && Math.abs(next.maxY - bounds.maxY) < 8, 'bolt: restrike keeps the large path');
    step(w, 30); check(core.alpha === 0.04, 'bolt: second inter-stroke gap');
    step(w, 22); check(core.alpha === 0.55, 'bolt: final restrike');
    step(w, 48); check(core.alpha > 0 && core.alpha < 0.1, 'bolt: faint afterglow');
    step(w, 30); check(!bolt.alive && root.destroyed, 'bolt: finite geometry cleanup'); clean(w);
    w = world(); bolt = lightningBolt(w, tex, a, b, p); bolt.stop(); bolt.stop(); clean(w);
    w = world(); bolt = lightningBolt(w, tex, a, b, p, { restrikes: 0 });
    step(w, 80); check(w.layers.body.children[0].children[2].alpha < 0.2, 'bolt: single-flash option omits restrikes'); clean(w);
    w = world(); lightningChain(w, tex, { points: [a, b], palette: p, flickers: 5, impactIntensity: 0 });
    step(w, 1); const customCore = w.layers.body.children[0].children[2];
    let flashes = 0, bright = false;
    for (let i = 0; i < 249; i++) {
      step(w, 1); const on = customCore.alpha >= 0.19;
      if (on && !bright) flashes++; bright = on;
    }
    check(flashes === 5, 'chain: custom flicker count is not silently capped'); clean(w);
    w = world(); bolt = lightningBolt(w, tex, a, b, p); w.clear();
    check(!bolt.alive && !children(w), 'bolt: clear destroys geometry immediately'); clean(w);
    for (const options of [{ life: 0 }, { width: 0 }]) {
      w = world(); check(!lightningBolt(w, tex, a, b, p, options).alive && !children(w), 'bolt: empty options are inert'); clean(w);
    }
    w = world(); check(!lightningBolt(w, tex, a, a, p).alive, 'bolt: coincident endpoints are inert'); clean(w);
    for (const options of [{ life: NaN }, { width: Infinity }, { depth: NaN }, { branches: Infinity }]) {
      w = world(); let error;
      try { lightningBolt(w, tex, a, b, p, options); } catch (e) { error = e; }
      check(error instanceof RangeError && !children(w), 'bolt: invalid options fail without allocating'); clean(w);
    }
    results.push('Lightning ribbons: zero segment particles, forks, leader/return/gaps/restrikes/afterglow, stable path, stop/clear/empty/errors PASS');

    w = world();
    const cloud = stormCloud(w, tex, { x: 100, y: 300, height: 240, width: 300, palette: p, duration: 600 });
    const canopy = w.layers.top.children[0], texture = canopy.children[0].texture;
    check(canopy.alpha === 0 && w.count === 0, 'cloud: gathers from transparent, normal body outside particle pool');
    step(w, 300); cloud.flash(); step(w, 16);
    check(canopy.alpha > 0 && canopy.children[1].alpha > 0, 'cloud: shaded body and lit interior');
    const source = cloud.source(10000);
    check(source.x <= 214 && source.y - source.z === 72, 'cloud: sources stay in shared canopy, regardless of target ground depth');
    step(w, 300); check(!cloud.alive && canopy.destroyed && texture.destroyed, 'cloud: texture and sprites are owned'); clean(w);
    w = world(); const forever = stormCloud(w, tex, { x: 0, y: 0, palette: p, duration: Infinity });
    step(w, 4000); check(forever.alive, 'cloud: Infinity'); w.clear(); check(!forever.alive, 'cloud: clear stops handle'); clean(w);
    w = world(); check(!stormCloud(w, tex, { x: 0, y: 0, palette: p, duration: 0 }).alive, 'cloud: zero duration'); clean(w);
    results.push('Storm canopy: gather/shading/inner flash, shared-depth sources, owned texture, finite/Infinity/zero/clear PASS');

    w = world(); let releases = 0;
    let charge = lightningCharge(w, tex, { target: () => a, palette: p, duration: 100, onDone: () => releases++ });
    step(w, 64); charge.stop(); clean(w); check(releases === 0, 'charge: cancellation does not cast');
    w = world(); charge = lightningCharge(w, tex, { target: () => a, palette: p, duration: 100, onDone: () => releases++ });
    step(w, 96); check(releases === 0, 'charge: no early release');
    step(w, 16); check(releases === 1 && !charge.alive, 'charge: release exactly once'); clean(w);
    w = world(); let warnings = 0;
    lightningWarning(w, tex, { x: 0, y: 0, radius: 30, palette: p, duration: 100, onDone: () => warnings++ });
    step(w, 96); check(warnings === 0, 'warning: no early strike'); step(w, 16);
    check(warnings === 1 && w.particles.every((q) => q.o.texture !== tex.ring), 'warning: crawling mark, not generic rings'); clean(w);

    w = world(); const chain = lightningChain(w, tex, { points: [a, b, { x: 220, y: 250, z: 50 }], palette: p, hopMs: 40, impactIntensity: 0 });
    step(w, 1); check(w.layers.body.children.length === 1, 'chain: first hop only');
    step(w, 39); check(w.layers.body.children.length === 2 && w.count === 0, 'chain: second hop delayed, no endpoint blob');
    chain.stop(); clean(w);
    w = world(); lightningChain(w, tex, { points: [], palette: p }); clean(w);
    w = world(); let strikeError;
    lightningStrike(w, tex, { x: 0, y: 0, palette: p, onHit: () => { throw new Error('strike callback'); }, delay: 50 });
    try { step(w, 64); } catch (e) { strikeError = e.message; }
    check(strikeError === 'strike callback', 'strike: gameplay errors propagate'); w.clear(); clean(w);
    results.push('Lightning charge/warning/chain/strike: cancellation, exact release/warning timing, delayed hops, empty chains and callback errors PASS');

    w = world(); let ticks = 0, peak = 0;
    const spawn = w.spawn.bind(w);
    w.spawn = (o) => { const q = spawn(o); peak = Math.max(peak, w.count); return q; };
    const field = staticField(w, tex, { x: 0, y: 0, radius: 100, palette: p, duration: 1500,
      targets: () => [{ x: -30, y: -30 }, { x: 0, y: 0 }, { x: 30, y: 30 }], onTick: () => ticks++ });
    step(w, 496); check(ticks === 0, 'field: first hit remains at 500 ms');
    step(w, 16); check(ticks === 1 && w.layers.top.children.length > 0, 'field: cloud strikes and damage tick together');
    check(w.particles.filter((q) => q.o.texture === tex.streak).length === 12, 'field: four sparks per target, not particle swarms');
    check(w.particles.filter((q) => q.o.texture === tex.glow).every((q) => q.o.layer === 'ground' && q.o.groundAligned), 'impact: no spherical white flashes');
    step(w, 1800); check(ticks === 3 && !field.alive && peak <= 150, 'field: same final tick and bounded particles'); clean(w);
    results.push(`Thunder field: cloud strikes on existing 500 ms ticks, ground flashes/scorch/smoke/four sparks, zero display-resource leaks, peak ${peak} <=150 PASS`);
    return results;
  });
  results.forEach((line) => console.log(line));
} finally {
  await browser.close();
}
