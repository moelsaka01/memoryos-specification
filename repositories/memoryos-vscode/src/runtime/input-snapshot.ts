import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { MemoryOSAdapterError } from "../errors.js";
import { TRANSPORT_LIMITS, type TransportInputKind } from "./runtime-contract.js";

export const INPUT_SNAPSHOT_COPY_BUFFER_BYTES = 65_536;
const OPERATION_PREFIX = "memoryos-vscode-operation-";

const FIXED_NAMES = Object.freeze({
  baselineMip: "baseline.mip",
  candidateMip: "candidate.mip",
  evaluationIdentity: "evaluation-identity.json",
  expectedEvaluationIdentity: "expected-evaluation-identity.json",
  policy: "policy.memoryos-policy.json",
  policyOutcome: "policy-outcome.json",
  policySet: "policy-set.memoryos-policy-set.json",
});

// A valid Evaluation Identity is embedded as a proper subobject of a valid
// canonical outcome. Therefore the frozen MO-1301 outcome ceiling admits every
// supported identity and outcome verification artifact. This is a normative
// artifact-admissibility ceiling, not a fourth MO-1303 transport-limit class.
export const POLICY_VERIFICATION_ARTIFACT_MAX_BYTES = 4_060;

const FIXED_OUTPUT_NAMES = Object.freeze({
  canonicalArtifact: "canonical-artifact.json",
  evaluationIdentity: "evaluation-identity.json",
  evaluationIdentityDigest: "evaluation-identity.sha256",
  outcome: "policy-outcome.json",
  outcomeDigest: "policy-outcome.sha256",
});

const OPERATION_CAPABILITY = Symbol("MemoryOSOperationCapability");
interface CapabilityState {
  disposed: boolean;
  readonly inputs: Map<InputSnapshotRole, string>;
  readonly outputs: Map<OperationOutputRole, string>;
  readonly root: string;
}
const CAPABILITIES = new WeakMap<object, CapabilityState>();

export type InputSnapshotRole = keyof typeof FIXED_NAMES;
export type OperationOutputRole = keyof typeof FIXED_OUTPUT_NAMES;
export type InputLimitClass = TransportInputKind | "policyVerificationArtifact";

export type OperationPathBinding =
  | Readonly<{ access: "input"; role: InputSnapshotRole }>
  | Readonly<{ access: "output"; role: OperationOutputRole }>;

export interface OperationCapability {
  readonly [OPERATION_CAPABILITY]: true;
}

export interface LocalFileInput {
  readonly dirty?: boolean;
  readonly fsPath: string;
  readonly scheme: string;
  readonly untitled?: boolean;
}

export interface AcquiredInput {
  readonly byteLength: number;
  readonly path: string;
  readonly role: InputSnapshotRole;
  readonly sha256: string;
  readonly inputLimitClass: InputLimitClass;
}

export interface OperationInputSnapshot {
  readonly capability: OperationCapability;
  readonly root: string;
  acquire(
    role: InputSnapshotRole,
    input: LocalFileInput,
    signal?: AbortSignal,
  ): Promise<AcquiredInput>;
  reserveOutput(role: OperationOutputRole): string;
  dispose(): Promise<void>;
}

export function assertOperationPath(
  capability: OperationCapability,
  path: string,
  binding: OperationPathBinding,
): void {
  const state = CAPABILITIES.get(capability);
  if (state === undefined || state.disposed) {
    throw adapterError(
      "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
      "The private operation capability is invalid or closed.",
    );
  }
  const expected = binding.access === "input"
    ? state.inputs.get(binding.role)
    : state.outputs.get(binding.role);
  if (expected === undefined || expected !== resolve(path)) {
    throw adapterError(
      "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
      `The CLI ${binding.access} path is not bound to the required fixed '${binding.role}' role.`,
    );
  }
}

function adapterError(
  code:
    | "MEMORYOS_VSCODE_CANCELLED"
    | "MEMORYOS_VSCODE_INPUT_REQUIRED"
    | "MEMORYOS_VSCODE_INPUT_UNSUPPORTED"
    | "MEMORYOS_VSCODE_INPUT_LIMIT_EXCEEDED"
    | "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
  message: string,
  cause?: unknown,
): MemoryOSAdapterError {
  return new MemoryOSAdapterError(code, message, cause === undefined ? undefined : { cause });
}

function inputLimit(role: InputSnapshotRole): {
  readonly bytes: number;
  readonly description: string;
  readonly kind: InputLimitClass;
} {
  if (role === "policy" || role === "policySet") {
    return {
      bytes: TRANSPORT_LIMITS[role],
      description: `${TRANSPORT_LIMITS[role]}-byte extension transport limit`,
      kind: role,
    };
  }
  if (role === "baselineMip" || role === "candidateMip") {
    return {
      bytes: TRANSPORT_LIMITS.mip,
      description: `${TRANSPORT_LIMITS.mip}-byte extension transport limit`,
      kind: "mip",
    };
  }
  return {
    bytes: POLICY_VERIFICATION_ARTIFACT_MAX_BYTES,
    description: `${POLICY_VERIFICATION_ARTIFACT_MAX_BYTES}-byte normative Policy verification-artifact ceiling`,
    kind: "policyVerificationArtifact",
  };
}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw adapterError("MEMORYOS_VSCODE_CANCELLED", "The MemoryOS operation was cancelled.");
  }
}

function validateInput(input: LocalFileInput | null | undefined): string {
  if (input == null || typeof input.fsPath !== "string" || input.fsPath.length === 0) {
    throw adapterError("MEMORYOS_VSCODE_INPUT_REQUIRED", "A saved local file is required.");
  }
  if (input.scheme !== "file" || input.untitled === true || input.dirty === true) {
    throw adapterError(
      "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
      "Only saved, non-dirty local file: inputs are supported.",
    );
  }
  if (!isAbsolute(input.fsPath)) {
    throw adapterError("MEMORYOS_VSCODE_INPUT_UNSUPPORTED", "The local input path must be absolute.");
  }
  return resolve(input.fsPath);
}

async function copyBoundedRegularFile(
  sourcePath: string,
  destinationPath: string,
  limit: number,
  limitDescription: string,
  signal?: AbortSignal,
): Promise<{ byteLength: number; sha256: string }> {
  let before;
  try {
    before = await lstat(sourcePath, { bigint: true });
  } catch (cause) {
    throw adapterError(
      "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
      `Unable to inspect local artifact '${basename(sourcePath)}'.`,
      cause,
    );
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw adapterError(
      "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
      "The selected artifact must be a regular non-symbolic file leaf.",
    );
  }
  if (before.size < 0n || before.size > BigInt(limit)) {
    throw adapterError(
      "MEMORYOS_VSCODE_INPUT_LIMIT_EXCEEDED",
      `The selected artifact exceeds the ${limitDescription}.`,
    );
  }

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let source;
  let destination;
  try {
    source = await open(sourcePath, constants.O_RDONLY | noFollow);
    const opened = await source.stat({ bigint: true });
    if (!opened.isFile()
        || opened.size !== before.size
        || (before.ino !== 0n && opened.ino !== 0n && before.ino !== opened.ino)
        || (before.dev !== 0n && opened.dev !== 0n && before.dev !== opened.dev)
        || opened.mtimeNs !== before.mtimeNs
        || opened.ctimeNs !== before.ctimeNs) {
      throw adapterError(
        "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
        "The selected artifact changed while its private snapshot was acquired.",
      );
    }
    destination = await open(
      destinationPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o400,
    );
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(INPUT_SNAPSHOT_COPY_BUFFER_BYTES);
    let total = 0;
    while (true) {
      assertNotCancelled(signal);
      const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > limit) {
        throw adapterError(
          "MEMORYOS_VSCODE_INPUT_LIMIT_EXCEEDED",
          `The selected artifact exceeds the ${limitDescription}.`,
        );
      }
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      let offset = 0;
      while (offset < chunk.length) {
        const written = await destination.write(chunk, offset, chunk.length - offset);
        if (written.bytesWritten < 1) {
          throw adapterError(
            "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
            "Unable to finish writing the private artifact snapshot.",
          );
        }
        offset += written.bytesWritten;
      }
    }
    const after = await source.stat({ bigint: true });
    if (BigInt(total) !== before.size || after.size !== before.size
        || (before.ino !== 0n && after.ino !== 0n && before.ino !== after.ino)
        || (before.dev !== 0n && after.dev !== 0n && before.dev !== after.dev)
        || after.mtimeNs !== before.mtimeNs
        || after.ctimeNs !== before.ctimeNs) {
      throw adapterError(
        "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
        "The selected artifact changed while its private snapshot was acquired.",
      );
    }
    await destination.sync();
    assertNotCancelled(signal);
    return { byteLength: total, sha256: `sha256:${hash.digest("hex")}` };
  } catch (cause) {
    if (cause instanceof MemoryOSAdapterError) throw cause;
    throw adapterError(
      "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
      `Unable to snapshot local artifact '${basename(sourcePath)}'.`,
      cause,
    );
  } finally {
    await Promise.allSettled([source?.close(), destination?.close()]);
  }
}

function assertDisposableOperationRoot(root: string): void {
  const temporaryRoot = resolve(tmpdir());
  const relativePath = relative(temporaryRoot, root);
  if (dirname(root) !== temporaryRoot
      || !relativePath.startsWith(OPERATION_PREFIX)
      || relativePath.includes(sep)) {
    throw adapterError(
      "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
      "Refusing to remove an unrecognized private operation path.",
    );
  }
}

export async function createOperationInputSnapshot(): Promise<OperationInputSnapshot> {
  const root = await mkdtemp(join(tmpdir(), OPERATION_PREFIX));
  await chmod(root, 0o700);
  const inputsRoot = join(root, "inputs");
  const outputsRoot = join(root, "outputs");
  await mkdir(inputsRoot, { mode: 0o700 });
  await mkdir(outputsRoot, { mode: 0o700 });
  const acquired = new Set<InputSnapshotRole>();
  const pending = new Set<InputSnapshotRole>();
  let pendingIdle: Promise<void> = Promise.resolve();
  let resolvePendingIdle: (() => void) | undefined;
  let disposed = false;
  const capability = Object.freeze({ [OPERATION_CAPABILITY]: true as const });
  const capabilityState: CapabilityState = {
    disposed: false,
    inputs: new Map(),
    outputs: new Map(),
    root,
  };
  CAPABILITIES.set(capability, capabilityState);
  return Object.freeze({
    capability,
    root,
    async acquire(
      role: InputSnapshotRole,
      input: LocalFileInput,
      signal?: AbortSignal,
    ): Promise<AcquiredInput> {
      if (disposed) {
        throw adapterError("MEMORYOS_VSCODE_ARTIFACT_READ_FAILED", "The private operation state is closed.");
      }
      assertNotCancelled(signal);
      if (!Object.hasOwn(FIXED_NAMES, role) || acquired.has(role) || pending.has(role)) {
        throw adapterError(
          "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
          "Each closed input role may be acquired exactly once per operation.",
        );
      }
      // These checks are synchronous and must complete before the role becomes
      // pending. Otherwise a rejected authority could strand pendingIdle and
      // make operation disposal wait forever.
      const sourcePath = validateInput(input);
      const limit = inputLimit(role);
      const destinationPath = join(inputsRoot, FIXED_NAMES[role]);
      pending.add(role);
      if (pending.size === 1) {
        pendingIdle = new Promise<void>((resolveIdle) => { resolvePendingIdle = resolveIdle; });
      }
      try {
        const identity = await copyBoundedRegularFile(
          sourcePath,
          destinationPath,
          limit.bytes,
          limit.description,
          signal,
        );
        if (disposed) {
          throw adapterError("MEMORYOS_VSCODE_CANCELLED", "The private operation was closed during acquisition.");
        }
        await chmod(destinationPath, 0o400);
        assertNotCancelled(signal);
        if (disposed) {
          throw adapterError("MEMORYOS_VSCODE_CANCELLED", "The private operation was closed during acquisition.");
        }
        acquired.add(role);
        capabilityState.inputs.set(role, destinationPath);
        return Object.freeze({
          ...identity,
          path: destinationPath,
          role,
          inputLimitClass: limit.kind,
        });
      } catch (cause) {
        await rm(destinationPath, { force: true }).catch(() => undefined);
        throw cause;
      } finally {
        pending.delete(role);
        if (pending.size === 0) {
          resolvePendingIdle?.();
          resolvePendingIdle = undefined;
        }
      }
    },
    reserveOutput(role: OperationOutputRole): string {
      if (disposed || !Object.hasOwn(FIXED_OUTPUT_NAMES, role)) {
        throw adapterError(
          "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
          "The private output role is unsupported or the operation is closed.",
        );
      }
      const existing = capabilityState.outputs.get(role);
      if (existing !== undefined) return existing;
      const path = join(outputsRoot, FIXED_OUTPUT_NAMES[role]);
      capabilityState.outputs.set(role, path);
      return path;
    },
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      capabilityState.disposed = true;
      await pendingIdle;
      assertDisposableOperationRoot(root);
      await rm(root, { force: true, recursive: true });
    },
  });
}
