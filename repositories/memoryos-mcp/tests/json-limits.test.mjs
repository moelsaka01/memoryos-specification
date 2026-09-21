import test from 'node:test';
import assert from 'node:assert/strict';
import { strictJson } from '../src/json.mjs';
import { loadLimits, validateLimits } from '../src/limits.mjs';
import { sha256 } from '../src/integrity.mjs';
import { readFile } from 'node:fs/promises';
const limits = await loadLimits();
const parse = (text, changes = {}) => strictJson(Buffer.from(text), { ...limits, ...changes });
test('strict JSON rejects UTF-8, BOM, duplicate decoded names, surrogates and non-JSON syntax', () => {
  for (const text of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '"\\ud800"', '"\\udfff"', '"line\nbreak"',
    '\ufeff{}', '{"a":1,}', '[1,]', '/*x*/{}', 'NaN', 'Infinity', '1e999', '01', '{}{}', '{']) assert.throws(() => parse(text), text);
  for (const bytes of [[0xc0,0xaf], [0xed,0xa0,0x80], [0xf4,0x90,0x80,0x80], [0xc2]]) assert.throws(() => strictJson(Buffer.from(bytes), limits));
  assert.equal(parse('1.25'), 1.25);
  assert.equal(parse('"\\ud800\\udc00"'), '𐀀');
  assert.equal(parse('{"__proto__":{"safe":true}}').__proto__.safe, true);
  assert.equal({}.safe, undefined);
});
test('parser structural and byte ceilings have N-1/N/N+1 witnesses', () => {
  for (const length of [7,8]) assert.equal(parse(JSON.stringify('a'.repeat(length)), { jsonStringCodeUnits: 8 }).length, length);
  assert.throws(() => parse(JSON.stringify('a'.repeat(9)), { jsonStringCodeUnits: 8 }));
  for (const depth of [7,8]) parse('['.repeat(depth-1)+'0'+']'.repeat(depth-1), { jsonDepth: 8 });
  assert.throws(() => parse('['.repeat(8)+'0'+']'.repeat(8), { jsonDepth: 8 }));
  for (const count of [7,8]) parse(JSON.stringify(Object.fromEntries(Array.from({length:count},(_,i)=>['k'+i,0]))), { jsonMembers:8 });
  assert.throws(() => parse(JSON.stringify(Object.fromEntries(Array.from({length:9},(_,i)=>['k'+i,0]))), { jsonMembers:8 }));
  for (const count of [7,8]) parse(JSON.stringify(Array(count-1).fill(0)), { jsonNodes:8 });
  assert.throws(() => parse(JSON.stringify(Array(8).fill(0)), { jsonNodes:8 }));
  for (const bytes of [7,8]) parse('0'+' '.repeat(bytes-1), { requestFrameBytes:8 });
  assert.throws(() => parse('0'+' '.repeat(8), { requestFrameBytes:8 }));
});
test('measured constants are complete, finite, and mechanically agree with all 420 samples', async () => {
  const receipt = JSON.parse(await readFile(new URL('../measurements/resource-measurement.json', import.meta.url)));
  assert.equal(receipt.observations.length, 420);
  assert.equal(receipt.transportObservations.length, 60);
  assert.deepEqual(receipt.limits.values, limits);
  for (const mode of ['cold','warm']) for (const entry of receipt.corpus) {
    assert.equal(receipt.observations.filter(x=>x.mode===mode && x.label===entry.label).length,30);
  }
  const d = receipt.derivation;
  assert.ok(receipt.reviewEnvelope.sources.length>=4);
  for(const source of receipt.reviewEnvelope.sources){
    const bytes=await readFile(new URL('../'+source.path,import.meta.url));
    assert.equal(bytes.length,source.byteLength);assert.equal(sha256(bytes),source.sha256);
    assert.deepEqual(JSON.parse(bytes).derivation,source.derivation);
  }
  for(const name of ['worstHeap','worstExternal','parentAttributable','worstTotalMs'])
    assert.equal(d[name],Math.max(...receipt.reviewEnvelope.sources.map(x=>x.derivation[name])));

  assert.equal(limits.workerHeapMiB, Math.floor(2*d.worstHeap/1048576)+1);
  assert.equal(limits.workerExternalBytes,(Math.floor(2*d.worstExternal/1048576)+1)*1048576);
  assert.equal(limits.operationMs,(Math.floor(4*d.worstTotalMs/1000)+1)*1000);
  for (const name of Object.keys(limits)) {
    const candidate = structuredClone(receipt.limits); delete candidate.values[name];
    assert.throws(()=>validateLimits(candidate),name);
    for (const invalid of [0,-1,Infinity,NaN,1.5,'1024']) {
      const candidate = structuredClone(receipt.limits); candidate.values[name]=invalid;
      assert.throws(()=>validateLimits(candidate),name);
    }
  }
});

test('actual parser constants admit N-1/N and reject N+1 without overflow',()=>{
  for(const [name,render] of [
    ['jsonStringCodeUnits',n=>JSON.stringify('x'.repeat(n))],
    ['jsonDepth',n=>'['.repeat(n-1)+'0'+']'.repeat(n-1)],
    ['jsonNodes',n=>JSON.stringify(Array(n-1).fill(0))],
    ['jsonMembers',n=>JSON.stringify(Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,0])))],
    ['requestFrameBytes',n=>'0'+' '.repeat(n-1)]]) {
    for(const offset of [-1,0])parse(render(limits[name]+offset));
    assert.throws(()=>parse(render(limits[name]+1)),name);
  }
});
