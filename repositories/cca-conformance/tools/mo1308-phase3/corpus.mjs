#!/usr/bin/env node
// MO-1308 Phase 3: the sealed shared corpus for 3A and 3C. The generator builds, from the repository's released fixtures and
// the real SDK, every byte the campaigns share: valid records of every kind, filler vectors at each member limit, ledger
// recipes with their expected heads, deterministic tamper and sampling seeds, and the canary strings of the data-class audit.
// The manifest (mo1308-phase3-corpus-manifest.json) records digests and lengths only; `corpusDigest` seals it.
//   node corpus.mjs write --out FILE     write the manifest
//   node corpus.mjs verify --file FILE   regenerate and compare (exit 1 on any difference)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from '../../../cca-studio/web/js/memoryos-sdk.js';
import { MEMORYOS_HISTORY_LIMITS, RECORD_MEMBER_RULES } from '../../../cca-studio/web/js/memoryos-history-contract.js';
import * as corpus from '../../../memoryos-cli/tests/support/history-corpus.mjs';
import { digestOf, digestOfJson } from './lib/hashing.mjs';
import { stableBytes } from './lib/stable-json.mjs';

export const CORPUS_ID = 'MO1308-PHASE3-CORPUS-1';
export const CORPUS_WORKSPACE = corpus.CORPUS_WORKSPACE;
const READINESS = ['ready', 'qualified', 'not-ready', 'could-not-evaluate'];
const DECISIONS = ['approve', 'reject', 'defer'];

// ---- records ----

const sortedMembers = (members) => [...members].sort((a, b) => (a.name < b.name ? -1 : 1));

// Every valid record, in a fixed order. `id` names it in recipes and in campaign cases.
export function corpusRecords() {
  const records = [];
  const add = (id, record) => records.push({ id, recordKind: record.recordKind, members: sortedMembers(record.members) });
  add('mip-reference', { recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: corpus.mipBytes() }] });
  for (let index = 0; index < 10; index += 1) add(`checkpoint-c${String(index).padStart(2, '0')}`, corpus.checkpointRecord(`p3-c${String(index).padStart(2, '0')}`));
  for (let index = 0; index < 30; index += 1) add(`checkpoint-f${String(index).padStart(2, '0')}`, corpus.checkpointRecord(`p3-f${String(index).padStart(2, '0')}`));
  corpus.POLICY_FIXTURES.forEach((_, index) => add(`policy-${index}`, corpus.policyRecord(index)));
  add('regression-reference', { recordKind: 'REGRESSION_REPORT', members: [{ name: 'regression-report.json', bytes: corpus.regressionBytes() }] });
  add('cicd-6', corpus.bundleRecord(6));
  add('cicd-4', corpus.bundleRecord(4));
  for (const name of READINESS) add(`readiness-${name}`, corpus.readinessRecord(name));
  for (const name of READINESS) for (const kind of DECISIONS) add(`decision-${name}-${kind}`, corpus.decisionRecord(name, kind));
  return records;
}

// ---- limit vectors: deterministic filler at limit-1, limit and limit+1 (the byte 0x41 repeated) ----

export const FILLER_BYTE = 0x41;
export function limitVectorSpecs() {
  const specs = [];
  for (const [recordKind, rule] of Object.entries(RECORD_MEMBER_RULES)) {
    specs.push({ id: `member-${recordKind}`, recordKind, scope: rule.totalBytes === null ? 'member' : 'total', limit: rule.memberBytes });
  }
  specs.push({ id: 'entry-file', recordKind: null, scope: 'entry', limit: MEMORYOS_HISTORY_LIMITS.entryBytes });
  specs.push({ id: 'descriptor', recordKind: null, scope: 'descriptor', limit: MEMORYOS_HISTORY_LIMITS.descriptorBytes });
  specs.push({ id: 'cli-json-stdout', recordKind: null, scope: 'stdout', limit: MEMORYOS_HISTORY_LIMITS.cliJsonStdoutBytes });
  return specs;
}
export function fillerDigest(length) {
  const hash = crypto.createHash('sha256');
  const chunk = Buffer.alloc(65536, FILLER_BYTE);
  for (let left = length; left > 0; left -= chunk.length) hash.update(left >= chunk.length ? chunk : chunk.subarray(0, left));
  return `sha256:${hash.digest('hex')}`;
}
export const fillerBytes = (length) => Buffer.alloc(length, FILLER_BYTE);

// ---- ledger recipes: ordered appends (and tombstones) with their expected heads ----

const ALL = ['mip-reference', 'checkpoint-c00', 'policy-0', 'regression-reference', 'cicd-6', 'cicd-4', 'readiness-ready',
  'decision-ready-approve', 'readiness-not-ready', 'decision-not-ready-approve'];
export const RECIPES = Object.freeze([
  { id: 'all', ledgerName: 'p3-all', steps: ALL.map((append) => ({ append })) },
  { id: 'purge', ledgerName: 'p3-purge', steps: [...ALL.map((append) => ({ append })),
    { tombstone: { targetIndex: 2, reason: 'OPERATOR_CORRECTION', authorityReference: 'P3-CORPUS-TICKET-1' } }] },
  { id: 'small', ledgerName: 'p3-small', steps: ['policy-0', 'readiness-ready', 'decision-ready-approve'].map((append) => ({ append })) },
]);

// Builds a recipe in memory through the real SDK. Returns the descriptor, the entry bytes and the retained members, so a
// campaign can lay the ledger out on a disk or tamper with it.
export function buildRecipe(recipe, records = corpusRecords()) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const { descriptorBytes, ledgerIdentifier } = sdk.createHistoryLedger({ ledgerName: recipe.ledgerName, workspaceIdentifier: CORPUS_WORKSPACE });
  const entries = [];
  const members = new Map();
  const purged = new Set();
  const view = () => sdk.verifyHistoryLedger({ descriptorBytes, entries, members: retained() });
  const retained = () => new Map([...members].filter(([digest]) => !purged.has(digest)));
  let ledger = view();
  for (const step of recipe.steps) {
    if (step.append !== undefined) {
      const record = byId.get(step.append);
      if (record === undefined) throw new Error(`recipe ${recipe.id}: unknown record ${step.append}`);
      const admission = sdk.admitHistoryRecord({ recordKind: record.recordKind, members: record.members, ledger });
      const appended = sdk.appendHistoryEntry({ ledger, admission });
      entries.push(appended.entryBytes);
      members.set(admission.recordDigest, record.members);
    } else {
      const { targetIndex, reason, authorityReference } = step.tombstone;
      const tombstoned = sdk.tombstoneHistoryEntry({ ledger, targetIndex, reason, authorityReference });
      entries.push(tombstoned.entryBytes);
      const target = JSON.parse(new TextDecoder().decode(entries[targetIndex]));
      purged.add(target.record.recordDigest);
    }
    ledger = view();
  }
  return { descriptorBytes, ledgerIdentifier, entries, members: retained(), verification: ledger };
}

// ---- deterministic sampling: a SHA-256 counter generator, identical on every platform and Node version ----

export function drbgWord(seed, counter) {
  return crypto.createHash('sha256').update(`${seed}:${counter}`).digest().readUInt32BE(0);
}
// n distinct sorted integers in [0, bound), by rejection over the counter stream.
export function sampleIndices(seed, count, bound) {
  if (count > bound) throw new RangeError('sample larger than its population');
  const chosen = new Set();
  for (let counter = 0; chosen.size < count; counter += 1) chosen.add(drbgWord(seed, counter) % bound);
  return [...chosen].sort((a, b) => a - b);
}

export const SEEDS = Object.freeze({
  'A3-member-stride': { seed: 'MO1308-P3-A3-MEMBER-STRIDE-1', stride: 61 },
  'A4-cli-flip-sample': { seed: 'MO1308-P3-A4-CLI-FLIP-1', count: 300 },
  'D3-random-messages': { seed: 'MO1308-P3-D3-RANDOM-1', messages: 1000, maximumLength: 4096 },
  'F-appender-order': { seed: 'MO1308-P3-F-ORDER-1' },
  'G6-swap-schedule': { seed: 'MO1308-P3-G6-SWAP-1', swaps: 200 },
});

// ---- canaries for the data-class audit (3C-H) and the secret/environment checks ----

export const CANARIES = Object.freeze([
  { class: 'USER', value: 'p3canary-user-5d2f9a1c' },
  { class: 'HOST', value: 'p3canary-host-5d2f9a1c' },
  { class: 'ENVIRONMENT', value: 'p3canary-env-5d2f9a1c' },
  { class: 'SECRET', value: 'p3canary-secret-5d2f9a1c' },
  { class: 'PATH_SEGMENT', value: 'p3canary-dir-5d2f9a1c' },
  { class: 'FILE_NAME', value: 'p3canary-file-5d2f9a1c.bin' },
  { class: 'URL', value: 'https://p3canary-url-5d2f9a1c.invalid/p' },
  { class: 'DATE_TIME', value: '2031-02-03T04:05:06Z' },
  { class: 'EPOCH_MILLISECONDS', value: '1924992000123' },
]);
// Values only known at run time; a campaign adds them to the canary set before it scans.
export const RUNTIME_CANARY_SOURCES = Object.freeze(['USERNAME', 'COMPUTERNAME', 'USERPROFILE', 'HOMEPATH', 'TEMP', 'cwd', 'os.hostname()', 'os.userInfo().username']);

// ---- campaign parameters frozen with the corpus ----

export const PLANS = Object.freeze({
  F1: { appenders: 10, readers: 2, recordsPerAppender: 3, recordLabels: 'checkpoint-f00..checkpoint-f29', writerRetryBound: 200 },
  F7: { repetitions: 10, escalateWhenRunsWithStagingEperm: 2, ofRuns: 10 },
});

// ---- the manifest ----

export function corpusManifest() {
  const records = corpusRecords();
  const manifest = {
    kind: 'MO1308Phase3CorpusManifest', version: '1.0.0', corpusId: CORPUS_ID, workspaceIdentifier: CORPUS_WORKSPACE,
    records: records.map((record) => ({
      id: record.id, recordKind: record.recordKind,
      members: record.members.map((member) => ({ name: member.name, byteLength: member.bytes.length, sha256: digestOf(member.bytes) })),
    })),
    limitVectors: limitVectorSpecs().map((spec) => ({
      ...spec,
      fillerByte: FILLER_BYTE,
      vectors: [spec.limit - 1, spec.limit, spec.limit + 1].map((length) => ({ length, sha256: fillerDigest(length) })),
    })),
    recipes: RECIPES.map((recipe) => {
      const built = buildRecipe(recipe, records);
      return {
        id: recipe.id, ledgerName: recipe.ledgerName, steps: recipe.steps,
        ledgerIdentifier: built.ledgerIdentifier, descriptorSha256: digestOf(built.descriptorBytes),
        entryCount: built.verification.entryCount, headDigest: built.verification.headDigest,
        retainedRecords: built.verification.retainedRecords, purgedRecords: built.verification.purgedRecords,
        entries: built.entries.map((bytes, index) => ({ index, byteLength: bytes.length, sha256: digestOf(bytes) })),
      };
    }),
    seeds: Object.fromEntries(Object.entries(SEEDS).map(([name, spec]) => [name, {
      ...spec,
      // Pins the generator: the first eight outputs for a population of 100,000.
      probe: sampleIndices(spec.seed, 8, 100000),
    }])),
    canaries: CANARIES.map((item) => ({ ...item })),
    runtimeCanarySources: [...RUNTIME_CANARY_SOURCES],
    plans: PLANS,
    limits: { ...MEMORYOS_HISTORY_LIMITS },
  };
  return { ...manifest, corpusDigest: digestOfJson(manifest) };
}

export function verifyManifest(file) {
  const recorded = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { corpusDigest, ...body } = recorded;
  const problems = [];
  if (digestOfJson(body) !== corpusDigest) problems.push('corpusDigest does not match the manifest body');
  const regenerated = corpusManifest();
  if (stableBytes(regenerated).toString('utf8') !== stableBytes(recorded).toString('utf8')) problems.push('the regenerated manifest differs from the recorded one');
  return problems;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, flag, value] = process.argv.slice(2);
  if (command === 'write' && flag === '--out' && value !== undefined) {
    fs.writeFileSync(path.resolve(value), stableBytes(corpusManifest()), { flag: 'wx' });
  } else if (command === 'verify' && flag === '--file' && value !== undefined) {
    const problems = verifyManifest(path.resolve(value));
    console.log(JSON.stringify({ result: problems.length === 0 ? 'PASS' : 'FAIL', problems }, null, 2));
    process.exit(problems.length === 0 ? 0 : 1);
  } else {
    console.error('usage: corpus.mjs write --out FILE | verify --file FILE');
    process.exit(2);
  }
}
