function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) result[key] = canonicalValue(value[key]);
    }
    return result;
  }
  return value;
}

export function deterministicJson(value) {
  return `${JSON.stringify(canonicalValue(value))}\n`;
}

function humanValue(value) {
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(canonicalValue(value));
  if (value === null) return "none";
  return String(value);
}

export function humanResult(command, result) {
  const lines = [`MemoryOS ${command}`];
  for (const key of Object.keys(result).sort()) {
    lines.push(`${key}: ${humanValue(result[key])}`);
  }
  return `${lines.join("\n")}\n`;
}

export function successEnvelope(command, result) {
  return { command, ok: true, result, schemaVersion: "1.0" };
}

export function errorEnvelope(command, error) {
  return {
    command,
    error: {
      code: error.code,
      details: error.details,
      exitCode: error.exitCode,
      message: error.message,
    },
    ok: false,
    schemaVersion: "1.0",
  };
}

export function humanError(command, error) {
  return [
    `MemoryOS ${command ?? "cli"} failed`,
    `code: ${error.code}`,
    `exitCode: ${error.exitCode}`,
    `message: ${error.message}`,
  ].join("\n") + "\n";
}

export function investigationSummary(investigation) {
  const transitionLog = investigation.transitionLog;
  return {
    availability: investigation.availability,
    identifier: investigation.identifier,
    lifecycle: investigation.lifecycle,
    phase: investigation.phase,
    sourceKind: investigation.view.sourceKind,
    transitionCount: transitionLog.transitions.length,
    transitionLogDigest: transitionLog.digest,
    workspaceIdentifier: investigation.workspaceIdentifier,
  };
}

export function replaySummary(session) {
  return {
    ...investigationSummary(session.investigation),
    cursor: session.state.cursor,
    replayIdentifier: session.replay.identifier,
    replayStatus: session.state.status,
  };
}

export function comparisonSummary(session) {
  return {
    ...investigationSummary(session.investigation),
    evolutionIdentifier: session.evolution.identifier,
    stage: session.investigation.phase,
  };
}

export function verificationSummary(verification) {
  return {
    diagnosticCount: verification.diagnostics.length,
    diagnostics: verification.diagnostics,
    status: verification.status,
    valid: verification.valid,
  };
}
