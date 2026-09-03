# Rationale

## Decision

Reload the registered project root's `AGENTS.md` automatically in the immediate post-compaction continuation across AI agent harnesses (such as OpenAI Codex, Google Antigravity, and Claude Code). Keep the injection deterministic and bounded, and report the exact source path and SHA-256.

The intended control chain is:

```text
compact hook -> AGENTS.md -> authoritative project preflight -> continued work
```

The hook delivers the re-entry instructions. The instructions should require the agent to verify the current repository, branch, worktree, phase, and other authoritative state before acting.

## Why not rely on no hook?

Agent harnesses can retain an instruction snapshot across compaction, so a project may work without this hook. That is the lowest-setup option, but it provides no explicit post-compaction re-read, no observable recovery event, and no hash identifying the reloaded source.

For short or low-risk tasks, that may be sufficient. For long-running work with repository and phase boundaries, an explicit reload makes the recovery input inspectable and reduces the chance that a compacted conversation summary becomes the sole operational guide.

## Why not rely on manual prompting?

A manual recovery prompt requires a person to notice the compaction, remember the correct recovery procedure, and phrase it consistently. It also adds another user/model round trip and often repeats instructions or state that could instead be supplied as one stable artifact.

That costs time and context, and it creates another opportunity to restore the wrong worktree, phase, or authority source. Manual prompting remains useful for an actual decision or changed instruction; it should not be required merely to re-establish standing project controls.

## Why not use a Ralph-style loop?

A Ralph-style loop is valuable when the goal is repeated autonomous attempts or fresh process-level iterations. That is a different control problem from continuity inside one already-running agent task.

A loop commonly rebuilds prompt and state for each iteration. Stable prefixes may still benefit from prompt caching, but changing summaries, state blocks, ordering, or orchestration text can reduce prefix reuse. Each iteration also adds a startup, model invocation, and restoration surface where stale or misbound state can enter.

This hook instead participates in the compact continuation the harness already needs. It supplies one fixed, project-owned artifact without starting a separate recovery conversation or orchestration cycle.

## Context, caching, and latency

Modern LLM provider guidance recommends keeping stable content at the beginning of requests to improve prompt-cache reuse, which can reduce latency and input-token cost.

This design follows that principle by keeping durable re-entry controls in one deterministic file rather than regenerating them through an ad hoc prompt. It is therefore cache-friendlier than repeatedly changing recovery prose, but it does not promise a cache hit: exact cache behavior depends on how the host constructs the complete request and on the provider's caching implementation.

The practical savings come from avoiding a separate recovery turn, limiting injected content to 32 KiB, and making the same project instructions reusable after each compact event.

## Failure prevention

Compaction can leave a concise but incomplete account of a long-running task. If continuation relies on that account alone, an agent can resume from a stale phase assumption, operate in the wrong checkout, or treat an earlier plan as current authority.

The hook reduces that failure class by restoring project-owned re-entry rules automatically. A strong `AGENTS.md` should direct the agent to inspect live state and authoritative files before changing anything. The source path and hash also make it possible to determine exactly which instruction bytes were supplied.

## Boundaries

The hook is not proof that an agent followed `AGENTS.md`, and the reported hash is not an independently frozen expected hash. It does not authenticate repository state, replace direct Git and filesystem checks, or preserve private task content.

It also does not eliminate every reason to use manual prompts or autonomous loops:

- Use no hook for short, low-risk work where implicit continuity is enough.
- Use manual prompting for new decisions, changed requirements, or human approval.
- Use a Ralph-style loop for repeated autonomous attempts that intentionally need fresh iterations.
- Use this hook when the same agent task must recover standing project controls immediately after compaction.

The claim is deliberately narrow: deterministic instruction reload improves re-entry consistency, context economy, and inspectability. Authoritative preflight checks remain responsible for proving that continuation is safe.
