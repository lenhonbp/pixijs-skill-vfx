import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { Container } from 'pixi.js'; export { SKILLS } from './examples/skills';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
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
    const gold = { core: 0xffffff, main: 0xffde99, dark: 0x71552d };
    w = world();
    const guardian = kit.spiritGuardian(w, tex, { x: 200, y: 300, palette: gold, height: 105 });
    step(w, 160);
    const figure = w.particles.find((p) => p.o.texture === tex.guardian && p.o.blend === 'normal');
    check(figure && figure.pz < 0 && figure.sprite.alpha > 0 && figure.sprite.alpha < 0.85, 'guardian: fades upward into view');
    step(w, 350);
    check(guardian.alive && figure.sprite.alpha === 0.85, 'guardian: normal-blended hold');
    const bob = figure.pz; step(w, 400);
    check(figure.pz !== bob && w.particles.some((p) => p.o.texture === tex.dot), 'guardian: bob and rising motes');
    step(w, 800);
    check(guardian.alive && figure.sprite.alpha < 0.85, 'guardian: dissolves after hold');
    clean(w, 'guardian default'); check(!guardian.alive, 'guardian: default ends');
    for (const duration of [0, 300, Infinity]) {
      w = world();
      const handle = kit.spiritGuardian(w, tex, { x: 0, y: 0, z: 35, palette: gold, duration });
      if (duration === Infinity) {
        step(w, 7000); check(handle.alive && w.count > 0, 'guardian: Infinity hold');
        handle.stop(); handle.stop();
      } else step(w, 2000);
      clean(w, 'guardian duration/stop'); check(!handle.alive, 'guardian: duration/stop cleanup');
    }
    for (const columnAlpha of [undefined, 0, 0.2]) {
      w = world(); kit.summonCircle(w, tex, { x: 0, y: 0, palette: gold, duration: 100, columnAlpha });
      step(w, 112);
      const column = w.particles.find((p) => p.o.texture === tex.glow && p.o.life === 600);
      check(column.o.alpha[0] === 0.9 * (columnAlpha ?? 1), 'summon: default/custom/zero column opacity');
      clean(w, 'summon column');
    }
    w = world(); let summoned = 0;
    kit.SKILLS.find((s) => s.id === 'summon-spirit').cast({ w, tex,
      caster: { feet: { x: 100, y: 200, z: 0 }, height: 70, facing: 1 },
      summon: (at, element, visualized) => {
        check(at.x === 220 && at.y === 240 && element === 'neutral' && visualized, 'summon: gameplay callback preserved'); summoned++;
      },
    });
    step(w, 2100);
    check(summoned === 1 && w.particles.some((p) => p.o.texture === tex.guardian), 'summon: callback and guardian both occur');
    clean(w, 'summon sample');
    results.push('spiritGuardian: materialize/hold/bob/dissolve, finite/zero/Infinity/stop, column options and summon callback PASS');
    const random = Math.random;
    Math.random = () => 0.5;
    try {
      w = world(); let impacts = 0;
      kit.swordRain(w, tex, { x: 100, y: 200, count: 3, duration: 600, height: 100,
        palette: gold, onImpact: () => impacts++ });
      step(w, 32);
      const falling = w.particles.filter((p) => p.o.texture === tex.blade);
      check(falling.length === 2 && falling.every((p) => p.o.blend === 'normal' && p.o.tint === gold.main), 'swords: double visual density, solid palette');
      check(falling.every((p) => p.o.scale * 160 >= 60 && p.o.scale * 160 <= 70), 'swords: height-scaled full blades');
      for (let i = 0; i < 7; i++) {
        step(w, 16);
        check(w.particles.filter((p) => p.o.texture === tex.streak && p.o.life === 150)
          .every((p) => p.o.scaleX * 128 < 30 && p.sprite.y < p.o.y), 'swords: short trails stay above ground');
      }
      check(impacts === 0, 'swords: no early damage');
      step(w, 16); check(impacts === 1, 'swords: original 150 ms first impact');
      step(w, 208); check(impacts === 2, 'swords: original staggered second impact');
      step(w, 208); check(impacts === 3, 'swords: original third impact');
      check(w.particles.some((p) => p.o.texture === tex.blade && p.o.life === 950 && p.sprite.alpha === 1), 'swords: planted hold');
      check(w.particles.some((p) => p.o.texture === tex.swordCrack), 'swords: ground cracks');
      step(w, 350); check(w.particles.some((p) => p.o.texture === tex.dot), 'swords: gold dissolve motes');
      clean(w, 'sword rain'); check(impacts === 3, 'swords: cosmetic swords never deal extra damage');
      w = world();
      kit.swordRain(w, tex, { x: 0, y: 0, count: 0, onImpact: () => { throw new Error('empty rain'); } });
      clean(w, 'empty sword rain');
      w = world(); kit.swordRain(w, tex, { x: 0, y: 0, count: 1, duration: 0 });
      clean(w, 'zero-duration sword rain');
      w = world(); kit.swordRain(w, tex, { x: 0, y: 0, count: 1, onImpact: () => { throw new Error('sword callback'); } });
      let swordError;
      try { step(w, 200); } catch (e) { swordError = e.message; }
      check(swordError === 'sword callback', 'swords: callback errors propagate');
      w.clear();
    } finally { Math.random = random; }
    results.push('swordRain: full blades, palette/height, dense visuals, unchanged impact timing/count, short trails, planted/dissolve, empty/zero/errors PASS');
    w = world(); let crashes = 0;
    const mountain = kit.mountainCrash(w, tex, { x: 100, y: 200, radius: 110, palette: gold, delay: 160,
      onHit: () => crashes++ });
    step(w, 144);
    check(!w.particles.some((p) => p.o.texture === tex.mountain && p.sprite.visible), 'mountain: respects formation delay');
    step(w, 160);
    const peak = w.particles.find((p) => p.o.texture === tex.mountain);
    check(peak && peak.o.blend === 'normal' && peak.pz > 0 && peak.sprite.alpha === 1, 'mountain: solid peak forms overhead');
    check(peak.o.scaleX * 320 > 220 && peak.o.scaleY * 256 === 160, 'mountain: wider than crater, giant height');
    step(w, 160); check(crashes === 0, 'mountain: no early hit');
    step(w, 16); check(crashes === 1 && peak.pz === 0, 'mountain: impact and callback synchronized');
    check(w.particles.some((p) => p.o.texture === tex.swordCrack) && w.particles.some((p) => p.o.texture === tex.rock && p.o.gravity > 0), 'mountain: crater and falling rubble');
    clean(w, 'mountain default'); check(!mountain.alive && crashes === 1, 'mountain: completes exactly once');
    w = world();
    const cancelledPeak = kit.mountainCrash(w, tex, { x: 0, y: 0, radius: 60, height: 100, palette: gold,
      delay: 200, onHit: () => crashes++ });
    cancelledPeak.stop(); cancelledPeak.stop(); clean(w, 'mountain early stop');
    check(crashes === 1 && !cancelledPeak.alive, 'mountain: stop cancels hit');
    w = world();
    const brokenPeak = kit.mountainCrash(w, tex, { x: 0, y: 0, radius: 60, palette: gold,
      onHit: () => { throw new Error('mountain callback'); } });
    let mountainError;
    try { step(w, 320); } catch (e) { mountainError = e.message; }
    check(mountainError === 'mountain callback', 'mountain: callback errors propagate');
    brokenPeak.stop(); clean(w, 'mountain callback error');
    w = world(); let damage = 0;
    const jumper = { feet: { x: 100, y: 200, z: 0 }, height: 70, facing: 1 };
    const victim = { feet: { x: 400, y: 200, z: 0 }, height: 70 };
    kit.SKILLS.find((s) => s.id === 'tho-mountain-leap').cast({ w, tex, caster: jumper,
      target: victim, targets: [victim], returnHome: () => {}, hurt: () => {
        check(jumper.feet.z === 0 && w.now === 640, 'mountain sample: damage on caster landing'); damage++;
      } });
    step(w, 624); check(damage === 0, 'mountain sample: no damage before landing');
    step(w, 16); check(damage === 1, 'mountain sample: impact damage once');
    step(w, 4000); clean(w, 'mountain sample');
    results.push('mountainCrash: delay/formation/drop, impact callback, crater/rubble, cleanup/stop/errors and 640 ms landing sync PASS');
    return results;
  });
  results.forEach((line) => console.log(line));
} finally {
  await browser.close();
}
