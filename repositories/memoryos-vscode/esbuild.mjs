import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));

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
    entryPoints: ["./src/extension.ts"],
    outfile: resolve(packageRoot, "out", "extension.cjs"),
    external: ["vscode"],
  }),
  build({
    ...shared,
    absWorkingDir: packageRoot,
    entryPoints: ["./src/runtime/cli-worker.ts"],
    outfile: resolve(packageRoot, "out", "cli-worker.cjs"),
    packages: "external",
  }),
]);
