// MO-1308 Phase 3C step F, case F3 on the Windows host: a link or junction inside an export directory (R17, R23). The export is made by
// the real CLI; links are planted in copies of it; `memoryos history verify-export` runs as a real process. The pristine export verifies;
// every export with a link anywhere in it is refused with MO1308_FILESYSTEM_BOUNDARY (exit 4), even when the link points at identical
// bytes, and no link target is read through, changed or created.
import fs from 'node:fs';
import path from 'node:path';
import { conclude } from './env.mjs';
import { buildDiskLedger, cli, readTree, sha } from './support.mjs';
import { SCRATCH, copyTree, dirSymlink, exists, fileSymlink, junction, removeLink, removeTree, snapshot } from './links.mjs';

const p = (...parts) => path.join(...parts);
const digest = (bytes) => sha(bytes);

export const linkCases = {
  '3C-F3': (h, env) => {
    const scratch = p(env.repo, SCRATCH);
    const root = p(scratch, `f3-${process.pid}`);
    fs.mkdirSync(root, { recursive: true });
    const problems = []; const results = {};
    try {
      const ledger = buildDiskLedger(root, 'f3-ledger', ['policy-0', 'readiness-ready', 'decision-ready-approve']);
      const exported = p(root, 'pristine');
      const made = cli(['history', 'export', '--ledger', ledger, '--output', exported, '--json']);
      if (made.status !== 0) throw new Error(`export failed: ${made.code}`);
      const verifyExport = (directory) => cli(['history', 'verify-export', '--export', directory, '--json']);
      const pristine = verifyExport(exported);
      results.pristine = `${pristine.status}`;
      if (pristine.status !== 0) problems.push(`the pristine export does not verify: ${pristine.status} ${pristine.code}`);
      const files = [...readTree(exported).keys()];
      const entryFile = files.find((name) => name.startsWith('entries/'));
      const memberFile = files.find((name) => name.startsWith('records/'));
      const recordDirectory = path.posix.dirname(memberFile);
      const descriptor = 'memoryos-history-ledger.json';
      let variants = 0;
      const outsideRoot = p(root, 'outside'); fs.mkdirSync(outsideRoot);
      const plant = (label, make) => {
        variants += 1;
        const directory = p(root, `variant-${variants}`);
        copyTree(exported, directory);
        const outside = p(outsideRoot, `v${variants}`); fs.mkdirSync(outside);
        make(directory, outside);
        const before = snapshot(outside, digest); // what the links point at, once planted: the refusal must leave exactly this
        const result = verifyExport(directory);
        results[label] = `${result.status}:${result.code ?? 'ok'}`;
        if (result.status !== 4 || result.code !== 'MO1308_FILESYSTEM_BOUNDARY' || result.exit !== 4) problems.push(`${label}: ${result.status} ${result.code ?? 'ok'}`);
        const after = snapshot(outside, digest);
        if (JSON.stringify([...before]) !== JSON.stringify([...after])) problems.push(`${label}: the link target changed`);
        // links first, then the tree: nothing is ever removed through a link
        removeTree(root, directory);
      };
      // a directory replaced by a link to a copy of itself (identical bytes behind the link)
      for (const [kind, make] of [['junction', junction], ['directory symlink', dirSymlink]]) {
        for (const directoryName of ['entries', 'records', recordDirectory]) {
          plant(`${directoryName.split('/')[0]}${directoryName.includes('/') ? ' (a record directory)' : ''} is a ${kind}`, (directory, outside) => {
            const at = p(directory, ...directoryName.split('/')); const copy = p(outside, 'copy');
            copyTree(at, copy); removeTree(root, at); make(copy, at);
          });
        }
        plant(`an extra ${kind} in the export root`, (directory, outside) => make(outside, p(directory, 'extra-link')));
        plant(`a dangling ${kind} in the export root`, (directory) => make(p(root, 'nowhere'), p(directory, 'dangling-link')));
        plant(`a ${kind} inside entries`, (directory, outside) => make(outside, p(directory, 'entries', 'extra-link')));
      }
      // a file replaced by a symlink to a copy of itself
      for (const name of [descriptor, entryFile, memberFile, 'memoryos-history-export.json', 'memoryos-history-export-complete.json']) {
        plant(`${path.posix.basename(name)} is a file symlink`, (directory, outside) => {
          const at = p(directory, ...name.split('/')); const copy = p(outside, 'copy');
          fs.copyFileSync(at, copy); fs.unlinkSync(at); fileSymlink(copy, at);
        });
      }
      plant('an extra dangling file symlink', (directory) => fileSymlink(p(root, 'nowhere-file'), p(directory, 'dangling.json')));
      // the export directory itself is a link
      for (const [kind, make] of [['junction', junction], ['directory symlink', dirSymlink]]) {
        const link = p(root, `export-as-${kind.replace(' ', '-')}`); make(exported, link);
        const result = verifyExport(link);
        results[`the export directory is a ${kind}`] = `${result.status}:${result.code ?? 'ok'}`;
        if (result.status !== 4 || result.code !== 'MO1308_FILESYSTEM_BOUNDARY') problems.push(`the export directory as a ${kind}: ${result.status} ${result.code}`);
        removeLink(link);
      }
      // the pristine export was never touched by any of it
      const again = verifyExport(exported);
      if (again.status !== 0) problems.push('the pristine export no longer verifies');
      if (exists(p(root, 'nowhere')) || exists(p(root, 'nowhere-file'))) problems.push('something was created at a dangling link target');
      conclude(h, problems, { variants, results, links: ['junction', 'directory symlink', 'file symlink', 'dangling'] });
    } finally {
      removeTree(scratch, root);
      try { fs.rmdirSync(scratch); } catch { /* other scratch content remains */ }
    }
  },
};
