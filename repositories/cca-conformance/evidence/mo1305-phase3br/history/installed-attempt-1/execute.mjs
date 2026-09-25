/** Fresh Phase 3B-R offline installed execution, gated by complete cheap certification. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {queryEvents, classify} from '../mo1305-host-guard.mjs';
const root=resolve(import.meta.dirname,'../../../..');
const evidence='repositories/cca-conformance/evidence/mo1305-phase3br/';
const tooling='repositories/cca-conformance/tools/mo1305-phase3br/';
const historical='repositories/cca-conformance/tools/mo1305-phase3-correction/';
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const node=resolve(root,'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe');
const npm=resolve(node,'../node_modules/npm/bin/npm-cli.js');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ref=path=>{const bytes=readFileSync(resolve(root,path));return {path,byteLength:bytes.length,sha256:sha(bytes)};};
const canonical=value=>JSON.stringify(value===null||typeof value!=='object'?value:Array.isArray(value)?value.map(ordered):ordered(value));
function ordered(value){return value===null||typeof value!=='object'?value:Array.isArray(value)?value.map(ordered):Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key]) ]));}
const write=(path,value)=>writeFileSync(resolve(root,path),canonical(value),{flag:'wx'});
const gate=JSON.parse(readFileSync(resolve(root,evidence+'cheap-gate.json')));
assert.equal(gate.state,'PASS','COMPLETE_CHEAP_GATE_REQUIRED');
const archive={path:'.cache/mo1305-phase3-correction/accepted-build/memoryos-rest-0.1.0.tgz',byteLength:191823,sha256:'faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382'};
assert.deepEqual(ref(archive.path),archive,'EXACT_ARCHIVE_REQUIRED');
assert.equal(sha(readFileSync(node)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32','PINNED_NODE_REQUIRED');
const paths=[...['install.py','installed-probe.mjs','execute.mjs'].map(name=>tooling+name),
 ...['distribution.py','spdx.py','package-allowlist.json','schema_validation.py','schema-runtime.json'].map(name=>historical+name),
 ...['mo1305-host-guard.mjs','mo1305-host-events.ps1','mo1305-host-guard-policy.json','mo1305-phase1/validate-launch.ps1'].map(name=>'repositories/cca-conformance/tools/'+name),
 ...['index.json','identities.json','evaluate-policy-pass.json'].map(name=>'repositories/cca-conformance/fixtures/mo1305-phase1/'+name),
 'repositories/cca-conformance/evidence/mo1305-phase3-correction/spdx-2.3-schema.json',evidence+'cheap-gate.json'];
const inputs=paths.map(ref);
for(const name of ['installed.json','execution.json','installed-execution.log'])assert.equal(existsSync(resolve(root,evidence+name)),false,'FRESH_EXECUTION_REQUIRED');
const clean=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(SYSTEMROOT|WINDIR|TEMP|TMP)$/iu.test(name)));
clean.PATH='C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0';
// Host event provider uses powershell.exe; this is a process-local path change only.
process.env.PATH=clean.PATH;
const stamp=()=>({ns:process.hrtime.bigint().toString(),utcMs:Date.now(),domain:'MONOTONIC_PHASE3BR_INSTALL_'+process.pid});
const start=stamp();
const args=['-B','-X','utf8',resolve(root,tooling+'install.py'),'--archive',resolve(root,archive.path),'--node',node,'--npm',npm,'--expected-sha256',archive.sha256,'--output',resolve(root,evidence+'installed.json')];
const child=spawn(python,args,{cwd:root,env:clean,windowsHide:true,stdio:['ignore','pipe','pipe']});
let bytes=Buffer.alloc(0),timeout=false;
const append=chunk=>{bytes=Buffer.concat([bytes,chunk]);if(bytes.length>1048576){timeout=true;child.kill();}};
child.stdout.on('data',append);child.stderr.on('data',append);
const timer=setTimeout(()=>{timeout=true;child.kill();},300000);
const result=await new Promise((done,fail)=>{child.once('error',fail);child.once('close',(code,signal)=>done({code,signal}));}).finally(()=>clearTimeout(timer));
const end=stamp();
const events=await queryEvents(start.utcMs,end.utcMs);
const observation=classify({start,end,attemptId:'phase3br-installed-smoke',candidateId:archive.sha256,caseId:'installed-smoke',phase:'phase3br-release-artifact',index:0,sampleId:'phase3br-installed-smoke'},events);
const output=evidence+'installed-execution.log';
writeFileSync(resolve(root,output),bytes,{flag:'wx'});
const inputsUnchanged=JSON.stringify(paths.map(ref))===JSON.stringify(inputs);
const installed=existsSync(resolve(root,evidence+'installed.json'))?JSON.parse(readFileSync(resolve(root,evidence+'installed.json'))):null;
const state=!timeout&&result.code===0&&inputsUnchanged&&installed?.state==='PASS'&&observation.classification==='NORMAL'&&observation.evidenceState==='AVAILABLE'?'PASS':'FAIL';
write(evidence+'execution.json',{kind:'MemoryOSRESTPhase3BRExecution',version:'1.0.0',state,archive,inputs,inputsUnchanged,start,end,host:{events,observation},result,timeout,log:ref(output),installed:installed?ref(evidence+'installed.json'):null});
process.stdout.write(JSON.stringify({state,result,host:observation.classification,evidenceState:observation.evidenceState})+'\n');
assert.equal(state,'PASS');
