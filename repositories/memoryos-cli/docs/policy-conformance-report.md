# MO-1301 CLI 1.1 Conformance Report

## Scope

CLI 1.1.0 adds only the seven-command `policy` namespace. Every semantic
operation delegates to the public MemoryOS SDK 1.1 facade and the single Phase 3
Policy Engine. Existing CLI 1.0 commands and schema-1.0 envelopes are unchanged.

## Architecture evidence

| Requirement | Evidence |
|---|---|
| One semantic implementation | Production CLI has one SDK import, retained in `src/commands.js`; Policy modules receive the SDK owner as a dependency. |
| No authority upgrade | Evaluation accepts only candidate/baseline MIP paths; serialized contexts, sources, and reports occur only in `inspect`. |
| MIP-only CLI authority | Candidate and optional baseline are imported under fixed local role identifiers and captured through public SDK methods. |
| Exact bytes | Identity and outcome files use evaluator-retained bytes; digest sidecars are exactly 71 newline-free ASCII bytes. |
| Deterministic presentation | Policy JSON uses the closed schema-1.1 envelope, compact deterministic key order, and exactly one trailing LF. |
| Decision status | PASS/FAIL/CNE map to `0`/`6`/`7`; verification of a valid FAIL/CNE returns `0`. |
| Publication generation | All files stage before commit; identity and sidecars publish before outcome, the final commit marker. |

## Executable coverage

`tests/policy-cli.test.mjs` covers the seven names and closed grammar;
Policy/Set validation and digest; file/stdin parity; canonical output; exact
contract identities; PASS, FAIL, and CNE; trusted Regression acquisition; raw
outcome bytes; sidecars; pre-commit failure preservation; all five detached
inspection variants; artifact and authoritative verification; verification
failures; inspection/preparation distinction; input/output collisions; one-stdin
enforcement; URL-looking local paths; and output-only stdin restrictions.

`examples/run-cli-examples.mjs` executes all seven subcommands through the
production entry point and checks schema 1.1, PASS evaluation, canonical
identity/outcome termination, and exact sidecar lengths.

```sh
npm test
npm run test:examples
```

Cross-language evaluator parity, final golden/cache vectors, and the MO-1302
handoff suite are registered in the workspace-wide MO-1301 conformance
inventory. This report does not claim that MO-1302 GitHub Actions exists.
