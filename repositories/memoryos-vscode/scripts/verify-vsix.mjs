#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { createRequire } from "node:module";
import { lstat, open, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import yauzl from "yauzl";

const require = createRequire(import.meta.url);
const vscePackage = require("@vscode/vsce/package.json");
const yauzlPackage = require("yauzl/package.json");

export const EXPECTED_EXTENSION = Object.freeze({
  displayName: "MemoryOS",
  filename: "memoryos-0.1.0.vsix",
  id: "moelsaka01.memoryos",
  name: "memoryos",
  publisher: "moelsaka01",
  version: "0.1.0",
});

export const REPRODUCIBLE_SOURCE_DATE_EPOCH = 315_532_800;
export const REPRODUCIBLE_TIMESTAMP = "1980-01-01T00:00:00.000Z";
export const EXPECTED_VSCE_VERSION = "4.0.0";
export const EXPECTED_YAUZL_VERSION = "3.4.0";
export const EXPECTED_ARCHIVE_MODE = 0o100644;

export const EXPECTED_RUNTIME = Object.freeze({
  closureDigest: "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3",
  entryCount: 37,
  inventoryDigest: "sha256:2aed4a65a3697345c3da71a4716565e2eb5275021db7628a09b2103c78203542",
  manifestRawSha256: "sha256:9b78149d2091056c80dce0f10e9d0a4eefbc180f3a17e62e96b6bfe7b1b1eeb8",
});

export const EXPECTED_CONTRACT = Object.freeze({
  path: "extension/contracts/policy-contract-identities-1.0.0.json",
  rawSha256: "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7",
});

export const VSIX_LIMITS = Object.freeze({
  archiveBytes: 8 * 1024 * 1024,
  entryCount: 64,
  memberBytes: 2 * 1024 * 1024,
  receiptBytes: 128 * 1024,
  totalUncompressedBytes: 8 * 1024 * 1024,
});

const MANIFEST_PATH = "extension/runtime/runtime-closure-manifest.json";
const PACKAGE_JSON_PATH = "extension/package.json";
const VSIX_MANIFEST_PATH = "extension.vsixmanifest";
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const PORTABLE_PATH = /^[A-Za-z0-9._/\[\]-]+$/u;
const RECEIPT_KIND = "MemoryOSVSCodeVSIXIdentityReceipt";
const RECEIPT_VERSION = "1.0.0";
const RUNTIME_CLOSURE_DOMAIN = Buffer.from("MemoryOSVSCodeRuntimeClosureIdentity\0", "utf8");

const FIXED_PACKAGE_MEMBERS = Object.freeze([
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/changelog.md",
  "extension/readme.md",
  EXPECTED_CONTRACT.path,
  "extension/out/cli-worker.cjs",
  "extension/out/extension.cjs",
  PACKAGE_JSON_PATH,
  MANIFEST_PATH,
]);

const FORBIDDEN_SEGMENTS = new Set([
  ".cache", ".git", ".npm", "__pycache__", "cache", "evidence",
  "fixture", "fixtures", "maps", "measurements", "node_modules",
  "script", "scripts", "test", "test-fixtures", "tests",
]);

function fail(message) {
  throw new Error(`VSIX validation failed: ${message}`);
}

function invariant(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, expected, label) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} is not an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(wanted), `${label} keys are not closed`);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function portableCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function assertSafeArchivePath(path) {
  invariant(typeof path === "string" && path.length > 0, "archive member has no path");
  invariant(Buffer.byteLength(path, "utf8") <= 512, `archive member path is too long: ${path}`);
  invariant(PORTABLE_PATH.test(path), `archive member path is not portable: ${path}`);
  invariant(!path.includes("\\") && !path.startsWith("/") && !/^[A-Za-z]:/u.test(path),
    `archive member path is absolute or uses a backslash: ${path}`);
  invariant(!/[\0-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(path),
    `archive member path contains control or bidirectional text: ${path}`);
  const segments = path.split("/");
  invariant(!path.endsWith("/") && segments.every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    `archive member path is not a regular leaf: ${path}`);
}

export function assertNoForbiddenPackagePath(path) {
  const lower = path.toLowerCase();
  const runtimeMember = lower.startsWith("extension/runtime/vendor/");
  for (const segment of lower.split("/")) {
    if (FORBIDDEN_SEGMENTS.has(segment)) fail(`forbidden package path: ${path}`);
    if (segment === "src" && !runtimeMember) fail(`TypeScript/source tree path is forbidden: ${path}`);
  }
  invariant(!/\.(?:cts|map|mts|ts|tsx)$/iu.test(path), `source or source-map member is forbidden: ${path}`);
  invariant(!/(?:^|\/)(?:\.ds_store|desktop\.ini|thumbs\.db|npm-debug\.log)$/iu.test(path),
    `local or cache member is forbidden: ${path}`);
  invariant(!/(?:\.swp|\.tmp|~)$/iu.test(path), `temporary member is forbidden: ${path}`);
}

export function validateArchiveEntryMetadata(entry, exactPaths = new Set(), foldedPaths = new Map()) {
  const path = entry.fileName;
  assertSafeArchivePath(path);
  assertNoForbiddenPackagePath(path);
  invariant(!exactPaths.has(path), `duplicate archive member: ${path}`);
  const folded = path.toLowerCase();
  const collided = foldedPaths.get(folded);
  invariant(collided === undefined, `case-colliding archive members: ${collided} and ${path}`);
  exactPaths.add(path);
  foldedPaths.set(folded, path);

  invariant(entry.isEncrypted?.() !== true && (entry.generalPurposeBitFlag & 0x1) === 0,
    `encrypted archive member: ${path}`);
  invariant(entry.compressionMethod === 0 || entry.compressionMethod === 8,
    `unsupported compression method for ${path}`);
  invariant(Number.isSafeInteger(entry.compressedSize) && entry.compressedSize >= 0,
    `invalid compressed size for ${path}`);
  invariant(Number.isSafeInteger(entry.uncompressedSize)
    && entry.uncompressedSize >= 0
    && entry.uncompressedSize <= VSIX_LIMITS.memberBytes,
  `uncompressed member exceeds its bound: ${path}`);
  invariant(entry.fileComment === undefined || entry.fileComment === "", `archive member has a comment: ${path}`);

  const attributes = entry.externalFileAttributes >>> 0;
  const unixMode = attributes >>> 16;
  const unixType = unixMode & 0o170000;
  const madeBySystem = (entry.versionMadeBy >>> 8) & 0xff;
  invariant(unixType !== 0o120000, `symbolic-link archive member: ${path}`);
  if (unixType !== 0) {
    invariant(unixType === 0o100000, `non-regular Unix archive member: ${path}`);
  }
  invariant((attributes & 0x10) === 0, `directory archive member: ${path}`);
  invariant(madeBySystem === 3, `archive member is not Unix-mode normalized: ${path}`);
  invariant(unixMode === EXPECTED_ARCHIVE_MODE,
    `archive member mode is not the frozen regular-file mode 0100644: ${path}`);

  if (typeof entry.getLastModDate === "function") {
    const timestamp = entry.getLastModDate({ timezone: "UTC" });
    invariant(timestamp instanceof Date
      && !Number.isNaN(timestamp.getTime())
      && timestamp.toISOString() === REPRODUCIBLE_TIMESTAMP,
    `archive member does not use SOURCE_DATE_EPOCH=${REPRODUCIBLE_SOURCE_DATE_EPOCH}: ${path}`);
  }
  return path;
}

async function readBoundedStream(stream, maximum, label) {
  const chunks = [];
  let length = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximum) {
      stream.destroy();
      fail(`${label} exceeded ${maximum} bytes`);
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, length);
}

async function readArchiveMembers(vsixBytes) {
  const zip = await yauzl.fromBufferPromise(vsixBytes, {
    autoClose: false,
    decodeStrings: true,
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  const members = new Map();
  const exactPaths = new Set();
  const foldedPaths = new Map();
  let totalUncompressedBytes = 0;
  try {
    invariant(zip.entryCount <= VSIX_LIMITS.entryCount,
      `archive advertises more than ${VSIX_LIMITS.entryCount} members`);
    invariant(zip.comment === "", "archive comment is forbidden");
    for await (const entry of zip.eachEntry()) {
      invariant(members.size < VSIX_LIMITS.entryCount,
        `archive contains more than ${VSIX_LIMITS.entryCount} members`);
      const path = validateArchiveEntryMetadata(entry, exactPaths, foldedPaths);
      totalUncompressedBytes += entry.uncompressedSize;
      invariant(totalUncompressedBytes <= VSIX_LIMITS.totalUncompressedBytes,
        "archive exceeds its total uncompressed byte bound");
      const stream = await zip.openReadStreamPromise(entry);
      const bytes = await readBoundedStream(stream, VSIX_LIMITS.memberBytes, path);
      invariant(bytes.length === entry.uncompressedSize, `uncompressed size changed while reading ${path}`);
      members.set(path, bytes);
    }
    invariant(members.size === zip.entryCount, "archive member count changed while reading");
    return members;
  } finally {
    if (zip.isOpen) zip.close();
  }
}

function parseJson(bytes, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} is not a JSON object`);
  return value;
}

function validateRuntimeManifest(bytes, archiveMembers) {
  invariant(sha256(bytes) === EXPECTED_RUNTIME.manifestRawSha256,
    "packaged runtime manifest raw digest differs from the frozen manifest");
  const manifest = parseJson(bytes, "runtime manifest");
  exactKeys(manifest, ["files", "inventoryDigest", "kind", "version"], "runtime manifest");
  invariant(manifest.kind === "MemoryOSVSCodeRuntimeClosureManifest", "runtime manifest kind differs");
  invariant(manifest.version === "1.0.0", "runtime manifest version differs");
  invariant(Array.isArray(manifest.files) && manifest.files.length === EXPECTED_RUNTIME.entryCount,
    `runtime manifest must contain exactly ${EXPECTED_RUNTIME.entryCount} entries`);
  const paths = [];
  const actualInventory = [];
  for (const member of manifest.files) {
    exactKeys(member, ["byteLength", "path", "sha256"], "runtime manifest member");
    invariant(typeof member.path === "string" && member.path.startsWith("vendor/"),
      "runtime manifest member path is invalid");
    const packagePath = `extension/runtime/${member.path}`;
    assertSafeArchivePath(packagePath);
    assertNoForbiddenPackagePath(packagePath);
    invariant(Number.isSafeInteger(member.byteLength)
      && member.byteLength > 0
      && member.byteLength <= VSIX_LIMITS.memberBytes,
    `runtime manifest member byte length is invalid: ${member.path}`);
    invariant(typeof member.sha256 === "string" && SHA256.test(member.sha256),
      `runtime manifest member digest is invalid: ${member.path}`);
    const runtimeBytes = archiveMembers.get(packagePath);
    invariant(runtimeBytes !== undefined, `packaged runtime member is missing: ${member.path}`);
    const actual = Object.freeze({
      byteLength: runtimeBytes.length,
      path: member.path,
      sha256: sha256(runtimeBytes),
    });
    invariant(actual.byteLength === member.byteLength, `packaged runtime member length differs: ${member.path}`);
    invariant(actual.sha256 === member.sha256, `packaged runtime member digest differs: ${member.path}`);
    paths.push(member.path);
    actualInventory.push(actual);
  }
  invariant(new Set(paths).size === paths.length, "runtime manifest contains duplicate paths");
  invariant(JSON.stringify(paths) === JSON.stringify([...paths].sort(portableCompare)),
    "runtime manifest paths are not sorted");
  const inventoryDigest = sha256(Buffer.from(canonicalJson(actualInventory), "utf8"));
  invariant(manifest.inventoryDigest === inventoryDigest, "runtime manifest inventory digest does not reproduce");
  invariant(inventoryDigest === EXPECTED_RUNTIME.inventoryDigest, "packaged runtime inventory digest changed");
  const closureDigest = sha256(Buffer.concat([
    RUNTIME_CLOSURE_DOMAIN,
    Buffer.from(canonicalJson(manifest), "utf8"),
  ]));
  invariant(closureDigest === EXPECTED_RUNTIME.closureDigest, "packaged runtime closure digest changed");
  return Object.freeze({
    entryCount: actualInventory.length,
    inventoryDigest,
    manifestRawSha256: sha256(bytes),
    runtimeClosureDigest: closureDigest,
  });
}

function decodeXmlAttribute(value) {
  return value.replace(/&(?:amp|apos|gt|lt|quot);/gu, (entity) => ({
    "&amp;": "&",
    "&apos;": "'",
    "&gt;": ">",
    "&lt;": "<",
    "&quot;": "\"",
  })[entity]);
}

function vsixManifestIdentity(bytes) {
  const text = bytes.toString("utf8");
  invariant(!text.includes("\ufffd"), "VSIX manifest is not valid UTF-8");
  invariant(!/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<!--/iu.test(text),
    "VSIX manifest contains unsupported XML declarations");
  const identityTags = [...text.matchAll(/<Identity\b([^<>]*)\/?\s*>/gu)];
  invariant(identityTags.length === 1, "VSIX manifest must have exactly one Identity element");
  const identityTag = identityTags[0];
  const attributes = {};
  const expression = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/gu;
  let match;
  while ((match = expression.exec(identityTag[1])) !== null) {
    invariant(!Object.hasOwn(attributes, match[1]), `VSIX manifest repeats Identity.${match[1]}`);
    attributes[match[1]] = decodeXmlAttribute(match[2]);
  }
  const residue = identityTag[1].replace(
    /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/gu,
    "",
  ).trim();
  invariant(residue === "" || residue === "/", "VSIX manifest Identity attributes are malformed");
  exactKeys(attributes, ["Id", "Language", "Publisher", "Version"], "VSIX manifest Identity");
  invariant(attributes.Language === "en-US", "VSIX manifest identity language differs");
  invariant(attributes.Id === EXPECTED_EXTENSION.name, "VSIX manifest extension name differs");
  invariant(attributes.Publisher === EXPECTED_EXTENSION.publisher, "VSIX manifest publisher differs");
  invariant(attributes.Version === EXPECTED_EXTENSION.version, "VSIX manifest version differs");
  return Object.freeze({
    id: `${attributes.Publisher}.${attributes.Id}`,
    name: attributes.Id,
    publisher: attributes.Publisher,
    version: attributes.Version,
  });
}

function validateExtensionIdentity(packageBytes, vsixManifestBytes) {
  const packageManifest = parseJson(packageBytes, "packaged extension manifest");
  invariant(packageManifest.name === EXPECTED_EXTENSION.name, "packaged extension name differs");
  invariant(packageManifest.publisher === EXPECTED_EXTENSION.publisher, "packaged extension publisher differs");
  invariant(packageManifest.version === EXPECTED_EXTENSION.version, "packaged extension version differs");
  invariant(packageManifest.displayName === EXPECTED_EXTENSION.displayName, "packaged extension display name differs");
  const vsixIdentity = vsixManifestIdentity(vsixManifestBytes);
  invariant(vsixIdentity.id === EXPECTED_EXTENSION.id, "VSIX manifest extension identifier differs");
  invariant(`${packageManifest.publisher}.${packageManifest.name}` === vsixIdentity.id,
    "package.json and VSIX manifest extension identities disagree");
  invariant(packageManifest.version === vsixIdentity.version,
    "package.json and VSIX manifest versions disagree");
  return Object.freeze({
    displayName: packageManifest.displayName,
    id: vsixIdentity.id,
    name: vsixIdentity.name,
    publisher: vsixIdentity.publisher,
    version: vsixIdentity.version,
  });
}

function validateContract(bytes) {
  invariant(sha256(bytes) === EXPECTED_CONTRACT.rawSha256,
    "packaged contract identity artifact digest changed");
  const contract = parseJson(bytes, "contract identity artifact");
  invariant(contract.kind === "MemoryOSPolicyContractIdentities", "contract identity artifact kind differs");
  invariant(contract.version === "1.0.0", "contract identity artifact version differs");
  return Object.freeze({
    byteLength: bytes.length,
    path: EXPECTED_CONTRACT.path,
    rawSha256: sha256(bytes),
  });
}

function validateClosedAllowlist(archiveMembers, runtimeManifest) {
  const manifest = parseJson(archiveMembers.get(MANIFEST_PATH), "runtime manifest");
  const expected = [
    ...FIXED_PACKAGE_MEMBERS,
    ...manifest.files.map(({ path }) => `extension/runtime/${path}`),
  ].sort(portableCompare);
  invariant(expected.length === FIXED_PACKAGE_MEMBERS.length + EXPECTED_RUNTIME.entryCount,
    "closed package allowlist has the wrong size");
  invariant(new Set(expected).size === expected.length, "closed package allowlist has duplicate paths");
  const actual = [...archiveMembers.keys()].sort(portableCompare);
  invariant(JSON.stringify(actual) === JSON.stringify(expected),
    `closed package allowlist differs; expected ${expected.length} exact members and received ${actual.length}`);
  invariant(runtimeManifest.entryCount === EXPECTED_RUNTIME.entryCount,
    "runtime validation and package allowlist disagree");
}

function receiptBytes(receipt) {
  const bytes = Buffer.from(`${canonicalJson(receipt)}\n`, "utf8");
  invariant(bytes.length <= VSIX_LIMITS.receiptBytes, "VSIX identity receipt exceeds its byte bound");
  return bytes;
}

export function encodeVSIXIdentityReceipt(receipt) {
  return receiptBytes(receipt);
}

async function readRegularBoundedFile(path, maximum, label) {
  const before = await lstat(path, { bigint: true });
  invariant(before.isFile() && !before.isSymbolicLink(), `${label} is not a regular file`);
  invariant(before.size > 0n && before.size <= BigInt(maximum), `${label} exceeds its byte bound`);
  const noFollow = process.platform === "win32" ? 0 : (fsConstants.O_NOFOLLOW ?? 0);
  const flags = fsConstants.O_RDONLY
    | noFollow;
  const handle = await open(path, flags);
  try {
    const opened = await handle.stat({ bigint: true });
    invariant(opened.isFile()
      && opened.dev === before.dev
      && opened.ino === before.ino
      && opened.size === before.size
      && opened.mtimeNs === before.mtimeNs
      && opened.ctimeNs === before.ctimeNs,
    `${label} identity changed while opening`);
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    invariant(after.dev === opened.dev
      && after.ino === opened.ino
      && after.size === opened.size
      && after.mtimeNs === opened.mtimeNs
      && after.ctimeNs === opened.ctimeNs
      && BigInt(bytes.length) === opened.size,
    `${label} changed while reading`);
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function verifyVSIXBytes(vsixBytes, filename = EXPECTED_EXTENSION.filename) {
  invariant(vscePackage.version === EXPECTED_VSCE_VERSION,
    `installed @vscode/vsce version is ${vscePackage.version}, expected ${EXPECTED_VSCE_VERSION}`);
  invariant(yauzlPackage.version === EXPECTED_YAUZL_VERSION,
    `installed yauzl version is ${yauzlPackage.version}, expected ${EXPECTED_YAUZL_VERSION}`);
  invariant(Buffer.isBuffer(vsixBytes)
    && vsixBytes.length > 0
    && vsixBytes.length <= VSIX_LIMITS.archiveBytes,
  "VSIX bytes exceed their bound");
  invariant(filename === EXPECTED_EXTENSION.filename,
    `VSIX filename must be ${EXPECTED_EXTENSION.filename}`);
  const archiveMembers = await readArchiveMembers(vsixBytes);
  for (const required of FIXED_PACKAGE_MEMBERS) {
    invariant(archiveMembers.has(required), `required package member is missing: ${required}`);
  }
  const runtime = validateRuntimeManifest(archiveMembers.get(MANIFEST_PATH), archiveMembers);
  validateClosedAllowlist(archiveMembers, runtime);
  const extension = validateExtensionIdentity(
    archiveMembers.get(PACKAGE_JSON_PATH),
    archiveMembers.get(VSIX_MANIFEST_PATH),
  );
  const contractIdentityArtifact = validateContract(archiveMembers.get(EXPECTED_CONTRACT.path));
  const files = [...archiveMembers.entries()]
    .map(([path, bytes]) => Object.freeze({
      byteLength: bytes.length,
      path,
      sha256: sha256(bytes),
    }))
    .sort((left, right) => portableCompare(left.path, right.path));
  const packageInventory = Object.freeze({
    digest: sha256(Buffer.from(canonicalJson(files), "utf8")),
    entryCount: files.length,
    files: Object.freeze(files),
  });
  const receipt = Object.freeze({
    contractIdentityArtifact,
    extension,
    kind: RECEIPT_KIND,
    packageInventory,
    reproducibleBuild: Object.freeze({
      sourceDateEpoch: REPRODUCIBLE_SOURCE_DATE_EPOCH,
      timestamp: REPRODUCIBLE_TIMESTAMP,
      timezone: "UTC",
      validator: `yauzl@${EXPECTED_YAUZL_VERSION}`,
      vsce: `@vscode/vsce@${EXPECTED_VSCE_VERSION}`,
    }),
    runtimeClosure: runtime,
    version: RECEIPT_VERSION,
    vsix: Object.freeze({
      byteLength: vsixBytes.length,
      filename,
      sha256: sha256(vsixBytes),
    }),
  });
  receiptBytes(receipt);
  return receipt;
}

export async function verifyVSIX(vsixPath) {
  const absolutePath = resolve(vsixPath);
  invariant(basename(absolutePath) === EXPECTED_EXTENSION.filename,
    `VSIX filename must be ${EXPECTED_EXTENSION.filename}`);
  const vsixBytes = await readRegularBoundedFile(
    absolutePath,
    VSIX_LIMITS.archiveBytes,
    "VSIX",
  );
  return verifyVSIXBytes(vsixBytes, basename(absolutePath));
}

export async function writeVSIXIdentityReceipt(path, receipt) {
  const absolutePath = resolve(path);
  await writeFile(absolutePath, receiptBytes(receipt), { flag: "wx" });
  return absolutePath;
}

export async function verifyVSIXIdentityReceipt(vsixPath, receiptPath) {
  const actual = await verifyVSIX(vsixPath);
  const retained = await readRegularBoundedFile(
    resolve(receiptPath),
    VSIX_LIMITS.receiptBytes,
    "VSIX identity receipt",
  );
  invariant(retained.equals(receiptBytes(actual)), "VSIX identity receipt differs from actual archive bytes");
  return actual;
}

function parseArguments(arguments_) {
  const values = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const name = arguments_[index];
    invariant(name === "--vsix" || name === "--receipt", `unsupported argument: ${name}`);
    invariant(!Object.hasOwn(values, name), `duplicate argument: ${name}`);
    const value = arguments_[index + 1];
    invariant(typeof value === "string" && value.length > 0 && !value.startsWith("--"),
      `missing value for ${name}`);
    invariant(!/[\0\r\n]/u.test(value), `invalid scalar value for ${name}`);
    values[name] = value;
    index += 1;
  }
  invariant(typeof values["--vsix"] === "string", "--vsix is required");
  return values;
}

function summary(receipt) {
  return Object.freeze({
    contractIdentityDigest: receipt.contractIdentityArtifact.rawSha256,
    extensionId: receipt.extension.id,
    extensionVersion: receipt.extension.version,
    packageEntryCount: receipt.packageInventory.entryCount,
    packageInventoryDigest: receipt.packageInventory.digest,
    runtimeClosureDigest: receipt.runtimeClosure.runtimeClosureDigest,
    runtimeEntryCount: receipt.runtimeClosure.entryCount,
    sourceDateEpoch: receipt.reproducibleBuild.sourceDateEpoch,
    vsixByteLength: receipt.vsix.byteLength,
    vsixFilename: receipt.vsix.filename,
    vsixSha256: receipt.vsix.sha256,
  });
}

const invokedPath = process.argv[1] === undefined ? "" : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const receipt = options["--receipt"] === undefined
      ? await verifyVSIX(options["--vsix"])
      : await verifyVSIXIdentityReceipt(options["--vsix"], options["--receipt"]);
    process.stdout.write(`${canonicalJson(summary(receipt))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
