// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['showcase/src/catalog.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { collections, productDefinitions, resolveCatalog, getProductAction, filterProducts } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
const packs = JSON.parse(readFileSync('showcase/public/packs/free/index.json', 'utf8'));
const fresh = () => structuredClone(productDefinitions);
function mutatePremium(change) {
  const definitions = fresh();
  change(definitions.find(p => p.tier === 'premium'));
  return definitions;
}

test('catalog references all 25 delivered free packs without duplicating their names', () => {
  const products = resolveCatalog(packs);
  const free = products.filter(p => p.tier === 'free');
  assert.equal(free.length, 25);
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

test('existing premium collections are honest coming-soon products with no checkout or pack', () => {
  const premium = resolveCatalog(packs).filter(p => p.tier === 'premium');
  assert.deepEqual(premium.map(p => p.id), ['kiem-hiep', 'ngu-hanh', 'ultimate-boss']);
  assert.equal(collections.length, 4);
  for (const product of premium) {
    assert.deepEqual(getProductAction(product), { kind: 'coming-soon', stores: [] });
    assert.equal(product.preview, undefined);
    assert.equal(product.packId, undefined);
    assert.deepEqual(product.includes, []);
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
  assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.status = 'available'; })), /need a store URL/);
  const definitions = mutatePremium(p => {
    p.stores = [{ store: 'itch', url: 'https://fixture-studio.itch.io/vfx-collection' },
      { store: 'gumroad', url: 'https://fixture-studio.gumroad.com/l/vfx-collection' }];
  });
  let product = resolveCatalog(packs, definitions).find(p => p.tier === 'premium');
  assert.deepEqual(getProductAction(product), { kind: 'coming-soon', stores: [] });
  const released = definitions.find(p => p.tier === 'premium');
  released.status = 'available';
  assert.throws(() => resolveCatalog(packs, definitions), /confirmed contents and compatibility/);
  released.includes = ['Synthetic test bundle'];
  released.compatibility = ['Synthetic test target'];
  product = resolveCatalog(packs, definitions).find(p => p.tier === 'premium');
  assert.equal(getProductAction(product).kind, 'purchase');
  assert.equal(getProductAction(product).stores.length, 2);
});

test('unsafe, placeholder and non-product checkout URLs are rejected', () => {
  for (const url of ['javascript:alert(1)', 'http://fixture.itch.io/vfx', '#itch-link-tbd',
    'https://example.itch.io/vfx', 'https://fixture.itch.io/vfx#buy', 'https://fixture.itch.io/',
    'https://fixture.itch.io.evil.test/vfx', 'https://user:pass@fixture.itch.io/vfx', 'https://fixture.itch.io/%E0%A4%A']) {
    assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.stores = [{ store: 'itch', url }]; })), /Catalog:/, url);
  }
  assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.stores = [{ store: 'gumroad', url: 'https://gumroad.com/discover' }]; })), /product/);
});

test('premium video previews accept media assets and reject full packs or executable URLs', () => {
  const definitions = mutatePremium(p => { p.preview = { type: 'video', src: 'previews/launch.mp4', poster: 'previews/launch.webp' }; });
  assert.ok(resolveCatalog(packs, definitions).find(p => p.tier === 'premium').preview);
  for (const src of ['javascript:alert(1)', 'data:video/mp4;base64,AAA', '../private/launch.mp4',
    'packs/premium/launch.vfxb', 'https://media.test/launch.vfxb', 'https://media.test/placeholder.mp4']) {
    assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.preview = { type: 'video', src }; })), /Catalog:/, src);
  }
  assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.packId = 'hoa-fireball'; })), /premium definitions/);
});

test('invalid product metadata is rejected and discovery supports tier, collection and Vietnamese names', () => {
  assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.collectionId = 'missing'; })), /unknown collection/);
  assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.status = 'unpublished'; })), /status/);
  assert.throws(() => resolveCatalog(packs, mutatePremium(p => { p.description = ''; })), /nonempty/);
  const products = resolveCatalog(packs);
  assert.equal(filterProducts(products, { tier: 'premium' }).length, 3);
  assert.equal(filterProducts(products, { tier: 'free', element: 'hoa' }).length, 4);
  assert.equal(filterProducts(products, { collectionId: 'kiem-hiep' })[0].id, 'kiem-hiep');
  assert.equal(filterProducts(products, { query: 'hoa cau' })[0].id, 'hoa-fireball');
  assert.equal(filterProducts(products, { query: 'dia liet' })[0].id, 'tho-fissure');
  assert.equal(filterProducts(products, { query: 'missing effect' }).length, 0);
});
