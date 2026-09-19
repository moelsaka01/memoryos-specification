import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyVSIX } from "../../memoryos-vscode/scripts/verify-vsix.mjs";
import {
  SUITE_NAMES,
  validateSuiteReceipt as validateClosedSuiteReceipt,
} from "./mo1303-hosted-suite.mjs";

const TOOLS_ROOT = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(TOOLS_ROOT, "../../..");
const EXTENSION_ROOT = resolve(WORKSPACE_ROOT, "repositories/memoryos-vscode");
const CONTRACT_PATH = resolve(
  EXTENSION_ROOT,
  "contracts/policy-contract-identities-1.0.0.json",
);
const MAX_EVIDENCE_BYTES = 512 * 1024;
const MAX_HOST_RECEIPT_BYTES = 256 * 1024;
const MAX_SUITE_RECEIPT_BYTES = 64 * 1024;
const MAX_VSIX_RECEIPT_BYTES = 128 * 1024;
const MAX_VSIX_BYTES = 8 * 1024 * 1024;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const REVISION = /^[0-9a-f]{40}$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const COMMANDS = Object.freeze([
  "memoryos.showContractIdentities",
  "memoryos.preparePolicyArtifact",
  "memoryos.evaluatePolicyArtifact",
  "memoryos.verifyEvaluationIdentity",
  "memoryos.verifyPolicyOutcome",
]);
const SEMANTIC_COMMANDS = Object.freeze(COMMANDS.slice(1));
const PLATFORM = Object.freeze({
  "ubuntu-24.04": Object.freeze({
    arch: "X64",
    imageOS: "ubuntu24",
    nodePlatform: "linux",
    os: "Linux",
    runnerImage: "ubuntu-24.04",
    runnerOS: "Linux",
  }),
  "windows-2022": Object.freeze({
    arch: "X64",
    imageOS: "win22",
    nodePlatform: "win32",
    os: "Windows",
    runnerImage: "windows-2022",
    runnerOS: "Windows",
  }),
  "macos-14": Object.freeze({
    arch: "X64",
    imageOS: "macos14",
    nodePlatform: "darwin",
    os: "macOS",
    runnerImage: "macos-14-large",
    runnerOS: "macOS",
  }),
});
const COMMAND_SUITES = Object.freeze([...SUITE_NAMES]);
const HOST_SUITES = Object.freeze([
  "extensionHost",
  "installedVsix",
  "restrictedWorkspace",
  "cancellation",
  "offlineSmoke",
]);
const SUITES = Object.freeze([...COMMAND_SUITES, ...HOST_SUITES]);
const HOST_MODES = Object.freeze(["development", "restricted", "installed"]);
const ARTIFACT_FILES = Object.freeze([
  "host-results/development.json",
  "host-results/hosted-facts.json",
  "host-results/installed.json",
  "host-results/restricted.json",
  ...COMMAND_SUITES.map((name) => `host-results/suite-results/${name}.json`),
  "hosted-evidence/mo1303-hosted-evidence.json",
  "vsix/memoryos-0.1.0.identity.json",
  "vsix/memoryos-0.1.0.vsix",
].sort());

function fail(message) {
  throw new Error(`MO-1303 hosted evidence: ${message}`);
}

function invariant(condition, message) {
  if (!condition) fail(message);
}

function object(value, label) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object.`);
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(object(value, label)).sort();
  const wanted = [...expected].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} has an open or incomplete key set.`);
}

function digest(value, label) {
  invariant(typeof value === "string" && DIGEST.test(value),
    `${label} must be a SHA-256 digest.`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function domainDigest(domain, bytes) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from([0]))
    .update(bytes)
    .digest("hex")}`;
}

function canonicalArtifact(value, label) {
  invariant(typeof value === "string" && value.length <= 131072 && BASE64.test(value),
    `${label} is not bounded canonical base64.`);
  const bytes = Buffer.from(value, "base64");
  invariant(bytes.length > 0 && bytes.length <= 98304,
    `${label} decoded byte length is invalid.`);
  invariant(bytes.toString("base64") === value, `${label} is not canonical base64.`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} is not valid UTF-8.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(`${label} is not JSON.`);
  }
  invariant(canonicalJson(parsed) === text, `${label} is not canonical JSON.`);
  return Object.freeze({ bytes, parsed, text });
}

function stableCodes(value) {
  const found = new Set();
  function visit(candidate) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (candidate === null || typeof candidate !== "object") return;
    for (const [name, member] of Object.entries(candidate)) {
      if ((name === "code" || name === "decisionCode" || name === "stableCode")
          && typeof member === "string") found.add(member);
      visit(member);
    }
  }
  visit(value);
  return [...found].sort();
}

function validateVector(value, decision, label) {
  exactKeys(value, [
    "decision",
    "evaluationIdentityDigest",
    "outcomeDigest",
    "evaluationIdentityCanonicalBase64",
    "outcomeCanonicalBase64",
    "stableCodes",
  ], label);
  invariant(value.decision === decision, `${label}.decision differs.`);
  digest(value.evaluationIdentityDigest, `${label}.evaluationIdentityDigest`);
  digest(value.outcomeDigest, `${label}.outcomeDigest`);
  const identity = canonicalArtifact(
    value.evaluationIdentityCanonicalBase64,
    `${label}.evaluationIdentityCanonicalBase64`,
  );
  const outcome = canonicalArtifact(value.outcomeCanonicalBase64,
    `${label}.outcomeCanonicalBase64`);
  invariant(value.evaluationIdentityDigest === domainDigest(
    "MEMORYOS-POLICY-EVALUATION-IDENTITY-1.0",
    identity.bytes,
  ), `${label}.evaluationIdentityDigest is not bound to its canonical bytes.`);
  invariant(value.outcomeDigest === domainDigest(
    "MEMORYOS-POLICY-EVALUATION-OUTCOME-1.0",
    outcome.bytes,
  ), `${label}.outcomeDigest is not bound to its canonical bytes.`);
  const outcomeValue = object(outcome.parsed, `${label} canonical Outcome`);
  invariant(canonicalJson(outcomeValue.evaluationIdentity) === identity.text,
    `${label} canonical Outcome embeds a different Evaluation Identity.`);
  invariant(outcomeValue.evaluationIdentityDigest === value.evaluationIdentityDigest,
    `${label} canonical Outcome binds a different Evaluation Identity digest.`);
  invariant(object(outcomeValue.result, `${label} canonical Outcome result`).decision === decision,
    `${label} canonical Outcome decision differs.`);
  invariant(Array.isArray(value.stableCodes) && value.stableCodes.length <= 128,
    `${label}.stableCodes is invalid.`);
  for (const code of value.stableCodes) {
    invariant(typeof code === "string" && code.length > 0 && code.length <= 160,
      `${label}.stableCodes contains an invalid code.`);
  }
  invariant(canonicalJson(value.stableCodes) === canonicalJson(stableCodes(outcomeValue)),
    `${label}.stableCodes are not the exact sorted canonical Outcome codes.`);
}

function validateVerificationEvidence(value, passVector, label) {
  exactKeys(value, ["evaluationIdentity", "policyOutcome"], label);
  const identity = value.evaluationIdentity;
  exactKeys(identity, [
    "canonicalBase64", "evaluationIdentityDigest", "mode", "sourceFilename", "state",
    "target", "verificationScope", "virtualDocumentExactBytes",
  ], `${label}.evaluationIdentity`);
  const identityArtifact = canonicalArtifact(
    identity.canonicalBase64, `${label}.evaluationIdentity.canonicalBase64`);
  invariant(identityArtifact.text === Buffer.from(
    passVector.evaluationIdentityCanonicalBase64, "base64").toString("utf8"),
  `${label}.evaluationIdentity canonical bytes differ from the PASS generation.`);
  invariant(identity.evaluationIdentityDigest === passVector.evaluationIdentityDigest,
    `${label}.evaluationIdentity digest differs from the PASS generation.`);
  invariant(identity.mode === "evaluation" && identity.state === "Verified"
    && identity.target === "evaluationIdentity"
    && identity.verificationScope === "authoritativeReconstruction"
    && identity.sourceFilename === "verified-evaluation-identity.json"
    && identity.virtualDocumentExactBytes === true,
  `${label}.evaluationIdentity proof differs.`);

  const outcome = value.policyOutcome;
  exactKeys(outcome, [
    "canonicalBase64", "decision", "evaluationIdentityDigest", "mode", "outcomeDigest",
    "sourceFilename", "state", "target", "verificationScope", "virtualDocumentExactBytes",
  ], `${label}.policyOutcome`);
  const outcomeArtifact = canonicalArtifact(
    outcome.canonicalBase64, `${label}.policyOutcome.canonicalBase64`);
  invariant(outcomeArtifact.text === Buffer.from(
    passVector.outcomeCanonicalBase64, "base64").toString("utf8"),
  `${label}.policyOutcome canonical bytes differ from the PASS generation.`);
  invariant(outcome.decision === "PASS"
    && outcome.evaluationIdentityDigest === passVector.evaluationIdentityDigest
    && outcome.outcomeDigest === passVector.outcomeDigest
    && outcome.mode === "artifact" && outcome.state === "Verified"
    && outcome.target === "policyOutcome"
    && outcome.verificationScope === "serializedArtifact"
    && outcome.sourceFilename === "verified-policy-outcome.json"
    && outcome.virtualDocumentExactBytes === true,
  `${label}.policyOutcome proof differs.`);
}

function validatePreparation(value, label) {
  exactKeys(value, ["documentDigest", "semanticDigest"], label);
  digest(value.documentDigest, `${label}.documentDigest`);
  digest(value.semanticDigest, `${label}.semanticDigest`);
}

function validateSuiteResult(value, label, commandReceipt = false) {
  exactKeys(value, commandReceipt
    ? ["identity", "result", "receiptByteLength", "receiptSha256"]
    : ["identity", "result"], label);
  digest(value.identity, `${label}.identity`);
  invariant(value.result === "PASS", `${label} did not pass.`);
  if (commandReceipt) {
    invariant(Number.isSafeInteger(value.receiptByteLength)
      && value.receiptByteLength > 0
      && value.receiptByteLength <= MAX_SUITE_RECEIPT_BYTES,
    `${label}.receiptByteLength is invalid.`);
    digest(value.receiptSha256, `${label}.receiptSha256`);
  }
}

function validateContractIdentities(value, label) {
  exactKeys(value, [
    "canonicalBase64",
    "rawSha256",
    "contractArtifactSha256",
    "runtimeClosureDigest",
  ], label);
  const canonical = canonicalArtifact(value.canonicalBase64, `${label}.canonicalBase64`);
  digest(value.rawSha256, `${label}.rawSha256`);
  invariant(value.rawSha256 === sha256(canonical.bytes),
    `${label}.rawSha256 is not bound to canonical bytes.`);
  invariant(value.contractArtifactSha256
    === "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7",
  `${label}.contractArtifactSha256 differs.`);
  invariant(value.runtimeClosureDigest
    === "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3",
  `${label}.runtimeClosureDigest differs.`);
  return canonical;
}

export function validateHostedEvidence(value, expectations) {
  exactKeys(value, [
    "kind",
    "version",
    "platform",
    "implementationRevision",
    "vscodeVersion",
    "extension",
    "vsix",
    "runtimeClosure",
    "contractIdentityArtifact",
    "contractIdentities",
    "hostReceipts",
    "suites",
    "preparation",
    "vectors",
    "verification",
    "offline",
  ], "evidence");
  invariant(value.kind === "MemoryOSMO1303HostedEvidence", "kind differs.");
  invariant(value.version === "1.0.0", "version differs.");

  exactKeys(value.platform, ["identifier", "runnerImage", "os", "arch"], "platform");
  const expectedPlatform = PLATFORM[value.platform.identifier];
  invariant(expectedPlatform !== undefined, "platform identifier is unexpected.");
  invariant(value.platform.runnerImage === expectedPlatform.runnerImage,
    "runner image differs from the certified platform.");
  invariant(value.platform.os === expectedPlatform.os,
    "runner OS differs from the certified platform.");
  invariant(value.platform.arch === expectedPlatform.arch,
    "runner architecture is not x64.");
  if (expectations.platform !== undefined) {
    invariant(value.platform.identifier === expectations.platform,
      "platform differs from the externally expected platform.");
  }

  invariant(typeof value.implementationRevision === "string"
    && REVISION.test(value.implementationRevision), "implementation revision is malformed.");
  invariant(value.implementationRevision === expectations.revision,
    "implementation revision differs from the externally expected revision.");
  invariant(value.vscodeVersion === "1.137.0", "VS Code version differs.");

  exactKeys(value.extension, ["identifier", "version"], "extension");
  invariant(value.extension.identifier === "moelsaka01.memoryos", "extension identifier differs.");
  invariant(value.extension.version === "0.1.0", "extension version differs.");

  exactKeys(value.vsix,
    ["fileName", "byteLength", "sha256", "internalFileCount", "inventoryDigest"],
    "vsix");
  invariant(value.vsix.fileName === "memoryos-0.1.0.vsix", "VSIX filename differs.");
  invariant(Number.isSafeInteger(value.vsix.byteLength)
    && value.vsix.byteLength > 0 && value.vsix.byteLength <= MAX_VSIX_BYTES,
  "VSIX byte length is invalid.");
  invariant(value.vsix.internalFileCount === 46, "VSIX file count differs from the closed allowlist.");
  digest(value.vsix.sha256, "vsix.sha256");
  digest(value.vsix.inventoryDigest, "vsix.inventoryDigest");
  invariant(value.vsix.sha256 === expectations.vsixSha256,
    "VSIX digest differs from the externally expected digest.");

  exactKeys(value.runtimeClosure,
    ["entryCount", "inventoryDigest", "closureDigest"], "runtimeClosure");
  invariant(value.runtimeClosure.entryCount === 37, "runtime entry count differs.");
  invariant(value.runtimeClosure.inventoryDigest
    === "sha256:2aed4a65a3697345c3da71a4716565e2eb5275021db7628a09b2103c78203542",
  "runtime inventory digest differs.");
  invariant(value.runtimeClosure.closureDigest
    === "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3",
  "runtime closure digest differs.");

  exactKeys(value.contractIdentityArtifact, ["sha256"], "contractIdentityArtifact");
  invariant(value.contractIdentityArtifact.sha256
    === "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7",
  "contract identity artifact differs.");
  validateContractIdentities(value.contractIdentities, "contractIdentities");

  exactKeys(value.hostReceipts, HOST_MODES, "hostReceipts");
  for (const mode of HOST_MODES) {
    const member = value.hostReceipts[mode];
    exactKeys(member, ["byteLength", "sha256"], `hostReceipts.${mode}`);
    invariant(Number.isSafeInteger(member.byteLength)
      && member.byteLength > 0 && member.byteLength <= MAX_HOST_RECEIPT_BYTES,
    `hostReceipts.${mode}.byteLength is invalid.`);
    digest(member.sha256, `hostReceipts.${mode}.sha256`);
  }

  exactKeys(value.suites, SUITES, "suites");
  for (const name of SUITES) validateSuiteResult(
    value.suites[name], `suites.${name}`, COMMAND_SUITES.includes(name));

  exactKeys(value.preparation, ["policy", "policySet"], "preparation");
  validatePreparation(value.preparation.policy, "preparation.policy");
  validatePreparation(value.preparation.policySet, "preparation.policySet");

  exactKeys(value.vectors, ["pass", "fail", "cne"], "vectors");
  validateVector(value.vectors.pass, "PASS", "vectors.pass");
  validateVector(value.vectors.fail, "FAIL", "vectors.fail");
  validateVector(value.vectors.cne, "COULD_NOT_EVALUATE", "vectors.cne");
  validateVerificationEvidence(value.verification, value.vectors.pass, "verification");

  exactKeys(value.offline, ["networkRequired", "result"], "offline");
  invariant(value.offline.networkRequired === false && value.offline.result === "PASS",
    "offline proof differs.");
  return value;
}

function flags(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant(name?.startsWith("--") && value !== undefined,
      "arguments must be --name value pairs.");
    invariant(!result.has(name), `duplicate argument ${name}.`);
    result.set(name, value);
  }
  return result;
}

function required(options, name) {
  const value = options.get(name);
  invariant(typeof value === "string" && value.length > 0, `missing ${name}.`);
  return value;
}

async function loadCanonicalFile(path, maximumBytes, label) {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch {
    fail(`${label} is missing.`);
  }
  invariant(metadata.isFile() && !metadata.isSymbolicLink(),
    `${label} must be a regular non-symlink file.`);
  invariant(metadata.size > 0 && metadata.size <= maximumBytes,
    `${label} file size is invalid.`);
  const bytes = await readFile(path);
  invariant(bytes.byteLength === metadata.size, `${label} changed while being read.`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} is not valid UTF-8.`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail(`${label} is not JSON.`);
  }
  invariant(text === `${canonicalJson(value)}\n`,
    `${label} is not canonical JSON with exactly one trailing LF.`);
  return Object.freeze({ bytes, value });
}

async function expectedVSIX(options) {
  const digestValue = options.get("--expected-vsix-sha256");
  const identityPath = options.get("--expected-vsix-identity");
  invariant((digestValue === undefined) !== (identityPath === undefined),
    "provide exactly one of --expected-vsix-sha256 or --expected-vsix-identity.");
  if (digestValue !== undefined) {
    digest(digestValue, "external expected VSIX digest");
    return Object.freeze({ receipt: undefined, sha256: digestValue });
  }
  const loaded = await loadCanonicalFile(identityPath, MAX_VSIX_RECEIPT_BYTES,
    "external expected VSIX identity");
  const receipt = validateVSIXReceiptShape(loaded.value, "external expected VSIX identity");
  return Object.freeze({ receipt, sha256: receipt.vsix.sha256 });
}

async function expectations(options, includePlatform) {
  const revision = required(options, "--expected-revision");
  invariant(REVISION.test(revision), "external expected revision is malformed.");
  const vsix = await expectedVSIX(options);
  return Object.freeze({
    ...(includePlatform ? { platform: required(options, "--expected-platform") } : {}),
    revision,
    vsixSha256: vsix.sha256,
    vsixReceipt: vsix.receipt,
  });
}

function validateVSIXReceiptShape(receipt, label) {
  exactKeys(receipt, [
    "kind", "version", "extension", "vsix", "packageInventory", "runtimeClosure",
    "contractIdentityArtifact", "reproducibleBuild",
  ], label);
  invariant(receipt.kind === "MemoryOSVSCodeVSIXIdentityReceipt"
    && receipt.version === "1.0.0", `${label} identity differs.`);
  exactKeys(receipt.vsix, ["filename", "byteLength", "sha256"], `${label}.vsix`);
  invariant(receipt.vsix.filename === "memoryos-0.1.0.vsix", `${label} filename differs.`);
  invariant(Number.isSafeInteger(receipt.vsix.byteLength)
    && receipt.vsix.byteLength > 0 && receipt.vsix.byteLength <= MAX_VSIX_BYTES,
  `${label} byte length is invalid.`);
  digest(receipt.vsix.sha256, `${label}.vsix.sha256`);
  exactKeys(receipt.packageInventory, ["entryCount", "digest", "files"],
    `${label}.packageInventory`);
  invariant(receipt.packageInventory.entryCount === 46,
    `${label} package inventory count differs.`);
  invariant(Array.isArray(receipt.packageInventory.files)
    && receipt.packageInventory.files.length === 46,
  `${label} package member list differs.`);
  const paths = [];
  for (const [index, member] of receipt.packageInventory.files.entries()) {
    exactKeys(member, ["path", "byteLength", "sha256"],
      `${label}.packageInventory.files[${index}]`);
    invariant(typeof member.path === "string" && member.path.length > 0,
      `${label} contains an invalid member path.`);
    invariant(Number.isSafeInteger(member.byteLength) && member.byteLength >= 0,
      `${label} contains an invalid member length.`);
    digest(member.sha256, `${label} member digest`);
    paths.push(member.path);
  }
  invariant(canonicalJson(paths) === canonicalJson([...paths].sort()),
    `${label} package paths are not sorted.`);
  invariant(new Set(paths).size === paths.length, `${label} package paths are duplicated.`);
  digest(receipt.packageInventory.digest, `${label}.packageInventory.digest`);
  invariant(receipt.packageInventory.digest
    === sha256(Buffer.from(canonicalJson(receipt.packageInventory.files), "utf8")),
  `${label} package inventory digest does not reproduce.`);
  exactKeys(receipt.runtimeClosure,
    ["entryCount", "inventoryDigest", "manifestRawSha256", "runtimeClosureDigest"],
    `${label}.runtimeClosure`);
  invariant(receipt.runtimeClosure.entryCount === 37, `${label} runtime entry count differs.`);
  invariant(receipt.runtimeClosure.inventoryDigest
    === "sha256:2aed4a65a3697345c3da71a4716565e2eb5275021db7628a09b2103c78203542",
  `${label} runtime inventory differs.`);
  invariant(receipt.runtimeClosure.runtimeClosureDigest
    === "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3",
  `${label} runtime closure differs.`);
  exactKeys(receipt.contractIdentityArtifact, ["path", "byteLength", "rawSha256"],
    `${label}.contractIdentityArtifact`);
  invariant(receipt.contractIdentityArtifact.rawSha256
    === "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7",
  `${label} contract identity differs.`);
  return receipt;
}

function actualRevision() {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  invariant(REVISION.test(revision), "actual checkout revision is malformed.");
  return revision;
}

function verifiedPlatform(identifier) {
  const platform = PLATFORM[identifier];
  invariant(platform !== undefined, "expected platform is unexpected.");
  invariant(process.env.GITHUB_ACTIONS === "true", "hosted facts require GitHub Actions.");
  invariant(process.platform === platform.nodePlatform,
    "Node platform differs from the expected hosted platform.");
  invariant(process.arch === "x64", "Node architecture is not x64.");
  invariant(process.env.RUNNER_OS === platform.runnerOS,
    "RUNNER_OS differs from the expected hosted platform.");
  invariant(process.env.RUNNER_ARCH === "X64", "RUNNER_ARCH is not X64.");
  invariant(process.env.ImageOS === platform.imageOS,
    "ImageOS differs from the expected hosted runner image.");
  return Object.freeze({
    identifier,
    runnerImage: platform.runnerImage,
    os: platform.os,
    arch: platform.arch,
  });
}

function normalizePath(path) {
  const normalized = resolve(path).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function assertArrayEquals(actual, expected, label) {
  invariant(Array.isArray(actual)
    && canonicalJson(actual) === canonicalJson(expected), `${label} differs.`);
}

function validateHostContractIdentities(value, label) {
  exactKeys(value, ["canonicalText", "contractArtifactSha256", "runtimeClosureDigest"], label);
  invariant(typeof value.canonicalText === "string"
    && Buffer.byteLength(value.canonicalText, "utf8") <= 65536,
  `${label} canonical text is invalid.`);
  let parsed;
  try {
    parsed = JSON.parse(value.canonicalText);
  } catch {
    fail(`${label} canonical text is not JSON.`);
  }
  invariant(canonicalJson(parsed) === value.canonicalText,
    `${label} canonical text is not canonical JSON.`);
  invariant(value.contractArtifactSha256
    === "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7",
  `${label} artifact digest differs.`);
  invariant(value.runtimeClosureDigest
    === "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3",
  `${label} runtime closure differs.`);
  return value;
}

function vectorMap(receipt, label) {
  invariant(Array.isArray(receipt.evaluations) && receipt.evaluations.length === 3,
    `${label} does not contain exactly three vectors.`);
  const vectors = Object.fromEntries(receipt.evaluations.map((value) => [value.scenario, value]));
  invariant(Object.keys(vectors).sort().join(",") === "cne,fail,pass",
    `${label} vector inventory differs.`);
  return vectors;
}

export function validateHostAssertionCompleteness(value, mode) {
  const assertions = object(value, `${mode} assertions`);
  invariant(Object.keys(assertions).length > 0
    && Object.values(assertions).every((assertion) => assertion === true),
  `${mode} assertions are incomplete or failed.`);
  invariant(assertions.activation === true && assertions.contractIdentities === true
    && assertions.exactCommands === true && assertions.resultsView === true
    && assertions.isolatedDirectories === true && assertions.shutdownCleanup === true,
  `${mode} core host assertions are incomplete.`);
  return assertions;
}

function validateHostReceipt(receipt, mode, platformIdentifier, options = {}) {
  const expectedPlatform = PLATFORM[platformIdentifier];
  invariant(expectedPlatform !== undefined, `${mode} expected platform is invalid.`);
  exactKeys(receipt, [
    "architecture", "assertions", "cancellation", "commandIds", "contractIdentities",
    "evaluations", "extension", "kind", "mode", "offline", "platform", "preparation",
    "realInputs", "restrictedRejections", "trusted", "version", "viewRegistered",
    "verification", "vscodeVersion",
  ], `${mode} host receipt`);
  invariant(receipt.kind === "MemoryOSVSCodeHostTestReceipt"
    && receipt.version === "1.0.0" && receipt.mode === mode,
  `${mode} host receipt identity differs.`);
  invariant(receipt.vscodeVersion === "1.137.0", `${mode} VS Code version differs.`);
  invariant(receipt.platform === expectedPlatform.nodePlatform
    && receipt.architecture === "x64",
  `${mode} host receipt platform differs from the certified platform.`);
  invariant(expectedPlatform.arch === "X64",
    `${mode} host architecture is not x64.`);
  assertArrayEquals(receipt.commandIds, COMMANDS, `${mode} command inventory`);
  invariant(receipt.viewRegistered === true, `${mode} Results view was not registered.`);
  exactKeys(receipt.extension, ["id", "path", "version"], `${mode} extension`);
  invariant(receipt.extension.id === "moelsaka01.memoryos"
    && receipt.extension.version === "0.1.0", `${mode} extension identity differs.`);
  invariant(typeof receipt.extension.path === "string"
    && receipt.extension.path.length > 0 && receipt.extension.path.length <= 4096
    && !/[\0\r\n]/u.test(receipt.extension.path),
  `${mode} extension path is invalid.`);
  invariant(expectedPlatform.nodePlatform === "win32"
    ? /^[A-Za-z]:[\\/]/u.test(receipt.extension.path)
    : receipt.extension.path.startsWith("/"),
  `${mode} extension path is not absolute for the certified platform.`);
  exactKeys(receipt.offline, ["networkRequired", "result"], `${mode} offline proof`);
  invariant(receipt.offline.networkRequired === false && receipt.offline.result === "PASS",
    `${mode} offline proof differs.`);
  const assertions = validateHostAssertionCompleteness(receipt.assertions, mode);
  if (mode === "development") {
    invariant(receipt.trusted === true && assertions.developmentSource === true,
      "development host did not prove source execution.");
    if (options.requireLocalSource === true) {
      invariant(normalizePath(receipt.extension.path) === normalizePath(EXTENSION_ROOT),
        "development host extension path differs from the source package.");
    }
  } else {
    invariant(assertions.installedFromVsix === true,
      `${mode} host did not prove installed-VSIX execution.`);
    invariant(normalizePath(receipt.extension.path) !== normalizePath(EXTENSION_ROOT)
      && /(?:^|[\\/])extensions(?:[\\/]|$)/u.test(receipt.extension.path),
    `${mode} extension path is not isolated installed content.`);
  }
  validateHostContractIdentities(receipt.contractIdentities, `${mode} contract identities`);
  if (mode === "restricted") {
    invariant(receipt.trusted === false, "restricted host unexpectedly trusted its workspace.");
    invariant(assertions.restrictedPrecondition === true
      && assertions.restrictedRejections === true,
    "restricted host assertions are incomplete.");
    assertArrayEquals(receipt.restrictedRejections, SEMANTIC_COMMANDS,
      "restricted command rejections");
    invariant(receipt.cancellation === null && receipt.preparation === null
      && receipt.realInputs === null && receipt.verification === null
      && Array.isArray(receipt.evaluations)
      && receipt.evaluations.length === 0,
    "restricted host crossed semantic authority.");
  } else {
    invariant(receipt.trusted === true && assertions.cancellation === true
      && assertions.realEditorInputs === true && assertions.semanticDecisions === true
      && assertions.verificationCommands === true
      && assertions.verificationVirtualDocuments === true
      && assertions.virtualDocuments === true,
    `${mode} trusted host assertions are incomplete.`);
    exactKeys(receipt.cancellation,
      ["cancelled", "incompleteGenerationDiscarded", "recovery"],
      `${mode} cancellation`);
    invariant(Object.values(receipt.cancellation).every((value) => value === true),
      `${mode} cancellation proof failed.`);
    exactKeys(receipt.realInputs,
      ["dirtyRejected", "nonFileRejected", "symlinkOrReparseRejected", "untitledRejected"],
      `${mode} real inputs`);
    invariant(Object.values(receipt.realInputs).every((value) => value === true),
      `${mode} real input proof failed.`);
    exactKeys(receipt.preparation, ["policy", "policySet"], `${mode} preparation`);
    validatePreparation(receipt.preparation.policy, `${mode} preparation.policy`);
    validatePreparation(receipt.preparation.policySet, `${mode} preparation.policySet`);
    const vectors = vectorMap(receipt, mode);
    for (const [scenario, decision] of [
      ["pass", "PASS"], ["fail", "FAIL"], ["cne", "COULD_NOT_EVALUATE"],
    ]) invariant(vectors[scenario].decision === decision,
      `${mode} ${scenario} decision differs.`);
    const pass = vectors.pass;
    const verification = object(receipt.verification, `${mode} verification`);
    exactKeys(verification, ["evaluationIdentity", "policyOutcome"], `${mode} verification`);
    const identity = verification.evaluationIdentity;
    exactKeys(identity, [
      "canonicalText", "evaluationIdentityDigest", "mode", "sourceFilename", "state",
      "target", "verificationScope", "virtualDocumentExactBytes",
    ], `${mode} verification.evaluationIdentity`);
    const outcome = verification.policyOutcome;
    exactKeys(outcome, [
      "canonicalText", "decision", "evaluationIdentityDigest", "mode", "outcomeDigest",
      "sourceFilename", "state", "target", "verificationScope", "virtualDocumentExactBytes",
    ], `${mode} verification.policyOutcome`);
    validateVerificationEvidence({
      evaluationIdentity: {
        canonicalBase64: Buffer.from(identity.canonicalText, "utf8").toString("base64"),
        evaluationIdentityDigest: identity.evaluationIdentityDigest,
        mode: identity.mode,
        sourceFilename: identity.sourceFilename,
        state: identity.state,
        target: identity.target,
        verificationScope: identity.verificationScope,
        virtualDocumentExactBytes: identity.virtualDocumentExactBytes,
      },
      policyOutcome: {
        canonicalBase64: Buffer.from(outcome.canonicalText, "utf8").toString("base64"),
        decision: outcome.decision,
        evaluationIdentityDigest: outcome.evaluationIdentityDigest,
        mode: outcome.mode,
        outcomeDigest: outcome.outcomeDigest,
        sourceFilename: outcome.sourceFilename,
        state: outcome.state,
        target: outcome.target,
        verificationScope: outcome.verificationScope,
        virtualDocumentExactBytes: outcome.virtualDocumentExactBytes,
      },
    }, hostedVector(pass), `${mode} verification`);
  }
  return receipt;
}

function hostedVector(value) {
  return {
    decision: value.decision,
    evaluationIdentityCanonicalBase64: Buffer.from(
      value.evaluationIdentityCanonicalText,
      "utf8",
    ).toString("base64"),
    evaluationIdentityDigest: value.evaluationIdentityDigest,
    outcomeCanonicalBase64: Buffer.from(value.outcomeCanonicalText, "utf8").toString("base64"),
    outcomeDigest: value.outcomeDigest,
    stableCodes: value.stableCodes,
  };
}

function verificationEvidence(value) {
  return Object.freeze({
    evaluationIdentity: Object.freeze({
      canonicalBase64: Buffer.from(value.evaluationIdentity.canonicalText, "utf8")
        .toString("base64"),
      evaluationIdentityDigest: value.evaluationIdentity.evaluationIdentityDigest,
      mode: value.evaluationIdentity.mode,
      sourceFilename: value.evaluationIdentity.sourceFilename,
      state: value.evaluationIdentity.state,
      target: value.evaluationIdentity.target,
      verificationScope: value.evaluationIdentity.verificationScope,
      virtualDocumentExactBytes: value.evaluationIdentity.virtualDocumentExactBytes,
    }),
    policyOutcome: Object.freeze({
      canonicalBase64: Buffer.from(value.policyOutcome.canonicalText, "utf8").toString("base64"),
      decision: value.policyOutcome.decision,
      evaluationIdentityDigest: value.policyOutcome.evaluationIdentityDigest,
      mode: value.policyOutcome.mode,
      outcomeDigest: value.policyOutcome.outcomeDigest,
      sourceFilename: value.policyOutcome.sourceFilename,
      state: value.policyOutcome.state,
      target: value.policyOutcome.target,
      verificationScope: value.policyOutcome.verificationScope,
      virtualDocumentExactBytes: value.policyOutcome.virtualDocumentExactBytes,
    }),
  });
}

function deriveHostFacts(hostReceipts) {
  const development = hostReceipts.development;
  const restricted = hostReceipts.restricted;
  const installed = hostReceipts.installed;
  invariant(canonicalJson(development.contractIdentities)
    === canonicalJson(installed.contractIdentities)
    && canonicalJson(development.contractIdentities)
      === canonicalJson(restricted.contractIdentities),
  "contract identities differ between development, installed, and restricted hosts.");
  invariant(canonicalJson(development.preparation) === canonicalJson(installed.preparation),
    "preparation differs between development and installed hosts.");
  invariant(canonicalJson(development.verification) === canonicalJson(installed.verification),
    "verification command results differ between development and installed hosts.");
  const developmentVectors = vectorMap(development, "development host");
  const installedVectors = vectorMap(installed, "installed host");
  invariant(canonicalJson(developmentVectors) === canonicalJson(installedVectors),
    "semantic vectors differ between development and installed hosts.");
  return Object.freeze({
    contractIdentities: installed.contractIdentities,
    extension: { identifier: installed.extension.id, version: installed.extension.version },
    offline: { networkRequired: false, result: "PASS" },
    preparation: installed.preparation,
    verification: verificationEvidence(installed.verification),
    vectors: Object.fromEntries(["pass", "fail", "cne"].map((scenario) =>
      [scenario, hostedVector(installedVectors[scenario])])),
  });
}

function hostReceiptMetadata(hostRecords) {
  return Object.fromEntries(hostRecords.map(({ mode, bytes }) => [mode, {
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
  }]));
}

function deriveHostSuites(hostRecords) {
  return {
    extensionHost: { identity: receiptIdentity(hostRecords), result: "PASS" },
    installedVsix: {
      identity: receiptIdentity(hostRecords.filter(({ mode }) =>
        mode === "installed" || mode === "restricted")),
      result: "PASS",
    },
    restrictedWorkspace: {
      identity: receiptIdentity(hostRecords.filter(({ mode }) => mode === "restricted")),
      result: "PASS",
    },
    cancellation: {
      identity: receiptIdentity(hostRecords.filter(({ mode }) => mode !== "restricted")),
      result: "PASS",
    },
    offlineSmoke: { identity: receiptIdentity(hostRecords), result: "PASS" },
  };
}

function packageEvidence(receipt) {
  return Object.freeze({
    contractIdentityArtifact: { sha256: receipt.contractIdentityArtifact.rawSha256 },
    runtimeClosure: {
      entryCount: receipt.runtimeClosure.entryCount,
      inventoryDigest: receipt.runtimeClosure.inventoryDigest,
      closureDigest: receipt.runtimeClosure.runtimeClosureDigest,
    },
    vsix: {
      fileName: receipt.vsix.filename,
      byteLength: receipt.vsix.byteLength,
      sha256: receipt.vsix.sha256,
      internalFileCount: receipt.packageInventory.entryCount,
      inventoryDigest: receipt.packageInventory.digest,
    },
  });
}

function contractEvidence(contractIdentities) {
  const bytes = Buffer.from(contractIdentities.canonicalText, "utf8");
  return Object.freeze({
    canonicalBase64: bytes.toString("base64"),
    rawSha256: sha256(bytes),
    contractArtifactSha256: contractIdentities.contractArtifactSha256,
    runtimeClosureDigest: contractIdentities.runtimeClosureDigest,
  });
}

function validateSuiteReceipt(value, suite, revision) {
  validateClosedSuiteReceipt(value, {
    suite,
    implementationRevision: revision,
  });
  exactKeys(value, [
    "kind", "version", "suite", "implementationRevision", "result", "commands",
    "commandIdentityDigest",
  ], `${suite} suite receipt`);
  invariant(value.kind === "MemoryOSMO1303HostedSuiteReceipt"
    && value.version === "1.0.0" && value.suite === suite,
  `${suite} suite receipt identity differs.`);
  invariant(value.implementationRevision === revision,
    `${suite} suite revision differs from the actual checkout.`);
  invariant(value.result === "PASS", `${suite} suite did not pass.`);
  invariant(Array.isArray(value.commands) && value.commands.length > 0,
    `${suite} suite command inventory is empty.`);
  for (const [index, command] of value.commands.entries()) {
    exactKeys(command, ["cwd", "argv"], `${suite} commands[${index}]`);
    invariant(typeof command.cwd === "string" && !command.cwd.startsWith("/")
      && !command.cwd.includes("\\") && !command.cwd.includes(".."),
    `${suite} suite cwd is invalid.`);
    invariant(Array.isArray(command.argv) && command.argv.length > 0
      && command.argv.every((member) => typeof member === "string"
        && member.length > 0 && !/[\0\r\n]/u.test(member)),
    `${suite} suite argv is invalid.`);
  }
  digest(value.commandIdentityDigest, `${suite} suite command identity`);
  invariant(value.commandIdentityDigest
    === sha256(Buffer.from(canonicalJson(value.commands), "utf8")),
  `${suite} suite command identity does not reproduce.`);
  return value;
}

async function loadSuiteReceipts(directory, revision) {
  const entries = await readdir(directory, { withFileTypes: true });
  const expected = COMMAND_SUITES.map((name) => `${name}.json`).sort();
  invariant(entries.every((entry) => entry.isFile() && !entry.isSymbolicLink()),
    "suite receipt directory contains a non-regular entry.");
  invariant(canonicalJson(entries.map(({ name }) => name).sort()) === canonicalJson(expected),
    "suite receipt directory is open or incomplete.");
  const receipts = {};
  for (const suite of COMMAND_SUITES) {
    const loaded = await loadCanonicalFile(
      resolve(directory, `${suite}.json`),
      MAX_SUITE_RECEIPT_BYTES,
      `${suite} suite receipt`,
    );
    receipts[suite] = Object.freeze({
      byteLength: loaded.bytes.byteLength,
      receipt: validateSuiteReceipt(loaded.value, suite, revision),
      sha256: sha256(loaded.bytes),
    });
  }
  return receipts;
}

function receiptIdentity(records) {
  return sha256(Buffer.from(canonicalJson(records.map(({ mode, bytes }) => ({
    mode,
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
  }))), "utf8"));
}

async function verifiedVSIX(vsixPath, receiptPath, expectedIdentityPath) {
  const [sidecarLoaded, expectedLoaded] = await Promise.all([
    loadCanonicalFile(receiptPath, MAX_VSIX_RECEIPT_BYTES, "VSIX identity receipt"),
    loadCanonicalFile(expectedIdentityPath, MAX_VSIX_RECEIPT_BYTES, "frozen VSIX identity"),
  ]);
  const sidecar = validateVSIXReceiptShape(sidecarLoaded.value, "VSIX identity receipt");
  const expected = validateVSIXReceiptShape(expectedLoaded.value, "frozen VSIX identity");
  const actual = await verifyVSIX(vsixPath);
  invariant(canonicalJson(actual) === canonicalJson(sidecar),
    "actual VSIX bytes differ from their identity receipt.");
  invariant(canonicalJson(actual) === canonicalJson(expected),
    "actual VSIX bytes differ from the frozen package identity.");
  return actual;
}

async function validateCommand(options) {
  const expected = await expectations(options, true);
  const loaded = await loadCanonicalFile(
    required(options, "--input"), MAX_EVIDENCE_BYTES, "hosted evidence");
  validateHostedEvidence(loaded.value, expected);
  process.stdout.write(`MO-1303 hosted evidence PASS: ${expected.platform}\n`);
}

async function generateCommand(options) {
  const loaded = await loadCanonicalFile(
    required(options, "--facts"), MAX_EVIDENCE_BYTES, "assembled hosted facts");
  const facts = object(loaded.value, "assembled hosted facts");
  exactKeys(facts, [
    "platform", "implementationRevision", "vscodeVersion", "extension", "vsix",
    "runtimeClosure", "contractIdentityArtifact", "contractIdentities", "hostReceipts",
    "suites", "preparation", "vectors", "verification", "offline",
  ], "assembled hosted facts");
  const value = { kind: "MemoryOSMO1303HostedEvidence", version: "1.0.0", ...facts };
  validateHostedEvidence(value, {
    platform: value.platform.identifier,
    revision: value.implementationRevision,
    vsixSha256: value.vsix.sha256,
  });
  await writeFile(required(options, "--output"), `${canonicalJson(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

async function assembleCommand(options) {
  const expectedRevision = required(options, "--expected-revision");
  invariant(REVISION.test(expectedRevision), "external expected revision is malformed.");
  const revision = actualRevision();
  invariant(revision === expectedRevision,
    "actual checkout revision differs from the externally expected revision.");
  invariant(process.env.GITHUB_SHA === expectedRevision,
    "actual checkout revision differs from GITHUB_SHA.");
  const platform = verifiedPlatform(required(options, "--expected-platform"));
  const suiteReceipts = await loadSuiteReceipts(
    required(options, "--suite-receipt-dir"), revision);

  const hostRecords = [];
  const hostReceipts = {};
  for (const mode of HOST_MODES) {
    const loaded = await loadCanonicalFile(
      resolve(required(options, "--host-receipt-dir"), `${mode}.json`),
      MAX_HOST_RECEIPT_BYTES,
      `${mode} host receipt`,
    );
    hostRecords.push({ mode, bytes: loaded.bytes });
    hostReceipts[mode] = validateHostReceipt(
      loaded.value, mode, platform.identifier, { requireLocalSource: true });
  }
  const development = hostReceipts.development;
  const derivedHostFacts = deriveHostFacts(hostReceipts);

  const factsLoaded = await loadCanonicalFile(
    required(options, "--host-facts"), MAX_EVIDENCE_BYTES, "host facts");
  const hostFacts = object(factsLoaded.value, "host facts");
  exactKeys(hostFacts,
    ["extension", "preparation", "vectors", "verification", "offline", "contractIdentities"],
    "host facts");
  invariant(canonicalJson(hostFacts) === canonicalJson(derivedHostFacts),
    "host facts are not exactly derived from validated installed-host bytes.");
  validateVector(hostFacts.vectors.pass, "PASS", "host facts vectors.pass");
  validateVector(hostFacts.vectors.fail, "FAIL", "host facts vectors.fail");
  validateVector(hostFacts.vectors.cne, "COULD_NOT_EVALUATE", "host facts vectors.cne");

  const packageReceipt = await verifiedVSIX(
    required(options, "--vsix"),
    required(options, "--vsix-receipt"),
    required(options, "--expected-vsix-identity"),
  );
  invariant(packageReceipt.extension.id === hostFacts.extension.identifier
    && packageReceipt.extension.version === hostFacts.extension.version,
  "VSIX and host extension identities differ.");

  const contractLoaded = await loadCanonicalFile(
    CONTRACT_PATH, 65536, "contract identity artifact");
  const contractText = canonicalJson(contractLoaded.value);
  invariant(development.contractIdentities.canonicalText === contractText,
    "host contract identities differ from the frozen artifact bytes.");
  invariant(development.contractIdentities.contractArtifactSha256
    === packageReceipt.contractIdentityArtifact.rawSha256,
  "host contract artifact digest differs from the packaged artifact.");
  invariant(development.contractIdentities.runtimeClosureDigest
    === packageReceipt.runtimeClosure.runtimeClosureDigest,
  "host runtime closure digest differs from the packaged closure.");

  const receiptMetadata = hostReceiptMetadata(hostRecords);
  const suites = Object.fromEntries(COMMAND_SUITES.map((name) => [name, {
    identity: suiteReceipts[name].receipt.commandIdentityDigest,
    receiptByteLength: suiteReceipts[name].byteLength,
    receiptSha256: suiteReceipts[name].sha256,
    result: "PASS",
  }]));
  Object.assign(suites, deriveHostSuites(hostRecords));
  const packaged = packageEvidence(packageReceipt);

  const facts = {
    platform,
    implementationRevision: revision,
    vscodeVersion: "1.137.0",
    extension: hostFacts.extension,
    vsix: packaged.vsix,
    runtimeClosure: packaged.runtimeClosure,
    contractIdentityArtifact: packaged.contractIdentityArtifact,
    contractIdentities: contractEvidence(development.contractIdentities),
    hostReceipts: receiptMetadata,
    suites,
    preparation: hostFacts.preparation,
    vectors: hostFacts.vectors,
    verification: hostFacts.verification,
    offline: hostFacts.offline,
  };
  validateHostedEvidence(
    { kind: "MemoryOSMO1303HostedEvidence", version: "1.0.0", ...facts },
    { platform: platform.identifier, revision, vsixSha256: packageReceipt.vsix.sha256 },
  );
  await writeFile(required(options, "--output"), `${canonicalJson(facts)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

async function listArtifactFiles(root) {
  const result = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      const metadata = await lstat(path);
      invariant(!metadata.isSymbolicLink(), "certification artifact contains a symbolic link.");
      if (metadata.isDirectory()) await walk(path);
      else {
        invariant(metadata.isFile(), "certification artifact contains a non-regular entry.");
        result.push(relative(root, path).replaceAll("\\", "/"));
      }
    }
  }
  await walk(root);
  return result.sort();
}

async function validateArtifactDirectory(root, expected) {
  const actualFiles = await listArtifactFiles(root);
  invariant(canonicalJson(actualFiles) === canonicalJson(ARTIFACT_FILES),
    "certification artifact inventory is open or incomplete.");
  const receiptLoaded = await loadCanonicalFile(
    resolve(root, "vsix/memoryos-0.1.0.identity.json"),
    MAX_VSIX_RECEIPT_BYTES,
    "artifact VSIX identity receipt",
  );
  const receipt = validateVSIXReceiptShape(receiptLoaded.value,
    "artifact VSIX identity receipt");
  const verified = await verifyVSIX(resolve(root, "vsix/memoryos-0.1.0.vsix"));
  invariant(canonicalJson(verified) === canonicalJson(receipt),
    "artifact VSIX bytes differ from their receipt.");
  if (expected.vsixReceipt !== undefined) {
    invariant(canonicalJson(verified) === canonicalJson(expected.vsixReceipt),
      "artifact VSIX differs from the frozen identity.");
  }
  invariant(verified.vsix.sha256 === expected.vsixSha256,
    "artifact VSIX digest differs from the external identity.");
  const evidenceLoaded = await loadCanonicalFile(
    resolve(root, "hosted-evidence/mo1303-hosted-evidence.json"),
    MAX_EVIDENCE_BYTES,
    "artifact hosted evidence",
  );
  const evidence = validateHostedEvidence(evidenceLoaded.value, expected);
  const packaged = packageEvidence(verified);
  invariant(canonicalJson(evidence.vsix) === canonicalJson(packaged.vsix)
    && canonicalJson(evidence.runtimeClosure) === canonicalJson(packaged.runtimeClosure)
    && canonicalJson(evidence.contractIdentityArtifact)
      === canonicalJson(packaged.contractIdentityArtifact),
  "artifact hosted evidence differs from the verified VSIX identities.");

  const hostRecords = [];
  const hostReceipts = {};
  for (const mode of HOST_MODES) {
    const hostLoaded = await loadCanonicalFile(
      resolve(root, `host-results/${mode}.json`),
      MAX_HOST_RECEIPT_BYTES,
      `artifact ${mode} host receipt`,
    );
    hostRecords.push({ mode, bytes: hostLoaded.bytes });
    hostReceipts[mode] = validateHostReceipt(
      hostLoaded.value, mode, expected.platform);
    invariant(hostLoaded.bytes.byteLength === evidence.hostReceipts[mode].byteLength
      && sha256(hostLoaded.bytes) === evidence.hostReceipts[mode].sha256,
    `artifact ${mode} host receipt identity differs from evidence.`);
  }
  invariant(canonicalJson(evidence.hostReceipts)
    === canonicalJson(hostReceiptMetadata(hostRecords)),
  "artifact host receipt inventory differs from hosted evidence.");
  const derivedHostFacts = deriveHostFacts(hostReceipts);
  const retainedHostFacts = await loadCanonicalFile(
    resolve(root, "host-results/hosted-facts.json"),
    MAX_EVIDENCE_BYTES,
    "artifact host facts",
  );
  invariant(canonicalJson(retainedHostFacts.value) === canonicalJson(derivedHostFacts),
    "artifact hosted facts are not derived from the raw host receipts.");
  invariant(canonicalJson(evidence.extension) === canonicalJson(derivedHostFacts.extension)
    && canonicalJson(evidence.preparation) === canonicalJson(derivedHostFacts.preparation)
    && canonicalJson(evidence.vectors) === canonicalJson(derivedHostFacts.vectors)
    && canonicalJson(evidence.verification) === canonicalJson(derivedHostFacts.verification)
    && canonicalJson(evidence.offline) === canonicalJson(derivedHostFacts.offline),
  "artifact hosted evidence differs from the raw host semantics.");

  const contractLoaded = await loadCanonicalFile(
    CONTRACT_PATH, 65536, "contract identity artifact");
  const contractText = canonicalJson(contractLoaded.value);
  invariant(hostReceipts.development.contractIdentities.canonicalText === contractText,
    "artifact host contract identities differ from the frozen artifact bytes.");
  invariant(hostReceipts.development.contractIdentities.contractArtifactSha256
    === verified.contractIdentityArtifact.rawSha256
    && hostReceipts.development.contractIdentities.runtimeClosureDigest
      === verified.runtimeClosure.runtimeClosureDigest,
  "artifact host identities differ from the packaged identities.");
  invariant(canonicalJson(evidence.contractIdentities)
    === canonicalJson(contractEvidence(hostReceipts.development.contractIdentities)),
  "artifact hosted contract identities differ from raw host bytes.");

  const derivedSuites = {};
  for (const suite of COMMAND_SUITES) {
    const suiteLoaded = await loadCanonicalFile(
      resolve(root, `host-results/suite-results/${suite}.json`),
      MAX_SUITE_RECEIPT_BYTES,
      `artifact ${suite} suite receipt`,
    );
    const suiteReceipt = validateSuiteReceipt(
      suiteLoaded.value, suite, expected.revision);
    derivedSuites[suite] = {
      identity: suiteReceipt.commandIdentityDigest,
      receiptByteLength: suiteLoaded.bytes.byteLength,
      receiptSha256: sha256(suiteLoaded.bytes),
      result: "PASS",
    };
  }
  Object.assign(derivedSuites, deriveHostSuites(hostRecords));
  invariant(canonicalJson(evidence.suites) === canonicalJson(derivedSuites),
    "artifact suite evidence is not derived from the retained receipts.");
  return Object.freeze({ evidence, receipt: verified });
}

async function stageUploadCommand(options) {
  const sourceRoot = resolve(required(options, "--source-root"));
  const outputRoot = resolve(required(options, "--output-root"));
  const normalizedSource = `${normalizePath(sourceRoot)}/`;
  const normalizedOutput = `${normalizePath(outputRoot)}/`;
  invariant(normalizedSource !== normalizedOutput
    && !normalizedSource.startsWith(normalizedOutput)
    && !normalizedOutput.startsWith(normalizedSource),
  "staged artifact root must be disjoint from its source root.");
  await mkdir(outputRoot, { recursive: false });
  for (const path of ARTIFACT_FILES) {
    const sourcePath = path.startsWith("host-results/suite-results/")
      ? path.slice("host-results/".length)
      : path;
    const source = resolve(sourceRoot, ...sourcePath.split("/"));
    const destination = resolve(outputRoot, ...path.split("/"));
    const metadata = await lstat(source);
    invariant(metadata.isFile() && !metadata.isSymbolicLink(),
      `upload source ${path} is not a regular file.`);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, 0);
  }
  const expected = await expectations(options, true);
  await validateArtifactDirectory(outputRoot, expected);
  process.stdout.write(`MO-1303 bounded upload artifact PASS: ${expected.platform}\n`);
}

async function compareCommand(options) {
  const expected = await expectations(options, false);
  const root = resolve(required(options, "--root"));
  const entries = await readdir(root, { withFileTypes: true });
  const expectedDirectories = Object.keys(PLATFORM).map((name) => `mo1303-${name}-x64`).sort();
  invariant(entries.every((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    && canonicalJson(entries.map(({ name }) => name).sort())
      === canonicalJson(expectedDirectories),
  "cross-platform artifact root must contain exactly the three platform directories.");
  const byPlatform = new Map();
  for (const identifier of Object.keys(PLATFORM)) {
    const validated = await validateArtifactDirectory(
      resolve(root, `mo1303-${identifier}-x64`),
      { ...expected, platform: identifier },
    );
    invariant(!byPlatform.has(identifier), "duplicate platform evidence.");
    byPlatform.set(identifier, validated);
  }
  const parity = ({ evidence, receipt }) => canonicalJson({
    contractIdentities: evidence.contractIdentities,
    contractIdentityArtifact: evidence.contractIdentityArtifact,
    extension: evidence.extension,
    offline: evidence.offline,
    packageInventory: receipt.packageInventory,
    preparation: evidence.preparation,
    runtimeClosure: evidence.runtimeClosure,
    vectors: evidence.vectors,
    verification: evidence.verification,
    vsix: evidence.vsix,
    vscodeVersion: evidence.vscodeVersion,
  });
  const identities = [...byPlatform.values()].map(parity);
  invariant(identities.every((identity) => identity === identities[0]),
    "cross-platform semantic/package byte parity differs.");
  process.stdout.write("MO-1303 three-platform hosted evidence PASS\n");
}

const invokedPath = process.argv[1] === undefined ? "" : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  const [command, ...argv] = process.argv.slice(2);
  const options = flags(argv);
  if (command === "validate") await validateCommand(options);
  else if (command === "assemble") await assembleCommand(options);
  else if (command === "generate") await generateCommand(options);
  else if (command === "stage-upload") await stageUploadCommand(options);
  else if (command === "compare-platforms") await compareCommand(options);
  else fail("expected assemble, generate, stage-upload, validate, or compare-platforms command.");
}
