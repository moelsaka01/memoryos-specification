# MO-1307 final engineering resolution — stopped candidate

**PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER**

The first real native validation of the new correction failed. The exact fixed
PowerShell launch exited 0 in 111.4571 ms, returned zero stdout bytes and zero
stderr bytes, and therefore supplied no valid wire response. The supervisor
refused it with MO1307_INPUT at ACQUISITION and cleanupConfirmed:false. All three
streams and the helper process closed. These observations do not establish host
quiescence or identify an internal PowerShell/console failure branch.

The task stopped at that first actual mandatory failure. No further native case,
simulated case, production regression campaign, or A-O certification ran.

1. **Selected correction.** Replace numeric-parent Toolhelp attribution with
   current console-window owner attribution bound to one retained process object.
   Use a fixed detached hidden launch; query/synchronize rights only; recheck
   current window/owner/sole-client membership followed by live-object confirmation;
   detach only self; wait at most the unchanged 1000 ms for natural host exit.
   Remove all console-host TerminateProcess capability. Missing proof remains
   terminal, and no frame may assert quiescence without completing startup proof.

2. **Why permitted.** The final engineering request explicitly authorized the
   smallest defensible correction and scoped replacement of the historical cleanup
   mechanism. The Freeze does not explicitly require historical process-parent
   lifetime proof. The correction keeps the topology, attributable ownership,
   confirmed termination/EOF before transition, resource and authority objectives.
   Independent review found no static blocker, but that is not native acceptance.
   The observed functional failure prevents adopting this candidate.

3. **Production files changed.** Under repositories/memoryos-readiness:
   helpers/windows-inspect.ps1; src/helper-transport.mjs; helpers/README.md;
   distribution-manifest.json; sbom.spdx.json. The separate correction document
   records authorization/scope. Two engineering test launch expectations and new
   validation tools/evidence are outside the shipped package. Native filesystem
   acquisition and response code from Open-Native onward compare unchanged to
   C3RB; wire, schemas, readiness, gates, tags, decisions, publication, serializers,
   ceilings, fixed PowerShell arguments and human authority are unchanged.

4. **New candidate identity.** Unaccepted candidate
   `865978ff56229b60cca77bdb797987fc7d49aa4e`, package tree
   `d9e5d6e407adb59157ee811c90918c9b065b14e1`, based on unchanged C3RB
   `defe93989efc6501b1a730b82e79e705884b269b`.

5. **Security validation.** FAIL at normal-native-startup: one real native helper
   invocation, zero PASS cases, zero simulated cases. The remaining 28 cases were
   not executed. Exit 0 plus empty output is not success. The supervisor preserved
   its closed refusal and did not launch a worker or another helper. The selected
   detached launch did not deliver the required response on the pinned host.
   No particular native API failure, silent exit 22, or historical G cause is
   inferred from these bytes.

6. **Regression validation.** Package metadata build/integrity checks passed:
   89 members, 53 contract members, zero external production dependencies. Native
   PowerShell 5.1 helper/harness parsing, pinned Node syntax and Python AST checks
   passed. Static source comparison passed. The prepared 107-test affected
   regression driver, hostile native filesystem and two TOCTOU witnesses were
   NOT_RUN because native security validation failed. No archive or installed
   package certification is claimed by the package integrity check.

7. **A-O results.** A, B, C, D, E, F, G, H, I, J, K, L, M, N and O are all
   NOT_RUN_CORRECTION_VALIDATION_FAILED. No new certification worktree, archive,
   offline install, inventory seal or campaign was created. Historical A-O passes
   were not adopted. Existing failed generations remain intact.

8. **Receipt.** There is no accepted certification receipt. The failed native
   [security receipt](../repositories/cca-conformance/evidence/mo1307/console-correction/security-execution/receipt.json)
   has SHA256 cfb95a125e58d51223eb92cf474601200daccd9701285fc558c29c5783af9286.
   The [final engineering receipt](../repositories/cca-conformance/evidence/mo1307/console-correction/final-engineering-receipt.json)
   binds the case, exact request, fixture, output, source review, preflight history
   and future refresh requirements.

9. **Phase 3A acceptance.** NOT ACCEPTED; FAILED/INCOMPLETE. C3RB remains current
   production authority. The new candidate is an unaccepted failed implementation.

10. **Commit/binding identities.** Candidate and package-tree identities are above.
    The separate final binding records the evidence commit and receipt hashes
    without embedding its own future commit identity. No amend, reset, push or
    tag is used. This report and all retained failures are committed locally.

11. **Exact future 3B refresh.** Accepted C3RB Phase 3B
    `702c1b6381f6112a50ac844831d195275dac3350` remains historical accepted evidence.
    A subsequently validated new candidate requires new source/runtime-closure/
    distribution/SBOM/provenance identities, two deterministic archive assemblies,
    exact member verification, fresh offline install, before/after 89-member
    equality, installation persistence and installed-context/source-independence
    bindings. Refresh the artifact-bound archive/helper/distribution/SBOM/
    provenance/installed-member tamper cases. Do not inherit a complete archive,
    installation or fresh receipt. Unchanged semantic/checker evidence is only a
    dependency-reuse candidate. No 3B campaign ran here.

12. **Exact future 3C refresh.** Accepted C3RB Phase 3C
    `b02fc0226a1a2d800185a02071674ca80bdf4a1d` remains historical accepted evidence.
    For this actual helper-plus-transport diff, the existing affected set contains
    88 primary controls: equivalence 67; protocol 12; TOCTOU 2; deadline/cleanup 6; and
    runtime-boundary:fixed-powershell-launch. TOCTOU IDs are
    refresh:before-read-replacement and refresh:held-to-fresh-replacement.
    The six deadline IDs are runtime-boundary:fixed-helper-environment-poison,
    refresh:deadline-timeout-exact-mapping,
    refresh:deadline-late-native-success-refused,
    refresh:deadline-crash-closed-transport,
    refresh:helper-path-count129 and
    refresh:deadline-resource-native-declared-file-cap. Supporting native witnesses,
    helper delta/native API/launch/console reviews, call-site and bounded-state
    bindings, process-observation policy, source/release-effect inventories and
    candidate seals also require refresh. New console adversarial cases are
    additional. The remaining 463 outcomes are only conditional reuse candidates,
    not current executions. All 88 exact IDs and 3B requirements are recorded in
    [future-3bc-refresh-requirements.json](../repositories/cca-conformance/evidence/mo1307/console-correction/future-3bc-refresh-requirements.json).
    This scope is conditional; no 3C campaign ran here.

13. **Repository status.** Work is isolated in C:/m7fix on
    codex/mo1307-console-ownership. Original dirty/failed worktrees and accepted
    3B/3C worktrees were not edited. The local evidence/binding closeout retains
    the failed candidate and all attempt records; final post-commit status is
    reported with the binding identity. Ignored scratch input is additionally
    captured as an exact evidence fixture.

14. **Next action.** Repair the demonstrated fixed-launch loss of wire output
    before any further security/regression validation or A-O certification.
    No additional execution or architecture investigation is performed under
    this task's first-failure stop. No Phase 3D, push or tag.

## Preserved preflight history

Before the first product invocation, the harness rejected a mistyped 65-digit
Python checksum. Its FAIL receipt contains zero cases and its exact source is
preserved. A subsequent caller error supplied an output-directory argument to a
no-argument driver; the guard rejected it before any directory/case execution.
The sole harness repair corrected the verified checksum and fixed the new
security-execution evidence directory, retaining all no-retry/no-overwrite guards.
The original preflight was not relabeled PASS. The actual native test above ran
once and its first failure was not retried. Both driver generations, the argument
refusal and the exact two-literal correction are retained in the evidence set.
