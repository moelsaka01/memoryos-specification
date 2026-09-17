import type { LocalFileInput } from "../runtime/input-snapshot.js";

export type PolicyArtifactKind = "policy" | "policySet";
export type PolicyDecision = "PASS" | "FAIL" | "COULD_NOT_EVALUATE";
export type VerificationMode = "artifact" | "evaluation";

export type ProductInputRole =
  | "policy"
  | "policySet"
  | "candidateMip"
  | "baselineMip"
  | "evaluationIdentity"
  | "expectedEvaluationIdentity"
  | "policyOutcome";

/** A selected URI is presentation metadata and never establishes authority. */
export interface SelectedLocalArtifact {
  readonly input: LocalFileInput;
  readonly uri: string;
}

export interface PolicySelection {
  readonly artifact: SelectedLocalArtifact;
  readonly kind: PolicyArtifactKind;
}

export interface EvaluationSelection {
  readonly baselineMip?: SelectedLocalArtifact;
  readonly candidateMip: SelectedLocalArtifact;
  readonly policy: PolicySelection;
}

/** A narrow VS Code-facing acquisition boundary; it owns prompts, not semantics. */
export interface ProductInputAcquirer {
  selectPolicyKind(signal: AbortSignal): Promise<PolicyArtifactKind | undefined>;
  selectVerificationMode(signal: AbortSignal): Promise<VerificationMode | undefined>;
  selectLocalArtifact(role: ProductInputRole, signal: AbortSignal): Promise<SelectedLocalArtifact | undefined>;
  requestDigest(role: "evaluationIdentity" | "policyOutcome", signal: AbortSignal): Promise<string | undefined>;
  confirmOptionalBaseline(signal: AbortSignal): Promise<boolean | undefined>;
}

export interface PreparedArtifactResult {
  readonly documentDigest: string;
  readonly kind: PolicyArtifactKind;
  readonly semanticDigest: string;
  readonly sourceUri: string;
  readonly state: "Prepared";
}

export interface ContractIdentitiesResult {
  readonly canonicalText: string;
  readonly contractArtifactSha256: string;
  readonly identities: Readonly<Record<string, unknown>>;
  readonly runtimeClosureDigest: string;
}

export interface EvaluationGeneration {
  readonly decision: PolicyDecision;
  readonly evaluationIdentityCanonicalText: string;
  readonly evaluationIdentityDigest: string;
  readonly evaluationIdentityValue: Readonly<Record<string, unknown>>;
  readonly outcomeCanonicalText: string;
  readonly outcomeDigest: string;
  readonly outcomeValue: Readonly<Record<string, unknown>>;
}

export interface EvaluationResult extends EvaluationGeneration {
  readonly baselineMipUri?: string;
  readonly candidateMipUri: string;
  readonly policyDocumentDigest: string;
  readonly policyKind: PolicyArtifactKind;
  readonly policySemanticDigest: string;
  readonly policyUri: string;
}

export interface VerificationResult {
  readonly canonicalText: string;
  readonly decision?: PolicyDecision;
  readonly evaluationIdentityDigest: string;
  readonly mode: VerificationMode;
  readonly outcomeDigest?: string;
  readonly sourceUri: string;
  readonly state: "Verified";
  readonly target: "evaluationIdentity" | "policyOutcome";
  readonly verificationScope: "serializedArtifact" | "authoritativeReconstruction";
}

export type ProductOperationKind =
  | "showContractIdentities"
  | "preparePolicyArtifact"
  | "evaluatePolicyArtifact"
  | "verifyEvaluationIdentity"
  | "verifyPolicyOutcome";

export type ProductOperationResult = ContractIdentitiesResult | PreparedArtifactResult | EvaluationResult | VerificationResult;

export interface ProductPublication<T extends ProductOperationResult = ProductOperationResult> {
  readonly operationKind: ProductOperationKind;
  readonly operationToken: string;
  readonly result: T;
}

/** Implementations atomically replace their complete presentation in publish(). */
export interface ProductPublicationSink {
  /** Synchronous so cancellation cannot interleave with an atomic UI replacement. */
  publish(publication: ProductPublication): void;
}

export interface PreparePolicyRequest { readonly policy: PolicySelection; }
export interface EvaluatePolicyRequest extends EvaluationSelection {}

export type VerifyEvaluationIdentityRequest =
  | Readonly<{ identity: SelectedLocalArtifact; mode: "artifact"; expectedEvaluationIdentityDigest: string }>
  | Readonly<{ evaluation: EvaluationSelection; identity: SelectedLocalArtifact; mode: "evaluation" }>;

export type VerifyPolicyOutcomeRequest =
  | Readonly<{
    expectedEvaluationIdentityDigest?: string;
    expectedIdentity?: SelectedLocalArtifact;
    expectedOutcomeDigest?: string;
    mode: "artifact";
    outcome: SelectedLocalArtifact;
  }>
  | Readonly<{
    evaluation: EvaluationSelection;
    expectedOutcomeDigest?: string;
    mode: "evaluation";
    outcome: SelectedLocalArtifact;
  }>;
