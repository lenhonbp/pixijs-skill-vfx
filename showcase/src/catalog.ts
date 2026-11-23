// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
// Storefront metadata only. Playback manifests remain in packs/free/index.json.
import details from './skill-details';

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
  tier: 'free'; status: 'available'; packId: string;
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

export const collections: CatalogCollection[] = [
  { id: 'free-collection', name: 'Free collection', description: 'Ready-to-play 2.5D skill effects for your game.', accent: '#d6b477', symbol: '✦' },
  { id: 'kiem-hiep', name: 'Kiếm Hiệp', description: 'Sword auras, flying blades and the spirit of a wandering hero.', accent: '#d6b477', symbol: '劍' },
  { id: 'ngu-hanh', name: 'Ngũ Hành', description: 'Metal, wood, water, fire and earth. Five forces in perfect motion.', accent: '#7dbaa9', symbol: '五' },
  { id: 'ultimate-boss', name: 'Ultimate Boss', description: 'Arena-shaking ultimates for battles players will remember.', accent: '#b69ed4', symbol: '冥' },
];

// Explicit membership prevents a newly delivered pack from being listed by accident.
const freePackIds = [
  'kim-sword-rain', 'kim-golden-edge', 'kim-golden-bell',
  'moc-vine-bind', 'moc-spring-bloom', 'moc-toxic-spores',
  'thuy-frost-nova', 'thuy-glacier-path',
  'hoa-fireball', 'hoa-dragon-breath', 'hoa-heaven-fire', 'hoa-fire-dragon-crossing',
  'tho-fissure', 'tho-stone-skin',
  'phong-gale-blade', 'phong-whirlwind', 'phong-tornado', 'phong-tailwind',
  'lightning-chain', 'loi-heaven-strike', 'loi-thunder-domain',
  'seal-silence', 'sunder-mark', 'war-cry', 'curse-weaken',
];

export const productDefinitions: ProductDefinition[] = [
  ...freePackIds.map((packId): FreeProductDefinition => ({
    id: packId, packId, collectionId: 'free-collection', tier: 'free', status: 'available',
  })),
  ...collections.filter(c => c.id !== 'free-collection').map((collection): PremiumProductDefinition => ({
    id: collection.id, collectionId: collection.id, tier: 'premium', status: 'coming-soon',
    name: { en: collection.name, vi: collection.name }, description: collection.description,
    // Contents, compatibility, preview and checkout are filled in when confirmed.
    includes: [], compatibility: [],
  })),
];

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const placeholder = /(?:\bexample\b|placeholder|coming[-_ ]?soon|\btbd\b|[<>{}])/i;
function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Catalog: ${field} must be nonempty text`);
}
function requireTexts(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value)) throw new Error(`Catalog: ${field} must be a list`);
  value.forEach(item => requireText(item, field));
}
function httpsUrl(value: string, field: string): URL {
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
function validateStore(link: StoreLink) {
  if (!link || !['itch', 'gumroad'].includes(link.store)) throw new Error('Catalog: unsupported store');
  const url = httpsUrl(link.url, 'store');
  const host = url.hostname.toLowerCase();
  const valid = link.store === 'itch'
    ? /^[a-z0-9-]+\.itch\.io$/.test(host) && /^\/[^/]+\/?$/.test(url.pathname)
    : (host === 'gumroad.com' || /^[a-z0-9-]+\.gumroad\.com$/.test(host)) && /^\/l\/[^/]+\/?$/.test(url.pathname);
  if (!valid) throw new Error('Catalog: store URL must identify an itch.io or Gumroad product');
}
function validateMedia(value: string, kind: 'video' | 'poster') {
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

export function resolveCatalog(packs: PackMetadata[], definitions: ProductDefinition[] = productDefinitions): CatalogProduct[] {
  const packMap = new Map<string, PackMetadata>();
  for (const pack of packs) {
    requireText(pack.id, 'pack ID');
    if (packMap.has(pack.id)) throw new Error(`Catalog: duplicate pack ${pack.id}`);
    packMap.set(pack.id, pack);
  }
  const ids = new Set<string>(), usedPacks = new Set<string>();
  const result = definitions.map((product): CatalogProduct => {
    if (!product || typeof product.id !== 'string' || !slug.test(product.id)) throw new Error('Catalog: invalid product ID');
    if (ids.has(product.id)) throw new Error(`Catalog: duplicate product ${product.id}`);
    ids.add(product.id);
    const collection = collections.find(c => c.id === product.collectionId);
    if (!collection) throw new Error(`Catalog: unknown collection ${product.collectionId}`);
    if (product.tier === 'free') {
      if (product.status !== 'available') throw new Error('Catalog: free packs must be available');
      const pack = packMap.get(product.packId);
      if (!pack) throw new Error(`Catalog: missing free pack ${product.packId}`);
      if (usedPacks.has(product.packId)) throw new Error(`Catalog: duplicate pack reference ${product.packId}`);
      usedPacks.add(product.packId);
      requireText(pack.name?.en, `${pack.id} English name`);
      requireText(pack.name?.vi, `${pack.id} Vietnamese name`);
      requireText(pack.element, `${pack.id} element`);
      requireText(pack.category, `${pack.id} category`);
      const description = (details as Record<string, { description: string }>)[pack.id]?.description;
      requireText(description, `${pack.id} description`);
      return {
        ...product, collection, name: pack.name, description, element: pack.element, category: pack.category,
        includes: ['Desktop .vfxb pack', 'Mobile .vfxb pack', 'All available baked directions', 'README with integration instructions'],
        compatibility: ['PixiJS 7 / 8', 'Free runtime installed separately via npm'],
      };
    }
    if (product.tier !== 'premium' || !['available', 'coming-soon'].includes(product.status)) {
      throw new Error('Catalog: unsupported product tier or status');
    }
    const allowed = ['id', 'tier', 'status', 'collectionId', 'name', 'description', 'includes', 'compatibility', 'preview', 'stores'];
    if (Object.keys(product).some(key => !allowed.includes(key))) {
      throw new Error('Catalog: premium definitions must not contain pack references, downloads or unsupported fields');
    }
    requireText(product.name?.en, 'premium English name');
    requireText(product.name?.vi, 'premium Vietnamese name');
    requireText(product.description, 'premium description');
    requireTexts(product.includes, 'premium contents');
    requireTexts(product.compatibility, 'premium compatibility');
    if (product.stores !== undefined && !Array.isArray(product.stores)) throw new Error('Catalog: stores must be a list');
    product.stores?.forEach(validateStore);
    if (product.status === 'available' && !product.stores?.length) {
      throw new Error('Catalog: available premium products need a store URL');
    }
    if (product.status === 'available' && (!product.includes.length || !product.compatibility.length)) {
      throw new Error('Catalog: available premium products need confirmed contents and compatibility');
    }
    if (product.preview) {
      if (product.preview.type !== 'video') throw new Error('Catalog: premium previews must be videos');
      validateMedia(product.preview.src, 'video');
      if (product.preview.poster !== undefined) validateMedia(product.preview.poster, 'poster');
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
    normalize(`${p.name.en} ${p.name.vi} ${p.id} ${p.collection.name}`).includes(query));
}
