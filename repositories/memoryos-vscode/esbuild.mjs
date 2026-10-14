import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLOSED_SOURCE_ENTRY,
  createClosedSourceResolver,
} from "./scripts/esbuild-closed-source.mjs";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(packageRoot, "src");

const shared = Object.freeze({
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  minify: false,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});

await Promise.all([
  build({
    ...shared,
    absWorkingDir: packageRoot,
    entryPoints: [CLOSED_SOURCE_ENTRY],
    outfile: resolve(packageRoot, "out", "extension.cjs"),
    plugins: [await createClosedSourceResolver({ entryPath: "extension.ts", sourceRoot })],
  }),
  build({
    ...shared,
    absWorkingDir: packageRoot,
    entryPoints: [CLOSED_SOURCE_ENTRY],
    outfile: resolve(packageRoot, "out", "cli-worker.cjs"),
    plugins: [await createClosedSourceResolver({
      entryPath: "runtime/cli-worker.ts",
      sourceRoot,
    })],
  }),
]);
