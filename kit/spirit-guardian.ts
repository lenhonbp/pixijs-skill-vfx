// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import type { Handle, Particle, Vec3, VfxWorld } from './vfx-world';
import { TEX_METRICS as M, type VfxTextures } from './textures';
import type { Palette } from './recipes';
import { afterimage } from './motion';
import { group } from './group';
import { clamp01, lerp, outCubic, rand } from './ease';
import { Graphics, type Sprite } from 'pixi.js';
import { isPixiV8 } from './pixi-compat';

const revealMasks = new WeakMap<Sprite, Graphics>();

function revealMask(sprite: Sprite): Graphics {
  let mask = revealMasks.get(sprite);
  if (!mask || mask.destroyed) {
    mask = new Graphics();
    revealMasks.set(sprite, mask);
    const owned = mask;
    sprite.once('destroyed', () => {
      if (!owned.destroyed) owned.destroy();
      revealMasks.delete(sprite);
    });
  }
  mask.visible = true;
  return mask;
}

export interface SpiritGuardianOptions extends Vec3 {
  palette: Palette;
  height?: number;
  duration?: number;
  target?: () => Vec3;
  strikes?: number;
  slamRadius?: number;
  onStrike?: (i: number, at: Vec3) => void;
  facing?: number;
}

/** Spectral warrior: levitating approach, articulated halberd combo, rising-mote dissolve. */
export function spiritGuardian(w: VfxWorld, tex: VfxTextures, o: SpiritGuardianOptions): Handle {
  const h = o.height ?? 100, k = h / 240, count = Math.max(0, Math.floor(o.strikes ?? 3));
  const reveal = 350, advance = 650, cycle = 650, impactPhase = 0.48, dissolve = 450;
  const end = reveal + (o.target ? advance + count * cycle : (o.duration ?? 1200));
  const g = group(w, end + dissolve, undefined, 80);
  const ground = { x: o.x, y: o.y, z: o.z ?? 0 }, pos = { ...ground };
  const grip = { ...pos }, tip = { ...pos };
  let aim: Vec3 = { ...pos }, dest = { ...pos };
  let age = 0, facing = o.facing ?? 1, lean = 0, twist = 1, squash = 1, weaponAngle = 0;
  let weaponFlat = 1, ghost = 0, strike = -1, hit = -1;
  const bodies: Particle[] = [], weapons: Particle[] = [];
  const opacity = () => clamp01(age / 90) * (1 - clamp01((age - end) / dissolve));
  const masks = new Map<Particle, Graphics>();
  const cutHeight = () => h * 1.5 * (age < reveal ? clamp01(age / reveal) : 1 - clamp01((age - end) / dissolve));
  const updateMask = (q: Particle) => {
    const mask = masks.get(q);
    if (!mask) return;
    const feet = pos.y - pos.z, cut = feet + h * 0.08 - (age < reveal ? cutHeight() : h * 1.5 - cutHeight());
    const top = age < reveal ? cut : feet - h * 3, bottom = age >= end ? cut : feet + h;
    mask.clear();
    if (isPixiV8()) mask.rect(pos.x - h * 3, top, h * 6, Math.max(0, bottom - top)).fill(0xffffff);
    else (mask as any).beginFill(0xffffff).drawRect(pos.x - h * 3, top, h * 6, Math.max(0, bottom - top)).endFill();
  };
  const maskPart = (q: Particle) => {
    const mask = revealMask(q.sprite);
    masks.set(q, mask); q.sprite.parent!.addChild(mask); q.sprite.mask = mask;
    q.o.onDeath = () => {
      q.sprite.mask = null; masks.delete(q);
      mask.removeFromParent(); mask.clear(); mask.visible = false;
    };
    updateMask(q);
  };
  const pose = () => {
    const lx = 66 * k * facing * twist, ly = -116 * k * squash;
    const c = Math.cos(lean), s = Math.sin(lean);
    grip.x = pos.x + lx * c - ly * s;
    grip.y = pos.y;
    grip.z = pos.z - lx * s - ly * c;
    const angle = lean + facing * weaponAngle;
    tip.x = grip.x + Math.sin(angle) * 120 * k * weaponFlat;
    tip.y = grip.y;
    tip.z = grip.z + Math.cos(angle) * 120 * k * weaponFlat;
    for (const q of bodies) {
      q.rotation = lean;
      q.sprite.rotation = lean;
      q.sprite.position.set(pos.x, pos.y - pos.z);
      q.sprite.scale.set(k * facing * twist, k * squash);
    }
    for (const q of weapons) {
      q.rotation = angle;
      q.sprite.rotation = angle;
      q.sprite.position.set(grip.x, grip.y - (grip.z ?? 0));
      q.sprite.scale.set(k * facing, k * weaponFlat);
    }
  };
  const impact = (i: number) => {
    const heavy = i % 3 === 2;
    if (heavy) {
      for (const core of [false, true]) g.add(w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true,
        x: aim.x, y: aim.y, life: 420, scale: [0.05, (o.slamRadius ?? h * 1.1) / M.ringRadius * (core ? 0.8 : 1), outCubic],
        alpha: [0.85, 0], tint: core ? o.palette.core : o.palette.main }));
      for (let j = 0; j < 10; j++) {
        const a = rand(0, Math.PI * 2), speed = rand(30, 100);
        g.add(w.spawn({ texture: tex.rock, blend: 'normal', x: aim.x, y: aim.y, z: 2,
          life: 520, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * w.groundSquash,
          vz: rand(45, 110), gravity: 320, scale: [rand(0.08, 0.18), 0],
          rotation: a, spin: rand(-4, 4), alpha: [0.65, 0], tint: o.palette.dark }));
      }
    }
    w.hitStop(heavy ? 65 : 35); w.shake(heavy ? 5 : 2, heavy ? 220 : 100);
    o.onStrike?.(i, { ...aim });
  };
  const trail = (previous: Vec3) => {
    const dx = tip.x - previous.x, dy = tip.y - (tip.z ?? 0) - previous.y + (previous.z ?? 0);
    g.add(w.spawn({ texture: tex.streak, x: previous.x, y: previous.y, z: previous.z,
      anchorX: 0, rotation: Math.atan2(dy, dx), life: 110, zBias: 24,
      scaleX: Math.hypot(dx, dy) / 128, scaleY: [0.55, 0], alpha: [0.7, 0], tint: o.palette.core }));
    g.add(w.spawn({ texture: tex.crescent, x: grip.x, y: grip.y, z: grip.z, life: 130, zBias: 23,
      rotation: lean + facing * weaponAngle - Math.PI / 2, scaleX: h * 0.5 / M.crescentRadius,
      scaleY: h * 0.5 / M.crescentRadius * weaponFlat, alpha: [0.32, 0], tint: o.palette.main }));
  };
  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    lean = 0; twist = 1; squash = 1;
    pos.z = ground.z - h * 0.22 * (1 - clamp01(age / reveal)) + Math.sin(age / 380) * h * 0.015;
    if (!o.target || age < reveal) { pose(); return; }
    if (age >= end) { pos.z = ground.z + (strike % 3 === 2 ? 0 : 40); pose(); return; }
    if (age - dt <= reveal) {
      aim = { ...o.target() };
      const dx = aim.x - o.x, dy = aim.y - o.y, distance = Math.hypot(dx, dy);
      const travel = Math.max(0, distance - h * 0.45) / Math.max(1, distance);
      dest = { x: o.x + dx * travel, y: o.y + dy * travel, z: ground.z };
      facing = dx === 0 ? facing : Math.sign(dx);
    }
    const t = age - reveal;
    const hover = 40 + Math.sin(t / 280) * 4;
    if (t < advance) {
      const p = t / advance;
      ground.x = lerp(o.x, dest.x, p); ground.y = lerp(o.y, dest.y, p);
      pos.x = ground.x; pos.y = ground.y;
      pos.z = ground.z + hover * outCubic(clamp01(t / 200));
      lean = facing * 0.1; weaponAngle = -0.2;
      pose(); ghost -= dt;
      if (ghost <= 0) {
        ghost = 85;
        for (const q of bodies.slice(0, 1)) g.add(afterimage(w, q.sprite, pos, { tint: o.palette.main, alpha: 0.16, life: 240 }));
        g.add(w.spawn({ texture: tex.streak, x: pos.x, y: pos.y, z: pos.z + h * 0.2,
          life: 280, vx: -facing * 45, vz: 12, rotation: -facing * 0.2,
          scaleX: [0.4, 0.05], scaleY: [0.5, 0], alpha: [0.2, 0], tint: o.palette.main }));
      }
      return;
    }
    const i = Math.floor((t - advance) / cycle), rawPhase = ((t - advance) % cycle) / cycle;
    const crossing = hit < i && rawPhase >= impactPhase;
    const phase = crossing ? impactPhase : rawPhase;
    const move = i % 3, heavy = move === 2;
    if (i !== strike) {
      strike = i; aim = { ...o.target() };
      facing = aim.x === dest.x ? facing : Math.sign(aim.x - dest.x);
      g.add(w.spawn({ texture: tex.star, x: 0, y: 0, follow: () => tip,
        life: 220, scale: [0.05, 0.22], alpha: [0.1, 0.85], tint: o.palette.core, spin: 4, zBias: 24 }));
    }
    const wind = clamp01(phase / 0.34), swing = clamp01((phase - 0.34) / (impactPhase - 0.34));
    const recover = clamp01((phase - 0.58) / 0.42);
    const back = heavy ? -0.7 : move === 1 ? -2.1 : -1.4;
    const contact = heavy ? 2.9 : move === 1 ? 1.6 : 1.8;
    const previous = { ...tip };
    weaponAngle = phase < 0.34 ? lerp(-0.2, back, outCubic(wind)) :
      phase <= impactPhase ? lerp(back, contact, swing * swing) :
      lerp(contact + Math.sin(clamp01((phase - impactPhase) / 0.1) * Math.PI / 2) * 0.22, -0.2, outCubic(recover));
    weaponFlat = move === 1 ? lerp(0.55, 1, Math.abs(Math.cos(weaponAngle))) : 1;
    lean = facing * (phase < 0.34 ? -0.16 * wind : phase <= impactPhase ? lerp(-0.16, 0.22, swing) : lerp(0.22, 0, outCubic(recover)));
    twist = phase < 0.34 ? lerp(1, 0.82, wind) : lerp(0.82, 1, swing);
    squash = phase >= impactPhase && phase < 0.58 ? 0.9 : 1;
    const lunge = phase < 0.34 ? -h * 0.04 * wind : phase <= impactPhase ? lerp(-h * 0.04, h * 0.1, swing) : lerp(h * 0.1, 0, outCubic(recover));
    pos.x = ground.x = dest.x + facing * lunge; pos.y = ground.y = dest.y;
    pos.z = ground.z + (heavy ? phase < 0.34 ? lerp(40, 90, outCubic(wind)) : phase <= impactPhase ? lerp(90, 0, swing * swing) : 0 : hover);
    pose();
    if (dt > 0 && phase >= 0.34 && phase <= 0.58) trail(previous);
    if (crossing) { hit = i; impact(i); }
  }));
  for (const rim of [false, true]) {
    const body = g.add(w.spawn({ texture: o.target ? tex.guardianBody : tex.guardian, blend: rim ? 'add' : 'normal',
      x: 0, y: 0, life: Infinity, anchorX: 88 / 192, anchorY: 244 / 256,
      follow: () => pos, scaleX: () => k * facing * twist, scaleY: () => k * squash,
      tint: o.palette.main, alpha: () => opacity() * (rim ? 0.065 : 0.85), zBias: rim ? 21 : 20,
      onUpdate: (q) => { q.rotation = lean; q.sprite.rotation = lean; updateMask(q); },
    }));
    if (body) { bodies.push(body); maskPart(body); }
    if (o.target) {
      const weapon = g.add(w.spawn({ texture: tex.guardianHalberd, blend: rim ? 'add' : 'normal',
        x: 0, y: 0, follow: () => grip, life: Infinity, anchorX: 154 / 192, anchorY: 128 / 256,
        scaleX: () => k * facing, scaleY: () => k * weaponFlat,
        tint: o.palette.main, alpha: () => opacity() * (rim ? 0.065 : 0.9), zBias: rim ? 23 : 22,
        onUpdate: (q) => { q.rotation = lean + facing * weaponAngle; q.sprite.rotation = q.rotation; updateMask(q); },
      }));
      if (weapon) { weapons.push(weapon); maskPart(weapon); }
    }
  }
  const altitude = () => Math.max(0, pos.z - ground.z);
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, layer: 'ground', groundAligned: true, blend: 'normal', follow: () => ({ ...ground, z: 0 }),
    life: Infinity, scaleX: () => h / 180 / (1 + altitude() / 100), scaleY: () => h / 300 / (1 + altitude() / 100),
    tint: 0x101020, alpha: () => opacity() * 0.4 / (1 + altitude() / 70) }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: () => pos, z: h * 0.5,
    life: Infinity, scaleX: h / 180, scaleY: h / 105, alpha: () => opacity() * 0.055, tint: o.palette.main, zBias: 19 }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: () => pos, life: end + dissolve,
    scaleX: h / 140, scaleY: 0.1 * h / 100, tint: o.palette.main, zBias: 24,
    alpha: () => age < reveal ? 0.65 : age >= end ? 0.5 * (1 - clamp01((age - end) / dissolve)) : 0,
    onUpdate: (q) => { q.pz = age < reveal ? cutHeight() : h * 1.5 - cutHeight(); } }));
  g.addHandle(w.stream({ rate: 55, duration: reveal, make: () => ({ texture: tex.dot,
    x: pos.x + rand(-0.25, 0.3) * h, y: pos.y, z: pos.z + cutHeight(),
    life: 300, vz: rand(15, 45), scale: [rand(0.035, 0.075) * h / 100, 0],
    alpha: [0.8, 0], tint: o.palette.main, zBias: 24 }) }));
  g.addHandle(w.after(end, () => {
    g.addHandle(w.stream({ rate: 85, duration: dissolve - 60, make: () => ({ texture: tex.dot,
      x: pos.x + rand(-0.3, 0.4) * h, y: pos.y, z: pos.z + h * 1.5 - cutHeight(),
      life: 340, vz: rand(70, 150), vx: rand(-14, 14), scale: [rand(0.04, 0.085) * h / 100, 0],
      alpha: [0.8, 0], tint: o.palette.main, zBias: 24 }) }));
  }));
  g.addHandle(w.stream({ rate: 18, make: () => ({ texture: tex.dot,
    x: pos.x + rand(-0.28, 0.4) * h, y: pos.y, z: pos.z + rand(0, 0.9) * h,
    life: 400, vz: h * 0.45, scale: [0.065 * h / 100, 0], alpha: [0.45 * opacity(), 0], tint: o.palette.main, zBias: 22,
    onUpdate: (q) => { if (!g.alive) q.kill(); } }) }));
  return g;
}
