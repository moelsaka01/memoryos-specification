# MO-1305 Phase 3B-R advisory, component and notice continuation

Snapshot date: **2026-09-25 UTC**. This is a fresh continuation record. It does
not rewrite or reuse the prior blocked attempt as a successful review.

The bounded primary-source review is complete: **25 exact SBOM packages**,
**38 selected advisory/release records**, and **10 fresh HTTPS source
retrievals**. No unresolved applicable advisory was identified within that
reviewed set. This is not a zero-vulnerability claim or an exhaustive CVE census.

## Scope and evidence

advisory-snapshot.json records the retrieval timestamp, source URL, response
length and SHA-256, authoritative severity where available, version ranges,
applicability and disposition. Full upstream page bodies are not redistributed.
licenses-components.json records the locally verified component and notice
identities. advisory_snapshot.py validates both records offline by default;
its explicit --write mode performs the bounded upstream retrievals again.

The selected Node executable's actual process.versions equals both the pinned
allowlist and dependency manifest. Together with npm and the two first-party
packages, its nonempty software component versions exactly match all 25 SPDX
package records. There are 2 shipped first-party packages and 23 external
toolchain/component entries. ABI and ICU data versions remain metadata; empty
nghttp3/ngtcp2 values do not become software packages. The SBOM retains 56 files
and 81 relationships. Zero external production npm dependencies does not mean
zero supply-chain surface.

## Advisory dispositions

- **Node 24.21.0:** the eleven July 2026 advisories were fixed in 24.18.1.
  The selected same-major release follows it. The official vulnerability index
  and selected release were freshly retrieved.
  [Node security release](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases),
  [selected Node release](https://nodejs.org/en/blog/release/v24.21.0).
- **OpenSSL 3.5.8:** the ten selected August notices identify 3.5.8 as the
  corrected 3.5 release. Authoritative severities are Low or Moderate.
  [OpenSSL 3.5 advisories](https://openssl-library.org/news/vulnerabilities-3.5/).
- **Undici 7.29.1:** nine of the ten latest September 4 advisories explicitly
  list 7.29.1 as patched. The cross-origin cache advisory affects only
  8.10.0–8.10.1. The maintainer API supplies the exact ranges and severities.
  [Undici advisories](https://github.com/nodejs/undici/security/advisories).
- **npm 11.19.0:** the selected workspace-packing advisory affects
  >=7.9.0 <8.11.0. The selected version is outside that range.
  [npm advisory](https://github.com/npm/cli/security/advisories/GHSA-hj9c-8jmm-8c52).
- **c-ares 1.34.8, nghttp2 1.70.0 and libuv 1.52.1:** three selected c-ares
  notices explicitly identify 1.34.7 as patched; the selected nghttp2 and
  libuv notices identify 1.68.1 and 1.48.0 respectively.
  [c-ares](https://github.com/c-ares/c-ares/security/advisories),
  [nghttp2](https://github.com/nghttp2/nghttp2/security/advisories),
  [libuv](https://github.com/libuv/libuv/security/advisories).
- **llhttp 9.4.3:** the selected parser includes the empty Transfer-Encoding
  correction. No severity is invented for this release-note item.
  [llhttp release](https://github.com/nodejs/llhttp/releases/tag/release%2Fv9.4.3).

Gateway HTTP/1.1 framing, TLS, cryptography, worker execution and runtime
primitives remain relevant supply-chain surfaces. Worker network/DNS denial
and absence of gateway Undici dispatcher/interceptor use narrow the applicable
interfaces; version dispositions above do not rely solely on those exclusions.
The other embedded components are retained in the consolidated Node
release/security review scope, without a separate exhaustive upstream census.
The two first-party packages are covered by their exact identity and conformance
certification. No third-party advisory identifier is invented for them.

## Licenses and limits

All three shipped notice files exactly match their package allowlist pins.
The complete 160555-byte notices/node-LICENSE.txt, SHA-256
ed34dd8e3f0a78dbaf00d0444ce8e285b015b765379c2e17880455f70370f8e9,
equals the official Node distribution LICENSE byte for byte.
The actual npm package declares Artistic-2.0 and retains its license file.

All 25 SPDX package license conclusions remain NOASSERTION. Primary declared
grants retain nested component notices; this review does not grant first-party
rights or make a blanket MIT, compatibility or legal-rights determination.
npm's full bundled transitive tool graph was not independently scanned.
Publication coverage can lag disclosure. Retain the pinned toolchain and
existing gateway constraints; final release certification separately binds this
snapshot, notices and component evidence.
