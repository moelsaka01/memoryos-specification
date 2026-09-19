import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { validateHostedEvidence } from "../tools/mo1303-hosted-evidence.mjs";
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

test("Phase 3 preserves the exact predecessor chain and historical lock identity", () => {
  assert.equal(git("rev-parse", `${phase2Revision}^`), phase1Revision);
  assert.equal(git("log", "-1", "--format=%s", phase2Revision),
    "feat(memoryos-1.3): MO-1303 phase 2 VS Code product UX");
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
  assert.equal(inventory.phase, "implementationPhase3Of3LocalClosure");
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
    "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7");
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
    platform: { ...evidence.platform, runnerImage: "windows-2022", os: "Windows" },
  }, expected), /runner image differs/u);
});

test("hosted certification remains explicitly pending with no fabricated platform evidence", async () => {
  assert.equal(inventory.hostedCertification.status, "pendingPublication");
  assert.deepEqual(inventory.hostedCertification.platforms, {
    "macos-14": "pendingPublication",
    "ubuntu-24.04": "pendingPublication",
    "windows-2022": "pendingPublication",
  });
  assert.equal(inventory.hostedCertification.crossPlatformParity, "pendingHostedEvidence");
  assert.equal(inventory.hostedCertification.offlineCertification, "pendingHostedEvidence");
  const localEvidence = (await readdir(resolve(conformanceRoot, "evidence")))
    .filter((name) => /^mo1303-hosted-evidence/u.test(name));
  assert.deepEqual(localEvidence, []);
  assert.deepEqual(inventory.phase3CommitBinding, {
    strategy: "laterConformanceBindingCommit",
    status: "pendingCommit",
    revision: null,
  });
  assert.deepEqual(inventory.finalConformanceBinding, {
    strategy: "postHostedConformanceBindingCommit",
    status: "pendingHostedEvidence",
    revision: null,
  });
  assert.equal(inventory.futureMilestoneTag.status,
    "pendingHostedCertificationAndFinalBinding");
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
