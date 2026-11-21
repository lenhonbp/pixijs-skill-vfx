# pixijs-skill-vfx

An agent skill (Claude Code, Codex) plus a tested TypeScript kit for **code-drawn 2.5D skill VFX
in PixiJS v7 and v8**. No art assets: every texture is generated with Canvas 2D at startup.

![Preview](demo/preview.png)

- **Coverage**: attacks and impacts, AoE telegraphs, projectiles, beams, cone breath, chain
  lightning, meteors, heals, shields that break, buffs/debuffs, poison/burn/bleed with tick
  numbers, stun/freeze/slow/root, dash/blink/leap, summon circles, floating damage numbers.
- **Five elements (Ngũ Hành / Wu Xing)**: Kim, Mộc, Thủy, Hỏa, Thổ, each with its own palette,
  shapes and motion, and 19 complete sample skills in `examples/skills.ts`.
- **2.5D-correct**: ground plane + height, depth sorting, ground-aligned decals, and a Blender
  rig (`tools/blender_vfx_rig.py`) so effects match pre-rendered 3D sprites.
- **Production-minded**: pooled sprites, particle cap, hit-stop, screen shake, handles that clean
  up; every sample skill returns to 0 live particles on v7 and v8.

## Install

Keep the folder name `pixijs-skill-vfx` (it must match `name` in `SKILL.md`).

- **Claude Code**: copy the folder to `<your-game-repo>/.claude/skills/pixijs-skill-vfx/`
  (project) or `~/.claude/skills/pixijs-skill-vfx/` (all projects). Claude loads it when you ask
  for skill effects; you can also say "use the pixijs-skill-vfx skill".
- **Codex**: copy it to `<your-game-repo>/.agents/skills/pixijs-skill-vfx/` (project) or
  `~/.agents/skills/pixijs-skill-vfx/` (user; older Codex versions read `~/.codex/skills/`). Restart Codex; then ask for the effect or
  invoke it with `$pixijs-skill-vfx`. If your Codex version has no skills support, add this
  line to your repo's `AGENTS.md`: `For any skill/ability VFX work, first read and follow .agents/skills/pixijs-skill-vfx/SKILL.md.`

## Try the demo

```sh
npm install
npm run build                 # bundles demo/demo.js
npx serve demo                # or any static server, then open it in a browser
```

Pick a skill from the list (or keys 1-0, Q-O), filter by element, replay with Space, slow down
to 0.5x/0.25x, or press Showcase to cycle all skills. `#showcase` in the URL starts it directly.
Works with pixi.js 7.4+ too: `npm i pixi.js@7` and rebuild.

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | Instructions the agent follows |
| `kit/` | Runtime and recipes (copy into your game) |
| `examples/skills.ts` | 19 sample skills over a small `SkillContext` |
| `references/` | Recipe catalog, element design, Blender matching, v7/v8 notes |
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
