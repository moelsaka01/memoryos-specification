import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  loadCanonicalFile,
  validateHostAssertionCompleteness,
  validateHostedEvidence,
} from "../tools/mo1303-hosted-evidence.mjs";
import { validateJsonSchema } from "../tools/json-schema-validator.mjs";
import { SUITE_COMMANDS, SUITE_NAMES } from "../tools/mo1303-hosted-suite.mjs";
import {
  canonicalJson,
  conformanceRoot,
  extensionRoot,
  readJson,
  sha256,
  workspaceRoot,
} from "./support/mo1303-conformance-support.mjs";

const inventory = await readJson(resolve(conformanceRoot, "mo1303-conformance-inventory.json"));
const extensionPackage = await readJson(resolve(extensionRoot, "package.json"));
const receiptPath = resolve(
  workspaceRoot,
  "repositories/cca-conformance/evidence/mo1303-vsix-package-identity-0.1.0.json",
);
const receipt = await readJson(receiptPath);
const phase2Revision = "2919dd9056bc595bddde3d18f09f8efaaafb010b";
const phase1Revision = "6f99038fd5669ece2af4b1671a8e5f267822d2dd";
const phase3Revision = "92ab1e7b8fe64715b01e430a9c9079d41cc2f679";
const workflowCorrectionRevision = "e677dc70c0de3e70a557c4e30a425f9c897a9b88";
const certificationCorrectionRevision = "0c4f3327403987de4dac6e0016c72c36ee7e72f1";
const releaseCandidateRevision = "f856455e900c549bb2ec8e1d72f03fefec3be2e1";
const bindingPath = resolve(
  conformanceRoot,
  "evidence/mo1303-final-conformance-binding-run-35474897159.json",
);
const binding = await readJson(bindingPath);
const bindingSchema = new URL(
  "../schema/mo1303-final-conformance-binding-1.0.schema.json",
  import.meta.url,
);
const hostedEvidenceSchema = new URL(
  "../schema/mo1303-hosted-evidence-1.0.schema.json",
  import.meta.url,
);

const commands = [
  "memoryos.showContractIdentities",
  "memoryos.preparePolicyArtifact",
  "memoryos.evaluatePolicyArtifact",
  "memoryos.verifyEvaluationIdentity",
  "memoryos.verifyPolicyOutcome",
];

function git(...arguments_) {
  return execFileSync("git", arguments_, {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  }).trim();
}

function gitRaw(...arguments_) {
  return execFileSync("git", arguments_, {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  }).trimEnd();
}

function domainDigest(domain, bytes) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from([0]))
    .update(bytes)
    .digest("hex")}`;
}

function vector(decision) {
  const identityText = canonicalJson({ kind: "test-identity" });
  const identityDigest = domainDigest(
    "MEMORYOS-POLICY-EVALUATION-IDENTITY-1.0",
    Buffer.from(identityText, "utf8"),
  );
  const outcomeText = canonicalJson({
    evaluationIdentity: JSON.parse(identityText),
    evaluationIdentityDigest: identityDigest,
    result: { decision },
  });
  return {
    decision,
    evaluationIdentityDigest: identityDigest,
    outcomeDigest: domainDigest(
      "MEMORYOS-POLICY-EVALUATION-OUTCOME-1.0",
      Buffer.from(outcomeText, "utf8"),
    ),
    evaluationIdentityCanonicalBase64: Buffer.from(identityText, "utf8").toString("base64"),
    outcomeCanonicalBase64: Buffer.from(outcomeText, "utf8").toString("base64"),
    stableCodes: [],
  };
}

test("Phase 3 preserves the exact implementation and corrective revision chain", () => {
  assert.equal(git("rev-parse", `${phase2Revision}^`), phase1Revision);
  assert.equal(git("rev-parse", `${phase3Revision}^`), phase2Revision);
  assert.equal(git("rev-parse", `${workflowCorrectionRevision}^`), phase3Revision);
  assert.equal(
    git("rev-parse", `${certificationCorrectionRevision}^`),
    workflowCorrectionRevision,
  );
  assert.equal(
    git("rev-parse", `${releaseCandidateRevision}^`),
    certificationCorrectionRevision,
  );
  assert.equal(git("log", "-1", "--format=%s", phase2Revision),
    "feat(memoryos-1.3): MO-1303 phase 2 VS Code product UX");
  assert.equal(git("log", "-1", "--format=%s", phase3Revision),
    "feat(memoryos-1.3): MO-1303 phase 3 Extension Host and VSIX conformance");
  assert.equal(git("log", "-1", "--format=%s", workflowCorrectionRevision),
    "fix(memoryos-1.3): repair MO-1303 hosted certification workflow");
  assert.equal(git("log", "-1", "--format=%s", certificationCorrectionRevision),
    "fix(memoryos-1.3): close MO-1303 hosted certification defects");
  assert.equal(git("log", "-1", "--format=%s", releaseCandidateRevision),
    "fix(memoryos-1.3): close MO-1303 hosted portability defects");
  assert.deepEqual(inventory.historicalRevisions, {
    hostedCertificationCorrection: certificationCorrectionRevision,
    hostedPortabilityCorrectionReleaseCandidate: releaseCandidateRevision,
    hostedWorkflowCorrection: workflowCorrectionRevision,
    phase1: phase1Revision,
    phase2: phase2Revision,
    phase3Implementation: phase3Revision,
  });
  assert.equal(git("rev-parse", "memoryos-1.3-mo1302^{}"),
    "7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d");
  assert.equal(git("rev-parse", "memoryos-1.3-mo1301^{}"),
    "af6a405b3cd9097ce469b16a854a0568b8acee1f");
  const historicalLock = execFileSync(
    "git",
    ["show", `${phase2Revision}:repositories/memoryos-vscode/package-lock.json`],
    { cwd: workspaceRoot, encoding: null, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  );
  assert.equal(historicalLock.byteLength,
    inventory.distribution.historicalPhase1And2PackageLock.byteLength);
  assert.equal(sha256(historicalLock),
    inventory.distribution.historicalPhase1And2PackageLock.rawSha256);
});

test("Phase 3 freezes the exact host and supply-chain contract without expanding commands", async () => {
  assert.equal(inventory.phase, "finalConformanceClosureWithExternalInfrastructureException");
  assert.deepEqual(extensionPackage.contributes.commands.map(({ command }) => command), commands);
  assert.deepEqual(inventory.commands.map(({ id }) => id), commands);
  assert.deepEqual(extensionPackage.devDependencies, inventory.distribution.directDevDependencies);
  assert.deepEqual(extensionPackage.devDependencies, {
    "@types/node": "22.20.3",
    "@types/vscode": "1.137.0",
    "@vscode/test-electron": "3.1.0",
    "@vscode/vsce": "4.0.0",
    esbuild: "0.28.2",
    typescript: "7.0.2",
    yauzl: "3.4.0",
  });
  const lockBytes = await readFile(resolve(extensionRoot, "package-lock.json"));
  assert.equal(lockBytes.byteLength, inventory.distribution.packageLock.byteLength);
  assert.equal(sha256(lockBytes), inventory.distribution.packageLock.rawSha256);
  assert.equal(JSON.parse(lockBytes).lockfileVersion, 3);
  assert.equal(inventory.extension.conformanceReferenceHostVersion, "1.137.0");
  assert.equal(inventory.phase3Product.referenceHost.version, "1.137.0");
  assert.equal(inventory.phase3Product.referenceHost.acquisition, "exactVersionOfficialTestElectron");
});

test("the frozen VSIX receipt is canonical, closed, and independently identified", async () => {
  const receiptBytes = await readFile(receiptPath);
  assert.deepEqual(receipt, inventory.distribution.vsixIdentity.receipt);
  assert.equal(receiptBytes.byteLength, inventory.distribution.vsixIdentity.identityReceipt.byteLength);
  assert.equal(sha256(receiptBytes), inventory.distribution.vsixIdentity.identityReceipt.rawSha256);
  assert.equal(receiptBytes.toString("utf8"), `${canonicalJson(receipt)}\n`);
  assert.equal(receipt.extension.id, "moelsaka01.memoryos");
  assert.equal(receipt.extension.version, "0.1.0");
  assert.equal(receipt.vsix.sha256, inventory.distribution.vsixIdentity.sha256);
  assert.equal(receipt.vsix.byteLength, inventory.distribution.vsixIdentity.byteLength);
  assert.equal(receipt.packageInventory.entryCount, 46);
  assert.equal(receipt.packageInventory.entryCount,
    inventory.distribution.vsixIdentity.packageInventory.entryCount);
  assert.equal(receipt.packageInventory.digest,
    inventory.distribution.vsixIdentity.packageInventory.digest);
  assert.equal(
    sha256(Buffer.from(canonicalJson(receipt.packageInventory.files), "utf8")),
    receipt.packageInventory.digest,
  );
  assert.deepEqual(
    receipt.packageInventory.files.map(({ path }) => path),
    receipt.packageInventory.files.map(({ path }) => path).toSorted(),
  );
  assert.equal(new Set(receipt.packageInventory.files.map(({ path }) => path)).size, 46);
  for (const member of receipt.packageInventory.files) {
    assert.doesNotMatch(member.path,
      /(?:^|\/)(?:node_modules|tests?|test-host|scripts|measurements|\.git|\.vscode)(?:\/|$)|\.(?:map|ts)$/u);
  }
  assert.equal(receipt.runtimeClosure.entryCount, 37);
  assert.equal(receipt.runtimeClosure.inventoryDigest,
    "sha256:2aed4a65a3697345c3da71a4716565e2eb5275021db7628a09b2103c78203542");
  assert.equal(receipt.runtimeClosure.runtimeClosureDigest,
    "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3");
  assert.equal(receipt.contractIdentityArtifact.rawSha256,
    "sha256:d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65");
  assert.notEqual(receipt.vsix.sha256, receipt.runtimeClosure.runtimeClosureDigest);
  assert.notEqual(receipt.vsix.sha256, receipt.contractIdentityArtifact.rawSha256);
});

test("real-host sources form a bounded identity and require isolated development, restricted, and installed modes", async () => {
  const identity = inventory.phase3Product.extensionHostTestIdentity;
  assert.equal(identity.files.length, identity.entryCount);
  assert.deepEqual(identity.files.map(({ path }) => path),
    identity.files.map(({ path }) => path).toSorted());
  for (const member of identity.files) {
    const path = resolve(workspaceRoot, member.path);
    const metadata = await lstat(path);
    assert.equal(metadata.isFile(), true);
    assert.equal(metadata.isSymbolicLink(), false);
    const bytes = await readFile(path);
    assert.equal(bytes.byteLength, member.byteLength);
    assert.equal(sha256(bytes), member.rawSha256);
  }
  assert.equal(
    sha256(Buffer.from(canonicalJson(identity.files), "utf8")),
    identity.inventoryDigest,
  );
  assert.deepEqual(inventory.phase3Product.hostModes,
    ["development", "restricted", "installed"]);
  assert.equal(inventory.phase3Product.isolatedState, true);
  assert.equal(inventory.phase3Product.installedVsixRequired, true);
  assert.equal(inventory.phase3Product.offlineRuntimeRequired, true);
});

test("host receipt provenance is mode scoped and failed assertions remain rejected", async () => {
  const driver = await readFile(resolve(extensionRoot, "test-host/driver.mjs"), "utf8");
  assert.match(driver, /child\.once\("close", \(code, signal\) => \{/u);
  assert.doesNotMatch(driver, /child\.once\("exit",/u);
  assert.match(driver, /return withHostProfileCleanup\(stateRoot, async \(\) => \{/u);
  assert.match(
    driver,
    /\.\.\.\(developmentSource \? \{ developmentSource \} : \{ installedFromVsix \}\),/u,
  );
  assert.doesNotMatch(driver, /\n    developmentSource,\r?\n    installedFromVsix,/u);

  const common = {
    activation: true,
    contractIdentities: true,
    exactCommands: true,
    isolatedDirectories: true,
    resultsView: true,
    shutdownCleanup: true,
  };
  const trusted = {
    cancellation: true,
    realEditorInputs: true,
    semanticDecisions: true,
    verificationCommands: true,
    verificationVirtualDocuments: true,
    virtualDocuments: true,
  };
  const byMode = {
    development: { ...common, ...trusted, developmentSource: true },
    installed: { ...common, ...trusted, installedFromVsix: true },
    restricted: {
      ...common,
      installedFromVsix: true,
      restrictedPrecondition: true,
      restrictedRejections: true,
    },
  };
  for (const [mode, assertions] of Object.entries(byMode)) {
    assert.equal(validateHostAssertionCompleteness(assertions, mode), assertions);
    assert.equal(Object.values(assertions).every((value) => value === true), true);
  }
  assert.equal(Object.keys(byMode.development).length, 13);
  assert.equal(Object.hasOwn(byMode.development, "installedFromVsix"), false);
  assert.equal(Object.keys(byMode.installed).length, 13);
  assert.equal(Object.hasOwn(byMode.installed, "developmentSource"), false);
  assert.equal(Object.keys(byMode.restricted).length, 9);
  assert.equal(Object.hasOwn(byMode.restricted, "developmentSource"), false);

  assert.throws(() => validateHostAssertionCompleteness({
    ...byMode.development,
    installedFromVsix: false,
  }, "development"), /development assertions are incomplete or failed/u);
  assert.throws(() => validateHostAssertionCompleteness({
    ...byMode.installed,
    developmentSource: false,
  }, "installed"), /installed assertions are incomplete or failed/u);
  assert.throws(() => validateHostAssertionCompleteness({
    ...byMode.restricted,
    restrictedRejections: false,
  }, "restricted"), /restricted assertions are incomplete or failed/u);
  const { shutdownCleanup: _shutdownCleanup, ...incomplete } = byMode.development;
  assert.throws(() => validateHostAssertionCompleteness(incomplete, "development"),
    /development core host assertions are incomplete/u);
});

test("hosted workflow is manual, least privilege, immutable, complete, and bounded", async () => {
  const workflowPath = resolve(workspaceRoot, inventory.hostedCertification.workflow.path);
  const workflowBytes = await readFile(workflowPath);
  const workflow = workflowBytes.toString("utf8");
  assert.equal(workflowBytes.byteLength, inventory.hostedCertification.workflow.byteLength);
  assert.equal(sha256(workflowBytes), inventory.hostedCertification.workflow.rawSha256);
  for (const member of [
    inventory.hostedCertification.evidenceSchema,
    inventory.hostedCertification.evidenceTool,
    inventory.hostedCertification.suiteTool,
  ]) {
    const bytes = await readFile(resolve(workspaceRoot, member.path));
    assert.equal(bytes.byteLength, member.byteLength);
    assert.equal(sha256(bytes), member.rawSha256);
  }
  assert.equal(workflow.split(/\r?\n/u, 1)[0], "name: MemoryOS VS Code Certification");
  const workflowLines = workflow.split(/\r?\n/u);
  const jobEnvironmentBlocks = [];
  for (let index = 0; index < workflowLines.length; index += 1) {
    if (workflowLines[index] !== "    env:") continue;
    const environmentLines = [];
    for (index += 1; index < workflowLines.length; index += 1) {
      if (workflowLines[index] !== "" && !workflowLines[index].startsWith("      ")) break;
      environmentLines.push(workflowLines[index]);
    }
    index -= 1;
    jobEnvironmentBlocks.push(environmentLines.join("\n"));
  }
  assert.equal(jobEnvironmentBlocks.length, 2);
  for (const environmentBlock of jobEnvironmentBlocks) {
    assert.doesNotMatch(
      environmentBlock,
      /\$\{\{\s*runner(?:\.|\[)/u,
      "runner context is unavailable in jobs.<job_id>.env",
    );
  }
  const runnerPathInitialization = /^    steps:\r?\n      - name: Initialize runner-local certification paths\r?\n        shell: pwsh\r?\n        run: \|\r?\n          "MEMORYOS_VSCODE_TEST_CACHE=\$\{\{ runner\.temp \}\}\/memoryos-vscode-1\.137\.0" >> \$env:GITHUB_ENV\r?\n          "CERT_ARTIFACT_STAGE=\$\{\{ runner\.temp \}\}\/mo1303-certification-artifact" >> \$env:GITHUB_ENV\r?$/mu;
  assert.match(workflow, runnerPathInitialization);
  assert.equal(workflow.match(/\$\{\{\s*runner\.temp\s*\}\}/gu)?.length, 2);
  const initializationIndex = workflow.indexOf("      - name: Initialize runner-local certification paths");
  const acquisitionIndex = workflow.indexOf("      - name: Acquire exact VS Code Desktop 1.137.0");
  const stagingIndex = workflow.indexOf("      - name: Generate and validate platform evidence");
  const uploadIndex = workflow.indexOf("      - name: Upload bounded certification evidence");
  assert.ok(initializationIndex >= 0 && initializationIndex < acquisitionIndex);
  assert.ok(initializationIndex < stagingIndex && stagingIndex < uploadIndex);
  assert.equal(workflow.match(/--output-root \$env:CERT_ARTIFACT_STAGE\b/gu)?.length, 1);
  assert.equal(workflow.match(/path: \$\{\{ env\.CERT_ARTIFACT_STAGE \}\}/gu)?.length, 1);
  assert.deepEqual(
    [...workflow.matchAll(/^          - platform: ([^\r\n]+)\r?\n            runner: ([^\r\n]+)\r?$/gmu)]
      .map(([, platform, runner]) => ({ platform, runner })),
    [
      { platform: "ubuntu-24.04", runner: "ubuntu-24.04" },
      { platform: "windows-2022", runner: "windows-2022" },
      { platform: "macos-14", runner: "macos-14-large" },
    ],
  );
  assert.equal(workflow.match(/^      fail-fast: false\r?$/gmu)?.length, 1);
  assert.match(
    workflow,
    /^  parity:\r?\n    name: Three-platform evidence and byte parity\r?\n    needs: certify\r?$/mu,
  );
  assert.deepEqual(
    [...workflow.matchAll(/^          name: (mo1303-(?:ubuntu-24\.04|windows-2022|macos-14)-x64)\r?$/gmu)]
      .map(([, artifactName]) => artifactName),
    [
      "mo1303-ubuntu-24.04-x64",
      "mo1303-windows-2022-x64",
      "mo1303-macos-14-x64",
    ],
  );
  assert.match(workflow, /^permissions:\r?\n  contents: read\r?$/mu);
  assert.equal(workflow.match(/^          persist-credentials: false\r?$/gmu)?.length, 2);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /pull_request_target|self-hosted|continue-on-error|secrets\./u);
  assert.match(workflow, /fail-fast: false/u);
  assert.match(workflow, /runner: ubuntu-24\.04/u);
  assert.match(workflow, /runner: windows-2022/u);
  assert.match(workflow, /runner: macos-14-large/u);
  assert.match(workflow, /retention-days: 14/u);
  const uses = [...workflow.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s]+)\s*$/gmu)];
  assert.ok(uses.length >= 4);
  for (const [, name, revision] of uses) {
    assert.match(revision, /^[0-9a-f]{40}$/u, `${name} is not immutable`);
    assert.equal(inventory.hostedCertification.actionPins[name], revision);
  }
  assert.deepEqual(SUITE_COMMANDS, {
    npmCi: [{ cwd: "repositories/memoryos-vscode", argv: ["npm", "ci", "--ignore-scripts"] }],
    typecheck: [{ cwd: "repositories/memoryos-vscode", argv: ["npm", "run", "typecheck"] }],
    productionBuild: [{ cwd: "repositories/memoryos-vscode", argv: ["npm", "run", "build"] }],
    mockTests: [{ cwd: "repositories/memoryos-vscode", argv: ["npm", "test"] }],
    phase1Conformance: [{ cwd: "repositories/cca-conformance", argv: ["npm", "run", "test:mo1303-phase1"] }],
    phase2Conformance: [{ cwd: "repositories/cca-conformance", argv: ["npm", "run", "test:mo1303-phase2"] }],
    phase3Conformance: [{ cwd: "repositories/cca-conformance", argv: ["npm", "run", "test:mo1303-phase3"] }],
    packageValidation: [
      { cwd: "repositories/memoryos-vscode", argv: ["npm", "run", "package:vsix"] },
      { cwd: "repositories/memoryos-vscode", argv: ["npm", "run", "verify:vsix"] },
      { cwd: "repositories/memoryos-vscode", argv: ["npm", "run", "test:package"] },
    ],
    mo1301Regression: [{ cwd: "repositories/cca-conformance", argv: ["npm", "run", "test:mo1301"] }],
    mo1302Phase1Regression: [{ cwd: "repositories/cca-conformance", argv: ["npm", "run", "test:mo1302-phase1"] }],
    mo1302Phase2Regression: [{ cwd: "repositories/cca-conformance", argv: ["npm", "run", "test:mo1302-phase2"] }],
    mo1302Phase3Regression: [{ cwd: "repositories/cca-conformance", argv: ["npm", "run", "test:mo1302-phase3"] }],
    policyPhase1Regression: [{ cwd: "repositories/cca-studio", argv: ["npm", "run", "test:policy-phase1"] }],
    policyPhase2Regression: [{ cwd: "repositories/cca-studio", argv: ["npm", "run", "test:policy-phase2"] }],
    policyPhase3Regression: [{ cwd: "repositories/cca-studio", argv: ["npm", "run", "test:policy-phase3"] }],
    policyPhase4Regression: [{ cwd: "repositories/cca-studio", argv: ["npm", "run", "test:policy-phase4"] }],
    cliRegression: [{ cwd: "repositories/memoryos-cli", argv: ["npm", "test"] }],
    workspaceVerification: [{ cwd: ".", argv: ["python", "tools/verify_workspace.py", "--root", "."] }],
  });
  for (const suite of SUITE_NAMES) {
    assert.equal(workflow.match(new RegExp(`--suite ${suite}(?:\\s|$)`, "gu"))?.length, 1,
      `hosted workflow must execute ${suite} exactly once`);
  }
  for (const required of [
    "npm run test:host:acquire",
    "npm run build:test-host",
    "npm run test:host:offline",
    "stage-upload",
    "compare-platforms",
  ]) assert.ok(workflow.includes(required), `hosted workflow lacks ${required}`);
  assert.equal(workflow.match(/NPM_CONFIG_IGNORE_SCRIPTS: "true"/gu)?.length, 2,
    "both hosted jobs must disable dependency lifecycle scripts");
  assert.match(workflow, /run: npm ci --ignore-scripts/u,
    "parity dependency installation must explicitly disable lifecycle scripts");
});

test("hosted evidence validator binds canonical bytes and rejects external-identity mismatches", () => {
  const suites = Object.fromEntries([
    "npmCi", "typecheck", "productionBuild", "mockTests", "phase1Conformance",
    "phase2Conformance", "phase3Conformance", "extensionHost", "installedVsix",
    "restrictedWorkspace", "cancellation", "offlineSmoke", "packageValidation",
    "mo1301Regression", "mo1302Phase1Regression", "mo1302Phase2Regression",
    "mo1302Phase3Regression", "policyPhase1Regression", "policyPhase2Regression",
    "policyPhase3Regression", "policyPhase4Regression", "cliRegression",
    "workspaceVerification",
  ].map((name) => [name, {
    identity: "sha256:" + "9".repeat(64),
    ...(SUITE_NAMES.includes(name) ? {
      receiptByteLength: 1,
      receiptSha256: "sha256:" + "7".repeat(64),
    } : {}),
    result: "PASS",
  }]));
  const contractText = canonicalJson({ kind: "test-contract-identities" });
  const passVector = vector("PASS");
  const evidence = {
    kind: "MemoryOSMO1303HostedEvidence",
    version: "1.0.0",
    platform: { identifier: "ubuntu-24.04", runnerImage: "ubuntu-24.04", os: "Linux", arch: "X64" },
    implementationRevision: "a".repeat(40),
    vscodeVersion: "1.137.0",
    extension: { identifier: "moelsaka01.memoryos", version: "0.1.0" },
    vsix: {
      fileName: "memoryos-0.1.0.vsix",
      byteLength: receipt.vsix.byteLength,
      sha256: receipt.vsix.sha256,
      internalFileCount: receipt.packageInventory.entryCount,
      inventoryDigest: receipt.packageInventory.digest,
    },
    runtimeClosure: {
      entryCount: 37,
      inventoryDigest: receipt.runtimeClosure.inventoryDigest,
      closureDigest: receipt.runtimeClosure.runtimeClosureDigest,
    },
    contractIdentityArtifact: { sha256: receipt.contractIdentityArtifact.rawSha256 },
    contractIdentities: {
      canonicalBase64: Buffer.from(contractText, "utf8").toString("base64"),
      rawSha256: sha256(Buffer.from(contractText, "utf8")),
      contractArtifactSha256: receipt.contractIdentityArtifact.rawSha256,
      runtimeClosureDigest: receipt.runtimeClosure.runtimeClosureDigest,
    },
    hostReceipts: Object.fromEntries(["development", "restricted", "installed"].map(
      (mode) => [mode, { byteLength: 1, sha256: "sha256:" + "8".repeat(64) }],
    )),
    suites,
    preparation: {
      policy: { documentDigest: "sha256:" + "1".repeat(64), semanticDigest: "sha256:" + "2".repeat(64) },
      policySet: { documentDigest: "sha256:" + "3".repeat(64), semanticDigest: "sha256:" + "4".repeat(64) },
    },
    vectors: {
      pass: passVector,
      fail: vector("FAIL"),
      cne: vector("COULD_NOT_EVALUATE"),
    },
    verification: {
      evaluationIdentity: {
        canonicalBase64: passVector.evaluationIdentityCanonicalBase64,
        evaluationIdentityDigest: passVector.evaluationIdentityDigest,
        mode: "evaluation",
        sourceFilename: "verified-evaluation-identity.json",
        state: "Verified",
        target: "evaluationIdentity",
        verificationScope: "authoritativeReconstruction",
        virtualDocumentExactBytes: true,
      },
      policyOutcome: {
        canonicalBase64: passVector.outcomeCanonicalBase64,
        decision: "PASS",
        evaluationIdentityDigest: passVector.evaluationIdentityDigest,
        mode: "artifact",
        outcomeDigest: passVector.outcomeDigest,
        sourceFilename: "verified-policy-outcome.json",
        state: "Verified",
        target: "policyOutcome",
        verificationScope: "serializedArtifact",
        virtualDocumentExactBytes: true,
      },
    },
    offline: { networkRequired: false, result: "PASS" },
  };
  const expected = {
    platform: "ubuntu-24.04",
    revision: evidence.implementationRevision,
    vsixSha256: receipt.vsix.sha256,
  };
  assert.equal(validateHostedEvidence(evidence, expected), evidence);
  assert.throws(() => validateHostedEvidence({
    ...evidence,
    vectors: {
      ...evidence.vectors,
      pass: { ...evidence.vectors.pass, outcomeDigest: "sha256:" + "0".repeat(64) },
    },
  }, expected), /not bound to its canonical bytes/u);
  assert.throws(() => validateHostedEvidence(evidence, {
    ...expected,
    revision: "b".repeat(40),
  }), /implementation revision differs/u);
  const { receiptByteLength: _receiptByteLength, ...unboundSuite } = evidence.suites.npmCi;
  assert.throws(() => validateHostedEvidence({
    ...evidence,
    suites: { ...evidence.suites, npmCi: unboundSuite },
  }, expected), /open or incomplete key set/u);
  assert.throws(() => validateHostedEvidence({
    ...evidence,
    releaseStatus: "releasedWithExternalInfrastructureException",
  }, expected), /open or incomplete key set/u);
  assert.throws(() => validateHostedEvidence({
    ...evidence,
    platform: { ...evidence.platform, runnerImage: "windows-2022", os: "Windows" },
  }, expected), /runner image differs/u);
});

test("hosted evidence loader enforces canonical JSON with exactly one trailing LF", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "memoryos-mo1303-canonical-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const validPath = join(directory, "valid.json");
  await writeFile(validPath, '{"a":1,"b":2}\n', "utf8");
  const loaded = await loadCanonicalFile(validPath, 1024, "test artifact");
  assert.deepEqual(loaded.value, { a: 1, b: 2 });

  const invalid = new Map([
    ["crlf", '{"a":1,"b":2}\r\n'],
    ["missing-lf", '{"a":1,"b":2}'],
    ["extra-lf", '{"a":1,"b":2}\n\n'],
    ["pretty", '{\n  "a": 1,\n  "b": 2\n}\n'],
    ["reordered", '{"b":2,"a":1}\n'],
  ]);
  for (const [name, contents] of invalid) {
    const path = join(directory, `${name}.json`);
    await writeFile(path, contents, "utf8");
    await assert.rejects(
      loadCanonicalFile(path, 1024, `${name} artifact`),
      /is not canonical JSON with exactly one trailing LF\./u,
    );
  }
});

test("final binding is canonical, schema-valid, and encodes the exact external exception", async () => {
  const bindingBytes = await readFile(bindingPath);
  const schemaBytes = await readFile(resolve(
    workspaceRoot,
    inventory.releaseClosure.bindingSchema.path,
  ));
  assert.equal(bindingBytes.byteLength, inventory.releaseClosure.bindingArtifact.byteLength);
  assert.equal(sha256(bindingBytes), inventory.releaseClosure.bindingArtifact.rawSha256);
  assert.equal(schemaBytes.byteLength, inventory.releaseClosure.bindingSchema.byteLength);
  assert.equal(sha256(schemaBytes), inventory.releaseClosure.bindingSchema.rawSha256);
  assert.equal(bindingBytes.toString("utf8"), `${canonicalJson(binding)}\n`);
  await validateJsonSchema(binding, bindingSchema);

  assert.equal(binding.kind, "MemoryOSMO1303FinalConformanceBinding");
  assert.equal(binding.version, "1.0.0");
  assert.equal(binding.implementationStatus, "complete");
  assert.equal(binding.implementationRevision, releaseCandidateRevision);
  assert.equal(binding.releaseStatus, "releasedWithExternalInfrastructureException");
  assert.equal(binding.hostedCertificationStatus, "partial");
  assert.equal(binding.macosStatus, "notExecutedExternalInfrastructure");
  assert.equal(binding.crossPlatformParityStatus, "notExecuted");
  assert.deepEqual(binding.localCertification, {
    modes: {
      development: "PASS",
      installed: "PASS",
      restricted: "PASS",
    },
    result: "PASS",
    vscodeVersion: "1.137.0",
  });
  assert.deepEqual(binding.productIdentities, {
    contractIdentity: {
      artifactByteLength: 933,
      artifactRawSha256:
        "sha256:d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65",
      canonicalSha256:
        "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7",
    },
    extension: {
      identifier: "moelsaka01.memoryos",
      version: "0.1.0",
    },
    runtime: {
      closureDigest:
        "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3",
      entryCount: 37,
      inventoryDigest:
        "sha256:2aed4a65a3697345c3da71a4716565e2eb5275021db7628a09b2103c78203542",
    },
    transportLimits: {
      mipBytes: 524288,
      policyBytes: 2048,
      policySetBytes: 4096,
    },
    vsix: {
      byteLength: 200154,
      inventoryDigest:
        "sha256:e3664d848974546facdb011ea6d4fa8459f931f854a00641fc7a2290066c388b",
      sha256: "sha256:f5cd33f9cb73fe5ef5cd960c685d0598b0ae31156ae7e9afd4c09c555943c8ae",
    },
  });
  assert.deepEqual(binding.predecessors, {
    mo1301: {
      peeledCommit: "af6a405b3cd9097ce469b16a854a0568b8acee1f",
      tag: "memoryos-1.3-mo1301",
    },
    mo1302: {
      distributionFileCount: 42,
      distributionManifestRawSha256:
        "sha256:2e116b6518934c797e9c562670f2292462be11ee982c778b43f1aaf45a8986f9",
      peeledCommit: "7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d",
      tag: "memoryos-1.3-mo1302",
    },
  });
  assert.equal(binding.marketplacePublicationStatus, "notPublished");
  assert.deepEqual(binding.tag, {
    name: "memoryos-1.3-mo1303",
    status: "pendingManualReleaseTagReview",
  });
});

test("run 5 retains two distinct validated platform records and no macOS evidence", async () => {
  assert.equal(binding.hostedRun.id, 35474897159);
  assert.equal(binding.hostedRun.number, 5);
  assert.equal(binding.hostedRun.revision, releaseCandidateRevision);
  assert.equal(binding.hostedRun.workflow, "MemoryOS VS Code Certification");
  assert.equal(binding.hostedRun.overallConclusion, "failure");
  assert.equal(
    binding.hostedRun.strictArtifactValidator,
    "repositories/cca-conformance/tools/mo1303-hosted-evidence.mjs",
  );

  const expected = {
    "ubuntu-24.04": {
      artifact: {
        archiveByteLength: 223785,
        archiveSha256:
          "sha256:883c9d7b84e10dc6f3bc1c40318cf459a6b37f745178ab65c3eec6adc3daa466",
        id: 10594008935,
        name: "mo1303-ubuntu-24.04-x64",
      },
      evidence: {
        byteLength: 25693,
        kind: "MemoryOSMO1303HostedEvidence",
        path:
          "repositories/cca-conformance/evidence/mo1303-hosted-evidence-run-35474897159-ubuntu-24.04-x64.json",
        rawSha256:
          "sha256:1bfa211ba433774262ca01fc18f9eb36cb538cecdc9fb3ac1cbde51bffd60410",
        version: "1.0.0",
      },
      jobId: 105982352744,
    },
    "windows-2022": {
      artifact: {
        archiveByteLength: 223842,
        archiveSha256:
          "sha256:b0122c4d956e17c472e9c2d4cdff40491bb0fccb373ba680a492e167c64e1477",
        id: 10593313185,
        name: "mo1303-windows-2022-x64",
      },
      evidence: {
        byteLength: 25695,
        kind: "MemoryOSMO1303HostedEvidence",
        path:
          "repositories/cca-conformance/evidence/mo1303-hosted-evidence-run-35474897159-windows-2022-x64.json",
        rawSha256:
          "sha256:8276d74264c5af198e350c1278acc7ca272a7c7a314f97520dc144b9b0beb6ba",
        version: "1.0.0",
      },
      jobId: 105982352719,
    },
  };
  const verifiedRecords = [];
  for (const platform of ["ubuntu-24.04", "windows-2022"]) {
    const record = binding.hostedRun.platforms[platform];
    assert.equal(record.platform, platform);
    assert.equal(record.revision, releaseCandidateRevision);
    assert.equal(record.runnerExecutionStarted, true);
    assert.equal(record.workflowConclusion, "success");
    assert.equal(record.status, "PASS");
    assert.equal(record.validationResult, "PASS");
    assert.equal(record.jobId, expected[platform].jobId);
    assert.deepEqual(record.artifact, expected[platform].artifact);
    assert.deepEqual(record.evidence, expected[platform].evidence);
    const bytes = await readFile(resolve(workspaceRoot, record.evidence.path));
    assert.equal(bytes.byteLength, record.evidence.byteLength);
    assert.equal(sha256(bytes), record.evidence.rawSha256);
    const evidence = JSON.parse(bytes.toString("utf8"));
    assert.equal(bytes.toString("utf8"), `${canonicalJson(evidence)}\n`);
    await validateJsonSchema(evidence, hostedEvidenceSchema);
    assert.equal(validateHostedEvidence(evidence, {
      platform,
      revision: releaseCandidateRevision,
      vsixSha256: receipt.vsix.sha256,
    }), evidence);
    verifiedRecords.push(record);
  }
  assert.equal(verifiedRecords.length, 2);
  assert.equal(new Set(verifiedRecords.map(({ jobId }) => jobId)).size, 2);
  assert.equal(new Set(verifiedRecords.map(({ artifact }) => artifact.id)).size, 2);
  assert.equal(new Set(verifiedRecords.map(({ artifact }) => artifact.archiveSha256)).size, 2);
  assert.equal(new Set(verifiedRecords.map(({ evidence }) => evidence.rawSha256)).size, 2);

  const macos = binding.hostedRun.platforms["macos-14"];
  assert.equal(macos.jobId, 105982352780);
  assert.equal(macos.revision, releaseCandidateRevision);
  assert.equal(macos.runnerExecutionStarted, false);
  assert.equal(macos.workflowConclusion, "failure");
  assert.equal(macos.status, "notExecutedExternalInfrastructure");
  assert.equal(macos.validationResult, "notExecuted");
  assert.equal(macos.artifact, null);
  assert.equal(macos.evidence, null);
  assert.equal(
    macos.externalBlock,
    "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings",
  );
  assert.deepEqual(binding.crossPlatformParity, {
    certified: false,
    evidence: null,
    jobId: 105982801819,
    reason: "certifyDependencyDidNotSucceedBecauseMacosDidNotExecute",
    status: "notExecuted",
    workflowConclusion: "skipped",
  });
  assert.deepEqual(binding.releaseException, {
    authority: "projectOwner",
    decision: "releaseWithoutWaitingForMacosHostedExecution",
    fullHostedCertification: false,
    futureMacosEvidenceMayCloseGapWithoutRewritingHistoricalEvidence: true,
    kind: "externalInfrastructure",
    macosCertified: false,
    strictThreePlatformValidatorPreserved: true,
    threePlatformParityCertified: false,
    threeValidHostedPlatformEvidenceRecords: false,
    twoOfThreeEquivalentToThreeOfThree: false,
    verifiedHostedPlatformEvidenceRecordCount: 2,
  });
});

test("binding schema rejects every prohibited full-certification claim", async () => {
  const mutations = [
    (value) => { value.hostedRun.platforms["macos-14"].status = "PASS"; },
    (value) => { value.hostedRun.platforms["macos-14"].evidence = structuredClone(
      value.hostedRun.platforms["ubuntu-24.04"].evidence,
    ); },
    (value) => { value.crossPlatformParity.status = "PASS"; },
    (value) => { value.hostedCertificationStatus = "complete"; },
    (value) => { value.releaseException.fullHostedCertification = true; },
    (value) => { value.releaseException.threeValidHostedPlatformEvidenceRecords = true; },
    (value) => { value.releaseException.verifiedHostedPlatformEvidenceRecordCount = 3; },
    (value) => {
      value.hostedRun.platforms["fabricated-third-platform"] = structuredClone(
        value.hostedRun.platforms["ubuntu-24.04"],
      );
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(binding);
    mutate(changed);
    await assert.rejects(
      validateJsonSchema(changed, bindingSchema),
      undefined,
      `prohibited binding mutation ${index}`,
    );
  }
});

test("strict full-certification validator still rejects two-of-three evidence", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "memoryos-mo1303-two-of-three-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  await mkdir(join(directory, "mo1303-ubuntu-24.04-x64"));
  await mkdir(join(directory, "mo1303-windows-2022-x64"));
  const result = spawnSync(process.execPath, [
    resolve(conformanceRoot, "tools/mo1303-hosted-evidence.mjs"),
    "compare-platforms",
    "--root",
    directory,
    "--expected-revision",
    releaseCandidateRevision,
    "--expected-vsix-sha256",
    receipt.vsix.sha256,
  ], {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /cross-platform artifact root must contain exactly the three platform directories/u,
  );
});

test("inventory binds the release candidate, partial hosted state, and manual tag review", () => {
  assert.equal(inventory.hostedCertification.status, "partial");
  assert.deepEqual(inventory.hostedCertification.run, {
    id: 35474897159,
    number: 5,
    revision: releaseCandidateRevision,
  });
  assert.deepEqual(inventory.hostedCertification.platforms, {
    "macos-14": "notExecutedExternalInfrastructure",
    "ubuntu-24.04": "PASS",
    "windows-2022": "PASS",
  });
  assert.equal(inventory.hostedCertification.crossPlatformParity, "notExecuted");
  assert.equal(inventory.hostedCertification.offlineCertification, "partial");
  assert.deepEqual(inventory.phase3CommitBinding, {
    strategy: "laterConformanceBindingCommit",
    status: "bound",
    revision: phase3Revision,
  });
  assert.deepEqual(inventory.finalConformanceBinding, {
    strategy: "postHostedConformanceBindingCommit",
    status: "bound",
    revision: releaseCandidateRevision,
  });
  assert.deepEqual(inventory.releaseClosure, {
    bindingArtifact: {
      byteLength: 5156,
      path:
        "repositories/cca-conformance/evidence/mo1303-final-conformance-binding-run-35474897159.json",
      rawSha256:
        "sha256:db739f32c55fa8ce1089c83c680f43cd0e4b5fa1a80d5973f7b474ae2790f8fb",
    },
    bindingSchema: {
      byteLength: 13506,
      path:
        "repositories/cca-conformance/schema/mo1303-final-conformance-binding-1.0.schema.json",
      rawSha256:
        "sha256:6cb376eca1eb93d672e061c1f89f5fecb2ac84112484601ed890cf186307d5e5",
    },
    crossPlatformParityStatus: "notExecuted",
    hostedCertificationStatus: "partial",
    macosStatus: "notExecutedExternalInfrastructure",
    releaseStatus: "releasedWithExternalInfrastructureException",
  });
  assert.equal(inventory.futureMilestoneTag.status, "pendingManualReleaseTagReview");
});

test("Phase 3 inventory names only sorted concrete files", async () => {
  for (const field of ["sources", "tests", "registration", "documentation", "evidence"]) {
    const paths = inventory.phase3Surface[field];
    assert.deepEqual(paths, paths.toSorted());
    assert.equal(new Set(paths).size, paths.length);
    for (const path of paths) {
      const metadata = await lstat(resolve(workspaceRoot, path));
      assert.equal(metadata.isFile(), true, `${path} is not a regular file`);
      assert.equal(metadata.isSymbolicLink(), false, `${path} is a symbolic link`);
    }
  }
});

test("final conformance surface is closed and the binding commit scope is exact", async () => {
  const expectedSurface = {
    evidence: [
      "repositories/cca-conformance/evidence/mo1303-final-conformance-binding-run-35474897159.json",
      "repositories/cca-conformance/evidence/mo1303-hosted-evidence-run-35474897159-ubuntu-24.04-x64.json",
      "repositories/cca-conformance/evidence/mo1303-hosted-evidence-run-35474897159-windows-2022-x64.json",
    ],
    inventory: [
      "repositories/cca-conformance/mo1303-conformance-inventory.json",
    ],
    registration: [
      "repositories/cca-conformance/CMakeLists.txt",
      "tools/verify_workspace.py",
    ],
    schema: [
      "repositories/cca-conformance/schema/mo1303-final-conformance-binding-1.0.schema.json",
    ],
    tests: [
      "repositories/cca-conformance/tests/mo1303_phase2_conformance_test.mjs",
      "repositories/cca-conformance/tests/mo1303_phase3_conformance_test.mjs",
    ],
  };
  assert.deepEqual(inventory.finalConformanceSurface, expectedSurface);
  const expectedPaths = [];
  for (const field of ["evidence", "inventory", "registration", "schema", "tests"]) {
    const paths = expectedSurface[field];
    assert.deepEqual(paths, paths.toSorted());
    assert.equal(new Set(paths).size, paths.length);
    for (const path of paths) {
      const metadata = await lstat(resolve(workspaceRoot, path));
      assert.equal(metadata.isFile(), true, `${path} is not a regular file`);
      assert.equal(metadata.isSymbolicLink(), false, `${path} is a symbolic link`);
      expectedPaths.push(path);
    }
  }
  expectedPaths.sort();
  assert.equal(new Set(expectedPaths).size, expectedPaths.length);

  const head = git("rev-parse", "HEAD");
  if (head === releaseCandidateRevision) {
    const status = gitRaw("status", "--porcelain=v1", "-uall");
    const actualPaths = status === ""
      ? []
      : status.split(/\r?\n/u).map((line) => line.slice(3).replaceAll("\\", "/")).sort();
    assert.deepEqual(actualPaths, expectedPaths);
    return;
  }
  const bindingCommit = git(
    "rev-list",
    "--first-parent",
    "--reverse",
    `${releaseCandidateRevision}..HEAD`,
  ).split(/\r?\n/u).filter(Boolean)[0];
  assert.notEqual(bindingCommit, undefined);
  assert.equal(git("rev-parse", `${bindingCommit}^`), releaseCandidateRevision);
  assert.equal(
    git("log", "-1", "--format=%s", bindingCommit),
    "conformance(memoryos-1.3): close MO-1303 with macOS infrastructure exception",
  );
  const committedPaths = git(
    "diff",
    "--name-only",
    releaseCandidateRevision,
    bindingCommit,
  ).split(/\r?\n/u).filter(Boolean).sort();
  assert.deepEqual(committedPaths, expectedPaths);
});
