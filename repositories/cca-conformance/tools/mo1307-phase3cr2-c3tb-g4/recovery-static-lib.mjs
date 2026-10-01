// Read-only filesystem/Git verification shared by the G4 validation and preflight.
// No function in this module launches a product, helper, worker, native control,
// security control, certification stage, or network operation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deriveAuthoritativeBinding } from './binding-lib.mjs';

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const BRANCH = 'codex/mo1307-phase3cr2-c3tb';
export const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
export const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
export const PRODUCT_RELATIVE = 'repositories/memoryos-readiness';
export const HELPER_RELATIVE = `${PRODUCT_RELATIVE}/helpers/windows-inspect.ps1`;
export const CANDIDATE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
export const G2_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
export const G2_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
export const G2_VALIDATION_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation/validation.json';
export const G3_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3';
export const G3_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g3';
export const G4_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4';
export const G4_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g4';
export const GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g4',
  ordinal: 4,
  mode: 'RECONCILIATION_ONLY_FROM_IMMUTABLE_G2_AFTER_FAILED_G3',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g3',
});
export const PRIOR_G3_GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g3',
  ordinal: 3,
  mode: 'RECONCILIATION_ONLY_FROM_IMMUTABLE_G2',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
});

const GIT = 'C:/Program Files/Git/cmd/git.exe';
const EXPECTED_GIT_VERSION = 'git version 2.55.0.windows.3';
const EXPECTED_NODE_VERSION = 'v24.21.0';
const EXPECTED_NODE_SHA256 = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const EXPECTED_NODE_PATH = path.join(ROOT, '.cache/mo1307-phase3cr2-runtime/node.exe');
const G2_TOOL_COUNT = 18;
const G2_TOOL_DIGEST = 'sha256:338da32c0b9c500bf19adaa9d7c5adb5fda8be0646ffb9319eff8a6de5c1a646';
const G2_EVIDENCE_COUNT = 1043;
const G2_EVIDENCE_DIGEST = 'sha256:eca2a9b239253173e76e40e13f9d4614b5039b226215760042a64677695e4416';
const G3_TOOL_COUNT = 7;
const G3_TOOL_DIGEST = 'sha256:cb80849ddec5df31f314f51fc397140f82452ada1e83da495caa630f5263527d';
const G3_EVIDENCE_COUNT = 3;
const G3_EVIDENCE_DIGEST = 'sha256:66e59061edace9359f18d796511cc2c25791ce972a87f779f89321a9329ebe87';

export const G2_ABSENT_TERMINAL_OUTPUTS = Object.freeze([
  `${G2_EVIDENCE_RELATIVE}/fresh-control-results.json`,
  `${G2_EVIDENCE_RELATIVE}/candidate-specific-controls.json`,
  `${G2_EVIDENCE_RELATIVE}/source-security-reviews.json`,
  `${G2_EVIDENCE_RELATIVE}/certification-receipt.json`,
  `${G2_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  `${G2_EVIDENCE_RELATIVE}/final-review.json`,
  `${G2_EVIDENCE_RELATIVE}/final-validation.json`,
  `${G2_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  `${G2_EVIDENCE_RELATIVE}/final-seal.json`,
]);

export const G3_ABSENT_RECONCILIATION_OUTPUTS = Object.freeze({
  fresh: `${G3_EVIDENCE_RELATIVE}/fresh-control-results.json`,
  candidate: `${G3_EVIDENCE_RELATIVE}/candidate-specific-controls.json`,
  reviews: `${G3_EVIDENCE_RELATIVE}/source-security-reviews.json`,
  administrativeRecovery: `${G3_EVIDENCE_RELATIVE}/administrative-recovery.json`,
});

export const G3_PLANNED_OUTPUTS = Object.freeze([
  `${G3_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  `${G3_EVIDENCE_RELATIVE}/recovery-plan.json`,
  `${G3_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  ...Object.values(G3_ABSENT_RECONCILIATION_OUTPUTS),
  `${G3_EVIDENCE_RELATIVE}/certification-receipt.json`,
  `${G3_EVIDENCE_RELATIVE}/final-validation.json`,
  `${G3_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  `${G3_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  `${G3_EVIDENCE_RELATIVE}/final-seal.json`,
]);

const EXPECTED_STAGES = Object.freeze([
  'DEPENDENCY_REUSE_PROOF_462',
  'HEADLESS_SMOKE',
  'HEADLESS_SECURITY_A_TO_S_19',
  'DEADLINE_CLEANUP_SELECTED_7',
  'EQUIVALENCE_SELECTED_67',
  'NATIVE_LAST_ERROR_METADATA',
  'PROTOCOL_SELECTED_12',
  'TOCTOU_BOUNDARIES_SELECTED_2',
  'CASE_SENSITIVE_RECONCILIATION',
]);

export const zeroExecutionCounts = () => ({
  helper: 0,
  worker: 0,
  product: 0,
  security: 0,
  native: 0,
  network: 0,
  certification: 0,
});

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export const canonicalBytes = value => Buffer.from(`${canonical(value)}\n`);
export const sha256 = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const gitBlob = data => crypto.createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex');
const slash = value => value.replaceAll('\\', '/');
// G2's sealed closure contract used localeCompare('en') for directory entries
// and normalized paths. Preserve that exact ordering; ordinal sorting produces
// different aggregate digests for this evidence set.
const closureSort = (left, right) => left.localeCompare(right, 'en');

function runGit(args) {
  const result = spawnSync(GIT, [
    '-c', 'core.longpaths=true',
    '-c', `safe.directory=${slash(path.resolve(ROOT))}`,
    ...args,
  ], {
    cwd: ROOT,
    encoding: null,
    windowsHide: true,
    shell: false,
    maxBuffer: 512 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${GIT} ${args.join(' ')} failed: ${result.stderr?.toString('utf8')}`);
  return result.stdout;
}

export const gitText = args => runGit(args).toString('utf8').trim();
const gitBytes = (commit, relative) => runGit(['show', `${commit}:${relative}`]);
const gitJson = (commit, relative) => JSON.parse(gitBytes(commit, relative).toString('utf8'));

export function readRegularBytes(relative) {
  const absolute = path.join(ROOT, relative);
  const stat = fs.lstatSync(absolute);
  assert.equal(stat.isSymbolicLink(), false, `${relative} is a symlink`);
  assert.equal(stat.isFile(), true, `${relative} is not a regular file`);
  return fs.readFileSync(absolute);
}

export const readJson = relative => JSON.parse(readRegularBytes(relative).toString('utf8'));

export function fileRecord(relative, includeGitBlob = false) {
  const normalized = slash(relative);
  const data = readRegularBytes(normalized);
  const result = { path: normalized, byteLength: data.length, sha256: sha256(data) };
  if (includeGitBlob) result.gitBlob = gitBlob(data);
  return result;
}

function walkFiles(relative) {
  const root = path.join(ROOT, relative);
  const rootStat = fs.lstatSync(root);
  assert.equal(rootStat.isSymbolicLink(), false, `${relative} is a symlink`);
  assert.equal(rootStat.isDirectory(), true, `${relative} is not a directory`);
  const results = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => closureSort(a.name, b.name))) {
      const absolute = path.join(current, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `${absolute} is a symlink`);
      if (entry.isDirectory()) walk(absolute);
      else {
        assert.equal(entry.isFile(), true, `${absolute} is not a regular file`);
        results.push(slash(path.relative(ROOT, absolute)));
      }
    }
  };
  walk(root);
  return results.sort(closureSort);
}

export function closureSnapshot(relative, includeGitBlob = false) {
  const files = walkFiles(relative).map(file => fileRecord(file, includeGitBlob));
  return {
    path: relative,
    fileCount: files.length,
    digest: sha256(canonicalBytes(files)),
    files,
  };
}

function gitFileRecord(commit, relative) {
  const data = gitBytes(commit, relative);
  return { path: relative, byteLength: data.length, sha256: sha256(data), gitBlob: gitBlob(data) };
}

export function assertStaticRuntimeAndRepository() {
  assert.equal(process.version, EXPECTED_NODE_VERSION);
  assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(EXPECTED_NODE_PATH).toLowerCase());
  assert.equal(sha256(fs.readFileSync(process.execPath)), EXPECTED_NODE_SHA256);
  assert.equal(gitText(['--version']), EXPECTED_GIT_VERSION);
  assert.equal(gitText(['branch', '--show-current']), BRANCH);
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', PRODUCT_RELATIVE]), '');
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', CANDIDATE_RELATIVE]), '');
  assert.equal(gitText(['diff', '--name-only', C3T, C3TB, '--', PRODUCT_RELATIVE]), '');
  return {
    node: { version: process.version, executable: process.execPath, byteLength: fs.statSync(process.execPath).size, sha256: sha256(fs.readFileSync(process.execPath)) },
    git: { executable: GIT, version: EXPECTED_GIT_VERSION },
    branch: BRANCH,
    head: C3TB,
    productWorktreeClean: true,
    candidateAuthorityWorktreeClean: true,
  };
}

function buildBindingInput(plan, seal) {
  const candidatePath = `${CANDIDATE_RELATIVE}/candidate.json`;
  const bindingPath = `${CANDIDATE_RELATIVE}/binding.json`;
  const verificationPath = `${CANDIDATE_RELATIVE}/binding-verification.json`;
  return {
    planCandidate: plan.candidate,
    sealCandidate: seal.candidate,
    candidateRecord: gitJson(C3TB, candidatePath),
    binding: gitJson(C3TB, bindingPath),
    bindingVerification: gitJson(C3TB, verificationPath),
    officialChecks: { plan: plan.officialBindingCheck, seal: seal.officialBindingCheck },
    git: {
      branch: gitText(['branch', '--show-current']),
      head: gitText(['rev-parse', 'HEAD']),
      c3tb: {
        commit: C3TB,
        tree: gitText(['show', '-s', '--format=%T', C3TB]),
        parent: gitText(['show', '-s', '--format=%P', C3TB]),
        productionTree: gitText(['rev-parse', `${C3TB}:${PRODUCT_RELATIVE}`]),
      },
      c3t: {
        commit: C3T,
        tree: gitText(['show', '-s', '--format=%T', C3T]),
        parent: gitText(['show', '-s', '--format=%P', C3T]),
        productionTree: gitText(['rev-parse', `${C3T}:${PRODUCT_RELATIVE}`]),
      },
      helperAtC3TB: gitFileRecord(C3TB, HELPER_RELATIVE),
      helperAtC3T: gitFileRecord(C3T, HELPER_RELATIVE),
      helperCheckout: fileRecord(HELPER_RELATIVE, true),
    },
  };
}

function compactLedger(ledger, record) {
  return {
    record,
    result: ledger.result,
    outcome: ledger.outcome,
    firstFailure: {
      stage: ledger.firstFailure?.stage,
      ordinal: ledger.firstFailure?.ordinal,
      integrity: ledger.firstFailure?.integrity,
    },
    stages: ledger.stages.map(stage => ({
      ordinal: stage.ordinal,
      id: stage.id,
      status: stage.status,
      actual: stage.actual,
      integrity: stage.integrity,
    })),
  };
}

function verifyLedger(ledger) {
  assert.equal(ledger.kind, 'MO1307Phase3CR2C3TBExecutionLedger');
  assert.equal(ledger.version, '1.0.0');
  assert.deepEqual(ledger.generation, { id: 'phase3cr2-c3tb-g2', mode: 'FRESH_AFTER_FAILED_GENERATION', ordinal: 2, resumesPriorAttempt: false });
  assert.equal(ledger.result, 'FAILED_INCOMPLETE');
  assert.equal(ledger.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(ledger.stages.length, EXPECTED_STAGES.length);
  assert.deepEqual(ledger.stages.map(stage => stage.id), EXPECTED_STAGES);
  for (const stage of ledger.stages.slice(0, 8)) {
    assert.equal(stage.status, 'PASS');
    assert.deepEqual(stage.actual, { code: 0, signal: null, error: null });
    assert.deepEqual(stage.integrity, { result: 'PASS' });
  }
  const failed = ledger.stages[8];
  assert.equal(failed.ordinal, 9);
  assert.equal(failed.status, 'FAIL');
  assert.deepEqual(failed.actual, { code: 1, signal: null, error: null });
  assert.deepEqual(failed.integrity, { result: 'PASS' });
  assert.equal(ledger.firstFailure.stage, 'CASE_SENSITIVE_RECONCILIATION');
  assert.equal(ledger.firstFailure.ordinal, 9);
  assert.deepEqual(ledger.firstFailure.actual, failed.actual);
  assert.deepEqual(ledger.firstFailure.integrity, { result: 'PASS' });
  for (const stage of ledger.stages) {
    for (const key of ['stdout', 'stderr', 'resultRecord']) {
      assert.deepEqual(fileRecord(stage[key].path), stage[key], `${stage.id} ${key} pin`);
    }
  }
}

export function verifySourceG2() {
  const planRelative = `${G2_EVIDENCE_RELATIVE}/campaign-plan.json`;
  const sealRelative = `${G2_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
  const ledgerRelative = `${G2_EVIDENCE_RELATIVE}/execution-ledger.json`;
  const plan = readJson(planRelative);
  const seal = readJson(sealRelative);
  const ledger = readJson(ledgerRelative);
  const planRecord = fileRecord(planRelative);
  const sealRecord = fileRecord(sealRelative);
  const ledgerRecord = fileRecord(ledgerRelative);

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBCampaignPlan');
  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBPreExecutionSeal');
  assert.equal(seal.result, 'SEALED_NOT_EXECUTED');
  assert.deepEqual(plan.generation, { id: 'phase3cr2-c3tb-g2', mode: 'FRESH_AFTER_FAILED_GENERATION', ordinal: 2, resumesPriorAttempt: false });
  assert.deepEqual(seal.generation, plan.generation);
  assert.deepEqual(seal.campaignPlan, planRecord);
  assert.deepEqual(ledger.preflight.campaignPlan, planRecord);
  assert.deepEqual(ledger.preflight.seal, sealRecord);

  const tools = closureSnapshot(G2_TOOL_RELATIVE, true);
  assert.equal(tools.fileCount, G2_TOOL_COUNT);
  assert.equal(tools.digest, G2_TOOL_DIGEST);
  assert.equal(plan.finalizedToolInputCount, G2_TOOL_COUNT);
  assert.equal(plan.finalizedToolSetDigest, G2_TOOL_DIGEST);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.equal(seal.finalizedToolInputCount, G2_TOOL_COUNT);
  assert.equal(seal.finalizedToolSetDigest, G2_TOOL_DIGEST);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.equal(ledger.preflight.finalizedToolSetDigest, G2_TOOL_DIGEST);

  const harnessValidation = fileRecord(G2_VALIDATION_RELATIVE, true);
  assert.deepEqual(plan.harnessValidation.evidence, harnessValidation);
  assert.deepEqual(seal.harnessValidation, plan.harnessValidation);
  assert.deepEqual(ledger.preflight.harnessValidation, plan.harnessValidation);
  assert.equal(plan.harnessValidation.result, 'PASS');
  assert.deepEqual(plan.harnessValidation.executionCounts, {
    certificationCampaign: 0,
    helper: 0,
    network: 0,
    product: 0,
    securityCampaign: 0,
  });

  verifyLedger(ledger);
  for (const relative of G2_ABSENT_TERMINAL_OUTPUTS) assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `G2 output must remain absent: ${relative}`);

  // The immutable G2 evidence closure was sealed with full file records,
  // including Git-blob identities for every raw witness.
  const evidence = closureSnapshot(G2_EVIDENCE_RELATIVE, true);
  assert.equal(evidence.fileCount, G2_EVIDENCE_COUNT);
  assert.equal(evidence.digest, G2_EVIDENCE_DIGEST);
  const bindingInput = buildBindingInput(plan, seal);
  const authoritativeBinding = deriveAuthoritativeBinding(bindingInput);
  assert.equal(ledger.candidate.commit, authoritativeBinding.candidate.commit);
  assert.equal(ledger.candidate.productionTree, authoritativeBinding.production.tree);
  assert.equal(ledger.candidate.helper.sha256, authoritativeBinding.helper.sha256);

  return {
    plan,
    seal,
    ledger,
    bindingInput,
    authoritativeBinding,
    sourceG2: {
      plan: planRecord,
      preExecutionSeal: sealRecord,
      harnessValidation,
      tools,
      evidence,
      ledger: compactLedger(ledger, ledgerRecord),
      absentTerminalOutputs: [...G2_ABSENT_TERMINAL_OUTPUTS],
    },
  };
}

export function verifyPriorG3(source = verifySourceG2()) {
  const validationRelative = G3_EVIDENCE_RELATIVE + '/zero-execution-validation.json';
  const planRelative = G3_EVIDENCE_RELATIVE + '/recovery-plan.json';
  const sealRelative = G3_EVIDENCE_RELATIVE + '/pre-execution-seal.json';
  const reconcileRelative = G3_TOOL_RELATIVE + '/reconcile.mjs';
  const validation = readJson(validationRelative);
  const plan = readJson(planRelative);
  const seal = readJson(sealRelative);
  const tools = closureSnapshot(G3_TOOL_RELATIVE, true);
  const evidence = closureSnapshot(G3_EVIDENCE_RELATIVE, true);

  assert.equal(tools.fileCount, G3_TOOL_COUNT);
  assert.equal(tools.digest, G3_TOOL_DIGEST);
  assert.equal(evidence.fileCount, G3_EVIDENCE_COUNT);
  assert.equal(evidence.digest, G3_EVIDENCE_DIGEST);
  assert.deepEqual(tools.files.map(record => path.basename(record.path)), [
    'binding-lib.mjs',
    'finalize.mjs',
    'preflight.mjs',
    'README.md',
    'reconcile.mjs',
    'recovery-static-lib.mjs',
    'validate-recovery.mjs',
  ]);
  assert.deepEqual(evidence.files.map(record => path.basename(record.path)), [
    'pre-execution-seal.json',
    'recovery-plan.json',
    'zero-execution-validation.json',
  ]);

  const validationRecord = fileRecord(validationRelative);
  const planRecord = fileRecord(planRelative);
  const sealRecord = fileRecord(sealRelative);
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG3ZeroExecutionValidation');
  assert.equal(validation.version, '1.0.0');
  assert.equal(validation.result, 'PASS');
  assert.deepEqual(validation.generation, PRIOR_G3_GENERATION);
  assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS']);
  assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS']);
  assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
  assert.deepEqual(validation.executionCounts, zeroExecutionCounts());
  assert.deepEqual(validation.sourceG2, source.sourceG2);
  assert.deepEqual(validation.authoritativeBinding, source.authoritativeBinding);

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG3RecoveryPlan');
  assert.equal(plan.version, '1.0.0');
  assert.equal(plan.status, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.deepEqual(plan.generation, PRIOR_G3_GENERATION);
  assert.deepEqual(plan.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(plan.sourceG2, validation.sourceG2);
  assert.deepEqual(plan.validation, validationRecord);
  assert.equal(plan.finalizedToolInputCount, G3_TOOL_COUNT);
  assert.equal(plan.finalizedToolSetDigest, G3_TOOL_DIGEST);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.deepEqual(plan.executionPolicy.executionsBeforeSeal, zeroExecutionCounts());
  assert.deepEqual(plan.outputs, G3_PLANNED_OUTPUTS);

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG3PreExecutionSeal');
  assert.equal(seal.version, '1.0.0');
  assert.equal(seal.result, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.deepEqual(seal.generation, PRIOR_G3_GENERATION);
  assert.deepEqual(seal.recoveryPlan, planRecord);
  assert.deepEqual(seal.validation, validationRecord);
  assert.deepEqual(seal.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(seal.sourceG2, validation.sourceG2);
  assert.equal(seal.finalizedToolInputCount, G3_TOOL_COUNT);
  assert.equal(seal.finalizedToolSetDigest, G3_TOOL_DIGEST);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assert.deepEqual(seal.executionCounts, zeroExecutionCounts());
  assert.equal(seal.appendOnly, true);

  const absentReconciliationOutputs = Object.values(G3_ABSENT_RECONCILIATION_OUTPUTS);
  for (const relative of absentReconciliationOutputs) {
    assert.equal(fs.existsSync(path.join(ROOT, relative)), false, 'G3 reconcile output must remain absent: ' + relative);
  }

  const reconcileSource = readRegularBytes(reconcileRelative).toString('utf8');
  const lines = reconcileSource.split(/\r?\n/u);
  const constructionSource = '  const helperCheckout = filePin(HELPER_PATH);';
  const assertionSource = '  assert.deepEqual(zeroExecutionValidation.authoritativeBinding, authoritativeBinding);';
  assert.equal(lines[430], constructionSource);
  assert.equal(lines[676], assertionSource);
  assert.equal(lines[233], 'function filePin(relativePath) {');
  assert.equal(lines[236], '  return { path: relativePath, byteLength: bytes.length, sha256: sha256(bytes) };');
  assert.equal(lines.slice(233, 238).some(line => line.includes('gitBlob')), false);
  assert.equal(lines[1560].includes("result: 'PHASE3CR2_RECONCILIATION_BLOCKER'"), true);
  assert.equal(lines[1560].includes('outputsWritten:'), true);

  const reconstructedInput = structuredClone(source.bindingInput);
  assert.equal(Object.hasOwn(reconstructedInput.git.helperCheckout, 'gitBlob'), true);
  delete reconstructedInput.git.helperCheckout.gitBlob;
  const reconstructedBinding = deriveAuthoritativeBinding(reconstructedInput);
  const sealedBinding = validation.authoritativeBinding;
  assert.notDeepEqual(reconstructedBinding, sealedBinding);
  const expectedCheckoutGitBlobAuthority = sealedBinding.helperAuthorities.gitBlobs.find(
    authority => authority.source === 'checkout.helper.gitBlob',
  );
  assert.ok(expectedCheckoutGitBlobAuthority);
  assert.equal(
    reconstructedBinding.helperAuthorities.gitBlobs.some(authority => authority.source === 'checkout.helper.gitBlob'),
    false,
  );
  assert.deepEqual(
    reconstructedBinding.helperAuthorities.gitBlobs,
    sealedBinding.helperAuthorities.gitBlobs.filter(authority => authority.source !== 'checkout.helper.gitBlob'),
  );
  const sealedBindingWithoutMissingAuthority = structuredClone(sealedBinding);
  sealedBindingWithoutMissingAuthority.helperAuthorities.gitBlobs = reconstructedBinding.helperAuthorities.gitBlobs;
  assert.deepEqual(reconstructedBinding, sealedBindingWithoutMissingAuthority);
  assert.deepEqual(reconstructedBinding.helper, sealedBinding.helper);

  const outputsWritten = {
    fresh: false,
    candidate: false,
    reviews: false,
    administrativeRecovery: false,
  };
  assert.deepEqual(
    outputsWritten,
    Object.fromEntries(Object.entries(G3_ABSENT_RECONCILIATION_OUTPUTS).map(([key, relative]) => [
      key,
      fs.existsSync(path.join(ROOT, relative)),
    ])),
  );

  return {
    generation: { ...PRIOR_G3_GENERATION },
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    classification: ['MISSING_PROPAGATION', 'OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'MISSING_PROPAGATION/OTHER_CONCRETE_RECONCILIATION_DEFECT',
    failure: {
      code: 'ERR_ASSERTION',
      path: reconcileRelative,
      line: 677,
      assertion: assertionSource.trim(),
    },
    cause: {
      missingField: 'git.helperCheckout.gitBlob',
      construction: { line: 431, source: constructionSource.trim() },
      filePin: { startLine: 234, returnLine: 237, includesGitBlob: false },
      sealedValidationAuthoritySource: 'authoritativeBinding.helperAuthorities.gitBlobs',
      sealedContainsCheckoutHelperGitBlob: true,
      reconstructedContainsCheckoutHelperGitBlob: false,
      exactAuthoritativeBindingDeepEqual: false,
      onlyDifference: 'authoritativeBinding.helperAuthorities.gitBlobs[checkout.helper.gitBlob]',
      expectedCheckoutGitBlobAuthority,
      reconstructedHelperIdentity: reconstructedBinding.helper,
    },
    outputsWritten,
    absentReconciliationOutputs,
    tools,
    evidence,
    artifacts: {
      zeroExecutionValidation: fileRecord(validationRelative, true),
      recoveryPlan: fileRecord(planRelative, true),
      preExecutionSeal: fileRecord(sealRelative, true),
      reconcile: fileRecord(reconcileRelative, true),
    },
    sourceIntegrity: {
      validationPlanSealExact: true,
      closureOrdering: "localeCompare('en')",
      closureRecordsIncludeGitBlob: true,
      mechanicallyReproduced: true,
    },
  };
}

export function writeJsonExclusive(relative, value) {
  fs.writeFileSync(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

