# Security

## Data access

The runtime is intentionally allowlisted. It reads the hook payload, installed project registration, Git root result, and registered root `AGENTS.md`. It does not open Codex transcript or session files and does not inspect arbitrary project files.

The installer reads and updates the selected Codex home's `hooks.json`, the hook's own `projects.json`, and the source runtime being installed.

## Output

The hook emits one JSON object. For a valid registered project it contains the instruction file's canonical path, SHA-256, and text. This content enters the immediate Codex continuation and should therefore contain instructions suitable for the agent to receive.

The hook writes no runtime logs, snapshots, sentinels, or history rollups.

## Failure behavior

Registered-project validation failures return `continue=false` with a short reason. Unregistered projects and unrelated events return `{}`.

## Trust

Review the installed script and generated hook entry before trusting it in Codex. A trusted hook executes with the host account's permissions. Do not bypass hook trust merely to avoid reviewing a changed command.

A trusted command path is not, by itself, an integrity attestation for the bytes currently stored at that path. High-assurance workflows should independently bind and recheck the installed hook SHA-256, `projects.json`, Node executable and version, Codex version, and expected `AGENTS.md` SHA-256.

## Reporting

Before reporting a security issue publicly, give the repository owner an opportunity to provide a private reporting channel. No dedicated security contact has been declared in this initial local release.
