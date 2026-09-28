# MO-1307 Phase 1 contract fixtures

These are engineering test inputs and expected bytes for Contract Freeze 1.
They are **not certification receipts, product release approvals, or newly run
MO-1305/MO-1306 evidence**. Synthetic provider execution certificates describe
hypothetical test inputs only. The released MO-1306 vector retains its actual
qualified provider matrix and historical failures.

The independent engineering constructor is
[`generate-fixtures.mjs`](../../tools/mo1307-phase1/generate-fixtures.mjs). Run
it from the workspace with the pinned Node 24.21.0 Windows x64 runtime. Adding
`--check` computes every expected byte again and rejects any mismatch. It
reads local predecessor files and Git objects only; it starts no campaign and
uses no network. It never imports a production gate evaluator. Production
Phase 1 does not yet evaluate complete readiness results.

For the bounded characterization harness only, `--maximum-dir
.cache/mo1307/phase1/characterization-inputs/maximum` constructs disposable
cache inputs instead of changing this tracked corpus. That vector combines
1,024 candidate components, 128 manifest files, exactly 8,388,608 aggregate
evidence bytes, a 2,097,152-byte raw source and a 262,144-byte envelope. Its
1,473 explicit synthetic semantic identities fill the semantic envelope while
the graph remains at 1,061 nodes / 7,163 edges. Every padding source is bound
by the artifact grant. This is a large admitted vector for foundation
characterization, not a claim that every independently bounded dimension can
simultaneously reach its ceiling or that Phase 3 performance is certified.

`catalog.json` lists every generated file's SHA-256 and length, and classifies
records against their local schema wrapper. The catalog is engineering metadata,
not a new product input schema. Its file list excludes the catalog itself and
this documentation. `schema` is the basename before `-1.0.0.schema.json`.
`schemaValid` describes JSON Schema acceptance; `foundationValid` describes
closed record/ordering/local foundation acceptance, **not** successful complete
evidence evaluation. Positive complete-result fixtures additionally pass their
canonical readiness/proof identity checks.

Negative layers are explicit:

| Layer | Meaning |
|---|---|
| `PARSER` | Invalid bytes or parser limits; `schemaValid:null` because strict decoding is rejected before schema validation. |
| `SCHEMA` | Closed-shape, enum, local predicate or count violation. `expectedCode` names the contextual product error, which generic schema validation alone does not select. |
| `FOUNDATION` | Well-shaped but locally invalid order/reference/structure. |
| `PHASE2` | Locally accepted record requiring externally pinned bundle bindings, full gate composition, or independent result/decision recomputation. No Phase 1 end-to-end rejection is claimed. |

`verificationBundle` names the baseline bundle for a replacement record.
Default replacements preserve the original external pins. An explicit
`repinAuthority:true` means the test harness changes only the externally
supplied trusted root digest to the replacement authority bytes, allowing the
next manifest integrity check to be exercised. `repinEnvelopeAndGrant:true`
means the engineering harness consistently rebuilds the envelope raw hash,
claim digest, manifest, grant, root and external root pin to isolate a later
dependency/qualification check. It does not mean evidence may choose its own
production trust pin. History omission/rewriting with the original grant is an
authority mismatch: production does not rediscover authority by parsing opaque
legacy files.

Each `bundles/<name>/` directory is an independent evidence root: configuration,
candidate, manifest, reviewed fixture authority, exact sources/envelopes, separate
operator pins, expected graph, expected result, and expected JSON summary.
The separate `pins.json` file supplies test-harness launch arguments. A product
config or envelope must never select these arguments for itself.

| Bundle | Purpose / expected readiness |
|---|---|
| `ready` | Complete synthetic CI/CD assertions, `READY`; correct expected Policy FAIL/CNE and INPUT_ERROR/11 remain valid conformance facts in the source. |
| `qualified` | Four provider limits plus bounded advisory, `READY_WITH_QUALIFICATIONS`. |
| `not-ready` | Known security check failure and retained blocker, `NOT_READY`. |
| `could-not-evaluate` | Trusted unavailable security slot, `COULD_NOT_EVALUATE`. |
| `mixed-precedence` | Blocker + unavailable resource gate + qualifications, all retained, `NOT_READY`. |
| `history-blocker-unavailable` | Known observed historical condition blocks an unavailable security gate while retaining its CNE. |
| `informational-ready` | Informational environmental qualification retains `READY`. |
| `rest-qualified` | REST profile, no providers/adapters, same-host remote disclosure. |
| `metadata-only` | Same normalized readiness digest as `ready`, different proof binding. |
| `selective-reuse` | Unrelated documentation component changes the candidate root; unchanged complete security dependencies support an explicit reused claim. |
| `post-tag-ready` | Correct synthetic annotated post-tag observation. |
| `pre-tag-present` | Present tag blocks pre-tag readiness. |
| `post-tag-absent` | Missing post-tag observation blocks presence only. |
| `post-tag-wrong-target` | Wrong supplied target blocks the tag gate. |
| `post-tag-lightweight` | Lightweight supplied tag blocks annotation. |
| `mo1306-qualified` | Actual released predecessor normalization, `READY_WITH_QUALIFICATIONS`. |

`positive/` covers all fourteen evidence types, all qualification reason classes,
provider axes, historical rows, graph-related records, human-independent proof
records and an operational error. `human/` covers APPROVE, REJECT and DEFER for
all four states. The decision records remain outside every result and digest.
Unknown/null actors are never authenticated. Proof, readiness and candidate
mismatch negatives exercise the three independent decision bindings.

The negative corpus covers candidate/profile substitution, raw/claim/proof
hash corruption, forged authority, stale/incomplete dependencies, dangling
graph references, qualification omission/weakening, false hosted promotion,
history omission/rewriting, blocker suppression, and self-consistently hashed
false result states. The fixed six-node/five-edge graph topology is acyclic by
construction. Consequently `graph-cycle` is deliberately schema-invalid and
marked `internalGraphProbe:true`: direct defensive cycle detection exercises
`GRAPH_CYCLE`; ordinary external schema rejection remains distinct. The node
limit fixture exceeds 2,048 nodes by one.

`scenarios/acquisition.json` contains bounded future acquisition/publication
test recipes for cap+1 envelope/source bytes, Windows reparse escape, unexpectedly
missing declared input, deadline/cancellation precedence, late completion,
partial publication, output overflow and mixed root-integrity/CNE precedence.
These recipes avoid committing multi-megabyte repeated padding and do not claim
that Phase 2 Windows helper/publication behavior is implemented or tested now.

## Released MO-1306 normalization

`bundles/mo1306-qualified/predecessor-map.json` binds C3CB production, M3
methodology, S3 scope, I3 immutable inventory, BF final binding and the actual
annotated tag object. Its source map records original paths and exact bytes;
the `sources/*.data` copies remain opaque and unmodified. All 94 released
package members are represented in the candidate source closure. Separate role
aliases bind schemas, security controls, documentation and the five provider
adapters without dropping the original source-member identity.

The singular CONFIGURATION component is a reviewed finite inventory of the
eight exact retained product/integration configuration files; each constituent
is separately copied and hashed. It is not the readiness launch config and
does not claim every legacy attempt ran one identical configuration. TOOLCHAIN
is a reviewed inventory of exact Node/npm and engineering-validator identities
from released provenance. The final archive, expanded SPDX SBOM, provenance,
distribution and runtime closure retain their released sizes and digests.

All **19** original history inventory rows remain bound raw sources. Only its
**12** failure/unclosed rows are projected into the new negative History type.
Each `originalDisposition` is byte-for-byte the original text; normalized IDs
use a `history.` prefix because the predecessor ID `3a-deadline-blocker` is not
an MO-1307 Id. The source IDs and original paths remain explicit. Historical
supersession describes applicability under later accepted evidence, never a
new causal diagnosis or conversion to PASS. Five unresolved publication/hosted
observations retain individual historical disclosures. Native publication
recurrence is `NOT_OBSERVED` under retained M3 evidence; no elapsed-time expiry
or retry is inferred.

Generic remains IMPLEMENTED / REAL_EXECUTION_CERTIFIED validation and execution /
SUPPORTED. GitHub remains OFFLINE_VALIDATED with normalized
HOSTED_EXECUTION_NOT_CERTIFIED, original source label NOT_CERTIFIED, and all
hosted case/parity flags false. GitLab, Jenkins and Azure remain contract-only
and NOT_LIVE_PROVIDER_CERTIFIED. Both failed hosted run IDs remain in the exact
raw source records. Four provider limitations, bounded advisory and five
historical disclosures remain visible in the expected result.

The new authority/grants and normalized assertions are reviewed **fixture**
inputs derived from these released facts. The predecessor never issued an
MO-1307 candidate digest, fixture configuration inventory, or readiness result.
The fixture does not retroactively add one to its historical receipts, grant
organizational authentication to a hash, resolve an unknown cause, or authorize
another hosted/native attempt. Phase 2 must independently reproduce the expected
bytes from the supplied trusted fixture inputs.
