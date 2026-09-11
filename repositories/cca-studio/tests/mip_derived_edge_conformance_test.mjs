import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MemoryInvestigationPackageError,
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  recordRevisionDigest,
  relationshipRevisionDigest,
} from "../web/js/memory-investigation-package.js";
import { cloneCanonical } from "../web/js/mip-canonical.js";

const TRACE_ROLES = [
  "originEvidence",
  "semanticTransformation",
  "retrieval",
  "reflectionCurrent",
];

async function completePackage() {
  const encoded = await readFile(
    new URL("./fixtures/mip/complete-investigation.mip.b64", import.meta.url),
    "ascii",
  );
  return importMemoryInvestigationPackage(
    new Uint8Array(Buffer.from(encoded.trim(), "base64")),
  );
}

function reference(kind, identifier) {
  return { identifier, kind, occurrence: 0 };
}

function referenceKey(value) {
  return `${value.kind}\u0000${value.identifier}\u0000${value.occurrence}`;
}

function compareReference(left, right) {
  return left.kind < right.kind ? -1
    : left.kind > right.kind ? 1
      : left.identifier < right.identifier ? -1
        : left.identifier > right.identifier ? 1
          : left.occurrence - right.occurrence;
}

function provenance(source, relationship) {
  return { relationship, source };
}

function record(ref, role, sources, revision = {}) {
  return { provenance: sources, reference: ref, revision, role };
}

function relationship(ref, from, to, relationshipType) {
  return { from, reference: ref, relationshipType, revision: {}, to };
}

function traceStep(index, role, node, relationshipRef, direction = "forward") {
  return {
    direction: relationshipRef === null ? null : direction,
    index,
    node,
    relationship: relationshipRef,
    role,
  };
}

function projectReplay(trace, identifier) {
  const steps = [];
  const seenNodes = new Set();
  const seenRelationships = new Set();

  for (const role of TRACE_ROLES) {
    const matching = trace.branches.flatMap((branch) => (
      branch.steps.filter((step) => step.role === role)
    ));
    for (const step of matching) {
      const key = referenceKey(step.node);
      if (seenNodes.has(key)) continue;
      seenNodes.add(key);
      steps.push({
        direction: null,
        elementType: "node",
        index: steps.length,
        node: step.node,
        relationship: null,
        role,
      });
    }
    for (const step of matching) {
      if (step.relationship === null) continue;
      const key = referenceKey(step.relationship);
      if (seenRelationships.has(key)) continue;
      seenRelationships.add(key);
      steps.push({
        direction: step.direction,
        elementType: "relationship",
        index: steps.length,
        node: null,
        relationship: step.relationship,
        role,
      });
    }
  }

  return {
    identifier,
    observationIdentifier: trace.observationIdentifier,
    steps,
    traceIdentifier: trace.identifier,
    workspaceIdentifier: trace.workspaceIdentifier,
  };
}

function draftFrom(referencePackage, packageIdentifier, sections) {
  return {
    comparativeReconstructions: sections.comparativeReconstructions ?? [],
    evolutions: sections.evolutions ?? [],
    extensions: {},
    metadata: referencePackage.metadata,
    observations: sections.observations,
    packageIdentifier,
    replays: sections.replays ?? [],
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
    traces: sections.traces ?? [],
    workspaceIdentifier: "workspace-investigation",
  };
}

function expectExportDiagnostic(draft, code) {
  assert.throws(
    () => exportMemoryInvestigationPackage(draft),
    (error) => error instanceof MemoryInvestigationPackageError
      && error.diagnostics[0]?.code === code,
  );
}

async function multiBranchScenario() {
  const published = await completePackage();
  const workspaceIdentifier = "workspace-investigation";

  const evidenceA = reference("memoryos.longTermMemoryEntry", "evidence-a");
  const evidenceB = reference("memoryos.longTermMemoryEntry", "evidence-b");
  const semanticA = reference("memoryos.semanticConcept", "semantic-a");
  const semanticB = reference("memoryos.semanticConcept", "semantic-b");
  const retrievalA = reference("memoryos.retrieval", "retrieval-a");
  const retrievalB = reference("memoryos.retrieval", "retrieval-b");
  const reflection = reference("memoryos.reflection", "reflection-target");

  const evidenceAToSemanticA = reference("memoryos.relationship", "rel-evidence-a-semantic-a");
  const evidenceAToSemanticB = reference("memoryos.relationship", "rel-evidence-a-semantic-b");
  const evidenceBToSemanticB = reference("memoryos.relationship", "rel-evidence-b-semantic-b");
  const semanticAToRetrievalA = reference("memoryos.relationship", "rel-semantic-a-retrieval-a");
  const semanticBToRetrievalB = reference("memoryos.relationship", "rel-semantic-b-retrieval-b");
  const retrievalAToReflection = reference("memoryos.relationship", "rel-retrieval-a-reflection");
  const retrievalBToReflection = reference("memoryos.relationship", "rel-retrieval-b-reflection");

  const records = [
    record(evidenceA, "evidence", [], { retained: "evidence-a" }),
    record(evidenceB, "evidence", [], { retained: "evidence-b" }),
    record(reflection, "reflection", [
      provenance(retrievalB, retrievalBToReflection),
      provenance(retrievalA, retrievalAToReflection),
    ], { state: "validated" }),
    record(retrievalA, "retrieval", [
      provenance(semanticA, semanticAToRetrievalA),
    ], { rank: 1 }),
    record(retrievalB, "retrieval", [
      provenance(semanticB, semanticBToRetrievalB),
    ], { rank: 2 }),
    record(semanticA, "semanticTransformation", [
      provenance(evidenceA, evidenceAToSemanticA),
    ], { category: "a" }),
    record(semanticB, "semanticTransformation", [
      provenance(evidenceB, evidenceBToSemanticB),
      provenance(evidenceA, evidenceAToSemanticB),
    ], { category: "b" }),
  ].sort((left, right) => compareReference(left.reference, right.reference));

  const relationships = [
    relationship(evidenceAToSemanticA, evidenceA, semanticA, "evidence"),
    relationship(evidenceAToSemanticB, evidenceA, semanticB, "evidence"),
    relationship(evidenceBToSemanticB, evidenceB, semanticB, "evidence"),
    relationship(semanticAToRetrievalA, semanticA, retrievalA, "retrieves"),
    relationship(semanticBToRetrievalB, semanticB, retrievalB, "retrieves"),
    relationship(retrievalAToReflection, retrievalA, reflection, "contributes"),
    relationship(retrievalBToReflection, retrievalB, reflection, "contributes"),
  ].sort((left, right) => compareReference(left.reference, right.reference));

  const observation = {
    identifier: "observation-multi-branch",
    records,
    relationships,
    sequence: 10,
    workspaceIdentifier,
  };
  const trace = {
    branches: [
      {
        index: 0,
        steps: [
          traceStep(0, "originEvidence", evidenceB, evidenceBToSemanticB),
          traceStep(1, "originEvidence", evidenceA, evidenceAToSemanticB),
          traceStep(2, "semanticTransformation", semanticB, semanticBToRetrievalB),
          traceStep(3, "retrieval", retrievalB, retrievalBToReflection),
          traceStep(4, "reflectionCurrent", reflection, null),
        ],
      },
      {
        index: 1,
        steps: [
          traceStep(0, "originEvidence", evidenceA, evidenceAToSemanticA),
          traceStep(1, "semanticTransformation", semanticA, semanticAToRetrievalA),
          traceStep(2, "retrieval", retrievalA, retrievalAToReflection),
          traceStep(3, "reflectionCurrent", reflection, null),
        ],
      },
    ],
    identifier: "trace-multi-branch",
    observationIdentifier: observation.identifier,
    target: reflection,
    workspaceIdentifier,
  };
  const replay = projectReplay(trace, "replay-multi-branch");
  const draft = draftFrom(published, "mip-derived-multi-branch", {
    observations: [observation],
    replays: [replay],
    traces: [trace],
  });
  return { draft, observation, replay, trace };
}

function sideFor(step, observation) {
  const ref = step.elementType === "node" ? step.node : step.relationship;
  const semantic = step.elementType === "node"
    ? observation.records.find((entry) => referenceKey(entry.reference) === referenceKey(ref))
    : observation.relationships.find((entry) => referenceKey(entry.reference) === referenceKey(ref));
  assert.ok(semantic, `semantic element ${referenceKey(ref)} must resolve`);
  return {
    direction: step.direction,
    elementType: step.elementType,
    reference: ref,
    revisionDigest: step.elementType === "node"
      ? recordRevisionDigest(semantic)
      : relationshipRevisionDigest(semantic),
    role: step.role,
  };
}

function sideIdentity(side) {
  return `${side.elementType}\u0000${referenceKey(side.reference)}`;
}

function lcsTable(from, to) {
  const table = Array.from({ length: from.length + 1 }, () => (
    Array(to.length + 1).fill(0)
  ));
  for (let left = from.length - 1; left >= 0; left -= 1) {
    for (let right = to.length - 1; right >= 0; right -= 1) {
      table[left][right] = sideIdentity(from[left]) === sideIdentity(to[right])
        ? table[left + 1][right + 1] + 1
        : Math.max(table[left + 1][right], table[left][right + 1]);
    }
  }
  return table;
}

function alignWithObservationAPreference(from, to) {
  const table = lcsTable(from, to);
  const aligned = [];
  let left = 0;
  let right = 0;
  while (left < from.length || right < to.length) {
    if (left >= from.length) aligned.push({ from: null, to: to[right++] });
    else if (right >= to.length) aligned.push({ from: from[left++], to: null });
    else if (sideIdentity(from[left]) === sideIdentity(to[right])) {
      aligned.push({ from: from[left++], to: to[right++] });
    } else if (table[left + 1][right] >= table[left][right + 1]) {
      aligned.push({ from: from[left++], to: null });
    } else {
      aligned.push({ from: null, to: to[right++] });
    }
  }
  return { aligned, table };
}

function comparativeMoments(aligned) {
  return aligned.map((pair, index) => {
    if (pair.from === null) {
      return { from: null, index, reasonCodes: ["B_ONLY"], state: "bOnly", to: pair.to };
    }
    if (pair.to === null) {
      return { from: pair.from, index, reasonCodes: ["A_ONLY"], state: "aOnly", to: null };
    }
    const reasonCodes = [];
    if (pair.from.revisionDigest !== pair.to.revisionDigest) {
      reasonCodes.push(pair.from.elementType === "node"
        ? "SEMANTIC_REVISION_CHANGED"
        : "RELATIONSHIP_REVISION_CHANGED");
    }
    if (pair.from.role !== pair.to.role || pair.from.direction !== pair.to.direction) {
      reasonCodes.push("TRACE_BINDING_CHANGED");
    }
    return {
      from: pair.from,
      index,
      reasonCodes,
      state: reasonCodes.length === 0 ? "shared" : "modified",
      to: pair.to,
    };
  });
}

test("CCA-MIP-024: multi-branch Trace reconstruction preserves Reflection and evidence provenance order", async () => {
  const scenario = await multiBranchScenario();
  const imported = importMemoryInvestigationPackage(
    exportMemoryInvestigationPackage(scenario.draft),
  );
  const trace = imported.traces[0];

  assert.deepEqual(
    trace.branches.map((branch) => branch.steps.map((step) => step.node.identifier)),
    [
      ["evidence-b", "evidence-a", "semantic-b", "retrieval-b", "reflection-target"],
      ["evidence-a", "semantic-a", "retrieval-a", "reflection-target"],
    ],
  );

  const reorderedBranches = cloneCanonical(scenario.draft);
  reorderedBranches.traces[0].branches.reverse();
  reorderedBranches.traces[0].branches.forEach((branch, index) => { branch.index = index; });
  expectExportDiagnostic(reorderedBranches, "INVALID_TRACE");

  const reorderedEvidence = cloneCanonical(scenario.draft);
  const firstBranch = reorderedEvidence.traces[0].branches[0];
  [firstBranch.steps[0], firstBranch.steps[1]] = [firstBranch.steps[1], firstBranch.steps[0]];
  firstBranch.steps.forEach((step, index) => { step.index = index; });
  expectExportDiagnostic(reorderedEvidence, "INVALID_TRACE");
});

test("CCA-MIP-026: multi-branch Replay uses fixed role order and first-seen suppression", async () => {
  const scenario = await multiBranchScenario();
  const imported = importMemoryInvestigationPackage(
    exportMemoryInvestigationPackage(scenario.draft),
  );
  const replay = imported.replays[0];
  const identities = replay.steps.map((step) => (
    `${step.elementType}:${(step.node ?? step.relationship).identifier}`
  ));

  assert.deepEqual(identities, [
    "node:evidence-b",
    "node:evidence-a",
    "relationship:rel-evidence-b-semantic-b",
    "relationship:rel-evidence-a-semantic-b",
    "relationship:rel-evidence-a-semantic-a",
    "node:semantic-b",
    "node:semantic-a",
    "relationship:rel-semantic-b-retrieval-b",
    "relationship:rel-semantic-a-retrieval-a",
    "node:retrieval-b",
    "node:retrieval-a",
    "relationship:rel-retrieval-b-reflection",
    "relationship:rel-retrieval-a-reflection",
    "node:reflection-target",
  ]);
  assert.deepEqual(
    replay.steps.map((step) => step.role),
    [
      "originEvidence", "originEvidence", "originEvidence", "originEvidence", "originEvidence",
      "semanticTransformation", "semanticTransformation", "semanticTransformation", "semanticTransformation",
      "retrieval", "retrieval", "retrieval", "retrieval", "reflectionCurrent",
    ],
  );
  assert.equal(identities.filter((identity) => identity === "node:evidence-a").length, 1);
  assert.equal(identities.filter((identity) => identity === "node:reflection-target").length, 1);

  const repeatedFirstSeen = cloneCanonical(scenario.draft);
  const repeated = cloneCanonical(repeatedFirstSeen.replays[0].steps[1]);
  repeatedFirstSeen.replays[0].steps.splice(2, 0, repeated);
  repeatedFirstSeen.replays[0].steps.forEach((step, index) => { step.index = index; });
  expectExportDiagnostic(repeatedFirstSeen, "INVALID_REPLAY");
});

test("CCA-MIP-035: an equal-length LCS tie emits Observation A first", async () => {
  const scenario = await multiBranchScenario();
  const fromObservation = cloneCanonical(scenario.observation);
  const toObservation = cloneCanonical(scenario.observation);
  fromObservation.identifier = "observation-tie-a";
  fromObservation.sequence = 10;
  toObservation.identifier = "observation-tie-b";
  toObservation.sequence = 20;
  const toReflection = toObservation.records.find(({ role }) => role === "reflection");
  toReflection.provenance.reverse();

  const fromTrace = cloneCanonical(scenario.trace);
  fromTrace.identifier = "trace-tie-a";
  fromTrace.observationIdentifier = fromObservation.identifier;
  const toTrace = cloneCanonical(scenario.trace);
  toTrace.identifier = "trace-tie-b";
  toTrace.observationIdentifier = toObservation.identifier;
  toTrace.branches.reverse();
  toTrace.branches.forEach((branch, index) => { branch.index = index; });

  const fromReplay = projectReplay(fromTrace, "replay-tie-a");
  const toReplay = projectReplay(toTrace, "replay-tie-b");
  const fromSides = fromReplay.steps.map((step) => sideFor(step, fromObservation));
  const toSides = toReplay.steps.map((step) => sideFor(step, toObservation));
  const { aligned, table } = alignWithObservationAPreference(fromSides, toSides);

  assert.notEqual(sideIdentity(fromSides[0]), sideIdentity(toSides[0]));
  assert.equal(table[1][0], table[0][1], "the first alignment choice must be an exact LCS tie");
  assert.equal(aligned[0].from.reference.identifier, "evidence-b");
  assert.equal(aligned[0].to, null);

  const moments = comparativeMoments(aligned);
  const fromReflection = fromObservation.records.find(({ role }) => role === "reflection");
  const evolution = {
    differences: [
      {
        afterRevisionDigest: recordRevisionDigest(toReflection),
        beforeRevisionDigest: null,
        index: 0,
        kind: "addedReflection",
        subject: toReflection.reference,
      },
      {
        afterRevisionDigest: null,
        beforeRevisionDigest: recordRevisionDigest(fromReflection),
        index: 1,
        kind: "removedReflection",
        subject: fromReflection.reference,
      },
    ],
    fromObservationIdentifier: fromObservation.identifier,
    identifier: "evolution-tie",
    toObservationIdentifier: toObservation.identifier,
    workspaceIdentifier: fromObservation.workspaceIdentifier,
  };
  const comparative = {
    divergenceIndices: moments.filter(({ state }) => state !== "shared").map(({ index }) => index),
    evolutionIdentifier: evolution.identifier,
    fromObservationIdentifier: fromObservation.identifier,
    fromTraceIdentifier: fromTrace.identifier,
    identifier: "comparative-tie",
    moments,
    toObservationIdentifier: toObservation.identifier,
    toTraceIdentifier: toTrace.identifier,
    workspaceIdentifier: fromObservation.workspaceIdentifier,
  };
  const published = await completePackage();
  const draft = draftFrom(published, "mip-comparative-lcs-tie", {
    comparativeReconstructions: [comparative],
    evolutions: [evolution],
    observations: [fromObservation, toObservation],
    replays: [fromReplay, toReplay],
    traces: [fromTrace, toTrace],
  });
  const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draft));
  assert.deepEqual(imported.comparativeReconstructions[0].moments[0], {
    from: fromSides[0],
    index: 0,
    reasonCodes: ["A_ONLY"],
    state: "aOnly",
    to: null,
  });
});

test("CCA-MIP-035: relationship revision and Trace binding reasons use the mandated exact order", async () => {
  const published = await completePackage();
  const fromObservation = cloneCanonical(published.observations[0]);
  const toObservation = cloneCanonical(published.observations[0]);
  fromObservation.identifier = "observation-reason-a";
  fromObservation.sequence = 10;
  toObservation.identifier = "observation-reason-b";
  toObservation.sequence = 20;

  const changedRelationship = toObservation.relationships.find((entry) => (
    entry.reference.identifier === "rel-links-001"
  ));
  [changedRelationship.from, changedRelationship.to] = [changedRelationship.to, changedRelationship.from];
  changedRelationship.revision = { version: 2 };

  const fromTrace = cloneCanonical(published.traces[0]);
  fromTrace.identifier = "trace-reason-a";
  fromTrace.observationIdentifier = fromObservation.identifier;
  const toTrace = cloneCanonical(fromTrace);
  toTrace.identifier = "trace-reason-b";
  toTrace.observationIdentifier = toObservation.identifier;
  toTrace.branches[0].steps.find(({ role }) => role === "semanticTransformation").direction = "reverse";

  const fromReplay = projectReplay(fromTrace, "replay-reason-a");
  const toReplay = projectReplay(toTrace, "replay-reason-b");
  const fromSides = fromReplay.steps.map((step) => sideFor(step, fromObservation));
  const toSides = toReplay.steps.map((step) => sideFor(step, toObservation));
  const moments = fromSides.map((from, index) => {
    const to = toSides[index];
    if (from.reference.identifier === "rel-links-001") {
      return {
        from,
        index,
        reasonCodes: ["RELATIONSHIP_REVISION_CHANGED", "TRACE_BINDING_CHANGED"],
        state: "modified",
        to,
      };
    }
    return { from, index, reasonCodes: [], state: "shared", to };
  });
  const beforeRelationship = fromObservation.relationships.find((entry) => (
    entry.reference.identifier === "rel-links-001"
  ));
  const evolution = {
    differences: [{
      afterRevisionDigest: relationshipRevisionDigest(changedRelationship),
      beforeRevisionDigest: relationshipRevisionDigest(beforeRelationship),
      index: 0,
      kind: "modifiedRelationship",
      subject: changedRelationship.reference,
    }],
    fromObservationIdentifier: fromObservation.identifier,
    identifier: "evolution-reasons",
    toObservationIdentifier: toObservation.identifier,
    workspaceIdentifier: fromObservation.workspaceIdentifier,
  };
  const comparative = {
    divergenceIndices: [3],
    evolutionIdentifier: evolution.identifier,
    fromObservationIdentifier: fromObservation.identifier,
    fromTraceIdentifier: fromTrace.identifier,
    identifier: "comparative-reasons",
    moments,
    toObservationIdentifier: toObservation.identifier,
    toTraceIdentifier: toTrace.identifier,
    workspaceIdentifier: fromObservation.workspaceIdentifier,
  };
  const draft = draftFrom(published, "mip-comparative-reasons", {
    comparativeReconstructions: [comparative],
    evolutions: [evolution],
    observations: [fromObservation, toObservation],
    replays: [fromReplay, toReplay],
    traces: [fromTrace, toTrace],
  });

  const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draft));
  const modified = imported.comparativeReconstructions[0].moments[3];
  assert.equal(modified.from.elementType, "relationship");
  assert.equal(modified.from.reference.identifier, "rel-links-001");
  assert.equal(modified.from.direction, "forward");
  assert.equal(modified.to.direction, "reverse");
  assert.deepEqual(modified.reasonCodes, [
    "RELATIONSHIP_REVISION_CHANGED",
    "TRACE_BINDING_CHANGED",
  ]);

  const wrongReasonOrder = cloneCanonical(draft);
  wrongReasonOrder.comparativeReconstructions[0].moments[3].reasonCodes.reverse();
  expectExportDiagnostic(wrongReasonOrder, "INVALID_COMPARATIVE_RECONSTRUCTION");
});
