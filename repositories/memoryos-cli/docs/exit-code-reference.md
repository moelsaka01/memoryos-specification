# Exit Code Reference

## Purpose

MemoryOS CLI assigns one deterministic process exit code to each outcome category. Scripts should use the process exit code rather than matching human-readable text.

| Code | Name | Meaning | Representative causes |
|---:|---|---|---|
| `0` | Success | The requested SDK-backed operation completed. | Valid command, valid package, completed output write. |
| `1` | Invalid arguments | The command line does not match the public CLI grammar. | Unknown command or option, missing option, too many operands, `--json` with raw export. |
| `2` | Validation failure | Explicit input or action is invalid. | Invalid JSON, missing Workspace identifier, invalid Replay action, invalid session record. |
| `3` | Verification failure | SDK/MIP verification rejected package contents. | Checksum, schema, integrity, or conformance diagnostics. |
| `4` | Package error | Package transport or package-backed capability failed. | Package read/write failure, import/export failure, unavailable authored package Trace, native export unavailable. |
| `5` | SDK failure | An SDK failure does not belong to a caller-validation or package category. | Invalid lifecycle transition or unexpected SDK operation failure. |

The same code is returned in human and JSON modes. JSON errors also include it as `error.exitCode`.

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
