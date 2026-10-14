import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

import {
  STDERR_MAX_BYTES,
  STDOUT_MAX_BYTES,
  WORKER_ARGV_MAX_COUNT,
  WORKER_ARG_MAX_BYTES,
  WORKER_REQUEST_MAX_BYTES,
} from "./runtime-contract.js";

interface WorkerRequest {
  readonly argv: readonly string[];
  readonly mainModulePath: string;
}

type CliMain = (
  argv: readonly string[],
  io: {
    readonly stdin: () => never;
    readonly stdout: (value: unknown) => void;
    readonly stderr: (value: unknown) => void;
  },
) => Promise<number> | number;

class OutputBoundError extends Error {}

let processOutputViolated = false;

function disableProcessOutput(stream: NodeJS.WriteStream, channel: "stdout" | "stderr"): void {
  Object.defineProperty(stream, "write", {
    configurable: false,
    enumerable: false,
    value: (): never => {
      processOutputViolated = true;
      throw new OutputBoundError(`The CLI attempted out-of-band ${channel} output.`);
    },
    writable: false,
  });
}

class BoundedUtf8Sink {
  readonly #chunks: Buffer[] = [];
  readonly #limit: number;
  #length = 0;
  #violated = false;

  constructor(limit: number) {
    this.#limit = limit;
  }

  write(value: unknown): void {
    if (typeof value !== "string") {
      this.#violated = true;
      throw new OutputBoundError("The exact JSON worker transport accepts only UTF-8 string output.");
    }
    const byteLength = Buffer.byteLength(value, "utf8");
    if (byteLength > this.#limit - this.#length) {
      this.#violated = true;
      throw new OutputBoundError("The CLI output exceeded its frozen byte bound.");
    }
    const chunk = Buffer.from(value, "utf8");
    this.#length += byteLength;
    this.#chunks.push(chunk);
  }

  text(): string {
    return Buffer.concat(this.#chunks, this.#length).toString("utf8");
  }

  get violated(): boolean {
    return this.#violated;
  }
}

function validateRequest(value: unknown): WorkerRequest {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new TypeError("Worker data must be bounded JSON data.");
  }
  if (Buffer.byteLength(encoded, "utf8") > WORKER_REQUEST_MAX_BYTES) {
    throw new TypeError("Worker data exceeds the frozen request bound.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Worker data must be an object.");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["argv", "mainModulePath"])) {
    throw new TypeError("Worker data has an unexpected member set.");
  }
  if (!Array.isArray(record.argv)
      || record.argv.length < 3
      || record.argv.length > WORKER_ARGV_MAX_COUNT
      || record.argv.some((argument) => (
        typeof argument !== "string"
        || argument.length === 0
        || Buffer.byteLength(argument, "utf8") > WORKER_ARG_MAX_BYTES
      ))) {
    throw new TypeError("Worker argv is outside the closed bounded transport.");
  }
  if (typeof record.mainModulePath !== "string"
      || !isAbsolute(record.mainModulePath)
      || Buffer.byteLength(record.mainModulePath, "utf8") > WORKER_ARG_MAX_BYTES) {
    throw new TypeError("Worker CLI main-module path is invalid.");
  }
  return Object.freeze({
    argv: Object.freeze([...record.argv] as string[]),
    mainModulePath: record.mainModulePath,
  });
}

async function run(): Promise<void> {
  if (parentPort === null) throw new Error("The CLI worker requires a parent message port.");
  try {
    const request = validateRequest(workerData);
    // The product-contract main function receives bounded injected I/O. Direct
    // process output is outside that contract and must fail even when the
    // imported closure catches the attempted write.
    disableProcessOutput(process.stdout, "stdout");
    disableProcessOutput(process.stderr, "stderr");
    const module = await import(pathToFileURL(request.mainModulePath).href);
    if (typeof module.main !== "function") {
      throw new TypeError("The verified CLI main module does not export main(argv, injectedIO).");
    }
    const stdout = new BoundedUtf8Sink(STDOUT_MAX_BYTES);
    const stderr = new BoundedUtf8Sink(STDERR_MAX_BYTES);
    const io = Object.freeze({
      stdin: (): never => { throw new Error("The VS Code CLI adapter disables stdin."); },
      stdout: (value: unknown): void => stdout.write(value),
      stderr: (value: unknown): void => stderr.write(value),
    });
    const exitCode = await (module.main as CliMain)(request.argv, io);
    if (stdout.violated || stderr.violated || processOutputViolated) {
      throw new OutputBoundError("The CLI attempted to exceed or escape an output bound.");
    }
    if (!Number.isSafeInteger(exitCode) || exitCode < 0 || exitCode > 255) {
      throw new TypeError("The verified CLI returned an invalid exit code.");
    }
    parentPort.postMessage(Object.freeze({
      exitCode,
      stderr: stderr.text(),
      stdout: stdout.text(),
      type: "result",
    }));
    parentPort.close();
  } catch (cause) {
    parentPort.postMessage(Object.freeze({
      adapterCode: cause instanceof OutputBoundError
        ? "MEMORYOS_VSCODE_OUTPUT_INVALID"
        : "MEMORYOS_VSCODE_WORKER_FAILED",
      message: cause instanceof OutputBoundError
        ? "The CLI output exceeded its frozen byte bound."
        : "The isolated CLI worker failed.",
      type: "failure",
    }));
    parentPort.close();
  }
}

void run();
