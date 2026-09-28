import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyEvidence } from '../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, repin, envelopeFor } from '../tools/mo1307-phase2b/test-support.mjs';

const expectedError = (input, code, stage, reference) => assert.throws(() => verifyEvidence(input), error => error.code === code && error.stage === stage && error.reference === reference);

test('R01 raw source integrity precedes an earlier logical envelope coverage contradiction', () => {
  const bundle = loadBundle();
  envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim.passed.pop();
  const input = repin(bundle);
  input.files.find(file => file.id === 'fixture.source').bytes[0] ^= 1;
  expectedError(input, 'MO1307_INTEGRITY', 'INTEGRITY', 'fixture.source');
});

test('R02 earlier validation phase precedes a smaller later-phase error exit', () => {
  const bundle = loadBundle();
  envelopeFor(bundle, 'ARTIFACT_CERTIFICATION').claim.passed.pop();
  envelopeFor(bundle, 'EXECUTION_CERTIFICATION').claim.version = '2.0.0';
  expectedError(repin(bundle), 'MO1307_EVIDENCE_VERSION', 'INTEGRITY', 'envelope.windows');
});

test('R03 independent source corruption precedes current-candidate authority mismatch', () => {
  const bundle = loadBundle();
  bundle.manifest.candidateDigest = 'sha256:' + 'e'.repeat(64);
  const input = repin(bundle);
  input.files.find(file => file.id === 'fixture.source').bytes[0] ^= 1;
  expectedError(input, 'MO1307_INTEGRITY', 'INTEGRITY', 'fixture.source');
});
