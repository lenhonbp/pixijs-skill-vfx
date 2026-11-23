# @lenhonbp/pixijs-vfx-runtime

Free forever, MIT. A small, zero-runtime-dependency atlas player for PixiJS **7 and 8**.
Commercial use welcome; keep the MIT copyright and license notice in copies of the runtime.
It plays baked effects; it does not import or require the procedural kit.

## Install

```sh
npm install @lenhonbp/pixijs-vfx-runtime pixi.js
```

To try unreleased changes, build this directory with `npm run build` and install
it locally with `npm install /path/to/pixijs-skill-vfx/runtime`. Install dev tools
from the repository root first. Packs can be downloaded per skill from the
[showcase](https://lenhonbp.github.io/pixijs-skill-vfx/) or with the
[agent skill's fetch script](https://github.com/lenhonbp/pixijs-skill-vfx/blob/main/skills/lenhon-vfx/SKILL.md).
Serve packs over HTTP(S); cross-origin sheets must permit CORS.
For black-backed additive atlases, use an opaque application background (the
Pixi default). A transparent WebGL canvas can accumulate opaque alpha in the
additive region when composited over HTML; put the game background inside Pixi.

```ts
import { VfxPlayer } from '@lenhonbp/pixijs-vfx-runtime';

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
  - `fitDistance`: scale the baked cast distance to the actual caster–target
    distance. Effects mirror automatically when the target is left of the caster.
  - `groundSquash`: camera squash (ground y / screen y) of your game view, used to
    pick a direction; defaults to the pack's baked value, else 0.6.
  - `loop`: repeat until explicitly stopped. The finished promise remains pending.
- `on('cue', fn)` / `off('cue', fn)`: cue events contain manifest cue fields plus
  `packId` and the playback `handle`. Times are animation-clock milliseconds.
  Sound is only a hint; the runtime does not create audio.
- `unload(id)`: stop that pack's plays and free sheet/frame textures. For a
  directional family, `unload('id')` frees every loaded direction and
  `unload('id@90')` frees just that one.
- `directions(id)` → loaded ground directions of a pack family, e.g. `[0, 90]`.
- `packDirection(from, to, groundSquash?, available?)` (named export) →
  `{ direction, mirror }`: the canonical direction (0, 45, 90, -45 or -90) whose
  file a cast toward `to` needs, and whether it plays mirrored. Use it to load
  only the directions a scene needs.
- `destroy()`: stop all plays, detach ticker, restore shake offset, free resources.
- `stats()` → `{ active, pooled, packs }`: active plays, available pooled sprites,
  loaded packs. Sprites and effect containers are reused on subsequent plays;
  frame textures are prepared on load, not on play.
- `update(dtMs)`: explicit deterministic stepping in real milliseconds, useful
  with a stopped application ticker for tests. Do not also auto-tick the same time.
- `getManifest(id)` returns a detached metadata snapshot, or `undefined` for an
  unloaded ID. Use its cues and duration to synchronize a character clip without
  downloading the pack again.
- `handle.elapsedMs` is the read-only playback clock: it honors speed and hitstop,
  wraps on loops, and returns zero after stop or completion.

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

## Publishing

Pushing a `runtime-v<version>` tag that matches `version` in this `package.json`
runs `.github/workflows/publish-runtime.yml`, which typechecks, builds and
publishes through npm trusted publishing (OIDC, with provenance); no npm token
is stored in the repository. One-time setup: a maintainer publishes the first
version from their own machine (`npm run build && npm publish` here, confirming
their 2FA), then adds this repository and workflow file as the package's
Trusted Publisher in its npm settings.

## Development

From the repository root: `npm run typecheck`, `npm run build`, then
`npm run check:runtime`. The smoke test serves the **built** showcase under a
subdirectory, exercises all free packs twice, checks cleanup and pool stability,
loads a plain manifest and tests the runtime bundled against Pixi v7 too.
Plain format examples are in `docs/format-examples/`, not the deployed showcase.

The showcase loads only its index and initially selected pack, then lazily loads
on selection and unloads the previous pack. It does not prefetch. Canvas backing
resolution follows the displayed width with DPR capped at 2, including on phones.

See [pack-format.md](https://github.com/lenhonbp/pixijs-skill-vfx/blob/main/docs/pack-format.md). Scrambling is an anti-scrape
deterrent, **not DRM or encryption**. MIT code and free packs may be used commercially.

## Cast direction (3D and 2.5D games)

Packs are baked in ground space, so a cast can go any way on the ground: left,
right, up the screen (away from the camera), down (toward it) or diagonally.
Directional skills ship up to five files: `<id>.vfxb` (direction 0, cast to the
right), `<id>@45.vfxb` (down-right), `<id>@90.vfxb` (down), `<id>@-45.vfxb`
(up-right) and `<id>@-90.vfxb` (up). Left-hand directions reuse the right-hand
file mirrored. Their manifests carry `direction` and `groundSquash`. Skills that
look the same from every side (self buffs) ship only `<id>.vfxb`.

Load any subset of a family; the files share one id. `play` picks the nearest
loaded direction for the actual caster–target angle, mirrors it when the target
is to the left, and skews it the remaining few degrees onto the real target, so
the effect lands on the target at any angle. With only `<id>.vfxb` loaded it falls
back to the original left/right behavior.

```ts
import { VfxPlayer, packDirection } from '@lenhonbp/pixijs-vfx-runtime';

const { direction } = packDirection(hero.position, enemy.position);
const base = 'https://lenhonbp.github.io/pixijs-skill-vfx/packs/';
await vfx.load(`${base}hoa-fireball${direction ? '@' + direction : ''}.vfxb`);
vfx.play('hoa-fireball', { from: hero.position, to: enemy.position, fitDistance: true });
```

Packs without `direction` metadata (all 1.0 packs) keep playing exactly as before.

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
parent's local space and follow the same transform as the VFX: mirroring
reverses x and facing, and `fitDistance` and direction correction move x and y
(lift is unchanged).
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
