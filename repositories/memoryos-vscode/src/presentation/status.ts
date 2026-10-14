import type * as vscode from "vscode";

import { sanitizePresentationText } from "./sanitize.js";
import type { MemoryOSDecision } from "./types.js";

export type MemoryOSStatusState =
  | { readonly kind: "decision"; readonly decision: MemoryOSDecision }
  | { readonly kind: "prepared" }
  | { readonly kind: "verified" }
  | { readonly kind: "toolError"; readonly code: string };

const DECISION_STATUS: Readonly<Record<MemoryOSDecision, string>> = Object.freeze({
  PASS: "$(check) MemoryOS: PASS",
  FAIL: "$(error) MemoryOS: FAIL",
  COULD_NOT_EVALUATE: "$(question) MemoryOS: COULD_NOT_EVALUATE",
});

/** Ephemeral presentation only; it starts hidden and stores no authority. */
export class MemoryOSStatusController implements vscode.Disposable {
  #disposed = false;

  constructor(readonly item: vscode.StatusBarItem) {
    this.item.name = "MemoryOS";
    this.item.hide();
  }

  publish(state: MemoryOSStatusState): void {
    if (this.#disposed) return;
    switch (state.kind) {
      case "decision":
        this.item.text = DECISION_STATUS[state.decision];
        this.item.tooltip = `Completed normative decision: ${state.decision}`;
        break;
      case "prepared":
        this.item.text = "$(check) MemoryOS: Prepared";
        this.item.tooltip = "The selected Policy artifact was prepared.";
        break;
      case "verified":
        this.item.text = "$(verified) MemoryOS: Verified";
        this.item.tooltip = "MemoryOS verification completed successfully.";
        break;
      case "toolError":
        this.item.text = "$(warning) MemoryOS: Tool Error";
        this.item.tooltip = `Operational failure: ${sanitizePresentationText(state.code, 128)}`;
        break;
    }
    this.item.show();
  }

  clear(): void {
    if (this.#disposed) return;
    this.item.hide();
    this.item.text = "";
    this.item.tooltip = undefined;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.clear();
    this.#disposed = true;
    this.item.dispose();
  }
}
