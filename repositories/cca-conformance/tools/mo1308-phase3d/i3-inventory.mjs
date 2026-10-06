#!/usr/bin/env node
// MO-1308 Phase 3D: the I3 inventory builder. I3 contains the immutable accepted receipts, the inventory and the mappings; it never
// embeds the hash of the binding-only BF child that will bind it, and it never embeds its own hash. The builder is read-only
// unless --write is given (the file is created exclusively), and it refuses to describe a state the validator calls NOT_READY.
//   node i3-inventory.mjs [--root DIR] [--head REV] [--write FILE]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from '../mo1308-phase3/lib/git.mjs';
import { sha256Hex } from '../mo1308-phase3/lib/hashing.mjs';
import { stableBytes } from '../mo1308-phase3/lib/stable-json.mjs';
import { PROTOCOL_FILE } from '../mo1308-phase3/lib/campaign-driver.mjs';
import { requirementMatrix, INVENTORY_FILE } from '../mo1308-phase3/lib/inventory.mjs';
import { readOutcomes, structuralQualifications } from '../mo1308-phase3/lib/disclosure.mjs';
import { acceptedPasses, evaluate, A32_RECEIPT_FILE, CANDIDATE_IDENTITY_FILE, DISCLOSURES_FILE, FINAL_INVENTORY_FILE, REGRESSION_FILE, RELEASE_TAG } from './validate.mjs';

export const FINAL_INVENTORY_KIND = 'MO1308FinalReleaseInventory';
const REFUSING = ['3D-D1', '3D-D2', '3D-D3', '3D-D4', '3D-D5', '3D-D6', '3D-E1', '3D-E2', '3D-E3'];

export function buildI3Inventory(options) {
  const { report, context } = evaluate(options);
  const notReady = report.cases.filter((row) => REFUSING.includes(row.id) && row.status !== 'READY');
  if (notReady.length > 0) {
    const error = new Error(`the state is not ready for I3: ${notReady.map((row) => `${row.id} (${row.problems[0]})`).join('; ').slice(0, 600)}`);
    error.code = 'NOT_READY';
    throw error;
  }
  const { root, inventory, identity, generations, dispositions, a32ReceiptPath, regressionPath } = context;
  const file = (relative) => ({ path: relative, sha256: sha256Hex(fs.readFileSync(path.join(root, ...relative.split('/')))) });
  const passes = acceptedPasses({ generations });
  const outcomes = readOutcomes(generations.filter((row) => row.accepted && row.parsed.stream !== '3B').map((row) => row.directory));
  const structural = new Set(structuralQualifications(inventory));
  return {
    kind: FINAL_INVENTORY_KIND,
    version: '1.0.0',
    candidate: { baseCommit: identity.baseCommit, productionTreeDigest: identity.productionTreeDigest, identity: file(CANDIDATE_IDENTITY_FILE) },
    protocol: file(PROTOCOL_FILE),
    inventory: file(INVENTORY_FILE),
    generations: generations.map((row) => ({
      id: row.id, stream: row.parsed.stream, certifying: row.seal.certifying, result: row.receipt.result, accepted: row.accepted,
      seal: file(`${row.relative}/seal.json`), receipt: file(`${row.relative}/stream-receipt.json`), evidenceSeal: file(`${row.relative}/evidence-seal.json`),
    })),
    dispositions: [...dispositions].map(([sha256, item]) => ({ path: item.path, sha256, generation: item.value.generation })).sort((a, b) => (a.path < b.path ? -1 : 1)),
    precondition: { receipt: file(a32ReceiptPath), verdict: 'PASS' },
    regression: file(regressionPath),
    requirements: requirementMatrix(inventory).map((row) => ({ requirement: row.requirement, cases: row.cases, passingIn: row.cases.filter((id) => passes.has(id)).map((id) => ({ id, generation: passes.get(id) })) })),
    qualifications: inventory.qualifications.map((item) => ({ id: item.id, kind: structural.has(item.id) ? 'STRUCTURAL' : 'RECORDED', recorded: Object.fromEntries([...outcomes].filter(([caseId]) => inventory.streams.some((stream) => stream.steps.some((step) => step.cases.some((entry) => entry.id === caseId && entry.qualifications.includes(item.id)))))) })),
    disclosures: file(DISCLOSURES_FILE),
    release: { tag: RELEASE_TAG, created: false, pushed: false, approved: false },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const option = (name) => { const index = args.indexOf(name); return index === -1 ? null : args[index + 1] ?? null; };
  try {
    const root = path.resolve(option('--root') ?? repositoryRoot(path.dirname(fileURLToPath(import.meta.url))));
    const inventory = buildI3Inventory({ root, head: option('--head') });
    const bytes = stableBytes(inventory);
    const target = option('--write');
    if (target === null) process.stdout.write(bytes);
    else {
      const resolved = path.resolve(root, target);
      if (path.relative(root, resolved).split(path.sep).join('/') !== FINAL_INVENTORY_FILE) throw new Error(`the I3 inventory belongs at ${FINAL_INVENTORY_FILE}`);
      fs.writeFileSync(resolved, bytes, { flag: 'wx' });
      process.stdout.write(`${JSON.stringify({ written: FINAL_INVENTORY_FILE, sha256: sha256Hex(bytes) })}\n`);
    }
  } catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code ?? 'ERROR', message: String(error.message).slice(0, 700) })}\n`); process.exitCode = error.code === 'NOT_READY' ? 1 : 2; }
}
