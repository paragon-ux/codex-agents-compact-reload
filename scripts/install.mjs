#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const SOURCE_HOOK = path.join(REPOSITORY_ROOT, "src", "reload-agents.mjs");
export const INSTALL_DIRECTORY_NAME = "agents-compact-reload";
export const MINIMUM_CODEX_VERSION = "0.145.0";
export const COMPACT_DELIVERY_FIX_COMMIT = "8c41ed33ce3e39460e7b13b14c35e0c39bb5980d";

function usage() {
  return `Usage:
  node scripts/install.mjs --project Name=<project-root> [options]

Options:
  --project Name=<path>  Register or update a project. Repeatable.
  --codex-home <path>    Override CODEX_HOME for this installation.
  --codex-version <ver>  Exact active Codex version (minimum ${MINIMUM_CODEX_VERSION}).
  --node <path>          Node executable used by the hook.
  --dry-run              Print the proposed installation without writing.
  --help                 Show this help.
`;
}

function parseAssignment(raw) {
  if (!raw || !raw.includes("=")) {
    throw new Error("--project expects Name=<project-root>");
  }
  const [name, ...pathParts] = raw.split("=");
  const projectPath = pathParts.join("=");
  if (!name.trim() || !projectPath.trim()) {
    throw new Error("--project name and path must both be nonempty");
  }
  return { name: name.trim(), root: projectPath.trim() };
}

function parseArgs(argv) {
  const options = {
    projects: [],
    codexHome: null,
    codexVersion: null,
    nodePath: process.execPath,
    dryRun: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--project") {
      options.projects.push(parseAssignment(argv[++index]));
    } else if (argument === "--codex-home") {
      options.codexHome = argv[++index];
    } else if (argument === "--codex-version") {
      options.codexVersion = argv[++index];
    } else if (argument === "--node") {
      options.nodePath = argv[++index];
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function canonicalDirectory(value, label) {
  if (!value) {
    throw new Error(`${label} is required`);
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

function versionTuple(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  const match = value.trim().match(/^(?:codex(?:-cli)?\s+)?v?(\d+)\.(\d+)\.(\d+)([-+][0-9A-Za-z.-]+)?$/i);
  if (!match) {
    throw new Error(`${label} must be a stable semantic version such as 0.147.0`);
  }
  if (match[4]?.startsWith("-")) {
    throw new Error(`${label} must be a stable release, not a prerelease`);
  }
  return {
    normalized: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
    tuple: match.slice(1, 4).map(Number),
  };
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

export function supportedCodexVersion(value) {
  const observed = versionTuple(value, "--codex-version");
  const minimum = versionTuple(MINIMUM_CODEX_VERSION, "minimum Codex version");
  if (compareVersions(observed.tuple, minimum.tuple) < 0) {
    throw new Error(
      `Codex ${observed.normalized} is unsupported; ${MINIMUM_CODEX_VERSION} or newer is required because earlier builds may defer compact SessionStart hooks (openai/codex#28736)`,
    );
  }
  return observed.normalized;
}

function validateProject(project) {
  const root = canonicalDirectory(project.root, `project ${project.name}`);
  const agentsPath = path.join(root, "AGENTS.md");
  if (!fs.existsSync(path.join(root, ".git"))) {
    throw new Error(`project ${project.name} is not a Git root`);
  }
  if (!fs.existsSync(agentsPath) || !fs.statSync(agentsPath).isFile()) {
    throw new Error(`project ${project.name} does not contain a root AGENTS.md`);
  }
  if (fs.statSync(agentsPath).size === 0) {
    throw new Error(`project ${project.name} has an empty AGENTS.md`);
  }
  return { name: project.name, root };
}

export function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`${filePath} is not valid JSON`);
  }
}

export function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function quoteCommandArgument(value) {
  if (String(value).includes('"')) {
    throw new Error("hook command paths cannot contain a double quote");
  }
  return `"${value}"`;
}

export function projectsArray(config) {
  return Array.isArray(config) ? config : Array.isArray(config?.projects) ? config.projects : [];
}

function mergeProjects(existingConfig, incomingProjects, codexVersion) {
  const merged = new Map();
  for (const project of projectsArray(existingConfig)) {
    if (project && typeof project.name === "string" && typeof project.root === "string") {
      merged.set(project.name, { name: project.name, root: project.root });
    }
  }
  for (const project of incomingProjects) {
    merged.set(project.name, project);
  }
  const base = !Array.isArray(existingConfig) && existingConfig && typeof existingConfig === "object"
    ? structuredClone(existingConfig)
    : {};
  return {
    ...base,
    format_version: 1,
    installed_for_codex_version: codexVersion,
    minimum_codex_version: MINIMUM_CODEX_VERSION,
    compact_delivery_fix_commit: COMPACT_DELIVERY_FIX_COMMIT,
    projects: [...merged.values()].sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function isThisHook(handler, installedHookPath) {
  if (!handler || handler.type !== "command") {
    return false;
  }
  const commands = [handler.command, handler.commandWindows].filter((value) => typeof value === "string");
  return commands.some((command) => command.includes(installedHookPath));
}

export function removeHookHandlers(existingConfig, installedHookPath) {
  const config = existingConfig && typeof existingConfig === "object" ? structuredClone(existingConfig) : {};
  config.hooks = config.hooks && typeof config.hooks === "object" ? config.hooks : {};
  const groups = Array.isArray(config.hooks.SessionStart) ? config.hooks.SessionStart : [];
  const cleanedGroups = [];
  let removedHandlers = 0;
  for (const group of groups) {
    const originalHandlers = Array.isArray(group?.hooks) ? group.hooks : [];
    const handlers = originalHandlers.filter((handler) => !isThisHook(handler, installedHookPath));
    removedHandlers += originalHandlers.length - handlers.length;
    if (handlers.length > 0) {
      cleanedGroups.push({ ...group, hooks: handlers });
    }
  }
  if (cleanedGroups.length > 0) {
    config.hooks.SessionStart = cleanedGroups;
  } else {
    delete config.hooks.SessionStart;
  }
  return { config, removedHandlers };
}

function mergeHooks(existingConfig, command, installedHookPath) {
  const { config } = removeHookHandlers(existingConfig, installedHookPath);
  config.hooks.SessionStart ||= [];
  config.hooks.SessionStart.push({
    matcher: "compact",
    hooks: [{
      type: "command",
      command,
      commandWindows: command,
      timeout: 5,
      statusMessage: "Reloading project AGENTS.md after compaction",
      additionalContextLimit: 0,
    }],
  });
  return config;
}

export function installationPlan(options) {
  if (options.projects.length === 0) {
    throw new Error("at least one --project is required");
  }
  const projects = options.projects.map(validateProject);
  const codexVersion = supportedCodexVersion(options.codexVersion);
  const codexHome = path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
  const nodePath = fs.realpathSync.native(path.resolve(options.nodePath));
  const installDirectory = path.join(codexHome, "hooks", INSTALL_DIRECTORY_NAME);
  const installedHookPath = path.join(installDirectory, "reload-agents.mjs");
  const projectsPath = path.join(installDirectory, "projects.json");
  const hooksPath = path.join(codexHome, "hooks.json");
  const command = `${quoteCommandArgument(nodePath)} ${quoteCommandArgument(installedHookPath)}`;
  return {
    codexHome,
    nodePath,
    installDirectory,
    installedHookPath,
    projectsPath,
    hooksPath,
    command,
    codexVersion,
    projects,
    projectsConfig: mergeProjects(readJson(projectsPath, { projects: [] }), projects, codexVersion),
    hooksConfig: mergeHooks(readJson(hooksPath, { hooks: {} }), command, installedHookPath),
  };
}

function install(options) {
  const plan = installationPlan(options);
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({
      codex_home: plan.codexHome,
      hook_path: plan.installedHookPath,
      projects_path: plan.projectsPath,
      hooks_path: plan.hooksPath,
      codex_version: plan.codexVersion,
      minimum_codex_version: MINIMUM_CODEX_VERSION,
      projects: plan.projects,
      command: plan.command,
    }, null, 2)}\n`);
    return;
  }

  fs.mkdirSync(plan.installDirectory, { recursive: true });
  fs.copyFileSync(SOURCE_HOOK, plan.installedHookPath);
  writeJsonAtomic(plan.projectsPath, plan.projectsConfig);
  writeJsonAtomic(plan.hooksPath, plan.hooksConfig);

  process.stdout.write(`Installed AGENTS.md compact reload hook.\n`);
  process.stdout.write(`Hook: ${plan.installedHookPath}\n`);
  process.stdout.write(`Projects: ${plan.projectsPath}\n`);
  process.stdout.write(`Codex hooks: ${plan.hooksPath}\n`);
  process.stdout.write(`Codex compatibility: ${plan.codexVersion} (minimum ${MINIMUM_CODEX_VERSION})\n`);
  process.stdout.write("Trust the new hook in Codex Settings > Hooks or with /hooks before use.\n");
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    install(options);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
