import type { PossessedArtifactNavigation } from "./navigation.js";

export type MemoryOSDecision = "PASS" | "FAIL" | "COULD_NOT_EVALUATE";

export interface MemoryOSPresentationField {
  readonly name: string;
  readonly value: string;
}

export interface PolicyFactContextEvidenceSource {
  readonly kind: "policyFactContext";
  readonly contextDigest: string;
}

export interface DeterministicFactSourceEvidenceSource {
  readonly kind: "deterministicFactSource";
  readonly externalSourceDigest: string;
}

export type MemoryOSEvidenceSource =
  | PolicyFactContextEvidenceSource
  | DeterministicFactSourceEvidenceSource;

interface EvidenceBase {
  readonly domain: string;
}

export interface CorePolicyFactReferenceEvidence extends EvidenceBase {
  readonly kind: "MemoryOSPolicyFactReference";
  readonly source: PolicyFactContextEvidenceSource;
  readonly factIdentifier: string;
  readonly factDomain?: never;
}

export interface ExternalPolicyFactReferenceEvidence extends EvidenceBase {
  readonly kind: "MemoryOSPolicyFactReference";
  readonly source: DeterministicFactSourceEvidenceSource;
  readonly factDomain: string;
  readonly factIdentifier: string;
}

export interface MemoryOSPolicyEvidenceSelector {
  readonly identifier: string;
  readonly version: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface CorePolicyFactSelectionEvidence extends EvidenceBase {
  readonly kind: "MemoryOSPolicyFactSelection";
  readonly source: PolicyFactContextEvidenceSource;
  readonly factDomain?: never;
  readonly selector: MemoryOSPolicyEvidenceSelector;
  readonly matchCount: number;
  readonly matchedFactIdentifiers: readonly string[];
}

export interface ExternalPolicyFactSelectionEvidence extends EvidenceBase {
  readonly kind: "MemoryOSPolicyFactSelection";
  readonly source: DeterministicFactSourceEvidenceSource;
  readonly factDomain: string;
  readonly selector: MemoryOSPolicyEvidenceSelector;
  readonly matchCount: number;
  readonly matchedFactIdentifiers: readonly string[];
}

export interface MemoryOSPolicyFactDomainStateEvidence extends EvidenceBase {
  readonly kind: "MemoryOSPolicyFactDomainState";
  readonly source: PolicyFactContextEvidenceSource;
  readonly availability: "notApplicable" | "unavailable";
}

export interface MemoryOSDeterministicFactSourceAbsenceEvidence extends EvidenceBase {
  readonly kind: "MemoryOSDeterministicFactSourceAbsence";
}

/** The complete, closed MO-1303 v1 evidence presentation union. */
export type MemoryOSPolicyEvidence =
  | CorePolicyFactReferenceEvidence
  | ExternalPolicyFactReferenceEvidence
  | CorePolicyFactSelectionEvidence
  | ExternalPolicyFactSelectionEvidence
  | MemoryOSPolicyFactDomainStateEvidence
  | MemoryOSDeterministicFactSourceAbsenceEvidence;

export interface MemoryOSPresentedEvidence {
  readonly evidence: MemoryOSPolicyEvidence;
  /** Whole-artifact navigation only; never a claimed fact byte range. */
  readonly navigation?: PossessedArtifactNavigation;
}

export interface MemoryOSRulePresentation {
  readonly ruleIdentifier: string;
  readonly ruleType: string;
  readonly ruleVersion: string;
  readonly decision: MemoryOSDecision;
  readonly decisionCode?: string;
  /** Normative evidence order is retained exactly. */
  readonly evidence: readonly MemoryOSPresentedEvidence[];
}

export interface MemoryOSPolicyPresentation {
  readonly policyIdentifier: string;
  readonly policySemanticDigest: string;
  readonly decision: MemoryOSDecision;
  /** Authored/evaluated rule order is retained exactly. */
  readonly rules: readonly MemoryOSRulePresentation[];
}

export interface MemoryOSContractsPresentation {
  /** The already-validated normative identity projection in source order. */
  readonly fields: readonly MemoryOSPresentationField[];
  readonly document?: PossessedArtifactNavigation;
}

export interface MemoryOSPreparedArtifactPresentation {
  readonly artifactKind: string;
  readonly documentDigest: string;
  readonly semanticDigest: string;
  readonly state: "Prepared";
  readonly sourceArtifact: PossessedArtifactNavigation;
}

export interface MemoryOSEvaluationPresentation {
  readonly decision: MemoryOSDecision;
  readonly artifactKind: "Policy" | "Policy Set";
  readonly artifactIdentifier: string;
  readonly semanticDigest: string;
  readonly evaluationIdentityDigest: string;
  readonly outcomeDigest: string;
  /** Result-envelope fields such as the frozen resource-CNE code and limit. */
  readonly resultFields?: readonly MemoryOSPresentationField[];
  /** One element for Policy and authored child order for Policy Set. */
  readonly policies: readonly MemoryOSPolicyPresentation[];
  readonly selectedArtifacts: readonly PossessedArtifactNavigation[];
  readonly identityDocument: PossessedArtifactNavigation;
  readonly outcomeDocument: PossessedArtifactNavigation;
}

export interface MemoryOSVerificationPresentation {
  readonly target: "Evaluation Identity" | "Policy Outcome";
  readonly mode: "artifact" | "evaluation";
  readonly state: "Verified";
  readonly fields: readonly MemoryOSPresentationField[];
  readonly document?: PossessedArtifactNavigation;
}

/**
 * A complete immutable publication candidate. Callers build this only from
 * verified adapter results; the presentation layer does not evaluate it.
 */
export interface MemoryOSPresentationSnapshot {
  readonly contracts?: MemoryOSContractsPresentation;
  readonly preparedArtifact?: MemoryOSPreparedArtifactPresentation;
  readonly evaluation?: MemoryOSEvaluationPresentation;
  readonly verification?: MemoryOSVerificationPresentation;
}
