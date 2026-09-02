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

The supported methods are `health`, `observe`, `load`, `trace`, `replay`,
`compare`, `regression`, `verifyInvestigation`, `checkpoint`, `restore`, `archive`,
`returnToWorld`, `importPackage`, `exportPackage`, and `verifyPackage`.

`observe` creates a native investigation when `investigationIdentifier` is
absent and appends to that exact Core investigation when it is present. Both
forms require an explicit snapshot; the binding never supplies observation
truth.

`regression` requires explicit baseline and candidate Investigation identifiers.
It returns the immutable report produced by `InvestigationCore.regression()`;
the host performs no comparison, categorization, inference, or scoring.
