"""Prospective MO-1305 platform contract; no execution certification."""
import json
import re
from pathlib import Path

POLICY = {
    "kind": "MemoryOSRESTPlatformPolicy", "version": "1.0.0",
    "supported": ["windows-11-x64"], "measurement": ["windows-11-x64"],
    "certification": ["windows-11-x64"], "requiredPlatformReceipts": 1,
    "ubuntu": "NOT_REQUIRED", "linux": "NOT_REQUIRED", "vm": "NOT_REQUIRED",
    "crossPlatformParity": "NOT_REQUIRED", "parityReceipt": "NOT_REQUIRED",
    "host": "EXISTING_PHYSICAL_WINDOWS", "node": "24.21.0", "npm": "11.19.0",
    "nodeSha256": "ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32",
    "semanticParity": "REQUIRED", "realHTTP": "REQUIRED",
    "securityGates": "REQUIRED", "resourceGates": "REQUIRED",
    "coldSamples": 30, "warmSamples": 100, "adverseSeconds": 60,
    "adverseRepetitions": 3, "headroomAndCeilings": "UNCHANGED",
    "actualEnvironmentRequired": ["edition", "release", "build", "architecture"],
}


def validate_policy(value):
    if json.dumps(value, sort_keys=True, separators=(",", ":")) != json.dumps(POLICY, sort_keys=True, separators=(",", ":")):
        raise ValueError("MO1305_PLATFORM_CONTRACT")


def validate_environment(value):
    if set(value) != set(POLICY["actualEnvironmentRequired"]):
        raise ValueError("MO1305_ACTUAL_ENVIRONMENT_KEYS")
    if not isinstance(value["edition"], str) or not value["edition"].startswith("Microsoft Windows 11 "):
        raise ValueError("MO1305_WINDOWS_EDITION")
    if value["architecture"] != "x64":
        raise ValueError("MO1305_WINDOWS_ARCHITECTURE")
    if not isinstance(value["release"], str) or re.fullmatch(r"[0-9]{2}H[12]", value["release"]) is None:
        raise ValueError("MO1305_ACTUAL_RELEASE")
    if not isinstance(value["build"], str) or re.fullmatch(r"[0-9]{5}\.[0-9]+", value["build"]) is None:
        raise ValueError("MO1305_ACTUAL_BUILD")
    if int(value["build"].split(".")[0]) < 22000:
        raise ValueError("MO1305_WINDOWS_11_BUILD")


def load_policy():
    value = json.loads(Path(__file__).with_name("support-policy.json").read_text())
    validate_policy(value)
    return value
