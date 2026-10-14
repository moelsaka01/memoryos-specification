// Build or verify the binding-only C3VB child for the final C3V production candidate.
// This tool performs local Git/package/hash checks only; it launches no product or certification.
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
const C3UB = '91c07b1e93f65ab6252024984073c171ff5d7648';
const PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const IMPLEMENTATION_SUBJECT = 'fix(memoryos-1.3): adopt final 28000-ms prospective helper aggregate bound';
const BINDING_SUBJECT = 'conformance(memoryos-1.3): bind final aggregate-budget candidate';
const HELPER_AUTHORITY = 'PROSPECTIVE_HELPER_BOUND@2.0.0';
const AGGREGATE_AUTHORITY = 'PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0';
const expectedNode = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const bindingPaths = [`${evidenceRelative}/binding.json`, `${evidenceRelative}/binding-verification.json`].sort();
const bytes = value => Buffer.from(`${canonical(value)}\n`);
const sha = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const git = (args, encoding = null) => {
  const result = spawnSync('git', args, { cwd: root, encoding, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr?.toString()}`);
  return result.stdout;
};
const show = (commit, relative) => git(['show', `${commit}:${relative}`]);
const commitText = (commit, format) => git(['show', '-s', `--format=${format}`, commit], 'utf8').trim();
const gitRecord = (commit, relative) => {
  const data = show(commit, relative);
  return { path: relative, byteLength: data.length, sha256: sha(data), gitBlob: git(['rev-parse', `${commit}:${relative}`], 'utf8').trim() };
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
const candidate = parseGitJson(candidateCommit, `${evidenceRelative}/candidate.json`);
const validation = parseGitJson(candidateCommit, `${evidenceRelative}/consistency-validation.json`);
const authority = parseGitJson(candidateCommit, `${evidenceRelative}/authority.json`);
assert.equal(candidate.result, 'READY_FOR_BINDING');
assert.equal(candidate.candidateRole, 'C3V');
assert.equal(candidate.bindingRole, 'C3VB');
assert.equal(candidate.parentAuthority, BASE);
assert.equal(validation.result, 'PASS');
assert.equal(validation.authority, AGGREGATE_AUTHORITY);
assert.equal(authority.identity, AGGREGATE_AUTHORITY);
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
const resources = [
  'contracts/definitions.json', 'contracts/contract.json', 'src/constants.mjs', 'src/schema-data.mjs',
  'src/helper-protocol.mjs', 'src/runtime.mjs', 'src/helper-transport.mjs',
].map(member => gitRecord(candidateCommit, `${productRelative}/${member}`));

const binding = {
  kind: 'MO1307ProspectiveHelperAggregateBoundV2CandidateBinding', version: '1.0.0',
  result: 'FINAL_PRODUCTION_CANDIDATE_READY_FOR_PHASE3A', candidateRole: 'C3V', bindingRole: 'C3VB',
  implementation: {
    commit: candidateCommit, parent: BASE, rootTree: candidateRootTree, productionTree,
    subject: IMPLEMENTATION_SUBJECT, changedPaths: implementationPaths,
    changedPathRecords: implementationPaths.map(relative => gitRecord(candidateCommit, relative)),
  },
  binding: {
    subject: BINDING_SUBJECT, commit: null, soleParent: candidateCommit,
    selfReference: 'C3VB hash is intentionally supplied externally after creation.', productionChanges: false,
  },
  authorities: {
    helper: { identity: HELPER_AUTHORITY, valueMs: 9000 },
    aggregate: gitRecord(candidateCommit, `${evidenceRelative}/authority.json`),
    aggregateIdentity: AGGREGATE_AUTHORITY, derivedFromCandidate: C3UB,
    preservedPhase3BR2: PHASE3BR2, H: 'NOT_ESTABLISHED',
  },
  limits: candidate.limits,
  package: {
    name: 'memoryos-readiness', version: '0.1.0', contract: 'memoryos.readiness@1.0.0',
    productionTree, packageIdentity, memberCount: 89, members: normalizedMembers,
    contractMemberCount: 53, schemaCount: 52, externalProductionDependencies: 0,
  },
  helper: gitRecord(candidateCommit, `${productRelative}/helpers/windows-inspect.ps1`), resources,
  distributionManifest: gitRecord(candidateCommit, `${productRelative}/distribution-manifest.json`),
  sbom: gitRecord(candidateCommit, `${productRelative}/sbom.spdx.json`),
  validation: gitRecord(candidateCommit, `${evidenceRelative}/consistency-validation.json`),
  phase3AHandoff: gitRecord(candidateCommit, `${evidenceRelative}/phase3a-handoff.json`),
  phase3BR2Delta: gitRecord(candidateCommit, `${evidenceRelative}/phase3br2-binding-delta.json`),
  phase3CR2Delta: gitRecord(candidateCommit, `${evidenceRelative}/phase3cr2-aggregate-delta.json`),
  candidateRecord: gitRecord(candidateCommit, `${evidenceRelative}/candidate.json`),
  changedFileInventory: gitRecord(candidateCommit, `${evidenceRelative}/changed-file-inventory.json`),
  certification: false, phase3AExecuted: false, phase3BR2Rerun: false,
  phase3CR2Executed: false, phase3DExecuted: false, push: false, tag: false,
};
const bindingBytes = bytes(binding);
const verification = {
  kind: 'MO1307ProspectiveHelperAggregateBoundV2BindingVerification', version: '1.0.0', result: 'PASS',
  candidateCommit, candidateParent: BASE, candidateRootTree, productionTree,
  bindingSubject: BINDING_SUBJECT,
  binding: { path: `${evidenceRelative}/binding.json`, byteLength: bindingBytes.length, sha256: sha(bindingBytes) },
  checks: [
    'C3V_SINGLE_PARENT', 'C3V_SUBJECT', 'C3V_EXACT_CHANGED_PATHS', 'C3V_PRODUCTION_TREE',
    'PACKAGE_89_MEMBERS', 'CONTRACT_53_MEMBERS', 'SCHEMAS_52_UNCHANGED', 'ZERO_EXTERNAL_DEPENDENCIES',
    'HELPER_AUTHORITY_PRESERVED', 'AGGREGATE_AUTHORITY_BOUND', 'HELPER_BYTES_UNCHANGED',
    'RUNTIME_PROTOCOL_BYTES_UNCHANGED', 'WIRE_2_0_0', 'MANIFEST_BOUND', 'SBOM_BOUND',
    'CONSISTENCY_VALIDATION_PASS', 'PHASE3A_HANDOFF_BOUND', 'PHASE3BR2_DELTA_BOUND',
    'PHASE3CR2_DELTA_BOUND', 'C3VB_BINDING_ONLY', 'NO_SELF_HASH',
  ],
  bindingCommit: null, productionChangesInBindingCommit: false,
  certificationExecuted: false, selfDigestOmitted: true,
};

if (mode === 'build') {
  fs.mkdirSync(evidence, { recursive: true });
  write('binding.json', binding);
  write('binding-verification.json', verification);
} else {
  assert.ok(fs.readFileSync(path.join(evidence, 'binding.json')).equals(bindingBytes));
  assert.ok(fs.readFileSync(path.join(evidence, 'binding-verification.json')).equals(bytes(verification)));
  assert.equal(git(['rev-parse', `${head}:${productRelative}`], 'utf8').trim(), productionTree);
  checkPackage(product);
}
process.stdout.write(`${canonical({ result: 'PASS', mode, candidateCommit, candidateRootTree, productionTree, packageMembers: 89, productionChangesInBindingCommit: false, certificationExecuted: false })}\n`);
