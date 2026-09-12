# Architecture

## Public promise

For an explicitly registered Git repository, inject the exact root `AGENTS.md` text into the immediate post-compaction continuation across AI agent harnesses (OpenAI Codex, Google Antigravity, Claude Code, Cursor, Hermes Agent) without reading or persisting the surrounding conversation.

## Components

### Installer

`scripts/install.mjs` performs an explicit host mutation:

1. Requires and validates the asserted active Codex version against stable `0.145.0` or newer.
2. Canonicalizes each requested project root.
3. Requires a Git-root marker and nonempty root `AGENTS.md`.
4. Copies the runtime hook under `<CODEX_HOME>/hooks/agents-compact-reload/`.
5. Merges project registrations and the compatibility identity into `projects.json`.
6. Merges one compact `SessionStart` handler into `<CODEX_HOME>/hooks.json` while preserving unrelated handlers.

On Windows, Codex 0.147.0 wraps hook commands with `cmd.exe /C` in a form that mis-parses embedded quoted segments (openai/codex#38168). The installer therefore writes a minimal batch wrapper containing the normally quoted Node and hook paths, then registers the wrapper's validated, quote-free NTFS short path as `commandWindows`. It fails closed when that token cannot be represented safely. Other platforms retain canonical quoted paths.

The installer is repeatable. It removes an earlier handler that points to the same installed runtime before adding the current handler.

The setup companion skill wraps this installer with checkout verification, a dry run, installed-file hashes, and an explicit reminder that simulated hook input is not real-host compaction evidence.

Stable Codex CLI 0.145.0 is the compatibility floor for the Codex integration because it is the first stable release containing OpenAI's immediate compact-continuation delivery fix (`8c41ed33`). Earlier builds can defer and replay compact `SessionStart` hooks. The runtime cannot repair that host ordering defect without a compact-boundary identifier, so unsupported hosts are rejected at installation rather than producing a weakened success claim.

### Uninstaller

`scripts/uninstall.mjs` removes named registrations or the complete package installation. It always supports a non-mutating dry run, preserves unrelated hook groups, backs up `hooks.json` before complete handler removal, and deletes only the exact package install directory. Removing the last registration is equivalent to complete uninstall.

The cleanup companion skill requires an exact named-project or `--all` scope and delegates deletion to this script rather than constructing shell deletion commands.

### Runtime hook

`src/reload-agents.mjs` is dependency-free and supports both JSON-RPC hook protocols (OpenAI Codex, Google Antigravity) on standard input/output and formatted Markdown/JSON streams for CLI and harness scripts.

```text
       Context Compaction / Hook Trigger
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
  [ Codex ]     [ Antigravity ]   [ CLI / Claude Code ]
SessionStart     PreInvocation      --format=markdown
 (compact)       (workspacePaths)       (or json)
       │               │               │
       └───────────────┼───────────────┘
                       ▼
           registered-root selection ---- no match ----> {}
                       │
                       ▼
           observed Git root == registered root
                       │
                       ▼
             root AGENTS.md validation
                       │
                       +---- invalid ----> continue=false
                       │
                       ▼
            strict UTF-8 decode + SHA-256
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
SessionStart       injectSteps       Markdown stdout
additionalContext  ephemeralMessage   (or JSON obj)
```

## Security properties

- Project activation is allowlisted by canonical root.
- Unrelated stale absolute registrations are ignored; strict existence and Git-root validation applies after the current project is selected.
- Git independently confirms the root for the current working directory.
- The instruction file must resolve beneath the registered root.
- Empty, invalid UTF-8, and files larger than 32 KiB fail closed.
- Runtime failures return `continue=false`; they do not return plausible instructions.
- Runtime processing creates no persistence artifacts.

## Non-goals

- Reconstructing conversation history.
- Proving that an earlier command or test succeeded.
- Reloading nested or hierarchical agent instruction chains.
- Providing authenticated or immutable phase state.
- Blocking all tool use until a separate evidence package is revalidated.
- Proving a real host manual or automatic compaction round trip; that remains a host acceptance campaign.
