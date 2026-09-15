cmake_minimum_required(VERSION 3.28)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(cca_studio VERSION 1.0.0 LANGUAGES CXX)
  include(CTest)
  include(GNUInstallDirs)
  set(CMAKE_CXX_SCAN_FOR_MODULES OFF)
  option(CCA_BUILD_TESTS "Build CCA repository unit tests" "${BUILD_TESTING}")

  if(NOT TARGET cca::memory)
    add_subdirectory(
      "${CMAKE_CURRENT_SOURCE_DIR}/../cca-core"
      "${CMAKE_CURRENT_BINARY_DIR}/cca-core"
    )
  endif()
endif()

option(
  CCA_BUILD_STUDIO_EXAMPLE
  "Build the headless Memory Studio C++ example"
  "${BUILD_TESTING}"
)
option(
  CCA_ENABLE_STUDIO_WEB_TESTS
  "Run the required dependency-free Memory Studio, MIP, adapter, and Investigation Core conformance tests"
  ON
)

add_library(cca_studio STATIC src/memory_studio.cpp)
add_library(cca::studio ALIAS cca_studio)
set_target_properties(cca_studio PROPERTIES OUTPUT_NAME "cca-studio")
target_compile_features(cca_studio PUBLIC cxx_std_23)
target_include_directories(
  cca_studio
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>"
)
target_link_libraries(cca_studio PUBLIC cca::memory)

if(COMMAND cca_configure_target)
  cca_configure_target(cca_studio)
elseif(MSVC)
  target_compile_options(cca_studio PRIVATE /W4 /permissive-)
else()
  target_compile_options(
    cca_studio
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
  )
endif()

add_custom_target(
  cca_studio_web
  SOURCES
    package.json
    scripts/serve.mjs
    web/index.html
    web/benchmark.html
    web/styles.css
    web/assets/cca-mark.svg
    web/data/studio-snapshot.js
    web/js/app.js
    web/js/browser-render-benchmark.js
    web/js/graph.js
    web/js/graph-view-state.js
    web/js/cognitive-trace.js
    web/js/cognitive-replay.js
    web/js/cognitive-evolution.js
    web/js/cognitive-evolution-controller.js
    web/js/cognitive-comparative-reconstruction.js
    web/js/cognitive-comparative-replay.js
    web/js/cognitive-regression.js
    web/js/cognitive-investigation-explorer.js
    web/js/deterministic-sequence-alignment.js
    web/js/mip-canonical.js
    web/js/policy-canonical.js
    web/js/investigation-policy-contracts.js
    web/js/investigation-policy.js
    web/js/policy-fact-context.js
    web/js/regression-policy-fact-source.js
    web/js/investigation-policy-engine.js
    web/js/memory-investigation-package.js
    web/js/investigation-core.js
    web/js/memoryos-sdk.js
    web/js/ai-runtime-adapter.js
    web/js/adapters/openai-agents-sdk-adapter.js
    web/js/adapters/anthropic-sdk-adapter.js
    web/js/adapters/langgraph-adapter.js
    web/data/investigation-policy/1.0.0/memoryos-policy-resource-profile-standard-1.0.0.json
    web/data/investigation-policy/1.0.0/definition-manifest.json
    web/data/investigation-policy/1.0.0/definitions/memoryos-policy-fact-model-definition-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/parameter-schema-require-verification-completed-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/parameter-schema-require-replay-completed-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/parameter-schema-require-artifact-cardinality-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/parameter-schema-require-lifecycle-state-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/parameter-schema-prohibit-regression-findings-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/parameter-schema-require-mip-integrity-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/rule-model-require-verification-completed-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/rule-model-require-replay-completed-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/rule-model-require-artifact-cardinality-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/rule-model-require-lifecycle-state-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/rule-model-prohibit-regression-findings-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/rule-model-require-mip-integrity-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/rule-registry-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/regression-policy-fact-source-model-1.0.0.json
    web/data/investigation-policy/1.0.0/definitions/deterministic-fact-source-registry-1.0.0.json
    scripts/generate-ai-runtime-adapter-fixtures.mjs
    examples/ai_runtime_adapter_usage.mjs
    examples/investigation_core_usage.mjs
    examples/cognitive_investigation_explorer_usage.mjs
    docs/investigation-core.md
    docs/investigation-core-conformance-evidence.md
    docs/cognitive-regression.md
    docs/cognitive-regression-engineering-guide.md
    docs/cognitive-regression-conformance-report.md
    docs/schemas/cognitive-regression-report-1.0.schema.json
    docs/cognitive-investigation-explorer.md
    docs/cognitive-investigation-explorer-engineering-guide.md
    docs/cognitive-investigation-explorer-architecture-review.md
    docs/cognitive-investigation-explorer-conformance-report.md
    docs/schemas/cognitive-investigation-result-1.0.schema.json
    tests/investigation_core_test.mjs
    tests/memoryos_sdk_test.mjs
    tests/cognitive_regression_test.mjs
    tests/cognitive_investigation_explorer_test.mjs
    tests/policy_canonical_test.mjs
    tests/investigation_policy_contracts_test.mjs
    tests/investigation_policy_test.mjs
    tests/policy_fact_context_test.mjs
    tests/regression_policy_fact_source_test.mjs
    tests/investigation_policy_engine_test.mjs
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0001-b01-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0002-b01-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0003-b01-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0004-b02-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0005-b02-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0006-b02-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0007-b03-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0008-b03-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0009-b03-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0010-b04-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0011-b04-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0012-b04-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0013-b05-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0014-b05-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0015-b06-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0016-b06-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0017-b06-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0018-b07-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0019-b07-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0020-b07-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0021-b08-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0022-b08-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0023-b08-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0024-b09-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0025-b09-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0026-b09-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0027-b10-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0028-b10-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0029-b10-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0030-b11-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0031-b11-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0032-b11-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0033-b12-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0034-b12-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0035-b13-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0036-b13-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0037-b13-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0038-b14-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0039-b14-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0040-b14-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0041-b15-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0042-b15-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0043-b15-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0044-b16-nearest-reachable-below.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0045-b16-exact-candidate.json
    tests/fixtures/investigation-policy/1.0.0/boundary-carriers/0046-b16-first-reachable-above.json
    tests/fixtures/investigation-policy/1.0.0/boundary-v2-ceiling-proofs.json
    tests/fixtures/investigation-policy/1.0.0/boundary-v2-manifest.json
    tests/fixtures/investigation-policy/1.0.0/cache-validation-vectors.json
    tests/fixtures/investigation-policy/1.0.0/final-evaluation-identity-outcome-golden-vectors.json
    tests/fixtures/adapters/README.md
    tests/fixtures/adapters/reference-sources.mjs
    tests/fixtures/adapters/openai-agents.events.json
    tests/fixtures/adapters/openai-agents.output.json
    tests/fixtures/adapters/anthropic.events.json
    tests/fixtures/adapters/langgraph.events.json
    tests/fixtures/adapters/langgraph.output.json
    examples/ai-runtime-adapters/reference-packages/openai-agents-reference.mip
    examples/ai-runtime-adapters/reference-packages/anthropic-reference.mip
    examples/ai-runtime-adapters/reference-packages/langgraph-reference.mip
    benchmarks/memoryos-scalability-fixture.mjs
    benchmarks/memoryos-scalability.mjs
    web/js/host-adapter.js
    web/js/observation-timeline.js
    web/js/semantic-world.js
    web/js/studio-model.js
)

if(CCA_BUILD_STUDIO_EXAMPLE)
  add_executable(cca_memory_studio_example examples/memory_studio_usage.cpp)
  target_compile_features(cca_memory_studio_example PRIVATE cxx_std_23)
  target_link_libraries(cca_memory_studio_example PRIVATE cca::studio)
  if(COMMAND cca_configure_target)
    cca_configure_target(cca_memory_studio_example)
  elseif(MSVC)
    target_compile_options(cca_memory_studio_example PRIVATE /W4 /permissive-)
  else()
    target_compile_options(
      cca_memory_studio_example
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
    )
  endif()
  if(BUILD_TESTING)
    add_test(NAME cca.memory_studio.example COMMAND cca_memory_studio_example)
    set_tests_properties(
      cca.memory_studio.example
      PROPERTIES LABELS "example;memory;studio"
    )
  endif()
endif()

if(BUILD_TESTING AND CCA_BUILD_TESTS)
  if(COMMAND cca_add_google_test)
    cca_add_google_test(
      TARGET cca_memory_studio_tests
      SOURCES tests/memory_studio_test.cpp
      LIBRARIES cca::studio
      LABELS "studio;memory;unit"
    )
    cca_add_google_test(
      TARGET cca_memory_studio_allocation_tests
      SOURCES tests/memory_studio_allocation_failure_test.cpp
      LIBRARIES cca::studio
      LABELS "studio;memory;allocation;unit"
    )
  else()
    find_package(GTest CONFIG REQUIRED)
    foreach(studio_test_target IN ITEMS
            cca_memory_studio_tests cca_memory_studio_allocation_tests)
      if(studio_test_target STREQUAL "cca_memory_studio_tests")
        set(studio_test_source tests/memory_studio_test.cpp)
      else()
        set(studio_test_source tests/memory_studio_allocation_failure_test.cpp)
      endif()
      add_executable("${studio_test_target}" "${studio_test_source}")
      target_compile_features("${studio_test_target}" PRIVATE cxx_std_23)
      target_link_libraries(
        "${studio_test_target}"
        PRIVATE GTest::gtest_main cca::studio
      )
      if(COMMAND cca_configure_target)
        cca_configure_target("${studio_test_target}")
      elseif(MSVC)
        target_compile_options("${studio_test_target}" PRIVATE /W4 /permissive-)
      else()
        target_compile_options(
          "${studio_test_target}"
          PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion
        )
      endif()
      include(GoogleTest)
      gtest_discover_tests(
        "${studio_test_target}"
        DISCOVERY_MODE PRE_TEST
        PROPERTIES LABELS "studio;memory;unit"
      )
    endforeach()
  endif()

  add_test(
    NAME cca.memory_studio.architecture
    COMMAND
      "${CMAKE_COMMAND}"
      "-DCCA_STUDIO_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
      "-DCCA_CORE_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}/../cca-core"
      -P "${CMAKE_CURRENT_SOURCE_DIR}/tests/memory_studio_architecture_test.cmake"
  )
  set_tests_properties(
    cca.memory_studio.architecture
    PROPERTIES LABELS "architecture;studio;memory"
  )

  if(CCA_ENABLE_STUDIO_WEB_TESTS)
    find_program(CCA_NODE_EXECUTABLE NAMES node node.exe)
    if(CCA_NODE_EXECUTABLE)
      add_test(
        NAME cca.memory_studio.web
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/memory_studio_web_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.web
        PROPERTIES LABELS "studio;memory;web;unit"
      )
      add_test(
        NAME cca.memory_studio.integration
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/memory_studio_integration_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.integration
        PROPERTIES LABELS "studio;memory;web;integration"
      )
      add_test(
        NAME cca.memory_studio.mip
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/mip_canonical_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/memory_investigation_package_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/mip_schema_conformance_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/mip_adversarial_conformance_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/mip_ordering_conformance_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/mip_derived_edge_conformance_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/mip_pipeline_conformance_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.mip
        PROPERTIES LABELS "studio;memory;mip;conformance;unit"
      )
      add_test(
        NAME cca.memory_studio.adapters
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/ai_runtime_adapter_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.adapters
        PROPERTIES LABELS "studio;memory;adapter;mip;unit"
      )
      add_test(
        NAME cca.memory_studio.investigation_core
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/investigation_core_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.investigation_core
        PROPERTIES LABELS "studio;memory;investigation;core;unit"
      )
      add_test(
        NAME cca.memory_studio.sdk
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/memoryos_sdk_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.sdk
        PROPERTIES LABELS "studio;memory;sdk;investigation;unit"
      )
      add_test(
        NAME cca.memory_studio.regression
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/cognitive_regression_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.regression
        PROPERTIES LABELS "studio;memory;investigation;regression;unit"
      )
      add_test(
        NAME cca.memory_studio.investigation_explorer
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/cognitive_investigation_explorer_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.investigation_explorer
        PROPERTIES LABELS "studio;memory;investigation;explorer;unit"
      )
      add_test(
        NAME cca.memory_studio.investigation_policy_phase1
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/policy_canonical_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/investigation_policy_contracts_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/investigation_policy_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.investigation_policy_phase1
        PROPERTIES LABELS "studio;memory;policy;phase1;conformance"
      )
      add_test(
        NAME cca.memory_studio.investigation_policy_phase2
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/policy_fact_context_test.mjs"
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/regression_policy_fact_source_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.investigation_policy_phase2
        PROPERTIES LABELS "studio;memory;policy;phase2;conformance"
      )
      add_test(
        NAME cca.memory_studio.investigation_policy_phase3
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/investigation_policy_engine_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.investigation_policy_phase3
        PROPERTIES LABELS "studio;memory;policy;phase3;conformance"
      )
      add_test(
        NAME cca.memory_studio.scalability
        COMMAND
          "${CCA_NODE_EXECUTABLE}" --test
          "${CMAKE_CURRENT_SOURCE_DIR}/tests/memory_studio_scalability_test.mjs"
      )
      set_tests_properties(
        cca.memory_studio.scalability
        PROPERTIES
          LABELS "studio;memory;web;scalability;benchmark"
          TIMEOUT 180
      )
    else()
      message(FATAL_ERROR
        "CCA_ENABLE_STUDIO_WEB_TESTS=ON requires Node.js; disabling the mandatory Memory Studio, MIP, adapter, and Investigation Core conformance suites is not permitted implicitly"
      )
    endif()
  endif()
endif()

install(
  TARGETS cca_studio
  ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  LIBRARY DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}"
)
install(
  FILES include/cca/memory/memory_studio.hpp
  DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}/cca/memory"
)
install(
  DIRECTORY web/
  DESTINATION "${CMAKE_INSTALL_DATADIR}/cca/memory-studio"
)
