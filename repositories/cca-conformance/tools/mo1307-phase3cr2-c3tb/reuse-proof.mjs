// Append-only, dependency-selected reuse proof for exact MO-1307 C3TB.
// This tool reads Git objects and the current checkout, but launches no product,
// helper, package installation, certification corpus, network operation, push, or tag.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const EVIDENCE = path.join(ROOT, EVIDENCE_RELATIVE);
const OUTPUT_RELATIVE = `${EVIDENCE_RELATIVE}/dependency-reuse.json`;
const OUTPUT = path.join(ROOT, OUTPUT_RELATIVE);
const PRODUCT = 'repositories/memoryos-readiness';

const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3RB_PHASE3C = 'b02fc0226a1a2d800185a02071674ca80bdf4a1d';
const HISTORICAL_3CR = 'f4ed5873969ab6b627941dc20d5823c5e853b9fe';
const ORIGINAL_3C = '191f34748141afca2027e8e9db0c6f1b6a9c84c0';
const GIT = 'C:/Program Files/Git/cmd/git.exe';
const GIT_VERSION = 'git version 2.55.0.windows.3';
const GIT_SHA256 = 'sha256:7b7971dd13f0c3a284e538601f2f9770b3a87dfaccb5fb52d68141c67ed22364';
const NODE_VERSION = 'v24.21.0';
const NODE_SHA256 = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';

const CURRENT_FILES = Object.freeze({
  authority: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/authority.json',
  candidate: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/candidate.json',
  changedInventory: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/changed-file-inventory.json',
  consistency: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/consistency-validation.json',
  map: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/phase3c-refresh-map.json',
  binding: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/binding.json',
  bindingVerification: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/binding-verification.json',
});
const HISTORICAL_FILES = Object.freeze({
  controlMap: 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/current-control-map.json',
  controlResults: 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/current-control-results.json',
  reuseDependencies: 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/reuse-dependencies.json',
  proofBindings: 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/historical-proof-bindings.json',
});
const EXPECTED_CHANGED_MEMBERS = Object.freeze([
  'README.md',
  'contracts/contract.json',
  'contracts/definitions.json',
  'distribution-manifest.json',
  'helpers/README.md',
  'helpers/windows-inspect.ps1',
  'sbom.spdx.json',
  'src/constants.mjs',
  'src/helper-transport.mjs',
].sort());
const EXPECTED_SUPPLEMENTAL = Object.freeze([
  'candidate:prospective-bound-generated-contract-consistency',
  'candidate:prospective-bound-package-and-binding-identity',
].sort());

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const slash = value => value.replaceAll('\\', '/');
const sha = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const valueSha = value => sha(Buffer.from(canonical(value)));
const ordinalSorted = values => [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
const uniqueOrdinal = values => new Set(values);
const relative = member => `${PRODUCT}/${member}`;
const jsonBytes = bytes => JSON.parse(bytes.toString('utf8'));
const assertCanonicalJson = (bytes, label) => {
  const value = jsonBytes(bytes);
  assert.ok(bytes.equals(Buffer.from(`${canonical(value)}\n`)), `${label}: noncanonical JSON`);
  return value;
};
const pinBytes = (relativePath, bytes, extra = {}) => ({
  path: relativePath,
  byteLength: bytes.length,
  sha256: sha(bytes),
  ...extra,
});

function gitRaw(args, input = undefined) {
  const result = spawnSync(GIT, ['-c', 'core.longpaths=true', '-c', `safe.directory=${slash(ROOT).replace(/\/$/u, '')}`, ...args], {
    cwd: ROOT,
    input,
    windowsHide: true,
    shell: false,
    maxBuffer: 512 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${GIT} ${args.join(' ')}: ${result.stderr?.toString('utf8')}`);
  return result.stdout;
}
const gitText = args => gitRaw(args).toString('utf8').trim();

const objectCache = new Map();
const objectKey = (commit, relativePath) => `${commit}\0${relativePath}`;
function prefetch(commit, paths) {
  const wanted = ordinalSorted(uniqueOrdinal(paths));
  const missing = wanted.filter(relativePath => !objectCache.has(objectKey(commit, relativePath)));
  if (missing.length === 0) return;
  const output = gitRaw(['cat-file', '--batch'], Buffer.from(missing.map(relativePath => `${commit}:${relativePath}\n`).join('')));
  let cursor = 0;
  for (const relativePath of missing) {
    const headerEnd = output.indexOf(10, cursor);
    assert.notEqual(headerEnd, -1, `${commit}:${relativePath}: missing cat-file header`);
    const header = output.subarray(cursor, headerEnd).toString('utf8');
    const match = /^([0-9a-f]+) blob ([0-9]+)$/u.exec(header);
    assert.ok(match, `${commit}:${relativePath}: ${header}`);
    const byteLength = Number(match[2]);
    const start = headerEnd + 1;
    const end = start + byteLength;
    assert.equal(output[end], 10, `${commit}:${relativePath}: malformed cat-file terminator`);
    objectCache.set(objectKey(commit, relativePath), {
      bytes: Buffer.from(output.subarray(start, end)),
      gitBlob: match[1],
    });
    cursor = end + 1;
  }
  assert.equal(cursor, output.length, `${commit}: unexpected cat-file trailer`);
}
function gitObject(commit, relativePath) {
  prefetch(commit, [relativePath]);
  return objectCache.get(objectKey(commit, relativePath));
}
function gitPin(commit, relativePath) {
  const object = gitObject(commit, relativePath);
  return pinBytes(relativePath, object.bytes, { commit, gitBlob: object.gitBlob });
}
function gitJson(commit, relativePath) {
  return jsonBytes(gitObject(commit, relativePath).bytes);
}

function currentPin(relativePath, commit) {
  const bytes = fs.readFileSync(path.join(ROOT, relativePath));
  const committed = gitObject(commit, relativePath);
  assert.ok(bytes.equals(committed.bytes), `${relativePath}: checkout differs from ${commit}`);
  return pinBytes(relativePath, bytes, { commit, gitBlob: committed.gitBlob });
}

function assertOrdinalUnique(values, expected, label) {
  assert.equal(values.length, expected, `${label}: count`);
  assert.equal(uniqueOrdinal(values).size, expected, `${label}: duplicate`);
}
function assertSameOrdinalSet(left, right, label) {
  const leftSet = uniqueOrdinal(left);
  const rightSet = uniqueOrdinal(right);
  assert.equal(leftSet.size, left.length, `${label}: left duplicates`);
  assert.equal(rightSet.size, right.length, `${label}: right duplicates`);
  assert.deepEqual(ordinalSorted(leftSet), ordinalSorted(rightSet), label);
}

function manifestSummary(rows) {
  return {
    count: rows.length,
    manifestSha256: valueSha(rows),
  };
}
const comparablePin = pin => ({
  path: pin.path,
  byteLength: pin.byteLength,
  sha256: pin.sha256,
  gitBlob: pin.gitBlob,
});

function walkRegularFiles(root, relativePath = '') {
  const rows = [];
  for (const name of fs.readdirSync(path.join(root, relativePath)).sort()) {
    const member = relativePath ? `${relativePath}/${name}` : name;
    const stat = fs.lstatSync(path.join(root, member));
    assert.equal(stat.isSymbolicLink(), false, `${member}: symbolic link`);
    if (stat.isDirectory()) rows.push(...walkRegularFiles(root, member));
    else {
      assert.equal(stat.isFile(), true, `${member}: nonregular package member`);
      assert.equal(stat.nlink, 1, `${member}: hard-linked package member`);
      rows.push(member);
    }
  }
  return rows;
}

function extractGeneratedDefinitions(bytes, label) {
  const source = bytes.toString('utf8');
  const prefix = 'export const DEFINITIONS=freeze(';
  const start = source.indexOf(prefix);
  assert.notEqual(start, -1, `${label}: generated definitions prefix`);
  const jsonStart = start + prefix.length;
  const end = source.lastIndexOf(');');
  assert.notEqual(end, -1, `${label}: generated definitions suffix`);
  return JSON.parse(source.slice(jsonStart, end));
}

function withoutHelperDeadline(definitions) {
  const projected = structuredClone(definitions);
  assert.equal(typeof projected?.limits?.helperDeadlineMs, 'number', 'helperDeadlineMs missing');
  delete projected.limits.helperDeadlineMs;
  return projected;
}

const SOURCE = Object.freeze({
  acquisition: relative('src/acquisition.mjs'),
  apiInput: relative('src/api-input.mjs'),
  canonical: relative('src/canonical.mjs'),
  cliArgs: relative('src/cli-args.mjs'),
  cli: relative('src/cli.mjs'),
  errors: relative('src/errors.mjs'),
  evidenceGraph: relative('src/evidence-graph.mjs'),
  evidenceHistory: relative('src/evidence-history.mjs'),
  evidenceVerifier: relative('src/evidence-verifier.mjs'),
  foundation: relative('src/foundation.mjs'),
  helperProtocol: relative('src/helper-protocol.mjs'),
  index: relative('src/index.mjs'),
  integration: relative('src/integration.mjs'),
  output: relative('src/output.mjs'),
  projections: relative('src/projections.mjs'),
  publication: relative('src/publication.mjs'),
  readinessCore: relative('src/readiness-core.mjs'),
  readinessResult: relative('src/readiness-result.mjs'),
  runtime: relative('src/runtime.mjs'),
  schemaData: relative('src/schema-data.mjs'),
  schema: relative('src/schema.mjs'),
  windowsPaths: relative('src/windows-paths.mjs'),
  workerEntry: relative('src/worker-entry.mjs'),
  workerPolicy: relative('src/worker-policy.mjs'),
});

const BYTE_FACET_PATHS = Object.freeze({
  'source:root-closed-input-and-runtime-seams': ordinalSorted([
    SOURCE.acquisition, SOURCE.apiInput, SOURCE.canonical, SOURCE.cliArgs, SOURCE.cli,
    SOURCE.errors, SOURCE.foundation, SOURCE.helperProtocol, SOURCE.index, SOURCE.integration,
    SOURCE.output, SOURCE.publication, SOURCE.readinessResult, SOURCE.runtime, SOURCE.schemaData,
    SOURCE.schema, SOURCE.windowsPaths, SOURCE.workerEntry, SOURCE.workerPolicy,
  ]),
  'source:trust-graph-semantics': ordinalSorted([
    SOURCE.apiInput, SOURCE.canonical, SOURCE.errors, SOURCE.evidenceGraph,
    SOURCE.evidenceHistory, SOURCE.evidenceVerifier, SOURCE.foundation, SOURCE.integration,
    SOURCE.projections, SOURCE.readinessCore, SOURCE.readinessResult, SOURCE.schemaData, SOURCE.schema,
  ]),
  'source:governance-semantics': ordinalSorted([
    SOURCE.apiInput, SOURCE.canonical, SOURCE.errors, SOURCE.evidenceHistory,
    SOURCE.evidenceVerifier, SOURCE.foundation, SOURCE.integration, SOURCE.output,
    SOURCE.projections, SOURCE.readinessCore, SOURCE.readinessResult, SOURCE.schemaData, SOURCE.schema,
  ]),
  'source:wire-and-sequence': ordinalSorted([
    SOURCE.canonical, SOURCE.errors, SOURCE.helperProtocol,
  ]),
  'source:windows-path-and-identity': ordinalSorted([
    SOURCE.errors, SOURCE.windowsPaths,
  ]),
  'source:launch-admission': ordinalSorted([
    SOURCE.cliArgs, SOURCE.errors,
  ]),
  'source:worker-supervision': ordinalSorted([
    SOURCE.errors, SOURCE.runtime, SOURCE.workerEntry, SOURCE.workerPolicy,
  ]),
  'source:publication-state-machine': ordinalSorted([
    SOURCE.canonical, SOURCE.errors, SOURCE.helperProtocol, SOURCE.publication,
    SOURCE.runtime, SOURCE.windowsPaths,
  ]),
  'source:worker-policy': ordinalSorted([
    SOURCE.errors, SOURCE.workerPolicy,
  ]),
  'source:error-serialization': ordinalSorted([
    SOURCE.errors,
  ]),
});

function dependencyFacetIds(control) {
  if (control.suite === 'root') {
    return ['source:root-closed-input-and-runtime-seams', 'field:definitions-except-helper-deadline', 'inputs:accepted-fixture-set'];
  }
  if (control.suite === 'trust-graph') {
    return ['source:trust-graph-semantics', 'field:definitions-except-helper-deadline', 'inputs:accepted-fixture-set'];
  }
  if (control.suite === 'governance-primary' || control.suite === 'governance-supplement') {
    return ['source:governance-semantics', 'field:definitions-except-helper-deadline', 'inputs:accepted-fixture-set'];
  }
  if (control.suite === 'runtime-main') {
    if (/^runtime-boundary:(?:wire-|sequence-)/u.test(control.id)) {
      return ['source:wire-and-sequence', 'field:definitions-except-helper-deadline'];
    }
    if (/^runtime-boundary:(?:relative-|root-|path-)/u.test(control.id)) {
      return ['source:windows-path-and-identity', 'field:definitions-except-helper-deadline'];
    }
    if (/^runtime-boundary:launch-/u.test(control.id)) {
      return ['source:launch-admission', 'field:definitions-except-helper-deadline'];
    }
    if (/^runtime-boundary:worker-/u.test(control.id)) {
      return ['source:worker-supervision', 'field:definitions-except-helper-deadline'];
    }
    if (/^runtime-boundary:publication-/u.test(control.id)) {
      return ['source:publication-state-machine', 'field:definitions-except-helper-deadline'];
    }
    throw new Error(`UNMAPPED_RUNTIME_MAIN_REUSE:${control.id}`);
  }
  if (control.suite === 'runtime-supplement') {
    if (/^runtime-boundary:helper-/u.test(control.id)) {
      return ['source:wire-and-sequence', 'field:definitions-except-helper-deadline'];
    }
    if (/^runtime-boundary:actual-worker-policy-/u.test(control.id)) {
      return ['source:worker-policy', 'field:definitions-except-helper-deadline'];
    }
    if (control.id === 'runtime-boundary:supervisor-helper-worker-overlap-refusal'
        || control.id === 'runtime-boundary:worker-result-after-deadline-equality') {
      return ['source:worker-supervision', 'field:definitions-except-helper-deadline'];
    }
    throw new Error(`UNMAPPED_RUNTIME_SUPPLEMENT_REUSE:${control.id}`);
  }
  if (control.suite === 'deadline-cleanup') {
    if (/^runtime-boundary:launch-flag-/u.test(control.id)) return ['source:launch-admission'];
    if (control.id === 'runtime-boundary:secret-fixed-diagnostic') return ['source:error-serialization'];
    throw new Error(`UNMAPPED_DEADLINE_REUSE:${control.id}`);
  }
  throw new Error(`UNMAPPED_REUSE_SUITE:${control.suite}:${control.id}`);
}

function rowFacet(facet) {
  return {
    facetId: facet.id,
    kind: facet.kind,
    membersAuthority: facet.membersAuthority,
    historical: facet.historical,
    current: facet.current,
    comparison: facet.comparison,
    equal: facet.equal,
  };
}

const failureRecord = {
  kind: 'MO1307Phase3CR2DependencyReuse',
  version: '1.0.0',
  result: 'FAIL',
  candidateRole: 'C3TB',
  candidate: C3TB,
  historicalAcceptedPhase3C: C3RB_PHASE3C,
  output: OUTPUT_RELATIVE,
  rows: [],
};

if (fs.existsSync(OUTPUT)) {
  throw new Error(`APPEND_ONLY_OUTPUT_EXISTS:${OUTPUT_RELATIVE}`);
}

try {
  assert.equal(process.version, NODE_VERSION, 'Node version');
  assert.equal(sha(fs.readFileSync(process.execPath)), NODE_SHA256, 'Node executable identity');
  assert.equal(path.resolve(process.cwd()), path.resolve(ROOT), 'repository root working directory');
  assert.equal(fs.existsSync(GIT), true, 'pinned Git executable missing');
  assert.equal(sha(fs.readFileSync(GIT)), GIT_SHA256, 'Git executable identity');
  assert.equal(gitText(['--version']), GIT_VERSION, 'Git version');
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'C3TB HEAD');
  assert.equal(gitText(['rev-parse', 'HEAD^']), C3T, 'C3TB parent');

  const bindingPaths = ordinalSorted([
    CURRENT_FILES.binding,
    CURRENT_FILES.bindingVerification,
  ]);
  const bindingCommitPaths = ordinalSorted(gitText([
    'diff-tree', '--no-commit-id', '--name-only', '-r', C3TB,
  ]).split(/\r?\n/u).filter(Boolean));
  assert.deepEqual(bindingCommitPaths, bindingPaths, 'C3TB must remain binding-only');

  prefetch(C3T, [
    CURRENT_FILES.authority,
    CURRENT_FILES.candidate,
    CURRENT_FILES.changedInventory,
    CURRENT_FILES.consistency,
    CURRENT_FILES.map,
  ]);
  prefetch(C3TB, Object.values(CURRENT_FILES));
  prefetch(C3RB_PHASE3C, Object.values(HISTORICAL_FILES));

  const currentPins = {
    authority: currentPin(CURRENT_FILES.authority, C3TB),
    candidate: currentPin(CURRENT_FILES.candidate, C3TB),
    changedInventory: currentPin(CURRENT_FILES.changedInventory, C3TB),
    consistency: currentPin(CURRENT_FILES.consistency, C3TB),
    map: currentPin(CURRENT_FILES.map, C3TB),
    binding: currentPin(CURRENT_FILES.binding, C3TB),
    bindingVerification: currentPin(CURRENT_FILES.bindingVerification, C3TB),
  };
  for (const key of ['authority', 'candidate', 'changedInventory', 'consistency', 'map']) {
    assert.equal(currentPins[key].gitBlob, gitObject(C3T, CURRENT_FILES[key]).gitBlob, `${key}: changed in binding child`);
  }

  const map = assertCanonicalJson(fs.readFileSync(path.join(ROOT, CURRENT_FILES.map)), CURRENT_FILES.map);
  const candidate = assertCanonicalJson(fs.readFileSync(path.join(ROOT, CURRENT_FILES.candidate)), CURRENT_FILES.candidate);
  const consistency = assertCanonicalJson(fs.readFileSync(path.join(ROOT, CURRENT_FILES.consistency)), CURRENT_FILES.consistency);
  const binding = assertCanonicalJson(fs.readFileSync(path.join(ROOT, CURRENT_FILES.binding)), CURRENT_FILES.binding);
  const bindingVerification = assertCanonicalJson(fs.readFileSync(path.join(ROOT, CURRENT_FILES.bindingVerification)), CURRENT_FILES.bindingVerification);
  assert.equal(map.kind, 'MO1307ProspectiveBoundPhase3CRefreshMap');
  assert.equal(map.consumeRule, 'EXACT_C3TB_HEAD_AFTER_BINDING_VERIFICATION');
  assert.equal(map.historicalAccepted.commit, C3RB_PHASE3C);
  assert.equal(map.status, 'PENDING_SEPARATE_EXECUTION');
  assert.equal(candidate.result, 'READY_FOR_BINDING');
  assert.equal(consistency.result, 'PASS');
  assert.equal(binding.result, 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3');
  assert.equal(binding.implementation.commit, C3T);
  assert.equal(binding.binding.soleParent, C3T);
  assert.equal(binding.binding.productionChanges, false);
  assert.equal(bindingVerification.result, 'PASS');
  assert.ok(bindingVerification.checks.includes('PHASE3C_HANDOFF_BOUND'));
  const boundMap = binding.handoffs.filter(row => row.path === CURRENT_FILES.map);
  assert.equal(boundMap.length, 1, 'bound Phase 3C map');
  assert.equal(boundMap[0].byteLength, currentPins.map.byteLength, 'bound map length');
  assert.equal(boundMap[0].sha256, currentPins.map.sha256, 'bound map digest');
  assert.equal(boundMap[0].gitBlob, currentPins.map.gitBlob, 'bound map blob');

  const historicalPins = {
    controlMap: gitPin(C3RB_PHASE3C, HISTORICAL_FILES.controlMap),
    controlResults: gitPin(C3RB_PHASE3C, HISTORICAL_FILES.controlResults),
    reuseDependencies: gitPin(C3RB_PHASE3C, HISTORICAL_FILES.reuseDependencies),
    proofBindings: gitPin(C3RB_PHASE3C, HISTORICAL_FILES.proofBindings),
  };
  const controlMap = gitJson(C3RB_PHASE3C, HISTORICAL_FILES.controlMap);
  const controlResults = gitJson(C3RB_PHASE3C, HISTORICAL_FILES.controlResults);
  const reuseDependencies = gitJson(C3RB_PHASE3C, HISTORICAL_FILES.reuseDependencies);
  const proofBindings = gitJson(C3RB_PHASE3C, HISTORICAL_FILES.proofBindings);
  assert.equal(controlMap.candidate, binding.authorities.historicalProduction);
  assert.equal(controlMap.rows.length, 551);
  assert.equal(controlResults.result, 'PASS_FRESH_COMPLETE');
  assert.equal(controlResults.count, 551);
  assert.equal(controlResults.rows.length, 551);
  assert.equal(controlResults.historicalPassReused, false);
  assert.equal(reuseDependencies.candidate, binding.authorities.historicalProduction);
  assert.equal(reuseDependencies.historical3CR, HISTORICAL_3CR);
  assert.equal(reuseDependencies.fixtures.length, 583);
  assert.equal(reuseDependencies.dependencies.length, 181);
  assert.ok(Array.isArray(proofBindings.bindings));
  assert.deepEqual(
    ordinalSorted(proofBindings.bindings.map(row => row.commit)),
    ordinalSorted([HISTORICAL_3CR, ORIGINAL_3C]),
    'historical proof authorities',
  );

  const historicalMapIds = controlMap.rows.map(row => row.id);
  const historicalResultIds = controlResults.rows.map(row => row.id);
  const selectedIds = [...map.selectedHistoricalIds];
  const reuseIds = [...map.dependencyReuseIds];
  assertOrdinalUnique(historicalMapIds, 551, 'accepted control map');
  assertOrdinalUnique(historicalResultIds, 551, 'accepted control results');
  assertOrdinalUnique(selectedIds, 89, 'selected controls');
  assertOrdinalUnique(reuseIds, 462, 'reuse controls');
  assertOrdinalUnique(map.candidateSpecificSupplementalControls, 2, 'candidate supplemental controls');
  assert.deepEqual(ordinalSorted(map.candidateSpecificSupplementalControls), EXPECTED_SUPPLEMENTAL);
  assertSameOrdinalSet(historicalMapIds, historicalResultIds, 'historical map/result inventory');
  assertSameOrdinalSet([...selectedIds, ...reuseIds], historicalMapIds, 'selected/reuse exhaustive partition');
  const selectedSet = uniqueOrdinal(selectedIds);
  const reuseSet = uniqueOrdinal(reuseIds);
  assert.equal([...selectedSet].some(id => reuseSet.has(id)), false, 'selected/reuse intersection');
  assert.deepEqual(map.accounting, {
    historicalInventory: 551,
    selectedFreshHistoricalControls: 89,
    dependencyReuseCandidates: 462,
    omitted: 0,
  });

  const mapById = new Map(controlMap.rows.map(row => [row.id, row]));
  const resultById = new Map(controlResults.rows.map(row => [row.id, row]));
  assert.equal(mapById.size, 551);
  assert.equal(resultById.size, 551);
  for (const id of reuseIds) {
    assert.ok(mapById.has(id), `UNKNOWN_REUSE_ID:${id}`);
    assert.ok(resultById.has(id), `MISSING_REUSE_RESULT:${id}`);
    assert.equal(selectedSet.has(id), false, `SELECTED_ID_CLASSIFIED_AS_REUSE:${id}`);
  }

  const packageJsonOld = gitJson(C3RB_PHASE3C, relative('package.json'));
  const packageJsonCurrent = gitJson(C3T, relative('package.json'));
  assert.deepEqual(packageJsonCurrent.files, packageJsonOld.files, 'package allowlist');
  assert.deepEqual(packageJsonCurrent.dependencies, {}, 'current production dependencies');
  assert.deepEqual(packageJsonOld.dependencies, {}, 'historical production dependencies');
  assert.equal(packageJsonCurrent.files.length, 89, 'package member count');
  assert.deepEqual(
    walkRegularFiles(path.join(ROOT, PRODUCT)),
    ordinalSorted(packageJsonCurrent.files),
    'exact checkout package membership',
  );
  const packageMembers = packageJsonCurrent.files.map(relative);
  prefetch(C3RB_PHASE3C, packageMembers);
  prefetch(C3T, packageMembers);
  for (const relativePath of packageMembers) {
    assert.ok(
      fs.readFileSync(path.join(ROOT, relativePath)).equals(gitObject(C3T, relativePath).bytes),
      `${relativePath}: checkout differs from exact C3T package`,
    );
  }
  const packageRows = packageMembers.map(relativePath => {
    const historical = gitPin(C3RB_PHASE3C, relativePath);
    const current = gitPin(C3T, relativePath);
    return {
      path: relativePath,
      historical,
      current,
      equal: gitObject(C3RB_PHASE3C, relativePath).bytes.equals(gitObject(C3T, relativePath).bytes),
    };
  });
  const actualChangedMembers = packageRows.filter(row => !row.equal)
    .map(row => row.path.slice(PRODUCT.length + 1));
  assert.deepEqual(ordinalSorted(actualChangedMembers), EXPECTED_CHANGED_MEMBERS, 'exact C3RB-to-C3T package diff');
  assert.equal(packageRows.filter(row => row.equal).length, 80, 'unchanged package members');
  const packageDiffFacet = {
    id: 'candidate:exact-c3rb-to-c3t-package-diff',
    historicalCommit: C3RB_PHASE3C,
    currentCommit: C3T,
    packageMembers: 89,
    unchangedMembers: 80,
    changedMembers: EXPECTED_CHANGED_MEMBERS,
    changedRows: packageRows.filter(row => !row.equal),
    manifestSha256: valueSha(packageRows),
    exact: true,
  };

  const acceptedDependencyByPath = new Map();
  for (const row of reuseDependencies.dependencies) {
    assert.equal(acceptedDependencyByPath.has(row.path), false, `duplicate accepted dependency:${row.path}`);
    acceptedDependencyByPath.set(row.path, row);
  }

  function makeByteFacet(id, paths) {
    const members = ordinalSorted(uniqueOrdinal(paths));
    prefetch(C3RB_PHASE3C, members);
    prefetch(C3T, members);
    const comparisons = members.map(relativePath => {
      const authority = acceptedDependencyByPath.get(relativePath);
      assert.ok(authority, `${id}: dependency absent from accepted reuse closure:${relativePath}`);
      assert.equal(authority.disposition, 'UNCHANGED_CURRENT', `${id}:${relativePath}: historical disposition`);
      const historical = gitPin(C3RB_PHASE3C, relativePath);
      const current = gitPin(C3T, relativePath);
      assert.equal(historical.byteLength, authority.byteLength, `${id}:${relativePath}: authority length`);
      assert.equal(historical.sha256, authority.sha256, `${id}:${relativePath}: authority digest`);
      const equal = gitObject(C3RB_PHASE3C, relativePath).bytes.equals(gitObject(C3T, relativePath).bytes);
      assert.equal(equal, true, `${id}:${relativePath}: dependency changed`);
      return { path: relativePath, historical, current, equal };
    });
    const historicalSummary = manifestSummary(comparisons.map(row => comparablePin(row.historical)));
    const currentSummary = manifestSummary(comparisons.map(row => comparablePin(row.current)));
    assert.deepEqual(currentSummary, historicalSummary, `${id}: byte manifest equality`);
    return {
      id,
      kind: 'EXACT_BYTE_SET_EQUALITY',
      membersAuthority: `${HISTORICAL_FILES.reuseDependencies}#/dependencies`,
      historical: { commit: C3RB_PHASE3C, ...historicalSummary },
      current: { commit: C3T, ...currentSummary },
      comparison: 'Every authoritative exercised source member is byte-identical.',
      equal: true,
      members: comparisons,
    };
  }

  const dependencyFacets = new Map();
  for (const [id, paths] of Object.entries(BYTE_FACET_PATHS)) {
    dependencyFacets.set(id, makeByteFacet(id, paths));
  }

  const definitionsPath = relative('contracts/definitions.json');
  const constantsPath = relative('src/constants.mjs');
  const definitionsOld = gitJson(C3RB_PHASE3C, definitionsPath);
  const definitionsCurrent = gitJson(C3T, definitionsPath);
  const generatedOld = extractGeneratedDefinitions(gitObject(C3RB_PHASE3C, constantsPath).bytes, `${C3RB_PHASE3C}:${constantsPath}`);
  const generatedCurrent = extractGeneratedDefinitions(gitObject(C3T, constantsPath).bytes, `${C3T}:${constantsPath}`);
  assert.deepEqual(generatedOld, definitionsOld, 'historical generated constants binding');
  assert.deepEqual(generatedCurrent, definitionsCurrent, 'current generated constants binding');
  assert.equal(definitionsOld.limits.helperDeadlineMs, 5000, 'historical helper deadline');
  assert.equal(definitionsCurrent.limits.helperDeadlineMs, 8000, 'current helper deadline');
  const definitionsProjectionOld = withoutHelperDeadline(definitionsOld);
  const definitionsProjectionCurrent = withoutHelperDeadline(definitionsCurrent);
  assert.deepEqual(definitionsProjectionCurrent, definitionsProjectionOld, 'definitions other than helperDeadlineMs');
  dependencyFacets.set('field:definitions-except-helper-deadline', {
    id: 'field:definitions-except-helper-deadline',
    kind: 'GENERATED_FIELD_PROJECTION_EQUALITY',
    membersAuthority: [definitionsPath, constantsPath],
    historical: {
      commit: C3RB_PHASE3C,
      definitions: gitPin(C3RB_PHASE3C, definitionsPath),
      generatedConstants: gitPin(C3RB_PHASE3C, constantsPath),
      comparedProjectionSha256: valueSha(definitionsProjectionOld),
      excludedSelectedField: { path: 'limits.helperDeadlineMs', value: 5000 },
    },
    current: {
      commit: C3T,
      definitions: gitPin(C3T, definitionsPath),
      generatedConstants: gitPin(C3T, constantsPath),
      comparedProjectionSha256: valueSha(definitionsProjectionCurrent),
      excludedSelectedField: { path: 'limits.helperDeadlineMs', value: 8000 },
    },
    comparison: 'Effective generated definitions are field-equal after excluding only the freshly selected helper deadline.',
    equal: true,
  });

  const fixturePaths = reuseDependencies.fixtures.map(row => row.path);
  assertOrdinalUnique(fixturePaths, 583, 'accepted fixture dependency set');
  prefetch(C3RB_PHASE3C, fixturePaths);
  prefetch(C3T, fixturePaths);
  const fixtureComparisons = reuseDependencies.fixtures.map(authority => {
    const historical = gitPin(C3RB_PHASE3C, authority.path);
    const current = gitPin(C3T, authority.path);
    assert.equal(historical.gitBlob, authority.blob, `${authority.path}: accepted fixture blob`);
    assert.equal(historical.byteLength, authority.byteLength, `${authority.path}: accepted fixture length`);
    assert.equal(historical.sha256, authority.sha256, `${authority.path}: accepted fixture digest`);
    const equal = gitObject(C3RB_PHASE3C, authority.path).bytes.equals(gitObject(C3T, authority.path).bytes);
    assert.equal(equal, true, `${authority.path}: fixture changed`);
    return { path: authority.path, historical, current, equal };
  });
  const historicalFixtureSummary = manifestSummary(fixtureComparisons.map(row => comparablePin(row.historical)));
  const currentFixtureSummary = manifestSummary(fixtureComparisons.map(row => comparablePin(row.current)));
  assert.deepEqual(currentFixtureSummary, historicalFixtureSummary, 'fixture byte manifest equality');
  dependencyFacets.set('inputs:accepted-fixture-set', {
    id: 'inputs:accepted-fixture-set',
    kind: 'EXACT_FIXTURE_MANIFEST_EQUALITY',
    membersAuthority: `${HISTORICAL_FILES.reuseDependencies}#/fixtures`,
    historical: { commit: C3RB_PHASE3C, ...historicalFixtureSummary },
    current: { commit: C3T, ...currentFixtureSummary },
    comparison: 'All 583 accepted MO-1307 fixture bytes and case-sensitive paths are identical.',
    equal: true,
    members: fixtureComparisons,
  });

  const changedPaths = new Set(EXPECTED_CHANGED_MEMBERS.map(relative));
  const candidatePinSet = {
    pinSetId: 'exact-c3tb-candidate-pins',
    c3t: C3T,
    c3tb: C3TB,
    c3tRootTree: binding.implementation.rootTree,
    productionTree: binding.implementation.productionTree,
    packageIdentity: binding.package.packageIdentity,
    map: currentPins.map,
    candidate: currentPins.candidate,
    consistency: currentPins.consistency,
    binding: currentPins.binding,
    bindingVerification: currentPins.bindingVerification,
    packageDiffFacet: packageDiffFacet.id,
    bindingOnly: true,
  };

  const receiptPaths = ordinalSorted(uniqueOrdinal(reuseIds.map(id => resultById.get(id).receipt.path)));
  prefetch(C3RB_PHASE3C, receiptPaths);
  const receiptCases = new Map(receiptPaths.map(relativePath => {
    const receipt = jsonBytes(gitObject(C3RB_PHASE3C, relativePath).bytes);
    const cases = receipt.rows ?? receipt.cases ?? receipt.records;
    assert.ok(Array.isArray(cases), `${relativePath}: historical receipt has no finite case array`);
    return [relativePath, cases];
  }));
  const rows = [];
  for (const id of reuseIds) {
    const control = mapById.get(id);
    const result = resultById.get(id);
    assert.equal(control.id, id);
    assert.equal(result.id, id);
    assert.equal(result.suite, control.suite, `${id}: suite`);
    assert.equal(result.caseId, control.caseId, `${id}: case`);
    assert.equal(result.negative, control.negative, `${id}: negative`);
    assert.equal(result.result, 'PASS_FRESH', `${id}: historical result`);
    assert.equal(result.adoptedHistoricalOutcome, false, `${id}: historical campaign freshness`);
    assert.ok(result.rawWitness && typeof result.rawWitness === 'object', `${id}: historical raw witness`);
    const rawCaseId = result.rawWitness.id ?? result.rawWitness.name;
    assert.equal(rawCaseId, control.caseId, `${id}: raw witness case`);
    assert.ok(result.rawWitness.result === 'PASS' || result.rawWitness.pass === true, `${id}: raw witness result`);
    const expectedTuple = result.expected ?? control.expectedOriginalTuple;
    assert.ok(expectedTuple && typeof expectedTuple === 'object', `${id}: expected tuple`);
    const receipt = gitPin(C3RB_PHASE3C, result.receipt.path);
    assert.equal(receipt.byteLength, result.receipt.byteLength, `${id}: receipt length`);
    assert.equal(receipt.sha256, result.receipt.sha256, `${id}: receipt digest`);
    const receiptMatches = receiptCases.get(result.receipt.path)
      .filter(row => (row.id ?? row.name) === control.caseId);
    assert.equal(receiptMatches.length, 1, `${id}: historical receipt case cardinality`);
    assert.deepEqual(receiptMatches[0], result.rawWitness, `${id}: historical receipt/raw-witness equality`);

    const facetIds = dependencyFacetIds(control);
    assertOrdinalUnique(facetIds, facetIds.length, `${id}: dependency facets`);
    const facets = facetIds.map(facetId => {
      const facet = dependencyFacets.get(facetId);
      assert.ok(facet, `${id}: missing dependency facet:${facetId}`);
      assert.equal(facet.equal, true, `${id}: unequal dependency facet:${facetId}`);
      return rowFacet(facet);
    });
    const exercisedPaths = new Set();
    for (const facetId of facetIds) {
      const facet = dependencyFacets.get(facetId);
      if (Array.isArray(facet.members)) {
        for (const member of facet.members) exercisedPaths.add(member.path);
      }
      if (facetId === 'field:definitions-except-helper-deadline') {
        exercisedPaths.add(definitionsPath);
        exercisedPaths.add(constantsPath);
      }
    }
    const changedDependencyPaths = ordinalSorted([...exercisedPaths].filter(relativePath => changedPaths.has(relativePath)));
    const expectedFieldHandled = facetIds.includes('field:definitions-except-helper-deadline')
      ? ordinalSorted([definitionsPath, constantsPath])
      : [];
    assert.deepEqual(changedDependencyPaths, expectedFieldHandled, `${id}: unhandled changed dependency`);

    rows.push({
      id,
      historicalId: id,
      suite: control.suite,
      negative: control.negative,
      authorityScope: control.authorityScope,
      caseId: control.caseId,
      expectedTuple,
      historicalAuthority: {
        acceptedCommit: C3RB_PHASE3C,
        controlMap: historicalPins.controlMap,
        controlMapRowSha256: valueSha(control),
        resultAuthority: historicalPins.controlResults,
        resultRowSha256: valueSha(result),
        result: result.result,
        receipt,
        receiptCaseId: control.caseId,
        receiptCaseResult: result.rawWitness.result ?? (result.rawWitness.pass === true ? 'PASS' : null),
        expectedTupleAuthority: {
          commit: C3RB_PHASE3C,
          path: HISTORICAL_FILES.controlResults,
          controlId: id,
          field: 'expected',
        },
        expectedTupleSha256: valueSha(expectedTuple),
        originalHistoricalExpectedTuple: control.expectedOriginalTuple,
        originalHistoricalExpectedTupleSha256: control.expectedOriginalTuple === null
          ? null
          : valueSha(control.expectedOriginalTuple),
        actualTupleSha256: valueSha(result.actual),
        rawWitnessSha256: valueSha(result.rawWitness),
        proofBindings: historicalPins.proofBindings,
        reuseDependencyAuthority: historicalPins.reuseDependencies,
      },
      exercisedDependencies: facets,
      packageDiffApplicability: {
        exactPackageDiffFacet: packageDiffFacet.id,
        changedDependencyPaths,
        fieldComparedChangedPaths: expectedFieldHandled,
        selectedOnlyChangedPaths: ordinalSorted([...changedPaths].filter(relativePath => !changedDependencyPaths.includes(relativePath))),
        unhandledChangedDependencyPaths: [],
      },
      equalityProof: {
        allExercisedFacetsEqual: facets.every(facet => facet.equal),
        expectedTupleBound: true,
        receiptBytesBound: true,
        candidateIdentityBound: true,
        selectedIntersection: false,
      },
      candidatePins: candidatePinSet,
      disposition: 'REUSED_EXACT',
    });
  }

  assertOrdinalUnique(rows.map(row => row.id), 462, 'reuse proof rows');
  assertSameOrdinalSet(rows.map(row => row.id), reuseIds, 'reuse proof exact inventory');
  assert.equal(rows.some(row => selectedSet.has(row.id)), false, 'selected control reused');
  assert.equal(rows.every(row => row.disposition === 'REUSED_EXACT'), true, 'reuse disposition');
  assert.equal(rows.every(row => row.equalityProof.allExercisedFacetsEqual), true, 'dependency equality');

  const countsBySuite = Object.fromEntries(ordinalSorted(uniqueOrdinal(rows.map(row => row.suite))).map(suite => {
    const suiteRows = rows.filter(row => row.suite === suite);
    return [suite, { controls: suiteRows.length, negative: suiteRows.filter(row => row.negative).length }];
  }));
  assert.deepEqual(countsBySuite, {
    'deadline-cleanup': { controls: 4, negative: 3 },
    'governance-primary': { controls: 97, negative: 59 },
    'governance-supplement': { controls: 18, negative: 12 },
    root: { controls: 157, negative: 114 },
    'runtime-main': { controls: 75, negative: 71 },
    'runtime-supplement': { controls: 15, negative: 6 },
    'trust-graph': { controls: 96, negative: 87 },
  });

  const record = {
    kind: 'MO1307Phase3CR2DependencyReuse',
    version: '1.0.0',
    result: 'PASS',
    candidateRole: 'C3TB',
    candidate: C3TB,
    candidateImplementation: C3T,
    historicalAcceptedPhase3C: C3RB_PHASE3C,
    map: currentPins.map,
    mapRule: map.reuseRule,
    counts: {
      historicalInventory: 551,
      selectedFreshHistoricalControls: 89,
      reusedHistoricalControls: rows.length,
      candidateSpecificSupplementalControls: 2,
      omittedHistoricalControls: 0,
      reusedNegativeControls: rows.filter(row => row.negative).length,
      bySuite: countsBySuite,
    },
    candidatePins: candidatePinSet,
    historicalPins,
    packageDiffFacet,
    dependencyFacets: Object.fromEntries(ordinalSorted(dependencyFacets.keys()).map(id => [id, dependencyFacets.get(id)])),
    rows,
    accounting: {
      exactOrdinalPartition: true,
      selectedAndReuseDisjoint: true,
      selectedIdsNeverReused: true,
      reuseRowsOrdinalUnique: true,
      fieldLevelEqualityRequired: true,
      nameInclusionAloneAccepted: false,
    },
    certificationExecuted: false,
    productionExecuted: false,
    helperExecuted: false,
    networkUsed: false,
    push: false,
    tag: false,
  };
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`${canonical({ result: 'PASS', reused: rows.length, selected: 89, supplemental: 2, omitted: 0, output: OUTPUT_RELATIVE })}\n`);
} catch (error) {
  failureRecord.failure = {
    name: error?.name ?? 'Error',
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  };
  if (!fs.existsSync(OUTPUT)) {
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(failureRecord, null, 2)}\n`, { flag: 'wx' });
  }
  process.stderr.write(`${canonical({ result: 'FAIL', failure: failureRecord.failure, output: OUTPUT_RELATIVE })}\n`);
  process.exitCode = 1;
}
