Source: completed task `Certify MO-1305 release artifact` (`01a0d809-d842-7813-bd24-6e5e0c4e7d22`). The stopped Phase 3B task created no report file or certification receipt in its worktree. This is a preserved copy of its final report, read through the task API; the worktree remains untouched.

Certification stopped: the exact B2 artifact contains an invalid SPDX declaration.

In [sbom.spdx.json](C:/Users/melsa/Documents/Codex/cca-mo1305-3b/repositories/memoryos-rest/sbom.spdx.json:1), both packages declare `filesAnalyzed:false` despite explicit file containment:

| Package | Contained files |
|---|---:|
| `memoryos-rest` | 31 |
| `memoryos-authoritative-closure` | 25 |

[SPDX 2.3 §7.8.1](https://spdx.github.io/spdx-spec/v2.3/package-information/#78-files-analyzed-field) states: “If false, the package shall not contain any files.”

The defective SBOM is **38,729 bytes**, SHA-256 `1e40cecc24599e134b0cc8e7c013f6cb096f59a1f5957e431ee16fb286e2c707`. The [builder](C:/Users/melsa/Documents/Codex/cca-mo1305-3b/repositories/cca-conformance/tools/mo1305-phase2d/distribution.py:335) generates this contradiction; the existing verifier does not detect it. Repair requires changing shipped metadata and the archive identity, triggering your mandatory stop condition.

| Requested report items | Result |
|---|---|
| **1–3. Baseline, workspace, branch** | Clean required baseline `2fcc588979675462d30c582f24f42fa9ec3ec729`, expected subject, in `C:\Users\melsa\Documents\Codex\cca-mo1305-3b`, branch `mo1305/phase3b`. |
| **4–6. Archive identity** | In-memory reconstruction produced `memoryos-rest-0.1.0.tgz`, **189787 bytes**, SHA-256 `af99ba13fa96c5b5ded130a871c671243fb3fadd07f74eefa9b6ae2e601d182a`. |
| **7–10. Package and counts** | `memoryos-rest@0.1.0`; **58** package files; **25** runtime files; **0** external production dependencies. |
| **11–13. Inventory, allowlist, closure** | Existing file-policy verification passed, including all closure identities. [Exact inventory](C:/Users/melsa/Documents/Codex/cca-mo1305-3b/repositories/cca-conformance/evidence/mo1305-phase2d/binding.json:1). Full Phase 3B certification stopped. |
| **14. Contract identity** | Packaged Policy identity file: `d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65`. |
| **15. API/schema identity** | `f93f5d4a107d2a5ce75c7ff417409b62831180d53d3e551467732419a74a6868`. |
| **16. OpenAPI identity** | `a13b3467c2fd926d5444e6f654cb858b74f656faed2fe7ac416dcb5b4d7cf784`. |
| **17. FINAL limits identity** | `4ad1011f2e0861d28020427f1788026c92c6ff0672c707dab7116da1f568e1fa`. |
| **18. Distribution manifest** | `f2693ef0f5585ca4e3156407497143188412cf46c07637751c122ec210d8262a`. |
| **19. Dependency manifest** | `cdebba4ece5eff25851079b78b4d41505441f7499e2c136455413cef92bc54b3`. |
| **20–24. Reproducibility, offline installation, source independence, installed integrity, adversarial campaign** | Fresh campaigns not executed before mandatory stop. In-memory reconstruction does **not** satisfy the two-independent-build requirement. |
| **25. Lockfile/npm graph** | Existing verifier confirmed lockfile v3, root-only graph, zero external/optional dependencies, native addons, and lifecycle hooks. |
| **26–27. SBOM, notices/licenses** | **SBOM failed** as detailed above. Notice identities matched the existing package policy; overall supply-chain certification remains incomplete. |
| **28. Node identity** | Official toolchain downloaded; executable matched `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`. Release execution was not performed. |
| **29. npm identity** | Downloaded npm CLI matched `3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e`. |
| **30–31. Advisory snapshot and dispositions** | Bounded review dated **2026-09-25** stopped upon discovering the SBOM defect. Advisory certification is incomplete; no zero-vulnerability claim. |
| **32–35. Provenance, tamper detection, receipt, evidence** | B2 binding inspected. Fresh tamper campaign and Phase 3B receipt were not completed. No certification evidence files created. |
| **36–38. Regressions, workspace verification, whitespace** | Regressions and workspace validator not run after stop; `git diff --check` passed. |
| **39. Production unchanged** | Confirmed. No tracked files changed. |
| **40–42. Commit, parent, Git status** | No certification commit created. HEAD remains `2fcc588979675462d30c582f24f42fa9ec3ec729`; parent `05fc7c621af7343538cadee882b875ce7e5e783f`. Working tree clean; downloaded toolchain remains in ignored `.cache`. |
| **43–45. Merge, push, tag** | None performed. Release tag absent. |
| **46. Phase 3D integration** | Do not accept Phase 3B as certified. The [frozen correction procedure](C:/Users/melsa/Documents/Codex/cca-mo1305-3b/docs/mo1305-contract-freeze-1.md:1209) requires an explicit implementation/binding correction, regenerated archive, and refreshed dependent evidence. |

MO-1305 PHASE 3B RELEASE ARTIFACT DEFECT
