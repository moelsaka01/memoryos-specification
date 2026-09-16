# MO-1302 Engineering Conformance

This guide describes the non-normative engineering evidence required to close
MO-1302. The engineering workflows exercise the released GitHub product
surfaces; they do not define Policy rules, canonicalization, Evaluation
Identity, outcomes, or decision mapping. The bundled Policy Gate Action and the
MemoryOS evaluator remain the only implementation and semantic authorities.

## Release-gate status

Workflow definitions and deterministic local checks can be reviewed and
committed without publishing the branch. Real GitHub-hosted runner, reusable
workflow, check-name, and artifact-service evidence cannot be produced from an
unpublished local commit. Until the Phase 3 commit is authorized for push and
all required hosted jobs are verified, the status is:

`MO-1302 RELEASE GATE PENDING`

No local simulation, source inspection, mocked artifact request, or JavaScript
bridge run substitutes for the required hosted and native evidence.

## Fixed hosted matrices

Both engineering matrices use `fail-fast: false`; every row is required for
milestone acceptance.

| Matrix | Required hosted runners | Purpose |
|---|---|---|
| Policy Gate engineering | `ubuntu-24.04`, `windows-2022`, `macos-14` | load and execute the real bundled Action, exercise decisions, and compare exact bytes |
| Native C++ SDK 1.1 | `ubuntu-24.04`, `windows-2022`, `macos-14` | configure, build, prove test registration, execute both Policy tests, and install |

Floating `*-latest` labels and self-hosted runners are outside this evidence
profile. Runner OS, architecture, compiler, paths, and GitHub operational IDs
are retained as engineering metadata only and never enter normative MemoryOS
identity.

## Hosted Policy Gate evidence

Each platform executes the production Action from its checked-in distribution,
not a mock or reimplementation. The matrix must demonstrate:

- Layer A distribution consistency and Layer B contract identities;
- the workflow-controlled Policy or Policy Set semantic pin;
- MIP acquisition, evaluation, publication generation, and postflight checks;
- completed `PASS`, `FAIL`, and `COULD_NOT_EVALUATE` decisions with exits 0, 6,
  and 7 respectively;
- a trusted Regression baseline case and its Regression source digest;
- exact Evaluation Identity bytes and `evaluationIdentityDigest`;
- exact normative outcome bytes and `outcomeDigest`; and
- the same Policy semantic digest, decision, PolicyFactContext digest, and
  conditional Regression source digest on all three runners.

Expected FAIL and CNE Action steps may return failure while later engineering
steps verify their complete artifacts. The harness must distinguish that
expected Policy conclusion from a tool, protocol, or workflow failure. A final
parity job downloads the platform evidence and compares canonical files as raw
bytes; parsing JSON and comparing only values is insufficient.

The production reusable workflow is separately exercised through GitHub's
supported reusable-workflow call mechanism. Hosted evidence must cover direct
candidate-path mode, exact same-run artifact mode, an optional Regression
baseline where applicable, verified upload, and upload-before-failure for FAIL
and CNE. The canonical caller job identifier is `memoryos-policy-gate`, the
reusable job name is `MemoryOS Policy Gate`, and the canonical observable check
is `memoryos-policy-gate / MemoryOS Policy Gate`.

Real artifact-service evidence records exact-name cardinality, immutable
artifact ID selection, retention, non-overwriting upload, the six-file
allowlist, returned artifact name/ID, and successful verification after
download. GitHub run, job, check, and artifact identifiers are never promoted
to normative inputs.

## Native C++ registration and execution

Use the repository-supported pinned vcpkg bootstrap and `ci` presets. On Linux
and macOS, prepare the dependency checkout with:

```sh
bash scripts/bootstrap.sh --skip-configure
```

On Windows, use:

```powershell
./scripts/bootstrap.ps1 -SkipConfigure
```

Every native matrix row then performs the repository-supported sequence:

```console
cmake --preset ci
cmake --build --preset ci
ctest --test-dir out/build/ci --show-only=json-v1
ctest --test-dir out/build/ci -R "^memoryos\.sdk\.cpp\.(policy\.contract|policy\.example)$" --output-on-failure
cmake --install out/build/ci --prefix out/stage
```

The show-only JSON is checked before execution and must contain exactly the two
required names:

- `memoryos.sdk.cpp.policy.contract`
- `memoryos.sdk.cpp.policy.example`

Both tests must execute and pass. Source inspection, CMake source inspection,
JavaScript parity, or bridge execution does not establish native execution.
Each job retains a bounded evidence record containing OS, architecture,
compiler identity/version, assessed commit, registered test names, test
results, and install result. This record is non-normative and contains no
Evaluation Identity or outcome modification.

## Supply-chain closure

All third-party Actions in the production and engineering scope use reviewed
full 40-hex revisions recorded in the MO-1302 inventory. The production pins
remain:

- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`
- `actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c`
- `actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065`
- `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`

The native dependency bootstrap selects vcpkg release `2026.06.24`; both the
recorded checkout commit and manifest baseline are
`cd61e1e26a038e82d6550a3ebbe0fbbfe7da78e3`. This pinned build dependency is
not an evaluator download. Runtime package installation, mutable Action refs,
dynamic `uses`, `actions/cache`, evaluator acquisition, and shell-piped
downloads remain prohibited.

The production Action distribution builder must reproduce exactly 42 manifest
entries and manifest raw digest
`sha256:2e116b6518934c797e9c562670f2292462be11ee982c778b43f1aaf45a8986f9`.
Phase 3 does not change those distribution bytes.

## Independent clean reproduction

After the final local conformance-binding commit, reproduce from a new empty
local clone rather than relying on the development worktree:

```console
git clone --no-hardlinks --single-branch --branch main /absolute/path/to/cca-workspace /new/empty/mo1302-reproduction
git -C /new/empty/mo1302-reproduction status --porcelain=v1
node /new/empty/mo1302-reproduction/repositories/cca-conformance/tools/build-mo1302-action-distribution.mjs
git -C /new/empty/mo1302-reproduction diff --exit-code -- .github/actions/memoryos-policy-gate
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-conformance run test:mo1302-phase1 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-conformance run test:mo1302-phase2 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-conformance run test:mo1302-phase3 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-conformance run test:mo1301 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-studio run test:policy-phase1 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-studio run test:policy-phase2 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-studio run test:policy-phase3 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/cca-studio run test:policy-phase4 -- --test-concurrency=1
npm --prefix /new/empty/mo1302-reproduction/repositories/memoryos-cli test
git -C /new/empty/mo1302-reproduction status --porcelain=v1
```

The clone must begin and end clean. The distribution builder must leave no diff,
and the focused suites must authenticate unchanged Policy identities, golden
vectors, cache vectors, fixtures, and cross-platform oracle expectations. Run
the native CMake/CTest/install sequence in the clean clone wherever the local
toolchain permits; hosted three-platform native evidence remains a separate
mandatory gate.

## Phase 3 commit self-binding

The MO-1302 inventory cannot include the hash of the commit whose tree contains
that same hash. Phase 3 therefore uses a bounded two-commit procedure:

1. Before the implementation commit, the inventory records the Phase 3
   revision as `PENDING` with status `mechanicallyPending` and names the
   `postCommitConformanceCommit` strategy.
2. Create the required implementation commit with subject
   `feat(memoryos-1.3): MO-1302 phase 3 cross-platform closure`.
3. Replace only the pending inventory revision/status with that implementation
   commit's full 40-hex hash and `bound` status.
4. Create a narrowly scoped conformance-binding commit. Its tree change must be
   only `repositories/cca-conformance/mo1302-conformance-inventory.json`.
5. Verify mechanically that the bound revision is the binding commit's parent,
   has the required Phase 3 subject, and that no implementation file changed in
   the binding commit.

This procedure binds the implementation without an unstable self-hash loop.
The binding commit itself is not represented as the Phase 3 implementation
commit.

## Hosted completion after publication

Publishing requires separate authorization. After an authorized push, retain
the GitHub run URL/identifier and verify all required engineering and native
matrix rows, exact-byte parity, production reusable-workflow calls, real
artifact-service behavior, and final check conclusions. A transient hosted
service failure is rerun and reported separately; a reproducible build or test
failure blocks closure.

Only after all required hosted evidence is present may the pending release gate
be replaced by a final MO-1302 readiness claim. No tag, release, MO-1303 work,
provider-neutral CI abstraction, or Release Policy work is part of this
engineering procedure.
