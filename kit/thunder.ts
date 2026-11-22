import { Container, Sprite } from 'pixi.js';
import type { VfxWorld, Handle, Vec3 } from './vfx-world';
import type { VfxTextures } from './textures';
import type { Palette } from './recipes';
import { lightningBolt } from './lightning-bolt';
import { group, ms } from './group';
import { floorRing } from './floor-ring';
import { clamp01, envelope, random, rand } from './ease';
import { shiftPalette } from './palette';
import { blend } from './pixi-compat';

export interface StormCloudHandle extends Handle { flash(): void; source(x: number): Vec3 }

/** A shaded overhead cloud, with a separately lit interior. Shares the startup cloud texture. */
export function stormCloud(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; palette: Palette; width?: number; height?: number; duration?: number }): StormCloudHandle {
  const duration = o.duration ?? 1800, height = o.height ?? 235;
  const source = (x: number) => ({ x: Math.max(o.x - (o.width ?? 330) * 0.38, Math.min(o.x + (o.width ?? 330) * 0.38, x)), y: o.y, z: height - 12 });
  if (!(Number.isFinite(duration) || duration === Infinity)) throw new RangeError('Invalid cloud duration');
  if (duration <= 0) return { alive: false, stop() {}, flash() {}, source };
  const texture = tex.stormCloud, root = new Container();
  const body = new Sprite(texture), light = new Sprite(texture);
  for (const s of [body, light]) { s.anchor.set(0.5); s.width = o.width ?? 330; s.height = (o.width ?? 330) * 0.52; root.addChild(s); }
  light.tint = 0xa3b4ff; light.blendMode = blend('add'); light.alpha = 0;
  root.position.set(o.x, o.y - height); root.alpha = 0; w.layers.top.addChild(root);
  let age = 0, flash = 0, alive = true, updater: Handle | undefined, unown: (() => void) | undefined;
  const stop = () => {
    if (!alive) return;
    alive = false; updater?.stop(); unown?.(); root.destroy({ children: true });
  };
  unown = w.own(stop);
  updater = w.addUpdater((dt) => {
    age += dt; flash = Math.max(0, flash - dt / 150);
    if (age >= duration) { stop(); return false; }
    root.alpha = clamp01(age / 260) * clamp01((duration - age) / 500);
    root.scale.set(0.88 + 0.12 * clamp01(age / 400));
    body.alpha = 0.94; light.alpha = flash * 0.8;
    root.y = o.y - height + Math.sin(age * 0.0015) * 2;
  });
  return { get alive() { return alive; }, stop, source, flash() {
    if (!alive) return;
    flash = 1;
    lightningBolt(w, tex, { x: o.x - 45, y: o.y, z: height + 6 }, { x: o.x + 35, y: o.y, z: height - 6 },
      o.palette, { width: 0.45, coreAlpha: 0.4, halo: 0.07, life: 120, layer: 'top', branches: 1 });
  } };
}

/** Restrained violet hand charge; no release starburst. */
export function lightningCharge(w: VfxWorld, tex: VfxTextures,
  o: { target: () => Vec3; palette: Palette; duration?: number; onDone?: () => void }): Handle {
  const duration = o.duration ?? 300;
  if (!Number.isFinite(duration)) throw new RangeError('Invalid charge duration');
  const g = group(w, duration > 0 ? Infinity : 0);
  if (duration <= 0) return g;
  g.addHandle(w.after(duration, () => {
    g.stop();
    const at = o.target();
    w.spawn({ texture: tex.glow, ...at, life: 120, scale: [0.18, 0], alpha: [0.3, 0], tint: o.palette.main });
    o.onDone?.();
  }));
  g.add(w.spawn({ texture: tex.glow, x: 0, y: 0, follow: o.target, life: duration,
    scale: [0.09, 0.18], alpha: [0.1, 0.3], tint: o.palette.main }));
  let age = 0, next = 0;
  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    if (age >= next && age < duration) {
      next = age + 65;
      const at = o.target(), a = rand(0, Math.PI * 2), r = 14;
      g.addHandle(lightningBolt(w, tex, { x: at.x + Math.cos(a) * r, y: at.y, z: (at.z ?? 0) + Math.sin(a) * r },
        { x: at.x - Math.cos(a) * 7, y: at.y, z: (at.z ?? 0) - Math.sin(a) * 7 }, o.palette,
        { width: 0.4, life: 90, coreAlpha: 0.5, halo: 0.08, branches: 1 }));
    }
  }));
  return g;
}

/** A small electric crown marks stun without large white orbiting stars. */
export function lightningStun(w: VfxWorld, tex: VfxTextures,
  o: { target: () => Vec3; height?: number; duration: number; palette: Palette }): Handle {
  const g = group(w, o.duration);
  let elapsed = 0;
  g.addHandle(w.addUpdater((dt) => {
    elapsed += dt;
    if (elapsed < 90) return;
    elapsed %= 90;
    const at = o.target(), h = o.height ?? 70, a = w.now * 0.006;
    lightningBolt(w, tex, { x: at.x + Math.cos(a) * 16, y: at.y, z: (at.z ?? 0) + h + 9 + Math.sin(a) * 5 },
      { x: at.x + Math.cos(a + 1.8) * 16, y: at.y, z: (at.z ?? 0) + h + 9 + Math.sin(a + 1.8) * 5 }, o.palette,
      { width: 0.38, life: 120, coreAlpha: 0.4, branches: 0 });
  }));
  return g;
}

/** A broken, crawling charge mark rather than a generic warning ring. */
export function lightningWarning(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; radius: number; palette: Palette; duration: number; onDone?: () => void }): Handle {
  const g = group(w, o.duration, o.onDone);
  g.add(w.spawn({ texture: tex.swordCrack, x: o.x, y: o.y, layer: 'ground', groundAligned: true,
    life: o.duration, scale: o.radius / 24, alpha: [0.08, 0.28], tint: o.palette.main }));
  let age = 0, next = 0;
  g.addHandle(w.addUpdater((dt) => {
    age += dt;
    if (age >= next && age < o.duration) {
      next = age + 100;
      const a = rand(0, Math.PI * 2), r = o.radius;
      lightningBolt(w, tex, { x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r * w.groundSquash, z: 1 },
        { x: o.x + Math.cos(a + 0.8) * r * 0.6, y: o.y + Math.sin(a + 0.8) * r * w.groundSquash * 0.6, z: 1 },
        o.palette, { width: 0.4, life: 120, coreAlpha: 0.25, branches: 0, layer: 'ground' });
    }
  }));
  return g;
}

export function lightningImpact(w: VfxWorld, tex: VfxTextures, o: { x: number; y: number; radius?: number; palette: Palette }) {
  const r = o.radius ?? 35, p = o.palette;
  w.spawn({ texture: tex.glow, x: o.x, y: o.y, layer: 'ground', groundAligned: true,
    life: 100, scaleX: r / 45, scaleY: r / 85, alpha: [0.5, 0], tint: p.main });
  w.spawn({ texture: tex.swordCrack, x: o.x, y: o.y, layer: 'ground', groundAligned: true, blend: 'normal',
    life: 1000, scale: r / 26, rotation: rand(0, Math.PI * 2), alpha: [0.65, 0], tint: 0x171727 });
  w.spawn({ texture: tex.puff, x: o.x, y: o.y, z: 4, blend: 'normal', life: 650,
    vz: 22, vx: 8, scaleX: [0.18, 0.45], scaleY: [0.25, 0.75], alpha: envelope(0.08, 0.8, 0.24), tint: 0x62667c });
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + rand(-0.4, 0.4);
    lightningBolt(w, tex, { x: o.x, y: o.y, z: 1 },
      { x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r * w.groundSquash, z: 1 }, p,
      { width: 0.55, life: 180, coreAlpha: 0.5, halo: 0.07, branches: 1, layer: 'ground' });
  }
  w.burst(4, () => {
    const a = rand(0, Math.PI * 2), speed = rand(90, 170);
    return { texture: tex.streak, x: o.x, y: o.y, z: 3, life: rand(180, 300), vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed * w.groundSquash, vz: rand(80, 140), gravity: 1200, bounce: 0.3,
      faceVelocity: true, scaleX: [0.11, 0.015], scaleY: 0.1, alpha: [0.65, 0], tint: p.main };
  });
}

/** Instant sky strike. A warning telegraph, if desired, belongs to the caller. */
export function lightningStrike(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; palette: Palette; radius?: number; delay?: number; onHit?: () => void;
    cloud?: StormCloudHandle; height?: number; hitStop?: number; shake?: number }) {
  const strike = () => {
    const p = shiftPalette(o.palette, { hue: 12, sat: 1.5, light: -0.08 }), r = o.radius ?? 45;
    const height = o.height ?? 235;
    const cloud = o.cloud ?? stormCloud(w, tex, { ...o, height, width: 230, duration: 650 });
    cloud.flash();
    lightningBolt(w, tex, cloud.source(o.x + rand(-28, 28)), { x: o.x, y: o.y, z: 0 }, p,
      { width: 2, life: 230, halo: 0.1, branches: 3 });
    lightningImpact(w, tex, { ...o, radius: r, palette: p });
    if ((o.shake ?? 4) > 0) w.shake(o.shake ?? 4, 180);
    if ((o.hitStop ?? 25) > 0) w.hitStop(o.hitStop ?? 25);
    o.onHit?.();
  };
  if ((o.delay ?? 0) > 0) w.after(o.delay!, strike);
  else strike();
}

/** Sustained, low-intensity ground arcs; finite sparks dissipate after stop(). */
export function staticField(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; radius: number; palette: Palette; duration: number; onTick?: () => void;
    targets?: () => Vec3[]; cloud?: StormCloudHandle | false }): Handle {
  const tickMs = 500, g = group(w, o.duration > 0 ? o.duration + tickMs / 2 : 0), r = o.radius, p = shiftPalette(o.palette, { hue: 12, sat: 1.5, light: -0.08 });
  if (o.duration <= 0) return g;
  const cloud = o.cloud === false ? undefined : o.cloud ?? stormCloud(w, tex,
    { ...o, width: r * 2.4, duration: o.duration + 450 });
  if (cloud) g.addHandle(cloud);
  g.add(w.spawn({ texture: tex.rune, layer: 'ground', groundAligned: true,
    x: o.x, y: o.y, life: o.duration, scale: r / 236, alpha: ms.env(o.duration, 200, 350, 0.045), tint: p.main }));
  const rim = floorRing(w, tex, { x: o.x, y: o.y, radius: r, palette: p,
    duration: o.duration, alpha: ms.env(o.duration, 150, 250, 0.075) });
  g.add(rim.far); g.add(rim.near);
  const point = (rim = false) => {
    const a = rand(0, Math.PI * 2), d = (rim ? 1 : Math.sqrt(random())) * r;
    return { x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d * w.groundSquash, z: 3 };
  };
  let arc = 0, age = 0, ticks = 0;
  g.addHandle(w.addUpdater((dt) => {
    arc += dt; age += dt;
    if (age < o.duration && arc >= 90) {
      arc %= 90;
      const a = point(), angle = rand(0, Math.PI * 2), length = rand(20, 55);
      lightningBolt(w, tex, a, { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length * w.groundSquash, z: 3 },
        p, { width: 0.5, alpha: 0.2, coreAlpha: 0.4, halo: 0.06, life: 190, branches: 1, layer: 'ground' });
    }
    while (g.alive && (ticks + 1) * tickMs <= Math.min(age, o.duration)) {
      ticks++;
      const targets = o.targets?.() ?? [point()];
      cloud?.flash();
      for (const at of targets) {
        lightningBolt(w, tex, cloud?.source(at.x + rand(-30, 30)) ?? { x: at.x, y: o.y, z: 225 }, { ...at, z: 0 }, p,
          { width: 1.3, life: 210, branches: 2, halo: 0.09 });
        lightningImpact(w, tex, { ...at, palette: p, radius: 26 });
      }
      o.onTick?.();
    }
  }));
  return g;
}
