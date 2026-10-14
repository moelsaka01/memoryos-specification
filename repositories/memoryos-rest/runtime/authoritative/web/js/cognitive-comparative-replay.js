const statuses = new Set(["ready", "playing", "paused", "completed"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireReconstruction(reconstruction) {
  if (!reconstruction || reconstruction.kind !== "MemoryOSComparativeReconstruction"
    || reconstruction.version !== "1.1" || !Object.isFrozen(reconstruction)
    || !Array.isArray(reconstruction.moments) || reconstruction.moments.length === 0) {
    throw new TypeError("Comparative Replay requires an immutable MemoryOS 1.1 Comparative Reconstruction.");
  }
}

function requireState(reconstruction, current) {
  requireReconstruction(reconstruction);
  if (!current || current.reconstructionIdentifier !== reconstruction.identifier
    || !statuses.has(current.status)) {
    throw new TypeError("Comparative Replay state is not bound to this reconstruction.");
  }
  if (!Number.isSafeInteger(current.cursor) || current.cursor < -1
    || current.cursor >= reconstruction.moments.length) {
    throw new TypeError("Comparative Replay cursor is outside the reconstruction.");
  }
  if (![null, "divergence", "engineer"].includes(current.pauseReason)) {
    throw new TypeError("Comparative Replay has an invalid pause reason.");
  }
}

function state(reconstruction, status, cursor, pauseReason = null) {
  return Object.freeze({
    reconstructionIdentifier: reconstruction.identifier,
    status,
    cursor,
    pauseReason,
  });
}

function stateAt(reconstruction, cursor, otherwise = "paused") {
  if (cursor >= reconstruction.moments.length) {
    return state(reconstruction, "completed", reconstruction.moments.length - 1);
  }
  const moment = reconstruction.moments[cursor];
  return moment.divergent
    ? state(reconstruction, "paused", cursor, "divergence")
    : state(reconstruction, otherwise, cursor, otherwise === "paused" ? "engineer" : null);
}

export function createComparativeReplayState(reconstruction) {
  requireReconstruction(reconstruction);
  return state(reconstruction, "ready", -1);
}

export function playComparativeReplay(reconstruction, current) {
  requireState(reconstruction, current);
  if (current.status === "playing" || current.status === "completed") return current;
  if (current.status === "ready") {
    return stateAt(reconstruction, 0, reconstruction.moments.length === 1 ? "completed" : "playing");
  }
  if (current.cursor === reconstruction.moments.length - 1) {
    return state(reconstruction, "playing", current.cursor);
  }
  return state(reconstruction, "playing", current.cursor);
}

export function pauseComparativeReplay(reconstruction, current) {
  requireState(reconstruction, current);
  return current.status === "playing"
    ? state(reconstruction, "paused", current.cursor, "engineer")
    : current;
}

export function resetComparativeReplay(reconstruction, current) {
  requireState(reconstruction, current);
  return state(reconstruction, "ready", -1);
}

export function nextComparativeStep(reconstruction, current) {
  requireState(reconstruction, current);
  if (current.status === "completed") return current;
  if (current.cursor === reconstruction.moments.length - 1) {
    return state(reconstruction, "completed", current.cursor);
  }
  return stateAt(reconstruction, current.cursor + 1);
}

export function previousComparativeStep(reconstruction, current) {
  requireState(reconstruction, current);
  if (current.cursor <= 0) return state(reconstruction, "ready", -1);
  return stateAt(reconstruction, current.cursor - 1);
}

export function advanceComparativeReplay(reconstruction, current) {
  requireState(reconstruction, current);
  if (current.status !== "playing") return current;
  if (current.cursor === reconstruction.moments.length - 1) {
    return state(reconstruction, "completed", current.cursor);
  }
  return stateAt(reconstruction, current.cursor + 1, "playing");
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function projectedRecords(reconstruction, current) {
  const completed = current.status === "completed";
  const occurrences = reconstruction.moments.flatMap((moment) => {
    const phase = completed || moment.index < current.cursor
      ? "completed"
      : moment.index === current.cursor ? "current" : "future";
    return [
      ["a", moment.from],
      ["b", moment.to],
    ].flatMap(([side, step]) => step ? [{
      key: step.key,
      elementType: step.elementType,
      role: step.role,
      side,
      semanticState: moment.state,
      phase,
      momentIndex: moment.index,
    }] : []);
  });
  const records = new Map();
  occurrences.forEach((occurrence) => {
    const identity = `${occurrence.elementType}:${occurrence.key}`;
    const record = records.get(identity) ?? {
      key: occurrence.key,
      elementType: occurrence.elementType,
      occurrences: [],
    };
    record.occurrences.push(occurrence);
    records.set(identity, record);
  });
  const summarizeOccurrences = (recordOccurrences) => {
    const active = recordOccurrences.filter(({ phase }) => phase === "current");
    const visible = active.length > 0 ? active : recordOccurrences;
    const phases = [...new Set(recordOccurrences.map(({ phase }) => phase))];
    const states = [...new Set(recordOccurrences.map(({ semanticState }) => semanticState))];
    return {
      roles: [...new Set(recordOccurrences.map(({ role }) => role))].sort(compareText),
      sides: [...new Set(visible.map(({ side }) => side))].sort(compareText),
      semanticState: active.length > 0
        ? (new Set(active.map(({ semanticState }) => semanticState)).size === 1
          ? active[0].semanticState : "split")
        : states.length === 1 ? states[0] : "split",
      phase: active.length > 0 ? "current" : phases.length === 1 ? phases[0] : "split",
      momentIndices: [...new Set(recordOccurrences.map(({ momentIndex }) => momentIndex))]
        .sort((left, right) => left - right),
    };
  };
  return [...records.values()]
    .map((record) => {
      const summary = summarizeOccurrences(record.occurrences);
      const sideRecords = ["a", "b"].flatMap((side) => {
        const sideOccurrences = record.occurrences.filter((occurrence) => occurrence.side === side);
        if (sideOccurrences.length === 0) return [];
        return [{
          side,
          ...summarizeOccurrences(sideOccurrences),
          occurrences: sideOccurrences,
        }];
      });
      return {
        key: record.key,
        elementType: record.elementType,
        ...summary,
        occurrences: record.occurrences,
        sideRecords,
      };
    })
    .sort((left, right) => compareText(`${left.elementType}:${left.key}`, `${right.elementType}:${right.key}`));
}

export function projectComparativeReplay(reconstruction, current) {
  requireState(reconstruction, current);
  const currentMoment = current.status === "completed" || current.cursor < 0
    ? null
    : reconstruction.moments[current.cursor];
  const records = projectedRecords(reconstruction, current);
  return deepFreeze({
    kind: "MemoryOSComparativeReconstructionView",
    version: "1.1",
    identifier: reconstruction.identifier,
    worldIdentifier: reconstruction.worldIdentifier,
    active: true,
    status: current.status,
    pauseReason: current.pauseReason,
    cursor: current.cursor,
    total: reconstruction.moments.length,
    firstDivergenceIndex: reconstruction.firstDivergenceIndex,
    divergenceIndices: reconstruction.divergenceIndices,
    divergenceCount: reconstruction.divergenceIndices.length,
    currentMoment,
    atDivergence: Boolean(currentMoment?.divergent),
    moments: reconstruction.moments,
    records,
    nodeRecords: records.filter(({ elementType }) => elementType === "node"),
    relationshipRecords: records.filter(({ elementType }) => elementType === "relationship"),
  });
}
