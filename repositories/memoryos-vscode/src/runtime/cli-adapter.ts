import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { Worker } from "node:worker_threads";

import {
  MEMORYOS_VSCODE_ADAPTER_ERROR_CODES,
  MemoryOSAdapterError,
  preserveMemoryOSStableCode,
} from "../errors.js";
import { canonicalJson, compareAscii, rawSha256 } from "./canonical-json.js";
import {
  assertOperationPath,
  type InputSnapshotRole,
  type OperationCapability,
  type OperationOutputRole,
  type OperationPathBinding,
} from "./input-snapshot.js";
import {
  POLICY_CONTRACT_IDENTITIES_BYTE_LENGTH,
  POLICY_CONTRACT_IDENTITIES_FILE,
  POLICY_CONTRACT_IDENTITIES_RAW_SHA256,
  RUNTIME_CLOSURE_DIGEST,
  STDERR_MAX_BYTES,
  STDOUT_MAX_BYTES,
  WORKER_REQUEST_MAX_BYTES,
} from "./runtime-contract.js";
import {
  type VerifiedRuntimeSnapshot,
  verifyAndSnapshotRuntime,
} from "./runtime-distribution.js";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const STABLE_CODE = /^[A-Z][A-Z0-9_]*$/u;
const MAX_WORKER_RESPONSE_BYTES = STDOUT_MAX_BYTES + STDERR_MAX_BYTES + WORKER_REQUEST_MAX_BYTES;

export type PolicyArtifact = Readonly<{
  kind: "policy" | "policySet";
  path: string;
}>;

export type PolicyCliRequest =
  | Readonly<{ kind: "identities" }>
  | Readonly<{
    artifact: PolicyArtifact;
    canonicalOutputPath?: string;
    kind: "digest";
    operation: OperationCapability;
  }>
  | Readonly<{
    artifact: PolicyArtifact;
    evaluationIdentityDigestOutputPath?: string;
    identityOutputPath?: string;
    kind: "evaluate";
    operation: OperationCapability;
    outcomeDigestOutputPath?: string;
    outcomePath: string;
    packagePath: string;
    regressionBaselinePath?: string;
  }>
  | Readonly<{
    expectedEvaluationIdentityDigest: string;
    identityPath: string;
    kind: "verifyIdentity";
    mode: "artifact";
    operation: OperationCapability;
  }>
  | Readonly<{
    artifact: PolicyArtifact;
    identityPath: string;
    kind: "verifyIdentity";
    mode: "evaluation";
    operation: OperationCapability;
    packagePath: string;
    regressionBaselinePath?: string;
  }>
  | Readonly<{
    expectedEvaluationIdentityDigest?: string;
    expectedIdentityPath?: string;
    expectedOutcomeDigest?: string;
    kind: "verifyOutcome";
    mode: "artifact";
    operation: OperationCapability;
    outcomePath: string;
  }>
  | Readonly<{
    artifact: PolicyArtifact;
    expectedOutcomeDigest?: string;
    kind: "verifyOutcome";
    mode: "evaluation";
    operation: OperationCapability;
    outcomePath: string;
    packagePath: string;
    regressionBaselinePath?: string;
  }>;

export interface PolicyCliEnvelope {
  readonly command: string;
  readonly error?: Readonly<Record<string, unknown>>;
  readonly ok: boolean;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly schemaVersion: "1.1";
}

export interface CliExecutionResult {
  readonly envelope: PolicyCliEnvelope;
  readonly exitCode: number;
  readonly memoryOSCode?: string;
  readonly stderr: string;
  readonly stdout: string;
}

export interface IdentityPreflightResult {
  readonly contractArtifactSha256: string;
  readonly identities: Readonly<Record<string, unknown>>;
  readonly runtimeClosureDigest: string;
}

export interface MemoryOSCliAdapter {
  preflight(signal?: AbortSignal): Promise<IdentityPreflightResult>;
  execute(request: PolicyCliRequest, signal?: AbortSignal): Promise<CliExecutionResult>;
  dispose(): Promise<void>;
}

export interface CliAdapterOptions {
  readonly extensionRoot: string;
  readonly workerScriptPath: string;
}

interface WorkerSuccess {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
  readonly type: "result";
}

async function readStableRegularFile(
  path: string,
  maximumBytes: number,
  code: "MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH",
  label: string,
): Promise<Buffer> {
  let handle;
  try {
    const before = await lstat(path, { bigint: true });
    if (before.isSymbolicLink() || !before.isFile()
        || before.size < 1n || before.size > BigInt(maximumBytes)) {
      throw new Error(`${label} metadata mismatch`);
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
    if (cause instanceof MemoryOSAdapterError) throw cause;
    throw adapterError(code, `${label} is unavailable or substituted.`, cause);
  } finally {
    await handle?.close();
  }
}

function adapterError(
  code: (typeof MEMORYOS_VSCODE_ADAPTER_ERROR_CODES)[keyof typeof MEMORYOS_VSCODE_ADAPTER_ERROR_CODES],
  message: string,
  cause?: unknown,
): MemoryOSAdapterError {
  return new MemoryOSAdapterError(code, message, cause === undefined ? undefined : { cause });
}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CANCELLED,
      "The MemoryOS operation was cancelled.",
    );
  }
}

function pathArgument(
  value: unknown,
  label: string,
  operation: OperationCapability,
  binding: OperationPathBinding,
): string {
  if (typeof value !== "string" || value.length === 0 || !isAbsolute(value)) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.INPUT_UNSUPPORTED,
      `${label} must be a non-empty absolute private operation path.`,
    );
  }
  const path = resolve(value);
  assertOperationPath(operation, path, binding);
  return path;
}

function inputPathArgument(
  value: unknown,
  label: string,
  operation: OperationCapability,
  role: InputSnapshotRole,
): string {
  return pathArgument(value, label, operation, { access: "input", role });
}

function outputPathArgument(
  value: unknown,
  label: string,
  operation: OperationCapability,
  role: OperationOutputRole,
): string {
  return pathArgument(value, label, operation, { access: "output", role });
}

function digestArgument(value: unknown, label: string): string {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.INPUT_UNSUPPORTED,
      `${label} must be a lowercase sha256 digest.`,
    );
  }
  return value;
}

function appendArtifact(
  argv: string[],
  artifact: PolicyArtifact,
  operation: OperationCapability,
): void {
  if (artifact?.kind === "policy") {
    argv.push("--policy", inputPathArgument(artifact.path, "Policy path", operation, "policy"));
  }
  else if (artifact?.kind === "policySet") {
    argv.push("--policy-set", inputPathArgument(artifact.path, "Policy Set path", operation, "policySet"));
  } else {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.INPUT_UNSUPPORTED,
      "The Policy artifact selector is unsupported.",
    );
  }
}

function appendEvaluationInput(
  argv: string[],
  request: {
    readonly artifact: PolicyArtifact;
    readonly operation: OperationCapability;
    readonly packagePath: string;
    readonly regressionBaselinePath?: string;
  },
): void {
  appendArtifact(argv, request.artifact, request.operation);
  argv.push("--package", inputPathArgument(request.packagePath, "MIP path", request.operation, "candidateMip"));
  if (request.regressionBaselinePath !== undefined) {
    argv.push(
      "--regression-baseline",
      inputPathArgument(
        request.regressionBaselinePath,
        "Regression baseline MIP path",
        request.operation,
        "baselineMip",
      ),
    );
  }
}

export function buildPolicyArgv(request: PolicyCliRequest): readonly string[] {
  const argv: string[] = ["policy"];
  if (request.kind === "identities") {
    argv.push("identities");
  } else if (request.kind === "digest") {
    argv.push("digest");
    appendArtifact(argv, request.artifact, request.operation);
    if (request.canonicalOutputPath !== undefined) {
      argv.push(
        "--canonical-output",
        outputPathArgument(
          request.canonicalOutputPath,
          "Canonical artifact output path",
          request.operation,
          "canonicalArtifact",
        ),
      );
    }
  } else if (request.kind === "evaluate") {
    argv.push("evaluate");
    appendEvaluationInput(argv, request);
    argv.push(
      "--outcome",
      outputPathArgument(request.outcomePath, "Outcome output path", request.operation, "outcome"),
    );
    if (request.identityOutputPath !== undefined) {
      argv.push(
        "--identity-output",
        outputPathArgument(
          request.identityOutputPath,
          "Identity output path",
          request.operation,
          "evaluationIdentity",
        ),
      );
    }
    if (request.evaluationIdentityDigestOutputPath !== undefined) {
      argv.push(
        "--evaluation-identity-digest-output",
        outputPathArgument(
          request.evaluationIdentityDigestOutputPath,
          "Identity digest output path",
          request.operation,
          "evaluationIdentityDigest",
        ),
      );
    }
    if (request.outcomeDigestOutputPath !== undefined) {
      argv.push(
        "--outcome-digest-output",
        outputPathArgument(
          request.outcomeDigestOutputPath,
          "Outcome digest output path",
          request.operation,
          "outcomeDigest",
        ),
      );
    }
  } else if (request.kind === "verifyIdentity") {
    argv.push(
      "verify-identity",
      inputPathArgument(
        request.identityPath,
        "Evaluation Identity path",
        request.operation,
        "evaluationIdentity",
      ),
    );
    argv.push("--mode", request.mode);
    if (request.mode === "artifact") {
      argv.push(
        "--expected-evaluation-identity-digest",
        digestArgument(request.expectedEvaluationIdentityDigest, "Expected Evaluation Identity digest"),
      );
    } else {
      appendEvaluationInput(argv, request);
    }
  } else if (request.kind === "verifyOutcome") {
    argv.push(
      "verify-outcome",
      inputPathArgument(request.outcomePath, "Policy outcome path", request.operation, "policyOutcome"),
    );
    argv.push("--mode", request.mode);
    if (request.mode === "artifact") {
      const hasIdentity = request.expectedIdentityPath !== undefined;
      const hasDigest = request.expectedEvaluationIdentityDigest !== undefined;
      if (hasIdentity === hasDigest) {
        throw adapterError(
          MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.INPUT_REQUIRED,
          "Artifact outcome verification requires exactly one expected identity authority.",
        );
      }
      if (request.expectedIdentityPath !== undefined) {
        argv.push(
          "--expected-identity",
          inputPathArgument(
            request.expectedIdentityPath,
            "Expected Evaluation Identity path",
            request.operation,
            "expectedEvaluationIdentity",
          ),
        );
      } else {
        argv.push(
          "--expected-evaluation-identity-digest",
          digestArgument(
            request.expectedEvaluationIdentityDigest,
            "Expected Evaluation Identity digest",
          ),
        );
      }
    } else {
      appendEvaluationInput(argv, request);
    }
    if (request.expectedOutcomeDigest !== undefined) {
      argv.push(
        "--expected-outcome-digest",
        digestArgument(request.expectedOutcomeDigest, "Expected outcome digest"),
      );
    }
  } else {
    const unreachable: never = request;
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.INPUT_UNSUPPORTED,
      `Unsupported closed CLI request '${String(unreachable)}'.`,
    );
  }
  argv.push("--json");
  return Object.freeze(argv);
}

function commandName(argv: readonly string[]): string {
  return `${argv[0]} ${argv[1]}`;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort(compareAscii))
    === JSON.stringify([...expected].sort(compareAscii));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isDecision(value: unknown): value is "PASS" | "FAIL" | "COULD_NOT_EVALUATE" {
  return value === "PASS" || value === "FAIL" || value === "COULD_NOT_EVALUATE";
}

function expectedVerificationScope(argv: readonly string[]): string | undefined {
  const modeIndex = argv.indexOf("--mode");
  if (modeIndex < 0 || modeIndex + 1 >= argv.length) return undefined;
  if (argv[modeIndex + 1] === "artifact") return "serializedArtifact";
  if (argv[modeIndex + 1] === "evaluation") return "authoritativeReconstruction";
  return undefined;
}

function validateSuccessPayload(
  payload: Record<string, unknown>,
  expectedCommand: string,
  argv: readonly string[],
): void {
  let valid = false;
  if (expectedCommand === "policy identities") {
    // The complete normative shape is compared byte-semantically against the
    // frozen contract artifact immediately after envelope validation.
    valid = true;
  } else if (expectedCommand === "policy digest") {
    const expectedArtifactKind = argv.includes("--policy")
      ? "MemoryOSInvestigationPolicy"
      : argv.includes("--policy-set")
        ? "MemoryOSInvestigationPolicySet"
        : undefined;
    valid = exactKeys(payload, [
      "artifactKind", "artifactVersion", "documentDigest", "semanticDigest",
    ])
      && expectedArtifactKind !== undefined
      && payload.artifactKind === expectedArtifactKind
      && payload.artifactVersion === "1.0.0"
      && isDigest(payload.documentDigest)
      && isDigest(payload.semanticDigest);
  } else if (expectedCommand === "policy evaluate") {
    valid = exactKeys(payload, ["decision", "evaluationIdentityDigest", "outcomeDigest"])
      && isDecision(payload.decision)
      && isDigest(payload.evaluationIdentityDigest)
      && isDigest(payload.outcomeDigest);
  } else if (expectedCommand === "policy verify-identity") {
    const scope = expectedVerificationScope(argv);
    valid = scope !== undefined
      && exactKeys(payload, ["evaluationIdentityDigest", "verificationScope", "verified"])
      && isDigest(payload.evaluationIdentityDigest)
      && payload.verificationScope === scope
      && payload.verified === true;
  } else if (expectedCommand === "policy verify-outcome") {
    const scope = expectedVerificationScope(argv);
    valid = scope !== undefined
      && exactKeys(payload, [
        "decision", "evaluationIdentityDigest", "outcomeDigest", "verificationScope", "verified",
      ])
      && isDecision(payload.decision)
      && isDigest(payload.evaluationIdentityDigest)
      && isDigest(payload.outcomeDigest)
      && payload.verificationScope === scope
      && payload.verified === true;
  }
  if (!valid) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI success result does not match the frozen command-specific product contract.",
    );
  }
}

function validateEnvelopeExitBinding(
  success: boolean,
  payload: Record<string, unknown>,
  expectedCommand: string,
  exitCode: number,
): void {
  if (!success) {
    if (!exactKeys(payload, [
      "artifactKind",
      "code",
      "details",
      "exitCode",
      "failureClass",
      "limitIdentifier",
      "message",
      "phase",
    ])
        || typeof payload.exitCode !== "number"
        || !Number.isSafeInteger(payload.exitCode)
        || payload.exitCode !== exitCode
        || exitCode < 1
        || exitCode > 255
        || (payload.artifactKind !== null && typeof payload.artifactKind !== "string")
        || !Array.isArray(payload.details)
        || typeof payload.failureClass !== "string"
        || (payload.limitIdentifier !== null && typeof payload.limitIdentifier !== "string")
        || typeof payload.message !== "string"
        || (payload.phase !== null && typeof payload.phase !== "string")) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
        "The CLI failure envelope and process exit status disagree.",
      );
    }
    return;
  }

  if (expectedCommand !== "policy evaluate") {
    if (exitCode !== 0) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
        "A successful non-evaluation command returned a nonzero exit status.",
      );
    }
    return;
  }

  const expectedExitCode = payload.decision === "PASS"
    ? 0
    : payload.decision === "FAIL"
      ? 6
      : payload.decision === "COULD_NOT_EVALUATE"
        ? 7
        : undefined;
  if (expectedExitCode === undefined || exitCode !== expectedExitCode) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The Policy evaluation decision and process exit status disagree.",
    );
  }
}

function parseEnvelope(execution: WorkerSuccess, argv: readonly string[]): CliExecutionResult {
  const expectedCommand = commandName(argv);
  if (Buffer.byteLength(execution.stdout, "utf8") > STDOUT_MAX_BYTES
      || Buffer.byteLength(execution.stderr, "utf8") > STDERR_MAX_BYTES) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI output exceeded a frozen byte bound.",
    );
  }
  const hasStdout = execution.stdout.length > 0;
  const hasStderr = execution.stderr.length > 0;
  if (hasStdout === hasStderr) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI must emit exactly one complete JSON record on exactly one output channel.",
    );
  }
  const text = hasStdout ? execution.stdout : execution.stderr;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI did not emit a complete JSON envelope.",
      cause,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID, "The CLI envelope is not an object.");
  }
  const envelope = parsed as Record<string, unknown>;
  if (envelope.command !== expectedCommand
      || envelope.schemaVersion !== "1.1"
      || typeof envelope.ok !== "boolean") {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI envelope identity or command binding is invalid.",
    );
  }
  const success = envelope.ok === true;
  if ((success && !hasStdout) || (!success && !hasStderr)) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI envelope, output channel, and exit status disagree.",
    );
  }
  if (!exactKeys(envelope, success
    ? ["command", "ok", "result", "schemaVersion"]
    : ["command", "error", "ok", "schemaVersion"])) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI envelope contains an unexpected member.",
    );
  }
  const payload = success ? envelope.result : envelope.error;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI envelope payload is not an object.",
    );
  }
  if (success) validateSuccessPayload(payload as Record<string, unknown>, expectedCommand, argv);
  validateEnvelopeExitBinding(
    success,
    payload as Record<string, unknown>,
    expectedCommand,
    execution.exitCode,
  );
  let canonical: string;
  try {
    canonical = `${canonicalJson(envelope)}\n`;
  } catch (cause) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI envelope is outside the canonical JSON subset.",
      cause,
    );
  }
  if (canonical !== text) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The CLI envelope is not the exact canonical JSON transport record.",
    );
  }
  let memoryOSCode: string | undefined;
  if (!success) {
    const error = payload as Record<string, unknown>;
    if (!STABLE_CODE.test(String(error.code ?? ""))) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
        "The CLI failure envelope has no valid stable machine code.",
      );
    }
    memoryOSCode = preserveMemoryOSStableCode(error.code);
  }
  return Object.freeze({
    envelope: envelope as unknown as PolicyCliEnvelope,
    exitCode: execution.exitCode,
    ...(memoryOSCode === undefined ? {} : { memoryOSCode }),
    stderr: execution.stderr,
    stdout: execution.stdout,
  });
}

function validateWorkerSuccess(value: unknown): WorkerSuccess {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch (cause) {
    throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED, "The worker response is not JSON data.", cause);
  }
  if (typeof encoded !== "string") {
    throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED, "The worker response is not JSON data.");
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_WORKER_RESPONSE_BYTES) {
    throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID, "The worker response exceeded its bound.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED, "The worker response is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (record.type === "failure") {
    const code = record.adapterCode;
    if (!exactKeys(record, ["adapterCode", "message", "type"])
        || typeof record.message !== "string"
        || (code !== MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID
          && code !== MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED)) {
      throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED, "The worker failure code is invalid.");
    }
    throw adapterError(code, record.message);
  }
  if (!exactKeys(record, ["exitCode", "stderr", "stdout", "type"])
      || record.type !== "result"
      || !Number.isSafeInteger(record.exitCode)
      || (record.exitCode as number) < 0
      || (record.exitCode as number) > 255
      || typeof record.stdout !== "string"
      || typeof record.stderr !== "string") {
    throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED, "The worker result shape is invalid.");
  }
  return record as unknown as WorkerSuccess;
}

async function loadContractArtifact(extensionRoot: string): Promise<Readonly<Record<string, unknown>>> {
  const path = join(extensionRoot, "contracts", POLICY_CONTRACT_IDENTITIES_FILE);
  const bytes = await readStableRegularFile(
    path,
    POLICY_CONTRACT_IDENTITIES_BYTE_LENGTH,
    MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH,
    "The packaged normative contract identity artifact",
  );
  if (bytes.length !== POLICY_CONTRACT_IDENTITIES_BYTE_LENGTH) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH,
      "The packaged normative contract identity artifact has an unexpected byte length.",
    );
  }
  if (rawSha256(bytes) !== POLICY_CONTRACT_IDENTITIES_RAW_SHA256) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH,
      "The packaged normative contract identity artifact failed byte verification.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH,
      "The packaged normative contract identity artifact is not JSON.",
      cause,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)
      || canonicalJson(parsed) !== bytes.toString("utf8")) {
    throw adapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH,
      "The packaged normative contract identity artifact is not canonical.",
    );
  }
  return Object.freeze(parsed as Record<string, unknown>);
}

class CliAdapter implements MemoryOSCliAdapter {
  readonly #extensionRoot: string;
  readonly #workerScriptPath: string;
  #busy = false;
  #disposePromise: Promise<void> | undefined;
  #disposed = false;
  #idle: Promise<void> = Promise.resolve();
  #releaseIdle: (() => void) | undefined;
  #snapshot: VerifiedRuntimeSnapshot | undefined;

  constructor(options: CliAdapterOptions) {
    if (!isAbsolute(options.extensionRoot) || !isAbsolute(options.workerScriptPath)) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH,
        "The extension root and worker script path must be absolute package-owned paths.",
      );
    }
    this.#extensionRoot = resolve(options.extensionRoot);
    this.#workerScriptPath = resolve(options.workerScriptPath);
  }

  async preflight(signal?: AbortSignal): Promise<IdentityPreflightResult> {
    return this.#exclusive(async () => this.#preflight(signal));
  }

  async execute(request: PolicyCliRequest, signal?: AbortSignal): Promise<CliExecutionResult> {
    return this.#exclusive(async () => {
      const preflightExecution = await this.#identityExecution(signal);
      await this.#enforceIdentities(preflightExecution);
      assertNotCancelled(signal);
      if (request.kind === "identities") return preflightExecution;
      const argv = buildPolicyArgv(request);
      const semanticExecution = await this.#executeArgv(argv, signal);
      const postflightExecution = await this.#identityExecution(signal);
      await this.#enforceIdentities(postflightExecution);
      assertNotCancelled(signal);
      return semanticExecution;
    });
  }

  dispose(): Promise<void> {
    if (this.#disposePromise !== undefined) return this.#disposePromise;
    this.#disposed = true;
    this.#disposePromise = this.#disposeAfterIdle();
    return this.#disposePromise;
  }

  async #disposeAfterIdle(): Promise<void> {
    await this.#idle;
    const snapshot = this.#snapshot;
    this.#snapshot = undefined;
    await snapshot?.dispose();
  }

  async #exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#disposed) {
      throw adapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED, "The CLI adapter is disposed.");
    }
    if (this.#busy) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OPERATION_IN_PROGRESS,
        "Only one MemoryOS semantic operation may run at a time.",
      );
    }
    this.#busy = true;
    this.#idle = new Promise<void>((resolveIdle) => { this.#releaseIdle = resolveIdle; });
    try {
      return await operation();
    } finally {
      this.#busy = false;
      this.#releaseIdle?.();
      this.#releaseIdle = undefined;
    }
  }

  async #preflight(signal?: AbortSignal): Promise<IdentityPreflightResult> {
    const execution = await this.#identityExecution(signal);
    const identities = await this.#enforceIdentities(execution);
    assertNotCancelled(signal);
    return Object.freeze({
      contractArtifactSha256: POLICY_CONTRACT_IDENTITIES_RAW_SHA256,
      identities,
      runtimeClosureDigest: RUNTIME_CLOSURE_DIGEST,
    });
  }

  async #identityExecution(signal?: AbortSignal): Promise<CliExecutionResult> {
    return this.#executeArgv(buildPolicyArgv({ kind: "identities" }), signal);
  }

  async #compareIdentities(execution: CliExecutionResult): Promise<Readonly<Record<string, unknown>>> {
    if (!execution.envelope.ok || execution.envelope.result === undefined) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CONTRACT_IDENTITY_MISMATCH,
        "The verified CLI did not return its normative contract identity projection.",
      );
    }
    const expected = await loadContractArtifact(this.#extensionRoot);
    if (canonicalJson(execution.envelope.result) !== canonicalJson(expected)) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CONTRACT_IDENTITY_MISMATCH,
        "The verified runtime contract identities differ from the frozen normative identities.",
      );
    }
    return execution.envelope.result;
  }

  async #enforceIdentities(execution: CliExecutionResult): Promise<Readonly<Record<string, unknown>>> {
    try {
      return await this.#compareIdentities(execution);
    } catch (cause) {
      if (cause instanceof MemoryOSAdapterError
          && (cause.code === MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CONTRACT_IDENTITY_MISMATCH
            || cause.code === MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH)) {
        await this.#invalidateSnapshot();
      }
      throw cause;
    }
  }

  async #runtimeSnapshot(): Promise<VerifiedRuntimeSnapshot> {
    if (this.#snapshot !== undefined) return this.#snapshot;
    this.#snapshot = await verifyAndSnapshotRuntime(join(this.#extensionRoot, "runtime"));
    return this.#snapshot;
  }

  async #invalidateSnapshot(): Promise<void> {
    const snapshot = this.#snapshot;
    this.#snapshot = undefined;
    await snapshot?.dispose().catch(() => undefined);
  }

  async #executeArgv(argv: readonly string[], signal?: AbortSignal): Promise<CliExecutionResult> {
    assertNotCancelled(signal);
    const snapshot = await this.#runtimeSnapshot();
    try {
      const workerResult = await this.#runWorker(snapshot, argv, signal);
      return parseEnvelope(workerResult, argv);
    } catch (cause) {
      if (cause instanceof MemoryOSAdapterError
          && (cause.code === MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED
            || cause.code === MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID
            || cause.code === MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CONTRACT_IDENTITY_MISMATCH
            || cause.code === MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH)) {
        await this.#invalidateSnapshot();
      }
      throw cause;
    }
  }

  async #runWorker(
    snapshot: VerifiedRuntimeSnapshot,
    argv: readonly string[],
    signal?: AbortSignal,
  ): Promise<WorkerSuccess> {
    const workerSource = await readStableRegularFile(
      this.#workerScriptPath,
      2_097_152,
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.DISTRIBUTION_INTEGRITY_MISMATCH,
      "The packaged CLI worker",
    );
    let worker: Worker;
    try {
      worker = new Worker(workerSource.toString("utf8"), {
        argv: [],
        env: Object.freeze({}),
        eval: true,
        execArgv: [],
        stderr: true,
        stdin: false,
        stdout: true,
        workerData: Object.freeze({ argv: [...argv], mainModulePath: snapshot.mainModulePath }),
      });
    } catch (cause) {
      throw adapterError(
        MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
        "The isolated CLI worker could not be created.",
        cause,
      );
    }
    return new Promise<WorkerSuccess>((resolvePromise, rejectPromise) => {
      let settled = false;
      let messageReceived = false;
      let termination: Promise<number> | undefined;
      let outOfBandStdoutBytes = 0;
      let outOfBandStderrBytes = 0;
      let drained: Promise<readonly void[]> = Promise.resolve([]);
      const terminate = (): Promise<number> => {
        termination ??= (async () => {
          const code = await worker.terminate();
          await drained;
          return code;
        })();
        return termination;
      };
      const cleanup = (): void => signal?.removeEventListener("abort", onAbort);
      const finishFailure = async (error: MemoryOSAdapterError): Promise<void> => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          await terminate();
          rejectPromise(error);
        } catch (cause) {
          rejectPromise(adapterError(
            MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
            "The isolated CLI worker could not be terminated.",
            cause,
          ));
        }
      };
      const onAbort = (): void => {
        void finishFailure(adapterError(
          MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CANCELLED,
          "The MemoryOS operation was cancelled.",
        ));
      };
      const drain = (stream: NodeJS.ReadableStream | null, channel: "stdout" | "stderr"): Promise<void> => (
        new Promise<void>((resolveDrain) => {
          if (stream === null) {
            resolveDrain();
            queueMicrotask(() => {
              void finishFailure(adapterError(
                MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
                `Worker ${channel} capture is unavailable.`,
              ));
            });
            return;
          }
          let complete = false;
          const finishDrain = (): void => {
            if (complete) return;
            complete = true;
            resolveDrain();
          };
          stream.on("data", (chunk: Buffer | string) => {
            const bytes = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, "utf8");
            if (channel === "stdout") {
              outOfBandStdoutBytes = Math.min(STDOUT_MAX_BYTES + 1, outOfBandStdoutBytes + bytes);
            } else {
              outOfBandStderrBytes = Math.min(STDERR_MAX_BYTES + 1, outOfBandStderrBytes + bytes);
            }
            void finishFailure(adapterError(
              MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
              "The isolated CLI worker attempted out-of-band process output.",
            ));
          });
          stream.once("end", finishDrain);
          stream.once("close", finishDrain);
          stream.once("error", (cause) => {
            finishDrain();
            void finishFailure(adapterError(
              MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
              `Worker ${channel} capture failed.`,
              cause,
            ));
          });
          stream.resume();
        })
      );
      drained = Promise.all([
        drain(worker.stdout, "stdout"),
        drain(worker.stderr, "stderr"),
      ]);
      signal?.addEventListener("abort", onAbort, { once: true });
      worker.once("message", (message: unknown) => {
        if (settled || messageReceived) return;
        messageReceived = true;
        void terminate().then(() => {
          if (settled) return;
          try {
            if (outOfBandStdoutBytes !== 0 || outOfBandStderrBytes !== 0) {
              throw adapterError(
                MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
                "The isolated CLI worker attempted out-of-band process output.",
              );
            }
            const validated = validateWorkerSuccess(message);
            assertNotCancelled(signal);
            settled = true;
            cleanup();
            resolvePromise(validated);
          } catch (cause) {
            settled = true;
            cleanup();
            rejectPromise(cause);
          }
        }).catch((cause) => {
          if (settled) return;
          settled = true;
          cleanup();
          rejectPromise(adapterError(
            MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
            "The isolated CLI worker could not be terminated.",
            cause,
          ));
        });
      });
      worker.once("error", (cause) => {
        void finishFailure(adapterError(
          MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
          "The isolated CLI worker crashed.",
          cause,
        ));
      });
      worker.once("exit", (code) => {
        if (!settled && !messageReceived) {
          void finishFailure(adapterError(
            MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
            `The isolated CLI worker exited before producing a result (exit ${code}).`,
          ));
        }
      });
      if (signal?.aborted) onAbort();
    });
  }
}

export function createCliAdapter(options: CliAdapterOptions): MemoryOSCliAdapter {
  return new CliAdapter(options);
}
