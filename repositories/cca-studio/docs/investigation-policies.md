# MemoryOS 1.3 Investigation Policies

Investigation Policies are deterministic, data-only gates over one immutable
Investigation state. MO-1301 adds the implementation and SDK/CLI integration;
it does not change the released MemoryOS v1.2.1 Investigation Core, MIP 1.0,
Cognitive Regression 1.0, or CCA-MEMORYOS-1.0 contracts.

## Evaluation model

A production evaluation combines exactly one prepared Policy or Policy Set,
one Core-minted `MemoryOSPolicyFactContext`, and zero or one trusted Cognitive
Regression fact source. The Policy Engine evaluates every authored rule in
order, without short-circuiting. It returns a completed `PASS`, `FAIL`, or
`COULD_NOT_EVALUATE` outcome. These are normative decisions, not exceptions.

Preparation, provenance, verification, transport, and runtime failures are
separate. They never fabricate a decision or partial normative outcome.

The evaluator consumes the closed Fact Model 1.0.0, not arbitrary Core
objects or caller-provided dictionaries. Its eleven domains are lifecycle,
transitions, observations, artifact cardinalities, four active-artifact
domains, verification, MIP integrity, and compatibility. `available` with an
empty item sequence proves authoritative absence; `notApplicable` and
`unavailable` have different meanings.

## Policy and Policy Set artifacts

`MemoryOSInvestigationPolicy` is a closed versioned JSON artifact containing
ordered rules. Optional descriptive metadata changes `documentDigest` but is
excluded from `semanticDigest`. Policy Sets retain authored child order and
pin each child by its semantic digest. Duplicate children and nested Policy
Sets are invalid.

Policy JSON uses the MemoryOS restricted-JCS profile: strict UTF-8, Unicode
scalar strings, duplicate-member rejection, safe integers only, no negative
zero, fraction, or exponent forms, and deterministic UTF-16 property ordering.

MO-1301 registers exactly six versioned rule types:

- `memoryos.require-verification-completed@1.0.0`
- `memoryos.require-replay-completed@1.0.0`
- `memoryos.require-artifact-cardinality@1.0.0`
- `memoryos.require-lifecycle-state@1.0.0`
- `memoryos.prohibit-regression-findings@1.0.0`
- `memoryos.require-mip-integrity@1.0.0`

Rule parameters are closed by the registered parameter schema. There is no
expression language, executable payload, dynamic selector, or plugin hook.

## Trusted facts and provenance

Core remains authoritative for Investigation semantics. Its private adapter
atomically captures one committed immutable transition log, derives one state
from that same log, projects the complete Fact Model, validates ordering and
completeness, and publishes the context or nothing. The context binds the
Investigation and Workspace identity, transition-log digest/count/head, and
Core version.

For MIP-backed Investigations, package inventory does not create active state.
An imported Trace, Replay, Evolution, or Comparative Reconstruction appears
as active only when the captured local Core state designates that exact
artifact.

Cognitive Regression is the sole optional deterministic external fact-source
domain in MO-1301, with cardinality `0..1`. Trusted capture obtains baseline
and candidate Core states, creates the candidate context, runs Regression 1.0
once, binds both Core versions and transition logs, and publishes the context
and source together or neither.

Serialized contexts, Regression sources, and Regression reports are useful
for inspection. They cannot mint or restore production authority. A correct
digest proves artifact identity, not current Core provenance. Authority is
owner-bound and is rejected across SDK instances.

## Decisions and evidence

Every initial rule result contains exactly one closed evidence value: a Core
or external fact reference, a deterministic selection, a fact-domain state,
or deterministic-source absence. Fact references are context/source scoped;
a bare `factIdentifier` is not globally authoritative.

Policy and Policy Set aggregation uses `FAIL > COULD_NOT_EVALUATE > PASS` and
retains authored order. The normative outcome embeds the exact Evaluation
Identity and its digest. `outcomeDigest` authenticates the complete canonical
outcome bytes but is intentionally not inserted into the outcome itself.

## Reproducibility identity and cache

Evaluation Identity binds the evaluator version, Rule Registry, Fact Model,
resource profile, Policy/Set semantic digest, context digest, deterministic
source registry, and present source digest. For one supported Evaluation
Identity, a conforming evaluator produces the same normative outcome bytes.

The cache is private and keyed by the Evaluation Identity digest. A hit is
accepted only after retained identity/outcome bytes and digests validate and
fresh semantic recomputation agrees byte-for-byte. Cache corruption therefore
becomes a miss, never a changed decision.

The sole MO-1301 profile is
`memoryos.policy.resource-profile.standard@1.0.0`, digest
`sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239`.
Its 31 limits cover parsing, artifacts, contexts, sources, pre-identity input,
evidence, and outcome size. Limits 25–27 fail before identity formation;
limits 28–31 produce a bounded non-recursive resource-CNE after identity
formation.

## SDK 1.1

JavaScript, Python, and C++ expose one-to-one synchronous operations for
Policy/Set preparation, detached inspection, authoritative capture and
evaluation, offline and authoritative verification, and contract identity
introspection. Python and C++ use the repository's private bridge to the same
JavaScript Policy Engine; they do not implement alternate semantics.

Evaluation results retain the evaluator-produced canonical identity and
outcome bytes. SDK serialization returns defensive byte copies. Product SDK
version 1.1.0 is independent of the evaluator and artifact contract versions,
which remain 1.0.0.

See [`investigation_policy_usage.mjs`](../examples/investigation_policy_usage.mjs)
for preparation, Policy Set validation, trusted Regression capture,
authoritative evaluation, detached inspection, verification, and identity
introspection.

## CLI 1.1 and MO-1302 boundary

CLI 1.1 adds exactly seven `memoryos policy` subcommands: `validate`,
`digest`, `inspect`, `evaluate`, `verify-identity`, `verify-outcome`, and
`identities`. Production CLI evaluation is deliberately MIP-backed. It imports
the candidate—and optional Regression baseline—through the SDK and never
accepts serialized context/source artifacts as authority.

Normative identity and outcome files contain exact canonical bytes with no
transport newline. Digest sidecars contain exactly the 71 ASCII bytes of the
digest. A multi-file evaluation is one publication generation, with the
outcome published last as its commit marker. Human and JSON presentation never
changes normative bytes.

MO-1302 will pin the evaluator distribution independently from the normative
contract identity, compare the workflow-controlled Policy semantic digest,
run this CLI, verify every retained artifact and sidecar, and cross-check exit
status against the embedded decision. MO-1301 does not implement that GitHub
Actions workflow.

## Security and limitations

Policies cannot execute code, issue network requests, resolve URLs, load
plugins, interpolate environment state, select arbitrary facts, control file
paths, invoke shell commands, mutate registries, or override resource limits.
No caller-authored digest or detached artifact creates authority.

MO-1301 permits only the frozen six rules and one Regression source domain.
It does not persist native authority across processes. CLI evaluation is
therefore MIP-only, while in-process SDK clients may evaluate native Core
Investigations. CCA-MEMORYOS-1.1 is intentionally deferred until schemas,
vectors, evaluator behavior, SDK parity, and conformance have been
independently validated; the Standard will codify the frozen behavior rather
than become a second semantic implementation.
