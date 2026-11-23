// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import { collections, filterProducts, getProductAction } from './catalog';
import type { CatalogProduct } from './catalog';

interface Theme {
  colors: Record<string, string>; labels: Record<string, string>;
  native: Record<string, string>; icons: Record<string, string>;
}
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') {
  const node = document.createElement(tag); node.textContent = value; node.className = className; return node;
}

/** Product presentation is independent of the pack loader and PixiJS world. */
export function createCatalogView(products: CatalogProduct[], theme: Theme, select: (product: CatalogProduct) => void) {
  let active = products[0], access: 'all' | 'free' | 'premium' = 'all', element = 'all';
  const collectionSelect = el<HTMLSelectElement>('collection-filter');
  collectionSelect.replaceChildren(new Option('All collections', 'all'), ...collections.map(c => new Option(c.name, c.id)));
  collectionSelect.onchange = () => renderList(active);
  el('search').oninput = () => renderList(active);

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
    button.append(text('span', free ? theme.icons[product.element] : '✧', 'skill-icon'), name, text('span', '↗', 'arrow'));
    button.onclick = () => {
      select(product);
      if (!free && matchMedia('(max-width:720px)').matches) el('library').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (!visible.length) el('list').append(text('p', 'No matching products. Try another name or filter.', 'catalog-empty'));
    el('catalog-count').textContent = `${free.length} FREE · ${premium.length} PREMIUM`;
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
      const caption = text('p', 'Video preview · Full pack delivered by the store', 'preview-caption');
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
    link.onclick = event => { event.preventDefault(); select(product); el('library').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const actions = text('div', ''); actions.append(link, text('span', product.status === 'available' ? 'AVAILABLE' : 'COMING SOON'));
    card.append(mark, text('p', 'PREMIUM COLLECTION', 'eyebrow'), text('h3', product.name.en), text('p', product.description), actions); return card;
  }));
  return { renderList, renderProduct };
}
