# Hermes Agent Integration (Tier 1 & Tier 2)

This guide documents the [Hermes Agent](https://github.com/NousResearch/hermes-agent) integration for **AGENTS.md Compact Reload**.

---

## 1. Overview

Hermes Agent is Nous Research's open-source agent framework (CLI, TUI, desktop app, and messaging gateway). It natively loads project context files at session start and ships three extension surfaces this integration uses:

- **Shell hooks** — `hooks:` entries in `~/.hermes/config.yaml`; Hermes runs the command as a subprocess with a JSON payload on stdin and reads a JSON response on stdout. Registered via `VALID_HOOKS` in the Hermes plugin registry.
- **MCP servers** — `mcp_servers:` in `config.yaml` for the companion Waymark server (see Waymark's `harnesses/hermes/`).
- **Context files** — `AGENTS.md` (plus `.hermes.md`, `CLAUDE.md`, `.cursorrules`) is loaded into the system prompt at every session start.

---

## 2. Hermes Compaction Semantics (what the hook keys on)

When Hermes compacts a conversation, it does two things relevant to this hook:

1. **It rebuilds the system prompt at the commit boundary** (`_rebuild_system_prompt_at_boundary` in `agent/conversation_compression.py`), which re-runs context-file discovery. A fresh on-disk `AGENTS.md` therefore reaches the next turn **without any hook**. Treat this as the baseline; this hook supplements it with an explicit, hash-verified reload notice and works on Hermes versions where the boundary behavior is being changed.
2. **It inserts a summary handoff as a `role="user"` row** at the front of the compressed history, starting with a byte-pinned marker such as `[CONTEXT COMPACTION — REFERENCE ONLY] Earlier turns were compacted into the summary below…` (see `SUMMARY_PREFIX` in `agent/context_compressor.py`). When the compacted transcript had no user turn to preserve, Hermes instead inserts a continuation marker (`Continue from the compressed conversation context above. This marker exists because no human user turn was available.`), or a deterministic fallback summary beginning with the `## Historical Task Snapshot` heading. Preserved user turns can also carry the summary merged in after a `[END OF PRIOR CONTEXT — COMPACTION SUMMARY BELOW]` delimiter.

The reload hook fires only on shape 2: a `pre_llm_call` payload whose `extra.conversation_history` ends in a compaction handoff **and whose `extra.user_message` is empty** (no live user turn). Ordinary turns never trigger injection, and once a real user message arrives the summary is treated as stale background exactly as Hermes intends.

---

## 3. Tier 1: `pre_llm_call` Shell Hook

### Compaction detection without marker drift

The hook must decide "is this turn the immediate post-compaction continuation?" without reading Hermes' source at runtime. Two facts drive the design:

- **Hermes compacts at turn start**, so the immediate post-compaction turn usually carries a *live user message* after the summary row — a live user message does **not** mean the summary is stale.
- The summary row persists in history until the next compaction, so a naive "summary present" check would re-fire every turn.

The hook therefore uses a **two-signal + dedupe** design:

1. **Primary (content-independent):** Hermes stamps an in-process metadata flag (`_compressed_summary`) on the compaction handoff row. The flag is set unconditionally at the compaction boundary in `agent/context_compressor.py` — it does not depend on summary wording — and it survives the shell-hook stdin serialization (verified against Hermes 0.21.2: `shell_hooks._serialize_payload` passes `_`-prefixed row metadata through verbatim). No byte-pinned strings are involved.
2. **Fallback (byte-pinned content markers):** the summary-prefix / continuation-marker / fallback-heading / merged-delimiter constants documented below, used only when the metadata flag is absent — e.g. after a wire sanitizer or session-store round-trip drops `_`-prefixed metadata.

Firing is gated by a **per-session dedupe** (`session_id` + summary-row identity, stored in `hermes-compact-reload-state.json` next to `projects.json`, 12 h TTL, best-effort): the hook injects on the **first turn** whose history contains a compaction handoff — live user message included — and stays silent on subsequent turns carrying the same summary. If Hermes ever rewords its summary framing, the primary signal keeps working and only the fallback needs a matching pin update. `--plugin` (below) removes even that fallback by delegating to Hermes' own classifiers in-process.

### Automated installation

```sh
node scripts/install.mjs --target hermes --project my-project=<PROJECT_ROOT>
```

The installer:

- copies `src/reload-agents.mjs` to `<hermes-home>/hooks/agents-compact-reload/reload-agents.mjs`;
- writes the project registry to `<hermes-home>/hooks/agents-compact-reload/projects.json`;
- adds a `pre_llm_call` entry under the top-level `hooks:` section of `<hermes-home>/config.yaml` via line surgery that preserves comments, unrelated sections, and CRLF line endings; and
- backs up `config.yaml` before writing.

`<hermes-home>` resolves from `--hermes-home`, `$HERMES_HOME`, or `~/.hermes`. The merged entry looks like:

```yaml
hooks:
  pre_llm_call:
    - command: "C:/Program Files/nodejs/node.exe" "C:/Users/me/.hermes/hooks/agents-compact-reload/reload-agents.mjs"
      timeout: 15
```

(Paths are written with forward slashes; they are valid on Windows and keep the YAML scalar escape-free.)

### First-use consent

Hermes prompts once per `(event, command)` pair on a TTY and records the approval in `~/.hermes/shell-hooks-allowlist.json`. Non-interactive runs need one of:

- `hermes --accept-hooks` on the next launch,
- `HERMES_ACCEPT_HOOKS=1` in the environment, or
- `hooks_auto_accept: true` in `config.yaml`.

### Restart Hermes

Shell hooks register at process start. Restart Hermes (or the gateway) after installing, then confirm with:

```sh
hermes hooks list
hermes hooks test pre_llm_call
```

### Payload contract (stdin)

Hermes serializes every shell-hook payload as:

```json
{
  "hook_event_name": "pre_llm_call",
  "tool_name": null,
  "tool_input": null,
  "session_id": "…",
  "cwd": "…",
  "profile": "default",
  "extra": {
    "user_message": "",
    "conversation_history": [{"role": "user", "content": "[CONTEXT COMPACTION — REFERENCE ONLY] …"}],
    "is_first_turn": false,
    "model": "…",
    "platform": "cli"
  }
}
```

### Response contract (stdout)

The hook prints one JSON object. `{"context": "…"}` is the documented context-injection shape — Hermes appends the string to the active user turn. On a live user message, an ordinary turn, or a non-registered working directory the hook prints `{}` and contributes nothing.

Manual CLI check (no compaction gate in forced-format mode):

```sh
node src/reload-agents.mjs --format=hermes --cwd=<PROJECT_ROOT>
```

### Delivery guarantees and limits

- **Timing:** `pre_llm_call` runs after turn-start compaction, so the injection lands in the immediate post-compaction continuation.
- **Oversized context:** Hermes spills hook context beyond `hooks.output_spill.max_chars` (default 10,000 chars) to disk with a preview. The registered `AGENTS.md` cap (32 KiB) therefore feeds the spill path in the worst case; keep `AGENTS.md` lean.
- **Timeout:** the entry ships `timeout: 15` seconds; the hook completes in milliseconds.
- **CLI vs gateway:** shell hooks register in both surfaces (registration runs in `cli.py` and `gateway/run_startup.py`). The `session:compress` gateway event is also observable for telemetry, but it cannot inject context, which is why this integration keys off `pre_llm_call`.

---

## 4. Tier 2: MCP Ingestion

Hermes speaks MCP natively. Pair this hook with the Waymark ledger for in-flight trajectory continuity:

```yaml
mcp_servers:
  waymark:
    command: "node"
    args: ["<path-to-waymark>/dist/src/mcp/waymarkIndex.js"]
```

Tools appear to the model like any other tool; `waymark_check` / `waymark_resume` provide the standardized pull-based recovery path. See Waymark's `harnesses/hermes/README.md` for the full recipe.

---

## 6. Zero-Pin Plugin Alternative (recommended when plugins are acceptable)

`node scripts/install.mjs --target hermes --plugin --project my-project=<PROJECT_ROOT>` installs a small Hermes **plugin** instead of the config.yaml shell hook. The plugin runs inside Hermes' own process and registers the same `pre_llm_call` hook, but it detects compaction by calling **Hermes' own public classifiers** (`is_compaction_summary_message` and the synthetic-turn check on `ContextCompressor`) — it duplicates no marker strings and can never drift from upstream rewording. It reads the same `projects.json` registry, injects the same hash-verified context block, and needs no consent prompt (plugins are trusted code you installed yourself) and no `config.yaml` edit. Restart Hermes after installing.

Trade-offs versus the shell hook:

| | Shell hook (`hooks.pre_llm_call`) | Plugin (`--plugin`) |
| :--- | :--- | :--- |
| Drift surface | Metadata flag (primary) + byte-pinned fallback | **None** — uses Hermes' classifiers directly |
| Consent | First-use prompt / allowlist | None |
| Works when plugins disabled | n/a (hooks are separate) | No — falls back to the shell hook |
| Install surface | `config.yaml` edit + hook copy | Plugin directory copy only |

Both modes share the same project registry and the same injected context format, so switching between them (or running the plugin with the shell hook removed) is seamless.

---

## 7. Tier 3: Persistent Directives

Hermes already loads `AGENTS.md` from the working directory (and the merged git-root chain) at session start, with first-match priority `.hermes.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`. No extra directive file is required; a `.hermes.md` that says "follow root `AGENTS.md`" is enough for teams that want an explicit pointer. Subdirectory `AGENTS.md` files are discovered progressively as the agent touches those directories.
