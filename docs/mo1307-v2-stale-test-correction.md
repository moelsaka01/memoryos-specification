# MO-1307 V2 stale-test correction

Status: **BOUND — PASS_639**. Part 2 ran on the reference Windows host under
the pinned Node v24.21.0: 25 files, 639 tests, 639 pass, 0 fail, exit 0.
Evidence commit `32255d7a008b342b7122d94aa35ec9e1c94eeacd`; binding commit
`1c3a4269fe9394de74e2a4a6ad76aed7d076fd19`
([binding.json](../repositories/cca-conformance/evidence/mo1307/v2-stale-test-correction/binding.json)).
The binding covers this record's Part 1 bytes at that commit (13387 bytes,
`sha256:157e6dd1bd6253c0fa7e7574cb12ebfbe8a3e4956046ce25ae2ef5081baed28e`,
git blob `38947ceed9b8e4ef3da876c744aa2f7c8358c4b4`); this status paragraph is
a later documentation update (section 7.3, step 3) and changes no bound
evidence. The sections below are the Part 1 record as bound.

This is the separate, test-only, bound MO-1307 correction (V2) recorded in the
[MO-1308 roadmap authority](mo1308-investigation-history.md) and
[MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md) (sections 1.2 and 18.2).
It corrects exactly the 7 tests disclosed by the
[Phase 3D audit](mo1307-phase3d-certification.md)
(`PASS_WITH_DISCLOSED_STALE_TEST_BASELINE`, 632/639), whose per-test
classification is recorded in
[`audit-results.json`](../repositories/cca-conformance/evidence/mo1307/phase3d/audit-results.json).
It must be complete and bound before the MO-1308 Phase 1 binding.

## 1. Baseline and scope

- Branch `mo1307/v2-stale-test-correction`, created from
  `fdee70cd8d06e80562d2c4f3c8fe55b4e0019027` (head of `mo1308/freeze`).
- The three test files are byte-identical at that commit and at the tagged BF
  `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` (`memoryos-1.3-mo1307`, tag
  object `a3042f3bded41ec71deff8dac71691e9a595460b`). The tag is not touched.
- Changed: three test files under `repositories/cca-conformance/tests/` and
  this record. Not changed: production code, contracts, limits, resource
  authority, any other test, any fixture, any evidence file.

## 2. Authority for the corrected values

| Authority | Value | Adopting commit | Binding commit | Document |
|---|---|---|---|---|
| `PROSPECTIVE_HELPER_BOUND@2.0.0` | Whole-helper lifecycle succeeds `< 9000 ms`; `>= 9000 ms` is `MO1307_TIMEOUT` | `34f42c50abfa1c440416c4cdf7f643f784585588` (C3U) | `91c07b1e93f65ab6252024984073c171ff5d7648` (C3UB) | [mo1307-prospective-helper-bound-v2-candidate.md](mo1307-prospective-helper-bound-v2-candidate.md) |
| `PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0` | Aggregate helper-active time succeeds `< 28000 ms`; equality or later is `MO1307_TIMEOUT`; the runtime takes the earliest of the CLI deadline (30000 ms), the 9000-ms helper deadline and the remaining aggregate allowance; API/worker 10000 ms and cleanup 2000 ms unchanged | `98b766f9218b209f52251147213839b9775f6da3` (C3V) | `17fa84efe46d30e6f4be85fd2427485677a222a3` (C3VB, final candidate) | [mo1307-prospective-helper-aggregate-bound-v2-candidate.md](mo1307-prospective-helper-aggregate-bound-v2-candidate.md) |

The tested source of truth is the final candidate's
`repositories/memoryos-readiness/contracts/definitions.json` and
`src/constants.mjs`: `helperDeadlineMs` 9000, `helperAggregateDeadlineMs`
28000, `cliDeadlineMs` 30000, `apiDeadlineMs` 10000, `cleanupAllowanceMs` 2000,
`helperRequests` 9, `helperVerifyRequests` 4, `helperChainComponents` 120,
`helperRequestBytes` 65536, `helperResponseBytes` 16777216. Only the first two
differ from the stale tests.

## 3. Changes

| # | Test | File | Old | New | Authority |
|---|---|---|---|---|---|
| 1 | C2C01 | `mo1307_phase2c_correction_test.mjs` | `helperDeadlineMs` 5000; `helperAggregateDeadlineMs` 20000 | `helperDeadlineMs` 9000; `helperAggregateDeadlineMs` 28000. The other eight limit assertions are unchanged. | Both (§2) |
| 2 | C2C17 | `mo1307_phase2c_correction_test.mjs` | Exit observed at `now = 4999` succeeds; `now = 5000` is `TIMEOUT` | `now = 8999` succeeds; `now = 9000` is `TIMEOUT` (equality boundary kept) | Helper bound |
| 3 | C2C18 | `mo1307_phase2c_correction_test.mjs` | 4 helpers × 4999 ms = 19996, then +4 ms reaches 20000 → `TIMEOUT` | 4 helpers × 6999 ms = 27996 (each below 9000), then +4 ms reaches 28000 → `TIMEOUT` (equality boundary kept; the `TIMEOUT` assertion is unchanged) | Aggregate bound |
| 4 | R07 | `mo1307_phase2c_runtime_test.mjs` | Helper reaches `now = 5000` → `TIMEOUT` | `now = 9000` → `TIMEOUT`; cleanup assertion unchanged | Helper bound |
| 5 | R08 | `mo1307_phase2c_runtime_test.mjs` | 4 × 4999; `helperUsedMs` 19996; fifth lease deadline 20000; `now = 20000` → `TIMEOUT` | 4 × 6999; `helperUsedMs` 27996; fifth lease deadline 28000 = min(30000, 27996 + 9000, 27996 + 28000 − 27996); `now = 28000` → `TIMEOUT` | Aggregate bound |
| 6 | R09 | `mo1307_phase2c_runtime_test.mjs` | Second helper lease deadline 14010 | 18010 = min(30000, 9010 + 9000, 9010 + 28000 − 10). Worker lease 10010 and `helperUsedMs` 10 unchanged | Both |
| 7 | NRT01 | `mo1307_phase2c_native_runtime_test.mjs` | Re-runs a CPU-bound worker against the production supervisor and writes its receipt with exclusive create (`wx`), which fails with `EEXIST` because the one-shot witness is preserved | Verifies the preserved witness and never re-runs or writes (§4) | One-shot witness preservation |

No assertion was loosened. Each corrected limit test still checks an exact
equality boundary at the authoritative value, and C2C18/R08/R09 still fail if
the superseded 5000/20000-ms values are restored. Each changed test carries a
one-line `V2:` comment naming its authority.

## 4. NRT01 preserved-evidence check

The witness
`repositories/cca-conformance/evidence/mo1307/phase2c-resumed/runtime/native-worker-deadline.json`
is bound by row 1720 of
[`phase2c-final/accepted-content-inventory-v2.json`](../repositories/cca-conformance/evidence/mo1307/phase2c-final/accepted-content-inventory-v2.json):
1294 bytes, sha256 `0013e3067f58da39ff58074035ad920cfe7b4960df470816b1af0d5318a222b4`,
git blob `72e9283fa898ad4dfe11cb366f6f64285af75514`.

The corrected test, read-only:

1. finds exactly one inventory row for the witness path and requires its
   `byteLength`, `sha256` and `gitBlob` to equal the values above;
2. reads the witness and checks its byte length, SHA-256 and git blob hash;
3. checks `case` `NRT01`, `runtime` `v24.21.0`, `platform` `win32`;
4. applies the original assertions to the preserved values: `errorCode`
   `MO1307_TIMEOUT`, `snapshot.workers` 1, `snapshot.cleanupConfirmed` true,
   and `10000 <= elapsedMs < 12000` (recorded 10012.875 ms).

It starts no worker, opens nothing for writing, and does not delete or rewrite
the evidence. The 14000-ms test timeout option was removed because nothing
long-running remains.

## 5. Byte-exactness

`mo1307_phase2c_runtime_test.mjs` and `mo1307_phase2c_native_runtime_test.mjs`
are byte-exact files (`text` unset) containing CR characters on lines outside
the changed tests (`});` closers at runtime-test lines 229, 248 and 266, and the
native test's final line). They are preserved. Reversing the edits in §3
reconstructs the exact base blobs:

| File | Base blob (BF and `fdee70c`) | Corrected blob | Reverse check |
|---|---|---|---|
| `mo1307_phase2c_correction_test.mjs` | `be6c23c6f09a542302eccf5fb59e1b7471e00b38` | `ce5e0b2e624f4715d33d697fd9d137c45ba363d0` | PASS |
| `mo1307_phase2c_runtime_test.mjs` | `380c37d163d0fba4fe9ea4c49424c4db6ca41db0` | `9b68ea77317ffeca3130a0dcf838ba35ce3a37f3` | PASS |
| `mo1307_phase2c_native_runtime_test.mjs` | `f92bea420a21e9f10832c808a6c5848d4f05a287` | `bb9bca86e1357c01fdcbffde2b50ff85f76510ed` | NRT01 replaced in full; imports of `node:test`, `node:assert/strict`, `node:fs/promises` and the CR-terminated closing line retained |

## 6. What Part 1 verified, and what it did not

Run in the cloud authoring container (Linux, Node v22.22.0, not the pinned
toolchain), `node --test --test-concurrency=1 tests/mo1307_*_test.mjs` from
`repositories/cca-conformance`:

- 25 files, **639 tests**, the same count as the Phase 3D audit;
- **all 7 corrected tests pass**;
- 517 pass and 122 fail overall. The 122 are native Windows tests (PowerShell
  helper, NTFS publication, Windows path semantics), for example `N01`, `N15`–`N23`,
  `C2C20`–`C2C23`, `F01`–`F24`, `PTERM*`, `PCHAIN*`. The failure set is identical
  before and after the byte-exactness repair. They are ENVIRONMENT failures of
  this container, not a result about the correction.

**This is not the 639/639 claim.** That claim is made only by Part 2 on the
reference Windows host with the pinned toolchain.

Not verified here: the native suites; the pinned Node binary identity; any
Windows filesystem or helper behavior; and the post-BF validator.

Two facts for Part 2:

- `tools/mo1307-phase3d/validate-final.mjs` re-hashes every MO-1307 suite file
  and requires `HEAD` to be BF. It remains valid only on a BF checkout, where
  the tests are the original bytes; it cannot validate a commit containing V2,
  and V2 does not change its result at BF.
- The earlier generation preparation tools (`mo1307-final-headless`,
  `mo1307-n15-correction`, `mo1307-n17-correction`,
  `mo1307-headless-cleanup` `validation-bindings.mjs`) read these test files
  for their own historical generations. They remain meaningful only at their
  own bound commits. Their recorded receipts are historical and are not
  rewritten.

## 7. Part 2 — local validation and binding plan

Environment: the reference Windows 11 x64 host, Node **v24.21.0** whose
`node.exe` SHA-256 is
`sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`
(the pin enforced by `tools/mo1307-phase3d/common.mjs` `requireNode()`).
Part 2 is one validation generation. If it does not produce 639/639, preserve
the log, classify the failure, and stop; do not retry silently.

### 7.1 Worktree and toolchain (PowerShell)

```powershell
Set-Location C:\Users\melsa\Documents\Codex\cca-workspace
git fetch origin mo1307/v2-stale-test-correction
$A = git rev-parse origin/mo1307/v2-stale-test-correction   # the Part 1 commit; record it
if (Test-Path ..\cca-mo1307-v2) { throw 'worktree path exists' }
git worktree add --detach ..\cca-mo1307-v2 $A
Set-Location ..\cca-mo1307-v2
if (git status --porcelain) { throw 'worktree not clean' }
$node = (Get-Command node.exe).Source
& $node --version                                            # must print v24.21.0
(Get-FileHash -Algorithm SHA256 $node).Hash.ToLower()        # must equal ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32
git diff --name-only 1dd1e8c82fe0ed5a32a894744392f2c279f89d4c $A -- repositories/memoryos-readiness   # must print nothing
git diff --name-only fdee70cd8d06e80562d2c4f3c8fe55b4e0019027 $A           # must list exactly the 3 tests and this record
```

### 7.2 Run all 25 suites (639 tests)

```powershell
Set-Location repositories\cca-conformance
$log = "C:\Users\melsa\Documents\Codex\mo1307-v2-tests.txt"   # outside the worktree
if (Test-Path $log) { throw 'log exists' }
cmd /d /c "`"$node`" --test --test-concurrency=1 tests/mo1307_*_test.mjs > `"$log`" 2>&1"
$exit = $LASTEXITCODE
Select-String -Path $log -Pattern '^# (tests|pass|fail|cancelled|skipped)'
(Get-ChildItem tests\mo1307_*_test.mjs).Count                 # must be 25
Set-Location ..\..
git status --porcelain                                        # must be empty (.cache/ is ignored)
```

The command line is exactly the Phase 3D audit runner
(`node --test --test-concurrency=1 tests/mo1307_*_test.mjs`); Node expands the
`--test` glob itself. `cmd` redirection keeps the log as Node's exact output
bytes (Windows PowerShell 5.1 `*>` would re-encode it as UTF-16). **Expected: `$exit` 0; tests 639, pass 639, fail
0, cancelled 0, skipped 0.** The witness `native-worker-deadline.json` must
be unchanged afterwards:

```powershell
(Get-FileHash -Algorithm SHA256 repositories\cca-conformance\evidence\mo1307\phase2c-resumed\runtime\native-worker-deadline.json).Hash.ToLower()
# must equal 0013e3067f58da39ff58074035ad920cfe7b4960df470816b1af0d5318a222b4
```

### 7.3 Binding (MO-1307 precedent)

Following the Phase 3D I3/BF pattern (evidence commit, then a binding-only
child that adds one file and edits nothing, never embedding its own hash):

1. **Evidence commit E**, single-parent child of `A` on branch
   `mo1307/v2-stale-test-correction`, adding only
   `repositories/cca-conformance/evidence/mo1307/v2-stale-test-correction/`:
   - `tests.log`: the exact bytes of `$log`;
   - `receipt.json`: `{kind:"MO1307V2StaleTestCorrectionReceipt", version:"1.0.0",
     authoringCommit: A, baseCommit: "1dd1e8c82fe0ed5a32a894744392f2c279f89d4c",
     runtime:{version:"v24.21.0", platform:"win32", arch:"x64",
     sha256:"sha256:ba4e6d11…6c32"}, runner, files:25, tests:639, pass, fail,
     cancelled, skipped, exitCode, log:{path, byteLength, sha256},
     correctedTests:[the 7 IDs], correctedFiles:[{path, baseBlob, blob,
     byteLength, sha256}], witness:{path, byteLength:1294, sha256, gitBlob,
     unchanged:true}, productionChanged:false, result}`, where `result` is
     `PASS_639` only if all 639 pass, otherwise `FAILED_PRESERVED`.
2. **Binding commit B**, single-parent child of E, adding only
   `repositories/cca-conformance/evidence/mo1307/v2-stale-test-correction/binding.json`
   with the exact E commit and tree, and the path, byte length and SHA-256 of
   `receipt.json`, `tests.log` and this record. B embeds no hash of itself.
3. Update this record's status to BOUND only in a later documentation change,
   or record it in the binding, so B stays binding-only.
4. Push `mo1307/v2-stale-test-correction`. No `main` update, no tag, no change
   to `memoryos-1.3-mo1307`. Integration into `main` is a separate owner
   decision.

MO-1308 Phase 1 binding (B1) then cites commit B as its V2 dependency.

### 7.4 Optional confirmation at BF

In a separate detached BF worktree, `node
repositories/cca-conformance/tools/mo1307-phase3d/validate-final.mjs` must still
print `CERTIFIED_READY_TO_TAG`, confirming V2 left the tagged BF untouched.
