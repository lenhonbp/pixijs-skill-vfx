import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { Application, Container, Sprite, Texture, RenderTexture } from 'pixi.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(async () => {
    const { Application, Container, Sprite, Texture, RenderTexture, VfxWorld, createVfxTextures,
      floorRing, group, isPixiV8, renderToTexture, WUXING } = kit;
    const check = (ok, label) => { if (!ok) throw new Error(label); };
    const close = (a, b) => Math.abs(a - b) < 1e-6;
    const tex = createVfxTextures(), palette = { core: 0xffffff, main: 0xffffff, dark: 0 };
    const root = new Container();
    const world = () => new VfxWorld({ ...VfxWorld.createLayers(root), groundSquash: 0.5 });
    const step = (w, ms) => { for (let t = 0; t < ms; t += 10) w.update(Math.min(10, ms - t)); };
    const clean = (w, label) => check(w.count === 0 && !w.disposers.size && !w.updaters.length &&
      Object.values(w.layers).every((l) => !l.children.length), `${label}: particles, masks, ownership and updaters released`);
    const results = [];
    let w = world(), at = { x: 100, y: 110, z: 60 };
    const ring = floorRing(w, tex, { around: () => at, radius: 30, palette, duration: 200,
      scaleX: 1.2, rotation: 0.6, spin: 1 });
    check(ring.alive && w.count === 2 && ring.far.sprite.parent === w.layers.ground && ring.near.sprite.parent === w.layers.body, 'halves exist in ground/body layers');
    const center = new Sprite(Texture.WHITE), front = new Sprite(Texture.WHITE);
    center.zIndex = at.y; front.zIndex = at.y + 1; w.layers.body.addChild(center, front);
    w.layers.body.sortChildren();
    check(center.zIndex < ring.near.sprite.zIndex && ring.near.sprite.zIndex < front.zIndex &&
      w.layers.body.getChildIndex(center) < w.layers.body.getChildIndex(ring.near.sprite) &&
      w.layers.body.getChildIndex(ring.near.sprite) < w.layers.body.getChildIndex(front), 'near half sorts after center but before foreground unit');
    check(ring.near.o.groundAligned && ring.far.o.groundAligned && close(ring.near.sprite.y, at.y), 'ground alignment ignores airborne target height');
    at = { x: 180, y: 210, z: 90 }; step(w, 40);
    for (const p of [ring.far, ring.near]) check(close(p.sprite.x, 180) && close(p.sprite.y, 210) &&
      close(p.sprite.mask.x, 180) && close(p.sprite.mask.y, 210), 'both halves and masks follow moving target');
    check(close(ring.near.sprite.zIndex, 210.1), 'near sorting follows ground y');
    center.destroy(); front.destroy(); step(w, 180); check(!ring.alive, 'finite duration ends'); clean(w, 'finite');
    for (const options of [{ duration: 0 }, { radius: 0 }]) {
      const empty = floorRing(w, tex, { x: 0, y: 0, radius: 30, palette, ...options });
      check(!empty.alive && !empty.far && !empty.near, 'empty ring is inert'); clean(w, 'empty');
    }
    w.maxParticles = 1;
    check(!floorRing(w, tex, { radius: 30, palette }).alive, 'particle budget never creates a single half'); clean(w, 'budget'); w.maxParticles = 1500;
    for (const options of [{ radius: NaN }, { duration: NaN }, { textureRadius: 0 }]) {
      let caught; try { floorRing(w, tex, { radius: 30, palette, ...options }); } catch (e) { caught = e; }
      check(caught instanceof RangeError, 'invalid options reject'); clean(w, 'invalid');
    }
    const defaults = floorRing(w, tex, { x: 10, y: 20, radius: 20, palette }); step(w, 400);
    check(!defaults.alive, 'default duration ends'); clean(w, 'default');
    const forever = floorRing(w, tex, { around: () => at, radius: 30, palette, duration: Infinity });
    step(w, 1000); check(forever.alive, 'Infinity persists'); forever.stop(); forever.stop(); step(w, 1); clean(w, 'stop');
    floorRing(w, tex, { radius: 30, palette, duration: Infinity, delay: 500 }); w.clear(); clean(w, 'clear delayed');
    const g = group(w, Infinity);
    const fading = floorRing(w, tex, { around: () => at, radius: 30, palette, duration: Infinity });
    g.add(fading.far); g.add(fading.near); g.stop();
    at.y += 30; step(w, 30);
    check(close(fading.near.sprite.mask.y, at.y), 'mask follows during group fade after onUpdate replacement');
    step(w, 200); clean(w, 'group fade');
    results.push('floorRing: layers/depth, ground squash, moving/airborne targets, finite/default/zero/Infinity, budget/errors, stop/clear/group fade and mask cleanup PASS');

    const pooledWorld = world(), maskSet = new Set(), spriteSet = new Set();
    for (let i = 0; i < 64; i++) {
      const emission = floorRing(pooledWorld, tex, { radius: 30, palette, duration: 20 });
      for (const p of [emission.far, emission.near]) {
        maskSet.add(p.sprite.mask); spriteSet.add(p.sprite);
      }
      if (i % 3 === 0) pooledWorld.clear();
      else step(pooledWorld, 30);
      clean(pooledWorld, 'repeated emission');
      check(maskSet.size === 2 && [...spriteSet].every((s) => !s.mask), 'repeated emissions reuse two pooled masks and reset sprite masks');
      check([...maskSet].every((m) => !m.parent && !m.destroyed), 'idle pooled masks are detached, not recreated');
    }
    for (const sprite of spriteSet) sprite.destroy();
    check([...maskSet].every((m) => m.destroyed), 'destroying pooled sprites releases their mask geometry');
    results.push('floorRing pooling: 64 emissions/clear cycles reuse two Graphics masks; sprite teardown releases geometry PASS');

    const opts = { width: 240, height: 180, resolution: 1, antialias: false, preference: 'webgl' };
    const app = isPixiV8() ? new Application() : new Application(opts);
    if (isPixiV8()) await app.init(opts);
    app.ticker.stop();
    const rt = RenderTexture.create({ width: 240, height: 180 });
    const pixels = () => {
      renderToTexture(app.renderer, w.layers.ground.parent, rt);
      const data = app.renderer.extract.pixels(isPixiV8() ? { target: rt } : rt);
      return (data.pixels ?? data).slice();
    };
    const color = (data, x, y) => [...data.slice((y * 240 + x) * 4, (y * 240 + x) * 4 + 3)];
    const body = new Sprite(Texture.WHITE); body.tint = 0x803030; body.position.set(120, 90);
    body.anchor.set(0.5, 0); body.width = 60; body.height = 30; body.zIndex = 90;
    const before = new Sprite(Texture.WHITE); before.tint = 0x803030; before.position.set(120, 70);
    before.width = 60; before.height = 20; before.anchor.set(0.5, 0); before.zIndex = 90;
    w.layers.body.addChild(body, before);
    floorRing(w, tex, { x: 120, y: 90, radius: 35, palette, blend: 'normal', duration: 1000 });
    w.layers.body.sortChildren(); let data = pixels();
    const farPixel = color(data, 120, 73), nearPixel = color(data, 120, 107);
    check(farPixel[0] === 128 && farPixel[1] === 48 && farPixel[2] === 48, `far arc stays behind unit: ${farPixel}`);
    check(nearPixel.every((v) => v > 180), `near arc visibly crosses in front of feet: ${nearPixel}`);
    const foreground = new Sprite(Texture.WHITE); foreground.tint = 0x20b050; foreground.position.set(114, 101);
    foreground.width = 12; foreground.height = 14; foreground.zIndex = 108; w.layers.body.addChild(foreground); w.layers.body.sortChildren();
    data = pixels(); const frontPixel = color(data, 120, 107);
    check(frontPixel[0] === 32 && frontPixel[1] === 176 && frontPixel[2] === 80, `foreground unit covers near arc: ${frontPixel}`);
    body.destroy(); before.destroy(); foreground.destroy(); w.clear();
    for (const blend of ['normal', 'add']) for (const y of [90, 90.5]) {
      const shared = { x: 120.5, y, life: 1000, texture: tex.rune, scale: 35 / 236,
        scaleX: 1.2, scaleY: 0.8, rotation: 0.57, spin: 0.7, alpha: 0.8, tint: 0x80c0ff, blend };
      w.spawn({ ...shared, layer: 'ground', groundAligned: true }); step(w, 100);
      const full = pixels(); w.clear();
      floorRing(w, tex, { ...shared, textureRadius: 236, radius: 35, palette, duration: 1000 }); step(w, 100);
      const split = pixels(); let error = 0;
      for (let i = 0; i < split.length; i++) error = Math.max(error, Math.abs(split[i] - full[i]));
      check(error <= 2, `no seam, gap or double brightness (${blend}, subpixel y=${y}): max error ${error}`);
      w.clear();
    }
    rt.destroy(true); app.destroy(); clean(w, 'rendering');
    results.push('floorRing WebGL pixels: front arc over feet, far arc behind body, foreground unit over front arc; rotating/nonuniform rune matches unsplit ring at integer/subpixel seams (normal/add) PASS');
    return results;
  });
  results.forEach((line) => console.log(line));
} finally { await browser.close(); }
