// 29 sample skills: four Hỏa, three per other Wu Xing element, four Phong, three Lôi,
// and six neutral utility skills.
// Each skill is gameplay-agnostic: it only talks to the game through SkillContext, so you can
// copy one into your project and replace hurt()/returnHome() with your own systems.
import type { Sprite } from 'pixi.js';
import {
  VfxWorld, VfxTextures, Vec3, Palette, WUXING, PHONG, LOI, AnyElementName, SkillTiming, HitSkinName, onHits, hitTimes, rockBack,
  tornado, windSlash, windSweep, vortex, windWisps, windPressure, windRush,
  slash, shadowSlash, hitSpark, hitFlash, hitSkin, projectile, lightningChain, telegraph, shockwave,
  fireball, fireBreath, fireCharge, fireDragonCrossing, fireImpact, fireMeteor,
  woodCharge, seedFlight, springBloom, toxicSporeCloud,
  damageOverTime, stun, shock, freeze, slow, root, statChange, damageNumber,
  silence, blind, armorBreak, mark, fear, aura, empower, haste, sigilCharge, sunderingMark, hexField, frailty,
  goldenBell, metalSlash, metalSparks, swordSalute, stoneArmor, spiritGuardian, mountainCrash,
  lightningStrike, staticField, lightningCharge, lightningWarning, lightningStun, stormCloud,
  dash, blink, shadowStep, battleCry, leap, beam, chargeUp, summonCircle, spikeLine, spikeRing, swordRain,
  rand, envelope, outCubic, outQuad, lerp, clamp01,
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
  hurt(u: Unit, amount: number, o?: { crit?: boolean; palette?: Palette; angle?: number; color?: number; feedback?: number; coreAlpha?: number; skin?: HitSkinName; push?: number; numberDuration?: number }): void;
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
  timing?: SkillTiming;
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

const GOLDEN_EDGE_TIMING: SkillTiming = {
  windup: 160, hits: [{ t: 240, skin: 'metal', targets: 'primary' },
    { t: 430, stop: 70, shake: 5, push: 12, skin: 'metal', targets: 'primary' }], recovery: 800,
};
const SPRING_BLOOM_TIMING: SkillTiming = {
  windup: 0, hits: Array.from({ length: 4 }, (_, i) => ({ t: 300 + i * 420, skin: 'nature', push: 0 })), recovery: 840,
};
const MOUNTAIN_CRASH_TIMING: SkillTiming = {
  windup: 320, hits: [{ t: 640, stop: 80, shake: 12 * (96 * 2.3 / 160), push: 26, skin: 'earth', targets: 'all' }], recovery: 1500,
};

const SWORD_RAIN_HOVER = 800;
const SWORD_RAIN_START = 350 + SWORD_RAIN_HOVER;
const SWORD_RAIN_DURATION = 900;

const SEAL_TIMING: SkillTiming = {
  windup: 300, hits: [{ t: 300, travel: 950, effectOnly: true, skin: 'shadow', targets: 'primary' }], recovery: 2800,
};
const sunderTiming = (count = 3): SkillTiming => ({
  windup: 300, hits: Array.from({ length: count }, (_, i) => ({ t: 560 + i * 180,
    effectOnly: true, stop: 22, shake: 1.3, skin: 'metal', targets: 'all' })), recovery: 2700,
});
const SHADOW_STEP_TIMING: SkillTiming = {
  windup: 260, hits: [{ t: 580, skin: 'shadow', targets: 'primary' }], recovery: 800,
};
const frailtyTiming = (count = 3): SkillTiming => ({
  windup: 350, hits: Array.from({ length: count }, (_, i) => ({ t: 850 + i * 140,
    effectOnly: true, push: 5, skin: 'poison', targets: 'all' })), recovery: 2000,
});
const SUMMON_TIMING: SkillTiming = {
  windup: 1200, hits: [2712, 3362, 4012].map((t, i) => ({ t, stop: i === 2 ? 65 : 35,
    shake: i === 2 ? 5 : 2, skin: 'holy', targets: i === 2 ? 'all' : 'primary' })), recovery: 1200,
};

export const SKILLS: SkillDef[] = [
  // ------------------------------------------------------------------ KIM / METAL
  {
    id: 'kim-sword-rain', element: 'kim', category: 'aoe', en: 'Sword Rain', vi: 'Vạn Kiếm Quy Tông',
    timing: { windup: SWORD_RAIN_START + 100, hits: Array.from({ length: 16 }, (_, i) => ({ t: SWORD_RAIN_START + 150 + i * SWORD_RAIN_DURATION / 16, spread: 30, shake: 2.5, skin: 'metal', targets: 'all', optional: true })), recovery: 400 },
    desc: 'A storm of gold-hilted blades falls on the area and pins every enemy inside.', uses: ['swordSalute', 'swordRain'], length: 2200 + SWORD_RAIN_HOVER,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      swordSalute(w, tex, () => chest(caster), caster.height, P.kim, 420, feetOf(target), SWORD_RAIN_HOVER);
      const c = { x: target.feet.x, y: target.feet.y };
      w.after(SWORD_RAIN_START, () => swordRain(w, tex, {
        ...c, radius: 120, count: 16, duration: SWORD_RAIN_DURATION, height: caster.height, palette: P.kim,
        onImpact: (at) => near(at, 40, targets).forEach((u) => hurt(u, Math.round(rand(38, 52)), { feedback: 0 })),
      }));
    },
  },
  {
    id: 'kim-golden-edge', element: 'kim', category: 'attack', en: 'Golden Edge', vi: 'Kim Quang Trảm',
    timing: GOLDEN_EDGE_TIMING,
    desc: 'Dash in, two crossing metal slashes, the target bleeds.', uses: ['dash', 'metalSlash', 'metalSparks', 'damageOverTime(bleed)', 'hitFlash'], length: 3600,
    cast: ({ w, tex, caster, target, hurt, returnHome }) => {
      const to = { x: target.feet.x - caster.facing * 70, y: target.feet.y, z: 0 };
      dash(w, tex, {
        from: { ...caster.feet }, to, palette: P.kim, sprite: caster.sprite, duration: GOLDEN_EDGE_TIMING.windup, height: caster.height,
        onMove: (p) => { caster.feet.x = p.x; caster.feet.y = p.y; },
        onEnd: () => {
          const a = caster.facing > 0 ? 0 : Math.PI;
          const cut = () => chest(target, 0.55);
          metalSlash(w, tex, cut(), { angle: a - 0.53, span: caster.height * 2.1, palette: P.kim });
          w.after(GOLDEN_EDGE_TIMING.hits[0].t - GOLDEN_EDGE_TIMING.windup, () => {
            hurt(target, 64, { feedback: 0 });
            hitFlash(w, target.sprite, 90, P.kim.core, 0.45);
            metalSparks(w, tex, cut(), P.kim, 10, a - 0.6, 0.84);
          });
          w.after(GOLDEN_EDGE_TIMING.hits[1].t - GOLDEN_EDGE_TIMING.hits[0].t, () => {
            metalSlash(w, tex, cut(), { angle: a + 0.57, span: caster.height * 2.3, palette: P.kim, reverse: true });
            w.after(80, () => {
              hurt(target, 131, { crit: true, feedback: 0, skin: GOLDEN_EDGE_TIMING.hits[1].skin, push: GOLDEN_EDGE_TIMING.hits[1].push });
              hitFlash(w, target.sprite, 105, P.kim.core, 0.7);
              metalSparks(w, tex, cut(), P.kim, 17, a + 0.28);
              w.hitStop(GOLDEN_EDGE_TIMING.hits[1].stop!);
              w.shake(GOLDEN_EDGE_TIMING.hits[1].shake!, 160);
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
    timing: { windup: 430, hits: [], recovery: 3370 },
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
    timing: { windup: 300, hits: [{ t: 300, travel: 620, skin: 'nature', targets: 'primary' }], recovery: 2300 },
    desc: 'A sprouting seed tears open the soil and grows binding vines.', uses: ['woodCharge', 'seedFlight', 'root'], length: 3300,
    cast: ({ w, tex, caster, target, hurt }) => {
      woodCharge(w, { target: () => hand(caster), duration: 300, onDone: () => seedFlight(w, {
        from: hand(caster), to: chest(target, 0.3), speed: 620,
        onHit: () => {
          hurt(target, 42, { palette: P.moc, feedback: 0 });
          root(w, tex, { target: feetOf(target), height: target.height, duration: 2300, palette: P.moc }).pulse();
        },
      }) });
    },
  },
  {
    id: 'moc-spring-bloom', element: 'moc', category: 'buff', en: 'Spring Bloom', vi: 'Xuân Hồi Đại Địa',
    timing: SPRING_BLOOM_TIMING,
    desc: 'Grass sprouts and flowers unfold in a warm healing breeze.', uses: ['springBloom', 'statChange'], length: 2900,
    cast: ({ w, tex, caster, hurt }) => {
      const aura = springBloom(w, { target: feetOf(caster), radius: 58, duration: 2000 });
      statChange(w, tex, { target: feetOf(caster), height: caster.height, up: true, palette: P.moc, duration: 1200 });
      onHits(w, SPRING_BLOOM_TIMING, () => { if (aura.alive) hurt(caster, -Math.round(rand(55, 75))); });
    },
  },
  {
    id: 'moc-toxic-spores', element: 'moc', category: 'debuff', en: 'Toxic Spores', vi: 'Độc Chướng Vụ',
    timing: { windup: 450, hits: [], recovery: 3350 },
    desc: 'Mushrooms erupt and breathe a lingering cloud of poisonous spores.', uses: ['woodCharge', 'toxicSporeCloud', 'damageOverTime(poison)'], length: 4300,
    cast: ({ w, tex, caster, target, targets }) => {
      const c = { x: target.feet.x, y: target.feet.y };
      woodCharge(w, { target: () => hand(caster), duration: 350 });
      toxicSporeCloud(w, {
        at: c, radius: 120, duration: 2600,
        onBloom: () => near(c, 125, targets).forEach((u) => damageOverTime(w, tex, {
          target: feetOf(u), height: u.height, kind: 'poison', poisonVisual: 'spores', duration: 2800, tickMs: 560,
          damage: () => Math.round(rand(14, 19)), onTick: () => hitFlash(w, u.sprite, 90, 0x93996c),
        })),
      });
    },
  },

  // ------------------------------------------------------------------ THỦY / WATER
  {
    id: 'thuy-frost-nova', element: 'thuy', category: 'control', en: 'Frost Nova', vi: 'Băng Phong Tỏa',
    timing: { windup: 500, hits: [{ t: 500, skin: 'ice', push: 6, targets: 'primary' }, { t: 2700, skin: 'ice', push: 12, targets: 'primary' }], recovery: 600 },
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
    timing: { windup: 380, hits: Array.from({ length: 5 }, (_, i) => ({ t: 530 + i * 280, skin: 'ice', push: 0, targets: 'primary' })), recovery: 1500 },
    desc: 'A channeled water dragon torrent that drenches and slows the target.', uses: ['chargeUp', 'tidalBeam', 'slow'], length: 3800,
    cast: ({ w, tex, caster, target, hurt }) => {
      const orb = () => {
        const at = hand(caster);
        return { x: at.x - caster.facing * caster.height * 0.07, y: at.y, z: at.z! + caster.height * 0.38 };
      };
      chargeUp(w, tex, {
        target: orb, palette: P.thuy, duration: 380,
        onDone: () => {
          const b = tidalBeam(w, tex, { from: orb, to: () => chest(target), palette: P.thuy, duration: 1500 });
          for (let i = 0; i < 5; i++) w.after(150 + i * 280, () => b.alive && hurt(target, Math.round(rand(20, 28)), { palette: P.thuy, push: 0, angle: Math.PI * (caster.facing > 0 ? 1 : 0) }));
          w.after(1500, () => slow(w, tex, { target: feetOf(target), height: target.height, duration: 2000 }));
        },
      });
    },
  },
  {
    id: 'thuy-glacier-path', element: 'thuy', category: 'aoe', en: 'Glacier Path', vi: 'Băng Hà Lộ',
    timing: { windup: 300, hits: Array.from({ length: 9 }, (_, i) => ({ t: 300 + i * 85, skin: 'ice', targets: 'all', optional: true })), recovery: 1600 },
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
    timing: { windup: 420, hits: [{ t: 420, travel: 720, stop: 50, shake: 7 * 80 / 90, push: 12, skin: 'char', targets: 'all' }], recovery: 2400 },
    desc: 'A charged fireball that explodes and leaves the target burning.', uses: ['fireCharge', 'fireball', 'fireImpact', 'damageOverTime(burn)', 'hitFlash'], length: 3600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      fireCharge(w, tex, {
        origin: () => hand(caster), palette: P.hoa, duration: 420,
        onDone: () => fireball(w, tex, {
          from: hand(caster), to: chest(target, 0.45), palette: P.hoa, speed: 720, size: 1.3,
          onHit: (at) => {
            fireImpact(w, tex, { x: at.x, y: at.y, radius: 80, palette: P.hoa });
            near(at, 90, targets).forEach((u) => hurt(u, u === target ? 142 : 71, { palette: P.hoa, crit: u === target, push: 12 }));
            damageOverTime(w, tex, { target: feetOf(target), height: target.height, kind: 'burn', duration: 2400, tickMs: 600, damage: () => Math.round(rand(11, 16)), onTick: () => hitFlash(w, target.sprite, 90, 0xffa040) });
          },
        }),
      });
    },
  },
  {
    id: 'hoa-dragon-breath', element: 'hoa', category: 'channel', en: 'Dragon Breath', vi: 'Long Tức Liệt Diễm',
    timing: { windup: 300, hits: Array.from({ length: 4 }, (_, i) => ({ t: 600 + i * 360, skin: 'char', push: 0, targets: 'all' })), recovery: 1800 },
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
          for (let i = 0; i < 4; i++) w.after(300 + i * 360, () => targets.filter(inBreath).forEach((u) => hurt(u, Math.round(rand(24, 32)), { palette: P.hoa, push: 0 })));
          w.after(1500, () => targets.filter(inBreath).forEach((u) => damageOverTime(w, tex, { target: feetOf(u), height: u.height, kind: 'burn', duration: 1800, tickMs: 600, damage: 9 })));
        },
      });
    },
  },
  {
    id: 'hoa-heaven-fire', element: 'hoa', category: 'aoe', en: 'Heavenfall Meteor', vi: 'Thiên Hỏa Lưu Tinh',
    timing: { windup: 350, hits: [{ t: 900, stop: 70, shake: 12, skin: 'char', targets: 'all' }], recovery: 1700 },
    desc: 'Calls a meteor from the sky after a short warning.', uses: ['fireCharge', 'fireMeteor'], length: 2600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      fireCharge(w, tex, { origin: () => hand(caster), palette: P.hoa, duration: 350 });
      const c = { x: target.feet.x, y: target.feet.y };
      fireMeteor(w, tex, { ...c, radius: 125, palette: P.hoa, castMs: 900, onHit: () => near(c, 130, targets).forEach((u) => hurt(u, Math.round(rand(180, 230)), { palette: P.hoa, crit: true, angle: -Math.PI / 2 })) });
    },
  },
  {
    id: 'hoa-fire-dragon-crossing', element: 'hoa', category: 'aoe', en: 'Fire Dragon Crossing', vi: 'Hỏa Long Quá Giang',
    timing: { windup: 280, hits: Array.from({ length: 4 }, (_, i) => ({ t: 870 + i * 600, spread: 420, skin: 'char', targets: 'all', optional: true })), recovery: 700 },
    desc: 'A serpentine fire dragon sweeps across the field, scorching its path and burning the enemies it crosses.',
    uses: ['fireCharge', 'fireDragonCrossing', 'damageOverTime(burn)'], length: 3800,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const crossed = new Set<Unit>();
      fireCharge(w, tex, {
        origin: () => hand(caster), palette: P.hoa, duration: 280,
        onDone: () => fireDragonCrossing(w, tex, {
          from: hand(caster), toward: target.feet, facing: caster.facing, palette: P.hoa,
          onCross: ({ x, y, angle, halfLength, radius }) => {
            const ux = Math.cos(angle), uy = Math.sin(angle);
            for (const u of targets) {
              if (crossed.has(u)) continue;
              const dx = u.feet.x - x, feetY = u.feet.y - u.feet.z;
              const intersects = [0.38, 0.56, 0.76].some((level) => {
                const dy = feetY - u.height * level - y;
                const along = Math.max(-halfLength, Math.min(halfLength, dx * ux + dy * uy));
                return Math.hypot(dx - along * ux, dy - along * uy) <= radius + u.height * 0.12;
              });
              if (!intersects) continue;
              crossed.add(u);
              hurt(u, u === target ? 156 : 108, { palette: P.hoa, crit: u === target, angle });
              damageOverTime(w, tex, {
                target: feetOf(u), height: u.height, kind: 'burn', duration: 1800, tickMs: 600, damage: 13, numbers: false,
                onTick: (damage) => hurt(u, damage, { color: 0xffa040, feedback: 0.15 }),
              });
            }
          },
        }),
      });
    },
  },

  // ------------------------------------------------------------------ THỔ / EARTH
  {
    id: 'tho-fissure', element: 'tho', category: 'control', en: 'Earth Fissure', vi: 'Địa Liệt Trảm',
    timing: { windup: 300, hits: Array.from({ length: 8 }, (_, i) => ({ t: 300 + i * 65, shake: 4, skin: 'earth', targets: 'all', optional: true })), recovery: 1800 },
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
              hurt(u, 76, { palette: { ...P.tho, core: P.tho.main }, feedback: 0.18, coreAlpha: 0, angle: -Math.PI / 2 });
              if (!hitOnce.has(u)) { hitOnce.add(u); stun(w, tex, { target: feetOf(u), height: u.height, duration: 1800 }); }
            }),
          });
        },
      });
    },
  },
  {
    id: 'tho-mountain-leap', element: 'tho', category: 'movement', en: 'Mountain Crash', vi: 'Thái Sơn Áp Đỉnh',
    timing: MOUNTAIN_CRASH_TIMING,
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
          hurt(u, 168, { palette: P.tho, crit: u === target, angle: -Math.PI / 2, skin: MOUNTAIN_CRASH_TIMING.hits[0].skin, push: MOUNTAIN_CRASH_TIMING.hits[0].push });
          stun(w, tex, { target: feetOf(u), height: u.height, duration: 1500 });
        }),
      });
    },
  },
  {
    id: 'tho-stone-skin', element: 'tho', category: 'buff', en: 'Stone Skin', vi: 'Thạch Giáp Hộ Thể',
    timing: { windup: 650, hits: [], recovery: 3350 },
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
    timing: { windup: 280, hits: Array.from({ length: 3 }, (_, i) => ({ t: 280 + i * 65, travel: 1450, stop: i === 0 ? 36 : 0, shake: i === 0 ? 4 : 0, push: 55, skin: 'wind', targets: 'all' })), recovery: 1000 },
    desc: 'Draw air into the blade, then fan three banking gusts that throw enemies backward.', uses: ['windPressure', 'windSweep', 'windSlash'], length: 2050,
    cast: ({ w, tex, caster, targets, hurt }) => {
      const a = caster.facing > 0 ? 0 : Math.PI;
      windPressure(w, tex, { at: hand(caster), angle: a, radius: 126, palette: P.phong, inward: true, duration: 280 });
      w.after(280, () => {
        windSweep(w, { target: feetOf(caster), angle: a - 2, palette: P.phong, radius: 94, duration: 245 });
        targets.slice(0, 3).forEach((u, i) => {
          const launch = () => windSlash(w, tex, {
            from: hand(caster), to: chest(u, 0.52), palette: P.phong, size: i === 0 ? 1.75 : 1.45, speed: 1450,
            onHit: () => {
              const k = angleTo(w, caster, u);
              const home = { ...u.feet };
              windPressure(w, tex, { at: chest(u, 0.50), angle: k, radius: i === 0 ? 105 : 78, palette: P.phong });
              if (i === 0) { w.hitStop(36); w.shake(4, 150); }
              hurt(u, Math.round(rand(48, 62)), { angle: k, push: 9, skin: 'wind' });
              const x = home.x + Math.cos(k) * 55, y = home.y + Math.sin(k) * 55 * w.groundSquash;
              moveUnit(w, u, { x, y, z: 16 }, 120);
              w.after(140, () => moveUnit(w, u, { x, y, z: 0 }, 150, (t) => t * t));
              w.after(490, () => moveUnit(w, u, home, 360));
            },
          });
          if (i === 0) launch();
          else w.after(i * 65, launch);
        });
      });
    },
  },
  {
    id: 'phong-whirlwind', element: 'phong', category: 'aoe', en: 'Whirlwind', vi: 'Toàn Phong Trảm',
    timing: { windup: 380, hits: [{ t: 448, push: 0, skin: 'wind', targets: 'all' }, { t: 678, push: 0, skin: 'wind', targets: 'all' }, { t: 1008, stop: 65, shake: 7, push: 44, skin: 'wind', targets: 'all' }], recovery: 1450 },
    desc: 'Rush into the group, cut twice, then blow nearby enemies outward with the last spin.', uses: ['windPressure', 'windRush', 'windSweep', 'vortex'], length: 2650,
    cast: ({ w, tex, caster, target, targets, hurt, returnHome }) => {
      const a = caster.facing > 0 ? 0 : Math.PI;
      const to = { x: target.feet.x + caster.facing * 25, y: target.feet.y + 6, z: 0 };
      windPressure(w, tex, { at: chest(caster, 0.3), angle: a + Math.PI, radius: 94, palette: P.phong, inward: true, duration: 200 });
      w.after(180, () => windRush(w, tex, {
        from: caster.feet, to, palette: P.phong, sprite: caster.sprite, duration: 200, height: caster.height,
        onMove: (p) => Object.assign(caster.feet, p),
        onEnd: () => {
          vortex(w, tex, { at: feetOf(caster), radius: 144, palette: P.phong, duration: 750, inward: false });
          const spin = (i: number) => {
            const finish = i === 2;
            windSweep(w, { target: feetOf(caster), height: 26 + i * 13, angle: a - 1.8 + i * 1.75, palette: P.phong, radius: [138, 164, 205][i], duration: finish ? 540 : 275 });
            if (finish) windSweep(w, { target: feetOf(caster), height: 18, angle: a + Math.PI, palette: P.phong, radius: 182, duration: 465 });
            w.after(68, () => {
              const victims = near(caster.feet, 183, targets);
              if (finish && victims.length) { w.hitStop(65); w.shake(7, 210); }
              victims.forEach((u) => {
                const angle = angleTo(w, caster, u);
                hurt(u, Math.round(rand(34, 46)) + i * 12, { skin: 'wind', crit: finish, angle, numberDuration: finish ? undefined : 200 });
                if (!finish) return;
                const home = { ...u.feet };
                windPressure(w, tex, { at: chest(u, 0.42), angle, radius: 94, palette: P.phong, duration: 390 });
                moveUnit(w, u, { x: home.x + Math.cos(angle) * 44, y: home.y + Math.sin(angle) * 44 * w.groundSquash, z: 0 }, 180);
                w.after(460, () => moveUnit(w, u, home, 340));
              });
            });
          };
          spin(0);
          w.after(230, () => spin(1));
          w.after(560, () => spin(2));
          w.after(1120, returnHome);
        },
      }));
    },
  },
  {
    id: 'phong-tornado', element: 'phong', category: 'control', en: 'Dragon Cyclone', vi: 'Long Quyển Phong',
    timing: { windup: 340, hits: [...Array.from({ length: 7 }, (_, i) => ({ t: 640 + i * 360, skin: 'wind' as const, push: 0, targets: 'all' as const, optional: i === 0 })), { t: 3070, stop: 52, shake: 7, skin: 'wind', targets: 'all' }], recovery: 630 },
    desc: 'Rake up dust and leaves, carry enemies around the funnel, then slam them back into the ground.', uses: ['windPressure', 'vortex', 'tornado'], length: 3800,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const direction = caster.facing > 0 ? 0 : Math.PI;
      const start = { x: caster.feet.x + caster.facing * 90, y: caster.feet.y + 10, z: 0 };
      const end = { x: target.feet.x + caster.facing * 115, y: target.feet.y, z: 0 };
      windPressure(w, tex, { at: hand(caster), angle: direction, palette: P.phong, duration: 340, radius: 145, inward: true });
      vortex(w, tex, { at: start, radius: 115, palette: P.phong, duration: 530 });
      const homes = new Map(targets.map((u) => [u, { ...u.feet }]));
      const lanes = new Map(targets.map((u, i) => [u, i % 3]));
      const caught = new Set<Unit>();
      let tick = 0;
      w.after(340, () => {
        tornado(w, tex, {
          at: start, to: end, palette: P.phong, height: 260, radius: 116, duration: 2480, leaves: true, tickMs: 60,
          onTick: (at) => {
            tick++;
            for (const u of targets) {
              const dx = at.x - u.feet.x, dy = (at.y - u.feet.y) / w.groundSquash;
              const d = Math.hypot(dx, dy);
              if (d > 205 && !caught.has(u)) continue;
              caught.add(u);
              const lane = lanes.get(u) ?? 0;
              const a = Math.atan2(-dy, -dx) + (0.32 + lane * 0.045) * clamp01(1.52 - d / 177);
              const r = lerp(d, 42 + lane * 15, 0.21);
              u.feet.x = at.x + Math.cos(a) * r;
              u.feet.y = at.y + Math.sin(a) * r * w.groundSquash;
              u.feet.z = lerp(u.feet.z, (70 + lane * 29 + 26 * Math.sin(a)) * clamp01(1.45 - d / 183), 0.28);
              if (tick % 6 === 0) hurt(u, Math.round(rand(16, 24)), { skin: 'wind', push: 0 });
            }
          },
        });
      });
      w.after(2820, () => caught.forEach((u) => {
        const dx = u.feet.x - end.x, dy = u.feet.y - end.y;
        moveUnit(w, u, { x: u.feet.x + dx * 0.38, y: u.feet.y + dy * 0.38, z: 0 }, 230, (x) => x * x);
      }));
      w.after(3070, () => {
        if (caught.size) { w.hitStop(52); w.shake(7, 240); }
        caught.forEach((u) => {
          const angle = Math.atan2((u.feet.y - end.y) / w.groundSquash, u.feet.x - end.x);
          windPressure(w, tex, { at: { ...u.feet, z: 13 }, angle, radius: 104, palette: P.phong, duration: 420 });
          hurt(u, Math.round(rand(40, 55)), { crit: true, skin: 'wind', angle });
          w.after(210, () => moveUnit(w, u, homes.get(u)!, 420));
        });
      });
    },
  },
  {
    id: 'phong-tailwind', element: 'phong', category: 'buff', en: 'Tailwind', vi: 'Tật Phong Bộ',
    timing: { windup: 250, hits: [], recovery: 2250 },
    desc: 'Catch a tailwind, then demonstrate the haste with three quick steps trailing ribbons and dust.', uses: ['windPressure', 'windRush', 'windWisps'], length: 2500,
    cast: ({ w, tex, caster }) => {
      const home = { ...caster.feet }, facing = caster.facing;
      windPressure(w, tex, { at: chest(caster, 0.37), angle: facing > 0 ? Math.PI : 0, radius: 118, palette: P.phong, duration: 250, inward: true });
      const step = (x: number, y: number, duration: number) => windRush(w, tex, {
        from: caster.feet, to: { x: home.x + x * facing, y: home.y + y * w.groundSquash, z: home.z },
        palette: P.phong, height: caster.height, sprite: caster.sprite, duration,
        onMove: (p) => Object.assign(caster.feet, p),
      });
      w.after(250, () => {
        windWisps(w, tex, { target: feetOf(caster), height: caster.height, radius: 45, facing, palette: P.phong, duration: 1820 });
        step(192, -70, 270);
      });
      w.after(680, () => step(352, 58, 270));
      w.after(1250, () => step(0, 0, 350));
    },
  },

  // ------------------------------------------------------------------ LÔI / LIGHTNING
  {
    id: 'lightning-chain', element: 'loi', category: 'attack', en: 'Chain Lightning', vi: 'Lôi Đình Liên Kích',
    timing: { windup: 300, hits: Array.from({ length: 3 }, (_, i) => ({ t: 340 + i * 40, skin: 'shock', targets: 'all' })), recovery: 1200 },
    desc: 'A bolt jumps between all enemies and briefly stuns them.', uses: ['lightningCharge', 'lightningChain', 'lightningStun'], length: 2700,
    cast: ({ w, tex, caster, targets, hurt }) => {
      const tip = () => ({ x: caster.feet.x + caster.facing * caster.height * 0.22,
        y: caster.feet.y + 1, z: caster.feet.z + caster.height * 1.02 });
      lightningCharge(w, tex, {
        target: tip, palette: P.loi, duration: 300, size: 2.1,
        onDone: () => {
          lightningChain(w, tex, { points: [tip(), ...targets.map((u) => chest(u))], palette: P.loi, impactIntensity: 0.2 });
          targets.forEach((u, i) => w.after(40 + i * 40, () => {
            hurt(u, 88 - i * 10, { skin: 'shock', angle: rand(0, 6.3), feedback: 0 });
            hitSkin(w, u.sprite, 'shock', { strength: 0.32, duration: 220 });
            lightningStun(w, tex, { target: feetOf(u), height: u.height, duration: 1200, palette: P.loi });
          }));
        },
      });
    },
  },
  {
    id: 'loi-heaven-strike', element: 'loi', category: 'aoe', en: 'Heavenly Thunder', vi: 'Thiên Lôi Giáng',
    timing: { windup: 300, hits: Array.from({ length: 3 }, (_, i) => ({ t: 600 + i * 180, stop: 25, shake: 4, skin: 'shock', targets: 'all' })), recovery: 1200 },
    desc: 'A raised charge calls staggered forked sky strikes, stunning and shocking the enemy group.',
    uses: ['lightningCharge', 'stormCloud', 'lightningWarning', 'lightningStrike', 'lightningStun', 'shock'], length: 3200,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const cloud = stormCloud(w, tex, { x: target.feet.x + 35, y: target.feet.y, palette: P.loi, width: 350, height: 270, duration: 1800 });
      lightningCharge(w, tex, { target: () => hand(caster), palette: P.loi, duration: 300, onDone: () => {
        const enemies = [target, ...targets.filter((u) => u !== target)];
        enemies.forEach((u, i) => {
          const at = { ...u.feet };
          lightningWarning(w, tex, { ...at, radius: 36, palette: P.loi, duration: 300 + i * 180,
            onDone: () => lightningStrike(w, tex, { ...at, palette: P.loi, radius: 38, cloud, onHit: () => {
              hurt(u, 115, { skin: 'shock', feedback: 0 });
              hitSkin(w, u.sprite, 'shock', { strength: 0.22, duration: 220 });
              lightningStun(w, tex, { target: feetOf(u), height: u.height, duration: 650, palette: P.loi });
              shock(w, tex, { target: feetOf(u), height: u.height, duration: 1200, palette: P.loi });
            } }),
          });
        });
      } });
    },
  },
  {
    id: 'loi-thunder-domain', element: 'loi', category: 'control', en: 'Thunder Domain', vi: 'Lôi Vực',
    timing: { windup: 300, hits: Array.from({ length: 5 }, (_, i) => ({ t: 800 + i * 500, skin: 'shock', push: 0, targets: 'all' })), recovery: 450 },
    desc: 'A violet electric field crackles under the enemy group, dealing periodic damage and shock.',
    uses: ['lightningCharge', 'stormCloud', 'staticField', 'shock'], length: 3600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const cloudAt = targets.length ? { x: targets.reduce((s, u) => s + u.feet.x, 0) / targets.length,
        y: targets.reduce((s, u) => s + u.feet.y, 0) / targets.length } : target.feet;
      const cloud = stormCloud(w, tex, { ...cloudAt, palette: P.loi, width: 400, height: 270, duration: 3100 });
      lightningCharge(w, tex, { target: () => hand(caster), palette: P.loi, duration: 300, onDone: () => {
        const center = targets.length ? {
          x: targets.reduce((sum, u) => sum + u.feet.x, 0) / targets.length,
          y: targets.reduce((sum, u) => sum + u.feet.y, 0) / targets.length,
        } : { ...target.feet };
        const radius = Math.max(120, ...targets.map((u) => Math.hypot(u.feet.x - center.x, (u.feet.y - center.y) / w.groundSquash) + 16));
        staticField(w, tex, { ...center, radius, palette: P.loi, duration: 2500, cloud,
          targets: () => targets.filter((u) => Math.hypot(u.feet.x - center.x, (u.feet.y - center.y) / w.groundSquash) <= radius).map((u) => u.feet), onTick: () => {
          for (const u of targets) if (Math.hypot(u.feet.x - center.x, (u.feet.y - center.y) / w.groundSquash) <= radius) {
            hurt(u, 24, { skin: 'shock', feedback: 0, push: 0 });
            hitSkin(w, u.sprite, 'shock', { strength: 0.28, duration: 180 });
            shock(w, tex, { target: feetOf(u), height: u.height, palette: P.loi, duration: 450 });
          }
        } });
      } });
    },
  },
  // ------------------------------------------------------------------ NEUTRAL / UTILITY
  {
    id: 'seal-silence', element: 'neutral', category: 'debuff', en: 'Silencing Seal', vi: 'Phong Ấn Thuật',
    timing: SEAL_TIMING,
    desc: 'A sealing rune flies into the target, locking its voice and veiling its eyes.',
    uses: ['sigilCharge', 'chargeUp', 'projectile(seal)', 'hitSpark', 'silence', 'blind'], length: 3800,
    cast: ({ w, tex, caster, target }) => {
      sigilCharge(w, tex, { target: () => hand(caster), palette: P.shadow, duration: SEAL_TIMING.windup });
      chargeUp(w, tex, { target: () => hand(caster), palette: P.shadow, duration: SEAL_TIMING.windup,
        release: { color: P.shadow.main, size: 0.5, coreSize: 0.18, alpha: 0.3 },
        onDone: () => projectile(w, tex, { from: hand(caster), to: chest(target, 0.8), palette: P.shadow,
          speed: SEAL_TIMING.hits[0].travel, size: 0.85, seal: true, onHit: () => {
            hitSpark(w, tex, { ...chest(target, 0.8), palette: { ...P.shadow, core: P.shadow.main }, size: 0.5 });
            w.spawn({ texture: tex.rune, ...target.feet, z: 35, life: 340,
              vz: -100, scale: [0.21, 0.12, outQuad], alpha: envelope(0.1, 0.5, 0.7), tint: P.shadow.main });
            silence(w, tex, { target: feetOf(target), height: target.height, duration: 2400, palette: P.shadow });
            blind(w, tex, { target: feetOf(target), height: target.height, duration: 2400 });
          },
        }),
      });
    },
  },
  {
    id: 'sunder-mark', element: 'neutral', category: 'debuff', en: 'Sundering Mark', vi: 'Phá Giáp Ấn',
    timing: sunderTiming(),
    desc: 'Descending reticles lock onto enemies, shattering their armor into glowing fragments.',
    uses: ['sigilCharge', 'chargeUp', 'sunderingMark'], length: 3800,
    cast: ({ w, tex, caster, targets }) => {
      const timing = sunderTiming(targets.length);
      const palette = { core: 0xffd59a, main: 0xf36b38, dark: 0x542027 };
      sigilCharge(w, tex, { target: () => hand(caster), palette, duration: timing.windup, reticle: true });
      chargeUp(w, tex, { target: () => hand(caster), palette, duration: timing.windup,
        release: { color: palette.main, size: 0.5, coreSize: 0.18, alpha: 0.3 },
      });
      hitTimes(timing).forEach((impact, i) => w.after(impact - 260, () => {
        const u = targets[i], hit = timing.hits[i];
        sunderingMark(w, tex, { target: feetOf(u), height: u.height, duration: 2200, palette,
          onImpact: () => { w.hitStop(hit.stop!); w.shake(hit.shake!, 100); } });
      }));
    },
  },
  {
    id: 'war-cry', element: 'neutral', category: 'buff', en: 'War Cry', vi: 'Chiến Hống',
    timing: { windup: 340, hits: [{ t: 340, effectOnly: true, shake: 3 }], recovery: 3660 },
    desc: 'Brace, unleash a fiery roar, and rally within an ember-wreathed battle rune.',
    uses: ['battleCry'], length: 4000,
    cast: ({ w, tex, caster }) => {
      battleCry(w, tex, { target: feetOf(caster), height: caster.height, facing: caster.facing,
        palette: P.hoa, sprite: caster.sprite, windup: 340, duration: 2800 });
    },
  },
  {
    id: 'shadow-blink', element: 'neutral', category: 'movement', en: 'Shadow Step', vi: 'Ảnh Bộ',
    timing: SHADOW_STEP_TIMING,
    desc: 'Dissolve into creeping shadows, reform behind the target, and carve a violet cross.', uses: ['shadowStep', 'shadowSlash'], length: 2200,
    cast: ({ w, tex, caster, target, hurt, returnHome, setVisible }) => {
      const to = { x: target.feet.x + caster.facing * 55, y: target.feet.y + 4, z: 0 };
      shadowStep(w, tex, {
        from: { ...caster.feet }, to, palette: P.shadow, height: caster.height, sprite: caster.sprite,
        onVanish: () => setVisible(caster, false),
        onAppear: () => {
          caster.feet.x = to.x; caster.feet.y = to.y; caster.facing *= -1; setVisible(caster, true);
          w.after(60, () => shadowSlash(w, tex, { ...target.feet, facing: caster.facing, height: target.height, palette: P.shadow }));
          onHits(w, { ...SHADOW_STEP_TIMING, hits: SHADOW_STEP_TIMING.hits.map((hit) => ({ ...hit, t: hit.t - 420 })) },
            (hit) => hurt(target, 154, { palette: { ...P.shadow, core: P.shadow.main }, feedback: 0.18,
              skin: hit.skin, crit: true, angle: caster.facing > 0 ? 0 : Math.PI }));
          w.after(800, () => { caster.facing *= -1; returnHome(); });
        },
      });
    },
  },
  {
    id: 'curse-weaken', element: 'neutral', category: 'debuff', en: 'Curse of Frailty', vi: 'Suy Nhược Chú',
    timing: frailtyTiming(),
    desc: 'A spreading hex binds and weighs down enemies, leaving a sickly, draining curse.',
    uses: ['sigilCharge', 'hexField', 'frailty', 'rockBack'], length: 3200,
    cast: ({ w, tex, caster, target, targets }) => {
      const timing = frailtyTiming(targets.length);
      const palette = { core: 0x91c76e, main: 0xa34de0, dark: 0x21182d };
      sigilCharge(w, tex, { target: () => hand(caster), palette, duration: timing.windup });
      w.stream({ rate: 35, duration: 300, make: () => {
        const at = hand(caster), a = rand(0, Math.PI * 2), r = rand(18, 34);
        return { texture: tex.dot, ...at, life: 250, tint: rand(0, 1) < 0.5 ? palette.main : palette.core,
          scale: [0.08, 0], alpha: [0.7, 0],
          onUpdate: (q, t) => { q.px = Math.cos(a) * r * (1 - t); q.pz = Math.sin(a) * r * (1 - t); } };
      } });
      w.after(timing.windup, () => {
        const units = targets.length ? targets : [target];
        const center = { x: units.reduce((sum, u) => sum + u.feet.x, 0) / units.length,
          y: units.reduce((sum, u) => sum + u.feet.y, 0) / units.length };
        const radius = Math.min(170, Math.max(90, ...units.map((u) =>
          Math.hypot(u.feet.x - center.x, (u.feet.y - center.y) / w.groundSquash) + u.height * 0.3)));
        hexField(w, tex, { ...center, radius, duration: 2300, palette });
        hitTimes(timing).forEach((impact, i) => w.after(impact - timing.windup - 240, () => {
          const u = targets[i], hit = timing.hits[i];
          frailty(w, tex, { target: feetOf(u), height: u.height, duration: 1700, palette,
            onImpact: () => rockBack(w, u.sprite, { angle: Math.PI / 2, push: hit.push! * u.height / 96, duration: 330 }) });
        }));
      });
    },
  },
  {
    id: 'summon-spirit', element: 'neutral', category: 'summon', en: 'Summon Guardian', vi: 'Triệu Hồi Hộ Pháp',
    timing: SUMMON_TIMING,
    desc: 'A gold rune summons a spectral guardian to fly into battle, cleave, sweep, then dive-slam and dissolve upward.',
    uses: ['chargeUp', 'summonCircle', 'spiritGuardian'], length: 5400,
    cast: ({ w, tex, caster, target, targets, hurt, summon }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.holy, duration: 350 });
      const at = { x: caster.feet.x + caster.facing * 120, y: caster.feet.y + 40, z: 0 };
      const slamRadius = caster.height * 2.4;
      const gold = { core: 0xffeab4, main: 0xf4b93f, dark: 0xb08020 };
      summonCircle(w, tex, { ...at, palette: gold, radius: 70, duration: SUMMON_TIMING.windup, linger: 3900, columnAlpha: 0.7,
        onSummon: () => {
          summon?.(at, 'neutral', true);
          w.after(200, () => spiritGuardian(w, tex, { ...at, palette: P.holy, height: caster.height * 1.4,
            target: feetOf(target), strikes: SUMMON_TIMING.hits.length, slamRadius,
            onStrike: (i, impact) => {
              const angle = Math.atan2((impact.y - at.y) / w.groundSquash, impact.x - at.x);
              const hit = SUMMON_TIMING.hits[i];
              const victims = hit.targets === 'all' ? targets.filter((u) =>
                Math.hypot(u.feet.x - impact.x, (u.feet.y - impact.y) / w.groundSquash) <= slamRadius) : [target];
              victims.forEach((u) => hurt(u, i === 2 ? 185 : 92, { palette: { ...P.holy, core: P.holy.main },
                angle, skin: hit.skin, crit: i === 2, feedback: i === 2 ? 0.16 : 0.25 }));
            },
          }));
        },
      });
    },
  },
];

export { chest, hand, screenAngle };
