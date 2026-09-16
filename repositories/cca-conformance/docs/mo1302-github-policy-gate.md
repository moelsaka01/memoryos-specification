# MemoryOS GitHub Policy Gate

The MO-1302 reusable workflow is the GitHub-facing adapter for the bundled
MemoryOS deterministic Policy Gate Action. The workflow performs transport,
retention, and non-normative presentation. The colocated Action remains the
only gate adapter and the MemoryOS evaluator remains the only Policy semantic
authority.

## Reusable workflow

Call the workflow from a `pull_request` workflow by an immutable reviewed
40-hex revision. The canonical caller job identifier is exactly
`memoryos-policy-gate`; do not assign that job a second display name. GitHub
exposes a reusable-workflow status check as
`<caller job name> / <reusable job name>`. With the canonical caller below and
the stable reusable job name `MemoryOS Policy Gate`, the canonical observable
required check is exactly
`memoryos-policy-gate / MemoryOS Policy Gate`.

If a repository deliberately changes the caller job identifier or otherwise
changes GitHub's generated check identity, its branch protection must require
the resulting actual check identity. MO-1302 does not normalize, override,
spoof, or independently publish a replacement check run. The check identity
is GitHub platform metadata: it is not MemoryOS Policy semantics and is not
part of Evaluation Identity, outcome bytes, `outcomeDigest`, the gate receipt,
or the normative contract identities.

```yaml
name: MemoryOS Policy Gate
on:
  pull_request:

jobs:
  memoryos-policy-gate:
    permissions:
      actions: read
      contents: read
    uses: moelsaka01/memoryos-specification/.github/workflows/memoryos-policy-gate.yml@fc83b496c67869c8a8ddfcee0b2ec3f2937f2db2
    with:
      policy-kind: policy
      policy-path: policies/release.memoryos-policy.json
      expected-policy-semantic-digest: sha256:<64-lowercase-hex>
      candidate-mip-path: artifacts/candidate.mip
      retention-days: 14
```

The semantic digest is a workflow-controlled pin. A Policy or Policy Set whose
prepared `semanticDigest` differs from this value is rejected before
evaluation. No registry, evaluator, Resource Profile, or other normative
contract identity is caller-selectable.

The candidate requires exactly one acquisition form: `candidate-mip-path` or
`candidate-mip-artifact-name`. The Regression baseline permits neither or
exactly one of `regression-baseline-mip-path` and
`regression-baseline-mip-artifact-name`. Artifact names are exact, same-run,
current-repository names; they are not patterns, URLs, repositories, or run
selectors. The workflow requires exactly one service artifact and validates
the raw archive before extracting its sole regular-file leaf.

The `actions: read` permission is required only when same-run artifact mode is
used, but it is declared by the reusable workflow because GitHub permissions
are static. It permits exact-cardinality lookup in private repositories.
It does not permit artifact deletion, workflow mutation, Actions
administration, or repository writes. `contents: read` permits the
hostile-data checkout. No ordinary secret is declared or required. The
evaluator Action never receives `GITHUB_TOKEN`.

## Direct Action

The Action can be called directly when all inputs already exist as
workspace-relative files. Pin it to the same immutable reviewed revision and
disable persisted checkout credentials:

```yaml
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
    with:
      persist-credentials: false
  - uses: moelsaka01/memoryos-specification/.github/actions/memoryos-policy-gate@fc83b496c67869c8a8ddfcee0b2ec3f2937f2db2
    with:
      policy-kind: policy
      policy-path: policies/release.memoryos-policy.json
      expected-policy-semantic-digest: sha256:<64-lowercase-hex>
      candidate-mip-path: artifacts/candidate.mip
      regression-baseline-mip-path: ""
```

Direct Action users are responsible for retention and for reasserting the
Action's `gate-class` as a job conclusion. The reusable workflow supplies those
GitHub product behaviors.

## Same-run candidate artifact

Use artifact mode when a preceding job has produced the candidate MIP. The
producer must upload one exact artifact containing exactly one regular-file
leaf. Pin the uploader, use a literal artifact name, and do not overwrite an
existing artifact:

```yaml
- uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
  with:
    name: memoryos-candidate-mip
    path: artifacts/candidate.mip
    if-no-files-found: error
    retention-days: 14
    overwrite: false
    include-hidden-files: false
```

The canonical caller then selects that exact same-run artifact by name. The
candidate path input is deliberately omitted because the two acquisition forms
are mutually exclusive:

```yaml
jobs:
  memoryos-policy-gate:
    needs: produce-candidate
    permissions:
      actions: read
      contents: read
    uses: moelsaka01/memoryos-specification/.github/workflows/memoryos-policy-gate.yml@fc83b496c67869c8a8ddfcee0b2ec3f2937f2db2
    with:
      policy-kind: policy
      policy-path: policies/release.memoryos-policy.json
      expected-policy-semantic-digest: sha256:<64-lowercase-hex>
      candidate-mip-artifact-name: memoryos-candidate-mip
      retention-days: 14
```

The reusable workflow enumerates artifacts from the current repository and
current run, requires exactly one exact-name match, binds the download to its
artifact ID, and rechecks the ID immediately before validated extraction.

## Optional Regression baseline

Regression is optional and has cardinality zero or one. Supply a baseline only
when the selected Policy needs Cognitive Regression facts. This path-mode
example keeps both MIPs as hostile workspace data:

```yaml
jobs:
  memoryos-policy-gate:
    permissions:
      actions: read
      contents: read
    uses: moelsaka01/memoryos-specification/.github/workflows/memoryos-policy-gate.yml@fc83b496c67869c8a8ddfcee0b2ec3f2937f2db2
    with:
      policy-kind: policy
      policy-path: policies/regression.memoryos-policy.json
      expected-policy-semantic-digest: sha256:<64-lowercase-hex>
      candidate-mip-path: artifacts/candidate.mip
      regression-baseline-mip-path: artifacts/baseline.mip
      retention-days: 14
```

Artifact mode may instead use
`regression-baseline-mip-artifact-name`. A baseline path and baseline artifact
name must never be supplied together. The workflow does not run Regression on
detached caller-authored facts; the authoritative evaluator reconstructs the
trusted baseline/candidate provenance.

## Decisions and retained artifacts

Verified PASS, FAIL, and COULD_NOT_EVALUATE generations are uploaded before the
final job conclusion is enforced. The decision contract is:

| CLI result | Exit | Gate class | GitHub conclusion | Verified evidence |
|---|---:|---|---|---|
| `PASS` | 0 | `pass` | success | uploaded |
| `FAIL` | 6 | `policy-fail` | failure after upload | uploaded |
| `COULD_NOT_EVALUATE` | 7 | `policy-cne` | failure after upload | uploaded |
| tool or automation failure | 1-5 or invalid protocol | `tool-failure` | failure | never represented as a Policy decision |

No Policy state maps to a neutral or skipped result. The uploaded artifact is a
closed allowlist containing exactly:

- `evaluation-identity.json`
- `evaluation-identity.sha256`
- `evaluation-outcome.json`
- `evaluation-outcome.sha256`
- `policy-identities.json`
- `gate-receipt.json`

The retention request is an integer from 1 through 90 days, defaulting to 14,
and remains subject to the repository retention ceiling. Partial or unverified
generations are never uploaded. A late upload failure preserves the complete
local generation and verified digests, but the job becomes a tool failure with
`MEMORYOS_CI_ARTIFACT_PUBLICATION_FAILED`.

These six files are operational evidence, not a container for investigation
bodies. PolicyFactContext, MIP, and Regression report bodies are not uploaded by
default. The canonical outcome is the publication generation's final commit
marker; every sidecar must cross-verify against its embedded Evaluation
Identity and digests before the set is accepted or re-uploaded.

## Two independent identity layers

Layer A is the immutable software-distribution revision. It proves which
reviewed Action/workflow distribution was selected. Layer B is the complete
MemoryOS normative contract identity returned by `memoryos policy identities`
and cross-bound by the emitted Evaluation Identity. Layer B includes the
evaluator, Fact Model, Rule Registry, Deterministic Fact Source Registry and
Regression source-model entry, Resource Profile, and outcome contract
identities.

Both layers are mandatory. A correctly pinned distribution reporting different
contract identities is rejected. Correct contract identities reported by an
unapproved distribution are also rejected. The workflow-controlled Policy or
Policy Set `semanticDigest` is a separate content pin and cannot override either
layer.

Step Summary and annotations are bounded, escaped, non-normative projections
of verified machine fields. They expose no fact values, human CLI diagnostics,
Regression report body, or subjective interpretation. Presentation failure
does not change the decision, outputs, receipt, normative artifacts, or final
conclusion.

## Fork and network security

The initial supported fork model is `pull_request` on the GitHub-hosted
`ubuntu-24.04` runner with read-only `contents` and `actions` permissions, no
ordinary secrets, no self-hosted runner, no private privileged baseline, and
no `pull_request_target`. Checked-out Policy and MIP files are hostile data;
the workflow never executes checked-out programs.

Network use is limited to GitHub transport: resolving immutable Action and
workflow revisions, checkout, exact same-run artifact download, and verified
artifact upload. Policy evaluation performs no network calls. The workflow
does not install packages at runtime, download an evaluator, resolve remote
Policy/MIP includes, or use `actions/cache`.

## Branch protection

For the canonical caller configuration, configure branch protection to
require exactly `memoryos-policy-gate / MemoryOS Policy Gate`. If the caller
job identifier or another input to GitHub's generated check identity is
deliberately customized, require the resulting actual check identity instead.
Protect workflow files, Policy files, and semantic-digest pins with CODEOWNERS
or equivalent review, and tightly restrict bypass. These repository rules are
deployment controls and are not modified by MO-1302.

## Local reproduction

GitHub contains no hidden Policy semantics. The equivalent local sequence uses
the same CLI and preserves the completed evaluation exit before running
verification:

```sh
memoryos policy identities --json > policy-identities.pre.json
memoryos policy digest --policy policy.memoryos-policy.json --json > policy-digest.json

set +e
memoryos policy evaluate \
  --policy policy.memoryos-policy.json \
  --package candidate.mip \
  --outcome evaluation-outcome.json \
  --identity-output evaluation-identity.json \
  --evaluation-identity-digest-output evaluation-identity.sha256 \
  --outcome-digest-output evaluation-outcome.sha256 \
  --json
evaluation_status=$?
set -e

identity_digest="$(cat evaluation-identity.sha256)"
outcome_digest="$(cat evaluation-outcome.sha256)"

memoryos policy verify-identity evaluation-identity.json \
  --mode artifact \
  --expected-evaluation-identity-digest "$identity_digest" \
  --json
memoryos policy verify-identity evaluation-identity.json \
  --mode evaluation \
  --policy policy.memoryos-policy.json \
  --package candidate.mip \
  --json
memoryos policy verify-outcome evaluation-outcome.json \
  --mode artifact \
  --expected-identity evaluation-identity.json \
  --expected-outcome-digest "$outcome_digest" \
  --json
memoryos policy verify-outcome evaluation-outcome.json \
  --mode evaluation \
  --policy policy.memoryos-policy.json \
  --package candidate.mip \
  --expected-outcome-digest "$outcome_digest" \
  --json

memoryos policy identities --json > policy-identities.post.json
cmp policy-identities.pre.json policy-identities.post.json
```

When Regression is required, add the same
`--regression-baseline baseline.mip` input to evaluation-mode commands. Finally,
cross-check the canonical outcome decision against the retained status: only
`PASS`/0, `FAIL`/6, and `COULD_NOT_EVALUATE`/7 are valid completed pairs.

The workflow adapter and hostile-archive boundary also have deterministic local
protocol coverage:

```console
npm --prefix repositories/cca-conformance run test:mo1302-phase2
```

Run the Phase 1 Action suite independently with
`npm --prefix repositories/cca-conformance run test:mo1302-phase1`. GitHub
transport is mocked by the Phase 2 suite; real hosted artifact behavior cannot
be claimed from those tests.

## Cross-platform and native evidence

MO-1302 engineering validation targets fixed GitHub-hosted runners
`ubuntu-24.04`, `windows-2022`, and `macos-14`. For identical frozen inputs, the
three jobs must produce byte-identical Evaluation Identity and normative outcome
files and equal Policy semantic, identity, outcome, PolicyFactContext, and any
Regression source digests. Runner paths, operating-system metadata, run IDs,
job IDs, artifact IDs, and check IDs remain non-normative.

A separate native C++ matrix must prove that
`memoryos.sdk.cpp.policy.contract` and `memoryos.sdk.cpp.policy.example` are
registered, executed, and passing on all three runners, followed by a successful
install. Compiler, OS, architecture, registration, execution, and install
records are retained only as non-normative engineering evidence. See the
[MO-1302 engineering conformance guide](mo1302-engineering-conformance.md).

The workflow definitions and local deterministic tests can be completed before
publication, but this checkout has not been pushed for Phase 3 hosted execution.
Until run links and artifacts from all required GitHub-hosted jobs are verified,
the MO-1302 hosted release gate remains pending and no cross-platform success is
claimed.

## Supply-chain boundary

Every third-party Action reference in the production and MO-1302 engineering
workflows is a reviewed full 40-hex revision recorded in the conformance
inventory. Mutable tags, branches, shortened revisions, dynamic `uses`, runtime
`npm install`, `actions/cache`, shell-piped downloads, evaluator downloads, and
PATH substitution for the evaluator are rejected. The production Action's
42-member distribution manifest remains byte-reproducible with raw digest
`sha256:2e116b6518934c797e9c562670f2292462be11ee982c778b43f1aaf45a8986f9`.

## Platform and roadmap limitations

MO-1302 interface 1.0 targets GitHub.com. GitHub Enterprise Server support has
not been validated and is not claimed. The initial production reusable workflow
uses the GitHub-hosted `ubuntu-24.04` runner; the three-platform workflows are
engineering and release-readiness validation rather than alternate Policy
semantic authorities.

MO-1302 does not implement a VS Code Extension (MO-1303), a provider-neutral
GitLab CI, Jenkins, Azure DevOps, or generic CI abstraction (MO-1306), or
higher-level Release Policies (MO-1307). Those later milestones cannot be
inferred from these workflows, documentation, or evidence.
