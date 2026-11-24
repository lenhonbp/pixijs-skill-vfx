// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';
import type { Spritesheet } from 'pixi.js';
import { VfxPlayer, packDirection } from '../../runtime/src/index';
import type { Playback, CueEvent } from '../../runtime/src/index';
import './style.css';
import { createStage } from './stage';
import { resolveCatalog } from './catalog';
import type { CatalogProduct } from './catalog';
import { createCatalogView } from './catalog-view';
import { zip } from './zip';
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
interface Entry extends Variant { id: string; name: { en: string; vi: string }; element: string; category: string; directions?: Record<string, Variant> }
const base = import.meta.env.BASE_URL;
// Free packs are same-origin by default. Set VITE_PACKS_URL (e.g. a CDN/R2 public URL) at build time to serve them elsewhere; the host must send CORS headers for this origin.
const packsBase = ((import.meta.env.VITE_PACKS_URL as string | undefined)?.trim() || `${base}packs/free`).replace(/\/+$/, '') + '/';
function arrowIcon(degrees: number, size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" transform="rotate(${degrees} 12 12)"/></svg>`;
}
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<a class="skip-link" href="#library">Skip to the effect library</a>
<header class="site-header">
  <a class="brand" href="#" aria-label="VFX Store home">
    <svg class="brand-mark" viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true"><path d="M16 4.7 27.89 13.34 23.35 27.31H8.65L4.11 13.34Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 4.7 23.35 27.31 4.11 13.34H27.89L8.65 27.31Z" stroke="currentColor" stroke-width="0.9" stroke-linejoin="round" opacity=".4"/><circle cx="16" cy="4.7" r="2" fill="#ed9674"/><circle cx="27.89" cy="13.34" r="2" fill="#c6a783"/><circle cx="23.35" cy="27.31" r="2" fill="#d6b477"/><circle cx="8.65" cy="27.31" r="2" fill="#83bfd6"/><circle cx="4.11" cy="13.34" r="2" fill="#9cbe85"/></svg>
    <span>VFX <b>STORE</b></span><small>AN EFFECT LIBRARY</small>
  </a>
  <nav aria-label="Main navigation"><a href="#library">Browse effects</a><a href="https://github.com/lenhonbp/pixijs-skill-vfx/tree/main/runtime">Runtime docs</a><a href="https://github.com/lenhonbp/pixijs-skill-vfx">GitHub <span aria-hidden="true">${arrowIcon(-45, 12)}</span></a></nav>
</header>
<main>
  <section class="intro" aria-labelledby="intro-title">
    <div class="intro-copy"><p class="eyebrow">THE FREE COLLECTION <span aria-hidden="true">/</span> PIXIJS 7 + 8</p><h1 id="intro-title">A little magic.<br><em>A lot of impact.</em></h1><p class="lede">Game-ready 2.5D effects, made for your next world.<br>Preview every angle. Find your effect. Make it yours.</p></div>
    <div class="intro-note"><p class="eyebrow">CRAFTED TO BE SHARED</p><div class="collection-stat"><strong>25</strong><span>effects.<br>All free.</span></div><p>MIT-licensed packs &amp; runtime.<br>Ready to use in your own game.</p><a href="#library">Explore the collection <span aria-hidden="true">${arrowIcon(90, 12)}</span></a></div>
  </section>
  <section id="library" class="library" aria-label="Interactive effect library">
    <aside aria-labelledby="catalog-heading">
      <div class="section-heading catalog-heading"><h2 id="catalog-heading" tabindex="-1">Browse effects</h2><span id="catalog-count" aria-live="polite">Loading…</span></div>
      <div id="catalog-access" role="group" aria-label="Product access" hidden></div>
      <label class="sr-only" for="collection-filter" hidden>Collection</label><select id="collection-filter" aria-label="Collection" hidden></select>
      <div class="search-field"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><label class="sr-only" for="search">Search effects and collections</label><input id="search" placeholder="Find an effect…" type="search" autocomplete="off"></div>
      <div id="filters" role="group" aria-label="Element filters"></div>
      <div id="list" class="skill-list" aria-label="Effects"></div>
      <p class="catalog-footnote">Every effect in this collection is free.</p>
    </aside>
    <div class="viewer">
      <div class="dock">
      <div class="arena-header"><div class="effect-heading"><p class="eyebrow" id="category">LIVE PREVIEW</p><h2><span id="selected-name">Loading collection…</span><span id="product-badge" class="product-badge"></span></h2><p id="selected-vi"></p></div><button id="browse" class="browse" type="button">Browse <span aria-hidden="true">${arrowIcon(90, 12)}</span></button></div>
      <div class="stage-wrap">
        <div id="stage" data-bg="stage" tabindex="0" role="group" aria-label="Effect preview arena"><div class="arena-tip"><span class="tip-mouse">Click</span><span class="tip-touch">Tap</span> the floor to aim and cast<span class="tip-keys"> <span aria-hidden="true">·</span> <kbd>SPACE</kbd> to replay <span aria-hidden="true">·</span> <kbd>ARROWS</kbd> to aim</span></div></div>
        <div class="stage-tools"><div class="tool-group direction-group"><span class="tool-label" aria-hidden="true">Direction</span><div class="aim-toolbar" id="aim" role="group" aria-label="Cast direction"></div></div><div class="tool-group background-group"><span class="tool-label" aria-hidden="true">Backdrop</span><div class="stage-toolbar" role="group" aria-label="Preview background"><button type="button" data-bg="stage" title="Painted stage">Stage</button><button type="button" data-bg="dark" title="Dark #0e1118">Dark</button><button type="button" data-bg="light" title="Light">Light</button><button type="button" data-bg="checker" title="Transparent checkerboard: inspect additive glow and alpha">Alpha</button></div></div></div>
      </div>
      <div class="controls"><button id="replay" type="button"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.6 7.8M4 4v6h6"/></svg>Replay</button><label><input id="loop" type="checkbox"> Loop</label><label><input id="sound" type="checkbox"> Sound</label><label><input id="shake" type="checkbox" checked> Shake</label><span id="status" role="status" aria-live="polite">Loading…</span></div>
      </div>
      <div class="actions"><button id="download-kit" class="kit" type="button">Download kit (.zip) <span></span></button><button id="copy-url" type="button">Copy asset URL</button><button id="copy" type="button">Copy code</button></div>
      <div id="premium-preview" class="premium-preview" hidden></div>
      <div id="premium-actions" class="premium-actions" hidden>
        <p id="coming-soon"><strong>Coming soon</strong><span id="coming-soon-note">Pack contents, pricing and purchase links will be announced at launch.</span></p>
        <div id="purchase-links" class="purchase-links"></div><p id="purchase-note" hidden>Checkout and full pack delivery are handled by the store.</p>
      </div>
    </div>
    <div class="details">
      <p id="description" class="effect-description"></p>
      <section class="product-info" aria-label="Product details">
        <div class="product-meta"><span id="product-collection"></span><span id="product-status" class="release-status"></span></div>
        <div class="product-specs"><div><h3 id="product-includes-title">In the download kit</h3><ul id="product-includes"></ul></div><div><h3>Compatibility</h3><ul id="product-compatibility"></ul></div></div>
        <p id="product-license" class="product-license"></p>
      </section>
      <div id="integration" class="integration"><div class="section-heading"><h3>From preview to your game</h3><span>npm i @lenhonbp/pixijs-vfx-runtime</span></div><pre><code id="snippet"></code></pre><div class="downloads" aria-label="Download the selected pack"><a id="download-desktop" download>Desktop pack <span></span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg></a><a id="download-mobile" download>Mobile pack <span></span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg></a></div><p class="integration-note">Individual packs follow the selected cast direction. The complete kit includes every direction.</p><div class="documentation-links"><a href="https://github.com/lenhonbp/pixijs-skill-vfx/blob/main/runtime/README.md">Runtime documentation <span aria-hidden="true">${arrowIcon(-45, 12)}</span></a><a href="https://github.com/lenhonbp/pixijs-skill-vfx/tree/main/skills/lenhon-vfx">Agent skill <span aria-hidden="true">${arrowIcon(-45, 12)}</span></a></div></div>
    </div>
  </section>
  <section id="premium" hidden aria-label="Future collections"><div id="premium-grid" class="premium-grid"></div></section>
  <p class="collection-note">Premium collections are planned for later. <span>This entire collection is free.</span></p>
  <footer><div class="footer-main"><span class="footer-brand">VFX <b>STORE</b><span>© 2026 VFX Store</span></span><nav aria-label="Footer navigation"><a href="https://opensource.org/license/mit">MIT license</a><a href="https://github.com/lenhonbp/pixijs-skill-vfx">GitHub</a><a href="https://github.com/lenhonbp/pixijs-skill-vfx/issues">Report an issue</a><a href="mailto:lenhon.vfx@gmail.com">Get in touch <span aria-hidden="true">${arrowIcon(-45, 12)}</span></a></nav></div><p>All 25 effect packs and the runtime are free under MIT. Character artwork © 2026 lenhonbp is separate and excluded from the MIT license.</p></footer>
</main>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
// Start the network work that does not need the renderer now, so it overlaps with renderer start-up
// instead of queueing behind it: the collection index, the caster sheet and the first pack.
const indexRequest = fetch(`${packsBase}index.json`).then(response => {
  if (!response.ok) throw Error('Collection index unavailable');
  return response.json() as Promise<Entry[]>;
});
indexRequest.catch(() => {}); // the failure is raised where the index is awaited below
const sheetRequest = Assets.load<Spritesheet>(`${base}actors/ngu-hanh-sword/son-ha-kiem-khi-se.json`);
sheetRequest.catch(() => {}); // handled where it is awaited below
void indexRequest.then(list => {
  if (location.hash.startsWith('#product/')) return;
  const entry = list.find(p => p.id === location.hash.slice(1).split('/')[0]) ?? list.find(p => p.id === 'hoa-fireball');
  if (!entry) return;
  // Same file the first cast loads (direction 0, desktop or mobile tier); the browser reuses the preloaded response.
  const mobile = matchMedia('(max-width:720px)').matches || (devicePixelRatio > 1.5 && innerWidth < 900);
  const link = document.createElement('link');
  link.rel = 'preload'; link.as = 'fetch'; link.crossOrigin = 'anonymous';
  link.href = new URL(`${packsBase}${entry.id}${mobile ? '.m' : ''}.vfxb`, location.href).href;
  document.head.append(link);
}).catch(() => {});
const app = new Application();
await app.init({ width: 1000, height: 580, backgroundColor: 0x0e1118, antialias: true, resolution: Math.min(devicePixelRatio, 2) * el('stage').clientWidth / 1000, autoDensity: true });
el('stage').prepend(app.canvas);
const resize = new ResizeObserver(() => {
  const width = el('stage').clientWidth;
  if (!width) return; // A Premium product hides the live stage.
  app.renderer.resolution = Math.min(devicePixelRatio, 2) * width / 1000;
  app.renderer.resize(1000, 580);
  app.canvas.style.width = app.canvas.style.height = '100%';
  // On a phone-sized stage the camera moves in a little so the units and effects are larger; clicks use the same transform.
  const zoom = width < 640 ? 1.22 : 1;
  app.stage.scale.set(zoom);
  app.stage.pivot.set(zoom === 1 ? 0 : CENTRE.x, zoom === 1 ? 0 : CENTRE.y - 5);
  app.stage.position.set(zoom === 1 ? 0 : 500, zoom === 1 ? 0 : 300);
});
resize.observe(el('stage'));
const world = new Container(); app.stage.addChild(world);
// Caster and target sit on a 360 px ground ring around the stage centre; the camera squashes ground depth by 0.6.
const SQUASH = 0.6, RANGE = 360, CENTRE = { x: 480, y: 350 };
const from = { x: 0, y: 0 }, to = { x: 0, y: 0 };
let aim = 0;
function placeActors() {
  const a = aim * Math.PI / 180, vx = Math.cos(a) * RANGE, vy = Math.sin(a) * RANGE * SQUASH;
  Object.assign(from, { x: Math.round(CENTRE.x - vx / 2), y: Math.round(CENTRE.y - vy / 2) });
  Object.assign(to, { x: Math.round(CENTRE.x + vx / 2), y: Math.round(CENTRE.y + vy / 2) });
}
placeActors();
const scene = createStage(world, from, to, { head: heroTexture('head'), torso: heroTexture('torso'), legs: heroTexture('legs'), staff: heroTexture('staff'), dummy: dummyTexture() }, { centre: CENTRE, range: RANGE, squash: SQUASH });
try {
  const sheet = await sheetRequest;
  scene.setCaster(sheet.animations['son-ha-kiem-khi-se']);
} catch (error) { console.warn('Character sheet unavailable; using drawn caster.', error); }
const vfx = await VfxPlayer.create(app, { shake: { target: world }, hitstop: true });
const packs = await indexRequest;
const products = resolveCatalog(packs);
let selected = packs.find(p => p.id === 'hoa-fireball')!, current: Playback | undefined, request = 0;
let activeProduct = products.find(p => p.tier === 'free' && p.packId === selected.id)!;
function readHash() {
  const parts = location.hash.slice(1).split('/');
  const product = parts[0] === 'product'
    ? products.find(p => p.tier === 'premium' && p.id === parts[1])
    : products.find(p => p.tier === 'free' && p.packId === parts[0]);
  if (!product) return false;
  activeProduct = product;
  if (product.tier === 'free') selected = packs.find(p => p.id === product.packId)!;
  return true;
}
if (!readHash() && location.hash.startsWith('#product/')) history.replaceState(null, '', '#' + selected.id);
const selectedId = () => selected.id;
const formatBytes = (bytes: number) => bytes >= 1000000 ? (bytes / 1000000).toFixed(2) + ' MB' : Math.round(bytes / 1000) + ' KB';
const sizeLabel = () => { const v = variantOf(selected, castDirection()); return formatBytes((mobileAsset() ? v.mobileBytes : v.desktopBytes) ?? v.bytes); };
function loading(active: boolean) {
  el('status').classList.toggle('is-loading', active); el('stage').setAttribute('aria-busy', String(active));
  if (active) el('status').textContent = 'Loading · ' + sizeLabel();
}
const resident = new Set<string>();
function unloadOthers(id: string) {
  for (const other of resident) if (other !== id) { vfx.unload(other); resident.delete(other); }
}
const bakedDirections = (p: Entry) => [0, ...Object.keys(p.directions ?? {}).map(Number)];
const castDirection = () => packDirection(from, to, SQUASH, bakedDirections(selected)).direction;
const fileOf = (id: string, direction: number, mobile: boolean) => `${id}${direction ? '@' + direction : ''}${mobile ? '.m' : ''}.vfxb`;
const variantOf = (p: Entry, direction: number): Variant => (direction ? p.directions?.[direction] : undefined) ?? p;
async function loadSelected(id: string, token: number) {
  const direction = castDirection();
  resident.add(id);
  if (!vfx.directions(id).includes(direction)) {
    try { await vfx.load(packUrl(id, direction)); }
    catch (error) {
      if (token !== request || activeProduct.tier !== 'free' || id !== selectedId()) return false;
      // Returning to a pack can join the request cancelled when its preview was left.
      if (!(error instanceof Error) || error.message !== `VFX load cancelled: ${id}`) throw error;
      await vfx.load(packUrl(id, direction));
    }
  }
  if (activeProduct.tier !== 'free' || id !== selectedId()) { vfx.unload(id); resident.delete(id); return false; }
  return token === request;
}
let audio: AudioContext | undefined;
async function enableAudio() { audio ??= new AudioContext(); await audio.resume(); }
const colors: Record<string, string> = { kim: '#d6b477', moc: '#9cbe85', thuy: '#83bfd6', hoa: '#ed9674', tho: '#c6a783', phong: '#91c9b8', loi: '#b6a2e0', neutral: '#b1afbf' };
const mobileAsset = () => matchMedia('(max-width:720px)').matches || (devicePixelRatio > 1.5 && innerWidth < 900);
const packUrl = (id: string, direction = 0) => `${packsBase}${fileOf(id, direction, mobileAsset())}`;
const labels: Record<string, string> = { all: 'All', kim: 'Metal', moc: 'Wood', thuy: 'Water', hoa: 'Fire', tho: 'Earth', phong: 'Wind', loi: 'Thunder', neutral: 'Utility' };
const native: Record<string, string> = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', phong: 'Phong', loi: 'Lôi', neutral: 'Tiện ích' };
const icons: Record<string, string> = { kim: '✧', moc: '❋', thuy: '❄', hoa: '♨', tho: '◈', phong: '≋', loi: 'ϟ', neutral: '⌘' };
const catalogView = createCatalogView(products, { colors, labels, native, icons }, product => showProduct(product));
function renderList() { catalogView.renderList(activeProduct); }
function showProduct(product: CatalogProduct, play = true) {
  ++request;
  current?.stop(); current = undefined; scene.reset(); loading(false);
  activeProduct = product;
  if (product.tier === 'free') {
    selected = packs.find(p => p.id === product.packId)!;
    renderSelection();
    if (play) { app.start(); void cast(); }
  } else {
    unloadOthers(''); app.stop(); renderSelection();
  }
}
function renderSelection() {
  catalogView.renderProduct(activeProduct);
  el('selected-name').textContent = activeProduct.name.en;
  el('selected-vi').textContent = activeProduct.name.vi === activeProduct.name.en ? '' : activeProduct.name.vi;
  el('description').textContent = activeProduct.description;
  const hash = activeProduct.tier === 'free' ? '#' + selected.id : '#product/' + activeProduct.id;
  const legacyFreeHash = activeProduct.tier === 'free' && location.hash.startsWith('#' + selected.id + '/');
  if (location.hash !== hash) history[legacyFreeHash ? 'replaceState' : 'pushState'](null, '', hash);
  if (activeProduct.tier === 'premium') {
    el('category').textContent = 'PREMIUM / COLLECTION';
    el('snippet').textContent = '';
    for (const tier of ['desktop', 'mobile']) el('download-' + tier).removeAttribute('href');
    renderList(); return;
  }
  const id = selectedId();
  el('category').textContent = `LIVE PREVIEW / ${labels[selected.element].toUpperCase()} · ${native[selected.element].toUpperCase()} / ${selected.category.toUpperCase()}`;
  el('snippet').textContent = selected.directions
    ? `// Load the bake nearest the cast's ground direction (0, ±45, ±90; left casts mirror)\nconst { direction } = packDirection(caster, target, groundSquash);\nawait vfx.load(\`packs/free/${id}\${direction ? '@' + direction : ''}.vfxb\`);\nvfx.play('${id}', { from: caster, to: target, groundSquash });`
    : `const vfx = await VfxPlayer.create(app, { packs: ['packs/free/${id}.vfxb'] });\nvfx.play('${id}', { from: caster, to: target });`;
  const direction = castDirection(), variant = variantOf(selected, direction);
  for (const [tier, mobile, bytes] of [['desktop', false, variant.desktopBytes ?? variant.bytes], ['mobile', true, variant.mobileBytes]] as const) {
    const link = el<HTMLAnchorElement>('download-' + tier), file = fileOf(id, direction, mobile);
    link.href = `${packsBase}${file}`; link.download = file;
    link.title = `Download ${file}`; link.querySelector('span')!.textContent = bytes ? '· ' + formatBytes(bytes) : '';
  }
  const kit = el('download-kit');
  const kitBytes = bakedDirections(selected).reduce((n, d) => { const v = variantOf(selected, d); return n + (v.desktopBytes ?? v.bytes) + (v.mobileBytes ?? 0); }, 0);
  kit.dataset.label = `Download kit (.zip) <span>· ${formatBytes(kitBytes)}</span>`;
  if (!kit.dataset.timer) kit.innerHTML = kit.dataset.label;
  renderList();
}
async function cast() {
  if (activeProduct.tier !== 'free') return;
  const token = ++request, id = selectedId();
  current?.stop(); current = undefined; scene.reset(); loading(true); unloadOthers(id);
  try {
    if (el<HTMLInputElement>('sound').checked) await enableAudio();
    if (token !== request) return;
    if (!await loadSelected(id, token) || token !== request) return;
    loading(false);
    const movement = ['kim-golden-edge', 'phong-whirlwind', 'phong-tailwind'].includes(selected.id);
    const manifest = vfx.getManifest(id)!;
    const release = manifest.cues.find(c => c.type === 'sound' && c.id === 'release')?.t
      ?? manifest.cues.find(c => c.type === 'sound' && ['buff', 'debuff'].includes(c.id ?? ''))?.t ?? 220;
    scene.prepare(movement ? 'movement' : selected.category === 'attack' || selected.category === 'channel' ? 'projectile' : selected.category, { release, duration: manifest.durationMs });
    current = vfx.play(id, { from, to, groundSquash: SQUASH, parent: world, loop: el<HTMLInputElement>('loop').checked });
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
window.addEventListener('hashchange', () => { if (readHash()) showProduct(activeProduct); });
el('replay').onclick = () => void cast();
el('stage').onclick = event => {
  if ((event.target as HTMLElement).closest('.aim-toolbar, .stage-toolbar')) return;
  // A click on the floor aims at the nearest of the eight stations (measured on the ground, not on the screen); near the centre it replays.
  const box = el('stage').getBoundingClientRect(), k = 1000 / box.width;
  const point = app.stage.toLocal({ x: (event.clientX - box.left) * k, y: (event.clientY - box.top) * k });
  const dx = point.x - CENTRE.x, dy = (point.y - CENTRE.y) / SQUASH;
  if (Math.hypot(dx, dy) < 60) return void cast();
  const step = Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 45) * 45;
  aimAt(step === -180 ? 180 : step || 0);
};
const aims: [number, string][] = [[-135, 'up-left'], [-90, 'up'], [-45, 'up-right'], [180, 'left'], [0, 'right'], [135, 'down-left'], [90, 'down'], [45, 'down-right']];
function aimAt(deg: number) {
  if (aim === deg) return void cast();
  aim = deg; placeActors(); scene.layout(); renderAim(); renderSelection(); void cast();
}
function renderAim() {
  el('aim').replaceChildren(...aims.map(([deg, name]) => {
    const button = document.createElement('button'); button.type = 'button'; button.innerHTML = arrowIcon(deg); button.title = `Cast ${name}`;
    button.setAttribute('aria-label', `Cast ${name}`); button.setAttribute('aria-pressed', String(deg === aim));
    button.onclick = () => aimAt(deg);
    return button;
  }));
}
renderAim();
el('loop').onchange = () => void cast();
el('sound').onchange = () => { if (el<HTMLInputElement>('sound').checked) void enableAudio().catch(() => {}); };
el('shake').onchange = () => { vfx.shakeEnabled = el<HTMLInputElement>('shake').checked; };
el('search').oninput = renderList;
el('browse').onclick = () => {
  el('library').querySelector('aside')!.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start',
  });
  el('catalog-heading').focus({ preventScroll: true });
};
function flash(id: string, text: string) {
  const button = el(id); button.dataset.label ??= button.innerHTML;
  button.textContent = text; clearTimeout(Number(button.dataset.timer));
  button.dataset.timer = String(setTimeout(() => { button.innerHTML = button.dataset.label!; delete button.dataset.timer; }, 1600));
}
async function copy(id: string, text: string) {
  try { await navigator.clipboard.writeText(text); flash(id, 'Copied ✓'); } catch { flash(id, 'Copy failed'); }
}
const assetUrl = (file: string) => new URL(`${packsBase}${file}`, location.href).href;
el('copy').onclick = () => { if (activeProduct.tier === 'free') void copy('copy', el('snippet').textContent!); };
el('copy-url').onclick = () => { if (activeProduct.tier === 'free') void copy('copy-url', assetUrl(fileOf(selectedId(), castDirection(), false))); };
el('download-kit').onclick = async () => {
  if (activeProduct.tier !== 'free') return;
  const pack = selected, id = pack.id, button = el<HTMLButtonElement>('download-kit');
  if (button.getAttribute('aria-busy') === 'true') return;
  button.setAttribute('aria-busy', 'true');
  try {
    const names = bakedDirections(pack).flatMap(d => [fileOf(id, d, false), fileOf(id, d, true)]);
    const files = await Promise.all(names.map(async name => {
      const res = await fetch(assetUrl(name)); if (!res.ok) throw Error(`${name}: HTTP ${res.status}`);
      return { name: `${id}/${name}`, data: new Uint8Array(await res.arrayBuffer()) };
    }));
    const readme = [
      `# ${pack.name.en} (${pack.name.vi})`, '', `Free VFX Store pack (MIT). Live preview: ${location.origin}${location.pathname}#${id}`, '',
      `- \`${id}.vfxb\`: desktop`, `- \`${id}.m.vfxb\`: phones and small screens`,
      ...(pack.directions ? [`- \`${id}@<direction>.vfxb\` / \`.m.vfxb\`: the same skill baked toward ${Object.keys(pack.directions).join(', ')} degrees on the ground (0 = right, 90 = toward the camera); left-facing casts mirror these`] : []), '',
      '```sh', 'npm install @lenhonbp/pixijs-vfx-runtime', '```', '',
      'Serve both files with your game (here: next to the page) and load the one that fits the device:', '',
      '```ts',
      ...(pack.directions ? [
        "import { VfxPlayer, packDirection } from '@lenhonbp/pixijs-vfx-runtime';", '',
        "const tier = matchMedia('(max-width: 720px)').matches ? '.m' : '';",
        'const vfx = await VfxPlayer.create(app);',
        '// groundSquash: ground y / screen y of your camera (0.5 for 2:1 isometric)',
        'const { direction } = packDirection(caster, target, groundSquash);',
        `await vfx.load(\`./${id}\${direction ? '@' + direction : ''}\${tier}.vfxb\`);`,
        `vfx.play('${id}', { from: caster, to: target, groundSquash });`,
      ] : [
        "import { VfxPlayer } from '@lenhonbp/pixijs-vfx-runtime';", '',
        `const pack = matchMedia('(max-width: 720px)').matches ? './${id}.m.vfxb' : './${id}.vfxb';`,
        'const vfx = await VfxPlayer.create(app, { packs: [pack] });', `vfx.play('${id}', { from: caster, to: target });`,
      ]), '```', '',
      'Docs: https://github.com/lenhonbp/pixijs-skill-vfx/blob/main/runtime/README.md', 'Support: lenhon.vfx@gmail.com', '',
    ].join('\n');
    files.push({ name: `${id}/README.md`, data: new TextEncoder().encode(readme) });
    const url = URL.createObjectURL(zip(files)), link = document.createElement('a');
    link.href = url; link.download = `vfx-store-${id}.zip`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    flash('download-kit', 'Downloaded ✓');
  } catch (error) { console.warn(error); flash('download-kit', 'Download failed · retry'); }
  finally { button.removeAttribute('aria-busy'); }
};
// Inspection backdrops are drawn inside the canvas so additive layers composite onto them as they would in a game.
const paints: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  dark: ctx => { ctx.fillStyle = '#0e1118'; ctx.fillRect(0, 0, 1240, 820); },
  light: ctx => { ctx.fillStyle = '#eef0f4'; ctx.fillRect(0, 0, 1240, 820); },
  checker: ctx => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1240, 820); ctx.fillStyle = '#d6d9e0';
    for (let y = 0; y < 820; y += 20) for (let x = (y / 20) % 2 * 20; x < 1240; x += 40) ctx.fillRect(x, y, 20, 20);
  }
};
const backdrops: Record<string, Sprite> = {};
function backdrop(mode: string) {
  if (!backdrops[mode]) {
    const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 820; paints[mode](canvas.getContext('2d')!);
    const sprite = backdrops[mode] = new Sprite(Texture.from(canvas)); sprite.position.set(-120, -120); world.addChildAt(sprite, 0);
  }
  return backdrops[mode];
}
const backgrounds = ['stage', 'dark', 'light', 'checker'];
function setBackground(mode: string) {
  if (!backgrounds.includes(mode)) mode = 'stage';
  el('stage').dataset.bg = mode; scene.backdrop.visible = mode === 'stage'; scene.compass.visible = mode === 'stage' || mode === 'dark';
  for (const key of Object.keys(paints)) if (key === mode || backdrops[key]) backdrop(key).visible = key === mode;
  document.querySelectorAll<HTMLButtonElement>('.stage-toolbar button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bg === mode)));
  try { localStorage.setItem('lenhon-vfx-bg', mode); } catch {}
}
document.querySelector<HTMLElement>('.stage-toolbar')!.onclick = event => {
  event.stopPropagation();
  const mode = (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.bg;
  if (mode) setBackground(mode);
};
let savedBackground: string | null = null;
try { savedBackground = localStorage.getItem('lenhon-vfx-bg'); } catch {}
setBackground(savedBackground ?? 'stage');
// Eight-way keyboard aiming: arrow keys (hold two for a diagonal) or the numpad, while the stage is hovered or focused so the page still scrolls elsewhere.
const heldArrows = new Set<string>();
const numpadAims: Record<string, number> = { Numpad7: -135, Numpad8: -90, Numpad9: -45, Numpad4: 180, Numpad6: 0, Numpad1: 135, Numpad2: 90, Numpad3: 45 };
window.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) return;
  if (!el('stage').matches(':hover') && !el('stage').contains(document.activeElement)) return;
  if (event.code in numpadAims) { event.preventDefault(); if (!event.repeat) aimAt(numpadAims[event.code]); return; }
  if (!event.code.startsWith('Arrow')) return;
  event.preventDefault(); heldArrows.add(event.code);
  if (event.repeat) return;
  const x = +heldArrows.has('ArrowRight') - +heldArrows.has('ArrowLeft'), y = +heldArrows.has('ArrowDown') - +heldArrows.has('ArrowUp');
  if (x || y) aimAt(Math.round(Math.atan2(y, x) * 180 / Math.PI));
});
window.addEventListener('keyup', event => heldArrows.delete(event.code));
window.addEventListener('blur', () => heldArrows.clear());
window.addEventListener('keydown', event => { if (event.code === 'Space' && !['INPUT', 'BUTTON', 'TEXTAREA', 'A', 'SELECT', 'VIDEO'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); void cast(); } });
renderSelection();
if (activeProduct.tier === 'free') {
  loading(true);
  const initialId = selectedId(), initialToken = ++request;
  try {
    if (await loadSelected(initialId, initialToken) && initialToken === request) { loading(false); el('status').textContent = 'Ready · ' + sizeLabel(); }
  } catch {
    if (initialToken === request) { loading(false); el('status').textContent = 'Pack download failed. Tap Replay to retry.'; }
  }
} else app.stop();
(window as any).__showcase = { vfx, app, packs, products, from, to, world, scene, animate: scene.animate, cast, setBackground, get current() { return current; }, audioState: () => audio?.state, select(id: string) {
  const product = products.find(p => p.id === id);
  if (!product) throw new Error('Unknown catalog product: ' + id);
  showProduct(product, false);
} };
// On phones the preview dock is pinned to the top of the screen: the backdrop choice moves into its header row, and the page
// keeps the dock's height so anchors and keyboard focus never end up underneath it.
const phone = matchMedia('(max-width:720px)');
const backdropGroup = document.querySelector<HTMLElement>('.background-group')!;
function placePreviewControls() { (phone.matches ? document.querySelector('.arena-header')! : document.querySelector('.stage-tools')!).append(backdropGroup); }
placePreviewControls(); phone.addEventListener('change', placePreviewControls);
const dock = document.querySelector<HTMLElement>('.dock')!;
const updateDockHeight = () => document.documentElement.style.setProperty('--dock-h', phone.matches ? dock.getBoundingClientRect().height + 'px' : '0px');
new ResizeObserver(updateDockHeight).observe(dock); phone.addEventListener('change', updateDockHeight);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  resize.disconnect(); vfx.destroy(); void audio?.close(); app.destroy(true, { children: true });
}, { once: true });
