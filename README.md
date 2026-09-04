<p align="center">
  <img src="assets/compact-reload-icon.png" width="180" alt="A document wrapped by a continuous reload ribbon">
</p>

<h1 align="center">AGENTS.md Compact Reload</h1>

<p align="center"><strong>Compaction happens. Your project rules come back.</strong></p>

<p align="center">
  <a href="../../actions/workflows/ci.yml"><img src="https://github.com/paragon-ux/codex-agents-compact-reload/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
</p>

Keep project instructions present at the moment they matter most: immediately after an agent harness compacts a long-running conversation.

This small, dependency-free bootloader reloads the registered Git root's `AGENTS.md`, computes its SHA-256, and supplies the exact UTF-8 text to the immediate post-compaction continuation across AI agent harnesses. It does not inspect transcripts, retain prompts, or write runtime state into the project.

---

## Table of Contents

- [Why Use It?](#why-use-it)
- [Cross-Repository Ecosystem](#cross-repository-ecosystem)
- [Standardized 3-Tier Harness Model](#standardized-3-tier-harness-model)
- [Quick Start](#quick-start)
- [Supported Harnesses](#supported-harnesses)
- [Division of Labor with Waymark](#division-of-labor-with-waymark)
- [Multi-Project Registration](#multi-project-registration)
- [Privacy and Trust Boundary](#privacy-and-trust-boundary)
- [Verification Evidence](#verification-evidence)
- [Repository Directory](#repository-directory)
- [Documentation & Provenance](#documentation--provenance)

---

## Cross-Repository Ecosystem

This repository is part of an integrated, local-first multi-agent execution suite:

### Internal Suite Repositories

| Repository | Role & Responsibility | Core Invariant |
| :--- | :--- | :--- |
| **[`AGENTS.md Compact Reload`](https://github.com/paragon-ux/codex-agents-compact-reload)** | Static project governance & compaction survival. | Re-injects verified `AGENTS.md` and SHA-256 hash on context compaction. |
| **[`Waymark`](https://github.com/paragon-ux/waymark)** | In-flight continuity ledger & AST discovery MCP. | Preserves verified code hops (`.waymark/`) across compactions (<216 tokens). |
| **[`Arbiter`](https://github.com/paragon-ux/Arbiter)** | Multi-agent DAG orchestrator & worktree supervisor. | Enforces `1 Task : 1 Worktree : 1 Trajectory`; fail-closed merge quarantine. |

#### When to Use What

- **Use [`AGENTS.md Compact Reload`](https://github.com/paragon-ux/codex-agents-compact-reload)** when an agent harness compacts context and you must deterministically guarantee that static project instructions, safety guardrails, and coding conventions are restored into the active session without spending agent recovery turns.
- **Use [`Waymark`](https://github.com/paragon-ux/waymark)** when an agent is deep in a multi-file investigation or code trace and needs to preserve dynamic, verified line spans and causal breadcrumbs across compactions without repetitive, token-expensive codebase re-reads.
- **Use [`Arbiter`](https://github.com/paragon-ux/Arbiter)** when running multiple autonomous coding agents in parallel and you need ephemeral Git worktree isolation, DAG task dependencies, zero-daemon dead-worker recovery, and conflict-quarantined sequential merges.

> [!IMPORTANT]
> **The 1:1:1 Invariant Contract**:
> Every concurrent agent worker provisioned by **Arbiter** operates in exactly **one isolated Git worktree** and records exactly **one active Waymark trajectory**. Context compaction reloads static rules via **`AGENTS.md Compact Reload`** and in-flight hops via **`Waymark`** without mutating the task lease or crossing branch boundaries.

### External Specifications

| Specification | Canonical Reference | Usage in Suite |
| :--- | :--- | :--- |
| **Model Context Protocol (MCP)** | [Model Context Protocol Specification](https://github.com/modelcontextprotocol/specification) | Standardized JSON-RPC 2.0 stdio tool interface used across Waymark and Arbiter. |
| **Tree-sitter WASM** | [Tree-sitter](https://github.com/tree-sitter/tree-sitter) | Polyglot AST grammars compiled to WebAssembly for zero-dependency symbol discovery. |
| **Node.js Core Runtime** | [Node.js](https://github.com/nodejs/node) (v22+ LTS) | Native `node:sqlite`, `node:child_process`, `node:crypto`, `node:fs` (0 runtime npm dependencies). |
| **Capn Hook / Memory Protocol** | [Capn Hook](https://github.com/cyrusNuevoDia/capn-hook) | Finalized episodic memory storage, distinct from Waymark's active in-flight trajectory ledger. |

---

## Why Use It?

| Approach | Context and cache cost | Recovery control |
|---|---|---|
| No hook | No added context | Relies on the retained instruction snapshot; no explicit reload or source hash |
| Manual prompt | Adds a turn and usually repeats recovery context | Depends on a person noticing compaction and prompting consistently |
| Ralph-style loop | Reconstructs state for another iteration; changing prefixes can reduce cache reuse | Useful for repeated autonomous runs, but adds another startup and restoration surface |
| **This hook** | Adds one bounded, deterministic instruction artifact to the existing compact continuation | Automatically reloads the registered root file and exposes its exact source and hash |

The hook is designed to preserve prompt-cache-friendly stable context, avoid a separate recovery turn, and reduce stale-phase or wrong-workspace mistakes. See [Rationale](Rationale.MD) for the detailed comparison and limits.

---

## Standardized 3-Tier Harness Model

Agent harnesses provide varying levels of context-injection capability, categorized into three distinct support tiers:

| Support Tier | Mechanism | Delivery Guarantee | Target Harnesses |
| :--- | :--- | :--- | :--- |
| **Tier 1: Active Lifecycle Hook** | Out-of-context process execution on compaction boundary. | **100% deterministic.** Instructions prepended before model turn; zero tokens spent remembering to recover. | **OpenAI Codex** (`SessionStart`), **Google Antigravity** (`PreInvocation.injectSteps`), **Claude Code** (`post_compact`). |
| **Tier 2: MCP Ingestion** | In-band Model Context Protocol primitives. | **High reliability.** Standardized pull via resources/prompts. | **Claude Code**, **Cursor Composer**, **Windsurf**, **Cline**. |
| **Tier 3: Persistent Directives** | Sticky system instruction files (`CLAUDE.md`, `.cursor/rules/*.mdc`). | **Best-effort.** Instructs model to reload rules as step 1 when prior turn history is rolled. | **Cursor**, **Claude Code**, **Antigravity**. |

See [Support Tiers Guide](docs/SUPPORT-TIERS.md) for full technical schemas.

---

## Quick Start

### Requirements:

- Node.js 20 or newer.
- Git on `PATH`.
- A nonempty UTF-8 `AGENTS.md` at the registered Git root.
- A supported AI coding agent harness (OpenAI Codex, Google Antigravity, Claude Code, Cursor, etc.).

### Verify the checkout:

```sh
npm run verify
```

### Preview installation:

```sh
node scripts/install.mjs --project my-project=<PROJECT_ROOT> --codex-version <CODEX_VERSION> --dry-run
```

### Install for that project:

```sh
node scripts/install.mjs --project my-project=<PROJECT_ROOT> --codex-version <CODEX_VERSION>
```

---

## Supported Harnesses

Dedicated setup guides and recipes are located in [`harnesses/`](harnesses/):

- **[OpenAI Codex (`harnesses/codex/`)](harnesses/codex/README.md):** Deep dive on why `SessionStart` (not `PostCompact`), minimum version 0.145.0, Windows NTFS quote-free short path wrapper, and companion skills (`$codex-compact-reload-setup`, `$codex-compact-reload-cleanup`).
- **[Google Antigravity & Gemini (`harnesses/agy/`)](harnesses/agy/README.md):** Out-of-context hook protocol via `PreInvocation.injectSteps` and workspace instruction rules (`<RULE>`).
- **[Claude Code (`harnesses/cc/`)](harnesses/cc/README.md):** Configuration for `hooks.post_compact` in `.claude/config.json` and persistent `CLAUDE.md` instructions.
- **[Cursor (`harnesses/cursor/`)](harnesses/cursor/README.md):** Setup for `.cursor/rules/agents-reload.mdc` persistent rule.

---

## Division of Labor with Waymark

Post-compaction continuity operates across two complementary bootloaders:

```text
               Context Compaction Occurs
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
 [ AGENTS.md Compact Reload ]      [ waymark-compact-hook ]
  Target: Root `AGENTS.md`          Target: `.waymark/active.json`
  Role: Static behavioral rules     Role: Dynamic verified breadcrumbs
  Output: Project authority & hash  Output: Hops & relocated line spans
          │                               │
          └───────────────┬───────────────┘
                          ▼
        Immediate Post-Compaction Continuation
        (Full rules + Exact code breadcrumb trail)
```

1. **Static Project Governance ([AGENTS.md Compact Reload](https://github.com/paragon-ux/codex-agents-compact-reload)):** Reloads the root `AGENTS.md` and validates its SHA-256 hash. Ensures the agent never forgets its behavioral boundaries, test requirements, or safety invariants.
2. **Dynamic In-Flight Trajectory ([Waymark](https://github.com/paragon-ux/waymark)):** Reloads the active `.waymark/` journal, verifies Git line anchors, detects relocated spans (`MOVED`), and injects the verified breadcrumb trail (<216 tokens).

---

## Multi-Project Registration

Register several projects in one installation:

```sh
node scripts/install.mjs \
  --codex-version <CODEX_VERSION> \
  --project frontend=<FRONTEND_ROOT> \
  --project backend=<BACKEND_ROOT>
```

On PowerShell, place the command on one line or use PowerShell's normal continuation syntax.

---

## Privacy and Trust Boundary

At runtime the hook reads only:

- the hook JSON payload supplied on standard input;
- its own `projects.json` registration file;
- Git's observed repository root; and
- the registered root's `AGENTS.md`.

It does not read agent session files, transcripts, prompts, tool results, environment-variable values, credentials, or task artifacts. It writes no runtime handoff or history files. See [Security](docs/SECURITY.md) for the complete boundary.

`AGENTS.md` remains an instruction source, not evidence that work occurred. Claims about patches, tests, Git state, or external actions still require direct verification.

---

## Verification Evidence

The current automated test suite covers:

- multi-harness payload auto-detection (Codex, Antigravity, Markdown, JSON);
- exact content and SHA-256 injection;
- nested working directories inside Git roots;
- unregistered-project no-op behavior;
- stale unrelated registration isolation and invalid selected-registration failure;
- event filtering (ignoring non-compact SessionStart and unrelated events);
- missing, empty, oversized, and invalid UTF-8 fail-closed behaviors;
- installer preservation of unrelated hooks;
- repeat-install idempotence;
- installer dry-run non-mutation;
- partial deregistration; and
- complete, recoverable uninstall without unrelated-hook loss.

Run the exact suite with:

```sh
npm run verify
```

---

## Repository Directory

```text
codex-agents-compact-reload/
├── .agents/skills/            # Companion skills for agent environments
│   ├── codex-compact-reload-setup/    # Guided setup & host acceptance
│   └── codex-compact-reload-cleanup/  # Scoped uninstaller skill
├── assets/                    # Project iconography
├── docs/                      # Technical architecture and protocols
│   ├── ARCHITECTURE.md        # Lifecycle flow and security boundary
│   ├── HOST-ACCEPTANCE.md     # Real-host manual & automatic compaction test
│   ├── PUBLICATION.md         # Release history and provenance
│   ├── SECURITY.md            # Threat model and privacy constraints
│   ├── SUPPORT-TIERS.md       # Standardized 3-tier harness classification
│   └── releases/              # Historical release notes (v0.1.0 – v0.2.0)
├── harnesses/                 # Harness-specific recipes and deep-dives
│   ├── README.md              # Harness directory index and tier matrix
│   ├── codex/                 # OpenAI Codex integration details
│   ├── cc/                    # Claude Code integration details
│   ├── agy/                   # Google Antigravity integration details
│   └── cursor/                # Cursor & Cursor Composer integration details
├── scripts/                   # Management scripts
│   ├── install.mjs            # Idempotent harness hook installer
│   └── uninstall.mjs          # Scoped uninstaller and cleaner
├── src/                       # Core runtime
│   └── reload-agents.mjs      # Universal multi-harness compact bootloader
└── test/                      # Node.js native test suite (13 automated tests)
    ├── install.test.mjs       # Installer idempotence and preservation tests
    ├── reload-agents.test.mjs # Multi-harness injection & fail-closed tests
    └── uninstall.test.mjs     # Uninstaller tests
```

---

## Documentation & Provenance

- **[Support Tiers Guide](docs/SUPPORT-TIERS.md)**: 3-tier classification across Codex, Antigravity, Claude Code, Cursor.
- **[Harness Integration Recipes](harnesses/README.md)**: Detailed recipes for Codex, Claude Code, Antigravity, and Cursor.
- **[Architecture Deep-Dive](docs/ARCHITECTURE.md)**: Runtime lifecycle, security model, and failure semantics.
- **[Design Rationale](Rationale.MD)**: Why compact reload instead of manual prompting or loops.
- **[Host Acceptance Protocol](docs/HOST-ACCEPTANCE.md)**: Empirical compaction acceptance test protocol.
- **[Security & Privacy Boundary](docs/SECURITY.md)**: Trust boundaries and read/write constraints.
- **[Waymark In-Flight Continuity](https://github.com/paragon-ux/waymark)**: Companion in-flight continuity ledger for verified code breadcrumbs.

---

## License

[MIT](LICENSE). Copyright (c) 2026 the codex-agents-compact-reload contributors.