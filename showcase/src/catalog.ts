// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
// Storefront metadata only. Playback manifests remain in packs/free/index.json.
import importedCatalog from './catalog-data.json';

export interface PackMetadata {
  id: string;
  name: { en: string; vi: string };
  element: string;
  category: string;
}
export interface CatalogCollection {
  id: string;
  name: string;
  description: string;
  accent: string;
  symbol: string;
}
export interface StoreLink { store: 'itch' | 'gumroad'; url: string }
export interface VideoPreview { type: 'video'; src: string; poster?: string }
interface ProductIdentity { id: string; collectionId: string }
export interface FreeProductDefinition extends ProductIdentity {
  tier: 'free'; status: 'available'; packId: string; description: string;
}
export interface PremiumProductDefinition extends ProductIdentity {
  tier: 'premium'; status: 'available' | 'coming-soon';
  name: { en: string; vi: string };
  description: string;
  includes: string[];
  compatibility: string[];
  preview?: VideoPreview;
  stores?: StoreLink[];
}
export type ProductDefinition = FreeProductDefinition | PremiumProductDefinition;
export interface CatalogData {
  version: 1;
  collections: CatalogCollection[];
  products: ProductDefinition[];
}
interface ProductContent {
  name: { en: string; vi: string };
  description: string;
  collection: CatalogCollection;
  element: string;
  category: string;
  includes: string[];
  compatibility: string[];
}
export type CatalogProduct = ProductDefinition & ProductContent;
export type ProductAction =
  | { kind: 'download'; stores: [] }
  | { kind: 'coming-soon'; stores: [] }
  | { kind: 'purchase'; stores: StoreLink[] };

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const placeholder = /(?:\bexample\b|placeholder|coming[-_ ]?soon|\btbd\b|[<>{}])/i;
function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Catalog: ${field} must be nonempty text`);
}
function requireId(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !slug.test(value)) throw new Error(`Catalog: invalid ${field}`);
}
function requireTexts(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value)) throw new Error(`Catalog: ${field} must be a list`);
  value.forEach(item => requireText(item, field));
}
function record(value: unknown, field: string, keys?: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Catalog: ${field} must be an object`);
  if (keys && Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Catalog: unsupported fields in ${field}`);
  return value as Record<string, unknown>;
}
function httpsUrl(value: unknown, field: string): URL {
  requireText(value, field);
  let url: URL;
  let decoded: string;
  try { url = new URL(value); decoded = decodeURI(value); } catch { throw new Error(`Catalog: invalid ${field} URL`); }
  if (!value.startsWith('https://') || url.protocol !== 'https:' || url.username || url.password || url.hash ||
      (url.port && url.port !== '443') || placeholder.test(decoded)) {
    throw new Error(`Catalog: ${field} needs an HTTPS URL without credentials or placeholders`);
  }
  return url;
}
function validateStore(value: unknown) {
  const link = record(value, 'store link', ['store', 'url']);
  if (link.store !== 'itch' && link.store !== 'gumroad') throw new Error('Catalog: unsupported store');
  const url = httpsUrl(link.url, 'store');
  const host = url.hostname.toLowerCase();
  const valid = link.store === 'itch'
    ? /^[a-z0-9-]+\.itch\.io$/.test(host) && /^\/[^/]+\/?$/.test(url.pathname)
    : (host === 'gumroad.com' || /^[a-z0-9-]+\.gumroad\.com$/.test(host)) && /^\/l\/[^/]+\/?$/.test(url.pathname);
  if (!valid) throw new Error('Catalog: store URL must identify an itch.io or Gumroad product');
}
function validateMedia(value: unknown, kind: 'video' | 'poster') {
  requireText(value, kind);
  const path = value.startsWith('https:') ? httpsUrl(value, kind).pathname : value;
  if (!value.startsWith('https:') && !/^(?:\.\/)?previews\/[a-zA-Z0-9_/-]+\.[a-zA-Z0-9]+$/.test(value)) {
    throw new Error(`Catalog: ${kind} must be HTTPS or a relative previews/ asset`);
  }
  const extension = kind === 'video' ? /\.(mp4|webm)$/i : /\.(png|jpe?g|webp|avif)$/i;
  if (!extension.test(path) || placeholder.test(value) || path.includes('..') || /\/packs\//i.test(path)) {
    throw new Error(`Catalog: invalid ${kind} media asset`);
  }
}
function validateDefinitions(value: unknown, catalogCollections: CatalogCollection[]): ProductDefinition[] {
  if (!Array.isArray(value)) throw new Error('Catalog: products must be a list');
  const ids = new Set<string>(), usedPacks = new Set<string>();
  for (const item of value) {
    const product = record(item, 'product');
    requireId(product.id, 'product ID');
    if (ids.has(product.id)) throw new Error(`Catalog: duplicate product ${product.id}`);
    ids.add(product.id);
    if (!catalogCollections.some(c => c.id === product.collectionId)) throw new Error(`Catalog: unknown collection ${product.collectionId}`);
    if (product.tier === 'free') {
      record(product, 'free definition', ['id', 'collectionId', 'tier', 'status', 'packId', 'description']);
      if (product.status !== 'available') throw new Error('Catalog: free packs must be available');
      requireId(product.packId, 'free pack ID');
      requireText(product.description, `${product.packId} description`);
      if (usedPacks.has(product.packId)) throw new Error(`Catalog: duplicate pack reference ${product.packId}`);
      usedPacks.add(product.packId);
      continue;
    }
    if (product.tier !== 'premium' || (product.status !== 'available' && product.status !== 'coming-soon')) {
      throw new Error('Catalog: unsupported product tier or status');
    }
    record(product, 'premium definitions', ['id', 'tier', 'status', 'collectionId', 'name', 'description', 'includes', 'compatibility', 'preview', 'stores']);
    const name = record(product.name, 'premium name', ['en', 'vi']);
    requireText(name.en, 'premium English name');
    requireText(name.vi, 'premium Vietnamese name');
    requireText(product.description, 'premium description');
    requireTexts(product.includes, 'premium contents');
    requireTexts(product.compatibility, 'premium compatibility');
    if (product.stores !== undefined && !Array.isArray(product.stores)) throw new Error('Catalog: stores must be a list');
    const stores = product.stores as StoreLink[] | undefined;
    stores?.forEach(validateStore);
    if (product.status === 'available' && !stores?.length) throw new Error('Catalog: available premium products need a store URL');
    if (product.status === 'available' && (!product.includes.length || !product.compatibility.length)) {
      throw new Error('Catalog: available premium products need confirmed contents and compatibility');
    }
    if (product.preview !== undefined) {
      const preview = record(product.preview, 'premium preview', ['type', 'src', 'poster']);
      if (preview.type !== 'video') throw new Error('Catalog: premium previews must be videos');
      validateMedia(preview.src, 'video');
      if (preview.poster !== undefined) validateMedia(preview.poster, 'poster');
    }
  }
  return value as ProductDefinition[];
}

/** Validate the public data boundary before using imported product metadata. */
export function validateCatalogData(value: unknown): CatalogData {
  const data = record(value, 'catalog data', ['version', 'collections', 'products']);
  if (data.version !== 1) throw new Error('Catalog: unsupported data version');
  if (!Array.isArray(data.collections) || !data.collections.length) throw new Error('Catalog: collections must be a nonempty list');
  const ids = new Set<string>();
  for (const value of data.collections) {
    const collection = record(value, 'collection', ['id', 'name', 'description', 'accent', 'symbol']);
    requireId(collection.id, 'collection ID');
    if (ids.has(collection.id)) throw new Error(`Catalog: duplicate collection ${collection.id}`);
    ids.add(collection.id);
    for (const key of ['name', 'description', 'symbol']) requireText(collection[key], `collection ${key}`);
    if (typeof collection.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(collection.accent)) throw new Error('Catalog: collection accent must be a six-digit hex color');
  }
  const catalogCollections = data.collections as CatalogCollection[];
  const products = validateDefinitions(data.products, catalogCollections);
  if (!products.length) throw new Error('Catalog: products must be a nonempty list');
  return { version: 1, collections: catalogCollections, products };
}

const catalogData = validateCatalogData(importedCatalog);
export const collections = catalogData.collections;
export const productDefinitions = catalogData.products;

export function resolveCatalog(packs: PackMetadata[], definitions: ProductDefinition[] = productDefinitions,
  catalogCollections: CatalogCollection[] = collections): CatalogProduct[] {
  validateDefinitions(definitions, catalogCollections);
  const packMap = new Map<string, PackMetadata>();
  for (const pack of packs) {
    requireText(pack.id, 'pack ID');
    if (packMap.has(pack.id)) throw new Error(`Catalog: duplicate pack ${pack.id}`);
    packMap.set(pack.id, pack);
  }
  const usedPacks = new Set<string>();
  const result = definitions.map((product): CatalogProduct => {
    const collection = catalogCollections.find(c => c.id === product.collectionId)!;
    if (product.tier === 'free') {
      const pack = packMap.get(product.packId);
      if (!pack) throw new Error(`Catalog: missing free pack ${product.packId}`);
      usedPacks.add(product.packId);
      requireText(pack.name?.en, `${pack.id} English name`);
      requireText(pack.name?.vi, `${pack.id} Vietnamese name`);
      requireText(pack.element, `${pack.id} element`);
      requireText(pack.category, `${pack.id} category`);
      return {
        ...product, collection, name: pack.name, element: pack.element, category: pack.category,
        includes: ['Desktop .vfxb pack', 'Mobile .vfxb pack', 'All available baked directions', 'README with integration instructions'],
        compatibility: ['PixiJS 7 / 8', 'Free runtime installed separately via npm'],
      };
    }
    return { ...product, collection, element: 'neutral', category: 'collection' };
  });
  for (const id of packMap.keys()) {
    if (!usedPacks.has(id)) throw new Error(`Catalog: free pack ${id} has no product entry`);
  }
  return result;
}

export function getProductAction(product: CatalogProduct): ProductAction {
  if (product.tier === 'free') return { kind: 'download', stores: [] };
  if (product.status === 'coming-soon') return { kind: 'coming-soon', stores: [] };
  if (!product.stores?.length) throw new Error('Catalog: available premium products need a store URL');
  product.stores.forEach(validateStore);
  return { kind: 'purchase', stores: product.stores };
}

export function filterProducts(products: CatalogProduct[], options: {
  tier?: 'all' | 'free' | 'premium'; query?: string; element?: string; collectionId?: string;
} = {}): CatalogProduct[] {
  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const query = normalize(options.query?.trim() ?? '');
  return products.filter(p => (!options.tier || options.tier === 'all' || p.tier === options.tier) &&
    (!options.element || options.element === 'all' || p.element === options.element) &&
    (!options.collectionId || options.collectionId === 'all' || p.collectionId === options.collectionId) &&
    normalize(`${p.name.en} ${p.name.vi} ${p.id} ${p.collection.name} ${p.tier === 'premium' ? p.includes.join(' ') : ''}`).includes(query));
}
