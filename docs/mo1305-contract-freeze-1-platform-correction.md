# MO-1305 Contract Freeze 1 — platform correction

Status: **CORRECTED / PHASE 1 RESUME**. Authorized 2026-09-23.

## Authority and reason

This correction has parent freeze revision
`ce1780e2dac0afe31aeb947f0a7f78b953e17f6b`, itself parented by roadmap authority
`d15b578dd757e928273d4548348b085e58ed5df5`. It prospectively overrides only
conflicting platform, measurement-target and cross-platform parity requirements
in [Contract Freeze 1](mo1305-contract-freeze-1.md). The original revision remains
available unchanged. Its Windows/Ubuntu matrix had prevented Phase 1 resource
measurements after the prior Ubuntu environment was removed. The owner expressly
requires use of the existing physical Windows host and no additional OS or VM.

## Corrected v1 policy

The sole supported, development, measurement and release-certification family
is **Windows 11 x64**, on the existing physical host. Ubuntu, Linux, WSL and
every VM, including an additional Windows VM, are **NOT_REQUIRED** throughout
Phase 1, Phase 2, Phase 3 and release closure. Cross-platform parity is
**NOT_REQUIRED**. No Ubuntu/Linux receipt, two-platform equality gate or parity
receipt is produced. These platforms are outside the MO-1305 v1 contract;
this is not a permanent MemoryOS exclusion. Future versions or milestones may
authorize other platforms separately. Do not contact the deleted Ubuntu VM,
attempt SSH to its former endpoint, or alter the operator's network configuration.

Receipts must record detected Windows edition, release, full build, architecture,
runtime/client versions and executable hashes. Support is not pinned to 25H2.
Read-only CIM and CurrentVersion registry detection for this correction reported:

| Field | Actual value |
|---|---|
| Edition | Microsoft Windows 11 Home |
| Release | 25H2 |
| Full build | 26200.9457 |
| Architecture | x64 / 64-bit OS |
| Physical host | Dell Inspiron 5406 2n1 |
| Node | 24.21.0, win32 x64 |
| Node SHA-256 | `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32` |
| npm | 11.19.0 |

This detection is environment provenance, not gateway certification. Future
executions must detect their own actual values rather than copying this table.

## Requirements retained

The exact Node/npm pins, public SDK 1.1.0 delegation, 25-file closure and policy
identity pin remain unchanged. All six semantic operations and three operational
routes, HTTP/1.1, TLS 1.3, authentication, raw framing, security, admission,
cancellation, integrity, environment hardening and package requirements remain
binding. Independent **SDK semantic parity remains REQUIRED**, including exact
normative bytes, digests, decisions, verification and stable errors. Both Node
fetch and curl, raw TLS tests and genuine installed-process HTTP evidence remain
required. MCP is only a sibling semantic witness, never a runtime dependency.

Freeze §8.1 retains **30 cold + 100 warm samples per case**, without discarding
outliers, and **three 60-second repetitions** of every required adverse scenario.
Only the platform count changes. Derive limits from all required Windows samples
and scenarios using the unchanged headroom, rounding and worst-case formulas.
N−1/N/N+1 witnesses and all preliminary safety ceilings remain binding. If a
required Windows value cannot be established, stop without B1. Phase 3 confirms
the unchanged installed archive on Windows; Phase 1 creates no Phase 3 evidence.

Remote mode remains refused in Phase 1. Its later real non-loopback tests use
separate client processes on this Windows host and its assigned RFC1918
interface, with normal certificate trust and actual route/address provenance.
Loopback or forged Host tests cannot substitute for that execution. No additional
host or VM is required and no network configuration change is authorized.
Windows-compatible worker network denial must record its mechanism and limits;
Linux seccomp or VM evidence is not a prerequisite.

## Evidence and commit graph

Sequence: **F → C → I1 → B1 → I2 → B2 → I3 → BF**, with a separately authorized
release tag later. C is this correction role; its actual hash is recorded only
after it exists. I1 must directly parent C. B1 must directly parent I1 and change
only binding/evidence data. Inventory and receipts add
`platformCorrectionRevision`. The corrected freeze defines one Windows platform
record, explicit NOT_REQUIRED policy states, no parity receipt type, and required
SDK vector equalities in HTTP/platform evidence. No future or self hashes.

C contains correction documentation and pre-implementation contract fixtures
only. The 37 existing package files and Phase 1 checklist were audited as valid
partial Phase 1 work, not completed implementation. Their pre-correction byte
identities were recorded locally and are checked unchanged after C. None enters
the correction commit. Ten existing foundation unit tests passed on the pinned
Node, and all 25 copied runtime files matched authoritative source bytes.

The repository already has pre-implementation platform contract checks under
`repositories/cca-conformance/tools/mo1304-platforms`. The independent MO-1305
policy and validator under `tools/mo1305-platforms` follow that mechanism without
changing the released MO-1304 validator or its receipts. Their fixtures reject
extra platforms, Linux/VM obligations, two-platform receipt expectations,
cross-platform parity, missing actual Windows identity, runtime drift and removed
semantic/HTTP/security/resource gates. They do not emit execution receipts.

## Search classification and predecessor preservation

| Occurrences | Classification and action |
|---|---|
| Freeze §§8–9, 11–13, 14 and A–W register | Current MO-1305 measurement, executable, certification, inventory and release obligations: corrected prospectively |
| Freeze §12.2 parity | Retain mandatory SDK semantic parity and clients/modes; remove only repetition across OS targets |
| Current MO-1305 roadmap section | Correct Windows-only certification and link this record |
| Original roadmap-authority questions about platforms, cloud VM and parity | Historical delegated questions; preserve text, add subsequent correction link |
| Original Phase 1 checklist's unavailable Ubuntu/SSH/VM notes | Historical partial-attempt facts; preserve through C, supersede explicitly during resumed implementation |
| Package contracts/runtime/partial tests | No current Ubuntu/Linux/VM requirement; authoritative source strings and identity pins unchanged |
| MO-1301–MO-1304 tags, evidence, tools and roadmap paragraphs | Historical/released authority; untouched, including Ubuntu certification and Windows/Ubuntu parity |
| General roadmap future Windows/Linux/macOS evidence | Future milestones, outside this correction |

This correction creates no implementation or certification PASS. All other
freeze requirements and the predecessor regression trigger policy remain intact.
