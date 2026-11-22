# pixijs-skill-vfx

[Live demo](https://lenhonbp.github.io/pixijs-skill-vfx/)

An agent skill (Claude Code, Codex) plus a tested TypeScript kit for **code-drawn 2.5D skill VFX
in PixiJS v7 and v8**. No art assets: textures are generated with Canvas 2D. The shared set is baked at startup;
specialized material sets are cached on first use.

![Preview](demo/preview.png)

- **Coverage**: attacks and impacts, AoE telegraphs, projectiles, beams, cone breath, chain
  lightning, meteors, heals, shields that break, buffs/debuffs, poison/burn/bleed with tick
  numbers, stun/freeze/slow/root, dash/blink/leap, summon circles, floating damage numbers,
  tornadoes, wind blades and vortices.
- **Five elements (Ngũ Hành / Wu Xing) + Phong (wind) and Lôi (lightning)**: Kim, Mộc, Thủy, Hỏa,
  Thổ and two variants, each with its own palette, shapes and motion, and 29 complete sample skills in
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

## Development and verification

| Command | Purpose |
|---|---|
| `npm run dev` | Watch, rebuild and serve the demo |
| `npm run typecheck` | TypeScript validation; equivalent to `npx tsc -p .` |
| `npm run build` | Bundle `demo/demo.js` |
| `npm run capture` | Build/serve and capture deterministic contact sheets |
| `npm run check` | Browser lifecycle, pool, particle-budget and runtime contracts; build first |
| `npm run check:docs` | Node-only export-index, file-map and sample-count gate |

See [verification and reproducibility](references/extending.md#verification-and-reproducibility)
for setup, capture flags, tier-less versus tiered captures, exact checkpoints, RNG,
particle baselines and focused regression tests. Inspect captures as well as counts.

The iteration/choreography approach is inspired by
[pixelfx](https://github.com/patch-gg/pixelfx) and Hugo Duprez's VFX method;
no renderer or effect implementation is ported.

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | Instructions the agent follows |
| `.claude-plugin/` | Marketplace and plugin manifests; root skill registration |
| `kit/index.ts` | Public entry point; every export is listed in [references/api.md](references/api.md) |
| `kit/` | Runtime, specialized recipes and texture/material modules; [complete file map](SKILL.md#runtime) |
| `examples/skills.ts` | 29 sample skills over a small `SkillContext` |
| `references/api.md` | Canonical public-API index and direct-module import boundaries |
| `references/recipes.md` | Recipe options, textures, floor rings and activation contract |
| `references/extending.md` | Custom elements, recoloring, timing, reactions, status catalog and verification |
| `references/elements.md` | Seven built-in element design languages and sample families |
| `references/advanced-fx.md` | Ribbons, noise, distortion, bloom and quality tiers |
| `references/blender-2-5d.md`, `references/pixi-v7-v8.md` | Blender projection and compatibility |
| `tools/` | Check/capture scripts, baseline, focused regressions and Blender rig; [complete tool map](SKILL.md#tools) |
| `demo/main.ts`, `demo/index.html`, `demo/preview.png` | Showcase source, controls and preview; generated bundle is `demo/demo.js` |
| `package.json`, `tsconfig.json` | Commands/dependencies and TypeScript configuration |
| `.github/workflows/` | CI validation and Pages deployment |
| `LICENSE` | MIT license |

## Example prompts

Activation tiers (**Cơ bản → Thức tỉnh → Tiến hoá**) add live-following elemental
seals, wisps and ascension bursts. Use the demo tier selector and **Evolve** button;
`skillActivation` and `skillEvolution` work with any palette, including neutral.
See the [activation contract](references/recipes.md#activation-and-evolution) for scheduling
and return values.

- "Use pixijs-skill-vfx to add a frost slash for the warrior's skill 2, hit on frame 3 of the attack animation."
- "Make the boss's ground slam: 600 ms red telegraph, then a shockwave and debris, damage on impact."
- "Port our fireball VFX onto the kit and keep it under 120 particles."
- "Make a Thổ (earth) ultimate in the style of Mountain Crash but with a 3-hit combo."
- "Our stun icon is a static sprite; replace it with the kit's stun stars and a freeze variant for ice skills."

## License

MIT
