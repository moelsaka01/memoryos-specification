#!/usr/bin/env python3
"""Apply or verify clang-format across CCA C++ source files."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


SOURCE_SUFFIXES = frozenset({".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx"})
SOURCE_ROOTS = ("repositories", "examples", "tests")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True, help="CCA workspace root")
    parser.add_argument("--fix", action="store_true", help="rewrite files in place")
    parser.add_argument(
        "--clang-format",
        dest="clang_format",
        default=os.environ.get("CLANG_FORMAT", "clang-format"),
        help="clang-format executable or absolute path",
    )
    return parser.parse_args()


def source_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for source_root_name in SOURCE_ROOTS:
        source_root = root / source_root_name
        if not source_root.is_dir():
            continue
        files.extend(
            path
            for path in source_root.rglob("*")
            if path.is_file() and path.suffix.lower() in SOURCE_SUFFIXES
        )
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def main() -> int:
    arguments = parse_arguments()
    root = arguments.root.resolve(strict=True)
    executable = shutil.which(arguments.clang_format)
    if executable is None:
        print(f"error: clang-format executable not found: {arguments.clang_format}", file=sys.stderr)
        return 2

    files = source_files(root)
    if not files:
        print("No C++ source files found.")
        return 0

    failed = False
    mode_arguments = ("-i",) if arguments.fix else ("--dry-run", "--Werror")
    for path in files:
        result = subprocess.run(
            (executable, "--style=file", *mode_arguments, str(path)),
            cwd=root,
            check=False,
        )
        failed = failed or result.returncode != 0

    action = "formatted" if arguments.fix else "checked"
    print(f"{action} {len(files)} C++ files with {Path(executable).name}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
