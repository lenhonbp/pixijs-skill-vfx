import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { Container, Sprite } from 'pixi.js'; export { SKILLS } from './examples/skills';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const { Container, Sprite, VfxWorld, createVfxTextures, SKILLS, hitTimes } = kit;
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const tex = createVfxTextures(), results = [];
    const world = () => new VfxWorld({ ...VfxWorld.createLayers(new Container()), seed: 42 });
    const step = (w, ms) => { for (let i = 0; i < ms; i++) w.update(1); };
    const clean = (w) => check(!w.count && !w.stats.updaters, 'particles and updaters cleaned');
    {
      const w = world(), target = () => ({ x: 100, y: 200 });
      const seal = kit.silence(w, tex, { target, height: 96, duration: 2400 });
      step(w, 1000);
      const glyphs = w.particles.filter((p) => p.o.texture === tex.sealGlyph && p.o.z > 96);
      check(glyphs.length === 2 && glyphs.every((p) => Math.abs(p.sprite.scale.x) * 116 >= 96 * 0.57 && p.sprite.alpha > 0.25),
        'silence: large bright sustained glyph and underglow');
      check(w.particles.filter((p) => p.o.texture === tex.chainLink).length === 24, 'silence: three eight-link bands');
      check(w.particles.filter((p) => p.o.texture === tex.sealGlyph && p.o.groundAligned).length === 4,
        'silence: split core and glow floor seals');
      seal.stop(); step(w, 3000); clean(w);
      results.push('silence: bold glyph, underglow, 24 thick links, split ground seal and cleanup PASS');
    }
    for (const id of ['seal-silence', 'sunder-mark', 'war-cry', 'shadow-blink', 'curse-weaken', 'summon-spirit']) {
      const skill = SKILLS.find((s) => s.id === id);
      for (const offset of [0, -200]) {
        const w = world(), contacts = [], hurts = [];
        const unit = (x, y, facing = -1) => ({ sprite: new Sprite(tex.dot), feet: { x, y, z: 0 }, height: 96, facing });
        const caster = unit(330, 410, 1), targets = [unit(790 + offset, 405), unit(900 + offset, 330), unit(905 + offset, 490)];
        const target = targets[0], start = { ...caster.feet };
        const spawn = w.spawn.bind(w), shake = w.shake.bind(w);
        w.spawn = (o) => {
          if (id === 'seal-silence' && o.texture === tex.rune && o.vz === -100 ||
            id === 'sunder-mark' && o.texture === tex.swordCrack && o.life === 240 ||
            id === 'curse-weaken' && o.texture === tex.ring && o.vz === -96 * 1.8) contacts.push(w.now);
          return spawn(o);
        };
        w.shake = (amount, ms) => { if (id === 'war-cry' && amount === 3) contacts.push(w.now); shake(amount, ms); };
        skill.cast({ w, tex, caster, target, targets, hurt: () => hurts.push(w.now),
          returnHome: () => Object.assign(caster.feet, start), setVisible: (u, visible) => { u.sprite.visible = visible; }, summon: () => {} });
        step(w, skill.length + 2000);
        const distance = Math.hypot(target.feet.x - start.x - caster.height * 0.3, target.feet.y - start.y - 1);
        const expected = hitTimes(skill.timing, distance);
        const actual = [...new Set(skill.timing.hits[0]?.effectOnly ? contacts : hurts)];
        check(actual.length === expected.length && actual.every((t, i) => Math.abs(t - expected[i]) <= 17),
          `${id}: visual contacts ${actual} match metadata ${expected}`);
        clean(w); w.clear(); caster.sprite.destroy(); targets.forEach((u) => u.sprite.destroy());
      }
      results.push(`${id}: demo/close-range visual contacts match SkillTiming; zero cleanup PASS`);
    }
    for (const name of ['sunderingMark', 'frailty']) {
      const impact = name === 'sunderingMark' ? 260 : 240;
      let w = world(), calls = [], stopped = 0;
      const options = { target: () => ({ x: 100, y: 200 }), height: 96, duration: 800,
        onImpact: () => { calls.push(w.now); return { alive: true, stop: () => stopped++ }; } };
      const handle = kit[name](w, tex, options);
      step(w, impact - 1); check(!calls.length, `${name}: waits for impact`);
      step(w, 1); check(calls.length === 1 && calls[0] === impact, `${name}: impact callback once`);
      handle.stop(); handle.stop();
      if (name === 'frailty') check(stopped === 1, 'frailty: owns returned reaction handle');
      step(w, 2500); clean(w);
      w = world(); calls = [];
      kit[name](w, tex, options).stop(); step(w, 3000);
      check(!calls.length, `${name}: cancelled callback does not fire`); clean(w);
      w = world();
      kit[name](w, tex, { ...options, onImpact: () => { throw new Error('impact failure'); } });
      let error; try { step(w, impact); } catch (e) { error = e.message; }
      check(error === 'impact failure', `${name}: callback errors propagate`); w.clear(); clean(w);
      results.push(`${name}: callback time/once, owned cleanup, cancellation and errors PASS`);
    }
    for (const id of ['sunder-mark', 'curse-weaken']) {
      const w = world(), u = { sprite: new Sprite(tex.dot), feet: { x: 100, y: 200 }, height: 96, facing: 1 };
      SKILLS.find((s) => s.id === id).cast({ w, tex, caster: u, target: u, targets: [],
        hurt: () => { throw new Error('empty targets must not hurt'); }, returnHome() {}, setVisible() {} });
      step(w, 6000); clean(w); u.sprite.destroy();
      results.push(`${id}: empty targets PASS`);
    }
    const w = world();
    let error; try { kit.hexField(w, tex, { x: 0, y: 0, radius: -1, palette: kit.WUXING.moc.palette }); } catch (e) { error = e; }
    check(error instanceof RangeError, 'hexField: invalid radius throws'); w.clear(); clean(w);
    results.push('hexField: invalid radius and clear PASS');
    return results;
  });
  results.forEach((line) => console.log(line));
} finally {
  await browser.close();
}
