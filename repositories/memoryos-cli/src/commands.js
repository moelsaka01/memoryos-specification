import { readFileSync, writeFileSync } from "node:fs";

import {
  MEMORYOS_SDK_VERSION,
  MemoryOS,
} from "../../cca-studio/web/js/memoryos-sdk.js";

import {
  CliError,
  ExitCode,
  argumentError,
  packageError,
  validationError,
} from "./errors.js";
import { helpText } from "./help.js";
import {
  comparisonSummary,
  investigationSummary,
  replaySummary,
  verificationSummary,
} from "./output.js";
import { MEMORYOS_CLI_VERSION } from "./version.js";

const replayActions = Object.freeze({
  play: (session) => session.play(),
  pause: (session) => session.pause(),
  restart: (session) => session.restart(),
  previous: (session) => session.previous(),
  next: (session) => session.next(),
  advance: (session) => session.advance(),
});

export function newMemoryOS() {
  return new MemoryOS();
}

export function readPackage(path, stdin = () => readFileSync(0)) {
  try {
    return path === "-" ? new Uint8Array(stdin()) : new Uint8Array(readFileSync(path));
  } catch (error) {
    throw packageError(`Unable to read package '${path}'.`, error?.code ?? "PACKAGE_READ_FAILED");
  }
}

export function readJsonObject(path, label, stdin = () => readFileSync(0)) {
  let text;
  try {
    text = path === "-" ? stdin().toString("utf8") : readFileSync(path, "utf8");
  } catch (error) {
    throw validationError(`Unable to read ${label} '${path}'.`, error?.code ?? "INPUT_READ_FAILED");
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw validationError(`${label} '${path}' is not valid JSON.`, "INVALID_JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(`${label} '${path}' must contain a JSON object.`, "INVALID_JSON_OBJECT");
  }
  return value;
}

export function importFromFile(memory, path, identifier, stdin) {
  const bytes = readPackage(path, stdin);
  const options = identifier === undefined ? {} : { identifier };
  return memory.importPackage(bytes, options);
}

export function observeFromFiles(memory, options) {
  const workspaceValue = readJsonObject(options.workspace, "Workspace input");
  const workspaceIdentifier = workspaceValue.identifier;
  if (typeof workspaceIdentifier !== "string" || workspaceIdentifier.length === 0) {
    throw validationError(
      "Workspace input must contain a non-empty 'identifier' string.",
      "INVALID_WORKSPACE",
    );
  }
  const snapshot = readJsonObject(options.snapshot, "Snapshot input");
  const query = options.query === undefined
    ? undefined
    : readJsonObject(options.query, "Query input");
  const observationOptions = {};
  if (options.id !== undefined) observationOptions.identifier = options.id;
  if (options.operation !== undefined) observationOptions.operation = options.operation;
  if (query !== undefined) observationOptions.query = query;
  if (options["result-code"] !== undefined) {
    observationOptions.resultCode = options["result-code"];
  }
  const workspace = memory.openWorkspace(workspaceIdentifier);
  return memory.observe(workspace, snapshot, observationOptions);
}

export function applyReplayAction(session, action) {
  const apply = replayActions[action];
  if (!apply) {
    throw validationError(
      `Unsupported Replay action '${action}'.`,
      "INVALID_REPLAY_ACTION",
    );
  }
  return apply(session);
}

export function completeReplay(session) {
  let steps = 0;
  while (session.state.status !== "completed") {
    session.next();
    steps += 1;
    if (steps >= 10_000) {
      throw new CliError(
        ExitCode.sdkFailure,
        "REPLAY_DID_NOT_COMPLETE",
        "The finite deterministic Replay did not complete within 10,000 SDK steps.",
      );
    }
  }
  return { investigation: session.investigation, steps };
}

function verifyPackage(memory, path, stdin) {
  const verification = memory.verifyPackage(readPackage(path, stdin));
  if (!verification.valid) {
    throw new CliError(
      ExitCode.verificationFailure,
      "VERIFICATION_FAILED",
      "Memory Investigation Package verification failed.",
      verification.diagnostics,
    );
  }
  return verification;
}

function writePackage(path, bytes) {
  if (path === "-") return { bytes, raw: true };
  try {
    writeFileSync(path, bytes);
  } catch (error) {
    throw packageError(`Unable to write package '${path}'.`, error?.code ?? "PACKAGE_WRITE_FAILED");
  }
  return { output: path, raw: false };
}

export function executeCommand(parsed, io = {}) {
  const { command, options, positionals } = parsed;
  if (command === "version") {
    return {
      result: {
        cliVersion: MEMORYOS_CLI_VERSION,
        sdkVersion: MEMORYOS_SDK_VERSION,
      },
    };
  }
  if (command === "help") {
    const target = positionals[0] ?? null;
    const text = helpText(target);
    if (text === null) throw argumentError(`Unknown help topic '${target}'.`);
    return { result: { topic: target ?? "memoryos", usage: text.trimEnd() } };
  }
  if (command === "session") {
    throw new Error("Session dispatch must be handled by main().");
  }

  const memory = newMemoryOS();
  const stdin = io.stdin;
  if (command === "investigate") {
    const report = readJsonObject(positionals[0], "Regression report", stdin);
    const query = {};
    if (options.category !== undefined) query.category = options.category;
    if (options.reflection !== undefined) query.reflectionIdentifier = options.reflection;
    if (options.transition !== undefined) query.transition = options.transition;
    return { result: memory.investigate(report, query) };
  }
  if (command === "observe") {
    return { result: investigationSummary(observeFromFiles(memory, options)) };
  }
  if (command === "verify") {
    return { result: verificationSummary(verifyPackage(memory, positionals[0], stdin)) };
  }
  if (command === "regression") {
    if (positionals[0] === "-" && positionals[1] === "-") {
      throw argumentError("regression accepts at most one package from standard input.");
    }
    const baseline = importFromFile(
      memory,
      positionals[0],
      "memoryos-regression-baseline",
      stdin,
    );
    const candidate = importFromFile(
      memory,
      positionals[1],
      "memoryos-regression-candidate",
      stdin,
    );
    return { result: memory.regression(baseline, candidate) };
  }

  const investigation = importFromFile(memory, positionals[0], options.id, stdin);
  if (command === "import" || command === "inspect") {
    return { result: investigationSummary(investigation) };
  }
  if (command === "trace") {
    return { result: investigationSummary(investigation.trace(options.reflection)) };
  }
  if (command === "replay") {
    const traced = investigation.trace(options.trace);
    let replay = traced.replay();
    for (const action of options.action ?? []) replay = applyReplayAction(replay, action);
    return { result: replaySummary(replay) };
  }
  if (command === "compare") {
    const traced = investigation.trace(options.trace);
    const completed = completeReplay(traced.replay());
    const configured = completed.investigation.comparisonSession(options.evolution);
    const comparison = completed.investigation.compare(configured);
    return {
      result: {
        ...comparisonSummary(comparison),
        replaySteps: completed.steps,
      },
    };
  }
  if (command === "export") {
    const exported = memory.exportPackage(investigation);
    if (options.output === "-" && options.json) {
      throw argumentError("--json cannot be combined with --output -.");
    }
    const written = writePackage(options.output, exported.toBytes());
    if (written.raw) return { raw: written.bytes };
    return {
      result: {
        byteLength: exported.byteLength,
        output: written.output,
        packageKind: exported.kind,
        packageVersion: exported.version,
      },
    };
  }
  throw argumentError(`Unsupported command '${command}'.`);
}

export function exportInvestigation(memory, investigation, output) {
  const exported = memory.exportPackage(investigation);
  const written = writePackage(output, exported.toBytes());
  return {
    byteLength: exported.byteLength,
    output: written.raw ? "-" : written.output,
    packageKind: exported.kind,
    packageVersion: exported.version,
  };
}

export { MEMORYOS_SDK_VERSION };
