import { readFileSync } from "node:fs";

import { parseArguments } from "./arguments.js";
import { executeCommand } from "./commands.js";
import { ExitCode, normalizeError } from "./errors.js";
import {
  deterministicJson,
  errorEnvelope,
  humanError,
  humanResult,
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
  try {
    parsed = parseArguments(argv);
    if (parsed.command === "session") {
      return runSession(parsed, io, normalizeError);
    }

    const execution = executeCommand(parsed, io);
    if (execution.raw !== undefined) {
      io.stdout(execution.raw);
      return ExitCode.success;
    }

    if (parsed.command === "help" && !parsed.options.json) {
      io.stdout(`${execution.result.usage}\n`);
    } else if (parsed.options.json) {
      io.stdout(deterministicJson(successEnvelope(parsed.command, execution.result)));
    } else {
      io.stdout(humanResult(parsed.command, execution.result));
    }
    return ExitCode.success;
  } catch (cause) {
    const command = parsed?.command ?? argv[0] ?? "cli";
    const error = normalizeError(cause, command);
    const output = jsonRequested
      ? deterministicJson(errorEnvelope(command, error))
      : humanError(command, error);
    io.stderr(output);
    return error.exitCode;
  }
}
