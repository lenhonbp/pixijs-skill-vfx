// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { lightningBolt } from './kit/lightning-bolt'; export { Container, Sprite } from 'pixi.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  console.log(await page.evaluate(() => {
    const { VfxWorld, Container, Sprite, createVfxTextures, empoweredWorld, empoweredAura, empoweredHit, PALETTES } = kit;
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const w = new VfxWorld(VfxWorld.createLayers(new Container())), tex = createVfxTextures();
    const step = ms => { for (let t = 0; t < ms; t += 16) w.update(Math.min(16, ms - t)); };
    const palette = PALETTES.fire ?? PALETTES.arcane;
    const one = empoweredWorld(w, { tier: 1, palette });
    const two = empoweredWorld(w, { tier: 2, palette });
    const three = empoweredWorld(w, { tier: 3, palette });
    check(one === w && w.density === 1, 'tier 1 identity and shared density unchanged');
    const options = { texture: tex.glow, x: 100, y: 100, life: 200, scale: 0.5, alpha: 0.5, tint: 0x804020 };
    const a = one.spawn(options), b = two.spawn(options), c = three.spawn(options);
    check(a.sprite.scale.x === 0.5 && Math.abs(b.sprite.scale.x - 0.6) < 1e-6 && Math.abs(c.sprite.scale.x - 0.725) < 1e-6, 'overlapping casts keep independent scales');
    check(c.sprite.alpha > b.sprite.alpha && b.sprite.alpha > a.sprite.alpha && c.sprite.tint !== a.sprite.tint, 'hotter/brighter particles');
    check(options.scale === 0.5 && options.alpha === 0.5, 'caller options untouched');
    let delayed, streamed;
    three.after(32, () => { delayed = three.burst(10, () => options); });
    three.stream({ rate: 100, duration: 60, make: () => { streamed = true; return options; } });
    step(64);
    check(delayed.length === 4 && streamed && delayed.every(p => Math.abs(p.sprite.scale.x - 0.725) < 1e-6), 'delayed bursts and streams retain styling and thin density');
    const root = new Sprite(tex.glow); root.position.set(350, 200);
    root.anchor.set(0.2, 0.8); root.rotation = 0.4;
    three.layers.body.addChild(root);
    const unown = three.own(() => root.destroy());
    three.addUpdater(() => { root.scale.set(1); root.position.set(350, 200); return true; });
    step(64); check(Math.abs(root.scale.x - 1.45) < 1e-6 && root.x === 350 && root.y === 200 && root.anchor.x === 0.2, 'raw sprite scales about its own anchor without moving');
    const start = { x: 450, y: 400, z: 270 }, end = { x: 700, y: 420, z: 45 };
    kit.lightningBolt(three, tex, start, end, palette, { life: 220 });
    const bolt = w.layers.body.children.at(-1);
    step(16);
    check(bolt.alpha === 1, 'anchored ribbon opacity is preserved');
    const column = new Container(); column.alpha = 0.4;
    three.layers.ground.addChild(column);
    step(16);
    check(column.alpha === 0.4, 'translucent column opacity is not amplified');
    column.destroy();
    for (const point of [start, end]) {
      const projected = bolt.toGlobal({ x: point.x, y: point.y - point.z });
      check(projected.x === point.x && projected.y === point.y - point.z, 'empowered bolt retains both screen-space endpoints');
    }
    kit.lightningChain(three, tex, { points: [start, end, { x: 800, y: 400, z: 45 }], palette });
    step(100);
    check(w.layers.body.children.filter(child => child instanceof Container && !(child instanceof Sprite))
      .every(child => child.scale.x === 1 && child.scale.y === 1 && child.x === 0 && child.y === 0), 'chain graphics retain endpoint coordinate system');
    let error;
    const bad = three.addUpdater(() => { throw new Error('scope error'); });
    try { step(16); } catch (e) { error = e.message; }
    check(error === 'scope error', 'scoped callback errors propagate'); bad.stop();
    w.clear(); unown(); check(root.destroyed && !w.count && !w.stats.updaters, 'clear disposes raw sprites, particles and scope callbacks');
    check(one.spawn(options).sprite.scale.x === 0.5, 'scope does not leak into later baseline casts'); w.clear();
    check(!empoweredAura(w, tex, { at: () => ({ x: 0, y: 0 }), height: 96, palette, tier: 3, duration: 0 }), 'empty aura');
    empoweredHit(w, tex, { at: { x: 0, y: 0 }, palette, tier: 1 }); check(!w.count, 'tier 1 hit unchanged');
    empoweredHit(w, tex, { at: { x: 200, y: 300, z: 50 }, palette, tier: 3, element: 'loi' });
    check(w.particles.every(p => p.o.layer === 'ground'), 'lightning empowerment stays behind the struck target');
    w.clear();
    for (const tier of [2, 3]) {
      const at = { x: 100, y: 200, z: 50 };
      const aura = empoweredAura(w, tex, { at: () => at, height: 96, palette, tier, duration: Infinity, idle: true });
      step(2000); check(aura.alive && w.count <= 6, 'cheap persistent idle aura');
      check(w.particles.filter(p => p.o.layer === 'ground').every(p => p.z === 0), 'idle aura stays grounded');
      aura.stop(); step(200); check(!w.count && !w.stats.updaters, 'idle aura stops cleanly');
      empoweredAura(w, tex, { at: () => at, height: 96, palette, tier, duration: 400 });
      step(700); check(!w.count && !w.stats.updaters, 'finite cast aura cleanup');
    }
    return 'Empowerment: tier identity/scale/heat, overlapping and delayed scopes, burst/stream density, raw sprites, errors/clear and idle/finite aura cleanup PASS';
  }));
} finally { await browser.close(); }
