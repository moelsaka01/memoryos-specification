import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(TOOL_DIRECTORY, "..", "..", "..");
const ACTION_ROOT = resolve(WORKSPACE_ROOT, ".github", "actions", "memoryos-policy-gate");
const VENDOR_ROOT = resolve(ACTION_ROOT, "dist", "vendor");
const DISTRIBUTION_MANIFEST_PATH = resolve(ACTION_ROOT, "distribution-manifest.json");

const CLI_MAIN = "repositories/memoryos-cli/src/main.js";
const EXPECTED_CLI_CLOSURE = Object.freeze([
  "repositories/cca-studio/web/data/studio-snapshot.js",
  "repositories/cca-studio/web/js/cognitive-comparative-reconstruction.js",
  "repositories/cca-studio/web/js/cognitive-comparative-replay.js",
  "repositories/cca-studio/web/js/cognitive-evolution-controller.js",
  "repositories/cca-studio/web/js/cognitive-evolution.js",
  "repositories/cca-studio/web/js/cognitive-investigation-explorer.js",
  "repositories/cca-studio/web/js/cognitive-regression.js",
  "repositories/cca-studio/web/js/cognitive-replay.js",
  "repositories/cca-studio/web/js/cognitive-trace.js",
  "repositories/cca-studio/web/js/deterministic-sequence-alignment.js",
  "repositories/cca-studio/web/js/investigation-core.js",
  "repositories/cca-studio/web/js/investigation-policy-contracts.js",
  "repositories/cca-studio/web/js/investigation-policy-engine.js",
  "repositories/cca-studio/web/js/investigation-policy-integration.js",
  "repositories/cca-studio/web/js/investigation-policy.js",
  "repositories/cca-studio/web/js/memory-investigation-package.js",
  "repositories/cca-studio/web/js/memoryos-sdk.js",
  "repositories/cca-studio/web/js/mip-canonical.js",
  "repositories/cca-studio/web/js/observation-timeline.js",
  "repositories/cca-studio/web/js/policy-canonical.js",
  "repositories/cca-studio/web/js/policy-fact-context.js",
  "repositories/cca-studio/web/js/regression-policy-fact-source.js",
  "repositories/cca-studio/web/js/semantic-world.js",
  "repositories/cca-studio/web/js/studio-model.js",
  "repositories/memoryos-cli/src/arguments.js",
  "repositories/memoryos-cli/src/commands.js",
  "repositories/memoryos-cli/src/errors.js",
  "repositories/memoryos-cli/src/help.js",
  "repositories/memoryos-cli/src/main.js",
  "repositories/memoryos-cli/src/output.js",
  "repositories/memoryos-cli/src/policy-arguments.js",
  "repositories/memoryos-cli/src/policy-commands.js",
  "repositories/memoryos-cli/src/policy-publication.js",
  "repositories/memoryos-cli/src/session.js",
  "repositories/memoryos-cli/src/version.js",
]);

const ESM_PACKAGE_BOUNDARIES = Object.freeze([
  "repositories/cca-studio/package.json",
  "repositories/memoryos-cli/package.json",
]);

const VENDORED_SOURCE_FILES = Object.freeze([
  ...EXPECTED_CLI_CLOSURE,
  ...ESM_PACKAGE_BOUNDARIES,
].sort(compareAscii));

const ACTION_FILES = Object.freeze(new Map([
  ["action.yml", "actionMetadata"],
  ["dist/action-runtime.mjs", "runtimeModule"],
  ["dist/cli-driver.mjs", "runtimeModule"],
  ["dist/contracts/policy-contract-identities-1.0.0.json", "contractData"],
  ["dist/index.js", "entrypoint"],
]));

const MANIFEST_KIND = "MemoryOSGitHubPolicyGateDistributionManifest";
const MANIFEST_VERSION = "1.0.0";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const PORTABLE_PATH_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/u;
const STATIC_IMPORT_PATTERN = /(?:^|\n)\s*import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']\s*;?/gu;
const STATIC_EXPORT_PATTERN = /(?:^|\n)\s*export\s+[^;]*?\s+from\s+["']([^"']+)["']\s*;?/gu;

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPortablePath(value) {
  return value.split(sep).join("/");
}

function assertWithin(root, target, label) {
  const child = relative(root, target);
  if (child.length === 0 || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error(`${label} must remain below '${root}'.`);
  }
}

function sourcePath(relativePath) {
  const result = resolve(WORKSPACE_ROOT, ...relativePath.split("/"));
  assertWithin(WORKSPACE_ROOT, result, `Source path '${relativePath}'`);
  return result;
}

function vendorPath(relativePath) {
  const result = resolve(VENDOR_ROOT, ...relativePath.split("/"));
  assertWithin(VENDOR_ROOT, result, `Vendor path '${relativePath}'`);
  return result;
}

async function requireRegularFile(path, label) {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(`${label} must be a regular non-symbolic file.`);
  }
  return status;
}

async function requireDirectory(path, label) {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`${label} must be a non-symbolic directory.`);
  }
}

async function ensureChildDirectory(parent, name, label) {
  const path = resolve(parent, name);
  assertWithin(parent, path, label);
  try {
    await requireDirectory(path, label);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(path);
    await requireDirectory(path, label);
  }
  return path;
}

function importSpecifiers(source) {
  const result = new Set();
  for (const pattern of [STATIC_IMPORT_PATTERN, STATIC_EXPORT_PATTERN]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) result.add(match[1]);
  }
  return [...result].sort(compareAscii);
}

async function computeCliClosure() {
  const pending = [CLI_MAIN];
  const visited = new Set();
  while (pending.length > 0) {
    const relativePath = pending.shift();
    if (visited.has(relativePath)) continue;
    visited.add(relativePath);

    const absolutePath = sourcePath(relativePath);
    await requireRegularFile(absolutePath, `CLI source '${relativePath}'`);
    const source = await readFile(absolutePath, "utf8");
    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith("node:")) continue;
      if (!specifier.startsWith(".")) {
        throw new Error(
          `CLI source '${relativePath}' has unsupported package import '${specifier}'.`,
        );
      }
      const dependency = resolve(dirname(absolutePath), specifier);
      assertWithin(WORKSPACE_ROOT, dependency, `CLI dependency '${specifier}'`);
      pending.push(toPortablePath(relative(WORKSPACE_ROOT, dependency)));
    }
  }
  return [...visited].sort(compareAscii);
}

function assertExactCliClosure(actual) {
  const expected = [...EXPECTED_CLI_CLOSURE].sort(compareAscii);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((path) => !actualSet.has(path));
  const unexpected = actual.filter((path) => !expectedSet.has(path));
  if (expected.length !== 35 || actual.length !== 35 || missing.length > 0 || unexpected.length > 0) {
    throw new Error([
      "The MemoryOS CLI main-module closure differs from the reviewed 35-file closure.",
      `Expected count: ${expected.length}; actual count: ${actual.length}.`,
      ...(missing.length === 0 ? [] : [`Missing: ${missing.join(", ")}`]),
      ...(unexpected.length === 0 ? [] : [`Unexpected: ${unexpected.join(", ")}`]),
    ].join("\n"));
  }
}

async function walkDirectory(root) {
  const files = [];
  const directories = [];
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareAscii(left.name, right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      assertWithin(root, path, `Tree member '${entry.name}'`);
      const status = await lstat(path);
      if (status.isSymbolicLink()) {
        throw new Error(`Distribution tree member '${path}' must not be symbolic.`);
      }
      if (status.isDirectory()) {
        directories.push(path);
        await visit(path);
      } else if (status.isFile()) {
        files.push(path);
      } else {
        throw new Error(`Distribution tree member '${path}' must be a regular file or directory.`);
      }
    }
  };
  await visit(root);
  return { directories, files };
}

async function synchronizeVendorClosure() {
  await requireDirectory(ACTION_ROOT, "MemoryOS Policy Gate Action root");
  const distributionDirectory = await ensureChildDirectory(
    ACTION_ROOT,
    "dist",
    "MemoryOS Policy Gate distribution directory",
  );
  const vendorDirectory = await ensureChildDirectory(
    distributionDirectory,
    "vendor",
    "MemoryOS Policy Gate vendor root",
  );
  if (vendorDirectory !== VENDOR_ROOT) {
    throw new Error("Refusing to operate on an unexpected vendor directory.");
  }
  await requireDirectory(VENDOR_ROOT, "MemoryOS Policy Gate vendor root");

  // Refuse to traverse any pre-existing symbolic or special member before writing.
  await walkDirectory(VENDOR_ROOT);

  for (const relativePath of VENDORED_SOURCE_FILES) {
    const source = sourcePath(relativePath);
    const destination = vendorPath(relativePath);
    await requireRegularFile(source, `Vendored source '${relativePath}'`);
    const sourceBytesBeforeCopy = await readFile(source);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    await requireRegularFile(destination, `Vendored destination '${relativePath}'`);
    const [sourceBytesAfterCopy, destinationBytes] = await Promise.all([
      readFile(source),
      readFile(destination),
    ]);
    if (!sourceBytesBeforeCopy.equals(sourceBytesAfterCopy)
        || !sourceBytesBeforeCopy.equals(destinationBytes)) {
      throw new Error(`Vendored source '${relativePath}' changed or was not copied byte-for-byte.`);
    }
  }

  const expected = new Set(VENDORED_SOURCE_FILES);
  const tree = await walkDirectory(VENDOR_ROOT);
  for (const file of tree.files) {
    const relativePath = toPortablePath(relative(VENDOR_ROOT, file));
    if (!expected.has(relativePath)) {
      assertWithin(VENDOR_ROOT, file, `Stale vendor file '${relativePath}'`);
      await unlink(file);
    }
  }
  for (const directory of [...tree.directories].sort((left, right) => right.length - left.length)) {
    if ((await readdir(directory)).length === 0) {
      assertWithin(VENDOR_ROOT, directory, `Stale vendor directory '${directory}'`);
      await rmdir(directory);
    }
  }

  const finalTree = await walkDirectory(VENDOR_ROOT);
  const actual = finalTree.files
    .map((path) => toPortablePath(relative(VENDOR_ROOT, path)))
    .sort(compareAscii);
  if (JSON.stringify(actual) !== JSON.stringify(VENDORED_SOURCE_FILES)) {
    throw new Error("The generated vendor tree does not equal the reviewed runtime closure.");
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareAscii).map((name) => (
      `${JSON.stringify(name)}:${canonicalJson(value[name])}`
    )).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new TypeError("Distribution manifest integers must be safe integers.");
  }
  if (!["string", "number", "boolean"].includes(typeof value) && value !== null) {
    throw new TypeError("Distribution manifest contains a non-JSON value.");
  }
  return JSON.stringify(value);
}

function rawSha256(bytes) {
  const value = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (!DIGEST_PATTERN.test(value)) throw new Error("Unable to create a valid SHA-256 digest.");
  return value;
}

function manifestRole(path) {
  const directRole = ACTION_FILES.get(path);
  if (directRole !== undefined) return directRole;
  if (path.startsWith("dist/vendor/")) return "runtimeModule";
  throw new Error(`Unexpected production Action file '${path}'.`);
}

async function generateDistributionManifest() {
  const tree = await walkDirectory(ACTION_ROOT);
  const members = tree.files
    .map((path) => ({ path, relativePath: toPortablePath(relative(ACTION_ROOT, path)) }))
    .filter(({ path }) => path !== DISTRIBUTION_MANIFEST_PATH)
    .sort((left, right) => compareAscii(left.relativePath, right.relativePath));

  const expectedPaths = new Set([
    ...ACTION_FILES.keys(),
    ...VENDORED_SOURCE_FILES.map((path) => `dist/vendor/${path}`),
  ]);
  const expectedDirectories = new Set();
  for (const path of expectedPaths) {
    const segments = path.split("/");
    for (let count = 1; count < segments.length; count += 1) {
      expectedDirectories.add(segments.slice(0, count).join("/"));
    }
  }
  const actualPaths = new Set(members.map(({ relativePath }) => relativePath));
  const actualDirectories = new Set(tree.directories.map((path) => (
    toPortablePath(relative(ACTION_ROOT, path))
  )));
  const missing = [...expectedPaths].filter((path) => !actualPaths.has(path)).sort(compareAscii);
  const unexpected = [...actualPaths].filter((path) => !expectedPaths.has(path)).sort(compareAscii);
  const unexpectedDirectories = [...actualDirectories]
    .filter((path) => !expectedDirectories.has(path))
    .sort(compareAscii);
  if (missing.length > 0 || unexpected.length > 0 || unexpectedDirectories.length > 0) {
    throw new Error([
      "The production Action tree differs from the reviewed Phase-1 closure.",
      ...(missing.length === 0 ? [] : [`Missing: ${missing.join(", ")}`]),
      ...(unexpected.length === 0 ? [] : [`Unexpected: ${unexpected.join(", ")}`]),
      ...(unexpectedDirectories.length === 0
        ? []
        : [`Unexpected directories: ${unexpectedDirectories.join(", ")}`]),
    ].join("\n"));
  }

  const files = [];
  for (const member of members) {
    if (!PORTABLE_PATH_PATTERN.test(member.relativePath)
        || member.relativePath.includes("//")
        || member.relativePath.split("/").some((part) => part === "." || part === "..")) {
      throw new Error(`Action member '${member.relativePath}' is not a lowercase ASCII portable path.`);
    }
    const bytes = await readFile(member.path);
    if (bytes.length <= 0 || !Number.isSafeInteger(bytes.length)) {
      throw new Error(`Action member '${member.relativePath}' must have a positive safe byte count.`);
    }
    files.push({
      byteCount: bytes.length,
      path: member.relativePath,
      rawSha256: rawSha256(bytes),
      role: manifestRole(member.relativePath),
    });
  }

  if (files.filter(({ role }) => role === "actionMetadata").length !== 1
      || files.filter(({ role }) => role === "entrypoint").length !== 1) {
    throw new Error("The distribution must contain exactly one Action metadata and one entrypoint member.");
  }

  const manifest = {
    files,
    kind: MANIFEST_KIND,
    version: MANIFEST_VERSION,
  };
  const bytes = Buffer.from(canonicalJson(manifest), "utf8");

  try {
    const existing = await lstat(DISTRIBUTION_MANIFEST_PATH);
    if (existing.isSymbolicLink() || !existing.isFile()) {
      throw new Error("The distribution manifest destination must be a regular non-symbolic file.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(DISTRIBUTION_MANIFEST_PATH, bytes, { mode: 0o600 });
  return { byteCount: bytes.length, fileCount: files.length, rawSha256: rawSha256(bytes) };
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("build-mo1302-action-distribution does not accept arguments.");
  }
  if (VENDOR_ROOT !== resolve(ACTION_ROOT, "dist", "vendor")) {
    throw new Error("Refusing to operate on an unexpected vendor root.");
  }
  await requireDirectory(WORKSPACE_ROOT, "MemoryOS workspace root");
  const actualClosure = await computeCliClosure();
  assertExactCliClosure(actualClosure);
  for (const relativePath of ESM_PACKAGE_BOUNDARIES) {
    await requireRegularFile(sourcePath(relativePath), `ESM package boundary '${relativePath}'`);
  }
  await synchronizeVendorClosure();
  const generated = await generateDistributionManifest();
  process.stdout.write(`${JSON.stringify({
    actionRoot: toPortablePath(relative(WORKSPACE_ROOT, ACTION_ROOT)),
    cliClosureFileCount: EXPECTED_CLI_CLOSURE.length,
    manifestByteCount: generated.byteCount,
    manifestFileCount: generated.fileCount,
    manifestRawSha256: generated.rawSha256,
    packageBoundaryCount: ESM_PACKAGE_BOUNDARIES.length,
    status: "generated",
  })}\n`);
}

await main();
