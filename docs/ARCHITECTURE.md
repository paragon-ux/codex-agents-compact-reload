# Architecture

## Public promise

For an explicitly registered Git repository, inject the exact root `AGENTS.md` text into Codex's immediate post-compaction continuation without reading or persisting the surrounding conversation.

## Components

### Installer

`scripts/install.mjs` performs an explicit host mutation:

1. Canonicalizes each requested project root.
2. Requires a Git-root marker and nonempty root `AGENTS.md`.
3. Copies the runtime hook under `<CODEX_HOME>/hooks/agents-compact-reload/`.
4. Merges project registrations into `projects.json`.
5. Merges one compact `SessionStart` handler into `<CODEX_HOME>/hooks.json` while preserving unrelated handlers.

The installer is repeatable. It removes an earlier handler that points to the same installed runtime before adding the current handler.

### Runtime hook

`src/reload-agents.mjs` is dependency-free and communicates exclusively through JSON on standard input and standard output.

```text
Codex compact continuation
        |
        v
SessionStart(source=compact)
        |
        v
registered-root selection ---- no match ----> {}
        |
        v
observed Git root == registered root
        |
        v
root AGENTS.md validation
        |
        +---- invalid ----> continue=false
        |
        v
strict UTF-8 decode + SHA-256
        |
        v
SessionStart additionalContext
```

## Security properties

- Project activation is allowlisted by canonical root.
- Git independently confirms the root for the current working directory.
- The instruction file must resolve beneath the registered root.
- Empty, invalid UTF-8, and files larger than 32 KiB fail closed.
- Runtime failures return `continue=false`; they do not return plausible instructions.
- Runtime processing creates no persistence artifacts.

## Non-goals

- Reconstructing conversation history.
- Proving that an earlier command or test succeeded.
- Reloading the complete hierarchical Codex instruction chain.
- Providing authenticated or immutable phase state.
- Blocking all tool use until a separate evidence package is revalidated.

