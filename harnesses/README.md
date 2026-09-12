# Supported Harness Integrations

This directory contains integration guides and configuration recipes for AI coding agent harnesses supported by **AGENTS.md Compact Reload**.

---

## Support Tier Matrix

| Harness | Subfolder | Primary Tier | Mechanism | Delivery Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI Codex** | [`codex/`](codex/README.md) | **Tier 1** | `SessionStart` (compact) lifecycle hook via `hooks.json` | 100% deterministic stdin/stdout injection |
| **Google Antigravity** | [`agy/`](agy/README.md) | **Tier 1** | `PreInvocation.injectSteps` protocol | 100% deterministic out-of-context hook |
| **Claude Code** | [`cc/`](cc/README.md) | **Tier 1 & Tier 3** | `post_compact` hook script & `CLAUDE.md` directive | Deterministic hook with persistent fallback |
| **Cursor** | [`cursor/`](cursor/README.md) | **Tier 3** | `.cursor/rules/agents-reload.mdc` | Persistent system prompt rule |
| **Hermes Agent** | [`hermes/`](hermes/README.md) | **Tier 1 & Tier 2** | `pre_llm_call` shell hook via `config.yaml` & native `mcp_servers` | Deterministic compaction-gated injection with native MCP + context-file baseline |

---

## Detailed Guides

- **[OpenAI Codex Integration](codex/README.md)**: `SessionStart` vs. `PostCompact`, version gating (0.145.0+), Windows NTFS short-path wrapper, and companion skills.
- **[Google Antigravity Integration](agy/README.md)**: `PreInvocation` input/output contract and `<RULE>` system prompt integration.
- **[Claude Code Integration](cc/README.md)**: `.claude/config.json` post-compact hook and `CLAUDE.md` instructions.
- **[Cursor Integration](cursor/README.md)**: `.cursor/rules/agents-reload.mdc` configuration.
- **[Hermes Agent Integration](hermes/README.md)**: `pre_llm_call` shell hook in `config.yaml`, compaction-marker gate, consent allowlist, and native MCP pairing.