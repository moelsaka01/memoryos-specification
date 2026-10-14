import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join, relative } from "node:path";
import test from "node:test";

import {
  CLI_BIN,
  CLI_PACKAGE,
  CLI_ROOT,
  makeFixtures,
  parseJsonOutput,
  runCli,
} from "./test-helpers.mjs";

async function productionSources() {
  const src = join(CLI_ROOT, "src");
  const names = await readdir(src);
  return Promise.all(
    [CLI_BIN, ...names.filter((name) => /\.(?:js|mjs)$/u.test(name)).map((name) => join(src, name))]
      .map(async (path) => ({ path, source: await readFile(path, "utf8") })),
  );
}

test("package bin resolves to the production executable entry", async () => {
  const manifest = JSON.parse(await readFile(CLI_PACKAGE, "utf8"));
  assert.deepEqual(manifest.bin, { memoryos: "./bin/memoryos.js" });
  const bin = join(CLI_ROOT, manifest.bin.memoryos);
  await access(bin, constants.R_OK);
  const source = await readFile(bin, "utf8");
  assert.equal(source.startsWith("#!/usr/bin/env node\n"), true);
  assert.match(source, /import \{ main \} from "\.\.\/src\/main\.js";/u);
});

test("production CLI depends on the SDK facade and no lower platform layer", async () => {
  const files = await productionSources();
  const combined = files.map(({ source }) => source).join("\n");
  const sdkImports = [];
  const forbidden = [
    "investigation-core",
    "memory-investigation-package",
    "mip-canonical",
    "cognitive-trace",
    "cognitive-replay",
    "cognitive-evolution",
    "cognitive-comparative",
    "cognitive-regression",
    "cognitive-investigation-explorer",
    "semantic-world",
    "studio-model",
  ];

  for (const { path, source } of files) {
    for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu)) {
      if (match[1].endsWith("memoryos-sdk.js")) {
        sdkImports.push({ path: relative(CLI_ROOT, path), specifier: match[1] });
      }
    }
    for (const token of forbidden) {
      assert.doesNotMatch(source, new RegExp(token, "u"), `${basename(path)} bypasses SDK via ${token}`);
    }
    assert.doesNotMatch(
      source,
      /\b(?:InvestigationCore|verifyMemoryInvestigationPackage|projectInvestigation)\b/u,
    );
  }

  assert.equal(sdkImports.length, 1);
  assert.equal(sdkImports[0].path.replaceAll("\\", "/"), "src/commands.js");
  assert.equal(sdkImports[0].specifier, "../../cca-studio/web/js/memoryos-sdk.js");
  assert.match(combined, /new MemoryOS\(\)/u);
});

test("CLI output preserves direct SDK transition truth", async (t) => {
  const fixture = await makeFixtures(t);
  const cli = runCli([
    "trace", fixture.packagePath,
    "--reflection", "trace-observation-b",
    "--id", "cli-sdk-parity",
    "--json",
  ]);
  assert.equal(cli.status, 0);
  const cliResult = parseJsonOutput(cli).result;

  const { MemoryOS } = await import("../../cca-studio/web/js/memoryos-sdk.js");
  const memory = new MemoryOS();
  const investigation = memory.importPackage(fixture.packageBytes, {
    identifier: "cli-sdk-parity",
  }).trace("trace-observation-b");
  assert.equal(cliResult.identifier, investigation.identifier);
  assert.equal(cliResult.lifecycle, investigation.lifecycle);
  assert.equal(cliResult.phase, investigation.phase);
  assert.equal(cliResult.sourceKind, investigation.view.sourceKind);
  assert.equal(cliResult.transitionCount, investigation.transitionLog.transitions.length);
  assert.equal(cliResult.transitionLogDigest, investigation.transitionLog.digest);
  assert.equal(cliResult.workspaceIdentifier, investigation.workspaceIdentifier);
  assert.deepEqual(cliResult.availability, investigation.availability);
});

test("Regression output is the exact public SDK report", async (t) => {
  const fixture = await makeFixtures(t);
  const cli = runCli([
    "regression",
    fixture.regressionBaselinePath,
    fixture.regressionCandidatePath,
    "--json",
  ]);
  assert.equal(cli.status, 0);
  const cliResult = parseJsonOutput(cli).result;

  const { MemoryOS } = await import("../../cca-studio/web/js/memoryos-sdk.js");
  const memory = new MemoryOS();
  const baseline = memory.importPackage(fixture.regressionBaselineBytes, {
    identifier: "memoryos-regression-baseline",
  });
  const candidate = memory.importPackage(fixture.regressionCandidateBytes, {
    identifier: "memoryos-regression-candidate",
  });
  assert.deepEqual(
    cliResult,
    JSON.parse(JSON.stringify(memory.regression(baseline, candidate))),
  );
});

test("Investigation navigation output is the exact public SDK result", async (t) => {
  const fixture = await makeFixtures(t);
  const cli = runCli([
    "investigate", fixture.regressionReportPath,
    "--category", "evidence",
    "--json",
  ]);
  assert.equal(cli.status, 0);
  const cliResult = parseJsonOutput(cli).result;

  const { MemoryOS } = await import("../../cca-studio/web/js/memoryos-sdk.js");
  const direct = new MemoryOS().investigate(fixture.regressionReport, {
    category: "evidence",
  });
  assert.deepEqual(cliResult, JSON.parse(JSON.stringify(direct)));
});
