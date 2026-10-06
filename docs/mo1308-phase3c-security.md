# MO-1308 Phase 3C security and abuse corpus: campaign definition

Status: **AUTHORED AND REHEARSED IN THE CLOUD — NOT CERTIFIED**. Stream 3C of the [Phase 3 protocol](mo1308-phase3-protocol.md)
(Freeze Amendment A8, section 34), on branch `mo1308/phase3c-security`. Nothing here is evidence; no certifying generation was
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
| `cases-authority.mjs` | G1, G3–G6, I1–I3 (authority boundaries, static auditors). K1–K3 (release-claim review) moved to 3D as E1–E3 (A8.7) |
| `cases-hostile.mjs` | J1–J7 (hostile inputs and resource limits) |
| `process-observer.cjs` | a preload counting child-process, network, DNS and worker activity |
| `cases.mjs`, `campaign.mjs` | the case table and the command line: `rehearse`, and `seal` / `run` / `close` |
| `dev-run.mjs` | a direct case runner for authoring (`node dev-run.mjs '3C-A*'`) |

## 2. Rehearsal (Linux, cloud, non-certifying)

3C now has 67 cases (K moved to 3D). Rehearsal: `REHEARSAL_PARTIAL`, 67 cases, 64 executed and PASS, 0 failed, 3 skipped, about 3 minutes. Declared host-only:
3C-F3 (links and junctions in an export directory need NTFS reparse points) and 3C-G2 (needs the MO-1307 native evaluate). A
certifying generation refuses every skip (`SKIP_NOT_ALLOWED`).

3C-D9 is implemented: it checks the bound independent review `repositories/cca-conformance/mo1308-phase3-sha256-review.json`
(subject files by hash, an independent sub-agent reviewer, every finding with a disposition, no blocking finding); the review is
sealed as a generation input. The review (no blocking finding) has one non-blocking, latent item: `Sha256Stream.update` does not
validate its argument (recorded `ACCEPTED_WITH_DISCLOSURE`; no production change in this task).

3C-G4 passes now that the CLI documents describe the `history` namespace (`history-guide.md`; `decisionConsistency` is
informational and not an approval).

**Rehearsal-only tolerance:** 3C-F4 is a real finding (`history export --output` accepts a path inside the ledger directory and
corrupts the ledger). The fix is being made on `mo1308/phase2-corrections`; until the new candidate is bound the case is skipped
visibly in a rehearsal and fails for real in a certifying generation.

## 3. Recorded qualification outcomes (rehearsal observations, not evidence)

A6, B3, B5, C10, E6, E7, E8 and E9 observe CONFIRMED; the certifying run records the authoritative outcome.

## 4. Running

```
node repositories/cca-conformance/tools/mo1308-phase3c/campaign.mjs rehearse --out DIR
node --test repositories/cca-conformance/tests/mo1308_phase3c_test.mjs
```
