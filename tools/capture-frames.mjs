#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const times = [0, 100, 200, 350, 500, 700, 1000, 1400, 2000, 2800];
const options = { out: resolve(homedir(), 'audit/before'), skills: null, seed: 12345, tier: 0 };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help') {
    console.log('Usage: node tools/capture-frames.mjs [--out DIR] [--skills id,id] [--seed INTEGER] [--tier 0|1|2|3]\nPseudo ids: activation-hoa-1/2/3, activation-thuy-1/2/3, evolution-hoa, evolution-thuy.\nTier 0 (default) captures the tier-less baseline. Requires: npx playwright install chromium.\nEach skill starts in a fresh seeded page at high quality, with exact 16 ms stepping.');
    process.exit(0);
  }
  if (!['--out', '--skills', '--seed', '--tier'].includes(arg) || !args[i + 1]) throw new Error(`Invalid argument: ${arg}`);
  const value = args[++i];
  if (arg === '--tier') {
    if (!/^[0-3]$/.test(value)) throw new Error('--tier must be 0, 1, 2 or 3');
    options.tier = Number(value);
  }
  if (arg === '--out') options.out = resolve(value.replace(/^~(?=\/|$)/, homedir()));
  if (arg === '--skills') {
    options.skills = [...new Set(value.split(',').map((id) => id.trim()).filter(Boolean))];
    if (!options.skills.length) throw new Error('--skills must contain at least one id');
  }
  if (arg === '--seed') {
    if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('--seed must be a safe integer');
    options.seed = Number(value);
  }
}

const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) throw new Error('Demo build failed', { cause: build.error });
const demo = resolve(root, 'demo');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(demo, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(demo + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
let browser;
try {
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const url = `http://127.0.0.1:${server.address().port}/?debug&quality=high&seed=${options.seed}`;
  const page = await context.newPage();
  let pageError;
  page.on('pageerror', (error) => { pageError = error; });
  const load = async () => {
    pageError = null;
    await page.goto(url);
    await page.waitForFunction(() => !!window.__vfxDebug);
    if (pageError) throw pageError;
  };
  await load();
  const available = await page.evaluate(() => window.__vfxDebug.skills);
  if (options.skills) {
    const unknown = options.skills.filter((id) => !available.some((s) => s.id === id));
    if (unknown.length) throw new Error(`Unknown skills: ${unknown.join(', ')}. Available: ${available.map((s) => s.id).join(', ')}`);
  }
  const skills = available.filter((s) => !options.skills || options.skills.includes(s.id));
  await mkdir(options.out, { recursive: true });
  const counts = {};
  const sheetPage = await context.newPage();
  for (const [index, skill] of skills.entries()) {
    if (index) await load();
    const label = options.tier && !/^(activation|evolution)-/.test(skill.id) ? `${skill.id}-tier${options.tier}` : skill.id;
    const preRoll = /^(activation|evolution)-/.test(skill.id) ? 0 : await page.evaluate(
      tier => window.__vfxDebug.activationRelease(tier), options.tier);
    const frameTimes = times.map(time => time + preRoll);
    await page.evaluate(({ id, tier }) => window.__vfxDebug.cast(id, tier), { id: skill.id, tier: options.tier });
    let elapsed = 0;
    const frames = [];
    // Include the count checkpoint in the timeline even for very short skills.
    const countTime = skill.length + preRoll + 1900;
    const checkpoints = [...new Set([...frameTimes, countTime])].sort((a, b) => a - b);
    for (const time of checkpoints) {
      const count = await page.evaluate((ms) => {
        window.__vfxDebug.step(ms);
        return window.__vfxDebug.count();
      }, time - elapsed);
      elapsed = time;
      if (time === countTime) counts[skill.id] = count;
      if (frameTimes.includes(time)) {
        frames.push({ time, png: (await page.locator('#stage canvas').screenshot({ animations: 'disabled' })).toString('base64') });
      }
      if (pageError) throw pageError;
    }
    const png = await sheetPage.evaluate(async ({ frames, id }) => {
      const images = await Promise.all(frames.map(({ png }) => new Promise((ok, fail) => {
        const image = new Image(); image.onload = () => ok(image); image.onerror = fail;
        image.src = `data:image/png;base64,${png}`;
      })));
      const width = images[0].width, height = images[0].height, label = 32;
      const canvas = document.createElement('canvas');
      canvas.width = width * 5; canvas.height = (height + label) * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#14121b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '18px sans-serif'; ctx.fillStyle = '#ffffff';
      images.forEach((image, i) => {
        const x = (i % 5) * width, y = Math.floor(i / 5) * (height + label);
        ctx.fillText(`${id} · ${frames[i].time} ms`, x + 10, y + 23);
        ctx.drawImage(image, x, y + label);
      });
      return canvas.toDataURL('image/png').split(',')[1];
    }, { frames, id: label });
    await writeFile(resolve(options.out, `${label}.png`), Buffer.from(png, 'base64'));
    console.log(`${label}.png: ${counts[skill.id]} particles at ${countTime} ms`);
  }
  await writeFile(resolve(options.out, 'counts.json'), JSON.stringify(counts, null, 2) + '\n');
  console.log(`Captured ${skills.length} skills in ${options.out}`);
} finally {
  if (browser) await browser.close();
  await new Promise((ok) => server.close(ok));
}
