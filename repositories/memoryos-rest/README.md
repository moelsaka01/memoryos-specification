# MemoryOS REST Gateway

A bounded HTTP/1.1 adapter over the released MemoryOS Policy SDK. Package
memoryos-rest 0.1.0 requires native Windows 11 x64, Node 24.21.0 and npm 11.19.0.
It has no external production or development npm dependencies. Contract and
implementation status are governed by the repository MO-1305 Contract Freeze 1
and its corrections and separately bound phase evidence. This README is not
a certification; the installed contracts contain the operational data.

The nine /v1 routes prepare Policy/Policy Set artifacts, evaluate a Policy or
Policy Set against inline MIP bytes, verify Evaluation Identity/Policy Outcome
artifacts, return contract identities, and provide health/readiness/version.
The schemas and generated OpenAPI in contracts/ define exact fields, statuses
and headers. Normative bytes are canonical padded Base64; digests and decisions
come from the SDK. Evaluation supplies no Regression source. Health and readiness
require the same bearer credential as semantic operations.

## Trusted launch

An operator supplies an absolute local configuration file containing version
1.0.0, tokenFile, certificateFile and privateKeyFile. Optional port defaults to
13050. Local mode binds 127.0.0.1. Remote mode requires explicit `mode: "remote"`
and a canonical RFC1918 `bindAddress` assigned to a non-loopback interface, with
a matching certificate IP SAN. Invalid remote configuration creates no fallback
listener. No wildcard, public-address, DNS or IPv6 binding occurs.

Run the pinned executable with the installed bin/memoryos-rest.mjs and
`--config <absolute-local-path>`. The token file contains exactly 64 lowercase
hexadecimal characters generated from 32 random bytes, with no newline. The
certificate has the binding IP SAN and a matching unencrypted PKCS#8 ECDSA
P-256 key. The product never issues or fetches credentials. Clients must trust
the operator certificate chain normally and negotiate TLS 1.3.

Before Node starts, the trusted launcher must verify the executable hash and
immutable package trust, enforce token/key/config ACLs limited to the service
account, SYSTEM and Administrators, and reject NODE_*, OPENSSL_*, SSL_CERT_*,
UV_* and proxy environment injection. Product checks after startup cannot undo
an already executed Node preload. The repository's engineering
validate-launch.ps1 demonstrates and tests the explicit launcher precondition;
it is not an installed service manager. Configuration and secrets rotate only
by stopping and restarting the process. Do not place secrets on command lines.

Requests use `Authorization: Bearer <token>`, exact IP-and-port Host, JSON for
POST, and `Accept-Encoding: identity`. Each connection carries one request and
closes. No cookies, CORS, proxy headers, query authority, compression, streaming,
URL/file acquisition or outbound semantic networking are supported. Each
semantic request owns a fresh worker and fresh SDK owner. There is one worker,
no semantic queue, four request/write slots and 32 accepted sockets.

Close the supervisor's dedicated stdin pipe for orderly shutdown; nonempty
stdin is invalid control input. SIGINT and delivered SIGTERM are also supported.
Exit codes are 0 for requested shutdown, 2 for invalid startup, and 1 for fatal
runtime failure. Operational logs are bounded four-field JSON Lines on stderr;
service stdout is empty. No body, token, key or credential path is logged.

## Installation and verification

The deterministic `memoryos-rest-0.1.0.tgz` has exactly the 58 allowlisted files,
including the distribution manifest. Obtain its SHA-256 from a trusted external
integrated Phase 2 archive receipt. Before extracting or running package code, use the
trusted engineering verifier `mo1305-phase2d/distribution.py verify --archive
<archive> --sha256 <receipt-sha256>`. That verifier is distributed with the
engineering checkout, outside this service package; protect it and the receipt
as launcher trust inputs. A manifest stored beside mutable code is not its own
trust anchor. The verifier rejects unsafe or extra archive members and binds
all package bytes, including the installed verification scripts.

Two offline installation forms are supported with absolute pinned Node and
npm-cli.js paths. For a verified extracted package, run `npm ci --offline
--ignore-scripts --no-audit --no-fund --cache <initially-empty-cache>` in its
package directory. Alternatively, in a fresh empty external project run `npm
install --offline --ignore-scripts --no-audit --no-fund --cache
<initially-empty-cache> <absolute-verified-archive>`; the service is then in
`node_modules/memoryos-rest`. The outer project's lock and bin shims belong to
the npm installation, not the gateway's 58-file distribution. No registry data,
lifecycle downloader or previously populated cache is required.

Check the exact installed file set and hashes against the externally verified
archive after either form of installation and before launch. With the pinned
Node, run the installed `scripts/verify-distribution.mjs` and
`scripts/verify-contracts.mjs` for runtime and complete OpenAPI consistency.
Launch the absolute installed `bin/memoryos-rest.mjs` from any empty working
directory with a sanitized environment and the trusted-launch preconditions
above. No checkout, Git directory, sibling repository, developer node_modules,
NODE_PATH or environment-selected semantic runtime is required. Source tests,
fixtures, builders, receipts, caches and credentials are not package members.

The independently copied 25-file semantic closure and 933-byte identity pin are
unchanged authoritative artifacts. The package contains no MCP adapter dependency.
The external Node executable, npm, and their native components remain part of
the operator toolchain trust review. See NOTICES.md and the full upstream
notices/node-LICENSE.txt. No blanket license grant is made for MemoryOS sources.

Worker resourceLimits constrain V8 heap/stack, while memory watchdogs sample
commitment, external memory and RSS. These are not instantaneous OS containment.
The young allocation control is 24 MiB on the pinned V8, separate from the
measurement-derived commitment budget; no runtime adaptation raises budgets.
The shipped FINAL limits, schemas and OpenAPI retain their successful B1 byte
identities. The Phase 2 integration binds remote/lifecycle, security and
distribution acceptance to one candidate. Windows release certification and
final release binding remain separate Phase 3 gates.
