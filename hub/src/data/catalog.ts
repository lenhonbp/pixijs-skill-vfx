// Turns the measured specs snapshots into the cards the Asset Explorer renders.
// vfx-specs.json  ← scripts/vfx-specs.mjs (decoded from the released .vfxb manifests)
// props-specs.json ← scripts/props-media.py (Isobaker release receipts + atlas pages)
import vfxSpecs from './vfx-specs.json' with { type: 'json' };
import propsSpecs from './props-specs.json' with { type: 'json' };
import { site } from '../site.config';

export type Tone = 'plain' | 'accent' | 'ok' | 'warn';
export interface Spec { label: string; tone?: Tone; title?: string }
export interface Action { href: string; label: string; detail?: string; download?: boolean }
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
  specs: Spec[];
  meta: string[];
  live: Action;
  sample: Action;
  gumroad: string | null;
}

/** Mobile tier budget the factory gates every pack against (iPhone 13 mini / A15), decimal bytes. */
export const A15_DIRECTION_BUDGET = 45_000_000;

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

const mb = (bytes: number, digits = 1) => `${(bytes / 1e6).toFixed(digits)} MB`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface Release { base: string; release: string }

export function vfxCards(release: Release): Card[] {
  const cdn = `${release.base.replace(/\/+$/, '')}/${release.release}`;
  return vfxSpecs.map(v => {
    const el = elements[v.element] ?? elements.neutral;
    const m = v.mobile, d = v.desktop;
    const withinA15 = m.vram <= A15_DIRECTION_BUDGET;
    return {
      kind: 'vfx', id: v.id, title: v.en, native: v.vi, group: v.element, groupLabel: el.label, color: el.color,
      tag: cap(v.category),
      description: descriptions[v.id] ?? '',
      poster: { src: `/media/vfx/${v.id}.webp`, width: 800, height: 500, alt: `${v.en} (${v.vi}) captured mid-cast from the live PixiJS showcase` },
      hover: { type: 'video', src: `/media/vfx/${v.id}.mp4` },
      specs: [
        { label: 'WebP Atlas', title: `Shelf-packed sheets up to ${d.maxSheet}px` },
        { label: 'PixiJS 7/8' },
        { label: `${d.fps === m.fps ? d.fps : `${d.fps}/${m.fps}`} FPS`, title: d.fps === m.fps ? 'Playback rate' : 'Desktop / mobile playback rate' },
        { label: v.directions > 1 ? '8-dir' : 'Omni', title: v.directions > 1 ? `${v.directions} baked directions, left-facing casts mirror` : 'Looks the same in every direction' },
        withinA15
          ? { label: `VRAM ${mb(m.vram)}`, tone: 'ok', title: `Mobile pack decodes to ${mb(m.vram)} — within the A15 45 MB per-direction budget` }
          : { label: `VRAM ${mb(m.vram)}`, tone: 'warn', title: `Mobile pack decodes to ${mb(m.vram)} — over the A15 45 MB per-direction warning line (128 MB resident cap)` },
      ],
      meta: [`${(d.durationMs / 1000).toFixed(1)} s`, `${d.frames} fr`, `${d.layers} layers`, `${(d.bytes / 1e6).toFixed(1)}/${mb(m.bytes)}`],
      live: { href: `${site.vfx}/#${v.id}`, label: 'Test Live' },
      sample: { href: `${cdn}/${v.id}.vfxb`, label: 'Free Sample', detail: `.vfxb · ${mb(d.bytes)}`, download: true },
      gumroad: site.gumroadProducts[v.id] ?? (site.gumroad || null),
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
    const specs: Spec[] = [
      { label: 'WebP Atlas', title: 'Trimmed WebP pages + JSON, plus loose PNGs' },
      { label: 'PixiJS 8' },
      { label: 'Y 0.57735', tone: 'accent', title: 'Tile height / width = 1/√3 — true isometric, not 2:1' },
      { label: `${p.directions}-dir × ${p.passes} pass`, title: 'Albedo, Shadow, Depth and Normal for each facing' },
      { label: `${p.tile} px/tile` },
    ];
    if ('vram' in p && p.vram) specs.push({ label: `VRAM ${mb(p.vram)}`, tone: 'ok', title: `Albedo + shadow pages decode to ${mb(p.vram)} (${mb(p.vramAll)} with depth and normal)` });
    return {
      kind: 'props', id: p.id, title, native, group: kit ? 'kit' : 'pack', groupLabel: info.zone, color: info.color,
      tag: kit ? 'Map kit' : `v${'version' in p ? p.version : ''}`,
      description: info.description,
      poster: kit
        ? { src: `/media/props/${p.id}.webp`, width: 619, height: 400, alt: 'Phố Cổ starter map assembled from the modular terrain and building kit' }
        : { src: `/media/props/${p.id}.webp`, width: 880, height: 560, alt: `${title} (${native}) props arranged on their ground plate` },
      hover: 'hero' in p && p.hero ? { type: 'spin', src: `/media/props/${p.id}-spin.webp`, frames: 8, label: String(p.hero).replace(/[-_]/g, ' ') } : null,
      specs,
      meta: kit
        ? [`${p.assets} assets`, `${p.pngSprites} sprites`, `3 ZIPs`]
        : [`${p.assets} assets`, `${p.pngSprites} sprites`, `${p.atlasPages} pages`, `ZIP ${mb(p.bytes)}`],
      live: { href: `${site.props}/${p.id}/`, label: 'Test Live' },
      sample: { href: `${site.props}/${kit ? 'pho-co' : p.id}/${p.zip}`, label: 'Free Sample', detail: `ZIP · ${mb(p.bytes)}`, download: true },
      gumroad: site.gumroadProducts[p.id] ?? (site.gumroad || null),
    } satisfies Card;
  });
}
