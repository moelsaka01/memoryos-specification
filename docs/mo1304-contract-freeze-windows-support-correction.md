# MO-1304 Contract Freeze Windows Support Correction

## Authority and decision

The owner authorized this focused correction from clean `main` at
`43f07a48774e3ea0ef8509bd5f9ff5071a839b27`, after Ubuntu certification.
The previous freeze required **Windows 11 24H2 x64**. The available physical
Windows host is expected to be 25H2; that expectation is not evidence of an
executed test or permission to relabel the host as 24H2.

Source inspection and the runtime/platform documentation below found **no
substantive requirement specific to Windows 11 24H2**. The supported Windows
family is therefore **Windows 11 x64**. Every Windows receipt must separately
record the mechanically detected OS, release, full build (including UBR), and
architecture. This correction provides no Windows certification or parity PASS.
OS-specific execution remains a release gate.

## Unchanged frozen requirements

- Node.js **24.21.0 exactly**, trusted executable path and SHA-256 verified.
- Ubuntu **24.04 LTS x64**; the genuine certified environment remains Ubuntu
  24.04.5 LTS x86_64. macOS remains **UNSUPPORTED** for MO-1304 v1.
- MCP **2026-07-28**, local stdio, six tools, canonical MemoryOS semantics,
  admission, cancellation, framing, resource limits and dependency closure.
- I2 `18453aa6d0d347acece20598cf5b1bc3d174c5af`, B2
  `461a67f3dbb7a32132f9c76e0ea40358e6776583`.
- `memoryos-mcp-0.1.0.tgz`: **2663183** bytes, SHA-256
  `9a21b51abfd2bed3f403e154b99aff4a266792a385b9aec5d40b1ea150da6cf8`.
  Its identity is committed; the unchanged archive is a local ignored artifact.
  No rebuild, repack, product edit or dependency update is authorized here.
- Ubuntu receipt: **26935** bytes, SHA-256
  `afbbced0e1035cdacf9eafe26aba9391128e7def3940a569ce40c9b173029be0`.
  Its fourteen supporting artifacts and fourteen hash-bound runtime harness
  sources remain byte-identical. Validating existing evidence does not rerun Ubuntu.

## Technical audit

Paths in this table are relative to `repositories/memoryos-mcp` unless noted.
The distinction is between a Node-version requirement, Windows-specific
behavior requiring measurement, and an OS feature-release requirement.

| Boundary | Inspected implementation and dependency | Finding and required Windows evidence |
| --- | --- | --- |
| Stdio and pipes | `bin/memoryos-mcp.mjs`, `src/transport.mjs`; direct fd 1 Socket and pinned Node write methods | Windows synchronous stdio needs the existing nonblocking handle adjustment. It checks the pinned Node implementation, not an OS feature-release number. Real unread-pipe and draining-output deadlines must pass on the actual host. |
| Workers | `src/dispatcher.mjs`, `src/worker.mjs`; Node worker_threads, MessagePort, isolated env/execArgv, captured output | Pure Node APIs, with no 24H2 test or API. Worker termination, stale publication and heap/external memory must still be exercised. |
| Child processes | Official MCP client stdio transport and `scripts/distribution.mjs`; certification invokes explicit absolute Node/npm paths | Tooling uses ordinary process creation and OS pipes. Semantic delegation uses the SDK in a worker, not a command shell. Windows path/argument/exit behavior requires physical-host checks. |
| Filesystem | `src/integrity.mjs`: lstat, directory entries, realpath, open/fstat, bounded file closure | Existing Windows reparse defense uses Node/libuv directory-entry observations; hardlink/reparse/ADS and mutation witnesses remain required. No feature-release API is selected. |
| Paths | `src/integrity.mjs` safe-member rules and distribution verification | Drive paths, separators, case collisions, reserved device names and traversal are Windows-family concerns. Do not infer Linux filesystem evidence establishes Windows results. |
| Environment/preloads | `src/integrity.mjs` launch validation; dispatcher sanitized workers | Exact Node version, rejected NODE_OPTIONS/NODE_PATH and unsupported flags are runtime rules. Harmless preload/loader witnesses and secret-free diagnostics remain required. |
| Lifecycle and cancellation | `src/server.mjs`, `src/dispatcher.mjs`, `bin/memoryos-mcp.mjs` | One active semantic operation, zero queue, generation checks, worker cleanup and fixed shutdown deadlines use Node APIs. Windows exit/kill semantics must be observed rather than copied from POSIX. |
| Network | Stdio-only server, in-process authoritative delegation, supplemental boundary guard | Product has no network transport requirement. Linux seccomp evidence is Ubuntu-only. Windows needs its own strongest safe process-scoped denial and explicit reporting of achieved scope; no blanket host disconnect. |
| Installation and npm | `scripts/distribution.mjs`, package and dependency manifests; explicit npm tooling | Frozen pure-JS closure; no native addons, platform download or lifecycle script required. Offline install with ignored scripts and separately verified tooling remains mandatory. |
| Archive | Frozen gzip/tar bytes and strict Python/Node verifiers | Deterministic archive identity and safe members are OS-independent; extraction and installed filesystem checks are platform-specific. Archive must not be regenerated to change old README wording. |
| Resource measurement | `src/dispatcher.mjs`, `contracts/limits.json` | V8 heap limits do not include all external allocations; existing external-memory and process RSS accounting remain necessary. Windows working-set/thread sampling needs a Windows API source. No bound may be raised for this correction. |
| Executable | `src/integrity.mjs`, trusted Node 24.21.0 Windows x64 distribution | Exact runtime identity is required. Node's supported-platform table contains no Windows 11 24H2 floor. This does not extend MO-1304 support to Windows 10. |
| Official MCP SDK | Frozen core/server/client 2.0.0 closures; `src/server.mjs` | Protocol/catalog/subscription handling is JS over Node stdio; no Windows release branch. Embedded fast-uri remains affected, unpatched and subject to the existing scoped no-applicable-path disposition. Fresh supply-chain review and installed-boundary evidence remain required. |
| MemoryOS runtime | `src/delegation.mjs`, 25-file authoritative runtime closure | Canonical bytes/digests and outcomes delegate to the unchanged JS SDK/runtime. Nine normative vectors and real SDK/CLI references must match across platforms. No OS-release-dependent semantic branch was found. |

Primary documentation supporting the inference (not a replacement for tests):

- [Node 24.21.0 supported platforms](https://raw.githubusercontent.com/nodejs/node/v24.21.0/BUILDING.md)
  lists Windows x64 from Windows 10/Server 2016, subject to vendor support.
- [Node process I/O](https://nodejs.org/docs/latest-v24.x/api/process.html#a-note-on-process-io)
  documents synchronous Windows pipe writes, explaining the pinned-runtime
  adapter and the need for actual pipe/backpressure evidence.
- [Node worker_threads](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html)
  documents worker termination and the limits of V8 resource limits, including
  external ArrayBuffer memory. These are Node API properties, not 24H2 promises.
- [Microsoft KB5054156](https://support.microsoft.com/en-us/servicing/os/windows/docs/2025/02/kb5054156-feature-update-to-windows-11-version-25h2-by-using-an-enablement-package)
  describes the common core/system files and enablement relationship of 24H2
  and 25H2. This supports reviewing the label; it does not certify either host.

No inspected code or primary requirement selects a 24H2-only facility. That is
an audit conclusion about the support policy, not proof that every Windows 11
installation passes certification. Runtime, filesystem, process, security
policy and resource differences still require honest environment-specific evidence.

## Occurrence classification and preservation

The tracked MO-1304 scan was performed before edits. The old token occurs in
these eleven source locations (all conformance paths below are relative to
`repositories/cca-conformance`).

| Location | Classification | Disposition |
| --- | --- | --- |
| `docs/mo1304-phase3-ubuntu-certification.md`, pending-work paragraph | Current documentation / obsolete requirement | Correct to Windows 11 x64. |
| Same document, original next-task title | Historical statement | Retain original title and explicitly mark historical; link this correction. |
| `evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json`, pending key | Historical statement, not actual Windows identity | Preserve immutable bytes. It records Windows had not run. |
| `mo1304-conformance-inventory.json`, Phase 3 key | Obsolete current support requirement | Rename to `windows11_x64`, retain null. |
| `tests/mo1304_phase2_conformance_test.mjs`, current pending assertion | Obsolete requirement plus historical comparison | Check current family key; project it to the old key only when comparing immutable B1 history. |
| `tests/mo1304_phase3_ubuntu_conformance_test.mjs`, inventory assertion | Obsolete current key | Correct current key; do not alter Ubuntu receipt validation. |
| `tools/mo1304-phase3/receipt.schema.json`, pending key | Frozen historical Ubuntu schema | Preserve because Ubuntu receipt binds this harness byte-for-byte. |
| `tools/mo1304-phase3/validate_receipt.py`, PENDING constant | Frozen historical Ubuntu validation | Preserve; the separate support layer handles current platform criteria. |
| `tools/mo1304-phase3/validator_tests.py`, rejected Windows fixture | Test fixture | Preserve: Ubuntu-only validator must still reject Windows evidence. |
| `repositories/memoryos-mcp/README.md`, frozen support claim | Obsolete documentation inside frozen product | Preserve archive/product bytes. This authoritative correction supersedes that support label. |
| `repositories/memoryos-mcp/scripts/conformance-inventory.mjs`, Phase 2 generator key | Historical implementation-stage inventory generator | Preserve frozen product tree. Do not regenerate current Phase 3 evidence with this historical generator. |

No existing receipt asserts an actual Windows 24H2 certification. No historical
PASS, receipt, schema, archive or commit is retroactively rewritten.

## Mechanical criteria and sequencing

`repositories/cca-conformance/tools/mo1304-platforms/support-policy.json` and
`support_contract.py` define the corrected family, exact Node/archive pins,
actual environment fields and parity preconditions. Raw detected caption,
display version, build number, UBR and architecture must agree with the receipt
summary. Tests deliberately distinguish 25H2 from 24H2 and also accept a
consistently recorded 24H2 environment; neither release is a universal pin.

Contract tests use in-memory fixtures only. They cannot issue a Windows or
parity certification PASS. Full parity must first independently validate exactly
one Windows 11 x64 receipt and one Ubuntu 24.04 x64 receipt, then require exact
I2, B2, archive, distribution, runtime, dependencies, contract, limits, catalog
and normative semantic vectors. The candidate's nested identities carry these
closures; full execution validators additionally enforce the six-tool catalog.
Missing platforms, macOS substitution or any normative mismatch fail closed.

The dedicated correction commit has parent
`43f07a48774e3ea0ef8509bd5f9ff5071a839b27` and exact subject
`docs(memoryos-1.3): correct MO-1304 Windows support target`.
Phase 1, Phase 2, existing Ubuntu validation, support tests, workspace verification,
commit whitespace checks and clean status must pass afterward before starting
physical Windows certification. A later Windows/parity evidence commit and
separate non-self-referential final binding may follow only genuine passing
execution. No push or tag is authorized; final success stops at tag review.
