import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaValidator } from '../../memoryos-rest/src/schema.mjs';
import { expectedOpenAPI, verifyOpenAPI, verifyContracts } from '../../memoryos-rest/scripts/verify-contracts.mjs';
import { J } from '../../memoryos-rest/src/serialization.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const evidence='repositories/cca-conformance/evidence/mo1305-phase3d/';
const read=p=>JSON.parse(readFileSync(resolve(root,p)));
const python=process.env.MEMORYOS_CONFORMANCE_PYTHON||process.env.PYTHON||'python';
const result=spawnSync(python,['-B','-X','utf8','repositories/cca-conformance/tools/mo1305-phase3d/validate.py'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:16*1024*1024});
assert.equal(result.status,0,result.stderr||result.stdout);
assert.equal(result.stderr,'');
const value=JSON.parse(result.stdout);
assert.equal(value.state,'PASS');
const gates=read(evidence+'catalog.json').gates;
assert.deepEqual(Object.keys(value.gates).sort(),[...gates].sort());
for(const name of gates)test(`final release ${name}`,()=>assert.equal(value.gates[name].state,'PASS'));
assert.equal(value.negativeWitnesses.length,22);
for(const row of value.negativeWitnesses)test(`reject ${row.id}`,()=>assert.deepEqual({state:row.state,outcome:row.outcome},{state:'PASS',outcome:'REJECTED'}));
test('current inventory and final binding satisfy frozen closed schemas',()=>{
 const schema=read('repositories/cca-conformance/schema/mo1305-inventory-2.0.0.json');
 assert.equal(schemaValidator(schema)('Inventory',read('repositories/cca-conformance/mo1305-conformance-inventory.json')),true);
 assert.equal(schemaValidator(schema)('Inventory',read(evidence+'i3-inventory.json')),true);
 if(existsSync(resolve(root,evidence+'binding.json'))){
  const receiptSchema=read('repositories/cca-conformance/schema/mo1305-receipt-2.0.0.json');
  assert.equal(schemaValidator(receiptSchema)('Receipt',read(evidence+'binding.json')),true);
 }
});
test('full OpenAPI projection and stale pending negative',()=>{
 verifyContracts();const value=expectedOpenAPI();
 assert.deepEqual(value['x-memoryos-http'].behavior.remoteMode,{mode:'remote',implemented:true,explicitOptIn:true,bindAddressPolicy:'assigned RFC1918 IPv4'});
 value['x-memoryos-http'].behavior.remoteMode='PHASE_2_PENDING';
 assert.throws(()=>verifyOpenAPI(Buffer.from(J(value))),/OPENAPI_RUNTIME_DRIFT/u);
});
test('final release gate registered and historical gates retained',()=>{
 const runner=readFileSync(resolve(root,'repositories/cca-conformance/tools/run-js-conformance.mjs'),'utf8');
 const expected=runner.match(/const expectedFiles = Object.freeze\(\[([\s\S]*?)\]\);/u)[1];
 assert.deepEqual([...expected.matchAll(/"([^"]+_test.mjs)"/gu)].map(m=>m[1]),readdirSync(resolve(root,'repositories/cca-conformance/tests')).filter(n=>n.endsWith('_test.mjs')).sort());
 assert.ok(runner.includes('mo1305Final'));
 assert.equal(read('repositories/cca-conformance/package.json').scripts['test:mo1305-phase3'],'node --test --test-concurrency=1 tests/mo1305_phase3_conformance_test.mjs');
 assert.ok(readFileSync(resolve(root,'repositories/cca-conformance/CMakeLists.txt'),'utf8').includes('tests/mo1305_phase3_conformance_test.mjs'));
});
