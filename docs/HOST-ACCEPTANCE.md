# Codex host acceptance

The automated suite validates the command contract with simulated hook payloads. This protocol tests the stronger property: a real Codex compaction causes a fresh filesystem read and supplies the new `AGENTS.md` bytes to the immediate compact continuation.

Run only with non-sensitive content in disposable Git repositories and an isolated test Codex home or registration. Provision ordered evidence capture before the first promotional session; eventual marker output cannot establish immediate delivery retroactively.

## Freeze the test identity

Before a promotional session starts, retain:

- utility release tag, annotated-tag object, commit, and tree;
- Codex executable path, SHA-256, and observed stable version, which must be `0.145.0` or newer;
- expected model, reasoning effort, and service tier or Fast-mode state;
- selected profile identity, every active configuration source path and SHA-256, and the explicit non-secret effective values needed by the test, including `model_auto_compact_token_limit` and `model_auto_compact_token_limit_scope`;
- Node executable path, version, and SHA-256;
- installed `reload-agents.mjs` path and SHA-256;
- installed `reload-agents.cmd` path and SHA-256 on Windows;
- installed `hooks.json` path and SHA-256, including the exact platform command;
- installed `projects.json` path and SHA-256;
- evidence-capture mechanism, version, configuration SHA-256, and output root;
- workload source, command, bounds, and SHA-256; and
- disposable project root plus the exact initial and replacement `AGENTS.md` paths, bytes, and SHA-256 values.

Complete calibration and provision the body-free ordered-evidence capture before freezing a promotional identity. Freeze each promotional identity immediately before its fresh session launches; calibration identities remain separate and non-promotional.

Install from the exact release tag through the `$codex-compact-reload-setup` companion skill. Confirm the installed `projects.json` records the same asserted Codex version, compatibility floor, and compact-delivery fix commit as the frozen identity. Review and trust the exact installed hook normally before the session. Do not use a hook-trust bypass in promotional acceptance.

Immediately after launch and before replacing `MARKER_A`, bind the observed root-session identifier, model, reasoning effort, and service tier or Fast-mode state to the frozen expectations. A mismatch is `INVALID_TEST`.

On Windows, require `commandWindows` to contain no double quotes, line breaks, or spaces and require its single short-path token to resolve to the frozen wrapper. Inspect and hash the wrapper, verify its quoted targets resolve to the frozen Node executable and installed hook, and exercise the exact registered command through `cmd.exe` with a simulated compact payload before starting Codex. This guards against the Windows command-runner failure tracked in [openai/codex#38168](https://github.com/openai/codex/issues/38168); direct invocation of the JavaScript file alone does not cover it.

## Provision ordered evidence first

Before launching Codex, configure a bounded capture that can establish the order of:

1. each real automatic-compaction boundary;
2. the matching completed `SessionStart(source=compact)` hook and its injected source path and SHA-256;
3. the next model sampling or tool phase in the same turn; and
4. the next ordinary non-compacting user turn.

Retain host UI or supported event-stream metadata, plus the exact Codex version and event identifiers, ordinals, and timestamps. The capture must exclude Codex transcripts, prompts, and tool-output bodies; do not read or retain them for this campaign. The model's final marker/hash report is secondary evidence, not proof of timing.

If the capture cannot distinguish these events before execution begins, do not run a promotional campaign. If an attempted run lacks enough ordered evidence, its verdict is `INCONCLUSIVE`, even if the model eventually reports the replacement marker.

## Calibration is separate and non-promotional

Calibrate only in a separate disposable repository, registration, session, and workspace with calibration-only markers. Never reuse its `AGENTS.md`, registration identity, session, or captured evidence as acceptance evidence.

Use a harmless deterministic chunk emitter or equivalent bounded workload. Give every chunk a unique terminal marker, retain the emitter and workload hashes, and calibrate chunk size, call count, and auto-compaction threshold until one user turn reliably produces at least two automatic compactions. Calibration may be repeated; acceptance may not silently inherit or aggregate its results.

Use `model_auto_compact_token_limit` to stimulate compaction. Do not falsify `model_context_window`. Set `model_auto_compact_token_limit_scope` explicitly rather than relying on its default. `body_after_prefix` is preferred for a forced regression because it measures growth after the carried compaction prefix. If `total` is selected, calibration must show that the retained prefix does not cause an immediate compaction loop.

After calibration, freeze the final workload and test configuration, then create a fresh acceptance repository, registration, markers, and session. A workload deviation, skipped or batched call, truncated result, or fewer than two observed compactions makes the forced regression `INCONCLUSIVE`.

## Manual compaction

1. Create a root `AGENTS.md` containing a unique marker `MARKER_A` and an instruction to report the active marker when neutrally asked.
2. Start a fresh root Codex task in the disposable repository and confirm it observes `MARKER_A` through normal startup discovery.
3. Outside that task, replace the file with valid UTF-8 bytes containing a previously unseen `MARKER_B`. Retain the exact path, bytes, and SHA-256.
4. Trigger `/compact`. Do not tell the model to reread `AGENTS.md` and do not paste either marker into the task.
5. After continuation, use a neutral observation request such as “Report the active acceptance marker and injected source hash.”
6. Require the reported marker and source hash to equal the retained `MARKER_B` file. Confirm ordered host evidence identifies exactly one matching compact `SessionStart` before the continuation.

This distinguishes a fresh post-compaction read from Codex's retained startup instruction snapshot.

## Automatic compaction has two layers

### Forced multi-compaction regression

Use the frozen calibration-derived profile and workload in a fresh root task. Replace `MARKER_A` with `MARKER_B` only after startup discovery and before automatic compaction. Send one user turn that executes the workload sequentially and produces at least two automatic compactions without manual `/compact`, restart, or a reminder to reread instructions.

For every observed compact boundary `C_i`, require this strict subsequence inside the same user turn:

```text
C_i -> exactly one completed SessionStart(source=compact) H_i
    -> H_i injects the exact MARKER_B source path and SHA-256
    -> the next model sampling or tool phase K_i
```

No other matching `H_i` may occur for that boundary. After the long turn completes, send one short ordinary follow-up that does not compact and require zero compact-hook invocations and zero replayed reload context.

### Deployment-configuration smoke

Run a separate fresh automatic-compaction marker transition using the actual intended deployment profile, including its real model, reasoning effort, service tier or Fast-mode state, auto-compaction threshold, and threshold scope. Require at least one automatic compact with the same ordered `C_i -> H_i -> K_i` proof and exact replacement source/hash binding.

The forced regression proves the historical multi-compaction topology under a test stimulus. It does not qualify a different deployment configuration. Run the deployment smoke for every deployment mode being claimed. Inability to reach automatic compaction within the preregistered safe bound is `INCONCLUSIVE`, not `PASS`.

## Delayed-delivery regression

This campaign guards against the behavior reported in [openai/codex#28736](https://github.com/openai/codex/issues/28736), fixed upstream by [`8c41ed33`](https://github.com/openai/codex/commit/8c41ed33ce3e39460e7b13b14c35e0c39bb5980d) and first released in stable Codex CLI 0.145.0.

The forced multi-compaction regression reproduces the affected topology: multiple automatic compactions occur inside one logical user turn, each matching compact hook finishes before the immediate continuation, and the next ordinary turn receives no delayed duplicate. “The model eventually reported `MARKER_B`” is insufficient because it cannot distinguish immediate delivery from a later replay.

## Failure behavior

In separate fresh tasks, delete, empty, oversize, or corrupt the registered root `AGENTS.md` after startup and before compaction. The compact continuation must stop with a non-success reason and must not receive plausible reloaded instructions.

Also register two disposable projects, delete one registration root, and compact inside the other. The live project must reload successfully. A compact event in an unregistered project must remain a no-op. Retain the same identity and ordered-evidence fields for these negative cases.

## Verdict

`PASS` requires all of the following on their exact frozen identities:

- manual marker/source-path/hash transition passes;
- forced multi-compaction regression proves at least two immediate reloads and no next-turn replay;
- deployment-configuration automatic smoke passes in every claimed mode;
- invalid selected-project input stops continuation;
- stale unrelated registration does not affect another project;
- an unregistered project remains a no-op; and
- retained paths, hashes, configuration, trust state, event order, source bindings, and observations are internally consistent.

Use these non-pass verdicts:

- `FAIL`: a real compact lacks its immediate matching hook, a hook is duplicated or replayed, the injected source path, hash, or instruction bytes are wrong, or required failure/no-op behavior is violated on an otherwise valid identity.
- `INVALID_TEST`: a frozen identity mutates, calibration artifacts or sessions are reused, a manual compact occurs in an automatic test, hook trust is bypassed, evidence is substituted, or a different profile is claimed as the deployment configuration.
- `INCONCLUSIVE`: the provider or host is interrupted, the bounded workload cannot produce the required compactions, tool execution deviates from the frozen workload, or ordered evidence is unavailable or ambiguous.

Any utility code, hook configuration, installed script, project registration, Codex binary or version, Node binary or version, model route, reasoning or Fast-mode state, effective configuration, workload, or evidence-capture change invalidates the affected frozen campaign identity. Historical evidence remains attributable only to the identity on which it was observed.
