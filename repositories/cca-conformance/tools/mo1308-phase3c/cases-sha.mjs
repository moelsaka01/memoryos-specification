// MO-1308 Phase 3C step D: the two hand-written SHA-256 implementations (the incremental `Sha256Stream` in the history admission
// module and `sha256Hex` in mip-canonical.js). FIPS 180-4 example messages, the CAVP Monte Carlo procedure and a differential against
// node:crypto, all computed here: official CAVP response files are NOT used (A8 decision 1). Checkpoint admission is compared with the
// verbatim legacy (quadratic) algorithm at the frozen sizes. The independent sub-agent review (3C-D9) is a recorded, hash-bound input.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sha256Hex as mipSha256Hex } from '../../../cca-studio/web/js/mip-canonical.js';
import { legacyAdmitCheckpoint } from '../../tests/support/mo1308-legacy-checkpoint-oracle.mjs';
import { drbgWord, SEEDS } from '../mo1308-phase3/corpus.mjs';
import { validateReview } from '../mo1308-phase3/lib/receipts.mjs';
import { conclude, recordById } from './env.mjs';
import { CORPUS_WORKSPACE, MemoryLedger, attempt, dec, enc, jcs, longCheckpoint, resealCheckpoint, D, sdk } from './support.mjs';

const nodeHex = (...chunks) => { const hash = crypto.createHash('sha256'); for (const chunk of chunks) hash.update(chunk); return hash.digest('hex'); };

// The incremental hash exactly as it is in the production module: its own self-contained section, evaluated from source text.
export function loadSha256Stream(repo) {
  const source = fs.readFileSync(path.join(repo, 'repositories/cca-studio/web/js/memoryos-history-admission.js'), 'utf8');
  const start = source.indexOf('const SHA256_K = ');
  const end = source.indexOf('// ---- INVESTIGATION_CHECKPOINT');
  if (start < 0 || end <= start) throw new Error('the incremental hash section was not found in the production module');
  return new Function(`${source.slice(start, end)}\nreturn Sha256Stream;`)();
}

export function implementations(env) {
  const Stream = (env.cache.sha256Stream ??= loadSha256Stream(env.repo));
  return [
    { name: 'memoryos-history-admission.Sha256Stream', hex: (...chunks) => { const stream = new Stream(); for (const chunk of chunks) stream.update(chunk); return stream.hex(); }, Stream },
    { name: 'mip-canonical.sha256Hex', hex: (...chunks) => mipSha256Hex(chunks.length === 1 ? chunks[0] : Buffer.concat(chunks)) },
  ];
}

const million = new Uint8Array(1_000_000).fill(0x61);
// FIPS 180-4 / NIST example messages. The expected values are also checked against node:crypto, so a typo here cannot pass.
export const FIPS_VECTORS = [
  ['empty', new Uint8Array(0), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', enc.encode('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['448-bit', enc.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
  ['896-bit', enc.encode('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'), 'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'],
  ['one-million-a', million, 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
];

// The CAVP Monte Carlo procedure for SHA-256 (100 checkpoints of 1000 iterations over MD[i-3] || MD[i-2] || MD[i-1]).
export function monteCarlo(hexOf, seedBytes) {
  const checkpoints = [];
  let seed = Buffer.from(seedBytes);
  for (let j = 0; j < 100; j += 1) {
    let a = seed; let b = seed; let c = seed;
    let md = seed;
    for (let i = 3; i < 1003; i += 1) {
      md = Buffer.from(hexOf(Buffer.concat([a, b, c])), 'hex');
      a = b; b = c; c = md;
    }
    seed = md;
    checkpoints.push(md.toString('hex'));
  }
  return checkpoints;
}
const mcSeed = () => crypto.createHash('sha256').update('MO1308-P3-D2-MONTE-CARLO-SEED-1').digest();

const BLOCK_EDGES = [0, 1, 54, 55, 56, 57, 63, 64, 65, 118, 119, 120, 121, 127, 128, 129, 191, 192, 193, 255, 256, 257, 511, 512, 513, 1023, 1024, 1025];
export function pseudoRandomBytes(label, length) {
  if (length === 0) return Buffer.alloc(0);
  const key = crypto.createHash('sha256').update(`MO1308-P3-SHA-DATA-${label}`).digest().subarray(0, 16);
  const cipher = crypto.createCipheriv('aes-128-ctr', key, Buffer.alloc(16));
  return cipher.update(Buffer.alloc(length));
}

function everyImplementation(env, check) {
  const problems = [];
  const names = [];
  for (const implementation of implementations(env)) {
    names.push(implementation.name);
    for (const message of check(implementation)) problems.push(`${implementation.name}: ${message}`);
  }
  return { problems, names };
}

// The recorded independent review of the two hand-written SHA-256 implementations is a bound input (A8 decision, D8; owner
// authorization of 2026-10-06). It names the reviewed sources by hash, so a change to either source invalidates it.
export const SHA_REVIEW_FILE = 'repositories/cca-conformance/mo1308-phase3-sha256-review.json';
export const SHA_REVIEW_SUBJECTS = Object.freeze(['repositories/cca-studio/web/js/memoryos-history-admission.js', 'repositories/cca-studio/web/js/mip-canonical.js']);

export const sha = {
  '3C-D9': (h, env) => {
    const problems = [];
    const file = path.join(env.repo, SHA_REVIEW_FILE);
    if (!fs.existsSync(file)) { problems.push(`${SHA_REVIEW_FILE} is not recorded`); conclude(h, problems, {}); }
    const review = JSON.parse(fs.readFileSync(file, 'utf8'));
    problems.push(...validateReview(review));
    if (review.reviewer?.role !== 'INDEPENDENT_SUB_AGENT') problems.push('the reviewer is not an independent sub-agent');
    const subjects = new Map((review.subject ?? []).map((row) => [row.path, row]));
    for (const relative of SHA_REVIEW_SUBJECTS) {
      const bytes = fs.readFileSync(path.join(env.repo, relative));
      const row = subjects.get(relative);
      if (row === undefined) problems.push(`${relative} is not among the reviewed files`);
      else if (row.sha256 !== nodeHex(bytes) || row.byteLength !== bytes.length) problems.push(`${relative} changed since it was reviewed`);
    }
    for (const finding of review.findings ?? []) if (finding.disposition === 'OPEN') problems.push(`finding ${finding.id} has no disposition`);
    if (review.conclusion !== 'NO_BLOCKING_FINDINGS') problems.push(`the review concludes ${review.conclusion}`);
    conclude(h, problems, { reviewer: review.reviewer?.identity ?? null, findings: (review.findings ?? []).map((finding) => `${finding.id}:${finding.severity}:${finding.disposition}`), conclusion: review.conclusion });
  },
  '3C-D1': (h, env) => {
    const { problems, names } = everyImplementation(env, (implementation) => {
      const found = [];
      for (const [name, bytes, expected] of FIPS_VECTORS) {
        if (nodeHex(bytes) !== expected) found.push(`${name}: the expected value is not what node:crypto computes`);
        if (implementation.hex(bytes) !== expected) found.push(`${name}: ${implementation.hex(bytes)} != ${expected}`);
      }
      return found;
    });
    conclude(h, problems, { implementations: names, vectors: FIPS_VECTORS.map(([name, , expected]) => [name, expected.slice(0, 16)]), officialCavpResponseFilesUsed: false });
  },
  '3C-D2': (h, env) => {
    const reference = monteCarlo((bytes) => nodeHex(bytes), mcSeed());
    const { problems, names } = everyImplementation(env, (implementation) => {
      const got = monteCarlo(implementation.hex, mcSeed());
      const wrong = got.findIndex((value, index) => value !== reference[index]);
      return wrong === -1 ? [] : [`checkpoint ${wrong} differs`];
    });
    conclude(h, problems, { implementations: names, checkpoints: reference.length, iterationsPerCheckpoint: 1000, first: reference[0].slice(0, 16), last: reference[99].slice(0, 16), officialCavpResponseFilesUsed: false });
  },
  '3C-D3': (h, env) => {
    const { seed, messages, maximumLength } = SEEDS['D3-random-messages'];
    const lengths = [...new Set([...Array.from({ length: 301 }, (_, index) => index), ...BLOCK_EDGES])].sort((a, b) => a - b);
    const random = Array.from({ length: messages }, (_, index) => drbgWord(seed, index * 3) % (maximumLength + 1));
    const { problems, names } = everyImplementation(env, (implementation) => {
      const found = [];
      for (const length of [...lengths, ...random]) {
        const data = pseudoRandomBytes(`d3-${length}-${found.length}`, length);
        const expected = nodeHex(data);
        const cut = length === 0 ? 0 : drbgWord(seed, length) % (length + 1);
        const cut2 = cut + (length === cut ? 0 : drbgWord(seed, length + 1) % (length - cut + 1));
        if (implementation.hex(data) !== expected) found.push(`length ${length}`);
        else if (implementation.hex(data.subarray(0, cut), data.subarray(cut, cut2), data.subarray(cut2)) !== expected) found.push(`split ${length} at ${cut},${cut2}`);
        if (found.length > 3) break;
      }
      return found;
    });
    conclude(h, problems, { implementations: names, boundaryLengths: lengths.length, randomMessages: messages, seed });
  },
  '3C-D4': (h, env) => {
    const [stream] = implementations(env);
    const Stream = stream.Stream;
    const problems = [];
    const data = pseudoRandomBytes('d4', 1000);
    for (const cut of [0, 1, 63, 64, 65, 500, 999, 1000]) {
      const state = new Stream().update(data.subarray(0, cut));
      const midstate = state.hex();
      if (midstate !== nodeHex(data.subarray(0, cut))) problems.push(`hex() at ${cut} is wrong`);
      if (state.hex() !== midstate) problems.push(`hex() at ${cut} is not repeatable`);
      const branch = state.clone().update(data.subarray(cut));
      if (branch.hex() !== nodeHex(data)) problems.push(`clone at ${cut} did not continue correctly`);
      if (state.hex() !== midstate) problems.push(`continuing a clone changed the original at ${cut}`);
      if (state.update(data.subarray(cut)).hex() !== nodeHex(data)) problems.push(`update after hex() at ${cut} is wrong`);
      if (branch.update(enc.encode('x')).hex() !== nodeHex(data, enc.encode('x'))) problems.push(`a branch is not independent at ${cut}`);
      if (new Stream().hex() !== nodeHex(new Uint8Array(0))) problems.push('an empty stream is wrong');
    }
    conclude(h, problems, { cuts: 8 });
  },
  '3C-D5': (h, env) => {
    const sizes = [1_048_576 + 13, 8_388_608 + 1, 33_554_432];
    const chunking = [1, 63, 64, 65, 4093, 65_537, 1_000_003];
    const problems = [];
    const timings = {};
    for (const size of sizes) {
      const data = pseudoRandomBytes(`d5-${size}`, size);
      const expected = nodeHex(data);
      for (const implementation of implementations(env)) {
        if (implementation.name.startsWith('mip-canonical') && size > 8_388_608 + 1) continue; // the one-shot copy is covered up to 8 MiB
        const start = Date.now();
        const got = implementation.name.startsWith('mip-canonical') ? implementation.hex(data) : (() => {
          const chunks = [];
          let offset = 0; let index = 0;
          while (offset < size) { const length = Math.min(chunking[index % chunking.length], size - offset); chunks.push(data.subarray(offset, offset + length)); offset += length; index += 1; }
          return implementation.hex(...chunks.slice(0, 5_000).concat([data.subarray(chunks.slice(0, 5_000).reduce((sum, chunk) => sum + chunk.length, 0))]));
        })();
        timings[`${implementation.name}@${size}`] = Date.now() - start;
        if (got !== expected) problems.push(`${implementation.name} @ ${size}`);
      }
    }
    conclude(h, problems, { sizes, timingsMs: timings });
  },
  '3C-D6': (h, env) => admissionAgainstLegacy(h, env, false),
  '3C-D7': (h, env) => admissionAgainstLegacy(h, env, true),
  '3C-D8': (h, env) => {
    const mip = implementations(env)[1];
    const problems = [];
    for (const [name, bytes, expected] of FIPS_VECTORS) if (mip.hex(bytes) !== expected) problems.push(`vector ${name}`);
    const reference = monteCarlo((bytes) => nodeHex(bytes), mcSeed());
    const got = monteCarlo(mip.hex, mcSeed());
    if (got.some((value, index) => value !== reference[index])) problems.push('Monte Carlo');
    const { seed, messages } = SEEDS['D3-random-messages'];
    for (let index = 0; index < 300; index += 1) {
      const length = [...BLOCK_EDGES, ...Array.from({ length: 301 }, (_, i) => i)][index % 329] ?? drbgWord(seed, index) % 4096;
      const data = pseudoRandomBytes(`d8-${index}`, length);
      if (mip.hex(data) !== nodeHex(data)) { problems.push(`length ${length}`); break; }
    }
    const big = pseudoRandomBytes('d8-big', 8_388_608 + 1);
    if (mip.hex(big) !== nodeHex(big)) problems.push('8 MiB + 1');
    conclude(h, problems, { implementation: mip.name, messages, officialCavpResponseFilesUsed: false });
  },
};

// 3C-D6 and D7: checkpoint admission through the SDK against the verbatim legacy algorithm (every prefix re-hashed), with the
// Standard's D computed natively so that 10,000 transitions finish.
const nativeD = (domain, ...parts) => {
  const hash = crypto.createHash('sha256').update('MIP-1').update(Buffer.from([0])).update(domain);
  for (const part of parts) hash.update(Buffer.from([0])).update(part);
  return `sha256:${hash.digest('hex')}`;
};
const outcomeOfNew = (bytes) => {
  const probe = new MemoryLedger('p3c-sha-probe');
  const result = attempt(() => probe.admit({ recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes }] }));
  return result.accepted ? { subjects: result.value.subjects.map((subject) => `${subject.type}=${subject.value}`) } : { code: result.code, stage: result.stage };
};
const outcomeOfOld = (bytes) => {
  try { return { subjects: legacyAdmitCheckpoint(bytes, CORPUS_WORKSPACE, nativeD).map((subject) => `${subject.type}=${subject.value}`) }; } catch (error) { return { code: error.code, stage: error.stage }; }
};

function admissionAgainstLegacy(h, env, forged) {
  const base = recordById(env, 'checkpoint-c00').members[0].bytes;
  const sizes = [2, 5, 64, 500, 2500, 10_000];
  const problems = [];
  const rows = [];
  for (const count of sizes) {
    const value = longCheckpoint(base, count);
    const bytes = enc.encode(jcs(value));
    if (!forged) {
      const expected = outcomeOfOld(bytes);
      const actual = outcomeOfNew(bytes);
      rows.push({ count, accepted: expected.subjects !== undefined, equal: JSON.stringify(actual) === JSON.stringify(expected) });
      if (JSON.stringify(actual) !== JSON.stringify(expected)) problems.push(`${count} transitions: ${JSON.stringify(actual).slice(0, 80)} != ${JSON.stringify(expected).slice(0, 80)}`);
      if (expected.subjects === undefined) problems.push(`${count} transitions: the legacy algorithm rejected a valid checkpoint`);
    } else {
      const damaged = structuredClone(value);
      damaged.transitionLog.transitions[count - 1].previousLogDigest = D('forged-tail');
      const damagedBytes = enc.encode(jcs(damaged));
      // The legacy algorithm re-hashes every prefix before it reaches the forged one, so at the maximum size it is skipped here:
      // 3C-D6 already compares both algorithms on the valid 10,000-transition checkpoint, and the forged one must be RECORD_INVALID.
      const compare = count < 10_000;
      const expected = compare ? outcomeOfOld(damagedBytes) : null;
      const actual = outcomeOfNew(damagedBytes);
      rows.push({ count, code: actual.code ?? 'ACCEPTED', legacyCompared: compare });
      if (actual.code !== 'MO1308_RECORD_INVALID' || (compare && JSON.stringify(actual) !== JSON.stringify(expected))) problems.push(`${count} forged: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
    }
  }
  if (forged) {
    const over = enc.encode(jcs(longCheckpoint(base, 10_001)));
    const actual = outcomeOfNew(over);
    rows.push({ count: 10_001, code: actual.code ?? 'ACCEPTED' });
    if (actual.code !== 'MO1308_RECORD_INVALID') problems.push(`10,001 transitions: ${JSON.stringify(actual)}`);
  }
  void resealCheckpoint; void dec; void sdk;
  conclude(h, problems, { rows });
}
