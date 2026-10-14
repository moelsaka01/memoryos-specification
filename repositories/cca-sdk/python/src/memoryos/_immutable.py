"""Internal immutable value helpers."""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from typing import Any


class FrozenMap(Mapping[str, Any]):
    """Small immutable mapping used by public SDK snapshots."""

    __slots__ = ("_items", "_values")

    def __init__(self, value: Mapping[str, Any] | None = None) -> None:
        items = tuple((str(key), freeze(item)) for key, item in (value or {}).items())
        self._items = items
        self._values = dict(items)

    def __getitem__(self, key: str) -> Any:
        return self._values[key]

    def __iter__(self) -> Iterator[str]:
        return (key for key, _ in self._items)

    def __len__(self) -> int:
        return len(self._items)

    def __repr__(self) -> str:
        return f"FrozenMap({dict(self._items)!r})"


def freeze(value: Any) -> Any:
    """Recursively detach JSON-compatible input into immutable values."""

    if isinstance(value, FrozenMap):
        return value
    if isinstance(value, Mapping):
        return FrozenMap(value)
    if isinstance(value, (list, tuple)):
        return tuple(freeze(item) for item in value)
    return value


def thaw(value: Any) -> Any:
    """Return detached JSON-compatible data for the private transport."""

    if isinstance(value, Mapping):
        return {str(key): thaw(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [thaw(item) for item in value]
    return value

