import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { after, before, test } from "node:test";

import { build } from "esbuild";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "..", "..");
const RUNTIME_ROOT = join(PACKAGE_ROOT, "runtime");
const CONTRACT_PATH = join(PACKAGE_ROOT, "contracts", "policy-contract-identities-1.0.0.json");
const GOLDEN_VECTORS_PATH = join(
  WORKSPACE_ROOT,
  "repositories",
  "cca-studio",
  "tests",
  "fixtures",
  "investigation-policy",
  "1.0.0",
  "final-evaluation-identity-outcome-golden-vectors.json",
);
const TEMP_ROOT = await mkdtemp(join(tmpdir(), "memoryos-vscode-runtime-tests-"));
const API_BUNDLE = join(TEMP_ROOT, "runtime-test-api.mjs");
const WORKER_BUNDLE = join(TEMP_ROOT, "cli-worker.cjs");
const runtimeBuilder = await import(
  `${pathToFileURL(join(PACKAGE_ROOT, "scripts", "build-runtime-distribution.mjs")).href}?test=1`
);

let api;

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
  return JSON.stringify(value);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function bundleRuntimeTestApi() {
  const apiBuild = await build({
    absWorkingDir: PACKAGE_ROOT,
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    sourcemap: false,
    stdin: {
      contents: [
        'export * from "./src/errors.ts";',
        'export * from "./src/runtime/cli-adapter.ts";',
        'export * from "./src/runtime/input-snapshot.ts";',
        'export * from "./src/runtime/runtime-contract.ts";',
        'export * from "./src/runtime/runtime-distribution.ts";',
      ].join("\n"),
      loader: "ts",
      resolveDir: PACKAGE_ROOT,
      sourcefile: "runtime-test-api.ts",
    },
    target: "node22",
    write: false,
  });
  await writeFile(API_BUNDLE, apiBuild.outputFiles[0].contents);

  const workerBuild = await build({
    absWorkingDir: PACKAGE_ROOT,
    bundle: true,
    format: "cjs",
    logLevel: "silent",
    packages: "external",
    platform: "node",
    sourcemap: false,
    stdin: {
      contents: 'import "./src/runtime/cli-worker.ts";',
      loader: "ts",
      resolveDir: PACKAGE_ROOT,
      sourcefile: "cli-worker-test-entry.ts",
    },
    target: "node22",
    write: false,
  });
  await writeFile(WORKER_BUNDLE, workerBuild.outputFiles[0].contents);
}

before(async () => {
  await bundleRuntimeTestApi();
  api = await import(`${pathToFileURL(API_BUNDLE).href}?test=${Date.now()}`);
});

after(async () => {
  await rm(TEMP_ROOT, { force: true, recursive: true });
});

async function copyExtensionAuthority() {
  const root = await mkdtemp(join(TEMP_ROOT, "extension-copy-"));
  await cp(RUNTIME_ROOT, join(root, "runtime"), { recursive: true });
  await mkdir(join(root, "contracts"));
  await cp(CONTRACT_PATH, join(root, "contracts", "policy-contract-identities-1.0.0.json"));
  return root;
}

function assertAdapterCode(code) {
  return (error) => {
    assert.equal(error?.code, code);
    return true;
  };
}

async function createSizedFile(root, name, byteLength) {
  const path = join(root, name);
  await writeFile(path, Buffer.alloc(byteLength, 0x61));
  return path;
}

function localFile(path, overrides = {}) {
  return { dirty: false, fsPath: path, scheme: "file", untitled: false, ...overrides };
}

function workerPayload(payload) {
  return new Promise((resolvePromise, rejectPromise) => {
    const worker = new Worker(WORKER_BUNDLE, {
      execArgv: [],
      stderr: true,
      stdout: true,
      workerData: payload,
    });
    worker.stdout?.resume();
    worker.stderr?.resume();
    worker.once("message", resolvePromise);
    worker.once("error", rejectPromise);
    worker.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(`worker exited ${code}`));
    });
  });
}

function workerMessage(mainModulePath, argv = ["policy", "identities", "--json"]) {
  return workerPayload({ argv, mainModulePath });
}

async function fakeMain(source) {
  const path = join(TEMP_ROOT, `fake-main-${createHash("sha256").update(source).digest("hex")}.mjs`);
  await writeFile(path, source);
  return path;
}

async function writeWorkerFixture(name, source) {
  const path = join(TEMP_ROOT, name);
  await writeFile(path, source);
  return path;
}

const correctIdentities = JSON.parse(await readFile(CONTRACT_PATH, "utf8"));
const correctIdentityEnvelope = `${canonicalJson({
  command: "policy identities",
  ok: true,
  result: correctIdentities,
  schemaVersion: "1.1",
})}\n`;

test("runtime closure manifest and identities reproduce the frozen independent digests", async () => {
  const manifestBytes = await readFile(join(RUNTIME_ROOT, "runtime-closure-manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.kind, "MemoryOSVSCodeRuntimeClosureManifest");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.files.length, 37);
  assert.equal(manifest.inventoryDigest, sha256(Buffer.from(canonicalJson(manifest.files))));
  assert.equal(manifest.inventoryDigest, api.RUNTIME_CLOSURE_INVENTORY_DIGEST);
  assert.equal(sha256(manifestBytes), api.RUNTIME_CLOSURE_MANIFEST_RAW_SHA256);
  assert.equal(
    sha256(Buffer.concat([
      Buffer.from(api.RUNTIME_CLOSURE_DIGEST_DOMAIN),
      Buffer.from(canonicalJson(manifest)),
    ])),
    api.RUNTIME_CLOSURE_DIGEST,
  );
  assert.equal(sha256(await readFile(CONTRACT_PATH)), api.POLICY_CONTRACT_IDENTITIES_RAW_SHA256);
  assert.notEqual(api.RUNTIME_CLOSURE_DIGEST, "sha256:2e116b6518934c797e9c562670f2292462be11ee982c778b43f1aaf45a8986f9");
  for (const member of manifest.files) {
    assert.ok(member.path.startsWith("vendor/"));
    const sourcePath = member.path.slice("vendor/".length).split("/");
    assert.deepEqual(
      await readFile(join(RUNTIME_ROOT, ...member.path.split("/"))),
      await readFile(join(WORKSPACE_ROOT, ...sourcePath)),
      `${member.path} is not byte-preserved from its authoritative source`,
    );
  }
  for (const source of [
    'void import("./dynamic.js")',
    'import /* comment */ ("./dynamic.js")',
    'require\n/* comment */("./dynamic.cjs")',
  ]) {
    assert.equal(runtimeBuilder.hasForbiddenDynamicLoaderCall(source), true, source);
  }
  assert.equal(runtimeBuilder.hasForbiddenDynamicLoaderCall('import value from "./static.js";'), false);
  assert.equal(runtimeBuilder.hasForbiddenDynamicLoaderCall('core.import("memory.mip")'), false);
  assert.equal(runtimeBuilder.hasForbiddenDynamicLoaderCall('loader.require("reviewed")'), false);
  assert.equal(runtimeBuilder.hasForbiddenDynamicLoaderCall('class Core { import(input) { return input; } }'), false);
  assert.deepEqual(runtimeBuilder.staticImportSpecifiers(
    'const one = 1; import{spawn as from}from"node:child_process"; export*from"./next.js";',
  ), ["./next.js", "node:child_process"]);
  assert.deepEqual(runtimeBuilder.staticImportSpecifiers(
    'import "./side-effect.js"; export { value as from } from "./named.js";',
  ), ["./named.js", "./side-effect.js"]);
});

test("verifier copies exact bytes into a disposable private immutable snapshot", async () => {
  const packaged = await copyExtensionAuthority();
  const snapshot = await api.verifyAndSnapshotRuntime(join(packaged, "runtime"));
  const packagedMain = join(packaged, "runtime", api.RUNTIME_CLI_MAIN);
  const snapshotMain = snapshot.mainModulePath;
  assert.deepEqual(await readFile(snapshotMain), await readFile(packagedMain));
  await writeFile(packagedMain, "substituted after snapshot");
  const output = [];
  const module = await import(`${pathToFileURL(snapshotMain).href}?immutable=1`);
  const exit = await module.main(["policy", "identities", "--json"], {
    stdin: () => { throw new Error("stdin disabled"); },
    stderr: (value) => output.push(value),
    stdout: (value) => output.push(value),
  });
  assert.equal(exit, 0);
  assert.equal(JSON.parse(output[0]).result.kind, "MemoryOSPolicyContractIdentities");
  await snapshot.dispose();
  await assert.rejects(stat(snapshot.root));
});

test("closed runtime verifier rejects missing, unexpected, traversal, and symbolic members", async (t) => {
  await t.test("missing", async () => {
    const root = await copyExtensionAuthority();
    await unlink(join(root, "runtime", api.RUNTIME_CLI_MAIN));
    await assert.rejects(
      api.verifyAndSnapshotRuntime(join(root, "runtime")),
      assertAdapterCode("MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH"),
    );
  });
  await t.test("unexpected", async () => {
    const root = await copyExtensionAuthority();
    await writeFile(join(root, "runtime", "unexpected.js"), "x");
    await assert.rejects(
      api.verifyAndSnapshotRuntime(join(root, "runtime")),
      assertAdapterCode("MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH"),
    );
  });
  await t.test("traversal manifest mutation", async () => {
    const bytes = await readFile(join(RUNTIME_ROOT, "runtime-closure-manifest.json"));
    const mutated = Buffer.from(bytes.toString("utf8").replace(
      "vendor/repositories/cca-studio/package.json",
      "../repositories/cca-studio/package.json",
    ));
    assert.throws(
      () => api.parseRuntimeClosureManifest(mutated),
      assertAdapterCode("MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH"),
    );
  });
  await t.test("duplicate normalized manifest path", async () => {
    const manifest = JSON.parse(await readFile(join(RUNTIME_ROOT, "runtime-closure-manifest.json"), "utf8"));
    manifest.files[1].path = manifest.files[0].path;
    assert.throws(
      () => api.parseRuntimeClosureManifest(Buffer.from(canonicalJson(manifest))),
      assertAdapterCode("MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH"),
    );
  });
  await t.test("non-normalized manifest path", async () => {
    const manifest = JSON.parse(await readFile(join(RUNTIME_ROOT, "runtime-closure-manifest.json"), "utf8"));
    manifest.files[0].path = manifest.files[0].path.replaceAll("/", "\\");
    assert.throws(
      () => api.parseRuntimeClosureManifest(Buffer.from(canonicalJson(manifest))),
      assertAdapterCode("MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH"),
    );
  });
  await t.test("symbolic leaf where supported", async () => {
    const root = await copyExtensionAuthority();
    const link = join(root, "runtime", api.RUNTIME_CLI_MAIN);
    const target = join(root, "outside-runtime-main.js");
    await writeFile(target, await readFile(link));
    await unlink(link);
    try {
      await symlink(target, link, "file");
      await assert.rejects(
        api.verifyAndSnapshotRuntime(join(root, "runtime")),
        assertAdapterCode("MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH"),
      );
    } catch (error) {
      if (error?.code !== "EPERM") throw error;
      const source = await readFile(join(PACKAGE_ROOT, "src", "runtime", "runtime-distribution.ts"), "utf8");
      assert.match(source, /isSymbolicLink\(\)/u);
      assert.match(source, /O_NOFOLLOW/u);
    }
  });
});

test("secure input snapshots enforce below, exact, and first-byte-above measured limits", async (t) => {
  const cases = [
    ["policy", "policy", api.TRANSPORT_LIMITS.policy],
    ["policySet", "policy-set", api.TRANSPORT_LIMITS.policySet],
    ["candidateMip", "candidate", api.TRANSPORT_LIMITS.mip],
  ];
  for (const [role, stem, limit] of cases) {
    await t.test(role, async () => {
      for (const [label, size, accepted] of [
        ["below", limit - 1, true],
        ["exact", limit, true],
        ["above", limit + 1, false],
      ]) {
        const source = await createSizedFile(TEMP_ROOT, `${stem}-${label}-${size}`, size);
        const operation = await api.createOperationInputSnapshot();
        if (accepted) {
          const before = process.memoryUsage().rss;
          const acquired = await operation.acquire(role, localFile(source));
          const after = process.memoryUsage().rss;
          assert.equal(acquired.byteLength, size);
          assert.equal((await stat(acquired.path)).size, size);
          api.assertOperationPath(operation.capability, acquired.path, { access: "input", role });
          if (label === "exact") {
            t.diagnostic(`${role} exact snapshot RSS delta=${after - before} bytes; fixed copy buffer=${api.INPUT_SNAPSHOT_COPY_BUFFER_BYTES}`);
          }
        } else {
          await assert.rejects(
            operation.acquire(role, localFile(source)),
            assertAdapterCode("MEMORYOS_VSCODE_INPUT_LIMIT_EXCEEDED"),
          );
        }
        await operation.dispose();
      }
    });
  }
  assert.equal(api.INPUT_SNAPSHOT_COPY_BUFFER_BYTES, 65_536);
  assert.ok(api.TRANSPORT_LIMITS.mip > api.INPUT_SNAPSHOT_COPY_BUFFER_BYTES);
});

test("verification inputs use the frozen normative outcome ceiling without creating a transport limit", async () => {
  assert.equal(api.POLICY_VERIFICATION_ARTIFACT_MAX_BYTES, 4_060);
  const golden = JSON.parse(await readFile(GOLDEN_VECTORS_PATH, "utf8"));
  const maximumIdentity = golden.records.reduce((left, right) => (
    right.canonicalIdentityByteCount > left.canonicalIdentityByteCount ? right : left
  ));
  const maximumOutcome = golden.records.reduce((left, right) => (
    right.canonicalOutcomeByteCount > left.canonicalOutcomeByteCount ? right : left
  ));
  const identitySource = join(TEMP_ROOT, "retained-evaluation-identity.json");
  const outcomeSource = join(TEMP_ROOT, "retained-policy-outcome.json");
  await writeFile(identitySource, maximumIdentity.canonicalIdentityBytes, "utf8");
  await writeFile(outcomeSource, maximumOutcome.canonicalOutcomeBytes, "utf8");

  const retained = await api.createOperationInputSnapshot();
  const identity = await retained.acquire("evaluationIdentity", localFile(identitySource));
  const expectedIdentity = await retained.acquire("expectedEvaluationIdentity", localFile(identitySource));
  const outcome = await retained.acquire("policyOutcome", localFile(outcomeSource));
  for (const acquired of [identity, expectedIdentity, outcome]) {
    assert.equal(acquired.inputLimitClass, "policyVerificationArtifact");
    api.assertOperationPath(
      retained.capability,
      acquired.path,
      { access: "input", role: acquired.role },
    );
  }
  await retained.dispose();

  const exact = await createSizedFile(
    TEMP_ROOT,
    "verification-ceiling-exact.json",
    api.POLICY_VERIFICATION_ARTIFACT_MAX_BYTES,
  );
  const exactOperation = await api.createOperationInputSnapshot();
  assert.equal(
    (await exactOperation.acquire("policyOutcome", localFile(exact))).byteLength,
    api.POLICY_VERIFICATION_ARTIFACT_MAX_BYTES,
  );
  await exactOperation.dispose();

  const above = await createSizedFile(
    TEMP_ROOT,
    "verification-ceiling-above.json",
    api.POLICY_VERIFICATION_ARTIFACT_MAX_BYTES + 1,
  );
  const aboveOperation = await api.createOperationInputSnapshot();
  await assert.rejects(
    aboveOperation.acquire("evaluationIdentity", localFile(above)),
    (error) => error?.code === "MEMORYOS_VSCODE_INPUT_LIMIT_EXCEEDED"
      && /normative Policy verification-artifact ceiling/u.test(error.message)
      && !/extension transport limit/u.test(error.message),
  );
  await aboveOperation.dispose();
});

test("input snapshots reject unsupported authorities and close acquire/dispose races", async () => {
  const source = await createSizedFile(TEMP_ROOT, "race-policy.json", api.TRANSPORT_LIMITS.policy);
  for (const input of [
    localFile(source, { scheme: "https" }),
    localFile(source, { dirty: true }),
    localFile(source, { scheme: "untitled", untitled: true }),
  ]) {
    const operation = await api.createOperationInputSnapshot();
    await assert.rejects(
      operation.acquire("policy", input),
      assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
    );
    await operation.dispose();
  }
  const nullOperation = await api.createOperationInputSnapshot();
  await assert.rejects(
    nullOperation.acquire("policy", null),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_REQUIRED"),
  );
  await nullOperation.dispose();

  const operation = await api.createOperationInputSnapshot();
  const acquiring = operation.acquire("policy", localFile(source));
  const disposing = operation.dispose();
  await assert.rejects(acquiring, assertAdapterCode("MEMORYOS_VSCODE_CANCELLED"));
  await disposing;
  await assert.rejects(stat(operation.root));

  const link = join(TEMP_ROOT, "policy-input-link.json");
  try {
    await symlink(source, link, "file");
    const symbolicOperation = await api.createOperationInputSnapshot();
    await assert.rejects(
      symbolicOperation.acquire("policy", localFile(link)),
      assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
    );
    await symbolicOperation.dispose();
  } catch (error) {
    if (error?.code !== "EPERM") throw error;
    const sourceText = await readFile(join(PACKAGE_ROOT, "src", "runtime", "input-snapshot.ts"), "utf8");
    assert.match(sourceText, /isSymbolicLink\(\)/u);
    assert.match(sourceText, /O_NOFOLLOW/u);
  }
});

test("opaque operation capability confines every CLI path to fixed private roles", async () => {
  const source = join(
    PACKAGE_ROOT,
    "..",
    "cca-conformance",
    "tests",
    "fixtures",
    "github-policy-gate",
    "1.0.0",
    "hosted",
    "pass.memoryos-policy.json",
  );
  const operation = await api.createOperationInputSnapshot();
  const acquired = await operation.acquire("policy", localFile(source));
  const acquiredSet = await operation.acquire("policySet", localFile(source));
  const candidateMip = await operation.acquire("candidateMip", localFile(source));
  const baselineMip = await operation.acquire("baselineMip", localFile(source));
  const identity = await operation.acquire("evaluationIdentity", localFile(source));
  const expectedIdentity = await operation.acquire("expectedEvaluationIdentity", localFile(source));
  const outcomeInput = await operation.acquire("policyOutcome", localFile(source));
  const output = operation.reserveOutput("canonicalArtifact");
  const outcomeOutput = operation.reserveOutput("outcome");
  assert.deepEqual(api.buildPolicyArgv({
    artifact: { kind: "policy", path: acquired.path },
    canonicalOutputPath: output,
    kind: "digest",
    operation: operation.capability,
  }), [
    "policy", "digest", "--policy", acquired.path,
    "--canonical-output", output, "--json",
  ]);
  assert.throws(
    () => api.buildPolicyArgv({
      artifact: { kind: "policy", path: source },
      kind: "digest",
      operation: operation.capability,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.throws(
    () => api.assertOperationPath(
      operation.capability,
      acquired.path,
      { access: "input", role: "policySet" },
    ),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.throws(
    () => api.buildPolicyArgv({
      artifact: { kind: "policySet", path: acquired.path },
      kind: "digest",
      operation: operation.capability,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.throws(
    () => api.buildPolicyArgv({
      artifact: { kind: "policy", path: acquired.path },
      canonicalOutputPath: outcomeOutput,
      kind: "digest",
      operation: operation.capability,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.throws(
    () => api.buildPolicyArgv({
      artifact: { kind: "policy", path: acquired.path },
      kind: "evaluate",
      operation: operation.capability,
      outcomePath: outcomeOutput,
      packagePath: baselineMip.path,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.deepEqual(api.buildPolicyArgv({
    expectedEvaluationIdentityDigest: `sha256:${"1".repeat(64)}`,
    identityPath: identity.path,
    kind: "verifyIdentity",
    mode: "artifact",
    operation: operation.capability,
  }), [
    "policy", "verify-identity", identity.path, "--mode", "artifact",
    "--expected-evaluation-identity-digest", `sha256:${"1".repeat(64)}`, "--json",
  ]);
  assert.deepEqual(api.buildPolicyArgv({
    expectedIdentityPath: expectedIdentity.path,
    kind: "verifyOutcome",
    mode: "artifact",
    operation: operation.capability,
    outcomePath: outcomeInput.path,
  }), [
    "policy", "verify-outcome", outcomeInput.path, "--mode", "artifact",
    "--expected-identity", expectedIdentity.path, "--json",
  ]);
  assert.throws(
    () => api.buildPolicyArgv({
      expectedEvaluationIdentityDigest: `sha256:${"1".repeat(64)}`,
      identityPath: expectedIdentity.path,
      kind: "verifyIdentity",
      mode: "artifact",
      operation: operation.capability,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.throws(
    () => api.buildPolicyArgv({
      expectedIdentityPath: identity.path,
      kind: "verifyOutcome",
      mode: "artifact",
      operation: operation.capability,
      outcomePath: outcomeInput.path,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.ok(acquiredSet.path !== acquired.path && candidateMip.path !== baselineMip.path);
  await operation.dispose();
  assert.throws(
    () => api.buildPolicyArgv({
      artifact: { kind: "policy", path: acquired.path },
      kind: "digest",
      operation: operation.capability,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
});

test("actual worker enforces exact stdout/stderr bounds and persists caught overflow", async () => {
  const exactStdout = await fakeMain(`export async function main(_argv, io) { io.stdout("x".repeat(${api.STDOUT_MAX_BYTES})); return 0; }`);
  const stdoutResult = await workerMessage(exactStdout);
  assert.equal(stdoutResult.type, "result");
  assert.equal(Buffer.byteLength(stdoutResult.stdout), api.STDOUT_MAX_BYTES);

  const exactStderr = await fakeMain(`export async function main(_argv, io) { io.stderr("x".repeat(${api.STDERR_MAX_BYTES})); return 2; }`);
  const stderrResult = await workerMessage(exactStderr);
  assert.equal(stderrResult.type, "result");
  assert.equal(Buffer.byteLength(stderrResult.stderr), api.STDERR_MAX_BYTES);

  const caughtOverflow = await fakeMain(`
    export async function main(_argv, io) {
      try { io.stdout("x".repeat(${api.STDOUT_MAX_BYTES + 1})); } catch {}
      io.stderr('{"caught":true}\\n');
      return 2;
    }
  `);
  const overflowResult = await workerMessage(caughtOverflow);
  assert.deepEqual(overflowResult, {
    adapterCode: "MEMORYOS_VSCODE_OUTPUT_INVALID",
    message: "The CLI output exceeded its frozen byte bound.",
    type: "failure",
  });

  const stderrOverflow = await fakeMain(`export async function main(_argv, io) { io.stderr("x".repeat(${api.STDERR_MAX_BYTES + 1})); return 2; }`);
  const stderrOverflowResult = await workerMessage(stderrOverflow);
  assert.equal(stderrOverflowResult.adapterCode, "MEMORYOS_VSCODE_OUTPUT_INVALID");

  const nonStringOutput = await fakeMain("export async function main(_argv, io) { io.stdout({}); return 0; }");
  const nonStringResult = await workerMessage(nonStringOutput);
  assert.equal(nonStringResult.adapterCode, "MEMORYOS_VSCODE_OUTPUT_INVALID");
});

test("actual worker disables stdin and treats crashes as adapter failures", async () => {
  const stdinMain = await fakeMain("export async function main(_argv, io) { io.stdin(); return 0; }");
  const result = await workerMessage(stdinMain);
  assert.equal(result.type, "failure");
  assert.equal(result.adapterCode, "MEMORYOS_VSCODE_WORKER_FAILED");
});

test("actual worker enforces the closed bounded worker request", async (t) => {
  const main = await fakeMain("export async function main() { return 0; }");
  const exactArgument = "x".repeat(api.WORKER_ARG_MAX_BYTES);
  const accepted = await workerMessage(main, ["policy", "identities", exactArgument]);
  assert.equal(accepted.type, "result");

  const invalidPayloads = [
    ["extra request member", { argv: ["policy", "identities", "--json"], extra: true, mainModulePath: main }],
    ["relative module path", { argv: ["policy", "identities", "--json"], mainModulePath: "relative.mjs" }],
    ["oversized argument", {
      argv: ["policy", "identities", "x".repeat(api.WORKER_ARG_MAX_BYTES + 1)],
      mainModulePath: main,
    }],
    ["too many arguments", {
      argv: Array.from({ length: api.WORKER_ARGV_MAX_COUNT + 1 }, () => "x"),
      mainModulePath: main,
    }],
    ["oversized encoded request", {
      argv: ["policy", "identities", ...Array.from({ length: 8 }, () => exactArgument)],
      mainModulePath: main,
    }],
  ];
  for (const [name, payload] of invalidPayloads) {
    await t.test(name, async () => {
      const result = await workerPayload(payload);
      assert.equal(result.type, "failure");
      assert.equal(result.adapterCode, "MEMORYOS_VSCODE_WORKER_FAILED");
    });
  }
});

test("actual worker rejects caught direct process output as an output-contract violation", async (t) => {
  for (const [name, expression] of [
    ["stdout", 'process.stdout.write("escape")'],
    ["stderr", 'process.stderr.write("escape")'],
    ["console", 'console.log("escape")'],
  ]) {
    await t.test(name, async () => {
      const main = await fakeMain(`
        export async function main() {
          try { ${expression}; } catch {}
          return 0;
        }
      `);
      const result = await workerMessage(main);
      assert.deepEqual(result, {
        adapterCode: "MEMORYOS_VSCODE_OUTPUT_INVALID",
        message: "The CLI output exceeded its frozen byte bound.",
        type: "failure",
      });
    });
  }
});

test("adapter preflight succeeds, rejects concurrency, and executes only through workers", async () => {
  const adapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: WORKER_BUNDLE });
  const first = adapter.preflight();
  await assert.rejects(
    adapter.preflight(),
    assertAdapterCode("MEMORYOS_VSCODE_OPERATION_IN_PROGRESS"),
  );
  const preflight = await first;
  assert.equal(preflight.runtimeClosureDigest, api.RUNTIME_CLOSURE_DIGEST);
  assert.equal(preflight.identities.kind, "MemoryOSPolicyContractIdentities");
  const execution = await adapter.execute({ kind: "identities" });
  assert.equal(execution.envelope.ok, true);
  await adapter.dispose();
});

test("adapter cancellation hard-terminates a worker and dispose waits for the operation", async () => {
  const endlessWorker = await writeWorkerFixture(
    "endless-worker.cjs",
    'const { parentPort } = require("node:worker_threads"); while (true) {}',
  );
  const adapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: endlessWorker });
  const controller = new AbortController();
  const operation = adapter.preflight(controller.signal);
  const disposing = adapter.dispose();
  controller.abort();
  await assert.rejects(operation, assertAdapterCode("MEMORYOS_VSCODE_CANCELLED"));
  await disposing;
});

test("adapter rejects out-of-band worker output immediately and terminates a non-reporting worker", async () => {
  const noisyWorker = await writeWorkerFixture(
    "noisy-endless-worker.cjs",
    'process.stdout.write("escape"); setInterval(() => {}, 1000);',
  );
  const adapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: noisyWorker });
  await assert.rejects(
    adapter.preflight(AbortSignal.timeout(2_000)),
    assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
  );
  await adapter.dispose();
});

test("adapter rejects out-of-band output even when a worker also posts a valid result", async () => {
  const noisyWorker = await writeWorkerFixture("noisy-result-worker.cjs", `
    const { parentPort } = require("node:worker_threads");
    process.stdout.write("escape");
    parentPort.postMessage(${JSON.stringify({
      exitCode: 0,
      stderr: "",
      stdout: correctIdentityEnvelope,
      type: "result",
    })});
  `);
  const adapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: noisyWorker });
  await assert.rejects(
    adapter.preflight(AbortSignal.timeout(2_000)),
    assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
  );
  await adapter.dispose();
});

test("adapter terminates a worker after its single result message", async () => {
  const lingeringWorker = await writeWorkerFixture("lingering-worker.cjs", `
    const { parentPort } = require("node:worker_threads");
    parentPort.postMessage(${JSON.stringify({
      exitCode: 0,
      stderr: "",
      stdout: correctIdentityEnvelope,
      type: "result",
    })});
    setInterval(() => {}, 1000);
  `);
  const adapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: lingeringWorker });
  const result = await adapter.preflight(AbortSignal.timeout(2_000));
  assert.equal(result.identities.kind, "MemoryOSPolicyContractIdentities");
  await adapter.dispose();
});

test("MemoryOS stable CLI codes pass through without becoming adapter decisions", async () => {
  const failureEnvelope = `${canonicalJson({
    command: "policy digest",
    error: {
      artifactKind: "MemoryOSInvestigationPolicy",
      code: "POLICY_SCHEMA_INVALID",
      details: [],
      exitCode: 2,
      failureClass: "preparation",
      limitIdentifier: null,
      message: "invalid",
      phase: "schema",
    },
    ok: false,
    schemaVersion: "1.1",
  })}\n`;
  const worker = await writeWorkerFixture("passthrough-worker.cjs", `
    const { parentPort, workerData } = require("node:worker_threads");
    const identities = ${JSON.stringify(correctIdentityEnvelope)};
    const failure = ${JSON.stringify(failureEnvelope)};
    const isIdentity = workerData.argv[1] === "identities";
    parentPort.postMessage({
      exitCode: isIdentity ? 0 : 2,
      stderr: isIdentity ? "" : failure,
      stdout: isIdentity ? identities : "",
      type: "result",
    });
    parentPort.close();
  `);
  const policy = join(
    PACKAGE_ROOT, "..", "cca-conformance", "tests", "fixtures",
    "github-policy-gate", "1.0.0", "hosted", "pass.memoryos-policy.json",
  );
  const privateState = await api.createOperationInputSnapshot();
  const acquired = await privateState.acquire("policy", localFile(policy));
  const adapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: worker });
  const result = await adapter.execute({
    artifact: { kind: "policy", path: acquired.path },
    kind: "digest",
    operation: privateState.capability,
  });
  assert.equal(result.memoryOSCode, "POLICY_SCHEMA_INVALID");
  assert.equal(result.envelope.ok, false);
  await adapter.dispose();
  await privateState.dispose();
});

test("adapter rejects malformed envelopes and enforces command-aware exit binding", async (t) => {
  const policy = join(
    PACKAGE_ROOT, "..", "cca-conformance", "tests", "fixtures",
    "github-policy-gate", "1.0.0", "hosted", "pass.memoryos-policy.json",
  );
  const mip = join(
    PACKAGE_ROOT, "..", "cca-studio", "examples", "ai-runtime-adapters",
    "reference-packages", "openai-agents-reference.mip",
  );
  const privateState = await api.createOperationInputSnapshot();
  const acquiredPolicy = await privateState.acquire("policy", localFile(policy));
  const acquiredMip = await privateState.acquire("candidateMip", localFile(mip));
  const golden = JSON.parse(await readFile(GOLDEN_VECTORS_PATH, "utf8"));
  const vector = golden.records[0];
  const identitySource = join(TEMP_ROOT, "result-shape-identity.json");
  const expectedIdentitySource = join(TEMP_ROOT, "result-shape-expected-identity.json");
  const outcomeSource = join(TEMP_ROOT, "result-shape-outcome.json");
  await writeFile(identitySource, vector.canonicalIdentityBytes);
  await writeFile(expectedIdentitySource, vector.canonicalIdentityBytes);
  await writeFile(outcomeSource, vector.canonicalOutcomeBytes);
  const acquiredIdentity = await privateState.acquire("evaluationIdentity", localFile(identitySource));
  const acquiredExpectedIdentity = await privateState.acquire(
    "expectedEvaluationIdentity",
    localFile(expectedIdentitySource),
  );
  const acquiredOutcome = await privateState.acquire("policyOutcome", localFile(outcomeSource));

  const run = async (name, response, request) => {
    const worker = await writeWorkerFixture(`${name}-worker.cjs`, `
      const { parentPort, workerData } = require("node:worker_threads");
      const identity = ${JSON.stringify({ exitCode: 0, stderr: "", stdout: correctIdentityEnvelope, type: "result" })};
      const semantic = ${JSON.stringify(response)};
      parentPort.postMessage(workerData.argv[1] === "identities" ? identity : semantic);
      parentPort.close();
    `);
    const adapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: worker });
    try {
      return await adapter.execute(request);
    } finally {
      await adapter.dispose();
    }
  };

  const digestRequest = {
    artifact: { kind: "policy", path: acquiredPolicy.path },
    kind: "digest",
    operation: privateState.capability,
  };
  const successResponse = (command, result, exitCode = 0) => ({
    exitCode,
    stderr: "",
    stdout: `${canonicalJson({ command, ok: true, result, schemaVersion: "1.1" })}\n`,
    type: "result",
  });
  const validDigestResult = {
    artifactKind: "MemoryOSInvestigationPolicy",
    artifactVersion: "1.0.0",
    documentDigest: `sha256:${"0".repeat(64)}`,
    semanticDigest: `sha256:${"1".repeat(64)}`,
  };
  await t.test("exact digest success shape", async () => {
    const result = await run(
      "digest-valid-shape",
      successResponse("policy digest", validDigestResult),
      digestRequest,
    );
    assert.deepEqual(result.envelope.result, validDigestResult);
  });
  for (const [name, invalidResult] of [
    ["empty digest result", {}],
    ["wrong digest artifact kind", { ...validDigestResult, artifactKind: "MemoryOSInvestigationPolicySet" }],
    ["malformed digest", { ...validDigestResult, semanticDigest: "sha256:ABC" }],
    ["extra digest member", { ...validDigestResult, extra: true }],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(
        run(name.replaceAll(" ", "-"), successResponse("policy digest", invalidResult), digestRequest),
        assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
      );
    });
  }
  await t.test("undefined worker message is a closed worker failure", async () => {
    await assert.rejects(
      run("undefined-message", undefined, digestRequest),
      assertAdapterCode("MEMORYOS_VSCODE_WORKER_FAILED"),
    );
  });
  for (const [name, workerFailure] of [
    ["worker failure with extra member", {
      adapterCode: "MEMORYOS_VSCODE_OUTPUT_INVALID",
      extra: true,
      message: "invalid",
      type: "failure",
    }],
    ["worker failure with non-string message", {
      adapterCode: "MEMORYOS_VSCODE_OUTPUT_INVALID",
      message: null,
      type: "failure",
    }],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(
        run(name.replaceAll(" ", "-"), workerFailure, digestRequest),
        assertAdapterCode("MEMORYOS_VSCODE_WORKER_FAILED"),
      );
    });
  }
  await t.test("malformed JSON", async () => {
    await assert.rejects(
      run("malformed", { exitCode: 0, stderr: "", stdout: "{\n", type: "result" }, digestRequest),
      assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
  });
  await t.test("non-evaluation success with nonzero exit", async () => {
    const envelope = `${canonicalJson({
      command: "policy digest",
      ok: true,
      result: { semanticDigest: `sha256:${"0".repeat(64)}` },
      schemaVersion: "1.1",
    })}\n`;
    await assert.rejects(
      run("digest-exit", { exitCode: 6, stderr: "", stdout: envelope, type: "result" }, digestRequest),
      assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
  });
  await t.test("error envelope exit mismatch", async () => {
    const envelope = `${canonicalJson({
      command: "policy digest",
      error: {
        artifactKind: "MemoryOSInvestigationPolicy",
        code: "POLICY_SCHEMA_INVALID",
        details: [],
        exitCode: 2,
        failureClass: "preparation",
        limitIdentifier: null,
        message: "invalid",
        phase: "schema",
      },
      ok: false,
      schemaVersion: "1.1",
    })}\n`;
    await assert.rejects(
      run("error-exit", { exitCode: 3, stderr: envelope, stdout: "", type: "result" }, digestRequest),
      assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
  });

  const evaluationRequest = {
    artifact: { kind: "policy", path: acquiredPolicy.path },
    kind: "evaluate",
    operation: privateState.capability,
    outcomePath: privateState.reserveOutput("outcome"),
    packagePath: acquiredMip.path,
  };
  const evaluationEnvelope = (decision) => `${canonicalJson({
    command: "policy evaluate",
    ok: true,
    result: {
      decision,
      evaluationIdentityDigest: `sha256:${"1".repeat(64)}`,
      outcomeDigest: `sha256:${"2".repeat(64)}`,
    },
    schemaVersion: "1.1",
  })}\n`;
  await t.test("FAIL decision uses frozen exit 6", async () => {
    const result = await run(
      "evaluate-fail",
      { exitCode: 6, stderr: "", stdout: evaluationEnvelope("FAIL"), type: "result" },
      evaluationRequest,
    );
    assert.equal(result.exitCode, 6);
    assert.equal(result.envelope.result.decision, "FAIL");
  });
  await t.test("evaluation decision/exit mismatch", async () => {
    await assert.rejects(
      run(
        "evaluate-mismatch",
        { exitCode: 7, stderr: "", stdout: evaluationEnvelope("FAIL"), type: "result" },
        evaluationRequest,
      ),
      assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
  });
  await t.test("evaluation rejects an extra success member", async () => {
    await assert.rejects(
      run(
        "evaluate-extra",
        successResponse("policy evaluate", {
          decision: "PASS",
          evaluationIdentityDigest: `sha256:${"1".repeat(64)}`,
          extra: true,
          outcomeDigest: `sha256:${"2".repeat(64)}`,
        }),
        evaluationRequest,
      ),
      assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
  });

  const verifyIdentityRequest = {
    expectedEvaluationIdentityDigest: vector.evaluationIdentityDigest,
    identityPath: acquiredIdentity.path,
    kind: "verifyIdentity",
    mode: "artifact",
    operation: privateState.capability,
  };
  const validIdentityVerification = {
    evaluationIdentityDigest: vector.evaluationIdentityDigest,
    verificationScope: "serializedArtifact",
    verified: true,
  };
  await t.test("exact identity-verification success shape", async () => {
    const result = await run(
      "verify-identity-valid",
      successResponse("policy verify-identity", validIdentityVerification),
      verifyIdentityRequest,
    );
    assert.deepEqual(result.envelope.result, validIdentityVerification);
  });
  await t.test("identity verification rejects wrong scope and false success", async () => {
    await assert.rejects(
      run(
        "verify-identity-invalid",
        successResponse("policy verify-identity", {
          ...validIdentityVerification,
          verificationScope: "authoritativeReconstruction",
          verified: false,
        }),
        verifyIdentityRequest,
      ),
      assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
  });

  const verifyOutcomeRequest = {
    expectedIdentityPath: acquiredExpectedIdentity.path,
    kind: "verifyOutcome",
    mode: "artifact",
    operation: privateState.capability,
    outcomePath: acquiredOutcome.path,
  };
  const validOutcomeVerification = {
    decision: "FAIL",
    evaluationIdentityDigest: vector.evaluationIdentityDigest,
    outcomeDigest: vector.outcomeDigest,
    verificationScope: "serializedArtifact",
    verified: true,
  };
  await t.test("exact outcome-verification success shape", async () => {
    const result = await run(
      "verify-outcome-valid",
      successResponse("policy verify-outcome", validOutcomeVerification),
      verifyOutcomeRequest,
    );
    assert.deepEqual(result.envelope.result, validOutcomeVerification);
  });
  await t.test("outcome verification rejects missing and unexpected members", async () => {
    const { outcomeDigest: _omitted, ...missingDigest } = validOutcomeVerification;
    await assert.rejects(
      run(
        "verify-outcome-invalid",
        successResponse("policy verify-outcome", { ...missingDigest, extra: true }),
        verifyOutcomeRequest,
      ),
      assertAdapterCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
  });
  await privateState.dispose();
});

test("postflight mismatch blocks completion and invalidates the cached snapshot", async () => {
  const extensionRoot = await copyExtensionAuthority();
  const counter = join(TEMP_ROOT, "postflight-counter.txt");
  const mismatched = `${canonicalJson({
    command: "policy identities",
    ok: true,
    result: { kind: "MemoryOSPolicyContractIdentities", version: "0.0.0" },
    schemaVersion: "1.1",
  })}\n`;
  const semantic = `${canonicalJson({
    command: "policy digest",
    ok: true,
    result: {
      artifactKind: "MemoryOSInvestigationPolicy",
      artifactVersion: "1.0.0",
      documentDigest: `sha256:${"0".repeat(64)}`,
      semanticDigest: `sha256:${"1".repeat(64)}`,
    },
    schemaVersion: "1.1",
  })}\n`;
  const worker = await writeWorkerFixture("postflight-worker.cjs", `
    const fs = require("node:fs");
    const { parentPort, workerData } = require("node:worker_threads");
    const counter = ${JSON.stringify(counter)};
    const count = fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) : 0;
    fs.writeFileSync(counter, String(count + 1));
    const stdout = count === 2
      ? ${JSON.stringify(mismatched)}
      : (workerData.argv[1] === "identities" ? ${JSON.stringify(correctIdentityEnvelope)} : ${JSON.stringify(semantic)});
    parentPort.postMessage({ exitCode: 0, stderr: "", stdout, type: "result" });
    parentPort.close();
  `);
  const policy = join(
    PACKAGE_ROOT, "..", "cca-conformance", "tests", "fixtures",
    "github-policy-gate", "1.0.0", "hosted", "pass.memoryos-policy.json",
  );
  const privateState = await api.createOperationInputSnapshot();
  const acquired = await privateState.acquire("policy", localFile(policy));
  const adapter = api.createCliAdapter({ extensionRoot, workerScriptPath: worker });
  await assert.rejects(
    adapter.execute({
      artifact: { kind: "policy", path: acquired.path },
      kind: "digest",
      operation: privateState.capability,
    }),
    assertAdapterCode("MEMORYOS_VSCODE_CONTRACT_IDENTITY_MISMATCH"),
  );
  await writeFile(join(extensionRoot, "runtime", "unexpected-after-mismatch"), "x");
  await assert.rejects(
    adapter.preflight(),
    assertAdapterCode("MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH"),
  );
  await adapter.dispose();
  await privateState.dispose();
});
