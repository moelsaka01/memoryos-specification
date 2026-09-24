# MO-1305 Phase 1 runtime and supply-chain review

Review date: 2026-09-23. Scope is the exact Windows x64 Node 24.21.0 executable,
npm 11.19.0 installation tool, embedded runtime versions, immutable 25-file
released semantic closure, and first-party REST distribution. This is a dated
review of primary upstream advisories and reachable interfaces, not a proof
that every included component is free of vulnerabilities.

## Provenance and dependency graph

The official Node ZIP has SHA-256
158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541.
The separately downloaded SHASUMS256.txt and signed armored counterpart were
verified with the official Node release keyring. gpgv identified Antoine du
Hamel's signing fingerprint 5BE8A3F6C8A5C01D106C0AD820B1A390B168D356. The signed
plaintext equals the downloaded checksum list. Its ZIP entry matches the
archive; the extracted node.exe equals the trusted executable SHA-256
ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32.
The cache preserves the signed inputs and verification record.

The package lock contains only the first-party root, with no registry packages,
install scripts, downloaders, native addons, or runtime package-manager usage.
Fresh installation executes actual npm ci --offline --ignore-scripts against
an initially empty explicit cache outside the checkout. Every installed file
is compared with the distribution manifest afterward. The SDK closure is
independently copied from authoritative released files; no MCP adapter is a
production dependency. The closure and contract pins are unchanged.

## Dated advisory dispositions

The [Node 24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0) supplies
OpenSSL 3.5.8 and Undici 7.29.1. Actual process.versions, rather than guessed
transitive package versions, populate the dependency manifest and SPDX record.

The [July Node security release](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases)
fixed CVE-2026-56846, 56848, 58043, 56850, 58040, 58041, 58042, 58045, 56847,
58039 and 58044 in 24.18.1; selected 24.21.0 follows that patched release.
These cover HTTP/2, permission-model filesystem/reporting paths, outbound
HTTPS agents, SQLite, DNS, zlib, and HTTP header truncation. The gateway exposes
native HTTP/1.1 only, checks raw framing against the parser, sets maxHeadersCount
without truncation, and forbids compression and outbound semantic network/DNS.
It does not rely on Node's permission model as its security boundary. The
installed framing, environment, network-denial, media, and integrity tests
exercise those exclusions; fixed versions remain required even for unused paths.

[OpenSSL's 3.5 advisory list](https://openssl-library.org/news/vulnerabilities-3.5/)
identifies the August fixes in 3.5.8 for CVE-2026-18798, 63072, 63076, 14456,
14457, 54874, 63073, 63074, 63075 and 75803. The selected binary contains 3.5.8.
The application uses TLS 1.3 AES-GCM and EC P-256 credentials; it exposes no
QUIC, DTLS, CMS, CMP, raw-public-key TLS, PFX or client-certificate authority.
Normal chain/IP trust is exercised by Node fetch, curl, and raw TLS clients.

The [Undici advisory index](https://github.com/nodejs/undici/security/advisories)
was checked on the review date. September 4 advisories GHSA-3wwx-pv8p-q78v,
GHSA-rx4f-c7p8-82vq, GHSA-w293-vg96-wgc3, GHSA-3xpg-4rpp-hhhm,
GHSA-rfgv-xxqx-mfg5 and GHSA-8436-99hf-9mmv list 7.29.1 as the patched 7.x
version. They cover WebSocket errors, BalancedPool TLS callbacks, decompression,
and unsafe-method caching. GHSA-vp8m-p9jh-q5pm affects 8.10.0–8.10.1, not the
selected 7.x version. Additional September 4 advisories
[GHSA-2gqq-gqf2-x968](https://github.com/nodejs/undici/security/advisories/GHSA-2gqq-gqf2-x968),
[GHSA-2jfj-6hjv-fm6j](https://github.com/nodejs/undici/security/advisories/GHSA-2jfj-6hjv-fm6j),
and [GHSA-r53p-7pc4-xj5r](https://github.com/nodejs/undici/security/advisories/GHSA-r53p-7pc4-xj5r)
also name 7.29.1 as patched. Their dump, shared-cache and retry interceptors are
not used by the service or the local interoperability client.
The service has no Undici dispatcher/interceptor use;
global fetch and WebSocket are denied in semantic workers. The interoperability
client's built-in fetch talks only to the trusted local test gateway with
identity encoding and no cache/decompression interceptors.

[llhttp's releases](https://github.com/nodejs/llhttp/releases) document the
9.4.3 empty-Transfer-Encoding fix and preceding CR/LF/header parsing corrections.
The selected parser is 9.4.3. The additional raw gate rejects every TE field,
CL ambiguity, folding, controls, duplicate names and unsupported protocols before
handoff, then checks Node's rawHeaders for agreement.

[npm GHSA-hj9c-8jmm-8c52](https://github.com/npm/cli/security/advisories/GHSA-hj9c-8jmm-8c52)
affects versions from 7.9.0 below 8.11.0; selected 11.19.0 is outside that range.
The build uses an explicit deterministic USTAR inventory, not npm pack or npm
publish/workspace ignore rules. npm is used only for the empty offline install
graph with scripts disabled. This does not assert that npm's entire bundled
tool graph has no other vulnerabilities.

## Component and license coverage

The exact runtime dependency manifest records V8, libuv, OpenSSL, c-ares,
llhttp, nghttp2, zlib, zstd, brotli, ICU, simdjson, simdutf, ada, Acorn, amaro,
merve, SQLite, uvwasi, Undici, nbytes and ncrypto versions. ABI fields modules
and napi and ICU data versions are metadata. Empty nghttp3/ngtcp2 values are
not represented as installed components. Node's release/security stream is the
primary bundled-component disposition source; this review does not claim an
exhaustive separate upstream-CVE census for every internal helper.

V8 and libuv are execution primitives; OpenSSL and llhttp are directly exposed
through the frozen transport. ICU/string processing and SIMD helpers support
runtime parsing. URL/DNS and compression components are present but their
corresponding semantic acquisition/codec paths are excluded. SQLite, HTTP/2,
WASI and TypeScript stripping are not used by this ESM adapter or copied closure.
Trusted JavaScript cannot load user code, arbitrary modules or native addons.
Sampling and JavaScript hooks do not claim to contain a hostile executable.

The full unmodified upstream Node LICENSE is shipped. SPDX 2.3 records primary
declared grants only where supported by those notices; license conclusions
remain NOASSERTION. Node/npm are external tool relationships, not invented npm
registry dependencies. OpenSSL/simdjson have Apache-2.0 primary grants, V8/zstd
BSD-3-Clause, ICU Unicode-3.0 with nested notices, zlib Zlib, and other identified
primary MIT grants retain their complete notices. First-party rights and
SQLite/internal-helper conclusions are not replaced by a blanket MIT claim.

## Evidence binding

The final package receipt must bind the actual dependency manifest, SBOM,
notices, signed toolchain inputs, installed file identity, closed package
inventory, independent identical builds, and the final validation results.
This review alone is not a package PASS receipt or Windows release certification.

The resume task rechecked the primary Node release/security index, OpenSSL 3.5
advisory index, Undici advisory index, npm CLI advisory index and llhttp releases
on 2026-09-23 UTC (2026-09-24 local date). The reviewed dispositions above remain
applicable to the pinned versions. The recheck does not broaden this review into
an exhaustive vulnerability census.


## 2026-09-24 bounded-methodology confirmation

The pinned Node 24.21.0/npm 11.19.0 and embedded component scope is unchanged.
The primary-source recheck retained under
`.cache/mo1305-resource-review/r5-clock-correction/supply-chain-recheck.json`
confirmed the existing advisory dispositions against Node release/security,
OpenSSL 3.5, Undici, npm CLI and llhttp primary pages. No new disposition was
identified in that scoped recheck; this is not an exhaustive CVE census. New V
provenance and derived limits require fresh generated SBOM/archive identities,
not a new runtime version or a claim of vulnerability-free software.
