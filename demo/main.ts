// Showcase for the kit: a 2.5D arena (Blender-style rig), a caster, three training dummies,
// and every sample skill from examples/skills.ts. Build: npm run build (see README).
import { Application, Container, Sprite, Texture } from 'pixi.js';
import {
  VfxWorld, createVfxTextures, isPixiV8, textureFromCanvas, rigFromBlender, anchorAtFeet,
  hitFlash, hitSpark, damageNumber, WUXING, Palette, Vec3, outCubic, lerp, rand,
} from '../kit';
import { SKILLS, SkillDef, Unit, SkillContext } from '../examples/skills';

const W = 1120, H = 630;
const HOTKEYS = '1234567890QWERTYUIO';
const ELEMENT_COLORS: Record<string, string> = { kim: '#f3d36b', moc: '#7ee05a', thuy: '#4fc3ff', hoa: '#ff7a2a', tho: '#d9a050', neutral: '#b48cff' };

async function createApp() {
  const opts = { width: W, height: H, background: 0x14121b, backgroundColor: 0x14121b, antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: true };
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

function heroTexture() {
  const [c, ctx] = canvas(80, 120);
  const lit = (x0: number, x1: number, a: string, b: string) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  // staff
  ctx.fillStyle = lit(60, 66, '#c9a15a', '#6a4a20');
  ctx.fillRect(60, 22, 5, 94);
  const orb = ctx.createRadialGradient(61, 18, 1, 62, 20, 9);
  orb.addColorStop(0, '#ffffff'); orb.addColorStop(0.4, '#9fe4ff'); orb.addColorStop(1, 'rgba(60,120,255,0.2)');
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(62, 20, 9, 0, Math.PI * 2); ctx.fill();
  // robe
  ctx.fillStyle = lit(18, 62, '#5a7ae6', '#1f2a6a');
  ctx.beginPath(); ctx.moveTo(30, 44); ctx.lineTo(50, 44); ctx.lineTo(62, 114); ctx.quadraticCurveTo(40, 120, 18, 114); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lit(18, 62, '#f3d36b', '#8a6a2a');
  ctx.fillRect(22, 104, 38, 5);
  ctx.fillRect(38, 46, 4, 58);
  // arm toward the staff
  ctx.fillStyle = lit(44, 62, '#4a66cc', '#1f2a6a');
  ctx.beginPath(); ctx.moveTo(46, 50); ctx.lineTo(62, 62); ctx.lineTo(60, 68); ctx.lineTo(44, 60); ctx.closePath(); ctx.fill();
  // hood + face
  ctx.fillStyle = lit(26, 54, '#4a66cc', '#18204e');
  ctx.beginPath(); ctx.moveTo(40, 14); ctx.quadraticCurveTo(56, 22, 54, 46); ctx.lineTo(26, 46); ctx.quadraticCurveTo(24, 22, 40, 14); ctx.fill();
  ctx.fillStyle = lit(32, 48, '#f3cfae', '#a87a5a');
  ctx.beginPath(); ctx.ellipse(41, 34, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
  return textureFromCanvas(c);
}

function dummyTexture() {
  const [c, ctx] = canvas(80, 120);
  const lit = (x0: number, x1: number, a: string, b: string) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  ctx.fillStyle = lit(36, 44, '#9a7048', '#4a3018');
  ctx.fillRect(37, 60, 6, 56);
  ctx.fillStyle = '#3a2a18';
  ctx.beginPath(); ctx.ellipse(40, 115, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lit(10, 70, '#a07a4a', '#4a3018');
  ctx.fillRect(10, 46, 60, 6);
  ctx.fillStyle = lit(22, 58, '#e8cf8a', '#8a6a30');
  ctx.beginPath(); ctx.ellipse(40, 62, 17, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,20,0.5)'; ctx.lineWidth = 1.5;
  for (const y of [48, 60, 72]) { ctx.beginPath(); ctx.moveTo(25, y); ctx.lineTo(55, y + 2); ctx.stroke(); }
  ctx.fillStyle = '#c83a3a'; ctx.beginPath(); ctx.arc(40, 62, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.arc(40, 62, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c83a3a'; ctx.beginPath(); ctx.arc(40, 62, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lit(30, 50, '#dcc08a', '#7a5a2a');
  ctx.beginPath(); ctx.ellipse(40, 28, 11, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6a4a20'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(31, 36); ctx.lineTo(49, 36); ctx.stroke();
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
  const w = new VfxWorld({ ...layers, camera, groundSquash: rig.groundSquash, shadow: rig.shadow, maxParticles: 2500 });
  const tex = createVfxTextures();
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
    u.hpBack.position.set(u.feet.x - bw / 2 - 1, u.feet.y - u.height - 14);
    u.hpBack.scale.set((bw + 2) / 4, 7 / 4);
    u.hpBar.position.set(u.feet.x - bw / 2, u.feet.y - u.height - 14);
    u.hpBar.scale.set((bw * Math.max(0, u.hp)) / 4, 5 / 4);
  };

  let lastHurt = 0;
  const summons: Sprite[] = [];
  const dropSummon = (s: Sprite) => {
    const i = summons.indexOf(s);
    if (i >= 0) summons.splice(i, 1);
    s.destroy();
  };
  const ctxFor = (): SkillContext => ({
    w, tex, caster: hero, target: enemies[0], targets: enemies,
    hurt: (u, amount, o = {}) => {
      const du = u as DemoUnit;
      const heal = amount < 0;
      if (heal) {
        damageNumber(w, tex, { x: u.feet.x, y: u.feet.y, z: u.height + 8, value: '+' + -amount, color: 0x7cff6a, size: 20 });
        return;
      }
      if (amount === 0) return;
      hitFlash(w, u.sprite, 110, 0xffffff);
      if (o.palette) hitSpark(w, tex, { x: u.feet.x, y: u.feet.y, z: u.height * 0.55, palette: o.palette, angle: o.angle ?? Math.PI });
      damageNumber(w, tex, { x: u.feet.x, y: u.feet.y, z: u.height + 8, value: amount, crit: o.crit, color: o.color ?? (o.crit ? 0xffd04a : 0xffffff) });
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
    summon: (at) => {
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
    for (const u of units) { u.feet.x = u.home.x; u.feet.y = u.home.y; u.feet.z = 0; u.sprite.visible = true; u.hp = 1; u.sprite.removeChildren(); }
    hero.facing = 1;
  };

  // ---------------------------------------------------------------- UI
  const $ = (id: string) => document.getElementById(id)!;
  let current: SkillDef = SKILLS[0];
  let filter = 'all';
  let showcase: number | null = null;
  let paused = false;

  const cast = (s: SkillDef) => {
    current = s;
    renderInfo();
    renderList();
    s.cast(ctxFor());
  };

  const renderInfo = () => {
    const el = current.element;
    const color = ELEMENT_COLORS[el];
    const elName = el === 'neutral' ? 'Neutral' : `${WUXING[el].vi} · ${WUXING[el].en}`;
    $('info').innerHTML = `
      <div class="info-head"><span class="el" style="--c:${color}">${elName}</span><span class="cat">${current.category}</span></div>
      <h2>${current.vi}<small>${current.en}</small></h2>
      <p>${current.desc}</p>
      <div class="uses">${current.uses.map((u) => `<code>${u}</code>`).join('')}</div>`;
  };

  const renderList = () => {
    const list = $('skills');
    list.innerHTML = '';
    SKILLS.forEach((s, i) => {
      if (filter !== 'all' && s.element !== filter) return;
      const b = document.createElement('button');
      b.className = 'skill' + (s === current ? ' active' : '');
      b.style.setProperty('--c', ELEMENT_COLORS[s.element]);
      b.innerHTML = `<kbd>${HOTKEYS[i] ?? ''}</kbd><span class="names"><b>${s.vi}</b><i>${s.en}</i></span><span class="cat">${s.category}</span>`;
      b.onclick = () => { stopShowcase(); cast(s); };
      list.appendChild(b);
    });
  };

  const tabs = $('tabs');
  for (const key of ['all', 'kim', 'moc', 'thuy', 'hoa', 'tho', 'neutral']) {
    const b = document.createElement('button');
    b.textContent = key === 'all' ? 'All' : key === 'neutral' ? 'Utility' : WUXING[key as keyof typeof WUXING].vi;
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
  const togglePause = () => { paused = !paused; $('pause').classList.toggle('active', paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  const stopShowcase = () => { if (showcase !== null) { clearTimeout(showcase); showcase = null; $('showcase').classList.remove('active'); } };
  const runShowcase = (i = SKILLS.indexOf(current)) => {
    $('showcase').classList.add('active');
    resetScene();
    cast(SKILLS[i % SKILLS.length]);
    showcase = window.setTimeout(() => runShowcase(i + 1), SKILLS[i % SKILLS.length].length / w.timeScale + 300);
  };
  $('replay').onclick = () => { stopShowcase(); cast(current); };
  $('pause').onclick = togglePause;
  $('reset').onclick = () => { stopShowcase(); resetScene(); };
  $('showcase').onclick = () => (showcase === null ? runShowcase() : stopShowcase());
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toUpperCase();
    const i = HOTKEYS.indexOf(k);
    if (i >= 0 && SKILLS[i]) { stopShowcase(); cast(SKILLS[i]); }
    else if (e.key === ' ') { e.preventDefault(); stopShowcase(); cast(current); }
    else if (k === 'P') togglePause();
    else if (e.key === 'Escape') { stopShowcase(); resetScene(); }
    else if (k === 'A') $('showcase').click();
    else if (k === 'S') setSpeed(w.timeScale === 1 ? 0.5 : w.timeScale === 0.5 ? 0.25 : 1);
  });
  $('version').textContent = isPixiV8() ? 'PixiJS v8' : 'PixiJS v7';
  renderList();
  renderInfo();

  let clock = 0;
  const frame = (dt: number) => {
    w.update(dt);
    if (!w.frozen) clock += dt * w.timeScale;
    if (w.now - lastHurt > 1500) for (const e of enemies) e.hp = Math.min(1, e.hp + dt / 1500);
    for (const u of units) sync(u, clock);
  };
  const updateStats = (fps: number) => {
    $('stats').textContent = `${fps.toFixed(0)} fps · ${w.count} particles · ${w.timeScale}x`;
  };
  app.ticker.add(() => {
    if (!paused) frame(app.ticker.deltaMS);
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
  };
  if (location.hash === '#showcase') runShowcase(0);
})();

export type { Palette, Vec3 };
