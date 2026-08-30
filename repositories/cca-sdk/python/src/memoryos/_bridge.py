"""Private JSONL transport to the single JavaScript Investigation Core."""

from __future__ import annotations

import json
import os
import subprocess
import threading
import weakref
from contextlib import contextmanager
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from ._errors import Diagnostic, MemoryOSBindingError, MemoryOSError
from ._immutable import thaw


PROTOCOL_VERSION = "1.0.0"
MAX_MESSAGE_BYTES = 64 * 1024 * 1024


def default_host_path() -> Path:
    return Path(__file__).resolve().parents[3] / "bridge" / "investigation-core-host.mjs"


def _stop_process(process: subprocess.Popen[bytes]) -> None:
    try:
        if process.poll() is None and process.stdin is not None:
            process.stdin.close()
        if process.poll() is None:
            process.wait(timeout=2)
    except (OSError, subprocess.TimeoutExpired):
        process.terminate()
        try:
            process.wait(timeout=2)
        except (OSError, subprocess.TimeoutExpired):
            process.kill()
            process.wait()
    finally:
        for stream in (process.stdin, process.stdout, process.stderr):
            if stream is not None and not stream.closed:
                stream.close()


class BridgeClient:
    """Owns one private process and therefore one isolated Investigation Core."""

    def __init__(self, node_executable: str, host_path: Path) -> None:
        if not host_path.is_file():
            raise MemoryOSBindingError(
                "BINDING_UNAVAILABLE",
                "binding",
                f"Investigation Core host does not exist: {host_path}",
            )
        try:
            self._process = subprocess.Popen(
                [node_executable, str(host_path)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        except OSError as error:
            raise MemoryOSBindingError(
                "BINDING_UNAVAILABLE",
                "binding",
                f"Unable to start the private Investigation Core host: {error}",
            ) from error
        self._lock = threading.RLock()
        self._next_id = 0
        self._closed = False
        self._finalizer = weakref.finalize(self, _stop_process, self._process)
        health = self.call("health", {})
        if health.get("protocolVersion") != PROTOCOL_VERSION:
            self.close()
            raise MemoryOSBindingError(
                "UNSUPPORTED_PROTOCOL",
                "binding",
                "The private Investigation Core host uses an unsupported protocol.",
            )

    def call(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            if self._closed:
                raise MemoryOSBindingError(
                    "BINDING_CLOSED",
                    "binding",
                    "The MemoryOS SDK instance is closed.",
                )
            request_id = self._next_id
            self._next_id += 1
            request = {
                "id": request_id,
                "method": method,
                "params": thaw(params),
                "version": PROTOCOL_VERSION,
            }
            payload = json.dumps(
                request,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8") + b"\n"
            if len(payload) > MAX_MESSAGE_BYTES:
                raise MemoryOSBindingError(
                    "RESOURCE_LIMIT_EXCEEDED",
                    "binding",
                    "The private binding request exceeds its resource policy.",
                )
            if self._process.stdin is None or self._process.stdout is None:
                raise self._terminated_error()
            try:
                self._process.stdin.write(payload)
                self._process.stdin.flush()
                response_bytes = self._process.stdout.readline(MAX_MESSAGE_BYTES + 1)
            except OSError as error:
                raise self._terminated_error() from error
            if not response_bytes:
                raise self._terminated_error()
            if len(response_bytes) > MAX_MESSAGE_BYTES:
                raise MemoryOSBindingError(
                    "RESOURCE_LIMIT_EXCEEDED",
                    "binding",
                    "The private binding response exceeds its resource policy.",
                )
            try:
                response = json.loads(response_bytes)
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise MemoryOSBindingError(
                    "INVALID_RESPONSE",
                    "binding",
                    "The private Investigation Core host returned invalid JSON.",
                ) from error
            if (
                not isinstance(response, dict)
                or response.get("version") != PROTOCOL_VERSION
                or response.get("id") != request_id
                or not isinstance(response.get("ok"), bool)
            ):
                raise MemoryOSBindingError(
                    "INVALID_RESPONSE",
                    "binding",
                    "The private Investigation Core host returned an invalid envelope.",
                )
            if response["ok"]:
                result = response.get("result")
                if not isinstance(result, dict):
                    raise MemoryOSBindingError(
                        "INVALID_RESPONSE",
                        "binding",
                        "The private Investigation Core result must be an object.",
                    )
                return result
            self._raise_core_error(response.get("error"))
        raise AssertionError("unreachable")

    @contextmanager
    def serialized(self) -> Iterator[None]:
        """Keep a facade-level read/check/command sequence indivisible."""

        with self._lock:
            yield

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            self._finalizer()

    def _terminated_error(self) -> MemoryOSBindingError:
        detail = ""
        if self._process.stderr is not None and self._process.poll() is not None:
            try:
                detail = self._process.stderr.read(4096).decode("utf-8", "replace").strip()
            except OSError:
                detail = ""
        message = "The private Investigation Core host terminated unexpectedly."
        if detail:
            message = f"{message} {detail}"
        return MemoryOSBindingError("BINDING_TERMINATED", "binding", message)

    @staticmethod
    def _raise_core_error(value: Any) -> None:
        if not isinstance(value, dict):
            raise MemoryOSBindingError(
                "INVALID_RESPONSE",
                "binding",
                "The private Investigation Core error envelope is invalid.",
            )
        diagnostics_value = value.get("diagnostics", [])
        diagnostics = tuple(
            Diagnostic.from_value(item)
            for item in diagnostics_value
            if isinstance(item, dict)
        ) if isinstance(diagnostics_value, list) else ()
        error_type = (
            MemoryOSBindingError
            if str(value.get("operation", "binding")) == "binding"
            else MemoryOSError
        )
        raise error_type(
            str(value.get("code", "BINDING_FAILURE")),
            str(value.get("operation", "binding")),
            str(value.get("message", "MemoryOS operation failed.")),
            diagnostics,
        )
