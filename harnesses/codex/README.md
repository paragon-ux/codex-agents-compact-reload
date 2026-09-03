# OpenAI Codex Integration (Tier 1)

This guide documents the OpenAI Codex CLI integration for **AGENTS.md Compact Reload**.

---

## 1. Why `SessionStart`, not `PostCompact`?

Codex's `PostCompact` command output can report status or stop continuation, but it does **not** provide the `additionalContext` channel needed to inject instructions into the next model request. 

Instead, Codex emits `SessionStart` with source `compact` for the immediate continuation, and that event supports the `additionalContext` channel:

```text
SessionStart
  matcher: compact
    -> validate registered Git root
    -> read root AGENTS.md as strict UTF-8
    -> enforce 32 KiB limit
    -> compute SHA-256
    -> inject instructions into immediate continuation via additionalContext
```

This supplements Codex's normal [`AGENTS.md` instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md); it does not replace it.

---

## 2. Upstream Delivery Fix & Version Requirements

Older Codex builds had a delivery defect: automatic mid-turn compactions could queue this event until a later user turn, causing both missing immediate context and delayed duplicate injection ([openai/codex#28736](https://github.com/openai/codex/issues/28736)). 

OpenAI fixed it in commit [`8c41ed33`](https://github.com/openai/codex/commit/8c41ed33ce3e39460e7b13b14c35e0c39bb5980d), first included in **stable Codex CLI 0.145.0**. Installation therefore requires:
- Stable Codex CLI 0.145.0 or newer (tested with 0.147.0).
- Lifecycle hooks enabled in Codex settings.

---

## 3. Configuration & Registration

### Automated Installation via `scripts/install.mjs`
```sh
# Record active Codex version
codex --version

# Preview installation
node scripts/install.mjs --project my-project=<PROJECT_ROOT> --codex-version <CODEX_VERSION> --dry-run

# Install
node scripts/install.mjs --project my-project=<PROJECT_ROOT> --codex-version <CODEX_VERSION>
```

### Manual `~/.codex/hooks.json` Registration
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "command": ["node", "<path-to-hook>/src/reload-agents.mjs"]
      }
    ]
  }
}
```

---

## 4. Windows NTFS Short-Path Wrapper

On Windows, the installer writes a small batch wrapper and registers its validated, quote-free NTFS short path. The wrapper holds the normally quoted Node and hook paths outside Codex's outer command line. 

This avoids the `cmd.exe /C` embedded-quote failure tracked in [openai/codex#38168](https://github.com/openai/codex/issues/38168). Installation fails closed when the wrapper cannot be represented as a safe quote-free token.

---

## 5. Companion Skills

The [`.agents/skills/`](../../.agents/skills/) directory contains two repository-scoped workflows:
- `$codex-compact-reload-setup`: Verifies checkout, previews installation, and installs when authorized.
- `$codex-compact-reload-cleanup`: Previews and safely removes named registrations or complete installation.