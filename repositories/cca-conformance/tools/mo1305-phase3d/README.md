# Phase 3D final release conformance

Run the registered `test:mo1305-phase3` npm script with pinned Node 24.21.0 and
MEMORYOS_CONFORMANCE_PYTHON set to the trusted Python 3.12 executable. The final
suite validates metadata, the graph, source receipts, history, closure, inventories,
canonical bytes, negative witnesses and registrations. No gateway, install or
resource campaign is launched. The complete pinned schema runtime documented by
the correction tooling is an engineering-only prerequisite.

`validate.py` is read-only; optional `--worktrees` checks all nine preserved source
worktrees. Normal validation needs only main, named Git objects and the retained
identity-checked ignored archive/toolchain inputs. `source_validation.py` replays
the three imported validators without modifying their sources. Dedicated source
branch guards are replaced explicitly by the real integration context, exact
source commit parents/scopes and immutable blobs. No Git output is spoofed.
Windows preflight remains immutable historical evidence; final structure,
correction, metadata regressions and graph are checked independently, while all
Windows runtime/receipt validators execute unchanged. Original correction
registration/inventory identities are checked at C3B; current registrations and
inventories are separately checked by the new final gate. Historical command-line
gates remain available at their original revisions.

`generate.py integrate` deterministically creates integration documents before
I3; `generate.py bind` requires an existing exact I3 parent and creates only the
four authorized BF paths. Never rerun generation after BF. The final binding
receipt uses the frozen 2.0.0 closed receipt schema and references the I3 inventory
snapshot, which must equal the actual global inventory blob in I3. No receipt,
source artifact, product or archive changes in BF. The current global inventory
becomes CERTIFIED_READY_TO_TAG. An actual clean BF commit is verified externally;
no self hash or tag-created claim appears in its committed bytes.

C3B -> I3 -> BF is single-parent main history. The three source certificates are
bound by existing commit IDs and exact imported blobs, rather than merged or
cherry-picked. Retained cache inputs are read-only copies of earlier evidence,
not new certification. rebuild.json records the separate Phase 3D deterministic
archive verification. Source worktrees remain untouched.

The advisory review is bounded: no exhaustive vulnerability census, no
zero-vulnerability claim and no independent scan of the complete npm bundled
transitive advisory graph. Preserve the dated source report and all failures.
