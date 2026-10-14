import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { spawnSync } from "node:child_process";

import {
  canonicalizeRestrictedJson,
  domainSeparatedDigest,
  parseRestrictedJson,
} from "./vendor/repositories/cca-studio/web/js/policy-canonical.js";

const AUTOMATION_FAILURE_KIND = "MemoryOSGitHubPolicyGateAutomationFailure";
const AUTOMATION_FAILURE_VERSION = "1.0.0";
const RECEIPT_KIND = "MemoryOSGitHubPolicyGateReceipt";
const RECEIPT_VERSION = "1.0.0";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SIDECAR_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const STABLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;
const MACHINE_SCALAR_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/u;
const CLI_FAILURE_CLASS_BY_EXIT = new Map([
  [1, "usage"],
  [2, "preparation"],
  [3, "operational"],
  [4, "operational"],
  [5, "operational"],
]);
const REVISION_PATTERN = /^[0-9a-f]{40}$/u;
const INPUT_SEGMENT_PATTERN = /^[A-Za-z0-9._ -]+$/u;
const WINDOWS_DEVICE_STEM_PATTERN = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9]|lpt[1-9])$/iu;
const IDENTITY_DOMAIN = "MEMORYOS-POLICY-EVALUATION-IDENTITY-1.0";
const OUTCOME_DOMAIN = "MEMORYOS-POLICY-EVALUATION-OUTCOME-1.0";
const RETAINED_FILE_NAMES = Object.freeze([
  "evaluation-identity.json",
  "evaluation-identity.sha256",
  "evaluation-outcome.json",
  "evaluation-outcome.sha256",
  "policy-identities.json",
]);
const FINAL_FILE_NAMES = Object.freeze([...RETAINED_FILE_NAMES, "gate-receipt.json"].sort());
const GENERATION_FILE_NAMES = Object.freeze([
  "evaluation-identity.json",
  "evaluation-identity.sha256",
  "evaluation-outcome.json",
  "evaluation-outcome.sha256",
].sort());
const GENERATION_PUBLICATION_ORDER = Object.freeze([
  "evaluation-identity.json",
  "evaluation-identity.sha256",
  "evaluation-outcome.sha256",
  "evaluation-outcome.json",
]);
const AUTOMATION_CODES = Object.freeze(new Set([
  "MEMORYOS_CI_DISTRIBUTION_UNTRUSTED",
  "MEMORYOS_CI_CONTRACT_IDENTITY_MISMATCH",
  "MEMORYOS_CI_POLICY_PIN_MISMATCH",
  "MEMORYOS_CI_INPUT_PATH_INVALID",
  "MEMORYOS_CI_CLI_PROTOCOL_INVALID",
  "MEMORYOS_CI_PUBLICATION_GENERATION_INVALID",
  "MEMORYOS_CI_AUTHORITATIVE_RECONSTRUCTION_FAILED",
  "MEMORYOS_CI_DECISION_EXIT_MISMATCH",
  "MEMORYOS_CI_ARTIFACT_PUBLICATION_FAILED",
  "MEMORYOS_CI_INTERNAL_FAILURE",
]));
const FAILURE_PHASES = Object.freeze(new Set([
  "distribution",
  "actionInput",
  "contractIdentityPreflight",
  "policyPreparation",
  "evaluationInput",
  "evaluation",
  "publicationGeneration",
  "artifactVerification",
  "authoritativeReconstruction",
  "postEvaluationIdentityRecheck",
  "decisionExitCrossCheck",
  "artifactPublication",
  "internal",
]));

class AutomationFailure extends Error {
  constructor(code, phase) {
    super(code);
    this.name = "AutomationFailure";
    this.failure = makeAutomationFailure(code, phase);
  }
}

class CliSemanticFailure extends Error {
  constructor(error, invocation) {
    super(error.code);
    this.name = "CliSemanticFailure";
    this.error = Object.freeze({ ...error });
    this.invocation = invocation;
  }
}

function ownKeysExactly(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function bytesEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function rawSha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalBytes(value) {
  return Buffer.from(canonicalizeRestrictedJson(value));
}

function canonicalEqual(left, right) {
  try {
    return bytesEqual(canonicalBytes(left), canonicalBytes(right));
  } catch {
    return false;
  }
}

function automation(code, phase) {
  throw new AutomationFailure(code, phase);
}

export function makeAutomationFailure(code, phase) {
  if (!AUTOMATION_CODES.has(code) || !FAILURE_PHASES.has(phase)) {
    throw new TypeError("Unknown MemoryOS CI automation failure classification.");
  }
  return Object.freeze({
    kind: AUTOMATION_FAILURE_KIND,
    version: AUTOMATION_FAILURE_VERSION,
    code,
    phase,
  });
}

function parseCanonicalJson(bytes, allowTrailingLf = false) {
  const input = Buffer.from(bytes);
  let body = input;
  if (allowTrailingLf) {
    if (input.length < 2 || input.at(-1) !== 0x0a || input.subarray(0, -1).includes(0x0a)) {
      throw new TypeError("JSON transport framing is invalid.");
    }
    body = input.subarray(0, -1);
  }
  const value = parseRestrictedJson(body);
  if (!bytesEqual(canonicalBytes(value), body)) {
    throw new TypeError("JSON bytes are not restricted canonical JSON.");
  }
  return value;
}

function inputEnvironmentName(name) {
  return `INPUT_${name.replace(/ /gu, "_").toUpperCase()}`;
}

function getInput(environment, name) {
  const value = environment[inputEnvironmentName(name)];
  return typeof value === "string" ? value : "";
}

export function validatePortablePath(value, { optional = false } = {}) {
  if (optional && value === "") return null;
  if (typeof value !== "string" || value.length === 0 || isAbsolute(value) ||
      value.startsWith("/") || value.startsWith("\\") || value.includes("\\") ||
      value.includes(":") || value.includes("//") || value.startsWith("~")) {
    automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  }
  const segments = value.split("/");
  for (const segment of segments) {
    if (segment.length === 0 || segment === "." || segment === ".." ||
        !INPUT_SEGMENT_PATTERN.test(segment) || segment.startsWith(" ") ||
        segment.endsWith(" ") || segment.endsWith(".") ||
        WINDOWS_DEVICE_STEM_PATTERN.test(segment.split(".", 1)[0])) {
      automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
    }
  }
  return Object.freeze([...segments]);
}

function requireWorkspace(environment) {
  const spelling = environment.GITHUB_WORKSPACE;
  if (typeof spelling !== "string" || spelling.length === 0) {
    automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  }
  let status;
  try {
    status = lstatSync(spelling);
  } catch {
    automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  }
  if (status.isSymbolicLink() || !status.isDirectory()) {
    automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  }
  return realpathSync.native(spelling);
}

function validatePhysicalPortableFile(workspaceRoot, spelling, segments) {
  let current = workspaceRoot;
  try {
    const componentIdentities = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      current = resolve(current, segment);
      const lexical = relative(workspaceRoot, current);
      if (lexical.length === 0 || lexical === ".." || lexical.startsWith(`..${sep}`) || isAbsolute(lexical)) {
        automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
      }
      const status = lstatSync(current, { bigint: true });
      const final = index === segments.length - 1;
      if (status.isSymbolicLink() || (final ? !status.isFile() : !status.isDirectory())) {
        automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
      }
      componentIdentities.push(Object.freeze({
        dev: status.dev,
        ino: status.ino,
        mode: status.mode,
        physical: realpathSync.native(current),
      }));
    }
    const finalStatus = lstatSync(current, { bigint: true });
    if (finalStatus.isSymbolicLink() || !finalStatus.isFile()) {
      automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
    }
    const physical = realpathSync.native(current);
    const physicalRelative = relative(workspaceRoot, physical);
    if (physicalRelative.length === 0 || physicalRelative === ".." ||
        physicalRelative.startsWith(`..${sep}`) || isAbsolute(physicalRelative)) {
      automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
    }
    const identity = Object.freeze({
      ctimeNs: finalStatus.ctimeNs,
      dev: finalStatus.dev,
      ino: finalStatus.ino,
      mtimeNs: finalStatus.mtimeNs,
      size: finalStatus.size,
    });
    return Object.freeze({
      componentIdentities: Object.freeze(componentIdentities),
      identity,
      physical,
      spelling,
    });
  } catch (error) {
    if (error instanceof AutomationFailure) throw error;
    automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  }
}

function sameOpenFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function sameNodeIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function revalidatePortableComponents(workspaceRoot, descriptor) {
  let current = workspaceRoot;
  const segments = descriptor.spelling.split("/");
  if (segments.length !== descriptor.componentIdentities.length) {
    automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  }
  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index]);
    const status = lstatSync(current, { bigint: true });
    const expected = descriptor.componentIdentities[index];
    const final = index === segments.length - 1;
    if (status.isSymbolicLink() || (final ? !status.isFile() : !status.isDirectory()) ||
        !sameNodeIdentity(expected, status) ||
        (final && !sameOpenFile(descriptor.identity, status)) ||
        realpathSync.native(current) !== expected.physical) {
      automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
    }
  }
}

function readSourceOnce(workspaceRoot, descriptor) {
  const flags = fsConstants.O_RDONLY |
    (fsConstants.O_NONBLOCK ?? 0) |
    (process.platform === "win32" ? 0 : (fsConstants.O_NOFOLLOW ?? 0));
  let handle;
  try {
    handle = openSync(descriptor.physical, flags);
    const before = fstatSync(handle, { bigint: true });
    if (!before.isFile() || !sameOpenFile(descriptor.identity, before)) {
      automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
    }
    const bytes = readFileSync(handle);
    const after = fstatSync(handle, { bigint: true });
    if (!sameOpenFile(before, after) || BigInt(bytes.length) !== after.size) {
      automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
    }
    revalidatePortableComponents(workspaceRoot, descriptor);
    const currentPhysical = realpathSync.native(resolve(workspaceRoot, ...descriptor.spelling.split("/")));
    if (currentPhysical !== descriptor.physical) {
      automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
    }
    return bytes;
  } catch (error) {
    if (error instanceof AutomationFailure) throw error;
    automation("MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  } finally {
    if (handle !== undefined) {
      try { closeSync(handle); } catch { /* primary classification is retained */ }
    }
  }
}

function privateParent(environment) {
  const candidate = typeof environment.RUNNER_TEMP === "string" && environment.RUNNER_TEMP.length > 0
    ? environment.RUNNER_TEMP
    : tmpdir();
  const status = statSync(candidate);
  if (!status.isDirectory()) throw new Error("Private temporary parent is unavailable.");
  return realpathSync.native(candidate);
}

function createPrivateDirectory(parent, prefix) {
  const root = mkdtempSync(join(parent, prefix));
  const real = realpathSync.native(root);
  const child = relative(parent, real);
  if (child.length === 0 || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child) ||
      !basename(real).startsWith(prefix)) {
    throw new Error("Private directory escaped its trusted parent.");
  }
  return real;
}

function writeExclusive(path, bytes, mode = 0o600) {
  const handle = openSync(path, "wx", mode);
  try {
    writeFileSync(handle, bytes);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  try { chmodSync(path, mode); } catch { /* Windows access bits are advisory */ }
}

function safeRemovePrivate(path, parent, prefix) {
  if (typeof path !== "string") return;
  const child = relative(parent, path);
  if (child.length === 0 || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child) ||
      !basename(path).startsWith(prefix)) {
    throw new Error("Refusing to remove an unexpected private path.");
  }
  rmSync(path, { force: true, recursive: true });
}

function validateInputs(environment) {
  const workspaceRoot = requireWorkspace(environment);
  const policyKind = getInput(environment, "policy-kind");
  if (policyKind !== "policy" && policyKind !== "policy-set") {
    automation("MEMORYOS_CI_CLI_PROTOCOL_INVALID", "actionInput");
  }

  const policySpelling = getInput(environment, "policy-path");
  const policySegments = validatePortablePath(policySpelling);
  const policySource = validatePhysicalPortableFile(workspaceRoot, policySpelling, policySegments);

  const expectedSemanticDigest = getInput(environment, "expected-policy-semantic-digest");
  if (!DIGEST_PATTERN.test(expectedSemanticDigest)) {
    automation("MEMORYOS_CI_POLICY_PIN_MISMATCH", "actionInput");
  }

  const candidateSpelling = getInput(environment, "candidate-mip-path");
  const candidateSegments = validatePortablePath(candidateSpelling);
  const candidateSource = validatePhysicalPortableFile(workspaceRoot, candidateSpelling, candidateSegments);

  const baselineSpelling = getInput(environment, "regression-baseline-mip-path");
  const baselineSegments = validatePortablePath(baselineSpelling, { optional: true });
  const baselineSource = baselineSegments === null
    ? null
    : validatePhysicalPortableFile(workspaceRoot, baselineSpelling, baselineSegments);
  return Object.freeze({
    baselineSource,
    candidateSource,
    expectedSemanticDigest,
    policyKind,
    policySource,
    workspaceRoot,
  });
}

function snapshotInputs(validated, parent) {
  const root = createPrivateDirectory(parent, "memoryos-policy-gate-input-");
  try {
    const policyPath = join(root, "policy-input.json");
    const candidatePath = join(root, "candidate.mip");
    writeExclusive(policyPath, readSourceOnce(validated.workspaceRoot, validated.policySource), 0o400);
    writeExclusive(candidatePath, readSourceOnce(validated.workspaceRoot, validated.candidateSource), 0o400);
    let baselinePath = null;
    if (validated.baselineSource !== null) {
      baselinePath = join(root, "baseline.mip");
      writeExclusive(baselinePath, readSourceOnce(validated.workspaceRoot, validated.baselineSource), 0o400);
    }
    return Object.freeze({ baselinePath, candidatePath, policyPath, root });
  } catch (error) {
    try { safeRemovePrivate(root, parent, "memoryos-policy-gate-input-"); } catch { /* retain primary */ }
    throw error;
  }
}

function childEnvironment(environment) {
  const result = Object.create(null);
  for (const name of ["SystemRoot", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL"]) {
    if (typeof environment[name] === "string") result[name] = environment[name];
  }
  result.NO_COLOR = "1";
  return result;
}

function protocolPhase(invocation) {
  if (invocation === "identitiesPreflight") return "contractIdentityPreflight";
  if (invocation === "policyDigest") return "policyPreparation";
  if (invocation === "evaluate") return "evaluation";
  if (invocation === "verifyIdentityArtifact" || invocation === "verifyOutcomeArtifact") {
    return "artifactVerification";
  }
  if (invocation === "verifyOutcomeEvaluation") return "authoritativeReconstruction";
  if (invocation === "identitiesPostEvaluation") return "postEvaluationIdentityRecheck";
  return "internal";
}

function cliProtocolFailure(phase = "evaluation") {
  automation("MEMORYOS_CI_CLI_PROTOCOL_INVALID", phase);
}

function validateCliError(value, processExit, phase) {
  if (!ownKeysExactly(value, [
    "artifactKind", "code", "details", "exitCode", "failureClass",
    "limitIdentifier", "message", "phase",
  ]) ||
      !(value.artifactKind === null || (typeof value.artifactKind === "string" &&
        MACHINE_SCALAR_PATTERN.test(value.artifactKind))) ||
      typeof value.code !== "string" || !STABLE_CODE_PATTERN.test(value.code) ||
      value.code.startsWith("MEMORYOS_CI_") ||
      !Number.isSafeInteger(value.exitCode) || value.exitCode < 1 || value.exitCode > 5 ||
      value.exitCode !== processExit ||
      value.failureClass !== CLI_FAILURE_CLASS_BY_EXIT.get(value.exitCode) ||
      !(value.limitIdentifier === null || (typeof value.limitIdentifier === "string" &&
        MACHINE_SCALAR_PATTERN.test(value.limitIdentifier))) ||
      typeof value.message !== "string" || !Array.isArray(value.details) ||
      !(value.phase === null || (typeof value.phase === "string" &&
        MACHINE_SCALAR_PATTERN.test(value.phase)))) {
    cliProtocolFailure(phase);
  }
  return Object.freeze({
    artifactKind: value.artifactKind,
    code: value.code,
    exitCode: value.exitCode,
    failureClass: value.failureClass,
    limitIdentifier: value.limitIdentifier,
    phase: value.phase,
  });
}

function parseCliEnvelope(result, expectedCommand, invocation, allowedSuccessExits) {
  const phase = protocolPhase(invocation);
  if (result === null || typeof result !== "object" || result.error !== undefined ||
      result.signal !== null || !Number.isSafeInteger(result.status) ||
      !(result.stdout instanceof Uint8Array)) {
    cliProtocolFailure(phase);
  }
  let envelope;
  try {
    envelope = parseCanonicalJson(result.stdout, true);
  } catch {
    cliProtocolFailure(phase);
  }
  if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope) ||
      typeof envelope.ok !== "boolean") {
    cliProtocolFailure(phase);
  }
  if (!ownKeysExactly(envelope, envelope.ok === true
    ? ["command", "ok", "result", "schemaVersion"]
    : ["command", "error", "ok", "schemaVersion"]) ||
      envelope.command !== expectedCommand || envelope.schemaVersion !== "1.1") {
    cliProtocolFailure(phase);
  }
  if (envelope.ok === false) {
    const projection = validateCliError(envelope.error, result.status, phase);
    throw new CliSemanticFailure(projection, invocation);
  }
  if (envelope.ok !== true || !allowedSuccessExits.has(result.status)) cliProtocolFailure(phase);
  return Object.freeze({
    bytes: Buffer.from(result.stdout),
    exitCode: result.status,
    result: envelope.result,
  });
}

export function invokeCli({
  actionRoot,
  args,
  environment = process.env,
  expectedCommand,
  invocation,
  allowedSuccessExits = new Set([0]),
  spawn = spawnSync,
  cwd,
}) {
  const driver = resolve(actionRoot, "dist/cli-driver.mjs");
  let result;
  try {
    result = spawn(process.execPath, [driver, ...args], {
      cwd,
      encoding: null,
      env: childEnvironment(environment),
      maxBuffer: 1024 * 1024,
      shell: false,
      windowsHide: true,
    });
  } catch {
    cliProtocolFailure(protocolPhase(invocation));
  }
  return parseCliEnvelope(result, expectedCommand, invocation, allowedSuccessExits);
}

function requireExactResultKeys(value, keys, phase) {
  if (!ownKeysExactly(value, keys)) cliProtocolFailure(phase);
}

function validateIdentitiesResult(value, expected) {
  if (!canonicalEqual(value, expected)) {
    automation("MEMORYOS_CI_CONTRACT_IDENTITY_MISMATCH", "contractIdentityPreflight");
  }
}

function validateDigestResult(value) {
  requireExactResultKeys(
    value,
    ["artifactKind", "artifactVersion", "documentDigest", "semanticDigest"],
    "policyPreparation",
  );
  if (typeof value.artifactKind !== "string" || value.artifactVersion !== "1.0.0" ||
      !DIGEST_PATTERN.test(value.documentDigest) || !DIGEST_PATTERN.test(value.semanticDigest)) {
    cliProtocolFailure("policyPreparation");
  }
}

function validateEvaluationResult(value) {
  requireExactResultKeys(
    value,
    ["decision", "evaluationIdentityDigest", "outcomeDigest"],
    "evaluation",
  );
  if (!["PASS", "FAIL", "COULD_NOT_EVALUATE"].includes(value.decision) ||
      !DIGEST_PATTERN.test(value.evaluationIdentityDigest) || !DIGEST_PATTERN.test(value.outcomeDigest)) {
    cliProtocolFailure("evaluation");
  }
}

function validateIdentityVerificationResult(value) {
  requireExactResultKeys(
    value,
    ["evaluationIdentityDigest", "verificationScope", "verified"],
    "artifactVerification",
  );
  if (!DIGEST_PATTERN.test(value.evaluationIdentityDigest) ||
      value.verificationScope !== "serializedArtifact" || value.verified !== true) {
    cliProtocolFailure("artifactVerification");
  }
}

function validateOutcomeVerificationResult(value, expectedScope) {
  const phase = expectedScope === "serializedArtifact"
    ? "artifactVerification"
    : "authoritativeReconstruction";
  requireExactResultKeys(value, [
    "decision", "evaluationIdentityDigest", "outcomeDigest", "verificationScope", "verified",
  ], phase);
  if (!["PASS", "FAIL", "COULD_NOT_EVALUATE"].includes(value.decision) ||
      !DIGEST_PATTERN.test(value.evaluationIdentityDigest) || !DIGEST_PATTERN.test(value.outcomeDigest) ||
      value.verificationScope !== expectedScope || value.verified !== true) cliProtocolFailure(phase);
}

function policyOption(policyKind) {
  return policyKind === "policy" ? "--policy" : "--policy-set";
}

function sidecarValue(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 71 ||
      bytes.some((byte) => byte > 0x7f) || bytes.includes(0x0a) || bytes.includes(0x0d)) {
    automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
  }
  const value = bytes.toString("ascii");
  if (!SIDECAR_PATTERN.test(value)) {
    automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
  }
  return value;
}

function generationPath(root, name) {
  return join(root, name);
}

function readStablePrivateFile(root, name) {
  const rootStatus = lstatSync(root);
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory() || realpathSync.native(root) !== root) {
    throw new Error("Private artifact root is not a stable directory.");
  }
  const path = generationPath(root, name);
  const listed = lstatSync(path, { bigint: true });
  if (listed.isSymbolicLink() || !listed.isFile()) {
    throw new Error("Private artifact member is not a regular file.");
  }
  const initialPhysical = realpathSync.native(path);
  if (dirname(initialPhysical) !== root || basename(initialPhysical) !== name) {
    throw new Error("Private artifact member escaped its generation.");
  }
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NONBLOCK ?? 0) |
    (process.platform === "win32" ? 0 : (fsConstants.O_NOFOLLOW ?? 0));
  let handle;
  try {
    handle = openSync(path, flags);
    const before = fstatSync(handle, { bigint: true });
    if (!before.isFile() || !sameOpenFile(listed, before)) {
      throw new Error("Private artifact member changed before capture.");
    }
    const bytes = readFileSync(handle);
    const after = fstatSync(handle, { bigint: true });
    const finalListed = lstatSync(path, { bigint: true });
    if (!sameOpenFile(before, after) || BigInt(bytes.length) !== after.size ||
        finalListed.isSymbolicLink() || !finalListed.isFile() ||
        !sameOpenFile(after, finalListed) || realpathSync.native(path) !== initialPhysical) {
      throw new Error("Private artifact member changed during capture.");
    }
    return bytes;
  } finally {
    if (handle !== undefined) {
      try { closeSync(handle); } catch { /* the capture result remains invalid */ }
    }
  }
}

function assertGenerationBytes(root, generation, phase) {
  try {
    for (const name of GENERATION_FILE_NAMES) {
      if (!bytesEqual(readStablePrivateFile(root, name), generation.files[name])) {
        throw new Error("Sealed generation bytes changed.");
      }
    }
  } catch {
    automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", phase);
  }
}

function sealGeneration(parent, generation) {
  const root = createPrivateDirectory(parent, "memoryos-policy-gate-artifacts-");
  try {
    for (const name of GENERATION_PUBLICATION_ORDER) {
      writeExclusive(generationPath(root, name), generation.files[name], 0o400);
    }
    assertGenerationBytes(root, generation, "publicationGeneration");
    return root;
  } catch (error) {
    try { safeRemovePrivate(root, parent, "memoryos-policy-gate-artifacts-"); } catch { /* retain primary */ }
    throw error;
  }
}

export function verifyGeneration(root, evaluation) {
  let actual;
  try {
    actual = readdirSync(root).sort();
  } catch {
    automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
  }
  if (!canonicalEqual(actual, GENERATION_FILE_NAMES)) {
    automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
  }
  const files = {};
  for (const name of GENERATION_FILE_NAMES) {
    try {
      files[name] = readStablePrivateFile(root, name);
    } catch {
      automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
    }
  }
  let identity;
  let outcome;
  try {
    identity = parseCanonicalJson(files["evaluation-identity.json"]);
    outcome = parseCanonicalJson(files["evaluation-outcome.json"]);
  } catch {
    automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
  }
  const identitySidecar = sidecarValue(files["evaluation-identity.sha256"]);
  const outcomeSidecar = sidecarValue(files["evaluation-outcome.sha256"]);
  const computedIdentity = domainSeparatedDigest(IDENTITY_DOMAIN, files["evaluation-identity.json"]);
  const computedOutcome = domainSeparatedDigest(OUTCOME_DOMAIN, files["evaluation-outcome.json"]);
  if (!ownKeysExactly(outcome, ["evaluationIdentity", "evaluationIdentityDigest", "kind", "result", "version"]) ||
      outcome.kind !== "MemoryOSPolicyEvaluationOutcome" || outcome.version !== "1.0.0" ||
      !canonicalEqual(identity, outcome.evaluationIdentity) ||
      identitySidecar !== computedIdentity || outcomeSidecar !== computedOutcome ||
      outcome.evaluationIdentityDigest !== identitySidecar ||
      evaluation.evaluationIdentityDigest !== identitySidecar || evaluation.outcomeDigest !== outcomeSidecar ||
      outcome.result?.decision !== evaluation.decision) {
    automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
  }
  return Object.freeze({
    decision: evaluation.decision,
    evaluationIdentity: identity,
    evaluationIdentityDigest: identitySidecar,
    files: Object.freeze(files),
    outcome,
    outcomeDigest: outcomeSidecar,
  });
}

function verifyResultAgreement(value, generation) {
  return value.decision === generation.decision &&
    value.evaluationIdentityDigest === generation.evaluationIdentityDigest &&
    value.outcomeDigest === generation.outcomeDigest;
}

function validateEmbeddedIdentity(identity, expected, policyKind, semanticDigest, baselinePresent) {
  const artifactKind = policyKind === "policy"
    ? "MemoryOSInvestigationPolicy"
    : "MemoryOSInvestigationPolicySet";
  if (identity?.kind !== "MemoryOSPolicyEvaluationIdentity" || identity.version !== "1.0.0" ||
      identity.evaluatorVersion !== expected.evaluatorVersion ||
      identity.outcomeContractVersion !== expected.outcomeContractVersion ||
      !canonicalEqual(identity.ruleRegistry, expected.ruleRegistry) ||
      !canonicalEqual(identity.resourceProfile, expected.resourceProfile) ||
      identity.deterministicFactSourceRegistry?.registryVersion !==
        expected.deterministicFactSourceRegistry.registryVersion ||
      identity.deterministicFactSourceRegistry?.registryDigest !==
        expected.deterministicFactSourceRegistry.registryDigest ||
      identity.policyFactContext?.factModelVersion !== expected.factModel.factModelVersion ||
      identity.policyFactContext?.factModelDigest !== expected.factModel.factModelDigest ||
      !DIGEST_PATTERN.test(identity.policyFactContext?.contextDigest ?? "")) {
    automation("MEMORYOS_CI_CONTRACT_IDENTITY_MISMATCH", "postEvaluationIdentityRecheck");
  }
  if (identity.evaluatedArtifact?.kind !== artifactKind ||
      identity.evaluatedArtifact?.artifactVersion !== "1.0.0" ||
      identity.evaluatedArtifact?.semanticDigest !== semanticDigest) {
    automation("MEMORYOS_CI_POLICY_PIN_MISMATCH", "postEvaluationIdentityRecheck");
  }
  if (!Array.isArray(identity.externalSources) ||
      (!baselinePresent && identity.externalSources.length !== 0) ||
      (baselinePresent && (identity.externalSources.length !== 1 ||
        identity.externalSources[0]?.domain !== "cognitiveRegression" ||
        !DIGEST_PATTERN.test(identity.externalSources[0]?.sourceDigest ?? "")))) {
    automation("MEMORYOS_CI_CONTRACT_IDENTITY_MISMATCH", "postEvaluationIdentityRecheck");
  }
  return Object.freeze({
    artifactKind,
    contextDigest: identity.policyFactContext.contextDigest,
    regressionSourceDigest: baselinePresent ? identity.externalSources[0].sourceDigest : null,
  });
}

function expectedExit(decision) {
  if (decision === "PASS") return 0;
  if (decision === "FAIL") return 6;
  if (decision === "COULD_NOT_EVALUATE") return 7;
  return null;
}

export function buildReceipt({
  distribution,
  manifestRawSha256,
  contractIdentities,
  artifactKind,
  semanticDigest,
  contextDigest,
  regressionSourceDigest,
  decision,
  cliExitCode,
  evaluationIdentityDigest,
  outcomeDigest,
  retainedFiles,
}) {
  const retainedFileRawSha256 = {};
  for (const name of RETAINED_FILE_NAMES) retainedFileRawSha256[name] = rawSha256(retainedFiles[name]);
  return Object.freeze({
    kind: RECEIPT_KIND,
    version: RECEIPT_VERSION,
    distribution: {
      repository: distribution.repository,
      revision: distribution.revision,
      manifestRawSha256,
    },
    contractIdentities,
    policy: { artifactKind, semanticDigest },
    policyFactContextDigest: contextDigest,
    regressionSourceDigest,
    decision,
    originalCliExitCode: cliExitCode,
    evaluationIdentityDigest,
    outcomeDigest,
    publicationValid: true,
    retainedFileRawSha256,
  });
}

function outputBase(outputNames, distribution) {
  return Object.fromEntries(outputNames.map((name) => [name,
    name === "distribution-repository" ? distribution.repository :
      name === "distribution-revision" ? distribution.revision : ""]));
}

function failureOutputs(outputNames, distribution, failure, evaluationExitCode = null) {
  const values = outputBase(outputNames, distribution);
  values["gate-class"] = "tool-failure";
  values["publication-valid"] = "false";
  if (evaluationExitCode !== null) values["cli-exit-code"] = String(evaluationExitCode);
  if (failure instanceof AutomationFailure) {
    values["stable-code"] = failure.failure.code;
    values["failure-class"] = "automation";
    values.phase = failure.failure.phase;
  } else if (failure instanceof CliSemanticFailure) {
    values["stable-code"] = failure.error.code;
    values["failure-class"] = failure.error.failureClass;
    values.phase = failure.error.phase ?? "";
    values["artifact-kind"] = failure.error.artifactKind ?? "";
    values["limit-identifier"] = failure.error.limitIdentifier ?? "";
  } else {
    values["stable-code"] = "MEMORYOS_CI_INTERNAL_FAILURE";
    values["failure-class"] = "automation";
    values.phase = "internal";
  }
  return values;
}

function successOutputs(outputNames, distribution, verified) {
  const values = outputBase(outputNames, distribution);
  values["gate-class"] = verified.decision === "PASS"
    ? "pass"
    : (verified.decision === "FAIL" ? "policy-fail" : "policy-cne");
  values.decision = verified.decision;
  values["cli-exit-code"] = String(verified.cliExitCode);
  values["publication-valid"] = "true";
  values["policy-semantic-digest"] = verified.semanticDigest;
  values["evaluation-identity-digest"] = verified.generation.evaluationIdentityDigest;
  values["outcome-digest"] = verified.generation.outcomeDigest;
  values["policy-fact-context-digest"] = verified.bindings.contextDigest;
  values["regression-source-digest"] = verified.bindings.regressionSourceDigest ?? "";
  values["evaluation-identity-path"] = generationPath(verified.artifactRoot, "evaluation-identity.json");
  values["outcome-path"] = generationPath(verified.artifactRoot, "evaluation-outcome.json");
  values["artifact-directory"] = verified.artifactRoot;
  values["artifact-kind"] = verified.bindings.artifactKind;
  if (verified.generation.outcome.result.kind === "MemoryOSPolicyEvaluationResourceLimitResult") {
    values["stable-code"] = verified.generation.outcome.result.code;
    values["limit-identifier"] = verified.generation.outcome.result.limitIdentifier;
  }
  return values;
}

function publishOperationalFiles(artifactRoot, preflightBytes, receipt, generation) {
  try {
    const receiptBytes = canonicalBytes(receipt);
    writeExclusive(generationPath(artifactRoot, "policy-identities.json"), preflightBytes, 0o600);
    writeExclusive(generationPath(artifactRoot, "gate-receipt.json"), receiptBytes, 0o600);
    if (!canonicalEqual(readdirSync(artifactRoot).sort(), FINAL_FILE_NAMES)) {
      throw new Error("Retained artifact inventory is not closed.");
    }
    const expectedFiles = {
      ...generation.files,
      "policy-identities.json": preflightBytes,
    };
    for (const [name, expectedBytes] of Object.entries(expectedFiles)) {
      const actualBytes = readStablePrivateFile(artifactRoot, name);
      if (!bytesEqual(actualBytes, expectedBytes) ||
          receipt.retainedFileRawSha256[name] !== rawSha256(actualBytes)) {
        throw new Error("Retained artifact bytes disagree with the verified receipt.");
      }
    }
    if (!bytesEqual(readStablePrivateFile(artifactRoot, "gate-receipt.json"), receiptBytes)) {
      throw new Error("Retained receipt bytes changed during publication.");
    }
  } catch {
    automation("MEMORYOS_CI_ARTIFACT_PUBLICATION_FAILED", "artifactPublication");
  }
}

export async function runAction({
  actionRoot,
  distribution,
  distributionManifestRawSha256,
  outputNames,
  environment = process.env,
  spawn = spawnSync,
}) {
  let parent;
  let snapshots;
  let generationRoot;
  let artifactRoot;
  let evaluationExitCode = null;
  try {
    const validated = validateInputs(environment);
    parent = privateParent(environment);
    snapshots = snapshotInputs(validated, parent);

    const expectedIdentityBytes = readFileSync(resolve(
      actionRoot,
      "dist/contracts/policy-contract-identities-1.0.0.json",
    ));
    const expectedIdentities = parseCanonicalJson(expectedIdentityBytes);
    const invoke = (request) => invokeCli({
      actionRoot,
      environment,
      spawn,
      cwd: snapshots.root,
      ...request,
    });

    const preflight = invoke({
      args: ["policy", "identities", "--json"],
      expectedCommand: "policy identities",
      invocation: "identitiesPreflight",
    });
    validateIdentitiesResult(preflight.result, expectedIdentities);

    const preparedPolicyPath = join(snapshots.root, "prepared-policy.json");
    const digest = invoke({
      args: [
        "policy", "digest", policyOption(validated.policyKind), snapshots.policyPath,
        "--canonical-output", preparedPolicyPath, "--json",
      ],
      expectedCommand: "policy digest",
      invocation: "policyDigest",
    });
    validateDigestResult(digest.result);
    const selectedArtifactKind = validated.policyKind === "policy"
      ? "MemoryOSInvestigationPolicy"
      : "MemoryOSInvestigationPolicySet";
    if (digest.result.artifactKind !== selectedArtifactKind ||
        digest.result.semanticDigest !== validated.expectedSemanticDigest) {
      automation("MEMORYOS_CI_POLICY_PIN_MISMATCH", "policyPreparation");
    }

    generationRoot = createPrivateDirectory(parent, "memoryos-policy-gate-artifacts-");
    let identityPath = generationPath(generationRoot, "evaluation-identity.json");
    let identityDigestPath = generationPath(generationRoot, "evaluation-identity.sha256");
    let outcomePath = generationPath(generationRoot, "evaluation-outcome.json");
    let outcomeDigestPath = generationPath(generationRoot, "evaluation-outcome.sha256");
    const evaluationArgs = [
      "policy", "evaluate", policyOption(validated.policyKind), preparedPolicyPath,
      "--package", snapshots.candidatePath,
      ...(snapshots.baselinePath === null
        ? []
        : ["--regression-baseline", snapshots.baselinePath]),
      "--outcome", outcomePath,
      "--identity-output", identityPath,
      "--evaluation-identity-digest-output", identityDigestPath,
      "--outcome-digest-output", outcomeDigestPath,
      "--json",
    ];
    let evaluation;
    try {
      evaluation = invoke({
        args: evaluationArgs,
        expectedCommand: "policy evaluate",
        invocation: "evaluate",
        allowedSuccessExits: new Set([0, 6, 7]),
      });
    } catch (error) {
      if (error instanceof CliSemanticFailure) evaluationExitCode = error.error.exitCode;
      throw error;
    }
    evaluationExitCode = evaluation.exitCode;
    validateEvaluationResult(evaluation.result);
    const generation = verifyGeneration(generationRoot, evaluation.result);
    artifactRoot = sealGeneration(parent, generation);
    try {
      safeRemovePrivate(generationRoot, parent, "memoryos-policy-gate-artifacts-");
      generationRoot = undefined;
    } catch {
      automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "publicationGeneration");
    }
    identityPath = generationPath(artifactRoot, "evaluation-identity.json");
    identityDigestPath = generationPath(artifactRoot, "evaluation-identity.sha256");
    outcomePath = generationPath(artifactRoot, "evaluation-outcome.json");
    outcomeDigestPath = generationPath(artifactRoot, "evaluation-outcome.sha256");

    const identityVerification = invoke({
      args: [
        "policy", "verify-identity", identityPath, "--mode", "artifact",
        "--expected-evaluation-identity-digest", generation.evaluationIdentityDigest, "--json",
      ],
      expectedCommand: "policy verify-identity",
      invocation: "verifyIdentityArtifact",
    });
    validateIdentityVerificationResult(identityVerification.result);
    if (identityVerification.result.evaluationIdentityDigest !== generation.evaluationIdentityDigest) {
      automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "artifactVerification");
    }
    assertGenerationBytes(artifactRoot, generation, "artifactVerification");

    const outcomeVerification = invoke({
      args: [
        "policy", "verify-outcome", outcomePath, "--mode", "artifact",
        "--expected-identity", identityPath,
        "--expected-outcome-digest", generation.outcomeDigest, "--json",
      ],
      expectedCommand: "policy verify-outcome",
      invocation: "verifyOutcomeArtifact",
    });
    validateOutcomeVerificationResult(outcomeVerification.result, "serializedArtifact");
    if (!verifyResultAgreement(outcomeVerification.result, generation)) {
      automation("MEMORYOS_CI_PUBLICATION_GENERATION_INVALID", "artifactVerification");
    }
    assertGenerationBytes(artifactRoot, generation, "artifactVerification");

    const reconstruction = invoke({
      args: [
        "policy", "verify-outcome", outcomePath, "--mode", "evaluation",
        policyOption(validated.policyKind), preparedPolicyPath,
        "--package", snapshots.candidatePath,
        ...(snapshots.baselinePath === null
          ? []
          : ["--regression-baseline", snapshots.baselinePath]),
        "--expected-outcome-digest", generation.outcomeDigest, "--json",
      ],
      expectedCommand: "policy verify-outcome",
      invocation: "verifyOutcomeEvaluation",
    });
    validateOutcomeVerificationResult(reconstruction.result, "authoritativeReconstruction");
    if (!verifyResultAgreement(reconstruction.result, generation)) {
      automation(
        "MEMORYOS_CI_AUTHORITATIVE_RECONSTRUCTION_FAILED",
        "authoritativeReconstruction",
      );
    }
    assertGenerationBytes(artifactRoot, generation, "authoritativeReconstruction");

    const postflight = invoke({
      args: ["policy", "identities", "--json"],
      expectedCommand: "policy identities",
      invocation: "identitiesPostEvaluation",
    });
    if (!bytesEqual(postflight.bytes, preflight.bytes)) {
      automation("MEMORYOS_CI_CONTRACT_IDENTITY_MISMATCH", "postEvaluationIdentityRecheck");
    }
    const bindings = validateEmbeddedIdentity(
      generation.evaluationIdentity,
      expectedIdentities,
      validated.policyKind,
      digest.result.semanticDigest,
      snapshots.baselinePath !== null,
    );
    if (generation.evaluationIdentity.evaluatedArtifact.semanticDigest !==
        validated.expectedSemanticDigest) {
      automation("MEMORYOS_CI_POLICY_PIN_MISMATCH", "postEvaluationIdentityRecheck");
    }

    if (expectedExit(generation.decision) !== evaluation.exitCode) {
      automation("MEMORYOS_CI_DECISION_EXIT_MISMATCH", "decisionExitCrossCheck");
    }

    const retainedFiles = { ...generation.files, "policy-identities.json": preflight.bytes };
    const receipt = buildReceipt({
      distribution,
      manifestRawSha256: distributionManifestRawSha256,
      contractIdentities: preflight.result,
      artifactKind: bindings.artifactKind,
      semanticDigest: digest.result.semanticDigest,
      contextDigest: bindings.contextDigest,
      regressionSourceDigest: bindings.regressionSourceDigest,
      decision: generation.decision,
      cliExitCode: evaluation.exitCode,
      evaluationIdentityDigest: generation.evaluationIdentityDigest,
      outcomeDigest: generation.outcomeDigest,
      retainedFiles,
    });
    publishOperationalFiles(artifactRoot, preflight.bytes, receipt, generation);

    safeRemovePrivate(snapshots.root, parent, "memoryos-policy-gate-input-");
    snapshots = undefined;
    const verified = Object.freeze({
      artifactRoot,
      bindings,
      cliExitCode: evaluation.exitCode,
      decision: generation.decision,
      generation,
      semanticDigest: digest.result.semanticDigest,
    });
    return Object.freeze({
      jobSuccess: generation.decision === "PASS",
      outputs: Object.freeze(successOutputs(outputNames, distribution, verified)),
    });
  } catch (cause) {
    if (snapshots !== undefined) {
      try { safeRemovePrivate(snapshots.root, parent, "memoryos-policy-gate-input-"); } catch { /* retain primary */ }
    }
    if (generationRoot !== undefined) {
      try { safeRemovePrivate(generationRoot, parent, "memoryos-policy-gate-artifacts-"); } catch { /* retain primary */ }
    }
    if (artifactRoot !== undefined) {
      try { safeRemovePrivate(artifactRoot, parent, "memoryos-policy-gate-artifacts-"); } catch { /* retain primary */ }
    }
    const classified = cause instanceof AutomationFailure || cause instanceof CliSemanticFailure
      ? cause
      : new AutomationFailure("MEMORYOS_CI_INTERNAL_FAILURE", "internal");
    return Object.freeze({
      jobSuccess: false,
      outputs: Object.freeze(failureOutputs(
        outputNames,
        distribution,
        classified,
        evaluationExitCode,
      )),
    });
  }
}

export const internalContract = Object.freeze({
  AUTOMATION_CODES,
  FAILURE_PHASES,
  FINAL_FILE_NAMES,
  GENERATION_FILE_NAMES,
  RETAINED_FILE_NAMES,
  canonicalBytes,
  parseCanonicalJson,
  rawSha256,
});
