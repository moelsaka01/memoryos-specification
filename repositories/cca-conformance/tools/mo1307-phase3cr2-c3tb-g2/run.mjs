// One-shot runner for the fresh MO-1307 C3TB Phase 3CR2 G2 generation.
// The prior failed generation is an immutable input, never a resume source.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const toolRelative = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
const evidenceRelative = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
const validationRelative = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation/validation.json';
const validationRootRelative = path.dirname(validationRelative);
const priorToolRelative = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const priorEvidenceRelative = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const toolRoot = path.join(root, toolRelative);
const evidenceRoot = path.join(root, evidenceRelative);
const planRelative = `${evidenceRelative}/campaign-plan.json`;
const sealRelative = `${evidenceRelative}/pre-execution-seal.json`;
const startRelative = `${evidenceRelative}/execution-start.json`;
const ledgerRelative = `${evidenceRelative}/execution-ledger.json`;
const logRelative = `${evidenceRelative}/stage-logs`;
const ledgerPath = path.join(root, ledgerRelative);
const logRoot = path.join(root, logRelative);

const GIT = 'C:/Program Files/Git/cmd/git.exe';
const BRANCH = 'codex/mo1307-phase3cr2-c3tb';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const PRODUCTION_TREE = '324bf600b6cbfaa8564db27fce2d999711270cb8';
const PRIOR_TOOL_COUNT = 15;
const PRIOR_TOOL_DIGEST = 'sha256:9abb9d879a5b29724b42a8efa31f66579d104c336ef4ed2f2e304a77ff7c1e19';
const PRIOR_EVIDENCE_COUNT = 194;
const PRIOR_EVIDENCE_DIGEST = 'sha256:2ce1063de146fb4c1bb153175271ff19e0a6db5d9d759abe0e137e4b00b8224f';
const NODE = Object.freeze({
  version: 'v24.21.0',
  platform: 'win32',
  arch: 'x64',
  byteLength: 93580104,
  sha256: 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32',
});
const EXPECTED_NODE_PATH = path.join(root, '.cache/mo1307-phase3cr2-runtime/node.exe');
const FIXED_ENV = Object.freeze({ SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });

const slash = value => value.replaceAll('\\', '/');
const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
};
const canonicalBytes = value => Buffer.from(`${canonical(value)}\n`);
const sha256 = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const gitBlob = data => crypto.createHash('sha1')
  .update(Buffer.from(`blob ${data.length}\0`))
  .update(data)
  .digest('hex');
const errorRecord = error => ({
  name: error?.name ?? 'Error',
  code: error?.code ?? null,
  message: error?.message ?? String(error),
  stack: error?.stack ?? null,
});

function readRegular(absolute) {
  const stat = fs.lstatSync(absolute);
  assert.equal(stat.isSymbolicLink(), false, `Symlink is forbidden: ${absolute}`);
  assert.equal(stat.isFile(), true, `Expected regular file: ${absolute}`);
  return fs.readFileSync(absolute);
}

function artifactRecord(absolute) {
  const data = readRegular(absolute);
  return { path: slash(path.relative(root, absolute)), byteLength: data.length, sha256: sha256(data) };
}

function fileRecord(absolute) {
  const data = readRegular(absolute);
  return { ...artifactRecord(absolute), gitBlob: gitBlob(data) };
}

function writeJson(relative, value) {
  const absolute = path.join(root, relative);
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return artifactRecord(absolute);
}

function walkRecords(directory) {
  const files = [];
  const walk = current => {
    const stat = fs.lstatSync(current);
    assert.equal(stat.isSymbolicLink(), false, `Directory is a symlink: ${current}`);
    assert.equal(stat.isDirectory(), true, `Expected directory: ${current}`);
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const absolute = path.join(current, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `Input is a symlink: ${absolute}`);
      if (entry.isDirectory()) walk(absolute);
      else {
        assert.equal(entry.isFile(), true, `Input is not a regular file: ${absolute}`);
        files.push(absolute);
      }
    }
  };
  walk(directory);
  return files
    .sort((a, b) => slash(a).localeCompare(slash(b), 'en'))
    .map(fileRecord);
}

function closureSnapshot(relative, expectedCount, expectedDigest) {
  const files = walkRecords(path.join(root, relative));
  const digest = sha256(canonicalBytes(files));
  assert.equal(files.length, expectedCount, `${relative} file count`);
  assert.equal(digest, expectedDigest, `${relative} closure digest`);
  return { path: relative, fileCount: files.length, digest, files };
}

function git(args, { input = null, encoding = 'utf8' } = {}) {
  const result = spawnSync(
    GIT,
    ['-c', 'core.longpaths=true', '-c', `safe.directory=${slash(root).replace(/\/$/u, '')}`, ...args],
    { cwd: root, input, encoding, windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${GIT} ${args.join(' ')} failed (${result.status}): ${String(result.stderr)}`);
  return result.stdout;
}

const gitText = args => String(git(args)).trim();

function assertObjectRecord(record) {
  const data = git(['cat-file', 'blob', record.gitBlob], { encoding: null });
  assert.equal(data.length, record.byteLength, record.path);
  assert.equal(sha256(data), record.sha256, record.path);
  assert.equal(gitBlob(data), record.gitBlob, record.path);
}

function readJson(relative) {
  return JSON.parse(readRegular(path.join(root, relative)).toString('utf8'));
}

function artifactPart(record) {
  return { path: record.path, byteLength: record.byteLength, sha256: record.sha256 };
}

function assertInitialEvidenceRoot() {
  const rootStat = fs.lstatSync(evidenceRoot);
  assert.equal(rootStat.isSymbolicLink(), false, 'G2 evidence root is a symlink.');
  assert.equal(rootStat.isDirectory(), true, 'G2 evidence root is not a directory.');
  const entries = fs.readdirSync(evidenceRoot, { withFileTypes: true });
  assert.equal(entries.every(entry => entry.isFile() && !entry.isSymbolicLink()), true);
  assert.deepEqual(entries.map(entry => entry.name).sort(), [path.basename(planRelative), path.basename(sealRelative)].sort());
}

function assertAllowedWorktreeState() {
  const raw = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: null }).toString('utf8');
  const allowedRoots = [priorToolRelative, priorEvidenceRelative, toolRelative, validationRootRelative, evidenceRelative];
  for (const entry of raw.split('\0').filter(Boolean)) {
    const status = entry.slice(0, 2);
    assert.equal(/[RC]/u.test(status), false, `Rename/copy is forbidden during G2: ${entry}`);
    const relative = slash(entry.slice(3));
    assert.equal(
      allowedRoots.some(directory => relative === directory || relative.startsWith(`${directory}/`)),
      true,
      `Unexpected dirty path during G2: ${relative}`,
    );
  }
}

assert.deepEqual(process.argv.slice(2), []);
assert.equal(process.platform, NODE.platform);
assert.equal(process.arch, NODE.arch);
assert.equal(process.version, NODE.version);
assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(EXPECTED_NODE_PATH).toLowerCase(), 'Run with the provisioned Phase 3CR2 runtime.');
const runtime = artifactRecord(process.execPath);
assert.equal(runtime.byteLength, NODE.byteLength);
assert.equal(runtime.sha256, NODE.sha256);
assert.equal(gitText(['branch', '--show-current']), BRANCH);
assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
assert.equal(gitText(['rev-parse', 'HEAD:repositories/memoryos-readiness']), PRODUCTION_TREE);
assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', 'repositories/memoryos-readiness']), '');

const planPath = path.join(root, planRelative);
const sealPath = path.join(root, sealRelative);
assert.equal(fs.existsSync(planPath), true, 'G2 campaign plan is required.');
assert.equal(fs.existsSync(sealPath), true, 'G2 pre-execution seal is required.');
assertInitialEvidenceRoot();
const plan = readJson(planRelative);
const seal = readJson(sealRelative);
const planRecord = artifactRecord(planPath);
const sealRecord = artifactRecord(sealPath);

assert.equal(plan.kind, 'MO1307Phase3CR2C3TBCampaignPlan');
assert.equal(plan.version, '1.0.0');
assert.equal(plan.status, 'SEALED_NOT_EXECUTED');
assert.equal(seal.kind, 'MO1307Phase3CR2C3TBPreExecutionSeal');
assert.equal(seal.version, '1.0.0');
assert.equal(seal.result, 'SEALED_NOT_EXECUTED');
assert.deepEqual(seal.campaignPlan, planRecord);
assert.deepEqual(plan.candidate, seal.candidate);
assert.equal(plan.candidate.role, 'C3TB');
assert.equal(plan.candidate.commit, C3TB);
assert.equal(plan.candidate.tree, C3TB_TREE);
assert.equal(plan.candidate.soleParent, C3T);
assert.equal(plan.candidate.productionTree, PRODUCTION_TREE);
assert.equal(plan.candidate.branch, BRANCH);
assert.deepEqual(plan.generation, {
  id: 'phase3cr2-c3tb-g2',
  ordinal: 2,
  mode: 'FRESH_AFTER_FAILED_GENERATION',
  resumesPriorAttempt: false,
});
assert.deepEqual(seal.generation, plan.generation);
assert.deepEqual(seal.priorFailedGeneration, plan.priorFailedGeneration);
assert.deepEqual(seal.harnessValidation, plan.harnessValidation);
assert.deepEqual(seal.pinCorrection, plan.pinCorrection);
assert.deepEqual(seal.zeroExecutionPreflight, plan.zeroExecutionPreflight);

const prior = plan.priorFailedGeneration;
assert.equal(prior.id, 'phase3cr2-c3tb');
assert.equal(prior.ordinal, 1);
assert.equal(prior.status, 'FAILED_INCOMPLETE');
assert.equal(prior.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
assert.equal(prior.resumable, false);
assert.equal(prior.tools.path, priorToolRelative);
assert.equal(prior.tools.fileCount, PRIOR_TOOL_COUNT);
assert.equal(prior.tools.digest, PRIOR_TOOL_DIGEST);
assert.equal(prior.evidence.path, priorEvidenceRelative);
assert.equal(prior.evidence.fileCount, PRIOR_EVIDENCE_COUNT);
assert.equal(prior.evidence.digest, PRIOR_EVIDENCE_DIGEST);
assert.deepEqual(prior.firstFailure, { stage: 'DEADLINE_CLEANUP_SELECTED_7', ordinal: 4 });
const expectedPriorStageStatuses = [
  { ordinal: 1, id: 'DEPENDENCY_REUSE_PROOF_462', status: 'PASS' },
  { ordinal: 2, id: 'HEADLESS_SMOKE', status: 'PASS' },
  { ordinal: 3, id: 'HEADLESS_SECURITY_A_TO_S_19', status: 'PASS' },
  { ordinal: 4, id: 'DEADLINE_CLEANUP_SELECTED_7', status: 'FAIL' },
  { ordinal: 5, id: 'EQUIVALENCE_SELECTED_67', status: 'NOT_RUN' },
  { ordinal: 6, id: 'NATIVE_LAST_ERROR_METADATA', status: 'NOT_RUN' },
  { ordinal: 7, id: 'PROTOCOL_SELECTED_12', status: 'NOT_RUN' },
  { ordinal: 8, id: 'TOCTOU_BOUNDARIES_SELECTED_2', status: 'NOT_RUN' },
  { ordinal: 9, id: 'CASE_SENSITIVE_RECONCILIATION', status: 'NOT_RUN' },
];
assert.deepEqual(prior.stageStatuses, expectedPriorStageStatuses);
for (const relative of prior.absentArtifacts) assert.equal(fs.existsSync(path.join(root, relative)), false, relative);

const priorTools = closureSnapshot(priorToolRelative, PRIOR_TOOL_COUNT, PRIOR_TOOL_DIGEST);
const priorEvidence = closureSnapshot(priorEvidenceRelative, PRIOR_EVIDENCE_COUNT, PRIOR_EVIDENCE_DIGEST);
assert.deepEqual(prior.tools, priorTools);
assert.deepEqual(prior.evidence, priorEvidence);
const oldPlan = readJson(`${priorEvidenceRelative}/campaign-plan.json`);
const oldSeal = readJson(`${priorEvidenceRelative}/pre-execution-seal.json`);
const oldStart = readJson(`${priorEvidenceRelative}/execution-start.json`);
const oldLedger = readJson(`${priorEvidenceRelative}/execution-ledger.json`);
const oldFailedPreflight = readJson(`${priorEvidenceRelative}/failed-preflight-attempt-1.json`);
assert.deepEqual(prior.artifacts, {
  failedPreflight: fileRecord(path.join(root, `${priorEvidenceRelative}/failed-preflight-attempt-1.json`)),
  plan: fileRecord(path.join(root, `${priorEvidenceRelative}/campaign-plan.json`)),
  seal: fileRecord(path.join(root, `${priorEvidenceRelative}/pre-execution-seal.json`)),
  start: fileRecord(path.join(root, `${priorEvidenceRelative}/execution-start.json`)),
  ledger: fileRecord(path.join(root, `${priorEvidenceRelative}/execution-ledger.json`)),
});
assert.deepEqual(prior.nestedFailedPreflight, {
  evidence: prior.artifacts.failedPreflight,
  record: oldFailedPreflight,
});
assert.deepEqual(oldSeal.campaignPlan, artifactPart(prior.artifacts.plan));
for (const execution of [oldStart, oldLedger]) {
  assert.deepEqual(execution.preflight.campaignPlan, artifactPart(prior.artifacts.plan));
  assert.deepEqual(execution.preflight.seal, artifactPart(prior.artifacts.seal));
  assert.equal(execution.preflight.finalizedToolSetDigest, PRIOR_TOOL_DIGEST);
}
assert.deepEqual(oldPlan.finalizedToolInputs, priorTools.files);
assert.deepEqual(oldSeal.finalizedToolInputs, priorTools.files);
assert.equal(oldPlan.finalizedToolSetDigest, PRIOR_TOOL_DIGEST);
assert.equal(oldSeal.finalizedToolSetDigest, PRIOR_TOOL_DIGEST);
assert.deepEqual(oldPlan.priorFailedPreflight, { evidence: prior.artifacts.failedPreflight, record: oldFailedPreflight });
assert.deepEqual(oldSeal.priorFailedPreflight, oldPlan.priorFailedPreflight);
assert.deepEqual(oldStart.preflight.failedPreflightEvidence, prior.artifacts.failedPreflight);
assert.deepEqual(oldLedger.preflight.failedPreflightEvidence, prior.artifacts.failedPreflight);
assert.equal(oldLedger.result, 'FAILED_INCOMPLETE');
assert.equal(oldLedger.firstFailure.stage, 'DEADLINE_CLEANUP_SELECTED_7');
assert.equal(oldLedger.firstFailure.ordinal, 4);
assert.deepEqual(
  oldLedger.stages.map(({ ordinal, id, status }) => ({ ordinal, id, status })),
  expectedPriorStageStatuses,
);
const oldDeadlineReceipt = readJson(`${priorEvidenceRelative}/deadline-cleanup/attempt-1/receipt.json`);
const oldFailedSourceReview = readJson(`${priorEvidenceRelative}/deadline-cleanup/attempt-1/bounded-state-and-fixed-source-review.json`);
assert.equal(oldDeadlineReceipt.result, 'FAIL');
assert.equal(oldDeadlineReceipt.cases.length, 18);
assert.equal(oldDeadlineReceipt.cases.filter(row => row.result === 'PASS').length, 17);
assert.equal(oldDeadlineReceipt.cases.filter(row => row.result === 'FAIL').length, 1);
assert.equal(oldDeadlineReceipt.cases.find(row => row.result === 'FAIL')?.id, 'bounded-state-and-fixed-source-review');
assert.equal(oldFailedSourceReview.id, 'bounded-state-and-fixed-source-review');
assert.equal(oldFailedSourceReview.layer, 'SOURCE_REVIEW_MECHANICAL_DEPENDENCY_BINDING');
assert.equal(oldFailedSourceReview.result, 'FAIL');
assert.equal(oldFailedSourceReview.error.code, 'ERR_ASSERTION');
assert.match(oldFailedSourceReview.error.stack, /deadline-cleanup\.mjs:220:275/u);

assert.equal(plan.harnessValidation.kind, 'MO1307Phase3CR2DependencyAwareSourceReviewHarnessValidation');
assert.equal(plan.harnessValidation.version, '1.0.0');
assert.equal(plan.harnessValidation.result, 'PASS');
assert.deepEqual(plan.harnessValidation.executionCounts, {
  product: 0,
  helper: 0,
  securityCampaign: 0,
  certificationCampaign: 0,
  network: 0,
});
assert.deepEqual(plan.harnessValidation.evidence, fileRecord(path.join(root, validationRelative)));
const validation = readJson(validationRelative);
assert.deepEqual(validation.sources, [
  `${toolRelative}/source-review-manifest.json`,
  `${toolRelative}/source-review-lib.mjs`,
  `${toolRelative}/validate-source-review.mjs`,
].map(relative => fileRecord(path.join(root, relative))));
assert.deepEqual(
  plan.harnessValidation.cases.map(({ id, expected, actual }) => [id, expected, actual]),
  [
    ['authorized-current-c3tb-diff', 'PASS', 'PASS'],
    ['historical-c3rb-baseline', 'PASS', 'PASS'],
    ['unexpected-synthetic-executable-change', 'FAIL', 'FAIL'],
    ['unexpected-security-policy-change', 'FAIL', 'FAIL'],
    ['comment-only-difference', 'PASS', 'PASS'],
    ['reuse-dependency-mismatch', 'MOVE_TO_FRESH', 'MOVE_TO_FRESH'],
  ],
);

assert.deepEqual(plan.accounting, seal.accounting);
assert.deepEqual(plan.limits, seal.limits);
assert.deepEqual(plan.officialBindingCheck, seal.officialBindingCheck);
assert.deepEqual(plan.inputRecords, seal.inputRecords);
assert.deepEqual(plan.finalizedToolInputs, seal.finalizedToolInputs);
assert.equal(plan.finalizedToolInputCount, seal.finalizedToolInputCount);
assert.equal(plan.finalizedToolSetDigest, seal.finalizedToolSetDigest);
assert.deepEqual(plan.stageOrder, [
  'DEPENDENCY_REUSE_PROOF_462',
  'HEADLESS_SMOKE',
  'HEADLESS_SECURITY_A_TO_S_19',
  'DEADLINE_CLEANUP_SELECTED_7',
  'EQUIVALENCE_SELECTED_67',
  'NATIVE_LAST_ERROR_METADATA',
  'PROTOCOL_SELECTED_12',
  'TOCTOU_BOUNDARIES_SELECTED_2',
  'CASE_SENSITIVE_RECONCILIATION',
  'INDEPENDENT_FINAL_REVIEW',
  'FINAL_APPEND_ONLY_SEAL',
]);
assert.equal(plan.accounting.historical.inventory, 551);
assert.equal(plan.accounting.historical.selectedFresh, 89);
assert.equal(plan.accounting.historical.dependencyReuse, 462);
assert.equal(plan.accounting.historical.omitted, 0);
assert.equal(plan.accounting.candidateSpecificSupplementalControls.count, 2);
assert.deepEqual(plan.outputs, [planRelative, sealRelative]);
assert.deepEqual(plan.evidenceNamespaceBeforePreflight, { path: evidenceRelative, existed: false, contents: [] });
assert.deepEqual(seal.appendOnly.evidenceNamespaceBeforePreflight, plan.evidenceNamespaceBeforePreflight);
assert.equal(seal.appendOnly.writesUseExclusiveCreate, true);
assert.equal(seal.appendOnly.historicalArtifactsModified, false);
assert.equal(seal.appendOnly.productModified, false);
assert.equal(seal.appendOnly.selfReference, false);
assert.equal(seal.productControlsExecutedBeforeSeal, false);
assert.equal(seal.certificationExecutedBeforeSeal, false);
assert.equal(seal.officialBindingCheck.result, 'PASS');
for (const record of seal.inputRecords) assertObjectRecord(record);

const currentTools = walkRecords(toolRoot);
assert.deepEqual(currentTools, seal.finalizedToolInputs, 'G2 tool set differs from the pre-execution seal.');
assert.equal(sha256(canonicalBytes(currentTools)), seal.finalizedToolSetDigest);
assert.equal(currentTools.length, seal.finalizedToolInputCount);

function assertImmutableInputs() {
  assertAllowedWorktreeState();
  assert.equal(gitText(['branch', '--show-current']), BRANCH);
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', 'repositories/memoryos-readiness']), '');
  assert.deepEqual(artifactRecord(planPath), planRecord, 'G2 campaign plan changed after sealing.');
  assert.deepEqual(artifactRecord(sealPath), sealRecord, 'G2 pre-execution seal changed after sealing.');
  assert.deepEqual(closureSnapshot(priorToolRelative, PRIOR_TOOL_COUNT, PRIOR_TOOL_DIGEST), prior.tools);
  assert.deepEqual(closureSnapshot(priorEvidenceRelative, PRIOR_EVIDENCE_COUNT, PRIOR_EVIDENCE_DIGEST), prior.evidence);
  const sealedTools = walkRecords(toolRoot);
  assert.deepEqual(sealedTools, seal.finalizedToolInputs, 'Sealed G2 tools changed during execution.');
  assert.equal(sha256(canonicalBytes(sealedTools)), seal.finalizedToolSetDigest);
  assert.deepEqual(fileRecord(path.join(root, validationRelative)), plan.harnessValidation.evidence);
  const validationEntries = fs.readdirSync(path.join(root, validationRootRelative)).sort();
  assert.deepEqual(validationEntries, [path.basename(validationRelative)]);
  for (const relative of prior.absentArtifacts) assert.equal(fs.existsSync(path.join(root, relative)), false, relative);
}

const stages = [
  { id: 'DEPENDENCY_REUSE_PROOF_462', tool: 'reuse-proof.mjs', args: [] },
  { id: 'HEADLESS_SMOKE', tool: 'headless-smoke.mjs', args: [] },
  { id: 'HEADLESS_SECURITY_A_TO_S_19', tool: 'headless-security.mjs', args: [] },
  {
    id: 'DEADLINE_CLEANUP_SELECTED_7',
    tool: 'deadline-cleanup.mjs',
    args: ['attempt-1'],
    prepare: () => {
      const parent = path.join(evidenceRoot, 'deadline-cleanup');
      assert.equal(fs.existsSync(parent), false);
      fs.mkdirSync(parent, { recursive: false });
    },
  },
  {
    id: 'EQUIVALENCE_SELECTED_67',
    tool: 'equivalence.mjs',
    args: ['--output', `${evidenceRelative}/equivalence/attempt1`],
  },
  { id: 'NATIVE_LAST_ERROR_METADATA', tool: 'native-last-error.mjs', args: [] },
  { id: 'PROTOCOL_SELECTED_12', tool: 'protocol.mjs', args: [] },
  { id: 'TOCTOU_BOUNDARIES_SELECTED_2', tool: 'toctou-boundaries.mjs', args: [] },
  { id: 'CASE_SENSITIVE_RECONCILIATION', tool: 'reconcile.mjs', args: [] },
];
const requiredTools = ['preflight.mjs', 'run.mjs', ...stages.map(stage => stage.tool)];
assert.equal(new Set(requiredTools).size, requiredTools.length);
for (const name of requiredTools) {
  const relative = `${toolRelative}/${name}`;
  assert.ok(currentTools.some(record => record.path === relative), `Unsealed or missing required tool: ${relative}`);
}
assert.equal(fs.existsSync(ledgerPath), false, 'G2 execution ledger already exists.');
assert.equal(fs.existsSync(path.join(root, startRelative)), false, 'G2 execution already started.');
assert.equal(fs.existsSync(logRoot), false, 'G2 stage logs already exist.');
assertImmutableInputs();

const stageRows = stages.map((stage, index) => ({
  ordinal: index + 1,
  id: stage.id,
  mandatory: true,
  tool: `${toolRelative}/${stage.tool}`,
  args: [...stage.args],
  status: 'NOT_RUN',
}));
const priorSummary = {
  id: prior.id,
  ordinal: prior.ordinal,
  status: prior.status,
  outcome: prior.outcome,
  resumable: prior.resumable,
  firstFailure: prior.firstFailure,
  tools: { path: prior.tools.path, fileCount: prior.tools.fileCount, digest: prior.tools.digest },
  evidence: { path: prior.evidence.path, fileCount: prior.evidence.fileCount, digest: prior.evidence.digest },
  artifacts: prior.artifacts,
};
const preflightSummary = {
  campaignPlan: planRecord,
  seal: sealRecord,
  priorFailedGeneration: priorSummary,
  harnessValidation: plan.harnessValidation,
  pinCorrection: plan.pinCorrection,
  zeroExecution: plan.zeroExecutionPreflight,
  finalizedToolSetDigest: seal.finalizedToolSetDigest,
};
const ledger = {
  kind: 'MO1307Phase3CR2C3TBExecutionLedger',
  version: '1.0.0',
  candidate: plan.candidate,
  generation: plan.generation,
  preflight: preflightSummary,
  runtime,
  startedAt: new Date().toISOString(),
  result: 'RUNNING',
  outcome: 'RUNNING',
  firstFailure: null,
  stages: stageRows,
};
fs.mkdirSync(logRoot, { recursive: false });
writeJson(startRelative, {
  kind: 'MO1307Phase3CR2C3TBExecutionStart',
  version: '1.0.0',
  candidate: plan.candidate,
  generation: plan.generation,
  startedAt: ledger.startedAt,
  preflight: preflightSummary,
  runtime,
  policy: { once: true, retries: 0, ordered: true, stopOnFirstMandatoryFailure: true, resume: false },
  stages: stageRows.map(row => ({
    ordinal: row.ordinal,
    id: row.id,
    status: row.status,
    tool: row.tool,
    args: row.args,
  })),
});

async function execute(stage, row) {
  const prefix = `${String(row.ordinal).padStart(2, '0')}-${stage.id.toLowerCase().replaceAll('_', '-')}`;
  const stdoutRelative = `${logRelative}/${prefix}.stdout.txt`;
  const stderrRelative = `${logRelative}/${prefix}.stderr.txt`;
  const invocationRelative = `${logRelative}/${prefix}.invocation.json`;
  const resultRelative = `${logRelative}/${prefix}.result.json`;
  const script = path.join(toolRoot, stage.tool);
  const args = [script, ...stage.args];
  const command = { executable: process.execPath, args, cwd: root, env: FIXED_ENV };
  row.status = 'RUNNING';
  row.startedAt = new Date().toISOString();
  row.command = command;
  writeJson(invocationRelative, {
    kind: 'MO1307Phase3CR2StageInvocation',
    version: '1.0.0',
    candidate: C3TB,
    generation: plan.generation,
    ordinal: row.ordinal,
    id: stage.id,
    mandatory: true,
    startedAt: row.startedAt,
    command,
    runtime,
    tool: fileRecord(script),
  });

  const stdoutPath = path.join(root, stdoutRelative);
  const stderrPath = path.join(root, stderrRelative);
  const stdout = fs.openSync(stdoutPath, 'wx');
  const stderr = fs.openSync(stderrPath, 'wx');
  let actual;
  try {
    stage.prepare?.();
    actual = await new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      const child = spawn(process.execPath, args, {
        cwd: root,
        windowsHide: true,
        shell: false,
        env: { ...FIXED_ENV },
        stdio: ['ignore', stdout, stderr],
      });
      row.pid = child.pid ?? null;
      child.once('error', error => finish({ code: null, signal: null, error: errorRecord(error) }));
      child.once('close', (code, signal) => finish({ code, signal, error: null }));
    });
    if (actual.error) fs.writeSync(stderr, Buffer.from(`${JSON.stringify(actual.error)}\n`));
  } catch (error) {
    actual = { code: null, signal: null, error: errorRecord(error) };
    fs.writeSync(stderr, Buffer.from(`${JSON.stringify(actual.error)}\n`));
  } finally {
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  }

  let integrity = { result: 'PASS' };
  try {
    assertImmutableInputs();
  } catch (error) {
    integrity = { result: 'FAIL', error: errorRecord(error) };
    fs.appendFileSync(stderrPath, `${JSON.stringify({ postStageImmutableInputCheck: integrity })}\n`);
  }
  row.finishedAt = new Date().toISOString();
  row.actual = actual;
  row.integrity = integrity;
  row.stdout = artifactRecord(stdoutPath);
  row.stderr = artifactRecord(stderrPath);
  row.status = actual.code === 0 && actual.signal === null && !actual.error && integrity.result === 'PASS' ? 'PASS' : 'FAIL';
  row.expected = { exitCode: 0, signal: null, mandatoryOutcome: 'PASS', postStageImmutableInputCheck: 'PASS' };
  row.resultRecord = writeJson(resultRelative, {
    kind: 'MO1307Phase3CR2StageResult',
    version: '1.0.0',
    candidate: C3TB,
    generation: plan.generation,
    ordinal: row.ordinal,
    id: stage.id,
    mandatory: true,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    pid: row.pid ?? null,
    command,
    expected: row.expected,
    actual,
    integrity,
    stdout: row.stdout,
    stderr: row.stderr,
  });
  process.stdout.write(`${JSON.stringify({ stage: stage.id, status: row.status, actual, integrity })}\n`);
  return row.status;
}

try {
  for (let index = 0; index < stages.length; index += 1) {
    const status = await execute(stages[index], stageRows[index]);
    if (status !== 'PASS') {
      ledger.firstFailure = {
        stage: stageRows[index].id,
        ordinal: stageRows[index].ordinal,
        actual: stageRows[index].actual,
        integrity: stageRows[index].integrity,
        stdout: stageRows[index].stdout,
        stderr: stageRows[index].stderr,
        resultRecord: stageRows[index].resultRecord,
      };
      ledger.result = 'FAILED_INCOMPLETE';
      ledger.outcome = 'PHASE3CR2_FAILED_INCOMPLETE';
      break;
    }
  }
} catch (error) {
  const running = stageRows.find(row => row.status === 'RUNNING');
  if (running) running.status = 'FAIL';
  ledger.firstFailure = {
    stage: running?.id ?? 'RUNNER',
    ordinal: running?.ordinal ?? null,
    actual: { code: null, signal: null, error: errorRecord(error) },
  };
  ledger.result = 'FAILED_INCOMPLETE';
  ledger.outcome = 'PHASE3CR2_FAILED_INCOMPLETE';
}
if (!ledger.firstFailure) {
  ledger.result = 'EXECUTION_PASSED_PENDING_INDEPENDENT_FINAL_REVIEW_AND_SEAL';
  ledger.outcome = 'PHASE3CR2_EXECUTION_PASSED_PENDING_INDEPENDENT_FINAL_REVIEW_AND_SEAL';
}
ledger.finishedAt = new Date().toISOString();
writeJson(ledgerRelative, ledger);
process.stdout.write(`${JSON.stringify({ result: ledger.outcome, firstFailure: ledger.firstFailure })}\n`);
process.exitCode = ledger.firstFailure ? 1 : 0;
