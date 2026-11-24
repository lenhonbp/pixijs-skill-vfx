# Internal Tools Engineer — Codex + Claude Code

One portable skill, intended for both Codex and Claude Code. Its `SKILL.md` uses only the common `name` and `description` frontmatter fields.

## Install quickly

Unzip `skill.zip`. From its extracted parent folder, run:

```bash
python3 internal-tools-engineer/scripts/install.py --agent both --scope user
```

For the current repository instead of your user account:

```bash
python3 internal-tools-engineer/scripts/install.py --agent both --scope project --project-root /path/to/repo
```

Run with `--dry-run` first to preview destination paths. Existing installations are never silently overwritten. Add `--replace` to make backup copies and install the new version.

## Manual installation

Copy the entire directory (not just `SKILL.md`):

- Codex, user: `~/.agents/skills/internal-tools-engineer/`
- Claude Code, user: `~/.claude/skills/internal-tools-engineer/`
- Codex, project: `<repo>/.agents/skills/internal-tools-engineer/`
- Claude Code, project: `<repo>/.claude/skills/internal-tools-engineer/`

Start a new session if the skill is not discovered. Ask Codex to `Use the internal-tools-engineer skill` or type `/internal-tools-engineer` in Claude Code.

## What it does

- Builds, fixes and maintains internal tools, scripts, CLIs, pipelines, dashboards and developer automations.
- Chooses FAST/STANDARD/DEEP verification based on risk.
- Works sequentially when no subagent capability exists.
- Requires real evidence and reports unverified work honestly.
- Does not confer access to repositories, networks, deployment systems or external tools by itself.

Original source: `internal-tools-engineer.md`, adapted to remove Devin/Cursor-specific assumptions and to add Codex/Claude Code compatibility.
