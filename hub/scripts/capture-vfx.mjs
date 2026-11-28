// Captures every Free effect from a locally served showcase, frame by frame, for the Hub card media.
// Playwright's fake clock is paused and stepped 1/30 s at a time, so the frames are evenly spaced
// no matter how slowly software WebGL renders.
//
//   node skills/lenhon-vfx/scripts/fetch-packs.mjs --all --out showcase/public/packs/free
//   npm run build:runtime && VITE_PACKS_URL=/packs/free npx vite --config showcase/vite.config.ts --port 5180
//   node hub/scripts/capture-vfx.mjs http://127.0.0.1:5180 /tmp/frames [id,id,...]
//   python3 -I hub/scripts/vfx-media.py /tmp/frames hub/public/media/vfx
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base, outDir, only] = process.argv.slice(2);
if (!base || !outDir) throw new Error('usage: capture-vfx.mjs <showcase url> <out dir> [id,id,...]');
const index = JSON.parse(readFileSync(new URL('../../showcase/public/packs/free/index.json', import.meta.url), 'utf8'));
const ids = only ? only.split(',') : index.map(e => e.id);
// CHROMIUM_PATH points at an existing Chromium when `npx playwright install chromium` is not an option.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

for (const id of ids) {
  const dir = join(outDir, id);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', e => console.warn(id, 'pageerror', e.message));
  await page.clock.install({ time: new Date('2026-11-28T00:00:00Z') });
  await page.goto(`${base}/#${id}`);
  await page.addStyleTag({ content: '.arena-tip,.stage-tools,.stage-toolbar{display:none!important}' });
  const status = () => page.locator('#status').textContent();
  // Let real and fake time flow while the pack downloads and decodes.
  for (let i = 0; i < 400 && !(await status())?.startsWith('Ready'); i++) { await page.clock.runFor(50); await page.waitForTimeout(25); }
  if (!(await status())?.startsWith('Ready')) { console.warn(id, 'never ready:', await status()); await context.close(); continue; }
  await page.locator('#shake').uncheck();
  // Crop to the arena: the caster, the target and the space above them.
  const box = (await page.locator('#stage canvas').first().boundingBox());
  const clip = { x: box.x + box.width * 0.178, y: box.y + box.height * 0.191, width: box.width * 0.644, height: box.height * 0.692 };
  const shot = () => page.screenshot({ type: 'jpeg', quality: 92, clip });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1500));
  await page.clock.runFor(100);
  writeFileSync(join(dir, 'idle.jpg'), await shot());
  await page.locator('#replay').click();
  let n = 0, playing = false;
  for (; n < 240; n++) {
    await page.clock.runFor(1000 / 30);
    const s = await status();
    if (s?.startsWith('Playing')) playing = true;
    if (playing && s?.startsWith('Ready')) break;
    writeFileSync(join(dir, String(n).padStart(3, '0') + '.jpg'), await shot());
  }
  console.log(id, 'frames', n, playing ? '' : '(never saw Playing)');
  await context.close();
}
await browser.close();
