"use strict";

const {
  appendFileSync,
  closeSync,
  constants: fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { createHash } = require("node:crypto");
const { basename, dirname, join, relative, resolve, sep } = require("node:path");
const { tmpdir } = require("node:os");
const { pathToFileURL } = require("node:url");

const ACTION_REPOSITORY = "moelsaka01/memoryos-specification";
const MANIFEST_KIND = "MemoryOSGitHubPolicyGateDistributionManifest";
const MANIFEST_VERSION = "1.0.0";
const ACTION_ROOT = resolve(dirname(__dirname));
const MANIFEST_PATH = resolve(ACTION_ROOT, "distribution-manifest.json");
const REVISION_PATTERN = /^[0-9a-f]{40}$/u;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MANIFEST_PATH_PATTERN = /^(?:[a-z0-9._-]+\/)*[a-z0-9._-]+$/u;
const ROLES = new Set(["actionMetadata", "entrypoint", "runtimeModule", "contractData"]);
const SNAPSHOT_PREFIX = "memoryos-policy-gate-action-";
let lastVerifiedClosure = null;
const OUTPUT_NAMES = Object.freeze([
  "gate-class",
  "decision",
  "cli-exit-code",
  "publication-valid",
  "policy-semantic-digest",
  "evaluation-identity-digest",
  "outcome-digest",
  "policy-fact-context-digest",
  "regression-source-digest",
  "evaluation-identity-path",
  "outcome-path",
  "artifact-directory",
  "stable-code",
  "failure-class",
  "phase",
  "artifact-kind",
  "limit-identifier",
  "distribution-repository",
  "distribution-revision",
]);

function ownKeysExactly(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function parseCanonicalManifest(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("distribution manifest is not strict UTF-8");
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("distribution manifest is not valid JSON");
  }
  if (text !== canonicalJson(value)) {
    throw new Error("distribution manifest is not canonical JSON");
  }
  return value;
}

function enumerateClosure(directory, prefix = "", directorySink = []) {
  const entries = [];
  for (const dirent of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, dirent.name);
    const manifestPath = prefix.length === 0 ? dirent.name : `${prefix}/${dirent.name}`;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new Error(`distribution contains non-regular content at ${manifestPath}`);
    }
    if (stat.isDirectory()) {
      directorySink.push(manifestPath);
      entries.push(...enumerateClosure(path, manifestPath, directorySink));
    }
    else if (manifestPath !== "distribution-manifest.json") entries.push(manifestPath);
  }
  return entries.sort();
}

function assertBeneathActionRoot(path) {
  const root = `${realpathSync.native(ACTION_ROOT)}${sep}`;
  const actual = realpathSync.native(path);
  if (!actual.startsWith(root)) throw new Error("distribution path escapes the Action root");
}

function sameOpenFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function readStableDistributionFile(path) {
  const listed = lstatSync(path, { bigint: true });
  if (listed.isSymbolicLink() || !listed.isFile()) {
    throw new Error("distribution member is not a regular file");
  }
  assertBeneathActionRoot(path);
  const initialPhysical = realpathSync.native(path);
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NONBLOCK ?? 0) |
    (process.platform === "win32" ? 0 : (fsConstants.O_NOFOLLOW ?? 0));
  let handle;
  try {
    handle = openSync(path, flags);
    const before = fstatSync(handle, { bigint: true });
    if (!before.isFile() || !sameOpenFile(listed, before)) {
      throw new Error("distribution member changed before capture");
    }
    const bytes = readFileSync(handle);
    const after = fstatSync(handle, { bigint: true });
    const finalListed = lstatSync(path, { bigint: true });
    if (!sameOpenFile(before, after) || BigInt(bytes.length) !== after.size ||
        finalListed.isSymbolicLink() || !finalListed.isFile() ||
        !sameOpenFile(after, finalListed) || realpathSync.native(path) !== initialPhysical) {
      throw new Error("distribution member changed during capture");
    }
    return bytes;
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
}

function verifyDistributionManifest() {
  lastVerifiedClosure = null;
  const manifestBytes = readStableDistributionFile(MANIFEST_PATH);
  const manifest = parseCanonicalManifest(manifestBytes);
  if (!ownKeysExactly(manifest, ["kind", "version", "files"]) ||
      manifest.kind !== MANIFEST_KIND || manifest.version !== MANIFEST_VERSION ||
      !Array.isArray(manifest.files)) {
    throw new Error("distribution manifest root is invalid");
  }

  const listed = [];
  let previous = null;
  let actionMetadataCount = 0;
  let entrypointCount = 0;
  const capturedFiles = new Map();
  for (const entry of manifest.files) {
    if (!ownKeysExactly(entry, ["path", "rawSha256", "byteCount", "role"]) ||
        typeof entry.path !== "string" || entry.path.length > 4096 ||
        !MANIFEST_PATH_PATTERN.test(entry.path) ||
        !HASH_PATTERN.test(entry.rawSha256) ||
        !Number.isSafeInteger(entry.byteCount) || entry.byteCount < 1 ||
        !ROLES.has(entry.role)) {
      throw new Error("distribution manifest file entry is invalid");
    }
    if (previous !== null && previous >= entry.path) {
      throw new Error("distribution manifest paths are not uniquely ASCII ordered");
    }
    previous = entry.path;
    if (entry.role === "actionMetadata") actionMetadataCount += 1;
    if (entry.role === "entrypoint") entrypointCount += 1;
    if ((entry.role === "actionMetadata") !== (entry.path === "action.yml") ||
        (entry.role === "entrypoint") !== (entry.path === "dist/index.js")) {
      throw new Error("distribution manifest distinguished role is invalid");
    }
    const path = resolve(ACTION_ROOT, ...entry.path.split("/"));
    const lexical = relative(ACTION_ROOT, path);
    if (lexical.startsWith("..") || resolve(path) === ACTION_ROOT) {
      throw new Error("distribution manifest path escapes the Action root");
    }
    const bytes = readStableDistributionFile(path);
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (bytes.length !== entry.byteCount || digest !== entry.rawSha256) {
      throw new Error(`distribution member does not match the manifest: ${entry.path}`);
    }
    capturedFiles.set(entry.path, Buffer.from(bytes));
    listed.push(entry.path);
  }
  if (actionMetadataCount !== 1 || entrypointCount !== 1) {
    throw new Error("distribution manifest distinguished member count is invalid");
  }
  const actualDirectories = [];
  const actual = enumerateClosure(ACTION_ROOT, "", actualDirectories);
  if (canonicalJson(actual) !== canonicalJson(listed)) {
    throw new Error("distribution closure differs from the manifest");
  }
  const permittedDirectories = new Set();
  for (const path of listed) {
    const segments = path.split("/");
    for (let count = 1; count < segments.length; count += 1) {
      permittedDirectories.add(segments.slice(0, count).join("/"));
    }
  }
  if (canonicalJson(actualDirectories.sort()) !== canonicalJson([...permittedDirectories].sort())) {
    throw new Error("distribution contains a directory outside the manifest ancestry");
  }
  lastVerifiedClosure = Object.freeze({
    files: capturedFiles,
    manifestBytes: Buffer.from(manifestBytes),
  });
  return manifest;
}

function createVerifiedDistributionSnapshot() {
  if (lastVerifiedClosure === null) throw new Error("distribution closure was not verified");
  const parent = realpathSync.native(tmpdir());
  const lexicalRoot = mkdtempSync(join(parent, SNAPSHOT_PREFIX));
  const root = realpathSync.native(lexicalRoot);
  if (dirname(root) !== parent || !basename(root).startsWith(SNAPSHOT_PREFIX)) {
    throw new Error("verified distribution snapshot escaped its trusted parent");
  }
  try {
    for (const [manifestPath, bytes] of lastVerifiedClosure.files) {
      const target = resolve(root, ...manifestPath.split("/"));
      mkdirSync(dirname(target), { mode: 0o700, recursive: true });
      writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
    }
    writeFileSync(resolve(root, "distribution-manifest.json"), lastVerifiedClosure.manifestBytes, {
      flag: "wx",
      mode: 0o600,
    });
    return Object.freeze({
      manifestRawSha256: `sha256:${createHash("sha256")
        .update(lastVerifiedClosure.manifestBytes).digest("hex")}`,
      parent,
      root,
    });
  } catch (error) {
    rmSync(root, { force: true, recursive: true });
    throw error;
  } finally {
    lastVerifiedClosure = null;
  }
}

function removeVerifiedDistributionSnapshot(snapshot) {
  if (snapshot === null || typeof snapshot !== "object" ||
      dirname(snapshot.root) !== snapshot.parent ||
      !basename(snapshot.root).startsWith(SNAPSHOT_PREFIX)) {
    throw new Error("refusing to remove an unexpected distribution snapshot");
  }
  rmSync(snapshot.root, { force: true, recursive: true });
}

function verifyRuntimeContext(context = {}) {
  const serverUrl = context.serverUrl ?? process.env.GITHUB_SERVER_URL;
  const repository = context.repository ?? process.env.GITHUB_ACTION_REPOSITORY;
  const revision = context.revision ?? process.env.GITHUB_ACTION_REF;
  const nodeMajor = context.nodeMajor ?? Number(process.versions.node.split(".")[0]);
  if (serverUrl !== "https://github.com" || repository !== ACTION_REPOSITORY ||
      typeof revision !== "string" || !REVISION_PATTERN.test(revision) || nodeMajor !== 24) {
    throw new Error("GitHub Action runtime context is inconsistent with interface 1.0");
  }
  return Object.freeze({ repository, revision });
}

function emptyOutputs() {
  return Object.fromEntries(OUTPUT_NAMES.map((name) => [name, ""]));
}

function validateOutputValue(value) {
  if (typeof value !== "string" || /[\r\n\0]/u.test(value) ||
      (value.length > 0 && value !== value.trim())) {
    throw new Error("Action output value is not a safe scalar");
  }
}

function writeOutputs(values, outputPath = process.env.GITHUB_OUTPUT) {
  if (typeof outputPath !== "string" || outputPath.length === 0) {
    throw new Error("GITHUB_OUTPUT is unavailable");
  }
  if (!ownKeysExactly(values, OUTPUT_NAMES)) throw new Error("Action output set is not closed");
  let record = "";
  for (const name of OUTPUT_NAMES) {
    validateOutputValue(values[name]);
    record += `${name}=${values[name]}\n`;
  }
  appendFileSync(outputPath, record, { encoding: "utf8" });
}

function distributionFailureOutputs() {
  return {
    ...emptyOutputs(),
    "gate-class": "tool-failure",
    "publication-valid": "false",
    "stable-code": "MEMORYOS_CI_DISTRIBUTION_UNTRUSTED",
    "failure-class": "automation",
    phase: "distribution",
  };
}

function internalFailureResult(distribution) {
  return Object.freeze({
    jobSuccess: false,
    outputs: Object.freeze({
      ...emptyOutputs(),
      "gate-class": "tool-failure",
      "publication-valid": "false",
      "stable-code": "MEMORYOS_CI_INTERNAL_FAILURE",
      "failure-class": "automation",
      phase: "internal",
      "distribution-repository": distribution.repository,
      "distribution-revision": distribution.revision,
    }),
  });
}

async function start() {
  let distribution;
  let snapshot;
  try {
    distribution = verifyRuntimeContext();
    verifyDistributionManifest();
    snapshot = createVerifiedDistributionSnapshot();
  } catch {
    if (snapshot !== undefined) {
      try { removeVerifiedDistributionSnapshot(snapshot); } catch { /* fixed failure below */ }
    }
    try { writeOutputs(distributionFailureOutputs()); } catch { /* fixed diagnostic below */ }
    process.stderr.write("MemoryOS Policy Gate failed distribution verification.\n");
    process.exitCode = 1;
    return;
  }

  let result;
  let internalDiagnostic = false;
  try {
    const runtimeUrl = pathToFileURL(resolve(snapshot.root, "dist/action-runtime.mjs")).href;
    const runtime = await import(runtimeUrl);
    result = await runtime.runAction({
      actionRoot: snapshot.root,
      distribution,
      distributionManifestRawSha256: snapshot.manifestRawSha256,
      outputNames: OUTPUT_NAMES,
    });
  } catch {
    result = internalFailureResult(distribution);
    internalDiagnostic = true;
  }
  try {
    removeVerifiedDistributionSnapshot(snapshot);
  } catch {
    if (result.outputs["failure-class"] === "") result = internalFailureResult(distribution);
    internalDiagnostic = true;
  }
  try {
    writeOutputs(result.outputs);
  } catch {
    internalDiagnostic = true;
    result = internalFailureResult(distribution);
  }
  if (internalDiagnostic) {
    process.stderr.write("MemoryOS Policy Gate encountered an internal failure.\n");
  }
  if (!result.jobSuccess) {
    process.exitCode = 1;
  }
}

if (require.main === module) void start();

module.exports = Object.freeze({
  ACTION_ROOT,
  OUTPUT_NAMES,
  canonicalJson,
  distributionFailureOutputs,
  emptyOutputs,
  enumerateClosure,
  parseCanonicalManifest,
  verifyDistributionManifest,
  verifyRuntimeContext,
  writeOutputs,
});
