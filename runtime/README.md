# @lenhon/pixijs-vfx-runtime

Free forever, MIT. A small, zero-runtime-dependency atlas player for PixiJS **7 and 8**.
Commercial use welcome; keep the MIT copyright and license notice in copies of the runtime.
It plays baked effects; it does not import or require the procedural kit.

## Install

```sh
npm install @lenhon/pixijs-vfx-runtime pixi.js
```

The package is prepared for publishing at version 1.0.0; until it is published,
build this directory with `npm run build` and install it locally with
`npm install /path/to/pixijs-skill-vfx/runtime`. Install dev tools from the repository root first.
Serve packs over HTTP(S); cross-origin sheets must permit CORS.
For black-backed additive atlases, use an opaque application background (the
Pixi default). A transparent WebGL canvas can accumulate opaque alpha in the
additive region when composited over HTML; put the game background inside Pixi.

```ts
import { VfxPlayer } from '@lenhon/pixijs-vfx-runtime';

const vfx = await VfxPlayer.create(app, { packs: ['packs/free/hoa-fireball.vfxb'] });
vfx.play('hoa-fireball', { from: caster, to: target });
```

`caster` and `target` expose `{ x, y }` **ground positions**, in the coordinate
space of the playback parent. Do not use a character's head position. With Pixi
v8, await `app.init(...)` first; v7 uses `new Application(options)`. The player
handles rectangle textures, blend constants and ticker differences internally.

## API

- `VfxPlayer.create(app, options?)` → `Promise<VfxPlayer>`; loads `options.packs`.
  `new VfxPlayer(app, options?)` is also available for explicit loading.
- `load(url | url[])` → `Promise<void>` accepts `.vfx.json` and `.vfxb`, including
  default-scrambled and unscrambled containers. Concurrent identical URLs share
  loading work. A loaded pack ID is not replaced; unload first to replace it.
  Failures reject; failed loads can be retried.
- `play(id, options)` → `{ stop(), finished: Promise<void> }`. `finished` resolves
  on natural completion, stop, unload or destroy. Missing IDs/invalid speed throw.
  - `from` (required), `to` (optional): live ground points, read every update.
  - `parent`: container, defaults to `app.stage`.
  - `zIndex`: effect-root depth; enable `parent.sortableChildren` to use sorting.
  - `speed`: positive playback multiplier, default 1.
  - `fitDistance`: scale the baked horizontal distance to the actual horizontal
    distance. Effects mirror automatically when the target is left of the caster.
    There is no rotation: the 2.5D projection stays intact.
  - `loop`: repeat until explicitly stopped. The finished promise remains pending.
- `on('cue', fn)` / `off('cue', fn)`: cue events contain manifest cue fields plus
  `packId` and the playback `handle`. Times are animation-clock milliseconds.
  Sound is only a hint; the runtime does not create audio.
- `unload(id)`: stop that pack's plays and free sheet/frame textures.
- `destroy()`: stop all plays, detach ticker, restore shake offset, free resources.
- `stats()` → `{ active, pooled, packs }`: active plays, available pooled sprites,
  loaded packs. Sprites and effect containers are reused on subsequent plays;
  frame textures are prepared on load, not on play.
- `update(dtMs)`: explicit deterministic stepping in real milliseconds, useful
  with a stopped application ticker for tests. Do not also auto-tick the same time.

## Cues, shake and hit-stop

```ts
const vfx = await VfxPlayer.create(app, {
  packs: ['packs/free/hoa-fireball.vfxb'],
  loadKey: 'lenhon-vfx', // default; supply your custom bake key here
  shake: { target: cameraContainer },
  hitstop: true,
});
vfx.on('cue', cue => {
  if (cue.type === 'sound') sounds.play(cue.id);
  if (cue.type === 'hit') console.log('visual contact', cue.packId);
});
vfx.shakeEnabled = false;
vfx.hitstopEnabled = false;
```

Both built-ins are opt-in (`shake` and `hitstop` respectively). Shake applies a
temporary offset to the supplied container, preserving your own camera movement.
Hit-stop pauses only this player's affected playback, not your game simulation.
Toggle either at runtime; the underlying cue still fires for game-owned feedback.
Do not drive gameplay damage from the pre-baked cues without your own authority checks.
The showcase maps sound hints to small synthesized WebAudio tones.

## Development

From the repository root: `npm run typecheck`, `npm run build`, then
`npm run check:runtime`. The smoke test serves the **built** showcase under a
subdirectory, exercises all free packs twice, checks cleanup and pool stability,
loads a plain manifest and tests the runtime bundled against Pixi v7 too.
Plain format examples are in `docs/format-examples/`, not the deployed showcase.

The showcase loads only its index and initially selected pack, then lazily loads
on selection and unloads the previous pack. It does not prefetch. Canvas backing
resolution follows the displayed width with DPR capped at 2, including on phones.

See [pack-format.md](../docs/pack-format.md). Scrambling is an anti-scrape
deterrent, **not DRM or encryption**. MIT code and free packs may be used commercially.

## Actor tracks and playback poses

Optional `actors` is an object with `caster` and/or `target` tracks. Each track
has `frames: [dx, dy, lift, flags][]`, exactly `frameCount` entries. Offsets are
finite screen-space ground pixels relative to that actor's home; lift is height
above ground (render at ground y minus lift). The baker rounds to 0.1 px and
omits unchanged actors. Flags are integers 0–3: bit 0 visible, bit 1 facing flipped.
Malformed lengths, tuples, numbers, flags and unknown actor names are rejected.
This optional field does not change the v1 format; old packs remain valid.

`handle.pose('caster' | 'target')` returns `{ x, y, lift, visible, facing }`
or null when that actor has no track. Numeric values interpolate by the same
playback clock as VFX, including speed, looping and hitstop. Visibility/facing
step at frame boundaries. Coordinates are relative to actor home in the chosen
parent's local space: mirroring reverses x and facing; `fitDistance` scales x
only, matching the runtime's horizontal VFX fit (y/lift are unchanged).
After stop or natural end, each tracked actor returns
`{ x: 0, y: 0, lift: 0, visible: true, facing: 1 }` once, then null.
Untracked actors always return null, including after stop. No pose event is emitted.

```ts
const handle = player.play('kim-golden-edge', { from: home, to: target });
app.ticker.add(() => {
  const pose = handle.pose('caster');
  if (pose) hero.position.set(home.x + pose.x, home.y + pose.y - pose.lift);
});
```

## Evolved collection entries

A variant uses id `<id>.evolved`, files `<id>.evolved.vfxb` (desktop) and
`<id>.evolved.m.vfxb` (mobile), and name "<name> · Evolved". It is baked
with activation tier 3 and evolved timing/length, falling back to base values.
It has the same per-skill preset and budget as the base skill.
The collection index retains 25 base entries. When available, a base entry has
`evolved: { files, bytes, desktopBytes, mobileBytes, frameCount }`.
Here `files` lists both variant containers, `bytes` is the desktop size,
and the tier byte counts are actual container sizes. Load only the selected
variant/tier; use the evolved id when playing an evolved container.
