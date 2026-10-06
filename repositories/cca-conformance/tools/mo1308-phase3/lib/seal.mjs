// MO-1308 Phase 3 shared library: sealing a generation. The seal binds, before anything runs, the protocol document and its
// approval status, the case inventory, the candidate identity, the corpus, the tools, any extra inputs and the harness review.
// Nothing bound can change between seal and close: every later phase of the runner re-hashes the bound files.
import fs from 'node:fs';
import path from 'node:path';
import { EXECUTION_RULES, GENERATION_ID, SEAL_SHAPE, validateReview, validate } from './receipts.mjs';
import { check } from './shape.mjs';
import { allCases, streamOf, validateInventory, inventoryBytes } from './inventory.mjs';
import { recordFile, sha256Hex, walkRecords } from './hashing.mjs';
import { validateDisposition } from './classification.mjs';
import { exists, readJson, writeOnce } from './evidence.mjs';

export class CampaignError extends Error {
  constructor(code, message) { super(message ?? code); this.name = 'CampaignError'; this.code = code; }
}
export const fail = (code, message) => { throw new CampaignError(code, message); };

export const EVIDENCE_ROOT = 'repositories/cca-conformance/evidence/mo1308';
export const SHARED_TOOLS_ROOT = 'repositories/cca-conformance/tools/mo1308-phase3';

// Every file of the shared tooling, repository-relative and sorted: a stream binds these plus its own harness files.
export function sharedToolPaths(root) {
  return walkRecords(path.join(root, ...SHARED_TOOLS_ROOT.split('/'))).map((row) => `${SHARED_TOOLS_ROOT}/${row.path}`);
}

// `Status: **...**` of the protocol document; a certifying seal needs a status that starts with APPROVED.
export function protocolStatus(protocolBytes) {
  const match = /^Status: \*\*(.+?)\*\*/m.exec(protocolBytes.toString('utf8'));
  return match === null ? 'UNKNOWN' : match[1];
}
export const isApprovedStatus = (status) => /^APPROVED\b/.test(status);

export function parseGeneration(id) {
  if (!GENERATION_ID.test(id)) fail('GENERATION_ID', `generation id ${id} does not match the protocol`);
  const rehearsal = /-rehearsal-r(\d+)$/.exec(id);
  const rerun = /-g(\d+)$/.exec(id);
  return {
    rehearsal: rehearsal !== null,
    ordinal: rehearsal !== null ? 0 : rerun !== null ? Number(rerun[1]) : 1,
    stream: `3${id[6].toUpperCase()}`,
  };
}

export function checkPlacement(root, evidenceDir, generationId) {
  const expected = path.join(root, ...EVIDENCE_ROOT.split('/'), generationId);
  if (path.resolve(evidenceDir) !== path.resolve(expected)) {
    fail('EVIDENCE_PLACEMENT', `evidence for ${generationId} belongs at ${EVIDENCE_ROOT}/${generationId}`);
  }
}

const requireFile = (root, relative) => {
  try { return recordFile(root, relative); } catch { return fail('BOUND_FILE_MISSING', `${relative} cannot be bound`); }
};

export function sealGeneration(options) {
  const {
    root, stream, generation: generationId, certifying, protocolPath, inventoryPath, candidateIdentityPath,
    corpusManifestPath = null, toolPaths, inputPaths = [], harnessReviewPath = null, extended = {}, previous = null,
    guardOverridesMs = {}, budgetOverridesMs = {},
    evidenceDir, enforcePlacement = true, now = () => new Date(),
  } = options;
  const parsed = parseGeneration(generationId);
  if (parsed.stream !== stream) fail('GENERATION_ID', 'generation id and stream disagree');
  if (parsed.rehearsal === certifying) fail('GENERATION_ID', 'a rehearsal generation must be non-certifying, and only a rehearsal');
  if (certifying && (Object.keys(guardOverridesMs).length > 0 || Object.keys(budgetOverridesMs).length > 0)) {
    fail('OVERRIDE_NOT_ALLOWED', 'guard and budget overrides exist for rehearsals and tests only');
  }
  if (enforcePlacement) checkPlacement(root, evidenceDir, generationId);
  if (fs.existsSync(evidenceDir) && fs.readdirSync(evidenceDir).length > 0) fail('EVIDENCE_NOT_EMPTY', 'the evidence directory already has content');

  const protocol = requireFile(root, protocolPath);
  const status = protocolStatus(fs.readFileSync(path.join(root, protocolPath)));
  if (certifying && !isApprovedStatus(status)) fail('PROTOCOL_NOT_APPROVED', `the protocol status is "${status}"; a certifying seal needs the approved Amendment A8`);

  const inventoryRecord = requireFile(root, inventoryPath);
  const inventory = JSON.parse(fs.readFileSync(path.join(root, inventoryPath), 'utf8'));
  const problems = validateInventory(inventory);
  if (problems.length > 0) fail('INVENTORY_INVALID', problems[0]);
  if (!inventoryBytes(inventory).equals(fs.readFileSync(path.join(root, inventoryPath)))) fail('INVENTORY_NOT_CANONICAL', 'inventory bytes are not the stable form');

  const candidateRecord = requireFile(root, candidateIdentityPath);
  const candidate = JSON.parse(fs.readFileSync(path.join(root, candidateIdentityPath), 'utf8'));
  if (candidate.kind !== 'MO1308Phase3CandidateIdentity') fail('CANDIDATE_INVALID', 'not a candidate identity record');

  let corpus = null;
  if (corpusManifestPath !== null) {
    const record = requireFile(root, corpusManifestPath);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, corpusManifestPath), 'utf8'));
    corpus = { manifestPath: record.path, manifestSha256: record.sha256, corpusDigest: manifest.corpusDigest };
  }

  let harnessReview = null;
  if (harnessReviewPath !== null) {
    harnessReview = requireFile(root, harnessReviewPath);
    const reviewProblems = validateReview(JSON.parse(fs.readFileSync(path.join(root, harnessReviewPath), 'utf8')));
    if (reviewProblems.length > 0) fail('REVIEW_INVALID', reviewProblems[0]);
    const review = JSON.parse(fs.readFileSync(path.join(root, harnessReviewPath), 'utf8'));
    if (review.conclusion !== 'NO_BLOCKING_FINDINGS') fail('REVIEW_BLOCKING', 'the harness review has open blocking findings');
  } else if (certifying) fail('REVIEW_REQUIRED', 'a certifying seal needs a recorded harness review');

  let supersedes = null;
  if (parsed.ordinal > 1) {
    if (previous === null) fail('SUPERSEDES_REQUIRED', 'a rerun generation must name the failed generation and its disposition');
    supersedes = verifySupersedes(root, previous, stream);
  } else if (previous !== null) fail('SUPERSEDES_UNEXPECTED', 'only a rerun generation supersedes another');

  const streamDef = streamOf(inventory, stream);
  const cases = new Map(allCases(inventory).filter((item) => item.stream === stream).map((item) => [item.id, item]));
  const segments = streamDef.segments.map((segment) => {
    const longer = extended[segment.id];
    return {
      id: segment.id,
      budgetMs: budgetOverridesMs[segment.id] ?? (longer === undefined ? segment.budgetMinutes : segment.extendedMinutes) * 60000,
      extended: longer === undefined ? null : { rationale: longer },
      steps: streamDef.steps.filter((step) => step.segment === segment.id).map((step) => step.id),
    };
  });
  for (const id of Object.keys(extended)) if (!streamDef.segments.some((segment) => segment.id === id)) fail('EXTENDED_UNKNOWN_SEGMENT', id);

  const seal = {
    kind: 'MO1308Phase3Seal', version: '1.0.0', stream,
    generation: { id: generationId, ordinal: parsed.ordinal, supersedes },
    certifying,
    protocol: { path: protocol.path, sha256: protocol.sha256, status },
    inventory: { path: inventoryRecord.path, sha256: inventoryRecord.sha256 },
    candidate: {
      identityPath: candidateRecord.path, identitySha256: candidateRecord.sha256,
      baseCommit: candidate.baseCommit, productionTreeDigest: candidate.productionTreeDigest,
    },
    corpus, harnessReview,
    tools: toolPaths.map((relative) => requireFile(root, relative)).sort((a, b) => (a.path < b.path ? -1 : 1)),
    inputs: inputPaths.map((relative) => requireFile(root, relative)).sort((a, b) => (a.path < b.path ? -1 : 1)),
    segments,
    steps: streamDef.steps.map((step) => ({
      id: step.id, segment: step.segment, guardMs: guardOverridesMs[step.id] ?? step.guardMinutes * 60000,
      cases: step.cases.map((item) => ({
        id: item.id, mandatory: cases.get(item.id).mandatory, mode: cases.get(item.id).mode, qualifications: [...cases.get(item.id).qualifications],
      })),
    })),
    execution: { ...EXECUTION_RULES },
    sealedAt: now().toISOString(),
  };
  const shapeProblems = check(SEAL_SHAPE, seal);
  if (shapeProblems.length > 0) fail('SEAL_INVALID', shapeProblems[0]);
  const written = writeOnce(evidenceDir, 'seal.json', seal);
  return { seal, sealSha256: written.sha256 };
}

// Re-hashes every bound file. Returns the list of mismatches (empty when nothing changed since the seal).
export function verifyBindings(root, seal) {
  const problems = [];
  const bound = [
    seal.protocol, seal.inventory,
    { path: seal.candidate.identityPath, sha256: seal.candidate.identitySha256 },
    ...(seal.corpus === null ? [] : [{ path: seal.corpus.manifestPath, sha256: seal.corpus.manifestSha256 }]),
    ...(seal.harnessReview === null ? [] : [seal.harnessReview]),
    ...seal.tools, ...seal.inputs,
  ];
  for (const item of bound) {
    try {
      if (recordFile(root, item.path).sha256 !== item.sha256) problems.push(`${item.path}: changed since the seal`);
    } catch { problems.push(`${item.path}: missing`); }
  }
  return problems;
}

export function loadSeal(evidenceDir) {
  if (!exists(evidenceDir, 'seal.json')) fail('NOT_SEALED', 'no seal.json');
  const seal = readJson(evidenceDir, 'seal.json');
  const problems = validate('seal', seal);
  if (problems.length > 0) fail('SEAL_INVALID', problems[0]);
  return seal;
}

// A rerun is allowed only after a preserved failed generation with a valid disposition (D5: diagnose before rerun).
function verifySupersedes(root, previous, stream) {
  const { evidenceDir, dispositionPath } = previous;
  const priorSeal = loadSeal(evidenceDir);
  if (priorSeal.stream !== stream) fail('SUPERSEDES_STREAM', 'the failed generation belongs to another stream');
  if (!exists(evidenceDir, 'evidence-seal.json') || !exists(evidenceDir, 'stream-receipt.json')) fail('SUPERSEDES_OPEN', 'the failed generation is not closed');
  const receipt = readJson(evidenceDir, 'stream-receipt.json');
  if (!['FAILED_PRESERVED', 'ESCALATED_PRESERVED'].includes(receipt.result)) fail('SUPERSEDES_NOT_FAILED', `the generation ended ${receipt.result}`);
  const disposition = JSON.parse(fs.readFileSync(dispositionPath, 'utf8'));
  const problems = validateDisposition(disposition);
  if (problems.length > 0) fail('DISPOSITION_INVALID', problems[0]);
  const evidenceSealSha256 = sha256Hex(fs.readFileSync(path.join(evidenceDir, 'evidence-seal.json')));
  if (disposition.evidenceSealSha256 !== evidenceSealSha256 || disposition.generation !== priorSeal.generation.id) {
    fail('DISPOSITION_MISMATCH', 'the disposition is about a different generation or seal');
  }
  if (disposition.nextAction !== 'NEW_GENERATION') fail('DISPOSITION_NO_RERUN', `the disposition's next action is ${disposition.nextAction}`);
  // A8 decision 5: an escalation (for example more than 1 of 10 F7 runs with a staging EPERM) stops the generation, and a
  // rerun needs the owner's approval reference whatever the failure class.
  if (receipt.result === 'ESCALATED_PRESERVED' && disposition.ownerApprovalReference === null) {
    fail('ESCALATION_NEEDS_OWNER', 'a rerun after an escalation needs an owner approval reference');
  }
  if (disposition.rerunOrdinal !== priorSeal.generation.ordinal + 1) fail('DISPOSITION_ORDINAL', 'the rerun ordinal does not follow the failed generation');
  return {
    id: priorSeal.generation.id,
    evidenceSealSha256,
    dispositionSha256: sha256Hex(fs.readFileSync(dispositionPath)),
  };
}
