// Progressive enhancement only: every card, link and number is already in the HTML.
// This adds tabs (VFX, Iso Props), element and A15 filters, search, hover previews,
// the inspector modal, in-browser downloads, and keeps only the active tab's grid in the document.
import './style.css';

type Kind = 'vfx' | 'props';
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ───────────── Explorer: tabs, element chips, A15 filter, search ─────────────
const tabs = $$<HTMLButtonElement>('[data-tab]');
const panels = new Map($$('[data-panel]').map(p => [p.dataset.panel as Kind, p]));
const chipsRow = $('[data-chips="vfx"]');
const chipButtons = $$<HTMLButtonElement>('[data-chip]', chipsRow);
const tierChip = $<HTMLButtonElement>('[data-tier-chip="a15"]');
const search = $<HTMLInputElement>('[data-search]');
const count = $('[data-count]');
const empty = $('[data-empty]');
const state = { tab: 'vfx' as Kind, element: 'all', a15: false, query: '' };

// ───────────── Lazy mount ─────────────
// Only the active tab's grid stays in the document. An inactive grid is moved into a fragment, its previews are
// stopped and its videos release their media buffers, so the browser does no layout, paint or decode for it.
// The grid is re-attached when its tab is selected. Cards keep their listeners while detached.
const stash = new Map<Kind, DocumentFragment>();
function unmount(kind: Kind) {
  const panel = panels.get(kind);
  if (!panel || stash.has(kind)) return;
  for (const card of $$('[data-card]', panel)) stopPreview(card.querySelector<HTMLElement>('[data-preview]'));
  for (const video of $$<HTMLVideoElement>('video', panel)) {
    video.pause();
    if (video.getAttribute('src')) { video.removeAttribute('src'); video.load(); }
  }
  const fragment = document.createDocumentFragment();
  while (panel.firstChild) fragment.appendChild(panel.firstChild);
  stash.set(kind, fragment);
}
function mount(kind: Kind) {
  const panel = panels.get(kind);
  const fragment = stash.get(kind);
  if (!panel || !fragment) return;
  panel.appendChild(fragment);
  stash.delete(kind);
}

function apply() {
  const kind = state.tab;
  const panel = panels.get(kind)!;
  const q = state.query.trim().toLowerCase();
  let shown = 0, total = 0;
  for (const card of $$('[data-card]', panel)) {
    total++;
    const element = kind === 'props' || state.element === 'all' || card.dataset.group === state.element;
    const tier = !state.a15 || card.dataset.tier === 'mobile';
    const match = element && tier && (!q || card.dataset.terms!.includes(q));
    card.hidden = !match;
    if (match) shown++;
    else stopPreview(card.querySelector<HTMLElement>('[data-preview]'));
  }
  for (const [k, p] of panels) p.hidden = k !== kind;
  for (const tab of tabs) {
    const selected = tab.dataset.tab === kind;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const chip of chipButtons) {
    chip.hidden = kind === 'props'; // element families apply to VFX only
    chip.setAttribute('aria-pressed', String(chip.dataset.chip === state.element));
  }
  tierChip.setAttribute('aria-pressed', String(state.a15));
  count.textContent = shown === total ? `${total} assets` : `${shown} of ${total} assets`;
  empty.classList.toggle('hidden', shown > 0);
  $('[data-empty-query]', empty).textContent = q ? `“${state.query.trim()}”` : state.a15 ? 'the A15 filter' : 'this filter';
}

function selectTab(kind: Kind, options: { focus?: boolean; hash?: boolean } = {}) {
  const previous = state.tab;
  state.tab = kind;
  if (previous !== kind) unmount(previous);
  mount(kind);
  apply();
  if (options.focus) $(`[data-tab="${kind}"]`).focus();
  if (options.hash !== false) history.replaceState(null, '', `#${kind}`);
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab as Kind));
  tab.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = tabs.indexOf(tab);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next].dataset.tab as Kind, { focus: true });
  });
}
chipsRow.addEventListener('click', e => {
  const target = e.target as Element;
  const chip = target.closest<HTMLElement>('[data-chip]');
  if (chip) { state.element = chip.dataset.chip!; apply(); return; }
  if (target.closest('[data-tier-chip]')) { state.a15 = !state.a15; apply(); }
});
search.addEventListener('input', () => { state.query = search.value; apply(); });
$('[data-reset]').addEventListener('click', () => { state.element = 'all'; state.a15 = false; state.query = ''; search.value = ''; apply(); search.focus(); });

// ───────────── Hover previews ─────────────
// VFX cards swap the poster for a looping capture; props cards run an 8-facing turntable.
// Media loads only on intent (hover or keyboard focus), so the grid costs just its posters.
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

let modal: Promise<typeof import('./preview/modal.ts')> | null = null;
const loadModal = () => (modal ??= import('./preview/modal.ts'));

for (const card of $$('[data-card]')) {
  const preview = card.querySelector<HTMLElement>('[data-preview][data-hover]');
  card.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse') return;
    startPreview(preview);
    void loadModal(); // warm the small inspector chunk before the click
  });
  card.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') stopPreview(preview); });
  // Keyboard focus previews too; a tap's focus does not.
  card.addEventListener('focusin', e => { if ((e.target as Element).matches(':focus-visible')) startPreview(preview); });
  card.addEventListener('focusout', e => { if (!card.contains(e.relatedTarget as Node)) stopPreview(preview); });
}

// ───────────── Inspector, downloads, copy ─────────────
async function inspect(id: string, from: HTMLElement | null) {
  (await loadModal()).open(id, from);
}

async function exportPack(button: HTMLButtonElement) {
  if (button.getAttribute('aria-busy') === 'true') return;
  const label = button.querySelector('[data-label]') ?? button;
  const idle = label.textContent;
  button.setAttribute('aria-busy', 'true');
  try {
    const { exportJsonWebp } = await import('./preview/export.ts');
    await exportJsonWebp(button.dataset.url!, button.dataset.export!, step => { label.textContent = step; });
    label.textContent = 'Saved';
  } catch (error) {
    console.warn(error);
    label.textContent = 'Failed, retry';
  } finally {
    button.setAttribute('aria-busy', 'false');
    setTimeout(() => { label.textContent = idle; }, 2200);
  }
}

async function copy(button: HTMLButtonElement) {
  const label = button.querySelector('[data-label]') ?? button;
  try {
    await navigator.clipboard.writeText(button.dataset.copy!);
    label.textContent = 'Copied';
  } catch {
    // No clipboard permission: select the command so it can be copied by hand.
    const source = button.parentElement?.querySelector('code');
    if (source) getSelection()?.selectAllChildren(source);
    label.textContent = 'Selected';
  }
  setTimeout(() => { label.textContent = 'Copy'; }, 1800);
}

const phone = matchMedia('(max-width: 639px), (orientation: landscape) and (max-height: 520px)'); // same query as the compact tiles in style.css

document.addEventListener('click', e => {
  const target = e.target as Element;
  const open = target.closest<HTMLElement>('[data-open-preview]');
  if (open) { void inspect(open.dataset.openPreview!, open); return; }
  // Phone tiles show only a poster, a name and the VRAM tier: the whole tile is the way into the inspector.
  const tile = target.closest<HTMLElement>('[data-card]');
  if (tile && phone.matches && !target.closest('a, button')) { tile.querySelector<HTMLElement>('[data-open-preview]')?.click(); return; }
  const exporter = target.closest<HTMLButtonElement>('button[data-export]');
  if (exporter) { void exportPack(exporter); return; }
  const copier = target.closest<HTMLButtonElement>('button[data-copy]');
  if (copier) void copy(copier);
});

// ───────────── Deep links ─────────────
// /#vfx or /#props opens the explorer on that tab; /#inspect/<id> opens that asset's inspector.
// The opener may sit in a detached grid, so it is looked up in the document first, then in the stash.
function findOpener(id: string): HTMLElement | null {
  const selector = `[data-open-preview="${CSS.escape(id)}"]`;
  const live = document.querySelector<HTMLElement>(selector);
  if (live) return live;
  for (const fragment of stash.values()) {
    const hit = fragment.querySelector<HTMLElement>(selector);
    if (hit) return hit;
  }
  return null;
}

function fromHash() {
  const h = location.hash.slice(1);
  if (h === 'vfx' || h === 'props') {
    selectTab(h);
    $('#assets').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  } else if (h.startsWith('inspect/')) {
    const id = h.slice(8);
    const opener = findOpener(id);
    const kind = opener?.closest<HTMLElement>('[data-card]')?.dataset.kind as Kind | undefined;
    if (opener && kind) {
      selectTab(kind, { hash: false });
      void inspect(id, findOpener(id));
    }
  }
}

// Start with only the active grid mounted, then apply filters and read the deep link.
for (const kind of panels.keys()) if (kind !== state.tab) unmount(kind);
apply();
addEventListener('hashchange', fromHash);
fromHash();

// ───────────── Hero console ─────────────
// Loops automatically unless the visitor prefers reduced motion.
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

// Mobile menu: closes after choosing a link, on Escape (focus returns to the button), on a tap outside it, and when
// the window grows to the desktop layout.
const menu = $<HTMLDetailsElement>('[data-menu]');
menu.addEventListener('click', e => { if ((e.target as Element).closest('a')) menu.open = false; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')?.focus(); }
});
document.addEventListener('pointerdown', e => { if (menu.open && !menu.contains(e.target as Node)) menu.open = false; });
// Same rule as the `desk` variant in style.css.
matchMedia('(min-width: 1280px), (min-width: 1024px) and (pointer: fine)').addEventListener('change', e => { if (e.matches) menu.open = false; });

// Back to top: shown once the Explorer heading has scrolled off the top, so the long phone grid is easy to leave.
// An IntersectionObserver, not a scroll listener, so scrolling does no work in script.
const toTop = $<HTMLButtonElement>('[data-to-top]');
new IntersectionObserver(([entry]) => { toTop.hidden = entry.isIntersecting || entry.boundingClientRect.top > 0; }).observe($('#assets-title'));
toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
