"""Stable MemoryOS SDK diagnostics."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ._immutable import FrozenMap, freeze


@dataclass(frozen=True, slots=True)
class Diagnostic:
    """One deterministic diagnostic returned by the Investigation Core."""

    code: str
    operation: str
    message: str
    details: FrozenMap

    @classmethod
    def from_value(cls, value: dict[str, Any]) -> "Diagnostic":
        details = {
            key: item
            for key, item in value.items()
            if key not in {"code", "operation", "message"}
        }
        return cls(
            code=str(value.get("code", "BINDING_FAILURE")),
            operation=str(value.get("operation", "binding")),
            message=str(value.get("message", "MemoryOS operation failed.")),
            details=freeze(details),
        )


class MemoryOSError(RuntimeError):
    """Structured failure reported by the authoritative Investigation Core."""

    def __init__(
        self,
        code: str,
        operation: str,
        message: str,
        diagnostics: tuple[Diagnostic, ...] = (),
        *,
        phase: str | None = None,
        artifact_kind: str | None = None,
        limit_identifier: str | None = None,
        failure_class: str | None = None,
        details: tuple[FrozenMap, ...] = (),
    ) -> None:
        super().__init__(message)
        self.code = code
        self.operation = operation
        self.diagnostics = diagnostics
        self.phase = phase
        self.artifact_kind = artifact_kind
        self.limit_identifier = limit_identifier
        self.failure_class = failure_class
        self.details = details


class MemoryOSBindingError(MemoryOSError):
    """Failure of the private local binding rather than investigation behavior."""


class MemoryOSPolicyPreparationError(MemoryOSError):
    """Stable deterministic Policy preparation/admission failure."""


class MemoryOSPolicyOperationalError(MemoryOSError):
    """Operational or verification failure outside the Policy decision algebra."""

    def __init__(self, *args: object, verification_failure: bool = False, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.verification_failure = verification_failure
