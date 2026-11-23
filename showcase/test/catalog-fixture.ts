// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
// Test-only view fixture. Never imported by the production showcase.
import { resolveCatalog } from '../src/catalog';
import type { CatalogProduct, PremiumProductDefinition } from '../src/catalog';
import { createCatalogView } from '../src/catalog-view';

const definitions: PremiumProductDefinition[] = [
  {
    id: 'fixture-released', collectionId: 'kiem-hiep', tier: 'premium', status: 'available',
    name: { en: 'Released test collection', vi: 'Bộ kiểm thử đã phát hành' },
    description: 'Synthetic metadata for purchase and media view regressions.',
    includes: ['Test collection contents'], compatibility: ['Test format compatibility'],
    stores: [
      { store: 'itch', url: 'https://catalog-fixture.itch.io/view-test' },
      { store: 'gumroad', url: 'https://catalog-fixture.gumroad.com/l/view-test' },
    ],
    preview: { type: 'video', src: 'https://media.test/catalog-preview.webm', poster: 'https://media.test/catalog-poster.png' },
  },
  {
    id: 'fixture-upcoming', collectionId: 'ngu-hanh', tier: 'premium', status: 'coming-soon',
    name: { en: 'Upcoming test collection', vi: 'Bộ kiểm thử sắp ra mắt' },
    description: 'A prepared link must remain unavailable until release.',
    includes: ['Confirmed upcoming test effect'], compatibility: [],
    stores: [{ store: 'itch', url: 'https://catalog-fixture.itch.io/prepared-test' }],
    preview: { type: 'video', src: 'https://media.test/upcoming-preview.webm' },
  },
];

document.body.innerHTML = `
  <h1 id="selected-name"></h1>
  <section id="library">
    <label>Search <input id="search" type="search"></label>
    <label>Collection <select id="collection-filter"></select></label>
    <div id="catalog-access"></div><div id="filters"></div>
    <span id="catalog-count"></span><div id="list"></div>
    <div class="viewer">
      <div class="stage-wrap"></div><div class="controls"></div><div class="actions"></div>
      <div id="premium-preview"></div>
      <div id="premium-actions"><p id="coming-soon"><strong>Coming soon</strong><span id="coming-soon-note"></span></p><div id="purchase-links"></div><p id="purchase-note">Checkout at the store</p></div>
    </div>
    <span id="product-badge"></span><span id="product-status"></span><span id="product-collection"></span>
    <h2 id="product-includes-title"></h2><ul id="product-includes"></ul><ul id="product-compatibility"></ul>
    <p id="product-license"></p><div id="integration"></div>
  </section>
  <div id="premium-grid"></div>`;

const products = resolveCatalog([], definitions);
const view = createCatalogView(products, {
  colors: { neutral: '#d6b477' }, labels: { all: 'All', neutral: 'Utility' },
  native: { neutral: 'Tiện ích' }, icons: { neutral: '✧' },
}, render);
function render(product: CatalogProduct) {
  document.getElementById('selected-name')!.textContent = product.name.en;
  view.renderProduct(product); view.renderList(product);
}
render(products[0]);
(window as any).__catalogFixture = {
  select(id: string) {
    const product = products.find(candidate => candidate.id === id);
    if (!product) throw new Error('Unknown catalog fixture product');
    render(product);
  },
};
