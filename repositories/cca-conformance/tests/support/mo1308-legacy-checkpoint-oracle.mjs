// The Phase 2B checkpoint admission exactly as first committed (212ae16): every prefix of the transition log is
// re-hashed, so the cost is quadratic in the transition count. Kept verbatim as the oracle for Amendment A4.5, which
// requires the linear algorithm to give byte-identical results. `digest` is the Standard's D construction; the
// default is the module's own (pure JavaScript); a faster equivalent may be injected for very large inputs.
import { canonicalize, decodeUtf8, mipDigest, parseStrictJson, utf8Encode } from "../../../cca-studio/web/js/mip-canonical.js";
import { verifyMemoryInvestigationPackage } from "../../../cca-studio/web/js/memory-investigation-package.js";
import { MemoryOSHistoryError, historyFail, isWorkspaceIdentifier } from "../../../cca-studio/web/js/memoryos-history-contract.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const hasExactKeys = (value, keys) => isObject(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isString = (value) => typeof value === "string";
const invalid = () => historyFail("RECORD_INVALID", "ADMISSION");
const guard = (condition) => { if (!condition) invalid(); };
function owner(action) {
  try { return action(); } catch (error) {
    if (error?.name === "MemoryOSHistoryError") throw error;
    return invalid();
  }
}
const CORE_VERSION = "1.0.0";
const MAX_TRANSITIONS = 10_000; // the Core's published transition-count policy
const TRANSITION_KINDS = Object.freeze(["CREATED", "OBSERVED", "PACKAGE_IMPORTED", "TRACE_SELECTED", "REPLAY_PREPARED",
  "REPLAY_ACTION", "EVOLUTION_ENTERED", "EVOLUTION_MOVED", "COMPARATIVE_ENTERED", "COMPARATIVE_ACTION", "COMPARATIVE_LEFT",
  "EVOLUTION_LEFT", "RETURNED_TO_WORLD", "VERIFIED", "ARCHIVED"]);
const CHECKPOINT_KEYS = ["kind", "version", "identifier", "investigationIdentifier", "workspaceIdentifier",
  "transitionLog", "transitionLogDigest", "transitionCount", "stateDigest"];
const TRANSITION_KEYS = ["kind", "version", "investigationIdentifier", "index", "payload", "previousLogDigest", "identifier"];
const LOG_KEYS = ["kind", "version", "investigationIdentifier", "transitions", "digest"];


export function legacyAdmitCheckpoint(bytes, workspaceIdentifier, digest = mipDigest) {
  const members = { byName: new Map([["checkpoint.json", bytes]]) };
  const ledger = { workspaceIdentifier };
  return legacy(members, ledger, digest);
}

function legacy(members, ledger, mipDigest) {
  const bytes = members.byName.get("checkpoint.json");
  const checkpoint = owner(() => {
    const text = decodeUtf8(bytes);
    const value = parseStrictJson(text, { maxDepth: 256, maxValues: 4_194_304 });
    if (canonicalize(value) !== text) invalid(); // exactly JCS(x), no trailing LF
    return value;
  });
  guard(hasExactKeys(checkpoint, CHECKPOINT_KEYS) && checkpoint.kind === "MemoryOSInvestigationCheckpoint"
    && checkpoint.version === CORE_VERSION);
  const { investigationIdentifier, workspaceIdentifier, transitionLog: log } = checkpoint;
  guard(isWorkspaceIdentifier(investigationIdentifier) && isWorkspaceIdentifier(workspaceIdentifier)
    && isString(checkpoint.identifier) && isString(checkpoint.transitionLogDigest) && isString(checkpoint.stateDigest));
  guard(hasExactKeys(log, LOG_KEYS) && log.kind === "MemoryOSInvestigationTransitionLog" && log.version === CORE_VERSION
    && log.investigationIdentifier === investigationIdentifier && Array.isArray(log.transitions) && isString(log.digest));
  const { transitions } = log;
  guard(transitions.length >= 2 && transitions.length <= MAX_TRANSITIONS && checkpoint.transitionCount === transitions.length);

  // Every transition identity, the published prefix-digest chain, the log digest and the count.
  const materials = [];
  let priorDigest = mipDigest("INVESTIGATION-CORE-LOG-1.0", investigationIdentifier, "[]");
  transitions.forEach((transition, index) => {
    guard(hasExactKeys(transition, TRANSITION_KEYS) && transition.version === CORE_VERSION
      && transition.investigationIdentifier === investigationIdentifier && transition.index === index
      && TRANSITION_KINDS.includes(transition.kind) && isObject(transition.payload)
      && transition.previousLogDigest === priorDigest && isString(transition.identifier));
    const identifier = mipDigest("INVESTIGATION-CORE-TRANSITION-1.0", canonicalize({
      investigationIdentifier, index, kind: transition.kind, payload: transition.payload, previousLogDigest: transition.previousLogDigest,
    }));
    guard(transition.identifier === identifier);
    materials.push(canonicalize({ identifier, index, investigationIdentifier, kind: transition.kind,
      payload: transition.payload, previousLogDigest: transition.previousLogDigest }));
    priorDigest = mipDigest("INVESTIGATION-CORE-LOG-1.0", investigationIdentifier, `[${materials.join(",")}]`);
  });
  guard(log.digest === priorDigest && checkpoint.transitionLogDigest === priorDigest);
  // The checkpoint identifier; the state digest is retained as the Core issued it, not re-derived.
  guard(checkpoint.identifier === mipDigest("INVESTIGATION-CORE-CHECKPOINT-1.0", investigationIdentifier,
    checkpoint.transitionLogDigest, checkpoint.stateDigest));

  // MIP-backed only: transition 0 CREATED(mip, Workspace) and transition 1 PACKAGE_IMPORTED(verified MIP).
  const [created, imported] = transitions;
  guard(created.kind === "CREATED" && created.payload.sourceKind === "mip"
    && created.payload.workspaceIdentifier === workspaceIdentifier);
  if (workspaceIdentifier !== ledger.workspaceIdentifier) historyFail("WORKSPACE_MISMATCH", "ADMISSION");
  guard(imported.kind === "PACKAGE_IMPORTED" && hasExactKeys(imported.payload, ["package", "supportedExtensions"])
    && Array.isArray(imported.payload.supportedExtensions) && imported.payload.supportedExtensions.every(isString));
  const verification = owner(() => verifyMemoryInvestigationPackage(utf8Encode(canonicalize(imported.payload.package)),
    { supportedExtensions: imported.payload.supportedExtensions }));
  guard(verification.valid === true && verification.package.manifest.workspaceIdentifier === workspaceIdentifier);
  return [
    { type: "CHECKPOINT", value: checkpoint.identifier },
    { type: "INVESTIGATION", value: investigationIdentifier },
    { type: "TRANSITION_LOG_DIGEST", value: checkpoint.transitionLogDigest },
    { type: "WORKSPACE", value: workspaceIdentifier },
  ];
}


export { MemoryOSHistoryError };
