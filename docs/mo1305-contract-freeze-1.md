# MemoryOS 1.3 MO-1305 — REST Gateway Contract Freeze 1

Status: **CONTRACT FROZEN / PHASE 1 NEXT**. Contract identifier:
`memoryos.rest.contract-freeze-1`, version `1.0.0`. Reviewed 2026-09-23.

## 1. Authority and boundary

This is the implementation contract delegated by the complete
[MO-1305 roadmap authority](mo1305-rest-gateway.md), decision categories A–W.
It supplies the separately approved, bounded network architecture required by
[ARCHITECTURE.md](../ARCHITECTURE.md); networking is confined to this new
adapter. It changes no released MemoryOS semantic authority. MUST, MUST NOT,
and the exact catalogs below are requirements, including when expressed as
ordinary imperative prose. A future implementation may not enlarge this
contract through a framework default.

Reviewed workspace: `C:\Users\melsa\Documents\Codex\cca-workspace`, clean
`main`, authority commit `d15b578dd757e928273d4548348b085e58ed5df5`, subject
`docs(memoryos-1.3): authorize MO-1305 REST Gateway`, parent
`63980ec4004a7ea752778283f8e3ad4d2ed7a3aa`. The authority document at that
commit, rather than subsequent edits to a moving branch, is the authority pin.
The annotated MO-1301–MO-1304 tag objects and peeled commits in its section 1
were rechecked unchanged. In particular, `memoryos-1.3-mo1304` remains tag
object `6d877151f0857006fcf12958f8b4c5bc662f43d6`, peeling to
`ce7b001d911239fa50d904f5f336bb1bd7858ba3`.

This freeze contains documentation only. It neither implements nor certifies
a server. It creates no package, dependency, lockfile, generated OpenAPI,
runtime copy, test, inventory, or receipt. No push or tag is part of this task.
Future artifact names describe required outputs of the assigned phase.

The API exposes six existing semantic capabilities, with no generic invocation,
arbitrary Core access, stateful investigation session, baseline acquisition,
history, CI provider integration, release-policy composition, browser UI, or
cloud control plane. MO-1306–MO-1309 retain their existing assignments.

## 2. Semantic delegation and exact runtime inputs

Select the public JavaScript MemoryOS SDK **1.1.0**, independently assembled
with its authoritative source closure. HTTP parsing, authentication, admission,
and response projection belong to REST. Policy, Core, MIP, Regression,
canonicalization, digests, and verification belong to their existing owners.
REST never invokes MCP, a shell, a PATH-selected program, the CLI, the private
Python/native SDK bridge, or a second evaluator. MCP never invokes REST.

Each admitted semantic operation gets a fresh `node:worker_threads` Worker,
fresh imported module instances, one `new MemoryOS()`, and request-owned SDK
objects. Nothing semantic is retained after the worker exits. The six mappings
are exact:

| Capability | Public SDK calls and owned products |
|---|---|
| Contract identities | `policyContractIdentities()`; compare the entire result to the pin before projecting it |
| Prepare Policy | `preparePolicy(bytes)`; `kind`, `version`, `toBytes()`, `documentDigest`, `semanticDigest` |
| Prepare Policy Set | `preparePolicySet(bytes)`; the same prepared-product accessors |
| Evaluate Policy or Policy Set | Prepare the selected kind; `importPackage(candidateBytes, {identifier: "memoryos-policy-evaluation-candidate"})`; `capturePolicyFactContext(investigation)`; `evaluatePolicy(prepared, context, {})` or `evaluatePolicySet(prepared, context, {})` |
| Verify Evaluation Identity | `verifyEvaluationIdentityArtifact(bytes, expectedEvaluationIdentityDigest)` |
| Verify Policy Outcome | `verifyPolicyEvaluationOutcomeArtifact(bytes, {expectedEvaluationIdentityDigest, expectedOutcomeDigest})` |

Evaluation uses `evaluationIdentityBytes()` and `canonicalOutcomeBytes()` and
their SDK-provided digests. Before publication, verify both products using the
two public verification operations. These checks do not recreate either
product. Context, investigation, prepared artifact, and result have the same
worker owner; no checkpoint, context token, or handle crosses requests.

No Regression source, report, baseline, or authority is supplied by REST.
`capturePolicyFactContext` therefore retains the released unavailable-source
behavior. A rule requiring unavailable Regression facts may complete as
`COULD_NOT_EVALUATE`. Inline candidate MIP content, serialized outcomes, or
an authenticated caller cannot manufacture Regression authority. Artifact
verification remains `inspectionOnly` / `serializedArtifact`, not restoration
of live authority or proof that a policy decision is favorable.

### 2.1 Exact independently assembled closure

The immutable source inventory is
`repositories/memoryos-mcp/runtime/runtime-closure-manifest.json` at authority
commit `d15b578dd757e928273d4548348b085e58ed5df5`: **5,566 bytes**, SHA-256
`0b910e64f40b562d62c9a053c98833b439f78abd195d9604386e74e0d20d961d`.
Its 25 rows, including every `source`, `path`, `byteLength`, and `sha256`, are
incorporated here by immutable reference as the exact source selection. This
is a build-time inventory reference, not an MCP runtime dependency. All 25
rows were checked against their authoritative workspace source bytes.

Phase 1 copies bytes from each row's `repositories/cca-studio/...` **source**
at that revision into the new package's `runtime/<path>`. It must not import,
execute, depend on, or copy code from the MCP adapter. The selected paths are:

```text
authoritative/package.json
authoritative/web/data/studio-snapshot.js
authoritative/web/js/cognitive-comparative-reconstruction.js
authoritative/web/js/cognitive-comparative-replay.js
authoritative/web/js/cognitive-evolution-controller.js
authoritative/web/js/cognitive-evolution.js
authoritative/web/js/cognitive-investigation-explorer.js
authoritative/web/js/cognitive-regression.js
authoritative/web/js/cognitive-replay.js
authoritative/web/js/cognitive-trace.js
authoritative/web/js/deterministic-sequence-alignment.js
authoritative/web/js/investigation-core.js
authoritative/web/js/investigation-policy-contracts.js
authoritative/web/js/investigation-policy-engine.js
authoritative/web/js/investigation-policy-integration.js
authoritative/web/js/investigation-policy.js
authoritative/web/js/memory-investigation-package.js
authoritative/web/js/memoryos-sdk.js
authoritative/web/js/mip-canonical.js
authoritative/web/js/observation-timeline.js
authoritative/web/js/policy-canonical.js
authoritative/web/js/policy-fact-context.js
authoritative/web/js/regression-policy-fact-source.js
authoritative/web/js/semantic-world.js
authoritative/web/js/studio-model.js
```

The resulting `runtime/runtime-closure-manifest.json` has the same closed row
schema and sorted paths, but kind `MemoryOSRESTRuntimeClosureManifest`, version
`1.0.0`. Its new digest is derived from actual bytes in I1, not invented here.
No additional semantic file or package resolution fallback is permitted.

The exact contract identity pin is the 933-byte file
`repositories/memoryos-mcp/contracts/policy-contract-identities-1.0.0.json`
at the same immutable revision, SHA-256
`d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65`.
Independently verify it through the public SDK and publish the identical bytes
as `contracts/policy-contract-identities-1.0.0.json`. This preserves its evaluator,
rule registry, fact model, deterministic source registry, outcome contract, and
resource-profile identities without redefining them.

### 2.2 Integrity, ownership, and threat boundary

Before listening, the parent verifies the exact installed distribution file
set, all lengths/digests, the source-closure manifest, contract pin, schemas,
limits, and runtime version. Each worker repeats closure/pin verification
before import and after delegation; the parent rechecks the distribution
before publication. Reject missing, extra executable, changed, substituted,
symlink/reparse, hardlinked (`nlink != 1`), out-of-root, and case-colliding
members. Resolve imports from the verified package root, never cwd, HOME,
NODE_PATH, a workspace sibling, or a global package. No runtime downloads,
plugin discovery, dynamic client-selected imports, `eval`, or source compilation.

The operator supplies a trusted, immutable package and a trusted exact Node
executable. Launch with an absolute executable and entry path, no loader or
preload flags, no NODE_OPTIONS/NODE_PATH, and sanitized environment. The entry
point refuses unsupported `execArgv` and injection variables. This refusal
cannot undo code preloaded before the entry point; a hostile launcher or actor
able to rewrite the executable/verifier is outside the claim. Hash verification
is integrity under that trust root, not code signing or protection against a
hostile administrator. File races are tested and fail closed when detected;
operator immutability is required to prevent undetectable swap-and-restore races.

Workers receive only operation ID, validated input bytes/strings, limits, and a
private generation token. Use `env: {}`, `execArgv: []`, captured stdout/stderr,
and no inherited credentials, socket, descriptor, SDK handle, or shared memory.
Any worker stdout/stderr data is an internal failure; do not log its content.
Only a bounded schema-checked result message from the owning generation is
accepted. Terminate and reap the worker before declaring a result publishable.

## 3. Closed API and schemas

The wire namespace is `/v1`, API identifier `memoryos.rest.v1`, API version
`1.0.0`, MemoryOS milestone `1.3/MO-1305`. Initial package `0.1.0` is independent
of API v1. Unknown paths, including `/v2/...`, return `MO1305_NOT_FOUND`;
there is no version negotiation, redirect, alias, trailing-slash normalization,
implicit HEAD/OPTIONS, static file serving, or generic `/run`/`/invoke` route.

| Method | Exact path | operationId | Input | Successful output |
|---|---|---|---|---|
| GET | `/v1/contract-identities` | `getContractIdentities` | No body | Identities |
| POST | `/v1/policies/prepare` | `preparePolicy` | PolicyInput | PreparedPolicy |
| POST | `/v1/policy-sets/prepare` | `preparePolicySet` | PolicySetInput | PreparedPolicySet |
| POST | `/v1/evaluations` | `evaluatePolicy` | EvaluationInput | Evaluation |
| POST | `/v1/evaluation-identities/verify` | `verifyEvaluationIdentity` | IdentityInput | VerifiedIdentity |
| POST | `/v1/policy-outcomes/verify` | `verifyPolicyOutcome` | OutcomeInput | VerifiedOutcome |
| GET | `/v1/health` | `getHealth` | No body | Health |
| GET | `/v1/readiness` | `getReadiness` | No body | Readiness |
| GET | `/v1/version` | `getVersion` | No body | Version |

These are exactly six semantic and three operational endpoints. Operational
endpoints execute in the parent and never call the SDK. All nine require the
same authentication and transport checks. No OpenAPI-serving endpoint exists.

### 3.1 Schema notation and inputs

Every object below is closed; every listed field is required unless explicitly
marked optional. No coercion, defaults, unknown-member stripping, or extension
members. `Digest` is exactly `^sha256:[0-9a-f]{64}$` (71 ASCII characters).
`Decision` is exactly `PASS | FAIL | COULD_NOT_EVALUATE`.
`B64(N)` means nonempty canonical standard padded Base64 of 1 through N bytes:
ASCII alphabet `A–Z a–z 0–9 + /`, required `=` padding where needed, no
whitespace or URL alphabet, valid padding bits, and exact equality to
decode-then-reencode. Check encoded length before allocation. The maximum
encoded length is `4 * ceil(N / 3)`.

| Input | Exact fields and types |
|---|---|
| PolicyInput | `policyBase64: B64(2048)` |
| PolicySetInput | `policySetBase64: B64(4096)` |
| EvaluationInput | `artifactKind: "policy" \| "policySet"`; `artifactBase64: B64(2048)` for policy, `B64(4096)` for policySet; `candidateMipBase64: B64(524288)` |
| IdentityInput | `evaluationIdentityBase64: B64(4060)`; `expectedEvaluationIdentityDigest: Digest` |
| OutcomeInput | `outcomeBase64: B64(4060)`; `expectedEvaluationIdentityDigest: Digest`; `expectedOutcomeDigest: Digest` |

A syntactically canonical Base64 value over its decoded-byte bound is
INPUT_LIMIT/413; malformed alphabet/padding/reencoding is REQUEST_SCHEMA/400.
GET accepts absent Content-Length or exactly `0`, and zero body bytes. POST
requires a positive Content-Length and the appropriate JSON object. These
transport input bounds select the same bounded capabilities as MO-1304;
they do not raise the authoritative Policy/MIP Resource Profile.

### 3.2 Successful response projections

All successes have HTTP **200**, including every completed evaluation decision.
There is no 201/202 job, 204 empty success, or decision-to-HTTP-failure mapping.
The following fields comprise the entire response body; there is no additional
`data`, timestamp, request ID, duration, or human-message wrapper.

| Output | Exact fields and types |
|---|---|
| Identities | `status: "ok"`; `identities`: exact closed object from the pinned identity artifact |
| PreparedPolicy | `status: "ok"`; `artifactKind: "MemoryOSInvestigationPolicy"`; `artifactVersion: "1.0.0"`; `canonicalArtifactBase64: B64(1024)`; `documentDigest: Digest`; `semanticDigest: Digest` |
| PreparedPolicySet | Same as PreparedPolicy, with `artifactKind: "MemoryOSInvestigationPolicySet"` and `canonicalArtifactBase64: B64(2048)` |
| Evaluation | `status: "ok"`; `artifactKind: "MemoryOSInvestigationPolicy" \| "MemoryOSInvestigationPolicySet"`; `semanticDigest: Digest`; `decision: Decision`; `evaluationIdentityBase64: B64(4060)`; `evaluationIdentityDigest: Digest`; `outcomeBase64: B64(4060)`; `outcomeDigest: Digest` |
| VerifiedIdentity | `status: "ok"`; `artifactKind: "MemoryOSPolicyEvaluationIdentity"`; `artifactVersion: "1.0.0"`; `verified: true`; `authority: "inspectionOnly"`; `verificationScope: "serializedArtifact"`; `evaluationIdentityDigest: Digest` |
| VerifiedOutcome | Same verification fields with `artifactKind: "MemoryOSPolicyEvaluationOutcome"`, plus `decision: Decision` and `outcomeDigest: Digest` |
| Health | `status: "ok"`; `live: true` |
| Readiness | `status: "ok"`; `ready: true` |
| Version | `status: "ok"`; `api: "memoryos.rest.v1"`; `apiVersion: "1.0.0"`; `package: "memoryos-rest"`; `packageVersion: "0.1.0"`; `sdkVersion: "1.1.0"`; `contract: "memoryos.rest.contract-freeze-1"`; `contractVersion: "1.0.0"`; `policyContractIdentitiesSha256: "d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65"` |

Health means the process can answer through this bounded HTTP path. It says
nothing about a semantic result. Readiness means startup integrity passed,
the service is not draining/poisoned, and the semantic slot is free at the
instant of inspection; it reserves no slot. Busy readiness is 503/BUSY;
draining readiness is 503/UNAVAILABLE. Integrity failure poisons the service,
suppresses semantic publication, and initiates shutdown; health may still
answer until listeners close. Version has no paths, hostname, OS, executable
location, address, secret, wall clock, or build-machine data.

### 3.3 Encoding and deterministic projection

Requests use UTF-8 JSON: Content-Type is case-insensitive `application/json`
with either no parameter or exactly one `charset=utf-8` parameter (token or
quoted token, ASCII case-insensitive, optional surrounding SP). Other
parameters/media types are 415. Request bytes may reorder keys and use JSON
whitespace/escapes within the wire limits; canonical JSON is not required.
Reject BOM, malformed UTF-8, duplicate **decoded** keys, lone UTF-16 surrogates,
trailing non-whitespace, and non-JSON syntax. Do not normalize Unicode. Numeric
tokens are limited to `0` or `-?[1-9][0-9]*` representable as a safe integer;
reject `-0`, decimal/exponent syntax, NaN, and infinity. Current semantic
request fields permit no numbers regardless of lexical validity.

Use a small first-party bounded transport JSON scanner/parser: fatal UTF-8
decode, explicit depth/member/node/string accounting, null-prototype objects,
duplicate checks before assignment, well-formed decoded strings. JSON.parse
alone, a reviver, or JSON.parse followed by duplicate detection is insufficient.
Prototype-like keys have no special behavior and fail the closed schema.
Artifact bytes inside Base64 are opaque to this parser; the SDK validates them.

Responses and declarative JSON artifacts use transport serializer **J**:
recursively sort object keys by JavaScript UTF-16 code-unit comparison, retain
array order, JSON.stringify escaping/scalars, compact separators, UTF-8, no
BOM or terminal newline. Only schema-permitted finite safe integers and
well-formed strings can reach J. This is a transport/document serialization,
never a replacement for MemoryOS canonicalization. Normative artifact bytes
are copied directly into Base64 from SDK byte methods. Never parse and
reserialize them; never create REST-specific semantic digests. HTTP headers,
request IDs, rate state, TLS randomness, and scheduling do not enter products.

## 4. Closed errors and response headers

Every application error body is J of
`{status:"error", error:{code:GatewayCode, semantic:SemanticErrorOrNull}}`.
No message, stack, cause, input excerpt, path, or diagnostic array is included.
Only `MO1305_SEMANTIC_REJECTED` has non-null `semantic`; all other codes use
null. The gateway catalog and status mappings are closed:

| Code (all have prefix `MO1305_`) | HTTP | Meaning |
|---|---|---|
| REQUEST_SYNTAX | 400 | Invalid JSON lexical form or malformed HTTP framing/header/target syntax |
| REQUEST_SCHEMA | 400 | Valid JSON with wrong type/field/value/Base64/digest, forbidden GET body, invalid allowed-header value |
| UNSUPPORTED_MEDIA | 415 | Unsupported Content-Type or Content-Encoding |
| UNAUTHENTICATED | 401 | Missing, malformed, or incorrect bearer credential; identical body for all three |
| FORBIDDEN | 403 | Validly authenticated request violates Host, proxy, cookie, Origin, or forbidden-header policy |
| NOT_FOUND | 404 | No exact path, including unsupported API namespace |
| METHOD_NOT_ALLOWED | 405 | Exact known path, wrong otherwise well-formed method |
| NOT_ACCEPTABLE | 406 | Unsupported Accept or Accept-Encoding value |
| REQUEST_TIMEOUT | 408 | Header/body absolute deadline or premature EOF while a response remains writable |
| LENGTH_REQUIRED | 411 | POST lacks Content-Length |
| INPUT_LIMIT | 413 | Body, decoded input, or JSON structural size bound exceeded |
| TARGET_LIMIT | 414 | Target exceeds target-byte bound |
| HEADER_LIMIT | 431 | Header bytes, header count, or request-line bound exceeded |
| RATE_LIMIT | 429 | Global application request token unavailable |
| BUSY | 503 | Request/write admission full or semantic slot occupied |
| OPERATION_TIMEOUT | 504 | Semantic deadline expires before publication |
| CLIENT_CANCELLED | No HTTP response | Disconnect/abort prevents a response; internal lifecycle/log code only, never emit nonstandard 499 |
| SEMANTIC_REJECTED | 422 | Recognized SDK preparation/operational/MIP error, projected below |
| OUTPUT_LIMIT | 500 | SDK/worker result or serialized response exceeds frozen output bound |
| RUNTIME_INTEGRITY | 503 | Closure, distribution, runtime, or contract identity verification fails |
| INTERNAL_FAILURE | 500 | Unexpected exception, invalid worker message/product, or invariant failure |
| UNAVAILABLE | 503 | Startup incomplete, draining, termination failure, or poisoned admission |
| HTTP_VERSION | 505 | Well-formed unsupported HTTP version |

`SemanticError` is exactly `{origin:"memoryos", code, phase, artifactKind,
limitIdentifier, failureClass, verificationFailure}`. Recognize only actual
instances of SDK `MemoryOSPolicyPreparationError`, SDK
`MemoryOSPolicyOperationalError`, and authoritative
`MemoryInvestigationPackageError`. `code` is 1–128 ASCII characters matching
`^[A-Z][A-Z0-9_]*$`; bad codes become INTERNAL_FAILURE. `phase`, `artifactKind`,
and `limitIdentifier` are SDK strings of at most 128 code units or null (invalid
or longer values project to null). `failureClass` is `preparation`,
`operational`, or null; `verificationFailure` is boolean or null. Unsupported
failureClass is an internal failure, never arbitrary string passthrough.
For MIP errors, select `error.code`, otherwise first diagnostic code, otherwise
`MIP_VALIDATION_FAILED`; phase is `evaluationInput`, artifactKind is
`MemoryInvestigationPackage`, failureClass is `preparation`. No human-string
parsing. Other thrown objects are INTERNAL_FAILURE. These are the released
semantic error identities independently projected by this adapter.

For multiple violations, first enforce socket/capacity/deadline and raw framing
safety, then header byte/count limits and framing agreement, request-rate
admission, authentication, Host/forbidden headers, path/method, allowed-header
values/media, body bounds/completion, JSON syntax, schema/Base64, semantic-slot
admission, integrity, SDK execution, output verification, and publication.
Within a synchronous check, use this order; temporal disconnect/deadline events
win only before publication. No promise that invalid unauthenticated bodies
receive a detailed body error. A rejected request is never drained unboundedly.

Each HTTP response has exactly the required Content-Type
`application/json; charset=utf-8`, decimal Content-Length for its complete
body, `Connection: close`, `Cache-Control: no-store`, and
`X-Content-Type-Options: nosniff`. Suppress Node's Date and Server headers.
401 adds `WWW-Authenticate: Bearer realm="memoryos-rest"`; 405 adds the one
allowed method in `Allow`; 429 and BUSY add `Retry-After: 1` (seconds).
Echo a syntactically valid accepted `X-Request-ID` only after authentication.
No cookies, CORS, redirects, ETag, compression, digest recomputation header,
or arbitrary reflected headers. Header order has no semantic significance.
HEAD errors retain the appropriate status/headers and Content-Length of the
error representation but send zero body bytes, as required by HTTP.

TLS failure, pre-handshake admission rejection, an unreadable malformed
connection, reset, or expired write deadline closes the socket without an HTTP
body. Before Node owns the socket, framing failures use a fixed bounded HTTP/1.1
error response with the same schema/headers when safely writable. Never echo
Node parser `rawPacket` or exception text. If headers/body have started, destroy
the socket; never append a second error response or claim atomic network delivery.

## 5. Native TLS, credentials, and deployment authority

Select **B: loopback plus explicitly authenticated remote single-host service**.
Native TLS is the sole TLS model, including loopback. There is no plaintext
listener and no trusted reverse-proxy mode. This meets the non-local API-client
objective without delegating authentication to ambient proxy headers.

The only service invocation is `memoryos-rest --config <absolute-local-path>`;
`--help` and `--version` are non-listening fixed informational invocations.
Unknown/duplicate options or missing config fail startup. The config is strict
UTF-8 JSON with the section 3 parser, at most 8 KiB, and exactly these fields:

| Field | Required/default | Value |
|---|---|---|
| `version` | Required | `"1.0.0"` |
| `mode` | Optional, `"local"` | `"local"` or `"remote"` |
| `bindAddress` | Optional only in local mode, `"127.0.0.1"` | Canonical dotted-decimal IPv4 literal of a local interface |
| `port` | Optional, `13050` | Safe integer 1024–65535; no ephemeral production port |
| `tokenFile` | Required | Absolute local regular file |
| `certificateFile` | Required | Absolute local regular PEM chain file |
| `privateKeyFile` | Required | Absolute local regular PEM private-key file |

Local mode accepts only 127.0.0.1. Remote mode requires an explicit bindAddress
on a local non-loopback IPv4 interface in exactly one RFC 1918 range: 10.0.0.0/8,
172.16.0.0/12, or 192.168.0.0/16. Check membership against the actual OS interface
list; reject its subnet network/broadcast addresses and /31 or /32 interfaces.
Public IPv4, 0.0.0.0, multicast, link-local, abbreviated/octal literals, DNS
names, and IPv6 are unsupported. This is an explicitly private-network remote
mode; clients may reach it through operator routing without forwarding headers.
Remote support is a single operator-controlled host, not a multi-tenant or
managed Internet-service certification. No auto-detection of remote intent,
additional listener, local fallback after remote failure, or hot reconfiguration.
Bind exactly once after all security prerequisites pass; bind failure exits.
The operator controls firewall exposure and OS account isolation.

Native TLS permits only TLS 1.3, cipher suites TLS_AES_256_GCM_SHA384 and
TLS_AES_128_GCM_SHA256, and HTTP/1.1. Advertise ALPN `http/1.1`; absent ALPN is
accepted as HTTP/1.1, a negotiated other value is refused. No SNI-based routing,
client-certificate authentication, early data, HTTP/2, HTTP/3, or QUIC listener.
Use one configured certificate chain (1–4 PEM certificates, total at most
16 KiB) and matching unencrypted PKCS#8 ECDSA P-256 key (at most 4 KiB).
Check parseability, key match, validity dates, and leaf IP SAN matching the
bind address before listening. Clients verify the certificate chain and IP
identity using an explicitly trusted CA; certification must not use `-k` or
disable TLS verification. Test certificates may be generated for the harness;
the product does not issue, renew, fetch, or automatically trust certificates.
Use no application session cache or session store; TLS 1.3 stateless tickets
may be issued by the pinned TLS runtime, never carrying MemoryOS state or
replacing HTTP authentication. Certificates and secrets rotate by restart.

The sole HTTP credential is `Authorization: Bearer <token>` with exactly one
ASCII SP, case-sensitive `Bearer`, and a token of exactly 64 lowercase hex
characters, generated out of band from 32 cryptographically random bytes.
The tokenFile contains those 64 ASCII bytes exactly, without BOM/newline.
Syntax-check first, decode to 32-byte buffers, compare with
`crypto.timingSafeEqual`. Never compare token strings with early exit. All
endpoints, including operational ones, require it. No query, cookie, Basic,
OAuth, session, client certificate, proxy assertion, or environment credential.
Possession grants the entire closed catalog, with no per-operation ACL or roles.
It grants none of the excluded acquisition or execution authorities.

Config, certificate, and credential paths are trusted **operator startup**
inputs, never HTTP inputs. No URLs, UNC/network shares, device paths, symlinks,
reparse points, or nonregular files. Read each once through checked handles,
enforce size/identity before use, close handles, and retain secrets only in the
parent's bounded memory. Require owner-only access to token/key/config:
POSIX owner is the service account and no group/other permission; on Windows,
ACL access is limited to the service account, SYSTEM, and Administrators.
The trusted launcher verifies platform ACLs; the package checks file type,
links, size, and stable identity. The installed-service harness tests that a
failed launcher ACL check prevents process launch. Operator-readable public
certificates need not be secret. Do not persist request content or secrets.

Direct browser clients and official REST client SDKs are **excluded** from v1.
Reject Origin and Cookie headers after authentication, provide no CORS headers,
and no preflight support (OPTIONS on a known route is 405). There is no CSRF
session contract. Browser restrictions also apply on loopback. Generic Node
fetch and curl clients are required certification clients, not product SDKs.

## 6. HTTP/1.1 boundary and smuggling defenses

Native TLS terminates in `node:tls`; decrypted request bytes pass a bounded
raw header gate before the strict `node:http` HTTP/1.1 parser. This extra gate
is necessary because a post-parse rawHeaders check alone cannot prove rejection
of every original obs-fold/whitespace form. It performs lexical/framing checks,
not application routing or semantic interpretation.

Pause the TLSSocket while installing the gate. Read through the first
CRLF-CRLF under the header deadline/byte cap; retain at most that header and
one bounded read chunk. Validate raw bytes, pause, detach the gate, unshift
the unchanged retained bytes, and hand the same socket to an unbound
`http.Server` through its connection event, then resume. Use public stream
and server APIs, `insecureHTTPParser: false`, explicit maxHeaderSize,
highWaterMark, timeouts, and the request-count guard. No private Node imports,
alternative HTTP parser, byte rewriting, reserializing request headers, or
second listening port. Phase 1 must prove this handoff across fragmented and
coalesced TLS records; inability to enforce it blocks B1, requiring a contract
correction rather than silently dropping the gate.

Accept one request per TCP/TLS connection; always close after its response.
Disable keep-alive reuse, pipelined operation dispatch, upgrades, CONNECT,
WebSockets, SSE, and chunked transfer. Node's parser must independently agree
with the gate on method, target, Host, content length, and header count before
dispatch. Any disagreement is REQUEST_SYNTAX, with zero SDK calls.

| Wire condition | Frozen behavior |
|---|---|
| Request line | Exactly uppercase ASCII method token, SP, origin-form target, SP, `HTTP/1.1`, CRLF; no tabs or extra spaces; another syntactically valid HTTP version is 505 |
| Target | At most 256 ASCII bytes; path only; reject query, fragment, percent escape, backslash, dot segment, double slash, absolute/authority/asterisk form; unknown otherwise-valid path is 404 |
| Header grammar | ASCII token field name immediately followed by colon; value permits visible ASCII and SP, optional SP trim at edges; no HTAB, bare LF/CR, NUL, other control, non-ASCII, or obs-fold |
| Duplicates | Reject every case-insensitive duplicate header, including equal/conflicting/comma-combined Content-Length and duplicate Authorization/Host |
| Content-Length | Exactly `0` or nonzero decimal with no sign/leading zero, bounded before numeric conversion; positive required for POST; GET absent or zero |
| Transfer-Encoding | Always reject, including CL+TE, chunked, unknown coding, chunk extensions, and trailers; no chunk decoder is an accepted product path |
| Expect/Upgrade/CONNECT | No 100-continue or upgrade; reject Expect/Upgrade headers as REQUEST_SYNTAX before body admission; CONNECT request form is invalid, never a tunnel |
| EOF | Fewer bytes than declared: 408 if a response can be sent, otherwise CLIENT_CANCELLED and close; no worker dispatch |
| Excess bytes | Bytes beyond declared body or a second request observed before publication cancel the first with 400 if writable; after publication close without a second response; no second operation ever dispatches |
| Parser failure | Fixed 400, or 431 for header overflow, if safely writable; otherwise destroy; no raw exception/packet disclosure |

Once a response is published, later-arriving bytes cannot retroactively revoke
it. This is a temporal boundary, not a promise to foresee future TCP traffic.
The server must also reject a second parser request event on that connection,
including when the first request was rejected. Set maxRequestsPerSocket to 1
and test the independent connection guard rather than assuming that setting
alone proves the no-second-dispatch property.

Allowed request headers are exactly the following (names case-insensitive):

| Header | Allowed value |
|---|---|
| Host | Required, exactly canonical configured `bindAddress:port`, including the port; no aliases, userinfo, whitespace inside, DNS name, list, or omitted port |
| Authorization | Section 5 syntax |
| Content-Length / Content-Type | Sections 3 and 6; Content-Type may be absent on bodyless GET or, if supplied, the same JSON media type |
| Accept | Absent, `application/json`, or `*/*` only, case-insensitive media token |
| Accept-Encoding | Absent or `identity` only, case-insensitive; all other values 406; clients explicitly request identity |
| Content-Encoding | Absent or `identity` only, case-insensitive; all other values 415 |
| Connection | Absent, `close`, or `keep-alive`; response always closes |
| User-Agent | Optional visible ASCII/SP, at most 256 bytes, discarded |
| Accept-Language | Absent or `*`, discarded (generic fetch compatibility) |
| Sec-Fetch-Mode | Absent or `cors`, discarded (Node fetch compatibility, never authorization) |
| X-Request-ID | Optional `^[A-Za-z0-9_-]{1,64}$` |

Unsupported headers are FORBIDDEN, except framing headers handled earlier as
REQUEST_SYNTAX. In particular reject Forwarded, Via, all X-Forwarded-* and
proxy-auth headers, Origin, Cookie, Idempotency-Key, and method-override headers.
There is no trusted-proxy list/config. Ignore no forwarded identity, address,
scheme, or authorization assertion because none is accepted. Never route on
DNS, user-supplied URLs, normalized paths, or proxy metadata.

No request decompression or response compression. No body streaming API.
Buffer the entire bounded body, validate it, then dispatch; buffer and validate
the entire response before any response header is written. Ordinary TCP/TLS
segmentation is not semantic streaming. Content-Length is mandatory in every
response, and Transfer-Encoding is absent.

## 7. Admission, cancellation, and network/filesystem isolation

Semantic requests are stateless. Operational state consists only of two global
token buckets, bounded socket/request/write registries, one semantic owner,
monotonic deadlines/generations, integrity/readiness flags, and bounded logging.
No session, durable cache, investigation store, deduplication cache, replay
ledger, background semantic job, or cross-request result/authority retention.

Select **one active semantic operation and zero queued semantic operations**.
This is an independent REST design choice: one synchronous SDK owner bounds
worst-case CPU and memory while HTTP control traffic remains responsive in the
parent. V1 makes no parallel-throughput promise. Phase 1 measures the selected
one-worker design under four request slots and 32 connections; it does not
silently raise concurrency to chase throughput or merely inherit MCP scheduling.

Four request slots cover admitted body buffering, execution, and response
writes; at most four pending writes. Up to 32 sockets include incomplete TLS,
headers, admitted requests, rejected responses, and draining sockets. Early
rejection uses at most one fixed error buffer per socket and shares the same
four-write cap; if no write slot is available, close without an HTTP response.
A free request slot can answer operational requests while the semantic slot
is occupied. When global admission is full, operational endpoints may receive
BUSY too; there is no secret bypass or unbounded health queue.

A semantic owner is `(socket, request, internalGeneration)` independent of any
client ID. The monotonically increasing safe-integer generation is never sent
to clients; exhaustion triggers orderly UNAVAILABLE shutdown before overflow.
Reserve only after full input validation; occupied slot returns 503/BUSY with
no worker creation. Slot lifecycle is reserved → running → reaping → ready →
published/aborted → released. The slot stays occupied through worker exit and
response finish/destroy. Every late message is checked against the live owner;
late/duplicate/cross-generation results never acquire another owner.

Publication is the first irreversible write of the already verified complete
response headers/body to the socket, normally the single response.end(body)
call. Immediately before that call, synchronously check owner, socket state,
deadline, integrity, and cancellation. Prior disconnect/abort/deadline cancels
ownership, suppresses the result, terminates and reaps the worker. A disconnect
after publication can truncate delivery but cannot change the completed result
or cause a substitute result. No network-level exactly-once delivery claim.
Write failure destroys the socket; a retry is a new operation.

Client request IDs are optional bounded correlation only: echo after valid
authentication, allow repetition, no uniqueness or persistence promise, never
pass to SDK or normative products. Logs may include the validated ID. There
are no idempotency keys or stored outcomes. Identical explicit semantic inputs
and pinned authority produce identical semantic products on independent runs.

HTTP input acquisition is inline Base64 only. No client string becomes a
filename, directory, URI, artifact-store key, environment lookup, executable,
import path, Regression source, or network destination. The parent reads only
operator config/secrets and the installed package, and writes only bounded
stderr operational records; it never writes semantic files. Workers read only
the verified package through adapter integrity checks. SDK inputs use bytes,
not SDK convenience APIs for filesystem acquisition.

No outbound networking or DNS is required for startup or semantic execution.
Bind by literal IP; no DNS lookup, telemetry, OCSP/CRL fetch, URL import, package
fetch, or update check. Only the parent owns inbound server sockets. A fixed
worker bootstrap disables global fetch/WebSocket and installs denial hooks for
outbound `node:net`, `node:tls`, `node:http`, `node:https`, `node:http2`,
`node:dgram`, and `node:dns` entry points (including promise variants), then
synchronizes builtin exports before importing the verified closure. Deny worker
child processes, extra workers, dynamic native addons, and filesystem writes.
Test each exposed entry point and statically audit the complete import graph.
These are defenses for a fixed trusted module closure, not a JavaScript or OS
sandbox: worker_threads share a process, and hooks do not confine hostile code
that replaces the runtime. Certification additionally runs semantic fixtures
under OS outbound denial where available and records the mechanism/coverage;
an unavailable OS mechanism is explicitly recorded, never reported as proven
process isolation. Missing mandatory bootstrap denial tests block release.

## 8. Resources, deadlines, and measurement gates

There are two kinds of bound: fixed contract/security bounds and measured
release limits. Every prototype starts with the absolute ceilings below;
there is never an unbounded measurement mode. A measured limit may only be
reduced from its ceiling by the frozen derivation. If a valid required fixture
cannot fit, or required headroom exceeds a ceiling, block the phase and obtain
a reviewed contract correction. Do not clamp a failed measurement to the
ceiling and call it PASS. Bytes mean octets; KiB = 1024, MiB = 1048576.

| Dimension | Absolute ceiling / fixed policy | Release derivation |
|---|---|---|
| Request body | 1,048,576 bytes per POST; 0 per GET | Per-operation measured limits, below |
| Response body | 65,536 bytes, including errors | Per-operation measured limits; shared error limit separately measured |
| Raw header block | 16,384 bytes including request line and CRLF-CRLF | Fixed; measure maximal valid and rejected forms, parser overhead |
| Request line / target | 512 / 256 bytes respectively (line includes CRLF) | Fixed |
| Header count | 32 | Fixed, count before parser; maxHeadersCount must not silently truncate |
| Individual value | 1024 bytes, except User-Agent 256 and request ID 64 | Fixed, with narrower grammar-specific values still applicable |
| Read/write high-water mark | 16,384 bytes | Fixed, set explicitly on owned streams |
| Header gate retained read overshoot | At most one additional chunk of 65,536 bytes | Reject larger chunk; retained gate data at most 81,920 bytes; not permission to accept a larger header |
| JSON container depth | 8, root container counts as 1 | Fixed |
| JSON object members | 32 total across the document | Fixed, including keys that later fail schema |
| JSON nodes | 128 total values (container/scalar each counts once) | Fixed; key strings counted in string/member budgets separately |
| Decoded JSON string | 699,052 UTF-16 code units; keys at most 128 | Fixed; additionally bounded by raw body bytes and schema |
| Total decoded JSON strings, including keys | 710,000 UTF-16 code units | Fixed |
| Decoded artifacts | Section 3 exact 2048 / 4096 / 524288 / 4060 byte bounds | Fixed selected capability envelope, checked before and after decode |
| Open TCP/TLS sockets | 32 | Fixed, counted from TCP accept through close |
| Request slots / pending writes | 4 / 4 | Fixed, rejected responses also consume a write slot |
| Active semantic workers / queue | 1 / 0 | Fixed |
| Worker old / young generation / stack | 512 / 128 / 8 MiB | Old/young measured downward; stack fixed |
| Worker external/ArrayBuffer memory | 128 MiB | Sampled watchdog ceiling; measured downward |
| Parent JS heap / external memory | 128 / 64 MiB | Sampled watchdog ceilings; measured downward |
| Aggregate process RSS | 1024 MiB | Sampled watchdog ceiling; measured downward |
| Log record / queued log bytes | 1024 / 16384 bytes | Fixed; one bounded dropped-record counter |

V8 Worker resourceLimits apply to V8 heap/stack, not total RSS or all external
allocations; the [pinned Node Worker documentation](https://raw.githubusercontent.com/nodejs/node/v24.21.0/doc/api/worker_threads.md)
states this distinction. Do not present watchdog numbers as instantaneous OS
memory isolation. Sample parent heap/external and aggregate RSS every 20 ms;
worker reports its heap/external/ArrayBuffer usage every 20 ms when scheduled
and at every delegation boundary. V8 limits and byte/count prechecks enforce
their respective hard bounds; sampling can miss transient native peaks or be
delayed by synchronous work. Record these limitations and OS process peak RSS
in evidence. Certification requires observed peaks plus headroom within the
ceilings; a watchdog breach poisons admission, cancels the worker, and shuts
down. No claim to contain an attacker-controlled executable or native allocator.

### 8.1 Frozen measurement procedure

Phase 1 owns measurement and `contracts/limits.json` before B1. It must run on
**both** certification targets using the same candidate source tree and fixture
hashes; if a target is unavailable, B1 waits. These are resource measurements,
not Phase 3 release certification. Phase 3 remeasures the frozen installed I2
archive on both targets as confirmation, without changing limits or archive.

For every endpoint and error projection, construct a bounded fixture catalog
from schema maxima and the released Policy/Policy Set/Resource Profile/MIP
boundaries. Include maximum-length strings and Base64, maximum supported
semantic structures, both evaluation kinds, all three decisions, all six rule
types, unavailable Regression, identity and outcome verification successes and
failures, malformed-but-bounded adversarial structures, and maximal permitted
headers. Use SDK oracles to distinguish schema-valid input from semantically
valid content. Include each endpoint's analytically largest **compact transport
encoding**; where SDK constraints make combined maxima impossible, document
the proof and the largest attainable semantic fixture. Padding/whitespace is
separately swept to the wire limit and does not enlarge artifact authority.

For each catalog case, each platform: **30 cold** samples (new installed server
process per sample) and **100 warm** samples (same server, fresh worker per
semantic call). Do not discard outliers. Record input/output lengths, each
encoded product length, header lengths/counts, parse/buffer/validation time,
integrity/import/SDK/reap time, total operation time, write/drain time, parent
heap/external deltas, worker heap/external maxima, process baseline and peak RSS.
Record OS peak counters as well as the 20 ms series maximum. Hash fixtures;
record complete sample arrays as bounded numeric records, never request secrets.

Run separate **60-second**, three-repetition scenarios on both platforms for
32 idle/handshaking/slow-header sockets, four maximum body buffers, one maximal
worker plus three operational requests, request/connection floods, slow body,
four blocked response writers, and cancellation/shutdown during each lifecycle
state. Compare baseline, peak, and post-cleanup memory/handle counts. Verify
that semantic count never exceeds one and no semantic queue appears. Measure
parser/gate retention separately from body buffer copies and parsed strings.

Derive limits from the maximum over all samples, scenarios, and both platforms:

1. POST body limit for operation o is `ceilKiB(1.25 * max(S[o], M[o]))`, where
   S is the analytical compact schema maximum and M the measured largest
   compact valid transport body. GET remains 0. Response limit is
   `ceilKiB(1.25 * max(Sout[o], Mout[o], E))`, including the largest applicable
   error E. Shared early-error limit is `ceilKiB(1.25 * E)`. Do not raise SDK
   byte bounds when adding transport headroom. All must fit absolute ceilings.
2. Worker old/young and external limits are each `ceilMiB(1.5 * observedPeak)`,
   with minimum old 32 MiB, young 8 MiB, external 8 MiB. V8 measurements include
   total committed space for the corresponding generation, not just live data.
   Parent heap/external and aggregate RSS use the same 1.5 multiplier on their
   observed absolute peaks, minimum 32/8/128 MiB respectively. Stack stays 8 MiB.
3. Semantic deadline is `ceil100ms(max(1000ms, 4 * observedMaximumOperationMs))`;
   it includes worker startup, pre/post integrity, SDK execution, and reaping.
   It must not exceed the absolute 30-second ceiling. Other deadlines below
   are fixed service policy, verified under adverse clients, not tuned from
   network latency to make a failing run pass.
4. `ceilKiB`, `ceilMiB`, and `ceil100ms` round upward to the next unit, retaining
   an exact multiple. No percentiles, average-based ceilings, silent exclusion
   of slow cases, host-specific runtime limits, or automatic adaptive increases.

For each length/count/depth/memory-budget boundary, test N−1/N/N+1 using
otherwise-valid framing and controlled fixtures where the dimension can vary.
For discrete semantic restrictions, distinguish a transport rejection from an
SDK semantic rejection. If no valid fixture can reach a syntactic upper bound,
record that fact and exercise the parser's boundary with schema-invalid input;
never label such a fixture semantically valid. For deadlines, fake monotonic
clock unit checks at N−1/N/N+1 ms accompany real socket tests before/after the
deadline; timer jitter does not redefine the deadline. Verify encoded size and
decoded size independently, including maximum JSON escape expansion rejection.

The measurement receipt binds fixture/catalog, source-tree digest, platform,
toolchain, samples, maxima, formulas, derived limits, and all boundary results.
Every measured field must be a finite positive integer in the limits artifact;
no null, placeholder, `measured:false`, or provisional value can pass B1 or
final certification. If I2 changes code that affects costs, rerun this same
procedure on both targets before B2; keep the same limits if they still pass.
A needed limit change requires a reviewed contract/limits revision and fresh
measurements, package, binding, and affected evidence before Phase 3.

### 8.2 Deadlines and shutdown

All deadlines are parent-owned absolute monotonic deadlines, not inactivity
timers extended by trickle traffic. At every progress event compare the actual
monotonic clock; setTimeout scheduling alone is not the authority.

| Deadline | Frozen ceiling/value and start | Failure/action |
|---|---|---|
| TLS handshake | 10,000 ms from TCP acceptance | Destroy; no HTTP response |
| Header read | 10,000 ms from secureConnection | 408 if safely writable, else close |
| Body read | 30,000 ms from complete accepted headers | 408; cancel any owner; no SDK dispatch on partial body |
| Semantic operation | Measured as above, at most 30,000 ms from semantic reservation | 504 before publication; reap worker |
| Response write/drain | 10,000 ms from first response write, including early errors | Destroy on expiry; published result cannot be replaced |
| Idle keep-alive | 0 supported reuse; response closes | No idle reusable socket state |
| Worker termination | 2,000 ms from first terminate request | Poison service and force process exit if exit not observed |
| Graceful shutdown | 15,000 ms from shutdown initiation | Stop admission/listener, cancel unpublished workers, let already-published writes drain within their deadline, then destroy all sockets and exit |

Shutdown triggers: SIGINT, SIGTERM where delivered by the platform, trusted
supervisor closing a dedicated stdin pipe, integrity failure, or fatal resource
failure. With inherited terminal stdin, EOF is not a required shutdown signal;
the certification supervisor supplies a pipe and closes it. Nonempty stdin is
invalid control input and causes bounded orderly shutdown; no command protocol
or HTTP admin endpoint exists. Exit code 0 for completed requested shutdown,
2 for invalid startup configuration/integrity, 1 for fatal runtime failure or
forced deadline exit. Close the listener before destroying tracked sockets.
There are no upgraded sockets to escape that registry. Test graceful and forced
shutdown on both platforms and prove the port can be rebound afterward.

### 8.3 Constant-space rate limits

Both modes use two independent global token buckets, each **20 tokens/second,
burst 20**, initially full: one at TCP accept before TLS work, one at the first
complete header block before authentication. Consume one token per connection
or request, including rejected credentials. No per-IP, token, ID, forwarded
address, or unbounded key map. Store two fixed records (balance and last
monotonic timestamp); refill lazily with integer nanosecond arithmetic, clamp
at burst, then debit if at least one full token. Use scaled integer token units
so fractional refill is deterministic; clamp elapsed refill at the time needed
to fill the bucket before multiplication. Backward-clock observations add zero.
Connection exhaustion destroys the socket before TLS; request exhaustion returns
429 with Retry-After 1 if a write slot is free, otherwise closes. On shutdown
discard both records; no cleanup timer or eviction policy is needed. These are
admission bounds, not fairness or denial-of-service protection against all LAN
attackers. Operator firewall controls remain outside product rate semantics.

## 9. Stack comparison and supply-chain freeze

The comparison was made against primary documentation and registry manifests
available on 2026-09-23. Candidate versions are review snapshots, not selected
dependencies. Registry immediate-dependency counts are not inflated into claims
about an unresolved transitive graph. Only the selected graph is frozen.

| Dimension | Built-in Node HTTP/TLS (selected) | Fastify 5.12.5 | Hono 4.13.8 + @hono/node-server 2.1.1 | Express 5.2.1 |
|---|---|---|---|---|
| Parser / smuggling | Direct llhttp plus explicit raw gate and rawHeaders agreement | Same underlying Node boundary; router/parser hooks add configuration to audit | Node adapter plus Fetch Request conversion adds another interpretation layer | Node plus routing/body middleware adds interpretation layers |
| Immediate production packages | 0 external direct, 0 external transitive | Fastify manifest has 15 direct dependencies before transitives | Two external direct packages; each current manifest has zero dependencies | Express manifest has 28 direct dependencies before transitives |
| Lifecycle / cancellation | Own socket/worker/generation state throughout | Hooks and framework close behavior need reconciliation | Adapter lifecycle and web Request abort behavior need reconciliation | Application must compose middleware and lifecycle explicitly |
| Backpressure / shutdown | Native streams and explicit socket registry; no upgraded sockets | Native streams remain; plugin/close ordering adds surface | Fetch-to-Node conversion and abort/stream bridging add surface | Native response streams; middleware behavior must be constrained |
| Limits | All raw bytes, parser counts, timeouts and admission explicitly set | bodyLimit and Node options still need raw gate and connection policy | Adapter/web-body consumption still needs early byte and socket gates | Body-parser limits do not replace raw framing and admission policy |
| Schemas | Closed JSON Schema subset plus narrow first-party evaluator | AJV/compiler and serializer dependencies offer more than v1 needs | User-selected validator otherwise required | No complete closed-contract validator in core; additional choice required |
| Determinism | One explicit serializer and error projection | Disable coercion/defaults/framework error/serializer variation | Avoid Fetch normalization changing frozen raw behavior | Override framework/middleware errors, defaults and response behavior |
| Supply chain / native | No npm closure, native Node/OpenSSL still in runtime trust root | Larger lock/notice/advisory closure; no direct package install hook | Smaller npm graph but an additional adapter and web abstraction | Larger middleware/dependency and advisory graph |
| Offline install | Empty dependency graph, straightforward offline archive | Requires entire resolved cache/closure, not just Fastify tarball | Requires both pinned packages/closures | Requires entire resolved middleware closure |
| Node support | Exact 24.21.0 frozen below | Must test exact selected Node; package manifest provides no engine pin | Hono declares >=16.9.0, adapter >=20 | Declares >=18; not an exact runtime guarantee |
| Advisories | Parser/TLS/runtime advisories directly reviewed below | September header-case/schema/routing advisories show validation surface requiring review | Adapter abort/URL/static-file advisories show bridging surface requiring review | Framework security guidance also requires dependency and Node review |
| Testability | Real TLS/socket parser tests with no mocking framework | Injection helpers useful for units, insufficient for this release gate | Web Request tests useful for units, insufficient for wire conformance | Middleware tests likewise cannot replace installed real-socket tests |

Sources: [Fastify server reference](https://fastify.dev/docs/latest/Reference/Server/),
[Hono Node adapter guide](https://hono.dev/docs/getting-started/nodejs),
[Express security updates](https://expressjs.com/en/advanced/security-updates/),
and exact registry manifests for
[Fastify](https://registry.npmjs.org/fastify/5.12.5),
[Hono](https://registry.npmjs.org/hono/4.13.8),
[@hono/node-server](https://registry.npmjs.org/@hono%2fnode-server/2.1.1),
[Express](https://registry.npmjs.org/express/5.2.1).
All four reviewed candidate packages declare MIT; none of those direct
manifests declares an install/postinstall hook or optional dependency. That
does not assert absence in rejected candidates' unresolved transitive graphs.
Fastify's header-name validation advisory was fixed in 5.12.2, and Hono's
aborted-WebSocket leak was fixed in adapter 2.0.10; this review does **not**
label their newer candidate versions affected by those specific advisories.
See [Fastify advisory](https://github.com/fastify/fastify/security/advisories/GHSA-9q9j-q6p8-xq58)
and [Hono adapter advisory](https://github.com/honojs/node-server/security/advisories/GHSA-9mqv-5hh9-4cgg).

Select builtin HTTP/TLS because the frozen API needs none of the extra routers,
middleware ecosystems, Fetch bridging, coercion, or schema compilation. A
first-party lexical gate and small closed validator are still security-sensitive
code; zero external packages does not remove the need to fuzz and test them.
Use ESM JavaScript, Node's test/assert/crypto/stream APIs, and repository Python
3.12+ engineering tools. Do not add TypeScript/build transpilers or test packages.

### 9.1 Exact runtime and complete selected closure

Pin **Node.js 24.21.0**, npm **11.19.0** for engineering/install tooling.
Reject runtime version drift at startup. Independent justification: this release
provides the required strict HTTP parser, native TLS, worker isolation/lifecycle,
stream controls, and supported x64 OS baseline; its parser/TLS components include
the reviewed fixes. Prior MCP certification is useful provenance, not REST
certification. The [Node 24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0)
and [pinned build platform policy](https://raw.githubusercontent.com/nodejs/node/v24.21.0/BUILDING.md)
support this selection. Windows 11 and Ubuntu 24.04 meet those runtime baselines.

The selected production npm closure is **0 direct + 0 transitive external
packages**, with **0 development npm dependencies**, 0 optional packages,
0 native addons, 0 platform downloaders, 0 install lifecycle hooks, and no
third-party schema library. There is one first-party distribution package and
the exact 25-file authoritative source closure; its nested package.json is
metadata/type-module context, not permission to run Studio scripts or install
Studio dependencies. External package licenses/integrities are therefore an
empty set. No dependency range, hidden bundled npm code, or vendored framework
may evade that zero-package contract.

Node is a separate native runtime supply chain, not counted as an npm package.
Pin executable SHA-256 values, independently checked during preparation and
again for every platform receipt:

| Platform | Node executable SHA-256 |
|---|---|
| Windows x64 | `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32` |
| Linux x64 | `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c` |

These byte identities are also present in released MO-1304 toolchain receipts;
reuse of the binaries does not reuse their certification claim. Verify each
official archive against signed Node release SHASUMS before trusting extraction,
and record archive name/length/hash, SHASUMS/signature identity, verification
result, executable identity, npm identity, and process.versions in I1 evidence.
The Windows archive is `node-v24.21.0-win-x64.zip`, SHA-256
`158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`.
For Linux use `node-v24.21.0-linux-x64.tar.xz`; its archive identity is captured
from the verified official bytes, with the executable hash above as an
additional fixed check. Archive measurement is not freedom to select a runtime.

Observed Windows process.versions: llhttp 9.4.3, OpenSSL 3.5.8, undici 7.29.1,
V8 13.6.233.17-node.53, libuv 1.52.1, nghttp2 1.70.0, c-ares 1.34.8,
acorn 8.18.0, ada 4.0.0, amaro 1.1.11, brotli 1.2.0, ICU 78.3/CLDR 48.0,
merve 1.2.2, nbytes 0.1.4, ncrypto 0.0.1, simdjson 4.6.7, simdutf 6.4.0,
sqlite 3.53.4, tz 2026c, Unicode 17.0, uvwasi 0.0.23,
zlib 1.3.2.1-motley-8002e91, zstd 1.5.7; Node module ABI 137, N-API 10.
Preserve the complete upstream [Node LICENSE](https://raw.githubusercontent.com/nodejs/node/v24.21.0/LICENSE)
and bundled-component notices in runtime provenance. Node's main MIT license
does not replace the distinct vendored-component licenses. Inspect the exact
official archive inventory on each platform; do not claim the above version
list alone is an exhaustive license inventory. The executable/archive identity
fixes that closure, and the Phase 1 notice/SBOM check must enumerate it.

### 9.2 Advisory disposition and installation policy

As of this review, no unresolved affected advisory was identified for the
selected **enabled** HTTP/1.1/TLS/worker paths in the reviewed primary feeds.
This is a dated review, not a perpetual zero-vulnerability claim. Node's
[July 2026 security release](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases)
includes the llhttp header-truncation/smuggling fix (CVE-2026-58044) in llhttp
9.4.3, which this runtime contains. The
[June security release](https://nodejs.org/en/blog/vulnerability/june-2026-security-releases)
and [OpenSSL 3.5 advisories](https://openssl-library.org/news/vulnerabilities-3.5/)
were also reviewed; the August OpenSSL advisories reviewed list affected 3.5
versions before 3.5.8, and the selected runtime contains 3.5.8.
HTTP/2, QUIC, outbound HTTP agents/fetch, DNS, mTLS, SQLite, compression, and
permission-model sandbox features are not enabled product surfaces. Their
presence in Node still belongs in the runtime inventory; exclusion reduces
reachability rather than deleting vulnerable bytes from an affected runtime.

At I1, B2, and Phase 3, review Node/OpenSSL primary advisories and the actual
empty npm lock graph again. Record advisory ID, affected range, fixed version,
selected version, call/import reachability, enabled configuration, disposition,
review date, and evidence URL. Any newly affected reachable component blocks
release pending a runtime/contract correction. Any accepted affected but
unreachable component needs an explicit scoped owner-approved disposition,
test proving exclusion, and receipt; there is no blanket severity waiver.
Do not silently auto-upgrade the exact runtime or fetch advisories at startup.

Use package-lock **lockfileVersion 3**, root package only, no dependencies,
devDependencies, optionalDependencies, peer dependencies, overrides, or bundled
dependencies. Pin `engines.node` to `24.21.0` and packageManager to
`npm@11.19.0`. No preinstall/install/postinstall/prepare lifecycle commands.
Run `npm ci --offline --ignore-scripts --no-audit --no-fund` against the checked
lockfile; do not use a global cache to hide missing declared inputs. Audit is
a separate online engineering review with recorded results, never an install
side effect or service network dependency. An empty npm audit does not audit
Node or first-party code.

Fresh installation from the distribution archive must succeed without registry
access, install hooks, source checkout, or package downloads. Verify exact file
set and hashes after install; reject an unexpected node_modules directory,
additional package, mutated manifest/lock/schema, native addon, loader, or
resolution outside the root. Build and install with scripts disabled. The
distribution verifier and trusted launcher are explicit operator steps, not
an automatic install hook. Retain the repository's existing first-party rights
notice: this task grants no new license and authorizes no public npm publication.

## 10. Package, schema authority, and OpenAPI

Future repository/package: `repositories/memoryos-rest`, npm name
`memoryos-rest`, version **0.1.0**, `private: true`, ESM `type: module`, bin
`memoryos-rest` → `bin/memoryos-rest.mjs`. API v1 freezes the HTTP contract;
0.1.0 identifies this first adapter distribution, following the precedent of
a separately versioned integration package without asserting SDK/API maturity.
No package is created during this freeze.

The shipped files are restricted to the following roles and roots. I1's exact
file manifest closes the individual first-party module list; adding files
outside these roots or a new executable role requires a contract correction.

| Role | Required package files |
|---|---|
| Metadata and entry | `package.json`, `package-lock.json`, `README.md`, `bin/memoryos-rest.mjs` |
| First-party implementation | `src/*.mjs` for config, raw gate, server, admission, parser, schemas, serializer, errors, integrity, worker bootstrap/delegation, lifecycle and logs; no undeclared feature modules |
| Semantic closure | Exact 25 `runtime/authoritative/...` files and `runtime/runtime-closure-manifest.json` |
| Contract inputs | `contracts/policy-contract-identities-1.0.0.json`, `contracts/api-contract.json`, `contracts/limits.json`, `contracts/openapi.json` |
| Verification | `scripts/verify-distribution.mjs`, `scripts/verify-contracts.mjs` |
| Provenance/notices | `distribution-manifest.json`, `dependency-manifest.json`, `sbom.spdx.json`, `NOTICES.md`, `LICENSE-NOTICE.md`, `notices/node-LICENSE.txt` |

Source tests, fixture corpora, measurement samples, builder/generator code,
platform harnesses, receipts, caches, secrets, Node binaries, and local frozen
archives stay outside the installed package. All runtime-relative imports must
close over the listed installed members or allowed builtins. No source-tree
fallback. The verification scripts themselves are manifest-bound; the external
trusted verifier/launcher checks that root of trust before executing them.

`distribution-manifest.json` is J of a closed object with `kind:
"MemoryOSRESTDistributionManifest"`, `version:"1.0.0"`, `package:"memoryos-rest"`,
`packageVersion:"0.1.0"`, and sorted `files:[{path,byteLength,sha256}]` for every
regular shipped file **except itself**. Paths are relative POSIX names, no
traversal, duplicate/case collision, or links. The manifest cannot hash itself;
its identity and the complete archive identity are bound by the later package
receipt. The dependency manifest records zero npm packages and the exact
first-party/runtime identities above. Include an SPDX **2.3** JSON SBOM for
the package, 25-file semantic source closure, and external Node runtime
relationship, including Node's vendored notice inventory. Use `NOASSERTION`
where repository rights are unresolved, not an invented MIT grant. SBOM
namespace is deterministic from the existing implementation parent revision,
executed source-tree digest, and package version; it contains no host path or
future implementation commit hash and cannot contain its own hash.

Build a deterministic npm-compatible `.tgz` with `package/` prefix using the
repository Python standard library: sorted POSIX regular members, uid/gid 0,
empty owner names, fixed mtime 0, modes 0755 for the bin and 0644 for other
members, gzip mtime 0 and empty filename, compression level 9, no links,
device files, platform extra headers, or host paths. Use POSIX ustar; fail on
an unrepresentable path rather than emitting arbitrary PAX metadata. Bound
archive at 16 MiB compressed / 64 MiB total uncompressed, at most 256 members,
individual member at most 8 MiB, path at most 240 bytes. These are package
safety ceilings, not semantic request limits. Build twice in distinct clean
directories with the pinned toolchain and compare archive bytes exactly.
Test `npm install --offline --ignore-scripts --no-audit --no-fund <archive>`
in an empty external project and direct extracted-package execution. The
published release reference binds the archive **identity**; retaining a local
build archive does not imply the binary archive is committed to Git.

### 10.1 Single schema authority

Select JSON Schema Draft **2020-12** for declarative request/response/config
schemas, with a narrow first-party evaluator. Zod is rejected because it would
add a second executable schema source/dependency; a general validator/compiler
is unnecessary for these finite shapes. `contracts/api-contract.json` is the
single machine-readable source for routes, operation IDs, header rules,
schemas, errors/statuses, and fixed protocol metadata. It transcribes this
document in I1, is hash-bound, and is consumed by runtime validation and the
OpenAPI generator. Human prose remains authority for lifecycle/security
requirements not expressible in JSON Schema; disagreement fails verification.

Permit exactly `$schema`, `$id`, `$defs`, local `$ref`, `title`, `description`,
`type`, `const`, `enum`, `properties`, `required`, `additionalProperties:false`,
`items`, `minItems`, `maxItems`, `minLength`, `maxLength`, `pattern`, `minimum`,
`maximum`, `oneOf`, and `anyOf`, plus the documented annotation
`x-memoryos-base64-max-bytes`. Type values are single names; unions use anyOf.
References resolve only within the same artifact, with acyclic definitions;
no network/filesystem ref resolution. Unsupported keywords fail startup/build.
Do not interpret `format`, custom executable expressions, defaults, coercion,
regexes supplied by clients, or schema plugins. Schema regexes are fixed,
anchored and linear-time for the limited ASCII languages here. Apply the exact
Base64 decode/reencode check in addition to the declarative length/pattern
annotation. JSON Schema minimum/maximum use exact safe-integer comparison; minLength and
maxLength count Unicode code points as required by that schema dialect. The
transport parser independently enforces its UTF-16 code-unit budgets, and the
SDK error projector independently applies its 128-code-unit rule. All current
request field values are ASCII after decoding. Validator errors normalize to
the closed gateway codes.

Publish **OpenAPI 3.1.1**, chosen as a fixed schema-compatible contract format;
the [OpenAPI 3.1.1 specification](https://spec.openapis.org/oas/v3.1.1.html)
defines its JSON Schema alignment. `contracts/openapi.json` is a **normative,
release-bound derived projection**, not a second editable authority. Generate
deterministically from api-contract.json and limits.json, serialize with J,
use exactly the nine operationIds in section 3, explicit bearer security on
all operations, every applicable response code/schema/header, and no external
references. Omit a deployment-specific servers URL; examples use loopback
and placeholder credentials, never a real token. Annotate raw framing and
transport constraints the OpenAPI vocabulary cannot express, including the
no-body-on-HEAD rule and disconnects without responses. Runtime responses are
validated against the same source schemas. A verifier regenerates OpenAPI and
requires byte equality, exact route/operation count, schema identity equality,
and complete error coverage; hand editing generated output fails the build.

Record byteLength/SHA-256 for api-contract.json, limits.json, OpenAPI, pin,
closure, lockfile, manifests, SBOM, and notices in later receipts. Those artifact
hashes identify transport/distribution data, never new semantic digests.
No generated OpenAPI or schema artifact is produced in this documentation task.

## 11. Observability and supported operation

Use stderr only for operational JSON Lines. Stdout is empty during service
operation. Each line is J of exactly `{event,code,operationId,requestId}` plus
one LF, at most 1024 bytes. `event` is `startup`, `requestCompleted`,
`requestRejected`, `requestCancelled`, `shutdown`, `fatal`, or `logsDropped`;
`code` is null on success or one closed gateway code; `operationId` is one of
the nine IDs or null; `requestId` is a validated authenticated ID or null.
For logsDropped all other fields are null; an internal saturating counter
coalesces loss into one record when space next becomes available. No timestamps
or durations are required in normal logs; measurement receipts carry them.

No body, Base64 product, diagnostic message, secret, Authorization value,
credential path, raw method/path/remote address, stack, or untrusted header is
logged. Convert recognized routes/methods to fixed operation IDs; unmatched
hostile strings become null. This prevents multiline/JSON/log injection without
trying to sanitize arbitrary hostile text. Bound the queued stderr bytes at
16 KiB, drop/coalesce records under backpressure, and never block the semantic
slot waiting for logging. Suppressed logs are not a success/failure authority.
Do not add external logging, metrics, tracing, analytics, or telemetry packages;
no metrics endpoint or exporter in v1.

Supported deployment modes: direct local process on 127.0.0.1 and explicit
single-host native-TLS remote service under a trusted operator supervisor.
Service-manager integration is documented invocation/secret/ACL/shutdown
configuration, not installation of a Windows service or systemd unit by the
package. No trusted TLS proxy, Kubernetes, serverless, multi-tenancy, cloud
control plane, distributed scheduling, autoscaling, or load-balancing contract.
Container packaging is **deferred and excluded from the v1 deliverables**:
no Dockerfile, OCI image, or container certification is required or implied.

Release-supported and release-certified target families are **Windows 11 x64**
and **Ubuntu 24.04 LTS x64**, each running the pinned native Node executable.
Do not pin Windows to a feature release or require another milestone's build.
Record actual edition, release/build/patch, kernel where applicable,
architecture, Node/npm/client executable versions and hashes in each receipt.
WSL/Linux does not certify native Windows; containers and compatibility layers
do not certify a different host family. macOS, ARM, other distributions, IPv6,
and other Node versions have no v1 support claim. Node's broader upstream
platform support is not automatically MemoryOS REST certification.

## 12. Conformance catalog, parity, and regressions

Phase 3 launches an **installed package in a new process** outside the checkout,
with absolute pinned Node and package paths, empty cwd and npm cache, clean
environment, fresh private test credentials, and real TCP/TLS clients. Verify
all installed bytes before and after execution. Real listener, parser, socket,
timeout, cancellation, and shutdown behavior is mandatory. In-process handlers,
mock sockets, framework injection, and unit tests are supplemental only.
No network access beyond the test LAN/loopback is needed. Test local mode and
remote mode on an actual non-loopback interface; remote success requires a
separate client host or VM, its route/address provenance, normal TLS trust, and
failure of direct insecure/missing-credential access. Reusing a loopback socket
with a forged Host does not prove remote mode.

Required independent success clients: Node **24.21.0 built-in fetch** (bundled
undici, no imported npm client), and **curl** with actual version, build/TLS
backend, and executable digest recorded. Require TLS 1.3 and `--http1.1` for
curl; fetch negotiates the server's sole HTTP/1.1 protocol. Both explicitly set
`Accept-Encoding: identity`, valid Host via the IP URL, JSON media type, bearer
header, and bounded correlation ID. Configure the trusted test CA in the
client launcher, not the gateway environment. fetch may add User-Agent,
Accept-Language `*`, and Sec-Fetch-Mode `cors`, which are explicitly permitted.
Record request header captures with credentials replaced by a fixed placeholder;
never put actual tokens in receipts, process command lines, logs, or fixtures.
Use curl config on private stdin/file for secrets. Each client exercises all
nine endpoints and all three evaluation decisions; client errors must not mask
HTTP error responses. A separate raw TLS byte client supplies malformed framing
that high-level clients refuse to transmit. This harness is not a product SDK.

### 12.1 Required adversarial families

Give every case a stable ASCII ID, fixed expected status/code or close action,
bounded input fixture, and expected SDK-dispatch count. All applicable cases
must execute on both targets against the frozen installed archive. The required
families below are closed minimum obligations; additional discovered defects
add tests without enlarging product scope.

| Family ID | Mandatory witnesses |
|---|---|
| `HTTP-LINE` | Fragmented/coalesced raw gate handoff; method separators/case; CR/LF/NUL/control; HTTP/1.0/2 text; h2 preface; absolute/authority/asterisk targets; query/fragment/percent/backslash/dot/double-slash forms; target/line N−1/N/N+1 |
| `HTTP-HEADERS` | Invalid name/value; whitespace before colon; obs-fold; lone CR/LF; duplicate case variants including Host/Auth; header byte/count/value N−1/N/N+1; no parser truncation or normalization bypass |
| `HTTP-FRAMING` | Equal/conflicting/combined/signed/leading-zero/overflow CL; absent POST CL; CL+TE in either order/case; every TE including chunked; chunk extensions/trailers; Expect; Upgrade/CONNECT; premature EOF; body excess/pipeline before and after publication; no second dispatch |
| `HTTP-MEDIA` | Wrong/duplicate charset and parameters; missing POST type; Content-Encoding bombs and identity; Accept/Accept-Encoding 406; no compressed response; no chunked response/SSE/WebSocket |
| `HTTP-ROUTING` | All nine exact routes; unknown and unsupported namespace; slash/case variants; every wrong method including HEAD/OPTIONS; no alias/static/generic route; exact Allow and HEAD suppression |
| `HTTP-JSON` | Invalid UTF-8/overlong/truncated sequences; BOM; duplicate decoded keys including escaped spellings; lone surrogate; trailing data; unsafe/forbidden numbers; prototype keys; depth/members/nodes/strings N−1/N/N+1; unknown fields; every wrong input type |
| `HTTP-BYTES` | Base64 padding/alphabet/bits/reencode, zero length, encoded/decoded boundaries; digests; body/response caps; worst-case escaping; all normative output byte copies |
| `SEC-AUTH` | Absent/wrong/malformed/duplicate credentials; fixed-size timingSafeEqual path; same 401 projection; all endpoints protected; no query/cookie/proxy auth; rotation only after restart; no secret passed to worker/log/receipt |
| `SEC-TLS-BIND` | Local default; remote opt-in; wildcard/DNS/IPv6/reserved-address refusal; missing/expired/mismatched cert/IP SAN/key; TLS 1.2 refusal; other ALPN; plaintext refusal; normal client trust and bad trust; security failure before listener exists |
| `SEC-HOST-PROXY` | Host mismatch/alias/userinfo/port/list/duplicate; DNS-rebinding-style Host; Forwarded and every X-Forwarded-* authority attempt; method override; Origin/Cookie/preflight; no inferred client identity |
| `SEC-ACQUISITION` | Absolute/relative/UNC/device/home/workspace/file URI strings in every plausible field; URL/metadata-service/localhost/redirect SSRF strings; unknown acquisition fields; opaque bytes cannot trigger fetch or acquire Regression authority |
| `SEC-ENV-INTEGRITY` | NODE_OPTIONS/NODE_PATH/loader/cwd/HOME/path injection; source absent; all runtime/pin/schema/limits/manifest substitutions; symlink/reparse/hardlink/case collision/extra executable; unexpected node_modules/native addon; file race detected and publication suppressed |
| `SEC-NETWORK` | Each worker-denied network/DNS/process/write entry point; complete import audit; semantic success with outbound denied; no worker socket/credential/handle sharing; report OS-denial coverage honestly |
| `RESOURCE-ADMISSION` | One active worker/zero queue; four request/write slots; 32 sockets; global integer buckets at exhaustion/refill; connection/request floods and auth failures; no per-key memory growth; busy operational endpoint and writable-error capacity |
| `RESOURCE-DEADLINES` | Slow header/body trickle cannot reset absolute deadline; TLS/semantic/write/reap/shutdown expiry; closed sockets; no late result; retained-buffer and memory peaks; no unbounded error draining |
| `LIFECYCLE-RACES` | Disconnect in reserved/running/reaping/ready/published phases; cancellation versus result/deadline; stale/duplicate/malformed worker result; worker throw/exit/stdout; integrity failure; terminate failure; no owner reuse; four slow response readers; stdout empty |
| `LIFECYCLE-SHUTDOWN` | SIGINT and supported SIGTERM, supervisor pipe EOF, invalid stdin, restart/rebind, drain deadline, listener closes before socket destruction, no leaked worker/handle, no second response after publication |
| `OBSERVABILITY` | Hostile ID/path/method/header multiline payloads; bounded fixed-code logs; dropped-log handling; no bodies/artifacts/secrets/stacks/addresses; client bodies stable across log backpressure |
| `PACKAGE` | Two clean byte-identical builds; offline fresh install; trusted verifier; archive path/type/duplicate/case/size limits; file-set mutation; no install hooks/downloaders; schema/OpenAPI regeneration and lock/SBOM/notices consistency |

Malformed cases assert no semantic worker where rejection precedes admission.
Fault-injection hooks are harness-only, not installed endpoints/config flags.
Record counts from the actual catalog; never invent a passing test count here.
Receipt validators themselves need negative witnesses for unknown/missing
fields, duplicate keys, noncanonical bytes, false PASS, wrong artifact/revision,
missing cases/platforms, mismatched archive, and weakened limits. An enum value
PASS in an unvalidated receipt is not conformance evidence.

### 12.2 Independent semantic parity

The primary oracle is a separate harness directly calling the public SDK from
the authority revision's verified source closure, with independently constructed
inputs and result projections. Do not call the REST adapter to build expected
results or use its serializer as the sole semantic oracle. For all six
capabilities compare exact SDK normative bytes, all applicable document/semantic/
evaluation/outcome digests, decisions, verification fields and authority scope,
and stable semantic error records. Decode Base64 before byte comparison.

Include Policy and Policy Set, PASS/FAIL/COULD_NOT_EVALUATE, invalid/tampered
artifacts, expected-digest mismatch, identity pin, all registered rule families,
and unavailable Regression behavior. Repeat identical vectors across fresh
processes, reordered permitted request JSON, different correlation IDs,
local/remote mode, client implementations, and both OS targets. Ignore only
HTTP/TLS/correlation metadata, never normalize normative artifacts. The same
vector set also compares to released MCP products as a sibling regression,
and CLI SDK-backed projections where applicable. MCP/CLI are secondary
cross-transport witnesses, never the REST semantic authority.

### 12.3 Targeted predecessor regression rules

Always run workspace verification, MO-1301 Policy/Policy Set/context/Regression
absence/identity/outcome SDK tests for used calls, Core/MIP import and artifact
verification fixtures, MO-1302 policy-gate projection/error/decision fixtures,
MO-1303 policy input/output and inspection-only boundary fixtures, and MO-1304
six-capability parity plus runtime/integrity boundary checks. Select the
mechanically relevant registered cases and record paths, revisions, commands,
counts, and exclusions with reasons. Do not rerun unrelated C++/UI/historical
hosted workflows to inflate totals or reinterpret MO-1303's infrastructure
exception as a new PASS.

Any change to shared SDK/Core/MIP/Policy/Regression source, frozen artifacts,
semantic errors, or public APIs requires a prior contract review and the full
affected predecessor registered suites; a source-closure change also requires
new pins and all parity. Shared packaging/verifier/toolchain changes trigger
all predecessor consumers of that tool and installed-integrity tests. Shared
workspace/conformance validators trigger all affected inventories/negative
witnesses. REST-only HTTP code triggers REST tests and the fixed semantic
parity subset, not an unrelated UI rebuild. MO-1305 normally changes no
predecessor implementation. No release tag, archived receipt, or historical
result is rewritten.

## 13. Phases and non-self-referential binding

The implementation sequence is frozen below. Each transition requires a clean
reviewed tree, exact scoped staging, workspace verification, diff checks, its
required tests, and an independently validated receipt/inventory update. No
amend, squash, invented future hash, or post-receipt archive rebuild. The
conceptual letters identify roles; this document does not assign future hashes.

| Role | Parent / scope | Required exit gate |
|---|---|---|
| F — this freeze | Authority `d15b578dd757e928273d4548348b085e58ed5df5`; exactly one documentation commit | This contract and roadmap links; no implementation artifacts |
| I1 — Phase 1 implementation | F | Package foundation; strict JSON/schema/OpenAPI source; native TLS/auth in local mode; raw gate/parser; all six SDK operations and three operational routes; limits/deadlines/admission; integrity; unit and core raw-socket adversarial tests; resource measurements on both targets; independently built closure; notices/runtime/advisory review |
| B1 — Phase 1 binding | I1 | Bind actual I1 hash, executed source-tree/harness identities, measured limits and artifacts; validate Phase 1 inventory. Remote configuration remains refused until Phase 2; do not claim full v1 certification |
| I2 — Phase 2 implementation | B1 | Enable and test explicit remote mode; complete lifecycle/security/interoperability catalog; deterministic distribution; offline installed-package harness; freeze the final candidate archive and all runtime/schema/limit/dependency identities; remeasure any changed costs |
| B2 — Phase 2 binding | I2 | Bind actual I2 hash and frozen archive identity; repeat package/installed checks; no production/archive modification in this binding commit |
| I3 — Phase 3 platform evidence | B2 | Execute full installed-archive catalog on actual Windows and Ubuntu, both generic clients, actual remote clients, resource confirmation and exact two-platform/SDK/MCP parity; commit harness/receipts/evidence; record actual executed harness manifest, never a nonexistent I3 hash |
| BF — final conformance binding | I3 | Revalidate the committed I3 evidence/harness and unchanged I2 archive identity; bind I1/B1/I2/B2/I3 hashes, inventory, validation and graph data; no production, limits, package, or receipt-byte mutation |
| Release tag (later authorized task) | BF | Annotated `memoryos-1.3-mo1305` targeting BF after all gates PASS; tag operation verified externally |

Phase 1 implements authentication/TLS early because even a local prototype
must not expose unauthenticated semantics. Phase 2 adds remote admission and
completes packaging/lifecycle certification; it does not retrofit a different
security architecture. Both-target resource runs in Phase 1 are deliberately
earlier than full release certification so no release-critical limit remains
unknown when Phase 2 builds the frozen package.

Implementation commits may contain measurement receipts bound to the exact
executed source-tree/file manifest and their already-existing parent revision.
They cannot claim their own future commit hash. B1/B2 bind the now-existing
implementation commit to those executed bytes. I3 receipts bind I2/B2 and the
executed harness manifest; BF proves that I3 contains those bytes and binds
that existing revision. BF records `validatedEvidenceRevision: I3`; its own
commit is identified externally by HEAD/tag, not self-hashed in its body.
Before tagging, inventory says READY_TO_TAG, not CREATED; after tagging its
committed pre-tag record remains historically accurate. The annotated tag and
external tag validation supply the created-tag fact without a circular commit.

If evidence reveals a production defect, stop certification and return to an
explicit new implementation/binding pair; regenerate the archive and invalidate
dependent receipts. Do not repair production inside I3/BF, relabel a failed
receipt, or bind evidence to different bytes. Additional correction commits
must be described and scoped; they cannot silently occupy a pure binding role.

### 13.1 Future inventory

Future path: `repositories/cca-conformance/mo1305-conformance-inventory.json`.
Create it in I1, not now. It is J, at most 256 KiB, closed schema, kind
`MemoryOSRESTConformanceInventory`, version `1.0.0`. Top-level fields are exactly:

| Field | Type/content |
|---|---|
| `kind`, `version` | Constants above |
| `state` | `PHASE1_PENDING`, `PHASE1_BOUND`, `PHASE2_PENDING`, `PHASE2_BOUND`, `CERTIFICATION_PENDING`, `CERTIFIED_READY_TO_TAG`, or `BLOCKED` |
| `authorityRevision` | Exact d15b578... authority hash |
| `contractFreezeRevision` | Actual existing F hash, 40 lowercase hex |
| `implementations` | Closed `{I1,B1,I2,B2,I3}`, each null until it exists, then 40 lowercase hex; no future/self hashes |
| `package` | Null until built, then `{name,version,archive,distributionManifest,sourceTreeSha256}`; name/version fixed; artifact references defined below |
| `contracts` | Closed `{apiSchema,openapi,limits,policyIdentities}`, each null until produced, then artifact reference |
| `runtime` | Null until assembled, then `{closure, sdkVersion, nodeVersion, nodeExecutables}`; exact SDK/Node strings; nodeExecutables sorted platform/hash records for both targets |
| `dependencies` | Null until reviewed, then `{directCount:0,transitiveCount:0,developmentCount:0,lockfile,manifest,sbom,notices,review}`; last five are artifact references |
| `receipts` | Closed `{resource,package,http,security,platform,parity}`, each array of artifact references, sorted by relative path; at most 64 total |
| `platforms` | Exactly two sorted records `{target,state,receipt}`, target `ubuntu-24.04-x64` or `windows-11-x64`, state `NOT_EXECUTED`, `PASS`, `FAIL`, or `BLOCKED`, receipt null or artifact reference |
| `parity` | `{state,receipt}`, state `NOT_EXECUTED`, `PASS`, `FAIL`, or `BLOCKED` |
| `finalBinding` | `{state,validatedEvidenceRevision,receipt}`, state `PENDING` or `VALIDATED`, revision/receipt null until BF validates existing I3 |
| `releaseTag` | `{name:"memoryos-1.3-mo1305",state:"NOT_READY"\|"READY_TO_TAG",targetRole:"finalConformanceBinding"}`; never a future hash |
| `blockers` | Sorted unique fixed issue IDs, at most 64, each ASCII `[A-Z0-9_-]{1,96}`; no secret/prose dump |

An artifact reference is exactly `{path,byteLength,sha256}`: normalized relative
POSIX path at most 240 bytes, nonnegative safe-integer length within its artifact
ceiling, 64 lowercase hex SHA-256. An archive reference may name a local build
artifact path in the manifest; its presence in the inventory claims identity,
not Git tracking. The verifier must be given the actual bytes and verify them.
No absolute host paths, future digest placeholders, unresolved required artifact
fields at passed phase gates, unknown fields, duplicate keys, or unvalidated
enum-only PASS. Current-role self-reference fields are the explicit exception
below and are resolved by the external Git-aware binding verifier.

State transitions are justified by referenced validator results, not manual
status edits. PHASE1_BOUND requires I1, all measured limits, and both-target
resource receipts; PHASE2_BOUND requires I1/B1/I2 and the package/security/HTTP
foundation, with the current B2 identity supplied externally;
CERTIFIED_READY_TO_TAG requires both platform PASS, parity PASS, all mandatory
catalog cases, no blockers, and finalBinding VALIDATED. Missing execution stays
NOT_EXECUTED or BLOCKED, never PASS by inference from another milestone. In a
B1 or B2 commit, its own implementations field remains null; the verifier binds
the current role through the actual Git commit being validated and checks its
parent, while the next later commit records that now-existing hash. I3 likewise
leaves its own field null until BF records it. A binding validator must not
require an inventory to embed the hash of the commit containing that inventory.

### 13.2 Receipt format and binding requirements

Create strict receipt schemas in I1 from this contract. Each receipt is J,
at most **2 MiB**, depth at most 16, at most 10,000 case records, closed fields.
Split measurement samples into deterministically indexed, manifest-bound chunks
of at most 2 MiB when necessary; a receipt has at most 256 artifact references.
Raw optional process logs are separate bounded secret-free artifacts, not an
escape hatch for unknown receipt members. All receipt types share exactly:
`kind`, `version`, `type`, `state`, `authorityRevision`, `contractFreezeRevision`,
`implementationRevision`, `bindingRevision`, `sourceTreeSha256`, `harness`,
`artifacts`, `platform`, `toolchain`, `catalog`, `results`, `payload`.

`kind` is `MemoryOSRESTReceipt`, version `1.0.0`; type is one of `resource`,
`package`, `http`, `security`, `platform`, `parity`, `finalBinding`; state is
PASS/FAIL/BLOCKED/NOT_EXECUTED. Revisions name existing commits or explicitly
null where the later binding role supplies them; harness is a manifest artifact
reference, artifacts a path-sorted reference array, sourceTreeSha256 a 64-hex
executed-tree digest. The executed tree is the J-sorted manifest of production,
contract, build-tool, fixture, and harness inputs actually used, excluding
receipts, inventories, output archives, generated provenance/SBOM metadata,
and manifests that contain the tree digest. Those outputs are separately bound
as artifacts, keeping this input-tree hash independent of its consumers.
`platform` is null only for cross-platform aggregation;
otherwise `{target,osName,osVersion,osBuild,kernel,architecture}`, strings at most
128 characters, actual measured values (kernel may be null on Windows).
`toolchain` is a sorted array of `{name,version,sha256}` (each name/version at
most 128 ASCII characters), including executable identities actually used.
`catalog` is a schema-valid manifest reference listing required case IDs and
expectations. `results` is sorted `{id,state,expected,actual,artifactRefs}`
records: id at most 96 ASCII characters, bounded expected/actual fixed schema
projections, no human exception strings. Type-specific payload fields are:

| Type | Closed payload and required checks |
|---|---|
| resource | `{samples,maxima,derivation,limits,boundaries}`: sample chunk refs, numeric maximum map keyed by the limits/measurement schema, formula-version `1.0.0`, limits ref, boundary-case refs; both platforms and sample counts mandatory |
| package | `{archive,distributionManifest,builds,installation,dependencyReview}`: artifact refs; exactly two independent build records `{treeSha256,archiveSha256}`; installation receipt ref and supply-chain review ref |
| http | `{clients,local,remote,framing}`: client toolchain names and case-result artifact refs; actual process/TCP/TLS executions, peer provenance secret-free |
| security | `{adversarial,networkDenial,advisories}`: case refs, mechanism/coverage records, dated advisory dispositions; no unsupported isolation claims |
| platform | `{resource,package,http,security,semanticVectors}`: references to validated receipts/vector file for one actual target, all same archive/implementation |
| parity | `{platformReceipts,oracle,vectorCatalog,equalities}`: exactly two platform refs, SDK oracle manifest ref, vector catalog ref, per-vector byte/digest/error equality records |
| finalBinding | `{validatedEvidenceRevision,inventory,receipts,graph,validation}`: existing I3 hash and refs to prior inventory/receipts, acyclic commit graph, final validation artifact; no own hash or tag-created claim |

All nested payloads must have type-specific closed schemas and bounds in I1;
their maps use only the fixed metric/case keys from the hash-bound catalog.
Maximum text scalar length is 1024 unless a stricter rule above applies; binary
fixtures/products are separate artifacts, not unbounded embedded strings.
Every sample count, expected result, and artifact identity is mechanically
cross-checked. A final-binding receipt references the **I3 inventory bytes**,
not the subsequently modified BF inventory that references that receipt; this
keeps the artifact graph acyclic. Hashes use raw artifact bytes. Canonical form,
schema, required case coverage, real execution provenance, artifact equality,
revision ancestry, platform identity, and zero secret content are all release
gates. A measurement sample or integration test is not itself a release receipt.

## 14. Contradiction audit and release gates

The completed design was audited against the released sources, rather than
deriving constraints from milestone names alone:

| Authority audited | Result / preserved rule |
|---|---|
| [MO-1301 Policy authority](investigation-policies.md), SDK Policy implementation | Same prepared artifacts, context owner, rule registry, resource profile, digests, decisions and inspection-only verification; no injected Regression authority |
| [MO-1302 gate](../repositories/cca-conformance/docs/mo1302-github-policy-gate.md) | HTTP status does not reinterpret CLI decision/exit meanings; no GitHub or provider-neutral CI implementation enters REST |
| MO-1303 released inventory and integration boundary | No change to VS Code behavior, hosted evidence, exception, tags, or support claims |
| [MO-1304 authority](mo1304-mcp-server-agent-integration.md), released delegation/contracts/errors/integrity and corrected freeze | Six sibling semantic projections, no MCP dependency; original MCP scope/status/corrections and package remain immutable |
| [Architecture](../ARCHITECTURE.md), [coding standards](coding-standards.md), security boundaries | Their foundation/compiler networking exclusions remain in force for those components; this separately authorized JavaScript adapter owns its listener. Pure semantic execution stays offline. No compiler/runtime-foundation changes or silent public model added |
| [SDK](../repositories/cca-sdk/README.md) and public JavaScript facade | SDK scope itself remains free of REST/auth/network policy; REST is an external SDK consumer; private native bridge is not repurposed as a service |
| [CLI](../repositories/memoryos-cli/README.md), Core and MIP implementation | CLI is not called; Core/MIP remain semantic owners; exact-byte import/verification; no transport-derived checkpoints, state, or cognition |
| [Reconciled roadmap](../ROADMAP.md) and [MO-1305 authority](mo1305-rest-gateway.md) | Settles delegated A–W choices, supports non-local clients with explicit gates, excludes later milestones; original authority's provisional status remains historical |

No required decision contradicting released authority was found. This is a
contract/source audit, not a statement that the future implementation has passed
tests. If Phase 1 finds a genuine contradiction, stop and document it before
changing predecessor behavior. Do not treat a proposed limit adjustment,
runtime replacement, alternate TLS/proxy model, or dependency addition as an
ordinary implementation detail.

Release requires: measured limits resolved before B1; complete package/identity
and advisory review before B2; exact installed archive tested on both targets;
both clients and actual remote mode executed; mandatory adversarial and parity
catalogs PASS; bounded resource/deadline/cancellation behavior verified; schemas,
OpenAPI, manifests/notices/SBOM and runtime pins agree; relevant predecessor
regressions and workspace verification PASS; receipt validators and negative
witnesses PASS; acyclic revision/artifact binding; clean final binding tree and
no unapproved affected advisory or unresolved blocker. Neither this freeze nor
a source-only unit-test result satisfies these gates.

The only remaining values are measurement-derived per-operation wire limits,
heap/external/RSS budgets and semantic deadline, and identities/counts of future
concrete build/schema/harness/evidence bytes. Sections 8 and 13 fix how they are
derived, who produces them, and which gate refuses unresolved values. Runtime,
framework, capabilities, security model, schema technology, concurrency,
deployment, platform families, and release strategy are decided now.

## 15. A–W decision-register closure

References below are part of each frozen value, not deferred design choices.
“Derived identities” means hashes of artifacts once those prescribed artifacts
exist, never permission to choose a different contract. P1/P2/P3 mean the
implementation/certification phases in section 13.

| Category | Decision and frozen value | Rationale | Phase | Required tests/evidence | Remaining measurement | Blocking gate |
|---|---|---|---|---|---|---|
| A Semantic delegation | SDK 1.1.0, exact 25-file closure/pin, six mappings (§2) | Preserve one semantic authority | P1 | SDK byte/error parity, owner/pin/integrity tests | Derived REST manifest identity | B1 closure/pin parity |
| B API/state | Six semantic + three operational routes, stateless products (§3, §7) | Small closed client surface | P1 | Nine-route/schema catalog, no retained semantic state | None | B1 catalog; P3 installed catalog |
| C HTTP | Native HTTP/1.1 inside TLS, raw gate, one request/socket, no compression/streaming (§6) | Bound parser and framing ambiguity | P1/P2 | Raw TLS adversarial framing and header agreement | Parser/buffer peaks (§8) | B1 framing/resource proof |
| D Authentication | One 32-byte entropy bearer token, all endpoints, parent-only file (§5) | Same simple credential boundary locally/remotely | P1/P2 | Auth syntax/comparison/rotation/secrecy, TLS prerequisite tests | None | No listener before prerequisites; P3 security |
| E Authorization | Credential grants only frozen catalog; forbidden header/acquisition rules (§5–7) | No role/ACL subsystem needed | P1/P2 | Forbidden paths/proxy/browser/authority tests | None | B2 complete authorization tests |
| F Trust/security | Trusted immutable launcher/package, exact products, no client file/URL/Regression authority (§2, §5–7) | Keep transport untrusted and authority owned | P1/P2 | Substitution, acquisition, bootstrap denial, threat-boundary evidence | Observed OS denial coverage, not design | B2 mandatory denial/integrity; P3 honest coverage |
| G Determinism | J transport projection and exact SDK bytes; no new semantic digest (§3) | Preserve reproducible semantics | P1/P3 | Independent vectors across IDs/JSON order/clients/OS | Derived vector identities | P3 exact parity |
| H Errors | Closed 23-code catalog/status map, SDK record, no human text (§4) | Stable machine behavior | P1/P2 | Each code/preference/no-response/HEAD behavior | Largest error bytes | B1 error limit; P3 full catalog |
| I Resources | Absolute caps, fixed counts, both-target 30/100 samples and formulas (§8) | No unbounded prototype or guessed final limits | P1, confirm P3 | Measurement/chunk receipts, N−1/N/N+1 | Per-route bytes, memory, semantic deadline | B1 refuses provisional values; P3 reconfirms |
| J Concurrency/cancellation | One semantic owner, zero queue, four request/write slots, publication boundary (§7–8) | Bound CPU/memory while serving control requests | P1/P2 | Generation/race/reap/slow-reader/shutdown cases | Resource costs only; counts fixed | B2 lifecycle; P3 installed races |
| K Filesystem | Inline HTTP content only; operator startup files and installed closure (§5, §7) | No path acquisition authority | P1/P2 | UNC/device/traversal/link/ACL/foreign-cwd cases | None | B2 and P3 acquisition/integrity |
| L Network | Literal inbound IPv4/TLS; zero outbound/DNS; no proxy (§5–7) | Enable bounded remote API without SSRF | P1/P2 | Real remote client, denied worker network entries | Actual interface/OS mechanism provenance | P3 remote + outbound evidence |
| M Secrets | Fixed token/key source, owner ACL, no worker/log exposure, restart rotation (§5) | Small auditable secret lifetime | P1/P2 | Startup refusal, ACL launcher, redaction/exposure checks | None | B2 security; P3 secret-free receipts |
| N Observability | Bounded four-field stderr JSONL; no metrics/tracing/body logs (§11) | Avoid data leakage and logging backpressure | P1/P2 | Injection, size, dropped logs, stdout-empty | Observed overhead in resource runs | B2 log tests |
| O Framework/runtime | Built-in Node TLS/HTTP/workers, ESM, Node 24.21.0 (§9) | Minimum selected dependency/adapter layers | P1 | Parser handoff, exact executable and version checks | Official archive inventory identity | B1 runtime/provenance; P3 both binaries |
| P Supply chain | Zero external npm graph; npm 11.19.0, lock v3, scripts disabled, offline install (§9) | Tractable complete closure | P1/P2/P3 | Empty-graph substitution, advisory/notices/SBOM review | Build artifact identities and dated review | B2 supply chain; P3 advisory recheck |
| Q Packaging | memoryos-rest 0.1.0, explicit files/roles, deterministic tar, verified archive (§10) | Install independently of checkout | P1/P2 | Two builds, fresh offline installs, package adversarial | Archive and manifest hashes/counts | B2 archive freeze; P3 unchanged bytes |
| R Deployment | Direct local or explicit single-host remote native TLS; no proxy; container deferred (§5, §11) | Meets HTTP objective without platform sprawl | P2/P3 | Local/remote startup, supervisor/shutdown | Actual test network provenance | P3 both deployment modes |
| S Platforms | Windows 11 x64 + Ubuntu 24.04 LTS x64; actual builds recorded (§11) | Fits selected native Node support; two independently tested targets | P1 resource/P3 certification | Native installed runs, OS/runtime checks | Actual builds and execution measurements | Both required; no inferred PASS |
| T Testing | Real process/TLS/TCP, Node fetch + curl + raw TLS, full catalog (§12) | Observe actual parser and installed behavior | P1–P3 | Catalog/case/fixture/harness manifests and negative witnesses | Actual counts/client provenance | P3 complete validated catalog |
| U Evidence | Closed inventory/receipts and I1/B1/I2/B2/I3/BF graph; annotated tag later (§13) | No self-reference or fabricated certification | P1–P3 | Schema/canonical/artifact/ancestry validators | Existing hashes assigned at binding | BF all receipts validated; tag only BF |
| V Version/OpenAPI | /v1, API 1.0.0, package 0.1.0; release-bound derived OpenAPI 3.1.1 (§3, §10) | Explicit HTTP contract with one schema source | P1/P2 | Regeneration byte equality and runtime schema parity | Schema/OpenAPI identities | B1 schema closure; B2 package identity |
| W Clients/browser | Generic fetch/curl; no official SDK, CORS, browser session (§5, §12) | Small v1 scope, future browser authority preserved | P2/P3 | Real client success/errors and Origin/preflight rejection | curl build/hash | P3 both clients on both targets |

The exact next task is:

**MEMORYOS 1.3 MO-1305 REST GATEWAY PHASE 1 IMPLEMENTATION**
