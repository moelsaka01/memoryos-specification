#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from "@vscode/test-electron";

import { buildHostRunner, HOST_RUNNER_BUNDLE } from "./build.mjs";

const TEST_HOST_ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TEST_HOST_ROOT, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "..", "..");
const RUNNER_EXTENSION_ROOT = resolve(TEST_HOST_ROOT, "runner-extension");
const EXACT_VSCODE_VERSION = "1.137.0";
const RECEIPT_KIND = "MemoryOSVSCodeHostTestReceipt";
const RECEIPT_VERSION = "1.0.0";
const RECEIPT_LIMIT = 256 * 1024;
const FACTS_LIMIT = 512 * 1024;
const PRIVATE_PREFIXES = Object.freeze([
  "memoryos-vscode-operation-",
  "memoryos-vscode-runtime-",
]);
const HOSTED_FIXTURES = resolve(
  WORKSPACE_ROOT,
  "repositories", "cca-conformance", "tests", "fixtures",
  "github-policy-gate", "1.0.0", "hosted",
);
const CANDIDATE_MIP = resolve(
  WORKSPACE_ROOT,
  "repositories", "cca-studio", "examples", "ai-runtime-adapters",
  "reference-packages", "openai-agents-reference.mip",
);
const POLICY_SET = resolve(
  WORKSPACE_ROOT,
  "repositories", "cca-studio", "tests", "fixtures", "investigation-policy",
  "1.0.0", "boundary-carriers", "0031-b11-exact-candidate.json",
);

function fail(message) {
  throw new Error(`MemoryOS Extension Host driver: ${message}`);
}

function parseArguments(argv) {
  const configuredCache = process.env.MEMORYOS_VSCODE_TEST_CACHE;
  const options = {
    allRequested: false,
    cachePath: configuredCache === undefined
      ? resolve(tmpdir(), "memoryos-vscode-test-cache")
      : resolve(configuredCache),
    modes: ["development", "restricted"],
    offline: false,
    receiptDir: resolve(PACKAGE_ROOT, "out", "host-results"),
    timeoutMs: 240_000,
    vscodeExecutablePath: undefined,
    vsixPath: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === "--offline") {
      options.offline = true;
    } else if (name === "--mode" && value !== undefined) {
      options.allRequested = value === "all";
      options.modes = options.allRequested
        ? ["development", "restricted", "installed"]
        : value.split(",");
      index += 1;
    } else if (name === "--receipt-dir" && value !== undefined) {
      options.receiptDir = resolve(value);
      index += 1;
    } else if (name === "--cache" && value !== undefined) {
      options.cachePath = resolve(value);
      index += 1;
    } else if (name === "--vscode-executable" && value !== undefined) {
      options.vscodeExecutablePath = resolve(value);
      index += 1;
    } else if (name === "--vsix" && value !== undefined) {
      options.vsixPath = resolve(value);
      index += 1;
    } else if (name === "--timeout-ms" && value !== undefined && /^[1-9][0-9]*$/u.test(value)) {
      options.timeoutMs = Number(value);
      index += 1;
    } else {
      fail(`unsupported or incomplete argument ${name ?? "<missing>"}.`);
    }
  }
  const allowed = new Set(["development", "installed", "restricted"]);
  if (options.modes.length === 0 || options.modes.some((mode) => !allowed.has(mode))) {
    fail("--mode must be development, installed, restricted, all, or a comma-separated subset.");
  }
  if (new Set(options.modes).size !== options.modes.length) fail("host modes must be unique.");
  if (options.modes.some((mode) => mode === "installed" || mode === "restricted")
      && options.vsixPath === undefined) {
    fail("installed, restricted, and all modes require --vsix <path>.");
  }
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs > 900_000) {
    fail("--timeout-ms must be a safe integer no greater than 900000.");
  }
  return options;
}

function downloadPlatform() {
  if (process.platform === "win32" && process.arch === "x64") return "win32-x64-archive";
  if (process.platform === "win32" && process.arch === "arm64") return "win32-arm64-archive";
  if (process.platform === "darwin" && process.arch === "x64") return "darwin";
  if (process.platform === "darwin" && process.arch === "arm64") return "darwin-arm64";
  if (process.platform === "linux" && process.arch === "x64") return "linux-x64";
  if (process.platform === "linux" && process.arch === "arm64") return "linux-arm64";
  fail(`unsupported host platform ${process.platform}/${process.arch}.`);
}

async function requireAcquiredHost(cachePath) {
  const complete = resolve(cachePath, `vscode-${downloadPlatform()}-${EXACT_VSCODE_VERSION}`, "is-complete");
  try {
    await access(complete);
  } catch {
    fail(`--offline requires the acquired host marker ${complete}; run test-host/acquire.mjs first.`);
  }
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

async function privateRoots() {
  return new Set((await readdir(tmpdir()))
    .filter((name) => PRIVATE_PREFIXES.some((prefix) => name.startsWith(prefix))));
}

async function stageWorkspace(target) {
  await mkdir(target, { recursive: true });
  await Promise.all([
    copyFile(CANDIDATE_MIP, join(target, "candidate.mip")),
    copyFile(POLICY_SET, join(target, "policy-set.json")),
    ...["pass", "fail", "cne"].map((scenario) => copyFile(
      join(HOSTED_FIXTURES, `${scenario}.memoryos-policy.json`),
      join(target, `${scenario}.memoryos-policy.json`),
    )),
  ]);
}

async function writeProfileSettings(userDataPath) {
  const userRoot = join(userDataPath, "User");
  await mkdir(userRoot, { recursive: true });
  const settings = {
    "extensions.autoCheckUpdates": false,
    "extensions.autoUpdate": false,
    "security.workspace.trust.banner": "never",
    "security.workspace.trust.enabled": true,
    "security.workspace.trust.startupPrompt": "never",
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
  };
  await writeFile(join(userRoot, "settings.json"), `${canonicalJson(settings)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
}

function runProcess(command, args, environment, timeoutMs, { shell = false } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      env: environment,
      shell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    let timedOut = false;
    let errorSeen = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.once("error", (error) => {
      errorSeen = true;
      clearTimeout(timer);
      rejectRun(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (errorSeen) return;
      if (timedOut) {
        rejectRun(new Error(`Process exceeded ${timeoutMs} ms: ${command}.`));
      } else if (code !== 0) {
        rejectRun(new Error(`Process exited with code ${code} and signal ${signal ?? "none"}: ${command}.`));
      } else {
        resolveRun();
      }
    });
  });
}

async function installVsix(options, vscodeExecutablePath, userDataPath, extensionsPath) {
  const [cli, ...cliPrefix] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath, {
    reuseMachineInstall: true,
  });
  await runProcess(
    process.platform === "win32" ? `"${cli}"` : cli,
    [
      ...cliPrefix,
      `--user-data-dir=${userDataPath}`,
      `--extensions-dir=${extensionsPath}`,
      "--install-extension",
      options.vsixPath,
      "--force",
    ],
    process.env,
    60_000,
    { shell: process.platform === "win32" && cli.endsWith(".cmd") },
  );
}

async function assertShutdownCleanup(rootsBefore) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rootsAfter = await privateRoots();
    const added = [...rootsAfter].filter((name) => !rootsBefore.has(name));
    if (added.length === 0) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  const rootsAfter = await privateRoots();
  const added = [...rootsAfter].filter((name) => !rootsBefore.has(name));
  fail(`private runtime state survived host shutdown: ${added.join(", ")}.`);
}

function comparablePath(path) {
  const absolute = resolve(path);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

async function finalizeReceipt(receiptPath, mode, extensionsPath) {
  const bytes = await readFile(receiptPath);
  if (bytes.byteLength > RECEIPT_LIMIT) fail(`${mode} receipt exceeds ${RECEIPT_LIMIT} bytes.`);
  const receipt = JSON.parse(bytes.toString("utf8"));
  if (receipt.kind !== RECEIPT_KIND || receipt.version !== RECEIPT_VERSION || receipt.mode !== mode) {
    fail(`${mode} receipt identity is invalid.`);
  }
  const observedExtensionPath = resolve(receipt.extension?.path ?? "");
  const developmentSource = mode === "development";
  let installedFromVsix = false;
  if (developmentSource) {
    if (comparablePath(observedExtensionPath) !== comparablePath(PACKAGE_ROOT)) {
      fail(`${mode} extension path does not resolve exactly to the development package root.`);
    }
  } else {
    const relativeInstalledPath = relative(resolve(extensionsPath), observedExtensionPath);
    if (relativeInstalledPath === ""
        || relativeInstalledPath === ".."
        || relativeInstalledPath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
        || isAbsolute(relativeInstalledPath)
        || comparablePath(observedExtensionPath) === comparablePath(PACKAGE_ROOT)) {
      fail("installed extension path is not strictly inside the isolated extensions directory.");
    }
    const installedManifest = JSON.parse(await readFile(join(observedExtensionPath, "package.json"), "utf8"));
    if (`${installedManifest.publisher}.${installedManifest.name}` !== receipt.extension.id
        || installedManifest.version !== receipt.extension.version) {
      fail("installed extension manifest identity differs from the activated extension.");
    }
    installedFromVsix = true;
  }
  receipt.assertions = {
    ...receipt.assertions,
    ...(developmentSource ? { developmentSource } : { installedFromVsix }),
    isolatedDirectories: true,
    shutdownCleanup: true,
  };
  const canonical = Buffer.from(`${canonicalJson(receipt)}\n`, "utf8");
  if (canonical.byteLength > RECEIPT_LIMIT) fail(`${mode} finalized receipt exceeds its bound.`);
  await writeFile(receiptPath, canonical, { flag: "w", mode: 0o600 });
  return receipt;
}

async function runMode(options, mode, vscodeExecutablePath) {
  const stateRoot = await mkdtemp(join(tmpdir(), `memoryos-vscode-host-${mode}-`));
  const userDataPath = join(stateRoot, "user-data");
  const extensionsPath = join(stateRoot, "extensions");
  const workspacePath = join(stateRoot, "workspace");
  const receiptPath = resolve(options.receiptDir, `${mode}.json`);
  const rootsBefore = await privateRoots();
  try {
    await Promise.all([
      mkdir(extensionsPath, { recursive: true }),
      mkdir(options.receiptDir, { recursive: true }),
      stageWorkspace(workspacePath),
      writeProfileSettings(userDataPath),
    ]);
    await rm(receiptPath, { force: true });
    if (mode === "installed" || mode === "restricted") {
      await installVsix(options, vscodeExecutablePath, userDataPath, extensionsPath);
    }
    const developmentPaths = mode === "development"
      ? [PACKAGE_ROOT, RUNNER_EXTENSION_ROOT]
      : [RUNNER_EXTENSION_ROOT];
    const args = [
      workspacePath,
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--disable-updates",
      "--disable-extension-updates",
      "--skip-welcome",
      "--skip-release-notes",
      "--no-cached-data",
      "--proxy-server=http://127.0.0.1:9",
      "--host-rules=MAP * 0.0.0.0, EXCLUDE localhost",
      `--user-data-dir=${userDataPath}`,
      `--extensions-dir=${extensionsPath}`,
      `--extensionTestsPath=${HOST_RUNNER_BUNDLE}`,
      ...developmentPaths.map((path) => `--extensionDevelopmentPath=${path}`),
      ...(mode === "restricted" ? [] : ["--disable-workspace-trust"]),
    ];
    const offlineEnvironment = {
      ...process.env,
      ALL_PROXY: "http://127.0.0.1:9",
      HTTP_PROXY: "http://127.0.0.1:9",
      HTTPS_PROXY: "http://127.0.0.1:9",
      MEMORYOS_HOST_TEST_MODE: mode,
      MEMORYOS_HOST_TEST_OFFLINE: "1",
      MEMORYOS_HOST_TEST_RECEIPT: receiptPath,
      MEMORYOS_HOST_TEST_WORKSPACE: workspacePath,
      NO_PROXY: "",
      VSCODE_DISABLE_CRASH_REPORTER: "1",
    };
    await runProcess(vscodeExecutablePath, args, offlineEnvironment, options.timeoutMs);
    await assertShutdownCleanup(rootsBefore);
    const receipt = await finalizeReceipt(receiptPath, mode, extensionsPath);
    process.stdout.write(`Validated ${mode} receipt for VS Code ${receipt.vscodeVersion}.\n`);
    return receipt;
  } finally {
    await rm(stateRoot, { force: true, recursive: true });
  }
}

function requireParity(left, right, label) {
  if (canonicalJson(left) !== canonicalJson(right)) fail(`${label} differs between development and installed hosts.`);
}

function vectorMap(receipt) {
  if (!Array.isArray(receipt.evaluations) || receipt.evaluations.length !== 3) {
    fail(`${receipt.mode} receipt does not contain exactly three evaluation vectors.`);
  }
  const vectors = Object.fromEntries(receipt.evaluations.map((value) => [value.scenario, value]));
  if (Object.keys(vectors).sort().join(",") !== "cne,fail,pass") {
    fail(`${receipt.mode} receipt has an unexpected evaluation inventory.`);
  }
  return vectors;
}

function hostedVerification(value) {
  if (value === null || typeof value !== "object" || typeof value.canonicalText !== "string") {
    fail("trusted verification receipt is incomplete.");
  }
  return {
    canonicalBase64: Buffer.from(value.canonicalText, "utf8").toString("base64"),
    ...(value.decision === undefined ? {} : { decision: value.decision }),
    evaluationIdentityDigest: value.evaluationIdentityDigest,
    mode: value.mode,
    ...(value.outcomeDigest === undefined ? {} : { outcomeDigest: value.outcomeDigest }),
    sourceFilename: value.sourceFilename,
    state: value.state,
    target: value.target,
    verificationScope: value.verificationScope,
    virtualDocumentExactBytes: value.virtualDocumentExactBytes,
  };
}

async function composeHostedFacts(receipts, receiptDir) {
  const development = receipts.development;
  const installed = receipts.installed;
  const restricted = receipts.restricted;
  if (development === undefined || installed === undefined || restricted === undefined) {
    fail("all-mode hosted facts require development, restricted, and installed receipts.");
  }
  if (development.offline?.result !== "PASS"
      || installed.offline?.result !== "PASS"
      || restricted.offline?.result !== "PASS") {
    fail("all-mode hosted facts require offline PASS from every host suite.");
  }
  requireParity(development.commandIds, installed.commandIds, "public command inventory");
  requireParity(development.contractIdentities, installed.contractIdentities, "contract identities");
  requireParity(development.preparation, installed.preparation, "preparation results");
  requireParity(development.verification, installed.verification, "verification command results");
  if (restricted.verification !== null
      || development.assertions?.verificationCommands !== true
      || development.assertions?.verificationVirtualDocuments !== true
      || installed.assertions?.verificationCommands !== true
      || installed.assertions?.verificationVirtualDocuments !== true) {
    fail("verification command coverage assertions are incomplete.");
  }
  const developmentVectors = vectorMap(development);
  const installedVectors = vectorMap(installed);
  requireParity(developmentVectors, installedVectors, "semantic vectors");
  const vectors = Object.fromEntries(["pass", "fail", "cne"].map((scenario) => {
    const value = installedVectors[scenario];
    return [scenario, {
      decision: value.decision,
      evaluationIdentityCanonicalBase64: Buffer.from(
        value.evaluationIdentityCanonicalText,
        "utf8",
      ).toString("base64"),
      evaluationIdentityDigest: value.evaluationIdentityDigest,
      outcomeCanonicalBase64: Buffer.from(value.outcomeCanonicalText, "utf8").toString("base64"),
      outcomeDigest: value.outcomeDigest,
      stableCodes: value.stableCodes,
    }];
  }));
  const facts = {
    contractIdentities: installed.contractIdentities,
    extension: { identifier: installed.extension.id, version: installed.extension.version },
    offline: { networkRequired: false, result: "PASS" },
    preparation: installed.preparation,
    verification: {
      evaluationIdentity: hostedVerification(installed.verification.evaluationIdentity),
      policyOutcome: hostedVerification(installed.verification.policyOutcome),
    },
    vectors,
  };
  const bytes = Buffer.from(`${canonicalJson(facts)}\n`, "utf8");
  if (bytes.byteLength > FACTS_LIMIT) fail(`hosted facts exceed ${FACTS_LIMIT} bytes.`);
  const factsPath = resolve(receiptDir, "hosted-facts.json");
  await rm(factsPath, { force: true });
  await writeFile(factsPath, bytes, { flag: "wx", mode: 0o600 });
  process.stdout.write(`Created ${factsPath}.\n`);
}

const options = parseArguments(process.argv.slice(2));
await buildHostRunner();
if (options.offline && options.vscodeExecutablePath === undefined) {
  await requireAcquiredHost(options.cachePath);
}
const vscodeExecutablePath = options.vscodeExecutablePath ?? await downloadAndUnzipVSCode({
  cachePath: options.cachePath,
  timeout: 30_000,
  version: EXACT_VSCODE_VERSION,
});
if (!isAbsolute(vscodeExecutablePath)) fail("VS Code executable path is not absolute.");
const receipts = {};
for (const mode of options.modes) {
  receipts[mode] = await runMode(options, mode, vscodeExecutablePath);
}
if (options.allRequested) await composeHostedFacts(receipts, options.receiptDir);
