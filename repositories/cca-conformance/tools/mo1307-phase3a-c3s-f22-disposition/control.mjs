// Exactly one unmodified F22 control against an exact C3RB Git-blob projection.
// No helper, performance witness, test instrumentation, retry or production edit.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const baseline='defe93989efc6501b1a730b82e79e705884b269b';
const main='4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const evidence='repositories/cca-conformance/evidence/mo1307/phase3a-c3s-f22-disposition';
const tool='repositories/cca-conformance/tools/mo1307-phase3a-c3s-f22-disposition/control.mjs';
const projection='.cache/f22b';
const test='repositories/cca-conformance/tests/mo1307_phase2c_finalization_test.mjs';
const title='F22 read-only verification timeout is bounded and late handle completion only closes';
const files=[test,'repositories/cca-conformance/tools/mo1307-phase2c-correction/publication-fixture.mjs',...['publication','helper-protocol','windows-paths','canonical','errors','constants'].map(n=>'repositories/memoryos-readiness/src/'+n+'.mjs')].sort();
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.resolve(root,p));
const json=p=>JSON.parse(read(p));
const descriptor=(p,b=read(p))=>({path:p,byteLength:b.length,sha256:sha(b)});
function check(m){const b=read(m.path);assert.equal(b.length,m.byteLength,m.path);assert.equal(sha(b),m.sha256,m.path);}
function write(p,v){const full=path.resolve(root,p);assert.ok(full.startsWith(path.resolve(root)+path.sep));fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,JSON.stringify(v,null,2)+'\n',{flag:'wx'});}
function git(...args){const r=spawnSync('git',['--no-optional-locks',...args],{cwd:root,windowsHide:true,encoding:null,maxBuffer:32*1024*1024,timeout:30000});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
const str=(...a)=>git(...a).toString('utf8').trim();
function mainState(){return {HEAD:str('rev-parse','HEAD'),branch:str('branch','--show-current'),status:git('status','--porcelain=v1','--untracked-files=all').toString('utf8'),staged:str('diff','--cached','--name-only')};}
function r3aState(){const worktree='C:/Users/melsa/Documents/Codex/r3a',a=['-c','safe.directory='+worktree,'-C',worktree];return {worktree,HEAD:str(...a,'rev-parse','HEAD'),status:git(...a,'status','--porcelain=v1','--untracked-files=all').toString('utf8')};}
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(sha(read(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(process.argv.length,3);assert.ok(['prepare','run'].includes(process.argv[2]));

if(process.argv[2]==='prepare'){
 const state=mainState();assert.equal(state.HEAD,main);assert.equal(state.branch,'main');assert.equal(state.staged,'');
 assert.equal(fs.existsSync(path.resolve(root,evidence)),false);assert.equal(fs.existsSync(path.resolve(root,projection)),false);
 const previous=[...new Set([...str('diff','--name-only').split('\n'),...str('ls-files','--others','--exclude-standard').split('\n')].filter(p=>p&&!p.includes('phase3a-c3s-f22-disposition')))].sort();
 const preservation={main:state,r3a:r3aState(),files:previous.map(p=>descriptor(p)),scope:'All pre-existing tracked working changes and non-ignored untracked files; unchanged committed source separately verified by the projection closure. No whole-disk claim.'};
 const members=files.map(p=>{const bytes=git('show',baseline+':'+p);assert.deepEqual(read(p),bytes,'Current F22 dependency must match exact C3RB: '+p);return {...descriptor(projection+'/'+p,bytes),sourcePath:p,gitBlob:str('rev-parse',baseline+':'+p)};});
 const localEdges=[],builtins=new Set();
 for(const member of members){const source=git('show',baseline+':'+member.sourcePath).toString('utf8');assert.equal(/\bimport\s*\(/u.test(source),false);for(const m of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/gu)){if(m[1].startsWith('node:'))builtins.add(m[1]);else{assert.ok(m[1].startsWith('.'));const target=path.posix.normalize(path.posix.join(path.posix.dirname(member.sourcePath),m[1]));assert.ok(files.includes(target),'Incomplete closure '+target);localEdges.push({from:member.sourcePath,to:target});}}}
 for(const m of members){const full=path.resolve(root,m.path);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,git('show',baseline+':'+m.sourcePath),{flag:'wx'});check(m);}
 write(evidence+'/preservation-before.json',preservation);
 const args=['--test','--test-name-pattern=^'+title+'$','--test-reporter=tap','--test-concurrency=1',test];
 const plan={kind:'MO1307C3SF22ControlPlan',version:'1.0.0',baseline:{commit:baseline,tree:str('rev-parse',baseline+'^{tree}'),parent:str('show','-s','--format=%P',baseline)},sourceProjection:{root:path.resolve(root,projection),scope:'Exact eight-file F22 dependency closure, not a complete checkout.',members,localEdges,builtins:[...builtins].sort()},runtime:{version:process.version,platform:process.platform,arch:process.arch,executable:descriptor(process.execPath)},runner:descriptor(tool),command:{executable:process.execPath,args,cwd:path.resolve(root,projection),windowsHide:true,shell:false,testProcessGuardMs:30000},expectedSelectedTest:title,maximumF22Executions:1,warmups:0,retries:0,additionalTestsAuthorized:false,instrumentation:false,deadlineOverrides:false,clockObservation:'Assertion performance.now(), dispositionDeadline and their numeric difference are not emitted by the unchanged test. Do not substitute a later clock read.',preservation:descriptor(evidence+'/preservation-before.json'),certification:false,performanceCharacterization:false,helperExecution:false,stop:'Stop after this single control irrespective of result. No remaining suite, C3S performance, fix, commit or certification.'};
 write(evidence+'/plan.json',plan);console.log(JSON.stringify({result:'PREPARED',baseline:plan.baseline,sourceFiles:members.length,maximumF22Executions:1,command:plan.command}));
}else{
 const plan=json(evidence+'/plan.json'),preserved=json(evidence+'/preservation-before.json');check(plan.runner);check(plan.runtime.executable);check(plan.preservation);
 assert.equal(str('rev-parse','HEAD'),main);assert.equal(str('diff','--cached','--name-only'),'');assert.deepEqual(r3aState(),preserved.r3a);
 assert.equal(process.env.NODE_OPTIONS??'','');assert.equal(process.env.NODE_PATH??'','');
 for(const m of preserved.files)check(m);for(const m of plan.sourceProjection.members){check(m);assert.deepEqual(read(m.path),git('show',baseline+':'+m.sourcePath));assert.deepEqual(read(m.sourcePath),read(m.path));}
 const actualFiles=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);assert.equal(e.isSymbolicLink(),false);if(e.isDirectory())walk(p);else actualFiles.push(path.relative(path.resolve(root,projection),p).replaceAll('\\','/'));}}walk(path.resolve(root,projection));assert.deepEqual(actualFiles.sort(),files);
 write(evidence+'/execution-claimed.json',{kind:'MO1307C3SF22SingleExecutionClaim',createdAtUtc:new Date().toISOString(),plan:descriptor(evidence+'/plan.json'),maximumExecutions:1,retries:0});
 const started=performance.now();const child=spawnSync(plan.command.executable,plan.command.args,{cwd:plan.command.cwd,windowsHide:true,shell:false,encoding:null,timeout:plan.command.testProcessGuardMs,maxBuffer:4*1024*1024});const processElapsedMs=performance.now()-started;
 const stdout=child.stdout??Buffer.alloc(0),stderr=child.stderr??Buffer.alloc(0);fs.writeFileSync(path.resolve(root,evidence,'stdout.tap'),stdout,{flag:'wx'});fs.writeFileSync(path.resolve(root,evidence,'stderr.txt'),stderr,{flag:'wx'});
 const text=stdout.toString('utf8'),escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const results=[...text.matchAll(new RegExp('^(not ok|ok) (\\d+) - '+escape(title)+'([^\\r\\n]*)$','gm'))];
 const allResults=[...text.matchAll(/^(not ok|ok) (\d+) - (.+)$/gm)];
 const otherActive=allResults.filter(m=>!m[3].startsWith(title)&&!m[3].includes('# SKIP'));
 const selected=results[0];const durationMatch=selected?text.slice(selected.index).match(/duration_ms:\s*([0-9.]+)/):null;
 let classification='F22_CONTROL_INVALID',validityFailure=null;
 if(child.error||child.signal||results.length!==1||otherActive.length||!selected||selected[3].includes('# SKIP'))validityFailure={error:child.error?.code??null,signal:child.signal,selectedResults:results.length,otherActiveResults:otherActive.map(m=>m[3])};
 else if(selected[1]==='ok'&&child.status===0)classification='F22_BASELINE_PASS_C3S_FAIL_OBSERVED';
 else if(selected[1]==='not ok'&&child.status===1&&text.includes('assert.ok(performance.now() >= publicationStatus(item.token).dispositionDeadline)')&&/mo1307_phase2c_finalization_test\.mjs:206:/.test(text))classification='F22_PREEXISTING_REPRODUCED';
 else {classification='F22_UNRESOLVED';validityFailure={reason:'One selected F22 completed but outcome is neither PASS nor the same assertion failure.'};}
 const afterFailures=[];
 for(const m of [...preserved.files,...plan.sourceProjection.members,plan.runner,plan.runtime.executable]){try{check(m);}catch(error){afterFailures.push({path:m.path,message:error.message});}}
 for(const m of plan.sourceProjection.members){try{assert.deepEqual(read(m.sourcePath),read(m.path));}catch(error){afterFailures.push({path:m.sourcePath,message:error.message});}}
 try{assert.equal(str('rev-parse','HEAD'),main);assert.equal(str('diff','--cached','--name-only'),'');assert.deepEqual(r3aState(),preserved.r3a);}catch(error){afterFailures.push({path:'repository-state',message:error.message});}
 if(afterFailures.length){classification='F22_CONTROL_INVALID';validityFailure={reason:'Preservation/source identity verification failed',afterFailures};}
 const observation={kind:'MO1307C3SF22ControlReceipt',version:'1.0.0',classification,validityFailure,baseline:plan.baseline,plan:descriptor(evidence+'/plan.json'),executionClaim:descriptor(evidence+'/execution-claimed.json'),actualCommand:plan.command,runtime:plan.runtime,process:{pid:child.pid,exit:child.status,signal:child.signal,error:child.error?.code??null,elapsedMs:processElapsedMs},F22:{selectedResults:results.length,result:selected?.[1]==='ok'?'PASS':selected?.[1]==='not ok'?'FAIL':'NOT_ESTABLISHED',durationMs:durationMatch?Number(durationMatch[1]):null,assertionPerformanceNow:'NOT_OBSERVED_WITH_UNMODIFIED_TEST',dispositionDeadline:'NOT_OBSERVED_WITH_UNMODIFIED_TEST',differenceMs:'NOT_OBSERVED_WITH_UNMODIFIED_TEST',publicationState:classification==='F22_PREEXISTING_REPRODUCED'||classification==='F22_BASELINE_PASS_C3S_FAIL_OBSERVED'?{phase:'COMMITTED',namespaceVerified:false,authority:'Inferred only from the unchanged preceding assertions passing; no captured full status snapshot.'}:'NOT_ESTABLISHED'},stdout:descriptor(evidence+'/stdout.tap'),stderr:descriptor(evidence+'/stderr.txt'),sourceAndWorkingCopyPreserved:afterFailures.length===0,preservationFailures:afterFailures,sourceMembers:plan.sourceProjection.members,executions:1,retries:0,nativeHelpers:0,performanceWitnesses:0,C3SAccepted:false,C3SB:null,stop:true};
 write(evidence+'/receipt.json',observation);console.log(JSON.stringify({classification,F22:observation.F22,process:observation.process,preserved:observation.sourceAndWorkingCopyPreserved}));
}
