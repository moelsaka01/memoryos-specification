#!/usr/bin/env python3
"""Validate the deterministic engineering-workspace contract."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path


REQUIRED_PATHS = (
    ".github/dependabot.yml",
    ".github/actions/memoryos-policy-gate/action.yml",
    ".github/actions/memoryos-policy-gate/distribution-manifest.json",
    ".github/actions/memoryos-policy-gate/dist/action-runtime.mjs",
    ".github/actions/memoryos-policy-gate/dist/cli-driver.mjs",
    ".github/actions/memoryos-policy-gate/dist/contracts/policy-contract-identities-1.0.0.json",
    ".github/actions/memoryos-policy-gate/dist/index.js",
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
    "docs/investigation-policies.md",
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
    "repositories/cca-studio/web/js/investigation-policy-integration.js",
    "repositories/cca-studio/tests/investigation_core_test.mjs",
    "repositories/cca-studio/tests/memoryos_sdk_test.mjs",
    "repositories/cca-studio/tests/cognitive_regression_test.mjs",
    "repositories/cca-studio/tests/cognitive_investigation_explorer_test.mjs",
    "repositories/cca-studio/tests/memoryos_policy_sdk_test.mjs",
    "repositories/cca-studio/examples/investigation_core_usage.mjs",
    "repositories/cca-studio/examples/cognitive_investigation_explorer_usage.mjs",
    "repositories/cca-studio/examples/investigation_policy_usage.mjs",
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
    "repositories/cca-studio/docs/investigation-policies.md",
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
    "repositories/cca-sdk/src/policy.cpp",
    "repositories/cca-sdk/tests/memoryos_sdk_test.cpp",
    "repositories/cca-sdk/examples/cpp_quickstart.cpp",
    "repositories/cca-sdk/examples/cpp_regression.cpp",
    "repositories/cca-sdk/examples/cpp_investigate.cpp",
    "repositories/cca-sdk/examples/cpp_policy.cpp",
    "repositories/cca-sdk/python/pyproject.toml",
    "repositories/cca-sdk/python/README.md",
    "repositories/cca-sdk/python/src/memoryos/__init__.py",
    "repositories/cca-sdk/python/src/memoryos/_sdk.py",
    "repositories/cca-sdk/python/src/memoryos/_policy_models.py",
    "repositories/cca-sdk/python/tests/test_memoryos_sdk.py",
    "repositories/cca-sdk/python/tests/test_investigation_policy_sdk.py",
    "repositories/cca-sdk/python/tests/test_examples.py",
    "repositories/cca-sdk/examples/python/observe.py",
    "repositories/cca-sdk/examples/python/regression.py",
    "repositories/cca-sdk/examples/python/investigate.py",
    "repositories/cca-sdk/examples/python/policy.py",
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
    "repositories/memoryos-cli/src/policy-arguments.js",
    "repositories/memoryos-cli/src/policy-commands.js",
    "repositories/memoryos-cli/src/policy-publication.js",
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
    "repositories/memoryos-cli/docs/policy-guide.md",
    "repositories/memoryos-cli/docs/policy-conformance-report.md",
    "repositories/memoryos-cli/examples/run-cli-examples.mjs",
    "repositories/memoryos-cli/tests/architecture.test.mjs",
    "repositories/memoryos-cli/tests/cli-contract.test.mjs",
    "repositories/memoryos-cli/tests/package-workflow.test.mjs",
    "repositories/memoryos-cli/tests/policy-cli.test.mjs",
    "repositories/memoryos-cli/tests/investigate.test.mjs",
    "repositories/memoryos-cli/tests/session.test.mjs",
    "repositories/memoryos-cli/tests/test-helpers.mjs",
    "repositories/memoryos-vscode/CMakeLists.txt",
    "repositories/memoryos-vscode/package.json",
    "repositories/memoryos-vscode/package-lock.json",
    "repositories/memoryos-vscode/README.md",
    "repositories/memoryos-vscode/CHANGELOG.md",
    "repositories/memoryos-vscode/esbuild.mjs",
    "repositories/memoryos-vscode/tsconfig.json",
    "repositories/memoryos-vscode/.vscodeignore",
    "repositories/memoryos-vscode/contracts/policy-contract-identities-1.0.0.json",
    "repositories/memoryos-vscode/measurements/runtime-closure-identity-receipt-1.0.0.json",
    "repositories/memoryos-vscode/measurements/transport-corpus-inventory-1.0.0.json",
    "repositories/memoryos-vscode/measurements/transport-host-observation-1.0.0.json",
    "repositories/memoryos-vscode/measurements/transport-limit-selection-receipt-1.0.0.json",
    "repositories/memoryos-vscode/measurements/transport-measurement-results-1.0.0.json",
    "repositories/memoryos-vscode/runtime/runtime-closure-manifest.json",
    "repositories/memoryos-vscode/scripts/build-runtime-distribution.mjs",
    "repositories/memoryos-vscode/scripts/measure-transport-limits.mjs",
    "repositories/memoryos-vscode/src/commands.ts",
    "repositories/memoryos-vscode/src/errors.ts",
    "repositories/memoryos-vscode/src/extension.ts",
    "repositories/memoryos-vscode/src/runtime/canonical-json.ts",
    "repositories/memoryos-vscode/src/runtime/cli-adapter.ts",
    "repositories/memoryos-vscode/src/runtime/cli-worker.ts",
    "repositories/memoryos-vscode/src/runtime/input-snapshot.ts",
    "repositories/memoryos-vscode/src/runtime/runtime-contract.ts",
    "repositories/memoryos-vscode/src/runtime/runtime-distribution.ts",
    "repositories/memoryos-vscode/tests/extension_shell_contract.test.mjs",
    "repositories/memoryos-vscode/tests/runtime_foundation.test.mjs",
    "repositories/cca-conformance/CMakeLists.txt",
    "repositories/cca-conformance/package.json",
    "repositories/cca-conformance/README.md",
    "repositories/cca-conformance/requirements-manifest.json",
    "repositories/cca-conformance/docs/certification-guide.md",
    "repositories/cca-conformance/docs/compatibility-guide.md",
    "repositories/cca-conformance/docs/conformance-report.md",
    "repositories/cca-conformance/docs/mo1301-conformance.md",
    "repositories/cca-conformance/docs/mo1302-handoff.md",
    "repositories/cca-conformance/docs/reference-implementation-guide.md",
    "repositories/cca-conformance/docs/versioning-guide.md",
    "repositories/cca-conformance/evidence/reference-implementation-1.2.1.json",
    "repositories/cca-conformance/evidence/reference-implementation-review-1.2.1.json",
    "repositories/cca-conformance/reports/reference-implementation-1.2.1.json",
    "repositories/cca-conformance/reports/reference-implementation-1.2.1.md",
    "repositories/cca-conformance/mo1301-conformance-inventory.json",
    "repositories/cca-conformance/mo1303-conformance-inventory.json",
    "repositories/cca-conformance/schema/conformance-report-1.0.schema.json",
    "repositories/cca-conformance/schema/github-policy-gate-automation-failure-1.0.schema.json",
    "repositories/cca-conformance/schema/github-policy-gate-distribution-manifest-1.0.schema.json",
    "repositories/cca-conformance/schema/github-policy-gate-receipt-1.0.schema.json",
    "repositories/cca-conformance/schema/github-policy-gate-test-vector-1.0.schema.json",
    "repositories/cca-conformance/schema/requirements-manifest-1.0.schema.json",
    "repositories/cca-conformance/tests/compatibility_conformance_test.mjs",
    "repositories/cca-conformance/tests/component_evidence_conformance_test.mjs",
    "repositories/cca-conformance/tests/reference_implementation_conformance_test.mjs",
    "repositories/cca-conformance/tests/mo1301_integration_conformance_test.mjs",
    "repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs",
    "repositories/cca-conformance/tests/mo1303_phase1_conformance_test.mjs",
    "repositories/cca-conformance/tests/mo1303_phase2_conformance_test.mjs",
    "repositories/cca-conformance/tests/report_conformance_test.mjs",
    "repositories/cca-conformance/tests/specification_conformance_test.mjs",
    "repositories/cca-conformance/tests/support/conformance-support.mjs",
    "repositories/cca-conformance/tests/support/mo1301-conformance-support.mjs",
    "repositories/cca-conformance/tests/support/mo1302-action-foundation-support.mjs",
    "repositories/cca-conformance/tests/support/mo1303-conformance-support.mjs",
    "repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0/mo1302-action-foundation-vectors.json",
    "repositories/cca-conformance/tests/fixtures/investigation-policy/1.0.0/mo1302-handoff-vectors.json",
    "repositories/cca-conformance/tools/build-mo1302-action-distribution.mjs",
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
    "sha256:308a03ae4f4e334e6ecfede0d28feaf36180b55402fa3ba8c0365482ec08ed64"
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

MO1302_ACTION_ROOT = Path(".github/actions/memoryos-policy-gate")
MO1302_ACTION_INPUTS = (
    "policy-kind",
    "policy-path",
    "expected-policy-semantic-digest",
    "candidate-mip-path",
    "regression-baseline-mip-path",
)
MO1302_ACTION_OUTPUTS = (
    "gate-class",
    "decision",
    "cli-exit-code",
    "publication-valid",
    "policy-semantic-digest",
    "evaluation-identity-digest",
    "outcome-digest",
    "policy-fact-context-digest",
    "regression-source-digest",
    "evaluation-identity-path",
    "outcome-path",
    "artifact-directory",
    "stable-code",
    "failure-class",
    "phase",
    "artifact-kind",
    "limit-identifier",
    "distribution-repository",
    "distribution-revision",
)
MO1302_SCHEMA_IDENTIFIERS = {
    "github-policy-gate-automation-failure-1.0.schema.json": (
        "cca://schemas/memoryos/github-policy-gate/automation-failure/1.0"
    ),
    "github-policy-gate-distribution-manifest-1.0.schema.json": (
        "cca://schemas/memoryos/github-policy-gate/distribution-manifest/1.0"
    ),
    "github-policy-gate-receipt-1.0.schema.json": (
        "cca://schemas/memoryos/github-policy-gate/receipt/1.0"
    ),
    "github-policy-gate-test-vector-1.0.schema.json": (
        "cca://schemas/memoryos/github-policy-gate/test-vector/1.0"
    ),
}
MO1302_VENDOR_SOURCES = (
    "repositories/cca-studio/package.json",
    "repositories/cca-studio/web/data/studio-snapshot.js",
    "repositories/cca-studio/web/js/cognitive-comparative-reconstruction.js",
    "repositories/cca-studio/web/js/cognitive-comparative-replay.js",
    "repositories/cca-studio/web/js/cognitive-evolution-controller.js",
    "repositories/cca-studio/web/js/cognitive-evolution.js",
    "repositories/cca-studio/web/js/cognitive-investigation-explorer.js",
    "repositories/cca-studio/web/js/cognitive-regression.js",
    "repositories/cca-studio/web/js/cognitive-replay.js",
    "repositories/cca-studio/web/js/cognitive-trace.js",
    "repositories/cca-studio/web/js/deterministic-sequence-alignment.js",
    "repositories/cca-studio/web/js/investigation-core.js",
    "repositories/cca-studio/web/js/investigation-policy-contracts.js",
    "repositories/cca-studio/web/js/investigation-policy-engine.js",
    "repositories/cca-studio/web/js/investigation-policy-integration.js",
    "repositories/cca-studio/web/js/investigation-policy.js",
    "repositories/cca-studio/web/js/memory-investigation-package.js",
    "repositories/cca-studio/web/js/memoryos-sdk.js",
    "repositories/cca-studio/web/js/mip-canonical.js",
    "repositories/cca-studio/web/js/observation-timeline.js",
    "repositories/cca-studio/web/js/policy-canonical.js",
    "repositories/cca-studio/web/js/policy-fact-context.js",
    "repositories/cca-studio/web/js/regression-policy-fact-source.js",
    "repositories/cca-studio/web/js/semantic-world.js",
    "repositories/cca-studio/web/js/studio-model.js",
    "repositories/memoryos-cli/package.json",
    "repositories/memoryos-cli/src/arguments.js",
    "repositories/memoryos-cli/src/commands.js",
    "repositories/memoryos-cli/src/errors.js",
    "repositories/memoryos-cli/src/help.js",
    "repositories/memoryos-cli/src/main.js",
    "repositories/memoryos-cli/src/output.js",
    "repositories/memoryos-cli/src/policy-arguments.js",
    "repositories/memoryos-cli/src/policy-commands.js",
    "repositories/memoryos-cli/src/policy-publication.js",
    "repositories/memoryos-cli/src/session.js",
    "repositories/memoryos-cli/src/version.js",
)
MO1302_CONTRACT_IDENTITIES = {
    "deterministicFactSourceRegistry": {
        "registryDigest": (
            "sha256:392d688acb866753c6ff85b7030131b38990b27d8a2a0ef6e8e052c8c4e048de"
        ),
        "registryVersion": "1.0.0",
        "sources": [
            {
                "domain": "cognitiveRegression",
                "sourceModelDigest": (
                    "sha256:e7d1fdf24758f2a0ac9ad609df578f95c058bf3cbab9f02a650f9cc12dab1c0d"
                ),
                "sourceModelVersion": "1.0.0",
                "wireVersion": "1.0.0",
            }
        ],
    },
    "evaluatorVersion": "1.0.0",
    "factModel": {
        "factModelDigest": (
            "sha256:b36b9488161cb67d8e971e802d15ad76d662d46f96e1304182de343ba69ef7a8"
        ),
        "factModelVersion": "1.0.0",
    },
    "kind": "MemoryOSPolicyContractIdentities",
    "outcomeContractVersion": "1.0.0",
    "resourceProfile": {
        "identifier": "memoryos.policy.resource-profile.standard",
        "resourceProfileDigest": (
            "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239"
        ),
        "version": "1.0.0",
    },
    "ruleRegistry": {
        "ruleRegistryDigest": (
            "sha256:aaa19116563d209f680b063cdccf49d899069683f9778271c4ca2c4559b94fd7"
        ),
        "ruleRegistryVersion": "1.0.0",
    },
    "version": "1.0.0",
}
MO1302_MANIFEST_ROLES = {
    "actionMetadata",
    "contractData",
    "entrypoint",
    "runtimeModule",
}
MO1302_PORTABLE_MANIFEST_PATH = re.compile(r"^[a-z0-9][a-z0-9._/-]*$")
SHA256_IDENTITY = re.compile(r"^sha256:[0-9a-f]{64}$")


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


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def load_simple_action_metadata(path: Path) -> dict[str, object]:
    """Parse the deliberately simple mapping-only Action metadata subset."""
    text = path.read_text(encoding="utf-8")
    if text.startswith("\ufeff"):
        raise ValueError("Action metadata must not contain a UTF-8 BOM")
    if "\t" in text:
        raise ValueError("Action metadata must not contain tabs")
    if not text.endswith("\n") or text.endswith("\n\n"):
        raise ValueError("Action metadata must end with exactly one LF")

    root: dict[str, object] = {}
    stack: list[tuple[int, dict[str, object]]] = [(-2, root)]
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line:
            raise ValueError(f"blank line at {line_number} is not permitted")
        indentation = len(line) - len(line.lstrip(" "))
        if indentation % 2 != 0:
            raise ValueError(f"indentation at line {line_number} is not two-space aligned")
        body = line[indentation:]
        if body.startswith("#") or ":" not in body:
            raise ValueError(f"line {line_number} is not a simple mapping member")
        key, separator, raw_value = body.partition(":")
        if separator != ":" or not re.fullmatch(r"[a-z][a-z0-9-]*", key):
            raise ValueError(f"line {line_number} has an invalid mapping key")

        while stack[-1][0] >= indentation:
            stack.pop()
        parent_indentation, parent = stack[-1]
        if indentation != parent_indentation + 2:
            raise ValueError(f"line {line_number} skips a mapping level")
        if key in parent:
            raise ValueError(f"line {line_number} duplicates mapping key '{key}'")

        value = raw_value.strip()
        if value == "":
            child: dict[str, object] = {}
            parent[key] = child
            stack.append((indentation, child))
        else:
            parent[key] = value
    return root


def validate_mo1302_action_metadata(root: Path, errors: list[str]) -> None:
    metadata_path = root / MO1302_ACTION_ROOT / "action.yml"
    try:
        metadata = load_simple_action_metadata(metadata_path)
    except (OSError, UnicodeError, ValueError) as exception:
        errors.append(f"invalid MO-1302 Action metadata: {exception}")
        return

    if set(metadata) != {"name", "description", "inputs", "outputs", "runs"}:
        errors.append("MO-1302 Action metadata root does not contain exactly the frozen members")
    if metadata.get("name") != "MemoryOS Deterministic Policy Gate":
        errors.append("MO-1302 Action name differs from the frozen name")
    if metadata.get("description") != (
        "Evaluate and verify a pinned MemoryOS Investigation Policy or Policy Set "
        "against authoritative Memory Investigation Package input."
    ):
        errors.append("MO-1302 Action description differs from the frozen description")

    inputs = metadata.get("inputs")
    if not isinstance(inputs, dict) or set(inputs) != set(MO1302_ACTION_INPUTS):
        errors.append("MO-1302 Action inputs differ from the frozen five-input contract")
    else:
        for input_name in MO1302_ACTION_INPUTS:
            input_contract = inputs.get(input_name)
            expected_members = {"description", "required"}
            expected_required = "true"
            if input_name == "regression-baseline-mip-path":
                expected_members.add("default")
                expected_required = "false"
            if not isinstance(input_contract, dict) or set(input_contract) != expected_members:
                errors.append(f"MO-1302 Action input '{input_name}' has invalid members")
                continue
            if not isinstance(input_contract.get("description"), str):
                errors.append(f"MO-1302 Action input '{input_name}' lacks a description")
            if input_contract.get("required") != expected_required:
                errors.append(f"MO-1302 Action input '{input_name}' has invalid required behavior")
            if input_name == "regression-baseline-mip-path" and input_contract.get(
                "default"
            ) != '""':
                errors.append("MO-1302 optional baseline input must default to the empty string")

    outputs = metadata.get("outputs")
    if not isinstance(outputs, dict) or set(outputs) != set(MO1302_ACTION_OUTPUTS):
        errors.append("MO-1302 Action outputs differ from the frozen nineteen-output contract")
    else:
        for output_name in MO1302_ACTION_OUTPUTS:
            output_contract = outputs.get(output_name)
            if not isinstance(output_contract, dict) or set(output_contract) != {"description"}:
                errors.append(f"MO-1302 Action output '{output_name}' has invalid members")
            elif not isinstance(output_contract.get("description"), str):
                errors.append(f"MO-1302 Action output '{output_name}' lacks a description")

    runs = metadata.get("runs")
    if runs != {"using": "node24", "main": "dist/index.js"}:
        errors.append("MO-1302 Action runs contract must be exactly node24/dist/index.js")


def is_reparse_or_symlink(path: Path) -> bool:
    status = path.lstat()
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    return path.is_symlink() or bool(getattr(status, "st_file_attributes", 0) & reparse_flag)


def enumerate_action_tree(action_root: Path, errors: list[str]) -> set[str]:
    members: set[str] = set()
    try:
        if is_reparse_or_symlink(action_root) or not action_root.is_dir():
            errors.append("MO-1302 Action root must be a non-reparse directory")
            return members
    except OSError as exception:
        errors.append(f"invalid MO-1302 Action root: {exception}")
        return members

    for directory, directory_names, file_names in os.walk(action_root, followlinks=False):
        directory_path = Path(directory)
        for name in list(directory_names):
            child = directory_path / name
            try:
                if is_reparse_or_symlink(child) or not child.is_dir():
                    errors.append(
                        "MO-1302 Action tree contains a reparse or non-directory member: "
                        + child.relative_to(action_root).as_posix()
                    )
                    directory_names.remove(name)
            except OSError as exception:
                errors.append(f"invalid MO-1302 Action tree member {child}: {exception}")
                directory_names.remove(name)
        for name in file_names:
            child = directory_path / name
            relative_path = child.relative_to(action_root).as_posix()
            try:
                status = child.lstat()
                if is_reparse_or_symlink(child) or not stat.S_ISREG(status.st_mode):
                    errors.append(
                        "MO-1302 Action tree contains a reparse or non-regular file: "
                        + relative_path
                    )
                    continue
            except OSError as exception:
                errors.append(f"invalid MO-1302 Action tree member {relative_path}: {exception}")
                continue
            members.add(relative_path)
    return members


def validate_mo1302_distribution(root: Path, errors: list[str]) -> None:
    action_root = root / MO1302_ACTION_ROOT
    manifest_path = action_root / "distribution-manifest.json"
    try:
        manifest_bytes = manifest_path.read_bytes()
        if manifest_bytes.startswith(b"\xef\xbb\xbf"):
            raise ValueError("distribution manifest must not contain a UTF-8 BOM")
        manifest = json.loads(manifest_bytes.decode("utf-8"))
        if not isinstance(manifest, dict):
            raise ValueError("distribution manifest root must be an object")
        if canonical_json_bytes(manifest) != manifest_bytes:
            raise ValueError("distribution manifest bytes are not canonical JSON without framing")
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid MO-1302 distribution manifest: {exception}")
        return

    if set(manifest) != {"files", "kind", "version"}:
        errors.append("MO-1302 distribution manifest root is not closed")
    if manifest.get("kind") != "MemoryOSGitHubPolicyGateDistributionManifest":
        errors.append("MO-1302 distribution manifest kind is incorrect")
    if manifest.get("version") != "1.0.0":
        errors.append("MO-1302 distribution manifest version is incorrect")

    direct_roles = {
        "action.yml": "actionMetadata",
        "dist/action-runtime.mjs": "runtimeModule",
        "dist/cli-driver.mjs": "runtimeModule",
        "dist/contracts/policy-contract-identities-1.0.0.json": "contractData",
        "dist/index.js": "entrypoint",
    }
    expected_roles = dict(direct_roles)
    expected_roles.update(
        {f"dist/vendor/{source}": "runtimeModule" for source in MO1302_VENDOR_SOURCES}
    )

    entries = manifest.get("files")
    actual_paths: list[str] = []
    actual_roles: dict[str, str] = {}
    if not isinstance(entries, list):
        errors.append("MO-1302 distribution manifest files must be an array")
        entries = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {
            "byteCount",
            "path",
            "rawSha256",
            "role",
        }:
            errors.append(f"MO-1302 distribution entry {index} is not closed")
            continue
        relative_path = entry.get("path")
        byte_count = entry.get("byteCount")
        raw_digest = entry.get("rawSha256")
        role = entry.get("role")
        if (
            not isinstance(relative_path, str)
            or not MO1302_PORTABLE_MANIFEST_PATH.fullmatch(relative_path)
            or "//" in relative_path
            or any(part in {".", ".."} for part in relative_path.split("/"))
        ):
            errors.append(f"MO-1302 distribution entry {index} has an invalid path")
            continue
        actual_paths.append(relative_path)
        if type(byte_count) is not int or not 1 <= byte_count <= 9_007_199_254_740_991:
            errors.append(f"MO-1302 distribution entry '{relative_path}' has invalid byteCount")
        if not isinstance(raw_digest, str) or not SHA256_IDENTITY.fullmatch(raw_digest):
            errors.append(f"MO-1302 distribution entry '{relative_path}' has invalid rawSha256")
        if not isinstance(role, str) or role not in MO1302_MANIFEST_ROLES:
            errors.append(f"MO-1302 distribution entry '{relative_path}' has invalid role")
        else:
            actual_roles[relative_path] = role

        member = action_root.joinpath(*relative_path.split("/"))
        try:
            member_bytes = member.read_bytes()
            if len(member_bytes) != byte_count:
                errors.append(f"MO-1302 distribution member '{relative_path}' byte count changed")
            if f"sha256:{sha256(member_bytes)}" != raw_digest:
                errors.append(f"MO-1302 distribution member '{relative_path}' digest changed")
        except OSError as exception:
            errors.append(f"missing MO-1302 distribution member '{relative_path}': {exception}")

    if actual_paths != sorted(actual_paths):
        errors.append("MO-1302 distribution entries are not ASCII path ordered")
    if len(actual_paths) != len(set(actual_paths)):
        errors.append("MO-1302 distribution entries contain duplicate paths")
    if set(actual_paths) != set(expected_roles):
        missing = sorted(set(expected_roles) - set(actual_paths))
        unexpected = sorted(set(actual_paths) - set(expected_roles))
        if missing:
            errors.append("MO-1302 distribution manifest lacks reviewed members: " + ", ".join(missing))
        if unexpected:
            errors.append(
                "MO-1302 distribution manifest has unreviewed members: "
                + ", ".join(unexpected)
            )
    for relative_path, expected_role in expected_roles.items():
        if actual_roles.get(relative_path) != expected_role:
            errors.append(
                f"MO-1302 distribution member '{relative_path}' must use role '{expected_role}'"
            )
    if list(actual_roles.values()).count("actionMetadata") != 1:
        errors.append("MO-1302 distribution must have exactly one actionMetadata member")
    if list(actual_roles.values()).count("entrypoint") != 1:
        errors.append("MO-1302 distribution must have exactly one entrypoint member")

    tree_members = enumerate_action_tree(action_root, errors)
    expected_tree_members = set(actual_paths) | {"distribution-manifest.json"}
    if tree_members != expected_tree_members:
        unlisted = sorted(tree_members - expected_tree_members)
        absent = sorted(expected_tree_members - tree_members)
        if unlisted:
            errors.append("MO-1302 Action root contains unlisted production files: " + ", ".join(unlisted))
        if absent:
            errors.append("MO-1302 Action root lacks listed production files: " + ", ".join(absent))

    for source in MO1302_VENDOR_SOURCES:
        original = root.joinpath(*source.split("/"))
        vendored = action_root.joinpath("dist", "vendor", *source.split("/"))
        try:
            if original.read_bytes() != vendored.read_bytes():
                errors.append(f"MO-1302 vendored runtime source differs from '{source}'")
        except OSError as exception:
            errors.append(f"invalid MO-1302 vendored runtime source '{source}': {exception}")


def validate_mo1302_contracts_and_registration(root: Path, errors: list[str]) -> None:
    schema_root = root / "repositories" / "cca-conformance" / "schema"
    for filename, expected_identifier in MO1302_SCHEMA_IDENTIFIERS.items():
        try:
            schema = load_json(schema_root / filename)
            if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
                errors.append(f"MO-1302 schema '{filename}' must use JSON Schema Draft 2020-12")
            if schema.get("$id") != expected_identifier:
                errors.append(f"MO-1302 schema '{filename}' has an incorrect identifier")
            if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
                errors.append(f"MO-1302 schema '{filename}' must define a closed object root")
        except (OSError, ValueError, json.JSONDecodeError) as exception:
            errors.append(f"invalid MO-1302 schema '{filename}': {exception}")

    identities_path = (
        root
        / MO1302_ACTION_ROOT
        / "dist"
        / "contracts"
        / "policy-contract-identities-1.0.0.json"
    )
    try:
        identity_bytes = identities_path.read_bytes()
        identities = json.loads(identity_bytes.decode("utf-8"))
        if identities != MO1302_CONTRACT_IDENTITIES:
            errors.append("MO-1302 bundled Policy contract identities changed")
        if canonical_json_bytes(identities) != identity_bytes:
            errors.append("MO-1302 bundled Policy contract identities are not canonical JSON")
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid MO-1302 bundled Policy contract identities: {exception}")

    conformance_root = root / "repositories" / "cca-conformance"
    try:
        package = load_json(conformance_root / "package.json")
        scripts = package.get("scripts")
        if not isinstance(scripts, dict) or scripts.get("test:mo1302-phase1") != (
            "node --test tests/mo1302_action_foundation_conformance_test.mjs"
        ):
            errors.append("MO-1302 Phase-1 npm conformance registration is missing or changed")
    except (OSError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid MO-1302 npm conformance registration: {exception}")

    registration_anchors = {
        conformance_root / "CMakeLists.txt": (
            ("tests/mo1302_action_foundation_conformance_test.mjs", 2),
            ("tests/support/mo1302-action-foundation-support.mjs", 1),
            (
                "tests/fixtures/github-policy-gate/1.0.0/"
                "mo1302-action-foundation-vectors.json",
                1,
            ),
            ("tools/build-mo1302-action-distribution.mjs", 1),
            ('conformance_area STREQUAL "mo1302-phase1"', 2),
        ),
        conformance_root / "tools" / "run-js-conformance.mjs": (
            ('"mo1302_action_foundation_conformance_test.mjs"', 1),
        ),
        root / ".gitattributes": (
            (".github/actions/memoryos-policy-gate/**/*.json -text", 1),
            (
                "repositories/cca-conformance/tests/fixtures/"
                "github-policy-gate/**/*.json -text",
                1,
            ),
            (
                "repositories/cca-conformance/tests/fixtures/"
                "github-policy-gate/**/*.sha256 -text",
                1,
            ),
        ),
    }
    for path, anchors in registration_anchors.items():
        try:
            text = path.read_text(encoding="utf-8")
            for anchor, expected_count in anchors:
                if text.count(anchor) != expected_count:
                    errors.append(
                        f"MO-1302 Phase-1 registration anchor '{anchor}' must occur "
                        f"{expected_count} time(s) in {path.relative_to(root).as_posix()}"
                    )
        except (OSError, UnicodeError) as exception:
            errors.append(f"invalid MO-1302 Phase-1 registration file {path}: {exception}")


def validate_mo1303_registration(root: Path, errors: list[str]) -> None:
    conformance_root = root / "repositories" / "cca-conformance"
    extension_root = root / "repositories" / "memoryos-vscode"
    try:
        package = load_json(conformance_root / "package.json")
        scripts = package.get("scripts")
        if not isinstance(scripts, dict) or scripts.get("test:mo1303-phase1") != (
            "node --test tests/mo1303_phase1_conformance_test.mjs"
        ):
            errors.append("MO-1303 Phase-1 npm conformance registration is missing or changed")
        if not isinstance(scripts, dict) or scripts.get("test:mo1303-phase2") != (
            "node --test tests/mo1303_phase2_conformance_test.mjs"
        ):
            errors.append("MO-1303 Phase-2 npm conformance registration is missing or changed")
    except (OSError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid MO-1303 npm conformance registration: {exception}")

    try:
        inventory = load_json(conformance_root / "mo1303-conformance-inventory.json")
        if inventory.get("kind") != "MemoryOSMO1303ConformanceInventory":
            errors.append("MO-1303 conformance inventory kind is missing or changed")
        if inventory.get("version") != "1.0.0":
            errors.append("MO-1303 conformance inventory version is missing or changed")
        if inventory.get("phase") != "implementationPhase2Of3":
            errors.append("MO-1303 conformance inventory phase is missing or changed")
        if inventory.get("phase1CommitBinding") != {
            "strategy": "postCommitConformanceCommit",
            "status": "bound",
            "revision": "6f99038fd5669ece2af4b1671a8e5f267822d2dd",
        }:
            errors.append("MO-1303 Phase-1 implementation binding is missing or changed")
        if inventory.get("phase2CommitBinding") != {
            "strategy": "postCommitConformanceCommit",
            "status": "pendingCommit",
            "revision": None,
        }:
            errors.append("MO-1303 Phase-2 pending commit binding is missing or changed")
    except (OSError, ValueError, json.JSONDecodeError) as exception:
        errors.append(f"invalid MO-1303 conformance inventory: {exception}")

    registration_anchors = {
        root / "CMakeLists.txt": (
            ("cca_add_workspace_repository(memoryos-vscode)", 1),
        ),
        conformance_root / "CMakeLists.txt": (
            ("mo1303-conformance-inventory.json", 2),
            ("tests/mo1303_phase1_conformance_test.mjs", 2),
            ("tests/mo1303_phase2_conformance_test.mjs", 2),
            ("tests/support/mo1303-conformance-support.mjs", 1),
            ('conformance_area STREQUAL "mo1303-phase1"', 2),
            ('conformance_area STREQUAL "mo1303-phase2"', 2),
        ),
        conformance_root / "tools" / "run-js-conformance.mjs": (
            ('"mo1303_phase1_conformance_test.mjs"', 1),
            ('"mo1303_phase2_conformance_test.mjs"', 1),
        ),
        extension_root / "package.json": (
            ('"memoryos.showContractIdentities"', 1),
            ('"memoryos.preparePolicyArtifact"', 1),
            ('"memoryos.evaluatePolicyArtifact"', 1),
            ('"memoryos.verifyEvaluationIdentity"', 1),
            ('"memoryos.verifyPolicyOutcome"', 1),
        ),
        extension_root / "CMakeLists.txt": (
            ('"${MEMORYOS_VSCODE_NPM_EXECUTABLE}" test -- --test-concurrency=1', 1),
            ("tests/extension_shell_contract.test.mjs", 1),
            ("tests/runtime_foundation.test.mjs", 1),
            ("tests/phase2_product_ux.test.mjs", 1),
            ("NAME memoryos.vscode.runtime", 1),
            ("NAME memoryos.vscode.product", 1),
        ),
    }
    for path, anchors in registration_anchors.items():
        try:
            text = path.read_text(encoding="utf-8")
            for anchor, expected_count in anchors:
                if text.count(anchor) != expected_count:
                    errors.append(
                        f"MO-1303 registration anchor '{anchor}' must occur "
                        f"{expected_count} time(s) in {path.relative_to(root).as_posix()}"
                    )
        except (OSError, UnicodeError) as exception:
            errors.append(f"invalid MO-1303 registration file {path}: {exception}")


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

    validate_mo1302_action_metadata(root, errors)
    validate_mo1302_distribution(root, errors)
    validate_mo1302_contracts_and_registration(root, errors)
    validate_mo1303_registration(root, errors)
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
        if "gtest" not in dependencies:
            errors.append("vcpkg manifest must provide gtest")
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
