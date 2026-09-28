// Emit only bounded correction metadata; execution receipts remain separate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const dir = 'repositories/cca-conformance/evidence/mo1307/phase2c-correction';
const baseline = '3883ca889911fcc5a6f46c24e569478a8c32648e';
const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 }); assert.ifError(r.error); assert.equal(r.status, 0); return r.stdout.trim(); };
const write = (name, value) => fs.writeFileSync(path.join(root, dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const binding = p => { const bytes = fs.readFileSync(path.join(root, p)); return { path: p, byteLength: bytes.length, sha256: 'sha256:' + createHash('sha256').update(bytes).digest('hex') }; };
assert.equal(git('rev-parse', 'HEAD'), baseline);
assert.equal(git('branch', '--show-current'), 'main');
assert.equal(git('rev-parse', 'HEAD^'), '7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee');
assert.equal(git('rev-parse', 'HEAD^^'), 'e0cb8e9cc6aa73e26945db30756a6667a8d9e322');
assert.equal(git('rev-parse', 'memoryos-1.3-mo1306'), '9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8');
assert.equal(git('rev-parse', 'memoryos-1.3-mo1306^{}'), '332ab0d2c35643ea8d155bcbea9c5019b304bbe3');
write('baseline.json', { kind: 'MemoryOSReadinessPublicationCorrectionBaseline', version: '1.0.0',
  workspace: root, branch: 'main', B1: baseline, I1: git('rev-parse', 'HEAD^'), freeze: git('rev-parse', 'HEAD^^'),
  subject: git('show', '-s', '--format=%s', 'HEAD'), taskStartedAt: '2026-09-28T15:35:10Z',
  initialCleanMain: true, initialCleanObservation: 'Root pre-edit git status --short returned no tracked or untracked changes before independent reproduction. This metadata is emitted later during the correction, not a claim the current worktree is still clean.',
  independentlyReproducedBeforeProductionEdits: binding(dir + '/old-blocker-reproduction.json'),
  tagObservation: { name: 'memoryos-1.3-mo1306', object: git('rev-parse', 'memoryos-1.3-mo1306'), peeled: git('rev-parse', 'memoryos-1.3-mo1306^{}'), source: 'LOCAL_ENGINEERING_READ_ONLY', productGitAuthority: false },
  platform: process.platform, network: false, push: false, tagMutation: false, otherWorktreeWrites: false });
const operations = ['READ_SET', 'READ_SET', 'READ_SET', 'CHECK_OUTPUT', 'CHECK_OUTPUT', 'INSPECT_OUTPUT_ROOT', 'CHECK_STAGE_ROOT', 'INSPECT_PENDING', 'CHECK_FINALIZATION'];
write('protocol-matrix.json', { kind: 'MemoryOSReadinessPublicationProtocolCorrectionMatrix', version: '1.0.0',
  original: { wireVersion: '1.0.0', requestsPerAssessment: 4, requestsPerInvocation: 1, postWorkerChannel: false, outputResponse: 'ABSENT; one output-parent identity; no files' },
  corrected: { wireVersion: '2.0.0', session: '64 lowercase hexadecimal characters, fresh per assessment', requestsPerInvocation: 1,
    evaluateInvocations: 9, verifyInvocations: 4, automaticRetry: false, chainIdentitiesMaximum: 120,
    evaluate: operations.map((operation, index) => ({ sequence: index + 1, operation, phase: index < 4 ? 'BEFORE_WORKER' : 'AFTER_WORKER_DURING_PUBLICATION' })),
    verify: ['READ_SET', 'READ_SET', 'READ_SET', 'READ_SET'], verifyPublishes: false,
    helperDeadlineMs: 5000, helperAggregateDeadlineMs: 20000, apiDeadlineMs: 10000, cliDeadlineMs: 30000, cleanupAllowanceMs: 2000,
    responseAuthority: 'Full native chain; slot9 includes native fixed final absence after exact-byte reread',
    concurrentHelperMaximum: 1, attributableProcessRolesMaximum: 3, workerThreadsMaximum: 1, helperWorkerOverlap: false },
  unchanged: ['Identity seven fields', 'all byte caps', 'all public semantic schemas and record versions', 'private immutable-root precondition', 'no network, credentials or product Git', 'readiness/evidence semantics'],
  reference: 'docs/mo1307-phase2c-publication-inspection-correction.md' });
write('binding-plan.json', { kind: 'MemoryOSReadinessPublicationCorrectionBindingPlan', version: '1.0.0',
  C2C: { parent: baseline, subject: 'fix(memoryos-1.3): correct MO-1307 publication inspection contract', scope: 'TARGETED_CONTRACT_AND_MINIMUM_SHARED_FOUNDATION' },
  C2CB: { parent: 'ACTUAL_EXISTING_C2C', subject: 'conformance(memoryos-1.3): bind MO-1307 publication inspection correction',
    allowedFiles: [dir + '/binding.json', dir + '/binding-verification.json'], productionChanges: false },
  acyclic: 'C2C inventory excludes itself; C2CB binds actual C2C commit/tree/all changed blobs. No future or self hashes.',
  historicalEvidence: 'B1 inventories and receipts retained unchanged; correction receipts describe corrected sources separately.',
  postBinding: ['graph and binding', 'all five original blocker bytes and stopped state', 'focused correction tests', 'full affected Phase1 regression',
    '2A/2B unchanged committed compatibility', 'package integrity', 'workspace verification', 'git diff --check HEAD^ HEAD', 'clean main'],
  postBindingReceiptLocation: '.cache/mo1307/phase2c-correction/post-binding (read-only validations; no third commit)',
  resumption: 'Only exact verified C2CB; no resumed2C execution or worktree creation in this task' });
console.log(JSON.stringify({ result: 'PASS', files: 3 }));
