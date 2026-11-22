import type { Handle, VfxWorld } from './vfx-world';

export type HitSkinName = 'char' | 'ice' | 'shock' | 'holy' | 'shadow' | 'poison' | 'earth' | 'metal' | 'wind' | 'nature' | 'red';

export interface SkillHit {
  /** VFX-clock ms from cast start, or launch time when travel is set. */
  t: number;
  /** A status, release or visual contact without a gameplay hurt/heal callback. */
  effectOnly?: boolean;
  stop?: number;
  shake?: number;
  push?: number;
  skin?: HitSkinName;
  targets?: 'primary' | 'all';
  /** Projectile speed in ground px/s. Supply the recipe's launch-to-impact distance. */
  travel?: number;
  /** Random timing window, in ms either side of the resolved time. */
  spread?: number;
  /** This opportunity can miss in the showcase scene. */
  optional?: boolean;
}

export interface SkillTiming {
  windup: number;
  hits: SkillHit[];
  /** Time after the last resolved hit, or after windup when there are no hits. */
  recovery: number;
}

/** Resolve nominal hit times without casting, consuming randomness or mutating timing. */
export function hitTimes(timing: SkillTiming, distance = 0): number[] {
  if (!Number.isFinite(distance) || distance < 0) throw new RangeError('distance must be finite and nonnegative');
  return timing.hits.map((hit) => {
    if (hit.travel !== undefined && (!Number.isFinite(hit.travel) || hit.travel <= 0)) {
      throw new RangeError('travel must be finite and positive');
    }
    return hit.t + (hit.travel === undefined ? 0 : distance / hit.travel * 1000);
  });
}

/** Schedule nominal hits on the VFX clock; caller owns damage, push and hit skins. */
export function onHits(w: VfxWorld, timing: SkillTiming, fn: (hit: SkillHit, i: number) => void,
  distance = 0): Handle {
  const handles = hitTimes(timing, distance).map((t, i) => w.after(t, () => {
    const hit = timing.hits[i];
    if (hit.stop !== undefined) w.hitStop(hit.stop);
    if (hit.shake !== undefined) w.shake(hit.shake, 160);
    fn(hit, i);
  }));
  return {
    get alive() { return handles.some((h) => h.alive); },
    stop() { for (const h of handles) h.stop(); },
  };
}
