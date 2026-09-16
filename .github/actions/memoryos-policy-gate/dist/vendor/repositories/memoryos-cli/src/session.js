import { readFileSync } from "node:fs";

import {
  MEMORYOS_SDK_VERSION,
  applyReplayAction,
  exportInvestigation,
  importFromFile,
  newMemoryOS,
  observeFromFiles,
  readPackage,
} from "./commands.js";
import { CliError, ExitCode, validationError } from "./errors.js";
import {
  comparisonSummary,
  deterministicJson,
  errorEnvelope,
  humanError,
  humanResult,
  investigationSummary,
  replaySummary,
  successEnvelope,
  verificationSummary,
} from "./output.js";
import { MEMORYOS_CLI_VERSION } from "./version.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw validationError(`Session command requires a non-empty '${name}'.`, "INVALID_SESSION_INPUT");
  }
  return value;
}

function requireCurrent(state) {
  if (state.investigation === null) {
    throw validationError(
      "Session has no current Investigation. Observe or import first.",
      "NO_ACTIVE_INVESTIGATION",
    );
  }
  return state.investigation;
}

function packageVerification(memory, path) {
  const verification = memory.verifyPackage(readPackage(path));
  if (!verification.valid) {
    throw new CliError(
      ExitCode.verificationFailure,
      "VERIFICATION_FAILED",
      "Memory Investigation Package verification failed.",
      verification.diagnostics,
    );
  }
  return verificationSummary(verification);
}

function executeRecord(record, state) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw validationError("Each session line must be a JSON object.", "INVALID_SESSION_INPUT");
  }
  const command = requireText(record.command, "command");

  if (command === "version") {
    return { command, result: { cliVersion: MEMORYOS_CLI_VERSION, sdkVersion: MEMORYOS_SDK_VERSION } };
  }
  if (command === "observe") {
    state.investigation = observeFromFiles(state.memory, {
      workspace: requireText(record.workspace, "workspace"),
      snapshot: requireText(record.snapshot, "snapshot"),
      id: record.identifier,
      operation: record.operation,
      query: record.query,
      "result-code": record.resultCode,
    });
    state.replay = null;
    state.comparison = null;
    return { command, result: investigationSummary(state.investigation) };
  }
  if (command === "import") {
    state.investigation = importFromFile(
      state.memory,
      requireText(record.package, "package"),
      record.identifier,
    );
    state.replay = null;
    state.comparison = null;
    return { command, result: investigationSummary(state.investigation) };
  }
  if (command === "trace") {
    state.investigation = requireCurrent(state).trace(requireText(record.reflection, "reflection"));
    state.replay = null;
    state.comparison = null;
    return { command, result: investigationSummary(state.investigation) };
  }
  if (command === "replay") {
    const action = requireText(record.action, "action");
    if (state.replay === null) state.replay = requireCurrent(state).replay();
    if (action !== "open") state.replay = applyReplayAction(state.replay, action);
    state.investigation = state.replay.investigation;
    return { command, result: replaySummary(state.replay) };
  }
  if (command === "compare") {
    const investigation = requireCurrent(state);
    const configured = investigation.comparisonSession(requireText(record.evolution, "evolution"));
    state.comparison = investigation.compare(configured);
    state.investigation = state.comparison.investigation;
    return { command, result: comparisonSummary(state.comparison) };
  }
  if (command === "checkpoint") {
    const name = requireText(record.name, "name");
    if (state.checkpoints.has(name)) {
      throw validationError(`Checkpoint name '${name}' already exists.`, "DUPLICATE_CHECKPOINT");
    }
    state.checkpoints.set(name, requireCurrent(state).checkpoint());
    return { command, result: { name, stored: true } };
  }
  if (command === "restore") {
    const name = requireText(record.name, "name");
    const checkpoint = state.checkpoints.get(name);
    if (checkpoint === undefined) {
      throw validationError(`Checkpoint '${name}' does not exist in this live session.`, "UNKNOWN_CHECKPOINT");
    }
    state.investigation = state.memory.restore(checkpoint);
    state.replay = null;
    state.comparison = null;
    return { command, result: investigationSummary(state.investigation) };
  }
  if (command === "verify") {
    const result = record.package === undefined
      ? verificationSummary(requireCurrent(state).verify())
      : packageVerification(state.memory, requireText(record.package, "package"));
    return { command, result };
  }
  if (command === "export") {
    const output = requireText(record.output, "output");
    if (output === "-") {
      throw validationError(
        "Session export requires a file path so JSON Lines output remains unambiguous.",
        "INVALID_SESSION_OUTPUT",
      );
    }
    return {
      command,
      result: exportInvestigation(
        state.memory,
        requireCurrent(state),
        output,
      ),
    };
  }
  if (command === "inspect") {
    return { command, result: investigationSummary(requireCurrent(state)) };
  }
  throw validationError(`Unsupported session command '${command}'.`, "INVALID_SESSION_COMMAND");
}

function readWorkflow(path, stdin) {
  try {
    return path === undefined ? stdin().toString("utf8") : readFileSync(path, "utf8");
  } catch (error) {
    throw validationError(
      path === undefined ? "Unable to read session input." : `Unable to read session file '${path}'.`,
      error?.code ?? "SESSION_READ_FAILED",
    );
  }
}

export function runSession(parsed, io, normalizeError) {
  const json = parsed.options.json === true;
  const text = readWorkflow(parsed.positionals[0], io.stdin);
  const lines = text.split(/\r?\n/u);
  const state = {
    checkpoints: new Map(),
    comparison: null,
    investigation: null,
    memory: newMemoryOS(),
    replay: null,
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim().length === 0) continue;
    let record;
    try {
      record = JSON.parse(lines[index]);
    } catch {
      const error = validationError(
        `Session line ${index + 1} is not valid JSON.`,
        "INVALID_SESSION_JSON",
      );
      const output = json
        ? deterministicJson(errorEnvelope("session", error))
        : humanError("session", error);
      io.stdout(output);
      return error.exitCode;
    }

    try {
      const { command, result } = executeRecord(record, state);
      const output = json
        ? deterministicJson(successEnvelope(command, result))
        : humanResult(command, result);
      io.stdout(output);
    } catch (cause) {
      const error = normalizeError(cause, record?.command ?? "session");
      const output = json
        ? deterministicJson(errorEnvelope(record?.command ?? "session", error))
        : humanError(record?.command ?? "session", error);
      io.stdout(output);
      return error.exitCode;
    }
  }
  return ExitCode.success;
}
