#!/usr/bin/env python3
"""Exercise the corrected MO-1302 vendored-runtime check on temporary copies.

Read-only for the workspace: every case copies the released Action tree (and,
where needed, the vendored source files) into a fresh temporary root, applies
one mutation there, and runs verify_workspace.validate_mo1302_distribution.
Prints one JSON object mapping case name to the sorted MO-1302 errors.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

WORKSPACE = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(WORKSPACE / "tools"))
import verify_workspace as vw  # noqa: E402

ACTION = vw.MO1302_ACTION_ROOT
SDK = "repositories/cca-studio/web/js/memoryos-sdk.js"
CLI = "repositories/memoryos-cli/src/commands.js"
BUNDLED_SDK = f"{ACTION.as_posix()}/dist/vendor/{SDK}"
MANIFEST = f"{ACTION.as_posix()}/distribution-manifest.json"


def prepare(root: Path) -> None:
    shutil.copytree(WORKSPACE / ACTION, root / ACTION)
    for source in vw.MO1302_VENDOR_SOURCES:
        target = root / source
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(WORKSPACE / source, target)


def append_byte(root: Path, relative: str) -> None:
    with open(root / relative, "ab") as handle:
        handle.write(b"\n")


def rewrite_manifest_for(root: Path, relative_member: str) -> None:
    """Edit a bundled member and make the manifest describe the edited bytes."""
    member = root / ACTION / relative_member
    member.write_bytes(member.read_bytes() + b"\n")
    manifest_path = root / MANIFEST
    manifest = json.loads(manifest_path.read_bytes())
    for entry in manifest["files"]:
        if entry["path"] == relative_member:
            data = member.read_bytes()
            entry["byteCount"] = len(data)
            entry["rawSha256"] = f"sha256:{vw.sha256(data)}"
    manifest_path.write_bytes(vw.canonical_json_bytes(manifest))


def old_rule(root: Path) -> list[str]:
    """The replaced comparison, kept here only to document the original experiment."""
    errors = []
    for source in vw.MO1302_VENDOR_SOURCES:
        original = root.joinpath(*source.split("/"))
        vendored = root.joinpath(ACTION, "dist", "vendor", *source.split("/"))
        if original.read_bytes() != vendored.read_bytes():
            errors.append(f"MO-1302 vendored runtime source differs from '{source}'")
    return errors


CASES = {
    "unchanged": lambda root: None,
    "sdk_source_one_byte": lambda root: append_byte(root, SDK),
    "cli_source_one_byte": lambda root: append_byte(root, CLI),
    "bundled_sdk_one_byte": lambda root: append_byte(root, BUNDLED_SDK),
    "bundled_entrypoint_one_byte": lambda root: append_byte(root, f"{ACTION.as_posix()}/dist/index.js"),
    "bundled_sdk_with_consistent_manifest": lambda root: rewrite_manifest_for(root, f"dist/vendor/{SDK}"),
    "bundled_file_added": lambda root: (root / ACTION / "dist" / "extra.js").write_bytes(b"export {};\n"),
    "bundled_file_removed": lambda root: (root / ACTION / "dist" / "cli-driver.mjs").unlink(),
    "manifest_one_byte": lambda root: append_byte(root, MANIFEST),
}

results: dict[str, dict[str, list[str]]] = {}
for name, mutate in CASES.items():
    with tempfile.TemporaryDirectory(prefix="mo1308-wscheck-") as directory:
        root = Path(directory)
        prepare(root)
        mutate(root)
        errors: list[str] = []
        vw.validate_mo1302_distribution(root, errors)
        results[name] = {"corrected": sorted(errors), "replacedRule": sorted(old_rule(root)) if name.endswith("source_one_byte") else []}
print(json.dumps(results, sort_keys=True))
