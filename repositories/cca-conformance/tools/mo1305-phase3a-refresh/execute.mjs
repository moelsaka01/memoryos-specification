/** Refresh execution and frozen Windows host-interruption evidence. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {identity,canonical,bounded} from './common.mjs';
import {classify,queryEvents,policySha256} from '../mo1305-host-guard.mjs';
const root=resolve(import.meta.dirname,'../../../..');
const e=resolve(root,'repositories/cca-conformance/evidence/mo1305-phase3a-refresh');
const s=JSON.parse(readFileSync(resolve(root,'.cache/mo1305-phase3a-refresh/state.json')));
assert.equal(identity(readFileSync(process.execPath)).sha256,'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(JSON.parse(readFileSync(resolve(e,'installation.json'))).state,'PASS');
assert.ok(!existsSync(resolve(e,'execution.json')),'FRESH_EXECUTION_REQUIRED');
const stamp=()=>({domain:'MONOTONIC_PROCESS_HRTIME',ns:process.hrtime.bigint().toString(),utcMs:Date.now()});
const harness={path:'repositories/cca-conformance/evidence/mo1305-phase3a-refresh/harness.json',...identity(readFileSync(resolve(e,'harness.json')))};
const start=stamp(),args=[resolve(s.stage,'harness/probe.mjs'),s.packagePath,resolve(s.stage,'private/config.json'),resolve(s.stage,'fixtures'),resolve(s.stage,'oracle'),resolve(s.stage,'results'),s.curlPath,s.remoteAddress];
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(SYSTEMROOT|WINDIR)$/iu.test(key)));
Object.assign(env,{TEMP:resolve(s.stage,'tmp'),TMP:resolve(s.stage,'tmp'),PATH:'C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0'});
const child=spawn(s.node,args,{cwd:resolve(s.stage,'empty'),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),overflow=false,timeout=false;
for(const [stream,key] of [[child.stdout,'out'],[child.stderr,'err']])stream.on('data',bytes=>{if(key==='out')stdout=Buffer.concat([stdout,bytes]);else stderr=Buffer.concat([stderr,bytes]);if(stdout.length+stderr.length>1048576){overflow=true;child.kill();}});
const exit=new Promise((done,fail)=>{child.once('error',fail);child.once('close',(code,signal)=>done({code,signal}));});
let result;
try{result=await bounded(exit,240000,'REFRESH_PROBE_TIMEOUT');}catch(error){timeout=true;child.kill();result=await bounded(exit,10000,'PROBE_REAP_TIMEOUT');}
const end=stamp(),events=await queryEvents(start.utcMs,end.utcMs);
const base={attemptId:'targeted-refresh-1',candidateId:'faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382',phase:'phase3a-refresh',index:0};
const observation=classify({...base,start,end,caseId:'bounded-installed-refresh',sampleId:'targeted-refresh-1'},events);
const probePath=resolve(s.stage,'results/probe.json');
const probe=existsSync(probePath)?JSON.parse(readFileSync(probePath)):null;
if(probe)writeFileSync(resolve(e,'probe.json'),canonical(probe),{flag:'wx'});
const windows=[];
for(const [index,row] of (probe?.records??[]).entries()){
 const window=row.window??row.validityWindow??(row.start&&row.end?{start:row.start,end:row.end}:null);
 const normalized=x=>x?.ns?x:{domain:probe.timestampDomain,ns:x.monotonicNs,utcMs:x.utcMs};
 if(window)windows.push(classify({...base,index,start:normalized(window.start),end:normalized(window.end),caseId:row.id,sampleId:row.id},events));
}
const hostAccepted=observation.classification==='NORMAL'&&observation.evidenceState==='AVAILABLE'&&observation.reason===null&&windows.length===(probe?.records.length??-1)&&windows.every(x=>x.classification==='NORMAL'&&x.evidenceState==='AVAILABLE'&&x.reason===null);
const state=observation.classification==='HOST_INTERRUPTED'||windows.some(x=>x.classification==='HOST_INTERRUPTED')?'HOST_INTERRUPTED':hostAccepted&&result.code===0&&result.signal===null&&!timeout&&!overflow&&probe?.state==='PASS'?'PASS':'FAIL';
const report={kind:'MemoryOSRESTWindowsRefreshExecution',version:'1.0.0',state,start,end,result,timeout,overflow,harness,pid:child.pid,command:{node:'$ISOLATED/toolchain/node.exe',argv:args.map(x=>x.replaceAll(s.stage,'$ISOLATED'))},stdout:identity(stdout),stderr:identity(stderr),host:{policySha256,events,observation,caseObservations:windows},probe:probe?{path:'repositories/cca-conformance/evidence/mo1305-phase3a-refresh/probe.json',...identity(readFileSync(resolve(e,'probe.json')))}:null};
writeFileSync(resolve(e,'execution.json'),canonical(report),{flag:'wx'});
console.log(JSON.stringify({state,result,host:observation.classification,evidence:observation.evidenceState,records:probe?.records.length,failure:probe?.failure??null,stderr:stderr.toString().replaceAll(s.stage,'$ISOLATED').slice(0,1500)}));
if(state!=='PASS')process.exitCode=1;