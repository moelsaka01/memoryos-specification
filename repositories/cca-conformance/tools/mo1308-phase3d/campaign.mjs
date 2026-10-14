#!/usr/bin/env node
// MO-1308 Phase 3D campaign: final integration (the validator run).
//   node campaign.mjs rehearse [--out DIR] [--number N] [--commit SHA] [--a32-receipt F] [--regression F] [--evidence-root D]
//   node campaign.mjs seal|run|close --generation phase3d ...    the certifying validator run after BF
// A rehearsal is non-certifying and is rejected as an accepted input by this very validator.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../mo1308-phase3/lib/campaign-driver.mjs';
import { walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { hostOnly, impls, makeEnv } from './cases.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const streamToolPaths = (root) => walkRecords(here).map((row) => path.relative(root, path.join(here, row.path)).split(path.sep).join('/'));
process.exitCode = await main({ argv: process.argv.slice(2), stream: '3D', impls, hostOnly, makeEnv, streamToolPaths, moduleUrl: import.meta.url });
