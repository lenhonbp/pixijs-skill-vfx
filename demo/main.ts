// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
// Showcase for the kit: a 2.5D arena (Blender-style rig), a caster, three training dummies,
// and every sample skill from examples/skills.ts. Build: npm run build (see README).
import { Application, Container, Sprite, Texture } from 'pixi.js';
import {
  VfxWorld, createVfxTextures, isPixiV8, textureFromCanvas, rigFromBlender, anchorAtFeet,
  hitSkin, rockBack, getElement, hitSpark, damageNumber, activeHitFlashes, ELEMENTS, Distortion, Bloom, Palette, Vec3, outCubic, lerp, rand, setRng, mulberry32,
  skillActivation, skillEvolution, empoweredHit, empoweredAura, empoweredWorld, activationRelease, ActivationTier, PALETTES, withDamageTickFeedback, Handle,
} from '../kit';
import { SKILLS, SkillDef, Unit, SkillContext } from '../examples/skills';

const W = 1120, H = 630;
const HP_BAR_LIFT = 14;
const NUMBER_CLEARANCE = 28;
const HOTKEYS = '1234567890QWFERTYUIOZXCVBNMJK';
const KEY_ORDER = ['kim', 'moc', 'thuy', 'hoa', 'tho', 'phong', 'loi', 'neutral']
  .flatMap((element) => SKILLS.filter((s) => s.element === element));
/** Phones and touch tablets: lighter defaults, no hover-only UI. */
const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const ELEMENT_COLORS: Record<string, string> = { kim: '#f3d36b', moc: '#7ee05a', thuy: '#4fc3ff', hoa: '#ff7a2a', tho: '#d9a050', phong: '#8ff0d0', loi: '#a8b4ff', neutral: '#b48cff' };

async function createApp() {
  const opts = { width: W, height: H, background: 0x14121b, backgroundColor: 0x14121b, antialias: !MOBILE, powerPreference: 'high-performance', resolution: Math.min(MOBILE ? 1.5 : 2, devicePixelRatio), autoDensity: true };
  const A: any = Application;
  if (isPixiV8()) {
    const app = new A();
    await app.init(opts);
    return app as Application;
  }
  return new A(opts) as Application;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Stone arena on a 2:1 ground plane (matches groundSquash 0.5 from the rig below). */
function arenaTexture(squash: number) {
  const [c, ctx] = canvas(W, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0d0c14');
  sky.addColorStop(1, '#1b1824');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.66, tile = 64;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = -14; i <= 14; i++) {
    for (let j = -14; j <= 14; j++) {
      const x = cx + (i - j) * tile * 0.5 * 1.0, y = cy + (i + j) * tile * 0.5 * squash;
      if (y < 150 || y > H + 40 || x < -80 || x > W + 80) continue;
      const v = 38 + rnd() * 14;
      ctx.fillStyle = `rgb(${v + 4},${v + 2},${v + 12})`;
      ctx.beginPath();
      ctx.moveTo(x, y - tile * 0.5 * squash + 1);
      ctx.lineTo(x + tile * 0.5 - 1.5, y);
      ctx.lineTo(x, y + tile * 0.5 * squash - 1);
      ctx.lineTo(x - tile * 0.5 + 1.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.stroke();
    }
  }
  // engraved arena ring
  ctx.save();
  ctx.translate(cx, cy - 20);
  ctx.scale(1, squash);
  ctx.strokeStyle = 'rgba(180,170,220,0.10)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 0, 430, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 400, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // horizon fade + vignette
  const fade = ctx.createLinearGradient(0, 120, 0, 260);
  fade.addColorStop(0, 'rgba(13,12,20,1)');
  fade.addColorStop(1, 'rgba(13,12,20,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, 260);
  const vig = ctx.createRadialGradient(cx, H * 0.6, H * 0.35, cx, H * 0.6, W * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  return textureFromCanvas(c);
}

// Stand-ins for Blender renders: lit from the upper left (sun), feet at (40, 116).
const FEET = { x: 40, y: 116 };

function figurePainter(ctx: CanvasRenderingContext2D) {
  const shade = (x: number, y: number, width: number, light: string, mid: string, dark: string) => {
    const g = ctx.createLinearGradient(x, y, x + width, y + width * 0.28);
    g.addColorStop(0, light); g.addColorStop(0.4, mid); g.addColorStop(1, dark);
    return g;
  };
  const shape = (path: string, fill: string | CanvasGradient, edge = '#242431', width = 0.9) => {
    const p = new Path2D(path);
    ctx.fillStyle = fill; ctx.fill(p);
    ctx.strokeStyle = edge; ctx.lineWidth = width; ctx.stroke(p);
  };
  const line = (path: string, color: string, width = 0.7) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(new Path2D(path));
  };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  return { shade, shape, line };
}

function heroTexture() {
  const [c, ctx] = canvas(80, 120);
  const { shade, shape, line } = figurePainter(ctx);
  const gold = shade(22, 30, 35, '#fff0b0', '#cda65f', '#785139');
  const silk = shade(23, 42, 37, '#a8c7d8', '#507d99', '#293c62');
  const blue = shade(20, 45, 37, '#7089ab', '#3b527a', '#29334e');
  const skin = shade(35, 26, 13, '#ffdfb9', '#d6a783', '#956957');
  // Back hair, mantle and the planted staff.
  shape('M33 28 Q23 43 25 72 L46 79 Q55 49 45 28Z', shade(25, 30, 29, '#677082', '#353c50', '#262838'));
  shape('M29 48 Q20 60 17 91 L23 106 L34 82 L49 108 L57 103 Q52 68 48 47Z', blue);
  shape('M66 26 L69 26 L69 114 Q67 117 65 114Z', shade(65, 26, 5, '#e5c594', '#99744e', '#513e38'));
  for (const y of [32, 37, 75, 79, 108]) line(`M65.5 ${y} L69 ${y - 0.5}`, '#e4c380', 1.1);
  // Boots are visible below the separated robe panels.
  shape('M29 101 L38 101 L37 114 Q33 118 24 115 L25 112Z', shade(25, 102, 14, '#9c9ca5', '#4f5365', '#303447'));
  shape('M42 102 L50 102 L52 111 L57 114 Q56 117 43 115Z', shade(42, 102, 15, '#858796', '#4d4e62', '#2b2f40'));
  line('M25 113 L36 114 M44 113 L54 114', '#cfb483');
  // Ivory under-robe and the overlapping blue silk outer panels.
  shape('M31 59 L47 58 L52 109 Q40 114 27 109Z', shade(28, 60, 25, '#f6e8c8', '#c9c8bb', '#78818d'));
  shape('M31 58 L41 66 L36 108 Q27 111 20 107 L26 81Z', silk);
  shape('M42 62 L48 57 Q49 80 58 108 L46 110 L39 81Z', blue);
  line('M30 71 Q28 92 24 104 M34 80 L31 104 M47 77 L51 103 M42 87 L45 104', '#253750', 1.2);
  line('M28 73 L24 100 M31 77 L28 103 M48 84 L53 104', '#b9d0d9', 0.65);
  line('M21 106 Q28 109 36 107 M46 108 L57 106', '#e4c98b', 1.5);
  // Wide sleeves: left hand relaxed, right forearm reaches the hand socket.
  shape('M31 45 Q23 45 21 57 L18 73 Q23 78 30 75 L36 55Z', silk);
  shape('M20 71 L28 73 L27 81 Q24 85 21 81Z', skin);
  line('M23 77 L23 81 M25 77 L25 82', '#9d6e59', 0.55);
  shape('M46 46 Q51 46 55 52 L61 54 L60 64 Q51 65 45 58Z', silk);
  shape('M58 53 L65 54 L65 61 L59 62Z', gold);
  shape('M64 54 Q69 51 71 54 L71 59 Q69 62 65 59Z', skin);
  line('M67 55 L70 55 M67 57 L70 57 M67 59 L70 59', '#926553', 0.6);
  shape('M29 44 L37 41 L44 42 L49 47 L42 64 L33 61Z', silk);
  shape('M33 42 L39 49 L44 42 L46 46 L40 59 L29 47Z', shade(30, 43, 17, '#fff3d0', '#d7c9a6', '#8c8e91'));
  line('M31 44 L39 53 L45 45', '#f5d590', 1);
  shape('M29 61 Q39 64 48 60 L49 66 Q39 70 29 66Z', shade(29, 61, 20, '#d0a86b', '#8d6952', '#564449'));
  shape('M38 63 L43 63 L43 68 L38 68Z', gold);
  shape('M42 68 Q43 79 38 85 L36 81 L39 69Z', '#c6b287');
  // Neck, three-quarter face, swept hair and jade crown.
  shape('M37 36 L44 36 L44 44 Q41 48 36 42Z', skin);
  shape('M33 25 Q38 20 46 26 L47 32 L50 35 L47 37 Q47 43 41 43 L35 39 L32 31Z', skin);
  shape('M31 34 Q27 22 35 20 Q35 14 42 17 Q47 18 46 23 Q51 27 47 32 L44 29 L42 25 Q38 31 33 30 L34 37Z', shade(29, 20, 21, '#8d96a7', '#464c60', '#292c40'));
  line('M32 26 Q36 23 40 23 M33 28 Q38 26 41 24 M38 19 L42 19', '#adb1bb', 0.65);
  shape('M35 20 L35 17 L44 18 L45 21Z', gold);
  shape('M39 16 L42 15 L43 20 L40 21Z', '#9bd6ce');
  line('M43 32 L46 32 M45 33 L46 33', '#423d49', 0.8);
  line('M44 38 L46 38 M46 35 L47 36', '#ad7664', 0.65);
  // Gilded lotus cage around a luminous, shaded pearl.
  shape('M66 28 Q57 22 61 14 L64 19 L67 24 L71 19 L74 14 Q78 23 69 28Z', gold);
  const halo = ctx.createRadialGradient(67, 16, 2, 67, 16, 12);
  halo.addColorStop(0, 'rgba(176,238,255,0.65)'); halo.addColorStop(1, 'rgba(114,201,255,0)');
  ctx.fillStyle = halo; ctx.fillRect(55, 4, 24, 24);
  const pearl = ctx.createRadialGradient(65, 13, 0.5, 68, 17, 6);
  pearl.addColorStop(0, '#ffffff'); pearl.addColorStop(0.35, '#c6ffff'); pearl.addColorStop(0.75, '#70bacf'); pearl.addColorStop(1, '#4b6eaa');
  ctx.fillStyle = pearl; ctx.beginPath(); ctx.ellipse(67, 16, 4.8, 6, -0.2, 0, Math.PI * 2); ctx.fill();
  line('M63 24 Q67 27 72 22 M66 29 L69 29', '#fff0bd', 1);
  return textureFromCanvas(c);
}

function dummyTexture() {
  const [c, ctx] = canvas(80, 120);
  const { shade, shape, line } = figurePainter(ctx);
  const wood = shade(29, 19, 25, '#f0cc8d', '#b78650', '#6b4936');
  const iron = shade(28, 25, 27, '#a9b3b6', '#626e79', '#37404d');
  const peg = shade(40, 40, 26, '#e9c18b', '#b08050', '#70503b');
  // Low mortised stand, with two splayed feet and visible top bevels.
  shape('M20 105 L58 105 L65 113 L60 117 L16 113Z', shade(16, 104, 48, '#b99c74', '#7e6550', '#453e38'));
  shape('M25 101 L31 100 L51 114 L46 118 L21 108Z', shade(21, 101, 30, '#d2b48b', '#907155', '#504236'));
  line('M18 109 L58 113 L62 112 M25 103 L48 115', '#d1ad79', 0.8);
  shape('M33 88 L48 88 L48 110 Q41 114 32 109Z', wood);
  // Continuous lathed post, not a humanoid torso.
  shape('M29 24 Q40 17 52 24 L52 95 Q42 101 29 95Z', wood);
  line('M31 28 L31 92', '#f4d69b', 1.1);
  for (let i = 0; i < 7; i++) {
    const x = 33 + i * 2.5;
    line(`M${x} 29 C${x - 3} 46 ${x + 3} 49 ${x} 64 S${x - 2} 83 ${x} 94`, i % 2 ? '#c89b66' : '#89603f', 0.45);
  }
  shape('M29 24 C29 18 52 18 52 24 C52 30 29 30 29 24Z', '#d9b47b');
  for (const r of [3, 6, 9]) {
    ctx.strokeStyle = '#9b764d'; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.ellipse(40.5, 24, r, r * 0.29, 0, 0, Math.PI * 2); ctx.stroke();
  }
  line('M41 24 L47 22 L49 22', '#79573d', 0.6);
  // Forged bands with reflected sky light and individual rivets.
  for (const y of [31, 81]) {
    shape(`M29 ${y} Q40 ${y + 4} 52 ${y} L52 ${y + 5} Q41 ${y + 9} 29 ${y + 5}Z`, iron);
    line(`M30 ${y + 1} Q40 ${y + 4} 51 ${y + 1}`, '#c2bda9', 0.65);
    for (const x of [32, 47]) { ctx.fillStyle = '#d3cbb4'; ctx.beginPath(); ctx.arc(x, y + 3.5, 0.8, 0, Math.PI * 2); ctx.fill(); }
  }
  // Two upper striking arms, one lower arm, and an angled low leg.
  shape('M33 44 L17 38 L9 41 L11 47 L32 51Z', peg);
  shape('M44 43 L65 34 L71 36 L70 42 L48 51Z', peg);
  shape('M40 60 L64 61 L68 65 L65 70 L40 68Z', peg);
  line('M13 42 L29 47 M49 46 L66 38 M45 63 L63 65', '#f6d9a4', 1);
  shape('M38 88 L48 87 L59 98 L65 99 L67 104 L61 107 L53 103Z', peg);
  line('M43 90 L57 101 L63 102', '#e4bc87', 0.9);
  // Peg end grain and socket shadows make the arms read as solid cylinders.
  for (const [x, y, rx, ry] of [[11, 44, 2.7, 3.4], [69, 38, 2.6, 3.5], [65, 65, 2.8, 3.8]]) {
    ctx.fillStyle = '#d6af77'; ctx.strokeStyle = '#715039'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    line(`M${x - 0.8} ${y - 1.6} Q${x + 1.6} ${y} ${x - 0.5} ${y + 1.7}`, '#987044', 0.5);
  }
  for (let i = 0; i < 5; i++) line(`M30 ${72 + i * 1.45} Q40 ${76 + i * 1.45} 51 ${72 + i * 1.45}`, i % 2 ? '#e4c392' : '#8e704f', 1);
  line('M34 54 L38 57 M35 57 L39 60 M46 53 L43 56 M35 69 L38 70 M44 91 L46 94', '#f2d5a1', 0.8);
  line('M36 54 L39 56 M44 57 L46 55 M33 91 L35 86', '#79523c', 0.6);
  return textureFromCanvas(c);
}

function guardianTexture() {
  const [c, ctx] = canvas(80, 120);
  const g = ctx.createRadialGradient(40, 50, 4, 40, 60, 46);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,226,154,0.9)'); g.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(40, 8); ctx.quadraticCurveTo(70, 40, 58, 112); ctx.lineTo(22, 112); ctx.quadraticCurveTo(10, 40, 40, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(40, 32, 9, 0, Math.PI * 2); ctx.fill();
  return textureFromCanvas(c);
}

function shadowTexture() {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return textureFromCanvas(c);
}

function whiteTexture() {
  const [c, ctx] = canvas(4, 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 4, 4);
  return textureFromCanvas(c);
}

(async () => {
  const app = await createApp();
  const view = ((app as any).canvas ?? (app as any).view) as HTMLCanvasElement;
  document.getElementById('stage')!.prepend(view);

  const camera = new Container();
  app.stage.addChild(camera);
  // Numbers as printed by tools/blender_vfx_rig.py: Rotation X 60 (2:1), ortho 20 m over 960 px, sun down-right.
  const rig = rigFromBlender({ rotationXDeg: 60, orthoScale: 20, renderSizePx: 960 }, { shadowScreenAngleDeg: 25, elevationDeg: 50 });
  camera.addChild(new Sprite(arenaTexture(rig.groundSquash)));
  const layers = VfxWorld.createLayers(camera);
  const seedParam = new URLSearchParams(location.search).get('seed');
  const w = new VfxWorld({ ...layers, camera, groundSquash: rig.groundSquash, shadow: rig.shadow, maxParticles: 2500,
    seed: seedParam === null ? undefined : Number(seedParam) });
  const tex = createVfxTextures();
  // Post FX: screen-space distortion on the arena, bloom composited on top of it.
  const distortion = w.use(new Distortion({ renderer: app.renderer, target: camera, width: W, height: H, scale: 26 }));
  const bloom = w.use(new Bloom({ renderer: app.renderer, source: camera, parent: app.stage, width: W, height: H, threshold: 0.66, intensity: 0.75, blur: 8, active: () => w.count > 0 }));
  const shadowTex = shadowTexture();
  const white = whiteTexture();

  interface DemoUnit extends Unit { home: { x: number; y: number }; shadow: Sprite; hp: number; hpBar: Sprite; hpBack: Sprite; bob: number; enemy: boolean }
  const units: DemoUnit[] = [];
  const makeUnit = (texture: Texture, x: number, y: number, facing: number, enemy: boolean): DemoUnit => {
    const sprite = new Sprite(texture);
    anchorAtFeet(sprite, FEET.x, FEET.y);
    sprite.scale.x = facing;
    layers.body.addChild(sprite);
    const shadow = new Sprite(shadowTex);
    shadow.anchor.set(0.5);
    layers.ground.addChild(shadow);
    const hpBack = new Sprite(white), hpBar = new Sprite(white);
    hpBack.tint = 0x000000; hpBack.alpha = 0.6; hpBar.tint = 0x5ee07a;
    for (const s of [hpBack, hpBar]) { s.anchor.set(0, 0.5); layers.top.addChild(s); s.visible = enemy; }
    const u: DemoUnit = { sprite, feet: { x, y, z: 0 }, height: 96, facing, home: { x, y }, shadow, hp: 1, hpBar, hpBack, bob: rand(0, 6), enemy };
    units.push(u);
    return u;
  };
  const hero = makeUnit(heroTexture(), 330, 410, 1, false);
  const dummyTex = dummyTexture();
  const enemies = [makeUnit(dummyTex, 790, 405, -1, true), makeUnit(dummyTex, 900, 330, -1, true), makeUnit(dummyTex, 905, 490, -1, true)];
  const guardianTex = guardianTexture();

  const sync = (u: DemoUnit, t: number) => {
    const bob = u.enemy ? 0 : Math.sin(t / 320 + u.bob) * 1.5;
    u.sprite.position.set(u.feet.x, u.feet.y - u.feet.z - bob);
    u.sprite.zIndex = u.feet.y;
    u.sprite.scale.x = u.facing;
    const sp = w.shadowPoint({ x: u.feet.x, y: u.feet.y, z: 24 });
    u.shadow.position.set(sp.x, sp.y);
    u.shadow.scale.set(1.15, 1.15 * rig.groundSquash);
    u.shadow.visible = u.feet.z < 2 && u.sprite.visible;
    const bw = 56;
    const hudY = u.feet.y - u.height - HP_BAR_LIFT;
    u.hpBack.position.set(u.feet.x - bw / 2 - 1, hudY);
    u.hpBack.scale.set((bw + 2) / 4, 7 / 4);
    u.hpBar.position.set(u.feet.x - bw / 2, hudY);
    u.hpBar.scale.set((bw * Math.max(0, u.hp)) / 4, 5 / 4);
  };

  let lastHurt = 0;
  const summons: Sprite[] = [];
  const dropSummon = (s: Sprite) => {
    const i = summons.indexOf(s);
    if (i >= 0) summons.splice(i, 1);
    s.destroy();
  };
  let empowering = false;
  const enhance = (draw: () => void) => {
    empowering = true;
    try { draw(); } finally { empowering = false; }
  };
  const castWorld = (selected: ActivationTier, palette: Palette, element: string) => {
    if (selected === 1) return w;
    const nextTick = new WeakMap<Vec3, number>();
    return withDamageTickFeedback(empoweredWorld(w, { tier: selected, palette, textures: tex }), (at, height) => {
      if (w.now < (nextTick.get(at) ?? -Infinity)) return;
      nextTick.set(at, w.now + 120);
      enhance(() => empoweredHit(w, tex, { at: { ...at, z: (at.z ?? 0) + height * 0.55 }, palette, tier: selected, tick: true, element }));
    });
  };
  const ctxFor = (selected: ActivationTier = 1, palette: Palette = PALETTES.arcane, element = 'neutral'): SkillContext & { tier?: ActivationTier } => ({
    tier: selected,
    w: castWorld(selected, palette, element), tex, caster: hero, target: enemies[0], targets: enemies,
    hurt: (u, amount, o = {}) => {
      const du = u as DemoUnit;
      const heal = amount < 0;
      if (heal) {
        damageNumber(w, tex, { x: u.feet.x, y: u.feet.y, z: u.height + 8, value: '+' + -amount, color: 0x7cff6a, size: 20 });
        return;
      }
      if (amount === 0) return;
      if (selected > 1) amount = Math.round(amount * (selected === 3 ? 1.7 : 1.3));
      const crit = o.crit || selected === 3;
      if (selected > 1) enhance(() => empoweredHit(w, tex, { at: { ...u.feet, z: (u.feet.z ?? 0) + u.height * 0.55 }, palette: o.palette ?? palette, tier: selected, element }));
      const feedback = o.feedback ?? 1;
      hitSkin(w, u.sprite, o.skin ?? getElement(current.element)?.hitSkin ?? 'red');
      rockBack(w, u.sprite, { push: o.push ?? (o.crit ? 12 : 6),
        angle: o.angle ?? Math.atan2(u.feet.y - hero.feet.y, u.feet.x - hero.feet.x) });
      if (o.palette) hitSpark(w, tex, { x: u.feet.x, y: u.feet.y, z: u.height * 0.55, palette: o.palette, angle: o.angle ?? Math.PI, size: Math.sqrt(feedback), refresh: selected > 1, coreAlpha: o.coreAlpha });
      damageNumber(w, tex, { x: u.feet.x, y: u.feet.y, z: u.height + HP_BAR_LIFT + NUMBER_CLEARANCE,
        value: amount, crit, compact: selected > 1, color: o.color ?? (crit ? 0xffd04a : 0xffffff), duration: o.numberDuration });
      du.hp = Math.max(0.05, du.hp - amount / 1600);
      lastHurt = w.now;
    },
    returnHome: () => {
      const from = { ...hero.feet };
      let t = 0;
      w.addUpdater((dt) => {
        t = Math.min(1, t + dt / 260);
        hero.feet.x = lerp(from.x, hero.home.x, outCubic(t));
        hero.feet.y = lerp(from.y, hero.home.y, outCubic(t));
        hero.feet.z = 0;
        return t < 1;
      });
    },
    setVisible: (u, v) => { u.sprite.visible = v; },
    summon: (at, _element, visualized) => {
      if (visualized) return;
      const s = new Sprite(guardianTex);
      anchorAtFeet(s, FEET.x, FEET.y);
      s.blendMode = (isPixiV8() ? 'add' : 1) as any;
      layers.body.addChild(s);
      summons.push(s);
      let age = 0;
      w.addUpdater((dt) => {
        age += dt;
        s.position.set(at.x, at.y - 10 - Math.sin(age / 300) * 6);
        s.zIndex = at.y;
        s.alpha = Math.min(1, age / 200) * (age > 2400 ? Math.max(0, 1 - (age - 2400) / 500) : 1);
        s.scale.set(0.8 + 0.2 * Math.min(1, age / 250));
        if (age > 2900) { dropSummon(s); return false; }
      });
    },
  });

  const resetScene = () => {
    w.clear();
    while (summons.length) dropSummon(summons[0]);
    for (const f of activeHitFlashes) f.destroy();
    activeHitFlashes.clear();
    for (const u of units) { u.feet.x = u.home.x; u.feet.y = u.home.y; u.feet.z = 0; u.sprite.visible = true; u.hp = 1; }
    hero.facing = 1;
    if (idleEnabled) refreshIdle();
  };

  // ---------------------------------------------------------------- UI
  const $ = (id: string) => document.getElementById(id)!;
  let current: SkillDef = SKILLS[0];
  let tier: ActivationTier = 1;
  let idleAura: Handle | undefined;
  let idleEnabled = !new URLSearchParams(location.search).has('debug');
  const setTier = (value: ActivationTier) => {
    if (![1, 2, 3].includes(value)) throw new Error(`Invalid activation tier: ${value}`);
    tier = value;
    ($('tier') as HTMLSelectElement).value = String(value);
    refreshIdle();
  };
  const activationOptions = (element: string, selected: ActivationTier | 0 = tier) => ({ at: () => hero.feet, height: hero.height, element,
    palette: ELEMENTS[element as keyof typeof ELEMENTS]?.palette ?? (selected <= 1 ? PALETTES.arcane :
      (current.id === 'summon-spirit' ? { core: 0xffffff, main: 0xffe29a, dark: 0xb08020 } :
        current.id === 'sunder-mark' ? { core: 0xffd59a, main: 0xf36b38, dark: 0x542027 } :
        current.id === 'curse-weaken' ? { core: 0x91c76e, main: 0xa34de0, dark: 0x21182d } :
        current.id === 'war-cry' ? PALETTES.fire : { core: 0xf0e0ff, main: 0x9a5cff, dark: 0x240a4a })) });
  const refreshIdle = () => {
    idleAura?.stop(); idleAura = undefined;
    if (idleEnabled && tier > 1) idleAura = empoweredAura(w, tex, { ...activationOptions(current.element), tier, duration: Infinity, idle: true });
  };
  const flourishes = ['hoa', 'thuy'].flatMap(element => [
    ...([1, 2, 3] as const).map(t => ({ id: `activation-${element}-${t}`, length: 2300, element, tier: t })),
    { id: `evolution-${element}`, length: 1800, element, tier: 3 as const },
  ]);
  const flourish = (id: string) => {
    const effect = flourishes.find(f => f.id === id);
    if (!effect) return false;
    const options = activationOptions(effect.element, effect.tier);
    if (id.startsWith('evolution')) skillEvolution(w, tex, { ...options, fromTier: 2, toTier: 3 });
    else skillActivation(w, tex, { ...options, tier: effect.tier });
    return true;
  };
  let filter = 'all';
  // Showcase advances on the VFX clock, so it waits while paused and follows the speed setting.
  let showcase: { i: number; left: number } | null = null;
  let paused = false;

  const cast = (s: SkillDef, selected: ActivationTier | 0 = tier) => {
    current = s;
    if (idleEnabled) refreshIdle();
    renderInfo();
    renderList();
    if (selected) skillActivation(w, tex, { ...activationOptions(s.element, selected), tier: selected });
    const delay = selected ? activationRelease(selected) : 0;
    if (delay) w.after(delay, () => startSkill(s, selected));
    else startSkill(s, selected);
  };
  const startSkill = (s: SkillDef, selected: ActivationTier | 0) => {
    const options = activationOptions(s.element, selected);
    if (selected > 1 && !idleEnabled) enhance(() => empoweredAura(w, tex, { ...options, tier: selected as ActivationTier, duration: s.length }));
    s.cast(ctxFor(selected || 1, options.palette, s.element));
  };

  const renderInfo = () => {
    const el = current.element;
    const color = ELEMENT_COLORS[el];
    const elName = el === 'neutral' ? 'Neutral' : `${ELEMENTS[el].vi} · ${ELEMENTS[el].en}`;
    $('info').innerHTML = `
      <div class="info-head"><span class="el" style="--c:${color}">${elName}</span><span class="cat">${current.category}</span></div>
      <h2>${current.vi}<small>${current.en}</small></h2>
      <p>${current.desc}</p>
      <div class="uses">${current.uses.map((u) => `<code>${u}</code>`).join('')}</div>`;
    $('now').style.setProperty('--c', color);
    $('now').innerHTML = `<b>${current.vi}</b><span>${current.en}</span>`;
  };

  const renderList = () => {
    const list = $('skills');
    list.innerHTML = '';
    SKILLS.forEach((s) => {
      if (filter !== 'all' && s.element !== filter) return;
      const b = document.createElement('button');
      b.className = 'skill' + (s === current ? ' active' : '');
      b.style.setProperty('--c', ELEMENT_COLORS[s.element]);
      b.innerHTML = `<kbd>${HOTKEYS[KEY_ORDER.indexOf(s)] ?? ''}</kbd><span class="names"><b>${s.vi}</b><i>${s.en}</i></span><span class="cat">${s.category}</span>`;
      b.onclick = () => { stopShowcase(); cast(s); };
      list.appendChild(b);
    });
  };

  const tabs = $('tabs');
  for (const key of ['all', 'kim', 'moc', 'thuy', 'hoa', 'tho', 'phong', 'loi', 'neutral']) {
    const b = document.createElement('button');
    b.textContent = key === 'all' ? 'All' : key === 'neutral' ? 'Utility' : ELEMENTS[key as keyof typeof ELEMENTS].vi;
    b.style.setProperty('--c', ELEMENT_COLORS[key] ?? '#ddd');
    b.dataset.key = key;
    b.onclick = () => { filter = key; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); renderList(); };
    if (key === 'all') b.classList.add('active');
    tabs.appendChild(b);
  }

  const setSpeed = (v: number) => {
    w.timeScale = v;
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === v));
  };
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => (b.onclick = () => setSpeed(Number(b.dataset.speed))));
  // Quality tiers: particle density + post FX. Phones start on Medium; slow devices step down once.
  type Quality = 'high' | 'medium' | 'low';
  const TIERS: Record<Quality, { density: number; bloom: boolean; distortion: boolean }> = {
    high: { density: 1, bloom: true, distortion: true },
    medium: { density: 0.65, bloom: false, distortion: true },
    low: { density: 0.4, bloom: false, distortion: false },
  };
  let quality: Quality = 'high';
  const syncToggles = () => {
    $('bloom').classList.toggle('on', bloom.enabled);
    $('distortion').classList.toggle('on', distortion.enabled);
  };
  const setQuality = (q: Quality) => {
    quality = q;
    w.density = TIERS[q].density;
    bloom.enabled = TIERS[q].bloom;
    distortion.enabled = TIERS[q].distortion;
    document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((b) => b.classList.toggle('active', b.dataset.quality === q));
    syncToggles();
  };
  document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((b) => (b.onclick = () => { autoQuality = false; setQuality(b.dataset.quality as Quality); }));
  // Post FX apply on world updates, which the ticker skips while paused.
  const refreshPostFx = () => { if (paused) w.refreshPlugins(); };
  $('bloom').onclick = () => { bloom.enabled = !bloom.enabled; syncToggles(); refreshPostFx(); };
  $('distortion').onclick = () => { distortion.enabled = !distortion.enabled; syncToggles(); refreshPostFx(); };
  let autoQuality = !/[?&]quality=/.test(location.search);
  const qParam = new URLSearchParams(location.search).get('quality') as Quality | null;
  setQuality(qParam && qParam in TIERS ? qParam : MOBILE ? 'medium' : 'high');
  let slowMs = 0;
  const watchFps = (dt: number) => {
    if (!autoQuality || paused || document.hidden) return;
    slowMs = dt > 24 ? slowMs + dt : Math.max(0, slowMs - dt * 0.5);
    if (slowMs > 2500 && quality !== 'low') {
      setQuality(quality === 'high' ? 'medium' : 'low');
      slowMs = 0;
    }
  };
  // Tap the arena to recast the current skill (phones have no hotkeys).
  view.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { stopShowcase(); cast(current); } });

  const togglePause = () => { paused = !paused; $('pause').classList.toggle('active', paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  const stopShowcase = () => { if (showcase !== null) { showcase = null; $('showcase').classList.remove('active'); } };
  const runShowcase = (i = SKILLS.indexOf(current)) => {
    $('showcase').classList.add('active');
    resetScene();
    cast(SKILLS[i % SKILLS.length]);
    showcase = { i, left: SKILLS[i % SKILLS.length].length + 300 + activationRelease(tier) };
  };
  $('tier').onchange = () => setTier(Number(($('tier') as HTMLSelectElement).value) as ActivationTier);
  const evolve = (fromTier: ActivationTier, toTier: ActivationTier) => {
    stopShowcase();
    resetScene();
    skillEvolution(w, tex, { ...activationOptions(current.element, toTier), fromTier, toTier });
    w.after(1600, () => setTier(toTier));
  };
  $('evolve').onclick = () => evolve(tier, (tier % 3 + 1) as ActivationTier);
  $('replay').onclick = () => { stopShowcase(); cast(current); };
  $('pause').onclick = togglePause;
  $('reset').onclick = () => { stopShowcase(); resetScene(); };
  $('showcase').onclick = () => (showcase === null ? runShowcase() : stopShowcase());
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const k = e.key.toUpperCase();
    const i = HOTKEYS.indexOf(k);
    if (i >= 0 && KEY_ORDER[i]) { stopShowcase(); cast(KEY_ORDER[i]); }
    else if (e.key === ' ') { e.preventDefault(); stopShowcase(); cast(current); }
    else if (k === 'P') togglePause();
    else if (e.key === 'Escape') { stopShowcase(); resetScene(); }
    else if (k === 'A') $('showcase').click();
    else if (k === 'S') setSpeed(w.timeScale === 1 ? 0.5 : w.timeScale === 0.5 ? 0.25 : 1);
  });
  $('version').textContent = isPixiV8() ? 'PixiJS v8' : 'PixiJS v7';
  $('count').textContent = `${SKILLS.length} sample skills`;
  renderList();
  renderInfo();

  let clock = 0;
  const frame = (dt: number) => {
    w.update(dt);
    if (showcase && !w.frozen && (showcase.left -= dt * w.timeScale) <= 0) runShowcase(showcase.i + 1);
    if (!w.frozen) clock += dt * w.timeScale;
    if (w.now - lastHurt > 1500) for (const e of enemies) e.hp = Math.min(1, e.hp + dt / 1500);
    for (const u of units) sync(u, clock);
  };
  const updateStats = (fps: number) => {
    $('stats').textContent = `${fps.toFixed(0)} fps · ${w.count} particles · ${w.timeScale}x`;
  };
  app.ticker.add(() => {
    if (!paused) frame(app.ticker.deltaMS);
    watchFps(app.ticker.deltaMS);
    updateStats(app.ticker.FPS);
  });

  // Deterministic hooks for screenshots and tests.
  const step = (ms: number) => {
    app.ticker.stop();
    for (let left = ms; left > 0; left -= 16) frame(Math.min(16, left));
    updateStats(60);
    app.renderer.render(app.stage);
  };
  (window as any).demo = {
    list: SKILLS.map((s) => s.id),
    play: (id: string) => cast(SKILLS.find((s) => s.id === id)!),
    reset: resetScene,
    step,
    vfx: w,
    setQuality,
    setTier,
    postfx: { bloom, distortion },
  };
  if (new URLSearchParams(location.search).has('debug')) {
    app.ticker.stop();
    (window as any).__vfxDebug = {
      evolve,
      skills: [...SKILLS.map(({ id, length }) => ({ id, length })), ...flourishes],
      setTier,
      getTier: () => tier,
      idleAura: (enabled: boolean) => { idleEnabled = enabled; refreshIdle(); },
      activationRelease: (selected: ActivationTier | 0) => selected ? activationRelease(selected) : 0,
      isEmpowering: () => empowering,
      moveCaster: (at: Partial<Vec3>) => Object.assign(hero.feet, at),
      cast: (id: string, selected: ActivationTier | 0 = tier) => {
        stopShowcase();
        resetScene();
        clock = 0;
        lastHurt = 0;
        if (!flourish(id)) {
          const skill = SKILLS.find((s) => s.id === id);
          if (!skill) throw new Error(`Unknown skill: ${id}`);
          cast(skill, selected);
        }
        for (const u of units) sync(u, clock);
      },
      step,
      render: () => app.renderer.render(app.stage),
      count: () => w.count,
      stats: () => w.stats,
      seed: (seed: number) => setRng(mulberry32(seed)),
      advance: frame,
      // Repeat without clear(): lifecycle checks must not hide leaks between casts.
      repeat: (id: string, selected: ActivationTier | 0 = 0) => {
        if (flourish(id)) return;
        const skill = SKILLS.find((s) => s.id === id);
        if (!skill) throw new Error(`Unknown skill: ${id}`);
        for (const u of units) { u.feet.x = u.home.x; u.feet.y = u.home.y; u.feet.z = 0; u.sprite.visible = true; u.hp = 1; }
        hero.facing = 1;
        if (selected) skillActivation(w, tex, { ...activationOptions(skill.element, selected), tier: selected });
        const delay = selected ? activationRelease(selected) : 0;
        if (delay) w.after(delay, () => startSkill(skill, selected));
        else startSkill(skill, selected);
      },
    };
  }
  if (location.hash === '#showcase') runShowcase(0);
})();

export type { Palette, Vec3 };
