# MO-1307 Phase 3A startup exit-22 capture

**PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER**

Exactly one engineering diagnostic invocation captured
`STARTUP_HOST_ATTRIBUTION_FAILURE`. The intended helper rejected a null current
console window after observing itself as the sole console client. No production
repair or further execution followed. Phase 3A remains failed / incomplete.

This report describes the recorded invocation, not an inferred cause for any
earlier uninstrumented failure. It does not establish that every console
implementation or every Windows environment has the same behavior.

## 1. Exact captured startup failure

The diagnostic copy entered the script. `GetConsoleProcessList` returned `1`,
and the sole client PID was `5556`, equal to the helper's own PID. The next
`GetConsoleWindow()` returned `0`. The existing nonzero-window guard rejected
with `MO1307_INTERNAL`. The corresponding unchanged production branch is
`repositories/memoryos-readiness/helpers/windows-inspect.ps1:139-140`.

The observation is retained in [diagnosis.json](../repositories/cca-conformance/evidence/mo1307/startup-exit22/execution/diagnosis.json)
and [receipt.json](../repositories/cca-conformance/evidence/mo1307/startup-exit22/execution/receipt.json).

## 2. Diagnostic identifier

First failure: **S12.01**, `Current console HWND/nonzero guard`.
Classification: **STARTUP_HOST_ATTRIBUTION_FAILURE**.
Last successful startup identifier: `S08.01`, the sole-client PID read.
Cleanup subsequently completed `S22` (`FreeHGlobal`); its success did not
replace the retained first failure. The outer catch was `S23`.

## 3. Native, exception and transport evidence

| Field | Recorded value |
| --- | --- |
| Script entry | Observed |
| Failing native return | `0` from `GetConsoleWindow` |
| Captured last-error value | `203`; explicitly **not meaningful** for this operation |
| Exception | `System.InvalidOperationException` |
| HResult | `-2146233079` |
| Exception message | `MO1307_INTERNAL` |
| Helper PID / exit | `5556` / `22` |
| Stdout / stderr | `0` / `1651` bytes; capture not truncated |
| Product elapsed time | `1315.3919 ms` |
| Strict production transport | Rejected, `MO1307_INTERNAL`, stage `ACQUISITION` |
| Supervisor cleanup | `cleanupConfirmed: false`, active role `helper` |
| Process and stream flags | All eight exit/close/EOF/input-finish flags true |

The strict transport rejected the nonzero process exit at
`src/helper-transport.mjs:66`. Closed pipes and a reaped helper do not prove
native console quiescence. Error `203` is not a causal explanation. No process
handle or host identity was established after the failing window guard.

The diagnostic used the exact retained 353-byte request, unchanged three-byte
input, fixed PowerShell executable, `detached:false`, `windowsHide:true`, fixed
environment/cwd/arguments and real production supervisor/transport. Only the
script path selected the independently reviewed diagnostic copy. Stdout was
untouched; bounded diagnostics used stderr. Helper/aggregate/CLI/API/cleanup
limits remained `5000/20000/30000/10000/2000 ms`; stderr remained capped at
`4096` bytes. The native host-wait limit remained `1000 ms`. There were no retries, alternate cases or additional invocations.

## 4. Concrete repair

**None applied.** The selected ownership proof requires a nonzero console
window before binding its owner to a held process handle. That prerequisite was
absent in the captured invocation. Bypassing the guard, treating null HWND as
console absence, or introducing a different attribution mechanism would change
that proof. Such a redesign is outside this targeted-repair request. The
observed guard therefore remains a concrete implementation blocker.

## 5. Wire-smoke result

No post-repair minimum wire smoke was run, because no repair was made. The
previous retained ordinary smoke failed with exit `22`, zero stdout/stderr,
`1075.518 ms`, `MO1307_INTERNAL` and unconfirmed cleanup. This invocation was a
diagnostic capture of that request, not a successful wire smoke or validation
PASS. Its result is `STARTUP_FAILURE_CAPTURED`.

## 6. Security validation

Not executed for this generation. The diagnostic adds no accepted security
evidence and does not waive the console ownership or cleanup requirements.

## 7. Regressions

The 107-test campaign, native filesystem regressions, two TOCTOU regressions,
and required protocol/deadline/cleanup validation were not executed. Existing
prepared tools and historical results are not promoted to new validation PASS.

## 8. New candidate identity

No new candidate exists: `candidate: null`. The observed unaccepted source base
is `93e515d8a93a76243c322f15ca2ec02de0d598d4`. All 89 shipped source members
remained byte-identical before and after capture. Production authority remains
C3RB `defe93989efc6501b1a730b82e79e705884b269b`.

## 9. A-O results

A through O were all **NOT RUN** in this generation. No certification inventory
was executed, no fresh package/offline installation was admitted, and no
acceptance receipt was created. H remains `NOT_ESTABLISHED`. Earlier failed generations remain preserved.

## 10. Phase 3A status

**FAILED / INCOMPLETE — PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER.** Execution
stopped after the one authorized diagnostic. No further diagnostics, broad
architecture investigation, certification, Phase 3B/3C refresh or Phase 3D
were performed.

## 11. Commit and binding identities

The [execution seal](../repositories/cca-conformance/evidence/mo1307/startup-exit22/execution/seal.json)
binds the final runner, generator, diagnostic copy, inverse proof, retained
request/input, runtime executables and all 89 production members. The
engineering copy's inverse reconstruction matched the original helper exactly.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Execution receipt | 29031 | `cd10479fc792f614ae3ba3dcabb087bf33960a7b2c12c4145b8372f6662251ab` |
| Diagnosis | 3346 | `57e8911f1e656c85ef04338f30312084a75ce70361732ae9e36b4f27361f9822` |
| Execution seal | 24988 | `e1b8527d6887c03271d19a7d6e3981b79c9de7b17ac253b575a7f7aac1930b55` |
| Retained stderr | 1651 | `5376055bbb075177c9b5ac9eed7e7ddcd9fbaeb7c0a1972d24d9566b04ecc67f` |

Final preservation commit and closure identities are supplied separately by
[final-binding.json](../repositories/cca-conformance/evidence/mo1307/startup-exit22/final-binding.json).
This forward reference does not invent a commit or accepted candidate.

## 12. Exact future Phase 3B scope

No refresh is authorized now. Accepted Phase 3B remains
`702c1b6381f6112a50ac844831d195275dac3350`. The unchanged-byte dependency plan
is [future-3bc-refresh-requirements.json](../repositories/cca-conformance/evidence/mo1307/wire-repair/future-3bc-refresh-requirements.json),
17480 bytes, SHA-256
`721a6ef289845d478e09a7d791451e48f480c4ae055a3cb49999b35e99ca543e`.

Its `phase3B` section enumerates new-candidate source inventory/import closure,
distribution/SPDX bindings, two deterministic archives, fresh offline install,
all 89 installed members before/after installed smoke, public-name API and
invalid-CLI checks, provenance/advisory/review/seal records, and all 16
artifact-bound tamper controls. Six other historical tamper controls and
unchanged contract/toolchain slices require exact dependency proof before any
reuse. No assembly, install, archive, tamper or complete receipt PASS is
inherited. Later production edits require reconciliation again.

## 13. Exact future Phase 3C scope

No refresh is authorized now. Accepted Phase 3C remains
`b02fc0226a1a2d800185a02071674ca80bdf4a1d`. The same dependency file's
`phase3C.affectedPrimaryIds` is the explicit 88-ID selection: 67 equivalence,
12 protocol, two TOCTOU, six deadline/resource/environment controls and one
fixed-launch control. The two TOCTOU IDs are `refresh:before-read-replacement`
and `refresh:held-to-fresh-replacement`; the seven additional IDs are recorded
verbatim in `phase3C.selection.explicitAdditionalIds`.

That file also identifies dependent native raw witnesses, exact source-audit
records, candidate/tool/fixture/output seals, and proposed console-specific
cases. These are future requirements, not executed results or a sealed
campaign. Previously proposed cases must be reconciled with any eventual
repair; this report does not endorse obsolete launch or termination assumptions.
There is no blanket reuse of the remaining historical outcomes. Any later
refresh requires a validated candidate, accepted fresh Phase 3A, and the user's
subsequent authorization.

## 14. Repository status

At report preparation, HEAD was `93e515d8a93a76243c322f15ca2ec02de0d598d4`;
the production directory had no diff from that commit. Pending changes were
the engineering capture tools/evidence, their attributes, and this report.
Final preservation status is recorded by the closure binding. C3RB and the
accepted 3B/3C evidence remain unchanged. No push, tag or Phase 3D occurred.
