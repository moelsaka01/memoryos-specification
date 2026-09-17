import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createScanner,
  LanguageVariant,
  SyntaxKind,
} from "typescript/unstable/ast";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const WORKSPACE_ROOT = resolve(EXTENSION_ROOT, "..", "..");
const RUNTIME_ROOT = resolve(EXTENSION_ROOT, "runtime");
const VENDOR_ROOT = resolve(RUNTIME_ROOT, "vendor");
const MANIFEST_PATH = resolve(RUNTIME_ROOT, "runtime-closure-manifest.json");
const CONTRACT_PATH = resolve(
  EXTENSION_ROOT,
  "contracts",
  "policy-contract-identities-1.0.0.json",
);
const RECEIPT_PATH = resolve(
  EXTENSION_ROOT,
  "measurements",
  "runtime-closure-identity-receipt-1.0.0.json",
);

const CLI_MAIN = "repositories/memoryos-cli/src/main.js";
const CLI_CLOSURE = Object.freeze([
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

const PACKAGE_BOUNDARIES = Object.freeze([
  "repositories/cca-studio/package.json",
  "repositories/memoryos-cli/package.json",
]);

const SOURCE_FILES = Object.freeze([...CLI_CLOSURE, ...PACKAGE_BOUNDARIES].sort(compareAscii));
const MANIFEST_KIND = "MemoryOSVSCodeRuntimeClosureManifest";
const MANIFEST_VERSION = "1.0.0";
const RECEIPT_KIND = "MemoryOSVSCodeRuntimeClosureIdentityReceipt";
const RECEIPT_VERSION = "1.0.0";
const CLOSURE_DIGEST_DOMAIN = "MemoryOSVSCodeRuntimeClosureIdentity\u0000";
const PORTABLE_PATH = /^[a-z0-9][a-z0-9._/-]*$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const ALLOWED_NODE_BUILTINS = Object.freeze(new Set(["node:fs", "node:path"]));

function sourceTokens(source) {
  const scanner = createScanner(true, LanguageVariant.Standard, source);
  const tokens = [];
  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
    tokens.push({ kind, text: scanner.getTokenText(), value: scanner.getTokenValue() });
  }
  return tokens;
}

export function hasForbiddenDynamicLoaderCall(source) {
  const tokens = sourceTokens(source);
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    const token = tokens[index];
    if (![SyntaxKind.ImportKeyword, SyntaxKind.RequireKeyword].includes(token.kind)
        || tokens[index + 1].kind !== SyntaxKind.OpenParenToken
        || [SyntaxKind.DotToken, SyntaxKind.QuestionDotToken].includes(tokens[index - 1]?.kind)) {
      continue;
    }
    let depth = 0;
    let closeIndex = -1;
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      if (tokens[cursor].kind === SyntaxKind.OpenParenToken) depth += 1;
      if (tokens[cursor].kind === SyntaxKind.CloseParenToken) depth -= 1;
      if (depth === 0) {
        closeIndex = cursor;
        break;
      }
    }
    if (closeIndex < 0 || tokens[closeIndex + 1]?.kind !== SyntaxKind.OpenBraceToken) return true;
  }
  return false;
}

export function staticImportSpecifiers(source) {
  const tokens = sourceTokens(source);
  const result = new Set();
  const addString = (token) => {
    if (token?.kind === SyntaxKind.StringLiteral) result.add(token.value);
  };
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].kind === SyntaxKind.ImportKeyword) {
      if (tokens[index + 1]?.kind === SyntaxKind.StringLiteral) {
        addString(tokens[index + 1]);
        continue;
      }
      if ([SyntaxKind.OpenParenToken, SyntaxKind.DotToken].includes(tokens[index + 1]?.kind)) continue;
      for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        if (tokens[cursor].kind === SyntaxKind.FromKeyword) {
          if (tokens[cursor + 1]?.kind === SyntaxKind.StringLiteral) {
            addString(tokens[cursor + 1]);
            break;
          }
          continue;
        }
        if (tokens[cursor].kind === SyntaxKind.SemicolonToken) break;
      }
      continue;
    }
    if (tokens[index].kind !== SyntaxKind.ExportKeyword) continue;
    let cursor = index + 1;
    if (tokens[cursor]?.kind === SyntaxKind.AsteriskToken) {
      cursor += 1;
      if (tokens[cursor]?.kind === SyntaxKind.AsKeyword) cursor += 2;
      if (tokens[cursor]?.kind === SyntaxKind.FromKeyword) addString(tokens[cursor + 1]);
      continue;
    }
    if (tokens[cursor]?.kind !== SyntaxKind.OpenBraceToken) continue;
    let depth = 0;
    for (; cursor < tokens.length; cursor += 1) {
      if (tokens[cursor].kind === SyntaxKind.OpenBraceToken) depth += 1;
      if (tokens[cursor].kind === SyntaxKind.CloseBraceToken) depth -= 1;
      if (depth === 0) break;
    }
    if (tokens[cursor + 1]?.kind === SyntaxKind.FromKeyword) addString(tokens[cursor + 2]);
  }
  return [...result].sort(compareAscii);
}

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
    throw new TypeError("Runtime closure integers must be safe integers and not negative zero.");
  }
  if (!["string", "number", "boolean"].includes(typeof value)) {
    throw new TypeError("Runtime closure data contains a non-JSON value.");
  }
  return JSON.stringify(value);
}

function rawSha256(bytes) {
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (!DIGEST.test(digest)) throw new Error("Unable to produce a SHA-256 digest.");
  return digest;
}

function closureDigest(canonicalManifestBytes) {
  return rawSha256(Buffer.concat([
    Buffer.from(CLOSURE_DIGEST_DOMAIN, "utf8"),
    canonicalManifestBytes,
  ]));
}

function portablePath(value) {
  return value.split(sep).join("/");
}

function assertChild(root, target, label) {
  const child = relative(root, target);
  if (child.length === 0 || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error(`${label} must remain below '${root}'.`);
  }
}

function resolveSource(path) {
  if (!PORTABLE_PATH.test(path)
      || path.includes("//")
      || path.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Source path '${path}' is not a normalized portable path.`);
  }
  const target = resolve(WORKSPACE_ROOT, ...path.split("/"));
  assertChild(WORKSPACE_ROOT, target, `Source '${path}'`);
  return target;
}

function resolveVendor(path) {
  const target = resolve(VENDOR_ROOT, ...path.split("/"));
  assertChild(VENDOR_ROOT, target, `Vendor destination '${path}'`);
  return target;
}

async function regularFile(path, label) {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(`${label} must be a regular non-symbolic file.`);
  }
  return status;
}

async function safeDirectory(path, label) {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`${label} must be a non-symbolic directory.`);
  }
  return status;
}

async function ensureDirectory(path, label) {
  try {
    await safeDirectory(path, label);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(path, { recursive: true, mode: 0o700 });
    await safeDirectory(path, label);
  }
}

async function discoverCliClosure() {
  const pending = [CLI_MAIN];
  const visited = new Set();
  while (pending.length > 0) {
    const path = pending.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    if (visited.size > 64 || pending.length > 64) {
      throw new Error("The CLI source graph exceeds its closed discovery bound.");
    }
    const absolute = resolveSource(path);
    await regularFile(absolute, `CLI closure source '${path}'`);
    const source = await readFile(absolute, "utf8");
    if (hasForbiddenDynamicLoaderCall(source)) {
      throw new Error(`CLI source '${path}' contains a dynamic import or CommonJS require edge.`);
    }
    for (const specifier of staticImportSpecifiers(source)) {
      if (specifier.startsWith("node:")) {
        if (!ALLOWED_NODE_BUILTINS.has(specifier)) {
          throw new Error(`CLI source '${path}' imports unreviewed Node builtin '${specifier}'.`);
        }
        continue;
      }
      if (!specifier.startsWith(".")) {
        throw new Error(`CLI source '${path}' has unsupported package import '${specifier}'.`);
      }
      const dependency = resolve(dirname(absolute), specifier);
      assertChild(WORKSPACE_ROOT, dependency, `CLI dependency '${specifier}'`);
      pending.push(portablePath(relative(WORKSPACE_ROOT, dependency)));
    }
  }
  return [...visited].sort(compareAscii);
}

function assertExactClosure(actual) {
  const expected = [...CLI_CLOSURE].sort(compareAscii);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((path) => !actualSet.has(path));
  const unexpected = actual.filter((path) => !expectedSet.has(path));
  if (expected.length !== 35 || actual.length !== 35 || missing.length || unexpected.length) {
    throw new Error([
      "The CLI main-module closure differs from the reviewed 35-file closure.",
      `Expected count: ${expected.length}; actual count: ${actual.length}.`,
      ...(missing.length ? [`Missing: ${missing.join(", ")}`] : []),
      ...(unexpected.length ? [`Unexpected: ${unexpected.join(", ")}`] : []),
    ].join("\n"));
  }
}

async function walk(root) {
  const files = [];
  const directories = [];
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareAscii(left.name, right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      assertChild(root, path, `Runtime tree member '${entry.name}'`);
      const status = await lstat(path);
      if (status.isSymbolicLink()) throw new Error(`Runtime tree member '${path}' must not be symbolic.`);
      if (status.isDirectory()) {
        directories.push(path);
        await visit(path);
      } else if (status.isFile()) {
        files.push(path);
      } else {
        throw new Error(`Runtime tree member '${path}' must be a regular file or directory.`);
      }
    }
  };
  await visit(root);
  return { directories, files };
}

function expectedRuntimeDirectories() {
  const result = new Set(["vendor"]);
  for (const path of SOURCE_FILES.map((value) => `vendor/${value}`)) {
    const parts = path.split("/");
    for (let count = 1; count < parts.length; count += 1) {
      result.add(parts.slice(0, count).join("/"));
    }
  }
  return result;
}

async function rejectUnexpectedExistingRuntimeMembers() {
  try {
    await safeDirectory(RUNTIME_ROOT, "Runtime distribution root");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const tree = await walk(RUNTIME_ROOT);
  const expectedFiles = new Set([
    "runtime-closure-manifest.json",
    ...SOURCE_FILES.map((path) => `vendor/${path}`),
  ]);
  const expectedDirectories = expectedRuntimeDirectories();
  const unexpectedFiles = tree.files
    .map((path) => portablePath(relative(RUNTIME_ROOT, path)))
    .filter((path) => !expectedFiles.has(path));
  const unexpectedDirectories = tree.directories
    .map((path) => portablePath(relative(RUNTIME_ROOT, path)))
    .filter((path) => !expectedDirectories.has(path));
  if (unexpectedFiles.length || unexpectedDirectories.length) {
    throw new Error([
      "The existing runtime distribution contains unexpected members.",
      ...(unexpectedFiles.length ? [`Files: ${unexpectedFiles.join(", ")}`] : []),
      ...(unexpectedDirectories.length ? [`Directories: ${unexpectedDirectories.join(", ")}`] : []),
    ].join("\n"));
  }
}

async function copyClosure() {
  await ensureDirectory(RUNTIME_ROOT, "Runtime distribution root");
  await ensureDirectory(VENDOR_ROOT, "Runtime vendor root");
  for (const path of SOURCE_FILES) {
    const source = resolveSource(path);
    const destination = resolveVendor(path);
    await regularFile(source, `Runtime source '${path}'`);
    const before = await readFile(source);
    await ensureDirectory(dirname(destination), `Runtime destination parent for '${path}'`);
    try {
      const existing = await lstat(destination);
      if (existing.isSymbolicLink() || !existing.isFile()) {
        throw new Error(`Runtime destination '${path}' must be a regular non-symbolic file.`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await copyFile(source, destination);
    await regularFile(destination, `Runtime destination '${path}'`);
    const [after, copied] = await Promise.all([readFile(source), readFile(destination)]);
    if (!before.equals(after) || !before.equals(copied)) {
      throw new Error(`Runtime source '${path}' changed or was not copied byte-for-byte.`);
    }
  }
}

async function buildManifest() {
  const files = [];
  for (const sourcePath of SOURCE_FILES) {
    const path = `vendor/${sourcePath}`;
    const bytes = await readFile(resolveVendor(sourcePath));
    if (bytes.length < 1 || !Number.isSafeInteger(bytes.length)) {
      throw new Error(`Runtime member '${path}' has an invalid byte length.`);
    }
    files.push({ byteLength: bytes.length, path, sha256: rawSha256(bytes) });
  }
  files.sort((left, right) => compareAscii(left.path, right.path));
  const canonicalInventoryBytes = Buffer.from(canonicalJson(files), "utf8");
  const manifest = {
    files,
    inventoryDigest: rawSha256(canonicalInventoryBytes),
    kind: MANIFEST_KIND,
    version: MANIFEST_VERSION,
  };
  const canonicalManifestBytes = Buffer.from(canonicalJson(manifest), "utf8");
  await writeFile(MANIFEST_PATH, canonicalManifestBytes, { mode: 0o600 });
  return {
    canonicalInventoryBytes,
    canonicalManifestBytes,
    closureDigest: closureDigest(canonicalManifestBytes),
    files,
    manifest,
  };
}

async function buildContractIdentities() {
  const vendoredMain = resolveVendor(CLI_MAIN);
  await regularFile(vendoredMain, "Vendored CLI identity authority");
  const mainUrl = pathToFileURL(vendoredMain).href;
  const { main } = await import(mainUrl);
  const stdout = [];
  const stderr = [];
  const io = Object.freeze({
    stdin: () => { throw new Error("Identity generation must not read stdin."); },
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
  });
  const exitCode = await main(["policy", "identities", "--json"], io);
  if (exitCode !== 0 || stdout.length !== 1 || stderr.length !== 0 || typeof stdout[0] !== "string") {
    throw new Error("The authoritative CLI did not produce one successful identity envelope.");
  }
  const envelope = JSON.parse(stdout[0]);
  if (envelope?.command !== "policy identities"
      || envelope?.ok !== true
      || envelope?.schemaVersion !== "1.1"
      || envelope?.result?.kind !== "MemoryOSPolicyContractIdentities") {
    throw new Error("The authoritative CLI identity envelope has an unexpected shape.");
  }
  const bytes = Buffer.from(canonicalJson(envelope.result), "utf8");
  await ensureDirectory(dirname(CONTRACT_PATH), "Contract artifact directory");
  await writeFile(CONTRACT_PATH, bytes, { mode: 0o600 });
  return { byteLength: bytes.length, rawSha256: rawSha256(bytes) };
}

async function writeReceipt(runtime, contract) {
  const receipt = {
    contractIdentities: contract,
    entryCount: runtime.files.length,
    identityConstruction: {
      canonicalJson: "recursive ASCII-key ordering; arrays retain order; UTF-8; no framing LF",
      closureDigestDomain: CLOSURE_DIGEST_DOMAIN,
      closureDigestInput: "UTF-8 domain bytes followed by the complete canonical manifest bytes",
      inventoryDigestInput: "complete canonical files array bytes",
    },
    inventoryCanonicalByteLength: runtime.canonicalInventoryBytes.length,
    inventoryDigest: runtime.manifest.inventoryDigest,
    kind: RECEIPT_KIND,
    manifestCanonicalByteLength: runtime.canonicalManifestBytes.length,
    manifestRawSha256: rawSha256(runtime.canonicalManifestBytes),
    runtimeClosureDigest: runtime.closureDigest,
    runtimeManifest: "runtime/runtime-closure-manifest.json",
    runtimeMain: `runtime/vendor/${CLI_MAIN}`,
    sourceClosure: {
      cliModuleCount: CLI_CLOSURE.length,
      packageBoundaryCount: PACKAGE_BOUNDARIES.length,
    },
    version: RECEIPT_VERSION,
  };
  await ensureDirectory(dirname(RECEIPT_PATH), "Runtime identity measurement directory");
  await writeFile(RECEIPT_PATH, `${canonicalJson(receipt)}\n`, { mode: 0o600 });
  return receipt;
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("build-runtime-distribution does not accept arguments.");
  }
  if (new Set(SOURCE_FILES).size !== SOURCE_FILES.length) {
    throw new Error("The reviewed runtime source list contains a duplicate path.");
  }
  await safeDirectory(WORKSPACE_ROOT, "Workspace root");
  assertExactClosure(await discoverCliClosure());
  for (const path of PACKAGE_BOUNDARIES) {
    await regularFile(resolveSource(path), `ESM package boundary '${path}'`);
  }
  await rejectUnexpectedExistingRuntimeMembers();
  await copyClosure();
  const runtime = await buildManifest();
  const contract = await buildContractIdentities();
  const receipt = await writeReceipt(runtime, contract);
  process.stdout.write(`${JSON.stringify({
    contractIdentitiesRawSha256: contract.rawSha256,
    entryCount: runtime.files.length,
    inventoryDigest: runtime.manifest.inventoryDigest,
    manifestRawSha256: receipt.manifestRawSha256,
    runtimeClosureDigest: runtime.closureDigest,
    status: "generated",
  })}\n`);
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined
    && pathToFileURL(resolve(invokedPath)).href === import.meta.url) {
  await main();
}
