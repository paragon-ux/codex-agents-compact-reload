# Changelog

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
