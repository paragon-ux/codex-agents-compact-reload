---
name: codex-compact-reload-setup
description: Install or register the Codex AGENTS.md compact-reload hook for one or more Git projects from a trusted project checkout. Use for setup, installation, registration, or installation verification; do not use for removal.
---

# Compact Reload Setup

Install the hook without replacing unrelated Codex hooks or changing the target project's files.

## Workflow

1. Resolve a trusted `codex-agents-compact-reload` checkout containing `scripts/install.mjs`. When this skill is used from its source repository, the checkout root is two directories above this file. Otherwise use a checkout supplied by the user; do not download or switch versions without authorization.
2. Resolve each target with `git -C <path> rev-parse --show-toplevel`. Require the supplied path to equal that Git root and require a nonempty root `AGENTS.md`.
3. Resolve the intended Codex home. Use an explicit `--codex-home` when the user supplied one; otherwise use the active Codex home.
4. Run `npm run verify` in the utility checkout.
5. Preview the exact mutation:

   ```text
   node scripts/install.mjs --project <name>=<absolute-git-root> --codex-home <codex-home> --dry-run
   ```

6. If the user asked to perform installation, inspect the preview and rerun without `--dry-run`. If they asked only for instructions or a review, stop after the preview.
7. Verify the installed hook and registration exist, hash `reload-agents.mjs` and `projects.json`, and simulate one compact `SessionStart` payload for the registered project. Do not expose the injected `AGENTS.md` plaintext unless the user requests it.
8. Tell the user to review and trust the hook in Codex Settings > Hooks or with `/hooks`.

## Boundaries

- Installation is a Codex-home mutation; do it only when the user's request authorizes setup.
- Preserve unrelated handlers and existing project registrations.
- Do not edit `AGENTS.md`, `.gitignore`, transcripts, session files, or project artifacts.
- A simulated payload verifies the installed command path and output contract. It is not proof of a real Codex compaction round trip; use `docs/HOST-ACCEPTANCE.md` for that campaign.
