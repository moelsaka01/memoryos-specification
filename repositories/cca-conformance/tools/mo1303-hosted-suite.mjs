import { createHash, randomBytes } from "node:crypto";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { access, link, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RECEIPT_KIND = "MemoryOSMO1303HostedSuiteReceipt";
export const RECEIPT_VERSION = "1.0.0";
export const MAX_RECEIPT_BYTES = 64 * 1024;

const REVISION = /^[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(TOOL_DIRECTORY, "../../..");
const execFile = promisify(execFileCallback);

function command(cwd, ...argv) {
  return Object.freeze({ cwd, argv: Object.freeze(argv) });
}

function suite(...commands) {
  return Object.freeze(commands);
}

export const SUITE_COMMANDS = Object.freeze({
  npmCi: suite(command("repositories/memoryos-vscode", "npm", "ci", "--ignore-scripts")),
  typecheck: suite(command("repositories/memoryos-vscode", "npm", "run", "typecheck")),
  productionBuild: suite(command("repositories/memoryos-vscode", "npm", "run", "build")),
  mockTests: suite(command("repositories/memoryos-vscode", "npm", "test")),
  phase1Conformance: suite(command("repositories/cca-conformance", "npm", "run", "test:mo1303-phase1")),
  phase2Conformance: suite(command("repositories/cca-conformance", "npm", "run", "test:mo1303-phase2")),
  phase3Conformance: suite(command("repositories/cca-conformance", "npm", "run", "test:mo1303-phase3")),
  packageValidation: suite(
    command("repositories/memoryos-vscode", "npm", "run", "package:vsix"),
    command("repositories/memoryos-vscode", "npm", "run", "verify:vsix"),
    command("repositories/memoryos-vscode", "npm", "run", "test:package"),
  ),
  mo1301Regression: suite(command("repositories/cca-conformance", "npm", "run", "test:mo1301")),
  mo1302Phase1Regression: suite(command("repositories/cca-conformance", "npm", "run", "test:mo1302-phase1")),
  mo1302Phase2Regression: suite(command("repositories/cca-conformance", "npm", "run", "test:mo1302-phase2")),
  mo1302Phase3Regression: suite(command("repositories/cca-conformance", "npm", "run", "test:mo1302-phase3")),
  policyPhase1Regression: suite(command("repositories/cca-studio", "npm", "run", "test:policy-phase1")),
  policyPhase2Regression: suite(command("repositories/cca-studio", "npm", "run", "test:policy-phase2")),
  policyPhase3Regression: suite(command("repositories/cca-studio", "npm", "run", "test:policy-phase3")),
  policyPhase4Regression: suite(command("repositories/cca-studio", "npm", "run", "test:policy-phase4")),
  cliRegression: suite(command("repositories/memoryos-cli", "npm", "test")),
  workspaceVerification: suite(command(".", "python", "tools/verify_workspace.py", "--root", ".")),
});

export const SUITE_NAMES = Object.freeze(Object.keys(SUITE_COMMANDS));

function fail(message) {
  throw new Error(`MO-1303 hosted suite: ${message}`);
}

function invariant(condition, message) {
  if (!condition) fail(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  invariant(isObject(value), `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(wanted), `${label} has an open or incomplete key set.`);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  invariant(encoded !== undefined, "canonical JSON contains an unsupported value.");
  return encoded;
}

export function validateSuiteName(name) {
  invariant(typeof name === "string" && Object.hasOwn(SUITE_COMMANDS, name), `unsupported suite ${JSON.stringify(name)}.`);
  return name;
}

function validateCommand(value, label) {
  exactKeys(value, ["cwd", "argv"], label);
  invariant(typeof value.cwd === "string" && value.cwd.length > 0, `${label}.cwd must be a non-empty string.`);
  invariant(!value.cwd.includes("\\"), `${label}.cwd must use POSIX separators.`);
  invariant(Array.isArray(value.argv) && value.argv.length > 0, `${label}.argv must be a non-empty array.`);
  for (const member of value.argv) {
    invariant(typeof member === "string" && member.length > 0, `${label}.argv contains an invalid member.`);
  }
}

export function validateCommands(value, label = "commands") {
  invariant(Array.isArray(value) && value.length > 0, `${label} must be a non-empty array.`);
  value.forEach((entry, index) => validateCommand(entry, `${label}[${index}]`));
  return value;
}

export function commandIdentityDigest(commands) {
  validateCommands(commands);
  return `sha256:${createHash("sha256").update(canonicalJson(commands), "utf8").digest("hex")}`;
}

export function validateSuiteReceipt(value, expectations = {}) {
  exactKeys(value, [
    "kind", "version", "suite", "implementationRevision", "result", "commands", "commandIdentityDigest",
  ], "receipt");
  invariant(isObject(expectations), "expectations must be an object.");
  const supportedExpectations = ["suite", "implementationRevision"];
  invariant(Object.keys(expectations).every((key) => supportedExpectations.includes(key)), "expectations has an unsupported key.");

  invariant(value.kind === RECEIPT_KIND, "receipt kind differs.");
  invariant(value.version === RECEIPT_VERSION, "receipt version differs.");
  validateSuiteName(value.suite);
  invariant(REVISION.test(value.implementationRevision), "implementationRevision must be a lowercase 40-character Git revision.");
  invariant(value.result === "PASS", "receipt result must be PASS.");
  validateCommands(value.commands);
  invariant(canonicalJson(value.commands) === canonicalJson(SUITE_COMMANDS[value.suite]), "receipt commands differ from the closed suite definition.");
  invariant(DIGEST.test(value.commandIdentityDigest), "commandIdentityDigest must be a SHA-256 digest.");
  invariant(value.commandIdentityDigest === commandIdentityDigest(value.commands), "commandIdentityDigest differs from the canonical commands.");

  if (expectations.suite !== undefined) {
    validateSuiteName(expectations.suite);
    invariant(value.suite === expectations.suite, "receipt suite differs from the expected suite.");
  }
  if (expectations.implementationRevision !== undefined) {
    invariant(typeof expectations.implementationRevision === "string" && REVISION.test(expectations.implementationRevision), "expected implementation revision is invalid.");
    invariant(value.implementationRevision === expectations.implementationRevision, "receipt implementation revision differs.");
  }
  return value;
}

function parseCli(argv) {
  invariant(argv[0] === "run", "expected run command.");
  const options = {};
  for (let index = 1; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant(name === "--suite" || name === "--receipt-dir", `unsupported argument ${JSON.stringify(name)}.`);
    invariant(value !== undefined && !value.startsWith("--"), `${name} requires a value.`);
    invariant(options[name] === undefined, `duplicate argument ${name}.`);
    options[name] = value;
  }
  invariant(argv.length === 5, "usage: run --suite NAME --receipt-dir PATH.");
  invariant(options["--suite"] !== undefined, "--suite is required.");
  invariant(options["--receipt-dir"] !== undefined, "--receipt-dir is required.");
  validateSuiteName(options["--suite"]);
  invariant(options["--receipt-dir"].length > 0, "--receipt-dir must not be empty.");
  return Object.freeze({
    suite: options["--suite"],
    receiptDirectory: resolve(process.cwd(), options["--receipt-dir"]),
  });
}

async function implementationRevision() {
  let stdout;
  try {
    ({ stdout } = await execFile("git", ["rev-parse", "HEAD"], {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8",
      maxBuffer: 4096,
      windowsHide: true,
    }));
  } catch (error) {
    fail(`git rev-parse HEAD failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const revision = stdout.trim();
  invariant(REVISION.test(revision), "git rev-parse HEAD returned an invalid revision.");
  return revision;
}

async function invocationFor(argv0, args) {
  if (argv0 !== "npm") return Object.freeze({ executable: argv0, args });
  const nodeRoot = process.platform === "win32"
    ? dirname(process.execPath)
    : resolve(dirname(process.execPath), "..");
  const npmCli = process.platform === "win32"
    ? resolve(nodeRoot, "node_modules/npm/bin/npm-cli.js")
    : resolve(nodeRoot, "lib/node_modules/npm/bin/npm-cli.js");
  const metadata = await lstat(npmCli);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(),
    "npm CLI is not a regular file in the active Node.js distribution.");
  const canonicalNpmCli = await realpath(npmCli);
  const relativeNpmCli = relative(nodeRoot, canonicalNpmCli);
  invariant(relativeNpmCli.length > 0 && relativeNpmCli !== ".."
    && !relativeNpmCli.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    && !isAbsolute(relativeNpmCli),
  "npm CLI resolves outside the active Node.js distribution.");
  return Object.freeze({ executable: process.execPath, args: [canonicalNpmCli, ...args] });
}

async function runCommand(specification) {
  const [argv0, ...args] = specification.argv;
  const cwd = resolve(WORKSPACE_ROOT, ...specification.cwd.split("/"));
  const invocation = await invocationFor(argv0, args);
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => rejectRun(new Error(`${argv0} launch failed: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${argv0} exited with ${code === null ? `signal ${signal ?? "unknown"}` : `status ${code}`}.`));
    });
  });
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeReceiptAtomically(path, receipt) {
  const bytes = Buffer.from(`${canonicalJson(receipt)}\n`, "utf8");
  invariant(bytes.length <= MAX_RECEIPT_BYTES, "receipt exceeds the bounded size limit.");
  const temporaryPath = `${path}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, path);
  } catch (error) {
    if (error?.code === "EEXIST") fail(`receipt already exists at ${path}.`);
    throw error;
  } finally {
    if (handle !== undefined) await handle.close().catch(() => {});
    await unlink(temporaryPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

async function runSuite(options) {
  const commands = SUITE_COMMANDS[options.suite];
  await mkdir(options.receiptDirectory, { recursive: true });
  const receiptPath = resolve(options.receiptDirectory, `${options.suite}.json`);
  invariant(!(await pathExists(receiptPath)), `receipt already exists at ${receiptPath}.`);

  const revision = await implementationRevision();
  for (const specification of commands) await runCommand(specification);

  const receipt = {
    kind: RECEIPT_KIND,
    version: RECEIPT_VERSION,
    suite: options.suite,
    implementationRevision: revision,
    result: "PASS",
    commands: commands.map((specification) => ({ cwd: specification.cwd, argv: [...specification.argv] })),
    commandIdentityDigest: commandIdentityDigest(commands),
  };
  validateSuiteReceipt(receipt, { suite: options.suite, implementationRevision: revision });
  await writeReceiptAtomically(receiptPath, receipt);
  process.stdout.write(`MO-1303 hosted suite ${options.suite} PASS\n`);
}

const invokedPath = process.argv[1] === undefined ? "" : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  await runSuite(parseCli(process.argv.slice(2)));
}
