// Bundle the particles and loops of one sustained effect behind a single Handle.
import type { Handle, Particle, SpawnOptions, VfxWorld } from './vfx-world';

/** Fade a particle out over `ms` then kill it. Safe if it already died and its slot was reused. */
export function fadeKill(w: VfxWorld, p: Particle | null, ms = 160) {
  if (!p || p.dead) return;
  const o = p.o;
  const a0 = p.sprite.alpha;
  let left = ms;
  o.onUpdate = undefined;
  w.addUpdater((dt) => {
    if (p.o !== o || p.dead) return false;
    left -= dt;
    o.alpha = a0 * Math.max(0, left / ms);
    if (left <= 0) {
      p.kill();
      return false;
    }
  });
}

export interface Group extends Handle {
  add(p: Particle | null): Particle | null;
  addHandle<H extends Handle>(h: H): H;
}

/**
 * A sustained effect: ends after `duration` (Infinity = until stop()). On end, loops stop,
 * still-living particles fade out over `fadeMs`, then `onEnd` runs once.
 */
export function group(w: VfxWorld, duration: number, onEnd?: () => void, fadeMs = 160): Group {
  const parts: { p: Particle; o: SpawnOptions }[] = [];
  const handles: Handle[] = [];
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    timer.stop();
    for (const h of handles) h.stop();
    for (const { p, o } of parts) if (p.o === o) fadeKill(w, p, fadeMs);
    onEnd?.();
  };
  const timer = w.after(duration, end);
  return {
    stop: end,
    get alive() {
      return !done;
    },
    add(p) {
      if (p) parts.push({ p, o: p.o });
      return p;
    },
    addHandle(h) {
      handles.push(h);
      return h;
    },
  };
}

/** Milliseconds-based helpers for curves on particles whose life is `life` ms. */
export const ms = {
  /** 0..1 ramp over the first `inMs`, 1 until `outMs` before the end, then down to 0. */
  env(life: number, inMs: number, outMs: number, peak = 1) {
    return (t: number) => {
      const a = t * life;
      if (a < inMs) return (peak * a) / inMs;
      if (a > life - outMs) return (peak * Math.max(0, life - a)) / outMs;
      return peak;
    };
  },
};
