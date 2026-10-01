// Zero-product engineering validation for the corrected dependency-aware source review.
// It writes one append-only validation record and never imports or launches product/helper code.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  MANIFEST_RELATIVE,
  ROOT,
  TOOL_RELATIVE,
  SourceReviewFailure,
  UNEXPECTED_SOURCE_DELTA,
  classifyAuthorizedHunks,
  classifySyntheticCommentHunk,
  filePin,
  inspectReuseProof,
  inspectSecuritySemantics,
  loadSourceReviewManifest,
  parseUnifiedZeroDiff,
  reviewRepositorySource,
  valueSha256,
  verifyHistoricalBaseline,
} from './source-review-lib.mjs';

const OUTPUT_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation/validation.json';
const OUTPUT = path.join(ROOT, OUTPUT_RELATIVE);
const GIT = 'C:/Program Files/Git/cmd/git.exe';

function requireValidation(condition, message) {
  if (!condition) throw new Error(message);
}

function gitDiff(manifest) {
  const result = spawnSync(GIT, [
    '-c', 'core.longpaths=true',
    '-c', `safe.directory=${ROOT.replaceAll('\\', '/').replace(/\/$/u, '')}`,
    'diff', '--no-ext-diff', '--unified=0',
    manifest.identity.historical.commit,
    manifest.identity.handoff.commit,
    '--', manifest.productRoot,
  ], { cwd: ROOT, windowsHide: true, shell: false, maxBuffer: 512 * 1024 * 1024 });
  requireValidation(!result.error && result.status === 0, result.stderr?.toString('utf8') ?? 'git diff failed');
  return result.stdout;
}

function securitySources() {
  const relatives = [
    'repositories/memoryos-readiness/helpers/windows-inspect.ps1',
    'repositories/memoryos-readiness/src/helper-transport.mjs',
    'repositories/memoryos-readiness/src/runtime.mjs',
    'repositories/memoryos-readiness/src/helper-protocol.mjs',
    'repositories/memoryos-readiness/contracts/definitions.json',
    'repositories/memoryos-readiness/src/constants.mjs',
  ];
  return Object.fromEntries(relatives.map(relative => [relative, fs.readFileSync(path.join(ROOT, relative), 'utf8')]));
}

function syntheticReuseRecord(manifest, ids) {
  const rows = ids.map(id => ({
    id,
    negative: false,
    exercisedDependencies: [{ facetId: 'synthetic:unchanged', equal: true }],
    packageDiffApplicability: {
      changedDependencyPaths: [],
      fieldComparedChangedPaths: [],
      selectedOnlyChangedPaths: manifest.files.map(file => file.path),
      unhandledChangedDependencyPaths: [],
    },
    equalityProof: {
      allExercisedFacetsEqual: true,
      expectedTupleBound: true,
      receiptBytesBound: true,
      candidateIdentityBound: true,
      selectedIntersection: false,
    },
    candidatePins: {
      c3t: manifest.identity.implementation.commit,
      c3tb: manifest.identity.handoff.commit,
      productionTree: manifest.identity.handoff.productTree,
    },
    disposition: 'REUSED_EXACT',
  }));
  return {
    kind: manifest.reuse.kind,
    version: '1.0.0',
    result: 'PASS',
    candidate: manifest.identity.handoff.commit,
    candidateImplementation: manifest.identity.implementation.commit,
    historicalAcceptedPhase3C: manifest.identity.historicalAcceptedPhase3C,
    map: {
      gitBlob: manifest.handoffAuthority.refreshMap.gitBlob,
      sha256: manifest.handoffAuthority.refreshMap.sha256,
    },
    counts: {
      historicalInventory: manifest.reuse.historicalInventory,
      selectedFreshHistoricalControls: manifest.reuse.selectedFreshHistoricalControls,
      reusedHistoricalControls: manifest.reuse.reusedHistoricalControls,
      candidateSpecificSupplementalControls: manifest.reuse.candidateSpecificSupplementalControls,
      omittedHistoricalControls: manifest.reuse.omittedHistoricalControls,
    },
    candidatePins: {
      c3t: manifest.identity.implementation.commit,
      c3tb: manifest.identity.handoff.commit,
      productionTree: manifest.identity.handoff.productTree,
    },
    rows,
    dependencyDisposition: {
      phase: 'SEALED_CAMPAIGN',
      reusedExact: rows.length,
      movedToFresh: [],
      unresolved: [],
      mismatches: [],
    },
    accounting: {
      movedToFreshBeforeSeal: 0,
      postSealAdaptiveMoveAllowed: false,
    },
    certificationExecuted: false,
    productionExecuted: false,
    helperExecuted: false,
    networkUsed: false,
  };
}

const manifest = loadSourceReviewManifest();
const cases = [];

const current = reviewRepositorySource({ requireReuseProof: false, requireCheckout: true });
requireValidation(current.result === 'PASS', 'current source review did not pass');
requireValidation(current.authorizedDiff.hunkCount === 28 && current.authorizedDiff.unexpectedChangeCount === 0,
  'current hunk accounting');
cases.push({
  id: 'authorized-current-c3tb-diff',
  expected: 'PASS', actual: 'PASS', result: 'PASS', outcome: 'AUTHORIZED_DIFF_ACCEPTED',
  diffSha256: current.authorizedDiff.sha256,
  hunkCount: current.authorizedDiff.hunkCount,
  categoryCounts: current.authorizedDiff.categoryCounts,
  securitySemantics: current.securitySemantics.result,
});

const baseline = verifyHistoricalBaseline(manifest);
requireValidation(baseline.result === 'PASS' && baseline.changedFileCount === 0, 'historical baseline review');
cases.push({
  id: 'historical-c3rb-baseline',
  expected: 'PASS', actual: 'PASS', result: 'PASS', outcome: 'HISTORICAL_BASELINE_ACCEPTED',
  candidate: baseline.candidate,
  candidateTree: baseline.candidateTree,
  productionTree: baseline.productionTree,
  exactHistoricalBlobs: baseline.exactHistoricalBlobs,
});

const exactDiff = gitDiff(manifest);
const unexpectedPatch = Buffer.from([
  '',
  'diff --git a/repositories/memoryos-readiness/src/helper-transport.mjs b/repositories/memoryos-readiness/src/helper-transport.mjs',
  'index 1fda7eb5..1fda7eb5 100644',
  '--- a/repositories/memoryos-readiness/src/helper-transport.mjs',
  '+++ b/repositories/memoryos-readiness/src/helper-transport.mjs',
  '@@ -120,0 +121 @@',
  '+export const unexpectedExecutableMutation = true;',
  '',
].join('\n'));
let unexpectedFailure = null;
try {
  classifyAuthorizedHunks(parseUnifiedZeroDiff(Buffer.concat([exactDiff, unexpectedPatch])), manifest, { exactDiff: false });
} catch (error) {
  unexpectedFailure = error;
}
requireValidation(unexpectedFailure instanceof SourceReviewFailure
  && unexpectedFailure.code === UNEXPECTED_SOURCE_DELTA
  && unexpectedFailure.details?.category === 'UNEXPECTED_CHANGE',
  'synthetic executable change was not rejected as unexpected');
cases.push({
  id: 'unexpected-synthetic-executable-change',
  expected: 'FAIL', actual: 'FAIL', result: 'PASS', outcome: 'UNEXPECTED_SOURCE_DELTA_REJECTED',
  detectedCategory: 'UNEXPECTED_CHANGE',
  failureCode: unexpectedFailure.code,
  campaignOutcome: UNEXPECTED_SOURCE_DELTA,
});

const mutatedSources = securitySources();
const transportPath = 'repositories/memoryos-readiness/src/helper-transport.mjs';
mutatedSources[transportPath] = mutatedSources[transportPath].replace(
  'HELPER_SELF_DETACH_AND_CLOSED_PROCESS_PIPES',
  'HELPER_NATIVE_DETACH_AND_CONFIRMED_HOST_EXIT',
);
const policyReview = inspectSecuritySemantics(mutatedSources);
requireValidation(policyReview.result === 'FAIL' && policyReview.failedChecks.includes('console-policy-exact'),
  'synthetic security policy change was not rejected');
cases.push({
  id: 'unexpected-security-policy-change',
  expected: 'FAIL', actual: 'FAIL', result: 'PASS', outcome: 'SECURITY_POLICY_MUTATION_REJECTED',
  failedCheck: 'console-policy-exact',
  failedChecks: policyReview.failedChecks,
});

const commentReview = classifySyntheticCommentHunk({
  path: transportPath,
  removed: ['          } catch { /* Historical explanatory comment. */ }'],
  added: ['          } catch { /* Corrected explanatory comment. */ }'],
});
requireValidation(commentReview.category === 'DOCUMENTATION_ONLY' && commentReview.executableEquivalent === true,
  'comment-only projection changed executable content');
cases.push({
  id: 'comment-only-difference',
  expected: 'PASS', actual: 'PASS', result: 'PASS', outcome: 'DOCUMENTATION_ONLY_EXECUTABLE_EQUIVALENT',
  category: commentReview.category,
  executableEquivalent: commentReview.executableEquivalent,
  executableBeforeSha256: commentReview.beforeSha256,
  executableAfterSha256: commentReview.afterSha256,
});

const syntheticReuseIds = Array.from({ length: manifest.reuse.reusedHistoricalControls }, (_, index) =>
  `synthetic-reuse-${String(index + 1).padStart(3, '0')}`);
const syntheticReuse = syntheticReuseRecord(manifest, syntheticReuseIds);
const validReuse = inspectReuseProof(syntheticReuse, { manifest, expectedReuseIds: syntheticReuseIds });
requireValidation(validReuse.result === 'PASS' && validReuse.action === 'REUSE_EXACT', 'synthetic reuse control did not pass');
syntheticReuse.rows[173].exercisedDependencies[0].equal = false;
syntheticReuse.rows[173].equalityProof.allExercisedFacetsEqual = false;
const mismatchedReuse = inspectReuseProof(syntheticReuse, { manifest, expectedReuseIds: syntheticReuseIds });
requireValidation(mismatchedReuse.result === 'FAIL' && mismatchedReuse.action === 'MOVE_TO_FRESH',
  'reuse mismatch did not fail closed to fresh execution');
cases.push({
  id: 'reuse-dependency-mismatch',
  expected: 'MOVE_TO_FRESH', actual: 'MOVE_TO_FRESH', result: 'PASS', outcome: 'MOVE_TO_FRESH',
  action: mismatchedReuse.action,
  detectorResult: mismatchedReuse.result,
  mismatchCount: mismatchedReuse.failures.length,
  mismatchIds: mismatchedReuse.failures,
});

const record = {
  kind: 'MO1307Phase3CR2DependencyAwareSourceReviewHarnessValidation',
  version: '1.0.0',
  result: 'PASS',
  candidate: manifest.identity.handoff.commit,
  candidateTree: manifest.identity.handoff.rootTree,
  candidateImplementation: manifest.identity.implementation.commit,
  productionTree: manifest.identity.handoff.productTree,
  historicalBaseline: manifest.identity.historical.commit,
  caseCount: cases.length,
  caseIds: cases.map(row => row.id),
  cases,
  currentReviewSha256: valueSha256(current),
  productExecuted: false,
  helperExecuted: false,
  securityControlExecuted: false,
  certificationClaims: 0,
  networkExecuted: false,
  executionCounts: {
    product: 0,
    helper: 0,
    securityCampaign: 0,
    certificationCampaign: 0,
    network: 0,
  },
  sources: [
    filePin(MANIFEST_RELATIVE),
    filePin(`${TOOL_RELATIVE}/source-review-lib.mjs`),
    filePin(`${TOOL_RELATIVE}/validate-source-review.mjs`),
  ],
};

requireValidation(cases.length === 6 && cases.every(row => row.result === 'PASS' && row.outcome.length > 0),
  'validation case accounting');
requireValidation(!fs.existsSync(OUTPUT), `append-only output already exists: ${OUTPUT_RELATIVE}`);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ result: record.result, cases: record.caseCount, output: OUTPUT_RELATIVE })}\n`);
