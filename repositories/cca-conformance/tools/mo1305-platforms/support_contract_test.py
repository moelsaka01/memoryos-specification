"""Contract fixtures only; creates no implementation or certification evidence."""
import copy
import json
from pathlib import Path
from support_contract import load_policy, validate_policy, validate_environment

policy = load_policy()
negative = 0


def rejects(fn, value):
    global negative
    try:
        fn(value)
    except ValueError:
        negative += 1
    else:
        raise AssertionError("MUTATED_CONTRACT_ACCEPTED")


for field, value in policy.items():
    mutated = copy.deepcopy(policy)
    mutated[field] = None
    rejects(validate_policy, mutated)
for key in ("supported", "measurement", "certification"):
    for platform in ("ubuntu-24.04-x64", "linux", "windows-vm"):
        mutated = copy.deepcopy(policy)
        mutated[key].append(platform)
        rejects(validate_policy, mutated)
for key in ("ubuntu", "linux", "vm", "crossPlatformParity", "parityReceipt"):
    mutated = copy.deepcopy(policy)
    mutated[key] = "REQUIRED"
    rejects(validate_policy, mutated)
mutated = copy.deepcopy(policy)
mutated["requiredPlatformReceipts"] = 2
rejects(validate_policy, mutated)
environment = {"edition": "Microsoft Windows 11 Home", "release": "25H2",
               "build": "26200.9457", "architecture": "x64"}
validate_environment(environment)
# Earlier Windows 11 builds remain in the support family, not execution claims.
validate_environment({**environment, "release": "23H2", "build": "22631.1"})
for field in environment:
    mutated = dict(environment)
    del mutated[field]
    rejects(validate_environment, mutated)
for field, value in (("edition", "Ubuntu 24.04"), ("architecture", "arm64"),
                     ("release", ""), ("build", "26200"), ("build", "19045.1")):
    rejects(validate_environment, {**environment, field: value})
root = Path(__file__).resolve().parents[4]
freeze = (root / "docs/mo1305-contract-freeze-1.md").read_text(encoding="utf-8")
for forbidden in ("on both targets", "on both platforms", "both OS targets", "both-target",
                  "Exactly two sorted records", "two-platform/SDK/MCP parity",
                  "requires both platform PASS", "| parity |", "| Linux x64 |"):
    assert forbidden not in freeze, forbidden
for required in ("platformCorrectionRevision", "30 cold", "100 warm", "60-second",
                 "three-repetition", "1.5 * observedPeak", "Node.js 24.21.0",
                 "12.2 Independent semantic parity", "raw TLS", "TLS 1.3",
                 "security/resource/package gate", "existing physical Windows 11 x64"):
    assert required in freeze, required
for path in ("docs/mo1305-rest-gateway.md", "docs/mo1305-contract-freeze-1.md", "ROADMAP.md"):
    assert "mo1305-contract-freeze-1-platform-correction.md" in (root / path).read_text(encoding="utf-8")
print(json.dumps({"status": "PASS", "scope": "PLATFORM_CONTRACT_FIXTURES_ONLY",
                  "negativeWitnesses": negative, "executionEvidenceCreated": False}))
