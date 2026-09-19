import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { posix } from "node:path";

const ENTRY = "memoryos-entry";
const NAMESPACE = "memoryos-closed-source";
const PORTABLE_SOURCE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;

function fail(message) {
  throw new Error(`closed esbuild source resolver: ${message}`);
}

function portablePath(path, label) {
  if (typeof path !== "string" || !PORTABLE_SOURCE_PATH.test(path)
      || posix.isAbsolute(path) || path === "." || path === ".."
      || path.startsWith("../") || path.includes("/../")) {
    fail(`${label} is not a closed portable path: ${path}`);
  }
  return path;
}

function resolvedImport(importer, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    fail(`unexpected package import: ${specifier}`);
  }
  const joined = posix.normalize(posix.join(posix.dirname(importer), specifier));
  const source = joined.endsWith(".js") ? `${joined.slice(0, -3)}.ts` : joined;
  return portablePath(source, "resolved import");
}

function assertInside(realRoot, path) {
  const child = relative(realRoot, path);
  const parentPrefix = process.platform === "win32" ? "..\\" : "../";
  if (child === "" || (!isAbsolute(child) && child !== ".." && !child.startsWith(parentPrefix))) {
    return;
  }
  fail(`source escapes its closed root: ${path}`);
}

export async function createClosedSourceResolver({ entryPath, sourceRoot }) {
  const entry = portablePath(entryPath.replaceAll("\\", "/"), "entry path");
  const root = await realpath(sourceRoot);
  return {
    name: "memoryos-closed-source-resolver",
    setup(context) {
      context.onResolve({ filter: /^memoryos-entry$/ }, () => ({
        namespace: NAMESPACE,
        path: entry,
      }));
      context.onResolve({ filter: /^\.{1,2}\//, namespace: NAMESPACE }, (arguments_) => ({
        namespace: NAMESPACE,
        path: resolvedImport(arguments_.importer, arguments_.path),
      }));
      context.onResolve({ filter: /.*/, namespace: NAMESPACE }, (arguments_) => {
        if (arguments_.path === "vscode" || arguments_.path.startsWith("node:")) {
          return { external: true, path: arguments_.path };
        }
        fail(`unexpected import: ${arguments_.path}`);
      });
      context.onLoad({ filter: /.*/, namespace: NAMESPACE }, async (arguments_) => {
        const path = resolve(root, ...portablePath(arguments_.path, "source path").split("/"));
        const metadata = await lstat(path);
        if (!metadata.isFile() || metadata.isSymbolicLink()) {
          fail(`source is not a regular non-symlink file: ${arguments_.path}`);
        }
        const actualPath = await realpath(path);
        assertInside(root, actualPath);
        return {
          contents: await readFile(actualPath, "utf8"),
          loader: "ts",
        };
      });
    },
  };
}

export const CLOSED_SOURCE_ENTRY = ENTRY;
