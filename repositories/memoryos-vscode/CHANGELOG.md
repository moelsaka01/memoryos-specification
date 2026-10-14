# Changelog

## 0.1.0 - Released with explicit external-infrastructure exception

- Add the MO-1303 Phase 1 desktop workspace-extension package foundation.
- Freeze the five-command public surface and contribution-driven activation.
- Add limited untrusted-workspace support with handler-level trust enforcement.
- Add the closed extension adapter error-code catalog.
- Add deterministic TypeScript, esbuild, test, and future VSIX allowlist
  foundations.
- Complete all five local product command flows through the verified Phase 1
  adapter without duplicating MemoryOS semantics.
- Add the native MemoryOS Results tree, exact read-only virtual documents,
  bounded log output, ephemeral status, progress, and hard cancellation UX.
- Add complete-generation verification, trusted local artifact acquisition,
  verification modes, hostile-presentation defenses, and deterministic mocked
  VS Code product coverage.
- Add the pinned VS Code Desktop `1.137.0` Extension Host harness with isolated
  development, restricted-workspace, installed-VSIX, cancellation, and offline
  execution modes while preserving the mocked product suite.
- Add deterministic `@vscode/vsce` packaging, a closed VSIX allowlist, packaged
  runtime-closure verification, and a canonical package identity receipt.
- Add the manual, least-privilege three-platform hosted certification workflow,
  bounded evidence schema, deterministic validator, and canonical-byte parity
  gate.
- Harden final artifact reacquisition, file-URI closure, trust rechecks, and
  asynchronous Extension Host disposal.

Released under the annotated tag `memoryos-1.3-mo1303`, targeting final
conformance binding `49aa80fa76bffc03e36335be8ab805bb5dc38f9c`.

| Hosted certification | Actual final status |
|---|---|
| Ubuntu | PASS |
| Windows | PASS |
| macOS | NOT EXECUTED due external GitHub runner-allocation/billing restriction |
| Three-platform parity | NOT EXECUTED |

The planned requirement for matching hosted evidence on all three platforms
and strict three-platform validation remains intact. The actual final release
uses the explicit external-infrastructure exception and does not claim full
three-platform certification. Two-of-three is not three-of-three. The historical
binding record at repository path
`repositories/cca-conformance/evidence/mo1303-final-conformance-binding-run-35474897159.json`
and its pre-tag status are preserved; they do not mean the final binding or tag
is still pending. Future MO-1304 macOS evidence is MO-1304 evidence and must not
retroactively rewrite MO-1303 history.

The extension is not published to the VS Code Marketplace.
