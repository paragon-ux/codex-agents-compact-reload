# Repository instructions

## Suite Boundaries & Invariants
- **Ecosystem Role**: `codex-agents-compact-reload` handles static project governance (`AGENTS.md`), paired with `Waymark` for dynamic in-flight code hops and `Arbiter` for multi-agent worktrees.
- **The 1:1:1 Invariant**: Maintain strict separation between static rules, dynamic trajectories, and isolated worktrees. Never write runtime state or credentials to project roots.
- See `README.md` for full cross-repository architecture specifications.

- Keep the runtime dependency-free and compatible with maintained Node.js releases.
- Do not read agent transcripts, prompts, tool output, credentials, or private task files.
- Keep runtime output to valid JSON for hook events or clean Markdown for CLI streaming.
- Treat `AGENTS.md` as project instructions, not proof of completed work.
- Run `npm run verify` before claiming a change is complete.
