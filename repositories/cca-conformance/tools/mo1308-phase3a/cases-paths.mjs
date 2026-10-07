// MO-1308 Phase 3A step D (D1-D4, D6-D12) on the Windows host: junctions, symlinks, dangling links, input-file forms, run
// directories, name forms, path forms, the "refusals create nothing" audit, ACL and read-only locations, and the reparse-point
// survey. Every operation runs through the real CLI. Links are planted unprivileged (junctions need no privilege; directory and file
// symlinks need Developer Mode, which 3A-A6 records). A refusal must leave the real ledger and every outside sentinel byte-identical
// (link-safe snapshots: a link is recorded as a link and never followed).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CORPUS_WORKSPACE, appendArgs, initArgs, recordDigestOf } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { aclDeny, aclRestore, copyTree, dirSymlink, fileSymlink, isLink, junction, removeLink, removeTree, setReadOnly, snapshot, snapshotDiff } from './win.mjs';

const p = (...parts) => path.join(...parts);
const BOUNDARY = 'MO1308_FILESYSTEM_BOUNDARY';
const entryName = (index) => `${String(index).padStart(20, '0')}.json`;
const hexOf = (record) => recordDigestOf(record.recordKind, record.members).slice('sha256:'.length);
const exists = (target) => { try { fs.lstatSync(target); return true; } catch { return false; } };
const LINKS = [['junction', junction], ['directory symlink', dirSymlink]];

// The operations every ledger-taking command offers, aimed at `ledger` (a path that may be reached through a link).
function operations(env, ledger, tag) {
  const out = p(work(env, 'out'), `${tag}-export`);
  return {
    out,
    list: [
      ['verify', ['history', 'verify', '--ledger', ledger, '--json']],
      ['query', ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10', '--json']],
      ['append', appendArgs(ledger, recordById(env, 'checkpoint-c06'), p(work(env, 'in'), `${tag}-append`))],
      ['tombstone', ['history', 'tombstone', '--ledger', ledger, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-D', '--json']],
      ['export', ['history', 'export', '--ledger', ledger, '--output', out, '--json']],
    ],
  };
}

// Runs one command and checks status and code. `expected` is a [status, code] pair or an array of them.
function check(env, problems, results, label, args, expected, options = {}) {
  const result = run(env, args, options);
  const wanted = Array.isArray(expected[0]) ? expected : [expected];
  results[label] = `${result.status}:${result.code ?? 'ok'}`;
  if (!wanted.some(([status, code]) => result.status === status && (code === null ? result.code === null : result.code === code))) problems.push(`${label}: ${result.status} ${result.code ?? 'ok'}, wanted ${wanted.map(([s, c]) => `${s} ${c ?? 'ok'}`).join(' or ')}`);
  return result;
}

// A sentinel directory (outside every ledger) that no refusal may touch.
function sentinel(env, name) {
  const directory = p(work(env, 'sentinel'), name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(p(directory, 'sentinel.txt'), 'outside content that must survive');
  return directory;
}

const BASE_IDS = ['mip-reference', 'policy-0'];

export const pathCases = {
  '3A-D1': (h, env) => {
    const problems = []; const results = {};
    const ledger = ledgerWith(env, 'd1', BASE_IDS);
    const base = work(env, 'd1');
    const before = snapshot(ledger);
    const realExport = p(base, 'real-export');
    check(env, problems, results, 'export (the real one)', ['history', 'export', '--ledger', ledger, '--output', realExport, '--json'], [0, null]);
    const exportBefore = snapshot(realExport);
    for (const [kind, make] of LINKS) {
      const link = p(base, `ledger-as-${kind.replace(' ', '-')}`);
      make(ledger, link);
      if (!isLink(link)) problems.push(`${kind}: the platform does not report it as a link`);
      const ops = operations(env, link, `d1-${kind.replace(' ', '-')}`);
      for (const [name, args] of ops.list) check(env, problems, results, `${kind}: ${name}`, args, [4, BOUNDARY]);
      if (exists(ops.out)) problems.push(`${kind}: an export was created through the link`);
      check(env, problems, results, `${kind}: init at the link`, initArgs(link, 'd1'), [4, BOUNDARY]);
      check(env, problems, results, `${kind}: init under the link`, initArgs(p(link, 'sub'), 'd1'), [4, BOUNDARY]);
      const exportLink = p(base, `export-as-${kind.replace(' ', '-')}`);
      make(realExport, exportLink);
      check(env, problems, results, `${kind}: verify-export through the link`, ['history', 'verify-export', '--export', exportLink, '--json'], [4, BOUNDARY]);
      removeLink(link); removeLink(exportLink);
    }
    for (const row of snapshotDiff(before, snapshot(ledger), { identities: true })) problems.push(`the real ledger changed: ${row}`);
    for (const row of snapshotDiff(exportBefore, snapshot(realExport), { identities: true })) problems.push(`the real export changed: ${row}`);
    if (exists(p(base, 'sub'))) problems.push('init created something');
    check(env, problems, results, 'the real ledger still verifies', ['history', 'verify', '--ledger', ledger, '--json'], [0, null]);
    conclude(h, problems, { results });
  },

  '3A-D2': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd2');
    const real = p(base, 'real-parent', 'deeper'); fs.mkdirSync(real, { recursive: true });
    const ledger = ledgerWith(env, 'd2-seed', BASE_IDS);
    copyTree(ledger, p(real, 'ledger'));
    register(env, p(real, 'ledger'));
    const before = snapshot(p(real, 'ledger'));
    for (const [kind, make] of LINKS) {
      const tag = kind.replace(' ', '-');
      // an ancestor one level up, and one two levels up
      const one = p(base, `anc-${tag}`); make(p(base, 'real-parent'), one);
      const two = p(base, `anc2-${tag}`); make(p(base, 'real-parent', 'deeper'), two);
      for (const [where, linked] of [['parent', p(one, 'deeper', 'ledger')], ['grandparent', p(two, 'ledger')]]) {
        const ops = operations(env, linked, `d2-${tag}-${where}`);
        for (const [name, args] of ops.list) check(env, problems, results, `${kind} ${where}: ${name}`, args, [4, BOUNDARY]);
        if (exists(ops.out)) problems.push(`${kind} ${where}: an export was created`);
        check(env, problems, results, `${kind} ${where}: init under the ancestor`, initArgs(p(path.dirname(linked), 'new-ledger'), 'd2'), [4, BOUNDARY]);
        if (exists(p(real, 'new-ledger')) || exists(p(base, 'real-parent', 'new-ledger'))) problems.push(`${kind} ${where}: init created a ledger below a link`);
      }
      // an export written under a linked ancestor
      const linkedOut = p(one, 'deeper', `export-${tag}`);
      check(env, problems, results, `${kind}: export --output under an ancestor link`, ['history', 'export', '--ledger', p(real, 'ledger'), '--output', linkedOut, '--json'], [4, BOUNDARY]);
      if (exists(p(real, `export-${tag}`))) problems.push(`${kind}: export created below the link target`);
      removeLink(one); removeLink(two);
    }
    for (const row of snapshotDiff(before, snapshot(p(real, 'ledger')), { identities: true })) problems.push(`the real ledger changed: ${row}`);
    check(env, problems, results, 'the real ledger still verifies', ['history', 'verify', '--ledger', p(real, 'ledger'), '--json'], [0, null]);
    conclude(h, problems, { results });
  },

  '3A-D3': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd3');
    const seed = ledgerWith(env, 'd3-seed', BASE_IDS);
    const hex = hexOf(recordById(env, 'mip-reference'));
    const places = [['entries', 'entries'], ['records', 'records'], ['.pending', '.pending'], ['a record directory', `records/${hex}`]];
    const queryReadsIt = new Set(['entries', '.pending']);
    let variants = 0;
    for (const [label, relative] of places) for (const [kind, make] of LINKS) {
      variants += 1;
      const name = `${label.replace(/\W+/g, '-')}-${kind.replace(' ', '-')}`;
      const ledger = p(base, name); copyTree(seed, ledger); register(env, ledger, true);
      const outside = p(base, `${name}-outside`); fs.mkdirSync(outside);
      const moved = p(outside, 'moved'); const at = p(ledger, ...relative.split('/'));
      fs.renameSync(at, moved);
      make(moved, at);
      const outsideBefore = snapshot(outside);
      const ops = operations(env, ledger, `d3-${name}`);
      for (const [op, args] of ops.list) {
        const wanted = op === 'query' && !queryReadsIt.has(relative) ? [0, null] : [4, BOUNDARY];
        check(env, problems, results, `${label} as a ${kind}: ${op}`, args, wanted);
      }
      if (exists(ops.out)) problems.push(`${label} as a ${kind}: an export was created`);
      for (const row of snapshotDiff(outsideBefore, snapshot(outside), { identities: true })) problems.push(`${label} as a ${kind}: the link target changed: ${row}`);
      // restoring the real directory restores service: nothing was damaged
      removeLink(at); fs.renameSync(moved, at);
      const restored = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
      if (restored.status !== 0) problems.push(`${label} as a ${kind}: restored but verify gives ${restored.status} ${restored.code}`);
      for (const row of snapshotDiff(snapshot(seed), snapshot(ledger))) problems.push(`${label} as a ${kind}: the ledger differs from its seed after restoring: ${row}`);
      register(env, ledger, false);
    }
    // a member is a symlink, and an entry file is a symlink (the target holds the same bytes)
    for (const [label, relative] of [['a member', `records/${hex}/package.mip`], ['an entry file', `entries/${entryName(0)}`]]) {
      variants += 1;
      const name = `${label.replace(/\W+/g, '-')}-symlink`;
      const ledger = p(base, name); copyTree(seed, ledger); register(env, ledger, true);
      const outside = p(base, `${name}-outside`); fs.mkdirSync(outside);
      const copy = p(outside, 'copy'); const at = p(ledger, ...relative.split('/'));
      fs.copyFileSync(at, copy); fs.unlinkSync(at); fileSymlink(copy, at);
      const outsideBefore = snapshot(outside);
      const ops = operations(env, ledger, `d3-${name}`);
      for (const [op, args] of ops.list) {
        const wanted = op === 'query' && relative.startsWith('records/') ? [0, null] : [4, BOUNDARY];
        check(env, problems, results, `${label} is a symlink: ${op}`, args, wanted);
      }
      for (const row of snapshotDiff(outsideBefore, snapshot(outside), { identities: true })) problems.push(`${label}: the symlink target changed: ${row}`);
      fs.unlinkSync(at); fs.copyFileSync(copy, at);
      if (run(env, ['history', 'verify', '--ledger', ledger, '--json']).status !== 0) problems.push(`${label}: not restored`);
      register(env, ledger, false);
    }
    conclude(h, problems, { variants, results });
  },

  '3A-D4': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd4');
    const seed = ledgerWith(env, 'd4-seed', BASE_IDS);
    const hex = hexOf(recordById(env, 'mip-reference'));
    const gone = (name) => p(base, `${name}-nowhere`);
    // a dangling link as the ledger itself, and as its location
    for (const [kind, make] of LINKS) {
      const tag = kind.replace(' ', '-');
      const link = p(base, `dangling-ledger-${tag}`); make(gone(`ledger-${tag}`), link);
      const ops = operations(env, link, `d4-ledger-${tag}`);
      for (const [name, args] of ops.list) check(env, problems, results, `${kind} as the ledger: ${name}`, args, [4, BOUNDARY]);
      check(env, problems, results, `${kind} as the ledger: init`, initArgs(link, 'd4'), [4, BOUNDARY]);
      check(env, problems, results, `${kind} as the export location`, ['history', 'export', '--ledger', seed, '--output', link, '--json'], [4, BOUNDARY]);
      if (exists(gone(`ledger-${tag}`))) problems.push(`${kind}: something was created at the dangling target`);
      removeLink(link);
    }
    // a dangling link at a path inside the ledger
    for (const [label, relative, wantQuery] of [['entries', 'entries', 4], ['records', 'records', 0], ['.pending', '.pending', 4], ['a record directory', `records/${hex}`, 0]]) for (const [kind, make] of LINKS) {
      const name = `${label.replace(/\W+/g, '-')}-${kind.replace(' ', '-')}`;
      const ledger = p(base, name); copyTree(seed, ledger); register(env, ledger, true);
      const at = p(ledger, ...relative.split('/'));
      fs.renameSync(at, p(base, `${name}-aside`));
      make(gone(name), at);
      const ops = operations(env, ledger, `d4-${name}`);
      for (const [op, args] of ops.list) check(env, problems, results, `${label} dangling ${kind}: ${op}`, args, op === 'query' ? [wantQuery === 0 ? 0 : 4, wantQuery === 0 ? null : BOUNDARY] : [4, BOUNDARY]);
      if (exists(gone(name))) problems.push(`${label} dangling ${kind}: something was created at the dangling target`);
      removeLink(at); fs.renameSync(p(base, `${name}-aside`), at);
    }
    // a dangling file symlink where a member or the next entry belongs
    for (const [label, relative] of [['a member name', `records/${hex}/package.mip`], ['the next entry name', `entries/${entryName(2)}`]]) {
      const name = `dangling-${label.replace(/\W+/g, '-')}`;
      const ledger = p(base, name); copyTree(seed, ledger); register(env, ledger, true);
      const at = p(ledger, ...relative.split('/'));
      if (relative.includes('package.mip')) fs.unlinkSync(at);
      fileSymlink(gone(name), at);
      const ops = operations(env, ledger, `d4-${name}`);
      for (const [op, args] of ops.list) check(env, problems, results, `${label} dangling symlink: ${op}`, args, op === 'query' && relative.startsWith('records/') ? [0, null] : [4, BOUNDARY]);
      if (exists(gone(name))) problems.push(`${label}: something was created at the dangling target`);
    }
    // a dangling link where the product wants to create a staging name. R17 and H40 state: a typed failure, and nothing existing is overwritten or
    // replaced. What the product does on this host is recorded: Node's exclusive create (CREATE_NEW) FOLLOWS a dangling link on Windows and creates
    // the file at its target, which the post-write lstat then detects (after the fact, as H40 accepts). The report puts that to the owner.
    const createdThroughLink = [];
    for (const [kind, make] of [['file symlink', fileSymlink], ['junction', junction]]) {
      const name = `staging-${kind.replace(' ', '-')}`;
      const ledger = ledgerWith(env, name, []);
      const record = recordById(env, 'checkpoint-c07');
      const targets = [];
      for (const staging of [`member-${hexOf(record)}-checkpoint.json.0`, `entry-${entryName(0).replace('.json', '')}.0`]) {
        const target = gone(`${name}-${staging.slice(0, 6)}`); targets.push(target);
        make(target, p(ledger, '.pending', staging));
      }
      const before = snapshot(ledger);
      check(env, problems, results, `a dangling ${kind} at the first staging names: append`, appendArgs(ledger, record, p(work(env, 'in'), name)), [[0, null], [4, BOUNDARY], [4, 'MO1308_IO']]);
      for (const target of targets) if (exists(target)) createdThroughLink.push({ link: kind, target: path.basename(target), kind: fs.lstatSync(target).isDirectory() ? 'directory' : 'file' });
      if (snapshotDiff(before, snapshot(ledger)).some((row) => row.startsWith('changed') || row.startsWith('removed'))) problems.push(`${kind}: an existing ledger file changed`);
      check(env, problems, results, `${kind} staging leftovers: verify`, ['history', 'verify', '--ledger', ledger, '--json'], [[0, null], [4, BOUNDARY]]);
    }
    conclude(h, problems, { results, createdThroughDanglingStagingLink: createdThroughLink });
  },

  '3A-D6': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd6');
    const ledger = ledgerWith(env, 'd6', ['mip-reference']);
    const before = snapshot(ledger);
    const checkpoint = recordById(env, 'checkpoint-c08');
    const goodDir = p(base, 'good'); fs.mkdirSync(goodDir);
    const good = p(goodDir, 'checkpoint.json'); fs.writeFileSync(good, checkpoint.members[0].bytes);
    const policy = recordById(env, 'policy-1');
    const policyIdentity = p(goodDir, 'evaluation-identity.json'); const policyOutcome = p(goodDir, 'policy-outcome.json');
    fs.writeFileSync(policyIdentity, policy.members.find((m) => m.name === 'evaluation-identity.json').bytes);
    fs.writeFileSync(policyOutcome, policy.members.find((m) => m.name === 'policy-outcome.json').bytes);
    const appendRecord = (file) => ['history', 'append', '--ledger', ledger, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', file, '--json'];
    const appendPolicy = (identity, outcome) => ['history', 'append', '--ledger', ledger, '--kind', 'POLICY_EVALUATION', '--identity', identity, '--outcome', outcome, '--json'];
    check(env, problems, results, 'a good input appends', appendRecord(good), [0, null]);
    const control = snapshot(ledger);
    // links
    const fileLink = p(base, 'file-symlink.json'); fileSymlink(good, fileLink);
    check(env, problems, results, '--record is a symlink', appendRecord(fileLink), [4, BOUNDARY]);
    const linkedDir = p(base, 'linked-dir'); junction(goodDir, linkedDir);
    check(env, problems, results, '--record is below a junction', appendRecord(p(linkedDir, 'checkpoint.json')), [4, BOUNDARY]);
    const linkedDirSym = p(base, 'linked-dir-symlink'); dirSymlink(goodDir, linkedDirSym);
    check(env, problems, results, '--record is below a directory symlink', appendRecord(p(linkedDirSym, 'checkpoint.json')), [4, BOUNDARY]);
    const identityLink = p(base, 'identity-symlink.json'); fileSymlink(policyIdentity, identityLink);
    check(env, problems, results, '--identity is a symlink', appendPolicy(identityLink, policyOutcome), [4, BOUNDARY]);
    const outcomeLink = p(base, 'outcome-symlink.json'); fileSymlink(policyOutcome, outcomeLink);
    check(env, problems, results, '--outcome is a symlink', appendPolicy(policyIdentity, outcomeLink), [4, BOUNDARY]);
    // an app-execution alias (a reparse point of another kind that Windows ships)
    const apps = p(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps');
    let alias = null;
    try { alias = fs.readdirSync(apps).map((n) => p(apps, n)).find((file) => { try { const st = fs.lstatSync(file); return st.isSymbolicLink() && !st.isDirectory(); } catch { return false; } }) ?? null; } catch { alias = null; }
    if (alias === null) problems.push('this host has no app-execution alias to use as an input');
    else {
      check(env, problems, results, '--record is an app-execution alias', appendRecord(alias), [4, BOUNDARY]);
      check(env, problems, results, '--identity is an app-execution alias', appendPolicy(alias, policyOutcome), [4, BOUNDARY]);
    }
    // a directory
    check(env, problems, results, '--record is a directory', appendRecord(goodDir), [4, BOUNDARY]);
    check(env, problems, results, '--outcome is a directory', appendPolicy(policyIdentity, goodDir), [4, BOUNDARY]);
    // reserved device names (Node opens them as the literal names, which Windows treats as the device): a typed failure, nothing created
    for (const device of ['NUL', 'CON', 'AUX', 'PRN', 'COM1', 'LPT1', 'nul.json', 'CONIN$']) check(env, problems, results, `--record is the reserved name ${device}`, appendRecord(device), [[4, 'MO1308_IO'], [4, BOUNDARY]], { cwd: base });
    for (const device of ['NUL', 'CON']) check(env, problems, results, `--outcome is the reserved name ${device}`, appendPolicy(policyIdentity, device), [[4, 'MO1308_IO'], [4, BOUNDARY]], { cwd: base });
    // every one of these refusals changed nothing
    for (const row of snapshotDiff(control, snapshot(ledger), { identities: true })) problems.push(`a refusal changed the ledger: ${row}`);
    if (snapshotDiff(before, control).filter((row) => !row.startsWith('added')).length > 0) problems.push('the control append changed an earlier file');
    if (fs.readdirSync(base).some((name) => /^(NUL|CON|AUX|PRN|COM1|LPT1|nul\.json|CONIN\$)$/iu.test(name))) problems.push('a reserved name was created in the working directory');
    conclude(h, problems, { results, aliasUsed: alias === null ? null : path.basename(alias) });
  },

  '3A-D7': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd7');
    const ledger = ledgerWith(env, 'd7', []);
    const six = recordById(env, 'cicd-6'); const four = recordById(env, 'cicd-4');
    const bundle = (name, record, mutate = () => {}) => {
      const directory = p(base, name); fs.mkdirSync(directory);
      for (const member of record.members) fs.writeFileSync(p(directory, member.name), member.bytes);
      mutate(directory);
      return directory;
    };
    const appendRun = (directory) => ['history', 'append', '--ledger', ledger, '--kind', 'CICD_RUN', '--run', directory, '--json'];
    const before = snapshot(ledger);
    const refused = (label, directory, expected) => check(env, problems, results, label, appendRun(directory), expected);
    refused('an extra file beside the 6 members', bundle('extra6', six, (d) => fs.writeFileSync(p(d, 'notes.txt'), 'x')), [2, 'MO1308_RECORD_INVALID']);
    refused('an extra file beside the 4 members', bundle('extra4', four, (d) => fs.writeFileSync(p(d, 'notes.txt'), 'x')), [2, 'MO1308_RECORD_INVALID']);
    refused('a missing member (the result file)', bundle('missing', four, (d) => fs.unlinkSync(p(d, 'memoryos-ci-result.json'))), [2, 'MO1308_RECORD_INVALID']);
    refused('an empty directory', bundle('empty', { members: [] }), [2, 'MO1308_RECORD_INVALID']);
    refused('a foreign member (another kind\'s member name)', bundle('foreign-name', four, (d) => fs.writeFileSync(p(d, 'package.mip'), recordById(env, 'mip-reference').members[0].bytes)), [2, 'MO1308_RECORD_INVALID']);
    refused('a foreign member (bytes of another run)', bundle('foreign-bytes', four, (d) => fs.writeFileSync(p(d, 'memoryos-ci-evidence.json'), six.members.find((m) => m.name === 'memoryos-ci-evidence.json').bytes)), [2, 'MO1308_RECORD_INVALID']);
    refused('a nested directory', bundle('nested', four, (d) => fs.mkdirSync(p(d, 'sub'))), [2, 'MO1308_RECORD_INVALID']);
    const target = p(base, 'link-target'); fs.mkdirSync(target); fs.writeFileSync(p(target, 'x.json'), 'x');
    const copy = p(target, 'result.json'); fs.writeFileSync(copy, four.members.find((member) => member.name === 'memoryos-ci-result.json').bytes);
    const outsideBefore = snapshot(target);
    refused('a member that is a file symlink', bundle('linked-file', four, (d) => { const at = p(d, 'memoryos-ci-result.json'); fs.unlinkSync(at); fileSymlink(copy, at); }), [4, BOUNDARY]);
    refused('a member that is a junction', bundle('linked-junction', four, (d) => { const at = p(d, 'memoryos-ci-result.json'); fs.unlinkSync(at); junction(target, at); }), [4, BOUNDARY]);
    refused('a member that is a directory symlink', bundle('linked-dirsym', four, (d) => { const at = p(d, 'memoryos-ci-result.json'); fs.unlinkSync(at); dirSymlink(target, at); }), [4, BOUNDARY]);
    const real = bundle('real-run', four);
    const linkRun = p(base, 'run-as-junction'); junction(real, linkRun);
    refused('the run directory is a junction', linkRun, [4, BOUNDARY]);
    const linkRunSym = p(base, 'run-as-symlink'); dirSymlink(real, linkRunSym);
    refused('the run directory is a directory symlink', linkRunSym, [4, BOUNDARY]);
    refused('the run directory is below a junction', p(base, 'run-as-junction'), [4, BOUNDARY]);
    for (const row of snapshotDiff(outsideBefore, snapshot(target), { identities: true })) problems.push(`a link target changed: ${row}`);
    for (const row of snapshotDiff(before, snapshot(ledger), { identities: true })) problems.push(`a refusal changed the ledger: ${row}`);
    check(env, problems, results, 'the intact bundle appends', appendRun(real), [0, null]);
    conclude(h, problems, { results });
  },

  '3A-D8': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd8');
    const long = p(base, 'ALongDirectoryNameThatHasAShortAlias'); fs.mkdirSync(long);
    const ledger = p(long, 'ledger');
    check(env, problems, results, 'init in the long-named directory', initArgs(ledger, 'd8'), [0, null]);
    for (const id of BASE_IDS) check(env, problems, results, `append ${id}`, appendArgs(ledger, recordById(env, id), p(work(env, 'in'), `d8-${id}`)), [0, null]);
    register(env, ledger);
    const before = snapshot(ledger);
    // case: any casing of the path reaches the same directory and writes the on-disk names (no differently cased name appears)
    for (const spelling of [ledger.toUpperCase(), ledger.toLowerCase(), ledger.replaceAll('\\', '/')]) check(env, problems, results, `verify via ${spelling === ledger.toUpperCase() ? 'upper case' : spelling === ledger.toLowerCase() ? 'lower case' : 'forward slashes'}`, ['history', 'verify', '--ledger', spelling, '--json'], [0, null]);
    check(env, problems, results, 'append through the upper-case spelling', appendArgs(ledger.toUpperCase(), recordById(env, 'checkpoint-c09'), p(work(env, 'in'), 'd8-case')), [0, null]);
    if (JSON.stringify(fs.readdirSync(ledger).sort()) !== JSON.stringify(['.pending', 'entries', 'memoryos-history-ledger.json', 'records'])) problems.push(`the ledger directory holds ${JSON.stringify(fs.readdirSync(ledger))}`);
    if (JSON.stringify(fs.readdirSync(p(ledger, 'entries'))) !== JSON.stringify([entryName(0), entryName(1), entryName(2)])) problems.push('a differently cased entry name appeared');
    // case-only rename inside the ledger: layout corruption, never silently accepted
    const afterAppend = snapshot(ledger);
    const hex = hexOf(recordById(env, 'mip-reference'));
    for (const [from, to] of [['entries', 'Entries'], ['records', 'RECORDS'], ['memoryos-history-ledger.json', 'Memoryos-History-Ledger.json'], [`records/${hex}`, `records/${hex.toUpperCase()}`], [`entries/${entryName(0)}`, `entries/${entryName(0).toUpperCase()}`]]) {
      fs.renameSync(p(ledger, ...from.split('/')), p(ledger, ...to.split('/')));
      const result = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
      results[`case-only rename ${from}`] = `${result.status}:${result.code}`;
      if (result.status === 0 || !['MO1308_LEDGER_CORRUPT', 'MO1308_LEDGER_NOT_FOUND', 'MO1308_FILESYSTEM_BOUNDARY'].includes(result.code)) problems.push(`case-only rename of ${from} was accepted or untyped: ${result.status} ${result.code}`);
      fs.renameSync(p(ledger, ...to.split('/')), p(ledger, ...from.split('/')));
    }
    for (const row of snapshotDiff(afterAppend, snapshot(ledger), { identities: true })) problems.push(`restoring the names left a difference: ${row}`);
    // 8.3 short alias: the canonical path differs, so every operation is refused and creates nothing
    const short = shortPathOf(env, long);
    if (short === null || short.toLowerCase() === long.toLowerCase()) problems.push('this volume gave no 8.3 alias to the long directory name');
    else {
      const viaShort = p(short, 'ledger');
      for (const [name, args] of operations(env, viaShort, 'd8-short').list) check(env, problems, results, `8.3 alias: ${name}`, args, [4, BOUNDARY]);
      check(env, problems, results, '8.3 alias: init beside', initArgs(p(short, 'via-short'), 'd8'), [4, BOUNDARY]);
      if (exists(p(long, 'via-short'))) problems.push('init through the 8.3 alias created a ledger');
    }
    // trailing dot or space, reserved device names, alternate data streams: Node addresses the literal name (it uses the \\?\ form);
    // the product must treat it as exactly that name: no aliasing to the stripped name, nothing created elsewhere
    const literal = (label, name) => {
      const target = p(base, name);
      const init = run(env, initArgs(target, 'd8'));
      results[`init ${label}`] = `${init.status}:${init.code ?? 'ok'}`;
      const siblings = fs.readdirSync(base).sort();
      if (init.status === 0) {
        const stripped = name.replace(/[. ]+$/u, '');
        const verifyLiteral = run(env, ['history', 'verify', '--ledger', target, '--json']);
        if (verifyLiteral.status !== 0) problems.push(`${label}: the ledger created at the literal name does not verify at it (${verifyLiteral.code})`);
        if (stripped !== name && siblings.includes(stripped)) problems.push(`${label}: the stripped name ${stripped} was created as well`);
        if (stripped !== name) {
          const verifyStripped = run(env, ['history', 'verify', '--ledger', p(base, stripped), '--json']);
          results[`verify ${label} as the stripped name`] = `${verifyStripped.status}:${verifyStripped.code ?? 'ok'}`;
          if (verifyStripped.status === 0) problems.push(`${label}: the stripped spelling reached the same ledger (aliasing)`);
        }
        register(env, target);
      } else if (!['MO1308_IO', BOUNDARY].includes(init.code)) problems.push(`${label}: init gave ${init.status} ${init.code}`);
      return { init, siblings };
    };
    literal('a trailing dot', 'trailing-dot.');
    literal('a trailing space', 'trailing-space ');
    literal('the reserved name NUL', 'NUL');
    literal('the reserved name COM1', 'COM1');
    const ads = run(env, initArgs(p(base, 'stream-ledger:s'), 'd8'));
    results['init at an alternate data stream name'] = `${ads.status}:${ads.code ?? 'ok'}`;
    if (ads.status === 0 || !['MO1308_IO', BOUNDARY].includes(ads.code)) problems.push(`init at an alternate data stream name: ${ads.status} ${ads.code}`);
    check(env, problems, results, 'verify with ::$DATA appended to the ledger path', ['history', 'verify', '--ledger', `${ledger}::$DATA`, '--json'], [[4, 'MO1308_IO'], [4, BOUNDARY], [4, 'MO1308_LEDGER_NOT_FOUND']]);
    // an alternate data stream as an input file reads the stream's bytes: the file the operator named, no other
    const adsHost = p(base, 'ads-host.txt'); fs.writeFileSync(adsHost, 'host bytes');
    fs.writeFileSync(`${adsHost}:stream`, recordById(env, 'checkpoint-c09').members[0].bytes);
    const adsLedger = p(base, 'ads-input-ledger'); run(env, initArgs(adsLedger, 'd8')); register(env, adsLedger);
    const adsInput = run(env, ['history', 'append', '--ledger', adsLedger, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', `${adsHost}:stream`, '--json']);
    results['--record is an alternate data stream'] = `${adsInput.status}:${adsInput.code ?? 'ok'}`;
    const adsHostInput = run(env, ['history', 'append', '--ledger', adsLedger, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', adsHost, '--json']);
    results['--record is the stream host (not a record)'] = `${adsHostInput.status}:${adsHostInput.code ?? 'ok'}`;
    if (adsHostInput.status === 0) problems.push('the host file bytes were admitted as a record');
    // every refusal above left the first ledger as it was; the one accepted append (the upper-case spelling) only added files
    for (const row of snapshotDiff(before, snapshot(ledger)).filter((entry) => !entry.startsWith('added'))) problems.push(`an operation changed the first ledger: ${row}`);
    conclude(h, problems, { results, preRegistered: 'case variants accepted without creating a cased name; case-only renames inside, and the 8.3 alias, refused; literal trailing-dot, trailing-space and reserved names addressed as exactly those names with no aliasing; stream names refused or read as the named stream' });
  },
};

// The 8.3 short form of a path (the harness asks Windows through ctypes; the product never does).
import { runPython } from './win.mjs';
function shortPathOf(env, longPath) {
  const result = runPython(env, 'shortpath.py', [longPath], { purpose: 'GetShortPathNameW (3A-D8)' });
  return result.json?.short ?? null;
}
void os; void CORPUS_WORKSPACE; void aclDeny; void aclRestore; void removeTree; void setReadOnly;
