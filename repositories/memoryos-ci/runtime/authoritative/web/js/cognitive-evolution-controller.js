function requireFrameCount(frameCount) {
  if (!Number.isSafeInteger(frameCount) || frameCount < 0) {
    throw new TypeError("Observation frame count must be a non-negative safe integer.");
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function stateFor(frameCount, toIndex, active) {
  requireFrameCount(frameCount);
  const available = frameCount >= 2;
  const maximum = Math.max(1, frameCount - 1);
  const normalizedTo = available ? Math.min(maximum, Math.max(1, toIndex)) : 0;
  return deepFreeze({
    kind: "MemoryOSCognitiveEvolutionController",
    version: "1.1",
    active: available && Boolean(active),
    available,
    fromIndex: available ? normalizedTo - 1 : null,
    toIndex: available ? normalizedTo : null,
    canGoPrevious: available && normalizedTo > 1,
    canGoNext: available && normalizedTo < frameCount - 1,
  });
}

export function createEvolutionController(frameCount) {
  requireFrameCount(frameCount);
  return stateFor(frameCount, Math.max(1, frameCount - 1), false);
}

export function reconcileEvolutionController(controller, frameCount) {
  requireFrameCount(frameCount);
  if (!controller || controller.kind !== "MemoryOSCognitiveEvolutionController") {
    return createEvolutionController(frameCount);
  }
  const followsLatest = controller.toIndex === null || controller.toIndex === undefined || controller.canGoNext === false;
  const toIndex = followsLatest ? Math.max(1, frameCount - 1) : controller.toIndex;
  return stateFor(frameCount, toIndex, controller.active);
}

export function compareEvolution(controller, frameCount) {
  requireFrameCount(frameCount);
  const current = reconcileEvolutionController(controller, frameCount);
  return stateFor(frameCount, current.toIndex ?? Math.max(1, frameCount - 1), !current.active);
}

export function previousEvolutionObservation(controller, frameCount) {
  const current = reconcileEvolutionController(controller, frameCount);
  return stateFor(frameCount, (current.toIndex ?? 1) - 1, current.active);
}

export function nextEvolutionObservation(controller, frameCount) {
  const current = reconcileEvolutionController(controller, frameCount);
  return stateFor(frameCount, (current.toIndex ?? 1) + 1, current.active);
}

export function evolutionFrames(frames, controller) {
  if (!Array.isArray(frames)) throw new TypeError("Observation timeline must be an array.");
  const current = reconcileEvolutionController(controller, frames.length);
  if (!current.available) return null;
  return deepFreeze({
    from: frames[current.fromIndex],
    to: frames[current.toIndex],
  });
}
