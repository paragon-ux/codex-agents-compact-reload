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
| Local paths and host configuration | Exclude | They are machine-specific and sensitive. |
| Conversation transcripts and private task inputs | Exclude | They are unnecessary and not authorized for publication. |
| Third-party source code | Exclude | The implementation is clean and dependency-free. |

## Provenance

The implementation was written from the desired behavior and an inspected Codex hook interface. The broader continuity concept was informed by the public `codex-compact-continuity` project. No files or code expressions were copied from it.

The project icon was generated for this repository from an original prompt using OpenAI image generation. It contains no copied third-party logo or text.

## Evidence scope

The repository's automated tests exercise generated hook payloads and a temporary Codex-home installation. They do not constitute a live Codex compaction campaign. Public claims must retain that distinction. The `codex-cli 0.147.0` label records the locally exercised compatibility baseline; it does not establish a minimum or universal Codex version range.

## Release audit

On 2026-08-30, the current release tree passed `npm run verify` with 7 of 7 tests. The public sanitizer scanned all 18 files with 1 BLOCK finding, 0 WARN findings, 0 suppressed files or lines, and 0 scan errors. The sole finding is the intentionally public repository-owner handle required by the live GitHub Actions badge URL; it was manually reviewed and is authorized publication metadata, not private identity leakage.

## Release decision

`READY WITH DISCLOSED LIMITS` for public inspection after a clean sanitizer result. Reuse and redistribution remain on hold until the owner selects a project license.
