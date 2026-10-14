# MO-1306 Phase 1 foundation

memoryos-ci 0.1.0 implements the generic Windows foundation under
[Contract Freeze 1](mo1306-contract-freeze-1.md) and
[Correction A](mo1306-contract-freeze-1-process-correction.md).
Phase 1 completion requires I1 followed by successful B1 binding. No final
provider certification, Phase 2 branch/worktree, push or tag is implied.

## Architecture and interfaces

The 80-file private package contains the public run/generate/verify entry
point, strict JSON and closed operational schemas, configuration/metadata,
one generic core, a bounded supervisor, fixed Windows path helper, fresh
semantic worker, exact SDK 1.1.0 closure, publication/verifier, pure generator
and four explicit unsupported provider stubs. Production never invokes the
CLI, MCP or REST. CLI and independently loaded source SDK are engineering
oracles only.

The common contract is memoryos.cicd 1.0.0. Eleven product schemas materialize
the configuration, deployment, invocation, result, evidence, artifact manifest,
completion marker, generation, summary and private worker protocol. All 28
machine errors plus the diagnostic-only truncation code and all fourteen
metadata classifications are materialized. No metadata field is semantic.

The [Phase 2 interface manifest](../repositories/cca-conformance/mo1306-phase2-interfaces.json)
pins seven shared module interfaces, eleven schemas and the final contract/
distribution. Phase 2A owns core/generic hardening; 2B owns GitLab/Jenkins;
2C owns Azure/GitHub compatibility/security. Generic becomes
FOUNDATION_IMPLEMENTED only after B1. GitHub, GitLab, Jenkins and Azure remain
NOT_IMPLEMENTED; their stubs fail explicitly. Hosted/provider grammars remain
future scope.

## Process, resource and security boundaries

Correction A permits one Node supervisor, one direct fixed PowerShell helper
OR semantic Node worker, and at most one owned Windows console host.
The helper and semantic worker never overlap. An additional process or
substituted role fails validation. The validated headless supervisor is
detached; the PowerShell helper is not. Every attributable role counts in RSS.
The observer also retains known PID/creation identity during bounded console
teardown and when command-line handle access disappears at process exit.
Neither case hides an extra process or permits a new phase to overlap teardown.

The fixed memory/time/transport values remain unchanged apart from Correction
A's processCount of three. Resource state becomes FINAL after measured Policy,
Set, Regression and maximum semantic input witnesses. Observed peak RSS for
those cases was 266,899,456 bytes, below 768 MiB; maximum measured duration was
31,956 ms, below 75 seconds. Sampling intervals, gaps and observer overhead
are retained. These are sampled observations, not OS-enforced RSS guarantees.

The 4096-byte adapter Policy Set transport envelope does not expand the SDK's
2048-byte raw-document semantic limit. Both the SDK rejection at 4096 and a
2048-byte Set with two 524288-byte MIPs are witnessed. SDK identities and
31 semantic limits remain authoritative.

The host and installation are trusted; the caller grants exclusive output
write access. Reparse/lexical checks, stable bounded snapshots, no overwrite,
fixed helper bytes and marker-last publication supplement that precondition.
Hooks and Node permissions are not a hostile-code kernel sandbox. Only
trusted shipped JavaScript executes, no network or arbitrary shell service.

Two partial-implementation defects found during acceptance were corrected:
distribution read/parse/size defects now consistently produce runtime-integrity
exit 15; and the child environment scrub removes bounded duplicate Windows
case variants before libuv can reinsert them. A PATH/Path pair can survive one
deletion. The scrub checks fixed-name presence only, never ambient values or
the full environment. An actual child confirms only SystemRoot and WINDIR.

## Evidence and acceptance

The original 46-minute blocked attempt remains unchanged. New failed harness
assertions and failed implementation witnesses remain distinct historical
artifacts. Corrections are diagnosed before a targeted continuation. Earlier
semantic bytes are reused only with exact unchanged SDK/delegation identities;
new environment/integrity behavior receives fresh native and installed tests.

Conformance includes closed independent schemas; parser/configuration/error/
metadata/generation tests; native PASS/FAIL/COULD_NOT_EVALUATE, Policy/Set/
Regression SDK and CLI byte parity; topology/fourth-process and substitution
negatives; helper/worker/timeout/cancellation/parent-kill cleanup; real NTFS
junction, symlink and hardlink rejection; tamper checks; denied network/write/
process routes; hostile environment; reproducible archive; isolated offline
installation; source import closure; generator determinism/no overwrite;
selected predecessor regressions; and closed revision/artifact/receipt graph
validation. Detailed command records distinguish expected-exit tests from the
additional acceptance checks; failed evidence is never promoted by changing
its status.

The [supply-chain review](mo1306-phase1-supply-chain-review.md) scopes provenance,
licenses and advisory reachability. No zero-vulnerability assertion is made.
The external archive's identity is committed; the archive is a local build
artifact. B1 must bind actual I1 and exact previously executed harness bytes,
including retained earlier snapshots where later scripts changed. B1 cannot
contain its own future hash or change product behavior.

## Engineering trace representation

Nineteen enhanced process traces exceeded the frozen 2 MiB engineering JSON
record limit because each sample repeated the fixed encoded helper command.
The exact original JSON bytes remain in hash-addressed gzip history artifacts.
Accepted JSON views dictionary-encode those command lines and retain original
and encoded identities. Validation expands each view and checks byte-for-byte
identity against the retained original. No observation, status, resource limit,
or earlier failed attempt is changed. References to an original trace hash
resolve through this explicit retained-raw mapping. The measurement campaign
closed within 60 minutes; this representation correction required no rerun.
