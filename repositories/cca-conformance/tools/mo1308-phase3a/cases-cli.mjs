// MO-1308 Phase 3A step B: the CLI contract through real processes. Platform-neutral: the same assertions hold on Windows.
import fs from 'node:fs';
import path from 'node:path';
import { CORPUS_WORKSPACE, MemoryLedger, jcs, appendArgs, contract, fillerBytes, initArgs, queryArgs, readTree, inputFiles } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';

// Baseline: the command set listed by the released help text, with `history` added by MO-1308 (A8 section 33; B1).
export const BASELINE_COMMANDS = ['policy', 'version', 'help', 'observe', 'trace', 'replay', 'compare', 'regression', 'investigate', 'verify', 'import', 'export', 'inspect', 'session'];
const KINDS = { 'mip-reference': 'MIP_PACKAGE', 'checkpoint-c00': 'INVESTIGATION_CHECKPOINT', 'policy-0': 'POLICY_EVALUATION', 'regression-reference': 'REGRESSION_REPORT', 'cicd-6': 'CICD_RUN', 'cicd-4': 'CICD_RUN', 'readiness-ready': 'READINESS_RESULT', 'decision-ready-approve': 'HUMAN_DECISION_CLAIM' };
const helpCommands = (text) => (/Commands:\n([\s\S]*?)\n\n/.exec(text)?.[1] ?? '').split('\n').map((line) => /^ {2}(\S+)/.exec(line)?.[1]).filter(Boolean);
const keys = (json) => Object.keys(json?.result ?? {}).sort();
const errorShape = (json) => json?.ok === false && json.error !== undefined && Object.keys(json.error).sort().join() === 'code,details,exitCode,historyCode,message';

// Fresh ledger with the given corpus records appended through the CLI; returns the path.
function ledgerWith(env, name, ids, { workspace = CORPUS_WORKSPACE, corrupt = false } = {}) {
  const directory = path.join(work(env, 'b'), name);
  const init = run(env, initArgs(directory, name, workspace));
  if (init.status !== 0) throw new Error(`init ${name}: ${init.stderr.slice(0, 120)}`);
  register(env, directory, corrupt);
  for (const id of ids) {
    const result = run(env, appendArgs(directory, recordById(env, id), path.join(work(env, 'in'), `${name}-${id}`)));
    if (result.status !== 0) throw new Error(`append ${id}: ${result.stderr.slice(0, 120)}`);
  }
  return directory;
}
export { ledgerWith };

// One scenario per Freeze 14.1 code that a CLI invocation can reach; returns {code, exit, status, stdout, stderr, json, humanStderr}.
export function failureScenarios(env) {
  if (env.cache.failures !== undefined) return env.cache.failures;
  const base = work(env, 'fail');
  const out = [];
  const record = (code, args, options = {}) => {
    const json = run(env, [...args, '--json'], options);
    const human = run(env, args, options);
    out.push({ code, json, human });
  };
  const good = ledgerWith(env, 'f-good', ['mip-reference']);
  const mipFile = path.join(work(env, 'in'), 'f-good-mip-reference', 'package.mip');
  record('USAGE', ['history', 'append', '--ledger', good]);
  record('RECORD_INVALID', ['history', 'append', '--ledger', good, '--kind', 'MIP_PACKAGE', '--record', (() => { const f = path.join(base, 'garbage.bin'); fs.writeFileSync(f, 'garbage'); return f; })()]);
  record('RECORD_DUPLICATE', ['history', 'append', '--ledger', good, '--kind', 'MIP_PACKAGE', '--record', mipFile]);
  const purged = ledgerWith(env, 'f-purged', ['mip-reference']);
  run(env, ['history', 'tombstone', '--ledger', purged, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-REF', '--json']);
  record('RECORD_PURGED', ['history', 'append', '--ledger', purged, '--kind', 'MIP_PACKAGE', '--record', mipFile]);
  const other = ledgerWith(env, 'f-other', [], { workspace: 'another-workspace' });
  record('WORKSPACE_MISMATCH', ['history', 'append', '--ledger', other, '--kind', 'MIP_PACKAGE', '--record', mipFile]);
  const unbound = ledgerWith(env, 'f-unbound', []);
  const decisionFile = path.join(work(env, 'in'), 'f-decision', 'human-decision.json');
  inputFiles(path.dirname(decisionFile), recordById(env, 'decision-ready-approve'));
  record('DECISION_UNBOUND', ['history', 'append', '--ledger', unbound, '--kind', 'HUMAN_DECISION_CLAIM', '--record', decisionFile]);
  record('TOMBSTONE_INVALID', ['history', 'tombstone', '--ledger', good, '--target', '99', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-REF']);
  const big = path.join(base, 'big.mip'); fs.writeFileSync(big, fillerBytes(contract.RECORD_MEMBER_RULES.MIP_PACKAGE.memberBytes + 1));
  record('RESOURCE_LIMIT', ['history', 'append', '--ledger', good, '--kind', 'MIP_PACKAGE', '--record', big]);
  const corrupt = ledgerWith(env, 'f-corrupt', ['mip-reference'], { corrupt: true });
  const entryFile = path.join(corrupt, 'entries', '00000000000000000000.json');
  const entry = fs.readFileSync(entryFile); const at = entry.indexOf('"entryDigest":"sha256:') + '"entryDigest":"sha256:'.length; entry[at] = entry[at] === 0x30 ? 0x31 : 0x30; fs.writeFileSync(entryFile, entry);
  record('LEDGER_CORRUPT', ['history', 'verify', '--ledger', corrupt]);
  const mismatch = ledgerWith(env, 'f-mismatch', ['mip-reference'], { corrupt: true });
  const members = readTree(path.join(mismatch, 'records'));
  const [member] = [...members.keys()];
  const memberFile = path.join(mismatch, 'records', ...member.split('/')); const bytes = fs.readFileSync(memberFile); bytes[bytes.length - 3] ^= 0x01; fs.writeFileSync(memberFile, bytes);
  record('RECORD_BYTES_MISMATCH', ['history', 'verify', '--ledger', mismatch]);
  const exported = path.join(base, 'export'); run(env, ['history', 'export', '--ledger', good, '--output', exported, '--json']);
  const manifest = path.join(exported, 'memoryos-history-export.json'); const manifestBytes = fs.readFileSync(manifest); manifestBytes[manifestBytes.length - 3] ^= 0x01; fs.writeFileSync(manifest, manifestBytes);
  record('EXPORT_CORRUPT', ['history', 'verify-export', '--export', exported]);
  const version = ledgerWith(env, 'f-version', [], { corrupt: true });
  const descriptor = path.join(version, 'memoryos-history-ledger.json'); fs.writeFileSync(descriptor, fs.readFileSync(descriptor, 'utf8').replace('"version":"1.0.0"', '"version":"9.0.0"'));
  record('VERSION_UNSUPPORTED', ['history', 'verify', '--ledger', version]);
  record('LEDGER_EXISTS', ['history', 'init', '--ledger', good, '--name', 'x', '--workspace', CORPUS_WORKSPACE]);
  record('LEDGER_NOT_FOUND', ['history', 'verify', '--ledger', path.join(base, 'absent')]);
  record('FILESYSTEM_BOUNDARY', ['history', 'init', '--ledger', path.join(base, 'no', 'parent', 'ledger'), '--name', 'x', '--workspace', CORPUS_WORKSPACE]);
  record('IO', ['history', 'append', '--ledger', good, '--kind', 'MIP_PACKAGE', '--record', path.join(base, 'missing.mip')]);
  env.cache.failures = out;
  return out;
}

// Codes a CLI invocation cannot reach deterministically, with the reason (the case asserts the catalog has nothing else).
export const UNREACHABLE = Object.freeze({
  QUERY_INVALID: 'the CLI grammar rejects a malformed query flag first, as USAGE (the SDK gives QUERY_INVALID, 3A-J10)',
  LEDGER_CONFLICT: 'a race outcome; deterministic only under concurrency (3A-F)',
  INTERNAL: 'reachable only by an engine defect',
});

export const cliCases = {
  '3A-B1': (h, env) => {
    const problems = [];
    const version = run(env, ['--version']);
    if (version.status !== 0 || !/cliVersion: 1\.2\.0/.test(version.stdout) || !/sdkVersion: 1\.2\.0/.test(version.stdout)) problems.push('--version is not 1.2.0');
    const help = run(env, ['--help']);
    const names = helpCommands(help.stdout);
    if (!names.includes('history')) problems.push('help does not list history');
    const others = names.filter((name) => name !== 'history');
    if (JSON.stringify(others) !== JSON.stringify(BASELINE_COMMANDS)) problems.push(`the baseline command set changed: ${others.join(',')}`);
    const helpHistory = run(env, ['help', 'history']);
    if (helpHistory.status !== 0) problems.push('help history failed');
    conclude(h, problems, { commands: names });
  },
  '3A-B2': (h, env) => {
    const problems = [];
    const base = work(env, 'b2');
    const ledger = path.join(base, 'ledger');
    const ok = run(env, initArgs(ledger, 'b2'));
    register(env, ledger);
    if (ok.status !== 0 || keys(ok.json).join() !== 'ledgerIdentifier' || !/^sha256:[0-9a-f]{64}$/.test(ok.json.result.ledgerIdentifier)) problems.push('init success shape');
    const again = run(env, initArgs(ledger, 'b2'));
    if (again.code !== 'MO1308_LEDGER_EXISTS' || again.exit !== 4) problems.push(`second init: ${again.code}`);
    const orphan = path.join(base, 'no', 'parent', 'l');
    const parent = run(env, initArgs(orphan, 'b2'));
    if (parent.code !== 'MO1308_FILESYSTEM_BOUNDARY' || fs.existsSync(path.join(base, 'no'))) problems.push(`missing parent: ${parent.code}`);
    for (const [label, args] of [['Bad Name', initArgs(path.join(base, 'bn'), 'Bad Name')], ['empty workspace', initArgs(path.join(base, 'ew'), 'ok', '')], ['no flags', ['history', 'init', '--json']]]) {
      const result = run(env, args);
      if (result.code !== 'MO1308_USAGE' || result.exit !== 1) problems.push(`${label}: ${result.code}`);
    }
    if (fs.existsSync(path.join(base, 'bn')) || fs.existsSync(path.join(base, 'ew'))) problems.push('a refused init created a directory');
    conclude(h, problems, {});
  },
  '3A-B3': (h, env) => {
    const problems = [];
    const ledger = path.join(work(env, 'b3'), 'ledger');
    run(env, initArgs(ledger, 'b3')); register(env, ledger);
    const kinds = new Set();
    let expected = 0;
    for (const [id, kind] of Object.entries(KINDS)) {
      const result = run(env, appendArgs(ledger, recordById(env, id), path.join(work(env, 'in'), `b3-${id}`)));
      if (result.status !== 0 || keys(result.json).join() !== 'entryDigest,index' || result.json.result.index !== expected) problems.push(`append ${id}: ${result.code ?? result.status}`);
      kinds.add(kind); expected += 1;
    }
    if (kinds.size !== 7) problems.push(`${kinds.size} kinds`);
    const cicd6 = fs.readdirSync(path.join(work(env, 'in'), 'b3-cicd-6')).length; const cicd4 = fs.readdirSync(path.join(work(env, 'in'), 'b3-cicd-4')).length;
    if (cicd6 !== 6 || cicd4 !== 4) problems.push(`cicd member counts ${cicd6}/${cicd4}`);
    const verify = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
    if (verify.status !== 0 || verify.json.result.entryCount !== expected) problems.push('verify after appends');
    conclude(h, problems, { kinds: [...kinds].sort(), entries: expected });
  },
  '3A-B4': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'b4', []);
    const decisionDir = (id) => path.join(work(env, 'in'), `b4-${id}`);
    const append = (id) => run(env, appendArgs(ledger, recordById(env, id), decisionDir(id)));
    const unbound = append('decision-ready-approve');
    if (unbound.code !== 'MO1308_DECISION_UNBOUND' || unbound.exit !== 2) problems.push(`unbound: ${unbound.code}`);
    if (append('readiness-ready').status !== 0) problems.push('readiness append');
    const consistent = append('decision-ready-approve');
    // APPROVE is contrary only to a readiness that is not READY or READY_WITH_QUALIFICATIONS (MO-1307 section 13).
    const notReady = append('readiness-not-ready');
    const contrary = append('decision-not-ready-approve');
    if (consistent.status !== 0 || notReady.status !== 0 || contrary.status !== 0) problems.push(`decision appends: ${consistent.code} ${notReady.code} ${contrary.code}`);
    const query = run(env, queryArgs(ledger, ['--kind', 'HUMAN_DECISION_CLAIM'], { limit: 10 }));
    const labels = (query.json?.result?.entries ?? []).map((entry) => entry.decisionConsistency);
    if (JSON.stringify(labels) !== JSON.stringify(['CONSISTENT', 'CONTRARY_TO_READINESS'])) problems.push(`labels ${labels.join(',')}`);
    conclude(h, problems, { labels });
  },
  '3A-B5': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'b5', ['mip-reference', 'checkpoint-c00', 'policy-0', 'regression-reference', 'cicd-6']);
    const bad = [['verify without --ledger', ['history', 'verify', '--json']], ['query without --retention', ['history', 'query', '--ledger', ledger, '--from', '0', '--limit', '5', '--json']], ['query without --from', ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--limit', '5', '--json']], ['query without --limit', ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--json']]];
    for (const [label, args] of bad) { const result = run(env, args); if (result.code !== 'MO1308_USAGE' || result.exit !== 1) problems.push(`${label}: ${result.code}`); }
    const all = run(env, queryArgs(ledger, [], { limit: 1000 }));
    const indices = (all.json?.result?.entries ?? []).map((entry) => entry.index);
    if (JSON.stringify(indices) !== '[0,1,2,3,4]') problems.push(`order ${indices}`);
    const kind = run(env, queryArgs(ledger, ['--kind', 'POLICY_EVALUATION'], { limit: 10 }));
    if ((kind.json?.result?.entries ?? []).some((entry) => entry.recordKind !== 'POLICY_EVALUATION') || kind.json?.result?.entries?.length !== 1) problems.push('kind filter');
    const subject = run(env, queryArgs(ledger, ['--subject-type', 'WORKSPACE', '--subject', CORPUS_WORKSPACE], { limit: 10 }));
    if (subject.status !== 0 || (subject.json?.result?.entries?.length ?? 0) === 0) problems.push('subject filter');
    const first = run(env, queryArgs(ledger, [], { limit: 2 }));
    const next = first.json?.result?.nextIndex;
    const second = run(env, queryArgs(ledger, [], { from: next, limit: 2 }));
    const paged = [...(first.json?.result?.entries ?? []), ...(second.json?.result?.entries ?? [])].map((entry) => entry.index);
    if (JSON.stringify(paged) !== '[0,1,2,3]' || next !== 2) problems.push(`paging ${paged} next ${next}`);
    conclude(h, problems, { nextIndex: next });
  },
  '3A-B6': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'b6', ['mip-reference', 'checkpoint-c00']);
    const before = path.join(work(env, 'b6x'), 'before'); fs.cpSync(ledger, before, { recursive: true });
    const tomb = run(env, ['history', 'tombstone', '--ledger', ledger, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-B6', '--json']);
    if (tomb.status !== 0 || keys(tomb.json).join() !== 'entryDigest,index') problems.push('tombstone shape');
    const exportDir = path.join(work(env, 'b6x'), 'export');
    const exported = run(env, ['history', 'export', '--ledger', ledger, '--output', exportDir, '--json']);
    if (exported.status !== 0 || keys(exported.json).join() !== 'entryCount,headDigest,ledgerIdentifier') problems.push('export shape');
    const verified = run(env, ['history', 'verify-export', '--export', exportDir, '--json']);
    if (verified.status !== 0 || verified.json.result.purgedRecords !== 1 || verified.json.result.tombstones !== 1) problems.push('verify-export shape');
    // A purgePending state: the tombstone is committed but the purged member is back on disk (as after a kill before deletion).
    const pending = path.join(work(env, 'b6x'), 'pending'); fs.cpSync(ledger, pending, { recursive: true }); register(env, pending);
    const target = [...readTree(path.join(before, 'records')).keys()].filter((relative) => !readTree(path.join(ledger, 'records')).has(relative));
    for (const relative of target) { const file = path.join(pending, 'records', ...relative.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.copyFileSync(path.join(before, 'records', ...relative.split('/')), file); }
    const reported = run(env, ['history', 'verify', '--ledger', pending, '--json']);
    if (target.length === 0 || (reported.json?.result?.purgePending ?? []).length !== 1) problems.push(`purgePending not reported (${target.length} members restored)`);
    const finished = run(env, ['history', 'tombstone', '--ledger', pending, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-B6', '--json']);
    const after = run(env, ['history', 'verify', '--ledger', pending, '--json']);
    if (finished.status !== 0 || after.json?.result?.entryCount !== 3 || (after.json?.result?.purgePending ?? ['x']).length !== 0) problems.push(`finishing a purgePending tombstone: ${finished.code ?? finished.status}, entries ${after.json?.result?.entryCount}`);
    conclude(h, problems, { restoredMembers: target.length });
  },
  '3A-B7': (h, env) => {
    const problems = [];
    const scenarios = failureScenarios(env);
    const catalog = contract.MEMORYOS_HISTORY_ERRORS;
    const reached = new Set();
    for (const { code, json, human } of scenarios) {
      const entry = catalog[code];
      if (entry === undefined) { problems.push(`${code}: not in the catalog`); continue; }
      reached.add(code);
      if (json.code !== `MO1308_${code}`) problems.push(`${code}: reached ${json.code}`);
      if (json.status !== entry.exitCode || json.exit !== entry.exitCode) problems.push(`${code}: exit ${json.status}/${json.exit}`);
      if (json.json?.error?.message !== entry.message) problems.push(`${code}: message`);
      if (!errorShape(json.json)) problems.push(`${code}: JSON error shape`);
      if (human.status !== entry.exitCode || !human.stderr.includes(entry.message)) problems.push(`${code}: human output`);
    }
    const missing = Object.keys(catalog).filter((code) => !reached.has(code) && UNREACHABLE[code] === undefined);
    if (missing.length > 0) problems.push(`no scenario for ${missing.join(',')}`);
    const extra = Object.keys(UNREACHABLE).filter((code) => reached.has(code));
    if (extra.length > 0) problems.push(`declared unreachable but reached: ${extra.join(',')}`);
    conclude(h, problems, { reached: [...reached].sort(), unreachable: UNREACHABLE });
  },
  '3A-B8': (h, env) => {
    const problems = [];
    const outputs = failureScenarios(env).flatMap(({ code, json, human }) => [[code, json.stdout + json.stderr], [code, human.stdout + human.stderr]]);
    const forbidden = [env.workRoot, path.resolve(env.workRoot).split(path.sep).join('/'), env.repo, 'garbage', '    at ', 'Error:', 'node:internal', 'ENOENT', 'EEXIST', 'errno', 'syscall'];
    for (const [code, text] of outputs) for (const needle of forbidden) if (needle !== '' && text.includes(needle)) problems.push(`${code}: output contains ${needle.slice(0, 20)}`);
    conclude(h, problems, { outputs: outputs.length });
  },
  '3A-B9': (h, env) => {
    const problems = [];
    const source = fs.readFileSync(path.join(env.repo, 'repositories/memoryos-cli/src/session.js'), 'utf8');
    if (/history/i.test(source)) problems.push('session.js names history');
    if (/writeFile|appendFile|mkdir|createWriteStream|copyFile|rename/.test(source)) problems.push('session.js writes to the filesystem');
    const help = run(env, ['help', 'session']);
    if (help.status !== 0) problems.push('help session failed');
    const empty = run(env, ['session'], { input: '' });
    if (empty.status !== 0) problems.push(`session on empty input: ${empty.status}`);
    conclude(h, problems, {});
  },
  '3A-B10': (h, env) => {
    const problems = [];
    const ids = ['mip-reference', 'checkpoint-c00', 'policy-0', 'regression-reference', 'cicd-6', 'readiness-ready', 'decision-ready-approve'];
    const ledger = ledgerWith(env, 'b10', ids);
    const twin = new MemoryLedger('b10');
    for (const id of ids) twin.append(recordById(env, id));
    const files = readTree(ledger);
    twin.entries.forEach((bytes, index) => { const disk = files.get(`entries/${String(index).padStart(20, '0')}.json`); if (disk === undefined || Buffer.compare(Buffer.from(bytes), disk) !== 0) problems.push(`entry ${index} differs`); });
    if (Buffer.compare(Buffer.from(twin.descriptorBytes), files.get('memoryos-history-ledger.json')) !== 0) problems.push('descriptor differs');
    const query = run(env, queryArgs(ledger, [], { limit: 1000 }));
    const sdkQuery = twin.query({ kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: 1000 });
    if (jcs(query.json.result) !== jcs(JSON.parse(JSON.stringify(sdkQuery)))) problems.push('query results differ');
    const exportDir = path.join(work(env, 'b10x'), 'export');
    run(env, ['history', 'export', '--ledger', ledger, '--output', exportDir, '--json']);
    const exportFiles = readTree(exportDir);
    for (const file of twin.export().files) { const disk = exportFiles.get(file.path); if (disk === undefined || Buffer.compare(Buffer.from(file.bytes), disk) !== 0) problems.push(`export file ${file.path} differs`); }
    if (exportFiles.size !== twin.export().files.length) problems.push('export file count differs');
    conclude(h, problems, { entries: twin.entries.length, exportFiles: exportFiles.size });
  },
};
