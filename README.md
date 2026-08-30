<p align="center">
  <img src="assets/compact-reload-icon.png" width="180" alt="A document wrapped by a continuous reload ribbon">
</p>

<h1 align="center">Codex AGENTS.md Compact Reload</h1>

<p align="center"><strong>Compaction happens. Your project rules come back.</strong></p>

<p align="center">
  <a href="../../actions/workflows/ci.yml"><img src="https://github.com/paragon-ux/codex-agents-compact-reload/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
</p>

Keep project instructions present at the moment they matter most: immediately after Codex compacts a long-running conversation.

This small, dependency-free hook reloads the registered Git root's `AGENTS.md`, computes its SHA-256, and supplies the exact UTF-8 text to Codex's immediate post-compaction continuation. It does not inspect transcripts, retain prompts, or write runtime state into the project.

## Quick start

Requirements:

- Codex with lifecycle hooks enabled.
- Node.js 20 or newer.
- Git on `PATH`.
- A nonempty UTF-8 `AGENTS.md` at the registered Git root.

Verify the checkout:

```sh
npm run verify
```

Preview installation without writing anything:

```sh
node scripts/install.mjs --project my-project=<PROJECT_ROOT> --dry-run
```

Install for that project:

```sh
node scripts/install.mjs --project my-project=<PROJECT_ROOT>
```

The installer copies the hook beneath the active Codex home, registers one compact-triggered `SessionStart` command in `hooks.json`, and records the canonical project root. Existing unrelated hooks are preserved. After installation, trust the new hook in Codex Settings > Hooks or with `/hooks`.

## Companion skills

The [`skills/`](skills/) directory contains two small agent-facing workflows:

- `$codex-compact-reload-setup` verifies the checkout, previews installation, installs only when authorized, hashes the installed files, and distinguishes payload simulation from real-host acceptance.
- `$codex-compact-reload-cleanup` previews and removes named registrations or the complete installation while preserving unrelated hooks.

The cleanup skill uses the scoped uninstaller rather than asking an agent to improvise recursive deletion:

```sh
node scripts/uninstall.mjs --project my-project --dry-run
node scripts/uninstall.mjs --project my-project
```

Use `--all` instead of `--project` only when the complete installation should be removed.

## Why use it?

| Approach | Context and cache cost | Recovery control |
|---|---|---|
| No hook | No added context | Relies on the retained instruction snapshot; no explicit reload or source hash |
| Manual prompt | Adds a turn and usually repeats recovery context | Depends on a person noticing compaction and prompting consistently |
| Ralph-style loop | Reconstructs state for another iteration; changing prefixes can reduce cache reuse | Useful for repeated autonomous runs, but adds another startup and restoration surface |
| This hook | Adds one bounded, deterministic instruction artifact to the existing compact continuation | Automatically reloads the registered root file and exposes its exact source and hash |

The hook is designed to preserve prompt-cache-friendly stable context, avoid a separate recovery turn, and reduce stale-phase or wrong-workspace mistakes. See [Rationale](Rationale.MD) for the detailed comparison and limits.

## Why `SessionStart`, not `PostCompact`?

Codex's `PostCompact` command output can report status or stop continuation, but it does not provide the `additionalContext` channel needed to put instructions into the next model request. Codex emits `SessionStart` with source `compact` for the immediate continuation, and that event supports `additionalContext`.

The installed hook therefore uses:

```text
SessionStart
  matcher: compact
    -> validate registered Git root
    -> read root AGENTS.md as strict UTF-8
    -> enforce 32 KiB limit
    -> compute SHA-256
    -> inject instructions into immediate continuation
```

This supplements Codex's normal [`AGENTS.md` instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md); it does not replace it.

## Behavior examples

### Registered project

A compact continuation inside a registered project receives the root `AGENTS.md` text, canonical source path, project label, and source SHA-256.

### Nested working directory

A task working below the registered root is accepted only when Git resolves it back to that exact registered root.

### Unregistered project

The global hook returns an empty result and does nothing.

### Invalid registered project

Missing, empty, oversized, escaping, or invalid UTF-8 `AGENTS.md` content stops the compact continuation instead of producing success-shaped context.

## Multiple projects

Register several projects in one installation:

```sh
node scripts/install.mjs \
  --project frontend=<FRONTEND_ROOT> \
  --project backend=<BACKEND_ROOT>
```

On PowerShell, place the command on one line or use PowerShell's normal continuation syntax.

## Privacy and trust boundary

At runtime the hook reads only:

- the hook JSON payload supplied on standard input;
- its own `projects.json` registration file;
- Git's observed repository root; and
- the registered root's `AGENTS.md`.

It does not read Codex session files, transcripts, prompts, tool results, environment-variable values, credentials, or task artifacts. It writes no runtime handoff or history files. See [Security](docs/SECURITY.md) for the complete boundary.

`AGENTS.md` remains an instruction source, not evidence that work occurred. Claims about patches, tests, Git state, or external actions still require direct verification.

## Verification evidence

The current automated suite covers:

- exact content and SHA-256 injection;
- nested working directories;
- unregistered-project no-op behavior;
- stale unrelated registration isolation and invalid selected-registration failure;
- event filtering;
- missing, empty, oversized, and invalid UTF-8 failures;
- installer preservation of unrelated hooks;
- repeat-install idempotence;
- installed-hook execution;
- installer dry-run non-mutation;
- partial deregistration; and
- complete, recoverable uninstall without unrelated-hook loss.

Run the exact suite with `npm run verify`. The initial release was exercised on Windows with Node.js 22 and Git for Windows. A real Codex auto/manual compaction acceptance test remains a host-level verification step; the repository suite simulates the documented hook payload and validates the exact command output. Follow the [host acceptance protocol](docs/HOST-ACCEPTANCE.md) before making the hook a hard dependency of a high-assurance workflow.

CI runs the same verification suite on Windows and Linux with Node.js 20, 22, and 24.

## Compatibility

Release `v0.1.1` is tested with `codex-cli 0.147.0`. That is a compatibility snapshot, not a minimum-version claim: lifecycle-hook availability and payload behavior must still be confirmed for the Codex build where the hook is installed.

## Limitations

- This is continuity assistance, not an authenticated phase-authority system.
- The source hash is reported but is not compared to an independently frozen expected hash.
- The installer modifies the selected Codex home's `hooks.json` and requires explicit hook trust afterward.
- Hook availability and event behavior depend on the installed Codex version.
- Only the root `AGENTS.md` is reloaded; nested instruction-chain files are outside this tool's promise.

See [Architecture](docs/ARCHITECTURE.md), [Rationale](Rationale.MD), [Security](docs/SECURITY.md), and the [Publication record](docs/PUBLICATION.md) for design, tradeoffs, and provenance details.

## Design provenance

The project was independently implemented from the required behavior and the inspected Codex hook contract. The project concept was informed by [codex-compact-continuity](https://github.com/Sakiyary/codex-compact-continuity), which addresses a broader continuity problem. Its AI-assisted installation and manual cleanup documentation also informed the decision to provide two narrow companion skills. No source code from that project is included here.

## License

[MIT](LICENSE). Copyright (c) 2026 the codex-agents-compact-reload contributors.
