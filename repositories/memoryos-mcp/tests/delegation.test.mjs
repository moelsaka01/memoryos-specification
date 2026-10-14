import test from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../src/delegation.mjs';
import { MemoryOS } from '../../cca-studio/web/js/memoryos-sdk.js';
import { fixtures, b64 } from './corpus.mjs';
import { toolResult } from '../src/contracts.mjs';

const fixture = await fixtures();
test('preparation preserves the public predecessor SDK bytes and both digests', async () => {
  for (const kind of ['policy', 'policySet']) {
    const memory = new MemoryOS();
    const bytes = kind === 'policy' ? fixture.pass : fixture.set;
    const expected = kind === 'policy' ? memory.preparePolicy(bytes) : memory.preparePolicySet(bytes);
    const actual = await execute(kind === 'policy' ? 'memoryos_prepare_policy' : 'memoryos_prepare_policy_set',
      { [kind === 'policy' ? 'policyBase64' : 'policySetBase64']: b64(bytes) });
    assert.equal(actual.status, 'ok');
    assert.deepEqual(Buffer.from(actual.canonicalArtifactBase64, 'base64'), Buffer.from(expected.toBytes()));
    assert.equal(actual.documentDigest, expected.documentDigest);
    assert.equal(actual.semanticDigest, expected.semanticDigest);
  }
});
test('PASS/FAIL/COULD_NOT_EVALUATE and Policy Set evaluation match authoritative reconstruction', async () => {
  for (const [vector, decision] of [['pass', 'PASS'], ['fail', 'FAIL'], ['cne', 'COULD_NOT_EVALUATE'], ['set', 'PASS']]) {
    const set = vector === 'set'; const bytes = fixture[vector];
    const memory = new MemoryOS();
    const prepared = set ? memory.preparePolicySet(bytes) : memory.preparePolicy(bytes);
    const candidate = memory.importPackage(fixture.mip, { identifier: 'memoryos-policy-evaluation-candidate' });
    const context = memory.capturePolicyFactContext(candidate);
    const expected = set ? memory.evaluatePolicySet(prepared, context, {}) : memory.evaluatePolicy(prepared, context, {});
    const actual = await execute('memoryos_evaluate_policy', { artifactKind: set ? 'policySet' : 'policy',
      artifactBase64: b64(bytes), candidateMipBase64: b64(fixture.mip) });
    assert.equal(actual.status, 'ok', JSON.stringify(actual));
    assert.equal(actual.decision, decision);
    assert.equal(toolResult(actual).isError, false);
    assert.deepEqual(Buffer.from(actual.evaluationIdentityBase64, 'base64'), Buffer.from(expected.evaluationIdentityBytes()));
    assert.deepEqual(Buffer.from(actual.outcomeBase64, 'base64'), Buffer.from(expected.canonicalOutcomeBytes()));
    assert.equal(actual.evaluationIdentityDigest, expected.evaluationIdentityDigest);
    assert.equal(actual.outcomeDigest, expected.outcomeDigest);
  }
});
test('serialized verification remains inspection-only and rejects substitution and extra LF', async () => {
  for (const record of fixture.golden) {
    for (const identity of [true, false]) {
      const tool = identity ? 'memoryos_verify_evaluation_identity' : 'memoryos_verify_policy_outcome';
      const field = identity ? 'evaluationIdentityBase64' : 'outcomeBase64';
      const bytes = Buffer.from(identity ? record.canonicalIdentityBytes : record.canonicalOutcomeBytes);
      const args = { [field]: b64(bytes), expectedEvaluationIdentityDigest: record.evaluationIdentityDigest,
        ...(identity ? {} : { expectedOutcomeDigest: record.outcomeDigest }) };
      const actual = await execute(tool, args);
      assert.equal(actual.status, 'ok'); assert.equal(actual.authority, 'inspectionOnly');
      assert.equal(actual.verificationScope, 'serializedArtifact');
      for (const altered of [{ ...args, [field]: b64(Buffer.concat([bytes, Buffer.from('\n')])) },
        { ...args, expectedEvaluationIdentityDigest: `sha256:${'0'.repeat(64)}` }]) {
        const rejected = await execute(tool, altered);
        assert.equal(rejected.status, 'error'); assert.equal(rejected.error.origin, 'memoryos');
      }
    }
  }
});
test('MIP validation retains primary predecessor code and never becomes an evaluation decision', async () => {
  const memory = new MemoryOS();
  const invalid = Buffer.from('{}');
  let expected;
  try { memory.importPackage(invalid, { identifier: 'memoryos-policy-evaluation-candidate' }); }
  catch (error) { expected = error.code ?? error.diagnostics?.[0]?.code ?? 'MIP_VALIDATION_FAILED'; }
  const actual = await execute('memoryos_evaluate_policy', { artifactKind: 'policy', artifactBase64: b64(fixture.pass), candidateMipBase64: b64(invalid) });
  assert.equal(actual.error.code, expected); assert.equal(actual.error.phase, 'evaluationInput');
  assert.equal(actual.error.origin, 'memoryos'); assert.equal('decision' in actual, false);
});
test('Regression, path, URI and credential claims never reach authoritative acquisition', async () => {
  for (const field of ['regressionSource', 'baselineMipBase64', 'factContext', 'path', 'uri', 'token']) {
    const actual = await execute('memoryos_evaluate_policy', { artifactKind: 'policy', artifactBase64: b64(fixture.cne),
      candidateMipBase64: b64(fixture.mip), [field]: 'untrusted' });
    assert.equal(actual.error.origin, 'adapter'); assert.equal(actual.error.code, 'MO1304_INVALID_TOOL_INPUT');
  }
});
