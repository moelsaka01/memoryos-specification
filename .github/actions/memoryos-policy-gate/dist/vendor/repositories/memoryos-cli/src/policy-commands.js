import { readFileSync } from "node:fs";

import { CliError, ExitCode, packageError } from "./errors.js";
import { publishEvaluationGeneration, publishFiles } from "./policy-publication.js";

const CANDIDATE_IDENTIFIER = "memoryos-policy-evaluation-candidate";
const BASELINE_IDENTIFIER = "memoryos-policy-evaluation-baseline";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function readBytes(path, label, stdin) {
  try {
    const value = path === "-" ? stdin() : readFileSync(path);
    return Uint8Array.from(value);
  } catch (error) {
    throw packageError(
      `Unable to read ${label} '${path}'.`,
      error?.code ?? "POLICY_INPUT_READ_FAILED",
    );
  }
}

function digestBytes(value) {
  if (!DIGEST_PATTERN.test(value)) {
    throw new TypeError("The SDK returned an invalid normative digest.");
  }
  return Uint8Array.from(Buffer.from(value, "ascii"));
}

function prepareSelected(memory, options, stdin) {
  if (options.policy !== undefined) {
    return {
      artifact: memory.preparePolicy(readBytes(options.policy, "Policy", stdin)),
      artifactType: "policy",
    };
  }
  return {
    artifact: memory.preparePolicySet(readBytes(options["policy-set"], "Policy Set", stdin)),
    artifactType: "policySet",
  };
}

function importPackage(memory, path, identifier, stdin) {
  const bytes = readBytes(path, "Memory Investigation Package", stdin);
  try {
    return memory.importPackage(bytes, { identifier });
  } catch (error) {
    if (error?.name !== "MemoryInvestigationPackageError") throw error;
    const details = Array.isArray(error.diagnostics) ? error.diagnostics : [];
    const code = typeof error.code === "string"
      ? error.code
      : (typeof details[0]?.code === "string" ? details[0].code : "MIP_VALIDATION_FAILED");
    throw new CliError(
      ExitCode.validationFailure,
      code,
      error.message ?? "Memory Investigation Package validation failed.",
      details,
      {
        artifactKind: "MemoryInvestigationPackage",
        failureClass: "preparation",
        phase: "evaluationInput",
      },
    );
  }
}

function acquireEvaluationInput(memory, options, stdin) {
  const prepared = prepareSelected(memory, options, stdin);
  const candidate = importPackage(memory, options.package, CANDIDATE_IDENTIFIER, stdin);
  if (options["regression-baseline"] === undefined) {
    return {
      ...prepared,
      context: memory.capturePolicyFactContext(candidate),
      evaluationOptions: {},
    };
  }

  const baseline = importPackage(
    memory,
    options["regression-baseline"],
    BASELINE_IDENTIFIER,
    stdin,
  );
  const bundle = memory.captureRegressionPolicyFacts(baseline, candidate);
  return {
    ...prepared,
    context: bundle.policyFactContext,
    evaluationOptions: { regressionSource: bundle.regressionPolicyFactSource },
  };
}

function preparedSummary(artifact, includeDigests) {
  return {
    artifactKind: artifact.kind,
    artifactVersion: artifact.version,
    ...(includeDigests ? {
      documentDigest: artifact.documentDigest,
      semanticDigest: artifact.semanticDigest,
    } : { valid: true }),
  };
}

function inspectionSummary(kind, value) {
  if (kind === "context") {
    return {
      artifactKind: value.kind,
      artifactVersion: value.version,
      authority: "inspectionOnly",
      contextDigest: value.contextDigest,
      factModelVersion: value.factModelVersion,
    };
  }
  if (kind === "regression-source") {
    return {
      artifactKind: value.kind,
      artifactVersion: value.version,
      authority: "inspectionOnly",
      domain: value.domain,
      sourceDigest: value.sourceDigest,
      sourceModelVersion: value.sourceModelVersion,
    };
  }
  if (kind === "regression-report") {
    return {
      artifactKind: value.kind,
      artifactVersion: value.version,
      authority: "inspectionOnly",
      reportIdentifier: value.reportIdentifier,
    };
  }
  if (kind === "evaluation-identity") {
    return {
      artifactKind: value.artifactKind,
      artifactVersion: value.artifactVersion,
      authority: "inspectionOnly",
      evaluationIdentityDigest: value.evaluationIdentityDigest,
    };
  }
  return {
    artifactKind: value.artifactKind,
    artifactVersion: value.artifactVersion,
    authority: "inspectionOnly",
    decision: value.decision,
    evaluationIdentityDigest: value.evaluationIdentityDigest,
    outcomeDigest: value.outcomeDigest,
  };
}

function verificationSummary(value, includeOutcome) {
  return {
    ...(value.decision === undefined ? {} : { decision: value.decision }),
    evaluationIdentityDigest: value.evaluationIdentityDigest,
    ...(includeOutcome ? { outcomeDigest: value.outcomeDigest } : {}),
    verificationScope: value.verificationScope,
    verified: true,
  };
}

function evaluate(memory, input) {
  return input.artifactType === "policy"
    ? memory.evaluatePolicy(input.artifact, input.context, input.evaluationOptions)
    : memory.evaluatePolicySet(input.artifact, input.context, input.evaluationOptions);
}

function publicationFor(evaluation, options) {
  const outputs = [];
  if (options["identity-output"] !== undefined) {
    outputs.push({
      bytes: evaluation.evaluationIdentityBytes(),
      path: options["identity-output"],
      role: "evaluationIdentity",
    });
  }
  if (options["evaluation-identity-digest-output"] !== undefined) {
    outputs.push({
      bytes: digestBytes(evaluation.evaluationIdentityDigest),
      path: options["evaluation-identity-digest-output"],
      role: "evaluationIdentityDigest",
    });
  }
  if (options["outcome-digest-output"] !== undefined) {
    outputs.push({
      bytes: digestBytes(evaluation.outcomeDigest),
      path: options["outcome-digest-output"],
      role: "outcomeDigest",
    });
  }
  if (options.outcome !== "-") {
    outputs.push({
      bytes: evaluation.canonicalOutcomeBytes(),
      path: options.outcome,
      role: "outcome",
    });
  }
  return outputs;
}

function executeInspect(memory, options, stdin) {
  if (options.context !== undefined) {
    return inspectionSummary(
      "context",
      memory.inspectPolicyFactContext(readBytes(options.context, "PolicyFactContext", stdin)),
    );
  }
  if (options["regression-source"] !== undefined) {
    return inspectionSummary(
      "regression-source",
      memory.inspectRegressionPolicyFactSource(
        readBytes(options["regression-source"], "RegressionPolicyFactSource", stdin),
      ),
    );
  }
  if (options["regression-report"] !== undefined) {
    return inspectionSummary(
      "regression-report",
      memory.inspectRegressionReport(
        readBytes(options["regression-report"], "Regression report", stdin),
      ),
    );
  }
  if (options["evaluation-identity"] !== undefined) {
    return inspectionSummary(
      "evaluation-identity",
      memory.verifyEvaluationIdentityArtifact(
        readBytes(options["evaluation-identity"], "Evaluation Identity", stdin),
      ),
    );
  }
  return inspectionSummary(
    "outcome",
    memory.verifyPolicyEvaluationOutcomeArtifact(
      readBytes(options.outcome, "Policy evaluation outcome", stdin),
      {},
    ),
  );
}

function executeVerifyIdentity(memory, options, positionals, stdin) {
  const bytes = readBytes(positionals[0], "Evaluation Identity", stdin);
  if (options.mode === "artifact") {
    return verificationSummary(memory.verifyEvaluationIdentityArtifact(
      bytes,
      options["expected-evaluation-identity-digest"],
    ), false);
  }
  const input = acquireEvaluationInput(memory, options, stdin);
  return verificationSummary(memory.verifyEvaluationIdentityForEvaluation(
    bytes,
    input.artifact,
    input.context,
    input.evaluationOptions,
  ), false);
}

function executeVerifyOutcome(memory, options, positionals, stdin) {
  const bytes = readBytes(positionals[0], "Policy evaluation outcome", stdin);
  if (options.mode === "artifact") {
    const request = {
      ...(options["expected-identity"] === undefined ? {
        expectedEvaluationIdentityDigest: options["expected-evaluation-identity-digest"],
      } : {
        expectedIdentity: readBytes(options["expected-identity"], "Evaluation Identity", stdin),
      }),
      ...(options["expected-outcome-digest"] === undefined ? {} : {
        expectedOutcomeDigest: options["expected-outcome-digest"],
      }),
    };
    return verificationSummary(
      memory.verifyPolicyEvaluationOutcomeArtifact(bytes, request),
      true,
    );
  }

  const input = acquireEvaluationInput(memory, options, stdin);
  return verificationSummary(memory.verifyPolicyEvaluationOutcomeForEvaluation(
    bytes,
    input.artifact,
    input.context,
    {
      ...input.evaluationOptions,
      ...(options["expected-outcome-digest"] === undefined ? {} : {
        expectedOutcomeDigest: options["expected-outcome-digest"],
      }),
    },
  ), true);
}

export function executePolicyCommand(memory, parsed, io = {}) {
  const { subcommand, options, positionals } = parsed;
  const stdin = io.stdin;
  if (subcommand === "identities") return { result: memory.policyContractIdentities() };

  if (subcommand === "validate" || subcommand === "digest") {
    const { artifact } = prepareSelected(memory, options, stdin);
    if (subcommand === "digest" && options["canonical-output"] !== undefined) {
      publishFiles([{
        bytes: artifact.toBytes(),
        path: options["canonical-output"],
        role: "canonicalArtifact",
      }]);
    }
    return { result: preparedSummary(artifact, subcommand === "digest") };
  }

  if (subcommand === "inspect") {
    return { result: executeInspect(memory, options, stdin) };
  }
  if (subcommand === "verify-identity") {
    return { result: executeVerifyIdentity(memory, options, positionals, stdin) };
  }
  if (subcommand === "verify-outcome") {
    return { result: executeVerifyOutcome(memory, options, positionals, stdin) };
  }

  const input = acquireEvaluationInput(memory, options, stdin);
  const evaluation = evaluate(memory, input);
  publishEvaluationGeneration(publicationFor(evaluation, options));
  const result = {
    decision: evaluation.decision,
    evaluationIdentityDigest: evaluation.evaluationIdentityDigest,
    outcomeDigest: evaluation.outcomeDigest,
  };
  if (options.outcome === "-") {
    return { decision: evaluation.decision, raw: evaluation.canonicalOutcomeBytes(), result };
  }
  return { decision: evaluation.decision, result };
}

export const policyEvaluationIdentifiers = Object.freeze({
  baseline: BASELINE_IDENTIFIER,
  candidate: CANDIDATE_IDENTIFIER,
});
