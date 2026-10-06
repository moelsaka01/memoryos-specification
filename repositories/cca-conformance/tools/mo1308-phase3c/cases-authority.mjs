// MO-1308 Phase 3C steps G (human-authority separation), I (process, network and environment boundaries) and K (release claims).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { work, recordById, conclude, memo } from './env.mjs';
import { cli, observedCli, appendArgs, buildDiskLedger, dec, sdk, MemoryLedger, attempt, CLI, REPOSITORIES } from './support.mjs';
import { tokenize, scanImports } from '../mo1308-phase3/lib/closure.mjs';
import { checkDisclosure, readOutcomes } from '../mo1308-phase3/lib/disclosure.mjs';
import { loadInventory } from '../mo1308-phase3/lib/inventory.mjs';
import { MEMORYOS_HISTORY_ERRORS } from '../../../cca-studio/web/js/memoryos-history-contract.js';
import { scenario } from './cases-data.mjs';

const JS = 'repositories/cca-studio/web/js/';
const HISTORY_MODULES = ['contract', 'ledger', 'admission'].map((name) => `${JS}memoryos-history-${name}.js`);
const CLI_HISTORY = ['history-arguments', 'history-commands', 'history-store'].map((name) => `repositories/memoryos-cli/src/${name}.js`);
const read = (env, file) => fs.readFileSync(path.join(env.repo, file), 'utf8');
const tracked = (env, roots) => execFileSync('git', ['ls-files', '-z', '--', ...roots], { cwd: env.repo, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean);
const codeTokens = (source) => tokenize(source);

export const authority = {
  '3C-G1': (h, env) => {
    // no MO-1307 gate, readiness code, CI package, MCP/REST/VSIX runtime or Action imports or names the history authority
    const roots = ['repositories/memoryos-readiness', 'repositories/memoryos-ci', 'repositories/memoryos-mcp', 'repositories/memoryos-rest', 'repositories/memoryos-vscode', '.github/actions'];
    const problems = [];
    let scanned = 0;
    for (const file of tracked(env, roots).filter((name) => /\.(mjs|js|cjs|ts|json|ps1|yml)$/.test(name))) {
      scanned += 1;
      if (/memoryos-history|createHistoryLedger|admitHistoryRecord|appendHistoryEntry|verifyHistoryLedger|queryHistoryLedger|tombstoneHistoryEntry/.test(read(env, file))) problems.push(`${file} names the history authority`);
    }
    conclude(h, problems.slice(0, 6), { packageRoots: roots.length, filesScanned: scanned });
  },
  '3C-G3': (h, env) => {
    const words = /\b(approv\w*|grant\w*|authori[sz]\w*|certif\w*|release\w*|sign(?:ed|ature)?|attest\w*)\b/i;
    const problems = [];
    const help = cli(['help', 'history']);
    const text = `${help.stdout}${help.stderr}`;
    if (help.status !== 0) problems.push(`help history exited ${help.status}`);
    const subcommands = [...text.matchAll(/memoryos history (\w[\w-]*)/g)].map((match) => match[1]);
    if (subcommands.some((name) => /approve|grant|accept|authorize|release|sign|certify/.test(name))) problems.push(`a history subcommand has approval semantics: ${subcommands.join(',')}`);
    if (words.test(text)) problems.push(`the history help uses an approval word: ${text.match(words)[0]}`);
    const messages = Object.values(MEMORYOS_HISTORY_ERRORS).map((row) => row.message ?? '').filter(Boolean);
    for (const message of messages) if (words.test(message)) problems.push(`an error message uses an approval word: ${message}`);
    // success results of every command: member names and values (outside retained data) carry no approval word
    const s = scenario(env);
    for (const row of s.outputs.filter((item) => item.status === 0 && item.stdout.trim().startsWith('{'))) {
      const body = JSON.parse(row.stdout);
      const names = [];
      const collect = (node) => { if (Array.isArray(node)) node.forEach(collect); else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) { names.push(key); collect(value); } };
      collect(body);
      if (names.some((name) => words.test(name))) problems.push(`${row.label}: a result member name uses an approval word`);
    }
    // exit codes: one category per class, none for approval
    const exits = new Set(s.outputs.map((row) => row.status));
    for (const exit of exits) if (![0, 1, 2, 3, 4, 5].includes(exit)) problems.push(`unexpected exit ${exit}`);
    conclude(h, problems, { subcommands, errorMessages: messages.length, resultsScanned: s.outputs.length, exits: [...exits].sort() });
  },
  '3C-G4': (h, env) => {
    const files = ['repositories/memoryos-cli/README.md', ...fs.readdirSync(path.join(env.repo, 'repositories/memoryos-cli/docs')).filter((name) => name.endsWith('.md')).map((name) => `repositories/memoryos-cli/docs/${name}`), 'docs/mo1308-release-disclosures.md']
      .filter((file) => fs.existsSync(path.join(env.repo, file)));
    const mentions = files.filter((file) => /decisionConsistency/.test(read(env, file)));
    const problems = [];
    if (mentions.length === 0) problems.push('PENDING: no CLI documentation mentions decisionConsistency yet (the history namespace is undocumented)');
    for (const file of mentions) {
      const text = read(env, file);
      const around = [...text.matchAll(/decisionConsistency/g)].map((match) => text.slice(Math.max(0, match.index - 300), match.index + 500));
      if (!around.some((chunk) => /informational/i.test(chunk) && /(does not|never|not an?)\s+[^.]{0,80}(approval|authori[sz]ation|release)/i.test(chunk))) problems.push(`${file}: decisionConsistency is not described as informational and not an approval`);
    }
    const query = scenario(env).outputs.find((row) => row.label === 'query');
    const label = JSON.parse(query.stdout).result.entries.find((entry) => entry.decisionConsistency !== null)?.decisionConsistency ?? null;
    if (label !== null && !['CONSISTENT', 'CONTRARY_TO_READINESS'].includes(label)) problems.push(`the rendered label is ${label}`);
    conclude(h, problems, { documentsMentioning: mentions, renderedLabel: label });
  },
  '3C-G5': (h, env) => {
    const problems = [];
    for (const file of HISTORY_MODULES) {
      const tokens = codeTokens(read(env, file));
      if (tokens.some((token) => token.type === 'word' && ['verifyReadiness', 'inspectWindows', 'spawn', 'spawnSync', 'exec', 'execFile'].includes(token.value))) problems.push(`${file}: names a readiness verifier or spawns a process`);
      if (tokens.some((token) => token.type === 'string' && /windows-inspect|\.ps1|powershell|memoryos-readiness(?!-result\.json)/i.test(token.value))) problems.push(`${file}: a string names the readiness package or its helper`);
      for (const specifier of scanImports(read(env, file)).specifiers) if (/readiness|ci|windows/i.test(specifier)) problems.push(`${file}: imports ${specifier}`);
    }
    // runtime: appending a READINESS_RESULT and a HUMAN_DECISION_CLAIM starts no process
    const ledger = buildDiskLedger(work(env), 'p3c-g5', []);
    const counts = [];
    for (const id of ['readiness-ready', 'decision-ready-approve']) {
      const run = observedCli(appendArgs(ledger, recordById(env, id), path.join(work(env), id)));
      counts.push(run.counts);
      if (run.status !== 0 || run.counts === null || run.counts.childProcess !== 0) problems.push(`${id}: exit ${run.status}, child processes ${run.counts?.childProcess}`);
    }
    conclude(h, problems, { modulesScanned: HISTORY_MODULES.length, runtimeCounts: counts });
  },
  '3C-G6': (h, env) => {
    const problems = [];
    for (const file of [...HISTORY_MODULES, ...CLI_HISTORY]) {
      if (codeTokens(read(env, file)).some((token) => token.type === 'word' && /^restore/i.test(token.value))) problems.push(`${file}: refers to restore`);
    }
    // the SDK history functions and the checkpoint-record method never call restore
    const sdkSource = read(env, `${JS}memoryos-sdk.js`);
    const historyRegions = [...sdkSource.matchAll(/export function (\w*History\w*)\(/g)].map((match) => {
      const start = match.index;
      const end = sdkSource.indexOf('\n}\n', start);
      return { name: match[1], text: sdkSource.slice(start, end) };
    });
    const method = /createHistoryCheckpointRecord\([^)]*\)\s*\{/.exec(sdkSource);
    if (method !== null) historyRegions.push({ name: 'createHistoryCheckpointRecord', text: sdkSource.slice(method.index, sdkSource.indexOf('\n  }\n', method.index)) });
    for (const region of historyRegions) if (/\brestore\b/.test(region.text)) problems.push(`${region.name} refers to restore`);
    // a checkpoint record is not a restore source: the SDK refuses it
    const memory = new sdk.MemoryOS();
    const checkpoint = memory.importPackage(recordById(env, 'mip-reference').members[0].bytes, { identifier: 'p3c-g6' }).checkpoint();
    const record = memory.createHistoryCheckpointRecord(checkpoint);
    const refused = [
      attempt(() => new sdk.MemoryOS().restore(JSON.parse(dec.decode(record)))),
      attempt(() => new sdk.MemoryOS().restore(record)),
      attempt(() => memory.restore(JSON.parse(dec.decode(record)))),
    ];
    refused.forEach((outcome, index) => { if (outcome.accepted) problems.push(`restore accepted a history checkpoint record (variant ${index})`); });
    conclude(h, problems, { filesScanned: HISTORY_MODULES.length + CLI_HISTORY.length, sdkHistoryRegions: historyRegions.length, restoreRefusals: refused.map((outcome) => outcome.code ?? 'REFUSED') });
  },

  // ---- I ----
  '3C-I1': (h, env) => {
    const BANNED_IMPORTS = /^node:(child_process|net|http|https|http2|dns|tls|dgram|cluster|worker_threads|vm|v8|inspector|repl)$/;
    const BANNED_WORDS = new Set(['eval', 'child_process', 'XMLHttpRequest', 'WebSocket', 'fetch', 'require', 'Function', 'Deno', 'Bun']);
    const files = [...HISTORY_MODULES, ...CLI_HISTORY, `${JS}memoryos-sdk.js`, 'repositories/memoryos-cli/src/main.js', 'repositories/memoryos-cli/src/commands.js'];
    const problems = [];
    const observed = {};
    for (const file of files) {
      const source = read(env, file);
      const { specifiers, dynamicNonLiteral } = scanImports(source);
      const tokens = codeTokens(source);
      const found = new Set();
      tokens.forEach((token, index) => {
        if (token.type !== 'word') return;
        const before = tokens[index - 1];
        const after = tokens[index + 1];
        if (before?.type === 'punct' && before.value === '.') return;
        if (after?.type === 'punct' && after.value === ':') return;
        if (BANNED_WORDS.has(token.value)) found.add(token.value);
        if (token.value === 'process' && after?.type === 'punct' && after.value === '.' && tokens[index + 2]?.value === 'env') found.add('process.env');
        if (token.value === 'process' && after?.type === 'punct' && after.value === '.' && /^(binding|dlopen|kill|abort|exit)$/.test(tokens[index + 2]?.value ?? '')) found.add(`process.${tokens[index + 2].value}`);
      });
      observed[path.basename(file)] = { imports: specifiers.filter((s) => s.startsWith('node:')), dynamicImports: dynamicNonLiteral, banned: [...found] };
      for (const specifier of specifiers) if (BANNED_IMPORTS.test(specifier)) problems.push(`${file}: imports ${specifier}`);
      if (dynamicNonLiteral > 0) problems.push(`${file}: dynamic import`);
      if (/\bnew\s+Function\b/.test(tokens.map((token) => token.value).join(' ').replace(/\s+/g, ' ')) && file !== 'repositories/memoryos-cli/src/main.js') problems.push(`${file}: new Function`);
      for (const word of found) if (word !== 'Function') problems.push(`${file}: uses ${word}`);
    }
    conclude(h, problems.slice(0, 6), { filesScanned: files.length, files: observed });
  },
  '3C-I2': (h, env) => {
    const directory = work(env);
    const ledger = path.join(directory, 'ledger');
    const operations = [
      ['init', ['history', 'init', '--ledger', ledger, '--name', 'p3c-i2', '--workspace', 'workspace-investigation', '--json']],
      ...['policy-0', 'readiness-ready', 'decision-ready-approve', 'regression-reference', 'mip-reference', 'checkpoint-c00', 'cicd-6'].map((id) => [`append ${id}`, () => appendArgs(ledger, recordById(env, id), path.join(directory, id))]),
      ['tombstone', ['history', 'tombstone', '--ledger', ledger, '--target', '0', '--reason', 'DATA_MINIMIZATION', '--authority-reference', 'P3C', '--json']],
      ['verify', ['history', 'verify', '--ledger', ledger, '--json']],
      ['query', ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10', '--json']],
      ['export', ['history', 'export', '--ledger', ledger, '--output', path.join(directory, 'export'), '--json']],
      ['verify-export', ['history', 'verify-export', '--export', path.join(directory, 'export'), '--json']],
      ['failure', ['history', 'verify', '--ledger', path.join(directory, 'nothing'), '--json']],
    ];
    const problems = [];
    const totals = { childProcess: 0, networkConnections: 0, dnsLookups: 0, workerThreads: 0 };
    for (const [label, args] of operations) {
      const run = observedCli(typeof args === 'function' ? args() : args);
      if (run.counts === null) { problems.push(`${label}: the observer wrote no counts`); continue; }
      for (const key of Object.keys(totals)) totals[key] += run.counts[key];
      if (label !== 'failure' && run.status !== 0) problems.push(`${label}: exit ${run.status}`);
    }
    for (const [key, value] of Object.entries(totals)) if (value !== 0) problems.push(`${key}: ${value}`);
    conclude(h, problems, { operations: operations.length, totals, observer: 'process-observer.cjs (child_process, net, dns, worker_threads)' });
  },
  '3C-I3': (h, env) => {
    // No environment variable is read by the CLI or the Studio modules it loads, so there is nothing to whitelist; a secret canary
    // placed in the environment never reaches an output (3C-H3 scans every output; this case checks the secret specifically).
    const problems = [];
    const files = tracked(env, ['repositories/memoryos-cli/src', 'repositories/memoryos-cli/bin', 'repositories/cca-studio/web/js']).filter((name) => name.endsWith('.js'));
    const reads = [];
    for (const file of files) {
      const tokens = codeTokens(read(env, file));
      tokens.forEach((token, index) => { if (token.type === 'word' && token.value === 'process' && tokens[index + 1]?.value === '.' && tokens[index + 2]?.value === 'env') reads.push(file); });
    }
    if (reads.length > 0) problems.push(`environment reads in: ${[...new Set(reads)].join(', ')}`);
    const s = scenario(env);
    const secrets = s.canaries.filter((item) => ['SECRET', 'ENVIRONMENT', 'USER', 'HOST'].includes(item.class));
    let leaks = 0;
    for (const row of s.outputs) for (const secret of secrets) if (row.stdout.includes(secret.value) || row.stderr.includes(secret.value)) leaks += 1;
    for (const [, bytes] of s.authored) for (const secret of secrets) if (dec.decode(bytes).includes(secret.value)) leaks += 1;
    if (leaks > 0) problems.push(`${leaks} secret or identity canary leaks`);
    conclude(h, problems, { filesScanned: files.length, environmentReads: reads.length, whitelist: [], canariesChecked: secrets.length, leaks });
  },

  // ---- K: release claims (documentation is written after the 3A and 3C outcomes are recorded) ----
  '3C-K1': (h, env) => {
    const disclosures = 'docs/mo1308-release-disclosures.md';
    const problems = [];
    if (!fs.existsSync(path.join(env.repo, disclosures))) problems.push(`PENDING: ${disclosures} does not exist yet`);
    else {
      const text = read(env, disclosures);
      const inventory = loadInventory(path.join(env.repo, 'repositories/cca-conformance/mo1308-phase3-inventory.json'));
      for (const row of inventory.qualifications) if (!new RegExp(`\\b${row.id}\\b`).test(text)) problems.push(`${row.id} is missing from the disclosures`);
    }
    const OVERCLAIM = /tamper[- ]?proof|\bencrypt(?:ed|ion)\b|\bsigned\b|\bauthenticat(?:ed|ion)\b|multi-user|shared storage|cloud (?:sync|storage|backup)|CCA-MEMORYOS-1\.0 (?:conformant|compliant)/i;
    const NEGATION = /\b(no|not|never|without|does not|cannot|isn't|excluded|out of scope|NOT_VERIFIED_BY_MEMORYOS|re-review|before any)\b/i;
    const documents = ['README.md', 'ROADMAP.md', 'RELEASE_NOTES.md', 'KNOWN_ISSUES.md', 'ARCHITECTURE.md', 'repositories/memoryos-cli/README.md', ...fs.readdirSync(path.join(env.repo, 'repositories/memoryos-cli/docs')).filter((n) => n.endsWith('.md')).map((n) => `repositories/memoryos-cli/docs/${n}`)];
    const overclaims = [];
    for (const file of documents.filter((name) => fs.existsSync(path.join(env.repo, name)))) {
      const lines = read(env, file).split('\n');
      lines.forEach((line, index) => {
        if (/MO-1308|history ledger|Investigation History|memoryos history/i.test(line) && OVERCLAIM.test(line) && !NEGATION.test(line)) overclaims.push(`${file}:${index + 1}`);
      });
    }
    for (const where of overclaims.slice(0, 5)) problems.push(`${where}: a claim beyond the Freeze`);
    conclude(h, problems, { documentsScanned: documents.length, overclaims: overclaims.length });
  },
  '3C-K2': (h, env) => {
    const candidates = ['repositories/memoryos-cli/README.md', 'repositories/memoryos-cli/docs/history-guide.md', 'docs/mo1308-release-disclosures.md'].filter((file) => fs.existsSync(path.join(env.repo, file)));
    const guided = candidates.filter((file) => /headDigest/.test(read(env, file)) && /(outside the ledger|external(ly)?|separate system)/i.test(read(env, file)));
    const problems = [];
    if (guided.length === 0) problems.push('PENDING: no CLI document gives the headDigest anchoring guidance yet');
    const outcomes = readOutcomes([env.evidenceDir ?? '']);
    const outcome = outcomes.get('3C-A6') ?? null;
    if (outcome === null) problems.push('3C-A6 has no recorded outcome in this generation');
    for (const file of guided) {
      const text = read(env, file);
      const states = new RegExp('3C-A6:\\s+(CONFIRMED|NOT_CONFIRMED)').exec(text)?.[1] ?? null;
      if (outcome !== null && states !== outcome) problems.push(`${file}: states ${states} for 3C-A6 but the recorded outcome is ${outcome}`);
    }
    conclude(h, problems, { guidanceIn: guided, recordedOutcome: outcome });
  },
  '3C-K3': (h, env) => {
    const disclosures = 'docs/mo1308-release-disclosures.md';
    const problems = [];
    const inventory = loadInventory(path.join(env.repo, 'repositories/cca-conformance/mo1308-phase3-inventory.json'));
    if (!fs.existsSync(path.join(env.repo, disclosures))) problems.push(`PENDING: ${disclosures} does not exist yet`);
    else {
      const directories = [env.accepted3aDir, env.evidenceDir].filter((value) => value !== null && value !== undefined);
      const outcomes = readOutcomes(directories);
      problems.push(...checkDisclosure(read(env, disclosures), inventory, outcomes));
      void outcomes;
    }
    conclude(h, problems.slice(0, 8), { disclosureDocument: disclosures, inputs: [env.accepted3aDir ? 'accepted 3A generation' : 'no accepted 3A generation', 'this 3C generation'] });
  },
};
void CLI; void REPOSITORIES; void MemoryLedger; void memo;
