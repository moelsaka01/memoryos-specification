#!/usr/bin/env node
// MO-1308 Phase 3A campaign: all 108 cases (the platform-neutral part and the Windows harness).
//   node campaign.mjs rehearse [--out DIR] [--number N]                  non-certifying; records evidence/mo1308/phase3a-rehearsal-rN
//   node campaign.mjs seal --generation phase3a --review FILE            the certifying seal (one-shot)
//   node campaign.mjs run --generation phase3a --segment main1|main2|ceiling
//   node campaign.mjs close --generation phase3a
//   node campaign.mjs cleanup --generation ID                            removes the generation's work root (links first, never outside the scratch area)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../mo1308-phase3/lib/campaign-driver.mjs';
import { walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { repositoryRoot } from '../mo1308-phase3/lib/git.mjs';
import { hostOnly, impls } from './cases.mjs';
import { GATE_INPUTS } from './cases-host.mjs';
import { SCRATCH, makeEnv } from './env.mjs';
import { removeTree } from './win.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const streamToolPaths = (root) => walkRecords(here).map((row) => path.relative(root, path.join(here, row.path)).split(path.sep).join('/'));
if (process.argv[2] === 'cleanup') {
  const index = process.argv.indexOf('--generation');
  const generation = index === -1 ? null : process.argv[index + 1];
  if (generation === null || !/^[a-z0-9-]+$/u.test(generation)) { console.error('cleanup needs --generation ID'); process.exit(2); }
  const scratch = path.join(repositoryRoot(here), SCRATCH);
  for (const name of [generation, `${generation}-sentinel`]) removeTree(scratch, path.join(scratch, name));
  console.log(JSON.stringify({ cleaned: generation, remaining: fs.existsSync(scratch) ? fs.readdirSync(scratch) : [] }));
} else {
  process.exitCode = await main({ argv: process.argv.slice(2), stream: '3A', impls, hostOnly, makeEnv, streamToolPaths, inputPaths: [...GATE_INPUTS], moduleUrl: import.meta.url });
}
