// Deterministic authority adoption and bounded static consistency validation.
// This tool launches no product, helper, certification, network, or package install.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonical, checkPackage, packageFiles } from '../mo1307-phase1/package.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const productRelative = 'repositories/memoryos-readiness';
const product = path.join(root, productRelative);
const evidenceRelative = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate';
const evidence = path.join(root, evidenceRelative);
const BASE = '9f45656cdb1fe8899cfd6abceb8061bbba459d73';
const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3RB = 'defe93989efc6501b1a730b82e79e705884b269b';
const PHASE3B = '702c1b6381f6112a50ac844831d195275dac3350';
const PHASE3C = 'b02fc0226a1a2d800185a02071674ca80bdf4a1d';
const PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const MAIN_DEADLINE_AUTHORITY = '4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const H_EVIDENCE = '2e4ea741143bb70b06c2863ffede863f23639028';
const AUTHORITY_ID = 'PROSPECTIVE_HELPER_BOUND@2.0.0';
const expectedNode = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const changedPackageMembers = [
  'README.md', 'contracts/contract.json', 'contracts/definitions.json',
  'distribution-manifest.json', 'helpers/README.md', 'sbom.spdx.json', 'src/constants.mjs',
].sort();

const bytes = value => Buffer.from(`${canonical(value)}\n`);
const sha = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const read = relative => fs.readFileSync(path.join(root, relative));
const record = relative => {
  const data = read(relative);
  return { path: relative.replaceAll('\\', '/'), byteLength: data.length, sha256: sha(data) };
};
const packageRecord = member => {
  const data = fs.readFileSync(path.join(product, member));
  return { path: member, byteLength: data.length, sha256: sha(data) };
};
const write = (name, value) => {
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, name), bytes(value));
};
const git = (args, encoding = null) => {
  const result = spawnSync('git', args, { cwd: root, encoding, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr?.toString()}`);
  return result.stdout;
};
const gitShow = (commit, relative) => git(['show', `${commit}:${relative}`]);
const gitType = commit => git(['cat-file', '-t', commit], 'utf8').trim();
const limits = Object.freeze({
  helperMs: 9000, aggregateHelperActiveMs: 20000, cliAdmissionMs: 30000,
  apiMs: 10000, workerMs: 10000, cleanupMs: 2000,
});
const invariantNames = Object.freeze([
  'FRESH_HELPER_PROCESS_PER_INVOCATION', 'NO_PERSISTENT_HELPER_OR_POOL_OR_SERVICE',
  'ONE_REQUEST_ONE_RESPONSE', 'WIRE_2_0_0', 'FRESH_NATIVE_OBSERVATIONS',
  'CHECKED_HANDLES', 'FILESYSTEM_BOUNDARIES', 'TOCTOU_PROTECTIONS',
  'PATH_AND_BYTE_CAPS', 'HELPER_HELPER_EXCLUSION', 'HELPER_WORKER_EXCLUSION',
  'BOUNDED_FAILURE_CLEANUP', 'FAIL_CLOSED_TIMEOUT', 'NO_RETRY',
  'NO_DEADLINE_GRACE', 'NO_LATE_SUCCESS_RECOVERY', 'HUMAN_RELEASE_AUTHORITY_SEPARATION',
]);

assert.deepEqual(process.argv.slice(2), ['--write']);
assert.equal(process.version, 'v24.21.0');
assert.equal(sha(fs.readFileSync(process.execPath)), expectedNode);
for (const commit of [BASE, C3T, C3TB, C3RB, PHASE3B, PHASE3C, PHASE3BR2, MAIN_DEADLINE_AUTHORITY, H_EVIDENCE]) {
  assert.equal(gitType(commit), 'commit');
}
assert.equal(git(['rev-parse', 'HEAD'], 'utf8').trim(), BASE);

const definitions = JSON.parse(fs.readFileSync(path.join(product, 'contracts/definitions.json'), 'utf8'));
assert.equal(definitions.limits.helperDeadlineMs, limits.helperMs);
assert.equal(definitions.limits.helperAggregateDeadlineMs, limits.aggregateHelperActiveMs);
assert.equal(definitions.limits.cliDeadlineMs, limits.cliAdmissionMs);
assert.equal(definitions.limits.apiDeadlineMs, limits.apiMs);
assert.equal(definitions.limits.cleanupAllowanceMs, limits.cleanupMs);
assert.equal(definitions.identity.id, 'memoryos.readiness');
assert.equal(definitions.identity.version, '1.0.0');

const packageCheck = checkPackage(product);
assert.deepEqual(packageCheck, {
  kind: 'MO1307Phase1PackageCheck', version: '1.0.0', members: 89,
  contractMembers: 53, externalProductionDependencies: 0, archiveCertification: false,
});
const memberRecords = packageFiles.map(packageRecord);
assert.equal(memberRecords.length, 89);
assert.equal(packageFiles.filter(member => member.startsWith('schemas/')).length, 52);
const manifest = JSON.parse(fs.readFileSync(path.join(product, 'distribution-manifest.json'), 'utf8'));
const sbom = JSON.parse(fs.readFileSync(path.join(product, 'sbom.spdx.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(product, 'contracts/contract.json'), 'utf8'));
assert.equal(manifest.files.length, 88);
assert.equal(sbom.files.length, 87);
assert.equal(sbom.relationships.length, 88);
assert.equal(contract.files.length, 53);

const actualChangedPackageMembers = packageFiles.filter(member => {
  const current = fs.readFileSync(path.join(product, member));
  const prior = gitShow(BASE, `${productRelative}/${member}`);
  return !current.equals(prior);
}).sort();
assert.deepEqual(actualChangedPackageMembers, changedPackageMembers);
assert.equal(packageFiles.length - actualChangedPackageMembers.length, 82);

const generator = read('repositories/cca-conformance/tools/mo1307-phase1/generate-contracts.mjs').toString('utf8');
assert.match(generator, /helperRequestPaths:128,helperDeadlineMs:9000,/u);
assert.doesNotMatch(generator, /helperRequestPaths:128,helperDeadlineMs:(?:5000|8000),/u);
const protocol = fs.readFileSync(path.join(product, 'src/helper-protocol.mjs'), 'utf8');
const runtime = fs.readFileSync(path.join(product, 'src/runtime.mjs'), 'utf8');
const transport = fs.readFileSync(path.join(product, 'src/helper-transport.mjs'), 'utf8');
const helper = fs.readFileSync(path.join(product, 'helpers/windows-inspect.ps1'), 'utf8');
assert.match(protocol, /const VERSION = '2\.0\.0';/u);
assert.match(protocol, /current >= state\.launched \+ LIMITS\.helperDeadlineMs/u);
assert.match(runtime, /Math\.min\(deadline, launch \+ L\.helperDeadlineMs, launch \+ L\.helperAggregateDeadlineMs - helperUsedMs\)/u);
assert.match(runtime, /current >= Math\.min\(deadline, limit\)/u);
assert.match(runtime, /const cleanupDeadline = terminalAt \+ L\.cleanupAllowanceMs;/u);
assert.match(transport, /if \(!processClosed \|\| !outputClosed \|\| !errorClosed \|\| !inputClosed\) return;/u);
assert.match(transport, /if \(!consoleQuiescent\) fail\('INPUT', 'ACQUISITION'\);/u);
assert.match(helper, /request\.version -cne '2\.0\.0'/u);
const productReadme = fs.readFileSync(path.join(product, 'README.md'), 'utf8');
const helperReadme = fs.readFileSync(path.join(product, 'helpers/README.md'), 'utf8');
assert.ok(productReadme.includes('prospective whole-helper 9s bound'));
assert.ok(helperReadme.includes('strictly before 9,000 ms'));
assert.ok(helperReadme.includes('earliest of its own nine seconds'));
assert.doesNotMatch(`${productReadme}\n${helperReadme}`, /(?:prospective whole-helper 8s bound|strictly before 8,000 ms|own eight seconds)/iu);

const authority = {
  kind: 'MO1307ProspectiveHelperBoundAuthority', version: '1.0.0', identity: AUTHORITY_ID,
  status: 'ADOPTED_PROSPECTIVELY', valueMs: 9000, appliesFromCandidate: 'C3U',
  relation: { success: 'elapsedMs < 9000', timeout: 'elapsedMs >= 9000', equality: 'TIMEOUT' },
  lifecycle: [
    'PROCESS_CREATION', 'POWERSHELL_STARTUP', 'HELPER_INITIALIZATION', 'NATIVE_INITIALIZATION',
    'REQUEST_PROCESSING', 'RESPONSE_FRAMING_AND_WRITE', 'EOF', 'PROCESS_EXIT',
    'PIPE_SETTLEMENT', 'REQUIRED_HELPER_AND_CONSOLE_QUIESCENCE',
  ],
  limits, cleanup: { beginsAfterTerminalHelperOutcome: true, separateAllowanceMs: 2000, successGrace: false },
  invariants: invariantNames,
  historical: {
    helperMs: 5000, disposition: 'AUTHORITATIVE_FOR_PREVIOUS_GENERATIONS_ONLY',
    H: 'NOT_ESTABLISHED', characterizationEvidence: H_EVIDENCE,
    characterizationBinding: '79ef47e608c67edc70f3e9f51d494b169794f903', characterizationFailureClass: 'SEALED_FIXTURE_IDENTITY_PREPARATION_DEFECT',
    mainDeadlineAuthority: MAIN_DEADLINE_AUTHORITY,
    mainDeadlineAuthorityChain: [
      '6d444e323f8048712908eaff22712eeac8a4e6b3',
      '1e78a9a963ea945847a9192f8ec3a9ce2b4e7cc5', MAIN_DEADLINE_AUTHORITY,
    ],
    physicalAncestry: 'NAMED_SEPARATE_HISTORY_DIVERGED_AT_C3RB', historicalTimeoutsRewritten: false,
    priorProspectiveAuthority: {
      identity: 'PROSPECTIVE_HELPER_BOUND@1.0.0', helperMs: 8000, productionCandidate: C3T,
      bindingCandidate: C3TB, phase3AFailedGeneration: BASE, result: 'PHASE3AR2_FAILED_INCOMPLETE',
      disposition: 'PRESERVED_HISTORICAL_ONLY', promoted: false,
    },
  },
  retroactive: false, statisticalH: false, certification: false, humanReleaseAuthorization: false,
};
write('authority.json', authority);

const corrections = {
  included: [
    {
      id: 'FINAL_HEADLESS_POST_DETACH_INITIAL_ZERO',
      implementation: 'b11ab5874249e0938f2753594a294511b14d2aae',
      binding: 'b73f4bd6ce71228372614889d9c6da1b778df49d',
      validation: 'DEDICATED_SMOKE_PASS_ONCE_AND_SECURITY_A_TO_S_19_OF_19_PASS',
      laterStop: 'N15_SEPARATE_DEFECT_97_PASS_1_FAIL_9_NOT_RUN',
      reason: 'Authorized final supported headless design passed its required local smoke and security matrix.',
      affectedShippedMembers: ['distribution-manifest.json', 'helpers/README.md', 'helpers/windows-inspect.ps1', 'sbom.spdx.json', 'src/helper-transport.mjs'],
    },
    {
      id: 'CREATEFILEW_SET_LAST_ERROR', implementation: 'c9cd73df2f4c48afeab6059b31eca61830e1633c',
      binding: '56a3d93a0c7fdb42e93e16ec1f6c13c81770c11b',
      validation: 'METADATA_PASS_N15_PASS_NATIVE_FILESYSTEM_35_OF_35_SECURITY_19_OF_19',
      laterStop: 'N17_SEPARATE_FIXTURE_DEFECT_99_PASS_1_FAIL_7_NOT_RUN',
      reason: 'The effective CreateFileW last-error capture repair passed its dedicated metadata and native validation.',
      affectedShippedMembers: ['distribution-manifest.json', 'helpers/README.md', 'helpers/windows-inspect.ps1', 'sbom.spdx.json'],
    },
    {
      id: 'OPEN_CHAIN_REDUNDANT_ASSERT_ROOT_REMOVAL',
      implementation: '08a65ad87bb36095c08c5bd8ac9682f9f9581918',
      binding: '0599476f53815a4ccd05e0ba3cac600396ca201c',
      validation: 'STATIC_EQUIVALENCE_SECURITY_PASS_AND_SLOT4_SLOT5_WITNESSES_2_OF_2_PASS',
      laterStop: 'DIFFERENT_MISSING_LEAF_LIFECYCLE_TIMEOUT_14_PASS_1_FAIL_20_NOT_RUN',
      reason: 'The authorized removal passed its correction-specific validation and preserved all fresh native checks.',
      affectedShippedMembers: ['distribution-manifest.json', 'helpers/README.md', 'helpers/windows-inspect.ps1', 'sbom.spdx.json'],
    },
  ],
  excluded: [
    { id: 'GETCONSOLEWINDOW_HELD_HOST_OWNER', commits: ['865978ff56229b60cca77bdb797987fc7d49aa4e', 'af1684ce'], reason: 'Native wire produced no frame; never accepted.' },
    { id: 'DETACHED_LAUNCH_OWNER_HOST_PROOF', commits: ['ca2eaf87', '93e515d8'], reason: 'Product smoke exited 22 with no frame; never accepted.' },
    { id: 'SECOND_POST_DETACH_MEMBERSHIP_QUERY', commits: ['acffde9f', 'c285fd8e', 'e08db921', 'cb1e1428'], reason: 'Failed design required count zero/error 6; final authority removes this query and cached-error predicate.' },
    { id: 'C3S_CLOSED_SERIALIZER', commits: [], reason: 'Uncommitted experiment stopped at F22 with 218/219; no C3S or C3SB authority exists.' },
    { id: 'DIAGNOSTIC_OR_FIXTURE_ONLY_BYTES', commits: [], reason: 'R2 instrumentation, buffer candidates, N17 fixture, missing-leaf diagnostics, and characterization copies are not shipped production.' },
  ],
};

const resourceRecords = [
  'contracts/definitions.json', 'contracts/contract.json', 'src/constants.mjs', 'src/schema-data.mjs',
  'src/helper-protocol.mjs', 'src/runtime.mjs', 'src/helper-transport.mjs',
].map(member => packageRecord(member));
const packageIdentity = sha(bytes(memberRecords));
const validation = {
  kind: 'MO1307ProspectiveHelperBoundV2ConsistencyValidation', version: '1.0.0', result: 'PASS',
  baseline: BASE, authority: AUTHORITY_ID, node: { version: process.version, sha256: expectedNode },
  limits, strictBoundary: { success: '<9000', timeout: '>=9000', equalityFailsClosed: true },
  lifecycle: { processAndAllPipesCloseBeforeCompletion: true, quiescenceRequired: true, wholeHelper: true },
  cleanup: { separateMs: 2000, formula: 'cleanupDeadline = terminalAt + cleanupAllowanceMs', successGrace: false },
  terminalSemantics: { retry: false, deadlineGrace: false, lateSuccessRecovery: false },
  wireVersion: '2.0.0', schemasChangedFromParent: false, schemaDataChangedFromParent: false,
  package: packageCheck, distributionRows: manifest.files.length, sbomFileRows: sbom.files.length,
  sbomRelationships: sbom.relationships.length, changedPackageMembers: actualChangedPackageMembers,
  unchangedPackageMembers: 82, unexpectedProductionDependencies: 0, generatedResources: resourceRecords,
  helper: packageRecord('helpers/windows-inspect.ps1'), productionOrHelperExecuted: false,
  certificationExecuted: false,
};
write('consistency-validation.json', validation);

const phase3A = {
  kind: 'MO1307ProspectiveBoundV2Phase3AHandoff', version: '1.0.0', status: 'PENDING_SEPARATE_EXECUTION',
  candidateRole: 'C3U', consumeRule: 'EXACT_C3UB_HEAD_AFTER_BINDING_VERIFICATION',
  authority: AUTHORITY_ID, limits, mode: 'FRESH_FULL_A_TO_O', inventory: [...'ABCDEFGHIJKLMNO'],
  requirements: [
    'FRESH_ISOLATED_WORKTREE', 'FRESH_PACKAGE_ASSEMBLY', 'FRESH_OFFLINE_INSTALL',
    'EXACT_89_INSTALLED_MEMBERS', 'FULL_A_TO_O_IN_ORDER', 'WHOLE_HELPER_SUCCESS_STRICTLY_BEFORE_9000',
    'TIMEOUT_AT_OR_AFTER_9000', 'UNCHANGED_20000_30000_10000_2000_LIMITS',
    'NO_HISTORICAL_PHASE3A_PASS_PROMOTION', 'FIRST_MANDATORY_FAILURE_STOPS_GENERATION',
  ],
  historicalFailuresPreserved: true, certificationStarted: false, phase3BStarted: false,
  phase3CStarted: false, phase3DStarted: false, push: false, tag: false,
};
write('phase3a-handoff.json', phase3A);

const phase3B = {
  kind: 'MO1307ProspectiveBoundV2Phase3BRefreshMap', version: '1.0.0', status: 'PENDING_SEPARATE_EXECUTION',
  candidateRole: 'C3U', consumeRule: 'EXACT_C3UB_HEAD_AFTER_BINDING_VERIFICATION',
  historicalAccepted: [
    { commit: PHASE3B, appliesOnlyTo: 'C3RB', promoted: false },
    { commit: PHASE3BR2, appliesOnlyTo: 'C3TB', result: 'PHASE3BR2_ACCEPTED', preserved: true, promoted: false },
  ],
  selectedScope: [
    'EXACT_CANDIDATE_AND_PRODUCTION_TREE', 'PACKAGE_89_MEMBER_INVENTORY', 'CONTRACT_53_MEMBER_BINDING',
    'GENERATED_DEFINITIONS_AND_CONSTANTS', 'DISTRIBUTION_88_ROWS', 'SBOM_87_FILES_AND_88_RELATIONSHIPS',
    'SOURCE_AND_TOOLCHAIN_PROVENANCE', 'TWO_INDEPENDENT_DETERMINISTIC_ARCHIVE_ASSEMBLIES',
    'FRESH_OFFLINE_INSTALL', 'INSTALLED_89_MEMBER_BEFORE_AFTER_EQUALITY', 'RUNTIME_IMPORT_CLOSURE',
    'INSTALLED_CONTEXT_SMOKE', 'DEADLINE_CONFIGURATION_BINDINGS',
  ],
  freshTamperControls: [
    'archive-byte-tamper', 'missing-member', 'unexpected-member', 'unsafe-tar-path',
    'nonregular-tar-member', 'duplicate-member', 'missing-tar-terminator', 'trailing-tar-data',
    'helper-tamper', 'distribution-hash-tamper', 'distribution-length-tamper', 'sbom-checksum-tamper',
    'extra-package-file', 'missing-package-file', 'provenance-byte-tamper', 'installed-helper-mutation',
  ],
  reuseOnlyAfterExactDependencyProof: [
    'schema-tamper', 'unexpected-production-dependency', 'external-runtime-import',
    'source-worktree-import', 'network-builtin-import', 'runtime-identity-mismatch',
    'UNCHANGED_PROVIDER_CONCLUSIONS', 'UNCHANGED_ADVISORY_CONCLUSIONS', 'UNCHANGED_LICENSING_CONCLUSIONS',
  ],
  hostedOrNetworkCertification: false, certificationStarted: false, push: false, tag: false,
};
write('phase3b-refresh-map.json', phase3B);

const priorRefresh = JSON.parse(fs.readFileSync(path.join(root, 'repositories/cca-conformance/evidence/mo1307/final-headless/future-3bc-refresh-requirements.json'), 'utf8'));
const acceptedControlMap = JSON.parse(gitShow(PHASE3C, 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/current-control-map.json').toString('utf8'));
assert.equal(acceptedControlMap.rows.length, 551);
assert.equal(priorRefresh.phase3C.affectedPrimaryIds.length, 88);
const selectedHistoricalIds = [...new Set([
  ...priorRefresh.phase3C.affectedPrimaryIds,
  'refresh:deadline-deadline-sequence-no-partial-or-late-success',
])].sort();
assert.equal(selectedHistoricalIds.length, 89);
const allControlIds = acceptedControlMap.rows.map(row => row.id).sort();
assert.equal(new Set(allControlIds).size, 551);
for (const id of selectedHistoricalIds) assert.ok(allControlIds.includes(id), id);
const dependencyReuseIds = allControlIds.filter(id => !selectedHistoricalIds.includes(id));
assert.equal(dependencyReuseIds.length, 462);
const phase3C = {
  kind: 'MO1307ProspectiveBoundV2Phase3CRefreshMap', version: '1.0.0', status: 'PENDING_SEPARATE_EXECUTION',
  candidateRole: 'C3U', consumeRule: 'EXACT_C3UB_HEAD_AFTER_BINDING_VERIFICATION',
  historicalAccepted: { commit: PHASE3C, controls: 551, appliesOnlyTo: 'C3RB', promoted: false },
  accounting: { historicalInventory: 551, selectedFreshHistoricalControls: 89, dependencyReuseCandidates: 462, omitted: 0 },
  selectedHistoricalIds, dependencyReuseIds,
  candidateSpecificSupplementalControls: [
    'candidate:prospective-bound-generated-contract-consistency',
    'candidate:prospective-bound-package-and-binding-identity',
  ],
  selectedReasons: [
    'Changed helper/startup/filesystem bytes require the established 88-control helper/native-frame/fixed-launch closure.',
    'The sequence no-partial-or-late-success control directly embeds the former equality boundary and must be refreshed at 9000.',
    'Candidate-specific supplemental controls bind generated definitions/constants, package metadata, and C3U/C3UB identities.',
  ],
  requiredSourceAndSecurityReviews: [
    'DEADLINE_CONSTANT_BINDING', 'STRICT_TIMEOUT_EQUALITY', 'TIMEOUT_MAPPING', 'LATE_SUCCESS_REFUSAL',
    'SEQUENCE_NO_PARTIAL_SUCCESS', 'SEPARATE_CLEANUP_TIMING', 'NATIVE_API_PARITY',
    'GENERATED_CONTRACT_CONSISTENCY', 'HEADLESS_AND_STARTUP_CORRECTIONS',
    'FILESYSTEM_AND_TOCTOU_CORRECTIONS', 'SOURCE_SECURITY_REVIEW', 'CANDIDATE_BINDING',
  ],
  additionalHeadlessCases: [...'ABCDEFGHIJKLMNOPQRS'],
  reuseRule: 'Each of the 462 IDs requires explicit field-level dependency equality before adopting its historical outcome; name inclusion is not PASS.',
  certificationStarted: false, selectedExecutionStarted: false, push: false, tag: false,
};
write('phase3c-refresh-map.json', phase3C);

const prebindingEvidence = [
  'authority.json', 'candidate.json', 'changed-file-inventory.json', 'consistency-validation.json',
  'phase3a-handoff.json', 'phase3b-refresh-map.json', 'phase3c-refresh-map.json',
].map(name => `${evidenceRelative}/${name}`);
const implementationPaths = [
  'docs/mo1307-prospective-helper-bound-v2-candidate.md',
  'repositories/cca-conformance/tools/mo1307-phase1/generate-contracts.mjs',
  'repositories/cca-conformance/tools/mo1307-prospective-helper-bound-v2-candidate/binding.mjs',
  'repositories/cca-conformance/tools/mo1307-prospective-helper-bound-v2-candidate/prepare.mjs',
  ...changedPackageMembers.map(member => `${productRelative}/${member}`),
  ...prebindingEvidence,
].sort();
const changedInventory = {
  kind: 'MO1307ProspectiveBoundV2ChangedFileInventory', version: '1.0.0', baseline: BASE,
  expectedImplementationPaths: implementationPaths, expectedImplementationPathCount: implementationPaths.length,
  productChangedMembers: changedPackageMembers.map(member => {
    const beforeBytes = gitShow(BASE, `${productRelative}/${member}`);
    return { member, before: { byteLength: beforeBytes.length, sha256: sha(beforeBytes) }, after: packageRecord(member) };
  }),
  productUnchangedMembers: 82, packageMembers: 89,
  selfDigestOmitted: true,
  bindingChildReservedPaths: [`${evidenceRelative}/binding.json`, `${evidenceRelative}/binding-verification.json`],
};
write('changed-file-inventory.json', changedInventory);

const handoffs = ['phase3a-handoff.json', 'phase3b-refresh-map.json', 'phase3c-refresh-map.json'].map(name => record(`${evidenceRelative}/${name}`));
const candidate = {
  kind: 'MO1307ProspectiveHelperBoundV2Candidate', version: '1.0.0', result: 'READY_FOR_BINDING',
  candidateRole: 'C3U', parentAuthority: BASE, historicalProductionAuthority: C3TB,
  historicalAuthorities: {
    phase3B: PHASE3B, phase3C: PHASE3C, phase3BR2: PHASE3BR2,
    previousProductionCandidate: C3T, previousBindingCandidate: C3TB, failedPhase3A: BASE,
    mainDeadlineAuthority: MAIN_DEADLINE_AUTHORITY,
    characterizationEvidence: H_EVIDENCE, characterizationBinding: '79ef47e608c67edc70f3e9f51d494b169794f903', H: 'NOT_ESTABLISHED',
  },
  prospectiveAuthority: record(`${evidenceRelative}/authority.json`), limits, invariants: invariantNames,
  corrections, package: {
    name: 'memoryos-readiness', version: '0.1.0', contract: 'memoryos.readiness@1.0.0',
    packageMemberCount: 89, contractMemberCount: 53, schemaCount: 52,
    distributionRows: 88, sbomFileRows: 87, externalProductionDependencies: 0,
    packageIdentity, members: memberRecords,
  },
  helper: packageRecord('helpers/windows-inspect.ps1'), generatedAndRuntimeResources: resourceRecords,
  distributionManifest: packageRecord('distribution-manifest.json'), sbom: packageRecord('sbom.spdx.json'),
  validation: record(`${evidenceRelative}/consistency-validation.json`), handoffs,
  changedFileInventory: record(`${evidenceRelative}/changed-file-inventory.json`),
  tools: [
    record('repositories/cca-conformance/tools/mo1307-prospective-helper-bound-v2-candidate/prepare.mjs'),
    record('repositories/cca-conformance/tools/mo1307-prospective-helper-bound-v2-candidate/binding.mjs'),
  ],
  candidateCommit: null, productionTree: null, certification: false, phase3Execution: false,
  humanReleaseAuthorization: false, push: false, tag: false,
};
write('candidate.json', candidate);

checkPackage(product);
for (const name of ['authority.json', 'candidate.json', 'changed-file-inventory.json', 'consistency-validation.json', 'phase3a-handoff.json', 'phase3b-refresh-map.json', 'phase3c-refresh-map.json']) {
  const data = fs.readFileSync(path.join(evidence, name));
  assert.ok(data.equals(bytes(JSON.parse(data.toString('utf8')))), name);
}
process.stdout.write(`${canonical({ result: 'PASS', authority: AUTHORITY_ID, packageMembers: 89, selectedPhase3C: 89, reusedPhase3C: 462, certificationExecuted: false })}\n`);
