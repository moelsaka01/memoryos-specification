# MO-1304 Contract Freeze 1 correction: mandatory MCP cache directives

## Authority and scope

This owner-authorized correction follows the roadmap authority commit
`ed4632fc81a6e90835233a848a9a3a118184c02e` and the read-only Contract Freeze 1.
It corrects one demonstrated contradiction before Phase 1 resumes. The
[roadmap specification](mo1304-mcp-server-agent-integration.md) retains its
roadmap role; this record supplies the narrow implementation-contract correction.

The previous discovery statement excluding cache directives is superseded
only by the mandatory fields below. All other frozen requirements remain.
This correction does not certify the existing uncommitted implementation.

## Authoritative requirement and verification

The MCP 2026-07-28 [caching specification](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
requires cache hints on complete results for discovery, tools/list, prompts/list,
resources/list, resources/templates/list, and resources/read. Only the first
two are implemented by MO-1304. The
[authoritative schema](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2026-07-28/schema.ts)
defines DiscoverResult and ListToolsResult through CacheableResult. Both
fields are required directly in the JSON-RPC `result` object, alongside
`resultType`, not inside `_meta`, a tool, or MemoryOS structured content:

| Field | Protocol type and values | Exact MO-1304 value |
|---|---|---|
| `ttlMs` | Nonnegative integer milliseconds | `0` |
| `cacheScope` | String, `public` or `private` | `private` |

The protocol's compatibility treatment for missing hints concerns older
servers; it does not authorize their omission from this selected revision.
A zero TTL makes the response immediately stale. Private scope confines any
client-side reuse to the same authorization context. Neither grants authority.

On 2026-09-21, a read-only audit under Node 24.21.0 exercised the existing
stdio adapter with official server/core 2.0.0. Exact assertions confirmed both
complete responses contain these values. Discovery contained only the six
result fields below; tools/list contained only its five fields below. The
catalog remained six tools with unchanged order and content. This observation
corroborates the protocol requirement; SDK defaults are not the authority.

## Corrected exact responses

The complete `server/discover` result is exactly:

```json
{
  "resultType": "complete",
  "ttlMs": 0,
  "cacheScope": "private",
  "supportedVersions": ["2026-07-28"],
  "capabilities": { "tools": { "listChanged": false } },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "memoryos-mcp",
      "version": "0.1.0"
    }
  }
}
```

The complete `tools/list` result has exactly these five fields:

- `resultType`: `complete`.
- `ttlMs`: `0`.
- `cacheScope`: `private`.
- `tools`: the unchanged six-tool array from Contract Freeze 1, with its exact
  order, names, descriptions, annotations, and input/output schemas.
- `_meta`: exactly the serverInfo object shown above.

No pagination is added; a supplied cursor remains invalid. Discovery adds no
instructions, icons, or capabilities. The catalog is immutable for process
lifetime, listChanged remains false, and no feature-change events are added.

## Other messages and preserved boundaries

CallToolResult and SubscriptionsListenResult extend Result, not CacheableResult.
No mandatory cache fields apply to tools/call or subscription completion.
The base Result's extensibility does not enlarge MO-1304's exact tool-result
projection: it continues to omit cache fields. Subscription acknowledgement
and cancellation are notifications, and protocol errors are error envelopes;
none receives these result fields. MO-1304's frozen subscription teardown
continues to use notifications/cancelled rather than optional completion.
The other cache-bearing methods listed by MCP remain unsupported.

These fixed hints are deterministic MCP protocol metadata. They are not
MemoryOS canonical data, semantic digest inputs, Policy canonicalization,
Evaluation Identity, Outcome identity, or contract identity. Tests must require
both exact values on discovery/listing and reject missing, wrong-type, or
incorrect-value hints wherever the adapter owns the projection.

The correction adds no server semantic cache, artifact cache, prepared-object
cache, FactContext cache, result cache, integrity-bypassing identity cache,
artifact handles, persistence, reusable SDK owners, or hidden semantic state.
Every admitted semantic operation retains its fresh owner and integrity checks.
No client, cross-client, filesystem, workspace, Regression, credential, or
MemoryOS authority derives from these hints or cached client state.

The six-tool surface, stateless semantics, one active semantic operation, zero
semantic queue, worker isolation, strict schemas, bounded I/O, offline stdio,
no listener, no client filesystem access, no credentials, no Regression
injection, no shell/PATH delegation, and runtime integrity remain unchanged.
MO-1301, MO-1302, and MO-1303 contracts and historical evidence are untouched.

## Commit sequence

The documentation-only correction commit has subject
`docs(memoryos-1.3): correct MO-1304 MCP cache directives` and parent
`ed4632fc81a6e90835233a848a9a3a118184c02e`. It excludes the existing Phase 1 draft.
The implementation commit I1 must have this correction commit as its parent,
superseding the earlier requirement to parent I1 directly to the roadmap
commit. I1 retains its frozen subject. A subsequent binding-only B1 parents
I1 and binds already-existing revisions and actual evidence. No self-reference,
Phase 2 work, push, or tag is authorized by this correction.
