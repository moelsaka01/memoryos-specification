// Engineering fixture oracle only. This module is not shipped by memoryos-readiness.
// Assertions are explicitly constructed test inputs, never discovered certification.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const out = resolve(repo, 'repositories/cca-conformance/fixtures/mo1307');
const check = process.argv.includes('--check');
const V = '1.0.0';
const H = x => 'sha256:' + createHash('sha256').update(x).digest('hex');
const sort = a => a.sort();
const by = key => (a, b) => a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
const unique = a => sort([...new Set(a)]);
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
const J = x => Buffer.from(JSON.stringify(canonical(x)) + '\n');
const D = x => H(J(x));
const clone = x => structuredClone(x);
const record = (kind, fields) => ({ kind: 'MemoryOSReadiness' + kind, version: V, ...fields });
const read = path => readFileSync(resolve(repo, path));
const json = path => JSON.parse(read(path));
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const catalog = [];
const written = new Map();
function emit(path, value, schema = null, expectation = {}) {
  const bytes = Buffer.isBuffer(value) ? value : J(value);
  if (written.has(path) && !written.get(path).equals(bytes)) throw Error('Conflicting fixture ' + path);
  written.set(path, bytes);
  if (schema) catalog.push({ id: path.replace(/\//g, '.').replace(/\.json$/, ''), path, schema, schemaValid: true, foundationValid: true, ...expectation });
  return { byteLength: bytes.length, sha256: H(bytes) };
}
const coverage = {
  SEMANTIC_CONFORMANCE: ['CONTRACT_IDENTITIES', 'EXPECTED_VECTORS', 'NORMATIVE_BYTES', 'SEMANTIC_PARITY'],
  EXECUTION_CERTIFICATION: ['NATIVE_WINDOWS', 'INSTALLED_EXECUTION', 'EXPECTED_EXITS'],
  ARTIFACT_CERTIFICATION: ['ARCHIVE_MEMBERS', 'DISTRIBUTION', 'OFFLINE_INSTALL', 'REPRODUCIBILITY', 'DOCUMENTATION', 'RELEASE_METADATA'],
  SECURITY_AUDIT: ['FILESYSTEM', 'NETWORK', 'PROCESS', 'SECRETS', 'LOGGING', 'NEGATIVE_CORPUS'],
  SUPPLY_CHAIN_REVIEW: ['RUNTIME', 'INSTALL_TOOLING', 'PRODUCTION_DEPENDENCIES', 'ENGINEERING_VALIDATORS', 'SCHEMAS', 'LICENSES_NOTICES', 'ADVISORY_DISPOSITION'],
  SBOM_VALIDATION: ['SCHEMA', 'FILE_CHECKSUMS', 'PACKAGE_RELATIONSHIPS'],
  PROVENANCE: ['SOURCE', 'BUILD_TOOLCHAIN', 'ARCHIVE_BINDING', 'SBOM_BINDING'],
  RESOURCE_VALIDATION: ['INPUT_BOUNDS', 'OUTPUT_BOUNDS', 'DEADLINES', 'MEMORY_CHARACTERIZATION', 'BOUNDARY_ENFORCEMENT'],
  PROVIDER_CERTIFICATION: ['IMPLEMENTATION', 'OFFLINE_CONTRACT', 'EXECUTION_SCOPE'],
  HISTORICAL_DISPOSITION: ['HISTORY_COMPLETE', 'DISPOSITION_AUTHORITY', 'RECURRENCE_ACCOUNTED'],
  SCOPE_AUTHORITY: ['PROFILE_MATCH', 'QUALIFICATIONS_COMPLETE', 'ASSUMPTIONS_CURRENT'],
  FINAL_BINDING: ['CANDIDATE_CLOSURE', 'RECEIPT_CLOSURE', 'ACYCLIC_BINDING'],
  REST_CONTRACT: ['OPENAPI', 'SIX_SEMANTIC_OPERATIONS', 'THREE_OPERATIONAL_ENDPOINTS', 'TLS_AUTH', 'SAME_HOST_REMOTE'],
  TAG_OBSERVATION: ['OBSERVATION_COMPLETE'],
};
const roles = {
  SEMANTIC_CONFORMANCE: ['SOURCE_MEMBER', 'RUNTIME_CLOSURE', 'RUNTIME', 'SCHEMA', 'CONFIGURATION'],
  EXECUTION_CERTIFICATION: ['SOURCE_MEMBER', 'ARCHIVE', 'RUNTIME_CLOSURE', 'RUNTIME', 'CONFIGURATION'],
  ARTIFACT_CERTIFICATION: ['ARCHIVE', 'DISTRIBUTION', 'TOOLCHAIN', 'DOCUMENTATION'],
  SECURITY_AUDIT: ['SOURCE_MEMBER', 'SECURITY_CONTROL', 'CONFIGURATION', 'RUNTIME'],
  SUPPLY_CHAIN_REVIEW: ['RUNTIME', 'TOOLCHAIN', 'RUNTIME_CLOSURE', 'SCHEMA', 'DISTRIBUTION'],
  SBOM_VALIDATION: ['SBOM', 'ARCHIVE', 'DISTRIBUTION', 'SCHEMA'],
  PROVENANCE: ['PROVENANCE', 'ARCHIVE', 'SBOM', 'SOURCE_MEMBER', 'TOOLCHAIN'],
  RESOURCE_VALIDATION: ['SOURCE_MEMBER', 'RUNTIME', 'CONFIGURATION', 'SECURITY_CONTROL'],
  PROVIDER_CERTIFICATION: ['ADAPTER', 'CONFIGURATION', 'RUNTIME', 'SECURITY_CONTROL'],
  HISTORICAL_DISPOSITION: ['SOURCE_MEMBER', 'CONFIGURATION'],
  SCOPE_AUTHORITY: ['SOURCE_MEMBER', 'CONFIGURATION'],
  REST_CONTRACT: ['SOURCE_MEMBER', 'SCHEMA', 'CONFIGURATION', 'SECURITY_CONTROL'],
  FINAL_BINDING: [], TAG_OBSERVATION: [],
};
const gateTypes = {
  artifact: 'ARTIFACT_CERTIFICATION', binding: 'FINAL_BINDING', history: 'HISTORICAL_DISPOSITION', provenance: 'PROVENANCE',
  'provider.azure': 'PROVIDER_CERTIFICATION', 'provider.azure.live': 'PROVIDER_CERTIFICATION', 'provider.generic': 'PROVIDER_CERTIFICATION',
  'provider.github': 'PROVIDER_CERTIFICATION', 'provider.github.hosted': 'PROVIDER_CERTIFICATION', 'provider.gitlab': 'PROVIDER_CERTIFICATION',
  'provider.gitlab.live': 'PROVIDER_CERTIFICATION', 'provider.jenkins': 'PROVIDER_CERTIFICATION', 'provider.jenkins.live': 'PROVIDER_CERTIFICATION',
  resources: 'RESOURCE_VALIDATION', 'rest.contract': 'REST_CONTRACT', sbom: 'SBOM_VALIDATION', scope: 'SCOPE_AUTHORITY', security: 'SECURITY_AUDIT',
  semantic: 'SEMANTIC_CONFORMANCE', supply: 'SUPPLY_CHAIN_REVIEW', tag: 'TAG_OBSERVATION', windows: 'EXECUTION_CERTIFICATION',
};
const gateIds = Object.keys(gateTypes).sort();
const providers = ['azure', 'generic', 'github', 'gitlab', 'jenkins'];
const component = (id, role, bytes) => ({ id, role, byteLength: bytes.length, sha256: H(bytes) });
const syntheticComponents = () => ['SOURCE_MEMBER', 'ARCHIVE', 'DISTRIBUTION', 'CONFIGURATION', 'SBOM', 'PROVENANCE', 'RUNTIME_CLOSURE', 'RUNTIME', 'TOOLCHAIN', 'SCHEMA', 'SECURITY_CONTROL', 'DOCUMENTATION'].map(role => component(role.toLowerCase().replaceAll('_', '-'), role, Buffer.from('synthetic fixture ' + role + '\n')));
function syntheticCandidate(profile = 'cicd') {
  const components = syntheticComponents();
  if (profile === 'cicd') for (const id of providers) components.push(component('adapter.' + id, 'ADAPTER', Buffer.from('synthetic adapter ' + id + '\n')));
  return record('Candidate', {
    product: { name: profile === 'cicd' ? 'memoryos-ci' : 'memoryos-rest', version: '0.1.0' }, profile: { id: profile, version: V },
    source: { commit: '1'.repeat(40), tree: '2'.repeat(40) }, components: components.sort(by('id')),
    semanticContracts: [{ id: 'memoryos.policy', version: V, sha256: H(Buffer.from('synthetic semantic identity')) }],
    providers: profile === 'cicd' ? providers.map(id => ({ id, adapterVersion: '0.1.0', componentId: 'adapter.' + id })) : [],
    expectedTag: { name: 'memoryos-fixture', target: '3'.repeat(40) }, remoteScope: profile === 'cicd' ? 'NOT_APPLICABLE' : 'SAME_HOST_RFC1918',
  });
}
function providerDetail(provider, qualified = false) {
  const execution = provider === 'generic' ? 'REAL_EXECUTION_CERTIFIED' : provider === 'github' ? qualified ? 'HOSTED_EXECUTION_NOT_CERTIFIED' : 'HOSTED_EXECUTION_CERTIFIED' : qualified ? 'NOT_LIVE_PROVIDER_CERTIFIED' : 'LIVE_PROVIDER_CERTIFIED';
  return { provider, implementation: 'IMPLEMENTED', validation: provider === 'generic' ? 'REAL_EXECUTION_CERTIFIED' : provider === 'github' ? 'OFFLINE_VALIDATED' : 'CONTRACT_VALIDATED', execution,
    sourceExecutionLabel: provider === 'github' && qualified ? 'NOT_CERTIFIED' : execution,
    support: qualified && provider !== 'generic' ? provider === 'github' ? 'SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION' : 'SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY' : 'SUPPORTED',
    hostedCases: provider === 'github' ? { pass: !qualified, fail: !qualified, cne: !qualified, parity: !qualified } : null };
}
function qualification(id, reasonCode, gateIds, scopeId, provider = null, conditionIds = []) {
  return { id, type: 'MemoryOSReadinessQualification', version: V, gateIds: sort(gateIds), provider, scopeId, reasonCode,
    impact: ['PLATFORM_NOT_REQUIRED', 'ENVIRONMENT_LIMITATION'].includes(reasonCode) ? 'INFORMATIONAL' : 'RELEASE_IMPACTING', disclosureCode: reasonCode, conditionIds: sort(conditionIds) };
}
const B = '332ab0d2c35643ea8d155bcbea9c5019b304bbe3';
const TAG = '9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8';
const C = '701d48ee2012675966360dda775ab13013c09ab9';
const legacyBase = 'repositories/cca-conformance/evidence/mo1306/phase3d/';

function releasedMaterial() {
  const pkg = json(legacyBase + 'package.json');
  const prov = json(legacyBase + 'provenance.json');
  const preservation = json('repositories/cca-conformance/evidence/mo1306/scope-correction/preservation.json');
  const historySource = json(legacyBase + 'history.json');
  const sourceRecords = [];
  const add = (id, path, expected = null) => {
    const bytes = read(path);
    if (expected && (bytes.length !== expected.byteLength || H(bytes) !== expected.sha256)) throw Error('Predecessor bytes changed: ' + path);
    sourceRecords.push({ id, originalPath: path, bytes });
    return { id, role: null, byteLength: bytes.length, sha256: H(bytes) };
  };
  for (const name of ['package', 'provenance', 'sbom', 'sbom-validation', 'native-binding', 'history', 'closure-matrix', 'dependency-delta', '3b-dependency-matrix', '3c-dependency-matrix']) add('released.' + name, legacyBase + name + (name === 'sbom' ? '.spdx' : '') + '.json');
  add('released.inventory', 'repositories/cca-conformance/mo1306-final-release-inventory.json');
  add('released.scope', 'repositories/cca-conformance/mo1306-hosted-scope-correction.json');
  add('released.methodology', 'repositories/cca-conformance/mo1306-unresolved-observation-methodology.json');
  add('released.native-receipt', 'repositories/cca-conformance/evidence/mo1306/scope-correction/preserved/0171.data');
  add('released.native-reuse', 'repositories/cca-conformance/evidence/mo1306/scope-correction/preserved/0187.data');
  // All nineteen original rows are retained, including the seven successful/authority rows.
  for (const h of historySource.records) add('history-source.' + h.id, h.evidence.path, h.evidence);
  const configurations = preservation.files.filter(x => x.originalPath.endsWith('/memoryos-ci.json')).map((x, i) => {
    add('configuration-source.' + i, x.file.path, x.file);
    return { originalPath: x.originalPath, byteLength: x.file.byteLength, sha256: x.file.sha256 };
  }).sort(by('originalPath'));
  const configBytes = J({ kind: 'MO1306ReviewedConfigurationInventory', version: V, configurations });
  sourceRecords.push({ id: 'released.configuration-inventory', originalPath: null, bytes: configBytes });
  const toolBytes = J({ kind: 'MO1306ReviewedToolchainInventory', version: V, toolchain: prov.toolchain, engineeringValidators: prov.engineeringValidators });
  sourceRecords.push({ id: 'released.toolchain-inventory', originalPath: null, bytes: toolBytes });
  const components = [];
  const componentMap = [];
  for (const f of pkg.files) {
    // Every reviewed package member is represented. Extra role aliases preserve complete source coverage.
    const id = 'member.' + createHash('sha256').update(f.path).digest('hex').slice(0, 16);
    components.push({ id, role: 'SOURCE_MEMBER', byteLength: f.byteLength, sha256: f.sha256 });
    componentMap.push({ id, path: f.path, role: 'SOURCE_MEMBER', byteLength: f.byteLength, sha256: f.sha256 });
    let role = f.path.startsWith('schemas/') ? 'SCHEMA' : /\.md$/.test(f.path) ? 'DOCUMENTATION' : f.path === 'contracts/limits.json' || /(?:filesystem|path|process|bootstrap|worker|publication)/i.test(f.path) && /\.(mjs|ps1)$/.test(f.path) ? 'SECURITY_CONTROL' : null;
    if (role) { const alias = { id: role.toLowerCase().replaceAll('_', '-') + '.' + id.slice(7), role, byteLength: f.byteLength, sha256: f.sha256 }; components.push(alias); componentMap.push({ ...alias, path: f.path }); }
  }
  const from = (id, role, f) => components.push({ id, role, byteLength: f.byteLength, sha256: f.sha256 });
  from('archive', 'ARCHIVE', pkg.archive); from('distribution', 'DISTRIBUTION', pkg.distribution); from('runtime-closure', 'RUNTIME_CLOSURE', pkg.sdkManifest); from('runtime', 'RUNTIME', prov.nodeUsed);
  for (const id of providers) from('adapter.' + id, 'ADAPTER', pkg.files.find(f => f.path === 'src/providers/' + id + '.mjs'));
  for (const [id, role] of [['sbom', 'SBOM'], ['provenance', 'PROVENANCE']]) { const path = legacyBase + id + (id === 'sbom' ? '.spdx' : '') + '.json'; from(id, role, { byteLength: read(path).length, sha256: H(read(path)) }); }
  components.push(component('configuration', 'CONFIGURATION', configBytes), component('toolchain', 'TOOLCHAIN', toolBytes));
  const semantics = json('repositories/memoryos-ci/contracts/policy-contract-identities-1.0.0.json');
  const semanticContracts = [
    { id: 'memoryos.policy.fact-model', version: semantics.factModel.factModelVersion, sha256: semantics.factModel.factModelDigest },
    { id: 'memoryos.policy.rule-registry', version: semantics.ruleRegistry.ruleRegistryVersion, sha256: semantics.ruleRegistry.ruleRegistryDigest },
    { id: 'memoryos.policy.resource-profile.standard', version: semantics.resourceProfile.version, sha256: semantics.resourceProfile.resourceProfileDigest },
    { id: 'memoryos.policy.deterministic-fact-sources', version: semantics.deterministicFactSourceRegistry.registryVersion, sha256: semantics.deterministicFactSourceRegistry.registryDigest },
    { id: 'memoryos.regression.source-model', version: semantics.deterministicFactSourceRegistry.sources[0].sourceModelVersion, sha256: semantics.deterministicFactSourceRegistry.sources[0].sourceModelDigest },
  ].sort(by('id'));
  add('released.semantic-identities', 'repositories/memoryos-ci/contracts/policy-contract-identities-1.0.0.json');
  const candidate = record('Candidate', { product: { name: 'memoryos-ci', version: '0.1.0' }, profile: { id: 'cicd', version: V }, source: { commit: C, tree: git(['rev-parse', C + '^{tree}']) },
    components: components.sort(by('id')), semanticContracts, providers: providers.map(id => ({ id, adapterVersion: '0.1.0', componentId: 'adapter.' + id })), expectedTag: { name: 'memoryos-1.3-mo1306', target: B }, remoteScope: 'NOT_APPLICABLE' });
  return { candidate, sourceRecords, historySource, componentMap };
}

// Construct only known fixture cases. This is not a general evaluation algorithm.
function buildBundle(name, options = {}) {
  const prefix = 'bundles/' + name + '/';
  const material = options.released ? releasedMaterial() : null;
  const candidate = clone(options.candidate ?? material?.candidate ?? syntheticCandidate(options.profile));
  const candidateDigest = D(candidate);
  const scopeId = options.released ? 'mo1306.released.qualified' : 'fixture.scope';
  const stage = options.stage ?? (options.released ? 'POST_TAG_VERIFICATION' : 'PRE_TAG_READINESS');
  const assumptions = [];
  const sourceRecords = options.sourceRecords ?? material?.sourceRecords ?? [{ id: 'fixture.source', originalPath: null, bytes: J({ fixtureOnly: true, semanticVectors: ['PASS', 'FAIL', 'CNE', 'INPUT_ERROR/11'], expectedVectorsMatched: true }) }];
  const provenance = [];
  const entries = [];
  function entry(id, type, path, bytes, sourceKind, sourceVersion, authorityClass, gitBinding = null) {
    const identity = emit(prefix + path, bytes);
    const result = { id, type, sourceKind, sourceVersion, path, ...identity, candidateBinding: null, dependencyIds: [], authorityClass, git: gitBinding };
    entries.push(result); return result;
  }
  for (const src of sourceRecords) {
    let shape; try { shape = JSON.parse(src.bytes); } catch { shape = {}; }
    entry(src.id, 'SOURCE', 'sources/' + src.id + '.data', src.bytes, typeof shape.kind === 'string' ? shape.kind : 'legacy.' + (src.bytes[0] === 123 ? 'json' : 'text'), typeof shape.version === 'string' ? shape.version : 'unversioned', 'UNTRUSTED_SOURCE');
  }
  const authorityPaths = options.released ? [
    ['authority.release', 'docs/mo1306-phase3d-qualified-release.md'],
    ['authority.methodology', 'docs/mo1306-phase3-unresolved-observation-methodology.md'],
    ['authority.scope', 'docs/mo1306-hosted-certification-scope-correction.md'],
  ] : [['authority.fixture', null]];
  for (const [id, path] of authorityPaths) {
    const bytes = path ? read(path) : Buffer.from('Synthetic MO1307 fixture authority. No real product certification or release authorization.\n');
    const revision = options.released ? B : '4'.repeat(40);
    const tree = options.released ? git(['rev-parse', B + '^{tree}']) : '5'.repeat(40);
    const blob = options.released ? git(['rev-parse', B + ':' + path]) : '6'.repeat(40);
    const classification = options.released ? 'RELEASED_BINDING' : 'CURRENT_CONFORMANCE_BINDING';
    const source = { id, classification, revision, tree, path: path ?? 'fixtures/mo1307/synthetic-authority.txt', blob, byteLength: bytes.length, sha256: H(bytes), releaseTag: options.released ? { name: 'memoryos-1.3-mo1306', object: TAG, target: B } : null };
    provenance.push(source);
    entry(id, 'AUTHORITY_SOURCE', 'authority-sources/' + id + '.data', bytes, 'legacy.text', 'unversioned', classification, { revision, tree, blob, path: source.path });
  }
  provenance.sort(by('id'));
  const authoritySourceIds = provenance.map(x => x.id);
  const qualifications = [];
  if (options.qualified || options.released) {
    for (const p of providers.filter(x => x !== 'generic')) qualifications.push(qualification('q.provider.' + p, p === 'github' ? 'HOSTED_NOT_CERTIFIED' : 'PROVIDER_NOT_LIVE_CERTIFIED', ['provider.' + p, 'provider.' + p + (p === 'github' ? '.hosted' : '.live')], scopeId, p));
    qualifications.push(qualification('q.advisory', 'BOUNDED_ADVISORY_REVIEW', ['supply'], scopeId));
  }
  if (candidate.profile.id === 'rest') qualifications.push(qualification('q.remote', 'SAME_HOST_REMOTE_ONLY', ['rest.contract'], scopeId));
  if (options.informational) qualifications.push(qualification('q.environment', 'ENVIRONMENT_LIMITATION', ['windows'], scopeId));
  const history = [];
  if (material) for (const row of material.historySource.records.filter(x => x.historicalFailureOrUnclosedGate)) {
    const unresolved = /native-publication|publication-diagnostics|publication-environment|hosted-|diagnostic-363/.test(row.id);
    const hosted = /hosted-|diagnostic-363/.test(row.id);
    const h = { id: 'history.' + row.id, originalOutcome: row.disposition.startsWith('FAIL') ? 'FAIL' : /BLOCKED|OPEN_FINDINGS|ACCEPTANCE_REQUIRED/.test(row.disposition) ? 'BLOCKED' : 'UNEVALUABLE', originalDisposition: row.disposition,
      sourceIds: ['history-source.' + row.id, 'released.history'].sort(), conditionId: 'condition.' + row.id,
      disposition: unresolved ? 'PRESERVED_WITH_QUALIFICATION' : 'SUPERSEDED', affectedGateIds: unresolved ? hosted ? ['provider.github', 'provider.github.hosted'] : ['windows'] : [], authoritySourceIds,
      recurrence: unresolved && !hosted ? 'NOT_OBSERVED' : 'NOT_APPLICABLE' };
    history.push(h);
    if (unresolved) qualifications.push(qualification('q.history.' + row.id, 'HISTORICAL_UNRESOLVED_PRESERVED', clone(h.affectedGateIds), scopeId, null, [h.conditionId]));
  }
  if (options.historyRecurrence) {
    history.push({ id: 'historical-negative', originalOutcome: 'FAIL', originalDisposition: 'FAIL / UNRESOLVED', sourceIds: ['fixture.source'], conditionId: 'condition.recurrence', disposition: 'CURRENT_APPLICABLE', affectedGateIds: ['security'], authoritySourceIds, recurrence: 'OBSERVED' });
  }
  history.sort(by('id')); qualifications.sort(by('id'));
  const envelopes = [];
  const grants = [];
  const selections = new Map();
  const inactive = id => id.startsWith('provider.') && candidate.profile.id !== 'cicd' || id === 'rest.contract' && candidate.profile.id !== 'rest';
  const optional = id => /\.(live|hosted)$/.test(id);
  const parent = id => optional(id) ? id.replace(/\.(live|hosted)$/, '') : id;
  for (const gateId of gateIds.filter(id => !inactive(id) && !optional(id) && id !== options.unavailable)) {
    const type = gateTypes[gateId];
    const p = gateId.startsWith('provider.') ? gateId.split('.')[1] : null;
    const whole = ['FINAL_BINDING', 'TAG_OBSERVATION'].includes(type);
    const dependencies = candidate.components.filter(c => roles[type].includes(c.role) && (c.role !== 'ADAPTER' || c.id === candidate.providers.find(x => x.id === p)?.componentId)).map(({ id: componentId, ...r }) => ({ componentId, ...r }));
    const detail = type === 'SEMANTIC_CONFORMANCE' ? { contractIds: candidate.semanticContracts.map(x => x.id) } : type === 'EXECUTION_CERTIFICATION' ? { platform: 'windows11-x64', runtimeComponent: candidate.components.find(x => x.role === 'RUNTIME').id } : type === 'SUPPLY_CHAIN_REVIEW' ? { reviewScope: options.qualified || options.released ? 'BOUNDED_SNAPSHOT' : 'DECLARED_INVENTORY_COMPLETE' } : type === 'PROVIDER_CERTIFICATION' ? providerDetail(p, options.qualified || options.released) : type === 'HISTORICAL_DISPOSITION' ? { records: history } : type === 'SCOPE_AUTHORITY' ? { qualificationIds: qualifications.map(x => x.id), conditionIds: history.map(x => x.conditionId).sort() } : type === 'FINAL_BINDING' ? { target: candidate.expectedTag.target } : type === 'REST_CONTRACT' ? { remoteScope: 'SAME_HOST_RFC1918' } : type === 'TAG_OBSERVATION' ? options.tag ?? (stage === 'POST_TAG_VERIFICATION' ? { name: candidate.expectedTag.name, presence: 'PRESENT', object: options.released ? TAG : '7'.repeat(40), annotated: true, peeledTarget: candidate.expectedTag.target } : { name: candidate.expectedTag.name, presence: 'ABSENT', object: null, annotated: null, peeledTarget: null }) : {};
    const failed = options.failedGate === gateId ? [coverage[type][0]] : [];
    const unevaluable = options.unevaluableGate === gateId ? [coverage[type].at(-1)] : [];
    const q = qualifications.filter(x => x.gateIds.includes(gateId) || type === 'HISTORICAL_DISPOSITION' && x.conditionIds.length > 0);
    const sourceIds = options.released ? type === 'HISTORICAL_DISPOSITION' ? unique(['released.history', ...history.flatMap(x => x.sourceIds), ...material.historySource.records.map(x => 'history-source.' + x.id)]) : sourceRecords.filter(x => x.id.startsWith('released.')).map(x => x.id).sort() : options.bindAllSourcesToArtifact && gateId === 'artifact' ? sourceRecords.map(x => x.id).sort() : ['fixture.source'];
    // Bind the preserved raw configuration receipts to each claim that depends
    // on their reviewed CONFIGURATION inventory; source lineage is audit-only.
    if (options.released && dependencies.some(d => d.role === 'CONFIGURATION')) {
      sourceIds.push(...sourceRecords.filter(s => s.id.startsWith('configuration-source.')).map(s => s.id));
      sourceIds.sort();
    }
    const claim = { type, version: V, originCandidate: options.reusedGate === gateId ? options.originCandidate : candidateDigest, binding: whole ? 'WHOLE_CANDIDATE' : 'DEPENDENCY_SET', dependencies, scopeId, assumptions,
      passed: coverage[type].filter(x => !failed.includes(x) && !unevaluable.includes(x)).sort(), failed: sort(failed), unevaluable: sort(unevaluable), verdict: failed.length ? 'FAIL' : unevaluable.length ? 'UNEVALUABLE' : 'PASS', detail, qualifications: q };
    const envelope = record('Evidence', { claim, sources: sourceIds, metadata: { observedAt: null, runId: options.metadata ?? null, locator: options.locatorByGate?.[gateId] ?? null } });
    const envelopeId = 'envelope.' + gateId;
    const e = entry(envelopeId, 'ENVELOPE', 'envelopes/' + gateId + '.json', J(envelope), 'memoryos-readiness-evidence', V, 'GRANTED_CLAIM');
    e.candidateBinding = claim.originCandidate; e.dependencyIds = dependencies.map(x => x.componentId);
    catalog.push({ id: prefix.replaceAll('/', '.') + envelopeId, path: prefix + e.path, schema: 'evidence', schemaValid: true, foundationValid: true });
    const grant = { id: 'grant.' + gateId, claimDigest: D(claim), envelopeId, envelopeSha256: e.sha256, sourceIds, authoritySourceIds, dependencyIds: e.dependencyIds, scopeId, assumptions, applicability: options.reusedGate === gateId ? 'REUSED' : 'CURRENT' };
    grants.push(grant); envelopes.push(envelope); selections.set(gateId, { grant, claim });
  }
  grants.sort(by('id'));
  const slots = gateIds.map(gateId => ({ gateId, grantIds: inactive(gateId) || parent(gateId) === options.unavailable ? [] : [selections.get(parent(gateId)).grant.id], availability: !inactive(gateId) && parent(gateId) === options.unavailable ? 'UNAVAILABLE' : 'AVAILABLE', reason: !inactive(gateId) && parent(gateId) === options.unavailable ? 'MISSING' : null }));
  const manifest = record('Manifest', { candidateDigest, entries: entries.sort(by('id')) });
  const authority = record('Authority', { assessment: { candidateDigest, profile: candidate.profile, stage, scopeId, assumptions, requiredComponents: candidate.components, semanticContracts: candidate.semanticContracts, grants, slots }, provenance, manifestSha256: D(manifest) });
  const config = record('Configuration', { profile: candidate.profile, stage, candidate: 'candidate.json', manifest: 'manifest.json' });
  emit(prefix + 'candidate.json', candidate, 'candidate'); emit(prefix + 'manifest.json', manifest, 'manifest'); emit(prefix + 'authority.json', authority, 'authority'); emit(prefix + 'configuration.json', config, 'configuration');
  const normalized = grant => ({ claimDigest: grant.claimDigest, dependencyIds: grant.dependencyIds, scopeId: grant.scopeId, assumptions: grant.assumptions, applicability: grant.applicability, authorityClasses: unique(grant.authoritySourceIds.map(id => provenance.find(x => x.id === id).classification)) });
  const grantDigests = new Map(grants.map(g => [g.id, D(normalized(g))]));
  const nodeMap = new Map(); const edgeMap = new Map();
  function node(type, content) { const digest = type === 'ASSESSMENT' ? null : D(content); const id = type === 'ASSESSMENT' ? 'assessment' : type + ':' + digest; nodeMap.set(id, { id, type, digest }); return id; }
  function edge(from, type, to) { const e = { from, type, to }; edgeMap.set(from + '\0' + type + '\0' + to, e); }
  const aNode = node('ASSESSMENT'); const cNode = node('CANDIDATE', candidate); edge(aNode, 'ASSESSES', cNode);
  for (const { grant, claim } of selections.values()) {
    const gNode = node('GRANT', normalized(grant)); const claimNode = node('CLAIM', claim); edge(aNode, 'ACCEPTS', gNode); edge(gNode, 'AUTHORIZES', claimNode);
    for (const classification of normalized(grant).authorityClasses) edge(gNode, 'ROOTED_IN', node('AUTHORITY', { classification, scopeId, assumptions }));
    if (claim.binding === 'WHOLE_CANDIDATE') edge(claimNode, 'DEPENDS_ON', cNode);
    else for (const { componentId: id, ...rest } of claim.dependencies) edge(claimNode, 'DEPENDS_ON', node('DEPENDENCY', { id, ...rest }));
  }
  const graph = record('Graph', { nodes: [...nodeMap.values()].sort(by('id')), edges: [...edgeMap.values()].sort((a, b) => by('from')(a, b) || by('type')(a, b) || by('to')(a, b)) });
  const normalizedSlots = slots.map(({ grantIds, ...s }) => ({ ...s, grantDigests: unique(grantIds.map(id => grantDigests.get(id))) }));
  const authorityIdentityDigest = D({ candidateDigest, profile: candidate.profile, stage, scopeId, assumptions, requiredComponents: candidate.components, semanticContracts: candidate.semanticContracts, normalizedGrants: unique(grants.map(g => grantDigests.get(g.id))), slots: normalizedSlots });
  const derivedQualifications = qualifications.map(q => ({ ...q, candidateDigest, evidenceClaimDigests: unique([...selections.values()].filter(s => s.claim.qualifications.some(x => x.id === q.id)).map(s => D(s.claim))), grantDigests: unique([...selections.values()].filter(s => s.claim.qualifications.some(x => x.id === q.id)).map(s => grantDigests.get(s.grant.id))) }));
  const blockers = []; const cneReasons = [];
  const gates = gateIds.map(id => {
    const selected = selections.get(parent(id));
    const result = { id, version: V, mandatory: !optional(id), applicable: !inactive(id), state: inactive(id) ? 'NOT_APPLICABLE' : optional(id) ? 'NOT_REQUIRED' : 'SATISFIED', claimDigest: selected && !inactive(id) ? D(selected.claim) : null, grantDigest: selected && !inactive(id) ? grantDigests.get(selected.grant.id) : null, blockerIds: [], qualificationIds: [], cneReasons: [] };
    if (inactive(id)) return result;
    result.qualificationIds = qualifications.filter(q => q.gateIds.includes(id)).map(x => x.id);
    if (optional(id)) return result;
    if (id === options.unavailable) { result.cneReasons.push({ gateId: id, reason: 'MISSING', checkCode: null }); result.state = 'COULD_NOT_EVALUATE'; }
    if (selected) {
      for (const checkCode of selected.claim.failed) addBlocker(id, 'CHECK_FAILED', checkCode, null, selected, result);
      for (const checkCode of selected.claim.unevaluable) result.cneReasons.push({ gateId: id, reason: 'UNEVALUABLE', checkCode });
      if (id === 'tag') {
        const tag = selected.claim.detail;
        if (tag.name !== candidate.expectedTag.name) addBlocker(id, 'TAG_CONDITION_UNMET', 'TAG_NAME', null, selected, result);
        if (stage === 'PRE_TAG_READINESS' && tag.presence !== 'ABSENT' || stage === 'POST_TAG_VERIFICATION' && tag.presence !== 'PRESENT') addBlocker(id, 'TAG_CONDITION_UNMET', 'TAG_PRESENCE', null, selected, result);
        if (stage === 'POST_TAG_VERIFICATION' && tag.presence === 'PRESENT') {
          if (!tag.annotated) addBlocker(id, 'TAG_CONDITION_UNMET', 'TAG_ANNOTATION', null, selected, result);
          if (tag.peeledTarget !== candidate.expectedTag.target) addBlocker(id, 'TAG_CONDITION_UNMET', 'TAG_TARGET', null, selected, result);
        }
      }
    }
    for (const h of history.filter(h => (h.disposition === 'CURRENT_APPLICABLE' || h.recurrence === 'OBSERVED') && h.affectedGateIds.includes(id))) addBlocker(id, 'CONDITION_UNSATISFIED', 'HISTORICAL_CONDITION', h.conditionId, selections.get('history'), result);
    result.state = result.blockerIds.length ? 'BLOCKED' : result.cneReasons.length ? 'COULD_NOT_EVALUATE' : result.qualificationIds.some(qid => qualifications.find(q => q.id === qid).impact === 'RELEASE_IMPACTING') ? 'SATISFIED_WITH_QUALIFICATION' : 'SATISFIED';
    sort(result.blockerIds); result.cneReasons.sort((a, b) => by('reason')(a, b) || by('checkCode')(a, b)); cneReasons.push(...result.cneReasons); return result;
  });
  function addBlocker(gateId, reasonCode, checkCode, conditionId, selected, gate) {
    const id = 'blocker.' + D({ gateId, reasonCode, checkCode, conditionId }).slice(7);
    blockers.push({ id, gateId, reasonCode, checkCode, claimDigest: selected ? D(selected.claim) : null, grantDigest: selected ? grantDigests.get(selected.grant.id) : null, candidateDigest, conditionId }); gate.blockerIds.push(id);
  }
  blockers.sort(by('id'));
  const historyProjection = history.map(({ sourceIds, authoritySourceIds, ...h }) => ({ ...h, claimDigest: D(selections.get('history').claim), grantDigest: grantDigests.get(selections.get('history').grant.id) }));
  const readiness = blockers.length ? 'NOT_READY' : cneReasons.length ? 'COULD_NOT_EVALUATE' : qualifications.some(q => q.impact === 'RELEASE_IMPACTING') ? 'READY_WITH_QUALIFICATIONS' : 'READY';
  const assessment = { contract: { id: 'memoryos.readiness', version: V }, candidate, candidateDigest, profile: candidate.profile, stage, authorityIdentityDigest, readiness, gates, blockers, qualifications: derivedQualifications, cneReasons, history: historyProjection,
    providers: [...selections.entries()].filter(([id]) => id.startsWith('provider.')).map(([, s]) => s.claim.detail).sort(by('provider')), graph, graphDigest: D(graph), requiredHumanActions: ['REVIEW_READINESS_AND_LIMITATIONS', 'DECIDE_RELEASE'] };
  const audit = { trustedAuthorityDigest: D(authority), manifestSha256: D(manifest), candidateFileSha256: candidateDigest, configurationSha256: D(config), inputs: entries, authoritySources: provenance, bindings: grants.map(g => ({ grantId: g.id, grantDigest: grantDigests.get(g.id), claimDigest: g.claimDigest, envelopeId: g.envelopeId, envelopeSha256: g.envelopeSha256, sourceIds: g.sourceIds, authoritySourceIds: g.authoritySourceIds })) };
  const readinessDigest = D(record('Identity', { assessment })); const proofBindingDigest = D(record('ProofBinding', { readinessDigest, audit }));
  const result = record('Result', { assessment, readinessDigest, audit, proofBindingDigest });
  const summary = record('Summary', { operation: 'evaluate', readiness, readinessDigest, proofBindingDigest, blockerCount: blockers.length, qualificationCount: qualifications.length, cneCount: cneReasons.length, decision: null });
  emit(prefix + 'expected-result.json', result, 'result'); emit(prefix + 'expected-summary.json', summary, 'summary'); emit(prefix + 'expected-graph.json', graph, 'graph');
  emit(prefix + 'pins.json', { expectedCandidateDigest: candidateDigest, trustedAuthorityDigest: D(authority), expectedReadiness: readiness, expectedReadinessDigest: readinessDigest, expectedProofBindingDigest: proofBindingDigest, expectedExit: { READY: 0, READY_WITH_QUALIFICATIONS: 2, NOT_READY: 3, COULD_NOT_EVALUATE: 4 }[readiness] });
  if (material) emit(prefix + 'predecessor-map.json', { fixtureOnly: true, production: C, methodology: '85a0f85c1ebd013c545ccf2b3efe58a760e6cf37', scope: '6e562c578f86022ee28911f7b91a8b3aa209da17', immutableInventory: 'f8e19fc5427cf3acfe60d5e2717dc87d0c74e04a', finalBinding: B, tagObject: TAG, sourceRowCount: 19, normalizedNegativeRowCount: 12, packageMemberCount: 94, componentMap: material.componentMap,
    sources: sourceRecords.map(s => ({ id: s.id, originalPath: s.originalPath, path: 'sources/' + s.id + '.data', byteLength: s.bytes.length, sha256: H(s.bytes), interpretation: s.originalPath === null ? 'ENGINEERING_NORMALIZED_INVENTORY' : 'EXACT_RELEASED_BYTES' })).sort(by('id')) });
  return { name, prefix, candidate, authority, manifest, config, result, graph, envelopes, history, qualifications };
}

// Optional disposable characterization input. It is deliberately outside the
// tracked fixture catalog and never changes the normal deterministic outputs.
if (process.argv.includes('--maximum-dir')) {
  const argument = process.argv[process.argv.indexOf('--maximum-dir') + 1];
  const target = resolve(repo, argument ?? '');
  const permitted = resolve(repo, '.cache/mo1307/phase1/characterization-inputs');
  if (!argument || !target.startsWith(permitted + '\\') && !target.startsWith(permitted + '/')) throw Error('Maximum output must be under .cache/mo1307/phase1/characterization-inputs');
  const candidate = syntheticCandidate();
  for (let i = candidate.components.length; i < 1024; i++) candidate.components.push(component('source.' + String(i).padStart(13, '0'), 'SOURCE_MEMBER', Buffer.from('maximum source ' + i + '\n')));
  candidate.components.sort(by('id'));
  const sourceRecords = [{ id: 'fixture.source', originalPath: null, bytes: Buffer.from('Synthetic bounded maximum characterization source.\n') }];
  for (let i = 1; i < 110; i++) sourceRecords.push({ id: 'padding.' + String(i).padStart(3, '0'), originalPath: null, bytes: Buffer.from('x') });
  const options = { candidate, sourceRecords, bindAllSourcesToArtifact: true };
  const reset = () => { written.clear(); catalog.length = 0; };
  let max = buildBundle('maximum', options);
  const semanticPath = 'bundles/maximum/envelopes/semantic.json';
  const extra = Math.floor((262144 - written.get(semanticPath).length) / 67);
  if (extra < 0) throw Error('Maximum semantic baseline exceeded envelope bound');
  for (let i = 0; i < extra; i++) candidate.semanticContracts.push({ id: 'semantic.' + String(i).padStart(55, '0'), version: V, sha256: H(Buffer.from('maximum semantic contract ' + i)) });
  candidate.semanticContracts.sort(by('id'));
  reset(); max = buildBundle('maximum', options);
  const remaining = 262144 - written.get(semanticPath).length;
  options.locatorByGate = { semantic: 'x'.repeat(remaining + 2) };
  if (remaining < 0 || remaining + 2 > 256) throw Error('Maximum envelope padding calculation failed');
  reset(); max = buildBundle('maximum', options);
  let budget = 8388608 - max.manifest.entries.reduce((n, e) => n + e.byteLength, 0);
  for (const source of sourceRecords.slice(1)) {
    const grow = Math.min(budget, 2097152 - source.bytes.length);
    source.bytes = Buffer.alloc(source.bytes.length + grow, 120); budget -= grow;
  }
  if (budget !== 0) throw Error('Maximum source capacity insufficient');
  reset(); max = buildBundle('maximum', options);
  const statistics = { kind: 'MO1307EngineeringMaximumInput', version: V, fixtureOnly: true, productionCertification: false,
    candidateComponents: max.candidate.components.length, semanticContracts: max.candidate.semanticContracts.length, manifestFiles: max.manifest.entries.length,
    aggregateEvidenceBytes: max.manifest.entries.reduce((n, e) => n + e.byteLength, 0), maximumSourceBytes: Math.max(...max.manifest.entries.filter(e => e.type === 'SOURCE').map(e => e.byteLength)),
    maximumEnvelopeBytes: Math.max(...max.manifest.entries.filter(e => e.type === 'ENVELOPE').map(e => e.byteLength)), graphNodes: max.graph.nodes.length, graphEdges: max.graph.edges.length,
    candidateBytes: written.get('bundles/maximum/candidate.json').length, authorityBytes: written.get('bundles/maximum/authority.json').length, resultBytes: written.get('bundles/maximum/expected-result.json').length };
  if (statistics.manifestFiles !== 128 || statistics.aggregateEvidenceBytes !== 8388608 || statistics.maximumSourceBytes !== 2097152 || statistics.maximumEnvelopeBytes !== 262144 || statistics.graphEdges > 8192) throw Error('Maximum fixture bounds inconsistent');
  for (const [path, raw] of written) { const relative = path.replace(/^bundles\/maximum\//, ''); const full = resolve(target, relative); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, raw); }
  writeFileSync(resolve(target, 'engineering-statistics.json'), J(statistics));
  console.log(JSON.stringify({ path: target, ...statistics }));
  process.exit(0);
}

const ready = buildBundle('ready');
const qualified = buildBundle('qualified', { qualified: true });
const notReady = buildBundle('not-ready', { failedGate: 'security' });
const cne = buildBundle('could-not-evaluate', { unavailable: 'security' });
const released = buildBundle('mo1306-qualified', { released: true });
const rest = buildBundle('rest-qualified', { profile: 'rest' });
buildBundle('mixed-precedence', { failedGate: 'security', unavailable: 'resources', qualified: true });
buildBundle('history-blocker-unavailable', { unavailable: 'security', historyRecurrence: true });
buildBundle('informational-ready', { informational: true });
const metadata = buildBundle('metadata-only', { metadata: 'opaque-run-id' });
if (metadata.result.readinessDigest !== ready.result.readinessDigest || metadata.result.proofBindingDigest === ready.result.proofBindingDigest) throw Error('Metadata identity vector inconsistent');
const changed = clone(ready.candidate); changed.components.find(c => c.role === 'DOCUMENTATION').sha256 = H(Buffer.from('unrelated documentation changed\n'));
buildBundle('selective-reuse', { candidate: changed, reusedGate: 'security', originCandidate: D(ready.candidate) });
buildBundle('post-tag-ready', { stage: 'POST_TAG_VERIFICATION' });
const goodTag = { name: ready.candidate.expectedTag.name, presence: 'PRESENT', object: '7'.repeat(40), annotated: true, peeledTarget: ready.candidate.expectedTag.target };
buildBundle('pre-tag-present', { tag: goodTag });
buildBundle('post-tag-wrong-target', { stage: 'POST_TAG_VERIFICATION', tag: { ...goodTag, peeledTarget: '8'.repeat(40) } });
buildBundle('post-tag-lightweight', { stage: 'POST_TAG_VERIFICATION', tag: { ...goodTag, annotated: false } });
buildBundle('post-tag-absent', { stage: 'POST_TAG_VERIFICATION', tag: { name: goodTag.name, presence: 'ABSENT', object: null, annotated: null, peeledTarget: null } });

for (const [state, bundle] of [['ready', ready], ['qualified', qualified], ['not-ready', notReady], ['cne', cne]]) for (const decision of ['APPROVE', 'REJECT', 'DEFER']) {
  const r = bundle.result;
  const human = record('HumanDecision', { candidateDigest: r.assessment.candidateDigest, readinessDigest: r.readinessDigest, proofBindingDigest: r.proofBindingDigest, decision, reason: 'External fixture decision only', actor: null, timestamp: null, authenticity: 'NOT_VERIFIED_BY_MEMORYOS', attestation: null });
  emit('human/' + state + '-' + decision.toLowerCase() + '.json', human, 'human-decision', { verificationBundle: bundle.name, expectedConsistency: decision === 'APPROVE' && ['not-ready', 'cne'].includes(state) ? 'CONTRARY_TO_READINESS' : 'CONSISTENT' });
}
function negative(id, schema, value, expectedCode, layer = 'FOUNDATION', extra = {}) {
  emit('negative/' + id + '.json', value, schema, { schemaValid: layer === 'PARSER' ? null : layer !== 'SCHEMA', foundationValid: false, layer, expectedCode: 'MO1307_' + expectedCode, ...extra });
}
const altered = (x, fn) => { const y = clone(x); fn(y); return y; };
negative('unknown-field', 'candidate', { ...ready.candidate, extra: true }, 'INPUT', 'SCHEMA');
negative('profile-substitution', 'candidate', altered(ready.candidate, x => { x.profile.id = 'rest'; }), 'PROFILE_MISMATCH', 'SCHEMA');
negative('unknown-profile', 'configuration', altered(ready.config, x => { x.profile.id = 'plugin'; }), 'PROFILE_MISMATCH', 'SCHEMA');
negative('unknown-evidence-version', 'evidence', altered(ready.envelopes[0], x => { x.claim.version = '2.0.0'; }), 'EVIDENCE_VERSION', 'SCHEMA');
negative('duplicate-component-id', 'candidate', altered(ready.candidate, x => { x.components[1].id = x.components[0].id; }), 'INPUT');
negative('unsorted-components', 'candidate', altered(ready.candidate, x => { x.components.reverse(); }), 'INPUT');
negative('dangling-provider', 'candidate', altered(ready.candidate, x => { x.providers[0].componentId = 'missing'; }), 'INPUT');
negative('unsafe-traversal', 'configuration', altered(ready.config, x => { x.candidate = '../candidate.json'; }), 'FILESYSTEM_BOUNDARY', 'SCHEMA');
negative('unsafe-device', 'configuration', altered(ready.config, x => { x.candidate = 'con.json'; }), 'FILESYSTEM_BOUNDARY', 'SCHEMA');
negative('unsafe-backslash', 'configuration', altered(ready.config, x => { x.candidate = 'sub\\candidate.json'; }), 'FILESYSTEM_BOUNDARY', 'SCHEMA');
negative('qualification-impact', 'qualification', altered(qualified.qualifications[0], x => { x.impact = 'INFORMATIONAL'; }), 'QUALIFICATION_MISMATCH', 'SCHEMA');
negative('qualification-duplicate-gate', 'qualification', altered(qualified.qualifications[0], x => { x.gateIds.push(x.gateIds[0]); }), 'QUALIFICATION_MISMATCH', 'SCHEMA');
negative('false-hosted-promotion', 'provider-detail', { ...providerDetail('github', true), execution: 'HOSTED_EXECUTION_CERTIFIED', sourceExecutionLabel: 'HOSTED_EXECUTION_CERTIFIED', support: 'SUPPORTED' }, 'QUALIFICATION_MISMATCH', 'FOUNDATION', { verificationBundle: qualified.name, repinEnvelopeAndGrant: true });
negative('history-pass-rewrite', 'history', { ...released.history[0], originalOutcome: 'PASS' }, 'HISTORY_MISMATCH', 'SCHEMA');
negative('history-original-disposition-rewrite', 'history', { ...released.history.find(x => x.id === 'history.native-publication'), originalDisposition: 'RESOLVED' }, 'EVIDENCE_AUTHORITY', 'PHASE2', { foundationValid: true, verificationBundle: released.name, mutationTarget: 'history claim row; original authority grant remains pinned' });
negative('candidate-substitution', 'candidate', altered(ready.candidate, x => { x.source.commit = '9'.repeat(40); }), 'CANDIDATE_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
negative('wrong-manifest-digest', 'authority', { ...ready.authority, manifestSha256: H(Buffer.from('wrong')) }, 'INTEGRITY', 'PHASE2', { foundationValid: true, verificationBundle: ready.name, repinAuthority: true });
negative('forged-authority', 'authority', altered(ready.authority, x => { x.assessment.scopeId = 'forged.scope'; }), 'EVIDENCE_AUTHORITY', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
negative('wrong-claim-digest', 'authority', altered(ready.authority, x => { x.assessment.grants[0].claimDigest = H(Buffer.from('wrong')); }), 'EVIDENCE_AUTHORITY', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
negative('wrong-raw-digest', 'manifest', altered(ready.manifest, x => { x.entries[0].sha256 = H(Buffer.from('wrong')); }), 'INTEGRITY', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
const securityEnvelope = ready.envelopes.find(x => x.claim.type === 'SECURITY_AUDIT');
negative('stale-dependency', 'evidence', altered(securityEnvelope, x => { x.claim.dependencies[0].sha256 = H(Buffer.from('changed')); }), 'STALE_EVIDENCE', 'PHASE2', { foundationValid: true, verificationBundle: ready.name, repinEnvelopeAndGrant: true });
negative('incomplete-dependencies', 'evidence', altered(securityEnvelope, x => { x.claim.dependencies = x.claim.dependencies.filter(d => d.role !== 'RUNTIME'); }), 'EVIDENCE_AUTHORITY', 'PHASE2', { foundationValid: true, verificationBundle: ready.name, repinEnvelopeAndGrant: true });
negative('qualification-omission', 'evidence', altered(qualified.envelopes.find(x => x.claim.type === 'SCOPE_AUTHORITY'), x => { x.claim.detail.qualificationIds.pop(); }), 'QUALIFICATION_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: qualified.name, repinEnvelopeAndGrant: true });
negative('history-omission', 'evidence', altered(released.envelopes.find(x => x.claim.type === 'HISTORICAL_DISPOSITION'), x => { x.claim.detail.records.pop(); }), 'EVIDENCE_AUTHORITY', 'PHASE2', { foundationValid: true, verificationBundle: released.name });
negative('blocker-suppression', 'result', altered(notReady.result, x => { x.assessment.blockers = []; }), 'RESULT_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: notReady.name });
negative('wrong-proof-digest', 'result', { ...ready.result, proofBindingDigest: H(Buffer.from('wrong')) }, 'RESULT_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
const selfHashedWrong = altered(ready.result, x => { x.assessment.readiness = 'NOT_READY'; });
selfHashedWrong.readinessDigest = D(record('Identity', { assessment: selfHashedWrong.assessment }));
selfHashedWrong.proofBindingDigest = D(record('ProofBinding', { readinessDigest: selfHashedWrong.readinessDigest, audit: selfHashedWrong.audit }));
negative('self-hashed-false-result', 'result', selfHashedWrong, 'RESULT_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: ready.name, note: 'Canonical self hashes pass; independent recomputation must reject the false assessment.' });
const mismatchDecision = record('HumanDecision', { candidateDigest: ready.result.assessment.candidateDigest, readinessDigest: ready.result.readinessDigest, proofBindingDigest: metadata.result.proofBindingDigest, decision: 'APPROVE', reason: 'Old review on changed raw proof', actor: 'unverified actor', timestamp: '2026-09-28T00:00:00Z', authenticity: 'NOT_VERIFIED_BY_MEMORYOS', attestation: null });
negative('human-proof-mismatch', 'human-decision', mismatchDecision, 'DECISION_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
negative('human-candidate-mismatch', 'human-decision', { ...mismatchDecision, candidateDigest: D(changed), proofBindingDigest: ready.result.proofBindingDigest }, 'DECISION_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
negative('human-readiness-mismatch', 'human-decision', { ...mismatchDecision, readinessDigest: notReady.result.readinessDigest, proofBindingDigest: ready.result.proofBindingDigest }, 'DECISION_MISMATCH', 'PHASE2', { foundationValid: true, verificationBundle: ready.name });
negative('graph-dangling', 'graph', altered(ready.graph, x => { x.edges.find(e => e.type === 'AUTHORIZES').to = 'CLAIM:' + H(Buffer.from('missing')); }), 'INPUT');
negative('graph-cycle', 'graph', altered(ready.graph, x => { x.edges.push({ from: x.nodes.find(n => n.type === 'CANDIDATE').id, type: 'DEPENDS_ON', to: 'assessment' }); x.edges.sort((a, b) => by('from')(a, b) || by('type')(a, b) || by('to')(a, b)); }), 'GRAPH_CYCLE', 'SCHEMA', { internalGraphProbe: true, note: 'Internal derived-graph defensive probe; edge also violates closed topology. GRAPH_CYCLE is tested directly by bounded cycle detection, not accepted external graph.' });
negative('graph-node-limit', 'graph', record('Graph', { nodes: Array.from({ length: 2049 }, (_, i) => ({ id: 'DEPENDENCY:' + H(Buffer.from(String(i))), type: 'DEPENDENCY', digest: H(Buffer.from(String(i))) })).sort(by('id')), edges: [] }), 'GRAPH_LIMIT', 'SCHEMA');
negative('noncanonical-duplicate-keys', 'configuration', Buffer.from('{"kind":"MemoryOSReadinessConfiguration","kind":"MemoryOSReadinessConfiguration"}\n'), 'INPUT', 'PARSER');
negative('noncanonical-exponent', 'candidate', Buffer.from('{"n":1e0}\n'), 'INPUT', 'PARSER');
negative('noncanonical-negative-zero', 'candidate', Buffer.from('{"n":-0}\n'), 'INPUT', 'PARSER');
negative('deep-json', 'candidate', Buffer.from('['.repeat(17) + '0' + ']'.repeat(17) + '\n'), 'RESOURCE_LIMIT', 'PARSER');
negative('unsafe-integer', 'candidate', Buffer.from('{"n":9007199254740992}\n'), 'INPUT', 'PARSER');
negative('invalid-utf8', 'candidate', Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc0, 0xaf, 0x22, 0x7d, 0x0a]), 'INPUT', 'PARSER');
negative('bom', 'configuration', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), J(ready.config)]), 'INPUT', 'PARSER');
negative('missing-final-lf', 'configuration', J(ready.config).subarray(0, J(ready.config).length - 1), 'INTEGRITY', 'PARSER');
negative('unpaired-surrogate', 'configuration', Buffer.from('{"x":"\\ud800"}\n'), 'INPUT', 'PARSER');
// Bounded acquisition tests materialize cap+1 bytes from this descriptor. No giant repository blob is necessary.
emit('scenarios/acquisition.json', { fixtureOnly: true, scenarios: [
  { id: 'oversized-envelope', phase: 'PHASE2C', setup: { kind: 'REPEAT_BYTE', byte: 32, count: 262145, entryType: 'ENVELOPE' }, expectedCode: 'MO1307_RESOURCE_LIMIT' },
  { id: 'oversized-source', phase: 'PHASE2C', setup: { kind: 'REPEAT_BYTE', byte: 32, count: 2097153, entryType: 'SOURCE' }, expectedCode: 'MO1307_RESOURCE_LIMIT' },
  { id: 'reparse-link-escape', phase: 'PHASE2C', setup: { kind: 'WINDOWS_REPARSE_POINT', manifestPath: 'sources/escape.data', target: 'OUTSIDE_EVIDENCE_ROOT' }, expectedCode: 'MO1307_FILESYSTEM_BOUNDARY' },
  { id: 'declared-file-missing', phase: 'PHASE2C', setup: { kind: 'OMIT_DECLARED_ENTRY', bundle: 'ready', entryId: 'fixture.source' }, expectedCode: 'MO1307_INPUT' },
  { id: 'deadline-equality', phase: 'PHASE2C', setup: { kind: 'CLOCK_CHECKPOINT', elapsedMilliseconds: 10000, deadlineMilliseconds: 10000, aborted: true }, expectedCode: 'MO1307_TIMEOUT' },
  { id: 'early-cancel', phase: 'PHASE2C', setup: { kind: 'CLOCK_CHECKPOINT', elapsedMilliseconds: 9999, deadlineMilliseconds: 10000, aborted: true }, expectedCode: 'MO1307_CANCELLED' },
  { id: 'late-success', phase: 'PHASE2C', setup: { kind: 'WORKER_COMPLETES_AT_DEADLINE', elapsedMilliseconds: 10000 }, expectedCode: 'MO1307_TIMEOUT', publish: false },
  { id: 'partial-publication', phase: 'PHASE2C', setup: { kind: 'TRUNCATE_RESULT_BEFORE_RENAME', bundle: 'ready' }, expectedCode: 'MO1307_OUTPUT', publish: false },
  { id: 'text-overflow', phase: 'PHASE2C', setup: { kind: 'REQUIRED_OUTPUT_LENGTH', bytes: 131073 }, expectedCode: 'MO1307_OUTPUT', truncate: false },
  { id: 'mixed-error-precedence', phase: 'PHASE2', setup: { kind: 'BAD_ROOT_PIN_AND_UNAVAILABLE_SLOT', bundle: 'could-not-evaluate' }, expectedCode: 'MO1307_EVIDENCE_AUTHORITY', result: false },
] });
emit('positive/operational-error.json', record('Error', { code: 'MO1307_INTEGRITY', stage: 'ACQUISITION', reference: null }), 'error');
for (const envelope of [...ready.envelopes, ...rest.envelopes.filter(x => x.claim.type === 'REST_CONTRACT')]) emit('positive/evidence-' + envelope.claim.type.toLowerCase() + (envelope.claim.type === 'PROVIDER_CERTIFICATION' ? '-' + envelope.claim.detail.provider : '') + '.json', envelope, 'evidence');
for (const q of qualified.qualifications) emit('positive/' + q.id + '.json', q, 'qualification');
emit('positive/q.platform.json', qualification('q.platform', 'PLATFORM_NOT_REQUIRED', ['windows'], 'fixture.scope'), 'qualification');
emit('positive/q.environment.json', qualification('q.environment', 'ENVIRONMENT_LIMITATION', ['windows'], 'fixture.scope'), 'qualification');
emit('positive/q.remote.json', rest.qualifications[0], 'qualification');
emit('positive/q.history.json', released.qualifications.find(x => x.reasonCode === 'HISTORICAL_UNRESOLVED_PRESERVED'), 'qualification');
for (const h of released.history) emit('positive/history-' + h.id + '.json', h, 'history');
emit('positive/blocker.json', notReady.result.assessment.blockers[0], 'blocker');
emit('positive/tag-pre.json', ready.envelopes.find(x => x.claim.type === 'TAG_OBSERVATION').claim.detail, 'tag-observation');
emit('positive/tag-post.json', released.envelopes.find(x => x.claim.type === 'TAG_OBSERVATION').claim.detail, 'tag-observation');
emit('positive/claim.json', ready.envelopes[0].claim, 'claim');
emit('positive/grant.json', ready.authority.assessment.grants[0], 'grant');
emit('positive/slot.json', ready.authority.assessment.slots[0], 'slot');
emit('positive/authority-source.json', ready.authority.provenance[0], 'authority-source');
emit('positive/manifest-entry.json', ready.manifest.entries[0], 'manifest-entry');
emit('positive/gate-result.json', ready.result.assessment.gates[0], 'gate-result');
emit('positive/history-projection.json', released.result.assessment.history[0], 'history-projection');
emit('positive/derived-qualification.json', qualified.result.assessment.qualifications[0], 'derived-qualification');
emit('positive/provider-detail.json', released.result.assessment.providers.find(x => x.provider === 'github'), 'provider-detail');
emit('positive/identity.json', record('Identity', { assessment: ready.result.assessment }), 'identity');
emit('positive/proof-binding.json', record('ProofBinding', { readinessDigest: ready.result.readinessDigest, audit: ready.result.audit }), 'proof-binding');
const manifestFiles = [...written.entries()].map(([path, bytes]) => ({ path, byteLength: bytes.length, sha256: H(bytes) })).sort(by('path'));
emit('catalog.json', { kind: 'MO1307Phase1FixtureCatalog', version: V, fixtureOnly: true, productionCertification: false, oracle: 'tools/mo1307-phase1/generate-fixtures.mjs', entries: catalog.sort(by('id')), files: manifestFiles });
for (const [path, bytes] of written) {
  const full = resolve(out, path);
  if (check) { if (!existsSync(full) || !readFileSync(full).equals(bytes)) throw Error('Fixture differs: ' + path); }
  else if (!existsSync(full) || !readFileSync(full).equals(bytes)) { mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, bytes); }
}
console.log(JSON.stringify({ mode: check ? 'CHECK' : 'GENERATE', files: written.size, catalogEntries: catalog.length, bytes: [...written.values()].reduce((n, x) => n + x.length, 0), released: { candidateDigest: released.result.assessment.candidateDigest, readiness: released.result.assessment.readiness, history: released.history.length, graphNodes: released.graph.nodes.length, graphEdges: released.graph.edges.length } }));
