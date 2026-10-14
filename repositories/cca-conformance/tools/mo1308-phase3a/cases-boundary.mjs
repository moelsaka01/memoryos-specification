// MO-1308 Phase 3A step D, case D5: init and export at or under a link, and export --output inside the ledger (Amendment A9.2).
// Links are directory symlinks, or junctions on Windows (a junction needs no privilege), so the case is written once for every host.
// Every refusal is MO1308_FILESYSTEM_BOUNDARY (exit 4), creates nothing, and leaves the ledger and the link target byte-identical.
import fs from 'node:fs';
import path from 'node:path';
import { CORPUS_WORKSPACE, initArgs, readTree, treeDigest } from './support.mjs';
import { conclude, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';

export const link = (target, at) => fs.symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir');

export const boundaryCases = {
  '3A-D5': (h, env) => {
    const problems = [];
    const results = {};
    const base = work(env, 'd5');
    const ledger = ledgerWith(env, 'd5-ledger', ['policy-0', 'readiness-ready']);
    const target = path.join(base, 'target'); fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'sentinel.txt'), 'untouched');
    const targetBefore = treeDigest(target);
    const ledgerBefore = treeDigest(ledger);
    const lnk = path.join(base, 'lnk'); link(target, lnk);
    const dangling = path.join(base, 'dangling'); link(path.join(base, 'does-not-exist'), dangling);
    const alias = path.join(base, 'alias-of-ledger'); link(ledger, alias);
    const refuse = (name, args, options = {}) => {
      const result = run(env, [...args, '--json'], options);
      results[name] = `${result.status}:${result.code}`;
      if (result.status !== 4 || result.code !== 'MO1308_FILESYSTEM_BOUNDARY' || result.exit !== 4) problems.push(`${name}: ${result.status} ${result.code}`);
      if (treeDigest(target) !== targetBefore) problems.push(`${name}: the link target changed`);
      if (treeDigest(ledger) !== ledgerBefore) problems.push(`${name}: the ledger changed`);
    };
    const exportArgs = (output, from = ledger) => ['history', 'export', '--ledger', from, '--output', output];
    // init at or under a link, and at a dangling link
    refuse('init at a link', initArgs(lnk, 'd5').slice(0, -1));
    refuse('init under a link', initArgs(path.join(lnk, 'sub'), 'd5').slice(0, -1));
    refuse('init at a dangling link', initArgs(dangling, 'd5').slice(0, -1));
    // export at or under a link
    refuse('export at a link', exportArgs(lnk));
    refuse('export under a link', exportArgs(path.join(lnk, 'e')));
    refuse('export at a dangling link', exportArgs(dangling));
    refuse('export from a ledger reached through a link', exportArgs(path.join(base, 'e-via-alias'), alias));
    // export --output inside the ledger: the six forms of the original finding, then spelling and identity aliases
    const forms = [['inside the ledger', path.join(ledger, 'export')], ['inside entries', path.join(ledger, 'entries', 'export')], ['inside records', path.join(ledger, 'records', 'export')],
      ['inside .pending', path.join(ledger, '.pending', 'export')], ['the ledger itself', ledger], ['dot-dot into the ledger', path.join(ledger, 'entries', '..', 'export2')],
      ['trailing separator', `${path.join(ledger, 'export3')}${path.sep}`], ['dot segment', path.join(ledger, '.', 'export4')], ['under a link to the ledger', path.join(alias, 'export5')]];
    if (process.platform === 'win32') forms.push(['differently cased spelling', path.join(ledger.toUpperCase(), 'export6')], ['forward-slash spelling', path.join(ledger, 'export7').split(path.sep).join('/')]);
    for (const [name, output] of forms) refuse(`export ${name}`, exportArgs(output));
    refuse('export relative into the ledger', exportArgs('entries/export8'), { cwd: ledger });
    // outside the ledger nothing changes
    for (const name of ['d5-sibling', '..dotted']) {
      const result = run(env, [...exportArgs(path.join(base, name)), '--json']);
      results[name] = `${result.status}`;
      if (result.status !== 0) problems.push(`${name}: a legitimate location was refused (${result.code})`);
    }
    const verify = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
    if (verify.status !== 0) problems.push('the ledger no longer verifies');
    void CORPUS_WORKSPACE; void readTree; void register;
    conclude(h, problems, { results, links: process.platform === 'win32' ? 'junctions' : 'directory symlinks', windowsOnlySpellings: process.platform === 'win32' ? ['case', 'forward slash'] : 'Step 3 host rehearsal (case, drive-letter, UNC)' });
  },
};
