// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Allocation / GC benchmark of the player under continuous playback. Not part of `check:runtime` (it is a measurement, not a test).
//
//   node runtime/test/bench-gc.mjs [--pack FILE.vfxb] [--mono FILE.vfxb] [--frames 3600] [--realtime]
//
// Every scenario plays the pack over and over (a new cast every 20 frames) for --frames frames (3600 = 60 s at 60 fps), with a warm-up
// of 3000 frames first so pools, shaders and V8's optimizing compiler are warm. It reports, from V8's sampling heap profiler and GC trace events:
//   - bytes allocated per frame by the runtime's own source, and by everything (Pixi's render bookkeeping included)
//   - scavenges and major GCs during the run
//   - draw calls per frame
// --realtime drives the real ticker for 60 s of wall time instead of stepping virtual time, and also reports frame-time spikes.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), opt = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const packs = { rgb: resolve(opt('--pack') ?? resolve(root, 'showcase/public/packs/free/hoa-fireball.vfxb')), mono: opt('--mono') && resolve(opt('--mono')) };
const frames = Number(opt('--frames') ?? 3600), realtime = args.includes('--realtime'), WARMUP = 3000;
const bundle = await build({
  stdin: { resolveDir: root, contents: `
    import { Application, Container, Sprite, Texture, ColorMatrixFilter } from 'pixi.js';
    import { VfxPlayer, FlowTrail } from './runtime/src/index';
    window.setup = async (urls) => {
      const app = new Application(); await app.init({ width: 640, height: 360, background: 0x171922, preference: 'webgl', autoStart: false });
      document.body.appendChild(app.canvas);
      const stage = new Container(), camera = new Container(); app.stage.addChild(camera); camera.addChild(stage);
      const target = new Sprite(Texture.WHITE); target.width = target.height = 24; target.anchor.set(0.5); target.position.set(520, 280); stage.addChild(target);
      const vfx = new VfxPlayer(app, { shake: { target: camera }, hitstop: true, colorMatrixFilter: ColorMatrixFilter });
      for (const [id, url] of Object.entries(urls)) if (url) await vfx.load(url);
      const gl = app.renderer.gl; window.draws = 0;
      for (const fn of ['drawElements', 'drawArrays']) { const orig = gl[fn].bind(gl); gl[fn] = (...a) => { window.draws++; return orig(...a); }; }
      const noise = document.createElement('canvas'); noise.width = 64; noise.height = 16; noise.getContext('2d').fillStyle = '#fc6'; noise.getContext('2d').fillRect(0, 0, 64, 16);
      const trail = new FlowTrail({ texture: Texture.from(noise), width: 30, points: 20 }); trail.reset(40, 120); stage.addChild(trail.mesh);
      const from = { x: 80, y: 280 }, to = { x: 520, y: 280 };
      const scenario = {
        sprites: (i) => { if (i % 20 === 0) vfx.play('hoa-fireball', { from, to, fitDistance: true, parent: stage }); },
        juice: (i) => { if (i % 20 === 0) vfx.play('hoa-fireball', { from, fitDistance: true, parent: stage, hitstop: true, target }); },
        ramp: (i) => { if (i % 20 === 0) vfx.play('hoa-fireball', { from, to, fitDistance: true, parent: stage, element: ['hoa', 'cyan', 'crimson', 'gold'][(i / 20) % 4 | 0] }); },
        trail: (i) => { trail.push(40 + (i * 7) % 560, 120 + Math.sin(i / 9) * 40); trail.dissolve = (i % 120) / 120; },
      };
      window.step = (name, from0, n, render = true) => { const f = scenario[name]; for (let i = from0; i < from0 + n; i++) { f(i); trail.push(40 + (i * 7) % 560, 120 + Math.sin(i / 9) * 40); trail.update(1000 / 60); vfx.update(1000 / 60); if (render) app.render(); } };
      window.real = (name, ms) => new Promise(done => { const f = scenario[name]; let i = 0; const times = []; let last = performance.now();
        app.ticker.add(() => { const now = performance.now(); times.push(now - last); last = now; f(i++); trail.update(app.ticker.deltaMS); });
        app.start(); setTimeout(() => { app.stop(); times.sort((a, b) => a - b); done({ frames: times.length, p50: times[times.length >> 1], p99: times[Math.floor(times.length * 0.99)], max: times.at(-1) }); }, ms); });
      window.active = () => vfx.stats();
    };` },
  bundle: true, format: 'esm', write: false, sourcemap: false,
});
const code = bundle.outputFiles[0].text, lines = code.split('\n');
// Which script lines are the runtime's own source: the bundle marks every module with "// <path>".
const runtimeLines = []; let inRuntime = false;
lines.forEach((line, i) => { const m = line.match(/^\/\/ (\S+\.(?:ts|js|mjs))$/); if (m) inRuntime = m[1].startsWith('runtime/src/'); if (inRuntime) runtimeLines.push(i); });
const isRuntime = n => n >= runtimeLines[0] - 1 && runtimeLines.includes(n) || runtimeLines.includes(n + 1);

const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<script type="module" src="/b.js"></script>'); }
  if (p === '/b.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(code); }
  if (p === '/rgb.vfxb') return res.end(await readFile(packs.rgb));
  if (p === '/mono.vfxb' && packs.mono) return res.end(await readFile(packs.mono));
  res.writeHead(404).end();
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const report = [];
try {
  for (const [label, name, packKey] of [['sprites (RGB pack)', 'sprites', 'rgb'], ['juice (hitstop + impulse + flash)', 'juice', 'rgb'], ['ramp (mono pack, 4 elements)', 'ramp', 'mono'], ['flow trail', 'trail', 'rgb']]) {
    if (packKey === 'mono' && !packs.mono) { report.push(`${label}: skipped (pass --mono FILE.vfxb, baked with the factory's --mono true)`); continue; }
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForFunction(() => window.setup);
    const urls = packKey === 'mono' ? { 'hoa-fireball': '/mono.vfxb' } : { 'hoa-fireball': '/rgb.vfxb' };
    await page.evaluate(u => window.setup(u), urls);
    // Warm-up: pools, shaders, the native ramp and, above all, V8's optimizing compiler. Un-optimised code boxes every double it
    // computes, which would be measured as allocation that the steady state does not have. Render calls are skipped (they add nothing here).
    await page.evaluate(([n, warm]) => window.step(n, 0, warm, false), [name, WARMUP]);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 128, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await browser.startTracing(page, { categories: ['v8', 'disabled-by-default-v8.gc'] });
    let live, wall = Date.now(), timing = '';
    if (realtime) { const t = await page.evaluate(([n]) => window.real(n, 60000), [name]); timing = `, frame time p50 ${t.p50.toFixed(1)} ms / p99 ${t.p99.toFixed(1)} ms / max ${t.max.toFixed(1)} ms over ${t.frames} frames`; }
    else live = await page.evaluate(([n, total, warm]) => { window.draws = 0; for (let k = 0; k < total; k += 600) window.step(n, warm + k, Math.min(600, total - k)); return { draws: window.draws, ...window.active() }; }, [name, frames, WARMUP]);
    const draws = realtime ? null : live.draws / frames;
    const trace = JSON.parse((await browser.stopTracing()).toString());
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    const gc = {}; for (const e of trace.traceEvents) if (e.ph === 'X' && ['V8.GCScavenger', 'V8.GCCompactor', 'V8.GCFinalizeMC', 'MajorGC'].includes(e.name)) gc[e.name] = (gc[e.name] ?? 0) + 1;
    let total = 0, own = 0; const by = new Map();
    const walk = node => { total += node.selfSize; if (node.callFrame.url.endsWith('/b.js') && isRuntime(node.callFrame.lineNumber)) { own += node.selfSize; const k = `${node.callFrame.functionName || '(anon)'}`; by.set(k, (by.get(k) ?? 0) + node.selfSize); } node.children.forEach(walk); };
    walk(profile.head);
    const n = realtime ? 3600 : frames, top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v / n).toFixed(0)}`).join(', ');
    report.push(`${label}: ${n} frames${realtime ? ' (60 s real time)' : ` (${(n / 60).toFixed(0)} s virtual)`}: runtime source ${(own / n).toFixed(0)} B/frame [${top}], whole page ${(total / n).toFixed(0)} B/frame, ${gc['V8.GCScavenger'] ?? 0} scavenges, ${(gc['V8.GCCompactor'] ?? 0) + (gc.MajorGC ?? 0)} major GCs${draws === null ? '' : `, ${draws.toFixed(2)} draw calls/frame`}${timing}`);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
console.log(report.join('\n'));
