// A complete sample skill set: three skills per Wu Xing element plus neutral utility skills.
// Each skill is gameplay-agnostic: it only talks to the game through SkillContext, so you can
// copy one into your project and replace hurt()/returnHome() with your own systems.
import type { Sprite } from 'pixi.js';
import {
  VfxWorld, VfxTextures, Vec3, Palette, WUXING, ElementName,
  slash, hitSpark, hitFlash, projectile, explosion, meteor, lightningChain, healAura, telegraph, shockwave,
  damageOverTime, stun, freeze, slow, root, shield, statChange, damageNumber,
  dash, blink, leap, beam, coneBreath, chargeUp, summonCircle, spikeLine, spikeRing, swordRain,
  rand, envelope, outCubic,
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
  hurt(u: Unit, amount: number, o?: { crit?: boolean; palette?: Palette; angle?: number; color?: number }): void;
  /** Put the caster back on its start position after a movement skill. */
  returnHome(): void;
  /** Show/hide a unit (blink). */
  setVisible(u: Unit, v: boolean): void;
  /** Spawn a temporary summoned unit at a ground point. */
  summon?(at: Vec3, element: ElementName | 'neutral'): void;
}

export type SkillCategory = 'attack' | 'aoe' | 'buff' | 'debuff' | 'control' | 'movement' | 'channel' | 'summon';

export interface SkillDef {
  id: string;
  element: ElementName | 'neutral';
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

const P = {
  kim: WUXING.kim.palette, moc: WUXING.moc.palette, thuy: WUXING.thuy.palette, hoa: WUXING.hoa.palette, tho: WUXING.tho.palette,
  lightning: { core: 0xffffff, main: 0x9ad8ff, dark: 0x3050ff },
  shadow: { core: 0xf0e0ff, main: 0x9a5cff, dark: 0x240a4a },
  holy: { core: 0xffffff, main: 0xffe29a, dark: 0xb08020 },
};

export const SKILLS: SkillDef[] = [
  // ------------------------------------------------------------------ KIM / METAL
  {
    id: 'kim-sword-rain', element: 'kim', category: 'aoe', en: 'Sword Rain', vi: 'Vạn Kiếm Quy Tông',
    desc: 'A storm of golden blades falls on the area and pins every enemy inside.', uses: ['telegraph', 'swordRain', 'hitFlash'], length: 2200,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      chargeUp(w, tex, { target: () => hand(caster), palette: P.kim, duration: 450 });
      const c = { x: target.feet.x, y: target.feet.y };
      w.after(350, () => swordRain(w, tex, {
        ...c, radius: 120, count: 16, duration: 900, palette: P.kim,
        onImpact: (at) => near(at, 40, targets).forEach((u) => hurt(u, Math.round(rand(38, 52)), { palette: P.kim, angle: -Math.PI / 2 })),
      }));
    },
  },
  {
    id: 'kim-golden-edge', element: 'kim', category: 'attack', en: 'Golden Edge', vi: 'Kim Quang Trảm',
    desc: 'Dash in, two crossing metal slashes, the target bleeds.', uses: ['dash', 'slash', 'hitSpark', 'damageOverTime(bleed)'], length: 3600,
    cast: ({ w, tex, caster, target, hurt, returnHome }) => {
      const to = { x: target.feet.x - caster.facing * 70, y: target.feet.y, z: 0 };
      dash(w, tex, {
        from: { ...caster.feet }, to, palette: P.kim, sprite: caster.sprite, duration: 160, height: caster.height,
        onMove: (p) => { caster.feet.x = p.x; caster.feet.y = p.y; },
        onEnd: () => {
          const a = caster.facing > 0 ? 0 : Math.PI;
          slash(w, tex, { ...caster.feet, angle: a - 0.3, palette: P.kim, radius: 95, duration: 170 });
          w.after(80, () => hurt(target, 64, { palette: P.kim, angle: a }));
          w.after(190, () => {
            slash(w, tex, { ...caster.feet, angle: a + 0.35, palette: P.kim, radius: 105, duration: 170, clockwise: false });
            w.after(80, () => {
              hurt(target, 131, { palette: P.kim, angle: a, crit: true });
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
    desc: 'A golden barrier absorbs three hits, then shatters.', uses: ['shield', 'statChange', 'projectile'], length: 3200,
    cast: ({ w, tex, caster, targets }) => {
      statChange(w, tex, { target: feetOf(caster), height: caster.height, up: true, palette: P.kim, duration: 900 });
      const sh = shield(w, tex, { target: feetOf(caster), height: caster.height, palette: P.kim });
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
    desc: 'A seed bolt bursts into thorned vines that root the target.', uses: ['projectile', 'root', 'hitSpark'], length: 3000,
    cast: ({ w, tex, caster, target, hurt }) => {
      projectile(w, tex, {
        from: hand(caster), to: chest(target, 0.3), palette: P.moc, speed: 620, arcHeight: 50, size: 0.9,
        onHit: () => {
          hurt(target, 42, { palette: P.moc });
          root(w, tex, { target: feetOf(target), height: target.height, duration: 2300 });
        },
      });
    },
  },
  {
    id: 'moc-spring-bloom', element: 'moc', category: 'buff', en: 'Spring Bloom', vi: 'Xuân Hồi Đại Địa',
    desc: 'Healing petals and a regrowth aura; restores health over time.', uses: ['healAura', 'statChange', 'damageNumber'], length: 2400,
    cast: ({ w, tex, caster, hurt }) => {
      const aura = healAura(w, tex, { target: feetOf(caster), palette: P.moc, radius: 52, duration: 2000 });
      statChange(w, tex, { target: feetOf(caster), height: caster.height, up: true, palette: P.moc, duration: 1200 });
      w.stream({
        rate: 16, duration: 1800,
        make: () => ({
          texture: tex.leaf, blend: 'normal', x: caster.feet.x + rand(-60, 60), y: caster.feet.y + rand(-20, 20), z: rand(110, 150), life: 1300,
          vx: rand(-20, 20), vz: -70, rotation: rand(0, 6.3), spin: rand(-3, 3), scale: rand(0.3, 0.45), alpha: envelope(0.15, 0.8, 0.8), tint: Math.random() < 0.3 ? WUXING.moc.accent : P.moc.main,
        }),
      });
      for (let i = 0; i < 4; i++) w.after(300 + i * 420, () => { if (aura.alive) hurt(caster, -Math.round(rand(55, 75))); });
    },
  },
  {
    id: 'moc-toxic-spores', element: 'moc', category: 'debuff', en: 'Toxic Spores', vi: 'Độc Chướng Vụ',
    desc: 'A lingering spore cloud poisons every enemy inside.', uses: ['telegraph', 'damageOverTime(poison)'], length: 3800,
    cast: ({ w, tex, target, targets }) => {
      const c = { x: target.feet.x, y: target.feet.y };
      const pal = { core: 0xf0ffd0, main: 0x9cff3a, dark: 0x2f4a05 };
      telegraph(w, tex, {
        ...c, radius: 120, duration: 450, palette: pal,
        onDone: () => {
          w.stream({
            rate: 22, duration: 2600,
            make: () => {
              const a = rand(0, 6.3), d = Math.sqrt(Math.random()) * 115;
              return {
                texture: tex.puff, blend: 'normal', layer: 'body', x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * w.groundSquash, z: rand(0, 25), life: rand(1200, 1700),
                vz: rand(8, 20), vx: rand(-10, 10), rotation: rand(0, 6.3), spin: rand(-0.5, 0.5), scale: [0.6, rand(1.3, 1.8), outCubic], alpha: envelope(0.3, 0.22, 0.5), tint: [0x7ac83a, 0x3a5a1a],
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
    desc: 'Ice spikes erupt around the target and freeze it solid, then it shatters.', uses: ['chargeUp', 'spikeRing', 'freeze'], length: 3300,
    cast: ({ w, tex, caster, target, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.thuy, duration: 500,
        onDone: () => {
          const c = target.feet;
          shockwave(w, tex, { x: c.x, y: c.y, radius: 110, palette: P.thuy });
          spikeRing(w, tex, { x: c.x, y: c.y, radius: 70, count: 10, height: 60, ice: true });
          hurt(target, 58, { palette: P.thuy });
          freeze(w, tex, { target: feetOf(target), height: target.height, duration: 2200, onShatter: () => hurt(target, 120, { palette: P.thuy, crit: true }) });
        },
      });
    },
  },
  {
    id: 'thuy-tidal-beam', element: 'thuy', category: 'channel', en: 'Tidal Beam', vi: 'Thủy Long Xạ',
    desc: 'A channeled torrent that drenches and slows the target.', uses: ['chargeUp', 'beam', 'slow'], length: 3800,
    cast: ({ w, tex, caster, target, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.thuy, duration: 380,
        onDone: () => {
          const b = beam(w, tex, { from: () => hand(caster), to: () => chest(target), palette: P.thuy, width: 1.1, duration: 1500 });
          for (let i = 0; i < 5; i++) w.after(150 + i * 280, () => b.alive && hurt(target, Math.round(rand(20, 28)), { palette: P.thuy, angle: Math.PI * (caster.facing > 0 ? 1 : 0) }));
          w.after(1500, () => slow(w, tex, { target: feetOf(target), height: target.height, duration: 2000 }));
        },
      });
    },
  },
  {
    id: 'thuy-glacier-path', element: 'thuy', category: 'aoe', en: 'Glacier Path', vi: 'Băng Hà Lộ',
    desc: 'A line of ice spears races along the ground toward the enemy.', uses: ['spikeLine(ice)', 'slow'], length: 2600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      spikeLine(w, tex, {
        from: caster.feet, angle: angleTo(w, caster, target), count: 9, spacing: 44, height: 70, ice: true,
        onSpike: (at) => near(at, 34, targets).forEach((u) => { hurt(u, 47, { palette: P.thuy, angle: -Math.PI / 2 }); slow(w, tex, { target: feetOf(u), height: u.height, duration: 1600 }); }),
      });
    },
  },

  // ------------------------------------------------------------------ HỎA / FIRE
  {
    id: 'hoa-fireball', element: 'hoa', category: 'attack', en: 'Fireball', vi: 'Hỏa Cầu Thuật',
    desc: 'A charged fireball that explodes and leaves the target burning.', uses: ['chargeUp', 'projectile', 'explosion', 'damageOverTime(burn)'], length: 3600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      chargeUp(w, tex, {
        target: () => hand(caster), palette: P.hoa, duration: 420,
        onDone: () => projectile(w, tex, {
          from: hand(caster), to: chest(target, 0.45), palette: P.hoa, speed: 720, size: 1.3,
          onHit: (at) => {
            explosion(w, tex, { x: at.x, y: at.y, z: 0, radius: 80, palette: P.hoa });
            near(at, 90, targets).forEach((u) => hurt(u, u === target ? 142 : 71, { palette: P.hoa, crit: u === target }));
            damageOverTime(w, tex, { target: feetOf(target), height: target.height, kind: 'burn', duration: 2400, tickMs: 600, damage: () => Math.round(rand(11, 16)), onTick: () => hitFlash(w, target.sprite, 90, 0xffa040) });
          },
        }),
      });
    },
  },
  {
    id: 'hoa-dragon-breath', element: 'hoa', category: 'channel', en: 'Dragon Breath', vi: 'Long Tức Liệt Diễm',
    desc: 'A sweeping cone of flame that sets everything in front ablaze.', uses: ['coneBreath(fire)', 'damageOverTime(burn)'], length: 3600,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const base = angleTo(w, caster, target);
      let a = base - 0.25;
      w.addUpdater(((t) => (dt) => { t += dt; a = base - 0.25 + 0.5 * Math.min(1, t / 1600); return t < 1700; })(0));
      coneBreath(w, tex, { origin: () => hand(caster), angle: () => a, palette: P.hoa, range: 330, spread: 0.6, duration: 1700, style: 'fire' });
      const inBreath = (u: Unit) => inCone(w, caster, u, a, 420, 0.6 + 0.5);
      for (let i = 0; i < 4; i++) w.after(300 + i * 360, () => targets.filter(inBreath).forEach((u) => hurt(u, Math.round(rand(24, 32)), { palette: P.hoa })));
      w.after(1500, () => targets.filter(inBreath).forEach((u) => damageOverTime(w, tex, { target: feetOf(u), height: u.height, kind: 'burn', duration: 1800, tickMs: 600, damage: 9 })));
    },
  },
  {
    id: 'hoa-heaven-fire', element: 'hoa', category: 'aoe', en: 'Heavenfall Meteor', vi: 'Thiên Hỏa Lưu Tinh',
    desc: 'Calls a meteor from the sky after a short warning.', uses: ['meteor', 'explosion', 'telegraph'], length: 2600,
    cast: ({ w, tex, target, targets, hurt }) => {
      const c = { x: target.feet.x, y: target.feet.y };
      meteor(w, tex, { ...c, radius: 125, palette: P.hoa, castMs: 900, onHit: () => near(c, 130, targets).forEach((u) => hurt(u, Math.round(rand(180, 230)), { palette: P.hoa, crit: true, angle: -Math.PI / 2 })) });
    },
  },

  // ------------------------------------------------------------------ THỔ / EARTH
  {
    id: 'tho-fissure', element: 'tho', category: 'control', en: 'Earth Fissure', vi: 'Địa Liệt Trảm',
    desc: 'Rock spikes tear through the ground and stun everything they hit.', uses: ['spikeLine', 'stun'], length: 3000,
    cast: ({ w, tex, caster, target, targets, hurt }) => {
      const hitOnce = new Set<Unit>();
      spikeLine(w, tex, {
        from: caster.feet, angle: angleTo(w, caster, target), count: 8, spacing: 48, height: 92,
        onSpike: (at) => near(at, 38, targets).forEach((u) => {
          hurt(u, 76, { palette: P.tho, angle: -Math.PI / 2 });
          if (!hitOnce.has(u)) { hitOnce.add(u); stun(w, tex, { target: feetOf(u), height: u.height, duration: 1800 }); }
        }),
      });
    },
  },
  {
    id: 'tho-mountain-leap', element: 'tho', category: 'movement', en: 'Mountain Crash', vi: 'Thái Sơn Áp Đỉnh',
    desc: 'Leap high and crash down, shattering the ground and stunning nearby enemies.', uses: ['leap', 'slam', 'stun', 'dropShadow'], length: 3000,
    cast: ({ w, tex, caster, target, targets, hurt, returnHome }) => {
      const to = { x: target.feet.x - caster.facing * 40, y: target.feet.y + 6, z: 0 };
      leap(w, tex, {
        from: { ...caster.feet }, to, palette: P.tho, arc: 190, duration: 640, radius: 110, height: caster.height,
        onMove: (p) => { caster.feet.x = p.x; caster.feet.y = p.y; caster.feet.z = p.z ?? 0; },
        onLand: (at) => {
          caster.feet.z = 0;
          near(at, 130, targets).forEach((u) => { hurt(u, 168, { palette: P.tho, crit: u === target, angle: -Math.PI / 2 }); stun(w, tex, { target: feetOf(u), height: u.height, duration: 1500 }); });
          w.after(900, returnHome);
        },
      });
    },
  },
  {
    id: 'tho-stone-skin', element: 'tho', category: 'buff', en: 'Stone Skin', vi: 'Thạch Giáp Hộ Thể',
    desc: 'Rock plates form a heavy barrier and raise defense.', uses: ['shield', 'statChange', 'debris'], length: 2800,
    cast: ({ w, tex, caster }) => {
      const f = caster.feet;
      w.burst(14, () => {
        const a = rand(0, 6.3), r = rand(50, 80);
        return { texture: tex.rock, blend: 'normal', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * w.groundSquash, z: 0, life: 380, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * w.groundSquash * 2.6, vz: 260, gravity: 900, rotation: rand(0, 6.3), spin: rand(-8, 8), scale: rand(0.25, 0.4), tint: 0x9a8060 };
      });
      w.after(360, () => {
        w.shake(4, 160);
        statChange(w, tex, { target: feetOf(caster), height: caster.height, up: true, palette: P.tho, duration: 1100 });
        const sh = shield(w, tex, { target: feetOf(caster), height: caster.height, palette: P.tho, duration: 2200 });
        w.after(1200, () => sh.hit(0.3));
      });
    },
  },

  // ------------------------------------------------------------------ NEUTRAL / UTILITY
  {
    id: 'lightning-chain', element: 'neutral', category: 'attack', en: 'Chain Lightning', vi: 'Lôi Đình Liên Kích',
    desc: 'A bolt jumps between all enemies and briefly stuns them.', uses: ['lightningChain', 'stun'], length: 2400,
    cast: ({ w, tex, caster, targets, hurt }) => {
      lightningChain(w, tex, { points: [hand(caster), ...targets.map((u) => chest(u))], palette: P.lightning });
      targets.forEach((u, i) => w.after(40 + i * 40, () => { hurt(u, 88 - i * 10, { palette: P.lightning, angle: rand(0, 6.3) }); stun(w, tex, { target: feetOf(u), height: u.height, duration: 1200, palette: P.lightning }); }));
    },
  },
  {
    id: 'shadow-blink', element: 'neutral', category: 'movement', en: 'Shadow Step', vi: 'Ảnh Bộ',
    desc: 'Teleport behind the target and strike.', uses: ['blink', 'slash', 'hitSpark'], length: 2200,
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
    desc: 'A dark sigil lowers the attack and defense of every enemy.', uses: ['telegraph', 'statChange(down)'], length: 2000,
    cast: ({ w, tex, target, targets }) => {
      telegraph(w, tex, { x: target.feet.x, y: target.feet.y, radius: 130, duration: 380, palette: P.shadow, onDone: () => targets.forEach((u, i) => w.after(i * 90, () => statChange(w, tex, { target: feetOf(u), height: u.height, up: false, duration: 1500 }))) });
    },
  },
  {
    id: 'summon-spirit', element: 'neutral', category: 'summon', en: 'Summon Guardian', vi: 'Triệu Hồi Hộ Pháp',
    desc: 'A rune circle opens and calls a guardian spirit to the field.', uses: ['summonCircle'], length: 3200,
    cast: ({ w, tex, caster, summon }) => {
      const at = { x: caster.feet.x + caster.facing * 120, y: caster.feet.y + 40, z: 0 };
      summonCircle(w, tex, { ...at, palette: P.holy, radius: 70, duration: 1200, onSummon: () => summon?.(at, 'neutral') });
    },
  },
];

export { chest, hand, screenAngle };
