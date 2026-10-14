import {
  cloneDetached,
  exportSnapshot,
  forgetSnapshot,
  inspectSnapshot,
  observeSnapshot,
  summarizeSnapshot,
  traceSnapshot,
} from "./studio-model.js";

export const operationNames = Object.freeze([
  "observe",
  "inspect",
  "trace",
  "summarize",
  "exportView",
  "forgetSession",
]);

export function createReferenceAdapter(initialSnapshot) {
  let sessionState = initialSnapshot.session?.state ?? "Open";
  let view = sessionState === "Observed" ? cloneDetached(initialSnapshot) : null;

  return Object.freeze({
    async observe(nextView) {
      const result = observeSnapshot(initialSnapshot, sessionState, nextView);
      if (result.succeeded) {
        view = cloneDetached(result.view);
        sessionState = "Observed";
      }
      return result;
    },
    async inspect(query) {
      return inspectSnapshot(view ?? initialSnapshot, sessionState, query);
    },
    async trace(query) {
      return traceSnapshot(view ?? initialSnapshot, sessionState, query);
    },
    async summarize(query) {
      return summarizeSnapshot(view ?? initialSnapshot, sessionState, query);
    },
    async exportView() {
      return exportSnapshot(view ?? initialSnapshot, sessionState);
    },
    async forgetSession() {
      const result = forgetSnapshot(initialSnapshot);
      if (result.succeeded) {
        view = null;
        sessionState = "Forgotten";
      }
      return result;
    },
  });
}

export function resolveCommandAdapter(snapshot) {
  const injected = globalThis.__CCA_STUDIO_COMMANDS__;
  if (injected === undefined) return createReferenceAdapter(snapshot);
  if (!injected || typeof injected !== "object") {
    throw new TypeError("__CCA_STUDIO_COMMANDS__ must be an object");
  }
  const missing = operationNames.filter((name) => typeof injected[name] !== "function");
  if (missing.length > 0) {
    throw new TypeError(`Memory Studio host adapter is missing: ${missing.join(", ")}`);
  }
  return Object.freeze(Object.fromEntries(operationNames.map((name) => [
    name,
    (...args) => Promise.resolve(injected[name](...args)),
  ])));
}
