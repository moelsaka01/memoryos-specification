# MO-1307 final prospective helper-bound correction

Status: **`PROSPECTIVE_HELPER_BOUND@2.0.0` ADOPTED / C3U PREPARED FOR BINDING**.
This record adopts the final prospective whole-helper bound for C3U and later
candidates. It is governance and pre-certification integration evidence, not a
Phase 3A, Phase 3B, Phase 3C, Phase 3D, release, push, or tag result.

## Normative rule

The prospective whole-helper lifecycle bound is 9,000 ms. A helper succeeds
only when its complete lifecycle finishes at elapsed time `< 9000 ms`; elapsed
time `>= 9000 ms` is `MO1307_TIMEOUT`. The measured lifecycle still includes
process creation, PowerShell startup, helper and native initialization, request
processing, response framing and writing, EOF, process exit, pipe settlement,
and required helper/console quiescence.

The 20,000 ms aggregate helper-active budget, 30,000 ms CLI admission deadline,
10,000 ms API/worker limits, and separate 2,000 ms terminal-failure cleanup
allowance are unchanged. There is no retry, grace, helper reuse, persistent
helper, overlap, or late-success recovery.

This is prospective authority. Historical `H = NOT_ESTABLISHED` remains
unchanged; 9,000 ms is not H. `PROSPECTIVE_HELPER_BOUND@1.0.0`, C3T, C3TB, and
the preserved failed Phase 3AR2 generation at
`9f45656cdb1fe8899cfd6abceb8061bbba459d73` remain immutable history.

## Bounded correction rationale

The fresh installed C3TB Phase 3AR2 generation observed valid helper lifecycles
of 2,338.325 ms, 1,977.802 ms, and 8,041.987 ms. The third lifecycle correctly
timed out under the old 8,000 ms authority, so that authority is insufficient
for the exact installed execution. The final 9,000 ms prospective bound exceeds
the observed lifecycle while remaining below the 10,000 ms API/worker limit and
compatible with the aggregate, CLI, and separate cleanup budgets. This adoption
does not perform or infer another characterization campaign.

## Candidate content

C3U is the single-parent production correction child of the failed-generation
preservation commit. The only production semantic input changed is
`helperDeadlineMs`, from 8,000 to 9,000. Generated definitions, constants,
contract binding, package documentation, SBOM, and distribution manifest are
rebuilt mechanically. Runtime, protocol, transport, helper, schemas,
`schema-data`, and all other product behavior remain byte-identical.

All prior accepted corrections remain present: final headless cleanup,
post-detach witnessing, initial-zero fail-closed behavior, CreateFileW
`SetLastError` metadata handling, redundant Open-Chain `Assert-Root` removal,
wire 2.0.0, filesystem boundaries, TOCTOU controls, publication semantics, and
human-decision separation. The package remains an explicit 89-member,
zero-production-dependency package.

## Binding and downstream boundary

C3UB is the direct binding-only child of C3U. A fresh installed Phase 3A A-O
generation must consume exact C3UB. The accepted C3TB Phase 3BR2 result remains
preserved but is historical for C3U/C3UB; only its exact changed-dependency
refresh and independently proven reusable conclusions may carry forward. Any
C3TB Phase 3CR2 result is likewise candidate-bound and must be assessed against
the exact 9,000 ms and candidate delta. Phase 3D remains prohibited until the
required current-candidate streams are accepted.
