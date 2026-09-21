# MemoryOS MCP 0.1.0 — Phase 1 foundation

Private local stdio adapter over the public MemoryOS JavaScript SDK 1.1.
It implements MCP 2026-07-28 using official SDK 2.0.0, with exactly six
immutable tools. The corrected discovery and tools/list complete results
contain ttlMs: 0 and cacheScope: "private" at result level. These protocol
fields create no semantic cache or authority. The correction is recorded in
[Contract Freeze 1](../../docs/mo1304-contract-freeze-1-cache-correction.md).

Use exactly Node 24.21.0. From this directory run `npm ci --ignore-scripts`,
`npm run assemble`, `npm run inspect:dependencies`, `npm run inventory`,
`npm run verify`, and `npm test`. Start with `node bin/memoryos-mcp.mjs`.
There are no install hooks. Measurement is explicit: `npm run measure`.
Dependencies are acquired at build/install time; runtime operation is offline.
No transport other than local stdio is implemented. No MCP initialize handshake.
Each request supplies the modern protocolVersion and clientCapabilities metadata.

The six tools are memoryos_contract_identities, memoryos_evaluate_policy,
memoryos_prepare_policy, memoryos_prepare_policy_set,
memoryos_verify_evaluation_identity, and memoryos_verify_policy_outcome.
Arguments are closed objects carrying canonical Base64 bytes and required
SHA-256 digests. There are no path, URI, workspace, credential or Regression
inputs. Serialized verification grants inspection authority only.

Every semantic request has a fresh worker and SDK owner. One active semantic
operation, zero queued semantic operations, one subscription, one bounded
control slot, and two pending output frames are permitted. A result occupies
the semantic slot until publication drains. Cancellation tombstones its
generation, suppresses publication, and reaps the worker before ID reuse.
Workers provide ownership and fault containment; they are not OS sandboxes.

The installation, launcher, OS and Node binary must be trusted and immutable
while running. Integrity checks bind the contract pin, byte-preserved runtime
closure and production dependency files. Hashes cannot defend against an
attacker who can replace the verifier and its pins together. No predecessor
source is modified. On Windows the verifier checks both lstat and opendir
directory entries: Node 24.21/libuv reports every reparse attribute through
the latter even when lstat treats a non-symlink tag as a regular file. This
uses the [pinned Node source](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/fs.c)
fs__readdir behavior. J serializes protocol projections only; normative bytes
are returned unchanged by authoritative SDK APIs.

Finite admission constants are in contracts/limits.json. Measurement receipts
include 30 fresh-worker cold and 30 fresh-worker warm repetitions for all seven
semantic paths, transport observations, bounded-copy analysis and the review
status. Observed sampling is not an instantaneous OS memory guarantee; V8 heap
limits, finite inputs, retention bounds and periodic external/RSS checks work
together. Fatal diagnostics are the fixed 13-byte MO1304_FATAL line; artifacts,
exceptions, environment values and IDs are never logged.

The dependency review retains seven high-severity fast-uri 3.1.0 advisories.
They are embedded in the official SDK's lazy AJV validator. The frozen surface
never invokes it or uses URI normalization for policy, routing, fetching or
redirects. This limited applicability conclusion must be revisited before
adding schemas, elicitation, resources, networking or SDK APIs.

This is not Phase 2 package certification or Phase 3 release certification.
Archive identity, production-only clean installation, client interoperability,
full cancellation/backpressure operational certification, Windows 11 24H2 x64
and Ubuntu 24.04 x64 certification, and release/tag binding remain pending.
macOS is unsupported for MO-1304. MO-1303 historical macOS NOT_EXECUTED external
billing evidence remains unchanged. MO-1305/1306/1307 work is outside this scope.
