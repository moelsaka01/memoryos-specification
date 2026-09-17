import { join } from "node:path";

import type * as vscode from "vscode";

import {
  registerMemoryOSCommands,
} from "./commands.js";
import { createCliAdapter } from "./runtime/cli-adapter.js";
import {
  createMemoryOSVSCodeProduct,
  type MemoryOSVSCodeProduct,
} from "./vscode-product.js";

let product: MemoryOSVSCodeProduct | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const cliAdapter = createCliAdapter({
    extensionRoot: context.extensionPath,
    workerScriptPath: join(context.extensionPath, "out", "cli-worker.cjs"),
  });
  product = createMemoryOSVSCodeProduct(cliAdapter);
  context.subscriptions.push({
    dispose(): void {
      const activeProduct = product;
      product = undefined;
      void activeProduct?.dispose();
    },
  });
  registerMemoryOSCommands(context, product);
}

export async function deactivate(): Promise<void> {
  const activeProduct = product;
  product = undefined;
  await activeProduct?.dispose();
}
