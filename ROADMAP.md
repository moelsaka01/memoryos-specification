# CCA reference workspace roadmap

This roadmap separates implemented increments from proposed work. It does not
authorize behavior beyond [the architecture](ARCHITECTURE.md).

## MemoryOS product releases

| Release | Status | Scope |
|---|---|---|
| MemoryOS 1.0 | Released | Deterministic memory lifecycle, source-preserving knowledge, retrieval, reflection, provider-neutral handoff, and the frozen Memory Studio contract |
| MemoryOS 1.1 | Released — v1.1.0 | Stable Semantic World, Cognitive Trace, Living Connectome, Cognitive Replay, Cognitive Polish, Cognitive Evolution, Comparative Reconstruction, and integrated investigation workflow |
| MemoryOS 1.2 | Released — v1.2.0 | Canonical Memory Investigation Packages, dependency-free AI runtime adapters, one renderer-independent Investigation Core, public SDK facades, the official SDK-backed CLI, deterministic Cognitive Regression Analysis, the Cognitive Investigation Explorer, CCA-MEMORYOS-1.0, and its official Conformance Suite |
| MemoryOS 1.2.1 | Corrective restoration | Restores omitted intended v1.2 source, registered tests, fixtures, examples, documentation, frozen Standard and MIP publication assets, and corrected conformance provenance while preserving all v1.2 semantics and CSP fixes |
| MemoryOS 1.3 | In development; MO-1301 through MO-1308 RELEASED | Engineering Operations: Policy / Core Foundation, GitHub Policy Gate, VS Code integration (released with an external-infrastructure exception), certified MCP Server and Agent Integration, certified REST Gateway, qualified Provider-Neutral CI/CD Integration, certified Release Governance and Readiness (V2 stale-test correction bound, 639/639), and certified Investigation History (BF `bf2fdc87`); MO-1309 CONTRACT FREEZE 1 FROZEN / PHASE 1 NEXT |

MemoryOS 1.1 is additive. It preserves the MemoryOS 1.0 runtime and public
contracts while moving deterministic investigation into the downstream Studio
presentation. The renderer consumes validated projections; it does not derive
traces, replay order, evolution, or divergence.

The complete milestone map and evidence index are maintained in the
[MemoryOS 1.1 documentation index](repositories/cca-studio/docs/README.md).
Measured performance, scalability, benchmark, UX, accessibility, and
documentation evidence closed MO-1108. Those historical supporting artifacts
are not retained in the v1.2.1 source archive. RC-001 validated the production
workflow, RC-001A completed the documentation freeze, and RC-001B completed the
repository audit without changing the product architecture.

MemoryOS 1.2 delivers MIP-001 and its MO-1201 implementation. MO-1202 adds
provider-neutral interfaces that privately validate OpenAI Agents SDK,
Anthropic SDK, and LangGraph event lifecycles and translate only settled
source-authored cognition into verified, Observation-only MIPs. The reference
adapters do not import provider SDKs, persist transport state, control external
runtimes, or infer cognitive semantics.

MO-1203 establishes the [Investigation Core](repositories/cca-studio/docs/investigation-core.md)
as the single execution authority for create, load, restore, archive, Replay,
comparison, verification, checkpoints, MIP export, and MIP import. State is
always derived from an append-only digest-linked transition log. Studio and
future clients consume immutable projections instead of implementing
investigation behavior.

MO-1204 exposes that authority through the [MemoryOS SDK](repositories/cca-sdk/README.md).
Studio consumes the JavaScript facade; Python and C++ use one versioned private
binding to the same JavaScript Core. The SDK requires explicit snapshots,
Reflection selections, comparison sessions, checkpoints, and packages. It
adds no cognition or package construction behavior, and native export remains
available only for investigations imported from valid MIP artifacts.

MO-1205 implements the [MemoryOS CLI](repositories/memoryos-cli/README.md) as
the first standalone SDK consumer. Human and canonical JSON output, explicit
Trace/Replay/Compare inputs, exact MIP import/export, deterministic exit codes,
and live JSON Lines sessions support local automation and CI without copying
Investigation Core or MIP semantics. Checkpoints remain opaque and confined to
the live CLI session that created them.

MO-1206 introduces [Cognitive Regression Analysis](repositories/cca-sdk/docs/regression-guide.md)
as the first AI engineering workflow built on the completed platform foundation.
One read-only Regression Engine in the Investigation Core compares Replay,
Reflection, Evidence, Retrieval, Evolution, Verification, transition history,
and lifecycle truth. JavaScript, Python, C++, and CLI consumers expose the same
immutable report without heuristics, scoring, explanation, or AI inference.

MO-1207 adds the
[Cognitive Investigation Explorer](repositories/cca-studio/docs/cognitive-investigation-explorer.md).
It navigates exact evidence locations already carried by a validated regression
report and returns immutable, canonically ordered pointers through the same
Core, SDK, CLI, and Studio boundaries. It does not rerun Replay, recompute a
regression, load source cognition, rank evidence, or interpret a difference.

MO-1208 publishes CCA-MEMORYOS-1.0 as the implementation-independent MemoryOS
Standard and activates the
[official conformance suite](repositories/cca-conformance/README.md). The
Standard incorporates the exact CCA-RF-1.0 and CCA-MIP-1.0 baselines and
defines lifecycle, adapter, Core, SDK, CLI, Regression, Explorer,
compatibility, versioning, and certification obligations without changing
platform behavior. MemoryOS 1.2.0 is the initial Reference Implementation, not
the normative source of those obligations.

MemoryOS v1.2.1 is the corrected Reference Implementation baseline. It repairs
the v1.2.0 source and publication inventory without changing the Standard, MIP,
Investigation Core, SDK, CLI, Regression, Explorer, lifecycle, or Studio
semantics. The v1.2.0 commit, tag, manifest, and evidence remain immutable
historical records.

MO-1301 implements closed Policy and Policy Set artifacts, an atomic
PolicyFactContext projection, one registered optional Cognitive Regression fact
source, six first-party rules, deterministic evidence and aggregation, a fixed
Resource Profile, Evaluation Identity, canonical outcomes, SDK/CLI 1.1
integration, and a separate MemoryOS 1.3 conformance inventory. It is additive
over the v1.2.1 compatibility baseline. MO-1302 consumes these artifacts and
stable exit codes as a separate milestone; it was not implemented by MO-1301.

CCA-MEMORYOS-1.1 remains the intended later normative target. Candidate
materialization follows frozen implementation behavior, cross-language parity,
conformance, and independent review; the Standard will codify that behavior
rather than evolve as another Policy semantic authority.

## MemoryOS 1.3: reconciled roadmap after MO-1306

This is the current prospective roadmap, reconciled after the MO-1306 release.
It combines the earlier integration/product and standards/product directions
without renumbering the released milestones. MO-1301 through MO-1306 retain
their existing scope, commits, contracts, conformance history, evidence, and
tags. MO-1306 is released with its qualified provider matrix and
[hosted scope correction](docs/mo1306-hosted-certification-scope-correction.md).
MO-1307's [roadmap authority](docs/mo1307-release-governance-readiness.md)
establishes release governance and readiness boundaries. Its
[Contract Freeze 1](docs/mo1307-contract-freeze-1.md) resolves all 50 decisions.
Its Phase 1, 2 and 3 work is complete and bound by the
[Phase 3D final certification](docs/mo1307-phase3d-certification.md), and
MO-1307 is released at annotated tag `memoryos-1.3-mo1307`.
MO-1308's [roadmap authority](docs/mo1308-investigation-history.md) establishes
Investigation History scope and owner decisions; its
[Contract Freeze 1](docs/mo1308-contract-freeze-1.md) is frozen. MO-1308 is
released at annotated tag `memoryos-1.3-mo1308` (tag object
`3ddb8243dcb9dcf023aa7df45552f71b86ccca20`), peeling exactly to binding-only BF
`bf2fdc87e9b2bfc25588ef61deacac6c04684376`.
MO-1309's [authority](docs/mo1309-cloud-dashboard.md) establishes the Cloud
Dashboard scope and owner decisions; its
[Contract Freeze 1](docs/mo1309-contract-freeze-1.md) is frozen.

| Milestone | Title | Status | Architectural layer |
|---|---|---|---|
| MO-1301 | Policy / Core Foundation | CLOSED / RELEASED | Existing semantic and Policy foundation, including Investigation Policies and SDK/CLI integration |
| MO-1302 | GitHub Actions / GitHub Policy Gate | CLOSED / RELEASED | GitHub-specific CI integration over the existing Policy authority |
| MO-1303 | VS Code Extension | CLOSED / RELEASED WITH EXTERNAL-INFRASTRUCTURE EXCEPTION | VS Code developer integration |
| MO-1304 | MCP Server and Agent Integration | CLOSED / CERTIFIED / RELEASED | MCP / agent integration over existing MemoryOS capabilities |
| MO-1305 | REST Gateway | CLOSED / CERTIFIED / RELEASED | Bounded REST/API integration |
| MO-1306 | Provider-Neutral CI/CD Integration | CLOSED / QUALIFIED CERTIFICATION / RELEASED | Provider-neutral CI/CD integration with preserved provider limitations |
| MO-1307 | Release Governance and Readiness | CLOSED / CERTIFIED / RELEASED (V2 STALE-TEST CORRECTION BOUND, 639/639) | Deterministic evidence-backed readiness; final release authorization remains human |
| MO-1308 | Investigation History | CLOSED / CERTIFIED / RELEASED (BF `bf2fdc87`) | Durable investigation/evaluation history and traceability |
| MO-1309 | Cloud Dashboard | CONTRACT FREEZE 1 FROZEN / PHASE 1 NEXT | Static, offline, cloud-ready, read-only dashboard over MO-1308 exports |

Later milestones must delegate to existing semantic authority rather than
silently reimplementing MemoryOS semantics. The MO-1306 freeze and scope
correction retain their released scope. MO-1307 is released after Phase 3D
certification. MO-1308 is released after Phase 3D certification. MO-1309 has its
authority; it still requires its own Contract Freeze. Unrelated proposals
elsewhere in this document remain proposals.

### Released history and authority

MO-1301 retains the [Policy specification](docs/investigation-policies.md) and
release tag `memoryos-1.3-mo1301`. MO-1302 retains the
[GitHub Policy Gate contract](repositories/cca-conformance/docs/mo1302-github-policy-gate.md)
and release tag `memoryos-1.3-mo1302`. Its GitHub-specific implementation and
history are not reassigned to MO-1306.

MO-1303 is released at
`memoryos-1.3-mo1303`, with final conformance binding
`49aa80fa76bffc03e36335be8ab805bb5dc38f9c`, under an explicit
external-infrastructure exception: Ubuntu and Windows hosted certification
PASS; macOS hosted certification NOT EXECUTED due external GitHub
runner-allocation/billing restriction; three-platform parity NOT EXECUTED.
Strict three-platform validation and predecessor history remain intact.

MO-1304 is certified and released at annotated tag `memoryos-1.3-mo1304`,
targeting final conformance binding
`ce7b001d911239fa50d904f5f336bb1bd7858ba3`. The
[original MCP roadmap authority](docs/mo1304-mcp-server-agent-integration.md),
subsequent frozen contracts and corrections, production implementation,
package, receipts, evidence, and final binding remain unchanged. The
[Windows support correction](docs/mo1304-contract-freeze-windows-support-correction.md)
and [Windows certification and parity record](repositories/cca-conformance/docs/mo1304-phase3-windows-certification.md)
remain released history: Windows 11 x64 support, actual Windows 11 Home 25H2
build 26200.9457 x64 execution, Ubuntu 24.04 LTS x64 certification, and
two-platform parity PASS. Their recorded evidence limits and risk dispositions
remain intact; macOS remains unsupported for MO-1304.

Earlier development-stage status text in the product overview, changelog,
repository indexes, predecessor guides, and frozen integration packages describes
the stage when it was written. The original MO-1304 authority's section 16 records
the then-undefined MO-1305 and the then-next Contract Freeze 1 task. Those
statements, the original MO-1305/MO-1306 authorities, freezes, corrections and
phase reports' then-next tasks, and pre-tag pending fields in inventories and
receipts, remain historical records. This section supplies current milestone status and
prospective assignments without changing their semantic contracts or evidence.
The MO-1302 exclusions of MO-1306/MO-1307 remain valid frozen scope boundaries.

### MO-1305: REST Gateway

Status: **CLOSED / CERTIFIED / RELEASED**.

The released authority remains
[MemoryOS 1.3 MO-1305 — REST Gateway](docs/mo1305-rest-gateway.md) and
[Contract Freeze 1](docs/mo1305-contract-freeze-1.md), with their corrections.
The [platform correction](docs/mo1305-contract-freeze-1-platform-correction.md)
removes Ubuntu/Linux, VM and cross-platform parity requirements for v1;
independent SDK semantic parity remains required. The
[verification correction](docs/mo1305-contract-freeze-1-verification-methodology-correction.md)
and [release-metadata correction](docs/mo1305-release-metadata-correction.md)
retain their exact historical scope. The
[Phase 3D release record](docs/mo1305-phase3d-release.md) records completed
Phase 1/2/3 and Windows, artifact, and security certification.

The released gateway exposes selected existing MemoryOS capabilities through a
bounded HTTP/API surface while delegating semantic authority to existing
MemoryOS implementation layers. The frozen v1 contract selects six SDK-backed
semantic operations and three operational endpoints under `/v1`, native TLS over HTTP/1.1, bearer
authentication, explicit remote mode, bounded execution, and a dependency-free
Node adapter. It defines measured resource gates, release-bound OpenAPI,
installed-package certification on the existing physical Windows 11 x64 host only,
and non-self-referential implementation/evidence binding.

Annotated tag `memoryos-1.3-mo1305` exists locally and remotely with object
`741e596454cfbcc908b8bd576b4fa97311139083`, peeling exactly to final binding
`5955af062152a84c10de17860ba0bcabe8b3555f`. The inventory's committed
CERTIFIED_READY_TO_TAG / READY_TO_TAG fields and receipt snapshots retain their
pre-tag meaning; the verified tag supplies the later released fact. This
reconciliation changes no package, contract, receipt, evidence, or release tag.

### MO-1306: Provider-Neutral CI/CD Integration

Status: **CLOSED / QUALIFIED CERTIFICATION / RELEASED**.

The focused roadmap authority is
[MemoryOS 1.3 MO-1306 — Provider-Neutral CI/CD Integration](docs/mo1306-provider-neutral-cicd.md).
Its decisions A–AF are resolved by
[Contract Freeze 1](docs/mo1306-contract-freeze-1.md). The freeze selects one
SDK-backed provider-neutral core, a first-class native Windows generic runner,
one closed configuration/result/evidence contract, deterministic GitLab,
Jenkins, Azure and GitHub provider files, uniform exit mapping, and a single
offline package. Regression uses the existing SDK/CLI acquisition path.
The earlier authority's status/open register describes its authorization stage;
its hard constraints remain binding. Production authority is C3CB, methodology
authority is M3, and the [S3 scope correction](docs/mo1306-hosted-certification-scope-correction.md)
authorized qualified Phase 3D integration. The
[final integration](docs/mo1306-phase3d-qualified-release.md) and
[final inventory](repositories/cca-conformance/mo1306-final-release-inventory.json)
bind the corrected candidate, native certificate, audits and hosted limitation.
Phase 1/2/3 are COMPLETE under that released authority. Annotated tag
`memoryos-1.3-mo1306` exists locally and remotely with object
`9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8`, peeling exactly to final binding
`332ab0d2c35643ea8d155bcbea9c5019b304bbe3`. The MO-1307 baseline review verified
that local `main`, `origin/main` and remote `main` were synchronized at that
commit with a clean working tree. The committed CERTIFIED_READY_TO_TAG and
ABSENT-tag fields retain their pre-tag meaning; the verified tag supplies the
later released fact. No historical receipt or inventory is rewritten.

Native Windows 11 x64 generic execution is required. A separate Windows
`windows-2022` GitHub Actions integration preserves released MO-1302 behavior;
the original freeze required a safely feasible hosted attempt and explicit
limitation disposition. S3 makes hosted execution certification optional and
non-blocking for v1 after the bounded investigation ended unresolved. Generic
retains REAL_EXECUTION_CERTIFIED. GitHub remains IMPLEMENTED / OFFLINE_VALIDATED /
NOT_CERTIFIED hosted (HOSTED_EXECUTION_NOT_CERTIFIED in release wording),
SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION. Implemented,
contract-validated, and actually executed integrations retain distinct labels.
GitLab/Jenkins/Azure require usable adapters and strong offline schema/grammar,
security and generic-equivalence validation; live-provider certification is not
required. Documentation alone does not constitute implementation or PASS.

Every MO-1306 v1 phase must be implementable, testable, certifiable and
releasable without Linux, Ubuntu, WSL, VirtualBox, VMware, Hyper-V VM or any
other VM; without GitLab accounts/subscriptions/runners, Jenkins servers,
installations/accounts/plugins/self-hosted infrastructure, Azure or Azure
DevOps accounts/subscriptions/organizations/hosted pipelines, or paid external
CI/CD resources. No future phase may require the user to create or administer
them or become BLOCKED because they are absent. GitHub and GitHub Actions are
available; no additional paid service is a release prerequisite.

MO-1307 owns evidence-backed release readiness and bounded governance contracts,
with final release authorization remaining human; MO-1308 retains durable
Investigation History, and MO-1309 retains Cloud Dashboard. MO-1306 adds none of those products and
does not expand VS Code, MCP, or REST. MCP and REST are not automatically
required semantic transports. The freeze defines bounded Windows processes,
filesystem/network/secret boundaries, resource and task budgets, package and
supply-chain review, phased implementation and acyclic conformance binding.
S3 changed only release scope and conformance/documentation. Released Phase 3D
binds native certification, preserved failed hosted history, 3B-R2/3C-R and
corrected package/SBOM/provenance identities. The release preserves qualified
provider claims, unresolved hosted history and the exhausted diagnostic stop
rule. This roadmap authorizes no further hosted or native campaign.

### MO-1307: Release Governance and Readiness

Status: **CLOSED / CERTIFIED / RELEASED** (V2 stale-test correction bound, 639/639).

The [Phase 3D final certification](docs/mo1307-phase3d-certification.md)
integrates the accepted 3A (`0d254bba008616b36709fb4b742496a4a15c9e36`,
generation `phase3ar2-final-h5-corrected`), 3B
(`4d92f0f21c9c3aad8202f4558d61b9229c7214fc`) and 3C
(`7d2006c6e19bb50bffb6c710672be996e3c3590b`) streams against final candidate
C3VB `17fa84efe46d30e6f4be85fd2427485677a222a3` (production commit
`98b766f9218b209f52251147213839b9775f6da3`). I3
`ee18fc6114610569682cc04e5e8e025408a38594` and binding-only BF
`1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` are on `main`. The owner ran the
read-only post-BF validator on the reference Windows host under Node v24.21.0;
it reported `CERTIFIED_READY_TO_TAG`, recorded verbatim and cross-checked in the
[MO-1308 authority](docs/mo1308-investigation-history.md) section 1.2. The
final audit is `PASS_WITH_DISCLOSED_STALE_TEST_BASELINE`: 632 of 639 conformance
tests pass, and the 7 failures are disclosed stale-baseline tests, not product
defects. All 16 Phase 3AR2 lineage attempts remain preserved with their
dispositions. Helper host latency remains a retained environment qualification.

After human review, the owner created annotated tag `memoryos-1.3-mo1307`
(tag object `a3042f3bded41ec71deff8dac71691e9a595460b`), peeling exactly to BF
`1dd1e8c82fe0ed5a32a894744392f2c279f89d4c`, as recorded in the
[MO-1308 Contract Freeze 1](docs/mo1308-contract-freeze-1.md) section
1.2. The release is certified with the 7 disclosed stale tests. A separate,
test-only, bound MO-1307 correction of those tests (`NRT01` becomes a
preserved-evidence check, not a re-execution) follows the tag and must be
complete before the MO-1308 Phase 1 binding. That
[V2 correction](docs/mo1307-v2-stale-test-correction.md) is bound: it passed
639/639 on the reference Windows host under the pinned Node v24.21.0
(evidence `32255d7a008b342b7122d94aa35ec9e1c94eeacd`, binding
`1c3a4269fe9394de74e2a4a6ad76aed7d076fd19`). The tag still targets BF, which
does not contain the correction. The MO-1308 authority's earlier
tag-deferral wording (V1) is superseded by the owner's decision to tag at BF;
that document remains a historical record of its stage.

Earlier MO-1307 stage records, including the Phase 1 and Phase 2 statements
below and the inventories' pre-binding, CERTIFIED_READY_TO_TAG and ABSENT-tag
fields, describe the
stage when they were written and remain historical records.

The [Phase 1 implementation](docs/mo1307-phase1-foundation.md) establishes the
private offline package, shared contracts, 52 schemas, canonicalization,
foundation validation, Windows protocol/publication primitives and bounded
fixtures. [B1](repositories/cca-conformance/evidence/mo1307/phase1/binding.json)
binds actual implementation I1 `7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee` and its
non-self-referential inventory. Acceptance records 105 passing tests and three
bounded characterization cases; preserved development attempts remain visible.
The two public functions and CLI commands were deliberately guarded until Phase 2.
[Phase 2D](docs/mo1307-phase2d-integration.md) integrated the accepted 2A, 2B and
2C streams (I2 `198da12a6b67da0104e54f98d2c8fbecbbf4a840`, B2
`976d4a04d75dadc02e30215dd5a8ddeaa2352df8`) before Phase 3 certification.

The [MO-1307 authority](docs/mo1307-release-governance-readiness.md) defines
deterministic, evidence-backed assessment of an exact candidate: satisfied and
blocked gates, first-class qualifications, retained history, evidence bindings,
and required human actions. Semantic outcomes, operational outcomes,
certification, provider limitations, computed readiness and final human release
decisions remain distinct. Policy PASS alone never grants release readiness.

MemoryOS may compute, validate and present readiness evidence. Final release,
tag, push, publication, deployment and merge authorization remains a human or
governance decision. MO-1307 does not autonomously approve or execute release.

[Contract Freeze 1](docs/mo1307-contract-freeze-1.md) selects a private offline
ESM package with one pure core, two CLI commands and two JavaScript functions;
closed REST/CI/CD profiles, four readiness states, six gate states, 22 gates,
14 evidence types and 21 operational errors. It freezes exact candidate and
dependency bindings, operator-pinned authority, an acyclic evidence graph,
selective reuse, qualifications/history, canonical readiness/proof identities,
optional external human-decision verification, pre-tag/post-tag stages, bounded
resources and atomic single-result publication. All 50 decisions are closed,
with zero unresolved normative decisions. The original authority's open
register remains historical pre-Freeze analysis; the Freeze supplies current
contract authority and the Phase 1 plan.
The released MO-1306 provider matrix and GitHub hosted-certification limitation
must remain visible. No REST, MCP, VS Code, Action or CI adapter expansion is
automatic. Core evaluation must work offline over supplied evidence on native
Windows 11 x64, without Linux, Ubuntu, WSL, user-provisioned VMs or live provider
accounts. Durable history, dashboards and general organizational governance
platforms remain outside MO-1307.

### MO-1308: Investigation History

Status: **CLOSED / CERTIFIED / RELEASED** (binding-only BF `bf2fdc87e9b2bfc25588ef61deacac6c04684376`, tag `memoryos-1.3-mo1308`).

The [Phase 1 entry obligations](docs/mo1308-phase1-entry-obligations.md)
prove `J` equivalence and Regression report identity, and the MO-1307 V2
dependency is satisfied, but the released-closure check fails:
`tools/verify_workspace.py` binds the released MO-1302 Action's vendored
runtime to the current `memoryos-sdk.js` and CLI source bytes, so the SDK and
CLI changes the Freeze assigns to MO-1308 could not be made without an owner
decision. Phase 1 stopped as the Freeze requires. The owner chose Option A: the
[workspace check correction](docs/mo1302-vendored-runtime-check-correction.md)
pins the released MO-1302 Action to its release instead of to current source
(Freeze Amendment A1), and Phase 1 resumed.

The [MO-1308 authority](docs/mo1308-investigation-history.md) establishes
durable, verifiable history of MemoryOS investigation and evaluation records:
an append-only, integrity-chained ledger over records that existing authorities
already produce and verify, with deterministic query, review and export.
MO-1308 records; it does not re-derive any producer's semantics, and existing
Investigation Core history semantics retain their authority. History never
becomes human approval or a readiness grant.

Owner decisions at authorization: a file-based, append-only ledger is the
separately approved architecture under ARCHITECTURE §13, with no database
engine, network service or cloud store in v1; v1 record kinds are
INVESTIGATION_CHECKPOINT and MIP_PACKAGE (MIP-backed only), POLICY_EVALUATION,
REGRESSION_REPORT, CICD_RUN, READINESS_RESULT and HUMAN_DECISION_CLAIM;
retention is append-only with governed tombstones that may purge original
bytes while the entry and record digest remain; v1 surfaces are the JavaScript
SDK and CLI only; portability is the `MemoryOSHistoryExport` bundle only;
ingestion uses neither `windows-inspect.ps1` nor `verifyReadiness`. The
authority's decision register left 34 entries OPEN.
[Contract Freeze 1](docs/mo1308-contract-freeze-1.md), approved by the owner on
2026-10-04, closes all 55 entries. It verifies the CCA-MEMORYOS-1.0 Standard
source at `moelsaka01/cca-specifications` `bdf8fd4` (all pinned documents and
218 requirement statements match) and finds that SP-004 and the AR-001
constitution support and constrain the approved ledger without contradicting
it. It freezes 25 technical resolutions and seven owner decisions: a pure SDK
with the CLI owning the file store; stored checkpoints as the Standard's full
nine-field projection, never a restore source; operator-command tombstones
with a closed reason list, each a ledger entry; purged bytes never re-added;
one ledger per Workspace; no per-entry timestamp; and a Node-only file store
under an explicit owner risk acceptance limited to local single-user v1 (a
concurrent directory swap is detected after the fact, not prevented; existing
ledger content is never overwritten or replaced; every later read fails
closed), which must be re-reviewed before any multi-user, shared-storage or
cloud use, including MO-1309. The MO-1307 V2 stale-test correction it depended on is bound
(`1c3a4269fe9394de74e2a4a6ad76aed7d076fd19`).

Phase 3 certified the accepted generations `phase3a` (108/108), `phase3b`
(26/26) and `phase3c` (67/67), and `phase3d` was accepted by the read-only
validator run at BF `bf2fdc87`; the I3 inventory is
`08fc000db8cb32bae770e21bb1378895151461be`. The recorded outcomes and
qualifications, including the H40 class and the 100,000-entry export duration,
are in the [release disclosures](docs/mo1308-release-disclosures.md); the
[Phase 3D record](docs/mo1308-phase3d.md) and the
[3D-D4 deviation disposition](docs/mo1308-3d-d4-deviation-disposition.md)
are retained history. The earlier Phase 1 stage text above and in the
authority and Freeze describes the stage when it was written.

### MO-1309: Cloud Dashboard

Status: **CONTRACT FREEZE 1 FROZEN / PHASE 1 NEXT**.

The [MO-1309 authority](docs/mo1309-cloud-dashboard.md) resolves the scope with
the owner decisions M1 through M12. "Cloud" means a static, offline,
cloud-ready dashboard: an operator can host the generated static output
anywhere, and MemoryOS ships no hosting, server, accounts, tenancy, billing or
network access. The dashboard reads MO-1308 history exports and query results
only, is strictly read-only, is dependency-free and CSP-safe with no build
step, and is certified on Windows 11 x64 with Node 24.21.0 and a
Chromium-family browser. A hosted service is deferred to a future milestone
with its own authority. Release `v1.3.0` is a separate step after MO-1309 and a
parallel test/CI maintenance item.

The [Contract Freeze 1](docs/mo1309-contract-freeze-1.md) closes every decision
and fixes the phase plan, the requirement inventory DB01–DB32 and the
certification plan 4A–4D. The parallel test/CI maintenance item
`maint/pre-1.3-release` is independent of every phase.

The exact next task is:

**MEMORYOS 1.3 MO-1309 PHASE 1 — CONTRACT AND VIEW MODEL**

The [handoff](docs/mo1309-handoff.md) records the live state.

## IM-001: engineering foundation

Status: complete and retained.

Delivered the workspace layout, C++23/CMake/vcpkg foundation, common logging
and configuration facilities, compiler module seams, test/quality
infrastructure, and reserved repository boundaries.

IM-001 intentionally stopped before compiler semantics. IS-002 supersedes that
placeholder restriction only for the approved Standards Compiler slice.

## IS-002: Canonical Specification and Standards Compiler

Status: implemented in this workspace.

Outcomes:

1. Canonical Specification 1.0 YAML profile and Draft 2020-12 schema.
2. Self-description, semantic versions, metadata, categories, typed objects,
   relationships, dependencies, rules, artifacts, annotations, and extensions.
3. Ordered Load-to-Report pipeline with explicit failure propagation.
4. Typed syntax and internal-model values.
5. Duplicate, reference, relationship, dependency, version, type, and metadata
   validation with structured diagnostics.
6. Deterministic `validate`, `analyze`, `compile`, and `report` CLI commands.
7. Documentation index, dependency graph, specification report, validation
   report, object inventory, architecture summary, and code-placeholder README.
8. Valid and invalid fixtures, automated tests, and a 90% line-coverage target.

IS-002 explicitly excludes Runtime and MemoryOS behavior from the compiler
milestone. That compiler boundary remains in force alongside the separate
IM-003 Runtime Foundation below.

## IM-003: Runtime Foundation

Status: implemented in this workspace.

Outcomes:

1. Headless `cca-runtime` executable and a `RuntimeHost` that owns multiple
   isolated, explicitly identified Runtime instances without a global
   singleton.
2. The complete CCA-RF-1.0 normal lifecycle and the explicit
   `Failed -> Rollback -> Destroyed` failure path.
3. Exactly six Runtime Foundation components: Lifecycle Manager, Service
   Registry, Dependency Injector, Event Bus, Configuration Manager, and
   Observability.
4. Compile-time typed Service Contracts, the `ExactlyOne`, `ZeroOrOne`, and
   `OneOrMore` cardinalities, duplicate detection, composition validation, and
   internal Provider ownership.
5. Constructor injection from a validated, acyclic dependency graph; complete
   dependency levels computed before Provider startup.
6. Sequential startup levels, optional explicitly selected concurrency within
   one level, and reverse dependency shutdown.
7. Runtime Freeze before startup, after which configuration, composition,
   dependency graph, and Event Bus subscriptions are immutable.
8. Typed asynchronous Event Bus delivery and instance-scoped Observability
   whose logging, diagnostics, metrics, and health remain facets of one
   component.
9. Runtime Foundation unit-test sources, a programming model, requirement and
   ADR evidence mapping, and a minimal headless example.

`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` are implementation surfaces, not extra Runtime Foundation
components. This roadmap records implementation scope; executed validation
results must be reported separately by the build/test workflow.

IM-003 explicitly excludes MemoryOS, Representation, Process, Persistence,
GUI, plugins, networking, SDK, Studio, AI, reasoning, and application-domain
behavior.

## Recommended IS-003: contract hardening and traceability

IS-003 should deepen the compiler contract rather than expand into another
subsystem:

1. publish a diagnostic compatibility catalog with golden JSON;
2. define schema-minor migration and deprecation policy;
3. decide and govern a custom validation-rule expression language;
4. trace requirements and source spans through reports;
5. define atomic output, rollback, and reproducibility manifests;
6. add fuzzing, malformed-input corpus, scale limits, and performance budgets;
7. broaden recorded Windows, Linux, and macOS evidence;
8. adopt dependency provenance, update, and vulnerability policy;
9. resolve licensing, copyright, contribution, and release governance;
10. decide API/ABI stability separately from source-format compatibility.

Exit evidence should include reviewed architecture decisions, golden fixtures,
migration tests, reproducibility evidence, and an updated threat assessment
for the compiler input/output boundary.

## CP-011: Memory Studio

Status: released in MemoryOS 1.0; additive MemoryOS 1.1 presentation released
in v1.1.0.

CP-011 implements the final MemoryOS capability as a passive observability
boundary. The delivered scope is the frozen CCA-STUDIO-1.0 C++ Contract,
complete conformance evidence, a checked example, and a responsive downstream
presentation of detached MemoryOS observations. MemoryOS 1.1 adds deterministic
observation frames, traces, replay, evolution, and comparative reconstruction
only downstream of that frozen Contract. It adds no memory mutation, retrieval,
persistence, Runtime ownership, or Provider implementation.

## Possible later increments

These are proposals, not authorization:

- package and registry contracts after an offline reproducibility design;
- specific code-generation targets after their production contracts exist;
- provider SDK packages and live-client bindings after compatibility policy is
  approved; MO-1202 remains a dependency-free settled-source interface;
- additional public Studio behavior or Atlas only after their APIs and
  security boundaries are defined;
- new MemoryOS capabilities only under a separately approved milestone.

AI, reasoning, LLM, database, domain persistence, plugin, networking, and
Runtime behavior beyond CCA-RF-1.0 must not be smuggled into a compiler or
Runtime Foundation milestone.

## Principal risks

| Risk | Consequence | IS-002 mitigation |
|---|---|---|
| Canonical data is mistaken for Runtime behavior | Consumers infer executable semantics | Compiler model remains architecture-neutral and separate from the IM-003 Runtime |
| Schema and validator drift | Different tools accept different inputs | Normative checked-in schema, fixtures, and paired tests |
| Diagnostics become prose protocols | Integrations break on wording changes | Stable identifier/code fields and deterministic JSON |
| Two dependency representations diverge | Analysis becomes ambiguous | One top-level directed dependency graph |
| Extension data becomes a plugin escape hatch | Unreviewed executable behavior enters scope | Extensions are preserved data and never executed |
| Generated outputs vary by host | Diffs and automation become unreliable | Ordered serialization with no time, locale, randomness, or host state |
| Partial writes look successful | Consumers use incomplete bundles | Generation error diagnostics and explicit generated-file result |
| Reserved repositories attract premature work | Scope expands into MemoryOS, domain, GUI, SDK, or atlas systems | No implementation or dependency edges in repositories that remain reserved |
| Dependency supply chain is underspecified | Reproducibility or license exposure | Pinned foundation; governance remains an IS-003 decision |
| Licensing is unresolved | External rights are unclear | Pending-decision notice and no license grant |

## Roadmap change rule

Moving work between increments requires architecture and scope review. The
review updates [the ambiguity register](docs/ambiguity-register.md), this
roadmap, architecture, schema/contracts, fixtures, and affected tests before
implementation relies on the decision.
