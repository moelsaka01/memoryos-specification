from __future__ import annotations

import argparse
from pathlib import Path

from memoryos import MemoryOS

from _common import emit, package_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description="Import and export exact canonical MIP bytes.")
    parser.add_argument("package", help="Input canonical .mip file")
    parser.add_argument("output", help="Output .mip file")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()
    with MemoryOS(node_executable=args.node) as memory:
        investigation = memory.import_package(package_bytes(args.package))
        exported = memory.export_package(investigation)
        Path(args.output).write_bytes(bytes(exported))
        emit({"bytes": len(exported.data), "output": str(Path(args.output))})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

