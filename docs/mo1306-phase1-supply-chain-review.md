# MO-1306 Phase 1 supply-chain baseline

Review: 2026-09-25 UTC. Scope: private memoryos-ci 0.1.0, Node 24.21.0
win-x64, npm 11.19.0 as an offline installation tool, the unchanged 25-file
SDK 1.1.0 closure, and seven pinned engineering validator wheels. This is a
bounded Phase 1 review, not a claim of zero vulnerabilities or final release
certification.

## Provenance and reachability

The Node executable SHA-256 is
ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32.
The retained ZIP SHA-256 is
158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541.
The unchanged signed acquisition chain is described in the
[MO-1305 review](mo1305-phase1-supply-chain-review.md); it is reused only as
provenance for the identical tool bytes, not as certification of MO-1306.
The original Node license/notices are shipped. First-party rights remain
NOASSERTION; no new license grant or npm publication is implied.

[Node's release record](https://nodejs.org/en/blog/release/v24.21.0) and
[July security release](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases)
were rechecked. The selected version follows the 24.18.1 security fixes and
contains OpenSSL 3.5.8 and Undici 7.29.1. The
[OpenSSL 3.5 index](https://openssl-library.org/news/vulnerabilities-3.5/) and
[Undici advisory index](https://github.com/nodejs/undici/security/advisories)
were checked alongside the earlier dated dispositions. MO-1306 uses hashing
and trusted immutable SDK code, exposes no HTTP/TLS server, remote acquisition,
proxy, DNS or arbitrary module service, and denies network routes before SDK
import. Runtime permission flags are defense in depth for trusted code; the
[Node permission documentation](https://nodejs.org/docs/latest-v24.x/api/permissions.html)
does not promise isolation of malicious JavaScript. This review does not
replace a complete future release advisory census.

The product has zero external npm dependencies and no install hooks.
[npm's advisory index](https://github.com/npm/cli/security) was checked.
The previously reviewed workspace-packaging advisory is outside the selected
version and feature path: packaging uses the explicit deterministic tar
manifest; npm is exercised only with offline, ignore-scripts, no-audit,
no-fund and an initially empty explicit cache. The
[npm closure inventory](../repositories/cca-conformance/evidence/mo1306/npm-closure.json)
records all 1,926 tool files and 144 package manifests, including hashes,
versions and declared licenses. It inventories bundled engineering code;
it does not claim all transitive advisories are absent.

## Independent engineering validators

The [validator lock](../repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json)
records exact official PyPI URLs, wheel lengths/SHA-256 values, versions and
retained notices for PyYAML 6.0.3, jsonschema 4.26.0, attrs 26.1.0,
jsonschema-specifications 2025.9.1, referencing 0.37.0, rpds-py 2026.6.3 and
typing-extensions 4.16.0. Full offline Draft 2020-12 validation uses local
references with an empty retrieval registry. PyYAML is reserved for safe
provider-data validation; no unsafe YAML constructors or remote schema
retrieval are enabled. These packages are excluded from the installed product.

The maintainer security pages for
[PyYAML](https://github.com/yaml/pyyaml/security),
[jsonschema](https://github.com/python-jsonschema/jsonschema/security),
[attrs](https://github.com/python-attrs/attrs/security),
[jsonschema-specifications](https://github.com/python-jsonschema/jsonschema-specifications/security),
[referencing](https://github.com/python-jsonschema/referencing/security),
[rpds](https://github.com/crate-py/rpds/security), and
[typing-extensions](https://github.com/python/typing_extensions/security)
were checked. An empty maintainer advisory list is not proof of safety.
The historical unsafe PyYAML load behavior is excluded by the selected
version and safe-loader boundary. JSON Schema validation accepts only the
reviewed bounded local schema corpus, not hostile arbitrary schema programs.

The import audit uses Acorn embedded in the same pinned Node executable,
engineering only. Every static and dynamic ESM import is parsed as syntax;
a public SDK method named import is not mistaken for a dynamic module load.
All 190 imports resolve to shipped members or Node builtins. No registry
parser package or production dependency was added.

## Binding and limitations

[Runtime component versions](../repositories/cca-conformance/evidence/mo1306/runtime-versions.json),
the closure inventory, notices, validator lock and final package identity
are bound by Phase 1 conformance. The deterministic archive stays an external
local build artifact under .cache; its exact digest and length are committed
as evidence. Actual offline installation and installed-file equality are
required separately. No live provider, Linux, VM or external account was used.
