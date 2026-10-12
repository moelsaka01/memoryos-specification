import test from 'node:test';
import assert from 'node:assert/strict';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/server/validators/ajv';
import { catalog, decodeBase64, names, validateInput, toolResult } from '../src/contracts.mjs';
import { J } from '../src/deterministic.mjs';
import { contractIdentityPin } from '../src/integrity.mjs';
import { fixtures, b64 } from './corpus.mjs';
import { execute } from '../src/delegation.mjs';
import { adapterError, ADAPTER_CODES } from '../src/errors.mjs';

const pin = await contractIdentityPin();
const tools = catalog(pin);
const fixture = await fixtures();
const golden = fixture.golden[0];
const valid = [{}, { artifactKind: 'policy', artifactBase64: b64(fixture.pass), candidateMipBase64: b64(fixture.mip) },
  { policyBase64: b64(fixture.pass) }, { policySetBase64: b64(fixture.set) },
  { evaluationIdentityBase64: b64(Buffer.from(golden.canonicalIdentityBytes)), expectedEvaluationIdentityDigest: golden.evaluationIdentityDigest },
  { outcomeBase64: b64(Buffer.from(golden.canonicalOutcomeBytes)), expectedEvaluationIdentityDigest: golden.evaluationIdentityDigest, expectedOutcomeDigest: golden.outcomeDigest }];
const ajv = new AjvJsonSchemaValidator();

test('the frozen six-tool catalog, descriptions, and annotations are exact', () => {
  assert.deepEqual(names, ['memoryos_contract_identities', 'memoryos_evaluate_policy', 'memoryos_prepare_policy',
    'memoryos_prepare_policy_set', 'memoryos_verify_evaluation_identity', 'memoryos_verify_policy_outcome']);
  assert.deepEqual(tools.map((tool) => tool.description), [
    'Inspect the authoritative MemoryOS Policy contract identities used by this server.',
    'Evaluate a Policy or Policy Set against an explicitly supplied Memory Investigation Package using authoritative MemoryOS semantics.',
    'Validate and prepare Policy artifact bytes, returning authoritative canonical bytes and digests.',
    'Validate and prepare Policy Set artifact bytes, returning authoritative canonical bytes and digests.',
    'Verify canonical Evaluation Identity bytes against an expected digest without granting evaluation authority.',
    'Verify canonical Policy Outcome bytes against expected identity and outcome digests without granting evaluation authority.',
  ]);
  for (const tool of tools) {
    assert.deepEqual(Object.keys(tool).sort(), ['annotations', 'description', 'inputSchema', 'name', 'outputSchema']);
    assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
  }
});
test('all argument schemas agree with independent JSON Schema validation and reject authority fields', () => {
  tools.forEach((tool, index) => {
    const schema = ajv.getValidator(tool.inputSchema);
    assert.equal(schema(valid[index]).valid, true);
    assert.equal(validateInput(tool.name, valid[index]), true);
    for (const invalid of [null, undefined, [], '', 0]) assert.equal(validateInput(tool.name, invalid), false);
    for (const field of ['path', 'uri', 'workspace', 'regressionSource', 'factContext', 'baselineMipBase64', 'token', 'credentials']) {
      const input = { ...valid[index], [field]: 'file:///private' };
      assert.equal(validateInput(tool.name, input), false);
      assert.equal(schema(input).valid, false);
    }
    for (const key of Object.keys(valid[index])) {
      const input = { ...valid[index] }; delete input[key];
      assert.equal(validateInput(tool.name, input), false);
    }
  });
});
test('canonical Base64: independent decoded N-1/N/N+1 admission and padding bits', () => {
  for (const maximum of [1024, 2048, 4096, 524288, 4060]) {
    for (const length of [maximum - 1, maximum]) assert.equal(decodeBase64(b64(Buffer.alloc(length)), maximum).length, length);
    assert.throws(() => decodeBase64(b64(Buffer.alloc(maximum + 1)), maximum));
  }
  for (const invalid of ['', 'Zg', 'Zg=', 'Zh==', 'Zm9=', 'Zg==\n', ' Zg==', '_w==', '-w==', '!!!!', '====']) {
    assert.throws(() => decodeBase64(invalid, 4096));
  }
  assert.equal(decodeBase64('Zg==', 1).toString(), 'f');
});
test('digest syntax is exact and cannot substitute an alternate algorithm or case', () => {
  for (const digest of ['sha256:ABC', `SHA256:${'0'.repeat(64)}`, `sha256:${'A'.repeat(64)}`, `sha256:${'0'.repeat(63)}`, null]) {
    assert.equal(validateInput(names[4], { ...valid[4], expectedEvaluationIdentityDigest: digest }), false);
  }
});
test('J uses UTF-16 key order, retains arrays, escapes controls/bidi, and rejects non-JSON', () => {
  const value = { z: [3, { b: 1, a: 2 }], a: '\n\u0000\u202e\u2066', '\ue000': 1, '\ud800\udc00': 2 };
  const expected = '{"a":"\\n\\u0000\\u202e\\u2066","z":[3,{"a":2,"b":1}],"𐀀":2,"":1}';
  assert.equal(J(value), expected);
  for (let index = 0; index < 30; index++) assert.equal(J(value), expected);
  for (const invalid of ['\ud800', '\udfff', NaN, Infinity, undefined, new Date(), [, 1]]) assert.throws(() => J(invalid));
  const cycle = {}; cycle.self = cycle; assert.throws(() => J(cycle));
});
test('all six successful outputs satisfy independent closed schemas; wrapper is exact', async () => {
  for (let index = 0; index < tools.length; index++) {
    const product = await execute(names[index], valid[index]);
    assert.equal(product.status, 'ok', JSON.stringify(product));
    const validate = ajv.getValidator(tools[index].outputSchema);
    assert.equal(validate(product).valid, true, JSON.stringify(validate(product)));
    assert.equal(validate({ ...product, timestamp: 123 }).valid, false);
    const result = toolResult(product);
    assert.deepEqual(Object.keys(result).sort(), ['_meta', 'content', 'isError', 'resultType', 'structuredContent']);
    assert.deepEqual(result.content, [{ type: 'text', text: J(product) }]);
    assert.equal(result.isError, false);
    assert.equal(result.resultType, 'complete');
  }
});
test('all adapter errors are closed, bounded and independent of exception text', () => {
  for (const code of ADAPTER_CODES) {
    const product = adapterError(code, 'worker');
    assert.equal(toolResult(product).isError, true);
    for (const tool of tools) assert.equal(ajv.getValidator(tool.outputSchema)(product).valid, true);
    assert.equal('message' in product.error, false);
  }
  assert.equal(adapterError('SECRET').error.code, 'MO1304_INTERNAL_FAILURE');
});
