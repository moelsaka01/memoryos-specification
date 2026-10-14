# Phase 3B-R release-artifact recertification

Run from the dedicated `cca-mo1305-3b-refresh` workspace on `mo1305/phase3b-refresh`. The immutable baseline is C3B `4ac43c4368f41ec14ea443aa303bf3a69503f2de`; the wrapper also accepts its single authorized certification child.

Use the bundled Python 3.12 runtime with `-B -X utf8` and the pinned Node 24.21.0/npm 11.19.0 toolchain under `.cache/mo1305-phase3br/toolchain`. Optimized Python is forbidden because historical validators use assertions. The 150-file engineering validator and official SPDX schema remain pinned by the unmodified correction tool manifest.

Read-only final commands:

```text
python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3br/wrapper.py
python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3br/receipt.py verify
python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3br/advisory_snapshot.py
python -B -X utf8 tools/verify_workspace.py --root .
git diff --check
```

`wrapper_test.py` contains 18 context, pinned identity and optimized-Python rejection tests. `certify.py cheap` records the complete structural gate. `certify.py reproduce` requires two nonexistent clean roots and invokes the unchanged builder in separate processes. `certify.py adversarial` records 19 package tamper/parser witnesses and the 34 historical metadata checks. `execute.mjs` performs a bounded fresh offline install and six loopback TLS requests through the copied installed package. These evidence-producing commands are campaign tools, not read-only revalidation commands; preserve prior attempts rather than overwriting history.

`receipt.py create` requires all successful evidence and creates the canonical receipt exactly once. `verify` recomputes trusted identities and checks the persisted evidence and tooling. The receipt binds C3/C3B, never its future certification commit. Git output supplies that commit after creation.

The historical correction harness is unchanged. The wrapper validates the real authorized context, then exposes an explicitly recorded C3B view only for the historical branch/HEAD queries. Every original content, ancestry, evidence, runtime-preservation and identity check remains active. Its `--parallel` mode is not used because this task is confined to one worktree. Missing historical cache archives were reconstructed from pinned Git/evidence only as validation prerequisites; fresh reproducibility is separate.

Installation is logically source-independent: copied archive/toolchain/probe/fixtures, empty explicit cache, installed imports only and an empty service working directory. Its isolated stage is inside this dedicated workspace, as required; the checkout was not hidden by the OS. Stage credentials and temporary files are removed. The first long-path harness failure remains in `history/installed-attempt-1`; the fixed filesystem handler passed a 310-character path regression.

The original validator-access failure remains historical. Narrow read/execute ACLs were added only for the validation account within the task-owned validator subtree. Pip's regenerated launcher differed by four ZIP timestamp bytes and its RECORD hash; both were restored to their exact original pinned hashes, without changing the manifest or validator implementation. `restore_validator_cache.py` is a recorded one-time recovery tool, not part of runtime execution.

The dated advisory review is bounded; npm tool dependencies are external and their entire transitive advisory graph was not independently scanned. No zero-vulnerability or blanket licensing claim is made. Phase 3D must bind this certificate alongside the independently refreshed 3A/3C evidence. No merge, push or tag is performed here.
