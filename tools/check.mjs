#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { checkFireDragon } from './test-fire-dragon.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const baseline = JSON.parse(await readFile(resolve(root, 'tools/check-baseline.json'), 'utf8'));
assert(Object.values(baseline).every((peak) => Number.isInteger(peak) && peak > 0), 'Baseline peaks must be positive integers');
function budgetResult(peak, budget, previous) {
  if (peak <= budget) return { warning: '', failure: '' };
  const overage = `+${peak - budget} over budget`;
  if (previous !== undefined && peak <= previous * 1.05) return { warning: `WARN: ${overage}, baselined`, failure: '' };
  return { warning: '', failure: `${overage}${previous === undefined ? ', no baseline' : `, exceeds baseline ${previous} +5%`}` };
}
assert.equal(budgetResult(150, 150).failure, '');
assert.equal(budgetResult(151, 150).failure, '+1 over budget, no baseline');
assert.equal(budgetResult(210, 150, 200).warning, 'WARN: +60 over budget, baselined');
assert.equal(budgetResult(211, 150, 200).failure, '+61 over budget, exceeds baseline 200 +5%');
assert.equal(budgetResult(149, 150, 200).warning, '');
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.[cm]?[jt]s$/.test(entry.name) && /Math\s*(?:\.\s*random|\[\s*['"]random['"]\s*\])\s*\(/.test(await readFile(path, 'utf8'))) {
      failures.push(`Direct Math.random call: ${path}`);
    }
  }
}
await scan(resolve(root, 'kit'));
// Pure runtime contracts run without a browser or WebGL.
const bundle = await build({ stdin: { contents: "export * from './kit/ease'; export * from './kit/palette';", resolveDir: root }, bundle: true, write: false, platform: 'node', format: 'esm' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const sequence = (seed) => { const rng = api.mulberry32(seed); return Array.from({ length: 100 }, rng); };
assert.deepEqual(sequence(42), sequence(42));
assert.notDeepEqual(sequence(42), sequence(43));
assert(sequence(42).every((v) => v >= 0 && v < 1));
api.setRng(() => 0.25);
assert.equal(api.random(), 0.25);
assert.equal(api.rand(0, 8), 2);
assert.equal(api.randSign(), -1);
assert.equal(api.pick(['a', 'b']), 'a');
assert.equal(api.pick([]), undefined);
assert.deepEqual(api.paletteFrom(0x123456, { core: 0, dark: 0 }), { main: 0x123456, core: 0, dark: 0 });
for (const color of [0, 0xffffff, 0xff0000, 0x00ff00, 0x0000ff]) {
  const p = api.paletteFrom(color);
  assert.equal(p.main, color);
  assert(Object.values(p).every((v) => Number.isInteger(v) && v >= 0 && v <= 0xffffff));
}
console.log('RNG and palette contracts: PASS');

const demo = resolve(root, 'demo');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(demo, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(demo + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
let browser;
try {
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  browser = await chromium.launch({ headless: true });
  await checkFireDragon(browser);
  const url = `http://127.0.0.1:${server.address().port}/?debug&quality=high&seed=12345`;
  let page = await browser.newPage();
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__vfxDebug);
  const skills = await page.evaluate(() => window.__vfxDebug.skills);
  assert.equal(skills.filter(s => s.id.startsWith('activation-')).length, 6);
  assert.equal(skills.filter(s => s.id.startsWith('evolution-')).length, 2);
  const contracts = await page.evaluate(() => {
    const d = window.__vfxDebug, w = window.demo.vfx;
    let rejected = false;
    try { d.setTier(4); } catch { rejected = true; }
    const cleared = ['activation-hoa-3', 'evolution-thuy', 'hoa-fireball'].every(id => {
      d.cast(id, 3);
      d.advance(100);
      w.clear();
      d.advance(2000);
      return !d.stats().particles && !d.stats().updaters;
    });
    const spawned = [], spawn = w.spawn.bind(w);
    w.spawn = o => { const particle = spawn(o); if (particle) spawned.push(particle); return particle; };
    d.cast('activation-hoa-3');
    const feet = spawned.find(q => !q.o.groundAligned && q.o.follow).o.follow();
    feet.z = 90;
    d.advance(450);
    const grounded = spawned.filter(q => q.o.groundAligned).every(q => q.z === 0);
    feet.z = 0;
    w.spawn = spawn;
    w.clear();
    d.cast('kim-sword-rain', 3);
    d.step(480);
    const pillars = w.particles.filter(p => p.age >= 0 && p.o.life === 520);
    const releaseBehindCaster = pillars.length > 0 && pillars.every(p => p.o.layer === 'ground' && p.sprite.alpha <= 0.16);
    const fullDensity = w.density === 1;
    w.clear();
    return { rejected, cleared, grounded, releaseBehindCaster, fullDensity };
  });
  assert.deepEqual(contracts, { rejected: true, cleared: true, grounded: true, releaseBehindCaster: true, fullDensity: true });
  console.log('Activation tier validation, airborne ground projection and interrupted-effect cleanup: PASS');
  const salute = await page.evaluate(() => {
    const d = window.__vfxDebug, w = window.demo.vfx;
    const swords = [], shadows = [], spawn = w.spawn.bind(w);
    w.spawn = o => {
      const q = spawn(o);
      if (q && o.blend === 'normal') {
        if (o.layer === 'ground') shadows.push(q);
        else swords.push(q);
      }
      return q;
    };
    d.seed(12345);
    d.cast('kim-sword-rain', 0);
    w.spawn = spawn;
    d.step(30);
    const staggered = swords.filter(q => q.sprite.visible).length === 3;
    d.step(185);
    const positions = swords.map(q => q.sprite.y);
    const angles = swords.map(q => q.sprite.rotation);
    const hovering = swords.length === 5 && swords.every(q => q.sprite.visible) &&
      shadows.length === 5 && shadows.every(q => q.z === 0 && q.sprite.alpha > 0);
    d.step(65);
    const calm = swords.every((q, i) => Math.abs(q.sprite.y - positions[i]) < 2.5 &&
      Math.abs(q.sprite.rotation - angles[i]) < 0.025);
    d.step(270);
    const bob = swords.map((q, i) => q.sprite.y - positions[i]);
    const independent = Math.min(...bob) < -2 && Math.max(...bob) > 2;
    d.step(480);
    const held = swords.every((q, i) => q.sprite.visible && q.sprite.alpha > 0.9 &&
      Math.abs(q.sprite.y - positions[i]) < 10 && Math.abs(q.sprite.rotation - angles[i]) < 0.12);
    d.step(110);
    const aimed = swords.every(q => -Math.sin(q.sprite.rotation) > 0.65);
    const beforeLaunch = swords.map(q => q.sprite.x);
    d.step(55);
    const launched = swords.every((q, i) => q.sprite.x > beforeLaunch[i] + 25);
    w.clear();
    return { staggered, hovering, calm, independent, held, aimed, launched };
  });
  assert.deepEqual(salute, { staggered: true, hovering: true, calm: true, independent: true, held: true, aimed: true, launched: true });
  console.log('Sword Rain stagger, sustained independent hover, ground shadows, and aimed launch: PASS');
  skills.push(...skills.filter(s => !/^(activation|evolution)-/.test(s.id)).map(skill => ({
    ...skill, label: `${skill.id}-tier3`, tier: 3,
  })));
  await page.close();
  const rows = [];
  for (const skill of skills) {
    console.log(`Checking ${skill.id}`);
    await browser.close();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.on('pageerror', (error) => failures.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__vfxDebug);
    const result = await page.evaluate(({ id, length, tier = 0 }) => {
      const d = window.__vfxDebug, w = window.demo.vfx;
      let peak = 0, hits = 0, empoweredPeak = 0, tickSparks = 0;
      const empowered = new Map();
      const spawn = w.spawn.bind(w);
      w.spawn = (...args) => {
        if (args[0].layer === 'top' && args[0].blend === 'normal' && [850, 1100].includes(args[0].life)) hits++;
        const p = spawn(...args);
        if (p && d.isEmpowering()) empowered.set(p, p.o);
        if (p && d.isEmpowering() && args[0].life === 160) tickSparks++;
        for (const [q, o] of empowered) if (q.dead || q.o !== o) empowered.delete(q);
        empoweredPeak = Math.max(empoweredPeak, empowered.size);
        peak = Math.max(peak, w.count); return p;
      };
      const runs = [];
      for (let i = 0; i < 3; i++) {
        d.seed(12345);
        if (i === 0) d.cast(id, tier); else d.repeat(id, tier);
        if (tier && id === 'tho-fissure') d.moveCaster({ x: 450 });
        for (let left = length + 1900; left > 0; left -= 16) d.advance(Math.min(left, 16));
        runs.push(d.stats());
      }
      return { peak, runs, hits, empoweredPeak, tickSparks };
    }, skill);
    await page.close();
    // SkillDef has no ultimate flag: every sample uses the ordinary 150 cap.
    // Future skills explicitly named *-ultimate (or ultimate-*) get 600.
    const budget = /(^|-)ultimate(-|$)/.test(skill.id) ? 600 : 150;
    const issues = [];
    if (skill.label && ['hoa-fireball', 'tho-fissure', 'thuy-frost-nova', 'moc-toxic-spores'].includes(skill.id) && !result.hits) issues.push('no damaging hits exercised');
    if (skill.label && skill.id === 'moc-toxic-spores' && !result.tickSparks) issues.push('no empowered DoT ticks exercised');
    const budgetStatus = budgetResult(result.peak, budget,
      Object.hasOwn(baseline, skill.id) ? baseline[skill.id] : undefined);
    if (budgetStatus.failure) issues.push(budgetStatus.failure);
    if (result.runs.some((r) => r.particles || r.updaters)) issues.push('leftovers');
    if (result.runs.slice(1).some((r, i) => Object.keys(r).some((key) => r[key] > result.runs[i][key]))) issues.push('growth');
    rows.push({ skill: skill.label ?? skill.id, peak: result.peak, empowered: skill.label ? result.empoweredPeak : '-', budget,
      particles: result.runs.map((r) => r.particles).join('/'), updaters: result.runs.map((r) => r.updaters).join('/'),
      pool: result.runs.map((r) => `${r.sprites}:${r.records}`).join('/'), result: [...issues, budgetStatus.warning].filter(Boolean).join(', ') || 'PASS' });
    if (issues.length) failures.push(`${skill.id}: ${issues.join(', ')}`);
  }
  console.table(rows);
} finally {
  if (browser) await browser.close();
  await new Promise((ok) => server.close(ok));
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('All skill checks passed (3 seeded casts each).');
