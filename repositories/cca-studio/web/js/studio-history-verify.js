// MemoryOS 1.3.1 Studio History: runs the MO-1309 view-model build (which runs the MO-1308 `verifyHistoryExport`) in a browser page.
// Finding recorded in the 1.3.1 handoff: the released MO-1308 modules test byte arrays with `value.buffer instanceof SharedArrayBuffer`
// WITHOUT a typeof guard. A page that is not cross-origin isolated has no `SharedArrayBuffer` global, so the released verifier throws
// a ReferenceError there. MO-1308 bytes may not change (Freeze section 2), so Studio supplies, for the duration of one synchronous
// call only, a stand-in class that no code instantiates: `x instanceof StandIn` is false for every value, which is exactly the answer
// in an environment that has no SharedArrayBuffer. The global is removed again before control returns; where the real global exists
// nothing is installed. The verifier itself, its inputs and its outputs are untouched.
import { buildDashboardViewModel } from "./memoryos-dashboard-viewmodel.js";

export function withSharedArrayBufferStandIn(action, host = globalThis) {
  if (typeof host.SharedArrayBuffer === "function") return action();
  Object.defineProperty(host, "SharedArrayBuffer", { value: class SharedArrayBuffer {}, configurable: true, writable: true, enumerable: false });
  try {
    return action();
  } finally {
    delete host.SharedArrayBuffer;
  }
}

// `input` is { files: [{ path, bytes }] }. Throws DashboardError only (as buildDashboardViewModel does).
export const buildViewModelInBrowser = (input, host = globalThis) => withSharedArrayBufferStandIn(() => buildDashboardViewModel(input), host);
