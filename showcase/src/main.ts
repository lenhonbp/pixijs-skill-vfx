// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Application, Container, Graphics } from 'pixi.js';
import { VfxPlayer } from '../../runtime/src/index';
import type { Playback, CueEvent } from '../../runtime/src/index';
import './style.css';

interface Entry { id: string; name: { en: string; vi: string }; element: string; category: string; bytes: number }
const base = import.meta.env.BASE_URL;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><a class="brand" href="#">L<span>✦</span> / LENHON <small>VFX LIBRARY</small></a><nav><a href="#library">Free collection</a><a href="#premium">Premium packs ↗</a><a href="https://github.com/lenhonbp/pixijs-skill-vfx">GitHub ↗</a></nav></header>
<main><section class="intro"><div><p class="eyebrow">BUILT FOR PIXIJS 7 + 8 · ZERO RUNTIME DEPENDENCIES</p><h1>A little magic.<br><em>A lot of impact.</em></h1><p class="lede">Game-ready 2.5D effects. Pick a spell, see it in motion,<br>and make it yours in two lines of code.</p></div><div class="intro-note"><span class="star">✳</span><strong>Runtime is free forever (MIT)</strong><p>Commercial games welcome.<br>No subscription. No attribution required.</p><a href="https://github.com/lenhonbp/pixijs-skill-vfx/tree/main/runtime">Explore the runtime ↗</a></div></section>
<section id="library" class="library"><aside><div class="section-heading"><h2>The free collection</h2><span>25 PACKS</span></div><label class="sr-only" for="search">Search effects</label><input id="search" placeholder="Search a spell…" type="search"><div id="filters" aria-label="Element filters"></div><div id="list" class="skill-list" aria-label="Effects"></div></aside>
<div class="workspace"><div class="arena-header"><div><p class="eyebrow" id="category">LIVE PREVIEW / ATTACK</p><h2 id="selected-name">Loading collection…</h2><p id="selected-vi"></p></div><span class="live"><i></i> INTERACTIVE</span></div><div id="stage" aria-label="Effect preview arena"><div class="arena-label left">CASTER</div><div class="arena-label right">TARGET</div><div class="arena-tip">Click the floor to cast · SPACE to replay</div><span class="axis">2.5D / ISOMETRIC</span></div><div class="controls"><button id="replay" class="primary">↻ Replay effect</button><label><input id="loop" type="checkbox"> Loop</label><label><input id="sound" type="checkbox"> Sound</label><label><input id="shake" type="checkbox" checked> Screen shake</label><span id="status" role="status">Loading…</span></div>
<div class="integration"><div class="section-heading"><h3>From preview to your game</h3><button id="copy">Copy code ↗</button></div><pre><code id="snippet"></code></pre><p>One tiny runtime. One self-contained pack. That’s it. <a href="https://github.com/lenhonbp/pixijs-skill-vfx/blob/main/runtime/README.md">Read the docs ↗</a></p></div></div></section>
<section id="premium"><div class="premium-heading"><div><p class="eyebrow">THE NEXT CHAPTER</p><h2>More worlds. More wonder.</h2></div><p>Handcrafted collections for your next adventure.<br><span>Premium art. The same free runtime.</span></p></div><div class="premium-grid"><article style="--accent:#d6b477"><span class="pack-symbol">劍</span><p class="eyebrow">01 / MARTIAL LEGENDS</p><h3>Kiếm Hiệp</h3><p>Sword auras, flying blades and the spirit of a wandering hero.</p><div><a href="#gumroad-link-tbd">Gumroad ↗</a><a href="#itch-link-tbd">itch.io ↗</a><span>COMING SOON</span></div></article><article style="--accent:#7dbaa9"><span class="pack-symbol">五</span><p class="eyebrow">02 / FIVE ELEMENTS</p><h3>Ngũ Hành</h3><p>Metal, wood, water, fire and earth. Five forces in perfect motion.</p><div><a href="#gumroad-link-tbd">Gumroad ↗</a><a href="#itch-link-tbd">itch.io ↗</a><span>COMING SOON</span></div></article><article style="--accent:#b69ed4"><span class="pack-symbol">冥</span><p class="eyebrow">03 / FINAL ENCOUNTERS</p><h3>Ultimate Boss</h3><p>Arena-shaking ultimates for battles players will remember.</p><div><a href="#gumroad-link-tbd">Gumroad ↗</a><a href="#itch-link-tbd">itch.io ↗</a><span>COMING SOON</span></div></article></div></section>
<footer><span>LENHON / Crafted for worlds worth building.</span><span>Runtime & free collection · MIT license</span></footer></main>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const app = new Application();
await app.init({ width: 1000, height: 580, backgroundColor: 0x121620, antialias: true, resolution: Math.min(devicePixelRatio, 2) * Math.min(1, el('stage').clientWidth / 1000), autoDensity: true });
el('stage').prepend(app.canvas);
const resize = new ResizeObserver(() => {
  app.renderer.resolution = Math.min(devicePixelRatio, 2) * Math.min(1, el('stage').clientWidth / 1000);
  app.renderer.resize(1000, 580);
  app.canvas.style.width = app.canvas.style.height = '100%';
});
resize.observe(el('stage'));
const world = new Container(); app.stage.addChild(world);
const floor = new Graphics();
for (let x = -700; x < 1500; x += 100) { floor.moveTo(x, 580).lineTo(x + 500, 80); floor.moveTo(x, 80).lineTo(x + 500, 580); }
floor.stroke({ color: 0x8595b0, width: 1, alpha: 0.09 });
floor.ellipse(500, 370, 360, 145).stroke({ color: 0x9aa5bd, alpha: 0.12, width: 1 });
world.addChild(floor);
const from = { x: 300, y: 365 }, to = { x: 660, y: 365 };
for (const [point, color] of [[from, 0x9ac5ca], [to, 0xc7a67d]] as const) {
  const unit = new Graphics().ellipse(point.x, point.y + 2, 31, 12).fill({ color: 0, alpha: 0.35 })
    .ellipse(point.x, point.y, 36, 14).stroke({ color, alpha: 0.35, width: 1 })
    .poly([point.x - 19, point.y - 8, point.x - 15, point.y - 55, point.x, point.y - 69, point.x + 15, point.y - 55, point.x + 19, point.y - 8]).fill({ color, alpha: 0.18 }).stroke({ color, alpha: 0.6, width: 1 })
    .circle(point.x, point.y - 82, 12).fill({ color, alpha: 0.3 }).stroke({ color, alpha: 0.8, width: 1 });
  world.addChild(unit);
}
const vfx = await VfxPlayer.create(app, { shake: { target: world }, hitstop: true });
const response = await fetch(`${base}packs/free/index.json`); if (!response.ok) throw Error('Collection index unavailable');
const packs: Entry[] = await response.json();
let selected = packs.find(p => p.id === 'hoa-fireball')!, current: Playback | undefined, filter = 'all', request = 0;
let audio: AudioContext | undefined;
const colors: Record<string, string> = { kim: '#d6b477', moc: '#9cbe85', thuy: '#83bfd6', hoa: '#ed9674', tho: '#c6a783', phong: '#91c9b8', loi: '#b6a2e0', neutral: '#b1afbf' };
const labels: Record<string, string> = { all: 'All elements', kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', phong: 'Phong', loi: 'Lôi', neutral: 'Utility' };
const icons: Record<string, string> = { kim: '✧', moc: '❋', thuy: '❄', hoa: '♨', tho: '◈', phong: '≋', loi: 'ϟ', neutral: '⌘' };
function renderList() {
  el('filters').replaceChildren(...Object.entries(labels).map(([key, name]) => {
    const button = document.createElement('button'); button.textContent = name; button.className = filter === key ? 'active' : ''; button.setAttribute('aria-pressed', String(filter === key));
    button.onclick = () => { filter = key; renderList(); }; return button;
  }));
  const query = el<HTMLInputElement>('search').value.toLocaleLowerCase();
  const visible = packs.filter(p => (filter === 'all' || p.element === filter) && `${p.name.en} ${p.name.vi}`.toLocaleLowerCase().includes(query));
  el('list').replaceChildren(...visible.map(p => {
    const button = document.createElement('button'); button.className = `skill ${p.id === selected.id ? 'selected' : ''}`; button.style.setProperty('--element', colors[p.element]);
    button.innerHTML = `<span class="skill-icon">${icons[p.element]}</span><span><strong></strong><small></small></span><span class="arrow">↗</span>`;
    button.querySelector('strong')!.textContent = p.name.en; button.querySelector('small')!.textContent = p.name.vi;
    button.setAttribute('aria-pressed', String(p.id === selected.id)); button.onclick = () => { selected = p; renderSelection(); void cast(); }; return button;
  }));
  if (!visible.length) el('list').textContent = 'No effects found. Try another name.';
}
function renderSelection() {
  el('selected-name').textContent = selected.name.en; el('selected-vi').textContent = selected.name.vi;
  el('category').textContent = `LIVE PREVIEW / ${labels[selected.element].toUpperCase()} / ${selected.category.toUpperCase()}`;
  el('snippet').textContent = `const vfx = await VfxPlayer.create(app, { packs: ['packs/free/${selected.id}.vfxb'] });\nvfx.play('${selected.id}', { from: caster, to: target });`;
  renderList();
}
async function cast() {
  const token = ++request, pack = selected; current?.stop(); el('status').textContent = 'Loading pack…';
  try {
    for (const other of packs) if (other.id !== pack.id) vfx.unload(other.id);
    if (el<HTMLInputElement>('sound').checked) { audio ??= new AudioContext(); await audio.resume(); }
    await vfx.load(`${base}packs/free/${pack.id}.vfxb`);
    if (token !== request) { if (pack.id !== selected.id) vfx.unload(pack.id); return; }
    current = vfx.play(pack.id, { from, to, parent: world, loop: el<HTMLInputElement>('loop').checked });
    el('status').textContent = 'Playing';
    await current.finished; if (token === request) el('status').textContent = 'Ready to replay';
  } catch (error) { el('status').textContent = `Could not play: ${String(error)}`; }
}
vfx.on('cue', (cue: CueEvent) => {
  if (cue.type !== 'sound' || !el<HTMLInputElement>('sound').checked || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
  oscillator.type = cue.id === 'impact' ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(cue.id === 'impact' ? 100 : cue.id === 'release' ? 420 : 260, now);
  oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.18); gain.gain.setValueAtTime(0.04, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(now + 0.23); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
});
el('replay').onclick = () => void cast(); el('stage').onclick = () => void cast();
el('loop').onchange = () => void cast();
el('shake').onchange = () => { vfx.shakeEnabled = el<HTMLInputElement>('shake').checked; };
el('search').oninput = renderList;
el('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(el('snippet').textContent!); el('copy').textContent = 'Copied ✓'; setTimeout(() => { el('copy').textContent = 'Copy code ↗'; }, 1600); }
  catch { el('copy').textContent = 'Select the code to copy'; }
};
window.addEventListener('keydown', event => { if (event.code === 'Space' && !['INPUT', 'BUTTON', 'TEXTAREA', 'A'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); void cast(); } });
renderSelection();
try { await vfx.load(`${base}packs/free/${selected.id}.vfxb`); el('status').textContent = 'Ready to cast'; }
catch { el('status').textContent = 'Pack download failed. Tap Replay to retry.'; }
(window as any).__showcase = { vfx, app, packs, from, to, world, cast, select(id: string) { selected = packs.find(p => p.id === id)!; renderSelection(); } };
window.addEventListener('pagehide', () => { resize.disconnect(); vfx.destroy(); void audio?.close(); app.destroy(true, { children: true }); }, { once: true });
