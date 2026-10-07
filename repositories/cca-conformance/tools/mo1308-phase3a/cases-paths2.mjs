// MO-1308 Phase 3A step D, second half: D9 (path forms), D10 (refusals create nothing), D11 (read-only and ACL-denied locations) and
// D12 (the reparse-point survey). Real CLI processes throughout; ACLs are changed with icacls (a harness observer, recorded) and always
// restored before anything is removed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CORPUS_WORKSPACE, appendArgs, initArgs, recordDigestOf } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { aclDeny, aclRestore, copyTree, dirSymlink, fileSymlink, junction, removeLink, setReadOnly, snapshot, snapshotDiff } from './win.mjs';

const p = (...parts) => path.join(...parts);
const BOUNDARY = 'MO1308_FILESYSTEM_BOUNDARY';
const entryName = (index) => `${String(index).padStart(20, '0')}.json`;
const hexOf = (record) => recordDigestOf(record.recordKind, record.members).slice('sha256:'.length);
const exists = (target) => { try { fs.lstatSync(target); return true; } catch { return false; } };

function check(env, problems, results, label, args, expected, options = {}) {
  const result = run(env, args, options);
  const wanted = Array.isArray(expected[0]) ? expected : [expected];
  results[label] = `${result.status}:${result.code ?? 'ok'}`;
  if (!wanted.some(([status, code]) => result.status === status && (code === null ? result.code === null : result.code === code))) problems.push(`${label}: ${result.status} ${result.code ?? 'ok'}, wanted ${wanted.map(([s, c]) => `${s} ${c ?? 'ok'}`).join(' or ')}`);
  return result;
}
const verifyArgs = (ledger) => ['history', 'verify', '--ledger', ledger, '--json'];

export const pathCases2 = {
  '3A-D9': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd9');
    const ledger = p(base, 'ledger');
    check(env, problems, results, 'init', initArgs(ledger, 'd9'), [0, null]);
    for (const id of ['checkpoint-c00', 'policy-2']) check(env, problems, results, `append ${id}`, appendArgs(ledger, recordById(env, id), p(work(env, 'in'), `d9-${id}`)), [0, null]);
    const head = run(env, verifyArgs(ledger)).json?.result?.headDigest;
    const same = (label, spelling, options = {}) => {
      const result = check(env, problems, results, label, verifyArgs(spelling), [0, null], options);
      if (result.status === 0 && result.json?.result?.headDigest !== head) problems.push(`${label}: another ledger answered`);
    };
    const drive = ledger.slice(0, 2);
    same('drive letter in lower case', `${drive.toLowerCase()}${ledger.slice(2)}`);
    same('drive letter in upper case', `${drive.toUpperCase()}${ledger.slice(2)}`);
    same('forward slashes', ledger.replaceAll('\\', '/'));
    same('dot-dot segments', p(base, 'a', '..', 'ledger'));
    same('dot segments and a trailing separator', `${p(base, '.', 'ledger')}\\`);
    same('relative to the working directory', 'ledger', { cwd: base });
    same('relative with dot-dot', p('..', 'd9', 'ledger'), { cwd: base });
    // UNC through the administrative share of this machine: observed, not claimed (Q15)
    const unc = `\\\\localhost\\${ledger[0]}$${ledger.slice(2)}`;
    const uncResult = run(env, verifyArgs(unc));
    results['UNC (observed)'] = `${uncResult.status}:${uncResult.code ?? 'ok'}`;
    if (uncResult.status === 0) { if (uncResult.json?.result?.headDigest !== head) problems.push('UNC: another ledger answered'); } else if (uncResult.code === null || uncResult.status === 5) problems.push(`UNC: untyped failure ${uncResult.status}`);
    const uncAppend = run(env, appendArgs(unc, recordById(env, 'checkpoint-c01'), p(work(env, 'in'), 'd9-unc')));
    results['UNC append (observed)'] = `${uncAppend.status}:${uncAppend.code ?? 'ok'}`;
    if (uncAppend.status !== 0 && (uncAppend.code === null || uncAppend.status === 5)) problems.push(`UNC append: untyped failure ${uncAppend.status}`);
    // over-long: far beyond MAX_PATH with no prefix
    let deep = base;
    for (let level = 0; level < 8; level += 1) deep = p(deep, `${'d'.repeat(40)}${level}`);
    fs.mkdirSync(deep, { recursive: true });
    const longLedger = p(deep, 'ledger');
    if (longLedger.length <= 300) problems.push('the over-long path is not over-long');
    check(env, problems, results, 'over-long path: init', initArgs(longLedger, 'd9'), [0, null]);
    check(env, problems, results, 'over-long path: append', appendArgs(longLedger, recordById(env, 'checkpoint-c02'), p(work(env, 'in'), 'd9-long')), [0, null]);
    check(env, problems, results, 'over-long path: verify', verifyArgs(longLedger), [0, null]);
    check(env, problems, results, 'over-long path: export', ['history', 'export', '--ledger', longLedger, '--output', p(deep, 'export'), '--json'], [0, null]);
    check(env, problems, results, 'over-long path: verify-export', ['history', 'verify-export', '--export', p(deep, 'export'), '--json'], [0, null]);
    register(env, longLedger);
    // the extended-length and device prefixes: refused fail-closed, nothing created
    const before = snapshot(ledger);
    for (const prefix of ['\\\\?\\', '\\\\.\\']) {
      check(env, problems, results, `${prefix} verify`, verifyArgs(prefix + ledger), [4, BOUNDARY]);
      check(env, problems, results, `${prefix} append`, appendArgs(prefix + ledger, recordById(env, 'checkpoint-c03'), p(work(env, 'in'), 'd9-prefix')), [4, BOUNDARY]);
      check(env, problems, results, `${prefix} init`, initArgs(prefix + p(base, 'prefixed-ledger'), 'd9'), [4, BOUNDARY]);
      check(env, problems, results, `${prefix} export`, ['history', 'export', '--ledger', prefix + ledger, '--output', p(base, 'prefixed-export'), '--json'], [4, BOUNDARY]);
      check(env, problems, results, `${prefix} export --output`, ['history', 'export', '--ledger', ledger, '--output', prefix + p(base, 'prefixed-export-2'), '--json'], [4, BOUNDARY]);
    }
    for (const name of ['prefixed-ledger', 'prefixed-export', 'prefixed-export-2']) if (exists(p(base, name))) problems.push(`${name} was created`);
    for (const row of snapshotDiff(before, snapshot(ledger)).filter((entry) => !entry.startsWith('added'))) problems.push(`the ledger changed: ${row}`);
    conclude(h, problems, { results, claimed: ['drive letter', 'forward slash', 'dot-dot', 'relative', 'over-long'], observedNotClaimed: ['UNC'], refused: ['\\\\?\\', '\\\\.\\'] });
  },

  '3A-D10': (h, env) => {
    const problems = []; const results = {};
    const arena = work(env, 'd10');
    const ledger = ledgerWith(env, 'd10', ['mip-reference', 'policy-0', 'readiness-ready']);
    const placed = p(arena, 'ledger'); copyTree(ledger, placed); register(env, placed);
    const outside = p(arena, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(p(outside, 'sentinel.txt'), 'untouched');
    const taken = p(arena, 'taken'); fs.mkdirSync(taken);
    const link = p(arena, 'link'); junction(outside, link);
    const dangling = p(arena, 'dangling'); dirSymlink(p(arena, 'nowhere'), dangling);
    const files = p(arena, 'inputs'); fs.mkdirSync(files);
    const input = (name, bytes) => { const file = p(files, name); fs.writeFileSync(file, bytes); return file; };
    const garbage = input('garbage.bin', 'garbage');
    const duplicateMip = input('mip.bin', recordById(env, 'mip-reference').members[0].bytes);
    const otherWorkspace = p(arena, 'other-ledger');
    const mismatchLedger = p(arena, 'mismatch'); run(env, initArgs(mismatchLedger, 'other', 'another-workspace'));
    const before = snapshot(arena);
    const sentinelBefore = snapshot(env.sentinelDir);
    const battery = [
      ['init at an existing ledger', initArgs(placed, 'x'), 4], ['init at a link', initArgs(link, 'x'), 4], ['init under a link', initArgs(p(link, 'new'), 'x'), 4],
      ['init at a dangling link', initArgs(dangling, 'x'), 4], ['init with a missing parent', initArgs(p(arena, 'missing-parent', 'x'), 'x'), 4], ['init at an existing directory', initArgs(taken, 'x'), 4],
      ['export to an existing directory', ['history', 'export', '--ledger', placed, '--output', taken, '--json'], 4], ['export at a link', ['history', 'export', '--ledger', placed, '--output', link, '--json'], 4],
      ['export under a link', ['history', 'export', '--ledger', placed, '--output', p(link, 'e'), '--json'], 4], ['export into the ledger', ['history', 'export', '--ledger', placed, '--output', p(placed, 'entries', 'e'), '--json'], 4],
      ['export with a missing parent', ['history', 'export', '--ledger', placed, '--output', p(arena, 'missing-parent', 'e'), '--json'], 4],
      ['export from a missing ledger', ['history', 'export', '--ledger', p(arena, 'no-ledger'), '--output', p(arena, 'e2'), '--json'], 4],
      ['append garbage', ['history', 'append', '--ledger', placed, '--kind', 'MIP_PACKAGE', '--record', garbage, '--json'], 2], ['append a duplicate', ['history', 'append', '--ledger', placed, '--kind', 'MIP_PACKAGE', '--record', duplicateMip, '--json'], 2],
      ['append to a link', ['history', 'append', '--ledger', link, '--kind', 'MIP_PACKAGE', '--record', duplicateMip, '--json'], 4], ['append a missing input', ['history', 'append', '--ledger', placed, '--kind', 'MIP_PACKAGE', '--record', p(files, 'missing.bin'), '--json'], 4],
      ['append to another Workspace', appendArgs(mismatchLedger, recordById(env, 'mip-reference'), p(work(env, 'in'), 'd10-mismatch')), 2],
      ['append a decision without its readiness result', appendArgs(mismatchLedger, recordById(env, 'decision-ready-approve'), p(work(env, 'in'), 'd10-unbound')), 2],
      ['tombstone a missing target', ['history', 'tombstone', '--ledger', placed, '--target', '99', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A', '--json'], 2],
      ['tombstone with a bad reason', ['history', 'tombstone', '--ledger', placed, '--target', '0', '--reason', 'BECAUSE', '--authority-reference', 'P3A', '--json'], 1],
      ['verify a link', verifyArgs(link), 4], ['verify a missing ledger', verifyArgs(p(arena, 'no-ledger')), 4], ['verify-export of a missing export', ['history', 'verify-export', '--export', p(arena, 'no-export'), '--json'], 4],
      ['a usage error', ['history', 'append', '--ledger', placed, '--json'], 1], ['a query with a bad limit', ['history', 'query', '--ledger', placed, '--limit', '0', '--json'], 1],
    ];
    void otherWorkspace;
    for (const [label, args, status] of battery) {
      const result = run(env, args);
      results[label] = `${result.status}:${result.code ?? 'ok'}`;
      if (result.status !== status) problems.push(`${label}: exit ${result.status} ${result.code ?? ''}, a refusal of exit ${status} was expected`);
    }
    for (const row of snapshotDiff(before, snapshot(arena), { identities: true })) problems.push(`a refusal created or changed ${row}`);
    for (const row of snapshotDiff(sentinelBefore, snapshot(env.sentinelDir), { identities: true })) problems.push(`the campaign sentinel changed: ${row}`);
    if (fs.readFileSync(p(outside, 'sentinel.txt'), 'utf8') !== 'untouched' || fs.readdirSync(outside).length !== 1) problems.push('the outside sentinel changed');
    removeLink(link); removeLink(dangling);
    conclude(h, problems, { refusals: battery.length, results });
  },

  '3A-D11': (h, env) => {
    const problems = []; const results = {};
    const base = work(env, 'd11');
    const restoreList = [];
    const denied = (target, rights) => { aclDeny(env, target, rights); restoreList.push(target); };
    try {
      // a location the user may not write to: init, export and append fail with a typed IO and create nothing
      const parent = p(base, 'locked-parent'); fs.mkdirSync(parent);
      const seed = ledgerWith(env, 'd11-seed', ['mip-reference', 'policy-0']);
      const parentBefore = snapshot(parent);
      denied(parent, '(W)');
      check(env, problems, results, 'init in a write-denied directory', initArgs(p(parent, 'ledger'), 'd11'), [4, 'MO1308_IO']);
      check(env, problems, results, 'export into a write-denied directory', ['history', 'export', '--ledger', seed, '--output', p(parent, 'export'), '--json'], [4, 'MO1308_IO']);
      aclRestore(env, parent); restoreList.pop();
      for (const row of snapshotDiff(parentBefore, snapshot(parent), { identities: true })) problems.push(`the denied directory changed: ${row}`);
      // the staging directory denied: an append fails with a typed IO before anything is published; at most an empty record directory appears
      const ledger = p(base, 'staging-denied'); copyTree(seed, ledger); register(env, ledger);
      const before = snapshot(ledger);
      denied(p(ledger, '.pending'), '(W)');
      check(env, problems, results, 'append with the staging directory write-denied', appendArgs(ledger, recordById(env, 'checkpoint-c04'), p(work(env, 'in'), 'd11-staging')), [4, 'MO1308_IO']);
      aclRestore(env, p(ledger, '.pending')); restoreList.pop();
      const delta = snapshotDiff(before, snapshot(ledger), { identities: true });
      const allowed = delta.filter((row) => row.startsWith('added: records/') && !row.includes('/', 'added: records/'.length + 64));
      if (delta.length !== allowed.length || allowed.length > 1) problems.push(`the failed append left more than an empty record directory: ${delta.join(', ')}`);
      const emptyDir = delta.length === 1 ? snapshot(ledger).get(delta[0].slice('added: '.length)) : null;
      if (emptyDir !== null && emptyDir?.kind !== 'dir') problems.push('the residue is not an empty record directory');
      const afterVerify = check(env, problems, results, 'verify after the failed append', verifyArgs(ledger), [0, null]);
      if (afterVerify.json?.result?.pendingArtifacts !== 0) problems.push(`staging residue after a refused append: ${afterVerify.json?.result?.pendingArtifacts}`);
      check(env, problems, results, 'the same append succeeds once the location is writable', appendArgs(ledger, recordById(env, 'checkpoint-c04'), p(work(env, 'in'), 'd11-staging')), [0, null]);
      // read-only attribute on the member a purge must delete
      const ro = p(base, 'read-only-member'); copyTree(seed, ro); register(env, ro);
      const member = p(ro, 'records', hexOf(recordById(env, 'mip-reference')), 'package.mip');
      setReadOnly(member, true);
      const roResult = run(env, ['history', 'tombstone', '--ledger', ro, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-RO', '--json']);
      results['tombstone with the member read-only'] = `${roResult.status}:${roResult.code ?? 'ok'}`;
      if (exists(member)) setReadOnly(member, false);
      const roState = run(env, verifyArgs(ro));
      results['verify after'] = `${roState.status}:${roState.code ?? 'ok'}`;
      const roOutcome = roResult.status === 0 ? 'the purge removed the read-only member (Node unlink clears the attribute)' : roResult.code === 'MO1308_IO' ? 'typed IO; the tombstone is committed and the purge is pending' : 'untyped';
      if (roResult.status !== 0 && roResult.code !== 'MO1308_IO') problems.push(`a read-only member gave ${roResult.status} ${roResult.code}`);
      if (roState.status !== 0) problems.push(`the chain does not verify after the read-only purge: ${roState.code}`);
      if (roResult.status !== 0) {
        if (!(roState.json?.result?.purgePending ?? []).includes(0)) problems.push('a failed purge is not reported as pending');
        check(env, problems, results, 'the purge rerun finishes', ['history', 'tombstone', '--ledger', ro, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-RO', '--json'], [0, null]);
      }
      // delete denied on the directory that holds the members: the purge fails with a typed IO, the tombstone stays committed, a rerun finishes
      const acl = p(base, 'delete-denied'); copyTree(seed, acl); register(env, acl);
      const recordDir = p(acl, 'records', hexOf(recordById(env, 'mip-reference')));
      const memberFile = p(recordDir, 'package.mip');
      denied(memberFile, '(DE)'); denied(recordDir, '(DC)');
      const aclResult = run(env, ['history', 'tombstone', '--ledger', acl, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-ACL', '--json']);
      results['tombstone with deletion denied'] = `${aclResult.status}:${aclResult.code ?? 'ok'}`;
      aclRestore(env, recordDir); aclRestore(env, memberFile); restoreList.pop(); restoreList.pop();
      const aclState = run(env, verifyArgs(acl));
      results['verify after the denied purge'] = `${aclState.status}:${aclState.code ?? 'ok'}`;
      if (aclResult.status !== 4 || aclResult.code !== 'MO1308_IO') problems.push(`a denied purge gave ${aclResult.status} ${aclResult.code}`);
      if (aclState.status !== 0 || !(aclState.json?.result?.purgePending ?? []).includes(0)) problems.push(`the denied purge is not reported as pending: ${aclState.status}`);
      check(env, problems, results, 'the denied purge rerun finishes without a new entry', ['history', 'tombstone', '--ledger', acl, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-ACL', '--json'], [0, null]);
      const finished = run(env, verifyArgs(acl));
      if (finished.status !== 0 || (finished.json?.result?.purgePending ?? [0]).length !== 0 || finished.json?.result?.entryCount !== 3) problems.push('the rerun did not finish the purge with exactly one tombstone entry');
      conclude(h, problems, { results, readOnlyMember: roOutcome });
    } finally {
      for (const target of restoreList.splice(0)) { try { aclRestore(env, target); } catch { /* reported by the case problems if it mattered */ } }
    }
  },

  '3A-D12': (h, env) => {
    const problems = []; const results = {}; const survey = [];
    const base = work(env, 'd12');
    const seed = ledgerWith(env, 'd12-seed', ['mip-reference', 'policy-0']);
    const hex = hexOf(recordById(env, 'mip-reference'));
    const dirKinds = [['junction', junction], ['directory symlink', dirSymlink]];
    const refusedAll = (kind, role, status) => { survey.push({ kind, role, outcome: status }); if (status !== `4:${BOUNDARY}`) problems.push(`${kind} as ${role}: ${status}`); };
    for (const [kind, make] of dirKinds) {
      const tag = kind.replace(' ', '-');
      const target = p(base, `target-${tag}`); fs.mkdirSync(target);
      // as the ledger root
      const root = p(base, `root-${tag}`); make(seed, root);
      let result = run(env, verifyArgs(root)); refusedAll(kind, 'the ledger root', `${result.status}:${result.code}`);
      removeLink(root);
      // as the export output
      const output = p(base, `output-${tag}`); make(target, output);
      result = run(env, ['history', 'export', '--ledger', seed, '--output', output, '--json']); refusedAll(kind, 'the export output', `${result.status}:${result.code}`);
      removeLink(output);
      // as an ancestor of an input file
      const real = p(base, `inputs-${tag}`); fs.mkdirSync(real);
      fs.writeFileSync(p(real, 'checkpoint.json'), recordById(env, 'checkpoint-c05').members[0].bytes);
      const viaLink = p(base, `via-${tag}`); make(real, viaLink);
      result = run(env, ['history', 'append', '--ledger', seed, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', p(viaLink, 'checkpoint.json'), '--json']); refusedAll(kind, 'an ancestor of an input file', `${result.status}:${result.code}`);
      removeLink(viaLink);
    }
    // a file symlink as an input, as a member and as an entry file
    {
      const real = p(base, 'file-target.json'); fs.writeFileSync(real, recordById(env, 'checkpoint-c05').members[0].bytes);
      const link = p(base, 'file-link.json'); fileSymlink(real, link);
      const result = run(env, ['history', 'append', '--ledger', seed, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', link, '--json']); refusedAll('file symlink', 'an input file', `${result.status}:${result.code}`);
      for (const [role, relative] of [['a member', `records/${hex}/package.mip`], ['an entry file', `entries/${entryName(0)}`]]) {
        const ledger = p(base, `ledger-${role.replace(' ', '-')}`); copyTree(seed, ledger); register(env, ledger, true);
        const at = p(ledger, ...relative.split('/')); const copy = p(base, `copy-${role.replace(' ', '-')}`);
        fs.copyFileSync(at, copy); fs.unlinkSync(at); fileSymlink(copy, at);
        const read = run(env, verifyArgs(ledger)); refusedAll('file symlink', role, `${read.status}:${read.code}`);
      }
    }
    // the app-execution aliases Windows ships (a reparse point of another tag that Node reports as a link)
    const apps = p(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps');
    let aliases = [];
    try { aliases = fs.readdirSync(apps).map((name) => p(apps, name)).filter((file) => { try { const st = fs.lstatSync(file); return st.isSymbolicLink() && !st.isDirectory(); } catch { return false; } }).slice(0, 3); } catch { aliases = []; }
    if (aliases.length === 0) problems.push('no app-execution alias exists on this host');
    for (const alias of aliases) { const result = run(env, ['history', 'append', '--ledger', seed, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', alias, '--json']); refusedAll('app-execution alias', `an input file (${path.basename(alias)})`, `${result.status}:${result.code}`); }
    // the kinds nothing here can plant without elevation, a provider or a feature: recorded as not plantable, with the evidence
    const elevated = (() => { const out = spawnSync('whoami.exe', ['/groups'], { encoding: 'utf8', windowsHide: true }); env.observers.push({ observer: 'whoami', purpose: 'elevation state (3A-D12)', status: out.status, signal: null }); return /High Mandatory Level/u.test(out.stdout ?? ''); })();
    const notPlantable = [
      { kind: 'WIM / Windows Overlay (WOF) reparse points', reason: 'compact.exe or DISM with elevation; a transparent data reparse, not a path indirection (K11)' },
      { kind: 'cloud-files placeholders (OneDrive and others)', reason: `needs a sync provider; OneDrive folder present: ${fs.existsSync(p(process.env.USERPROFILE ?? '', 'OneDrive'))}` },
      { kind: 'data deduplication reparse points', reason: 'a server feature with elevation' },
      { kind: 'WSL (LX) symlinks and other tags', reason: `fsutil reparsepoint set needs elevation (process elevated: ${elevated}); WSL present: ${fs.existsSync('C:\\Windows\\System32\\wsl.exe')}` },
    ];
    for (const row of notPlantable) survey.push({ kind: row.kind, role: 'any', outcome: 'NOT_PLANTABLE', reason: row.reason });
    results.plantedAndRefused = survey.filter((row) => row.outcome === `4:${BOUNDARY}`).length;
    h.observe({ survey, problems: problems.slice(0, 6), plantedKinds: ['junction', 'directory symlink', 'file symlink'], foundNotPlanted: ['app-execution alias'], notPlantable: notPlantable.map((row) => row.kind), results });
    if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 6).join('; ')}`);
  },
};
void CORPUS_WORKSPACE;
