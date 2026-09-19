#!/usr/bin/env node

import { spawn } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TEST_HOST_ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TEST_HOST_ROOT, "..");
export const HOST_RUNNER_BUNDLE = resolve(PACKAGE_ROOT, "test-host", "out", "runner.cjs");

export async function buildHostRunner() {
  await mkdir(dirname(HOST_RUNNER_BUNDLE), { recursive: true });
  const compiler = resolve(PACKAGE_ROOT, "node_modules", "typescript", "bin", "tsc");
  const generated = resolve(PACKAGE_ROOT, "test-host", "out", "runner.js");
  const argumentsList = [
    "--ignoreConfig",
    "--target", "ES2023",
    "--module", "NodeNext",
    "--moduleResolution", "NodeNext",
    "--esModuleInterop",
    "--types", "node,vscode",
    "--outDir", resolve(PACKAGE_ROOT, "test-host", "out"),
    "--rootDir", TEST_HOST_ROOT,
    "--skipLibCheck",
    resolve(TEST_HOST_ROOT, "runner.ts"),
  ];
  await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, [compiler, ...argumentsList], {
      cwd: PACKAGE_ROOT,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", rejectBuild);
    child.once("exit", (code) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`Private host-runner TypeScript build exited ${code}.`));
    });
  });
  await copyFile(generated, HOST_RUNNER_BUNDLE);
  await rm(generated, { force: true });
  process.stdout.write(`Built ${HOST_RUNNER_BUNDLE}.\n`);
  return HOST_RUNNER_BUNDLE;
}

if (process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildHostRunner();
}
