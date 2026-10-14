# MO-1304 Ubuntu-only certification

This surface certifies the unchanged Phase 2 archive on Ubuntu 24.04.5 LTS x64
with Node 24.21.0 and npm 11.19.0. It does not certify Windows, perform
cross-platform parity, create a release binding, or authorize a tag.

The candidate is `memoryos-mcp-0.1.0.tgz`, 2,663,183 bytes, SHA-256
`9a21b51abfd2bed3f403e154b99aff4a266792a385b9aec5d40b1ea150da6cf8`.
The implementation is I2 `18453aa6d0d347acece20598cf5b1bc3d174c5af` and its
binding is B2 `461a67f3dbb7a32132f9c76e0ea40358e6776583`.

## Inputs and isolation

`tools/mo1304-phase3/build_inputs.mjs` runs the authoritative SDK and CLI on
the Windows side to generate reference inputs, canonical bytes, and digests.
This is reference generation, not certification of the Windows 25H2 host.
Only the resulting inputs, dedicated harness, original integrity-verified
client-tooling tarballs, and unchanged candidate archive are transferred by
SCP to the dedicated Ubuntu SSH endpoint. No source checkout, `.git`, Windows
`node_modules`, SSH key contents, or shared-folder mount is transferred.

The approved Ubuntu area is `/home/mo1304/mo1304-cert`. The trusted executable
is `/opt/memoryos-cert/node-v24.21.0-linux-x64/bin/node`, SHA-256
`7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`.
Each complete run creates a fresh `runs/ubuntu-final-*` installation and empty
npm cache. Installation is offline, ignores scripts, disables audit/funding,
and uses explicit absolute Node, npm, archive, cache, and prefix paths.
The production package's 798 files are verified before and after execution.
The official MCP client 2.0.0 and its tooling dependencies occupy a separate
installation. Their installed files are compared with the original tarballs.

`linux_network_deny.py` applies an inherited Linux seccomp filter to the
certification process tree. It returns EPERM for socket, connect, bind, listen,
accept, accept4, sendto, sendmmsg, and io_uring_setup. Existing stdio and local
socketpair-based process IPC remain usable. TCP/IPv4, TCP/IPv6 and UDP probes
must fail with EPERM. SSH management runs outside this process tree. No
firewall or permanent host/guest network setting is changed. The unavailable
unprivileged network-namespace mechanism is not claimed as evidence.

## Execution and evidence

The runtime harness manifest binds fourteen files by byte length and SHA-256.
It excludes itself, avoiding self-reference. The receipt binds its hash and
all supporting artifacts; no future harness commit ID is invented.
Run the complete staged surface with:

```sh
/usr/bin/python3 -B /home/mo1304/mo1304-cert/harness/certify_ubuntu.py
```

A complete run requires 87 native-pipe checks, 38 package checks and 27
supplemental installed-module checks. The primary semantic evidence uses the
pinned official client and unchanged installed entry point over real OS pipes.
Nine semantic vectors compare all canonical artifacts and normative digests
with the independently produced SDK/CLI reference data. Seven maximal valid
inputs exercise the frozen operation and attributable-memory bounds.

The supplemental suite makes race ordering deterministic with controlled
workers/writers and samples. It also tests real worker heap exhaustion,
external-memory enforcement, the actual 20-second operation deadline, and
shutdown cleanup. It is labelled separately and does not substitute direct
module calls for real MCP integration. Closed schemas reject oversized
argument witnesses before semantic admission; the receipt does not assert
that invalid N-1/N arguments were accepted. Input chunk size is a per-read
bound, so larger producer writes are split rather than rejected.

Deadline witnesses record elapsed time as observation; scheduler and teardown
overhead is distinct from the unchanged 20,000 ms timer configuration. No
frozen resource value is increased. Unsupported Node debugger startup can
emit Node-owned diagnostics before the product's fixed 13-byte fatal line;
this distinction is recorded rather than presented as product diagnostics.
Harmless preload/loader witnesses demonstrate unsupported-launch rejection,
not protection against an administrator replacing trusted code.

A supplemental explicit bootstrap checks all installed parent/worker imports,
filesystem reads/writes, subprocess use and AJV validator access. The primary
semantic run remains uninstrumented. Linux path/URI probes include absolute,
relative, home and workspace-shaped paths. No Windows ADS or reparse-point
result is claimed on Ubuntu.

`validate_receipt.py` requires canonical bounded JSON, exact identities, every
required test and vector, matching artifact hashes and canonical bytes, and
honest residual risk. It rejects missing/failed/duplicate tests, altered
vectors, fabricated summary PASS, extra platform records, future tags and
partial parity claims. Validation runs in Ubuntu before evidence is returned,
and is repeated by Windows-side conformance and negative validator tests.
The `MO1304_TEST_PATTERN` switch is diagnostic-only: filtered attempts cannot
pass the validator's exact test-catalog requirement.

## Diagnostic attempts

An earlier diagnostic attempt coincided with a VirtualBox catch-up lag of
179,286,970,397 ns and a guest heartbeat gap of 179 seconds. Its official-client
request timed out after approximately 179,977 ms. Those observations were
classified as an infrastructure interruption, not a passing product result.
Subsequent complete certification starts from a fresh installation. Temporary
host sleep inhibition is scoped to the complete run and released afterward;
no persistent power or network configuration is changed.

Focused attempts were also used to check harness expectations against the
pinned client and raw protocol, and to exercise the two final native lifecycle
checks. Only a complete run containing the exact catalog can produce the
canonical certification receipt. Previous remote attempt evidence is retained.

## Supply-chain disposition and remaining work

The fresh public npm/GitHub source snapshot remains separate from historical
Phase 1/2 evidence. Stable official MCP packages remain 2.0.0. Embedded
fast-uri 3.1.0 remains unpatched with eight HIGH and one MODERATE advisories.
Both embedded copies are rehashed in Ubuntu. The frozen installed surface and
observed validator/module/filesystem/network boundaries retain the existing
no-applicable-path conclusion. Residual affected-component risk remains
explicitly accepted only under that scoped policy; this is not a claim of
zero vulnerabilities or a patched dependency.

The overall Phase 3 inventory remains PENDING even when its Ubuntu receipt is
PASS. Windows 11 x64 certification, Windows receipt, cross-platform parity,
parity receipt and final binding remain pending/null. The MO-1304 tag remains
absent and macOS remains UNSUPPORTED.

Execution precedes the Ubuntu-only harness/evidence commit. Immutable I2/B2
and content hashes bind the candidate, runtime harness, inputs and evidence;
no receipt contains its own future commit hash. The commit subject is exactly
`test(memoryos-1.3): add MO-1304 supported-platform certification harness`,
with B2 as its parent. Graph-aware conformance checks inspect the actual first
descendant of B2 and verify the committed receipt and fourteen harness blobs.
The post-commit Phase 2 regression exposed a positional assumption that HEAD
was still B2. The evidence-binding follow-up records the now-existing harness
revision and makes the graph checks inspect the exact historical I2/B2 edge
and actual harness ancestry. It changes only inventory and graph-aware
conformance checks, preserving all historical edge/file-scope assertions. It
does not create full-platform certification, a final release binding, push,
or tag.

The original remaining task title below records the previous freeze. Current
Windows support is **Windows 11 x64**, with the actual release/build required
in its receipt; see the [Windows support correction](../../../docs/mo1304-contract-freeze-windows-support-correction.md).

Historical task title:

MEMORYOS 1.3 MO-1304 MCP SERVER AND AGENT INTEGRATION WINDOWS 11 24H2 CERTIFICATION AND RELEASE CLOSURE

## Recorded Ubuntu result

The final fresh run passed all 87 native-pipe checks, 38 package adversarial
checks and 27 installed-module mechanism checks. The receipt was validated
inside Ubuntu before the fourteen intended evidence artifacts were returned
by SCP, then validated again on Windows.

Receipt: `evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json`.
Byte length: **26,935**.
SHA-256: `afbbced0e1035cdacf9eafe26aba9391128e7def3940a569ce40c9b173029be0`.

Runtime harness manifest: 1,826 bytes, SHA-256
`05ba6c3d136519c41dae35522ff2798818f91c86f06a5d63b4964633d27f2508`.
The receipt binds exact test results and all required supporting identities.
The earlier complete 150-check run is superseded by this 152-check run; its
remote attempt directory is retained for provenance.

Post-return validation passed: MO-1304 Phase 1 **7/7**, Phase 2 **10/10**,
and Ubuntu conformance **6/6** (including negative receipt witnesses). All
23 tests passed with zero failures, cancellations or skips. Workspace
verification and `git diff --check` passed. Production and historical evidence
remain unchanged. Those initial checks ran at B2 before the Ubuntu-only
finalization commit; finalization repeats them against the actual new commit.

## Local finalization and VM independence

The final non-interactive SSH probe rechecked the recorded hostname, exact
Ubuntu release/kernel/architecture, VirtualBox identity, trusted Node hash,
and npm version. The transferred archive, installed package, and all fourteen
returned evidence files matched the local Windows copies. The receipt bytes
remain unchanged. Draft 2020-12 schema/meta-schema validation and all 36
negative receipt witnesses passed during finalization.

Receipt validation uses only the local Python standard library, the fourteen
bound harness files, and the returned evidence. Future parity compares the
nine exact canonical products and their digests in `semanticVectors`, with
`inputs.json` retaining the reference vectors and SDK/CLI provenance. Package,
Node, protocol, test results, process boundaries, resource observations and
supply-chain disposition are present in the returned artifacts. Ubuntu's
non-normative installation path is provenance, not an input to validation.

The finalization procedure exports the relevant blobs from the actual Git
commit into a local isolated directory, validates that committed receipt and
its supporting artifacts, rechecks the committed archive identity, and compares
the committed inventory binding. The unchanged frozen archive remains a local
build artifact (Git-ignored); its bytes are reverified separately. The archive
payload is not required to validate the committed receipt or compare semantic
vectors for later parity. It requires no SSH, Ubuntu process, source
mount, Ubuntu installation tree, or remote tooling cache. Re-executing Ubuntu
certification would need the VM again; validating the existing Ubuntu evidence
and comparing it with later Windows evidence does not.

The VM, trusted runtime, transferred archive and temporary run directories are
left intact. Shutdown readiness is conditional on successful post-commit
validation and a clean working tree. No shutdown, reboot or VirtualBox control
command is part of finalization; the user controls power-off.

## Supporting evidence inventory

All fourteen artifacts are bounded and reviewed for credential/private-key
material. Eleven supporting artifacts are hash-bound by the canonical receipt.
The native stdout/stderr files are small execution summaries, checked against
the exact native result list and empty-stderr requirement; Git binds these
supplementary logs. No bulk system log or remote temporary directory is added.

| File | Bytes | Purpose |
| --- | ---: | --- |
| `execution.json` | 123837 | 87 native results, nine canonical semantic vectors and boundary observations |
| `harness-manifest.json` | 1826 | Fourteen exact runtime harness identities |
| `inputs.json` | 1474883 | Exact reference bytes, nine vectors, seven maximal inputs and ten CLI command records |
| `installation.json` | 1550 | Offline command, exit status and installed-package verification |
| `mechanisms.stderr.txt` | 0 | Empty supplemental-suite stderr |
| `mechanisms.stdout.txt` | 5572 | 27 named installed-module TAP results |
| `native.stderr.txt` | 0 | Empty native-suite stderr |
| `native.stdout.txt` | 4119 | Compact native test completion summary |
| `package-adversarial.json` | 2797 | 38 archive and installed-filesystem attack witnesses |
| `supply-chain-sources.json` | 275866 | Authoritative certification-time npm/GitHub source snapshot |
| `test-catalog.json` | 5395 | Required test names and platform scope |
| `tooling-manifest.json` | 3860 | Original client-tooling tarball identities |
| `tooling-verification.json` | 3426 | Thirteen separately installed tooling package closures |
| `ubuntu-receipt.json` | 26935 | Canonical Ubuntu result and supporting identities |

## Reviewed commit scope

Every path below is relative to `repositories/cca-conformance/`. The scope is
exactly five modified tracked files and 33 new files, with no production
category. A = reusable certification infrastructure; B = receipt schema or
validator; C = Ubuntu execution/adversarial mechanism; D = Ubuntu evidence;
E = Phase 3 conformance; F = documentation; G = registration or inventory.

| File | Category |
| --- | --- |
| `CMakeLists.txt` | G |
| `docs/mo1304-phase3-ubuntu-certification.md` | F |
| `evidence/mo1304-phase3-ubuntu/execution.json` | D |
| `evidence/mo1304-phase3-ubuntu/harness-manifest.json` | D |
| `evidence/mo1304-phase3-ubuntu/inputs.json` | D |
| `evidence/mo1304-phase3-ubuntu/installation.json` | D |
| `evidence/mo1304-phase3-ubuntu/mechanisms.stderr.txt` | D |
| `evidence/mo1304-phase3-ubuntu/mechanisms.stdout.txt` | D |
| `evidence/mo1304-phase3-ubuntu/native.stderr.txt` | D |
| `evidence/mo1304-phase3-ubuntu/native.stdout.txt` | D |
| `evidence/mo1304-phase3-ubuntu/package-adversarial.json` | D |
| `evidence/mo1304-phase3-ubuntu/supply-chain-sources.json` | D |
| `evidence/mo1304-phase3-ubuntu/test-catalog.json` | D |
| `evidence/mo1304-phase3-ubuntu/tooling-manifest.json` | D |
| `evidence/mo1304-phase3-ubuntu/tooling-verification.json` | D |
| `evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json` | D |
| `mo1304-conformance-inventory.json` | G |
| `package.json` | G |
| `tests/mo1304_phase2_conformance_test.mjs` | E |
| `tests/mo1304_phase3_ubuntu_conformance_test.mjs` | E |
| `tools/mo1304-phase3/allocation_worker.mjs` | C |
| `tools/mo1304-phase3/boundary_guard.mjs` | C |
| `tools/mo1304-phase3/boundary_process.mjs` | C |
| `tools/mo1304-phase3/boundary_worker.mjs` | C |
| `tools/mo1304-phase3/build_inputs.mjs` | A |
| `tools/mo1304-phase3/certify_ubuntu.py` | A |
| `tools/mo1304-phase3/harness-manifest.json` | A |
| `tools/mo1304-phase3/idle_worker.mjs` | C |
| `tools/mo1304-phase3/installed_boundaries.mjs` | C |
| `tools/mo1304-phase3/linux_network_deny.py` | C |
| `tools/mo1304-phase3/package_adversarial.py` | C |
| `tools/mo1304-phase3/package_verify.py` | C |
| `tools/mo1304-phase3/receipt.schema.json` | B |
| `tools/mo1304-phase3/test-catalog.json` | A |
| `tools/mo1304-phase3/ubuntu_driver.mjs` | C |
| `tools/mo1304-phase3/validate_receipt.py` | B |
| `tools/mo1304-phase3/validator_tests.py` | B |
| `tools/run-js-conformance.mjs` | G |


The harness/evidence commit is
`b95822625f8e7be2cd353b42a8fd185264e9a8bf`, parent B2. The mechanically
required evidence-binding commit is
`d0ebb113a0e333e3956fb4adce6bd798c85a5d50`, parent the harness commit; its
scope is the inventory and two graph-aware conformance tests already listed
above. The user separately authorized a documentation-only correction for the
archive-storage wording. Neither existing commit is amended or rewritten.

## Subsequent Windows evidence

The [Windows certification and parity record](mo1304-phase3-windows-certification.md)
records the later Windows 11 x64 execution on the actual 25H2 host and strict
two-platform comparison. Pending Windows/parity statements earlier in this
Ubuntu-only record describe its original finalization state. The Ubuntu receipt,
its fourteen evidence files and bound harness remain unchanged and validate
locally; the Ubuntu VM was not rerun for this later work.
