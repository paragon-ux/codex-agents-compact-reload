#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  INSTALL_DIRECTORY_NAME,
  projectsArray,
  readJson,
  removeHookHandlers,
  writeJsonAtomic,
} from "./install.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function usage() {
  return `Usage:
  node scripts/uninstall.mjs --project <name> [options]
  node scripts/uninstall.mjs --all [options]

Options:
  --project <name>       Remove one registered project. Repeatable.
  --all                  Remove every registration and this hook installation.
  --codex-home <path>    Override CODEX_HOME for this cleanup.
  --dry-run              Print the proposed cleanup without writing or deleting.
  --help                 Show this help.
`;
}

function parseArgs(argv) {
  const options = {
    projects: [],
    all: false,
    codexHome: null,
    dryRun: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--project") {
      const name = argv[++index];
      if (!name || !name.trim()) {
        throw new Error("--project requires a nonempty registered project name");
      }
      options.projects.push(name.trim());
    } else if (argument === "--all") {
      options.all = true;
    } else if (argument === "--codex-home") {
      options.codexHome = argv[++index];
      if (!options.codexHome) {
        throw new Error("--codex-home requires a path");
      }
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!options.help && options.all === (options.projects.length > 0)) {
    throw new Error("choose either one or more --project values or --all");
  }
  return options;
}

function configWithProjects(config, projects) {
  if (Array.isArray(config)) {
    return projects;
  }
  const base = config && typeof config === "object" ? structuredClone(config) : {};
  base.projects = projects;
  return base;
}

function backupPath(hooksPath) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-");
  return `${hooksPath}.bak-agents-compact-reload-${stamp}`;
}

export function uninstallationPlan(options) {
  const codexHome = path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
  const installDirectory = path.join(codexHome, "hooks", INSTALL_DIRECTORY_NAME);
  const installedHookPath = path.join(installDirectory, "reload-agents.mjs");
  const projectsPath = path.join(installDirectory, "projects.json");
  const hooksPath = path.join(codexHome, "hooks.json");
  const projectsConfig = readJson(projectsPath, { projects: [] });
  const projects = projectsArray(projectsConfig);
  const requestedNames = [...new Set(options.projects)];

  if (!options.all) {
    const knownNames = new Set(projects.map((project) => project?.name).filter((name) => typeof name === "string"));
    const missingNames = requestedNames.filter((name) => !knownNames.has(name));
    if (missingNames.length > 0) {
      throw new Error(`registered project not found: ${missingNames.join(", ")}`);
    }
  }

  const removedProjects = options.all
    ? projects
    : projects.filter((project) => requestedNames.includes(project?.name));
  const remainingProjects = options.all
    ? []
    : projects.filter((project) => !requestedNames.includes(project?.name));
  const removeInstallation = options.all || remainingProjects.length === 0;
  const hooksConfig = readJson(hooksPath, { hooks: {} });
  const hookRemoval = removeHookHandlers(hooksConfig, installedHookPath);

  return {
    codexHome,
    installDirectory,
    installedHookPath,
    projectsPath,
    hooksPath,
    projectsConfig,
    nextProjectsConfig: configWithProjects(projectsConfig, remainingProjects),
    nextHooksConfig: hookRemoval.config,
    hookHandlersToRemove: removeInstallation ? hookRemoval.removedHandlers : 0,
    removedProjects,
    remainingProjects,
    removeInstallation,
  };
}

function publicPlan(plan) {
  return {
    codex_home: plan.codexHome,
    mode: plan.removeInstallation ? "remove-installation" : "remove-registrations",
    removed_projects: plan.removedProjects.map((project) => project.name),
    remaining_projects: plan.remainingProjects.map((project) => project.name),
    hook_handlers_to_remove: plan.hookHandlersToRemove,
    install_directory: plan.installDirectory,
    projects_path: plan.projectsPath,
    hooks_path: plan.hooksPath,
  };
}

function uninstall(options) {
  const plan = uninstallationPlan(options);
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(publicPlan(plan), null, 2)}\n`);
    return;
  }

  let hooksBackup = null;
  if (plan.removeInstallation) {
    if (fs.existsSync(plan.hooksPath) && plan.hookHandlersToRemove > 0) {
      hooksBackup = backupPath(plan.hooksPath);
      fs.copyFileSync(plan.hooksPath, hooksBackup);
      writeJsonAtomic(plan.hooksPath, plan.nextHooksConfig);
    }
    if (fs.existsSync(plan.installDirectory)) {
      fs.rmSync(plan.installDirectory, { recursive: true, force: false });
    }
  } else {
    writeJsonAtomic(plan.projectsPath, plan.nextProjectsConfig);
  }

  process.stdout.write(`${JSON.stringify({
    ...publicPlan(plan),
    hooks_backup: hooksBackup,
    completed: true,
  }, null, 2)}\n`);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    uninstall(options);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
