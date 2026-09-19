import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";

import { build } from "esbuild";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "..", "..");
const MOCK_VSCODE = join(PACKAGE_ROOT, "tests", "support", "mock-vscode.mjs");
const TEMP_ROOT = await mkdtemp(join(tmpdir(), "memoryos-vscode-phase2-tests-"));
const API_BUNDLE = join(TEMP_ROOT, "phase2-api.mjs");
const LIFECYCLE_BUNDLE = join(TEMP_ROOT, "extension-lifecycle-api.mjs");
const WORKER_BUNDLE = join(TEMP_ROOT, "cli-worker.cjs");
const HOSTED_ROOT = join(
  WORKSPACE_ROOT,
  "repositories", "cca-conformance", "tests", "fixtures",
  "github-policy-gate", "1.0.0", "hosted",
);
const CANDIDATE_MIP = join(
  WORKSPACE_ROOT,
  "repositories", "cca-studio", "examples", "ai-runtime-adapters",
  "reference-packages", "openai-agents-reference.mip",
);
const POLICY_SET = join(
  WORKSPACE_ROOT,
  "repositories", "cca-studio", "tests", "fixtures", "investigation-policy",
  "1.0.0", "boundary-carriers", "0031-b11-exact-candidate.json",
);

let api;
let lifecycleApi;

function localSourcePlugin() {
  return {
    name: "memoryos-local-source",
    setup(esbuild) {
      esbuild.onResolve({ filter: /^\.\.?\// }, (args) => {
        const exactPath = resolve(args.resolveDir, args.path);
        try {
          if (statSync(exactPath).isFile()) {
            return { path: exactPath };
          }
        } catch {
          // TypeScript source imports use their emitted .js specifiers.
        }

        if (exactPath.endsWith(".js")) {
          const sourcePath = `${exactPath.slice(0, -3)}.ts`;
          try {
            if (statSync(sourcePath).isFile()) {
              return { path: sourcePath };
            }
          } catch {
            // Let esbuild report the unresolved import.
          }
        }
        return undefined;
      });
    },
  };
}

function mockPlugin() {
  return {
    name: "memoryos-test-vscode",
    setup(esbuild) {
      esbuild.onResolve({ filter: /^vscode$/ }, () => ({ path: MOCK_VSCODE }));
    },
  };
}

function lifecyclePlugin() {
  return {
    name: "memoryos-extension-lifecycle-test",
    setup(esbuild) {
      esbuild.onResolve({ filter: /^\.\/runtime\/cli-adapter\.js$/ }, () => ({
        namespace: "memoryos-lifecycle",
        path: "cli-adapter",
      }));
      esbuild.onResolve({ filter: /^\.\/commands\.js$/ }, () => ({
        namespace: "memoryos-lifecycle",
        path: "commands",
      }));
      esbuild.onResolve({ filter: /^\.\/vscode-product\.js$/ }, () => ({
        namespace: "memoryos-lifecycle",
        path: "product",
      }));
      esbuild.onResolve({ filter: /^memoryos-lifecycle-control$/ }, () => ({
        namespace: "memoryos-lifecycle",
        path: "product",
      }));
      esbuild.onLoad({ filter: /^cli-adapter$/, namespace: "memoryos-lifecycle" }, () => ({
        contents: "export function createCliAdapter() { return Object.freeze({}); }",
        loader: "js",
      }));
      esbuild.onLoad({ filter: /^commands$/, namespace: "memoryos-lifecycle" }, () => ({
        contents: "export function registerMemoryOSCommands() {}",
        loader: "js",
      }));
      esbuild.onLoad({ filter: /^product$/, namespace: "memoryos-lifecycle" }, () => ({
        contents: `
          let releaseDisposal;
          let started = 0;
          const disposal = new Promise((resolveDisposal) => { releaseDisposal = resolveDisposal; });
          export function createMemoryOSVSCodeProduct() {
            return Object.freeze({
              dispose() {
                started += 1;
                return disposal;
              },
            });
          }
          export function disposalStarted() { return started; }
          export function releaseProductDisposal() { releaseDisposal(); }
        `,
        loader: "js",
      }));
    },
  };
}

async function bundlePhase2Api() {
  const apiBuild = await build({
    absWorkingDir: PACKAGE_ROOT,
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    plugins: [mockPlugin(), localSourcePlugin()],
    sourcemap: false,
    stdin: {
      contents: [
        'export * from "./src/commands.ts";',
        'export * from "./src/vscode-product.ts";',
        'export * from "./src/vscode-input.ts";',
        'export * from "./src/product/index.ts";',
        'export * from "./src/presentation/index.ts";',
        'export * from "./src/runtime/cli-adapter.ts";',
        'export * from "./tests/support/mock-vscode.mjs";',
      ].join("\n"),
      loader: "ts",
      resolveDir: PACKAGE_ROOT,
      sourcefile: "phase2-test-api.ts",
    },
    target: "node22",
    write: false,
  });
  await writeFile(API_BUNDLE, apiBuild.outputFiles[0].contents);

  const lifecycleBuild = await build({
    absWorkingDir: PACKAGE_ROOT,
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    plugins: [lifecyclePlugin(), localSourcePlugin()],
    sourcemap: false,
    stdin: {
      contents: [
        'export * from "./src/extension.ts";',
        'export { disposalStarted, releaseProductDisposal } from "memoryos-lifecycle-control";',
      ].join("\n"),
      loader: "ts",
      resolveDir: PACKAGE_ROOT,
      sourcefile: "extension-lifecycle-test-api.ts",
    },
    target: "node22",
    write: false,
  });
  await writeFile(LIFECYCLE_BUNDLE, lifecycleBuild.outputFiles[0].contents);

  const workerBuild = await build({
    absWorkingDir: PACKAGE_ROOT,
    bundle: true,
    format: "cjs",
    logLevel: "silent",
    packages: "external",
    platform: "node",
    plugins: [localSourcePlugin()],
    sourcemap: false,
    stdin: {
      contents: 'import "./src/runtime/cli-worker.ts";',
      loader: "ts",
      resolveDir: PACKAGE_ROOT,
      sourcefile: "phase2-cli-worker.ts",
    },
    target: "node22",
    write: false,
  });
  await writeFile(WORKER_BUNDLE, workerBuild.outputFiles[0].contents);
}

before(async () => {
  await bundlePhase2Api();
  api = await import(`${pathToFileURL(API_BUNDLE).href}?phase2=${Date.now()}`);
  lifecycleApi = await import(`${pathToFileURL(LIFECYCLE_BUNDLE).href}?lifecycle=${Date.now()}`);
});

after(async () => {
  await rm(TEMP_ROOT, { force: true, recursive: true });
});

function digest(scalar) {
  return `sha256:${String(scalar).repeat(64)}`;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function assertCode(code) {
  return (error) => {
    assert.equal(error?.code, code);
    return true;
  };
}

function selected(path) {
  return Object.freeze({
    input: Object.freeze({ dirty: false, fsPath: path, scheme: "file", untitled: false }),
    uri: api.Uri.file(path).toString(true),
  });
}

function realController(publications = [], adapterOverride) {
  const adapter = adapterOverride ?? api.createCliAdapter({
    extensionRoot: PACKAGE_ROOT,
    workerScriptPath: WORKER_BUNDLE,
  });
  const controller = api.createMemoryOSProductController({
    cliAdapter: adapter,
    publicationSink: Object.freeze({ publish(value) { publications.push(value); } }),
  });
  return { adapter, controller };
}

async function disposeContext(context) {
  for (const disposable of [...context.subscriptions].reverse()) await disposable?.dispose?.();
}

function findNode(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children ?? []) {
    const match = findNode(child, predicate);
    if (match !== undefined) return match;
  }
  return undefined;
}

test("mocked VS Code boundary registers exactly five commands and enforces programmatic trust", async () => {
  api.resetMockVSCode({ isTrusted: false });
  const context = api.createMockExtensionContext(PACKAGE_ROOT);
  const calls = [];
  const adapter = Object.freeze({
    async showContractIdentities() { calls.push("identities"); return "identities"; },
    async preparePolicyArtifact(uri) { calls.push(["prepare", uri]); return "prepared"; },
    async evaluatePolicyArtifact(uri) { calls.push(["evaluate", uri]); return "evaluated"; },
    async verifyEvaluationIdentity(uri) { calls.push(["verifyIdentity", uri]); return "identity"; },
    async verifyPolicyOutcome(uri) { calls.push(["verifyOutcome", uri]); return "outcome"; },
  });
  api.registerMemoryOSCommands(context, adapter);
  const registered = [...api.getMockVSCodeState().commands.keys()].sort();
  assert.deepEqual(registered, api.MEMORYOS_PUBLIC_COMMANDS.map(({ id }) => id).sort());
  assert.equal(registered.length, 5);
  assert.equal(await api.commands.executeCommand("memoryos.showContractIdentities"), "identities");
  for (const command of registered.filter((id) => id !== "memoryos.showContractIdentities")) {
    await assert.rejects(
      api.commands.executeCommand(command, api.Uri.file(join(TEMP_ROOT, "artifact"))),
      assertCode("MEMORYOS_VSCODE_WORKSPACE_UNTRUSTED"),
    );
  }
  assert.deepEqual(calls, ["identities"]);
  await disposeContext(context);
});

test("extension deactivation awaits disposal already started by its context subscription", async () => {
  const context = api.createMockExtensionContext(PACKAGE_ROOT);
  lifecycleApi.activate(context);
  assert.equal(context.subscriptions.length, 1);

  context.subscriptions[0].dispose();
  assert.equal(lifecycleApi.disposalStarted(), 1);
  let deactivated = false;
  const deactivation = lifecycleApi.deactivate().then(() => { deactivated = true; });
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  assert.equal(deactivated, false);

  lifecycleApi.releaseProductDisposal();
  await deactivation;
  assert.equal(deactivated, true);
  assert.equal(lifecycleApi.disposalStarted(), 1);
});

test("mock boundary deterministically models dialogs, QuickPick, progress, documents, and disposables", async () => {
  api.resetMockVSCode();
  const first = api.Uri.file(join(TEMP_ROOT, "first.json"));
  api.queueQuickPick("Second");
  const quick = await api.window.showQuickPick([{ label: "First" }, { label: "Second" }], { title: "Pick" });
  assert.equal(quick.label, "Second");
  api.queueOpenDialog([first]);
  assert.deepEqual(await api.window.showOpenDialog({ canSelectMany: false }), [first]);

  api.queueProgressControl("cancel");
  const cancelled = await api.window.withProgress(
    { cancellable: true, location: api.ProgressLocation.Notification, title: "MemoryOS" },
    async (progress, token) => {
      progress.report({ message: "working" });
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
      return token.isCancellationRequested;
    },
  );
  assert.equal(cancelled, true);
  assert.deepEqual(api.getMockVSCodeState().progressCalls[0].reports, [{ message: "working" }]);

  const provider = { provideTextDocumentContent: () => "{\"exact\":true}" };
  const registration = api.workspace.registerTextDocumentContentProvider("memoryos", provider);
  const document = await api.workspace.openTextDocument(api.Uri.from({
    scheme: "memoryos", authority: "verified", path: "/exact.json",
  }));
  assert.equal(document.getText(), "{\"exact\":true}");
  await api.window.showTextDocument(document, { preview: true });
  assert.equal(api.getMockVSCodeState().shownTextDocuments.at(-1).document, document);
  registration.dispose();
  assert.equal(api.getMockVSCodeState().textProviders.size, 0);
});

test("VS Code input acquisition is explicit, multi-root neutral, local-only, and rejects dirty/untitled/remote state", async () => {
  const external = api.Uri.file(join(TEMP_ROOT, "external", "policy.json"));
  api.resetMockVSCode({
    workspaceFolders: [
      { index: 0, name: "one", uri: api.Uri.file(join(TEMP_ROOT, "root-one")) },
      { index: 1, name: "two", uri: api.Uri.file(join(TEMP_ROOT, "root-two")) },
    ],
  });
  const supplied = await api.selectLocalArtifact("policy", external);
  assert.equal(supplied.sourceUri, external);
  assert.equal(supplied.input.fsPath, external.fsPath);

  await assert.rejects(
    api.selectLocalArtifact("policy", api.Uri.parse("https://example.test/policy.json")),
    assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  for (const uri of [
    external.with({ query: "revision=untrusted" }),
    external.with({ fragment: "untrusted" }),
    external.with({ authority: "remote-share" }),
  ]) {
    await assert.rejects(
      api.selectLocalArtifact("policy", uri),
      assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
    );
  }
  const dirty = api.Uri.file(join(TEMP_ROOT, "dirty.json"));
  api.registerMockDocument(dirty, { isDirty: true });
  await assert.rejects(api.selectLocalArtifact("policy", dirty), assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"));
  const untitled = api.Uri.parse("untitled:/policy.json");
  api.registerMockDocument(untitled, { isUntitled: true });
  await assert.rejects(api.selectLocalArtifact("policy", untitled), assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"));

  api.resetMockVSCode();
  api.setActiveMockDocument(external, { isDirty: false });
  api.queueQuickPick("Use saved active editor");
  assert.equal((await api.selectLocalArtifact("policy")).sourceUri, external);
  api.queueQuickPick("Choose a local file…");
  api.queueOpenDialog([external]);
  assert.equal((await api.selectLocalArtifact("policySet")).sourceUri, external);
  assert.equal(api.getMockVSCodeState().openDialogCalls[0].canSelectFolders, false);
  assert.equal(api.getMockVSCodeState().openDialogCalls[0].canSelectMany, false);

  const hostileName = api.Uri.file(join(TEMP_ROOT, "policy-\u202Ehidden\u200B.json"));
  api.setActiveMockDocument(hostileName, { isDirty: false });
  let presentedFileDetail;
  api.queueQuickPick((items) => {
    presentedFileDetail = items[0].description;
    return items[0];
  });
  assert.equal((await api.selectLocalArtifact("policy")).sourceUri, hostileName);
  assert.doesNotMatch(presentedFileDetail, /[\u200b\u202e]/u);
  assert.match(presentedFileDetail, /�/u);

  api.resetMockVSCode({ remoteName: "ssh-remote" });
  assert.throws(api.assertSupportedVSCodeHost, assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"));
  api.resetMockVSCode({ uiKind: api.UIKind.Web });
  assert.throws(api.assertSupportedVSCodeHost, assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"));
  api.resetMockVSCode({
    workspaceFolders: [{ index: 0, name: "virtual", uri: api.Uri.parse("memfs:/workspace") }],
  });
  assert.throws(api.assertSupportedVSCodeHost, assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"));
});

test("artifact editor state is revalidated after later prompts and before semantic dispatch", async () => {
  api.resetMockVSCode();
  const policyUri = api.Uri.file(join(TEMP_ROOT, "race-policy.json"));
  const candidateUri = api.Uri.file(join(TEMP_ROOT, "race-candidate.mip"));
  const policyDocument = api.registerMockDocument(policyUri, { isDirty: false });
  let preflightCalls = 0;
  let executeCalls = 0;
  const adapter = Object.freeze({
    async preflight() { preflightCalls += 1; throw new Error("must not begin"); },
    async execute() { executeCalls += 1; throw new Error("must not begin"); },
    async dispose() {},
  });
  const product = api.createMemoryOSVSCodeProduct(adapter);
  api.queueQuickPick("Policy");
  api.queueQuickPick("Choose a local file…");
  api.queueOpenDialog([candidateUri]);
  api.queueQuickPick((items) => {
    policyDocument.isDirty = true;
    return items.find(({ label }) => label === "No baseline");
  });

  await assert.rejects(
    product.evaluatePolicyArtifact(policyUri),
    assertCode("MEMORYOS_VSCODE_INPUT_UNSUPPORTED"),
  );
  assert.equal(preflightCalls, 0);
  assert.equal(executeCalls, 0);
  await product.dispose();
});

test("semantic commands recheck Workspace Trust after prompts and before controller dispatch", async (t) => {
  const policyUri = api.Uri.file(join(TEMP_ROOT, "trust-policy.json"));
  const candidateUri = api.Uri.file(join(TEMP_ROOT, "trust-candidate.mip"));
  const identityUri = api.Uri.file(join(TEMP_ROOT, "trust-identity.json"));
  const outcomeUri = api.Uri.file(join(TEMP_ROOT, "trust-outcome.json"));
  const cases = [
    {
      name: "prepare",
      arrange(state) {
        api.queueQuickPick((items) => {
          state.isTrusted = false;
          return items.find(({ label }) => label === "Policy");
        });
      },
      invoke(product) { return product.preparePolicyArtifact(policyUri); },
    },
    {
      name: "evaluate",
      arrange(state) {
        api.queueQuickPick("Policy");
        api.queueQuickPick("Choose a local file…");
        api.queueOpenDialog([candidateUri]);
        api.queueQuickPick((items) => {
          state.isTrusted = false;
          return items.find(({ label }) => label === "No baseline");
        });
      },
      invoke(product) { return product.evaluatePolicyArtifact(policyUri); },
    },
    {
      name: "verify identity",
      arrange(state) {
        api.queueQuickPick("Artifact");
        api.queueInputBox(() => {
          state.isTrusted = false;
          return digest("1");
        });
      },
      invoke(product) { return product.verifyEvaluationIdentity(identityUri); },
    },
    {
      name: "verify outcome",
      arrange(state) {
        api.queueQuickPick("Artifact");
        api.queueQuickPick("Expected Evaluation Identity digest");
        api.queueInputBox(() => {
          state.isTrusted = false;
          return digest("2");
        });
        api.queueQuickPick("Do not supply an expected Outcome digest");
      },
      invoke(product) { return product.verifyPolicyOutcome(outcomeUri); },
    },
  ];

  for (const value of cases) {
    await t.test(value.name, async () => {
      const state = api.resetMockVSCode({ isTrusted: true });
      let semanticCalls = 0;
      const adapter = Object.freeze({
        async preflight() { semanticCalls += 1; throw new Error("must not begin"); },
        async execute() { semanticCalls += 1; throw new Error("must not begin"); },
        async dispose() {},
      });
      const product = api.createMemoryOSVSCodeProduct(adapter);
      value.arrange(state);
      try {
        await assert.rejects(
          value.invoke(product),
          assertCode("MEMORYOS_VSCODE_WORKSPACE_UNTRUSTED"),
        );
        assert.equal(semanticCalls, 0);
      } finally {
        await product.dispose();
      }
    });
  }
});

test("stable machine codes stay exact while hostile notification projection is bounded", async () => {
  api.resetMockVSCode();
  const policyPath = join(TEMP_ROOT, "bounded-error-policy.json");
  await writeFile(policyPath, "{}", "utf8");
  const longCode = `POLICY_${"A".repeat(2_048)}`;
  const adapter = Object.freeze({
    async preflight() { throw new Error("not used"); },
    async execute() {
      return Object.freeze({
        envelope: Object.freeze({ ok: false }),
        exitCode: 2,
        memoryOSCode: longCode,
        stderr: "",
        stdout: "",
      });
    },
    async dispose() {},
  });
  const product = api.createMemoryOSVSCodeProduct(adapter);
  api.queueQuickPick("Policy");
  await assert.rejects(
    product.preparePolicyArtifact(api.Uri.file(policyPath)),
    (error) => {
      assert.equal(error.code, longCode);
      return true;
    },
  );
  const notification = api.getMockVSCodeState().errorMessages.at(-1).message;
  assert.ok(Buffer.byteLength(notification, "utf8") <= 192);
  assert.equal(notification.includes(longCode), false);
  assert.equal(api.getMockVSCodeState().outputChannels[0].lines[0].value.includes(longCode), true);
  await product.dispose();
});

test("virtual documents retain exact bytes, use digest keys, and replace evaluation generations atomically", () => {
  api.resetMockVSCode();
  const provider = new api.MemoryOSVirtualDocumentProvider();
  const contractBytes = Buffer.from('{"kind":"contracts"}', "utf8");
  const contractUri = provider.publishContractIdentities({
    canonicalBytes: contractBytes,
    digest: sha256(contractBytes),
    kind: "contractIdentities",
  });
  assert.equal(contractUri.scheme, "memoryos");
  assert.equal(provider.provideTextDocumentContent(contractUri), contractBytes.toString("utf8"));

  const identityOne = Buffer.from('{"generation":1}', "utf8");
  const outcomeOne = Buffer.from('{"outcome":1}', "utf8");
  const first = provider.replaceEvaluationGeneration(
    { canonicalBytes: identityOne, digest: sha256(identityOne), kind: "evaluationIdentity" },
    { canonicalBytes: outcomeOne, digest: sha256(outcomeOne), kind: "evaluationOutcome" },
  );
  assert.equal(provider.provideTextDocumentContent(first.evaluationIdentity), identityOne.toString("utf8"));
  assert.equal(provider.provideTextDocumentContent(first.evaluationOutcome), outcomeOne.toString("utf8"));

  const identityTwo = Buffer.from('{"generation":2}', "utf8");
  assert.throws(() => provider.replaceEvaluationGeneration(
    { canonicalBytes: identityTwo, digest: sha256(identityTwo), kind: "evaluationIdentity" },
    { canonicalBytes: Buffer.from("{}"), digest: "not-a-digest", kind: "evaluationOutcome" },
  ));
  assert.equal(provider.provideTextDocumentContent(first.evaluationIdentity), identityOne.toString("utf8"));
  assert.equal(provider.provideTextDocumentContent(first.evaluationOutcome), outcomeOne.toString("utf8"));
  assert.throws(() => provider.replaceEvaluationGeneration(
    { canonicalBytes: Buffer.from("different"), digest: sha256(identityOne), kind: "evaluationIdentity" },
    { canonicalBytes: outcomeOne, digest: sha256(outcomeOne), kind: "evaluationOutcome" },
  ));
  provider.dispose();
  assert.equal(provider.provideTextDocumentContent(contractUri), undefined);
});

test("results tree preserves child/rule/evidence order and renders every closed evidence variant safely", () => {
  api.resetMockVSCode();
  const virtual = new api.MemoryOSVirtualDocumentProvider();
  const virtualUris = virtual.replaceEvaluationGeneration(
    { canonicalBytes: Buffer.from("{}"), digest: digest("1"), kind: "evaluationIdentity" },
    { canonicalBytes: Buffer.from("{}"), digest: digest("2"), kind: "evaluationOutcome" },
  );
  const navigation = new api.MemoryOSNavigationRegistry();
  const policyNavigation = navigation.possess(
    "selectedPolicyArtifact",
    api.Uri.file(join(TEMP_ROOT, "policy.json")),
    "Policy\n\u001b[31m[run](command:evil)",
  );
  const identityNavigation = navigation.possess("evaluationIdentity", virtualUris.evaluationIdentity, "Identity");
  const outcomeNavigation = navigation.possess("evaluationOutcome", virtualUris.evaluationOutcome, "Outcome");
  const evidence = Object.freeze([
    Object.freeze({ evidence: Object.freeze({
      contextDigest: digest("3"),
      domain: "observations",
      factIdentifier: digest("4"),
      kind: "MemoryOSPolicyFactReference",
      source: Object.freeze({ contextDigest: digest("3"), kind: "policyFactContext" }),
    }) }),
    Object.freeze({ evidence: Object.freeze({
      domain: "cognitiveRegression",
      factDomain: "findings",
      kind: "MemoryOSPolicyFactSelection",
      matchCount: 2,
      matchedFactIdentifiers: Object.freeze([digest("9"), digest("8")]),
      selector: Object.freeze({ identifier: "selector-z", parameters: Object.freeze({ category: "reflection" }), version: "1.0.0" }),
      source: Object.freeze({ externalSourceDigest: digest("5"), kind: "deterministicFactSource" }),
    }) }),
    Object.freeze({ evidence: Object.freeze({
      availability: "notApplicable",
      domain: "verification",
      kind: "MemoryOSPolicyFactDomainState",
      source: Object.freeze({ contextDigest: digest("3"), kind: "policyFactContext" }),
    }) }),
    Object.freeze({ evidence: Object.freeze({
      domain: "cognitiveRegression",
      kind: "MemoryOSDeterministicFactSourceAbsence",
    }) }),
  ]);
  const rule = (identifier) => Object.freeze({
    decision: "COULD_NOT_EVALUATE",
    decisionCode: "RULE_FACTS_UNAVAILABLE",
    evidence,
    ruleIdentifier: identifier,
    ruleType: "memoryos.prohibit-regression-findings",
    ruleVersion: "1.0.0",
  });
  const snapshot = Object.freeze({ evaluation: Object.freeze({
    artifactIdentifier: "set-z",
    artifactKind: "Policy Set",
    decision: "COULD_NOT_EVALUATE",
    evaluationIdentityDigest: digest("6"),
    identityDocument: identityNavigation,
    outcomeDigest: digest("7"),
    outcomeDocument: outcomeNavigation,
    policies: Object.freeze([
      Object.freeze({ decision: "COULD_NOT_EVALUATE", policyIdentifier: "z-child", policySemanticDigest: digest("a"), rules: Object.freeze([rule("z-rule"), rule("a-rule")]) }),
      Object.freeze({ decision: "PASS", policyIdentifier: "a-child", policySemanticDigest: digest("b"), rules: Object.freeze([]) }),
    ]),
    selectedArtifacts: Object.freeze([policyNavigation]),
    semanticDigest: digest("c"),
  }) });

  const provider = new api.MemoryOSResultsTreeProvider(navigation);
  let changes = 0;
  provider.onDidChangeTreeData(() => { changes += 1; });
  provider.replace(snapshot);
  assert.equal(changes, 1);
  const roots = provider.getChildren();
  assert.deepEqual(roots.map(({ label }) => label), ["Evaluation Summary", "Policies"]);
  assert.deepEqual(roots[1].children.map(({ label }) => label), ["1. z-child", "2. a-child"]);
  const rules = findNode(roots[1].children[0], ({ label }) => label === "Rules");
  assert.deepEqual(rules.children.map(({ label }) => label), ["1. z-rule", "2. a-rule"]);
  const evidenceRoot = findNode(rules.children[0], ({ label }) => label === "Evidence");
  assert.deepEqual(evidenceRoot.children.map(({ label }) => label), [
    "Evidence 1: MemoryOSPolicyFactReference",
    "Evidence 2: MemoryOSPolicyFactSelection",
    "Evidence 3: MemoryOSPolicyFactDomainState",
    "Evidence 4: MemoryOSDeterministicFactSourceAbsence",
  ]);
  assert.equal(findNode(evidenceRoot.children[1], ({ label }) => label === "Fact domain").description, "findings");
  assert.equal(findNode(evidenceRoot.children[1], ({ label }) => label === "External source digest").description, digest("5"));
  assert.deepEqual(
    findNode(evidenceRoot.children[1], ({ label }) => label === "Matched fact identifiers").children.map(({ description }) => description),
    [digest("9"), digest("8")],
  );

  const artifactNode = findNode(roots[0], ({ navigation: value }) => value === policyNavigation);
  const item = provider.getTreeItem(artifactNode);
  assert.equal(typeof item.label, "string");
  assert.doesNotMatch(item.label, /[\u0000-\u001f\u007f-\u009f]/u);
  assert.equal(item.command.command, "vscode.open");
  assert.deepEqual(item.command.arguments, [policyNavigation.uri]);
  navigation.revokeAll();
  assert.equal(navigation.openCommand(policyNavigation), undefined);

  provider.replace(Object.freeze({ preparedArtifact: Object.freeze({
    artifactKind: "Policy",
    documentDigest: digest("d"),
    semanticDigest: digest("e"),
    sourceArtifact: navigation.possess("selectedPolicyArtifact", api.Uri.file(join(TEMP_ROOT, "new.json")), "New"),
    state: "Prepared",
  }) }));
  assert.equal(changes, 2);
  assert.deepEqual(provider.getChildren().map(({ label }) => label), ["Prepared Artifact"]);
  provider.dispose();
  virtual.dispose();
  navigation.dispose();
});

test("status and bounded output preserve decisions/codes while neutralizing hostile presentation text", () => {
  api.resetMockVSCode();
  const statusItem = api.window.createStatusBarItem("memoryos.status", api.StatusBarAlignment.Left, 10);
  const status = new api.MemoryOSStatusController(statusItem);
  assert.equal(statusItem.visible, false);
  for (const decision of ["PASS", "FAIL", "COULD_NOT_EVALUATE"]) {
    status.publish({ decision, kind: "decision" });
    assert.match(statusItem.text, new RegExp(decision));
    assert.equal(statusItem.visible, true);
  }
  status.publish({ kind: "prepared" });
  assert.match(statusItem.text, /Prepared/u);
  status.publish({ kind: "verified" });
  assert.match(statusItem.text, /Verified/u);
  status.publish({ code: "BAD\n\u001b[31m[run](command:evil)", kind: "toolError" });
  assert.doesNotMatch(String(statusItem.tooltip), /[\n\u001b]/u);

  const channel = api.window.createOutputChannel("MemoryOS", { log: true });
  const output = new api.MemoryOSBoundedOutput(channel);
  output.write("error", "POLICY_SCHEMA_INVALID", "bad\n\u001b[31m body", {
    file: "[run](command:evil)\nprivate.mip",
  });
  assert.equal(channel.lines.length, 1);
  assert.match(channel.lines[0].value, /^\[POLICY_SCHEMA_INVALID\]/u);
  assert.doesNotMatch(channel.lines[0].value, /[\n\u001b]/u);
  assert.throws(() => output.write("info", "not-a-code", "ignored"));
  output.dispose();
  status.dispose();
  assert.equal(channel.disposed, true);
  assert.equal(statusItem.disposed, true);
});

test("operation coordinator rejects concurrency and prevents cancelled or stale publication", async () => {
  const publications = [];
  const coordinator = new api.ProductOperationCoordinator({ publish(value) { publications.push(value); } });
  let release;
  const blocked = new Promise((resolvePromise) => { release = resolvePromise; });
  const first = coordinator.run("showContractIdentities", undefined, async (signal) => {
    await blocked;
    return {
      canonicalText: "{}",
      contractArtifactSha256: digest("1"),
      identities: Object.freeze({}),
      runtimeClosureDigest: digest("2"),
      signal,
    };
  });
  await assert.rejects(
    coordinator.run("showContractIdentities", undefined, async () => ({})),
    assertCode("MEMORYOS_VSCODE_OPERATION_IN_PROGRESS"),
  );
  coordinator.cancelActive();
  release();
  await assert.rejects(first, assertCode("MEMORYOS_VSCODE_CANCELLED"));
  assert.equal(publications.length, 0);

  const result = await coordinator.run("showContractIdentities", undefined, async () => ({
    canonicalText: "{}",
    contractArtifactSha256: digest("1"),
    identities: Object.freeze({}),
    runtimeClosureDigest: digest("2"),
  }));
  assert.equal(result.canonicalText, "{}");
  assert.equal(publications.length, 1);
  assert.equal(publications[0].operationToken, "memoryos-operation-2");
  await coordinator.dispose();
  await assert.rejects(
    coordinator.run("showContractIdentities", undefined, async () => result),
    assertCode("MEMORYOS_VSCODE_WORKER_FAILED"),
  );
});

test("assembled VS Code product delegates real identities and Policy preparation through the mocked host", async () => {
  api.resetMockVSCode();
  const context = api.createMockExtensionContext(PACKAGE_ROOT);
  const cliAdapter = api.createCliAdapter({
    extensionRoot: PACKAGE_ROOT,
    workerScriptPath: WORKER_BUNDLE,
  });
  const product = api.createMemoryOSVSCodeProduct(cliAdapter);
  api.registerMemoryOSCommands(context, product);
  try {
    const identities = await api.commands.executeCommand("memoryos.showContractIdentities");
    assert.equal(identities.identities.kind, "MemoryOSPolicyContractIdentities");

    const stateAfterIdentities = api.getMockVSCodeState();
    assert.equal(stateAfterIdentities.treeProviders.size, 1);
    assert.equal(stateAfterIdentities.textProviders.size, 1);
    assert.equal(stateAfterIdentities.progressCalls.length, 1);
    const tree = stateAfterIdentities.treeProviders.get("memoryos.results");
    assert.deepEqual(tree.getChildren().map(({ label }) => label), ["Contracts"]);
    const identityDocumentNode = findNode(
      tree.getChildren()[0],
      ({ id }) => id === "contracts/document",
    );
    assert.notEqual(identityDocumentNode, undefined);
    assert.equal(tree.getTreeItem(identityDocumentNode).command.command, "vscode.open");
    const identityDocument = await api.workspace.openTextDocument(identityDocumentNode.navigation.uri);
    assert.equal(identityDocument.getText(), identities.canonicalText);

    api.queueQuickPick("Policy");
    const policyUri = api.Uri.file(join(HOSTED_ROOT, "pass.memoryos-policy.json"));
    const prepared = await api.commands.executeCommand(
      "memoryos.preparePolicyArtifact",
      policyUri,
    );
    assert.equal(prepared.state, "Prepared");
    assert.equal(prepared.kind, "policy");

    const stateAfterPreparation = api.getMockVSCodeState();
    assert.equal(stateAfterPreparation.progressCalls.length, 2);
    assert.equal(stateAfterPreparation.errorMessages.length, 0);
    assert.equal(stateAfterPreparation.statusBarItems.length, 1);
    assert.equal(stateAfterPreparation.statusBarItems[0].visible, true);
    assert.match(stateAfterPreparation.statusBarItems[0].text, /Prepared/u);
    const rootsAfterPreparation = tree.getChildren();
    const preparedRoot = rootsAfterPreparation.find(({ label }) => label === "Prepared Artifact");
    assert.notEqual(preparedRoot, undefined);
    const preparedSourceNode = findNode(preparedRoot, ({ id }) => id === "prepared/source");
    assert.notEqual(preparedSourceNode, undefined);
    assert.equal(tree.getTreeItem(preparedSourceNode).command.command, "vscode.open");
    assert.equal(preparedSourceNode.navigation.uri.toString(true), policyUri.toString(true));

    const contractsAfterPreparation = rootsAfterPreparation.find(({ label }) => label === "Contracts");
    assert.notEqual(contractsAfterPreparation, undefined);
    const remintedIdentityNode = findNode(
      contractsAfterPreparation,
      ({ id }) => id === "contracts/document",
    );
    assert.notEqual(remintedIdentityNode, undefined);
    assert.notEqual(remintedIdentityNode.navigation, identityDocumentNode.navigation);
    assert.equal(tree.getTreeItem(remintedIdentityNode).command.command, "vscode.open");
    assert.equal(
      remintedIdentityNode.navigation.uri.toString(true),
      identityDocumentNode.navigation.uri.toString(true),
    );

    await api.commands.executeCommand("memoryos.showContractIdentities");
    assert.equal(stateAfterPreparation.statusBarItems[0].visible, false);
    assert.deepEqual(tree.getChildren().map(({ label }) => label), ["Contracts"]);
  } finally {
    await product.dispose();
    await disposeContext(context);
  }

  const disposed = api.getMockVSCodeState();
  assert.equal(disposed.commands.size, 0);
  assert.equal(disposed.treeProviders.size, 0);
  assert.equal(disposed.textProviders.size, 0);
  assert.equal(disposed.outputChannels[0].disposed, true);
  assert.equal(disposed.statusBarItems[0].disposed, true);
});

test("real verified runtime drives identities, Policy/Set preparation, PASS/FAIL/CNE, Regression, and verification", async () => {
  const publications = [];
  const { controller } = realController(publications);
  try {
    const identities = await controller.showContractIdentities();
    assert.equal(identities.identities.kind, "MemoryOSPolicyContractIdentities");
    assert.equal(identities.canonicalText, JSON.stringify(identities.identities));

    const preparedPolicy = await controller.preparePolicyArtifact({
      policy: { artifact: selected(join(HOSTED_ROOT, "pass.memoryos-policy.json")), kind: "policy" },
    });
    assert.equal(preparedPolicy.state, "Prepared");
    assert.match(preparedPolicy.documentDigest, /^sha256:[0-9a-f]{64}$/u);
    assert.match(preparedPolicy.semanticDigest, /^sha256:[0-9a-f]{64}$/u);
    const preparedSet = await controller.preparePolicyArtifact({
      policy: { artifact: selected(POLICY_SET), kind: "policySet" },
    });
    assert.equal(preparedSet.kind, "policySet");

    const evaluations = new Map();
    for (const [name, expected] of [
      ["pass", "PASS"],
      ["fail", "FAIL"],
      ["cne", "COULD_NOT_EVALUATE"],
    ]) {
      const evaluation = await controller.evaluatePolicyArtifact({
        candidateMip: selected(CANDIDATE_MIP),
        policy: { artifact: selected(join(HOSTED_ROOT, `${name}.memoryos-policy.json`)), kind: "policy" },
      });
      assert.equal(evaluation.decision, expected);
      assert.equal(evaluation.outcomeValue.result.decision, expected);
      assert.equal(evaluation.evaluationIdentityCanonicalText, JSON.stringify(evaluation.evaluationIdentityValue));
      assert.equal(evaluation.outcomeCanonicalText, JSON.stringify(evaluation.outcomeValue));
      evaluations.set(name, evaluation);
    }

    const regression = await controller.evaluatePolicyArtifact({
      baselineMip: selected(CANDIDATE_MIP),
      candidateMip: selected(CANDIDATE_MIP),
      policy: { artifact: selected(join(HOSTED_ROOT, "cne.memoryos-policy.json")), kind: "policy" },
    });
    assert.equal(regression.decision, "PASS");
    assert.equal(regression.baselineMipUri, api.Uri.file(CANDIDATE_MIP).toString(true));

    const pass = evaluations.get("pass");
    const identityPath = join(TEMP_ROOT, "verified-evaluation-identity.json");
    const outcomePath = join(TEMP_ROOT, "verified-policy-outcome.json");
    await writeFile(identityPath, pass.evaluationIdentityCanonicalText);
    await writeFile(outcomePath, pass.outcomeCanonicalText);
    const artifactIdentity = await controller.verifyEvaluationIdentity({
      expectedEvaluationIdentityDigest: pass.evaluationIdentityDigest,
      identity: selected(identityPath),
      mode: "artifact",
    });
    assert.equal(artifactIdentity.state, "Verified");
    assert.equal(artifactIdentity.verificationScope, "serializedArtifact");
    const reconstructedIdentity = await controller.verifyEvaluationIdentity({
      evaluation: {
        candidateMip: selected(CANDIDATE_MIP),
        policy: { artifact: selected(join(HOSTED_ROOT, "pass.memoryos-policy.json")), kind: "policy" },
      },
      identity: selected(identityPath),
      mode: "evaluation",
    });
    assert.equal(reconstructedIdentity.verificationScope, "authoritativeReconstruction");
    const artifactOutcome = await controller.verifyPolicyOutcome({
      expectedEvaluationIdentityDigest: pass.evaluationIdentityDigest,
      expectedOutcomeDigest: pass.outcomeDigest,
      mode: "artifact",
      outcome: selected(outcomePath),
    });
    assert.equal(artifactOutcome.decision, "PASS");
    const reconstructedOutcome = await controller.verifyPolicyOutcome({
      evaluation: {
        candidateMip: selected(CANDIDATE_MIP),
        policy: { artifact: selected(join(HOSTED_ROOT, "pass.memoryos-policy.json")), kind: "policy" },
      },
      expectedOutcomeDigest: pass.outcomeDigest,
      mode: "evaluation",
      outcome: selected(outcomePath),
    });
    assert.equal(reconstructedOutcome.decision, "PASS");

    assert.equal(publications.length, 11);
    assert.deepEqual(
      publications.map(({ operationKind }) => operationKind),
      [
        "showContractIdentities",
        "preparePolicyArtifact", "preparePolicyArtifact",
        "evaluatePolicyArtifact", "evaluatePolicyArtifact", "evaluatePolicyArtifact", "evaluatePolicyArtifact",
        "verifyEvaluationIdentity", "verifyEvaluationIdentity",
        "verifyPolicyOutcome", "verifyPolicyOutcome",
      ],
    );
  } finally {
    await controller.dispose();
  }
});

test("real runtime failures remain tool errors and a tampered generation is never published", async () => {
  const invalidPolicy = join(TEMP_ROOT, "invalid-policy.json");
  await writeFile(invalidPolicy, "{}", "utf8");
  const firstPublications = [];
  const first = realController(firstPublications);
  try {
    await assert.rejects(
      first.controller.preparePolicyArtifact({
        policy: { artifact: selected(invalidPolicy), kind: "policy" },
      }),
      (error) => {
        assert.equal(error?.name, "MemoryOSProductCliError");
        assert.match(error?.code ?? "", /^[A-Z][A-Z0-9_]*$/u);
        assert.notEqual(error?.code, "COULD_NOT_EVALUATE");
        return true;
      },
    );
    assert.equal(firstPublications.length, 0);
  } finally {
    await first.controller.dispose();
  }

  const realAdapter = api.createCliAdapter({ extensionRoot: PACKAGE_ROOT, workerScriptPath: WORKER_BUNDLE });
  const tamperingAdapter = Object.freeze({
    preflight: (signal) => realAdapter.preflight(signal),
    async execute(request, signal) {
      const result = await realAdapter.execute(request, signal);
      if (request.kind === "evaluate") {
        await writeFile(request.outcomeDigestOutputPath, digest("f"), "ascii");
      }
      return result;
    },
    dispose: () => realAdapter.dispose(),
  });
  const tamperedPublications = [];
  const tampered = realController(tamperedPublications, tamperingAdapter);
  try {
    await assert.rejects(
      tampered.controller.evaluatePolicyArtifact({
        candidateMip: selected(CANDIDATE_MIP),
        policy: { artifact: selected(join(HOSTED_ROOT, "pass.memoryos-policy.json")), kind: "policy" },
      }),
      assertCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
    );
    assert.equal(tamperedPublications.length, 0);
  } finally {
    await tampered.controller.dispose();
  }
});

test("post-CLI verification rereads remain bound to the acquired private bytes", async (t) => {
  const cases = [
    {
      name: "Evaluation Identity",
      pathFromRequest: (request) => request.identityPath,
      result: Object.freeze({
        evaluationIdentityDigest: digest("1"),
        verificationScope: "serializedArtifact",
        verified: true,
      }),
      invoke(controller, sourcePath) {
        return controller.verifyEvaluationIdentity({
          expectedEvaluationIdentityDigest: digest("1"),
          identity: selected(sourcePath),
          mode: "artifact",
        });
      },
    },
    {
      name: "Policy Outcome",
      pathFromRequest: (request) => request.outcomePath,
      result: Object.freeze({
        decision: "PASS",
        evaluationIdentityDigest: digest("2"),
        outcomeDigest: digest("3"),
        verificationScope: "serializedArtifact",
        verified: true,
      }),
      invoke(controller, sourcePath) {
        return controller.verifyPolicyOutcome({
          expectedEvaluationIdentityDigest: digest("2"),
          mode: "artifact",
          outcome: selected(sourcePath),
        });
      },
    },
  ];

  for (const value of cases) {
    await t.test(value.name, async () => {
      const sourcePath = join(TEMP_ROOT, `${value.name.replaceAll(" ", "-").toLowerCase()}-source.json`);
      await writeFile(sourcePath, '{"state":"verified"}', "utf8");
      const publications = [];
      const adapter = Object.freeze({
        async preflight() { throw new Error("not used"); },
        async execute(request) {
          const privatePath = value.pathFromRequest(request);
          await chmod(privatePath, 0o600);
          await writeFile(privatePath, '{"state":"substituted"}', "utf8");
          return Object.freeze({
            envelope: Object.freeze({ ok: true, result: value.result }),
            exitCode: 0,
            stderr: "",
            stdout: "",
          });
        },
        async dispose() {},
      });
      const controller = api.createMemoryOSProductController({
        cliAdapter: adapter,
        publicationSink: Object.freeze({ publish(publication) { publications.push(publication); } }),
      });
      try {
        await assert.rejects(
          value.invoke(controller, sourcePath),
          assertCode("MEMORYOS_VSCODE_OUTPUT_INVALID"),
        );
        assert.equal(publications.length, 0);
      } finally {
        await controller.dispose();
      }
    });
  }
});

test("Phase 2 sources retain the offline native-workbench boundary", async () => {
  const sources = await Promise.all([
    "commands.ts",
    "vscode-product.ts",
    "vscode-input.ts",
    "product/product-controller.ts",
    "product/operation-coordinator.ts",
    "presentation/results-tree.ts",
    "presentation/navigation.ts",
    "presentation/virtual-documents.ts",
  ].map((path) => readFile(join(PACKAGE_ROOT, "src", path), "utf8")));
  const joined = sources.join("\n");
  assert.doesNotMatch(joined, /(?:child_process|\bfetch\s*\(|https?:\/\/|Webview|DiagnosticCollection|isTrusted\s*=\s*true)/u);
  assert.doesNotMatch(joined, /MarkdownString\.isTrusted|command:[A-Za-z]/u);
  assert.doesNotMatch(joined, /investigation-policy-engine|policy-fact-context|regression-policy-fact-source/u);
  assert.match(joined, /createOperationInputSnapshot/u);
  assert.match(joined, /vscode\.open/u);
});
