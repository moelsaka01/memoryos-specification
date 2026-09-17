# MemoryOS for VS Code

`moelsaka01.memoryos` is the workspace-scoped desktop VS Code adapter for the
MemoryOS Policy product contract. Version `0.1.0` is the MO-1303 Phase 1
foundation. It proves the package, lazy command activation, Workspace Trust
boundary, adapter error contract, and verified in-process runtime boundary;
the complete Phase 2 product experience is intentionally deferred.

## Host contract

- Minimum supported VS Code Desktop version: `1.137.0`.
- MO-1303 conformance reference host: exactly `1.137.0`.
- The manifest accepts `^1.137.0`; later compatible versions are not thereby
  independently certified.
- The extension runs as a desktop workspace extension. Virtual, remote, and
  web workspaces are outside the v1 support claim.

The extension has no configuration surface, telemetry, diagnostics, webview,
custom editor, language server, task provider, automatic artifact discovery,
file-system watcher, or automatic evaluation.

## Public commands

The complete public v1 command surface is:

- `memoryos.showContractIdentities`
- `memoryos.preparePolicyArtifact`
- `memoryos.evaluatePolicyArtifact`
- `memoryos.verifyEvaluationIdentity`
- `memoryos.verifyPolicyOutcome`

Commands activate the extension only when explicitly invoked. Show Contract
Identities is available in an untrusted workspace. The other four commands are
gated in the manifest and enforce Workspace Trust again inside their handlers.
Their complete saved-local-file selection and result presentation flows belong
to Phase 2.

## Authority and execution

The extension is an adapter, not an independent Policy implementation. The
frozen execution chain is:

```text
VS Code command
  -> extension-owned worker_threads worker
  -> verified byte-preserved CLI 1.1 module closure
  -> CLI main(argv, injected bounded I/O)
  -> public JavaScript SDK 1.1
  -> authoritative MemoryOS implementation
```

No operating-system CLI process, shell, PATH lookup, external Node executable,
or user-configurable semantic executable participates. The separately
inspectable runtime closure is verified before it is copied into a private
execution snapshot.

## Phase 1 transport bounds

The measured extension input limits are 2,048 bytes for a Policy, 4,096 bytes
for a Policy Set, and 524,288 bytes for a MIP. These are adapter transport
limits, not MemoryOS Resource Profile limits; in particular, they do not change
the normative `evaluation.outcome-canonical-bytes = 4060` limit or the released
MIP contract.

The MIP limit admits every released and representative valid measurement
artifact with at least 26-times headroom over the 19,519-byte released maximum.
Larger 1 MiB through 4 MiB integrity-valid padding constructions are retained
as artificial stress observations outside the v1 extension support boundary;
they do not silently enlarge that boundary. Input acquisition checks the limit
from file metadata before streaming through a fixed 65,536-byte copy buffer
into private operation state.

## Development

Node.js 22 or later is required for the build. Direct development dependencies
are exactly pinned and installed reproducibly with `npm ci`.

```sh
npm ci
npm run build
npm test
```

`npm run typecheck` runs `tsc --noEmit`; `npm run build:shell` produces the
unminified, source-map-free CommonJS extension and worker entry points with
esbuild. The semantic runtime distribution is never minified into those shell
bundles.

This package is not published to npm or the VS Code Marketplace during
MO-1303 Phase 1.
