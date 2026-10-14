# MO-1307 READ_SET implementation optimization

This correction addresses repeated pure path validation in the fixed Windows
helper. It preserves Contract Freeze 1, both scoped publication/finalization
corrections, helper wire 2.0.0 and all frozen deadlines. It is correction
validation, not Phase 3A recertification or Phase 3D integration. The exact
execution results and source identities are recorded in the
[correction evidence](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction).

## Baseline and diagnostic authority

Work began on clean main at B2
`976d4a04d75dadc02e30215dd5a8ddeaa2352df8`, subject
`conformance(memoryos-1.3): bind MO-1307 phase 2 integration`, whose sole parent
is I2 `198da12a6b67da0104e54f98d2c8fbecbbf4a840`. The three certification
worktrees are read-only sources. The
[before inventory](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/source-certification-before.json)
binds every tracked and untracked nonignored regular file, exact Git state and
both original diagnostic input roots. Unrelated ignored caches and Git
administrative files are outside that inventory.

| Source | Exact identity | Preserved disposition |
|---|---|---|
| Phase 3A | HEAD remains B2; 11,712 inventoried files, 293,759,311 bytes, existing uncommitted report/evidence/tooling | CERTIFICATION_BLOCKED; separate READ_SET ROOT_CAUSE_ESTABLISHED |
| Phase 3B | `85dea823385e1ccaddcd9997c3918b1312175eba`, sole parent B2 | QUALIFIED_PHASE3B_PASS_PENDING_PHASE3D for old B2 package |
| Phase 3C | `191f34748141afca2027e8e9db0c6f1b6a9c84c0`, sole parent B2 | Accepted scoped security/governance certification of old B2 bytes |

The complete Phase 3A certification report, diagnostic report, classification,
MO-1306 and READY timing analyses, instrumentation description and failed native
receipts were reviewed. The
[diagnostic binding](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/diagnostic-binding.json)
independently verifies the request frames and all 84 original input files. It
also reverses all 104 marked instrumentation edits, including one expression
split, in each engineering copy to recover the exact 29,771-byte B2 helper,
SHA-256 `ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b`.
This supports the measurement-only source relationship; it is not a formal
proof that instrumentation has no timing effect.

The exact MO-1306 request is the retained Phase 3A
`diagnostic/attempt1/03.request.bin`: 7,579 bytes, SHA-256
`f880661fdd2efc69b6aa7c8c1f9d8c48512fc5fb941e672cfb296bd8b2d0e9b8`.
It requests sequence 3 READ_SET for 65 files totaling 2,004,208 bytes from
`C:\Users\melsa\Documents\Codex\cca-mo1307-3a\.cache\m7a-d1\i`.
Its original session, root, descriptors, ordering and input bytes are retained.
The READY comparison uses the retained 2,125-byte engineering request and
original root `C:\Users\melsa\Documents\Codex\cca-mo1307-3a\.cache\s3nat1\n0\i`:
19 files, 19,711 bytes. That request was originally reconstructed with a fresh
engineering session because the old failed READY request frame was not retained.

## Established cost and historical limits

The diagnosed operation class is repeated checked-chain identity/final-path
validation, especially post-read verification. The 65 file chains plus the
root chain contain 724 entries. Initial acquisition and held/fresh post-read
passes produce 2,172 identity inspections and 1,448 native opens. Repeated
Assert-Root calls total 2,239: 2,172 identity calls, 66 Open-Chain calls and one
request-root validation.

| Prior instrumented MO-1306 span | Milliseconds |
|---|---:|
| READ_SET | 4782.9163 |
| Initial per-file checked chains | 1470.7160 |
| Per-file post-read verification | 2823.8579 |
| Read-Identity, inclusive | 2938.2227 |
| Final-path validation nested within identity | 2340.6000 |
| Assert-Root/Assert-Relative, inclusive | 1963.1478 |
| Actual stream read/disposal spans | 23.2219 |
| Native open spans | 172.0771 |
| Canonical response serialization | 1349.2988 |

These timings overlap and must not be summed as independent elapsed costs.
The measured helper has uncalibrated instrumentation overhead; syscall spans
include PowerShell expressions and checks. The evidence establishes a bounded
operation class, not pure kernel latency, CPU versus scheduling attribution,
antivirus interference or a reason to tune the environment. Serialization is
a secondary completion cost; the prior partial acquisition observation does
not establish it as the immediate historical timeout stage.

The historical standalone MO-1306 and READY CLI failures remain TIMEOUT/29 at
8465.2111 ms and 11307.147 ms respectively, without publication. All three
exhausted certification diagnostics, product `cleanupConfirmed:false` and the
separate scoped observed-process witnesses remain unchanged. The subsequent
two engineering diagnostic executions do not turn those failures into product
success. The old READY failing slot remains unlocalized; isolated READ_SET
success cannot establish that its historical CLI failure is resolved.

## Minimal implementation change and trust argument

One substantive optimization pass was sufficient. Pass 1 removes the repeated
`Assert-Root $observed` call inside Read-Identity.
Open-Chain still validates each full expected path before constructing its
component paths. The expected path strings are immutable values in existing
request-local chain entries. Read-Identity still obtains a fresh native final
path, verifies its native prefix, removes that prefix, and compares the entire
result to the validated expected path with OrdinalIgnoreCase. The same trusted
expected-path validation supplies the lexical fact needed at that comparison;
native state is never cached or reused in place of a required observation.

All three Read-Identity call sites use the checked chain's expected paths:
initial native identity, held-handle reinspection and fresh reopened identity.
Read-Identity is shared by acquisition and publication inspection operations,
so the affected regression closure includes those operations even though the
demonstrated performance blocker arose in READ_SET.
Every required component open/reopen, GetFileInformationByHandle, GetFileType,
GetFinalPathNameByHandleW, native count/prefix check, reparse/type/link/size
restriction, volume comparison and seven-field identity comparison remains.
The complete newly retrieved final path is still returned in the Identity,
and exact post-read identity equality remains case-sensitive as before.

Assert-Root and Assert-Relative themselves are unchanged. No native observation
is carried across a freshness boundary. No new path cache, descriptor object,
global state, request persistence, watcher, process, thread pool, compiler or
native authority is added. Existing expected-path strings are reused; removing
repeated lexical parsing adds no new retained data structure. Actual process
memory measurements, when reported by the correction harness, are observations
of whole-process behavior and do not establish a hard OS RSS sandbox.

The [independent source review](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/helper-security-review.json)
mechanically confirms this is the only executable statement removed; the other
changed lines explain its trusted-path precondition. The corrected helper is
30,210 bytes, SHA-256
`35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8`.
No second pass was needed. The serializer and response construction are unchanged. Request
framing, canonical property ordering, whitespace, base64, response fields,
session/sequence rules, error codes and native refusal behavior retain their
frozen contract. Exact before/after frames and controlled freshness mutations
are required evidence for accepting the optimized source; a source argument
alone does not claim those executions passed.

## Unchanged operational limits

| Boundary | Fixed value or rule |
|---|---|
| Helper | 5000 ms per invocation, strictly before deadline |
| Aggregate active helper time | 20000 ms |
| CLI admission | 30000 ms |
| Worker and byte API | 10000 ms |
| Ordinary cleanup | 2000 ms |
| Helper requests | Nine evaluate; four verify; one frame and EOF per invocation; no retry |
| Roles | Supervisor, one helper and possible owned console host; no helper/worker overlap |
| Wire/Identity | 2.0.0 and the same seven-field Identity |
| Package/contract | memoryos-readiness@0.1.0 / memoryos.readiness@1.0.0; zero external production npm dependencies |

The irreversible-publication correction remains authoritative: an admitted
non-cancellable rename is awaited to actual settlement, with its existing
shared post-settlement allowance and retained availability limitation. This
READ_SET optimization adds no grace, deadline relaxation or publication change.

## Validation and remaining scope

The [equivalence campaign](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/equivalence/attempt1/receipt.json)
and [security/freshness summary](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/security-freshness.json)
record 39 passing before/after pairs: seven successful requests and 32 refusals,
78 helper processes in total. Exact response frames match for every pair.
The corpus covers all 22 requested security categories and all six freshness
categories. A separate read-only review decoded and compared all 78 frames
and independently checked the 19 instrumented counter pairs.

All 17 controlled mutation pairs refused equivalently. Four perform actual
engineering filesystem replacement, size, reparse or ancestor changes; the
others perturb observed fields or expected paths and are explicitly synthetic.
Engineering copies release the held leaf where necessary to permit a mutation
that production sharing normally prevents. Those hooks are absent from
production; this is not a claim that an attacker can bypass the original
sharing restriction. For the exact MO-1306 counter pair, both implementations
perform 1,448 opens and 2,172 identity/information/final-path calls. Post-read
file identities account for 1,430 calls and final root checks for 18; none of
the required fresh observations was removed.

The B2 oracle uses a separate 20-second engineering observation guard to obtain
its canonical response. It is not a B2 product timing pass, and its duration
is not compared to a timeout frame. The corrected candidate then runs through
the actual uninstrumented fixed helper and supervisor with unchanged limits:

| Run | Full exchange, ms | Helper active, ms | Margin below 5000 ms | Result |
|---|---:|---:|---:|---|
| [MO-1306 1](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/performance/mo1306-run1/receipt.json) | 3129.6876 | 3127.4022 | 1870.3124 | PASS |
| [MO-1306 2](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/performance/mo1306-run2/receipt.json) | 2945.6094 | 2943.7280 | 2054.3906 | PASS |
| [MO-1306 3](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/performance/mo1306-run3/receipt.json) | 2783.4989 | 2781.4892 | 2216.5011 | PASS |
| [READY](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/performance/ready-run1/receipt.json) | 1269.1151 | 1268.1331 | 3730.8849 | PASS |

All four use the original roots and retained exact frames, match the oracle
bytes and confirm helper exit/quiescence. The worst retained MO-1306 full
exchange is 3129.6876 ms. All runs count; no slow run was discarded. Each starts
a fresh helper, but ordinary OS cache state is uncontrolled: no cold-cache,
warm-cache-only or every-host performance guarantee is claimed.

The instrumented MO-1306 pair observed B2 peak working set 153,403,392 bytes
and corrected-helper peak 180,015,104 bytes, a 26,611,712-byte increase. Managed
heap snapshots were 33,177,176 and 33,172,160 bytes respectively. These are
whole-process observations with engine, GC and instrumentation effects; the
peak difference cannot be attributed to the optimization or used as an isolated
allocation measurement. The executable diff adds no retained production cache
or metadata structure. Existing resource limits remain unchanged, and no new
hard RSS ceiling is invented.

Both exact packaged CLI smokes passed using the original historical input roots
and new, exclusively created output parents in the main workspace. They used
the fixed entrypoint, pinned runtime and normal production helper/worker path,
with no launch hook, deadline override or retry:

| Case | CLI elapsed, ms | Exit | Published bytes | Result |
|---|---:|---:|---:|---|
| [MO-1306](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/cli-smoke/mo1306/receipt.json) | 11067.2351 | 2 | 303620 | READY_WITH_QUALIFICATIONS; exact result and summary |
| [READY](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/cli-smoke/ready/receipt.json) | 8500.8851 | 0 | 59987 | READY; exact result and summary |

Each successful run follows the unchanged nine-helper, one-worker topology.
The parent directly observed the CLI process and all three pipes close. Helper
and owned-console quiescence additionally follows the source-bound successful
production transport checks and supervisor disposal; this is not independent
OS-wide descendant enumeration. Both receipts confirm unchanged source inputs
and record the final output namespace. Historical failed-run cleanup and the
unlocalized historical READY failure remain unchanged.

The [package refresh](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/package/pass-1/receipt.json)
preserves the 89-member allowlist, 53 contract members and zero external
production dependencies. Only the helper and its dependent SPDX/distribution
metadata change in the product package. The refreshed SPDX document is 47,328
bytes, SHA-256
`7997bb939027132d307864750331ba70c0538a7590aea2773cafa5e3759aabaa`;
the distribution manifest is 12,631 bytes, SHA-256
`5802973c276d10f48db51f842101cd664fbc21e13a74b344a9e0b421746ffc09`.
Package JSON and the contract manifest retain their exact B2 bytes. This
refresh does not certify an archive assembly or installed artifact.

The final affected regression closure passed without failures or retries:

| Retained receipt | Verified scope | Result |
|---|---|---|
| [Cheap checks](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/regressions/cheap-attempt1/receipt.json) | 31 commands; syntax/import, 52 schemas, 476 schema fixtures, 485 fixture catalog entries and package closure | PASS |
| [Package suite](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/regressions/package-attempt1/receipt.json) | 8 original tests | PASS |
| [Phase 1 native/helper suite](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/regressions/phase1-native-attempt1/receipt.json) | 25 original tests, including actual fixed helper and packaged CLI controls | PASS |
| [Phase 2C closure](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/regressions/phase2c-attempt1/receipt.json) | 219 original runtime, publication, finalization, inspection, API/CLI and timer tests | PASS |
| [Phase 2D semantics](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/regressions/phase2d-attempt1/receipt.json) | 58 original integrated semantic tests | PASS |
| [Selected vectors](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/regressions/vectors-attempt1/receipt.json) | 16 exact accepted 2A/2B/integrated vector comparisons | PASS |

All bound test, tool, fixture and product inputs are unchanged across each
execution. The 219-test suite includes its publication/finalization subsets;
those subsets are not counted again. The vector checks preserve exact accepted
result, readiness/projection/audit and proof bindings, including the already
accepted MO-1306 raw-lineage correction. Pure semantics and synthetic lifecycle
controls remain explicitly distinct from actual native execution.

The [final source comparison](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/source-preservation-final.json)
rehashes all 34,668 inventoried certification-source files and all 101 regular
files in the two original input roots, including control files. Exact Git
metadata, status, file-name sets and bytes remain unchanged. This final check
leaves the earlier full before/after snapshots and all historical failures
untouched.

These successful correction runs establish the corrected candidate's observed
behavior for their retained cases. They do not resume Phase 3A, explain the old
READY failure, certify every host/input shape or authorize release. Pass 1
meets the correction performance target, so the permitted second substantive
optimization pass is unused.

## Targeted certification refresh and binding

The [certification impact record](../repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/certification-impact.json)
classifies both 3B and 3C as TARGETED_REFRESH_REQUIRED. Their accepted commits
remain untouched historical authorities for old B2 bytes.

For 3B, refresh the helper's SHA1/SHA256 member identity; the SPDX helper row,
package verification code and closure-derived document namespace; the
distribution helper/SBOM rows; exact archive size/SHA256/SHA512 and archive
inventory; both independent assemblies; offline installed before/after
inventories; and package/provenance/binding receipts tied to the actual
corrected source. The old 3B npm archive is 112,154 bytes, SHA-256
`6335c3ae18d9ab2ba1af3523d3dd4458ca832ed37fdce868729409277533744b`.
The separate 3A 113,046-byte archive uses a different recorded assembly method;
neither historical archive is silently replaced. Package version, explicit
89-member set, 53 contract members, 52 schemas, runtime identities, dependency
policy and notices may remain reusable only after exact dependency checks.

For 3C, changed check structure requires a focused independent review, beyond
refreshing a hash. Affected controls are filesystem/TOCTOU/final-path identity,
fresh held/reopened observations, helper frames and canonical refusal bytes,
fixed PowerShell/native authority, cleanup/process boundaries, resource limits
and package/source review identity. Unchanged readiness, evidence authority,
history, qualifications, providers, DAG, decisions and tag-observation evidence
may be reused by explicit dependency analysis. Preserve the native downstream
volumeSerial-branch coverage limitation and private immutable-root assumptions.

C3R must be the single implementation child of exact B2, with subject
`fix(memoryos-1.3): optimize MO-1307 native READ_SET acquisition`. It contains
the helper optimization, dependent generated package metadata and correction
evidence that needs no future commit identity. C3RB must be its sole binding
child, subject `conformance(memoryos-1.3): bind MO-1307 READ_SET optimization`,
with no production changes. Actual commit/tree identities belong in the later
binding record; this report invents neither hash.

After C3RB's graph, evidence, package, regression and workspace checks pass,
the next separately authorized task is targeted Phase 3 recertification from
that exact verified C3RB: independent 3A installed runtime certification and
the scoped 3B/3C refreshes above. Do not start 3D until those accepted inputs
exist. No push, tag, provider account, Linux/Ubuntu/WSL or VM is used or
authorized by this correction.
