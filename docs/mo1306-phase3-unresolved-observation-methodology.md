# MO-1306 Verification Methodology Correction B

This is a prospective certification rule for a narrowly defined unresolved
historical operational observation. It establishes eligibility for exactly one
final missing-input witness on C3CB. It does not certify that witness, native
Phase 3A, hosted execution, or a release. No product execution occurs here.

## Authority and decision

Current production authority is C3CB
`701d48ee2012675966360dda775ab13013c09ab9`, child of C3C
`39d83316f7c72d6cb49f8b6cde36c1bfa833112a`, child of C3AB
`9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44`, child of C3A
`90b9ac914e477fb90fe317d0de9ba310aae37f60`.

**Outcome A: a methodology correction is justified.** Freeze 1 sections 9 and 11
define publication; section 22 requires failure preservation, diagnosis before
bounded reruns, separate evidence and explicit reuse; section 23 requires honest
receipts and acyclic binding. The provider-neutral roadmap section 13 and
MO-1305 methodology correction distinguish functional evidence from resource
campaigns and forbid retrospectively validating earlier bytes. These principles
support the closed rule below. None requires an unexplained operational failure
to be inherited permanently by every later certification of the same bytes.

Outcome B does not apply: the environment-capture assessment correctly left
permission criterion 10 NOT_ESTABLISHED. Neither a successful reproduction nor
the host-interruption rule authorizes this distinction already. Correction B
supplies that permission only from M3 onward. No prior assessment is rewritten.
Outcome C would apply to a blanket waiver, semantic discrepancy, established
defect or repeat final failure; those cases are expressly excluded. Outcome D
would apply if any eligibility fact remained unsupported. Complete retained
evidence plus the independent checks below establish the required facts for
eligibility; one final certification witness remains required afterward.

The [machine authority](../repositories/cca-conformance/mo1306-unresolved-observation-methodology.json)
binds existing freeze/corrections, the production graph, exact historical copies,
the current matrix and tools. The historical validator ran read-only before any
methodology edit: 698 historical files, 914 bound references and 13 negative
controls passed. A separate checker re-reads all 758 copied index/member files,
the partial bundle, four successful bundles, raw event order, helper deadlines,
installed identities and cleanup. It never executes product code. Neither
validator's PASS purports to prove absence of every possible latent defect.

## Historical/current distinction and absent telemetry

Attempt `20260927T120240-b3df86`, run
`e89b8e91-c3c5-402d-9e6f-000bd2a102ba`, reached INPUT_ERROR/11 for missing input,
then returned ARTIFACT_ERROR/17 and publication NONE. Result and evidence exist;
manifest and completion marker do not. The historical gate remains FAIL, its
cause UNRESOLVED, and its original NATIVE_CERTIFICATION_BLOCKED receipt remains
unchanged. The earlier measurement defect and proven late-helper acceptance
defect are separate observations; this rule cannot waive either. C3C corrected
the latter under its own production authority.

The missing historical Node/Windows error was not captured. Available retained
source, traces, files and bounded event-log review cannot establish that error.
New successful executions cannot reconstruct the exact old event. This is an
assessment of available evidence, not proof that no future evidence could ever
be found. Recurrence may supply new causal evidence and immediately stops this
exception. No claim of Windows, Defender, harness or product causation follows
from absent telemetry. More successful repetitions would add observations, not
recover the missing historical error; there is no reliability probability claim.

## Closed eligibility rule

All 18 conditions must be PASS with bound evidence. FAIL or NOT_ESTABLISHED
blocks eligibility; omitted, duplicate or additional conditions are rejected.

1. Preserve exact historical evidence and original dispositions permanently.
2. Establish that the historical failure was fail-closed.
3. Establish that no falsely complete or successful artifact was produced.
4. Establish that no deterministic current product defect has been demonstrated.
5. Establish that no deterministic harness defect affecting current certification
   has been demonstrated.
6. Bind exact production, package, runtime and relevant dependency identities.
7. Establish successful bounded faithful reproductions of the relevant operation
   on those exact bytes, retaining every attempt.
8. Establish at least one successful enhanced-observation reproduction.
9. Establish current bundle integrity, installed-byte integrity and cleanup.
10. Account for every current observation; no unexplained contrary current
    evidence may remain. The single explicitly identified historical observation
    is the subject of the exception, not permission to reclassify later failures
    as more historical exceptions.
11. Establish an operational failure mechanism rather than normative corruption.
12. Limit the claim to the identified current candidate and reviewed scope.
13. Disclose unresolved history in the eligibility receipt and impose mandatory
    disclosure in the later final receipt.
14. Make no unsupported causal claim about the historical failure.
15. Bind the immediate stop and recurrence invalidation rule below.
16. Verify a predeclared bounded diagnostic protocol with all attempts retained;
    no adaptive retry-until-pass selection or unreported intervening failures.
17. Independently validate structural/fail-closed evidence and rejection controls.
18. Bind exact dependencies and original accepted evidence for every reused group.

Conditions 13 and 15 are binding prospective obligations at eligibility time.
Their PASS means disclosure and the stop rule are in force, not that a future
receipt or campaign already exists. The final gate remains PENDING. A later
receipt must demonstrate actual compliance before that gate can be accepted.

This rule MUST NOT apply to semantic mismatch, wrong normative bytes, security
bypass, accepted late success, false completion, integrity violation, reproducible
product or harness defects, final recurrence, unexplained evidence of a currently
affected candidate, insufficient identity, missing history or a non-fail-closed
failure. A complete marker accompanying corrupt data is an integrity failure,
not proof of safety. Fail-closed behavior is necessary but insufficient.

## Evidence threshold and publication boundary

Separate evidence classes are mandatory: structural evidence, faithful
reproductions, enhanced observation, exact identity, negative controls and
fail-closed properties. A review must establish a finite protocol and explain
which distinct uncertainty each class addresses before executions. There is no
universal repetition number. A changed mechanism, environment, candidate or
contradiction needs a new review, not automatic reuse of this case's count.

For this case the already bounded three faithful observations test the same
operation, arguments except fresh workspace paths, inputs, environment, path
lengths, pinned runtime and C3CB closure. They check whether the operational
failure reproduces under the reviewed conditions. All three passed; none was
discarded. Enhanced observation adds raw I/O, helper lifecycle, QPC mapping,
sampled process identity and directory events. That is a distinct observability
purpose, not a fourth statistical sample used to estimate reliability. The one
enhanced run passed without injected fault/delay. Its sampling and event-log
access limits remain disclosed; no exact kernel exit or universal handle claim
is made. The additional diagnostic budget was not used after that result.

Together with source, frozen contracts, retained history and independent
negative controls, these observations establish eligibility, not final
certification. Repeating them until a preferred answer appears is forbidden.

The frozen **completion marker is the sole publication linearization point**.
Source writes/checks staged entries, renames result/evidence then manifest,
rechecks integrity, checks the terminal deadline and exclusively creates the
completion marker last. The consumer requires the exact four operational files
and validates their linked digests/run identity. Partial final files may remain
for diagnosis, but are unpublished. Independent checks reject the historical
two-file set and validate manifest-before-marker ordering in current traces.

## Final witness, recurrence and evidence reuse

After M3 and successful post-M3 validation, exactly **one** final missing-input
certification witness is authorized. It must use the frozen expected
INPUT_ERROR/11, complete canonical four-file bundle, exact C3CB package/runtime,
fresh exclusive workspace, reviewed protocol and bound raw evidence. Check
identity, deadlines, integrity, cleanup and independent consumer validation.
Create a durable start/attempt record before execution. Retain all evidence and
the single-attempt ledger, including any failed or interrupted attempt.

Any final-witness failure stops certification immediately. Recurrence of the
publication failure invalidates this exception and reopens the blocker. No
retry, new campaign name, clean-directory reset, or alternative successful
diagnostic can restore permission. An interrupted or unaccounted attempt cannot
be silently retried. Further work requires a new reviewed disposition. Changing
candidate bytes does not reset this authorization automatically.

If the final witness passes, combine it with exactly these retained eight groups:
corrected-cli-dispatch, late-helper, late-terminal, policy-cne, policy-fail,
policy-pass, timely-helper and valid-generate. Reuse requires original receipts,
raw evidence, candidate/runtime/tool/input dependency identity and unchanged
scope/environment assumptions, with explicit comparisons. Any drift invalidates
the affected reuse; unrelated groups need not rerun. Then proceed directly to
the separately governed hosted certification task. No hosted result, account
operation, workflow change or release label is authorized by a diagnostic PASS.

## Receipt and reporting obligations

Final certification receipts must reference a bound disclosure sidecar containing
the historical attempt/run ID, original and FAIL/UNRESOLVED disposition, failure
stage, unresolved-cause status, exact current candidate, fresh accepted witness
IDs/digests, enhanced-observation identity, fail-closed evidence, **actual M3
commit identity**, recurrence rule and all-attempt ledger. Include the accepted
final witness, not only the three diagnostic IDs. Use existing receipt artifacts,
limitations and reusedEvidence mechanisms; do not extend frozen product or
conformance schemas. The sidecar is additional methodology evidence, never an
extra member of the four-file product bundle.

M3 binds prior existing identities only, never its own future hash. Later receipts
bind the actual M3 commit. The offline transition checker models these obligations;
its injected evidence verifier is an interface, not an authorization to trust a
caller-supplied true flag. A later certification validator must independently
check the real evidence, append-only ledger and actual M3 revision. Tests of that
interface are synthetic and never substitute for the unexecuted final witness.

Never report that the historical failure was resolved while its cause remains
unknown. After actual later certification, permitted wording is: "Historical
unresolved failure retained; current candidate certified under corrected bounded
methodology." At M3 the correct wording is: "Historical unresolved failure
retained; current candidate eligible for one final certification witness."

## Mechanical MO-1306 application

The [eligibility matrix](../repositories/cca-conformance/evidence/mo1306/methodology-b/eligibility.json)
contains one evidence-bound row per condition: 18 PASS, 0 FAIL and
0 NOT_ESTABLISHED. The old criterion 10 remains NOT_ESTABLISHED in its original
receipt; this authority establishes the missing permission prospectively.
The decision remains candidate-specific and does not prove a historical cause.

Run `python -B repositories/cca-conformance/tools/mo1306-methodology-b/validate.py`
and `python -B repositories/cca-conformance/tools/mo1306-methodology-b/tests.py`.
Both are offline and execute no product. After M3, add `--post` to validation.
The latter verifies the exact single parent, approved file scope, clean main,
unchanged production, bound artifact closure and retained tags. Pre/post
workspace verification and Git whitespace checks are separate required gates.
