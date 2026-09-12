import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { hermesHookEntry, mergeHermesHooks, removeHermesHookEntry } from "../scripts/install.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "..");
const INSTALLER_PATH = path.join(REPOSITORY_ROOT, "scripts", "install.mjs");
const UNINSTALLER_PATH = path.join(REPOSITORY_ROOT, "scripts", "uninstall.mjs");

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-project-"));
  execFileSync("git", ["init", "--quiet", root]);
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Hermes project instructions\n", "utf8");
  return root;
}

function runInstaller(args, env = {}) {
  return spawnSync(process.execPath, [INSTALLER_PATH, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function runUninstaller(args, env = {}) {
  return spawnSync(process.execPath, [UNINSTALLER_PATH, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("hermes installer merges a pre_llm_call hook into an existing config.yaml without losing content", () => {
  const projectRoot = makeProject();
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-home-"));
  const configPath = path.join(hermesHome, "config.yaml");
  fs.writeFileSync(configPath, [
    "# my hermes config",
    "model: gpt-5",
    "",
    "hooks:",
    "  pre_tool_call:",
    "    - command: guard.sh",
    "",
    "# hooks_auto_accept: false",
    "display:",
    "  skin: default",
    "",
  ].join("\n"), "utf8");

  const result = runInstaller([
    "--target", "hermes",
    "--project", `demo=${projectRoot}`,
    "--hermes-home", hermesHome,
  ]);
  assert.equal(result.status, 0, result.stderr);

  const config = fs.readFileSync(configPath, "utf8");
  assert.ok(config.includes("# my hermes config"), "header comment preserved");
  assert.ok(config.includes("model: gpt-5"), "model preserved");
  assert.ok(config.includes("guard.sh"), "unrelated hook preserved");
  assert.ok(config.includes("# hooks_auto_accept: false"), "trailing comment preserved");
  assert.ok(config.includes("pre_llm_call:"), "hook event added");
  assert.ok(config.includes("reload-agents.mjs"), "hook command present");
  assert.ok(fs.readdirSync(hermesHome).some((name) => name.startsWith("config.yaml.bak-")), "config backup written");
  assert.ok(fs.existsSync(path.join(hermesHome, "hooks", "agents-compact-reload", "reload-agents.mjs")));
  assert.ok(fs.existsSync(path.join(hermesHome, "hooks", "agents-compact-reload", "projects.json")));

  const dryRun = runInstaller([
    "--target", "hermes",
    "--project", `demo=${projectRoot}`,
    "--hermes-home", hermesHome,
    "--dry-run",
  ]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const plan = JSON.parse(dryRun.stdout);
  assert.equal(plan.target, "hermes");
});

test("hermes installer is idempotent and registers exactly one hook entry", () => {
  const projectRoot = makeProject();
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-home-"));
  const args = ["--target", "hermes", "--project", `demo=${projectRoot}`, "--hermes-home", hermesHome];
  assert.equal(runInstaller(args).status, 0);
  assert.equal(runInstaller(args).status, 0);

  const config = fs.readFileSync(path.join(hermesHome, "config.yaml"), "utf8");
  assert.equal((config.match(/reload-agents\.mjs/g) || []).length, 1);
});

test("hermes installer dry-run does not write config.yaml or the hook directory", () => {
  const projectRoot = makeProject();
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-home-"));
  const result = runInstaller([
    "--target", "hermes",
    "--project", `demo=${projectRoot}`,
    "--hermes-home", hermesHome,
    "--dry-run",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).target, "hermes");
  assert.ok(!fs.existsSync(path.join(hermesHome, "config.yaml")));
  assert.ok(!fs.existsSync(path.join(hermesHome, "hooks", "agents-compact-reload")));
});

test("hermes installer refuses a codex-style invocation without --codex-version", () => {
  const projectRoot = makeProject();
  const result = runInstaller(["--project", `demo=${projectRoot}`, "--codex-home", fs.mkdtempSync(path.join(os.tmpdir(), "codex-home-"))]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--codex-version is required/);
});

test("hermes uninstaller removes the hook entry, keeps unrelated content, and backs up config.yaml", () => {
  const projectRoot = makeProject();
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-home-"));
  const configPath = path.join(hermesHome, "config.yaml");
  fs.writeFileSync(configPath, "# config\nmodel: gpt-5\nhooks:\n  pre_tool_call:\n    - command: guard.sh\n", "utf8");

  const installArgs = ["--target", "hermes", "--project", `demo=${projectRoot}`, "--hermes-home", hermesHome];
  assert.equal(runInstaller(installArgs).status, 0);

  const dryRun = JSON.parse(runUninstallerStdout([
    "--target", "hermes", "--all", "--dry-run", "--hermes-home", hermesHome,
  ]));
  assert.equal(dryRun.target, "hermes");
  assert.equal(dryRun.mode, "remove-installation");
  assert.equal(dryRun.hook_entries_to_remove, 1);

  const uninstallOutput = JSON.parse(runUninstallerStdout([
    "--target", "hermes", "--all", "--hermes-home", hermesHome,
  ]));
  assert.equal(uninstallOutput.completed, true);
  assert.ok(uninstallOutput.config_backup, "backup path reported");

  const config = fs.readFileSync(configPath, "utf8");
  assert.ok(!config.includes("pre_llm_call"), "hook entry removed");
  assert.ok(config.includes("guard.sh"), "unrelated hook preserved");
  assert.ok(config.includes("model: gpt-5"), "model preserved");
  assert.ok(fs.existsSync(uninstallOutput.config_backup), "backup file exists");
  assert.ok(!fs.existsSync(path.join(hermesHome, "hooks", "agents-compact-reload")));
});

test("hermes uninstaller preserves foreign pre_llm_call entries", () => {
  const projectRoot = makeProject();
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-home-"));
  const installArgs = ["--target", "hermes", "--project", `demo=${projectRoot}`, "--hermes-home", hermesHome];
  assert.equal(runInstaller(installArgs).status, 0);

  const configPath = path.join(hermesHome, "config.yaml");
  const original = fs.readFileSync(configPath, "utf8");
  const withForeign = original.replace(
    "    - command:",
    "    - command: \"node\" \"C:/other/other-hook.mjs\"\n      timeout: 10\n    - command:",
  );
  fs.writeFileSync(configPath, withForeign, "utf8");

  const output = JSON.parse(runUninstallerStdout([
    "--target", "hermes", "--all", "--hermes-home", hermesHome,
  ]));
  assert.equal(output.completed, true);

  const config = fs.readFileSync(configPath, "utf8");
  assert.ok(config.includes("other-hook.mjs"), "foreign hook preserved");
  assert.ok(!config.includes("reload-agents.mjs"), "own hook removed");
});


test("hermes --plugin mode installs the zero-pin plugin without touching config.yaml", () => {
  const projectRoot = makeProject();
  // os.tmpdir() can return the Windows 8.3 short form (e.g. C:\Users\RUNNER~1\...)
  // while the installer canonicalizes --hermes-home through fs.realpathSync.native,
  // yielding the long form. Canonicalize the fixture the same way so the
  // comparison is between like representations on every host.
  const hermesHome = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-home-")));
  const args = ["--target", "hermes", "--plugin", "--project", `demo=${projectRoot}`, "--hermes-home", hermesHome];

  const dryRun = runInstaller([...args, "--dry-run"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const dryPlan = JSON.parse(dryRun.stdout);
  assert.equal(dryPlan.mode, "plugin");
  assert.equal(dryPlan.plugin_path, path.join(hermesHome, "plugins", "agents-compact-reload"));
  assert.ok(!fs.existsSync(path.join(hermesHome, "config.yaml")));
  assert.ok(!fs.existsSync(path.join(hermesHome, "hooks", "agents-compact-reload")));

  const install = runInstaller(args);
  assert.equal(install.status, 0, install.stderr);
  const pluginDirectory = path.join(hermesHome, "plugins", "agents-compact-reload");
  assert.ok(fs.existsSync(path.join(pluginDirectory, "__init__.py")));
  assert.ok(fs.existsSync(path.join(pluginDirectory, "plugin.yaml")));
  assert.ok(fs.existsSync(path.join(hermesHome, "hooks", "agents-compact-reload", "projects.json")));
  assert.ok(fs.existsSync(path.join(hermesHome, "hooks", "agents-compact-reload", "reload-agents.mjs")));
  // Plugin mode must not write a config.yaml hooks entry.
  assert.ok(!fs.existsSync(path.join(hermesHome, "config.yaml")));

  assert.equal(runInstaller(args).status, 0, "plugin reinstall idempotent");
});

function runUninstallerStdout(args) {
  const result = runUninstaller(args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("mergeHermesHooks preserves comments, unrelated sections, and exact bytes outside the hook block", () => {
  const entry = hermesHookEntry("C:/Node/node.exe", "C:/home/hooks/agents-compact-reload/reload-agents.mjs");
  const existing = [
    "# leading comment",
    "model: gpt-5",
    "hooks:",
    "  post_llm_call:",
    "    - command: audit.sh",
    "# trailing comment",
  ].join("\n");
  const merged = mergeHermesHooks(existing, entry);
  assert.ok(merged.includes("# leading comment"));
  assert.ok(merged.includes("post_llm_call:"));
  assert.ok(merged.includes("audit.sh"));
  assert.ok(merged.includes("# trailing comment"));
  assert.ok(merged.includes("  pre_llm_call:"));
  assert.ok(merged.includes("C:/Node/node.exe"));

  // Idempotent: merging again changes nothing.
  assert.equal(mergeHermesHooks(merged, entry), merged);
});

test("mergeHermesHooks fails closed on unsupported shapes instead of guessing", () => {
  const entry = hermesHookEntry("C:/Node/node.exe", "C:/home/hooks/agents-compact-reload/reload-agents.mjs");
  assert.throws(() => mergeHermesHooks("hooks: {}\n", entry), /inline `hooks:` value/);
});

test("removeHermesHookEntry drops an emptied pre_llm_call key and keeps CRLF line endings", () => {
  const hookPath = "C:/home/hooks/agents-compact-reload/reload-agents.mjs";
  const crlf = "model: gpt-5\r\nhooks:\r\n  pre_llm_call:\r\n    - command: \"node\" \"C:/home/hooks/agents-compact-reload/reload-agents.mjs\"\r\n      timeout: 15\r\n";
  const removed = removeHermesHookEntry(crlf, hookPath);
  assert.equal(removed.removedEntries, 1);
  assert.ok(!removed.text.includes("pre_llm_call"));
  assert.ok(removed.text.includes("model: gpt-5"));
  assert.ok(removed.text.includes("\r\n"), "CRLF line endings preserved");
});

test("hermes runtime hook injects AGENTS.md exactly when the last user row is a compaction handoff", async () => {
  const { buildHookOutput } = await import("../src/reload-agents.mjs");
  const contents = "# Hermes inject test\n";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-runtime-"));
  execFileSync("git", ["init", "--quiet", root]);
  fs.writeFileSync(path.join(root, "AGENTS.md"), contents, "utf8");
  const configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "agents-hermes-projects-")), "projects.json");
  fs.writeFileSync(configPath, JSON.stringify({ projects: [{ name: "demo", root }] }), "utf8");

  const base = {
    hook_event_name: "pre_llm_call",
    session_id: "test-session",
    cwd: root,
    extra: {
      user_message: "",
      conversation_history: [
        { role: "user", content: "earlier turn" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "summary row", _compressed_summary: true },
      ],
    },
  };

  const injected = buildHookOutput(base, { projectsPath: configPath });
  assert.ok(typeof injected.context === "string");
  assert.match(injected.context, /<project-agents-md>/);
  assert.match(injected.context, /Hermes inject test/);

  // A live user turn does NOT suppress injection: Hermes compacts at turn start,
  // so the immediate post-compaction turn normally carries one.
  const liveUser = structuredClone(base);
  liveUser.extra.user_message = "real follow-up";
  liveUser.extra.conversation_history = [
    { role: "user", content: "kept tail", _compressed_summary: true },
  ];
  assert.ok(
    typeof buildHookOutput({ ...liveUser, session_id: "live-a" }, { projectsPath: configPath, dedupeState: {} }).context === "string",
  );

  // Second turn with the SAME summary in the same session -> deduped no-op.
  assert.deepEqual(buildHookOutput(liveUser, { projectsPath: configPath, dedupeState: { "test-session:metadata": Date.now() } }), {});

  // Ordinary conversation without compaction signals: no-op.
  const ordinary = structuredClone(base);
  ordinary.extra.conversation_history = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi" },
    { role: "user", content: "a normal question" },
  ];
  assert.deepEqual(buildHookOutput(ordinary, { projectsPath: configPath, dedupeState: {} }), {});

  // Content-marker fallback (sanitizer/session-store round-trips drop "_" metadata):
  // summary prefix, continuation marker, fallback heading, and merged carrier all fire.
  const contentCases = [
    "[CONTEXT COMPACTION — REFERENCE ONLY] Earlier turns were compacted into the summary below.",
    "Continue from the compressed conversation context above. This marker exists because no human user turn was available.",
    "## Historical Task Snapshot\nUser asked: 'demo'",
    "kept task text\n\n[END OF PRIOR CONTEXT — COMPACTION SUMMARY BELOW]\n[CONTEXT COMPACTION — REFERENCE ONLY] summary",
  ];
  for (const content of contentCases) {
    const payload = structuredClone(base);
    payload.extra.conversation_history = [{ role: "user", content }];
    assert.ok(
      typeof buildHookOutput(payload, { projectsPath: configPath }).context === "string",
      `content-marker fallback should fire for: ${content.slice(0, 40)}`,
    );
  }

  // --format=hermes CLI mode: inject without a payload.
  const cli = buildHookOutput({}, { format: "hermes", cwd: root, projectsPath: configPath });
  assert.ok(typeof cli.context === "string");
});
