#!/usr/bin/env python3
"""Validate the deterministic engineering-workspace contract."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REQUIRED_PATHS = (
    ".github/dependabot.yml",
    ".github/workflows/ci.yml",
    ".clang-format",
    ".clang-tidy",
    ".editorconfig",
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
    "repositories/cca-compiler/CMakeLists.txt",
    "repositories/cca-compiler/cmake/ccaCompilerConfig.cmake.in",
    "repositories/cca-studio/CMakeLists.txt",
    "repositories/cca-studio/include/cca/memory/memory_studio.hpp",
    "repositories/cca-studio/src/memory_studio.cpp",
    "repositories/cca-studio/tests/memory_studio_test.cpp",
    "repositories/cca-studio/tests/memory_studio_allocation_failure_test.cpp",
    "repositories/cca-studio/tests/memory_studio_architecture_test.cmake",
    "repositories/cca-studio/tests/memory_studio_web_test.mjs",
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
    "repositories/cca-studio/tests/ai_runtime_adapter_test.mjs",
    "repositories/cca-studio/examples/ai_runtime_adapter_usage.mjs",
    "repositories/cca-studio/web/js/investigation-core.js",
    "repositories/cca-studio/web/js/memoryos-sdk.js",
    "repositories/cca-studio/tests/investigation_core_test.mjs",
    "repositories/cca-studio/tests/memoryos_sdk_test.mjs",
    "repositories/cca-studio/examples/investigation_core_usage.mjs",
    "repositories/cca-studio/docs/investigation-core.md",
    "repositories/cca-studio/docs/investigation-core-conformance-evidence.md",
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
    "repositories/cca-sdk/python/pyproject.toml",
    "repositories/cca-sdk/python/README.md",
    "repositories/cca-sdk/python/src/memoryos/__init__.py",
    "repositories/cca-sdk/python/src/memoryos/_sdk.py",
    "repositories/cca-sdk/python/tests/test_memoryos_sdk.py",
    "repositories/cca-sdk/python/tests/test_examples.py",
    "repositories/cca-sdk/examples/python/observe.py",
    "repositories/cca-sdk/docs/api-reference.md",
    "repositories/cca-sdk/docs/developer-guide.md",
    "repositories/cca-sdk/docs/conformance-report.md",
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

DEFERRED_REPOSITORIES = (
    "memoryos",
    "cca-conformance",
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


def validate(root: Path) -> list[str]:
    errors: list[str] = []

    for relative_path in REQUIRED_PATHS:
        if not (root / relative_path).is_file():
            errors.append(f"missing required file: {relative_path}")

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
