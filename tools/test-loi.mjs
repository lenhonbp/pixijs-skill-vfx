// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({
  stdin: { contents: "export * from './kit'; export { Container } from 'pixi.js';", resolveDir: root },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const { WUXING, LOI, ELEMENTS, defineElement, getElement, paletteFrom, shiftPalette,
      VfxWorld, Container, createVfxTextures, lightningStrike, lightningChain, staticField, shock, chargeUp } = kit;
    const check = (value, message) => { if (!value) throw new Error(message); };
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check(Object.keys(WUXING).length === 5 && Object.keys(ELEMENTS).length === 7, 'built-in element counts');
    check(getElement('loi') === LOI && getElement('thuy') === WUXING.thuy, 'built-in registry');
    check(getElement('') === undefined && getElement('unknown') === undefined, 'unknown registry lookup');
    const custom = { ...LOI, name: 'custom-storm', palette: paletteFrom(0xff0088) };
    check(defineElement(custom) === custom && getElement(custom.name) === custom, 'custom registration');
    const replacement = { ...custom, en: 'Replacement' };
    defineElement(replacement);
    check(getElement(custom.name) === replacement && Object.keys(WUXING).length === 5, 'registry replacement isolation');
    const p = paletteFrom(0xff0000), snapshot = JSON.stringify(p);
    check(equal(shiftPalette(p, {}), p) && equal(shiftPalette(p, { hue: 360 }), p), 'identity and full hue turn');
    check(shiftPalette(p, { hue: 120 }).main === 0x00ff00, 'HSL hue rotation');
    check(shiftPalette(p, { hue: -120 }).main === 0x0000ff, 'negative hue wrap');
    check(shiftPalette(p, { sat: 0 }).main === 0x808080, 'desaturation');
    check(shiftPalette(p, { light: 2 }).main === 0xffffff && shiftPalette(p, { light: -2 }).main === 0, 'lightness clamp');
    check(shiftPalette(paletteFrom(0xffffff), { sat: 5 }).main === 0xffffff, 'white achromatic edge');
    check(shiftPalette(paletteFrom(0), { hue: 20 }).main === 0, 'black achromatic edge');
    check(equal(paletteFrom(0x123456, { core: 0, dark: 0xffffff }), { core: 0, main: 0x123456, dark: 0xffffff }), 'explicit overrides');
    check(JSON.stringify(p) === snapshot, 'palette immutability');

    const tex = createVfxTextures();
    const world = () => new VfxWorld(VfxWorld.createLayers(new Container()));
    const step = (w, time) => { for (let i = 0; i < time; i += 16) w.update(Math.min(16, time - i)); };
    const clean = (w) => {
      step(w, 3000);
      check(w.count === 0 && w.updaters.length === 0, 'particles and updaters clean up');
    };
    for (const release of [undefined, { color: 0x7954ef, size: 0.65, coreSize: 0.2, alpha: 0.4 }]) {
      const w = world(); let releases = 0;
      chargeUp(w, tex, { target: () => ({ x: 20, y: 30, z: 40 }), palette: LOI.palette,
        duration: 100, release, onDone: () => releases++ });
      step(w, 112);
      const glow = w.particles.find((p) => p.o.texture === tex.glow && p.o.life === 160);
      const core = w.particles.find((p) => p.o.texture === tex.star && p.o.life === 200);
      check(releases === 1 && glow && core, 'charge releases once');
      check(glow.o.tint === (release?.color ?? LOI.palette.main), 'charge release color');
      check(glow.o.alpha[0] === (release?.alpha ?? 0.4), 'charge release alpha');
      check(glow.o.scale[0] === 1.2 * (release?.size ?? 0.65), 'charge release glow size');
      check(core.o.scale[0] === 1.3 * (release?.coreSize ?? 0.2) && core.o.tint === LOI.palette.core, 'independent white core size');
      clean(w);
    }
    let w = world(), hits = 0;
    lightningStrike(w, tex, { x: 0, y: 0, palette: LOI.palette, delay: 100, onHit: () => hits++ });
    step(w, 96);
    check(hits === 0 && w.count === 0, 'strike respects delay');
    step(w, 16);
    check(hits === 1 && w.count > 0, 'strike hits exactly once');
    clean(w); check(hits === 1, 'flickers do not repeat damage');
    w = world();
    lightningStrike(w, tex, { x: 0, y: 0, palette: LOI.palette });
    check(w.count > 0, 'immediate strike defaults'); clean(w);
    w = world();
    lightningChain(w, tex, { points: [], palette: LOI.palette }); clean(w);
    lightningChain(w, tex, { points: [{ x: 0, y: 0 }], palette: LOI.palette }); clean(w);

    for (const kind of ['field', 'shock']) {
      const make = (w, onTick, duration = 1200) => kind === 'field'
        ? staticField(w, tex, { x: 0, y: 0, radius: 70, duration, palette: LOI.palette, onTick })
        : shock(w, tex, { target: () => ({ x: 200, y: 200 }), duration, onTick });
      w = world(); let ticks = 0;
      let handle = make(w, () => ticks++);
      step(w, 700);
      check(handle.alive && ticks === 1 && w.count > 0, `${kind} ticks and emits`);
      handle.stop(); handle.stop();
      check(!handle.alive, `${kind} stop is idempotent`);
      clean(w); check(ticks === 1, `${kind} stop cancels ticks`);
      w = world(); ticks = 0;
      handle = make(w, () => ticks++);
      step(w, 1500);
      check(!handle.alive && ticks === 2, `${kind} duration ends ticks`); clean(w);
      w = world(); ticks = 0;
      handle = make(w, () => ticks++, 0); clean(w);
      check(!handle.alive && ticks === 0, `${kind} zero duration`);
      w = world();
      handle = make(w, () => { throw new Error('gameplay callback'); });
      let error;
      try { step(w, 600); } catch (e) { error = e.message; }
      check(error === 'gameplay callback', `${kind} preserves callback errors`);
      handle.stop(); clean(w);
    }
    return ['Element registry and palette edge cases: PASS', 'Charge release defaults/options, lightning timing, empty chains, handles, cleanup and callback errors: PASS'];
  });
  assert.equal(results.length, 2);
  results.forEach((result) => console.log(result));
} finally {
  await browser.close();
}
