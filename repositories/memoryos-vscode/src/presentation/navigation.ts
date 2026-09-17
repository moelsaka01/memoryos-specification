import * as vscode from "vscode";

import { sanitizePresentationLabel } from "./sanitize.js";

export type MemoryOSNavigationRole =
  | "selectedPolicyArtifact"
  | "candidateMip"
  | "baselineMip"
  | "contractIdentities"
  | "evaluationIdentity"
  | "evaluationOutcome";

const NAVIGATION_CAPABILITY: unique symbol = Symbol("MemoryOSPossessedArtifactNavigation");

export interface PossessedArtifactNavigation {
  readonly role: MemoryOSNavigationRole;
  readonly uri: vscode.Uri;
  readonly label: string;
  readonly [NAVIGATION_CAPABILITY]: true;
}

const VIRTUAL_ROLES: ReadonlySet<MemoryOSNavigationRole> = new Set([
  "contractIdentities",
  "evaluationIdentity",
  "evaluationOutcome",
]);

/** Mints process-local navigation capabilities only for possessed artifacts. */
export class MemoryOSNavigationRegistry implements vscode.Disposable {
  readonly #capabilities = new WeakSet<object>();
  #generation = 0;
  #disposed = false;

  possess(
    role: MemoryOSNavigationRole,
    uri: vscode.Uri,
    label: string,
  ): PossessedArtifactNavigation {
    if (this.#disposed) throw new Error("The MemoryOS navigation registry is disposed.");
    const expectedScheme = VIRTUAL_ROLES.has(role) ? "memoryos" : "file";
    if (uri.scheme !== expectedScheme || uri.query !== "" || uri.fragment !== "") {
      throw new Error(`MemoryOS ${role} navigation requires a closed ${expectedScheme}: URI.`);
    }
    const generation = this.#generation;
    const capability = Object.freeze({
      role,
      uri,
      label: sanitizePresentationLabel(label),
      [NAVIGATION_CAPABILITY]: true as const,
      generation,
    });
    this.#capabilities.add(capability);
    return capability;
  }

  isPossessed(value: unknown): value is PossessedArtifactNavigation {
    if (this.#disposed || value === null || typeof value !== "object") return false;
    const candidate = value as PossessedArtifactNavigation & { readonly generation?: number };
    return candidate[NAVIGATION_CAPABILITY] === true
      && candidate.generation === this.#generation
      && this.#capabilities.has(candidate);
  }

  openCommand(value: PossessedArtifactNavigation): vscode.Command | undefined {
    if (!this.isPossessed(value)) return undefined;
    return Object.freeze({
      title: `Open ${value.label}`,
      command: "vscode.open",
      arguments: [value.uri],
    });
  }

  revokeAll(): void {
    this.#generation += 1;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
  }
}
