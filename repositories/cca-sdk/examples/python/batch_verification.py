from __future__ import annotations

import argparse

from memoryos import MemoryOS

from _common import emit, package_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify canonical MIP files in lexical path order.")
    parser.add_argument("packages", nargs="+", help="Canonical .mip files")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()
    outcomes = []
    with MemoryOS(node_executable=args.node) as memory:
        for path in sorted(args.packages):
            result = memory.verify_package(package_bytes(path))
            outcomes.append({"path": path, "valid": result.valid})
    emit({"packages": outcomes, "valid": all(item["valid"] for item in outcomes)})
    return 0 if all(item["valid"] for item in outcomes) else 1


if __name__ == "__main__":
    raise SystemExit(main())
