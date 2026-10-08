# MO-1308 Phase 3 certification protocol

Status: **APPROVED — FREEZE AMENDMENT A8 (owner approval 2026-10-06)**.

This document is the text of Freeze Amendment A8 to [MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md), approved by the
owner on 2026-10-06 after review of the proposal and the nine decisions of section 2a. It is documentation only. It changes no
frozen text, no production code and no evidence; it freezes the finite Phase 3 campaign protocol and case inventory before any
run, as MO-1307 Freeze section 21 requires ("Freeze the finite campaign protocol/inventory before execution"). The amendment
record in the Freeze (section 34, renumbered from 33, see A8.5) binds the protocol, the inventory, the candidate identity and the corpus manifest by hash: a
later change to any of them needs a new amendment. The approval status makes certifying seals possible (section 5.2); each still
needs a recorded harness review.

The case inventory below is rendered from
[`mo1308-phase3-inventory.json`](../repositories/cca-conformance/mo1308-phase3-inventory.json), which is built from
`tools/mo1308-phase3/lib/inventory-source.mjs`; a test fails if the document, the JSON or the source disagree.

## 1. Authority

| Source | What it fixes |
|---|---|
| Freeze section 18.1, Phase 3 rows | 3A: "One-shot Windows 11 x64 CLI campaign: filesystem, concurrency, interruption, limits" (one-shot: Yes). 3B: "Released closures unchanged; no new dependencies; source closure reproducibility" (Yes). 3C: "Tamper and forgery corpus, data-class audit, authority separation" (Yes). 3D: "I3 plus binding-only BF; human tag review for `memoryos-1.3-mo1308`" (validator run). |
| Freeze section 18.3 (H47) | "3A applies because the Windows file store is the main risk. 3B applies as a closure and supply audit, not package certification, because no package is produced. 3C applies. Generations are append-only and one-shot; failed generations are preserved and never promoted." |
| Freeze section 18.1, DAG | 3A, 3B and 3C are parallel after 2D; "Accepted streams are preserved and a failed stream restarts alone." |
| Freeze section 9.6 (H45), 16 (H46) | Native Windows 11 x64, pinned Node, no Linux, WSL or VM gate; no new package and no new third-party dependency. |
| Freeze section 21 | "Development tests in Phases 1–2 are not one-shot; Phase 3 campaigns are." |
| Amendment A3 | A full CTest run, including `cca.workspace.verify`, is a mandatory precondition before any Phase 3 certification run. |
| MO-1307 Freeze section 21 | Failure classes, no retry-until-pass, retained raw failed attempts; reaffirmed by owner decision D5. |

3A is applicable, but not as MO-1307's installed-package campaign. The Freeze selected no production runtime and no package
(section 16), so 3A runs the CLI from the candidate source tree under the pinned Node. No installed-versus-source parity case
exists.

## 2. Owner decisions incorporated

| ID | Decision (owner, Phase 3 planning) | Where it lands |
|---|---|---|
| D1 | The candidate is the corrected head `f4211c8c` (`b0bf2d56` before A8.9, B2 `47595cc9` before A8.8), its production path tree by git blob; evidence-only descendants are allowed. | Section 3 |
| D2 | This protocol becomes Freeze Amendment A8, approved by the owner after review. | Status line; section 5.2 |
| D3 | At most 90 minutes per task, at most 3 hours extended; the J-C ceiling run is its own step, at most 3 hours, with a hard stop. | Section 7 |
| D4 | Non-certifying host rehearsals are allowed, preserved, and never promotable. | Section 5.4 |
| D5 | MO-1307 section 21 failure classes reaffirmed; no retry-until-pass; any public-behaviour change returns to owner review. | Section 6 |
| D6 | A staging `EPERM` passes on the contract with a census; escalate if it appears in more than 1 of 10 F7 runs. | Section 8.3; case 3A-F7 |
| D7 | Tail truncation, rollback, purge remnants, surviving digests and no re-admission in `verify` are tested and disclosed as v1 qualifications; operator guidance says to record each export and verify `headDigest` externally as the rollback anchor. | Section 11 |
| D8 | NIST-style and differential SHA-256 tests plus a recorded independent sub-agent review; disclosed. | Case 3C-D1..D9; Q09 |
| D9 | No SBOM; a closure manifest. | Cases 3B-D4, 3B-G3 |
| D10 | UNC, network, OneDrive and cloud placeholders are observed, not claimed. | Q15; case 3A-D9 |
| D11 | The 3B branch is `mo1308/phase3b-closure`. | Section 14 |

## 2a. A8 approval decisions (owner, 2026-10-06)

The owner decided the nine items of the Step 1 report as follows. Each is applied in the section named.

| # | Decision | Applied in |
|---|---|---|
| 1 | The NIST-style SHA-256 tests are accepted as proposed: FIPS 180-4 example messages plus the CAVP Monte Carlo procedure computed against `node:crypto`. **Official CAVP response files were not used**, and every disclosure says so. | Q09; cases 3C-D1, D2; section 9.3 |
| 2 | The 45 candidate paths are confirmed. | Section 3 |
| 3 | The seven allowed-path classes are confirmed. Ordinary documents (README, RELEASE_NOTES and the like) are not candidate changes. | Section 15 |
| 4 | The J-C ceiling run is a separate segment that runs only after the main segments PASS and ends with JC10. | Sections 7, 9.1 |
| 5 | An F7 escalation stops the generation; a rerun needs an owner approval reference. | Sections 5.5, 8.3 |
| 6 | A qualification case passes with CONFIRMED or NOT_CONFIRMED and fails with anything else. The release disclosures (3D-E3, and the D7 guidance 3D-E2) must state the actual recorded outcome of each qualification case: a weakness that was NOT_CONFIRMED is never disclosed as confirmed, and one that was CONFIRMED is never omitted. | Sections 8.4, 11; cases 3D-E2, K3 |
| 7 | Rehearsal evidence lives under `evidence/mo1308/phaseNx-rehearsal-rN/`. | Section 5.3 |
| 8 | A correct run must not be able to exceed its budget by design: guards are rebalanced and 3A main is split into two segments. | Section 7 |
| 9 | The precondition is Amendment A3.2's differential gate; the gate input is its receipt with verdict PASS. A production change from the precondition is a new candidate and returns to the owner. | Section 3 |

## 3. Candidate, inputs and the precondition

**Candidate (D1, moved by A8.8 and A8.9).** The candidate is commit `f4211c8c502f771bc78c2d2ab509c20d2b715676` (the binding B of `mo1308/phase3-corrections`, Amendment A10, `main` at the same commit); it was `b0bf2d5618e76512867bcdf49f805b22a7e12774` until A8.9 and B2 `47595cc95204307dd43c4772c417b52f0ac8402b` until A8.8. Against `b0bf2d56` only two production paths changed: `repositories/memoryos-cli/bin/memoryos.js` and `repositories/memoryos-cli/src/history-store.js` (A10). The candidate is the production path set of that
commit by blob: the static import closure of `repositories/memoryos-cli/bin/memoryos.js` and of
`repositories/cca-studio/web/js/memoryos-sdk.js` (42 files), plus `repositories/cca-studio/package.json`,
`repositories/memoryos-cli/package.json` and `repositories/memoryos-cli/CMakeLists.txt`, which decide how that code runs.
It is recorded in
[`mo1308-phase3-candidate-identity.json`](../repositories/cca-conformance/mo1308-phase3-candidate-identity.json) (45 paths with
blob ids and a `productionTreeDigest`) and is computed and verified by `tools/mo1308-phase3/candidate-identity.mjs`:

```text
node tools/mo1308-phase3/candidate-identity.mjs compute [--commit SHA] [--out FILE]
node tools/mo1308-phase3/candidate-identity.mjs verify --file FILE [--commit SHA | --worktree]
```

`verify` re-derives the record from git objects at its own base commit, and with `--commit` or `--worktree` checks a descendant
or a working tree: every base blob unchanged and no path added to or removed from the set. Every evidence commit of every
stream must leave the production path set unchanged. A production change makes a different candidate and returns to owner
review (section 6).

**Inputs.** Each stream is sealed over: this protocol and its approval status, the inventory, the candidate identity, the
shared corpus (3A and 3C), the stream tools, the recorded harness review, and for 3A and 3D the bound A3 precondition receipt.

**The A3 precondition (Amendments A3.1 to A3.4).** Amendment A3 of the Freeze (section 26) makes a full CTest run a
precondition of Phase 3. Four sub-amendments, merged into this branch from `mo1308/phase3-precondition` and cited by their
Freeze sections, refine it:

- **A3.1 (section 31)** waives the `cca_core_tests` target only, because MSVC 19.44.35229 miscompiles its
  `static_assert(!CanMutateCoreMetric<Observability>)` (error C2607; `cca-core` is byte-identical between BF and B2). The first
  run under it is preserved as `FAILED_PRESERVED` (evidence commit `59dfee40`, binding `82bb165e`): 125 of 316 executed tests
  failed, none of them MO-1308 code, and `cca.workspace.verify` passed.
- **A3.2 (section 32)** replaces A3's absolute gate with a **differential no-regression gate**: CTest is run on BF
  `1dd1e8c8` and on the candidate under an identical toolchain; the verdict is PASS only if `cca.workspace.verify` passes on B2,
  nothing that passes on BF fails or is not run on B2, every B2-only test passes, and every shared failure is listed
  `PRE_EXISTING` with a classification. Its evidence directory is
  `repositories/cca-conformance/evidence/mo1308/phase3-precondition-g4/` (generation 4, evidence `ce3876f4`, branch head `ce0d15ce`; A8.9),
  and its `receipt.json` carries the verdict as its top-level member `verdict`. The gate reads `receipt.json`; `binding.json` has no
  verdict member and hashes the receipt.
- **A3.4 (section 36)** repeats the differential as generation 3 on the corrected candidate b0bf2d56; generation 4 (A8.9) repeats it on f4211c8c and is the gate input; generations 2 and 3 stay preserved.
- **A3.3 (section 33)** records that Smart App Control blocks a build-dependent set of freshly built unsigned executables on the
  reference host: every CTest test whose executable is blocked in either tree is excluded in BOTH runs as
  `ENVIRONMENT_BLOCKED_SAC`, from a frozen list (`setup/exclusions.json`, committed before the recorded runs). A blocked executable
  that is not a native C++ test or tool binary stops the run. It supplements A3.2 and changes no production path.

**The gate input of this protocol is the A3.2 receipt with verdict PASS** (cases 3A-A4 and 3D-D5). Its result is pending on the
reference host, and this protocol assumes none. The exact verdict member of that receipt is to be confirmed from the receipt when
it exists. **If the precondition changes any production path, that is a new candidate and returns to the owner.**

## 4. Streams, order and shared inputs

<!-- GENERATED:BEGIN counts -->
| Stream | Title | Steps | Cases | One-shot |
|---|---|---:|---:|---|
| 3A | Native Windows CLI campaign | 14 | 108 | yes |
| 3B | Closure and supply audit | 7 | 26 | yes |
| 3C | Security and integrity | 10 | 67 | yes |
| 3D | Final integration | 2 | 10 | validator run |
<!-- GENERATED:END counts -->

The streams are independent in their inputs and may be authored in parallel in the cloud. **Execution on the reference host is
serial: 3A, then 3C, then 3B, then the 3D validator.** One host and one antivirus configuration are shared; MO-1307 recorded
heavy-tailed host latency, and 3A's concurrency and timing cases and 3C's filesystem cases would perturb each other. 3A and 3C
are the likeliest to find a product defect, and any product change invalidates 3B, so 3B runs last on the final candidate.

Shared inputs frozen before any stream is authored against them (this step): the candidate identity, the corpus, the case
inventory and receipt schemas, the common campaign library, and this protocol.

| Stream | Platform | Cloud work | Windows work |
|---|---|---|---|
| 3A | Windows 11 x64, pinned Node | pure runner logic, corpus, assertions | all certifying execution; a harness shakedown first |
| 3B | Windows 11 x64, pinned Node | closure auditor, two assemblers, tag verifier (git only) | the certifying run, from git objects |
| 3C | Windows 11 x64, pinned Node | corpus generator, tamper and forgery corpora, SHA-256 harness, canary scanner, static auditors | the certifying run; NTFS-dependent cases |
| 3D | read-only validator | authoring, I3 inventory builder | the post-BF validator run |

Windows-only harness code (junction swapper, process-tree observer, console launcher, Ctrl-C injection, fault-injection
preload) is **not** part of this step. It cannot be exercised in the cloud, which is the main harness risk (the 2D generation 1
failure, MO-1307's 16 attempts): each such harness gets a non-certifying host shakedown and a recorded independent harness
review before its generation is sealed.

## 5. Generation lifecycle and one-shot rules

### 5.1 Seal, run, close

A **generation** has an id (`phase3a`, `phase3a-g2`, …; a rehearsal is `phase3a-rehearsal-r1`), an evidence directory of the
same name, and three phases:

1. **Seal** writes `seal.json`: protocol and status, inventory, candidate identity, corpus manifest, tools, extra inputs, the
   harness review, every step's guard, every case with its mode and mandatory flag, the segment budgets, and the execution rules.
2. **Run**, once per **segment**, in order: a start record, then one record per step. Every bound file is re-hashed before a
   segment starts; a changed tool, inventory, protocol or candidate refuses to run.
3. **Close** fills records for steps never reached or interrupted, derives the stream receipt from the step receipts, and writes
   `evidence-seal.json` over every file. Nothing already written is rewritten (files are created exclusively).

The execution rules, recorded in every seal and enforced by the runner: **run once; no case retry; no warm-up; no adaptive
expansion; no diagnostic promotion; no late-success recovery; stop at the first mandatory failure.** A segment or step that has
a start record can never be started again: a crash leaves the generation to be closed as a failure, never resumed.

### 5.2 Approval gate

A certifying seal needs a protocol status that begins with `APPROVED`, a bound harness review with no open blocking finding, and
(for a rerun) a valid prior failure and disposition. A rehearsal needs none of these.

### 5.3 Evidence placement and naming

Certifying evidence lives at `repositories/cca-conformance/evidence/mo1308/<generation id>/`, rehearsals at the same root under
their own `-rehearsal-rN` id. Evidence is never committed by the shared step and is never edited. Raw logs are kept under the
existing `evidence/mo1308/** -text` rule.

### 5.4 Rehearsals (D4)

A non-certifying host run of the same tooling is a **rehearsal**. Its stream receipt says `certifying: false`, `promotable:
false`; it is preserved; it can never be an input to a certifying generation, to 3D, or to a disposition's "accepted" outcome.
The 3D validator rejects a rehearsal as an accepted receipt.

### 5.5 Reruns

A failed generation is never resumed or promoted. A rerun (`-g2`, `-g3`, …) needs a closed prior generation that ended
`FAILED_PRESERVED` or `ESCALATED_PRESERVED`, and a disposition for it (section 6) whose next action is `NEW_GENERATION` and
whose ordinal is the next one. After an `ESCALATED_PRESERVED` generation (an F7 escalation, section 8.3) the disposition must
also carry an **owner approval reference**, whatever the failure class (A8 decision 5); the sealing refuses otherwise. The seal
records the superseded generation, the prior evidence seal and the disposition by hash.

## 6. Failure classification and dispositions (D5)

Every failure is diagnosed before any rerun and classified, as in MO-1307 Freeze section 21:
`PRODUCT_DEFECT`, `CONTRACT_DEFECT`, `ENVIRONMENT_BLOCKER`, `HARNESS_DEFECT`, `INTERRUPTION`, `HISTORICAL_FAILURE`.
There is no retry-until-pass, no hidden extension, and no migration of a current failure into a historical row.

A **disposition** is a separate record (`MO1308Phase3Disposition`) about a preserved generation: its evidence-seal hash, the
failing steps and cases, the class, whether public behaviour changes, a diagnosis, the next action, and the owner approval
reference. `ownerReviewRequired` is true exactly when the class is `CONTRACT_DEFECT`, or `PRODUCT_DEFECT` with a public-behaviour
change (CCA-ENG-2.0, D5); a new generation after such a disposition needs the owner approval reference. A private-detail
product fix that changes no public behaviour makes a new candidate and a new generation of every affected stream, with the
reason recorded; it does not need an amendment but does need the owner's acceptance of the new candidate (D1).

## 7. Budgets and guards (D3, A8 decision 8)

**Rule.** A correct run must not be able to exceed its budget by design. In every segment, the sum of the step guards plus a
**5-minute reserve** (for the records written between steps) must fit in the segment's normal budget. The inventory validator
enforces this, so an inventory that breaks it cannot be sealed. The extended budget (180 minutes) is for a run that is making
measurable progress and needs a recorded rationale; it is never part of the design arithmetic.

| Stream / segment | Steps (guard, minutes) | Sum | Reserve | Total | Budget |
|---|---|---:|---:|---:|---:|
| 3A `main1` | A 5, B 15, C 8, D 15, E 7 | 50 | 5 | 55 | 90 |
| 3A `main2` | F 25, G 10, H 12, I 5, J 15, K 5, L 5, M 5 | 82 | 5 | 87 | 90 |
| 3A `ceiling` | JC 175 | 175 | 5 | 180 | 180 |
| 3B `main` | A 5, B 10, C 5, D 5, E 15, F 10, G 5 | 55 | 5 | 60 | 90 |
| 3C `main` | A 15, B 5, C 5, D 10, E 8, F 6, G 5, H 8, I 4, J 12 | 78 | 5 | 83 | 90 |
| 3D `main` | D 60, E 15 | 75 | 5 | 80 | 90 |

**What changed.** The Step 1 draft had 3A `main` at 110 guard minutes against a 90-minute budget and 3C at 130. 3A `main` is now
**split into two segments** (`main1`, `main2`) that each fit, rather than shrinking guards below realistic needs: `main1` ends
before the concurrency, swap and interruption cases, `main2` runs only after `main1` finished PASS, and the ceiling segment runs
only after both. 3C had no natural split, so its guards were reduced to 78 minutes (after step K moved to 3D) (the in-process tamper flips, the Monte Carlo
and the differential hashing are the heavy steps and are bounded in the corpus). The J-C ceiling guard is 175 minutes so that
guard plus reserve equals the 180-minute budget.

Each step has a guard; its effective guard is the smaller of the guard and the time left in its segment budget. Expiry is a
failure (`STEP_GUARD_EXPIRED`); a segment that runs out of budget stops the generation (`BUDGET_EXHAUSTED`). Reference-host
timings from the 2D generation 2 characterization at 100,000 entries: export 1000.9 s, verify 92.9 s, append 88.1 s,
verify-export 146.7 s, real-process verify 197.0 s, generation 199.9 s; the ceiling run is the sum of these plus the rejected
append, about 30 to 35 minutes, well inside its guard. The product itself has no timer or deadline (Freeze 9.5); these are campaign
engineering limits.

<!-- GENERATED:BEGIN steps -->
| Stream | Step | Segment | Guard (min) | Cases |
|---|---|---|---:|---|
| 3A | A | main1 | 5 | A1, A2, A3, A4, A5, A6, A7 |
| 3A | B | main1 | 15 | B1, B2, B3, B4, B5, B6, B7, B8, B9, B10 |
| 3A | C | main1 | 8 | C1, C2, C3, C4, C5, C6 |
| 3A | D | main1 | 15 | D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12 |
| 3A | E | main1 | 7 | E1, E2, E3, E4, E5, E6, E7 |
| 3A | F | main2 | 25 | F1, F2, F3, F4, F5, F6, F7 |
| 3A | G | main2 | 10 | G1, G2, G3, G4, G5, G6 |
| 3A | H | main2 | 12 | H1, H2, H3, H4, H5, H6, H7, H8, H9, H10 |
| 3A | I | main2 | 5 | I1, I2, I3, I4, I5, I6 |
| 3A | J | main2 | 15 | J1, J2, J3, J4, J5, J6, J7, J8, J9, J10, J11, J12, J13 |
| 3A | K | main2 | 5 | K1, K2, K3, K4 |
| 3A | L | main2 | 5 | L1, L2, L3, L4, L5, L6 |
| 3A | M | main2 | 5 | M1, M2, M3, M4 |
| 3A | JC | ceiling | 175 | JC1, JC2, JC3, JC4, JC5, JC6, JC7, JC8, JC9, JC10 |
| 3B | A | main | 5 | A1, A2, A3, A4 |
| 3B | B | main | 10 | B1, B2, B3, B4, B5 |
| 3B | C | main | 5 | C1, C2, C3, C4, C5 |
| 3B | D | main | 5 | D1, D2, D3, D4 |
| 3B | E | main | 15 | E1, E2, E3 |
| 3B | F | main | 10 | F1, F2 |
| 3B | G | main | 5 | G1, G2, G3 |
| 3C | A | main | 15 | A1, A2, A3, A4, A5, A6, A7 |
| 3C | B | main | 5 | B1, B2, B3, B4, B5, B6 |
| 3C | C | main | 5 | C1, C2, C3, C4, C5, C6, C7, C8, C9, C10 |
| 3C | D | main | 10 | D1, D2, D3, D4, D5, D6, D7, D8, D9 |
| 3C | E | main | 8 | E1, E2, E3, E4, E5, E6, E7, E8, E9 |
| 3C | F | main | 6 | F1, F2, F3, F4, F5 |
| 3C | G | main | 5 | G1, G2, G3, G4, G5, G6 |
| 3C | H | main | 8 | H1, H2, H3, H4, H5 |
| 3C | I | main | 4 | I1, I2, I3 |
| 3C | J | main | 12 | J1, J2, J3, J4, J5, J6, J7 |
| 3D | D | main | 60 | D1, D2, D3, D4, D5, D6, D7 |
| 3D | E | main | 15 | E1, E2, E3 |
<!-- GENERATED:END steps -->

## 8. Acceptance rules

### 8.1 Case results and modes

A case result is `PASS`, `FAIL`, `ESCALATE` or `NOT_RUN`. A case is in one of two modes.

- **assert**: PASS only if the stated property holds.
- **record**: an observation is recorded against a **pre-registered outcome set** fixed in the sealed tooling; PASS if the
  observed outcome is a member of the set, FAIL if it is outside it or nothing was observed. The qualification cases are record
  cases. A record case never PASSes by recording a violation of an explicit Freeze rule: such an observation is a FAIL and is
  classified, not disclosed away.

A case marked "not mandatory" is recorded but never stops the generation and never affects the stream result; it is listed in
the stream receipt.

### 8.2 Step and stream results

A step is `FAIL` if any mandatory case failed or the step itself failed (guard, exception, unreported cases, interruption);
`ESCALATE` if a mandatory case escalated and none failed; otherwise `PASS`. The first step that is not `PASS` stops the
generation: later steps are `NOT_RUN`.

The stream result of a certifying generation is `ACCEPTED` (every mandatory case PASS, every segment PASS, no step failure),
`ESCALATED_PRESERVED` (a mandatory escalation, no failure) or `FAILED_PRESERVED`. A rehearsal ends `REHEARSAL_COMPLETED` or
`REHEARSAL_FAILED`. The outcome label is `PHASE3<stream>_<result>`.

### 8.3 The staging `EPERM` rule (D6)

A8 accepts Amendment A6's behaviour for v1: a failed exclusive create of a staging file is a typed `IO` failure, not retried,
committing nothing. Case 3A-F7 repeats the F1 workload 10 times and counts the runs in which at least one staging `EPERM`
(the underlying error of the typed `IO` failure) occurred. **At most 1 run: PASS, with the census recorded. Two or more runs:
`ESCALATE`.** Any contract violation in any run (a success missing from the ledger, a phantom commit for a reported failure, an
untyped failure, an integrity or boundary code reported to a reader, an invalid chain) is a `FAIL` regardless of the count.
An escalation stops the generation and ends `ESCALATED_PRESERVED`; a rerun needs an owner approval reference (section 5.5).
Q02 and Q10 stay disclosed, with their actual outcome (section 8.4).

### 8.4 Qualification cases (A8 decision 6)

A **qualification case** is a record case that carries a Qnn tag. It must observe `outcome`: `CONFIRMED` (the limitation behaves as
the register says) or `NOT_CONFIRMED` (the product is better than the register). Both are PASS; any other outcome, or none, is a
FAIL (`QUALIFICATION_OUTCOME_INVALID`). The outcome is stored in the case record and in the stream receipt per qualification.

The release disclosures (case 3D-E3), and the operator guidance (3D-E2), must state **the actual recorded outcome of each
qualification case**: a weakness that was NOT_CONFIRMED is never disclosed as confirmed, and one that was CONFIRMED is never
omitted. The disclosure document states one line per qualification case, `3C-A6: CONFIRMED - …` or `3C-A6: NOT_CONFIRMED - …`,
and `Q01: DISCLOSED - …` for each structural qualification (one that no record case characterizes: Q01, Q09, Q14, Q15). The check
(`lib/disclosure.mjs`) compares those lines with the recorded outcomes in the 3A and 3C step receipts and refuses a mismatch, an
omission, a duplicate, an unknown line, or an outcome that was never recorded. The 3C generation reads the accepted 3A receipt
as an input for this (3A runs first).

## 9. Stream protocols

### 9.1 3A: native Windows CLI campaign (one-shot)

**Objective.** Certify the Node-only H40 store and the CLI on the real host, with assertions independent of the development
suites (which are re-run at 3D as regression, R31).
**Inputs.** Candidate; corpus; A3 precondition receipt; sealed tools; harness review.
**Tooling to build (later steps).** A campaign driver over the shared runner; real-process CLI launcher; junction swapper;
process-tree, handle and socket observer; console, headless and Ctrl-C launchers; a harness-only fault-injection preload
(`node --import`), proven a no-op when disarmed; ceiling generator. All run on Windows only; the cloud authors and rehearses the
pure parts. No PowerShell is used by the product (R37); harness observers may use it.
**Acceptance.** Every mandatory case PASS; section 8.3 for F7; every refusal creates nothing and leaves the sentinel intact; no
production byte changes (M2, JC10).
**Evidence.** Sealed inventory, per-step receipts with raw logs, the F7 filesystem-error census, the ceiling timing table, the
environment capture, the stream receipt. The 200,000-file ceiling ledger and export are not retained: digests and logs only.
**Limits.** Three segments, run in order, each only after the previous one finished PASS: `main1` (steps A–E), `main2` (steps F–M)
and `ceiling` (step JC). Budgets 90, 90 and 180 minutes with the guard arithmetic of section 7; the ceiling has its own clock.
An F7 escalation stops the generation (section 8.3).

<!-- GENERATED:BEGIN inventory-3A -->
Segment `main1`: Main 1: gate, CLI contract, determinism, filesystem boundary, NTFS semantics. Budget 90 min, extended 180 min.

Segment `main2`: Main 2: concurrency, swaps, interruption, purge, limits, resources, transport, after-state. Budget 90 min, extended 180 min.

Segment `ceiling`: J-C ceiling run (its own segment, own clock and hard stop; runs only after main1 and main2 PASS). Budget 180 min, extended 180 min.

#### 3A step A: Gate (segment `main1`, guard 5 min, 7 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-A1 | Host identity: Windows 11 x64 build, NTFS volume type and serial, free space recorded | - | assert | - |
| 3A-A2 | Node.js v24.21.0 win-x64 executable SHA-256 equals ba4e6d11...6c32 | - | assert | - |
| 3A-A3 | Production path tree of the worktree equals the sealed candidate identity blob by blob; worktree clean | R32 | assert | - |
| 3A-A4 | The A3.2 generation 4 receipt (differential CTest gate, BF 1dd1e8c8 versus the corrected candidate f4211c8c) is bound; its receipt.json top-level verdict is PASS for the same candidate | R31 | assert | - |
| 3A-A5 | Sealed tool inventory matches; harness review bound; no rehearsal evidence is referenced as an input | - | assert | - |
| 3A-A6 | Environment capture: AV and Defender state, LongPathsEnabled, 8.3 name setting, unprivileged symlink creation, CPU and disk | - | record | - |
| 3A-A7 | Idle host-load sample before the run (recorded, never gated) | - | record, not mandatory | - |

#### 3A step B: CLI contract through real processes (segment `main1`, guard 15 min, 10 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-B1 | Version 1.2.0 and help: history is listed and the baseline command set is unchanged | R34 | assert | - |
| 3A-B2 | init: success shape, LEDGER_EXISTS, missing parent, invalid name, invalid Workspace | R25 | assert | - |
| 3A-B3 | append succeeds for every record kind through its documented flags (7 kinds; CICD with 6 files and with 4 files) | R25, R36 | assert | - |
| 3A-B4 | Decision claims through the CLI: DECISION_UNBOUND, CONSISTENT and CONTRARY_TO_READINESS | R13 | assert | - |
| 3A-B5 | verify and query: required flags (A2), kind and subject filters, paging, ordering | R22, R25 | assert | - |
| 3A-B6 | tombstone, export and verify-export: result shapes (A4.2, A7) and finishing a purgePending tombstone | R18, R23, R25 | assert | - |
| 3A-B7 | Every section 14.1 code reachable from the CLI: exact code, exit category 1-5, fixed message, human and JSON | R25 | assert | - |
| 3A-B8 | No path, record content, exception message or stack in any failure output on stdout or stderr | R24, R25 | assert | - |
| 3A-B9 | session never serializes or restores a checkpoint; the other command namespaces are unchanged | R30 | assert | - |
| 3A-B10 | SDK and CLI produce byte-identical entries, query results and exports for the same operations | R27 | assert | - |

#### 3A step C: Determinism and layout (segment `main1`, guard 8 min, 6 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-C1 | Twin ledgers built independently (other drive, directory, case, cwd, environment, time zone, code page) are byte-identical | R04 | assert | - |
| 3A-C2 | Equal ledgers export to byte-identical exports; verify and query outputs are identical | R04, R23 | assert | - |
| 3A-C3 | Exact on-disk layout (section 9.1): no head file, segment, seal or extra file | R06 | assert | - |
| 3A-C4 | No timestamp in any MO-1308-authored file or output | R35 | assert | - |
| 3A-C5 | Every ledger has exactly one Workspace; every entry is INTRINSIC or DECLARED | R11, R36 | assert | - |
| 3A-C6 | File-identity audit: no published file changes bytes or NTFS file index across later operations; only purge deletes members | R06 | assert | - |

#### 3A step D: Filesystem boundary (segment `main1`, guard 15 min, 12 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-D1 | Ledger root is a junction or directory symlink: every operation fails FILESYSTEM_BOUNDARY | R17 | assert | - |
| 3A-D2 | An ancestor of the ledger root is a junction or symlink | R17 | assert | - |
| 3A-D3 | entries, records, .pending or a record directory is a junction or symlink; a member is a symlink | R17 | assert | - |
| 3A-D4 | Dangling junction or symlink at any ledger path | R17 | assert | - |
| 3A-D5 | init at or under a link; export --output at or under a link; export --output inside the ledger | R06, R17 | assert | - |
| 3A-D6 | Input file (--record, --identity, --outcome) is a symlink, app-execution alias, directory or reserved device name | R17 | assert | - |
| 3A-D7 | --run directory with extra, missing, foreign or linked members | R17 | assert | - |
| 3A-D8 | Name forms: case-only rename, 8.3 short alias, trailing dot or space, alternate data stream, reserved names | R17 | assert | - |
| 3A-D9 | Path forms: drive letter, forward slash, dot-dot, UNC (observed, not claimed), over-long, and \\?\ and \\.\ refused | R17 | assert | Q15 |
| 3A-D10 | Every refusal creates nothing and leaves every outside sentinel byte-identical | R09, R17 | assert | - |
| 3A-D11 | Read-only attribute and ACL-denied locations give a typed IO failure and change nothing | R17, R25 | assert | - |
| 3A-D12 | Reparse-point survey: every kind that can be planted unprivileged is refused; the others are recorded as not plantable (K11) | R17 | record | - |

#### 3A step E: NTFS semantics (segment `main1`, guard 7 min, 7 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-E1 | Exclusive creation: an existing name in any case is refused and never opened | R15, R17 | assert | - |
| 3A-E2 | A hard link never replaces an existing name, including a case variant | R06, R15 | assert | - |
| 3A-E3 | Published files are hard links with distinct file indexes and identical bytes | R17 | assert | - |
| 3A-E4 | A sharing violation is a typed IO failure that changes nothing; releasing it restores service | R17, R25 | assert | - |
| 3A-E5 | A staging name held open by another process is skipped, never opened or replaced | R15 | assert | - |
| 3A-E6 | Delete-pending staging name probe: EEXIST versus EPERM recorded for A6 hypothesis 2 | - | record | Q02 |
| 3A-E7 | Read-only attribute on a ledger file: reads work, nothing is modified | R06 | assert | - |

#### 3A step F: Concurrency (segment `main2`, guard 25 min, 7 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-F1 | 10 appender processes and 2 readers: every success present exactly once, every absent record had a typed failure, chain valid | R05, R15 | assert | - |
| 3A-F2 | Appenders and tombstoners: one tombstone per target, every purge finished, chain verifies | R18 | assert | - |
| 3A-F3 | Exporters racing appenders: a consistent snapshot or LEDGER_CONFLICT; the export verifies | R23 | assert | - |
| 3A-F4 | verify and query during a purge never report an integrity or boundary code (A5) | R22 | assert | - |
| 3A-F5 | Same-record race: exactly one entry, the rest RECORD_DUPLICATE | R10 | assert | - |
| 3A-F6 | Same-target tombstone race: one wins, the rest TOMBSTONE_INVALID | R18 | assert | - |
| 3A-F7 | F1 repeated 10 times: census of every filesystem error; staging EPERM in more than 1 of 10 runs escalates (owner decision D6) | R15 | record | Q02, Q10 |

#### 3A step G: Directory-swap races (H40) (segment `main2`, guard 10 min, 6 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-G1 | Record directory swapped for a junction during an append | R17 | assert | Q01 |
| 3A-G2 | entries directory swapped at the commit point | R17 | assert | Q01 |
| 3A-G3 | Swap during a tombstone purge | R17, R18 | assert | Q01 |
| 3A-G4 | Swap during export (output directory) and during init | R17, R23 | assert | Q01 |
| 3A-G5 | Ledger root swapped between two reads | R17 | assert | Q01 |
| 3A-G6 | Junction swapper racing three appenders for a fixed number of swaps: sentinel intact; ledger verifies or fails closed typed | R17 | assert | Q01 |

#### 3A step H: Interruption (segment `main2`, guard 12 min, 10 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-H1 | Kill after a member is staged | R16 | assert | - |
| 3A-H2 | Kill after a member is linked, before the entry is staged | R16 | assert | - |
| 3A-H3 | Kill after the entry is staged, before its link | R16 | assert | - |
| 3A-H4 | Kill after the entry link, before the staging name is removed | R16 | assert | - |
| 3A-H5 | Tombstone killed after the commit and before any deletion: purgePending; rerun finishes without a new entry | R16, R18 | assert | - |
| 3A-H6 | Tombstone killed in the middle of deletion | R18 | assert | - |
| 3A-H7 | Export killed before the completion marker: verify-export fails EXPORT_CORRUPT | R23 | assert | - |
| 3A-H8 | init killed midway | R16 | assert | - |
| 3A-H9 | Ctrl-C and Ctrl-Break before the commit point publish nothing | R16 | assert | - |
| 3A-H10 | Closed stdout and stdin during a command | R25 | assert | - |

#### 3A step I: Tombstone and purge on the host (segment `main2`, guard 5 min, 6 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-I1 | Tombstone lifecycle end to end: the chain verifies and purged content is reported PURGED, never verified | R18, R19 | assert | - |
| 3A-I2 | Purge while another process holds a member open: typed IO, purgePending, rerun after release finishes | R18 | assert | - |
| 3A-I3 | Re-supply of purged bytes is RECORD_PURGED | R20 | assert | - |
| 3A-I4 | Export and query after a purge: no member bytes; the record entry and its tombstone are present | R18, R23 | assert | - |
| 3A-I5 | Tombstone rules: the target is a retained RECORD entry; one tombstone per target; none on a tombstone | R18 | assert | - |
| 3A-I6 | Purge-pending state is reported consistently by verify, query and export | R18 | assert | - |

#### 3A step J: Limits (section 14.2) (segment `main2`, guard 15 min, 13 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-J1 | MIP_PACKAGE member: limit-1 and limit are not RESOURCE_LIMIT; limit+1 is (16,777,216) | R26 | assert | - |
| 3A-J2 | INVESTIGATION_CHECKPOINT member (33,554,432) | R26 | assert | - |
| 3A-J3 | POLICY_EVALUATION members (4,060 each) | R26 | assert | - |
| 3A-J4 | REGRESSION_REPORT member (16,777,216) | R26 | assert | - |
| 3A-J5 | CICD_RUN total (49,152) | R26 | assert | - |
| 3A-J6 | READINESS_RESULT member (4,194,304) | R26 | assert | - |
| 3A-J7 | HUMAN_DECISION_CLAIM member (8,192) | R26 | assert | - |
| 3A-J8 | Entry file 16,384 bytes and ledger descriptor 1,024 bytes | R26 | assert | - |
| 3A-J9 | Subjects per entry: 16 accepted, 17 rejected | R26 | assert | - |
| 3A-J10 | Query page: 1 and 1,000 accepted; 0 and 1,001 are QUERY_INVALID | R22, R26 | assert | - |
| 3A-J11 | CLI JSON stdout cap of 4,194,304 bytes | R26 | assert | - |
| 3A-J12 | Checkpoint transitions: 10,000 accepted and 10,001 refused; admission is linear (A4.5) | R26 | assert | - |
| 3A-J13 | Staging and unreferenced artifact reports list the first 1,000 sorted with an exact count | R26 | assert | - |

#### 3A step K: Resources and process (segment `main2`, guard 5 min, 4 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-K1 | No product operation creates a child process, PowerShell included | R37 | assert | - |
| 3A-K2 | No network socket and no name resolution | - | assert | - |
| 3A-K3 | Memory and handle census per operation recorded; no handle remains open after exit | - | record | - |
| 3A-K4 | No staging, temporary or lock residue after successful operations; anomalies disclosed only after interruptions | R16 | assert | - |

#### 3A step L: Output transport and host variance (segment `main2`, guard 5 min, 6 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-L1 | Console code pages 437 and 65001 give identical bytes | R04, R25 | assert | - |
| 3A-L2 | stdout to console, pipe, file and a headless launch: identical bytes and exit codes | R25 | assert | - |
| 3A-L3 | Closed pipe (EPIPE) and slow reader on large output: no partial publication, typed outcome | R25 | assert | - |
| 3A-L4 | Time zone and system clock changes do not change any byte | R04, R35 | assert | - |
| 3A-L5 | Working directory, drive and relative versus absolute path variance | R04, R17 | assert | - |
| 3A-L6 | Hostile NODE_OPTIONS and environment variables: behavior recorded | - | record | - |

#### 3A step M: After-state (segment `main2`, guard 5 min, 4 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-M1 | Every ledger created by the campaign verifies, or is a recorded intentional corruption | R05 | assert | - |
| 3A-M2 | Production path blobs unchanged: the candidate identity is re-verified | R32 | assert | - |
| 3A-M3 | Evidence inventory sealed; every raw log hashed | - | assert | - |
| 3A-M4 | Nothing was created outside the campaign work root; junction targets are intact | R06 | assert | - |

#### 3A step JC: J-C ceiling run (100,000 entries) (segment `ceiling`, guard 175 min, 10 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3A-JC1 | Generate 99,999 chain-valid entries with members (time recorded) | R26 | record | - |
| 3A-JC2 | Query page of 1,000 | R26 | record | - |
| 3A-JC3 | Query with a subject filter across the whole ledger | R26 | record | - |
| 3A-JC4 | verify of 99,999 entries (real SDK) | R26 | assert | - |
| 3A-JC5 | Append of the 100,000th entry (real MIP admission) succeeds | R26 | assert | - |
| 3A-JC6 | Export of 100,000 entries completes, marker last; time recorded (reference host 1000.9 s) | R23, R26 | record | Q11 |
| 3A-JC7 | verify-export of that export | R23 | assert | - |
| 3A-JC8 | Real-process memoryos history verify at the ceiling | R26 | record | - |
| 3A-JC9 | The 100,001st append is refused with RESOURCE_LIMIT and changes nothing | R26 | assert | - |
| 3A-JC10 | Post-ceiling after-state: production blobs unchanged; no residue outside the work root; ceiling data not retained (digests and logs only) | R06, R32 | assert | - |
<!-- GENERATED:END inventory-3A -->

### 9.2 3B: closure and supply audit (one-shot)

**Objective.** Prove R32, R33, R28 and R29 on the candidate. No package is produced, so there is no archive certification, no
SBOM (D9) and no package identity: the identity is the closure manifest digest.
**Inputs.** Candidate; the repository's released tags; the allowed path set (section 15).
**Tooling to build (later steps).** A git-only closure auditor; two independently implemented closure assemblers; a tag
verifier; an offline extraction smoke runner. Cloud-authorable and cloud-runnable (git objects only); the certifying run is on
Windows, reading git objects, never the working tree. The tags are not in a fresh clone and must be fetched.
**Acceptance.** All cases PASS with two byte-identical assemblies and no path or dependency deviation.
**Evidence.** The closure manifest and digest, both assemblers' outputs, the tag-versus-HEAD blob table, the import-closure
listing, the receipt.
**Limits.** `main` 90 min (guards total 55 plus the reserve); expected to take well under 15.

<!-- GENERATED:BEGIN inventory-3B -->
Segment `main`: Main audit. Budget 90 min, extended 180 min.

#### 3B step A: Lineage and path allowlist (segment `main`, guard 5 min, 4 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3B-A1 | Candidate identity verified from git objects: commit, tree, production path set and blobs | R32 | assert | - |
| 3B-A2 | History from the Freeze approval to the candidate has normal parents only (no rewrite); Amendments A1-A7 intact and ordered | - | assert | - |
| 3B-A3 | Every path changed since BF 1dd1e8c8 lies inside the allowed path set of the protocol; any other path is a finding | R32, R33 | assert | - |
| 3B-A4 | No released document, package, evidence or tag byte changed except append-only records | R32 | assert | - |

#### 3B step B: Released closure identity (segment `main`, guard 10 min, 5 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3B-B1 | The four vendored memoryos-sdk.js copies equal their release bytes (3d476156...) | R32 | assert | - |
| 3B-B2 | MO-1302 Action bundle: every file equals its tag blob and its released manifest | R32 | assert | - |
| 3B-B3 | MO-1303 VSIX, MO-1304 MCP, MO-1305 REST and MO-1306 CI vendored closures equal their tag blobs | R32 | assert | - |
| 3B-B4 | MO-1307 readiness package: 89 members and the archive identity of its release record | R32 | assert | - |
| 3B-B5 | Every memoryos-1.3-* tag object exists, peels to its recorded commit and is unmodified | R32 | assert | - |

#### 3B step C: Dependency audit (segment `main`, guard 5 min, 5 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3B-C1 | package.json files, lockfiles and vcpkg.json: no dependency added or changed; only the 1.2.0 version fields differ | R33, R34 | assert | - |
| 3B-C2 | Static import scan of the CLI and SDK closures: only node:fs, node:path and repository-relative imports | R33 | assert | - |
| 3B-C3 | The history modules import no node module, SDK, Core, filesystem or network module | R28 | assert | - |
| 3B-C4 | The history authority and SDK facade perform no I/O: forbidden-identifier scan and runtime proof | R29 | assert | - |
| 3B-C5 | No new third-party code: LICENSE and notices unchanged; hand-written cryptography listed as first-party | R33 | assert | Q09 |

#### 3B step D: Source closure (segment `main`, guard 5 min, 4 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3B-D1 | Closure of memoryos-cli/bin/memoryos.js with blob ids; the static scan equals the set Node loads | R33 | assert | - |
| 3B-D2 | Closure of memoryos-sdk.js with blob ids; the static scan equals the set Node loads | R33 | assert | - |
| 3B-D3 | The production closure is exactly the candidate identity path set | R32 | assert | - |
| 3B-D4 | Closure manifest digest recorded | - | assert | - |

#### 3B step E: Reproducibility (segment `main`, guard 15 min, 3 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3B-E1 | Two independently implemented assemblies produce identical closure manifests | R32 | assert | - |
| 3B-E2 | Assemblies in two clean worktrees (autocrlf true and false) agree | R32 | assert | - |
| 3B-E3 | Deterministic archive of the closure is byte-identical across both assemblies | - | assert | - |

#### 3B step F: Offline smoke (segment `main`, guard 10 min, 2 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3B-F1 | Extract the closure to an empty directory with only the pinned Node and no network: init, append, verify, query, export, verify-export succeed | R33 | assert | - |
| 3B-F2 | Output bytes equal the in-tree run | R04 | assert | - |

#### 3B step G: Provenance (segment `main`, guard 5 min, 3 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3B-G1 | Toolchain provenance recorded: Node, git and Python versions and hashes | - | assert | - |
| 3B-G2 | No network access and no package installation during the audit | R33 | assert | - |
| 3B-G3 | Closure manifest and license statement: all first-party; no SBOM (owner decision D9) | R33 | assert | - |
<!-- GENERATED:END inventory-3B -->

### 9.3 3C: security and integrity (one-shot)

**Objective.** Show that integrity failures fail closed, that forgery is limited to the claims actually made (integrity only,
H07), that the authority, privacy and data-class rules hold, and that every v1 qualification of section 11 is confirmed or
refuted by test.
**Inputs.** Candidate; corpus; sealed tools; the recorded independent SHA-256 review (3C-D9); the accepted 3A stream receipt (for
the disclosure check of 3D-E2 and K3).
**Tooling to build (later steps).** Tamper and forgery corpus generator; oracle comparator; SHA-256 differential harness
(FIPS 180-4 example vectors, the CAVP Monte Carlo procedure and a differential against `node:crypto`; **official CAVP response
files are not used** and every disclosure says so, per A8 decision 1); canary scanner; dependency-free
static auditors. Mostly cloud-authorable and rehearsable; NTFS-dependent cases (hard links, staging remnants, links in exports)
and the certifying run need Windows.
**Acceptance.** No success on any tampered input; every failure typed; zero canary leaks outside retained producer member
bytes; every forgery limit matches the disclosed limits; section 8.4 for the qualifications.
**Evidence.** Per-step receipts; the corpus manifest digests; oracle logs; the canary map and scan result; the audit listings.
**Limits.** `main` 90 min (guards total 81 plus the reserve, section 7). Exhaustive flips are in-process.

<!-- GENERATED:BEGIN inventory-3C -->
Segment `main`: Main audit. Budget 90 min, extended 180 min.

#### 3C step A: Tamper (segment `main`, guard 15 min, 7 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-A1 | Exhaustive single-byte flips of the descriptor: every flip fails closed, typed, exit category 3 | R21 | assert | - |
| 3C-A2 | Exhaustive single-byte flips of every entry file | R21 | assert | - |
| 3C-A3 | Strided single-byte flips of every retained member | R21 | assert | - |
| 3C-A4 | CLI-level sample of flips through real processes (fixed count and seed) | R21, R25 | assert | - |
| 3C-A5 | Structural tamper: deletion, reordering, gap, extra file, duplicate index, foreign-ledger splice, descriptor substitution | R05, R21 | assert | - |
| 3C-A6 | Tail truncation and rollback to an older valid prefix: outcome recorded against the pre-registered set | R05 | record | Q03 |
| 3C-A7 | query on a tampered chain fails closed before answering; results are sorted by index | R22 | assert | - |

#### 3C step B: Shape and forgery (segment `main`, guard 5 min, 6 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-B1 | Closed-shape and version negatives on every stored structure: unknown member, kind and version | R01 | assert | - |
| 3C-B2 | Golden-vector reaffirmation: corpus ledgers recomputed by an independent implementation equal the corpus manifest heads | R02, R04 | assert | - |
| 3C-B3 | A fully self-consistent forged chain verifies (integrity only, H07): outcome recorded | - | record | Q13 |
| 3C-B4 | A substituted retained member with a valid self-hash fails RECORD_BYTES_MISMATCH | R21 | assert | - |
| 3C-B5 | A forged admission field, or an entry whose bytes would fail admission, still verifies (no re-admission): recorded | - | record | Q08 |
| 3C-B6 | recordDigest and member-list mismatches; an entry from another ledger at the same index | R21 | assert | - |

#### 3C step C: Admission matrix (segment `main`, guard 5 min, 10 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-C1 | MIP_PACKAGE: valid, forged, stale, wrong Workspace, wrong members, oversized, duplicate, purged | R07 | assert | - |
| 3C-C2 | INVESTIGATION_CHECKPOINT including a native checkpoint and a forged log or prefix digest | R07, R12 | assert | - |
| 3C-C3 | POLICY_EVALUATION matrix | R07 | assert | - |
| 3C-C4 | REGRESSION_REPORT matrix | R07 | assert | - |
| 3C-C5 | CICD_RUN matrix: 6 files, 4 files, missing marker, wrong cardinality, bad manifest | R07 | assert | - |
| 3C-C6 | READINESS_RESULT matrix | R07 | assert | - |
| 3C-C7 | HUMAN_DECISION_CLAIM matrix: unbound, wrong digests, purged result, consistency label | R07, R13 | assert | - |
| 3C-C8 | Every rejection created no entry and changed no file | R09 | assert | - |
| 3C-C9 | Duplicate, Workspace-mismatch and purged re-supply rules; one Workspace per ledger | R10, R11, R20, R36 | assert | - |
| 3C-C10 | Known limits demonstrated: Policy admission is inspection-only; Readiness admission is self-digests only | - | record | Q12 |

#### 3C step D: Incremental and hand-written SHA-256 (segment `main`, guard 10 min, 9 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-D1 | FIPS 180-4 example vectors (empty, abc, 448-bit, 896-bit, one million a) on both hand-written implementations; official CAVP response files are not used | R02 | assert | Q09 |
| 3C-D2 | CAVP Monte Carlo procedure (100 x 1000 iterations) computed on both implementations and against node:crypto; official CAVP response files are not used | R02 | assert | Q09 |
| 3C-D3 | Lengths 0-300, block-boundary lengths and 1,000 seeded random messages and splits: Sha256Stream equals node:crypto | R02 | assert | Q09 |
| 3C-D4 | clone independence, repeatable hex(), update after hex() | R02 | assert | Q09 |
| 3C-D5 | Differential against node:crypto up to 32 MiB with misaligned chunking | R02 | assert | Q09 |
| 3C-D6 | Checkpoint admission equals the verbatim legacy algorithm at 2, 5, 64, 500, 2,500 and 10,000 transitions: accept or reject, code, stage, subjects | R02, R26 | assert | Q09 |
| 3C-D7 | A forged deepest prefix digest is rejected identically; 10,001 transitions are refused | R26 | assert | Q09 |
| 3C-D8 | The mip-canonical.js hand-written SHA-256 under D1-D5 | R02 | assert | Q09 |
| 3C-D9 | A recorded independent sub-agent review of both implementations is bound; every finding has a disposition (owner decision D8) | - | assert | Q09 |

#### 3C step E: Tombstone and purge (segment `main`, guard 8 min, 9 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-E1 | Governance: closed reason list; authority reference 1-256 printable ASCII; anything else is rejected | R18 | assert | - |
| 3C-E2 | Tombstone authenticity is NOT_VERIFIED_BY_MEMORYOS and the authority reference is never validated or fetched | R18 | assert | - |
| 3C-E3 | Crash during purge: purgePending; a rerun finishes; the chain stays valid | R16, R18 | assert | - |
| 3C-E4 | Re-supply of purged bytes is refused for every record kind | R20 | assert | - |
| 3C-E5 | Purge removes exactly the target record members and nothing else | R06, R19 | assert | - |
| 3C-E6 | Staging remnant probe: after a kill between member link and staging removal, are the purged bytes still reachable through the staging name | - | record | Q04 |
| 3C-E7 | Surviving digests, sizes and subjects after a purge: what remains in entries and exports | - | record | Q05 |
| 3C-E8 | An export taken before a tombstone retains the bytes | - | record | Q07 |
| 3C-E9 | Authority reference permanence and its free-text content | - | record | Q06 |

#### 3C step F: Export integrity (segment `main`, guard 6 min, 5 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-F1 | Export tamper corpus: manifest, marker, content, missing, extra and reordered files | R23 | assert | - |
| 3C-F2 | Hostile paths in verifyHistoryExport files: traversal, absolute, backslash, alternate data stream, reserved name, case duplicate | R23 | assert | - |
| 3C-F3 | A link or junction inside an export directory | R17, R23 | assert | - |
| 3C-F4 | export --output inside or under the ledger directory | R06 | assert | - |
| 3C-F5 | Exports of equal ledgers are byte-identical; the marker is created last | R23 | assert | - |

#### 3C step G: Human-authority separation (segment `main`, guard 5 min, 6 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-G1 | Static: no MO-1307 gate, readiness code or CI package imports the history authority | R14 | assert | - |
| 3C-G2 | Runtime: a ledger directory does not alter any MO-1307 result | R14 | assert | - |
| 3C-G3 | No approve, grant or accept semantics in any history surface, exit code or output | R14 | assert | - |
| 3C-G4 | decisionConsistency is documented and rendered as informational only | R13, R14 | assert | - |
| 3C-G5 | verifyReadiness and windows-inspect.ps1 are never called by admission | R08 | assert | - |
| 3C-G6 | Audit of restore callers: no history operation restores an investigation | R12 | assert | - |

#### 3C step H: Data-class audit (segment `main`, guard 8 min, 5 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-H1 | Canary planting: user, host, environment value, path, cwd, file name, date string and URL in the environment and inputs | R24 | assert | - |
| 3C-H2 | Scan of every MO-1308-authored byte (descriptor, entries, verification, query, export, marker) for canaries and forbidden classes | R24 | assert | - |
| 3C-H3 | Scan of every failure output (stdout, stderr, JSON errors) | R24, R25 | assert | - |
| 3C-H4 | Authority reference and subject values: the only free-form content; recorded | R24 | record | - |
| 3C-H5 | No timestamp-like value in MO-1308-authored bytes | R35 | assert | - |

#### 3C step I: Process, network and environment boundaries (segment `main`, guard 4 min, 3 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-I1 | Static forbidden-API scan: child_process, net, http, https, dns, eval, Function, dynamic import, undeclared environment reads | R28, R37 | assert | - |
| 3C-I2 | Runtime sample: no process creation and no socket during a representative operation set | R37 | assert | - |
| 3C-I3 | Environment-variable read whitelist; a secret canary is never exposed | R24 | assert | - |

#### 3C step J: Hostile inputs (segment `main`, guard 12 min, 7 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3C-J1 | Deeply nested and wide JSON members | R26 | assert | - |
| 3C-J2 | Large counts, huge numbers, duplicate keys and malformed UTF-8 | R26 | assert | - |
| 3C-J3 | A 10,000-transition checkpoint (the maximum) | R26 | assert | - |
| 3C-J4 | 10,001 transitions are refused | R26 | assert | - |
| 3C-J5 | Hostile MIP packages: corrupt, oversized sections, bad digests | R07 | assert | - |
| 3C-J6 | A valid maximal 32 MiB checkpoint member | R26 | assert | - |
| 3C-J7 | Every hostile input ends within a fixed guard with a typed outcome; no crash and no INTERNAL | R25 | assert | - |
<!-- GENERATED:END inventory-3C -->

### 9.4 3D: final integration (validator run)

**Objective.** Integrate the accepted 3A, 3B and 3C evidence and every failed attempt and disposition; prove the requirement
matrix is complete; bind I3 and a binding-only BF; prepare the human tag review for `memoryos-1.3-mo1308`.
**Release-claim and disclosure review (step E, moved here from 3C by an owner decision of 2026-10-06).** Cases 3D-E1 to E3 (formerly step K of 3C) run after the validator step, because only here are all case outcomes known: the documents claim nothing beyond the Freeze, the D7 operator guidance states the recorded outcome of 3C-A6, and the disclosures state every recorded qualification outcome. Step guards: D 60 + E 15 + 5 reserve = 80 of 90 minutes.
**Tooling to build (later step).** A read-only `validate-final.mjs` in the manner of MO-1307's: it recomputes every claim from
immutable inputs, executes no product, writes nothing; cloud-authorable, run on the host after BF.
**Acceptance.** Every case PASS; rehearsals are rejected as accepted inputs; no tag, push or approval is created.
**Evidence.** The I3 inventory, the BF binding record, the validator output.

<!-- GENERATED:BEGIN inventory-3D -->
Segment `main`: Validator run. Budget 90 min, extended 180 min.

#### 3D step D: Final integration validator (segment `main`, guard 60 min, 7 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3D-D1 | Lineage and production-tree identity: the candidate and every evidence commit leave the production path set byte-identical | R32 | assert | - |
| 3D-D2 | Accepted 3A, 3B and 3C receipts, every preserved failed generation, rehearsal and disposition are present and bound | - | assert | - |
| 3D-D3 | Requirement matrix: every R01-R37 maps to at least one case with PASS in an accepted generation | - | assert | - |
| 3D-D4 | Retained full regression: MO-1308 suites, CLI, studio, MO-1307 (639) and examples | R03, R31 | assert | - |
| 3D-D5 | The A3.2 generation 4 receipt (differential CTest gate) is bound: receipt.json top-level verdict is PASS, and cca.workspace.verify passes on the candidate | R31 | assert | - |
| 3D-D6 | Qualification register Q01-Q15 is complete with a disposition for each | - | assert | - |
| 3D-D7 | I3 plus a binding-only BF with no self-reference; no tag, push or approval in this task | - | assert | - |

#### 3D step E: Release-claim and disclosure review (segment `main`, guard 15 min, 3 cases)

| Case | What is established | Requirements | Mode | Qualifications |
|---|---|---|---|---|
| 3D-E1 | README, ROADMAP, RELEASE_NOTES, KNOWN_ISSUES, ARCHITECTURE and the CLI docs claim nothing beyond the Freeze; the qualification register is present | - | assert | - |
| 3D-E2 | Operator guidance (record each export and verify headDigest externally as the rollback anchor, D7) is present and states the recorded outcome of 3C-A6 | - | assert | Q03 |
| 3D-E3 | Release disclosures state the actual recorded outcome of every qualification case (none NOT_CONFIRMED disclosed as confirmed, none CONFIRMED omitted) and DISCLOSED for the structural qualifications | - | assert | Q01, Q02, Q13, Q14, Q15 |
<!-- GENERATED:END inventory-3D -->

## 10. Requirement matrix

Every Freeze section 17 requirement maps to at least one case; the validator (3D-D3) requires a PASS in an accepted generation
for each.

<!-- GENERATED:BEGIN matrix -->
| Requirement | Streams | Cases |
|---|---|---|
| MO1308-R01 | 3C | 3C-B1 |
| MO1308-R02 | 3C | 3C-B2, 3C-D1, 3C-D2, 3C-D3, 3C-D4, 3C-D5, 3C-D6, 3C-D8 |
| MO1308-R03 | 3D | 3D-D4 |
| MO1308-R04 | 3A, 3B, 3C | 3A-C1, 3A-C2, 3A-L1, 3A-L4, 3A-L5, 3B-F2, 3C-B2 |
| MO1308-R05 | 3A, 3C | 3A-F1, 3A-M1, 3C-A5, 3C-A6 |
| MO1308-R06 | 3A, 3C | 3A-C3, 3A-C6, 3A-D5, 3A-E2, 3A-E7, 3A-JC10, 3A-M4, 3C-E5, 3C-F4 |
| MO1308-R07 | 3C | 3C-C1, 3C-C2, 3C-C3, 3C-C4, 3C-C5, 3C-C6, 3C-C7, 3C-J5 |
| MO1308-R08 | 3C | 3C-G5 |
| MO1308-R09 | 3A, 3C | 3A-D10, 3C-C8 |
| MO1308-R10 | 3A, 3C | 3A-F5, 3C-C9 |
| MO1308-R11 | 3A, 3C | 3A-C5, 3C-C9 |
| MO1308-R12 | 3C | 3C-C2, 3C-G6 |
| MO1308-R13 | 3A, 3C | 3A-B4, 3C-C7, 3C-G4 |
| MO1308-R14 | 3C | 3C-G1, 3C-G2, 3C-G3, 3C-G4 |
| MO1308-R15 | 3A | 3A-E1, 3A-E2, 3A-E5, 3A-F1, 3A-F7 |
| MO1308-R16 | 3A, 3C | 3A-H1, 3A-H2, 3A-H3, 3A-H4, 3A-H5, 3A-H8, 3A-H9, 3A-K4, 3C-E3 |
| MO1308-R17 | 3A, 3C | 3A-D1, 3A-D10, 3A-D11, 3A-D12, 3A-D2, 3A-D3, 3A-D4, 3A-D5, 3A-D6, 3A-D7, 3A-D8, 3A-D9, 3A-E1, 3A-E3, 3A-E4, 3A-G1, 3A-G2, 3A-G3, 3A-G4, 3A-G5, 3A-G6, 3A-L5, 3C-F3 |
| MO1308-R18 | 3A, 3C | 3A-B6, 3A-F2, 3A-F6, 3A-G3, 3A-H5, 3A-H6, 3A-I1, 3A-I2, 3A-I4, 3A-I5, 3A-I6, 3C-E1, 3C-E2, 3C-E3 |
| MO1308-R19 | 3A, 3C | 3A-I1, 3C-E5 |
| MO1308-R20 | 3A, 3C | 3A-I3, 3C-C9, 3C-E4 |
| MO1308-R21 | 3C | 3C-A1, 3C-A2, 3C-A3, 3C-A4, 3C-A5, 3C-B4, 3C-B6 |
| MO1308-R22 | 3A, 3C | 3A-B5, 3A-F4, 3A-J10, 3C-A7 |
| MO1308-R23 | 3A, 3C | 3A-B6, 3A-C2, 3A-F3, 3A-G4, 3A-H7, 3A-I4, 3A-JC6, 3A-JC7, 3C-F1, 3C-F2, 3C-F3, 3C-F5 |
| MO1308-R24 | 3A, 3C | 3A-B8, 3C-H1, 3C-H2, 3C-H3, 3C-H4, 3C-I3 |
| MO1308-R25 | 3A, 3C | 3A-B2, 3A-B3, 3A-B5, 3A-B6, 3A-B7, 3A-B8, 3A-D11, 3A-E4, 3A-H10, 3A-L1, 3A-L2, 3A-L3, 3C-A4, 3C-H3, 3C-J7 |
| MO1308-R26 | 3A, 3C | 3A-J1, 3A-J10, 3A-J11, 3A-J12, 3A-J13, 3A-J2, 3A-J3, 3A-J4, 3A-J5, 3A-J6, 3A-J7, 3A-J8, 3A-J9, 3A-JC1, 3A-JC2, 3A-JC3, 3A-JC4, 3A-JC5, 3A-JC6, 3A-JC8, 3A-JC9, 3C-D6, 3C-D7, 3C-J1, 3C-J2, 3C-J3, 3C-J4, 3C-J6 |
| MO1308-R27 | 3A | 3A-B10 |
| MO1308-R28 | 3B, 3C | 3B-C3, 3C-I1 |
| MO1308-R29 | 3B | 3B-C4 |
| MO1308-R30 | 3A | 3A-B9 |
| MO1308-R31 | 3A, 3D | 3A-A4, 3D-D4, 3D-D5 |
| MO1308-R32 | 3A, 3B, 3D | 3A-A3, 3A-JC10, 3A-M2, 3B-A1, 3B-A3, 3B-A4, 3B-B1, 3B-B2, 3B-B3, 3B-B4, 3B-B5, 3B-D3, 3B-E1, 3B-E2, 3D-D1 |
| MO1308-R33 | 3B | 3B-A3, 3B-C1, 3B-C2, 3B-C5, 3B-D1, 3B-D2, 3B-F1, 3B-G2, 3B-G3 |
| MO1308-R34 | 3A, 3B | 3A-B1, 3B-C1 |
| MO1308-R35 | 3A, 3C | 3A-C4, 3A-L4, 3C-H5 |
| MO1308-R36 | 3A, 3C | 3A-B3, 3A-C5, 3C-C9 |
| MO1308-R37 | 3A, 3C | 3A-K1, 3C-I1, 3C-I2 |
<!-- GENERATED:END matrix -->

## 11. Qualification register (D7, D8, D10)

These are v1 qualifications, disclosed in every Phase 3 certification claim. A qualification is a recorded property of the
shipped behavior, not an unresolved defect. Changing the product to remove one needs a Freeze amendment.

<!-- GENERATED:BEGIN qualifications -->
| ID | Qualification | Characterized by |
|---|---|---|
| Q01 | H40: Node-only store; a directory swap is detected after the fact, never prevented. Local single-user v1 only; re-review before any multi-user, shared-storage or cloud use, including MO-1309. | 3A-G1, 3A-G2, 3A-G3, 3A-G4, 3A-G5, 3A-G6, 3D-E3 |
| Q02 | A6: a failed exclusive create of a staging file is a typed IO failure, never retried; two hypotheses (transient lock, delete-pending) remain unconfirmed. Re-reviewed with H40. | 3A-E6, 3A-F7, 3D-E3 |
| Q03 | Tail truncation and rollback to an older valid prefix are not detectable without an external head anchor. Operators record each export and verify headDigest externally. | 3C-A6, 3D-E2 |
| Q04 | Purge removes record member names; a staging name left by an interrupted append may still hold the same bytes (to be characterized by 3C-E6). | 3C-E6 |
| Q05 | After a purge the entry keeps recordDigest, member names, lengths and digests, and subjects; a digest can confirm a guess for small low-entropy content. | 3C-E7 |
| Q06 | The tombstone authority reference is operator-chosen free text and is permanent. | 3C-E9 |
| Q07 | An export taken before a tombstone keeps the bytes; there is no import and no recall. | 3C-E8 |
| Q08 | verify does not re-run admission; an entry written by a party with filesystem access verifies if the chain and member digests are consistent. | 3C-B5 |
| Q09 | The incremental SHA-256 (and the canonical module copy) is hand-written first-party code, verified by FIPS 180-4 example messages, the CAVP Monte Carlo procedure computed against node:crypto, differential tests and a recorded independent review. Official CAVP response files were not used. | 3B-C5, 3C-D1, 3C-D2, 3C-D3, 3C-D4, 3C-D5, 3C-D6, 3C-D7, 3C-D8, 3C-D9 |
| Q10 | Host latency under antivirus and indexers is heavy-tailed; recorded as an environment qualification, not a bound. | 3A-F7 |
| Q11 | A 100,000-entry export takes about 16 minutes on the reference host; recorded as a MO-1309 performance follow-up, not a defect. | 3A-JC6 |
| Q12 | A4.4: POLICY_EVALUATION admission is inspection-only; READINESS_RESULT admission is not a MO-1307 verification. | 3C-C10 |
| Q13 | Integrity only: no signatures, no authenticity, no encryption; access control is the operator filesystem responsibility (H07, H08). | 3C-B3, 3D-E3 |
| Q14 | Certification claims native Windows 11 x64 only (H45). | 3D-E3 |
| Q15 | UNC, network, OneDrive and cloud-placeholder locations are observed, not claimed. | 3A-D9, 3D-E3 |
<!-- GENERATED:END qualifications -->

**Operator guidance required by D7 (documentation, not a CLI behavior change).** The CLI README and the release notes must say,
in substance: "Record the `headDigest` printed by every `memoryos history verify` and `memoryos history export` run, and the one
in each export manifest, in a system outside the ledger directory. Comparing a later `headDigest` and `entryCount` with the
recorded ones is the only way to detect that the newest entries were removed or that an older valid copy of the ledger was
restored." Case 3D-E2 checks that this guidance is present and states the recorded outcome of 3C-A6 (section 8.4): if the rollback weakness
was NOT_CONFIRMED the guidance must not describe it as present, and if CONFIRMED it must. Because it lives in `repositories/memoryos-cli/README.md` and
`docs/`, it is outside the candidate production path set.

## 12. Receipt schemas

All Phase 3 records are stable JSON: keys sorted by UTF-16 code unit, two-space indentation, one trailing LF, safe integers only
(times in whole milliseconds), closed shapes (every member required, none extra). They are conformance evidence, not
MO-1308-authored product bytes. Hashes of files are bare 64-digit hex; `sha256:`-prefixed values are digests of canonical
structures. The shapes are implemented in `tools/mo1308-phase3/lib/receipts.mjs`.

| Kind | Members |
|---|---|
| `MO1308Phase3Seal` | `kind`, `version`, `stream`, `generation {id, ordinal, supersedes}`, `certifying`, `protocol {path, sha256, status}`, `inventory {path, sha256}`, `candidate {identityPath, identitySha256, baseCommit, productionTreeDigest}`, `corpus`, `harnessReview`, `tools[]`, `inputs[]`, `segments[] {id, budgetMs, extended, steps}`, `steps[] {id, segment, guardMs, cases[] {id, mandatory, mode}}`, `execution` (the rules of section 5.1), `sealedAt` |
| `MO1308Phase3SegmentStart` / `SegmentFinish` | `kind`, `version`, `stream`, `generation`, `segment`, then `startedAt`, `budgetMs`, `sealSha256` / `result`, `reason`, `finishedAt`, `elapsedMs` |
| `MO1308Phase3StepStart` | `kind`, `version`, `stream`, `generation`, `step`, `segment`, `startedAt`, `guardMs`, `effectiveGuardMs` |
| `MO1308Phase3StepReceipt` | `kind`, `version`, `stream`, `generation`, `step`, `segment`, `result`, `failureCode`, `startedAt`, `finishedAt`, `elapsedMs`, `cases[] {id, result, mode, mandatory, elapsedMs, escalation, observed, failure {name, code, message}}`; `observed` is at most 65,536 bytes |
| `MO1308Phase3GenerationStopped` | `kind`, `version`, `stream`, `generation`, `segment`, `step`, `reason`, `stoppedAt` |
| `MO1308Phase3StreamReceipt` | `kind`, `version`, `stream`, `generation`, `certifying`, `promotable`, `result`, `outcome`, `sealSha256`, `segments[]`, `steps[] {id, result, receiptSha256}`, `counts`, `mandatoryNotPassed[]`, `nonMandatoryNotPassed[]`, `qualifications[] {id, cases[]}`, `finishedAt` |
| `MO1308Phase3EvidenceSeal` | `kind`, `version`, `stream`, `generation`, `files[] {path, byteLength, sha256}` (every other file), `rootDigest` |
| `MO1308Phase3Disposition` | `kind`, `version`, `stream`, `generation`, `evidenceSealSha256`, `subjects[] {step, caseId}`, `class`, `publicBehaviourChange`, `diagnosis`, `nextAction`, `ownerReviewRequired`, `ownerApprovalReference`, `rerunOrdinal` |
| `MO1308Phase3Review` | `kind`, `version`, `subject[]` (files reviewed, by hash), `reviewer {role, identity}`, `scope`, `findings[] {id, severity, summary, disposition, note}`, `conclusion`, `reviewedAt` |
| `MO1308Phase3CandidateIdentity` | `kind`, `version`, `baseCommit`, `baseTree`, `rules`, `builtins`, `productionPaths[] {path, mode, blob}`, `productionTreeDigest` |
| `MO1308Phase3CorpusManifest` | `kind`, `version`, `corpusId`, `workspaceIdentifier`, `records[]`, `limitVectors[]`, `recipes[]`, `seeds`, `canaries`, `runtimeCanarySources`, `plans`, `limits`, `corpusDigest` |

Evidence layout of a generation: `seal.json`; `segments/<segment>-start.json`, `segments/<segment>-finish.json`;
`steps/<step>-start.json`, `steps/<step>.json`; `generation-stopped.json` (only when stopped); `stream-receipt.json`;
`evidence-seal.json`; and the raw logs and artifacts each stream's harness adds under its own subdirectories.

## 13. Shared tooling and corpus delivered by the shared step

| Path (under `repositories/cca-conformance/`) | Purpose |
|---|---|
| `mo1308-phase3-inventory.json` | the case inventory (generated from `tools/mo1308-phase3/lib/inventory-source.mjs`) |
| `mo1308-phase3-candidate-identity.json` | the candidate identity at the corrected head `f4211c8c` |
| `mo1308-phase3-corpus-manifest.json` | the sealed corpus manifest |
| `tools/mo1308-phase3/candidate-identity.mjs`, `lib/candidate.mjs`, `lib/closure.mjs` | compute and verify the identity; static import closure |
| `tools/mo1308-phase3/corpus.mjs` | generate and verify the corpus |
| `tools/mo1308-phase3/inventory-file.mjs`, `render-protocol.mjs` | write and check the inventory file and this document's generated tables |
| `tools/mo1308-phase3/lib/runner.mjs`, `seal.mjs`, `receipts.mjs`, `classification.mjs`, `evidence.mjs`, `shape.mjs`, `stable-json.mjs`, `hashing.mjs`, `git.mjs`, `allowed-paths.mjs` | the seal / run / close runner and its records |
| `tests/mo1308_phase3_shared_test.mjs` | tests of all of the above, runnable in the cloud |

**Corpus.** From the repository's released fixtures and the real SDK it provides: 66 valid records (the reference MIP package;
40 distinct real checkpoint records, of which `checkpoint-f00..f29` serve the 30 appends of F1; the six released Policy pairs;
the reference regression report; the 6-file and 4-file MO-1306 bundles; the four MO-1307 readiness results; the twelve decision
claims); filler vectors at limit−1, limit and limit+1 for every member, entry, descriptor and stdout limit; three ledger
recipes (`all`, `purge`, `small`) with their expected `ledgerIdentifier`, `headDigest` and entry digests; deterministic sampling
seeds (a SHA-256 counter generator, identical on every platform); nine canary strings and the run-time canary sources; and the
frozen plans of F1 and F7. The manifest holds digests and lengths only; `corpusDigest` seals it. Regeneration is
byte-identical.

## 14. Branches, worktrees and evidence

| Step | Branch | Worktree | Where |
|---|---|---|---|
| Precondition (A3) | `mo1308/phase3-precondition` | — | Windows |
| Shared protocol and libraries (this step) | `mo1308/phase3-shared` | — | cloud |
| 3A | `mo1308/phase3a-native` | `cca-mo1308-3a` | author in the cloud, run on Windows |
| 3B | `mo1308/phase3b-closure` | `cca-mo1308-3b` | cloud, run on Windows |
| 3C | `mo1308/phase3c-security` | `cca-mo1308-3c` | cloud, run on Windows |
| 3D | `mo1308/phase3d` | `cca-mo1308-3d` | cloud, validator on Windows |

One-shot generations are pushed after sealing, whether PASS or FAIL, never while running. `main` advances only at accepted
integration boundaries; tags follow human review only.

## 15. Allowed path set (3B case A3)

Every path changed between the MO-1307 release BF `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` and the candidate must fall in
one of these classes. For the candidate itself all 299 changed paths are classified (262 for b0bf2d56, 186 for B2); a path in none is a finding. The set follows Freeze
sections 5.1, 16 and 18.1 and Amendments A1 to A7, A9.1 and A10 (the CLI entry).

<!-- GENERATED:BEGIN allowed -->
| Class | Allowed paths |
|---|---|
| DOCUMENTS | `ARCHITECTURE.md`, `ROADMAP.md`, `README.md`, `KNOWN_ISSUES.md`, `RELEASE_NOTES.md`, `CHANGELOG.md`, `.gitattributes`, `repositories/memoryos-cli/README.md`, `repositories/memoryos-cli/docs/**`, `docs/ambiguity-register.md`, `docs/mo1308-*.md`, `docs/mo1302-vendored-runtime-check-correction.md`, `docs/mo1307-v2-stale-test-correction.md` |
| APPEND_ONLY_EVIDENCE | `repositories/cca-conformance/evidence/mo1308/**`, `repositories/cca-conformance/evidence/mo1307/v2-stale-test-correction/**` |
| CONFORMANCE_TOOLS_AND_TESTS | `repositories/cca-conformance/tools/mo1308-*/**`, `repositories/cca-conformance/tests/mo1308_*`, `repositories/cca-conformance/tests/support/mo1308-*`, `repositories/cca-conformance/mo1308-phase3-*.json` |
| AUTHORIZED_TEST_CORRECTIONS | `repositories/cca-conformance/tests/compatibility_conformance_test.mjs`, `repositories/cca-conformance/tests/mo1301_integration_conformance_test.mjs`, `repositories/cca-conformance/tests/mo1307_phase2c_correction_test.mjs`, `repositories/cca-conformance/tests/mo1307_phase2c_native_runtime_test.mjs`, `repositories/cca-conformance/tests/mo1307_phase2c_runtime_test.mjs`, `repositories/cca-conformance/tests/normative_vectors_conformance_test.mjs`, `repositories/memoryos-vscode/tests/runtime_foundation.test.mjs`, `repositories/memoryos-vscode/tests/support/released-runtime-pins.mjs`, `repositories/memoryos-mcp/tests/integrity.test.mjs` |
| HISTORY_AUTHORITY_AND_SDK | `repositories/cca-studio/web/js/memoryos-history-*.js`, `repositories/cca-studio/web/js/memoryos-sdk.js`, `repositories/cca-studio/package.json`, `repositories/cca-studio/scripts/generate-memoryos-history-fixtures.mjs`, `repositories/cca-studio/tests/memoryos_*`, `repositories/cca-studio/tests/fixtures/memoryos-history/**` |
| CLI_HISTORY_NAMESPACE | `repositories/memoryos-cli/CMakeLists.txt`, `repositories/memoryos-cli/package.json`, `repositories/memoryos-cli/src/*.js`, `repositories/memoryos-cli/bin/memoryos.js`, `repositories/memoryos-cli/tests/**` |
| WORKSPACE_CHECK_CORRECTION | `tools/verify_workspace.py` |
<!-- GENERATED:END allowed -->

## 16. Disclosures and follow-ups carried by A8

1. **Official CAVP response files were not used.** Cases 3C-D1 and D2 use the FIPS 180-4 example messages and the CAVP Monte Carlo
   procedure computed against `node:crypto` (A8 decision 1). Every release disclosure of Q09 states this.
2. **Tool dependencies.** Static auditors for 3C add no dependency; the shared scanner is a small hand-written tokenizer.
3. **Documentation edits** needed by the campaigns (the D7 operator guidance, and the disclosures of cases 3D-E2 and E3) are
   documentation changes outside the candidate; they are made after the 3A and 3C outcomes are recorded, so that they state the
   actual outcomes (section 8.4).
4. **Citation.** Amendments A3.1 to A3.3 are merged and cited by sections 31 to 33 (section 3); A8 is section 34 (A8.5). The
   verdict member of the A3.2 receipt is to be updated when the receipt exists (the 3D validator reads `verdict`).
