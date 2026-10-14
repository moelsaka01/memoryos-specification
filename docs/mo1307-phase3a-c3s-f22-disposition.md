# MO-1307 C3S F22 regression disposition

Classification: **F22_BASELINE_PASS_C3S_FAIL_OBSERVED**.

This is the disposition of the single failed C3S Phase 2C regression. It does
not accept C3S, replace the failed campaign, or certify any Phase 3 scope.

## 1. Preserved working-copy status

C3S remains **IMPLEMENTED / NOT ACCEPTED**. Main remains
`4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97`; production authority remains C3RB
`defe93989efc6501b1a730b82e79e705884b269b`. No C3S or C3SB commit was created.

All 845 pre-existing changed/untracked files were hashed before the control and
verified afterward: four tracked changes and 841 non-ignored untracked files.
This includes the existing C3S implementation/evidence and preserved R2 files.
The eight original F22 dependency files were also verified unchanged afterward.
The r3a HEAD remains exact C3RB and its intentionally dirty status is unchanged;
this task did not operate on its evidence. Nothing was staged, reset, cleaned,
committed, pushed or tagged. Only this new disposition namespace and its isolated
cache projection were created. See [preservation](../repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition/preservation-before.json)
and [post-control receipt](../repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition/receipt.json).

## 2. Exact F22 authority

The unchanged authoritative test is
`repositories/cca-conformance/tests/mo1307_phase2c_finalization_test.mjs:195-211`
at exact C3RB. Its line 206 remains:

```javascript
assert.ok(performance.now() >= publicationStatus(item.token).dispositionDeadline);
```

The controlling [Freeze](mo1307-contract-freeze-1.md) at lines 1262-1267 and
[finalization-boundary correction](mo1307-phase2c-finalization-boundary-correction.md)
at lines 61, 63 and 90 prescribe one 2000-ms post-settlement read-only
verification/disposition allowance. The deadline is fixed once at observed
rename settlement using the same monotonic clock. Failed/timed-out verification
yields OUTPUT while preserving actual COMMITTED/FAILED state and owned files.
Neither the assertion nor any allowance was changed or waived.

The preserved C3S campaign reached 218/219 PASS and failed F22 at this assertion
with a 2029.4944-ms whole-test duration. The prior assertions established OUTPUT,
COMMITTED and `namespaceVerified:false`; the later handle-release/closure checks
were not reached. The failure did not expose either numeric clock operand.
See the [unchanged failure output](../repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction/regressions/phase2c/tests.stdout.txt)
and [unchanged C3S stop disposition](../repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction/stop-disposition.json).

## 3. Dependency graph

All eight local modules in this closure are byte-for-byte identical between the
C3S working copy and exact C3RB. Git blob IDs, sizes, SHA-256 values, every local
import edge and the Node builtins are retained in the [control plan](../repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition/plan.json).

```text
mo1307_phase2c_finalization_test.mjs
  -> publication-fixture.mjs, publication.mjs, errors.mjs
publication-fixture.mjs / publication.mjs
  -> helper-protocol.mjs, windows-paths.mjs, errors.mjs, constants.mjs
helper-protocol.mjs
  -> canonical.mjs, windows-paths.mjs, errors.mjs, constants.mjs
canonical.mjs / windows-paths.mjs / errors.mjs
  -> constants.mjs and/or errors.mjs
```

F22 supplies JavaScript fixture responses and Node filesystem operations. It
does not launch the PowerShell helper or a worker. It does not read the changed
helper, SBOM or distribution manifest. There is no local dynamic import or
external package dependency in this closure.

## 4. Causal analysis

No direct C3S code or data path to the tested behavior was found. Its changes
cannot directly change this closure's deadline calculation, status snapshot,
timer scheduling, finalization state, clock or publication logic.

In unchanged `publication.mjs`, the settled rename is followed at line 278 by
`dispositionDeadline = performance.now() + cleanupAllowanceMs`. The status getter
at lines 70-75 synchronously returns that stored value without an await or clock
read. Read-only verification awaits `fs.open` at line 119, which F22 deliberately
leaves unresolved. Lines 143-148 race it against a timer scheduled from the
remaining deadline interval. The timer callback rejects OUTPUT without
rechecking `performance.now()` against the deadline; line 150 clears the timer.
F22 separately compares the clock with the stored deadline after rejection.

This identifies a possible timer/clock boundary, not an established defect or
cause. The failed comparison's numeric shortfall is unknown. The passing
isolated baseline control differs from the earlier full-suite execution in
source/fixture path and execution context. Indirect scheduling/load effects are
conceivable but unmeasured. Neither observation establishes C3S causation,
flakiness, environmental variance, a historical defect, a test defect or a
publication defect.

Historical correction evidence provides no F22 waiver. The finalization
correction's second attempt and later accepted regression evidence contain
passing F22 observations with the current assertion. The earlier first attempt
did not yet contain that assertion. The documented
[floating-point harness correction](../repositories/cca-conformance/evidence/mo1307/phase2c-final/runtime-publication-attempt2-disposition.json)
concerns a different stdout-cancellation test's subtraction-based equality;
the N24 clarification concerns timer lifetime. Neither dispositions this F22
inequality failure. Those historical records remain intact.

## 5. Why the control was required

Static analysis established no direct C3S causal defect but did not determine
the failure's cause. The user's finite control authorization therefore applied.
Exactly one F22 body was executed, with no warmup, retry, repeated sample, helper
or performance witness.

The repository-safe mechanism was a new eight-file dependency projection in
`.cache/f22b`, extracted directly from C3RB Git blobs with original relative
paths. It is not a complete checkout. Both current and projected source bytes
were checked against C3RB before execution. The exclusive
[execution claim](../repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition/execution-claimed.json)
prevents this runner from launching another control in the same evidence
namespace. The test was not instrumented or modified; NODE_OPTIONS and NODE_PATH
were empty. The pinned Node executable and runner identities are in the plan.

## 6. Exact control result

- Commit: `defe93989efc6501b1a730b82e79e705884b269b`.
- Tree: `54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb`.
- Runtime: Node `v24.21.0`, Windows x64; executable SHA-256
  `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.
- Working directory: `C:\Users\melsa\Documents\Codex\cca-workspace\.cache\f22b`.

Exact test command, issued directly with `shell:false`:

```text
"C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1304-phase3-toolchain\node-v24.21.0-win-x64\node.exe" --test "--test-name-pattern=^F22 read-only verification timeout is bounded and late handle completion only closes$" --test-reporter=tap --test-concurrency=1 repositories/cca-conformance/tests/mo1307_phase2c_finalization_test.mjs
```

| Observation | Result |
|---|---|
| Selected tests | 1; F22 only, zero skipped |
| F22 | PASS |
| F22 duration | 2063.059 ms |
| Node TAP overall duration | 3304.9302 ms |
| Parent-observed process duration | 4391.5581999999995 ms |
| Process exit / signal / launch error | 0 / none / none |
| `performance.now()` at assertion | NOT_OBSERVED_WITH_UNMODIFIED_TEST |
| Numeric `dispositionDeadline` | NOT_OBSERVED_WITH_UNMODIFIED_TEST |
| Numeric difference | NOT_OBSERVED_WITH_UNMODIFIED_TEST |
| Publication state | COMMITTED, namespaceVerified:false, inferred from passed assertions; no full snapshot captured |
| Later F22 obligations | Late handle closed once, no live/late timers, exact final bytes retained and pending absent; passed assertions |
| Preservation checks | PASS |

The whole-test/process durations are not substitutes for the assertion's clock
operands. The runner's 30000-ms process guard is an engineering containment
limit and changed no product deadline or test assertion. Raw
[TAP](../repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition/stdout.tap),
[stderr](../repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition/stderr.txt)
and [receipt](../repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition/receipt.json)
are retained without replacement or rerun.

## 7. Disposition

**F22_BASELINE_PASS_C3S_FAIL_OBSERVED**, mechanically selected by the user's
baseline-PASS rule. Root cause remains **NOT_ESTABLISHED**. A single passing
control does not prove C3S caused the earlier failure, and static analysis found
no direct causal path.

## 8. Consequence for C3S

The original 218/219 Phase 2C result remains **FAIL**. C3S remains implemented
and not accepted; production authority remains C3RB. The baseline observation
does not replace that regression result or satisfy acceptance. Remaining
regressions, performance witness, final acceptance/binding and C3S/C3SB commits
remain NOT_RUN. No Phase 3A, 3B/3C refresh or Phase 3D work was started.

## 9. Exact recommended next action and stop

Keep C3S paused. Seek separate authorization for one focused F22 timing-boundary
diagnostic on exact C3RB, using a separate diagnostic copy while preserving the
authoritative test: record the stored deadline, computed timer delay, timer
callback clock and pre-assertion clock in one explicitly capped diagnostic
execution. Interpret those observations against the frozen contract before
proposing any test or publication correction. Do not substitute a retry or
weaken the assertion. If the observation is inconclusive, preserve that result
and stop rather than expand the campaign.

That proposed diagnostic is **NOT AUTHORIZED OR EXECUTED** by this disposition.
This task stops here. No further test, fix, acceptance, commit, certification,
push or tag follows.
