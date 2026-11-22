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
    const { Container, VfxWorld, createVfxTextures } = kit;
    const tex = createVfxTextures(), results = [];
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const world = () => new VfxWorld(VfxWorld.createLayers(new Container()));
    const step = (w, ms) => {
      for (let time = 0; time < ms; time += 16) {
        w.update(Math.min(16, ms - time));
        for (const p of w.particles) check([p.sprite.x, p.sprite.y, p.sprite.alpha, p.sprite.scale.x, p.sprite.scale.y, p.sprite.rotation]
          .every(Number.isFinite), 'finite transforms, alpha and scale');
      }
    };
    const clean = (w, name) => {
      step(w, 2500);
      check(w.count === 0 && w.updaters.length === 0, `${name}: complete cleanup`);
    };
    for (const name of ['silence', 'blind', 'armorBreak', 'mark', 'fear', 'aura', 'regen', 'haste', 'empower']) {
      let ticks = 0, at = { x: 100, y: 200, z: 0 };
      let w = world();
      const handle = kit[name](w, tex, { target: () => at, duration: Infinity, height: 105,
        tickMs: 200, numbers: false, onTick: () => ticks++ });
      step(w, 900);
      check(handle.alive && w.count > 0, `${name}: sustained indefinitely`);
      at = { x: 500, y: 400, z: 35 };
      step(w, 1600);
      check(handle.alive && w.count > 0, `${name}: Infinity does not time out`);
      check(w.particles.some((p) => p.sprite.x > 400), `${name}: follows moving unit`);
      if (name === 'regen') check(ticks === 12, 'regen: Infinity ticks');
      handle.stop(); handle.stop();
      const ticksAtStop = ticks;
      check(!handle.alive, `${name}: idempotent stop`);
      clean(w, name);
      check(ticks === ticksAtStop, `${name}: no ticks after stop`);
      w = world();
      const finite = kit[name](w, tex, { target: () => at, duration: 600, height: 35, numbers: false });
      step(w, 1100);
      check(!finite.alive, `${name}: finite duration`); clean(w, name);
      const empty = kit[name](w, tex, { target: () => at, duration: 0, numbers: false });
      clean(w, name); check(!empty.alive, `${name}: zero duration`);
      const defaults = kit[name](w, tex, { target: () => at, numbers: false });
      step(w, 7000);
      check(!defaults.alive && !w.count && !w.updaters.length, `${name}: default duration cleanup`);
      results.push(`${name}: Infinity/stop, finite/default/zero duration, movement and finite transforms PASS`);
    }
    let w = world(), values = [];
    kit.regen(w, tex, { target: () => ({ x: 0, y: 0 }), duration: 1000, tickMs: 250,
      heal: () => 25, numbers: false, onTick: (n) => values.push(n) });
    step(w, 1500);
    check(values.length === 4 && values.every((n) => n === 25), 'regen: includes final tick and dynamic amount');
    check(!w.particles.some((p) => p.o.texture === tex.digits['2']), 'regen: numbers false');
    clean(w, 'regen');
    w = world();
    kit.regen(w, tex, { target: () => ({ x: 0, y: 0 }), duration: 600, tickMs: 200, heal: 20 });
    step(w, 250);
    check(w.particles.some((p) => p.o.tint === 0x88ef98), 'regen: healing number color');
    clean(w, 'regen numbers');
    w = world();
    const bad = kit.regen(w, tex, { target: () => ({ x: 0, y: 0 }), duration: Infinity,
      onTick: () => { throw new Error('healing callback'); } });
    let error;
    try { step(w, 800); } catch (e) { error = e.message; }
    check(error === 'healing callback', 'regen: callback error propagation'); bad.stop(); clean(w, 'regen error');
    w = world();
    const hidden = kit.aura(w, tex, { target: () => ({ x: 0, y: 0 }), duration: Infinity,
      palette: { core: 0xffffff, main: 0xff0088, dark: 0x330011 }, intensity: 0, column: true });
    step(w, 600);
    check(w.particles.every((p) => p.sprite.alpha === 0), 'aura: zero intensity'); hidden.stop(); clean(w, 'aura zero');
    results.push('regen tick amounts/final tick/numbers/errors and aura intensity: PASS');
    return results;
  });
  results.forEach((line) => console.log(line));
} finally {
  await browser.close();
}
