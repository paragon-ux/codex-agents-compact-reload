---
name: codex-compact-reload-cleanup
description: Safely deregister projects or uninstall the Codex AGENTS.md compact-reload hook while preserving unrelated hooks. Use for cleanup, removal, deregistration, or uninstall verification; do not use for setup.
---

# Compact Reload Cleanup

Remove only the requested compact-reload registration or installation through the repository's scoped uninstaller.

## Workflow

1. Resolve a trusted `codex-agents-compact-reload` checkout containing `scripts/uninstall.mjs` and resolve the intended Codex home.
2. Inspect the installed `projects.json` names. If the user requested cleanup without saying which project and more than one registration exists, ask whether to remove named registrations or the complete installation.
3. Always preview the exact cleanup:

   ```text
   node scripts/uninstall.mjs --project <name> --codex-home <codex-home> --dry-run
   node scripts/uninstall.mjs --all --codex-home <codex-home> --dry-run
   ```

   Use only the form matching the authorized scope.

4. If the user asked to perform cleanup, inspect the preview and rerun without `--dry-run`. If they asked only how to remove it, stop after explaining the preview.
5. Verify that named registrations are gone. When the last registration or `--all` is removed, also verify that this package's handler and exact install directory are gone while unrelated hooks remain.
6. Retain and report the `hooks.json` backup path returned by the uninstaller, then ask the user to confirm the result in Codex Settings > Hooks or with `/hooks`.

## Boundaries

- Removal requires an explicit user request and exact project or `--all` scope.
- Use `scripts/uninstall.mjs`; do not improvise recursive deletion commands.
- Never delete a target repository, its `AGENTS.md`, Codex transcripts, session state, or unrelated hook files.
- This hook creates no project-side continuity directory, so there are no generated project artifacts to clean up.
