import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalBytes, canonicalDigest, digest } from '../../memoryos-readiness/src/canonical.mjs';
import { verifyHistoryQualificationsProviders } from '../../memoryos-readiness/src/evidence-history.mjs';
import { normalizeEvidenceGrant } from '../../memoryos-readiness/src/evidence-graph.mjs';
import { verifyEvidence, verifyResultEvidence } from '../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, inputOf, repin, envelopeFor, grantFor, throwsCode } from '../tools/mo1307-phase2b/test-support.mjs';

// This local seam exercises post-authority cross-record semantics. It explicitly
// constructs fixture-owned grants; these helpers never establish production
// trust. The integrated verifier tests below use independently pinned inputs.
function context(bundle, refresh = true) {
  if (refresh) repin(bundle);
  return {
    candidate: bundle.candidate,
    candidateDigest: bundle.pins.expectedCandidateDigest,
    authority: bundle.authority,
    selections: bundle.authority.assessment.grants.map(grant => ({
      grant, grantDigest: canonicalDigest(normalizeEvidenceGrant(grant, bundle.authority.provenance)),
      claim: bundle.envelopes.get(grant.envelopeId).claim,
      claimDigest: canonicalDigest(bundle.envelopes.get(grant.envelopeId).claim),
    })),
  };
}
const run = bundle => verifyHistoryQualificationsProviders(context(bundle));
const history = bundle => envelopeFor(bundle, 'HISTORICAL_DISPOSITION').claim;
const scope = bundle => envelopeFor(bundle, 'SCOPE_AUTHORITY').claim;
const provider = (bundle, id) => envelopeFor(bundle, 'PROVIDER_CERTIFICATION', id).claim;
function unavailable(bundle, gateId) {
  const slot = bundle.authority.assessment.slots.find(row => row.gateId === gateId);
  const ids = [...slot.grantIds];
  for (const row of bundle.authority.assessment.slots.filter(row => row.grantIds.some(id => ids.includes(id)))) {
    row.grantIds = []; row.availability = 'UNAVAILABLE'; row.reason = 'AUTHORITY_UNAVAILABLE';
  }
  bundle.authority.assessment.grants = bundle.authority.assessment.grants.filter(grant => !ids.includes(grant.id));
}
function qHistory(record, scopeId) {
  return { id: 'q.' + record.id, type: 'MemoryOSReadinessQualification', version: '1.0.0', gateIds: [...record.affectedGateIds],
    provider: null, scopeId, reasonCode: 'HISTORICAL_UNRESOLVED_PRESERVED', impact: 'RELEASE_IMPACTING',
    disclosureCode: 'HISTORICAL_UNRESOLVED_PRESERVED', conditionIds: [record.conditionId] };
}

test('HB01: all sixteen Phase 1 bundles preserve exact history, qualifications and independent provider projections', () => {
  for (const name of ['ready', 'qualified', 'not-ready', 'could-not-evaluate', 'mixed-precedence', 'history-blocker-unavailable',
    'informational-ready', 'metadata-only', 'mo1306-qualified', 'post-tag-absent', 'post-tag-lightweight', 'post-tag-ready',
    'post-tag-wrong-target', 'pre-tag-present', 'rest-qualified', 'selective-reuse']) {
    const bundle = loadBundle(name), actual = run(bundle);
    for (const key of ['history', 'qualifications', 'providers']) assert.deepEqual(actual[key], bundle.result.assessment[key], `${name}:${key}`);
    assert.equal(Object.hasOwn(actual, 'readiness'), false);
    assert.equal(Object.hasOwn(actual, 'gates'), false);
  }
});

test('HB02: MO-1306 binds nineteen immutable raw rows and exact twelve negative history projections', () => {
  const bundle = loadBundle('mo1306-qualified'), actual = run(bundle);
  const sourceEntry = bundle.manifest.entries.find(entry => entry.id === 'released.history');
  const sourceBytes = bundle.files.get(sourceEntry.id), raw = JSON.parse(sourceBytes);
  assert.equal(sourceBytes.length, sourceEntry.byteLength); assert.equal(digest(sourceBytes), sourceEntry.sha256);
  assert.equal(raw.records.length, 19); assert.equal(actual.history.length, 12);
  assert.equal(raw.records.filter(record => record.historicalFailureOrUnclosedGate).length, 12);
  for (const record of raw.records) {
    const bound = bundle.manifest.entries.find(entry => entry.id === 'history-source.' + record.id);
    assert.ok(bound); assert.equal(digest(bundle.files.get(bound.id)), bound.sha256);
    const projection = actual.history.find(row => row.id === 'history.' + record.id);
    if (record.historicalFailureOrUnclosedGate) {
      assert.ok(projection); assert.equal(projection.originalDisposition, record.disposition); assert.notEqual(projection.originalOutcome, 'PASS');
    } else assert.equal(projection, undefined);
  }
  assert.equal(actual.history.find(row => row.id === 'history.native-publication').originalDisposition, 'FAIL / UNRESOLVED');
  assert.equal(actual.history.find(row => row.id === 'history.hosted-36357568243').originalDisposition, 'FAILURE / HOSTED_BOOTSTRAP_UNRESOLVED');
  assert.equal(actual.history.find(row => row.id === 'history.diagnostic-36396330199').originalDisposition, 'FAILURE / STILL_UNRESOLVED / HOSTED_DIAGNOSTIC_EXHAUSTED');
  assert.deepEqual(actual.historicalApplicability, []);
});

test('HB03: MO-1306 preserves all independent provider axes and ten disclosures', () => {
  const actual = run(loadBundle('mo1306-qualified'));
  const by = id => actual.providers.find(row => row.provider === id);
  assert.equal(actual.qualifications.length, 10);
  assert.equal(actual.qualifications.filter(row => row.reasonCode === 'HISTORICAL_UNRESOLVED_PRESERVED').length, 5);
  assert.equal(by('generic').validation, 'REAL_EXECUTION_CERTIFIED'); assert.equal(by('generic').execution, 'REAL_EXECUTION_CERTIFIED');
  assert.equal(by('github').validation, 'OFFLINE_VALIDATED'); assert.equal(by('github').execution, 'HOSTED_EXECUTION_NOT_CERTIFIED');
  assert.equal(by('github').sourceExecutionLabel, 'NOT_CERTIFIED'); assert.equal(by('github').support, 'SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION');
  assert.deepEqual(by('github').hostedCases, { cne: false, fail: false, parity: false, pass: false });
  for (const id of ['azure', 'gitlab', 'jenkins']) {
    assert.equal(by(id).validation, 'CONTRACT_VALIDATED'); assert.equal(by(id).execution, 'NOT_LIVE_PROVIDER_CERTIFIED');
    assert.equal(by(id).support, 'SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY');
  }
});

test('HB04: known recurrence links only active mandatory gates, including an unavailable current gate', () => {
  const bundle = loadBundle('history-blocker-unavailable'), actual = run(bundle);
  assert.equal(bundle.authority.assessment.slots.find(row => row.gateId === 'security').availability, 'UNAVAILABLE');
  assert.equal(actual.historicalApplicability.length, 1);
  assert.equal(actual.historicalApplicability[0].gateId, 'security');
  assert.equal(actual.historicalApplicability[0].conditionId, actual.history[0].conditionId);
  assert.equal(actual.history[0].originalOutcome, 'FAIL');
});

test('HB05: observed recurrence preserves historical outcome while excluding optional and inactive links', () => {
  const bundle = loadBundle('mo1306-qualified');
  const record = history(bundle).detail.records.find(row => row.id === 'history.hosted-36357568243');
  record.recurrence = 'OBSERVED';
  const actual = run(bundle);
  assert.deepEqual(actual.historicalApplicability.map(row => row.gateId), ['provider.github']);
  assert.equal(actual.history.find(row => row.id === record.id).originalDisposition, record.originalDisposition);
  const rest = loadBundle('rest-qualified');
  const adopted = structuredClone(record); adopted.affectedGateIds = ['provider.github', 'provider.github.hosted'];
  adopted.sourceIds = [...grantFor(rest, envelopeFor(rest, 'HISTORICAL_DISPOSITION')).sourceIds];
  adopted.authoritySourceIds = [...grantFor(rest, envelopeFor(rest, 'HISTORICAL_DISPOSITION')).authoritySourceIds];
  history(rest).detail.records = [adopted]; history(rest).qualifications = [qHistory(adopted, history(rest).scopeId)];
  scope(rest).detail.conditionIds = [adopted.conditionId];
  scope(rest).detail.qualificationIds = [...scope(rest).detail.qualificationIds, history(rest).qualifications[0].id].sort();
  assert.deepEqual(run(rest).historicalApplicability, []);
});

test('HB06: current-applicable history cannot erase an unavailable gate condition', () => {
  const bundle = loadBundle('history-blocker-unavailable');
  history(bundle).detail.records[0].disposition = 'CURRENT_APPLICABLE';
  history(bundle).detail.records[0].recurrence = 'NOT_OBSERVED';
  assert.equal(run(bundle).historicalApplicability[0].gateId, 'security');
});

for (const [label, mutation] of [
  ['FAIL to PASS rewrite', claim => { claim.detail.records[0].originalOutcome = 'PASS'; }],
  ['BLOCKED removal', claim => { claim.detail.records = claim.detail.records.filter(row => row.originalOutcome !== 'BLOCKED'); }],
  ['changed historical disposition', claim => { claim.detail.records[0].originalDisposition = 'PASS'; }],
  ['wrong historical source', claim => { claim.detail.records[0].sourceIds = ['substituted.source']; }],
  ['wrong candidate provenance', claim => { claim.originCandidate = 'sha256:' + '0'.repeat(64); }],
  ['omitted required unresolved history', claim => { claim.detail.records = claim.detail.records.filter(row => row.id !== 'history.native-publication'); }],
  ['fabricated resolution', claim => { claim.detail.records[1].disposition = 'SUPERSEDED'; }],
  ['duplicate conflicting history', claim => { claim.detail.records.push({ ...claim.detail.records[0], originalOutcome: 'FAIL' }); }],
]) test('HB07 immutable granted history rejects ' + label, () => {
  const bundle = loadBundle('mo1306-qualified');
  mutation(history(bundle));
  throwsCode(assert, () => verifyHistoryQualificationsProviders(context(bundle, false)), 'EVIDENCE_AUTHORITY');
});

test('HB08: malformed PASS history and duplicate conflicting rows remain invalid with fixture-owned updated pins', () => {
  for (const mutation of [
    claim => { claim.detail.records[0].originalOutcome = 'PASS'; },
    claim => { claim.detail.records.splice(1, 0, { ...claim.detail.records[0], originalOutcome: 'FAIL' }); },
  ]) {
    const bundle = loadBundle('mo1306-qualified'); mutation(history(bundle));
    throwsCode(assert, () => run(bundle), 'HISTORY_MISMATCH', 'EVALUATION');
  }
});

test('HB09: reviewed history must resolve nested source and authority lineage', () => {
  for (const key of ['sourceIds', 'authoritySourceIds']) {
    const bundle = loadBundle('mo1306-qualified'); history(bundle).detail.records[0][key] = ['ungranted.source'];
    throwsCode(assert, () => run(bundle), 'HISTORY_MISMATCH', 'EVALUATION');
  }
});

test('HB10: supplied scope and history inventories reject omissions and unknown condition references', () => {
  for (const mutation of [
    bundle => { history(bundle).detail.records.shift(); },
    bundle => { scope(bundle).detail.conditionIds.shift(); },
    bundle => { scope(bundle).detail.conditionIds.push('condition.unknown'); scope(bundle).detail.conditionIds.sort(); },
  ]) {
    const bundle = loadBundle('mo1306-qualified'); mutation(bundle);
    throwsCode(assert, () => run(bundle), 'HISTORY_MISMATCH', 'EVALUATION');
  }
});

for (const [label, mutation] of [
  ['omission', claim => { claim.qualifications = []; }],
  ['impact downgrade', claim => { claim.qualifications[0].impact = 'INFORMATIONAL'; }],
  ['wrong provider', claim => { claim.qualifications[0].provider = 'gitlab'; }],
  ['wrong gate', claim => { claim.qualifications[0].gateIds = ['provider.azure', 'provider.azure.live']; }],
  ['unknown code', claim => { claim.qualifications[0].reasonCode = 'INVENTED'; }],
  ['wrong scope authority', claim => { claim.qualifications[0].scopeId = 'another.scope'; }],
  ['disclosure removal', claim => { delete claim.qualifications[0].disclosureCode; }],
  ['fabricated authority member', claim => { claim.qualifications[0].authority = 'self'; }],
]) test('QB01: qualifications reject ' + label, () => {
  const bundle = loadBundle('mo1306-qualified'); mutation(provider(bundle, 'github'));
  throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
});

test('QB02: scope qualification inventory rejects extra, omitted and conflicting records', () => {
  for (const mutation of [
    bundle => { scope(bundle).detail.qualificationIds.pop(); },
    bundle => { scope(bundle).detail.qualificationIds.push('q.unknown'); scope(bundle).detail.qualificationIds.sort(); },
    bundle => { const q = structuredClone(provider(bundle, 'github').qualifications[0]); q.scopeId = 'another.scope'; envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim.qualifications = [q]; },
  ]) {
    const bundle = loadBundle('mo1306-qualified'); mutation(bundle);
    throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
  }
});

test('QB03: an identical qualification shared by granted claims merges exact claim/grant identities', () => {
  const bundle = loadBundle('mo1306-qualified');
  const q = provider(bundle, 'github').qualifications[0];
  const original = run(bundle).qualifications.find(row => row.id === q.id);
  envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim.qualifications = [structuredClone(q)];
  const actual = run(bundle).qualifications.find(row => row.id === q.id);
  assert.equal(actual.evidenceClaimDigests.length, original.evidenceClaimDigests.length + 1);
  assert.equal(actual.grantDigests.length, original.grantDigests.length + 1);
  assert.deepEqual(actual.evidenceClaimDigests, [...actual.evidenceClaimDigests].sort());
});

test('QB04: historical disclosures require exact preserved condition and gate set', () => {
  for (const mutation of [
    claim => { claim.qualifications[0].conditionIds = ['condition.unknown']; },
    claim => { claim.qualifications[0].gateIds = ['security']; },
    claim => { claim.detail.records.find(row => row.conditionId === claim.qualifications[0].conditionIds[0]).disposition = 'SUPERSEDED'; },
  ]) {
    const bundle = loadBundle('mo1306-qualified'); mutation(history(bundle));
    throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
  }
});

test('QB05: bounded advisory and REST scope require their exact disclosures', () => {
  for (const [name, type] of [['mo1306-qualified', 'SUPPLY_CHAIN_REVIEW'], ['rest-qualified', 'REST_CONTRACT']]) {
    const bundle = loadBundle(name), claim = envelopeFor(bundle, type).claim;
    const ids = claim.qualifications.map(row => row.id); claim.qualifications = [];
    scope(bundle).detail.qualificationIds = scope(bundle).detail.qualificationIds.filter(id => !ids.includes(id));
    throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
  }
});

test('QB06: unavailable scope retains known qualified history without inventing completeness', () => {
  const bundle = loadBundle('mo1306-qualified'); unavailable(bundle, 'scope');
  const actual = run(bundle); assert.equal(actual.qualifications.length, 10); assert.equal(actual.history.length, 12);
});

test('QB07: unavailable history retains known disclosures but still validates supplied scope condition inventory', () => {
  const bundle = loadBundle('mo1306-qualified');
  envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim.qualifications = structuredClone(history(bundle).qualifications);
  unavailable(bundle, 'history');
  assert.equal(run(bundle).qualifications.length, 10); assert.deepEqual(run(bundle).history, []);
  scope(bundle).detail.conditionIds = [];
  throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
});

test('QB08: both unavailable inventories retain locally valid known qualifications and defer missing inventory references', () => {
  const bundle = loadBundle('mo1306-qualified');
  envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim.qualifications = structuredClone(history(bundle).qualifications);
  unavailable(bundle, 'history'); unavailable(bundle, 'scope');
  const actual = run(bundle); assert.equal(actual.qualifications.length, 10); assert.deepEqual(actual.history, []);
  envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim.qualifications[0].impact = 'INFORMATIONAL';
  throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
});

for (const id of ['github', 'gitlab', 'jenkins', 'azure']) test('PB01 immutable MO-1306 authority rejects false ' + id + ' execution promotion', () => {
  const bundle = loadBundle('mo1306-qualified'), claim = provider(bundle, id);
  claim.detail.execution = id === 'github' ? 'HOSTED_EXECUTION_CERTIFIED' : 'LIVE_PROVIDER_CERTIFIED';
  claim.detail.sourceExecutionLabel = claim.detail.execution; claim.detail.support = 'SUPPORTED';
  if (id === 'github') claim.detail.hostedCases = { cne: true, fail: true, parity: true, pass: true };
  claim.qualifications = [];
  throwsCode(assert, () => verifyHistoryQualificationsProviders(context(bundle, false)), 'EVIDENCE_AUTHORITY');
});

test('PB02: full GitHub hosted certification requires all four exact case facts', () => {
  for (const key of ['pass', 'fail', 'cne', 'parity']) {
    const bundle = loadBundle('ready'); provider(bundle, 'github').detail.hostedCases[key] = false;
    throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
  }
});

test('PB03: provider labels cannot alias, substitute provider identity, or remove Generic certification unnoticed', () => {
  for (const mutation of [
    claim => { claim.detail.validation = 'OFFLINE_VALIDATED'; },
    claim => { claim.detail.execution = 'NOT_CERTIFIED'; claim.detail.sourceExecutionLabel = 'NOT_CERTIFIED'; },
    claim => { claim.detail.provider = 'github'; },
  ]) {
    const bundle = loadBundle('mo1306-qualified'); mutation(provider(bundle, 'generic'));
    throwsCode(assert, () => verifyHistoryQualificationsProviders(context(bundle, false)), 'EVIDENCE_AUTHORITY');
  }
  const bundle = loadBundle('qualified'); provider(bundle, 'gitlab').detail.sourceExecutionLabel = 'NOT_CERTIFIED';
  throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
});

test('PB04: contract-only providers cannot claim SUPPORTED while not live certified', () => {
  for (const id of ['azure', 'gitlab', 'jenkins']) {
    const bundle = loadBundle('mo1306-qualified'); provider(bundle, id).detail.support = 'SUPPORTED';
    throwsCode(assert, () => run(bundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
  }
});

test('PB05: known lower-minimum unsupported facts are retained for 2A blockers with no fabricated certification', () => {
  const bundle = loadBundle('ready'), claim = provider(bundle, 'github');
  claim.detail.implementation = 'NOT_IMPLEMENTED'; claim.detail.validation = 'NOT_VALIDATED';
  claim.detail.execution = 'NOT_CERTIFIED'; claim.detail.sourceExecutionLabel = 'NOT_CERTIFIED';
  claim.detail.support = 'UNSUPPORTED'; claim.detail.hostedCases = null;
  const actual = run(bundle).providers.find(row => row.provider === 'github'); assert.deepEqual(actual, claim.detail);
  assert.equal(Object.hasOwn(run(bundle), 'blockers'), false);
});

test('PB06: unavailable provider parents produce no fabricated provider observation', () => {
  const bundle = loadBundle('ready'); unavailable(bundle, 'provider.github');
  assert.equal(run(bundle).providers.some(row => row.provider === 'github'), false);
});

test('PB07: independently reviewed validation and execution facts do not imply a universal certification ranking', () => {
  const bundle = loadBundle('ready'), claim = provider(bundle, 'github');
  claim.detail.validation = 'NOT_VALIDATED';
  const actual = run(bundle).providers.find(row => row.provider === 'github');
  assert.equal(actual.validation, 'NOT_VALIDATED');
  assert.equal(actual.execution, 'HOSTED_EXECUTION_CERTIFIED');
  assert.equal(actual.support, 'SUPPORTED');
  // 2A still sees the known validation minimum failure; retaining a separately
  // granted execution assertion does not promote the validation axis.
  assert.deepEqual(actual, claim.detail);
});

test('DB01: selection order does not affect projection bytes or mutate input, and outputs are detached', () => {
  const bundle = loadBundle('mo1306-qualified'), input = context(bundle), before = canonicalBytes(input);
  const expected = canonicalBytes(verifyHistoryQualificationsProviders(input));
  input.selections.reverse();
  const actual = verifyHistoryQualificationsProviders(input);
  assert.deepEqual(canonicalBytes(actual), expected);
  input.selections.reverse(); assert.deepEqual(canonicalBytes(input), before);
  actual.history[0].originalDisposition = 'mutated caller output';
  assert.deepEqual(canonicalBytes(verifyHistoryQualificationsProviders(input)), expected);
});

test('DB02: semantic history and qualification set order remains frozen and rejects reordered arrays', () => {
  const historyBundle = loadBundle('mo1306-qualified'); history(historyBundle).detail.records.reverse();
  throwsCode(assert, () => run(historyBundle), 'HISTORY_MISMATCH', 'EVALUATION');
  const qualificationBundle = loadBundle('mo1306-qualified'); history(qualificationBundle).qualifications.reverse();
  throwsCode(assert, () => run(qualificationBundle), 'QUALIFICATION_MISMATCH', 'EVALUATION');
});

test('LB01: history record count accepts 128 and rejects 129 without truncation', () => {
  const bundle = loadBundle('ready');
  const grant = grantFor(bundle, envelopeFor(bundle, 'HISTORICAL_DISPOSITION'));
  history(bundle).detail.records = Array.from({ length: 128 }, (_, i) => ({
    id: `history.row-${String(i).padStart(3, '0')}`, originalOutcome: 'BLOCKED', originalDisposition: 'BLOCKED',
    sourceIds: [...grant.sourceIds], conditionId: `condition.row-${String(i).padStart(3, '0')}`, disposition: 'SUPERSEDED',
    affectedGateIds: [], authoritySourceIds: [...grant.authoritySourceIds], recurrence: 'NOT_APPLICABLE',
  }));
  scope(bundle).detail.conditionIds = history(bundle).detail.records.map(row => row.conditionId);
  assert.equal(run(bundle).history.length, 128);
  history(bundle).detail.records.push({ ...history(bundle).detail.records[127], id: 'history.row-128', conditionId: 'condition.row-128' });
  throwsCode(assert, () => run(bundle), 'RESOURCE_LIMIT', 'EVALUATION');
});

test('LB02: assessment qualification union accepts 128 and rejects 129 across individually bounded claims', () => {
  const bundle = loadBundle('ready');
  const artifact = envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim;
  artifact.qualifications = Array.from({ length: 128 }, (_, i) => ({ id: `q.info-${String(i).padStart(3, '0')}`,
    type: 'MemoryOSReadinessQualification', version: '1.0.0', gateIds: ['artifact'], provider: null, scopeId: artifact.scopeId,
    reasonCode: 'ENVIRONMENT_LIMITATION', impact: 'INFORMATIONAL', disclosureCode: 'ENVIRONMENT_LIMITATION', conditionIds: [] }));
  scope(bundle).detail.qualificationIds = artifact.qualifications.map(row => row.id);
  assert.equal(run(bundle).qualifications.length, 128);
  envelopeFor(bundle, 'SEMANTIC_CONFORMANCE').claim.qualifications = [{ ...artifact.qualifications[127], id: 'q.info-128' }];
  throwsCode(assert, () => run(bundle), 'RESOURCE_LIMIT', 'EVALUATION');
});

test('LB03: exact original disposition length accepts 256 printable characters and rejects 257', () => {
  const bundle = loadBundle('history-blocker-unavailable'); history(bundle).detail.records[0].originalDisposition = 'x'.repeat(256);
  assert.equal(run(bundle).history[0].originalDisposition.length, 256);
  history(bundle).detail.records[0].originalDisposition += 'x';
  throwsCode(assert, () => run(bundle), 'HISTORY_MISMATCH', 'EVALUATION');
});

test('IB01: complete independently pinned MO-1306 verifier retains exact history, provider state and qualifications', () => {
  const bundle = loadBundle('mo1306-qualified');
  const verified = verifyEvidence(inputOf(bundle));
  for (const key of ['history', 'qualifications', 'providers']) assert.deepEqual(verified.projection[key], bundle.result.assessment[key]);
  assert.equal(verified.projection.history.length, 12); assert.equal(verified.projection.qualifications.length, 10);
  verifyResultEvidence(inputOf(bundle), canonicalBytes(bundle.result));
});

test('IB02: complete verifier rejects schema-valid rewritten or removed history despite fresh raw pins', () => {
  for (const mutation of [
    claim => { claim.detail.records = claim.detail.records.filter(row => row.originalOutcome !== 'BLOCKED'); },
    claim => { claim.detail.records[0].originalDisposition = 'FABRICATED_RESOLUTION'; },
    claim => { claim.detail.records[1].disposition = 'SUPERSEDED'; },
  ]) {
    const bundle = loadBundle('mo1306-qualified'); mutation(history(bundle));
    const input = repin(bundle, { grants: false });
    throwsCode(assert, () => verifyEvidence(input), 'EVIDENCE_AUTHORITY', 'AUTHORITY');
  }
});

test('IB03: complete verifier rejects all four MO-1306 execution promotions with unchanged reviewed grants', () => {
  for (const id of ['github', 'gitlab', 'jenkins', 'azure']) {
    const bundle = loadBundle('mo1306-qualified'), claim = provider(bundle, id);
    claim.detail.execution = id === 'github' ? 'HOSTED_EXECUTION_CERTIFIED' : 'LIVE_PROVIDER_CERTIFIED';
    claim.detail.sourceExecutionLabel = claim.detail.execution; claim.detail.support = 'SUPPORTED';
    if (id === 'github') claim.detail.hostedCases = { cne: true, fail: true, parity: true, pass: true };
    claim.qualifications = [];
    throwsCode(assert, () => verifyEvidence(repin(bundle, { grants: false })), 'EVIDENCE_AUTHORITY', 'AUTHORITY');
  }
});

test('IB04: complete verifier uses dedicated qualification mismatch classification', () => {
  for (const mutation of [
    q => { q.impact = 'INFORMATIONAL'; },
    q => { q.provider = 'gitlab'; },
    q => { q.gateIds = ['security']; },
    q => { q.reasonCode = 'INVENTED'; },
    q => { delete q.disclosureCode; },
  ]) {
    const bundle = loadBundle('qualified'); mutation(provider(bundle, 'github').qualifications[0]);
    throwsCode(assert, () => verifyEvidence(repin(bundle)), 'QUALIFICATION_MISMATCH', 'EVALUATION');
  }
});

test('IB05: complete verifier uses dedicated history mismatch classification for PASS rewriting', () => {
  const bundle = loadBundle('history-blocker-unavailable'); history(bundle).detail.records[0].originalOutcome = 'PASS';
  throwsCode(assert, () => verifyEvidence(repin(bundle)), 'HISTORY_MISMATCH', 'EVALUATION');
});

test('IB06: independently pinned source bytes and candidate context bind historical claims', () => {
  const source = loadBundle('mo1306-qualified');
  const file = source.files.get('released.history'); const mutated = Buffer.from(file); mutated[0] ^= 1;
  source.files.set('released.history', mutated);
  throwsCode(assert, () => verifyEvidence(inputOf(source)), 'INTEGRITY', 'INTEGRITY');
  const candidate = loadBundle('mo1306-qualified'); candidate.candidate.source.commit = '0'.repeat(40);
  throwsCode(assert, () => verifyEvidence(inputOf(candidate)), 'CANDIDATE_MISMATCH', 'CONFIGURATION');
});
