#!/usr/bin/env bash

set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
vcpkg_directory="${workspace_root}/.cache/vcpkg"
vcpkg_version="$(tr -d '\r\n' <"${workspace_root}/tools/vcpkg-version.txt")"
vcpkg_commit="$(tr -d '\r\n' <"${workspace_root}/tools/vcpkg-commit.txt")"
preset="default"
skip_vcpkg=false
skip_configure=false

usage() {
  cat <<'USAGE'
Usage: scripts/bootstrap.sh [options]

Options:
  --preset NAME       Configure NAME after bootstrapping (default: default).
  --skip-vcpkg        Do not clone or bootstrap the pinned vcpkg checkout.
  --skip-configure    Prepare prerequisites without running CMake configure.
  -h, --help          Show this help.
USAGE
}

while (($# > 0)); do
  case "$1" in
    --preset)
      if (($# < 2)); then
        echo "error: --preset requires a value" >&2
        exit 2
      fi
      preset="$2"
      shift 2
      ;;
    --skip-vcpkg)
      skip_vcpkg=true
      shift
      ;;
    --skip-configure)
      skip_configure=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for required_command in git cmake ninja; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "error: required command not found: ${required_command}" >&2
    exit 1
  fi
done

if command -v python3 >/dev/null 2>&1; then
  python_executable="python3"
elif command -v python >/dev/null 2>&1; then
  python_executable="python"
else
  echo "error: Python 3.12 or newer is required" >&2
  exit 1
fi

"${python_executable}" -c \
  'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else "Python 3.12+ is required")'

if [[ "${skip_vcpkg}" == false ]]; then
  if [[ ! -e "${vcpkg_directory}" ]]; then
    mkdir -p "$(dirname "${vcpkg_directory}")"
    git clone \
      --branch "${vcpkg_version}" \
      --depth 1 \
      https://github.com/microsoft/vcpkg.git \
      "${vcpkg_directory}"
  elif [[ ! -d "${vcpkg_directory}/.git" ]]; then
    echo "error: ${vcpkg_directory} exists but is not a vcpkg Git checkout" >&2
    exit 1
  fi

  installed_commit="$(git -C "${vcpkg_directory}" rev-parse HEAD)"
  if [[ "${installed_commit}" != "${vcpkg_commit}" ]]; then
    echo "error: vcpkg checkout is ${installed_commit}; expected ${vcpkg_commit}" >&2
    echo "Remove ${vcpkg_directory} deliberately, then rerun bootstrap." >&2
    exit 1
  fi

  "${vcpkg_directory}/bootstrap-vcpkg.sh" -disableMetrics
fi

if [[ "${skip_configure}" == false ]]; then
  cd "${workspace_root}"
  cmake --preset "${preset}"
fi

echo "CCA workspace bootstrap complete."
if [[ "${skip_configure}" == false ]]; then
  echo "Next: cmake --build --preset ${preset}"
fi
