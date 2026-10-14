from __future__ import annotations

import argparse

from memoryos import MemoryOS

from _common import emit, package_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify one canonical Memory Investigation Package.")
    parser.add_argument("package", help="Canonical .mip file")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()
    with MemoryOS(node_executable=args.node) as memory:
        result = memory.verify_package(package_bytes(args.package))
        emit({
            "diagnosticCount": len(result.diagnostics),
            "status": result.status,
            "valid": result.valid,
        })
        return 0 if result.valid else 1


if __name__ == "__main__":
    raise SystemExit(main())

