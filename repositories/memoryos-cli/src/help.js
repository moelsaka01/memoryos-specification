import { MEMORYOS_CLI_VERSION } from "./version.js";

const commandHelp = Object.freeze({
  observe: "memoryos observe --workspace FILE --snapshot FILE [--id ID] [--json]",
  trace: "memoryos trace PACKAGE --reflection ID [--id ID] [--json]",
  replay: "memoryos replay PACKAGE --trace ID [--action ACTION ...] [--id ID] [--json]",
  compare: "memoryos compare PACKAGE --trace ID --evolution ID [--id ID] [--json]",
  regression: "memoryos regression BASELINE CANDIDATE [--json]",
  verify: "memoryos verify PACKAGE [--json]",
  import: "memoryos import PACKAGE [--id ID] [--json]",
  export: "memoryos export PACKAGE --output FILE|- [--id ID] [--json]",
  inspect: "memoryos inspect PACKAGE [--id ID] [--json]",
  session: "memoryos session [WORKFLOW.memoryos] [--json]",
  version: "memoryos version [--json]",
  help: "memoryos help [COMMAND] [--json]",
});

export function helpText(command = null) {
  if (command !== null) {
    const usage = commandHelp[command];
    return usage ? `${usage}\n` : null;
  }
  return `MemoryOS CLI ${MEMORYOS_CLI_VERSION}

Usage: memoryos COMMAND [OPTIONS]

Commands:
  version  Show CLI and SDK versions
  help     Show command help
  observe  Observe an explicit Workspace snapshot
  trace    Select an exact Reflection or package Trace
  replay   Apply explicit Replay actions
  compare  Enter deterministic Evolution for one package
  regression  Compare two investigations for deterministic cognitive regressions
  verify   Verify a Memory Investigation Package
  import   Import a Memory Investigation Package
  export   Export exact canonical package bytes
  inspect  Display deterministic investigation metadata
  session  Run one live JSON Lines SDK session

Use 'memoryos help COMMAND' for exact syntax.
`;
}
