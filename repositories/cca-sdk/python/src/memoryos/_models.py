"""Immutable public values for the MemoryOS Python SDK."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from ._immutable import FrozenMap

if TYPE_CHECKING:
    from ._sdk import MemoryOS


@dataclass(frozen=True, slots=True)
class Workspace:
    """An immutable Workspace identity owned by one ``MemoryOS`` instance."""

    identifier: str
    _owner: object = field(repr=False, compare=False, hash=False)


@dataclass(frozen=True, slots=True)
class MemoryInvestigationPackage:
    """Detached canonical MIP bytes; presentation state is never included."""

    data: bytes
    media_type: str = "application/vnd.memoryos.mip+json"

    def __bytes__(self) -> bytes:
        return self.data


@dataclass(frozen=True, slots=True)
class InvestigationQuery:
    """Reserved typed query seam; MO-1204 defines no query execution behavior."""


@dataclass(frozen=True, slots=True)
class Checkpoint:
    """Opaque, integrity-bound restoration handle owned by one SDK instance."""

    token: str
    investigation_identifier: str
    workspace_identifier: str
    transition_log_digest: str
    transition_count: int
    state_digest: str
    _owner: object = field(repr=False, compare=False, hash=False)


@dataclass(frozen=True, slots=True)
class VerificationResult:
    """Immutable verification evidence from Core or MIP verification."""

    valid: bool
    status: str
    checks: tuple[FrozenMap, ...] = ()
    diagnostics: tuple[FrozenMap, ...] = ()
    investigation: "Investigation | None" = None
    package: MemoryInvestigationPackage | None = None
    manifest: FrozenMap | None = None


@dataclass(frozen=True, slots=True)
class Investigation:
    """Immutable snapshot and command handle for one Core investigation."""

    identifier: str
    workspace_identifier: str
    lifecycle: str
    phase: str
    source_kind: str
    availability: FrozenMap
    projection: FrozenMap
    transition_log_digest: str
    transition_count: int
    _memory: "MemoryOS" = field(repr=False, compare=False, hash=False)

    def refresh(self) -> "Investigation":
        """Re-derive the current immutable state from the Core transition log."""

        return self._memory._load_investigation(self.identifier)

    def trace(self, selection: str | Mapping[str, Any]) -> "Investigation":
        """Select one exact Core-visible Trace target and prepare Replay."""

        return self._memory._trace(self, selection)

    def observe(
        self,
        snapshot: Mapping[str, Any],
        *,
        operation: str | None = None,
        query: Mapping[str, Any] | None = None,
        result_code: str = "OK",
    ) -> "Investigation":
        """Append one explicit observation through the same Core investigation."""

        return self._memory._observe_investigation(
            self,
            snapshot,
            operation=operation,
            query=query,
            result_code=result_code,
        )

    def replay(self) -> "ReplaySession":
        """Open a controller handle over the existing Core Replay."""

        return self._memory._open_replay(self)

    def comparison_session(self, evolution_identifier: str | None) -> "ComparisonSession":
        """Create an explicit, immutable comparison request owned by this investigation.

        ``None`` explicitly selects the Core's current native observation pair.
        MIP-backed callers pass an exact source-authored Evolution identifier.
        """

        if self.source_kind == "native":
            if evolution_identifier is not None:
                raise ValueError("native comparison requires explicit None for the current pair")
        elif not isinstance(evolution_identifier, str) or not evolution_identifier:
            raise ValueError("MIP comparison requires an exact Evolution identifier")
        return ComparisonSession(
            investigation_identifier=self.identifier,
            evolution_identifier=evolution_identifier,
            _owner=self._memory._identity,
        )

    def compare(self, session: "ComparisonSession") -> "ComparisonSession":
        """Enter deterministic Evolution with an explicit configured session."""

        return self._memory._enter_comparison(self, session)

    def verify(self) -> VerificationResult:
        """Verify current investigation truth and append the Core transition."""

        return self._memory._verify_investigation(self)

    def checkpoint(self) -> Checkpoint:
        """Capture an opaque checkpoint bound to the authoritative log."""

        return self._memory._checkpoint(self)

    def restore(self, checkpoint: Checkpoint) -> "Investigation":
        """Restore an intact checkpoint owned by this SDK instance."""

        return self._memory._restore(self, checkpoint)

    def archive(self) -> "Investigation":
        """Append the terminal archive transition."""

        return self._memory._archive(self)

    def return_to_world(self) -> "Investigation":
        """Clear active investigation artifacts through the Core."""

        return self._memory._return_to_world(self)


@dataclass(frozen=True, slots=True)
class ReplaySession:
    """Immutable command handle over one prepared deterministic Replay."""

    investigation: Investigation
    replay_identifier: str

    @property
    def state(self) -> FrozenMap | None:
        value = self.investigation.projection.get("replayState")
        return value if isinstance(value, FrozenMap) else None

    @property
    def status(self) -> str | None:
        return str(self.state["status"]) if self.state and "status" in self.state else None

    @property
    def cursor(self) -> int | None:
        value = self.state.get("cursor") if self.state else None
        return int(value) if isinstance(value, int) else None

    def _action(self, action: str) -> "ReplaySession":
        return self.investigation._memory._replay_action(self, action)

    def play(self) -> "ReplaySession":
        return self._action("play")

    def pause(self) -> "ReplaySession":
        return self._action("pause")

    def next(self) -> "ReplaySession":
        return self._action("next")

    def previous(self) -> "ReplaySession":
        return self._action("previous")

    def restart(self) -> "ReplaySession":
        return self._action("restart")

    def advance(self) -> "ReplaySession":
        return self._action("advance")


@dataclass(frozen=True, slots=True)
class ComparisonSession:
    """Staged Evolution and Comparative Reconstruction command handle."""

    investigation_identifier: str
    evolution_identifier: str | None
    _owner: object = field(repr=False, compare=False, hash=False)
    investigation: Investigation | None = None

    @property
    def stage(self) -> str:
        return self.investigation.phase if self.investigation is not None else "configured"

    def _action(self, action: str, **selectors: Any) -> "ComparisonSession":
        if self.investigation is None:
            raise ValueError("Comparison session has not entered the Investigation Core.")
        return self.investigation._memory._comparison_action(self, action, selectors)

    def previous_observation(self) -> "ComparisonSession":
        return self._action("previous")

    def next_observation(self) -> "ComparisonSession":
        return self._action("next")

    def start(
        self,
        *,
        comparative_identifier: str | None = None,
        target_node_key: str | None = None,
    ) -> "ComparisonSession":
        if self.investigation is None:
            raise ValueError("Comparison session has not entered the Investigation Core.")
        native = self.investigation.source_kind == "native"
        valid = (
            native
            and isinstance(target_node_key, str)
            and bool(target_node_key)
            and comparative_identifier is None
        ) or (
            not native
            and isinstance(comparative_identifier, str)
            and bool(comparative_identifier)
            and target_node_key is None
        )
        if not valid:
            required = "target_node_key" if native else "comparative_identifier"
            raise ValueError(f"start() requires exactly one explicit {required} selector")
        return self._action(
            "start",
            comparativeIdentifier=comparative_identifier,
            targetNodeKey=target_node_key,
        )

    def play(self) -> "ComparisonSession":
        return self._action("play")

    def pause(self) -> "ComparisonSession":
        return self._action("pause")

    def next(self) -> "ComparisonSession":
        return self._action("nextStep")

    def previous(self) -> "ComparisonSession":
        return self._action("previousStep")

    def reset(self) -> "ComparisonSession":
        return self._action("reset")

    def advance(self) -> "ComparisonSession":
        return self._action("advance")

    def back(self) -> Investigation:
        if self.investigation is None:
            raise ValueError("Comparison session has not entered the Investigation Core.")
        return self.investigation._memory._comparison_back(self)
