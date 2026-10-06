// MO-1308 Phase 3 shared library: the campaign driver. A stream supplies an implementation per case (`impls`), declares the
// cases that can only run on the Windows host (`hostOnly`), and gets the executors, the rehearsal, and the seal / run / close
// commands. The driver never contains product or platform logic: it wires the inventory to the runner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeGeneration, runSegment, verifyEvidence } from './runner.mjs';
import { CampaignError, EVIDENCE_ROOT, sealGeneration, sharedToolPaths } from './seal.mjs';
import { allCases, loadInventory, streamOf, INVENTORY_FILE } from './inventory.mjs';
import { repositoryRoot } from './git.mjs';

export const PROTOCOL_FILE = 'docs/mo1308-phase3-protocol.md';
export const IDENTITY_FILE = 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json';
export const CORPUS_FILE = 'repositories/cca-conformance/mo1308-phase3-corpus-manifest.json';

// Executors for every step of a stream: each case runs its implementation, or is skipped (rehearsal only) when declared
// host-only. A case with neither an implementation nor a declaration is a harness defect, never a silent pass.
export function buildExecutors({ inventory, stream, impls, hostOnly = {}, env }) {
  const executors = {};
  for (const step of streamOf(inventory, stream).steps) {
    executors[step.id] = async (ctx) => {
      for (const item of step.cases) {
        await ctx.runCase(item.id, async (handle) => {
          if (hostOnly[item.id] !== undefined) return handle.skip(hostOnly[item.id]);
          const impl = impls[item.id];
          if (impl === undefined) throw new CampaignError('NOT_IMPLEMENTED', `${item.id} has no implementation and is not declared host-only`);
          return impl(handle, env);
        });
      }
    };
  }
  return executors;
}

// Consistency of a stream definition with the inventory: every case implemented or declared, nothing extra, nothing both.
export function checkDefinition({ inventory, stream, impls, hostOnly = {} }) {
  const ids = new Set(allCases(inventory).filter((item) => item.stream === stream).map((item) => item.id));
  const problems = [];
  for (const id of ids) {
    const implemented = impls[id] !== undefined;
    const declared = hostOnly[id] !== undefined;
    if (!implemented && !declared) problems.push(`${id}: neither implemented nor declared host-only`);
    if (implemented && declared) problems.push(`${id}: both implemented and declared host-only`);
  }
  for (const id of [...Object.keys(impls), ...Object.keys(hostOnly)]) if (!ids.has(id)) problems.push(`${id}: not a case of ${stream}`);
  return problems;
}

export const streamLetter = (stream) => stream[1].toLowerCase();

// Seals, runs (every segment in order, until one is not PASS), closes and re-verifies a non-certifying rehearsal.
export async function rehearse({ root, stream, number = 1, evidenceDir, impls, hostOnly = {}, env, toolPaths, inputPaths = [], now = () => new Date() }) {
  const inventory = loadInventory(path.join(root, INVENTORY_FILE));
  const problems = checkDefinition({ inventory, stream, impls, hostOnly });
  if (problems.length > 0) throw new CampaignError('DEFINITION_INVALID', problems[0]);
  const generation = `phase3${streamLetter(stream)}-rehearsal-r${number}`;
  const directory = evidenceDir ?? fs.mkdtempSync(path.join(os.tmpdir(), `mo1308-${generation}-`));
  sealGeneration({
    root, stream, generation, certifying: false, protocolPath: PROTOCOL_FILE, inventoryPath: INVENTORY_FILE,
    candidateIdentityPath: IDENTITY_FILE, corpusManifestPath: stream === '3A' || stream === '3C' ? CORPUS_FILE : null,
    toolPaths, inputPaths, evidenceDir: directory, enforcePlacement: false, now,
  });
  const executors = buildExecutors({ inventory, stream, impls, hostOnly, env });
  const outcomes = [];
  for (const segment of streamOf(inventory, stream).segments) {
    const outcome = await runSegment({ root, evidenceDir: directory, segmentId: segment.id, executors, now });
    outcomes.push({ segment: segment.id, ...outcome });
    if (outcome.result !== 'PASS') break;
  }
  const receipt = closeGeneration({ root, evidenceDir: directory, inventory, now });
  const verification = verifyEvidence({ root, evidenceDir: directory, inventory });
  return { receipt, evidenceDir: directory, outcomes, summary: summarize(inventory, directory, receipt), problems: verification.problems };
}

// Plain-language summary of a closed generation: executed and passing, failing, and skipped (declared host-only).
export function summarize(inventory, evidenceDir, receipt) {
  const rows = [];
  for (const step of streamOf(inventory, receipt.stream).steps) {
    const file = path.join(evidenceDir, 'steps', `${step.id}.json`);
    if (fs.existsSync(file)) rows.push(...JSON.parse(fs.readFileSync(file, 'utf8')).cases);
  }
  const by = (predicate) => rows.filter(predicate).map((row) => row.id);
  return {
    stream: receipt.stream, result: receipt.result, total: rows.length,
    executedPass: by((row) => row.result === 'PASS').length,
    failed: by((row) => row.result === 'FAIL'),
    escalated: by((row) => row.result === 'ESCALATE'),
    skippedHostOnly: by((row) => row.result === 'NOT_RUN' && row.observed?.skipped !== undefined),
    notRun: by((row) => row.result === 'NOT_RUN' && row.observed?.skipped === undefined),
    outcomes: Object.fromEntries(rows.filter((row) => row.outcome !== null).map((row) => [row.id, row.outcome])),
  };
}

// The command line of a stream: `rehearse [--out DIR] [--number N]`, and for the host `seal`, `run`, `close`.
export async function main({ argv, stream, impls, hostOnly, makeEnv, streamToolPaths, inputPaths = [], moduleUrl }) {
  const here = path.dirname(fileURLToPath(moduleUrl));
  const root = repositoryRoot(here);
  const [command, ...rest] = argv;
  const option = (name) => { const index = rest.indexOf(name); return index === -1 ? null : rest[index + 1] ?? null; };
  const toolPaths = [...sharedToolPaths(root), ...streamToolPaths(root)].sort();
  const inventory = loadInventory(path.join(root, INVENTORY_FILE));
  const env = await makeEnv({ root, option });
  if (command === 'rehearse') {
    const result = await rehearse({ root, stream, number: Number(option('--number') ?? 1), evidenceDir: option('--out') === null ? undefined : path.resolve(option('--out')), impls, hostOnly, env, toolPaths, inputPaths });
    console.log(JSON.stringify({ ...result.summary, evidenceDir: result.evidenceDir, outcomes: result.outcomes, verification: result.problems }, null, 2));
    return result.receipt.result === 'REHEARSAL_COMPLETED' || result.receipt.result === 'REHEARSAL_PARTIAL' ? 0 : 1;
  }
  const generation = option('--generation');
  if (generation === null) throw new CampaignError('USAGE', '--generation is required');
  const evidenceDir = path.join(root, ...EVIDENCE_ROOT.split('/'), generation);
  if (command === 'seal') {
    const review = option('--review');
    const previous = option('--previous-evidence') === null ? null : { evidenceDir: path.resolve(option('--previous-evidence')), dispositionPath: path.resolve(option('--disposition')) };
    sealGeneration({
      root, stream, generation, certifying: !generation.includes('rehearsal'), protocolPath: PROTOCOL_FILE, inventoryPath: INVENTORY_FILE,
      candidateIdentityPath: IDENTITY_FILE, corpusManifestPath: stream === '3A' || stream === '3C' ? CORPUS_FILE : null,
      toolPaths, inputPaths, harnessReviewPath: review, previous, evidenceDir,
    });
    console.log(JSON.stringify({ sealed: generation }));
    return 0;
  }
  if (command === 'run') {
    const segment = option('--segment');
    const problems = checkDefinition({ inventory, stream, impls, hostOnly });
    if (problems.length > 0) throw new CampaignError('DEFINITION_INVALID', problems[0]);
    const outcome = await runSegment({ root, evidenceDir, segmentId: segment, executors: buildExecutors({ inventory, stream, impls, hostOnly, env }) });
    console.log(JSON.stringify({ segment, ...outcome }));
    return outcome.result === 'PASS' ? 0 : 1;
  }
  if (command === 'close') {
    const receipt = closeGeneration({ root, evidenceDir, inventory });
    console.log(JSON.stringify({ generation, result: receipt.result, outcome: receipt.outcome }));
    return receipt.result === 'ACCEPTED' ? 0 : 1;
  }
  console.error(`usage: campaign.mjs rehearse [--out DIR] [--number N] | seal --generation ID [--review FILE] | run --generation ID --segment ID | close --generation ID`);
  return 2;
}
