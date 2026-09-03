# Security

## Data access

The runtime is intentionally allowlisted. It reads the hook payload, installed project registration, Git root result, and registered root `AGENTS.md`. It does not open agent transcript or session files and does not inspect arbitrary project files.

The installer reads and updates the selected harness configuration (such as Codex home's `hooks.json`), the hook's own `projects.json`, and the source runtime being installed.

## Output

The hook emits structured JSON (or clean Markdown for CLI formats). For a valid registered project it contains the instruction file's canonical path, SHA-256, and text. This content enters the immediate agent continuation (e.g. Codex `SessionStart.additionalContext`, Antigravity `PreInvocation.injectSteps`, or Claude Code stream) and should therefore contain instructions suitable for the agent to receive.

The hook writes no runtime logs, snapshots, sentinels, or history rollups.

## Failure behavior

Registered-project validation failures return `continue=false` with a short reason. Unregistered projects and unrelated events return `{}`.

## Trust

Review the installed script and generated hook entry before trusting it in your agent harness. A trusted hook executes with the host account's permissions. Do not bypass hook trust merely to avoid reviewing a changed command.

A trusted command path is not, by itself, an integrity attestation for the bytes currently stored at that path. High-assurance workflows should independently bind and recheck the installed hook SHA-256, `projects.json`, Node executable and version, Codex version, and expected `AGENTS.md` SHA-256.

The installer rejects stable Codex releases older than 0.145.0 because those builds can defer compact `SessionStart` context until a later turn. The asserted version stored in `projects.json` is operator-supplied compatibility metadata, not a cryptographic measurement of the running host. Bind it to independently observed host evidence and run the delayed-delivery regression before relying on the hook for high-assurance continuity.

## Reporting

Before reporting a security issue publicly, give the repository owner an opportunity to provide a private reporting channel. No dedicated security contact has been declared in this initial local release.
