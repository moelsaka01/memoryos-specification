#!/usr/bin/env python3
"""Validate the deterministic engineering-workspace contract."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


REQUIRED_PATHS = (
    ".github/dependabot.yml",
    ".github/workflows/ci.yml",
    ".clang-format",
    ".clang-tidy",
    ".editorconfig",
    ".gitattributes",
    ".gitignore",
    "ARCHITECTURE.md",
    "CMakeLists.txt",
    "CMakePresets.json",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md",
    "ROADMAP.md",
    "cmake/CCAProjectOptions.cmake",
    "cmake/CCATesting.cmake",
    "cmake/CCAVersion.cmake",
    "docs/ambiguity-register.md",
    "docs/build-instructions.md",
    "docs/cli.md",
    "docs/coding-standards.md",
    "docs/compiler-modules.md",
    "docs/developer-setup.md",
    "docs/generators.md",
    "docs/internal-model.md",
    "docs/limitations.md",
    "docs/pipeline.md",
    "docs/repository-overview.md",
    "docs/validation.md",
    "examples/specifications/reference-architecture.yaml",
    "repositories/cca-core/CMakeLists.txt",
    "repositories/cca-core/docs/semantic-memory.md",
    "repositories/cca-core/examples/process_runtime_usage.cpp",
    "repositories/cca-core/examples/process_usage.cpp",
    "repositories/cca-core/examples/semantic_memory_usage.cpp",
    "repositories/cca-core/include/cca/memory/semantic_memory.hpp",
    "repositories/cca-core/src/memory/long_term_memory_persistence.cpp",
    "repositories/cca-core/src/memory/long_term_memory_persistence.hpp",
    "repositories/cca-core/src/memory/procedural_memory_persistence.cpp",
    "repositories/cca-core/src/memory/procedural_memory_persistence.hpp",
    "repositories/cca-core/src/memory/semantic_memory.cpp",
    "repositories/cca-core/src/memory/semantic_memory_persistence.cpp",
    "repositories/cca-core/src/memory/semantic_memory_persistence.hpp",
    "repositories/cca-core/tests/episodic_memory_allocation_failure_test.cpp",
    "repositories/cca-core/tests/knowledge_retrieval_allocation_failure_test.cpp",
    "repositories/cca-core/tests/long_term_memory_allocation_failure_test.cpp",
    "repositories/cca-core/tests/long_term_memory_architecture_test.cmake",
    "repositories/cca-core/tests/memory_allocation_failure_test.cpp",
    "repositories/cca-core/tests/memory_architecture_test.cmake",
    "repositories/cca-core/tests/memory_consolidation_allocation_failure_test.cpp",
    "repositories/cca-core/tests/memory_reflection_allocation_failure_test.cpp",
    "repositories/cca-core/tests/procedural_memory_allocation_failure_test.cpp",
    "repositories/cca-core/tests/procedural_memory_architecture_test.cmake",
    "repositories/cca-core/tests/semantic_memory_allocation_failure_test.cpp",
    "repositories/cca-core/tests/semantic_memory_architecture_test.cmake",
    "repositories/cca-core/tests/semantic_memory_test.cpp",
    "repositories/cca-core/tests/working_memory_allocation_failure_test.cpp",
    "repositories/cca-core/tests/working_memory_architecture_test.cmake",
    "repositories/cca-compiler/CMakeLists.txt",
    "repositories/cca-compiler/cmake/ccaCompilerConfig.cmake.in",
    "repositories/cca-studio/CMakeLists.txt",
    "repositories/cca-studio/benchmarks/memoryos-scalability-fixture.mjs",
    "repositories/cca-studio/benchmarks/memoryos-scalability.mjs",
    "repositories/cca-studio/include/cca/memory/memory_studio.hpp",
    "repositories/cca-studio/src/memory_studio.cpp",
    "repositories/cca-studio/tests/memory_studio_test.cpp",
    "repositories/cca-studio/tests/memory_studio_allocation_failure_test.cpp",
    "repositories/cca-studio/tests/memory_studio_architecture_test.cmake",
    "repositories/cca-studio/tests/memory_studio_web_test.mjs",
    "repositories/cca-studio/tests/memory_studio_scalability_test.mjs",
    "repositories/cca-studio/examples/memory_studio_usage.cpp",
    "repositories/cca-studio/docs/memory-studio.md",
    "repositories/cca-studio/docs/memory-studio-conformance-evidence.md",
    "repositories/cca-studio/package.json",
    "repositories/cca-studio/docs/memory-investigation-packages.md",
    "repositories/cca-studio/docs/mip-conformance-matrix.md",
    "repositories/cca-studio/docs/ai-runtime-adapters.md",
    "repositories/cca-studio/web/js/mip-canonical.js",
    "repositories/cca-studio/web/js/memory-investigation-package.js",
    "repositories/cca-studio/web/js/ai-runtime-adapter.js",
    "repositories/cca-studio/web/js/adapters/openai-agents-sdk-adapter.js",
    "repositories/cca-studio/web/js/adapters/anthropic-sdk-adapter.js",
    "repositories/cca-studio/web/js/adapters/langgraph-adapter.js",
    "repositories/cca-studio/tests/mip_canonical_test.mjs",
    "repositories/cca-studio/tests/memory_investigation_package_test.mjs",
    "repositories/cca-studio/tests/mip_schema_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_adversarial_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_ordering_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_derived_edge_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_pipeline_conformance_test.mjs",
    "repositories/cca-studio/tests/fixtures/mip/complete-investigation.mip.b64",
    "repositories/cca-studio/tests/fixtures/mip/memory-investigation-package-1.0.schema.json.b64",
    "repositories/cca-studio/tests/fixtures/mip/minimal-observation.mip.b64",
    "repositories/cca-studio/tests/fixtures/mip/noncritical-extension.mip.b64",
    "repositories/cca-studio/tests/ai_runtime_adapter_test.mjs",
    "repositories/cca-studio/examples/ai_runtime_adapter_usage.mjs",
    "repositories/cca-studio/web/js/investigation-core.js",
    "repositories/cca-studio/web/js/memoryos-sdk.js",
    "repositories/cca-studio/web/js/cognitive-regression.js",
    "repositories/cca-studio/web/js/cognitive-investigation-explorer.js",
    "repositories/cca-studio/tests/investigation_core_test.mjs",
    "repositories/cca-studio/tests/memoryos_sdk_test.mjs",
    "repositories/cca-studio/tests/cognitive_regression_test.mjs",
    "repositories/cca-studio/tests/cognitive_investigation_explorer_test.mjs",
    "repositories/cca-studio/examples/investigation_core_usage.mjs",
    "repositories/cca-studio/examples/cognitive_investigation_explorer_usage.mjs",
    "repositories/cca-studio/docs/investigation-core.md",
    "repositories/cca-studio/docs/investigation-core-conformance-evidence.md",
    "repositories/cca-studio/docs/cognitive-regression.md",
    "repositories/cca-studio/docs/cognitive-regression-engineering-guide.md",
    "repositories/cca-studio/docs/cognitive-regression-conformance-report.md",
    "repositories/cca-studio/docs/schemas/cognitive-regression-report-1.0.schema.json",
    "repositories/cca-studio/docs/cognitive-investigation-explorer.md",
    "repositories/cca-studio/docs/cognitive-investigation-explorer-engineering-guide.md",
    "repositories/cca-studio/docs/cognitive-investigation-explorer-architecture-review.md",
    "repositories/cca-studio/docs/cognitive-investigation-explorer-conformance-report.md",
    "repositories/cca-studio/docs/schemas/cognitive-investigation-result-1.0.schema.json",
    "repositories/cca-studio/scripts/generate-ai-runtime-adapter-fixtures.mjs",
    "repositories/cca-studio/tests/fixtures/adapters/README.md",
    "repositories/cca-studio/tests/fixtures/adapters/reference-sources.mjs",
    "repositories/cca-studio/tests/fixtures/adapters/openai-agents.events.json",
    "repositories/cca-studio/tests/fixtures/adapters/openai-agents.output.json",
    "repositories/cca-studio/tests/fixtures/adapters/anthropic.events.json",
    "repositories/cca-studio/tests/fixtures/adapters/langgraph.events.json",
    "repositories/cca-studio/tests/fixtures/adapters/langgraph.output.json",
    "repositories/cca-studio/examples/ai-runtime-adapters/reference-packages/openai-agents-reference.mip",
    "repositories/cca-studio/examples/ai-runtime-adapters/reference-packages/anthropic-reference.mip",
    "repositories/cca-studio/examples/ai-runtime-adapters/reference-packages/langgraph-reference.mip",
    "repositories/cca-studio/web/index.html",
    "repositories/cca-studio/web/styles.css",
    "repositories/cca-studio/web/js/app.js",
    "repositories/cca-studio/web/js/browser-render-benchmark.js",
    "repositories/cca-studio/web/js/cognitive-trace.js",
    "repositories/cca-studio/web/js/deterministic-sequence-alignment.js",
    "repositories/cca-studio/web/js/graph-view-state.js",
    "repositories/cca-studio/web/js/observation-timeline.js",
    "repositories/cca-studio/web/js/semantic-world.js",
    "repositories/cca-sdk/CMakeLists.txt",
    "repositories/cca-sdk/README.md",
    "repositories/cca-sdk/bridge/investigation-core-host.mjs",
    "repositories/cca-sdk/bridge/README.md",
    "repositories/cca-sdk/include/memoryos/memoryos.hpp",
    "repositories/cca-sdk/src/client.cpp",
    "repositories/cca-sdk/src/client.hpp",
    "repositories/cca-sdk/src/core_process.cpp",
    "repositories/cca-sdk/src/core_process.hpp",
    "repositories/cca-sdk/src/json.hpp",
    "repositories/cca-sdk/src/memoryos.cpp",
    "repositories/cca-sdk/tests/memoryos_sdk_test.cpp",
    "repositories/cca-sdk/examples/cpp_quickstart.cpp",
    "repositories/cca-sdk/examples/cpp_regression.cpp",
    "repositories/cca-sdk/examples/cpp_investigate.cpp",
    "repositories/cca-sdk/python/pyproject.toml",
    "repositories/cca-sdk/python/README.md",
    "repositories/cca-sdk/python/src/memoryos/__init__.py",
    "repositories/cca-sdk/python/src/memoryos/_sdk.py",
    "repositories/cca-sdk/python/tests/test_memoryos_sdk.py",
    "repositories/cca-sdk/python/tests/test_examples.py",
    "repositories/cca-sdk/examples/python/observe.py",
    "repositories/cca-sdk/examples/python/regression.py",
    "repositories/cca-sdk/examples/python/investigate.py",
    "repositories/cca-sdk/docs/api-reference.md",
    "repositories/cca-sdk/docs/developer-guide.md",
    "repositories/cca-sdk/docs/conformance-report.md",
    "repositories/cca-sdk/docs/regression-guide.md",
    "repositories/cca-sdk/docs/explorer-guide.md",
    "repositories/cca-sdk/docs/explorer-conformance-report.md",
    "repositories/memoryos-cli/CMakeLists.txt",
    "repositories/memoryos-cli/package.json",
    "repositories/memoryos-cli/README.md",
    "repositories/memoryos-cli/bin/memoryos.js",
    "repositories/memoryos-cli/src/arguments.js",
    "repositories/memoryos-cli/src/commands.js",
    "repositories/memoryos-cli/src/errors.js",
    "repositories/memoryos-cli/src/help.js",
    "repositories/memoryos-cli/src/main.js",
    "repositories/memoryos-cli/src/output.js",
    "repositories/memoryos-cli/src/session.js",
    "repositories/memoryos-cli/src/version.js",
    "repositories/memoryos-cli/docs/quick-start.md",
    "repositories/memoryos-cli/docs/command-reference.md",
    "repositories/memoryos-cli/docs/examples.md",
    "repositories/memoryos-cli/docs/exit-code-reference.md",
    "repositories/memoryos-cli/docs/json-output-specification.md",
    "repositories/memoryos-cli/docs/automation-guide.md",
    "repositories/memoryos-cli/docs/conformance-report.md",
    "repositories/memoryos-cli/docs/regression-conformance-report.md",
    "repositories/memoryos-cli/docs/investigation-guide.md",
    "repositories/memoryos-cli/docs/investigation-conformance-report.md",
    "repositories/memoryos-cli/examples/run-cli-examples.mjs",
    "repositories/memoryos-cli/tests/architecture.test.mjs",
    "repositories/memoryos-cli/tests/cli-contract.test.mjs",
    "repositories/memoryos-cli/tests/package-workflow.test.mjs",
    "repositories/memoryos-cli/tests/investigate.test.mjs",
    "repositories/memoryos-cli/tests/session.test.mjs",
    "repositories/memoryos-cli/tests/test-helpers.mjs",
    "repositories/cca-conformance/CMakeLists.txt",
    "repositories/cca-conformance/package.json",
    "repositories/cca-conformance/README.md",
    "repositories/cca-conformance/requirements-manifest.json",
    "repositories/cca-conformance/docs/certification-guide.md",
    "repositories/cca-conformance/docs/compatibility-guide.md",
    "repositories/cca-conformance/docs/conformance-report.md",
    "repositories/cca-conformance/docs/reference-implementation-guide.md",
    "repositories/cca-conformance/docs/versioning-guide.md",
    "repositories/cca-conformance/evidence/reference-implementation-1.2.1.json",
    "repositories/cca-conformance/evidence/reference-implementation-review-1.2.1.json",
    "repositories/cca-conformance/reports/reference-implementation-1.2.1.json",
    "repositories/cca-conformance/reports/reference-implementation-1.2.1.md",
    "repositories/cca-conformance/schema/conformance-report-1.0.schema.json",
    "repositories/cca-conformance/schema/requirements-manifest-1.0.schema.json",
    "repositories/cca-conformance/tests/compatibility_conformance_test.mjs",
    "repositories/cca-conformance/tests/component_evidence_conformance_test.mjs",
    "repositories/cca-conformance/tests/reference_implementation_conformance_test.mjs",
    "repositories/cca-conformance/tests/report_conformance_test.mjs",
    "repositories/cca-conformance/tests/specification_conformance_test.mjs",
    "repositories/cca-conformance/tests/support/conformance-support.mjs",
    "repositories/cca-conformance/tools/build-pinned-manifest.mjs",
    "repositories/cca-conformance/tools/conformance-report.mjs",
    "scripts/bootstrap.ps1",
    "scripts/bootstrap.sh",
    "scripts/build.ps1",
    "scripts/build.sh",
    "scripts/coverage.ps1",
    "scripts/coverage.sh",
    "scripts/format.ps1",
    "scripts/format.sh",
    "specification/canonical-format.md",
    "specification/README.md",
    "specification/schema/canonical-specification-1.0.schema.json",
    "tests/CMakeLists.txt",
    "tools/run_clang_format.py",
    "tools/vcpkg-commit.txt",
    "tools/vcpkg-version.txt",
    "vcpkg-configuration.json",
    "vcpkg.json",
)

EXPECTED_IMPLEMENTATION_REVISION = (
    "sha256:68457c49142f5f2a54159228a480ddc11dd3f57ec0ddcb3231bcc4266d7a1044"
)
EXPECTED_STANDARD_PUBLICATION_DIGEST = (
    "sha256:f77246da755e67c5e7e73706504c6d63641eeb711fbbe9c381b10d197a3dc716"
)
EXPECTED_MIP_PUBLICATION_DIGEST = (
    "sha256:997fd40928ce52581dc932c1c3d888fd4d6a73208613ba1ab0a9f17b79c020ca"
)
EXPECTED_NORMATIVE_REGISTRY_DIGEST = (
    "sha256:68ef4fa3e5727acab071de6d84759ff2b15a2bbf3865d38a55475c399c690e7f"
)
HISTORICAL_MANIFEST = (
    "requirements-manifest-sha256-"
    "ccb957e57043d6c34542461bc7d50d034aac268da3d295c3387459db848f823a.json"
)
EXPECTED_HISTORICAL_MANIFEST_BYTES = (
    "9d22cec389778ed756184ceaf996f110d7172aa8f987cbf6caf7805954f7968e"
)

DEFERRED_REPOSITORIES = (
    "memoryos",
    "cca-atlas",
)

REQUIRED_PRESETS = {
    "default",
    "minimal",
    "release",
    "analysis",
    "coverage",
    "sanitizer",
    "ci",
}

COMPILER_MODULES = (
    ("analyzer", "analyzer"),
    ("artifact_generator", "artifact-generator"),
    ("canonical_value", "canonical-value"),
    ("cli", "cli"),
    ("compiler_pipeline", "compiler-pipeline"),
    ("compiler_service", "compiler-service"),
    ("configuration", "configuration"),
    ("conformance_generator", "conformance-generator"),
    ("dependency_resolver", "dependency-resolver"),
    ("diagnostics", "diagnostics"),
    ("documentation_generator", "documentation-generator"),
    ("internal_model", "internal-model"),
    ("logging", "logging"),
    ("model_builder", "model-builder"),
    ("package_generator", "package-generator"),
    ("parser", "parser"),
    ("serialization", "serialization"),
    ("source_loader", "source-loader"),
    ("validator", "validator"),
)

INVALID_SPECIFICATION_FIXTURES = (
    "circular-dependency.yaml",
    "duplicate-identifiers.yaml",
    "duplicate-relationship.yaml",
    "incompatible-version.yaml",
    "schema-violation.yaml",
    "unresolved-reference.yaml",
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True, help="CCA workspace root")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, object]:
    with path.open(encoding="utf-8") as stream:
        value = json.load(stream)
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def validate_conformance_artifacts(root: Path, errors: list[str]) -> None:
    conformance_root = root / "repositories" / "cca-conformance"
    manifest_path = conformance_root / "requirements-manifest.json"
    try:
        manifest_bytes = manifest_path.read_bytes()
        if not manifest_bytes.endswith(b"\n") or manifest_bytes.endswith(b"\n\n"):
            errors.append("current conformance manifest must end with exactly one LF")
            return
        manifest = load_json(manifest_path)
        implementation = manifest.get("implementation")
        if not isinstance(implementation, dict):
            errors.append("current conformance manifest lacks implementation identity")
        else:
            if implementation.get("version") != "1.2.1":
                errors.append("current conformance manifest is not the v1.2.1 assessment")
            if implementation.get("revision") != EXPECTED_IMPLEMENTATION_REVISION:
                errors.append("current conformance implementation revision is not approved")
        standard = manifest.get("standard")
        if not isinstance(standard, dict) or standard.get(
            "publicationDigest"
        ) != EXPECTED_STANDARD_PUBLICATION_DIGEST:
            errors.append("current conformance Standard publication digest changed")
        incorporated = manifest.get("incorporatedStandards")
        mip = None
        if isinstance(incorporated, list):
            mip = next(
                (
                    value
                    for value in incorporated
                    if isinstance(value, dict)
                    and value.get("identifier") == "CCA-MIP-1.0"
                ),
                None,
            )
        if not isinstance(mip, dict) or mip.get(
            "publicationDigest"
        ) != EXPECTED_MIP_PUBLICATION_DIGEST:
            errors.append("current conformance MIP publication digest changed")
        if manifest.get("normativeRegistryDigest") != EXPECTED_NORMATIVE_REGISTRY_DIGEST:
            errors.append("current conformance normative registry digest changed")
        manifest_digest = sha256(manifest_bytes[:-1])
        retained_manifest = (
            conformance_root
            / "manifests"
            / f"requirements-manifest-sha256-{manifest_digest}.json"
        )
        if not retained_manifest.is_file():
            errors.append("missing current content-addressed conformance manifest")
        elif retained_manifest.read_bytes() != manifest_bytes:
            errors.append("current manifest alias differs from its content-addressed copy")
    except (OSError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid current conformance manifest: {exception}")

    historical_path = conformance_root / "manifests" / HISTORICAL_MANIFEST
    try:
        if sha256(historical_path.read_bytes()) != EXPECTED_HISTORICAL_MANIFEST_BYTES:
            errors.append("immutable v1.2.0 content-addressed manifest bytes changed")
    except OSError as exception:
        errors.append(f"missing immutable v1.2.0 content-addressed manifest: {exception}")

    evidence_path = conformance_root / "evidence" / "reference-implementation-1.2.1.json"
    try:
        evidence_bytes = evidence_path.read_bytes()
        evidence_digest = sha256(evidence_bytes)
        retained_evidence = (
            evidence_path.parent
            / f"reference-implementation-1.2.1-sha256-{evidence_digest}.json"
        )
        if not retained_evidence.is_file():
            errors.append("missing v1.2.1 content-addressed conformance evidence")
        elif retained_evidence.read_bytes() != evidence_bytes:
            errors.append("v1.2.1 evidence alias differs from its content-addressed copy")
    except OSError as exception:
        errors.append(f"invalid v1.2.1 conformance evidence: {exception}")


def validate(root: Path) -> list[str]:
    errors: list[str] = []

    for relative_path in REQUIRED_PATHS:
        if not (root / relative_path).is_file():
            errors.append(f"missing required file: {relative_path}")

    validate_conformance_artifacts(root, errors)

    for repository in DEFERRED_REPOSITORIES:
        directory = root / "repositories" / repository
        if not directory.is_dir():
            errors.append(f"missing deferred repository: repositories/{repository}")
            continue
        actual_files = {
            path.relative_to(directory).as_posix()
            for path in directory.rglob("*")
            if path.is_file()
        }
        unexpected_files = actual_files - {"CMakeLists.txt", "README.md"}
        if unexpected_files:
            errors.append(
                f"deferred repository {repository} contains implementation files: "
                + ", ".join(sorted(unexpected_files))
            )

    compiler_root = root / "repositories" / "cca-compiler"
    for module_name, documentation_name in COMPILER_MODULES:
        module_paths = (
            compiler_root / "include" / "cca" / "compiler" / f"{module_name}.hpp",
            compiler_root / "src" / f"{module_name}.cpp",
            compiler_root / "tests" / f"{module_name}_test.cpp",
            compiler_root / "docs" / "modules" / f"{documentation_name}.md",
        )
        for module_path in module_paths:
            if not module_path.is_file():
                errors.append(
                    "compiler module is incomplete: "
                    + module_path.relative_to(root).as_posix()
                )

    fixture_root = root / "examples" / "specifications" / "invalid"
    for fixture in INVALID_SPECIFICATION_FIXTURES:
        if not (fixture_root / fixture).is_file():
            errors.append(f"missing invalid specification fixture: {fixture}")

    try:
        presets = load_json(root / "CMakePresets.json")
        configure_presets = presets.get("configurePresets", [])
        preset_names = {
            item.get("name")
            for item in configure_presets
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        }
        missing_presets = REQUIRED_PRESETS - preset_names
        if missing_presets:
            errors.append("missing configure presets: " + ", ".join(sorted(missing_presets)))
    except (OSError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid CMakePresets.json: {exception}")

    try:
        manifest = load_json(root / "vcpkg.json")
        pinned_commit = (root / "tools" / "vcpkg-commit.txt").read_text(
            encoding="utf-8"
        ).strip()
        if manifest.get("builtin-baseline") != pinned_commit:
            errors.append("vcpkg manifest baseline differs from tools/vcpkg-commit.txt")
        dependencies = manifest.get("dependencies", [])
        if "googletest" not in dependencies:
            errors.append("vcpkg manifest must provide googletest")
        if "yaml-cpp" not in dependencies:
            errors.append("vcpkg manifest must provide yaml-cpp")
    except (OSError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid vcpkg configuration: {exception}")

    try:
        schema = load_json(
            root
            / "specification"
            / "schema"
            / "canonical-specification-1.0.schema.json"
        )
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            errors.append("canonical schema must use JSON Schema Draft 2020-12")
        if schema.get("$id") != "cca://schemas/canonical-specification/1.0":
            errors.append("canonical schema identifier is incorrect")
    except (OSError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid canonical specification schema: {exception}")

    return errors


def main() -> int:
    arguments = parse_arguments()
    root = arguments.root.resolve(strict=True)
    errors = validate(root)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1

    print(f"CCA workspace verification passed: {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
