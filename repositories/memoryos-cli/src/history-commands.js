// MO-1308 `memoryos history` command execution (Contract Freeze 1, Stream 2C; section 13.3).
// The parsed grammar (history-arguments.js) is turned into store operations. The SDK history functions
// are supplied by the caller as `engine` (commands.js imports the SDK and passes them, so the SDK stays
// the CLI's single facade import); the file store does all file transport (H06). A missing engine fails
// closed. Errors carry only the frozen code, stage and fixed message: no path, record content,
// exception message or stack (section 14.1).
import { CliError, historyCliError } from "./errors.js";
import {
  STORE_LIMITS,
  STORE_POLICY_MEMBERS,
  STORE_RECORD_FILE_MEMBER,
  createHistoryStore,
} from "./history-store.js";

const INTERNAL = Object.freeze({ code: "MO1308_INTERNAL", exitCode: 5, message: "An internal history failure occurred." });
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function toCliError(error, engine) {
  if (error instanceof CliError) return error;
  if (typeof engine?.MemoryOSHistoryError === "function" && error instanceof engine.MemoryOSHistoryError) return historyCliError(error);
  return historyCliError(INTERNAL);
}

function operation(store, parsed) {
  const { subcommand, options } = parsed;
  if (subcommand === "init") {
    return store.init(options.ledger, { ledgerName: options.name, workspaceIdentifier: options.workspace });
  }
  if (subcommand === "append") {
    const recordKind = options.kind;
    let members;
    if (recordKind === "POLICY_EVALUATION") {
      members = [
        { name: STORE_POLICY_MEMBERS.identity, bytes: store.readInputFile(options.identity, STORE_POLICY_MEMBERS.maxBytes) },
        { name: STORE_POLICY_MEMBERS.outcome, bytes: store.readInputFile(options.outcome, STORE_POLICY_MEMBERS.maxBytes) },
      ];
    } else if (recordKind === "CICD_RUN") {
      members = store.readRunDirectory(options.run);
    } else {
      const rule = STORE_RECORD_FILE_MEMBER[recordKind];
      members = [{ name: rule.name, bytes: store.readInputFile(options.record, rule.maxBytes) }];
    }
    return store.append(options.ledger, { recordKind, members });
  }
  if (subcommand === "tombstone") {
    return store.tombstone(options.ledger, {
      targetIndex: Number(options.target), reason: options.reason, authorityReference: options["authority-reference"],
    });
  }
  if (subcommand === "verify") return store.verify(options.ledger);
  if (subcommand === "query") {
    // Amendment A2: the grammar requires --retention, --from and --limit and rejects a repeated --kind;
    // ordering the kinds (strictly ascending, UTF-16 code units) is done here.
    return store.query(options.ledger, {
      kind: "MemoryOSHistoryQuery",
      version: "1.0.0",
      recordKinds: [...(options.kind ?? [])].sort(compare),
      subject: options["subject-type"] === undefined ? null : { type: options["subject-type"], value: options.subject },
      retention: options.retention,
      fromIndex: Number(options.from),
      limit: Number(options.limit),
    });
  }
  if (subcommand === "export") return store.exportLedger(options.ledger, options.output);
  if (subcommand === "verify-export") return store.verifyExport(options.export);
  throw new TypeError("Unknown history subcommand.");
}

// Returns `{ result }` like the other command executors; throws a CliError with `historyCode`.
export function executeHistoryCommand(parsed, { engine, fs, platform } = {}) {
  try {
    if (engine === undefined || engine === null) return failClosed();
    const store = createHistoryStore({ engine, ...(fs === undefined ? {} : { fs }), ...(platform === undefined ? {} : { platform }) });
    const result = operation(store, parsed);
    // The CLI JSON stdout is bounded (section 14.2).
    if (Buffer.byteLength(JSON.stringify(result)) > STORE_LIMITS.stdoutBytes) {
      throw new engine.MemoryOSHistoryError("RESOURCE_LIMIT", "INTERNAL");
    }
    return { result };
  } catch (error) {
    throw toCliError(error, engine);
  }
}

function failClosed() {
  throw historyCliError(INTERNAL);
}
