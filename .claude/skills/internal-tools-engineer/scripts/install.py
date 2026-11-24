#!/usr/bin/env python3
"""Install the portable Internal Tools Engineer skill for Codex, Claude Code, or both.

No third-party dependencies. Never overwrites an existing installation without
--replace. Use --dry-run to inspect paths without changing the filesystem.
"""
from __future__ import annotations

import argparse
import datetime as dt
import shutil
import sys
import tempfile
from pathlib import Path

SKILL_NAME = "internal-tools-engineer"
RELATIVE_DIRS = {
    "codex": Path(".agents/skills"),
    "claude": Path(".claude/skills"),
}


def args_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agent", choices=["both", "codex", "claude"], default="both")
    parser.add_argument("--scope", choices=["user", "project"], default="user")
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replace", action="store_true", help="Back up an existing installation and install the new one")
    return parser


def present(path: Path) -> bool:
    return path.exists() or path.is_symlink()


def backup_path(destination: Path) -> Path:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    candidate = destination.with_name(f"{destination.name}.backup-{stamp}")
    index = 1
    while present(candidate):
        candidate = destination.with_name(f"{destination.name}.backup-{stamp}-{index}")
        index += 1
    return candidate


def install(source: Path, destination: Path, replace: bool) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    backup = None
    if present(destination):
        if not replace:
            raise FileExistsError(f"Already exists: {destination}. Re-run with --replace for a backup and update.")
        backup = backup_path(destination)
        destination.rename(backup)
        print(f"BACKUP {backup}")

    staged = Path(tempfile.mkdtemp(prefix=f".{SKILL_NAME}-", dir=destination.parent))
    try:
        shutil.copytree(source, staged, dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))
        staged.rename(destination)
        print(f"INSTALLED {destination}")
    except Exception:
        shutil.rmtree(staged, ignore_errors=True)
        if backup is not None and not present(destination):
            backup.rename(destination)
        raise


def main() -> int:
    args = args_parser().parse_args()
    source = Path(__file__).resolve().parent.parent
    if not (source / "SKILL.md").is_file():
        print(f"Missing SKILL.md in {source}", file=sys.stderr)
        return 1

    root = Path.home() if args.scope == "user" else args.project_root.expanduser().resolve()
    if args.scope == "project" and not root.is_dir():
        print(f"Project directory does not exist: {root}", file=sys.stderr)
        return 1

    agents = list(RELATIVE_DIRS) if args.agent == "both" else [args.agent]
    targets = [(name, root / RELATIVE_DIRS[name] / SKILL_NAME) for name in agents]

    # Preflight every target before writing to avoid partial installation due to an
    # existing destination on the second agent.
    for name, target in targets:
        if source == target.resolve() and not target.is_symlink():
            print(f"SKIP {name}: source is already installed at {target}")
            continue
        if present(target) and not args.replace:
            print(f"Already exists: {target}. Use --replace or choose a different scope.", file=sys.stderr)
            return 2

    for name, target in targets:
        if source == target.resolve() and not target.is_symlink():
            continue
        if args.dry_run:
            action = "BACKUP+INSTALL" if present(target) else "INSTALL"
            print(f"DRY RUN {name}: {action} {target}")
        else:
            install(source, target, args.replace)
    return 0


if __name__ == "__main__":
    sys.exit(main())
