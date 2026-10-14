// MO-1309 test support (Phase 3): the data-class scanner tests start from the REAL generator's snapshot of a view model (the hand-built
// Phase 2C snapshot is gone) and mutate it per rule; `reseal` recomputes the footer digest so only the rule under test is the point.
import crypto from "node:crypto";
import { assembleTestSnapshot } from "./support-dashboard-snapshot.mjs";

export const miniSnapshot = (viewModel) => assembleTestSnapshot({ viewModel }).html;

export function reseal(html) {
  const match = /(<dd data-cell id="snapshot-digest">)(sha256:[0-9a-f]{64})(<\/dd>)/u.exec(html);
  const blanked = html.replace(match[2], "");
  return html.replace(match[2], `sha256:${crypto.createHash("sha256").update(blanked, "utf8").digest("hex")}`);
}
