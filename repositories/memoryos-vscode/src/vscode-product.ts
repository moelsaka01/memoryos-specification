import { basename } from "node:path";

import * as vscode from "vscode";

import type { ExtensionCommandAdapter } from "./commands.js";
import {
  asMemoryOSAdapterError,
  MEMORYOS_VSCODE_ADAPTER_ERROR_CODES,
  MemoryOSAdapterError,
} from "./errors.js";
import {
  boundedPresentationJson,
  MemoryOSBoundedOutput,
  MemoryOSNavigationRegistry,
  MemoryOSResultsTreeProvider,
  MemoryOSStatusController,
  MemoryOSVirtualDocumentProvider,
  sanitizePresentationText,
  type MemoryOSContractsPresentation,
  type MemoryOSDecision,
  type MemoryOSEvaluationPresentation,
  type MemoryOSPolicyEvidence,
  type MemoryOSPolicyPresentation,
  type MemoryOSPresentationField,
  type MemoryOSPresentationSnapshot,
  type MemoryOSPresentedEvidence,
  type MemoryOSRulePresentation,
  type MemoryOSVerificationPresentation,
} from "./presentation/index.js";
import {
  createMemoryOSProductController,
  MemoryOSProductCliError,
  type ContractIdentitiesResult,
  type EvaluationResult,
  type EvaluationSelection,
  type MemoryOSProductController,
  type PolicySelection,
  type PreparedArtifactResult,
  type ProductOperationResult,
  type ProductPublication,
  type ProductPublicationSink,
  type SelectedLocalArtifact as ProductSelectedArtifact,
  type VerificationResult,
} from "./product/index.js";
import type { MemoryOSCliAdapter } from "./runtime/cli-adapter.js";
import {
  assertSupportedVSCodeHost,
  revalidateSelectedLocalArtifact,
  selectLocalArtifact,
  selectOptionalBaseline,
  selectPolicyKind,
  selectVerificationMode,
  type SelectedLocalArtifact,
} from "./vscode-input.js";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;

function outputInvalid(message: string): MemoryOSAdapterError {
  return new MemoryOSAdapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID, message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw outputInvalid(`${label} is not an object.`);
  }
  return value as Record<string, unknown>;
}

function stringMember(value: Record<string, unknown>, name: string, label: string): string {
  const member = value[name];
  if (typeof member !== "string") throw outputInvalid(`${label}.${name} is invalid.`);
  return member;
}

function digestMember(value: Record<string, unknown>, name: string, label: string): string {
  const member = stringMember(value, name, label);
  if (!DIGEST.test(member)) throw outputInvalid(`${label}.${name} is not a digest.`);
  return member;
}

function decisionMember(value: Record<string, unknown>, name: string, label: string): MemoryOSDecision {
  const member = value[name];
  if (member !== "PASS" && member !== "FAIL" && member !== "COULD_NOT_EVALUATE") {
    throw outputInvalid(`${label}.${name} is not a normative decision.`);
  }
  return member;
}

function arrayMember(value: Record<string, unknown>, name: string, label: string): readonly unknown[] {
  const member = value[name];
  if (!Array.isArray(member)) throw outputInvalid(`${label}.${name} is not an array.`);
  return member;
}

function integerMember(value: Record<string, unknown>, name: string, label: string): number {
  const member = value[name];
  if (!Number.isSafeInteger(member) || (member as number) < 0) {
    throw outputInvalid(`${label}.${name} is not a non-negative safe integer.`);
  }
  return member as number;
}

function evidenceSource(value: unknown):
  | Readonly<{ kind: "policyFactContext"; contextDigest: string }>
  | Readonly<{ kind: "deterministicFactSource"; externalSourceDigest: string }> {
  const source = record(value, "evidence source");
  if (source.kind === "policyFactContext") {
    return Object.freeze({
      contextDigest: digestMember(source, "contextDigest", "evidence source"),
      kind: "policyFactContext" as const,
    });
  }
  if (source.kind === "deterministicFactSource") {
    return Object.freeze({
      externalSourceDigest: digestMember(source, "externalSourceDigest", "evidence source"),
      kind: "deterministicFactSource" as const,
    });
  }
  throw outputInvalid("The evidence source kind is unsupported.");
}

function presentationEvidence(value: unknown): MemoryOSPresentedEvidence {
  const evidence = record(value, "rule evidence");
  const kind = stringMember(evidence, "kind", "rule evidence");
  const domain = stringMember(evidence, "domain", "rule evidence");
  let projected: MemoryOSPolicyEvidence;
  if (kind === "MemoryOSDeterministicFactSourceAbsence") {
    projected = Object.freeze({ domain, kind });
  } else if (kind === "MemoryOSPolicyFactDomainState") {
    const source = evidenceSource(evidence.source);
    if (source.kind !== "policyFactContext") {
      throw outputInvalid("Fact-domain-state evidence must bind PolicyFactContext.");
    }
    const availability = evidence.availability;
    if (availability !== "notApplicable" && availability !== "unavailable") {
      throw outputInvalid("Fact-domain-state evidence availability is unsupported.");
    }
    projected = Object.freeze({ availability, domain, kind, source });
  } else if (kind === "MemoryOSPolicyFactReference") {
    const source = evidenceSource(evidence.source);
    const factIdentifier = digestMember(evidence, "factIdentifier", "fact reference");
    projected = source.kind === "policyFactContext"
      ? Object.freeze({ domain, factIdentifier, kind, source })
      : Object.freeze({
        domain,
        factDomain: stringMember(evidence, "factDomain", "external fact reference"),
        factIdentifier,
        kind,
        source,
      });
  } else if (kind === "MemoryOSPolicyFactSelection") {
    const source = evidenceSource(evidence.source);
    const selector = record(evidence.selector, "evidence selector");
    const parameters = record(selector.parameters, "evidence selector parameters");
    const matchedFactIdentifiers = arrayMember(
      evidence,
      "matchedFactIdentifiers",
      "fact selection",
    ).map((identifier) => {
      if (typeof identifier !== "string" || !DIGEST.test(identifier)) {
        throw outputInvalid("A selected fact identifier is invalid.");
      }
      return identifier;
    });
    const matchCount = integerMember(evidence, "matchCount", "fact selection");
    if (matchCount !== matchedFactIdentifiers.length) {
      throw outputInvalid("Fact-selection match count and identifier cardinality disagree.");
    }
    const common = {
      domain,
      kind,
      matchCount,
      matchedFactIdentifiers: Object.freeze(matchedFactIdentifiers),
      selector: Object.freeze({
        identifier: stringMember(selector, "identifier", "evidence selector"),
        parameters,
        version: stringMember(selector, "version", "evidence selector"),
      }),
    } as const;
    projected = source.kind === "policyFactContext"
      ? Object.freeze({ ...common, source })
      : Object.freeze({
        ...common,
        factDomain: stringMember(evidence, "factDomain", "external fact selection"),
        source,
      });
  } else {
    throw outputInvalid(`The evidence kind '${kind}' is unsupported.`);
  }
  return Object.freeze({ evidence: projected });
}

function rulePresentation(value: unknown): MemoryOSRulePresentation {
  const rule = record(value, "rule result");
  const decisionCode = rule.decisionCode;
  if (decisionCode !== undefined && typeof decisionCode !== "string") {
    throw outputInvalid("The rule decision code is invalid.");
  }
  return Object.freeze({
    decision: decisionMember(rule, "decision", "rule result"),
    ...(decisionCode === undefined ? {} : { decisionCode }),
    evidence: Object.freeze(arrayMember(rule, "evidence", "rule result").map(presentationEvidence)),
    ruleIdentifier: stringMember(rule, "ruleIdentifier", "rule result"),
    ruleType: stringMember(rule, "ruleType", "rule result"),
    ruleVersion: stringMember(rule, "ruleVersion", "rule result"),
  });
}

function policyPresentation(value: unknown): MemoryOSPolicyPresentation {
  const policy = record(value, "Policy result");
  if (policy.kind !== "MemoryOSPolicyResult") {
    throw outputInvalid("A child result is not a MemoryOS Policy result.");
  }
  return Object.freeze({
    decision: decisionMember(policy, "decision", "Policy result"),
    policyIdentifier: stringMember(policy, "policyIdentifier", "Policy result"),
    policySemanticDigest: digestMember(policy, "policySemanticDigest", "Policy result"),
    rules: Object.freeze(arrayMember(policy, "ruleResults", "Policy result").map(rulePresentation)),
  });
}

type EvaluationProjection = Readonly<{
  artifactIdentifier: string;
  artifactKind: "Policy" | "Policy Set";
  policies: readonly MemoryOSPolicyPresentation[];
  resultFields?: readonly MemoryOSPresentationField[];
}>;

function evaluationProjection(result: EvaluationResult): EvaluationProjection {
  const outcome = record(result.outcomeValue, "Policy outcome");
  const outcomeResult = record(outcome.result, "Policy outcome result");
  if (decisionMember(outcomeResult, "decision", "Policy outcome result") !== result.decision) {
    throw outputInvalid("The Policy outcome decision changed before presentation.");
  }
  if (outcomeResult.kind === "MemoryOSPolicyResult") {
    const policy = policyPresentation(outcomeResult);
    if (result.policyKind !== "policy" || policy.policySemanticDigest !== result.policySemanticDigest) {
      throw outputInvalid("The presented Policy result identity is inconsistent.");
    }
    return Object.freeze({
      artifactIdentifier: policy.policyIdentifier,
      artifactKind: "Policy",
      policies: Object.freeze([policy]),
    });
  }
  if (outcomeResult.kind === "MemoryOSPolicySetResult") {
    const semanticDigest = digestMember(outcomeResult, "policySetSemanticDigest", "Policy Set result");
    if (result.policyKind !== "policySet" || semanticDigest !== result.policySemanticDigest) {
      throw outputInvalid("The presented Policy Set result identity is inconsistent.");
    }
    return Object.freeze({
      artifactIdentifier: stringMember(outcomeResult, "policySetIdentifier", "Policy Set result"),
      artifactKind: "Policy Set",
      policies: Object.freeze(arrayMember(
        outcomeResult,
        "policyResults",
        "Policy Set result",
      ).map(policyPresentation)),
    });
  }
  if (outcomeResult.kind === "MemoryOSPolicyEvaluationResourceLimitResult") {
    if (result.decision !== "COULD_NOT_EVALUATE") {
      throw outputInvalid("A resource-limit result must be COULD_NOT_EVALUATE.");
    }
    const code = stringMember(outcomeResult, "code", "resource-limit result");
    const limitIdentifier = stringMember(outcomeResult, "limitIdentifier", "resource-limit result");
    return Object.freeze({
      artifactIdentifier: "Not present in resource-limit result",
      artifactKind: result.policyKind === "policy" ? "Policy" : "Policy Set",
      policies: Object.freeze([]),
      resultFields: Object.freeze([
        Object.freeze({ name: "Decision code", value: code }),
        Object.freeze({ name: "Limit identifier", value: limitIdentifier }),
        Object.freeze({
          name: "Configured limit",
          value: String(integerMember(outcomeResult, "configuredLimit", "resource-limit result")),
        }),
        Object.freeze({
          name: "Observed at least",
          value: String(integerMember(outcomeResult, "observedAtLeast", "resource-limit result")),
        }),
      ]),
    });
  }
  throw outputInvalid("The Policy outcome result kind is unsupported for presentation.");
}

function productArtifact(value: SelectedLocalArtifact): ProductSelectedArtifact {
  return Object.freeze({ input: value.input, uri: value.sourceUri.toString() });
}

function revalidateProductArtifact(value: ProductSelectedArtifact): ProductSelectedArtifact {
  const uri = fileUri(value.uri);
  return productArtifact(revalidateSelectedLocalArtifact(Object.freeze({
    input: value.input,
    sourceUri: uri,
  })));
}

function revalidatePolicySelection(value: PolicySelection): PolicySelection {
  return Object.freeze({ artifact: revalidateProductArtifact(value.artifact), kind: value.kind });
}

function revalidateEvaluationSelection(value: EvaluationSelection): EvaluationSelection {
  return Object.freeze({
    ...(value.baselineMip === undefined
      ? {} : { baselineMip: revalidateProductArtifact(value.baselineMip) }),
    candidateMip: revalidateProductArtifact(value.candidateMip),
    policy: revalidatePolicySelection(value.policy),
  });
}

function fileUri(value: string): vscode.Uri {
  let uri: vscode.Uri;
  try {
    uri = vscode.Uri.parse(value, true);
  } catch {
    throw outputInvalid("A possessed artifact URI is invalid.");
  }
  if (uri.scheme !== "file" || uri.query !== "" || uri.fragment !== "") {
    throw outputInvalid("A possessed input is not a closed local file URI.");
  }
  return uri;
}

function artifactLabel(prefix: string, uri: vscode.Uri): string {
  return `${prefix}: ${basename(uri.fsPath)}`;
}

class VSCodePresentation implements ProductPublicationSink, vscode.Disposable {
  readonly navigation = new MemoryOSNavigationRegistry();
  readonly output = new MemoryOSBoundedOutput(vscode.window.createOutputChannel("MemoryOS", { log: true }));
  readonly status = new MemoryOSStatusController(
    vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100),
  );
  readonly tree = new MemoryOSResultsTreeProvider(this.navigation);
  readonly virtualDocuments = new MemoryOSVirtualDocumentProvider();
  readonly #registrations: vscode.Disposable[];
  #contracts: MemoryOSContractsPresentation | undefined;
  #disposed = false;
  #preparedUri: string | undefined;

  constructor() {
    this.#registrations = [
      vscode.window.registerTreeDataProvider("memoryos.results", this.tree),
      vscode.workspace.registerTextDocumentContentProvider("memoryos", this.virtualDocuments),
      vscode.workspace.onDidChangeTextDocument(({ document }) => {
        if (this.#preparedUri !== undefined && document.uri.toString() === this.#preparedUri) {
          this.#preparedUri = undefined;
          this.navigation.revokeAll();
          const contracts = this.#refreshContractsNavigation();
          this.tree.replace(contracts === undefined ? {} : { contracts });
          this.status.clear();
        }
      }),
    ];
  }

  publish(publication: ProductPublication): void {
    if (this.#disposed) {
      throw new MemoryOSAdapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CANCELLED,
        "The extension was disposed before presentation publication.",
      );
    }
    switch (publication.operationKind) {
      case "showContractIdentities":
        this.#publishIdentities(publication.result as ContractIdentitiesResult);
        break;
      case "preparePolicyArtifact":
        this.#publishPrepared(publication.result as PreparedArtifactResult);
        break;
      case "evaluatePolicyArtifact":
        this.#publishEvaluation(publication.result as EvaluationResult);
        break;
      case "verifyEvaluationIdentity":
      case "verifyPolicyOutcome":
        this.#publishVerification(publication.result as VerificationResult);
        break;
    }
  }

  reportError(code: string, operation: string): void {
    this.output.write("error", code, "MemoryOS operation failed.", { operation });
    this.status.publish({ code, kind: "toolError" });
  }

  #refreshContractsNavigation(): MemoryOSContractsPresentation | undefined {
    const contracts = this.#contracts;
    if (contracts === undefined) return undefined;
    const document = contracts.document;
    const refreshed = Object.freeze({
      ...(document === undefined ? {} : {
        document: this.navigation.possess(
          "contractIdentities",
          document.uri,
          document.label,
        ),
      }),
      fields: contracts.fields,
    });
    this.#contracts = refreshed;
    return refreshed;
  }

  #publishIdentities(result: ContractIdentitiesResult): void {
    const fields = Object.entries(result.identities).map(([name, value]) => Object.freeze({
      name,
      value: typeof value === "string" ? value : boundedPresentationJson(value),
    }));
    fields.push(
      Object.freeze({ name: "runtimeClosureDigest", value: result.runtimeClosureDigest }),
      Object.freeze({ name: "contractArtifactSha256", value: result.contractArtifactSha256 }),
    );
    const documentUri = this.virtualDocuments.publishContractIdentities({
      canonicalBytes: new TextEncoder().encode(result.canonicalText),
      digest: result.contractArtifactSha256,
      kind: "contractIdentities",
    });
    this.navigation.revokeAll();
    this.#contracts = Object.freeze({
      document: this.navigation.possess(
        "contractIdentities",
        documentUri,
        "Verified Contract Identities",
      ),
      fields: Object.freeze(fields),
    });
    this.#preparedUri = undefined;
    this.tree.replace({ contracts: this.#contracts });
    this.status.clear();
  }

  #publishPrepared(result: PreparedArtifactResult): void {
    const uri = fileUri(result.sourceUri);
    this.navigation.revokeAll();
    const contracts = this.#refreshContractsNavigation();
    this.#preparedUri = uri.toString();
    this.tree.replace({
      ...(contracts === undefined ? {} : { contracts }),
      preparedArtifact: Object.freeze({
        artifactKind: result.kind === "policy" ? "Policy" : "Policy Set",
        documentDigest: result.documentDigest,
        semanticDigest: result.semanticDigest,
        sourceArtifact: this.navigation.possess(
          "selectedPolicyArtifact",
          uri,
          artifactLabel("Selected Policy artifact", uri),
        ),
        state: "Prepared",
      }),
    });
    this.status.publish({ kind: "prepared" });
  }

  #publishEvaluation(result: EvaluationResult): void {
    const projection = evaluationProjection(result);
    const policyUri = fileUri(result.policyUri);
    const candidateUri = fileUri(result.candidateMipUri);
    const baselineUri = result.baselineMipUri === undefined ? undefined : fileUri(result.baselineMipUri);
    const documents = this.virtualDocuments.replaceEvaluationGeneration(
      {
        canonicalBytes: new TextEncoder().encode(result.evaluationIdentityCanonicalText),
        digest: result.evaluationIdentityDigest,
        kind: "evaluationIdentity",
      },
      {
        canonicalBytes: new TextEncoder().encode(result.outcomeCanonicalText),
        digest: result.outcomeDigest,
        kind: "evaluationOutcome",
      },
    );
    this.navigation.revokeAll();
    const contracts = this.#refreshContractsNavigation();
    const selectedArtifacts = [
      this.navigation.possess(
        "selectedPolicyArtifact",
        policyUri,
        artifactLabel("Selected Policy artifact", policyUri),
      ),
      this.navigation.possess(
        "candidateMip",
        candidateUri,
        artifactLabel("Candidate MIP", candidateUri),
      ),
      ...(baselineUri === undefined ? [] : [this.navigation.possess(
        "baselineMip",
        baselineUri,
        artifactLabel("Baseline MIP", baselineUri),
      )]),
    ];
    const evaluation: MemoryOSEvaluationPresentation = Object.freeze({
      ...projection,
      decision: result.decision,
      evaluationIdentityDigest: result.evaluationIdentityDigest,
      identityDocument: this.navigation.possess(
        "evaluationIdentity",
        documents.evaluationIdentity,
        "Verified Evaluation Identity",
      ),
      outcomeDigest: result.outcomeDigest,
      outcomeDocument: this.navigation.possess(
        "evaluationOutcome",
        documents.evaluationOutcome,
        "Verified Evaluation Outcome",
      ),
      selectedArtifacts: Object.freeze(selectedArtifacts),
      semanticDigest: result.policySemanticDigest,
    });
    this.#preparedUri = undefined;
    this.tree.replace({
      ...(contracts === undefined ? {} : { contracts }),
      evaluation,
    });
    this.status.publish({ decision: result.decision, kind: "decision" });
  }

  #publishVerification(result: VerificationResult): void {
    const sourceUri = fileUri(result.sourceUri);
    const kind = result.target === "evaluationIdentity" ? "evaluationIdentity" : "evaluationOutcome";
    const digest = result.target === "evaluationIdentity"
      ? result.evaluationIdentityDigest
      : result.outcomeDigest;
    if (digest === undefined) throw outputInvalid("Verified outcome publication has no outcome digest.");
    const documentUri = this.virtualDocuments.replaceVerifiedEvaluationArtifact({
      canonicalBytes: new TextEncoder().encode(result.canonicalText),
      digest,
      kind,
    });
    const fields: MemoryOSPresentationField[] = [
      Object.freeze({ name: "Evaluation Identity digest", value: result.evaluationIdentityDigest }),
      Object.freeze({ name: "Verification scope", value: result.verificationScope }),
      Object.freeze({ name: "Source artifact", value: basename(sourceUri.fsPath) }),
    ];
    if (result.outcomeDigest !== undefined) {
      fields.push(Object.freeze({ name: "Outcome digest", value: result.outcomeDigest }));
    }
    if (result.decision !== undefined) {
      fields.push(Object.freeze({ name: "Normative decision", value: result.decision }));
    }
    this.navigation.revokeAll();
    const contracts = this.#refreshContractsNavigation();
    const target = result.target === "evaluationIdentity" ? "Evaluation Identity" : "Policy Outcome";
    const verification: MemoryOSVerificationPresentation = Object.freeze({
      document: this.navigation.possess(kind, documentUri, `Verified ${target}`),
      fields: Object.freeze(fields),
      mode: result.mode,
      state: "Verified",
      target,
    });
    this.#preparedUri = undefined;
    this.tree.replace({
      ...(contracts === undefined ? {} : { contracts }),
      verification,
    });
    this.status.publish({ kind: "verified" });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#preparedUri = undefined;
    for (const registration of this.#registrations.splice(0)) registration.dispose();
    this.tree.dispose();
    this.virtualDocuments.dispose();
    this.status.dispose();
    this.output.dispose();
    this.navigation.dispose();
    this.#contracts = undefined;
  }
}

function assertNotCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new MemoryOSAdapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CANCELLED,
      "The MemoryOS operation was cancelled.",
    );
  }
}

class VSCodeCommands implements ExtensionCommandAdapter {
  #busy = false;

  constructor(
    readonly controller: MemoryOSProductController,
    readonly presentation: VSCodePresentation,
  ) {}

  showContractIdentities(): Promise<unknown> {
    return this.#execute("Show Contract Identities", async (signal) => {
      assertSupportedVSCodeHost();
      return this.controller.showContractIdentities(signal);
    });
  }

  preparePolicyArtifact(uri?: vscode.Uri): Promise<unknown> {
    return this.#execute("Prepare Policy Artifact", async (signal) => {
      assertSupportedVSCodeHost();
      const policy = await this.#selectPolicy(uri, signal);
      return policy === undefined
        ? undefined
        : this.controller.preparePolicyArtifact({ policy: revalidatePolicySelection(policy) }, signal);
    });
  }

  evaluatePolicyArtifact(uri?: vscode.Uri): Promise<unknown> {
    return this.#execute("Evaluate Policy Artifact", async (signal) => {
      assertSupportedVSCodeHost();
      const evaluation = await this.#selectEvaluation(uri, signal);
      return evaluation === undefined
        ? undefined
        : this.controller.evaluatePolicyArtifact(revalidateEvaluationSelection(evaluation), signal);
    });
  }

  verifyEvaluationIdentity(uri?: vscode.Uri): Promise<unknown> {
    return this.#execute("Verify Evaluation Identity", async (signal) => {
      assertSupportedVSCodeHost();
      const mode = await selectVerificationMode();
      assertNotCancelled(signal);
      if (mode === undefined) return undefined;
      const selectedIdentity = await selectLocalArtifact("evaluationIdentity", uri);
      assertNotCancelled(signal);
      if (selectedIdentity === undefined) return undefined;
      const identity = productArtifact(selectedIdentity);
      if (mode === "artifact") {
        const expectedEvaluationIdentityDigest = await this.#requestDigest(
          "Expected Evaluation Identity digest",
          signal,
        );
        if (expectedEvaluationIdentityDigest === undefined) return undefined;
        return this.controller.verifyEvaluationIdentity({
          expectedEvaluationIdentityDigest,
          identity: revalidateProductArtifact(identity),
          mode,
        }, signal);
      }
      const evaluation = await this.#selectEvaluation(undefined, signal);
      if (evaluation === undefined) return undefined;
      return this.controller.verifyEvaluationIdentity({
        evaluation: revalidateEvaluationSelection(evaluation),
        identity: revalidateProductArtifact(identity),
        mode,
      }, signal);
    });
  }

  verifyPolicyOutcome(uri?: vscode.Uri): Promise<unknown> {
    return this.#execute("Verify Policy Outcome", async (signal) => {
      assertSupportedVSCodeHost();
      const mode = await selectVerificationMode();
      assertNotCancelled(signal);
      if (mode === undefined) return undefined;
      const selectedOutcome = await selectLocalArtifact("policyOutcome", uri);
      assertNotCancelled(signal);
      if (selectedOutcome === undefined) return undefined;
      const outcome = productArtifact(selectedOutcome);
      if (mode === "artifact") {
        const authority = await vscode.window.showQuickPick([
          { authority: "artifact" as const, label: "Expected Evaluation Identity artifact" },
          { authority: "digest" as const, label: "Expected Evaluation Identity digest" },
        ], {
          ignoreFocusOut: true,
          placeHolder: "Choose exactly one expected identity authority",
          title: "MemoryOS: Outcome Verification Authority",
        });
        assertNotCancelled(signal);
        if (authority === undefined) return undefined;
        let expectedIdentity: ProductSelectedArtifact | undefined;
        let expectedEvaluationIdentityDigest: string | undefined;
        if (authority.authority === "artifact") {
          const selected = await selectLocalArtifact("expectedEvaluationIdentity");
          assertNotCancelled(signal);
          if (selected === undefined) return undefined;
          expectedIdentity = productArtifact(selected);
        } else {
          expectedEvaluationIdentityDigest = await this.#requestDigest(
            "Expected Evaluation Identity digest",
            signal,
          );
          if (expectedEvaluationIdentityDigest === undefined) return undefined;
        }
        const expectedOutcomeDigest = await this.#optionalOutcomeDigest(signal);
        if (expectedOutcomeDigest.cancelled) return undefined;
        return this.controller.verifyPolicyOutcome({
          ...(expectedEvaluationIdentityDigest === undefined
            ? {} : { expectedEvaluationIdentityDigest }),
          ...(expectedIdentity === undefined
            ? {} : { expectedIdentity: revalidateProductArtifact(expectedIdentity) }),
          ...(expectedOutcomeDigest.value === undefined
            ? {} : { expectedOutcomeDigest: expectedOutcomeDigest.value }),
          mode,
          outcome: revalidateProductArtifact(outcome),
        }, signal);
      }
      const evaluation = await this.#selectEvaluation(undefined, signal);
      if (evaluation === undefined) return undefined;
      const expectedOutcomeDigest = await this.#optionalOutcomeDigest(signal);
      if (expectedOutcomeDigest.cancelled) return undefined;
      return this.controller.verifyPolicyOutcome({
        evaluation: revalidateEvaluationSelection(evaluation),
        ...(expectedOutcomeDigest.value === undefined
          ? {} : { expectedOutcomeDigest: expectedOutcomeDigest.value }),
        mode,
        outcome: revalidateProductArtifact(outcome),
      }, signal);
    });
  }

  async #selectPolicy(uri: vscode.Uri | undefined, signal: AbortSignal): Promise<PolicySelection | undefined> {
    const kind = await selectPolicyKind();
    assertNotCancelled(signal);
    if (kind === undefined) return undefined;
    const artifact = await selectLocalArtifact(kind, uri);
    assertNotCancelled(signal);
    return artifact === undefined ? undefined : Object.freeze({ artifact: productArtifact(artifact), kind });
  }

  async #selectEvaluation(
    uri: vscode.Uri | undefined,
    signal: AbortSignal,
  ): Promise<EvaluationSelection | undefined> {
    const policy = await this.#selectPolicy(uri, signal);
    if (policy === undefined) return undefined;
    const candidate = await selectLocalArtifact("candidateMip");
    assertNotCancelled(signal);
    if (candidate === undefined) return undefined;
    const baselineChoice = await selectOptionalBaseline();
    assertNotCancelled(signal);
    if (baselineChoice === undefined) return undefined;
    const baseline = baselineChoice ? await selectLocalArtifact("baselineMip") : undefined;
    assertNotCancelled(signal);
    if (baselineChoice && baseline === undefined) return undefined;
    return Object.freeze({
      ...(baseline === undefined ? {} : { baselineMip: productArtifact(baseline) }),
      candidateMip: productArtifact(candidate),
      policy,
    });
  }

  async #requestDigest(title: string, signal: AbortSignal): Promise<string | undefined> {
    const value = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: "sha256:<64 lowercase hexadecimal characters>",
      prompt: "Enter the exact expected normative digest.",
      title: `MemoryOS: ${title}`,
    });
    assertNotCancelled(signal);
    return value;
  }

  async #optionalOutcomeDigest(
    signal: AbortSignal,
  ): Promise<Readonly<{ cancelled: boolean; value?: string }>> {
    const choice = await vscode.window.showQuickPick([
      { choice: "none" as const, label: "Do not supply an expected Outcome digest" },
      { choice: "digest" as const, label: "Supply an expected Outcome digest" },
    ], {
      ignoreFocusOut: true,
      placeHolder: "Choose whether to bind an explicit Outcome digest",
      title: "MemoryOS: Optional Outcome Digest",
    });
    assertNotCancelled(signal);
    if (choice === undefined) return Object.freeze({ cancelled: true });
    if (choice.choice === "none") return Object.freeze({ cancelled: false });
    const value = await this.#requestDigest("Expected Outcome digest", signal);
    return value === undefined
      ? Object.freeze({ cancelled: true })
      : Object.freeze({ cancelled: false, value });
  }

  async #execute(
    title: string,
    work: (signal: AbortSignal) => Promise<ProductOperationResult | undefined>,
  ): Promise<unknown> {
    if (this.#busy) {
      const error = new MemoryOSAdapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OPERATION_IN_PROGRESS,
        "Only one MemoryOS operation may execute at a time.",
      );
      this.#presentFailure(error.code, title);
      throw error;
    }
    this.#busy = true;
    try {
      return await vscode.window.withProgress({
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
        title: `MemoryOS: ${title}`,
      }, async (_progress, token) => {
        const abortController = new AbortController();
        const cancellation = token.onCancellationRequested(() => abortController.abort());
        try {
          if (token.isCancellationRequested) abortController.abort();
          return await work(abortController.signal);
        } finally {
          cancellation.dispose();
        }
      });
    } catch (cause) {
      if (cause instanceof MemoryOSAdapterError
          && cause.code === MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CANCELLED) {
        return undefined;
      }
      if (cause instanceof MemoryOSProductCliError) {
        this.#presentFailure(cause.code, title);
        throw cause;
      }
      const error = asMemoryOSAdapterError(cause);
      this.#presentFailure(error.code, title);
      throw error;
    } finally {
      this.#busy = false;
    }
  }

  #presentFailure(code: string, operation: string): void {
    this.presentation.reportError(code, operation);
    const presentedCode = sanitizePresentationText(code, 128);
    void vscode.window.showErrorMessage(`MemoryOS operation failed (${presentedCode}).`);
  }
}

export interface MemoryOSVSCodeProduct extends ExtensionCommandAdapter, vscode.Disposable {
  dispose(): Promise<void>;
}

export function createMemoryOSVSCodeProduct(cliAdapter: MemoryOSCliAdapter): MemoryOSVSCodeProduct {
  const presentation = new VSCodePresentation();
  const controller = createMemoryOSProductController({ cliAdapter, publicationSink: presentation });
  const commands = new VSCodeCommands(controller, presentation);
  let disposed = false;
  return Object.freeze({
    evaluatePolicyArtifact: (uri?: vscode.Uri) => commands.evaluatePolicyArtifact(uri),
    preparePolicyArtifact: (uri?: vscode.Uri) => commands.preparePolicyArtifact(uri),
    showContractIdentities: () => commands.showContractIdentities(),
    verifyEvaluationIdentity: (uri?: vscode.Uri) => commands.verifyEvaluationIdentity(uri),
    verifyPolicyOutcome: (uri?: vscode.Uri) => commands.verifyPolicyOutcome(uri),
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      await controller.dispose();
      presentation.dispose();
    },
  });
}
