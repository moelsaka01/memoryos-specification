# Private Investigation Core binding

`investigation-core-host.mjs` is the single private native/Python binding to the
existing JavaScript Investigation Core. It is not a CLI, service, persistence
format, or alternate execution authority.

The host reads UTF-8 JSON Lines from standard input and writes one canonical
JSON response per request. The closed version 1.0 envelope is:

```json
{"version":"1.0.0","id":0,"method":"health","params":{}}
```

Success:

```json
{"version":"1.0.0","id":0,"ok":true,"result":{}}
```

Failure:

```json
{"version":"1.0.0","id":0,"ok":false,"error":{"code":"...","operation":"...","message":"...","diagnostics":[]}}
```

Package bytes use canonical RFC 4648 Base64. MIP verification remains MIP-owned;
Core investigation commands remain Core-owned. Checkpoint tokens refer to
private live `Checkpoint` instances and are never accepted as caller-authored
transition logs. Messages are limited to 64 MiB and are processed sequentially.

The supported Core methods are `health`, `observe`, `load`, `trace`, `replay`,
`compare`, `regression`, `investigate`, `verifyInvestigation`, `checkpoint`, `restore`, `archive`,
`returnToWorld`, `importPackage`, `exportPackage`, and `verifyPackage`.

SDK 1.1 also uses closed Policy methods for preparation; detached context,
source, and report inspection; trusted context/Regression capture; Policy and
Policy Set evaluation; Evaluation Identity/outcome verification; and frozen
contract-identity inspection. The private wire envelope remains version 1.0.0
because SDK 1.1 extends only the closed method registry and does not alter the
transport framing.

Authoritative contexts and Regression sources are retained in process-local
maps and referenced by opaque tokens. Tokens never appear in canonical
artifacts or digests. Serializing then inspecting an artifact never recreates
one of these tokens, and therefore never restores production authority.

`observe` creates a native investigation when `investigationIdentifier` is
absent and appends to that exact Core investigation when it is present. Both
forms require an explicit snapshot; the binding never supplies observation
truth.

`regression` requires explicit baseline and candidate Investigation identifiers.
It returns the immutable report produced by `InvestigationCore.regression()`;
the host performs no comparison, categorization, inference, or scoring.

`investigate` transports one complete Cognitive Regression report and one
closed query to `InvestigationCore.investigate()`. The host does not filter,
rank, replay, resolve, or explain evidence.
