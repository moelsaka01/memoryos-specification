import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

import { packageError } from "./errors.js";

let temporarySequence = 0;

function writeAll(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
    if (written <= 0) {
      const error = new Error("The Policy artifact output stream made no progress.");
      error.code = "EIO";
      throw error;
    }
    offset += written;
  }
}

function stage(path, bytes) {
  const directory = dirname(path);
  const name = basename(path);
  let descriptor;
  let temporaryPath;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    temporarySequence += 1;
    temporaryPath = join(directory, `.${name}.memoryos-${process.pid}-${temporarySequence}.tmp`);
    try {
      descriptor = openSync(temporaryPath, "wx", 0o600);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  if (descriptor === undefined) {
    const error = new Error(`Unable to reserve a temporary output for '${path}'.`);
    error.code = "EEXIST";
    throw error;
  }

  try {
    writeAll(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    return Object.freeze({ path, temporaryPath });
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* retain the original failure */ }
    }
    try { rmSync(temporaryPath, { force: true }); } catch { /* retain the original failure */ }
    throw error;
  }
}

function discard(staged) {
  for (const entry of staged) {
    try { rmSync(entry.temporaryPath, { force: true }); } catch { /* best-effort cleanup */ }
  }
}

export function publishFiles(files) {
  const staged = [];
  try {
    for (const file of files) {
      if (!(file.bytes instanceof Uint8Array)) {
        throw new TypeError(`Output '${file.path}' bytes must be a Uint8Array.`);
      }
      staged.push({ ...stage(file.path, file.bytes), role: file.role });
    }

    for (const entry of staged) renameSync(entry.temporaryPath, entry.path);
  } catch (error) {
    discard(staged);
    throw packageError(
      "Unable to publish the requested MemoryOS Policy artifact generation.",
      error?.code ?? "POLICY_OUTPUT_WRITE_FAILED",
    );
  }
}

export function publishEvaluationGeneration(outputs) {
  const order = Object.freeze({
    evaluationIdentity: 0,
    evaluationIdentityDigest: 1,
    outcomeDigest: 2,
    outcome: 3,
  });
  const files = [...outputs].sort((left, right) => order[left.role] - order[right.role]);
  if (files.some(({ role }) => order[role] === undefined)) {
    throw new TypeError("Evaluation publication contains an unsupported output role.");
  }
  if (files.filter(({ role }) => role === "outcome").length > 1) {
    throw new TypeError("Evaluation publication contains more than one outcome commit marker.");
  }
  publishFiles(files);
}
