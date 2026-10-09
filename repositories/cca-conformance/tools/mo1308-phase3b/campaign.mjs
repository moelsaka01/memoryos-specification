#!/usr/bin/env node
// MO-1308 Phase 3B campaign: closure and supply audit.
//   node campaign.mjs rehearse [--out DIR] [--number N] [--commit SHA]   non-certifying, runs anywhere (the cloud included)
//   node campaign.mjs seal|run|close --generation phase3b ...            the certifying one-shot, on the reference host
// The audited commit is --commit (default HEAD). The tags must be fetched before the run: the audit itself uses no network.
import path from 'node:path';
import { main } from '../mo1308-phase3/lib/campaign-driver.mjs';
import { walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { impls, makeEnv } from './cases.mjs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const streamToolPaths = (root) => walkRecords(here).map((row) => path.relative(root, path.join(here, row.path)).split(path.sep).join('/'));
process.exitCode = await main({ argv: process.argv.slice(2), stream: '3B', impls, hostOnly: {}, makeEnv, streamToolPaths, moduleUrl: import.meta.url });
