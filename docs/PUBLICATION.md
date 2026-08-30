# Publication record

## Release posture

`open-method`: the complete operative method, installer, tests, and limitations are included for inspection.

## Inclusion decisions

| Material | Decision | Reason |
|---|---|---|
| Runtime hook | Include | It is the core public mechanism. |
| Installer | Include | It makes host mutations reviewable and reproducible. |
| Tests | Include | They bound the verified claims. |
| Architecture and security notes | Include | They expose trust and data-access boundaries. |
| Alternatives matrix and rationale | Include | They explain the tradeoffs without overstating cache behavior or compliance guarantees. |
| Original icon, CI, and release note | Include | They make the release recognizable and independently inspectable. |
| Setup/cleanup skills and scoped uninstaller | Include | They make host mutations previewable and avoid ad hoc deletion instructions. |
| Upstream compact-delivery compatibility guard | Include | It prevents known-affected Codex versions from being presented as supported. |
| Host acceptance protocol | Include | It exposes the remaining difference between payload simulation and real Codex compaction evidence. |
| MIT License | Include | It permits public use, modification, and redistribution under a standard permissive license. |
| Local paths and host configuration | Exclude | They are machine-specific and sensitive. |
| Conversation transcripts and private task inputs | Exclude | They are unnecessary and not authorized for publication. |
| Third-party source code | Exclude | The implementation is clean and dependency-free. |

## Provenance

The implementation was written from the desired behavior and an inspected Codex hook interface. The broader continuity concept was informed by the public `codex-compact-continuity` project at reviewed commit `7221beddf1fcfb29aced3a96d240034064e0a6c4`. Its AI-assisted install guide and manual cleanup procedure informed the companion-workflow boundary. No files or code expressions were copied from it.

The project icon was generated for this repository from an original prompt using OpenAI image generation. It contains no copied third-party logo or text.

## Evidence scope

The repository's automated tests exercise generated hook payloads and a temporary Codex-home installation. They do not constitute a live Codex compaction campaign. Public claims must retain that distinction. Stable Codex CLI 0.145.0 is the enforced floor because it first contains upstream fix `8c41ed33`; `codex-cli 0.147.0` records the locally exercised compatibility baseline. Neither replaces real-host acceptance on the exact deployment build.

## Release audit

On 2026-08-30, the `v0.1.1` candidate passed `npm run verify` with 10 of 10 tests, and both companion skills passed the skill metadata validator. The public sanitizer scanned all 25 files with 1 BLOCK finding, 0 WARN findings, 0 suppressed files or lines, and 0 scan errors. The sole finding is the intentionally public repository-owner handle required by the live GitHub Actions badge URL; it was manually reviewed and is authorized publication metadata, not private identity leakage.

On 2026-08-30, the local `v0.1.2` candidate passed `npm run verify` with 11 of 11 tests, both relocated skills passed the skill metadata validator, all relative Markdown links resolved, and `git diff --check` passed. The sanitizer scanned all 26 files with 1 BLOCK finding, 5 WARN findings, 0 suppressed files or lines, and 0 scan errors. The BLOCK is the same authorized public repository-owner handle in the CI badge. All five WARN findings are the intentionally public OpenAI fix-commit and stable-release URLs used to substantiate the compatibility floor; each was manually reviewed and is not secret material.

## Release decision

`READY WITH DISCLOSED LIMITS` for public release under the MIT License. The automated and simulated hook evidence is current; real manual and automatic Codex compaction acceptance remains unclaimed until the host protocol passes.
