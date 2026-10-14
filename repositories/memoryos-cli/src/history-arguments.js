// MO-1308 `memoryos history` grammar (Contract Freeze 1 §13.3), Phase 1.
// This file validates the closed grammar only. It reads no file, builds no
// query or record, and chooses no default: every option a command requires
// (including the query --retention, --from and --limit, Amendment A2) must be given.
import { CliError, ExitCode } from "./errors.js";

// The fixed MO1308_USAGE message (Freeze §14.1); errors echo no input.
export const HISTORY_USAGE_MESSAGE = "Invalid command, flag or argument.";

export const HISTORY_RECORD_KINDS = Object.freeze([
  "MIP_PACKAGE", "INVESTIGATION_CHECKPOINT", "POLICY_EVALUATION", "REGRESSION_REPORT",
  "CICD_RUN", "READINESS_RESULT", "HUMAN_DECISION_CLAIM",
]);
export const HISTORY_TOMBSTONE_REASONS = Object.freeze([
  "PRIVACY_REQUEST", "LEGAL_REQUIREMENT", "SECURITY_INCIDENT", "DATA_MINIMIZATION", "OPERATOR_CORRECTION",
]);
export const HISTORY_SUBJECT_TYPES = Object.freeze([
  "WORKSPACE", "MIP_PACKAGE_DIGEST", "MIP_PACKAGE_IDENTIFIER", "INVESTIGATION", "CHECKPOINT",
  "TRANSITION_LOG_DIGEST", "EVALUATION_IDENTITY_DIGEST", "OUTCOME_DIGEST", "REGRESSION_REPORT",
  "CICD_RUN_ID", "READINESS_CANDIDATE_DIGEST", "READINESS_DIGEST", "PROOF_BINDING_DIGEST",
]);
export const HISTORY_RETENTION_FILTERS = Object.freeze(["ANY", "RETAINED", "PURGED"]);

const RECORD_FILE_KINDS = Object.freeze([
  "MIP_PACKAGE", "INVESTIGATION_CHECKPOINT", "REGRESSION_REPORT", "READINESS_RESULT", "HUMAN_DECISION_CLAIM",
]);
const LEDGER_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const AUTHORITY_REFERENCE = /^[\x20-\x7e]{1,256}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;

export const historyDefinitions = Object.freeze({
  init: { required: ["ledger", "name", "workspace"], options: { ledger: "value", name: "value", workspace: "value", json: "flag" } },
  append: {
    required: ["ledger", "kind"],
    options: { ledger: "value", kind: "value", record: "value", identity: "value", outcome: "value", run: "value", json: "flag" },
  },
  tombstone: {
    required: ["ledger", "target", "reason", "authority-reference"],
    options: { ledger: "value", target: "value", reason: "value", "authority-reference": "value", json: "flag" },
  },
  verify: { required: ["ledger"], options: { ledger: "value", json: "flag" } },
  query: {
    // Amendment A2: --retention, --from and --limit are required; there are no defaults.
    required: ["ledger", "retention", "from", "limit"],
    options: {
      ledger: "value", kind: "repeat", "subject-type": "value", subject: "value",
      retention: "value", from: "value", limit: "value", json: "flag",
    },
  },
  export: { required: ["ledger", "output"], options: { ledger: "value", output: "value", json: "flag" } },
  "verify-export": { required: ["export"], options: { export: "value", json: "flag" } },
});

export function historyUsageError() {
  const error = new CliError(ExitCode.invalidArguments, "INVALID_ARGUMENTS", HISTORY_USAGE_MESSAGE, [],
    { failureClass: "usage" });
  error.historyCode = "MO1308_USAGE";
  return error;
}

function usage(condition) {
  if (condition) throw historyUsageError();
}
function index(value, maximum) {
  usage(!DECIMAL.test(value));
  const number = Number(value);
  usage(!Number.isSafeInteger(number) || number > maximum);
  return number;
}

export function parseHistoryArguments(tokens) {
  const subcommand = tokens[0];
  usage(subcommand === undefined || !Object.hasOwn(historyDefinitions, subcommand));
  const definition = historyDefinitions[subcommand];
  const options = {};
  for (let position = 1; position < tokens.length; position += 1) {
    const token = tokens[position];
    usage(!token.startsWith("--"));
    const separator = token.indexOf("=");
    const name = token.slice(2, separator === -1 ? undefined : separator);
    const kind = Object.hasOwn(definition.options, name) ? definition.options[name] : undefined;
    usage(kind === undefined);
    if (kind === "flag") {
      usage(separator !== -1 || options[name] === true);
      options[name] = true;
      continue;
    }
    const value = separator === -1 ? tokens[position + 1] : token.slice(separator + 1);
    usage(value === undefined || value.length === 0 || (separator === -1 && value.startsWith("--")));
    if (separator === -1) position += 1;
    if (kind === "repeat") {
      options[name] = [...(options[name] ?? []), value];
    } else {
      usage(options[name] !== undefined);
      options[name] = value;
    }
  }
  for (const name of definition.required) usage(options[name] === undefined);

  if (subcommand === "init") {
    usage(!LEDGER_NAME.test(options.name) || !options.workspace.isWellFormed());
  } else if (subcommand === "append") {
    usage(!HISTORY_RECORD_KINDS.includes(options.kind));
    const record = options.record !== undefined;
    const policy = options.identity !== undefined || options.outcome !== undefined;
    const run = options.run !== undefined;
    if (options.kind === "POLICY_EVALUATION") {
      usage(record || run || options.identity === undefined || options.outcome === undefined);
    } else if (options.kind === "CICD_RUN") {
      usage(record || policy || !run);
    } else {
      usage(!RECORD_FILE_KINDS.includes(options.kind) || !record || policy || run);
    }
  } else if (subcommand === "tombstone") {
    index(options.target, 99_999);
    usage(!HISTORY_TOMBSTONE_REASONS.includes(options.reason) || !AUTHORITY_REFERENCE.test(options["authority-reference"]));
  } else if (subcommand === "query") {
    const kinds = options.kind ?? [];
    for (const kind of kinds) usage(!HISTORY_RECORD_KINDS.includes(kind));
    usage(new Set(kinds).size !== kinds.length); // Amendment A2: query.recordKinds has no duplicates
    usage((options["subject-type"] === undefined) !== (options.subject === undefined));
    if (options["subject-type"] !== undefined) {
      usage(!HISTORY_SUBJECT_TYPES.includes(options["subject-type"]) || !options.subject.isWellFormed());
    }
    usage(!HISTORY_RETENTION_FILTERS.includes(options.retention));
    index(options.from, 99_999);
    usage(index(options.limit, 1000) < 1);
  }
  return { command: "history", subcommand, options, positionals: [] };
}
