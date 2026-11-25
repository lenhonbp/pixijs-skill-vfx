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
[showcase](https://vfx-store.pages.dev/) or with the
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
  - `layers`, `tiers`, `recommendedBlend`: see [Impact tiers](#impact-tiers).
  - `hitstop`, `target`, `flash`, `impulse`: see [Combat juice](#combat-juice).
  - `element`: recolour the pack's energy layers, see [Gradient ramps](#gradient-ramps).
- `on('cue', fn)` / `off('cue', fn)`: cue events contain manifest cue fields plus
  `packId` and the playback `handle`. Times are animation-clock milliseconds.
  Sound is only a hint; the runtime does not create audio.
- `on('tier', fn)` / `off('tier', fn)`: fired once when an impact tier starts; see
  [Impact tiers](#impact-tiers).
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
- `getManifest(id)` returns a detached metadata snapshot of the loaded base bake,
  or `undefined` for an unloaded ID. `handle.manifest` returns the manifest of the
  direction bake that play actually picked. Use its cues and duration to
  synchronize a character clip without downloading the pack again.
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
const base = 'packs/'; // or your CDN's pack directory
await vfx.load(`${base}hoa-fireball${direction ? '@' + direction : ''}.vfxb`);
vfx.play('hoa-fireball', { from: hero.position, to: enemy.position, fitDistance: true });
```

Packs without `direction` metadata (all 1.0 packs) keep playing exactly as before.

## Combat juice

Three cheap effects that make a hit feel like one, switched on per play:

```ts
const vfx = await VfxPlayer.create(app, { shake: { target: camera }, colorMatrixFilter: ColorMatrixFilter });
vfx.play('hoa-fireball', { from: hero, hitstop: true, target: enemySprite });   // `to` defaults to the target
```

At every contact (each `hit` cue of the pack):

- **Hit-stop.** `hitstop: true` freezes the whole player for 2 frames (32 ms); a number is the freeze in ms (0-100). It freezes
  every playback, not only this one, and sets `vfx.frozen`: pause your own game logic on it so everything stops together.
  `vfx.freeze(ms)` does the same by hand. It replaces the pack's own longer hit-stop cue for that play.
- **Directional impulse.** The camera (`shake: { target }`) is kicked 2.5 px along the blow (the pack's hit vector, mirrored for left
  casts, else `from` to `to`) and rings out over about 200 ms, returning to exactly where it started. `impulse: 4` changes the size,
  `impulse: false` turns it off. It replaces the pack's non-directional jitter shake for that play.
- **Flash.** `target` is flashed at full strength for 2 frames, then decays over 80 ms (`flash: { color, frames, decayMs }`,
  `flash: false` to skip). By default two additive overlay sprites burn a **Sprite** out towards the flash colour. Pass Pixi's
  `ColorMatrixFilter` class as `colorMatrixFilter` for an exact flat silhouette of any Sprite or Container. It is injected rather
  than imported so pages that never flash do not download Pixi's filter system (about 140 KB). Flashing never stacks: a second hit
  restarts the flash.

Plays without these options behave as before. A pack without `hit` cues has no contact to react to.

## Flow trails

`FlowTrail` draws high-velocity energy, flame and wind ribbons from one small energy texture and one 64x64 wrapping noise texture,
animated on the GPU instead of baked into dozens of frames (Pixi 8 on WebGL; `FlowTrail.supported(app)` tells you).

```ts
const trail = new FlowTrail({ texture: energyTexture, width: 40, speed: 1.6, turbulence: 0.25 });
stage.addChild(trail.mesh); trail.reset(x, y);
app.ticker.add(t => { trail.push(x, y); trail.dissolve = age / life; trail.update(t.deltaMS); });
```

The energy texture scrolls along the ribbon and its UVs are warped by scrolling noise (more towards the tail, so the head stays
attached). `dissolve` 0 to 1 eats the ribbon from its tail along the noise, with a bright rim. `makeNoiseTexture(seed, size)` builds the
seamless default (16 KB). One quad strip, one draw call, no per-frame allocation.

## Gradient ramps

A pack baked with the factory's `--mono true` stores its energy (additive) layers as a luminance mask. The runtime colours the mask
through a 1D gradient ramp, so one atlas plays as any element and any custom colour:

```ts
vfx.play('hoa-fireball', { from, to, element: 'fire' });   // the pack's own look when `element` is omitted
vfx.play('hoa-fireball', { from, to, element: 'cyan' });   // the same atlas, recoloured
```

- Ramps: `kim`, `moc`, `thuy`, `hoa`, `tho`, `loi`, `phong` (aliases `metal`, `wood`, `water`, `fire`, `earth`, `lightning`, `wind`, ...)
  and the looks `gold`, `crimson`, `cyan` (`RAMP_PRESETS`). Add your own with `new VfxPlayer(app, { ramps: { ice: [[0, 0x000000], [0.5, 0x2040ff], [1, 0xffffff]] } })`
  or `vfx.addRamp(id, stops)`; a registered id beats an alias of the same name. Stops run from black at 0 to the hottest colour at 1.
- With no `element`, a pack plays through its **native ramp** (shipped in the manifest), which reproduces the baked look; an element
  ramp is a restyle (it colours by intensity, so it is not identical to the original colours).
- All ramps are rows of one 256 x 64 texture (64 KB). Quads carry their row as a vertex attribute, so different elements share a draw call.
- Every active play of a pack shares **one mesh per atlas sheet** and parent; `vfx.stats().quadBatches` is how many that is. Energy
  layers draw above the pack's material layers in the same parent. Materials (normal-blend layers) keep their own colours.
- Pixi 8 on WebGL runs the shader. On Pixi 7 and WebGPU the energy layers fall back to ordinary sprites tinted with the ramp's hue.
- Ramps and the batched mesh work with impact tiers (`layers`, `tiers`) too.

Honest limits: a mono pack uses the **same GPU memory** as the RGB one (a grey sheet still uploads as RGBA); the gain is that one atlas
serves every element. Packs currently use one sheet per layer, so a pack costs about one draw call per layer however many times it plays;
a shared atlas per pack would make that two.

## Allocation and pooling

Steady-state playback allocates nothing in the runtime itself: sprites and root containers come from pools (`Pool<T>`:
`acquire()` / `release()`, exported), the per-frame transforms write into preallocated typed arrays, ramp and trail vertices are
written into fixed buffers, and no closures, iterators or spreads run in `update()`. Two options go further for thermal-sensitive
games: `reuseEvents: true` hands listeners one shared event object per type (valid only inside the callback), and
`handle.pose(name, out)` fills an object you own. `Playback.finished` is created on first read.

Measure it with `node runtime/test/bench-gc.mjs [--mono FILE.vfxb] [--realtime]` (V8's sampling heap profiler and GC trace events;
3600 frames = 60 s, after a warm-up so V8's optimizer has run). Measured here (headless Chromium, a Fireball cast every 20 frames, so
about 11 overlap), 60 s of virtual playback:

| | Runtime 1.1 | Runtime 1.3 |
|---|---|---|
| Whole page allocation | 5840 B/frame | 2144 B/frame (-63%; most of what is left is Pixi's own render bookkeeping) |
| Scavenges in 60 s | 10 | 4 |
| Major GCs | 0 | 0 |

`play()` reuses its playback record (its arrays, matrix, tier plans and quad refs) from a pool and caches the per-family direction lists,
so a cast no longer builds them. Per scenario (3600 frames): sprite plays 93 B/frame of runtime-owned allocation (`play()` itself no
longer shows up; it was 42 B/frame, about 800 B per cast), juice 126, ramp 437-456, flow trail 46-48, with 0 major GCs and 5-9
scavenges per minute. That is close to zero but not zero: by default each `play()` still returns one small handle object, and ramp
plays still allocate in `draw()`. The handle stays inert after its play ends, so holding it is always safe. Pass `recycleHandles: true`
to hand out the pooled handle instead (no allocation at all in `play()`); then do not call a handle after its play has finished,
because a later `play()` may be using the same object. The first seconds after load allocate more until V8 has optimised the hot paths.
Not a device benchmark: it runs in headless Chromium with a software GL, so it shows allocation and GC behaviour, not frame time on a phone.

## Impact tiers

Packs baked with an `impact` block (format v1, optional field) split a hit into three tiers:
hit point (flash and sparks, drawn in front), ground feedback (decal and shockwave, under the
feet) and body residual (aura and wisps on the target's body). `play()` gives each tier its own
root and anchors it on the target instead of pasting one flat sticker:

- Each tier is **translated and mirrored, never sheared or stretched**, to its anchor: the baked
  target's feet as the pack itself places them (exactly your `to` with `fitDistance: true`, the baked
  distance along the cast otherwise), plus the tier's own height above the feet.
- Display order is bottom to top: ground feedback, the pack's other layers, body residual, hit point.
  Roots share `parent` and are separated by `zIndex` (-1, 0, +1, +2 around `zIndex`), so
  `sortableChildren` parents work. For real depth, pass `layers: { background, overlay, foreground }`:
  put `background` under every actor, `overlay` just above the target's sprite and `foreground` above
  everything. Missing slots fall back to `parent`.
- `tiers: { body_residual: false }` switches tiers off (they are not even attached): handy for low-end devices.
- A tier's additive layers use its `recommended_blend_mode` (`SCREEN` for the body residual, so it does not
  blow out the character's own pixels; `ADD` otherwise). `recommendedBlend: false` keeps the baked additive blend.
- `vfx.on('tier', e => ...)` fires once per tier, in cause-to-aftermath order, at its baked start frame
  (every loop cycle): `{ tier, tierNumber, packId, handle, point, anchorType, normalDeg?, zLayer, blend, startMs }`.
  `point` is the tier's live anchor in the parent's space; `normalDeg` (hit point only) is the contact
  normal, mirrored for left casts. Use it for decals under logic, hit-stop, sound and damage popups.

Packs without an `impact` block, or with a schema version this runtime does not know, play as flat
layers exactly as before. A version-1 block that contradicts its pack fails to load.

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
