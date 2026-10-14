import { MEMORYOS_CLI_VERSION } from "./version.js";

const commandHelp = Object.freeze({
  policy: `memoryos policy validate (--policy POLICY | --policy-set POLICY_SET) [--json]
memoryos policy digest (--policy POLICY | --policy-set POLICY_SET) [--canonical-output FILE] [--json]
memoryos policy inspect (--context CONTEXT | --regression-source SOURCE | --regression-report REPORT | --evaluation-identity IDENTITY | --outcome OUTCOME) [--json]
memoryos policy evaluate (--policy POLICY | --policy-set POLICY_SET) --package CANDIDATE [--regression-baseline BASELINE] --outcome FILE|- [--identity-output FILE] [--evaluation-identity-digest-output FILE] [--outcome-digest-output FILE] [--json]
memoryos policy verify-identity IDENTITY --mode artifact --expected-evaluation-identity-digest DIGEST [--json]
memoryos policy verify-identity IDENTITY --mode evaluation (--policy POLICY | --policy-set POLICY_SET) --package CANDIDATE [--regression-baseline BASELINE] [--json]
memoryos policy verify-outcome OUTCOME --mode artifact (--expected-identity IDENTITY | --expected-evaluation-identity-digest DIGEST) [--expected-outcome-digest DIGEST] [--json]
memoryos policy verify-outcome OUTCOME --mode evaluation (--policy POLICY | --policy-set POLICY_SET) --package CANDIDATE [--regression-baseline BASELINE] [--expected-outcome-digest DIGEST] [--json]
memoryos policy identities [--json]`,
  observe: "memoryos observe --workspace FILE --snapshot FILE [--id ID] [--json]",
  trace: "memoryos trace PACKAGE --reflection ID [--id ID] [--json]",
  replay: "memoryos replay PACKAGE --trace ID [--action ACTION ...] [--id ID] [--json]",
  compare: "memoryos compare PACKAGE --trace ID --evolution ID [--id ID] [--json]",
  regression: "memoryos regression BASELINE CANDIDATE [--json]",
  investigate: "memoryos investigate REPORT [--category CATEGORY] [--reflection ID] [--transition TRANSITION] [--json]",
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
  policy   Validate, evaluate, inspect, and verify Investigation Policies
  version  Show CLI and SDK versions
  help     Show command help
  observe  Observe an explicit Workspace snapshot
  trace    Select an exact Reflection or package Trace
  replay   Apply explicit Replay actions
  compare  Enter deterministic Evolution for one package
  regression  Compare two investigations for deterministic cognitive regressions
  investigate  Navigate an exact deterministic Regression Report
  verify   Verify a Memory Investigation Package
  import   Import a Memory Investigation Package
  export   Export exact canonical package bytes
  inspect  Display deterministic investigation metadata
  session  Run one live JSON Lines SDK session

Use 'memoryos help COMMAND' for exact syntax.
`;
}
