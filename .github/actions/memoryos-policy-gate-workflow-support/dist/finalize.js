"use strict";

const fs = require("node:fs");
const { PUBLIC_OUTPUT_NAMES, emitCommand, emptyPublicOutputs, presentationScalar, utf8Prefix } = require("./io.js");

const POSITIVE_DECIMAL = /^[1-9][0-9]*$/u;
const ARTIFACT_NAME = /^memoryos-policy-gate-[1-9][0-9]*-[1-9][0-9]*-[1-9][0-9]*$/u;

function automationFailure(code, phase, retained = {}) {
  return {
    ...emptyPublicOutputs(),
    "gate-class": "tool-failure",
    decision: "",
    "cli-exit-code": retained.cliExitCode ?? "",
    "publication-valid": retained.publicationValid ?? "false",
    "policy-semantic-digest": retained.policySemanticDigest ?? "",
    "evaluation-identity-digest": retained.evaluationIdentityDigest ?? "",
    "outcome-digest": retained.outcomeDigest ?? "",
    "policy-fact-context-digest": retained.policyFactContextDigest ?? "",
    "regression-source-digest": retained.regressionSourceDigest ?? "",
    "stable-code": code,
    "failure-class": "automation",
    phase,
    "artifact-kind": retained.artifactKind ?? "",
    "limit-identifier": retained.limitIdentifier ?? "",
    "distribution-repository": retained.distributionRepository ?? "",
    "distribution-revision": retained.distributionRevision ?? "",
    "artifact-name": "",
    "artifact-id": "",
  };
}

function retainedFields(input) {
  return {
    cliExitCode: input.cliExitCode,
    publicationValid: input.publicationValid,
    policySemanticDigest: input.policySemanticDigest,
    evaluationIdentityDigest: input.evaluationIdentityDigest,
    outcomeDigest: input.outcomeDigest,
    policyFactContextDigest: input.policyFactContextDigest,
    regressionSourceDigest: input.regressionSourceDigest,
    artifactKind: input.artifactKind,
    limitIdentifier: input.limitIdentifier,
    distributionRepository: input.distributionRepository,
    distributionRevision: input.distributionRevision,
  };
}

function fromGate(input) {
  const output = emptyPublicOutputs();
  const mapping = {
    "gate-class": input.gateClass,
    decision: input.decision,
    "cli-exit-code": input.cliExitCode,
    "publication-valid": input.publicationValid,
    "policy-semantic-digest": input.policySemanticDigest,
    "evaluation-identity-digest": input.evaluationIdentityDigest,
    "outcome-digest": input.outcomeDigest,
    "policy-fact-context-digest": input.policyFactContextDigest,
    "regression-source-digest": input.regressionSourceDigest,
    "stable-code": input.stableCode,
    "failure-class": input.failureClass,
    phase: input.phase,
    "artifact-kind": input.artifactKind,
    "limit-identifier": input.limitIdentifier,
    "distribution-repository": input.distributionRepository,
    "distribution-revision": input.distributionRevision,
  };
  for (const [name, value] of Object.entries(mapping)) output[name] = value ?? "";
  return output;
}

function classifyFinalState(input) {
  if (input.checkoutOutcome !== "success") {
    return automationFailure("MEMORYOS_CI_INTERNAL_FAILURE", "internal");
  }
  if (input.prepareOutcome !== "success") {
    return automationFailure(
      input.preGateStableCode || "MEMORYOS_CI_INTERNAL_FAILURE",
      input.preGatePhase || "internal",
    );
  }
  for (const outcome of [
    input.candidateDownloadOutcome,
    input.baselineDownloadOutcome,
  ]) {
    if (outcome !== "success" && outcome !== "skipped") {
      return automationFailure(
        input.preGateStableCode || "MEMORYOS_CI_INTERNAL_FAILURE",
        input.preGatePhase || "internal",
      );
    }
  }
  for (const outcome of [input.candidateExtractOutcome, input.baselineExtractOutcome]) {
    if (outcome !== "success" && outcome !== "skipped") {
      return automationFailure(
        input.preGateStableCode || "MEMORYOS_CI_INPUT_PATH_INVALID",
        input.preGatePhase || "evaluationInput",
      );
    }
  }
  if (!["pass", "policy-fail", "policy-cne", "tool-failure"].includes(input.gateClass)) {
    return automationFailure("MEMORYOS_CI_INTERNAL_FAILURE", "internal");
  }
  if (input.gateClass === "tool-failure") {
    if (input.decision !== "" || input.publicationValid === "true") {
      return automationFailure("MEMORYOS_CI_INTERNAL_FAILURE", "internal", retainedFields(input));
    }
    const output = fromGate(input);
    output.decision = "";
    output["artifact-name"] = "";
    output["artifact-id"] = "";
    return output;
  }
  const expectations = {
    pass: ["PASS", "0"],
    "policy-fail": ["FAIL", "6"],
    "policy-cne": ["COULD_NOT_EVALUATE", "7"],
  };
  const [decision, exitCode] = expectations[input.gateClass];
  if (input.decision !== decision || input.cliExitCode !== exitCode
      || input.publicationValid !== "true") {
    return automationFailure("MEMORYOS_CI_INTERNAL_FAILURE", "internal", retainedFields(input));
  }
  if (input.gateClass === "pass" && input.gateOutcome !== "success") {
    return automationFailure("MEMORYOS_CI_INTERNAL_FAILURE", "internal", retainedFields(input));
  }
  if (input.uploadOutcome !== "success" || !ARTIFACT_NAME.test(input.uploadArtifactName)
      || !POSITIVE_DECIMAL.test(input.uploadArtifactId)) {
    return automationFailure(
      "MEMORYOS_CI_ARTIFACT_PUBLICATION_FAILED",
      "artifactPublication",
      retainedFields(input),
    );
  }
  const output = fromGate(input);
  output["artifact-name"] = input.uploadArtifactName;
  output["artifact-id"] = input.uploadArtifactId;
  return output;
}

function evidenceReference(evidence) {
  if (!evidence || typeof evidence !== "object") return "unavailable";
  const values = [`kind=${evidence.kind ?? ""}`, `domain=${evidence.domain ?? ""}`];
  if (typeof evidence.factDomain === "string") values.push(`factDomain=${evidence.factDomain}`);
  if (typeof evidence.factIdentifier === "string") values.push(`factIdentifier=${evidence.factIdentifier}`);
  if (Number.isSafeInteger(evidence.matchCount)) values.push(`matchCount=${evidence.matchCount}`);
  if (Array.isArray(evidence.matchedFactIdentifiers)) {
    values.push(`matchedFactIdentifiers=${evidence.matchedFactIdentifiers.join(",")}`);
  }
  if (typeof evidence.availability === "string") values.push(`availability=${evidence.availability}`);
  if (evidence.source?.kind === "policyFactContext") {
    values.push(`contextDigest=${evidence.source.contextDigest ?? ""}`);
  } else if (evidence.source?.kind === "deterministicFactSource") {
    values.push(`externalSourceDigest=${evidence.source.externalSourceDigest ?? ""}`);
  }
  return values.join("; ");
}

function flattenRules(result) {
  if (!result || typeof result !== "object") return [];
  if (result.kind === "MemoryOSPolicyResult" && Array.isArray(result.ruleResults)) {
    return result.ruleResults.map((rule) => ({ policyIdentifier: result.policyIdentifier, rule }));
  }
  if (result.kind === "MemoryOSPolicySetResult" && Array.isArray(result.policyResults)) {
    return result.policyResults.flatMap((policy) => Array.isArray(policy.ruleResults)
      ? policy.ruleResults.map((rule) => ({ policyIdentifier: policy.policyIdentifier, rule }))
      : []);
  }
  return [];
}

function renderSummary(state, outcome) {
  const result = outcome?.result ?? {};
  const identity = outcome?.evaluationIdentity ?? {};
  const evaluated = identity.evaluatedArtifact ?? {};
  const policyIdentifier = result.policyIdentifier ?? result.policySetIdentifier ?? "";
  const lines = [
    "# MemoryOS Policy Gate",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Gate classification | ${presentationScalar(state["gate-class"])} |`,
    `| Decision | ${presentationScalar(state.decision)} |`,
    `| Policy kind | ${presentationScalar(evaluated.kind ?? state["artifact-kind"])} |`,
    `| Policy identifier | ${presentationScalar(policyIdentifier)} |`,
    `| Policy semantic digest | ${presentationScalar(state["policy-semantic-digest"])} |`,
    `| Evaluation Identity digest | ${presentationScalar(state["evaluation-identity-digest"])} |`,
    `| Outcome digest | ${presentationScalar(state["outcome-digest"])} |`,
    `| PolicyFactContext digest | ${presentationScalar(state["policy-fact-context-digest"])} |`,
    `| Regression source digest | ${presentationScalar(state["regression-source-digest"])} |`,
    `| Distribution revision | ${presentationScalar(state["distribution-revision"])} |`,
  ];
  const rules = flattenRules(result);
  if (rules.length > 0) {
    lines.push("", "## Rule results", "");
    for (const { policyIdentifier: owner, rule } of rules) {
      lines.push(
        `- ${presentationScalar(owner)} / ${presentationScalar(rule.ruleIdentifier)} `
        + `(${presentationScalar(rule.ruleType)}@${presentationScalar(rule.ruleVersion)}): `
        + `${presentationScalar(rule.decision)} — ${presentationScalar(rule.decisionCode)}`,
      );
      const evidence = Array.isArray(rule.evidence) ? rule.evidence[0] : null;
      lines.push(`  - Evidence reference: ${presentationScalar(evidenceReference(evidence))}`);
    }
  }
  const rendered = `${lines.join("\n")}\n`;
  return utf8Prefix(rendered, 32_768);
}

function topAnnotation(state) {
  if (state["gate-class"] === "pass") return null;
  if (state["gate-class"] === "policy-fail") {
    return ["MemoryOS Policy Gate — Policy FAIL", "The verified Policy decision is FAIL."];
  }
  if (state["gate-class"] === "policy-cne") {
    return ["MemoryOS Policy Gate — Policy CNE", "The verified Policy could not be evaluated."];
  }
  return ["MemoryOS Policy Gate — Tool failure", `The gate failed with ${state["stable-code"] || "MEMORYOS_CI_INTERNAL_FAILURE"}.`];
}

function publishPresentation(state, outcome, options = {}) {
  const summaryPath = options.summaryPath ?? process.env.GITHUB_STEP_SUMMARY;
  const stream = options.stream ?? process.stdout;
  try {
    if (summaryPath) fs.appendFileSync(summaryPath, renderSummary(state, outcome), "utf8");
  } catch {
    // Presentation is deliberately non-normative.
  }
  try {
    const top = topAnnotation(state);
    if (top) emitCommand("error", top[0], top[1], stream);
    const notices = flattenRules(outcome?.result).filter(({ rule }) => rule?.decision !== "PASS").slice(0, 4);
    for (const { policyIdentifier, rule } of notices) {
      emitCommand(
        "notice",
        "MemoryOS non-PASS rule",
        `${policyIdentifier} / ${rule.ruleIdentifier} (${rule.ruleType}@${rule.ruleVersion}): ${rule.decision} — ${rule.decisionCode}`,
        stream,
      );
    }
  } catch {
    // Annotation transport cannot affect machine state or conclusion.
  }
}

function assertPublicOutputs(output) {
  if (Object.keys(output).length !== PUBLIC_OUTPUT_NAMES.length
      || PUBLIC_OUTPUT_NAMES.some((name) => typeof output[name] !== "string" || /[\0\r\n]/u.test(output[name]))) {
    throw new Error("final output contract is invalid");
  }
  return output;
}

module.exports = {
  assertPublicOutputs,
  classifyFinalState,
  evidenceReference,
  flattenRules,
  publishPresentation,
  renderSummary,
  topAnnotation,
};
