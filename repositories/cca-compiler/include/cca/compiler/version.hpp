#pragma once

#include <cca/version.hpp>

#include <string_view>

namespace cca::compiler {

/// Version of the compiler framework API in this repository.
inline constexpr std::string_view compiler_version{cca::version::string};

} // namespace cca::compiler
