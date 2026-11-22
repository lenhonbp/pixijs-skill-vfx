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
| `root` | CC | Swaying vines, dirt and leaves | `duration`, `palette` |
| `shield` | Buff | Rim-lit bubble, ground ring, impact ripple and break shards | `duration` (default Infinity), `palette`, `radius`, `onBreak`; handle adds `hit(angle)` / `break()` |
| `goldenBell` | Buff | Translucent temple bell drops over the unit, rings on hits, cracks and falls into golden shards | `duration` (sustain after the 250 ms gather + 180 ms drop, default 3000; Infinity supported), `palette`, `onBreak`; handle adds `hit(angle?)` / `break()` |
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
for all 28 samples. Inspect anticipation, arrival/impact, sustained state and dissipation at
game zoom; counts must reach zero at `length + 1500 ms` for finite skills. Compare captures
with the same seed. Also test Infinity + explicit stop, death and scene changes in your game.
