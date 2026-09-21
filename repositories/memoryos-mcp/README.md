# MemoryOS MCP 0.1.0 - Phase 2 integration

Private, local stdio adapter over the public MemoryOS JavaScript SDK 1.1.
Use exactly Node 24.21.0. MCP 2026-07-28 is the only protocol revision;
legacy initialization is rejected. No network transport or credentials exist.

The immutable tools are memoryos_contract_identities, memoryos_evaluate_policy,
memoryos_prepare_policy, memoryos_prepare_policy_set,
memoryos_verify_evaluation_identity, and memoryos_verify_policy_outcome.
Inputs are closed Base64/digest objects. Paths, URIs, workspace acquisition,
Regression injection and credentials convey no authority. Discovery and listing
return ttlMs: 0 and cacheScope: private directly in their complete results.
There is no semantic cache, persistence, mutable catalog or reusable SDK owner.

## Supported launch and installation

Launch with an absolute approved Node path and the absolute installed
bin/memoryos-mcp.mjs path. Use a trusted launcher with NODE_OPTIONS and NODE_PATH
absent and no preload, loader or inspector arguments. Startup rejects unsupported
flags and runtime versions; it cannot undo code injected before startup.
The installation, launcher and Node runtime must remain trusted and immutable.
Workers provide ownership and fault containment, not an operating-system sandbox.

Verify the archive against the external Phase 2 package receipt before installing.
Install only that local archive with npm 11.19.0 using --offline --ignore-scripts
--no-audit --no-fund and an explicit cache. All three production dependencies are
bundled; the official MCP client is development-only. Runtime/dependency files,
lengths, hashes, contract identities and finite limits are checked before serving.
The package verifier additionally checks the entire archive and installed tree.
It rejects path attacks, links, reparse members, extra/missing/changed files and
unexpected archive types or modes. External receipts are outside the archive;
neither manifest hashes itself. The root licensing decision notice is preserved:
this local private artifact makes no new license grant or public release claim.

## Ownership, cancellation and shutdown

Each semantic operation owns a fresh worker. There is one semantic slot, zero
semantic queue, one base subscription, one control slot and at most two pending
output frames. Publication states distinguish admission, running, cancellation,
worker settlement, readiness, handoff and terminal completion. Generation checks
reject stale completions. The publication boundary is handing the complete
bounded frame to the stdout writer. Pre-handoff cancellation suppresses the
response and reaps the worker. Post-handoff cancellation cannot retract bytes.
The slot remains occupied until required cleanup and writer settlement finish.

The launcher owns the existing stdout pipe descriptor so shutdown can cancel a
blocked native write; it opens no network connection or listener. Supported
client launch uses stdin/stdout OS pipes. On pinned Node 24.21.0, the Windows
launcher restores asynchronous Socket methods on its owned stdout instance and
sets that pipe nonblocking; an incompatible runtime fails closed. The writer
waits for both its callback
and drain when required. Admission pauses
when control/writer capacity is full. Clean EOF stops admission, cancels unfinished
work and abandons unfinished writer state without retaining deadline timers.
Partial-frame EOF and fatal transport failures exit nonzero. Shutdown is bounded
by the unchanged 20000 ms deadline. Protocol stdout contains only complete framed
messages; fatal stderr is the fixed MO1304_FATAL line. No artifact, digest, request
ID, environment value, stack or arbitrary exception is logged.

Finite limits remain those reviewed in Phase 1. Measurement sampling is not an
instantaneous operating-system memory guarantee. The Phase 2 changes retain the
same worker heap/external budgets, structural limits, rates and deadlines.

## Build and verification in the source workspace

Run npm ci --ignore-scripts, npm run assemble:dependencies,
npm run inspect:dependencies, npm run inventory, npm run verify,
npm run pack:verified, and npm run test:phase2 with the pinned toolchain.
Dependency assembly removes exactly 198 reviewed Zod development test files;
all retained dependency bytes, exact versions and the lockfile remain unchanged.
The resulting closed production dependency inventory has 748 files. The complete
package contains its own exact distribution manifest and preserved license notices.
Two separate staging assemblies must produce byte-identical npm pack archives.
Tests and development dependencies are not included in the archive.

Phase 2 evidence covers real official-client OS pipes, all six tools, SDK/CLI
parity, a fresh offline installation, adversarial package validation and controlled
operational races. Installed boundary tests use explicit test instrumentation to
reject network, filesystem escape, writes, shell execution, AJV invocation and
source-checkout imports in the parent and all seven semantic worker paths.
OS-level network-denied platform evidence remains a Phase 3 requirement.

The Phase 1 review retains its seven high-severity fast-uri 3.1.0 findings.
The Phase 2 upstream recheck adds one affected high and one affected moderate
finding: eight high and one moderate remain present in the embedded component.
No newer compatible stable official SDK graph was found. The closed product does
not invoke the lazy AJV URI provider or use URI normalization for routing, fetching,
redirects or authority. This limited residual-risk disposition requires re-review
before expanding schemas, SDK APIs, resources, elicitation or network access.

Windows 11 24H2 x64 and Ubuntu 24.04 x64 platform certification, cross-platform
parity, final release binding and the MO-1304 tag remain pending Phase 3.
macOS is unsupported for MO-1304; no predecessor exception is imported.
