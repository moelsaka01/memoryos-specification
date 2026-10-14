if(NOT DEFINED CCA_CORE_SOURCE_DIR)
  message(FATAL_ERROR "CCA_CORE_SOURCE_DIR is required")
endif()

set(provider_public_header
    "${CCA_CORE_SOURCE_DIR}/include/cca/memory/memory_provider.hpp")
set(provider_implementation
    "${CCA_CORE_SOURCE_DIR}/src/memory/memory_provider.cpp")
set(provider_unit_test
    "${CCA_CORE_SOURCE_DIR}/tests/memory_provider_test.cpp")
set(provider_allocation_test
    "${CCA_CORE_SOURCE_DIR}/tests/memory_provider_allocation_failure_test.cpp")
set(provider_documentation
    "${CCA_CORE_SOURCE_DIR}/docs/memory-providers.md")
set(provider_example
    "${CCA_CORE_SOURCE_DIR}/examples/memory_provider_usage.cpp")

foreach(required_file IN ITEMS
        provider_public_header
        provider_implementation
        provider_unit_test
        provider_allocation_test
        provider_documentation
        provider_example)
  if(NOT EXISTS "${${required_file}}")
    message(FATAL_ERROR "Missing Memory Providers evidence: ${${required_file}}")
  endif()
endforeach()

file(READ "${provider_public_header}" provider_public_text)
file(READ "${provider_implementation}" provider_implementation_text)
file(READ "${provider_unit_test}" provider_unit_test_text)
file(READ "${provider_allocation_test}" provider_allocation_test_text)
file(READ "${provider_documentation}" provider_documentation_text)
file(READ "${provider_example}" provider_example_text)
file(READ "${CMAKE_CURRENT_LIST_FILE}" provider_architecture_text)

string(TOLOWER "${provider_public_text}" provider_public_lower)
string(TOLOWER "${provider_implementation_text}" provider_implementation_lower)
string(TOLOWER "${provider_documentation_text}" provider_documentation_lower)
string(TOLOWER "${provider_example_text}" provider_example_lower)
string(REGEX REPLACE "[ \t\r\n]+" " " provider_public_normalized
       "${provider_public_text}")
string(REGEX REPLACE "[ \t\r\n]+" " " provider_implementation_normalized
       "${provider_implementation_text}")
string(REGEX REPLACE "[ \t\r\n]+" " " provider_example_normalized
       "${provider_example_text}")
set(provider_production_text
    "${provider_public_text}\n${provider_implementation_text}")
set(provider_production_lower
    "${provider_public_lower}\n${provider_implementation_lower}")

# CCA-PROVIDERS-003 and CCA-PROVIDERS-004: exact Assets and Service.
foreach(required_class IN ITEMS
        ProviderDescriptor
        ProviderRequest
        ProviderResult
        ProviderSession
        MemoryProviderEngine)
  string(REGEX MATCHALL
         "class[ \t\r\n]+${required_class}[ \t\r\n]*\\{"
         class_matches "${provider_public_text}")
  list(LENGTH class_matches class_match_count)
  if(NOT class_match_count EQUAL 1)
    message(FATAL_ERROR
            "Public Memory Providers class must appear exactly once: ${required_class}")
  endif()
endforeach()

# API-013-HPP is a closed public surface. Strip comments and normalize only
# whitespace before comparing each public section with the frozen declaration.
# Private representation remains implementation-defined.
set(provider_public_declarations "${provider_public_text}")
string(REGEX REPLACE "//[^\r\n]*" "" provider_public_declarations
       "${provider_public_declarations}")
string(REGEX REPLACE "/\\*([^*]|\\*+[^*/])*\\*+/" ""
       provider_public_declarations "${provider_public_declarations}")
string(REGEX REPLACE "[ \t\r\n]+" " " provider_public_declarations
       "${provider_public_declarations}")

# At namespace scope the frozen header contains exactly the five class
# definitions. Counting namespace-level blocks and terminating semicolons also
# rejects added free functions, variables, aliases, forward declarations,
# enums, structs, unions, or nested namespaces while allowing private helpers.
string(LENGTH "${provider_public_declarations}" provider_header_length)
set(provider_brace_depth 0)
set(provider_namespace_block_count 0)
set(provider_top_level_block_count 0)
set(provider_top_level_semicolon_count 0)
set(provider_character_index 0)
while(provider_character_index LESS provider_header_length)
  string(SUBSTRING "${provider_public_declarations}"
         ${provider_character_index} 1 provider_character)
  if(provider_character STREQUAL "{")
    if(provider_brace_depth EQUAL 0)
      math(EXPR provider_namespace_block_count
           "${provider_namespace_block_count} + 1")
    elseif(provider_brace_depth EQUAL 1)
      math(EXPR provider_top_level_block_count
           "${provider_top_level_block_count} + 1")
    endif()
    math(EXPR provider_brace_depth "${provider_brace_depth} + 1")
  elseif(provider_character STREQUAL "}")
    math(EXPR provider_brace_depth "${provider_brace_depth} - 1")
    if(provider_brace_depth LESS 0)
      message(FATAL_ERROR "Memory Providers public header has unbalanced braces")
    endif()
  elseif(provider_character STREQUAL ";" AND provider_brace_depth EQUAL 1)
    math(EXPR provider_top_level_semicolon_count
         "${provider_top_level_semicolon_count} + 1")
  endif()
  math(EXPR provider_character_index "${provider_character_index} + 1")
endwhile()
if(NOT provider_brace_depth EQUAL 0 OR
   NOT provider_namespace_block_count EQUAL 1 OR
   NOT provider_top_level_block_count EQUAL 5 OR
   NOT provider_top_level_semicolon_count EQUAL 5)
  message(FATAL_ERROR
          "Memory Providers public header contains an undocumented namespace-level declaration")
endif()

function(assert_provider_public_surface class_name expected_public_surface)
  string(FIND "${provider_public_declarations}" "class ${class_name} {"
         provider_class_position)
  if(provider_class_position EQUAL -1)
    message(FATAL_ERROR "Unable to inspect public surface: ${class_name}")
  endif()

  string(SUBSTRING "${provider_public_declarations}"
         ${provider_class_position} -1 provider_class_tail)
  string(REGEX MATCHALL "public[ ]*:" provider_public_labels
         "${provider_class_tail}")
  # Restrict the label count to this class by cutting at the next namespace-
  # level class marker below; exact member comparison catches nested labels.
  set(provider_next_class_position -1)
  foreach(provider_candidate IN ITEMS
          ProviderDescriptor ProviderRequest ProviderSession ProviderResult
          MemoryProviderEngine)
    if(provider_candidate STREQUAL class_name)
      continue()
    endif()
    string(FIND "${provider_class_tail}" "class ${provider_candidate} {"
           provider_candidate_position)
    if(provider_candidate_position GREATER 0 AND
       (provider_next_class_position EQUAL -1 OR
        provider_candidate_position LESS provider_next_class_position))
      set(provider_next_class_position ${provider_candidate_position})
    endif()
  endforeach()
  if(provider_next_class_position GREATER 0)
    string(SUBSTRING "${provider_class_tail}" 0
           ${provider_next_class_position} provider_class_text)
  else()
    set(provider_class_text "${provider_class_tail}")
  endif()

  string(REGEX MATCHALL "public[ ]*:" provider_public_labels
         "${provider_class_text}")
  list(LENGTH provider_public_labels provider_public_label_count)
  if(NOT provider_public_label_count EQUAL 1)
    message(FATAL_ERROR
            "${class_name} must contain exactly one frozen public section")
  endif()
  string(REGEX MATCH "protected[ ]*:" provider_protected_label
         "${provider_class_text}")
  if(NOT "${provider_protected_label}" STREQUAL "")
    message(FATAL_ERROR
            "${class_name} exposes an undocumented protected surface")
  endif()

  string(FIND "${provider_class_text}" "public:" provider_public_position)
  math(EXPR provider_public_start "${provider_public_position} + 7")
  string(FIND "${provider_class_text}" "private:" provider_private_position)
  if(provider_private_position GREATER provider_public_start)
    math(EXPR provider_public_length
         "${provider_private_position} - ${provider_public_start}")
  else()
    string(SUBSTRING "${provider_class_text}" ${provider_public_start} -1
           provider_public_tail)
    string(FIND "${provider_public_tail}" "};" provider_class_close)
    if(provider_class_close EQUAL -1)
      message(FATAL_ERROR "Unable to find public class close: ${class_name}")
    endif()
    set(provider_public_length ${provider_class_close})
  endif()
  string(SUBSTRING "${provider_class_text}" ${provider_public_start}
         ${provider_public_length} provider_actual_public_surface)
  string(REGEX REPLACE "[ \t\r\n]+" "" provider_actual_public_surface
         "${provider_actual_public_surface}")
  string(REGEX REPLACE "[ \t\r\n]+" "" provider_expected_public_surface
         "${expected_public_surface}")
  if(NOT provider_actual_public_surface STREQUAL
         provider_expected_public_surface)
    message(FATAL_ERROR
            "${class_name} public surface differs from frozen API-013-HPP")
  endif()
endfunction()

assert_provider_public_surface(ProviderDescriptor [=[
  ProviderDescriptor(std::string workspaceIdentifier,
                     std::string identifier);
  ~ProviderDescriptor();
  ProviderDescriptor(const ProviderDescriptor&);
  ProviderDescriptor& operator=(const ProviderDescriptor&);
  ProviderDescriptor(ProviderDescriptor&&) noexcept;
  ProviderDescriptor& operator=(ProviderDescriptor&&) noexcept;
  const std::string& workspaceIdentifier() const noexcept;
  const std::string& identifier() const noexcept;
]=])
assert_provider_public_surface(ProviderRequest [=[
  ProviderRequest(std::string workspaceIdentifier,
                  std::string providerIdentifier,
                  const Memory& memory,
                  const WorkingMemory& workingMemory,
                  const LongTermMemory& longTermMemory,
                  const SemanticMemory& semanticMemory,
                  const EpisodicMemory& episodicMemory,
                  const ProceduralMemory& proceduralMemory,
                  std::vector<Reflection> reflections = {});
  ~ProviderRequest();
  ProviderRequest(const ProviderRequest&);
  ProviderRequest& operator=(const ProviderRequest&);
  ProviderRequest(ProviderRequest&&) noexcept;
  ProviderRequest& operator=(ProviderRequest&&) noexcept;
  const std::string& workspaceIdentifier() const noexcept;
  const std::string& providerIdentifier() const noexcept;
  const Memory* memory() const noexcept;
  const WorkingMemory* workingMemory() const noexcept;
  const LongTermMemory* longTermMemory() const noexcept;
  const SemanticMemory* semanticMemory() const noexcept;
  const EpisodicMemory* episodicMemory() const noexcept;
  const ProceduralMemory* proceduralMemory() const noexcept;
  const std::vector<Reflection>& reflections() const noexcept;
]=])
assert_provider_public_surface(ProviderSession [=[
  enum class State { Open, Exported, Imported, Forgotten };
  explicit ProviderSession(std::string workspaceIdentifier);
  ~ProviderSession();
  ProviderSession(const ProviderSession&);
  ProviderSession& operator=(const ProviderSession&) = delete;
  ProviderSession(ProviderSession&&) noexcept;
  ProviderSession& operator=(ProviderSession&&) noexcept = delete;
  const std::string& workspaceIdentifier() const noexcept;
  State state() const noexcept;
  std::size_t size() const noexcept;
  const std::vector<ProviderDescriptor>& descriptors() const noexcept;
]=])
assert_provider_public_surface(ProviderResult [=[
  ProviderResult(ProviderResult&&) noexcept;
  ProviderResult& operator=(ProviderResult&&) noexcept;
  ProviderResult(const ProviderResult&) = delete;
  ProviderResult& operator=(const ProviderResult&) = delete;
  ~ProviderResult();
  const std::string& workspaceIdentifier() const noexcept;
  bool succeeded() const noexcept;
  const std::string& code() const noexcept;
  const std::string& message() const noexcept;
  const ProviderRequest* request() const noexcept;
  const std::vector<ProviderDescriptor>& descriptors() const noexcept;
]=])
assert_provider_public_surface(MemoryProviderEngine [=[
  ProviderResult registerProvider(ProviderSession& session,
                                  const ProviderDescriptor& descriptor) const;
  ProviderResult exportState(ProviderSession& session,
                             const ProviderRequest& request) const;
  ProviderResult importState(ProviderSession& session,
                             const ProviderRequest& request) const;
  ProviderResult validate(const ProviderSession& session,
                          const ProviderRequest& request) const;
  ProviderResult enumerate(const ProviderSession& session) const;
  ProviderResult forgetSession(ProviderSession& session) const;
]=])

string(REGEX MATCH
       "class[ \t\r\n]+MemoryProviderEngine[ \t\r\n]*\\{([^}]*)\\}[ \t\r\n]*;"
       provider_engine_match "${provider_public_text}")
if("${provider_engine_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect MemoryProviderEngine")
endif()
set(provider_engine_body "${CMAKE_MATCH_1}")
string(REGEX MATCHALL
       "ProviderResult[ \t\r\n]+[A-Za-z_][A-Za-z0-9_]*[ \t\r\n]*\\("
       provider_operations "${provider_engine_body}")
list(LENGTH provider_operations provider_operation_count)
if(NOT provider_operation_count EQUAL 6)
  message(FATAL_ERROR "MemoryProviderEngine must expose exactly six operations")
endif()
foreach(required_operation IN ITEMS
        registerProvider exportState importState validate enumerate forgetSession)
  string(REGEX MATCHALL "${required_operation}[ \t\r\n]*\\("
         operation_matches "${provider_engine_body}")
  list(LENGTH operation_matches operation_match_count)
  if(NOT operation_match_count EQUAL 1)
    message(FATAL_ERROR
            "MemoryProviderEngine operation must appear exactly once: ${required_operation}")
  endif()
endforeach()
foreach(forbidden_keyword_member IN ITEMS register export import)
  string(REGEX MATCH
         "ProviderResult[ \t\r\n]+${forbidden_keyword_member}[ \t\r\n]*\\("
         forbidden_keyword_match "${provider_engine_body}")
  if(NOT "${forbidden_keyword_match}" STREQUAL "")
    message(FATAL_ERROR
            "Reserved/logical name leaked into C++ API: ${forbidden_keyword_member}")
  endif()
endforeach()

# API-013-HPP exact lifecycle, Workspace observation, and value restrictions.
string(REGEX MATCH
       "enum[ \t\r\n]+class[ \t\r\n]+State[ \t\r\n]*\\{([^}]*)\\}"
       provider_state_match "${provider_public_text}")
if("${provider_state_match}" STREQUAL "")
  message(FATAL_ERROR "ProviderSession::State is absent")
endif()
string(REGEX REPLACE "[ \t\r\n]+" "" provider_state_compact
       "${CMAKE_MATCH_1}")
if(NOT provider_state_compact STREQUAL "Open,Exported,Imported,Forgotten")
  message(FATAL_ERROR "ProviderSession::State does not match API-013-HPP")
endif()

set(required_public_fragments
    "ProviderDescriptor(std::string workspaceIdentifier, std::string identifier)"
    "ProviderDescriptor(const ProviderDescriptor&)"
    "ProviderDescriptor& operator=(const ProviderDescriptor&)"
    "ProviderDescriptor(ProviderDescriptor&&) noexcept"
    "ProviderRequest(std::string workspaceIdentifier, std::string providerIdentifier, const Memory& memory, const WorkingMemory& workingMemory, const LongTermMemory& longTermMemory, const SemanticMemory& semanticMemory, const EpisodicMemory& episodicMemory, const ProceduralMemory& proceduralMemory, std::vector<Reflection> reflections = {})"
    "ProviderRequest(const ProviderRequest&)"
    "ProviderRequest& operator=(const ProviderRequest&)"
    "ProviderRequest(ProviderRequest&&) noexcept"
    "explicit ProviderSession(std::string workspaceIdentifier)"
    "ProviderSession(const ProviderSession&)"
    "ProviderSession& operator=(const ProviderSession&) = delete"
    "ProviderSession(ProviderSession&&) noexcept"
    "ProviderSession& operator=(ProviderSession&&) noexcept = delete"
    "ProviderResult(const ProviderResult&) = delete"
    "ProviderResult& operator=(const ProviderResult&) = delete"
    "ProviderResult(ProviderResult&&) noexcept"
    "const std::string& workspaceIdentifier() const noexcept"
    "const std::string& identifier() const noexcept"
    "const std::string& providerIdentifier() const noexcept"
    "const ProviderRequest* request() const noexcept"
    "bool succeeded() const noexcept"
    "const std::vector<ProviderDescriptor>& descriptors() const noexcept"
    "const std::vector<Reflection>& reflections() const noexcept")
foreach(required_fragment IN LISTS required_public_fragments)
  string(FIND "${provider_public_normalized}" "${required_fragment}"
         required_fragment_position)
  if(required_fragment_position EQUAL -1)
    message(FATAL_ERROR
            "API-013-HPP declaration is absent: ${required_fragment}")
  endif()
endforeach()

set(required_engine_signatures
    "ProviderResult registerProvider(ProviderSession& session, const ProviderDescriptor& descriptor) const"
    "ProviderResult exportState(ProviderSession& session, const ProviderRequest& request) const"
    "ProviderResult importState(ProviderSession& session, const ProviderRequest& request) const"
    "ProviderResult validate(const ProviderSession& session, const ProviderRequest& request) const"
    "ProviderResult enumerate(const ProviderSession& session) const"
    "ProviderResult forgetSession(ProviderSession& session) const")
foreach(required_signature IN LISTS required_engine_signatures)
  string(FIND "${provider_public_normalized}" "${required_signature}"
         required_signature_position)
  if(required_signature_position EQUAL -1)
    message(FATAL_ERROR
            "API-013-HPP operation signature is absent: ${required_signature}")
  endif()
endforeach()

# CCA-PROVIDERS-005 and CCA-PROVIDERS-040: released-public-only dependency.
set(required_public_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/memory/long_term_memory.hpp"
    "cca/memory/semantic_memory.hpp"
    "cca/memory/episodic_memory.hpp"
    "cca/memory/procedural_memory.hpp"
    "cca/memory/memory_reflection.hpp")
string(REGEX MATCHALL "#include[ \t]+<cca/[^>]+>"
       provider_cca_includes "${provider_public_lower}")
list(LENGTH provider_cca_includes provider_cca_include_count)
if(NOT provider_cca_include_count EQUAL 7)
  message(FATAL_ERROR
          "Memory Providers public Contract must have exactly seven CCA dependencies")
endif()
foreach(required_dependency IN LISTS required_public_dependencies)
  string(FIND "${provider_public_lower}" "#include <${required_dependency}>"
         required_dependency_position)
  if(required_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Required released dependency is absent: ${required_dependency}")
  endif()
endforeach()

set(forbidden_dependencies
    "cca/persistence/"
    "cca/process/"
    "cca/representation/"
    "cca/runtime/"
    "_persistence.hpp"
    "src/memory/"
    "<filesystem>"
    "<fstream>"
    "<thread>"
    "<chrono>")
foreach(forbidden_dependency IN LISTS forbidden_dependencies)
  string(FIND "${provider_production_lower}" "${forbidden_dependency}"
         forbidden_dependency_position)
  if(NOT forbidden_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Providers has forbidden production dependency: ${forbidden_dependency}")
  endif()
endforeach()

# CP-010 copies released values; it never invokes released behavior.
foreach(forbidden_engine IN ITEMS
        MemoryEngine
        WorkingMemoryEngine
        LongTermMemoryEngine
        SemanticMemoryEngine
        EpisodicMemoryEngine
        ProceduralMemoryEngine
        MemoryRetrievalEngine
        MemoryConsolidationEngine
        MemoryReflectionEngine)
  string(FIND "${provider_implementation_text}" "${forbidden_engine}"
         forbidden_engine_position)
  if(NOT forbidden_engine_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Providers invokes forbidden released Service: ${forbidden_engine}")
  endif()
endforeach()
foreach(forbidden_call IN ITEMS
        ".store(" ".retain(" ".activate(" ".expire(" ".archive("
        ".restore(" ".classify(" ".categorize(" ".record(" ".derive("
        ".compose(" ".retrieve(" ".search(" ".rank(" ".reflect("
        ".consolidate(" ".forget(")
  string(FIND "${provider_implementation_normalized}" "${forbidden_call}"
         forbidden_call_position)
  if(NOT forbidden_call_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Providers contains forbidden semantic call: ${forbidden_call}")
  endif()
endforeach()

# No released production file may acquire a reverse CP-010 dependency.
file(GLOB released_memory_production_files
     "${CCA_CORE_SOURCE_DIR}/include/cca/memory/*.hpp"
     "${CCA_CORE_SOURCE_DIR}/src/memory/*.hpp"
     "${CCA_CORE_SOURCE_DIR}/src/memory/*.cpp")
foreach(released_file IN LISTS released_memory_production_files)
  if(released_file STREQUAL provider_public_header OR
     released_file STREQUAL provider_implementation)
    continue()
  endif()
  file(READ "${released_file}" released_file_text)
  foreach(reverse_token IN ITEMS
          "memory_provider.hpp"
          "ProviderDescriptor"
          "ProviderRequest"
          "ProviderResult"
          "ProviderSession"
          "MemoryProviderEngine")
    string(FIND "${released_file_text}" "${reverse_token}"
           reverse_token_position)
    if(NOT reverse_token_position EQUAL -1)
      message(FATAL_ERROR
              "Released source acquired reverse CP-010 dependency: ${released_file}")
    endif()
  endforeach()
endforeach()

# CCA-PROVIDERS-037, 038, 041, and 042: no infrastructure or hidden behavior.
file(GLOB provider_persistence_files
     "${CCA_CORE_SOURCE_DIR}/src/memory/memory_provider*persistence*"
     "${CCA_CORE_SOURCE_DIR}/include/cca/memory/memory_provider*persistence*")
if(provider_persistence_files)
  message(FATAL_ERROR "Memory Providers must not add a Persistence mapping")
endif()

set(forbidden_production_tokens
    "PersistenceEngine"
    "PersistencePackage"
    "PersistenceFormat"
    "RuntimeContext"
    "RuntimeState"
    "ServiceRegistry"
    "DependencyInjector"
    "EventBus"
    "std::filesystem"
    "std::fstream"
    "std::ifstream"
    "std::ofstream"
    "thread_local"
    "system_clock"
    "steady_clock"
    "random_device"
    "sqlite"
    "socket("
    "connect("
    "serialize("
    "deserialize("
    "dlopen("
    "LoadLibrary("
    "MemoryStudio"
    "PlanningEngine"
    "SimulationEngine"
    "WorkflowEngine"
    "Scheduler")
foreach(forbidden_token IN LISTS forbidden_production_tokens)
  string(FIND "${provider_production_text}" "${forbidden_token}"
         forbidden_token_position)
  if(NOT forbidden_token_position EQUAL -1)
    message(FATAL_ERROR
            "Forbidden Memory Providers production token: ${forbidden_token}")
  endif()
endforeach()

string(REGEX MATCHALL "#include[ \t]+[<\"][^>\"\r\n]+[>\"]"
       provider_production_includes "${provider_production_lower}")
foreach(production_include IN LISTS provider_production_includes)
  foreach(infrastructure_term IN ITEMS
          database sqlite socket network cloud filesystem fstream compression
          encryption credential plugin serialization)
    string(FIND "${production_include}" "${infrastructure_term}"
           infrastructure_term_position)
    if(NOT infrastructure_term_position EQUAL -1)
      message(FATAL_ERROR
              "Provider-specific infrastructure include: ${production_include}")
    endif()
  endforeach()
endforeach()

# CCA-PROVIDERS-043: the public example uses all operations and authentic CP-009.
foreach(example_operation IN ITEMS
        registerProvider exportState importState validate enumerate forgetSession)
  string(FIND "${provider_example_normalized}" ".${example_operation}("
         example_operation_position)
  if(example_operation_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Providers example omits operation: ${example_operation}")
  endif()
endforeach()
foreach(authentic_reflection_token IN ITEMS
        "MemoryRetrievalEngine"
        "MemoryReflectionEngine"
        ".search("
        ".rank("
        ".reflect("
        ".derive("
        "reflected.reflection()")
  string(FIND "${provider_example_text}" "${authentic_reflection_token}"
         authentic_reflection_position)
  if(authentic_reflection_position EQUAL -1)
    message(FATAL_ERROR
            "Example lacks authentic Reflection evidence: ${authentic_reflection_token}")
  endif()
endforeach()
string(REGEX MATCHALL "#include[ \t]+<cca/[^>]+>"
       provider_example_cca_includes "${provider_example_lower}")
list(LENGTH provider_example_cca_includes provider_example_include_count)
if(NOT provider_example_include_count EQUAL 1)
  message(FATAL_ERROR "Example must include only the CP-010 public CCA header")
endif()
string(FIND "${provider_example_lower}"
       "#include <cca/memory/memory_provider.hpp>" example_header_position)
if(example_header_position EQUAL -1)
  message(FATAL_ERROR "Example does not use the installed CP-010 header")
endif()

# CCA-PROVIDERS-043 through 045: complete traceability evidence.
# Named evidence map:
# CCA-PROVIDERS-001, CCA-PROVIDERS-002, CCA-PROVIDERS-003,
# CCA-PROVIDERS-004, CCA-PROVIDERS-005: constitutional/API/dependency audit.
# CCA-PROVIDERS-006, CCA-PROVIDERS-007, CCA-PROVIDERS-008,
# CCA-PROVIDERS-009, CCA-PROVIDERS-010: value and lifecycle tests.
# CCA-PROVIDERS-011, CCA-PROVIDERS-012: registry scan and fidelity test.
# CCA-PROVIDERS-013, CCA-PROVIDERS-014, CCA-PROVIDERS-015,
# CCA-PROVIDERS-016: complete value comparisons.
# CCA-PROVIDERS-017, CCA-PROVIDERS-018, CCA-PROVIDERS-019:
# Workspace tests and Provider-authority scan.
# CCA-PROVIDERS-020, CCA-PROVIDERS-021: registration tests.
# CCA-PROVIDERS-022, CCA-PROVIDERS-023, CCA-PROVIDERS-024,
# CCA-PROVIDERS-025, CCA-PROVIDERS-026: lifecycle and fidelity tests.
# CCA-PROVIDERS-027, CCA-PROVIDERS-028, CCA-PROVIDERS-029,
# CCA-PROVIDERS-030: Result and precedence tests.
# CCA-PROVIDERS-031: MemoryProviderValueTest.
# CCA-PROVIDERS-032: MemoryProviderAllocationFailureTest campaigns.
# CCA-PROVIDERS-033, CCA-PROVIDERS-034: determinism and concurrency tests.
# CCA-PROVIDERS-035, CCA-PROVIDERS-036: MemoryProviderIsolationTest.
# CCA-PROVIDERS-037, CCA-PROVIDERS-038, CCA-PROVIDERS-039,
# CCA-PROVIDERS-040, CCA-PROVIDERS-041, CCA-PROVIDERS-042: boundary scans.
# CCA-PROVIDERS-043: this guide and the build-checked public example.
# CCA-PROVIDERS-044: unit, allocation, architecture, and example inventory.
# CCA-PROVIDERS-045: this bidirectional map and repository engineering gates.
# Machine-readable requirement manifest for the evidence checks below:
# CCA-PROVIDERS-001 CCA-PROVIDERS-002 CCA-PROVIDERS-003
# CCA-PROVIDERS-004 CCA-PROVIDERS-005 CCA-PROVIDERS-006
# CCA-PROVIDERS-007 CCA-PROVIDERS-008 CCA-PROVIDERS-009
# CCA-PROVIDERS-010 CCA-PROVIDERS-011 CCA-PROVIDERS-012
# CCA-PROVIDERS-013 CCA-PROVIDERS-014 CCA-PROVIDERS-015
# CCA-PROVIDERS-016 CCA-PROVIDERS-017 CCA-PROVIDERS-018
# CCA-PROVIDERS-019 CCA-PROVIDERS-020 CCA-PROVIDERS-021
# CCA-PROVIDERS-022 CCA-PROVIDERS-023 CCA-PROVIDERS-024
# CCA-PROVIDERS-025 CCA-PROVIDERS-026 CCA-PROVIDERS-027
# CCA-PROVIDERS-028 CCA-PROVIDERS-029 CCA-PROVIDERS-030
# CCA-PROVIDERS-031 CCA-PROVIDERS-032 CCA-PROVIDERS-033
# CCA-PROVIDERS-034 CCA-PROVIDERS-035 CCA-PROVIDERS-036
# CCA-PROVIDERS-037 CCA-PROVIDERS-038 CCA-PROVIDERS-039
# CCA-PROVIDERS-040 CCA-PROVIDERS-041 CCA-PROVIDERS-042
# CCA-PROVIDERS-043 CCA-PROVIDERS-044 CCA-PROVIDERS-045
set(provider_test_evidence
    "${provider_unit_test_text}\n${provider_allocation_test_text}\n${provider_architecture_text}")
foreach(requirement_number RANGE 1 45)
  if(requirement_number LESS 10)
    set(requirement_suffix "00${requirement_number}")
  else()
    set(requirement_suffix "0${requirement_number}")
  endif()
  set(requirement_id "CCA-PROVIDERS-${requirement_suffix}")
  string(FIND "${provider_documentation_text}" "${requirement_id}"
         documentation_requirement_position)
  if(documentation_requirement_position EQUAL -1)
    message(FATAL_ERROR "Documentation omits requirement: ${requirement_id}")
  endif()
  string(FIND "${provider_test_evidence}" "${requirement_id}"
         test_requirement_position)
  if(test_requirement_position EQUAL -1)
    message(FATAL_ERROR "Automated evidence omits requirement: ${requirement_id}")
  endif()
endforeach()

# All artifacts must be registered under repository C++23 warning gates.
set(core_cmake "${CCA_CORE_SOURCE_DIR}/CMakeLists.txt")
set(test_cmake "${CCA_CORE_SOURCE_DIR}/tests/CMakeLists.txt")
set(workspace_presets "${CCA_CORE_SOURCE_DIR}/../../CMakePresets.json")
foreach(build_file IN ITEMS core_cmake test_cmake workspace_presets)
  if(NOT EXISTS "${${build_file}}")
    message(FATAL_ERROR "Missing build evidence: ${${build_file}}")
  endif()
endforeach()
file(READ "${core_cmake}" core_cmake_text)
file(READ "${test_cmake}" test_cmake_text)
file(READ "${workspace_presets}" workspace_presets_text)
string(TOLOWER "${core_cmake_text}" core_cmake_lower)
string(TOLOWER "${test_cmake_text}" test_cmake_lower)
string(TOLOWER "${workspace_presets_text}" workspace_presets_lower)
string(REGEX REPLACE "[ \t\r\n]+" " " core_cmake_normalized
       "${core_cmake_lower}")
string(REGEX REPLACE "[ \t\r\n]+" " " test_cmake_normalized
       "${test_cmake_lower}")

foreach(core_registration IN ITEMS
        "src/memory/memory_provider.cpp"
        "cca_memory_provider_example"
        "examples/memory_provider_usage.cpp"
        "cca_configure_target(cca_memory_provider_example)"
        "cca.memory_provider.example"
        "example;memory;memory_provider")
  string(FIND "${core_cmake_normalized}" "${core_registration}"
         core_registration_position)
  if(core_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Core build omits Memory Providers registration: ${core_registration}")
  endif()
endforeach()
foreach(test_registration IN ITEMS
        "memory_provider_test.cpp"
        "memory_provider_architecture_test.cmake"
        "cca.memory_provider.architecture"
        "memory_provider_allocation_failure_test.cpp"
        "cca_memory_provider_allocation_tests")
  string(FIND "${test_cmake_normalized}" "${test_registration}"
         test_registration_position)
  if(test_registration_position EQUAL -1)
    message(FATAL_ERROR
            "Test build omits Memory Providers registration: ${test_registration}")
  endif()
endforeach()
string(FIND "${core_cmake_normalized}" "cca_configure_target(cca_memory)"
       memory_warning_gate_position)
if(memory_warning_gate_position EQUAL -1)
  message(FATAL_ERROR "cca_memory is not under repository warning gates")
endif()
string(REGEX MATCH
       "\"cca_warnings_as_errors\"[ \t\r\n]*:[ \t\r\n]*\"on\""
       warnings_as_errors_match "${workspace_presets_lower}")
if("${warnings_as_errors_match}" STREQUAL "")
  message(FATAL_ERROR "Repository CI preset does not enable warnings as errors")
endif()
string(REGEX MATCH "\"cmake_cxx_standard\"[ \t\r\n]*:[ \t\r\n]*\"23\""
       cxx23_match "${workspace_presets_lower}")
if("${cxx23_match}" STREQUAL "")
  message(FATAL_ERROR "Workspace presets do not require C++23")
endif()

message(STATUS "Memory Providers architecture checks passed")
