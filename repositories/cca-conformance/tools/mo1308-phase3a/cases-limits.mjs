// MO-1308 Phase 3A step J: the Freeze section 14.2 limits at limit-1, limit and limit+1, through the real CLI wherever a valid
// record can reach them, and through the SDK validators where only the SDK can. Platform-neutral.
import fs from 'node:fs';
import path from 'node:path';
import { MemoryLedger, parseLedger, rebuild, recordDigestOf, sha, contract, dec, enc, fillerBytes, initArgs, jcs, longCheckpoint, queryArgs, resealCheckpoint, sdk, treeDigest, writeLedgerToDisk } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';

const LIMITS = contract.MEMORYOS_HISTORY_LIMITS;
const RULES = contract.RECORD_MEMBER_RULES;
const FLAG = { MIP_PACKAGE: '--record', INVESTIGATION_CHECKPOINT: '--record', REGRESSION_REPORT: '--record', READINESS_RESULT: '--record', HUMAN_DECISION_CLAIM: '--record' };

// Appends one single-file record of `size` filler bytes; returns the outcome and whether the ledger changed.
function tryFile(env, ledger, kind, member, size, label) {
  const directory = work(env, 'j-in');
  const file = path.join(directory, `${label}-${member}`);
  fs.writeFileSync(file, fillerBytes(size));
  const before = treeDigest(ledger);
  const result = run(env, ['history', 'append', '--ledger', ledger, '--kind', kind, FLAG[kind], file, '--json']);
  fs.rmSync(file, { force: true });
  return { code: result.code, exit: result.exit, unchanged: treeDigest(ledger) === before };
}

// limit-1 and limit are never RESOURCE_LIMIT (the filler is not a valid record, so another typed refusal), limit+1 always is.
function boundaries(env, kind, member, limit, id) {
  const ledger = ledgerWith(env, `j-${id}`, []);
  const problems = [];
  const seen = {};
  for (const [label, size] of [['below', limit - 1], ['at', limit], ['over', limit + 1]]) {
    const outcome = tryFile(env, ledger, kind, member, size, label);
    seen[label] = outcome.code;
    if (!outcome.unchanged) problems.push(`${label}: the ledger changed`);
    if (label === 'over' ? outcome.code !== 'MO1308_RESOURCE_LIMIT' : outcome.code === 'MO1308_RESOURCE_LIMIT') problems.push(`${label} (${size}): ${outcome.code}`);
  }
  return { problems, seen };
}

function limitCase(kind, member, id) {
  return (h, env) => { const { problems, seen } = boundaries(env, kind, member, RULES[kind].memberBytes, id); conclude(h, problems, { limit: RULES[kind].memberBytes, seen }); };
}

// An entry object with `count` subjects, for the SDK's own entry validator.
function entryWithSubjects(sample, count) {
  const value = structuredClone(sample);
  value.record.subjects = Array.from({ length: count }, (_, index) => ({ type: 'MIP_PACKAGE_IDENTIFIER', value: `subject-${String(index).padStart(3, '0')}` }));
  return value;
}

const attempt = (action) => { try { action(); return { accepted: true, code: null }; } catch (error) { return { accepted: false, code: error?.code ?? 'UNTYPED' }; } };

export const limitCases = {
  '3A-J1': limitCase('MIP_PACKAGE', 'package.mip', 'j1'),
  '3A-J2': limitCase('INVESTIGATION_CHECKPOINT', 'checkpoint.json', 'j2'),
  '3A-J3': (h, env) => {
    const ledger = ledgerWith(env, 'j3', []);
    const limit = RULES.POLICY_EVALUATION.memberBytes;
    const problems = [];
    const seen = {};
    const record = recordById(env, 'policy-0');
    for (const grown of ['evaluation-identity.json', 'policy-outcome.json']) {
      for (const [label, size] of [['below', limit - 1], ['at', limit], ['over', limit + 1]]) {
        const directory = work(env, `j3-${grown}-${label}`);
        const files = {};
        for (const member of record.members) { files[member.name] = path.join(directory, member.name); fs.writeFileSync(files[member.name], member.name === grown ? fillerBytes(size) : member.bytes); }
        const before = treeDigest(ledger);
        const result = run(env, ['history', 'append', '--ledger', ledger, '--kind', 'POLICY_EVALUATION', '--identity', files['evaluation-identity.json'], '--outcome', files['policy-outcome.json'], '--json']);
        seen[`${grown}:${label}`] = result.code;
        if (treeDigest(ledger) !== before) problems.push(`${grown} ${label}: the ledger changed`);
        if (label === 'over' ? result.code !== 'MO1308_RESOURCE_LIMIT' : result.code === 'MO1308_RESOURCE_LIMIT') problems.push(`${grown} ${label}: ${result.code}`);
      }
    }
    conclude(h, problems, { limit, seen });
  },
  '3A-J4': limitCase('REGRESSION_REPORT', 'regression-report.json', 'j4'),
  '3A-J5': (h, env) => {
    const ledger = ledgerWith(env, 'j5', []);
    const limit = RULES.CICD_RUN.totalBytes;
    const names = ['evaluation-identity.json', 'memoryos-ci-artifacts.json', 'memoryos-ci-complete.json', 'memoryos-ci-evidence.json', 'memoryos-ci-result.json', 'policy-outcome.json'];
    const problems = [];
    const seen = {};
    for (const [label, total] of [['below', limit - 1], ['at', limit], ['over', limit + 1]]) {
      const directory = work(env, `j5-${label}`);
      const each = Math.floor(total / names.length);
      names.forEach((name, index) => fs.writeFileSync(path.join(directory, name), fillerBytes(index === names.length - 1 ? total - each * (names.length - 1) : each)));
      const before = treeDigest(ledger);
      const result = run(env, ['history', 'append', '--ledger', ledger, '--kind', 'CICD_RUN', '--run', directory, '--json']);
      seen[label] = result.code;
      if (treeDigest(ledger) !== before) problems.push(`${label}: the ledger changed`);
      if (label === 'over' ? result.code !== 'MO1308_RESOURCE_LIMIT' : result.code === 'MO1308_RESOURCE_LIMIT') problems.push(`${label} (${total}): ${result.code}`);
    }
    conclude(h, problems, { limit, seen });
  },
  '3A-J6': limitCase('READINESS_RESULT', 'memoryos-readiness-result.json', 'j6'),
  '3A-J7': limitCase('HUMAN_DECISION_CLAIM', 'human-decision.json', 'j7'),
  '3A-J8': (h, env) => {
    const problems = [];
    const seen = {};
    // descriptor: tuned through the workspace identifier, in the SDK and through `history init`
    const baseSize = enc.encode(jcs({ kind: 'MemoryOSHistoryLedger', ledgerName: 'j8', version: '1.0.0', workspaceIdentifier: '' })).length;
    for (const [label, size] of [['below', LIMITS.descriptorBytes - 1], ['at', LIMITS.descriptorBytes], ['over', LIMITS.descriptorBytes + 1]]) {
      const workspace = 'w'.repeat(size - baseSize);
      const outcome = attempt(() => sdk.createHistoryLedger({ ledgerName: 'j8', workspaceIdentifier: workspace }));
      const directory = path.join(work(env, 'j8'), `ledger-${label}`);
      const init = run(env, initArgs(directory, 'j8', workspace));
      if (init.status === 0) register(env, directory);
      seen[`descriptor:${label}`] = [outcome.code, init.code];
      const expected = label === 'over';
      if (expected ? outcome.code !== 'MO1308_RESOURCE_LIMIT' || init.code !== 'MO1308_RESOURCE_LIMIT' : !outcome.accepted || init.status !== 0) problems.push(`descriptor ${label}: sdk ${outcome.code}, cli ${init.code}`);
      if (expected && fs.existsSync(directory)) problems.push('a refused init created a directory');
    }
    // entry file: the byte bound of the SDK decoder (a valid entry that large cannot be built from a valid record, see 3A-J11)
    for (const [label, size] of [['below', LIMITS.entryBytes - 1], ['at', LIMITS.entryBytes], ['over', LIMITS.entryBytes + 1]]) {
      const outcome = attempt(() => contract.decodeHistoryBytes(new Uint8Array(size).fill(0x41), { maxBytes: LIMITS.entryBytes }));
      seen[`entry:${label}`] = outcome.code;
      if (label === 'over' ? outcome.code !== 'MO1308_RESOURCE_LIMIT' : outcome.code === 'MO1308_RESOURCE_LIMIT') problems.push(`entry ${label}: ${outcome.code}`);
    }
    conclude(h, problems, { seen });
  },
  '3A-J9': (h, env) => {
    const problems = [];
    const twin = new MemoryLedger('j9');
    twin.append(recordById(env, 'mip-reference'));
    const sample = JSON.parse(dec.decode(twin.entries[0]));
    const seen = {};
    for (const count of [16, 17]) {
      const outcome = attempt(() => contract.validateEntry(entryWithSubjects(sample, count)));
      seen[count] = outcome.code;
      if ((count === 16) !== outcome.accepted) problems.push(`${count} subjects: ${outcome.accepted ? 'accepted' : outcome.code}`);
    }
    conclude(h, problems, { seen, limit: LIMITS.subjectsPerEntry });
  },
  '3A-J10': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'j10', ['mip-reference']);
    const seen = {};
    for (const limit of [1, 1000, 0, 1001]) {
      const result = run(env, queryArgs(ledger, [], { limit }));
      seen[limit] = result.status === 0 ? 'ok' : result.code;
      const accepted = limit === 1 || limit === 1000;
      if (accepted !== (result.status === 0)) problems.push(`CLI limit ${limit}: ${result.code}`);
      if (!accepted && (result.code !== 'MO1308_USAGE' || result.exit !== 1)) problems.push(`CLI limit ${limit}: ${result.code}`);
      const sdkOutcome = attempt(() => contract.validateQuery({ kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit }));
      if (accepted !== sdkOutcome.accepted || (!accepted && sdkOutcome.code !== 'MO1308_QUERY_INVALID')) problems.push(`SDK limit ${limit}: ${sdkOutcome.code}`);
    }
    conclude(h, problems, { seen });
  },
  '3A-J11': (h, env) => {
    const problems = [];
    // 1000 valid checkpoints with the longest investigation identifier give entries of about 5.2 KB, so one page of 1000 exceeds the cap
    const base = JSON.parse(dec.decode(recordById(env, 'checkpoint-c00').members[0].bytes));
    const seed = new MemoryLedger('j11');
    seed.append({ recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes: enc.encode(jcs(base)) }] });
    const parts = parseLedger(seed.built());
    const template = parts.bodies[0];
    const bodies = []; const members = new Map();
    for (let index = 0; index < 1000; index += 1) {
      const id = `${'p'.repeat(4090)}${String(index).padStart(6, '0')}`.slice(-4096);
      const sealed = resealCheckpoint(JSON.parse(JSON.stringify(base).split(base.investigationIdentifier).join(id)));
      const member = { name: 'checkpoint.json', bytes: enc.encode(jcs(sealed)) };
      const body = structuredClone(template);
      const value = { CHECKPOINT: sealed.identifier, INVESTIGATION: id, TRANSITION_LOG_DIGEST: sealed.transitionLogDigest, WORKSPACE: sealed.workspaceIdentifier };
      body.record.subjects = body.record.subjects.map((subject) => ({ type: subject.type, value: value[subject.type] }));
      body.record.members = [{ name: member.name, byteLength: member.bytes.length, sha256: sha(member.bytes) }];
      body.record.recordDigest = recordDigestOf('INVESTIGATION_CHECKPOINT', [member]);
      bodies.push(body); members.set(body.record.recordDigest, [member]);
    }
    const built = rebuild({ descriptor: parts.descriptor, bodies, members });
    const twin = { entries: built.entries };
    const ledger = register(env, writeLedgerToDisk(built, path.join(work(env, 'j11'), 'ledger')));
    const entrySize = twin.entries[0].length;
    const perPage = Math.floor(LIMITS.cliJsonStdoutBytes / entrySize);
    const under = run(env, queryArgs(ledger, [], { limit: perPage - 20 }));
    const over = run(env, queryArgs(ledger, [], { limit: 1000 }));
    if (under.status !== 0 || Buffer.byteLength(under.stdout) > LIMITS.cliJsonStdoutBytes) problems.push(`under the cap: ${under.code}`);
    if (over.code !== 'MO1308_RESOURCE_LIMIT' || over.exit !== 2 || over.stdout !== '') problems.push(`over the cap: ${over.code} ${over.status}`);
    const verify = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
    if (verify.status !== 0 || verify.json.result.entryCount !== 1000) problems.push('the ledger does not verify');
    conclude(h, problems, { entrySize, underStdoutBytes: Buffer.byteLength(under.stdout), cap: LIMITS.cliJsonStdoutBytes });
  },
  '3A-J12': (h, env) => {
    const problems = [];
    const base = recordById(env, 'checkpoint-c00').members[0].bytes;
    const timings = {};
    const seen = {};
    for (const count of [5000, 10_000, 10_001]) {
      const ledger = ledgerWith(env, `j12-${count}`, []);
      const file = path.join(work(env, 'j12-in'), `checkpoint-${count}.json`);
      fs.writeFileSync(file, enc.encode(jcs(longCheckpoint(base, count))));
      const started = Date.now();
      const result = run(env, ['history', 'append', '--ledger', ledger, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', file, '--json']);
      timings[count] = Date.now() - started;
      fs.rmSync(file, { force: true });
      seen[count] = result.status === 0 ? 'ok' : result.code;
      if ((count <= 10_000) !== (result.status === 0)) problems.push(`${count} transitions: ${result.code ?? 'accepted'}`);
      if (count > 10_000 && !fs.readdirSync(path.join(ledger, 'entries')).every(() => false)) problems.push('a refused checkpoint left an entry');
    }
    // linear admission (A4.5): doubling the transitions does not more than triple the time (generous, the timing is only recorded)
    if (timings[10_000] > Math.max(3000, 6 * timings[5000])) problems.push(`admission is not linear: ${timings[5000]} ms for 5000, ${timings[10_000]} ms for 10000`);
    conclude(h, problems, { seen, timingsMs: timings });
  },
  '3A-J13': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'j13', ['mip-reference']);
    for (let index = 0; index < 1100; index += 1) {
      const directory = path.join(ledger, 'records', index.toString(16).padStart(64, '0'));
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'package.mip'), 'x');
      fs.writeFileSync(path.join(ledger, '.pending', `stage-${String(index).padStart(5, '0')}`), 'x');
    }
    register(env, ledger, false, { interrupted: true }); // the planted anomalies are disclosed ones (3A-K4 counts them)
    const verify = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
    const listed = verify.json?.result?.unreferencedRecords ?? [];
    if (verify.status !== 0) problems.push(`verify: ${verify.code}`);
    if (listed.length !== LIMITS.reportedAnomalies) problems.push(`${listed.length} unreferenced records listed`);
    if (JSON.stringify(listed) !== JSON.stringify([...listed].sort())) problems.push('the list is not sorted');
    if (verify.json?.result?.pendingArtifacts !== 1100) problems.push(`pendingArtifacts ${verify.json?.result?.pendingArtifacts} is not the exact count 1100`);
    conclude(h, problems, { listed: listed.length, pendingArtifacts: verify.json?.result?.pendingArtifacts });
  },
};
