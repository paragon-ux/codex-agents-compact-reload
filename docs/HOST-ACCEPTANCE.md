# Codex host acceptance

The automated suite validates the command contract with simulated hook payloads. This protocol tests the stronger property: a real Codex compaction causes a fresh filesystem read and supplies the new `AGENTS.md` bytes to the compact continuation.

Run this only in a disposable Git repository and a disposable Codex home. Do not use private task content.

## Freeze the test identity

Before the session starts, retain:

- utility repository commit and tree;
- Codex version, which must be a stable release at or above `0.145.0`;
- Node executable path, version, and SHA-256;
- installed `reload-agents.mjs` path and SHA-256;
- installed `reload-agents.cmd` path and SHA-256 on Windows;
- installed `hooks.json` path and SHA-256, including the exact platform command;
- installed `projects.json` path and SHA-256; and
- disposable project root and initial `AGENTS.md` SHA-256.

Install through the `$codex-compact-reload-setup` companion skill and review/trust the generated hook definition. Confirm the installed `projects.json` records the same `installed_for_codex_version`, `minimum_codex_version`, and compact-delivery fix commit as the frozen test identity.

On Windows, require `commandWindows` to contain no double quotes, line breaks, or spaces and require its single short-path token to resolve to the frozen wrapper. Inspect and hash the wrapper, verify its quoted targets resolve to the frozen Node executable and installed hook, and exercise the exact registered command through `cmd.exe` with a simulated compact payload before starting Codex. This guards against the Windows command-runner failure tracked in [openai/codex#38168](https://github.com/openai/codex/issues/38168); direct invocation of the JavaScript file alone does not cover it.

## Manual compaction

1. Create a root `AGENTS.md` containing a unique marker `MARKER_A` and an instruction to report the active marker when neutrally asked.
2. Start a fresh Codex task in the disposable repository and confirm it observes `MARKER_A` through normal startup discovery.
3. Outside that task, replace the file with valid UTF-8 bytes containing a previously unseen `MARKER_B`. Retain the exact new SHA-256.
4. Trigger `/compact`. Do not tell the model to reread `AGENTS.md` and do not paste either marker into the task.
5. After continuation, use a neutral observation request such as “Report the active acceptance marker and injected source hash.”
6. Require the reported marker and source hash to equal the retained `MARKER_B` file. Confirm the hook UI/event evidence identifies `SessionStart` with source `compact`.

This distinguishes a fresh post-compaction read from Codex's retained startup instruction snapshot.

## Automatic compaction

Repeat the marker transition in a fresh task, but allow Codex to compact automatically during a bounded, non-sensitive workload. Replace `MARKER_A` with a new `MARKER_B` only after startup discovery and before automatic compaction. Run the practical target mode, including Fast mode when that is the intended deployment route.

Do not manually invoke `/compact`, restart the task, or remind the model to reread the file. Apply the same marker/hash acceptance rule.

## Delayed-delivery regression

This campaign guards against the behavior reported in [openai/codex#28736](https://github.com/openai/codex/issues/28736), fixed upstream by [`8c41ed33`](https://github.com/openai/codex/commit/8c41ed33ce3e39460e7b13b14c35e0c39bb5980d) and first released in stable Codex CLI 0.145.0.

In a fresh task, use a bounded non-sensitive workload that produces at least two automatic compactions inside one logical user turn. Retain ordered host hook and model-continuation evidence. For every observed compaction boundary, require exactly one matching `SessionStart(source=compact)` hook to finish before the next model sampling or tool phase begins. After that turn completes, send one neutral follow-up that does not itself compact and require zero compact-hook invocations and zero replayed reload context on that follow-up.

If the host cannot expose enough ordered evidence to establish those facts, the timing check is inconclusive. Do not infer immediate delivery merely because the final answer contains the expected marker. The runtime deliberately keeps no cross-event state and cannot distinguish a genuine new compact from a delayed replay on an affected host.

## Failure behavior

In a separate fresh task, delete, empty, oversize, or corrupt the registered root `AGENTS.md` after startup and before compaction. The compact continuation must stop with a non-success reason and must not receive plausible reloaded instructions.

Also register two disposable projects, delete one registration root, and compact inside the other. The live project must reload successfully. A compact event in an unrelated project must remain a no-op.

## Verdict

`PASS` requires all of the following on one frozen identity:

- manual marker/hash transition passes;
- automatic marker/hash transition passes in every deployment mode being claimed;
- the delayed-delivery regression proves one immediate reload per real compact and no later replay;
- invalid selected-project input stops continuation;
- stale unrelated registration does not affect another project or an unregistered project; and
- retained paths, hashes, versions, event source, timestamps, and observations are internally consistent.

An unavailable host feature, provider interruption, or inability to force bounded automatic compaction is inconclusive, not a pass. Any code, hook configuration, installed-script, project-registration, Codex-version, or Node-version change invalidates the frozen campaign identity.
