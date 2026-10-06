#!/usr/bin/env node
// MO-1308 Phase 3A campaign (platform-neutral part). The Windows harness (Step 3) adds the remaining cases.
//   node campaign.mjs rehearse [--out DIR] [--number N] [--commit SHA]   non-certifying; host-only cases are skipped visibly
//   node campaign.mjs seal|run|close --generation phase3a ...            the certifying one-shot on the reference host
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../mo1308-phase3/lib/campaign-driver.mjs';
import { walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { hostOnly, impls, makeEnv } from './cases.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const streamToolPaths = (root) => walkRecords(here).map((row) => path.relative(root, path.join(here, row.path)).split(path.sep).join('/'));
process.exitCode = await main({ argv: process.argv.slice(2), stream: '3A', impls, hostOnly, makeEnv, streamToolPaths, moduleUrl: import.meta.url });
