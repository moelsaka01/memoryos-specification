from __future__ import annotations

import argparse

from memoryos import MemoryOS

from _common import emit, import_and_replay


def main() -> int:
    parser = argparse.ArgumentParser(description="Reconstruct a source-authored MIP Replay.")
    parser.add_argument("package", help="Canonical .mip file")
    parser.add_argument("trace", help="Exact source-authored Trace identifier")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()
    with MemoryOS(node_executable=args.node) as memory:
        investigation, replay = import_and_replay(memory, args.package, args.trace)
        emit({
            "cursor": replay.cursor,
            "investigationIdentifier": investigation.identifier,
            "lifecycle": investigation.lifecycle,
            "status": replay.status,
        })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

