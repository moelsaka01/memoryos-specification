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
    uses: moelsaka01/memoryos-specification/.github/workflows/memoryos-policy-gate.yml@<FULL_40_HEX_REVIEWED_SHA>
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
  - uses: moelsaka01/memoryos-specification/.github/actions/memoryos-policy-gate@<FULL_40_HEX_REVIEWED_SHA>
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

## Decisions and retained artifacts

Verified PASS, FAIL, and COULD_NOT_EVALUATE generations are uploaded before the
final job conclusion is enforced. PASS succeeds. FAIL and CNE fail the job
after evidence retention. The uploaded artifact contains exactly:

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

The workflow adapter and hostile-archive boundary have deterministic mocked
protocol coverage:

```console
npm --prefix repositories/cca-conformance run test:mo1302-phase2
```

Run the Phase 1 Action suite independently with
`npm --prefix repositories/cca-conformance run test:mo1302-phase1`. GitHub
transport is mocked locally; Phase 3 will add hosted cross-platform closure.
