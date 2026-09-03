# Repository instructions

- Keep the runtime dependency-free and compatible with maintained Node.js releases.
- Do not read agent transcripts, prompts, tool output, credentials, or private task files.
- Keep runtime output to valid JSON for hook events or clean Markdown for CLI streaming.
- Treat `AGENTS.md` as project instructions, not proof of completed work.
- Run `npm run verify` before claiming a change is complete.
