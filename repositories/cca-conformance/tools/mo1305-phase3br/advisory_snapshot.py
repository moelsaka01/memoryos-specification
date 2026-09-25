"""Bounded Phase 3B-R supply-chain snapshot and local identity validation.

--write performs the specifically enumerated public-source retrievals and writes
new continuation evidence. Default mode validates the saved evidence offline.
It never claims that the reviewed components have zero vulnerabilities.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import html
import json
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[4]
EVIDENCE = ROOT / "repositories/cca-conformance/evidence/mo1305-phase3br"
PACKAGE = ROOT / "repositories/memoryos-rest"
TOOLCHAIN = ROOT / ".cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64"
EXCLUDED_METADATA = {"modules", "napi", "cldr", "tz", "unicode"}
NODE_RELEASE = "https://nodejs.org/en/blog/release/v24.21.0"
NODE_INDEX = "https://nodejs.org/en/blog/vulnerability"
NODE_JULY = NODE_INDEX + "/july-2026-security-releases"
OPENSSL = "https://openssl-library.org/news/vulnerabilities-3.5/"
LLHTTP = "https://github.com/nodejs/llhttp/releases/tag/release%2Fv9.4.3"
LIMITS = [
    "Bounded review of exact shipped first-party sources and external Node/npm toolchain; not an exhaustive historical CVE census.",
    "Node release/security publication stream is the consolidated review source for embedded components without a separate selected advisory.",
    "npm bundled tools are external, not shipped gateway npm dependencies; their entire transitive advisory graph was not independently scanned.",
    "No vulnerability-free, zero-vulnerability, blanket licensing, or legal-rights conclusion is made.",
    "Upstream pages and their publication coverage can lag disclosure; source retrieval date does not establish completeness.",
]
def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode() + b"\n"
def read(path):
    return json.loads(path.read_text(encoding="utf-8"))
def identity(path):
    b = path.read_bytes()
    return {"path": path.relative_to(ROOT).as_posix(), "byteLength": len(b), "sha256": hashlib.sha256(b).hexdigest()}
def require(condition, code):
    if not condition:
        raise RuntimeError(code)
def local_facts():
    dep = read(PACKAGE / "dependency-manifest.json")
    sbom = read(PACKAGE / "sbom.spdx.json")
    allow = read(ROOT / "repositories/cca-conformance/tools/mo1305-phase3-correction/package-allowlist.json")
    actual = json.loads(subprocess.check_output([str(TOOLCHAIN / "node.exe"), "-p", "JSON.stringify(process.versions)"], text=True, timeout=30))
    require(actual == dep["runtime"]["components"] == allow["runtimeComponents"], "ADVISORY_COMPONENT_IDENTITY")
    require(identity(TOOLCHAIN / "node.exe")["sha256"] == allow["nodeSha256"], "ADVISORY_NODE_IDENTITY")
    npm = read(TOOLCHAIN / "node_modules/npm/package.json")
    require(npm["version"] == dep["runtime"]["npm"] == "11.19.0", "ADVISORY_NPM_VERSION")
    require(identity(TOOLCHAIN / "node_modules/npm/bin/npm-cli.js")["sha256"] == allow["npmCliSha256"], "ADVISORY_NPM_IDENTITY")
    expected = {k: v for k, v in actual.items() if v and k not in EXCLUDED_METADATA}
    expected.update({"npm": "11.19.0", "memoryos-rest": "0.1.0", "memoryos-authoritative-closure": "1.1.0"})
    observed = {p["name"]: p["versionInfo"] for p in sbom["packages"]}
    require(observed == expected and len(observed) == len(sbom["packages"]) == 25, "ADVISORY_SBOM_SCOPE")
    require(len(sbom["files"]) == 56 and len(sbom["relationships"]) == 81, "ADVISORY_SBOM_COUNTS")
    pins = {x["path"]: x for x in allow["immutable"]}
    notices = []
    for name in ("LICENSE-NOTICE.md", "NOTICES.md", "notices/node-LICENSE.txt"):
        got = identity(PACKAGE / name)
        require(got["byteLength"] == pins[name]["byteLength"] and got["sha256"] == pins[name]["sha256"], "ADVISORY_NOTICE_IDENTITY")
        notices.append(got)
    require((PACKAGE / "notices/node-LICENSE.txt").read_bytes() == (TOOLCHAIN / "LICENSE").read_bytes(), "ADVISORY_OFFICIAL_NODE_LICENSE")
    require(npm["license"] == "Artistic-2.0", "ADVISORY_NPM_LICENSE")
    npm_license = TOOLCHAIN / "node_modules/npm/LICENSE"
    require("Artistic License" in npm_license.read_text(encoding="utf-8"), "ADVISORY_NPM_LICENSE_TEXT")
    require(all(p["licenseConcluded"] == "NOASSERTION" for p in sbom["packages"]), "ADVISORY_NO_BLANKET_LICENSE")
    require(sum(p["filesAnalyzed"] for p in sbom["packages"]) == 2, "ADVISORY_EXTERNAL_TREATMENT")
    return dep, sbom, {
        "kind": "MemoryOSRESTPhase3BRLicensesComponents", "version": "1.0.0", "state": "PASS",
        "packageCount": 25, "fileCount": 56, "relationshipCount": 81,
        "shippedPackageCount": 2, "externalToolchainPackageCount": 23,
        "externalProductionNpmDependencies": 0, "zeroDependenciesMeansZeroSupplyChain": False,
        "sbom": identity(PACKAGE / "sbom.spdx.json"), "dependencyManifest": identity(PACKAGE / "dependency-manifest.json"),
        "runtimeClosure": identity(PACKAGE / "runtime/runtime-closure-manifest.json"),
        "notices": notices, "officialNodeLicense": identity(TOOLCHAIN / "LICENSE"),
        "officialNodeLicenseByteForByteEqual": True, "npmLicense": identity(npm_license),
        "npmPackageMetadata": identity(TOOLCHAIN / "node_modules/npm/package.json"),
        "npmPrimaryDeclaredLicense": npm["license"],
        "actualRuntimeComponents": actual,
        "metadataOnly": {k: actual[k] for k in sorted(EXCLUDED_METADATA)},
        "emptyComponentsExcluded": [k for k, v in actual.items() if not v],
        "packages": [{k: p[k] for k in ("SPDXID", "name", "versionInfo", "filesAnalyzed", "licenseDeclared", "licenseConcluded")} for p in sbom["packages"]],
        "conclusion": "Pinned notices preserved; full Node LICENSE equals the official distribution. Primary declared grants do not replace nested grants. First-party, SQLite and internal-helper rights remain NOASSERTION. No blanket license grant or independent legal-rights determination.",
    }

def fetch(url, sources, snapshot):
    request = urllib.request.Request(url, headers={"User-Agent": "MO1305-Phase3BR-bounded-release-review", "Accept": "application/vnd.github+json" if "api.github.com" in url else "text/html"})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(4_000_001)
        require(len(raw) <= 4_000_000, "ADVISORY_SOURCE_BOUND")
        sources.append({"url": url, "retrievedAtUtc": snapshot, "httpStatus": response.status,
                        "byteLength": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
                        "retrieval": "direct public HTTPS; selected fields retained, complete upstream body not redistributed"})
        return raw.decode("utf-8")
def plain(text):
    text = re.sub(r"<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>", "", text, flags=re.S|re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text)))
def create_snapshot(dep, sbom):
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    require(stamp.startswith("2026-09-25"), "ADVISORY_SNAPSHOT_DATE")
    sources, advisories = [], []
    release = plain(fetch(NODE_RELEASE, sources, stamp))
    require(all(s in release for s in ("24.21.0", "3.5.8", "7.29.1")), "ADVISORY_NODE_RELEASE")
    index = plain(fetch(NODE_INDEX, sources, stamp))
    require("July 29, 2026" in index, "ADVISORY_NODE_INDEX")
    july = plain(fetch(NODE_JULY, sources, stamp))
    require("24.18.1" in july, "ADVISORY_NODE_FIXED_RELEASE")
    node_ids = {"56846": "High", "56848": "High", "58043": "High", "56850": "Medium", "58040": "Medium", "58041": "Medium", "58042": "Medium", "58045": "Medium", "56847": "Low", "58039": "Low", "58044": "Low"}
    for suffix, severity in node_ids.items():
        cve = "CVE-2026-" + suffix
        require(cve in july, "ADVISORY_NODE_CVE")
        advisories.append({"component": "node", "version": "24.21.0", "advisory": cve,
            "source": NODE_JULY, "severity": severity, "severityAuthority": "Node.js Project",
            "publishedDate": "2026-07-29", "fixedVersion": "24.18.1",
            "applicability": "Selected same-major release follows the official fixed release.",
            "disposition": "FIXED_VERSION_SELECTED"})
    ssl = plain(fetch(OPENSSL, sources, stamp))
    ssl_ids = ["75803", "14457", "18798", "54874", "63072", "63073", "63074", "63075", "63076", "14456"]
    for suffix in ssl_ids:
        cve = "CVE-2026-" + suffix
        match = re.search(re.escape(cve) + r"\s+Severity\s+(Low|Moderate|High|Critical)\s+Published at\s+(.+?)\s+Title\s+(.+?)\s+Found by\s+(.+?)\s+Affected\s+(.+?)\s+References", ssl)
        require(match is not None, "ADVISORY_OPENSSL_RECORD:" + cve)
        require("from 3.5.0 before 3.5.8" in match[5], "ADVISORY_OPENSSL_FIXED_RANGE:" + cve)
        advisories.append({"component": "openssl", "version": "3.5.8", "advisory": cve,
            "source": OPENSSL, "severity": match[1], "severityAuthority": "OpenSSL Project",
            "publishedDateText": match[2], "affectedVersionRange": ">=3.5.0 <3.5.8", "fixedVersion": "3.5.8",
            "applicability": "Selected version equals the fixed version on the 3.5 branch.",
            "disposition": "FIXED_VERSION_SELECTED"})
    specs = [
        ("undici", "7.29.1", "nodejs/undici", 10),
        ("npm", "11.19.0", "npm/cli", 1),
        ("ares", "1.34.8", "c-ares/c-ares", 3),
        ("nghttp2", "1.70.0", "nghttp2/nghttp2", 1),
        ("uv", "1.52.1", "libuv/libuv", 1),
    ]
    expected_ids = {
        "undici": {"GHSA-3wwx-pv8p-q78v", "GHSA-rx4f-c7p8-82vq", "GHSA-vp8m-p9jh-q5pm", "GHSA-8436-99hf-9mmv", "GHSA-w293-vg96-wgc3", "GHSA-2gqq-gqf2-x968", "GHSA-2jfj-6hjv-fm6j", "GHSA-3xpg-4rpp-hhhm", "GHSA-rfgv-xxqx-mfg5", "GHSA-r53p-7pc4-xj5r"},
        "npm": {"GHSA-hj9c-8jmm-8c52"}, "ares": {"GHSA-pjmc-gx33-gc76", "GHSA-jv8r-gqr9-68wj", "GHSA-6wfj-rwm7-3542"},
        "nghttp2": {"GHSA-6933-cjhr-5qg6"}, "uv": {"GHSA-f74f-cvh7-c6q6"}}
    expected_fix = {"npm": "8.11.0", "ares": "1.34.7", "nghttp2": "1.68.1", "uv": "1.48.0", "undici": "7.29.1"}
    for component, version, repo, count in specs:
        url = "https://api.github.com/repos/" + repo + "/security-advisories?per_page=" + str(count)
        records = json.loads(fetch(url, sources, stamp))
        require({x["ghsa_id"] for x in records} == expected_ids[component], "ADVISORY_UPSTREAM_CHANGED_REQUIRES_REVIEW:" + component)
        for record in records:
            vulnerabilities = record["vulnerabilities"]
            fields = [{k: v.get(k) for k in ("vulnerable_version_range", "patched_versions")} for v in vulnerabilities]
            unrelated = record["ghsa_id"] == "GHSA-vp8m-p9jh-q5pm"
            if unrelated:
                require(fields == [{"vulnerable_version_range": ">= 8.10.0, < 8.10.2", "patched_versions": "8.10.2"}], "ADVISORY_UNDICI_RANGE")
                applicability = "Only 8.10.0 and 8.10.1 affected; selected 7.29.1 is outside that range."
            else:
                require(any(expected_fix[component] in (x["patched_versions"] or "") for x in fields), "ADVISORY_FIXED_RANGE:" + record["ghsa_id"])
                applicability = "Selected version equals or follows the upstream explicitly patched version " + expected_fix[component] + "."
            advisories.append({"component": component, "version": version, "advisory": record["ghsa_id"],
                "cve": record.get("cve_id"), "source": record["html_url"], "sourceApi": url,
                "publishedAtUtc": record["published_at"], "severity": record["severity"],
                "severityAuthority": repo + " maintainers via GitHub API", "upstreamVersionRanges": fields,
                "applicability": applicability, "disposition": "OUTSIDE_AFFECTED_RANGE" if unrelated else "FIXED_VERSION_SELECTED"})
    llhttp = plain(fetch(LLHTTP, sources, stamp))
    require("Do not allow empty transfer-encoding" in llhttp, "ADVISORY_LLHTTP_RELEASE")
    advisories.append({"component": "llhttp", "version": "9.4.3", "advisory": "upstream release/v9.4.3 empty Transfer-Encoding correction",
        "source": LLHTTP, "severity": None, "severityAuthority": None, "fixedVersion": "9.4.3",
        "applicability": "Selected parser is the corrected release; raw gateway framing gate also rejects Transfer-Encoding.",
        "disposition": "FIXED_VERSION_SELECTED"})
    coverage = []
    runtime_roles = {
        "node": "External execution runtime; Node HTTP/1.1, TLS, crypto, filesystem, worker and V8 execution are relevant.",
        "openssl": "External Node crypto/TLS component; transport uses TLS 1.3. No QUIC, DTLS, CMS or CMP API in gateway.",
        "llhttp": "External Node HTTP/1.1 parser; gateway raw framing gate constrains headers before native parser.",
        "undici": "Embedded external Node client; gateway workers deny fetch and WebSocket, no dispatcher/interceptor use.",
        "npm": "External installation tool only; bounded offline install with scripts ignored; no gateway runtime package-manager use.",
        "ares": "External Node DNS resolver; gateway worker boundary denies DNS acquisition.",
        "nghttp2": "External Node HTTP/2 component; gateway HTTP/1.1 transport, worker HTTP/2 networking denied.",
        "uv": "External Node I/O and event-loop primitive.",
        "sqlite": "External Node component present; no node:sqlite API used by gateway or closure.",
        "uvwasi": "External Node component present; WASI not used by gateway or closure.",
        "amaro": "External Node component present; trusted ESM JavaScript sources do not use TypeScript stripping.",
        "memoryos-rest": "Shipped first-party gateway; exact corrected archive certification and package negatives establish reviewed identity.",
        "memoryos-authoritative-closure": "Shipped authoritative 25-file first-party semantic closure; identities pinned and execution delegated.",
    }
    for p in sbom["packages"]:
        matching = [a["advisory"] for a in advisories if a["component"] == p["name"]]
        local = p["name"].startswith("memoryos-")
        coverage.append({"component": p["name"], "version": p["versionInfo"],
            "role": runtime_roles.get(p["name"], "Present within external Node binary; runtime helper/codec/parser reviewed through Node consolidated publication stream."),
            "sources": ["repositories/memoryos-rest/dependency-manifest.json", "repositories/memoryos-rest/sbom.spdx.json"] + ([] if local else [NODE_RELEASE, NODE_INDEX]),
            "selectedAdvisories": matching, "severity": None if not matching else "See individual authoritative advisory records.",
            "applicability": "First-party identity and conformance scope; no third-party advisory identifier asserted." if local else ("Selected advisory dispositions are listed." if matching else "No separate upstream advisory census performed; component remains in consolidated Node review scope."),
            "disposition": "BOUNDED_REVIEW_COMPLETE", "claimOfZeroVulnerabilities": False})
    return {"kind": "MemoryOSRESTPhase3BRAdvisorySnapshot", "version": "1.0.0", "state": "PASS",
        "snapshotDateUtc": "2026-09-25", "retrievedAtUtc": stamp,
        "method": "Fresh bounded primary-source review of Node current release/security stream, latest selected OpenSSL 3.5 notices, ten latest Undici advisories, selected npm/c-ares/nghttp2/libuv maintainer advisories and llhttp release.",
        "scope": coverage, "sources": sources, "advisories": advisories, "limitations": LIMITS,
        "sbom": identity(PACKAGE / "sbom.spdx.json"), "dependencyManifest": identity(PACKAGE / "dependency-manifest.json"),
        "knownUnresolvedApplicableAdvisoriesInReviewedSet": [], "zeroVulnerabilityClaim": False,
        "disposition": "No unresolved applicable advisory was identified in this explicitly bounded set. Retain exact pinned toolchain and existing gateway constraints; this is not proof of absence of vulnerabilities.",
    }
def validate_saved():
    _, sbom, facts = local_facts()
    require(read(EVIDENCE / "licenses-components.json") == facts, "ADVISORY_LICENSE_EVIDENCE")
    value = read(EVIDENCE / "advisory-snapshot.json")
    require(value["snapshotDateUtc"] == "2026-09-25" and value["state"] == "PASS", "ADVISORY_DATE_STATE")
    require(value["zeroVulnerabilityClaim"] is False and value["limitations"] == LIMITS, "ADVISORY_CLAIM_SCOPE")
    require(value["sbom"] == identity(PACKAGE / "sbom.spdx.json") and value["dependencyManifest"] == identity(PACKAGE / "dependency-manifest.json"), "ADVISORY_INPUT_BINDING")
    require({(p["name"], p["versionInfo"]) for p in sbom["packages"]} == {(x["component"], x["version"]) for x in value["scope"]}, "ADVISORY_SAVED_COVERAGE")
    require(len(value["scope"]) == 25 and len(value["advisories"]) == 38 and len(value["sources"]) == 10, "ADVISORY_BOUNDS")
    require(all(a["disposition"] in ("FIXED_VERSION_SELECTED", "OUTSIDE_AFFECTED_RANGE") for a in value["advisories"]), "ADVISORY_DISPOSITION")
    require(not value["knownUnresolvedApplicableAdvisoriesInReviewedSet"], "ADVISORY_UNRESOLVED")
    return value
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    require(ROOT.name == "cca-mo1305-3b-refresh", "ADVISORY_WORKSPACE")
    if args.write:
        dep, sbom, facts = local_facts()
        snapshot = create_snapshot(dep, sbom)
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        (EVIDENCE / "licenses-components.json").write_bytes(canonical(facts))
        (EVIDENCE / "advisory-snapshot.json").write_bytes(canonical(snapshot))
    value = validate_saved()
    print(json.dumps({"state": "PASS", "scopePackages": len(value["scope"]), "advisories": len(value["advisories"]), "sources": len(value["sources"]), "snapshotDateUtc": value["snapshotDateUtc"], "zeroVulnerabilityClaim": False}))
if __name__ == "__main__":
    main()
