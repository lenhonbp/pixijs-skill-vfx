# Verification matrix

Load this file when selecting or executing the FAST/STANDARD/DEEP gates. The point of verification is reproducible evidence, not a ritualized ten-step checklist.

## Universal gates, all modes

1. Identify the changed behavior and how to demonstrate it.
2. Inspect `git status`/diff when git is available; preserve unrelated edits.
3. Use the repository's standard commands, not assumptions about npm. Respect lockfiles and existing runtime versions. Do not upgrade dependencies just to make checks green.
4. Run a direct functional example or explain why it cannot run. Capture command, exit status, and relevant output.
5. Report failures and uncertainty explicitly. No evidence means **UNVERIFIED**, not pass.

## FAST

- Check syntax/compile/type/lint only as relevant to changed files and repo conventions.
- Run focused tests or a repeatable real example covering the change.
- Inspect diff for accidental changes, paths, secrets, and interface compatibility.
- Escalate if the patch exposes real users, auth, data migration, deployment, or performance risk.

## STANDARD

- Record repo baseline failures if obtainable without unreasonable cost.
- Run relevant typecheck, lint, unit/integration tests and build commands that the repository defines. Avoid full-suite requirements that do not exist in this repo.
- Add targeted regression tests. Exercise the complete primary path with realistic inputs.
- UI: prefer actual browser/Playwright navigation where supported; test happy path, critical error/empty/loading states, responsiveness where relevant, and capture screenshots with actual tool output. If not available, say so.
- CLI: `--help` when supported, representative invocation, correct error exit on bad input, documented input/output.
- Pipeline: inspect produced artifacts and compare deterministic properties or checksums when appropriate.
- Document how to run and known limits in README or existing project docs.

## DEEP

Run all applicable STANDARD checks, plus:

- Data/security: validate permission boundaries, auth, RBAC/least privilege, secret handling, data retention, privacy, untrusted input, and safe logging.
- Operational changes: dry-run and backup/rollback plan, deployment or migration approvals, failure paths, and recovery procedure.
- Performance-sensitive work: baseline and after on matched hardware/runtime/settings, warm-up excluded, several runs, median plus tail p95/p99 where meaningful; note variance. Use an agreed regression budget, not a universal 5% threshold treated as scientific fact.
- Memory/resource: bounded queues/caches, disposal of GPU/canvas resources, large file streaming, peak memory or repeated-run leak checks where relevant.
- Platform-specific behavior (macOS tooling, GPU acceleration, Blender): verify on the target platform. Linux success is not macOS verification.
- CI/review: resolve introduced failures, record pre-existing ones, and do not bypass required reviews.

## Evidence ledger

Use a short ledger, for example:

| Check | Evidence | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | PASS |
| Regression test | `pytest tests/test_pack.py` | PASS |
| Browser test | tool unavailable | NOT RUN |
| Build | blocked by missing credentials | BLOCKED |

The examples are illustrative, **not** evidence of a real execution. Use actual commands/results in delivery. If a test fails, fix the root cause and rerun the affected checks. Never suppress evidence to present a green result.
