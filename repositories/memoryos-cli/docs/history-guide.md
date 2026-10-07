# Investigation History CLI Guide

## Purpose

`memoryos history` keeps a local, append-only, hash-chained **Investigation History ledger** (MO-1308): one directory per Workspace
holding the records an operator chooses to retain (packages, checkpoints, Policy evaluations, Regression reports, CI/CD runs,
readiness results and decision claims). It adds integrity checks over what it holds. It does not restore state, grant approval,
authorize a release or replace the Freeze; see the [command reference](command-reference.md) and the
[exit-code reference](exit-code-reference.md) for the rest of the CLI.

The namespace has exactly seven subcommands and no aliases. Every option is explicit, there are no defaults, and `--json` selects
the deterministic JSON form described in [JSON output specification](json-output-specification.md).

```text
memoryos history init --ledger DIR --name NAME --workspace ID [--json]
memoryos history append --ledger DIR --kind KIND (--record FILE | --identity FILE --outcome FILE | --run DIR) [--json]
memoryos history tombstone --ledger DIR --target INDEX --reason REASON --authority-reference TEXT [--json]
memoryos history verify --ledger DIR [--json]
memoryos history query --ledger DIR [--kind KIND]... [--subject-type TYPE --subject VALUE] --retention ANY|RETAINED|PURGED --from INDEX --limit N [--json]
memoryos history export --ledger DIR --output NEW-DIR [--json]
memoryos history verify-export --export DIR [--json]
```

## Commands and flags

| Subcommand | Required flags | What it does |
|---|---|---|
| `init` | `--ledger`, `--name`, `--workspace` | Creates a new ledger directory. `--name` is 1 to 64 characters of `a-z`, `0-9`, `.`, `_`, `-` starting with a letter or digit. `--workspace` is the one Workspace the ledger holds. The directory must not exist. |
| `append` | `--ledger`, `--kind`, and the input flags of the kind | Admits one record and appends one entry. The record is verified first; nothing changes when it is refused. |
| `tombstone` | `--ledger`, `--target`, `--reason`, `--authority-reference` | Appends a tombstone entry for a retained record entry and purges that record's member bytes. The entry itself, and the chain, stay. |
| `verify` | `--ledger` | Recomputes every identity and the chain, and reports counts, the head digest and any anomalies. |
| `query` | `--ledger`, `--retention`, `--from`, `--limit` | Lists entries in index order. Optional `--kind` (repeatable, once per kind) and `--subject-type` with `--subject`. `--limit` is 1 to 1000. |
| `export` | `--ledger`, `--output` | Writes a self-contained export to a **new** directory that is not inside the ledger directory. An `--output` equal to or inside the ledger root (`entries/`, `records/`, `.pending/` included, by any relative, `..`, alias or differently spelled path that resolves there) is refused before anything is created, with `MO1308_FILESYSTEM_BOUNDARY` (exit 4); the ledger is unchanged. |
| `verify-export` | `--export` | Verifies an export directory without the ledger. |

Record kinds and their input flags:

| `--kind` | Input |
|---|---|
| `MIP_PACKAGE`, `INVESTIGATION_CHECKPOINT`, `REGRESSION_REPORT`, `READINESS_RESULT`, `HUMAN_DECISION_CLAIM` | `--record FILE` |
| `POLICY_EVALUATION` | `--identity FILE --outcome FILE` |
| `CICD_RUN` | `--run DIR` (the bundle directory: 6 files with the Policy artifacts, or the 4 operational files) |

Tombstone reasons: `PRIVACY_REQUEST`, `LEGAL_REQUIREMENT`, `SECURITY_INCIDENT`, `DATA_MINIMIZATION`, `OPERATOR_CORRECTION`. The
authority reference is 1 to 256 printable ASCII characters and is recorded as written; MemoryOS does not verify who issued it
(`NOT_VERIFIED_BY_MEMORYOS`).

Subject types for `query`: `WORKSPACE`, `MIP_PACKAGE_DIGEST`, `MIP_PACKAGE_IDENTIFIER`, `INVESTIGATION`, `CHECKPOINT`,
`TRANSITION_LOG_DIGEST`, `EVALUATION_IDENTITY_DIGEST`, `OUTCOME_DIGEST`, `REGRESSION_REPORT`, `CICD_RUN_ID`,
`READINESS_CANDIDATE_DIGEST`, `READINESS_DIGEST`, `PROOF_BINDING_DIGEST`.

## Results

Successful `--json` results (inside the usual `command`, `ok`, `result`, `schemaVersion` envelope):

| Subcommand | `result` members |
|---|---|
| `init` | `ledgerIdentifier` |
| `append`, `tombstone` | `index`, `entryDigest` |
| `verify`, `verify-export` | `kind`, `version`, `ledgerIdentifier`, `workspaceIdentifier`, `entryCount`, `headDigest`, `retainedRecords`, `purgedRecords`, `tombstones`, `purgePending`, `unreferencedRecords`, `pendingArtifacts` |
| `query` | `kind`, `version`, `ledgerIdentifier`, `workspaceIdentifier`, `entryCount`, `headDigest`, `query`, `entries[]` and `nextIndex` |
| `export` | `ledgerIdentifier`, `entryCount`, `headDigest` |

`verify` lists at most the first 1,000 `purgePending` and `unreferencedRecords` items, sorted, and has no total for `unreferencedRecords`: a ledger with more than 1,000 of them (each is left by an interrupted append) reports the first 1,000 only (recorded limit, Amendment A9.4). `pendingArtifacts` is an exact count of staging artifacts, beyond 1,000 too.
The CLI JSON output is bounded to 4,194,304 bytes; a query page that would exceed it fails with `MO1308_RESOURCE_LIMIT`, so request
a smaller `--limit`.

Output carries identifiers, names, digests, byte lengths, integers and closed values only. It contains no path, record content,
timestamp, environment value or exception text, and the same ledger produces the same bytes on any machine.

## `decisionConsistency` is informational

A `HUMAN_DECISION_CLAIM` entry carries `decisionConsistency`: `CONSISTENT` or `CONTRARY_TO_READINESS`, and `null` on every other
entry. It compares the recorded human claim with the recorded MO-1307 readiness result (an `APPROVE` claim is
`CONTRARY_TO_READINESS` when that result is not `READY` or `READY_WITH_QUALIFICATIONS`; `REJECT` and `DEFER` never are).
It is informational only. It is not an approval, does not authorize a release, does not change any readiness result, and
MemoryOS never turns a computed readiness into a human decision. A claim is accepted only if a matching readiness result is already
in the same ledger; otherwise `append` fails with `MO1308_DECISION_UNBOUND`.

## Exit codes

The same code is returned in human and JSON modes; the JSON error also carries `error.historyCode` and a fixed message that
never echoes input.

| Exit | Meaning | `historyCode` |
|---:|---|---|
| `0` | Success | none |
| `1` | Invalid arguments | `MO1308_USAGE` |
| `2` | A record, query or tombstone was refused | `MO1308_RECORD_INVALID`, `MO1308_RECORD_DUPLICATE`, `MO1308_RECORD_PURGED`, `MO1308_WORKSPACE_MISMATCH`, `MO1308_DECISION_UNBOUND`, `MO1308_TOMBSTONE_INVALID`, `MO1308_QUERY_INVALID`, `MO1308_RESOURCE_LIMIT` |
| `3` | Verification failed | `MO1308_LEDGER_CORRUPT`, `MO1308_RECORD_BYTES_MISMATCH`, `MO1308_EXPORT_CORRUPT`, `MO1308_VERSION_UNSUPPORTED` |
| `4` | Location or filesystem failure (including an export location inside the ledger) | `MO1308_LEDGER_EXISTS`, `MO1308_LEDGER_NOT_FOUND`, `MO1308_LEDGER_CONFLICT`, `MO1308_FILESYSTEM_BOUNDARY`, `MO1308_IO` |
| `5` | Internal failure | `MO1308_INTERNAL` |

Through the CLI a malformed query flag (`--limit` of 0 or above 1000, a non-decimal `--from`, an unknown `--retention` or `--kind`, a repeated `--kind`) is a grammar error: `MO1308_USAGE`, exit 1. `MO1308_QUERY_INVALID` (exit 2) is produced by the SDK query validator for a malformed query object, not by the CLI, because the grammar rejects first (Amendment A9.3).

A refused command leaves the ledger and every other path unchanged. `MO1308_LEDGER_CONFLICT` means another writer committed the
entry first; run the command again.

## Limits

100,000 entries per ledger; 16,384 bytes per entry file; 1,024 bytes for the ledger descriptor; 16 subjects per entry; query
`--limit` 1 to 1000; member sizes per kind as in the Freeze (a MIP package 16,777,216 bytes, a checkpoint 33,554,432 bytes with at
most 10,000 transitions, a Policy evaluation member 4,060 bytes, a Regression report 16,777,216 bytes, a CI/CD run 49,152 bytes in
total, a readiness result 4,194,304 bytes, a decision claim 8,192 bytes).

## Scope and boundaries

- The ledger is local to one directory on one host and holds one Workspace. It is for a single local user; it is not a shared or
  multi-user store, and it is not a cloud service.
- Integrity only: entries are hash-chained, but they are not signed, not authenticated and not encrypted. Access control is the
  operator's filesystem responsibility. Verification detects a changed or reordered entry; the release disclosures state what it
  cannot detect and how operators should keep a record of each export digest.
- A checkpoint record kept in a ledger is not a restore source: `restore` and `session` never read the ledger.
- A directory swap during an operation is detected after the fact and is never prevented (single local user only).
- `export --output` must name a new location that is not inside the ledger directory; such a path is refused (`MO1308_FILESYSTEM_BOUNDARY`).
- Windows 11 x64 with the pinned Node is the only certified platform. UNC, network, synchronized and cloud-placeholder locations
  are observed, not claimed.
- The history commands start no process, open no socket and read no environment variable.

See also [automation-guide.md](automation-guide.md) for scripting exit codes.
