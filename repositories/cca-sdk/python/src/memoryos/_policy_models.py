"""Immutable MemoryOS 1.3 Investigation Policy SDK values."""

from __future__ import annotations

from dataclasses import dataclass, field

from ._immutable import FrozenMap


@dataclass(frozen=True, slots=True)
class PreparedPolicy:
    """A validated Policy or Policy Set with evaluator-produced exact bytes."""

    kind: str
    version: str
    identifier: str
    artifact: FrozenMap
    semantic_projection: FrozenMap
    document_digest: str
    semantic_digest: str
    canonical_bytes: bytes
    _owner: object = field(repr=False, compare=False, hash=False)

    def __bytes__(self) -> bytes:
        return self.canonical_bytes


@dataclass(frozen=True, slots=True)
class PolicyFactContextInspection:
    """Validated detached context; this value has no production authority."""

    kind: str
    version: str
    fact_model_version: str
    context_digest: str
    artifact: FrozenMap
    canonical_bytes: bytes
    authority: str = "inspectionOnly"

    def __bytes__(self) -> bytes:
        return self.canonical_bytes


@dataclass(frozen=True, slots=True)
class AuthoritativePolicyFactContext:
    """Opaque owner-bound capability minted by the trusted Core capture path."""

    kind: str
    version: str
    fact_model_version: str
    context_digest: str
    artifact: FrozenMap
    canonical_bytes: bytes
    _capability: object = field(repr=False, compare=False, hash=False)
    _owner: object = field(repr=False, compare=False, hash=False)

    def __bytes__(self) -> bytes:
        return self.canonical_bytes


@dataclass(frozen=True, slots=True)
class RegressionPolicyFactSourceInspection:
    """Validated detached Regression source; inspection never mints authority."""

    kind: str
    version: str
    domain: str
    source_model_version: str
    source_digest: str
    artifact: FrozenMap
    canonical_bytes: bytes
    authority: str = "inspectionOnly"

    def __bytes__(self) -> bytes:
        return self.canonical_bytes


@dataclass(frozen=True, slots=True)
class AuthoritativeRegressionPolicyFactSource:
    """Opaque source capability bound to one exact candidate context."""

    kind: str
    version: str
    domain: str
    source_model_version: str
    source_digest: str
    artifact: FrozenMap
    canonical_bytes: bytes
    _capability: object = field(repr=False, compare=False, hash=False)
    _context: AuthoritativePolicyFactContext = field(
        repr=False, compare=False, hash=False
    )
    _owner: object = field(repr=False, compare=False, hash=False)

    def __bytes__(self) -> bytes:
        return self.canonical_bytes


@dataclass(frozen=True, slots=True)
class RegressionReportInspection:
    """Validated detached Cognitive Regression report."""

    kind: str
    version: str
    report_identifier: str
    artifact: FrozenMap
    canonical_bytes: bytes
    authority: str = "inspectionOnly"

    def __bytes__(self) -> bytes:
        return self.canonical_bytes


@dataclass(frozen=True, slots=True)
class AuthoritativeRegressionPolicyFacts:
    """Atomic trusted candidate-context and Regression-source capability pair."""

    policy_fact_context: AuthoritativePolicyFactContext
    regression_policy_fact_source: AuthoritativeRegressionPolicyFactSource


@dataclass(frozen=True, slots=True)
class PolicyEvaluation:
    """One completed normative evaluation with exact evaluator-produced bytes."""

    decision: str
    evaluation_identity: FrozenMap
    evaluation_identity_digest: str
    evaluation_identity_bytes: bytes
    outcome: FrozenMap
    outcome_digest: str
    canonical_outcome_bytes: bytes
    cache_disposition: str

    def __bytes__(self) -> bytes:
        return self.canonical_outcome_bytes


@dataclass(frozen=True, slots=True)
class PolicyArtifactVerification:
    """Successful artifact or authoritative-reconstruction verification."""

    artifact_kind: str
    artifact_version: str
    authority: str
    verification_scope: str
    verified: bool
    canonical_bytes: bytes
    evaluation_identity: FrozenMap | None = None
    evaluation_identity_digest: str | None = None
    outcome: FrozenMap | None = None
    outcome_digest: str | None = None
    decision: str | None = None

    def __bytes__(self) -> bytes:
        return self.canonical_bytes
