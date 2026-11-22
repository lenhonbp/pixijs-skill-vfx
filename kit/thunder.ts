import type { VfxWorld, Handle } from './vfx-world';
import type { VfxTextures } from './textures';
import { type Palette, hitSpark, shockwave } from './recipes';
import { lightningBolt } from './lightning-bolt';
import { group, ms } from './group';
import { random, rand } from './ease';
import { shiftPalette } from './palette';

/** Instant sky strike. A warning telegraph, if desired, belongs to the caller. */
export function lightningStrike(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; palette: Palette; radius?: number; delay?: number; onHit?: () => void }) {
  const strike = () => {
    const p = shiftPalette(o.palette, { hue: 12, sat: 1.5, light: -0.08 }), r = o.radius ?? 45;
    for (let i = 0; i < 3; i++) w.after(i * 55, () => {
      const top = { x: o.x + rand(-35, 35), y: o.y, z: 420 };
      const style = { width: 1.5, alpha: 0.45, coreAlpha: i === 0 ? 0.75 : 0.45, halo: 0.16, life: 115 };
      lightningBolt(w, tex, top, { x: o.x, y: o.y, z: 0 }, p, style);
      for (let j = 0; j < 3; j++) {
        const fork = { x: o.x, y: o.y, z: 100 + j * 75 };
        lightningBolt(w, tex, fork,
          { x: o.x + (j % 2 ? -1 : 1) * rand(r * 0.8, r * 1.8), y: o.y + rand(-r, r) * w.groundSquash, z: rand(0, 60) }, p,
          { ...style, width: 0.65, coreAlpha: 0.3, halo: 0.12, depth: 3 });
      }
    });
    w.spawn({ texture: tex.glow, x: o.x, y: o.y, z: 8, life: 140, scale: r / 65, alpha: [0.5, 0], tint: p.main });
    w.spawn({ texture: tex.disc, layer: 'ground', groundAligned: true, blend: 'normal', x: o.x, y: o.y, life: 1000, scale: r / 150, alpha: [0.35, 0], tint: p.dark });
    hitSpark(w, tex, { ...o, palette: { ...p, core: p.main }, z: 12, angle: -Math.PI / 2, size: 0.55 });
    shockwave(w, tex, { ...o, palette: p, radius: r, duration: 260 });
    w.shake(4, 180);
    w.hitStop(25);
    o.onHit?.();
  };
  if ((o.delay ?? 0) > 0) w.after(o.delay!, strike);
  else strike();
}

/** Sustained, low-intensity ground arcs; finite sparks dissipate after stop(). */
export function staticField(w: VfxWorld, tex: VfxTextures,
  o: { x: number; y: number; radius: number; palette: Palette; duration: number; onTick?: () => void }): Handle {
  const tickMs = 500, g = group(w, o.duration > 0 ? o.duration + tickMs / 2 : 0), r = o.radius, p = shiftPalette(o.palette, { hue: 12, sat: 1.5, light: -0.08 });
  g.add(w.spawn({ texture: tex.glow, layer: 'ground', groundAligned: true,
    x: o.x, y: o.y, life: o.duration, scale: r / 45, alpha: ms.env(o.duration, 150, 250, 0.16), tint: p.main }));
  g.add(w.spawn({ texture: tex.ring, layer: 'ground', groundAligned: true,
    x: o.x, y: o.y, life: o.duration, scale: r / 120, alpha: ms.env(o.duration, 150, 250, 0.48), tint: p.main }));
  const point = (rim = false) => {
    const a = rand(0, Math.PI * 2), d = (rim ? 1 : Math.sqrt(random())) * r;
    return { x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d * w.groundSquash, z: 3 };
  };
  let arc = 0, age = 0, ticks = 0;
  g.addHandle(w.addUpdater((dt) => {
    arc += dt; age += dt;
    if (age < o.duration && arc >= 40) {
      arc %= 40;
      for (let j = 0; j < 3; j++) {
        const a = point(), b = point(j === 0);
        lightningBolt(w, tex, a, b, { ...p, core: p.main }, { width: 0.6, alpha: 0.32, coreAlpha: 0.65, halo: 0.12, life: 130, depth: 3 });
      }
      const rim = point(true);
      w.spawn({ texture: tex.streak, ...rim, life: 220, vz: rand(30, 85), rotation: rand(0, Math.PI * 2), scale: [0.18, 0], alpha: [0.65, 0], tint: p.main });
    }
    while (g.alive && (ticks + 1) * tickMs <= Math.min(age, o.duration)) { ticks++; o.onTick?.(); }
  }));
  return g;
}
