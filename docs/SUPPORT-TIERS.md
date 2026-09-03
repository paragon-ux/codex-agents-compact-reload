# Multi-Harness Support Tiers for Post-Compaction Instruction Reload

This document defines the **Standardized 3-Tier Classification Model** for post-compaction continuity and instruction reloading across AI coding agent harnesses.

---

## 1. The Core Continuity Problem

When an AI coding agent context window compacts or rolls, conversational history is summarized or truncated. If the agent relies solely on prior conversation turns to remember project rules and boundaries, **the instructions are lost at the exact moment they are needed most**.

To solve this, reload bootloaders provide deterministic re-injection of the registered root `AGENTS.md`. Different AI coding harnesses support different integration mechanisms, classified into three distinct support tiers:

---

## 2. Standardized 3-Tier Classification Model

| Support Tier | Mechanism | Delivery Guarantee | Target Harnesses |
| :--- | :--- | :--- | :--- |
| **Tier 1: Active Lifecycle Hook Injection** | Out-of-context process execution triggered by compaction or session boundary. | **100% deterministic.** Zero model tokens spent remembering to recover; instructions are prepended into the next turn before model invocation. | **OpenAI Codex** (`SessionStart` with `source: compact`), **Google Antigravity** (`PreInvocation.injectSteps`), **Claude Code** (`post_compact` hook script). |
| **Tier 2: MCP Resource & Prompt Ingestion** | In-band Model Context Protocol primitives (`resources/read`, `prompts/get`). | **High reliability.** Protocol-standard pull; model accesses instructions via subscribed URIs or prompt commands. | **Claude Code**, **Cursor Composer**, **Windsurf**, **Cline**. |
| **Tier 3: Persistent Prompt Directives** | Sticky system framing files surviving context window compactions. | **Best-effort.** Dependent on LLM instruction-following to call tools as step 1 when prior history is rolled. | **Cursor** (`.cursor/rules/*.mdc`), **Claude Code** (`CLAUDE.md`), **Antigravity** (`<RULE>` system blocks). |

---

## 3. Harness Configuration Details

### A. Tier 1: OpenAI Codex CLI

- **Event:** `SessionStart`
- **Matcher:** `compact`
- **Delivery Mechanism:** Stdin/Stdout JSON-RPC via `~/.codex/hooks.json`.
- **Payload Input:**
  ```json
  {
    "hook_event_name": "SessionStart",
    "source": "compact",
    "cwd": "/path/to/project"
  }
  ```
- **Injected Output:**
  ```json
  {
    "hookSpecificOutput": {
      "hookEventName": "SessionStart",
      "additionalContext": "<project-agents-md>...</project-agents-md>"
    }
  }
  ```

### B. Tier 1: Google Antigravity / Gemini

- **Event:** `PreInvocation`
- **Delivery Mechanism:** Out-of-context hook process emitting `injectSteps`.
- **Payload Input:**
  ```json
  {
    "workspacePaths": ["/path/to/project"],
    "invocationNum": 2
  }
  ```
- **Injected Output:**
  ```json
  {
    "injectSteps": [
      {
        "ephemeralMessage": "<project-agents-md>...</project-agents-md>"
      }
    ]
  }
  ```

### C. Tier 1 & Tier 2: Claude Code (CC)

- **Tier 1 (Hook):** Configured in `.claude/config.json`:
  ```json
  {
    "hooks": {
      "post_compact": "node <path-to-hook>/src/reload-agents.mjs --format=markdown"
    }
  }
  ```
- **Tier 3 (Directive):** Persistent root directive in `CLAUDE.md`:
  ```markdown
  ## Project Rules Continuity
  - Post-compaction instructions are anchored in root `AGENTS.md`.
  - Always review and adhere to registered project rules after context compaction.
  ```

### D. Tier 3: Cursor & Cursor Composer

- **Directive:** Placed in `.cursor/rules/agents-reload.mdc`:
  ```markdown
  ---
  description: Project instructions reload directive
  globs: *
  alwaysApply: true
  ---
  # Project Instructions Continuity
  When beginning a turn where prior conversation context has been compacted, re-read the root `AGENTS.md` before taking action.
  ```

---

## 4. Division of Labor with Waymark

The reload ecosystem cleanly separates **static behavioral governance** from **dynamic investigation state**:

```text
               Context Compaction Occurs
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
 [ codex-agents-compact-reload ]   [ waymark-compact-hook ]
  Target: Root `AGENTS.md`          Target: `.waymark/active.json`
  Role: Static behavioral rules     Role: Dynamic verified breadcrumbs
  Output: Project authority & hash  Output: Hops & relocated line spans
          │                               │
          └───────────────┬───────────────┘
                          ▼
        Immediate Post-Compaction Continuation
        (Full rules + Exact code breadcrumb trail)
```