cmake_minimum_required(VERSION 3.28)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(memoryos_conformance VERSION 1.0.0 LANGUAGES NONE)
  include(CTest)
  option(CCA_BUILD_TESTS "Build MemoryOS conformance tests" "${BUILD_TESTING}")
endif()

if(NOT DEFINED CMAKE_INSTALL_DATADIR)
  set(CMAKE_INSTALL_DATADIR "share" CACHE PATH "Read-only architecture-independent data")
endif()

option(
  MEMORYOS_ENABLE_CONFORMANCE_SUITE
  "Enable the deterministic MemoryOS Standard conformance suite"
  ON
)

set(memoryos_conformance_sources_list
    package.json
    README.md
    docs/certification-guide.md
    docs/compatibility-guide.md
    docs/conformance-report.md
    docs/mo1301-conformance.md
    docs/mo1302-handoff.md
    docs/mo1302-engineering-conformance.md
    docs/mo1302-github-policy-gate.md
    docs/reference-implementation-guide.md
    docs/versioning-guide.md
    mo1301-conformance-inventory.json
    mo1302-conformance-inventory.json
    mo1303-conformance-inventory.json
    requirements-manifest.json
    review-outcomes.input.json
    schema/conformance-evidence-1.0.schema.json
    schema/conformance-report-1.0.schema.json
    schema/github-policy-gate-automation-failure-1.0.schema.json
    schema/github-policy-gate-distribution-manifest-1.0.schema.json
    schema/github-policy-gate-receipt-1.0.schema.json
    schema/github-policy-gate-test-vector-1.0.schema.json
    schema/independent-assessment-1.0.schema.json
    schema/requirements-manifest-1.0.schema.json
    schema/review-attestations-1.0.schema.json
    tests/boundary_contract_conformance_test.mjs
    tests/component_evidence_conformance_test.mjs
    tests/compatibility_conformance_test.mjs
    tests/coverage_gap_conformance_test.mjs
    tests/independent_assessment_conformance_test.mjs
    tests/mo1301_integration_conformance_test.mjs
    tests/mo1302_action_foundation_conformance_test.mjs
    tests/mo1302_cross_platform_closure_conformance_test.mjs
    tests/mo1302_github_product_conformance_test.mjs
    tests/mo1303_phase1_conformance_test.mjs
    tests/normative_vectors_conformance_test.mjs
    tests/reference_implementation_conformance_test.mjs
    tests/report_conformance_test.mjs
    tests/requirement_selector_catalog_test.mjs
    tests/schema_validation_conformance_test.mjs
    tests/specification_conformance_test.mjs
    tests/support/conformance-support.mjs
    tests/support/mo1301-conformance-support.mjs
    tests/support/mo1302-action-foundation-support.mjs
    tests/support/mo1302-github-product-support.mjs
    tests/support/mo1303-conformance-support.mjs
    tests/fixtures/github-policy-gate/1.0.0/mo1302-action-foundation-vectors.json
    tests/fixtures/github-policy-gate/1.0.0/hosted/cne.memoryos-policy.json
    tests/fixtures/github-policy-gate/1.0.0/hosted/fail.memoryos-policy.json
    tests/fixtures/github-policy-gate/1.0.0/hosted/oracle.json
    tests/fixtures/github-policy-gate/1.0.0/hosted/pass.memoryos-policy.json
    tests/fixtures/investigation-policy/1.0.0/mo1302-handoff-vectors.json
    tools/conformance-report.mjs
    tools/create-review-attestations.mjs
    tools/independent-assessment.mjs
    tools/json-schema-validator.mjs
    tools/build-pinned-manifest.mjs
    tools/build-mo1302-action-distribution.mjs
    tools/mo1302-hosted-evidence.mjs
    tools/mo1302-native-evidence.mjs
    tools/portable-report.mjs
    tools/requirement-selector-catalog.mjs
    tools/run-js-conformance.mjs
    tools/run-reference-evidence.mjs
)
foreach(generated_source IN ITEMS
  evidence/reference-implementation-1.2.1.json
  evidence/reference-implementation-review-1.2.1.json
  reports/reference-implementation-1.2.1.json
  reports/reference-implementation-1.2.1.md
)
  if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${generated_source}")
    list(APPEND memoryos_conformance_sources_list "${generated_source}")
  else()
    message(STATUS "MemoryOS release evidence is not materialized yet: ${generated_source}")
  endif()
endforeach()

if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/manifests")
  file(GLOB memoryos_conformance_manifest_sources
    RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}"
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/manifests/*.json"
  )
  list(APPEND memoryos_conformance_sources_list ${memoryos_conformance_manifest_sources})
else()
  message(STATUS "MemoryOS content-addressed assessment manifests are not materialized yet")
endif()

add_custom_target(
  memoryos_conformance_sources
  SOURCES ${memoryos_conformance_sources_list}
)

if(BUILD_TESTING AND CCA_BUILD_TESTS AND MEMORYOS_ENABLE_CONFORMANCE_SUITE)
  find_program(MEMORYOS_CONFORMANCE_NODE_EXECUTABLE NAMES node node.exe REQUIRED)
  find_package(Python3 3.12 COMPONENTS Interpreter QUIET)

  foreach(conformance_area IN ITEMS
    boundary
    compatibility
    components
    coverage-gap
    independent
    mo1301
    mo1302-phase1
    mo1302-phase2
    mo1302-phase3
    mo1303-phase1
    normative
    reference
    report
    selectors
    schema
    specification
  )
    if(conformance_area STREQUAL "boundary")
      set(conformance_source tests/boundary_contract_conformance_test.mjs)
    elseif(conformance_area STREQUAL "compatibility")
      set(conformance_source tests/compatibility_conformance_test.mjs)
    elseif(conformance_area STREQUAL "components")
      set(conformance_source tests/component_evidence_conformance_test.mjs)
    elseif(conformance_area STREQUAL "coverage-gap")
      set(conformance_source tests/coverage_gap_conformance_test.mjs)
    elseif(conformance_area STREQUAL "independent")
      set(conformance_source tests/independent_assessment_conformance_test.mjs)
    elseif(conformance_area STREQUAL "mo1301")
      set(conformance_source tests/mo1301_integration_conformance_test.mjs)
    elseif(conformance_area STREQUAL "mo1302-phase1")
      set(conformance_source tests/mo1302_action_foundation_conformance_test.mjs)
    elseif(conformance_area STREQUAL "mo1302-phase2")
      set(conformance_source tests/mo1302_github_product_conformance_test.mjs)
    elseif(conformance_area STREQUAL "mo1302-phase3")
      set(conformance_source tests/mo1302_cross_platform_closure_conformance_test.mjs)
    elseif(conformance_area STREQUAL "mo1303-phase1")
      set(conformance_source tests/mo1303_phase1_conformance_test.mjs)
    elseif(conformance_area STREQUAL "normative")
      set(conformance_source tests/normative_vectors_conformance_test.mjs)
    elseif(conformance_area STREQUAL "reference")
      set(conformance_source tests/reference_implementation_conformance_test.mjs)
    elseif(conformance_area STREQUAL "report")
      set(conformance_source tests/report_conformance_test.mjs)
    elseif(conformance_area STREQUAL "selectors")
      set(conformance_source tests/requirement_selector_catalog_test.mjs)
    elseif(conformance_area STREQUAL "schema")
      set(conformance_source tests/schema_validation_conformance_test.mjs)
    else()
      set(conformance_source tests/specification_conformance_test.mjs)
    endif()

    if((conformance_area STREQUAL "boundary" OR conformance_area STREQUAL "mo1301")
       AND NOT Python3_Interpreter_FOUND)
      message(STATUS
        "Python 3.12 is unavailable; the explicit C2 runner must supply Python for the SDK boundary test"
      )
      continue()
    endif()

    add_test(
      NAME memoryos.standard.${conformance_area}
      COMMAND
        "${MEMORYOS_CONFORMANCE_NODE_EXECUTABLE}" --test
        "${CMAKE_CURRENT_SOURCE_DIR}/${conformance_source}"
    )
    set_tests_properties(
      memoryos.standard.${conformance_area}
      PROPERTIES
        LABELS "memoryos-standard;memoryos;standard;conformance;${conformance_area}"
    )
    if(conformance_area STREQUAL "mo1301")
      set_tests_properties(
        memoryos.standard.${conformance_area}
        PROPERTIES LABELS
          "memoryos-standard;memoryos;standard;conformance;memoryos-1.3;mo1301;release-readiness"
      )
    elseif(conformance_area STREQUAL "mo1302-phase1")
      set_tests_properties(
        memoryos.standard.${conformance_area}
        PROPERTIES LABELS
          "memoryos-standard;memoryos;standard;conformance;memoryos-1.3;mo1302;phase1;action"
      )
    elseif(conformance_area STREQUAL "mo1302-phase2")
      set_tests_properties(
        memoryos.standard.${conformance_area}
        PROPERTIES LABELS
          "memoryos-standard;memoryos;standard;conformance;memoryos-1.3;mo1302;phase2;github-product;security"
      )
    elseif(conformance_area STREQUAL "mo1302-phase3")
      set_tests_properties(
        memoryos.standard.${conformance_area}
        PROPERTIES LABELS
          "memoryos-standard;memoryos;standard;conformance;memoryos-1.3;mo1302;phase3;cross-platform;native;closure"
      )
    elseif(conformance_area STREQUAL "mo1303-phase1")
      set_tests_properties(
        memoryos.standard.${conformance_area}
        PROPERTIES LABELS
          "memoryos-standard;memoryos;standard;conformance;memoryos-1.3;mo1303;phase1;vscode;adapter"
      )
    endif()
  endforeach()

  if(Python3_Interpreter_FOUND)
    set_tests_properties(
      memoryos.standard.boundary memoryos.standard.mo1301
      PROPERTIES ENVIRONMENT "MEMORYOS_CONFORMANCE_PYTHON=${Python3_EXECUTABLE}"
    )
  endif()

  # The Runtime Foundation precedes this repository in the workspace build.
  # Reuse its already-built public-behavior test executable instead of creating
  # a second Runtime implementation or private conformance seam.
  if(TARGET cca_core_tests)
    add_test(
      NAME memoryos.standard.runtime.reference
      COMMAND
        "$<TARGET_FILE:cca_core_tests>"
    )
    set_tests_properties(
      memoryos.standard.runtime.reference
      PROPERTIES LABELS "memoryos-standard;memoryos;standard;conformance;runtime;reference"
    )
  else()
    message(STATUS
      "cca_core_tests is unavailable; Runtime reference verification is not registered in this build"
    )
  endif()

  if(TARGET memoryos_sdk_cpp_tests)
    add_test(
      NAME memoryos.standard.sdk.cpp.reference
      COMMAND "$<TARGET_FILE:memoryos_sdk_cpp_tests>"
    )
    set_tests_properties(
      memoryos.standard.sdk.cpp.reference
      PROPERTIES LABELS "memoryos-standard;memoryos;standard;conformance;sdk;cpp;reference"
    )
  endif()

  if(Python3_Interpreter_FOUND)
    add_test(
      NAME memoryos.standard.sdk.python.reference
      COMMAND
        "${Python3_EXECUTABLE}"
        "${CMAKE_CURRENT_SOURCE_DIR}/../cca-sdk/python/tests/test_memoryos_sdk.py"
    )
    set_tests_properties(
      memoryos.standard.sdk.python.reference
      PROPERTIES
        ENVIRONMENT
          "PYTHONPATH=${CMAKE_CURRENT_SOURCE_DIR}/../cca-sdk/python/src;MEMORYOS_NODE=${MEMORYOS_CONFORMANCE_NODE_EXECUTABLE}"
        LABELS "memoryos-standard;memoryos;standard;conformance;sdk;python;reference"
    )
  endif()
endif()

install(
  FILES README.md requirements-manifest.json review-outcomes.input.json package.json
    mo1301-conformance-inventory.json
    mo1302-conformance-inventory.json
    mo1303-conformance-inventory.json
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-conformance"
)
install(
  DIRECTORY docs schema tests tools
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-conformance"
)
install(
  DIRECTORY evidence
  OPTIONAL
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-conformance"
)
install(
  DIRECTORY manifests
  OPTIONAL
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-conformance"
)
install(
  DIRECTORY reports
  OPTIONAL
  DESTINATION "${CMAKE_INSTALL_DATADIR}/memoryos-conformance"
)
