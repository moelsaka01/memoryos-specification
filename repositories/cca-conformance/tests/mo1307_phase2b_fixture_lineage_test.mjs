import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalBytes, canonicalDigest, digest } from '../../memoryos-readiness/src/canonical.mjs';
import { verifyEvidence } from '../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, inputOf, repin } from '../tools/mo1307-phase2b/test-support.mjs';

const retained = JSON.parse(readFileSync(new URL('../evidence/mo1307/phase2b/development/mo1306-source-lineage.json', import.meta.url)));
const configId = id => id.startsWith('configuration-source.');

test('F01 MO-1306 preserved configuration receipts have exact granted source lineage', () => {
  const bundle = loadBundle('mo1306-qualified');
  const ids = bundle.manifest.entries.filter(entry => configId(entry.id)).map(entry => entry.id);
  assert.equal(ids.length, 8);
  const consumers = [];
  for (const grant of bundle.authority.assessment.grants) {
    const envelope = bundle.envelopes.get(grant.envelopeId);
    const bound = grant.sourceIds.filter(configId);
    assert.deepEqual(envelope.sources, grant.sourceIds);
    if (envelope.claim.dependencies.some(dependency => dependency.role === 'CONFIGURATION')) {
      assert.deepEqual(bound, ids); consumers.push(grant.id);
    } else assert.deepEqual(bound, []);
  }
  assert.equal(consumers.length, 11);
  assert.deepEqual(consumers, retained.after.consumingGrants);
  assert.deepEqual(verifyEvidence(inputOf(bundle)).audit, bundle.result.audit);
});

test('F02 correction preserves all normalized identities and every original raw source byte', () => {
  const bundle = loadBundle('mo1306-qualified');
  assert.equal(bundle.pins.expectedCandidateDigest, retained.before.pins.expectedCandidateDigest);
  assert.equal(bundle.pins.expectedReadinessDigest, retained.before.pins.expectedReadinessDigest);
  assert.equal(bundle.result.assessment.graphDigest, retained.unchanged.graphDigest);
  assert.equal(bundle.result.assessment.authorityIdentityDigest, retained.unchanged.authorityIdentityDigest);
  assert.deepEqual(bundle.result.assessment.providers, retained.unchanged.providerAxes);
  assert.equal(bundle.result.assessment.history.length, 12);
  assert.equal(bundle.result.assessment.qualifications.length, 10);
  for (const row of retained.before.normalizedClaims) assert.equal(canonicalDigest(bundle.envelopes.get(row.envelopeId).claim), row.claimDigest);
  for (const row of retained.before.rawSources) {
    const bytes = bundle.files.get(row.id);
    assert.equal(bytes.length, row.byteLength); assert.equal(digest(bytes), row.sha256);
  }
  assert.notEqual(bundle.pins.trustedAuthorityDigest, retained.before.pins.trustedAuthorityDigest);
  assert.notEqual(bundle.pins.expectedProofBindingDigest, retained.before.pins.expectedProofBindingDigest);
});

test('F03 reconstructed original fixture still rejects unused configuration sources', () => {
  const bundle = loadBundle('mo1306-qualified');
  for (const grant of bundle.authority.assessment.grants) {
    const envelope = bundle.envelopes.get(grant.envelopeId);
    grant.sourceIds = grant.sourceIds.filter(id => !configId(id));
    envelope.sources = envelope.sources.filter(id => !configId(id));
  }
  const original = repin(bundle);
  assert.equal(digest(original.authorityBytes), retained.before.pins.trustedAuthorityDigest);
  assert.throws(() => verifyEvidence(original), error => error.code === retained.originalDiagnostic.code && error.stage === retained.originalDiagnostic.stage && error.reference === retained.originalDiagnostic.reference);
});
