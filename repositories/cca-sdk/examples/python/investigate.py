from __future__ import annotations

import argparse
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from memoryos import InvestigationQuery, MemoryOS

from _common import emit


def detached(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): detached(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [detached(item) for item in value]
    return value


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Navigate deterministic evidence in a Cognitive Regression report."
    )
    parser.add_argument("report", help="Cognitive Regression report JSON")
    parser.add_argument("--category")
    parser.add_argument("--reflection")
    parser.add_argument("--transition")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()

    report = json.loads(Path(args.report).read_text(encoding="utf-8"))
    query = InvestigationQuery(
        category=args.category,
        reflection_identifier=args.reflection,
        transition=args.transition,
    )
    with MemoryOS(node_executable=args.node) as memory:
        result = memory.investigate(report, query)
        emit(detached(result.projection))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
