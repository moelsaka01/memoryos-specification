if(NOT DEFINED CCA_STUDIO_SOURCE_DIR)
  message(FATAL_ERROR "CCA_STUDIO_SOURCE_DIR is required")
endif()

set(studio_public_header
    "${CCA_STUDIO_SOURCE_DIR}/include/cca/memory/memory_studio.hpp")
set(studio_implementation
    "${CCA_STUDIO_SOURCE_DIR}/src/memory_studio.cpp")
set(studio_unit_test
    "${CCA_STUDIO_SOURCE_DIR}/tests/memory_studio_test.cpp")

foreach(required_file IN ITEMS
        studio_public_header studio_implementation studio_unit_test)
  if(NOT EXISTS "${${required_file}}")
    message(FATAL_ERROR "Missing Memory Studio evidence: ${${required_file}}")
  endif()
endforeach()

file(READ "${studio_public_header}" studio_public_text)
file(READ "${studio_implementation}" studio_implementation_text)
file(READ "${studio_unit_test}" studio_unit_test_text)
file(READ "${CMAKE_CURRENT_LIST_FILE}" studio_architecture_text)

set(studio_public_declarations "${studio_public_text}")
set(studio_implementation_declarations "${studio_implementation_text}")
foreach(text_variable IN ITEMS
        studio_public_declarations studio_implementation_declarations)
  string(REGEX REPLACE "//[^\r\n]*" "" ${text_variable}
         "${${text_variable}}")
endforeach()
set(studio_production_declarations
    "${studio_public_declarations}\n${studio_implementation_declarations}")
string(TOLOWER "${studio_public_text}" studio_public_lower)
string(TOLOWER "${studio_implementation_declarations}"
       studio_implementation_lower)
string(TOLOWER "${studio_production_declarations}"
       studio_production_lower)
string(REGEX REPLACE "[ \t\r\n]+" " " studio_public_normalized
       "${studio_public_declarations}")

# API-014-HPP is a closed public surface: four Assets and one Service.
foreach(required_class IN ITEMS
        StudioView StudioQuery StudioSession StudioResult MemoryStudioEngine)
  string(REGEX MATCHALL
         "class[ \t\r\n]+${required_class}[ \t\r\n]*\\{"
         class_matches "${studio_public_declarations}")
  list(LENGTH class_matches class_match_count)
  if(NOT class_match_count EQUAL 1)
    message(FATAL_ERROR
            "Public Memory Studio class must appear exactly once: ${required_class}")
  endif()
endforeach()

# At namespace scope the installed header contains exactly those five class
# definitions. This also rejects additional free functions, variables,
# aliases, forward declarations, enums, structs, unions, and namespaces.
string(LENGTH "${studio_public_declarations}" studio_header_length)
set(studio_brace_depth 0)
set(studio_namespace_block_count 0)
set(studio_top_level_block_count 0)
set(studio_top_level_semicolon_count 0)
set(studio_character_index 0)
while(studio_character_index LESS studio_header_length)
  string(SUBSTRING "${studio_public_declarations}"
         ${studio_character_index} 1 studio_character)
  if(studio_character STREQUAL "{")
    if(studio_brace_depth EQUAL 0)
      math(EXPR studio_namespace_block_count
           "${studio_namespace_block_count} + 1")
    elseif(studio_brace_depth EQUAL 1)
      math(EXPR studio_top_level_block_count
           "${studio_top_level_block_count} + 1")
    endif()
    math(EXPR studio_brace_depth "${studio_brace_depth} + 1")
  elseif(studio_character STREQUAL "}")
    math(EXPR studio_brace_depth "${studio_brace_depth} - 1")
    if(studio_brace_depth LESS 0)
      message(FATAL_ERROR "Memory Studio public header has unbalanced braces")
    endif()
  elseif(studio_character STREQUAL ";" AND studio_brace_depth EQUAL 1)
    math(EXPR studio_top_level_semicolon_count
         "${studio_top_level_semicolon_count} + 1")
  endif()
  math(EXPR studio_character_index "${studio_character_index} + 1")
endwhile()
if(NOT studio_brace_depth EQUAL 0 OR
   NOT studio_namespace_block_count EQUAL 1 OR
   NOT studio_top_level_block_count EQUAL 5 OR
   NOT studio_top_level_semicolon_count EQUAL 5)
  message(FATAL_ERROR
          "Memory Studio public header contains an undocumented namespace-level declaration")
endif()

function(assert_studio_public_surface class_name expected_public_surface)
  string(FIND "${studio_public_normalized}" "class ${class_name} {"
         studio_class_position)
  if(studio_class_position EQUAL -1)
    message(FATAL_ERROR "Unable to inspect public surface: ${class_name}")
  endif()

  string(SUBSTRING "${studio_public_normalized}"
         ${studio_class_position} -1 studio_class_tail)
  set(studio_next_class_position -1)
  foreach(studio_candidate IN ITEMS
          StudioView StudioQuery StudioSession StudioResult MemoryStudioEngine)
    if(studio_candidate STREQUAL class_name)
      continue()
    endif()
    string(FIND "${studio_class_tail}" "class ${studio_candidate} {"
           studio_candidate_position)
    if(studio_candidate_position GREATER 0 AND
       (studio_next_class_position EQUAL -1 OR
        studio_candidate_position LESS studio_next_class_position))
      set(studio_next_class_position ${studio_candidate_position})
    endif()
  endforeach()
  if(studio_next_class_position GREATER 0)
    string(SUBSTRING "${studio_class_tail}" 0
           ${studio_next_class_position} studio_class_text)
  else()
    set(studio_class_text "${studio_class_tail}")
  endif()

  string(REGEX MATCHALL "public[ ]*:" studio_public_labels
         "${studio_class_text}")
  list(LENGTH studio_public_labels studio_public_label_count)
  if(NOT studio_public_label_count EQUAL 1)
    message(FATAL_ERROR
            "${class_name} must contain exactly one frozen public section")
  endif()
  string(REGEX MATCH "protected[ ]*:" studio_protected_label
         "${studio_class_text}")
  if(NOT "${studio_protected_label}" STREQUAL "")
    message(FATAL_ERROR
            "${class_name} exposes an undocumented protected surface")
  endif()

  string(FIND "${studio_class_text}" "public:" studio_public_position)
  math(EXPR studio_public_start "${studio_public_position} + 7")
  string(FIND "${studio_class_text}" "private:" studio_private_position)
  if(studio_private_position GREATER studio_public_start)
    math(EXPR studio_public_length
         "${studio_private_position} - ${studio_public_start}")
  else()
    string(SUBSTRING "${studio_class_text}" ${studio_public_start} -1
           studio_public_tail)
    string(FIND "${studio_public_tail}" "};" studio_class_close)
    if(studio_class_close EQUAL -1)
      message(FATAL_ERROR "Unable to find public class close: ${class_name}")
    endif()
    set(studio_public_length ${studio_class_close})
  endif()
  string(SUBSTRING "${studio_class_text}" ${studio_public_start}
         ${studio_public_length} studio_actual_public_surface)
  string(REGEX REPLACE "[ \t\r\n]+" "" studio_actual_public_surface
         "${studio_actual_public_surface}")
  string(REGEX REPLACE "[ \t\r\n]+" "" studio_expected_public_surface
         "${expected_public_surface}")
  if(NOT studio_actual_public_surface STREQUAL
         studio_expected_public_surface)
    message(FATAL_ERROR
            "${class_name} public surface differs from frozen API-014-HPP")
  endif()
endfunction()

assert_studio_public_surface(StudioView [=[
  StudioView(std::string workspaceIdentifier,
             const Memory& memory,
             const WorkingMemory& workingMemory,
             const LongTermMemory& longTermMemory,
             const SemanticMemory& semanticMemory,
             const EpisodicMemory& episodicMemory,
             const ProceduralMemory& proceduralMemory,
             std::vector<RetrievalSession> retrievalSessions = {},
             std::vector<ConsolidationSession> consolidationSessions = {},
             std::vector<Reflection> reflections = {},
             std::vector<ReflectionSession> reflectionSessions = {},
             std::vector<ProviderSession> providerSessions = {});
  ~StudioView();
  StudioView(const StudioView&);
  StudioView& operator=(const StudioView&);
  StudioView(StudioView&&) noexcept;
  StudioView& operator=(StudioView&&) noexcept;
  const std::string& workspaceIdentifier() const noexcept;
  const Memory* memory() const noexcept;
  const WorkingMemory* workingMemory() const noexcept;
  const LongTermMemory* longTermMemory() const noexcept;
  const SemanticMemory* semanticMemory() const noexcept;
  const EpisodicMemory* episodicMemory() const noexcept;
  const ProceduralMemory* proceduralMemory() const noexcept;
  const std::vector<RetrievalSession>& retrievalSessions() const noexcept;
  const std::vector<ConsolidationSession>& consolidationSessions() const noexcept;
  const std::vector<Reflection>& reflections() const noexcept;
  const std::vector<ReflectionSession>& reflectionSessions() const noexcept;
  const std::vector<ProviderSession>& providerSessions() const noexcept;
]=])
assert_studio_public_surface(StudioQuery [=[
  enum class Scope {
    Complete, Memory, WorkingMemory, LongTermMemory, SemanticMemory,
    EpisodicMemory, ProceduralMemory, Retrieval, Consolidation, Reflection,
    Providers
  };
  StudioQuery(std::string workspaceIdentifier,
              Scope scope = Scope::Complete,
              std::string identifier = {});
  ~StudioQuery();
  StudioQuery(const StudioQuery&);
  StudioQuery& operator=(const StudioQuery&);
  StudioQuery(StudioQuery&&) noexcept;
  StudioQuery& operator=(StudioQuery&&) noexcept;
  const std::string& workspaceIdentifier() const noexcept;
  Scope scope() const noexcept;
  const std::string& identifier() const noexcept;
]=])
assert_studio_public_surface(StudioSession [=[
  enum class State { Open, Observed, Forgotten };
  explicit StudioSession(std::string workspaceIdentifier);
  ~StudioSession();
  StudioSession(const StudioSession&);
  StudioSession& operator=(const StudioSession&) = delete;
  StudioSession(StudioSession&&) noexcept;
  StudioSession& operator=(StudioSession&&) noexcept = delete;
  const std::string& workspaceIdentifier() const noexcept;
  State state() const noexcept;
  const StudioView* view() const noexcept;
]=])
assert_studio_public_surface(StudioResult [=[
  StudioResult(StudioResult&&) noexcept;
  StudioResult& operator=(StudioResult&&) noexcept;
  StudioResult(const StudioResult&) = delete;
  StudioResult& operator=(const StudioResult&) = delete;
  ~StudioResult();
  const std::string& workspaceIdentifier() const noexcept;
  bool succeeded() const noexcept;
  const std::string& code() const noexcept;
  const std::string& message() const noexcept;
  const StudioView* view() const noexcept;
  const std::vector<std::string>& observations() const noexcept;
  const std::vector<std::vector<std::string>>& explanationChains() const noexcept;
]=])
assert_studio_public_surface(MemoryStudioEngine [=[
  StudioResult observe(StudioSession& session, const StudioView& view) const;
  StudioResult inspect(const StudioSession& session, const StudioQuery& query) const;
  StudioResult trace(const StudioSession& session, const StudioQuery& query) const;
  StudioResult summarize(const StudioSession& session, const StudioQuery& query) const;
  StudioResult exportView(const StudioSession& session) const;
  StudioResult forgetSession(StudioSession& session) const;
]=])

string(REGEX MATCH
       "enum[ \t\r\n]+class[ \t\r\n]+Scope[ \t\r\n]*\\{([^}]*)\\}"
       studio_scope_match "${studio_public_declarations}")
if("${studio_scope_match}" STREQUAL "")
  message(FATAL_ERROR "StudioQuery::Scope is absent")
endif()
string(REGEX REPLACE "[ \t\r\n]+" "" studio_scope_compact
       "${CMAKE_MATCH_1}")
if(NOT studio_scope_compact STREQUAL
   "Complete,Memory,WorkingMemory,LongTermMemory,SemanticMemory,EpisodicMemory,ProceduralMemory,Retrieval,Consolidation,Reflection,Providers")
  message(FATAL_ERROR "StudioQuery::Scope differs from API-014-HPP")
endif()

string(REGEX MATCH
       "enum[ \t\r\n]+class[ \t\r\n]+State[ \t\r\n]*\\{([^}]*)\\}"
       studio_state_match "${studio_public_declarations}")
if("${studio_state_match}" STREQUAL "")
  message(FATAL_ERROR "StudioSession::State is absent")
endif()
string(REGEX REPLACE "[ \t\r\n]+" "" studio_state_compact
       "${CMAKE_MATCH_1}")
if(NOT studio_state_compact STREQUAL "Open,Observed,Forgotten")
  message(FATAL_ERROR "StudioSession::State differs from API-014-HPP")
endif()

string(REGEX MATCH
       "class[ \t\r\n]+MemoryStudioEngine[ \t\r\n]*\\{([^}]*)\\}"
       studio_engine_match "${studio_public_declarations}")
if("${studio_engine_match}" STREQUAL "")
  message(FATAL_ERROR "Unable to inspect MemoryStudioEngine")
endif()
set(studio_engine_body "${CMAKE_MATCH_1}")
string(REGEX MATCHALL
       "StudioResult[ \t\r\n]+[A-Za-z_][A-Za-z0-9_]*[ \t\r\n]*\\("
       studio_operations "${studio_engine_body}")
list(LENGTH studio_operations studio_operation_count)
if(NOT studio_operation_count EQUAL 6)
  message(FATAL_ERROR "MemoryStudioEngine must expose exactly six operations")
endif()
foreach(required_operation IN ITEMS
        observe inspect trace summarize exportView forgetSession)
  string(REGEX MATCHALL
         "StudioResult[ \t\r\n]+${required_operation}[ \t\r\n]*\\("
         operation_matches "${studio_engine_body}")
  list(LENGTH operation_matches operation_match_count)
  if(NOT operation_match_count EQUAL 1)
    message(FATAL_ERROR
            "MemoryStudioEngine operation must appear exactly once: ${required_operation}")
  endif()
endforeach()

# The public Contract depends on exactly the released CP-001 through CP-010
# public headers named by API-014-HPP.
set(required_public_dependencies
    "cca/memory/memory.hpp"
    "cca/memory/working_memory.hpp"
    "cca/memory/long_term_memory.hpp"
    "cca/memory/semantic_memory.hpp"
    "cca/memory/episodic_memory.hpp"
    "cca/memory/procedural_memory.hpp"
    "cca/memory/knowledge_retrieval.hpp"
    "cca/memory/memory_consolidation.hpp"
    "cca/memory/memory_reflection.hpp"
    "cca/memory/memory_provider.hpp")
string(REGEX MATCHALL "#include[ \t]+<cca/[^>]+>"
       studio_cca_includes "${studio_public_lower}")
list(LENGTH studio_cca_includes studio_cca_include_count)
if(NOT studio_cca_include_count EQUAL 10)
  message(FATAL_ERROR
          "Memory Studio public Contract must have exactly ten released CCA dependencies")
endif()
foreach(required_dependency IN LISTS required_public_dependencies)
  string(FIND "${studio_public_lower}" "#include <${required_dependency}>"
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
    "<iostream>"
    "<thread>"
    "<chrono>"
    "<mutex>"
    "<shared_mutex>")
foreach(forbidden_dependency IN LISTS forbidden_dependencies)
  string(FIND "${studio_production_lower}" "${forbidden_dependency}"
         forbidden_dependency_position)
  if(NOT forbidden_dependency_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Studio has forbidden production dependency: ${forbidden_dependency}")
  endif()
endforeach()

# CP-011 may invoke only CP-007's const explain observation. All other
# released Services and all mutating/searching operation spellings are barred.
foreach(forbidden_engine IN ITEMS
        MemoryEngine
        WorkingMemoryEngine
        LongTermMemoryEngine
        SemanticMemoryEngine
        EpisodicMemoryEngine
        ProceduralMemoryEngine
        MemoryConsolidationEngine
        MemoryReflectionEngine
        MemoryProviderEngine)
  string(FIND "${studio_implementation_declarations}" "${forbidden_engine}"
         forbidden_engine_position)
  if(NOT forbidden_engine_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Studio invokes forbidden released Service: ${forbidden_engine}")
  endif()
endforeach()
foreach(forbidden_call IN ITEMS
        ".retrieve(" ".search(" ".filter(" ".rank("
        ".store(" ".activate(" ".expire(" ".retain(" ".archive("
        ".restore(" ".classify(" ".categorize(" ".link(" ".update("
        ".record(" ".derive(" ".compose(" ".analyze(" ".promote("
        ".reflect(" ".registerProvider(" ".exportState(" ".importState("
        ".enumerate(")
  string(FIND "${studio_implementation_declarations}" "${forbidden_call}"
         forbidden_call_position)
  if(NOT forbidden_call_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Studio invokes prohibited released operation: ${forbidden_call}")
  endif()
endforeach()

string(FIND "${studio_implementation_declarations}"
       "MemoryRetrievalEngine" retrieval_engine_position)
if(retrieval_engine_position EQUAL -1)
  message(FATAL_ERROR
          "Memory Studio trace must delegate Retrieval chains to CP-007 explain")
endif()
string(REGEX MATCH "\\.explain[ \t\r\n]*\\(" studio_explain_call
       "${studio_implementation_declarations}")
if("${studio_explain_call}" STREQUAL "")
  message(FATAL_ERROR "Memory Studio contains no CP-007 explain delegation")
endif()

# Studio friendship may connect only the five API-014 classes.
string(REGEX MATCHALL
       "friend[ \t\r\n]+class[ \t\r\n]+[A-Za-z_][A-Za-z0-9_]*"
       studio_friend_declarations "${studio_public_declarations}")
foreach(friend_declaration IN LISTS studio_friend_declarations)
  string(FIND "${friend_declaration}" "MemoryStudioEngine"
         permitted_friend_position)
  if(permitted_friend_position EQUAL -1)
    message(FATAL_ERROR
            "Memory Studio reaches a forbidden private Contract: ${friend_declaration}")
  endif()
endforeach()

# No Runtime, Persistence, Provider implementation, external I/O, UI,
# automatic flow, or semantic engine may enter the headless production target.
file(GLOB_RECURSE studio_production_files
     "${CCA_STUDIO_SOURCE_DIR}/include/*.hpp"
     "${CCA_STUDIO_SOURCE_DIR}/include/*.h"
     "${CCA_STUDIO_SOURCE_DIR}/src/*.hpp"
     "${CCA_STUDIO_SOURCE_DIR}/src/*.h"
     "${CCA_STUDIO_SOURCE_DIR}/src/*.cpp"
     "${CCA_STUDIO_SOURCE_DIR}/src/*.cc")
list(LENGTH studio_production_files studio_production_file_count)
if(NOT studio_production_file_count EQUAL 2)
  message(FATAL_ERROR
          "Memory Studio production surface must contain only its public header and implementation")
endif()

file(GLOB studio_persistence_files
     "${CCA_STUDIO_SOURCE_DIR}/src/*persistence*"
     "${CCA_STUDIO_SOURCE_DIR}/include/*persistence*")
if(studio_persistence_files)
  message(FATAL_ERROR "Memory Studio must not add a Persistence mapping")
endif()

set(forbidden_production_tokens
    "ProviderRequest"
    "ProviderResult"
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
    "std::cin"
    "std::cout"
    "std::cerr"
    "thread_local"
    "system_clock"
    "steady_clock"
    "random_device"
    "socket("
    "connect("
    "serialize("
    "deserialize("
    "save("
    "load("
    "poll("
    "subscribe("
    "refresh("
    "QApplication"
    "QWidget"
    "QWindow"
    "QPainter"
    "GtkWidget"
    "ImGui"
    "React"
    "Renderer"
    "LayoutEngine"
    "PlanningEngine"
    "SimulationEngine"
    "ReasoningEngine"
    "ExecutionEngine"
    "WorkflowEngine"
    "Scheduler")
foreach(forbidden_token IN LISTS forbidden_production_tokens)
  string(FIND "${studio_production_declarations}" "${forbidden_token}"
         forbidden_token_position)
  if(NOT forbidden_token_position EQUAL -1)
    message(FATAL_ERROR
            "Forbidden Memory Studio production token: ${forbidden_token}")
  endif()
endforeach()

string(REGEX MATCHALL "#include[ \t]+[<\"][^>\"\r\n]+[>\"]"
       studio_production_includes "${studio_production_lower}")
foreach(production_include IN LISTS studio_production_includes)
  foreach(infrastructure_term IN ITEMS
          database sqlite socket network cloud filesystem fstream iostream
          compression encryption credential plugin serialization qt gtk sdl)
    string(FIND "${production_include}" "${infrastructure_term}"
           infrastructure_term_position)
    if(NOT infrastructure_term_position EQUAL -1)
      message(FATAL_ERROR
              "Memory Studio selects forbidden infrastructure: ${production_include}")
    endif()
  endforeach()
endforeach()

# CP-001 through CP-010 production must not acquire a reverse Studio edge.
if(DEFINED CCA_CORE_SOURCE_DIR)
  file(GLOB_RECURSE released_memory_production_files
       "${CCA_CORE_SOURCE_DIR}/include/cca/memory/*.hpp"
       "${CCA_CORE_SOURCE_DIR}/src/memory/*.hpp"
       "${CCA_CORE_SOURCE_DIR}/src/memory/*.cpp")
  set(released_memory_production_text "")
  foreach(released_file IN LISTS released_memory_production_files)
    file(READ "${released_file}" released_file_text)
    string(APPEND released_memory_production_text "\n${released_file_text}")
  endforeach()
  foreach(reverse_dependency IN ITEMS
          "memory_studio.hpp" "StudioView" "StudioQuery" "StudioSession"
          "StudioResult" "MemoryStudioEngine")
    string(FIND "${released_memory_production_text}" "${reverse_dependency}"
           reverse_dependency_position)
    if(NOT reverse_dependency_position EQUAL -1)
      message(FATAL_ERROR
              "Released MemoryOS acquired reverse Studio dependency: ${reverse_dependency}")
    endif()
  endforeach()
endif()

# AR-014 trace inventory: all mandatory requirements are named by automated
# evidence. CT/AF/DOC/EX/TRACE/BUILD remain separate conformance artifacts.
# CCA-STUDIO-001 CCA-STUDIO-002 CCA-STUDIO-003 CCA-STUDIO-004
# CCA-STUDIO-005 CCA-STUDIO-006 CCA-STUDIO-007 CCA-STUDIO-008
# CCA-STUDIO-009 CCA-STUDIO-010 CCA-STUDIO-011 CCA-STUDIO-012
# CCA-STUDIO-013 CCA-STUDIO-014 CCA-STUDIO-015 CCA-STUDIO-016
# CCA-STUDIO-017 CCA-STUDIO-018 CCA-STUDIO-019 CCA-STUDIO-020
# CCA-STUDIO-021 CCA-STUDIO-022 CCA-STUDIO-023 CCA-STUDIO-024
# CCA-STUDIO-025 CCA-STUDIO-026 CCA-STUDIO-027 CCA-STUDIO-028
# CCA-STUDIO-029 CCA-STUDIO-030 CCA-STUDIO-031 CCA-STUDIO-032
# CCA-STUDIO-033 CCA-STUDIO-034 CCA-STUDIO-035 CCA-STUDIO-036
# CCA-STUDIO-037 CCA-STUDIO-038 CCA-STUDIO-039 CCA-STUDIO-040
# CCA-STUDIO-041 CCA-STUDIO-042 CCA-STUDIO-043 CCA-STUDIO-044
# CCA-STUDIO-045 CCA-STUDIO-046 CCA-STUDIO-047 CCA-STUDIO-048
# CCA-STUDIO-049 CCA-STUDIO-050 CCA-STUDIO-051 CCA-STUDIO-052
# CCA-STUDIO-053 CCA-STUDIO-054 CCA-STUDIO-055 CCA-STUDIO-056
# CCA-STUDIO-057 CCA-STUDIO-058 CCA-STUDIO-059
foreach(requirement_number RANGE 1 59)
  if(requirement_number LESS 10)
    set(requirement_suffix "00${requirement_number}")
  else()
    set(requirement_suffix "0${requirement_number}")
  endif()
  set(requirement_id "CCA-STUDIO-${requirement_suffix}")
  string(FIND "${studio_unit_test_text}\n${studio_architecture_text}"
         "${requirement_id}" requirement_position)
  if(requirement_position EQUAL -1)
    message(FATAL_ERROR
            "Automated evidence omits requirement: ${requirement_id}")
  endif()
endforeach()

message(STATUS "Memory Studio architecture checks passed")
