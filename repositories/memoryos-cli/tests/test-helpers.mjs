import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { referenceSnapshot } from "../../cca-studio/web/data/studio-snapshot.js";
import {
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
} from "../../cca-studio/web/js/memory-investigation-package.js";
import { MemoryOS } from "../../cca-studio/web/js/memoryos-sdk.js";

export const CLI_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const CLI_BIN = fileURLToPath(new URL("../bin/memoryos.js", import.meta.url));
export const CLI_PACKAGE = fileURLToPath(new URL("../package.json", import.meta.url));
export const FULL_MIP_B64 = fileURLToPath(new URL(
  "../../cca-studio/tests/fixtures/mip/complete-investigation.mip.b64",
  import.meta.url,
));
export const MINIMAL_MIP_B64 = fileURLToPath(new URL(
  "../../cca-studio/tests/fixtures/mip/minimal-observation.mip.b64",
  import.meta.url,
));

export const SELECTORS = Object.freeze({
  comparative: "comparative-observation-a-observation-b",
  evolution: "evolution-observation-a-observation-b",
  trace: "trace-observation-b",
});

export function runCli(arguments_, options = {}) {
  const result = spawnSync(process.execPath, [CLI_BIN, ...arguments_], {
    cwd: options.cwd ?? CLI_ROOT,
    encoding: options.binary === true ? null : "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      ...options.env,
    },
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
    windowsHide: true,
  });
  assert.ifError(result.error);
  return result;
}

export function parseJsonOutput(result, stream = "stdout") {
  const text = result[stream];
  assert.equal(typeof text, "string");
  const lines = text.trimEnd().split(/\r?\n/u);
  assert.equal(lines.length, 1, `${stream} must contain exactly one JSON record`);
  return JSON.parse(lines[0]);
}

export function parseJsonLines(text) {
  return text
    .split(/\r?\n/u)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function assertCanonicalJson(text) {
  const lines = text.split(/\r?\n/u).filter((line) => line.length > 0);
  assert.ok(lines.length > 0);
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.equal(line, JSON.stringify(canonicalValue(parsed)));
  }
}

export function assertPresentationFree(value) {
  const forbidden = /^(?:color|generatedAt|layout|render|timestamp|uiState)$/u;
  if (Array.isArray(value)) {
    value.forEach(assertPresentationFree);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, forbidden);
    assertPresentationFree(child);
  }
}

export async function makeFixtures(testContext) {
  const root = await mkdtemp(join(tmpdir(), "memoryos cli "));
  testContext.after(async () => rm(root, { force: true, recursive: true }));
  const inputs = join(root, "input files");
  await mkdir(inputs, { recursive: true });

  const encoded = (await readFile(FULL_MIP_B64, "ascii")).trim();
  const packageBytes = Buffer.from(encoded, "base64");
  const foreignPackageBytes = Buffer.from(
    (await readFile(MINIMAL_MIP_B64, "ascii")).trim(),
    "base64",
  );
  const sourcePackage = importMemoryInvestigationPackage(packageBytes);
  const regressionPackage = (packageIdentifier, mutate = () => {}) => {
    const observations = structuredClone(sourcePackage.observations);
    mutate(observations);
    return exportMemoryInvestigationPackage({
      comparativeReconstructions: [],
      evolutions: [],
      extensions: {},
      metadata: sourcePackage.metadata,
      observations,
      packageIdentifier,
      replays: [],
      sourceAccepted: true,
      sourceAuthorshipAttested: true,
      traces: [],
      workspaceIdentifier: sourcePackage.manifest.workspaceIdentifier,
    });
  };
  const regressionBaselineBytes = regressionPackage("cli-regression-baseline");
  const regressionCandidateBytes = regressionPackage("cli-regression-candidate", (observations) => {
    for (const observation of observations) {
      for (const record of observation.records) {
        if (["evidence", "reflection", "retrieval", "semanticTransformation"].includes(record.role)) {
          record.revision = { ...record.revision, regressionMarker: record.role };
        }
      }
    }
  });
  const regressionReportFor = (baselineBytes, candidateBytes, prepare = () => {}) => {
    const memory = new MemoryOS();
    const baseline = memory.importPackage(baselineBytes, {
      identifier: "fixture-regression-baseline",
    });
    const candidate = memory.importPackage(candidateBytes, {
      identifier: "fixture-regression-candidate",
    });
    prepare(candidate);
    return JSON.parse(JSON.stringify(memory.regression(baseline, candidate)));
  };
  const regressionReport = regressionReportFor(
    regressionBaselineBytes,
    regressionCandidateBytes,
  );
  const replayRegressionReport = regressionReportFor(packageBytes, packageBytes, (candidate) => {
    candidate.trace(SELECTORS.trace).replay().next();
  });
  const verificationRegressionReport = regressionReportFor(
    packageBytes,
    packageBytes,
    (candidate) => candidate.verify(),
  );
  const corruptBytes = Buffer.from(packageBytes);
  corruptBytes[corruptBytes.length - 2] ^= 1;

  const packagePath = join(inputs, "complete investigation.mip");
  const corruptPackagePath = join(inputs, "corrupt investigation.mip");
  const emptyPackagePath = join(inputs, "empty investigation.mip");
  const foreignPackagePath = join(inputs, "foreign workspace investigation.mip");
  const regressionBaselinePath = join(inputs, "regression baseline.mip");
  const regressionCandidatePath = join(inputs, "regression candidate.mip");
  const regressionReportPath = join(inputs, "regression report.json");
  const malformedRegressionReportPath = join(inputs, "malformed regression report.json");
  const regressionEnvelopePath = join(inputs, "regression envelope.json");
  const replayRegressionReportPath = join(inputs, "replay regression report.json");
  const verificationRegressionReportPath = join(inputs, "verification regression report.json");
  const workspacePath = join(inputs, "workspace.json");
  const foreignWorkspacePath = join(inputs, "foreign workspace.json");
  const snapshotPath = join(inputs, "snapshot.json");
  const invalidJsonPath = join(inputs, "invalid.json");
  const arrayJsonPath = join(inputs, "array.json");

  await Promise.all([
    writeFile(packagePath, packageBytes),
    writeFile(corruptPackagePath, corruptBytes),
    writeFile(emptyPackagePath, Buffer.alloc(0)),
    writeFile(foreignPackagePath, foreignPackageBytes),
    writeFile(regressionBaselinePath, regressionBaselineBytes),
    writeFile(regressionCandidatePath, regressionCandidateBytes),
    writeFile(regressionReportPath, JSON.stringify(regressionReport), "utf8"),
    writeFile(malformedRegressionReportPath, JSON.stringify({ kind: "not-a-report" }), "utf8"),
    writeFile(regressionEnvelopePath, JSON.stringify({
      command: "regression",
      ok: true,
      result: regressionReport,
      schemaVersion: "1.0",
    }), "utf8"),
    writeFile(replayRegressionReportPath, JSON.stringify(replayRegressionReport), "utf8"),
    writeFile(
      verificationRegressionReportPath,
      JSON.stringify(verificationRegressionReport),
      "utf8",
    ),
    writeFile(
      workspacePath,
      JSON.stringify({ identifier: referenceSnapshot.workspaceIdentifier }),
      "utf8",
    ),
    writeFile(
      foreignWorkspacePath,
      JSON.stringify({ identifier: "workspace-foreign" }),
      "utf8",
    ),
    writeFile(snapshotPath, JSON.stringify(referenceSnapshot), "utf8"),
    writeFile(invalidJsonPath, "{", "utf8"),
    writeFile(arrayJsonPath, "[]", "utf8"),
  ]);

  return {
    arrayJsonPath,
    corruptBytes,
    corruptPackagePath,
    emptyPackagePath,
    foreignWorkspacePath,
    foreignPackagePath,
    inputs,
    invalidJsonPath,
    malformedRegressionReportPath,
    packageBytes,
    packagePath,
    regressionBaselineBytes,
    regressionBaselinePath,
    regressionCandidateBytes,
    regressionCandidatePath,
    regressionEnvelopePath,
    regressionReport,
    regressionReportPath,
    replayRegressionReport,
    replayRegressionReportPath,
    verificationRegressionReport,
    verificationRegressionReportPath,
    root,
    snapshotPath,
    workspacePath,
    outputPath: join(root, "exported investigation.mip"),
  };
}

export async function ensureParent(path) {
  await mkdir(dirname(path), { recursive: true });
}
