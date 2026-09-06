import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const MIP_MATRIX_PATH = "repositories/cca-studio/docs/mip-conformance-matrix.md";

function selector(executionReference, source, exactSelector) {
  return Object.freeze({ executionReference, source, selector: exactSelector });
}

export const SELECTOR_SOURCES = Object.freeze({
  NV: Object.freeze(["normative-vectors-js", "repositories/cca-conformance/tests/normative_vectors_conformance_test.mjs"]),
  RI: Object.freeze(["reference-js", "repositories/cca-conformance/tests/reference_implementation_conformance_test.mjs"]),
  AD: Object.freeze(["component-js", "repositories/cca-studio/tests/ai_runtime_adapter_test.mjs"]),
  IC: Object.freeze(["component-js", "repositories/cca-studio/tests/investigation_core_test.mjs"]),
  MW: Object.freeze(["component-js", "repositories/cca-studio/tests/memory_studio_web_test.mjs"]),
  MI: Object.freeze(["component-js", "repositories/cca-studio/tests/memory_studio_integration_test.mjs"]),
  EX: Object.freeze(["component-js", "repositories/cca-studio/tests/cognitive_investigation_explorer_test.mjs"]),
  RG: Object.freeze(["component-js", "repositories/cca-studio/tests/cognitive_regression_test.mjs"]),
  SJ: Object.freeze(["component-js", "repositories/cca-studio/tests/memoryos_sdk_test.mjs"]),
  CA: Object.freeze(["component-js", "repositories/memoryos-cli/tests/architecture.test.mjs"]),
  CC: Object.freeze(["component-js", "repositories/memoryos-cli/tests/cli-contract.test.mjs"]),
  CP: Object.freeze(["component-js", "repositories/memoryos-cli/tests/package-workflow.test.mjs"]),
  CS: Object.freeze(["component-js", "repositories/memoryos-cli/tests/session.test.mjs"]),
  CI: Object.freeze(["component-js", "repositories/memoryos-cli/tests/investigate.test.mjs"]),
  CH: Object.freeze(["component-js", "repositories/memoryos-cli/tests/human-output.test.mjs"]),
  CO: Object.freeze(["compatibility-js", "repositories/cca-conformance/tests/compatibility_conformance_test.mjs"]),
  SP: Object.freeze(["specification-js", "repositories/cca-conformance/tests/specification_conformance_test.mjs"]),
  BD: Object.freeze(["boundary-js", "repositories/cca-conformance/tests/boundary_contract_conformance_test.mjs"]),
  SC: Object.freeze(["sdk-cpp", "repositories/cca-sdk/tests/memoryos_sdk_test.cpp"]),
  SY: Object.freeze(["sdk-python", "repositories/cca-sdk/python/tests/test_memoryos_sdk.py"]),
  CG: Object.freeze(["reproducibility-meta", "repositories/cca-conformance/tools/run-reference-evidence.mjs"]),
  MM: Object.freeze(["component-js", "repositories/cca-studio/tests/memory_investigation_package_test.mjs"]),
  MA: Object.freeze(["component-js", "repositories/cca-studio/tests/mip_adversarial_conformance_test.mjs"]),
  MP: Object.freeze(["component-js", "repositories/cca-studio/tests/mip_pipeline_conformance_test.mjs"]),
  MS: Object.freeze(["component-js", "repositories/cca-studio/tests/mip_schema_conformance_test.mjs"]),
  "RF-CM": Object.freeze(["runtime-native", "repositories/cca-core/tests/configuration_manager_runtime_test.cpp"]),
  "RF-DI": Object.freeze(["runtime-native", "repositories/cca-core/tests/dependency_injector_test.cpp"]),
  "RF-EB": Object.freeze(["runtime-native", "repositories/cca-core/tests/event_bus_test.cpp"]),
  "RF-LM": Object.freeze(["runtime-native", "repositories/cca-core/tests/lifecycle_manager_test.cpp"]),
  "RF-OB": Object.freeze(["runtime-native", "repositories/cca-core/tests/observability_test.cpp"]),
  "RF-RH": Object.freeze(["runtime-native", "repositories/cca-core/tests/runtime_host_test.cpp"]),
  "RF-RT": Object.freeze(["runtime-native", "repositories/cca-core/tests/runtime_test.cpp"]),
  "RF-SR": Object.freeze(["runtime-native", "repositories/cca-core/tests/service_registry_test.cpp"]),
});

function fromSource(sourceKey, exactSelector) {
  const source = SELECTOR_SOURCES[sourceKey];
  if (!source) throw new Error(`Unknown selector source key ${sourceKey}`);
  return selector(source[0], source[1], exactSelector);
}

function selectors(...definitions) {
  return Object.freeze(definitions.map(([sourceKey, exactName]) => fromSource(sourceKey, exactName)));
}

// Populated from the frozen direct-requirement traceability review. A review
// requirement is deliberately represented by an empty array: supplemental
// executable checks never substitute for the required human review outcome.
export const DIRECT_REQUIREMENT_SELECTORS = Object.freeze({
  "CCA-MOS-ADAPT-001": Object.freeze([]),
  "CCA-MOS-ADAPT-002": Object.freeze([]),
  "CCA-MOS-ADAPT-003": selectors(
    ["AD", "MO-1202 OpenAI waits for settled output and rejects non-success terminal states"],
    ["AD", "MO-1202 Anthropic enforces its complete documented stream lifecycle"],
    ["AD", "MO-1202 LangGraph validates v3 ordering, lifecycle, and explicit cognition projection"],
  ),
  "CCA-MOS-ADAPT-004": selectors(
    ["NV", "adapter defaults, resource limits, and descriptor rejection use exact contract values"],
    ["AD", "MO-1202 LangGraph wall-clock and namespace runtime IDs do not change cognition"],
    ["AD", "MO-1202 OpenAI never discards a malformed supplied source identifier"],
  ),
  "CCA-MOS-ADAPT-005": selectors(
    ["AD", "MO-1202 generic contract is immutable, provider-independent, and explicitly attested"],
  ),
  "CCA-MOS-ADAPT-006": selectors(
    ["AD", "MO-1202 OpenAI projects model output without retaining Agent or RunItem objects"],
    ["AD", "MO-1202 projection contract preserves colliding identities as contiguous occurrences"],
    ["AD", "MO-1202 source ordering is deterministic and affects only repeated identities"],
    ["AD", "MO-1202 OpenAI preserves source-authored strict JSON strings exactly"],
  ),
  "CCA-MOS-ADAPT-007": selectors(
    ["AD", "MO-1202 published reference streams reproduce canonical verified MIP packages"],
    ["AD", "MO-1202 packages contain completed cognition, never transport/runtime residue"],
    ["AD", "MO-1202 artifact output is a verified .mip and failures are atomic"],
  ),
  "CCA-MOS-ADAPT-008": selectors(
    ["AD", "MO-1202 Anthropic transport chunking does not change cognition"],
    ["AD", "MO-1202 LangGraph wall-clock and namespace runtime IDs do not change cognition"],
    ["AD", "MO-1202 async hooks remain sequential and failures publish no package"],
    ["AD", "MO-1202 iterator failures, cleanup, and state isolation are deterministic"],
    ["AD", "MO-1202 resource limits apply before investigation publication"],
    ["AD", "MO-1202 artifact output is a verified .mip and failures are atomic"],
  ),
  "CCA-MOS-ADAPT-009": selectors(
    ["AD", "CCA-MOS-ADAPT-009: empty streams, adapter hooks, and MIP failures preserve the closed diagnostic contract"],
  ),
  "CCA-MOS-ART-001": selectors(
    ["NV", "the declared native projection maps exact Frame values and rejects invalid input"],
    ["MW", "observation frames record only accepted semantic deltas in deterministic sequence"],
    ["MW", "observation timelines enforce success, Workspace, session, and capture semantics"],
    ["MW", "frame identifiers remain unique when compact diagnostic fingerprints collide"],
  ),
  "CCA-MOS-ART-002": selectors(
    ["MW", "Cognitive Trace construction and serialization are deterministic and canonical"],
    ["NV", "Trace identifiers use the exact encodeURIComponent vector"],
  ),
  "CCA-MOS-ART-003": selectors(
    ["MW", "investigation target resolution preserves exact Reflection ownership and cardinality"],
    ["MW", "Cognitive Traces reconstruct every Reflection-owned candidate through a Retrieval boundary"],
    ["MW", "Cognitive Trace preserves typed source identity when identifiers collide across families"],
  ),
  "CCA-MOS-ART-004": selectors(
    ["MW", "mutable and shallow-frozen Cognitive Traces are rejected and cannot be serialized"],
    ["MW", "mutable Observation Frame identity replacement invalidates an earlier trace binding"],
    ["MW", "Cognitive Trace queries enforce exact Workspace, session, frame, and typed target bindings"],
    ["MW", "Cognitive Trace rejects internally inconsistent frame metadata and world projections"],
    ["MW", "Cognitive Trace rejects missing Reflection-owned evidence atomically"],
    ["MW", "Cognitive Trace validation rejects relationship tampering and never renders a partial trace"],
  ),
  "CCA-MOS-ART-005": selectors(
    ["MW", "Cognitive Replay reconstructs only actual trace nodes and relationships in deterministic order"],
    ["MW", "Cognitive Trace addresses are replay-ready and preserve earlier immutable frames"],
  ),
  "CCA-MOS-ART-006": selectors(
    ["MW", "Cognitive Replay play pause restart completion and interruption are exact"],
    ["MW", "Cognitive Replay state restoration is immutable frame-bound and deterministic"],
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
    ["IC", "MO-1203 transition logs are canonical digest-bound deterministic truth"],
  ),
  "CCA-MOS-ART-007": selectors(
    ["MW", "Cognitive Evolution reports identical observations without semantic false positives"],
    ["MW", "Cognitive Evolution controller exposes only explicit adjacent observation comparison"],
  ),
  "CCA-MOS-ART-008": selectors(
    ["NV", "Evolution excludes aggregate and detail-only changes from its eleven semantic classes"],
    ["MW", "Cognitive Evolution distinguishes added removed and evolved cognition from aggregate changes"],
    ["MW", "Cognitive Evolution detects added removed and modified semantic relationships"],
  ),
  "CCA-MOS-ART-009": selectors(
    ["MW", "Cognitive Evolution distinguishes added removed and evolved cognition from aggregate changes"],
    ["MW", "Cognitive Evolution detects added removed and modified semantic relationships"],
    ["MW", "Cognitive Evolution comparison is canonical and independent of graph input order"],
  ),
  "CCA-MOS-ART-010": selectors(
    ["MW", "Cognitive Evolution reports identical observations without semantic false positives"],
    ["MW", "Cognitive Evolution distinguishes added removed and evolved cognition from aggregate changes"],
    ["MW", "Cognitive Evolution rejects graph-only differences that are absent from runtime truth"],
    ["MW", "Cognitive Evolution comparison is canonical and independent of graph input order"],
  ),
  "CCA-MOS-ART-011": selectors(
    ["MW", "Comparative Reconstruction rejects invalid bindings atomically"],
    ["MW", "Comparative Reconstruction requires explicit activation and preserves Cognitive Evolution"],
  ),
  "CCA-MOS-ART-012": selectors(
    ["MW", "Comparative Reconstruction realigns after inserted evidence without cascading divergence"],
    ["MW", "Comparative Replay preserves per-side phases when trace order diverges and reconverges"],
  ),
  "CCA-MOS-ART-013": selectors(
    ["MW", "Comparative Reconstruction detects exact Evidence Transformation Retrieval and Reflection divergence"],
    ["MW", "Comparative Replay synchronizes, pauses at every divergence, and resumes explicitly"],
  ),
  "CCA-MOS-ART-014": selectors(
    ["NV", "Comparative producer immutability is deep while detached validation checks its published surface"],
    ["MW", "Comparative Reconstruction keeps identical investigations unified"],
    ["MW", "Comparative Reconstruction rejects invalid bindings atomically"],
  ),
  "CCA-MOS-ART-015": selectors(
    ["MW", "Comparative Replay synchronizes, pauses at every divergence, and resumes explicitly"],
    ["MW", "Comparative Replay completes identical traces deterministically and remains frame-bound"],
    ["MW", "Comparative Replay preserves per-side phases when trace order diverges and reconverges"],
  ),
  "CCA-MOS-ART-016": selectors(
    ["MW", "Cognitive Trace implementation is independent of clocks, randomness, DOM, and host operations"],
    ["MW", "Cognitive Replay remains controller-owned and renderer-independent"],
    ["MW", "the Evolution renderer consumes engine classifications and never computes semantic differences"],
    ["MW", "the Comparative renderer consumes aligned classifications and never computes divergence"],
    ["MW", "Cognitive Trace validation rejects relationship tampering and never renders a partial trace"],
    ["MW", "Comparative Reconstruction rejects invalid bindings atomically"],
  ),
  "CCA-MOS-CLI-001": selectors(
    ["CA", "package bin resolves to the production executable entry"],
    ["CC", "version and help expose the deterministic supported command surface"],
    ["NV", "CLI aliases and closed JSON result member sets are exact"],
  ),
  "CCA-MOS-CLI-002": Object.freeze([]),
  "CCA-MOS-CLI-003": selectors(
    ["CC", "argument failures are stable, non-interactive, and use exit code 1"],
    ["CC", "observe requires explicit deterministic files and emits stable summaries"],
    ["CP", "regression reports identical packages and accepts at most one stdin operand"],
    ["CP", "package stdin supports non-interactive verification and import"],
    ["CS", "session accepts a workflow file and fails malformed JSON deterministically"],
  ),
  "CCA-MOS-CLI-004": selectors(
    ["CH", "CCA-MOS-CLI-004: every command emits deterministic human output through the production CLI"],
    ["NV", "CLI aliases and closed JSON result member sets are exact"],
  ),
  "CCA-MOS-CLI-005": selectors(
    ["NV", "CLI aliases and closed JSON result member sets are exact"],
    ["RI", "CLI exposes stable JSON and delegates MIP, Regression, and Explorer to the SDK"],
    ["CC", "observe requires explicit deterministic files and emits stable summaries"],
    ["CP", "replay applies repeated SDK actions in caller order and is deterministic"],
    ["CP", "regression delegates two packages to the SDK and preserves deterministic report truth"],
    ["CS", "session preserves opaque checkpoints and restores exact SDK state"],
    ["CI", "investigate delegates raw and enveloped Regression Reports with stable JSON"],
  ),
  "CCA-MOS-CLI-006": selectors(
    ["CC", "all documented exit-code classes are observable"],
    ["CP", "verify delegates valid and invalid package truth with exit code 3 on failure"],
    ["CI", "investigate rejects invalid grammar, reports, categories, and selector combinations"],
  ),
  "CCA-MOS-CLI-007": selectors(
    ["CA", "CLI output preserves direct SDK transition truth"],
    ["CP", "trace requires and preserves one exact package Trace selector"],
    ["CP", "replay applies repeated SDK actions in caller order and is deterministic"],
    ["CP", "compare uses one package, completes its Replay, and enters exact Evolution"],
    ["CP", "export is a byte-for-byte SDK round trip for files and stdout"],
    ["CI", "investigate delegates raw and enveloped Regression Reports with stable JSON"],
    ["CI", "investigate selects Replay, Transition, and Verification facts exactly"],
  ),
  "CCA-MOS-CLI-008": selectors(
    ["CA", "Regression output is the exact public SDK report"],
    ["CA", "Investigation navigation output is the exact public SDK result"],
  ),
  "CCA-MOS-CLI-009": selectors(
    ["CS", "session preserves opaque checkpoints and restores exact SDK state"],
    ["CS", "checkpoint names cannot restore across live CLI sessions"],
    ["CS", "session executes Trace, complete Replay, and Compare in one live SDK"],
    ["CS", "session accepts a workflow file and fails malformed JSON deterministically"],
  ),
  "CCA-MOS-CLI-010": selectors(
    ["CC", "argument failures are stable, non-interactive, and use exit code 1"],
    ["CC", "input validation failures use exit code 2 and deterministic JSON"],
    ["CP", "export is a byte-for-byte SDK round trip for files and stdout"],
  ),
  "CCA-MOS-COMP-001": selectors(
    ["CO", "MIP exact-version and same-major packages retain canonical compatibility"],
    ["CO", "unknown non-critical extensions survive MIP and SDK round trips byte-for-byte"],
    ["MP", "CCA-MIP-058: compatibility is explicit, lossless, and never silently coerces a wire version"],
    ["MM", "MIP implementation remains headless and renderer-independent"],
  ),
  "CCA-MOS-COMP-002": selectors(
    ["CO", "MIP exact-version and same-major packages retain canonical compatibility"],
    ["CO", "unknown non-critical extensions survive MIP and SDK round trips byte-for-byte"],
  ),
  "CCA-MOS-COMP-003": selectors(
    ["CO", "MIP exact-version and same-major packages retain canonical compatibility"],
    ["MM", "CCA-MIP-005..007,037,045..046: lexical, duplicate, canonical, version, and closed-core diagnostics follow phase precedence"],
    ["MA", "extension contract enforces reverse-DNS names, shape, bijection, versions, and critical support"],
    ["MS", "independent JSON Schema validation rejects closed-core and profile violations"],
  ),
  "CCA-MOS-COMP-004": selectors(
    ["CO", "MIP exact-version and same-major packages retain canonical compatibility"],
    ["CO", "unknown non-critical extensions survive MIP and SDK round trips byte-for-byte"],
    ["MM", "CCA-MIP-053..058: extension bijection, preservation, critical handling, and same-major compatibility"],
    ["MP", "CCA-MIP-058: compatibility is explicit, lossless, and never silently coerces a wire version"],
  ),
  "CCA-MOS-COMP-005": Object.freeze([]),
  "CCA-MOS-COMP-006": selectors(
    ["MP", "CCA-MIP-058: compatibility is explicit, lossless, and never silently coerces a wire version"],
    ["MM", "CCA-MIP-005..007,037,045..046: lexical, duplicate, canonical, version, and closed-core diagnostics follow phase precedence"],
    ["MA", "Producer trust, versions, critical support, timestamps, and artifact envelopes remain explicit"],
  ),
  "CCA-MOS-CONF-001": selectors(
    ["SP", "CCA-MOS-CONF-001: complete reports cover every normative row with no omission or non-applicable status"],
  ),
  "CCA-MOS-CONF-002": selectors(
    ["SP", "CCA-MOS-CONF-002: scoped reports apply the published profile registry and justify every non-applicable row"],
  ),
  "CCA-MOS-CONF-003": selectors(
    ["SP", "the pinned manifest is complete, ordered, and self-authenticating"],
    ["CG", "CCA-MOS-CONF-003: evidence and reports are invariant under irrelevant environment and presentation variation"],
  ),
  "CCA-MOS-CONF-004": selectors(
    ["SP", "CCA-MOS-CONF-004: every automated requirement is bound to exact committed selectors"],
  ),
  "CCA-MOS-CONF-005": selectors(
    ["SP", "CCA-MOS-CONF-005: missing renamed skipped or duplicate selectors yield requirement failure"],
  ),
  "CCA-MOS-CONF-006": Object.freeze([]),
  "CCA-MOS-CONF-007": selectors(
    ["SP", "CCA-MOS-CONF-007: reports bind every required claim identity and assessment field"],
  ),
  "CCA-MOS-CORE-001": Object.freeze([]),
  "CCA-MOS-CORE-002": selectors(
    ["IC", "MO-1203 instances, investigations, and caller inputs remain isolated under concurrent use"],
  ),
  "CCA-MOS-CORE-003": selectors(
    ["IC", "MO-1203 exposes the closed immutable Investigation Core contract"],
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
    ["IC", "MO-1203 complete MIP import export verification and capability playback are exact"],
  ),
  "CCA-MOS-CORE-004": selectors(
    ["IC", "MO-1203 exposes the closed immutable Investigation Core contract"],
    ["IC", "MO-1203 transition logs are canonical digest-bound deterministic truth"],
    ["IC", "MO-1203 verification is point-in-time evidence and later changes require reverification"],
    ["IC", "MO-1203 checkpoints restore exact immutable state and reject stale or forged history"],
  ),
  "CCA-MOS-CORE-005": selectors(
    ["IC", "MO-1203 Replay and comparison are exact projections of the released deterministic engines"],
    ["IC", "MO-1203 accepted observations rebuild valid active traces without moving semantic geography"],
    ["MW", "Cognitive Trace validation rejects relationship tampering and never renders a partial trace"],
    ["MW", "Comparative Reconstruction rejects invalid bindings atomically"],
  ),
  "CCA-MOS-CORE-006": selectors(
    ["IC", "MO-1203 complete MIP import export verification and capability playback are exact"],
    ["IC", "MO-1203 MIP failures are atomic and observation-only packages never fabricate capabilities"],
  ),
  "CCA-MOS-CORE-007": selectors(
    ["IC", "MO-1203 complete MIP import export verification and capability playback are exact"],
    ["IC", "MO-1203 MIP failures are atomic and observation-only packages never fabricate capabilities"],
  ),
  "CCA-MOS-CORE-008": selectors(
    ["RG", "MO-1206 Regression is read-only atomic and enforces Core boundaries"],
    ["EX", "MO-1207 Explorer remains renderer-independent and performs no investigation execution"],
  ),
  "CCA-MOS-CORE-009": selectors(
    ["IC", "MO-1203 exposes the closed immutable Investigation Core contract"],
    ["NV", "phase, availability, Trace rebuild, and missing-target diagnostics are exact"],
    ["IC", "MO-1203 Investigation Core is headless provider-neutral and renderer-independent"],
  ),
  "CCA-MOS-CORE-010": selectors(
    ["IC", "MO-1203 Investigation Core is headless provider-neutral and renderer-independent"],
    ["IC", "MO-1203 instances, investigations, and caller inputs remain isolated under concurrent use"],
  ),
  "CCA-MOS-CORE-011": selectors(
    ["BD", "CCA-MOS-CORE-011: Core resource limits reject oversized transition candidates atomically"],
  ),
  "CCA-MOS-CORE-012": selectors(
    ["IC", "MO-1203 invalid commands and transitions fail atomically with closed diagnostics"],
    ["IC", "MO-1203 MIP failures are atomic and observation-only packages never fabricate capabilities"],
    ["NV", "native Trace evidence rejection is atomic across JS and private SDK-host boundaries"],
  ),
  "CCA-MOS-EXPL-001": selectors(
    ["EX", "MO-1207 Explorer returns a closed immutable deterministic result from detached JSON"],
    ["EX", "MO-1207 Explorer remains renderer-independent and performs no investigation execution"],
  ),
  "CCA-MOS-EXPL-002": selectors(
    ["EX", "MO-1207 Explorer returns a closed immutable deterministic result from detached JSON"],
    ["EX", "MO-1207 Explorer navigates Evidence Reflection Retrieval Replay Evolution and Verification"],
    ["EX", "MO-1207 Explorer rejects malformed reports queries and results without partial output"],
  ),
  "CCA-MOS-EXPL-003": selectors(
    ["EX", "MO-1207 Explorer navigates exact Transition and lifecycle evidence"],
  ),
  "CCA-MOS-EXPL-004": selectors(
    ["EX", "MO-1207 Explorer returns a closed immutable deterministic result from detached JSON"],
  ),
  "CCA-MOS-EXPL-005": selectors(
    ["EX", "MO-1207 Explorer navigates Evidence Reflection Retrieval Replay Evolution and Verification"],
    ["EX", "MO-1207 Explorer navigates exact Transition and lifecycle evidence"],
  ),
  "CCA-MOS-EXPL-006": selectors(
    ["EX", "MO-1207 Explorer endpoints terminate at exact report evidence"],
  ),
  "CCA-MOS-EXPL-007": Object.freeze([]),
  "CCA-MOS-EXPL-008": selectors(
    ["EX", "MO-1207 Explorer returns a closed immutable deterministic result from detached JSON"],
    ["EX", "MO-1207 Explorer rejects malformed reports queries and results without partial output"],
    ["EX", "MO-1207 Explorer accepts an identical MIP-backed regression without inventing evidence"],
  ),
  "CCA-MOS-LIFE-001": selectors(
    ["IC", "MO-1203 exposes the closed immutable Investigation Core contract"],
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
  ),
  "CCA-MOS-LIFE-002": selectors(
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
    ["IC", "MO-1203 invalid commands and transitions fail atomically with closed diagnostics"],
  ),
  "CCA-MOS-LIFE-003": selectors(
    ["IC", "MO-1203 transition logs are canonical digest-bound deterministic truth"],
    ["NV", "known Core identity and transition digest vectors remain exact"],
  ),
  "CCA-MOS-LIFE-004": selectors(
    ["IC", "MO-1203 transition logs are canonical digest-bound deterministic truth"],
    ["IC", "MO-1203 invalid commands and transitions fail atomically with closed diagnostics"],
  ),
  "CCA-MOS-LIFE-005": selectors(
    ["IC", "MO-1203 accepted observations rebuild valid active traces without moving semantic geography"],
    ["NV", "phase, availability, Trace rebuild, and missing-target diagnostics are exact"],
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
  ),
  "CCA-MOS-LIFE-006": selectors(
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
    ["IC", "MO-1203 transition logs are canonical digest-bound deterministic truth"],
    ["MW", "Cognitive Replay play pause restart completion and interruption are exact"],
  ),
  "CCA-MOS-LIFE-007": selectors(
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
    ["IC", "MO-1203 Replay and comparison are exact projections of the released deterministic engines"],
  ),
  "CCA-MOS-LIFE-008": selectors(
    ["IC", "MO-1203 verification is point-in-time evidence and later changes require reverification"],
    ["IC", "MO-1203 exposes the closed immutable Investigation Core contract"],
  ),
  "CCA-MOS-LIFE-009": selectors(
    ["IC", "MO-1203 exposes the closed immutable Investigation Core contract"],
  ),
  "CCA-MOS-LIFE-010": selectors(
    ["IC", "MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions"],
  ),
  "CCA-MOS-LIFE-011": selectors(
    ["IC", "MO-1203 checkpoints restore exact immutable state and reject stale or forged history"],
  ),
  "CCA-MOS-LIFE-012": selectors(
    ["IC", "MO-1203 complete MIP import export verification and capability playback are exact"],
    ["IC", "MO-1203 MIP failures are atomic and observation-only packages never fabricate capabilities"],
  ),
  "CCA-MOS-MIP-001": Object.freeze([]),
  "CCA-MOS-MIP-002": selectors(
    ["CO", "MIP exact-version and same-major packages retain canonical compatibility"],
    ["CO", "unknown non-critical extensions survive MIP and SDK round trips byte-for-byte"],
    ["MM", "CCA-MIP-053..058: extension bijection, preservation, critical handling, and same-major compatibility"],
    ["MP", "CCA-MIP-058: compatibility is explicit, lossless, and never silently coerces a wire version"],
  ),
  "CCA-MOS-MIP-003": selectors(
    ["IC", "MO-1203 complete MIP import export verification and capability playback are exact"],
    ["IC", "MO-1203 MIP failures are atomic and observation-only packages never fabricate capabilities"],
    ["RI", "MIP import, verification, and export preserve every published golden byte"],
  ),
  "CCA-MOS-MIP-004": selectors(
    ["IC", "MO-1203 complete MIP import export verification and capability playback are exact"],
    ["IC", "MO-1203 MIP failures are atomic and observation-only packages never fabricate capabilities"],
    ["RI", "MIP import, verification, and export preserve every published golden byte"],
  ),
  "CCA-MOS-MIP-005": Object.freeze([]),
  "CCA-MOS-REG-001": selectors(
    ["RG", "MO-1206 Regression is read-only atomic and enforces Core boundaries"],
  ),
  "CCA-MOS-REG-002": selectors(
    ["RG", "MO-1206 regression reports use the closed immutable deterministic contract"],
  ),
  "CCA-MOS-REG-003": selectors(
    ["RG", "MO-1206 regression reports use the closed immutable deterministic contract"],
    ["RG", "MO-1206 detects Verification Transition and Lifecycle facts independently"],
  ),
  "CCA-MOS-REG-004": selectors(
    ["RG", "MO-1206 detects added removed and modified evidence facts directionally"],
    ["RG", "MO-1206 reports Reflection and Retrieval facts without interpreting them"],
  ),
  "CCA-MOS-REG-005": selectors(
    ["RG", "MO-1206 reports Reflection and Retrieval facts without interpreting them"],
    ["RG", "MO-1206 detects exact Evolution artifacts without renderer projections"],
    ["RG", "MO-1206 Regression engine remains renderer-independent and interpretation-free"],
  ),
  "CCA-MOS-REG-006": selectors(
    ["RG", "MO-1206 compares verified MIP cognition and ignores local aliases and package metadata"],
    ["RG", "MO-1206 uses MIP cognition digests and reports only validated source facts"],
    ["RG", "MO-1206 Regression engine remains renderer-independent and interpretation-free"],
  ),
  "CCA-MOS-REG-007": selectors(
    ["RG", "MO-1206 regression reports use the closed immutable deterministic contract"],
    ["RG", "MO-1206 uses MIP cognition digests and reports only validated source facts"],
  ),
  "CCA-MOS-REG-008": selectors(
    ["RG", "MO-1206 regression reports use the closed immutable deterministic contract"],
    ["RG", "MO-1206 Regression is read-only atomic and enforces Core boundaries"],
  ),
  "CCA-MOS-RT-001": Object.freeze([]),
  "CCA-MOS-RT-002": Object.freeze([]),
  "CCA-MOS-RT-003": selectors(
    ["NV", "the declared native projection maps exact Frame values and rejects invalid input"],
    ["MW", "observation timelines enforce success, Workspace, session, and capture semantics"],
    ["IC", "MO-1203 generic adapter handoff imports observation truth without invented cognition"],
  ),
  "CCA-MOS-RT-004": selectors(
    ["RI", "Runtime-independent Investigation lifecycle is immutable and deterministic"],
    ["MW", "the semantic world is canonical, stable, and independent of graph input order"],
    ["IC", "MO-1203 instances, investigations, and caller inputs remain isolated under concurrent use"],
  ),
  "CCA-MOS-RT-005": selectors(
    ["MW", "observation timelines enforce success, Workspace, session, and capture semantics"],
    ["IC", "MO-1203 invalid commands and transitions fail atomically with closed diagnostics"],
    ["IC", "MO-1203 instances, investigations, and caller inputs remain isolated under concurrent use"],
  ),
  "CCA-MOS-RT-006": selectors(
    ["IC", "MO-1203 Investigation Core is headless provider-neutral and renderer-independent"],
    ["MW", "Cognitive Trace implementation is independent of clocks, randomness, DOM, and host operations"],
    ["EX", "MO-1207 Explorer remains renderer-independent and performs no investigation execution"],
    ["RG", "MO-1206 Regression engine remains renderer-independent and interpretation-free"],
  ),
  "CCA-MOS-SDK-001": Object.freeze([]),
  "CCA-MOS-SDK-002": selectors(
    ["CO", "C++, Python, JavaScript, bridge, and CLI SDK surfaces declare one compatible SDK version"],
    ["SJ", "MO-1204 exposes immutable versioned SDK objects without exposing Core construction"],
    ["SC", "MemoryOsSdk.ExposesVersionedImmutableValueHandles"],
  ),
  "CCA-MOS-SDK-003": selectors(
    ["SJ", "MO-1204 exposes immutable versioned SDK objects without exposing Core construction"],
    ["SJ", "MO-1204 keeps concurrent SDK instances isolated"],
    ["SC", "MemoryOsSdk.ExposesVersionedImmutableValueHandles"],
    ["SC", "MemoryOsSdk.KeepsConcurrentInstancesDeterministicAndIsolated"],
    ["SY", "MemoryOSSDKTest.test_concurrent_sdk_instances_are_isolated_and_deterministic"],
  ),
  "CCA-MOS-SDK-004": selectors(
    ["NV", "SDK bindings expose the complete projection and common semantic operation families"],
    ["SJ", "MO-1204 native SDK commands produce the exact Core transition history and projections"],
    ["SJ", "MO-1204 exposes comparison as an explicit non-semantic session and preserves Core stages"],
    ["SJ", "MO-1204 verification and Checkpoint restoration remain Core-owned"],
    ["SC", "MemoryOsSdk.DelegatesObservationTraceReplayVerifyAndRestore"],
    ["SC", "MemoryOsSdk.ReachesNativeComparisonThroughTwoExplicitObservations"],
    ["SY", "MemoryOSSDKTest.test_explicit_observation_trace_replay_and_verification"],
    ["SY", "MemoryOSSDKTest.test_native_second_observation_reaches_explicit_comparison_atomically"],
  ),
  "CCA-MOS-SDK-005": selectors(
    ["SJ", "MO-1204 rejects implicit selections and cross-instance handles"],
    ["SC", "MemoryOsSdk.RejectsCrossInstanceAndNativeExport"],
    ["SY", "MemoryOSSDKTest.test_regression_rejects_foreign_investigation_handles"],
    ["SY", "MemoryOSSDKTest.test_explicit_observation_trace_replay_and_verification"],
  ),
  "CCA-MOS-SDK-006": selectors(
    ["SJ", "MO-1204 package verification import and export preserve exact MIP bytes"],
    ["SC", "MemoryOsSdk.PreservesExactMipAndEveryComparisonStage"],
    ["SC", "MemoryOsSdk.ReportsPackageFailuresWithoutPublishingAValue"],
    ["SC", "MemoryOsSdk.RejectsCrossInstanceAndNativeExport"],
    ["SY", "MemoryOSSDKTest.test_complete_mip_replay_staged_comparison_and_exact_export"],
    ["SY", "MemoryOSSDKTest.test_mip_verification_is_package_owned_and_deterministic"],
  ),
  "CCA-MOS-SDK-007": Object.freeze([]),
  "CCA-MOS-SDK-008": selectors(
    ["SJ", "MO-1204 default observation operations preserve cross-language Core parity"],
    ["SC", "MemoryOsSdk.DefaultObservationOperationsMatchCrossLanguageDigests"],
    ["SY", "MemoryOSSDKTest.test_default_observation_operations_match_cross_language_digests"],
    ["SJ", "MO-1206 exposes one immutable read-only Regression path with exact Core parity"],
    ["SC", "MemoryOsSdk.DelegatesImmutableDeterministicRegressionToCore"],
    ["SY", "MemoryOSSDKTest.test_regression_is_core_owned_immutable_and_deterministic"],
    ["SJ", "MO-1207 SDK navigates regression evidence with exact Core parity"],
    ["SC", "MemoryOsSdk.NavigatesRegressionEvidenceExclusivelyThroughCore"],
    ["SY", "MemoryOSSDKTest.test_explorer_navigates_existing_regression_evidence_deterministically"],
    ["SJ", "MO-1204 exposes comparison as an explicit non-semantic session and preserves Core stages"],
    ["SC", "MemoryOsSdk.ReachesNativeComparisonThroughTwoExplicitObservations"],
    ["SY", "MemoryOSSDKTest.test_native_second_observation_reaches_explicit_comparison_atomically"],
    ["SJ", "MO-1204 rejects implicit selections and cross-instance handles"],
    ["SC", "MemoryOsSdk.RejectsReplayHandleAfterActiveReplayIsReplaced"],
    ["SY", "MemoryOSSDKTest.test_replay_session_rejects_replacement_replay"],
  ),
  "CCA-MOS-SDK-009": selectors(
    ["NV", "native Trace evidence rejection is atomic across JS and private SDK-host boundaries"],
    ["SJ", "MO-1204 package verification import and export preserve exact MIP bytes"],
    ["SJ", "MO-1204 rejects implicit selections and cross-instance handles"],
    ["SC", "MemoryOsSdk.ReportsPackageFailuresWithoutPublishingAValue"],
    ["SC", "MemoryOsSdk.EmptyPackageFailsAsMipValidationNotTransportInput"],
    ["SC", "MemoryOsSdk.RejectsReplayHandleAfterActiveReplayIsReplaced"],
    ["SY", "MemoryOSSDKTest.test_mip_verification_is_package_owned_and_deterministic"],
    ["SY", "MemoryOSSDKTest.test_replay_session_rejects_replacement_replay"],
    ["SY", "MemoryOSSDKTest.test_invalid_transition_preserves_published_state_and_diagnostics"],
  ),
  "CCA-MOS-SDK-010": selectors(
    ["BD", "CCA-MOS-SDK-010: public SDK binding failure is single-attempt and adds no transition"],
  ),
  "CCA-MOS-VER-001": selectors(
    ["CO", "Standard, package, Core, SDK, and CLI versions retain independent identities"],
    ["SP", "report and manifest schemas preserve independent Standard and implementation versions"],
  ),
  "CCA-MOS-VER-002": selectors(
    ["CO", "Standard, package, Core, SDK, and CLI versions retain independent identities"],
    ["CO", "MIP exact-version and same-major packages retain canonical compatibility"],
    ["SP", "the exact MemoryOS Standard and incorporated publications match their pinned digests"],
  ),
  "CCA-MOS-VER-003": Object.freeze([]),
  "CCA-MOS-VER-004": Object.freeze([]),
  "CCA-MOS-VER-005": Object.freeze([]),
});

// Populated from the frozen Runtime Foundation traceability review. Only the
// sixteen mechanically decidable CCA-RF requirements have executable selectors.
const RF_AUTOMATED_SELECTORS = Object.freeze({
  "CCA-RF-003": selectors(
    ["RF-DI", "DependencyInjectorTest.EquivalentDiamondCompositionsProduceEquivalentDependencyOrder"],
    ["RF-RT", "RuntimeTest.EquivalentStartFailuresProduceEquivalentRollbackCleanup"],
  ),
  "CCA-RF-007": selectors(
    ["RF-SR", "ServiceRegistryTest.ResolvesOnlyAfterFreezeWithCardinalityDependentTypes"],
    ["RF-SR", "ServiceRegistryTest.MakesTypedResolutionFailuresObservableWhenWired"],
  ),
  "CCA-RF-013": selectors(
    ["RF-RT", "RuntimeTest.FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown"],
  ),
  "CCA-RF-015": selectors(
    ["RF-RH", "RuntimeHostTest.KeepsConfigurationEventsAndLifecycleStateInstanceLocal"],
  ),
  "CCA-RF-016": selectors(
    ["RF-RH", "RuntimeHostTest.KeepsConfigurationEventsAndLifecycleStateInstanceLocal"],
    ["RF-SR", "ServiceRegistryTest.KeepsRuntimeInstanceRegistriesIsolated"],
    ["RF-EB", "EventBusTest.SeparateBusesRemainInstanceLocal"],
    ["RF-OB", "ObservabilityTest.SeparateInstancesDoNotConflateEvidence"],
  ),
  "CCA-RF-021": selectors(
    ["RF-LM", "LifecycleManagerTest.AcceptsTheExactSuccessfulLifecycleSequence"],
    ["RF-RT", "RuntimeTest.FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown"],
  ),
  "CCA-RF-022": selectors(
    ["RF-CM", "ConfigurationManagerRuntimeTest.RejectsReplacementAfterFreezeWithoutChangingSnapshot"],
    ["RF-SR", "ServiceRegistryTest.RejectsMutationAfterFreezeWithoutChangingComposition"],
    ["RF-DI", "DependencyInjectorTest.RejectsGraphMutationAfterFreezeAndPreservesSnapshots"],
    ["RF-EB", "EventBusTest.FreezeRejectsSubscriptionMutationWithoutRemovingHandlers"],
  ),
  "CCA-RF-023": selectors(
    ["RF-RT", "RuntimeTest.FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown"],
  ),
  "CCA-RF-024": selectors(
    ["RF-SR", "ServiceRegistryTest.ResolvesOnlyAfterFreezeWithCardinalityDependentTypes"],
    ["RF-DI", "DependencyInjectorTest.InjectsTypedDependenciesInLevelOrder"],
  ),
  "CCA-RF-028": selectors(
    ["RF-SR", "ServiceRegistryTest.EnforcesExactlyOneCardinality"],
    ["RF-SR", "ServiceRegistryTest.EnforcesZeroOrOneCardinality"],
    ["RF-SR", "ServiceRegistryTest.EnforcesOneOrMoreCardinalityAndPermitsDistinctProviders"],
  ),
  "CCA-RF-030": selectors(
    ["RF-DI", "DependencyInjectorTest.DerivesDeterministicDiamondLevelsAndEdges"],
    ["RF-RT", "RuntimeTest.FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown"],
  ),
  "CCA-RF-031": selectors(
    ["RF-DI", "DependencyInjectorTest.InjectsTypedDependenciesInLevelOrder"],
    ["RF-RT", "RuntimeTest.FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown"],
  ),
  "CCA-RF-033": selectors(
    ["RF-RT", "RuntimeTest.FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown"],
    ["RF-RT", "RuntimeTest.StopFailureDoesNotStopDependenciesAndUsesReverseDestruction"],
  ),
  "CCA-RF-034": selectors(
    ["RF-LM", "LifecycleManagerTest.AcceptsOnlyTheApprovedFailureCleanupSequence"],
    ["RF-RT", "RuntimeTest.StartFailureRunsFailureRollbackAndDeterministicCleanup"],
    ["RF-RT", "RuntimeTest.ValidationFailurePreventsFreezeAndProviderStartup"],
    ["RF-RT", "RuntimeTest.ExplicitFailureFromRunningRollsBackWithoutNormalShutdownStates"],
    ["RF-RT", "RuntimeTest.StopFailureDoesNotStopDependenciesAndUsesReverseDestruction"],
  ),
  "CCA-RF-035": selectors(
    ["RF-LM", "LifecycleManagerTest.AcceptsOnlyTheApprovedFailureCleanupSequence"],
    ["RF-RT", "RuntimeTest.StartFailureRunsFailureRollbackAndDeterministicCleanup"],
    ["RF-RT", "RuntimeTest.ValidationFailurePreventsFreezeAndProviderStartup"],
    ["RF-RT", "RuntimeTest.ExplicitFailureFromRunningRollsBackWithoutNormalShutdownStates"],
    ["RF-RT", "RuntimeTest.StopFailureDoesNotStopDependenciesAndUsesReverseDestruction"],
  ),
  "CCA-RF-036": selectors(
    ["RF-LM", "LifecycleManagerTest.AcceptsOnlyTheApprovedFailureCleanupSequence"],
    ["RF-RT", "RuntimeTest.StartFailureRunsFailureRollbackAndDeterministicCleanup"],
    ["RF-RT", "RuntimeTest.EquivalentStartFailuresProduceEquivalentRollbackCleanup"],
    ["RF-RT", "RuntimeTest.ValidationFailurePreventsFreezeAndProviderStartup"],
    ["RF-RT", "RuntimeTest.ExplicitFailureFromRunningRollsBackWithoutNormalShutdownStates"],
    ["RF-RT", "RuntimeTest.StopFailureDoesNotStopDependenciesAndUsesReverseDestruction"],
  ),
});

export const RF_REQUIREMENT_SELECTORS = Object.freeze(Object.fromEntries(
  Array.from({ length: 40 }, (_, index) => {
    const id = `CCA-RF-${String(index + 1).padStart(3, "0")}`;
    return [id, RF_AUTOMATED_SELECTORS[id] ?? Object.freeze([])];
  }),
));

export const INCORPORATED_RANGE_CONJUNCTIONS = Object.freeze({
  "CCA-MOS-MIP-001": Object.freeze({
    registry: "CCA-MIP-1.0",
    firstRequirement: "CCA-MIP-001",
    lastRequirement: "CCA-MIP-064",
    requirementCount: 64,
  }),
  "CCA-MOS-RT-001": Object.freeze({
    registry: "CCA-RF-1.0",
    firstRequirement: "CCA-RF-001",
    lastRequirement: "CCA-RF-040",
    requirementCount: 40,
  }),
});

const MIP_ALIAS_SOURCES = Object.freeze({
  C: "repositories/cca-studio/tests/mip_canonical_test.mjs",
  P: "repositories/cca-studio/tests/memory_investigation_package_test.mjs",
  A: "repositories/cca-studio/tests/mip_adversarial_conformance_test.mjs",
  O: "repositories/cca-studio/tests/mip_ordering_conformance_test.mjs",
  D: "repositories/cca-studio/tests/mip_derived_edge_conformance_test.mjs",
  L: "repositories/cca-studio/tests/mip_pipeline_conformance_test.mjs",
  S: "repositories/cca-studio/tests/mip_schema_conformance_test.mjs",
});

function aliasesIn(cell) {
  const aliases = [];
  for (const match of cell.matchAll(/([A-Z])(\d{2})(?:\s*[\u2013-]\s*(?:[A-Z])?(\d{2}))?/gu)) {
    const [, prefix, firstText, lastText] = match;
    const first = Number(firstText);
    const last = lastText === undefined ? first : Number(lastText);
    if (last < first) throw new Error(`Descending MIP test alias range ${match[0]}`);
    for (let value = first; value <= last; value += 1) {
      aliases.push(`${prefix}${String(value).padStart(2, "0")}`);
    }
  }
  return aliases;
}

function freezeSelectorMap(entries) {
  return Object.freeze(Object.fromEntries(entries.map(([id, selectors]) => [id, Object.freeze(selectors)])));
}

export function parseMipRequirementSelectors(matrix) {
  if (typeof matrix !== "string") throw new TypeError("MIP conformance matrix must be text");

  const aliasSelectors = new Map();
  for (const match of matrix.matchAll(/^- \*\*([A-Z]\d{2})\*\*\s+\u2014\s+`([^`]+)`$/gmu)) {
    const alias = match[1];
    const source = MIP_ALIAS_SOURCES[alias[0]];
    if (!source) throw new Error(`Unknown MIP test alias ${alias}`);
    if (aliasSelectors.has(alias)) throw new Error(`Duplicate MIP test alias ${alias}`);
    aliasSelectors.set(alias, selector("component-js", source, match[2]));
  }
  if (aliasSelectors.size !== 59) {
    throw new Error(`MIP conformance matrix must declare exactly 59 test aliases; found ${aliasSelectors.size}`);
  }

  const requirements = new Map();
  for (const line of matrix.split(/\r?\n/u)) {
    if (!/^\| CCA-MIP-\d{3} \|/u.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((value) => value.trim());
    const id = cells[0];
    if (requirements.has(id)) throw new Error(`Duplicate MIP requirement row ${id}`);
    const number = Number(id.slice(-3));
    const review = number === 3 || number === 44 || number === 57;
    const aliases = review ? [] : aliasesIn(cells[2].split(";", 1)[0]);
    if (!review && aliases.length === 0) throw new Error(`${id} has no automated evidence aliases`);
    const selectors = aliases.map((alias) => {
      const mapped = aliasSelectors.get(alias);
      if (!mapped) throw new Error(`${id} references undefined MIP test alias ${alias}`);
      return mapped;
    });
    const unique = new Map(selectors.map((value) => [`${value.source}\u0000${value.selector}`, value]));
    if (unique.size !== selectors.length) throw new Error(`${id} repeats a MIP test selector`);
    requirements.set(id, Object.freeze([...unique.values()]));
  }
  if (requirements.size !== 64) {
    throw new Error(`MIP conformance matrix must map exactly 64 requirements; found ${requirements.size}`);
  }
  return freezeSelectorMap([...requirements.entries()]);
}

export async function loadMipRequirementSelectors(workspaceRoot, matrixPath = MIP_MATRIX_PATH) {
  if (typeof workspaceRoot !== "string" || workspaceRoot.length === 0) {
    throw new TypeError("workspaceRoot must be a non-empty path string");
  }
  return parseMipRequirementSelectors(await readFile(resolve(workspaceRoot, matrixPath), "utf8"));
}

function expectedDirectRequirementIds() {
  const ranges = Object.freeze({
    ADAPT: 9,
    ART: 16,
    CLI: 10,
    COMP: 6,
    CONF: 7,
    CORE: 12,
    EXPL: 8,
    LIFE: 12,
    MIP: 5,
    REG: 8,
    RT: 6,
    SDK: 10,
    VER: 5,
  });
  return Object.entries(ranges).flatMap(([area, count]) => Array.from(
    { length: count },
    (_, index) => `CCA-MOS-${area}-${String(index + 1).padStart(3, "0")}`,
  ));
}

function assertExactIdentifiers(label, actual, expected) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    throw new Error(`${label} identifiers do not match the frozen requirement registry`);
  }
}

function validateSelectorList(requirementId, values) {
  if (!Array.isArray(values) || !Object.isFrozen(values)) {
    throw new Error(`${requirementId} selector conjunction must be a frozen array`);
  }
  const identities = new Set();
  for (const value of values) {
    if (!value || !Object.isFrozen(value)
        || JSON.stringify(Object.keys(value)) !== JSON.stringify(["executionReference", "source", "selector"])) {
      throw new Error(`${requirementId} contains an invalid selector binding`);
    }
    for (const member of Object.values(value)) {
      if (typeof member !== "string" || member.length === 0) {
        throw new Error(`${requirementId} contains an empty selector binding member`);
      }
    }
    if (value.executionReference === "report-js"
        || value.source === "repositories/cca-conformance/tests/report_conformance_test.mjs") {
      throw new Error(`${requirementId} creates a cyclic dependency on the generated report gate`);
    }
    const identity = `${value.executionReference}\u0000${value.source}\u0000${value.selector}`;
    if (identities.has(identity)) throw new Error(`${requirementId} repeats selector ${value.selector}`);
    identities.add(identity);
  }
}

export function validateRequirementSelectorCatalog(mipRequirementSelectors) {
  assertExactIdentifiers(
    "Direct requirement selector catalog",
    Object.keys(DIRECT_REQUIREMENT_SELECTORS),
    expectedDirectRequirementIds(),
  );
  assertExactIdentifiers(
    "Runtime Foundation selector catalog",
    Object.keys(RF_REQUIREMENT_SELECTORS),
    Array.from({ length: 40 }, (_, index) => `CCA-RF-${String(index + 1).padStart(3, "0")}`),
  );
  assertExactIdentifiers(
    "MIP selector catalog",
    Object.keys(mipRequirementSelectors ?? {}),
    Array.from({ length: 64 }, (_, index) => `CCA-MIP-${String(index + 1).padStart(3, "0")}`),
  );

  for (const [id, values] of Object.entries(DIRECT_REQUIREMENT_SELECTORS)) validateSelectorList(id, values);
  for (const [id, values] of Object.entries(RF_REQUIREMENT_SELECTORS)) validateSelectorList(id, values);
  for (const [id, values] of Object.entries(mipRequirementSelectors)) validateSelectorList(id, values);

  const directReview = new Set([
    "CCA-MOS-ADAPT-001", "CCA-MOS-ADAPT-002", "CCA-MOS-CLI-002", "CCA-MOS-COMP-005",
    "CCA-MOS-CONF-006", "CCA-MOS-CORE-001", "CCA-MOS-EXPL-007", "CCA-MOS-MIP-005",
    "CCA-MOS-RT-002", "CCA-MOS-SDK-001", "CCA-MOS-SDK-007", "CCA-MOS-VER-003",
    "CCA-MOS-VER-004", "CCA-MOS-VER-005",
  ]);
  const wrapperIds = new Set(Object.keys(INCORPORATED_RANGE_CONJUNCTIONS));
  for (const [id, values] of Object.entries(DIRECT_REQUIREMENT_SELECTORS)) {
    const emptyRequired = directReview.has(id) || wrapperIds.has(id);
    if ((values.length === 0) !== emptyRequired) {
      throw new Error(`${id} has the wrong executable/review selector classification`);
    }
  }

  const rfAutomated = new Set([
    "CCA-RF-003", "CCA-RF-007", "CCA-RF-013", "CCA-RF-015", "CCA-RF-016", "CCA-RF-021",
    "CCA-RF-022", "CCA-RF-023", "CCA-RF-024", "CCA-RF-028", "CCA-RF-030", "CCA-RF-031",
    "CCA-RF-033", "CCA-RF-034", "CCA-RF-035", "CCA-RF-036",
  ]);
  for (const [id, values] of Object.entries(RF_REQUIREMENT_SELECTORS)) {
    if ((values.length > 0) !== rfAutomated.has(id)) {
      throw new Error(`${id} has the wrong executable/review selector classification`);
    }
  }

  const mipReview = new Set(["CCA-MIP-003", "CCA-MIP-044", "CCA-MIP-057"]);
  for (const [id, values] of Object.entries(mipRequirementSelectors)) {
    if ((values.length === 0) !== mipReview.has(id)) {
      throw new Error(`${id} has the wrong executable/review selector classification`);
    }
  }

  return Object.freeze({
    directRequirements: 114,
    directAutomated: 100,
    directSelectorBound: 98,
    directReview: 14,
    incorporatedConjunctions: 2,
    runtimeFoundationRequirements: 40,
    runtimeFoundationAutomated: 16,
    runtimeFoundationReview: 24,
    mipRequirements: 64,
    mipAutomated: 61,
    mipReview: 3,
  });
}

export function exactSelector(sourceKey, exactSelector) {
  return fromSource(sourceKey, exactSelector);
}
