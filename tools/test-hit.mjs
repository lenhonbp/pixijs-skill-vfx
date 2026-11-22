// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { Container, Sprite, Texture, ColorMatrixFilter } from 'pixi.js'; export { SKILLS } from './examples/skills';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const { Container, Sprite, Texture, ColorMatrixFilter, VfxWorld, hitSkin, rockBack, defineElement, getElement, ELEMENTS, SKILLS } = kit;
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const close = (a, b) => Math.abs(a - b) < 1e-8;
    const world = () => new VfxWorld(VfxWorld.createLayers(new Container()));
    const step = (w, ms) => { for (let t = 0; t < ms; t += 10) w.update(Math.min(10, ms - t)); };
    const clean = (w, label) => check(!w.updaters.length && !w.disposers.size && !w.count, `${label}: no remaining registrations`);
    const results = [], original = 0xa5c7e9;
    let w = world();
    const sprite = new Sprite(Texture.WHITE); sprite.tint = original;
    const tinted = (s) => !!s.filters?.length;
    for (const skin of ['char', 'ice', 'shock', 'holy', 'shadow', 'poison', 'earth', 'metal', 'wind', 'nature', 'red']) {
      const h = hitSkin(w, sprite, skin);
      check(h.alive && tinted(sprite) && sprite.filters[0].matrix[0] < 1, `${skin}: visible color blend immediately`);
      step(w, 100); check(h.alive && tinted(sprite), `${skin}: sustained eased reaction`);
      step(w, 200); check(!h.alive && sprite.tint === original && !tinted(sprite), `${skin}: exact original restored`);
      clean(w, skin);
    }
    let first = hitSkin(w, sprite, 'char'); step(w, 60);
    const second = hitSkin(w, sprite, 'ice'); const latest = sprite.filters[0];
    check(!first.alive && second.alive, 'skin: latest replaces old handle');
    first.stop(); check(sprite.filters[0] === latest, 'skin: old stop does not cancel replacement');
    step(w, 300); check(sprite.tint === original, 'skin: overlap restores true original'); clean(w, 'skin overlap');
    const other = world();
    hitSkin(w, sprite, 'poison'); hitSkin(other, sprite, 'metal'); w.clear();
    check(tinted(sprite), 'skin: old world clear preserves newer world reaction');
    other.clear(); check(sprite.tint === original, 'skin: clear restores original'); clean(other, 'skin world clear');
    for (let i = 0; i < 100; i++) { hitSkin(w, sprite, i % 2 ? 'red' : 'shadow'); step(w, 10); }
    step(w, 300); check(sprite.tint === original, 'skin: repeated hits do not drift'); clean(w, 'skin repeated');
    for (const options of [{ duration: 0 }, { strength: 0 }]) {
      hitSkin(w, sprite, 'red');
      const empty = hitSkin(w, sprite, 'ice', options);
      step(w, 1); check(!empty.alive && sprite.tint === original, 'skin: zero replaces cleanly'); clean(w, 'skin zero');
    }
    first = hitSkin(w, sprite, 'holy', { duration: 700, strength: 0.5 }); step(w, 350);
    check(first.alive && tinted(sprite), 'skin: custom duration/strength');
    first.stop(); first.stop(); step(w, 1); check(sprite.tint === original, 'skin: idempotent stop'); clean(w, 'skin stop');
    const prior = new ColorMatrixFilter(), added = new ColorMatrixFilter();
    sprite.filters = [prior];
    const filtered = hitSkin(w, sprite, 'ice');
    check(sprite.filters.length === 2 && sprite.filters[0] === prior, 'skin: existing filters retained');
    sprite.filters = [...sprite.filters, added]; filtered.stop(); step(w, 1);
    check(sprite.filters.length === 2 && sprite.filters[0] === prior && sprite.filters[1] === added, 'skin: cleanup preserves concurrent filters');
    clean(w, 'skin filter ownership'); sprite.filters = null; prior.destroy(); added.destroy();
    results.push('hitSkin: all 11 skins, sustained fade, exact tint, overlapping/repeated/cross-world replacement, filter ownership, zero/custom/stop/clear PASS');
    const holy = hitSkin(w, sprite, 'holy');
    const matrix = sprite.filters[0].matrix;
    check(matrix[0] >= 0.65 && matrix[6] >= 0.65 && matrix[12] >= 0.65 &&
      matrix[1] === 0 && matrix[2] === 0 && matrix[4] <= 0.45 && matrix[14] < matrix[4],
      'holy: preserves texture contrast without desaturation, modest warm gold overlay');
    step(w, 110); check(!holy.alive && !tinted(sprite), 'holy: default ends at 110 ms'); clean(w, 'holy detail');
    results.push('holy: retained texture contrast, modest gold blend and 110 ms restoration PASS');

    sprite.position.set(40, 80); sprite.pivot.set(3, 7); sprite.scale.set(-2, 1.5); sprite.rotation = 0.4;
    const pivot = { x: sprite.pivot.x, y: sprite.pivot.y };
    const offset = () => {
      const x = (sprite.pivot.x - pivot.x) * sprite.scale.x, y = (sprite.pivot.y - pivot.y) * sprite.scale.y;
      return { x: -(x * Math.cos(sprite.rotation) - y * Math.sin(sprite.rotation)),
        y: -(x * Math.sin(sprite.rotation) + y * Math.cos(sprite.rotation)) };
    };
    const impulse = rockBack(w, sprite, { push: 20, angle: 0, duration: 400 });
    step(w, 60); const outward = offset();
    check(outward.x > 18 && close(outward.y, 0), 'rockBack: full impulse in parent space with mirrored/rotated sprite');
    check(sprite.x === 40 && sprite.y === 80, 'rockBack: does not overwrite position');
    step(w, 200); check(offset().x < 0, 'rockBack: small spring overshoot');
    step(w, 140);
    check(!impulse.alive && sprite.pivot.x === pivot.x && sprite.pivot.y === pivot.y && sprite.x === 40 && sprite.y === 80, 'rockBack: exact rest position and pivot');
    clean(w, 'rockBack natural');
    for (let i = 0; i < 80; i++) {
      sprite.position.set(40 + i * 2, 80 - i);
      sprite.scale.x = i % 2 ? 2 : -2;
      rockBack(w, sprite, { push: 12, angle: i * 0.2 });
      hitSkin(w, sprite, 'shock'); step(w, 20);
      check(sprite.x === 40 + i * 2 && sprite.y === 80 - i, 'rockBack: movement owns position on every frame');
    }
    step(w, 400);
    check(sprite.pivot.x === pivot.x && sprite.pivot.y === pivot.y && sprite.x === 198 && sprite.y === 1 && sprite.tint === original, 'rockBack + skin: no drift after repeated moving hits');
    clean(w, 'combined repeated movement');
    first = rockBack(w, sprite, { push: 15, angle: 1 }); step(w, 50);
    const replacement = rockBack(w, sprite, { push: 8, angle: 0 }); first.stop(); step(w, 50);
    check(!first.alive && replacement.alive && offset().x > 0, 'rockBack: superseded stop does not cancel replacement');
    replacement.stop(); replacement.stop(); step(w, 1);
    check(sprite.pivot.x === pivot.x && sprite.pivot.y === pivot.y, 'rockBack: stop restores base pivot'); clean(w, 'rockBack stop');
    for (const options of [{ push: 0, angle: 0 }, { push: 12, angle: 0, duration: 0 }]) {
      rockBack(w, sprite, { push: 12, angle: 0 }); step(w, 40);
      const empty = rockBack(w, sprite, options); step(w, 1);
      check(!empty.alive && sprite.pivot.x === pivot.x && sprite.pivot.y === pivot.y, 'rockBack: zero replaces cleanly'); clean(w, 'rockBack zero');
    }
    rockBack(w, sprite, { push: 30, angle: 0 }); hitSkin(w, sprite, 'earth'); step(w, 70); w.clear();
    check(sprite.tint === original && sprite.pivot.x === pivot.x && sprite.pivot.y === pivot.y, 'combined: clear restores exact bases'); clean(w, 'combined clear');
    results.push('rockBack: spring/overshoot, mirrored transforms, exact pivot, movement + repeated hits, replacement, zero/stop/clear PASS');

    for (const run of [() => hitSkin(w, sprite, 'red', { duration: Infinity }), () => hitSkin(w, sprite, 'red', { strength: NaN }),
      () => rockBack(w, sprite, { push: -1, angle: 0 }), () => rockBack(w, sprite, { push: 1, angle: NaN })]) {
      let error; try { run(); } catch (e) { error = e; }
      check(error instanceof RangeError, 'invalid options reject without registering');
    }
    clean(w, 'invalid options');
    const doomed = new Sprite(Texture.WHITE);
    const skin = hitSkin(w, doomed, 'red'), recoil = rockBack(w, doomed, { push: 10, angle: 0 });
    doomed.destroy(); step(w, 10);
    check(!skin.alive && !recoil.alive, 'destroyed sprite stops reactions'); clean(w, 'destroyed sprite');
    check(!hitSkin(w, doomed, 'red').alive && !rockBack(w, doomed, { push: 1, angle: 0 }).alive, 'already destroyed sprite is a no-op');
    const defaults = { hoa: 'char', thuy: 'ice', loi: 'shock', kim: 'metal', moc: 'nature', tho: 'earth', phong: 'wind' };
    for (const [id, skin] of Object.entries(defaults)) check(getElement(id).hitSkin === skin, `${id}: default skin`);
    defineElement({ ...ELEMENTS.hoa, name: 'test-hit-custom', hitSkin: undefined });
    check((getElement('test-hit-custom').hitSkin ?? 'red') === 'red', 'custom element: red fallback');
    defineElement({ ...ELEMENTS.hoa, name: 'test-hit-custom', hitSkin: 'shadow' });
    check(getElement('test-hit-custom').hitSkin === 'shadow', 'custom element: explicit skin');
    check(SKILLS.find((s) => s.id === 'tho-mountain-leap').timing.hits[0].push >= 24, 'mountain: heavy push data');
    for (const id of ['thuy-tidal-beam', 'hoa-dragon-breath', 'loi-thunder-domain']) {
      check(SKILLS.find((s) => s.id === id).timing.hits.every((hit) => hit.push === 0), `${id}: periodic hits do not push`);
    }
    sprite.destroy();
    results.push('Reactions: destroyed sprites/errors, zero registrations, all element defaults and custom override/fallback, heavy/periodic hit data PASS');
    return results;
  });
  results.forEach((line) => console.log(line));
} finally {
  await browser.close();
}
