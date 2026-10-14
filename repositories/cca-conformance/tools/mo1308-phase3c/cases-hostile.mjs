// MO-1308 Phase 3C step J (hostile inputs). Each input goes to the real admission through the SDK (in memory) and is timed; the
// outcome must be typed (accepted, or a MO1308_ code), within a fixed guard, never a crash and never INTERNAL.
import { recordById, conclude, memo } from './env.mjs';
import { MemoryLedger, attempt, dec, enc, jcs, longCheckpoint, flip } from './support.mjs';
import { sampleIndices } from '../mo1308-phase3/corpus.mjs';

export const HOSTILE_GUARD_MS = 30_000;
const TYPED = new Set(['MO1308_RECORD_INVALID', 'MO1308_RESOURCE_LIMIT', 'MO1308_DECISION_UNBOUND', 'MO1308_WORKSPACE_MISMATCH']);
const log = (env) => memo(env, 'hostile-log', () => []);

function hostile(env, name, kind, members, { expect = 'REJECT', setup } = {}) {
  const probe = new MemoryLedger('p3c-hostile');
  if (setup !== undefined) setup(probe);
  const start = Date.now();
  const outcome = attempt(() => probe.admit({ recordKind: kind, members }));
  const ms = Date.now() - start;
  const row = { name, kind, ms, accepted: outcome.accepted, code: outcome.accepted ? null : outcome.code, stage: outcome.accepted ? null : outcome.stage, expect };
  log(env).push(row);
  return row;
}
const problemsOf = (rows) => rows.flatMap((row) => {
  const found = [];
  if (row.ms > HOSTILE_GUARD_MS) found.push(`${row.name}: ${row.ms} ms exceeds the guard`);
  if (!row.accepted && !TYPED.has(row.code)) found.push(`${row.name}: untyped or internal outcome ${row.code}`);
  if (row.expect === 'REJECT' && row.accepted) found.push(`${row.name}: a hostile input was accepted`);
  if (row.expect === 'ACCEPT' && !row.accepted) found.push(`${row.name}: a valid maximal input was rejected (${row.code})`);
  return found;
});
const jsonMember = (kind) => ({ READINESS_RESULT: 'memoryos-readiness-result.json', HUMAN_DECISION_CLAIM: 'human-decision.json', REGRESSION_REPORT: 'regression-report.json', INVESTIGATION_CHECKPOINT: 'checkpoint.json' })[kind];
const asRecord = (kind, bytes) => [{ name: jsonMember(kind), bytes }];
const KINDS = ['READINESS_RESULT', 'HUMAN_DECISION_CLAIM', 'REGRESSION_REPORT', 'INVESTIGATION_CHECKPOINT'];

export const hostileCases = {
  '3C-J1': (h, env) => {
    const rows = [];
    for (const kind of KINDS) {
      for (const depth of [300, 5_000, 200_000]) rows.push(hostile(env, `${kind} nested arrays ${depth}`, kind, asRecord(kind, enc.encode('['.repeat(depth) + ']'.repeat(depth)))));
      rows.push(hostile(env, `${kind} nested objects 100000`, kind, asRecord(kind, enc.encode('{"a":'.repeat(100_000) + '1' + '}'.repeat(100_000)))));
      rows.push(hostile(env, `${kind} unbalanced 1000000`, kind, asRecord(kind, enc.encode('['.repeat(1_000_000)))));
      rows.push(hostile(env, `${kind} wide array 600000`, kind, asRecord(kind, enc.encode(`[${'0,'.repeat(600_000)}0]`))));
      rows.push(hostile(env, `${kind} wide object 100000`, kind, asRecord(kind, enc.encode(`{${Array.from({ length: 100_000 }, (_, index) => `"k${index}":0`).join(',')}}`))));
    }
    conclude(h, problemsOf(rows), { inputs: rows.length, slowestMs: Math.max(...rows.map((row) => row.ms)), codes: [...new Set(rows.map((row) => row.code))].sort() });
  },
  '3C-J2': (h, env) => {
    const base = {
      READINESS_RESULT: dec.decode(recordById(env, 'readiness-ready').members[0].bytes),
      HUMAN_DECISION_CLAIM: dec.decode(recordById(env, 'decision-ready-approve').members[0].bytes),
    };
    const variants = [
      ['duplicate-key', (text) => text.replace(/^\{/, '{"kind":"x","kind":"y",')], ['huge-exponent', (text) => text.replace(/^\{/, '{"n":1e999999,')],
      ['huge-integer', (text) => text.replace(/^\{/, '{"n":123456789012345678901234567890,')], ['negative-zero', (text) => text.replace(/^\{/, '{"n":-0,')],
      ['lone-surrogate', (text) => text.replace(/^\{/, '{"s":"\\ud800",')], ['control-in-string', (text) => text.replace(/^\{/, '{"s":"\u0001",')],
      ['nul-byte', (text) => `${text}\u0000`], ['bom', (text) => `﻿${text}`], ['trailing-comma', (text) => text.replace(/\}\n?$/, ',}')], ['single-quotes', (text) => text.replace(/"/g, "'")],
      ['nan', (text) => text.replace(/^\{/, '{"n":NaN,')], ['comment', (text) => `/*x*/${text}`], ['top-level-scalar', () => '1'], ['empty', () => ''], ['whitespace-only', () => '   \n'],
    ];
    const rows = [];
    for (const [kind, text] of Object.entries(base)) for (const [name, mutate] of variants) rows.push(hostile(env, `${kind} ${name}`, kind, asRecord(kind, enc.encode(mutate(text))), { setup: kind === 'HUMAN_DECISION_CLAIM' ? (probe) => probe.append(recordById(env, 'readiness-ready')) : undefined }));
    // malformed UTF-8: invalid lead byte, overlong, truncated sequence, surrogate encoded in UTF-8
    for (const [kind, text] of Object.entries(base)) {
      const bytes = enc.encode(text);
      for (const [name, damage] of [['invalid-lead-byte', [0xff]], ['overlong-slash', [0xc0, 0xaf]], ['truncated-sequence', [0xe2, 0x82]], ['encoded-surrogate', [0xed, 0xa0, 0x80]]]) {
        const damaged = new Uint8Array(bytes.length + damage.length);
        damaged.set(bytes.subarray(0, 40)); damaged.set(damage, 40); damaged.set(bytes.subarray(40), 40 + damage.length);
        rows.push(hostile(env, `${kind} ${name}`, kind, asRecord(kind, damaged), { setup: kind === 'HUMAN_DECISION_CLAIM' ? (probe) => probe.append(recordById(env, 'readiness-ready')) : undefined }));
      }
    }
    // a policy pair of hostile JSON and a CI bundle whose members are hostile
    rows.push(hostile(env, 'POLICY_EVALUATION nested', 'POLICY_EVALUATION', [{ name: 'evaluation-identity.json', bytes: enc.encode('['.repeat(3000)) }, { name: 'policy-outcome.json', bytes: enc.encode('{"a":1,"a":2}') }]));
    conclude(h, problemsOf(rows), { inputs: rows.length, slowestMs: Math.max(...rows.map((row) => row.ms)), codes: [...new Set(rows.map((row) => row.code))].sort() });
  },
  '3C-J3': (h, env) => {
    const base = recordById(env, 'checkpoint-c00').members[0].bytes;
    const bytes = enc.encode(jcs(longCheckpoint(base, 10_000)));
    const row = hostile(env, 'checkpoint with 10,000 transitions', 'INVESTIGATION_CHECKPOINT', [{ name: 'checkpoint.json', bytes }], { expect: 'ACCEPT' });
    conclude(h, problemsOf([row]), { transitions: 10_000, bytes: bytes.length, admissionMs: row.ms, accepted: row.accepted });
  },
  '3C-J4': (h, env) => {
    const base = recordById(env, 'checkpoint-c00').members[0].bytes;
    const bytes = enc.encode(jcs(longCheckpoint(base, 10_001)));
    const row = hostile(env, 'checkpoint with 10,001 transitions', 'INVESTIGATION_CHECKPOINT', [{ name: 'checkpoint.json', bytes }]);
    const problems = problemsOf([row]);
    if (row.code !== 'MO1308_RECORD_INVALID') problems.push(`10,001 transitions: ${row.code}, expected RECORD_INVALID`);
    conclude(h, problems, { transitions: 10_001, bytes: bytes.length, admissionMs: row.ms, code: row.code });
  },
  '3C-J5': (h, env) => {
    const package_ = recordById(env, 'mip-reference').members[0].bytes;
    const rows = [];
    rows.push(hostile(env, 'empty package', 'MIP_PACKAGE', [{ name: 'package.mip', bytes: new Uint8Array(0) }]));
    for (const keep of [1, 2, 10, 100, 1000, 5000, package_.length - 1]) rows.push(hostile(env, `package truncated to ${keep}`, 'MIP_PACKAGE', [{ name: 'package.mip', bytes: package_.slice(0, keep) }]));
    for (const position of sampleIndices('MO1308-P3-J5-MIP-FLIPS-1', 120, package_.length)) rows.push(hostile(env, `package flip at ${position}`, 'MIP_PACKAGE', [{ name: 'package.mip', bytes: flip(package_, position) }], { expect: 'ANY' }));
    rows.push(hostile(env, 'package doubled', 'MIP_PACKAGE', [{ name: 'package.mip', bytes: Buffer.concat([package_, package_]) }]));
    rows.push(hostile(env, 'package of filler', 'MIP_PACKAGE', [{ name: 'package.mip', bytes: new Uint8Array(4_000_000).fill(0x7b) }]));
    const problems = problemsOf(rows.filter((row) => row.expect !== 'ANY'));
    const flips = rows.filter((row) => row.expect === 'ANY');
    for (const row of flips) {
      if (row.ms > HOSTILE_GUARD_MS) problems.push(`${row.name}: ${row.ms} ms`);
      if (!row.accepted && !TYPED.has(row.code)) problems.push(`${row.name}: ${row.code}`);
    }
    conclude(h, problems.slice(0, 6), { inputs: rows.length, flipsAccepted: flips.filter((row) => row.accepted).length, flipsRejected: flips.filter((row) => !row.accepted).length, slowestMs: Math.max(...rows.map((row) => row.ms)) });
  },
  '3C-J6': (h, env) => {
    // A valid checkpoint as close to the 32 MiB member limit as 10,000 padded transitions allow.
    const LIMIT = 33_554_432;
    const base = recordById(env, 'checkpoint-c00').members[0].bytes;
    let pad = 3200;
    let bytes = enc.encode(jcs(longCheckpoint(base, 10_000, { pad })));
    for (let attempts = 0; attempts < 3; attempts += 1) {
      const gap = LIMIT - 1024 - bytes.length;
      if (Math.abs(gap) < 2_000_000 && gap >= 0) break;
      pad = Math.max(1, pad + Math.floor(gap / 10_000));
      bytes = enc.encode(jcs(longCheckpoint(base, 10_000, { pad })));
    }
    const row = hostile(env, 'checkpoint near the 32 MiB limit', 'INVESTIGATION_CHECKPOINT', [{ name: 'checkpoint.json', bytes }], { expect: bytes.length <= LIMIT ? 'ACCEPT' : 'REJECT' });
    const problems = problemsOf([row]);
    if (bytes.length > LIMIT) problems.push(`the generated checkpoint is ${bytes.length} bytes, over the limit`);
    conclude(h, problems, { bytes: bytes.length, limit: LIMIT, withinLimit: bytes.length <= LIMIT, padBytesPerTransition: pad, admissionMs: row.ms, accepted: row.accepted });
  },
  '3C-J7': (h, env) => {
    const rows = log(env);
    const problems = [];
    if (rows.length === 0) problems.push('no hostile input was run in this generation');
    for (const row of rows) {
      if (row.ms > HOSTILE_GUARD_MS) problems.push(`${row.name}: ${row.ms} ms`);
      if (!row.accepted && !TYPED.has(row.code)) problems.push(`${row.name}: ${row.code}`);
    }
    conclude(h, problems.slice(0, 6), { inputs: rows.length, guardMs: HOSTILE_GUARD_MS, slowestMs: Math.max(0, ...rows.map((row) => row.ms)), codes: [...new Set(rows.filter((row) => !row.accepted).map((row) => row.code))].sort() });
  },
};
