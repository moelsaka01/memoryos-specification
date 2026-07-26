# Build instructions

Run workspace commands from the directory containing the top-level
`CMakeLists.txt`.

These instructions describe configured workflows. They do not claim that a
build, test, analysis, coverage, or CI run has passed on the reader's machine.

## Standard preset workflow

Configure:

```sh
cmake --preset default
```

Build:

```sh
cmake --build --preset default
```

Run discovered tests:

```sh
ctest --preset default
```

Use `ctest --preset default --output-on-failure` when diagnosing a failure if
the preset does not already enable failure output.

## Preset matrix

| Preset | Purpose |
|---|---|
| `default` | Standard development configure, build, and test workflow |
| `release` | Optimized release-oriented workflow |
| `analysis` | clang-tidy-integrated build |
| `coverage` | GCC/Clang coverage instrumentation and report workflow |
| `sanitizer` | GCC/Clang-oriented sanitizer workflow |
| `ci` | Continuous-integration workflow |
| `minimal` | Configure/build without vcpkg or tests; no test preset |

All presets have corresponding configure and build presets. All except
`minimal` have a test preset. `minimal` is deliberately not test evidence.

The presets use the workspace-pinned vcpkg checkout prepared under
`.cache/vcpkg` by the bootstrap script. See
[developer-setup.md](developer-setup.md).

Preset build directories are `out/build/<preset>` and preset install
directories are `out/install/<preset>`.

## Wrapper scripts

Cross-platform wrappers provide the common entry points:

| Workflow | POSIX shell | PowerShell |
|---|---|---|
| Bootstrap | `bash scripts/bootstrap.sh` | `pwsh -File scripts/bootstrap.ps1` |
| Build | `bash scripts/build.sh` | `pwsh -File scripts/build.ps1` |
| Format check | `bash scripts/format.sh` | `pwsh -File scripts/format.ps1` |
| Format fix | `bash scripts/format.sh --fix` | `pwsh -File scripts/format.ps1 -Fix` |
| Static analysis | `bash scripts/analyze.sh` | `pwsh -File scripts/analyze.ps1` |
| Coverage | `bash scripts/coverage.sh` | `pwsh -File scripts/coverage.ps1` |

Select a non-default build preset with `scripts/build.sh --preset NAME` or
`scripts/build.ps1 -Preset NAME`. Add `--skip-tests` or `-SkipTests` when the
intentional workflow excludes a test run. The wrapper automatically skips tests
for `minimal`, which has no test preset.

Wrapper success must be reported as the specific checks it actually ran, not as
a blanket platform-support claim.

## Manual workflow

The explicit workflow is useful for debugging a preset or using a local
generator:

```sh
cmake -S . -B out/local \
  -DCMAKE_TOOLCHAIN_FILE="${VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake" \
  -DBUILD_TESTING=ON
cmake --build out/local
ctest --test-dir out/local --output-on-failure
```

For a multi-configuration generator, add `--config Debug` or another explicitly
configured build type to build and test commands.

Do not reuse one build directory across incompatible generators, compilers, or
instrumentation options.

## CMake options

| Option | Default | Effect |
|---|---:|---|
| `BUILD_TESTING` | CTest default | Enables registered unit-test targets |
| `CCA_WARNINGS_AS_ERRORS` | `OFF` | Treats configured compiler warnings as errors |
| `CCA_ENABLE_CLANG_TIDY` | `OFF` | Runs clang-tidy as targets compile |
| `CCA_ENABLE_CPPCHECK` | `OFF` | Runs cppcheck as targets compile |
| `CCA_ENABLE_IPO` | `OFF` | Enables interprocedural optimization when supported |
| `CCA_ENABLE_ADDRESS_SANITIZER` | `OFF` | Adds AddressSanitizer instrumentation |
| `CCA_ENABLE_UNDEFINED_SANITIZER` | `OFF` | Adds UndefinedBehaviorSanitizer instrumentation |
| `CCA_ENABLE_THREAD_SANITIZER` | `OFF` | Adds ThreadSanitizer instrumentation |
| `CCA_ENABLE_COVERAGE` | `OFF` | Adds GCC/Clang coverage instrumentation and, when `gcovr` exists, a report target |

Optional analysis executable paths can be set with
`CCA_CLANG_TIDY_EXECUTABLE` and `CCA_CPPCHECK_EXECUTABLE`.

## Static analysis

The standard wrapper configures and builds the `analysis` preset:

```sh
bash scripts/analyze.sh
```

```powershell
pwsh -File scripts/analyze.ps1
```

The equivalent manual pattern is:

Create a dedicated build:

```sh
cmake -S . -B out/analysis \
  -DCMAKE_TOOLCHAIN_FILE="${VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake" \
  -DBUILD_TESTING=ON \
  -DCCA_ENABLE_CLANG_TIDY=ON \
  -DCCA_ENABLE_CPPCHECK=ON
cmake --build out/analysis
ctest --test-dir out/analysis --output-on-failure
```

Analysis is integrated into compilation. A configure step alone does not run
the analyzers. Missing requested executables are configuration errors.

## Sanitizers

AddressSanitizer plus UndefinedBehaviorSanitizer on a compatible GCC or Clang
toolchain:

```sh
cmake -S . -B out/asan-ubsan \
  -DCMAKE_TOOLCHAIN_FILE="${VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake" \
  -DBUILD_TESTING=ON \
  -DCCA_ENABLE_ADDRESS_SANITIZER=ON \
  -DCCA_ENABLE_UNDEFINED_SANITIZER=ON
cmake --build out/asan-ubsan
ctest --test-dir out/asan-ubsan --output-on-failure
```

ThreadSanitizer must use a separate build and cannot be combined with
AddressSanitizer. The configured MSVC path supports AddressSanitizer but rejects
the configured ThreadSanitizer and UndefinedBehaviorSanitizer options.

## Coverage

Coverage requires GCC or Clang plus `gcovr`:

```sh
bash scripts/coverage.sh
```

```powershell
pwsh -File scripts/coverage.ps1
```

The wrapper writes its HTML report under
`out/build/coverage/coverage/index.html`.

The equivalent manual pattern is:

```sh
cmake -S . -B out/coverage \
  -DCMAKE_TOOLCHAIN_FILE="${VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake" \
  -DBUILD_TESTING=ON \
  -DCCA_ENABLE_COVERAGE=ON
cmake --build out/coverage
ctest --test-dir out/coverage --output-on-failure
cmake --build out/coverage --target cca_coverage
```

When available, `cca_coverage` writes detailed HTML to
`out/coverage/coverage/index.html` and Cobertura XML to
`out/coverage/coverage/coverage.xml`. If `gcovr` is not found, configuration
continues without creating that report target. When the coverage target is
available it enforces the IS-002 minimum of 90% line coverage for production
compiler code.

## Formatting

Use the repository `.clang-format` file through the workspace wrapper:

```sh
bash scripts/format.sh
bash scripts/format.sh --fix
```

```powershell
pwsh -File scripts/format.ps1
pwsh -File scripts/format.ps1 -Fix
```

The check mode does not edit files. The fix mode edits the source files selected
by the script; review the resulting diff.

To check one file directly without editing it:

```sh
clang-format --dry-run --Werror repositories/cca-compiler/src/parser.cpp
```

Formatting and static analysis are different checks; passing one does not imply
passing the other.

## Build individual repositories

The foundation repositories can expose standalone CMake entry points for local
work. From a repository root:

```sh
cmake -S . -B build -DBUILD_TESTING=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

The workspace build remains the integration path because it supplies shared
project options and versioning. A standalone repository build does not verify
cross-repository integration.

## Install and consume the compiler

Install the configured workspace:

```sh
cmake --install out/build/default --prefix out/install/default
```

The installation exports the `ccaCompiler` CMake package, the
`cca::compiler` library target, the `cca::cli` executable target, public
headers, the `cca` command, and the canonical JSON Schema. A downstream CMake
project can consume the library with:

```cmake
find_package(ccaCompiler CONFIG REQUIRED)
target_link_libraries(my_tool PRIVATE cca::compiler)
```

Make the installation prefix and the `yaml-cpp` package visible through
`CMAKE_PREFIX_PATH` or the downstream package manager. The exported package
declares `yaml-cpp` as a dependency.

## CLI smoke usage

After locating the built `cca` executable for the selected generator:

```sh
cca help
cca version
cca doctor
cca validate examples/specifications/reference-architecture.yaml
cca analyze examples/specifications/reference-architecture.yaml
cca compile examples/specifications/reference-architecture.yaml --output cca-out
cca report examples/specifications/reference-architecture.yaml --output cca-out
```

The first three exercise process readiness. The remaining commands exercise
the working canonical pipeline and deterministic output bundle. See
[cli.md](cli.md).

## Reporting results

When handing off a change, report separately:

- configure command and result;
- build command and result;
- test command, discovered test count, and result;
- format command and result;
- analyzer command and result;
- sanitizer or coverage command and result;
- platform, compiler, generator, and dependency context;
- checks not run and why.

Never summarize a configured but unexecuted check as passing.
