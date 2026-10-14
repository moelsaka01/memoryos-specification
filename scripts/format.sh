#!/usr/bin/env bash

set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
fix_argument=()

if (($# > 1)); then
  echo "Usage: scripts/format.sh [--fix]" >&2
  exit 2
fi
if (($# == 1)); then
  if [[ "$1" != "--fix" ]]; then
    echo "error: unknown option: $1" >&2
    exit 2
  fi
  fix_argument=(--fix)
fi

if command -v python3 >/dev/null 2>&1; then
  python_executable="python3"
else
  python_executable="python"
fi

"${python_executable}" \
  "${workspace_root}/tools/run_clang_format.py" \
  --root "${workspace_root}" \
  "${fix_argument[@]}"
