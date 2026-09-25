import { validateCognitiveRegression } from "./cognitive-regression.js";
import {
  canonicalize,
  cloneCanonical,
  deepFreeze,
  mipDigest,
} from "./mip-canonical.js";

export const COGNITIVE_INVESTIGATION_EXPLORER_VERSION = "1.0.0";

export const ExplorerCategory = Object.freeze({
  Replay: "replay",
  Reflection: "reflection",
  Evidence: "evidence",
  Retrieval: "retrieval",
  Evolution: "evolution",
  Verification: "verification",
  Transition: "transition",
  Lifecycle: "lifecycle",
});

const categories = new Set(Object.values(ExplorerCategory));
const categoryOrder = Object.freeze(Object.values(ExplorerCategory));
const changes = new Set(["added", "removed", "modified"]);
const statuses = new Set(["matched", "empty"]);
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const identifierPattern = /^explorer:[0-9a-f]{64}$/u;
const queryMembers = Object.freeze(["category", "reflectionIdentifier", "transition"]);
const resultMembers = Object.freeze([
  "identifier",
  "kind",
  "matchCount",
  "matches",
  "query",
  "regressionIdentifier",
  "status",
  "version",
  "workspaceIdentifier",
]);

function exactMembers(value, members) {
  return value && typeof value === "object" && !Array.isArray(value)
    && canonicalize(Object.keys(value).sort()) === canonicalize([...members].sort());
}

function nonEmptyText(value) {
  return typeof value === "string" && value.length > 0;
}

function inputError(code, message, cause = undefined) {
  const error = new TypeError(message, cause === undefined ? undefined : { cause });
  error.code = code;
  return error;
}

function deeplyFrozen(value) {
  if (!value || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(deeplyFrozen);
}

function normalizeTransition(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/[_\s]+/gu, "-")
    .toLowerCase();
}

function normalizeQuery(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw inputError("INVALID_QUERY", "Cognitive Investigation Explorer query must be an object.");
  }
  let input;
  try {
    input = cloneCanonical(value);
  } catch (error) {
    throw inputError("INVALID_QUERY", "Explorer query must be detached canonical data.", error);
  }
  const unknown = Object.keys(input).filter((member) => !queryMembers.includes(member));
  if (unknown.length > 0) {
    throw inputError("INVALID_QUERY", `Unknown Cognitive Investigation Explorer query member '${unknown.sort()[0]}'.`);
  }
  const category = input.category ?? null;
  const reflectionIdentifier = input.reflectionIdentifier ?? null;
  const transitionValue = input.transition ?? null;
  if (category !== null && !categories.has(category)) {
    throw inputError("INVALID_QUERY", "Explorer category must identify a deterministic regression category.");
  }
  if (reflectionIdentifier !== null && !nonEmptyText(reflectionIdentifier)) {
    throw inputError("INVALID_QUERY", "Reflection identifier must be null or a non-empty string.");
  }
  if (transitionValue !== null && !nonEmptyText(transitionValue)) {
    throw inputError("INVALID_QUERY", "Transition selector must be null or a non-empty string.");
  }
  const transition = transitionValue === null ? null : normalizeTransition(transitionValue);
  if (reflectionIdentifier !== null && transition !== null) {
    throw inputError("INVALID_QUERY", "Reflection and transition selectors are mutually exclusive.");
  }
  if (reflectionIdentifier !== null && category !== null
    && category !== ExplorerCategory.Reflection) {
    throw inputError("INVALID_QUERY", "Reflection navigation can only select the Reflection category.");
  }
  if (transition !== null && category !== null
    && ![ExplorerCategory.Transition, ExplorerCategory.Lifecycle].includes(category)) {
    throw inputError("INVALID_QUERY", "Transition navigation can only select Transition or Lifecycle evidence.");
  }
  return deepFreeze({ category, reflectionIdentifier, transition });
}

function reflectionIdentifier(subject) {
  if (nonEmptyText(subject.identifier)) return subject.identifier;
  if (nonEmptyText(subject.reference?.identifier)) return subject.reference.identifier;
  return null;
}

function transitionTokens(subject) {
  const values = subject.transition
    ? [
      subject.transition.beforeKind,
      subject.transition.afterKind,
      subject.transition.beforeAction,
      subject.transition.afterAction,
    ]
    : subject.lifecycle
      ? [subject.lifecycle.beforeState, subject.lifecycle.afterState]
      : [];
  return new Set(values.filter(nonEmptyText).map(normalizeTransition));
}

function selected(category, difference, query) {
  if (query.category !== null && category !== query.category) return false;
  if (query.reflectionIdentifier !== null) {
    return category === ExplorerCategory.Reflection
      && reflectionIdentifier(difference.subject) === query.reflectionIdentifier;
  }
  if (query.transition !== null) {
    return [ExplorerCategory.Transition, ExplorerCategory.Lifecycle].includes(category)
      && transitionTokens(difference.subject).has(normalizeTransition(query.transition));
  }
  return true;
}

function endpoint(descriptor, digest, pointer) {
  if (digest === null) return null;
  return {
    digest,
    pointer,
    sourceIdentifier: descriptor.sourceIdentifier,
    sourceKind: descriptor.sourceKind,
  };
}

function resultIdentifier(material) {
  return `explorer:${mipDigest(
    "INVESTIGATION-CORE-EXPLORER-1.0",
    canonicalize(material),
  ).slice(7)}`;
}

function normalizedReport(value) {
  try {
    const report = deepFreeze(cloneCanonical(value));
    validateCognitiveRegression(report);
    return report;
  } catch (error) {
    throw inputError(
      "INVALID_REGRESSION_REPORT",
      "A canonical valid Cognitive Regression Report is required.",
      error,
    );
  }
}

export function validateCognitiveInvestigationResult(result) {
  if (!exactMembers(result, resultMembers)
    || result.kind !== "MemoryOSCognitiveInvestigationResult"
    || result.version !== COGNITIVE_INVESTIGATION_EXPLORER_VERSION
    || !identifierPattern.test(result.identifier)
    || !nonEmptyText(result.regressionIdentifier)
    || !nonEmptyText(result.workspaceIdentifier)
    || !exactMembers(result.query, queryMembers)
    || result.query.category !== null && !categories.has(result.query.category)
    || result.query.reflectionIdentifier !== null
      && !nonEmptyText(result.query.reflectionIdentifier)
    || result.query.transition !== null && !nonEmptyText(result.query.transition)
    || !statuses.has(result.status)
    || !Number.isSafeInteger(result.matchCount) || result.matchCount < 0
    || !Array.isArray(result.matches)
    || result.matches.length !== result.matchCount
    || result.status !== (result.matchCount === 0 ? "empty" : "matched")
    || !deeplyFrozen(result)) {
    throw new TypeError("A closed immutable Cognitive Investigation Explorer result is required.");
  }
  let normalized;
  try {
    normalized = normalizeQuery(result.query);
  } catch (error) {
    throw new TypeError("Explorer result contains an invalid normalized query.", { cause: error });
  }
  if (canonicalize(normalized) !== canonicalize(result.query)) {
    throw new TypeError("Explorer result query is not canonically normalized.");
  }
  let previousCategoryIndex = -1;
  let previousSubject = null;
  result.matches.forEach((match, index) => {
    if (!exactMembers(match, [
      "baseline", "candidate", "category", "change", "index", "subject",
    ]) || match.index !== index
      || !categories.has(match.category)
      || !changes.has(match.change)
      || !match.subject || typeof match.subject !== "object" || Array.isArray(match.subject)) {
      throw new TypeError("Explorer matches must use the closed deterministic contract.");
    }
    if (!selected(match.category, match, result.query)) {
      throw new TypeError("Explorer match does not satisfy its normalized query.");
    }
    const categoryIndex = categoryOrder.indexOf(match.category);
    const subject = canonicalize(match.subject);
    if (categoryIndex < previousCategoryIndex
      || categoryIndex === previousCategoryIndex
        && previousSubject !== null && subject <= previousSubject) {
      throw new TypeError("Explorer matches do not preserve deterministic evidence order.");
    }
    previousCategoryIndex = categoryIndex;
    previousSubject = subject;
    for (const side of [match.baseline, match.candidate]) {
      if (side === null) continue;
      if (!exactMembers(side, ["digest", "pointer", "sourceIdentifier", "sourceKind"])
        || !digestPattern.test(side.digest)
        || !nonEmptyText(side.pointer) || !side.pointer.startsWith("/categories/")
        || !nonEmptyText(side.sourceIdentifier)
        || !["native", "mip"].includes(side.sourceKind)) {
        throw new TypeError("Explorer endpoints must reference exact regression evidence.");
      }
    }
    if (match.change === "added" && (match.baseline !== null || match.candidate === null)) {
      throw new TypeError("Added Explorer evidence requires only a candidate endpoint.");
    }
    if (match.change === "removed" && (match.baseline === null || match.candidate !== null)) {
      throw new TypeError("Removed Explorer evidence requires only a baseline endpoint.");
    }
    if (match.change === "modified" && (match.baseline === null || match.candidate === null)) {
      throw new TypeError("Modified Explorer evidence requires both endpoints.");
    }
  });
  const material = {
    matchCount: result.matchCount,
    matches: result.matches,
    query: result.query,
    regressionIdentifier: result.regressionIdentifier,
    status: result.status,
    workspaceIdentifier: result.workspaceIdentifier,
  };
  if (result.identifier !== resultIdentifier(material)) {
    throw new TypeError("Explorer result identity does not match its canonical content.");
  }
  return true;
}

export function navigateCognitiveRegression(reportValue, queryValue = {}) {
  const query = normalizeQuery(queryValue);
  const report = normalizedReport(reportValue);
  const matches = [];
  report.categories.forEach((category, categoryIndex) => {
    category.differences.forEach((difference, differenceIndex) => {
      if (!selected(category.category, difference, query)) return;
      const pointer = `/categories/${categoryIndex}/differences/${differenceIndex}`;
      matches.push({
        index: matches.length,
        category: category.category,
        change: difference.change,
        subject: difference.subject,
        baseline: endpoint(report.baseline, difference.beforeDigest, `${pointer}/beforeDigest`),
        candidate: endpoint(report.candidate, difference.afterDigest, `${pointer}/afterDigest`),
      });
    });
  });
  const material = {
    matchCount: matches.length,
    matches,
    query,
    regressionIdentifier: report.identifier,
    status: matches.length === 0 ? "empty" : "matched",
    workspaceIdentifier: report.baseline.workspaceIdentifier,
  };
  const result = deepFreeze({
    kind: "MemoryOSCognitiveInvestigationResult",
    version: COGNITIVE_INVESTIGATION_EXPLORER_VERSION,
    identifier: resultIdentifier(material),
    ...material,
  });
  validateCognitiveInvestigationResult(result);
  return result;
}

export function serializeCognitiveInvestigationResult(result) {
  validateCognitiveInvestigationResult(result);
  return canonicalize(result);
}
