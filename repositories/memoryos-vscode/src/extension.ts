import { join } from "node:path";

import type * as vscode from "vscode";

import {
  type ExtensionCommandAdapter,
  registerMemoryOSCommands,
} from "./commands.js";
import { createCliAdapter, type MemoryOSCliAdapter } from "./runtime/cli-adapter.js";

let cliAdapter: MemoryOSCliAdapter | undefined;

export function activate(context: vscode.ExtensionContext): void {
  cliAdapter = createCliAdapter({
    extensionRoot: context.extensionPath,
    workerScriptPath: join(context.extensionPath, "out", "cli-worker.cjs"),
  });
  const commandAdapter: ExtensionCommandAdapter = Object.freeze({
    async showContractIdentities(): Promise<unknown> {
      return cliAdapter?.preflight();
    },
  });
  context.subscriptions.push({
    dispose(): void {
      void cliAdapter?.dispose();
      cliAdapter = undefined;
    },
  });
  registerMemoryOSCommands(context, commandAdapter);
}

export async function deactivate(): Promise<void> {
  const adapter = cliAdapter;
  cliAdapter = undefined;
  await adapter?.dispose();
}
