# MO-1304 Windows certification and two-platform closure

## Scope and identity

The [Windows support correction](../../../docs/mo1304-contract-freeze-windows-support-correction.md)
was committed as `c29f527f29ec8e267367b3894099bb351c7873f4`, directly after
`43f07a48774e3ea0ef8509bd5f9ff5071a839b27`. All 26 Phase 1/2, Ubuntu and
support-contract checks passed afterward, as did workspace verification and
commit whitespace checks; the working tree was clean before Windows execution.
The correction contains no Windows receipt or parity PASS.

The physical host was mechanically detected using Win32_OperatingSystem and
Windows CurrentVersion registry values: **Microsoft Windows 11 Home, 25H2,
build 26200.9457, x64**. Win32_ComputerSystem reported Dell Inc., Inspiron 5406
2n1. The support family remains **Windows 11 x64**; the release/build above is
actual execution provenance, not a new universal support pin. The certification
pipeline rechecks the registry release/build/UBR and OS build for each run.

The dedicated copied Windows Node **24.21.0** executable has SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`;
bundled npm is **11.19.0**. Its absolute path is verified before use. Installation
uses the original `memoryos-mcp-0.1.0.tgz`, **2663183** bytes, SHA-256
`9a21b51abfd2bed3f403e154b99aff4a266792a385b9aec5d40b1ea150da6cf8`.
I2 remains `18453aa6d0d347acece20598cf5b1bc3d174c5af`, B2 remains
`461a67f3dbb7a32132f9c76e0ea40358e6776583`. Nothing is rebuilt or repacked.

## Execution and verification

The source is under `tools/mo1304-windows`. The eighteen-file runtime harness
manifest is created before a complete run and bound in its canonical receipt.
The validator requires all eighteen local files to match their executed hashes.
The manifest excludes itself; no future commit hash is invented. Validator
negative witnesses and conformance tests are separate from the runtime harness.

`certify_windows.py` creates a fresh installation and empty npm cache below
`.cache/mo1304-windows-cert/runs/windows-*`. It uses explicit Node/npm/archive
paths with `--offline --ignore-scripts --no-audit --no-fund --no-save --omit=dev`.
All 798 installed files and the original archive are checked before and after
execution. Runtime/dependency/contract/limits identities are unchanged. The
supplemental Windows verifier additionally enumerates named NTFS streams and
rejects reparse points before recursion. The official MCP client 2.0.0 occupies
a separate fresh tooling tree, extracted only from the thirteen original
integrity-verified npm tarballs and compared byte-for-byte afterward.

The complete catalog requires 88 native-pipe checks, 39 package checks and 27
supplemental installed-module checks. Primary semantic execution launches the
unchanged installed entry point over real Windows pipes, with the official
MCP client pinned to **2026-07-28**. Nine vectors exercise all six tools and
PASS / FAIL / COULD_NOT_EVALUATE outcomes. The authoritative SDK and ten actual
CLI commands regenerate the exact reference bytes for each complete run.
Seven maximal inputs exercise existing operation and attributable-memory bounds.
A separate read-only Windows sampler uses GetProcessMemoryInfo and Toolhelp
thread enumeration; its memory is outside the measured product process.

Native cases include invalid frames, UTF-8/JSON and N-1/N/N+1 bounds, metadata,
cache fields, unsupported launch/preload flags, zero-queue admission, busy and
cancellation handling, ID reuse, controls during a pending semantic operation,
EOF, unread pipes, drain deadlines and thirty repeated worker cleanup samples.
Supplemental installed-module cases control race ordering and exercise real
V8 heap exhaustion, external-memory excess, operation and shutdown deadlines.
They are explicitly distinguished from native integration evidence. No frozen
limit is raised, and scheduling/teardown overhead is recorded separately.

Filesystem instrumentation wraps the unchanged installed parent and nineteen
worker operations. It tests absolute, relative, home/workspace, file/HTTP URI,
UNC, device and ADS-shaped inputs. Only approved package reads and necessary
ancestor metadata are permitted; forbidden read/write/process/module-fallback
and AJV validator counters must remain zero. Instrumentation's own bounded audit
write uses a saved harness writer. Package adversarial cases separately reject
changed/missing/extra files, hardlinks, junctions, named streams, case substitution,
unsafe gzip/tar members and source-fallback conditions.

## Network mechanism and its precise limits

The strongest usable boundary in this non-elevated session is the host-provided
Windows execution sandbox, plus explicit supplemental Node API denial:

- Uninstrumented child Node probes under the same execution boundary receive
  **EACCES** for external TCP over IPv4 and IPv4-mapped IPv6.
- A bounded control connection to the same TCP endpoint succeeds outside that
  sandbox. It sends no application payload. Its result is a bound artifact.
- Loopback remains available. UDP sends are accepted by the local API; their
  packet delivery is not measured. **No OS-level UDP or DNS denial is claimed.**
- Supplemental installed parent/worker instrumentation rejects TCP, listeners,
  DNS lookup/resolve, HTTP, HTTPS, TLS, UDP and fetch. Separate deliberate probes
  prove the guard rejects those APIs. Actual semantic operations must record
  zero such calls, including registry/schema/artifact fetch, telemetry and update
  paths. The primary pipe suite remains uninstrumented.

A temporary zero-capability AppContainer was also tested. It started trusted
Node and denied an external TCP probe with EACCES, but Node could not resolve
the unchanged entry point because `lstat C:\` returned EPERM. That attempt is
not certified installed-package execution. The temporary profile was deleted
successfully and its explicit copied-runtime permissions were removed. No
ancestor filesystem ACL, global firewall, network adapter or OS release was
changed. Administrative firewall control was unavailable in the non-elevated
session. No complete network isolation claim is substituted for these narrower
observations.

The original Phase 3 requirement calls for OS/process denial where technically
feasible and explicit limits otherwise. These results add actual supported-host
TCP denial and preserve full instrumented no-network-call evidence, while
recording the remaining OS UDP/DNS and loopback limitations. They do not assert
Linux seccomp-equivalent isolation. Manual release-tag review must retain this
scope; it is not a hidden relaxation of product network behavior.

## Supply chain and historical preservation

The fresh public npm/GitHub snapshot remains separate from Ubuntu's immutable
snapshot. Core/server/client stable releases remain 2.0.0 in this review. The
frozen embedded fast-uri **3.1.0 is unpatched**: eight HIGH and one MODERATE
advisory remain, with no observed applicable validator/URI-schema path in the
frozen installed surface. Both embedded bundles are rehashed. Nine other
component/version queries returned no advisory. This retains the existing
scoped risk disposition; it does not claim zero vulnerabilities or a patch.

The Ubuntu receipt remains **26935** bytes with SHA-256
`afbbced0e1035cdacf9eafe26aba9391128e7def3940a569ce40c9b173029be0`.
All Ubuntu evidence and fourteen bound harness sources remain unchanged. Only
local validation is performed; Ubuntu is not rerun. Its historical Windows
pending label is retained and superseded for current policy by the correction.
macOS remains UNSUPPORTED; Ubuntu remains Ubuntu 24.04 LTS x64.

## Parity and graph strategy

`tools/mo1304-platforms/validate_parity.py` first invokes both independent
platform validators. Only then can it compare exactly one Windows and one
Ubuntu receipt and emit parity. I2, B2, archive, distribution, runtime,
dependencies, contract, limits, six-tool catalog and all nine normative semantic
vectors must match exactly. Actual OS details and platform-specific Node binary
hashes remain separate. Negative tests reject missing platforms, macOS
substitution, forged summaries and normative byte/digest changes.

The evidence commit is a direct child of the correction, with subject
`test(memoryos-1.3): certify MO-1304 Windows and platform parity`. It contains
actual receipts, their artifacts and conformance infrastructure. Overall Phase 3
and final binding remain pending until post-commit checks succeed.

The separate final binding uses subject
`conformance(memoryos-1.3): close MO-1304 MCP server certification`. It may change
only the inventory and final validation evidence. Its `releaseBinding.revision`
binds the already-existing evidence commit; it is not a self-hash. Graph-aware
checks discover the actual direct child with the exact final subject and scope.
The eventual release tag would target that final child, after manual review.
Receipts retain their execution-time pending tag/binding fields as history.
No push or tag is part of this task.

## Diagnostic and final runs

An initial diagnostic installation passed 87 native checks, 39 package checks
and 27 supplemental checks. Its directory is retained locally. The final run
uses a fresh installation and the completed 88-check native catalog, including
the explicitly scoped sandbox TCP-denial observation. Diagnostic data does not
substitute for the complete final catalog.

## Recorded final execution

The final fresh run passed **88 native-pipe + 39 package + 27 installed-module
checks (154 total)**, with no failed, cancelled or skipped checks. Both platform
receipts independently validate, and all nine exact canonical semantic vectors
match in the resulting two-platform parity receipt.

| Receipt | Bytes | SHA-256 |
| --- | ---: | --- |
| `evidence/mo1304-phase3-windows/windows-receipt.json` | 27819 | `96c5703f46eb39de771d4f1cca81821bfe64af1541f64808f64efdffb36baab5` |
| `evidence/mo1304-phase3-parity.json` | 24591 | `04f99995299ff5b308303aef044cae69b96c624a8ccfeff9a14f10d4098150c1` |

The maximum observed semantic operation was **2950.1873 ms**; maximum
attributable RSS growth was **187723776 bytes**, below the unchanged
**500170752-byte** bound. Thirty repeated operations settled at **18 threads**
throughout, with late peak RSS **27021312 bytes lower** than the early peak.
The 20000 ms partial-frame deadline was observed at **20035.7939 ms**, and the
unread-output drain deadline at **20031.3629 ms**, including scheduler/teardown
overhead. The frozen limits themselves remain unchanged.

The Windows receipt binds twelve supporting artifacts. Two compact native
stdout/stderr logs are also committed, for fifteen Windows evidence files in
all. The receipt contains the exact actual environment, frozen package and
runtime identities, all outcomes, scoped network/filesystem observations and
unpatched dependency disposition. Temporary diagnostics and installation/cache
trees are not committed.

The combined 32 conformance tests passed before evidence finalization. Workspace
verification then exposed a Phase-2-only rule that required `phase2Integration`
and all later states to remain PENDING. The mechanically necessary update is
confined to `validate_mo1304_registration` in `tools/verify_workspace.py`: it
preserves product pins, validates actual later-stage receipt identities and
invokes both independent validators through the parity gate. The Phase 2 graph
test retains the exact historical I2/B2 verifier identity and requires every
byte outside that single milestone function to remain unchanged. No predecessor
workspace rule or production implementation is changed.
