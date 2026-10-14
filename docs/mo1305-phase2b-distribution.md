# MO-1305 Phase 2B distribution

This parallel packaging workstream starts from clean `mo1305/phase2b` at
`b6c397b99e1f8bfcd04be972f35069f8737a4137` in the dedicated `cca-mo1305-2b`
workspace. It preserves memoryos-rest 0.1.0, Node 24.21.0, npm 11.19.0,
zero external production/development/optional npm dependencies, and every B1
executable, semantic closure, contract, schema, OpenAPI and FINAL-limits byte.
It creates no B2 or Phase 3 certification and changes no remote/lifecycle behavior.

## Distribution and trust

The archive is `.cache/mo1305-phase2b/build/memoryos-rest-0.1.0.tgz`.
It contains 58 explicitly allowlisted regular files, including its manifest,
25 authoritative semantic files, and zero external dependency files. The lock is
v3 with the first-party root only. Source tests, fixtures, harnesses, receipts,
caches, Node binaries, private keys, secrets and developer paths are excluded.
The two clean rebuilds live under `.cache/mo1305-phase2b/reproduction/`.

The trusted engineering verifier authenticates the externally supplied archive
SHA-256 before bounded decompression or extraction. It validates the USTAR/gzip
representation, exact allowlist, all file identities, immutable B1 pins,
metadata and dependency restrictions, SPDX relationships and complete notices.
Installed verifiers run only after this external trust check. The operator must
protect the verifier, trusted digest, immutable package and exact Node binary;
these checks are integrity verification, not code signing or hostile-admin isolation.

SPDX 2.3 distinguishes gateway files, the authoritative closure, external Node,
its actual nonempty native-component inventory, and external npm tooling.
It enumerates all 56 non-self-referential package files; the archive receipt
binds the SPDX document and distribution manifest. ABI and ICU-data identifiers
remain runtime metadata. First-party conclusions remain NOASSERTION, and the
full unchanged Node notices retain all component terms. No blanket license or
zero-vulnerability claim is made.

## Operator installation

Use absolute paths for the pinned executable, npm-cli.js and archive. First run
`distribution.py verify --archive <archive> --sha256 <trusted-receipt-sha256>`
with trusted Python 3.12+ and the Phase 2B engineering tools. Materialize only
verified regular members, or install the verified archive in a fresh external
project. The package README specifies both supported installation forms:

- Extracted package: `npm ci --offline --ignore-scripts --no-audit --no-fund --cache <empty-cache>`.
- Empty project: `npm install --offline --ignore-scripts --no-audit --no-fund --cache <empty-cache> <archive>`.

Both paths use independent initially empty explicit caches and empty npm config
files in the harness. Outer npm project lockfiles and bin shims are outside the
58-file service package. Verify every service member against the trusted archive
before and after execution. Launch the absolute installed entry with trusted
Node, clean environment and an empty cwd, after token/key/config ACL validation.
No checkout or environment-selected runtime is needed. The independent harness
copies Node/npm, archive, verifier inputs and bounded fixtures outside the checkout;
its actual service process imports only the installed closure and Node builtins.
It does not claim that an OS policy hid the checkout or sandboxed the service.

## Reusable evidence

`repositories/cca-conformance/evidence/mo1305-phase2b/index.json` binds the modular
archive, package inventory, closure, contract, SPDX/notices, offline installation,
installed execution, source independence, adversarial, reproduction, regression
and scoped supply-chain artifacts. Three standard receipts use the frozen
`mo1305-receipt-2.0.0.json` schema. `validation.json` binds the cheap validator result.
The executed input inventory includes build and verification tools, installation
harness, fixed fixture inputs and receipt schema. Receipts never claim their own
future implementation commit hash; the later integration owns that binding.

From this preserved workspace, run the following with trusted absolute tool paths:

```text
python -B repositories/cca-conformance/tools/mo1305-phase2b/receipts.py verify --node <pinned-node.exe>
```

This validates actual archive bytes, exact source/harness and artifact identities,
raw execution coverage, schemas and negative receipt witnesses without repeating
npm installs, semantic probes, regressions or resource characterization. Local
archive retention is intentional; the binary archive is not Git-tracked. Rebuild
from the retained input inventory with `distribution.py build` if local bytes are
lost, then require the same receipt digest before use. Final executed tooling is
bound, so changing a harness requires new provenance and affected evidence.

The scoped supply-chain review reuses the bound September 24 Phase 1 review for
unchanged Node/npm/components and semantic/adapter source. September 25 work
reviews only the new archive, verifier, SPDX and install surfaces. It does not
refresh every upstream advisory or replace the later B2/Phase 3 advisory gate.

## Shared files and integration

Exactly five existing files are changed:

| Shared file | Reason |
|---|---|
| repositories/memoryos-rest/README.md | Make external trust, both offline installs and independent launch operationally explicit. |
| repositories/memoryos-rest/dependency-manifest.json | Bind the actual Phase 2B input tree and existing B1 parent while preserving the empty dependency graph and runtime identity. |
| repositories/memoryos-rest/sbom.spdx.json | Distinguish gateway and authoritative source ownership and enumerate all non-self-referential shipped files. |
| repositories/memoryos-rest/distribution-manifest.json | Bind the new README and generated provenance/SBOM bytes. |
| .gitattributes | Preserve the exact executed Phase 2B harness bytes in Git so CRLF normalization cannot invalidate source-tree receipts. |

All other additions are Phase 2B tooling, evidence and this document. No released
predecessor source, Phase 1 receipt, frozen contract, global conformance inventory,
2A file or 2C file is edited. Package-relevant Phase 1 tests and the frozen targeted
predecessor groups are recorded separately. A slow initial regression attempt is
preserved where applicable; completed PASS groups are reused when resuming.

Phase 2D must validate this branch's receipts against this preserved candidate,
then reconcile the four shared metadata/documentation files with 2A/2C changes.
Retain the narrowly scoped Phase 2B harness byte-preservation attribute.
The B1-derived executable pins deliberately reject unreviewed runtime changes.
For the integrated implementation, explicitly review the new first-party bytes,
update the corresponding package allowlist pins and existing-parent provenance,
assemble the integrated archive, and repeat affected packaging/install checks.
Keep the authoritative 25-file closure and FINAL limits unchanged unless separate
authority changes them. This branch's archive retains the baseline remote-pending
OpenAPI annotation and local-mode behavior; it is not the final integrated I2.
Do not relabel these receipts as integrated remote/lifecycle/2C acceptance or B2.

## Artifact identities

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| Phase 2B archive | 188890 | `9ebe8bba35e04069def1348659f6df066247ca1e81e2990d04655ca065f9df63` |
| Distribution manifest | 8145 | `2cdd7921b5403672cf68f61dc581ac40ea901dd612cf2a042f2b9f5e8572e1bd` |
| Runtime closure manifest | 5566 | `6cbe6bd5b164eb032e00645da06fb90f3e57d15ead33d7e9defa4d1538366705` |
| API contract and embedded schema authority | 14343 | `f93f5d4a107d2a5ce75c7ff417409b62831180d53d3e551467732419a74a6868` |
| Policy contract identities | 933 | `d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65` |
| OpenAPI 3.1.1 | 114407 | `a13b3467c2fd926d5444e6f654cb858b74f656faed2fe7ac416dcb5b4d7cf784` |
| FINAL limits | 1499 | `4ad1011f2e0861d28020427f1788026c92c6ff0672c707dab7116da1f568e1fa` |
| Lockfile v3 | 214 | `a318c151d58954b5151fff808b983d958cc211b7c0521713b140c9bad14aa945` |
| SPDX 2.3 SBOM | 38729 | `05e090b2471f4150b93f4ec1682c30216f10d01b116cec55287daa60d6ae37ee` |
| Notices | 1672 | `c69935227ee2a5091db4bc874be845d14b2bc3cc2c65dd4d7070746fe65ee40f` |
| Rights notice | 404 | `a8c5190de8bd4d22a97b82cc81657306c3fdca3b156dcf02b76d33b3c9558c85` |
| Full upstream Node license | 160555 | `ed34dd8e3f0a78dbaf00d0444ce8e285b015b765379c2e17880455f70370f8e9` |

The schemas are embedded in `contracts/api-contract.json`, not independently
regenerated package files. The canonical `J(api.schemas)` projection is 10,776
bytes, SHA-256 `dfdf8d6d09c906f3e04aaaf7f053c7f15af284debe88e822e375ebc269467b63`.

## Exact authoritative runtime files

Paths below are relative to the installed `runtime/` directory.

| Path | Bytes | SHA-256 |
|---|---:|---|
| authoritative/package.json | 1922 | `d2f3cb58f4b854c658b63512aa7ef11a0cbc82fd0b889b0d152fdeba707258f4` |
| authoritative/web/data/studio-snapshot.js | 10180 | `0c1e3219e6ea16e0ba913ba089e9fff21813977e9f20d7f15396a7259c01a6b4` |
| authoritative/web/js/cognitive-comparative-reconstruction.js | 11681 | `9f41c7161673b1536c6748e95c062e8be650ada3a3d0c7cc2eb930e41e53a1c7` |
| authoritative/web/js/cognitive-comparative-replay.js | 8004 | `d50e3952a70ee3849b69929531313a7540e5c3b34f56c3d8ee3a712ac1fbf596` |
| authoritative/web/js/cognitive-evolution-controller.js | 2730 | `880df2ac0dab286655052b7e8057682b8d57db1c47c3be2e77ca01c245a8752d` |
| authoritative/web/js/cognitive-evolution.js | 14080 | `a417d84122642814efbb4862ac872a4ea58b1aebd8c73faed7c003a90b78b539` |
| authoritative/web/js/cognitive-investigation-explorer.js | 11511 | `cdb0dac0fe6d4e9c29f270ff8d97021713ee28b9a245bc6a12978f85da63995a` |
| authoritative/web/js/cognitive-regression.js | 23419 | `730c0740f54d75a1e007fee21bb5fe4ffb0f30de9b34e5c25a3651eb9500c3c4` |
| authoritative/web/js/cognitive-replay.js | 6194 | `2b02b5d7a5ad854c25e3f9bc676c8efd8de07a86e58242cdf1b95f79795d656a` |
| authoritative/web/js/cognitive-trace.js | 25155 | `c427986595c7a507cbc8863abc5eac3357baa905536f1fc22193ccbca13a2c9c` |
| authoritative/web/js/deterministic-sequence-alignment.js | 5239 | `b1b6fa20bb56612deebded48ebf30104d6b083d61ed33fa26651648a9effdcfc` |
| authoritative/web/js/investigation-core.js | 57631 | `f6d960591daf0411d44ebc18ad5a3afad7fc87b1598421ae32011a902dfa8806` |
| authoritative/web/js/investigation-policy-contracts.js | 25861 | `2448146319d18c2c7bc8113ece048cba25d5a793d450540767ff70d379522b10` |
| authoritative/web/js/investigation-policy-engine.js | 62321 | `97a62eaa58797f1d2d278ed450a9142c12b9e38d33c0a41acd36e926ac8094e3` |
| authoritative/web/js/investigation-policy-integration.js | 28320 | `65c6f6f1c32a6556a1993faecfd2e2735dc625e4e89bc293ad94615d842308dc` |
| authoritative/web/js/investigation-policy.js | 25396 | `951e7d481888eeebd3ce66ed1ef3c16bd592d975952100a22852d13080a2a3b0` |
| authoritative/web/js/memory-investigation-package.js | 80144 | `532830e1ec67cb8b069753f4d53e6a70cfc8786fca5a03b7146e4fcaee780f0c` |
| authoritative/web/js/memoryos-sdk.js | 25111 | `3d476156394045abc0eca5bf57309a743b1d8a7f332cf0788c22ed57e41c9d94` |
| authoritative/web/js/mip-canonical.js | 25607 | `0dd9dbaed8c3fdf92600dec4d998fe290dd9b2b83344198711ec88f0ec95fa68` |
| authoritative/web/js/observation-timeline.js | 4350 | `ba3c99d78c8170794cca6d53ebeaa5802922ae145759f262d8843fac6440b060` |
| authoritative/web/js/policy-canonical.js | 27453 | `be5a633d421f4d3885df7d438ad633a515675e1d49cfae889fe8452bd40f02f0` |
| authoritative/web/js/policy-fact-context.js | 57247 | `1d1110d8ceb0c5bf9d90369c8cf6f8cc114effa58325f6471ea41e93f64000a8` |
| authoritative/web/js/regression-policy-fact-source.js | 34954 | `05dd75bf4aeabd2da617add1c8e42922ca8f819d20c0032b0f03bf0db5aa30af` |
| authoritative/web/js/semantic-world.js | 11244 | `1d49a1efc103f1b987a8efc239720736d7c6c2db08ceb8e0f9ee94f539665031` |
| authoritative/web/js/studio-model.js | 41908 | `c04f82c15a2eb8727e3c00c7365ab3403f569ea08eced7f5b75ee3b8a488a84a` |

## Completed validation

The final archive passed all 142 package/adversarial cases and both isolated
offline installation methods. Each installation retained all 58 exact files
and completed ten TLS 1.3 requests over nine operations; both probes and both
gateways exited 0. The 13 command exits matched the exact expected sequence,
including three intentional refusal cases. Both clean builds matched the
188,890-byte archive byte for byte.

Receipt revalidation passed for 23 indexed artifacts, three frozen-schema
receipts and 68 negative witnesses. It independently checks exact commands,
fixtures, request/response bodies, response wires, source inputs and raw log
identities without rerunning expensive work.

| Regression group | Passed |
|---|---:|
| mo1301-sdk | 131 |
| core-mip | 60 |
| mo1302-projections | 5 |
| mo1303-io-inspection | 6 |
| mo1304-semantic-integrity | 27 |
| cli-secondary | 6 |
| mo1305-package-contracts | 12 |

All 247 selected tests passed. Eleven actual regression commands include four
preserved earlier attempts: one bounded timeout and three missing-predecessor
prerequisite failures. Only incomplete groups were resumed. The ignored
predecessor environment restored 1,174 existing pinned files with verified
identities and no registry access, lifecycle scripts or REST dependency changes.
The nested `regression-logs/development-environment.json` receipt binds those
files and is referenced by `regressions.json`; all 1,174 current identities were
independently rechecked after preparation. Seven successful and four failed
raw TAP logs are retained with their exact byte identities.

`tools/verify_workspace.py --root .` and `git diff --check` passed. Final commit
and clean-status identities are reported separately after staging and commit.
The archive, all source bytes and every receipt remain scoped to Phase 2B.

## Exact changed-file list

The single Phase 2B commit contains these 54 files: five existing shared files,
eleven new tools, thirty-seven evidence files and this report. The generated
archive and development prerequisites remain in ignored local storage.

- `.gitattributes`
- `docs/mo1305-phase2b-distribution.md`
- `repositories/cca-conformance/evidence/mo1305-phase2b/adversarial.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/archive.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/aux-tool-versions.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/contract-artifacts.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/harness.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/index.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/installation-catalog.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/installation-evidence.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/installation-receipt.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/installed-execution.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/offline-installation.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/package-catalog.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/package-inventory.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/package-receipt.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/platform.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/cli-secondary-resume.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/core-mip.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/development-environment.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1301-sdk.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1302-projections-resume.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1302-projections.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1303-io-inspection-missing-esbuild.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1303-io-inspection-missing-typescript.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1303-io-inspection-resume.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1304-semantic-integrity-missing-dependencies.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1304-semantic-integrity-resume.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regression-logs/mo1305-package-contracts-resume.tap`
- `repositories/cca-conformance/evidence/mo1305-phase2b/regressions.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/reproducibility.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/runtime-closure.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/sbom-notices.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/source-independence.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/source-tree.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/supply-chain-review.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/supplyChain-catalog.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/supplyChain-receipt.json`
- `repositories/cca-conformance/evidence/mo1305-phase2b/validation.json`
- `repositories/cca-conformance/tools/mo1305-phase2b/adversarial_test.py`
- `repositories/cca-conformance/tools/mo1305-phase2b/distribution.py`
- `repositories/cca-conformance/tools/mo1305-phase2b/install.py`
- `repositories/cca-conformance/tools/mo1305-phase2b/installed-probe.mjs`
- `repositories/cca-conformance/tools/mo1305-phase2b/package-allowlist.json`
- `repositories/cca-conformance/tools/mo1305-phase2b/package-cases.json`
- `repositories/cca-conformance/tools/mo1305-phase2b/receipts.py`
- `repositories/cca-conformance/tools/mo1305-phase2b/regressions.py`
- `repositories/cca-conformance/tools/mo1305-phase2b/regressions_resume.py`
- `repositories/cca-conformance/tools/mo1305-phase2b/reproduce.py`
- `repositories/cca-conformance/tools/mo1305-phase2b/verify-receipts.mjs`
- `repositories/memoryos-rest/README.md`
- `repositories/memoryos-rest/dependency-manifest.json`
- `repositories/memoryos-rest/distribution-manifest.json`
- `repositories/memoryos-rest/sbom.spdx.json`
