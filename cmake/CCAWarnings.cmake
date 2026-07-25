include_guard(GLOBAL)

function(cca_create_warnings_target)
  if(TARGET cca_project_warnings)
    return()
  endif()

  add_library(cca_project_warnings INTERFACE)
  add_library(cca::project_warnings ALIAS cca_project_warnings)

  if(MSVC)
    target_compile_options(
      cca_project_warnings
      INTERFACE
        /W4
        /permissive-
        /Zc:__cplusplus
        /Zc:preprocessor
        /utf-8
    )
    if(CCA_WARNINGS_AS_ERRORS)
      target_compile_options(cca_project_warnings INTERFACE /WX)
    endif()
  elseif(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(
      cca_project_warnings
      INTERFACE
        -Wall
        -Wextra
        -Wpedantic
        -Wconversion
        -Wsign-conversion
        -Wshadow
        -Wundef
        -Wnon-virtual-dtor
    )
    if(CCA_WARNINGS_AS_ERRORS)
      target_compile_options(cca_project_warnings INTERFACE -Werror)
    endif()
  else()
    message(WARNING "No CCA warning profile is defined for ${CMAKE_CXX_COMPILER_ID}")
  endif()
endfunction()
