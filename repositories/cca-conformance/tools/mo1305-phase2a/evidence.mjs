/** Bounded Phase 2A integration evidence; never a release, B2, or I2 binding. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {root,cache,J,sha256,node,nodeSha256,pwsh} from './setup.mjs';
export const BASELINE={commit:'b6c397b99e1f8bfcd04be972f35069f8737a4137',subject:'conformance(memoryos-1.3): bind MO-1305 phase 1 foundation',tree:'29fd03ed0357f7336db86a4bd02526ae96bfedaa'};
export const LIMITS_SHA='4ad1011f2e0861d28020427f1788026c92c6ff0672c707dab7116da1f568e1fa';
export const output=resolve(root,'repositories/cca-conformance/evidence/mo1305-phase2a');
const productRoot='repositories/memoryos-rest/';
const toolRoot='repositories/cca-conformance/tools/';
const fixtureRoot='repositories/cca-conformance/fixtures/mo1305-phase1/';
const sourceManifest=productRoot+'distribution-manifest.json';
const LIMITS=productRoot+'contracts/limits.json';
const groups=['lifecycle','remote','signals','regressions'];
const changedFiles=['bin/memoryos-rest.mjs','src/config.mjs','src/server.mjs'];
const harnessNames=['evidence.mjs','evidence.test.mjs','harness.mjs','lifecycle.mjs','regressions.mjs','remote.mjs','remote-complete.mjs','setup.mjs','signals.py','supervisor.mjs'];
const sharedNames=['clock.mjs','failure-schema-2.0.0.json','fault-worker.mjs','validate-launch.ps1','regressions.py'];
const commonCases=['startup-ready-idle-shutdown','product-control-eof','product-control-invalid','product-nonpipe-invalid-control','product-early-control-eof','product-early-control-invalid','startup-already-aborted','startup-listener-conflict','readiness-worker-busy-cancel',
 ...['handshake','header','body','semantic'].map(x=>'shutdown-during-'+x),
 ...['reaping','ready'].map(x=>'shutdown-semantic-'+x),'shutdown-published-semantic','unexpected-worker-exit','stale-worker-result','generation-exhaustion','runtime-integrity-poison','listener-runtime-error','published-drain-normal','published-drain-fatal-upgrade','worker-termination-deadline','shutdown-deadline-listener-close',
 'local-connection-limit','local-connection-one-request','remote-connection-limit','remote-connection-one-request','semantic-fixed-parity-subset'];
const remoteCases=[
 ...['10.0.0.1','10.255.255.254','172.16.0.1','172.31.255.254','192.168.0.1','192.168.255.254'].map(x=>'BIND-valid-'+x),
 ...['unknown-mode','missing-mode','local-remote-address','network','broadcast','slash31','slash32','internal','no-cidr','unassigned'].map(x=>'BIND-'+x),
 'CONFIG-frozen-local-defaults',
 ...['remote-no-bind','remote-without-opt-in','unknown-mode','wildcard-v4','wildcard-v6','remote-v6','public-v4','loopback-remote','unassigned-v4','noncanonical-v4','dns','missing-token','missing-certificate','missing-key','invalid-token'].map(x=>'STARTUP-'+x),
 ...['invalid-certificate','invalid-key','mismatched-key','missing-IP-SAN','mismatched-IP-SAN','expired-certificate'].map(x=>'TLS-'+x),
 'LOCAL-startup-readiness','LOCAL-idle-shutdown',
 ...['missing-token','invalid-token','missing-key','invalid-certificate','wrong-SAN'].map(x=>'REMOTE-STARTUP-'+x),
 'REMOTE-actual-RFC1918','REMOTE-no-loopback-fallback','REMOTE-getReadiness','REMOTE-getContractIdentities',
 ...['getContractIdentities','preparePolicy','preparePolicySet','evaluatePolicy','verifyEvaluationIdentity','verifyPolicyOutcome','getHealth','getReadiness','getVersion'].map(x=>'REMOTE-auth-required-'+x),
 'REMOTE-wrong-bearer','REMOTE-TLS12-refused','REMOTE-plaintext-refused','REMOTE-token-held-until-restart','REMOTE-listener-shutdown','REMOTE-token-rotation-after-restart','REMOTE-repeat-rebind'];
export const EXPECTED_IDS={lifecycle:commonCases,remote:remoteCases,signals:['LIFECYCLE-Windows-CTRL-C-SIGINT'],regressions:['mo1301-sdk','core-mip','mo1302-projections','mo1303-io-inspection','mo1304-semantic-integrity','cli-secondary']};
export const EXPECTED_VECTORS=['identities','max-prepare-policy','max-prepare-policySet','golden-identity-vector-completed-aggregate-cne','golden-outcome-vector-completed-aggregate-cne','evaluate-policy-pass','evaluate-policySet-pass','evaluate-policy-fail','evaluate-policySet-fail','evaluate-policy-cne','evaluate-policySet-cne'];
export const SPLIT_CASES=[
 'CLI transport accepts only one exact stdout envelope and propagates MO-1301 projections',
 'real bundled orchestration verifies PASS, FAIL, CNE, Policy Set, and trusted Regression',
 'valid MO-1301 evaluation failures propagate unchanged and publish no generation',
 'artifact verifier rejections remain MO-1301 failures and reconstruction contradictions are Action failures',
 'all six wrong decision/exit pairings are rejected after full verification'];
const runFields=['id','state','command','exitCode','signal','error','outputExceeded','timedOut','elapsedMs','counts','log'];
function validateRun(item,{failed=false}={}){
 closed(item,runFields);assert.equal(item.state,failed?'FAIL':'PASS');assert.equal(item.exitCode,failed?null:0);assert.equal(item.signal,failed?'SIGTERM':null);assert.equal(item.error,null);assert.equal(item.outputExceeded,false);assert.equal(item.timedOut,failed);
 number(item.elapsedMs);if(failed)assert.deepEqual(item.counts,{});else recordCounts(item.counts);row(item.log);assert.ok(item.log.byteLength<=2097152);assert.ok(Array.isArray(item.command)&&item.command.length>1);
}
function logName(log){path(log.path);return 'regression-logs/'+log.path.split('/').at(-1);}
function regressionLogs(module){const found=new Map();for(const item of module.results){for(const log of [item.log,...(item.executionRuns??[]).map(x=>x.log)]){const name=logName(log);if(found.has(name))assert.deepEqual(found.get(name),log);found.set(name,log);}}return [...found].sort(([a],[b])=>a<b?-1:1);}
const kinds={lifecycle:'MemoryOSRESTPhase2ALifecycleResults',remote:'MemoryOSRESTPhase2ARemoteLifecycleResults',signals:'MemoryOSRESTPhase2AWindowsSignalResults',regressions:'MemoryOSRESTPhase2APredecessorRegressions'};
function closed(value,required,optional=[]){assert.ok(value&&typeof value==='object'&&!Array.isArray(value),'OBJECT_REQUIRED');const keys=Object.keys(value);assert.ok(required.every(k=>keys.includes(k)),'MISSING_FIELD');assert.ok(keys.every(k=>required.includes(k)||optional.includes(k)),'UNKNOWN_FIELD');}
function hash(value){assert.match(value,/^[0-9a-f]{64}$/u);}
function number(value){assert.ok(Number.isSafeInteger(value)&&value>=0,'NONNEGATIVE_INTEGER_REQUIRED');}
function path(value){assert.ok(typeof value==='string'&&value.length<300&&/^[A-Za-z0-9_@.\/-]+$/u.test(value)&&!value.startsWith('/')&&value.split('/').every(x=>x&&x!=='.'&&x!=='..'),'RELATIVE_PATH_REQUIRED');}
function row(value){closed(value,['path','byteLength','sha256']);path(value.path);number(value.byteLength);hash(value.sha256);}
function sortedRows(rows){assert.ok(Array.isArray(rows)&&rows.length<=512);let previous='';for(const item of rows){row(item);assert.ok(item.path>previous,'DUPLICATE_OR_UNSORTED_PATH');previous=item.path;}}
export function identity(path,bytes){return {path,byteLength:bytes.length,sha256:sha256(bytes)};}
export function encodeRaw(bytes){return Buffer.from(J({kind:'MemoryOSRESTPhase2ARawBytes',encoding:'base64',byteLength:bytes.length,sha256:sha256(bytes),base64:bytes.toString('base64')}));}
function decodeRaw(bytes){const value=parseCanonical(bytes);closed(value,['kind','encoding','byteLength','sha256','base64']);assert.equal(value.kind,'MemoryOSRESTPhase2ARawBytes');assert.equal(value.encoding,'base64');number(value.byteLength);hash(value.sha256);const raw=Buffer.from(value.base64,'base64');assert.equal(raw.toString('base64'),value.base64);assert.equal(raw.length,value.byteLength);assert.equal(sha256(raw),value.sha256);return raw;}
function normalizeSource(bytes){return Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n').replace(/\n*$/u,'\n'));}
export function parseCanonical(bytes){assert.ok(bytes.length<=2097152,'EVIDENCE_TOO_LARGE');const value=JSON.parse(bytes);assert.equal(bytes.toString('utf8'),J(value),'NONCANONICAL_BYTES');return value;}
function loadInput(path){return readFileSync(resolve(root,path));}
function inputRows(paths){return [...new Set(paths)].sort().map(p=>identity(p,loadInput(p)));}
function streamedHash(file){const fd=openSync(file,'r'),buffer=Buffer.alloc(65536),digest=createHash('sha256');try{let size;while((size=readSync(fd,buffer,0,buffer.length,null))>0)digest.update(buffer.subarray(0,size));return digest.digest('hex');}finally{closeSync(fd);}}
function schemaManifest(value){closed(value,['files','kind','package','packageVersion','version']);assert.equal(value.kind,'MemoryOSRESTDistributionManifest');assert.equal(value.package,'memoryos-rest');assert.equal(value.packageVersion,'0.1.0');assert.equal(value.version,'1.0.0');sortedRows(value.files);}
function assertIds(name,records){assert.ok(Array.isArray(records),'MISSING_RESULTS');assert.deepEqual(records.map(x=>x.id).sort(),[...EXPECTED_IDS[name]].sort(),'MISSING_DUPLICATE_OR_UNKNOWN_RESULT_ID');for(const item of records){assert.equal(item.state,'PASS','NON_PASS_RESULT');if(item.actual)assert.ok(!Object.hasOwn(item.actual,'failure'),'FALSE_PASS_FAILURE');}}
function recordCounts(value){closed(value,['tests','pass','fail','skipped']);for(const n of Object.values(value))number(n);assert.ok(value.tests>0);assert.equal(value.tests,value.pass);assert.equal(value.fail,0);assert.equal(value.skipped,0);}
function validateActual(name,records){
 for(const item of records){
  const a=item.actual,id=item.id;if(name==='signals'||name==='regressions')continue;
  assert.ok(a&&typeof a==='object'&&!Array.isArray(a),'MISSING_ACTUAL_ASSERTIONS');
  const require=(condition)=>assert.ok(condition,'FALSE_PASS_ACTUAL '+id);
  if(name==='remote'){
   if(id.startsWith('BIND-valid-'))require(a.mode==='remote'&&a.syntheticInterface===true);
   else if(id.startsWith('BIND-'))require(a.rejected===true&&a.syntheticInterface===true);
   else if(id==='CONFIG-frozen-local-defaults')require(a.mode==='local'&&a.bindAddress==='127.0.0.1'&&a.port===13050);
   else if(id.startsWith('STARTUP-')||id.startsWith('TLS-')||id.startsWith('REMOTE-STARTUP-'))require(a.exitCode===2&&a.listenerObserved===false&&a.probes>0&&a.secretSafeDiagnostic===true);
   else if(id==='LOCAL-startup-readiness')require(a.status===200&&a.serverPid>0&&a.clientPid>0&&a.serverPid!==a.clientPid);
   else if(id==='LOCAL-idle-shutdown'||id==='REMOTE-listener-shutdown')require(a.exitCode===0);
   else if(id==='REMOTE-actual-RFC1918')require(a.serverPid>0&&a.clientPid>0&&a.serverPid!==a.clientPid&&a.localAddress===a.bindAddress&&a.remoteAddress===a.bindAddress&&a.tlsVersion==='TLSv1.3'&&a.alpn==='http/1.1'&&a.authorized===true&&/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/u.test(a.bindAddress));
   else if(id==='REMOTE-no-loopback-fallback')require(a.loopbackListener===false);
   else if(id==='REMOTE-getReadiness'||id==='REMOTE-getContractIdentities')require(a.status===200);
   else if(id.startsWith('REMOTE-auth-required-')||id==='REMOTE-wrong-bearer')require(a.status===401);
   else if(id==='REMOTE-TLS12-refused')require(a.httpBytes===0);
   else if(id==='REMOTE-plaintext-refused')require(a.httpResponse===false);
   else if(id==='REMOTE-token-held-until-restart')require(a.oldTokenStatus===200&&a.newTokenStatus===401);
   else if(id==='REMOTE-token-rotation-after-restart')require(a.oldTokenStatus===401&&a.newTokenStatus===200);
   else if(id==='REMOTE-repeat-rebind')require(a.status===200&&a.exitCode===0);
  } else {
   require(Array.isArray(a.sessions)&&a.sessions.length<=4);
   for(const session of a.sessions){
    closed(session,['pid','exitCode','states','sampledStateCount','peakCounts','finalCounts','workerCreated','workerReaped','peakSampledBytes','sampledBudgetChecks','gracefulCleanupChecked']);
    number(session.pid);number(session.sampledStateCount);number(session.workerCreated);number(session.workerReaped);require(session.workerReaped<=session.workerCreated&&session.sampledBudgetChecks===true);
    require(Array.isArray(session.states)&&session.states.every(x=>['INITIALIZING','READY','DRAINING','STOPPED','FAILED'].includes(x)));
    closed(session.peakCounts,['connections','requestSlots','writeSlots','workers','semanticOwners']);
    for(const [field,limit] of [['connections',32],['requestSlots',4],['writeSlots',4],['workers',1],['semanticOwners',1]]){number(session.peakCounts[field]);require(session.peakCounts[field]<=limit);}
    closed(session.peakSampledBytes,['heapTotal','external','rss']);
    for(const [field,limit] of [['heapTotal',124],['external',34],['rss',393]]){number(session.peakSampledBytes[field]);require(session.peakSampledBytes[field]<=limit*1048576);}
    if(session.finalCounts!==null){closed(session.finalCounts,['connections','requestSlots','writeSlots','workers','semanticOwners']);if(session.gracefulCleanupChecked)require(Object.values(session.finalCounts).every(x=>x===0));}
   }
   if(id==='startup-ready-idle-shutdown')require(a.exitCode===0&&J(a.states)===J(['INITIALIZING','READY','DRAINING','STOPPED']));
   else if(id.startsWith('product-control-'))require(a.exitCode===(id.endsWith('invalid')?1:0));
   else if(id==='product-nonpipe-invalid-control')require(a.exitCode===1&&a.input==='regularFile'&&a.listenerClosed===true);
   else if(id.startsWith('product-early-control-'))require(a.exitCode===(id.endsWith('invalid')?1:0)&&a.listenerClosed===true&&typeof a.startupObserved==='boolean');
   else if(id==='startup-already-aborted')require(a.listenerStarted===false&&J(a.states)===J(['INITIALIZING','DRAINING','STOPPED']));
   else if(id==='startup-listener-conflict')require(a.exitCode===2&&a.rebound===true);
   else if(id==='readiness-worker-busy-cancel')require(a.created===1&&a.reaped===1&&a.queued===0);
   else if(id.startsWith('shutdown-during-'))require(a.publicationSuppressed===true&&a.cleanup===true&&a.rebound===true);
   else if(id==='shutdown-semantic-reaping'||id==='shutdown-semantic-ready')require(a.phase===id.slice('shutdown-semantic-'.length)&&a.published===false&&a.reaped===1);
   else if(id==='shutdown-published-semantic')require(a.status===200&&a.oneResponse===true);
   else if(id==='unexpected-worker-exit')require(a.error==='MO1305_INTERNAL_FAILURE'&&a.ready===true);
   else if(id==='stale-worker-result')require(a.stalePublication===false);
   else if(id==='generation-exhaustion')require(a.error==='MO1305_UNAVAILABLE'&&a.workers===0);
   else if(id==='runtime-integrity-poison')require(a.error==='MO1305_RUNTIME_INTEGRITY'&&a.semanticPublication===false&&a.exitCode===1);
   else if(id==='listener-runtime-error')require(a.exitCode===1&&a.state==='FAILED');
   else if(id.startsWith('published-drain-'))require(a.exitCode===(id.endsWith('fatal-upgrade')?1:0)&&a.elapsedMs>=9000&&a.elapsedMs<13000&&a.newConnection===false&&a.newRequest===false&&a.workers===0);
   else if(id==='worker-termination-deadline')require(a.exitCode===1&&a.forced===true&&a.elapsedMs>=1900&&a.elapsedMs<4000);
   else if(id==='shutdown-deadline-listener-close')require(a.exitCode===1&&a.forced===true&&a.elapsedMs>=14900&&a.elapsedMs<17000&&a.rebound===true);
   else if(id.endsWith('-connection-limit'))require(a.maximum===32&&a.rejected===33&&a.cleanup===0);
   else if(id.endsWith('-connection-one-request'))require(a.keepAlive===false&&a.pipelinedDispatch===false&&a.oneResponse===true);
   else if(id==='semantic-fixed-parity-subset')require(a.equalities===11&&J(a.vectors)===J(EXPECTED_VECTORS));
  }
 }
}
export function validateResult(name,value){
 assert.ok(groups.includes(name));assert.equal(value.kind,kinds[name]);assert.equal(value.version,'1.0.0');assert.equal(value.state,'PASS','NON_PASS_MODULE');
 const standard=['kind','version','state'];
 if(name==='lifecycle'){
  closed(value,[...standard,'baseline','staging','elapsedMs','records'],['reuse']);assert.equal(value.baseline,BASELINE.commit);number(value.elapsedMs);
  closed(value.staging,['address','distributionManifestSha256','interfaces','kind','nodeSha256','port','releasePackageEvidence','source','stagedFileCount']);
  assert.equal(value.staging.kind,'MemoryOSRESTPhase2AFocusedStaging');assert.equal(value.staging.releasePackageEvidence,false);assert.equal(value.staging.source,'repositories/memoryos-rest');assert.equal(value.staging.nodeSha256,nodeSha256);hash(value.staging.distributionManifestSha256);
  for(const item of value.records){closed(item,['id','state','expected','actual','elapsedMs']);number(item.elapsedMs);assert.ok(typeof item.expected==='string'&&item.expected.length>0);assert.ok(item.actual&&typeof item.actual==='object'&&!Array.isArray(item.actual));}
  if(value.reuse){closed(value.reuse,['priorReceipt','retainedIds','reason']);row(value.reuse.priorReceipt);assert.ok(Array.isArray(value.reuse.retainedIds)&&new Set(value.reuse.retainedIds).size===value.reuse.retainedIds.length);assert.ok(value.reuse.retainedIds.every(x=>EXPECTED_IDS.lifecycle.includes(x)));assert.ok(typeof value.reuse.reason==='string'&&value.reuse.reason.length>0);}
 } else if(name==='remote'){
  closed(value,[...standard,'staging','elapsedMs','cases','passed','notExecuted','remoteAddress','networkConfigurationChanged','records'],['reuse']);number(value.elapsedMs);
  closed(value.staging,['distributionManifestSha256','fileCount','nodeVersion','platform','architecture']);hash(value.staging.distributionManifestSha256);assert.equal(value.staging.nodeVersion,'v24.21.0');assert.equal(value.staging.platform,'win32');assert.equal(value.staging.architecture,'x64');
  assert.equal(value.networkConfigurationChanged,false);assert.match(value.remoteAddress,/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/u);
  assert.equal(value.cases,value.records.length);assert.equal(value.passed,value.records.length);assert.equal(value.notExecuted,0);
  for(const item of value.records)closed(item,['id','state','actual']);
 } else if(name==='signals'){
  closed(value,[...standard,'cases','passed','nodeSha256','records','sigterm','stagedDistributionManifestSha256','startupSignal']);
  assert.equal(value.nodeSha256,nodeSha256);hash(value.stagedDistributionManifestSha256);assert.equal(value.cases,1);assert.equal(value.passed,1);
  for(const item of value.records){closed(item,['id','state','elapsedMs','exitCode','tlsVersion','readyBeforeSignal','listenerClosed','delivery']);number(item.elapsedMs);assert.equal(item.exitCode,0);assert.equal(item.tlsVersion,'TLSv1.3');assert.equal(item.readyBeforeSignal,true);assert.equal(item.listenerClosed,true);closed(item.delivery,['event','targetPid','privateConsoleVerified']);assert.equal(item.delivery.event,'CTRL_C_EVENT');number(item.delivery.targetPid);assert.equal(item.delivery.privateConsoleVerified,true);}
 } else {
  closed(value,[...standard,'authority','bounds','elapsedMs','finishedUtc','head','inputs','runtime','startedUtc','results','excluded','counts','harness'],['priorAttempts','priorHarness','reusePolicy','partialCoverage','environmentCorrection','environmentRelocation','executionHarness','harnessNormalization','harnessOriginalReceipt']);
  assert.equal(value.head,BASELINE.commit);assert.equal(value.runtime.sha256,nodeSha256);closed(value.runtime,['path','sha256']);closed(value.harness,['path','sha256']);
  assert.equal(value.authority,toolRoot+'mo1305-phase1/regressions.py');closed(value.bounds,['maximumOutputBytesPerGroup','timeoutMsPerGroup','maximumTotalMs']);assert.ok(value.bounds.maximumOutputBytesPerGroup<=2097152);
  assert.ok(value.inputs.length>0);for(const input of value.inputs)row(input);recordCounts(value.counts);
  for(const item of value.results){
   if(item.executionMode===undefined){validateRun(item);continue;}
   closed(item,[...runFields,'executionMode','aggregateOnly','originalGroupCommand','focusedRunCounts','executionRuns','caseCoverage','note']);
   assert.equal(item.id,'mo1302-projections');assert.equal(item.state,'PASS');assert.equal(item.executionMode,'split-case-coverage');assert.equal(item.aggregateOnly,true);assert.equal(item.exitCode,null);assert.equal(item.signal,null);assert.equal(item.error,null);assert.equal(item.outputExceeded,false);assert.equal(item.timedOut,false);
   assert.deepEqual(item.counts,{tests:5,pass:5,fail:0,skipped:0});assert.deepEqual(item.focusedRunCounts,{tests:1,pass:1,fail:0,skipped:0});assert.equal(item.executionRuns.length,2);validateRun(item.executionRuns[0],{failed:true});validateRun(item.executionRuns[1]);assert.deepEqual(item.executionRuns[1].counts,item.focusedRunCounts);assert.deepEqual(item.log,item.executionRuns[1].log);assert.deepEqual(item.command,item.executionRuns[1].command);assert.equal(item.elapsedMs,item.executionRuns[1].elapsedMs);
   assert.deepEqual(item.caseCoverage.map(x=>x.name),SPLIT_CASES,'SPLIT_CASE_IDENTITY');
   for(const [index,entry] of item.caseCoverage.entries()){closed(entry,['name','state','sourceLog']);assert.equal(entry.state,'PASS');row(entry.sourceLog);assert.deepEqual(entry.sourceLog,item.executionRuns[index<4?0:1].log);}
   const prefix=[value.runtime.path,'--test','--test-concurrency=1','--test-reporter=tap'],file='repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs';
   assert.deepEqual(item.originalGroupCommand,[...prefix,'--test-name-pattern=CLI transport|real bundled orchestration|valid MO-1301 evaluation failures|artifact verifier rejections|wrong decision/exit',file]);
   assert.deepEqual(item.command,[...prefix,'--test-name-pattern=^'+SPLIT_CASES[4]+'$',file]);assert.ok(typeof item.note==='string'&&item.note.length>0);
   if(value.partialCoverage){closed(value.partialCoverage,['id','run','cases','missing']);assert.equal(value.partialCoverage.id,item.id);assert.deepEqual(value.partialCoverage.run,item.executionRuns[0]);assert.deepEqual(value.partialCoverage.cases,item.caseCoverage.slice(0,4));assert.equal(value.partialCoverage.missing,SPLIT_CASES[4]);}assert.ok(value.priorAttempts?.length>=2);
  }
  assert.deepEqual(value.counts,value.results.reduce((out,item)=>{for(const [key,count] of Object.entries(item.counts))out[key]=(out[key]??0)+count;return out;},{}),'REGRESSION_COUNT_SUM');
  if(value.priorAttempts){assert.ok(Array.isArray(value.priorAttempts)&&value.priorAttempts.length<=8);for(const input of value.priorAttempts)row(input);row(value.priorHarness);assert.ok(typeof value.reusePolicy==='string');}
 }
 if(value.environmentCorrection){row(value.environmentCorrection);row(value.environmentRelocation);}if(value.executionHarness){row(value.executionHarness);row(value.harnessOriginalReceipt);assert.deepEqual(value.harnessNormalization,{kind:'LF_SINGLE_FINAL_NEWLINE',semanticChanges:false});}
 const records=name==='regressions'?value.results:value.records;assertIds(name,records);validateActual(name,records);if(value.reuse){closed(value.reuse,['priorReceipt','retainedIds','reason']);row(value.reuse.priorReceipt);assert.ok(Array.isArray(value.reuse.retainedIds)&&new Set(value.reuse.retainedIds).size===value.reuse.retainedIds.length);assert.ok(value.reuse.retainedIds.every(x=>EXPECTED_IDS[name].includes(x)));assert.ok(typeof value.reuse.reason==='string'&&value.reuse.reason.length>0);}return value;
}
function catalog(){return {kind:'MemoryOSRESTPhase2ACatalog',version:'1.0.0',baseline:BASELINE.commit,scope:'Focused remote and lifecycle completion',groups:groups.map(id=>({id,requiredIds:EXPECTED_IDS[id]}))};}
function lifecyclePriorName(index){return index===0?'prior/lifecycle.json':'prior/lifecycle-'+index+'.json';}
function lifecyclePriorFiles(module,files){const names=[];let reuse=module.reuse,index=0;const seen=new Set();while(reuse){assert.ok(index<8&&!seen.has(reuse.priorReceipt.path),'PRIOR_LINEAGE_BOUND');seen.add(reuse.priorReceipt.path);const name=lifecyclePriorName(index++);names.push(name);assert.ok(files.has(name),'MISSING_PRIOR_LINEAGE');reuse=JSON.parse(files.get(name)).reuse;}return names;}
function environmentFiles(module,files){if(!module.environmentCorrection)return [];const env=JSON.parse(files.get('environment/prerequisites.json'));return ['environment/prerequisites.json','environment/relocation.json',...env.sourceMetadata.map((_,index)=>'environment/source-'+index+'.json')];}
function dataFiles(modules,files){
 return [...groups.map(name=>name+'.json'),'catalog.json','inputs.json',
 ...regressionLogs(modules.regressions).map(([name])=>name),
 ...lifecyclePriorFiles(modules.lifecycle,files),...(modules.remote.reuse?['prior/remote.json']:[]),
 ...(modules.regressions.priorAttempts??[]).map((_,i)=>'prior/regressions-'+i+'.json'),
 ...(modules.regressions.priorHarness?['prior/regressions-runner.bytes.json']:[]),...(modules.regressions.executionHarness?['execution/regressions-runner.bytes.json','execution/regressions-original-receipt.json']:[]),...environmentFiles(modules.regressions,files)].sort();
}
export function validateBundle(files,{readInput=loadInput,baseline=BASELINE,verifyInputBytes=true,verifyPrerequisiteBytes=false}={}){
 assert.ok(files instanceof Map);assert.ok(files.has('receipt.json'),'MISSING_RECEIPT');
 const receipt=parseCanonical(files.get('receipt.json'));closed(receipt,['kind','version','state','baseline','claims','files','executions','counts'],['prerequisiteByteChecks']);
 assert.equal(receipt.kind,'MemoryOSRESTPhase2AIntegrationReceipt');assert.equal(receipt.version,'1.0.0');assert.equal(receipt.state,'PASS');assert.deepEqual(receipt.baseline,BASELINE);assert.deepEqual(baseline,BASELINE,'BASELINE_CHANGED');
 assert.deepEqual(receipt.claims,{B2:false,I2:false,releaseCertification:false,resourceRecharacterization:false});
 const modules=Object.fromEntries(groups.map(name=>{assert.ok(files.has(name+'.json'),'MISSING_RESULT_MODULE');return [name,validateResult(name,parseCanonical(files.get(name+'.json')))];}));
 assert.deepEqual(parseCanonical(files.get('catalog.json')),catalog(),'CATALOG_CHANGED');
 const inputs=parseCanonical(files.get('inputs.json'));
 closed(inputs,['kind','version','baseline','host','runtime','limits','product','harness','fixtures','regressions','stagedManifest','stagedManifestSha256','changedProductionFiles','harnessIdentityScope']);
 assert.equal(inputs.kind,'MemoryOSRESTPhase2AInputs');assert.equal(inputs.version,'1.0.0');assert.deepEqual(inputs.baseline,BASELINE);assert.equal(inputs.harnessIdentityScope,'Final evidence tooling inputs; execution source identity is the recorded staged manifest');
 closed(inputs.host,['platform','architecture','edition','version','build']);assert.equal(inputs.host.platform,'win32');assert.equal(inputs.host.architecture,'x64');for(const field of ['edition','version','build'])assert.ok(typeof inputs.host[field]==='string'&&inputs.host[field].length>0);
 closed(inputs.runtime,['path','byteLength','sha256','version']);assert.equal(inputs.runtime.path,'.cache/mo1305-phase2a/toolchain/node.exe');assert.equal(inputs.runtime.sha256,nodeSha256);assert.equal(inputs.runtime.version,'24.21.0');number(inputs.runtime.byteLength);
 row(inputs.limits);assert.equal(inputs.limits.path,LIMITS);assert.equal(inputs.limits.sha256,LIMITS_SHA,'FROZEN_LIMITS_CHANGED');
 schemaManifest(inputs.stagedManifest);hash(inputs.stagedManifestSha256);assert.equal(sha256(Buffer.from(J(inputs.stagedManifest))),inputs.stagedManifestSha256);
 assert.deepEqual(inputs.changedProductionFiles,changedFiles.map(x=>productRoot+x));
 const sourceRows=[...inputs.stagedManifest.files.map(r=>({...r,path:productRoot+r.path})),inputs.product.find(r=>r.path===sourceManifest)].sort((a,b)=>a.path.localeCompare(b.path,'en'));
 assert.deepEqual([...inputs.product].sort((a,b)=>a.path.localeCompare(b.path,'en')),sourceRows,'PRODUCT_MANIFEST_CLOSURE');
 assert.deepEqual(inputs.harness.map(r=>r.path),[...harnessNames.map(x=>toolRoot+'mo1305-phase2a/'+x),...sharedNames.map(x=>toolRoot+'mo1305-phase1/'+x)].sort());
 assert.deepEqual(inputs.regressions,[...modules.regressions.inputs].sort((a,b)=>a.path<b.path?-1:1));
 for(const section of ['product','harness','fixtures','regressions']){
  sortedRows(inputs[section]);
  if(verifyInputBytes)for(const expected of inputs[section])assert.deepEqual(identity(expected.path,readInput(expected.path)),expected,'SOURCE_HASH_MISMATCH '+expected.path);
 }
 assert.deepEqual(inputs.product.find(r=>r.path===LIMITS),inputs.limits);
 assert.ok(inputs.fixtures.some(r=>r.path===fixtureRoot+'index.json'));assert.ok(inputs.fixtures.some(r=>r.path===fixtureRoot+'max-mip-policy.json'));
 const parity=modules.lifecycle.records.find(r=>r.id==='semantic-fixed-parity-subset');assert.equal(parity.actual.equalities,11);assert.deepEqual(parity.actual.vectors,EXPECTED_VECTORS,'FROZEN_PARITY_SELECTION_CHANGED');
 if(verifyInputBytes){
  const selectedIds=new Set(['max-mip-policy',...parity.actual.vectors]);
  const matched=inputs.fixtures.filter(r=>r.path!==fixtureRoot+'index.json').map(r=>JSON.parse(readInput(r.path)).id);
  assert.deepEqual(matched.sort(),[...selectedIds].sort(),'FIXTURE_SELECTION_CHANGED');
  const frozen=JSON.parse(readInput(sourceManifest));schemaManifest(frozen);
  assert.deepEqual(frozen.files.map(r=>r.path),inputs.stagedManifest.files.map(r=>r.path),'SOURCE_DISTRIBUTION_MEMBERS_CHANGED');
  for(const expected of frozen.files){if(!changedFiles.includes(expected.path))assert.deepEqual(inputs.product.find(r=>r.path===productRoot+expected.path),{...expected,path:productRoot+expected.path},'UNCHANGED_PRODUCT_BYTES_CHANGED');}
  const runner=inputs.harness.find(r=>r.path===modules.regressions.harness.path);assert.equal(runner.sha256,modules.regressions.harness.sha256,'REGRESSION_RUNNER_CHANGED');
 }
 const executionHashes=[modules.lifecycle.staging.distributionManifestSha256,modules.remote.staging.distributionManifestSha256,modules.signals.stagedDistributionManifestSha256];
 assert.ok(executionHashes.every(x=>x===inputs.stagedManifestSha256),'STALE_EXECUTION_SOURCE');
 assert.deepEqual(receipt.executions,['lifecycle','remote','signals'].map((name,index)=>({module:name,stagedManifestSha256:executionHashes[index]})));
 assert.deepEqual(receipt.counts,{lifecycle:modules.lifecycle.records.length,remote:modules.remote.records.length,signals:1,regressionGroups:modules.regressions.results.length,regressionTests:modules.regressions.counts.tests});
 const expectedFiles=dataFiles(modules,files);assert.deepEqual([...files.keys()].sort(),[...expectedFiles,'receipt.json'].sort(),'MISSING_OR_UNEXPECTED_EVIDENCE_FILE');sortedRows(receipt.files);assert.deepEqual(receipt.files.map(x=>x.path),expectedFiles);
 for(const expected of receipt.files)assert.deepEqual(identity(expected.path,files.get(expected.path)),expected,'EVIDENCE_HASH_MISMATCH');
 for(const [name,log] of regressionLogs(modules.regressions)){const bytes=files.get(name);assert.equal(bytes.length,log.byteLength);assert.equal(sha256(bytes),log.sha256);}
 for(const result of modules.regressions.results){
  const bytes=files.get(logName(result.log));
  const counts=Object.fromEntries([...bytes.toString('utf8').matchAll(/^# (tests|pass|fail|skipped) (\d+)$/gm)].map(match=>[match[1],Number(match[2])]));
  assert.deepEqual(counts,result.focusedRunCounts??result.counts,'TAP_COUNTS_MISMATCH');
  if(result.executionMode==='split-case-coverage'){
   for(const [index,run] of result.executionRuns.entries()){const text=files.get(logName(run.log)).toString('utf8');assert.doesNotMatch(text,/^not ok /mu);assert.deepEqual([...text.matchAll(/^ok \d+ - (.*)$/gm)].map(x=>x[1].trim()),index===0?SPLIT_CASES.slice(0,4):SPLIT_CASES.slice(4),'SPLIT_LOG_CASE_IDENTITY');}
  }
 }
 let currentLifecycle=modules.lifecycle;for(const name of lifecyclePriorFiles(modules.lifecycle,files)){const reuse=currentLifecycle.reuse,bytes=files.get(name);assert.equal(bytes.length,reuse.priorReceipt.byteLength);assert.equal(sha256(bytes),reuse.priorReceipt.sha256);const old=JSON.parse(bytes);assert.ok(['PASS','FAIL'].includes(old.state));assert.equal(old.baseline,BASELINE.commit);assert.equal(old.staging.distributionManifestSha256,inputs.stagedManifestSha256);for(const id of reuse.retainedIds){const prior=old.records.find(x=>x.id===id);assert.equal(prior.state,'PASS');assert.deepEqual(prior,currentLifecycle.records.find(x=>x.id===id));}currentLifecycle=old;}
 if(modules.remote.reuse){const reuse=modules.remote.reuse,bytes=files.get('prior/remote.json');assert.equal(bytes.length,reuse.priorReceipt.byteLength);assert.equal(sha256(bytes),reuse.priorReceipt.sha256);const old=JSON.parse(bytes);assert.equal(old.state,'FAIL');assert.equal(old.staging.distributionManifestSha256,inputs.stagedManifestSha256);for(const id of reuse.retainedIds){const previous=old.completed.find(x=>x.id===id);assert.equal(previous.state,'PASS');assert.deepEqual(previous,modules.remote.records.find(x=>x.id===id));}}
 for(const [i,prior] of (modules.regressions.priorAttempts??[]).entries()){const bytes=files.get('prior/regressions-'+i+'.json');assert.equal(bytes.length,prior.byteLength);assert.equal(sha256(bytes),prior.sha256);}
 if(modules.regressions.priorHarness){const bytes=decodeRaw(files.get('prior/regressions-runner.bytes.json'));assert.equal(bytes.length,modules.regressions.priorHarness.byteLength);assert.equal(sha256(bytes),modules.regressions.priorHarness.sha256);}
 if(modules.regressions.executionHarness){
  const module=modules.regressions,executed=decodeRaw(files.get('execution/regressions-runner.bytes.json'));assert.equal(executed.length,module.executionHarness.byteLength);assert.equal(sha256(executed),module.executionHarness.sha256);
  const originalBytes=files.get('execution/regressions-original-receipt.json');assert.equal(originalBytes.length,module.harnessOriginalReceipt.byteLength);assert.equal(sha256(originalBytes),module.harnessOriginalReceipt.sha256);const original=JSON.parse(originalBytes);assert.equal(original.state,'PASS');assert.deepEqual(original.harness,{path:module.harness.path,sha256:module.executionHarness.sha256});
  assert.deepEqual(module,{...original,harness:module.harness,executionHarness:module.executionHarness,harnessNormalization:module.harnessNormalization,harnessOriginalReceipt:module.harnessOriginalReceipt},'NORMALIZATION_CHANGED_RESULTS');
  if(verifyInputBytes)assert.deepEqual(normalizeSource(executed),readInput(module.harness.path),'SOURCE_NORMALIZATION_CHANGED_CODE');
 }
 if(modules.regressions.environmentCorrection){
  const reference=modules.regressions.environmentCorrection,bytes=files.get('environment/prerequisites.json');assert.equal(bytes.length,reference.byteLength);assert.equal(sha256(bytes),reference.sha256);
  const env=JSON.parse(bytes);closed(env,['kind','version','state','mode','sourceFilesModified','networkUsed','locks','closure','sourceMetadata','packages','files']);
  assert.equal(env.kind,'MemoryOSRESTPhase2ARegressionPrerequisites');assert.equal(env.version,'1.0.0');assert.equal(env.state,'PASS');assert.equal(env.mode,'exact-offline-copy');assert.equal(env.sourceFilesModified,false);assert.equal(env.networkUsed,false);
  assert.equal(env.locks.length,2);for(const lock of env.locks){row(lock);const expected={'repositories/memoryos-vscode/package-lock.json':'995b20b441be2872d3f41e66b2e26ccedbe4657657581a351ebc0a0008249ff0','repositories/memoryos-mcp/package-lock.json':'bc5fe0dbbad8cd46f3562420c39b721fde59500294c3f55fd39f585a733181df'}[lock.path];assert.equal(lock.sha256,expected);if(verifyInputBytes)assert.deepEqual(identity(lock.path,readInput(lock.path)),lock,'DEPENDENCY_LOCK_CHANGED');}
  row(env.closure);assert.equal(env.closure.path,'repositories/memoryos-mcp/distribution/dependency-closure.json');assert.equal(env.closure.sha256,'30d1057ce8c8f46a75c7e2278e1e6f401934766393fa39755bd1de503ddae686');if(verifyInputBytes)assert.deepEqual(identity(env.closure.path,readInput(env.closure.path)),env.closure,'DEPENDENCY_CLOSURE_CHANGED');
  assert.deepEqual(env.packages.map(x=>[x.name,x.version]).sort(),[['esbuild','0.28.2'],['@esbuild/win32-x64','0.28.2'],['typescript','7.0.2'],['@modelcontextprotocol/core','2.0.0'],['@modelcontextprotocol/server','2.0.0'],['zod','4.6.5']].sort());
  for(const pkg of env.packages){closed(pkg,['name','version','installedPath','lockPath']);path(pkg.installedPath);path(pkg.lockPath);assert.ok(env.locks.some(x=>x.path===pkg.lockPath));if(verifyInputBytes){const lock=JSON.parse(readInput(pkg.lockPath));assert.equal(lock.packages['node_modules/'+pkg.name].version,pkg.version);}}
  assert.ok(env.files.length>0&&env.files.length<=2048);const byPath=new Map();for(const item of env.files){row(item);assert.ok(!byPath.has(item.path));assert.ok(env.packages.some(pkg=>item.path.startsWith(pkg.installedPath+'/')));byPath.set(item.path,item);}
  assert.equal(env.sourceMetadata.length,2);for(const [index,ref] of env.sourceMetadata.entries()){row(ref);const raw=files.get('environment/source-'+index+'.json');assert.equal(raw.length,ref.byteLength);assert.equal(sha256(raw),ref.sha256);}
  const relocationRef=modules.regressions.environmentRelocation;row(relocationRef);const relocationBytes=files.get('environment/relocation.json');assert.equal(relocationBytes.length,relocationRef.byteLength);assert.equal(sha256(relocationBytes),relocationRef.sha256);
  const relocation=JSON.parse(relocationBytes);closed(relocation,['kind','version','state','sourceFilesModified','files']);assert.equal(relocation.kind,'MemoryOSRESTPhase2ARegressionDependencyRelocation');assert.equal(relocation.version,'1.0.0');assert.equal(relocation.state,'PASS');assert.equal(relocation.sourceFilesModified,false);
  assert.equal(relocation.files.length,env.files.length);const moved=new Set();
  for(const item of relocation.files){closed(item,['originalPath','retainedPath','byteLength','sha256']);assert.ok(!moved.has(item.originalPath));moved.add(item.originalPath);assert.deepEqual({path:item.originalPath,byteLength:item.byteLength,sha256:item.sha256},byPath.get(item.originalPath));assert.equal(item.retainedPath,'.cache/mo1305-phase2a/prerequisite-dependencies/'+item.originalPath);if(verifyPrerequisiteBytes)assert.deepEqual(identity(item.originalPath,readInput(item.retainedPath)),byPath.get(item.originalPath),'RETAINED_DEPENDENCY_CHANGED');}
  assert.deepEqual(receipt.prerequisiteByteChecks,{state:'PASS',files:env.files.length,prerequisitesSha256:reference.sha256,relocationSha256:relocationRef.sha256});
 }
 return {state:'PASS',...receipt.counts,stagedManifestSha256:inputs.stagedManifestSha256};
}
function git(args){const result=spawnSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});assert.equal(result.status,0);return result.stdout.trim();}
function actualBaseline(){const [commit,subject,tree]=git(['show','-s','--format=%H%n%s%n%T',BASELINE.commit]).split(/\r?\n/u);const found={commit,subject,tree};assert.deepEqual(found,BASELINE);return found;}
function host(){const result=spawnSync(pwsh,['-NoProfile','-NonInteractive','-Command','Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(result.status,0);const value=JSON.parse(result.stdout);return {platform:process.platform,architecture:process.arch,edition:value.Caption,version:value.Version,build:value.BuildNumber};}
export function collect(){
 assert.equal(process.platform,'win32');assert.equal(process.versions.node,'24.21.0');assert.equal(streamedHash(node),nodeSha256);const baseline=actualBaseline();
 const modules=Object.fromEntries(groups.map(name=>{const from=name==='regressions'?'regressions/results.json':name+'-results.json';return [name,validateResult(name,JSON.parse(readFileSync(resolve(cache,from))))];}));
 const expectedHash=modules.lifecycle.staging.distributionManifestSha256;
 const matching=readdirSync(cache,{withFileTypes:true}).filter(x=>x.isDirectory()&&x.name.startsWith('session-')).map(x=>resolve(cache,x.name,'package/distribution-manifest.json')).filter(p=>sha256(readFileSync(p))===expectedHash);
 assert.ok(matching.length>0,'MISSING_TESTED_STAGE_MANIFEST');const stagedManifest=parseCanonical(readFileSync(matching[0]));schemaManifest(stagedManifest);
 const parity=modules.lifecycle.records.find(r=>r.id==='semantic-fixed-parity-subset'),selected=new Set(['max-mip-policy',...parity.actual.vectors]);
 const fixtureIndex=JSON.parse(loadInput(fixtureRoot+'index.json'));
 const fixturePaths=fixtureIndex.files.filter(row=>selected.has(JSON.parse(loadInput(fixtureRoot+row.path)).id)).map(row=>fixtureRoot+row.path);
 const inputs={kind:'MemoryOSRESTPhase2AInputs',version:'1.0.0',baseline,host:host(),runtime:{path:'.cache/mo1305-phase2a/toolchain/node.exe',byteLength:statSync(node).size,sha256:nodeSha256,version:'24.21.0'},limits:identity(LIMITS,loadInput(LIMITS)),
  product:inputRows([...stagedManifest.files.map(r=>productRoot+r.path),sourceManifest]),
  harness:inputRows([...harnessNames.map(x=>toolRoot+'mo1305-phase2a/'+x),...sharedNames.map(x=>toolRoot+'mo1305-phase1/'+x)]),
  fixtures:inputRows([fixtureRoot+'index.json',...fixturePaths]),regressions:[...modules.regressions.inputs].sort((a,b)=>a.path<b.path?-1:1),
  stagedManifest,stagedManifestSha256:expectedHash,changedProductionFiles:changedFiles.map(x=>productRoot+x),harnessIdentityScope:'Final evidence tooling inputs; execution source identity is the recorded staged manifest'};
 const files=new Map([['inputs.json',Buffer.from(J(inputs))],['catalog.json',Buffer.from(J(catalog()))],...groups.map(name=>[name+'.json',Buffer.from(J(modules[name]))])]);
 for(const [name,log] of regressionLogs(modules.regressions))files.set(name,loadInput(log.path));
 let previous=modules.lifecycle.reuse,depth=0;const seen=new Set();while(previous){assert.ok(depth<8&&!seen.has(previous.priorReceipt.path),'PRIOR_LINEAGE_BOUND');seen.add(previous.priorReceipt.path);const bytes=loadInput(previous.priorReceipt.path);files.set(lifecyclePriorName(depth++),bytes);previous=JSON.parse(bytes).reuse;}
 if(modules.remote.reuse)files.set('prior/remote.json',loadInput(modules.remote.reuse.priorReceipt.path));
 for(const [i,prior] of (modules.regressions.priorAttempts??[]).entries())files.set('prior/regressions-'+i+'.json',loadInput(prior.path));
 if(modules.regressions.priorHarness)files.set('prior/regressions-runner.bytes.json',encodeRaw(loadInput(modules.regressions.priorHarness.path)));
 if(modules.regressions.executionHarness){files.set('execution/regressions-runner.bytes.json',encodeRaw(loadInput(modules.regressions.executionHarness.path)));files.set('execution/regressions-original-receipt.json',loadInput(modules.regressions.harnessOriginalReceipt.path));}
 if(modules.regressions.environmentCorrection){const bytes=loadInput(modules.regressions.environmentCorrection.path);files.set('environment/prerequisites.json',bytes);files.set('environment/relocation.json',loadInput(modules.regressions.environmentRelocation.path));for(const [index,ref] of JSON.parse(bytes).sourceMetadata.entries())files.set('environment/source-'+index+'.json',loadInput(ref.path));}
 const receipt={kind:'MemoryOSRESTPhase2AIntegrationReceipt',version:'1.0.0',state:'PASS',baseline,claims:{B2:false,I2:false,releaseCertification:false,resourceRecharacterization:false},
  files:[...files].map(([path,bytes])=>identity(path,bytes)).sort((a,b)=>a.path<b.path?-1:1),
  executions:['lifecycle','remote','signals'].map(name=>({module:name,stagedManifestSha256:name==='signals'?modules.signals.stagedDistributionManifestSha256:modules[name].staging.distributionManifestSha256})),
  counts:{lifecycle:modules.lifecycle.records.length,remote:modules.remote.records.length,signals:1,regressionGroups:modules.regressions.results.length,regressionTests:modules.regressions.counts.tests}};
 if(modules.regressions.environmentCorrection)receipt.prerequisiteByteChecks={state:'PASS',files:JSON.parse(files.get('environment/prerequisites.json')).files.length,prerequisitesSha256:modules.regressions.environmentCorrection.sha256,relocationSha256:modules.regressions.environmentRelocation.sha256};
 files.set('receipt.json',Buffer.from(J(receipt)));const result=validateBundle(files,{baseline,verifyPrerequisiteBytes:true});
 for(const [path,bytes] of files){assert.ok(bytes.length<=2097152);const target=resolve(output,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
 return result;
}
export function readBundle(directory=output){const result=new Map();let total=0;function visit(folder,prefix=''){assert.ok(prefix.split('/').length<=4,'EVIDENCE_DEPTH');for(const item of readdirSync(folder,{withFileTypes:true})){assert.ok(!item.isSymbolicLink());const name=prefix+item.name;path(name);if(item.isDirectory())visit(resolve(folder,item.name),name+'/');else{const file=resolve(folder,item.name),size=statSync(file).size;assert.ok(size<=2097152&&result.size<64,'EVIDENCE_BOUND');total+=size;assert.ok(total<=8388608,'EVIDENCE_TOTAL_BOUND');result.set(name,readFileSync(file));}}}visit(directory);return result;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const command=process.argv[2];assert.ok(process.argv.length===3&&(command==='collect'||command==='verify'),'Usage: evidence.mjs collect|verify');
 const result=command==='collect'?collect():validateBundle(readBundle(),{baseline:actualBaseline()});process.stdout.write(J(result)+'\n');
}
