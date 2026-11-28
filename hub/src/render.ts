// Build-time HTML for the Asset Explorer. Vite's index.html transform calls `fill()`, so the
// deployed page ships every card as static markup; main.ts only adds tabs, filters, previews and downloads.
import { type Action, type Card, type ExportAction, type Release, type Spec, A15_DIRECTION_BUDGET, VRAM_SCALE, elements, mb, propsCards, vfxCards } from './data/catalog.ts';
import { site } from './site.config.ts';

const esc = (s: string | number) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const icon = {
  out: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 4.5h6v6M11.5 4.5l-7 7"/></svg>',
  down: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>',
  play: '<svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M4 2.8v10.4L13 8z"/></svg>',
  expand: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/></svg>',
  spin: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5"/></svg>',
};

const tone: Record<NonNullable<Spec['tone']>, string> = {
  plain: 'border-line text-muted',
  accent: 'border-accent/30 text-accent bg-accent/5',
  ok: 'border-ok/30 text-ok bg-ok/5',
  warn: 'border-warn/35 text-warn bg-warn/5',
};

function badge(s: Spec): string {
  return `<li class="badge ${tone[s.tone ?? 'plain']}"${s.title ? ` title="${esc(s.title)}"` : ''}>${esc(s.label)}</li>`;
}

/**
 * Download size of the free pack a visitor fetches: the desktop .vfxb for VFX, the ZIP for props.
 * Formatted from the measured byte count: KB below 1 MB, otherwise MB with one decimal (decimal units, as in `mb()`).
 */
export function sizeLabel(bytes: number): string {
  return bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1)} MB`;
}

function packBytes(c: Card): number {
  return c.preview.kind === 'vfx' ? c.preview.packs.desktop.bytes : c.preview.zipBytes;
}

/** Measured decoded size against the A15 line: emerald inside the mobile budget, amber past it. */
function vramBar(c: Card): string {
  const v = c.vram, mobile = v.tier === 'mobile';
  const fill = Math.min(v.bytes / VRAM_SCALE, 1).toFixed(4);
  const line = (A15_DIRECTION_BUDGET / VRAM_SCALE * 100).toFixed(2);
  return `<div class="mt-3.5" title="${esc(v.title)}">
        <div class="flex items-baseline justify-between gap-2 font-mono text-[10.5px]">
          <span class="text-muted">VRAM <span class="text-text tabular-nums">${esc(mb(v.bytes))}</span></span>
          <span class="${mobile ? 'text-ok' : 'text-warn'} truncate">${esc(v.label)}</span>
        </div>
        <div class="vram-bar mt-1.5" role="meter" aria-label="Decoded VRAM against the 45 MB A15 budget" aria-valuemin="0" aria-valuemax="${(A15_DIRECTION_BUDGET / 1e6).toFixed(0)}" aria-valuenow="${(v.bytes / 1e6).toFixed(1)}" aria-valuetext="${esc(mb(v.bytes))}, ${esc(v.label)}" style="--fill:${fill};--line:${line}%">
          <span class="vram-fill ${mobile ? 'is-mobile' : 'is-heavy'}"></span><span class="vram-line"></span>
        </div>
      </div>`;
}

function download(a: Action | ExportAction, wide: boolean): string {
  const cls = `btn btn-ghost${wide ? ' col-span-2' : ''}`;
  const detail = a.detail ? ` <span class="font-mono text-[10.5px] text-faint">${esc(a.detail)}</span>` : '';
  if ('export' in a) {
    return `<button type="button" class="${cls}" data-export="${esc(a.export)}" data-url="${esc(a.url)}" title="${esc(a.title ?? '')}">${icon.down} <span data-label>${esc(a.label)}</span>${detail}</button>`;
  }
  return `<a class="${cls}" href="${esc(a.href)}"${a.download ? ' download' : ''} title="${esc(a.title ?? '')}">${icon.down} ${esc(a.label)}${detail}</a>`;
}

function preview(card: Card, index: number): string {
  const eager = card.kind === 'vfx' && index < 3; // props start in a hidden tab
  const img = `<img src="${card.poster.src}" width="${card.poster.width}" height="${card.poster.height}" alt="${esc(card.poster.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" class="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]">`;
  let hover = '';
  if (card.hover?.type === 'video') {
    hover = `<video class="preview-media absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300" data-src="${card.hover.src}" muted loop playsinline preload="none" aria-hidden="true"></video>`;
  } else if (card.hover?.type === 'spin') {
    hover = `<div class="preview-media spin absolute inset-0 grid place-items-center bg-ink/80 opacity-0 backdrop-blur-sm transition-opacity duration-300" aria-hidden="true">
        <div class="spin-strip" data-spin="${card.hover.src}" style="--frames:${card.hover.frames}"></div>
        <span class="absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider whitespace-nowrap text-muted uppercase">${icon.spin} 8 facings · ${esc(card.hover.label)}</span>
      </div>`;
  }
  return `<div class="preview relative aspect-[16/10] overflow-hidden bg-[#0a0d12]" data-preview${card.hover ? ` data-hover="${card.hover.type}"` : ''}>
      ${img}
      ${hover}
      <span class="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text backdrop-blur"><i class="size-1.5 rounded-full" style="background:${card.color}"></i>${esc(card.groupLabel)}</span>
      <span class="pointer-events-none absolute top-2.5 right-2.5 rounded-full border border-ok/30 bg-ink/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ok backdrop-blur">Free</span>
      <button type="button" class="preview-open absolute inset-0 z-10" data-open-preview="${esc(card.id)}" aria-haspopup="dialog" aria-label="Open interactive preview: ${esc(card.title)}">
        <span class="hint pointer-events-none absolute right-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/70 px-2 py-1 font-mono text-[10px] tracking-wide text-muted backdrop-blur transition-colors">${icon.expand} Inspect</span>
      </button>
    </div>`;
}

function card(c: Card, index: number): string {
  const search = [c.id, c.title, c.native, c.groupLabel, c.tag, c.description, c.kind === 'vfx' ? elements[c.group]?.native : '', c.vram.label].join(' ').toLowerCase();
  const wide = c.downloads.length === 1;
  const size = sizeLabel(packBytes(c));
  return `<article class="card group" data-card data-kind="${c.kind}" data-group="${esc(c.group)}" data-tier="${c.vram.tier}" data-terms="${esc(search)}">
    ${preview(c, index)}
    <div class="flex flex-1 flex-col p-4">
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="text-[15px] font-semibold tracking-tight text-text">${esc(c.title)}</h3>
        <span class="shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">${esc(c.tag)}</span>
      </div>
      <p class="mt-0.5 flex items-center justify-between gap-3 text-xs text-faint">
        <span class="min-w-0 truncate">${esc(c.native)}</span>
        <span class="badge shrink-0 border-line bg-ink-2 text-text tabular-nums" title="Download size of the free pack (${esc(c.kind === 'vfx' ? 'desktop .vfxb' : 'ZIP')})">${icon.down.replace('width="12" height="12"', 'width="10" height="10" class="mr-1 inline"')}${esc(size)}</span>
      </p>
      <p class="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-muted">${esc(c.description)}</p>
      <ul class="mt-3.5 flex flex-wrap gap-1.5" aria-label="Tech specs">${c.badges.map(badge).join('')}</ul>
      <p class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10.5px]" title="${esc(c.fps.title)}">
        <span class="text-muted">${esc(c.fps.bake)}</span><span class="text-line-strong" aria-hidden="true">→</span><span class="text-accent">${esc(c.fps.target)}</span>
      </p>
      ${vramBar(c)}
      <p class="mt-3 font-mono text-[11px] text-faint">${c.meta.map(m => esc(m).replace(/ /g, '&nbsp;')).join('<span class="px-1 text-line-strong"> · </span>')}</p>
      <div class="mt-auto grid grid-cols-2 gap-2 pt-4">
        <a class="btn btn-primary col-span-2" href="${esc(c.live.href)}" target="_blank" rel="noopener" data-live>${c.live.label} <span class="font-mono text-[11px] font-normal opacity-60">${esc(new URL(c.live.href).host)}</span> ${icon.out}</a>
        ${c.downloads.map(d => download(d, wide)).join('\n        ')}
        ${c.gumroad ? `<a class="btn btn-ghost col-span-2" href="${esc(c.gumroad)}" target="_blank" rel="noopener" data-gumroad>Buy on Gumroad ${icon.out}</a>` : ''}
      </div>
    </div>
  </article>`;
}

function chips(cards: Card[]): string {
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
  const chip = (key: string, label: string, n: number, color?: string) =>
    `<button type="button" class="chip" data-chip="${key}" aria-pressed="${key === 'all'}">${color ? `<i class="size-1.5 rounded-full" style="background:${color}"></i>` : ''}${esc(label)}<span class="font-mono text-[10px] text-faint">${n}</span></button>`;
  return [chip('all', 'All', cards.length), ...Object.entries(elements).filter(([k]) => counts.has(k)).map(([k, e]) => chip(k, e.label, counts.get(k)!, e.color))].join('');
}

export interface Facts { release: Release; vfx: Card[]; props: Card[] }

export function facts(release: Release): Facts {
  return { release, vfx: vfxCards(release), props: propsCards() };
}

/** Preview data for the modal, as inert JSON (never executed; `<` escaped so it cannot close the tag). */
function data(f: Facts): string {
  const previews = Object.fromEntries([...f.vfx, ...f.props].map(c => [c.id, c.preview]));
  const json = JSON.stringify({ release: f.release.release, previews }).replace(/</g, '\\u003c');
  return `<script type="application/json" id="hub-data">${json}</script>`;
}

/** Replaces `<!--hub:name-->` slots and `{{token}}` placeholders in index.html. */
export function fill(html: string, f: Facts, extra: Record<string, string | number>): string {
  const isoAssets = f.props.reduce((n, c) => n + Number(c.meta[0].split(' ')[0]), 0);
  const slots: Record<string, string> = {
    'vfx-cards': f.vfx.map(card).join('\n'),
    'props-cards': f.props.map(card).join('\n'),
    'vfx-chips': chips(f.vfx),
    data: data(f),
  };
  const tokens: Record<string, string | number> = {
    vfxCount: f.vfx.length,
    propsCount: f.props.length,
    mobileTier: f.vfx.filter(c => c.vram.tier === 'mobile').length,
    heavyTier: f.vfx.filter(c => c.vram.tier === 'heavy').length,
    isoAssets,
    vfxUrl: site.vfx,
    vfxHost: new URL(site.vfx).host,
    propsUrl: site.props,
    propsHost: new URL(site.props).host,
    github: site.github,
    githubHandle: site.githubHandle,
    repo: site.repo,
    contact: site.contact,
    contactLabel: site.contact.replace(/^mailto:/, ''),
    gumroad: site.gumroad,
    cdn: `${f.release.base.replace(/\/+$/, '')}/${f.release.release}/index.json`,
    cdnShort: new URL(f.release.base).host.replace(/^(pub-[0-9a-f]{6})[0-9a-f]+(\.r2\.dev)$/, '$1…$2'),
    release: f.release.release,
    year: new Date().getUTCFullYear(),
    ...extra,
  };
  const gumroadState = site.gumroad ? 'live' : 'soon';
  return html
    .replace(/<!--hub:([a-z-]+)-->/g, (_, name: string) => {
      if (!(name in slots)) throw new Error(`Unknown hub slot ${name}`);
      return slots[name];
    })
    .replace(/<!--gumroad:(live|soon)-->([\s\S]*?)<!--\/gumroad-->/g, (_, state: string, body: string) => (state === gumroadState ? body : ''))
    .replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      if (!(name in tokens)) throw new Error(`Unknown hub token {{${name}}}`);
      return esc(tokens[name]);
    });
}
