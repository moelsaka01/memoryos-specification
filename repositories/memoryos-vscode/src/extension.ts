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
let productDisposal: Promise<void> | undefined;

function disposeActiveProduct(): Promise<void> {
  if (productDisposal !== undefined) return productDisposal;
  const activeProduct = product;
  product = undefined;
  productDisposal = activeProduct?.dispose() ?? Promise.resolve();
  return productDisposal;
}

export function activate(context: vscode.ExtensionContext): void {
  const cliAdapter = createCliAdapter({
    extensionRoot: context.extensionPath,
    workerScriptPath: join(context.extensionPath, "out", "cli-worker.cjs"),
  });
  product = createMemoryOSVSCodeProduct(cliAdapter);
  productDisposal = undefined;
  context.subscriptions.push({
    dispose(): void {
      void disposeActiveProduct().catch(() => undefined);
    },
  });
  registerMemoryOSCommands(context, product);
}

export async function deactivate(): Promise<void> {
  await disposeActiveProduct();
}
