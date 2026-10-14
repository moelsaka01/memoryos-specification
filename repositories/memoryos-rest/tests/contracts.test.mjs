import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { J, jsonBytes } from '../src/serialization.mjs';
import { parseJSON, requestJSONLimits } from '../src/json.mjs';
import { decodeBase64, schemaValidator } from '../src/schema.mjs';
import { GatewayError } from '../src/errors.mjs';

const api = JSON.parse(readFileSync(new URL('../contracts/api-contract.json', import.meta.url)));
const limits = JSON.parse(readFileSync(new URL('../contracts/limits.json', import.meta.url)));
const validate = schemaValidator(api.schemas);
const budget = requestJSONLimits(limits.fixed, 1048576);
const parse = (text, changes = {}) => parseJSON(Buffer.isBuffer(text) ? text : Buffer.from(text), {...budget, ...changes});
const fails = (fn, code) => assert.throws(fn, (error) => error instanceof GatewayError && error.code === 'MO1305_' + code);

test('closed catalog has six semantic and three operational operations with unique methods/paths/IDs', () => {
  assert.equal(api.routes.length, 9);
  assert.equal(api.routes.filter((r) => r.category === 'semantic').length, 6);
  assert.equal(new Set(api.routes.map((r) => r.path)).size, 9);
  assert.equal(new Set(api.routes.map((r) => r.operationId)).size, 9);
  assert.equal(Object.keys(api.errors).length, 23);
  assert.equal(api.errors.MO1305_CLIENT_CANCELLED.wire, false);
  for (const route of api.routes) {
    assert.ok(api.schemas.$defs[route.output]);
    assert.equal(route.input === null, route.method === 'GET');
  }
});

test('strict JSON preserves safe values and creates null-prototype objects', () => {
  const value = parse('{"z":[0,-1,true,false,null,"a\\u0062"],"__proto__":{"x":1}}');
  assert.equal(Object.getPrototypeOf(value), null);
  assert.equal(Object.getPrototypeOf(value.__proto__), null);
  assert.deepEqual(value.z, [0, -1, true, false, null, 'ab']);
  assert.equal({}.x, undefined);
  assert.equal(parse('9007199254740991'), Number.MAX_SAFE_INTEGER);
  assert.equal(parse('-9007199254740991'), Number.MIN_SAFE_INTEGER);
});

test('JSON rejects duplicate decoded keys before assignment', () => {
  for (const text of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"a":{"x":1,"x":2}}']) {
    fails(() => parse(text), 'REQUEST_SYNTAX');
  }
});

test('JSON rejects malformed UTF-8, BOM, invalid strings and trailing tokens', () => {
  for (const bytes of [Buffer.from([0xc0,0xaf]), Buffer.from([0xe2,0x82]), Buffer.from([0xef,0xbb,0xbf,0x7b,0x7d])]) {
    fails(() => parse(bytes), 'REQUEST_SYNTAX');
  }
  for (const text of ['"\\ud800"', '"\\udc00"', '"\\x41"', '"line\nfeed"', '{}{}', 'true false', '"unterminated', '[1,]', '{"x":1,}', '']) {
    fails(() => parse(text), 'REQUEST_SYNTAX');
  }
  assert.equal(parse('"\\ud83d\\ude00"'), '😀');
  assert.equal(parse('"é"'), 'é');
});

test('JSON rejects unsupported number lexical forms and unsafe integers', () => {
  for (const text of ['-0', '-01', '01', '1.0', '1e0', '1E2', '+1', 'NaN', 'Infinity', '9007199254740992', '-9007199254740992']) {
    fails(() => parse(text), 'REQUEST_SYNTAX');
  }
});

test('JSON exact depth, members, nodes, strings and byte boundaries', () => {
  assert.equal(parse('[[0]]', {depth:2})[0][0], 0);
  fails(() => parse('[[0]]', {depth:1}), 'INPUT_LIMIT');
  assert.equal(parse('{"a":0,"b":1}', {members:2}).b, 1);
  fails(() => parse('{"a":0,"b":1}', {members:1}), 'INPUT_LIMIT');
  assert.deepEqual(parse('[0,1]', {nodes:3}), [0,1]);
  fails(() => parse('[0,1]', {nodes:2}), 'INPUT_LIMIT');
  assert.equal(parse('"abc"', {stringCodeUnits:3}), 'abc');
  fails(() => parse('"abcd"', {stringCodeUnits:3}), 'INPUT_LIMIT');
  fails(() => parse('{"long":0}', {keyCodeUnits:3}), 'INPUT_LIMIT');
  assert.equal(parse('{"a":"bc"}', {totalStringCodeUnits:3}).a, 'bc');
  fails(() => parse('{"a":"bcd"}', {totalStringCodeUnits:3}), 'INPUT_LIMIT');
  assert.equal(parse('"a"', {bytes:3}), 'a');
  fails(() => parse('"a"', {bytes:2}), 'INPUT_LIMIT');
});

test('transport serialization sorts recursively without changing byte products', () => {
  const input = {z:1, a:{z:'é', a:'😀'}, b:['x', 'AA==']};
  assert.equal(J(input), '{"a":{"a":"😀","z":"é"},"b":["x","AA=="],"z":1}');
  assert.equal(jsonBytes(input).at(-1), 125);
  for (const value of [undefined, NaN, Infinity, -0, 1.1, '\ud800', new Date(), [undefined]]) {
    assert.throws(() => J(value));
  }
  const circular = {}; circular.self = circular; assert.throws(() => J(circular));
});

test('canonical Base64 distinguishes malformed syntax from decoded byte overflow', () => {
  assert.deepEqual(decodeBase64('AA==',1), Buffer.from([0]));
  assert.deepEqual(decodeBase64('AAA=',2), Buffer.from([0,0]));
  for (const input of ['', 'AA', 'AB==', 'AAF=', 'AA-_', 'AA==\n', 'A===', '====']) {
    fails(() => decodeBase64(input,16), 'REQUEST_SCHEMA');
  }
  fails(() => decodeBase64('AAA=',1), 'INPUT_LIMIT');
  const maximum = Buffer.alloc(524288, 0x5a);
  assert.deepEqual(decodeBase64(maximum.toString('base64'), maximum.length), maximum);
  fails(() => decodeBase64(Buffer.alloc(524289).toString('base64'),524288), 'INPUT_LIMIT');
});

test('request schemas are closed, typed and have no coercion or prototype grants', () => {
  assert.equal(validate('PolicyInput', {policyBase64:'e30='}), true);
  for (const value of [{}, {policyBase64:'e30=', extra:true}, {policyBase64:3}, null, []]) {
    assert.equal(validate('PolicyInput', value), false);
  }
  assert.equal(validate('PolicyInput', parse('{"policyBase64":"e30=","__proto__":{}}')),false);
  assert.equal(validate('EvaluationInput',{artifactKind:'policy',artifactBase64:'e30=',candidateMipBase64:'e30='}),true);
  assert.equal(validate('EvaluationInput',{artifactKind:'other',artifactBase64:'e30=',candidateMipBase64:'e30='}),false);
});

test('schema compiler rejects unsupported keywords, external/cyclic refs and open objects', () => {
  for (const schema of [{$defs:{X:{type:'string',format:'url'}}}, {$defs:{X:{additionalProperties:true}}},
    {$defs:{X:{$ref:'https://example.invalid/schema'}}}, {$defs:{X:{$ref:'#/$defs/X'}}}]) {
    assert.throws(() => schemaValidator(schema));
  }
  const unicode = schemaValidator({$defs:{X:{type:'string',maxLength:1}}});
  assert.equal(unicode('X','😀'),true);
  assert.equal(unicode('X','😀x'),false);
});
