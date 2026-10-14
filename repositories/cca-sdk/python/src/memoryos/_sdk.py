"""Public MemoryOS Python SDK facade."""

from __future__ import annotations

import base64
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from ._bridge import BridgeClient, default_host_path
from ._errors import MemoryOSBindingError, MemoryOSError
from ._immutable import FrozenMap, freeze, thaw
from ._models import (
    Checkpoint,
    ComparisonSession,
    Investigation,
    InvestigationQuery,
    InvestigationResult,
    MemoryInvestigationPackage,
    RegressionReport,
    ReplaySession,
    VerificationResult,
    Workspace,
)


SDK_VERSION = "1.0.0"


class MemoryOS:
    """Thread-safe public facade over one isolated Investigation Core instance.

    ``node_executable`` is an explicit local dependency. The default ``"node"``
    uses the caller's process lookup rules. No network or provider discovery is
    performed.
    """

    def __init__(
        self,
        *,
        node_executable: str = "node",
        binding_host: str | Path | None = None,
    ) -> None:
        self._identity = object()
        self._bridge = BridgeClient(
            node_executable,
            Path(binding_host) if binding_host is not None else default_host_path(),
        )

    def __enter__(self) -> "MemoryOS":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        """Release this SDK instance and its private local Core host."""

        self._bridge.close()

    def open_workspace(self, identifier: str) -> Workspace:
        """Create an immutable handle for an explicit Workspace identity."""

        if not isinstance(identifier, str) or not identifier:
            raise ValueError("Workspace identifier must be a non-empty string.")
        return Workspace(identifier, self._identity)

    def observe(
        self,
        workspace: Workspace,
        snapshot: Mapping[str, Any],
        *,
        identifier: str | None = None,
        operation: str | None = None,
        query: Mapping[str, Any] | None = None,
        result_code: str = "OK",
    ) -> Investigation:
        """Create an investigation from one explicit CCA-STUDIO snapshot."""

        self._require_workspace(workspace)
        if not isinstance(snapshot, Mapping):
            raise TypeError("snapshot must be a mapping")
        params: dict[str, Any] = {
            "query": thaw(query) if query is not None else None,
            "resultCode": result_code,
            "snapshot": thaw(snapshot),
            "workspaceIdentifier": workspace.identifier,
        }
        if operation is not None:
            params["operation"] = operation
        if identifier is not None:
            params["identifier"] = identifier
        return self._investigation_from_result(self._bridge.call("observe", params))

    def import_package(
        self,
        package: MemoryInvestigationPackage | bytes | bytearray | memoryview,
        *,
        identifier: str | None = None,
        supported_extensions: Sequence[str] = (),
    ) -> Investigation:
        """Import MIP bytes through the Core's MIP-owned ingestion boundary."""

        params: dict[str, Any] = {
            "bytesBase64": self._encode_package(package),
            "supportedExtensions": self._extensions(supported_extensions),
        }
        if identifier is not None:
            params["identifier"] = identifier
        return self._investigation_from_result(self._bridge.call("importPackage", params))

    def export_package(
        self,
        investigation: Investigation,
        *,
        supported_extensions: Sequence[str] | None = None,
    ) -> MemoryInvestigationPackage:
        """Export the exact canonical bytes of a MIP-backed investigation."""

        self._require_investigation(investigation)
        params: dict[str, Any] = {"investigationIdentifier": investigation.identifier}
        if supported_extensions is not None:
            params["supportedExtensions"] = self._extensions(supported_extensions)
        result = self._bridge.call("exportPackage", params)
        return MemoryInvestigationPackage(self._decode_bytes(result.get("bytesBase64")))

    def verify_package(
        self,
        package: MemoryInvestigationPackage | bytes | bytearray | memoryview,
        *,
        supported_extensions: Sequence[str] = (),
    ) -> VerificationResult:
        """Forward package verification to the canonical MIP verifier."""

        result = self._bridge.call(
            "verifyPackage",
            {
                "bytesBase64": self._encode_package(package),
                "supportedExtensions": self._extensions(supported_extensions),
            },
        )
        valid = result.get("valid") is True
        package_value = None
        if valid:
            package_value = MemoryInvestigationPackage(
                self._decode_bytes(result.get("bytesBase64")),
                str(result.get("mediaType", "application/vnd.memoryos.mip+json")),
            )
        diagnostics_value = result.get("diagnostics", [])
        diagnostics = tuple(
            freeze(item)
            for item in diagnostics_value
            if isinstance(item, Mapping)
        ) if isinstance(diagnostics_value, list) else ()
        manifest_value = result.get("manifest")
        return VerificationResult(
            valid=valid,
            status="passed" if valid else "failed",
            diagnostics=diagnostics,
            package=package_value,
            manifest=freeze(manifest_value) if isinstance(manifest_value, Mapping) else None,
        )

    def regression(
        self,
        baseline: Investigation,
        candidate: Investigation,
    ) -> RegressionReport:
        """Compare two owned investigations through the authoritative Core."""

        self._require_investigation(baseline)
        self._require_investigation(candidate)
        result = self._bridge.call(
            "regression",
            {
                "baselineInvestigationIdentifier": baseline.identifier,
                "candidateInvestigationIdentifier": candidate.identifier,
            },
        )
        value = result.get("regression")
        if not isinstance(value, Mapping):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding omitted the Cognitive Regression report.",
            )
        identifier = value.get("identifier")
        detected = value.get("regressionDetected")
        overall = value.get("overall")
        categories = value.get("categories")
        category_names = (
            "replay",
            "reflection",
            "evidence",
            "retrieval",
            "evolution",
            "verification",
            "transition",
            "lifecycle",
        )
        category_shape = (
            isinstance(categories, list)
            and tuple(
                item.get("category") if isinstance(item, Mapping) else None
                for item in categories
            ) == category_names
        )
        if (
            value.get("kind") != "MemoryOSCognitiveRegressionReport"
            or value.get("version") != "1.0.0"
            or not isinstance(identifier, str)
            or not identifier
            or not isinstance(detected, bool)
            or overall not in ("identical", "regressionDetected")
            or detected != (overall == "regressionDetected")
            or not category_shape
        ):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding returned an invalid Cognitive Regression report.",
            )
        return RegressionReport(
            identifier=identifier,
            regression_detected=detected,
            overall=overall,
            projection=freeze(value),
        )

    def investigate(
        self,
        report: RegressionReport | Mapping[str, Any],
        query: InvestigationQuery | Mapping[str, Any] | None = None,
    ) -> InvestigationResult:
        """Navigate factual evidence in a Core-produced regression report."""

        if isinstance(report, RegressionReport):
            report_value = thaw(report.projection)
        elif isinstance(report, Mapping):
            report_value = thaw(report)
            if (
                report_value.get("command") == "regression"
                and report_value.get("ok") is True
                and report_value.get("schemaVersion") == "1.0"
            ):
                report_value = report_value.get("result")
        else:
            raise TypeError("report must be a RegressionReport or JSON object")
        if not isinstance(report_value, dict):
            raise TypeError("regression report envelope must contain a JSON object result")

        if query is None:
            query_value: dict[str, Any] = {}
        elif isinstance(query, InvestigationQuery):
            query_value = {
                "category": query.category,
                "reflectionIdentifier": query.reflection_identifier,
                "transition": query.transition,
            }
        elif isinstance(query, Mapping):
            unexpected = set(query) - {
                "category",
                "reflectionIdentifier",
                "transition",
            }
            if unexpected:
                raise ValueError(
                    f"unsupported Investigation query member: {sorted(unexpected)[0]}"
                )
            query_value = thaw(query)
        else:
            raise TypeError("query must be an InvestigationQuery or mapping")

        response = self._bridge.call(
            "investigate",
            {"query": query_value, "report": report_value},
        )
        value = response.get("investigationResult")
        if not isinstance(value, Mapping):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding omitted the Cognitive Investigation result.",
            )
        identifier = value.get("identifier")
        regression_identifier = value.get("regressionIdentifier")
        workspace_identifier = value.get("workspaceIdentifier")
        status = value.get("status")
        match_count = value.get("matchCount")
        matches = value.get("matches")
        normalized_query = value.get("query")
        valid_count = (
            isinstance(match_count, int)
            and not isinstance(match_count, bool)
            and match_count >= 0
            and isinstance(matches, list)
            and len(matches) == match_count
            and (
                (status == "empty" and match_count == 0)
                or (status == "matched" and match_count > 0)
            )
        )
        if (
            value.get("kind") != "MemoryOSCognitiveInvestigationResult"
            or value.get("version") != "1.0.0"
            or not isinstance(identifier, str)
            or not identifier
            or not isinstance(regression_identifier, str)
            or not regression_identifier
            or not isinstance(workspace_identifier, str)
            or not workspace_identifier
            or not isinstance(normalized_query, Mapping)
            or status not in ("matched", "empty")
            or not valid_count
            or any(not isinstance(match, Mapping) for match in matches)
        ):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding returned an invalid Cognitive Investigation result.",
            )
        projection = freeze(value)
        return InvestigationResult(
            kind=str(value["kind"]),
            version=str(value["version"]),
            identifier=identifier,
            regression_identifier=regression_identifier,
            workspace_identifier=workspace_identifier,
            query=freeze(normalized_query),
            status=str(status),
            match_count=match_count,
            matches=tuple(freeze(match) for match in matches),
            projection=projection,
        )

    def restore(self, checkpoint: Checkpoint) -> Investigation:
        """Restore one explicit checkpoint owned by this SDK instance."""

        if not isinstance(checkpoint, Checkpoint) or checkpoint._owner is not self._identity:
            raise ValueError("Checkpoint belongs to a different MemoryOS instance.")
        return self._investigation_from_result(self._bridge.call(
            "restore",
            {"checkpointToken": checkpoint.token},
        ))

    def _load_investigation(self, identifier: str) -> Investigation:
        return self._investigation_from_result(self._bridge.call(
            "load",
            {"investigationIdentifier": identifier},
        ))

    def _observe_investigation(
        self,
        investigation: Investigation,
        snapshot: Mapping[str, Any],
        *,
        operation: str | None,
        query: Mapping[str, Any] | None,
        result_code: str,
    ) -> Investigation:
        self._require_investigation(investigation)
        if not isinstance(snapshot, Mapping):
            raise TypeError("snapshot must be a mapping")
        params: dict[str, Any] = {
            "investigationIdentifier": investigation.identifier,
            "query": thaw(query) if query is not None else None,
            "resultCode": result_code,
            "snapshot": thaw(snapshot),
        }
        if operation is not None:
            params["operation"] = operation
        return self._investigation_from_result(self._bridge.call("observe", params))

    def _trace(
        self,
        investigation: Investigation,
        selection: str | Mapping[str, Any],
    ) -> Investigation:
        self._require_investigation(investigation)
        if isinstance(selection, str):
            valid_selection = bool(selection)
        elif isinstance(selection, Mapping):
            valid_selection = any(
                isinstance(selection.get(name), str) and bool(selection.get(name))
                for name in ("selectedNodeKey", "targetIdentifier", "traceIdentifier")
            ) or isinstance(selection.get("targetReference"), Mapping)
        else:
            valid_selection = False
        if not valid_selection:
            raise ValueError("selection must identify one exact Trace target")
        return self._investigation_from_result(self._bridge.call(
            "trace",
            {
                "investigationIdentifier": investigation.identifier,
                "selection": thaw(selection),
            },
        ))

    def _open_replay(self, investigation: Investigation) -> ReplaySession:
        self._require_investigation(investigation)
        current = self._load_investigation(investigation.identifier)
        replay_identifier = self._active_replay_identifier(current)
        if replay_identifier is None:
            raise MemoryOSError(
                "INVALID_TRANSITION",
                "replay",
                "Replay is not prepared.",
            )
        return ReplaySession(current, replay_identifier)

    def _replay_action(self, session: ReplaySession, action: str) -> ReplaySession:
        self._require_investigation(session.investigation)
        with self._bridge.serialized():
            current = self._load_investigation(session.investigation.identifier)
            if self._active_replay_identifier(current) != session.replay_identifier:
                raise MemoryOSError(
                    "SESSION_MISMATCH",
                    "replay",
                    "ReplaySession no longer identifies the active deterministic Replay.",
                )
            result = self._bridge.call(
                "replay",
                {
                    "action": action,
                    "investigationIdentifier": session.investigation.identifier,
                },
            )
        return ReplaySession(
            self._investigation_from_result(result),
            session.replay_identifier,
        )

    @staticmethod
    def _active_replay_identifier(investigation: Investigation) -> str | None:
        replay = investigation.projection.get("replay")
        if not isinstance(replay, Mapping):
            return None
        identifier = replay.get("identifier")
        return identifier if isinstance(identifier, str) and identifier else None

    def _enter_comparison(
        self,
        investigation: Investigation,
        session: ComparisonSession,
    ) -> ComparisonSession:
        self._require_investigation(investigation)
        if (
            not isinstance(session, ComparisonSession)
            or session._owner is not self._identity
            or session.investigation_identifier != investigation.identifier
            or session.investigation is not None
        ):
            raise ValueError("Comparison session is not an unbound session for this investigation.")
        command: dict[str, Any] = {
            "action": "enter",
            "evolutionIdentifier": session.evolution_identifier,
        }
        result = self._bridge.call(
            "compare",
            {
                "command": command,
                "investigationIdentifier": investigation.identifier,
            },
        )
        return ComparisonSession(
            investigation_identifier=session.investigation_identifier,
            evolution_identifier=session.evolution_identifier,
            _owner=self._identity,
            investigation=self._investigation_from_result(result),
        )

    def _comparison_action(
        self,
        session: ComparisonSession,
        action: str,
        selectors: Mapping[str, Any],
    ) -> ComparisonSession:
        if session._owner is not self._identity or session.investigation is None:
            raise ValueError("Comparison session is not active in this MemoryOS instance.")
        self._require_investigation(session.investigation)
        command = {"action": action}
        command.update({key: value for key, value in selectors.items() if value is not None})
        result = self._bridge.call(
            "compare",
            {
                "command": command,
                "investigationIdentifier": session.investigation.identifier,
            },
        )
        return ComparisonSession(
            investigation_identifier=session.investigation_identifier,
            evolution_identifier=session.evolution_identifier,
            _owner=self._identity,
            investigation=self._investigation_from_result(result),
        )

    def _comparison_back(self, session: ComparisonSession) -> Investigation:
        investigation = self._comparison_action(session, "back", {}).investigation
        if investigation is None:
            raise AssertionError("active comparison lost its investigation")
        return investigation

    def _verify_investigation(self, investigation: Investigation) -> VerificationResult:
        self._require_investigation(investigation)
        result = self._bridge.call(
            "verifyInvestigation",
            {"investigationIdentifier": investigation.identifier},
        )
        current = self._investigation_from_result(result)
        verification = result.get("verification")
        if not isinstance(verification, Mapping):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "Core verification evidence is absent from the response.",
            )
        checks_value = verification.get("checks", [])
        checks = tuple(
            freeze(item)
            for item in checks_value
            if isinstance(item, Mapping)
        ) if isinstance(checks_value, list) else ()
        status = str(verification.get("status", "failed"))
        return VerificationResult(
            valid=status == "passed",
            status=status,
            checks=checks,
            investigation=current,
        )

    def _checkpoint(self, investigation: Investigation) -> Checkpoint:
        self._require_investigation(investigation)
        result = self._bridge.call(
            "checkpoint",
            {"investigationIdentifier": investigation.identifier},
        )
        return Checkpoint(
            token=str(result["checkpointToken"]),
            investigation_identifier=str(result["investigationIdentifier"]),
            workspace_identifier=str(result["workspaceIdentifier"]),
            transition_log_digest=str(result["transitionLogDigest"]),
            transition_count=int(result["transitionCount"]),
            state_digest=str(result["stateDigest"]),
            _owner=self._identity,
        )

    def _restore(self, investigation: Investigation, checkpoint: Checkpoint) -> Investigation:
        self._require_investigation(investigation)
        if not isinstance(checkpoint, Checkpoint) or checkpoint._owner is not self._identity:
            raise ValueError("Checkpoint belongs to a different MemoryOS instance.")
        if checkpoint.investigation_identifier != investigation.identifier:
            raise ValueError("Checkpoint belongs to a different investigation.")
        return self.restore(checkpoint)

    def _archive(self, investigation: Investigation) -> Investigation:
        self._require_investigation(investigation)
        return self._investigation_from_result(self._bridge.call(
            "archive",
            {"investigationIdentifier": investigation.identifier},
        ))

    def _return_to_world(self, investigation: Investigation) -> Investigation:
        self._require_investigation(investigation)
        return self._investigation_from_result(self._bridge.call(
            "returnToWorld",
            {"investigationIdentifier": investigation.identifier},
        ))

    def _investigation_from_result(self, result: Mapping[str, Any]) -> Investigation:
        projection = result.get("investigation")
        transition_log = result.get("transitionLog")
        if not isinstance(projection, Mapping) or not isinstance(transition_log, Mapping):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding omitted the investigation projection.",
            )
        availability = projection.get("availability")
        if not isinstance(availability, Mapping):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding omitted Core capability availability.",
            )
        return Investigation(
            identifier=str(projection["identifier"]),
            workspace_identifier=str(projection["workspaceIdentifier"]),
            lifecycle=str(projection["lifecycle"]),
            phase=str(projection["phase"]),
            source_kind=str(projection["sourceKind"]),
            availability=freeze(availability),
            projection=freeze(projection),
            transition_log_digest=str(transition_log["digest"]),
            transition_count=int(transition_log["count"]),
            _memory=self,
        )

    def _require_workspace(self, workspace: Workspace) -> None:
        if not isinstance(workspace, Workspace) or workspace._owner is not self._identity:
            raise ValueError("Workspace belongs to a different MemoryOS instance.")

    def _require_investigation(self, investigation: Investigation) -> None:
        if not isinstance(investigation, Investigation) or investigation._memory is not self:
            raise ValueError("Investigation belongs to a different MemoryOS instance.")

    @staticmethod
    def _extensions(values: Sequence[str]) -> list[str]:
        if isinstance(values, (str, bytes)) or any(
            not isinstance(value, str) or not value for value in values
        ):
            raise ValueError("supported_extensions must contain non-empty strings")
        return sorted(values)

    @staticmethod
    def _encode_package(
        value: MemoryInvestigationPackage | bytes | bytearray | memoryview,
    ) -> str:
        data = value.data if isinstance(value, MemoryInvestigationPackage) else bytes(value)
        return base64.b64encode(data).decode("ascii")

    @staticmethod
    def _decode_bytes(value: Any) -> bytes:
        if not isinstance(value, str):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding omitted canonical package bytes.",
            )
        try:
            return base64.b64decode(value, validate=True)
        except ValueError as error:
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private binding returned invalid package bytes.",
            ) from error
