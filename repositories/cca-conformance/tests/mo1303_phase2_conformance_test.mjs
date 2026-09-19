import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  conformanceRoot,
  extensionRoot,
  readJson,
  sha256,
  workspaceRoot,
} from "./support/mo1303-conformance-support.mjs";

const inventory = await readJson(resolve(conformanceRoot, "mo1303-conformance-inventory.json"));
const extensionPackage = await readJson(resolve(extensionRoot, "package.json"));
const mo1302Inventory = await readJson(resolve(conformanceRoot, "mo1302-conformance-inventory.json"));

const expectedCommands = [
  "memoryos.showContractIdentities",
  "memoryos.preparePolicyArtifact",
  "memoryos.evaluatePolicyArtifact",
  "memoryos.verifyEvaluationIdentity",
  "memoryos.verifyPolicyOutcome",
];

const expectedDecisions = ["PASS", "FAIL", "COULD_NOT_EVALUATE"];
const expectedEvidenceVariants = [
  "MemoryOSPolicyFactReference",
  "MemoryOSPolicyFactSelection",
  "MemoryOSPolicyFactDomainState",
  "MemoryOSDeterministicFactSourceAbsence",
];

async function source(path) {
  return readFile(resolve(extensionRoot, path), "utf8");
}

test("MO-1303 Phase 2 preserves every frozen Phase 1 and predecessor identity", async () => {
  assert.equal(inventory.phase, "implementationPhase3Of3LocalClosure");
  assert.deepEqual(inventory.baseline, {
    immediateReleasedPredecessor: "memoryos-1.3-mo1302",
    mo1301Tag: {
      name: "memoryos-1.3-mo1301",
      peeledCommit: "af6a405b3cd9097ce469b16a854a0568b8acee1f",
    },
    mo1302Tag: {
      name: "memoryos-1.3-mo1302",
      peeledCommit: "7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d",
    },
  });
  assert.equal(inventory.extension.identifier, "moelsaka01.memoryos");
  assert.equal(inventory.extension.version, "0.1.0");
  assert.equal(inventory.extension.minimumVSCodeDesktopVersion, "1.137.0");
  assert.equal(inventory.extension.conformanceReferenceHostVersion, "1.137.0");
  assert.equal(inventory.runtimeClosure.entryCount, 37);
  assert.equal(
    inventory.runtimeClosure.inventoryDigest,
    "sha256:2aed4a65a3697345c3da71a4716565e2eb5275021db7628a09b2103c78203542",
  );
  assert.equal(
    inventory.runtimeClosure.runtimeClosureDigest,
    "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3",
  );
  assert.equal(
    inventory.contractIdentityArtifact.rawSha256,
    "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7",
  );
  assert.equal(
    inventory.distribution.historicalPhase1And2PackageLock.rawSha256,
    "sha256:6e51d295d4110ce857a79540bae87a630333c0127a3ed5837ac660aca09a28ac",
  );
  assert.deepEqual({
    mip: inventory.transportLimits.mipBytes,
    policy: inventory.transportLimits.policyBytes,
    policySet: inventory.transportLimits.policySetBytes,
  }, { mip: 524_288, policy: 2_048, policySet: 4_096 });
  assert.equal(inventory.transportLimits.normativeOutcomeCanonicalBytes, 4_060);
  assert.deepEqual(inventory.phase1CommitBinding, {
    revision: "6f99038fd5669ece2af4b1671a8e5f267822d2dd",
    status: "bound",
    strategy: "postCommitConformanceCommit",
  });

  const manifestBytes = await readFile(resolve(workspaceRoot, inventory.runtimeClosure.manifest.path));
  const receiptBytes = await readFile(resolve(workspaceRoot, inventory.runtimeClosure.receipt.path));
  const contractBytes = await readFile(resolve(workspaceRoot, inventory.contractIdentityArtifact.path));
  const lockBytes = await readFile(resolve(workspaceRoot, inventory.distribution.packageLock.path));
  assert.equal(sha256(manifestBytes), inventory.runtimeClosure.manifest.rawSha256);
  assert.equal(sha256(receiptBytes), inventory.runtimeClosure.receipt.rawSha256);
  assert.equal(receiptBytes.byteLength, inventory.runtimeClosure.receipt.byteLength);
  assert.equal(sha256(contractBytes), inventory.contractIdentityArtifact.rawSha256);
  assert.equal(contractBytes.byteLength, inventory.contractIdentityArtifact.byteLength);
  assert.equal(sha256(lockBytes), inventory.distribution.packageLock.rawSha256);
  assert.equal(lockBytes.byteLength, inventory.distribution.packageLock.byteLength);
  assert.equal(JSON.parse(manifestBytes.toString("utf8")).files.length, 37);

  const actionManifestPath = resolve(
    workspaceRoot,
    mo1302Inventory.actionDistribution.manifest.path,
  );
  const actionManifestBytes = await readFile(actionManifestPath);
  const actionManifest = JSON.parse(actionManifestBytes.toString("utf8"));
  assert.equal(actionManifest.files.length, 42);
  assert.equal(
    sha256(actionManifestBytes),
    "sha256:2e116b6518934c797e9c562670f2292462be11ee982c778b43f1aaf45a8986f9",
  );
});

test("the public product surface remains exactly five commands and one native Results view", async () => {
  assert.deepEqual(
    extensionPackage.contributes.commands.map(({ command }) => command),
    expectedCommands,
  );
  assert.deepEqual(
    inventory.phase2Product.commandImplementations.map(({ id }) => id),
    expectedCommands,
  );
  assert.deepEqual(Object.keys(extensionPackage.contributes).toSorted(), ["commands", "views"]);
  assert.deepEqual(extensionPackage.contributes.views, {
    explorer: [{ id: "memoryos.results", name: "MemoryOS Results" }],
  });
  assert.equal(extensionPackage.contributes.configuration, undefined);
  assert.equal(extensionPackage.browser, undefined);
  assert.equal(extensionPackage.activationEvents, undefined);

  const commandsSource = await source("src/commands.ts");
  const productSource = await source("src/vscode-product.ts");
  const expectedImplementations = expectedCommands.map((id, index) => ({
    id,
    implementation: id.slice("memoryos.".length),
    requiresWorkspaceTrust: index !== 0,
  }));
  assert.deepEqual(inventory.phase2Product.commandImplementations, expectedImplementations);
  assert.deepEqual(
    [...commandsSource.matchAll(/id: "(memoryos\.[A-Za-z]+)"/gu)].map((match) => match[1]),
    expectedCommands,
  );
  assert.deepEqual(
    [...commandsSource.matchAll(
      /case "(memoryos\.[A-Za-z]+)":\s*return adapter\.([A-Za-z]+)\(/gu,
    )].map((match) => ({ id: match[1], implementation: match[2] })),
    expectedImplementations.map(({ id, implementation }) => ({ id, implementation })),
  );
  assert.match(productSource, /registerTreeDataProvider\("memoryos\.results", this\.tree\)/u);
  assert.match(productSource, /registerTextDocumentContentProvider\("memoryos", this\.virtualDocuments\)/u);
  assert.doesNotMatch(productSource, /registerCommand\(/u);
});

test("trust, acquisition, concurrency, cancellation, and deactivation contracts are closed", async () => {
  const commandsSource = await source("src/commands.ts");
  const inputSource = await source("src/vscode-input.ts");
  const productSource = await source("src/vscode-product.ts");
  const coordinatorSource = await source("src/product/operation-coordinator.ts");
  const extensionSource = await source("src/extension.ts");

  assert.deepEqual(inventory.phase2Product.trustBehavior.untrustedCommandAllowlist, [
    "memoryos.showContractIdentities",
  ]);
  assert.deepEqual(
    extensionPackage.contributes.commands.map(({ enablement }) => enablement),
    [undefined, "isWorkspaceTrusted", "isWorkspaceTrusted", "isWorkspaceTrusted", "isWorkspaceTrusted"],
  );
  assert.match(commandsSource, /if \(command\.requiresWorkspaceTrust\) enforceWorkspaceTrust\(command\.id\)/u);
  assert.match(commandsSource, /vscode\.workspace\.isTrusted/u);
  assert.ok(
    commandsSource.indexOf("if (command.requiresWorkspaceTrust)")
      < commandsSource.indexOf("switch (command.id)"),
    "handler trust enforcement must precede dispatch",
  );
  assert.match(inputSource, /uri\.scheme !== "file"/u);
  assert.match(inputSource, /document\?\.isDirty === true/u);
  assert.match(inputSource, /uri\.scheme === "untitled"/u);
  assert.match(inputSource, /vscode\.env\.uiKind !== vscode\.UIKind\.Desktop/u);
  assert.match(inputSource, /vscode\.env\.remoteName !== undefined/u);
  assert.match(productSource, /cancellable: true/u);
  assert.match(productSource, /token\.onCancellationRequested\(\(\) => abortController\.abort\(\)\)/u);
  assert.match(productSource, /MEMORYOS_VSCODE_ADAPTER_ERROR_CODES\.OPERATION_IN_PROGRESS/u);
  assert.match(coordinatorSource, /this\.#active !== active/u);
  assert.match(coordinatorSource, /cancelActive\(\): void/u);
  assert.match(extensionSource, /let productDisposal: Promise<void> \| undefined/u);
  assert.match(extensionSource, /if \(productDisposal !== undefined\) return productDisposal/u);
  assert.match(extensionSource,
    /productDisposal = activeProduct\?\.dispose\(\) \?\? Promise\.resolve\(\)/u);
  assert.match(extensionSource, /await disposeActiveProduct\(\)/u);
});

test("Phase 2 delegates all semantics through the verified Phase 1 adapter", async () => {
  const extensionSource = await source("src/extension.ts");
  const controllerSource = await source("src/product/product-controller.ts");
  const productSource = await source("src/vscode-product.ts");
  const phase2Sources = [extensionSource, controllerSource, productSource].join("\n");

  assert.match(extensionSource, /createCliAdapter\(/u);
  assert.match(extensionSource, /createMemoryOSVSCodeProduct\(cliAdapter\)/u);
  assert.match(controllerSource, /this\.#adapter\.preflight\(/u);
  assert.match(controllerSource, /this\.#adapter\.execute\(/u);
  assert.match(controllerSource, /createOperationInputSnapshot/u);
  assert.doesNotMatch(
    phase2Sources,
    /(?:investigation-policy-engine|policy-fact-context|regression-policy-fact-source)\.js/u,
  );
  assert.equal(inventory.authorityBoundary.extensionOwnsMemoryOSSemantics, false);
  assert.equal(inventory.authorityBoundary.operatingSystemCliProcess, false);
  assert.equal(inventory.authorityBoundary.shell, false);
  assert.equal(inventory.authorityBoundary.pathLookup, false);
});

test("evaluation generation verification is complete, fixed-name, and fail closed", async () => {
  const snapshotSource = await source("src/runtime/input-snapshot.ts");
  const controllerSource = await source("src/product/product-controller.ts");
  const generation = inventory.phase2Product.evaluationGeneration;

  assert.deepEqual(generation.privateFixedNames, [
    "evaluation-identity.json",
    "evaluation-identity.sha256",
    "evaluation-outcome.sha256",
    "evaluation-outcome.json",
  ]);
  for (const name of generation.privateFixedNames) assert.match(snapshotSource, new RegExp(`"${name}"`, "u"));
  assert.match(controllerSource, /reserveOutput\("evaluationIdentity"\)/u);
  assert.match(controllerSource, /reserveOutput\("evaluationIdentityDigest"\)/u);
  assert.match(controllerSource, /reserveOutput\("outcomeDigest"\)/u);
  assert.match(controllerSource, /reserveOutput\("outcome"\)/u);
  assert.match(controllerSource, /canonicalJson\(embeddedIdentity\) !== identityBytes\.toString\("utf8"\)/u);
  assert.match(controllerSource, /identitySidecar !== evaluationIdentityDigest \|\| outcomeSidecar !== outcomeDigest/u);
  assert.match(controllerSource, /outcomeValue\.version !== embeddedIdentity\.outcomeContractVersion/u);
  assert.match(controllerSource, /evaluatedArtifact\.semanticDigest !== prepared\.semanticDigest/u);
  assert.match(controllerSource, /artifactIdentity, artifactOutcome, evaluationIdentity, evaluationOutcome/u);
  const generationReadPositions = [
    'readStablePrivateFile(identityPath, POLICY_VERIFICATION_ARTIFACT_MAX_BYTES, "Evaluation Identity")',
    'readStablePrivateFile(identityDigestPath, SIDECAR_BYTES, "Evaluation Identity digest sidecar")',
    'readStablePrivateFile(outcomeDigestPath, SIDECAR_BYTES, "Outcome digest sidecar")',
    'readStablePrivateFile(outcomePath, POLICY_VERIFICATION_ARTIFACT_MAX_BYTES, "Policy outcome commit marker")',
  ].map((needle) => controllerSource.indexOf(needle));
  assert.ok(generationReadPositions.every((position) => position >= 0));
  assert.deepEqual(generationReadPositions, generationReadPositions.toSorted((left, right) => left - right));
  const verificationStart = controllerSource.lastIndexOf("async #verifyCompleteGeneration(");
  const verificationSource = controllerSource.slice(verificationStart);
  assert.equal((verificationSource.match(/this\.#adapter\.execute\(/gu) ?? []).length, 4);
  assert.deepEqual(
    [...verificationSource.matchAll(
      /kind: "(verifyIdentity|verifyOutcome)",\s*mode: "(artifact|evaluation)"/gu,
    )].map((match) => ({ target: match[1], mode: match[2] })),
    [
      { target: "verifyIdentity", mode: "artifact" },
      { target: "verifyOutcome", mode: "artifact" },
      { target: "verifyIdentity", mode: "evaluation" },
      { target: "verifyOutcome", mode: "evaluation" },
    ],
  );
  assert.match(verificationSource, /identity\.sha256 !== identityRawSha256/u);
  assert.match(verificationSource, /policy\.sha256 !== policyRawSha256/u);
  const verificationCall = controllerSource.indexOf("await this.#verifyCompleteGeneration(");
  assert.ok(verificationCall >= 0);
  assert.ok(verificationCall < controllerSource.indexOf("return Object.freeze({", verificationCall));
  assert.equal(generation.mixedGenerationPublication, false);
});

test("decision, ordered tree, evidence, virtual-document, and verification contracts are exact", async () => {
  const typesSource = await source("src/presentation/types.ts");
  const treeSource = await source("src/presentation/results-tree.ts");
  const virtualSource = await source("src/presentation/virtual-documents.ts");
  const navigationSource = await source("src/presentation/navigation.ts");

  assert.deepEqual(inventory.phase2Product.decisionPresentation.normativeStates, expectedDecisions);
  assert.deepEqual(inventory.phase2Product.evidencePresentation.variants, expectedEvidenceVariants);
  assert.deepEqual(inventory.phase2Product.verificationModes, {
    evaluationIdentity: ["artifact", "evaluation"],
    policyOutcome: ["artifact", "evaluation"],
  });
  for (const decision of expectedDecisions) assert.match(typesSource, new RegExp(`"${decision}"`, "u"));
  for (const kind of expectedEvidenceVariants) assert.match(typesSource, new RegExp(`"${kind}"`, "u"));
  assert.match(typesSource, /readonly factDomain: string/u);
  assert.match(typesSource, /readonly externalSourceDigest: string/u);
  assert.match(treeSource, /policy\.rules\.map\(/u);
  assert.match(treeSource, /rule\.evidence\.map\(/u);
  assert.match(treeSource, /evaluation\.policies\.map\(/u);
  assert.doesNotMatch(treeSource, /\.sort\(/u);
  assert.match(navigationSource, /command: "vscode\.open"/u);
  assert.match(virtualSource, /scheme: "memoryos"/u);
  assert.match(virtualSource, /document\.digest\.slice\(7\)/u);
  assert.match(virtualSource, /new TextDecoder\("utf-8", \{ fatal: true \}\)/u);
  assert.match(virtualSource, /existing !== undefined && !sameBytes\(existing\.bytes, item\.bytes\)/u);
  assert.ok(
    virtualSource.indexOf("this.#documents = next")
      < virtualSource.indexOf("this.#changeEmitter.fire(uri)", virtualSource.indexOf("this.#documents = next")),
  );
  assert.doesNotMatch(virtualSource, /JSON\.stringify/u);
  assert.doesNotMatch(virtualSource, /registerFileSystemProvider/u);
});

test("Phase 2 source stays offline and excludes forbidden product surfaces", async () => {
  const texts = await Promise.all(inventory.phase2Surface.sources.map((path) =>
    readFile(resolve(workspaceRoot, path), "utf8")));
  const joined = texts.join("\n");
  assert.doesNotMatch(joined, /from\s+["']node:child_process["']|require\(["'](?:node:)?child_process["']\)/u);
  assert.doesNotMatch(joined, /from\s+["']node:(?:http|https|net|tls)["']|\bfetch\s*\(|https?:\/\//u);
  assert.doesNotMatch(
    joined,
    /\b(?:DiagnosticCollection|Webview|LanguageClient|TaskProvider|createFileSystemWatcher|findFiles)\b/u,
  );
  assert.doesNotMatch(joined, /MarkdownString\.isTrusted|\bisTrusted\s*=\s*true/u);
  assert.doesNotMatch(joined, /\btelemetry\b/iu);
  assert.doesNotMatch(joined, /(?:investigation-policy-engine|policy-fact-context|regression-policy-fact-source)\.js/u);
  assert.equal(inventory.distribution.runtimeNetworkAcquisition, false);
  assert.equal(inventory.distribution.runtimePackageInstall, false);
  assert.equal(inventory.distribution.externalSemanticExecutable, false);
});

test("Phase 2 inventory names sorted concrete files and preserves the bound Phase 2 revision", async () => {
  for (const field of ["sources", "tests", "registration", "documentation"]) {
    const paths = inventory.phase2Surface[field];
    assert.deepEqual(paths, paths.toSorted());
    assert.equal(new Set(paths).size, paths.length);
    for (const path of paths) {
      const metadata = await lstat(resolve(workspaceRoot, path));
      assert.equal(metadata.isFile(), true, `${path} is not a regular file`);
      assert.equal(metadata.isSymbolicLink(), false, `${path} is a symbolic link`);
    }
  }
  assert.deepEqual(inventory.phase2CommitBinding, {
    revision: "2919dd9056bc595bddde3d18f09f8efaaafb010b",
    status: "bound",
    strategy: "postCommitConformanceCommit",
  });
  assert.equal(inventory.distribution.vsixIdentity.status, "locallyFrozen");
  assert.match(inventory.distribution.vsixIdentity.sha256, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(inventory.futureMilestoneTag.status, "pendingHostedCertificationAndFinalBinding");
});

test("Phase 2 product inventory is a closed description of the implemented UX contract", () => {
  const product = inventory.phase2Product;
  assert.deepEqual(Object.keys(product).toSorted(), [
    "artifactAcquisition",
    "artifactOutcomeIdentityAuthority",
    "commandImplementations",
    "decisionPresentation",
    "evaluationGeneration",
    "evidencePresentation",
    "prohibitedSurfaces",
    "resultsTree",
    "securityAndAdversarialCoverage",
    "statusAndProgress",
    "trustBehavior",
    "verificationModes",
    "verificationScopeByMode",
    "virtualDocuments",
  ]);
  assert.deepEqual(product.trustBehavior, {
    handlerEnforcement: true,
    manifestEnablement: true,
    untrustedCommandAllowlist: ["memoryos.showContractIdentities"],
    workerBeginsBeforeTrustEnforcement: false,
  });
  assert.deepEqual(product.resultsTree, {
    atomicReplacement: true,
    container: "explorer",
    groups: ["Contracts", "Prepared Artifact", "Evaluation Summary", "Policies", "Rules", "Evidence", "Verification"],
    name: "MemoryOS Results",
    preservesEvidenceOrder: true,
    preservesPolicyOrder: true,
    preservesRuleOrder: true,
    provider: "TreeDataProvider",
    retainsNonPassRules: true,
    viewId: "memoryos.results",
  });
  assert.deepEqual(product.virtualDocuments, {
    byteLimits: { contractIdentities: 65_536, evaluationIdentity: 65_536, evaluationOutcome: 4_060 },
    canonicalBytesUnchanged: true,
    digestKeyed: true,
    evaluationGenerationAtomicReplacement: true,
    kinds: ["contractIdentities", "evaluationIdentity", "evaluationOutcome"],
    provider: "TextDocumentContentProvider",
    readOnly: true,
    scheme: "memoryos",
  });
  assert.deepEqual(product.statusAndProgress, {
    cancellableProgress: true,
    cancellationTerminatesWorker: true,
    noWallClockSemanticTimeout: true,
    outputChannel: "MemoryOS",
    outputChannelKind: "LogOutputChannel",
    outputEntryMaxBytes: 4_096,
    outputRetainedMaxBytes: 262_144,
    publishedStates: ["Prepared", "Verified", "PASS", "FAIL", "COULD_NOT_EVALUATE", "Tool Error"],
    statusInitiallyHidden: true,
  });
  assert.deepEqual(product.decisionPresentation, {
    cancellationIsDecision: false,
    cneIsFail: false,
    failIsToolError: false,
    normativeStates: expectedDecisions,
    toolErrorIsCne: false,
  });
  assert.deepEqual(product.evidencePresentation, {
    externalEvidenceRequiresFactDomain: true,
    externalFactDomainDisplayed: true,
    preservesOrder: true,
    selectionMatchCountBoundToIdentifierCardinality: true,
    sourceDigestDisplayed: true,
    sourceKinds: ["policyFactContext", "deterministicFactSource"],
    variants: expectedEvidenceVariants,
    wholeArtifactNavigationOnly: true,
  });
  assert.deepEqual(product.verificationModes, {
    evaluationIdentity: ["artifact", "evaluation"],
    policyOutcome: ["artifact", "evaluation"],
  });
  assert.deepEqual(product.verificationScopeByMode, {
    artifact: "serializedArtifact",
    evaluation: "authoritativeReconstruction",
  });
  assert.equal(product.artifactOutcomeIdentityAuthority, "exactlyOneOfArtifactOrDigest");
  assert.deepEqual(product.artifactAcquisition, {
    acceptedScheme: "file",
    automaticDiscovery: false,
    externalLocalFilesAllowed: true,
    multiRootInference: false,
    roleBoundPrivateSnapshots: true,
    savedCleanRegularFilesOnly: true,
    selection: "explicitPerArtifact",
    symlinkOrReparseLeavesRejected: true,
  });
  assert.deepEqual(product.evaluationGeneration, {
    artifactAndEvaluationModeVerification: true,
    embeddedStandaloneIdentityEquality: true,
    mixedGenerationPublication: false,
    outcomeIsFinalCommitMarker: true,
    outcomeVersionCrossBinding: true,
    preflightPostflightIdentityAgreement: true,
    privateFixedNames: [
      "evaluation-identity.json",
      "evaluation-identity.sha256",
      "evaluation-outcome.sha256",
      "evaluation-outcome.json",
    ],
    privateInputsReacquiredByRawSha256: true,
    publicationAfterVerification: true,
    selectedSemanticDigestCrossBinding: true,
    sidecarBytes: 71,
    sidecarDigestVerification: true,
    verificationPasses: [
      { target: "evaluationIdentity", mode: "artifact" },
      { target: "policyOutcome", mode: "artifact" },
      { target: "evaluationIdentity", mode: "evaluation" },
      { target: "policyOutcome", mode: "evaluation" },
    ],
  });
  assert.deepEqual(product.prohibitedSurfaces, [
    "DiagnosticCollection", "webview", "customEditor", "languageServer", "TaskProvider",
    "automaticArtifactDiscovery", "filesystemWatcher", "automaticEvaluation",
    "contributes.configuration", "dirtyOrUntitledEvaluation",
    "remoteVirtualOrWebWorkspaceSupportClaim", "MarketplacePublication", "telemetry",
    "MCP", "RESTGateway", "network", "shellOrChildProcess",
  ]);
  assert.deepEqual(product.securityAndAdversarialCoverage, [
    "workspaceTrustBypass", "dirtyAndUntitledInputs", "nonFileAndVirtualWorkspaceInputs",
    "multiRootNeutrality", "symlinkAndReparseLeaves", "roleSwapping",
    "transportLimitBoundaries", "mixedGenerationAndDigestMismatch",
    "malformedCliOutputAndWorkerFailure", "operationConcurrencyAndStaleCompletion",
    "hostileLabelsControlCharactersAndCommandLinks", "offlineNoNetworkNoShell",
    "noConfigurationDiagnosticsWebviewsOrTelemetry",
  ]);
});
