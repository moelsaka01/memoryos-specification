// MO-1309 Phase 3 test support: byte comparison of the linear view-model builder against the Phase 1 per-page reference.
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { buildDashboardViewModelReference } from "./support-dashboard-reference-viewmodel.mjs";

export const sameBytes = (a, b) => a.byteLength === b.byteLength && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
export function differential(files) {
  const linear = canonicalViewModelBytes(buildDashboardViewModel({ files }));
  const reference = canonicalViewModelBytes(buildDashboardViewModelReference({ files }));
  return { identical: sameBytes(linear, reference), linear, reference };
}

