// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Headless stress benchmark of the player: allocation, GC and frame time with 50-100 concurrent skill instances, gated.
// Not part of `check:runtime` (it takes a few minutes and measures rather than tests).
//
//   npm run bench [-- --instances 50,100] [--fps 60,120] [--frames 1800] [--warmup 2000] [--scenarios sprites,juice,ramp,mixed]
//                 [--pack FILE.vfxb] [--mono FILE.vfxb] [--budget 100] [--out benchmarks/latest.md | --no-write] [--strict]
//
// Each run keeps N skill instances playing at once (every slot recasts its skill the frame its previous cast ends, staggered so the
// count stays flat) in a virtual loop stepped at 60 or 120 FPS, rendering every frame. After a warm-up (pools, shaders, V8's
// optimizing compiler) it runs two passes over the same frames:
//   1. timing: per-frame CPU time of vfx.update() and of the whole frame (update + render), GC trace events, and the heap retained
//      after a forced GC before and after the pass
//   2. allocation: V8's sampling heap profiler, split into the runtime's own source and everything else on the page (Pixi included)
// Gate (exit code 1 on failure): runtime-source allocation <= --budget B/frame, retained heap growth <= --budget B/frame and no major GC
// during the pass. Pipeline stalls (frames over twice the frame budget) are reported, and only fail the run with --strict, since a
// headless software GL says nothing about frame time on a phone. Results go to benchmarks/latest.md as a Markdown table.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), opt = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const list = (name, fallback) => (opt(name) ?? fallback).split(',').map(s => s.trim()).filter(Boolean);
const free = resolve(root, 'showcase/public/packs/free');
const monoDefault = resolve(free, 'hoa-fireball.m.vfxb');
const packs = {
  rgb: resolve(opt('--pack') ?? resolve(free, 'hoa-fireball.vfxb')),
  mono: opt('--mono') ? resolve(opt('--mono')) : existsSync(monoDefault) ? monoDefault : null,
};
// The mixed scenario: heavy skills of different shapes (a domain, a vortex, a ground fissure with dissolving decals, a projectile).
const MIXED = ['loi-thunder-domain', 'phong-whirlwind', 'tho-fissure', 'hoa-fireball'];
const instances = list('--instances', '50,100').map(Number), loops = list('--fps', '60,120').map(Number);
const scenarios = list('--scenarios', 'sprites,juice,ramp,mixed');
const frames = Number(opt('--frames') ?? 1800), WARMUP = Number(opt('--warmup') ?? 2000), budget = Number(opt('--budget') ?? 100);
const strict = args.includes('--strict'), out = args.includes('--no-write') ? null : resolve(root, opt('--out') ?? 'benchmarks/latest.md');
if (instances.some(n => !(n > 0)) || loops.some(f => !(f > 0)) || !(frames > 0)) throw new Error('--instances, --fps and --frames take positive numbers');
for (const s of scenarios) if (!['sprites', 'juice', 'ramp', 'mixed'].includes(s)) throw new Error(`unknown scenario ${s}`);
for (const f of [packs.rgb, ...(scenarios.includes('mixed') ? MIXED.map(id => resolve(free, `${id}.vfxb`)) : [])])
  if (!existsSync(f)) throw new Error(`missing pack ${relative(root, f)}: run node skills/lenhon-vfx/scripts/fetch-packs.mjs --all --out showcase/public/packs/free`);

const bundle = await build({
  stdin: { resolveDir: root, contents: `
    import { Application, Container, Sprite, Texture, ColorMatrixFilter } from 'pixi.js';
    import { VfxPlayer, FlowTrail, GroundDissolveFilter } from './runtime/src/index';
    let app, vfx, trail, step, gl;
    window.setup = async ({ urls, scenario, instances, fps }) => {
      app = new Application(); await app.init({ width: 320, height: 180, background: 0x171922, preference: 'webgl', autoStart: false });
      document.body.appendChild(app.canvas);
      const stage = new Container(), camera = new Container(); app.stage.addChild(camera); camera.addChild(stage); stage.scale.set(0.5);
      const target = new Sprite(Texture.WHITE); target.width = target.height = 24; target.anchor.set(0.5); target.position.set(520, 280); stage.addChild(target);
      // The zero-GC configuration the README documents: pooled handles and shared event objects.
      vfx = new VfxPlayer(app, { shake: { target: camera }, hitstop: true, colorMatrixFilter: ColorMatrixFilter, recycleHandles: true, reuseEvents: true,
        groundDissolve: GroundDissolveFilter.supported(app) ? { filter: GroundDissolveFilter } : undefined });
      vfx.on('cue', () => {}); vfx.on('tier', () => {});
      const ids = [];
      for (const [id, url] of urls) { await vfx.load(url); ids.push(id); }
      const noise = document.createElement('canvas'); noise.width = 64; noise.height = 16; noise.getContext('2d').fillStyle = '#fc6'; noise.getContext('2d').fillRect(0, 0, 64, 16);
      trail = new FlowTrail({ texture: Texture.from(noise), width: 30, points: 20 }); trail.reset(40, 120); stage.addChild(trail.mesh);
      // One slot per instance, its cast options built once so the loop allocates nothing of its own. Whenever fewer than N plays run
      // (a cast ended), the next slot recasts, so N instances stay live whatever hitstop does to the clock.
      const elements = ['hoa', 'cyan', 'crimson', 'gold'], slots = [];
      for (let k = 0; k < instances; k++) {
        const from = { x: 30 + (k * 53) % 220, y: 90 + (k * 37) % 240 };
        const to = { x: Math.min(620, from.x + 200 + (k * 29) % 180), y: Math.max(40, Math.min(340, from.y + (k * 17) % 90 - 45)) };
        const o = scenario === 'juice' ? { from, fitDistance: true, parent: stage, hitstop: true, target }
          : scenario === 'ramp' ? { from, to, fitDistance: true, parent: stage, element: elements[k % 4] }
          : { from, to, fitDistance: true, parent: stage };
        slots.push({ id: ids[k % ids.length], o });
      }
      const dt = 1000 / fps; let next = 0;
      step = (i) => {
        while (vfx.playing < instances) { const s = slots[next]; next = (next + 1) % instances; vfx.play(s.id, s.o); }
        trail.push(40 + (i * 7) % 560, 120 + Math.sin(i / 9) * 40); trail.update(dt);
      };
      window.dt = dt; gl = app.renderer.gl;
    };
    window.run = (from0, n, render, upd, frame) => {
      const dt = window.dt;
      for (let j = 0; j < n; j++) {
        step(from0 + j);
        const t0 = performance.now(); vfx.update(dt); const t1 = performance.now();
        // finish() waits for the GPU, so a frame's time includes its rasterisation instead of surfacing later as a blocked flush.
        if (render) { app.render(); gl.finish(); }
        const t2 = performance.now();
        if (upd) { upd[j] = t1 - t0; frame[j] = t2 - t0; }
      }
    };
    // The whole timed pass runs in one task, so the page never idles (an idle page lets V8's memory reducer start a major GC).
    window.timed = (from0, n) => {
      const upd = new Float64Array(n), frame = new Float64Array(n), live = [];
      for (let k = 0; k < n; k += 600) { window.run(from0 + k, Math.min(600, n - k), true, upd.subarray(k), frame.subarray(k)); live.push(vfx.playing); }
      return { upd: Array.from(upd), frame: Array.from(frame), live };
    };
  ` },
  bundle: true, format: 'esm', write: false, sourcemap: false, logLevel: 'error',
});
const code = bundle.outputFiles[0].text, lines = code.split('\n');
// Which script lines are the runtime's own source: the bundle marks every module with "// <path>" (the harness is "// <stdin>").
const runtimeLines = new Set(); let inRuntime = false;
lines.forEach((line, i) => { const m = line.match(/^\/\/ (<stdin>|\S+\.(?:ts|js|mjs))$/); if (m) inRuntime = m[1].startsWith('runtime/src/'); if (inRuntime) runtimeLines.add(i); });

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // Cross-origin isolation gives performance.now() 5 us resolution instead of 100 us.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin'); res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  if (p === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<script type="module" src="/b.js"></script>'); }
  if (p === '/b.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(code); }
  if (p === '/rgb.vfxb') return res.end(await readFile(packs.rgb));
  if (p === '/mono.vfxb' && packs.mono) return res.end(await readFile(packs.mono));
  const m = p.match(/^\/free\/([\w-]+\.vfxb)$/); if (m) return res.end(await readFile(resolve(free, m[1])));
  res.writeHead(404).end();
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const GC_NAMES = { 'V8.GCScavenger': 'minor', 'MinorGC': 'minor', 'V8.GCCompactor': 'major', 'MajorGC': 'major', 'V8.GCFinalizeMC': 'major' };
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const rows = [];
try {
  for (const scenario of scenarios) for (const n of instances) for (const fps of loops) {
    const label = `${scenario} x${n} @${fps}`;
    if (scenario === 'ramp' && !packs.mono) { rows.push({ scenario, n, fps, skipped: 'no mono pack (pass --mono FILE.vfxb)' }); console.log(`${label}: skipped`); continue; }
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForFunction(() => window.setup);
    const urls = scenario === 'mixed' ? MIXED.map(id => [id, `/free/${id}.vfxb`]) : [['hoa-fireball', scenario === 'ramp' ? '/mono.vfxb' : '/rgb.vfxb']];
    await page.evaluate(o => window.setup(o), { urls, scenario, instances: n, fps });
    await page.evaluate(([w]) => { for (let k = 0; k < w; k += 500) window.run(k, Math.min(500, w - k), true); }, [WARMUP]);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };

    // Pass 1: frame time, GC events and retained heap.
    const before = await heap();
    await browser.startTracing(page, { categories: ['v8', 'disabled-by-default-v8.gc'] });
    const { upd, frame, live } = await page.evaluate(([a, b]) => window.timed(a, b), [WARMUP, frames]);
    const trace = JSON.parse((await browser.stopTracing()).toString());
    const retained = (await heap() - before) / frames;
    const gc = { minor: 0, major: 0, maxPause: 0 };
    for (const e of trace.traceEvents) { const kind = e.ph === 'X' && GC_NAMES[e.name]; if (kind) { gc[kind]++; gc.maxPause = Math.max(gc.maxPause, (e.dur ?? 0) / 1000); } }

    // Pass 2: who allocates, over the same frames again.
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 128, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await page.evaluate(([a, total]) => window.run(a, total, true), [WARMUP + frames, frames]);
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    let total = 0, own = 0; const by = new Map();
    const walk = node => {
      total += node.selfSize;
      if (node.callFrame.url.endsWith('/b.js') && runtimeLines.has(node.callFrame.lineNumber)) { own += node.selfSize; const k = node.callFrame.functionName || '(anon)'; by.set(k, (by.get(k) ?? 0) + node.selfSize); }
      node.children.forEach(walk);
    };
    walk(profile.head);
    await page.close();

    const fs = [...frame].sort((a, b) => a - b), us = [...upd].sort((a, b) => a - b), frameBudget = 1000 / fps;
    const row = {
      scenario, n, fps, live: Math.round(live.reduce((s, v) => s + v, 0) / live.length),
      runtime: own / frames, page: total / frames, retained, gc,
      p50: pct(fs, 0.5), p95: pct(fs, 0.95), p99: pct(fs, 0.99), max: fs.at(-1), upd95: pct(us, 0.95), upd99: pct(us, 0.99),
      stalls: frame.filter(t => t > 2 * frameBudget).length, top: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v / frames).toFixed(0)}`),
      errors,
    };
    row.fail = [row.runtime > budget && `runtime ${row.runtime.toFixed(0)} B/frame > ${budget}`, row.retained > budget && `retained ${row.retained.toFixed(0)} B/frame > ${budget}`,
      gc.major > 0 && `${gc.major} major GC`, errors.length && `${errors.length} page errors`, strict && row.stalls > 0 && `${row.stalls} stalls`].filter(Boolean);
    rows.push(row);
    console.log(`${label}: ${row.live} live, runtime ${row.runtime.toFixed(0)} B/frame [${row.top.join(', ')}], page ${row.page.toFixed(0)} B/frame, retained ${row.retained.toFixed(0)} B/frame, ` +
      `${gc.minor} scavenges / ${gc.major} major (max pause ${gc.maxPause.toFixed(2)} ms), frame p50/p95/p99 ${row.p50.toFixed(2)}/${row.p95.toFixed(2)}/${row.p99.toFixed(2)} ms, ` +
      `update p99 ${row.upd99.toFixed(2)} ms, ${row.stalls} stalls -> ${row.fail.length ? 'FAIL: ' + row.fail.join('; ') : row.stalls ? 'WARN' : 'PASS'}`);
    if (errors.length) console.log(errors.join('\n'));
  }
} finally { await browser.close(); server.close(); }

const failed = rows.filter(r => r.fail?.length), measured = rows.filter(r => !r.skipped);
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
const version = p => JSON.parse(readFileSync(resolve(root, p), 'utf8')).version;
const f2 = v => v.toFixed(2), b = v => Math.max(0, v).toFixed(0);
const md = [
  '# Runtime benchmark: zero-GC and frame-time gate', '',
  `Generated by \`npm run bench\` (\`runtime/test/bench-gc.mjs\`) on ${new Date().toISOString().slice(0, 10)}, commit \`${git('describe', '--always', '--dirty', '--exclude', '*')}\`, ` +
  `runtime ${version('runtime/package.json')}, Pixi ${version('node_modules/pixi.js/package.json')}, Chromium ${browser.version()} (headless, software WebGL).`, '',
  `Each run keeps N skill instances casting at once in a virtual loop at 60 or 120 FPS, rendering every frame: ${WARMUP} warm-up frames, then ${frames} measured frames. ` +
  `Gate: runtime-source allocation and retained heap growth at most ${budget} B/frame, and no major GC. A stall is a frame over twice the frame budget (33.3 ms at 60 FPS, 16.7 ms at 120 FPS).`, '',
  `**Result: ${failed.length ? `FAIL (${failed.length} of ${measured.length} runs)` : `PASS (${measured.length} runs)`}**`, '',
  '| Scenario | Instances | Loop | Live plays | Runtime alloc | Page alloc | Retained growth | Scavenges | Major GCs | Max GC pause | Frame p50 / p95 / p99 | Update p95 / p99 | Stalls | Status |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ...rows.map(r => r.skipped ? `| ${r.scenario} | ${r.n} | ${r.fps} FPS | | | | | | | | | | | skipped: ${r.skipped} |`
    : `| ${r.scenario} | ${r.n} | ${r.fps} FPS | ${r.live} | ${b(r.runtime)} B/frame | ${b(r.page)} B/frame | ${b(r.retained)} B/frame | ${r.gc.minor} | ${r.gc.major} | ${f2(r.gc.maxPause)} ms | ` +
      `${f2(r.p50)} / ${f2(r.p95)} / ${f2(r.p99)} ms | ${f2(r.upd95)} / ${f2(r.upd99)} ms | ${r.stalls} | ${r.fail.length ? 'FAIL: ' + r.fail.join('; ') : r.stalls ? 'WARN (stalls)' : 'PASS'} |`),
  '',
  'Scenarios: `sprites` Fireball casts at varied distances and angles; `juice` the same with hitstop, camera impulse and target flash on every hit; ' +
  '`ramp` the mono pack recoloured per cast (4 elements); `mixed` Thunder Domain, Whirlwind, Fissure (with ground dissolve) and Fireball together. ' +
  'Every run also drives one flow trail. Runtime alloc is what V8\'s sampling heap profiler attributes to `runtime/src`; page alloc includes Pixi\'s render bookkeeping. ' +
  'Retained growth is the heap after a forced GC, before and after the timed pass. Frame times are CPU time of `vfx.update()` + `app.render()` on a software GL, ' +
  'useful for spotting stalls and regressions, not as phone frame times.', '',
];
if (out) { await mkdir(dirname(out), { recursive: true }); await writeFile(out, md.join('\n')); console.log(`wrote ${relative(root, out)}`); }
if (failed.length) { console.log(`FAIL: ${failed.length} of ${measured.length} runs over the gate`); process.exitCode = 1; }
