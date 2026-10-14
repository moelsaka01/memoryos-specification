import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { MemoryOS } from "../../cca-studio/web/js/memoryos-sdk.js";
import { main } from "../src/main.js";

import {
  assertCanonicalJson,
  makeFixtures,
  parseJsonOutput,
  runCli,
} from "./test-helpers.mjs";

const digestPattern = /^sha256:[0-9a-f]{64}$/u;

function rule(identifier, type, parameters = {}) {
  return { identifier, parameters, type, version: "1.0.0" };
}

function policy(identifier, frozenRule) {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "1.0.0",
    rules: [frozenRule],
    version: "1.0.0",
  };
}

async function policyFixtures(t) {
  const fixture = await makeFixtures(t);
  const values = {
    pass: policy("pa", rule("a", "memoryos.require-mip-integrity")),
    fail: policy("pf", rule("a", "memoryos.require-verification-completed")),
    cne: policy(
      "pc",
      rule("a", "memoryos.prohibit-regression-findings", { categories: ["reflection"] }),
    ),
  };
  const paths = {};
  for (const [name, value] of Object.entries(values)) {
    paths[name] = join(fixture.root, `${name}.memoryos-policy.json`);
    await writeFile(paths[name], JSON.stringify(value), "utf8");
  }

  const memory = new MemoryOS();
  const preparedChild = memory.preparePolicy(Uint8Array.from(Buffer.from(JSON.stringify(values.pass))));
  const set = {
    identifier: "ps",
    kind: "MemoryOSInvestigationPolicySet",
    policies: [{ expectedSemanticDigest: preparedChild.semanticDigest, policy: values.pass }],
    policySetVersion: "1.0.0",
    version: "1.0.0",
  };
  paths.set = join(fixture.root, "pass.memoryos-policy-set.json");
  await writeFile(paths.set, JSON.stringify(set), "utf8");
  return { ...fixture, paths, values };
}

test("policy namespace exposes exactly the seven frozen commands", () => {
  const help = runCli(["help", "policy"]);
  assert.equal(help.status, 0);
  for (const command of [
    "validate", "digest", "inspect", "evaluate", "verify-identity",
    "verify-outcome", "identities",
  ]) {
    assert.equal(help.stdout.includes(`memoryos policy ${command}`), true);
  }
  assert.equal((help.stdout.match(/memoryos policy identities/gu) ?? []).length, 1);

  const invalid = [
    ["policy"],
    ["policy", "unknown"],
    ["policy", "validate"],
    ["policy", "validate", "--policy", "p", "--policy-set", "s"],
    ["policy", "inspect", "--context", "-", "--outcome", "-"],
    ["policy", "evaluate", "--policy", "p", "--package", "m", "--outcome", "-", "--json"],
    ["policy", "verify-identity", "i", "--mode", "artifact"],
    ["policy", "verify-outcome", "o", "--mode", "artifact"],
    ["policy", "identities", "--policy", "p"],
  ];
  for (const arguments_ of invalid) {
    const result = runCli([...arguments_, "--json"]);
    assert.equal(result.status, 1, arguments_.join(" "));
    assert.equal(result.stdout, "");
    assertCanonicalJson(result.stderr);
    const envelope = parseJsonOutput(result, "stderr");
    assert.equal(envelope.schemaVersion, "1.1");
    assert.equal(envelope.error.failureClass, "usage");
    assert.deepEqual(
      Object.keys(envelope.error).sort(),
      [
        "artifactKind", "code", "details", "exitCode", "failureClass",
        "limitIdentifier", "message", "phase",
      ],
    );
  }
});

test("unexpected Policy operational failure maps to exit 5 and the exact JSON semantic projection", async () => {
  let stderr = "";
  const message = "Injected internal Policy presentation failure.";
  const exitCode = await main(["policy", "identities", "--json"], {
    stdin: () => Buffer.alloc(0),
    stdout: () => {
      throw new Error(message);
    },
    stderr: (value) => {
      stderr += value;
      return true;
    },
  });

  assert.equal(exitCode, 5);
  assertCanonicalJson(stderr);
  const envelope = JSON.parse(stderr);
  const normativeProjection = {
    command: envelope.command,
    error: {
      artifactKind: envelope.error.artifactKind,
      code: envelope.error.code,
      exitCode: envelope.error.exitCode,
      failureClass: envelope.error.failureClass,
      limitIdentifier: envelope.error.limitIdentifier,
      phase: envelope.error.phase,
    },
    ok: envelope.ok,
    schemaVersion: envelope.schemaVersion,
  };
  assert.deepEqual(normativeProjection, {
    command: "policy identities",
    error: {
      artifactKind: null,
      code: "POLICY_OPERATIONAL_FAILURE",
      exitCode: 5,
      failureClass: "operational",
      limitIdentifier: null,
      phase: null,
    },
    ok: false,
    schemaVersion: "1.1",
  });
  assert.equal(envelope.error.message, message);
  assert.deepEqual(envelope.error.details, []);
});

test("validate, digest, identities, and presentation envelopes preserve frozen bytes", async (t) => {
  const fixture = await policyFixtures(t);
  const validate = runCli(["policy", "validate", "--policy", fixture.paths.pass, "--json"]);
  assert.equal(validate.status, 0);
  assert.deepEqual(parseJsonOutput(validate), {
    command: "policy validate",
    ok: true,
    result: {
      artifactKind: "MemoryOSInvestigationPolicy",
      artifactVersion: "1.0.0",
      valid: true,
    },
    schemaVersion: "1.1",
  });
  const humanValidate = runCli(["policy", "validate", "--policy", fixture.paths.pass]);
  assert.equal(humanValidate.status, 0);
  assert.equal(humanValidate.stderr, "");
  assert.match(humanValidate.stdout, /^MemoryOS policy validate\n/u);

  const fromStdin = runCli(["policy", "digest", "--policy", "-", "--json"], {
    input: await readFile(fixture.paths.pass),
  });
  const canonicalPath = join(fixture.root, "canonical.memoryos-policy.json");
  const fromPath = runCli([
    "policy", "digest", "--policy", fixture.paths.pass,
    "--canonical-output", canonicalPath, "--json",
  ]);
  assert.equal(fromPath.status, 0);
  assert.equal(fromStdin.status, 0);
  assert.deepEqual(parseJsonOutput(fromPath).result, parseJsonOutput(fromStdin).result);
  assert.match(parseJsonOutput(fromPath).result.documentDigest, digestPattern);
  assert.match(parseJsonOutput(fromPath).result.semanticDigest, digestPattern);
  const prepared = new MemoryOS().preparePolicy(Uint8Array.from(await readFile(fixture.paths.pass)));
  assert.deepEqual(await readFile(canonicalPath), Buffer.from(prepared.toBytes()));

  const set = runCli(["policy", "validate", "--policy-set", fixture.paths.set, "--json"]);
  assert.equal(set.status, 0);
  assert.equal(parseJsonOutput(set).result.artifactKind, "MemoryOSInvestigationPolicySet");
  const setOutcome = join(fixture.root, "set.outcome.json");
  const setEvaluation = runCli([
    "policy", "evaluate", "--policy-set", fixture.paths.set,
    "--package", fixture.packagePath, "--outcome", setOutcome, "--json",
  ]);
  assert.equal(setEvaluation.status, 0);
  assert.equal(parseJsonOutput(setEvaluation).result.decision, "PASS");
  assert.equal(JSON.parse(await readFile(setOutcome, "utf8")).result.kind, "MemoryOSPolicySetResult");

  const identities = runCli(["policy", "identities", "--json"]);
  assert.equal(identities.status, 0);
  assertCanonicalJson(identities.stdout);
  const identityResult = parseJsonOutput(identities).result;
  assert.equal(identityResult.evaluatorVersion, "1.0.0");
  assert.equal(identityResult.factModel.factModelDigest, "sha256:b36b9488161cb67d8e971e802d15ad76d662d46f96e1304182de343ba69ef7a8");
  assert.equal(identityResult.ruleRegistry.ruleRegistryDigest, "sha256:aaa19116563d209f680b063cdccf49d899069683f9778271c4ca2c4559b94fd7");
  assert.equal(identityResult.resourceProfile.resourceProfileDigest, "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239");
});

test("evaluate preserves PASS, FAIL, CNE, exact artifacts, and outcome-last generation", async (t) => {
  const fixture = await policyFixtures(t);
  const evaluate = (name, extra = []) => {
    const prefix = join(fixture.root, name);
    const files = {
      identity: `${prefix}.identity.json`,
      identityDigest: `${prefix}.identity.sha256`,
      outcome: `${prefix}.outcome.json`,
      outcomeDigest: `${prefix}.outcome.sha256`,
    };
    const result = runCli([
      "policy", "evaluate", "--policy", fixture.paths[name],
      "--package", fixture.packagePath,
      "--outcome", files.outcome,
      "--identity-output", files.identity,
      "--evaluation-identity-digest-output", files.identityDigest,
      "--outcome-digest-output", files.outcomeDigest,
      ...extra,
      "--json",
    ]);
    return { files, result };
  };

  const pass = evaluate("pass");
  const fail = evaluate("fail");
  const cne = evaluate("cne");
  assert.deepEqual(
    [pass.result.status, fail.result.status, cne.result.status],
    [0, 6, 7],
  );
  assert.deepEqual(
    [pass, fail, cne].map(({ result }) => parseJsonOutput(result).result.decision),
    ["PASS", "FAIL", "COULD_NOT_EVALUATE"],
  );

  for (const { files, result } of [pass, fail, cne]) {
    const value = parseJsonOutput(result).result;
    const identityBytes = await readFile(files.identity);
    const outcomeBytes = await readFile(files.outcome);
    assert.equal((await readFile(files.identityDigest)).length, 71);
    assert.equal((await readFile(files.outcomeDigest)).length, 71);
    assert.equal((await readFile(files.identityDigest, "ascii")), value.evaluationIdentityDigest);
    assert.equal((await readFile(files.outcomeDigest, "ascii")), value.outcomeDigest);
    assert.equal(identityBytes.at(-1), 0x7d);
    assert.equal(outcomeBytes.at(-1), 0x7d);

    const outcome = JSON.parse(outcomeBytes.toString("utf8"));
    assert.equal(outcome.result.decision, value.decision);
    assert.equal(outcome.evaluationIdentityDigest, value.evaluationIdentityDigest);
  }

  const renamedPolicy = join(fixture.root, "renamed policy input.json");
  const renamedPackage = join(fixture.root, "renamed candidate input.mip");
  const renamedIdentity = join(fixture.root, "renamed identity output.json");
  const renamedOutcome = join(fixture.root, "renamed outcome output.json");
  await writeFile(renamedPolicy, await readFile(fixture.paths.pass));
  await writeFile(renamedPackage, fixture.packageBytes);
  const renamed = runCli([
    "policy", "evaluate", "--policy", renamedPolicy, "--package", renamedPackage,
    "--outcome", renamedOutcome, "--identity-output", renamedIdentity, "--json",
  ]);
  assert.equal(renamed.status, 0);
  assert.deepEqual(await readFile(renamedIdentity), await readFile(pass.files.identity));
  assert.deepEqual(await readFile(renamedOutcome), await readFile(pass.files.outcome));

  const raw = runCli([
    "policy", "evaluate", "--policy", fixture.paths.pass,
    "--package", fixture.packagePath, "--outcome", "-",
  ], { binary: true });
  assert.equal(raw.status, 0);
  assert.equal(raw.stderr.length, 0);
  assert.equal(raw.stdout.at(-1), 0x7d);
  assert.deepEqual(raw.stdout, await readFile(pass.files.outcome));

  const withRegression = evaluate("cne", ["--regression-baseline", fixture.packagePath]);
  assert.equal(withRegression.result.status, 0);
  assert.equal(parseJsonOutput(withRegression.result).result.decision, "PASS");

  const missing = join(fixture.root, "missing", "outcome.json");
  const retainedIdentity = await readFile(pass.files.identity);
  const failed = runCli([
    "policy", "evaluate", "--policy", fixture.paths.pass,
    "--package", fixture.packagePath,
    "--outcome", missing,
    "--identity-output", pass.files.identity,
    "--json",
  ]);
  assert.equal(failed.status, 4);
  assert.deepEqual(await readFile(pass.files.identity), retainedIdentity);

  const blockedOutcome = join(fixture.root, "blocked-outcome");
  const interruptedIdentity = join(fixture.root, "interrupted.identity.json");
  await mkdir(blockedOutcome);
  const duringCommit = runCli([
    "policy", "evaluate", "--policy", fixture.paths.pass,
    "--package", fixture.packagePath,
    "--outcome", blockedOutcome,
    "--identity-output", interruptedIdentity,
    "--json",
  ]);
  assert.equal(duringCommit.status, 4);
  assert.equal((await stat(blockedOutcome)).isDirectory(), true);
  const cannotAccept = runCli([
    "policy", "verify-outcome", blockedOutcome,
    "--mode", "artifact",
    "--expected-identity", interruptedIdentity,
    "--json",
  ]);
  assert.equal(cannotAccept.status, 4);
});

test("all detached inspections and both verification modes remain SDK-owned", async (t) => {
  const fixture = await policyFixtures(t);
  const memory = new MemoryOS();
  const baseline = memory.importPackage(fixture.packageBytes, { identifier: "cli-test-baseline" });
  const candidate = memory.importPackage(fixture.packageBytes, { identifier: "cli-test-candidate" });
  const bundle = memory.captureRegressionPolicyFacts(baseline, candidate);
  const contextPath = join(fixture.root, "context.json");
  const sourcePath = join(fixture.root, "source.json");
  const reportPath = join(fixture.root, "report.json");
  await writeFile(contextPath, bundle.policyFactContext.toBytes());
  await writeFile(sourcePath, bundle.regressionPolicyFactSource.toBytes());
  await writeFile(reportPath, JSON.stringify(memory.regression(baseline, candidate)), "utf8");

  const outcomePath = join(fixture.root, "verified.outcome.json");
  const identityPath = join(fixture.root, "verified.identity.json");
  const identityDigestPath = join(fixture.root, "verified.identity.sha256");
  const outcomeDigestPath = join(fixture.root, "verified.outcome.sha256");
  const evaluated = runCli([
    "policy", "evaluate", "--policy", fixture.paths.pass,
    "--package", fixture.packagePath, "--outcome", outcomePath,
    "--identity-output", identityPath,
    "--evaluation-identity-digest-output", identityDigestPath,
    "--outcome-digest-output", outcomeDigestPath,
    "--json",
  ]);
  assert.equal(evaluated.status, 0);
  const identityDigest = await readFile(identityDigestPath, "ascii");
  const outcomeDigest = await readFile(outcomeDigestPath, "ascii");

  const inspections = [
    ["--context", contextPath, "MemoryOSPolicyFactContext"],
    ["--regression-source", sourcePath, "MemoryOSRegressionPolicyFactSource"],
    ["--regression-report", reportPath, "MemoryOSCognitiveRegressionReport"],
    ["--evaluation-identity", identityPath, "MemoryOSPolicyEvaluationIdentity"],
    ["--outcome", outcomePath, "MemoryOSPolicyEvaluationOutcome"],
  ];
  for (const [option, path, kind] of inspections) {
    const inspected = runCli(["policy", "inspect", option, path, "--json"]);
    assert.equal(inspected.status, 0, option);
    assert.equal(parseJsonOutput(inspected).result.authority, "inspectionOnly");
    assert.equal(parseJsonOutput(inspected).result.artifactKind, kind);
  }

  const artifactIdentity = runCli([
    "policy", "verify-identity", identityPath,
    "--mode", "artifact",
    "--expected-evaluation-identity-digest", identityDigest,
    "--json",
  ]);
  const artifactOutcome = runCli([
    "policy", "verify-outcome", outcomePath,
    "--mode", "artifact",
    "--expected-identity", identityPath,
    "--expected-outcome-digest", outcomeDigest,
    "--json",
  ]);
  const evaluationIdentity = runCli([
    "policy", "verify-identity", identityPath,
    "--mode", "evaluation",
    "--policy", fixture.paths.pass,
    "--package", fixture.packagePath,
    "--json",
  ]);
  const evaluationOutcome = runCli([
    "policy", "verify-outcome", outcomePath,
    "--mode", "evaluation",
    "--policy", fixture.paths.pass,
    "--package", fixture.packagePath,
    "--expected-outcome-digest", outcomeDigest,
    "--json",
  ]);
  for (const result of [artifactIdentity, artifactOutcome, evaluationIdentity, evaluationOutcome]) {
    assert.equal(result.status, 0);
    assert.equal(parseJsonOutput(result).result.verified, true);
  }
  assert.equal(parseJsonOutput(artifactIdentity).result.verificationScope, "serializedArtifact");
  assert.equal(
    parseJsonOutput(evaluationOutcome).result.verificationScope,
    "authoritativeReconstruction",
  );

  const wrong = runCli([
    "policy", "verify-outcome", outcomePath,
    "--mode", "artifact",
    "--expected-evaluation-identity-digest", `sha256:${"0".repeat(64)}`,
    "--json",
  ]);
  assert.equal(wrong.status, 3);
  const error = parseJsonOutput(wrong, "stderr");
  assert.equal(error.error.exitCode, 3);
  assert.equal(error.error.code, "VERIFICATION_FAILED");

  const malformedIdentity = join(fixture.root, "malformed.identity.json");
  const malformedOutcome = join(fixture.root, "malformed.outcome.json");
  await writeFile(malformedIdentity, "{", "utf8");
  await writeFile(malformedOutcome, "{}", "utf8");
  const negativeVerifications = [
    [
      "policy", "verify-identity", malformedIdentity, "--mode", "artifact",
      "--expected-evaluation-identity-digest", `sha256:${"0".repeat(64)}`, "--json",
    ],
    [
      "policy", "verify-outcome", malformedOutcome, "--mode", "artifact",
      "--expected-evaluation-identity-digest", `sha256:${"0".repeat(64)}`, "--json",
    ],
  ];
  for (const arguments_ of negativeVerifications) {
    const result = runCli(arguments_);
    assert.equal(result.status, 3);
    assert.equal(parseJsonOutput(result, "stderr").error.exitCode, 3);
  }

  for (const arguments_ of [
    ["policy", "inspect", "--evaluation-identity", malformedIdentity, "--json"],
    ["policy", "inspect", "--outcome", malformedOutcome, "--json"],
  ]) {
    const result = runCli(arguments_);
    assert.equal(result.status, 2);
    const inspectionError = parseJsonOutput(result, "stderr").error;
    assert.equal(inspectionError.failureClass, "preparation");
    assert.notEqual(inspectionError.phase, undefined);
  }
});

test("policy transport rejects collisions, multiple stdin inputs, URLs, and output-only stdin", async (t) => {
  const fixture = await policyFixtures(t);
  const cases = [
    ["policy", "digest", "--policy", fixture.paths.pass, "--canonical-output", fixture.paths.pass],
    ["policy", "evaluate", "--policy", "-", "--package", "-", "--outcome", join(fixture.root, "o")],
    ["policy", "digest", "--policy", fixture.paths.pass, "--canonical-output", "-"],
    ["policy", "evaluate", "--policy", fixture.paths.pass, "--package", fixture.packagePath, "--outcome", fixture.packagePath],
    ["policy", "validate", "--policy", "https://example.invalid/policy.json"],
  ];
  for (let index = 0; index < cases.length; index += 1) {
    const result = runCli([...cases[index], "--json"], { input: "{}" });
    assert.equal(result.status, index === 4 ? 4 : 1);
  }

  const malformedMipCases = [
    [
      "policy", "evaluate", "--policy", fixture.paths.pass,
      "--package", fixture.corruptPackagePath,
      "--outcome", join(fixture.root, "invalid-candidate.outcome.json"), "--json",
    ],
    [
      "policy", "evaluate", "--policy", fixture.paths.pass,
      "--package", fixture.packagePath,
      "--regression-baseline", fixture.corruptPackagePath,
      "--outcome", join(fixture.root, "invalid-baseline.outcome.json"), "--json",
    ],
  ];
  for (const arguments_ of malformedMipCases) {
    const result = runCli(arguments_);
    assert.equal(result.status, 2);
    const error = parseJsonOutput(result, "stderr").error;
    assert.equal(error.failureClass, "preparation");
    assert.equal(error.phase, "evaluationInput");
    assert.equal(error.artifactKind, "MemoryInvestigationPackage");
    assert.equal(typeof error.code, "string");
    assert.notEqual(error.code, "POLICY_OPERATIONAL_FAILURE");
  }
});
