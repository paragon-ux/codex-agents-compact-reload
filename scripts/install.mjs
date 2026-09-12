#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const SOURCE_HOOK = path.join(REPOSITORY_ROOT, "src", "reload-agents.mjs");
export const INSTALL_DIRECTORY_NAME = "agents-compact-reload";
export const MINIMUM_CODEX_VERSION = "0.145.0";
export const COMPACT_DELIVERY_FIX_COMMIT = "8c41ed33ce3e39460e7b13b14c35e0c39bb5980d";
export const HERMES_HOOK_TIMEOUT_SECONDS = 15;

function usage() {
  return `Usage:
  node scripts/install.mjs --target codex --project Name=<project-root> --codex-version <ver> [options]
  node scripts/install.mjs --target hermes --project Name=<project-root> [options]

Options:
  --target <harness>     Installation target: codex (default) or hermes.
  --project Name=<path>  Register or update a project. Repeatable.
  --codex-home <path>    Override CODEX_HOME for this installation. (codex)
  --codex-version <ver>  Exact active Codex version (minimum ${MINIMUM_CODEX_VERSION}). (codex)
  --hermes-home <path>   Override the Hermes home directory (default $HERMES_HOME or ~/.hermes). (hermes)
  --plugin               (hermes) Install the zero-pin Python plugin instead of the
                         config.yaml shell hook. Uses Hermes' own compaction
                         classifiers; no hooks: entry or consent prompt.
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
    target: "codex",
    projects: [],
    codexHome: null,
    codexVersion: null,
    hermesHome: null,
    nodePath: process.execPath,
    dryRun: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") {
      const value = argv[++index];
      if (value !== "codex" && value !== "hermes") {
        throw new Error(`--target must be "codex" or "hermes"; got ${value}`);
      }
      options.target = value;
    } else if (argument === "--project") {
      options.projects.push(parseAssignment(argv[++index]));
    } else if (argument === "--codex-home") {
      options.codexHome = argv[++index];
    } else if (argument === "--codex-version") {
      options.codexVersion = argv[++index];
    } else if (argument === "--hermes-home") {
      options.hermesHome = argv[++index];
    } else if (argument === "--plugin") {
      options.plugin = true;
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
  if (options.target === "codex") {
    if (!options.codexVersion) {
      throw new Error("--codex-version is required for the codex target");
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

function sameWindowsPath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

export function quoteFreeWindowsPath(existingPath, label) {
  const canonical = fs.realpathSync.native(path.resolve(existingPath));
  if (process.platform !== "win32") {
    return canonical;
  }
  if (canonical.includes('"')) {
    throw new Error(`${label} cannot contain a double quote`);
  }

  const windowsPowerShell = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const shortPathScript = `
$definition = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class CompactReloadNativePath {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern uint GetShortPathName(string longPath, StringBuilder shortPath, uint bufferLength);
}
'@
Add-Type -TypeDefinition $definition
$builder = New-Object System.Text.StringBuilder 32768
$count = [CompactReloadNativePath]::GetShortPathName(
    $env:CODEX_COMPACT_RELOAD_LONG_PATH,
    $builder,
    [uint32]$builder.Capacity
)
if ($count -eq 0 -or $count -ge $builder.Capacity) { exit 1 }
[Console]::Out.Write($builder.ToString())
`;
  const encodedScript = Buffer.from(shortPathScript, "utf16le").toString("base64");
  const result = spawnSync(
    windowsPowerShell,
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript],
    {
      encoding: "utf8",
      env: { ...process.env, CODEX_COMPACT_RELOAD_LONG_PATH: canonical },
      windowsHide: true,
    },
  );
  const shortPath = result.stdout.trim();
  if (result.status !== 0 || !shortPath) {
    throw new Error(`${label} has no usable Windows short path`);
  }
  if (/[\s"&|<>^()%!]/u.test(shortPath)) {
    throw new Error(
      `${label} cannot be represented as a quote-free Windows command token; enable NTFS short names or use a space-free installation path`,
    );
  }

  let resolvedShortPath;
  try {
    resolvedShortPath = fs.realpathSync.native(shortPath);
  } catch {
    throw new Error(`${label} Windows short path does not resolve`);
  }
  if (!sameWindowsPath(resolvedShortPath, canonical)) {
    throw new Error(`${label} Windows short path resolves to a different file`);
  }
  return shortPath;
}

function batchArgument(value, label) {
  const canonical = fs.realpathSync.native(path.resolve(value));
  if (canonical.includes('"')) {
    throw new Error(`${label} cannot contain a double quote`);
  }
  return `"${canonical.replaceAll("%", "%%")}"`;
}

export function windowsWrapperContent(nodePath, installedHookPath) {
  return [
    "@echo off",
    `${batchArgument(nodePath, "Node executable")} ${batchArgument(installedHookPath, "installed hook")}`,
    "exit /b %errorlevel%",
    "",
  ].join("\r\n");
}

export function windowsHookCommand(installedWrapperPath) {
  return quoteFreeWindowsPath(installedWrapperPath, "installed Windows wrapper");
}

export function projectsArray(config) {
  return Array.isArray(config) ? config : Array.isArray(config?.projects) ? config.projects : [];
}

// --- Hermes config.yaml region editing (line-based, dependency-free) ---
// Node ships no YAML parser, and a user's config.yaml may contain comments or
// formatting that a parse/re-emit cycle would destroy. The merger therefore
// performs line surgery: it only inserts/removes the `pre_llm_call` hook block
// inside the top-level `hooks:` section and leaves every other byte verbatim.
// It fails closed (with a manual-instructions error) on section shapes it does
// not understand instead of guessing.

function yamlDoubleQuoted(text) {
  return `"${String(text).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function hermesHookEntry(nodePath, installedHookPath) {
  // Forward slashes: valid on Windows for Node and child processes, and they
  // keep the YAML scalar free of backslash escapes.
  const fwd = (value) => String(value).replaceAll("\\", "/");
  return {
    command: `${yamlDoubleQuoted(fwd(nodePath))} ${yamlDoubleQuoted(fwd(installedHookPath))}`,
    timeout: HERMES_HOOK_TIMEOUT_SECONDS,
  };
}

function hermesHookEntryLines(entry) {
  return [
    `    - command: ${entry.command}`,
    `      timeout: ${entry.timeout}`,
  ];
}

const HERMES_HOOK_TARGET_SEGMENT = "agents-compact-reload";

function isHookEntryLine(line) {
  return /^\s{4,}- command: /.test(line);
}

function findTopLevelSection(lines, key) {
  const exact = lines.findIndex((line) => line === `${key}:`);
  if (exact !== -1) {
    return { start: exact, style: "block" };
  }
  const inline = lines.findIndex((line) => new RegExp(`^${key}: \\S`).test(line));
  if (inline !== -1) {
    return { start: inline, style: "inline" };
  }
  return null;
}

// End of a top-level section: the next non-blank, non-comment line at indent 0.
function sectionEnd(lines, start) {
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      return index;
    }
  }
  return lines.length;
}

function findPreLlmCall(lines, hooksStart, hooksEnd) {
  for (let index = hooksStart + 1; index < hooksEnd; index += 1) {
    if (lines[index] === "  pre_llm_call:") {
      return index;
    }
  }
  return -1;
}

// End of the `pre_llm_call:` list: the next non-blank line with indent <= 2.
function listEnd(lines, start, hooksEnd) {
  for (let index = start + 1; index < hooksEnd; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      continue;
    }
    if (/^\s{3}/.test(line)) {
      continue;
    }
    return index;
  }
  return hooksEnd;
}

export function mergeHermesHooks(existingText, entry) {
  const usesCrlf = existingText.includes("\r\n");
  const newline = usesCrlf ? "\r\n" : "\n";
  const lines = existingText ? existingText.split(/\r?\n/) : [];
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop(); // trailing newline becomes a join artifact
  }
  const hooksSection = findTopLevelSection(lines, "hooks");
  const entryLines = hermesHookEntryLines(entry);

  if (!hooksSection) {
    lines.push("hooks:", "  pre_llm_call:", ...entryLines);
    return lines.join(newline) + newline;
  }
  if (hooksSection.style === "inline") {
    throw new Error(
      "existing config.yaml uses an inline `hooks:` value; add the pre_llm_call hook manually (see harnesses/hermes/README.md)",
    );
  }
  const hooksEnd = sectionEnd(lines, hooksSection.start);
  const preIndex = findPreLlmCall(lines, hooksSection.start, hooksEnd);
  if (preIndex === -1) {
    lines.splice(hooksSection.start + 1, 0, "  pre_llm_call:", ...entryLines);
    return lines.join(newline) + newline;
  }
  const blockEnd = listEnd(lines, preIndex, hooksEnd);
  const block = lines.slice(preIndex + 1, blockEnd);
  if (block.some((line) => line.includes("reload-agents.mjs"))) {
    return lines.join(newline) + newline; // already registered — idempotent no-op
  }
  if (block.some((line) => /[|>]/.test(line) && /\s[|>]\s*$/.test(line))) {
    throw new Error(
      "existing `hooks.pre_llm_call` contains block scalars this installer cannot parse; add the hook manually (see harnesses/hermes/README.md)",
    );
  }
  // Append after the last existing list item (or directly under the key).
  let insertAt = preIndex + 1;
  for (let index = preIndex + 1; index < blockEnd; index += 1) {
    if (isHookEntryLine(lines[index]) || /^\s{5,}/.test(lines[index])) {
      insertAt = index + 1;
    }
  }
  lines.splice(insertAt, 0, ...entryLines);
  return lines.join(newline) + newline;
}

export function removeHermesHookEntry(existingText, installedHookPath) {
  const usesCrlf = existingText.includes("\r\n");
  const newline = usesCrlf ? "\r\n" : "\n";
  const lines = existingText ? existingText.split(/\r?\n/) : [];
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const hooksSection = findTopLevelSection(lines, "hooks");
  if (!hooksSection || hooksSection.style !== "block") {
    return { text: existingText, removedEntries: 0 };
  }
  const hooksEnd = sectionEnd(lines, hooksSection.start);
  const preIndex = findPreLlmCall(lines, hooksSection.start, hooksEnd);
  if (preIndex === -1) {
    return { text: existingText, removedEntries: 0 };
  }
  const blockEnd = listEnd(lines, preIndex, hooksEnd);
  // Collect [start, end) ranges of list items mentioning the installed hook.
  const ranges = [];
  for (let index = preIndex + 1; index < blockEnd; index += 1) {
    if (isHookEntryLine(lines[index]) && lines[index].includes(path.basename(installedHookPath))
      && lines[index].includes(HERMES_HOOK_TARGET_SEGMENT)) {
      let end = index + 1;
      while (end < blockEnd && (/^\s{6,}/.test(lines[end]) || lines[end].trim() === "")) {
        if (isHookEntryLine(lines[end])) {
          break;
        }
        end += 1;
      }
      while (end > index + 1 && lines[end - 1].trim() === "") {
        end -= 1;
      }
      ranges.push([index, end]);
      index = end - 1;
    }
  }
  if (ranges.length === 0) {
    return { text: existingText, removedEntries: 0 };
  }
  for (let range = ranges.length - 1; range >= 0; range -= 1) {
    lines.splice(ranges[range][0], ranges[range][1] - ranges[range][0]);
  }
  const preAfter = findPreLlmCall(lines, hooksSection.start, lines.length);
  if (preAfter !== -1 && listEnd(lines, preAfter, lines.length) === preAfter + 1) {
    lines.splice(preAfter, 1); // list is empty — drop the key too
  }
  return { text: lines.join(newline) + newline, removedEntries: ranges.length };
}

export function hermesHomeDir(hermesHomeOverride) {
  if (hermesHomeOverride) {
    return canonicalDirectory(hermesHomeOverride, "--hermes-home");
  }
  if (process.env.HERMES_HOME && process.env.HERMES_HOME.trim()) {
    return canonicalDirectory(process.env.HERMES_HOME, "HERMES_HOME");
  }
  return path.join(os.homedir(), ".hermes");
}

function hermesInstallationPlan(options) {
  if (options.projects.length === 0) {
    throw new Error("at least one --project is required");
  }
  const projects = options.projects.map(validateProject);
  const hermesHome = hermesHomeDir(options.hermesHome);
  const nodePath = fs.realpathSync.native(path.resolve(options.nodePath));
  const installDirectory = path.join(hermesHome, "hooks", INSTALL_DIRECTORY_NAME);
  const installedHookPath = path.join(installDirectory, "reload-agents.mjs");
  const projectsPath = path.join(installDirectory, "projects.json");
  const configPath = path.join(hermesHome, "config.yaml");
  const entry = hermesHookEntry(nodePath, installedHookPath);
  return {
    target: "hermes",
    plugin: Boolean(options.plugin),
    hermesHome,
    nodePath,
    installDirectory,
    installedHookPath,
    projectsPath,
    configPath,
    entry,
    projects: projects.map(({ name, root }) => ({ name, root })),
    projectsConfig: mergeProjects(readJson(projectsPath, { projects: [] }), projects, null),
  };
}

function installHermes(plan, dryRun) {
  // Plugin mode installs into $HERMES_HOME/plugins/<name>/ (Hermes' user-plugin
  // discovery root — each plugin is its own subdirectory with __init__.py), plus
  // the shared hook/projects copy under hooks/agents-compact-reload/.
  const pluginDirectory = path.join(plan.hermesHome, "plugins", INSTALL_DIRECTORY_NAME);
  if (dryRun) {
    process.stdout.write(`${JSON.stringify({
      target: "hermes",
      mode: plan.plugin ? "plugin" : "shell-hook",
      hermes_home: plan.hermesHome,
      plugin_path: pluginDirectory,
      hook_path: plan.installedHookPath,
      projects_path: plan.projectsPath,
      config_path: plan.configPath,
      hook_entry: plan.entry,
      projects: plan.projects,
    }, null, 2)}\n`);
    return;
  }
  fs.mkdirSync(plan.installDirectory, { recursive: true });
  fs.copyFileSync(SOURCE_HOOK, plan.installedHookPath);
  writeJsonAtomic(plan.projectsPath, plan.projectsConfig);
  if (plan.plugin) {
    // Zero-pin plugin mode: install the Python plugin that detects compaction via
    // Hermes' own classifiers (no marker pins). No config.yaml hook entry is
    // written; plugins load without the shell-hook consent prompt. The plugin
    // reads projects.json from the shared install directory.
    const pluginSource = path.join(REPOSITORY_ROOT, "harnesses", "hermes", "plugin");
    fs.mkdirSync(pluginDirectory, { recursive: true });
    for (const name of ["__init__.py", "plugin.yaml"]) {
      fs.copyFileSync(path.join(pluginSource, name), path.join(pluginDirectory, name));
    }
    process.stdout.write("Installed AGENTS.md compact reload plugin for Hermes Agent (zero-pin mode).\n");
    process.stdout.write(`Plugin: ${pluginDirectory}\n`);
    process.stdout.write(`Projects: ${plan.projectsPath}\n`);
    process.stdout.write("Restart Hermes so the plugin registers (user plugins load from ~/.hermes/plugins/<name>/).\n");
    return;
  }
  const existingConfig = fs.existsSync(plan.configPath) ? fs.readFileSync(plan.configPath, "utf8") : "";
  const nextConfig = mergeHermesHooks(existingConfig, plan.entry);
  const backupPath = `${plan.configPath}.bak-agents-compact-reload-${new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-")}`;
  if (fs.existsSync(plan.configPath)) {
    fs.copyFileSync(plan.configPath, backupPath);
  }
  fs.writeFileSync(plan.configPath, nextConfig, "utf8");
  process.stdout.write("Installed AGENTS.md compact reload hook for Hermes Agent.\n");
  process.stdout.write(`Hook: ${plan.installedHookPath}\n`);
  process.stdout.write(`Projects: ${plan.projectsPath}\n`);
  process.stdout.write(`Config: ${plan.configPath}\n`);
  if (fs.existsSync(backupPath)) {
    process.stdout.write(`Backup: ${backupPath}\n`);
  }
  process.stdout.write("Approve the (pre_llm_call, node) hook pair on first use, or run `hermes --accept-hooks`, or set hooks_auto_accept: true in config.yaml.\n");
  process.stdout.write("Restart Hermes so the hook registers.\n");
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

function mergeHooks(existingConfig, command, commandWindows, installedHookPath) {
  const { config } = removeHookHandlers(existingConfig, installedHookPath);
  config.hooks.SessionStart ||= [];
  config.hooks.SessionStart.push({
    matcher: "compact",
    hooks: [{
      type: "command",
      command,
      commandWindows,
      timeout: 5,
      statusMessage: "Reloading project AGENTS.md after compaction",
      additionalContextLimit: 0,
    }],
  });
  return config;
}

export function installationPlan(options) {
  if (options.target === "hermes") {
    return hermesInstallationPlan(options);
  }
  if (options.projects.length === 0) {
    throw new Error("at least one --project is required");
  }
  const projects = options.projects.map(validateProject);
  const codexVersion = supportedCodexVersion(options.codexVersion);
  const codexHome = path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
  const nodePath = fs.realpathSync.native(path.resolve(options.nodePath));
  const installDirectory = path.join(codexHome, "hooks", INSTALL_DIRECTORY_NAME);
  const installedHookPath = path.join(installDirectory, "reload-agents.mjs");
  const installedWrapperPath = path.join(installDirectory, "reload-agents.cmd");
  const projectsPath = path.join(installDirectory, "projects.json");
  const hooksPath = path.join(codexHome, "hooks.json");
  const command = `${quoteCommandArgument(nodePath)} ${quoteCommandArgument(installedHookPath)}`;
  const commandWindows = process.platform === "win32"
    ? (fs.existsSync(installedWrapperPath) ? windowsHookCommand(installedWrapperPath) : null)
    : command;
  return {
    codexHome,
    nodePath,
    installDirectory,
    installedHookPath,
    installedWrapperPath,
    projectsPath,
    hooksPath,
    command,
    commandWindows,
    codexVersion,
    projects,
    projectsConfig: mergeProjects(readJson(projectsPath, { projects: [] }), projects, codexVersion),
  };
}

function install(options) {
  const plan = installationPlan(options);
  if (plan.target === "hermes") {
    installHermes(plan, options.dryRun);
    return;
  }
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({
      codex_home: plan.codexHome,
      hook_path: plan.installedHookPath,
      windows_wrapper_path: plan.installedWrapperPath,
      projects_path: plan.projectsPath,
      hooks_path: plan.hooksPath,
      codex_version: plan.codexVersion,
      minimum_codex_version: MINIMUM_CODEX_VERSION,
      projects: plan.projects,
      command: plan.command,
      command_windows: plan.commandWindows,
      windows_command_note: process.platform === "win32" && !fs.existsSync(plan.installedWrapperPath)
        ? "The quote-free Windows command is resolved after the installed wrapper exists."
        : undefined,
    }, null, 2)}\n`);
    return;
  }

  fs.mkdirSync(plan.installDirectory, { recursive: true });
  fs.copyFileSync(SOURCE_HOOK, plan.installedHookPath);
  if (process.platform === "win32") {
    fs.writeFileSync(
      plan.installedWrapperPath,
      windowsWrapperContent(plan.nodePath, plan.installedHookPath),
      "utf8",
    );
  }
  const commandWindows = process.platform === "win32"
    ? windowsHookCommand(plan.installedWrapperPath)
    : plan.command;
  const hooksConfig = mergeHooks(
    readJson(plan.hooksPath, { hooks: {} }),
    plan.command,
    commandWindows,
    plan.installedHookPath,
  );
  writeJsonAtomic(plan.projectsPath, plan.projectsConfig);
  writeJsonAtomic(plan.hooksPath, hooksConfig);

  process.stdout.write(`Installed AGENTS.md compact reload hook.\n`);
  process.stdout.write(`Hook: ${plan.installedHookPath}\n`);
  if (process.platform === "win32") {
    process.stdout.write(`Windows wrapper: ${plan.installedWrapperPath}\n`);
  }
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
