from __future__ import annotations

import argparse

from memoryos import MemoryOS

from _common import emit, import_and_replay


def main() -> int:
    parser = argparse.ArgumentParser(description="Enter staged deterministic comparison.")
    parser.add_argument("package", help="Canonical .mip file")
    parser.add_argument("trace", help="Exact source-authored Trace identifier")
    parser.add_argument("evolution", help="Exact source-authored Evolution identifier")
    parser.add_argument("comparative", help="Exact source-authored Comparative identifier")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()
    with MemoryOS(node_executable=args.node) as memory:
        investigation, _ = import_and_replay(memory, args.package, args.trace)
        request = investigation.comparison_session(args.evolution)
        evolution = investigation.compare(request)
        comparative = evolution.start(
            comparative_identifier=args.comparative
        ).next()
        emit({
            "investigationIdentifier": comparative.investigation.identifier,
            "lifecycle": comparative.investigation.lifecycle,
            "stage": comparative.stage,
        })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
