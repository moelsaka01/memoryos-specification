from __future__ import annotations

import argparse
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from memoryos import MemoryOS

from _common import emit


def detached(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): detached(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [detached(item) for item in value]
    return value


def snapshot(path: str) -> dict[str, object]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Observation snapshot must be a JSON object.")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare two explicit investigations through MemoryOS Core."
    )
    parser.add_argument("baseline", help="Baseline observation snapshot")
    parser.add_argument("candidate", help="Candidate observation snapshot")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()

    baseline_snapshot = snapshot(args.baseline)
    candidate_snapshot = snapshot(args.candidate)
    workspace_identifier = baseline_snapshot.get("workspaceIdentifier")
    if not isinstance(workspace_identifier, str) or not workspace_identifier:
        raise ValueError("Baseline snapshot requires workspaceIdentifier.")

    with MemoryOS(node_executable=args.node) as memory:
        workspace = memory.open_workspace(workspace_identifier)
        baseline = memory.observe(
            workspace,
            baseline_snapshot,
            identifier="python-regression-baseline",
        )
        candidate = memory.observe(
            workspace,
            candidate_snapshot,
            identifier="python-regression-candidate",
        )
        report = memory.regression(baseline, candidate)
        emit(detached(report.projection))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
