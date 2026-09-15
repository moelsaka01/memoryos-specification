import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { INVESTIGATION_CORE_VERSION } from "../../cca-studio/web/js/investigation-core.js";
import {
  MIP_FORMAT_VERSION,
  computeMipIntegrity,
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "../../cca-studio/web/js/memory-investigation-package.js";
import { canonicalize, utf8Encode } from "../../cca-studio/web/js/mip-canonical.js";
import { MEMORYOS_SDK_VERSION, MemoryOS } from "../../cca-studio/web/js/memoryos-sdk.js";
import {
  parseCliJson,
  readManifest,
  readMipFixture,
  runCli,
} from "./support/conformance-support.mjs";

function redigest(value) {
  value.integrity = computeMipIntegrity(value);
  return utf8Encode(canonicalize(value));
}

test("Standard, package, Core, SDK, and CLI versions retain independent identities", async () => {
  const manifest = await readManifest();
  assert.deepEqual(
    { identifier: manifest.standard.identifier, version: manifest.standard.version },
    { identifier: "CCA-MEMORYOS-1.0", version: "1.0" },
  );
  assert.equal(MIP_FORMAT_VERSION, "1.0.0");
  assert.equal(INVESTIGATION_CORE_VERSION, "1.0.0");
  assert.equal(MEMORYOS_SDK_VERSION, "1.1.0");
  const version = runCli(["version", "--json"]);
  assert.equal(version.status, 0);
  const output = parseCliJson(version);
  assert.equal(output.result.cliVersion, "1.1.0");
  assert.equal(output.result.sdkVersion, "1.1.0");
});

test("MIP exact-version and same-major packages retain canonical compatibility", async () => {
  const bytes = await readMipFixture("minimal-observation");
  const exact = importMemoryInvestigationPackage(bytes);
  assert.deepEqual(exportMemoryInvestigationPackage(exact), bytes);

  const compatible = structuredClone(exact);
  compatible.formatVersion = "1.1.0";
  const compatibleBytes = redigest(compatible);
  const first = verifyMemoryInvestigationPackage(compatibleBytes);
  const second = verifyMemoryInvestigationPackage(compatibleBytes);
  assert.deepEqual(first, second);
  assert.equal(first.valid, true, JSON.stringify(first.diagnostics));

  const incompatible = structuredClone(exact);
  incompatible.formatVersion = "2.0.0";
  const incompatibleResult = verifyMemoryInvestigationPackage(redigest(incompatible));
  assert.equal(incompatibleResult.valid, false);
  assert.equal(incompatibleResult.diagnostics[0].code, "UNSUPPORTED_VERSION");
});

test("unknown non-critical extensions survive MIP and SDK round trips byte-for-byte", async () => {
  const bytes = await readMipFixture("noncritical-extension");
  const imported = importMemoryInvestigationPackage(bytes);
  assert.deepEqual(exportMemoryInvestigationPackage(imported), bytes);

  const memory = new MemoryOS();
  const investigation = memory.importPackage(bytes, { identifier: "compatibility-extension" });
  const exported = memory.exportPackage(investigation);
  assert.deepEqual(exported.toBytes(), bytes);
  assert.equal(memory.verifyPackage(exported).valid, true);
});

test("C++, Python, JavaScript, and CLI expose SDK 1.1 over the stable 1.0 bridge protocol", async () => {
  const files = [
    ["../../cca-sdk/include/memoryos/memoryos.hpp", /sdkVersion\{"1\.1\.0"\}/u],
    ["../../cca-sdk/python/pyproject.toml", /version = "1\.1\.0"/u],
    ["../../cca-sdk/python/src/memoryos/_sdk.py", /SDK_VERSION = "1\.1\.0"/u],
    ["../../cca-sdk/bridge/investigation-core-host.mjs", /PROTOCOL_VERSION = "1\.0\.0"/u],
    ["../../memoryos-cli/package.json", /"version": "1\.1\.0"/u],
  ];
  for (const [path, expected] of files) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, expected, path);
  }
});
