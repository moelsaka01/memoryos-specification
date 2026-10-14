from __future__ import annotations

import argparse
import json
from pathlib import Path

from memoryos import MemoryOS

from _common import emit


def main() -> int:
    parser = argparse.ArgumentParser(description="Observe an explicit MemoryOS Workspace snapshot.")
    parser.add_argument("snapshot", help="CCA-STUDIO-1.0 snapshot JSON")
    parser.add_argument("--node", default="node", help="Node.js executable")
    parser.add_argument("--identifier", help="Explicit investigation identifier")
    args = parser.parse_args()
    snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    with MemoryOS(node_executable=args.node) as memory:
        workspace = memory.open_workspace(snapshot["workspaceIdentifier"])
        investigation = memory.observe(
            workspace,
            snapshot,
            identifier=args.identifier,
        )
        emit({
            "investigationIdentifier": investigation.identifier,
            "lifecycle": investigation.lifecycle,
            "workspaceIdentifier": investigation.workspace_identifier,
        })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

