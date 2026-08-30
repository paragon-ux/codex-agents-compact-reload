import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildHookOutput } from "../src/reload-agents.mjs";

function makeGitProject(name, agentsText = "# Instructions\n\nRun the focused tests.\n") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  execFileSync("git", ["init", "--quiet", root]);
  fs.writeFileSync(path.join(root, "AGENTS.md"), agentsText, "utf8");
  return root;
}

function writeProjects(projects) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agents-projects-"));
  const configPath = path.join(directory, "projects.json");
  fs.writeFileSync(configPath, `${JSON.stringify({ projects }, null, 2)}\n`, "utf8");
  return configPath;
}

function compactPayload(cwd) {
  return {
    hook_event_name: "SessionStart",
    source: "compact",
    cwd,
    session_id: "test-session",
  };
}

test("injects the registered root AGENTS.md with its byte hash", () => {
  const contents = "# Project instructions\n\nPreserve user changes.\n";
  const root = makeGitProject("agents-reload", contents);
  const configPath = writeProjects([{ name: "demo", root }]);

  const output = buildHookOutput(compactPayload(root), { projectsPath: configPath });
  const context = output.hookSpecificOutput.additionalContext;
  const expectedHash = crypto.createHash("sha256").update(Buffer.from(contents)).digest("hex");

  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(context, /Project: demo/);
  assert.match(context, new RegExp(expectedHash));
  assert.match(context, /Preserve user changes\./);
});

test("supports a nested working directory inside the registered Git root", () => {
  const root = makeGitProject("agents-nested");
  const nested = path.join(root, "src", "feature");
  fs.mkdirSync(nested, { recursive: true });
  const configPath = writeProjects([{ name: "nested", root }]);

  const output = buildHookOutput(compactPayload(nested), { projectsPath: configPath });
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
});

test("does nothing outside registered projects", () => {
  const registered = makeGitProject("agents-registered");
  const outside = makeGitProject("agents-outside");
  const configPath = writeProjects([{ name: "registered", root: registered }]);

  assert.deepEqual(buildHookOutput(compactPayload(outside), { projectsPath: configPath }), {});
});

test("does nothing for events other than compact SessionStart", () => {
  const root = makeGitProject("agents-event");
  const configPath = writeProjects([{ name: "event", root }]);

  assert.deepEqual(buildHookOutput({ ...compactPayload(root), hook_event_name: "PostCompact" }, {
    projectsPath: configPath,
  }), {});
  assert.deepEqual(buildHookOutput({ ...compactPayload(root), source: "startup" }, {
    projectsPath: configPath,
  }), {});
});

test("fails closed when AGENTS.md is missing, empty, oversized, or invalid UTF-8", () => {
  const root = makeGitProject("agents-invalid");
  const agentsPath = path.join(root, "AGENTS.md");
  const configPath = writeProjects([{ name: "invalid", root }]);

  fs.unlinkSync(agentsPath);
  assert.throws(() => buildHookOutput(compactPayload(root), { projectsPath: configPath }), /missing/);

  fs.writeFileSync(agentsPath, "", "utf8");
  assert.throws(() => buildHookOutput(compactPayload(root), { projectsPath: configPath }), /empty/);

  fs.writeFileSync(agentsPath, "too large", "utf8");
  assert.throws(() => buildHookOutput(compactPayload(root), {
    projectsPath: configPath,
    maxBytes: 2,
  }), /exceeds/);

  fs.writeFileSync(agentsPath, Buffer.from([0xc3, 0x28]));
  assert.throws(() => buildHookOutput(compactPayload(root), { projectsPath: configPath }), /valid UTF-8/);
});

