#!/usr/bin/env bash

set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
if ! command -v gcovr >/dev/null 2>&1; then
  echo "error: gcovr is required; install tools/requirements-ci.txt" >&2
  exit 1
fi

cd "${workspace_root}"
cmake --preset coverage
cmake --build --preset coverage
ctest --preset coverage
cmake --build --preset coverage --target cca_coverage

echo "Coverage report: ${workspace_root}/out/build/coverage/coverage/index.html"
