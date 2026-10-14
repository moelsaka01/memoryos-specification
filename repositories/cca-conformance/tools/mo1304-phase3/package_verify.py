"""Offline verification of the immutable MO-1304 Phase 2 candidate.

Certification tooling only. Never builds, repacks, or executes the product.
"""
import hashlib
import json
import re
import stat
import struct
import zlib
from pathlib import Path

ARCHIVE = "memoryos-mcp-0.1.0.tgz"
ARCHIVE_ID = (2663183, "9a21b51abfd2bed3f403e154b99aff4a266792a385b9aec5d40b1ea150da6cf8")
IDENTITIES = {
    "distribution/distribution-manifest.json": (116671, "5d6ae0a3657e4319e9882f9a37065bea8e6eb48fe8d69eb526ca6731f1f3eb48"),
    "runtime/runtime-closure-manifest.json": (5566, "0b910e64f40b562d62c9a053c98833b439f78abd195d9604386e74e0d20d961d"),
    "distribution/dependency-lock.json": (6643, "bc5fe0dbbad8cd46f3562420c39b721fde59500294c3f55fd39f585a733181df"),
    "distribution/dependency-closure.json": (109812, "30d1057ce8c8f46a75c7e2278e1e6f401934766393fa39755bd1de503ddae686"),
    "contracts/policy-contract-identities-1.0.0.json": (933, "d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65"),
    "contracts/limits.json": (613, "7dfff1ae4563a0a76f8b4fc1b3f4832a2b503a653f119f178246a117b0674dc3"),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def identity(data):
    return {"byteLength": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def check_identity(data, expected):
    require((len(data), hashlib.sha256(data).hexdigest()) == expected, "IDENTITY_MISMATCH")


def canonical(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def safe(name):
    require(re.fullmatch(r"[a-zA-Z0-9_.@/-]+", name) is not None, "MEMBER_CHARACTERS")
    for part in name.split("/"):
        require(part not in ("", ".", "..") and not part.endswith("."), "MEMBER_PATH")
        require(not re.match(r"(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)", part), "MEMBER_DEVICE")
    return name


def archive_members(data):
    require(18 < len(data) <= 64 * 1024 * 1024 and data[:4] == b"\x1f\x8b\x08\x00", "GZIP_HEADER")
    inflater = zlib.decompressobj(-15)
    tar = inflater.decompress(data[10:], 64 * 1024 * 1024 + 1)
    require(len(tar) <= 64 * 1024 * 1024 and inflater.eof and not inflater.unconsumed_tail, "GZIP_BOUND")
    require(len(inflater.unused_data) == 8, "GZIP_TRAILING")
    require(struct.unpack("<II", inflater.unused_data) == (zlib.crc32(tar), len(tar)), "GZIP_CRC_SIZE")
    require(len(tar) % 512 == 0, "TAR_BLOCKS")

    def string(raw):
        parts = raw.split(b"\0", 1)
        require(len(parts) == 1 or not any(parts[1]), "TAR_STRING_PADDING")
        return parts[0].decode("ascii")

    def octal(raw):
        value = raw.rstrip(b"\0 ").lstrip(b" ")
        require(re.fullmatch(b"[0-7]+", value) is not None, "TAR_NUMBER")
        return int(value, 8)

    members, folded, offset = {}, set(), 0
    while offset + 512 <= len(tar):
        h = tar[offset:offset + 512]
        offset += 512
        if not any(h):
            require(offset + 512 <= len(tar) and not any(tar[offset:]), "TAR_TERMINATOR")
            return members
        require(octal(h[148:156]) == sum(h[:148]) + 8 * 32 + sum(h[156:]), "TAR_CHECKSUM")
        require(string(h[257:263]) == "ustar", "TAR_FORMAT")
        prefix = string(h[345:500])
        name = safe((prefix + "/" if prefix else "") + string(h[:100]))
        require(name.startswith("package/"), "TAR_ROOT")
        name = safe(name[8:])
        require(name.lower() not in folded and len(members) < 20000, "TAR_DUPLICATE_OR_COUNT")
        folded.add(name.lower())
        require(h[156] in (0, 48) and string(h[157:257]) == "", "TAR_TYPE")
        require(octal(h[100:108]) in (0o644, 0o755), "TAR_MODE")
        size = octal(h[124:136])
        padded = (size + 511) // 512 * 512
        require(size <= 16 * 1024 * 1024 and offset + padded <= len(tar), "TAR_SIZE")
        require(not any(tar[offset + size:offset + padded]), "TAR_PADDING")
        members[name] = tar[offset:offset + size]
        offset += padded
    raise ValueError("TAR_UNTERMINATED")


def verify_members(members):
    require(len(members) == 798, "FILE_COUNT")
    for path, expected in IDENTITIES.items():
        check_identity(members[path], expected)
    name = "distribution/distribution-manifest.json"
    manifest = json.loads(members[name])
    require(canonical(manifest) == members[name], "MANIFEST_CANONICAL")
    files = manifest["files"]
    require([x["path"] for x in files] == sorted(set(x["path"] for x in files)), "MANIFEST_ORDER")
    require(set(members) == {x["path"] for x in files} | {name}, "MANIFEST_FILE_SET")
    for entry in files:
        safe(entry["path"])
        require(set(entry) == {"path", "byteLength", "sha256"}, "MANIFEST_KEYS")
        check_identity(members[entry["path"]], (entry["byteLength"], entry["sha256"]))
    for path, count, prefix in [("runtime/runtime-closure-manifest.json", 25, "runtime/"), ("distribution/dependency-closure.json", 748, "")]:
        closure = json.loads(members[path])["files"]
        require(len(closure) == count, "CLOSURE_COUNT")
        for entry in closure:
            check_identity(members[prefix + safe(entry["path"])], (entry["byteLength"], entry["sha256"]))
    pkg = json.loads(members["package.json"])
    require(pkg["name"] == "memoryos-mcp" and pkg["version"] == "0.1.0" and pkg["private"] is True, "PACKAGE_METADATA")
    require(pkg["engines"] == {"node": "24.21.0"}, "PACKAGE_NODE")
    require(pkg["dependencies"] == {"@modelcontextprotocol/core": "2.0.0", "@modelcontextprotocol/server": "2.0.0", "zod": "4.6.5"}, "PACKAGE_DEPENDENCIES")
    return {"archiveFiles": len(members), "runtimeFiles": 25, "dependencyFiles": 748, "identities": {p: identity(members[p]) for p in IDENTITIES}}


def verify_archive(path):
    path = Path(path)
    require(path.name == ARCHIVE, "ARCHIVE_FILENAME")
    require(path.stat().st_size == ARCHIVE_ID[0], "ARCHIVE_LENGTH")
    data = path.read_bytes()
    check_identity(data, ARCHIVE_ID)
    return verify_members(archive_members(data))


def verify_installed(root):
    root = Path(root)
    require(root.is_dir() and not root.is_symlink(), "INSTALL_ROOT")
    members = {}
    for path in root.rglob("*"):
        info = path.lstat()
        require(not stat.S_ISLNK(info.st_mode), "INSTALL_SYMLINK")
        if stat.S_ISDIR(info.st_mode):
            continue
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= 16 * 1024 * 1024, "INSTALL_FILE")
        require(len(members) < 20000, "INSTALL_COUNT")
        members[safe(path.relative_to(root).as_posix())] = path.read_bytes()
    require(len({p.lower() for p in members}) == len(members), "INSTALL_CASE_COLLISION")
    return verify_members(members)


if __name__ == "__main__":
    import sys
    require(len(sys.argv) == 3 and sys.argv[1] in ("archive", "installed"), "USAGE")
    print(canonical((verify_archive if sys.argv[1] == "archive" else verify_installed)(sys.argv[2])).decode(), end="")
