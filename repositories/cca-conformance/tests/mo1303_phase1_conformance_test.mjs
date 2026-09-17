import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

import {
  canonicalJson,
  conformanceRoot,
  extensionRoot,
  readJson,
  sha256,
  workspaceRoot,
} from "./support/mo1303-conformance-support.mjs";

const inventoryPath = resolve(conformanceRoot, "mo1303-conformance-inventory.json");
const packagePath = resolve(extensionRoot, "package.json");
const manifestPath = resolve(extensionRoot, "runtime/runtime-closure-manifest.json");
const receiptPath = resolve(
  extensionRoot,
  "measurements/runtime-closure-identity-receipt-1.0.0.json",
);
const contractPath = resolve(
  extensionRoot,
  "contracts/policy-contract-identities-1.0.0.json",
);

const inventory = await readJson(inventoryPath);
const extensionPackage = await readJson(packagePath);
const manifest = await readJson(manifestPath);
const receipt = await readJson(receiptPath);

const expectedCommands = [
  "memoryos.showContractIdentities",
  "memoryos.preparePolicyArtifact",
  "memoryos.evaluatePolicyArtifact",
  "memoryos.verifyEvaluationIdentity",
  "memoryos.verifyPolicyOutcome",
];

const expectedAdapterCodes = [
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
];

async function collectRuntimeMembers(directory) {
  const members = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    const metadata = await lstat(path);
    assert.equal(metadata.isSymbolicLink(), false, `${path} is a symbolic link`);
    if (metadata.isDirectory()) members.push(...await collectRuntimeMembers(path));
    else {
      assert.equal(metadata.isFile(), true, `${path} is not a regular file`);
      members.push(relative(resolve(extensionRoot, "runtime"), path).replaceAll("\\", "/"));
    }
  }
  return members;
}

test("MO-1303 inventory binds the frozen extension and predecessor contract", () => {
  assert.equal(inventory.kind, "MemoryOSMO1303ConformanceInventory");
  assert.equal(inventory.version, "1.0.0");
  assert.equal(inventory.baseline.mo1301Tag.name, "memoryos-1.3-mo1301");
  assert.equal(inventory.baseline.mo1302Tag.name, "memoryos-1.3-mo1302");
  assert.equal(inventory.baseline.immediateReleasedPredecessor, "memoryos-1.3-mo1302");
  assert.equal(inventory.extension.identifier, "moelsaka01.memoryos");
  assert.equal(inventory.extension.version, "0.1.0");
  assert.equal(inventory.extension.minimumVSCodeDesktopVersion, "1.137.0");
  assert.equal(inventory.extension.conformanceReferenceHostVersion, "1.137.0");
  assert.equal(inventory.extension.manifestCompatibility, "^1.137.0");
  assert.equal(extensionPackage.publisher, inventory.extension.publisher);
  assert.equal(extensionPackage.name, inventory.extension.name);
  assert.equal(extensionPackage.displayName, inventory.extension.displayName);
  assert.equal(extensionPackage.version, inventory.extension.version);
  assert.equal(extensionPackage.engines.vscode, inventory.extension.manifestCompatibility);
  assert.equal(inventory.futureMilestoneTag.name, "memoryos-1.3-mo1303");
});

test("manifest exposes exactly five commands and the frozen trust/activation surface", async () => {
  const commands = extensionPackage.contributes.commands;
  assert.deepEqual(commands.map(({ command }) => command), expectedCommands);
  assert.deepEqual(inventory.commands.map(({ id }) => id), expectedCommands);
  assert.equal(commands[0].enablement, undefined);
  for (const command of commands.slice(1)) assert.equal(command.enablement, "isWorkspaceTrusted");
  assert.equal(extensionPackage.capabilities.untrustedWorkspaces.supported, "limited");
  assert.equal(extensionPackage.capabilities.virtualWorkspaces.supported, false);
  assert.equal(extensionPackage.contributes.configuration, undefined);
  assert.equal(extensionPackage.activationEvents, undefined);
  assert.equal(extensionPackage.browser, undefined);
  assert.deepEqual(extensionPackage.extensionKind, ["workspace"]);
  assert.equal(Object.hasOwn(extensionPackage, "files"), false);
  assert.deepEqual((await readFile(resolve(extensionRoot, ".vscodeignore"), "utf8")).trim().split(/\r?\n/u), [
    "**", "!out/", "!out/extension.cjs", "!out/cli-worker.cjs",
    "!runtime/", "!runtime/runtime-closure-manifest.json", "!runtime/vendor/", "!runtime/vendor/**",
    "!contracts/", "!contracts/policy-contract-identities-1.0.0.json",
    "!package.json", "!README.md", "!CHANGELOG.md",
  ]);
});

test("adapter code catalog is closed and handler trust enforcement is present", async () => {
  assert.deepEqual(inventory.adapterErrorCodes, expectedAdapterCodes);
  const errorsSource = await readFile(resolve(extensionRoot, "src/errors.ts"), "utf8");
  const commandsSource = await readFile(resolve(extensionRoot, "src/commands.ts"), "utf8");
  const actualCodes = [...errorsSource.matchAll(/"(MEMORYOS_VSCODE_[A-Z_]+)"/gu)]
    .map((match) => match[1]);
  assert.deepEqual(actualCodes, expectedAdapterCodes);
  assert.match(commandsSource, /if \(command\.requiresWorkspaceTrust\) enforceWorkspaceTrust\(command\.id\)/u);
  assert.match(commandsSource, /vscode\.workspace\.isTrusted/u);
});

test("runtime closure inventory and identities reproduce from exact bytes", async () => {
  const receiptBytes = await readFile(receiptPath);
  assert.equal(receiptBytes.byteLength, inventory.runtimeClosure.receipt.byteLength);
  assert.equal(sha256(receiptBytes), inventory.runtimeClosure.receipt.rawSha256);
  assert.equal(manifest.kind, "MemoryOSVSCodeRuntimeClosureManifest");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.files.length, 37);
  assert.deepEqual(manifest.files.map(({ path }) => path),
    manifest.files.map(({ path }) => path).toSorted());
  assert.equal(new Set(manifest.files.map(({ path }) => path)).size, manifest.files.length);
  assert.deepEqual(
    (await collectRuntimeMembers(resolve(extensionRoot, "runtime/vendor"))).toSorted(),
    manifest.files.map(({ path }) => path),
  );

  for (const member of manifest.files) {
    assert.match(member.path, /^(?:vendor\/)[A-Za-z0-9._/-]+$/u);
    assert.ok(!member.path.split("/").includes(".."));
    const path = resolve(extensionRoot, "runtime", ...member.path.split("/"));
    const metadata = await lstat(path);
    assert.equal(metadata.isFile(), true, `${member.path} is not a regular file`);
    assert.equal(metadata.isSymbolicLink(), false, `${member.path} is a symbolic link`);
    const bytes = await readFile(path);
    assert.equal(bytes.byteLength, member.byteLength, `${member.path} byte length`);
    assert.equal(sha256(bytes), member.sha256, `${member.path} digest`);
  }

  const inventoryBytes = Buffer.from(canonicalJson(manifest.files), "utf8");
  assert.equal(sha256(inventoryBytes), manifest.inventoryDigest);
  assert.equal(manifest.inventoryDigest, receipt.inventoryDigest);
  assert.equal(receipt.entryCount, inventory.runtimeClosure.entryCount);
  assert.equal(receipt.inventoryDigest, inventory.runtimeClosure.inventoryDigest);
  assert.equal(receipt.manifestRawSha256, inventory.runtimeClosure.manifest.rawSha256);
  const canonicalManifestBytes = Buffer.from(canonicalJson(manifest), "utf8");
  const closureBytes = Buffer.concat([
    Buffer.from("MemoryOSVSCodeRuntimeClosureIdentity\0", "utf8"),
    canonicalManifestBytes,
  ]);
  assert.equal(sha256(closureBytes), receipt.runtimeClosureDigest);
  assert.equal(receipt.runtimeClosureDigest, inventory.runtimeClosure.runtimeClosureDigest);
  assert.equal(sha256(await readFile(manifestPath)), receipt.manifestRawSha256);
});

test("contract identity and bounded-output identities are exact and distinct", async () => {
  const contractBytes = await readFile(contractPath);
  assert.equal(contractBytes.byteLength, inventory.contractIdentityArtifact.byteLength);
  assert.equal(sha256(contractBytes), inventory.contractIdentityArtifact.rawSha256);
  assert.equal(inventory.boundedIO.stdoutBytes, 1_048_576);
  assert.equal(inventory.boundedIO.stderrBytes, 1_048_576);
  assert.notEqual(
    inventory.runtimeClosure.runtimeClosureDigest,
    inventory.contractIdentityArtifact.rawSha256,
  );
  assert.equal(inventory.distribution.vsixIdentity.status, "pendingPhase3");
  const lockBytes = await readFile(resolve(workspaceRoot, inventory.distribution.packageLock.path));
  const lock = JSON.parse(lockBytes.toString("utf8"));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lockBytes.byteLength, inventory.distribution.packageLock.byteLength);
  assert.equal(sha256(lockBytes), inventory.distribution.packageLock.rawSha256);
  assert.deepEqual(extensionPackage.devDependencies, inventory.distribution.directDevDependencies);
  for (const version of Object.values(extensionPackage.devDependencies)) {
    assert.match(version, /^[0-9]+\.[0-9]+\.[0-9]+$/u);
  }
});

test("transport limits are either explicitly pending measurement or fully evidenced", async () => {
  const limits = inventory.transportLimits;
  assert.equal(limits.normativeOutcomeLimitIdentifier, "evaluation.outcome-canonical-bytes");
  assert.equal(limits.normativeOutcomeCanonicalBytes, 4060);
  assert.equal(limits.normativeOutcomeLimitIsNotTransportLimit, true);
  if (limits.status === "pendingPhase1MeasurementCompletion") {
    assert.equal(limits.policyBytes, null);
    assert.equal(limits.policySetBytes, null);
    assert.equal(limits.mipBytes, null);
    return;
  }
  assert.equal(limits.status, "measured");
  assert.deepEqual({
    mip: limits.mipBytes,
    policy: limits.policyBytes,
    policySet: limits.policySetBytes,
  }, {
    mip: 524_288,
    policy: 2_048,
    policySet: 4_096,
  });
  for (const value of [limits.policyBytes, limits.policySetBytes, limits.mipBytes]) {
    assert.ok(Number.isSafeInteger(value) && value > 0);
  }
  for (const evidence of [
    limits.measurementCorpusInventory,
    limits.measurementResults,
    limits.selectionReceipt,
    limits.hostObservation,
  ]) {
    assert.equal(typeof evidence.path, "string");
    const path = resolve(workspaceRoot, evidence.path);
    assert.equal((await lstat(path)).isFile(), true);
    const bytes = await readFile(path);
    assert.equal(bytes.byteLength, evidence.byteLength);
    assert.equal(sha256(bytes), evidence.rawSha256);
  }
  const receipt = await readJson(resolve(workspaceRoot, limits.selectionReceipt.path));
  assert.deepEqual(receipt.finalLimits, {
    mip: limits.mipBytes,
    policy: limits.policyBytes,
    policySet: limits.policySetBytes,
  });
  const results = await readJson(resolve(workspaceRoot, limits.measurementResults.path));
  assert.equal(receipt.resultsSha256, sha256(canonicalJson(results)));
  const observation = await readJson(resolve(workspaceRoot, limits.hostObservation.path));
  assert.equal(observation.kind, "MemoryOSVSCodeTransportHostObservation");
  assert.equal(observation.selectedMipTransportLimitBytes, limits.mipBytes);
  assert.equal(observation.releasedRepresentativeMaximumValidMipBytes, limits.releasedValidMipMaximumBytes);
  assert.match(observation.note, /non-normative host observations/u);
});

test("Phase 1 keeps prohibited product and supply-chain surfaces absent", async () => {
  const packageText = await readFile(packagePath, "utf8");
  const sourceNames = ["src", "package.json", "esbuild.mjs"];
  const text = (await Promise.all(sourceNames.map(async (name) => {
    const path = resolve(extensionRoot, name);
    const metadata = await lstat(path);
    if (metadata.isFile()) return readFile(path, "utf8");
    const children = await readdir(path, { recursive: true, withFileTypes: true });
    return (await Promise.all(children.filter((child) => child.isFile())
      .map((child) => readFile(resolve(child.parentPath, child.name), "utf8")))).join("\n");
  }))).join("\n");
  assert.doesNotMatch(packageText, /contributes\.configuration/u);
  assert.doesNotMatch(text, /child_process|DiagnosticCollection|WebviewPanel|LanguageClient|TaskProvider|telemetry/u);
  assert.equal(inventory.distribution.runtimeNetworkAcquisition, false);
  assert.equal(inventory.distribution.runtimePackageInstall, false);
  assert.equal(inventory.distribution.externalSemanticExecutable, false);
});

test("Phase 1 file inventory names concrete regular files", async () => {
  for (const field of ["sources", "evidence", "tests", "registration", "documentation"]) {
    const paths = inventory.phase1Surface[field];
    assert.deepEqual(paths, paths.toSorted());
    assert.equal(new Set(paths).size, paths.length);
    for (const path of paths) {
      const metadata = await lstat(resolve(workspaceRoot, path));
      assert.equal(metadata.isFile(), true, `${path} is not a regular file`);
      assert.equal(metadata.isSymbolicLink(), false, `${path} is a symbolic link`);
    }
  }
});
