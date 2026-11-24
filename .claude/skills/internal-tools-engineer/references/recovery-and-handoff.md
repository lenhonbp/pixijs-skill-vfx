# Recovery and handoff

Use for multi-step work, interrupted sessions, context compaction or external delegation. It is not permission to promise background work.

## Checkpoint only when useful

If the environment exposes a durable task/plan tool, use it. Otherwise, for long work, write a short task-specific note in a repo-appropriate location (for example `.agent-work/<task-slug>.md` if ignored or `docs/agent-handoffs/<task-slug>.md` if the team explicitly wants handoffs checked in). Avoid adding arbitrary tracking files to a customer's repository. For short jobs, normal commits/test logs are enough.

Record:

- Request and acceptance criteria, including the user's latest corrections and exclusions.
- Repository path, current branch, base commit if known, clean/dirty tree and unrelated user changes.
- Completed changes and exact paths; tasks remaining, dependencies and blockers.
- Commands/tests already run and actual results, with captured output paths where relevant.
- Decisions made, risks, approvals required, and next **safe** command or verification step.

## Resuming

1. Re-read the latest user request and repository instructions. Do not assume earlier session state still exists.
2. Inspect actual filesystem/git state and reconcile checkpoint notes with what really happened. A note is not authoritative over files or tool output.
3. Revalidate assumptions about dependencies, tests and remote branch state if needed.
4. Continue from the next safe step. Re-run any checks whose evidence became stale after a code change.
5. If a tool or agent session is missing, work sequentially and report limits. Do not pretend a background worker remained active.

## Minimal handoff template

```markdown
# Task: <short description>
Status: IN PROGRESS | BLOCKED | READY FOR REVIEW
Repo / branch: <observed values>
User constraints: <latest criteria>
Completed: <files and behavior>
Unrelated changes to preserve: <paths>
Evidence: <commands, results, output files>
Open issues: <blockers and approvals>
Next safe action: <one reproducible step>
```

Do not treat a task note, to-do list, or saved prompt as a substitute for a runnable artifact and verification.
