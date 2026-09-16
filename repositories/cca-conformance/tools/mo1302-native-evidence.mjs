#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const NATIVE_POLICY_TEST_REGEX =
  "^memoryos\\.sdk\\.cpp\\.(policy\\.contract|policy\\.example)$";

export const EXPECTED_NATIVE_POLICY_TESTS = Object.freeze([
  "memoryos.sdk.cpp.policy.contract",
  "memoryos.sdk.cpp.policy.example",
]);

const POLICY_GTEST_FILTER = [
  "MemoryOsSdk.ExposesVersionedImmutableValueHandles",
  "MemoryOsSdk.DelegatesPolicySemanticsAndRetainsExactBytes",
  "MemoryOsSdk.EnforcesObservationWorkspaceAuthorityAcrossTheBridge",
  "MemoryOsSdk.EvaluatesPolicySetAndCneAsNormalOutcomes",
  "MemoryOsSdk.PreservesMetadataIsolationAndExactCachedBytes",
  "MemoryOsSdk.EvaluatesAnAuthoritativeMipBackedContext",
  "MemoryOsSdk.CapturesAndVerifiesTrustedRegressionPolicyFacts",
  "MemoryOsSdk.VerifiesAllFrozenPolicyEvaluationArtifactsExactly",
  "MemoryOsSdk.PreservesStablePolicyErrorsAcrossTheBridge",
].join(":");

const EXPECTED_LABELS = Object.freeze({
  "memoryos.sdk.cpp.policy.contract": Object.freeze([
    "contract",
    "cpp",
    "memoryos",
    "policy",
    "sdk",
  ]),
  "memoryos.sdk.cpp.policy.example": Object.freeze([
    "cpp",
    "example",
    "memoryos",
    "sdk",
  ]),
});

const RUNNER_OPERATING_SYSTEMS = Object.freeze({
  "macos-14": "macOS",
  "ubuntu-24.04": "Linux",
  "windows-2022": "Windows",
});

const NODE_PLATFORM_BY_RUNNER_OS = Object.freeze({
  Linux: "linux",
  macOS: "darwin",
  Windows: "win32",
});

const NODE_ARCHITECTURE_BY_RUNNER_ARCH = Object.freeze({
  ARM: "arm",
  ARM64: "arm64",
  X64: "x64",
  X86: "ia32",
});

const REGISTRATION_KIND = "MemoryOSMO1302NativePolicyRegistration";
const EVIDENCE_KIND = "MemoryOSMO1302NativePolicyEvidence";
const CONTRACT_VERSION = "1.0.0";
const MAX_REGISTRATION_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_REGISTRATION_BYTES = 2048;
const MAX_JUNIT_BYTES = 2 * 1024 * 1024;
const MAX_COMPILER_FILE_BYTES = 256 * 1024;
const MAX_EVIDENCE_BYTES = 8192;
const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function fail(message) {
  throw new Error(`MO-1302 native evidence: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(requireRecord(value, label)).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} members must be exactly ${wanted.join(", ")}`);
  }
}

function requireString(value, label, expression, maximum = 256) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    fail(`${label} must be a non-empty string of at most ${maximum} characters`);
  }
  if (expression && !expression.test(value)) fail(`${label} has an invalid value`);
  return value;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(`${label} is not valid JSON`);
  }
}

function portableBasename(value) {
  return value.replaceAll("\\", "/").split("/").at(-1);
}

function cmakeTruthy(value) {
  if (value === true || value === 1) return true;
  return typeof value === "string" && /^(?:1|ON|TRUE|YES)$/iu.test(value);
}

function propertyValue(test, name) {
  if (!Array.isArray(test.properties)) return undefined;
  const matches = test.properties.filter((property) =>
    isRecord(property) && property.name === name
  );
  if (matches.length > 1) fail(`${test.name} repeats the ${name} property`);
  return matches[0]?.value;
}

function validateTestCommand(test) {
  if (!Array.isArray(test.command) || test.command.some((member) => typeof member !== "string")) {
    fail(`${test.name} command must be a string array`);
  }
  if (test.name === "memoryos.sdk.cpp.policy.contract") {
    if (test.command.length !== 2 ||
        !/^memoryos_sdk_cpp_tests(?:\.exe)?$/iu.test(portableBasename(test.command[0])) ||
        test.command[1] !== `--gtest_filter=${POLICY_GTEST_FILTER}`) {
      fail("the native Policy contract registration has an unexpected command");
    }
    return;
  }
  if (test.command.length !== 1 ||
      !/^memoryos_sdk_cpp_policy(?:\.exe)?$/iu.test(portableBasename(test.command[0]))) {
    fail("the native Policy example registration has an unexpected command");
  }
}

export function validateRegistrationDocument(document) {
  requireRecord(document, "CTest registration document");
  if (document.kind !== "ctestInfo" ||
      !isRecord(document.version) ||
      document.version.major !== 1 ||
      document.version.minor !== 0) {
    fail("CTest registration must use ctestInfo JSON version 1.0");
  }
  if (!Array.isArray(document.tests) || document.tests.length === 0 || document.tests.length > 10000) {
    fail("CTest registration must contain a bounded non-empty tests array");
  }

  const byName = new Map();
  for (const candidate of document.tests) {
    const test = requireRecord(candidate, "CTest test");
    const name = requireString(test.name, "CTest test name", /^[A-Za-z0-9_.-]+$/u);
    if (byName.has(name)) fail(`CTest registration repeats ${name}`);
    byName.set(name, test);
  }

  for (const name of EXPECTED_NATIVE_POLICY_TESTS) {
    const test = byName.get(name);
    if (!test) fail(`CTest registration is missing ${name}`);
    if (cmakeTruthy(propertyValue(test, "DISABLED"))) fail(`${name} is disabled`);
    const labels = propertyValue(test, "LABELS");
    if (!Array.isArray(labels) || labels.some((label) => typeof label !== "string")) {
      fail(`${name} must have an explicit LABELS property`);
    }
    const actualLabels = [...labels].sort();
    const expectedLabels = EXPECTED_LABELS[name];
    if (actualLabels.length !== expectedLabels.length ||
        actualLabels.some((label, index) => label !== expectedLabels[index])) {
      fail(`${name} has unexpected labels`);
    }
    validateTestCommand(test);
  }

  const selected = [...byName.keys()]
    .filter((name) => new RegExp(NATIVE_POLICY_TEST_REGEX, "u").test(name))
    .sort();
  const expectedSelected = [...EXPECTED_NATIVE_POLICY_TESTS].sort();
  if (selected.length !== expectedSelected.length ||
      selected.some((name, index) => name !== expectedSelected[index])) {
    fail("the focused native Policy regex does not select exactly the two required tests");
  }

  return {
    kind: REGISTRATION_KIND,
    version: CONTRACT_VERSION,
    selectedTestRegex: NATIVE_POLICY_TEST_REGEX,
    registeredTests: [...EXPECTED_NATIVE_POLICY_TESTS],
  };
}

export function validateRegistrationEvidence(registration) {
  requireExactKeys(
    registration,
    ["kind", "registeredTests", "selectedTestRegex", "version"],
    "registration evidence",
  );
  if (registration.kind !== REGISTRATION_KIND || registration.version !== CONTRACT_VERSION ||
      registration.selectedTestRegex !== NATIVE_POLICY_TEST_REGEX) {
    fail("registration evidence identity is unsupported");
  }
  if (!Array.isArray(registration.registeredTests) ||
      registration.registeredTests.length !== EXPECTED_NATIVE_POLICY_TESTS.length ||
      registration.registeredTests.some(
        (name, index) => name !== EXPECTED_NATIVE_POLICY_TESTS[index],
      )) {
    fail("registration evidence does not contain the exact required tests");
  }
  if (Buffer.byteLength(JSON.stringify(registration), "utf8") > MAX_REGISTRATION_BYTES) {
    fail("registration evidence exceeds its bounded size");
  }
  return registration;
}

function decodeXml(value) {
  if (/&(?!(?:#x[0-9A-Fa-f]+|#[0-9]+|amp|apos|gt|lt|quot);)/u.test(value)) {
    fail("JUnit XML contains an unsupported entity");
  }
  return value.replace(
    /&(#x[0-9A-Fa-f]+|#[0-9]+|amp|apos|gt|lt|quot);/gu,
    (_, entity) => {
      if (entity === "amp") return "&";
      if (entity === "apos") return "'";
      if (entity === "gt") return ">";
      if (entity === "lt") return "<";
      if (entity === "quot") return "\"";
      const codePoint = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        fail("JUnit XML contains an invalid character reference");
      }
      return String.fromCodePoint(codePoint);
    },
  );
}

function xmlAttributes(source, label) {
  const attributes = {};
  const expression = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/gu;
  for (const match of source.matchAll(expression)) {
    if (Object.hasOwn(attributes, match[1])) fail(`${label} repeats ${match[1]}`);
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function nonNegativeIntegerAttribute(attributes, name, label, required = true) {
  const value = attributes[name];
  if (value === undefined && !required) return 0;
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    fail(`${label} ${name} must be a non-negative integer`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(`${label} ${name} exceeds the safe range`);
  return number;
}

export function validateCTestJUnit(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_JUNIT_BYTES) {
    fail("CTest JUnit output exceeds its bounded size");
  }
  if (/<!DOCTYPE|<!ENTITY/iu.test(text)) fail("CTest JUnit output may not declare entities");
  const suiteMatch = /<testsuite\b([^>]*)>/u.exec(text);
  if (!suiteMatch) fail("CTest JUnit output has no testsuite");
  const suite = xmlAttributes(suiteMatch[1], "CTest testsuite");
  if (nonNegativeIntegerAttribute(suite, "tests", "CTest testsuite") !== 2 ||
      nonNegativeIntegerAttribute(suite, "failures", "CTest testsuite") !== 0 ||
      nonNegativeIntegerAttribute(suite, "errors", "CTest testsuite", false) !== 0 ||
      nonNegativeIntegerAttribute(suite, "disabled", "CTest testsuite", false) !== 0 ||
      nonNegativeIntegerAttribute(suite, "skipped", "CTest testsuite", false) !== 0) {
    fail("CTest JUnit output must report exactly two passing tests with no skips");
  }

  const results = new Map();
  const expression = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gu;
  for (const match of text.matchAll(expression)) {
    const attributes = xmlAttributes(match[1], "CTest testcase");
    const name = requireString(
      attributes.name,
      "CTest testcase name",
      /^[A-Za-z0-9_.-]+$/u,
    );
    if (results.has(name)) fail(`CTest JUnit output repeats ${name}`);
    const body = match[2] ?? "";
    if (/<(?:failure|error|skipped)\b/iu.test(body) ||
        (attributes.status !== undefined && attributes.status !== "run")) {
      fail(`${name} did not complete with PASS`);
    }
    results.set(name, "PASS");
  }
  if (results.size !== EXPECTED_NATIVE_POLICY_TESTS.length ||
      EXPECTED_NATIVE_POLICY_TESTS.some((name) => results.get(name) !== "PASS")) {
    fail("CTest JUnit output does not contain exactly the two required passing tests");
  }
  return EXPECTED_NATIVE_POLICY_TESTS.map((name) => ({ name, result: "PASS" }));
}

async function readBounded(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > maximum) fail(`${label} is not a bounded regular file`);
  return readFile(path, "utf8");
}

async function readStandardInput() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_REGISTRATION_INPUT_BYTES) fail("CTest registration input is too large");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function compilerIdentity(buildDirectory) {
  const cmakeFiles = resolve(buildDirectory, "CMakeFiles");
  const entries = await readdir(cmakeFiles, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = resolve(cmakeFiles, entry.name, "CMakeCXXCompiler.cmake");
    try {
      const metadata = await stat(candidate);
      if (metadata.isFile()) candidates.push(candidate);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (candidates.length !== 1) fail("the CMake build must expose exactly one C++ compiler description");
  const source = await readBounded(candidates[0], MAX_COMPILER_FILE_BYTES, "C++ compiler description");
  const identifier = /set\(CMAKE_CXX_COMPILER_ID "([^"]+)"\)/u.exec(source)?.[1];
  const version = /set\(CMAKE_CXX_COMPILER_VERSION "([^"]+)"\)/u.exec(source)?.[1];
  return {
    identifier: requireString(identifier, "compiler identifier", /^[A-Za-z0-9_.+-]+$/u, 64),
    version: requireString(version, "compiler version", /^[A-Za-z0-9_.+-]+$/u, 64),
  };
}

function runnerIdentity(environment = process.env) {
  const label = requireString(
    environment.MEMORYOS_NATIVE_RUNNER_LABEL,
    "runner label",
    /^(?:ubuntu-24[.]04|windows-2022|macos-14)$/u,
    32,
  );
  const operatingSystem = requireString(
    environment.MEMORYOS_NATIVE_RUNNER_OS,
    "runner operating system",
    /^(?:Linux|Windows|macOS)$/u,
    16,
  );
  const architecture = requireString(
    environment.MEMORYOS_NATIVE_RUNNER_ARCH,
    "runner architecture",
    /^(?:ARM|ARM64|X64|X86)$/u,
    8,
  );
  if (RUNNER_OPERATING_SYSTEMS[label] !== operatingSystem) {
    fail("runner label and operating system do not agree");
  }
  if (NODE_PLATFORM_BY_RUNNER_OS[operatingSystem] !== process.platform ||
      NODE_ARCHITECTURE_BY_RUNNER_ARCH[architecture] !== process.arch) {
    fail("runner metadata does not agree with the executing platform");
  }
  return { label, operatingSystem, architecture };
}

function workspaceCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || result.stderr !== "") {
    fail("the checked-out commit could not be read exactly");
  }
  const lines = result.stdout.trim().split(/\r?\n/u);
  if (lines.length !== 1 || !/^[0-9a-f]{40}$/u.test(lines[0])) {
    fail("the checked-out commit is not a full Git object identifier");
  }
  return lines[0];
}

function installedFilesFor(operatingSystem) {
  const library = operatingSystem === "Windows"
    ? "lib/memoryos-sdk.lib"
    : "lib/libmemoryos-sdk.a";
  return [
    "include/memoryos/memoryos.hpp",
    library,
    "share/cca-studio/web/js/investigation-policy-engine.js",
    "share/memoryos-sdk/bridge/investigation-core-host.mjs",
  ];
}

async function verifyInstall(prefix, operatingSystem) {
  const files = installedFilesFor(operatingSystem);
  for (const relativePath of files) {
    const metadata = await stat(resolve(prefix, ...relativePath.split("/")));
    if (!metadata.isFile()) fail(`installed file is not regular: ${relativePath}`);
  }
  return files;
}

export function validateNativeEvidence(evidence) {
  requireExactKeys(
    evidence,
    [
      "authority",
      "commit",
      "compiler",
      "install",
      "kind",
      "registeredTests",
      "runner",
      "testResults",
      "version",
    ],
    "native evidence",
  );
  if (evidence.kind !== EVIDENCE_KIND || evidence.version !== CONTRACT_VERSION ||
      evidence.authority !== "nonNormativeEngineeringEvidence") {
    fail("native evidence identity is unsupported");
  }
  requireString(evidence.commit, "evidence commit", /^[0-9a-f]{40}$/u, 40);

  requireExactKeys(evidence.runner, ["architecture", "label", "operatingSystem"], "runner");
  const label = requireString(
    evidence.runner.label,
    "runner label",
    /^(?:ubuntu-24[.]04|windows-2022|macos-14)$/u,
    32,
  );
  const operatingSystem = requireString(
    evidence.runner.operatingSystem,
    "runner operating system",
    /^(?:Linux|Windows|macOS)$/u,
    16,
  );
  requireString(
    evidence.runner.architecture,
    "runner architecture",
    /^(?:ARM|ARM64|X64|X86)$/u,
    8,
  );
  if (RUNNER_OPERATING_SYSTEMS[label] !== operatingSystem) {
    fail("evidence runner label and operating system do not agree");
  }

  requireExactKeys(evidence.compiler, ["identifier", "version"], "compiler");
  requireString(evidence.compiler.identifier, "compiler identifier", /^[A-Za-z0-9_.+-]+$/u, 64);
  requireString(evidence.compiler.version, "compiler version", /^[A-Za-z0-9_.+-]+$/u, 64);

  if (!Array.isArray(evidence.registeredTests) ||
      evidence.registeredTests.length !== EXPECTED_NATIVE_POLICY_TESTS.length ||
      evidence.registeredTests.some(
        (name, index) => name !== EXPECTED_NATIVE_POLICY_TESTS[index],
      )) {
    fail("native evidence does not retain the exact registration inventory");
  }
  if (!Array.isArray(evidence.testResults) ||
      evidence.testResults.length !== EXPECTED_NATIVE_POLICY_TESTS.length) {
    fail("native evidence must contain exactly two test results");
  }
  evidence.testResults.forEach((result, index) => {
    requireExactKeys(result, ["name", "result"], `test result ${index}`);
    if (result.name !== EXPECTED_NATIVE_POLICY_TESTS[index] || result.result !== "PASS") {
      fail("native evidence contains a non-passing or unexpected test result");
    }
  });

  requireExactKeys(evidence.install, ["installedFiles", "result"], "install result");
  if (evidence.install.result !== "PASS") fail("native evidence install did not pass");
  const expectedFiles = installedFilesFor(operatingSystem);
  if (!Array.isArray(evidence.install.installedFiles) ||
      evidence.install.installedFiles.length !== expectedFiles.length ||
      evidence.install.installedFiles.some((path, index) => path !== expectedFiles[index])) {
    fail("native evidence install inventory is incomplete");
  }

  if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > MAX_EVIDENCE_BYTES) {
    fail("native evidence exceeds its bounded size");
  }
  return evidence;
}

export function createNativeEvidence({
  commit,
  compiler,
  installedFiles,
  registration,
  runner,
  testResults,
}) {
  validateRegistrationEvidence(registration);
  return validateNativeEvidence({
    kind: EVIDENCE_KIND,
    version: CONTRACT_VERSION,
    authority: "nonNormativeEngineeringEvidence",
    commit,
    runner,
    compiler,
    registeredTests: [...registration.registeredTests],
    testResults,
    install: { result: "PASS", installedFiles },
  });
}

function parseOptions(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (!/^--[a-z-]+$/u.test(name ?? "") || value === undefined || value.startsWith("--")) {
      fail("command options must be --name value pairs");
    }
    const key = name.slice(2);
    if (Object.hasOwn(options, key)) fail(`command option is repeated: ${name}`);
    options[key] = value;
  }
  return options;
}

function requireOptions(options, expected) {
  requireExactKeys(options, expected, "command options");
  return options;
}

async function writeJson(path, value, maximum) {
  const bytes = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(bytes, "utf8") > maximum) fail("generated JSON exceeds its bounded size");
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, bytes, { encoding: "utf8" });
}

async function runRegistration(options) {
  requireOptions(options, ["output"]);
  const source = await readStandardInput();
  const registration = validateRegistrationDocument(parseJson(source, "CTest registration"));
  await writeJson(options.output, registration, MAX_REGISTRATION_BYTES);
  process.stdout.write(`Validated ${registration.registeredTests.length} native Policy registrations.\n`);
}

async function runEvidence(options) {
  requireOptions(options, ["build-dir", "install-prefix", "junit", "output", "registration"]);
  const registration = validateRegistrationEvidence(parseJson(
    await readBounded(options.registration, MAX_REGISTRATION_BYTES, "registration evidence"),
    "registration evidence",
  ));
  const testResults = validateCTestJUnit(
    await readBounded(options.junit, MAX_JUNIT_BYTES, "CTest JUnit output"),
  );
  const runner = runnerIdentity();
  const compiler = await compilerIdentity(resolve(options["build-dir"]));
  const installedFiles = await verifyInstall(resolve(options["install-prefix"]), runner.operatingSystem);
  const evidence = createNativeEvidence({
    commit: workspaceCommit(),
    compiler,
    installedFiles,
    registration,
    runner,
    testResults,
  });
  await writeJson(options.output, evidence, MAX_EVIDENCE_BYTES);
  process.stdout.write(`Created bounded native evidence for ${runner.label}.\n`);
}

async function runValidation(options) {
  requireOptions(options, ["input"]);
  validateNativeEvidence(parseJson(
    await readBounded(options.input, MAX_EVIDENCE_BYTES, "native evidence"),
    "native evidence",
  ));
  process.stdout.write("Native Policy evidence is valid.\n");
}

async function main(arguments_) {
  const [mode, ...rest] = arguments_;
  const options = parseOptions(rest);
  if (mode === "registration") return runRegistration(options);
  if (mode === "evidence") return runEvidence(options);
  if (mode === "validate") return runValidation(options);
  fail("mode must be registration, evidence, or validate");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
