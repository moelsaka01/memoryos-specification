# MemoryOS 1.3 MO-1304: MCP Server and Agent Integration

## 1. Authority and status

This is the focused authoritative roadmap specification for **MemoryOS 1.3
MO-1304: MCP Server and Agent Integration**, authorized by the project owner
after architecture and scope review and linked from [ROADMAP.md](../ROADMAP.md).
No authoritative MO-1304 specification existed before this authorization.

This document establishes roadmap/specification authority only. Requirements
identified below as roadmap-authorized are binding direction for Contract
Freeze 1; they are not a frozen MCP implementation contract. The open questions
in section 8 must be resolved by that later contract, without guessing here.
The subsequent [Contract Freeze 1 cache-directive correction](mo1304-contract-freeze-1-cache-correction.md)
records a narrowly scoped implementation-contract correction separately from
this original roadmap authority.

The existing [architecture](../ARCHITECTURE.md) and authoritative MemoryOS
contracts retain their semantic authority.

This task does not implement the MCP server, create `repositories/memoryos-mcp`,
add MCP dependencies, production MCP code or tools, create MCP package files,
or begin MO-1305 or later implementation. A future distributable MCP server and
the MO-1304 conformance surface are authorized only after Contract Freeze 1.
This authority change creates no release tag and does not push a release.

MO-1301, MO-1302, and MO-1303 are closed predecessors. The reviewed baseline is
`main` at `49aa80fa76bffc03e36335be8ab805bb5dc38f9c`, whose subject is
`conformance(memoryos-1.3): close MO-1303 with macOS infrastructure exception`.
The predecessor release references are annotated tags:

| Tag | Annotated tag object | Peeled commit |
|---|---|---|
| `memoryos-1.3-mo1301` | `2cda15d8ab056ac8f2971c5cd9a22cb89fc4821e` | `af6a405b3cd9097ce469b16a854a0568b8acee1f` |
| `memoryos-1.3-mo1302` | `773dd03829dd6b3632bf43a45578925b1498515d` | `7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d` |
| `memoryos-1.3-mo1303` | `f3891cbac8a6ab804887a3d95a595c7bd1523af9` | `49aa80fa76bffc03e36335be8ab805bb5dc38f9c` |

## 2. Roadmap-authorized objective

Provide secure, deterministic, bounded Model Context Protocol access to
selected existing MemoryOS Policy capabilities for authorized AI agents and
MCP-capable clients without expanding, duplicating, or reimplementing
MemoryOS semantic authority.

MO-1304 introduces an integration adapter. It does not introduce another
MemoryOS semantic engine.

## 3. Roadmap-authorized product surface and exclusions

Future MCP access is authorized for selected existing MemoryOS capabilities,
including these candidates:

- contract identity inspection;
- Policy artifact preparation;
- Policy Set artifact preparation;
- Policy evaluation;
- Evaluation Identity verification;
- Policy Outcome verification.

These are capability candidates, not a public MCP tool catalog. Contract
Freeze 1 must determine exact tool count, names, descriptions, request schemas,
response schemas, and capability boundaries. No such details are frozen here.

MO-1304 explicitly excludes:

- a generic REST API, cloud API, cloud service, or SaaS control plane;
- a web dashboard;
- a new Policy Engine, second MemoryOS Core, or new semantic runtime;
- provider-neutral CI and Release Policies;
- Marketplace publication;
- a general-purpose filesystem server or arbitrary command-execution server;
- an agent framework or autonomous agent implementation.

MO-1304 exposes MemoryOS capabilities to agents. It does not implement the
agents themselves.

## 4. Roadmap-authorized delegation architecture

The architectural direction is frozen:

```text
MCP client / AI agent
  -> bounded MCP transport
  -> MemoryOS MCP adapter
  -> existing authoritative MemoryOS SDK/CLI/runtime closure
  -> authoritative MemoryOS implementation
```

The adapter must not independently implement or reinterpret:

- Policy semantics, Policy Set semantics, PolicyFactContext semantics, or
  Regression semantics;
- selectors, rule evaluation, or PASS / FAIL / COULD_NOT_EVALUATE aggregation;
- restricted-JCS canonicalization, `documentDigest`, or `semanticDigest`;
- Evaluation Identity or `evaluationIdentityDigest`;
- Outcome or `outcomeDigest`;
- Resource Profile semantics or stable MemoryOS decision/error semantics.

The exact delegation implementation is deferred to Contract Freeze 1. This
direction does not select a process model, executable, SDK binding, or CLI
invocation mechanism.

## 5. Roadmap-authorized authority principle

**MCP invocation does not itself convey MemoryOS semantic authority.**

An MCP client receives no implicit artifact authority, filesystem authority,
workspace authority, Regression authority, capability authority, or trust
upgrade. Contract Freeze 1 must explicitly define any authority acquisition,
validation, or delegation. No implicit authority escalation is permitted.

## 6. Roadmap-authorized local/offline direction

MO-1304 must be local-first and offline-capable for core MemoryOS operations,
with no cloud dependency for MemoryOS semantics, no arbitrary semantic
executable, no shell/PATH semantic delegation, and bounded deterministic
protocol handling.

Stdio-only transport, network transport, authentication, session protocol, a
specific MCP SDK, and a specific MCP protocol version are not frozen here.
These decisions belong to Contract Freeze 1. Any network-accessible MCP mode
proposed later must explicitly justify its additional authority and security
surface within the product boundaries above.

## 7. Required security analysis for Contract Freeze 1

Contract Freeze 1 must analyze the following, where applicable, and establish
the resulting security contract. This authority task does not prescribe
speculative implementation mechanisms.

- Untrusted MCP clients; malformed MCP/JSON-RPC messages; oversized requests;
  oversized responses; malformed UTF-8; control characters; bidi/control text.
- Path traversal; symlink/reparse attacks; TOCTOU; arbitrary filesystem access;
  workspace authority.
- Shell execution; PATH lookup; child-process execution; remote executable
  selection; command injection; argument injection; unsafe deserialization.
- Capability confusion; authority escalation; cross-request state leakage;
  concurrent requests; stale completion; cancellation; resource exhaustion.
- Identity substitution; canonical-byte substitution; evidence fabrication.
- Secret leakage; credential leakage; logging leakage; network exposure.
- Dependency compromise; supply-chain mutation; platform-specific behavior.

## 8. Questions intentionally deferred to Contract Freeze 1

Contract Freeze 1 must resolve at minimum all of the following. None is
answered by guesswork in this authority document; any resolution must conform
to its roadmap-authorized requirements.

1. Exact MCP protocol/version baseline.
2. Exact supported MCP client/host model.
3. Exact transport.
4. Whether v1 is stdio-only.
5. Exact public tool catalog, including exact tool count and capability boundaries.
6. Exact tool names.
7. Exact tool descriptions.
8. Exact request schemas.
9. Exact response schemas.
10. Exact delegation path.
11. Artifact acquisition model.
12. Filesystem/path authority.
13. Workspace authority.
14. Regression authority if exposed.
15. Session/state model, including session protocol.
16. Concurrency model.
17. Cancellation semantics.
18. Stale-operation handling.
19. Deterministic error mapping.
20. MCP protocol errors vs normative MemoryOS outcomes.
21. Request-size limits.
22. Response-size limits.
23. Timeout policy.
24. Offline behavior.
25. Network policy.
26. Authentication policy if applicable.
27. Logging policy.
28. Secret/credential policy.
29. Package/distribution format.
30. Runtime closure.
31. Dependency policy, including the specific MCP SDK if one is selected.
32. Lockfile policy.
33. Supported operating systems.
34. Supported runtime versions.
35. Real MCP client integration testing.
36. Adversarial testing.
37. Resource-limit testing.
38. Concurrency/cancellation testing.
39. Package verification.
40. Hosted/cross-platform evidence.
41. Package identities.
42. Conformance inventory.
43. Implementation phase decomposition.
44. Implementation commit strategy.
45. Post-commit conformance-binding strategy.
46. Final tag strategy.

## 9. Roadmap-authorized determinism direction

Contract Freeze 1 must classify outputs into:

| Class | Output category |
|---|---|
| A | Normative MemoryOS canonical bytes |
| B | Deterministic MCP transport/projection data |
| C | Non-normative presentation/diagnostic metadata |

Only authoritative MemoryOS components may define normative MemoryOS canonical
identities. The MCP adapter must not create alternate semantic digests for
existing MemoryOS artifacts. Any MCP-specific package, distribution, protocol,
or evidence identities must remain distinct from normative MemoryOS identities.

## 10. Roadmap-authorized resource-limit direction

Preserve predecessor limits without automatically adopting them as MCP
transport limits:

| Existing limit | Bytes | Authority retained |
|---|---:|---|
| Canonical Outcome ceiling | 4060 | MO-1301 |
| Policy transport | 2048 | MO-1303 |
| Policy Set transport | 4096 | MO-1303 |
| MIP transport | 524288 | MO-1303 |

Contract Freeze 1 must determine whether MCP framing requires distinct request
limits, response limits, per-tool limits, and aggregate/session limits. Any new
numeric limit requiring measurement must remain mechanically pending until
measured and adversarially tested. No new numeric MCP limit is frozen here.

## 11. Roadmap-authorized distribution direction

A future distributable MCP server is authorized only after Contract Freeze 1.
The later contract must define package format, package identity, closed file
inventory, runtime closure, dependency closure, lockfile identity, installation
model, entry point, offline behavior, artifact verification, and supply-chain
constraints. No MO-1304 package identity is frozen now.

## 12. Roadmap-authorized testing direction

Later implementation must distinguish:

- unit tests;
- MCP protocol contract tests;
- MemoryOS delegation tests;
- integration tests;
- real MCP client/host tests;
- adversarial tests;
- resource-limit tests;
- concurrency tests;
- cancellation tests;
- package/distribution tests;
- cross-platform tests where required;
- hosted tests where required;
- evidence validation;
- predecessor regressions.

Mocks may support deterministic testing. Mocks must not replace required real
MCP integration evidence.

## 13. Roadmap-authorized conformance direction

Future creation of
`repositories/cca-conformance/mo1304-conformance-inventory.json` and associated
tests, schemas, and evidence is authorized only after Contract Freeze 1. None
is created by this authority task.

The expected eventual release tag is `memoryos-1.3-mo1304`; it must not be
created now. Contract Freeze 1 must define a non-self-referential implementation
and post-commit conformance-binding strategy. Implementation or binding
revisions must not be frozen before they exist.

## 14. Closed predecessor preservation

MO-1301 retains its Policy / Policy Set contracts, PolicyFactContext,
Regression authority, Evaluation Identity, Outcome, restricted-JCS
canonicalization, `documentDigest`, `semanticDigest`, `evaluationIdentityDigest`,
`outcomeDigest`, Resource Profile, SDK 1.1, and CLI 1.1. See the existing
[Policy specification](investigation-policies.md).

MO-1302 retains its GitHub Policy Gate, Action/reusable workflow, distribution
closure, automation semantics, evidence contracts, historical identities, and
release tag/history. See the existing
[GitHub Policy Gate contract](../repositories/cca-conformance/docs/mo1302-github-policy-gate.md).

MO-1303 retains its VS Code extension, five-command public surface, Workspace
Trust behavior, runtime closure, transport limits, VSIX history, hosted
evidence, final conformance binding, release tag, and macOS infrastructure
exception. See the [extension documentation](../repositories/memoryos-vscode/README.md)
and the existing
[final conformance binding record](../repositories/cca-conformance/evidence/mo1303-final-conformance-binding-run-35474897159.json).

Predecessor history must not be rewritten. The binding record and inventory
are immutable historical records; their pre-tag status fields record the
state when written. The verified annotated tag and current-status
documentation record the completed MO-1303 exception release without changing
those historical bytes or identities.

## 15. MO-1303 historical exception

The actual final MO-1303 release is `memoryos-1.3-mo1303`, targeting final
conformance binding `49aa80fa76bffc03e36335be8ab805bb5dc38f9c`.

| Historical result | Actual final status |
|---|---|
| Ubuntu hosted certification | PASS |
| Windows hosted certification | PASS |
| macOS hosted certification | NOT EXECUTED due external GitHub runner-allocation/billing restriction |
| Three-platform parity | NOT EXECUTED |
| MO-1303 | released with explicit external-infrastructure exception |

The planned certification requirement was matching hosted evidence on all
three platforms and strict three-platform validation. That requirement and
validator remain intact. The actual exception release does not claim its
fulfillment. Two-of-three is not three-of-three.

Future MO-1304 macOS evidence is MO-1304 evidence and must not retroactively
rewrite MO-1303 history.

## 16. Roadmap boundaries and next task

- MO-1305: currently undefined; this task does not redefine it.
- MO-1306: provider-neutral CI integrations including GitLab, Jenkins, Azure
  DevOps, and generic CI; not part of MO-1304.
- MO-1307: higher-level Release Policies; not part of MO-1304.

Unrelated proposal material remains proposed, not committed scope. This
document records roadmap authority and the questions for a subsequent contract;
it does not start implementation of this or any later milestone.

The exact next task title is:

**MEMORYOS 1.3 MO-1304 MCP SERVER AND AGENT INTEGRATION CONTRACT FREEZE 1**
