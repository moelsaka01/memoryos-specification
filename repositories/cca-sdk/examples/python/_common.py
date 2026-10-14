from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from memoryos import Investigation, MemoryOS


def package_bytes(path: str) -> bytes:
    return Path(path).read_bytes()


def complete_replay(investigation: Investigation):
    replay = investigation.replay()
    for _ in range(10_000):
        if replay.status == "completed":
            return replay
        replay = replay.next()
    raise RuntimeError("Replay did not complete within its finite source steps.")


def import_and_replay(
    memory: MemoryOS,
    package_path: str,
    trace_identifier: str,
) -> tuple[Investigation, Any]:
    investigation = memory.import_package(package_bytes(package_path))
    investigation = investigation.trace(trace_identifier)
    replay = complete_replay(investigation)
    return replay.investigation, replay


def emit(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True))

