// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';

async function loadCatalog(data) {
  const compiled = await build({
    entryPoints: ['showcase/src/catalog.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: data ? [{ name: 'catalog-data-fixture', setup(builder) {
      builder.onLoad({ filter: /catalog-data\.json$/ }, () => ({ contents: JSON.stringify(data), loader: 'json' }));
    } }] : [],
  });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
}
const { collections, productDefinitions, resolveCatalog, getProductAction, filterProducts, validateCatalogData } = await loadCatalog();
const catalogData = JSON.parse(readFileSync('showcase/src/catalog-data.json', 'utf8'));
const packs = JSON.parse(readFileSync('showcase/public/packs/free/index.json', 'utf8'));
const fresh = () => structuredClone(productDefinitions);
const fixtureCollection = {
  id: 'fixture-premium', name: 'Synthetic premium collection', description: 'Test-only collection metadata.',
  accent: '#d6b477', symbol: '✧',
};
const fixtureCollections = [...collections, fixtureCollection];
const premiumDefinition = () => ({
  id: 'fixture-premium', collectionId: fixtureCollection.id, tier: 'premium', status: 'coming-soon',
  name: { en: 'Synthetic collection', vi: 'Bộ hiệu ứng thử nghiệm' },
  description: 'Test-only future Premium metadata, independent of the published catalog.',
  includes: [], compatibility: [],
});
function mutatePremium(change) {
  const premium = premiumDefinition();
  change(premium);
  const definitions = [...fresh(), premium];
  return definitions;
}
const resolveFixture = definitions => resolveCatalog(packs, definitions, fixtureCollections);

test('catalog references all 28 delivered free packs without duplicating their names', () => {
  const products = resolveCatalog(packs);
  const free = products.filter(p => p.tier === 'free');
  assert.equal(free.length, 28);
  assert.deepEqual(free.map(p => p.packId), packs.map(p => p.id));
  for (const product of free) {
    assert.deepEqual(product.name, packs.find(p => p.id === product.packId).name);
    assert.equal(getProductAction(product).kind, 'download');
    assert.equal(product.collectionId, 'free-collection');
    assert.ok(product.description);
    assert.match(product.includes.join(' '), /README/);
    assert.match(product.compatibility.join(' '), /separately/);
  }
});

test('imported catalog data validates version, collection identity and supported fields', () => {
  const valid = validateCatalogData(catalogData);
  assert.equal(valid.version, 1);
  assert.equal(valid.products.length, 28);
  assert.throws(() => validateCatalogData({ ...catalogData, version: 2 }), /unsupported data version/);
  assert.throws(() => validateCatalogData({ ...catalogData, version: '1' }), /unsupported data version/);
  assert.throws(() => validateCatalogData({ ...catalogData, sourcePath: '/private/recipes' }), /unsupported fields/);
  assert.throws(() => validateCatalogData({ ...catalogData, collections: [] }), /nonempty list/);
  assert.throws(() => validateCatalogData({ ...catalogData, products: [] }), /nonempty list/);
  assert.throws(() => validateCatalogData({ ...catalogData, collections: [...catalogData.collections, catalogData.collections[0]] }), /duplicate collection/);
  const invalid = structuredClone(catalogData);
  invalid.collections[0].accent = 'url(https://media.test/theme)';
  assert.throws(() => validateCatalogData(invalid), /hex color/);
});

test('imported Free metadata contains descriptions and rejects duplicate or playback fields', () => {
  const invalid = structuredClone(catalogData);
  delete invalid.products[0].description;
  assert.throws(() => validateCatalogData(invalid), /description must be nonempty/);
  assert.throws(() => validateCatalogData({ ...catalogData, products: [...catalogData.products, catalogData.products[0]] }), /duplicate product/);
  invalid.products[0] = { ...catalogData.products[0], name: { en: 'Wrong name', vi: 'Wrong name' } };
  assert.throws(() => validateCatalogData(invalid), /unsupported fields in free definition/);
  const badStatus = { ...structuredClone(catalogData), collections: fixtureCollections,
    products: mutatePremium(p => { p.status = ['available']; }) };
  assert.throws(() => validateCatalogData(badStatus), /tier or status/);
});

test('a data-only export update reaches the default catalog without editing TypeScript', async () => {
  const updated = structuredClone(catalogData);
  const effect = updated.products.find(p => p.id === 'hoa-fireball');
  effect.description = 'Updated release description supplied through the data fixture.';
  updated.collections[0].name = 'Updated collection in data fixture';
  const imported = await loadCatalog(updated);
  const product = imported.resolveCatalog(packs).find(p => p.id === 'hoa-fireball');
  assert.equal(product.description, effect.description);
  assert.equal(product.collection.name, updated.collections[0].name);
  assert.deepEqual(product.name, packs.find(p => p.id === 'hoa-fireball').name);
  assert.equal(product.element, packs.find(p => p.id === 'hoa-fireball').element);
  assert.equal(imported.getProductAction(product).kind, 'download');
  assert.equal(imported.resolveCatalog(packs).length, 28);
});

test('the published catalog contains only the 28 Free effects and their used collection', () => {
  const products = resolveCatalog(packs);
  assert.equal(products.length, 28);
  assert.deepEqual([...new Set(products.map(product => product.tier))], ['free']);
  assert.deepEqual(collections.map(collection => collection.id), ['free-collection']);
  for (const product of products) {
    assert.deepEqual(getProductAction(product), { kind: 'download', stores: [] });
    assert.equal(product.status, 'available');
    assert.equal(product.stores, undefined);
    assert.equal(product.preview, undefined);
  }
});

test('missing, duplicate and unlisted packs fail before rendering a broken catalog', () => {
  assert.throws(() => resolveCatalog(packs.slice(1)), /missing free pack/);
  assert.throws(() => resolveCatalog([...packs, packs[0]]), /duplicate pack/);
  assert.throws(() => resolveCatalog(packs, productDefinitions.slice(1)), /has no product entry/);
  assert.throws(() => resolveCatalog(packs, [...fresh(), fresh()[0]]), /duplicate product/);
  const definitions = fresh();
  definitions[1].packId = definitions[0].packId;
  assert.throws(() => resolveCatalog(packs, definitions), /duplicate pack reference/);
});

test('premium release requires a supported product URL and coming-soon gates prepared links', () => {
  assert.throws(() => resolveFixture(mutatePremium(p => { p.status = 'available'; })), /need a store URL/);
  const definitions = mutatePremium(p => {
    p.stores = [{ store: 'itch', url: 'https://fixture-studio.itch.io/vfx-collection' },
      { store: 'gumroad', url: 'https://fixture-studio.gumroad.com/l/vfx-collection' }];
  });
  let product = resolveFixture(definitions).find(p => p.tier === 'premium');
  assert.deepEqual(getProductAction(product), { kind: 'coming-soon', stores: [] });
  const released = definitions.find(p => p.tier === 'premium');
  released.status = 'available';
  released.includes = []; released.compatibility = [];
  assert.throws(() => resolveFixture(definitions), /confirmed contents and compatibility/);
  released.includes = ['Synthetic test bundle'];
  released.compatibility = ['Synthetic test target'];
  product = resolveFixture(definitions).find(p => p.tier === 'premium');
  assert.equal(getProductAction(product).kind, 'purchase');
  assert.equal(getProductAction(product).stores.length, 2);
});

test('unsafe, placeholder and non-product checkout URLs are rejected', () => {
  for (const url of ['javascript:alert(1)', 'http://fixture.itch.io/vfx', '#itch-link-tbd',
    'https://example.itch.io/vfx', 'https://fixture.itch.io/vfx#buy', 'https://fixture.itch.io/',
    'https://fixture.itch.io.evil.test/vfx', 'https://user:pass@fixture.itch.io/vfx', 'https://fixture.itch.io/%E0%A4%A']) {
    assert.throws(() => resolveFixture(mutatePremium(p => { p.stores = [{ store: 'itch', url }]; })), /Catalog:/, url);
  }
  assert.throws(() => resolveFixture(mutatePremium(p => { p.stores = [{ store: 'gumroad', url: 'https://gumroad.com/discover' }]; })), /product/);
});

test('premium video previews accept media assets and reject full packs or executable URLs', () => {
  const definitions = mutatePremium(p => { p.preview = { type: 'video', src: 'previews/launch.mp4', poster: 'previews/launch.webp' }; });
  assert.ok(resolveFixture(definitions).find(p => p.tier === 'premium').preview);
  for (const src of ['javascript:alert(1)', 'data:video/mp4;base64,AAA', '../private/launch.mp4',
    'packs/premium/launch.vfxb', 'https://media.test/launch.vfxb', 'https://media.test/placeholder.mp4']) {
    assert.throws(() => resolveFixture(mutatePremium(p => { p.preview = { type: 'video', src }; })), /Catalog:/, src);
  }
  assert.throws(() => resolveFixture(mutatePremium(p => { p.packId = 'hoa-fireball'; })), /premium definitions/);
});

test('invalid product metadata is rejected and discovery supports tier, collection and Vietnamese names', () => {
  assert.throws(() => resolveFixture(mutatePremium(p => { p.collectionId = 'missing'; })), /unknown collection/);
  assert.throws(() => resolveFixture(mutatePremium(p => { p.status = 'unpublished'; })), /status/);
  assert.throws(() => resolveFixture(mutatePremium(p => { p.description = ''; })), /nonempty/);
  const products = resolveCatalog(packs);
  assert.equal(filterProducts(products, { tier: 'premium' }).length, 0);
  assert.equal(filterProducts(products, { tier: 'free', element: 'hoa' }).length, 4);
  assert.equal(filterProducts(products, { collectionId: 'free-collection' }).length, 28);
  assert.equal(filterProducts(products, { query: 'hoa cau' })[0].id, 'hoa-fireball');
  assert.equal(filterProducts(products, { query: 'dia liet' })[0].id, 'tho-fissure');
  assert.deepEqual(filterProducts(products, { query: 'Golden Edge' }).map(product => product.id), ['kim-golden-edge']);
  assert.equal(filterProducts(products, { query: 'missing effect' }).length, 0);
  const syntheticProducts = resolveFixture(mutatePremium(p => { p.includes = ['Ánh Sáng Thử Nghiệm — Test Spark']; }));
  assert.deepEqual(filterProducts(syntheticProducts, { tier: 'premium' }).map(product => product.id), ['fixture-premium']);
  assert.deepEqual(filterProducts(syntheticProducts, { collectionId: 'fixture-premium' }).map(product => product.id), ['fixture-premium']);
  for (const query of ['Bộ hiệu ứng thử nghiệm', 'bo hieu ung thu nghiem', 'Ánh Sáng Thử Nghiệm', 'anh sang thu nghiem', 'Test Spark']) {
    assert.deepEqual(filterProducts(syntheticProducts, { query }).map(product => product.id), ['fixture-premium']);
  }
});
