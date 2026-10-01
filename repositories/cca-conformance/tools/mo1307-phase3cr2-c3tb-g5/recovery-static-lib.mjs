// Read-only filesystem/Git verification shared by the G5 acceptance-only tools.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { deriveAuthoritativeBinding } from './binding-lib.mjs';
import {
  assertStaticRuntimeAndRepository as assertG4StaticRuntimeAndRepository,
  canonical,
  canonicalBytes,
  closureSnapshot,
  fileRecord,
  readJson,
  readRegularBytes,
  sha256,
  verifyPriorG3,
  verifySourceG2,
  zeroExecutionCounts,
} from '../mo1307-phase3cr2-c3tb-g4/recovery-static-lib.mjs';

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const BRANCH = 'codex/mo1307-phase3cr2-c3tb';
export const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
export const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
export const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
export const ACCEPTED_PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
export const ACCEPTED_PHASE3BR2_TREE = '7d07f5f570248f8159339ae33637194937cf4918';
export const PRODUCT_RELATIVE = 'repositories/memoryos-readiness';
export const HELPER_RELATIVE = `${PRODUCT_RELATIVE}/helpers/windows-inspect.ps1`;
export const CANDIDATE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
export const ORIGINAL_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
export const ORIGINAL_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
export const G2_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
export const G2_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
export const G2_VALIDATION_ROOT_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation';
export const G2_VALIDATION_RELATIVE = `${G2_VALIDATION_ROOT_RELATIVE}/validation.json`;
export const G3_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3';
export const G3_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g3';
export const G4_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4';
export const G4_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g4';
export const G5_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g5';
export const G5_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g5';

export const GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g5',
  ordinal: 5,
  mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G4_AFTER_FAILED_STAGED_VERIFICATION',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g4',
});

export const PRIOR_G4_GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g4',
  ordinal: 4,
  mode: 'RECONCILIATION_ONLY_FROM_IMMUTABLE_G2_AFTER_FAILED_G3',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g3',
});

export const G5_PLANNED_OUTPUTS = Object.freeze([
  `${G5_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  `${G5_EVIDENCE_RELATIVE}/recovery-plan.json`,
  `${G5_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  `${G5_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`,
  `${G5_EVIDENCE_RELATIVE}/certification-receipt.json`,
  `${G5_EVIDENCE_RELATIVE}/final-validation.json`,
  `${G5_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  `${G5_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  `${G5_EVIDENCE_RELATIVE}/final-seal.json`,
]);

export const G4_ACCEPTANCE_ROOTS = Object.freeze([
  ORIGINAL_TOOL_RELATIVE,
  ORIGINAL_EVIDENCE_RELATIVE,
  G2_VALIDATION_ROOT_RELATIVE,
  G2_TOOL_RELATIVE,
  G2_EVIDENCE_RELATIVE,
  G3_TOOL_RELATIVE,
  G3_EVIDENCE_RELATIVE,
  G4_TOOL_RELATIVE,
  G4_EVIDENCE_RELATIVE,
]);

const GIT = 'C:/Program Files/Git/cmd/git.exe';
const EXPECTED_GIT_VERSION = 'git version 2.55.0.windows.3';
const EXPECTED_NODE = Object.freeze({
  version: 'v24.21.0',
  platform: 'win32',
  arch: 'x64',
  byteLength: 93580104,
  sha256: 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32',
});
const EXPECTED_NODE_PATH = path.join(ROOT, '.cache/mo1307-phase3cr2-runtime/node.exe');
const G4_TOOL_COUNT = 7;
const G4_TOOL_DIGEST = 'sha256:5345190df10de4554df711051b41063cc2b479de3a00e16dd4013e757f1e51aa';
const G4_EVIDENCE_COUNT = 12;
const G4_EVIDENCE_DIGEST = 'sha256:285b34e2d82af75ae683d426e88f4f22d3e39d454f04d6946a65d4caea14deca';
const ORIGINAL_TOOL_DIGEST = 'sha256:9abb9d879a5b29724b42a8efa31f66579d104c336ef4ed2f2e304a77ff7c1e19';
const ORIGINAL_EVIDENCE_DIGEST = 'sha256:2ce1063de146fb4c1bb153175271ff19e0a6db5d9d759abe0e137e4b00b8224f';

const G4_PATHS = Object.freeze({
  validation: `${G4_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  plan: `${G4_EVIDENCE_RELATIVE}/recovery-plan.json`,
  seal: `${G4_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  fresh: `${G4_EVIDENCE_RELATIVE}/fresh-control-results.json`,
  candidate: `${G4_EVIDENCE_RELATIVE}/candidate-specific-controls.json`,
  reviews: `${G4_EVIDENCE_RELATIVE}/source-security-reviews.json`,
  administrativeRecovery: `${G4_EVIDENCE_RELATIVE}/administrative-recovery.json`,
  receipt: `${G4_EVIDENCE_RELATIVE}/certification-receipt.json`,
  finalValidation: `${G4_EVIDENCE_RELATIVE}/final-validation.json`,
  handoff: `${G4_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  manifest: `${G4_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  finalSeal: `${G4_EVIDENCE_RELATIVE}/final-seal.json`,
  finalizer: `${G4_TOOL_RELATIVE}/finalize.mjs`,
});

const G4_PLANNED_OUTPUTS = Object.freeze([
  G4_PATHS.validation,
  G4_PATHS.plan,
  G4_PATHS.seal,
  G4_PATHS.fresh,
  G4_PATHS.candidate,
  G4_PATHS.reviews,
  G4_PATHS.administrativeRecovery,
  G4_PATHS.receipt,
  G4_PATHS.finalValidation,
  G4_PATHS.handoff,
  G4_PATHS.manifest,
  G4_PATHS.finalSeal,
]);

const G4_TOOL_NAMES = Object.freeze([
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'README.md',
  'reconcile.mjs',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
]);

const G4_EVIDENCE_NAMES = Object.freeze([
  'administrative-recovery.json',
  'candidate-specific-controls.json',
  'certification-receipt.json',
  'evidence-manifest.json',
  'final-seal.json',
  'final-validation.json',
  'fresh-control-results.json',
  'phase3d-handoff.json',
  'pre-execution-seal.json',
  'recovery-plan.json',
  'source-security-reviews.json',
  'zero-execution-validation.json',
]);

const EXPECTED_G4_VIOLATIONS = Object.freeze([
  {
    path: `${G4_TOOL_RELATIVE}/binding-lib.mjs`,
    line: 271,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  },
  {
    path: `${G4_TOOL_RELATIVE}/recovery-static-lib.mjs`,
    line: 551,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  },
]);

export { canonical, canonicalBytes, closureSnapshot, fileRecord, readJson, readRegularBytes, sha256, verifyPriorG3, verifySourceG2, zeroExecutionCounts };

const slash = value => value.replaceAll('\\', '/');
const fileOrder = (left, right) => left.localeCompare(right, 'en');

export function runGit(args, options = {}) {
  const result = spawnSync(GIT, [
    '-c', 'core.longpaths=true',
    '-c', `safe.directory=${slash(path.resolve(ROOT))}`,
    ...args,
  ], {
    cwd: ROOT,
    encoding: options.encoding ?? null,
    windowsHide: true,
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    env: {
      SystemRoot: process.env.SystemRoot,
      COMSPEC: process.env.COMSPEC,
      PATH: 'C:/Program Files/Git/cmd;C:/Windows/System32',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: 'NUL',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  assert.equal(result.error, undefined, `Fixed Git launch failed: ${result.error?.message ?? ''}`);
  if (!options.allowFailure) {
    assert.equal(result.status, 0, `Fixed Git failed (${args.join(' ')}): ${(result.stderr ?? Buffer.alloc(0)).toString('utf8')}`);
  }
  return result;
}

export const gitText = args => runGit(args).stdout.toString('utf8').trim();

export function assertStaticRuntimeAndRepository() {
  const prior = assertG4StaticRuntimeAndRepository();
  const executableBytes = fs.readFileSync(process.execPath);
  assert.equal(process.version, EXPECTED_NODE.version);
  assert.equal(process.platform, EXPECTED_NODE.platform);
  assert.equal(process.arch, EXPECTED_NODE.arch);
  assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(EXPECTED_NODE_PATH).toLowerCase());
  assert.equal(executableBytes.length, EXPECTED_NODE.byteLength);
  assert.equal(sha256(executableBytes), EXPECTED_NODE.sha256);
  assert.equal(gitText(['--version']), EXPECTED_GIT_VERSION);
  assert.equal(gitText(['branch', '--show-current']), BRANCH);
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
  assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
  const c3tProductionTree = gitText(['rev-parse', `${C3T}:${PRODUCT_RELATIVE}`]);
  const c3tbProductionTree = gitText(['rev-parse', `${C3TB}:${PRODUCT_RELATIVE}`]);
  assert.match(c3tProductionTree, /^[0-9a-f]{40}$/u);
  assert.equal(c3tbProductionTree, c3tProductionTree, 'C3T and C3TB production subtrees differ.');
  assert.equal(gitText(['show', '-s', '--format=%T', ACCEPTED_PHASE3BR2]), ACCEPTED_PHASE3BR2_TREE);
  assert.equal(gitText(['diff', '--name-only']), '', 'Tracked worktree changes are forbidden.');
  return {
    ...prior,
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      executable: process.execPath,
      byteLength: executableBytes.length,
      sha256: sha256(executableBytes),
    },
    git: { executable: GIT, version: EXPECTED_GIT_VERSION },
    acceptedPhase3BR2: { commit: ACCEPTED_PHASE3BR2, tree: ACCEPTED_PHASE3BR2_TREE },
    productionTree: c3tProductionTree,
    productionTreeAuthorities: [
      { commit: C3T, path: PRODUCT_RELATIVE, tree: c3tProductionTree },
      { commit: C3TB, path: PRODUCT_RELATIVE, tree: c3tbProductionTree },
    ],
  };
}

function assertGeneration(record) {
  assert.deepEqual(record.generation, PRIOR_G4_GENERATION, `${record.kind}: exact G4 generation`);
}

function assertZero(record) {
  assert.deepEqual(record.executionCounts, zeroExecutionCounts(), `${record.kind}: zero executions`);
}

function assertPin(pin, includeGitBlob = false) {
  assert.deepEqual(pin, fileRecord(pin.path, includeGitBlob), `Artifact pin changed: ${pin.path}`);
}

function acceptanceRootClosure() {
  const closures = G4_ACCEPTANCE_ROOTS.map(relative => closureSnapshot(relative, true));
  const files = closures.flatMap(closure => closure.files).sort((left, right) => fileOrder(left.path, right.path));
  const paths = files.map(record => record.path);
  assert.equal(new Set(paths).size, paths.length, 'G4 acceptance root paths overlap.');
  assert.equal(paths.length, 1300, 'G4 acceptance path count changed.');
  assert.equal(closures[0].fileCount, 15);
  assert.equal(closures[0].digest, ORIGINAL_TOOL_DIGEST);
  assert.equal(closures[1].fileCount, 194);
  assert.equal(closures[1].digest, ORIGINAL_EVIDENCE_DIGEST);
  assert.equal(closures[2].fileCount, 1);
  assert.equal(closures[3].fileCount, 18);
  assert.equal(closures[4].fileCount, 1043);
  assert.equal(closures[5].fileCount, 7);
  assert.equal(closures[6].fileCount, 3);
  assert.equal(closures[7].fileCount, 7);
  assert.equal(closures[8].fileCount, 12);
  return { roots: [...G4_ACCEPTANCE_ROOTS], fileCount: paths.length, files, paths };
}

function scanG4WhitespaceViolations(tools) {
  const violations = [];
  for (const record of tools.files) {
    const bytes = readRegularBytes(record.path);
    const text = bytes.toString('utf8');
    assert.equal(Buffer.from(text).equals(bytes), true, `G4 tool is not canonical UTF-8: ${record.path}`);
    assert.equal(text.includes('\r'), false, `G4 tool contains a non-LF line ending: ${record.path}`);
    const lines = text.split('\n');
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (/[ \t]+$/u.test(lines[index])) {
        violations.push({ path: record.path, line: index + 1, message: 'trailing whitespace.' });
      }
      assert.equal(/^ +\t/u.test(lines[index]), false, `G4 tool has space-before-tab indentation: ${record.path}:${index + 1}`);
      assert.equal(/^(?:<{7}|={7}|>{7})(?: |$)/u.test(lines[index]), false, `G4 tool has a conflict marker: ${record.path}:${index + 1}`);
    }
    if (text.endsWith('\n\n')) {
      assert.equal(text.endsWith('\n\n\n'), false, `G4 tool has more than one new blank line at EOF: ${record.path}`);
      const newlineCount = [...text].filter(character => character === '\n').length;
      violations.push({
        path: record.path,
        line: newlineCount,
        message: 'new blank line at EOF.',
        tailHex: bytes.subarray(-8).toString('hex'),
      });
    }
  }
  violations.sort((left, right) => fileOrder(left.path, right.path) || left.line - right.line);
  assert.deepEqual(violations, EXPECTED_G4_VIOLATIONS, 'G4 staged whitespace defect changed.');
  return violations;
}

function assertG4FinalizerFailurePoint() {
  const lines = readRegularBytes(G4_PATHS.finalizer).toString('utf8').split(/\r?\n/u);
  assert.equal(lines[1343], "  const staged = runGit(['diff', '--cached', '--name-only', '-z', C3TB])");
  assert.equal(lines[1345], "  assert.deepEqual(staged, artifacts.expectedPaths, 'Exact staged Phase 3CR2 path union');");
  assert.equal(lines[1346], "  assert.equal(gitText(['diff', '--name-only']), '', 'Unstaged tracked changes are forbidden');");
  assert.equal(lines[1347], "  assert.equal(gitText(['diff', '--cached', '--name-only', '--', PRODUCT]), '', 'Product paths are forbidden');");
  assert.equal(lines[1348], '  const entries = statusEntries();');
  assert.equal(lines[1349], '  assert.equal(entries.length, artifacts.expectedPaths.length);');
  assert.equal(lines[1350], '  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), artifacts.expectedPaths);');
  assert.equal(lines[1351], "  assert.equal(entries.every(entry => entry.status === 'A '), true, 'Every acceptance path must have A-only status');");
  assert.equal(lines[1352], '  for (const relative of artifacts.expectedPaths) assertStagedBlob(relative);');
  const assertion = "runGit(['diff', '--cached', '--check']);";
  assert.equal(lines[1353].trim(), assertion);
  return assertion;
}

function assertNoG4AcceptanceCommit() {
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  const committed = gitText(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...G4_ACCEPTANCE_ROOTS]);
  assert.equal(committed, '', 'A G4 acceptance path unexpectedly exists in HEAD.');
}

function loadG4Artifacts() {
  return Object.fromEntries(Object.entries(G4_PATHS)
    .filter(([key]) => key !== 'finalizer')
    .map(([key, relative]) => [key, readJson(relative)]));
}

function assertG4Artifacts(artifacts, source, priorG3, tools, evidence) {
  const { validation, plan, seal, fresh, candidate, reviews, administrativeRecovery, receipt, finalValidation, handoff, manifest, finalSeal } = artifacts;
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG4ZeroExecutionValidation');
  assert.equal(validation.version, '1.0.0');
  assert.equal(validation.result, 'PASS');
  assertGeneration(validation);
  assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS']);
  assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS']);
  assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
  assert.deepEqual(validation.authoritativeBinding, source.authoritativeBinding);
  assert.deepEqual(validation.authoritativeBinding, deriveAuthoritativeBinding(source.bindingInput));
  assert.deepEqual(validation.sourceG2, source.sourceG2);
  assert.deepEqual(validation.priorG3Failure, priorG3);
  assertZero(validation);

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG4RecoveryPlan');
  assert.equal(plan.version, '1.0.0');
  assert.equal(plan.status, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assertGeneration(plan);
  assert.deepEqual(plan.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(plan.sourceG2, source.sourceG2);
  assert.deepEqual(plan.priorG3Failure, priorG3);
  assert.deepEqual(plan.validation, fileRecord(G4_PATHS.validation));
  assert.equal(plan.finalizedToolInputCount, G4_TOOL_COUNT);
  assert.equal(plan.finalizedToolSetDigest, G4_TOOL_DIGEST);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.deepEqual(plan.outputs, G4_PLANNED_OUTPUTS);

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG4PreExecutionSeal');
  assert.equal(seal.version, '1.0.0');
  assert.equal(seal.result, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assertGeneration(seal);
  assert.deepEqual(seal.recoveryPlan, fileRecord(G4_PATHS.plan));
  assert.deepEqual(seal.validation, fileRecord(G4_PATHS.validation));
  assert.deepEqual(seal.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(seal.sourceG2, source.sourceG2);
  assert.deepEqual(seal.priorG3Failure, priorG3);
  assert.equal(seal.finalizedToolInputCount, G4_TOOL_COUNT);
  assert.equal(seal.finalizedToolSetDigest, G4_TOOL_DIGEST);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assertZero(seal);
  assert.equal(seal.appendOnly, true);

  for (const record of [fresh, candidate, reviews]) {
    assertGeneration(record);
    assert.equal(record.version, '1.0.0');
    assert.equal(record.sourceExecutionGeneration, 'phase3cr2-c3tb-g2');
    assert.equal(record.reconciliationOnly, true);
    assertZero(record);
    assert.equal(record.evidenceOrigin.generation, PRIOR_G4_GENERATION.id);
    assert.equal(record.evidenceOrigin.sourceExecutionGeneration, 'phase3cr2-c3tb-g2');
    assert.equal(record.evidenceOrigin.executedInG4, 0);
    assert.equal(record.evidenceOrigin.administrativeReconciliationOnly, true);
  }
  assert.equal(fresh.kind, 'MO1307Phase3CR2C3TBFreshControlResults');
  assert.equal(fresh.result, 'PASS_FRESH_COMPLETE');
  assert.equal(fresh.count, 89);
  assert.equal(fresh.rows.length, 89);
  assert.equal(fresh.rows.every(row => row.result === 'PASS_FRESH'), true);
  assert.equal(fresh.evidenceOrigin.acceptedFromG2, 89);
  assert.equal(fresh.supportingCounts.dependencyReuse, 462);
  assert.equal(fresh.accounting.omittedHistoricalControls, 0);
  assert.equal(candidate.kind, 'MO1307Phase3CR2CandidateSpecificControls');
  assert.equal(candidate.result, 'PASS');
  assert.equal(candidate.count, 2);
  assert.equal(candidate.rows.length, 2);
  assert.equal(candidate.rows.every(row => row.result === 'PASS'), true);
  assert.equal(candidate.evidenceOrigin.acceptedFromG2, 2);
  assert.equal(reviews.kind, 'MO1307Phase3CR2SourceSecurityReviews');
  assert.equal(reviews.result, 'PASS');
  assert.equal(reviews.count, 12);
  assert.equal(reviews.rows.length, 12);
  assert.equal(reviews.rows.every(row => row.result === 'PASS'), true);
  assert.equal(reviews.evidenceOrigin.acceptedFromG2, 12);

  assert.equal(administrativeRecovery.kind, 'MO1307Phase3CR2C3TBG4AdministrativeRecovery');
  assert.equal(administrativeRecovery.version, '1.0.0');
  assert.equal(administrativeRecovery.result, 'PASS');
  assert.equal(administrativeRecovery.outcome, 'RECONCILIATION_COMPLETE');
  assertGeneration(administrativeRecovery);
  assert.deepEqual(administrativeRecovery.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(administrativeRecovery.sourceG2, source.sourceG2);
  assert.deepEqual(administrativeRecovery.priorG3Failure, priorG3);
  assertZero(administrativeRecovery);
  assert.equal(administrativeRecovery.campaignRerun, false);
  assert.equal(administrativeRecovery.stages1Through8Rerun, false);
  assert.equal(administrativeRecovery.stages2Through8Rerun, false);
  assert.deepEqual(administrativeRecovery.reconciliation, {
    result: 'PASS',
    freshSelectedHistoricalControls: 89,
    reusedHistoricalControls: 462,
    candidateSpecificControls: 2,
    sourceAndSecurityReviews: 12,
    omitted: 0,
    duplicates: 0,
    mismatches: 0,
    unresolved: 0,
  });
  assert.deepEqual(administrativeRecovery.outputs, {
    fresh: G4_PATHS.fresh,
    candidate: G4_PATHS.candidate,
    reviews: G4_PATHS.reviews,
    administrativeRecovery: G4_PATHS.administrativeRecovery,
  });

  for (const artifact of [receipt, finalValidation, handoff, manifest, finalSeal]) {
    assertGeneration(artifact);
    assert.deepEqual(artifact.authoritativeBinding, validation.authoritativeBinding);
    assert.deepEqual(artifact.priorG3Failure, priorG3);
    assertZero(artifact);
  }
  assert.equal(receipt.kind, 'MO1307Phase3CR2C3TBG4CertificationReceipt');
  assert.equal(receipt.result, 'PASS');
  assert.equal(receipt.phase3CR2, 'ACCEPTED');
  assert.equal(receipt.status, 'PHASE3CR2_ACCEPTED');
  assert.deepEqual(receipt.controls, {
    freshExecutedInG4: 0,
    freshAcceptedFromG2: 89,
    reusedExactAcceptedFromG2: 462,
    candidateSpecificAcceptedFromG2: 2,
    sourceSecurityReviewsAcceptedFromG2: 12,
    totalHistoricalInventory: 551,
    unresolved: 0,
    omissions: 0,
    duplicateIds: 0,
    overlaps: 0,
    mismatches: 0,
  });
  assert.equal(receipt.campaignRerun, false);
  assert.equal(receipt.stages1Through8Rerun, false);
  assert.equal(receipt.stages2Through8Rerun, false);
  assert.equal(receipt.phase3D.executed, false);
  assert.equal(receipt.phase3D.authorizationGranted, false);
  assert.deepEqual(receipt.administrativeRecovery.artifact, fileRecord(G4_PATHS.administrativeRecovery));

  assert.equal(finalValidation.kind, 'MO1307Phase3CR2C3TBG4FinalValidation');
  assert.equal(finalValidation.result, 'PASS_ACCEPTANCE_SUPPORTED');
  assert.equal(finalValidation.outcome, 'PHASE3CR2_ACCEPTED');
  assert.deepEqual(finalValidation.receipt, fileRecord(G4_PATHS.receipt));
  for (const field of ['unresolved', 'omissions', 'duplicateIds', 'overlaps', 'mismatches']) assert.equal(finalValidation.checks[field], 0);
  assert.deepEqual(finalValidation.checks.fresh, { expected: 89, actual: 89, result: 'PASS' });
  assert.deepEqual(finalValidation.checks.reuse, { expected: 462, actual: 462, result: 'PASS' });
  assert.deepEqual(finalValidation.checks.candidateSpecific, { expected: 2, actual: 2, result: 'PASS' });
  assert.deepEqual(finalValidation.checks.reviews, { expected: 12, actual: 12, result: 'PASS' });
  assert.equal(finalValidation.checks.phase3DExecuted, false);
  assert.equal(finalValidation.checks.productChanged, false);

  assert.equal(handoff.kind, 'MO1307Phase3CR2C3TBG4Phase3DHandoff');
  assert.equal(handoff.result, 'READY_NOT_EXECUTED');
  assert.equal(handoff.phase3CR2, 'ACCEPTED');
  assert.equal(handoff.phase3DExecuted, false);
  assert.equal(handoff.phase3DExecutionAuthorized, false);
  assert.deepEqual(handoff.receipt, fileRecord(G4_PATHS.receipt));
  assert.deepEqual(handoff.finalValidation, fileRecord(G4_PATHS.finalValidation));

  assert.equal(manifest.kind, 'MO1307Phase3CR2C3TBG4EvidenceManifest');
  assert.equal(manifest.result, 'PASS');
  assert.equal(manifest.phase3CR2, 'ACCEPTED');
  assert.equal(manifest.memberCount, 17);
  assert.equal(manifest.members.length, 17);
  assert.equal(manifest.phase3DExecuted, false);
  const expectedManifestMembers = [
    ...tools.files,
    ...evidence.files.filter(record => ![G4_PATHS.manifest, G4_PATHS.finalSeal].includes(record.path)),
  ].sort((left, right) => fileOrder(left.path, right.path));
  assert.deepEqual(manifest.members, expectedManifestMembers);

  assert.equal(finalSeal.kind, 'MO1307Phase3CR2C3TBG4FinalSeal');
  assert.equal(finalSeal.result, 'PASS');
  assert.equal(finalSeal.phase3CR2, 'ACCEPTED');
  assert.equal(finalSeal.phase3DExecuted, false);
  assert.equal(finalSeal.push, false);
  assert.equal(finalSeal.tag, false);
  for (const pin of [
    finalSeal.manifest,
    finalSeal.receipt,
    finalSeal.finalValidation,
    finalSeal.phase3DHandoff,
    finalSeal.zeroExecutionValidation,
    finalSeal.recoveryPlan,
    finalSeal.preExecutionSeal,
    finalSeal.administrativeRecovery,
  ]) assertPin(pin);
  assert.deepEqual(finalSeal.immutableG2.tools, source.sourceG2.tools);
  assert.deepEqual(finalSeal.immutableG2.evidence, source.sourceG2.evidence);
  assert.deepEqual(finalSeal.immutableG3.tools, priorG3.tools);
  assert.deepEqual(finalSeal.immutableG3.evidence, priorG3.evidence);
}

export function verifyPriorG4(source = verifySourceG2(), priorG3 = verifyPriorG3(source)) {
  const tools = closureSnapshot(G4_TOOL_RELATIVE, true);
  const evidence = closureSnapshot(G4_EVIDENCE_RELATIVE, true);
  assert.equal(tools.fileCount, G4_TOOL_COUNT);
  assert.equal(tools.digest, G4_TOOL_DIGEST);
  assert.equal(evidence.fileCount, G4_EVIDENCE_COUNT);
  assert.equal(evidence.digest, G4_EVIDENCE_DIGEST);
  assert.deepEqual(tools.files.map(record => path.basename(record.path)), G4_TOOL_NAMES);
  assert.deepEqual(evidence.files.map(record => path.basename(record.path)), G4_EVIDENCE_NAMES);
  const artifacts = loadG4Artifacts();
  assertG4Artifacts(artifacts, source, priorG3, tools, evidence);
  const violations = scanG4WhitespaceViolations(tools);
  const failureAssertion = assertG4FinalizerFailurePoint();
  const acceptance = acceptanceRootClosure();
  assertNoG4AcceptanceCommit();

  return {
    generation: { ...PRIOR_G4_GENERATION },
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    phase: 'STAGED_ACCEPTANCE_VERIFICATION',
    classification: ['OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'OTHER_CONCRETE_RECONCILIATION_DEFECT/GIT_DIFF_CHECK_EXACT_KNOWN_VIOLATIONS',
    failure: {
      code: 'GIT_DIFF_CHECK',
      exitCode: 2,
      path: G4_PATHS.finalizer,
      line: 1354,
      assertion: failureAssertion,
    },
    violations,
    passedBeforeFailure: {
      exactStagedPathUnion: true,
      pathCount: acceptance.fileCount,
      allPathsAOnly: true,
      allStagedBlobsByteExact: true,
      productPathsAbsent: true,
      unstagedTrackedChangesAbsent: true,
    },
    acceptanceCommitCreated: false,
    tools,
    evidence,
    sourceIntegrity: {
      mechanicallyReproduced: true,
      onlyKnownViolations: true,
    },
  };
}

export function verifyRecoveryChain() {
  const runtime = assertStaticRuntimeAndRepository();
  const source = verifySourceG2();
  const priorG3Failure = verifyPriorG3(source);
  const priorG4Failure = verifyPriorG4(source, priorG3Failure);
  assert.equal(source.authoritativeBinding.production.tree, runtime.productionTree);
  assert.equal(priorG4Failure.acceptanceCommitCreated, false);
  return {
    runtime,
    source,
    priorG3Failure,
    priorG4Failure,
    authoritativeBinding: source.authoritativeBinding,
    productionTree: runtime.productionTree,
  };
}

export function writeJsonExclusive(relative, value) {
  fs.writeFileSync(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
