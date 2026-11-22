// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Application, Assets, Container, Texture } from 'pixi.js';
import type { Spritesheet } from 'pixi.js';
import { VfxPlayer } from '../../runtime/src/index';
import type { Playback, CueEvent } from '../../runtime/src/index';
import './style.css';
import { createStage } from './stage';
import details from './skill-details';
function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w * 3;
  c.height = h * 3;
  const ctx = c.getContext('2d')!; ctx.scale(3, 3);
  return [c, ctx];
}

function figurePainter(ctx: CanvasRenderingContext2D) {
  const shade = (x: number, y: number, width: number, light: string, mid: string, dark: string) => {
    const g = ctx.createLinearGradient(x, y, x + width, y + width * 0.28);
    g.addColorStop(0, light); g.addColorStop(0.4, mid); g.addColorStop(1, dark);
    return g;
  };
  const shape = (path: string, fill: string | CanvasGradient, edge = '#242431', width = 0.9) => {
    const p = new Path2D(path);
    ctx.fillStyle = fill; ctx.fill(p);
    ctx.strokeStyle = edge; ctx.lineWidth = width; ctx.stroke(p);
  };
  const line = (path: string, color: string, width = 0.7) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(new Path2D(path));
  };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  return { shade, shape, line };
}

function heroTexture(part: 'head' | 'torso' | 'legs' | 'staff') {
  const [c, ctx] = canvas(80, 120);
  const { shade, shape, line } = figurePainter(ctx);
  const gold = shade(22, 30, 35, '#fff0b0', '#cda65f', '#785139');
  const silk = shade(23, 42, 37, '#a8c7d8', '#507d99', '#293c62');
  const blue = shade(20, 45, 37, '#7089ab', '#3b527a', '#29334e');
  const skin = shade(35, 26, 13, '#ffdfb9', '#d6a783', '#956957');
  // Back hair, mantle and the planted staff.
  shape('M33 28 Q23 43 25 72 L46 79 Q55 49 45 28Z', shade(25, 30, 29, '#677082', '#353c50', '#262838'));
  shape('M29 48 Q20 60 17 91 L23 106 L34 82 L49 108 L57 103 Q52 68 48 47Z', blue);
  shape('M66 26 L69 26 L69 114 Q67 117 65 114Z', shade(65, 26, 5, '#e5c594', '#99744e', '#513e38'));
  for (const y of [32, 37, 75, 79, 108]) line(`M65.5 ${y} L69 ${y - 0.5}`, '#e4c380', 1.1);
  // Boots are visible below the separated robe panels.
  shape('M29 101 L38 101 L37 114 Q33 118 24 115 L25 112Z', shade(25, 102, 14, '#9c9ca5', '#4f5365', '#303447'));
  shape('M42 102 L50 102 L52 111 L57 114 Q56 117 43 115Z', shade(42, 102, 15, '#858796', '#4d4e62', '#2b2f40'));
  line('M25 113 L36 114 M44 113 L54 114', '#cfb483');
  // Ivory under-robe and the overlapping blue silk outer panels.
  shape('M31 59 L47 58 L52 109 Q40 114 27 109Z', shade(28, 60, 25, '#f6e8c8', '#c9c8bb', '#78818d'));
  shape('M31 58 L41 66 L36 108 Q27 111 20 107 L26 81Z', silk);
  shape('M42 62 L48 57 Q49 80 58 108 L46 110 L39 81Z', blue);
  line('M30 71 Q28 92 24 104 M34 80 L31 104 M47 77 L51 103 M42 87 L45 104', '#253750', 1.2);
  line('M28 73 L24 100 M31 77 L28 103 M48 84 L53 104', '#b9d0d9', 0.65);
  line('M21 106 Q28 109 36 107 M46 108 L57 106', '#e4c98b', 1.5);
  shape('M29 44 L37 41 L44 42 L49 47 L42 64 L33 61Z', silk);
  shape('M33 42 L39 49 L44 42 L46 46 L40 59 L29 47Z', shade(30, 43, 17, '#fff3d0', '#d7c9a6', '#8c8e91'));
  line('M31 44 L39 53 L45 45', '#f5d590', 1);
  shape('M29 61 Q39 64 48 60 L49 66 Q39 70 29 66Z', shade(29, 61, 20, '#d0a86b', '#8d6952', '#564449'));
  shape('M38 63 L43 63 L43 68 L38 68Z', gold);
  shape('M42 68 Q43 79 38 85 L36 81 L39 69Z', '#c6b287');
  // Neck, three-quarter face, swept hair and jade crown.
  shape('M37 36 L44 36 L44 44 Q41 48 36 42Z', skin);
  shape('M33 25 Q38 20 46 26 L47 32 L50 35 L47 37 Q47 43 41 43 L35 39 L32 31Z', skin);
  shape('M31 34 Q27 22 35 20 Q35 14 42 17 Q47 18 46 23 Q51 27 47 32 L44 29 L42 25 Q38 31 33 30 L34 37Z', shade(29, 20, 21, '#8d96a7', '#464c60', '#292c40'));
  line('M32 26 Q36 23 40 23 M33 28 Q38 26 41 24 M38 19 L42 19', '#adb1bb', 0.65);
  shape('M35 20 L35 17 L44 18 L45 21Z', gold);
  shape('M39 16 L42 15 L43 20 L40 21Z', '#9bd6ce');
  line('M43 32 L46 32 M45 33 L46 33', '#423d49', 0.8);
  line('M44 38 L46 38 M46 35 L47 36', '#ad7664', 0.65);
  // Gilded lotus cage around a luminous, shaded pearl.
  shape('M66 28 Q57 22 61 14 L64 19 L67 24 L71 19 L74 14 Q78 23 69 28Z', gold);
  const halo = ctx.createRadialGradient(67, 16, 2, 67, 16, 12);
  halo.addColorStop(0, 'rgba(176,238,255,0.65)'); halo.addColorStop(1, 'rgba(114,201,255,0)');
  ctx.fillStyle = halo; ctx.fillRect(55, 4, 24, 24);
  const pearl = ctx.createRadialGradient(65, 13, 0.5, 68, 17, 6);
  pearl.addColorStop(0, '#ffffff'); pearl.addColorStop(0.35, '#c6ffff'); pearl.addColorStop(0.75, '#70bacf'); pearl.addColorStop(1, '#4b6eaa');
  ctx.fillStyle = pearl; ctx.beginPath(); ctx.ellipse(67, 16, 4.8, 6, -0.2, 0, Math.PI * 2); ctx.fill();
  line('M63 24 Q67 27 72 22 M66 29 L69 29', '#fff0bd', 1);
  if (part === 'staff') ctx.clearRect(0, 0, 62, 120);
  else {
    ctx.clearRect(62, 0, 18, 120);
    const [top, bottom] = part === 'head' ? [0, 44] : part === 'torso' ? [44, 69] : [69, 120];
    ctx.clearRect(0, 0, 80, top); ctx.clearRect(0, bottom, 80, 120 - bottom);
  }
  return Texture.from(c);
}

function dummyTexture() {
  const [c, ctx] = canvas(80, 120);
  const { shade, shape, line } = figurePainter(ctx);
  const wood = shade(29, 19, 25, '#f0cc8d', '#b78650', '#6b4936');
  const iron = shade(28, 25, 27, '#a9b3b6', '#626e79', '#37404d');
  const peg = shade(40, 40, 26, '#e9c18b', '#b08050', '#70503b');
  // Low mortised stand, with two splayed feet and visible top bevels.
  shape('M20 105 L58 105 L65 113 L60 117 L16 113Z', shade(16, 104, 48, '#b99c74', '#7e6550', '#453e38'));
  shape('M25 101 L31 100 L51 114 L46 118 L21 108Z', shade(21, 101, 30, '#d2b48b', '#907155', '#504236'));
  line('M18 109 L58 113 L62 112 M25 103 L48 115', '#d1ad79', 0.8);
  shape('M33 88 L48 88 L48 110 Q41 114 32 109Z', wood);
  // Continuous lathed post, not a humanoid torso.
  shape('M29 24 Q40 17 52 24 L52 95 Q42 101 29 95Z', wood);
  line('M31 28 L31 92', '#f4d69b', 1.1);
  for (let i = 0; i < 7; i++) {
    const x = 33 + i * 2.5;
    line(`M${x} 29 C${x - 3} 46 ${x + 3} 49 ${x} 64 S${x - 2} 83 ${x} 94`, i % 2 ? '#c89b66' : '#89603f', 0.45);
  }
  shape('M29 24 C29 18 52 18 52 24 C52 30 29 30 29 24Z', '#d9b47b');
  for (const r of [3, 6, 9]) {
    ctx.strokeStyle = '#9b764d'; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.ellipse(40.5, 24, r, r * 0.29, 0, 0, Math.PI * 2); ctx.stroke();
  }
  line('M41 24 L47 22 L49 22', '#79573d', 0.6);
  // Forged bands with reflected sky light and individual rivets.
  for (const y of [31, 81]) {
    shape(`M29 ${y} Q40 ${y + 4} 52 ${y} L52 ${y + 5} Q41 ${y + 9} 29 ${y + 5}Z`, iron);
    line(`M30 ${y + 1} Q40 ${y + 4} 51 ${y + 1}`, '#c2bda9', 0.65);
    for (const x of [32, 47]) { ctx.fillStyle = '#d3cbb4'; ctx.beginPath(); ctx.arc(x, y + 3.5, 0.8, 0, Math.PI * 2); ctx.fill(); }
  }
  // Two upper striking arms, one lower arm, and an angled low leg.
  shape('M33 44 L17 38 L9 41 L11 47 L32 51Z', peg);
  shape('M44 43 L65 34 L71 36 L70 42 L48 51Z', peg);
  shape('M40 60 L64 61 L68 65 L65 70 L40 68Z', peg);
  line('M13 42 L29 47 M49 46 L66 38 M45 63 L63 65', '#f6d9a4', 1);
  shape('M38 88 L48 87 L59 98 L65 99 L67 104 L61 107 L53 103Z', peg);
  line('M43 90 L57 101 L63 102', '#e4bc87', 0.9);
  // Peg end grain and socket shadows make the arms read as solid cylinders.
  for (const [x, y, rx, ry] of [[11, 44, 2.7, 3.4], [69, 38, 2.6, 3.5], [65, 65, 2.8, 3.8]]) {
    ctx.fillStyle = '#d6af77'; ctx.strokeStyle = '#715039'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    line(`M${x - 0.8} ${y - 1.6} Q${x + 1.6} ${y} ${x - 0.5} ${y + 1.7}`, '#987044', 0.5);
  }
  for (let i = 0; i < 5; i++) line(`M30 ${72 + i * 1.45} Q40 ${76 + i * 1.45} 51 ${72 + i * 1.45}`, i % 2 ? '#e4c392' : '#8e704f', 1);
  line('M34 54 L38 57 M35 57 L39 60 M46 53 L43 56 M35 69 L38 70 M44 91 L46 94', '#f2d5a1', 0.8);
  line('M36 54 L39 56 M44 57 L46 55 M33 91 L35 86', '#79523c', 0.6);
  return Texture.from(c);
}

interface Variant { bytes: number; desktopBytes?: number; mobileBytes?: number }
interface Entry extends Variant { id: string; name: { en: string; vi: string }; element: string; category: string }
const descriptions: Record<string, { description: string }> = details;
const base = import.meta.env.BASE_URL;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><a class="brand" href="#">L<span>✦</span> / LENHON <small>VFX LIBRARY</small></a><nav><a href="#library">Free collection</a><a href="#premium">Premium packs ↗</a><a href="https://github.com/lenhonbp/pixijs-skill-vfx">GitHub ↗</a></nav></header>
<main><section class="intro"><div><p class="eyebrow">BUILT FOR PIXIJS 7 + 8 · ZERO RUNTIME DEPENDENCIES</p><h1>A little magic.<br><em>A lot of impact.</em></h1><p class="lede">Game-ready 2.5D effects. Pick a spell, see it in motion,<br> and make it yours in two lines of code.</p></div><div class="intro-note"><span class="star">✳</span><strong>Runtime is free forever (MIT)</strong><p>Commercial use welcome.<br>Just keep the MIT copyright and license notice.</p><a href="https://github.com/lenhonbp/pixijs-skill-vfx/tree/main/runtime">Explore the runtime ↗</a></div></section>
<section id="library" class="library"><aside><div class="section-heading"><h2>Free collection</h2><span>25 SKILLS</span></div><label class="sr-only" for="search">Search effects</label><input id="search" placeholder="Search a spell…" type="search"><div id="filters" aria-label="Element filters"></div><div id="list" class="skill-list" aria-label="Effects"></div></aside>
<div class="workspace"><div class="arena-header"><div><p class="eyebrow" id="category">LIVE PREVIEW / ATTACK</p><h2 id="selected-name">Loading collection…</h2><p id="selected-vi"></p></div><button id="browse" class="browse">Browse skills ↓</button></div><p id="description" class="effect-description"></p><div id="stage" aria-label="Effect preview arena"><div class="arena-label left">CASTER</div><div class="arena-label right">TARGET</div><div class="arena-tip">Click the floor to cast · SPACE to replay</div><span class="axis">2.5D / ISOMETRIC</span></div><div class="controls"><button id="replay" class="primary">↻ Replay effect</button><label><input id="loop" type="checkbox"> Loop</label><label><input id="sound" type="checkbox"> Sound</label><label><input id="shake" type="checkbox" checked> Screen shake</label><span id="status" role="status" aria-live="polite">Loading…</span></div>
<div class="integration"><div class="section-heading"><h3>From preview to your game</h3><button id="copy">Copy code ↗</button></div><pre><code id="snippet"></code></pre><p>One tiny runtime. One self-contained pack. That’s it. <a href="https://github.com/lenhonbp/pixijs-skill-vfx/blob/main/runtime/README.md">Read the docs ↗</a></p></div></div></section>
<section id="premium"><div class="premium-heading"><div><p class="eyebrow">THE NEXT CHAPTER</p><h2>More worlds. More wonder.</h2></div><p>Handcrafted collections for your next adventure.<br><span>Premium art. The same free runtime.</span></p></div><div class="premium-grid"><article style="--accent:#d6b477"><span class="pack-symbol">劍</span><p class="eyebrow">01 / MARTIAL LEGENDS</p><h3>Kiếm Hiệp</h3><p>Sword auras, flying blades and the spirit of a wandering hero.</p><div><a href="#gumroad-link-tbd">Gumroad ↗</a><a href="#itch-link-tbd">itch.io ↗</a><span>COMING SOON</span></div></article><article style="--accent:#7dbaa9"><span class="pack-symbol">五</span><p class="eyebrow">02 / FIVE ELEMENTS</p><h3>Ngũ Hành</h3><p>Metal, wood, water, fire and earth. Five forces in perfect motion.</p><div><a href="#gumroad-link-tbd">Gumroad ↗</a><a href="#itch-link-tbd">itch.io ↗</a><span>COMING SOON</span></div></article><article style="--accent:#b69ed4"><span class="pack-symbol">冥</span><p class="eyebrow">03 / FINAL ENCOUNTERS</p><h3>Ultimate Boss</h3><p>Arena-shaking ultimates for battles players will remember.</p><div><a href="#gumroad-link-tbd">Gumroad ↗</a><a href="#itch-link-tbd">itch.io ↗</a><span>COMING SOON</span></div></article></div></section>
<footer><span>© 2026 lenhonbp &lt;lenhonbp@gmail.com&gt; · <a href="https://opensource.org/license/mit">MIT license</a></span><span>Character artwork (c) 2026 lenhonbp; excluded from the MIT licence.</span></footer></main>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const app = new Application();
await app.init({ width: 1000, height: 580, backgroundColor: 0x121620, antialias: true, resolution: Math.min(devicePixelRatio, 2) * el('stage').clientWidth / 1000, autoDensity: true });
el('stage').prepend(app.canvas);
const resize = new ResizeObserver(() => {
  app.renderer.resolution = Math.min(devicePixelRatio, 2) * el('stage').clientWidth / 1000;
  app.renderer.resize(1000, 580);
  app.canvas.style.width = app.canvas.style.height = '100%';
});
resize.observe(el('stage'));
const world = new Container(); app.stage.addChild(world);
const from = { x: 300, y: 365 }, to = { x: 660, y: 365 };
const scene = createStage(world, from, to, { head: heroTexture('head'), torso: heroTexture('torso'), legs: heroTexture('legs'), staff: heroTexture('staff'), dummy: dummyTexture() });
try {
  const sheet = await Assets.load<Spritesheet>(`${base}actors/ngu-hanh-sword/son-ha-kiem-khi-se.json`);
  scene.setCaster(sheet.animations['son-ha-kiem-khi-se']);
} catch (error) { console.warn('Character sheet unavailable; using drawn caster.', error); }
const vfx = await VfxPlayer.create(app, { shake: { target: world }, hitstop: true });
const response = await fetch(`${base}packs/free/index.json`); if (!response.ok) throw Error('Collection index unavailable');
const packs: Entry[] = await response.json();
let selected = packs.find(p => p.id === 'hoa-fireball')!, current: Playback | undefined, filter = 'all', request = 0;
function readHash() {
  const pack = packs.find(p => p.id === location.hash.slice(1).split('/')[0]);
  if (!pack) return false;
  selected = pack; return true;
}
readHash();
const selectedId = () => selected.id;
const sizeLabel = () => {
  const pack = selected, bytes = (mobileAsset() ? pack.mobileBytes : pack.desktopBytes) ?? pack.bytes;
  return bytes >= 1000000 ? (bytes / 1000000).toFixed(2) + ' MB' : Math.round(bytes / 1000) + ' KB';
};
function loading(active: boolean) {
  el('status').classList.toggle('is-loading', active); el('stage').setAttribute('aria-busy', String(active));
  if (active) el('status').textContent = 'Loading · ' + sizeLabel();
}
const resident = new Set<string>();
function unloadOthers(id: string) {
  for (const other of resident) if (other !== id) { vfx.unload(other); resident.delete(other); }
}
async function loadSelected(id: string) {
  if (!resident.has(id)) { await vfx.load(packUrl(id)); resident.add(id); }
  if (id !== selectedId()) { vfx.unload(id); resident.delete(id); return false; }
  return true;
}
let audio: AudioContext | undefined;
async function enableAudio() { audio ??= new AudioContext(); await audio.resume(); }
const colors: Record<string, string> = { kim: '#d6b477', moc: '#9cbe85', thuy: '#83bfd6', hoa: '#ed9674', tho: '#c6a783', phong: '#91c9b8', loi: '#b6a2e0', neutral: '#b1afbf' };
const mobileAsset = () => matchMedia('(max-width:720px)').matches || (devicePixelRatio > 1.5 && innerWidth < 900);
const packUrl = (id: string) => `${base}packs/free/${id}${mobileAsset() ? '.m' : ''}.vfxb`;
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
    button.setAttribute('aria-pressed', String(p.id === selected.id)); button.onclick = () => { selected = p; renderSelection(); void cast(); if (matchMedia('(max-width:720px)').matches) el('library').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; return button;
  }));
  if (!visible.length) el('list').textContent = 'No effects found. Try another name.';
}
function renderSelection() {
  const id = selectedId(), info = descriptions[selected.id];
  el('selected-name').textContent = selected.name.en;
  el('selected-vi').textContent = selected.name.vi;
  el('description').textContent = info?.description ?? '';
  const hash = '#' + selected.id;
  if (location.hash !== hash) history[location.hash.slice(1).split('/')[0] === selected.id ? 'replaceState' : 'pushState'](null, '', hash);
  el('category').textContent = `LIVE PREVIEW / ${labels[selected.element].toUpperCase()} / ${selected.category.toUpperCase()}`;
  el('snippet').textContent = `const vfx = await VfxPlayer.create(app, { packs: ['packs/free/${id}.vfxb'] });\nvfx.play('${id}', { from: caster, to: target });`;
  renderList();
}
async function cast() {
  const token = ++request, id = selectedId();
  current?.stop(); current = undefined; scene.reset(); loading(true); unloadOthers(id);
  try {
    if (el<HTMLInputElement>('sound').checked) await enableAudio();
    if (token !== request) return;
    if (!await loadSelected(id) || token !== request) return;
    loading(false);
    const movement = ['kim-golden-edge', 'phong-whirlwind', 'phong-tailwind'].includes(selected.id);
    const manifest = vfx.getManifest(id)!;
    const release = manifest.cues.find(c => c.type === 'sound' && c.id === 'release')?.t
      ?? manifest.cues.find(c => c.type === 'sound' && ['buff', 'debuff'].includes(c.id ?? ''))?.t ?? 220;
    scene.prepare(movement ? 'movement' : selected.category === 'attack' || selected.category === 'channel' ? 'projectile' : selected.category, { release, duration: manifest.durationMs });
    current = vfx.play(id, { from, to, parent: world, loop: el<HTMLInputElement>('loop').checked });
    el('status').textContent = 'Playing · ' + sizeLabel();
    await current.finished;
    if (token === request) { scene.reset(); el('status').textContent = 'Ready · ' + sizeLabel(); }
  } catch (error) {
    if (token === request) { loading(false); scene.reset(); el('status').textContent = 'Could not play. Replay to retry.'; console.warn(error); }
  }
}
vfx.on('cue', (cue: CueEvent) => {
  const element = packs.find(p => p.id === cue.packId)?.element ?? 'neutral';
  scene.cue(cue, Number.parseInt((colors[element] ?? colors.neutral).slice(1), 16));
  if (cue.type !== 'sound' || !el<HTMLInputElement>('sound').checked || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
  oscillator.type = cue.id === 'impact' ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(cue.id === 'impact' ? 100 : cue.id === 'release' ? 420 : 260, now);
  oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.18); gain.gain.setValueAtTime(0.04, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(now + 0.23); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
});
app.ticker.add((ticker: any) => scene.animate(ticker.deltaMS, current?.pose('caster'), current?.pose('target'), current?.elapsedMs));
window.addEventListener('hashchange', () => { if (readHash()) { renderSelection(); void cast(); } });
el('replay').onclick = () => void cast(); el('stage').onclick = () => void cast();
el('loop').onchange = () => void cast();
el('sound').onchange = () => { if (el<HTMLInputElement>('sound').checked) void enableAudio().catch(() => {}); };
el('shake').onchange = () => { vfx.shakeEnabled = el<HTMLInputElement>('shake').checked; };
el('search').oninput = renderList;
el('browse').onclick = () => el('search').scrollIntoView({ behavior: 'smooth', block: 'start' });
el('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(el('snippet').textContent!); el('copy').textContent = 'Copied ✓'; setTimeout(() => { el('copy').textContent = 'Copy code ↗'; }, 1600); }
  catch { el('copy').textContent = 'Select the code to copy'; }
};
window.addEventListener('keydown', event => { if (event.code === 'Space' && !['INPUT', 'BUTTON', 'TEXTAREA', 'A'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); void cast(); } });
renderSelection();
loading(true);
const initialId = selectedId(), initialToken = ++request;
try {
  if (await loadSelected(initialId) && initialToken === request) { loading(false); el('status').textContent = 'Ready · ' + sizeLabel(); }
} catch {
  if (initialToken === request) { loading(false); el('status').textContent = 'Pack download failed. Tap Replay to retry.'; }
}
(window as any).__showcase = { vfx, app, packs, from, to, world, scene, animate: scene.animate, cast, get current() { return current; }, audioState: () => audio?.state, select(id: string) { selected = packs.find(p => p.id === id)!; renderSelection(); } };
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  resize.disconnect(); vfx.destroy(); void audio?.close(); app.destroy(true, { children: true });
}, { once: true });
