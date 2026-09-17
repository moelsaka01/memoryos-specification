# MemoryOS for VS Code

`moelsaka01.memoryos` is the workspace-scoped desktop VS Code adapter for the
MemoryOS Policy product contract. Version `0.1.0` provides the complete local
MO-1303 Phase 2 product experience. It is not a Policy implementation: every
semantic result comes from the verified bundled MemoryOS CLI 1.1 and public
JavaScript SDK 1.1 closure.

## Host and trust contract

- Minimum supported VS Code Desktop version: `1.137.0`.
- MO-1303 conformance reference host: exactly `1.137.0`.
- The manifest accepts `^1.137.0`; later compatible versions are not thereby
  independently certified.
- The extension is a local desktop workspace extension. VS Code Web, virtual
  workspaces, Remote SSH, WSL, Dev Containers, and Codespaces are unsupported.
- **Show Contract Identities** is available in an untrusted window. All other
  commands require Workspace Trust in both the manifest and command handler.

The extension has no settings, telemetry, diagnostics, webviews, custom
editors, language server, task provider, automatic discovery, file-system
watcher, or automatic evaluation.

## Commands

The complete public v1 command surface is exactly:

- `MemoryOS: Show Contract Identities`
- `MemoryOS: Prepare Policy or Policy Set`
- `MemoryOS: Evaluate Policy or Policy Set`
- `MemoryOS: Verify Evaluation Identity`
- `MemoryOS: Verify Policy Outcome`

Semantic operations begin only when explicitly invoked through one of these
commands. Artifact kind, verification mode, candidate MIP, and optional
Regression baseline are always chosen explicitly. A URI supplied from Explorer
may seed selection; otherwise the user chooses a saved active editor or a local
file through the open dialog. Filename suffixes are hints only and never
establish artifact kind.

## Supported local artifacts

Policy inputs are limited to 2,048 bytes, Policy Set inputs to 4,096 bytes, and
MIP inputs to 524,288 bytes. Evaluation Identity and outcome verification
artifacts use the existing 4,060-byte normative outcome ceiling. These gates
are applied before unbounded reads.

Only saved, clean, regular `file:` leaves are authoritative. Untitled or dirty
documents, symbolic-link/reparse leaves, remote URIs, missing files, and
role-swapped private paths are rejected. Files outside the workspace are
allowed when explicitly selected in a trusted local desktop window. In a
multi-root workspace every artifact is selected independently; folder
relationships are presentation metadata and confer no MemoryOS authority.

## Preparation and evaluation

Preparation delegates to `policy digest --json` and presents the artifact kind,
document digest, and semantic digest returned by the authoritative runtime.
Prepared presentation is never silently reused as semantic authority; every
later operation reacquires its explicit inputs.

Evaluation explicitly acquires a Policy or Policy Set, a candidate MIP, and an
optional baseline MIP. A baseline is used only by the existing trusted
Regression construction path. The extension requests a fresh private four-file
generation:

```text
evaluation-identity.json
evaluation-identity.sha256
evaluation-outcome.sha256
evaluation-outcome.json
```

The outcome is the final commit marker. Before publication the extension asks
the bundled CLI to verify the identity and outcome in both serialized-artifact
and authoritative-reconstruction modes. Sidecars, embedded identity, selected
Policy/Set semantic identity, outcome version binding, and preflight/postflight
contract identities must all agree. A mixed, partial, malformed, or cancelled
generation is discarded and never presented as a completed result.

## Decisions and results

The **MemoryOS Results** Explorer view uses native tree items. It preserves
authored Policy, rule, and evidence order and does not omit non-PASS results.

- `PASS` is a completed normative decision.
- `FAIL` is a completed normative decision, not a tool failure.
- `COULD_NOT_EVALUATE` is a completed normative decision and is never changed
  to `FAIL`.
- Adapter or CLI failure is operational and is never changed to a Policy
  decision.
- Cancellation publishes no decision.

Rules show their identity, decision, stable decision code, and ordered evidence.
The four supported evidence kinds are fact reference, fact selection, fact
domain state, and deterministic-source absence. The view shows exact source
bindings and `factDomain` where required; it does not invent severity, scores,
explanations, byte ranges, or globally authoritative standalone fact IDs.

Navigation is limited to explicitly possessed Policy/Set and MIP files and to
verified `memoryos:` virtual documents. Whole-artifact navigation is a
convenience and does not claim an evidence byte range.

## Verification and exact documents

Evaluation Identity and outcome verification both support:

- **artifact mode**, using explicit serialized artifacts and the frozen
  expected digest/identity inputs; and
- **evaluation mode**, which reacquires the Policy/Set, candidate MIP, and
  optional baseline MIP through the authoritative evaluation path.

Verified Contract Identities, Evaluation Identity, and Evaluation Outcome are
available as read-only `memoryos:` virtual documents. Evaluation documents are
keyed by their normative digests and contain the exact canonical bytes converted
to text without pretty-printing or semantic rewriting.

The bounded **MemoryOS** log output channel is operational presentation only.
It never determines a decision and does not log full MIPs, private runtime
bytes, or unbounded worker output. The ephemeral status item starts hidden and
is shown only for a completed result state or concise operational-error state;
it is not persisted across Extension Host restarts.

## Authority and security

The frozen execution chain is:

```text
VS Code product UX
  -> Phase 1 adapter
  -> fresh extension-owned worker_threads worker
  -> verified immutable byte-preserved CLI 1.1 closure
  -> CLI main(argv, injected bounded I/O)
  -> public JavaScript SDK 1.1
  -> authoritative MemoryOS implementation
```

There is no operating-system CLI process, shell, PATH lookup, external Node
executable, runtime package install, network acquisition, or user-configurable
semantic executable. stdout and stderr are independently bounded to 1 MiB;
direct process output fails closed. Only one semantic operation runs at a time,
and VS Code cancellation hard-terminates its worker and invalidates publication.

Artifact-controlled text is treated as hostile. Tree labels, notifications,
Quick Picks, status text, and log fields are bounded and control-sanitized. The
extension creates no trusted Markdown or arbitrary command URI.

## Current limitations

Phase 2 uses a deterministic mocked VS Code boundary for local product tests.
Real Extension Development Host execution, the Windows/Linux/macOS hosted
matrix, final VSIX inventory and SHA-256, install/uninstall certification, and
Marketplace publication are intentionally deferred to Phase 3. Snapshot
permissions enforce the extension trust boundary but do not claim isolation
from a hostile process running as the same operating-system user.

## Development

Node.js 22 or later is required. Direct development dependencies are exactly
pinned and installed with `npm ci`.

```sh
npm ci
npm run build
npm test
```

`npm run typecheck` runs `tsc --noEmit`. The TypeScript/esbuild shell is kept
separate from the inspectable byte-preserved semantic runtime closure. This
package is not published to npm or the VS Code Marketplace during Phase 2.
