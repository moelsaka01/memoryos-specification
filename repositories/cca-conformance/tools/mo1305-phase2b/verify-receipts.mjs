/** Bind Phase 2B receipt schemas and result claims to independently checked evidence. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {schemaValidator} from '../../../memoryos-rest/src/schema.mjs';
import {parseJSON} from '../../../memoryos-rest/src/json.mjs';
import {J} from '../../../memoryos-rest/src/serialization.mjs';
const root = resolve(import.meta.dirname, '../../../..');
const evidencePath = 'repositories/cca-conformance/evidence/mo1305-phase2b';
const toolsPath = 'repositories/cca-conformance/tools/mo1305-phase2b';
const packagePath = 'repositories/memoryos-rest';
const folder = resolve(root, evidencePath);
const schema = schemaValidator(JSON.parse(readFileSync(resolve(root, 'repositories/cca-conformance/schema/mo1305-receipt-2.0.0.json'))));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => {
  const bytes = readFileSync(path);
  assert.ok(bytes.length <= 2097152);
  const value = parseJSON(bytes, {bytes:2097152, depth:16, members:200000, nodes:500000,
    keyCodeUnits:128, stringCodeUnits:1048576, totalStringCodeUnits:2097152});
  assert.equal(J(value), bytes.toString('utf8'));
  return JSON.parse(bytes);
};
const local = name => read(resolve(folder, name));
function reference(path) {
  assert.match(path, /^[A-Za-z0-9_./-]{1,240}$/u);
  assert.ok(!path.startsWith('/') && path.split('/').every(p=>p && p!=='.' && p!=='..'));
  const bytes = readFileSync(resolve(root, path));
  assert.ok(bytes.length <= 16777216);
  return {path, byteLength:bytes.length, sha256:digest(bytes)};
}
const index = local('index.json');
const indexed = new Map(index.artifacts.map(row=>[row.path, row]));
assert.equal(indexed.size, index.artifacts.length);
for (const row of index.artifacts) {
  assert.match(row.path, /^repositories\/cca-conformance\/evidence\/mo1305-phase2b\/[A-Za-z0-9_.-]+\.json$/u);
  assert.deepEqual(row, reference(row.path));
}
function evidence(name) {
  const expected = reference(evidencePath + '/' + name);
  assert.deepEqual(indexed.get(expected.path), expected);
  return expected;
}
assert.deepEqual(index.archive, reference('.cache/mo1305-phase2b/build/memoryos-rest-0.1.0.tgz'));
const archiveIdentity = {byteLength:index.archive.byteLength, sha256:index.archive.sha256};
const policy = read(resolve(import.meta.dirname, 'package-allowlist.json'));
const tree = local('source-tree.json');
const generated = new Set(['dependency-manifest.json', 'sbom.spdx.json', 'distribution-manifest.json']);
const inputPaths = policy.paths.filter(name=>!generated.has(name)).map(name=>packagePath + '/' + name);
inputPaths.push(...readdirSync(import.meta.dirname).filter(name=>/\.(py|mjs|json)$/u.test(name)).map(name=>toolsPath + '/' + name));
inputPaths.push('repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1',
  'repositories/cca-conformance/tools/mo1305-phase1/regressions.py',
  'repositories/cca-conformance/schema/mo1305-receipt-2.0.0.json');
inputPaths.push(...['index.json', 'identities.json', 'prepare-policy-pass.json', 'prepare-policySet-pass.json',
  'evaluate-policy-pass.json', 'evaluate-policy-fail.json', 'verify-identity.json', 'verify-outcome.json']
  .map(name=>'repositories/cca-conformance/fixtures/mo1305-phase1/' + name));
assert.deepEqual(tree.files, inputPaths.sort().map(reference));
assert.equal(tree.sha256, digest(Buffer.from(J(tree.files))));
assert.equal(tree.sha256, index.sourceTreeSha256);
const harness = local('harness.json');
assert.deepEqual(harness.files, tree.files.filter(row=>row.path.startsWith('repositories/cca-conformance/tools/')));
const installed = local('installation-evidence.json');
assert.deepEqual(installed.archive, archiveIdentity);
const reproduction = local('reproducibility.json');
assert.deepEqual(reproduction.archive, archiveIdentity);
assert.deepEqual(reproduction.builds, Array.from({length:2}, ()=>({treeSha256:tree.sha256, archiveSha256:archiveIdentity.sha256})));
const adversarial = local('adversarial.json');
assert.deepEqual(adversarial.archive, archiveIdentity);
assert.equal(adversarial.caseCount, adversarial.cases.length);
const inventory = local('package-inventory.json');
const closure = local('runtime-closure.json');
const contracts = local('contract-artifacts.json');
const platform = local('platform.json');
const auxiliaryVersions = local('aux-tool-versions.json');
assert.deepEqual(Object.keys(auxiliaryVersions).sort(), ['openssl', 'powershell']);
assert.deepEqual(installed.tools.processVersions, policy.runtimeComponents);
assert.equal(installed.tools.node.sha256, policy.nodeSha256);
assert.equal(installed.tools.npmCli.sha256, policy.npmCliSha256);
assert.equal(installed.tools.npmVersion, '11.19.0');
assert.equal(digest(readFileSync(process.execPath)), policy.nodeSha256);
assert.equal(process.versions.node, '24.21.0');
assert.deepEqual(process.argv.slice(2, 3), ['--python']);
assert.equal(process.argv.length, 4);
const python = process.argv[3];
assert.ok(isAbsolute(python));
const clean = Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(SYSTEMROOT|WINDIR|TEMP|TMP)$/iu.test(name)));
const pythonVersion = spawnSync(python, ['-I', '-c', 'import sys;print(sys.version.split()[0])'],
  {cwd:root, env:clean, encoding:'utf8', windowsHide:true, timeout:15000, maxBuffer:4096});
assert.equal(pythonVersion.status, 0);
assert.match(pythonVersion.stdout.trim(), /^3\.\d+\.\d+$/u);
const expectedToolchain = [
  {name:'node', version:'24.21.0', sha256:policy.nodeSha256},
  {name:'npm', version:'11.19.0', sha256:policy.npmCliSha256},
  {name:'python', version:pythonVersion.stdout.trim(), sha256:digest(readFileSync(python))},
  ...['powershell', 'openssl'].map(name=>({name, version:auxiliaryVersions[name], sha256:installed.tools[name].sha256})),
].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
const projection = caseCount => ({state:'PASS', caseCount, failures:0, coldSamples:0, warmSamples:0, adverseRepetitions:0});
assert.equal(inventory.files.length, 58);
assert.equal(closure.files.length, 25);
assert.equal(Object.keys(contracts.artifacts).length, 4);
assert.equal(installed.installations.length, 2);
assert.equal(installed.installations.reduce((n,item)=>n+item.execution.requests.length,0), 20);
const groups = {
  package: [['ARCHIVE-AND-INVENTORY', inventory.files.length], ['RUNTIME-CLOSURE', closure.files.length],
    ['B1-CONTRACT-ARTIFACTS', Object.keys(contracts.artifacts).length], ['INDEPENDENT-BUILDS', reproduction.builds.length],
    ['PACKAGE-ADVERSARIAL', adversarial.cases.length], ['SBOM-NOTICES', 1]],
  installation: [['OFFLINE-INSTALLATIONS', installed.installations.length],
    ['INSTALLED-HTTP-REQUESTS', installed.installations.reduce((n,item)=>n+item.execution.requests.length,0)], ['SOURCE-INDEPENDENCE', 1]],
  supplyChain: [['PACKAGE-SPECIFIC-SUPPLY-CHAIN', 1]],
};
const commonArtifacts = ['adversarial.json', 'contract-artifacts.json', 'package-inventory.json', 'regressions.json',
  'runtime-closure.json', 'sbom-notices.json'].map(evidence);
function check(value, type) {
  assert.equal(schema('Receipt', value), true);
  assert.equal(value.type, type);
  assert.equal(value.state, 'PASS');
  assert.equal(value.implementationRevision, null);
  assert.equal(value.bindingRevision, null);
  assert.equal(value.sourceTreeSha256, index.sourceTreeSha256);
  assert.deepEqual(value.harness, evidence('harness.json'));
  assert.deepEqual(value.artifacts, commonArtifacts);
  assert.deepEqual(value.platform, platform);
  assert.deepEqual(value.toolchain, expectedToolchain);
  assert.deepEqual(value.catalog, evidence(type + '-catalog.json'));
  const results = [...groups[type]].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,count])=>({id, state:'PASS',
    expected:projection(count), actual:projection(count), artifactRefs:[]}));
  assert.deepEqual(value.results, results);
  assert.deepEqual(local(type + '-catalog.json'), {kind:'MemoryOSRESTExecutionCatalog', version:'1.0.0',
    records:results.map(row=>({id:row.id, expected:row.expected}))});
  const installation = evidence('installation-evidence.json');
  const review = evidence('supply-chain-review.json');
  const payload = type==='package' ? {archive:index.archive,
    distributionManifest:reference(packagePath + '/distribution-manifest.json'), builds:reproduction.builds,
    installation, dependencyReview:review} : type==='installation' ? {installation} : {review};
  assert.deepEqual(value.payload, payload);
}
let negatives = 0;
for (const type of ['package', 'installation', 'supplyChain']) {
  const value = local(type + '-receipt.json'); check(value, type);
  const mutations = [x=>x.unknown=true, x=>delete x.sourceTreeSha256, x=>x.payload.unknown=true,
    x=>x.results[0].actual.failures=1, x=>x.results[0].state='FAIL', x=>x.results.pop(),
    x=>x.implementationRevision='f'.repeat(40), x=>x.bindingRevision='f'.repeat(40),
    x=>x.sourceTreeSha256='0'.repeat(64), x=>x.harness.sha256='0'.repeat(64),
    x=>x.artifacts[0].sha256='0'.repeat(64), x=>x.catalog.sha256='0'.repeat(64),
    x=>x.toolchain[0].sha256='0'.repeat(64), x=>x.platform.osBuild='substituted',
    x=>{x.results[0].actual.caseCount++;x.results[0].expected.caseCount++;}];
  if (type==='package') mutations.push(x=>x.payload.archive.sha256='0'.repeat(64),
    x=>x.payload.distributionManifest.sha256='0'.repeat(64), x=>x.payload.builds[0].treeSha256='0'.repeat(64),
    x=>x.payload.installation.sha256='0'.repeat(64), x=>x.payload.dependencyReview.sha256='0'.repeat(64));
  if (type==='installation') mutations.push(x=>x.payload.installation.sha256='0'.repeat(64));
  if (type==='supplyChain') mutations.push(x=>x.payload.review.sha256='0'.repeat(64));
  for (const mutate of mutations) {
    const changed = structuredClone(value); mutate(changed);
    assert.throws(()=>check(changed, type)); negatives++;
  }
}
process.stdout.write(JSON.stringify({receipts:3, negativeWitnesses:negatives}));