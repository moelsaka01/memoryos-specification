import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

import {
  MEMORYOS_VSCODE_ADAPTER_ERROR_CODES,
  MemoryOSAdapterError,
} from "../errors.js";
import { canonicalJson, rawSha256 } from "../runtime/canonical-json.js";
import type {
  CliExecutionResult,
  MemoryOSCliAdapter,
  PolicyArtifact,
  PolicyCliRequest,
} from "../runtime/cli-adapter.js";
import {
  createOperationInputSnapshot,
  POLICY_VERIFICATION_ARTIFACT_MAX_BYTES,
  type LocalFileInput,
  type OperationCapability,
  type OperationInputSnapshot,
} from "../runtime/input-snapshot.js";
import type {
  ContractIdentitiesResult,
  EvaluatePolicyRequest,
  EvaluationResult,
  EvaluationSelection,
  PolicyDecision,
  PolicySelection,
  PreparePolicyRequest,
  PreparedArtifactResult,
  ProductPublicationSink,
  VerificationResult,
  VerifyEvaluationIdentityRequest,
  VerifyPolicyOutcomeRequest,
} from "./contracts.js";
import { ProductOperationCoordinator } from "./operation-coordinator.js";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SIDECAR_BYTES = 71;

export interface MemoryOSProductControllerOptions {
  readonly cliAdapter: MemoryOSCliAdapter;
  readonly publicationSink?: ProductPublicationSink;
  readonly snapshotFactory?: () => Promise<OperationInputSnapshot>;
}

export interface MemoryOSProductController {
  showContractIdentities(signal?: AbortSignal): Promise<ContractIdentitiesResult>;
  preparePolicyArtifact(request: PreparePolicyRequest, signal?: AbortSignal): Promise<PreparedArtifactResult>;
  evaluatePolicyArtifact(request: EvaluatePolicyRequest, signal?: AbortSignal): Promise<EvaluationResult>;
  verifyEvaluationIdentity(request: VerifyEvaluationIdentityRequest, signal?: AbortSignal): Promise<VerificationResult>;
  verifyPolicyOutcome(request: VerifyPolicyOutcomeRequest, signal?: AbortSignal): Promise<VerificationResult>;
  cancelActive(): void;
  dispose(): Promise<void>;
}

/** A stable CLI failure remains separate from both adapter failures and Policy decisions. */
export class MemoryOSProductCliError extends Error {
  readonly code: string;
  readonly execution: CliExecutionResult;

  constructor(code: string, execution: CliExecutionResult) {
    super(`The MemoryOS CLI rejected the requested operation (${code}).`);
    this.name = "MemoryOSProductCliError";
    this.code = code;
    this.execution = execution;
  }
}

function outputInvalid(message: string, cause?: unknown): MemoryOSAdapterError {
  return new MemoryOSAdapterError(
    MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function assertNotCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new MemoryOSAdapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CANCELLED,
      "The MemoryOS operation was cancelled.",
    );
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw outputInvalid(`${label} is not an object.`);
  }
  return value as Record<string, unknown>;
}

function stringMember(value: Record<string, unknown>, member: string, label: string): string {
  const result = value[member];
  if (typeof result !== "string") throw outputInvalid(`${label}.${member} is invalid.`);
  return result;
}

function digestMember(value: Record<string, unknown>, member: string, label: string): string {
  const result = stringMember(value, member, label);
  if (!DIGEST.test(result)) throw outputInvalid(`${label}.${member} is not a digest.`);
  return result;
}

function decisionMember(value: Record<string, unknown>, member: string, label: string): PolicyDecision {
  const result = value[member];
  if (result !== "PASS" && result !== "FAIL" && result !== "COULD_NOT_EVALUATE") {
    throw outputInvalid(`${label}.${member} is not a normative Policy decision.`);
  }
  return result;
}

function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function cliResult(execution: CliExecutionResult): Record<string, unknown> {
  if (!execution.envelope.ok) {
    if (execution.memoryOSCode === undefined) {
      throw outputInvalid("The CLI failure did not preserve a stable machine code.");
    }
    throw new MemoryOSProductCliError(execution.memoryOSCode, execution);
  }
  return record(execution.envelope.result, "CLI result");
}

function privateFile(path: string): LocalFileInput {
  return Object.freeze({ dirty: false, fsPath: path, scheme: "file", untitled: false });
}

function policyArtifact(selection: PolicySelection, path: string): PolicyArtifact {
  return Object.freeze({ kind: selection.kind, path });
}

async function readStablePrivateFile(path: string, maximumBytes: number, label: string): Promise<Buffer> {
  let handle;
  try {
    const before = await lstat(path, { bigint: true });
    if (before.isSymbolicLink() || !before.isFile() || before.size < 1n || before.size > BigInt(maximumBytes)) {
      throw new Error(`${label} metadata is invalid`);
    }
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    handle = await open(path, constants.O_RDONLY | noFollow);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.size !== before.size
        || (before.ino !== 0n && opened.ino !== 0n && before.ino !== opened.ino)
        || (before.dev !== 0n && opened.dev !== 0n && before.dev !== opened.dev)
        || opened.mtimeNs !== before.mtimeNs || opened.ctimeNs !== before.ctimeNs) {
      throw new Error(`${label} changed while opening`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (BigInt(bytes.length) !== before.size || after.size !== before.size
        || (before.ino !== 0n && after.ino !== 0n && before.ino !== after.ino)
        || (before.dev !== 0n && after.dev !== 0n && before.dev !== after.dev)
        || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs) {
      throw new Error(`${label} changed while reading`);
    }
    return bytes;
  } catch (cause) {
    throw outputInvalid(`${label} is absent, substituted, or incomplete.`, cause);
  } finally {
    await handle?.close();
  }
}

function parseCanonicalArtifact(bytes: Buffer, label: string): Readonly<Record<string, unknown>> {
  const text = bytes.toString("utf8");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw outputInvalid(`${label} is not JSON.`, cause);
  }
  const artifact = record(value, label);
  try {
    if (canonicalJson(artifact) !== text) throw new Error("non-canonical bytes");
  } catch (cause) {
    throw outputInvalid(`${label} is not the exact canonical artifact.`, cause);
  }
  return freezeJson(artifact);
}

function parseDigestSidecar(bytes: Buffer, label: string): string {
  if (bytes.length !== SIDECAR_BYTES) throw outputInvalid(`${label} has an invalid byte length.`);
  const value = bytes.toString("ascii");
  if (!DIGEST.test(value)) throw outputInvalid(`${label} is not a lowercase SHA-256 digest.`);
  return value;
}

async function acquireEvaluationInputs(
  snapshot: OperationInputSnapshot,
  selection: EvaluationSelection,
  signal: AbortSignal,
): Promise<{
  artifact: PolicyArtifact;
  baselinePath?: string;
  baselineRawSha256?: string;
  candidatePath: string;
  candidateRawSha256: string;
  policyRawSha256: string;
}> {
  const policy = await snapshot.acquire(selection.policy.kind, selection.policy.artifact.input, signal);
  const candidate = await snapshot.acquire("candidateMip", selection.candidateMip.input, signal);
  const baseline = selection.baselineMip === undefined
    ? undefined
    : await snapshot.acquire("baselineMip", selection.baselineMip.input, signal);
  return {
    artifact: policyArtifact(selection.policy, policy.path),
    ...(baseline === undefined ? {} : { baselinePath: baseline.path, baselineRawSha256: baseline.sha256 }),
    candidatePath: candidate.path,
    candidateRawSha256: candidate.sha256,
    policyRawSha256: policy.sha256,
  };
}

async function useSnapshot<T>(
  factory: () => Promise<OperationInputSnapshot>,
  work: (snapshot: OperationInputSnapshot) => Promise<T>,
): Promise<T> {
  const snapshot = await factory();
  try {
    return await work(snapshot);
  } finally {
    await snapshot.dispose();
  }
}

class ProductController implements MemoryOSProductController {
  readonly #adapter: MemoryOSCliAdapter;
  readonly #coordinator: ProductOperationCoordinator;
  readonly #snapshotFactory: () => Promise<OperationInputSnapshot>;
  #disposePromise: Promise<void> | undefined;

  constructor(options: MemoryOSProductControllerOptions) {
    this.#adapter = options.cliAdapter;
    this.#snapshotFactory = options.snapshotFactory ?? createOperationInputSnapshot;
    this.#coordinator = new ProductOperationCoordinator(options.publicationSink);
  }

  showContractIdentities(signal?: AbortSignal): Promise<ContractIdentitiesResult> {
    return this.#coordinator.run("showContractIdentities", signal, async (operationSignal) => {
      const value = await this.#adapter.preflight(operationSignal);
      assertNotCancelled(operationSignal);
      const identities = freezeJson(value.identities);
      return Object.freeze({
        canonicalText: canonicalJson(identities),
        contractArtifactSha256: value.contractArtifactSha256,
        identities,
        runtimeClosureDigest: value.runtimeClosureDigest,
      });
    });
  }

  preparePolicyArtifact(request: PreparePolicyRequest, signal?: AbortSignal): Promise<PreparedArtifactResult> {
    return this.#coordinator.run("preparePolicyArtifact", signal, (operationSignal) =>
      this.#prepare(request.policy, operationSignal));
  }

  evaluatePolicyArtifact(request: EvaluatePolicyRequest, signal?: AbortSignal): Promise<EvaluationResult> {
    return this.#coordinator.run("evaluatePolicyArtifact", signal, async (operationSignal) => {
      return useSnapshot(this.#snapshotFactory, async (generation) => {
        const inputs = await acquireEvaluationInputs(generation, request, operationSignal);
        // Preparation and evaluation consume the exact same acquired Policy
        // bytes. A user-file mutation between two snapshots can therefore
        // never produce a mixed document/semantic identity in the UI result.
        const prepared = await this.#prepareAcquired(
          request.policy,
          inputs.artifact,
          generation.capability,
          operationSignal,
        );
        const identityPath = generation.reserveOutput("evaluationIdentity");
        const identityDigestPath = generation.reserveOutput("evaluationIdentityDigest");
        const outcomeDigestPath = generation.reserveOutput("outcomeDigest");
        const outcomePath = generation.reserveOutput("outcome");
        const execution = await this.#adapter.execute(Object.freeze({
          artifact: inputs.artifact,
          evaluationIdentityDigestOutputPath: identityDigestPath,
          identityOutputPath: identityPath,
          kind: "evaluate",
          operation: generation.capability,
          outcomeDigestOutputPath: outcomeDigestPath,
          outcomePath,
          packagePath: inputs.candidatePath,
          ...(inputs.baselinePath === undefined ? {} : { regressionBaselinePath: inputs.baselinePath }),
        }), operationSignal);
        const summary = cliResult(execution);
        const decision = decisionMember(summary, "decision", "evaluation result");
        const evaluationIdentityDigest = digestMember(summary, "evaluationIdentityDigest", "evaluation result");
        const outcomeDigest = digestMember(summary, "outcomeDigest", "evaluation result");
        assertNotCancelled(operationSignal);

        // Outcome is read last: it is the normative generation commit marker.
        const identityBytes = await readStablePrivateFile(identityPath, POLICY_VERIFICATION_ARTIFACT_MAX_BYTES, "Evaluation Identity");
        const identityDigestBytes = await readStablePrivateFile(identityDigestPath, SIDECAR_BYTES, "Evaluation Identity digest sidecar");
        const outcomeDigestBytes = await readStablePrivateFile(outcomeDigestPath, SIDECAR_BYTES, "Outcome digest sidecar");
        const outcomeBytes = await readStablePrivateFile(outcomePath, POLICY_VERIFICATION_ARTIFACT_MAX_BYTES, "Policy outcome commit marker");
        const identityValue = parseCanonicalArtifact(identityBytes, "Evaluation Identity");
        const outcomeValue = parseCanonicalArtifact(outcomeBytes, "Policy outcome");
        const identitySidecar = parseDigestSidecar(identityDigestBytes, "Evaluation Identity digest sidecar");
        const outcomeSidecar = parseDigestSidecar(outcomeDigestBytes, "Outcome digest sidecar");
        if (identitySidecar !== evaluationIdentityDigest || outcomeSidecar !== outcomeDigest) {
          throw outputInvalid("The evaluation envelope and generation sidecars disagree.");
        }
        const embeddedIdentity = record(outcomeValue.evaluationIdentity, "embedded Evaluation Identity");
        if (canonicalJson(embeddedIdentity) !== identityBytes.toString("utf8")) {
          throw outputInvalid("The standalone and embedded Evaluation Identities differ.");
        }
        if (outcomeValue.evaluationIdentityDigest !== evaluationIdentityDigest
            || outcomeValue.version !== embeddedIdentity.outcomeContractVersion) {
          throw outputInvalid("The outcome root and Evaluation Identity cross-binding is invalid.");
        }
        const evaluatedArtifact = record(identityValue.evaluatedArtifact, "evaluated artifact identity");
        if (evaluatedArtifact.semanticDigest !== prepared.semanticDigest) {
          throw outputInvalid("The selected Policy semantic digest differs from the Evaluation Identity.");
        }
        const outcomeResult = record(outcomeValue.result, "outcome result");
        if (outcomeResult.decision !== decision) throw outputInvalid("The outcome and evaluation envelope decisions disagree.");

        await this.#verifyCompleteGeneration(
          request.policy.kind,
          inputs.artifact.path,
          inputs.policyRawSha256,
          inputs.candidatePath,
          inputs.candidateRawSha256,
          inputs.baselinePath,
          inputs.baselineRawSha256,
          identityPath,
          rawSha256(identityBytes),
          outcomePath,
          rawSha256(outcomeBytes),
          evaluationIdentityDigest,
          outcomeDigest,
          decision,
          operationSignal,
        );
        assertNotCancelled(operationSignal);
        return Object.freeze({
          ...(request.baselineMip === undefined ? {} : { baselineMipUri: request.baselineMip.uri }),
          candidateMipUri: request.candidateMip.uri,
          decision,
          evaluationIdentityCanonicalText: identityBytes.toString("utf8"),
          evaluationIdentityDigest,
          evaluationIdentityValue: identityValue,
          outcomeCanonicalText: outcomeBytes.toString("utf8"),
          outcomeDigest,
          outcomeValue,
          policyDocumentDigest: prepared.documentDigest,
          policyKind: request.policy.kind,
          policySemanticDigest: prepared.semanticDigest,
          policyUri: request.policy.artifact.uri,
        });
      });
    });
  }

  verifyEvaluationIdentity(request: VerifyEvaluationIdentityRequest, signal?: AbortSignal): Promise<VerificationResult> {
    return this.#coordinator.run("verifyEvaluationIdentity", signal, async (operationSignal) =>
      useSnapshot(this.#snapshotFactory, async (snapshot) => {
        const identity = await snapshot.acquire("evaluationIdentity", request.identity.input, operationSignal);
        let cliRequest: PolicyCliRequest;
        if (request.mode === "artifact") {
          cliRequest = Object.freeze({
            expectedEvaluationIdentityDigest: request.expectedEvaluationIdentityDigest,
            identityPath: identity.path,
            kind: "verifyIdentity",
            mode: "artifact",
            operation: snapshot.capability,
          });
        } else {
          const inputs = await acquireEvaluationInputs(snapshot, request.evaluation, operationSignal);
          cliRequest = Object.freeze({
            artifact: inputs.artifact,
            identityPath: identity.path,
            kind: "verifyIdentity",
            mode: "evaluation",
            operation: snapshot.capability,
            packagePath: inputs.candidatePath,
            ...(inputs.baselinePath === undefined ? {} : { regressionBaselinePath: inputs.baselinePath }),
          });
        }
        const verification = this.#verificationResult(
          await this.#adapter.execute(cliRequest, operationSignal),
          request.mode,
        );
        const identityBytes = await readStablePrivateFile(
          identity.path,
          POLICY_VERIFICATION_ARTIFACT_MAX_BYTES,
          "Verified Evaluation Identity",
        );
        parseCanonicalArtifact(identityBytes, "Verified Evaluation Identity");
        return Object.freeze({
          ...verification,
          canonicalText: identityBytes.toString("utf8"),
          sourceUri: request.identity.uri,
          target: "evaluationIdentity" as const,
        });
      }));
  }

  verifyPolicyOutcome(request: VerifyPolicyOutcomeRequest, signal?: AbortSignal): Promise<VerificationResult> {
    return this.#coordinator.run("verifyPolicyOutcome", signal, async (operationSignal) =>
      useSnapshot(this.#snapshotFactory, async (snapshot) => {
        const outcome = await snapshot.acquire("policyOutcome", request.outcome.input, operationSignal);
        let cliRequest: PolicyCliRequest;
        if (request.mode === "artifact") {
          const expectedIdentity = request.expectedIdentity === undefined
            ? undefined
            : await snapshot.acquire("expectedEvaluationIdentity", request.expectedIdentity.input, operationSignal);
          cliRequest = Object.freeze({
            ...(request.expectedEvaluationIdentityDigest === undefined ? {} : {
              expectedEvaluationIdentityDigest: request.expectedEvaluationIdentityDigest,
            }),
            ...(expectedIdentity === undefined ? {} : { expectedIdentityPath: expectedIdentity.path }),
            ...(request.expectedOutcomeDigest === undefined ? {} : { expectedOutcomeDigest: request.expectedOutcomeDigest }),
            kind: "verifyOutcome",
            mode: "artifact",
            operation: snapshot.capability,
            outcomePath: outcome.path,
          });
        } else {
          const inputs = await acquireEvaluationInputs(snapshot, request.evaluation, operationSignal);
          cliRequest = Object.freeze({
            artifact: inputs.artifact,
            ...(request.expectedOutcomeDigest === undefined ? {} : { expectedOutcomeDigest: request.expectedOutcomeDigest }),
            kind: "verifyOutcome",
            mode: "evaluation",
            operation: snapshot.capability,
            outcomePath: outcome.path,
            packagePath: inputs.candidatePath,
            ...(inputs.baselinePath === undefined ? {} : { regressionBaselinePath: inputs.baselinePath }),
          });
        }
        const verification = this.#verificationResult(
          await this.#adapter.execute(cliRequest, operationSignal),
          request.mode,
        );
        const outcomeBytes = await readStablePrivateFile(
          outcome.path,
          POLICY_VERIFICATION_ARTIFACT_MAX_BYTES,
          "Verified Policy outcome",
        );
        parseCanonicalArtifact(outcomeBytes, "Verified Policy outcome");
        return Object.freeze({
          ...verification,
          canonicalText: outcomeBytes.toString("utf8"),
          sourceUri: request.outcome.uri,
          target: "policyOutcome" as const,
        });
      }));
  }

  cancelActive(): void { this.#coordinator.cancelActive(); }

  dispose(): Promise<void> {
    this.#disposePromise ??= (async () => {
      await this.#coordinator.dispose();
      await this.#adapter.dispose();
    })();
    return this.#disposePromise;
  }

  async #prepare(selection: PolicySelection, signal: AbortSignal): Promise<PreparedArtifactResult> {
    return useSnapshot(this.#snapshotFactory, async (snapshot) => {
      const acquired = await snapshot.acquire(selection.kind, selection.artifact.input, signal);
      return this.#prepareAcquired(
        selection,
        policyArtifact(selection, acquired.path),
        snapshot.capability,
        signal,
      );
    });
  }

  async #prepareAcquired(
    selection: PolicySelection,
    artifact: PolicyArtifact,
    operation: OperationCapability,
    signal: AbortSignal,
  ): Promise<PreparedArtifactResult> {
      const execution = await this.#adapter.execute(Object.freeze({
        artifact,
        kind: "digest",
        operation,
      }), signal);
      const result = cliResult(execution);
      const expectedKind = selection.kind === "policy" ? "MemoryOSInvestigationPolicy" : "MemoryOSInvestigationPolicySet";
      if (result.artifactKind !== expectedKind || result.artifactVersion !== "1.0.0") {
        throw outputInvalid("The prepared artifact kind or version differs from the explicit selection.");
      }
      return Object.freeze({
        documentDigest: digestMember(result, "documentDigest", "preparation result"),
        kind: selection.kind,
        semanticDigest: digestMember(result, "semanticDigest", "preparation result"),
        sourceUri: selection.artifact.uri,
        state: "Prepared" as const,
      });
  }

  #verificationResult(
    execution: CliExecutionResult,
    mode: "artifact" | "evaluation",
  ): Omit<VerificationResult, "canonicalText" | "sourceUri" | "target"> {
    const result = cliResult(execution);
    const expectedScope = mode === "artifact" ? "serializedArtifact" : "authoritativeReconstruction";
    if (result.verified !== true || result.verificationScope !== expectedScope) {
      throw outputInvalid("The verification result scope or verified state is invalid.");
    }
    const evaluationIdentityDigest = digestMember(result, "evaluationIdentityDigest", "verification result");
    const outcomeDigest = result.outcomeDigest === undefined
      ? undefined
      : digestMember(result, "outcomeDigest", "verification result");
    const decision = result.decision === undefined
      ? undefined
      : decisionMember(result, "decision", "verification result");
    return Object.freeze({
      ...(decision === undefined ? {} : { decision }),
      evaluationIdentityDigest,
      mode,
      ...(outcomeDigest === undefined ? {} : { outcomeDigest }),
      state: "Verified" as const,
      verificationScope: expectedScope,
    });
  }

  async #verifyCompleteGeneration(
    policyKind: "policy" | "policySet",
    policyPath: string,
    policyRawSha256: string,
    candidatePath: string,
    candidateRawSha256: string,
    baselinePath: string | undefined,
    baselineRawSha256: string | undefined,
    identityPath: string,
    identityRawSha256: string,
    outcomePath: string,
    outcomeRawSha256: string,
    identityDigest: string,
    outcomeDigest: string,
    decision: PolicyDecision,
    signal: AbortSignal,
  ): Promise<void> {
    await useSnapshot(this.#snapshotFactory, async (snapshot) => {
      const identity = await snapshot.acquire("evaluationIdentity", privateFile(identityPath), signal);
      const expectedIdentity = await snapshot.acquire("expectedEvaluationIdentity", privateFile(identityPath), signal);
      const outcome = await snapshot.acquire("policyOutcome", privateFile(outcomePath), signal);
      // Verification reacquires only the outer operation's private immutable
      // snapshots. It never returns to mutable user-selected source paths.
      const policy = await snapshot.acquire(policyKind, privateFile(policyPath), signal);
      const candidate = await snapshot.acquire("candidateMip", privateFile(candidatePath), signal);
      const baseline = baselinePath === undefined
        ? undefined
        : await snapshot.acquire("baselineMip", privateFile(baselinePath), signal);
      if (identity.sha256 !== identityRawSha256
          || expectedIdentity.sha256 !== identityRawSha256
          || outcome.sha256 !== outcomeRawSha256
          || policy.sha256 !== policyRawSha256
          || candidate.sha256 !== candidateRawSha256
          || baseline?.sha256 !== baselineRawSha256) {
        throw outputInvalid("A private generation input changed before cross-verification.");
      }
      const common = {
        artifact: Object.freeze({ kind: policyKind, path: policy.path }),
        operation: snapshot.capability,
        packagePath: candidate.path,
        ...(baseline === undefined ? {} : { regressionBaselinePath: baseline.path }),
      } as const;
      const artifactIdentity = this.#verificationResult(await this.#adapter.execute(Object.freeze({
        expectedEvaluationIdentityDigest: identityDigest,
        identityPath: identity.path,
        kind: "verifyIdentity",
        mode: "artifact",
        operation: snapshot.capability,
      }), signal), "artifact");
      const artifactOutcome = this.#verificationResult(await this.#adapter.execute(Object.freeze({
        expectedIdentityPath: expectedIdentity.path,
        expectedOutcomeDigest: outcomeDigest,
        kind: "verifyOutcome",
        mode: "artifact",
        operation: snapshot.capability,
        outcomePath: outcome.path,
      }), signal), "artifact");
      const evaluationIdentity = this.#verificationResult(await this.#adapter.execute(Object.freeze({
        ...common,
        identityPath: identity.path,
        kind: "verifyIdentity",
        mode: "evaluation",
      }), signal), "evaluation");
      const evaluationOutcome = this.#verificationResult(await this.#adapter.execute(Object.freeze({
        ...common,
        expectedOutcomeDigest: outcomeDigest,
        kind: "verifyOutcome",
        mode: "evaluation",
        outcomePath: outcome.path,
      }), signal), "evaluation");
      for (const verification of [artifactIdentity, artifactOutcome, evaluationIdentity, evaluationOutcome]) {
        if (verification.evaluationIdentityDigest !== identityDigest
            || (verification.outcomeDigest !== undefined && verification.outcomeDigest !== outcomeDigest)) {
          throw outputInvalid("The complete generation cross-verification digests disagree.");
        }
      }
      if (artifactOutcome.decision !== decision || evaluationOutcome.decision !== decision) {
        throw outputInvalid("The complete generation cross-verification decisions disagree.");
      }
      return undefined;
    });
  }
}

export function createMemoryOSProductController(
  options: MemoryOSProductControllerOptions,
): MemoryOSProductController {
  return new ProductController(options);
}
