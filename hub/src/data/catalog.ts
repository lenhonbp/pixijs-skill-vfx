// Turns the measured specs snapshots into the cards the Asset Explorer renders.
// vfx-specs.json  ← scripts/vfx-specs.mjs (decoded from the released .vfxb manifests)
// props-specs.json ← scripts/props-media.py (Isobaker release receipts + atlas pages)
import vfxSpecs from './vfx-specs.json' with { type: 'json' };
import propsSpecs from './props-specs.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { site } from '../site.config.ts';

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));
const versions = new Map<string, string>();
/**
 * `/media/x.webp` becomes `/media/x.webp?v=<first 10 hex of its sha-256>`, computed from the file at build time.
 * The URL changes whenever the bytes do, so browsers and the CDN can keep media for a year without ever showing a
 * stale poster; `check-dist` fails the build if a media reference is unversioned or its hash does not match.
 */
export function media(path: string): string {
  let v = versions.get(path);
  if (!v) {
    v = createHash('sha256').update(readFileSync(publicDir + path.replace(/^\//, ''))).digest('hex').slice(0, 10);
    versions.set(path, v);
  }
  return `${path}?v=${v}`;
}

export type Tone = 'plain' | 'accent' | 'ok' | 'warn';
export interface Spec { label: string; tone?: Tone; title?: string }
export interface Action { href: string; label: string; detail?: string; download?: boolean; title?: string }
/** A download the page builds in the browser (fetch from the CDN, decode, zip) rather than a plain link. */
export interface ExportAction { export: string; url: string; label: string; detail?: string; title?: string }

export type Tier = 'mobile' | 'heavy';
export interface Vram { bytes: number; tier: Tier; label: string; title: string }

export interface VfxPreview {
  kind: 'vfx'; id: string; title: string; native: string; color: string; group: string;
  fps: number; frames: number; durationMs: number; layers: number; directions: number;
  packs: Record<'desktop' | 'mobile', { url: string; bytes: number; vram: number; sheets: number; maxSheet: number }>;
  live: string; tier: Tier;
}
export interface PropsPreview {
  kind: 'props'; id: string; title: string; native: string; color: string; group: string;
  spin: string | null; turntable: { src: string; w: number; h: number; scale: number } | null; poster: string;
  hero: string; facings: string[]; dims: [number, number][];
  vram: number; vramAll: number; tile: number; compression: number; zip: string; zipBytes: number;
  live: string; tier: Tier;
}
export type Preview = VfxPreview | PropsPreview;

export interface Card {
  kind: 'vfx' | 'props';
  id: string;
  title: string;
  native: string;
  group: string;
  groupLabel: string;
  color: string;
  tag: string;
  description: string;
  poster: { src: string; width: number; height: number; alt: string };
  hover: { type: 'video'; src: string } | { type: 'spin'; src: string; frames: number; label: string } | null;
  /** Exactly four: PixiJS 8.x, WebP Atlas, Zero-GC and the A15 / desktop tier. */
  badges: Spec[];
  fps: { bake: string; target: string; title: string };
  vram: Vram;
  meta: string[];
  live: Action;
  downloads: (Action | ExportAction)[];
  gumroad: string | null;
  preview: Preview;
}

/** Mobile tier budget the factory gates every pack against (iPhone 13 mini / A15), decimal bytes. */
export const A15_DIRECTION_BUDGET = 45_000_000;
/** The VRAM bar's full scale: room to show the heaviest mobile pack past the A15 line. */
export const VRAM_SCALE = 64_000_000;
/** Steady-state frame rates the runtime is benchmarked at (benchmarks/latest.md: 60 and 120 FPS loops). */
export const TARGET_FPS = '60–120';

export const elements: Record<string, { label: string; native: string; color: string }> = {
  hoa: { label: 'Fire', native: 'Hỏa', color: '#ed9674' },
  thuy: { label: 'Water', native: 'Thủy', color: '#83bfd6' },
  moc: { label: 'Wood', native: 'Mộc', color: '#9cbe85' },
  kim: { label: 'Metal', native: 'Kim', color: '#d6b477' },
  tho: { label: 'Earth', native: 'Thổ', color: '#c6a783' },
  phong: { label: 'Wind', native: 'Phong', color: '#91c9b8' },
  loi: { label: 'Thunder', native: 'Lôi', color: '#b6a2e0' },
  neutral: { label: 'Utility', native: 'Tiện ích', color: '#b1afbf' },
};

const descriptions: Record<string, string> = {
  'kim-sword-rain': 'A storm of gold-hilted blades falls on the area and pins every enemy inside.',
  'kim-golden-edge': 'Dash in, two crossing metal slashes, the target bleeds.',
  'kim-golden-bell': 'A golden temple bell descends, rings under two hits, then shatters on the third.',
  'moc-vine-bind': 'A sprouting seed tears open the soil and grows binding vines.',
  'moc-spring-bloom': 'Grass sprouts and flowers unfold in a warm healing breeze.',
  'moc-toxic-spores': 'Mushrooms erupt and breathe a lingering cloud of poisonous spores.',
  'thuy-frost-nova': 'Ice spikes erupt around the target and freeze it solid, then it shatters.',
  'thuy-glacier-path': 'A jagged glacier ridge fractures the ground toward the enemy.',
  'hoa-fireball': 'A charged fireball that explodes and leaves the target burning.',
  'hoa-dragon-breath': 'A sweeping cone of flame that sets everything in front ablaze.',
  'hoa-heaven-fire': 'Calls a meteor from the sky after a short warning.',
  'hoa-fire-dragon-crossing': 'A serpentine fire dragon sweeps across the field, scorching its path.',
  'tho-fissure': 'Rock spikes tear through the ground and stun everything they hit.',
  'tho-stone-skin': 'Rock plates rise and lock onto the body, then crumble into rubble.',
  'phong-gale-blade': 'Draw air into the blade, then fan three banking gusts that throw enemies back.',
  'phong-whirlwind': 'Rush into the group, cut twice, then blow nearby enemies outward with the last spin.',
  'phong-tornado': 'Rake up dust and leaves, carry enemies around the funnel, then slam them down.',
  'phong-tailwind': 'Catch a tailwind, then show the haste with three quick steps trailing ribbons.',
  'lightning-chain': 'A bolt jumps between all enemies and briefly stuns them.',
  'loi-heaven-strike': 'A raised charge calls staggered forked sky strikes across the enemy group.',
  'loi-thunder-domain': 'A violet electric field crackles under the group, dealing periodic shock.',
  'seal-silence': 'A sealing rune flies into the target, locking its voice and veiling its eyes.',
  'sunder-mark': 'Descending reticles lock on and shatter enemy armor into glowing fragments.',
  'war-cry': 'Brace, unleash a fiery roar, and rally within an ember-wreathed battle rune.',
  'curse-weaken': 'A spreading hex binds and weighs down enemies with a sickly, draining curse.',
  'moc-combo-bind': 'Combo 1/3 · a jade rune roots thorny vines that bind and seed the target.',
  'moc-combo-spores': 'Combo 2/3 · two volleys of moss spores grow the parasite to three seeds.',
  'moc-combo-rupture': 'Combo 3/3 · ironwood brambles erupt and detonate in a storm of thorn shards.',
};

const packs: Record<string, { zone: string; color: string; description: string }> = {
  'co-tran': { zone: 'Starter', color: '#c3ad76', description: 'An old-town street corner: paving, stone lantern, timber sign, low fence, well and market stall.' },
  'ngu-hanh': { zone: 'Shrine', color: '#d7bb83', description: 'A Five Elements shrine with ancient sword, bamboo grove, stone basin, bronze cauldron and lantern.' },
  'lang-co': { zone: 'Village', color: '#cfb08a', description: 'A village well courtyard with tiled-roof well, stele, bonsai pine, barrels and supply crates.' },
  'phe-tich': { zone: 'Ruins', color: '#c9ae79', description: 'A fallen mountain-sect ruin: arch, broken column and wall, carved stele, altar and rubble.' },
  'mon-phai': { zone: 'Dojo', color: '#e0a189', description: 'A sect courtyard with banner, training dummy, incense rack, bronze bell, gate drum and vow stele.' },
  'duong-kiem': { zone: 'Forge', color: '#e7b274', description: 'A swordsmith yard: forge hearth, bellows, anvil, quench trough, sword rack and tool bench.' },
  'thu-cac': { zone: 'Interior', color: '#d9c190', description: 'A scroll archive with cabinets, scholar desk, reading stand, desk lamp, map table and chest.' },
  'tra-quan': { zone: 'Everyday', color: '#b9cc8d', description: 'A roadside tea house with brazier, tea table, stools, glazed water jar, cup shelf and caddy.' },
  'dich-tram': { zone: 'Road', color: '#e6b87c', description: 'A courier relay with notice board, hitching post, saddle stand, handcart, cargo and beacon.' },
  'ben-song': { zone: 'River', color: '#8dc4bc', description: 'A river landing with stone steps, mooring post, wooden skiff, oar stand, basket and fish rack.' },
  'son-mon': { zone: 'Mountain', color: '#b6c5cd', description: 'A mountain pass with stone steps, wayside shrine, watch brazier, chain post and markers.' },
  'truc-lam': { zone: 'Retreat', color: '#b4d69c', description: 'A bamboo retreat with screen, stone bench, offering bowl, water basin, wind chime and planter.' },
  'am-duoc': { zone: 'Herbalist', color: '#d1bd88', description: 'A herbalist hut with drying rack, mortar, balance scale, preserve jars and drawer cabinet.' },
  'pho-co': { zone: 'Map kit', color: '#9fb7d4', description: 'Modular old-town map kit: terrain with corner masks, snap-sized buildings and an editable starter level.' },
};

export const mb = (bytes: number, digits = 1) => `${(bytes / 1e6).toFixed(digits)} MB`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The tier every badge and bar on a card derives from: one rule, applied to the measured decoded size. */
export function vramTier(bytes: number, what: string): Vram {
  const tier: Tier = bytes <= A15_DIRECTION_BUDGET ? 'mobile' : 'heavy';
  return tier === 'mobile'
    ? { bytes, tier, label: 'Mobile Tier (A15 <45MB)', title: `${what} decodes to ${mb(bytes)} of VRAM — within the A15 (iPhone 13 mini) budget of 45 MB per direction` }
    : { bytes, tier, label: 'Desktop / Heavy Tier', title: `${what} decodes to ${mb(bytes)} of VRAM — over the A15 45 MB per-direction line, so it ships as a desktop / heavy-tier effect (128 MB resident cap)` };
}

function tierBadge(v: Vram): Spec {
  return v.tier === 'mobile'
    ? { label: 'A15 Verified', tone: 'ok', title: `${v.title}. Checked against the measured pack at build time.` }
    : { label: 'Desktop Tier', tone: 'warn', title: v.title };
}

export interface Release { base: string; release: string }

export function vfxCards(release: Release): Card[] {
  const cdn = `${release.base.replace(/\/+$/, '')}/${release.release}`;
  return vfxSpecs.map(v => {
    const el = elements[v.element] ?? elements.neutral;
    const m = v.mobile, d = v.desktop;
    const vram = vramTier(m.vram, 'The mobile pack');
    const live = `${site.vfx}/#${v.id}`;
    const bake = d.fps === m.fps ? `${d.fps}` : `${d.fps}/${m.fps}`;
    return {
      kind: 'vfx', id: v.id, title: v.en, native: v.vi, group: v.element, groupLabel: el.label, color: el.color,
      tag: cap(v.category),
      description: descriptions[v.id] ?? '',
      poster: { src: media(`/media/vfx/${v.id}.webp`), width: 800, height: 500, alt: `${v.en} (${v.vi}) captured mid-cast from the live PixiJS showcase` },
      hover: { type: 'video', src: media(`/media/vfx/${v.id}.mp4`) },
      badges: [
        { label: 'PixiJS 8.x', title: 'Benchmarked on PixiJS 8.23 (the runtime also plays on v7)' },
        { label: 'WebP Atlas', title: `Shelf-packed WebP sheets up to ${d.maxSheet}px, one .vfxb container per direction` },
        { label: 'Zero-GC', title: 'Steady-state playback allocates under 100 B/frame with no major GC (benchmarks/latest.md)' },
        tierBadge(vram),
      ],
      fps: {
        bake: `Bake ${bake} FPS`, target: `Target ${TARGET_FPS} FPS`,
        title: d.fps === m.fps
          ? `Frames are baked at ${d.fps} FPS; the runtime interpolates playback inside a ${TARGET_FPS} FPS game loop`
          : `Frames are baked at ${d.fps} FPS (desktop) / ${m.fps} FPS (mobile); the runtime plays them inside a ${TARGET_FPS} FPS game loop`,
      },
      vram,
      meta: [`${(d.durationMs / 1000).toFixed(1)} s`, `${d.frames} fr`, `${d.layers} layers`, v.directions > 1 ? '8-dir' : 'omni'],
      live: { href: live, label: 'Test Live' },
      downloads: [
        { href: `${cdn}/${v.id}.vfxb`, label: '.vfxb', detail: mb(d.bytes), download: true, title: `Desktop container straight from the R2 CDN (${mb(d.bytes, 2)})` },
        { export: v.id, url: `${cdn}/${v.id}.vfxb`, label: 'JSON + WebP', title: 'Fetches the .vfxb from the R2 CDN and unpacks it in your browser into the plain .vfx.json manifest + WebP sheets' },
      ],
      gumroad: site.gumroadProducts[v.id] ?? (site.gumroad || null),
      preview: {
        kind: 'vfx', id: v.id, title: v.en, native: v.vi, color: el.color, group: el.label,
        fps: d.fps, frames: d.frames, durationMs: d.durationMs, layers: d.layers, directions: v.directions,
        packs: {
          desktop: { url: `${cdn}/${v.id}.vfxb`, bytes: d.bytes, vram: d.vram, sheets: d.sheets, maxSheet: d.maxSheet },
          mobile: { url: `${cdn}/${v.id}.m.vfxb`, bytes: m.bytes, vram: m.vram, sheets: m.sheets, maxSheet: m.maxSheet },
        },
        live, tier: vram.tier,
      },
    } satisfies Card;
  });
}

export function propsCards(): Card[] {
  return propsSpecs.map(p => {
    const info = packs[p.id];
    if (!info) throw new Error(`No copy for props pack ${p.id}`);
    const kit = 'kit' in p && p.kit;
    const title = kit ? 'Phố Cổ Town Kit' : `${'en' in p ? p.en : p.id}`;
    const native = kit ? 'Phố Cổ' : 'title' in p ? String(p.title) : '';
    const atlasVram = 'vram' in p ? p.vram : 0;
    const vram = vramTier(atlasVram, 'The albedo + shadow atlas');
    const live = `${site.props}/${p.id}/`;
    const zip = `${site.props}/${p.id}/${p.zip}`;
    return {
      kind: 'props', id: p.id, title, native, group: kit ? 'kit' : 'pack', groupLabel: info.zone, color: info.color,
      tag: kit ? 'Map kit' : `v${'version' in p ? p.version : ''}`,
      description: info.description,
      poster: kit
        ? { src: media(`/media/props/${p.id}.webp`), width: 820, height: 530, alt: 'Phố Cổ starter map assembled from the modular terrain and building kit' }
        : { src: media(`/media/props/${p.id}.webp`), width: 880, height: 560, alt: `${title} (${native}) props arranged on their ground plate` },
      hover: 'hero' in p && p.hero ? { type: 'spin', src: media(`/media/props/${p.id}-spin.webp`), frames: 8, label: String(p.hero).replace(/[-_]/g, ' ') } : null,
      badges: [
        { label: 'PixiJS 8.x', title: 'Isobaker loads the atlas into PixiJS 8 (a standalone import sample needs no runtime)' },
        { label: 'WebP Atlas', title: 'Trimmed WebP atlas pages + JSON, plus loose PNGs, at 96 px per tile' },
        { label: 'Zero-GC', title: 'Isobaker’s adapter hot path creates no objects, arrays, closures or textures in steady state' },
        tierBadge(vram),
      ],
      fps: { bake: 'Static · 8 facings', target: `Target ${TARGET_FPS} FPS`, title: `Pre-rendered static sprites in eight facings (albedo, shadow, depth, normal); nothing to animate, so they hold the game loop’s ${TARGET_FPS} FPS target` },
      vram,
      meta: kit
        ? [`${p.assets} assets`, `${p.pngSprites} sprites`, '3 ZIPs']
        : [`${p.assets} assets`, `${p.pngSprites} sprites`, `${p.atlasPages} pages`, 'Y 0.57735'],
      live: { href: live, label: 'Test Live' },
      downloads: [
        { href: zip, label: kit ? 'Starter map ZIP' : 'WebP Atlas + JSON', detail: mb(p.bytes), download: true, title: kit ? 'Editable starter level (the terrain and building kits are on the kit page)' : `Free pack ZIP: WebP atlas pages, atlas.json and loose PNGs (${mb(p.bytes, 2)})` },
      ],
      gumroad: site.gumroadProducts[p.id] ?? (site.gumroad || null),
      preview: {
        kind: 'props', id: p.id, title, native, color: info.color, group: info.zone,
        spin: 'hero' in p && p.hero ? media(`/media/props/${p.id}-spin.webp`) : null,
        turntable: 'turntable' in p && p.turntable ? { src: media(`/media/props/${p.id}-turntable.webp`), ...(p.turntable as { w: number; h: number; scale: number }) } : null,
        poster: media(`/media/props/${p.id}.webp`),
        hero: 'hero' in p ? String(p.hero) : '', facings: ('facings' in p ? p.facings : []) as string[],
        dims: 'heroDims' in p ? (p.heroDims as [number, number][]) : [],
        vram: atlasVram, vramAll: 'vramAll' in p ? p.vramAll : 0, tile: p.tile, compression: 0.57735,
        zip, zipBytes: p.bytes, live, tier: vram.tier,
      },
    } satisfies Card;
  });
}
