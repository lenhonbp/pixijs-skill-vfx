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
    const { SKILLS, Container, Sprite, VfxWorld, createVfxTextures, hitTimes, onHits } = kit;
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const tex = createVfxTextures(), results = [];
    const world = () => new VfxWorld(VfxWorld.createLayers(new Container()));
    const step = (w, ms) => { for (let i = 0; i < ms; i++) w.update(1); };
    const timing = { windup: 20, hits: [{ t: 20, travel: 1000 }, { t: 200, stop: 25, shake: 3 }], recovery: 30 };
    const before = JSON.stringify(timing);
    check(equal(hitTimes(timing), [20, 200]), 'hitTimes: omitted distance');
    check(equal(hitTimes(timing, 100), [120, 200]), 'hitTimes: travel and instant hits');
    check(equal(hitTimes(timing, 0), [20, 200]), 'hitTimes: zero distance');
    check(equal(hitTimes({ windup: 0, hits: [], recovery: 0 }, 100), []), 'hitTimes: empty hits');
    check(JSON.stringify(timing) === before, 'hitTimes: pure, does not mutate input');
    for (const distance of [-1, Infinity, NaN]) {
      let error; try { hitTimes(timing, distance); } catch (e) { error = e; }
      check(error instanceof RangeError, 'hitTimes: invalid distance');
    }
    for (const travel of [0, -1, Infinity, NaN]) {
      let error; try { hitTimes({ ...timing, hits: [{ t: 20, travel }] }, 100); } catch (e) { error = e; }
      check(error instanceof RangeError, 'hitTimes: invalid speed');
    }
    let w = world(), calls = [], stops = [], shakes = [];
    w.hitStop = (ms) => stops.push(ms);
    w.shake = (amplitude, ms) => shakes.push([amplitude, ms]);
    const scheduled = onHits(w, timing, (hit, i) => calls.push([w.now, i, hit]), 100);
    step(w, 119); check(!calls.length && scheduled.alive, 'onHits: waits for resolved time');
    step(w, 81);
    check(equal(calls.map(([t, i]) => [t, i]), [[120, 0], [200, 1]]), 'onHits: hit times and indices');
    check(equal(stops, [25]) && equal(shakes, [[3, 160]]) && !scheduled.alive, 'onHits: feedback and completion');
    const cancelled = onHits(w, timing, () => { throw new Error('cancelled hit fired'); });
    cancelled.stop(); cancelled.stop(); step(w, 500);
    check(!cancelled.alive && !onHits(w, { windup: 0, hits: [], recovery: 0 }, () => {}).alive, 'onHits: idempotent stop and empty handle');
    const bad = onHits(w, { windup: 0, hits: [{ t: 1 }], recovery: 0 }, () => { throw new Error('hit callback'); });
    let error; try { step(w, 1); } catch (e) { error = e.message; }
    check(error === 'hit callback', 'onHits: callback errors propagate'); bad.stop(); w.clear();
    results.push('hitTimes/onHits: travel, defaults/zero/empty, purity, feedback, cancellation and errors PASS');

    check(SKILLS.length === 28, 'all 28 samples present');
    const skins = ['char', 'ice', 'shock', 'holy', 'shadow', 'poison', 'earth', 'metal', 'wind', 'nature', 'red'];
    for (const offset of [0, -200]) {
      for (const skill of SKILLS) {
        w = world();
        const unit = (x, y, facing = -1) => ({ sprite: new Sprite(tex.dot), feet: { x, y, z: 0 }, height: 96, facing });
        const caster = unit(330, 410, 1), targets = [unit(790 + offset, 405), unit(900 + offset, 330), unit(905 + offset, 490)];
        const target = targets[0], start = { ...caster.feet }, hurts = [], feedback = [];
        const t = skill.timing;
        check(t && Number.isFinite(t.windup) && t.windup >= 0 && Number.isFinite(t.recovery) && t.recovery >= 0, `${skill.id}: timing phases`);
        const distances = t.hits.map((hit, i) => {
          const u = skill.id === 'phong-gale-blade' ? targets[i] : target;
          return Math.hypot(u.feet.x - caster.feet.x - caster.facing * caster.height * 0.3,
            (u.feet.y - caster.feet.y - 1) / (skill.id === 'phong-gale-blade' ? w.groundSquash : 1));
        });
        const times = t.hits.map((_, i) => hitTimes(t, distances[i])[i]);
        t.hits.forEach((hit, i) => {
          check(Number.isFinite(hit.t) && hit.t >= t.windup && (i === 0 || hit.t >= t.hits[i - 1].t), `${skill.id}: sorted hits after windup`);
          check(i === 0 || times[i] >= times[i - 1], `${skill.id}: resolved hits sorted`);
          for (const key of ['stop', 'shake', 'push', 'spread']) check(hit[key] === undefined || Number.isFinite(hit[key]) && hit[key] >= 0, `${skill.id}: valid ${key}`);
          check(!hit.skin || skins.includes(hit.skin), `${skill.id}: skin`);
          check(!hit.targets || ['primary', 'all'].includes(hit.targets), `${skill.id}: targets`);
        });
        check((times.at(-1) ?? t.windup) + t.recovery <= skill.length, `${skill.id}: last resolved hit + recovery fits length`);
        const hitStop = w.hitStop.bind(w), shake = w.shake.bind(w);
        w.hitStop = (ms) => { feedback.push({ t: w.now, stop: ms }); hitStop(ms); };
        w.shake = (amplitude, ms) => { feedback.push({ t: w.now, shake: amplitude }); shake(amplitude, ms); };
        skill.cast({ w, tex, caster, target, targets,
          hurt: (u, amount) => hurts.push({ t: w.now, u, amount }),
          returnHome: () => Object.assign(caster.feet, start),
          setVisible: (u, visible) => { u.sprite.visible = visible; }, summon: () => {},
        });
        // Small simulation steps isolate nominal timers from accumulated frame rounding.
        step(w, skill.length + 2000);
        const matches = (actual, i) => Math.abs(actual - times[i]) <= (t.hits[i].spread ?? 0) + 17;
        for (const hurt of hurts) check(times.some((_, i) => matches(hurt.t, i)), `${skill.id}: undeclared hurt at ${hurt.t}; expected ${times}`);
        const missed = [];
        t.hits.forEach((hit, i) => {
          const landed = hurts.some((hurt) => matches(hurt.t, i));
          check(hit.optional || landed, `${skill.id}: missing required hit ${i} at ${times[i]}; actual ${hurts.map((h) => h.t)}`);
          if (!landed) missed.push(i);
          for (const key of ['stop', 'shake']) if (hit[key] !== undefined) {
            check(feedback.some((f) => matches(f.t, i) && Math.abs(f[key] - hit[key]) < 1e-8), `${skill.id}: ${key} at ${times[i]} matches cast`);
          }
        });
        if (!offset) results.push(`${skill.id}: ${hurts.length} hurt calls, ${t.hits.length} hit opportunities; timing/feedback PASS${missed.length ? ` (optional misses: ${missed.join(',')})` : ''}`);
        w.clear(); caster.sprite.destroy(); targets.forEach((u) => u.sprite.destroy());
      }
    }
    results.push('All 28 casts: demo + close-range scenes, no undeclared hurts, required hits, windup/order/length PASS');
    return results;
  });
  results.forEach((line) => console.log(line));
} finally {
  await browser.close();
}
