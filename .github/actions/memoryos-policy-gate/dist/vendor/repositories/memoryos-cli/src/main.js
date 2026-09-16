import { readFileSync } from "node:fs";

import { parseArguments } from "./arguments.js";
import { executeCommand } from "./commands.js";
import { ExitCode, normalizeError, normalizePolicyError } from "./errors.js";
import {
  deterministicJson,
  errorEnvelope,
  humanError,
  humanInvestigationResult,
  humanRegressionResult,
  humanResult,
  policyErrorEnvelope,
  policySuccessEnvelope,
  successEnvelope,
} from "./output.js";
import { runSession } from "./session.js";

const processIO = Object.freeze({
  stdin: () => readFileSync(0),
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value),
});

export async function main(argv, io = processIO) {
  let parsed = null;
  const jsonRequested = argv.includes("--json");
  const policyRequested = argv[0] === "policy";
  const policyCommand = () => parsed?.subcommand === undefined
    ? (argv[1] === undefined ? "policy" : `policy ${argv[1]}`)
    : `policy ${parsed.subcommand}`;
  const evaluationExitCode = (decision) => {
    if (decision === "FAIL") return ExitCode.policyFail;
    if (decision === "COULD_NOT_EVALUATE") return ExitCode.policyCouldNotEvaluate;
    return ExitCode.success;
  };
  try {
    parsed = parseArguments(argv);
    if (parsed.command === "session") {
      return runSession(parsed, io, normalizeError);
    }

    const execution = executeCommand(parsed, io);
    if (execution.raw !== undefined) {
      io.stdout(execution.raw);
      return parsed.command === "policy"
        ? evaluationExitCode(execution.decision)
        : ExitCode.success;
    }

    if (parsed.command === "help" && !parsed.options.json) {
      io.stdout(`${execution.result.usage}\n`);
    } else if (parsed.options.json) {
      const envelope = parsed.command === "policy"
        ? policySuccessEnvelope(policyCommand(), execution.result)
        : successEnvelope(parsed.command, execution.result);
      io.stdout(deterministicJson(envelope));
    } else if (parsed.command === "regression") {
      io.stdout(humanRegressionResult(execution.result));
    } else if (parsed.command === "investigate") {
      io.stdout(humanInvestigationResult(execution.result));
    } else {
      io.stdout(humanResult(
        parsed.command === "policy" ? policyCommand() : parsed.command,
        execution.result,
      ));
    }
    return parsed.command === "policy"
      ? evaluationExitCode(execution.decision)
      : ExitCode.success;
  } catch (cause) {
    const command = policyRequested ? policyCommand() : (parsed?.command ?? argv[0] ?? "cli");
    const error = policyRequested
      ? normalizePolicyError(cause, command)
      : normalizeError(cause, command);
    const output = jsonRequested
      ? deterministicJson(policyRequested
        ? policyErrorEnvelope(command, error)
        : errorEnvelope(command, error))
      : humanError(command, error);
    io.stderr(output);
    return error.exitCode;
  }
}
