// Read-only filesystem/Git verification shared by the G6 acceptance-only tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { deriveAuthoritativeBinding } from './binding-lib.mjs';
import {
  ACCEPTED_PHASE3BR2 as G5_ACCEPTED_PHASE3BR2,
  ACCEPTED_PHASE3BR2_TREE as G5_ACCEPTED_PHASE3BR2_TREE,
  BRANCH as G5_BRANCH,
  C3T as G5_C3T,
  C3TB as G5_C3TB,
  C3TB_TREE as G5_C3TB_TREE,
  CANDIDATE_RELATIVE as G5_CANDIDATE_RELATIVE,
  G2_EVIDENCE_RELATIVE as G5_G2_EVIDENCE_RELATIVE,
  G2_TOOL_RELATIVE as G5_G2_TOOL_RELATIVE,
  G2_VALIDATION_RELATIVE as G5_G2_VALIDATION_RELATIVE,
  G2_VALIDATION_ROOT_RELATIVE as G5_G2_VALIDATION_ROOT_RELATIVE,
  G3_EVIDENCE_RELATIVE as G5_G3_EVIDENCE_RELATIVE,
  G3_TOOL_RELATIVE as G5_G3_TOOL_RELATIVE,
  G4_ACCEPTANCE_ROOTS,
  G4_EVIDENCE_RELATIVE as G5_G4_EVIDENCE_RELATIVE,
  G4_TOOL_RELATIVE as G5_G4_TOOL_RELATIVE,
  G5_EVIDENCE_RELATIVE as PRIOR_G5_EVIDENCE_RELATIVE,
  G5_PLANNED_OUTPUTS as PRIOR_G5_PLANNED_OUTPUTS,
  G5_TOOL_RELATIVE as PRIOR_G5_TOOL_RELATIVE,
  HELPER_RELATIVE as G5_HELPER_RELATIVE,
  ORIGINAL_EVIDENCE_RELATIVE as G5_ORIGINAL_EVIDENCE_RELATIVE,
  ORIGINAL_TOOL_RELATIVE as G5_ORIGINAL_TOOL_RELATIVE,
  PRODUCT_RELATIVE as G5_PRODUCT_RELATIVE,
  ROOT as G5_ROOT,
  assertStaticRuntimeAndRepository as assertG5StaticRuntimeAndRepository,
  canonical,
  canonicalBytes,
  closureSnapshot,
  fileRecord,
  gitText,
  readJson,
  readRegularBytes,
  runGit,
  sha256,
  verifyPriorG3,
  verifyPriorG4,
  verifySourceG2,
  zeroExecutionCounts,
} from '../mo1307-phase3cr2-c3tb-g5/recovery-static-lib.mjs';

export const ROOT = G5_ROOT;
export const BRANCH = G5_BRANCH;
export const C3TB = G5_C3TB;
export const C3T = G5_C3T;
export const C3TB_TREE = G5_C3TB_TREE;
export const ACCEPTED_PHASE3BR2 = G5_ACCEPTED_PHASE3BR2;
export const ACCEPTED_PHASE3BR2_TREE = G5_ACCEPTED_PHASE3BR2_TREE;
export const PRODUCT_RELATIVE = G5_PRODUCT_RELATIVE;
export const HELPER_RELATIVE = G5_HELPER_RELATIVE;
export const CANDIDATE_RELATIVE = G5_CANDIDATE_RELATIVE;
export const ORIGINAL_TOOL_RELATIVE = G5_ORIGINAL_TOOL_RELATIVE;
export const ORIGINAL_EVIDENCE_RELATIVE = G5_ORIGINAL_EVIDENCE_RELATIVE;
export const G2_TOOL_RELATIVE = G5_G2_TOOL_RELATIVE;
export const G2_EVIDENCE_RELATIVE = G5_G2_EVIDENCE_RELATIVE;
export const G2_VALIDATION_ROOT_RELATIVE = G5_G2_VALIDATION_ROOT_RELATIVE;
export const G2_VALIDATION_RELATIVE = G5_G2_VALIDATION_RELATIVE;
export const G3_TOOL_RELATIVE = G5_G3_TOOL_RELATIVE;
export const G3_EVIDENCE_RELATIVE = G5_G3_EVIDENCE_RELATIVE;
export const G4_TOOL_RELATIVE = G5_G4_TOOL_RELATIVE;
export const G4_EVIDENCE_RELATIVE = G5_G4_EVIDENCE_RELATIVE;
export const G5_TOOL_RELATIVE = PRIOR_G5_TOOL_RELATIVE;
export const G5_EVIDENCE_RELATIVE = PRIOR_G5_EVIDENCE_RELATIVE;
export const G6_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g6';
export const G6_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g6';

export const GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g6',
  ordinal: 6,
  mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G4_AFTER_FAILED_G5_VERIFICATION',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g5',
});

export const PRIOR_G5_GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g5',
  ordinal: 5,
  mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G4_AFTER_FAILED_STAGED_VERIFICATION',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g4',
});

export const G6_PLANNED_OUTPUTS = Object.freeze([
  `${G6_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  `${G6_EVIDENCE_RELATIVE}/recovery-plan.json`,
  `${G6_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  `${G6_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`,
  `${G6_EVIDENCE_RELATIVE}/certification-receipt.json`,
  `${G6_EVIDENCE_RELATIVE}/final-validation.json`,
  `${G6_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  `${G6_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  `${G6_EVIDENCE_RELATIVE}/final-seal.json`,
]);

export const G5_ACCEPTANCE_ROOTS = Object.freeze([
  ...G4_ACCEPTANCE_ROOTS,
  G5_TOOL_RELATIVE,
  G5_EVIDENCE_RELATIVE,
]);

const G5_TOOL_COUNT = 7;
const G5_TOOL_DIGEST = 'sha256:7e4a3f42f68bc3bf902d56adf3a9f0e496cc042f99cdfe39ded93a9e83d342b2';
const G5_EVIDENCE_COUNT = 3;
const G5_EVIDENCE_DIGEST = 'sha256:0ed78607211afaba3029896b28d2c424b247ef8437e89195e4013fcc69779b3b';

const G5_TOOL_NAMES = Object.freeze([
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'README.md',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
]);

const G5_EVIDENCE_NAMES = Object.freeze([
  'pre-execution-seal.json',
  'recovery-plan.json',
  'zero-execution-validation.json',
]);

const G5_PATHS = Object.freeze({
  validation: `${G5_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  plan: `${G5_EVIDENCE_RELATIVE}/recovery-plan.json`,
  seal: `${G5_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  administrativeAcceptanceRecovery: `${G5_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`,
  certificationReceipt: `${G5_EVIDENCE_RELATIVE}/certification-receipt.json`,
  finalValidation: `${G5_EVIDENCE_RELATIVE}/final-validation.json`,
  phase3DHandoff: `${G5_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  evidenceManifest: `${G5_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  finalSeal: `${G5_EVIDENCE_RELATIVE}/final-seal.json`,
  accept: `${G5_TOOL_RELATIVE}/accept.mjs`,
});

export {
  canonical,
  canonicalBytes,
  closureSnapshot,
  fileRecord,
  gitText,
  readJson,
  readRegularBytes,
  runGit,
  sha256,
  verifyPriorG3,
  verifyPriorG4,
  verifySourceG2,
  zeroExecutionCounts,
};

const slash = value => value.replaceAll('\\', '/');

export function assertStaticRuntimeAndRepository() {
  const prior = assertG5StaticRuntimeAndRepository();
  const gitRootRaw = gitText(['rev-parse', '--show-toplevel']);
  const nodeRootRaw = path.resolve(ROOT);
  assert.equal(slash(gitRootRaw).toLowerCase(), slash(nodeRootRaw).toLowerCase());
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'No acceptance commit may exist before G6 completion.');
  assert.equal(gitText(['ls-tree', '-r', '--name-only', 'HEAD', '--', G5_TOOL_RELATIVE, G5_EVIDENCE_RELATIVE]), '');
  return prior;
}

function assertGeneration(record) {
  assert.deepEqual(record.generation, PRIOR_G5_GENERATION, `${record.kind}: exact G5 generation`);
}

function assertPin(pin) {
  assert.deepEqual(pin, fileRecord(pin.path), `Artifact pin changed: ${pin.path}`);
}

function loadG5Artifacts() {
  return {
    validation: readJson(G5_PATHS.validation),
    plan: readJson(G5_PATHS.plan),
    seal: readJson(G5_PATHS.seal),
  };
}

function assertG5Artifacts(artifacts, source, priorG3, priorG4, tools) {
  const { validation, plan, seal } = artifacts;

  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG5ZeroExecutionValidation');
  assert.equal(validation.version, '1.0.0');
  assert.equal(validation.result, 'PASS');
  assertGeneration(validation);
  assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL']);
  assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL']);
  assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
  assert.deepEqual(validation.authoritativeBinding, source.authoritativeBinding);
  assert.deepEqual(validation.authoritativeBinding, deriveAuthoritativeBinding(source.bindingInput));
  assert.equal(validation.productionTree, source.authoritativeBinding.production.tree);
  assert.deepEqual(validation.sourceG2, source.sourceG2);
  assert.deepEqual(validation.priorG3Failure, priorG3);
  assert.deepEqual(validation.priorG4Failure, priorG4);
  assert.deepEqual(validation.executionCounts, zeroExecutionCounts());

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG5RecoveryPlan');
  assert.equal(plan.version, '1.0.0');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(plan);
  assert.deepEqual(plan.authoritativeBinding, validation.authoritativeBinding);
  assert.equal(plan.productionTree, validation.productionTree);
  assert.deepEqual(plan.sourceG2, source.sourceG2);
  assert.deepEqual(plan.priorG3Failure, priorG3);
  assert.deepEqual(plan.priorG4Failure, priorG4);
  assert.deepEqual(plan.validation, fileRecord(G5_PATHS.validation));
  assert.equal(plan.finalizedToolInputCount, G5_TOOL_COUNT);
  assert.equal(plan.finalizedToolSetDigest, G5_TOOL_DIGEST);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.deepEqual(plan.outputs, PRIOR_G5_PLANNED_OUTPUTS);

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG5PreExecutionSeal');
  assert.equal(seal.version, '1.0.0');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(seal);
  assert.deepEqual(seal.recoveryPlan, fileRecord(G5_PATHS.plan));
  assert.deepEqual(seal.validation, fileRecord(G5_PATHS.validation));
  assert.deepEqual(seal.authoritativeBinding, validation.authoritativeBinding);
  assert.equal(seal.productionTree, validation.productionTree);
  assert.deepEqual(seal.sourceG2, source.sourceG2);
  assert.deepEqual(seal.priorG3Failure, priorG3);
  assert.deepEqual(seal.priorG4Failure, priorG4);
  assert.equal(seal.finalizedToolInputCount, G5_TOOL_COUNT);
  assert.equal(seal.finalizedToolSetDigest, G5_TOOL_DIGEST);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assert.deepEqual(seal.executionCounts, zeroExecutionCounts());
  assert.equal(seal.appendOnly, true);

  for (const pin of [plan.validation, seal.recoveryPlan, seal.validation]) assertPin(pin);
}

function reproduceG5PathFailure() {
  const lines = readRegularBytes(G5_PATHS.accept).toString('utf8').split('\n');
  const assertion = "assert.equal(gitText(['rev-parse', '--show-toplevel']).toLowerCase(), path.resolve(ROOT).toLowerCase());";
  assert.equal(lines[311].trim(), assertion);

  const gitRootRaw = gitText(['rev-parse', '--show-toplevel']);
  const nodeRootRaw = path.resolve(ROOT);
  const gitCompared = gitRootRaw.toLowerCase();
  const nodeCompared = nodeRootRaw.toLowerCase();
  let reproducedFailure = null;
  try {
    assert.equal(gitCompared, nodeCompared);
  } catch (error) {
    reproducedFailure = {
      name: error?.name ?? null,
      code: error?.code ?? null,
    };
  }
  assert.deepEqual(reproducedFailure, { name: 'AssertionError', code: 'ERR_ASSERTION' });
  assert.notEqual(gitCompared, nodeCompared);
  const correctedCanonicalRoot = slash(gitCompared);
  assert.equal(correctedCanonicalRoot, slash(nodeCompared));

  return {
    assertion,
    gitRootRaw,
    nodeRootRaw,
    gitCompared,
    nodeCompared,
    correctedCanonicalRoot,
  };
}

export function verifyPriorG5(
  source = verifySourceG2(),
  priorG3 = verifyPriorG3(source),
  priorG4 = verifyPriorG4(source, priorG3),
) {
  const tools = closureSnapshot(G5_TOOL_RELATIVE, true);
  const evidence = closureSnapshot(G5_EVIDENCE_RELATIVE, true);
  assert.equal(tools.fileCount, G5_TOOL_COUNT);
  assert.equal(tools.digest, G5_TOOL_DIGEST);
  assert.equal(evidence.fileCount, G5_EVIDENCE_COUNT);
  assert.equal(evidence.digest, G5_EVIDENCE_DIGEST);
  assert.deepEqual(tools.files.map(record => path.basename(record.path)), G5_TOOL_NAMES);
  assert.deepEqual(evidence.files.map(record => path.basename(record.path)), G5_EVIDENCE_NAMES);

  const artifacts = loadG5Artifacts();
  assertG5Artifacts(artifacts, source, priorG3, priorG4, tools);
  const reproduced = reproduceG5PathFailure();
  const absentOutputs = Object.entries(G5_PATHS)
    .filter(([key]) => !['validation', 'plan', 'seal', 'accept'].includes(key));
  assert.deepEqual(absentOutputs.map(([, relative]) => relative), PRIOR_G5_PLANNED_OUTPUTS.slice(3));
  for (const [, relative] of absentOutputs) {
    assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `Failed G5 output must remain absent: ${relative}`);
  }
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  assert.equal(gitText(['ls-tree', '-r', '--name-only', 'HEAD', '--', G5_TOOL_RELATIVE, G5_EVIDENCE_RELATIVE]), '');

  return {
    generation: { ...PRIOR_G5_GENERATION },
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    phase: 'ACCEPTANCE_SOURCE_VERIFICATION',
    classification: ['OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'OTHER_CONCRETE_RECONCILIATION_DEFECT/PATH_SEPARATOR_NORMALIZATION_MISMATCH',
    failure: {
      code: 'ERR_ASSERTION',
      path: G5_PATHS.accept,
      line: 312,
      assertion: reproduced.assertion,
    },
    cause: {
      gitRootRaw: reproduced.gitRootRaw,
      nodeRootRaw: reproduced.nodeRootRaw,
      gitCompared: reproduced.gitCompared,
      nodeCompared: reproduced.nodeCompared,
      exactEqual: false,
      correctedCanonicalRoot: reproduced.correctedCanonicalRoot,
      correction: 'NORMALIZE_BOTH_GIT_AND_NODE_ROOT_PATHS_TO_FORWARD_SLASHES_BEFORE_EQUALITY',
    },
    outputsWritten: {
      administrativeAcceptanceRecovery: false,
      certificationReceipt: false,
      finalValidation: false,
      phase3DHandoff: false,
      evidenceManifest: false,
      finalSeal: false,
    },
    acceptanceCommitCreated: false,
    tools,
    evidence,
    sourceIntegrity: {
      mechanicallyReproduced: true,
      validationPlanSealExact: true,
      onlyDefect: 'PATH_SEPARATOR_NORMALIZATION_MISMATCH',
    },
  };
}

export function verifyRecoveryChain() {
  const runtime = assertStaticRuntimeAndRepository();
  const source = verifySourceG2();
  const priorG3Failure = verifyPriorG3(source);
  const priorG4Failure = verifyPriorG4(source, priorG3Failure);
  const priorG5Failure = verifyPriorG5(source, priorG3Failure, priorG4Failure);
  assert.equal(source.authoritativeBinding.production.tree, runtime.productionTree);
  assert.equal(source.sourceG2.tools.fileCount, 18);
  assert.equal(source.sourceG2.evidence.fileCount, 1043);
  assert.equal(priorG3Failure.tools.fileCount, 7);
  assert.equal(priorG3Failure.evidence.fileCount, 3);
  assert.equal(priorG4Failure.tools.fileCount, 7);
  assert.equal(priorG4Failure.evidence.fileCount, 12);
  assert.equal(priorG4Failure.violations.length, 2);
  assert.equal(priorG4Failure.acceptanceCommitCreated, false);
  assert.equal(priorG5Failure.tools.fileCount, 7);
  assert.equal(priorG5Failure.evidence.fileCount, 3);
  assert.equal(priorG5Failure.acceptanceCommitCreated, false);
  return {
    runtime,
    source,
    priorG3Failure,
    priorG4Failure,
    priorG5Failure,
    authoritativeBinding: source.authoritativeBinding,
    productionTree: runtime.productionTree,
  };
}

export function writeJsonExclusive(relative, value) {
  fs.writeFileSync(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
