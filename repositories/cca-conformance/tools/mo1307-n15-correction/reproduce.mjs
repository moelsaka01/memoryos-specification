// Exactly one N15 failure-only diagnostic copy invocation. No retries or product PASS claim.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawn,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),T=path.dirname(fileURLToPath(import.meta.url));
const base='repositories/cca-conformance/evidence/mo1307/n15-correction',P=path.join(root,base,'reproduction-preparation'),E=path.join(root,base,'reproduction');
const old='repositories/cca-conformance/evidence/mo1307/final-headless',head='b73f4bd6ce71228372614889d9c6da1b778df49d';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const record=f=>{const b=fs.readFileSync(f);return{path:path.relative(root,f).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const check=r=>assert.deepEqual(record(path.join(root,r.path)),r);
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const put=(n,b)=>{fs.writeFileSync(path.join(E,n),b,{flag:'wx'});return record(path.join(E,n));};
const write=(n,o)=>put(n,Buffer.from(JSON.stringify(o,null,2)+'\n'));
const err=e=>({name:e.name,code:e.code??null,message:e.message,stack:e.stack});
const walk=(base,prefix='')=>fs.readdirSync(path.join(base,prefix),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(d=>{const p=prefix?prefix+'/'+d.name:d.name,s=fs.lstatSync(path.join(base,p));assert.ok(!s.isSymbolicLink());return s.isDirectory()?walk(base,p):[{...record(path.join(base,p)),relative:p}];});
const git=(...args)=>{const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory=C:/m7fix',...args],{cwd:root,windowsHide:true,encoding:null,timeout:30000,maxBuffer:4*1024*1024});assert.ifError(r.error);assert.equal(r.status,0);return r.stdout;};
assert.equal(process.argv.length,2);assert.equal(path.resolve(root).toLowerCase(),'c:\\m7fix');assert.equal(fs.existsSync(E),false,'One fixed diagnostic generation; no override/retry');
fs.mkdirSync(E,{recursive:false});
const row={result:'FAIL',invocations:0,diagnosticOnly:true,events:[]};let failure=null,seal=null,sourceUnchanged=false,fixturesUnchanged=false;let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0);
try{
 assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
 assert.equal(git('rev-parse','HEAD').toString().trim(),head);assert.equal(git('branch','--show-current').toString().trim(),'codex/mo1307-n15-correction');
 const proof=json(path.join(P,'preparation.json'));assert.equal(proof.result,'PASS');assert.equal(proof.exactInverseEquality,true);assert.equal(proof.replacements,3);assert.equal(proof.nativeLastErrorReadsAdded,0);assert.equal(proof.stderrMaximumBytes,4096);
 // Exact record comparison without inventory-only relative annotations.
 const exact=r=>{const {relative,...binding}=r;check(binding);};
 for(const r of [proof.source,proof.generator,proof.driver,proof.diagnosticCopy,proof.inverse,proof.request,proof.retainedRequest,proof.ledger,proof.lineMap,...proof.sourceMembers,...proof.fixtureFiles,...proof.retainedFiles])exact(r);
 assert.equal(proof.sourceMembers.length,89);for(const r of proof.sourceMembers)assert.equal(hash(git('show',head+':'+r.path)),r.sha256);
 assert.equal(proof.fixtureFiles.length,21);assert.deepEqual(walk(proof.fixtureRoot),proof.fixtureFiles);assert.equal(fs.existsSync(proof.outputRoot),false);
 const requestBytes=fs.readFileSync(path.join(root,proof.request.path));assert.deepEqual(requestBytes,fs.readFileSync(path.join(root,proof.retainedRequest.path)));
 const request=decodeHelperRequest(requestBytes);assert.equal(request.sequence,4);assert.equal(request.operation,'CHECK_OUTPUT');assert.deepEqual(request.files,[]);assert.deepEqual(request.roots,[{id:'output',path:proof.outputRoot}]);
 const launch=helperLaunchSpecification(),args=[...launch.args];assert.equal(args.at(-2),'-File');assert.equal(path.resolve(args.at(-1)),path.resolve(root,proof.source.path));args[args.length-1]=path.join(root,proof.diagnosticCopy.path);
 assert.equal(launch.options.detached,false);assert.equal(launch.options.windowsHide,true);assert.equal(launch.options.shell,false);assert.deepEqual([...launch.options.stdio],['pipe','pipe','pipe']);assert.deepEqual({...launch.options.env},{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'});
 const priorSeal=json(path.join(root,old,'minimum-wire-smoke/seal.json'));assert.deepEqual(record(process.execPath),priorSeal.runtime[0]);assert.deepEqual(record(launch.executable),priorSeal.runtime[1]);
 const authority=[base+'/authorization.txt',base+'/authority-and-retained-evidence-review.json','docs/mo1307-contract-freeze-1.md','docs/mo1307-phase2c-publication-inspection-correction.md','docs/mo1307-phase2c-finalization-boundary-correction.md','docs/mo1307-final-headless-correction-addendum.md','repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs','repositories/cca-conformance/tools/mo1307-phase2c-correction/publication-fixture.mjs',old+'/validation-source.json',old+'/regressions/native-foundation-016.receipt.json'].map(p=>record(path.join(root,p)));
 seal={kind:'MO1307N15OneReproductionSeal',head,candidate:null,source:proof.sourceMembers,preparation:record(path.join(P,'preparation.json')),preparationBindings:[proof.source,proof.generator,proof.driver,proof.diagnosticCopy,proof.inverse,proof.request,proof.retainedRequest,proof.ledger,proof.lineMap],fixtureRoot:proof.fixtureRoot,fixtureFiles:proof.fixtureFiles,retainedFiles:proof.retainedFiles,authority,runtime:[record(process.execPath),record(launch.executable)],launch:{executable:launch.executable,args,options:launch.options},request:proof.request,expectedHistoricalResponse:record(path.join(root,old,'regressions/native-foundation-016-native-capture/helper-5.stdout')),constraints:{oneInvocation:true,noRetry:true,helperWholeLifecycleMs:5000,failureCleanupMs:2000,stdoutMaximumBytes:16777216,stderrMaximumBytes:4096,noProductMutation:true,noStartupTracing:true,noNativeCallAdded:true,diagnosticOnly:true}};
 write('seal.json',seal);write('started.json',{at:new Date().toISOString(),seal:record(path.join(E,'seal.json')),invocationLimit:1});
 for(const r of [...seal.source,...seal.preparationBindings,...seal.authority,...seal.runtime,...seal.fixtureFiles,...seal.retainedFiles])exact(r);
 const state={stdinFinish:false,stdinClose:false,stdoutEnd:false,stdoutClose:false,stderrEnd:false,stderrClose:false,exit:false,processClose:false};row.state=state;
 const start=performance.now();row.startedAt=new Date().toISOString();let child,closed=false,deadlineTimer,cleanupTimer,terminalAt=null,reason=null;const chunks={stdout:[],stderr:[]},totals={stdout:0,stderr:0};
 const event=(name,value=null)=>row.events.push({name,value,elapsedMs:performance.now()-start});
 await new Promise(resolve=>{
  const done=()=>{if(closed)return;closed=true;clearTimeout(deadlineTimer);clearTimeout(cleanupTimer);resolve();};
  const stop=why=>{if(reason!==null)return;reason=why;terminalAt=performance.now();event('terminal',why);try{child?.stdin.destroy();row.ownedChildKillRequested=true;row.ownedChildKillResult=child?.kill()??false;}catch(e){row.killError=err(e);}cleanupTimer=setTimeout(()=>{event('cleanupDeadline');for(const stream of [child?.stdin,child?.stdout,child?.stderr])stream?.destroy();child?.unref();done();},Math.max(0,terminalAt+2000-performance.now()));};
  deadlineTimer=setTimeout(()=>stop('HELPER_DEADLINE'),Math.max(0,start+5000-performance.now()));
  try{row.invocations++;child=spawn(launch.executable,args,{...launch.options,env:{...launch.options.env},stdio:[...launch.options.stdio]});row.pid=child.pid??null;}catch(e){row.spawnError=err(e);reason='SPAWN_ERROR';done();return;}
  child.once('error',e=>{row.spawnError=err(e);stop('CHILD_ERROR');});
  for(const [stream,name]of[[child.stdin,'stdin'],[child.stdout,'stdout'],[child.stderr,'stderr']]){
   stream.on('error',e=>{event(name+'Error',err(e));stop('PIPE_ERROR');});
   stream.once('close',()=>{state[name+'Close']=true;event(name+'Close');});
  }
  child.stdin.once('finish',()=>{state.stdinFinish=true;event('stdinFinish');});
  for(const name of ['stdout','stderr']){child[name].once('end',()=>{state[name+'End']=true;event(name+'End');});child[name].on('data',b=>{const cap=name==='stdout'?16777216:4096,remaining=Math.max(0,cap-totals[name]);if(remaining)chunks[name].push(Buffer.from(b.subarray(0,remaining)));totals[name]+=b.length;if(totals[name]>cap)stop('OUTPUT_CAP');});}
  child.once('exit',(code,signal)=>{state.exit=true;row.exitCode=code;row.signal=signal;event('exit',{code,signal});});
  child.once('close',()=>{state.processClose=true;event('processClose');done();});
  child.stdin.end(requestBytes);
 });
 row.elapsedMs=performance.now()-start;row.terminalReason=reason;row.cleanupElapsedMs=terminalAt===null?null:performance.now()-terminalAt;row.totalBytes=totals;stdout=Buffer.concat(chunks.stdout);stderr=Buffer.concat(chunks.stderr);
 assert.equal(reason,null,'Diagnostic failed its lifecycle/transport bound');assert.equal(row.exitCode,0);assert.equal(row.signal,null);assert.ok(row.elapsedMs<5000);assert.ok(Object.values(state).every(Boolean),'Actual process and all redirected stream EOF/close signals required');assert.equal(totals.stderr,stderr.length);assert.equal(totals.stdout,stdout.length);
 assert.ok(stdout.length>=4);assert.equal(stdout.readUInt32BE(0),stdout.length-4);const response=decodeHelperResponse(stdout,request);row.response=response;
 if(response.status==='ERROR'&&response.code==='MO1307_FILESYSTEM_BOUNDARY'){
  assert.deepEqual(stdout,fs.readFileSync(path.join(root,seal.expectedHistoricalResponse.path)));const diagnostic=JSON.parse(stderr.toString('utf8'));assert.equal(diagnostic.kind,'MO1307N15BoundaryFailure');assert.equal(diagnostic.code,'MO1307_FILESYSTEM_BOUNDARY');assert.equal(diagnostic.failureOnly,true);assert.ok(diagnostic.stack.length>=2);
  const lineMap=json(path.join(P,'original-line-map.json'));row.diagnostic=diagnostic;row.sourceCallStack=diagnostic.stack.map(([name,line])=>({name,generatedLine:line,sourceLine:lineMap.find(r=>r.generatedLine===line)?.sourceLine??null}));assert.ok(row.sourceCallStack.slice(1).some(r=>r.sourceLine!==null));row.result='BOUNDARY_FAILURE_CAPTURED';
 }else{assert.equal(response.status,'ABSENT');assert.equal(response.code,null);assert.equal(stderr.length,0);row.result='BOUNDARY_FAILURE_NOT_REPRODUCED';}
}catch(e){failure=err(e);}
finally{
 try{if(seal){for(const r of [...seal.source,...seal.preparationBindings,...seal.authority,...seal.runtime])check(r);sourceUnchanged=true;assert.deepEqual(walk(seal.fixtureRoot),seal.fixtureFiles);fixturesUnchanged=true;}}catch(e){failure??=err(e);}
 row.stdout=put('stdout.bin',stdout);row.stderr=put('stderr.bin',stderr);
 if(failure)write('stopped.json',{reason:'ONE_DIAGNOSTIC_INCOMPLETE',failure,noRetry:true,noFurtherInvocations:true});
 write('receipt.json',{kind:'MO1307N15OneReproductionReceipt',result:failure?'DIAGNOSTIC_INCOMPLETE':row.result,row,failure,sourceUnchanged,fixturesUnchanged,candidate:null,productValidationPassed:false,certification:false,retries:0,seal:seal?record(path.join(E,'seal.json')):null,scope:'One copied retained CHECK_OUTPUT request, same existing fixture parent, exact original source outside three reversible failure-observation additions. No product PASS or current candidate acceptance.',finishedAt:new Date().toISOString()});
 console.log(JSON.stringify({result:failure?'DIAGNOSTIC_INCOMPLETE':row.result,invocations:row.invocations,receipt:path.join(E,'receipt.json')}));process.exitCode=failure?1:0;
}
