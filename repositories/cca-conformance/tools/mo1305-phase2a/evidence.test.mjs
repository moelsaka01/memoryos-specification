/** Negative projections for the focused evidence boundary; no product listeners. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {BASELINE,EXPECTED_IDS,EXPECTED_VECTORS,LIMITS_SHA,identity,encodeRaw,validateBundle} from './evidence.mjs';
import {root,J,sha256,nodeSha256} from './setup.mjs';

const prefix='repositories/memoryos-rest/',tools='repositories/cca-conformance/tools/',fixtures='repositories/cca-conformance/fixtures/mo1305-phase1/';
const raw=path=>readFileSync(resolve(root,path));
const canonical=value=>Buffer.from(J(value));
function lifecycleActual(id){
 const specific={
  'startup-ready-idle-shutdown':{exitCode:0,states:['INITIALIZING','READY','DRAINING','STOPPED']},
  'product-control-eof':{exitCode:0},'product-control-invalid':{exitCode:1},
  'product-nonpipe-invalid-control':{exitCode:1,input:'regularFile',listenerClosed:true},
  'product-early-control-eof':{exitCode:0,listenerClosed:true,startupObserved:true},
  'product-early-control-invalid':{exitCode:1,listenerClosed:true,startupObserved:false},
  'startup-already-aborted':{listenerStarted:false,states:['INITIALIZING','DRAINING','STOPPED']},
  'startup-listener-conflict':{exitCode:2,rebound:true},
  'readiness-worker-busy-cancel':{created:1,reaped:1,queued:0},
  'shutdown-published-semantic':{status:200,oneResponse:true},
  'unexpected-worker-exit':{error:'MO1305_INTERNAL_FAILURE',ready:true},
  'stale-worker-result':{stalePublication:false},
  'generation-exhaustion':{error:'MO1305_UNAVAILABLE',workers:0},
  'runtime-integrity-poison':{error:'MO1305_RUNTIME_INTEGRITY',semanticPublication:false,exitCode:1},
  'listener-runtime-error':{exitCode:1,state:'FAILED'},
  'worker-termination-deadline':{exitCode:1,forced:true,elapsedMs:2000},
  'shutdown-deadline-listener-close':{exitCode:1,forced:true,elapsedMs:15000,rebound:true},
  'semantic-fixed-parity-subset':{vectors:EXPECTED_VECTORS,equalities:11}
 };
 let actual=specific[id];
 if(id.startsWith('shutdown-during-'))actual={publicationSuppressed:true,cleanup:true,rebound:true};
 if(id==='shutdown-semantic-ready'||id==='shutdown-semantic-reaping')actual={phase:id.slice('shutdown-semantic-'.length),published:false,reaped:1};
 if(id.startsWith('published-drain-'))actual={exitCode:id.endsWith('fatal-upgrade')?1:0,elapsedMs:10000,newConnection:false,newRequest:false,workers:0};
 if(id.endsWith('-connection-limit'))actual={maximum:32,rejected:33,cleanup:0};
 if(id.endsWith('-connection-one-request'))actual={keepAlive:false,pipelinedDispatch:false,oneResponse:true};
 assert.ok(actual,'Unknown unit lifecycle case');return {...actual,sessions:[]};
}
function remoteActual(id){
 if(id.startsWith('BIND-valid-'))return {mode:'remote',syntheticInterface:true};
 if(id.startsWith('BIND-'))return {rejected:true,syntheticInterface:true};
 if(id.startsWith('STARTUP-')||id.startsWith('TLS-')||id.startsWith('REMOTE-STARTUP-'))return {exitCode:2,listenerObserved:false,probes:1,secretSafeDiagnostic:true,elapsedMs:1};
 if(id.startsWith('REMOTE-auth-required-')||id==='REMOTE-wrong-bearer')return {status:401};
 const actual={
  'CONFIG-frozen-local-defaults':{mode:'local',bindAddress:'127.0.0.1',port:13050},
  'LOCAL-startup-readiness':{status:200,serverPid:1,clientPid:2},
  'LOCAL-idle-shutdown':{exitCode:0},
  'REMOTE-actual-RFC1918':{serverPid:1,clientPid:2,localAddress:'192.168.1.53',remoteAddress:'192.168.1.53',bindAddress:'192.168.1.53',tlsVersion:'TLSv1.3',alpn:'http/1.1',authorized:true},
  'REMOTE-no-loopback-fallback':{loopbackListener:false},
  'REMOTE-getReadiness':{status:200},'REMOTE-getContractIdentities':{status:200},
  'REMOTE-TLS12-refused':{httpBytes:0},'REMOTE-plaintext-refused':{httpResponse:false},
  'REMOTE-token-held-until-restart':{oldTokenStatus:200,newTokenStatus:401},
  'REMOTE-listener-shutdown':{exitCode:0},'REMOTE-token-rotation-after-restart':{oldTokenStatus:401,newTokenStatus:200},
  'REMOTE-repeat-rebind':{status:200,exitCode:0}
 }[id];assert.ok(actual,'Unknown unit remote case');return actual;
}
function specimen(){
 const source=new Map(),add=path=>{const bytes=raw(path);source.set(path,bytes);return identity(path,bytes);};
 const frozen=JSON.parse(raw(prefix+'distribution-manifest.json'));
 const product=[...frozen.files.map(row=>add(prefix+row.path)),add(prefix+'distribution-manifest.json')].sort((a,b)=>a.path<b.path?-1:1);
 const stagedManifest={...frozen,files:frozen.files.map(row=>{const current=product.find(x=>x.path===prefix+row.path);return {...current,path:row.path};})};
 const digest=sha256(canonical(stagedManifest));
 const harness=[...['evidence.mjs','evidence.test.mjs','harness.mjs','lifecycle.mjs','regressions.mjs','remote.mjs','remote-complete.mjs','setup.mjs','signals.py','supervisor.mjs'].map(x=>tools+'mo1305-phase2a/'+x),...['clock.mjs','failure-schema-2.0.0.json','fault-worker.mjs','validate-launch.ps1','regressions.py'].map(x=>tools+'mo1305-phase1/'+x)].sort().map(add);
 const selected=new Set(['max-mip-policy',...EXPECTED_VECTORS]);
 const fixtureInputs=[fixtures+'index.json',...JSON.parse(raw(fixtures+'index.json')).files.filter(row=>selected.has(JSON.parse(raw(fixtures+row.path)).id)).map(row=>fixtures+row.path)].sort().map(add);
 const regressionInputs=[add(tools+'mo1305-phase1/regressions.py')];
 const lifecycle={kind:'MemoryOSRESTPhase2ALifecycleResults',version:'1.0.0',state:'PASS',baseline:BASELINE.commit,elapsedMs:100,
  staging:{address:'192.168.1.53',distributionManifestSha256:digest,interfaces:[{address:'192.168.1.53',cidr:'192.168.1.53/24'}],kind:'MemoryOSRESTPhase2AFocusedStaging',nodeSha256,port:53001,releasePackageEvidence:false,source:'repositories/memoryos-rest',stagedFileCount:stagedManifest.files.length+1},
  records:EXPECTED_IDS.lifecycle.map(id=>({id,state:'PASS',expected:'Validator unit specimen only',actual:lifecycleActual(id),elapsedMs:1}))};
 const remote={kind:'MemoryOSRESTPhase2ARemoteLifecycleResults',version:'1.0.0',state:'PASS',staging:{distributionManifestSha256:digest,fileCount:stagedManifest.files.length+1,nodeVersion:'v24.21.0',platform:'win32',architecture:'x64'},elapsedMs:100,cases:EXPECTED_IDS.remote.length,passed:EXPECTED_IDS.remote.length,notExecuted:0,remoteAddress:'192.168.1.53',networkConfigurationChanged:false,records:EXPECTED_IDS.remote.map(id=>({id,state:'PASS',actual:remoteActual(id)}))};
 const signals={kind:'MemoryOSRESTPhase2AWindowsSignalResults',version:'1.0.0',state:'PASS',cases:1,passed:1,nodeSha256,stagedDistributionManifestSha256:digest,sigterm:'Unsupported native POSIX signal',startupSignal:'No startup signal claim',records:[{id:EXPECTED_IDS.signals[0],state:'PASS',elapsedMs:1,exitCode:0,tlsVersion:'TLSv1.3',readyBeforeSignal:true,listenerClosed:true,delivery:{event:'CTRL_C_EVENT',targetPid:1000,privateConsoleVerified:true}}]};
 const log=Buffer.from('# tests 1\n# pass 1\n# fail 0\n# skipped 0\n');
 const counts={tests:1,pass:1,fail:0,skipped:0};
 const regressions={kind:'MemoryOSRESTPhase2APredecessorRegressions',version:'1.0.0',state:'PASS',authority:tools+'mo1305-phase1/regressions.py',bounds:{maximumOutputBytesPerGroup:2097152,timeoutMsPerGroup:300000,maximumTotalMs:1200000},elapsedMs:6,finishedUtc:'2026-09-25T00:00:01.000Z',head:BASELINE.commit,inputs:regressionInputs,runtime:{path:'.cache/mo1305-phase2a/toolchain/node.exe',sha256:nodeSha256},startedUtc:'2026-09-25T00:00:00.000Z',excluded:'Unit specimen only',counts:{tests:6,pass:6,fail:0,skipped:0},harness:{path:tools+'mo1305-phase2a/regressions.mjs',sha256:harness.find(x=>x.path.endsWith('/regressions.mjs')).sha256},
  results:EXPECTED_IDS.regressions.map(id=>({id,state:'PASS',command:['node','--test'],exitCode:0,signal:null,error:null,outputExceeded:false,timedOut:false,elapsedMs:1,counts,log:identity('.cache/mo1305-phase2a/regressions/'+id+'.tap',log)}))};
 const inputs={kind:'MemoryOSRESTPhase2AInputs',version:'1.0.0',baseline:BASELINE,host:{platform:'win32',architecture:'x64',edition:'Validator unit specimen',version:'10.0',build:'1'},runtime:{path:'.cache/mo1305-phase2a/toolchain/node.exe',byteLength:1,sha256:nodeSha256,version:'24.21.0'},limits:product.find(x=>x.path===prefix+'contracts/limits.json'),product,harness,fixtures:fixtureInputs,regressions:regressionInputs,stagedManifest,stagedManifestSha256:digest,changedProductionFiles:['bin/memoryos-rest.mjs','src/config.mjs','src/server.mjs'].map(x=>prefix+x),harnessIdentityScope:'Final evidence tooling inputs; execution source identity is the recorded staged manifest'};
 assert.equal(inputs.limits.sha256,LIMITS_SHA);
 const catalog={kind:'MemoryOSRESTPhase2ACatalog',version:'1.0.0',baseline:BASELINE.commit,scope:'Focused remote and lifecycle completion',groups:Object.entries(EXPECTED_IDS).map(([id,requiredIds])=>({id,requiredIds}))};
 const files=new Map(Object.entries({lifecycle,remote,signals,regressions,inputs,catalog}).map(([name,value])=>[name+'.json',canonical(value)]));
 for(const id of EXPECTED_IDS.regressions)files.set('regression-logs/'+id+'.tap',log);
 files.set('receipt.json',canonical({kind:'MemoryOSRESTPhase2AIntegrationReceipt',version:'1.0.0',state:'PASS',baseline:BASELINE,claims:{B2:false,I2:false,releaseCertification:false,resourceRecharacterization:false},files:[],executions:['lifecycle','remote','signals'].map(module=>({module,stagedManifestSha256:digest})),counts:{lifecycle:EXPECTED_IDS.lifecycle.length,remote:EXPECTED_IDS.remote.length,signals:1,regressionGroups:6,regressionTests:6}}));
 reseal(files);
 return {files,source,options:{readInput:path=>{assert.ok(source.has(path),'Unknown unit input');return source.get(path);}}};
}
function edit(files,name,fn){const value=JSON.parse(files.get(name));fn(value);files.set(name,canonical(value));}
function reseal(files){edit(files,'receipt.json',receipt=>{receipt.files=[...files].filter(([name])=>name!=='receipt.json').map(([name,bytes])=>identity(name,bytes)).sort((a,b)=>a.path<b.path?-1:1);});}
function rejectProjection(label,project,pattern){test(label,()=>{const model=specimen();assert.equal(validateBundle(model.files,model.options).state,'PASS');project(model);reseal(model.files);assert.throws(()=>validateBundle(model.files,model.options),pattern);});}

test('valid complete canonical unit specimen passes',()=>{const model=specimen();assert.equal(validateBundle(model.files,model.options).state,'PASS');});
rejectProjection('missing result module is rejected',({files})=>files.delete('remote.json'),/MISSING_RESULT_MODULE/u);
rejectProjection('missing required case is rejected even after resealing',({files})=>edit(files,'lifecycle.json',value=>value.records.pop()),/MISSING_DUPLICATE_OR_UNKNOWN_RESULT_ID/u);
rejectProjection('duplicate case identifier is rejected',({files})=>edit(files,'lifecycle.json',value=>value.records[0].id=value.records[1].id),/MISSING_DUPLICATE_OR_UNKNOWN_RESULT_ID/u);
rejectProjection('module PASS cannot hide a failed case',({files})=>edit(files,'lifecycle.json',value=>value.records[0].state='FAIL'),/NON_PASS_RESULT/u);
rejectProjection('case PASS cannot hide a failure payload',({files})=>edit(files,'lifecycle.json',value=>value.records[0].actual={failure:'TIMEOUT'}),/FALSE_PASS_FAILURE/u);
rejectProjection('changed source bytes invalidate identity',({source})=>{const path=prefix+'src/server.mjs';source.set(path,Buffer.concat([source.get(path),Buffer.from('\nprojection\n')]));},/SOURCE_HASH_MISMATCH/u);
rejectProjection('unknown result field is rejected',({files})=>edit(files,'remote.json',value=>value.trusted=true),/UNKNOWN_FIELD/u);
rejectProjection('noncanonical module bytes are rejected',({files})=>files.set('remote.json',Buffer.concat([files.get('remote.json'),Buffer.from('\n')])),/NONCANONICAL_BYTES/u);
rejectProjection('changed frozen limits are rejected',({files})=>edit(files,'inputs.json',value=>value.limits.sha256='0'.repeat(64)),/FROZEN_LIMITS_CHANGED/u);
rejectProjection('changed baseline is rejected',({files})=>edit(files,'receipt.json',value=>value.baseline.commit='0'.repeat(40)),/deep-equal/u);
rejectProjection('prior execution cannot be rebound to later source',({files})=>edit(files,'remote.json',value=>value.staging.distributionManifestSha256='0'.repeat(64)),/STALE_EXECUTION_SOURCE/u);
rejectProjection('false regression aggregate is rejected',({files})=>edit(files,'regressions.json',value=>value.counts={tests:7,pass:7,fail:0,skipped:0}),/REGRESSION_COUNT_SUM/u);
rejectProjection('modified TAP result cannot retain old result counts',({files})=>{const name='regression-logs/mo1301-sdk.tap',bytes=Buffer.from('# tests 2\n# pass 2\n# fail 0\n# skipped 0\n');files.set(name,bytes);edit(files,'regressions.json',value=>value.results[0].log=identity(value.results[0].log.path,bytes));},/TAP_COUNTS_MISMATCH/u);
rejectProjection('unknown evidence file is rejected',({files})=>files.set('extra.json',canonical({state:'PASS'})),/MISSING_OR_UNEXPECTED_EVIDENCE_FILE/u);


function splitSpecimen(){
 const model=specimen(),files=model.files;
 const names=[
  'CLI transport accepts only one exact stdout envelope and propagates MO-1301 projections',
  'real bundled orchestration verifies PASS, FAIL, CNE, Policy Set, and trusted Regression',
  'valid MO-1301 evaluation failures propagate unchanged and publish no generation',
  'artifact verifier rejections remain MO-1301 failures and reconstruction contradictions are Action failures',
  'all six wrong decision/exit pairings are rejected after full verification'];
 const oldLog=Buffer.from(names.slice(0,4).map((name,index)=>'ok '+(index+1)+' - '+name).join('\n')+'\n');
 const focusedLog=Buffer.from('ok 1 - '+names[4]+'\n# tests 1\n# pass 1\n# fail 0\n# skipped 0\n');
 const oldRef=identity('.cache/mo1305-phase2a/regressions/mo1302-projections-attempt-2.tap',oldLog),focusedRef=identity('.cache/mo1305-phase2a/regressions/mo1302-projections-completion.tap',focusedLog);
 const runtime='.cache/mo1305-phase2a/toolchain/node.exe',prefix=[runtime,'--test','--test-concurrency=1','--test-reporter=tap'],file='repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs';
 const originalGroupCommand=[...prefix,'--test-name-pattern=CLI transport|real bundled orchestration|valid MO-1301 evaluation failures|artifact verifier rejections|wrong decision/exit',file];
 const old={id:'mo1302-projections',state:'FAIL',command:originalGroupCommand,exitCode:null,signal:'SIGTERM',error:null,outputExceeded:false,timedOut:true,elapsedMs:300000,counts:{},log:oldRef};
 const focused={id:'mo1302-projections',state:'PASS',command:[...prefix,'--test-name-pattern=^'+names[4]+'$',file],exitCode:0,signal:null,error:null,outputExceeded:false,timedOut:false,elapsedMs:1,counts:{tests:1,pass:1,fail:0,skipped:0},log:focusedRef};
 const caseCoverage=names.map((name,index)=>({name,state:'PASS',sourceLog:index<4?oldRef:focusedRef}));
 const aggregate={...focused,exitCode:null,counts:{tests:5,pass:5,fail:0,skipped:0},executionMode:'split-case-coverage',aggregateOnly:true,originalGroupCommand,focusedRunCounts:focused.counts,executionRuns:[old,focused],caseCoverage,note:'Two runs; no aggregate process exit claim'};
 const prior=canonical({state:'FAIL',results:[old]}),oldRunner=Buffer.from('// unit prior runner\n');
 files.delete('regression-logs/mo1302-projections.tap');files.set('regression-logs/mo1302-projections-attempt-2.tap',oldLog);files.set('regression-logs/mo1302-projections-completion.tap',focusedLog);
 files.set('prior/regressions-0.json',prior);files.set('prior/regressions-1.json',prior);files.set('prior/regressions-runner.bytes.json',encodeRaw(oldRunner));
 edit(files,'regressions.json',value=>{
  value.results=value.results.map(row=>row.id==='mo1302-projections'?aggregate:row);value.counts={tests:10,pass:10,fail:0,skipped:0};
  value.partialCoverage={id:'mo1302-projections',run:old,cases:caseCoverage.slice(0,4),missing:names[4]};
  value.priorAttempts=[0,1].map(index=>identity('.cache/mo1305-phase2a/regressions/attempt-'+index+'.json',prior));value.priorHarness=identity('.cache/mo1305-phase2a/regressions/old-runner.mjs',oldRunner);value.reusePolicy='Unit explicit completed cases only';
 });
 edit(files,'receipt.json',value=>value.counts.regressionTests=10);reseal(files);return model;
}
test('split case coverage preserves failed process and verifies exact five TAP cases',()=>{const model=splitSpecimen();edit(model.files,'regressions.json',value=>delete value.partialCoverage);reseal(model.files);assert.equal(validateBundle(model.files,model.options).state,'PASS');});
test('split coverage duplicate case identity is rejected',()=>{const model=splitSpecimen();edit(model.files,'regressions.json',value=>value.results.find(row=>row.id==='mo1302-projections').caseCoverage[4].name='duplicated');reseal(model.files);assert.throws(()=>validateBundle(model.files,model.options),/SPLIT_CASE_IDENTITY/u);});
test('split coverage cannot invent completed TAP case',()=>{const model=splitSpecimen(),name='regression-logs/mo1302-projections-attempt-2.tap';const bytes=Buffer.from(model.files.get(name).toString().replace('real bundled orchestration','invented bundled orchestration'));model.files.set(name,bytes);edit(model.files,'regressions.json',value=>{const row=value.results.find(row=>row.id==='mo1302-projections'),ref=identity(row.executionRuns[0].log.path,bytes);row.executionRuns[0].log=ref;for(const item of row.caseCoverage.slice(0,4))item.sourceLog=ref;value.partialCoverage.run.log=ref;for(const item of value.partialCoverage.cases)item.sourceLog=ref;});reseal(model.files);assert.throws(()=>validateBundle(model.files,model.options),/SPLIT_LOG_CASE_IDENTITY/u);});
function remoteReuseSpecimen(){
 const model=specimen(),value=JSON.parse(model.files.get('remote.json')),retained=value.records.slice(0,2);
 const prior=canonical({kind:'MemoryOSRESTPhase2ARemoteLifecycleFailure',state:'FAIL',staging:value.staging,completed:retained,code:'HARNESS_ACL',message:'Unit interrupted prior run'});
 model.files.set('prior/remote.json',prior);
 edit(model.files,'remote.json',value=>value.reuse={priorReceipt:identity('.cache/mo1305-phase2a/remote-failure.json',prior),retainedIds:retained.map(x=>x.id),reason:'Completed same-source assertions only'});reseal(model.files);return model;
}
test('remote reuse retains original failed attempt and exact completed rows',()=>{const model=remoteReuseSpecimen();assert.equal(validateBundle(model.files,model.options).state,'PASS');});
test('remote reused row mutation is rejected',()=>{const model=remoteReuseSpecimen();edit(model.files,'remote.json',value=>value.records[0].actual.unrecorded=true);reseal(model.files);assert.throws(()=>validateBundle(model.files,model.options),/deep-equal/u);});
rejectProjection('PASS with empty remote observation is rejected',({files})=>edit(files,'remote.json',value=>value.records.find(row=>row.id==='REMOTE-actual-RFC1918').actual={}),/FALSE_PASS_ACTUAL/u);
rejectProjection('PASS with false bounded deadline observation is rejected',({files})=>edit(files,'lifecycle.json',value=>value.records.find(row=>row.id==='shutdown-deadline-listener-close').actual.elapsedMs=1),/FALSE_PASS_ACTUAL/u);


function lifecycleLineageSpecimen(){
 const model=specimen(),current=JSON.parse(model.files.get('lifecycle.json'));
 const first=canonical({kind:current.kind,version:current.version,state:'FAIL',baseline:current.baseline,staging:current.staging,elapsedMs:1,records:current.records.slice(0,1)});
 const middle={...current,reuse:{priorReceipt:identity('.cache/mo1305-phase2a/earlier-failed-lifecycle.json',first),retainedIds:[current.records[0].id],reason:'One completed same-source case from prior failure'}};
 const middleBytes=canonical(middle);
 model.files.set('prior/lifecycle.json',middleBytes);model.files.set('prior/lifecycle-1.json',first);
 edit(model.files,'lifecycle.json',value=>value.reuse={priorReceipt:identity('.cache/mo1305-phase2a/intermediate-lifecycle.json',middleBytes),retainedIds:current.records.slice(0,2).map(x=>x.id),reason:'Two exact same-source completed cases'});
 reseal(model.files);return model;
}
test('recursive lifecycle reuse preserves the earlier FAIL receipt',()=>{const model=lifecycleLineageSpecimen();assert.equal(validateBundle(model.files,model.options).state,'PASS');assert.equal(JSON.parse(model.files.get('prior/lifecycle-1.json')).state,'FAIL');});
test('missing earlier lifecycle lineage is rejected',()=>{const model=lifecycleLineageSpecimen();model.files.delete('prior/lifecycle-1.json');reseal(model.files);assert.throws(()=>validateBundle(model.files,model.options),/MISSING_PRIOR_LINEAGE/u);});
test('mutated earlier lifecycle receipt cannot be rehashed silently',()=>{const model=lifecycleLineageSpecimen();edit(model.files,'prior/lifecycle-1.json',value=>value.records[0].actual.exitCode=1);reseal(model.files);assert.throws(()=>validateBundle(model.files,model.options));});


function prerequisiteSpecimen(){
 const model=specimen(),files=model.files;
 const locks=['repositories/memoryos-vscode/package-lock.json','repositories/memoryos-mcp/package-lock.json'].map(path=>{const bytes=raw(path);model.source.set(path,bytes);return identity(path,bytes);});
 const closurePath='repositories/memoryos-mcp/distribution/dependency-closure.json',closureBytes=raw(closurePath);model.source.set(closurePath,closureBytes);
 const packages=[['esbuild','0.28.2'],['@esbuild/win32-x64','0.28.2'],['typescript','7.0.2'],['@modelcontextprotocol/core','2.0.0'],['@modelcontextprotocol/server','2.0.0'],['zod','4.6.5']].map(([name,version],index)=>({name,version,installedPath:(index<3?'':'repositories/memoryos-mcp/')+'node_modules/'+name,lockPath:locks[index<3?0:1].path}));
 const copied=packages.map(pkg=>identity(pkg.installedPath+'/unit-fixture.txt',Buffer.from('unit dependency bytes')));
 const originalMetadata=canonical({kind:'UnitHistoricalCopyMetadata'});
 const prerequisites={kind:'MemoryOSRESTPhase2ARegressionPrerequisites',version:'1.0.0',state:'PASS',mode:'exact-offline-copy',sourceFilesModified:false,networkUsed:false,locks,closure:identity(closurePath,closureBytes),sourceMetadata:[0,1].map(index=>identity('.cache/mo1305-phase2a/source-metadata-'+index+'.json',originalMetadata)),packages,files:copied};
 const relocation={kind:'MemoryOSRESTPhase2ARegressionDependencyRelocation',version:'1.0.0',state:'PASS',sourceFilesModified:false,files:copied.map(row=>({originalPath:row.path,retainedPath:'.cache/mo1305-phase2a/prerequisite-dependencies/'+row.path,byteLength:row.byteLength,sha256:row.sha256}))};
 for(const row of relocation.files)model.source.set(row.retainedPath,Buffer.from('unit dependency bytes'));
 const prerequisitesBytes=canonical(prerequisites),relocationBytes=canonical(relocation);
 const correction=identity('.cache/mo1305-phase2a/prerequisites.json',prerequisitesBytes),moved=identity('.cache/mo1305-phase2a/relocation.json',relocationBytes);
 files.set('environment/prerequisites.json',prerequisitesBytes);files.set('environment/relocation.json',relocationBytes);for(const index of [0,1])files.set('environment/source-'+index+'.json',originalMetadata);
 edit(files,'regressions.json',value=>{value.environmentCorrection=correction;value.environmentRelocation=moved;});
 edit(files,'receipt.json',value=>value.prerequisiteByteChecks={state:'PASS',files:copied.length,prerequisitesSha256:correction.sha256,relocationSha256:moved.sha256});
 reseal(files);model.retained=relocation.files.map(row=>row.retainedPath);return model;
}
test('collection verifies actual relocated prerequisite bytes',()=>{const model=prerequisiteSpecimen();assert.equal(validateBundle(model.files,{...model.options,verifyPrerequisiteBytes:true}).state,'PASS');});
test('portable verification needs committed locks but no ignored prerequisite bytes',()=>{const model=prerequisiteSpecimen();for(const path of model.retained)model.source.delete(path);assert.equal(validateBundle(model.files,model.options).state,'PASS');assert.throws(()=>validateBundle(model.files,{...model.options,verifyPrerequisiteBytes:true}),/Unknown unit input/u);});
test('altered relocated prerequisite bytes fail collection',()=>{const model=prerequisiteSpecimen();model.source.set(model.retained[0],Buffer.from('changed'));assert.throws(()=>validateBundle(model.files,{...model.options,verifyPrerequisiteBytes:true}),/RETAINED_DEPENDENCY_CHANGED/u);});



test('runner normalization preserves executed bytes and rejects semantic source changes',()=>{
 const model=specimen(),files=model.files,module=JSON.parse(files.get('regressions.json'));
 const originalSource=model.source.get(module.harness.path);
 const executed=Buffer.from(originalSource.toString().replaceAll('\n','\r\n')+'\r\n');
 const prior={...module,harness:{...module.harness,sha256:sha256(executed)}},priorBytes=canonical(prior);
 files.set('execution/regressions-runner.bytes.json',encodeRaw(executed));files.set('execution/regressions-original-receipt.json',priorBytes);
 edit(files,'regressions.json',value=>{value.executionHarness=identity('.cache/mo1305-phase2a/regressions/executed-runner.mjs',executed);value.harnessOriginalReceipt=identity('.cache/mo1305-phase2a/regressions/original-receipt.json',priorBytes);value.harnessNormalization={kind:'LF_SINGLE_FINAL_NEWLINE',semanticChanges:false};});reseal(files);
 assert.equal(validateBundle(files,model.options).state,'PASS');
 const changed=Buffer.concat([executed,Buffer.from('globalThis.semanticChange=true;\n')]),changedPrior=canonical({...prior,harness:{...prior.harness,sha256:sha256(changed)}});
 files.set('execution/regressions-runner.bytes.json',encodeRaw(changed));files.set('execution/regressions-original-receipt.json',changedPrior);
 edit(files,'regressions.json',value=>{value.executionHarness=identity(value.executionHarness.path,changed);value.harnessOriginalReceipt=identity(value.harnessOriginalReceipt.path,changedPrior);});reseal(files);
 assert.throws(()=>validateBundle(files,model.options),/SOURCE_NORMALIZATION_CHANGED_CODE/u);
});
