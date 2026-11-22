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
    w = world();
    let at = { x: 100, y: 200, z: 0 }, breaks = 0;
    const bell = kit.goldenBell(w, tex, { target: () => at, duration: Infinity, height: 105, onBreak: () => breaks++ });
    step(w, 200);
    check(!w.particles.some((p) => p.o.texture === tex.bell && p.sprite.visible), 'bell: anticipation before drop');
    step(w, 150);
    check(w.particles.some((p) => p.o.texture === tex.bell && p.pz > 0), 'bell: drops from above');
    step(w, 250);
    const shell = w.particles.find((p) => p.o.texture === tex.bell);
    check(shell && shell.pz === 0 && shell.o.blend === 'normal', 'bell: landed translucent silhouette');
    at = { x: 500, y: 350, z: 20 };
    step(w, 32);
    check(shell.sprite.x === at.x && shell.sprite.y === at.y - at.z, 'bell: follows feet and airborne height');
    bell.hit(); step(w, 32);
    check(Math.abs(shell.sprite.x - at.x) > 0.1, 'bell: rings with horizontal wobble');
    check(w.particles.some((p) => p.o.texture === tex.ring && p.o.zBias === 32), 'bell: concentric sound ripples');
    step(w, 800); bell.hit(Math.PI); step(w, 800);
    check(bell.alive && breaks === 0, 'bell: two hits do not break ward');
    bell.break(); bell.break(); bell.hit();
    check(!bell.alive && breaks === 1, 'bell: break exactly once');
    check(w.particles.some((p) => p.o.texture === tex.bellCracks), 'bell: fracture texture');
    check(w.particles.some((p) => p.o.texture === tex.shard && p.o.gravity > 0), 'bell: falling gold shards');
    clean(w, 'bell break');
    for (const duration of [0, 600, undefined, Infinity]) {
      w = world();
      const handle = kit.goldenBell(w, tex, { target: () => at, duration });
      if (duration === Infinity) {
        step(w, 7000); check(handle.alive && w.count > 0, 'bell: Infinity sustains');
        handle.stop(); handle.stop(); handle.hit(); handle.break();
      } else step(w, 5000);
      clean(w, 'bell duration/stop');
      check(!handle.alive, 'bell: duration or stop ends handle');
    }
    w = world();
    const cancelled = kit.goldenBell(w, tex, { target: () => at, duration: Infinity, onBreak: () => breaks++ });
    cancelled.stop(); clean(w, 'bell early cancellation');
    check(breaks === 1, 'bell: stop does not invoke break callback');
    w = world();
    const broken = kit.goldenBell(w, tex, { target: () => at, onBreak: () => { throw new Error('bell callback'); } });
    step(w, 600);
    let bellError;
    try { broken.break(); } catch (e) { bellError = e.message; }
    check(bellError === 'bell callback' && !broken.alive, 'bell: callback error leaves stopped handle');
    clean(w, 'bell callback error');
    results.push('goldenBell: gather/drop/landing, hits/break, Infinity/stop, finite/zero/default, movement and errors PASS');
    w = world(); at = { x: 100, y: 200, z: 0 }; breaks = 0;
    const armor = kit.stoneArmor(w, tex, { target: () => at, duration: Infinity, height: 105, onBreak: () => breaks++ });
    step(w, 200);
    check(!w.particles.some((p) => p.o.texture === tex.rockPlate && p.sprite.visible), 'stone: pebble anticipation');
    step(w, 150);
    check(w.particles.some((p) => p.o.texture === tex.rockPlate && p.sprite.visible && Math.abs(p.px) > 30), 'stone: plates fly inward');
    step(w, 400);
    const plates = w.particles.filter((p) => p.o.texture === tex.rockPlate);
    check(plates.length === 8 && plates.every((p) => p.o.blend === 'normal'), 'stone: eight solid attached plates');
    at = { x: 500, y: 350, z: 35 }; step(w, 32);
    check(plates.every((p) => p.sprite.x === at.x + p.px && p.sprite.y === at.y - at.z - p.pz), 'stone: follows moving airborne unit');
    const beforeHit = plates[0].sprite.x;
    armor.hit(); step(w, 16);
    check(plates[0].sprite.x !== beforeHit && armor.alive, 'stone: hit jolts plates without breaking');
    armor.break(); armor.break(); armor.hit();
    check(!armor.alive && breaks === 1, 'stone: break is idempotent');
    check(w.particles.some((p) => p.o.texture === tex.rockPlate && p.o.gravity > 0), 'stone: falling cracked rubble');
    clean(w, 'stone break');
    for (const duration of [0, 600, undefined, Infinity]) {
      w = world();
      const handle = kit.stoneArmor(w, tex, { target: () => at, duration });
      if (duration === Infinity) {
        step(w, 7000); check(handle.alive && w.count > 0, 'stone: Infinity sustains');
        handle.stop(); handle.stop(); handle.hit(); handle.break();
      } else step(w, 5000);
      clean(w, 'stone duration/stop'); check(!handle.alive, 'stone: duration/stop ends handle');
    }
    w = world();
    const earlyArmor = kit.stoneArmor(w, tex, { target: () => at, duration: Infinity, onBreak: () => breaks++ });
    earlyArmor.stop(); clean(w, 'stone early stop'); check(breaks === 1, 'stone: stop does not call onBreak');
    w = world();
    const badArmor = kit.stoneArmor(w, tex, { target: () => at, onBreak: () => { throw new Error('stone callback'); } });
    let stoneError;
    try { badArmor.break(); } catch (e) { stoneError = e.message; }
    check(stoneError === 'stone callback' && !badArmor.alive, 'stone: callback error leaves handle stopped');
    clean(w, 'stone callback error');
    results.push('stoneArmor: assembly, eight plates, movement/hit/break, Infinity/stop, finite/default/zero and errors PASS');
    return results;
  });
  results.forEach((line) => console.log(line));
} finally {
  await browser.close();
}
