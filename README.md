# pixijs-skill-vfx

[Live demo](https://lenhonbp.github.io/pixijs-skill-vfx/)

An agent skill (Claude Code, Codex) plus a tested TypeScript kit for **code-drawn 2.5D skill VFX
in PixiJS v7 and v8**. No art assets: every texture is generated with Canvas 2D at startup.

![Preview](demo/preview.png)

- **Coverage**: attacks and impacts, AoE telegraphs, projectiles, beams, cone breath, chain
  lightning, meteors, heals, shields that break, buffs/debuffs, poison/burn/bleed with tick
  numbers, stun/freeze/slow/root, dash/blink/leap, summon circles, floating damage numbers,
  tornadoes, wind blades and vortices.
- **Five elements (Ngũ Hành / Wu Xing) + Phong (wind) and Lôi (lightning)**: Kim, Mộc, Thủy, Hỏa,
  Thổ and two variants, each with its own palette, shapes and motion, and 28 complete sample skills in
  `examples/skills.ts`.
- **Extend it for your game**: register custom elements, recolor palettes and compose skills with
  the [extension guide and status catalog](references/extending.md).
- **Modern techniques on stock Pixi**: mesh ribbon trails, curl-noise motion, screen-space
  distortion (shockwave refraction, heat haze) and bloom, with quality tiers for phones.
- **2.5D-correct**: ground plane + height, depth sorting, ground-aligned decals, and a Blender
  rig (`tools/blender_vfx_rig.py`) so effects match pre-rendered 3D sprites.
- **Production-minded**: pooled sprites, particle cap, hit-stop, screen shake, handles that clean
  up; every sample skill returns to 0 live particles on v7 and v8.

## Install

Keep the folder name `pixijs-skill-vfx` (it must match `name` in `SKILL.md`).

Claude Code plugin install:

```text
/plugin marketplace add lenhonbp/pixijs-skill-vfx
/plugin install pixijs-skill-vfx@pixijs-skill-vfx
```

The plugin manifest explicitly loads `./` as its skill directory: `SKILL.md` stays at
the repository root, with the kit and references alongside it.

- **Claude Code**: copy the folder to `<your-game-repo>/.claude/skills/pixijs-skill-vfx/`
  (project) or `~/.claude/skills/pixijs-skill-vfx/` (all projects). Claude loads it when you ask
  for skill effects; you can also say "use the pixijs-skill-vfx skill".
- **Codex**: copy it to `<your-game-repo>/.agents/skills/pixijs-skill-vfx/` (project) or
  `~/.agents/skills/pixijs-skill-vfx/` (user; older Codex versions read `~/.codex/skills/`). Restart Codex; then ask for the effect or
  invoke it with `$pixijs-skill-vfx`. If your Codex version has no skills support, add this
  line to your repo's `AGENTS.md`: `For any skill/ability VFX work, first read and follow .agents/skills/pixijs-skill-vfx/SKILL.md.`

## Try the demo

The live demo is built with PixiJS 8.23.0 and deployed to GitHub Pages on every push to `main`.

```sh
npm install
npm run build                 # bundles demo/demo.js
npx serve demo                # or any static server, then open it in a browser
```

Pick a skill from the list (or its displayed keyboard shortcut; tap the arena on phones), filter by element, replay with Space, slow down
to 0.5x/0.25x, switch quality and toggle bloom/distortion, or press Showcase to cycle all skills. `#showcase` in the URL starts it directly.
Works with pixi.js 7.4+ too: `npm i pixi.js@7` and rebuild.

### Frame captures

After `npm install`, install Chromium once with `npx playwright install chromium`.
Run `npm run capture -- --skills thuy-tidal-beam,kim-sword-rain --out ~/audit/after/`
to build and serve the demo, then capture seeded, deterministically stepped frames.
Use comma-separated skill IDs (`--skills a,b`); omit `--skills` to capture all skills.
Each output directory contains labeled PNG contact sheets and `counts.json` with live
particle counts at each skill's length + 1500 ms. The default output is `~/audit/before/`;
`--seed INTEGER` overrides the default seed of 12345.

## Validation and reproducibility

Run `npx tsc -p .`, `npm run build`, then `npm run check` (Chromium required).
The check casts each skill three times at high quality without clearing between casts;
at length + 1500 ms it requires zero particles/updaters and no pool-capacity growth.
Peak counts include delayed particles. The ordinary cap is 150; IDs containing the
hyphen-delimited word `ultimate` get 600. No current SkillDef has an ultimate flag,
so all existing samples use 150. Budget failures are reported, not automatically relaxed.

Use `new VfxWorld({ ...layers, seed: 12345 })` or supply `rng: () => number` (takes
precedence). `random`, `rand`, `randSign` and `pick` share the active RNG; `mulberry32`
and `setRng` are exported for custom harnesses. This is **process-global, last world
constructed wins**, not isolated per world; use one active world or explicitly set the
RNG when switching worlds. Omit both options for normal `Math.random` behavior.

The iteration/choreography approach is inspired by
[pixelfx](https://github.com/patch-gg/pixelfx) and Hugo Duprez's VFX method;
no renderer or effect implementation is ported.

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | Instructions the agent follows |
| `.claude-plugin/` | Marketplace and plugin manifests; root skill registration |
| `tools/check.mjs` | Seeded lifecycle, pool growth, particle budget and RNG gate |
| `tools/capture-frames.mjs` | Seeded contact-sheet captures (`npm run capture`) |
| `kit/` | Runtime and recipes (copy into your game) |
| `examples/skills.ts` | 28 sample skills over a small `SkillContext` |
| `references/extending.md` | Custom elements, recolors, composition, cleanup and status catalog |
| `references/` | Recipe catalog, element design, advanced FX, Blender matching, v7/v8 notes |
| `tools/blender_vfx_rig.py` | Prints camera/sun numbers from your Blender scene |
| `demo/` | Showcase app |

## Example prompts

- "Use pixijs-skill-vfx to add a frost slash for the warrior's skill 2, hit on frame 3 of the attack animation."
- "Make the boss's ground slam: 600 ms red telegraph, then a shockwave and debris, damage on impact."
- "Port our fireball VFX onto the kit and keep it under 120 particles."
- "Make a Thổ (earth) ultimate in the style of Mountain Crash but with a 3-hit combo."
- "Our stun icon is a static sprite; replace it with the kit's stun stars and a freeze variant for ice skills."

## License

MIT
