---
name: lenhon-vfx
description: Add Lenhon's free pre-baked 2.5D skill effects (fireball, sword rain, frost nova, chain lightning, tornado, buffs, debuffs and more) to a PixiJS v7 or v8 game with the MIT @lenhonbp/pixijs-vfx-runtime. Use when the user wants spell, skill, hit or combat VFX in a PixiJS project, or asks to wire up a Lenhon `.vfxb` pack.
license: MIT
---

# Lenhon VFX for PixiJS

This skill integrates **existing baked packs** into a PixiJS game. It does not
author new effects: each `.vfxb` file is a finished, self-contained effect
(sprite sheets + timing + cues) that the runtime plays. Preview every effect at
https://lenhonbp.github.io/pixijs-skill-vfx/ before choosing.

## Workflow

1. **Check the project.** Find the PixiJS version in `package.json` (`pixi.js`
   7.x or 8.x are supported) and the static assets directory (`public/` for
   Vite, Next.js and CRA; otherwise wherever the game serves files from).
2. **Install the runtime.**
   ```sh
   npm install @lenhonbp/pixijs-vfx-runtime
   ```
   `pixi.js` is a peer dependency; do not add a second copy.
3. **Download the chosen packs** with the bundled script (Node 18+). It reads
   the live collection index, downloads desktop and mobile files and checks
   their byte sizes:
   ```sh
   node <this-skill-dir>/scripts/fetch-packs.mjs --list
   node <this-skill-dir>/scripts/fetch-packs.mjs hoa-fireball lightning-chain --out public/vfx
   ```
   Use `--tier desktop` or `--tier mobile` to fetch one variant only. A pack's
   desktop file is `<id>.vfxb`; its smaller phone file is `<id>.m.vfxb`. Both
   contain the same effect id.
4. **Create one player** after the Pixi application exists, and load packs once
   (at startup or before a fight), not on every cast.
5. **Play at ground positions.** `from` and `to` are the caster's and target's
   feet, in the coordinate space of `parent` (default `app.stage`).
6. **Clean up** with `vfx.unload(id)` for packs a scene no longer needs and
   `vfx.destroy()` when the game or scene is torn down.

## Minimal integration

```ts
import { Application } from 'pixi.js';
import { VfxPlayer } from '@lenhonbp/pixijs-vfx-runtime';

const app = new Application();
await app.init({ width: 1280, height: 720 }); // Pixi v7: new Application({ ... })

const vfx = await VfxPlayer.create(app, { packs: ['vfx/hoa-fireball.vfxb'] });
vfx.play('hoa-fireball', { from: hero.position, to: enemy.position });
```

Choose the mobile file on small or high-DPR screens to cut download size:

```ts
const mobile = matchMedia('(max-width: 720px)').matches;
const pack = (id: string) => `vfx/${id}${mobile ? '.m' : ''}.vfxb`;
await vfx.load([pack('hoa-fireball'), pack('lightning-chain')]);
```

## Gameplay hooks

```ts
const vfx = await VfxPlayer.create(app, {
  packs: ['vfx/kim-golden-edge.vfxb'],
  shake: { target: world }, // optional camera shake on the given container
  hitstop: true,            // optional freeze-frame on impact cues
});
vfx.on('cue', cue => {
  if (cue.type === 'sound') sfx.play(cue.id); // the runtime never creates audio
  if (cue.type === 'hit') flashTarget();      // visual contact; keep damage server/game authoritative
});

const handle = vfx.play('kim-golden-edge', { from: home, to: enemy.position, parent: world, zIndex: 10 });
app.ticker.add(() => {
  const pose = handle.pose('caster'); // dashes and flight baked into the effect; null if none
  if (pose) hero.position.set(home.x + pose.x, home.y + pose.y - pose.lift);
});
await handle.finished;
```

Other `play` options: `speed` (default 1), `loop` (repeat until `handle.stop()`),
`zIndex` (needs `parent.sortableChildren = true`), `fitDistance` (stretch the baked horizontal distance to the real caster–target
gap), `groundSquash` (your camera's ground y / screen y; default from the pack).
Effects mirror automatically when the target is left of the caster.

### Any direction (3D / 2.5D)

Directional packs come as a family: `<id>.vfxb` (cast right), `<id>@45.vfxb`
(down-right), `<id>@90.vfxb` (down), `<id>@-45.vfxb` (up-right), `<id>@-90.vfxb`
(up); mobile adds `.m` before `.vfxb`. Left-hand casts mirror these. Load the
directions the scene can cast in under the same id; `play` picks the nearest one
for the real caster–target ground angle and corrects the rest. `packDirection(from, to)`
returns which file a cast needs. Self buffs ship only `<id>.vfxb`. Check
`directions` in the public `index.json` for which files a skill has.
`fetch-packs.mjs` downloads every baked direction of a requested id by default;
append `@<dir>` (e.g. `hoa-fireball@90`) to fetch one direction only.
`vfx.getManifest(id)` returns duration and cues for syncing animations;
`vfx.stats()` reports active plays, pooled sprites and loaded packs.

## Pitfalls

- Pass **ground points** (feet), never head or sprite-center positions.
- Pixi v8 needs `await app.init(...)` before creating the player.
- Serve packs over HTTP(S). Cross-origin hosting needs CORS headers.
- Keep an opaque Pixi background (draw the game background inside Pixi). A
  transparent canvas over HTML can show dark boxes around additive glow.
- An id is loaded once; `unload(id)` before loading a replacement file for it.
- `.vfxb` files are lightly scrambled against casual scraping. Do not try to
  decode, edit or re-export them; play them through the runtime.

## Free collection

| Id | Name (EN / VI) | Element | Category | Desktop / mobile MB |
|---|---|---|---|---|
| `kim-sword-rain` | Sword Rain / Vạn Kiếm Quy Tông | kim | aoe | 2.42 / 1.17 |
| `kim-golden-edge` | Golden Edge / Kim Quang Trảm | kim | attack | 2.87 / 0.68 |
| `kim-golden-bell` | Golden Bell / Kim Chung Tráo | kim | buff | 2.38 / 0.77 |
| `moc-vine-bind` | Vine Bind / Triền Đằng Phược | moc | control | 1.72 / 0.36 |
| `moc-spring-bloom` | Spring Bloom / Xuân Hồi Đại Địa | moc | buff | 2.02 / 0.66 |
| `moc-toxic-spores` | Toxic Spores / Độc Chướng Vụ | moc | debuff | 2.91 / 1.22 |
| `thuy-frost-nova` | Frost Nova / Băng Phong Tỏa | thuy | control | 3.23 / 1.28 |
| `thuy-glacier-path` | Glacier Path / Băng Hà Lộ | thuy | aoe | 3.30 / 1.29 |
| `hoa-fireball` | Fireball / Hỏa Cầu Thuật | hoa | attack | 1.62 / 0.87 |
| `hoa-dragon-breath` | Dragon Breath / Long Tức Liệt Diễm | hoa | channel | 3.04 / 1.14 |
| `hoa-heaven-fire` | Heavenfall Meteor / Thiên Hỏa Lưu Tinh | hoa | aoe | 2.68 / 1.27 |
| `hoa-fire-dragon-crossing` | Fire Dragon Crossing / Hỏa Long Quá Giang | hoa | aoe | 2.44 / 1.05 |
| `tho-fissure` | Earth Fissure / Địa Liệt Trảm | tho | control | 3.01 / 1.05 |
| `tho-stone-skin` | Stone Skin / Thạch Giáp Hộ Thể | tho | buff | 2.69 / 0.89 |
| `phong-gale-blade` | Gale Blades / Phong Nhận Trảm | phong | attack | 0.91 / 0.17 |
| `phong-whirlwind` | Whirlwind / Toàn Phong Trảm | phong | aoe | 2.11 / 0.41 |
| `phong-tornado` | Dragon Cyclone / Long Quyển Phong | phong | control | 2.81 / 1.30 |
| `phong-tailwind` | Tailwind / Tật Phong Bộ | phong | buff | 1.83 / 0.35 |
| `lightning-chain` | Chain Lightning / Lôi Đình Liên Kích | loi | attack | 0.36 / 0.10 |
| `loi-heaven-strike` | Heavenly Thunder / Thiên Lôi Giáng | loi | aoe | 2.46 / 0.76 |
| `loi-thunder-domain` | Thunder Domain / Lôi Vực | loi | control | 2.81 / 1.15 |
| `seal-silence` | Silencing Seal / Phong Ấn Thuật | neutral | debuff | 2.04 / 0.82 |
| `sunder-mark` | Sundering Mark / Phá Giáp Ấn | neutral | debuff | 1.06 / 0.33 |
| `war-cry` | War Cry / Chiến Hống | neutral | buff | 2.09 / 0.78 |
| `curse-weaken` | Curse of Frailty / Suy Nhược Chú | neutral | debuff | 2.65 / 0.95 |

The runtime and free packs are MIT and may be used commercially; keep the
copyright and license notice. The showcase's character artwork is not part of
the packs. Larger production collections are listed under Premium Skill Packs
at https://github.com/lenhonbp/pixijs-skill-vfx#premium-skill-packs--coming-soon.
