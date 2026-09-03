# Cursor & Cursor Composer Integration (Tier 3)

This guide documents the Cursor integration for **AGENTS.md Compact Reload**.

---

## 1. Overview

Cursor utilizes a rolling context window and system prompt directives configured in `.cursor/rules/`.

---

## 2. Tier 3: Persistent MDC Directive

Create a rule file at `.cursor/rules/agents-reload.mdc`:

```markdown
---
description: Project instructions continuity and compact reload
globs: *
alwaysApply: true
---
# Project Instructions Continuity
1. This project registers its core architectural boundaries and guidelines in the root `AGENTS.md`.
2. When starting a turn where previous conversational context has been compacted, rolled, or lost, re-read `AGENTS.md` before taking action.
3. Adhere strictly to the verification requirements, testing procedures, and contracts specified in `AGENTS.md`.
```