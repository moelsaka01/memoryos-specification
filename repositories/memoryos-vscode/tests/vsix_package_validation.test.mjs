import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import yauzl from "yauzl";

import { buildVSIX, normalizeVSIXArchiveModes } from "../scripts/package-vsix.mjs";
import {
  EXPECTED_CONTRACT,
  EXPECTED_ARCHIVE_MODE,
  EXPECTED_EXTENSION,
  EXPECTED_RUNTIME,
  REPRODUCIBLE_SOURCE_DATE_EPOCH,
  REPRODUCIBLE_TIMESTAMP,
  VSIX_LIMITS,
  assertNoForbiddenPackagePath,
  assertSafeArchivePath,
  encodeVSIXIdentityReceipt,
  validateArchiveEntryMetadata,
  verifyVSIX,
  verifyVSIXBytes,
  verifyVSIXIdentityReceipt,
} from "../scripts/verify-vsix.mjs";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function createFixture(root) {
  const fixture = join(root, "extension");
  await mkdir(join(fixture, "out"), { recursive: true });
  for (const name of ["package.json", "README.md", "CHANGELOG.md", ".vscodeignore"]) {
    await cp(join(extensionRoot, name), join(fixture, name));
  }
  for (const name of ["contracts", "runtime"]) {
    await cp(join(extensionRoot, name), join(fixture, name), { recursive: true });
  }
  await writeFile(
    join(fixture, "out", "extension.cjs"),
    "'use strict';\nexports.activate = () => undefined;\nexports.deactivate = () => undefined;\n",
    "utf8",
  );
  await writeFile(join(fixture, "out", "cli-worker.cjs"), "'use strict';\n", "utf8");
  return fixture;
}

async function setFixtureFileModes(root, mode) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) await setFixtureFileModes(path, mode);
    else if (entry.isFile()) await chmod(path, mode);
  }
}

async function archiveModes(bytes) {
  const zip = await yauzl.fromBufferPromise(Buffer.from(bytes), {
    autoClose: false,
    decodeStrings: true,
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  const modes = [];
  try {
    for await (const entry of zip.eachEntry()) {
      modes.push(entry.externalFileAttributes >>> 16);
    }
    return modes;
  } finally {
    if (zip.isOpen) zip.close();
  }
}

function denormalizeArchiveModes(input) {
  const bytes = Buffer.from(input);
  const eocdOffset = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(eocdOffset), 0x06054b50);
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  let cursor = bytes.readUInt32LE(eocdOffset + 16);
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    const versionMadeBy = bytes.readUInt16LE(cursor + 4);
    bytes.writeUInt16LE(versionMadeBy & 0xff, cursor + 4);
    bytes.writeUInt32LE((0o100666 << 16) >>> 0, cursor + 38);
    cursor += 46
      + bytes.readUInt16LE(cursor + 28)
      + bytes.readUInt16LE(cursor + 30)
      + bytes.readUInt16LE(cursor + 32);
  }
  assert.equal(cursor, eocdOffset);
  return bytes;
}

function archiveEntry(fileName, overrides = {}) {
  return {
    compressedSize: 1,
    compressionMethod: 8,
    externalFileAttributes: (0o100644 << 16) >>> 0,
    fileComment: "",
    fileName,
    generalPurposeBitFlag: 0,
    getLastModDate: () => new Date(REPRODUCIBLE_TIMESTAMP),
    isEncrypted: () => false,
    uncompressedSize: 1,
    versionMadeBy: (3 << 8) | 45,
    ...overrides,
  };
}

test("package builder emits reproducible validated VSIX bytes and a canonical external receipt", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "memoryos-vsix-validation-"));
  t.after(async () => rm(root, { force: true, recursive: true }));
  const fixture = await createFixture(root);
  const firstDirectory = join(root, "first");
  const secondDirectory = join(root, "second");
  const firstVSIX = join(firstDirectory, EXPECTED_EXTENSION.filename);
  const secondVSIX = join(secondDirectory, EXPECTED_EXTENSION.filename);
  const firstReceipt = join(firstDirectory, "memoryos-0.1.0.identity.json");
  const secondReceipt = join(secondDirectory, "memoryos-0.1.0.identity.json");

  const priorEpoch = process.env.SOURCE_DATE_EPOCH;
  const priorTimezone = process.env.TZ;
  let first;
  let second;
  try {
    process.env.SOURCE_DATE_EPOCH = "946684800";
    process.env.TZ = "Pacific/Kiritimati";
    first = await buildVSIX({ extensionRoot: fixture, outputPath: firstVSIX, receiptPath: firstReceipt });
    assert.equal(process.env.SOURCE_DATE_EPOCH, "946684800");
    assert.equal(process.env.TZ, "Pacific/Kiritimati");

    process.env.TZ = "America/Los_Angeles";
    await setFixtureFileModes(fixture, 0o600);
    second = await buildVSIX({ extensionRoot: fixture, outputPath: secondVSIX, receiptPath: secondReceipt });
    assert.equal(process.env.SOURCE_DATE_EPOCH, "946684800");
    assert.equal(process.env.TZ, "America/Los_Angeles");
  } finally {
    restoreEnvironment("SOURCE_DATE_EPOCH", priorEpoch);
    restoreEnvironment("TZ", priorTimezone);
  }

  const [firstBytes, secondBytes, firstReceiptBytes, secondReceiptBytes] = await Promise.all([
    readFile(firstVSIX),
    readFile(secondVSIX),
    readFile(firstReceipt),
    readFile(secondReceipt),
  ]);
  assert.deepEqual(firstBytes, secondBytes);
  assert.ok((await archiveModes(firstBytes)).every((mode) => mode === EXPECTED_ARCHIVE_MODE));
  const nonPortableBytes = denormalizeArchiveModes(firstBytes);
  assert.notDeepEqual(nonPortableBytes, firstBytes);
  assert.deepEqual(normalizeVSIXArchiveModes(nonPortableBytes), firstBytes);
  assert.deepEqual(first.receipt, second.receipt);
  assert.deepEqual(firstReceiptBytes, secondReceiptBytes);
  assert.deepEqual(firstReceiptBytes, encodeVSIXIdentityReceipt(first.receipt));
  assert.ok(firstReceiptBytes.length <= VSIX_LIMITS.receiptBytes);
  assert.ok(firstReceiptBytes.at(-1) === 0x0a);
  assert.ok(!firstReceiptBytes.subarray(0, -1).includes(0x0a));
  assert.ok(!firstReceiptBytes.includes(0x0d));

  const { filename: _filename, ...expectedIdentity } = EXPECTED_EXTENSION;
  assert.deepEqual(first.receipt.extension, expectedIdentity);
  assert.equal(first.receipt.kind, "MemoryOSVSCodeVSIXIdentityReceipt");
  assert.equal(first.receipt.version, "1.0.0");
  assert.equal(first.receipt.vsix.filename, EXPECTED_EXTENSION.filename);
  assert.equal(first.receipt.vsix.byteLength, firstBytes.length);
  assert.match(first.receipt.vsix.sha256, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(first.receipt.packageInventory.entryCount, 46);
  assert.equal(first.receipt.packageInventory.files.length, 46);
  assert.match(first.receipt.packageInventory.digest, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(
    first.receipt.packageInventory.files.map(({ path }) => path),
    [...first.receipt.packageInventory.files.map(({ path }) => path)].sort(),
  );
  assert.equal(
    new Set(first.receipt.packageInventory.files.map(({ path }) => path.toLowerCase())).size,
    first.receipt.packageInventory.entryCount,
  );
  assert.ok(first.receipt.packageInventory.files.some(({ path }) => path === "extension/readme.md"));
  assert.ok(first.receipt.packageInventory.files.some(({ path }) => path === "extension/changelog.md"));
  assert.ok(!first.receipt.packageInventory.files.some(({ path }) => path.endsWith(".identity.json")));
  assert.deepEqual(first.receipt.runtimeClosure, {
    entryCount: EXPECTED_RUNTIME.entryCount,
    inventoryDigest: EXPECTED_RUNTIME.inventoryDigest,
    manifestRawSha256: EXPECTED_RUNTIME.manifestRawSha256,
    runtimeClosureDigest: EXPECTED_RUNTIME.closureDigest,
  });
  assert.deepEqual(first.receipt.contractIdentityArtifact, {
    byteLength: 932,
    path: EXPECTED_CONTRACT.path,
    rawSha256: EXPECTED_CONTRACT.rawSha256,
  });
  assert.deepEqual(first.receipt.reproducibleBuild, {
    sourceDateEpoch: REPRODUCIBLE_SOURCE_DATE_EPOCH,
    timestamp: REPRODUCIBLE_TIMESTAMP,
    timezone: "UTC",
    validator: "yauzl@3.4.0",
    vsce: "@vscode/vsce@4.0.0",
  });
  assert.deepEqual(await verifyVSIX(firstVSIX), first.receipt);
  assert.deepEqual(await verifyVSIXBytes(firstBytes), first.receipt);
  assert.deepEqual(await verifyVSIXIdentityReceipt(firstVSIX, firstReceipt), first.receipt);
  const verifierSource = await readFile(join(extensionRoot, "scripts", "verify-vsix.mjs"), "utf8");
  assert.doesNotMatch(verifierSource, /yauzl\.openPromise/u);
  assert.match(verifierSource, /readArchiveMembers\(vsixBytes\)/u);

  const alteredReceipt = structuredClone(first.receipt);
  alteredReceipt.vsix.byteLength += 1;
  await writeFile(firstReceipt, encodeVSIXIdentityReceipt(alteredReceipt));
  await assert.rejects(
    verifyVSIXIdentityReceipt(firstVSIX, firstReceipt),
    /VSIX identity receipt differs from actual archive bytes/u,
  );
});

test("archive member policy rejects unsafe, forbidden, duplicate, and hostile metadata", () => {
  for (const path of [
    "../evil.js",
    "/absolute.js",
    "C:/absolute.js",
    "extension\\evil.js",
    "extension//evil.js",
    "extension/./evil.js",
    "extension/../evil.js",
    "extension/evil\u202e.js",
  ]) assert.throws(() => assertSafeArchivePath(path), /VSIX validation failed/u);

  for (const path of [
    "extension/.git/config",
    "extension/cache/item.json",
    "extension/evidence/item.json",
    "extension/maps/item.js",
    "extension/measurements/item.json",
    "extension/node_modules/item/index.js",
    "extension/scripts/item.mjs",
    "extension/src/item.ts",
    "extension/tests/item.test.js",
  ]) assert.throws(() => assertNoForbiddenPackagePath(path), /VSIX validation failed/u);
  assert.doesNotThrow(() => assertNoForbiddenPackagePath(
    "extension/runtime/vendor/repositories/memoryos-cli/src/main.js",
  ));

  const exactPaths = new Set();
  const foldedPaths = new Map();
  validateArchiveEntryMetadata(archiveEntry("extension/file.js"), exactPaths, foldedPaths);
  assert.throws(
    () => validateArchiveEntryMetadata(archiveEntry("extension/file.js"), exactPaths, foldedPaths),
    /duplicate archive member/u,
  );
  assert.throws(
    () => validateArchiveEntryMetadata(archiveEntry("extension/FILE.js"), exactPaths, foldedPaths),
    /case-colliding archive members/u,
  );

  for (const [entry, pattern] of [
    [archiveEntry("extension/encrypted.js", { generalPurposeBitFlag: 1 }), /encrypted archive member/u],
    [archiveEntry("extension/unsupported.js", { compressionMethod: 12 }), /unsupported compression method/u],
    [archiveEntry("extension/large.js", { uncompressedSize: VSIX_LIMITS.memberBytes + 1 }), /exceeds its bound/u],
    [archiveEntry("extension/comment.js", { fileComment: "comment" }), /archive member has a comment/u],
    [archiveEntry("extension/link.js", { externalFileAttributes: (0o120777 << 16) >>> 0 }), /symbolic-link/u],
    [archiveEntry("extension/directory", { externalFileAttributes: 0x10 }), /directory archive member/u],
    [archiveEntry("extension/device", { externalFileAttributes: (0o020666 << 16) >>> 0 }), /non-regular Unix/u],
    [archiveEntry("extension/non-unix.js", { versionMadeBy: 45 }), /not Unix-mode normalized/u],
    [archiveEntry("extension/writable.js", { externalFileAttributes: (0o100666 << 16) >>> 0 }), /frozen regular-file mode/u],
    [archiveEntry("extension/time.js", { getLastModDate: () => new Date("2000-01-01T00:00:00.000Z") }), /SOURCE_DATE_EPOCH/u],
  ]) assert.throws(() => validateArchiveEntryMetadata(entry), pattern);
});
