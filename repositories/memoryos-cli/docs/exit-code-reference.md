# Exit Code Reference

## Purpose

MemoryOS CLI assigns one deterministic process exit code to each outcome category. Scripts should use the process exit code rather than matching human-readable text.

| Code | Name | Meaning | Representative causes |
|---:|---|---|---|
| `0` | Success | The requested SDK-backed operation completed. | Valid command, valid package, completed output write, completed Regression analysis whether identical or changed. |
| `1` | Invalid arguments | The command line does not match the public CLI grammar. | Unknown command or option, missing option, too many operands, two Regression stdin operands, `--json` with raw export. |
| `2` | Validation failure | Explicit input or action is invalid. | Invalid JSON, invalid Regression Report or Explorer query, missing Workspace identifier, invalid Replay action, cross-Workspace Regression, invalid session record. |
| `3` | Verification failure | SDK/MIP verification rejected package contents. | Checksum, schema, integrity, or conformance diagnostics. |
| `4` | Package error | Package transport or package-backed capability failed. | Package read/write failure, import/export failure, unavailable authored package Trace, native export unavailable. |
| `5` | SDK failure | An SDK failure does not belong to a caller-validation or package category. | Invalid lifecycle transition or unexpected SDK operation failure. |
| `6` | Policy FAIL | A valid Policy evaluation completed with decision `FAIL`. | One or more frozen Policy rules were not satisfied. |
| `7` | Policy CNE | A valid Policy evaluation completed with decision `COULD_NOT_EVALUATE`. | Required deterministic facts were unavailable or a normative evaluation resource limit produced CNE. |

The same code is returned in human and JSON modes. JSON errors also include it as `error.exitCode`.

Only `policy evaluate` returns `6` or `7`. PASS returns `0`. FAIL and CNE are
completed normative results, so their outcome and requested sidecars are fully
published before the decision exit is returned. A successful `verify-outcome`
of a valid FAIL or CNE artifact returns `0` because verification succeeded.

Within the `policy` namespace, `1` is usage, `2` deterministic preparation, `3`
identity/outcome verification failure, `4` filesystem or stream transport, and
`5` SDK/runtime/internal operational failure. Automation must preserve the
evaluation exit and cross-check it against the verified outcome decision.

`regressionDetected: true` is report data, not a command failure. A successful Regression command returns `0`; CI policy may independently decide how to act on the deterministic report.

An Investigation result with status `empty` is also successful and returns `0`; it means the exact SDK query found no matching observed difference.

## Shell use

POSIX:

```sh
if memoryos verify investigation.mip --json > verification.json; then
  echo "verified"
else
  code=$?
  echo "verification failed with exit code $code" >&2
  exit "$code"
fi
```

PowerShell:

```powershell
memoryos verify investigation.mip --json | Set-Content verification.json
if ($LASTEXITCODE -ne 0) {
    throw "MemoryOS verification failed with exit code $LASTEXITCODE"
}
```

Session processing is fail-fast. The first invalid JSON line or failed action emits one deterministic error record and becomes the process exit code; later records are not executed.
