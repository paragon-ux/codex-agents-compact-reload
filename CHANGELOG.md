# Changelog

## 0.3.0 - 2026-09-11

- Added **Hermes Agent** support (Tier 1 & Tier 2): `node scripts/install.mjs --target hermes` registers a compaction-gated `pre_llm_call` shell hook in `~/.hermes/config.yaml`; `node scripts/uninstall.mjs --target hermes` removes it.
- The Hermes hook fires only when the `pre_llm_call` payload's conversation history ends in a Hermes compaction handoff **and** no live user message is pending; ordinary turns return `{}`.
- **Drift-resistant detection:** the primary signal is Hermes' in-process `_compressed_summary` row metadata (content-independent, survives hook stdin serialization); the byte-pinned summary markers remain only as a fallback for sanitizer/session-store round-trips. `--plugin` mode eliminates the pins entirely by calling Hermes' own classifiers in-process.
- Added `node scripts/install.mjs --target hermes --plugin`: installs a Hermes plugin (`harnesses/hermes/plugin/`) that reuses `is_compaction_summary_message` — zero marker pins, no consent prompt, no config.yaml edit.
- Added a dependency-free line-surgery YAML editor for `config.yaml` that preserves comments, unrelated sections, and CRLF line endings, backs up before writing, and fails closed on unsupported shapes (inline `hooks:`, block scalars).
- Documented the Hermes compaction baseline: Hermes rebuilds its system prompt at the compaction boundary and re-reads `AGENTS.md` from disk; the hook supplements this with an explicit hash-verified reload notice.
- Test suite expanded to 24 automated tests (`test/hermes.test.mjs`).

## 0.2.0 - 2026-09-03

- Reframed project provenance to **AGENTS.md Compact Reload** across AI coding agent harnesses.
- Added multi-harness payload auto-detection supporting OpenAI Codex (`SessionStart.additionalContext`), Google Antigravity / Gemini (`PreInvocation.injectSteps`), and CLI output streams (`--format=markdown|json`).
- Established the Standardized 3-Tier Harness Support Model (Tier 1: Active Lifecycle Hook, Tier 2: MCP Ingestion, Tier 3: Persistent Directives).
- Added formal multi-harness test suite covering Antigravity `injectSteps`, Markdown, and JSON serialization with 100% clean verification.
- Reconciled architecture and documented clear division of labor with Waymark's in-flight continuity ledger (`.waymark/`).

## 0.1.3 - 2026-08-30

- Made Windows hook commands quote-free through a validated short-path batch wrapper, avoiding openai/codex#38168.
- Added a `cmd.exe` execution regression test and strengthened setup/host-acceptance verification for the exact installed command.
- Verified one fresh Codex 0.147.0 manual-compaction round trip with `gpt-5.6-sol`, including exact `AGENTS.md` hash reload and zero next-turn compact-context replay.

## 0.1.2 - 2026-08-30

- Moved the setup and cleanup skills to the repository-discoverable `.agents/skills/` location.
- Required an explicit stable Codex version at installation and rejected versions older than 0.145.0.
- Bound the installed compatibility identity to the upstream compact-delivery fix for openai/codex#28736.
- Added delayed-delivery and replay checks to the real-host acceptance protocol.

## 0.1.1 - 2026-08-30

- Isolated stale unrelated project registrations so they cannot stop valid or unregistered compact continuations.
- Added a scoped, dry-run-first uninstaller that preserves unrelated hooks and backs up `hooks.json` before complete removal.
- Added setup and cleanup companion skills.
- Added a real-host manual/automatic compaction acceptance protocol and strengthened hook-byte trust guidance.
- Licensed the project under the MIT License.

## 0.1.0 - 2026-08-30

- Added project-scoped compact `SessionStart` instruction reload.
- Added strict UTF-8, size, containment, and Git-root validation.
- Added idempotent Codex-home installer and dry-run support.
- Added dependency-free automated verification and public boundary documentation.
- Added a concise alternatives matrix and a separate design rationale.
- Added cross-platform CI, an original project icon, release metadata, and an explicit Codex CLI 0.147.0 compatibility snapshot.
