import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONFORMANCE_ROOT,
  REFERENCE_NATIVE_PROFILE,
  buildReport,
  buildRequirementEvidence,
  canonicalJson,
  executedGroupEvidence,
  readManifest,
  reconcileGroupEvidence,
  requirementEvidenceInputs,
  sha256,
} from "./support/conformance-support.mjs";

const FIXTURE_FLAG = "--environment-variation-fixture";
const SELECTOR = "CCA-MOS-CONF-003: evidence and reports are invariant under irrelevant environment and presentation variation";
const SPECIFICATION_SOURCE = "repositories/cca-conformance/tests/specification_conformance_test.mjs";
const THIS_FILE = fileURLToPath(import.meta.url);
const README_PATH = resolve(CONFORMANCE_ROOT, "README.md");
const CREATE_REVIEW_TOOL = resolve(CONFORMANCE_ROOT, "tools/create-review-attestations.mjs");
const CONFORMANCE_REPORT_TOOL = resolve(CONFORMANCE_ROOT, "tools/conformance-report.mjs");
const REFERENCE_EVIDENCE_TOOL = resolve(CONFORMANCE_ROOT, "tools/run-reference-evidence.mjs");
const INDEPENDENT_ASSESSMENT_TOOL = resolve(CONFORMANCE_ROOT, "tools/independent-assessment.mjs");
const PORTABLE_REPORT_TOOL = resolve(CONFORMANCE_ROOT, "tools/portable-report.mjs");
const STANDARD_ROOT = resolve(
  CONFORMANCE_ROOT,
  "../../../cca-specifications/specifications/CCA-MEMORYOS-1.0",
);
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function withoutAnsi(value) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");
}

function tapOutcomes(output) {
  const lines = withoutAnsi(output).split(/\r?\n/u);
  const outcomes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const selector = /^(?:# )*# Subtest: (.+)$/u.exec(lines[index])?.[1];
    if (!selector) continue;
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 8); cursor += 1) {
      const outcome = /^(?:# )*(ok|not ok) [0-9]+ - /u.exec(lines[cursor]);
      if (!outcome) continue;
      outcomes.push({
        source: SPECIFICATION_SOURCE,
        selector,
        status: /# SKIP/u.test(lines[cursor])
          ? "SKIP"
          : outcome[1] === "ok" ? "PASS" : "FAIL",
      });
      break;
    }
  }
  return outcomes.sort((left, right) => compare(left.selector, right.selector));
}

function runSpecificationConformance() {
  const environment = {
    ...process.env,
    MEMORYOS_REQUIRE_PUBLISHED_STANDARD: "1",
    MEMORYOS_STANDARD_ROOT: STANDARD_ROOT,
  };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.NODE_TEST_NAME_PATTERN;
  delete environment.NODE_TEST_REPORTER;
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-reporter=tap",
      resolve(CONFORMANCE_ROOT, "tests/specification_conformance_test.mjs"),
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    },
  );
  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `specification conformance failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
  const outcomes = tapOutcomes(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  assert.ok(outcomes.length > 0, "specification conformance emitted no selector outcomes");
  assert.equal(new Set(outcomes.map(({ selector }) => selector)).size, outcomes.length);
  assert.deepEqual(outcomes.filter(({ status }) => status !== "PASS"), []);
  return outcomes;
}

function syntheticExecutions(manifest, specificationOutcomes) {
  const specificationBySelector = new Map(
    specificationOutcomes.map((outcome) => [outcome.selector, outcome]),
  );
  const identifiers = [...new Set(
    manifest.requirements.flatMap(({ executionReferences }) => executionReferences),
  )].sort(compare);
  return identifiers.map((id) => {
    const checks = [...new Map(
      manifest.requirements
        .flatMap(({ coverageSelectors }) => coverageSelectors)
        .filter(({ executionReference }) => executionReference === id)
        .map(({ source, selector }) => {
          const observed = id === "specification-js"
            ? specificationBySelector.get(selector)
            : null;
          if (id === "specification-js") {
            assert.ok(observed, `specification selector was not executed: ${selector}`);
            assert.equal(observed.source, source);
          }
          const check = { source, selector, status: observed?.status ?? "PASS" };
          return [`${source}\0${selector}`, check];
        }),
    ).values()].sort((left, right) => compare(
      `${left.source}\0${left.selector}`,
      `${right.source}\0${right.selector}`,
    ));
    return { id, status: "PASS", exitCode: 0, checks };
  });
}

function reviewAttestations(manifest, implementation) {
  return manifest.requirements
    .filter(({ verification }) => verification !== "automated")
    .map((requirement, index) => ({
      requirementId: requirement.id,
      implementation,
      artifacts: requirementEvidenceInputs(requirement, manifest),
      criterion: requirement.statement,
      observedOutcome: "The fixed conformance fixture review criterion passed.",
      reviewer: "MemoryOS conformance reproducibility fixture",
      date: "2026-09-05",
      reviewRecordId: "CCA-MOS-CONF-003-fixture",
      implementationRevisionDigest: implementation.revision,
      result: "PASS",
      durableEvidence: `evidence/reference-implementation-review-1.2.0.json#/attestations/${index}`,
    }));
}

async function generateFixtureProjection() {
  const manifest = await readManifest();
  const implementation = structuredClone(manifest.evidenceGroups[0].implementation);
  for (const group of manifest.evidenceGroups) {
    assert.deepEqual(group.implementation, implementation);
  }
  const specificationOutcomes = runSpecificationConformance();
  const executions = syntheticExecutions(manifest, specificationOutcomes);
  let evidence = executedGroupEvidence(manifest, executions);
  const reviews = reviewAttestations(manifest, implementation);
  const requirementEvidence = buildRequirementEvidence(
    manifest,
    evidence,
    reviews,
    executions,
  );
  evidence = reconcileGroupEvidence(evidence, requirementEvidence);
  const report = buildReport(manifest, evidence, implementation, {
    assessor: "MemoryOS conformance reproducibility fixture",
    date: "2026-09-05",
    evidenceRoot: "evidence/reference-implementation-1.2.0.json",
    evidenceDigest: sha256(Buffer.from(canonicalJson({ executions, evidence, reviews, requirementEvidence }), "utf8")),
    nativeProjectionProfile: REFERENCE_NATIVE_PROFILE,
    requirementEvidence,
  });
  const evidenceProjection = {
    schemaVersion: "1.0-fixture",
    implementation,
    specificationOutcomes,
    executions,
    evidence,
    reviews,
    requirementEvidence,
  };
  return {
    manifest,
    evidenceProjection,
    report,
  };
}

function fixtureEnvironment(variant) {
  const environment = { ...process.env, ...variant };
  if (Object.hasOwn(variant, "FORCE_COLOR")) delete environment.NO_COLOR;
  if (Object.hasOwn(variant, "NO_COLOR")) delete environment.FORCE_COLOR;
  delete environment.NODE_TEST_CONTEXT;
  delete environment.NODE_TEST_NAME_PATTERN;
  delete environment.NODE_TEST_REPORTER;
  return environment;
}

function runFixture(cwd, variant) {
  const result = spawnSync(process.execPath, [THIS_FILE, FIXTURE_FLAG], {
    cwd,
    encoding: "utf8",
    env: fixtureEnvironment(variant),
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `environment fixture failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
  assert.equal(result.stderr, "", `environment fixture emitted stderr:\n${result.stderr}`);
  const source = result.stdout.trim();
  assert.ok(source.length > 0, "environment fixture emitted no canonical projection");
  const projection = JSON.parse(source);
  assert.equal(source, canonicalJson(projection), "fixture output is not canonical JSON");
  return projection;
}

function documentedOptions(source, command) {
  const line = source.split(/\r?\n/u).find((candidate) => candidate.includes(command));
  assert.ok(line, `README omits ${command}`);
  return [...line.matchAll(/--[a-z-]+/gu)].map((match) => match[0]);
}

function runTool(tool, arguments_) {
  const result = spawnSync(process.execPath, [tool, ...arguments_], {
    cwd: CONFORMANCE_ROOT,
    encoding: "utf8",
    env: fixtureEnvironment({ NO_COLOR: "1", TZ: "UTC" }),
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, "contract probe must stop before accessing absent fixture inputs");
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

if (process.argv.includes(FIXTURE_FLAG)) {
  process.stdout.write(`${canonicalJson(await generateFixtureProjection())}\n`);
} else {
  test("documented conformance commands match their required parser contracts", async () => {
    const readme = await readFile(README_PATH, "utf8");
    const referenceOptions = [
      "--manifest", "--cmake", "--ninja", "--cxx", "--ar", "--ranlib", "--compiler",
      "--gtest-root", "--build-dir", "--python", "--reviews", "--assessor", "--date",
    ];
    const reviewOptions = ["--manifest", "--input", "--output"];
    const independentCreateOptions = [
      "--manifest", "--normative-manifest", "--source-report", "--evidence",
      "--assessment-output", "--assessment-reference", "--report-output", "--assessor",
      "--date", "--method",
    ];
    const independentValidateOptions = [
      "--manifest", "--normative-manifest", "--report", "--evidence", "--assessment",
    ];
    const portableCreateOptions = [
      "--manifest", "--normative-manifest", "--evidence", "--evidence-reference",
      "--output", "--profiles",
    ];
    const portableValidateOptions = [
      "--manifest", "--normative-manifest", "--evidence", "--evidence-reference", "--report",
    ];
    assert.deepEqual(
      documentedOptions(readme, "tools/run-reference-evidence.mjs"),
      referenceOptions,
    );
    assert.deepEqual(
      documentedOptions(readme, "tools/create-review-attestations.mjs"),
      reviewOptions,
    );
    assert.deepEqual(
      documentedOptions(readme, "tools/independent-assessment.mjs create"),
      independentCreateOptions,
    );
    assert.deepEqual(
      documentedOptions(readme, "tools/independent-assessment.mjs validate"),
      independentValidateOptions,
    );
    assert.deepEqual(
      documentedOptions(readme, "tools/portable-report.mjs create"),
      portableCreateOptions,
    );
    assert.deepEqual(
      documentedOptions(readme, "tools/portable-report.mjs validate"),
      portableValidateOptions,
    );

    const value = (option) => option === "--date" ? "2026-09-05" : `absent-${option.slice(2)}`;
    const pairs = (options) => options.flatMap((option) => [option, value(option)]);
    const canonicalReview = resolve(
      CONFORMANCE_ROOT,
      "evidence/reference-implementation-review-1.2.0.json",
    );
    const referenceArguments = pairs(referenceOptions);
    referenceArguments[referenceArguments.indexOf("--reviews") + 1] = canonicalReview;
    assert.doesNotMatch(
      runTool(REFERENCE_EVIDENCE_TOOL, referenceArguments),
      /Usage:|missing --|duplicate argument|Expected values to be strictly deep-equal/u,
    );
    assert.match(
      runTool(REFERENCE_EVIDENCE_TOOL, referenceArguments.slice(2)),
      /missing --manifest/u,
    );

    const reviewArguments = pairs(reviewOptions);
    assert.doesNotMatch(
      runTool(CREATE_REVIEW_TOOL, reviewArguments),
      /Usage:|duplicate --/u,
    );
    assert.match(
      runTool(CREATE_REVIEW_TOOL, reviewArguments.slice(2)),
      /Usage:|missing --manifest/u,
    );

    const documentedReportGenerate = readme.split(/\r?\n/u).find(
      (line) => line.includes("tools/conformance-report.mjs generate"),
    );
    assert.ok(documentedReportGenerate, "README omits conformance-report generate");
    assert.match(
      documentedReportGenerate,
      /requirements-manifest-sha256-DIGEST\.json$/u,
      "report generation does not bind the exact content-addressed manifest",
    );
    const reportGenerateArguments = [
      "absent-evidence.json", "absent-report.json", "absent-report.md",
      "MemoryOS Reference Implementation", "1.2.0", "Assessor", "2026-09-05",
      "evidence/absent.json", "cca-studio-native-observation", "1.1.0",
      "absent-manifest.json",
    ];
    assert.doesNotMatch(
      runTool(CONFORMANCE_REPORT_TOOL, ["generate", ...reportGenerateArguments]),
      /Usage:/u,
    );
    assert.match(
      runTool(CONFORMANCE_REPORT_TOOL, ["generate", ...reportGenerateArguments.slice(0, -1)]),
      /Usage:/u,
      "report generation accepted an invocation without the retained manifest",
    );

    for (const [mode, options] of [
      ["create", independentCreateOptions],
      ["validate", independentValidateOptions],
    ]) {
      const arguments_ = pairs(options);
      assert.doesNotMatch(
        runTool(INDEPENDENT_ASSESSMENT_TOOL, [mode, ...arguments_]),
        /Usage:|duplicate --/u,
      );
      assert.match(
        runTool(INDEPENDENT_ASSESSMENT_TOOL, [mode, ...arguments_.slice(2)]),
        /Usage:/u,
      );
      const normativeIndex = arguments_.indexOf("--normative-manifest");
      const withoutNormative = arguments_.filter((_, index) => (
        index !== normativeIndex && index !== normativeIndex + 1
      ));
      assert.match(
        runTool(INDEPENDENT_ASSESSMENT_TOOL, [mode, ...withoutNormative]),
        /Usage:/u,
      );
    }

    for (const [mode, options] of [
      ["create", portableCreateOptions],
      ["validate", portableValidateOptions],
    ]) {
      const arguments_ = pairs(options);
      assert.doesNotMatch(
        runTool(PORTABLE_REPORT_TOOL, [mode, ...arguments_]),
        /Usage:|duplicate --/u,
      );
      assert.match(
        runTool(PORTABLE_REPORT_TOOL, [mode, ...arguments_.slice(2)]),
        /Usage:/u,
      );
      const normativeIndex = arguments_.indexOf("--normative-manifest");
      const withoutNormative = arguments_.filter((_, index) => (
        index !== normativeIndex && index !== normativeIndex + 1
      ));
      assert.match(
        runTool(PORTABLE_REPORT_TOOL, [mode, ...withoutNormative]),
        /Usage:/u,
      );
    }
  });

  test(SELECTOR, async () => {
    const firstDirectory = await mkdtemp(resolve(tmpdir(), "memoryos-conf-a-"));
    const secondDirectory = await mkdtemp(resolve(tmpdir(), "memoryos-conf-b-"));
    const firstEnvironment = {
      TZ: "Pacific/Honolulu",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
      FORCE_COLOR: "1",
      TERM: "xterm-256color",
      MEMORYOS_PRESENTATION: "presentation-alpha-cca-mos-conf-003",
      MEMORYOS_LAYOUT: "layout-alpha-cca-mos-conf-003",
      MEMORYOS_RENDERER: "renderer-alpha-cca-mos-conf-003",
    };
    const secondEnvironment = {
      TZ: "Asia/Tokyo",
      LANG: "C",
      LC_ALL: "C",
      NO_COLOR: "1",
      TERM: "dumb",
      MEMORYOS_PRESENTATION: "presentation-omega-cca-mos-conf-003",
      MEMORYOS_LAYOUT: "layout-omega-cca-mos-conf-003",
      MEMORYOS_RENDERER: "renderer-omega-cca-mos-conf-003",
    };
    try {
      const first = runFixture(firstDirectory, firstEnvironment);
      const second = runFixture(secondDirectory, secondEnvironment);
      assert.equal(canonicalJson(first.manifest), canonicalJson(second.manifest));
      assert.equal(
        `${canonicalJson(first.evidenceProjection)}\n`,
        `${canonicalJson(second.evidenceProjection)}\n`,
        "canonical evidence projection changed under irrelevant environment variation",
      );
      assert.equal(
        `${canonicalJson(first.report)}\n`,
        `${canonicalJson(second.report)}\n`,
        "canonical report changed under irrelevant environment variation",
      );
      assert.deepEqual(first.evidenceProjection.specificationOutcomes, second.evidenceProjection.specificationOutcomes);
      assert.deepEqual(
        first.evidenceProjection.specificationOutcomes.filter(({ status }) => status !== "PASS"),
        [],
      );
      const canonicalBytes = canonicalJson(first);
      for (const forbidden of [
        firstEnvironment.MEMORYOS_PRESENTATION,
        firstEnvironment.MEMORYOS_LAYOUT,
        firstEnvironment.MEMORYOS_RENDERER,
        secondEnvironment.MEMORYOS_PRESENTATION,
        secondEnvironment.MEMORYOS_LAYOUT,
        secondEnvironment.MEMORYOS_RENDERER,
        firstDirectory,
        secondDirectory,
      ]) {
        assert.equal(canonicalBytes.includes(forbidden), false, `presentation-only value leaked: ${forbidden}`);
      }
    } finally {
      await Promise.all([
        rm(firstDirectory, { recursive: true, force: true }),
        rm(secondDirectory, { recursive: true, force: true }),
      ]);
    }
  });
}
