// Exactly one non-certifying B/ready/evaluate validation against a fresh offline install.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonical,checkPackage,packageFiles} from '../mo1307-phase1/package.mjs';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const toolRoot=path.dirname(fileURLToPath(import.meta.url));
const evidenceRel='repositories/cca-conformance/evidence/mo1307/phase3ar2-final-b-gate';
const evidence=path.join(root,evidenceRel);
const cache=path.join(root,'.cache/phase3ar2-final-b-gate');
const source=path.join(root,'repositories/memoryos-readiness');
const installed=path.join(cache,'install/node_modules/memoryos-readiness');
const C3VB='17fa84efe46d30e6f4be85fd2427485677a222a3';
const C3V='98b766f9218b209f52251147213839b9775f6da3';
const productionTree='b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const packageIdentity='sha256:0890ca4893ef76118eefbb2b5676ad084c60c70408d9e489f92aa33b74ba45b7';
const aggregateAuthority='PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0';
const helperAuthority='PROSPECTIVE_HELPER_BOUND@2.0.0';
const authorizationPath='C:/Users/melsa/.codex/attachments/989a9b85-66ee-456d-befe-6cd506c77117/Pasted text.txt';
const authorizationSha256='sha256:e314777ee49c774d1876e8afdc32f98ea1dbfd4c72031f9e97761ca461dd6e65';
const helperAuthorityPath=path.join(root,'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/authority.json');
const aggregateAuthorityPath=path.join(root,'repositories/cca-conformance/evidence/mo1307/prospective-helper-aggregate-bound-v2-candidate/authority.json');
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'};
const hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const record=file=>{const bytes=fs.readFileSync(file);return {path:path.relative(root,file).replaceAll('\\','/'),byteLength:bytes.length,sha256:hash(bytes)};};
const walk=(base,prefix='')=>fs.readdirSync(path.join(base,prefix),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(entry=>{const relative=prefix?prefix+'/'+entry.name:entry.name,full=path.join(base,relative),stat=fs.lstatSync(full);assert.equal(stat.isSymbolicLink(),false,full);return stat.isDirectory()?walk(base,relative):[{...record(full),path:relative}];});
const git=(...args)=>{const result=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory=C:/Users/melsa/Documents/Codex/3ar2',...args],{cwd:root,windowsHide:true,encoding:null,timeout:60000,maxBuffer:128*1024*1024});assert.ifError(result.error);assert.equal(result.status,0,result.stderr.toString());return result.stdout;};
const put=(name,bytes)=>{const file=path.join(evidence,name);assert.ok(file.startsWith(evidence+path.sep));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});return record(file);};
const write=(name,value)=>put(name,Buffer.from(JSON.stringify(value,null,2)+'\n'));
const maybeRecord=file=>fs.existsSync(file)?record(file):null;
const errorRecord=error=>({name:error.name,code:error.code??null,message:String(error.message),stack:String(error.stack)});

assert.equal(process.argv.length,2);
assert.equal(path.resolve(root).toLowerCase(),'c:\\users\\melsa\\documents\\codex\\3ar2');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(git('rev-parse','HEAD').toString().trim(),C3VB);
assert.equal(git('branch','--show-current').toString().trim(),'codex/mo1307-phase3ar2-c3ub');
assert.equal(git('show','-s','--format=%P',C3VB).toString().trim(),C3V);
assert.equal(git('rev-parse',C3VB+':repositories/memoryos-readiness').toString().trim(),productionTree);
assert.equal(git('rev-parse',C3V+':repositories/memoryos-readiness').toString().trim(),productionTree);
assert.equal(git('diff','--name-only',C3V,C3VB,'--','repositories/memoryos-readiness').toString(),'');
assert.equal(git('diff','--name-only').toString(),'');assert.equal(git('diff','--cached','--name-only').toString(),'');
const status=git('status','--porcelain=v1','--untracked-files=all').toString().trim().split(/\r?\n/).filter(Boolean);
assert.ok(status.every(line=>line.startsWith('?? repositories/cca-conformance/tools/mo1307-phase3ar2-final/')||line.startsWith('?? repositories/cca-conformance/tools/mo1307-phase3ar2-final-b-gate/')),'Unexpected path before the one-shot B gate');
assert.equal(fs.existsSync(evidence),false,'B-gate evidence already exists; no retry is allowed');
assert.equal(fs.existsSync(cache),false,'B-gate cache already exists; no retry is allowed');
fs.mkdirSync(evidence,{recursive:true});
const startedAt=new Date().toISOString();
let semanticInvocations=0,failure=null,details={};

function command(id,executable,args,cwd=root,extra={}){
  const began=performance.now();
  const result=spawnSync(executable,args,{cwd,env:{...env,...extra},windowsHide:true,shell:false,encoding:null,timeout:120000,maxBuffer:16*1024*1024});
  write('preparation/'+id+'.json',{executable,args,cwd,elapsedMs:performance.now()-began,exit:result.status,error:result.error?.code??null,stdout:put('preparation/'+id+'.stdout.data',result.stdout??Buffer.alloc(0)),stderr:put('preparation/'+id+'.stderr.data',result.stderr??Buffer.alloc(0)),semanticInvocation:false});
  assert.ifError(result.error);assert.equal(result.status,0,result.stderr.toString());return result.stdout;
}

try{
  const authorizationBytes=fs.readFileSync(authorizationPath);assert.equal(hash(authorizationBytes),authorizationSha256);put('authorization.txt',authorizationBytes);
  assert.equal(hash(fs.readFileSync(helperAuthorityPath)),'sha256:6d5e04401c6d8ead77901b0c0ec8ec3fbf17b353e5fa4cf39e17ad3e8d1a7788');
  assert.equal(hash(fs.readFileSync(aggregateAuthorityPath)),'sha256:adba80ce3ca2b2d21c2374bd3f98267daa9aa4891e7e27d135664251c71bab73');
  const sourceMembers=walk(source);assert.equal(sourceMembers.length,89);assert.deepEqual(sourceMembers.map(row=>row.path),[...packageFiles]);
  for(const row of sourceMembers)assert.equal(row.sha256,hash(git('show',C3VB+':repositories/memoryos-readiness/'+row.path)),row.path);
  const sourceCheck=checkPackage(source);assert.equal(hash(Buffer.from(canonical(sourceMembers)+'\n')),packageIdentity);
  const definitions=JSON.parse(fs.readFileSync(path.join(source,'contracts/definitions.json'),'utf8'));
  assert.equal(definitions.limits.helperDeadlineMs,9000);assert.equal(definitions.limits.helperAggregateDeadlineMs,28000);assert.equal(definitions.limits.cliDeadlineMs,30000);assert.equal(definitions.limits.apiDeadlineMs,10000);assert.equal(definitions.limits.cleanupAllowanceMs,2000);
  const tools=walk(toolRoot).map(row=>record(path.join(toolRoot,row.path)));
  assert.deepEqual(tools.map(row=>path.basename(row.path)).sort(),['errors-observer.mjs','gate.mjs','observe-command.py','observer-entry.mjs','runtime-controls-observer.py','runtime-observer.mjs','transport-observer.mjs']);
  fs.mkdirSync(cache);for(const leaf of ['npm-cache','install','cwd'])fs.mkdirSync(path.join(cache,leaf));
  for(const leaf of ['user.npmrc','global.npmrc'])fs.writeFileSync(path.join(cache,leaf),'',{flag:'wx'});
  const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  assert.equal(command('npm-version',process.execPath,[npm,'--version']).toString().trim(),'11.19.0');
  const npmArgs=['--offline','--ignore-scripts','--no-audit','--no-fund','--cache',path.join(cache,'npm-cache'),'--userconfig',path.join(cache,'user.npmrc'),'--globalconfig',path.join(cache,'global.npmrc')];
  const extra={PATH:path.dirname(process.execPath),TEMP:cache,TMP:cache};
  const packed=JSON.parse(command('package-pack',process.execPath,[npm,'pack','--json','--pack-destination',cache,...npmArgs],source,extra));
  assert.equal(packed.length,1);assert.deepEqual(packed[0].files.map(row=>row.path).sort(),[...packageFiles]);
  const archive=path.join(cache,packed[0].filename),archiveBinding=put('package/memoryos-readiness-0.1.0.tgz',fs.readFileSync(archive));
  fs.writeFileSync(path.join(cache,'install/package.json'),JSON.stringify({name:'mo1307-phase3ar2-final-b-gate-offline',version:'1.0.0',private:true})+'\n',{flag:'wx'});
  command('offline-install',process.execPath,[npm,'install',archive,...npmArgs],path.join(cache,'install'),extra);
  const installedMembers=walk(installed);assert.equal(installedMembers.length,89);assert.deepEqual(installedMembers,sourceMembers);const installedCheck=checkPackage(installed);
  assert.equal(hash(Buffer.from(canonical(installedMembers)+'\n')),packageIdentity);
  write('installed-verification.json',{result:'PASS',members:installedMembers.length,packageIdentity,sourceMembers,installedMembers,sourceCheck,installedCheck,archive:archiveBinding,offline:true,noScripts:true,networkFallback:false});

  const fixture=path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles/ready');
  const inputRoot=path.join(cache,'input'),parent=path.join(cache,'output-parent'),destination=path.join(parent,'ready-output');
  fs.cpSync(fixture,inputRoot,{recursive:true});fs.mkdirSync(parent);
  const expectedBytes=fs.readFileSync(path.join(fixture,'expected-result.json')),expected=JSON.parse(expectedBytes),pins=JSON.parse(fs.readFileSync(path.join(fixture,'pins.json'),'utf8'));
  assert.equal(expected.assessment.readiness,'READY');assert.equal(fs.existsSync(destination),false);
  const bin=path.join(installed,'bin/memoryos-readiness.mjs'),trace=path.join(evidence,'observation.json'),observerReady=trace+'.observer-ready.json',topologyRoot=path.join(evidence,'topology');
  const productArgs=['evaluate','--input-root',inputRoot,'--config','configuration.json','--authority','authority.json','--authority-sha256',pins.trustedAuthorityDigest,'--candidate-sha256',pins.expectedCandidateDigest,'--output-root',destination];
  const observedCommand=[path.join(toolRoot,'observer-entry.mjs'),trace,bin,'--observer-ready',observerReady,...productArgs];
  const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  assert.equal(hash(fs.readFileSync(python)),'sha256:4278cf2a296f31737cae77cafeeb3dc71683094cf3b8fd6f3f02c968687e771c');
  const observerArgs=['-I','-S','-B',path.join(toolRoot,'observe-command.py'),'--output',topologyRoot,'--ready',observerReady,'--cwd',path.join(cache,'cwd'),'--expected-exit','0','--expected-helpers','9','--',process.execPath,...observedCommand];
  write('invocation.json',{scope:'NON_CERTIFYING_PRE_CERTIFICATION_B_GATE',candidate:C3VB,vector:'B/ready/evaluate',executable:python,executableSha256:hash(fs.readFileSync(python)),args:observerArgs,installedBin:bin,productArgs,cwd:root,productCwd:path.join(cache,'cwd'),environment:env,expectedExit:0,semanticInvocationsAuthorized:1,noRetry:true,tools,authorities:{helper:record(helperAuthorityPath),aggregate:record(aggregateAuthorityPath)}});
  const began=performance.now();const wrapper=spawnSync(python,observerArgs,{cwd:root,env,windowsHide:true,shell:false,encoding:null,timeout:90000,maxBuffer:4*1024*1024});const wrapperElapsedMs=performance.now()-began;
  put('wrapper.stdout.data',wrapper.stdout??Buffer.alloc(0));put('wrapper.stderr.data',wrapper.stderr??Buffer.alloc(0));
  const topology=JSON.parse(fs.readFileSync(path.join(topologyRoot,'receipt.json'),'utf8'));semanticInvocations=topology.semanticInvocations;
  assert.equal(semanticInvocations,1);assert.ifError(wrapper.error);assert.equal(wrapper.signal,null);assert.equal(wrapper.status,0,(wrapper.stderr??Buffer.alloc(0)).toString());
  const observation=JSON.parse(fs.readFileSync(trace,'utf8'));
  const driverLaunch=JSON.parse(fs.readFileSync(path.join(topologyRoot,'driver-launch.json'),'utf8'));
  const driverStdout=fs.readFileSync(path.join(topologyRoot,'driver.stdout.data')),driverStderr=fs.readFileSync(path.join(topologyRoot,'driver.stderr.data'));
  const productCwd=path.join(cache,'cwd');
  assert.equal(driverStderr.length,0);assert.equal(topology.result,'PASS');assert.equal(topology.driverExit,0);assert.equal(topology.engineeringGuards.length,0);assert.equal(driverLaunch.semanticInvocations,1);assert.equal(driverLaunch.pid,topology.driverPid);assert.deepEqual(driverLaunch.command,[process.execPath,...observedCommand]);assert.equal(driverLaunch.cwd,productCwd);assert.equal(topology.driverCwd,productCwd);
  assert.equal(observation.kind,'MO1307FinalPreCertificationBGateInstalledBinObservation');assert.equal(observation.certification,false);assert.equal(observation.bootstrapError,null);assert.equal(observation.actualInstalledBinExecuted,true);assert.equal(observation.productExit,0);assert.equal(observation.supervisors.length,1);assert.equal(topology.driverPid,observation.pid);assert.equal(observation.bin,bin);assert.deepEqual(observation.bootstrapArgv,[process.execPath,...observedCommand]);assert.deepEqual(observation.effectiveProductArgv,[process.execPath,bin,...productArgs]);assert.deepEqual(observation.execArgv,[]);
  const supervisor=observation.supervisors[0].snapshot;
  assert.equal(supervisor.helpers,9);assert.equal(supervisor.workers,1);assert.equal(supervisor.activeRole,null);assert.equal(supervisor.cleanupConfirmed,true);assert.equal(supervisor.terminalCode,null);
  assert.ok(supervisor.helperUsedMs<28000,String(supervisor.helperUsedMs));assert.ok(observation.productLifecycleElapsedMs<30000,String(observation.productLifecycleElapsedMs));
  assert.equal(observation.limits.helperDeadlineMs,9000);assert.equal(observation.limits.helperAggregateDeadlineMs,28000);assert.equal(observation.limits.cliDeadlineMs,30000);assert.equal(observation.limits.apiDeadlineMs,10000);assert.equal(observation.limits.cleanupAllowanceMs,2000);
  const operations=['READ_SET','READ_SET','READ_SET','CHECK_OUTPUT','CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION'];
  assert.equal(observation.requests.length,9);assert.deepEqual(observation.requests.map(row=>row.sequence),[1,2,3,4,5,6,7,8,9]);assert.deepEqual(observation.requests.map(row=>row.operation),operations);
  const responseStatuses=['OK','OK','OK','ABSENT','ABSENT','OK','OK','OK','FINAL_ABSENT'];
  for(const [index,request] of observation.requests.entries()){assert.equal(request.disposition,'RESOLVED');assert.equal(request.error,null);assert.equal(request.exitConfirmed,true);assert.equal(request.exitCode,0);assert.equal(request.exitSignal,null);assert.ok(request.durationMs<9000,String(request.durationMs));assert.ok(request.chargedThisExchangeMs<9000,String(request.chargedThisExchangeMs));assert.equal(request.transportClosed,true);assert.equal(request.responseComplete,true);assert.equal(request.responseAcceptedByTransport,true);assert.equal(request.responseStatus,responseStatuses[index]);assert.equal(request.responseCode,null);assert.equal(request.responseBindingMatches,true);}
  assert.equal(supervisor.publication.phase,'COMMITTED');assert.equal(supervisor.publication.admitted,true);assert.equal(supervisor.publication.namespaceVerified,true);assert.equal(supervisor.publication.deadlineExpiredAfterAdmission,false);assert.equal(supervisor.publication.cancelledAfterAdmission,false);
  const serialized=supervisor.events.filter(row=>row.type==='start'||row.type==='quiescent').map(row=>row.type+':'+row.role),expectedSerialized=[];for(let index=0;index<4;index++)expectedSerialized.push('start:helper','quiescent:helper');expectedSerialized.push('start:worker','quiescent:worker');for(let index=0;index<5;index++)expectedSerialized.push('start:helper','quiescent:helper');assert.deepEqual(serialized,expectedSerialized);
  assert.equal(topology.expectedHelpers,9);assert.equal(topology.helperPairs.length,9);assert.equal(topology.allKnownObjectsSignaled,true);assert.equal(topology.unexplainedDescendants.length,0);assert.equal(topology.helperOverlap.length,0);assert.equal(topology.identityOrSnapshotFailures,0);assert.equal(topology.observationErrors.length,0);assert.ok(topology.maximumProductRoles<=3);assert.ok(topology.maximumHelpers<=1);assert.ok(topology.maximumHelperConsoles<=1);assert.ok(topology.peakSampledProductWorkingSetBytes<=536870912);assert.equal(topology.missingProductMemorySamples,0);
  for(const pair of topology.helperPairs){assert.ok(pair.helper.signaledAt);assert.ok(pair.consoles.length<=1);assert.ok(pair.consoles.every(item=>item.signaledAt));}
  const requestPids=observation.requests.map(row=>row.pid).sort((a,b)=>a-b),helperPids=topology.helperPairs.map(pair=>pair.helper.identity.pid).sort((a,b)=>a-b);assert.deepEqual(requestPids,helperPids);
  const expectedHooks=[{parent:pathToFileURL(path.join(installed,'src/cli.mjs')).href,specifier:'./runtime.mjs',adapter:'runtime-observer.mjs'},{parent:pathToFileURL(path.join(installed,'src/cli.mjs')).href,specifier:'./helper-transport.mjs',adapter:'transport-observer.mjs'},{parent:pathToFileURL(bin).href,specifier:'../src/errors.mjs',adapter:'errors-observer.mjs'}].sort((a,b)=>a.adapter.localeCompare(b.adapter));
  assert.deepEqual(observation.hookMatches.toSorted((a,b)=>a.adapter.localeCompare(b.adapter)),expectedHooks);assert.equal(observation.events.filter(row=>row.type==='unexpected-child').length,0);assert.equal(observation.events.filter(row=>row.type==='process-exit').length,9);assert.equal(observation.events.filter(row=>row.type==='process-close').length,9);assert.equal(observation.errors.length,0);
  const summary=JSON.parse(driverStdout.toString('utf8'));assert.equal(summary.operation,'evaluate');assert.equal(summary.readiness,'READY');assert.equal(summary.readinessDigest,expected.readinessDigest);assert.equal(summary.proofBindingDigest,expected.proofBindingDigest);assert.equal(summary.decision,null);
  const resultFile=path.join(destination,'memoryos-readiness-result.json');assert.deepEqual(fs.readFileSync(resultFile),expectedBytes);assert.deepEqual(fs.readdirSync(destination),['memoryos-readiness-result.json']);
  assert.deepEqual(walk(installed),installedMembers);
  details={package:{identity:packageIdentity,members:89,archive:archiveBinding},result:record(resultFile),observation:record(trace),topology:record(path.join(topologyRoot,'receipt.json')),helperUsedMs:supervisor.helperUsedMs,productLifecycleElapsedMs:observation.productLifecycleElapsedMs,wrapperElapsedMs,maxima:{requestDurationMs:Math.max(...observation.requests.map(row=>row.durationMs)),requestChargedMs:Math.max(...observation.requests.map(row=>row.chargedThisExchangeMs)),productRoles:topology.maximumProductRoles,helpers:topology.maximumHelpers,helperConsoles:topology.maximumHelperConsoles,productWorkingSetBytes:topology.peakSampledProductWorkingSetBytes},publication:supervisor.publication,cleanupConfirmed:supervisor.cleanupConfirmed};
}catch(error){
  for(const relative of ['topology/receipt.json','topology/driver-launch.json']){const witness=path.join(evidence,relative);if(fs.existsSync(witness)){if(relative.endsWith('driver-launch.json'))semanticInvocations=Math.max(semanticInvocations,1);try{semanticInvocations=Math.max(semanticInvocations,JSON.parse(fs.readFileSync(witness,'utf8')).semanticInvocations??0);}catch{}}}
  failure=errorRecord(error);process.exitCode=1;
}
finally{
  const passed=failure===null&&semanticInvocations===1;
  const topologyRoot=path.join(evidence,'topology');
  const receipt={kind:'MO1307Phase3AR2FinalPreCertificationBGateReceipt',version:'1.0.0',result:passed?'PASS':'FAIL',outcome:passed?'PRE_CERTIFICATION_B_GATE_PASS':'PHASE3AR2_CONCRETE_BLOCKER',createdAt:new Date().toISOString(),startedAt,candidate:C3VB,productionCommit:C3V,productionTree,authorities:[helperAuthority,aggregateAuthority],scope:'B/ready/evaluate only; validation, not certification',certification:false,semanticInvocations,noRetry:true,replacementExecutions:0,diagnosticsRun:0,limits:{helperWholeLifecycleMs:9000,helperSuccess:'elapsedMs < 9000',helperTimeout:'elapsedMs >= 9000',aggregateHelperActiveMs:28000,aggregateSuccess:'helperActiveMs < 28000',aggregateTimeout:'helperActiveMs >= 28000',cliMs:30000,apiWorkerMs:10000,cleanupMs:2000},requirements:{expectedReadiness:'READY',noHelperTimeout:true,allHelpersAccepted:true,scheduledTopologyRssWitness:'PASS',cleanupSettlement:'PASS'},failure,details,bindings:{authorization:maybeRecord(path.join(evidence,'authorization.txt')),helperAuthority:maybeRecord(helperAuthorityPath),aggregateAuthority:maybeRecord(aggregateAuthorityPath),installed:maybeRecord(path.join(evidence,'installed-verification.json')),invocation:maybeRecord(path.join(evidence,'invocation.json')),wrapperStdout:maybeRecord(path.join(evidence,'wrapper.stdout.data')),wrapperStderr:maybeRecord(path.join(evidence,'wrapper.stderr.data')),observation:maybeRecord(path.join(evidence,'observation.json')),observerReady:maybeRecord(path.join(evidence,'observation.json.observer-ready.json')),clockBridgeRequest:maybeRecord(path.join(evidence,'observation.json.observer-ready.json.clock-bridge.json')),clockBridgeAccepted:maybeRecord(path.join(evidence,'observation.json.observer-ready.json.clock-bridge-accepted.json')),topology:maybeRecord(path.join(evidence,'topology/receipt.json')),topologyArtifacts:fs.existsSync(topologyRoot)?walk(topologyRoot).map(row=>record(path.join(topologyRoot,row.path))):[]},fullCertificationStarted:false,push:false,tag:false};
  write('gate-receipt.json',receipt);
  process.stdout.write(JSON.stringify({result:receipt.result,outcome:receipt.outcome,semanticInvocations,helperUsedMs:details.helperUsedMs??null,productLifecycleElapsedMs:details.productLifecycleElapsedMs??null,failure})+'\n');
}
