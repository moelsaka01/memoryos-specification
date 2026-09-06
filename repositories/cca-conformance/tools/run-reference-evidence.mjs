#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPONENT_EXECUTION_SOURCES,
  EXECUTION_COMMANDS,
  REFERENCE_EVIDENCE_PATH,
  REFERENCE_NATIVE_PROFILE,
  REFERENCE_REVIEW_PATH,
  REFERENCE_REVIEW_URI,
  buildRequirementEvidence,
  canonicalJson,
  executedGroupEvidence,
  normalizeEvidenceOutput,
  readCanonicalJson,
  readManifest,
  reconcileGroupEvidence,
  reproducibilityDiagnostics,
  retainedEvidenceFilename,
  sha256,
  validateEvidenceArtifactCurrent,
  validateManifestInputsCurrent,
  validateReviewArtifact,
} from "../tests/support/conformance-support.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(root, "../..");
const publishedStandardRoot = resolve(workspaceRoot, "../cca-specifications/specifications/CCA-MEMORYOS-1.0");
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function usage() {
  return "Usage: node tools/run-reference-evidence.mjs --manifest PATH --cmake PATH --ninja PATH --cxx PATH --ar PATH --ranlib PATH --compiler PATH --gtest-root PATH --build-dir NEW_PATH --python PATH --reviews PATH --assessor NAME --date YYYY-MM-DD";
}

function options(values) {
  assert.equal(values.length % 2, 0, usage());
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    assert.match(values[index], /^--[a-z-]+$/u, usage());
    assert.equal(Object.hasOwn(result, values[index]), false, `duplicate argument ${values[index]}`);
    result[values[index]] = values[index + 1];
  }
  for (const name of [
    "--manifest", "--cmake", "--ninja", "--cxx", "--ar", "--ranlib", "--compiler", "--gtest-root",
    "--build-dir", "--python", "--reviews", "--assessor", "--date",
  ]) {
    assert.ok(result[name], `missing ${name}`);
  }
  assert.match(result["--date"], /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u);
  assert.equal(resolve(result["--reviews"]), REFERENCE_REVIEW_PATH, "review evidence must use the canonical retained path");
  return result;
}

function filesBelow(root, directory = root) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => compare(left.name, right.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...filesBelow(root, path));
    else if (entry.isFile()) paths.push(relative(root, path).split(sep).join("/"));
  }
  return paths.sort(compare);
}

function directoryResourceRecord(role, path) {
  const rootPath = resolve(path);
  const inventory = filesBelow(rootPath).map((relativePath) => ({
    path: relativePath,
    sha256: sha256(readFileSync(resolve(rootPath, relativePath))),
  }));
  assert.ok(inventory.length > 0, `${role} resource inventory is empty`);
  return {
    role,
    root: rootPath,
    inventory,
    sha256: sha256(Buffer.from(canonicalJson(inventory), "utf8")),
  };
}

function toolRecord(path, version) {
  const absolute = resolve(path);
  assert.equal(statSync(absolute).isFile(), true, `tool is not a file: ${absolute}`);
  return { path: absolute, sha256: sha256(readFileSync(absolute)), version };
}

function assertWrapperDelegates(wrapperPath, compilerPath, subcommand) {
  const source = readFileSync(wrapperPath, "utf8");
  const invocation = /^"(%~dp0[^"]+)" ([a-z+]+) %\*$/gmu.exec(source);
  assert.ok(invocation, `unrecognized compiler wrapper ${wrapperPath}`);
  const delegated = resolve(dirname(wrapperPath), invocation[1].slice("%~dp0".length));
  assert.equal(delegated, resolve(compilerPath), `${wrapperPath} delegates to an unattested compiler`);
  assert.equal(invocation[2], subcommand, `${wrapperPath} invokes an unexpected compiler mode`);
}

function tapChecks(output) {
  const checks = [];
  const lines = output.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const selector = /^(?:# )*# Subtest: (.+)$/u.exec(lines[index])?.[1];
    if (!selector) continue;
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 5); cursor += 1) {
      const result = /^(?:# )*(ok|not ok) [0-9]+ - /u.exec(lines[cursor]);
      if (!result) continue;
      checks.push({
        selector,
        status: /# SKIP/u.test(lines[cursor]) ? "SKIP" : result[1] === "ok" ? "PASS" : "FAIL",
      });
      break;
    }
  }
  return checks;
}

function gtestChecks(output) {
  return [...output.matchAll(/^\[\s*(OK|SKIPPED|FAILED)\s*\]\s+([^\s]+)(?:\s|$)/gmu)].map((match) => ({
    selector: match[2],
    status: match[1] === "OK" ? "PASS" : match[1] === "SKIPPED" ? "SKIP" : "FAIL",
  }));
}

function unittestChecks(output) {
  return [...output.matchAll(/^test_[^\s]+ \((?:[^.()]+\.)*([A-Za-z0-9_]+\.[A-Za-z0-9_]+)\) \.\.\. (ok|skipped .*|FAIL|ERROR)$/gmu)].map((match) => ({
    selector: match[1],
    status: match[2] === "ok" ? "PASS" : match[2].startsWith("skipped") ? "SKIP" : "FAIL",
  }));
}

function occurrenceCount(source, value) {
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(value, index)) !== -1) {
    count += 1;
    index += value.length;
  }
  return count;
}

function assertSelectorDeclared({ source, selector }, arguments_, id) {
  const absolute = resolve(workspaceRoot, source);
  const text = readFileSync(absolute, "utf8");
  let declarations;
  if (source.endsWith(".cpp")) {
    const [suite, test] = selector.split(".");
    const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    declarations = [...text.matchAll(new RegExp(`TEST(?:_F)?\\(\\s*${escape(suite)}\\s*,\\s*${escape(test)}\\s*\\)`, "gu"))].length;
  } else if (source.endsWith(".py")) {
    const [suite, test] = selector.split(".");
    declarations = occurrenceCount(text, `class ${suite}`) === 1
      ? [...text.matchAll(new RegExp(`^\\s+def ${test}\\(self\\):`, "gmu"))].length
      : 0;
  } else {
    declarations = occurrenceCount(text, selector);
    if (declarations === 0 && source.endsWith("/mip_canonical_test.mjs")) {
      const vector = /^published MIP vector (.+) has canonical bytes and exact commitments$/u.exec(selector)?.[1];
      if (vector
        && occurrenceCount(text, "test(`published MIP vector ${vector.path} has canonical bytes and exact commitments`") === 1
        && occurrenceCount(text, `path: \"${vector}\"`) === 1) declarations = 1;
    }
    if (declarations === 0 && source.endsWith("/mip_schema_conformance_test.mjs")) {
      const vector = /^independent JSON Schema validation accepts published vector (.+)$/u.exec(selector)?.[1];
      if (vector
        && occurrenceCount(text, "test(`independent JSON Schema validation accepts published vector ${name}`") === 1
        && occurrenceCount(text, `\"${vector}\"`) === 1) declarations = 1;
    }
  }
  assert.equal(declarations, 1, `${id} selector must be declared exactly once in ${source}: ${selector}`);
  if (source.endsWith(".mjs")) {
    const included = arguments_.includes(absolute)
      || (id === "reproducibility-meta" && absolute === fileURLToPath(import.meta.url));
    assert.equal(included, true, `${id} did not directly invoke selector source ${source}`);
  }
}

function normalizedEvidenceEnvironment(env = {}) {
  const evidenceEnvironment = {
    FORCE_COLOR: "0",
    LANG: "C",
    LC_ALL: "C",
    NO_COLOR: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    TZ: "UTC",
    ...env,
  };
  for (const [name, value] of Object.entries(evidenceEnvironment)) {
    if (value === null) delete evidenceEnvironment[name];
  }
  return Object.fromEntries(Object.entries(evidenceEnvironment).sort(([left], [right]) => compare(left, right)));
}

function execute({ id, executable, arguments_, inputInventory, attribution, parser, expectedTests, allowedSkips = [], cwd = workspaceRoot, env = {}, preflightDiagnostics = [] }) {
  assert.equal(typeof EXECUTION_COMMANDS[id], "string", `unknown execution ${id}`);
  assert.equal(Number.isInteger(expectedTests) && expectedTests > 0, true, `${id} lacks an expected test count`);
  validateManifestInputsCurrent(manifest);
  const executablePath = resolve(executable);
  const evidenceEnvironment = normalizedEvidenceEnvironment(env);
  const environment = { ...process.env, ...evidenceEnvironment };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.NODE_TEST_NAME_PATTERN;
  delete environment.NODE_TEST_REPORTER;
  for (const selector of attribution) assertSelectorDeclared(selector, arguments_, id);
  const result = spawnSync(executablePath, arguments_, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(Number.isInteger(result.status), true, `${id} did not return a process exit code`);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const rawChecks = parser(output).sort((left, right) => compare(left.selector, right.selector));
  const duplicateSelectors = rawChecks
    .filter((check, index) => index > 0 && check.selector === rawChecks[index - 1].selector)
    .map(({ selector }) => selector);
  const observedSkips = rawChecks.filter(({ status }) => status === "SKIP").map(({ selector }) => selector);
  const checks = attribution.flatMap(({ source, selector }) => (
    rawChecks.filter(({ selector: observed }) => observed === selector)
      .map(({ status }) => ({ source, selector, status }))
  )).sort((left, right) => compare(`${left.source}\0${left.selector}`, `${right.source}\0${right.selector}`));
  const issues = [...preflightDiagnostics];
  if (rawChecks.length !== expectedTests) issues.push(`expected ${expectedTests} tests, observed ${rawChecks.length}`);
  if (rawChecks.length === 0) issues.push("target process produced no parseable test cases");
  if (duplicateSelectors.length > 0) issues.push(`duplicate selectors: ${duplicateSelectors.join(", ")}`);
  if (canonicalJson(observedSkips) !== canonicalJson([...allowedSkips].sort(compare))) {
    issues.push(`unexpected skip set: ${observedSkips.join(", ") || "none"}`);
  }
  if (rawChecks.some(({ status }) => status === "FAIL")) issues.push("one or more target checks failed");
  if (result.status !== 0) issues.push(`target process exited ${result.status}`);
  for (const { source, selector } of attribution) {
    const matches = checks.filter((check) => check.source === source && check.selector === selector);
    if (matches.length !== 1 || matches[0].status !== "PASS") {
      issues.push(`criterion selector did not resolve once to PASS: ${source}#${selector}`);
    }
  }
  const status = issues.length === 0 ? "PASS" : "FAIL";
  const normalizedStdout = normalizeEvidenceOutput(result.stdout ?? "");
  const normalizedStderr = normalizeEvidenceOutput(result.stderr ?? "");
  process.stdout.write(`${status} ${id} (${rawChecks.length}/${expectedTests} tests; ${checks.length} attributed checks)${issues.length ? `: ${issues.join("; ")}` : ""}\n`);
  return {
    id,
    command: EXECUTION_COMMANDS[id],
    executablePath,
    executableDigest: sha256(readFileSync(executablePath)),
    argv: arguments_,
    cwd: resolve(cwd),
    environment: evidenceEnvironment,
    inputInventory,
    inputDigest: sha256(Buffer.from(canonicalJson(inputInventory), "utf8")),
    stdoutDigest: sha256(Buffer.from(normalizedStdout, "utf8")),
    stderrDigest: sha256(Buffer.from(normalizedStderr, "utf8")),
    expectedTests,
    allowedSkips: [...allowedSkips].sort(compare),
    rawChecks,
    tests: rawChecks.length,
    pass: rawChecks.filter(({ status }) => status === "PASS").length,
    skipped: rawChecks.filter(({ status }) => status === "SKIP").length,
    fail: rawChecks.filter(({ status }) => status === "FAIL").length,
    checks,
    diagnostics: issues,
    status,
    exitCode: result.status,
  };
}

const REPRODUCIBILITY_SELECTOR = "CCA-MOS-CONF-003: evidence and reports are invariant under irrelevant environment and presentation variation";

function reproducibleProjection(execution) {
  const { environment: ignored, ...projection } = execution;
  return projection;
}

function reproducibilityExecution(primaryExecutions, variantExecutions, binding) {
  const diagnostics = reproducibilityDiagnostics(primaryExecutions, variantExecutions);
  const status = diagnostics.length === 0 ? "PASS" : "FAIL";
  const rawChecks = [{ selector: REPRODUCIBILITY_SELECTOR, status }];
  const checks = binding.attribution.map(({ source, selector }) => ({ source, selector, status }));
  const source = fileURLToPath(import.meta.url);
  const comparisonBytes = Buffer.from(canonicalJson({
    primaryExecutions: primaryExecutions.map(reproducibleProjection),
    variantExecutions: variantExecutions.map(reproducibleProjection),
  }), "utf8");
  return {
    id: "reproducibility-meta",
    command: EXECUTION_COMMANDS["reproducibility-meta"],
    executablePath: source,
    executableDigest: sha256(readFileSync(source)),
    argv: [],
    cwd: root,
    environment: {},
    inputInventory: binding.inputInventory,
    inputDigest: sha256(Buffer.from(canonicalJson(binding.inputInventory), "utf8")),
    stdoutDigest: sha256(comparisonBytes),
    stderrDigest: sha256(Buffer.alloc(0)),
    expectedTests: 1,
    allowedSkips: [],
    rawChecks,
    tests: 1,
    pass: status === "PASS" ? 1 : 0,
    skipped: 0,
    fail: status === "FAIL" ? 1 : 0,
    checks,
    diagnostics,
    status,
    exitCode: status === "PASS" ? 0 : 1,
  };
}

function probeGtest(executable, expectedTests, sentinels) {
  const result = spawnSync(resolve(executable), ["--gtest_list_tests"], { cwd: workspaceRoot, encoding: "utf8", windowsHide: true });
  assert.ifError(result.error);
  assert.equal(Number.isInteger(result.status), true, "native test inventory probe returned no exit code");
  let suite = "";
  const selectors = [];
  for (const line of result.stdout.split(/\r?\n/u)) {
    if (/^[^\s].*\.$/u.test(line)) suite = line.trim().slice(0, -1);
    else if (/^\s{2}\S/u.test(line)) selectors.push(`${suite}.${line.trim().split(/\s+#/u, 1)[0]}`);
  }
  const diagnostics = [];
  if (result.status !== 0) diagnostics.push(`native test inventory probe exited ${result.status}`);
  if (selectors.length !== expectedTests) diagnostics.push(`native test inventory expected ${expectedTests} tests, observed ${selectors.length}`);
  for (const sentinel of sentinels) {
    if (!selectors.includes(sentinel)) diagnostics.push(`native sentinel absent: ${sentinel}`);
  }
  return diagnostics;
}

function infrastructureStep(executable, arguments_, cwd, label) {
  const result = spawnSync(executable, arguments_, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", TZ: "UTC" },
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(Number.isInteger(result.status), true, `${label} returned no exit code`);
  return {
    argv: arguments_,
    cwd: resolve(cwd),
    stdoutDigest: sha256(Buffer.from(normalizeEvidenceOutput(result.stdout ?? ""), "utf8")),
    stderrDigest: sha256(Buffer.from(normalizeEvidenceOutput(result.stderr ?? ""), "utf8")),
    exitCode: result.status,
  };
}

async function createNativeBuildAttestation(selected, sourceRevision, buildInputInventory) {
  const cmakePath = resolve(selected["--cmake"]);
  const ninjaPath = resolve(selected["--ninja"]);
  const cxxPath = resolve(selected["--cxx"]);
  const arPath = resolve(selected["--ar"]);
  const ranlibPath = resolve(selected["--ranlib"]);
  const compilerPath = resolve(selected["--compiler"]);
  const gtestRoot = resolve(selected["--gtest-root"]);
  const buildPath = resolve(selected["--build-dir"]);
  await assert.rejects(access(buildPath), "native build directory must not already exist");
  await mkdir(dirname(buildPath), { recursive: true });
  const versionProbe = spawnSync(cmakePath, ["--version"], { encoding: "utf8", windowsHide: true });
  assert.ifError(versionProbe.error);
  assert.equal(versionProbe.status, 0, "CMake version probe failed");
  const cmakeVersion = /^cmake version ([^\r\n]+)/u.exec(versionProbe.stdout)?.[1];
  assert.ok(cmakeVersion, "CMake version output is unrecognized");
  const ninjaProbe = spawnSync(ninjaPath, ["--version"], { encoding: "utf8", windowsHide: true });
  assert.ifError(ninjaProbe.error);
  assert.equal(ninjaProbe.status, 0, "Ninja version probe failed");
  const compilerProbe = spawnSync(compilerPath, ["version"], { encoding: "utf8", windowsHide: true });
  assert.ifError(compilerProbe.error);
  assert.equal(compilerProbe.status, 0, "compiler version probe failed");
  const compilerVersion = compilerProbe.stdout.trim();
  requireNonemptyVersion(compilerVersion, "compiler");
  const compilerEnvironmentProbe = spawnSync(compilerPath, ["env"], { encoding: "utf8", windowsHide: true });
  assert.ifError(compilerEnvironmentProbe.error);
  assert.equal(compilerEnvironmentProbe.status, 0, "compiler environment probe failed");
  const compilerEnvironment = JSON.parse(compilerEnvironmentProbe.stdout);
  const zigLibraryRoot = resolve(compilerEnvironment.lib_dir);
  assert.equal(statSync(zigLibraryRoot).isDirectory(), true, "compiler library root is unavailable");
  const cmakeSystemProbe = spawnSync(cmakePath, ["--system-information"], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(cmakeSystemProbe.error);
  assert.equal(cmakeSystemProbe.status, 0, "CMake system-information probe failed");
  const cmakeModuleRoot = /(?:^|\n)CMAKE_ROOT "([^"]+)"/u.exec(cmakeSystemProbe.stdout)?.[1];
  assert.ok(cmakeModuleRoot, "CMake module root is unavailable");
  const commandProcessorPath = resolve(process.env.ComSpec ?? "");
  assert.equal(statSync(commandProcessorPath).isFile(), true, "Windows command processor is unavailable");
  const commandProcessorProbe = spawnSync(commandProcessorPath, ["/d", "/c", "ver"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.ifError(commandProcessorProbe.error);
  assert.equal(commandProcessorProbe.status, 0, "command processor version probe failed");
  assertWrapperDelegates(cxxPath, compilerPath, "c++");
  assertWrapperDelegates(arPath, compilerPath, "ar");
  assertWrapperDelegates(ranlibPath, compilerPath, "ranlib");
  const gtestVersionSource = readFileSync(resolve(gtestRoot, "lib/cmake/GTest/GTestConfigVersion.cmake"), "utf8");
  const gtestVersion = /set\(PACKAGE_VERSION "([^"]+)"\)/u.exec(gtestVersionSource)?.[1];
  requireNonemptyVersion(gtestVersion, "GTest");
  validateManifestInputsCurrent(manifest);
  const coreSource = resolve(workspaceRoot, "repositories/cca-core");
  const sdkSource = resolve(workspaceRoot, "repositories/cca-sdk");
  const coreBuild = resolve(buildPath, "core");
  const sdkBuild = resolve(buildPath, "sdk");
  const configureArguments = (source, output) => [
    "-S", source,
    "-B", output,
    "-G", "Ninja",
    `-DCMAKE_MAKE_PROGRAM=${ninjaPath}`,
    `-DCMAKE_CXX_COMPILER=${cxxPath}`,
    `-DCMAKE_AR=${arPath}`,
    `-DCMAKE_RANLIB=${ranlibPath}`,
    "-DCMAKE_BUILD_TYPE=Debug",
    "-DBUILD_TESTING=ON",
    "-DCCA_BUILD_TESTS=ON",
    "-DCCA_WARNINGS_AS_ERRORS=ON",
    "-DCMAKE_CXX_STANDARD=23",
    "-DCMAKE_CXX_STANDARD_REQUIRED=ON",
    "-DCMAKE_CXX_EXTENSIONS=OFF",
    "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
    `-DGTest_DIR=${resolve(gtestRoot, "lib/cmake/GTest")}`,
    `-DMEMORYOS_NODE_EXECUTABLE=${resolve(process.execPath)}`,
    `-DMEMORYOS_CLI_NODE_EXECUTABLE=${resolve(process.execPath)}`,
    `-DMEMORYOS_CONFORMANCE_NODE_EXECUTABLE=${resolve(process.execPath)}`,
  ];
  const configures = [
    { project: "runtime", ...infrastructureStep(cmakePath, configureArguments(coreSource, coreBuild), workspaceRoot, "suite-controlled Runtime configure") },
    { project: "sdk", ...infrastructureStep(cmakePath, configureArguments(sdkSource, sdkBuild), workspaceRoot, "suite-controlled SDK configure") },
  ];
  validateManifestInputsCurrent(manifest);
  const builds = [
    { project: "runtime", ...infrastructureStep(cmakePath, ["--build", coreBuild, "--target", "cca_core_tests", "--parallel", "4"], workspaceRoot, "suite-controlled Runtime build") },
    { project: "sdk", ...infrastructureStep(cmakePath, ["--build", sdkBuild, "--target", "memoryos_sdk_cpp_tests", "--parallel", "4"], workspaceRoot, "suite-controlled SDK build") },
  ];
  validateManifestInputsCurrent(manifest);
  const suffix = process.platform === "win32" ? ".exe" : "";
  const runtime = resolve(coreBuild, `tests/cca_core_tests${suffix}`);
  const sdk = resolve(sdkBuild, `memoryos_sdk_cpp_tests${suffix}`);
  const configurationArtifacts = [
    { role: "runtime-build-graph", path: resolve(coreBuild, "build.ninja") },
    { role: "runtime-cache", path: resolve(coreBuild, "CMakeCache.txt") },
    { role: "runtime-compile-commands", path: resolve(coreBuild, "compile_commands.json") },
    { role: "sdk-build-graph", path: resolve(sdkBuild, "build.ninja") },
    { role: "sdk-cache", path: resolve(sdkBuild, "CMakeCache.txt") },
    { role: "sdk-compile-commands", path: resolve(sdkBuild, "compile_commands.json") },
  ].filter(({ role, path }) => {
    const project = role.startsWith("runtime-") ? "runtime" : "sdk";
    return configures.find(({ project: value }) => value === project)?.exitCode === 0 && existsSync(path);
  }).map(({ role, path }) => ({ role, path, sha256: sha256(readFileSync(path)) }));
  const nativeArtifacts = [
    { role: "runtime-native", project: "runtime", path: runtime },
    { role: "sdk-cpp", project: "sdk", path: sdk },
  ].filter(({ project, path }) => (
    configures.find(({ project: value }) => value === project)?.exitCode === 0
    && builds.find(({ project: value }) => value === project)?.exitCode === 0
    && existsSync(path)
  )).map(({ role, path }) => ({ role, path, sha256: sha256(readFileSync(path)) }));
  return {
    sourceRevision,
    buildInputInventory,
    buildInputDigest: sha256(Buffer.from(canonicalJson(buildInputInventory), "utf8")),
    tools: [
      { role: "ar", ...toolRecord(arPath, `delegates-to-zig-${compilerVersion}:ar`) },
      { role: "cmake", ...toolRecord(cmakePath, cmakeVersion) },
      { role: "command-processor", ...toolRecord(commandProcessorPath, commandProcessorProbe.stdout.trim()) },
      { role: "compiler", ...toolRecord(compilerPath, compilerVersion) },
      { role: "cxx", ...toolRecord(cxxPath, `delegates-to-zig-${compilerVersion}:c++`) },
      { role: "ninja", ...toolRecord(ninjaPath, ninjaProbe.stdout.trim()) },
      { role: "node", ...toolRecord(process.execPath, process.version) },
      { role: "ranlib", ...toolRecord(ranlibPath, `delegates-to-zig-${compilerVersion}:ranlib`) },
    ],
    resources: [
      directoryResourceRecord("cmake-modules", cmakeModuleRoot),
      directoryResourceRecord("zig-library", zigLibraryRoot),
    ],
    dependencies: [{
      identifier: "GTest",
      version: gtestVersion,
      ...directoryResourceRecord("gtest-installation", gtestRoot),
    }],
    buildDirectory: buildPath,
    configures,
    builds,
    configurationArtifacts,
    targets: ["cca_core_tests", "memoryos_sdk_cpp_tests"],
    artifacts: nativeArtifacts,
  };
}

function requireNonemptyVersion(value, label) {
  assert.equal(typeof value, "string", `${label} version is unavailable`);
  assert.notEqual(value.length, 0, `${label} version is unavailable`);
}

const selected = options(process.argv.slice(2));
await assert.rejects(access(REFERENCE_EVIDENCE_PATH), "retained evidence already exists and cannot be rewritten");
const manifest = await readManifest(resolve(selected["--manifest"]));
const sourceInventory = validateManifestInputsCurrent(manifest);
const revision = sha256(Buffer.from(canonicalJson(sourceInventory), "utf8"));
const implementation = Object.freeze({ name: "MemoryOS Reference Implementation", version: "1.2.0", revision });
for (const group of manifest.evidenceGroups) assert.deepEqual(group.implementation, implementation);
function executionBinding(id) {
  const attribution = [...new Map(
    manifest.requirements
      .flatMap(({ coverageSelectors }) => coverageSelectors)
      .filter(({ executionReference }) => executionReference === id)
      .map(({ source, selector }) => [`${source}\0${selector}`, { source, selector }]),
  ).values()].sort((left, right) => compare(
    `${left.source}\0${left.selector}`,
    `${right.source}\0${right.selector}`,
  ));
  const inputInventory = [...new Map(
    manifest.evidenceGroups
      .filter(({ executionReferences }) => executionReferences.includes(id))
      .flatMap(({ inputInventory }) => inputInventory)
      .map((record) => [record.path, record]),
  ).values()].sort((left, right) => compare(left.path, right.path));
  assert.ok(attribution.length > 0, `${id} has no criterion-level attribution`);
  assert.ok(inputInventory.length > 0, `${id} has no committed inputs`);
  return { attribution, inputInventory };
}

const pythonProbe = spawnSync(selected["--python"], ["--version"], {
  encoding: "utf8",
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  windowsHide: true,
});
assert.ifError(pythonProbe.error);
assert.equal(pythonProbe.status, 0, "Python version probe failed");
const pythonVersion = `${pythonProbe.stdout}${pythonProbe.stderr}`.trim();
const pythonRoot = resolve(workspaceRoot, "repositories/cca-sdk/python/src");
const pythonTest = resolve(workspaceRoot, "repositories/cca-sdk/python/tests/test_memoryos_sdk.py");
const suiteTest = (name) => resolve(root, `tests/${name}`);
const tapArgs = (name) => ["--test", "--test-reporter=tap", suiteTest(name)];
const componentArgs = [
  "--test",
  "--test-reporter=tap",
  "--test-concurrency=1",
  ...COMPONENT_EXECUTION_SOURCES.map((path) => resolve(workspaceRoot, path)),
];

const nativeBuildInputs = [...new Map(
  [
    ...sourceInventory,
    ...["runtime-native", "sdk-cpp"]
      .flatMap((id) => executionBinding(id).inputInventory),
  ]
    .map((record) => [record.path, record]),
).values()].sort((left, right) => compare(left.path, right.path));
const nativeBuildAttestation = await createNativeBuildAttestation(selected, revision, nativeBuildInputs);
const nativeArtifact = (role) => {
  return nativeBuildAttestation.artifacts.find(({ role: value }) => value === role) ?? null;
};
function failedNativeBuildExecution({ id, inputInventory, attribution, expectedTests, project, env = {} }) {
  validateManifestInputsCurrent(manifest);
  for (const selector of attribution) assertSelectorDeclared(selector, [], id);
  const configure = nativeBuildAttestation.configures.find(({ project: value }) => value === project);
  const build = nativeBuildAttestation.builds.find(({ project: value }) => value === project);
  const cmake = nativeBuildAttestation.tools.find(({ role }) => role === "cmake");
  assert.ok(configure && build && cmake, `${id} build-failure evidence is incomplete`);
  const diagnostics = [
    `suite-controlled ${project} target did not produce its test executable`,
    `target configure exited ${configure.exitCode}`,
    `target build exited ${build.exitCode}`,
    `expected ${expectedTests} tests, observed 0`,
    "target process produced no parseable test cases",
    ...attribution.map(({ source, selector }) => `criterion selector did not resolve once to PASS: ${source}#${selector}`),
  ];
  process.stdout.write(`FAIL ${id} (0/${expectedTests} tests; 0 attributed checks): ${diagnostics.join("; ")}\n`);
  return {
    id,
    command: EXECUTION_COMMANDS[id],
    executablePath: cmake.path,
    executableDigest: cmake.sha256,
    argv: build.argv,
    cwd: build.cwd,
    environment: normalizedEvidenceEnvironment(env),
    inputInventory,
    inputDigest: sha256(Buffer.from(canonicalJson(inputInventory), "utf8")),
    stdoutDigest: build.stdoutDigest,
    stderrDigest: build.stderrDigest,
    expectedTests,
    allowedSkips: [],
    rawChecks: [],
    tests: 0,
    pass: 0,
    skipped: 0,
    fail: 0,
    checks: [],
    diagnostics,
    status: "FAIL",
    exitCode: build.exitCode !== 0 ? build.exitCode : configure.exitCode !== 0 ? configure.exitCode : 1,
  };
}
const runtimeArtifact = nativeArtifact("runtime-native");
const sdkCppArtifact = nativeArtifact("sdk-cpp");
const plans = [
  { id: "boundary-js", ...executionBinding("boundary-js"), executable: process.execPath, arguments_: tapArgs("boundary_contract_conformance_test.mjs"), parser: tapChecks, expectedTests: 2, cwd: root, env: { MEMORYOS_CONFORMANCE_PYTHON: resolve(selected["--python"]) } },
  { id: "component-js", ...executionBinding("component-js"), executable: process.execPath, arguments_: componentArgs, parser: tapChecks, expectedTests: 257, allowedSkips: ["MO-1206 Regression remains deterministic under repeated bounded analysis", "MO-1207 Explorer is read-only and deterministic under bounded navigation", "investigate remains bounded for a complete deterministic Regression Report"], cwd: workspaceRoot, env: { MEMORYOS_DETERMINISTIC_CONFORMANCE: "1" } },
  { id: "compatibility-js", ...executionBinding("compatibility-js"), executable: process.execPath, arguments_: tapArgs("compatibility_conformance_test.mjs"), parser: tapChecks, expectedTests: 4, cwd: root },
  { id: "reference-js", ...executionBinding("reference-js"), executable: process.execPath, arguments_: tapArgs("reference_implementation_conformance_test.mjs"), parser: tapChecks, expectedTests: 5, cwd: root },
  { id: "normative-vectors-js", ...executionBinding("normative-vectors-js"), executable: process.execPath, arguments_: tapArgs("normative_vectors_conformance_test.mjs"), parser: tapChecks, expectedTests: 10, cwd: root },
  runtimeArtifact
    ? { id: "runtime-native", ...executionBinding("runtime-native"), executable: runtimeArtifact.path, arguments_: [], parser: gtestChecks, expectedTests: 376, preflightDiagnostics: probeGtest(runtimeArtifact.path, 376, ["RuntimeTest.FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown"]) }
    : { id: "runtime-native", ...executionBinding("runtime-native"), expectedTests: 376, project: "runtime", buildFailure: true },
  sdkCppArtifact
    ? { id: "sdk-cpp", ...executionBinding("sdk-cpp"), executable: sdkCppArtifact.path, arguments_: [], parser: gtestChecks, expectedTests: 13, preflightDiagnostics: probeGtest(sdkCppArtifact.path, 13, ["MemoryOsSdk.ExposesVersionedImmutableValueHandles"]) }
    : { id: "sdk-cpp", ...executionBinding("sdk-cpp"), expectedTests: 13, project: "sdk", buildFailure: true },
  { id: "sdk-python", ...executionBinding("sdk-python"), executable: selected["--python"], arguments_: [pythonTest, "-v"], parser: unittestChecks, expectedTests: 12, env: { MEMORYOS_NODE: process.execPath, PYTHONPATH: pythonRoot } },
  { id: "specification-js", ...executionBinding("specification-js"), executable: process.execPath, arguments_: tapArgs("specification_conformance_test.mjs"), parser: tapChecks, expectedTests: 11, cwd: root, env: { MEMORYOS_STANDARD_ROOT: publishedStandardRoot, MEMORYOS_REQUIRE_PUBLISHED_STANDARD: "1", MEMORYOS_CONFORMANCE_MANIFEST: resolve(selected["--manifest"]) } },
];
const runPlan = (plan) => plan.buildFailure ? failedNativeBuildExecution(plan) : execute(plan);
const primaryExecutions = plans.map(runPlan).sort((left, right) => compare(left.id, right.id));
const variantEnvironment = Object.freeze({
  FORCE_COLOR: "1",
  LANG: "tr_TR.UTF-8",
  LC_ALL: "tr_TR.UTF-8",
  MEMORYOS_LAYOUT: "conformance-irrelevant-layout",
  MEMORYOS_RENDERER: "conformance-irrelevant-renderer",
  NO_COLOR: null,
  TZ: "Pacific/Kiritimati",
});
const variantExecutions = plans.map((plan) => runPlan({
  ...plan,
  env: { ...(plan.env ?? {}), ...variantEnvironment },
})).sort((left, right) => compare(left.id, right.id));
const reproducibility = { variantEnvironment, executions: variantExecutions };
const reproducibilityBinding = executionBinding("reproducibility-meta");
for (const selector of reproducibilityBinding.attribution) assertSelectorDeclared(selector, [], "reproducibility-meta");
const executions = [
  ...primaryExecutions,
  reproducibilityExecution(primaryExecutions, variantExecutions, reproducibilityBinding),
].sort((left, right) => compare(left.id, right.id));
const expectedExecutionIds = [...new Set(manifest.requirements.flatMap(({ executionReferences }) => executionReferences))].sort(compare);
assert.deepEqual(executions.map(({ id }) => id), expectedExecutionIds, "the retained execution set must be exact");

const reviewArtifact = await readCanonicalJson(REFERENCE_REVIEW_PATH);
validateReviewArtifact(reviewArtifact, manifest);
assert.deepEqual(reviewArtifact.implementation, implementation);
assert.equal(reviewArtifact.reviewer, selected["--assessor"]);
assert.equal(reviewArtifact.assessmentDate, selected["--date"]);
let evidence = executedGroupEvidence(manifest, executions);
const requirementEvidence = buildRequirementEvidence(manifest, evidence, reviewArtifact.attestations, executions);
evidence = reconcileGroupEvidence(evidence, requirementEvidence);
const artifact = {
  schemaVersion: "1.0",
  implementation,
  nativeProjectionProfile: REFERENCE_NATIVE_PROFILE,
  sourceInventory,
  reviewEvidence: {
    path: REFERENCE_REVIEW_URI,
    sha256: sha256(readFileSync(REFERENCE_REVIEW_PATH)),
    reviewRecordId: reviewArtifact.reviewRecordId,
    implementationRevisionDigest: reviewArtifact.implementationRevisionDigest,
  },
  assessor: selected["--assessor"],
  assessmentDate: selected["--date"],
  executionEnvironment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    python: pythonVersion,
    nativeBuild: "suite-controlled-cmake",
  },
  nativeBuildAttestation,
  reproducibility,
  executions,
  evidence,
  reviews: reviewArtifact.attestations,
  requirementEvidence,
};
validateEvidenceArtifactCurrent(artifact, manifest);
await mkdir(dirname(REFERENCE_EVIDENCE_PATH), { recursive: true });
const artifactBytes = `${canonicalJson(artifact)}\n`;
const artifactDigest = sha256(Buffer.from(artifactBytes, "utf8"));
const retainedEvidencePath = resolve(dirname(REFERENCE_EVIDENCE_PATH), retainedEvidenceFilename(artifactDigest));
await assert.rejects(access(retainedEvidencePath), "content-addressed retained evidence already exists");
let retainedCreated = false;
try {
  await writeFile(retainedEvidencePath, artifactBytes, { encoding: "utf8", flag: "wx" });
  retainedCreated = true;
  await writeFile(REFERENCE_EVIDENCE_PATH, artifactBytes, { encoding: "utf8", flag: "wx" });
} catch (error) {
  if (retainedCreated) await rm(retainedEvidencePath, { force: true });
  throw error;
}
process.stdout.write(`PASS evidence ${REFERENCE_EVIDENCE_PATH}\nPASS immutable-evidence ${retainedEvidencePath}\n`);
