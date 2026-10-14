#!/usr/bin/env node

import { createRequire } from "node:module";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import vsce from "@vscode/vsce";

import {
  EXPECTED_EXTENSION,
  EXPECTED_ARCHIVE_MODE,
  EXPECTED_VSCE_VERSION,
  REPRODUCIBLE_SOURCE_DATE_EPOCH,
  VSIX_LIMITS,
  canonicalJson,
  verifyVSIX,
  writeVSIXIdentityReceipt,
} from "./verify-vsix.mjs";

const require = createRequire(import.meta.url);
const vscePackage = require("@vscode/vsce/package.json");
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = resolve(packageRoot, "out", "vsix", EXPECTED_EXTENSION.filename);
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const CENTRAL_DIRECTORY_HEADER_BYTES = 46;

function fail(message) {
  throw new Error(`VSIX packaging failed: ${message}`);
}

function invariant(condition, message) {
  if (!condition) fail(message);
}

export function normalizeVSIXArchiveModes(input) {
  invariant(Buffer.isBuffer(input)
    && input.length >= END_OF_CENTRAL_DIRECTORY_BYTES
    && input.length <= VSIX_LIMITS.archiveBytes,
  "VSIX bytes are outside the closed archive bound");
  const bytes = Buffer.from(input);
  const eocdOffset = bytes.length - END_OF_CENTRAL_DIRECTORY_BYTES;
  invariant(bytes.readUInt32LE(eocdOffset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE,
    "VSIX does not end in one comment-free ZIP32 EOCD record");
  invariant(bytes.readUInt16LE(eocdOffset + 4) === 0
    && bytes.readUInt16LE(eocdOffset + 6) === 0,
  "multi-disk VSIX archives are forbidden");
  const entriesOnDisk = bytes.readUInt16LE(eocdOffset + 8);
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralDirectoryBytes = bytes.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = bytes.readUInt32LE(eocdOffset + 16);
  invariant(bytes.readUInt16LE(eocdOffset + 20) === 0,
    "VSIX archive comments are forbidden");
  invariant(entryCount > 0
    && entryCount <= VSIX_LIMITS.entryCount
    && entriesOnDisk === entryCount
    && centralDirectoryOffset + centralDirectoryBytes === eocdOffset,
  "VSIX central-directory bounds are invalid or ZIP64");

  let cursor = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    invariant(cursor + CENTRAL_DIRECTORY_HEADER_BYTES <= eocdOffset
      && bytes.readUInt32LE(cursor) === CENTRAL_DIRECTORY_SIGNATURE,
    `VSIX central-directory header ${index} is invalid`);
    invariant(bytes.readUInt16LE(cursor + 34) === 0,
      "multi-disk VSIX member is forbidden");
    const fileNameBytes = bytes.readUInt16LE(cursor + 28);
    const extraFieldBytes = bytes.readUInt16LE(cursor + 30);
    const commentBytes = bytes.readUInt16LE(cursor + 32);
    const next = cursor + CENTRAL_DIRECTORY_HEADER_BYTES
      + fileNameBytes + extraFieldBytes + commentBytes;
    invariant(fileNameBytes > 0 && next <= eocdOffset,
      `VSIX central-directory header ${index} exceeds its bound`);
    const versionMadeBy = bytes.readUInt16LE(cursor + 4);
    bytes.writeUInt16LE((3 << 8) | (versionMadeBy & 0xff), cursor + 4);
    bytes.writeUInt32LE((EXPECTED_ARCHIVE_MODE << 16) >>> 0, cursor + 38);
    cursor = next;
  }
  invariant(cursor === eocdOffset,
    "VSIX central-directory entry count or byte length differs");
  return bytes;
}

async function assertRegularFile(path, label) {
  const metadata = await lstat(path);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), `${label} is not a regular file: ${path}`);
}

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function createReproducibleVSIX(extensionRoot, outputPath) {
  invariant(vscePackage.version === EXPECTED_VSCE_VERSION,
    `installed @vscode/vsce version is ${vscePackage.version}, expected ${EXPECTED_VSCE_VERSION}`);
  const priorEpoch = process.env.SOURCE_DATE_EPOCH;
  const priorTimezone = process.env.TZ;
  process.env.SOURCE_DATE_EPOCH = String(REPRODUCIBLE_SOURCE_DATE_EPOCH);
  process.env.TZ = "UTC";
  try {
    await vsce.createVSIX({
      allowMissingRepository: true,
      allowUnusedFilesPattern: false,
      cwd: extensionRoot,
      dependencies: false,
      followSymlinks: false,
      gitTagVersion: false,
      packagePath: outputPath,
      skipLicense: true,
      updatePackageJson: false,
      useYarn: false,
    });
  } finally {
    restoreEnvironment("SOURCE_DATE_EPOCH", priorEpoch);
    restoreEnvironment("TZ", priorTimezone);
  }
}

export async function buildVSIX(options = {}) {
  const {
    extensionRoot = packageRoot,
    outputPath = DEFAULT_OUTPUT,
  } = options;
  const root = resolve(extensionRoot);
  const output = resolve(outputPath);
  const receipt = resolve(options.receiptPath ?? resolve(
    dirname(output),
    `${EXPECTED_EXTENSION.name}-${EXPECTED_EXTENSION.version}.identity.json`,
  ));
  invariant(basename(output) === EXPECTED_EXTENSION.filename,
    `output filename must be ${EXPECTED_EXTENSION.filename}`);
  invariant(output.toLowerCase() !== receipt.toLowerCase(), "VSIX and identity receipt paths must differ");
  for (const [relativePath, label] of [
    ["package.json", "extension manifest"],
    [".vscodeignore", "closed VSIX allowlist"],
    ["out/extension.cjs", "production extension bundle"],
    ["out/cli-worker.cjs", "production worker bundle"],
    ["runtime/runtime-closure-manifest.json", "runtime closure manifest"],
    ["contracts/policy-contract-identities-1.0.0.json", "contract identity artifact"],
  ]) await assertRegularFile(resolve(root, ...relativePath.split("/")), label);

  await mkdir(dirname(output), { recursive: true });
  await mkdir(dirname(receipt), { recursive: true });
  await rm(output, { force: true });
  await rm(receipt, { force: true });
  try {
    await createReproducibleVSIX(root, output);
    const normalizedBytes = normalizeVSIXArchiveModes(await readFile(output));
    await writeFile(output, normalizedBytes, { flag: "w" });
    const identity = await verifyVSIX(output);
    await writeVSIXIdentityReceipt(receipt, identity);
    return Object.freeze({
      outputPath: output,
      receipt: identity,
      receiptPath: receipt,
    });
  } catch (error) {
    await Promise.allSettled([
      rm(output, { force: true }),
      rm(receipt, { force: true }),
    ]);
    throw error;
  }
}

function parseArguments(arguments_) {
  const values = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const name = arguments_[index];
    invariant(name === "--output" || name === "--receipt", `unsupported argument: ${name}`);
    invariant(!Object.hasOwn(values, name), `duplicate argument: ${name}`);
    const value = arguments_[index + 1];
    invariant(typeof value === "string" && value.length > 0 && !value.startsWith("--"),
      `missing value for ${name}`);
    invariant(!/[\0\r\n]/u.test(value), `invalid scalar value for ${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

function summary(result) {
  const { receipt } = result;
  return Object.freeze({
    contractIdentityDigest: receipt.contractIdentityArtifact.rawSha256,
    extensionId: receipt.extension.id,
    extensionVersion: receipt.extension.version,
    packageEntryCount: receipt.packageInventory.entryCount,
    packageInventoryDigest: receipt.packageInventory.digest,
    receiptFilename: basename(result.receiptPath),
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
    const result = await buildVSIX({
      ...(options["--output"] === undefined ? {} : { outputPath: options["--output"] }),
      ...(options["--receipt"] === undefined ? {} : { receiptPath: options["--receipt"] }),
    });
    process.stdout.write(`${canonicalJson(summary(result))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
