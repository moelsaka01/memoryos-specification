// MO-1308 Phase 3C: shared support for the security cases. An independent implementation of the Standard's D and JCS (node:crypto
// and plain JSON, no import of the module under test), a ledger rebuilder that recomputes every identity, on-disk ledger helpers
// built through the real CLI, and the process runner. Nothing here is Windows-specific.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as sdk from '../../../cca-studio/web/js/memoryos-sdk.js';
import { MemoryOSHistoryError } from '../../../cca-studio/web/js/memoryos-history-contract.js';
import { CORPUS_WORKSPACE, RECIPES, buildRecipe, corpusRecords } from '../mo1308-phase3/corpus.mjs';

export { sdk, MemoryOSHistoryError, CORPUS_WORKSPACE, RECIPES, buildRecipe, corpusRecords };
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORIES = path.resolve(here, '../../..');
export const CLI = path.join(REPOSITORIES, 'memoryos-cli/bin/memoryos.js');
export const enc = new TextEncoder();
export const dec = new TextDecoder();

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
// knowledge of the construction could produce.
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

// Verifies parts with the product; returns {ok, code, stage, verification}.
export function tryVerify(built) {
  try {
    const verification = sdk.verifyHistoryLedger({ descriptorBytes: built.descriptorBytes, entries: built.entries, members: built.members });
    return { ok: true, verification };
  } catch (error) {
    return { ok: false, code: error?.code ?? 'UNTYPED', stage: error?.stage ?? null, name: error?.name ?? 'Error' };
  }
}
export const failedClosed = (outcome, allowed = ['MO1308_LEDGER_CORRUPT', 'MO1308_RECORD_BYTES_MISMATCH', 'MO1308_VERSION_UNSUPPORTED']) => outcome.ok === false && allowed.includes(outcome.code);

export function flip(bytes, index, mask = 0x01) {
  const copy = new Uint8Array(bytes);
  copy[index] ^= mask;
  return copy;
}

// ---- process runner and on-disk ledgers (through the real CLI) ----
export function cli(args, { cwd = os.tmpdir(), env = {}, nodeArgs = [] } = {}) {
  const run = spawnSync(process.execPath, [...nodeArgs, CLI, ...args], {
    cwd, env: { PATH: process.env.PATH ?? '', ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot ?? '' } : {}), ...env }, encoding: 'utf8', windowsHide: true, shell: false,
  });
  let json = null;
  try { json = JSON.parse(run.stdout || run.stderr); } catch { json = null; }
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, json, code: json?.error?.historyCode ?? null, exit: json?.error?.exitCode ?? null };
}

export function inputFiles(directory, record) {
  fs.mkdirSync(directory, { recursive: true });
  const written = {};
  for (const member of record.members) {
    written[member.name] = path.join(directory, member.name);
    fs.writeFileSync(written[member.name], member.bytes);
  }
  return written;
}

export function appendArgs(ledger, record, directory) {
  const files = inputFiles(directory, record);
  if (record.recordKind === 'POLICY_EVALUATION') return ['history', 'append', '--ledger', ledger, '--kind', 'POLICY_EVALUATION', '--identity', files['evaluation-identity.json'], '--outcome', files['policy-outcome.json'], '--json'];
  if (record.recordKind === 'CICD_RUN') return ['history', 'append', '--ledger', ledger, '--kind', 'CICD_RUN', '--run', directory, '--json'];
  return ['history', 'append', '--ledger', ledger, '--kind', record.recordKind, '--record', files[record.members[0].name], '--json'];
}

// Builds a ledger on disk by init and append through the CLI, from corpus record ids; returns the directory.
export function buildDiskLedger(work, name, recordIds, { workspace = CORPUS_WORKSPACE, records = corpusRecords() } = {}) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const ledger = path.join(work, name);
  const init = cli(['history', 'init', '--ledger', ledger, '--name', name, '--workspace', workspace, '--json']);
  if (init.status !== 0) throw new Error(`init failed: ${init.stderr.slice(0, 200)}`);
  for (const id of recordIds) {
    const record = byId.get(id);
    const result = cli(appendArgs(ledger, record, path.join(work, `in-${name}-${id}`)));
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
export function copyTree(from, to) { fs.cpSync(from, to, { recursive: true }); }
export const tempDir = (prefix = 'mo1308-p3c-') => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

export function ledgerFiles(ledger) {
  return {
    descriptor: path.join(ledger, 'memoryos-history-ledger.json'),
    entries: fs.existsSync(path.join(ledger, 'entries')) ? fs.readdirSync(path.join(ledger, 'entries')).sort().map((name) => path.join(ledger, 'entries', name)) : [],
    members: [...readTree(path.join(ledger, 'records')).keys()].map((relative) => path.join(ledger, 'records', ...relative.split('/'))),
  };
}
void MemoryOSHistoryError;

// Rewrites the record of an entry body for new member bytes, recomputing member rows and the record digest, so a forged entry is
// internally consistent. Returns the new recordDigest.
export function resealRecord(body, list) {
  const rows = [...list].sort((a, b) => (a.name < b.name ? -1 : 1)).map((member) => ({ name: member.name, byteLength: member.bytes.length, sha256: sha(member.bytes) }));
  body.record.members = rows;
  body.record.recordDigest = D('MEMORYOS-HISTORY-RECORD-1.0', body.record.recordKind, jcs(rows));
  return body.record.recordDigest;
}

// A small in-memory ledger driven by the product SDK: append, tombstone and the verified view after every step.
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

  admit(record) { return sdk.admitHistoryRecord({ recordKind: record.recordKind, members: record.members, ledger: this.view }); }

  append(record) {
    const admission = this.admit(record);
    const appended = sdk.appendHistoryEntry({ ledger: this.view, admission });
    this.entries.push(appended.entryBytes);
    this.members.set(admission.recordDigest, record.members);
    this.view = this.verify();
    return admission;
  }

  tombstone(targetIndex, reason = 'OPERATOR_CORRECTION', authorityReference = 'P3C-TICKET') {
    const result = sdk.tombstoneHistoryEntry({ ledger: this.view, targetIndex, reason, authorityReference });
    this.entries.push(result.entryBytes);
    this.purged.add(JSON.parse(dec.decode(this.entries[targetIndex])).record.recordDigest);
    this.view = this.verify();
    return result;
  }

  built() { return { descriptorBytes: this.descriptorBytes, entries: this.entries, members: this.retained() }; }
}

// The outcome of an attempt as {accepted} or {code, stage}.
export function attempt(action) {
  try { const value = action(); return { accepted: true, value }; } catch (error) { return { accepted: false, code: error?.code ?? 'UNTYPED', stage: error?.stage ?? null, name: error?.name ?? 'Error' }; }
}

// ---- record mutations used by the admission matrix and the hostile-input cases ----
export const flipFirstHex = (bytes, afterText) => {
  const text = dec.decode(bytes);
  const start = afterText === undefined ? text.search(/sha256:[0-9a-f]{64}/) + 'sha256:'.length : text.indexOf(afterText) + afterText.length;
  const index = start;
  const original = text[index];
  const replacement = original === '0' ? '1' : '0';
  return enc.encode(`${text.slice(0, index)}${replacement}${text.slice(index + 1)}`);
};
export const withMember = (record, name, bytes) => ({ ...record, members: record.members.map((member) => (member.name === name ? { name, bytes } : member)) });
export const dropMember = (record, name) => ({ ...record, members: record.members.filter((member) => member.name !== name) });
export const filler = (length) => new Uint8Array(length).fill(0x41);

// The Core checkpoint re-sealer: recomputes every transition identity, the prefix chain, the log digest and the identifier.
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

// Runs the CLI under the process observer and returns the run plus the counts it recorded.
export function observedCli(args, options = {}) {
  const log = path.join(tempDir('mo1308-p3c-obs-'), 'observer.log');
  const run = cli(args, { ...options, nodeArgs: ['--require', path.join(here, 'process-observer.cjs')], env: { ...(options.env ?? {}), P3C_OBSERVER_LOG: log } });
  const counts = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, 'utf8').trim().split('\n').at(-1)) : null;
  fs.rmSync(path.dirname(log), { recursive: true, force: true });
  return { ...run, counts };
}
