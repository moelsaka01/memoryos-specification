# MO-1305 release metadata correction tooling

Current accepted evidence is in `../../evidence/mo1305-phase3-correction/accepted/`.
Evidence in the parent directory, `final/`, and `history/` describes the blocked
provisional candidate and is retained unchanged. Phase 2B/2D generators are
historical rebuild inputs. `distribution.py` here is the corrected builder.

The package remains dependency-free. Full SPDX validation uses engineering-only
Python `jsonschema==4.25.1` with `attrs==25.3.0`,
`jsonschema-specifications==2025.4.1`, `referencing==0.36.2`,
`rpds-py==0.27.1`, and `typing-extensions==4.14.1` in
`.cache/mo1305-phase3-correction/schema-runtime`. The wheel and installed-file
identities are pinned by `schema-runtime.json`. The JSON schema is the preserved
official SPDX 2.3 Draft-7 document, SHA-256
`239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b`.
Use the recorded Python 3.12 Windows runtime and pinned wheels from
`.cache/mo1305-phase3-correction/schema-wheels`; install with `pip install --no-index
--no-compile --find-links <wheel-directory> --target <runtime-directory>` and
exact versions above. Both the schema and complete installed validator inventory
are checked before validation. The service never imports this tooling.

Run from the workspace root using the configured Python executable and pinned
Node 24.21.0. Read-only final gates:

```text
python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3-correction/check.py --require-binding --parallel
node --test --test-concurrency=1 repositories/cca-conformance/tests/mo1305_release_metadata_correction_test.mjs
node repositories/memoryos-rest/scripts/verify-contracts.mjs
python -B -X utf8 tools/verify_workspace.py --root .
```

`distribution.py build --node <node.exe> --npm <npm-cli.js> --output <fresh-dir>`
rebuilds the candidate deterministically. `--write-metadata` additionally updates
only the generated package metadata. `reproduce.py` is the retained two-clean-root
assembly harness; it intentionally refuses existing accepted build directories.
Use a fresh output/root for a new assembly instead of deleting historical output.
`MO1305_SCHEMA_RUNTIME` selects an integrity-checked engineering validator cache
when the builder runs in an independent clean source root.

`metadata_test.py --archive <archive> --output <new-receipt>` runs the 34 focused
checks. `schema_diagnostic.py` preserves the complete earlier failure diagnostic;
`schema_validation.py` is the mandatory current zero-error schema gate, followed
by `spdx.py` semantic validation. `execute.mjs` is the bounded, host-guarded
single-install smoke harness; it refuses to overwrite accepted execution logs.
It is not a Windows certification or resource campaign. Cache read access must
be available to the executing host user; archive and validator bytes remain pinned.

C3 changes implementation/metadata/tooling/evidence. C3B adds only
`accepted/binding.json`, naming C3 without self-reference. The correction gate
checks their subjects, single-parent graph, exact changed-path inventory,
committed package bytes, artifact identities, historical evidence, runtime
preservation, refresh dispositions, and release-tag absence. Phase 3A remains
historical PASS/REFRESH_REQUIRED; 3B/3C require refresh; final release binding
remains PENDING.
