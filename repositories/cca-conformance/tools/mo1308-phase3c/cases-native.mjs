// MO-1308 Phase 3C step G, case G2 on the Windows host: a MemoryOS history ledger directory does not alter any MO-1307 result (R14).
// MO-1307's own native pipeline runs unchanged (the packaged CLI, its fixed PowerShell 5.1 helper, nine serial helper requests per evaluate):
// the 'ready' bundle is evaluated in a world without a ledger and in a world that has one, beside the input root, the publication parent and
// below their common parent; the result bytes, the summary on stdout and the exit code must be identical, and equal to the released fixture. The
// ledger is then fed the produced result (a READINESS_RESULT) and a human decision claim through the real history CLI, and the MO-1307 verify
// runs again over the same result with the ledger present: nothing in the ledger reaches back into MO-1307. Real processes only: no helper
// double, no worker override, no retry. Every harness-launched process here is the pinned Node running the packaged CLI.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { conclude } from './env.mjs';
import { CLI, appendArgs, buildDiskLedger, cli, corpusRecords } from './support.mjs';
import { SCRATCH, removeTree } from './links.mjs';

const p = (...parts) => path.join(...parts);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const READINESS_CLI = 'repositories/memoryos-readiness/bin/memoryos-readiness.mjs';
const BUNDLES = 'repositories/cca-conformance/fixtures/mo1307/bundles';
const SYSTEM_ENV = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' };
const GUARD_MS = 90000;

function nativeRun(root, args) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [p(root, READINESS_CLI), ...args], { cwd: root, env: SYSTEM_ENV, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = []; const err = []; let expired = false;
    child.stdout.on('data', (chunk) => out.push(chunk)); child.stderr.on('data', (chunk) => err.push(chunk)); child.stdin.end();
    const timer = setTimeout(() => { expired = true; child.kill(); }, GUARD_MS);
    child.on('close', (status, signal) => { clearTimeout(timer); resolve({ status, signal, expired, ms: Date.now() - started, stdout: Buffer.concat(out), stderr: Buffer.concat(err) }); });
  });
}

export const nativeCases = {
  '3C-G2': async (h, env) => {
    const problems = []; const observed = {};
    const scratch = p(env.repo, SCRATCH);
    const root = p(scratch, `g2-${process.pid}`);
    fs.mkdirSync(root, { recursive: true });
    try {
      const name = 'ready';
      const bundle = p(env.repo, BUNDLES, name);
      const pins = JSON.parse(fs.readFileSync(p(bundle, 'pins.json'), 'utf8'));
      const expectedResult = fs.readFileSync(p(bundle, 'expected-result.json'));
      const world = (label) => {
        const directory = p(root, label);
        const input = p(directory, 'input');
        fs.mkdirSync(directory);
        fs.cpSync(bundle, input, { recursive: true });
        const parent = p(directory, 'publication'); fs.mkdirSync(parent);
        fs.writeFileSync(p(parent, 'owned-parent.txt'), 'MO-1308 3C-G2: an owned, stable publication parent.\n');
        return { directory, input, parent, destination: p(parent, 'result') };
      };
      const common = (w) => ['--input-root', w.input, '--config', 'configuration.json', '--authority', 'authority.json', '--authority-sha256', pins.trustedAuthorityDigest, '--candidate-sha256', pins.expectedCandidateDigest];
      const evaluate = (w) => nativeRun(env.repo, ['evaluate', ...common(w), '--output-root', w.destination]);
      const verify = (w) => nativeRun(env.repo, ['verify', ...common(w), '--result-root', w.destination]);
      const resultOf = (w) => fs.readFileSync(p(w.destination, 'memoryos-readiness-result.json'));
      // the world without a ledger
      const plain = world('plain');
      const baseline = await evaluate(plain);
      observed.baselineEvaluate = { exit: baseline.status, ms: baseline.ms, stdoutBytes: baseline.stdout.length };
      if (baseline.expired || baseline.status !== pins.expectedExit || baseline.stderr.length !== 0) problems.push(`the MO-1307 baseline evaluate gave exit ${baseline.status}${baseline.expired ? ' (guard expired)' : ''}, stderr ${baseline.stderr.length} bytes: this is an MO-1307 environment result, not a history one`);
      else {
        const baselineResult = resultOf(plain);
        if (!baselineResult.equals(expectedResult)) problems.push('the baseline result is not the released fixture result');
        const baselineVerify = await verify(plain);
        observed.baselineVerify = { exit: baselineVerify.status, ms: baselineVerify.ms };
        // the world with ledgers: beside the input root and the publication parent (inside the world), and below their common parent
        const withLedger = world('with-ledger');
        const ledger = buildDiskLedger(withLedger.directory, 'history-ledger', ['mip-reference', 'policy-0', 'readiness-ready']);
        const outerLedger = buildDiskLedger(root, 'outer-history-ledger', ['checkpoint-c00', 'readiness-qualified']);
        const ledgerBefore = [...fs.readdirSync(ledger)].sort().join(',');
        const evaluated = await evaluate(withLedger);
        observed.withLedgerEvaluate = { exit: evaluated.status, ms: evaluated.ms };
        if (evaluated.expired || evaluated.status !== baseline.status) problems.push(`evaluate with a ledger present: exit ${evaluated.status}, the baseline gave ${baseline.status}`);
        if (!evaluated.stdout.equals(baseline.stdout) || !evaluated.stderr.equals(baseline.stderr)) problems.push('the evaluate summary or stderr changed with a ledger present');
        if (!resultOf(withLedger).equals(baselineResult)) problems.push('the MO-1307 result bytes changed with a ledger present');
        if (fs.readdirSync(withLedger.destination).join(',') !== fs.readdirSync(plain.destination).join(',')) problems.push('the published file set changed with a ledger present');
        // feed the produced result and a human decision claim into the ledger through the real history CLI, then verify again
        const records = corpusRecords();
        const written = p(root, 'produced');
        fs.mkdirSync(written);
        fs.writeFileSync(p(written, 'memoryos-readiness-result.json'), resultOf(withLedger));
        const appendedResult = cli(['history', 'append', '--ledger', ledger, '--kind', 'READINESS_RESULT', '--record', p(written, 'memoryos-readiness-result.json'), '--json']);
        observed.producedResultAppended = `${appendedResult.status}:${appendedResult.code ?? 'ok'}`;
        const claim = records.find((record) => record.id === 'decision-ready-approve');
        const claimFile = p(written, 'human-decision.json'); fs.writeFileSync(claimFile, claim.members[0].bytes);
        const appendedClaim = cli(['history', 'append', '--ledger', ledger, '--kind', 'HUMAN_DECISION_CLAIM', '--record', claimFile, '--json']);
        observed.decisionClaimAppended = `${appendedClaim.status}:${appendedClaim.code ?? 'ok'}`;
        const verifiedAgain = await verify(withLedger);
        observed.verifyWithLedger = { exit: verifiedAgain.status, ms: verifiedAgain.ms };
        if (verifiedAgain.expired || verifiedAgain.status !== baselineVerify.status || !verifiedAgain.stdout.equals(baselineVerify.stdout) || !verifiedAgain.stderr.equals(baselineVerify.stderr)) problems.push('the MO-1307 verify changed with the ledger holding its result');
        if (!resultOf(withLedger).equals(baselineResult)) problems.push('the result file changed after the ledger took a copy');
        if (ledgerBefore.length === 0 || cli(['history', 'verify', '--ledger', outerLedger, '--json']).status !== 0) problems.push('a ledger in the common parent does not verify');
        observed.resultSha256 = sha(baselineResult);
      }
      conclude(h, problems, observed);
    } finally {
      removeTree(scratch, root);
      try { fs.rmdirSync(scratch); } catch { /* other scratch content remains */ }
    }
  },
};
void CLI; void appendArgs;
