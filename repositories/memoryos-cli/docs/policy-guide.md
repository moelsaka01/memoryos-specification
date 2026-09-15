# Investigation Policy CLI Guide

MemoryOS CLI 1.1.0 exposes the frozen MO-1301 Policy Engine through seven
`policy` subcommands. The CLI transports bytes and owner-bound SDK handles; it
does not implement rules, aggregation, evidence, canonicalization, provenance,
Evaluation Identity, or outcome semantics.

## Validate and digest

```sh
memoryos policy validate --policy policy.memoryos-policy.json
memoryos policy validate --policy-set gate.memoryos-policy-set.json --json

memoryos policy digest --policy policy.memoryos-policy.json --json
memoryos policy digest --policy-set gate.memoryos-policy-set.json \
  --canonical-output gate.canonical.memoryos-policy-set.json --json
```

`digest` reports both `documentDigest` and `semanticDigest`. The optional
canonical output is the SDK-produced Policy or Policy Set bytes. Paths and
filenames are transport metadata and never enter either digest.

Recommended, non-semantic extensions are `.memoryos-policy.json`,
`.memoryos-policy-set.json`, `.memoryos-policy-fact-context.json`,
`.memoryos-regression-policy-fact-source.json`,
`.memoryos-policy-evaluation-identity.json`,
`.memoryos-policy-evaluation-outcome.json`, and `.sha256` for digest sidecars.
Content kind/version—not the extension—determines validity.

## Inspect detached artifacts

```sh
memoryos policy inspect --context context.memoryos-policy-fact-context.json --json
memoryos policy inspect --regression-source facts.memoryos-regression-policy-fact-source.json --json
memoryos policy inspect --regression-report regression.json --json
memoryos policy inspect --evaluation-identity evaluation.memoryos-policy-evaluation-identity.json --json
memoryos policy inspect --outcome evaluation.memoryos-policy-evaluation-outcome.json --json
```

Every inspection result says `authority: "inspectionOnly"`. Successful parsing,
canonicalization, and digest verification do not restore production authority.
A serialized context, Regression source, or detached Regression report can
never be supplied to `policy evaluate`.

## Evaluate authoritatively

```sh
memoryos policy evaluate \
  --policy policy.memoryos-policy.json \
  --package candidate.mip \
  --outcome evaluation.memoryos-policy-evaluation-outcome.json \
  --identity-output evaluation.memoryos-policy-evaluation-identity.json \
  --evaluation-identity-digest-output evaluation.identity.sha256 \
  --outcome-digest-output evaluation.outcome.sha256 \
  --json
```

Policy Set evaluation replaces `--policy` with `--policy-set`. To include the
registered Cognitive Regression source, add one trusted MIP baseline:

```sh
memoryos policy evaluate \
  --policy policy.memoryos-policy.json \
  --package candidate.mip \
  --regression-baseline baseline.mip \
  --outcome evaluation.memoryos-policy-evaluation-outcome.json
```

CLI 1.1 production evaluation is deliberately MIP-only. It imports the
candidate through one SDK owner and atomically captures the authoritative
PolicyFactContext. When a baseline is present, the SDK jointly captures the
candidate context and owner-bound Regression source. There is no generic
cross-process native authority protocol.

PASS exits `0`, FAIL exits `6`, and COULD_NOT_EVALUATE exits `7`. All three are
completed normative evaluations and publish a complete outcome. To stream only
the exact canonical outcome bytes, without a trailing newline or label:

```sh
memoryos policy evaluate --policy policy.memoryos-policy.json \
  --package candidate.mip --outcome - > evaluation.outcome.json
```

`--outcome -` cannot be combined with `--json`. Digest sidecars contain exactly
71 ASCII bytes (`sha256:` plus 64 lowercase hexadecimal digits), with no newline.

For an explicit FAIL example, evaluate a Policy containing
`memoryos.require-lifecycle-state` with `allowedStates` set to `["Archived"]`
against an Observed package; the completed canonical outcome is written and the
command exits `6`. For an explicit CNE example, evaluate a Policy containing
`memoryos.prohibit-regression-findings` without `--regression-baseline`; the
missing registered source is reported in a completed canonical outcome and the
command exits `7`.

Requested identity bytes, identity digest, outcome digest, and outcome bytes
form one publication generation. Files are staged first; auxiliary outputs are
published before the normative outcome, which is the final commit marker.
Consumers must cross-verify every retained sidecar against that outcome.

## Verify offline or by authoritative reconstruction

```sh
memoryos policy verify-identity evaluation.identity.json \
  --mode artifact \
  --expected-evaluation-identity-digest sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --json

memoryos policy verify-identity evaluation.identity.json \
  --mode evaluation --policy policy.json --package candidate.mip --json

memoryos policy verify-outcome evaluation.outcome.json \
  --mode artifact --expected-identity evaluation.identity.json \
  --expected-outcome-digest sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --json

memoryos policy verify-outcome evaluation.outcome.json \
  --mode evaluation --policy policy.json --package candidate.mip \
  --expected-outcome-digest sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --json
```

Artifact mode proves canonical bytes, schema, versions, digests, and internal
cross-bindings. It does not prove Core or Regression provenance. Evaluation mode
reacquires authoritative MIP-backed inputs and requires exact authoritative
reconstruction. Verification of a valid FAIL or CNE outcome exits `0`; its
decision remains explicit result data.

## Inspect frozen contract identities

```sh
memoryos policy identities
memoryos policy identities --json
```

The result contains only the frozen evaluator, Fact Model, Rule Registry,
Deterministic Fact Source Registry and Regression source-model, Resource
Profile, and outcome-contract identities. It contains no host, timestamp,
build-path, cache, or OS data.

## Machine errors and automation

Policy JSON envelopes use `schemaVersion: "1.1"`, compact restricted-JCS order,
and exactly one trailing LF. Successful envelopes go to stdout and error
envelopes to stderr. Stable automation reads `code`, `phase`, `artifactKind`,
`limitIdentifier`, and `exitCode`; `message` and `details` are presentation-only.

MO-1302 must independently verify both the immutable evaluator distribution and
the reported normative contract identities, pin the expected Policy/Set
`semanticDigest`, retain the exact identity/outcome generation, verify it, and
cross-check decision against exit `0`, `6`, or `7`. It must not infer semantics
from human text or reimplement Policy rules.

## Security boundary

The namespace provides no executable policy expressions, arbitrary selectors,
plugins, runtime registry changes, resource overrides, URL/network resolution,
environment interpolation, policy-controlled shell, or caller-minted authority.
An operand that resembles a URL is treated only as a literal local path; the CLI
never fetches it.
