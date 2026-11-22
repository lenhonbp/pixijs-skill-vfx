# Use the kit in your own game

Copy `kit/` into your source tree, create one `VfxWorld` and one texture set, and update the
world from your game loop (see [SKILL.md section 2](../SKILL.md#2-install-the-kit)). Coordinates
are ground `(x, y)` plus height `z`; status targets return the unit's **feet**, not its center.
The kit draws feedback. Your game owns damage, healing, movement restrictions and buff expiry.

## Register a custom element and give it a signature

`WUXING` contains the five base elements; `ELEMENTS` also includes the Phong and Lôi variants.
`defineElement` registers or replaces an element by name and returns the same definition.
`getElement(name)` looks up built-ins and registered custom elements, or returns `undefined`.
Registration does not generate recipes, mutate `ELEMENTS`, or add demo tabs automatically.

This shadow element uses normal-blended rising wisps and a contracting rune, rather than
recoloring a fire explosion. All textures remain procedural:

```ts
import {
  defineElement, getElement, paletteFrom, group,
  type VfxWorld, type VfxTextures, type Vec3,
} from '../kit'; // adjust imports to your copied kit

export const SHADOW = defineElement({
  name: 'am', vi: 'Am', en: 'Shadow',
  palette: paletteFrom(0x9155cf, { core: 0xd8b1fa, dark: 0x160b24 }),
  accent: 0xc18aec,
  shapes: 'contracting runes, narrow rising wisps, dark silhouettes; slow drift then collapse',
});

export function shadowSeal(w: VfxWorld, tex: VfxTextures, at: Vec3) {
  const p = SHADOW.palette;
  const g = group(w, 650);
  g.add(w.spawn({ texture: tex.rune, ...at, layer: 'ground', groundAligned: true,
    life: 650, scale: [0.28, 0.12], spin: -1, tint: p.main, alpha: [0.45, 0] }));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    g.add(w.spawn({ texture: tex.puff, blend: 'normal',
      x: at.x + Math.cos(a) * 24, y: at.y + Math.sin(a) * 14, z: at.z ?? 0,
      life: 650, vz: 65, scaleX: [0.12, 0.04], scaleY: [0.4, 0.15],
      tint: i % 2 ? p.dark : p.main, alpha: [0.45, 0] }));
  }
  return g;
}

console.assert(getElement('am') === SHADOW);
```

Call `shadowSeal` at impact and add `silence`, `fear` or another status with the same palette.
Keep shape, motion and blend consistent across the element's attacks and buffs. Reserve near
white for small, brief cores; large overlapping glows should use the main hue at low alpha.

`Element.name` accepts custom strings through `ElementId`. The demo's `SkillDef.element` and
filter/key order deliberately list built-ins. In your game, use your own skill type, or widen
that field with `Omit<SkillDef, 'element'> & { element: ElementId | 'neutral' }`, and wire your
own element UI. Registration alone does not widen the sample application's types.

## Recolor without changing geometry

```ts
import { paletteFrom, shiftPalette, aura, silence } from '../kit';

const violet = paletteFrom(0x8758df); // derives a pale core and a darker shadow
const coldViolet = shiftPalette(violet, { hue: 20, sat: 0.85, light: -0.05 });
// In a cast callback with w, tex and target:
// aura(w, tex, { target: () => target.feet, palette: coldViolet, duration: 3000 });
// silence(w, tex, { target: () => target.feet, palette: coldViolet });
```

Both helpers are pure: they return a new palette without mutating the input. `paletteFrom`
accepts optional `{ core, dark }` overrides. `shiftPalette` rotates hue in degrees (wrapping
at 360), multiplies saturation, and adds lightness on the 0..1 HSL scale; saturation and
lightness clamp to 0..1. Pass the result through the recipe/status `palette` option wherever
supported. Some specialized APIs differ: `damageOverTime` selects a palette through `kind`,
while `damageNumber` and `hitFlash` accept a color rather than a palette.

To recolor a sample, copy its `SkillDef` and change the palette **inside its cast function**.
Changing only `element` or spreading a definition does not replace colors closed over by
the original `cast`. For example, adapt Golden Bell into an ice-colored shield:

```ts
import { SKILLS, type SkillDef } from '../examples/skills';
import { chargeUp, shield, paletteFrom } from '../kit';

const original = SKILLS.find((skill) => skill.id === 'kim-golden-bell')!;
const ice = paletteFrom(0x71c5ed, { core: 0xe4f8ff });
export const iceBell: SkillDef = {
  ...original, id: 'ice-bell', element: 'thuy', en: 'Ice Bell', vi: 'Ice Bell',
  desc: 'A cold-colored shield gathers around the caster.',
  uses: ['chargeUp', 'shield'], length: 3800,
  cast: ({ w, tex, caster }) => {
    chargeUp(w, tex, { target: () => ({ ...caster.feet, z: caster.feet.z + caster.height * 0.6 }),
      palette: ice, duration: 300,
      release: { color: ice.main, size: 0.6, coreSize: 0.2, alpha: 0.35 },
      onDone: () => shield(w, tex, { target: () => caster.feet,
        height: caster.height, palette: ice, duration: 3000 }),
    });
  },
};
```

This is a recolor, not an ice signature: add sharp shards and brittle shattering if the new
skill must read as a different material. Update names, `uses` and `length` when copying.

## Skill timing

Every sample `SkillDef` has optional `timing: SkillTiming` data, readable without calling
`cast()`. The exported types and helpers live in `kit/skill-timing.ts` (also exported from
`kit`). Timings use **VFX-clock milliseconds from cast start**, excluding hit-stop; pause
your character animation while `w.frozen` is true so both clocks stay synchronized.

```ts
interface SkillTiming { windup: number; hits: SkillHit[]; recovery: number }
interface SkillHit {
  t: number;
  stop?: number; shake?: number; push?: number;
  skin?: HitSkinName; targets?: 'primary' | 'all';
  travel?: number; spread?: number; optional?: boolean;
}
```

- `windup` is the anticipation/attack-animation phase. The first hit's `t` is at or after it.
- `t` normally means impact time. With `travel` (projectile speed in ground px/s), it means
  **launch time** instead: `hitTimes(timing, distance)` returns
  `t + distance / travel * 1000` for each traveling hit and `t` for instantaneous hits.
  Omitting distance resolves traveling hits at launch (zero distance).
- Measure distance exactly as the recipe does, not between sprite centers. `projectile`
  uses `hypot(to.x - from.x, to.y - from.y)`, with the sample's **hand** as the origin.
  `windSlash` additionally divides the y difference by `w.groundSquash`. Gale Blades uses
  one recipient per hit; resolve each entry with that recipient's distance. Its sample,
  Chain Lightning and Heavenly Thunder describe the showcase's three enemies; adapt the
  repeated entries when changing the enemy count.
- `spread` is a ±ms uncertainty window, not a delay. Sword Rain declares ±30 ms landing
  jitter. `optional` marks an opportunity that can miss in the showcase layout: the sword
  landings, Glacier Path/Fissure spikes, and Cyclone's first capture tick. These
  fields do not create extra damage or change targeting. Actual damage stays in `hurt`.
- `stop` is hit-stop ms, `shake` is screen-shake amplitude in px, and `push` is knockback
  distance in px. `skin` selects a hit-reaction style, one of `char`, `ice`, `shock`,
  `holy`, `shadow`, `poison`, `earth`, `metal`, `wind`, `nature`, `red`. Neither `skin` nor
  `push` automatically changes rendering or movement in `onHits`; pass them to the game's
  `hurt` callback to opt into reactions (the demo does this). `targets` describes primary versus
  group opportunities, not guaranteed collisions or a target-count multiplier.
- `recovery` follows the last **resolved** hit. The bound is
  `lastResolvedHit + recovery <= length`; windup is not added again. Empty-hit skills use
  `windup + recovery <= length`. `length` remains a showcase estimate at its demonstration
  distance, not a promise for arbitrarily long projectile flights.

For example, sync your own character's attack pose to Fireball without executing the skill
to discover its timings:

```ts
import { hitTimes } from '../kit';
import { hand, type SkillDef, type SkillContext } from '../examples/skills';

function castWithAnimation(skill: SkillDef, ctx: SkillContext,
  animate: (phase: 'windup' | 'contact' | 'recovery', duration?: number) => void) {
  const timing = skill.timing;
  if (!timing) { skill.cast(ctx); return; }
  const from = hand(ctx.caster), to = ctx.target.feet;
  const distance = Math.hypot(to.x - from.x, to.y - from.y); // projectile metric
  const times = hitTimes(timing, distance);
  animate('windup', timing.windup);
  const timers = times.map((t) => ctx.w.after(t, () => animate('contact')));
  timers.push(ctx.w.after(times.at(-1) ?? timing.windup,
    () => animate('recovery', timing.recovery)));
  skill.cast(ctx); // Existing impact callbacks still own damage and VFX feedback.
  return { stop() { timers.forEach((timer) => timer.stop()); } };
}
```

Use the returned handle to cancel these animation timers; it does not cancel the skill's
VFX handles. For new fixed-timing casts, `onHits(w, timing, (hit, i) => { ... }, distance?)`
schedules nominal hits, applies `stop`/`shake` (160 ms shake decay), then calls back. It
returns a stoppable handle, does not roll `spread`, and leaves collision checks, damage,
push and skins to you. Do not apply its feedback a second time around recipes that already
provide it. Existing recipe-driven flight, random landing and status callbacks remain intact
in the samples; Spring Bloom uses `onHits`, and Golden Edge reads timings/feedback from its
shared data. Release/assembly shakes without `hurt` are still recipe-driven, not fake hits.

The catalog describes calls to the game's `hurt`, including Spring Bloom's healing calls.
Current damage-over-time helpers display their own tick numbers and do not call that game
callback; their decorative ticks are not additional declared hits. Buffs, summons and pure
debuffs therefore legitimately have empty hit arrays.

Run `node tools/test-timing.mjs` to cast all 28 samples in headless Chromium, in both the
showcase and a closer layout. It records `hurt`, hit-stop and shake against nominal windows
(spread + 17 ms), validates phase/order/length bounds, and reports optional misses. It uses
1 ms simulation steps to avoid accumulating the existing timers' frame-rounding error;
coarse variable frame steps can drift, especially Cyclone's periodically reset tick timer.

## Element hit skins and rock-back

`hitSkin(w, sprite, skin, { duration = 300, strength = 0.9 })` tints the actual sprite and
eases back to its exact pre-hit tint on the VFX clock. Strength is clamped to 0..1. Char
briefly transitions from deep orange to near-black before fading; shock flickers between
violet and pale violet-white. A normal color-mix filter preserves texture detail while
blending toward the skin color (multiply-only tint turns brown sprites green instead of
cyan). The original sprite tint is preserved, and existing filters are retained. All eleven
`HitSkinName` values are supported:

| Skin | Color | Element default |
|---|---|---|
| `char` | Deep orange → charcoal | Hỏa |
| `ice` | Pale cyan | Thủy |
| `shock` | Violet-white flicker | Lôi |
| `holy` | Warm white-gold | — |
| `shadow` | Dark purple | — |
| `poison` | Sickly green | — |
| `earth` | Brown | Thổ |
| `metal` | Gold | Kim |
| `wind` | Brief, translucent mint flash (120 ms by default) | Phong |
| `nature` | Green | Mộc |
| `red` | Plain red | Custom/unknown/neutral fallback |

`Element.hitSkin` is optional. Pass it in `defineElement({ ...definition, hitSkin: 'shadow' })`
to override the custom-element red fallback; resolve defaults with
`getElement(elementId)?.hitSkin ?? 'red'`. Palette recoloring alone does not pick a new skin.

`rockBack(w, sprite, { push, angle, duration = 320 })` is a damped spring impulse in parent
space: `angle = 0` pushes right and `Math.PI / 2` pushes down. `push` is the approximate
peak displacement in px; the spring slightly overshoots the rest position before settling.
It offsets `sprite.pivot`, not `sprite.position`, so movement code can keep assigning x/y
every frame. The offset compensates for sprite rotation and scale, including mirrored
facing. Don't animate pivot simultaneously; if your character controller owns pivot, apply
the reaction to a separate visual child instead. Ground feet, collision and sorting stay
unchanged; this is visual recoil, not gameplay knockback.

```ts
import { getElement, hitSkin, rockBack } from '../kit';
import type { HitSkinName, VfxWorld } from '../kit';
import type { Sprite } from 'pixi.js';

function react(w: VfxWorld, sprite: Sprite, element: string,
  hit: { skin?: HitSkinName; push?: number; angle?: number; crit?: boolean }) {
  const tint = hitSkin(w, sprite, hit.skin ?? getElement(element)?.hitSkin ?? 'red');
  const recoil = rockBack(w, sprite, {
    push: hit.push ?? (hit.crit ? 12 : 6), angle: hit.angle ?? 0,
  });
  return { stop() { tint.stop(); recoil.stop(); } };
}
```

The demo's `hurt` uses these same defaults and accepts explicit `skin`/`push` options.
Samples pass stronger pushes for heavy impacts (Mountain Crash: 26 px); periodic beam,
breath, cyclone and thunder-field hits pass `push: 0`. Healing has no hit reaction. Copy
the relevant `timing.hits[i].skin` and `.push` into your damage callback when composing a
new skill: timing metadata does not automatically execute reactions. Decorative DoT
numbers still belong to their status helper and do not go through demo `hurt`.

Both helpers return `Handle`s. The newest reaction of each kind replaces the earlier one
on that sprite, even across worlds; an old handle cannot stop its replacement. Tint and
recoil are independent and can coexist. Repeated hits retain the true original tint and
pivot, so neither drifts. Natural completion, `stop()` and `w.clear()` restore the originals
and unregister cleanup/updaters; destroyed sprites are released on the next update.
Zero duration, zero strength, or zero push cancels the previous reaction without starting
a new one. Durations/strength/angles must be finite and push nonnegative. Existing
`hitFlash` remains a separate additive-overlay helper for backward compatibility; avoid
stacking it over the same impact if you want the skin to remain readable.

Run `node tools/test-hit.mjs` for tint restoration, replacement, moving/mirrored recoil,
simultaneous reactions, cancellation, destruction and cleanup coverage.

## Compose a skill and synchronize gameplay

This skeleton uses the sample application's `SkillContext`; replace its callbacks with your
game's systems. Store persistent handles in your buff/entity controller, not in a global VFX
singleton. Here a local handle set demonstrates cancellation ownership:

```ts
import type { SkillDef } from '../examples/skills';
import { chargeUp, projectile, hitSpark, slow, WUXING, type Handle } from '../kit';

const active = new Set<Handle>(); // this example allows one active cast
let cancelled = false;
export function cancelFrostBolt() {
  cancelled = true;
  for (const handle of active) handle.stop();
  active.clear();
}

export const frostBolt: SkillDef = {
  id: 'custom-frost-bolt', element: 'thuy', category: 'attack',
  en: 'Frost Bolt', vi: 'Frost Bolt', desc: 'A charged bolt slows on impact.',
  uses: ['chargeUp', 'projectile', 'hitSpark', 'slow'], length: 4200,
  cast: ({ w, tex, caster, target, hurt }) => {
    cancelFrostBolt();
    cancelled = false;
    const palette = WUXING.thuy.palette;
    const track = (handle: Handle) => {
      for (const old of active) if (!old.alive) active.delete(old);
      active.add(handle);
    };
    // Anticipation: 280 ms at the caster's hand, not an idle wait.
    track(chargeUp(w, tex, {
      target: () => ({ ...caster.feet, z: caster.feet.z + caster.height * 0.65 }),
      palette, duration: 280,
      release: { color: palette.main, size: 0.6, coreSize: 0.2, alpha: 0.35 },
      onDone: () => {
        if (cancelled) return;
        // Release -> travel: snapshot destination; travel time is distance / speed.
        track(projectile(w, tex, {
          from: { ...caster.feet, z: caster.feet.z + caster.height * 0.65 },
          to: { ...target.feet, z: target.feet.z + target.height * 0.55 },
          palette, speed: 800, size: 0.5,
          onHit: () => {
            // Impact: damage and feedback happen together, never on a second timer.
            hitSpark(w, tex, { ...target.feet, z: target.feet.z + target.height * 0.55,
              palette, size: 0.5 });
            hurt(target, 50, { palette, feedback: 0.25 });
            w.hitStop(30); w.shake(3, 150);
            // Dissipation: a finite status plus sparks that fade naturally.
            track(slow(w, tex, { target: () => target.feet, height: target.height,
              palette, duration: 2000 }));
          },
        }));
      },
    }));
  },
};
```

For an AoE, replace `hitSpark` with `explosion` and apply damage in the same impact callback;
`explosion` already provides shake/hit-stop, so avoid stacking feedback unintentionally.
The sample `hurt` callback may itself draw a hit spark: lower `feedback` when layering yours.
Make your game skip AI/animation updates while `w.frozen` is true. VFX timers use the world's
clock, keeping delayed impacts aligned with hit-stop and time scaling.

`length` is a showcase estimate, **not a cancellation timer**. Budget windup + maximum travel
time + status duration + fade/particle tails (and hit-stop); adjust it for your game's range.
Keep handles and call `stop()` on buff removal or death; stop is idempotent and finite particles
may fade rather than disappearing instantly. New sustained statuses support `duration: Infinity`
until stopped. `regen`/`damageOverTime` retain a half-tick grace period so a final due tick can
fire. Do not assume all older effects support Infinity equally; test the recipe you choose.

`chargeUp`, `projectile` and the sustained statuses return handles; `hitSpark` and `explosion`
are finite one-shots whose particles dissipate naturally. A group's end callback also runs
when stopped: guard `chargeUp.onDone` against cancellation, as above, so interruption cannot
launch the next phase. For concurrent casts, give each cast its own handles and validity token;
check target validity before gameplay callbacks too. Stop owned handles and call `w.clear()` on
a scene change; release your handle set too. Build custom cancellable loops with `group()` and
register both attached particles (`add`) and streams/updaters (`addHandle`).

## Status catalog

All entries take `target: () => feet` and optional `height` (default 70 px). Durations are in
milliseconds; visuals scale to height. They return a `Handle` with `stop()` and `alive`.
These are visual helpers, not gameplay state machines: CC must be enforced by your game.

| Status | Role | What it shows | Key options beyond target/height |
|---|---|---|---|
| `stun` | CC | Orbiting head stars and ring | `duration`, `palette`, `stars` |
| `freeze` | CC | Growing ice, frost/mist, shatter at end | `duration`, `palette`, `glowIntensity`, `onShatter` |
| `slow` | CC/debuff | Cold feet arcs, sinking chevrons and drips | `duration`, `palette` |
| `root` / `vineBind` | CC | Four thorned vines coil around legs and torso with near/far depth, then wither into bark and leaves | `duration` (Infinity supported), `palette`, `height`; `pulse()` alongside gameplay damage ticks, `stop()` |
| `shield` | Buff | Rim-lit bubble, ground ring, impact ripple and break shards | `duration` (default Infinity), `palette`, `radius`, `onBreak`; handle adds `hit(angle)` / `break()` |
| `goldenBell` | Buff | Cast-bronze temple bell drops over the unit, rings on hits, then breaks into pieces of the shell | `duration` (sustain after the 250 ms windup + 180 ms drop, default 3000; Infinity supported), `palette`, `onBreak`; handle adds `hit(angle?)` / `break()` |
| `stoneArmor` | Buff | Eight solid rock plates assemble on the body, follow the unit and fall as cracked rubble on end | `duration` (sustain after 650 ms assembly, default 2200; Infinity supported), `palette` (earth default), `height`, `onBreak`; handle adds `hit(angle?)` / `break()`; `stop()` also sheds the plates |
| `statChange` | Buff/debuff | Column and upward/downward chevrons | `up` (required), `duration`, `palette` |
| `damageOverTime` | Debuff | Poison bubbles / burn embers / bleeding drops and tick numbers | `kind`, `duration`, `tickMs`, `damage` (number or function), `onTick(amount)`, `numbers` |
| `shock` | Debuff | Crawling body arcs and feet sparks | `duration`, `palette`, `tickMs`, `onTick()` |
| `silence` | CC/debuff | Violet crossed seal and orbiting chain links above head | `duration`, `palette` |
| `blind` | Debuff | Dark eye band and drifting head mist | `duration`, `palette` |
| `armorBreak` | Debuff | Cracked shield icon, falling red-brown shards | `duration`, `palette` |
| `mark` | Debuff | Ground sigil and pulsing rotating target lock | `duration`, `palette` |
| `fear` | CC/debuff | Upward dark wisps and trembling warning glyph | `duration`, `palette` |
| `aura` | Buff base | Pulsing ground rune, rising motes, optional column | `duration`, `palette`, `radius`, `intensity` (0..1), `column` |
| `regen` | Buff | Rising green crosses, ring and healing numbers | `duration`, `palette`, `tickMs`, `heal` (number or function, default 18), `onTick(amount)`, `numbers` |
| `haste` | Buff | Trailing speed lines, feet dust and idle wind swirls | `duration`, `palette` |
| `empower` | Buff | Warm pulsing feet ring, embers and flickering body licks | `duration`, `palette` |

`regen.onTick` receives your positive healing amount; adapt signs to your game. The sample
`SkillContext.hurt` expects negative amounts for healing, so use `onTick: n => hurt(unit, -n)`.
Set `numbers: false` when your game already displays numbers. Defaults for the nine extended
statuses are finite (2–3 seconds); use Infinity for a buff controlled by your gameplay state.

## Verify in the demo and your game

```sh
npx tsc -p .
npm run build
npx playwright install chromium
node tools/test-loi.mjs
node tools/test-status.mjs
npm run capture -- --skills loi-heaven-strike,seal-silence,war-cry --out ~/audit/custom
```

The two test scripts use Playwright Chromium, so they are not browser-free Node tests. Add a
custom sample to `examples/skills.ts` (and its filter if using a custom element) before passing
its ID to capture. The harness builds/serves the demo, seeds randomness (`--seed`, default
12345), steps the paused world, and writes 5×2 labeled sheets plus `counts.json`. Omit `--skills`
for all 29 samples. Inspect anticipation, arrival/impact, sustained state and dissipation at
game zoom; counts must reach zero at `length + 1500 ms` for finite skills. Compare captures
with the same seed. Also test Infinity + explicit stop, death and scene changes in your game.
