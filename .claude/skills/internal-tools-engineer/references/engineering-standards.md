# Engineering standards

Load only the relevant sections for the actual tool or repo. Match the host project's established patterns before imposing new abstractions.

## Architecture and dependency choices

- One tool should have a clear responsibility. Prefer explicit, testable interfaces and small cohesive modules over global mutable state.
- Validate at boundaries: CLI args, API payloads, file formats, and resource limits. Return actionable errors and nonzero exit status on failure.
- Centralize configurable thresholds, paths, budgets and feature flags with documented defaults. Avoid machine-specific absolute paths.
- Prefer deterministic outputs for generated artifacts: stable ordering, controlled randomness and test clocks, content hashes where useful.
- Prefer idempotent re-runs. For a multi-stage pipeline, write temporary files and atomically rename when possible.
- Use existing proven dependencies. For additions, verify maintenance, license compatibility, supported runtime and actual installation. Preserve the lockfile.
- Keep experiments isolated from production paths; remove unneeded scaffolding before handoff.

## Reliability and observability

- Retry only transient failures with a bounded policy and backoff. Never retry an invariant or logic error indefinitely.
- Expose progress for longer jobs and use checkpoints that can be resumed safely. Do not promise self-healing without actual watchdog or restart infrastructure.
- Log enough to reproduce failures while redacting sensitive values and customer data.
- On the second occurrence of the same failure, investigate upstream root causes rather than patching the symptom repeatedly.

## Browser, UI and admin tools

- Prove the core end-to-end journey using representative non-sensitive data.
- Use clear empty/error/loading states and validate accessibility basics: labels, focus order, keyboard interactions, contrast where applicable.
- Separate client-side form validation from server-side authorization. Never assume hidden buttons enforce permissions.
- Require approval before exposing an internal tool publicly, changing access policies, or enabling customer/production data access.

## Canvas, PixiJS, VFX and 3D/Blender pipelines

- Avoid allocations and repeated parsing in hot render paths. Use pooling where profiling supports it, and cap particles, caches, buffers and queues.
- Release GPU textures, geometry, canvases and workers at known lifecycle boundaries; verify behavior rather than assuming disposal worked.
- Move expensive decoding/compositing off the UI thread only if platform support and measurement justify it.
- Use appropriate typed arrays, chunk tables, atlas packaging and streaming for large asset inputs when they reduce memory or latency.
- For interactive rendering, favor consistent frame pacing and meaningful p95/p99 frame times over average FPS alone. For offline exporters, throughput may dominate.
- For generated images/meshes/animations: verify format, dimensions, alpha, frame count, names, pivots, packed metadata, expected hashes and deterministic reproducibility as applicable.
- Do not silently change visual style, rig conventions, file coordinate systems, pixel density or public asset formats.

## Review rejection criteria

Reject changes that introduce: silent catches, secrets in source/logs, unbounded resources, untested public contract changes, unrelated refactors, duplicate existing tools, breaking output formats, misleading bench data, or unsupported claims of real-device testing.
