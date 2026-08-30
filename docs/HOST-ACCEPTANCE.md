# Codex host acceptance

The automated suite validates the command contract with simulated hook payloads. This protocol tests the stronger property: a real Codex compaction causes a fresh filesystem read and supplies the new `AGENTS.md` bytes to the compact continuation.

Run this only in a disposable Git repository and a disposable Codex home. Do not use private task content.

## Freeze the test identity

Before the session starts, retain:

- utility repository commit and tree;
- Codex version;
- Node executable path, version, and SHA-256;
- installed `reload-agents.mjs` path and SHA-256;
- installed `projects.json` path and SHA-256; and
- disposable project root and initial `AGENTS.md` SHA-256.

Install through the `$codex-compact-reload-setup` companion skill and review/trust the generated hook definition.

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

## Failure behavior

In a separate fresh task, delete, empty, oversize, or corrupt the registered root `AGENTS.md` after startup and before compaction. The compact continuation must stop with a non-success reason and must not receive plausible reloaded instructions.

Also register two disposable projects, delete one registration root, and compact inside the other. The live project must reload successfully. A compact event in an unrelated project must remain a no-op.

## Verdict

`PASS` requires all of the following on one frozen identity:

- manual marker/hash transition passes;
- automatic marker/hash transition passes in every deployment mode being claimed;
- invalid selected-project input stops continuation;
- stale unrelated registration does not affect another project or an unregistered project; and
- retained paths, hashes, versions, event source, timestamps, and observations are internally consistent.

An unavailable host feature, provider interruption, or inability to force bounded automatic compaction is inconclusive, not a pass. Any code, hook configuration, installed-script, project-registration, Codex-version, or Node-version change invalidates the frozen campaign identity.
