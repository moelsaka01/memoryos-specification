// MO-1308 Phase 3C step H (data-class audit): canaries are planted in the environment, the paths, the cwd, the input file names and
// the host identity, the full CLI is run (successes and every failure class), and every MO-1308-authored byte and every output
// is scanned. Retained member bytes are the producer's and are excluded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { work, recordById, conclude, memo, CANARIES } from './env.mjs';
import { cli, appendArgs, readTree, dec, enc, sha, CORPUS_WORKSPACE } from './support.mjs';
import { scanAuthoredJson, scanText, SKIP_RESULT } from './scanner.mjs';

const KINDS = [['policy-0'], ['readiness-ready'], ['decision-ready-approve'], ['regression-reference'], ['mip-reference'], ['checkpoint-c00'], ['cicd-6']];
const tombstone = (ledger, target) => ['history', 'tombstone', '--ledger', ledger, '--target', String(target), '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3C-DATA-CLASS', '--json'];

export function runtimeCanaries(env) {
  const out = [];
  const add = (cls, value) => { if (typeof value === 'string' && value.length >= 4 && !out.some((item) => item.value === value)) out.push({ class: cls, value }); };
  try { add('USER', os.userInfo().username); } catch { /* no user database */ }
  add('HOST', os.hostname());
  add('HOME', os.homedir());
  add('TMPDIR', os.tmpdir());
  add('WORKTREE', env.repo);
  return out;
}

// The scenario: everything runs under planted canaries; outputs and authored files are collected for H2, H3 and H5.
export function scenario(env) {
  return memo(env, 'data-scenario', () => {
    const planted = (cls) => CANARIES.find((item) => item.class === cls).value;
    const root = path.join(work(env), planted('PATH_SEGMENT'));
    const cwd = path.join(root, `cwd-${planted('PATH_SEGMENT')}`);
    fs.mkdirSync(cwd, { recursive: true });
    const environment = {
      USERNAME: planted('USER'), USER: planted('USER'), LOGNAME: planted('USER'), COMPUTERNAME: planted('HOST'), HOSTNAME: planted('HOST'),
      P3C_ENVIRONMENT: planted('ENVIRONMENT'), P3C_SECRET: planted('SECRET'), P3C_URL: planted('URL'), P3C_DATE: planted('DATE_TIME'), P3C_EPOCH: planted('EPOCH_MILLISECONDS'),
      HOME: path.join(root, 'home'), USERPROFILE: path.join(root, 'home'),
    };
    const canaries = [...CANARIES, ...runtimeCanaries(env)];
    const run = (args) => cli(args, { cwd, env: environment });
    const ledger = path.join(root, 'ledger');
    const outputs = [];
    const record = (label, result) => { outputs.push({ label, status: result.status, stdout: result.stdout, stderr: result.stderr }); return result; };
    record('init', run(['history', 'init', '--ledger', ledger, '--name', 'p3c-data', '--workspace', CORPUS_WORKSPACE, '--json']));
    // inputs carry the canary in their directory and file names
    const inputs = path.join(root, 'inputs');
    for (const [id] of KINDS) {
      const named = path.join(inputs, `${planted('FILE_NAME').replace(/\.bin$/, '')}-${id}`);
      record(`append ${id}`, run(appendArgs(ledger, recordById(env, id), named)));
    }
    record('tombstone', run(tombstone(ledger, 0)));
    record('verify', run(['history', 'verify', '--ledger', ledger, '--json']));
    record('query', run(['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '100', '--json']));
    const exported = path.join(root, 'export');
    record('export', run(['history', 'export', '--ledger', ledger, '--output', exported, '--json']));
    record('verify-export', run(['history', 'verify-export', '--export', exported, '--json']));
    // human (non-JSON) output of the same operations
    record('verify human', run(['history', 'verify', '--ledger', ledger]));
    record('query human', run(['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10']));
    // every failure class, with the canaries in the paths
    const failure = (label, args) => record(`failure ${label}`, run(args));
    failure('usage', ['history', 'append', '--ledger', ledger, '--json']);
    failure('missing-ledger', ['history', 'verify', '--ledger', path.join(root, 'missing', 'ledger'), '--json']);
    failure('exists', ['history', 'init', '--ledger', ledger, '--name', 'x', '--workspace', 'w', '--json']);
    failure('duplicate', appendArgs(ledger, recordById(env, 'readiness-ready'), path.join(inputs, 'dup')));
    failure('invalid-record', ['history', 'append', '--ledger', ledger, '--kind', 'MIP_PACKAGE', '--record', path.join(inputs, `${planted('FILE_NAME')}-policy-0`, 'policy-outcome.json'), '--json']);
    failure('missing-input-file', ['history', 'append', '--ledger', ledger, '--kind', 'MIP_PACKAGE', '--record', path.join(root, `no-such-${planted('FILE_NAME')}`), '--json']);
    failure('tombstone-invalid', tombstone(ledger, 99));
    failure('export-exists', ['history', 'export', '--ledger', ledger, '--output', exported, '--json']);
    failure('verify-export-missing', ['history', 'verify-export', '--export', path.join(root, 'no-export'), '--json']);
    const damaged = path.join(root, 'damaged');
    fs.cpSync(ledger, damaged, { recursive: true });
    const first = fs.readdirSync(path.join(damaged, 'entries')).sort()[1];
    const target = path.join(damaged, 'entries', first);
    const bytes = fs.readFileSync(target);
    bytes[100] ^= 0x01;
    fs.writeFileSync(target, bytes);
    failure('corrupt-ledger', ['history', 'verify', '--ledger', damaged, '--json']);
    const files = readTree(ledger);
    const authored = new Map();
    for (const [file, content] of files) if (file === 'memoryos-history-ledger.json' || file.startsWith('entries/')) authored.set(`ledger/${file}`, content);
    for (const [file, content] of readTree(exported)) if (!file.startsWith('records/')) authored.set(`export/${file}`, content);
    return { canaries, planted: CANARIES.length, outputs, authored, environmentNames: Object.keys(environment), root };
  });
}

export const data = {
  '3C-H1': (h, env) => {
    const s = scenario(env);
    const problems = [];
    const ok = s.outputs.filter((row) => !row.label.startsWith('failure'));
    const bad = ok.filter((row) => row.status !== 0);
    if (bad.length > 0) problems.push(`operations failed under the planted environment: ${bad.map((row) => row.label).join(', ')}`);
    const failures = s.outputs.filter((row) => row.label.startsWith('failure'));
    if (failures.some((row) => row.status === 0)) problems.push('a failure scenario succeeded');
    const exitCodes = [...new Set(failures.map((row) => row.status))].sort();
    conclude(h, problems, { canaryClasses: [...new Set(s.canaries.map((item) => item.class))].sort(), runtimeCanaries: s.canaries.length - s.planted, operations: ok.length, failureScenarios: failures.length, failureExits: exitCodes, authoredFiles: s.authored.size });
  },
  '3C-H2': (h, env) => {
    const s = scenario(env);
    const findings = [];
    let scanned = 0;
    for (const [file, bytes] of s.authored) {
      scanned += 1;
      const text = dec.decode(bytes);
      // the authority reference is the one operator-chosen free-text member (3C-H4); it is excluded from the raw-text scan
      findings.push(...scanText(text.replace(/"authorityReference":"[^"]*"/g, '"authorityReference":""'), s.canaries, { label: file }));
      findings.push(...scanAuthoredJson(bytes, s.canaries, { label: file }).findings);
    }
    const unique = [...new Map(findings.map((finding) => [`${finding.label}|${finding.kind}`, finding])).values()];
    conclude(h, unique.slice(0, 5).map((finding) => `${finding.label}: ${finding.kind} (${finding.sample})`), { filesScanned: scanned, findings: unique.length });
  },
  '3C-H3': (h, env) => {
    const s = scenario(env);
    const findings = [];
    for (const row of s.outputs) {
      for (const [channel, text] of [['stdout', row.stdout], ['stderr', row.stderr]]) {
        if (text === '') continue;
        const trimmed = text.trim();
        if (trimmed.startsWith('{')) findings.push(...scanAuthoredJson(trimmed, s.canaries, { label: `${row.label}/${channel}`, skip: SKIP_RESULT }).findings);
        else findings.push(...scanText(text, s.canaries, { label: `${row.label}/${channel}` }));
      }
    }
    for (const row of s.outputs.filter((item) => item.label.startsWith('failure'))) {
      if (row.stdout !== '') findings.push({ label: row.label, kind: 'FAILURE_WROTE_STDOUT', sample: row.stdout.slice(0, 40) });
      const body = JSON.parse(row.stderr);
      if (JSON.stringify(Object.keys(body.error).sort()) !== JSON.stringify(['code', 'details', 'exitCode', 'historyCode', 'message'])) findings.push({ label: row.label, kind: 'ERROR_SHAPE', sample: Object.keys(body.error).join(',') });
      if (body.error.details.length !== 0) findings.push({ label: row.label, kind: 'ERROR_DETAILS', sample: JSON.stringify(body.error.details).slice(0, 40) });
    }
    const unique = [...new Map(findings.map((finding) => [`${finding.label}|${finding.kind}`, finding])).values()];
    conclude(h, unique.slice(0, 5).map((finding) => `${finding.label}: ${finding.kind} (${finding.sample})`), { outputsScanned: s.outputs.length, findings: unique.length });
  },
  '3C-H4': (h, env) => {
    const s = scenario(env);
    const subjectTypes = {};
    const references = [];
    let subjects = 0;
    for (const [file, bytes] of s.authored) {
      if (!file.startsWith('ledger/entries/')) continue;
      const { freeForm } = scanAuthoredJson(bytes, [], { label: file });
      for (const item of freeForm) {
        if (item.kind === 'authorityReference') references.push(item.value);
        else { subjects += 1; subjectTypes[item.kind] = (subjectTypes[item.kind] ?? 0) + 1; }
      }
    }
    const sampleLongest = Math.max(0, ...references.map((value) => value.length));
    conclude(h, [], { freeFormPlaces: 2, subjectValues: subjects, subjectTypes, authorityReferences: references.length, longestAuthorityReference: sampleLongest, note: 'subject values copy owner values; the authority reference is operator text (3C-E9)' });
  },
  '3C-H5': (h, env) => {
    const s = scenario(env);
    const findings = [];
    for (const [file, bytes] of s.authored) {
      const { findings: all } = scanAuthoredJson(bytes, [], { label: file });
      findings.push(...all.filter((finding) => ['ISO_TIMESTAMP', 'DATE', 'EPOCH_SECONDS_OR_MILLISECONDS'].includes(finding.kind)));
      const keys = [];
      const collectKeys = (node) => { if (Array.isArray(node)) node.forEach(collectKeys); else if (node !== null && typeof node === 'object') for (const [key, item] of Object.entries(node)) { keys.push(key); collectKeys(item); } };
      collectKeys(JSON.parse(dec.decode(bytes)));
      for (const key of keys) if (/time|date|clock|stamp|created|updated|modified|expire|observed(at)?/i.test(key)) findings.push({ label: file, kind: 'TIME_LIKE_MEMBER_NAME', sample: key });
    }
    for (const row of s.outputs) for (const text of [row.stdout, row.stderr]) {
      if (!text.trim().startsWith('{')) continue;
      findings.push(...scanAuthoredJson(text, [], { label: row.label, skip: SKIP_RESULT }).findings.filter((finding) => ['ISO_TIMESTAMP', 'DATE', 'EPOCH_SECONDS_OR_MILLISECONDS'].includes(finding.kind)));
    }
    conclude(h, findings.slice(0, 5).map((finding) => `${finding.label}: ${finding.kind} (${finding.sample})`), { filesScanned: s.authored.size, outputsScanned: s.outputs.length, timestampLikeFindings: findings.length });
  },
};
void enc; void sha;
