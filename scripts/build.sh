#!/usr/bin/env bash

set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
preset="default"
skip_tests=false

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
    --skip-tests)
      skip_tests=true
      shift
      ;;
    -h | --help)
      echo "Usage: scripts/build.sh [--preset NAME] [--skip-tests]"
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      exit 2
      ;;
  esac
done

cd "${workspace_root}"
cmake --preset "${preset}"
cmake --build --preset "${preset}"
if [[ "${skip_tests}" == false && "${preset}" != "minimal" ]]; then
  ctest --preset "${preset}"
fi
