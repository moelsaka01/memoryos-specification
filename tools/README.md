# Workspace tools

This directory contains deterministic, repository-local quality tools and external tool pins.

- `verify_workspace.py` validates the required workspace shape, JSON configuration, preset contract, Memory Studio, SDK, CLI, and official MemoryOS conformance-suite evidence, and remaining deferred-repository boundaries.
- `run_clang_format.py` applies or verifies the root `.clang-format` policy in stable path order.
- `vcpkg-version.txt` pins the immutable upstream release tag cloned by bootstrap.
- `vcpkg-commit.txt` pins and verifies that tag's exact commit. The same commit is the manifest baseline in `vcpkg.json`.
- `requirements-ci.txt` pins Python packages used only by continuous integration.

These tools do not generate product code and do not add runtime behavior.
Normative CCA-MEMORYOS-1.0 assessment is owned by
[`repositories/cca-conformance`](../repositories/cca-conformance/); the
workspace verifier checks only that its required publication surfaces are
present.
