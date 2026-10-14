#!/usr/bin/env node

import { main } from "../src/main.js";

// A standard stream that cannot be written (a closed pipe, EPIPE) is not an operation failure: what was carried out stays carried out, the
// exit code is the command's own, and nothing is printed about it (no stack, no path). Amendment A10.
for (const stream of [process.stdout, process.stderr]) stream.on("error", () => {});

process.exitCode = await main(process.argv.slice(2));
