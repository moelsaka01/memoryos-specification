"""Deliver real CTRL_C only to the product's dedicated hidden Windows console."""
from pathlib import Path
import ctypes
import hashlib
import json
import os
import socket
import ssl
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[4]
CACHE = ROOT / ".cache/mo1305-phase2a"
NODE_HASH = "ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32"
PWSH = Path("C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe")


def clean_environment():
    return {key: value for key, value in os.environ.items()
            if key.upper() in ["SYSTEMROOT", "WINDIR", "TEMP", "TMP"]}


def hidden_console():
    info = subprocess.STARTUPINFO()
    info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    info.wShowWindow = subprocess.SW_HIDE
    return info


def send_control(target_pid):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.FreeConsole()
    if not kernel.AttachConsole(target_pid):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        ids = (ctypes.c_uint32 * 4)()
        count = kernel.GetConsoleProcessList(ids, len(ids))
        # Never broadcast into a console shared with the user or another task.
        assert count == 2 and set(ids[:count]) == {target_pid, os.getpid()}, "NON_PRIVATE_CONSOLE"
        if not kernel.SetConsoleCtrlHandler(None, True):
            raise ctypes.WinError(ctypes.get_last_error())
        if not kernel.GenerateConsoleCtrlEvent(0, 0):
            raise ctypes.WinError(ctypes.get_last_error())
        time.sleep(0.2)
        return {"event": "CTRL_C_EVENT", "targetPid": target_pid, "privateConsoleVerified": True}
    finally:
        kernel.FreeConsole()


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def readiness(config):
    token = Path(config["tokenFile"]).read_text(encoding="ascii")
    assert len(token) == 64
    host, port = config.get("bindAddress", "127.0.0.1"), config.get("port", 13050)
    context = ssl.create_default_context(cafile=config["certificateFile"])
    context.minimum_version = ssl.TLSVersion.TLSv1_3
    context.maximum_version = ssl.TLSVersion.TLSv1_3
    context.set_alpn_protocols(["http/1.1"])
    with socket.create_connection((host, port), timeout=3) as transport:
        with context.wrap_socket(transport, server_hostname=host) as client:
            protocol = client.version()
            assert protocol == "TLSv1.3" and client.selected_alpn_protocol() == "http/1.1"
            client.sendall((f"GET /v1/readiness HTTP/1.1\r\nHost: {host}:{port}\r\n"
                            f"Authorization: Bearer {token}\r\nConnection: close\r\n"
                            "Accept-Encoding: identity\r\n\r\n").encode("ascii"))
            result = bytearray()
            while True:
                part = client.recv(16384)
                if not part:
                    break
                result.extend(part)
                assert len(result) <= 131072, "UNBOUNDED_READINESS_RESPONSE"
    head, body = bytes(result).split(b"\r\n\r\n", 1)
    assert head.startswith(b"HTTP/1.1 200 ")
    assert json.loads(body) == {"ready": True, "status": "ok"}
    return protocol


def main(node, stage):
    node, stage = node.resolve(), stage.resolve()
    assert node == (CACHE / "toolchain/node.exe").resolve(), "UNEXPECTED_NODE_PATH"
    assert stage.parent == CACHE.resolve() and stage.name.startswith("session-"), "UNEXPECTED_STAGE"
    assert sha256(node) == NODE_HASH, "PINNED_NODE_HASH"
    config_path = stage / "private/config.json"
    config = json.loads(config_path.read_bytes())
    validation = subprocess.run(
        [str(PWSH), "-NoLogo", "-NoProfile", "-NonInteractive", "-File",
         str(ROOT / "repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1"),
         "-NodePath", str(node), "-ConfigPath", str(config_path)],
        env=clean_environment(), capture_output=True, timeout=20,
        creationflags=subprocess.CREATE_NO_WINDOW)
    assert validation.returncode == 0, "TRUSTED_LAUNCH_REFUSED"
    assert validation.stdout.strip() == b"MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS"
    child = subprocess.Popen(
        [str(node), str(stage / "package/bin/memoryos-rest.mjs"), "--config", str(config_path)],
        env=clean_environment(), cwd=stage / "empty",
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NEW_CONSOLE, startupinfo=hidden_console())
    ready, logs, stdout = threading.Event(), bytearray(), bytearray()

    def drain(stream, capture, watch_startup=False):
        for line in iter(stream.readline, b""):
            capture.extend(line)
            if len(capture) > 65536:
                child.kill()
                return
            if watch_startup and b'"event":"startup"' in line:
                ready.set()

    threads = [
        threading.Thread(target=drain, args=(child.stderr, logs, True), daemon=True),
        threading.Thread(target=drain, args=(child.stdout, stdout), daemon=True)]
    for thread in threads:
        thread.start()
    try:
        assert ready.wait(15), "SIGNAL_START_TIMEOUT"
        assert child.poll() is None, "SIGNAL_EARLY_EXIT"
        protocol = readiness(config)
        began = time.perf_counter_ns()
        sender = subprocess.run(
            [sys.executable, "-B", str(Path(__file__).resolve()), "--send", str(child.pid)],
            capture_output=True, env=clean_environment(), timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW)
        assert sender.returncode == 0, "CONTROL_DELIVERY_FAILED"
        delivery = json.loads(sender.stdout)
        assert child.wait(timeout=16) == 0, "SIGNAL_EXIT"
        elapsed_ms = (time.perf_counter_ns() - began) // 1000000
        for thread in threads:
            thread.join(timeout=2)
            assert not thread.is_alive(), "LOG_DRAIN_TIMEOUT"
        assert stdout == b"", "UNEXPECTED_STDOUT"
        parsed_logs = [json.loads(line) for line in bytes(logs).splitlines() if line]
        assert sum(row["event"] == "startup" for row in parsed_logs) == 1
        assert sum(row["event"] == "shutdown" for row in parsed_logs) == 1
        assert not any(row["event"] == "fatal" for row in parsed_logs)
        assert Path(config["tokenFile"]).read_bytes() not in logs
        host, port = config.get("bindAddress", "127.0.0.1"), config.get("port", 13050)
        with socket.socket() as probe:
            probe.settimeout(1)
            assert probe.connect_ex((host, port)) != 0, "SIGNAL_LISTENER_LEAK"
        record = {
            "kind": "MemoryOSRESTPhase2AWindowsSignalResults", "version": "1.0.0",
            "state": "PASS", "cases": 1, "passed": 1,
            "nodeSha256": NODE_HASH,
            "stagedDistributionManifestSha256": sha256(stage / "package/distribution-manifest.json"),
            "records": [{
                "id": "LIFECYCLE-Windows-CTRL-C-SIGINT", "state": "PASS",
                "elapsedMs": elapsed_ms, "exitCode": child.returncode,
                "tlsVersion": protocol, "readyBeforeSignal": True,
                "listenerClosed": True, "delivery": delivery}],
            "sigterm": "Windows provides no native POSIX SIGTERM delivery. ChildProcess.kill(SIGTERM) "
                       "forcibly terminates on Windows; no native SIGTERM handler test is claimed.",
            "startupSignal": "No deterministic pre-READY marker exists on the normal product entry. "
                             "This receipt claims CTRL_C after authenticated TLS readiness only."
        }
        (CACHE / "signals-results.json").write_text(
            json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
        print(json.dumps({"state": "PASS", "cases": 1, "passed": 1, "elapsedMs": elapsed_ms}))
    finally:
        if child.poll() is None:
            child.stdin.close()
            try:
                child.wait(timeout=17)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=5)
        for stream in [child.stdin, child.stdout, child.stderr]:
            if stream and not stream.closed:
                stream.close()


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--send":
        print(json.dumps(send_control(int(sys.argv[2]))))
    else:
        assert len(sys.argv) == 3, "Usage: signals.py <pinned-node> <stage-directory>"
        main(Path(sys.argv[1]), Path(sys.argv[2]))
