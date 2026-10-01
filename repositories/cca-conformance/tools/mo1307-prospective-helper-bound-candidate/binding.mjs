// Build or verify the binding-only C3TB child for the prospective-bound C3T candidate.
// This tool performs local Git/package/hash checks only; it runs no product or certification.
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
const evidenceRelative = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
const evidence = path.join(root, evidenceRelative);
const BASE = '79ef47e608c67edc70f3e9f51d494b169794f903';
const C3RB = 'defe93989efc6501b1a730b82e79e705884b269b';
const PHASE3B = '702c1b6381f6112a50ac844831d195275dac3350';
const PHASE3C = 'b02fc0226a1a2d800185a02071674ca80bdf4a1d';
const MAIN_DEADLINE_AUTHORITY = '4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const H_EVIDENCE = '2e4ea741143bb70b06c2863ffede863f23639028';
const IMPLEMENTATION_SUBJECT = 'fix(memoryos-1.3): adopt prospective MO-1307 helper bound';
const BINDING_SUBJECT = 'conformance(memoryos-1.3): bind prospective MO-1307 helper-bound candidate';
const expectedNode = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const bindingPaths = [`${evidenceRelative}/binding.json`, `${evidenceRelative}/binding-verification.json`].sort();
const bytes = value => Buffer.from(`${canonical(value)}\n`);
const sha = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const git = (args, encoding = null) => {
  const result = spawnSync('git', args, { cwd: root, encoding, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr?.toString()}`);
  return result.stdout;
};
const show = (commit, relative) => git(['show', `${commit}:${relative}`]);
const commitText = (commit, format) => git(['show', '-s', `--format=${format}`, commit], 'utf8').trim();
const gitRecord = (commit, relative) => {
  const data = show(commit, relative);
  return {
    path: relative, byteLength: data.length, sha256: sha(data),
    gitBlob: git(['rev-parse', `${commit}:${relative}`], 'utf8').trim(),
  };
};
const parseGitJson = (commit, relative) => JSON.parse(show(commit, relative).toString('utf8'));
const write = (name, value) => fs.writeFileSync(path.join(evidence, name), bytes(value));
const mode = process.argv[2];
assert.ok(['build', 'check'].includes(mode));
assert.equal(process.argv.length, 3);
assert.equal(process.version, 'v24.21.0');
assert.equal(sha(fs.readFileSync(process.execPath)), expectedNode);

const head = git(['rev-parse', 'HEAD'], 'utf8').trim();
const candidateCommit = mode === 'build' ? head : git(['rev-parse', 'HEAD^'], 'utf8').trim();
if (mode === 'build') {
  assert.equal(commitText(candidateCommit, '%s'), IMPLEMENTATION_SUBJECT);
  assert.equal(git(['status', '--short'], 'utf8'), '');
} else {
  assert.equal(commitText(head, '%s'), BINDING_SUBJECT);
  assert.equal(commitText(head, '%P'), candidateCommit);
  assert.equal(git(['status', '--short'], 'utf8'), '');
  const changed = git(['diff-tree', '--no-commit-id', '--name-only', '-r', head], 'utf8').trim().split(/\r?\n/u).filter(Boolean).sort();
  assert.deepEqual(changed, bindingPaths);
}
assert.equal(commitText(candidateCommit, '%P'), BASE);
assert.equal(commitText(candidateCommit, '%s'), IMPLEMENTATION_SUBJECT);
const candidateRootTree = git(['rev-parse', `${candidateCommit}^{tree}`], 'utf8').trim();
const productionTree = git(['rev-parse', `${candidateCommit}:${productRelative}`], 'utf8').trim();
const parentProductionTree = git(['rev-parse', `${BASE}:${productRelative}`], 'utf8').trim();
assert.notEqual(productionTree, parentProductionTree);

const changedInventory = parseGitJson(candidateCommit, `${evidenceRelative}/changed-file-inventory.json`);
const implementationPaths = git(['diff-tree', '--no-commit-id', '--name-only', '-r', candidateCommit], 'utf8').trim().split(/\r?\n/u).filter(Boolean).sort();
assert.deepEqual(implementationPaths, changedInventory.expectedImplementationPaths);
assert.equal(implementationPaths.length, changedInventory.expectedImplementationPathCount);
const implementationRecords = implementationPaths.map(relative => gitRecord(candidateCommit, relative));

const candidate = parseGitJson(candidateCommit, `${evidenceRelative}/candidate.json`);
const validation = parseGitJson(candidateCommit, `${evidenceRelative}/consistency-validation.json`);
assert.equal(candidate.result, 'READY_FOR_BINDING');
assert.equal(validation.result, 'PASS');
assert.equal(candidate.parentAuthority, BASE);
assert.equal(candidate.package.packageMemberCount, 89);
assert.equal(validation.certificationExecuted, false);
const memberRecords = packageFiles.map(member => gitRecord(candidateCommit, `${productRelative}/${member}`));
const normalizedMembers = memberRecords.map(({ path: full, byteLength, sha256 }) => ({
  path: full.slice(productRelative.length + 1), byteLength, sha256,
}));
assert.deepEqual(normalizedMembers, candidate.package.members);
assert.equal(normalizedMembers.length, 89);
const packageIdentity = sha(bytes(normalizedMembers));
assert.equal(packageIdentity, candidate.package.packageIdentity);

const resourceMembers = [
  'contracts/definitions.json', 'contracts/contract.json', 'src/constants.mjs', 'src/schema-data.mjs',
  'src/helper-protocol.mjs', 'src/runtime.mjs', 'src/helper-transport.mjs',
];
const resources = resourceMembers.map(member => gitRecord(candidateCommit, `${productRelative}/${member}`));
const helper = gitRecord(candidateCommit, `${productRelative}/helpers/windows-inspect.ps1`);
const manifest = gitRecord(candidateCommit, `${productRelative}/distribution-manifest.json`);
const sbom = gitRecord(candidateCommit, `${productRelative}/sbom.spdx.json`);
const authority = gitRecord(candidateCommit, `${evidenceRelative}/authority.json`);
const validationRecord = gitRecord(candidateCommit, `${evidenceRelative}/consistency-validation.json`);
const handoffs = ['phase3a-handoff.json', 'phase3b-refresh-map.json', 'phase3c-refresh-map.json']
  .map(name => gitRecord(candidateCommit, `${evidenceRelative}/${name}`));

const binding = {
  kind: 'MO1307ProspectiveHelperBoundCandidateBinding', version: '1.0.0',
  result: 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3', candidateRole: 'C3T', bindingRole: 'C3TB',
  implementation: {
    commit: candidateCommit, parent: BASE, rootTree: candidateRootTree,
    productionTree, subject: IMPLEMENTATION_SUBJECT, changedPaths: implementationPaths,
    changedPathRecords: implementationRecords,
  },
  binding: {
    subject: BINDING_SUBJECT, commit: null, soleParent: candidateCommit,
    selfReference: 'C3TB hash is intentionally supplied externally after creation.',
    productionChanges: false,
  },
  authorities: {
    prospective: authority, identity: 'PROSPECTIVE_HELPER_BOUND@1.0.0', parent: BASE,
    historicalProduction: C3RB, historicalPhase3B: PHASE3B, historicalPhase3C: PHASE3C,
    historicalMainDeadlineAuthority: MAIN_DEADLINE_AUTHORITY,
    characterizationEvidence: H_EVIDENCE, characterizationBinding: BASE, H: 'NOT_ESTABLISHED',
  },
  limits: candidate.limits,
  package: {
    name: 'memoryos-readiness', version: '0.1.0', contract: 'memoryos.readiness@1.0.0',
    productionTree, packageIdentity, memberCount: 89, members: normalizedMembers,
    contractMemberCount: 53, schemaCount: 52, externalProductionDependencies: 0,
  },
  helper, resources, distributionManifest: manifest, sbom,
  includedCorrections: candidate.corrections.included,
  excludedExperiments: candidate.corrections.excluded,
  validation: validationRecord, handoffs,
  candidateRecord: gitRecord(candidateCommit, `${evidenceRelative}/candidate.json`),
  changedFileInventory: gitRecord(candidateCommit, `${evidenceRelative}/changed-file-inventory.json`),
  certification: false, phase3AExecuted: false, phase3BExecuted: false,
  phase3CExecuted: false, phase3DExecuted: false, humanReleaseAuthorization: false,
  push: false, tag: false,
};
const bindingBytes = bytes(binding);
const verification = {
  kind: 'MO1307ProspectiveHelperBoundBindingVerification', version: '1.0.0', result: 'PASS',
  candidateCommit, candidateParent: BASE, candidateRootTree, productionTree,
  bindingSubject: BINDING_SUBJECT,
  binding: { path: `${evidenceRelative}/binding.json`, byteLength: bindingBytes.length, sha256: sha(bindingBytes) },
  checks: [
    'C3T_SINGLE_PARENT', 'C3T_SUBJECT', 'C3T_EXACT_CHANGED_PATHS', 'C3T_PRODUCTION_TREE',
    'PACKAGE_89_MEMBERS', 'CONTRACT_53_MEMBERS', 'SCHEMAS_52', 'ZERO_EXTERNAL_DEPENDENCIES',
    'PROSPECTIVE_AUTHORITY_BOUND', 'HELPER_BOUND', 'MANIFEST_BOUND', 'SBOM_BOUND',
    'CONSISTENCY_VALIDATION_PASS', 'PHASE3A_HANDOFF_BOUND', 'PHASE3B_HANDOFF_BOUND',
    'PHASE3C_HANDOFF_BOUND', 'C3TB_BINDING_ONLY', 'NO_SELF_HASH',
  ],
  bindingCommit: null, productionChangesInBindingCommit: false,
  certificationExecuted: false, selfDigestOmitted: true,
};

if (mode === 'build') {
  fs.mkdirSync(evidence, { recursive: true });
  write('binding.json', binding);
  write('binding-verification.json', verification);
} else {
  const actualBinding = fs.readFileSync(path.join(evidence, 'binding.json'));
  const actualVerification = fs.readFileSync(path.join(evidence, 'binding-verification.json'));
  assert.ok(actualBinding.equals(bindingBytes));
  assert.ok(actualVerification.equals(bytes(verification)));
  assert.equal(git(['rev-parse', `${head}:${productRelative}`], 'utf8').trim(), productionTree);
  checkPackage(product);
}
process.stdout.write(`${canonical({ result: 'PASS', mode, candidateCommit, candidateRootTree, productionTree, packageMembers: 89, productionChangesInBindingCommit: false, certificationExecuted: false })}\n`);
