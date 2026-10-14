// Engineering-only Phase 3A campaign. Never shipped or imported by production.
// Runtime semantics use only the selected installed package's public byte API
// and installed CLI. loadBundle is fixture preparation, not semantic authority.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBundle } from '../mo1307-phase2b/test-support.mjs';

const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
const expectedWorkspace = 'C:\\Users\\melsa\\Documents\\Codex\\cca-mo1307-3a';
const nodeHash = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const names = ['could-not-evaluate', 'history-blocker-unavailable', 'informational-ready',
  'metadata-only', 'mixed-precedence', 'mo1306-qualified', 'not-ready', 'post-tag-absent',
  'post-tag-lightweight', 'post-tag-ready', 'post-tag-wrong-target', 'pre-tag-present',
  'qualified', 'ready', 'rest-qualified', 'selective-reuse'];
const small = ['ready', 'qualified', 'not-ready', 'could-not-evaluate', 'rest-qualified'];
const exitFor = { READY: 0, READY_WITH_QUALIFICATIONS: 2, NOT_READY: 3, COULD_NOT_EVALUATE: 4 };
const argv = process.argv.slice(2), options = Object.create(null);
assert.equal(argv.length, 8, 'Expected --mode api-only|native-small --package ABS --output REL --scratch ABS');
for (let i = 0; i < argv.length; i += 2) {
  assert.ok(['--mode', '--package', '--output', '--scratch'].includes(argv[i]));
  assert.equal(Object.hasOwn(options, argv[i]), false);
  options[argv[i]] = argv[i + 1];
}
assert.equal(path.resolve(workspace).toLowerCase(), path.resolve(expectedWorkspace).toLowerCase());
assert.ok(['api-only', 'native-small'].includes(options['--mode']));
assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
assert.equal(process.execArgv.length, 0);
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(fs.readFileSync(process.execPath)), nodeHash);
assert.equal(fs.statSync(process.execPath).size, 93580104);
const inside = (parent, child) => path.resolve(child).toLowerCase().startsWith(path.resolve(parent).toLowerCase() + path.sep);
assert.ok(path.isAbsolute(options['--package']));
assert.ok(path.isAbsolute(options['--scratch']));
assert.equal(path.isAbsolute(options['--output']), false);
const packageRoot = path.resolve(options['--package']), scratch = path.resolve(options['--scratch']);
const output = path.resolve(workspace, options['--output']), mode = options['--mode'];
assert.ok(inside(path.join(workspace, '.cache'), scratch), 'Scratch must be inside the authorized workspace cache');
assert.ok(inside(workspace, packageRoot), 'Installed package must be inside the authorized workspace');
assert.ok(inside(path.join(workspace, 'repositories/cca-conformance/evidence/mo1307/phase3a'), output));
assert.equal(inside(packageRoot, scratch) || inside(scratch, packageRoot), false);
assert.equal(inside(packageRoot, output) || inside(output, packageRoot), false);
assert.notEqual(packageRoot.toLowerCase(), path.join(workspace, 'repositories/memoryos-readiness').toLowerCase());

assert.equal(fs.existsSync(output), false, 'Evidence attempt roots are single-use');
assert.equal(fs.existsSync(scratch), false, 'Scratch roots are single-use');
assert.ok(fs.statSync(packageRoot).isDirectory());
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(scratch, { recursive: true });
const isolatedCwd = path.join(scratch, 'cwd'); fs.mkdirSync(isolatedCwd);
const begun = performance.now(), startedAt = new Date().toISOString();
const receipt = { kind: 'MO1307Phase3AInstalledSemanticCampaign', version: '1.0.0', mode, startedAt,
  packageRoot, scratch, isolatedCwd, runtime: { executable: process.execPath, version: process.version, platform: process.platform, arch: process.arch, sha256: nodeHash },
  apiCases: [], decisions: [], tags: [], determinism: [], nativeCases: [], failures: [],
  sourceFixturePreparationOnly: true, installedRuntimePublicApiOnly: true, nativeMandatoryMo1306OwnedBySeparateDiagnostic: true,
  normativeOperationalMetadataExcluded: true, productionNetworkRequested: false, retries: 0,
  finiteRenameSettlementClaim: false, certificationDisposition: 'NOT_ASSIGNED_BY_ENGINEERING_TOOL' };
const put = (relative, bytes) => {
  const target = path.resolve(output, relative); assert.ok(inside(output, target));
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
  return { path: path.relative(workspace, target).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) };
};
const write = (relative, value) => put(relative, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const errorRecord = error => ({ name: error?.name ?? 'Error', code: error?.code ?? null, stage: error?.stage ?? null,
  message: String(error?.message ?? error), stack: String(error?.stack ?? '') });
// Independent engineering serializer. It does not invoke the product serializer,
// verifier, readiness engine, summary projection or private installed modules.
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  return value;
}
const canonical = value => Buffer.from(JSON.stringify(ordered(value)) + '\n');
function inventory(directory, relative = '') {
  return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap(entry => {
    const member = relative ? relative + '/' + entry.name : entry.name, absolute = path.join(directory, member), stat = fs.lstatSync(absolute);
    assert.equal(stat.isSymbolicLink(), false, 'Linked installed member: ' + member);
    if (stat.isDirectory()) return inventory(directory, member);
    assert.ok(stat.isFile(), 'Nonregular installed member: ' + member);
    const bytes = fs.readFileSync(absolute); return [{ path: member, byteLength: bytes.length, sha256: hash(bytes) }];
  });
}
const before = inventory(packageRoot);
write('installed-before.json', before);
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json')));
assert.equal(packageJson.name, 'memoryos-readiness'); assert.equal(packageJson.version, '0.1.0');
assert.deepEqual(packageJson.exports, { '.': './src/index.mjs' });
assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0); assert.equal(Object.hasOwn(packageJson, 'scripts'), false);
const fixtureRoot = path.join(workspace, 'repositories/cca-conformance/fixtures/mo1307/bundles');
const prepared = new Map();
function prepare(name) {
  const b = loadBundle(name), directory = path.join(fixtureRoot, name), read = leaf => fs.readFileSync(path.join(directory, leaf));
  const input = { configurationBytes: read('configuration.json'), candidateBytes: read('candidate.json'),
    manifestBytes: read('manifest.json'), authorityBytes: read('authority.json'),
    files: b.manifest.entries.map(entry => ({ id: entry.id, bytes: read(entry.path) })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    expectedCandidateDigest: b.pins.expectedCandidateDigest, trustedAuthorityDigest: b.pins.trustedAuthorityDigest };
  const expected = read('expected-result.json'); assert.deepEqual(expected, canonical(b.result), name + ' fixture canonical bytes');
  const row = { name, bundle: b, directory, input, expected, expectedResult: JSON.parse(expected) }; prepared.set(name, row); return row;
}
for (const name of mode === 'api-only' ? names : small) prepare(name);
const fixtureBindings = [...prepared.values()].map(c => ({ name: c.name, files: inventory(c.directory) }));
write('fixture-bindings.json', fixtureBindings);
const toolingPaths = [fileURLToPath(import.meta.url), fileURLToPath(new URL('../mo1307-phase2b/test-support.mjs', import.meta.url)),
  path.join(workspace, 'repositories/memoryos-readiness/src/canonical.mjs')];
const toolingBindings = toolingPaths.map(file => { const bytes = fs.readFileSync(file); return { path: path.relative(workspace, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; });
write('campaign.json', { ...receipt, intendedApiCases: mode === 'api-only' ? names : small, intendedNativeCases: mode === 'native-small' ? small : [],
  fixtureBindings, toolingBindings, installedBeforeSha256: hash(canonical(before)),
  preparationAuthority: 'Source loadBundle only reads fixture structures; no source semantic calculation is used. Fixture expected bytes and pins are authoritative comparisons.',
  nativePolicy: 'One evaluate and one independent verify per selected case; READY repeated for determinism. Stop after first unexpected native result. MO1306 native is never invoked by this tool.',
  apiPolicy: 'Each finite case runs once; independent later API cases may continue after failure, with every failure preserved. No retry.',
  nativeChildEngineeringWatchdogMs: 45000, nativeWatchdogScope: 'Engineering interruption only; never a product rename settlement guarantee.' });
const normativeKeys = ['candidate', 'candidateDigest', 'profile', 'stage', 'gates', 'blockers', 'cneReasons', 'qualifications', 'providers', 'history', 'readiness'];
function compareNormative(actualBytes, expectedBytes, returned = null) {
  assert.deepEqual(Buffer.from(actualBytes), Buffer.from(expectedBytes), 'Complete canonical result bytes differ');
  assert.equal(hash(actualBytes), hash(expectedBytes), 'Independent complete-result SHA-256 differs');
  const actual = JSON.parse(Buffer.from(actualBytes)), expected = JSON.parse(Buffer.from(expectedBytes));
  assert.deepEqual(Buffer.from(actualBytes), canonical(actual), 'Result bytes are not independent canonical encoding');
  assert.equal(actual.assessment.gates.length, 22);
  for (const key of normativeKeys) assert.deepEqual(actual.assessment[key], expected.assessment[key], key + ' differs');
  for (const key of ['readinessDigest', 'proofBindingDigest']) {
    assert.equal(actual[key], expected[key], key + ' differs');
    if (returned) assert.equal(returned[key], actual[key], 'API envelope ' + key + ' differs');
  }
  return { fieldsExactlyEqual: [...normativeKeys, 'readinessDigest', 'proofBindingDigest', 'completeCanonicalResultBytes'],
    resultByteLength: actualBytes.length, resultSha256: hash(actualBytes), readiness: actual.assessment.readiness,
    candidateDigest: actual.assessment.candidateDigest, readinessDigest: actual.readinessDigest, proofBindingDigest: actual.proofBindingDigest,
    gates: actual.assessment.gates.length, blockers: actual.assessment.blockers.length, cneReasons: actual.assessment.cneReasons.length,
    qualifications: actual.assessment.qualifications.length, history: actual.assessment.history.length, providers: actual.assessment.providers.length };
}
function inputSizes(input) {
  return { configuration: input.configurationBytes.length, candidate: input.candidateBytes.length, manifest: input.manifestBytes.length,
    authority: input.authorityBytes.length, files: input.files.length, evidenceBytes: input.files.reduce((sum, file) => sum + file.bytes.length, 0),
    largestFileBytes: Math.max(0, ...input.files.map(file => file.bytes.length)) };
}
let api;
async function apiCall(directory, operation, input, expectedBytes, decisionExpected = null, expectedError = null) {
  const at = performance.now(), row = { operation, expectedError, startedAt: new Date().toISOString(), result: 'FAIL' };
  let returned = null, caught = null;
  try { returned = await api[operation === 'evaluate' ? 'evaluateReadiness' : 'verifyReadiness'](input); }
  catch (error) { caught = error; }
  row.elapsedMs = performance.now() - at;
  try {
    if (caught) {
      row.error = errorRecord(caught);
      if (expectedError) { assert.equal(caught.code, expectedError); row.result = 'PASS'; row.rejectedAsExpected = true; return { row, returned: null }; }
      throw caught;
    }
    if (returned?.resultBytes) row.resultBytes = put(directory + '/' + operation + '.result.data', Buffer.from(returned.resultBytes));
    assert.equal(expectedError, null, 'Expected rejection was absent');
    row.parity = compareNormative(returned.resultBytes, expectedBytes, returned);
    if (operation === 'verify') { assert.deepEqual(returned.decision, decisionExpected); row.decision = returned.decision; }
    row.result = 'PASS'; return { row, returned };
  } catch (error) { row.failure = errorRecord(error); throw error; }
  finally { write(directory + '/' + operation + '.receipt.json', row); }
}
function decisionFor(result, decision) {
  return { kind: 'MemoryOSReadinessHumanDecision', version: '1.0.0', candidateDigest: result.assessment.candidateDigest,
    readinessDigest: result.readinessDigest, proofBindingDigest: result.proofBindingDigest, decision, actor: null,
    timestamp: null, reason: 'Phase 3A engineering binding vector; no human release authorization.', attestation: null,
    authenticity: 'NOT_VERIFIED_BY_MEMORYOS' };
}
const verifyInput = (c, bytes, decisionBytes = null) => ({ ...c.input, resultBytes: Buffer.from(bytes), decisionBytes });
function expectedSummary(result, operation, decision = null) {
  const a = result.assessment;
  return canonical({ kind: 'MemoryOSReadinessSummary', version: '1.0.0', operation, readiness: a.readiness,
    readinessDigest: result.readinessDigest, proofBindingDigest: result.proofBindingDigest, blockerCount: a.blockers.length,
    qualificationCount: a.qualifications.length, cneCount: a.cneReasons.length, decision });
}
function nativeRun(c, operation, destination, directory) {
  const args = [path.join(packageRoot, 'bin/memoryos-readiness.mjs'), operation, '--input-root', c.nativeInput,
    '--config', 'configuration.json', '--authority', 'authority.json', '--authority-sha256', c.input.trustedAuthorityDigest,
    '--candidate-sha256', c.input.expectedCandidateDigest, operation === 'evaluate' ? '--output-root' : '--result-root', destination];
  const at = performance.now(), child = spawnSync(process.execPath, args, { cwd: isolatedCwd,
    env: { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' }, shell: false, windowsHide: true,
    timeout: 45000, maxBuffer: 1024 * 1024, encoding: null });
  const stdout = child.stdout ?? Buffer.alloc(0), stderr = child.stderr ?? Buffer.alloc(0);
  const row = { operation, executable: process.execPath, args, cwd: isolatedCwd, environmentKeys: ['SystemRoot', 'WINDIR'],
    elapsedMs: performance.now() - at, exit: child.status, signal: child.signal, error: child.error?.code ?? null,
    stdout: put(directory + '/' + operation + '.stdout.data', stdout), stderr: put(directory + '/' + operation + '.stderr.data', stderr),
    expectedExit: operation === 'verify' ? 0 : exitFor[c.expectedResult.assessment.readiness], result: 'FAIL',
    engineeringWatchdogMs: 45000, finiteRenameSettlementClaim: false, cleanupProofOwnedBySeparateNativeObserver: true };
  try {
    assert.ifError(child.error); assert.equal(child.signal, null); assert.equal(child.status, row.expectedExit, stderr.toString('utf8'));
    assert.equal(stderr.length, 0); assert.deepEqual(stdout, expectedSummary(c.expectedResult, operation));
    assert.equal(stdout.at(-1), 10); row.result = 'PASS'; return row;
  } catch (error) { row.failure = errorRecord(error); throw error; }
  finally { write(directory + '/' + operation + '.receipt.json', row); }
}
try {
  process.chdir(isolatedCwd);
  api = await import(pathToFileURL(path.join(packageRoot, 'src/index.mjs')).href);
  assert.deepEqual(Object.keys(api).sort(), ['evaluateReadiness', 'verifyReadiness']);
  if (mode === 'native-small') {
    // Finish all input/parent preparation before any helper observes ancestor identities.
    for (const [index, c] of [...prepared.values()].entries()) {
      const caseRoot = path.join(scratch, 'n' + index); fs.mkdirSync(caseRoot);
      c.nativeInput = path.join(caseRoot, 'i'); fs.cpSync(c.directory, c.nativeInput, { recursive: true });
      c.publicationParent = path.join(caseRoot, 'p'); fs.mkdirSync(c.publicationParent);
      fs.writeFileSync(path.join(c.publicationParent, 'owned-parent.data'), 'Phase 3A stable engineering-owned parent.\n');
      c.destination = path.join(c.publicationParent, 'r');
      // Directory membership growth is completed before native input/output inspection.
      for (const name of ['api', 'native', 'repeat']) fs.mkdirSync(path.join(output, c.name, name), { recursive: true });
    }
  }
  for (const c of prepared.values()) {
    const row = { name: c.name, result: 'FAIL', inputSizes: inputSizes(c.input), operations: [] };
    try {
      const evaluated = await apiCall(c.name + '/api', 'evaluate', c.input, c.expected);
      row.operations.push(evaluated.row); c.apiResult = Buffer.from(evaluated.returned.resultBytes);
      const verified = await apiCall(c.name + '/api', 'verify', verifyInput(c, c.apiResult), c.expected);
      row.operations.push(verified.row); row.parity = compareNormative(c.apiResult, c.expected, evaluated.returned);
      if (c.name === 'mo1306-qualified') {
        assert.equal(row.parity.readiness, 'READY_WITH_QUALIFICATIONS'); assert.equal(row.parity.qualifications, 10);
        row.requiredMo1306SemanticVector = true;
      }
      row.result = 'PASS'; c.apiAccepted = true;
    } catch (error) { row.failure = errorRecord(error); receipt.failures.push({ scope: 'api', name: c.name, ...errorRecord(error) }); }
    finally { receipt.apiCases.push(row); write(c.name + '/api/receipt.json', row); }
    if (mode === 'native-small') {
      if (row.result !== 'PASS') break;
      const native = { name: c.name, result: 'FAIL', nativeHelperAndIntegratedWorker: true, resultPublication: true, operations: [] };
      try {
        native.operations.push(nativeRun(c, 'evaluate', c.destination, c.name + '/native'));
        const finalPath = path.join(c.destination, 'memoryos-readiness-result.json'), bytes = fs.readFileSync(finalPath);
        native.resultBytes = put(c.name + '/native/result.data', bytes);
        native.cliApiParity = compareNormative(bytes, c.apiResult); native.fixtureParity = compareNormative(bytes, c.expected);
        assert.deepEqual(fs.readdirSync(c.destination), ['memoryos-readiness-result.json']);
        native.operations.push(nativeRun(c, 'verify', c.destination, c.name + '/native'));
        assert.deepEqual(fs.readFileSync(finalPath), bytes); assert.deepEqual(fs.readdirSync(c.destination), ['memoryos-readiness-result.json']);
        native.verifyNoMutation = true;
        if (c.name === 'ready') {
          const repeatRoot = path.join(c.publicationParent, 's');
          native.repeat = nativeRun(c, 'evaluate', repeatRoot, c.name + '/repeat');
          const again = fs.readFileSync(path.join(repeatRoot, 'memoryos-readiness-result.json'));
          native.repeat.resultBytes = put(c.name + '/repeat/result.data', again);
          native.repeat.parity = compareNormative(again, bytes);
          native.repeat.newProcess = true; native.repeat.newOutputRoot = true;
          native.repeat.sessionObservation = 'Fresh production CLI invocation; session identifiers remain nonnormative and require separate lifecycle observation.';
        }
        native.result = 'PASS';
      } catch (error) { native.failure = errorRecord(error); receipt.failures.push({ scope: 'native', name: c.name, ...errorRecord(error) }); }
      finally { receipt.nativeCases.push(native); write(c.name + '/native/receipt.json', native); }
      if (native.result !== 'PASS') break;
    }
  }
  if (mode === 'api-only') {
    const decisions = [['ready', 'APPROVE'], ['ready', 'REJECT'], ['qualified', 'APPROVE'],
      ['mo1306-qualified', 'APPROVE'], ['not-ready', 'APPROVE'],
      ...['candidateDigest', 'readinessDigest', 'proofBindingDigest'].map(field => ['ready', 'APPROVE', field])];
    for (const [index, spec] of decisions.entries()) {
      const [name, decision, mismatch] = spec, c = prepared.get(name), directory = 'decisions/' + index;
      const row = { name, decision, mismatch: mismatch ?? null, result: 'FAIL' };
      try {
        assert.ok(c.apiAccepted && c.apiResult, 'Prior accepted API vector unavailable; no retry');
        const value = decisionFor(c.expectedResult, decision);
        if (mismatch) value[mismatch] = 'sha256:' + (value[mismatch] === 'sha256:' + 'f'.repeat(64) ? 'e' : 'f').repeat(64);
        const bytes = canonical(value); row.input = put(directory + '/decision.data', bytes);
        const projection = mismatch ? null : { decision, consistency: name === 'not-ready' ? 'CONTRARY_TO_READINESS' : 'CONSISTENT',
          authenticity: 'NOT_VERIFIED_BY_MEMORYOS' };
        const actual = await apiCall(directory, 'verify', verifyInput(c, c.apiResult, bytes), c.expected, projection,
          mismatch ? 'MO1307_DECISION_MISMATCH' : null);
        row.operation = actual.row; row.readinessUnaffected = !mismatch; row.result = 'PASS';
      } catch (error) { row.failure = errorRecord(error); receipt.failures.push({ scope: 'decision', name, mismatch: mismatch ?? null, ...errorRecord(error) }); }
      finally { receipt.decisions.push(row); write(directory + '/receipt.json', row); }
    }
    for (const [name, checkCode] of [['ready', null], ['post-tag-ready', null], ['pre-tag-present', 'TAG_PRESENCE'],
      ['post-tag-absent', 'TAG_PRESENCE'], ['post-tag-lightweight', 'TAG_ANNOTATION'], ['post-tag-wrong-target', 'TAG_TARGET']]) {
      const c = prepared.get(name), row = { name, suppliedObservationOnly: true, gitExecuted: false, expectedCheckCode: checkCode, result: 'FAIL' };
      try {
        assert.ok(c.apiAccepted && c.apiResult); const actual = JSON.parse(c.apiResult).assessment;
        assert.equal(actual.readiness, checkCode ? 'NOT_READY' : 'READY');
        if (checkCode) assert.ok(actual.blockers.some(item => item.gateId === 'tag' && item.checkCode === checkCode));
        assert.equal(actual.stage, c.expectedResult.assessment.stage); row.stage = actual.stage; row.result = 'PASS';
      } catch (error) { row.failure = errorRecord(error); receipt.failures.push({ scope: 'tag', name, ...errorRecord(error) }); }
      receipt.tags.push(row);
    }
    write('tag-matrix.json', receipt.tags);
    // Nonsemantic caller property ordering changes only: signed manifest/file arrays remain intact.
    for (const c of prepared.values()) {
      const row = { name: c.name, result: 'FAIL', repeatedPublicCalls: 1, preservesSignedSetOrdering: true, newNativeSessionClaim: false };
      try {
        assert.ok(c.apiAccepted && c.apiResult, 'No accepted first result to compare; no retry');
        const reversed = Object.fromEntries(Object.entries(c.input).reverse());
        const again = await apiCall(c.name + '/api-order-repeat', 'evaluate', reversed, c.apiResult);
        row.operation = again.row; row.result = 'PASS';
      } catch (error) { row.failure = errorRecord(error); receipt.failures.push({ scope: 'api-order-determinism', name: c.name, ...errorRecord(error) }); }
      finally { receipt.determinism.push(row); write(c.name + '/api-order-repeat/receipt.json', row); }
    }
  }
} catch (error) { receipt.failures.push({ scope: 'campaign', ...errorRecord(error) }); }
finally {
  try {
    const after = inventory(packageRoot); write('installed-after.json', after);
    assert.deepEqual(after, before); receipt.installedIntegrity = { result: 'PASS', members: before.length, beforeSha256: hash(canonical(before)),
      afterSha256: hash(canonical(after)), allMembersByteIdentical: true, noNewPackageMembers: true };
  } catch (error) { receipt.installedIntegrity = { result: 'FAIL', error: errorRecord(error) }; receipt.failures.push({ scope: 'installed-integrity', ...errorRecord(error) }); }
  try {
    for (const binding of fixtureBindings) assert.deepEqual(inventory(path.join(fixtureRoot, binding.name)), binding.files);
    for (const binding of toolingBindings) {
      const bytes = fs.readFileSync(path.join(workspace, binding.path)); assert.equal(bytes.length, binding.byteLength); assert.equal(hash(bytes), binding.sha256);
    }
    receipt.fixtureAndToolingUnchanged = true;
  } catch (error) { receipt.fixtureAndToolingUnchanged = false; receipt.failures.push({ scope: 'engineering-input-integrity', ...errorRecord(error) }); }
  receipt.expectedApiCases = mode === 'api-only' ? 16 : 5; receipt.expectedNativeCases = mode === 'native-small' ? 5 : 0;
  receipt.result = receipt.failures.length === 0 && receipt.apiCases.length === receipt.expectedApiCases
    && receipt.nativeCases.length === receipt.expectedNativeCases ? 'PASS' : 'FAIL';
  receipt.elapsedMs = performance.now() - begun; receipt.finishedAt = new Date().toISOString();
  receipt.remainingScope = ['Mandatory MO1306 native diagnostic and cleanup proof are separate.',
    'Public API repetitions here use fresh workers but the same engineering process; full new-process native repeats require separate campaign.',
    'No process topology, hard OS RSS enforcement, packet isolation or final certification label is inferred from semantic results.'];
  write('receipt.json', receipt);
  process.stdout.write(JSON.stringify({ result: receipt.result, mode, apiCases: receipt.apiCases.length, nativeCases: receipt.nativeCases.length,
    failures: receipt.failures.length, installedIntegrity: receipt.installedIntegrity.result, elapsedMs: receipt.elapsedMs,
    receipt: path.join(output, 'receipt.json') }) + '\n');
  process.exitCode = receipt.result === 'PASS' ? 0 : 1;
}

