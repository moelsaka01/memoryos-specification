# MO-1308 Phase 3C security and abuse corpus: campaign definition

Status: **AUTHORED AND REHEARSED IN THE CLOUD — NOT CERTIFIED**. Stream 3C of the [Phase 3 protocol](mo1308-phase3-protocol.md)
(Freeze Amendment A8, section 33), on branch `mo1308/phase3c-security`. Nothing here is evidence; no certifying generation was
sealed and nothing was committed under `evidence/`.

## 1. Tooling (`repositories/cca-conformance/tools/mo1308-phase3c/`)

| File | Role |
|---|---|
| `support.mjs` | an independent D/JCS implementation that reproduces the corpus recipes byte for byte; ledger parse, rebuild and reseal; `MemoryLedger`; CLI and disk helpers |
| `env.mjs` | the per-stream environment, artifact writer and `conclude` |
| `cases-tamper.mjs` | A1–A7, B1–B6 (tamper, truncation, rollback, forged chains) |
| `cases-admission.mjs` | C1–C10 (hostile admission cells through the real CLI; a rejection must leave the disk unchanged) |
| `cases-sha.mjs` | D1–D8 (FIPS 180-4 examples, the CAVP Monte Carlo procedure and a differential against `node:crypto`, all computed here; official CAVP response files are not used; checkpoint admission against the legacy quadratic oracle) |
| `cases-purge.mjs` | E1–E9, F1, F2, F4, F5 (tombstone, purge, crash states, export) |
| `scanner.mjs`, `cases-data.mjs` | the canary and forbidden-data-class scanner and H1–H5 |
| `cases-authority.mjs` | G1, G3–G6, I1–I3, K1–K3 (authority boundaries, static auditors, disclosures) |
| `cases-hostile.mjs` | J1–J7 (hostile inputs and resource limits) |
| `process-observer.cjs` | a preload counting child-process, network, DNS and worker activity |
| `cases.mjs`, `campaign.mjs` | the case table and the command line: `rehearse`, and `seal` / `run` / `close` |
| `dev-run.mjs` | a direct case runner for authoring (`node dev-run.mjs '3C-A*'`) |

## 2. Rehearsal (Linux, cloud, non-certifying)

`REHEARSAL_PARTIAL`: 70 cases, 62 executed and PASS, 0 failed, 8 skipped, about 3 minutes. The skips are visible in the
receipt and a certifying generation refuses every skip (`SKIP_NOT_ALLOWED`).

### Declared host-only (no implementation in the cloud)

| Case | Reason |
|---|---|
| 3C-F3 | links and junctions inside an export directory need NTFS reparse points: Step 3 Windows harness |
| 3C-G2 | needs the MO-1307 native `evaluate`, which exists only on the Windows reference host |
| 3C-D9 | the independent sub-agent review of the hand-written SHA-256 is a recorded input, not a program; it is recorded at the harness-review stage |

### Rehearsal-only tolerance (implemented; fails in a certifying run)

| Case | Reason |
|---|---|
| 3C-F4 | **real finding**: `history export --output` accepts a path inside the ledger directory (root, `entries/`, `records/`, or via `..`). The export is written, exits 0, and the ledger then fails `verify` with LEDGER_CORRUPT (inside `.pending/` it still verifies). The same behaviour affects 3A-D5. Fixing it is a public-behaviour change and returns to the owner; the alternative is a new qualification plus operator guidance |
| 3C-G4, K1, K2, K3 | the CLI documents do not describe the `history` namespace at all; the documents (and the D7 and H08 guidance) are written after the qualification outcomes are recorded, because they must state the recorded outcome of each qualification case |

## 3. Recorded qualification outcomes (rehearsal observations, not evidence)

A6, B3, B5, C10, E6, E7, E8 and E9 observe CONFIRMED; the certifying run records the authoritative outcome.

## 4. Running

```
node repositories/cca-conformance/tools/mo1308-phase3c/campaign.mjs rehearse --out DIR
node --test repositories/cca-conformance/tests/mo1308_phase3c_test.mjs
```
