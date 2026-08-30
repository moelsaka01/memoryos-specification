from __future__ import annotations

import argparse

from memoryos import MemoryOS

from _common import emit, package_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a verified Memory Investigation Package.")
    parser.add_argument("package", help="Canonical .mip file")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()
    with MemoryOS(node_executable=args.node) as memory:
        investigation = memory.import_package(package_bytes(args.package))
        emit({
            "investigationIdentifier": investigation.identifier,
            "lifecycle": investigation.lifecycle,
            "workspaceIdentifier": investigation.workspace_identifier,
        })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

