"use strict";

const ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

class SupportFailure extends Error {
  constructor(code, phase) {
    super("MemoryOS workflow support failure");
    this.code = code;
    this.phase = phase;
  }
}

function inputFailure(phase = "actionInput") {
  return new SupportFailure("MEMORYOS_CI_INPUT_PATH_INVALID", phase);
}

function internalFailure() {
  return new SupportFailure("MEMORYOS_CI_INTERNAL_FAILURE", "internal");
}

function requirePositiveDecimal(value, label) {
  if (!POSITIVE_DECIMAL.test(value)) throw new Error(`${label} is invalid`);
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) throw new Error(`${label} is invalid`);
  return value;
}

function validateArtifactName(value) {
  if (!ARTIFACT_NAME.test(value)) throw new Error("artifact name is invalid");
  return value;
}

function validatePrepareInputs(input) {
  const candidateDirect = input.candidateMipPath !== "";
  const candidateArtifact = input.candidateMipArtifactName !== "";
  if (candidateDirect === candidateArtifact) throw inputFailure();
  const baselineDirect = input.regressionBaselineMipPath !== "";
  const baselineArtifact = input.regressionBaselineMipArtifactName !== "";
  if (baselineDirect && baselineArtifact) throw inputFailure();
  try {
    if (candidateArtifact) validateArtifactName(input.candidateMipArtifactName);
    if (baselineArtifact) validateArtifactName(input.regressionBaselineMipArtifactName);
  } catch {
    throw inputFailure();
  }
  if (!/^(?:[1-9]|[1-8][0-9]|90)$/u.test(input.retentionDays)) {
    throw inputFailure();
  }
  try {
    requirePositiveDecimal(input.runId, "run ID");
    requirePositiveDecimal(input.runAttempt, "run attempt");
    requirePositiveDecimal(input.checkRunId, "check run ID");
  } catch {
    throw internalFailure();
  }
  return Object.freeze({
    ...input,
    uploadArtifactName:
      `memoryos-policy-gate-${input.runId}-${input.runAttempt}-${input.checkRunId}`,
  });
}

function githubTransport(input, environment = process.env) {
  const apiUrl = environment.GITHUB_API_URL;
  const repository = environment.GITHUB_REPOSITORY;
  const token = environment.GITHUB_TOKEN;
  if (apiUrl !== "https://api.github.com") throw internalFailure();
  if (!REPOSITORY.test(repository ?? "")) throw internalFailure();
  if (typeof token !== "string" || token === "" || /[\0\r\n]/u.test(token)) {
    throw internalFailure();
  }
  requirePositiveDecimal(input.runId, "run ID");
  return { apiUrl, repository, runId: input.runId, token };
}

async function listExactArtifact({ apiUrl, repository, runId, token, name }, fetchImpl = globalThis.fetch) {
  validateArtifactName(name);
  requirePositiveDecimal(runId, "run ID");
  const url = new URL(
    `/repos/${repository}/actions/runs/${runId}/artifacts`,
    `${apiUrl}/`,
  );
  url.searchParams.set("name", name);
  url.searchParams.set("per_page", "2");
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw internalFailure();
  }
  if (!response || response.status !== 200) throw internalFailure();
  let body;
  try {
    body = await response.json();
  } catch {
    throw internalFailure();
  }
  if (!body || !Number.isSafeInteger(body.total_count) || body.total_count < 0
      || !Array.isArray(body.artifacts)) {
    throw internalFailure();
  }
  if (body.total_count === 1 && body.artifacts.length !== 1) throw internalFailure();
  if (body.total_count !== 1) {
    throw inputFailure("evaluationInput");
  }
  const artifact = body.artifacts[0];
  if (!artifact || typeof artifact.name !== "string" || typeof artifact.expired !== "boolean"
      || artifact.name !== name) throw internalFailure();
  if (artifact.expired) throw inputFailure("evaluationInput");
  const identifier = String(artifact.id ?? "");
  try {
    requirePositiveDecimal(identifier, "artifact ID");
  } catch {
    throw internalFailure();
  }
  return identifier;
}

async function prepare(input, environment = process.env, fetchImpl = globalThis.fetch) {
  const validated = validatePrepareInputs(input);
  let candidateArtifactId = "";
  let baselineArtifactId = "";
  if (validated.candidateMipArtifactName !== ""
      || validated.regressionBaselineMipArtifactName !== "") {
    const transport = githubTransport(validated, environment);
    if (validated.candidateMipArtifactName !== "") {
      candidateArtifactId = await listExactArtifact({
        ...transport,
        name: validated.candidateMipArtifactName,
      }, fetchImpl);
    }
    if (validated.regressionBaselineMipArtifactName !== "") {
      baselineArtifactId = await listExactArtifact({
        ...transport,
        name: validated.regressionBaselineMipArtifactName,
      }, fetchImpl);
    }
  }
  return Object.freeze({
    "candidate-artifact-id": candidateArtifactId,
    "baseline-artifact-id": baselineArtifactId,
    "upload-artifact-name": validated.uploadArtifactName,
    "retention-days": validated.retentionDays,
  });
}

async function revalidateArtifact(input, environment = process.env, fetchImpl = globalThis.fetch) {
  if (input.artifactRole !== "candidate" && input.artifactRole !== "baseline") {
    throw new Error("artifact role is invalid");
  }
  validateArtifactName(input.artifactName);
  requirePositiveDecimal(input.artifactId, "artifact ID");
  const actual = await listExactArtifact({
    ...githubTransport(input, environment),
    name: input.artifactName,
  }, fetchImpl);
  if (actual !== input.artifactId) throw inputFailure("evaluationInput");
  return actual;
}

module.exports = {
  ARTIFACT_NAME,
  DIGEST,
  SupportFailure,
  listExactArtifact,
  prepare,
  revalidateArtifact,
  requirePositiveDecimal,
  validateArtifactName,
  validatePrepareInputs,
};
