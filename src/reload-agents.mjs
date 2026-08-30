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

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
      root: canonicalExistingDirectory(entry.root, `projects[${index}].root`),
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

export function buildHookOutput(payload, options = {}) {
  if (payload?.hook_event_name !== "SessionStart" || payload?.source !== "compact") {
    return {};
  }

  const configPath = path.resolve(
    options.projectsPath
      || process.env.AGENTS_COMPACT_RELOAD_PROJECTS_FILE
      || DEFAULT_PROJECTS_PATH,
  );
  const cwd = canonicalExistingDirectory(payload.cwd, "hook cwd");
  const project = selectProject(configuredProjects(configPath), cwd);
  if (!project) {
    return {};
  }

  const observedGitRoot = gitRoot(cwd);
  if (pathKey(observedGitRoot) !== pathKey(project.root)) {
    throw new Error("configured project root does not equal the observed Git root");
  }

  const agents = readAgents(project.root, options.maxBytes || DEFAULT_MAX_BYTES);
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
  try {
    const raw = await readStdin();
    if (!raw.trim()) {
      jsonOut(stop("hook input is empty"));
      return;
    }
    const payload = parseJson(raw, "hook input");
    jsonOut(buildHookOutput(payload));
  } catch (error) {
    jsonOut(stop(error instanceof Error ? error.message : "unexpected error"));
  }
}

if (process.argv[1] && pathKey(path.resolve(process.argv[1])) === pathKey(SCRIPT_PATH)) {
  await main();
}

