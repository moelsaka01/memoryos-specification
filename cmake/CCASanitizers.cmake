include_guard(GLOBAL)

function(cca_create_sanitizers_target)
  if(TARGET cca_project_sanitizers)
    return()
  endif()

  add_library(cca_project_sanitizers INTERFACE)
  add_library(cca::project_sanitizers ALIAS cca_project_sanitizers)

  if(CCA_ENABLE_THREAD_SANITIZER AND CCA_ENABLE_ADDRESS_SANITIZER)
    message(FATAL_ERROR "ThreadSanitizer and AddressSanitizer cannot be enabled together")
  endif()

  if(MSVC)
    if(CCA_ENABLE_THREAD_SANITIZER OR CCA_ENABLE_UNDEFINED_SANITIZER)
      message(FATAL_ERROR "MSVC does not support the requested CCA sanitizer combination")
    endif()
    if(CCA_ENABLE_ADDRESS_SANITIZER)
      target_compile_options(cca_project_sanitizers INTERFACE /fsanitize=address)
      target_link_options(cca_project_sanitizers INTERFACE /fsanitize=address)
    endif()
    return()
  endif()

  if(NOT CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    if(
      CCA_ENABLE_ADDRESS_SANITIZER
      OR CCA_ENABLE_UNDEFINED_SANITIZER
      OR CCA_ENABLE_THREAD_SANITIZER
    )
      message(FATAL_ERROR "Sanitizers are unsupported by ${CMAKE_CXX_COMPILER_ID}")
    endif()
    return()
  endif()

  set(enabled_sanitizers "")
  if(CCA_ENABLE_ADDRESS_SANITIZER)
    list(APPEND enabled_sanitizers address)
  endif()
  if(CCA_ENABLE_UNDEFINED_SANITIZER)
    list(APPEND enabled_sanitizers undefined)
  endif()
  if(CCA_ENABLE_THREAD_SANITIZER)
    list(APPEND enabled_sanitizers thread)
  endif()

  if(enabled_sanitizers)
    list(JOIN enabled_sanitizers "," sanitizer_list)
    target_compile_options(
      cca_project_sanitizers
      INTERFACE
        "-fsanitize=${sanitizer_list}"
        -fno-omit-frame-pointer
    )
    target_link_options(
      cca_project_sanitizers
      INTERFACE
        "-fsanitize=${sanitizer_list}"
        -fno-omit-frame-pointer
    )
  endif()
endfunction()
