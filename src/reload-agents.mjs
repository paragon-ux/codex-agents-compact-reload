#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const DEFAULT_PROJECTS_PATH = path.join(SCRIPT_DIR, "projects.json");
const DEFAULT_MAX_BYTES = 32 * 1024;

// Hermes compaction markers (agent/context_compressor.py). The summary handoff is a
// role="user" row starting with one of these prefixes; content markers are byte-pinned
// upstream ("NEVER edit/reorder entries"). Matched exactly so ordinary turns never fire.
const HERMES_SUMMARY_PREFIXES = [
  "[CONTEXT COMPACTION",
  "[CONTEXT SUMMARY]:",
];
const HERMES_MERGED_SUMMARY_DELIMITER = "[END OF PRIOR CONTEXT — COMPACTION SUMMARY BELOW]";
const HERMES_CONTINUATION_MARKERS = [
  "Continue from the compressed conversation context above. This marker exists because no human user turn was available.",
  "Continue from the compressed conversation context above. This marker exists because the compacted transcript contained no preserved user turn.",
];
const HERMES_SUMMARY_HEADING = "## Historical Task Snapshot";

function jsonOut(value = {}) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function stop(reason) {
  return {
    continue: false,
    stopReason: `AGENTS.md compact reload stopped: ${reason}`,
  };
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`${label} is unavailable: ${error.code || "read error"}`);
  }
  return parseJson(raw, label);
}

function canonicalExistingDirectory(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a nonempty path`);
  }
  let resolved;
  try {
    resolved = fs.realpathSync.native(path.resolve(value));
  } catch {
    throw new Error(`${label} does not resolve to an existing directory`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`${label} is not a directory`);
  }
  return resolved;
}

function pathKey(value) {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function configuredRoot(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a nonempty path`);
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`${label} must be absolute`);
  }
  const normalized = path.normalize(value);
  try {
    return canonicalExistingDirectory(normalized, label);
  } catch {
    return normalized;
  }
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

// Compaction boundary detection for Hermes pre_llm_call payloads.
//
// Hermes compacts at TURN START: the immediate post-compaction turn usually
// carries a live user message AFTER the summary row, so a live user message
// does NOT mean the summary is stale. The correct semantics are "fire on the
// first turn whose history contains a compaction handoff, then dedupe":
// `session_id` + the summary row's content hash are memoized in a state file
// so the persisting summary row does not re-trigger on every subsequent turn,
// while two DIFFERENT compactions in one session remain distinct events.
function isHermesCompaction(payload) {
  if (!payload || typeof payload !== "object" || payload.hook_event_name !== "pre_llm_call") {
    return null;
  }
  const extra = payload.extra && typeof payload.extra === "object" ? payload.extra : {};
  const history = Array.isArray(extra.conversation_history) ? extra.conversation_history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (!message || typeof message !== "object") {
      continue;
    }
    // Primary signal: the in-process summary flag (agent/context_compressor.py
    // stamps `_compressed_summary` on the handoff row unconditionally at the
    // compaction boundary; content-independent, survives hook stdin
    // serialization). Verified against Hermes 0.21.2.
    if (message._compressed_summary) {
      return { summaryRow: message, history };
    }
    // Fallback signal: byte-pinned content markers, for rows that passed through a
    // wire sanitizer or session-store round-trip that drops "_"-prefixed metadata.
    if (message.role !== "user") {
      continue;
    }
    const content = message.content;
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part) => (part && typeof part === "object" && typeof part.text === "string" ? part.text : ""))
            .join("\n")
        : "";
    if (HERMES_SUMMARY_PREFIXES.some((prefix) => text.startsWith(prefix))) {
      return { summaryRow: message, history };
    }
    if (text.includes(HERMES_MERGED_SUMMARY_DELIMITER)) {
      const after = text.split(HERMES_MERGED_SUMMARY_DELIMITER, 2)[1] || "";
      if (HERMES_SUMMARY_PREFIXES.some((prefix) => after.trimStart().startsWith(prefix))) {
        return { summaryRow: message, history };
      }
    }
    if (HERMES_CONTINUATION_MARKERS.some((marker) => text.startsWith(marker))) {
      return { summaryRow: message, history };
    }
    if (text.startsWith(HERMES_SUMMARY_HEADING)) {
      return { summaryRow: message, history };
    }
  }
  return null;
}

// Identity of the handoff row for dedupe across turns: hash the row text for
// EVERY detected row. The `_compressed_summary` flag is stamped unconditionally
// at the boundary (content-independent), so a constant identity for flagged
// rows would dedupe two DIFFERENT compactions in one session against each
// other and swallow the second boundary within the TTL. (Upstream rewording
// changes this hash, which is fine — a different summary is a different
// compaction.)
function summaryRowIdentity(summaryRow) {
  const content = summaryRow.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (part && typeof part === "object" && typeof part.text === "string" ? part.text : "")).join("\n")
      : "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const DEDUPE_FILENAME = "hermes-compact-reload-state.json";

function loadDedupeState(configPath) {
  try {
    const raw = fs.readFileSync(path.join(path.dirname(configPath), DEDUPE_FILENAME), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDedupeState(configPath, state) {
  try {
    fs.writeFileSync(
      path.join(path.dirname(configPath), DEDUPE_FILENAME),
      `${JSON.stringify(state, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // Dedupe is best-effort: a failed write only means a possible duplicate
    // injection, never a missed one.
  }
}

export function hermesReloadDecision(payload, options = {}) {
  const detected = isHermesCompaction(payload);
  if (!detected) {
    return { fire: false, reason: "not-a-compaction-turn" };
  }
  if (typeof payload.session_id !== "string" || payload.session_id.length === 0) {
    // Without a session id there is nothing to dedupe against; fire (the gate
    // above still guarantees this is a compaction turn).
    return { fire: true, reason: "no-session-id" };
  }
  const configPath = path.resolve(
    options.projectsPath
      || process.env.AGENTS_COMPACT_RELOAD_PROJECTS_FILE
      || DEFAULT_PROJECTS_PATH,
  );
  const key = `${payload.session_id}:${summaryRowIdentity(detected.summaryRow)}`;
  const state = options.dedupeState || loadDedupeState(configPath);
  const now = Date.now();
  const fired = typeof state[key] === "number" ? state[key] : 0;
  if (fired && now - fired < 12 * 60 * 60 * 1000) {
    return { fire: false, reason: "already-reloaded" };
  }
  if (!options.dedupeState) {
    state[key] = now;
    saveDedupeState(configPath, state);
  }
  return { fire: true, reason: "compaction-handoff" };
}

function gitRoot(cwd) {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error("Git repository root is unavailable");
  }
  return canonicalExistingDirectory(result.stdout.trim(), "Git repository root");
}

function configuredProjects(configPath) {
  const config = readJson(configPath, "projects configuration");
  const entries = Array.isArray(config) ? config : config.projects;
  if (!Array.isArray(entries)) {
    throw new Error("projects configuration must contain a projects array");
  }
  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`projects[${index}] must be an object`);
    }
    if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
      throw new Error(`projects[${index}].name must be nonempty`);
    }
    return {
      name: entry.name.trim(),
      root: configuredRoot(entry.root, `projects[${index}].root`),
    };
  });
}

function selectProject(projects, cwd) {
  const matches = projects
    .filter((project) => isInside(project.root, cwd))
    .sort((left, right) => right.root.length - left.root.length);
  return matches[0] || null;
}

function readAgents(projectRoot, maxBytes = DEFAULT_MAX_BYTES) {
  const expectedPath = path.join(projectRoot, "AGENTS.md");
  let realPath;
  try {
    realPath = fs.realpathSync.native(expectedPath);
  } catch {
    throw new Error(`registered project is missing ${expectedPath}`);
  }
  if (!isInside(projectRoot, realPath)) {
    throw new Error("AGENTS.md resolves outside the registered project root");
  }
  const stat = fs.statSync(realPath);
  if (!stat.isFile()) {
    throw new Error("AGENTS.md is not a regular file");
  }
  if (stat.size === 0) {
    throw new Error("AGENTS.md is empty");
  }
  if (stat.size > maxBytes) {
    throw new Error(`AGENTS.md exceeds the ${maxBytes}-byte limit`);
  }
  const bytes = fs.readFileSync(realPath);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("AGENTS.md is not valid UTF-8");
  }
  return {
    path: realPath,
    bytes,
    text,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

function parseFlags(argv) {
  let format = null;
  let customCwd = null;
  let projectsPath = null;
  for (const arg of argv) {
    if (arg.startsWith("--format=")) format = arg.split("=")[1];
    if (arg.startsWith("--cwd=")) customCwd = arg.split("=")[1];
    if (arg.startsWith("--projects-file=")) projectsPath = arg.split("=")[1];
  }
  return { format, customCwd, projectsPath };
}

export function buildHookOutput(payload, options = {}) {
  let format = options.format;
  let rawCwd = payload?.cwd;

  if (payload?.hook_event_name === "pre_llm_call") {
    if (!options.format) format = "hermes";
    if (options.requireCompaction !== false) {
      const decision = hermesReloadDecision(payload, {
        projectsPath: options.projectsPath,
        dedupeState: options.dedupeState,
      });
      if (!decision.fire) {
        return {};
      }
    }
  } else if (payload?.hook_event_name) {
    if (payload.hook_event_name !== "SessionStart" || payload.source !== "compact") {
      return {};
    }
    if (!format) format = "codex";
  } else if (payload?.workspacePaths || payload?.invocationNum !== undefined) {
    if (!format) format = "agy";
    if (Array.isArray(payload.workspacePaths) && payload.workspacePaths[0]) {
      rawCwd = payload.workspacePaths[0];
    }
  }

  if (!format) {
    format = "codex";
  }

  const configPath = path.resolve(
    options.projectsPath
      || process.env.AGENTS_COMPACT_RELOAD_PROJECTS_FILE
      || DEFAULT_PROJECTS_PATH,
  );
  const cwd = canonicalExistingDirectory(rawCwd || options.cwd || process.cwd(), "hook cwd");
  const project = selectProject(configuredProjects(configPath), cwd);
  if (!project) {
    return {};
  }

  const projectRoot = canonicalExistingDirectory(project.root, `registered project ${project.name}`);

  const observedGitRoot = gitRoot(cwd);
  if (pathKey(observedGitRoot) !== pathKey(projectRoot)) {
    throw new Error("configured project root does not equal the observed Git root");
  }

  const agents = readAgents(projectRoot, options.maxBytes || DEFAULT_MAX_BYTES);
  const context = [
    "Post-compaction project instructions were reloaded from the registered Git root.",
    `Project: ${project.name}`,
    `Source: ${agents.path}`,
    `SHA-256: ${agents.sha256}`,
    "",
    "<project-agents-md>",
    agents.text,
    "</project-agents-md>",
  ].join("\n");

  if (format === "agy") {
    return {
      injectSteps: [
        {
          ephemeralMessage: context,
        },
      ],
    };
  }

  if (format === "markdown") {
    return {
      format: "markdown",
      context,
    };
  }

  if (format === "hermes") {
    // Hermes shell hooks parse stdout as JSON; {"context": ...} is the documented
    // context-injection shape (agent/shell_hooks.py `_parse_context`).
    return {
      context,
    };
  }

  if (format === "json") {
    return {
      project: project.name,
      source: agents.path,
      sha256: agents.sha256,
      text: agents.text,
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  };
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }
  let value = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    value += chunk;
  }
  return value;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  try {
    const raw = await readStdin();
    if (!raw.trim()) {
      if (flags.format === "markdown" || flags.format === "json" || flags.format === "hermes") {
        const output = buildHookOutput({}, { format: flags.format, cwd: flags.customCwd, projectsPath: flags.projectsPath });
        if (flags.format === "markdown") {
          process.stdout.write(`${output.context || ""}\n`);
        } else {
          jsonOut(output);
        }
        return;
      }
      jsonOut(stop("hook input is empty"));
      return;
    }
    const payload = parseJson(raw, "hook input");
    const output = buildHookOutput(payload, { format: flags.format, cwd: flags.customCwd, projectsPath: flags.projectsPath });
    if (flags.format === "markdown") {
      process.stdout.write(`${output.context || ""}\n`);
    } else {
      jsonOut(output);
    }
  } catch (error) {
    jsonOut(stop(error instanceof Error ? error.message : "unexpected error"));
  }
}

if (process.argv[1] && pathKey(path.resolve(process.argv[1])) === pathKey(SCRIPT_PATH)) {
  await main();
}
