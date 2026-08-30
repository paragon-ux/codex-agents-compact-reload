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
const UNINSTALLER_PATH = path.join(REPOSITORY_ROOT, "scripts", "uninstall.mjs");

function makeProject(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  execFileSync("git", ["init", "--quiet", root]);
  fs.writeFileSync(path.join(root, "AGENTS.md"), `# ${name} instructions\n`, "utf8");
  return root;
}

function runScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
}

test("removes registrations or the complete installation without touching unrelated hooks", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-uninstall-home-"));
  const alphaRoot = makeProject("agents-uninstall-alpha");
  const betaRoot = makeProject("agents-uninstall-beta");
  const hooksPath = path.join(codexHome, "hooks.json");
  const unrelatedHandler = { type: "command", command: "existing-command" };
  fs.writeFileSync(hooksPath, `${JSON.stringify({
    description: "preserve me",
    hooks: {
      SessionStart: [{ matcher: "startup", hooks: [unrelatedHandler] }],
      Stop: [{ matcher: "", hooks: [unrelatedHandler] }],
    },
  }, null, 2)}\n`, "utf8");

  for (const [name, root] of [["alpha", alphaRoot], ["beta", betaRoot]]) {
    const install = runScript(INSTALLER_PATH, [
      "--project", `${name}=${root}`,
      "--codex-home", codexHome,
    ]);
    assert.equal(install.status, 0, install.stderr);
  }

  const installDirectory = path.join(codexHome, "hooks", "agents-compact-reload");
  const projectsPath = path.join(installDirectory, "projects.json");
  const hooksBeforeDryRun = fs.readFileSync(hooksPath, "utf8");
  const projectsBeforeDryRun = fs.readFileSync(projectsPath, "utf8");
  const dryRun = runScript(UNINSTALLER_PATH, [
    "--project", "alpha",
    "--codex-home", codexHome,
    "--dry-run",
  ]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.deepEqual(JSON.parse(dryRun.stdout).remaining_projects, ["beta"]);
  assert.equal(fs.readFileSync(hooksPath, "utf8"), hooksBeforeDryRun);
  assert.equal(fs.readFileSync(projectsPath, "utf8"), projectsBeforeDryRun);

  const unknown = runScript(UNINSTALLER_PATH, [
    "--project", "missing",
    "--codex-home", codexHome,
  ]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /registered project not found: missing/);

  const partial = runScript(UNINSTALLER_PATH, [
    "--project", "alpha",
    "--codex-home", codexHome,
  ]);
  assert.equal(partial.status, 0, partial.stderr);
  assert.equal(fs.existsSync(installDirectory), true);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(projectsPath, "utf8")).projects.map((project) => project.name),
    ["beta"],
  );
  const hooksAfterPartial = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  assert.equal(hooksAfterPartial.description, "preserve me");
  assert.equal(hooksAfterPartial.hooks.SessionStart.length, 2);
  assert.equal(hooksAfterPartial.hooks.Stop.length, 1);

  const complete = runScript(UNINSTALLER_PATH, [
    "--project", "beta",
    "--codex-home", codexHome,
  ]);
  assert.equal(complete.status, 0, complete.stderr);
  const completeOutput = JSON.parse(complete.stdout);
  assert.equal(completeOutput.mode, "remove-installation");
  assert.equal(completeOutput.hook_handlers_to_remove, 1);
  assert.equal(fs.existsSync(installDirectory), false);
  assert.equal(fs.existsSync(completeOutput.hooks_backup), true);

  const hooksAfterComplete = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  assert.equal(hooksAfterComplete.description, "preserve me");
  assert.deepEqual(hooksAfterComplete.hooks.SessionStart, [{ matcher: "startup", hooks: [unrelatedHandler] }]);
  assert.equal(hooksAfterComplete.hooks.Stop.length, 1);

  const repeatAll = runScript(UNINSTALLER_PATH, ["--all", "--codex-home", codexHome]);
  assert.equal(repeatAll.status, 0, repeatAll.stderr);
  assert.equal(JSON.parse(repeatAll.stdout).hook_handlers_to_remove, 0);
});
