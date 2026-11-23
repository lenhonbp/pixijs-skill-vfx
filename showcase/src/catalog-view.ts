// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import { filterProducts, getProductAction } from './catalog';
import type { CatalogProduct } from './catalog';

interface Theme {
  colors: Record<string, string>; labels: Record<string, string>;
  native: Record<string, string>; icons: Record<string, string>;
}
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') {
  const node = document.createElement(tag); node.textContent = value; node.className = className; return node;
}

const elementPaths: Record<string, string[]> = {
  kim: ['M15 3l6 6-9 9-6-6z', 'M4 14l6 6', 'M3 21l4-4'],
  moc: ['M20 4C8 3 3 8 5 15c2 7 14 6 15-11Z', 'M4 21l11-11'],
  thuy: ['M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7', 'M9 4l3 3 3-3M9 20l3-3 3 3'],
  hoa: ['M13 3c1 5-5 5-3 10 2-1 3-3 3-5 5 5 7 8 4 12-3 4-11 2-11-3 0-4 4-7 7-14Z'],
  tho: ['M12 3 22 12 12 21 2 12Z', 'M12 7 17.5 12 12 17 6.5 12Z'],
  phong: ['M3 8h12c5 0 5-6 1-6', 'M2 12h17c4 0 4 6 0 6', 'M5 16h6c4 0 4 6 0 6'],
  loi: ['M14 2 5 14h6l-1 8 9-12h-6Z'],
  neutral: ['M12 3 20 7v5c0 5-8 9-8 9S4 17 4 12V7Z', 'M8 12h8M12 8v8'],
};
function lineIcon(paths: string[], size = 24) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); svg.append(path);
  }
  return svg;
}
function scrollToPreview() {
  document.querySelector<HTMLElement>('.viewer')!.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start',
  });
}

/** Product presentation is independent of the pack loader and PixiJS world. */
export function createCatalogView(products: CatalogProduct[], theme: Theme, select: (product: CatalogProduct) => void) {
  let active = products[0], access: 'all' | 'free' | 'premium' = 'all', element = 'all';
  const hasPremium = products.some(product => product.tier === 'premium');
  const collections = [...new Map(products.map(product => [product.collectionId, product.collection])).values()];
  const collectionSelect = el<HTMLSelectElement>('collection-filter');
  collectionSelect.replaceChildren(new Option('All collections', 'all'), ...collections.map(c => new Option(c.name, c.id)));
  collectionSelect.hidden = collections.length < 2;
  collectionSelect.labels?.forEach(label => { label.hidden = collectionSelect.hidden; });
  collectionSelect.onchange = () => renderList(active);
  el('search').oninput = () => renderList(active);

  el('catalog-access').hidden = !hasPremium;
  el('catalog-access').replaceChildren(...(['all', 'free', 'premium'] as const).map(value => {
    const label = value[0].toUpperCase() + value.slice(1), button = text('button', label);
    button.type = 'button'; button.dataset.access = value; button.setAttribute('aria-label', `${label} products`);
    button.onclick = () => { access = value; element = 'all'; collectionSelect.value = 'all'; renderList(active); };
    return button;
  }));
  el('filters').replaceChildren(...Object.entries(theme.labels).map(([key, label]) => {
    const button = text('button', label); button.type = 'button'; button.dataset.element = key;
    button.onclick = () => { element = key; renderList(active); }; return button;
  }));

  function productButton(product: CatalogProduct) {
    const free = product.tier === 'free', button = document.createElement('button');
    button.type = 'button'; button.className = `${free ? 'skill' : 'product-entry'}${product.id === active.id ? ' selected' : ''}`;
    button.dataset.productId = product.id;
    button.style.setProperty('--element', free ? theme.colors[product.element] : product.collection.accent);
    button.setAttribute('aria-pressed', String(product.id === active.id));
    const name = text('span', '', 'product-name');
    name.append(text('strong', product.name.en), text('small', free ? product.name.vi : product.status === 'available' ? 'Premium collection' : 'Premium · Coming soon'));
    const icon = text('span', '', 'skill-icon'), arrow = text('span', '', 'arrow');
    icon.append(lineIcon(elementPaths[product.element] ?? ['M12 3 15 9l6 3-6 3-3 6-3-6-6-3 6-3Z']));
    arrow.append(lineIcon(['M6 12h12M13 7l5 5-5 5'], 16));
    button.append(icon, name, arrow);
    button.onclick = () => {
      select(product);
      if (matchMedia('(max-width:720px)').matches) scrollToPreview();
    }; return button;
  }
  function heading(label: string, count: number, color: string) {
    const node = text('p', '', 'group'); node.style.setProperty('--element', color);
    node.append(text('span', label), text('small', String(count))); return node;
  }
  function renderList(product: CatalogProduct) {
    active = product;
    el('catalog-access').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.access === access)));
    el('filters').hidden = access === 'premium';
    el('filters').querySelectorAll<HTMLButtonElement>('button').forEach(b => {
      b.classList.toggle('active', b.dataset.element === element); b.setAttribute('aria-pressed', String(b.dataset.element === element));
    });
    const visible = filterProducts(products, { tier: access, query: el<HTMLInputElement>('search').value, element, collectionId: collectionSelect.value });
    const free = visible.filter(p => p.tier === 'free'), premium = visible.filter(p => p.tier === 'premium');
    const nodes: HTMLElement[] = Object.keys(theme.native).flatMap(key => {
      const group = free.filter(p => p.element === key);
      return group.length ? [heading(`${theme.labels[key]} · ${theme.native[key]}`, group.length, theme.colors[key]), ...group.map(productButton)] : [];
    });
    if (premium.length) nodes.push(heading('Premium collections', premium.length, '#d6b477'), ...premium.map(productButton));
    el('list').replaceChildren(...nodes);
    if (!visible.length) {
      const empty = text('div', '', 'catalog-empty');
      const reset = text('button', 'Reset filters', 'catalog-reset'); reset.type = 'button';
      reset.onclick = () => {
        el<HTMLInputElement>('search').value = ''; access = 'all'; element = 'all'; collectionSelect.value = 'all';
        renderList(active); el('search').focus({ preventScroll: true });
      };
      empty.append(text('strong', hasPremium ? 'No products found.' : 'No effects found.'),
        text('p', 'Try another name or reset the filters.'), reset);
      el('list').append(empty);
    }
    el('catalog-count').textContent = hasPremium ? `${free.length} FREE · ${premium.length} PREMIUM`
      : visible.length === products.length ? `${visible.length} effects · All free` : `${visible.length} of ${products.length} effects`;
  }

  function renderProduct(product: CatalogProduct) {
    const free = product.tier === 'free', action = getProductAction(product);
    const previousVideo = el('premium-preview').querySelector('video');
    if (previousVideo) { previousVideo.pause(); previousVideo.removeAttribute('src'); previousVideo.load(); }
    document.querySelector<HTMLElement>('.viewer')!.dataset.access = product.tier;
    for (const selector of ['.stage-wrap', '.controls', '.actions', '#integration']) document.querySelector<HTMLElement>(selector)!.hidden = !free;
    el('premium-preview').hidden = free;
    el('premium-actions').hidden = free;
    el('product-badge').textContent = free ? 'Free' : 'Premium';
    el('product-badge').dataset.access = product.tier;
    el('product-status').textContent = product.status === 'available' ? 'Available' : 'Coming soon';
    el('product-collection').textContent = product.collection.name;
    el('product-includes-title').textContent = free ? 'In the download kit' : 'Collection contents';
    el('product-includes').replaceChildren(...(product.includes.length ? product.includes : ['The full contents will be announced at launch.']).map(value => text('li', value)));
    el('product-compatibility').replaceChildren(...(product.compatibility.length ? product.compatibility : ['Compatibility details will be confirmed at launch.']).map(value => text('li', value)));
    el('product-license').textContent = free ? 'Free packs and runtime: MIT. Character artwork is separate and is not included in the kit.'
      : product.status === 'available' ? 'See the store listing for the license and terms included with this collection.'
        : 'License details will be published with this collection at launch.';
    el('coming-soon').hidden = action.kind !== 'coming-soon';
    el('coming-soon-note').textContent = product.includes.length
      ? 'Pricing, license and purchase links will be announced at launch.'
      : 'Pack contents, pricing and purchase links will be announced at launch.';
    el('purchase-links').replaceChildren(...action.stores.map(store => {
      const name = store.store === 'itch' ? 'itch.io' : 'Gumroad';
      const link = text('a', `Buy on ${name} ↗`, 'purchase-link');
      link.href = store.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Buy ${product.name.en} on ${name}`); return link;
    }));
    el('purchase-note').hidden = action.kind !== 'purchase';
    el('premium-preview').replaceChildren();
    if (free) return;
    el('premium-preview').style.setProperty('--accent', product.collection.accent);
    if (product.preview) {
      const video = document.createElement('video'); video.controls = true; video.preload = 'none'; video.playsInline = true;
      video.src = product.preview.src; if (product.preview.poster) video.poster = product.preview.poster;
      video.setAttribute('aria-label', `${product.name.en} video preview`);
      const caption = text('p', product.status === 'available' ? 'Video preview · Full pack delivered by the store'
        : 'Video preview · Collection coming soon', 'preview-caption');
      video.addEventListener('error', () => { caption.textContent = 'The video preview could not load. Try again later.'; });
      el('premium-preview').append(video, caption);
    } else {
      const mark = text('span', '✧', 'preview-mark'); mark.setAttribute('aria-hidden', 'true');
      el('premium-preview').append(mark, text('p', 'PREMIUM COLLECTION', 'eyebrow'),
        text('h3', product.status === 'available' ? 'Preview not available yet' : 'Preview coming soon'),
        text('p', product.status === 'available' ? 'View the store listing for more information about this collection.'
          : 'A video preview will be added when this collection is ready to show.', 'preview-description'));
    }
  }

  el('premium-grid').replaceChildren(...products.filter(p => p.tier === 'premium').map(product => {
    const card = document.createElement('article'); card.style.setProperty('--accent', product.collection.accent);
    const mark = text('span', product.collection.symbol, 'pack-symbol'); mark.setAttribute('aria-hidden', 'true');
    const link = text('a', 'View collection →'); link.href = `#product/${product.id}`; link.dataset.productId = product.id;
    link.onclick = event => { event.preventDefault(); select(product); scrollToPreview(); };
    const actions = text('div', ''); actions.append(link, text('span', product.status === 'available' ? 'AVAILABLE' : 'COMING SOON'));
    card.append(mark, text('p', 'PREMIUM COLLECTION', 'eyebrow'), text('h3', product.name.en), text('p', product.description), actions); return card;
  }));
  return { renderList, renderProduct };
}
