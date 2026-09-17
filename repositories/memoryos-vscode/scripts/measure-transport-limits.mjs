import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import {
  computeMipIntegrity,
  verifyMemoryInvestigationPackage,
} from "../../cca-studio/web/js/memory-investigation-package.js";
import { canonicalize, utf8Encode } from "../../cca-studio/web/js/mip-canonical.js";
import {
  prepareInvestigationPolicy,
  prepareInvestigationPolicySet,
} from "../../cca-studio/web/js/investigation-policy.js";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const WORKSPACE_ROOT = resolve(EXTENSION_ROOT, "..", "..");
const MEASUREMENT_ROOT = resolve(EXTENSION_ROOT, "measurements");
const CORPUS_PATH = resolve(MEASUREMENT_ROOT, "transport-corpus-inventory-1.0.0.json");
const RESULTS_PATH = resolve(MEASUREMENT_ROOT, "transport-measurement-results-1.0.0.json");
const RECEIPT_PATH = resolve(MEASUREMENT_ROOT, "transport-limit-selection-receipt-1.0.0.json");
const HOST_OBSERVATION_PATH = resolve(MEASUREMENT_ROOT, "transport-host-observation-1.0.0.json");

const SDK_MIP_MAX_BYTES = 16_777_216;
const STDOUT_MAX_BYTES = 1_048_576;
const STDERR_MAX_BYTES = 1_048_576;
const SNAPSHOT_COPY_BUFFER_BYTES = 65_536;
const POLICY_LIMIT = 2_048;
const POLICY_SET_LIMIT = 4_096;
const MIP_CANDIDATES = Object.freeze([524_288, 1_048_576, 2_097_152, 4_194_304, SDK_MIP_MAX_BYTES]);

const SOURCES = Object.freeze([
  ["policy", "releasedValid", "repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0/hosted/pass.memoryos-policy.json", "raw"],
  ["policy", "releasedValid", "repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0/hosted/fail.memoryos-policy.json", "raw"],
  ["policy", "releasedValid", "repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0/hosted/cne.memoryos-policy.json", "raw"],
  ["policy", "normativeExactValid", "repositories/cca-studio/tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0011-b04-exact-candidate.json", "raw"],
  ["policy", "normativeFirstAboveHostile", "repositories/cca-studio/tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0012-b04-first-reachable-above.json", "raw"],
  ["policySet", "normativeExactValid", "repositories/cca-studio/tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0031-b11-exact-candidate.json", "raw"],
  ["policySet", "normativeFirstAboveHostile", "repositories/cca-studio/tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0032-b11-first-reachable-above.json", "raw"],
  ["mip", "releasedValid", "repositories/cca-studio/examples/ai-runtime-adapters/reference-packages/anthropic-reference.mip", "raw"],
  ["mip", "releasedValid", "repositories/cca-studio/examples/ai-runtime-adapters/reference-packages/langgraph-reference.mip", "raw"],
  ["mip", "releasedValid", "repositories/cca-studio/examples/ai-runtime-adapters/reference-packages/openai-agents-reference.mip", "raw"],
  ["mip", "releasedValid", "repositories/cca-studio/tests/fixtures/mip/complete-investigation.mip.b64", "base64"],
  ["mip", "releasedValid", "repositories/cca-studio/tests/fixtures/mip/minimal-observation.mip.b64", "base64"],
  ["mip", "releasedValid", "repositories/cca-studio/tests/fixtures/mip/noncritical-extension.mip.b64", "base64"],
  ["mip", "malformedHostile", "repositories/cca-studio/tests/fixtures/mip/memory-investigation-package-1.0.schema.json.b64", "base64"],
]);

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort(compareAscii).map((name) => (
      `${JSON.stringify(name)}:${canonicalJson(value[name])}`
    )).join(",")}}`;
  }
  if (typeof value === "number" && (!Number.isSafeInteger(value) || Object.is(value, -0))) {
    throw new TypeError("Measurement integers must be safe integers and not negative zero.");
  }
  if (!["string", "number", "boolean"].includes(typeof value)) {
    throw new TypeError("Measurement data contains a non-JSON value.");
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function workspacePath(relativePath) {
  return resolve(WORKSPACE_ROOT, ...relativePath.split("/"));
}

async function corpusEntry([inputClass, classification, path, encoding]) {
  const status = await lstat(workspacePath(path));
  if (status.isSymbolicLink() || !status.isFile()) throw new Error(`Corpus member '${path}' is not a regular file.`);
  const sourceBytes = await readFile(workspacePath(path));
  const measuredBytes = encoding === "base64"
    ? Buffer.from(sourceBytes.toString("ascii").replace(/\s+/gu, ""), "base64")
    : sourceBytes;
  let valid;
  let primaryCode = null;
  try {
    if (inputClass === "policy") prepareInvestigationPolicy(measuredBytes);
    else if (inputClass === "policySet") prepareInvestigationPolicySet(measuredBytes);
    else {
      const verification = verifyMemoryInvestigationPackage(measuredBytes);
      valid = verification.valid;
      primaryCode = verification.diagnostics[0]?.code ?? null;
    }
    if (inputClass !== "mip") valid = true;
  } catch (error) {
    valid = false;
    primaryCode = error?.code ?? "THREW";
  }
  const expectedValid = classification === "releasedValid" || classification === "normativeExactValid";
  if (valid !== expectedValid) {
    throw new Error(`Corpus member '${path}' validity ${valid} does not match classification '${classification}'.`);
  }
  return {
    classification,
    decodedByteLength: measuredBytes.length,
    decodedSha256: sha256(measuredBytes),
    encoding,
    inputClass,
    path,
    primaryCode,
    sourceByteLength: sourceBytes.length,
    sourceSha256: sha256(sourceBytes),
    valid,
  };
}

async function constructMipAtByteLength(targetByteLength) {
  const encoded = await readFile(workspacePath(
    "repositories/cca-studio/tests/fixtures/mip/minimal-observation.mip.b64",
  ), "ascii");
  const originalBytes = Buffer.from(encoded.replace(/\s+/gu, ""), "base64");
  const original = JSON.parse(originalBytes.toString("utf8"));
  const render = (paddingLength) => {
    const value = structuredClone(original);
    value.extensions["org.memoryos.measurement.padding"] = {
      critical: false,
      payload: { padding: "a".repeat(paddingLength) },
      version: "1.0.0",
    };
    value.manifest.features.optional = [
      ...value.manifest.features.optional,
      "org.memoryos.measurement.padding",
    ].sort(compareAscii);
    value.integrity = computeMipIntegrity(value);
    return utf8Encode(canonicalize(value));
  };
  const empty = render(0);
  const paddingLength = targetByteLength - empty.byteLength;
  if (paddingLength < 0) throw new Error("The requested MIP boundary is below the valid construction base.");
  const bytes = render(paddingLength);
  if (bytes.byteLength !== targetByteLength) {
    throw new Error(`Unable to construct exact ${targetByteLength}-byte valid MIP boundary.`);
  }
  return bytes;
}

async function measureMipCandidate(targetByteLength) {
  const started = process.hrtime.bigint();
  const maxRssBeforeKiB = process.resourceUsage().maxRSS;
  const bytes = await constructMipAtByteLength(targetByteLength);
  let status;
  let primaryCode = null;
  let rawHostError = null;
  try {
    const verification = verifyMemoryInvestigationPackage(bytes);
    status = verification.valid ? "verified" : "rejected";
    primaryCode = verification.diagnostics[0]?.code ?? null;
  } catch (error) {
    status = "hostFailure";
    primaryCode = "HOST_IMMUTABLE_BYTE_MATERIALIZATION_FAILED";
    rawHostError = `${error?.name ?? "Error"}:${error?.message ?? String(error)}`;
  }
  const elapsedMicroseconds = Number((process.hrtime.bigint() - started + 500n) / 1_000n);
  const maxRssAfterKiB = process.resourceUsage().maxRSS;
  return {
    construction: {
      byteLength: bytes.byteLength,
      construction: "canonical MIP with recomputed section/cognition/package integrity and one optional noncritical padding extension",
      sha256: sha256(bytes),
    },
    observation: {
      byteLength: bytes.byteLength,
      elapsedMicroseconds,
      maxRssAfterKiB,
      maxRssBeforeKiB,
      primaryCode,
      rawHostError,
      status,
    },
  };
}

async function writeSizedProbe(path, byteLength) {
  const handle = await open(path, "wx", 0o600);
  try {
    const buffer = Buffer.alloc(Math.min(SNAPSHOT_COPY_BUFFER_BYTES, byteLength), 0x61);
    let total = 0;
    while (total < byteLength) {
      const length = Math.min(buffer.length, byteLength - total);
      const { bytesWritten } = await handle.write(buffer, 0, length, total);
      if (bytesWritten < 1) throw new Error("Unable to write a transport measurement probe.");
      total += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function snapshotAcquisitionProbe(root, inputClass, byteLength) {
  const sourcePath = join(root, `${inputClass}-source.bin`);
  const snapshotPath = join(root, `${inputClass}-snapshot.bin`);
  await writeSizedProbe(sourcePath, byteLength);
  const sourceMetadata = await lstat(sourcePath);
  if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink()
      || sourceMetadata.size !== byteLength) {
    throw new Error(`The ${inputClass} snapshot probe failed its metadata gate.`);
  }
  const rssBeforeBytes = process.memoryUsage().rss;
  const source = await open(sourcePath, "r");
  const destination = await open(snapshotPath, "wx", 0o600);
  const buffer = Buffer.allocUnsafe(SNAPSHOT_COPY_BUFFER_BYTES);
  let copiedByteLength = 0;
  try {
    while (true) {
      const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      let offset = 0;
      while (offset < bytesRead) {
        const { bytesWritten } = await destination.write(
          buffer,
          offset,
          bytesRead - offset,
        );
        if (bytesWritten < 1) throw new Error("Unable to finish a snapshot measurement copy.");
        offset += bytesWritten;
      }
      copiedByteLength += bytesRead;
    }
    await destination.sync();
  } finally {
    await Promise.allSettled([source.close(), destination.close()]);
  }
  if (copiedByteLength !== byteLength || (await lstat(snapshotPath)).size !== byteLength) {
    throw new Error(`The ${inputClass} snapshot probe was incomplete.`);
  }
  const rssAfterBytes = process.memoryUsage().rss;
  return {
    byteLength,
    copiedByteLength,
    fixedCopyBufferBytes: SNAPSHOT_COPY_BUFFER_BYTES,
    inputClass,
    rssAfterBytes,
    rssBeforeBytes,
    rssDeltaBytes: rssAfterBytes - rssBeforeBytes,
    sourcePreflightSizeGate: true,
  };
}

async function workerPathTransportProbe(inputClass, privatePath, byteLength) {
  const argvSelector = inputClass === "policy"
    ? ["--policy", privatePath]
    : inputClass === "policySet"
      ? ["--policy-set", privatePath]
      : ["--package", privatePath];
  const request = {
    argv: ["policy", inputClass === "mip" ? "evaluate" : "digest", ...argvSelector, "--json"],
    mainModulePath: join(privatePath, "..", "verified-runtime-main.js"),
  };
  const observation = await new Promise((resolvePromise, rejectPromise) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require("node:worker_threads");
      const encoded = Buffer.from(JSON.stringify(workerData), "utf8");
      parentPort.postMessage({
        artifactBytesReceived: Object.values(workerData).some((value) => Buffer.isBuffer(value)),
        argvContainsPrivatePath: workerData.argv.includes(${JSON.stringify(privatePath)}),
        requestByteLength: encoded.byteLength,
      });
      parentPort.close();
    `, {
      env: Object.freeze({}),
      eval: true,
      execArgv: [],
      workerData: request,
    });
    worker.once("message", resolvePromise);
    worker.once("error", rejectPromise);
    worker.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(`Worker transport probe exited ${code}.`));
    });
  });
  if (observation.artifactBytesReceived || !observation.argvContainsPrivatePath
      || observation.requestByteLength > 65_536) {
    throw new Error(`The ${inputClass} worker path-transport probe failed.`);
  }
  return { byteLength, inputClass, ...observation };
}

async function measureAdapterTransportHost(limits) {
  const root = await mkdtemp(join(tmpdir(), "memoryos-vscode-transport-measurement-"));
  try {
    const entries = [
      ["policy", limits.policy],
      ["policySet", limits.policySet],
      ["mip", limits.mip],
    ];
    const snapshots = [];
    const workers = [];
    for (const [inputClass, byteLength] of entries) {
      snapshots.push(await snapshotAcquisitionProbe(root, inputClass, byteLength));
      workers.push(await workerPathTransportProbe(
        inputClass,
        join(root, `${inputClass}-snapshot.bin`),
        byteLength,
      ));
    }
    return { snapshots, workers };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

async function main() {
  if (process.argv.length !== 2) throw new Error("measure-transport-limits does not accept arguments.");
  await mkdir(MEASUREMENT_ROOT, { recursive: true });
  const entries = [];
  for (const source of SOURCES) entries.push(await corpusEntry(source));

  const candidateMeasurements = [];
  const candidateTelemetry = [];
  for (const candidate of MIP_CANDIDATES) {
    const measurement = await measureMipCandidate(candidate);
    candidateMeasurements.push(measurement.construction);
    candidateTelemetry.push(measurement.observation);
  }
  const mipFirstAbove = verifyMemoryInvestigationPackage(
    new Uint8Array(SDK_MIP_MAX_BYTES + 1),
  );
  if (mipFirstAbove.valid || mipFirstAbove.diagnostics[0]?.code !== "RESOURCE_LIMIT_EXCEEDED") {
    throw new Error("The MIP first-byte-above authoritative boundary did not fail at the resource gate.");
  }
  for (const candidate of candidateMeasurements) {
    entries.push({
      classification: "generatedBoundaryConstruction",
      decodedByteLength: candidate.byteLength,
      decodedSha256: candidate.sha256,
      encoding: "generatedNotRetained",
      inputClass: "mip",
      path: null,
      primaryCode: null,
      sourceByteLength: candidate.byteLength,
      sourceSha256: candidate.sha256,
      valid: null,
    });
  }
  entries.push({
      classification: "authoritativeFirstAboveHostile",
      decodedByteLength: SDK_MIP_MAX_BYTES + 1,
      decodedSha256: sha256(new Uint8Array(SDK_MIP_MAX_BYTES + 1)),
      encoding: "generatedNotRetained",
      inputClass: "mip",
      path: null,
      primaryCode: "RESOURCE_LIMIT_EXCEEDED",
      sourceByteLength: SDK_MIP_MAX_BYTES + 1,
      sourceSha256: sha256(new Uint8Array(SDK_MIP_MAX_BYTES + 1)),
      valid: false,
    });

  const releasedMaximumMip = Math.max(
    ...entries
      .filter(({ classification, inputClass, valid }) => (
        inputClass === "mip" && valid && classification === "releasedValid"
      ))
      .map(({ decodedByteLength }) => decodedByteLength),
  );
  const minimumHeadroomTarget = releasedMaximumMip * 16;
  const selectedMipMeasurement = candidateMeasurements.find(({ byteLength }) => (
    byteLength >= minimumHeadroomTarget
  ));
  if (selectedMipMeasurement === undefined) {
    throw new Error("No constructed MIP power-of-two candidate provides sixteen-times released-corpus headroom.");
  }
  const limits = Object.freeze({
    mip: selectedMipMeasurement.byteLength,
    policy: POLICY_LIMIT,
    policySet: POLICY_SET_LIMIT,
  });
  if (candidateTelemetry.find(({ byteLength }) => byteLength === limits.mip)?.status !== "verified") {
    throw new Error("The selected MIP transport boundary was not operational on the measurement host.");
  }
  const adapterTransportObservation = await measureAdapterTransportHost(limits);

  const corpus = {
    entries,
    kind: "MemoryOSVSCodeTransportMeasurementCorpus",
    sourceRoots: [
      "repositories/cca-conformance/tests/fixtures",
      "repositories/cca-studio/examples",
      "repositories/cca-studio/tests/fixtures",
    ],
    version: "1.0.0",
  };
  const byClass = (inputClass) => entries.filter((entry) => entry.inputClass === inputClass);
  const maximumValid = (inputClass) => Math.max(
    ...byClass(inputClass).filter(({ valid }) => valid).map(({ decodedByteLength }) => decodedByteLength),
  );
  const results = {
    authoritativeBoundaries: {
      mip: SDK_MIP_MAX_BYTES,
      policy: 1_024,
      policySet: 2_048,
    },
    corpus: {
      entryCount: entries.length,
      inventorySha256: sha256(Buffer.from(canonicalJson(entries), "utf8")),
      maximumReleasedRepresentativeValidBytes: {
        mip: releasedMaximumMip,
        policy: maximumValid("policy"),
        policySet: maximumValid("policySet"),
      },
    },
    extensionHostSnapshotAcquisition: {
      allocationModel: "one fixed copy buffer; source bytes are never materialized as one extension-host buffer",
      beforeReadStatGate: true,
      fixedCopyBufferBytes: SNAPSHOT_COPY_BUFFER_BYTES,
      sameFileVerifyUseSnapshot: true,
    },
    integerRepresentation: {
      allLimitsSafeIntegers: Object.values(limits).every(Number.isSafeInteger),
      maximumJavaScriptSafeInteger: Number.MAX_SAFE_INTEGER,
    },
    jsonOutput: {
      evaluationOutcomeCanonicalBytesNormativeMaximum: 4_060,
      note: "The normative outcome limit is not an extension input transport limit.",
      stderrMaximumBytes: STDERR_MAX_BYTES,
      stdoutMaximumBytes: STDOUT_MAX_BYTES,
    },
    kind: "MemoryOSVSCodeTransportMeasurementResults",
    malformedAndHostileCases: entries.filter(({ valid }) => valid === false).length,
    version: "1.0.0",
    mipBoundaryConstructions: candidateMeasurements.map((candidate) => ({
      ...candidate,
      selectedExtensionBoundary: candidate.byteLength === limits.mip,
      measurementOnlyStressCandidate: candidate.byteLength > limits.mip,
      requiredHostStatus: candidate.byteLength === limits.mip ? "verified" : "observationOnly",
    })),
    workerTransport: {
      artifactBytesClonedThroughWorkerMessages: false,
      mechanism: "absolute private-snapshot paths only",
      operationConcurrency: 1,
      workerLifetime: "one fresh worker per CLI invocation",
    },
  };
  const receipt = {
    finalLimits: limits,
    headroom: {
      mip: {
        absoluteBytesAboveReleasedMaximum: limits.mip - releasedMaximumMip,
        factorAboveReleasedMaximumFloor: Math.floor(limits.mip / releasedMaximumMip),
      },
      policy: { absoluteBytesAboveNormativeMaximum: limits.policy - 1_024, factor: 2 },
      policySet: { absoluteBytesAboveNormativeMaximum: limits.policySet - 2_048, factor: 2 },
    },
    kind: "MemoryOSVSCodeTransportLimitSelectionReceipt",
    methodology: [
      "Measure released and representative valid corpus members.",
      "Exercise the authoritative exact and first-byte-above boundaries.",
      "For Policy and Set, choose twice the operational normative raw maximum.",
      "For MIP, test power-of-two operational candidates and select the smallest verified candidate at least sixteen times the released valid maximum.",
      "Apply the gate from file metadata before streaming reads and recheck during copying.",
      "Keep artifact bytes out of worker messages and isolate semantic allocation in a fresh worker.",
      "Verify below, exact, and first-byte-above extension boundaries independently.",
    ],
    normativeResourceProfileChanged: false,
    rationale: {
      mip: "The retained reference-host observation reports that the configured SDK 16 MiB ceiling fails immutable byte materialization. The selected power of two admits the complete released/representative corpus with at least sixteen-times headroom. Integrity-valid 1-4 MiB padding constructions are measurement-only stress probes outside the v1 extension support boundary.",
      policy: "Two-times the normative 1 KiB raw Policy ceiling admits every valid Policy plus deterministic transport headroom without conflating the extension gate with MO-1301.",
      policySet: "Two-times the normative 2 KiB raw Policy Set ceiling admits every valid Set plus deterministic transport headroom without conflating the extension gate with MO-1301.",
    },
    resultsSha256: sha256(Buffer.from(canonicalJson(results), "utf8")),
    selectionRule: "Policy/Set: 2 * normative raw maximum; MIP: smallest tested operational power of two >= 16 * released valid maximum",
    version: "1.0.0",
  };
  const hostObservation = {
    adapterTransport: adapterTransportObservation,
    architecture: process.arch,
    candidates: candidateTelemetry.map((candidate) => ({
      ...candidate,
      extensionSupported: candidate.byteLength <= limits.mip,
      measurementOnlyStressCandidate: candidate.byteLength > limits.mip,
    })),
    kind: "MemoryOSVSCodeTransportHostObservation",
    nodeVersion: process.version,
    note: "Elapsed time, process maxRSS, snapshot RSS deltas, and worker request sizes are non-normative host observations; larger verified padding probes are measurement-only and do not enlarge the selected extension transport surface.",
    platform: process.platform,
    releasedRepresentativeMaximumValidMipBytes: releasedMaximumMip,
    selectedMipTransportLimitBytes: limits.mip,
    version: "1.0.0",
  };

  await writeFile(CORPUS_PATH, `${canonicalJson(corpus)}\n`, { mode: 0o600 });
  await writeFile(RESULTS_PATH, `${canonicalJson(results)}\n`, { mode: 0o600 });
  await writeFile(RECEIPT_PATH, `${canonicalJson(receipt)}\n`, { mode: 0o600 });
  await writeFile(HOST_OBSERVATION_PATH, `${canonicalJson(hostObservation)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({
    corpusEntries: entries.length,
    corpusInventorySha256: results.corpus.inventorySha256,
    candidateTelemetry,
    limits,
    resultsSha256: receipt.resultsSha256,
    status: "measured",
  })}\n`);
}

await main();
