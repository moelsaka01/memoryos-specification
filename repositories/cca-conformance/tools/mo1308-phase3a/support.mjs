// MO-1308 Phase 3A (platform-neutral part): shared support. Real processes for the CLI, the SDK for the in-memory twin, an
// independent D/JCS for re-sealing a checkpoint. Nothing here uses a Windows API; the Windows harness is Step 3.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as sdk from '../../../cca-studio/web/js/memoryos-sdk.js';
import * as contract from '../../../cca-studio/web/js/memoryos-history-contract.js';
import { CORPUS_WORKSPACE, corpusRecords, fillerBytes } from '../mo1308-phase3/corpus.mjs';

export { sdk, contract, CORPUS_WORKSPACE, corpusRecords, fillerBytes };
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORIES = path.resolve(here, '../../..');
export const CLI = path.join(REPOSITORIES, 'memoryos-cli/bin/memoryos.js');
export const enc = new TextEncoder();
export const dec = new TextDecoder();
export const tempDir = (prefix = 'mo1308-p3a-') => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// ---- independent D and JCS ----
export const jcs = (value) => (value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(jcs).join(',')}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`);
export function D(domain, ...parts) {
  const hash = crypto.createHash('sha256').update('MIP-1').update(Buffer.from([0])).update(domain, 'utf8');
  for (const part of parts) hash.update(Buffer.from([0])).update(part, 'utf8');
  return `sha256:${hash.digest('hex')}`;
}
export const sha = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
export const jcsBytes = (value) => new Uint8Array(enc.encode(jcs(value)));

export const recordDigestOf = (recordKind, members) => D('MEMORYOS-HISTORY-RECORD-1.0', recordKind, jcs(
  [...members].sort((a, b) => (a.name < b.name ? -1 : 1)).map((member) => ({ name: member.name, byteLength: member.bytes.length, sha256: sha(member.bytes) }))));

// A ledger as plain parts: {descriptor, bodies, members}. `bodies` are entry objects without digests; `members` maps recordDigest
// to [{name, bytes}]. `rebuild` recomputes the identifiers and the chain; the result is what a writer with filesystem access and

// Runs the real CLI. Every raw output is hashed into `log` (when given) so the campaign can seal the raw-log index (3A-M3).
export function cli(args, { cwd = os.tmpdir(), env = {}, log = null, input } = {}) {
  const run = spawnSync(process.execPath, [CLI, ...args], {
    cwd, env: { PATH: process.env.PATH ?? '', ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot ?? '' } : {}), ...env },
    encoding: 'utf8', windowsHide: true, shell: false, input, maxBuffer: 64 * 1024 * 1024,
  });
  let json = null;
  try { json = JSON.parse(run.stdout || run.stderr); } catch { json = null; }
  const result = { status: run.status, stdout: run.stdout, stderr: run.stderr, json, code: json?.error?.historyCode ?? null, exit: json?.error?.exitCode ?? null };
  if (log !== null) log.push({ command: args.slice(0, 2).join(' '), status: run.status, stdout: sha(Buffer.from(run.stdout ?? '')), stderr: sha(Buffer.from(run.stderr ?? '')) });
  return result;
}

export function inputFiles(directory, record) {
  fs.mkdirSync(directory, { recursive: true });
  const written = {};
  for (const member of record.members) { written[member.name] = path.join(directory, member.name); fs.writeFileSync(written[member.name], member.bytes); }
  return written;
}

export function appendArgs(ledger, record, directory) {
  const files = inputFiles(directory, record);
  if (record.recordKind === 'POLICY_EVALUATION') return ['history', 'append', '--ledger', ledger, '--kind', 'POLICY_EVALUATION', '--identity', files['evaluation-identity.json'], '--outcome', files['policy-outcome.json'], '--json'];
  if (record.recordKind === 'CICD_RUN') return ['history', 'append', '--ledger', ledger, '--kind', 'CICD_RUN', '--run', directory, '--json'];
  return ['history', 'append', '--ledger', ledger, '--kind', record.recordKind, '--record', files[record.members[0].name], '--json'];
}

export function initArgs(ledger, name, workspace = CORPUS_WORKSPACE) { return ['history', 'init', '--ledger', ledger, '--name', name, '--workspace', workspace, '--json']; }
export const queryArgs = (ledger, extra = [], { from = 0, limit = 1000, retention = 'ANY' } = {}) => ['history', 'query', '--ledger', ledger, '--retention', retention, '--from', String(from), '--limit', String(limit), ...extra, '--json'];

// A ledger on disk built through the real CLI from corpus record ids.
export function buildDiskLedger(work, name, recordIds, { workspace = CORPUS_WORKSPACE, records = corpusRecords(), log = null, cwd, env } = {}) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const ledger = path.join(work, name);
  const init = cli(initArgs(ledger, name, workspace), { log, cwd, env });
  if (init.status !== 0) throw new Error(`init failed: ${init.stderr.slice(0, 200)}`);
  for (const id of recordIds) {
    const result = cli(appendArgs(ledger, byId.get(id), path.join(work, `in-${name}-${id}`)), { log, cwd, env });
    if (result.status !== 0) throw new Error(`append ${id} failed: ${result.stderr.slice(0, 200)}`);
  }
  return ledger;
}

export function readTree(root) {
  const files = new Map();
  const walk = (directory, prefix) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
      else files.set(relative, fs.readFileSync(path.join(directory, entry.name)));
    }
  };
  walk(root, '');
  return files;
}
export const treeDigest = (root) => sha(Buffer.from(JSON.stringify([...readTree(root)].map(([file, bytes]) => [file, sha(bytes)]))));
export const treeList = (root) => [...readTree(root).keys()];

// An in-memory ledger driven by the SDK (the twin of a CLI-built ledger, 3A-B10).
export class MemoryLedger {
  constructor(name, workspace = CORPUS_WORKSPACE) {
    const created = sdk.createHistoryLedger({ ledgerName: name, workspaceIdentifier: workspace });
    this.descriptorBytes = created.descriptorBytes;
    this.entries = [];
    this.members = new Map();
    this.purged = new Set();
    this.view = this.verify();
  }
  retained() { return new Map([...this.members].filter(([digest]) => !this.purged.has(digest))); }
  verify() { return sdk.verifyHistoryLedger({ descriptorBytes: this.descriptorBytes, entries: this.entries, members: this.retained() }); }
  append(record) {
    const admission = sdk.admitHistoryRecord({ recordKind: record.recordKind, members: record.members, ledger: this.view });
    const appended = sdk.appendHistoryEntry({ ledger: this.view, admission });
    this.entries.push(appended.entryBytes);
    this.members.set(admission.recordDigest, record.members);
    this.view = this.verify();
    return admission;
  }
  tombstone(targetIndex, reason = 'OPERATOR_CORRECTION', authorityReference = 'P3A-TICKET') {
    const result = sdk.tombstoneHistoryEntry({ ledger: this.view, targetIndex, reason, authorityReference });
    this.entries.push(result.entryBytes);
    this.purged.add(JSON.parse(dec.decode(this.entries[targetIndex])).record.recordDigest);
    this.view = this.verify();
    return result;
  }
  built() { return { descriptorBytes: this.descriptorBytes, entries: this.entries, members: this.retained() }; }
  query(query) { return sdk.queryHistoryLedger({ descriptorBytes: this.descriptorBytes, entries: this.entries, query }); }
  export() { return sdk.buildHistoryExport(this.built()); }
}

// Writes an in-memory ledger in the exact on-disk layout of section 9.1 (a ledger a writer with filesystem access could make).
export function writeLedgerToDisk(built, directory) {
  fs.mkdirSync(path.join(directory, 'entries'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'memoryos-history-ledger.json'), built.descriptorBytes);
  built.entries.forEach((bytes, index) => fs.writeFileSync(path.join(directory, 'entries', `${String(index).padStart(20, '0')}.json`), bytes));
  for (const [digest, members] of built.members) {
    const target = path.join(directory, 'records', digest.replace('sha256:', ''));
    fs.mkdirSync(target, { recursive: true });
    for (const member of members) fs.writeFileSync(path.join(target, member.name), member.bytes);
  }
  return directory;
}

export function resealCheckpoint(checkpoint) {
  const value = structuredClone(checkpoint);
  const id = value.investigationIdentifier;
  let prior = D('INVESTIGATION-CORE-LOG-1.0', id, '[]');
  const running = crypto.createHash('sha256').update('MIP-1').update(Buffer.from([0])).update('INVESTIGATION-CORE-LOG-1.0').update(Buffer.from([0])).update(id).update(Buffer.from([0])).update('[');
  value.transitionLog.transitions.forEach((transition, index) => {
    transition.index = index;
    transition.previousLogDigest = prior;
    transition.identifier = D('INVESTIGATION-CORE-TRANSITION-1.0', jcs({ investigationIdentifier: id, index, kind: transition.kind, payload: transition.payload, previousLogDigest: prior }));
    running.update((index === 0 ? '' : ',') + jcs({ identifier: transition.identifier, index, investigationIdentifier: id, kind: transition.kind, payload: transition.payload, previousLogDigest: prior }));
    prior = `sha256:${running.copy().update(']').digest('hex')}`;
  });
  value.transitionLog.digest = prior;
  value.transitionLogDigest = prior;
  value.transitionCount = value.transitionLog.transitions.length;
  value.identifier = D('INVESTIGATION-CORE-CHECKPOINT-1.0', id, prior, value.stateDigest);
  return value;
}

const KINDS_AFTER_IMPORT = ['TRACE_SELECTED', 'REPLAY_PREPARED', 'REPLAY_ACTION', 'EVOLUTION_ENTERED', 'EVOLUTION_MOVED', 'COMPARATIVE_ENTERED',
  'COMPARATIVE_ACTION', 'COMPARATIVE_LEFT', 'EVOLUTION_LEFT', 'RETURNED_TO_WORLD', 'VERIFIED', 'ARCHIVED'];
// A real checkpoint (the corpus record) extended with `count - 2` navigation transitions and re-sealed; `pad` bytes of payload per
// transition can be added to reach a target size.
export function longCheckpoint(baseBytes, count, { pad = 0 } = {}) {
  const value = JSON.parse(dec.decode(baseBytes));
  const id = value.investigationIdentifier;
  for (let index = value.transitionLog.transitions.length; index < count; index += 1) {
    value.transitionLog.transitions.push({
      kind: KINDS_AFTER_IMPORT[index % KINDS_AFTER_IMPORT.length], version: '1.0.0', investigationIdentifier: id, index,
      payload: index % 7 === 0 || pad > 0 ? { step: index, note: pad > 0 ? 'x'.repeat(pad) : `navigation ${index}` } : {}, previousLogDigest: '', identifier: '',
    });
  }
  return resealCheckpoint(value);
}


// A ledger as plain parts: {descriptor, bodies, members}. `bodies` are entry objects without digests; `members` maps recordDigest
export function parseLedger(built) {
  return {
    descriptor: JSON.parse(dec.decode(built.descriptorBytes)),
    bodies: built.entries.map((bytes) => { const { entryDigest, previousEntryDigest, ledgerIdentifier, ...body } = JSON.parse(dec.decode(bytes)); void entryDigest; void previousEntryDigest; void ledgerIdentifier; return body; }),
    members: new Map([...built.members].map(([digest, list]) => [digest, list.map((member) => ({ name: member.name, bytes: new Uint8Array(member.bytes) }))])),
  };
}

export function rebuild({ descriptor, bodies, members }) {
  const descriptorBytes = jcsBytes(descriptor);
  const ledgerIdentifier = D('MEMORYOS-HISTORY-LEDGER-1.0', jcs(descriptor));
  let previous = D('MEMORYOS-HISTORY-GENESIS-1.0', ledgerIdentifier);
  const entries = [];
  const retained = new Map();
  bodies.forEach((body, index) => {
    const entry = { ...structuredClone(body), ledgerIdentifier, index, previousEntryDigest: previous };
    const digest = D('MEMORYOS-HISTORY-ENTRY-1.0', jcs(entry));
    entry.entryDigest = digest;
    entries.push(jcsBytes(entry));
    previous = digest;
  });
  for (const [digest, list] of members) retained.set(digest, list);
  return { descriptorBytes, ledgerIdentifier, entries, members: retained, headDigest: previous };
}

