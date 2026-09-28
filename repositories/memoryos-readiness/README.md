# MemoryOS Readiness 0.1.0 — Phase 1 foundation

This private, offline ESM package implements the contracts and shared foundations
of MemoryOS 1.3 MO-1307 Contract Freeze 1. It is not a completed readiness
evaluator and makes no release-readiness or human-approval claim.

The public root exports exactly `evaluateReadiness` and `verifyReadiness`.
Their Phase 1 implementations validate bounded input foundations and fail closed
with a frozen operational error. They do not return an assessment. The CLI exposes
only the frozen `evaluate` and `verify` argument shapes and remains guarded until
the later assessment, checked acquisition and orchestration implementation.
The fixed Windows helper also fails closed; it does not claim successful native
handle inspection. A valid invocation must not be mistaken for completed work.

Shared foundations include strict canonical JSON and SHA-256 identities, closed
schemas, candidate and envelope structure checks, defensive graph validation,
reference aggregation, output projections, path/protocol admission and publication
primitives. Internal modules are not additional public exports. Full authority,
dependency, reuse and history verification and complete gate evaluation belong
to Phase 2A/2B; checked native acquisition, execution isolation and public
orchestration belong to Phase 2C. Integration and certification are later work.

Runtime is separately provisioned, exact Node 24.21.0 win-x64. The pinned
`node.exe` is 93,580,104 bytes, SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.
Windows PowerShell 5.1 is the fixed helper dependency. npm 11.19.0 is engineering
and offline-install tooling only. Invoke a verified absolute runtime and absolute
entry point; the product does not discover or download a runtime.

There are zero external production npm dependencies and no lifecycle hooks.
No account, network service, provider SDK, Linux/WSL/VM, cloud execution or hosted
runner is a prerequisite. Provider limitations in supplied evidence remain
limitations. Existing semantic contracts and released historical outcomes are
unchanged. Human release authorization remains separate from every computed or
claimed readiness state; this Phase 1 package grants no permission to tag.

`contracts/contract.json` binds the exact local schemas and frozen constants.
`distribution-manifest.json` binds every shipped regular member except itself;
external receipts must bind that manifest and any later containing archive.
`sbom.spdx.json` is an SPDX 2.3 file inventory. Its own bytes and the distribution
manifest are explicitly excluded from its file checksums to avoid recursion;
the distribution manifest independently binds the SBOM. This metadata is not
archive reproducibility, execution, vulnerability or release certification.

The exact `package.json` allowlist excludes tests, fixtures, conformance evidence,
engineering validators, caches and node_modules. Engineering package checks
verify the complete closure, generated schema/constants agreement and member
hashes offline. No registry publication is authorized. Licensing is pending;
see LICENSE-NOTICE.md and NOTICES.md.
