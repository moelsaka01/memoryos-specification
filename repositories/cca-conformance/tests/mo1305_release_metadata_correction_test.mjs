/** Current MO-1305 release correction gate; historical phase receipts stay historical. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {schemaValidator} from '../../memoryos-rest/src/schema.mjs';
import {verifyContracts,expectedOpenAPI,verifyOpenAPI} from '../../memoryos-rest/scripts/verify-contracts.mjs';
import {J} from '../../memoryos-rest/src/serialization.mjs';
const root=resolve(import.meta.dirname,'../../..');
const directory='repositories/cca-conformance/evidence/mo1305-phase3-correction/accepted/';
const tools='repositories/cca-conformance/tools/mo1305-phase3-correction/';
const read=path=>JSON.parse(readFileSync(resolve(root,path)));
const python=process.env.MEMORYOS_CONFORMANCE_PYTHON??'C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
function run(args){const r=spawnSync(python,['-B','-X','utf8',...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');return JSON.parse(r.stdout);}
test('current package, full SPDX, receipts, runtime preservation and correction graph pass',()=>{const r=run([tools+'check.py']);assert.equal(r.state,'PASS');assert.equal(r.fileCount,58);assert.equal(r.runtimeUnchanged,52);assert.equal(r.metadataCases,34);});
test('current conformance inventory satisfies the frozen closed schema and refresh state',()=>{const i=read('repositories/cca-conformance/mo1305-conformance-inventory.json');assert.equal(schemaValidator(read('repositories/cca-conformance/schema/mo1305-inventory-2.0.0.json'))('Inventory',i),true);assert.equal(i.state,'CERTIFICATION_PENDING');assert.deepEqual(i.blockers,['PHASE3A_REFRESH_REQUIRED','PHASE3B_REFRESH_REQUIRED','PHASE3C_REFRESH_REQUIRED']);assert.equal(i.finalBinding.state,'PENDING');assert.equal(i.releaseTag.state,'NOT_READY');});
test('corrected OpenAPI is independently projected and stale pending state is rejected',()=>{verifyContracts();const v=expectedOpenAPI();assert.equal(v['x-memoryos-http'].behavior.remoteMode.implemented,true);v['x-memoryos-http'].behavior.remoteMode='PHASE_2_PENDING';assert.throws(()=>verifyOpenAPI(Buffer.from(J(v))),/OPENAPI_RUNTIME_DRIFT/);});
test('complete SPDX schema and field inventory report zero errors at every location',()=>{const r=read(directory+'schema-validation.json');assert.deepEqual([r.rootErrors,r.packageErrors,r.fileErrors,r.relationshipErrors,r.otherErrors,r.totalErrors],[0,0,0,0,0,0]);const fields=read(directory+'generated-fields.json');assert.equal(fields.state,'PASS');for(const row of fields.locations)assert.ok(row.properties.every(p=>row.allowed.includes(p)));assert.equal(fields.locations.find(r=>r.path==='/files/*').instances,56);});
test('schema, package and external-component negative witnesses reject invalid artifacts',()=>{const r=run(['-c',`import sys,json;sys.path.insert(0,'${tools}');from metadata_test import run;from pathlib import Path;r=run(Path('${read(directory+'candidate.json').archive.path}'));print(json.dumps({'state':r['state'],'cases':r['caseCount']}))`]);assert.deepEqual(r,{state:'PASS',cases:34});});
test('binding rejects forged ancestor, artifact, runtime and refresh identities',()=>{const r=run(['-c',`import sys,json,copy;sys.path.insert(0,'${tools}');from check import binding,check_binding;v=binding('f'*40);check_binding(v,'f'*40);cases=[]
for key in ['baseline','implementation','candidate','old','provisionalBlocked','corrected','archive','schema','runtimePreservation','phase3','finalBinding','releaseTag']:
 x=copy.deepcopy(v);x[key]=None
 try:check_binding(x,'f'*40)
 except AssertionError:cases.append(key)
 else:raise AssertionError('FORGED_BINDING_ACCEPTED:'+key)
print(json.dumps({'rejected':len(cases)}))`]);assert.equal(r.rejected,12);});
test('only one final-archive offline installation and bounded smoke are accepted',()=>{const r=read(directory+'installed.json');assert.equal(r.state,'PASS');assert.equal(r.installations.length,1);const x=r.installations[0];assert.equal(x.execution.requests.length,6);assert.equal(x.execution.remote.requests.length,2);assert.equal(x.everyFileMatchesBeforeAndAfter,true);assert.equal(r.temporaryCredentialsRemoved,true);assert.equal(read(directory+'execution.json').host.observation.evidenceState,'AVAILABLE');});
test('correction gate is registered in npm, JavaScript inventory and CMake',()=>{const runner=readFileSync(resolve(root,'repositories/cca-conformance/tools/run-js-conformance.mjs'),'utf8');const expected=runner.match(/const expectedFiles = Object.freeze\(\[([\s\S]*?)\]\);/u)[1];assert.deepEqual([...expected.matchAll(/"([^"]+_test.mjs)"/gu)].map(m=>m[1]),readdirSync(resolve(root,'repositories/cca-conformance/tests')).filter(n=>n.endsWith('_test.mjs')).sort());assert.ok(runner.includes('mo1305Correction'));assert.equal(read('repositories/cca-conformance/package.json').scripts['test:mo1305-release-metadata-correction'],'node --test tests/mo1305_release_metadata_correction_test.mjs');assert.ok(readFileSync(resolve(root,'repositories/cca-conformance/CMakeLists.txt'),'utf8').includes('tests/mo1305_release_metadata_correction_test.mjs'));});
