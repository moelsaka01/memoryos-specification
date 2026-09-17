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

/** Phase 1 boundary; the verified runtime implementation is injected here. */
export interface ExtensionCommandAdapter {
  showContractIdentities(): Promise<unknown>;
}

function enforceWorkspaceTrust(commandId: MemoryOSPublicCommandId): void {
  if (vscode.workspace.isTrusted) return;
  throw new MemoryOSAdapterError(
    MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKSPACE_UNTRUSTED,
    `${commandId} requires a trusted workspace.`,
  );
}

function deferredInput(commandId: MemoryOSPublicCommandId): never {
  throw new MemoryOSAdapterError(
    MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.INPUT_REQUIRED,
    `${commandId} requires explicit saved local-file input selection.`,
  );
}

async function invokeCommand(
  command: MemoryOSPublicCommand,
  adapter: ExtensionCommandAdapter,
): Promise<unknown> {
  // Handler-level enforcement is mandatory even when manifest enablement hides
  // or disables a command, because extensions can invoke commands directly.
  if (command.requiresWorkspaceTrust) enforceWorkspaceTrust(command.id);

  switch (command.id) {
    case "memoryos.showContractIdentities":
      return adapter.showContractIdentities();
    case "memoryos.preparePolicyArtifact":
    case "memoryos.evaluatePolicyArtifact":
    case "memoryos.verifyEvaluationIdentity":
    case "memoryos.verifyPolicyOutcome":
      return deferredInput(command.id);
  }
}

export function registerMemoryOSCommands(
  context: vscode.ExtensionContext,
  adapter: ExtensionCommandAdapter,
): readonly vscode.Disposable[] {
  const registrations = MEMORYOS_PUBLIC_COMMANDS.map((command) =>
    vscode.commands.registerCommand(command.id, () => invokeCommand(command, adapter)));
  context.subscriptions.push(...registrations);
  return Object.freeze(registrations);
}
