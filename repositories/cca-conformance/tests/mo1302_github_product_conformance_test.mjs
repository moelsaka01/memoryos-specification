import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  CONFORMANCE_ROOT,
  SUPPORT_ACTION_ROOT,
  WORKFLOW_PATH,
  createZip,
  loadSupportRuntime,
  readInventory,
  readWorkflow,
  workflowUses,
  zipExtra,
} from "./support/mo1302-github-product-support.mjs";

const INPUT_NAMES = Object.freeze([
  "policy-kind",
  "policy-path",
  "expected-policy-semantic-digest",
  "candidate-mip-path",
  "regression-baseline-mip-path",
  "candidate-mip-artifact-name",
  "regression-baseline-mip-artifact-name",
  "retention-days",
]);

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
  "stable-code",
  "failure-class",
  "phase",
  "artifact-kind",
  "limit-identifier",
  "distribution-repository",
  "distribution-revision",
  "artifact-name",
  "artifact-id",
]);

const EXPECTED_PINS = Object.freeze([
  Object.freeze({
    role: "checkout",
    repository: "actions/checkout",
    revision: "3d3c42e5aac5ba805825da76410c181273ba90b1",
  }),
  Object.freeze({
    role: "downloadArtifact",
    repository: "actions/download-artifact",
    revision: "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  }),
  Object.freeze({
    role: "uploadArtifact",
    repository: "actions/upload-artifact",
    revision: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  }),
]);

function childKeys(workflow, label, childIndent) {
  const lines = workflow.split(/\r?\n/u);
  const start = lines.indexOf(label);
  assert.notEqual(start, -1, `missing workflow section ${label.trim()}`);
  const labelIndent = label.length - label.trimStart().length;
  const keys = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= labelIndent) break;
    if (indent === childIndent) {
      const match = /^\s*([a-z0-9-]+):\s*$/u.exec(line);
      if (match) keys.push(match[1]);
    }
  }
  return keys;
}

function prepareInput(overrides = {}) {
  return {
    policyKind: "policy",
    policyPath: "policies/release.memoryos-policy.json",
    expectedPolicySemanticDigest: `sha256:${"a".repeat(64)}`,
    candidateMipPath: "candidate.mip",
    regressionBaselineMipPath: "",
    candidateMipArtifactName: "",
    regressionBaselineMipArtifactName: "",
    retentionDays: "14",
    runId: "123",
    runAttempt: "2",
    checkRunId: "456",
    ...overrides,
  };
}

function gateOutputs(gateClass) {
  const decisions = {
    pass: ["PASS", "0"],
    "policy-fail": ["FAIL", "6"],
    "policy-cne": ["COULD_NOT_EVALUATE", "7"],
  };
  const [decision, exit] = decisions[gateClass] ?? ["", "5"];
  return {
    gateClass,
    decision,
    cliExitCode: exit,
    publicationValid: gateClass === "tool-failure" ? "false" : "true",
    policySemanticDigest: `sha256:${"1".repeat(64)}`,
    evaluationIdentityDigest: `sha256:${"2".repeat(64)}`,
    outcomeDigest: `sha256:${"3".repeat(64)}`,
    policyFactContextDigest: `sha256:${"4".repeat(64)}`,
    regressionSourceDigest: "",
    stableCode: gateClass === "tool-failure" ? "POLICY_SCHEMA_INVALID" : "",
    failureClass: gateClass === "tool-failure" ? "preparation" : "",
    phase: gateClass === "tool-failure" ? "artifactIntake" : "",
    artifactKind: "MemoryOSInvestigationPolicy",
    limitIdentifier: "",
    distributionRepository: "moelsaka01/memoryos-specification",
    distributionRevision: "a".repeat(40),
  };
}

test("reusable workflow freezes exactly eight inputs and eighteen non-path outputs", async () => {
  const workflow = await readWorkflow();
  assert.deepEqual(childKeys(workflow, "    inputs:", 6), INPUT_NAMES);
  assert.deepEqual(childKeys(workflow, "    outputs:", 6), OUTPUT_NAMES);
  assert.match(workflow, /candidate-mip-path:[\s\S]*?required: false\s+default: ""\s+type: string/u);
  assert.match(workflow, /regression-baseline-mip-path:[\s\S]*?required: false\s+default: ""\s+type: string/u);
  assert.match(workflow, /candidate-mip-artifact-name:[\s\S]*?required: false\s+default: ""\s+type: string/u);
  assert.match(workflow, /regression-baseline-mip-artifact-name:[\s\S]*?required: false\s+default: ""\s+type: string/u);
  assert.match(workflow, /retention-days:[\s\S]*?required: false\s+default: 14\s+type: number/u);
  for (const forbidden of ["evaluation-identity-path", "outcome-path", "artifact-directory"]) {
    assert.equal(OUTPUT_NAMES.includes(forbidden), false);
  }
});

test("production runner and permissions are exact, read-only, and fork-safe", async () => {
  const workflow = await readWorkflow();
  assert.match(workflow, /^permissions:\n  actions: read\n  contents: read$/mu);
  assert.match(workflow, /^    name: MemoryOS Policy Gate$/mu);
  assert.match(workflow, /^    runs-on: ubuntu-24\.04$/mu);
  assert.match(workflow, /persist-credentials: false/u);
  for (const forbidden of [
    /^\s*checks:/mu,
    /^\s*pull-requests:/mu,
    /^\s*packages:/mu,
    /^\s*deployments:/mu,
    /^\s*id-token:/mu,
    /^\s*secrets:/mu,
    /pull_request_target/u,
    /self-hosted/u,
    /actions\/cache@/u,
    /^\s*run:/mu,
    /npm\s+(?:ci|install)/u,
  ]) assert.doesNotMatch(workflow, forbidden);
});

test("documentation freezes the canonical GitHub composite required-check identity", async () => {
  const guide = await readFile(resolve(CONFORMANCE_ROOT, "docs/mo1302-github-policy-gate.md"), "utf8");
  assert.match(guide, /canonical caller job identifier is exactly\s+`memoryos-policy-gate`/u);
  assert.match(guide, /^jobs:\n  memoryos-policy-gate:$/mu);
  assert.match(guide, /stable reusable job name `MemoryOS Policy Gate`/u);
  assert.match(guide, /canonical observable\s+required check is exactly\s+`memoryos-policy-gate \/ MemoryOS Policy Gate`/u);
  assert.match(guide, /configure branch protection to\s+require exactly `memoryos-policy-gate \/ MemoryOS Policy Gate`/u);
  assert.match(guide, /deliberately customized, require the resulting actual check identity instead/u);
  assert.match(guide, /check identity\s+is GitHub platform metadata/u);
  assert.match(guide, /does not normalize, override,\s+spoof, or independently publish a replacement check run/u);
  assert.doesNotMatch(guide, /remains blocked|blocked on choosing|currently frozen\s+bare name|contract requests the bare/u);
});

test("production third-party uses are immutable and retained in the final ordered inventory", async () => {
  const workflow = await readWorkflow();
  const inventory = await readInventory();
  assert.ok(inventory.thirdPartyActionPins.scopedFiles.includes(
    ".github/workflows/memoryos-policy-gate.yml",
  ));
  for (const expected of EXPECTED_PINS) {
    assert.ok(inventory.thirdPartyActionPins.pins.some(
      (pin) => JSON.stringify(pin) === JSON.stringify(expected),
    ));
  }
  const uses = workflowUses(workflow);
  const internal = uses.filter((value) => value.startsWith("$/"));
  assert.deepEqual([...new Set(internal)].sort(), [
    "$/.github/actions/memoryos-policy-gate",
    "$/.github/actions/memoryos-policy-gate-workflow-support",
  ]);
  assert.equal(uses.some((value) => value.startsWith("./")), false);
  const thirdParty = uses.filter((value) => !value.startsWith("$/"));
  for (const reference of thirdParty) {
    assert.match(reference, /^[a-z0-9_.-]+\/[a-z0-9_.-]+@[0-9a-f]{40}$/u);
    assert.doesNotMatch(reference, /\$\{\{/u);
  }
  const actual = new Set(thirdParty);
  assert.deepEqual(actual, new Set(EXPECTED_PINS.map(
    ({ repository, revision }) => `${repository}@${revision}`,
  )));
});

test("artifact download is ID-bound and defers every archive write to the validator", async () => {
  const workflow = await readWorkflow();
  assert.equal((workflow.match(/uses: actions\/download-artifact@/gu) ?? []).length, 2);
  assert.equal((workflow.match(/artifact-ids: \$\{\{ steps\.prepare\.outputs\.(?:candidate|baseline)-artifact-id \}\}/gu) ?? []).length, 2);
  assert.equal((workflow.match(/skip-decompress: true/gu) ?? []).length, 2);
  assert.equal((workflow.match(/digest-mismatch: error/gu) ?? []).length, 2);
  assert.doesNotMatch(workflow, /^\s+name: \$\{\{ inputs\.(?:candidate|regression-baseline)-mip-artifact-name \}\}$/mu);
});

test("verified-only upload is a six-file literal allowlist with closed configuration", async () => {
  const workflow = await readWorkflow();
  assert.match(workflow, /if: always\(\) && steps\.policy-gate\.outputs\.publication-valid == 'true'/u);
  const expectedFiles = [
    "evaluation-identity.json",
    "evaluation-identity.sha256",
    "evaluation-outcome.json",
    "evaluation-outcome.sha256",
    "policy-identities.json",
    "gate-receipt.json",
  ];
  const uploadLines = [...workflow.matchAll(/^\s{12}\$\{\{ steps\.policy-gate\.outputs\.artifact-directory \}\}\/([^\r\n]+)$/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(uploadLines, expectedFiles);
  assert.equal(uploadLines.some((path) => /[*?\[]/u.test(path)), false);
  assert.match(workflow, /if-no-files-found: error/u);
  assert.match(workflow, /overwrite: false/u);
  assert.match(workflow, /include-hidden-files: false/u);
  assert.match(workflow, /retention-days: \$\{\{ steps\.prepare\.outputs\.retention-days \}\}/u);
});

test("only the Policy Action is allowed to continue while finalization always runs", async () => {
  const workflow = await readWorkflow();
  assert.equal((workflow.match(/continue-on-error: true/gu) ?? []).length, 1);
  assert.match(workflow, /id: policy-gate\s+continue-on-error: true\s+uses: \$\/\.github\/actions\/memoryos-policy-gate/u);
  assert.match(workflow, /id: finalize\s+if: always\(\)\s+uses: \$\/\.github\/actions\/memoryos-policy-gate-workflow-support/u);
});

test("the token and hostile inputs never cross the Phase 1 Action or a shell boundary", async () => {
  const workflow = await readWorkflow();
  assert.equal((workflow.match(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/gu) ?? []).length, 3);
  const gateBlock = workflow.slice(
    workflow.indexOf("      - name: Evaluate and verify the deterministic Policy gate"),
    workflow.indexOf("      - name: Upload the verified publication generation"),
  );
  assert.doesNotMatch(gateBlock, /GITHUB_TOKEN|\benv:/u);
  assert.doesNotMatch(workflow, /^\s*run:/mu);
  const runtimeFiles = ["archive.js", "finalize.js", "github.js", "index.js", "io.js"];
  for (const file of runtimeFiles) {
    const source = await readFile(resolve(SUPPORT_ACTION_ROOT, "dist", file), "utf8");
    assert.doesNotMatch(source, /node:child_process|\bexec(?:File|Sync)?\s*\(|\bspawn(?:Sync)?\s*\(/u);
    assert.doesNotMatch(source, /https?:\/\/(?!api\.github\.com)/u);
  }
});

test("the additive MO-1302 inventory is closed over Phase 2 implementation, tests, and docs", async () => {
  const inventory = await readInventory();
  assert.equal(inventory.kind, "MemoryOSMO1302ConformanceInventory");
  assert.equal(inventory.version, "1.0.0");
  const phase2Implementation = [
    ".github/actions/memoryos-policy-gate-workflow-support/action.yml",
    ".github/actions/memoryos-policy-gate-workflow-support/dist/archive.js",
    ".github/actions/memoryos-policy-gate-workflow-support/dist/finalize.js",
    ".github/actions/memoryos-policy-gate-workflow-support/dist/github.js",
    ".github/actions/memoryos-policy-gate-workflow-support/dist/index.js",
    ".github/actions/memoryos-policy-gate-workflow-support/dist/io.js",
    ".github/workflows/memoryos-policy-gate.yml",
  ];
  for (const path of phase2Implementation) assert.ok(inventory.implementationSurface.includes(path));
  assert.ok(inventory.conformanceSurface.includes(
    "repositories/cca-conformance/tests/mo1302_github_product_conformance_test.mjs",
  ));
  assert.ok(inventory.conformanceSurface.includes(
    "repositories/cca-conformance/tests/support/mo1302-github-product-support.mjs",
  ));
  assert.ok(inventory.documentationSurface.includes(
    "repositories/cca-conformance/docs/mo1302-github-policy-gate.md",
  ));
  for (const path of [
    ...inventory.implementationSurface,
    ...inventory.conformanceSurface,
    ...inventory.documentationSurface,
  ]) await readFile(resolve(CONFORMANCE_ROOT, "../..", ...path.split("/")));
});

// Runtime-focused tests follow after the internal support Action has been loaded.

test("support Action metadata is a bundled Node 24 adapter with no lifecycle hooks", async () => {
  const metadata = await readFile(resolve(SUPPORT_ACTION_ROOT, "action.yml"), "utf8");
  assert.match(metadata, /^name: MemoryOS Policy Gate Workflow Support$/mu);
  assert.match(metadata, /^  using: node24$/mu);
  assert.match(metadata, /^  main: dist\/index\.js$/mu);
  for (const forbidden of [/^\s*pre:/mu, /^\s*post:/mu, /^\s*branding:/mu]) {
    assert.doesNotMatch(metadata, forbidden);
  }
  const runtime = loadSupportRuntime();
  for (const member of [
    "validatePrepareInputs",
    "listExactArtifact",
    "revalidateArtifact",
    "validateArchive",
    "extractArchive",
    "classifyFinalState",
    "renderSummary",
    "publishPresentation",
  ]) assert.equal(typeof runtime[member], "function");
});

test("candidate and baseline acquisition forms enforce exact XOR semantics", () => {
  const runtime = loadSupportRuntime();
  assert.doesNotThrow(() => runtime.validatePrepareInputs(prepareInput()));
  assert.doesNotThrow(() => runtime.validatePrepareInputs(prepareInput({
    candidateMipPath: "",
    candidateMipArtifactName: "candidate",
  })));
  assert.doesNotThrow(() => runtime.validatePrepareInputs(prepareInput({
    regressionBaselineMipPath: "baseline.mip",
  })));
  assert.doesNotThrow(() => runtime.validatePrepareInputs(prepareInput({
    regressionBaselineMipArtifactName: "baseline",
  })));
  for (const input of [
    prepareInput({ candidateMipPath: "", candidateMipArtifactName: "" }),
    prepareInput({ candidateMipArtifactName: "candidate" }),
    prepareInput({ regressionBaselineMipPath: "a", regressionBaselineMipArtifactName: "b" }),
  ]) assert.throws(() => runtime.validatePrepareInputs(input));
  // Exact raw emptiness is used; a hostile whitespace direct path proceeds to
  // the Phase 1 Action's authoritative PortablePath validation.
  assert.doesNotThrow(() => runtime.validatePrepareInputs(prepareInput({ candidateMipPath: " " })));
});

test("retention accepts only the exact integer range 1 through 90", () => {
  const runtime = loadSupportRuntime();
  for (const retentionDays of ["1", "14", "90"]) {
    assert.equal(runtime.validatePrepareInputs(prepareInput({ retentionDays })).retentionDays, retentionDays);
  }
  for (const retentionDays of ["", "0", "00", "1.0", "1e1", " 14", "14 ", "91", "-1"]) {
    assert.throws(() => runtime.validatePrepareInputs(prepareInput({ retentionDays })));
  }
});

test("artifact names implement the exact closed lexical grammar", () => {
  const runtime = loadSupportRuntime();
  const valid = ["A", `A${"b".repeat(127)}`, "candidate.mip_1-2"];
  for (const value of valid) assert.equal(runtime.validateArtifactName(value), value);
  const invalid = [
    "",
    " candidate",
    "candidate ",
    "candidate name",
    "candidate/mip",
    "candidate\\mip",
    "candidate*",
    "candidate?",
    "${{github.sha}}",
    "https://example.invalid/a",
    `A${"b".repeat(128)}`,
  ];
  for (const value of invalid) assert.throws(() => runtime.validateArtifactName(value));
});

function response(body, status = 200) {
  return { status, async json() { return body; } };
}

test("same-run lookup requires one exact, unexpired artifact and returns its ID", async () => {
  const runtime = loadSupportRuntime();
  const calls = [];
  const identifier = await runtime.listExactArtifact({
    apiUrl: "https://api.github.com",
    repository: "owner/repository",
    runId: "12",
    token: "token",
    name: "candidate",
  }, async (url, options) => {
    calls.push({ url: String(url), options });
    return response({
      total_count: 1,
      artifacts: [{ expired: false, id: 987654321, name: "candidate" }],
    });
  });
  assert.equal(identifier, "987654321");
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.origin, "https://api.github.com");
  assert.equal(url.pathname, "/repos/owner/repository/actions/runs/12/artifacts");
  assert.equal(url.searchParams.get("name"), "candidate");
  assert.equal(url.searchParams.get("per_page"), "2");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.Authorization, "Bearer token");
});

test("same-run lookup rejects missing, ambiguous, expired, mismatched, and broken service results", async () => {
  const runtime = loadSupportRuntime();
  const input = {
    apiUrl: "https://api.github.com",
    repository: "owner/repository",
    runId: "12",
    token: "token",
    name: "candidate",
  };
  const bodies = [
    { total_count: 0, artifacts: [] },
    { total_count: 2, artifacts: [
      { expired: false, id: 1, name: "candidate" },
      { expired: false, id: 2, name: "candidate" },
    ] },
    { total_count: 1, artifacts: [{ expired: true, id: 1, name: "candidate" }] },
    { total_count: 1, artifacts: [{ expired: false, id: 1, name: "other" }] },
  ];
  for (const body of bodies) {
    await assert.rejects(runtime.listExactArtifact(input, async () => response(body)));
  }
  await assert.rejects(runtime.listExactArtifact(input, async () => response({}, 503)));
  await assert.rejects(runtime.listExactArtifact(input, async () => { throw new Error("network"); }));
  await assert.rejects(
    runtime.listExactArtifact(input, async () => response({ total_count: "1", artifacts: [] })),
    (error) => error.code === "MEMORYOS_CI_INTERNAL_FAILURE" && error.phase === "internal",
  );
});

test("prepare generates the exact upload name and uses no GitHub token for direct mode", async () => {
  const runtime = loadSupportRuntime();
  const direct = await runtime.prepare(prepareInput(), {}, async () => {
    throw new Error("direct mode must not access GitHub");
  });
  assert.deepEqual(direct, {
    "candidate-artifact-id": "",
    "baseline-artifact-id": "",
    "upload-artifact-name": "memoryos-policy-gate-123-2-456",
    "retention-days": "14",
  });
});

test("artifact mode resolves by name and revalidates the same sole ID after download", async () => {
  const runtime = loadSupportRuntime();
  const environment = {
    GITHUB_API_URL: "https://api.github.com",
    GITHUB_REPOSITORY: "owner/repository",
    GITHUB_TOKEN: "token",
  };
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response({ total_count: 1, artifacts: [{ expired: false, id: 7, name: "candidate" }] });
  };
  const prepared = await runtime.prepare(prepareInput({
    candidateMipPath: "",
    candidateMipArtifactName: "candidate",
  }), environment, fetchImpl);
  assert.equal(prepared["candidate-artifact-id"], "7");
  await runtime.revalidateArtifact({
    artifactRole: "candidate",
    artifactName: "candidate",
    artifactId: "7",
    runId: "123",
  }, environment, fetchImpl);
  assert.equal(calls, 2);
  await assert.rejects(runtime.revalidateArtifact({
    artifactRole: "candidate",
    artifactName: "candidate",
    artifactId: "8",
    runId: "123",
  }, environment, fetchImpl));
});

test("archive validator accepts one nested regular file with ancestor directories", () => {
  const runtime = loadSupportRuntime();
  const bytes = createZip([
    { name: "nested/", mode: 0o040755 },
    { name: "nested/input.mip", data: "candidate", mode: 0o100600 },
  ]);
  const validated = runtime.validateArchive(bytes);
  assert.equal(validated.path, "nested/input.mip");
  assert.deepEqual(validated.body, Buffer.from("candidate"));
});

test("archive validator supports signed and unsigned streaming data descriptors", () => {
  const runtime = loadSupportRuntime();
  for (const descriptorSignature of [true, false]) {
    const bytes = createZip([{
      name: "input.mip",
      data: "candidate",
      dataDescriptor: true,
      descriptorSignature,
      method: 8,
    }]);
    assert.deepEqual(runtime.validateArchive(bytes).body, Buffer.from("candidate"));
  }
});

test("archive paths reject traversal, absolute, drive, backslash, ADS, and controls", () => {
  const runtime = loadSupportRuntime();
  const names = [
    "../input.mip",
    "a/../input.mip",
    "/input.mip",
    "C:/input.mip",
    "\\\\server\\input.mip",
    "a\\input.mip",
    "input.mip:stream",
    "a//input.mip",
    "./input.mip",
    "input\0.mip",
    "input\nmip",
  ];
  for (const name of names) {
    assert.throws(() => runtime.validateArchive(createZip([{ name, data: "x" }])), name);
  }
});

test("archive names reject duplicate raw, normalized, and case-conflicting identities", () => {
  const runtime = loadSupportRuntime();
  const archives = [
    createZip([{ name: "a.mip", data: "1" }, { name: "a.mip", data: "2" }]),
    createZip([{ name: "caf\u00e9.mip", data: "1" }, { name: "cafe\u0301.mip", data: "2" }]),
    createZip([{ name: "A.mip", data: "1" }, { name: "a.MIP", data: "2" }]),
  ];
  for (const bytes of archives) assert.throws(() => runtime.validateArchive(bytes));
});

test("archive member types reject links, reparse points, devices, FIFO, socket, and unknown types", () => {
  const runtime = loadSupportRuntime();
  const members = [
    { name: "link", data: "x", mode: 0o120777 },
    { name: "hard", data: "x", mode: 0o100600, extra: zipExtra.unix() },
    { name: "reparse", data: "x", externalAttributes: ((0o100600 << 16) | 0x0400) >>> 0 },
    { name: "windows-device", data: "x", externalAttributes: ((0o100600 << 16) | 0x0040) >>> 0 },
    { name: "character", data: "x", mode: 0o020600 },
    { name: "block", data: "x", mode: 0o060600 },
    { name: "fifo", data: "x", mode: 0o010600 },
    { name: "socket", data: "x", mode: 0o140600 },
    { name: "unknown", data: "x", mode: 0o160600 },
  ];
  for (const member of members) {
    assert.throws(() => runtime.validateArchive(createZip([member])), member.name);
  }
});

test("archive member names require strict UTF-8 or unambiguous ASCII", () => {
  const runtime = loadSupportRuntime();
  assert.throws(() => runtime.validateArchive(createZip([{
    name: Buffer.from([0xc3, 0x28]),
    data: "x",
    flags: 0x0800,
  }])));
  assert.throws(() => runtime.validateArchive(createZip([{
    name: Buffer.from([0xc3, 0xa9]),
    data: "x",
    flags: 0,
  }])));
});

test("archive tree requires exactly one leaf and only its ancestor directories", () => {
  const runtime = loadSupportRuntime();
  const invalid = [
    createZip([{ name: "only/", mode: 0o040755 }]),
    createZip([{ name: "a.mip", data: "1" }, { name: "b.mip", data: "2" }]),
    createZip([{ name: "empty/", mode: 0o040755 }, { name: "a.mip", data: "1" }]),
    createZip([
      { name: "nested/", mode: 0o040755, method: 8, data: "" },
      { name: "nested/a.mip", data: "1" },
    ]),
  ];
  for (const bytes of invalid) assert.throws(() => runtime.validateArchive(bytes));
});

test("archive structure rejects encryption, unsupported compression, ZIP64, and multi-disk records", () => {
  const runtime = loadSupportRuntime();
  const invalid = [
    createZip([{ name: "a.mip", data: "1", flags: 0x0801 }]),
    createZip([{ name: "a.mip", data: "1", method: 99 }]),
    createZip([{ name: "a.mip", data: "1", extra: zipExtra.zip64() }]),
    createZip([{ name: "a.mip", data: "1" }], { diskNumber: 1 }),
  ];
  for (const bytes of invalid) assert.throws(() => runtime.validateArchive(bytes));
});

test("archive local headers, descriptors, ranges, and CRC must agree before extraction", () => {
  const runtime = loadSupportRuntime();
  const invalid = [
    createZip([{ name: "a.mip", localName: "b.mip", data: "1" }]),
    createZip([{ name: "a.mip", localMethod: 8, data: "1" }]),
    createZip([{ name: "a.mip", data: "1", crc: 1, localCrc: 1 }]),
    createZip([{
      name: "a.mip",
      data: "1",
      dataDescriptor: true,
      descriptorCrc: 1,
    }]),
    createZip([{ name: "a.mip", data: "1", localHeaderOffset: 1 }]),
  ];
  for (const bytes of invalid) assert.throws(() => runtime.validateArchive(bytes));
});

test("archive extraction validates fully before creating a fresh private workspace tree", async (t) => {
  const runtime = loadSupportRuntime();
  const root = await mkdtemp(join(tmpdir(), "memoryos-mo1302-archive-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const workspace = join(root, "workspace");
  const raw = join(root, "raw");
  await mkdir(workspace);
  await mkdir(raw);
  await writeFile(join(raw, "artifact.zip"), createZip([{ name: "../escape.mip", data: "x" }]));
  await assert.rejects(runtime.extractArchive({ archiveDirectory: raw, artifactRole: "candidate", workspace }));
  assert.deepEqual(await (await import("node:fs/promises")).readdir(workspace), []);

  await writeFile(join(raw, "artifact.zip"), createZip([
    { name: "nested/", mode: 0o040755 },
    { name: "nested/candidate.mip", data: "candidate" },
  ]));
  const extracted = await runtime.extractArchive({ archiveDirectory: raw, artifactRole: "candidate", workspace });
  assert.match(extracted.mipPath, /^\.memoryos-policy-gate-candidate-[^/]+\/nested\/candidate\.mip$/u);
  assert.deepEqual(await readFile(extracted.absolutePath), Buffer.from("candidate"));
  assert.equal(resolve(workspace, ...extracted.mipPath.split("/")), extracted.absolutePath);
});

test("raw download directory rejects zero, multiple, and non-regular archive members", async (t) => {
  const runtime = loadSupportRuntime();
  const root = await mkdtemp(join(tmpdir(), "memoryos-mo1302-raw-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const workspace = join(root, "workspace");
  const raw = join(root, "raw");
  await mkdir(workspace);
  await mkdir(raw);
  await assert.rejects(runtime.extractArchive({ archiveDirectory: raw, artifactRole: "candidate", workspace }));
  await writeFile(join(raw, "a.zip"), createZip([{ name: "a.mip", data: "a" }]));
  await writeFile(join(raw, "b.zip"), createZip([{ name: "b.mip", data: "b" }]));
  await assert.rejects(runtime.extractArchive({ archiveDirectory: raw, artifactRole: "candidate", workspace }));
  await rm(join(raw, "a.zip"));
  await rm(join(raw, "b.zip"));
  await mkdir(join(raw, "not-an-archive"));
  await assert.rejects(runtime.extractArchive({ archiveDirectory: raw, artifactRole: "candidate", workspace }));
});

function finalInput(gateClass, overrides = {}) {
  return {
    checkoutOutcome: "success",
    prepareOutcome: "success",
    candidateDownloadOutcome: "skipped",
    candidateExtractOutcome: "skipped",
    baselineDownloadOutcome: "skipped",
    baselineExtractOutcome: "skipped",
    gateOutcome: gateClass === "pass" ? "success" : "failure",
    uploadOutcome: gateClass === "tool-failure" ? "skipped" : "success",
    uploadArtifactName: "memoryos-policy-gate-123-2-456",
    uploadArtifactId: "789",
    outcomePath: "",
    preGateStableCode: "",
    preGatePhase: "",
    ...gateOutputs(gateClass),
    ...overrides,
  };
}

test("final state preserves PASS, FAIL, and CNE while publishing verified artifacts", () => {
  const runtime = loadSupportRuntime();
  for (const gateClass of ["pass", "policy-fail", "policy-cne"]) {
    const output = runtime.assertPublicOutputs(runtime.classifyFinalState(finalInput(gateClass)));
    assert.equal(output["gate-class"], gateClass);
    assert.equal(output["publication-valid"], "true");
    assert.equal(output["artifact-name"], "memoryos-policy-gate-123-2-456");
    assert.equal(output["artifact-id"], "789");
    assert.deepEqual(Object.keys(output), OUTPUT_NAMES);
  }
});

test("an unverified or partial generation is never assigned artifact transport identity", () => {
  const runtime = loadSupportRuntime();
  const output = runtime.classifyFinalState(finalInput("tool-failure"));
  assert.equal(output["gate-class"], "tool-failure");
  assert.equal(output.decision, "");
  assert.equal(output["publication-valid"], "false");
  assert.equal(output["artifact-name"], "");
  assert.equal(output["artifact-id"], "");
  assert.equal(output["stable-code"], "POLICY_SCHEMA_INVALID");
});

test("late upload failure preserves the verified local generation and exact classification", () => {
  const runtime = loadSupportRuntime();
  const input = finalInput("policy-fail", { uploadOutcome: "failure", uploadArtifactId: "" });
  const output = runtime.classifyFinalState(input);
  assert.equal(output["gate-class"], "tool-failure");
  assert.equal(output.decision, "");
  assert.equal(output["stable-code"], "MEMORYOS_CI_ARTIFACT_PUBLICATION_FAILED");
  assert.equal(output["failure-class"], "automation");
  assert.equal(output.phase, "artifactPublication");
  assert.equal(output["publication-valid"], "true");
  assert.equal(output["cli-exit-code"], "6");
  for (const name of [
    "policy-semantic-digest",
    "evaluation-identity-digest",
    "outcome-digest",
    "policy-fact-context-digest",
    "distribution-repository",
    "distribution-revision",
  ]) assert.equal(output[name], runtime.classifyFinalState(finalInput("policy-fail"))[name]);
  assert.equal(output["artifact-name"], "");
  assert.equal(output["artifact-id"], "");
});

test("pre-gate support classifications are propagated without semantic recomputation", () => {
  const runtime = loadSupportRuntime();
  const invalidInput = runtime.classifyFinalState(finalInput("tool-failure", {
    prepareOutcome: "failure",
    preGateStableCode: "MEMORYOS_CI_INPUT_PATH_INVALID",
    preGatePhase: "actionInput",
  }));
  assert.equal(invalidInput["stable-code"], "MEMORYOS_CI_INPUT_PATH_INVALID");
  assert.equal(invalidInput.phase, "actionInput");
  const service = runtime.classifyFinalState(finalInput("tool-failure", {
    prepareOutcome: "failure",
    preGateStableCode: "MEMORYOS_CI_INTERNAL_FAILURE",
    preGatePhase: "internal",
  }));
  assert.equal(service["stable-code"], "MEMORYOS_CI_INTERNAL_FAILURE");
  assert.equal(service.phase, "internal");
  const download = runtime.classifyFinalState(finalInput("tool-failure", {
    candidateDownloadOutcome: "failure",
  }));
  assert.equal(download["stable-code"], "MEMORYOS_CI_INTERNAL_FAILURE");
  assert.equal(download.phase, "internal");
  const extraction = runtime.classifyFinalState(finalInput("tool-failure", {
    candidateExtractOutcome: "failure",
  }));
  assert.equal(extraction["stable-code"], "MEMORYOS_CI_INPUT_PATH_INVALID");
  assert.equal(extraction.phase, "evaluationInput");
});

test("final conclusion is derived only from the frozen gate class", async () => {
  const runtime = loadSupportRuntime();
  for (const [gateClass, failed] of [
    ["pass", false],
    ["policy-fail", true],
    ["policy-cne", true],
    ["tool-failure", true],
  ]) {
    const input = finalInput(gateClass);
    const environment = {
      "INPUT_MODE": "finalize",
      "INPUT_CHECKOUT-OUTCOME": input.checkoutOutcome,
      "INPUT_PREPARE-OUTCOME": input.prepareOutcome,
      "INPUT_CANDIDATE-DOWNLOAD-OUTCOME": input.candidateDownloadOutcome,
      "INPUT_CANDIDATE-EXTRACT-OUTCOME": input.candidateExtractOutcome,
      "INPUT_BASELINE-DOWNLOAD-OUTCOME": input.baselineDownloadOutcome,
      "INPUT_BASELINE-EXTRACT-OUTCOME": input.baselineExtractOutcome,
      "INPUT_GATE-OUTCOME": input.gateOutcome,
      "INPUT_UPLOAD-OUTCOME": input.uploadOutcome,
      "INPUT_UPLOAD-ARTIFACT-NAME": input.uploadArtifactName,
      "INPUT_UPLOAD-ARTIFACT-ID": input.uploadArtifactId,
      "INPUT_GATE-CLASS": input.gateClass,
      "INPUT_DECISION": input.decision,
      "INPUT_CLI-EXIT-CODE": input.cliExitCode,
      "INPUT_PUBLICATION-VALID": input.publicationValid,
      "INPUT_POLICY-SEMANTIC-DIGEST": input.policySemanticDigest,
      "INPUT_EVALUATION-IDENTITY-DIGEST": input.evaluationIdentityDigest,
      "INPUT_OUTCOME-DIGEST": input.outcomeDigest,
      "INPUT_POLICY-FACT-CONTEXT-DIGEST": input.policyFactContextDigest,
      "INPUT_REGRESSION-SOURCE-DIGEST": input.regressionSourceDigest,
      "INPUT_STABLE-CODE": input.stableCode,
      "INPUT_FAILURE-CLASS": input.failureClass,
      "INPUT_PHASE": input.phase,
      "INPUT_ARTIFACT-KIND": input.artifactKind,
      "INPUT_LIMIT-IDENTIFIER": input.limitIdentifier,
      "INPUT_DISTRIBUTION-REPOSITORY": input.distributionRepository,
      "INPUT_DISTRIBUTION-REVISION": input.distributionRevision,
    };
    const result = await runtime.runMode({
      environment,
      presentation: { summaryPath: "", stream: { write() {} } },
    });
    assert.equal(result.failed, failed);
    assert.equal(result.output["gate-class"], gateClass);
  }
});

function presentationOutcome(ruleCount = 1, malicious = false) {
  const rules = [];
  for (let index = 0; index < ruleCount; index += 1) {
    rules.push({
      decision: "FAIL",
      decisionCode: `RULE_${index}_FAILED`,
      evidence: [{
        domain: "observations",
        factIdentifier: `sha256:${String(index).padStart(64, "0")}`,
        kind: "MemoryOSPolicyFactReference",
        source: { contextDigest: `sha256:${"4".repeat(64)}`, kind: "policyFactContext" },
        value: "SECRET FACT VALUE",
      }],
      ruleIdentifier: malicious && index === 0 ? "rule\n::error title=pwned::x\0\u2028" : `rule-${index}`,
      ruleType: "memoryos.require-verification-completed",
      ruleVersion: "1.0.0",
    });
  }
  return {
    evaluationIdentity: {
      evaluatedArtifact: { kind: "MemoryOSInvestigationPolicy" },
    },
    message: "SECRET MESSAGE",
    details: ["SECRET DETAILS"],
    result: {
      decision: "FAIL",
      kind: "MemoryOSPolicyResult",
      policyIdentifier: malicious ? "policy|<script>\nnext" : "policy",
      ruleResults: rules,
    },
  };
}

test("Step Summary is bounded, escaped, and excludes facts and human diagnostics", () => {
  const runtime = loadSupportRuntime();
  const summary = runtime.renderSummary(
    runtime.classifyFinalState(finalInput("policy-fail")),
    presentationOutcome(5, true),
  );
  assert.ok(Buffer.byteLength(summary, "utf8") <= 32_768);
  assert.doesNotMatch(summary, /SECRET FACT VALUE|SECRET MESSAGE|SECRET DETAILS|<script>|::error/u);
  assert.match(summary, /Evidence reference/u);
  assert.match(summary, /factIdentifier/u);
  assert.doesNotMatch(summary, /"value"/u);
  for (const gateClass of ["pass", "policy-fail", "policy-cne", "tool-failure"]) {
    assert.match(
      runtime.renderSummary(runtime.classifyFinalState(finalInput(gateClass)), presentationOutcome()),
      new RegExp(gateClass.replace("-", "\\\\-"), "u"),
    );
  }
  const oversized = runtime.renderSummary(
    runtime.classifyFinalState(finalInput("policy-fail")),
    presentationOutcome(200, true),
  );
  assert.equal(Buffer.byteLength(oversized, "utf8"), 32_768);
  assert.doesNotMatch(oversized, /\ufffd/u);
});

test("annotations emit no PASS error, one fixed top error otherwise, and at most four ordered notices", () => {
  const runtime = loadSupportRuntime();
  function capture(gateClass, outcome) {
    let text = "";
    runtime.publishPresentation(
      runtime.classifyFinalState(finalInput(gateClass)),
      outcome,
      { summaryPath: "", stream: { write(value) { text += value; } } },
    );
    return text;
  }
  assert.equal(capture("pass", null), "");
  for (const gateClass of ["policy-fail", "policy-cne", "tool-failure"]) {
    const output = capture(gateClass, presentationOutcome(6, true));
    assert.equal((output.match(/^::error /gmu) ?? []).length, 1);
    assert.equal((output.match(/^::notice /gmu) ?? []).length, 4);
    assert.doesNotMatch(output, /\0|\u2028|\u2029|\n::error title=pwned/u);
    assert.match(output, /RULE_0_FAILED[\s\S]*RULE_1_FAILED[\s\S]*RULE_2_FAILED[\s\S]*RULE_3_FAILED/u);
  }
});

test("presentation sink failures leave final machine state and conclusion unchanged", () => {
  const runtime = loadSupportRuntime();
  const state = runtime.classifyFinalState(finalInput("policy-fail"));
  const before = structuredClone(state);
  assert.doesNotThrow(() => runtime.publishPresentation(state, presentationOutcome(1), {
    summaryPath: join(tmpdir(), "missing-parent", "summary.md"),
    stream: { write() { throw new Error("sink unavailable"); } },
  }));
  assert.deepEqual(state, before);
  assert.equal(state["gate-class"], "policy-fail");
});
