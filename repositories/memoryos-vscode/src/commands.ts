import * as vscode from "vscode";

import {
  MEMORYOS_VSCODE_ADAPTER_ERROR_CODES,
  MemoryOSAdapterError,
} from "./errors.js";

export const MEMORYOS_PUBLIC_COMMANDS = Object.freeze([
  Object.freeze({
    id: "memoryos.showContractIdentities",
    title: "Show Contract Identities",
    requiresWorkspaceTrust: false,
  }),
  Object.freeze({
    id: "memoryos.preparePolicyArtifact",
    title: "Prepare Policy or Policy Set",
    requiresWorkspaceTrust: true,
  }),
  Object.freeze({
    id: "memoryos.evaluatePolicyArtifact",
    title: "Evaluate Policy or Policy Set",
    requiresWorkspaceTrust: true,
  }),
  Object.freeze({
    id: "memoryos.verifyEvaluationIdentity",
    title: "Verify Evaluation Identity",
    requiresWorkspaceTrust: true,
  }),
  Object.freeze({
    id: "memoryos.verifyPolicyOutcome",
    title: "Verify Policy Outcome",
    requiresWorkspaceTrust: true,
  }),
] as const);

export type MemoryOSPublicCommand = (typeof MEMORYOS_PUBLIC_COMMANDS)[number];
export type MemoryOSPublicCommandId = MemoryOSPublicCommand["id"];

/** Product boundary; every implementation delegates semantics to Phase 1. */
export interface ExtensionCommandAdapter {
  showContractIdentities(): Promise<unknown>;
  preparePolicyArtifact(uri?: vscode.Uri): Promise<unknown>;
  evaluatePolicyArtifact(uri?: vscode.Uri): Promise<unknown>;
  verifyEvaluationIdentity(uri?: vscode.Uri): Promise<unknown>;
  verifyPolicyOutcome(uri?: vscode.Uri): Promise<unknown>;
}

export function enforceWorkspaceTrust(commandId: MemoryOSPublicCommandId): void {
  if (vscode.workspace.isTrusted) return;
  throw new MemoryOSAdapterError(
    MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKSPACE_UNTRUSTED,
    `${commandId} requires a trusted workspace.`,
  );
}

export async function invokeMemoryOSCommand(
  command: MemoryOSPublicCommand,
  adapter: ExtensionCommandAdapter,
  uri?: vscode.Uri,
): Promise<unknown> {
  // Handler-level enforcement is mandatory even when manifest enablement hides
  // or disables a command, because extensions can invoke commands directly.
  if (command.requiresWorkspaceTrust) enforceWorkspaceTrust(command.id);

  switch (command.id) {
    case "memoryos.showContractIdentities":
      return adapter.showContractIdentities();
    case "memoryos.preparePolicyArtifact":
      return adapter.preparePolicyArtifact(uri);
    case "memoryos.evaluatePolicyArtifact":
      return adapter.evaluatePolicyArtifact(uri);
    case "memoryos.verifyEvaluationIdentity":
      return adapter.verifyEvaluationIdentity(uri);
    case "memoryos.verifyPolicyOutcome":
      return adapter.verifyPolicyOutcome(uri);
  }
}

export function registerMemoryOSCommands(
  context: vscode.ExtensionContext,
  adapter: ExtensionCommandAdapter,
): readonly vscode.Disposable[] {
  const registrations = MEMORYOS_PUBLIC_COMMANDS.map((command) =>
    vscode.commands.registerCommand(
      command.id,
      (uri?: vscode.Uri) => invokeMemoryOSCommand(command, adapter, uri),
    ));
  context.subscriptions.push(...registrations);
  return Object.freeze(registrations);
}
