#!/usr/bin/env node

import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { downloadAndUnzipVSCode } from "@vscode/test-electron";

const cachePath = resolve(
  process.env.MEMORYOS_VSCODE_TEST_CACHE ?? resolve(tmpdir(), "memoryos-vscode-test-cache"),
);
const executable = await downloadAndUnzipVSCode({
  cachePath,
  timeout: 30_000,
  version: "1.137.0",
});
process.stdout.write(`${executable}\n`);
