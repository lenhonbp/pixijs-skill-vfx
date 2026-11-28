// Interactive inspector: playback, frame scrubbing, speed, backdrop and pack tier, with a live HUD.
// Loaded on the first preview; the engines it drives load per asset kind (PixiJS only for effects).
import type { Preview } from '../data/catalog.ts';
import type { Background, Engine, Loaded, Variant } from './engine.ts';

const A15 = 45_000_000, DESKTOP_WARN = 128_000_000;
const data = JSON.parse(document.getElementById('hub-data')!.textContent!) as { previews: Record<string, Preview> };
const dialog = document.getElementById('inspector') as HTMLDialogElement;
const $ = <T extends HTMLElement = HTMLElement>(key: string) => dialog.querySelector<T>(`[data-pv-${key}]`)!;
const ui = {
  dot: $('dot'), kind: $('kind'), title: $('title'), native: $('native'), tier: $('tier'), host: $('canvas'), status: $('status'),
  play: $<HTMLButtonElement>('play'), scrub: $<HTMLInputElement>('scrub'), readout: $('readout'), packs: $('packs'), links: $('links'),
  hud: { runtime: $('runtime'), source: $('source'), vram: $('vram'), vramBar: $('vram-bar'), sheets: $('sheets'), frame: $('frame'), time: $('time'), dims: $('dims') },
  labels: { sheets: $('l-sheets'), frame: $('l-frame'), time: $('l-time'), dims: $('l-dims') },
};

const state = { id: '', token: 0, playing: true, speed: 1, bg: 'studio' as Background, variant: (matchMedia('(max-width: 720px)').matches ? 'mobile' : 'desktop') as Variant, scrubbing: false, wasPlaying: true };
let engine: Engine | null = null, loaded: Loaded | null = null, trigger: HTMLElement | null = null, returnHash = '';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;
const out = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 4.5h6v6M11.5 4.5l-7 7"/></svg>';
const down = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>';

function pressed(group: HTMLElement, attr: string, value: string) {
  for (const b of group.querySelectorAll<HTMLButtonElement>(`[${attr}]`)) b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value));
}

// Per-frame HUD: only swaps precomputed strings in, so scrubbing and playback allocate nothing here.
function onFrame(i: number) {
  if (!loaded) return;
  if (!state.scrubbing) ui.scrub.valueAsNumber = i;
  ui.hud.frame.textContent = loaded.frameLabels[i];
  ui.hud.time.textContent = loaded.timeLabels[i];
  ui.hud.dims.textContent = loaded.dimLabels[i];
  ui.readout.textContent = loaded.frameLabels[i];
}

function setPlaying(on: boolean) {
  state.playing = on;
  engine?.setPlaying(on);
  ui.play.setAttribute('aria-pressed', String(on));
  ui.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
  ui.play.dataset.state = on ? 'playing' : 'paused';
}

function vramHud(p: Preview, bytes: number) {
  const desktop = p.kind === 'vfx' && state.variant === 'desktop';
  const budget = desktop ? DESKTOP_WARN : A15;
  const scale = budget / 0.7, over = bytes > budget;
  ui.hud.vram.textContent = `${mb(bytes)} · ${desktop ? 'desktop budget 128 MB' : over ? 'over A15 45 MB' : 'A15 budget 45 MB'}`;
  ui.hud.vramBar.style.setProperty('--fill', String(Math.min(bytes / scale, 1)));
  ui.hud.vramBar.classList.toggle('is-heavy', over);
}

function links(p: Preview) {
  const live = `<a class="btn btn-primary" href="${esc(p.live)}" target="_blank" rel="noopener">Test Live ${out}</a>`;
  if (p.kind === 'vfx') {
    const pack = p.packs[state.variant];
    ui.links.innerHTML = `<a class="btn btn-ghost" href="${esc(pack.url)}" download title="Container straight from the R2 CDN">${down} .vfxb <span class="font-mono text-[10.5px] text-faint">${mb(pack.bytes)}</span></a>`
      + `<button type="button" class="btn btn-ghost" data-export="${esc(p.id)}" data-url="${esc(pack.url)}" title="Unpack the .vfxb into its .vfx.json manifest and WebP sheets">${down} <span data-label>JSON + WebP</span></button>${live}`;
  } else {
    ui.links.innerHTML = `<a class="btn btn-ghost" href="${esc(p.zip)}" download>${down} ${p.turntable ? 'WebP Atlas + JSON' : 'Starter map ZIP'} <span class="font-mono text-[10.5px] text-faint">${mb(p.zipBytes)}</span></a>${live}`;
  }
}

async function load(p: Preview) {
  const token = ++state.token;
  loaded = null;
  ui.status.hidden = false; ui.status.textContent = p.kind === 'vfx' ? `Loading ${p.packs[state.variant].url.split('/').pop()} from the R2 CDN…` : 'Loading turntable…';
  ui.scrub.disabled = true;
  try {
    if (!engine) {
      const created = p.kind === 'vfx'
        ? await (await import('./vfx-engine.ts')).createVfxEngine(ui.host, p)
        : (await import('./props-engine.ts')).createPropsEngine(ui.host, p);
      if (token !== state.token) { created.release(); return; }
      engine = created;
    }
    const e = engine;
    e.onFrame = onFrame; e.setBackground(state.bg); e.setSpeed(state.speed); e.setPlaying(state.playing);
    const info = await e.load(state.variant);
    if (token !== state.token) return;
    loaded = info;
    ui.hud.runtime.textContent = info.runtime;
    ui.hud.source.textContent = info.source;
    ui.hud.sheets.textContent = info.sheets;
    vramHud(p, info.vramBytes);
    ui.scrub.max = String(info.frames - 1);
    ui.scrub.disabled = info.frames < 2;
    ui.status.hidden = true;
    e.start();
  } catch (error) {
    if (token !== state.token) return;
    console.warn(error);
    ui.status.innerHTML = `Could not load this preview. <a class="ml-1 text-accent underline-offset-4 hover:underline" href="${esc(p.live)}" target="_blank" rel="noopener">Open it on ${esc(new URL(p.live).host)}</a>`;
  }
}

export function open(id: string, from: HTMLElement | null) {
  const p = data.previews[id];
  if (!p) return;
  engine?.stop(); engine?.release(); engine = null;
  state.id = id; trigger = from;
  if (!/^#inspect\//.test(location.hash)) returnHash = location.hash;
  history.replaceState(null, '', `#inspect/${id}`);
  ui.dot.style.background = p.color;
  ui.kind.textContent = p.kind === 'vfx' ? `VFX · ${p.group}` : `Iso Props · ${p.group}`;
  ui.title.textContent = p.title;
  ui.native.textContent = p.native;
  const mobile = p.tier === 'mobile';
  ui.tier.textContent = mobile ? 'Mobile Tier (A15 <45MB)' : 'Desktop / Heavy Tier';
  ui.tier.className = `badge hidden sm:inline-block ${mobile ? 'border-ok/30 bg-ok/5 text-ok' : 'border-warn/35 bg-warn/5 text-warn'}`;
  ui.packs.hidden = p.kind !== 'vfx';
  pressed(ui.packs, 'data-pv-pack', state.variant);
  ui.labels.sheets.textContent = p.kind === 'vfx' ? 'Sheets' : 'Grid';
  ui.labels.frame.textContent = p.kind === 'vfx' ? 'Frame' : 'Facing';
  ui.labels.time.textContent = p.kind === 'vfx' ? 'Time' : 'Yaw';
  ui.labels.dims.textContent = p.kind === 'vfx' ? 'Bounds' : 'Sprite';
  for (const el of [ui.hud.frame, ui.hud.time, ui.hud.dims, ui.readout]) el.textContent = '—';
  links(p);
  ui.host.replaceChildren();
  if (!dialog.open) { dialog.showModal(); document.documentElement.classList.add('is-modal'); }
  void load(p);
}

function close() { if (dialog.open) dialog.close(); }

dialog.addEventListener('close', () => {
  state.token++;
  // Free the pack's GPU textures; reopening fetches it again (usually from the HTTP cache).
  engine?.stop(); engine?.release(); engine = null;
  document.documentElement.classList.remove('is-modal');
  history.replaceState(null, '', returnHash || location.pathname + location.search);
  trigger?.focus({ preventScroll: true });
});
// A click on the backdrop (the dialog box itself, outside its content) closes it.
dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
$('close').addEventListener('click', close);
ui.play.addEventListener('click', () => setPlaying(!state.playing));

ui.scrub.addEventListener('pointerdown', () => { state.scrubbing = true; state.wasPlaying = state.playing; setPlaying(false); });
ui.scrub.addEventListener('input', () => {
  if (!state.scrubbing && state.playing) setPlaying(false);
  engine?.seek(ui.scrub.valueAsNumber);
});
const endScrub = () => { if (!state.scrubbing) return; state.scrubbing = false; if (state.wasPlaying) setPlaying(true); };
ui.scrub.addEventListener('pointerup', endScrub);
ui.scrub.addEventListener('pointercancel', endScrub);

$('speed').addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-pv-rate]');
  if (!b) return;
  state.speed = Number(b.dataset.pvRate); engine?.setSpeed(state.speed); pressed($('speed'), 'data-pv-rate', b.dataset.pvRate!);
});
$('bgs').addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-pv-bg]');
  if (!b) return;
  state.bg = b.dataset.pvBg as Background; engine?.setBackground(state.bg); pressed($('bgs'), 'data-pv-bg', state.bg);
  $('stage').dataset.bg = state.bg;
});
ui.packs.addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-pv-pack]');
  const p = data.previews[state.id];
  if (!b || !p || p.kind !== 'vfx' || b.dataset.pvPack === state.variant) return;
  state.variant = b.dataset.pvPack as Variant; pressed(ui.packs, 'data-pv-pack', state.variant);
  links(p);
  void load(p);
});

// Space plays/pauses, arrows step one frame (unless a control that uses those keys has focus).
dialog.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (e.key === ' ' && !t.closest('button, a, input')) { e.preventDefault(); setPlaying(!state.playing); }
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !t.closest('input') && loaded) {
    e.preventDefault(); setPlaying(false);
    const next = Math.max(0, Math.min(loaded.frames - 1, ui.scrub.valueAsNumber + (e.key === 'ArrowRight' ? 1 : -1)));
    ui.scrub.valueAsNumber = next; engine?.seek(next);
  }
});
