import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rm,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { MemoryOSAdapterError } from "../errors.js";
import { assertDigest, canonicalJson, compareAscii, rawSha256 } from "./canonical-json.js";
import {
  RUNTIME_CLI_MAIN,
  RUNTIME_CLOSURE_DIGEST,
  RUNTIME_CLOSURE_DIGEST_DOMAIN,
  RUNTIME_CLOSURE_ENTRY_COUNT,
  RUNTIME_CLOSURE_INVENTORY_DIGEST,
  RUNTIME_CLOSURE_MANIFEST_FILE,
  RUNTIME_CLOSURE_MANIFEST_KIND,
  RUNTIME_CLOSURE_MANIFEST_RAW_SHA256,
  RUNTIME_CLOSURE_MANIFEST_VERSION,
} from "./runtime-contract.js";

const PORTABLE_PATH = /^[a-z0-9][a-z0-9._/-]*$/u;
const COPY_BUFFER_BYTES = 65_536;
const SNAPSHOT_PREFIX = "memoryos-vscode-runtime-";

export interface RuntimeClosureEntry {
  readonly byteLength: number;
  readonly path: string;
  readonly sha256: string;
}

export interface RuntimeClosureManifest {
  readonly files: readonly RuntimeClosureEntry[];
  readonly inventoryDigest: string;
  readonly kind: typeof RUNTIME_CLOSURE_MANIFEST_KIND;
  readonly version: typeof RUNTIME_CLOSURE_MANIFEST_VERSION;
}

export interface VerifiedRuntimeSnapshot {
  readonly closureDigest: string;
  readonly entryCount: number;
  readonly mainModulePath: string;
  readonly root: string;
  dispose(): Promise<void>;
}

function integrityError(message: string, cause?: unknown): MemoryOSAdapterError {
  return new MemoryOSAdapterError(
    "MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH",
    message,
    cause === undefined ? undefined : { cause },
  );
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort(compareAscii);
  const wanted = [...expected].sort(compareAscii);
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw integrityError(`${label} has an unexpected member set.`);
  }
}

function plainRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw integrityError(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function normalizedPortablePath(value: unknown, label: string): string {
  if (typeof value !== "string"
      || !PORTABLE_PATH.test(value)
      || value.includes("//")
      || value.includes("\\")
      || value.split("/").some((part) => part === "." || part === "..")) {
    throw integrityError(`${label} is not a normalized lowercase portable path.`);
  }
  return value;
}

export function parseRuntimeClosureManifest(bytes: Uint8Array): RuntimeClosureManifest {
  if (rawSha256(bytes) !== RUNTIME_CLOSURE_MANIFEST_RAW_SHA256) {
    throw integrityError("The packaged runtime manifest byte identity does not match the frozen manifest.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (cause) {
    throw integrityError("The packaged runtime manifest is not valid UTF-8 JSON.", cause);
  }
  const record = plainRecord(parsed, "Runtime closure manifest");
  exactKeys(record, ["files", "inventoryDigest", "kind", "version"], "Runtime closure manifest");
  if (record.kind !== RUNTIME_CLOSURE_MANIFEST_KIND
      || record.version !== RUNTIME_CLOSURE_MANIFEST_VERSION) {
    throw integrityError("The runtime closure manifest schema identity is unsupported.");
  }
  if (!Array.isArray(record.files) || record.files.length !== RUNTIME_CLOSURE_ENTRY_COUNT) {
    throw integrityError("The runtime closure manifest has an unexpected entry count.");
  }
  const files = record.files.map((value, index): RuntimeClosureEntry => {
    const entry = plainRecord(value, `Runtime closure entry ${index}`);
    exactKeys(entry, ["byteLength", "path", "sha256"], `Runtime closure entry ${index}`);
    const path = normalizedPortablePath(entry.path, `Runtime closure entry ${index} path`);
    if (!Number.isSafeInteger(entry.byteLength) || (entry.byteLength as number) < 1) {
      throw integrityError(`Runtime closure entry '${path}' has an invalid byte length.`);
    }
    try {
      assertDigest(entry.sha256, `Runtime closure entry '${path}' digest`);
    } catch (cause) {
      throw integrityError(`Runtime closure entry '${path}' has an invalid digest.`, cause);
    }
    return Object.freeze({
      byteLength: entry.byteLength as number,
      path,
      sha256: entry.sha256,
    });
  });
  const paths = files.map(({ path }) => path);
  const sorted = [...paths].sort(compareAscii);
  if (new Set(paths).size !== paths.length || JSON.stringify(paths) !== JSON.stringify(sorted)) {
    throw integrityError("Runtime closure paths must be unique and in canonical ASCII order.");
  }
  try {
    assertDigest(record.inventoryDigest, "Runtime closure inventory digest");
  } catch (cause) {
    throw integrityError("The runtime closure inventory digest is malformed.", cause);
  }
  const computedInventory = rawSha256(Buffer.from(canonicalJson(files), "utf8"));
  if (computedInventory !== record.inventoryDigest
      || record.inventoryDigest !== RUNTIME_CLOSURE_INVENTORY_DIGEST) {
    throw integrityError("The runtime closure inventory digest does not match the frozen inventory.");
  }
  const manifest: RuntimeClosureManifest = Object.freeze({
    files: Object.freeze(files),
    inventoryDigest: record.inventoryDigest,
    kind: RUNTIME_CLOSURE_MANIFEST_KIND,
    version: RUNTIME_CLOSURE_MANIFEST_VERSION,
  });
  const canonicalBytes = Buffer.from(canonicalJson(manifest), "utf8");
  if (!Buffer.from(bytes).equals(canonicalBytes)) {
    throw integrityError("The runtime closure manifest is not its exact canonical representation.");
  }
  const closureDigest = rawSha256(Buffer.concat([
    Buffer.from(RUNTIME_CLOSURE_DIGEST_DOMAIN, "utf8"),
    canonicalBytes,
  ]));
  if (closureDigest !== RUNTIME_CLOSURE_DIGEST) {
    throw integrityError("The runtime closure identity does not match the frozen closure identity.");
  }
  return manifest;
}

function assertChild(root: string, target: string, label: string): void {
  const child = relative(root, target);
  if (child.length === 0 || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw integrityError(`${label} escaped the runtime closure root.`);
  }
}

function memberPath(root: string, portable: string): string {
  const target = resolve(root, ...portable.split("/"));
  assertChild(root, target, `Runtime member '${portable}'`);
  return target;
}

async function requireDirectory(path: string, label: string): Promise<void> {
  let status;
  try {
    status = await lstat(path);
  } catch (cause) {
    throw integrityError(`${label} is missing or inaccessible.`, cause);
  }
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw integrityError(`${label} must be a non-symbolic directory.`);
  }
}

async function requireRegularFile(path: string, label: string): Promise<Awaited<ReturnType<typeof lstat>>> {
  let status;
  try {
    status = await lstat(path);
  } catch (cause) {
    throw integrityError(`${label} is missing or inaccessible.`, cause);
  }
  if (status.isSymbolicLink() || !status.isFile()) {
    throw integrityError(`${label} must be a regular non-symbolic file.`);
  }
  return status;
}

async function walkClosedTree(root: string): Promise<{ files: string[]; directories: string[] }> {
  const files: string[] = [];
  const directories: string[] = [];
  let memberCount = 0;
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 16) throw integrityError("The packaged runtime tree exceeds its closed depth bound.");
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (cause) {
      throw integrityError(`Unable to enumerate packaged runtime directory '${directory}'.`, cause);
    }
    entries.sort((left, right) => compareAscii(left.name, right.name));
    for (const entry of entries) {
      memberCount += 1;
      if (memberCount > 128) {
        throw integrityError("The packaged runtime tree exceeds its closed enumeration bound.");
      }
      const path = resolve(directory, entry.name);
      assertChild(root, path, `Packaged runtime member '${entry.name}'`);
      const status = await requireRegularOrDirectory(path);
      const portable = relative(root, path).split(sep).join("/");
      normalizedPortablePath(portable, `Packaged runtime member '${portable}'`);
      if (status === "directory") {
        directories.push(portable);
        await visit(path, depth + 1);
      } else {
        files.push(portable);
      }
    }
  };
  await visit(root, 0);
  return { files, directories };
}

async function readStableManifest(path: string): Promise<Buffer> {
  let handle;
  try {
    const before = await lstat(path, { bigint: true });
    if (before.isSymbolicLink() || !before.isFile()
        || before.size < 1n || before.size > 1_048_576n) {
      throw new Error("runtime manifest metadata mismatch");
    }
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    handle = await open(path, constants.O_RDONLY | noFollow);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.size !== before.size
        || (before.ino !== 0n && opened.ino !== 0n && before.ino !== opened.ino)
        || (before.dev !== 0n && opened.dev !== 0n && before.dev !== opened.dev)
        || opened.mtimeNs !== before.mtimeNs || opened.ctimeNs !== before.ctimeNs) {
      throw new Error("runtime manifest changed while opening");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (BigInt(bytes.length) !== before.size || after.size !== before.size
        || (before.ino !== 0n && after.ino !== 0n && before.ino !== after.ino)
        || (before.dev !== 0n && after.dev !== 0n && before.dev !== after.dev)
        || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs) {
      throw new Error("runtime manifest changed while reading");
    }
    return bytes;
  } catch (cause) {
    if (cause instanceof MemoryOSAdapterError) throw cause;
    throw integrityError("The packaged runtime manifest is inaccessible or substituted.", cause);
  } finally {
    await handle?.close();
  }
}

async function requireRegularOrDirectory(path: string): Promise<"file" | "directory"> {
  let status;
  try {
    status = await lstat(path);
  } catch (cause) {
    throw integrityError(`Packaged runtime member '${path}' is inaccessible.`, cause);
  }
  if (status.isSymbolicLink()) throw integrityError(`Packaged runtime member '${path}' is symbolic.`);
  if (status.isDirectory()) return "directory";
  if (status.isFile()) return "file";
  throw integrityError(`Packaged runtime member '${path}' is not a regular file or directory.`);
}

function expectedDirectories(files: readonly RuntimeClosureEntry[]): Set<string> {
  const result = new Set<string>();
  for (const { path } of files) {
    const parts = path.split("/");
    for (let count = 1; count < parts.length; count += 1) {
      result.add(parts.slice(0, count).join("/"));
    }
  }
  return result;
}

function assertClosedTree(
  tree: { files: readonly string[]; directories: readonly string[] },
  manifest: RuntimeClosureManifest,
): void {
  const expectedFiles = new Set([RUNTIME_CLOSURE_MANIFEST_FILE, ...manifest.files.map(({ path }) => path)]);
  const expectedDirs = expectedDirectories(manifest.files);
  const actualFiles = new Set(tree.files);
  const actualDirs = new Set(tree.directories);
  const missing = [...expectedFiles].filter((path) => !actualFiles.has(path)).sort(compareAscii);
  const unexpected = [...actualFiles].filter((path) => !expectedFiles.has(path)).sort(compareAscii);
  const missingDirs = [...expectedDirs].filter((path) => !actualDirs.has(path)).sort(compareAscii);
  const unexpectedDirs = [...actualDirs].filter((path) => !expectedDirs.has(path)).sort(compareAscii);
  if (missing.length || unexpected.length || missingDirs.length || unexpectedDirs.length) {
    throw integrityError([
      "The packaged runtime tree is not the closed frozen inventory.",
      ...(missing.length ? [`Missing files: ${missing.join(", ")}.`] : []),
      ...(unexpected.length ? [`Unexpected files: ${unexpected.join(", ")}.`] : []),
      ...(missingDirs.length ? [`Missing directories: ${missingDirs.join(", ")}.`] : []),
      ...(unexpectedDirs.length ? [`Unexpected directories: ${unexpectedDirs.join(", ")}.`] : []),
    ].join(" "));
  }
}

async function copyVerifiedEntry(
  packagedRoot: string,
  snapshotRoot: string,
  entry: RuntimeClosureEntry,
): Promise<void> {
  const sourcePath = memberPath(packagedRoot, entry.path);
  const destinationPath = memberPath(snapshotRoot, entry.path);
  const before = await requireRegularFile(sourcePath, `Packaged runtime member '${entry.path}'`);
  if (before.size !== entry.byteLength) {
    throw integrityError(`Packaged runtime member '${entry.path}' has an unexpected byte length.`);
  }
  await mkdir(dirname(destinationPath), { recursive: true, mode: 0o700 });
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let source;
  let destination;
  try {
    source = await open(sourcePath, constants.O_RDONLY | noFollow);
    const opened = await source.stat();
    if (!opened.isFile() || opened.size !== entry.byteLength
        || (before.ino !== 0 && opened.ino !== 0 && before.ino !== opened.ino)
        || (before.dev !== 0 && opened.dev !== 0 && before.dev !== opened.dev)) {
      throw integrityError(`Packaged runtime member '${entry.path}' changed during acquisition.`);
    }
    destination = await open(
      destinationPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o400,
    );
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(COPY_BUFFER_BYTES);
    let total = 0;
    while (true) {
      const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > entry.byteLength) {
        throw integrityError(`Packaged runtime member '${entry.path}' grew during acquisition.`);
      }
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      let offset = 0;
      while (offset < chunk.length) {
        const written = await destination.write(chunk, offset, chunk.length - offset);
        if (written.bytesWritten < 1) {
          throw integrityError(`Unable to finish snapshotting runtime member '${entry.path}'.`);
        }
        offset += written.bytesWritten;
      }
    }
    const digest = `sha256:${hash.digest("hex")}`;
    if (total !== entry.byteLength || digest !== entry.sha256) {
      throw integrityError(`Packaged runtime member '${entry.path}' failed byte identity verification.`);
    }
    await destination.sync();
  } catch (cause) {
    if (cause instanceof MemoryOSAdapterError) throw cause;
    throw integrityError(`Unable to snapshot packaged runtime member '${entry.path}'.`, cause);
  } finally {
    await Promise.allSettled([source?.close(), destination?.close()]);
  }
  await chmod(destinationPath, 0o400);
}

function disposableSnapshot(root: string): VerifiedRuntimeSnapshot {
  let disposed = false;
  return Object.freeze({
    closureDigest: RUNTIME_CLOSURE_DIGEST,
    entryCount: RUNTIME_CLOSURE_ENTRY_COUNT,
    mainModulePath: memberPath(root, RUNTIME_CLI_MAIN),
    root,
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      const temporaryRoot = resolve(tmpdir());
      const expectedParent = relative(temporaryRoot, root);
      if (dirname(root) !== temporaryRoot
          || !expectedParent.startsWith(SNAPSHOT_PREFIX)
          || expectedParent.includes(sep)) {
        throw integrityError("Refusing to remove an unrecognized runtime snapshot path.");
      }
      await restoreSnapshotDirectoryPermissions(root);
      await rm(root, { force: true, recursive: true });
    },
  });
}

async function restoreSnapshotDirectoryPermissions(root: string): Promise<void> {
  const visit = async (directory: string): Promise<void> => {
    const status = await lstat(directory);
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw integrityError("The private runtime snapshot directory shape changed before disposal.");
    }
    await chmod(directory, 0o700);
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await visit(resolve(directory, entry.name));
    }
  };
  await visit(root);
}

export async function verifyAndSnapshotRuntime(packagedRuntimeRoot: string): Promise<VerifiedRuntimeSnapshot> {
  const resolvedRoot = resolve(packagedRuntimeRoot);
  await requireDirectory(resolvedRoot, "Packaged runtime root");
  const manifestPath = memberPath(resolvedRoot, RUNTIME_CLOSURE_MANIFEST_FILE);
  const manifestBytes = await readStableManifest(manifestPath);
  const manifest = parseRuntimeClosureManifest(manifestBytes);
  assertClosedTree(await walkClosedTree(resolvedRoot), manifest);

  const snapshotRoot = await mkdtemp(join(tmpdir(), SNAPSHOT_PREFIX));
  await chmod(snapshotRoot, 0o700);
  try {
    await writeManifestSnapshot(snapshotRoot, manifestBytes);
    for (const entry of manifest.files) {
      await copyVerifiedEntry(resolvedRoot, snapshotRoot, entry);
    }
    for (const path of [...expectedDirectories(manifest.files)].sort((left, right) => (
      right.split("/").length - left.split("/").length || compareAscii(right, left)
    ))) {
      await chmod(memberPath(snapshotRoot, path), 0o500);
    }
    await chmod(snapshotRoot, 0o500);
    return disposableSnapshot(snapshotRoot);
  } catch (cause) {
    await restoreSnapshotDirectoryPermissions(snapshotRoot).catch(() => undefined);
    await rm(snapshotRoot, { force: true, recursive: true });
    if (cause instanceof MemoryOSAdapterError) throw cause;
    throw integrityError("Unable to construct the private runtime snapshot.", cause);
  }
}

async function writeManifestSnapshot(snapshotRoot: string, bytes: Uint8Array): Promise<void> {
  const path = memberPath(snapshotRoot, RUNTIME_CLOSURE_MANIFEST_FILE);
  let handle;
  try {
    handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o400);
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (cause) {
    throw integrityError("Unable to write the private runtime manifest snapshot.", cause);
  } finally {
    await handle?.close();
  }
  await chmod(path, 0o400);
}
