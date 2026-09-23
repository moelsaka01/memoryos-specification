# MemoryOS 1.3 MO-1305 — REST Gateway

## 1. Authority, status, and reviewed baseline

Status: **AUTHORIZED / CONTRACT FREEZE 1 NEXT**.

This owner-authorized specification establishes the roadmap boundary for
MemoryOS 1.3 MO-1305 — REST Gateway. It is linked from the reconciled
[ROADMAP](../ROADMAP.md). Its preservation rules, exclusions, and required
analyses govern Contract Freeze 1. Candidate capabilities and unresolved
decisions are not an implementation contract.

The reviewed baseline is clean `main` in
`C:\Users\melsa\Documents\Codex\cca-workspace` at
`63980ec4004a7ea752778283f8e3ad4d2ed7a3aa`, subject
`docs(memoryos-1.3): reconcile post-MO-1304 roadmap`, with parent
`ce7b001d911239fa50d904f5f336bb1bd7858ba3`. The four existing release references
are unchanged annotated tags:

| Tag | Annotated tag object | Peeled commit |
|---|---|---|
| `memoryos-1.3-mo1301` | `2cda15d8ab056ac8f2971c5cd9a22cb89fc4821e` | `af6a405b3cd9097ce469b16a854a0568b8acee1f` |
| `memoryos-1.3-mo1302` | `773dd03829dd6b3632bf43a45578925b1498515d` | `7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d` |
| `memoryos-1.3-mo1303` | `f3891cbac8a6ab804887a3d95a595c7bd1523af9` | `49aa80fa76bffc03e36335be8ab805bb5dc38f9c` |
| `memoryos-1.3-mo1304` | `6d877151f0857006fcf12958f8b4c5bc662f43d6` | `ce7b001d911239fa50d904f5f336bb1bd7858ba3` |

This task creates no production source, server package, dependencies, endpoints,
HTTP tests, OpenAPI document, container configuration, runtime artifact,
conformance inventory, or certification evidence. It creates neither
`repositories/memoryos-rest` nor `repositories/memoryos-gateway`. It authorizes
no implementation, push, or tag.

The [architecture](../ARCHITECTURE.md) and released MemoryOS contracts retain
their authority. The architecture's requirement for separately approved network
architecture remains a gate: this document establishes direction and questions;
Contract Freeze 1 must settle the bounded gateway architecture before
implementation can rely on it. No released component acquires network behavior
through this authority task.

## 2. Objective and delegation principle

Provide a secure, deterministic, bounded HTTP/API gateway to selected existing
MemoryOS capabilities, enabling authorized non-local clients and service
integrations to invoke MemoryOS functionality without duplicating,
reinterpreting, or replacing existing MemoryOS semantic authority.

The REST Gateway is an integration/transport surface, not a new MemoryOS
semantic engine. Its intended authority flow is:

```text
HTTP/API client
  -> bounded REST transport
  -> REST adapter
  -> existing authoritative MemoryOS integration/runtime layer
  -> authoritative MemoryOS implementation
```

Contract Freeze 1 must select and justify the exact delegation layer. The
non-local-client objective does not pre-authorize any remotely exposed v1
mode: its authentication, authorization, binding, and deployment contract must
first be resolved. A decision to support no remotely exposed v1 mode must be
explicit about that limitation.

### Existing delegation audit

| Candidate or existing boundary | Repository evidence | Constraint on Contract Freeze 1 |
|---|---|---|
| Public MemoryOS SDK | [SDK overview](../repositories/cca-sdk/README.md) and [Policy API reference](../repositories/cca-sdk/docs/api-reference.md) expose SDK 1.1 preparation, capture, evaluation, verification, and identity operations. | A viable candidate for analysis. Core owns investigation semantics; the Policy Engine owns Policy semantics; MIP owns package verification. Preserve owner-bound context/Regression capabilities and exact evaluator-produced bytes. SDK support does not itself authorize every operation for REST. |
| Existing MCP-independent semantic runtime closure | [MCP delegation](../repositories/memoryos-mcp/src/delegation.mjs) loads the public SDK from the verified [authoritative runtime closure](../repositories/memoryos-mcp/runtime/runtime-closure-manifest.json). The adapter and MCP transport are outside that semantic closure. | Audit whether and how the existing authoritative source closure could serve a separate gateway with its own integrity and distribution boundary. Its location inside the MCP package is not a reusable public REST interface or permission to change that package. Do not inherit MCP acquisition, framing, scheduling, or security assumptions. |
| Existing CLI | [Policy CLI guide](../repositories/memoryos-cli/docs/policy-guide.md) and [Policy commands](../repositories/memoryos-cli/src/policy-commands.js) delegate through the SDK. Evaluation is MIP-backed, with bounded authoritative Regression acquisition where supported. | A viable candidate for analysis. Preserve exact artifact bytes, verification modes, stable errors and exit distinctions. CLI file operands and process-local authority are not client filesystem permissions or a remote authority protocol. No shell/PATH or process model is selected here. |
| Other already-authoritative public integration layer or narrow combination | [Investigation Core](../repositories/cca-studio/docs/investigation-core.md) documents the single investigation authority. The [private native/Python binding](../repositories/cca-sdk/bridge/README.md) explicitly is not a public service or alternate API. | Identify an existing public contract and prove coverage of the selected Policy operations before choosing it. Do not expose private bridge tokens or bypass Policy authority. A combination must preserve one authority for each semantic operation and cannot synthesize missing capabilities. |

The audit finds a required semantic ownership boundary, but no existing
repository authority selecting one exact REST delegation target. The selection
therefore remains unresolved. Artifact inspection, valid digests, or successful
authentication cannot recreate an owner-bound Core/Regression capability.

## 3. Candidate capability surface

These are candidates for Contract Freeze 1, not an endpoint catalog or a promise
that every candidate is included in v1:

- contract identity inspection;
- Policy preparation;
- Policy Set preparation;
- Policy evaluation through already-authoritative operations;
- Evaluation Identity verification;
- Policy Outcome verification;
- non-semantic gateway health/readiness information;
- bounded gateway metadata where justified.

Contract Freeze 1 must decide exact operation coverage, including Policy Set
evaluation, verification modes, and any existing Regression acquisition exposed
by a selected operation. No new Regression authority is permitted. Health and
readiness candidates concern gateway operation, not MO-1307 release readiness.

No endpoint name or path, HTTP method, request/response JSON, status-code
mapping, header, API namespace, or OpenAPI operation ID is frozen here.

## 4. Trust, authority, and semantic preservation

**HTTP request receipt does not imply semantic trust. Network reachability does
not imply MemoryOS authority. Authentication does not imply arbitrary capability
authority.** Request data remains hostile until validated under the future
contract and the existing semantic authorities.

Authentication, authorization, capability authority, and MemoryOS semantic
authority are separate concerns. An authenticated client receives no implicit
host filesystem, workspace, artifact, Regression, environment-secret, process
execution, arbitrary outbound-network, or unbounded MemoryOS capability access.
Transport validation must not replace semantic validation or mint provenance.

MO-1305 preserves existing canonicalization, normative bytes and digests. HTTP
headers, timestamps, request/server IDs, correlation values, credentials, and
other transport/operational metadata cannot enter normative MemoryOS identity.
There is no alternate REST canonical form or REST semantic digest authorization.
Gateway secrets must not enter normative MemoryOS bytes or evidence.

Completed `PASS`, `FAIL`, and `COULD_NOT_EVALUATE` evaluations remain successful
MemoryOS outcome production with their distinct semantic decisions. Non-PASS
decisions must not automatically become HTTP transport failure. Transport,
validation, authentication, authorization, resource, adapter, and availability
errors require separate treatment. Exact mapping is a Contract Freeze decision;
gateway failure cannot fabricate a Policy decision.

Existing semantic Resource Profile limits remain binding where applicable.
MCP framing limits are not HTTP limits. Gateway limits require separate
measurement and freeze; no unbounded queue or implicitly unlimited concurrency
is authorized. Gateway state may not introduce durable semantic state.

## 5. Released predecessor preservation

| Milestone | Preserved contract and history |
|---|---|
| MO-1301 — Policy / Core Foundation | All [Policy](investigation-policies.md), Policy Set, PolicyFactContext, PASS/FAIL/COULD_NOT_EVALUATE, Evaluation Identity, Policy Outcome, restricted-JCS canonicalization, normative bytes/digests, Resource Profile, SDK/CLI contracts, Regression authority, and semantic validation/error rules. Preserve `documentDigest`, `semanticDigest`, `evaluationIdentityDigest`, and `outcomeDigest`; REST creates no alternate identities. |
| MO-1302 — GitHub Actions / GitHub Policy Gate | The [GitHub Policy Gate](../repositories/cca-conformance/docs/mo1302-github-policy-gate.md), Action/workflow semantics, automation behavior, distribution identities, evidence, conformance, release tag, and history. No provider-neutral CI generalization occurs here. |
| MO-1303 — VS Code Extension | The [extension contract](../repositories/memoryos-vscode/README.md), five-command surface, Workspace Trust, runtime closure, VSIX distribution, resource behavior, certification history, release tag, and explicit macOS infrastructure exception. Ubuntu/Windows hosted PASS, macOS NOT EXECUTED, and three-platform parity NOT EXECUTED remain unchanged. |
| MO-1304 — MCP Server and Agent Integration | The released MCP 2026-07-28 contract, six-tool catalog, local stdio, delegation, runtime closure, resource limits, package identity, Ubuntu/Windows certification, cross-platform parity, Windows support correction, supply-chain disposition, final binding, tag, and history. |

The [original MCP authority](mo1304-mcp-server-agent-integration.md),
[cache-directive correction](mo1304-contract-freeze-1-cache-correction.md),
[Windows support correction](mo1304-contract-freeze-windows-support-correction.md),
and [Windows certification/parity record](../repositories/cca-conformance/docs/mo1304-phase3-windows-certification.md)
remain intact. Actual Windows 11 Home 25H2 build 26200.9457 x64 certification
is not relabeled; the supported family remains Windows 11 x64. Ubuntu evidence,
network-evidence limits, and the existing unpatched dependency risk disposition
are neither rewritten nor automatically transferred to a network-facing gateway.

MO-1305 cannot modify MCP protocol behavior, add MCP tools, change MCP schemas
or package bytes, or rewrite MO-1304 evidence. Related underlying capabilities
do not make REST and MCP the same integration contract. Any use of an MCP
transport assumption requires explicit analysis rather than automatic reuse.

## 6. Future milestone boundaries and explicit exclusions

| Milestone | Scope excluded from MO-1305 |
|---|---|
| MO-1306 — Provider-Neutral CI/CD Integration | GitLab, Jenkins, Azure DevOps, generic CI/CD provider adapters, and provider-neutral CI orchestration. Future integrations may consume REST, but MO-1305 does not implement them or rewrite MO-1302. |
| MO-1307 — Release Policies / Release Readiness | New higher-level Release Policies, release-governance semantics, release-readiness composition, and release decision engines. Transport of existing capabilities does not authorize new release-policy semantics. |
| MO-1308 — Investigation History | Durable investigation/evaluation history, evaluation-history databases, history query engines, historical evidence persistence, and long-term audit-store architecture. Transient gateway logs are operational records, not authoritative Investigation History. |
| MO-1309 — Cloud Dashboard | Dashboard UI, multi-tenant control plane, billing, customer/user/account management, cloud product architecture, and cloud-hosted management plane. The gateway is not implicit authorization for the Cloud Dashboard backend milestone. |

Also excluded: new Policy semantics, canonicalization rules or semantic digest
algorithms; new Regression authority; arbitrary filesystem serving, arbitrary
URL fetching, arbitrary command execution or shell serving; general-purpose
proxying; agent frameworks and autonomous agents; MCP protocol expansion; and
VS Code expansion.

MO-1305 is a REST/API gateway. It does not automatically imply public Internet
hosting, SaaS, multi-tenancy, persistent accounts, billing, managed cloud
deployment, or a hosted control plane. A reverse proxy or service deployment
question does not authorize a general-purpose proxy or cloud management product.
Contract Freeze 1 must state the supported v1 binding/deployment assumptions
and explicitly reject or defer unsupported modes.

## 7. Testing and conformance direction

Future validation must distinguish unit, API contract, delegation, semantic
parity, real HTTP integration, and real client interoperability tests from
malformed-HTTP and security/adversarial tests. Authentication/authorization tests
are required where applicable. Resource limits, concurrency, disconnect and
cancellation, backpressure, shutdown, filesystem/network boundaries, and
observability need their own evidence. Packaging, installed-package execution,
actual platform certification, cross-platform parity where required, and
predecessor regressions remain separate claims. Mocks cannot replace required
real HTTP/process evidence.

Future conformance is expected to include `mo1305-conformance-inventory.json`,
schemas, bounded receipts, artifact identities, implementation revision binding,
a non-self-referential evidence strategy, release binding, and eventually the
annotated tag `memoryos-1.3-mo1305`. None is created or certified by this task.
Contract Freeze 1 must determine their exact scope, implementation phases,
commit/binding sequence, validation gates, and release/tag review strategy.
Future commit hashes cannot be invented or made to hash themselves.

Platform policy must follow the actual implementation/deployment model; it does
not automatically inherit MO-1304's matrix or certify every supported host.
Feature-release pinning requires technical justification. Eventual receipts
must record the actual OS, release/build, architecture, and runtime identity.

## 8. Contradiction audit and interpretation

The pre-edit tracked repository search covered MO-1305, REST Gateway, REST API,
HTTP gateway, HTTP API, server, cloud API, REST, and related roadmap boundaries.
Broad substring results such as `restore` and `observers` were screened for
relevance rather than treated as REST/server authority.

| Relevant occurrence | Classification and disposition |
|---|---|
| `ROADMAP.md`, reconciled MO-1305 and MO-1306–MO-1309 sections | Current roadmap authority. Advance only MO-1305 from authority pending to Contract Freeze 1 next; retain future milestone scopes. |
| Original MO-1304 authority, especially sections 3 and 16 | Frozen predecessor boundary and historical statement. REST/cloud exclusions apply to MO-1304; then-undefined MO-1305 records its earlier state. Preserve the document. |
| SDK overview and SDK conformance scope exclude REST/network transports | Released component boundary. A separate gateway may delegate to the SDK without adding transport to it. Preserve SDK scope. |
| Investigation Core documentation and the MO-1203 changelog refer to future REST/MCP clients | Existing semantic authority and historical direction. Clients remain thin; this is not an endpoint contract, a delegation-target selection, or authorization to expose the entire Core. |
| Architecture section 13, coding standards, and ambiguity-register network exclusions | Existing implementation boundary and architecture gate. This task supplies separate prospective gateway direction; implementation remains blocked on its approved frozen architecture, without changing released semantics. |
| MCP implementation, dependency/package metadata, certification tools, receipts, inventories, and supply-chain records mentioning servers | Released implementation, frozen package identities, test machinery, and release evidence. No REST authorization; preserve all bytes and historical claims. |
| GitHub Enterprise Server limitations, VS Code language-server exclusion, and older Studio server/capture documentation | Unrelated product boundaries or historical documentation; not MO-1305 scope. |
| Server references in tests, fixtures, and network-denial probes | Test/example data and existing boundary assertions. They neither define REST endpoints nor certify a gateway. |

No substantive contradiction requiring changes to released authority was found.
No existing REST endpoint, framework, authentication mechanism, deployment
model, or OpenAPI contract was found to be authoritative for MO-1305. If later
review uncovers a substantive conflict requiring released authority to change,
stop and resolve it explicitly; do not silently relax a predecessor contract.

The exact next task is:

**MEMORYOS 1.3 MO-1305 REST GATEWAY CONTRACT FREEZE 1**

## 9. Contract Freeze 1 decision register

Every category below is **UNRESOLVED** except for the existing authority and
explicit constraints stated above. Contract Freeze 1 must select, reject, or
explicitly defer each alternative, record rationale and evidence obligations,
and close every implementation-critical decision before implementation begins.
An unsupported feature requires a defined exclusion rather than an assumed
default. Release-critical limits must eventually be measured and frozen; any
measurement-dependent pending value needs an explicit resolution/release gate.
No options in this register are promises of support.

### A. Semantic delegation

- Select public SDK, existing MCP-independent runtime closure, CLI, another
  already-authoritative public integration layer, or a narrowly justified
  combination, using the audit above. Identify the public contract and exact
  authoritative implementation reached for every chosen capability.
- Define artifact acquisition, owner lifetimes, Policy/Policy Set evaluation
  coverage, verification modes, and whether any existing Regression capability
  is exposed. Preserve context/source provenance and semantic validation.
- Define runtime integrity and normative contract-identity checks, exact-byte
  retention, and parity oracles; prohibit a second evaluator or canonicalizer.

### B. API surface and gateway state

- Decide the endpoint catalog, names, URL paths, HTTP methods, content types,
  request/response/error schemas, status-code mapping, headers, API namespace,
  idempotency semantics, request IDs, correlation IDs, and bounded metadata.
- Decide whether health, readiness, version, and contract-identity operations
  exist. Classify each field as normative, deterministic, or operational;
  normative contract identities retain their existing meaning. Freeze no path
  by analogy with an existing private binding or MCP tool name.
- Decide stateless, session-scoped, connection-scoped, or bounded operational
  state; define isolation, ownership, retention, and cleanup. Any cache needs
  explicit authority, identity, lifetime, resource, and cross-client analysis.
  No durable semantic state or Investigation History is introduced.

### C. HTTP transport

- Decide HTTP protocol versions, HTTP/1.1 and HTTP/2 requirements, and HTTP/3
  status. Determine TCP binding, loopback-only versus configurable binding,
  IPv4, IPv6, and Unix sockets if considered.
- Decide TLS versus plain HTTP, termination and reverse-proxy assumptions,
  connection lifecycle, keep-alive, request pipelining, streaming, chunked
  transfer, content length, compression, proxy behavior, and forwarded headers.
- Define framing/normalization and rejection behavior consistently across the
  supported parser, server, and proxy chain. Do not guess defaults now.

### D. Authentication

- Decide whether v1 supports unauthenticated loopback-only operation, static
  tokens, bearer tokens, API keys, mTLS, reverse-proxy delegated authentication,
  another bounded mechanism, or no remotely exposed mode.
- Define validation, failure behavior, credential lifecycle assumptions, and
  trust in any authenticating proxy independently of authorization decisions.

### E. Authorization

- Define which authenticated or unauthenticated principals, if any, may invoke
  each selected operation and under which explicitly granted capabilities.
- Separate authentication, authorization, capability authority, and MemoryOS
  semantic authority. Define denial behavior without implicit filesystem,
  workspace, Regression, artifact, or arbitrary-execution grants.

### F. Trust/authority and security analysis

Contract Freeze 1 must analyze applicability, trust boundaries, rejection or
containment requirements, and required evidence for at least the following.
This list mandates analysis, not speculative implementation mechanisms:

- Hostile HTTP clients; malformed requests; request smuggling; response
  splitting; header injection; CRLF injection; path confusion; URL normalization;
  percent encoding; Unicode normalization; duplicate headers and JSON keys;
  invalid UTF-8 and JSON; content-type confusion; content-length and
  transfer-encoding ambiguity.
- Oversized headers/bodies; slowloris and slow bodies; connection exhaustion;
  request flooding; concurrency exhaustion; cancellation/disconnect races;
  timeout behavior; body buffering; compression bombs if compression exists;
  deserialization abuse; prototype pollution where applicable.
- Filesystem traversal; URI-based acquisition; SSRF; arbitrary outbound network
  access; command injection; shell execution; environment injection;
  module/preload injection; TOCTOU; runtime and dependency substitution.
- Secret exposure; credential loading; logging injection; sensitive-data
  logging; error and stack-trace leakage; authentication/authorization bypass;
  capability escalation; supply-chain integrity.
- CORS if browsers are supported; CSRF if browser credentials are supported;
  DNS rebinding where relevant; Host-header attacks; proxy trust;
  forwarded-header spoofing; TLS downgrade assumptions.

### G. Determinism

- Classify normative MemoryOS bytes, deterministic REST projections, HTTP
  transport metadata, presentation-only metadata, timestamps, request IDs,
  server IDs, and headers. Define stable versus non-stable fields explicitly.
- Preserve authoritative canonical bytes and digests. Define transport encoding
  without alternate semantic canonicalization or REST-specific semantic digests
  unless separately authorized. Transport metadata cannot contaminate identity.

### H. Errors

- Separate completed MemoryOS outcomes, including PASS, FAIL, and
  COULD_NOT_EVALUATE, from transport, request-validation, authentication,
  authorization, resource-limit, internal-adapter, and availability failures.
- Distinguish existing semantic resource results from gateway admission or
  execution failure. Freeze HTTP status/error mapping, stable machine fields,
  and bounded presentation without deriving decisions from human error text.
- Define cancellation/disconnect failures and partial-publication behavior;
  non-PASS is not automatically transport failure, and errors cannot invent
  outcomes, normative evidence, or secret-bearing details.

### I. Resource limits

- Determine maximum request/response body size, URL size, header bytes/count,
  JSON depth, member/node counts, and string size; account for encoding,
  buffering, compression, and intermediate allocations where applicable.
- Determine concurrent-request count, queue depth, connection limit, request
  rate, connection rate, memory budgets, and worker/process budgets.
- Determine body-read, header, operation, response-write, idle, and shutdown
  timeouts, including backpressure and slow-client behavior.
- Preserve applicable semantic limits separately from HTTP budgets; do not copy
  MCP framing values. Identify release-critical measurements, worst-case and
  boundary witnesses, failure behavior, and the gate for freezing each limit.

### J. Concurrency/cancellation

- Define parallel semantic-operation count, bounded queueing, busy behavior,
  admission, worker lifecycle, server shutdown interaction, and cleanup.
- Define client disconnect semantics, operation cancellation, publication after
  disconnect, request-ID reuse, stale-result suppression, timeout races, and
  disconnect races. Identify exactly when publication becomes irreversible.
- Establish isolation between clients/requests and evidence for bounded
  backpressure, resource reclamation, and no publication from stale operations.

### K. Filesystem

- Decide inline bounded content, canonical encoded content, pre-authorized
  artifact identities, or another explicitly bounded acquisition mechanism.
- Analyze and reject uncontrolled absolute/relative paths, file URIs, workspace
  and home-directory references, network/UNC/device paths, symlinks, junctions,
  ADS, and URI-based fetching unless explicitly authorized within the bounded
  contract. Arbitrary filesystem serving and arbitrary fetching remain excluded.
- Define any gateway-owned files, temporary storage, lifetime, path/race
  defenses, and authority checks. Client-supplied names or digests alone confer
  no filesystem or semantic authority.

### L. Network

- MO-1305 is network-facing, unlike MO-1304 local stdio. Determine allowed
  inbound interfaces and loopback, LAN, and public-deployment status. Public
  Internet exposure is not assumed.
- Determine whether outbound access exists, whether semantic execution requires
  it, and whether semantic workers are network-denied. Define DNS, proxy, and
  reverse-proxy behavior and the exact trust in forwarded connection metadata.
- Require honest evidence of achieved network boundaries; do not transfer MCP
  offline or OS-denial claims to HTTP execution without separate validation.

### M. Secrets

- Decide whether gateway credentials exist, their permitted sources/loading,
  environment-variable and file policy, redaction, rotation assumptions,
  process inheritance, and child-worker exposure.
- Define secret-free responses, logs, diagnostics, and retained evidence. No
  gateway credential may become normative MemoryOS bytes or evidence.

### N. Observability

- Separate operational/security logs, metrics, traces, and request correlation
  from normative MemoryOS evidence and MO-1308 Investigation History.
- Determine permitted and prohibited log content, bounded diagnostic size,
  stable/non-stable fields, PII/secrets treatment, stack traces, error details,
  log injection defenses, and operational retention/cleanup assumptions.

### O. Framework/runtime

- Select any web framework, HTTP server library, language/runtime, supported
  versions, execution/process model, startup/shutdown contract, and runtime
  integrity policy only after delegation and supply-chain implications are
  reviewed. No framework or runtime is selected by this document.
- Justify parser, lifecycle, isolation, cancellation, and resource behavior
  against the authority/security requirements rather than library defaults.

### P. Dependencies/supply chain

- Define dependency closure, versions/pins, lockfile policy, substitution
  defenses, update/review procedure, lifecycle-script policy, native addons,
  platform dependencies, licensing/notices, and SBOM status if applicable.
- Review the selected framework/runtime and transitive components for the
  actual exposed gateway paths. Existing MO-1304 supply-chain dispositions
  remain historical and cannot automatically justify new HTTP exposure.

### Q. Packaging/distribution

- Determine package boundary, entry point, runtime/dependency closure,
  installation method, offline installation, archive format, manifest,
  verification, license notices, reproducibility, and release artifact identity.
- Define installed-package integrity and independence from a source checkout,
  precise supported installation behavior, and separate distribution identity
  from normative MemoryOS identity. No package is created during authority.

### R. Deployment

- Decide the supported v1 model: local developer process, single-host service,
  container, system service, reverse proxy, cloud VM, serverless, or Kubernetes
  are questions, not commitments. Explicitly exclude or defer unsupported modes.
- Define binding, configuration, operational ownership, permissions, startup,
  shutdown, and proxy/TLS responsibility for the selected model without adding
  a SaaS, multi-tenant, account-management, or cloud control plane.

### S. Platform support

- Determine supported versus certified platforms and runtime identities from
  the selected implementation and deployment model. Do not automatically inherit
  MO-1304's matrix; justify any OS feature-release pin technically.
- Require actual OS/release/build, architecture, runtime, and relevant process
  environment in certification receipts. Define any cross-platform parity gate
  and unsupported-platform behavior without relabeling execution evidence.

### T. Testing

- Define required unit, API contract, delegation, semantic parity, real HTTP,
  real client interoperability, malformed HTTP, security/adversarial,
  authentication/authorization where applicable, resource, and concurrency tests.
- Define disconnect/cancellation, backpressure, shutdown, filesystem/network
  boundary, observability, packaging, installed-package, platform certification,
  required cross-platform parity, and predecessor regression evidence.
- Separate mocks from real process/HTTP evidence, define independent semantic
  oracles, and specify negative and boundary witnesses for each release gate.

### U. Conformance/evidence

- Define the future inventory, schemas, bounded receipts, artifact identities,
  implementation revision binding, non-self-referential evidence strategy,
  release binding, and eventual annotated `memoryos-1.3-mo1305` tag target.
- Decide implementation phases, commit strategy, post-commit binding sequence,
  evidence validation, and release/tag review gates. Preserve historical
  predecessor artifacts instead of regenerating them to match new claims.

### V. Versioning/OpenAPI

- Determine Gateway product/package version, API version, their relationship
  to MemoryOS 1.3, backward compatibility, endpoint/schema evolution,
  deprecation, and unsupported-version behavior. REST v1 does not imply a
  package version of 1.0.0.
- Decide whether OpenAPI exists and whether it is normative or non-normative
  documentation; separately decide generated versus hand-authored form, or
  exclusion from v1. If present, decide schema publication, operation IDs,
  consistency checks, and whether its bytes are release-bound. Create none now.

### W. Clients/browser support

- Decide whether any official REST client is in scope. JavaScript/Python REST
  clients, a CLI HTTP client, and generated clients are not automatically
  included and cannot be created unless explicitly frozen.
- Decide whether direct browser clients are supported. If supported, analyze
  CORS, CSRF, credential storage, origin policy, preflight, and browser caching.
  If excluded, do not add browser-specific behavior by assumption.
