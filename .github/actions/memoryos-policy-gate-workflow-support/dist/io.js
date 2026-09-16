"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const PUBLIC_OUTPUT_NAMES = Object.freeze([
  "gate-class",
  "decision",
  "cli-exit-code",
  "publication-valid",
  "policy-semantic-digest",
  "evaluation-identity-digest",
  "outcome-digest",
  "policy-fact-context-digest",
  "regression-source-digest",
  "stable-code",
  "failure-class",
  "phase",
  "artifact-kind",
  "limit-identifier",
  "distribution-repository",
  "distribution-revision",
  "artifact-name",
  "artifact-id",
]);

function getInput(name, environment = process.env) {
  return environment[`INPUT_${name.toUpperCase()}`] ?? "";
}

function cleanOutput(value) {
  const text = String(value ?? "");
  if (/[\0\r\n]/u.test(text)) throw new Error("unsafe Action output");
  return text;
}

function appendEnvironmentValue(path, name, value) {
  if (!path) return;
  const safeName = cleanOutput(name);
  const safeValue = cleanOutput(value);
  const delimiter = `memoryos_${crypto.randomBytes(16).toString("hex")}`;
  fs.appendFileSync(path, `${safeName}<<${delimiter}\n${safeValue}\n${delimiter}\n`, "utf8");
}

function writeOutputs(outputs, environment = process.env) {
  const outputPath = environment.GITHUB_OUTPUT;
  for (const [name, value] of Object.entries(outputs)) {
    appendEnvironmentValue(outputPath, name, value);
  }
  return outputs;
}

function emptyPublicOutputs() {
  return Object.fromEntries(PUBLIC_OUTPUT_NAMES.map((name) => [name, ""]));
}

function utf8Prefix(value, maximumBytes) {
  const source = String(value ?? "").normalize("NFC");
  let output = "";
  let bytes = 0;
  for (const scalar of source) {
    const length = Buffer.byteLength(scalar, "utf8");
    if (bytes + length > maximumBytes) break;
    output += scalar;
    bytes += length;
  }
  return output;
}

function presentationScalar(value) {
  const bounded = utf8Prefix(String(value ?? "").replace(/[\0\r\n\u2028\u2029]/gu, " "), 512);
  return bounded
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/::/gu, "&#58;&#58;")
    .replace(/([\\`*_[\]{}()#+.!|~-])/gu, "\\$1");
}

function commandValue(value) {
  return utf8Prefix(String(value ?? "").replace(/[\0\u2028\u2029]/gu, " "), 512)
    .replace(/%/gu, "%25")
    .replace(/\r/gu, "%0D")
    .replace(/\n/gu, "%0A")
    .replace(/:/gu, "%3A")
    .replace(/,/gu, "%2C");
}

function emitCommand(kind, title, message, stream = process.stdout) {
  const safeKind = kind === "notice" ? "notice" : "error";
  stream.write(`::${safeKind} title=${commandValue(title)}::${commandValue(message)}\n`);
}

module.exports = {
  PUBLIC_OUTPUT_NAMES,
  appendEnvironmentValue,
  cleanOutput,
  emitCommand,
  emptyPublicOutputs,
  getInput,
  presentationScalar,
  utf8Prefix,
  writeOutputs,
};
