// Adopt the final prospective aggregate-helper budget and write static candidate evidence.
// This tool launches no product, helper, worker, package install, or certification.
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
const evidenceRelative = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-aggregate-bound-v2-candidate';
const evidence = path.join(root, evidenceRelative);
const BASE = '4208ea48fa8f6acb8f39b21010aac9d29a8086d6';
const C3U = '34f42c50abfa1c440416c4cdf7f643f784585588';
const C3UB = '91c07b1e93f65ab6252024984073c171ff5d7648';
const FAILED_C3UB = '789d92f94638ddbe63d38dc957746bf1f7d308c2';
const FAILED_DIAGNOSTIC = '4208ea48fa8f6acb8f39b21010aac9d29a8086d6';
const PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const PRIOR_AGGREGATE_AUTHORITY = '904908245483d3c64fb21d63aa5a6ebfd22102cb';
const HELPER_AUTHORITY = 'PROSPECTIVE_HELPER_BOUND@2.0.0';
const AUTHORITY_ID = 'PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0';
const expectedNode = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const changedPackageMembers = [
  'README.md', 'contracts/contract.json', 'contracts/definitions.json',
  'distribution-manifest.json', 'helpers/README.md', 'sbom.spdx.json', 'src/constants.mjs',
].sort();
const trackedCorrectionPaths = [
  'repositories/cca-conformance/tools/mo1307-phase1/generate-contracts.mjs',
  ...changedPackageMembers.map(member => `${productRelative}/${member}`),
].sort();
const prebindingEvidenceNames = [
  'authority.json', 'candidate.json', 'changed-file-inventory.json',
  'consistency-validation.json', 'phase3a-handoff.json',
  'phase3br2-binding-delta.json', 'phase3cr2-aggregate-delta.json',
];

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
const git = (args, encoding = null, expect = 0) => {
  const result = spawnSync('git', args, { cwd: root, encoding, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, expect, `${args.join(' ')}: ${result.stderr?.toString()}`);
  return result.stdout;
};
const gitShow = (commit, relative) => git(['show', `${commit}:${relative}`]);
const gitType = commit => git(['cat-file', '-t', commit], 'utf8').trim();
const limits = Object.freeze({
  helperMs: 9000, aggregateHelperActiveMs: 28000, cliAdmissionMs: 30000,
  apiMs: 10000, workerMs: 10000, cleanupMs: 2000,
});

assert.deepEqual(process.argv.slice(2), ['--write']);
assert.equal(process.version, 'v24.21.0');
assert.equal(sha(fs.readFileSync(process.execPath)), expectedNode);
for (const commit of [BASE, C3U, C3UB, FAILED_C3UB, FAILED_DIAGNOSTIC, PHASE3BR2, PRIOR_AGGREGATE_AUTHORITY]) {
  assert.equal(gitType(commit), 'commit');
}
assert.equal(git(['rev-parse', 'HEAD'], 'utf8').trim(), BASE);
git(['merge-base', '--is-ancestor', C3UB, BASE]);
assert.equal(git(['rev-parse', `${BASE}:${productRelative}`], 'utf8').trim(), '302cf1a506e974b2102a78be1b9c920ac80105b2');
assert.equal(fs.existsSync(evidence), false, 'Fresh aggregate-authority evidence namespace required');

const definitions = JSON.parse(fs.readFileSync(path.join(product, 'contracts/definitions.json'), 'utf8'));
assert.equal(definitions.limits.helperDeadlineMs, limits.helperMs);
assert.equal(definitions.limits.helperAggregateDeadlineMs, limits.aggregateHelperActiveMs);
assert.equal(definitions.limits.cliDeadlineMs, limits.cliAdmissionMs);
assert.equal(definitions.limits.apiDeadlineMs, limits.apiMs);
assert.equal(definitions.limits.cleanupAllowanceMs, limits.cleanupMs);
assert.equal(definitions.runtime.externalProductionDependencies, 0);
const packageJson = JSON.parse(fs.readFileSync(path.join(product, 'package.json'), 'utf8'));
assert.deepEqual(packageJson.dependencies, {});
assert.equal(packageJson.scripts, undefined);

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
  return !current.equals(gitShow(BASE, `${productRelative}/${member}`));
}).sort();
assert.deepEqual(actualChangedPackageMembers, changedPackageMembers);
assert.equal(packageFiles.length - actualChangedPackageMembers.length, 82);
const trackedDiff = git(['diff', '--name-only', BASE], 'utf8').trim().split(/\r?\n/u).filter(Boolean).sort();
assert.deepEqual(trackedDiff, trackedCorrectionPaths);

const schemaMembers = packageFiles.filter(member => member.startsWith('schemas/'));
for (const member of [...schemaMembers, 'src/schema-data.mjs', 'src/runtime.mjs', 'src/helper-protocol.mjs', 'src/helper-transport.mjs', 'helpers/windows-inspect.ps1', 'package.json']) {
  assert.ok(fs.readFileSync(path.join(product, member)).equals(gitShow(BASE, `${productRelative}/${member}`)), member);
}
const generator = read('repositories/cca-conformance/tools/mo1307-phase1/generate-contracts.mjs').toString('utf8');
assert.match(generator, /helperVerifyRequests:4,helperAggregateDeadlineMs:28000,/u);
assert.doesNotMatch(generator, /helperVerifyRequests:4,helperAggregateDeadlineMs:20000,/u);
const protocol = fs.readFileSync(path.join(product, 'src/helper-protocol.mjs'), 'utf8');
const runtime = fs.readFileSync(path.join(product, 'src/runtime.mjs'), 'utf8');
assert.match(protocol, /const VERSION = '2\.0\.0';/u);
assert.match(protocol, /current >= state\.launched \+ LIMITS\.helperDeadlineMs/u);
assert.match(runtime, /Math\.min\(deadline, launch \+ L\.helperDeadlineMs, launch \+ L\.helperAggregateDeadlineMs - helperUsedMs\)/u);
assert.match(runtime, /const cleanupDeadline = terminalAt \+ L\.cleanupAllowanceMs;/u);
const productReadme = fs.readFileSync(path.join(product, 'README.md'), 'utf8');
const helperReadme = fs.readFileSync(path.join(product, 'helpers/README.md'), 'utf8');
assert.ok(productReadme.includes('aggregate helper-active28s limit'));
assert.ok(helperReadme.includes('PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0'));
assert.ok(helperReadme.includes('28,000 ms aggregate'));
assert.doesNotMatch(`${productReadme}\n${helperReadme}`, /aggregate helper-active20s|20,000 ms aggregate helper-active/iu);

const authority = {
  kind: 'MO1307ProspectiveHelperAggregateBoundAuthority', version: '2.0.0', identity: AUTHORITY_ID,
  status: 'ADOPTED_PROSPECTIVELY', valueMs: 28000, appliesFromCandidate: 'C3V',
  relation: { accepted: 'helperActiveMs < 28000', timeout: 'helperActiveMs >= 28000', equality: 'TIMEOUT' },
  accounting: {
    scope: 'HELPER_ACTIVE_WHOLE_LIFECYCLE', excludesWorkerTime: true,
    remainingFormula: '28000 - helperUsedMs',
    effectiveDeadline: 'min(cliDeadline, launch + 9000, launch + 28000 - helperUsedMs)',
  },
  limits,
  preservedAuthority: { identity: HELPER_AUTHORITY, valueMs: 9000, success: 'elapsedMs < 9000', timeout: 'elapsedMs >= 9000' },
  rationale: {
    priorHelperActiveMs: 19297.7443, priorRemainingAggregateMs: 702.2557,
    priorRemainingSupervisorLeaseMs: 702.2263, priorT0WindowMs: 702.1707,
    conclusion: 'The 20000 ms aggregate ceiling, not the 9000 ms per-helper ceiling, blocked the required READY sequence.',
  },
  historical: {
    priorAggregateMs: 20000, priorAuthorityCommit: PRIOR_AGGREGATE_AUTHORITY,
    H: 'NOT_ESTABLISHED', failedC3TBPreserved: true, failedC3UB: FAILED_C3UB,
    failedDiagnostic: FAILED_DIAGNOSTIC, historicalResultsRewritten: false,
  },
  wireVersion: '2.0.0', topologyChanged: false, powershellArchitectureChanged: false,
  retroactive: false, statisticalH: false, certification: false, humanReleaseAuthorization: false,
};
write('authority.json', authority);

const resourceMembers = [
  'contracts/definitions.json', 'contracts/contract.json', 'src/constants.mjs', 'src/schema-data.mjs',
  'src/helper-protocol.mjs', 'src/runtime.mjs', 'src/helper-transport.mjs',
];
const resourceRecords = resourceMembers.map(packageRecord);
const packageIdentity = sha(bytes(memberRecords));
const validation = {
  kind: 'MO1307ProspectiveHelperAggregateBoundV2ConsistencyValidation', version: '1.0.0', result: 'PASS',
  baseline: BASE, derivedFrom: C3UB, authority: AUTHORITY_ID,
  preservedHelperAuthority: HELPER_AUTHORITY, node: { version: process.version, sha256: expectedNode },
  limits, aggregateBoundary: { accepted: '<28000', timeout: '>=28000', equalityFailsClosed: true },
  helperBoundary: { success: '<9000', timeout: '>=9000', equalityFailsClosed: true },
  runtimeFormulaUnchanged: true, runtimeBytesUnchanged: true, protocolBytesUnchanged: true,
  helperBytesUnchanged: true, wireVersion: '2.0.0', schemasChangedFromParent: false,
  schemaDataChangedFromParent: false, package: packageCheck, distributionRows: 88,
  sbomFileRows: 87, sbomRelationships: 88, changedPackageMembers: actualChangedPackageMembers,
  unchangedPackageMembers: 82, unexpectedProductionDependencies: 0,
  generatedAndRuntimeResources: resourceRecords, certificationExecuted: false,
};
write('consistency-validation.json', validation);

write('phase3a-handoff.json', {
  kind: 'MO1307ProspectiveAggregateBoundPhase3AHandoff', version: '1.0.0', status: 'PENDING_FRESH_EXECUTION',
  candidateRole: 'C3V', bindingRole: 'C3VB', consumeRule: 'EXACT_C3VB_HEAD_AFTER_BINDING_VERIFICATION',
  authorities: [HELPER_AUTHORITY, AUTHORITY_ID], limits, mode: 'ONE_B_GATE_THEN_FRESH_FULL_A_TO_O',
  preCertificationGate: { vector: 'B/ready/evaluate', executions: 1, retry: false, certification: false },
  certificationInventory: [...'ABCDEFGHIJKLMNO'], exactInstalledMembers: 89,
  stopAtFirstMandatoryFailure: true, historicalPassPromotion: false,
  phase3BR2Rerun: false, phase3CR2: false, phase3D: false, push: false, tag: false,
});

write('phase3br2-binding-delta.json', {
  kind: 'MO1307FinalCandidatePhase3BR2BindingDelta', version: '1.0.0', status: 'REPORT_ONLY_AFTER_PHASE3A_ACCEPTANCE',
  preservedAcceptedCommit: PHASE3BR2, rerun: false,
  from: { candidateRole: 'C3TB', helperMs: 8000, aggregateMs: 20000, helperAuthority: 'PROSPECTIVE_HELPER_BOUND@1.0.0' },
  to: { candidateRole: 'C3VB', helperMs: 9000, aggregateMs: 28000, helperAuthority: HELPER_AUTHORITY, aggregateAuthority: AUTHORITY_ID },
  identityFieldsToRebind: ['candidateCommit', 'productionCommit', 'productionTree', 'packageIdentity', 'archive', 'distributionManifest', 'sbom', 'generatedDefinitions', 'generatedConstants'],
  unchanged: { cliMs: 30000, apiWorkerMs: 10000, cleanupMs: 2000, H: 'NOT_ESTABLISHED' },
  historicalOutcomePromoted: false,
});

write('phase3cr2-aggregate-delta.json', {
  kind: 'MO1307FinalCandidatePhase3CR2AggregateDelta', version: '1.0.0', status: 'PENDING_SEPARATE_HARNESS_CORRECTION',
  executionPerformed: false, fromAggregateMs: 20000, toAggregateMs: 28000,
  boundary: { accepted: 'helperActiveMs < 28000', timeout: 'helperActiveMs >= 28000', equality: 'TIMEOUT' },
  regenerate: ['contracts/definitions.json', 'src/constants.mjs', 'contracts/contract.json', 'sbom.spdx.json', 'distribution-manifest.json'],
  unchanged: { helperMs: 9000, cliMs: 30000, apiWorkerMs: 10000, cleanupMs: 2000, wireVersion: '2.0.0', H: 'NOT_ESTABLISHED' },
  runtimeProtocolHelperSecurityBytesUnchanged: true,
});

const implementationPaths = [
  'docs/mo1307-prospective-helper-aggregate-bound-v2-candidate.md',
  'repositories/cca-conformance/tools/mo1307-phase1/generate-contracts.mjs',
  'repositories/cca-conformance/tools/mo1307-prospective-helper-aggregate-bound-v2-candidate/binding.mjs',
  'repositories/cca-conformance/tools/mo1307-prospective-helper-aggregate-bound-v2-candidate/prepare.mjs',
  ...changedPackageMembers.map(member => `${productRelative}/${member}`),
  ...prebindingEvidenceNames.map(name => `${evidenceRelative}/${name}`),
].sort();
write('changed-file-inventory.json', {
  kind: 'MO1307ProspectiveAggregateBoundV2ChangedFileInventory', version: '1.0.0', baseline: BASE,
  expectedImplementationPaths: implementationPaths, expectedImplementationPathCount: implementationPaths.length,
  productChangedMembers: changedPackageMembers.map(member => {
    const before = gitShow(BASE, `${productRelative}/${member}`);
    return { member, before: { byteLength: before.length, sha256: sha(before) }, after: packageRecord(member) };
  }),
  productUnchangedMembers: 82, packageMembers: 89, schemasUnchanged: 52,
  selfDigestOmitted: true,
  bindingChildReservedPaths: [`${evidenceRelative}/binding.json`, `${evidenceRelative}/binding-verification.json`],
});

const candidate = {
  kind: 'MO1307ProspectiveHelperAggregateBoundV2Candidate', version: '1.0.0', result: 'READY_FOR_BINDING',
  candidateRole: 'C3V', bindingRole: 'C3VB', parentAuthority: BASE, derivedFromCandidate: C3UB,
  preservedHistory: { C3U, C3UB, failedC3UB: FAILED_C3UB, failedDiagnostic: FAILED_DIAGNOSTIC, phase3BR2: PHASE3BR2, H: 'NOT_ESTABLISHED' },
  authorities: { helper: HELPER_AUTHORITY, aggregate: record(`${evidenceRelative}/authority.json`) },
  limits,
  package: {
    name: 'memoryos-readiness', version: '0.1.0', contract: 'memoryos.readiness@1.0.0',
    packageMemberCount: 89, contractMemberCount: 53, schemaCount: 52,
    distributionRows: 88, sbomFileRows: 87, sbomRelationships: 88,
    externalProductionDependencies: 0, packageIdentity, members: memberRecords,
  },
  generatedAndRuntimeResources: resourceRecords,
  helper: packageRecord('helpers/windows-inspect.ps1'),
  distributionManifest: packageRecord('distribution-manifest.json'), sbom: packageRecord('sbom.spdx.json'),
  validation: record(`${evidenceRelative}/consistency-validation.json`),
  handoff: record(`${evidenceRelative}/phase3a-handoff.json`),
  phase3BR2Delta: record(`${evidenceRelative}/phase3br2-binding-delta.json`),
  phase3CR2Delta: record(`${evidenceRelative}/phase3cr2-aggregate-delta.json`),
  changedFileInventory: record(`${evidenceRelative}/changed-file-inventory.json`),
  candidateCommit: null, productionTree: null, certification: false, phase3Execution: false,
  humanReleaseAuthorization: false, push: false, tag: false,
};
write('candidate.json', candidate);

checkPackage(product);
for (const name of prebindingEvidenceNames) {
  const data = fs.readFileSync(path.join(evidence, name));
  assert.ok(data.equals(bytes(JSON.parse(data.toString('utf8')))), name);
}
process.stdout.write(`${canonical({ result: 'PASS', authority: AUTHORITY_ID, packageMembers: 89, changedPackageMembers, certificationExecuted: false })}\n`);
