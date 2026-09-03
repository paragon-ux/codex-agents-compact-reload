# Claude Code Integration (Tier 1 & Tier 3)

This guide documents the Claude Code (CC) integration for **AGENTS.md Compact Reload**.

---

## 1. Overview

Claude Code supports project configuration via `.claude/config.json` and persistent instruction files (`CLAUDE.md`).

---

## 2. Tier 1: Executable Lifecycle Hook

Register the hook script directly in `.claude/config.json` beneath `hooks.post_compact`:

```json
{
  "hooks": {
    "post_compact": "node <path-to-hook>/src/reload-agents.mjs --format=markdown"
  }
}
```

When Claude Code compacts conversation history, it executes the post-compaction hook script, capturing the reloaded `AGENTS.md` and prepending it into the immediate continuation turn.

---

## 3. Tier 3: Persistent Prompt Directive

Add this persistent rule block to the project root `CLAUDE.md`:

```markdown
## Project Rules Continuity (AGENTS.md Compact Reload)
- Core project instructions and invariants are defined in the registered root `AGENTS.md`.
- When context compaction occurs, review and adhere to the reloaded project rules before proceeding with code modifications or test execution.
```