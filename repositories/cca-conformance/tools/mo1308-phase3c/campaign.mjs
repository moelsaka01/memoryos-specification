#!/usr/bin/env node
// MO-1308 Phase 3C campaign: security and abuse corpus.
//   node campaign.mjs rehearse [--out DIR] [--number N] [--commit SHA]   non-certifying, platform-neutral cases run anywhere
//   node campaign.mjs seal|run|close --generation phase3c ...            the certifying one-shot, on the reference host
// Cases declared host-only are skipped in a rehearsal and refused (SKIP_NOT_ALLOWED) in a certifying generation.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../mo1308-phase3/lib/campaign-driver.mjs';
import { walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { hostOnly, impls, makeEnv } from './cases.mjs';
import { SHA_REVIEW_FILE } from './cases-sha.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const streamToolPaths = (root) => walkRecords(here).map((row) => path.relative(root, path.join(here, row.path)).split(path.sep).join('/'));
process.exitCode = await main({ argv: process.argv.slice(2), stream: '3C', impls, hostOnly, makeEnv, streamToolPaths, inputPaths: [SHA_REVIEW_FILE], moduleUrl: import.meta.url });
