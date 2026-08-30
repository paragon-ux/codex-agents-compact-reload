import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "..");
const INSTALLER_PATH = path.join(REPOSITORY_ROOT, "scripts", "install.mjs");

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agents-install-project-"));
  execFileSync("git", ["init", "--quiet", root]);
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Installed project instructions\n", "utf8");
  return root;
}

function runInstaller(codexHome, projectRoot, codexVersion = "0.147.0") {
  return spawnSync(process.execPath, [
    INSTALLER_PATH,
    "--project",
    `demo=${projectRoot}`,
    "--codex-home",
    codexHome,
    "--codex-version",
    codexVersion,
  ], {
    encoding: "utf8",
    env: { ...process.env, CODEX_HOME: codexHome },
  });
}

test("installs a project-scoped compact SessionStart hook without replacing unrelated hooks", () => {
  const projectRoot = makeProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-codex-home-"));
  const hooksPath = path.join(codexHome, "hooks.json");
  fs.writeFileSync(hooksPath, JSON.stringify({
    description: "existing",
    hooks: {
      Stop: [{ matcher: "", hooks: [{ type: "command", command: "existing-command" }] }],
    },
  }), "utf8");

  const first = runInstaller(codexHome, projectRoot);
  assert.equal(first.status, 0, first.stderr);
  const second = runInstaller(codexHome, projectRoot);
  assert.equal(second.status, 0, second.stderr);

  const installedDirectory = path.join(codexHome, "hooks", "agents-compact-reload");
  const installedHook = path.join(installedDirectory, "reload-agents.mjs");
  const projects = JSON.parse(fs.readFileSync(path.join(installedDirectory, "projects.json"), "utf8"));
  const hooks = JSON.parse(fs.readFileSync(hooksPath, "utf8"));

  assert.equal(fs.existsSync(installedHook), true);
  assert.deepEqual(projects.projects, [{ name: "demo", root: fs.realpathSync.native(projectRoot) }]);
  assert.equal(projects.format_version, 1);
  assert.equal(projects.installed_for_codex_version, "0.147.0");
  assert.equal(projects.minimum_codex_version, "0.145.0");
  assert.equal(projects.compact_delivery_fix_commit, "8c41ed33ce3e39460e7b13b14c35e0c39bb5980d");
  assert.equal(hooks.description, "existing");
  assert.equal(hooks.hooks.Stop.length, 1);
  assert.equal(hooks.hooks.SessionStart.length, 1, "repeat installation must not duplicate the hook");
  assert.equal(hooks.hooks.SessionStart[0].matcher, "compact");
  assert.equal(hooks.hooks.SessionStart[0].hooks[0].type, "command");
  assert.match(hooks.hooks.SessionStart[0].hooks[0].commandWindows, /reload-agents\.mjs/);
  assert.equal(Object.hasOwn(hooks.hooks, "PostCompact"), false);

  const hookResult = spawnSync(process.execPath, [installedHook], {
    input: JSON.stringify({
      hook_event_name: "SessionStart",
      source: "compact",
      cwd: projectRoot,
    }),
    encoding: "utf8",
  });
  assert.equal(hookResult.status, 0, hookResult.stderr);
  const parsed = JSON.parse(hookResult.stdout);
  assert.match(parsed.hookSpecificOutput.additionalContext, /Installed project instructions/);
});

test("dry-run reports paths without writing CODEX_HOME", () => {
  const projectRoot = makeProject();
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "agents-dry-run-"));
  const codexHome = path.join(parent, "not-created");
  const result = spawnSync(process.execPath, [
    INSTALLER_PATH,
    "--project",
    `demo=${projectRoot}`,
    "--codex-home",
    codexHome,
    "--codex-version",
    "0.145.0",
    "--dry-run",
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(codexHome), false);
  const output = JSON.parse(result.stdout);
  assert.equal(output.codex_home, path.resolve(codexHome));
  assert.equal(output.codex_version, "0.145.0");
  assert.equal(output.minimum_codex_version, "0.145.0");
});

test("rejects Codex releases affected by deferred compact SessionStart delivery", () => {
  const projectRoot = makeProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-old-codex-home-"));

  const affected = runInstaller(codexHome, projectRoot, "codex-cli 0.144.2");
  assert.equal(affected.status, 1);
  assert.match(affected.stderr, /0\.145\.0 or newer is required/);
  assert.equal(fs.existsSync(path.join(codexHome, "hooks.json")), false);

  const missing = spawnSync(process.execPath, [
    INSTALLER_PATH,
    "--project", `demo=${projectRoot}`,
    "--codex-home", codexHome,
  ], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--codex-version is required/);

  const prerelease = runInstaller(codexHome, projectRoot, "0.145.0-alpha.1");
  assert.equal(prerelease.status, 1);
  assert.match(prerelease.stderr, /stable release, not a prerelease/);
});
