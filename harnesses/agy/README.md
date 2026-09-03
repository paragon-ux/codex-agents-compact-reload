# Google Antigravity & Gemini Integration (Tier 1 & Tier 3)

This guide documents the Google Antigravity (Agy) / Gemini integration for **AGENTS.md Compact Reload**.

---

## 1. Overview

Antigravity operates with strict turn-based tool execution and supports active hook injection (`PreInvocation.injectSteps`) and workspace instruction rules (`<RULE>` system blocks).

---

## 2. Tier 1: Active Hook Protocol (`PreInvocation`)

Antigravity provides an out-of-context process hook receiving the active workspace paths:

### Input Payload (Stdin):
```json
{
  "workspacePaths": ["/path/to/project"],
  "invocationNum": 2
}
```

### Injected Output (Stdout):
```json
{
  "injectSteps": [
    {
      "ephemeralMessage": "Post-compaction project instructions were reloaded from the registered Git root.\nProject: my-project\n...\n<project-agents-md>\n...\n</project-agents-md>"
    }
  ]
}
```

The hook automatically detects the `workspacePaths` array, resolves the canonical registered Git root, validates the `AGENTS.md` file, and emits `injectSteps` directly into the agent context before model execution.

---

## 3. Tier 3: Workspace Rules (`<RULE>`)

In Antigravity workspaces, `AGENTS.md` is registered as a permanent system instruction rule in workspace configuration (`.gemini/rules/agents-reload.md`):

```markdown
# Antigravity Rules Continuity
Review the root `AGENTS.md` immediately upon context compaction. Adhere strictly to project constraints, test commands, and invariant rules defined therein.
```