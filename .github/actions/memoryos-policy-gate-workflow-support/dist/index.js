"use strict";

const fs = require("node:fs");
const { extractArchive, validateArchive } = require("./archive.js");
const github = require("./github.js");
const finalizer = require("./finalize.js");
const io = require("./io.js");

function prepareInput(environment = process.env) {
  return {
    policyKind: io.getInput("policy-kind", environment),
    policyPath: io.getInput("policy-path", environment),
    expectedPolicySemanticDigest: io.getInput("expected-policy-semantic-digest", environment),
    candidateMipPath: io.getInput("candidate-mip-path", environment),
    regressionBaselineMipPath: io.getInput("regression-baseline-mip-path", environment),
    candidateMipArtifactName: io.getInput("candidate-mip-artifact-name", environment),
    regressionBaselineMipArtifactName: io.getInput("regression-baseline-mip-artifact-name", environment),
    retentionDays: io.getInput("retention-days", environment),
    runId: io.getInput("run-id", environment),
    runAttempt: io.getInput("run-attempt", environment),
    checkRunId: io.getInput("check-run-id", environment),
  };
}

function extractInput(environment = process.env) {
  return {
    archiveDirectory: io.getInput("archive-directory", environment),
    artifactRole: io.getInput("artifact-role", environment),
    artifactName: io.getInput("artifact-name", environment),
    artifactId: io.getInput("artifact-id", environment),
    runId: io.getInput("run-id", environment),
  };
}

function finalizeInput(environment = process.env) {
  return {
    checkoutOutcome: io.getInput("checkout-outcome", environment),
    prepareOutcome: io.getInput("prepare-outcome", environment),
    candidateDownloadOutcome: io.getInput("candidate-download-outcome", environment),
    candidateExtractOutcome: io.getInput("candidate-extract-outcome", environment),
    baselineDownloadOutcome: io.getInput("baseline-download-outcome", environment),
    baselineExtractOutcome: io.getInput("baseline-extract-outcome", environment),
    gateOutcome: io.getInput("gate-outcome", environment),
    uploadOutcome: io.getInput("upload-outcome", environment),
    uploadArtifactName: io.getInput("upload-artifact-name", environment),
    uploadArtifactId: io.getInput("upload-artifact-id", environment),
    preGateStableCode: io.getInput("pre-gate-stable-code", environment),
    preGatePhase: io.getInput("pre-gate-phase", environment),
    outcomePath: io.getInput("outcome-path", environment),
    gateClass: io.getInput("gate-class", environment),
    decision: io.getInput("decision", environment),
    cliExitCode: io.getInput("cli-exit-code", environment),
    publicationValid: io.getInput("publication-valid", environment),
    policySemanticDigest: io.getInput("policy-semantic-digest", environment),
    evaluationIdentityDigest: io.getInput("evaluation-identity-digest", environment),
    outcomeDigest: io.getInput("outcome-digest", environment),
    policyFactContextDigest: io.getInput("policy-fact-context-digest", environment),
    regressionSourceDigest: io.getInput("regression-source-digest", environment),
    stableCode: io.getInput("stable-code", environment),
    failureClass: io.getInput("failure-class", environment),
    phase: io.getInput("phase", environment),
    artifactKind: io.getInput("artifact-kind", environment),
    limitIdentifier: io.getInput("limit-identifier", environment),
    distributionRepository: io.getInput("distribution-repository", environment),
    distributionRevision: io.getInput("distribution-revision", environment),
  };
}

async function runMode({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  presentation = {},
} = {}) {
  const mode = io.getInput("mode", environment);
  if (mode === "prepare") {
    const output = await github.prepare(prepareInput(environment), environment, fetchImpl);
    io.writeOutputs(output, environment);
    return { mode, output, failed: false };
  }
  if (mode === "extract") {
    const input = extractInput(environment);
    await github.revalidateArtifact(input, environment, fetchImpl);
    const extracted = await extractArchive({
      archiveDirectory: input.archiveDirectory,
      artifactRole: input.artifactRole,
      workspace: environment.GITHUB_WORKSPACE,
    });
    const output = { "mip-path": extracted.mipPath };
    io.writeOutputs(output, environment);
    return { mode, output, failed: false };
  }
  if (mode === "finalize") {
    const input = finalizeInput(environment);
    const output = finalizer.assertPublicOutputs(finalizer.classifyFinalState(input));
    // Machine state is published before either non-normative presentation sink.
    io.writeOutputs(output, environment);
    let outcome = null;
    if (input.publicationValid === "true" && input.outcomePath !== "") {
      try {
        outcome = JSON.parse(fs.readFileSync(input.outcomePath, "utf8"));
      } catch {
        outcome = null;
      }
    }
    finalizer.publishPresentation(output, outcome, {
      summaryPath: presentation.summaryPath ?? environment.GITHUB_STEP_SUMMARY,
      stream: presentation.stream ?? process.stdout,
    });
    return { mode, output, failed: output["gate-class"] !== "pass" };
  }
  throw new Error("support Action mode is invalid");
}

async function main() {
  const mode = io.getInput("mode");
  try {
    const result = await runMode();
    if (result.failed) process.exitCode = 1;
  } catch (error) {
    if ((mode === "prepare" || mode === "extract") && error instanceof github.SupportFailure) {
      try {
        io.writeOutputs({
          "support-stable-code": error.code,
          "support-phase": error.phase,
        });
      } catch {
        // The fixed failure below remains authoritative when the output sink fails.
      }
    } else if (mode === "extract") {
      try {
        io.writeOutputs({
          "support-stable-code": "MEMORYOS_CI_INPUT_PATH_INVALID",
          "support-phase": "evaluationInput",
        });
      } catch {
        // The fixed failure below remains authoritative when the output sink fails.
      }
    }
    // Fixed text only: untrusted inputs and service diagnostics are never emitted.
    process.stderr.write("MemoryOS Policy Gate workflow support failed.\n");
    process.exitCode = 1;
  }
}

module.exports = {
  ...github,
  ...finalizer,
  ...io,
  extractArchive,
  extractInput,
  finalizeInput,
  prepareInput,
  runMode,
  validateArchive,
};

if (require.main === module) void main();
