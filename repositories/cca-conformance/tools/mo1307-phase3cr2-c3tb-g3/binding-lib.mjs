// Pure, fail-closed binding reconciliation for MO-1307 Phase 3CR2 C3TB G3.
// This module deliberately performs no filesystem access and launches no process.

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const EXPECTED_BINDING_KIND = 'MO1307ProspectiveHelperBoundCandidateBinding';
const EXPECTED_VERIFICATION_KIND = 'MO1307ProspectiveHelperBoundBindingVerification';

export const BINDING_ERROR_CODES = Object.freeze({
  MISSING_PRODUCTION_TREE: 'MISSING_PRODUCTION_TREE',
  PRODUCTION_TREE_MISMATCH: 'PRODUCTION_TREE_MISMATCH',
  CANDIDATE_MISMATCH: 'CANDIDATE_MISMATCH',
  PRODUCTION_COMMIT_MISMATCH: 'PRODUCTION_COMMIT_MISMATCH',
  HELPER_IDENTITY_MISMATCH: 'HELPER_IDENTITY_MISMATCH',
  BINDING_KIND_MISMATCH: 'BINDING_KIND_MISMATCH',
  OFFICIAL_BINDING_CHECK_MISMATCH: 'OFFICIAL_BINDING_CHECK_MISMATCH',
});

export class BindingValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'BindingValidationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new BindingValidationError(code, message, details);
}

function entriesObject(entries) {
  return Object.fromEntries(entries.map(({ source, value }) => [source, value]));
}

function requireValues(entries, code, description, predicate = value => value !== null && value !== undefined && value !== '') {
  const missing = entries.filter(({ value }) => !predicate(value)).map(({ source }) => source);
  if (missing.length > 0) fail(code, `Missing ${description}: ${missing.join(', ')}`, { missing, values: entriesObject(entries) });
  return entries;
}

function requireEqual(entries, code, description) {
  requireValues(entries, code, description);
  const [first, ...rest] = entries;
  const mismatches = rest.filter(({ value }) => value !== first.value);
  if (mismatches.length > 0) {
    fail(code, `${description} values differ.`, {
      authority: first,
      mismatches,
      values: entriesObject(entries),
    });
  }
  return first.value;
}

function requireLiteral(value, expected, code, description) {
  if (value !== expected) fail(code, `${description} must be ${JSON.stringify(expected)}.`, { actual: value, expected });
}

function requirePattern(value, pattern, code, description) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code, `Invalid ${description}.`, { actual: value });
}

function normalizeSlashes(value) {
  return typeof value === 'string' ? value.replaceAll('\\', '/') : value;
}

function normalizeCandidateHelperPath(candidatePath, authoritativeRepositoryPath) {
  const candidate = normalizeSlashes(candidatePath);
  const repository = normalizeSlashes(authoritativeRepositoryPath);
  if (typeof candidate !== 'string' || typeof repository !== 'string') return candidate;
  if (candidate.startsWith('/') || /^[A-Za-z]:\//u.test(candidate) || candidate.split('/').includes('..')) return candidate;
  if (candidate === repository) return candidate;
  const marker = '/helpers/';
  const markerIndex = repository.indexOf(marker);
  if (markerIndex === -1) return candidate;
  const productRoot = repository.slice(0, markerIndex);
  return candidate.startsWith('helpers/') ? `${productRoot}/${candidate}` : candidate;
}

function helperEntries(input) {
  const records = [
    ['plan.candidate.helper', input.planCandidate?.helper],
    ['seal.candidate.helper', input.sealCandidate?.helper],
    ['candidate.helper', input.candidateRecord?.helper],
    ['binding.helper', input.binding?.helper],
    ['git.C3TB.helper', input.git?.helperAtC3TB],
    ['git.C3T.helper', input.git?.helperAtC3T],
    ['checkout.helper', input.git?.helperCheckout],
  ];
  const repositoryPath = input.git?.helperAtC3TB?.path;
  return {
    paths: records.map(([source, record]) => ({
      source: `${source}.path`,
      value: source === 'candidate.helper'
        ? normalizeCandidateHelperPath(record?.path, repositoryPath)
        : normalizeSlashes(record?.path),
    })),
    byteLengths: records.map(([source, record]) => ({ source: `${source}.byteLength`, value: record?.byteLength })),
    sha256: records.map(([source, record]) => ({ source: `${source}.sha256`, value: record?.sha256 })),
    gitBlobs: records
      .filter(([, record]) => record && Object.hasOwn(record, 'gitBlob'))
      .map(([source, record]) => ({ source: `${source}.gitBlob`, value: record.gitBlob })),
  };
}

function assertOfficialCheck(check, source) {
  requireLiteral(check?.result, 'PASS', BINDING_ERROR_CODES.OFFICIAL_BINDING_CHECK_MISMATCH, `${source}.result`);
  requireLiteral(check?.checkout, 'TEMPORARY_ALTERNATE_INDEX_EXACT_HEAD', BINDING_ERROR_CODES.OFFICIAL_BINDING_CHECK_MISMATCH, `${source}.checkout`);
  requireLiteral(check?.productOrCertificationExecuted, false, BINDING_ERROR_CODES.OFFICIAL_BINDING_CHECK_MISMATCH, `${source}.productOrCertificationExecuted`);
  requireLiteral(check?.stdout?.parsed?.result, 'PASS', BINDING_ERROR_CODES.OFFICIAL_BINDING_CHECK_MISMATCH, `${source}.stdout.parsed.result`);
  requireLiteral(check?.stdout?.parsed?.mode, 'check', BINDING_ERROR_CODES.OFFICIAL_BINDING_CHECK_MISMATCH, `${source}.stdout.parsed.mode`);
  requireLiteral(check?.stdout?.parsed?.productionChangesInBindingCommit, false, BINDING_ERROR_CODES.OFFICIAL_BINDING_CHECK_MISMATCH, `${source}.stdout.parsed.productionChangesInBindingCommit`);
  requireLiteral(check?.stdout?.parsed?.certificationExecuted, false, BINDING_ERROR_CODES.OFFICIAL_BINDING_CHECK_MISMATCH, `${source}.stdout.parsed.certificationExecuted`);
}

export function deriveAuthoritativeBinding(input) {
  if (!input || typeof input !== 'object') fail(BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'Binding input must be an object.');

  requireLiteral(input.binding?.kind, EXPECTED_BINDING_KIND, BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'binding.kind');
  requireLiteral(input.binding?.bindingRole, 'C3TB', BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'binding.bindingRole');
  requireLiteral(input.binding?.result, 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3', BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'binding.result');
  requireLiteral(input.bindingVerification?.kind, EXPECTED_VERIFICATION_KIND, BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'bindingVerification.kind');
  requireLiteral(input.bindingVerification?.result, 'PASS', BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'bindingVerification.result');
  requireLiteral(input.binding?.binding?.commit, null, BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'binding.binding.commit self-reference placeholder');
  requireLiteral(input.bindingVerification?.bindingCommit, null, BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'bindingVerification.bindingCommit self-reference placeholder');
  requireLiteral(input.binding?.binding?.productionChanges, false, BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'binding.binding.productionChanges');
  requireLiteral(input.bindingVerification?.productionChangesInBindingCommit, false, BINDING_ERROR_CODES.BINDING_KIND_MISMATCH, 'bindingVerification.productionChangesInBindingCommit');
  assertOfficialCheck(input.officialChecks?.plan, 'plan.officialBindingCheck');
  assertOfficialCheck(input.officialChecks?.seal, 'seal.officialBindingCheck');

  // candidate.json is a pre-binding object. Its null commit/tree fields are retained as
  // historical placeholders and are never eligible production-tree authorities.
  requireLiteral(input.candidateRecord?.kind, 'MO1307ProspectiveHelperBoundCandidate', BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'candidate.kind');
  requireLiteral(input.candidateRecord?.result, 'READY_FOR_BINDING', BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'candidate.result');
  requireLiteral(input.candidateRecord?.candidateCommit, null, BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'candidate.candidateCommit pre-binding placeholder');
  requireLiteral(input.candidateRecord?.candidateRole, 'C3T', BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'candidate.candidateRole');
  requireLiteral(input.candidateRecord?.productionTree, null, BINDING_ERROR_CODES.PRODUCTION_TREE_MISMATCH, 'candidate.productionTree pre-binding placeholder');
  const candidatePackageProductionTreePlaceholder = input.candidateRecord?.package?.productionTree ?? null;
  requireLiteral(candidatePackageProductionTreePlaceholder, null, BINDING_ERROR_CODES.PRODUCTION_TREE_MISMATCH, 'candidate.package.productionTree absent/null pre-binding placeholder');

  const candidateSources = [
    { source: 'plan.candidate.commit', value: input.planCandidate?.commit },
    { source: 'seal.candidate.commit', value: input.sealCandidate?.commit },
    { source: 'git.head', value: input.git?.head },
    { source: 'git.C3TB.commit', value: input.git?.c3tb?.commit },
  ];
  const candidateCommit = requireEqual(candidateSources, BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'C3TB candidate commit');
  requirePattern(candidateCommit, GIT_OBJECT_PATTERN, BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'C3TB candidate commit');

  const candidateTreeSources = [
    { source: 'plan.candidate.tree', value: input.planCandidate?.tree },
    { source: 'seal.candidate.tree', value: input.sealCandidate?.tree },
    { source: 'git.C3TB.tree', value: input.git?.c3tb?.tree },
  ];
  const candidateTree = requireEqual(candidateTreeSources, BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'C3TB candidate root tree');
  requirePattern(candidateTree, GIT_OBJECT_PATTERN, BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'C3TB candidate root tree');

  const branchSources = [
    { source: 'plan.candidate.branch', value: input.planCandidate?.branch },
    { source: 'seal.candidate.branch', value: input.sealCandidate?.branch },
    { source: 'git.branch', value: input.git?.branch },
  ];
  const branch = requireEqual(branchSources, BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'candidate branch');
  requireLiteral(input.planCandidate?.role, 'C3TB', BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'plan.candidate.role');
  requireLiteral(input.sealCandidate?.role, 'C3TB', BINDING_ERROR_CODES.CANDIDATE_MISMATCH, 'seal.candidate.role');

  const productionCommitSources = [
    { source: 'plan.candidate.soleParent', value: input.planCandidate?.soleParent },
    { source: 'seal.candidate.soleParent', value: input.sealCandidate?.soleParent },
    { source: 'plan.candidate.implementation.commit', value: input.planCandidate?.implementation?.commit },
    { source: 'seal.candidate.implementation.commit', value: input.sealCandidate?.implementation?.commit },
    { source: 'binding.binding.soleParent', value: input.binding?.binding?.soleParent },
    { source: 'binding.implementation.commit', value: input.binding?.implementation?.commit },
    { source: 'bindingVerification.candidateCommit', value: input.bindingVerification?.candidateCommit },
    { source: 'plan.officialBindingCheck.candidateCommit', value: input.officialChecks?.plan?.stdout?.parsed?.candidateCommit },
    { source: 'seal.officialBindingCheck.candidateCommit', value: input.officialChecks?.seal?.stdout?.parsed?.candidateCommit },
    { source: 'git.C3TB.parent', value: input.git?.c3tb?.parent },
    { source: 'git.C3T.commit', value: input.git?.c3t?.commit },
  ];
  const productionCommit = requireEqual(productionCommitSources, BINDING_ERROR_CODES.PRODUCTION_COMMIT_MISMATCH, 'C3T production commit');
  requirePattern(productionCommit, GIT_OBJECT_PATTERN, BINDING_ERROR_CODES.PRODUCTION_COMMIT_MISMATCH, 'C3T production commit');

  const productionRootTreeSources = [
    { source: 'plan.candidate.implementation.tree', value: input.planCandidate?.implementation?.tree },
    { source: 'seal.candidate.implementation.tree', value: input.sealCandidate?.implementation?.tree },
    { source: 'binding.implementation.rootTree', value: input.binding?.implementation?.rootTree },
    { source: 'bindingVerification.candidateRootTree', value: input.bindingVerification?.candidateRootTree },
    { source: 'plan.officialBindingCheck.candidateRootTree', value: input.officialChecks?.plan?.stdout?.parsed?.candidateRootTree },
    { source: 'seal.officialBindingCheck.candidateRootTree', value: input.officialChecks?.seal?.stdout?.parsed?.candidateRootTree },
    { source: 'git.C3T.tree', value: input.git?.c3t?.tree },
  ];
  const productionRootTree = requireEqual(productionRootTreeSources, BINDING_ERROR_CODES.PRODUCTION_COMMIT_MISMATCH, 'C3T root tree');
  requirePattern(productionRootTree, GIT_OBJECT_PATTERN, BINDING_ERROR_CODES.PRODUCTION_COMMIT_MISMATCH, 'C3T root tree');

  const productionParentSources = [
    { source: 'plan.candidate.implementation.parent', value: input.planCandidate?.implementation?.parent },
    { source: 'seal.candidate.implementation.parent', value: input.sealCandidate?.implementation?.parent },
    { source: 'binding.implementation.parent', value: input.binding?.implementation?.parent },
    { source: 'bindingVerification.candidateParent', value: input.bindingVerification?.candidateParent },
    { source: 'git.C3T.parent', value: input.git?.c3t?.parent },
  ];
  const productionParent = requireEqual(productionParentSources, BINDING_ERROR_CODES.PRODUCTION_COMMIT_MISMATCH, 'C3T parent commit');
  requirePattern(productionParent, GIT_OBJECT_PATTERN, BINDING_ERROR_CODES.PRODUCTION_COMMIT_MISMATCH, 'C3T parent commit');

  // No constant or candidate.json fallback is allowed here. Every named sealed/Git
  // authority must be present and byte-for-byte equal before the value is returned.
  const productionTreeSources = [
    { source: 'plan.candidate.productionTree', value: input.planCandidate?.productionTree },
    { source: 'seal.candidate.productionTree', value: input.sealCandidate?.productionTree },
    { source: 'binding.implementation.productionTree', value: input.binding?.implementation?.productionTree },
    { source: 'binding.package.productionTree', value: input.binding?.package?.productionTree },
    { source: 'bindingVerification.productionTree', value: input.bindingVerification?.productionTree },
    { source: 'plan.officialBindingCheck.productionTree', value: input.officialChecks?.plan?.stdout?.parsed?.productionTree },
    { source: 'seal.officialBindingCheck.productionTree', value: input.officialChecks?.seal?.stdout?.parsed?.productionTree },
    { source: 'git.C3T.productionTree', value: input.git?.c3t?.productionTree },
    { source: 'git.C3TB.productionTree', value: input.git?.c3tb?.productionTree },
  ];
  requireValues(productionTreeSources, BINDING_ERROR_CODES.MISSING_PRODUCTION_TREE, 'authoritative production tree');
  const productionTree = requireEqual(productionTreeSources, BINDING_ERROR_CODES.PRODUCTION_TREE_MISMATCH, 'authoritative production tree');
  requirePattern(productionTree, GIT_OBJECT_PATTERN, BINDING_ERROR_CODES.PRODUCTION_TREE_MISMATCH, 'authoritative production tree');

  const helpers = helperEntries(input);
  const helperPath = requireEqual(helpers.paths, BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH, 'helper path');
  const helperByteLength = requireEqual(helpers.byteLengths, BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH, 'helper byte length');
  const helperSha256 = requireEqual(helpers.sha256, BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH, 'helper sha256');
  const helperGitBlob = requireEqual(helpers.gitBlobs, BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH, 'helper Git blob');
  if (!Number.isSafeInteger(helperByteLength) || helperByteLength <= 0) {
    fail(BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH, 'Helper byte length must be a positive safe integer.', { actual: helperByteLength });
  }
  requirePattern(helperSha256, SHA256_PATTERN, BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH, 'helper sha256');
  requirePattern(helperGitBlob, GIT_OBJECT_PATTERN, BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH, 'helper Git blob');

  return {
    result: 'PASS',
    bindingKind: EXPECTED_BINDING_KIND,
    verificationKind: EXPECTED_VERIFICATION_KIND,
    identityKind: 'EXACT_C3TB_BINDING',
    candidate: { role: 'C3TB', branch, commit: candidateCommit, tree: candidateTree, soleParent: productionCommit },
    production: { role: 'C3T', commit: productionCommit, parent: productionParent, rootTree: productionRootTree, tree: productionTree },
    helper: { path: helperPath, byteLength: helperByteLength, sha256: helperSha256, gitBlob: helperGitBlob },
    productionTreeAuthorities: productionTreeSources,
    productionCommitAuthorities: productionCommitSources,
    helperAuthorities: helpers,
    nonAuthoritativePlaceholders: {
      candidateCommit: input.candidateRecord.candidateCommit,
      candidateProductionTree: input.candidateRecord.productionTree,
      candidatePackageProductionTree: candidatePackageProductionTreePlaceholder,
      candidatePackageProductionTreePresent: Object.hasOwn(input.candidateRecord?.package ?? {}, 'productionTree'),
      excludedFromDerivation: true,
    },
    officialChecks: { plan: 'PASS', seal: 'PASS' },
  };
}

export function expectBindingFailure(input, expectedCode) {
  try {
    deriveAuthoritativeBinding(input);
  } catch (error) {
    if (!(error instanceof BindingValidationError)) throw error;
    if (error.code !== expectedCode) {
      fail(expectedCode, `Expected ${expectedCode}, received ${error.code}.`, {
        actualCode: error.code,
        actualMessage: error.message,
      });
    }
    return { result: 'EXPECTED_FAIL', code: error.code, message: error.message, details: error.details };
  }
  fail(expectedCode, `Expected binding validation to fail with ${expectedCode}.`, { actual: 'PASS' });
}
