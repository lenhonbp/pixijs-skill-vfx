import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({ stdin: { contents: "export * from './kit'; export { Container } from 'pixi.js';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', globalName: 'kit' });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  console.log(await page.evaluate(() => {
    const { VfxWorld, Container, createVfxTextures, empoweredWorld, empoweredHit, PALETTES } = kit;
    const w = new VfxWorld(VfxWorld.createLayers(new Container())), tex = createVfxTextures();
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const scoped = empoweredWorld(w, { tier: 3, palette: PALETTES.fire, textures: tex });
    const hit = { at: { x: 200, y: 300 }, palette: PALETTES.fire, tier: 3, element: 'kim' };
    empoweredHit(scoped, tex, hit);
    const count = w.count;
    check(count > 0, 'first facade hit emits accents');
    empoweredHit(scoped, tex, hit);
    check(w.count === count, 'facade clones must not bypass hit throttle');
    empoweredHit(scoped, tex, { ...hit, at: { x: 400, y: 300 } });
    check(w.count === count * 2, 'independent targets still emit accents');
    for (let t = 0; t < 400; t += 16) w.update(16);
    empoweredHit(scoped, tex, hit);
    check(w.count === count, 'expired facade hit can emit again');
    w.clear();
    empoweredHit(scoped, tex, hit);
    check(w.count === count, 'clear and particle reuse do not retain throttle');
    w.clear();
    check(!w.count && !w.stats.updaters, 'facade feedback cleanup');
    return 'Empowered hit facade throttle, independent targets, expiry and clear PASS';
  }));
} finally { await browser.close(); }
