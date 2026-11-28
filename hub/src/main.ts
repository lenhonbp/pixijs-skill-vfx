// Progressive enhancement only: every card, link and number is already in the HTML.
// This adds tabs, filters, search and the hover previews (lazy-loaded on intent).
import './style.css';

type Kind = 'vfx' | 'props';
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ───────────── Explorer: tabs, element chips, search ─────────────
const tabs = $$<HTMLButtonElement>('[data-tab]');
const panels = new Map($$('[data-panel]').map(p => [p.dataset.panel as Kind, p]));
const chipsRow = $('[data-chips="vfx"]');
const search = $<HTMLInputElement>('[data-search]');
const count = $('[data-count]');
const empty = $('[data-empty]');
const state = { tab: 'vfx' as Kind, element: 'all', query: '' };

function apply() {
  const q = state.query.trim().toLowerCase();
  let shown = 0, total = 0;
  for (const [kind, panel] of panels) {
    const active = kind === state.tab;
    panel.hidden = !active;
    if (!active) continue;
    for (const card of $$('[data-card]', panel)) {
      total++;
      const match = (kind !== 'vfx' || state.element === 'all' || card.dataset.group === state.element) && (!q || card.dataset.terms!.includes(q));
      card.hidden = !match;
      if (match) shown++;
      else stopPreview(card.querySelector<HTMLElement>('[data-preview]'));
    }
  }
  for (const tab of tabs) {
    const selected = tab.dataset.tab === state.tab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  chipsRow.hidden = state.tab !== 'vfx';
  for (const chip of $$('[data-chip]', chipsRow)) chip.setAttribute('aria-pressed', String(chip.dataset.chip === state.element));
  count.textContent = shown === total ? `${total} assets` : `${shown} of ${total} assets`;
  empty.classList.toggle('hidden', shown > 0);
  $('[data-empty-query]', empty).textContent = q ? `“${state.query.trim()}”` : 'this filter';
}

function selectTab(kind: Kind, focus = false) {
  state.tab = kind;
  apply();
  if (focus) $(`[data-tab="${kind}"]`).focus();
  history.replaceState(null, '', kind === 'props' ? '#props' : '#vfx');
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab as Kind));
  tab.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = tabs.indexOf(tab);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next].dataset.tab as Kind, true);
  });
}
chipsRow.addEventListener('click', e => {
  const chip = (e.target as Element).closest<HTMLElement>('[data-chip]');
  if (!chip) return;
  state.element = chip.dataset.chip!;
  apply();
});
search.addEventListener('input', () => { state.query = search.value; apply(); });
$('[data-reset]').addEventListener('click', () => { state.element = 'all'; state.query = ''; search.value = ''; apply(); search.focus(); });

// Deep links: /#props or /#vfx open the explorer on that tab.
function fromHash() {
  const h = location.hash.slice(1);
  if (h === 'props' || h === 'vfx') {
    state.tab = h;
    apply();
    $('#assets').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
}
addEventListener('hashchange', fromHash);
apply();
fromHash();

// ───────────── Hover previews ─────────────
// VFX cards swap the poster for a looping capture; props cards run an 8-facing turntable.
// Media loads only on intent (hover, focus or tap), so the grid costs just its posters.
function startPreview(preview: HTMLElement | null) {
  if (!preview || preview.classList.contains('is-playing')) return;
  const video = preview.querySelector<HTMLVideoElement>('video[data-src]');
  if (video) {
    if (!video.src) video.src = video.dataset.src!;
    preview.classList.add('is-playing');
    video.play().catch(() => preview.classList.remove('is-playing'));
    return;
  }
  const strip = preview.querySelector<HTMLElement>('[data-spin]');
  if (strip) {
    if (!strip.style.backgroundImage) strip.style.backgroundImage = `url("${strip.dataset.spin}")`;
    preview.classList.add('is-playing');
  }
}
function stopPreview(preview: HTMLElement | null) {
  if (!preview || !preview.classList.contains('is-playing')) return;
  preview.classList.remove('is-playing');
  const video = preview.querySelector('video');
  if (video) { video.pause(); video.currentTime = 0; }
}

for (const card of $$('[data-card]')) {
  const preview = card.querySelector<HTMLElement>('[data-preview][data-hover]');
  if (!preview) continue;
  card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') startPreview(preview); });
  card.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') stopPreview(preview); });
  // Keyboard focus previews too; a tap's focus does not (the tap's click toggles instead).
  card.addEventListener('focusin', e => { if ((e.target as Element).matches(':focus-visible')) startPreview(preview); });
  card.addEventListener('focusout', e => { if (!card.contains(e.relatedTarget as Node)) stopPreview(preview); });
  // Touch: tap the preview to toggle.
  preview.addEventListener('click', () => (preview.classList.contains('is-playing') ? stopPreview(preview) : startPreview(preview)));
}

// Hero console: loops automatically unless the visitor prefers reduced motion.
const hero = $('[data-hero]');
const heroToggle = $<HTMLButtonElement>('[data-hero-toggle]');
function setHero(playing: boolean) {
  if (playing) startPreview(hero); else stopPreview(hero);
  heroToggle.setAttribute('aria-pressed', String(playing));
  $('[data-label]', heroToggle).textContent = playing ? 'Pause loop' : 'Play loop';
}
heroToggle.addEventListener('click', () => setHero(!hero.classList.contains('is-playing')));
if (!reducedMotion.matches) {
  const start = () => setHero(true);
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2500 }); else setTimeout(start, 1200);
}
// Pause the hero loop while it is off-screen.
new IntersectionObserver(([entry]) => {
  const video = hero.querySelector('video');
  if (!video || !hero.classList.contains('is-playing')) return;
  if (entry.isIntersecting) void video.play().catch(() => {}); else video.pause();
}).observe(hero);

// Close the mobile menu after choosing an in-page link.
const menu = $<HTMLDetailsElement>('[data-menu]');
menu.addEventListener('click', e => { if ((e.target as Element).closest('a')) menu.open = false; });
