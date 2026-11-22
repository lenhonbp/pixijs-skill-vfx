// 28 sample skills: three per Wu Xing element, four Phong, three Lôi,
// and six neutral utility skills.
// Each skill is gameplay-agnostic: it only talks to the game through SkillContext, so you can
// copy one into your project and replace hurt()/returnHome() with your own systems.
import type { Sprite } from 'pixi.js';
import {
  VfxWorld, VfxTextures, Vec3, Palette, WUXING, PHONG, LOI, AnyElementName,
  tornado, windSlash, windSweep, vortex, windWisps, gustLines, curlDrift,
  slash, hitSpark, hitFlash, projectile, lightningChain, healAura, telegraph, shockwave,
  fireball, fireBreath, fireCharge, fireImpact, fireMeteor,
  damageOverTime, stun, shock, freeze, slow, root, statChange, damageNumber,
  silence, blind, armorBreak, mark, fear, aura, empower, haste,
  goldenBell, metalSlash, metalSparks, swordSalute, stoneArmor, spiritGuardian, mountainCrash,
  lightningStrike, staticField,
  dash, blink, leap, beam, chargeUp, summonCircle, spikeLine, spikeRing, swordRain,
  random, rand, envelope, outCubic, outQuad, lerp, clamp01,
  frostNova, glacierPath, tidalBeam,
} from '../kit';

export interface Unit {
  sprite: Sprite;
  /** Feet position (ground x, y, height z). Skills may move it. */
  feet: { x: number; y: number; z: number };
  /** On-screen height in px. */
  height: number;
  /** +1 facing right, -1 facing left. */
  facing: number;
}

export interface SkillContext {
  w: VfxWorld;
  tex: VfxTextures;
  caster: Unit;
  /** Primary target. */
  target: Unit;
  /** All enemies (target included). */
  targets: Unit[];
  /** Apply damage (positive) or healing (negative) and show it. */
  hurt(u: Unit, amount: number, o?: { crit?: boolean; palette?: Palette; angle?: number; color?: number; feedback?: number }): void;
  /** Put the caster back on its start position after a movement skill. */
  returnHome(): void;
  /** Show/hide a unit (blink). */
  setVisible(u: Unit, v: boolean): void;
  /** Spawn a temporary summoned unit; visualized means the skill supplies the figure's VFX. */
  summon?(at: Vec3, element: AnyElementName | 'neutral', visualized?: boolean): void;
}

export type SkillCategory = 'attack' | 'aoe' | 'buff' | 'debuff' | 'control' | 'movement' | 'channel' | 'summon';

export interface SkillDef {
  id: string;
  element: AnyElementName | 'neutral';
  category: SkillCategory;
  en: string;
  vi: string;
  /** One line for players. */
  desc: string;
  /** Kit functions it is built from (for documentation). */
  uses: string[];
  /** Approximate length in ms, so a showcase knows when to start the next one. */
  length: number;
  cast(ctx: SkillContext): void;
}

const chest = (u: Unit, k = 0.55): Vec3 => ({ x: u.feet.x, y: u.feet.y, z: u.feet.z + u.height * k });
const hand = (u: Unit): Vec3 => ({ x: u.feet.x + u.facing * u.height * 0.3, y: u.feet.y + 1, z: u.feet.z + u.height * 0.62 });
const feetOf = (u: Unit) => () => u.feet;
/** Ground-plane angle from a to b (screen dy un-squashed), as ground recipes expect. */
const angleTo = (w: VfxWorld, a: Unit, b: Unit) => Math.atan2((b.feet.y - a.feet.y) / w.groundSquash, b.feet.x - a.feet.x);
const inCone = (w: VfxWorld, from: Unit, u: Unit, angle: number, range: number, spread: number) => {
  const dx = u.feet.x - from.feet.x, dy = (u.feet.y - from.feet.y) / w.groundSquash;
  const d = Math.atan2(dy, dx) - angle;
  return Math.hypot(dx, dy) < range && Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < spread / 2;
};
const screenAngle = (a: Unit, b: Unit) => Math.atan2(b.feet.y - a.feet.y - (b.height - a.height) * 0.5, b.feet.x - a.feet.x);
const near = (c: Vec3, r: number, us: Unit[]) => us.filter((u) => Math.hypot(u.feet.x - c.x, (u.feet.y - c.y) * 2) < r * 1.2);

/** Move a unit's feet to a point over `ms` on the VFX clock (knockback, pull, return). */
const moveUnit = (w: VfxWorld, u: Unit, to: Vec3, ms: number, ease = outQuad) => {
  const from = { ...u.feet };
  let age = 0;
  w.addUpdater((dt) => {
    age += dt;
    const t = ease(clamp01(age / ms));
    u.feet.x = lerp(from.x, to.x, t);
    u.feet.y = lerp(from.y, to.y, t);
    u.feet.z = lerp(from.z, to.z ?? 0, t);
    if (age >= ms) return false;
  });
};

const P = {
  kim: WUXING.kim.palette, moc: WUXING.moc.palette, thuy: WUXING.thuy.palette, hoa: WUXING.hoa.palette, tho: WUXING.tho.palette, phong: PHONG.palette,
  loi: LOI.palette,
  shadow: { core: 0xf0e0ff, main: 0x9a5cff, dark: 0x240a4a },
  holy: { core: 0xffffff, main: 0xffe29a, dark: 0xb08020 },
};

export const SKILLS: SkillDef[] = [
  // ------------------------------------------------------------------ KIM / METAL
  {
    id: 'kim-sword-rain', element: 'kim', category: 'aoe', en: 'Sword Rain', vi: 'Vạn Kiếm Quy Tông',
    desc: 'A storm of gold-hilted blades falls on the area and pins every enemy inside.', uses: ['swordSalute', 'swordRain'], length: 2200,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      swordSalute(w, tex, () => chest(caster), caster.height, P.kim, 390);
      const c = { x: target.feet.x, y: target.feet.y };
      w.after(350, () => swordRain(w, tex, {
        ...c, radius: 120, count: 16, duration: 900, height: caster.height, palette: P.kim,
        onImpact: (at) => near(at, 40, targets).forEach((u) => hurt(u, Math.round(rand(38, 52)), { feedback: 0 })),
      }));
    },
  },
  {
    id: 'kim-golden-edge', element: 'kim', category: 'attack', en: 'Golden Edge', vi: 'Kim Quang Trảm',
    desc: 'Dash in, two crossing metal slashes, the target bleeds.', uses: ['dash', 'metalSlash', 'metalSparks', 'damageOverTime(bleed)', 'hitFlash'], length: 3600,
    cast: ({ w, tex, caster, target, hurt, returnHome }) => {
      const to = { x: target.feet.x - caster.facing * 70, y: target.feet.y, z: 0 };
      dash(w, tex, {
        from: { ...caster.feet }, to, palette: P.kim, sprite: caster.sprite, duration: 160, height: caster.height,
        onMove: (p) => { caster.feet.x = p.x; caster.feet.y = p.y; },
        onEnd: () => {
          const a = caster.facing > 0 ? 0 : Math.PI;
          const cut = () => chest(target, 0.55);
          metalSlash(w, tex, cut(), { angle: a - 0.53, span: caster.height * 2.1, palette: P.kim });
          w.after(80, () => {
            hurt(target, 64, { feedback: 0 });
            hitFlash(w, target.sprite, 90, P.kim.core, 0.45);
            metalSparks(w, tex, cut(), P.kim, 10, a - 0.6, 0.84);
          });
          w.after(190, () => {
            metalSlash(w, tex, cut(), { angle: a + 0.57, span: caster.height * 2.3, palette: P.kim, reverse: true });
            w.after(80, () => {
              hurt(target, 131, { crit: true, feedback: 0 });
              hitFlash(w, target.sprite, 105, P.kim.core, 0.7);
              metalSparks(w, tex, cut(), P.kim, 17, a + 0.28);
              w.hitStop(70);
              w.shake(5, 160);
              damageOverTime(w, tex, { target: feetOf(target), height: target.height, kind: 'bleed', duration: 2600, tickMs: 650, damage: () => Math.round(rand(9, 14)), onTick: () => hitFlash(w, target.sprite, 90, 0xff6070) });
            });
          });
          w.after(800, returnHome);
        },
      });
    },
  },
  {
    id: 'kim-golden-bell', element: 'kim', category: 'buff', en: 'Golden Bell', vi: 'Kim Chung Tráo',
    desc: 'A golden temple bell descends, rings under two hits, then shatters on the third.', uses: ['goldenBell', 'projectile'], length: 3800,
    cast: ({ w, tex, caster, targets }) => {
      const sh = goldenBell(w, tex, { target: feetOf(caster), height: caster.height, palette: P.kim, duration: 3000 });
      targets.slice(0, 3).forEach((e, i) => {
        w.after(700 + i * 550, () => projectile(w, tex, {
          from: chest(e, 0.6), to: { ...chest(caster), x: caster.feet.x + caster.height * 0.5 }, palette: P.shadow, speed: 700, size: 0.8,
          onHit: () => (i < 2 ? sh.hit(0) : sh.break()),
        }));
      });
    },
  },

  // ------------------------------------------------------------------ MỘC / WOOD
  {
    id: 'moc-vine-bind', element: 'moc', category: 'control', en: 'Vine Bind', vi: 'Triền Đằng Phược',
    desc: 'A seed bolt bursts into thorned vines that root the target.', uses: ['chargeUp', 'projectile', 'root'], length: 3300,
    cast: ({ w, tex, caster, target, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.moc, duration: 300,
        onDone: () => projectile(w, tex, {
          from: hand(caster), to: chest(target, 0.3), palette: { ...P.moc, core: P.moc.main }, speed: 620, arcHeight: 50, size: 0.65, alpha: 0.35,
          onHit: (at) => {
            w.spawn({ texture: tex.glow, ...at, life: 160, scale: [0.3, 0.65], alpha: [0.25, 0], tint: P.moc.main });
            w.spawn({ texture: tex.ring, ...at, life: 220, scale: [0.02, 0.15], alpha: [0.3, 0], tint: P.moc.main });
            w.spawn({ texture: tex.dot, ...at, life: 100, scale: [0.08, 0], alpha: [0.4, 0], tint: P.moc.core });
            hurt(target, 42, { palette: P.moc, feedback: 0 });
            root(w, tex, { target: feetOf(target), height: target.height, duration: 2300, palette: P.moc }).pulse();
          },
        }),
      });
    },
  },
  {
    id: 'moc-spring-bloom', element: 'moc', category: 'buff', en: 'Spring Bloom', vi: 'Xuân Hồi Đại Địa',
    desc: 'Healing petals and a regrowth aura; restores health over time.', uses: ['healAura', 'statChange'], length: 2400,
    cast: ({ w, tex, caster, hurt }) => {
      const aura = healAura(w, tex, { target: feetOf(caster), palette: P.moc, radius: 52, duration: 2000 });
      statChange(w, tex, { target: feetOf(caster), height: caster.height, up: true, palette: P.moc, duration: 1200 });
      w.stream({
        rate: 16, duration: 1800,
        make: () => ({
          texture: tex.leaf, blend: 'normal', x: caster.feet.x + rand(-60, 60), y: caster.feet.y + rand(-20, 20), z: rand(110, 150), life: 1300,
          vx: rand(-20, 20), vz: -70, rotation: rand(0, 6.3), spin: rand(-3, 3), scale: rand(0.3, 0.45), alpha: envelope(0.15, 0.8, 0.8), tint: random() < 0.3 ? WUXING.moc.accent : P.moc.main,
        }),
      });
      for (let i = 0; i < 4; i++) w.after(300 + i * 420, () => { if (aura.alive) hurt(caster, -Math.round(rand(55, 75))); });
    },
  },
  {
    id: 'moc-toxic-spores', element: 'moc', category: 'debuff', en: 'Toxic Spores', vi: 'Độc Chướng Vụ',
    desc: 'A lingering spore cloud poisons every enemy inside.', uses: ['chargeUp', 'telegraph', 'damageOverTime(poison)', 'hitFlash', 'curlDrift'], length: 3800,
    cast: ({ w, tex, caster, target, targets }) => {
      const c = { x: target.feet.x, y: target.feet.y };
      const pal = { core: 0xf0ffd0, main: 0x9cff3a, dark: 0x2f4a05 };
      chargeUp(w, tex, { target: () => hand(caster), palette: pal, duration: 350 });
      telegraph(w, tex, {
        ...c, radius: 120, duration: 450, palette: pal, finishAlpha: 0,
        onDone: () => {
          w.stream({
            rate: 22, duration: 2600,
            make: () => {
              const a = rand(0, 6.3), d = Math.sqrt(random()) * 115;
              return {
                texture: tex.puff, blend: 'normal', layer: 'body', x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * w.groundSquash, z: rand(0, 25), life: rand(1200, 1700),
                vz: rand(8, 20), vx: rand(-10, 10), rotation: rand(0, 6.3), spin: rand(-0.5, 0.5), scale: [0.6, rand(1.3, 1.8), outCubic], alpha: envelope(0.3, 0.22, 0.5), tint: [0x7ac83a, 0x3a5a1a], onUpdate: curlDrift(22, 80),
              };
            },
          });
          w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true, ...c, life: 2800, scale: 3.1, alpha: envelope(0.1, 0.35, 0.3), tint: pal.main });
          near(c, 125, targets).forEach((u) => damageOverTime(w, tex, { target: feetOf(u), height: u.height, kind: 'poison', duration: 2800, tickMs: 560, damage: () => Math.round(rand(14, 19)), onTick: () => hitFlash(w, u.sprite, 90, 0xa0ff60) }));
        },
      });
    },
  },

  // ------------------------------------------------------------------ THỦY / WATER
  {
    id: 'thuy-frost-nova', element: 'thuy', category: 'control', en: 'Frost Nova', vi: 'Băng Phong Tỏa',
    desc: 'Ice spikes erupt around the target and freeze it solid, then it shatters.', uses: ['chargeUp', 'frostNova'], length: 3300,
    cast: ({ w, tex, caster, target, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.thuy, duration: 500,
        onDone: () => {
          hurt(target, 58, { palette: P.thuy, feedback: 0.3 });
          frostNova(w, tex, { target: feetOf(target), height: target.height, palette: P.thuy, duration: 2200, onShatter: () => hurt(target, 120, { palette: P.thuy, crit: true, feedback: 0.3 }) });
        },
      });
    },
  },
  {
    id: 'thuy-tidal-beam', element: 'thuy', category: 'channel', en: 'Tidal Beam', vi: 'Thủy Long Xạ',
    desc: 'A channeled water dragon torrent that drenches and slows the target.', uses: ['chargeUp', 'tidalBeam', 'slow'], length: 3800,
    cast: ({ w, tex, caster, target, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.thuy, duration: 380,
        onDone: () => {
          const b = tidalBeam(w, tex, { from: () => hand(caster), to: () => chest(target), palette: P.thuy, duration: 1500 });
          for (let i = 0; i < 5; i++) w.after(150 + i * 280, () => b.alive && hurt(target, Math.round(rand(20, 28)), { palette: P.thuy, angle: Math.PI * (caster.facing > 0 ? 1 : 0) }));
          w.after(1500, () => slow(w, tex, { target: feetOf(target), height: target.height, duration: 2000 }));
        },
      });
    },
  },
  {
    id: 'thuy-glacier-path', element: 'thuy', category: 'aoe', en: 'Glacier Path', vi: 'Băng Hà Lộ',
    desc: 'A jagged glacier ridge fractures the ground toward the enemy.', uses: ['telegraph', 'glacierPath', 'slow'], length: 2900,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      telegraph(w, tex, {
        ...caster.feet, radius: 42, duration: 300, palette: P.thuy,
        onDone: () => glacierPath(w, tex, {
          from: caster.feet, angle: angleTo(w, caster, target), count: 9, spacing: 44, height: 85, palette: P.thuy,
          onSpike: (at) => near(at, 34, targets).forEach((u) => { hurt(u, 47, { palette: P.thuy, angle: -Math.PI / 2, feedback: 0.25 }); slow(w, tex, { target: feetOf(u), height: u.height, duration: 1600 }); }),
        }),
      });
    },
  },

  // ------------------------------------------------------------------ HỎA / FIRE
  {
    id: 'hoa-fireball', element: 'hoa', category: 'attack', en: 'Fireball', vi: 'Hỏa Cầu Thuật',
    desc: 'A charged fireball that explodes and leaves the target burning.', uses: ['fireCharge', 'fireball', 'fireImpact', 'damageOverTime(burn)', 'hitFlash'], length: 3600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      fireCharge(w, tex, {
        origin: () => hand(caster), palette: P.hoa, duration: 420,
        onDone: () => fireball(w, tex, {
          from: hand(caster), to: chest(target, 0.45), palette: P.hoa, speed: 720, size: 1.3,
          onHit: (at) => {
            fireImpact(w, tex, { x: at.x, y: at.y, radius: 80, palette: P.hoa });
            near(at, 90, targets).forEach((u) => hurt(u, u === target ? 142 : 71, { palette: P.hoa, crit: u === target }));
            damageOverTime(w, tex, { target: feetOf(target), height: target.height, kind: 'burn', duration: 2400, tickMs: 600, damage: () => Math.round(rand(11, 16)), onTick: () => hitFlash(w, target.sprite, 90, 0xffa040) });
          },
        }),
      });
    },
  },
  {
    id: 'hoa-dragon-breath', element: 'hoa', category: 'channel', en: 'Dragon Breath', vi: 'Long Tức Liệt Diễm',
    desc: 'A sweeping cone of flame that sets everything in front ablaze.', uses: ['fireCharge', 'fireBreath', 'damageOverTime(burn)'], length: 3900,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const mouth = () => ({ x: caster.feet.x + caster.facing * caster.height * 0.07, y: caster.feet.y, z: caster.feet.z + caster.height * 0.87 });
      fireCharge(w, tex, {
        origin: mouth, palette: P.hoa, duration: 300, size: 0.72,
        onDone: () => {
          const base = angleTo(w, caster, target);
          let a = base - 0.25;
          w.addUpdater(((t) => (dt) => { t += dt; a = base - 0.25 + 0.5 * Math.min(1, t / 1600); return t < 1700; })(0));
          // Reach a bit past the main target so the flames visibly wash over it.
          const range = Math.min(640, Math.hypot(target.feet.x - caster.feet.x, (target.feet.y - caster.feet.y) / w.groundSquash) + 140);
          fireBreath(w, tex, { origin: mouth, angle: () => a, palette: P.hoa, range, spread: 0.6, duration: 1700 });
          const inBreath = (u: Unit) => inCone(w, caster, u, a, range, 0.6 + 0.5);
          for (let i = 0; i < 4; i++) w.after(300 + i * 360, () => targets.filter(inBreath).forEach((u) => hurt(u, Math.round(rand(24, 32)), { palette: P.hoa })));
          w.after(1500, () => targets.filter(inBreath).forEach((u) => damageOverTime(w, tex, { target: feetOf(u), height: u.height, kind: 'burn', duration: 1800, tickMs: 600, damage: 9 })));
        },
      });
    },
  },
  {
    id: 'hoa-heaven-fire', element: 'hoa', category: 'aoe', en: 'Heavenfall Meteor', vi: 'Thiên Hỏa Lưu Tinh',
    desc: 'Calls a meteor from the sky after a short warning.', uses: ['fireCharge', 'fireMeteor'], length: 2600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      fireCharge(w, tex, { origin: () => hand(caster), palette: P.hoa, duration: 350 });
      const c = { x: target.feet.x, y: target.feet.y };
      fireMeteor(w, tex, { ...c, radius: 125, palette: P.hoa, castMs: 900, onHit: () => near(c, 130, targets).forEach((u) => hurt(u, Math.round(rand(180, 230)), { palette: P.hoa, crit: true, angle: -Math.PI / 2 })) });
    },
  },

  // ------------------------------------------------------------------ THỔ / EARTH
  {
    id: 'tho-fissure', element: 'tho', category: 'control', en: 'Earth Fissure', vi: 'Địa Liệt Trảm',
    desc: 'Rock spikes tear through the ground and stun everything they hit.', uses: ['telegraph', 'spikeLine', 'stun'], length: 3300,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const hitOnce = new Set<Unit>();
      telegraph(w, tex, {
        ...caster.feet, radius: 46, duration: 300, palette: P.tho,
        onDone: () => {
          w.shake(2, 100);
          spikeLine(w, tex, {
            from: caster.feet, angle: angleTo(w, caster, target), count: 8, spacing: 48, height: 92,
            onSpike: (at) => near(at, 38, targets).forEach((u) => {
              hurt(u, 76, { palette: P.tho, angle: -Math.PI / 2 });
              if (!hitOnce.has(u)) { hitOnce.add(u); stun(w, tex, { target: feetOf(u), height: u.height, duration: 1800 }); }
            }),
          });
        },
      });
    },
  },
  {
    id: 'tho-mountain-leap', element: 'tho', category: 'movement', en: 'Mountain Crash', vi: 'Thái Sơn Áp Đỉnh',
    desc: 'A giant craggy mountain forms overhead and crushes the ground as the caster lands.', uses: ['leap', 'mountainCrash', 'stun'], length: 3300,
    cast: ({ w, tex, caster, target, targets, hurt, returnHome }) => {
      const to = { x: target.feet.x - caster.facing * 40, y: target.feet.y + 6, z: 0 };
      leap(w, tex, {
        from: { ...caster.feet }, to, palette: P.tho, arc: 190, duration: 640, radius: 110, height: caster.height, impact: false,
        onMove: (p) => { caster.feet.x = p.x; caster.feet.y = p.y; caster.feet.z = p.z ?? 0; },
        onLand: () => {
          caster.feet.z = 0;
          w.after(900, returnHome);
        },
      });
      mountainCrash(w, tex, { ...to, radius: 110, height: caster.height * 2.3, palette: P.tho, delay: 320,
        onHit: () => near(to, 130, targets).forEach((u) => {
          hurt(u, 168, { palette: P.tho, crit: u === target, angle: -Math.PI / 2 });
          stun(w, tex, { target: feetOf(u), height: u.height, duration: 1500 });
        }),
      });
    },
  },
  {
    id: 'tho-stone-skin', element: 'tho', category: 'buff', en: 'Stone Skin', vi: 'Thạch Giáp Hộ Thể',
    desc: 'Rock plates rise and lock onto the body, then crumble into rubble.', uses: ['stoneArmor', 'statChange'], length: 4000,
    cast: ({ w, tex, caster }) => {
      const armor = stoneArmor(w, tex, { target: feetOf(caster), height: caster.height, palette: P.tho, duration: 2200 });
      w.after(650, () => {
        statChange(w, tex, { target: feetOf(caster), height: caster.height, up: true, palette: P.tho, duration: 1100 });
        w.after(1200, () => armor.hit(0.3));
      });
    },
  },

  // ------------------------------------------------------------------ PHONG / WIND (variant element)
  {
    id: 'phong-gale-blade', element: 'phong', category: 'attack', en: 'Gale Blades', vi: 'Phong Nhận Trảm',
    desc: 'A sweeping slash releases three banking wind blades that knock enemies back.', uses: ['chargeUp', 'windSweep', 'windSlash', 'gustLines'], length: 2450,
    cast: ({ w, tex, caster, targets, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.phong, duration: 250, size: 0.65,
        onDone: () => {
          const a = caster.facing > 0 ? 0 : Math.PI;
          windSweep(w, { target: feetOf(caster), angle: a - 2, palette: P.phong, radius: 75, duration: 230 });
          targets.slice(0, 3).forEach((u, i) => w.after(90 + i * 70, () => windSlash(w, tex, {
            from: hand(caster), to: chest(u, 0.45), palette: P.phong, size: 1.1, speed: 1000,
            onHit: () => {
              const k = angleTo(w, caster, u);
              hurt(u, Math.round(rand(48, 62)), { palette: P.phong, angle: k, feedback: 0.38 });
              const home = { ...u.feet };
              moveUnit(w, u, { x: home.x + Math.cos(k) * 34, y: home.y + Math.sin(k) * 34 * w.groundSquash, z: 0 }, 140);
              w.after(520, () => moveUnit(w, u, home, 380));
            },
          })));
        },
      });
    },
  },
  {
    id: 'phong-whirlwind', element: 'phong', category: 'aoe', en: 'Whirlwind', vi: 'Toàn Phong Trảm',
    desc: 'Dash in and spin into a cutting whirlwind that hits everything around three times.', uses: ['dash', 'windSweep', 'vortex', 'gustLines'], length: 3000,
    cast: ({ w, tex, caster, target, targets, hurt, returnHome }) => {
      const to = { x: target.feet.x - caster.facing * 60, y: target.feet.y + 6, z: 0 };
      dash(w, tex, {
        from: { ...caster.feet }, to, palette: P.phong, sprite: caster.sprite, duration: 170, height: caster.height,
        onMove: (p) => { caster.feet.x = p.x; caster.feet.y = p.y; },
        onEnd: () => {
          vortex(w, tex, { at: feetOf(caster), radius: 113, palette: P.phong, duration: 1230, inward: false });
          for (let i = 0; i < 3; i++) {
            w.after(i * 300, () => {
              windSweep(w, { target: feetOf(caster), height: 24 + i * 12, angle: -1.8 + i * 1.9, palette: P.phong, radius: 106 + i * 12, duration: 420 });
              w.after(120, () => near(caster.feet, 150, targets).forEach((u) => {
                const angle = angleTo(w, caster, u);
                hurt(u, Math.round(rand(34, 46)) + i * 12, { palette: P.phong, crit: i === 2, angle, feedback: 0.40 });
                gustLines(w, tex, { ...chest(u, 0.5), angle: angle + 0.55, palette: P.phong, count: 5, spread: 13 });
              }));
              if (i === 2) w.after(130, () => { w.hitStop(60); w.shake(4, 160); });
            });
          }
          w.after(1300, returnHome);
        },
      });
    },
  },
  {
    id: 'phong-tornado', element: 'phong', category: 'control', en: 'Dragon Cyclone', vi: 'Long Quyển Phong',
    desc: 'A roaring tornado travels through the enemies, pulls them in and lifts them off the ground.', uses: ['chargeUp', 'tornado', 'vortex'], length: 3600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.phong, duration: 380, size: 0.7 });
      const start = { x: caster.feet.x + caster.facing * 90, y: caster.feet.y + 10, z: 0 };
      const end = { x: target.feet.x + caster.facing * 80, y: target.feet.y, z: 0 };
      const homes = new Map(targets.map((u) => [u, { ...u.feet }]));
      const caught = new Set<Unit>();
      let tick = 0;
      w.after(320, () => {
        tornado(w, tex, {
          at: start, to: end, palette: P.phong, height: 220, radius: 80, duration: 2500, leaves: true, tickMs: 60,
          onTick: (at) => {
            tick++;
            for (const u of targets) {
              const dx = at.x - u.feet.x, dy = (at.y - u.feet.y) / w.groundSquash;
              const d = Math.hypot(dx, dy);
              if (d > 170 && !caught.has(u)) continue;
              caught.add(u);
              const a = Math.atan2(-dy, -dx) + 0.24 * clamp01(1.45 - d / 160);
              const r = lerp(d, 33, 0.17);
              u.feet.x = at.x + Math.cos(a) * r;
              u.feet.y = at.y + Math.sin(a) * r * w.groundSquash;
              u.feet.z = lerp(u.feet.z, (40 + 10 * Math.sin(a)) * clamp01(1.25 - d / 160), 0.25);
              if (tick % 6 === 0) hurt(u, Math.round(rand(16, 24)), { palette: P.phong, angle: -Math.PI / 2, feedback: 0.22 });
            }
          },
        });
      });
      // Release: everyone drops back to the ground and is pushed home.
      w.after(2850, () => caught.forEach((u) => {
        moveUnit(w, u, { ...u.feet, z: 0 }, 220, (x) => x * x);
        w.after(230, () => {
          vortex(w, tex, { at: { ...u.feet }, radius: 40, palette: P.phong, duration: 380, inward: false });
          hurt(u, Math.round(rand(40, 55)), { palette: P.phong, feedback: 0.44 });
          moveUnit(w, u, homes.get(u)!, 420);
        });
      }));
    },
  },
  {
    id: 'phong-tailwind', element: 'phong', category: 'buff', en: 'Tailwind', vi: 'Tật Phong Bộ',
    desc: 'Wind ribbons stream behind the caster: movement and attack speed up.', uses: ['windWisps', 'gustLines'], length: 2800,
    cast: ({ w, tex, caster }) => {
      windWisps(w, tex, { target: feetOf(caster), height: caster.height, radius: 40, facing: caster.facing, palette: P.phong, duration: 2400 });
      for (let i = 0; i < 4; i++) w.after(220 + i * 460, () => {
        gustLines(w, tex, { ...chest(caster, 0.32), x: caster.feet.x - caster.facing * 18, angle: caster.facing > 0 ? Math.PI : 0, palette: P.phong, count: 5, spread: 19 });
      });
    },
  },

  // ------------------------------------------------------------------ LÔI / LIGHTNING
  {
    id: 'lightning-chain', element: 'loi', category: 'attack', en: 'Chain Lightning', vi: 'Lôi Đình Liên Kích',
    desc: 'A bolt jumps between all enemies and briefly stuns them.', uses: ['chargeUp', 'lightningChain', 'stun'], length: 2700,
    cast: ({ w, tex, caster, targets, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.loi, duration: 300,
        onDone: () => {
          lightningChain(w, tex, { points: [hand(caster), ...targets.map((u) => chest(u))], palette: P.loi, impactIntensity: 0.2 });
          targets.forEach((u, i) => w.after(40 + i * 40, () => { hurt(u, 88 - i * 10, { palette: P.loi, angle: rand(0, 6.3), feedback: 0.2 }); stun(w, tex, { target: feetOf(u), height: u.height, duration: 1200, palette: P.loi }); }));
        },
      });
    },
  },
  {
    id: 'loi-heaven-strike', element: 'loi', category: 'aoe', en: 'Heavenly Thunder', vi: 'Thiên Lôi Giáng',
    desc: 'A raised charge calls staggered forked sky strikes, stunning and shocking the enemy group.',
    uses: ['chargeUp', 'telegraph', 'lightningStrike', 'stun', 'shock'], length: 3200,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.loi, duration: 300,
        release: { color: 0x7954ef, size: 0.65, coreSize: 0.2, alpha: 0.4 }, onDone: () => {
        const enemies = [target, ...targets.filter((u) => u !== target)];
        enemies.forEach((u, i) => {
          const at = { ...u.feet };
          telegraph(w, tex, { ...at, radius: 36, palette: P.loi, duration: 300 + i * 180, finishAlpha: 0,
            onDone: () => lightningStrike(w, tex, { ...at, palette: P.loi, radius: 38, onHit: () => {
              hurt(u, 115, { palette: P.loi, feedback: 0.18 });
              stun(w, tex, { target: feetOf(u), height: u.height, duration: 650, palette: P.loi });
              shock(w, tex, { target: feetOf(u), height: u.height, duration: 1200, palette: P.loi });
            } }),
          });
        });
      } });
    },
  },
  {
    id: 'loi-thunder-domain', element: 'loi', category: 'control', en: 'Thunder Domain', vi: 'Lôi Vực',
    desc: 'A violet electric field crackles under the enemy group, dealing periodic damage and shock.',
    uses: ['chargeUp', 'staticField', 'shock'], length: 3600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.loi, duration: 300,
        release: { color: 0x7954ef, size: 0.65, coreSize: 0.2, alpha: 0.4 }, onDone: () => {
        const center = targets.length ? {
          x: targets.reduce((sum, u) => sum + u.feet.x, 0) / targets.length,
          y: targets.reduce((sum, u) => sum + u.feet.y, 0) / targets.length,
        } : { ...target.feet };
        const radius = Math.max(120, ...targets.map((u) => Math.hypot(u.feet.x - center.x, (u.feet.y - center.y) / w.groundSquash) + 16));
        staticField(w, tex, { ...center, radius, palette: P.loi, duration: 2500, onTick: () => {
          for (const u of targets) if (Math.hypot(u.feet.x - center.x, (u.feet.y - center.y) / w.groundSquash) <= radius) {
            hurt(u, 24, { palette: P.loi, feedback: 0.1 });
            shock(w, tex, { target: feetOf(u), height: u.height, palette: P.loi, duration: 450 });
          }
        } });
      } });
    },
  },
  // ------------------------------------------------------------------ NEUTRAL / UTILITY
  {
    id: 'seal-silence', element: 'neutral', category: 'debuff', en: 'Silencing Seal', vi: 'Phong Ấn Thuật',
    desc: 'A sealing rune flies into the target, locking its voice and veiling its eyes.',
    uses: ['chargeUp', 'projectile', 'hitSpark', 'silence', 'blind'], length: 3800,
    cast: ({ w, tex, caster, target }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.shadow, duration: 280,
        release: { color: P.shadow.main, size: 0.5, coreSize: 0.18, alpha: 0.3 },
        onDone: () => projectile(w, tex, { from: hand(caster), to: chest(target, 0.8), palette: P.shadow,
          speed: 950, size: 0.5, onHit: () => {
            hitSpark(w, tex, { ...chest(target, 0.8), palette: { ...P.shadow, core: P.shadow.main }, size: 0.5 });
            w.spawn({ texture: tex.rune, ...target.feet, z: 35, life: 340,
              vz: -100, scale: [0.21, 0.12, outQuad], alpha: envelope(0.1, 0.5, 0.7), tint: P.shadow.main });
            silence(w, tex, { target: feetOf(target), height: target.height, duration: 2400 });
            blind(w, tex, { target: feetOf(target), height: target.height, duration: 2400 });
          },
        }),
      });
    },
  },
  {
    id: 'sunder-mark', element: 'neutral', category: 'debuff', en: 'Sundering Mark', vi: 'Phá Giáp Ấn',
    desc: 'Staggered curse marks fracture enemy armor and send fearful wisps fleeing upward.',
    uses: ['chargeUp', 'mark', 'armorBreak', 'fear'], length: 3800,
    cast: ({ w, tex, caster, targets }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.shadow, duration: 300,
        release: { color: P.shadow.main, size: 0.5, coreSize: 0.18, alpha: 0.3 },
        onDone: () => targets.forEach((u, i) => w.after(i * 150, () => {
          const at = { target: feetOf(u), height: u.height, duration: 2400 };
          mark(w, tex, at); armorBreak(w, tex, at); fear(w, tex, at);
        })),
      });
    },
  },
  {
    id: 'war-cry', element: 'neutral', category: 'buff', en: 'War Cry', vi: 'Chiến Hống',
    desc: 'A rallying shockwave surrounds the caster with a fiery power aura and trailing speed lines.',
    uses: ['chargeUp', 'shockwave', 'aura', 'empower', 'haste'], length: 4000,
    cast: ({ w, tex, caster }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.hoa, duration: 300,
        release: { color: P.hoa.main, size: 0.6, coreSize: 0.2, alpha: 0.35 },
        onDone: () => {
          shockwave(w, tex, { ...caster.feet, radius: 85, palette: P.hoa, duration: 350 });
          const at = { target: feetOf(caster), height: caster.height, duration: 3000 };
          aura(w, tex, { ...at, palette: P.hoa, radius: 38, intensity: 0.65 });
          empower(w, tex, at); haste(w, tex, at);
        },
      });
    },
  },
  {
    id: 'shadow-blink', element: 'neutral', category: 'movement', en: 'Shadow Step', vi: 'Ảnh Bộ',
    desc: 'Teleport behind the target and strike.', uses: ['blink', 'slash'], length: 2200,
    cast: ({ w, tex, caster, target, hurt, returnHome, setVisible }) => {
      const to = { x: target.feet.x + caster.facing * 55, y: target.feet.y + 4, z: 0 };
      blink(w, tex, {
        from: { ...caster.feet }, to, palette: P.shadow, height: caster.height,
        onVanish: () => setVisible(caster, false),
        onAppear: () => {
          caster.feet.x = to.x; caster.feet.y = to.y; caster.facing *= -1; setVisible(caster, true);
          w.after(90, () => {
            slash(w, tex, { ...caster.feet, angle: caster.facing > 0 ? 0 : Math.PI, palette: P.shadow, radius: 90 });
            w.after(70, () => hurt(target, 154, { palette: P.shadow, crit: true, angle: caster.facing > 0 ? 0 : Math.PI }));
          });
          w.after(800, () => { caster.facing *= -1; returnHome(); });
        },
      });
    },
  },
  {
    id: 'curse-weaken', element: 'neutral', category: 'debuff', en: 'Curse of Frailty', vi: 'Suy Nhược Chú',
    desc: 'A dark sigil lowers the attack and defense of every enemy.', uses: ['chargeUp', 'telegraph', 'statChange(down)'], length: 2000,
    cast: ({ w, tex, caster, target, targets }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.shadow, duration: 350 });
      telegraph(w, tex, { x: target.feet.x, y: target.feet.y, radius: 130, duration: 380, palette: P.shadow, onDone: () => targets.forEach((u, i) => w.after(i * 90, () => statChange(w, tex, { target: feetOf(u), height: u.height, up: false, duration: 1500 }))) });
    },
  },
  {
    id: 'summon-spirit', element: 'neutral', category: 'summon', en: 'Summon Guardian', vi: 'Triệu Hồi Hộ Pháp',
    desc: 'A spectral guardian strides into battle, cleaves twice, then leaps into a crushing holy slam.', uses: ['chargeUp', 'summonCircle', 'spiritGuardian', 'afterimage'], length: 5400,
    cast: ({ w, tex, caster, target, targets, hurt, summon }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.holy, duration: 350 });
      const at = { x: caster.feet.x + caster.facing * 120, y: caster.feet.y + 40, z: 0 };
      const slamRadius = caster.height * 2.4;
      summonCircle(w, tex, { ...at, palette: P.holy, radius: 70, duration: 1200, columnAlpha: 0.2,
        onSummon: () => {
          summon?.(at, 'neutral', true);
          w.after(200, () => spiritGuardian(w, tex, { ...at, palette: P.holy, height: caster.height * 1.4,
            target: feetOf(target), strikes: 3, slamRadius,
            onStrike: (i, impact) => {
              const angle = Math.atan2((impact.y - at.y) / w.groundSquash, impact.x - at.x);
              const victims = i === 2 ? targets.filter((u) =>
                Math.hypot(u.feet.x - impact.x, (u.feet.y - impact.y) / w.groundSquash) <= slamRadius) : [target];
              victims.forEach((u) => hurt(u, i === 2 ? 185 : 92, { palette: P.holy, angle, crit: i === 2 }));
            },
          }));
        },
      });
    },
  },
];

export { chest, hand, screenAngle };
