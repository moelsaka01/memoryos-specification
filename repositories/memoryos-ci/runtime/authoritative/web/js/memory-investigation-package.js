import {
  canonicalize,
  cloneCanonical,
  decodeUtf8,
  deepFreeze,
  mipDigest,
  parseStrictJson,
  utf8Encode,
} from "./mip-canonical.js";

export const MIP_SCHEMA = "urn:memoryos:mip:schema:1.0.0";
export const MIP_KIND = "MemoryInvestigationPackage";
export const MIP_FORMAT_VERSION = "1.0.0";
export const MIP_MEDIA_TYPE = "application/vnd.memoryos.mip+json";

const TOP_LEVEL = Object.freeze([
  "$schema", "kind", "formatVersion", "manifest", "metadata", "observations",
  "traces", "replays", "evolutions", "comparativeReconstructions", "extensions",
  "verification", "integrity",
]);
const SECTION_ORDER = Object.freeze([
  "manifest", "metadata", "observations", "traces", "replays", "evolutions",
  "comparativeReconstructions", "extensions", "verification",
]);
const COGNITION_SECTIONS = new Set([
  "observations", "traces", "replays", "evolutions", "comparativeReconstructions",
]);
const VERIFICATION_CHECKS = Object.freeze([
  "STRUCTURE", "CANONICAL_BYTES", "INTEGRITY", "REFERENCE_CLOSURE",
  "DETERMINISTIC_DERIVATIONS", "PROHIBITED_CONTENT",
]);
const SEMANTIC_ROLES = new Set([
  "evidence", "semanticTransformation", "retrieval", "reflection", "context",
]);
const TRACE_ROLES = Object.freeze([
  "originEvidence", "semanticTransformation", "retrieval", "reflectionCurrent",
]);
const TRACE_ROLE_SET = new Set(TRACE_ROLES);
const DIFFERENCE_KINDS = Object.freeze([
  "addedEvidence", "removedEvidence", "addedRelationship", "removedRelationship",
  "modifiedRelationship", "addedSemanticTransformation", "removedSemanticTransformation",
  "addedRetrieval", "removedRetrieval", "addedReflection", "removedReflection",
]);
const DIFFERENCE_RANK = new Map(DIFFERENCE_KINDS.map((kind, index) => [kind, index]));
const COMPARATIVE_STATES = new Set(["shared", "aOnly", "bOnly", "modified"]);
const REASON_CODES = Object.freeze([
  "A_ONLY", "B_ONLY", "SEMANTIC_REVISION_CHANGED",
  "RELATIONSHIP_REVISION_CHANGED", "TRACE_BINDING_CHANGED",
]);
const REASON_RANK = new Map(REASON_CODES.map((code, index) => [code, index]));
const FORMAT_VERSION = /^1\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const ANY_STABLE_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const EXTENSION_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const EXTENSION_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){2,}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const EXPORTED_AT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z$/;
const MAX_SAFE = 9007199254740991;
const MAX_SAFE_PARSER_DEPTH = 512;
const RFC3339_LEAP_SECOND_DATES = new Set([
  "1972-06-30", "1972-12-31", "1973-12-31", "1974-12-31", "1975-12-31", "1976-12-31",
  "1977-12-31", "1978-12-31", "1979-12-31", "1981-06-30", "1982-06-30", "1983-06-30",
  "1985-06-30", "1987-12-31", "1989-12-31", "1990-12-31", "1992-06-30", "1993-06-30",
  "1994-06-30", "1995-12-31", "1997-06-30", "1998-12-31", "2005-12-31", "2008-12-31",
  "2012-06-30", "2015-06-30", "2016-12-31",
]);
const VERIFIED_PACKAGES = new WeakSet();
const VERIFIED_EXTENSION_SUPPORT = new WeakMap();

const PHASE = Object.freeze({
  resource: 1,
  lexical: 2,
  canonical: 3,
  schema: 4,
  integrity: 5,
  model: 6,
  provenance: 7,
  trace: 8,
  replay: 9,
  evolution: 10,
  comparative: 11,
  extensions: 12,
  verification: 13,
});

const escapePointer = (value) => String(value).replaceAll("~", "~0").replaceAll("/", "~1");
const at = (base, member) => `${base}/${escapePointer(member)}`;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const refKey = (reference) => canonicalize([reference.kind, reference.identifier, reference.occurrence]);
const sameReference = (left, right) => Boolean(left && right && refKey(left) === refKey(right));

function compareScalarText(left, right) {
  const a = Array.from(left, (character) => character.codePointAt(0));
  const b = Array.from(right, (character) => character.codePointAt(0));
  const count = Math.min(a.length, b.length);
  for (let index = 0; index < count; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return a.length - b.length;
}

function validRfc3339Utc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]
    || hour > 23 || minute > 59 || second > 60) return false;
  // RFC 3339 permits 60 only for a leap second at the end of a UTC day.
  return second !== 60 || (hour === 23 && minute === 59
    && RFC3339_LEAP_SECOND_DATES.has(`${yearText}-${monthText}-${dayText}`));
}

function compareReference(left, right) {
  return compareScalarText(left.kind, right.kind)
    || compareScalarText(left.identifier, right.identifier)
    || left.occurrence - right.occurrence;
}

function canonicalEqual(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function parserPathToPointer(path) {
  if (typeof path !== "string" || !path.startsWith("$")) return "";
  const members = [];
  const pattern = /\[(?:"((?:[^"\\]|\\.)*)"|(\d+))\]/g;
  let match;
  while ((match = pattern.exec(path)) !== null) {
    if (match[2] !== undefined) members.push(match[2]);
    else {
      try { members.push(JSON.parse(`"${match[1]}"`)); } catch { return ""; }
    }
  }
  return members.reduce((pointer, member) => at(pointer, member), "");
}

function diagnostic(phase, code, path) {
  return Object.freeze({ phase, code, path });
}

function publicDiagnostic({ code, path }) {
  return Object.freeze({ code, path });
}

function sortDiagnostics(values) {
  return values.sort((left, right) => left.phase - right.phase
    || compareScalarText(left.path, right.path)
    || compareScalarText(left.code, right.code));
}

export class MemoryInvestigationPackageError extends Error {
  constructor(diagnostics, message = "The Memory Investigation Package is invalid.") {
    super(message);
    this.name = "MemoryInvestigationPackageError";
    this.diagnostics = Object.freeze(diagnostics.map(publicDiagnostic));
  }
}

function add(diagnostics, phase, code, path) {
  diagnostics.push(diagnostic(phase, code, path));
}

function exactObject(value, required, optional, path, diagnostics) {
  if (!isObject(value)) {
    add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", path);
    return false;
  }
  const allowed = new Set([...required, ...optional]);
  for (const member of required) {
    if (!Object.hasOwn(value, member)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, member));
  }
  for (const member of Object.keys(value)) {
    if (!allowed.has(member)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, member));
  }
  return required.every((member) => Object.hasOwn(value, member))
    && Object.keys(value).every((member) => allowed.has(member));
}

function requireString(value, path, diagnostics, pattern = null) {
  if (typeof value !== "string" || value.length === 0 || (pattern && !pattern.test(value))) {
    add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", path);
    return false;
  }
  return true;
}

function requireInteger(value, path, diagnostics, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_SAFE) {
    add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", path);
    return false;
  }
  return true;
}

function requireArray(value, path, diagnostics, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) {
    add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", path);
    return false;
  }
  return true;
}

function validateCanonicalValue(value, path, diagnostics) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((member, index) => validateCanonicalValue(member, at(path, index), diagnostics));
    return;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([member, child]) => validateCanonicalValue(child, at(path, member), diagnostics));
    return;
  }
  add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", path);
}

function validateReference(value, path, diagnostics) {
  if (!exactObject(value, ["kind", "identifier", "occurrence"], [], path, diagnostics)) return;
  requireString(value.kind, at(path, "kind"), diagnostics);
  requireString(value.identifier, at(path, "identifier"), diagnostics);
  requireInteger(value.occurrence, at(path, "occurrence"), diagnostics);
}

function validateProduct(value, path, diagnostics) {
  if (!exactObject(value, ["name", "version"], [], path, diagnostics)) return;
  requireString(value.name, at(path, "name"), diagnostics);
  requireString(value.version, at(path, "version"), diagnostics);
}

function validateManifest(value, path, diagnostics) {
  if (!exactObject(value, ["packageIdentifier", "workspaceIdentifier", "profiles", "features", "inventory"], [], path, diagnostics)) return;
  requireString(value.packageIdentifier, at(path, "packageIdentifier"), diagnostics);
  requireString(value.workspaceIdentifier, at(path, "workspaceIdentifier"), diagnostics);
  if (exactObject(value.profiles, ["canonicalization", "digest", "validation"], [], at(path, "profiles"), diagnostics)) {
    if (value.profiles.canonicalization !== "RFC8785") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(at(path, "profiles"), "canonicalization"));
    if (value.profiles.digest !== "SHA-256") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(at(path, "profiles"), "digest"));
    if (value.profiles.validation !== "MIP-CORE-1.0") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(at(path, "profiles"), "validation"));
  }
  if (exactObject(value.features, ["required", "optional"], [], at(path, "features"), diagnostics)) {
    for (const member of ["required", "optional"]) {
      const featurePath = at(at(path, "features"), member);
      if (requireArray(value.features[member], featurePath, diagnostics)) {
        value.features[member].forEach((entry, index) => requireString(entry, at(featurePath, index), diagnostics));
        if (new Set(value.features[member]).size !== value.features[member].length) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", featurePath);
      }
    }
  }
  if (exactObject(value.inventory, ["observations", "traces", "replays", "evolutions", "comparativeReconstructions"], [], at(path, "inventory"), diagnostics)) {
    for (const member of ["observations", "traces", "replays", "evolutions", "comparativeReconstructions"]) {
      requireInteger(value.inventory[member], at(at(path, "inventory"), member), diagnostics, member === "observations" ? 1 : 0);
    }
  }
}

function validateMetadata(value, path, diagnostics) {
  if (!exactObject(value, ["producer", "source"], ["exportedAt"], path, diagnostics)) return;
  validateProduct(value.producer, at(path, "producer"), diagnostics);
  validateProduct(value.source, at(path, "source"), diagnostics);
  if (Object.hasOwn(value, "exportedAt")) {
    const valid = requireString(value.exportedAt, at(path, "exportedAt"), diagnostics, EXPORTED_AT);
    if (valid && !validRfc3339Utc(value.exportedAt)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "exportedAt"));
  }
}

function validateRecord(value, path, diagnostics) {
  if (!exactObject(value, ["reference", "role", "provenance", "revision"], [], path, diagnostics)) return;
  validateReference(value.reference, at(path, "reference"), diagnostics);
  if (!SEMANTIC_ROLES.has(value.role)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "role"));
  if (requireArray(value.provenance, at(path, "provenance"), diagnostics)) {
    value.provenance.forEach((link, index) => {
      const linkPath = at(at(path, "provenance"), index);
      if (!exactObject(link, ["source", "relationship"], [], linkPath, diagnostics)) return;
      validateReference(link.source, at(linkPath, "source"), diagnostics);
      validateReference(link.relationship, at(linkPath, "relationship"), diagnostics);
    });
  }
  if (!isObject(value.revision)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "revision"));
  else validateCanonicalValue(value.revision, at(path, "revision"), diagnostics);
}

function validateRelationship(value, path, diagnostics) {
  if (!exactObject(value, ["reference", "relationshipType", "from", "to", "revision"], [], path, diagnostics)) return;
  validateReference(value.reference, at(path, "reference"), diagnostics);
  requireString(value.relationshipType, at(path, "relationshipType"), diagnostics);
  validateReference(value.from, at(path, "from"), diagnostics);
  validateReference(value.to, at(path, "to"), diagnostics);
  if (!isObject(value.revision)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "revision"));
  else validateCanonicalValue(value.revision, at(path, "revision"), diagnostics);
}

function validateObservation(value, path, diagnostics) {
  if (!exactObject(value, ["identifier", "sequence", "workspaceIdentifier", "records", "relationships"], [], path, diagnostics)) return;
  requireString(value.identifier, at(path, "identifier"), diagnostics);
  requireInteger(value.sequence, at(path, "sequence"), diagnostics);
  requireString(value.workspaceIdentifier, at(path, "workspaceIdentifier"), diagnostics);
  if (requireArray(value.records, at(path, "records"), diagnostics, 1)) value.records.forEach((record, index) => validateRecord(record, at(at(path, "records"), index), diagnostics));
  if (requireArray(value.relationships, at(path, "relationships"), diagnostics)) value.relationships.forEach((relationship, index) => validateRelationship(relationship, at(at(path, "relationships"), index), diagnostics));
}

function validateTraceStep(value, path, diagnostics) {
  if (!exactObject(value, ["index", "role", "node", "relationship", "direction"], [], path, diagnostics)) return;
  requireInteger(value.index, at(path, "index"), diagnostics);
  if (!TRACE_ROLE_SET.has(value.role)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "role"));
  validateReference(value.node, at(path, "node"), diagnostics);
  if (value.relationship !== null) validateReference(value.relationship, at(path, "relationship"), diagnostics);
  if (value.direction !== null && !["forward", "reverse"].includes(value.direction)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "direction"));
}

function validateTrace(value, path, diagnostics) {
  if (!exactObject(value, ["identifier", "observationIdentifier", "workspaceIdentifier", "target", "branches"], [], path, diagnostics)) return;
  requireString(value.identifier, at(path, "identifier"), diagnostics);
  requireString(value.observationIdentifier, at(path, "observationIdentifier"), diagnostics);
  requireString(value.workspaceIdentifier, at(path, "workspaceIdentifier"), diagnostics);
  validateReference(value.target, at(path, "target"), diagnostics);
  if (requireArray(value.branches, at(path, "branches"), diagnostics, 1)) {
    value.branches.forEach((branch, index) => {
      const branchPath = at(at(path, "branches"), index);
      if (!exactObject(branch, ["index", "steps"], [], branchPath, diagnostics)) return;
      requireInteger(branch.index, at(branchPath, "index"), diagnostics);
      if (requireArray(branch.steps, at(branchPath, "steps"), diagnostics, 4)) branch.steps.forEach((step, stepIndex) => validateTraceStep(step, at(at(branchPath, "steps"), stepIndex), diagnostics));
    });
  }
}

function validateReplay(value, path, diagnostics) {
  if (!exactObject(value, ["identifier", "traceIdentifier", "observationIdentifier", "workspaceIdentifier", "steps"], [], path, diagnostics)) return;
  for (const member of ["identifier", "traceIdentifier", "observationIdentifier", "workspaceIdentifier"]) requireString(value[member], at(path, member), diagnostics);
  if (requireArray(value.steps, at(path, "steps"), diagnostics, 1)) {
    value.steps.forEach((step, index) => {
      const stepPath = at(at(path, "steps"), index);
      if (!exactObject(step, ["index", "elementType", "node", "relationship", "role", "direction"], [], stepPath, diagnostics)) return;
      requireInteger(step.index, at(stepPath, "index"), diagnostics);
      if (!TRACE_ROLE_SET.has(step.role)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(stepPath, "role"));
      if (!["node", "relationship"].includes(step.elementType)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(stepPath, "elementType"));
      if (step.node !== null) validateReference(step.node, at(stepPath, "node"), diagnostics);
      if (step.relationship !== null) validateReference(step.relationship, at(stepPath, "relationship"), diagnostics);
      if (step.direction !== null && !["forward", "reverse"].includes(step.direction)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(stepPath, "direction"));
    });
  }
}

function validateEvolution(value, path, diagnostics) {
  if (!exactObject(value, ["identifier", "fromObservationIdentifier", "toObservationIdentifier", "workspaceIdentifier", "differences"], [], path, diagnostics)) return;
  for (const member of ["identifier", "fromObservationIdentifier", "toObservationIdentifier", "workspaceIdentifier"]) requireString(value[member], at(path, member), diagnostics);
  if (requireArray(value.differences, at(path, "differences"), diagnostics)) {
    value.differences.forEach((difference, index) => {
      const differencePath = at(at(path, "differences"), index);
      if (!exactObject(difference, ["index", "kind", "subject", "beforeRevisionDigest", "afterRevisionDigest"], [], differencePath, diagnostics)) return;
      requireInteger(difference.index, at(differencePath, "index"), diagnostics);
      if (!DIFFERENCE_RANK.has(difference.kind)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(differencePath, "kind"));
      validateReference(difference.subject, at(differencePath, "subject"), diagnostics);
      for (const member of ["beforeRevisionDigest", "afterRevisionDigest"]) {
        if (difference[member] !== null && (typeof difference[member] !== "string" || !DIGEST.test(difference[member]))) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(differencePath, member));
      }
    });
  }
}

function validateComparativeSide(value, path, diagnostics) {
  if (!exactObject(value, ["elementType", "reference", "role", "direction", "revisionDigest"], [], path, diagnostics)) return;
  if (!["node", "relationship"].includes(value.elementType)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "elementType"));
  validateReference(value.reference, at(path, "reference"), diagnostics);
  if (!TRACE_ROLE_SET.has(value.role)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "role"));
  if (value.direction !== null && !["forward", "reverse"].includes(value.direction)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "direction"));
  if (typeof value.revisionDigest !== "string" || !DIGEST.test(value.revisionDigest)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "revisionDigest"));
}

function validateComparative(value, path, diagnostics) {
  const identifiers = ["identifier", "fromObservationIdentifier", "toObservationIdentifier", "fromTraceIdentifier", "toTraceIdentifier", "evolutionIdentifier", "workspaceIdentifier"];
  if (!exactObject(value, [...identifiers, "moments", "divergenceIndices"], [], path, diagnostics)) return;
  identifiers.forEach((member) => requireString(value[member], at(path, member), diagnostics));
  if (requireArray(value.moments, at(path, "moments"), diagnostics, 1)) {
    value.moments.forEach((moment, index) => {
      const momentPath = at(at(path, "moments"), index);
      if (!exactObject(moment, ["index", "state", "reasonCodes", "from", "to"], [], momentPath, diagnostics)) return;
      requireInteger(moment.index, at(momentPath, "index"), diagnostics);
      if (!COMPARATIVE_STATES.has(moment.state)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(momentPath, "state"));
      if (requireArray(moment.reasonCodes, at(momentPath, "reasonCodes"), diagnostics)) {
        moment.reasonCodes.forEach((code, reasonIndex) => {
          if (!REASON_RANK.has(code)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(at(momentPath, "reasonCodes"), reasonIndex));
        });
        if (new Set(moment.reasonCodes).size !== moment.reasonCodes.length) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(momentPath, "reasonCodes"));
      }
      if (moment.from !== null) validateComparativeSide(moment.from, at(momentPath, "from"), diagnostics);
      if (moment.to !== null) validateComparativeSide(moment.to, at(momentPath, "to"), diagnostics);
    });
  }
  if (requireArray(value.divergenceIndices, at(path, "divergenceIndices"), diagnostics)) {
    value.divergenceIndices.forEach((entry, index) => requireInteger(entry, at(at(path, "divergenceIndices"), index), diagnostics));
    if (new Set(value.divergenceIndices).size !== value.divergenceIndices.length) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "divergenceIndices"));
  }
}

function validateExtensions(value, path, diagnostics) {
  if (!isObject(value)) {
    add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", path);
    return;
  }
  for (const [name, extension] of Object.entries(value)) {
    const extensionPath = at(path, name);
    if (!EXTENSION_NAME.test(name)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", extensionPath);
    if (!exactObject(extension, ["version", "critical", "payload"], [], extensionPath, diagnostics)) continue;
    if (typeof extension.version !== "string" || !EXTENSION_VERSION.test(extension.version)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(extensionPath, "version"));
    if (typeof extension.critical !== "boolean") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(extensionPath, "critical"));
    validateCanonicalValue(extension.payload, at(extensionPath, "payload"), diagnostics);
  }
}

function validateVerification(value, path, diagnostics) {
  if (!exactObject(value, ["profile", "status", "checks"], [], path, diagnostics)) return;
  if (value.profile !== "MIP-CORE-1.0") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "profile"));
  if (value.status !== "passed") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "status"));
  if (requireArray(value.checks, at(path, "checks"), diagnostics) && value.checks.length !== 6) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "checks"));
  if (Array.isArray(value.checks)) value.checks.forEach((check, index) => {
    const checkPath = at(at(path, "checks"), index);
    if (!exactObject(check, ["code", "status"], [], checkPath, diagnostics)) return;
    requireString(check.code, at(checkPath, "code"), diagnostics);
    if (check.status !== "passed") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(checkPath, "status"));
  });
}

function validateIntegrity(value, path, diagnostics) {
  if (!exactObject(value, ["profile", "sectionDigests", "cognitionDigest", "packageDigest"], [], path, diagnostics)) return;
  if (value.profile !== "MIP-SHA-256-1.0") add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "profile"));
  if (requireArray(value.sectionDigests, at(path, "sectionDigests"), diagnostics) && value.sectionDigests.length !== 9) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, "sectionDigests"));
  if (Array.isArray(value.sectionDigests)) value.sectionDigests.forEach((record, index) => {
    const recordPath = at(at(path, "sectionDigests"), index);
    if (!exactObject(record, ["name", "digest"], [], recordPath, diagnostics)) return;
    if (!SECTION_ORDER.includes(record.name)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(recordPath, "name"));
    if (typeof record.digest !== "string" || !DIGEST.test(record.digest)) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(recordPath, "digest"));
  });
  for (const member of ["cognitionDigest", "packageDigest"]) if (typeof value[member] !== "string" || !DIGEST.test(value[member])) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", at(path, member));
}

function validateStructure(value, diagnostics) {
  if (!isObject(value)) {
    add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", "");
    return;
  }
  for (const member of TOP_LEVEL) if (!Object.hasOwn(value, member)) add(diagnostics, PHASE.schema, "MISSING_REQUIRED_SECTION", at("", member));
  for (const member of Object.keys(value)) if (!TOP_LEVEL.includes(member)) add(diagnostics, PHASE.schema, "UNKNOWN_CORE_MEMBER", at("", member));
  if (diagnostics.length) return;
  if (value.$schema !== MIP_SCHEMA) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", "/$schema");
  if (value.kind !== MIP_KIND) add(diagnostics, PHASE.schema, "SCHEMA_VIOLATION", "/kind");
  if (typeof value.formatVersion !== "string" || !ANY_STABLE_VERSION.test(value.formatVersion)) add(diagnostics, PHASE.schema, "UNSUPPORTED_VERSION", "/formatVersion");
  else if (!FORMAT_VERSION.test(value.formatVersion)) add(diagnostics, PHASE.schema, "UNSUPPORTED_VERSION", "/formatVersion");
  validateManifest(value.manifest, "/manifest", diagnostics);
  validateMetadata(value.metadata, "/metadata", diagnostics);
  if (requireArray(value.observations, "/observations", diagnostics, 1)) value.observations.forEach((entry, index) => validateObservation(entry, at("/observations", index), diagnostics));
  if (requireArray(value.traces, "/traces", diagnostics)) value.traces.forEach((entry, index) => validateTrace(entry, at("/traces", index), diagnostics));
  if (requireArray(value.replays, "/replays", diagnostics)) value.replays.forEach((entry, index) => validateReplay(entry, at("/replays", index), diagnostics));
  if (requireArray(value.evolutions, "/evolutions", diagnostics)) value.evolutions.forEach((entry, index) => validateEvolution(entry, at("/evolutions", index), diagnostics));
  if (requireArray(value.comparativeReconstructions, "/comparativeReconstructions", diagnostics)) value.comparativeReconstructions.forEach((entry, index) => validateComparative(entry, at("/comparativeReconstructions", index), diagnostics));
  validateExtensions(value.extensions, "/extensions", diagnostics);
  validateVerification(value.verification, "/verification", diagnostics);
  validateIntegrity(value.integrity, "/integrity", diagnostics);
}

function isOrdered(values, comparator) {
  for (let index = 1; index < values.length; index += 1) {
    if (comparator(values[index - 1], values[index]) > 0) return false;
  }
  return true;
}

function requireContiguousIndices(values, path, diagnostics, phase, code) {
  values.forEach((value, index) => {
    if (value.index !== index) add(diagnostics, phase, code, at(at(path, index), "index"));
  });
}

function uniqueIdentifiers(values, path, diagnostics) {
  const seen = new Set();
  values.forEach((value, index) => {
    if (seen.has(value.identifier)) add(diagnostics, PHASE.model, "DUPLICATE_IDENTIFIER", at(at(path, index), "identifier"));
    seen.add(value.identifier);
  });
}

function validateOccurrences(values, path, diagnostics) {
  const expected = new Map();
  values.forEach((value, index) => {
    const group = canonicalize([value.reference.kind, value.reference.identifier]);
    const next = expected.get(group) ?? 0;
    if (value.reference.occurrence !== next) add(diagnostics, PHASE.model, "ORDER_VIOLATION", at(at(at(path, index), "reference"), "occurrence"));
    expected.set(group, next + 1);
  });
}

function artifactOrder(packageValue, collection) {
  const observations = new Map(packageValue.observations.map((observation) => [observation.identifier, observation]));
  if (collection === "evolutions") return (left, right) => {
    const leftFrom = observations.get(left.fromObservationIdentifier)?.sequence ?? MAX_SAFE;
    const rightFrom = observations.get(right.fromObservationIdentifier)?.sequence ?? MAX_SAFE;
    const leftTo = observations.get(left.toObservationIdentifier)?.sequence ?? MAX_SAFE;
    const rightTo = observations.get(right.toObservationIdentifier)?.sequence ?? MAX_SAFE;
    return leftFrom - rightFrom || leftTo - rightTo || compareScalarText(left.identifier, right.identifier);
  };
  if (collection === "comparativeReconstructions") return (left, right) => {
    const leftFrom = observations.get(left.fromObservationIdentifier)?.sequence ?? MAX_SAFE;
    const rightFrom = observations.get(right.fromObservationIdentifier)?.sequence ?? MAX_SAFE;
    const leftTo = observations.get(left.toObservationIdentifier)?.sequence ?? MAX_SAFE;
    const rightTo = observations.get(right.toObservationIdentifier)?.sequence ?? MAX_SAFE;
    return leftFrom - rightFrom || leftTo - rightTo
      || compareScalarText(left.fromTraceIdentifier, right.fromTraceIdentifier)
      || compareScalarText(left.toTraceIdentifier, right.toTraceIdentifier)
      || compareScalarText(left.identifier, right.identifier);
  };
  return (left, right) => compareScalarText(left.identifier, right.identifier);
}

function validateModel(value, diagnostics) {
  const workspace = value.manifest.workspaceIdentifier;
  const inventory = value.manifest.inventory;
  for (const section of ["observations", "traces", "replays", "evolutions", "comparativeReconstructions"]) {
    if (inventory[section] !== value[section].length) add(diagnostics, PHASE.model, "ORDER_VIOLATION", `/manifest/inventory/${section}`);
  }
  const required = value.manifest.features.required;
  const optional = value.manifest.features.optional;
  if (!isOrdered(required, compareScalarText)) add(diagnostics, PHASE.model, "ORDER_VIOLATION", "/manifest/features/required");
  if (!isOrdered(optional, compareScalarText)) add(diagnostics, PHASE.model, "ORDER_VIOLATION", "/manifest/features/optional");
  const optionalSet = new Set(optional);
  required.forEach((name, index) => {
    if (optionalSet.has(name)) add(diagnostics, PHASE.model, "DUPLICATE_IDENTIFIER", at("/manifest/features/required", index));
  });

  if (!isOrdered(value.observations, (left, right) => left.sequence - right.sequence || compareScalarText(left.identifier, right.identifier))) {
    add(diagnostics, PHASE.model, "ORDER_VIOLATION", "/observations");
  }
  value.observations.forEach((observation, index) => {
    const path = at("/observations", index);
    if (observation.workspaceIdentifier !== workspace) add(diagnostics, PHASE.model, "WORKSPACE_MISMATCH", at(path, "workspaceIdentifier"));
    if (index > 0 && observation.sequence <= value.observations[index - 1].sequence) add(diagnostics, PHASE.model, "ORDER_VIOLATION", at(path, "sequence"));
    if (!isOrdered(observation.records, (left, right) => compareReference(left.reference, right.reference))) add(diagnostics, PHASE.model, "ORDER_VIOLATION", at(path, "records"));
    if (!isOrdered(observation.relationships, (left, right) => compareReference(left.reference, right.reference))) add(diagnostics, PHASE.model, "ORDER_VIOLATION", at(path, "relationships"));
    validateOccurrences(observation.records, at(path, "records"), diagnostics);
    validateOccurrences(observation.relationships, at(path, "relationships"), diagnostics);
    const recordKeys = new Set();
    observation.records.forEach((record, recordIndex) => {
      const key = refKey(record.reference);
      if (recordKeys.has(key)) add(diagnostics, PHASE.model, "DUPLICATE_IDENTIFIER", at(at(at(path, "records"), recordIndex), "reference"));
      recordKeys.add(key);
    });
    const relationshipKeys = new Set();
    observation.relationships.forEach((relationship, relationshipIndex) => {
      const key = refKey(relationship.reference);
      if (relationshipKeys.has(key)) add(diagnostics, PHASE.model, "DUPLICATE_IDENTIFIER", at(at(at(path, "relationships"), relationshipIndex), "reference"));
      relationshipKeys.add(key);
    });
  });
  uniqueIdentifiers(value.observations, "/observations", diagnostics);
  for (const section of ["traces", "replays", "evolutions", "comparativeReconstructions"]) {
    uniqueIdentifiers(value[section], `/${section}`, diagnostics);
    if (!isOrdered(value[section], artifactOrder(value, section))) add(diagnostics, PHASE.model, "ORDER_VIOLATION", `/${section}`);
    value[section].forEach((artifact, index) => {
      if (artifact.workspaceIdentifier !== workspace) add(diagnostics, PHASE.model, "WORKSPACE_MISMATCH", at(at(`/${section}`, index), "workspaceIdentifier"));
    });
  }
}

function observationIndexes(observation) {
  return {
    records: new Map(observation.records.map((record) => [refKey(record.reference), record])),
    relationships: new Map(observation.relationships.map((relationship) => [refKey(relationship.reference), relationship])),
  };
}

function relationshipDirection(relationship, source, target) {
  if (sameReference(relationship.from, source) && sameReference(relationship.to, target)) return "forward";
  if (sameReference(relationship.to, source) && sameReference(relationship.from, target)) return "reverse";
  return null;
}

function validateProvenance(value, diagnostics) {
  value.observations.forEach((observation, observationIndex) => {
    const base = at("/observations", observationIndex);
    const indexes = observationIndexes(observation);
    let danglingEndpoint = false;
    observation.relationships.forEach((relationship, index) => {
      for (const member of ["from", "to"]) {
        if (!indexes.records.has(refKey(relationship[member]))) {
          danglingEndpoint = true;
          add(diagnostics, PHASE.provenance, "DANGLING_REFERENCE", at(at(at(base, "relationships"), index), member));
        }
      }
    });
    if (danglingEndpoint) return;
    const usedRelationships = new Set();
    const provenanceGraph = new Map(observation.records.map((record) => [refKey(record.reference), []]));
    observation.records.forEach((record, recordIndex) => {
      const recordPath = at(at(base, "records"), recordIndex);
      const validCardinality = (["evidence", "context"].includes(record.role) && record.provenance.length === 0)
        || (record.role === "retrieval" && record.provenance.length === 1)
        || (["semanticTransformation", "reflection"].includes(record.role) && record.provenance.length >= 1);
      if (!validCardinality) add(diagnostics, PHASE.provenance, "INVALID_PROVENANCE", at(recordPath, "provenance"));
      const expectedRole = record.role === "semanticTransformation" ? "evidence"
        : record.role === "retrieval" ? "semanticTransformation"
          : record.role === "reflection" ? "retrieval" : null;
      record.provenance.forEach((link, linkIndex) => {
        const linkPath = at(at(recordPath, "provenance"), linkIndex);
        const source = indexes.records.get(refKey(link.source));
        const relationship = indexes.relationships.get(refKey(link.relationship));
        if (!source) add(diagnostics, PHASE.provenance, "DANGLING_REFERENCE", at(linkPath, "source"));
        if (!relationship) add(diagnostics, PHASE.provenance, "DANGLING_REFERENCE", at(linkPath, "relationship"));
        if (source && source.role !== expectedRole) add(diagnostics, PHASE.provenance, "INVALID_PROVENANCE", at(linkPath, "source"));
        if (relationship && !relationshipDirection(relationship, link.source, record.reference)) add(diagnostics, PHASE.provenance, "INVALID_PROVENANCE", at(linkPath, "relationship"));
        const relationshipKey = refKey(link.relationship);
        if (usedRelationships.has(relationshipKey)) add(diagnostics, PHASE.provenance, "INVALID_PROVENANCE", at(linkPath, "relationship"));
        usedRelationships.add(relationshipKey);
        if (source) provenanceGraph.get(refKey(source.reference)).push(refKey(record.reference));
      });
    });
    const colors = new Map();
    const cycle = (root) => {
      if (colors.get(root) === 2) return false;
      const stack = [{ children: provenanceGraph.get(root) ?? [], index: 0, node: root }];
      colors.set(root, 1);
      while (stack.length) {
        const frame = stack.at(-1);
        if (frame.index >= frame.children.length) {
          colors.set(frame.node, 2);
          stack.pop();
          continue;
        }
        const child = frame.children[frame.index];
        frame.index += 1;
        if (colors.get(child) === 1) return true;
        if (colors.get(child) === 2) continue;
        colors.set(child, 1);
        stack.push({ children: provenanceGraph.get(child) ?? [], index: 0, node: child });
      }
      return false;
    };
    for (const key of provenanceGraph.keys()) {
      if (cycle(key)) {
        add(diagnostics, PHASE.provenance, "INVALID_PROVENANCE", at(base, "records"));
        break;
      }
    }
  });
}

function constructTrace(trace, observation) {
  const indexes = observationIndexes(observation);
  const target = indexes.records.get(refKey(trace.target));
  if (!target || target.role !== "reflection") throw new Error("INVALID_TRACE");
  const branches = target.provenance.map((reflectionLink, branchIndex) => {
    const retrieval = indexes.records.get(refKey(reflectionLink.source));
    if (!retrieval || retrieval.role !== "retrieval" || retrieval.provenance.length !== 1) throw new Error("INVALID_TRACE");
    const retrievalLink = retrieval.provenance[0];
    const transformation = indexes.records.get(refKey(retrievalLink.source));
    if (!transformation || transformation.role !== "semanticTransformation" || transformation.provenance.length < 1) throw new Error("INVALID_TRACE");
    const steps = [];
    transformation.provenance.forEach((originLink) => {
      const origin = indexes.records.get(refKey(originLink.source));
      const relationship = indexes.relationships.get(refKey(originLink.relationship));
      if (!origin || origin.role !== "evidence" || !relationship) throw new Error("INVALID_TRACE");
      const direction = relationshipDirection(relationship, origin.reference, transformation.reference);
      if (!direction) throw new Error("INVALID_TRACE");
      steps.push({ direction, index: steps.length, node: origin.reference, relationship: relationship.reference, role: "originEvidence" });
    });
    const transformationRelationship = indexes.relationships.get(refKey(retrievalLink.relationship));
    const retrievalRelationship = indexes.relationships.get(refKey(reflectionLink.relationship));
    const transformationDirection = transformationRelationship && relationshipDirection(transformationRelationship, transformation.reference, retrieval.reference);
    const retrievalDirection = retrievalRelationship && relationshipDirection(retrievalRelationship, retrieval.reference, target.reference);
    if (!transformationDirection || !retrievalDirection) throw new Error("INVALID_TRACE");
    steps.push({ direction: transformationDirection, index: steps.length, node: transformation.reference, relationship: transformationRelationship.reference, role: "semanticTransformation" });
    steps.push({ direction: retrievalDirection, index: steps.length, node: retrieval.reference, relationship: retrievalRelationship.reference, role: "retrieval" });
    steps.push({ direction: null, index: steps.length, node: target.reference, relationship: null, role: "reflectionCurrent" });
    return { index: branchIndex, steps };
  });
  if (!branches.length) throw new Error("INVALID_TRACE");
  return {
    branches,
    identifier: trace.identifier,
    observationIdentifier: trace.observationIdentifier,
    target: trace.target,
    workspaceIdentifier: trace.workspaceIdentifier,
  };
}

function validateTraces(value, diagnostics) {
  const observations = new Map(value.observations.map((observation) => [observation.identifier, observation]));
  value.traces.forEach((trace, index) => {
    const path = at("/traces", index);
    const observation = observations.get(trace.observationIdentifier);
    if (!observation) {
      add(diagnostics, PHASE.trace, "DANGLING_REFERENCE", at(path, "observationIdentifier"));
      return;
    }
    try {
      const expected = constructTrace(trace, observation);
      if (!canonicalEqual(trace, expected)) add(diagnostics, PHASE.trace, "INVALID_TRACE", path);
    } catch {
      add(diagnostics, PHASE.trace, "INVALID_TRACE", path);
    }
  });
}

function constructReplay(replay, trace) {
  const steps = [];
  const seenNodes = new Set();
  const seenRelationships = new Set();
  for (const role of TRACE_ROLES) {
    const roleSteps = trace.branches.flatMap((branch) => branch.steps.filter((step) => step.role === role));
    roleSteps.forEach((step) => {
      const key = refKey(step.node);
      if (seenNodes.has(key)) return;
      seenNodes.add(key);
      steps.push({ direction: null, elementType: "node", index: steps.length, node: step.node, relationship: null, role });
    });
    roleSteps.forEach((step) => {
      if (step.relationship === null) return;
      const key = refKey(step.relationship);
      if (seenRelationships.has(key)) return;
      seenRelationships.add(key);
      steps.push({ direction: step.direction, elementType: "relationship", index: steps.length, node: null, relationship: step.relationship, role });
    });
  }
  if (!steps.length || steps.at(-1).elementType !== "node" || !sameReference(steps.at(-1).node, trace.target)) throw new Error("INVALID_REPLAY");
  return {
    identifier: replay.identifier,
    observationIdentifier: replay.observationIdentifier,
    steps,
    traceIdentifier: replay.traceIdentifier,
    workspaceIdentifier: replay.workspaceIdentifier,
  };
}

function validateReplays(value, diagnostics) {
  const traces = new Map(value.traces.map((trace) => [trace.identifier, trace]));
  value.replays.forEach((replay, index) => {
    const path = at("/replays", index);
    const trace = traces.get(replay.traceIdentifier);
    if (!trace || trace.observationIdentifier !== replay.observationIdentifier) {
      add(diagnostics, PHASE.replay, "DANGLING_REFERENCE", at(path, "traceIdentifier"));
      return;
    }
    try {
      const expected = constructReplay(replay, trace);
      if (!canonicalEqual(replay, expected)) add(diagnostics, PHASE.replay, "INVALID_REPLAY", path);
    } catch {
      add(diagnostics, PHASE.replay, "INVALID_REPLAY", path);
    }
  });
}

export function recordRevisionDigest(record) {
  return mipDigest("record", canonicalize(record));
}

export function relationshipRevisionDigest(relationship) {
  return mipDigest("relationship", canonicalize(relationship));
}

function differenceFor(kind, subject, beforeRevisionDigest, afterRevisionDigest) {
  return { afterRevisionDigest, beforeRevisionDigest, index: 0, kind, subject };
}

function recordKinds(role) {
  if (role === "evidence") return ["addedEvidence", "removedEvidence"];
  if (role === "semanticTransformation") return ["addedSemanticTransformation", "removedSemanticTransformation"];
  if (role === "retrieval") return ["addedRetrieval", "removedRetrieval"];
  if (role === "reflection") return ["addedReflection", "removedReflection"];
  return null;
}

function constructEvolution(evolution, fromObservation, toObservation) {
  if (fromObservation.sequence >= toObservation.sequence) throw new Error("INVALID_EVOLUTION");
  const before = observationIndexes(fromObservation);
  const after = observationIndexes(toObservation);
  const differences = [];
  const recordKeys = new Set([...before.records.keys(), ...after.records.keys()]);
  for (const key of recordKeys) {
    const oldRecord = before.records.get(key);
    const newRecord = after.records.get(key);
    if (oldRecord && newRecord && canonicalEqual(oldRecord, newRecord)) continue;
    if (oldRecord) {
      const kinds = recordKinds(oldRecord.role);
      if (kinds) differences.push(differenceFor(kinds[1], oldRecord.reference, recordRevisionDigest(oldRecord), null));
    }
    if (newRecord) {
      const kinds = recordKinds(newRecord.role);
      if (kinds) differences.push(differenceFor(kinds[0], newRecord.reference, null, recordRevisionDigest(newRecord)));
    }
  }
  const relationshipKeys = new Set([...before.relationships.keys(), ...after.relationships.keys()]);
  for (const key of relationshipKeys) {
    const oldRelationship = before.relationships.get(key);
    const newRelationship = after.relationships.get(key);
    if (!oldRelationship) differences.push(differenceFor("addedRelationship", newRelationship.reference, null, relationshipRevisionDigest(newRelationship)));
    else if (!newRelationship) differences.push(differenceFor("removedRelationship", oldRelationship.reference, relationshipRevisionDigest(oldRelationship), null));
    else if (!canonicalEqual(oldRelationship, newRelationship)) differences.push(differenceFor("modifiedRelationship", newRelationship.reference, relationshipRevisionDigest(oldRelationship), relationshipRevisionDigest(newRelationship)));
  }
  differences.sort((left, right) => DIFFERENCE_RANK.get(left.kind) - DIFFERENCE_RANK.get(right.kind) || compareReference(left.subject, right.subject));
  differences.forEach((difference, index) => { difference.index = index; });
  return {
    differences,
    fromObservationIdentifier: evolution.fromObservationIdentifier,
    identifier: evolution.identifier,
    toObservationIdentifier: evolution.toObservationIdentifier,
    workspaceIdentifier: evolution.workspaceIdentifier,
  };
}

function validateEvolutions(value, diagnostics) {
  const observations = new Map(value.observations.map((observation) => [observation.identifier, observation]));
  value.evolutions.forEach((evolution, index) => {
    const path = at("/evolutions", index);
    const from = observations.get(evolution.fromObservationIdentifier);
    const to = observations.get(evolution.toObservationIdentifier);
    if (!from || !to) {
      add(diagnostics, PHASE.evolution, "DANGLING_REFERENCE", path);
      return;
    }
    try {
      const expected = constructEvolution(evolution, from, to);
      if (!canonicalEqual(evolution, expected)) add(diagnostics, PHASE.evolution, "INVALID_EVOLUTION", path);
    } catch {
      add(diagnostics, PHASE.evolution, "INVALID_EVOLUTION", path);
    }
  });
}

function replaySide(step, observation) {
  const indexes = observationIndexes(observation);
  const reference = step.elementType === "node" ? step.node : step.relationship;
  const semantic = step.elementType === "node"
    ? indexes.records.get(refKey(reference))
    : indexes.relationships.get(refKey(reference));
  if (!semantic) throw new Error("INVALID_COMPARATIVE_RECONSTRUCTION");
  return {
    direction: step.direction,
    elementType: step.elementType,
    reference,
    revisionDigest: step.elementType === "node" ? recordRevisionDigest(semantic) : relationshipRevisionDigest(semantic),
    role: step.role,
  };
}

function sideIdentity(side) {
  return `${side.elementType}\u0000${refKey(side.reference)}`;
}

function alignSides(from, to) {
  const rows = from.length + 1;
  const columns = to.length + 1;
  if (!Number.isSafeInteger(rows * columns)) throw new RangeError("alignment resource limit");
  const table = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let left = from.length - 1; left >= 0; left -= 1) {
    for (let right = to.length - 1; right >= 0; right -= 1) {
      table[left][right] = sideIdentity(from[left]) === sideIdentity(to[right])
        ? table[left + 1][right + 1] + 1
        : Math.max(table[left + 1][right], table[left][right + 1]);
    }
  }
  const aligned = [];
  let left = 0;
  let right = 0;
  while (left < from.length || right < to.length) {
    if (left >= from.length) aligned.push({ from: null, to: to[right++] });
    else if (right >= to.length) aligned.push({ from: from[left++], to: null });
    else if (sideIdentity(from[left]) === sideIdentity(to[right])) aligned.push({ from: from[left++], to: to[right++] });
    else if (table[left + 1][right] >= table[left][right + 1]) aligned.push({ from: from[left++], to: null });
    else aligned.push({ from: null, to: to[right++] });
  }
  return aligned;
}

function constructComparative(comparative, fromObservation, toObservation, fromTrace, toTrace) {
  const fromSteps = constructReplay({
    identifier: "internal", observationIdentifier: fromTrace.observationIdentifier,
    traceIdentifier: fromTrace.identifier, workspaceIdentifier: fromTrace.workspaceIdentifier,
  }, fromTrace).steps.map((step) => replaySide(step, fromObservation));
  const toSteps = constructReplay({
    identifier: "internal", observationIdentifier: toTrace.observationIdentifier,
    traceIdentifier: toTrace.identifier, workspaceIdentifier: toTrace.workspaceIdentifier,
  }, toTrace).steps.map((step) => replaySide(step, toObservation));
  const moments = alignSides(fromSteps, toSteps).map((pair, index) => {
    if (!pair.from) return { from: null, index, reasonCodes: ["B_ONLY"], state: "bOnly", to: pair.to };
    if (!pair.to) return { from: pair.from, index, reasonCodes: ["A_ONLY"], state: "aOnly", to: null };
    const reasonCodes = [];
    if (pair.from.revisionDigest !== pair.to.revisionDigest) {
      reasonCodes.push(pair.from.elementType === "node" ? "SEMANTIC_REVISION_CHANGED" : "RELATIONSHIP_REVISION_CHANGED");
    }
    if (pair.from.role !== pair.to.role || pair.from.direction !== pair.to.direction) reasonCodes.push("TRACE_BINDING_CHANGED");
    return {
      from: pair.from,
      index,
      reasonCodes: reasonCodes.sort((left, right) => REASON_RANK.get(left) - REASON_RANK.get(right)),
      state: reasonCodes.length ? "modified" : "shared",
      to: pair.to,
    };
  });
  return {
    divergenceIndices: moments.filter((moment) => moment.state !== "shared").map((moment) => moment.index),
    evolutionIdentifier: comparative.evolutionIdentifier,
    fromObservationIdentifier: comparative.fromObservationIdentifier,
    fromTraceIdentifier: comparative.fromTraceIdentifier,
    identifier: comparative.identifier,
    moments,
    toObservationIdentifier: comparative.toObservationIdentifier,
    toTraceIdentifier: comparative.toTraceIdentifier,
    workspaceIdentifier: comparative.workspaceIdentifier,
  };
}

function validateComparatives(value, diagnostics) {
  const observations = new Map(value.observations.map((observation) => [observation.identifier, observation]));
  const traces = new Map(value.traces.map((trace) => [trace.identifier, trace]));
  const evolutions = new Map(value.evolutions.map((evolution) => [evolution.identifier, evolution]));
  value.comparativeReconstructions.forEach((comparative, index) => {
    const path = at("/comparativeReconstructions", index);
    const fromObservation = observations.get(comparative.fromObservationIdentifier);
    const toObservation = observations.get(comparative.toObservationIdentifier);
    const fromTrace = traces.get(comparative.fromTraceIdentifier);
    const toTrace = traces.get(comparative.toTraceIdentifier);
    const evolution = evolutions.get(comparative.evolutionIdentifier);
    if (!fromObservation || !toObservation || !fromTrace || !toTrace || !evolution
      || fromTrace.observationIdentifier !== comparative.fromObservationIdentifier
      || toTrace.observationIdentifier !== comparative.toObservationIdentifier
      || evolution.fromObservationIdentifier !== comparative.fromObservationIdentifier
      || evolution.toObservationIdentifier !== comparative.toObservationIdentifier) {
      add(diagnostics, PHASE.comparative, "DANGLING_REFERENCE", path);
      return;
    }
    try {
      const expected = constructComparative(comparative, fromObservation, toObservation, fromTrace, toTrace);
      if (!canonicalEqual(comparative, expected)) add(diagnostics, PHASE.comparative, "INVALID_COMPARATIVE_RECONSTRUCTION", path);
    } catch (error) {
      add(diagnostics, error instanceof RangeError ? PHASE.resource : PHASE.comparative,
        error instanceof RangeError ? "RESOURCE_LIMIT_EXCEEDED" : "INVALID_COMPARATIVE_RECONSTRUCTION", path);
    }
  });
}

const PROHIBITED_VALUE = /^(?:data:[a-z]+\/[a-z0-9.+-]+(?:;[^,]*)?,|javascript:|file:(?:\/\/|[\\/])|(?:wss?|grpc|mqtt|amqps?|postgres(?:ql)?|mysql|sqlite|mongodb(?:\+srv)?|redis|jdbc):\/\/|[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@|(?:Bearer\s+[A-Za-z0-9._~+\/-]{16,}|Basic\s+[A-Za-z0-9+/]{12,}={0,2})$|#!|-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|iVBORw0KGgo|\/9j\/|R0lGOD|JVBERi0|UEsDB|UklGR|f0VMRg|TVqQ|AGFzbQ|H4sI|UmFyI|N3q8rycc|AAABAA|SUQz|T2dnUw|ZkxhQw|Qk|SUkq|TU0A|d09GR[gm]|AAAA[A-Za-z0-9+/]{0,24}ZnR5c|(?:function\s+[A-Za-z_$]*\s*\(|(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|import(?:\s*\(|\s+(?:[^;\n]+\s+from\s+)?["'])|#include\s*[<"]|(?:eval|alert|fetch|require|print)\s*\(|console\.[A-Za-z_$][\w$]*\s*\(|\(?\s*\(?\s*[^)]*\)?\s*=>|(?:def|class)\s+[A-Za-z_][\w]*\s*[:(]|(?:rm|curl|wget|bash|sh|powershell|cmd(?:\.exe)?)\s+)|<\s*(?:!doctype\s+html|html|script|style|canvas|svg|img|video|audio|iframe)\b|(?:https?:\/\/(?:api\.|[^\s/]+\/(?:api|v[0-9]+|graphql)(?:\/|$)))|(?:https?:\/\/[^\s?#]+\.(?:png|jpe?g|gif|webp|svg|mp[34]|webm|wav|ogg|ico|woff2?|ttf|otf))(?:[?#]|$)|(?:[a-zA-Z]:[\\/]|\\\\|\/(?:home|Users|private|tmp|var)\/))/i;
const PROHIBITED_AMBIGUOUS_KEYS = new Set([
  "code", "sourcecode", "color", "filter", "thread", "threads", "runtime", "provider",
  "history", "log", "logs", "diagnostic", "diagnostics", "generatedsummary", "generateddescription",
  "generatedexplanation", "generatedrationale", "recommendation", "recommendations", "inferredcausality",
  "syntheticevent", "syntheticevents",
]);
const PROHIBITED_OPERATIONAL_TEXT = /\b(?:event\s*bus|service\s*registry|dependency\s*injector|live\s*object|runtime\s+(?:state|log|diagnostic|handle|pointer|thread)|provider\s+(?:configuration|config|endpoint|implementation)|sqlite\s+(?:connection|configuration)|browser\s+(?:navigation|storage|history)|transport\s+configuration|storage\s+configuration|unrelated\s+(?:runtime\s+)?diagnostics?)\b/i;
const PROHIBITED_KEY_NAMES = new Set([
  "screenshot", "screenshots", "thumbnail", "thumbnails", "image", "images", "video", "videos", "audio", "mediapayload",
  "html", "css", "domstate", "canvasbuffer", "webglbuffer", "font", "fonts", "icon", "icons", "theme", "themes",
  "graphcoordinate", "graphcoordinates", "layout", "layoutanchor", "layoutanchors", "view", "control", "camera", "camerastate", "zoom", "zoomstate",
  "pan", "panstate", "animation", "animationstate", "panel", "panelstate", "filterstate", "selectednode", "selectednodes",
  "follow", "followstate", "navigation", "navigationstate", "inspector", "inspectorstate", "route", "routestate", "rendererstate", "replaycursor", "comparativecursor", "playstate",
  "observingquery", "observingqueries", "transientoperationresult", "transientoperationresults", "activeroute",
  "activeroutes", "highlightdelta", "highlightdeltas",
  "pausestate", "timer", "timerstate", "scheduler", "schedulerstate", "autoplay", "autoplaystate", "rendererprojection",
  "rendererprojections", "unionworld", "highlightlist", "highlightlists", "displaysummary", "displaysummaries", "pixelcomparison", "pixelcomparisons",
  "aisummary", "aigeneratedsummary", "aigeneratedexplanation", "aigeneratedrationale", "llmsummary", "llmgeneratedsummary",
  "llmgeneratedexplanation", "llmgeneratedrationale", "fabricatedcognition", "temporarycache", "cache", "cacheindex",
  "cacheindexes", "indexes", "telemetry", "browserstorage", "unrelateddiagnostic", "unrelateddiagnostics",
  "runtimestate", "runtimeimplementationstate", "runtimepointer", "runtimehandle", "pointer", "pointers", "handle", "handles",
  "runtimethread", "runtimethreads", "eventbus", "eventbuses", "eventbushandle", "serviceregistry", "serviceregistries",
  "dependencyinjector", "dependencyinjectors", "liveobjectreference", "liveobjectreferences", "providerdetails",
  "providerimplementationdetails", "providerconfiguration", "providerconfig", "credential", "credentials", "password",
  "passwords", "apikey", "accesstoken", "authtoken", "secret", "secrets", "endpoint", "endpoints", "localpath", "localpaths",
  "transportconfiguration", "transportconfig", "storageconfiguration", "storageconfig", "executable", "executablescript",
  "script", "scripts", "executablescripts", "plugin", "plugins", "macro", "macros", "binary", "binaries", "nativecode", "opaqueblob", "opaqueblobs",
]);

function keyTokens(value) {
  return value.normalize("NFKD")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function prohibitedKey(value) {
  return PROHIBITED_KEY_NAMES.has(keyTokens(value).join(""));
}

function sourceRevisionPath(path) {
  return /^\/observations\/\d+\/(?:records|relationships)\/\d+\/revision(?:\/|$)/.test(path);
}

function scanProhibited(value, path, diagnostics) {
  if (typeof value === "string") {
    if (PROHIBITED_VALUE.test(value.trim())) add(diagnostics, PHASE.extensions, "PROHIBITED_CONTENT", path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((member, index) => scanProhibited(member, at(path, index), diagnostics));
    return;
  }
  if (!isObject(value)) return;
  for (const [member, child] of Object.entries(value)) {
    const normalized = keyTokens(member).join("");
    const fixedVerificationCode = member === "code" && /^\/verification\/checks\/\d+$/.test(path);
    const sourceAuthoredText = sourceRevisionPath(path)
      && PROHIBITED_AMBIGUOUS_KEYS.has(normalized) && typeof child === "string"
      && !PROHIBITED_OPERATIONAL_TEXT.test(child);
    if (path !== "/extensions" && !fixedVerificationCode && (prohibitedKey(member)
      || (PROHIBITED_AMBIGUOUS_KEYS.has(normalized) && !sourceAuthoredText))) {
      add(diagnostics, PHASE.extensions, "PROHIBITED_CONTENT", at(path, member));
    }
    scanProhibited(child, at(path, member), diagnostics);
  }
}

function scanExtensionDuplications(value, path, diagnostics, semanticPayloads) {
  if (isObject(value) && semanticPayloads.has(canonicalize(value))) {
    add(diagnostics, PHASE.extensions, "PROHIBITED_CONTENT", path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((member, index) => scanExtensionDuplications(member, at(path, index), diagnostics, semanticPayloads));
    return;
  }
  if (!isObject(value)) return;
  const payloadRoot = /^\/extensions\/[^/]+\/payload$/.test(path);
  for (const [member, child] of Object.entries(value)) {
    if (payloadRoot && TOP_LEVEL.includes(member)) add(diagnostics, PHASE.extensions, "PROHIBITED_CONTENT", at(path, member));
    scanExtensionDuplications(child, at(path, member), diagnostics, semanticPayloads);
  }
}

function validateExtensionPolicy(value, diagnostics, supportedExtensions) {
  const required = new Set(value.manifest.features.required);
  const optional = new Set(value.manifest.features.optional);
  const semanticPayloads = new Set(value.observations.flatMap((observation) => [
    ...observation.records.map((record) => canonicalize(record.revision)),
    ...observation.relationships.map((relationship) => canonicalize(relationship.revision)),
  ]));
  for (const [name, extension] of Object.entries(value.extensions)) {
    if (extension.critical) {
      if (!required.has(name) || optional.has(name)) add(diagnostics, PHASE.extensions, "SCHEMA_VIOLATION", `/manifest/features/required`);
      if (!supportedExtensions.has(name)) add(diagnostics, PHASE.extensions, "UNSUPPORTED_CRITICAL_EXTENSION", at("/extensions", name));
    } else if (!optional.has(name) || required.has(name)) add(diagnostics, PHASE.extensions, "SCHEMA_VIOLATION", `/manifest/features/optional`);
    scanExtensionDuplications(extension.payload, at(at("/extensions", name), "payload"), diagnostics, semanticPayloads);
  }
  for (const name of required) if (!Object.hasOwn(value.extensions, name)) add(diagnostics, PHASE.extensions, "SCHEMA_VIOLATION", "/manifest/features/required");
  for (const name of optional) if (!Object.hasOwn(value.extensions, name)) add(diagnostics, PHASE.extensions, "SCHEMA_VIOLATION", "/manifest/features/optional");
  scanProhibited(value, "", diagnostics);
}

function validateVerificationEvidence(value, diagnostics) {
  if (value.verification.profile !== "MIP-CORE-1.0" || value.verification.status !== "passed") add(diagnostics, PHASE.verification, "SCHEMA_VIOLATION", "/verification");
  VERIFICATION_CHECKS.forEach((code, index) => {
    const check = value.verification.checks[index];
    if (!check || check.code !== code || check.status !== "passed") add(diagnostics, PHASE.verification, "SCHEMA_VIOLATION", at("/verification/checks", index));
  });
}

export function computeMipIntegrity(value) {
  const sectionDigests = SECTION_ORDER.map((name) => ({
    digest: mipDigest("section", name, canonicalize(value[name])),
    name,
  }));
  const cognitionDigest = mipDigest(
    "cognition",
    canonicalize(sectionDigests.filter(({ name }) => COGNITION_SECTIONS.has(name))),
  );
  const packageDigest = mipDigest("package", canonicalize({
    $schema: value.$schema,
    formatVersion: value.formatVersion,
    kind: value.kind,
    sectionDigests,
  }));
  return deepFreeze({ cognitionDigest, packageDigest, profile: "MIP-SHA-256-1.0", sectionDigests });
}

function validateHashes(value, diagnostics) {
  const expected = computeMipIntegrity(value);
  expected.sectionDigests.forEach((record, index) => {
    const actual = value.integrity.sectionDigests[index];
    if (!actual || actual.name !== record.name || actual.digest !== record.digest) add(diagnostics, PHASE.integrity, "CHECKSUM_MISMATCH", at("/integrity/sectionDigests", index));
  });
  if (value.integrity.cognitionDigest !== expected.cognitionDigest) add(diagnostics, PHASE.integrity, "CHECKSUM_MISMATCH", "/integrity/cognitionDigest");
  if (value.integrity.packageDigest !== expected.packageDigest) add(diagnostics, PHASE.integrity, "CHECKSUM_MISMATCH", "/integrity/packageDigest");
}

function resourceUsage(value, limits) {
  let values = 0;
  let maximumDepth = 0;
  const stack = [{ depth: 1, member: value }];
  while (stack.length) {
    const { member, depth } = stack.pop();
    values += 1;
    maximumDepth = Math.max(maximumDepth, depth);
    if (maximumDepth > limits.maxDepth || values > limits.maxValues) return false;
    if (Array.isArray(member)) {
      for (let index = member.length - 1; index >= 0; index -= 1) stack.push({ depth: depth + 1, member: member[index] });
    } else if (isObject(member)) {
      const members = Object.keys(member);
      for (let index = members.length - 1; index >= 0; index -= 1) stack.push({ depth: depth + 1, member: member[members[index]] });
    }
  }
  if (!isObject(value) || !Array.isArray(value.traces) || !Array.isArray(value.comparativeReconstructions)) return true;
  const traceBounds = new Map();
  value.traces.forEach((trace) => {
    if (!isObject(trace) || typeof trace.identifier !== "string" || !Array.isArray(trace.branches)) return;
    let stepCount = 0;
    trace.branches.forEach((branch) => {
      if (isObject(branch) && Array.isArray(branch.steps)) stepCount += branch.steps.length;
    });
    traceBounds.set(trace.identifier, (stepCount * 2) + 1);
  });
  return value.comparativeReconstructions.every((comparative) => {
    if (!isObject(comparative)) return true;
    const from = traceBounds.get(comparative.fromTraceIdentifier);
    const to = traceBounds.get(comparative.toTraceIdentifier);
    return from === undefined || to === undefined
      || (Number.isSafeInteger(from * to) && from * to <= limits.maxAlignmentCells);
  });
}

function verificationResult(valid, diagnostics, packageValue = null, bytes = null) {
  return deepFreeze({
    bytes,
    diagnostics: sortDiagnostics(diagnostics).map(publicDiagnostic),
    package: valid ? packageValue : null,
    valid,
  });
}

function inputBytes(input, maxBytes) {
  if (typeof input === "string") {
    if (input.length > maxBytes) throw Object.assign(new RangeError("input resource limit"), { code: "RESOURCE_LIMIT_EXCEEDED" });
    const bytes = utf8Encode(input);
    if (bytes.byteLength > maxBytes) throw Object.assign(new RangeError("input resource limit"), { code: "RESOURCE_LIMIT_EXCEEDED" });
    return bytes;
  }
  if (input instanceof Uint8Array) {
    if (input.byteLength > maxBytes) throw Object.assign(new RangeError("input resource limit"), { code: "RESOURCE_LIMIT_EXCEEDED" });
    return new Uint8Array(input);
  }
  if (input instanceof ArrayBuffer) {
    if (input.byteLength > maxBytes) throw Object.assign(new RangeError("input resource limit"), { code: "RESOURCE_LIMIT_EXCEEDED" });
    return new Uint8Array(input.slice(0));
  }
  if (Array.isArray(input) && input.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    if (input.length > maxBytes) throw Object.assign(new RangeError("input resource limit"), { code: "RESOURCE_LIMIT_EXCEEDED" });
    return Uint8Array.from(input);
  }
  throw new TypeError("MIP input must be a UTF-8 string, Uint8Array, or ArrayBuffer.");
}

export function verifyMemoryInvestigationPackage(input, options = {}) {
  const limits = {
    maxBytes: options.maxBytes ?? 16 * 1024 * 1024,
    maxDepth: options.maxDepth ?? 128,
    maxValues: options.maxValues ?? 1_000_000,
    maxAlignmentCells: options.maxAlignmentCells ?? 4_000_000,
  };
  const supportedExtensions = new Set(options.supportedExtensions ?? []);
  const diagnostics = [];
  if (!Number.isSafeInteger(limits.maxBytes) || !Number.isSafeInteger(limits.maxDepth)
    || !Number.isSafeInteger(limits.maxValues) || !Number.isSafeInteger(limits.maxAlignmentCells)
    || limits.maxBytes < 1 || limits.maxDepth < 1 || limits.maxValues < 1 || limits.maxAlignmentCells < 1) {
    add(diagnostics, PHASE.resource, "RESOURCE_LIMIT_EXCEEDED", "");
    return verificationResult(false, diagnostics);
  }
  let bytes;
  try {
    bytes = inputBytes(input, limits.maxBytes);
  } catch (error) {
    add(diagnostics, error?.code === "RESOURCE_LIMIT_EXCEEDED" ? PHASE.resource : PHASE.lexical,
      error?.code === "RESOURCE_LIMIT_EXCEEDED" ? "RESOURCE_LIMIT_EXCEEDED" : "INVALID_ENCODING", "");
    return verificationResult(false, diagnostics);
  }
  let text;
  let value;
  try {
    text = decodeUtf8(bytes);
    if (text.charCodeAt(0) === 0xfeff) throw Object.assign(new Error("BOM"), { code: "INVALID_ENCODING", path: "" });
    value = parseStrictJson(text, {
      maxDepth: Math.min(limits.maxDepth, MAX_SAFE_PARSER_DEPTH),
      maxValues: limits.maxValues,
    });
  } catch (error) {
    if (error?.code === "RESOURCE_LIMIT_EXCEEDED" || error instanceof RangeError) {
      add(diagnostics, PHASE.resource, "RESOURCE_LIMIT_EXCEEDED", parserPathToPointer(error?.path));
      return verificationResult(false, diagnostics);
    }
    const code = error?.code === "DUPLICATE_MEMBER" ? "DUPLICATE_MEMBER"
      : String(error?.code ?? "").startsWith("INVALID_UTF8") || error?.code === "INVALID_UNICODE" || error?.code === "INVALID_ENCODING"
        ? "INVALID_ENCODING" : "INVALID_JSON";
    add(diagnostics, code === "DUPLICATE_MEMBER" ? PHASE.canonical : PHASE.lexical, code, parserPathToPointer(error?.path));
    return verificationResult(false, diagnostics);
  }
  if (!resourceUsage(value, limits)) {
    add(diagnostics, PHASE.resource, "RESOURCE_LIMIT_EXCEEDED", "");
    return verificationResult(false, diagnostics);
  }
  try {
    if (canonicalize(value) !== text) add(diagnostics, PHASE.canonical, "NON_CANONICAL", "");
  } catch {
    add(diagnostics, PHASE.canonical, "NON_CANONICAL", "");
  }
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateStructure(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateHashes(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateModel(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateProvenance(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateTraces(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateReplays(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateEvolutions(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateComparatives(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateExtensionPolicy(value, diagnostics, supportedExtensions);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  validateVerificationEvidence(value, diagnostics);
  if (diagnostics.length) return verificationResult(false, diagnostics);
  const immutableBytes = Object.freeze(Array.from(bytes));
  const immutablePackage = deepFreeze(value);
  VERIFIED_PACKAGES.add(immutablePackage);
  VERIFIED_EXTENSION_SUPPORT.set(immutablePackage, Object.freeze([...supportedExtensions].sort(compareScalarText)));
  return verificationResult(true, diagnostics, immutablePackage, immutableBytes);
}

export function importMemoryInvestigationPackage(input, options = {}) {
  const result = verifyMemoryInvestigationPackage(input, options);
  if (!result.valid) throw new MemoryInvestigationPackageError(result.diagnostics);
  return result.package;
}

export function importMemoryInvestigationPackageFile(file, options = {}) {
  if (!file || typeof file.name !== "string" || !file.name.endsWith(".mip")
    || file.mediaType !== MIP_MEDIA_TYPE || !Object.hasOwn(file, "bytes")) {
    throw new MemoryInvestigationPackageError([{ code: "SCHEMA_VIOLATION", path: "" }], "The file envelope is not a .mip resource.");
  }
  return importMemoryInvestigationPackage(file.bytes, options);
}

function validateAuthoritativeSourceOrder(source) {
  if (!Array.isArray(source.observations)) return;
  let previousSequence = null;
  source.observations.forEach((observation, observationIndex) => {
    if (Number.isSafeInteger(observation?.sequence)) {
      if (previousSequence !== null && observation.sequence <= previousSequence) {
        throw new MemoryInvestigationPackageError(
          [{ code: "ORDER_VIOLATION", path: `/observations/${observationIndex}/sequence` }],
          "Observation source chronology is not strictly increasing.",
        );
      }
      previousSequence = observation.sequence;
    }
    for (const collection of ["records", "relationships"]) {
      if (!Array.isArray(observation?.[collection])) continue;
      const expectedOccurrences = new Map();
      const seenReferences = new Set();
      observation[collection].forEach((entry, entryIndex) => {
        const reference = entry?.reference;
        if (typeof reference?.kind !== "string" || typeof reference?.identifier !== "string"
          || !Number.isSafeInteger(reference?.occurrence)) return;
        const referenceKey = canonicalize([reference.kind, reference.identifier, reference.occurrence]);
        if (seenReferences.has(referenceKey)) {
          throw new MemoryInvestigationPackageError(
            [{
              code: "DUPLICATE_IDENTIFIER",
              path: `/observations/${observationIndex}/${collection}/${entryIndex}/reference`,
            }],
            "A typed reference is duplicated in authoritative source input.",
          );
        }
        seenReferences.add(referenceKey);
        const group = canonicalize([reference.kind, reference.identifier]);
        const expected = expectedOccurrences.get(group) ?? 0;
        if (reference.occurrence !== expected) {
          throw new MemoryInvestigationPackageError(
            [{
              code: "ORDER_VIOLATION",
              path: `/observations/${observationIndex}/${collection}/${entryIndex}/reference/occurrence`,
            }],
            "Typed-reference occurrences do not preserve authoritative source order.",
          );
        }
        expectedOccurrences.set(group, expected + 1);
      });
    }
  });
}

function normalizedSections(input) {
  const trustedRoundTrip = isObject(input) && VERIFIED_PACKAGES.has(input);
  const source = trustedRoundTrip ? {
    packageIdentifier: input.manifest?.packageIdentifier,
    workspaceIdentifier: input.manifest?.workspaceIdentifier,
    formatVersion: input.formatVersion,
    metadata: input.metadata,
    observations: input.observations,
    traces: input.traces,
    replays: input.replays,
    evolutions: input.evolutions,
    comparativeReconstructions: input.comparativeReconstructions,
    extensions: input.extensions,
  } : input;
  if (!isObject(source)) throw new TypeError("MIP export input must be an object.");
  if (!trustedRoundTrip) validateAuthoritativeSourceOrder(source);
  const sections = {
    observations: cloneCanonical(source.observations ?? []),
    traces: cloneCanonical(source.traces ?? []),
    replays: cloneCanonical(source.replays ?? []),
    evolutions: cloneCanonical(source.evolutions ?? []),
    comparativeReconstructions: cloneCanonical(source.comparativeReconstructions ?? []),
    extensions: cloneCanonical(source.extensions ?? {}),
  };
  sections.observations.sort((left, right) => left.sequence - right.sequence || compareScalarText(left.identifier, right.identifier));
  sections.observations.forEach((observation) => {
    observation.records.sort((left, right) => compareReference(left.reference, right.reference));
    observation.relationships.sort((left, right) => compareReference(left.reference, right.reference));
  });
  sections.traces.sort((left, right) => compareScalarText(left.identifier, right.identifier));
  sections.replays.sort((left, right) => compareScalarText(left.identifier, right.identifier));
  const orderContext = { observations: sections.observations };
  sections.evolutions.sort(artifactOrder(orderContext, "evolutions"));
  sections.comparativeReconstructions.sort(artifactOrder(orderContext, "comparativeReconstructions"));
  return { source, sections, trustedRoundTrip };
}

function createVerification() {
  return {
    checks: VERIFICATION_CHECKS.map((code) => ({ code, status: "passed" })),
    profile: "MIP-CORE-1.0",
    status: "passed",
  };
}

function createMemoryInvestigationPackageInternal(input, options) {
  const { source, sections, trustedRoundTrip } = normalizedSections(input);
  if (!trustedRoundTrip && (source.sourceAccepted !== true || source.sourceAuthorshipAttested !== true)) {
    throw new MemoryInvestigationPackageError(
      [{ code: "PROHIBITED_CONTENT", path: "" }],
      "A new MIP export requires an accepted detached source and source-authorship attestation.",
    );
  }
  if (!trustedRoundTrip && source.formatVersion !== undefined && source.formatVersion !== MIP_FORMAT_VERSION) {
    throw new MemoryInvestigationPackageError(
      [{ code: "UNSUPPORTED_VERSION", path: "/formatVersion" }],
      `This Producer emits wire format ${MIP_FORMAT_VERSION}.`,
    );
  }
  const extensionEntries = Object.entries(sections.extensions);
  const required = extensionEntries.filter(([, extension]) => extension.critical === true).map(([name]) => name).sort(compareScalarText);
  const optional = extensionEntries.filter(([, extension]) => extension.critical === false).map(([name]) => name).sort(compareScalarText);
  const value = {
    $schema: MIP_SCHEMA,
    comparativeReconstructions: sections.comparativeReconstructions,
    evolutions: sections.evolutions,
    extensions: sections.extensions,
    formatVersion: trustedRoundTrip ? source.formatVersion : MIP_FORMAT_VERSION,
    integrity: null,
    kind: MIP_KIND,
    manifest: {
      features: { optional, required },
      inventory: {
        comparativeReconstructions: sections.comparativeReconstructions.length,
        evolutions: sections.evolutions.length,
        observations: sections.observations.length,
        replays: sections.replays.length,
        traces: sections.traces.length,
      },
      packageIdentifier: source.packageIdentifier,
      profiles: { canonicalization: "RFC8785", digest: "SHA-256", validation: "MIP-CORE-1.0" },
      workspaceIdentifier: source.workspaceIdentifier,
    },
    metadata: cloneCanonical(source.metadata),
    observations: sections.observations,
    replays: sections.replays,
    traces: sections.traces,
    verification: createVerification(),
  };
  value.integrity = computeMipIntegrity(value);
  const bytes = utf8Encode(canonicalize(value));
  const supportedExtensions = new Set([
    ...(trustedRoundTrip ? VERIFIED_EXTENSION_SUPPORT.get(input) ?? [] : []),
    ...(options.supportedExtensions ?? []),
  ]);
  const result = verifyMemoryInvestigationPackage(bytes, { supportedExtensions });
  if (!result.valid) throw new MemoryInvestigationPackageError(result.diagnostics, "MIP export input does not conform to MIP-001.");
  return result.package;
}

function stableExportError(error) {
  if (error instanceof MemoryInvestigationPackageError) return error;
  const resource = error?.code === "RESOURCE_LIMIT_EXCEEDED";
  return new MemoryInvestigationPackageError(
    [{ code: resource ? "RESOURCE_LIMIT_EXCEEDED" : "SCHEMA_VIOLATION", path: parserPathToPointer(error?.path) }],
    resource ? "MIP export input exceeds the configured resource policy." : "MIP export input is not a valid canonical data model.",
  );
}

export function createMemoryInvestigationPackage(input, options = {}) {
  try {
    if (!isObject(options) || !Array.isArray(options.supportedExtensions ?? [])) throw new TypeError("Invalid export options.");
    return createMemoryInvestigationPackageInternal(input, options);
  } catch (error) {
    throw stableExportError(error);
  }
}

export function exportMemoryInvestigationPackage(input, options = {}) {
  const packageValue = createMemoryInvestigationPackage(input, options);
  return utf8Encode(canonicalize(packageValue));
}

function safeArtifactName(name) {
  if (typeof name !== "string" || name.length < 5 || name.length > 255 || !name.endsWith(".mip")
    || /[\u0000-\u001f\u007f<>:"|?*\\/]/.test(name) || /[. ]\.mip$/.test(name)) return false;
  const stem = name.slice(0, -4);
  return stem !== "." && stem !== ".." && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem);
}

export function createMemoryInvestigationPackageArtifact(input, fileName = null, options = {}) {
  const packageValue = createMemoryInvestigationPackage(input, options);
  const identifierName = `${packageValue.manifest.packageIdentifier}.mip`;
  const name = fileName ?? (safeArtifactName(identifierName)
    ? identifierName
    : `memory-investigation-${packageValue.integrity.packageDigest.slice(7, 23)}.mip`);
  if (!safeArtifactName(name)) {
    throw new MemoryInvestigationPackageError(
      [{ code: "SCHEMA_VIOLATION", path: "/name" }],
      "A MIP artifact name must be a safe .mip basename.",
    );
  }
  return deepFreeze({
    bytes: Object.freeze(Array.from(utf8Encode(canonicalize(packageValue)))),
    mediaType: MIP_MEDIA_TYPE,
    name,
    package: packageValue,
  });
}

export function serializeMemoryInvestigationPackage(packageValue, options = {}) {
  const bytes = utf8Encode(canonicalize(packageValue));
  const result = verifyMemoryInvestigationPackage(bytes, options);
  if (!result.valid) throw new MemoryInvestigationPackageError(result.diagnostics);
  return bytes;
}
