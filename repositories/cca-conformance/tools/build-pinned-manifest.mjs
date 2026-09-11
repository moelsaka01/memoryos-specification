#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DIRECT_REQUIREMENT_SELECTORS,
  INCORPORATED_RANGE_CONJUNCTIONS,
  RF_REQUIREMENT_SELECTORS,
  loadMipRequirementSelectors,
  validateRequirementSelectorCatalog,
} from "./requirement-selector-catalog.mjs";
import { retainAssessmentManifest } from "../tests/support/conformance-support.mjs";

const conformanceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(conformanceRoot, "../..");
const standardRoot = process.env.MEMORYOS_STANDARD_ROOT
  ? resolve(process.env.MEMORYOS_STANDARD_ROOT)
  : resolve(dirname(workspaceRoot), "cca-specifications/specifications/CCA-MEMORYOS-1.0");
const specificationsRoot = dirname(standardRoot);
const specificationsRepositoryRoot = dirname(specificationsRoot);
const implementationVersion = Object.freeze({
  name: "MemoryOS Reference Implementation",
  version: "1.2.1",
});
const expectedImplementationRevision = "sha256:68457c49142f5f2a54159228a480ddc11dd3f57ec0ddcb3231bcc4266d7a1044";
const expectedStandardPublicationDigest = "sha256:f77246da755e67c5e7e73706504c6d63641eeb711fbbe9c381b10d197a3dc716";
const expectedMipPublicationDigest = "sha256:997fd40928ce52581dc932c1c3d888fd4d6a73208613ba1ab0a9f17b79c020ca";
const expectedMipSourcePackageDigest = "sha256:a9a520f84b0ae4e6afcac0c1bc9400786997adfcbec81bfd80a93ef13a60e9ba";
const expectedNormativeRegistryDigest = "sha256:68ef4fa3e5727acab071de6d84759ff2b15a2bbf3865d38a55475c399c690e7f";
const expectedSpecificationsCommit = "bdf8fd465c1a402879911c1166179b41e72ca290";
const historicalManifestPath = "repositories/cca-conformance/manifests/requirements-manifest-sha256-ccb957e57043d6c34542461bc7d50d034aac268da3d295c3387459db848f823a.json";
const expectedHistoricalManifestBytesDigest = "sha256:9d22cec389778ed756184ceaf996f110d7172aa8f987cbf6caf7805954f7968e";
const requiredAttributes = "* text=auto eol=lf\n*.mip binary\n";
const referenceImplementationInputs = Object.freeze([
  "repositories/cca-core/CMakeLists.txt",
  "repositories/cca-core/cmake/version.hpp.in",
  "repositories/cca-core/include/cca",
  "repositories/cca-core/src",
  "repositories/cca-studio/package.json",
  "repositories/cca-studio/web/data",
  "repositories/cca-studio/web/js",
  "repositories/cca-sdk/CMakeLists.txt",
  "repositories/cca-sdk/include/memoryos/memoryos.hpp",
  "repositories/cca-sdk/src",
  "repositories/cca-sdk/bridge/investigation-core-host.mjs",
  "repositories/cca-sdk/python/pyproject.toml",
  "repositories/cca-sdk/python/src/memoryos/__init__.py",
  "repositories/cca-sdk/python/src/memoryos/_bridge.py",
  "repositories/cca-sdk/python/src/memoryos/_errors.py",
  "repositories/cca-sdk/python/src/memoryos/_immutable.py",
  "repositories/cca-sdk/python/src/memoryos/_models.py",
  "repositories/cca-sdk/python/src/memoryos/_sdk.py",
  "repositories/cca-sdk/python/src/memoryos/py.typed",
  "repositories/memoryos-cli/bin/memoryos.js",
  "repositories/memoryos-cli/package.json",
  "repositories/memoryos-cli/src",
]);

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function gitResult(repositoryRoot, arguments_, encoding = "utf8") {
  const result = spawnSync("git", ["-C", repositoryRoot, ...arguments_], {
    encoding,
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr;
    throw new Error(`git ${arguments_.join(" ")} failed in ${repositoryRoot}: ${stderr.trim()}`);
  }
  return result.stdout;
}

function repositoryPath(repositoryRoot, absolute) {
  const path = relative(repositoryRoot, absolute).split(sep).join("/");
  if (path === ".." || path.startsWith("../")) {
    throw new Error(`${absolute} is outside repository ${repositoryRoot}`);
  }
  return path;
}

async function assertCleanRepository(repositoryRoot, label) {
  const topLevel = resolve(gitResult(repositoryRoot, ["rev-parse", "--show-toplevel"]).trim());
  assert.equal(topLevel, resolve(repositoryRoot), `${label} repository root is not exact`);
  const status = gitResult(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  assert.equal(status, "", `${label} repository must be clean before manifest generation:\n${status}`);
  assert.equal(
    await readFile(resolve(repositoryRoot, ".gitattributes"), "utf8"),
    requiredAttributes,
    `${label} repository does not enforce the approved byte policy`,
  );
}

const trackedInputChecks = new Map();
async function assertTrackedInput(repositoryRoot, absolute) {
  const path = repositoryPath(repositoryRoot, absolute);
  const key = `${repositoryRoot}\0${path}`;
  if (trackedInputChecks.has(key)) return trackedInputChecks.get(key);
  const check = (async () => {
    const metadata = await stat(absolute);
    const tracked = gitResult(repositoryRoot, ["ls-files", "-z", "--", path])
      .split("\0")
      .filter(Boolean)
      .sort(compareCodeUnits);
    const files = metadata.isFile()
      ? [path]
      : (await filesBelow(absolute)).map((member) => `${path}/${member}`).sort(compareCodeUnits);
    assert.deepEqual(
      tracked,
      files,
      `${path} filesystem membership differs from the tracked inventory`,
    );
    const eolRecords = gitResult(repositoryRoot, ["ls-files", "--eol", "-z", "--", path])
      .split("\0")
      .filter(Boolean)
      .map((record) => {
        const match = /^i\/(\S+)\s+w\/(\S+)\s+attr\/([^\t]*)\t([\s\S]+)$/u.exec(record);
        assert.ok(match, `cannot parse Git EOL inventory record: ${record}`);
        return {
          index: match[1],
          worktree: match[2],
          attributes: match[3].trim(),
          path: match[4],
        };
      });
    assert.deepEqual(
      eolRecords.map(({ path: recordPath }) => recordPath).sort(compareCodeUnits),
      files,
      `${path} EOL inventory differs from the tracked inventory`,
    );
    for (const record of eolRecords) {
      if (record.attributes === "-text") continue;
      assert.ok(
        record.index === "lf" || record.index === "none",
        `${record.path} committed bytes are not LF text`,
      );
      assert.ok(
        record.worktree === "lf" || record.worktree === "none",
        `${record.path} checked-out bytes are not LF text`,
      );
    }
    for (const file of files) {
      const worktreeBytes = await readFile(resolve(repositoryRoot, file));
      const committedBytes = gitResult(repositoryRoot, ["show", `HEAD:${file}`], null);
      assert.equal(
        worktreeBytes.equals(committedBytes),
        true,
        `${file} checked-out bytes differ from the committed bytes`,
      );
    }
  })();
  trackedInputChecks.set(key, check);
  return check;
}

function normativeRequirementProjection(requirement) {
  const projection = {
    id: requirement.id,
    title: requirement.title,
    statement: requirement.statement,
    sourceDocument: requirement.sourceDocument,
    sourceAnchor: requirement.sourceAnchor,
    verification: requirement.verification,
    verificationMethods: requirement.verificationMethods,
    verificationCriteria: requirement.verificationCriteria,
    evidenceGroups: requirement.evidenceGroups,
  };
  if (Object.hasOwn(requirement, "incorporatedFrom")) {
    projection.incorporatedFrom = requirement.incorporatedFrom;
  }
  return projection;
}

function registryDigest(manifest) {
  return digest(Buffer.from(canonicalJson({
    conformanceProfiles: manifest.conformanceProfiles,
    evidenceGroups: manifest.evidenceGroups.map(({ id, requirementIds }) => ({ id, requirementIds })),
    requirements: manifest.requirements.map(normativeRequirementProjection),
  }), "utf8"));
}

async function filesBelow(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(root, path));
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
  }
  return files.sort();
}

async function documentInventory(root, paths) {
  const documents = [];
  for (const path of [...paths].sort()) {
    documents.push({ path, sha256: digest(await readFile(resolve(root, path))) });
  }
  return documents;
}

async function inputInventory(path) {
  const absolute = resolve(workspaceRoot, path);
  await assertTrackedInput(workspaceRoot, absolute);
  const metadata = await stat(absolute);
  if (metadata.isFile()) return { path, kind: "file", sha256: digest(await readFile(absolute)) };
  if (!metadata.isDirectory()) throw new Error(`${path} is not a regular file or directory`);
  const documents = await documentInventory(absolute, await filesBelow(absolute));
  return {
    path,
    kind: "directory",
    sha256: digest(Buffer.from(canonicalJson(documents), "utf8")),
  };
}

function parseRequirements(source, options) {
  const blocks = source.split(/\n(?=  - id: CCA-)/u).slice(1);
  return blocks.map((block) => {
    const id = block.match(/^  - id: (CCA-[A-Z]+(?:-[A-Z]+)?-[0-9]{3})/u)?.[1];
    const title = block.match(/^    title: (.+)$/mu)?.[1];
    const scalar = block.match(/^    requirement: (.*)$/mu)?.[1];
    let statement = scalar;
    if (/^[>|][+-]?$/u.test(scalar ?? "")) {
      const lines = block.split(/\r?\n/u);
      const start = lines.findIndex((line) => /^    requirement: [>|][+-]?$/u.test(line));
      const content = [];
      for (let index = start + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.length > 0 && !/^      /u.test(line)) break;
        content.push(line.length === 0 ? "" : line.slice(6));
      }
      const style = scalar[0];
      const chomp = scalar.slice(1);
      if (style === ">") {
        const folded = [];
        for (const line of content) {
          if (line.length === 0) folded.push("\n");
          else if (folded.length === 0 || folded.at(-1).endsWith("\n")) folded.push(line);
          else folded[folded.length - 1] = `${folded.at(-1)} ${line}`;
        }
        statement = folded.join("");
      } else {
        statement = content.join("\n");
      }
      if (chomp !== "-") statement += "\n";
      if (chomp !== "+") statement = statement.replace(/\n+$/u, chomp === "-" ? "" : "\n");
    }
    if (!id || !title || !statement) throw new Error(`Unable to parse requirement block: ${block.slice(0, 80)}`);
    if (/^[>|][+-]?$/u.test(statement)) throw new Error(`${id} contains an unresolved YAML scalar marker`);
    const methods = [...block.matchAll(/method:\s*([a-z0-9_]+)/gu)].map((match) => match[1]);
    const verificationCriteria = [...block.matchAll(/evidence:\s*([^}\]\r\n]+)/gu)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    const verification = methods.length > 0 && methods.every((method) => /(?:review|audit|inspection)$/u.test(method))
      ? "review"
      : "automated";
    const source = block.match(/^    source: "([^"]+)"$/mu)?.[1] ?? null;
    const sourceDocument = options.sourceDocument
      ?? source?.split(" § ", 1)[0]
      ?? "requirements.yaml";
    const directGroups = block.match(/^    evidence_groups: \[([^\]]+)\]$/mu)?.[1]
      ?.split(",")
      .map((value) => value.trim())
      .sort();
    const requirement = {
      id,
      title,
      statement,
      sourceDocument,
      sourceAnchor: id,
      verification,
      verificationMethods: [...new Set(methods)].sort(),
      verificationCriteria: [...new Set(verificationCriteria)].sort(),
      evidenceGroups: options.evidenceGroups ?? directGroups,
    };
    if (requirement.verificationCriteria.length === 0) {
      throw new Error(`${id} has no declared verification criterion`);
    }
    if (!requirement.evidenceGroups?.length) throw new Error(`${id} has no evidence group`);
    if (options.incorporatedFrom) requirement.incorporatedFrom = options.incorporatedFrom;
    return requirement;
  });
}

function parseConformanceProfiles(source) {
  const section = source.match(/\nconformance_profiles:\n([\s\S]*?)\nrequirements:\n/u)?.[1];
  if (!section) throw new Error("requirements.yaml lacks conformance_profiles");
  const applicability = /^  applicability: (\S+)$/mu.exec(section)?.[1];
  const common = /^  common_evidence_groups: \[([^\]]+)\]$/mu.exec(section)?.[1]
    ?.split(",").map((value) => value.trim());
  const profiles = [...section.matchAll(/^    - name: (.+)\n      evidence_groups: \[([^\]]+)\]$/gmu)]
    .map((match) => ({
      name: match[1],
      evidenceGroups: match[2].split(",").map((value) => value.trim()),
    }));
  if (!applicability || !common?.length || profiles.length === 0) {
    throw new Error("conformance_profiles is incomplete");
  }
  return {
    applicability,
    commonEvidenceGroups: common,
    profiles,
  };
}

function coverageSelectorsFor(requirement, mipSelectors) {
  const catalog = requirement.id.startsWith("CCA-MIP-")
    ? mipSelectors
    : requirement.id.startsWith("CCA-RF-")
      ? RF_REQUIREMENT_SELECTORS
      : DIRECT_REQUIREMENT_SELECTORS;
  const selectors = catalog[requirement.id];
  if (!selectors) throw new Error(`${requirement.id} is absent from the exact selector catalog`);
  if (requirement.verification === "automated"
      && selectors.length === 0
      && !Object.hasOwn(INCORPORATED_RANGE_CONJUNCTIONS, requirement.id)) {
    throw new Error(`${requirement.id} has no exact criterion-level selector`);
  }
  if (requirement.verification !== "automated" && selectors.length !== 0) {
    throw new Error(`${requirement.id} review evidence cannot be replaced by executable selectors`);
  }
  return selectors.map((selector) => ({ ...selector }));
}

const evidenceDefinitions = Object.freeze({
  "MOS-EVID-ADAPT-001": {
    description: "AI Runtime Adapter contract",
    command: "node --test tests/component_evidence_conformance_test.mjs",
    inputs: [
      "repositories/cca-studio/package.json",
      "repositories/cca-studio/tests/ai_runtime_adapter_test.mjs",
      "repositories/cca-studio/web/js/ai-runtime-adapter.js",
    ],
  },
  "MOS-EVID-ART-001": {
    description: "Native artifact reconstruction, identity, ordering, and control state",
    command: "node --test tests/component_evidence_conformance_test.mjs",
      inputs: [
        "repositories/cca-studio/package.json",
        "repositories/cca-studio/tests/investigation_core_test.mjs",
        "repositories/cca-studio/tests/memory_studio_integration_test.mjs",
        "repositories/cca-studio/tests/memory_studio_web_test.mjs",
        "repositories/cca-studio/web/js/cognitive-comparative-reconstruction.js",
      "repositories/cca-studio/web/js/cognitive-evolution.js",
      "repositories/cca-studio/web/js/cognitive-replay.js",
      "repositories/cca-studio/web/js/cognitive-trace.js",
      "repositories/cca-studio/web/js/graph-view-state.js",
      "repositories/cca-studio/web/js/semantic-world.js",
      "repositories/cca-studio/web/js/studio-model.js",
    ],
  },
  "MOS-EVID-CLI-001": {
    description: "CLI and automation behavior",
    command: "node --test tests/component_evidence_conformance_test.mjs tests/reference_implementation_conformance_test.mjs",
    inputs: [
      "repositories/memoryos-cli/package.json",
      "repositories/memoryos-cli/tests",
      "repositories/memoryos-cli/bin/memoryos.js",
      "repositories/memoryos-cli/src",
    ],
  },
  "MOS-EVID-COMP-001": {
    description: "Compatibility behavior",
    command: "node --test tests/compatibility_conformance_test.mjs",
    inputs: [
      "repositories/cca-studio/package.json",
      "repositories/cca-conformance/tests/compatibility_conformance_test.mjs",
      "repositories/cca-studio/tests/fixtures/mip",
      "repositories/cca-studio/web/js/memory-investigation-package.js",
      "repositories/cca-studio/web/js/mip-canonical.js",
    ],
  },
  "MOS-EVID-CONF-001": {
    description: "Conformance report integrity",
    command: "node --test tests/specification_conformance_test.mjs",
    inputs: [
      ".gitattributes",
      "repositories/cca-conformance/tests/specification_conformance_test.mjs",
      "repositories/cca-conformance/tests/support/conformance-support.mjs",
      "repositories/cca-conformance/tools/build-pinned-manifest.mjs",
      "repositories/cca-conformance/tools/conformance-report.mjs",
      "repositories/cca-conformance/tools/create-review-attestations.mjs",
      "repositories/cca-conformance/tools/requirement-selector-catalog.mjs",
      "repositories/cca-conformance/tools/run-reference-evidence.mjs",
      "repositories/cca-conformance/schema/conformance-evidence-1.0.schema.json",
      "repositories/cca-conformance/schema/conformance-report-1.0.schema.json",
      "repositories/cca-conformance/schema/requirements-manifest-1.0.schema.json",
      "repositories/cca-conformance/schema/review-attestations-1.0.schema.json",
    ],
  },
  "MOS-EVID-CORE-001": {
    description: "Investigation Core behavior",
    command: "node --test tests/component_evidence_conformance_test.mjs tests/reference_implementation_conformance_test.mjs",
    inputs: [
      "repositories/cca-studio/package.json",
      "repositories/cca-studio/tests/investigation_core_test.mjs",
      "repositories/cca-studio/web/js/investigation-core.js",
    ],
  },
  "MOS-EVID-EXPL-001": {
    description: "Investigation Explorer behavior",
    command: "node --test tests/component_evidence_conformance_test.mjs tests/reference_implementation_conformance_test.mjs",
    inputs: [
      "repositories/cca-studio/package.json",
      "repositories/cca-studio/tests/cognitive_investigation_explorer_test.mjs",
      "repositories/cca-studio/web/js/cognitive-investigation-explorer.js",
    ],
  },
  "MOS-EVID-LIFE-001": {
    description: "Investigation lifecycle and transition integrity",
    command: "node --test tests/component_evidence_conformance_test.mjs tests/reference_implementation_conformance_test.mjs",
    inputs: [
      "repositories/cca-studio/package.json",
      "repositories/cca-studio/tests/investigation_core_test.mjs",
      "repositories/cca-studio/web/js/investigation-core.js",
    ],
  },
  "MOS-EVID-MIP-001": {
    description: "MIP integration and CCA-MIP incorporation",
    command: "node --test tests/component_evidence_conformance_test.mjs tests/reference_implementation_conformance_test.mjs",
    inputs: [
      "repositories/cca-studio/package.json",
      "repositories/cca-studio/tests/fixtures/mip",
      "repositories/cca-studio/docs/mip-conformance-matrix.md",
      "repositories/cca-studio/tests/memory_investigation_package_test.mjs",
      "repositories/cca-studio/tests/mip_adversarial_conformance_test.mjs",
      "repositories/cca-studio/tests/mip_canonical_test.mjs",
      "repositories/cca-studio/tests/mip_derived_edge_conformance_test.mjs",
      "repositories/cca-studio/tests/mip_ordering_conformance_test.mjs",
      "repositories/cca-studio/tests/mip_pipeline_conformance_test.mjs",
      "repositories/cca-studio/tests/mip_schema_conformance_test.mjs",
      "repositories/cca-studio/web/js/memory-investigation-package.js",
      "repositories/cca-studio/web/js/mip-canonical.js",
    ],
  },
  "MOS-EVID-REG-001": {
    description: "Cognitive Regression behavior",
    command: "node --test tests/component_evidence_conformance_test.mjs tests/reference_implementation_conformance_test.mjs",
    inputs: [
      "repositories/cca-studio/package.json",
      "repositories/cca-studio/tests/cognitive_regression_test.mjs",
      "repositories/cca-studio/web/js/cognitive-regression.js",
    ],
  },
  "MOS-EVID-RT-001": {
    description: "Runtime observation boundary and CCA-RF incorporation",
    command: "ctest --test-dir <build-directory> --tests-regex ^memoryos.standard.runtime.reference$ --output-on-failure",
      inputs: [
      "CMakeLists.txt",
      "cmake",
      "repositories/cca-core/CMakeLists.txt",
      "repositories/cca-core/cmake/version.hpp.in",
      "repositories/cca-core/docs/runtime-conformance-evidence.md",
      "repositories/cca-core/include/cca",
      "repositories/cca-core/src",
      "repositories/cca-core/tests",
    ],
  },
  "MOS-EVID-SDK-001": {
    description: "SDK facade and binding parity",
    command: "ctest --test-dir <build-directory> --tests-regex ^memoryos.standard.sdk --output-on-failure",
      inputs: [
      "CMakeLists.txt",
      "cmake",
      "repositories/cca-core/CMakeLists.txt",
      "repositories/cca-core/cmake/version.hpp.in",
      "repositories/cca-core/include/cca",
      "repositories/cca-core/src",
      "repositories/cca-sdk/CMakeLists.txt",
      "repositories/cca-sdk/python/pyproject.toml",
      "repositories/cca-sdk/tests/generate-reference-snapshot.mjs",
      "repositories/cca-studio/package.json",
      "repositories/cca-studio/tests/fixtures/mip",
      "repositories/cca-studio/web/data",
      "repositories/cca-studio/web/js",
      "repositories/cca-sdk/python/tests/test_memoryos_sdk.py",
      "repositories/cca-sdk/python/src/memoryos/__init__.py",
      "repositories/cca-sdk/python/src/memoryos/_bridge.py",
      "repositories/cca-sdk/python/src/memoryos/_errors.py",
      "repositories/cca-sdk/python/src/memoryos/_immutable.py",
      "repositories/cca-sdk/python/src/memoryos/_models.py",
      "repositories/cca-sdk/python/src/memoryos/_sdk.py",
      "repositories/cca-sdk/python/src/memoryos/py.typed",
      "repositories/cca-sdk/include/memoryos/memoryos.hpp",
      "repositories/cca-sdk/src",
      "repositories/cca-sdk/bridge/investigation-core-host.mjs",
      "repositories/cca-sdk/tests/memoryos_sdk_test.cpp",
      "repositories/cca-studio/tests/memoryos_sdk_test.mjs",
      "repositories/cca-studio/web/js/memoryos-sdk.js",
    ],
  },
  "MOS-EVID-VER-001": {
    description: "Version identity and change control",
    command: "node --test tests/specification_conformance_test.mjs tests/compatibility_conformance_test.mjs",
    inputs: [
      "repositories/cca-conformance/schema/conformance-report-1.0.schema.json",
      "repositories/cca-conformance/tests/compatibility_conformance_test.mjs",
    ],
  },
});

async function main() {
  if (process.argv.length > 2) {
    if (process.argv.length === 3 && process.argv[2] === "--help") {
      process.stdout.write("Usage: node tools/build-pinned-manifest.mjs\n");
      return;
    }
    throw new Error("Usage: node tools/build-pinned-manifest.mjs");
  }
  await assertCleanRepository(workspaceRoot, "workspace");
  await assertCleanRepository(specificationsRepositoryRoot, "specifications");
  assert.equal(
    gitResult(specificationsRepositoryRoot, ["rev-parse", "HEAD"]).trim(),
    expectedSpecificationsCommit,
    "the specifications repository is not at the approved v1.2.1 publication commit",
  );
  const historicalManifest = resolve(workspaceRoot, historicalManifestPath);
  await assertTrackedInput(workspaceRoot, historicalManifest);
  assert.equal(
    digest(await readFile(historicalManifest)),
    expectedHistoricalManifestBytesDigest,
    "the immutable v1.2.0 content-addressed manifest bytes changed",
  );
  await assertTrackedInput(specificationsRepositoryRoot, standardRoot);
  const standardDocuments = await documentInventory(standardRoot, await filesBelow(standardRoot));
  const incorporatedSources = [
    {
      identifier: "CCA-MIP-1.0",
      version: "1.0",
      requirementRange: { first: "CCA-MIP-001", last: "CCA-MIP-064" },
      documentPaths: [
        "MIP-001.md", "conformance.md", "requirements.yaml",
        "schema/memory-investigation-package-1.0.schema.json",
      ],
      sourceDocument: "requirements.yaml",
      evidenceGroups: ["MOS-EVID-MIP-001"],
    },
    {
      identifier: "CCA-RF-1.0",
      version: "1.0",
      requirementRange: { first: "CCA-RF-001", last: "CCA-RF-040" },
      documentPaths: ["README.md", "conformance.md", "decisions.md", "requirements.yaml"],
      sourceDocument: "requirements.yaml",
      evidenceGroups: ["MOS-EVID-RT-001"],
    },
  ];
  const incorporatedStandards = [];
  const mipSourceRoot = resolve(specificationsRoot, "CCA-MIP-1.0");
  await assertTrackedInput(specificationsRepositoryRoot, mipSourceRoot);
  const mipSourceDocuments = await documentInventory(mipSourceRoot, await filesBelow(mipSourceRoot));
  assert.equal(
    digest(Buffer.from(canonicalJson(mipSourceDocuments), "utf8")),
    expectedMipSourcePackageDigest,
    "the reviewed 13-file CCA-MIP-1.0 source package changed",
  );
  const standardRequirementsSource = await readFile(resolve(standardRoot, "requirements.yaml"), "utf8");
  const conformanceProfiles = parseConformanceProfiles(standardRequirementsSource);
  const requirements = parseRequirements(standardRequirementsSource, {});
  for (const source of incorporatedSources) {
    const root = resolve(specificationsRoot, source.identifier);
    await assertTrackedInput(specificationsRepositoryRoot, root);
    const documents = await documentInventory(root, source.documentPaths);
    incorporatedStandards.push({
      identifier: source.identifier,
      version: source.version,
      publicationDigest: digest(Buffer.from(canonicalJson(documents), "utf8")),
      requirementRange: source.requirementRange,
      evidenceGroups: source.evidenceGroups,
      documents,
    });
    requirements.push(...parseRequirements(
      await readFile(resolve(root, "requirements.yaml"), "utf8"),
      {
        incorporatedFrom: source.identifier,
        sourceDocument: source.sourceDocument,
        evidenceGroups: source.evidenceGroups,
      },
    ));
  }
  requirements.sort((left, right) => compareCodeUnits(left.id, right.id));
  const mipSelectors = await loadMipRequirementSelectors(workspaceRoot);
  validateRequirementSelectorCatalog(mipSelectors);
  requirements.forEach((requirement) => {
    requirement.coverageSelectors = coverageSelectorsFor(requirement, mipSelectors);
    requirement.executionReferences = [...new Set(
      requirement.coverageSelectors.map(({ executionReference }) => executionReference),
    )].sort(compareCodeUnits);
  });
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  for (const [wrapperId, conjunction] of Object.entries(INCORPORATED_RANGE_CONJUNCTIONS)) {
    const wrapper = requirementById.get(wrapperId);
    if (!wrapper) throw new Error(`${wrapperId} is absent from the normative registry`);
    const prefix = conjunction.firstRequirement.slice(0, -3);
    const incorporated = requirements.filter(({ id }) => id.startsWith(prefix));
    if (incorporated.length !== conjunction.requirementCount
        || incorporated[0].id !== conjunction.firstRequirement
        || incorporated.at(-1).id !== conjunction.lastRequirement) {
      throw new Error(`${wrapperId} incorporated range is incomplete`);
    }
    wrapper.executionReferences = [...new Set(
      incorporated.flatMap(({ executionReferences }) => executionReferences),
    )].sort(compareCodeUnits);
  }

  const evidenceGroups = Object.entries(evidenceDefinitions)
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([id, definition], index) => {
      const groupRequirements = requirements.filter(
        ({ evidenceGroups: identifiers }) => identifiers.includes(id),
      );
      const executionReferences = [...new Set(groupRequirements
        .flatMap(({ executionReferences: references }) => references))].sort();
      const inputs = [...definition.inputs];
      inputs.push(...groupRequirements.flatMap(({ coverageSelectors }) => (
        coverageSelectors.map(({ source }) => source)
      )));
      if (id === "MOS-EVID-CONF-001") {
        inputs.push(...Object.values(evidenceDefinitions).flatMap(({ inputs: values }) => values));
        inputs.push(...requirements.flatMap(({ coverageSelectors }) => (
          coverageSelectors.map(({ source }) => source)
        )));
      }
      if (executionReferences.includes("normative-vectors-js")) {
        inputs.push("repositories/cca-conformance/tests/normative_vectors_conformance_test.mjs");
      }
      return {
        id,
        description: definition.description,
        automated: true,
        command: definition.command,
        implementation: implementationVersion,
        requirementIds: groupRequirements.map(({ id: requirementId }) => requirementId),
        executionReferences,
        method: "deterministic requirement-mapped conformance execution",
        inputs: [...new Set(inputs)].sort(),
        expectedOutcome: "Every mapped normative criterion is supported by its declared execution or retained review evidence.",
        durableEvidence: `evidence/reference-implementation-1.2.1.json#/evidence/${index}`,
      };
    });
  for (const group of evidenceGroups) {
    if (group.requirementIds.length === 0) throw new Error(`${group.id} has no mapped requirements`);
    if (group.executionReferences.length === 0) throw new Error(`${group.id} has no executable evidence`);
    for (const input of group.inputs) await access(resolve(workspaceRoot, input));
    group.inputInventory = [];
    for (const input of group.inputs) group.inputInventory.push(await inputInventory(input));
  }

  const implementationInputs = [];
  for (const input of referenceImplementationInputs) implementationInputs.push(await inputInventory(input));
  implementationInputs.sort((left, right) => compareCodeUnits(left.path, right.path));
  const implementation = Object.freeze({
    ...implementationVersion,
    revision: digest(Buffer.from(canonicalJson(implementationInputs), "utf8")),
  });
  assert.equal(
    implementation.revision,
    expectedImplementationRevision,
    "the repaired implementation revision differs from the approved v1.2.1 revision",
  );
  evidenceGroups.forEach((group) => { group.implementation = implementation; });

  const manifest = {
    schemaVersion: "1.0",
    standard: {
      identifier: "CCA-MEMORYOS-1.0",
      version: "1.0",
      publicationDate: "2026-09-05",
      publicationDigest: digest(Buffer.from(canonicalJson(standardDocuments), "utf8")),
      documents: standardDocuments,
    },
    incorporatedStandards,
    conformanceProfiles,
    implementation: {
      ...implementation,
      sourceInventory: implementationInputs,
    },
    evidenceGroups,
    requirements,
  };
  assert.equal(
    manifest.standard.publicationDigest,
    expectedStandardPublicationDigest,
    "CCA-MEMORYOS-1.0 publication bytes changed",
  );
  assert.equal(
    manifest.incorporatedStandards.find(({ identifier }) => identifier === "CCA-MIP-1.0")?.publicationDigest,
    expectedMipPublicationDigest,
    "CCA-MIP-1.0 publication bytes changed",
  );
  manifest.normativeRegistryDigest = registryDigest(manifest);
  assert.equal(
    manifest.normativeRegistryDigest,
    expectedNormativeRegistryDigest,
    "the normative registry changed during the v1.2.1 restoration",
  );
  const manifestSource = `${canonicalJson(manifest)}\n`;
  const retainedPath = await retainAssessmentManifest(manifest);
  const manifestPath = resolve(conformanceRoot, "requirements-manifest.json");
  await writeFile(manifestPath, manifestSource, "utf8");
  process.stdout.write(`${retainedPath}\n${manifestPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
