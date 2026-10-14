import assert from "node:assert/strict";
import { readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import * as vscode from "vscode";

const RECEIPT_KIND = "MemoryOSVSCodeHostTestReceipt";
const RECEIPT_VERSION = "1.0.0";
const EXACT_VSCODE_VERSION = "1.137.0";
const EXTENSION_ID = "moelsaka01.memoryos";
const EXTENSION_VERSION = "0.1.0";
const RECEIPT_LIMIT = 256 * 1024;
const CANONICAL_ARTIFACT_LIMIT = 65_536;
const PRIVATE_PREFIXES = Object.freeze([
  "memoryos-vscode-operation-",
  "memoryos-vscode-runtime-",
]);
const PUBLIC_COMMANDS = Object.freeze([
  "memoryos.showContractIdentities",
  "memoryos.preparePolicyArtifact",
  "memoryos.evaluatePolicyArtifact",
  "memoryos.verifyEvaluationIdentity",
  "memoryos.verifyPolicyOutcome",
]);
const SEMANTIC_COMMANDS = Object.freeze(PUBLIC_COMMANDS.slice(1));
const EXPECTED_DECISIONS = Object.freeze({
  cne: "COULD_NOT_EVALUATE",
  fail: "FAIL",
  pass: "PASS",
});

type HostMode = "development" | "installed" | "restricted";

interface EvaluationReceipt {
  readonly scenario: keyof typeof EXPECTED_DECISIONS;
  readonly decision: string;
  readonly policySemanticDigest: string;
  readonly evaluationIdentityDigest: string;
  readonly outcomeDigest: string;
  readonly evaluationIdentityCanonicalText: string;
  readonly outcomeCanonicalText: string;
}

interface VerificationCommandReceipt {
  readonly canonicalText: string;
  readonly decision?: string;
  readonly evaluationIdentityDigest: string;
  readonly mode: "artifact" | "evaluation";
  readonly outcomeDigest?: string;
  readonly sourceFilename: string;
  readonly state: "Verified";
  readonly target: "evaluationIdentity" | "policyOutcome";
  readonly verificationScope: "authoritativeReconstruction" | "serializedArtifact";
  readonly virtualDocumentExactBytes: true;
}

function invariant(condition: unknown, message: string): asserts condition {
  assert.equal(Boolean(condition), true, message);
}

function environment(name: string): string {
  const value = process.env[name];
  invariant(typeof value === "string" && value.length > 0, `${name} is required.`);
  return value;
}

function record(value: unknown, label: string): Record<string, unknown> {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} is not an object.`);
  return value as Record<string, unknown>;
}

function stringMember(value: Record<string, unknown>, name: string, label: string): string {
  const member = value[name];
  invariant(typeof member === "string", `${label}.${name} is not a string.`);
  return member;
}

function digestMember(value: Record<string, unknown>, name: string, label: string): string {
  const member = stringMember(value, name, label);
  assert.match(member, /^sha256:[0-9a-f]{64}$/u, `${label}.${name} is not a digest.`);
  return member;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(candidate[key])}`).join(",")}}`;
}

function boundedCanonicalText(value: unknown, label: string): string {
  invariant(typeof value === "string", `${label} is not text.`);
  invariant(Buffer.byteLength(value, "utf8") <= CANONICAL_ARTIFACT_LIMIT, `${label} exceeds its host-test bound.`);
  const parsed = JSON.parse(value) as unknown;
  assert.equal(JSON.stringify(parsed), value, `${label} is not compact canonical JSON.`);
  return value;
}

function virtualDocumentUri(
  kind: "contract-identities" | "evaluation-identity" | "evaluation-outcome",
  digest: string,
): vscode.Uri {
  return vscode.Uri.from({
    authority: "verified",
    path: `/${kind}/${digest.slice(7)}.json`,
    scheme: "memoryos",
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function comparablePath(path: string): string {
  const absolute = resolve(path);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

function denyExtensionHostFetch(): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: () => Promise.reject(new Error("Network access is denied by the MemoryOS host harness.")),
    writable: false,
  });
}

async function selectQuickPick(index = 0): Promise<void> {
  // VS Code exposes no API for inspecting another extension's QuickInput. A
  // workbench command is deliberately used instead of a public test command.
  await delay(150);
  for (let offset = 0; offset < index; offset += 1) {
    await vscode.commands.executeCommand("workbench.action.quickOpenSelectNext");
  }
  await vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
  await delay(50);
}

async function executeWithUi(
  command: string,
  argument: vscode.Uri,
  drive: () => Promise<void>,
): Promise<unknown> {
  const pending = vscode.commands.executeCommand(command, argument).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ error, ok: false as const }),
  );
  await drive();
  const result = await pending;
  if (!result.ok) throw result.error;
  return result.value;
}

async function executeWithSelections(
  command: string,
  argument: vscode.Uri,
  selections: readonly number[],
): Promise<unknown> {
  const pending = vscode.commands.executeCommand(command, argument).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ error, ok: false as const }),
  );
  for (const selection of selections) await selectQuickPick(selection);
  const result = await pending;
  if (!result.ok) throw result.error;
  return result.value;
}

async function expectCommandError(
  command: string,
  argument: vscode.Uri,
  selections: readonly number[],
  expectedCode: string,
): Promise<void> {
  const pending = vscode.commands.executeCommand(command, argument).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ error, ok: false as const }),
  );
  for (const selection of selections) await selectQuickPick(selection);
  const result = await pending;
  invariant(!result.ok, `${command} unexpectedly succeeded.`);
  const failure = record(result.error, `${command} error`);
  assert.equal(failure.code, expectedCode, `${command} returned the wrong stable code.`);
}

async function privateRoots(): Promise<ReadonlySet<string>> {
  const names = await readdir(tmpdir());
  return new Set(names.filter((name) => PRIVATE_PREFIXES.some((prefix) => name.startsWith(prefix))));
}

async function waitForGeneratedOutput(
  rootsBefore: ReadonlySet<string>,
  operation: PromiseLike<{ readonly ok: boolean; readonly value?: unknown; readonly error?: unknown }>,
): Promise<string> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const operationState = await Promise.race([
      operation.then((result) => ({ settled: true as const, result })),
      delay(10).then(() => ({ settled: false as const })),
    ]);
    if (operationState.settled) {
      throw new Error("Evaluation settled before cancellation could reach an active worker.");
    }
    for (const name of await readdir(tmpdir())) {
      if (rootsBefore.has(name) || !name.startsWith("memoryos-vscode-operation-")) continue;
      const outputRoot = join(tmpdir(), name, "outputs");
      try {
        if ((await readdir(outputRoot)).length > 0) return join(tmpdir(), name);
      } catch {
        // The private generation may be between creation and output setup.
      }
    }
  }
  throw new Error("Evaluation did not expose a generated output before the cancellation bound.");
}

async function waitForRemoval(path: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      await readdir(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    await delay(10);
  }
  throw new Error("Cancelled private generation was not discarded.");
}

async function extensionAndSurface() {
  assert.equal(vscode.version, EXACT_VSCODE_VERSION, "The Extension Host version is not frozen.");
  assert.equal(vscode.env.uiKind, vscode.UIKind.Desktop, "The tests require VS Code Desktop.");
  assert.equal(vscode.env.remoteName, undefined, "The tests require a local Extension Host.");

  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  invariant(extension !== undefined, `Extension ${EXTENSION_ID} is not installed or under development.`);
  assert.equal(extension.packageJSON.version, EXTENSION_VERSION, "The extension version changed.");
  const contribution = record(extension.packageJSON.contributes, "extension contributes");
  invariant(Array.isArray(contribution.commands), "Command contributions are missing.");
  const commandIds = contribution.commands.map((value, index) =>
    stringMember(record(value, `command contribution ${index}`), "command", "command contribution"));
  assert.deepEqual(commandIds, PUBLIC_COMMANDS, "The public command inventory changed.");
  const views = record(contribution.views, "view contributions");
  invariant(Array.isArray(views.explorer), "Explorer view contributions are missing.");
  assert.deepEqual(views.explorer.map((value, index) => {
    const view = record(value, `Explorer view ${index}`);
    return { id: view.id, name: view.name };
  }), [{ id: "memoryos.results", name: "MemoryOS Results" }]);

  await extension.activate();
  assert.equal(extension.isActive, true, "The MemoryOS extension did not activate.");
  const registered = new Set(await vscode.commands.getCommands(true));
  for (const command of PUBLIC_COMMANDS) {
    invariant(registered.has(command), `The Extension Host did not register ${command}.`);
  }
  invariant(registered.has("memoryos.results.focus"), "The MemoryOS Results view focus command is absent.");
  await vscode.commands.executeCommand("memoryos.results.focus");
  return { commandIds: [...PUBLIC_COMMANDS], extension, viewRegistered: true };
}

async function contractIdentities() {
  const identityResult = record(
    await vscode.commands.executeCommand("memoryos.showContractIdentities"),
    "contract identity result",
  );
  const identities = record(identityResult.identities, "contract identities");
  assert.equal(identities.kind, "MemoryOSPolicyContractIdentities");
  const canonicalText = boundedCanonicalText(identityResult.canonicalText, "contract identities canonical text");
  assert.equal(JSON.stringify(identities), canonicalText);
  const contractArtifactSha256 = digestMember(identityResult, "contractArtifactSha256", "contract identity result");
  const runtimeClosureDigest = digestMember(identityResult, "runtimeClosureDigest", "contract identity result");
  const document = await vscode.workspace.openTextDocument(
    virtualDocumentUri("contract-identities", contractArtifactSha256),
  );
  assert.equal(document.getText(), canonicalText, "The contract virtual document changed bytes.");
  return { canonicalText, contractArtifactSha256, runtimeClosureDigest };
}

function stableCodes(value: unknown): readonly string[] {
  const found = new Set<string>();
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (candidate === null || typeof candidate !== "object") return;
    for (const [name, member] of Object.entries(candidate as Record<string, unknown>)) {
      if ((name === "code" || name === "decisionCode" || name === "stableCode")
          && typeof member === "string") {
        found.add(member);
      }
      visit(member);
    }
  };
  visit(value);
  return Object.freeze([...found].sort());
}

async function prepareArtifact(
  uri: vscode.Uri,
  kind: "policy" | "policySet",
  kindSelection: 0 | 1,
) {
  const prepared = record(
    await executeWithSelections("memoryos.preparePolicyArtifact", uri, [kindSelection]),
    `prepared ${kind} result`,
  );
  assert.equal(prepared.kind, kind);
  assert.equal(prepared.state, "Prepared");
  assert.equal(prepared.sourceUri, uri.toString());
  return {
    documentDigest: digestMember(prepared, "documentDigest", `prepared ${kind} result`),
    semanticDigest: digestMember(prepared, "semanticDigest", `prepared ${kind} result`),
  };
}

async function evaluateScenario(
  scenario: keyof typeof EXPECTED_DECISIONS,
  policyUri: vscode.Uri,
  candidateUri: vscode.Uri,
): Promise<EvaluationReceipt & { readonly stableCodes: readonly string[] }> {
  const candidate = await vscode.workspace.openTextDocument(candidateUri);
  assert.equal(candidate.isDirty, false);
  assert.equal(candidate.isUntitled, false);
  await vscode.window.showTextDocument(candidate, { preview: false });
  const evaluation = record(
    await executeWithSelections("memoryos.evaluatePolicyArtifact", policyUri, [0, 0, 0]),
    `${scenario} evaluation`,
  );
  const decision = stringMember(evaluation, "decision", `${scenario} evaluation`);
  assert.equal(decision, EXPECTED_DECISIONS[scenario]);
  const evaluationIdentityDigest = digestMember(evaluation, "evaluationIdentityDigest", `${scenario} evaluation`);
  const outcomeDigest = digestMember(evaluation, "outcomeDigest", `${scenario} evaluation`);
  const evaluationIdentityCanonicalText = boundedCanonicalText(
    evaluation.evaluationIdentityCanonicalText,
    `${scenario} Evaluation Identity`,
  );
  const outcomeCanonicalText = boundedCanonicalText(evaluation.outcomeCanonicalText, `${scenario} outcome`);
  assert.equal(
    (await vscode.workspace.openTextDocument(
      virtualDocumentUri("evaluation-identity", evaluationIdentityDigest),
    )).getText(),
    evaluationIdentityCanonicalText,
  );
  assert.equal(
    (await vscode.workspace.openTextDocument(
      virtualDocumentUri("evaluation-outcome", outcomeDigest),
    )).getText(),
    outcomeCanonicalText,
  );
  return {
    decision,
    evaluationIdentityCanonicalText,
    evaluationIdentityDigest,
    outcomeCanonicalText,
    outcomeDigest,
    policySemanticDigest: digestMember(evaluation, "policySemanticDigest", `${scenario} evaluation`),
    scenario,
    stableCodes: stableCodes(JSON.parse(outcomeCanonicalText)),
  };
}

async function verifyGeneratedArtifacts(
  evaluation: EvaluationReceipt & { readonly stableCodes: readonly string[] },
  policyUri: vscode.Uri,
  candidateUri: vscode.Uri,
  workspaceRoot: string,
): Promise<Readonly<{
  evaluationIdentity: VerificationCommandReceipt;
  policyOutcome: VerificationCommandReceipt;
}>> {
  assert.equal(evaluation.scenario, "pass", "Verification fixtures must come from the PASS generation.");
  const identityUri = vscode.Uri.file(join(workspaceRoot, "verified-evaluation-identity.json"));
  const outcomeUri = vscode.Uri.file(join(workspaceRoot, "verified-policy-outcome.json"));
  await Promise.all([
    writeFile(identityUri.fsPath, evaluation.evaluationIdentityCanonicalText, { flag: "wx", mode: 0o600 }),
    writeFile(outcomeUri.fsPath, evaluation.outcomeCanonicalText, { flag: "wx", mode: 0o600 }),
  ]);

  const policyDocument = await vscode.workspace.openTextDocument(policyUri);
  const candidateDocument = await vscode.workspace.openTextDocument(candidateUri);
  await vscode.window.showTextDocument(policyDocument, { preview: false });
  const identity = record(await executeWithUi(
    "memoryos.verifyEvaluationIdentity",
    identityUri,
    async () => {
      await selectQuickPick(1);
      await selectQuickPick(0);
      await delay(150);
      await vscode.window.showTextDocument(candidateDocument, { preview: false });
      await delay(50);
      await vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
      await delay(50);
      await selectQuickPick(0);
      await selectQuickPick(0);
    },
  ), "Evaluation Identity verification");
  assert.deepEqual(Object.keys(identity).sort(), [
    "canonicalText",
    "evaluationIdentityDigest",
    "mode",
    "sourceUri",
    "state",
    "target",
    "verificationScope",
  ]);
  assert.equal(identity.state, "Verified");
  assert.equal(identity.target, "evaluationIdentity");
  assert.equal(identity.mode, "evaluation");
  assert.equal(identity.verificationScope, "authoritativeReconstruction");
  assert.equal(identity.sourceUri, identityUri.toString());
  assert.equal(identity.evaluationIdentityDigest, evaluation.evaluationIdentityDigest);
  const identityCanonicalText = boundedCanonicalText(
    identity.canonicalText,
    "verified Evaluation Identity canonical text",
  );
  assert.equal(identityCanonicalText, evaluation.evaluationIdentityCanonicalText);
  assert.equal(
    (await vscode.workspace.openTextDocument(
      virtualDocumentUri("evaluation-identity", evaluation.evaluationIdentityDigest),
    )).getText(),
    identityCanonicalText,
    "Verified Evaluation Identity virtual bytes changed.",
  );

  const identityDocument = await vscode.workspace.openTextDocument(identityUri);
  await vscode.window.showTextDocument(identityDocument, { preview: false });
  const outcome = record(await executeWithUi(
    "memoryos.verifyPolicyOutcome",
    outcomeUri,
    async () => {
      await selectQuickPick(0);
      await selectQuickPick(0);
      await selectQuickPick(0);
      await selectQuickPick(0);
    },
  ), "Policy Outcome verification");
  assert.deepEqual(Object.keys(outcome).sort(), [
    "canonicalText",
    "decision",
    "evaluationIdentityDigest",
    "mode",
    "outcomeDigest",
    "sourceUri",
    "state",
    "target",
    "verificationScope",
  ]);
  assert.equal(outcome.state, "Verified");
  assert.equal(outcome.target, "policyOutcome");
  assert.equal(outcome.mode, "artifact");
  assert.equal(outcome.verificationScope, "serializedArtifact");
  assert.equal(outcome.sourceUri, outcomeUri.toString());
  assert.equal(outcome.decision, evaluation.decision);
  assert.equal(outcome.evaluationIdentityDigest, evaluation.evaluationIdentityDigest);
  assert.equal(outcome.outcomeDigest, evaluation.outcomeDigest);
  const outcomeCanonicalText = boundedCanonicalText(
    outcome.canonicalText,
    "verified Policy Outcome canonical text",
  );
  assert.equal(outcomeCanonicalText, evaluation.outcomeCanonicalText);
  assert.equal(
    (await vscode.workspace.openTextDocument(
      virtualDocumentUri("evaluation-outcome", evaluation.outcomeDigest),
    )).getText(),
    outcomeCanonicalText,
    "Verified Policy Outcome virtual bytes changed.",
  );

  return Object.freeze({
    evaluationIdentity: Object.freeze({
      canonicalText: identityCanonicalText,
      evaluationIdentityDigest: evaluation.evaluationIdentityDigest,
      mode: "evaluation" as const,
      sourceFilename: basename(identityUri.fsPath),
      state: "Verified" as const,
      target: "evaluationIdentity" as const,
      verificationScope: "authoritativeReconstruction" as const,
      virtualDocumentExactBytes: true as const,
    }),
    policyOutcome: Object.freeze({
      canonicalText: outcomeCanonicalText,
      decision: evaluation.decision,
      evaluationIdentityDigest: evaluation.evaluationIdentityDigest,
      mode: "artifact" as const,
      outcomeDigest: evaluation.outcomeDigest,
      sourceFilename: basename(outcomeUri.fsPath),
      state: "Verified" as const,
      target: "policyOutcome" as const,
      verificationScope: "serializedArtifact" as const,
      virtualDocumentExactBytes: true as const,
    }),
  });
}

async function cancellationArchitecture(
  policyUri: vscode.Uri,
  candidateUri: vscode.Uri,
): Promise<Readonly<{ cancelled: true; incompleteGenerationDiscarded: true; recovery: true }>> {
  await vscode.commands.executeCommand("notifications.clearAll");
  const candidate = await vscode.workspace.openTextDocument(candidateUri);
  await vscode.window.showTextDocument(candidate, { preview: false });
  const rootsBefore = await privateRoots();
  const operation = vscode.commands.executeCommand("memoryos.evaluatePolicyArtifact", policyUri).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ error, ok: false as const }),
  );
  await selectQuickPick(0);
  await selectQuickPick(0);
  await selectQuickPick(0);
  const privateGeneration = await waitForGeneratedOutput(rootsBefore, operation);
  await vscode.commands.executeCommand("notification.acceptPrimaryAction");
  const result = await operation;
  if (!result.ok) throw result.error;
  assert.equal(result.value, undefined, "Cancellation returned a published decision.");
  await waitForRemoval(privateGeneration);
  const recovery = record(
    await vscode.commands.executeCommand("memoryos.showContractIdentities"),
    "post-cancellation recovery",
  );
  assert.equal(record(recovery.identities, "recovery identities").kind, "MemoryOSPolicyContractIdentities");
  return { cancelled: true, incompleteGenerationDiscarded: true, recovery: true };
}

async function realEditorInputs(policyUri: vscode.Uri, workspaceRoot: string): Promise<Readonly<{
  dirtyRejected: true;
  nonFileRejected: true;
  symlinkOrReparseRejected: true;
  untitledRejected: true;
}>> {
  const policy = await vscode.workspace.openTextDocument(policyUri);
  await vscode.window.showTextDocument(policy, { preview: false });
  const edit = new vscode.WorkspaceEdit();
  edit.insert(policyUri, policy.positionAt(policy.getText().length), " ");
  assert.equal(await vscode.workspace.applyEdit(edit), true, "The dirty-editor fixture edit failed.");
  assert.equal(policy.isDirty, true, "The Policy editor did not become dirty.");
  await expectCommandError(
    "memoryos.preparePolicyArtifact",
    policyUri,
    [0],
    "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
  );
  await vscode.window.showTextDocument(policy, { preview: false });
  await vscode.commands.executeCommand("workbench.action.files.revert");

  const untitled = await vscode.workspace.openTextDocument({ content: "{}", language: "json" });
  assert.equal(untitled.isUntitled, true);
  await expectCommandError(
    "memoryos.preparePolicyArtifact",
    untitled.uri,
    [0],
    "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
  );
  await expectCommandError(
    "memoryos.preparePolicyArtifact",
    vscode.Uri.parse("memoryos://untrusted/non-file.json", true),
    [0],
    "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
  );
  const symlinkUri = vscode.Uri.file(join(workspaceRoot, "policy-symlink.json"));
  await symlink(policyUri.fsPath, symlinkUri.fsPath, "file");
  await expectCommandError(
    "memoryos.preparePolicyArtifact",
    symlinkUri,
    [0],
    "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
  );
  return {
    dirtyRejected: true,
    nonFileRejected: true,
    symlinkOrReparseRejected: true,
    untitledRejected: true,
  };
}

async function runTrusted(mode: Exclude<HostMode, "restricted">, workspaceRoot: string) {
  assert.equal(vscode.workspace.isTrusted, true, "Trusted suite started in Restricted Mode.");
  const surface = await extensionAndSurface();
  const identities = await contractIdentities();
  const candidateUri = vscode.Uri.file(join(workspaceRoot, "candidate.mip"));
  const policySetUri = vscode.Uri.file(join(workspaceRoot, "policy-set.json"));
  const policyUris = Object.freeze({
    cne: vscode.Uri.file(join(workspaceRoot, "cne.memoryos-policy.json")),
    fail: vscode.Uri.file(join(workspaceRoot, "fail.memoryos-policy.json")),
    pass: vscode.Uri.file(join(workspaceRoot, "pass.memoryos-policy.json")),
  });
  const preparation = {
    policy: await prepareArtifact(policyUris.pass, "policy", 0),
    policySet: await prepareArtifact(policySetUri, "policySet", 1),
  };
  const evaluations: Array<EvaluationReceipt & { readonly stableCodes: readonly string[] }> = [];
  for (const scenario of ["pass", "fail", "cne"] as const) {
    evaluations.push(await evaluateScenario(scenario, policyUris[scenario], candidateUri));
  }
  const passEvaluation = evaluations.find(({ scenario }) => scenario === "pass");
  invariant(passEvaluation !== undefined, "The PASS evaluation is unavailable for verification.");
  const verification = await verifyGeneratedArtifacts(
    passEvaluation,
    policyUris.pass,
    candidateUri,
    workspaceRoot,
  );
  const cancellation = await cancellationArchitecture(policyUris.pass, candidateUri);
  const realInputs = await realEditorInputs(policyUris.pass, workspaceRoot);
  const offline = environment("MEMORYOS_HOST_TEST_OFFLINE") === "1";
  return {
    architecture: process.arch,
    assertions: {
      activation: true,
      cancellation: true,
      contractIdentities: true,
      exactCommands: true,
      realEditorInputs: true,
      resultsView: true,
      semanticDecisions: true,
      verificationCommands: true,
      verificationVirtualDocuments: true,
      virtualDocuments: true,
    },
    cancellation,
    commandIds: surface.commandIds,
    contractIdentities: identities,
    evaluations,
    extension: {
      id: EXTENSION_ID,
      path: surface.extension.extensionPath,
      version: EXTENSION_VERSION,
    },
    kind: RECEIPT_KIND,
    mode,
    offline: { networkRequired: false, result: offline ? "PASS" : "NOT_RUN" },
    platform: process.platform,
    preparation,
    realInputs,
    restrictedRejections: [],
    trusted: true,
    verification,
    version: RECEIPT_VERSION,
    viewRegistered: surface.viewRegistered,
    vscodeVersion: vscode.version,
  };
}

async function runRestricted(workspaceRoot: string) {
  assert.equal(vscode.workspace.isTrusted, false, "Restricted suite unexpectedly trusts its workspace.");
  const surface = await extensionAndSurface();
  assert.equal(vscode.workspace.isTrusted, false, "Activation changed workspace trust.");
  const identities = await contractIdentities();
  const rootsAfterIdentities = await privateRoots();
  const argument = vscode.Uri.file(join(workspaceRoot, "pass.memoryos-policy.json"));
  for (const command of SEMANTIC_COMMANDS) {
    await expectCommandError(command, argument, [], "MEMORYOS_VSCODE_WORKSPACE_UNTRUSTED");
  }
  assert.deepEqual(
    [...await privateRoots()].sort(),
    [...rootsAfterIdentities].sort(),
    "A restricted semantic command reached runtime or operation authority.",
  );
  const offline = environment("MEMORYOS_HOST_TEST_OFFLINE") === "1";
  return {
    architecture: process.arch,
    assertions: {
      activation: true,
      contractIdentities: true,
      exactCommands: true,
      restrictedPrecondition: true,
      restrictedRejections: true,
      resultsView: true,
    },
    cancellation: null,
    commandIds: surface.commandIds,
    contractIdentities: identities,
    evaluations: [],
    extension: {
      id: EXTENSION_ID,
      path: surface.extension.extensionPath,
      version: EXTENSION_VERSION,
    },
    kind: RECEIPT_KIND,
    mode: "restricted" as const,
    offline: { networkRequired: false, result: offline ? "PASS" : "NOT_RUN" },
    platform: process.platform,
    preparation: null,
    realInputs: null,
    restrictedRejections: [...SEMANTIC_COMMANDS],
    trusted: false,
    verification: null,
    version: RECEIPT_VERSION,
    viewRegistered: surface.viewRegistered,
    vscodeVersion: vscode.version,
  };
}

export async function run(): Promise<void> {
  const mode = environment("MEMORYOS_HOST_TEST_MODE") as HostMode;
  invariant(mode === "development" || mode === "installed" || mode === "restricted", "Host-test mode is unsupported.");
  const offline = environment("MEMORYOS_HOST_TEST_OFFLINE");
  invariant(offline === "0" || offline === "1", "Offline marker must be zero or one.");
  if (offline === "1") denyExtensionHostFetch();
  const workspaceRoot = resolve(environment("MEMORYOS_HOST_TEST_WORKSPACE"));
  const receiptPath = resolve(environment("MEMORYOS_HOST_TEST_RECEIPT"));
  assert.equal(vscode.workspace.workspaceFolders?.length, 1, "The host test requires exactly one workspace folder.");
  assert.equal(
    comparablePath(vscode.workspace.workspaceFolders[0]?.uri.fsPath ?? ""),
    comparablePath(workspaceRoot),
  );
  for (const file of [
    "candidate.mip",
    "pass.memoryos-policy.json",
    "fail.memoryos-policy.json",
    "cne.memoryos-policy.json",
    "policy-set.json",
  ]) {
    await readFile(join(workspaceRoot, file));
  }
  const receipt = mode === "restricted"
    ? await runRestricted(workspaceRoot)
    : await runTrusted(mode, workspaceRoot);
  const bytes = Buffer.from(`${canonicalJson(receipt)}\n`, "utf8");
  invariant(bytes.byteLength <= RECEIPT_LIMIT, "The host-test receipt exceeds its bound.");
  await writeFile(receiptPath, bytes, { flag: "wx", mode: 0o600 });
  process.stdout.write(`MemoryOS ${mode} Extension Host suite passed (${basename(receiptPath)}).\n`);
}
