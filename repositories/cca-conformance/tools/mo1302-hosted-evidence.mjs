import { createHash } from "node:crypto";
import {
  appendFile,
  copyFile,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORKSPACE_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const FIXTURE_ROOT = join(
  WORKSPACE_ROOT,
  "repositories",
  "cca-conformance",
  "tests",
  "fixtures",
  "github-policy-gate",
  "1.0.0",
  "hosted",
);
const ORACLE_PATH = join(FIXTURE_ROOT, "oracle.json");
export const FINAL_FILES = Object.freeze([
  "evaluation-identity.json",
  "evaluation-identity.sha256",
  "evaluation-outcome.json",
  "evaluation-outcome.sha256",
  "gate-receipt.json",
  "policy-identities.json",
]);
const RETAINED_HASH_FILES = Object.freeze(FINAL_FILES.filter((name) => name !== "gate-receipt.json"));
const SCENARIOS = Object.freeze(["pass", "fail", "cne", "regression"]);
const HOSTED_SCENARIOS = Object.freeze({
  "artifact-pass": "pass",
  cne: "cne",
  "direct-pass": "pass",
  fail: "fail",
  "regression-pass": "regression",
});
export const OS_LABELS = Object.freeze(["ubuntu-24.04", "windows-2022", "macos-14"]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function env(name, { optional = false } = {}) {
  const value = process.env[name];
  if (value === undefined || (!optional && value.length === 0)) {
    throw new Error(`Missing environment variable ${name}.`);
  }
  invariant(!/[\0\r\n]/u.test(value), `${name} is not a scalar.`);
  return value;
}

function rawSha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function readOracle() {
  const bytes = await readFile(ORACLE_PATH);
  invariant(bytes.length > 0 && bytes.at(-1) === 0x0a, "Hosted oracle lacks its repository LF framing.");
  const body = bytes.subarray(0, -1);
  const oracle = JSON.parse(body.toString("utf8"));
  invariant(oracle.kind === "MemoryOSMO1302HostedOracle", "Hosted oracle kind is invalid.");
  invariant(oracle.version === "1.0.0", "Hosted oracle version is invalid.");
  invariant(Buffer.from(JSON.stringify(oracle)).equals(body), "Hosted oracle is not canonical JSON.");
  return oracle;
}

function portableWorkspacePath(workspace, absolutePath) {
  const value = relative(workspace, absolutePath).split(sep).join("/");
  invariant(value.length > 0 && !value.startsWith("../") && !value.includes("\\"), "Path escaped the workspace.");
  return value;
}

async function writeOutput(name, value) {
  invariant(/^[a-z][a-z0-9-]*$/u.test(name), "Invalid output name.");
  invariant(typeof value === "string" && !/[\0\r\n]/u.test(value), "Invalid output value.");
  await appendFile(env("GITHUB_OUTPUT"), `${name}=${value}\n`, "utf8");
}

async function assertRegularFile(path, label) {
  const stat = await lstat(path);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular file.`);
}

function assertJsonBytes(bytes, label, { trailingLf = false } = {}) {
  const body = trailingLf ? bytes.subarray(0, -1) : bytes;
  if (trailingLf) invariant(bytes.length > 0 && bytes.at(-1) === 0x0a, `${label} lacks its required LF.`);
  const value = JSON.parse(body.toString("utf8"));
  invariant(Buffer.from(JSON.stringify(value)).equals(body), `${label} is not canonical compact JSON.`);
  return value;
}

async function prepare() {
  const oracle = await readOracle();
  const workspace = resolve(env("GITHUB_WORKSPACE"));
  invariant(workspace === WORKSPACE_ROOT, "The hosted helper must run from the checked-out workspace root.");
  const source = resolve(workspace, ...oracle.candidateMip.path.split("/"));
  await assertRegularFile(source, "Candidate source");
  const bytes = await readFile(source);
  invariant(bytes.length === oracle.candidateMip.byteCount, "Candidate source byte count changed.");
  invariant(rawSha256(bytes) === oracle.candidateMip.rawSha256, "Candidate source digest changed.");

  const runnerOs = env("RUNNER_OS").toLowerCase();
  const runnerArch = env("RUNNER_ARCH").toLowerCase();
  invariant(/^[a-z0-9]+$/u.test(runnerOs) && /^[a-z0-9]+$/u.test(runnerArch), "Runner identity is not portable.");
  const target = join(workspace, "out", "mo1302-hosted-fixtures", `${runnerOs}-${runnerArch}`, "candidate.mip");
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  invariant(rawSha256(await readFile(target)) === oracle.candidateMip.rawSha256, "Prepared candidate changed.");
  await writeOutput("candidate-mip-path", portableWorkspacePath(workspace, target));
}

async function readClosedGeneration(root) {
  const rootStat = await lstat(root);
  invariant(rootStat.isDirectory() && !rootStat.isSymbolicLink(), "Generation root is not a directory.");
  const names = (await readdir(root)).sort();
  invariant(JSON.stringify(names) === JSON.stringify(FINAL_FILES), "Generation file inventory is not closed.");
  const files = {};
  for (const name of names) {
    const path = join(root, name);
    await assertRegularFile(path, name);
    files[name] = await readFile(path);
  }
  return files;
}

export async function verifyGeneration(root, scenarioName, oracle) {
  const expected = oracle.scenarios[scenarioName];
  invariant(expected !== undefined, `Unknown oracle scenario ${scenarioName}.`);
  const files = await readClosedGeneration(root);
  const identityBytes = files["evaluation-identity.json"];
  const outcomeBytes = files["evaluation-outcome.json"];
  invariant(identityBytes.length === expected.evaluationIdentity.byteCount, "Evaluation Identity byte count differs.");
  invariant(rawSha256(identityBytes) === expected.evaluationIdentity.rawSha256, "Evaluation Identity bytes differ from the oracle.");
  invariant(outcomeBytes.length === expected.outcome.byteCount, "Outcome byte count differs.");
  invariant(rawSha256(outcomeBytes) === expected.outcome.rawSha256, "Outcome bytes differ from the oracle.");
  invariant(files["evaluation-identity.sha256"].toString("ascii") === expected.evaluationIdentity.digest, "Evaluation Identity sidecar differs.");
  invariant(files["evaluation-outcome.sha256"].toString("ascii") === expected.outcome.digest, "Outcome sidecar differs.");

  const identity = assertJsonBytes(identityBytes, "Evaluation Identity");
  const outcome = assertJsonBytes(outcomeBytes, "Outcome");
  const identities = assertJsonBytes(files["policy-identities.json"], "Policy identities", { trailingLf: true });
  const receipt = assertJsonBytes(files["gate-receipt.json"], "Gate receipt");
  invariant(JSON.stringify(outcome.evaluationIdentity) === JSON.stringify(identity), "Outcome does not embed the exact Evaluation Identity.");
  invariant(outcome.result.decision === expected.decision, "Outcome decision differs.");
  invariant(receipt.decision === expected.decision, "Receipt decision differs.");
  invariant(String(receipt.originalCliExitCode) === expected.cliExitCode, "Receipt exit code differs.");
  invariant(receipt.publicationValid === true, "Receipt does not attest a valid publication.");
  invariant(receipt.policy.semanticDigest === expected.policySemanticDigest, "Receipt Policy digest differs.");
  invariant(receipt.policyFactContextDigest === expected.policyFactContextDigest, "Receipt context digest differs.");
  invariant((receipt.regressionSourceDigest ?? "") === expected.regressionSourceDigest, "Receipt Regression digest differs.");
  invariant(receipt.evaluationIdentityDigest === expected.evaluationIdentity.digest, "Receipt Evaluation Identity digest differs.");
  invariant(receipt.outcomeDigest === expected.outcome.digest, "Receipt outcome digest differs.");
  invariant(receipt.distribution.repository === oracle.distribution.repository, "Receipt distribution repository differs.");
  invariant(receipt.distribution.revision === env("MO_EXPECTED_DISTRIBUTION_REVISION"), "Receipt distribution revision differs.");
  invariant(identities.command === "policy identities" && identities.ok === true, "Policy identities envelope differs.");
  invariant(JSON.stringify(receipt.contractIdentities) === JSON.stringify(identities.result), "Receipt contract identities differ.");
  invariant(JSON.stringify(Object.keys(receipt.retainedFileRawSha256).sort()) === JSON.stringify([...RETAINED_HASH_FILES].sort()), "Receipt hash inventory differs.");
  for (const name of RETAINED_HASH_FILES) {
    invariant(receipt.retainedFileRawSha256[name] === rawSha256(files[name]), `Receipt hash differs for ${name}.`);
  }
  return files;
}

function assertActionOutputs(expected, oracle) {
  const values = {
    artifactKind: env("MO_ARTIFACT_KIND"),
    cliExitCode: env("MO_CLI_EXIT_CODE"),
    decision: env("MO_DECISION"),
    evaluationIdentityDigest: env("MO_EVALUATION_IDENTITY_DIGEST"),
    gateClass: env("MO_GATE_CLASS"),
    outcomeDigest: env("MO_OUTCOME_DIGEST"),
    policyFactContextDigest: env("MO_POLICY_FACT_CONTEXT_DIGEST"),
    policySemanticDigest: env("MO_POLICY_SEMANTIC_DIGEST"),
    publicationValid: env("MO_PUBLICATION_VALID"),
    regressionSourceDigest: env("MO_REGRESSION_SOURCE_DIGEST", { optional: true }),
  };
  for (const [key, value] of Object.entries({
    artifactKind: expected.artifactKind,
    cliExitCode: expected.cliExitCode,
    decision: expected.decision,
    evaluationIdentityDigest: expected.evaluationIdentity.digest,
    gateClass: expected.gateClass,
    outcomeDigest: expected.outcome.digest,
    policyFactContextDigest: expected.policyFactContextDigest,
    policySemanticDigest: expected.policySemanticDigest,
    publicationValid: "true",
    regressionSourceDigest: expected.regressionSourceDigest,
  })) invariant(values[key] === value, `Action output ${key} differs.`);
  invariant(env("MO_DISTRIBUTION_REPOSITORY") === oracle.distribution.repository, "Action distribution repository differs.");
  invariant(env("MO_DISTRIBUTION_REVISION") === env("MO_EXPECTED_DISTRIBUTION_REVISION"), "Action distribution revision differs.");
}

async function verifyAction() {
  const oracle = await readOracle();
  const scenario = env("MO_SCENARIO");
  invariant(SCENARIOS.includes(scenario), "Unknown direct-Action scenario.");
  const expected = oracle.scenarios[scenario];
  const expectedStepOutcome = ["fail", "cne"].includes(scenario) ? "failure" : "success";
  invariant(env("MO_STEP_OUTCOME") === expectedStepOutcome, "Action step conclusion differs from the decision contract.");
  assertActionOutputs(expected, oracle);
  const sourceRoot = resolve(env("MO_ARTIFACT_DIRECTORY"));
  const files = await verifyGeneration(sourceRoot, scenario, oracle);
  const stageRoot = resolve(env("MO_STAGE_ROOT"));
  const destination = join(stageRoot, scenario);
  await mkdir(destination, { recursive: true });
  for (const name of FINAL_FILES) await cp(join(sourceRoot, name), join(destination, name), { errorOnExist: true, force: false });
  const staged = await readClosedGeneration(destination);
  for (const name of FINAL_FILES) invariant(staged[name].equals(files[name]), `Staged ${name} bytes differ.`);
}

async function verifyPinFailure() {
  invariant(env("MO_STEP_OUTCOME") === "failure", "Policy pin mismatch unexpectedly succeeded.");
  invariant(env("MO_GATE_CLASS") === "tool-failure", "Policy pin mismatch gate class differs.");
  invariant(env("MO_PUBLICATION_VALID") === "false", "Policy pin mismatch published a generation.");
  invariant(env("MO_STABLE_CODE") === "MEMORYOS_CI_POLICY_PIN_MISMATCH", "Policy pin mismatch stable code differs.");
  invariant(env("MO_FAILURE_CLASS") === "automation", "Policy pin mismatch failure class differs.");
  invariant(env("MO_PHASE") === "policyPreparation", "Policy pin mismatch phase differs.");
  invariant(env("MO_ARTIFACT_DIRECTORY", { optional: true }) === "", "Policy pin mismatch retained an artifact directory.");
}

export async function comparePlatforms() {
  const oracle = await readOracle();
  const root = resolve(env("MO_EVIDENCE_ROOT"));
  const baseline = {};
  for (const os of OS_LABELS) {
    const artifactRoot = join(root, `mo1302-action-parity-${os}`);
    for (const scenario of SCENARIOS) {
      const files = await verifyGeneration(join(artifactRoot, scenario), scenario, oracle);
      if (baseline[scenario] === undefined) baseline[scenario] = files;
      else for (const name of FINAL_FILES) {
        invariant(files[name].equals(baseline[scenario][name]), `${scenario}/${name} differs on ${os}.`);
      }
    }
  }
}

async function assertDuplicateUpload() {
  invariant(env("MO_DUPLICATE_UPLOAD_OUTCOME") === "failure", "Artifact service accepted a duplicate immutable upload name.");
}

async function githubJson(path) {
  const token = env("GITHUB_TOKEN");
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "memoryos-mo1302-hosted-evidence",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  invariant(response.ok, `GitHub API request failed with ${response.status}.`);
  return response.json();
}

async function resolveHostedArtifact() {
  const repository = env("GITHUB_REPOSITORY");
  invariant(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository), "Repository identity is invalid.");
  const runId = env("GITHUB_RUN_ID");
  const attempt = env("GITHUB_RUN_ATTEMPT");
  invariant(/^[1-9][0-9]*$/u.test(runId) && /^[1-9][0-9]*$/u.test(attempt), "Run identity is invalid.");
  const artifacts = await githubJson(`/repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`);
  invariant(artifacts.total_count <= 100, "Hosted validation produced too many artifacts for closed resolution.");
  const namePattern = new RegExp(`^memoryos-policy-gate-${runId}-${attempt}-[1-9][0-9]*$`, "u");
  const matches = artifacts.artifacts.filter((artifact) => namePattern.test(artifact.name));
  invariant(matches.length === 1, "Expected exactly one reusable-workflow result artifact.");
  const artifact = matches[0];
  invariant(artifact.expired === false && Number.isSafeInteger(artifact.id), "Result artifact is not live and identified.");
  invariant(typeof artifact.created_at === "string" && typeof artifact.expires_at === "string", "Result retention metadata is absent.");
  const retentionMs = Date.parse(artifact.expires_at) - Date.parse(artifact.created_at);
  invariant(retentionMs > 0 && retentionMs <= (14 * 24 + 2) * 60 * 60 * 1000, "Result artifact retention exceeds the requested bound.");

  const jobs = await githubJson(
    `/repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
  );
  invariant(jobs.total_count <= 100, "Hosted validation produced too many jobs for closed resolution.");
  invariant(jobs.jobs.some((job) => job.name === "memoryos-policy-gate / MemoryOS Policy Gate"), "Canonical reusable check identity was not observed.");
  invariant(env("MO_CALLER_ARTIFACT_ID") === String(artifact.id), "Reusable artifact ID output differs from the service artifact.");
  invariant(env("MO_CALLER_ARTIFACT_NAME") === artifact.name, "Reusable artifact name output differs from the service artifact.");
  await writeOutput("artifact-id", String(artifact.id));
  await writeOutput("artifact-name", artifact.name);
}

async function verifyHosted() {
  const oracle = await readOracle();
  const hostedScenario = env("MO_HOSTED_SCENARIO");
  const scenario = HOSTED_SCENARIOS[hostedScenario];
  invariant(scenario !== undefined, "Unknown hosted scenario.");
  const expectedResult = ["fail", "cne"].includes(scenario) ? "failure" : "success";
  invariant(env("MO_CALLER_RESULT") === expectedResult, "Reusable workflow conclusion differs from the decision contract.");
  const expected = oracle.scenarios[scenario];
  const exactOutputs = {
    MO_CALLER_ARTIFACT_KIND: expected.artifactKind,
    MO_CALLER_CLI_EXIT_CODE: expected.cliExitCode,
    MO_CALLER_DECISION: expected.decision,
    MO_CALLER_DISTRIBUTION_REPOSITORY: oracle.distribution.repository,
    MO_CALLER_DISTRIBUTION_REVISION: env("MO_EXPECTED_DISTRIBUTION_REVISION"),
    MO_CALLER_EVALUATION_IDENTITY_DIGEST: expected.evaluationIdentity.digest,
    MO_CALLER_FAILURE_CLASS: "",
    MO_CALLER_GATE_CLASS: expected.gateClass,
    MO_CALLER_LIMIT_IDENTIFIER: "",
    MO_CALLER_OUTCOME_DIGEST: expected.outcome.digest,
    MO_CALLER_PHASE: "",
    MO_CALLER_POLICY_FACT_CONTEXT_DIGEST: expected.policyFactContextDigest,
    MO_CALLER_POLICY_SEMANTIC_DIGEST: expected.policySemanticDigest,
    MO_CALLER_PUBLICATION_VALID: "true",
    MO_CALLER_REGRESSION_SOURCE_DIGEST: expected.regressionSourceDigest,
    MO_CALLER_STABLE_CODE: "",
  };
  for (const [name, value] of Object.entries(exactOutputs)) {
    invariant(env(name, { optional: true }) === value, `Reusable workflow output ${name} differs.`);
  }
  await verifyGeneration(resolve(env("MO_DOWNLOADED_ARTIFACT")), scenario, oracle);
}

export const MODES = Object.freeze({
  "compare-platforms": comparePlatforms,
  prepare,
  "resolve-hosted-artifact": resolveHostedArtifact,
  "verify-action": verifyAction,
  "verify-duplicate-upload": assertDuplicateUpload,
  "verify-hosted": verifyHosted,
  "verify-pin-failure": verifyPinFailure,
});

const invokedPath = process.argv[1] === undefined ? "" : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  const mode = process.argv[2];
  invariant(Object.hasOwn(MODES, mode), "Expected one supported MO-1302 hosted-evidence mode.");
  await MODES[mode]();
}
