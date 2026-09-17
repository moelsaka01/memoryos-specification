import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function text(relativePath) {
  return readFile(path.join(packageRoot, relativePath), "utf8");
}

async function json(relativePath) {
  return JSON.parse(await text(relativePath));
}

const expectedCommands = Object.freeze([
  Object.freeze({
    command: "memoryos.showContractIdentities",
    title: "Show Contract Identities",
    category: "MemoryOS",
  }),
  Object.freeze({
    command: "memoryos.preparePolicyArtifact",
    title: "Prepare Policy or Policy Set",
    category: "MemoryOS",
    enablement: "isWorkspaceTrusted",
  }),
  Object.freeze({
    command: "memoryos.evaluatePolicyArtifact",
    title: "Evaluate Policy or Policy Set",
    category: "MemoryOS",
    enablement: "isWorkspaceTrusted",
  }),
  Object.freeze({
    command: "memoryos.verifyEvaluationIdentity",
    title: "Verify Evaluation Identity",
    category: "MemoryOS",
    enablement: "isWorkspaceTrusted",
  }),
  Object.freeze({
    command: "memoryos.verifyPolicyOutcome",
    title: "Verify Policy Outcome",
    category: "MemoryOS",
    enablement: "isWorkspaceTrusted",
  }),
]);

const expectedRenderedTitles = Object.freeze([
  "MemoryOS: Show Contract Identities",
  "MemoryOS: Prepare Policy or Policy Set",
  "MemoryOS: Evaluate Policy or Policy Set",
  "MemoryOS: Verify Evaluation Identity",
  "MemoryOS: Verify Policy Outcome",
]);

const expectedAdapterCodes = Object.freeze([
  "MEMORYOS_VSCODE_CANCELLED",
  "MEMORYOS_VSCODE_WORKSPACE_UNTRUSTED",
  "MEMORYOS_VSCODE_OPERATION_IN_PROGRESS",
  "MEMORYOS_VSCODE_INPUT_REQUIRED",
  "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
  "MEMORYOS_VSCODE_INPUT_LIMIT_EXCEEDED",
  "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
  "MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH",
  "MEMORYOS_VSCODE_CONTRACT_IDENTITY_MISMATCH",
  "MEMORYOS_VSCODE_OUTPUT_INVALID",
  "MEMORYOS_VSCODE_WORKER_FAILED",
]);

test("manifest freezes the extension and host identities", async () => {
  const manifest = await json("package.json");
  assert.equal(manifest.name, "memoryos");
  assert.equal(manifest.publisher, "moelsaka01");
  assert.equal(manifest.displayName, "MemoryOS");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.publisher + "." + manifest.name, "moelsaka01.memoryos");
  assert.equal(manifest.engines.vscode, "^1.137.0");
  assert.equal(manifest.engines.node, ">=22");
  assert.deepEqual(manifest.extensionKind, ["workspace"]);
  assert.equal(manifest.main, "./out/extension.cjs");
  assert.equal(Object.hasOwn(manifest, "browser"), false);
});

test("manifest contributes exactly the five frozen public commands and labels", async () => {
  const manifest = await json("package.json");
  assert.deepEqual(manifest.contributes.commands, expectedCommands);
  assert.deepEqual(
    manifest.contributes.commands.map((command) => command.category + ": " + command.title),
    expectedRenderedTitles,
  );
  const publicIds = JSON.stringify(manifest).match(/memoryos\.[A-Za-z][A-Za-z0-9]*/gu) ?? [];
  assert.deepEqual([...new Set(publicIds)].sort(), expectedCommands.map(({ command }) => command).sort());
});

test("activation is contribution-driven and has no eager trigger", async () => {
  const manifest = await json("package.json");
  assert.equal(Object.hasOwn(manifest, "activationEvents"), false);
  assert.equal(Object.hasOwn(manifest.contributes, "languages"), false);
  assert.equal(Object.hasOwn(manifest.contributes, "configuration"), false);
});

test("Workspace Trust and virtual workspace capabilities are frozen", async () => {
  const manifest = await json("package.json");
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported, "limited");
  assert.deepEqual(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations, []);
  assert.equal(manifest.capabilities.virtualWorkspaces.supported, false);
  assert.equal(expectedCommands[0].enablement, undefined);
  for (const command of expectedCommands.slice(1)) {
    assert.equal(command.enablement, "isWorkspaceTrusted");
  }
});

test("all commands register lazily and trusted handlers enforce trust before Phase 2 input", async () => {
  const source = await text("src/commands.ts");
  const catalogIds = [...source.matchAll(/id: "(memoryos\.[A-Za-z][A-Za-z0-9]*)"/gu)]
    .map((match) => match[1]);
  assert.deepEqual(catalogIds, expectedCommands.map(({ command }) => command));
  assert.match(source, /vscode\.commands\.registerCommand\(command\.id/u);
  const trustCheck = source.indexOf("if (command.requiresWorkspaceTrust) enforceWorkspaceTrust(command.id)");
  const commandSwitch = source.indexOf("switch (command.id)");
  assert.ok(trustCheck >= 0 && trustCheck < commandSwitch);
  assert.match(source, /vscode\.workspace\.isTrusted/u);
  assert.match(source, /MEMORYOS_VSCODE_ADAPTER_ERROR_CODES\.WORKSPACE_UNTRUSTED/u);
  assert.match(source, /MEMORYOS_VSCODE_ADAPTER_ERROR_CODES\.INPUT_REQUIRED/u);
});

test("adapter error namespace is closed and CLI codes are preserved, not remapped", async () => {
  const source = await text("src/errors.ts");
  const declared = source.match(/"MEMORYOS_VSCODE_[A-Z_]+"/gu)?.map((value) => value.slice(1, -1)) ?? [];
  assert.deepEqual(declared, expectedAdapterCodes);
  assert.match(source, /return code;/u);
  assert.doesNotMatch(source, /COULD_NOT_EVALUATE/u);
  assert.doesNotMatch(source, /\bPASS\b|\bFAIL\b/u);
});

test("Phase 1 shell excludes prohibited product surfaces", async () => {
  const manifest = await json("package.json");
  const source = (await text("src/extension.ts")) + "\n" + (await text("src/commands.ts"));
  for (const key of [
    "configuration",
    "customEditors",
    "debuggers",
    "languages",
    "taskDefinitions",
    "views",
    "viewsContainers",
  ]) {
    assert.equal(Object.hasOwn(manifest.contributes, key), false, "unexpected contribution: " + key);
  }
  for (const forbidden of [
    "DiagnosticCollection",
    "WebviewPanel",
    "CustomEditor",
    "LanguageClient",
    "TaskProvider",
    "DocumentLinkProvider",
    "telemetry",
    "FileSystemWatcher",
    "createFileSystemWatcher",
  ]) {
    assert.equal(source.includes(forbidden), false, "unexpected shell API: " + forbidden);
  }
});

test("build and VSIX foundations retain only reviewed product members", async () => {
  const manifest = await json("package.json");
  const ignore = (await text(".vscodeignore")).trim().split(/\r?\n/u);
  const buildSource = await text("esbuild.mjs");
  assert.equal(Object.hasOwn(manifest, "files"), false, "VSCE cannot combine package files with .vscodeignore");
  assert.deepEqual(ignore, [
    "**",
    "!out/",
    "!out/extension.cjs",
    "!out/cli-worker.cjs",
    "!runtime/",
    "!runtime/runtime-closure-manifest.json",
    "!runtime/vendor/",
    "!runtime/vendor/**",
    "!contracts/",
    "!contracts/policy-contract-identities-1.0.0.json",
    "!package.json",
    "!README.md",
    "!CHANGELOG.md",
  ]);
  assert.match(buildSource, /external:\s*\["vscode"\]/u);
  assert.match(buildSource, /packages:\s*"external"/u);
  assert.match(buildSource, /minify:\s*false/u);
  assert.match(buildSource, /sourcemap:\s*false/u);
});

test("direct development dependencies are exactly pinned", async () => {
  const manifest = await json("package.json");
  assert.deepEqual(manifest.devDependencies, {
    "@types/node": "22.20.3",
    "@types/vscode": "1.137.0",
    esbuild: "0.28.2",
    typescript: "7.0.2",
  });
  for (const version of Object.values(manifest.devDependencies)) {
    assert.doesNotMatch(version, /^[~^]/u);
  }
});

test("lockfile v3 reproduces the exact direct dependency pins", async () => {
  const manifest = await json("package.json");
  const lockfile = await json("package-lock.json");
  assert.equal(lockfile.lockfileVersion, 3);
  assert.equal(lockfile.name, "memoryos");
  assert.equal(lockfile.version, "0.1.0");
  assert.deepEqual(lockfile.packages[""].devDependencies, manifest.devDependencies);
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    assert.equal(lockfile.packages["node_modules/" + name].version, version);
  }
});
