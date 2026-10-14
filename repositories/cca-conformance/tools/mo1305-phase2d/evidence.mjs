/** Integrated evidence gate. No execution campaign or historical receipt is rewritten. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {root,directory,jobs,executionBinding,python} from './execution.mjs';
import {canonical,sha,reference,verifyReference,parseCanonical,assertClosed,validateAttempt as validateSecurity} from '../mo1305-phase2c/evidence.mjs';
import {validateResult as validateLifecycle} from '../mo1305-phase2a/evidence.mjs';
import {classify} from '../mo1305-host-guard.mjs';

export {root,directory,canonical,sha,reference,verifyReference,parseCanonical};
export const read=path=>parseCanonical(readFileSync(resolve(root,path)));
const identity=bytes=>({byteLength:bytes.length,sha256:sha(bytes)});
const withoutPath=ref=>({byteLength:ref.byteLength,sha256:ref.sha256});
const securityJobs=['transport','dispatch','startup','resources','interop'];
const sorted=items=>items.toSorted((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
export function checkPackage(){
 const archive=reference('.cache/mo1305-phase2d/build/memoryos-rest-0.1.0.tgz');
 const out=spawnSync(python,['-B','-X','utf8',resolve(import.meta.dirname,'verify-package.py'),archive.sha256],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:8388608});
 assert.equal(out.error,undefined);assert.equal(out.status,0,out.stderr);return JSON.parse(out.stdout);
}
export function checkInstallation(value,binding){
 assert.equal(value.kind,'MemoryOSRESTPhase2DInstalledValidation');assert.equal(value.version,'1.0.0');assert.equal(value.state,'PASS');assert.equal(value.failure,undefined);
 assert.deepEqual(value.archive,withoutPath(binding.archive));
 const production=binding.candidate.production;
 const manifest=production.find(r=>r.path.endsWith('/distribution-manifest.json'));
 assert.deepEqual(value.distributionManifest,withoutPath(manifest));
 const inventory=sorted(production.map(r=>({...r,path:r.path.slice('repositories/memoryos-rest/'.length)})));
 assert.deepEqual(value.packageInventory,inventory);assert.equal(value.packageInventorySha256,sha(canonical(inventory)));
 for(const key of ['ciCacheInitiallyEmpty','installCacheInitiallyEmpty','offlineMode','scriptsDisabled','auditDisabled','fundDisabled','installedPackageMatchesArchive'])assert.equal(value.offline[key],true,'OFFLINE_'+key);
 assert.equal(value.offline.externalProductionDependencies,0);assert.deepEqual(value.offline.projectLockPackages,['','node_modules/memoryos-rest']);
 for(const key of ['stageOutsideCheckout','freshDirectory','gatewayCwdInitiallyEmpty','copiedArchive','copiedNodeAndNpmToolchain','copiedProbeAndFixtures','gatewayCwdRemainedEmpty'])assert.equal(value.sourceIndependence[key],true,'SOURCE_INDEPENDENCE_'+key);
 assert.equal(value.sourceIndependence.checkoutHiddenByOS,false);
 assert.deepEqual(value.sourceIndependence.gatewayEnvironmentKeys,['SYSTEMROOT','TEMP','TMP','WINDIR']);
 assert.equal(value.temporaryCredentialsRemoved,true);
 assert.deepEqual(value.trustedLauncherNegatives,{environmentSelectedSource:'REFUSED',nodeSubstitution:'REFUSED',gatewayEnvironmentSelectedSource:'REFUSED_BEFORE_STARTUP'});
 assert.equal(value.tools.node.sha256,binding.candidate.node.sha256);assert.equal(value.tools.npmVersion,'11.19.0');
 for(const [field,name] of [['probe','installed-probe.mjs'],['trustedValidator','../mo1305-phase1/validate-launch.ps1']]){
  const bytes=readFileSync(resolve(import.meta.dirname,name));assert.deepEqual(value[field],identity(bytes));
 }
 const installCommands=value.commands.filter(c=>c.argv.includes('ci')||c.argv.includes('install'));
 assert.equal(installCommands.length,2);
 for(const cmd of installCommands){assert.equal(cmd.exitCode,0);for(const flag of ['--offline','--ignore-scripts','--no-audit','--no-fund','--cache','--userconfig','--globalconfig'])assert.ok(cmd.argv.includes(flag),'INSTALL_COMMAND_'+flag);assert.ok(cmd.cwd.startsWith('$ISOLATED'));}
 const api=read('repositories/memoryos-rest/contracts/api-contract.json');
 const fixtureNames=['identities','prepare-policy-pass','prepare-policySet-pass','evaluate-policy-pass','evaluate-policy-fail','evaluate-policy-cne','verify-identity','verify-outcome'];
 const cases=[{id:'health',operation:'getHealth',input:null,expected:{status:'ok',live:true}},{id:'readiness',operation:'getReadiness',input:null,expected:{status:'ok',ready:true}},
  {id:'version',operation:'getVersion',input:null,expected:Object.fromEntries(Object.entries(api.schemas.$defs.Version.properties).map(([key,value])=>[key,value.const]))},
  ...fixtureNames.map(n=>JSON.parse(readFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1/'+n+'.json'))))];
 // The version response is independently derived from frozen schema constants.
 const version=JSON.parse(readFileSync(resolve(root,'repositories/memoryos-rest/package.json'))).version;
 assert.equal(version,'0.1.0');
 assert.deepEqual(value.installations.map(x=>x.method),['direct-extraction','npm-offline-install']);
 function wire(row,address){
  assert.equal(row.tlsVersion,'TLSv1.3');assert.equal(row.certificateAuthorized,true);assert.equal(row.alpn,'http/1.1');assert.equal(row.expectedBodyMatched,true);
  assert.equal(row.requestHeaders.Connection,'close');assert.equal(row.requestHeaders['Accept-Encoding'],'identity');
  if(row.case.startsWith('missing-host')){
   assert.equal(row.requestHeaders.Host,undefined);const auth=row.case==='missing-host-and-auth';
   assert.equal(row.status,auth?401:403);assert.equal(row.expectedError,auth?'MO1305_UNAUTHENTICATED':'MO1305_FORBIDDEN');
   assert.equal(row.requestHeaders.Authorization,auth?undefined:'Bearer <REDACTED>');assert.deepEqual(row.responseBody,identity(canonical({status:'error',error:{code:row.expectedError,semantic:null}})));assert.deepEqual(row.requestBody,identity(Buffer.alloc(0)));
  }else{assert.equal(row.status,200);assert.equal(row.requestHeaders.Authorization,'Bearer <REDACTED>');assert.equal(row.requestHeaders.Host,address+':<ISOLATED_PORT>');}
  assert.ok(row.responseWire.byteLength>row.responseBody.byteLength&&row.responseWire.byteLength<=65536);assert.match(row.responseWire.sha256,/^[a-f0-9]{64}$/);
 }
 for(const installed of value.installations){
  assert.equal(installed.state,'PASS');assert.equal(installed.fileCount,58);assert.equal(installed.everyFileMatchesBeforeAndAfter,true);
  assert.equal(installed.beforeInventorySha256,sha(canonical(inventory)));assert.equal(installed.afterInventorySha256,installed.beforeInventorySha256);
  const run=installed.execution;assert.equal(run.state,'PASS');assert.equal(run.failure,undefined);assert.equal(run.forcedCleanupFailed,undefined);assert.equal(run.entryPoint,'bin/memoryos-rest.mjs');
  assert.deepEqual(run.verification,{runtime:'PASS',distribution:'PASS',contracts:'PASS',schemas:'PASS',openapi:'PASS',limitsState:'FINAL',semanticClosureFileCount:25,distributionManifestSha256:manifest.sha256});
  for(const [name,ref] of Object.entries(run.contracts))assert.deepEqual(ref,withoutPath(reference('repositories/memoryos-rest/contracts/'+name)));
  const expectedIds=[...cases.map(x=>x.id),'missing-host','missing-host-and-auth'].sort();
  assert.deepEqual(run.requests.map(x=>x.case).sort(),expectedIds);assert.equal(new Set(run.requests.map(x=>x.operationId)).size,9);
  for(const row of run.requests){wire(row,'127.0.0.1');const item=cases.find(x=>x.id===row.case);if(item){assert.equal(row.operationId,item.operation);assert.deepEqual(row.requestBody,identity(Buffer.from(item.input===null?'':JSON.stringify(item.input))));assert.deepEqual(row.responseBody,identity(canonical(item.expected)));assert.equal(row.responseSchemaValidated,true);}}
  assert.equal(run.process.exitCode,0);assert.equal(run.process.stdout.byteLength,0);for(const key of ['startupObserved','orderlyShutdownObserved','secretFreeLogs'])assert.equal(run.process[key],true);
  const remote=run.remote;assert.equal(remote.state,'PASS');assert.equal(remote.mode,'remote');assert.match(remote.address,/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/);assert.equal(remote.exitCode,0);assert.equal(remote.stdout.byteLength,0);assert.equal(remote.secretFreeLogs,true);
  assert.deepEqual(remote.requests.map(r=>r.case),['getHealth','getReadiness','getContractIdentities','missing-host','missing-host-and-auth']);
  for(const row of remote.requests){wire(row,remote.address);const item=cases.find(x=>x.operation===row.case);if(item){assert.equal(row.operationId,item.operation);assert.deepEqual(row.responseBody,identity(canonical(item.expected)));}}
 }
}
export function checkDistribution(value,binding){
 assert.equal(value.kind,'MemoryOSRESTPhase2DPackageAdversarial');assert.equal(value.version,'1.0.0');assert.equal(value.state,'PASS');assert.equal(value.caseCount,142);assert.equal(value.cases.length,142);
 assert.deepEqual(value.archive,withoutPath(binding.archive));
 for(const key of ['structuralAttacksUseCurrentDigest','coherentManifestSubstitutions','runtimeVerifierExecuted'])assert.equal(value[key],true);
 const expected=read('repositories/cca-conformance/tools/mo1305-phase2b/package-cases.json').cases;
 assert.deepEqual(value.cases.map(({id,expected})=>({id,expected})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),expected);
 for(const row of value.cases){assert.equal(row.state,'PASS');assert.equal(row.observed,row.expected);}
}
export function checkAttempt(attempt,binding=executionBinding()){
 assertClosed(attempt,['kind','version','job','id','index','state','binding','bindingSha256','platform','host','result','failure']);
 assert.equal(attempt.kind,'MemoryOSRESTPhase2DExecution');assert.equal(attempt.version,'1.0.0');assert.ok(jobs.includes(attempt.job));assert.match(attempt.id,new RegExp('^'+attempt.job+'-[a-f0-9-]{36}$'));
 assert.ok(Number.isInteger(attempt.index)&&attempt.index>=0&&attempt.index<=3);
 assert.deepEqual(attempt.binding,binding,'INTEGRATED_BINDING_DRIFT');assert.equal(attempt.bindingSha256,sha(canonical(binding)));
 assert.equal(attempt.platform.platform,'win32');assert.equal(attempt.platform.architecture,'x64');assert.ok(Number(attempt.platform.build)>=22000);assert.equal(attempt.platform.build,attempt.platform.currentBuild);assert.equal(attempt.platform.fullBuild,attempt.platform.release+'.'+attempt.platform.ubr);
 assertClosed(attempt.host,['events','observation']);const window=attempt.host.observation.validityWindow;
 const expected=classify({start:window.start,end:window.end,attemptId:attempt.id,candidateId:attempt.bindingSha256,caseId:attempt.job,phase:'phase2d',index:attempt.index,sampleId:attempt.id},attempt.host.events);
 assert.deepEqual(attempt.host.observation,expected,'HOST_CLASSIFICATION');
 if(expected.classification==='HOST_INTERRUPTED'){assert.equal(attempt.state,'HOST_INTERRUPTED');return attempt;}
 assert.equal(attempt.state,'PASS');assert.equal(attempt.failure,null);const result=attempt.result;
 if(result.execution){assert.equal(result.execution.exitCode,0);assert.equal(result.execution.signal,null);verifyReference(result.execution.log);assert.ok(result.execution.command.length>=2);}
 if(securityJobs.includes(attempt.job)){
  assertClosed(result,['type','result','processes','validatedLegacyFormat']);assert.equal(result.type,'security-module');
  const compatible=result.validatedLegacyFormat;validateSecurity(compatible);assert.deepEqual(compatible.result,result.result);assert.deepEqual(compatible.processes,result.processes);assert.deepEqual(compatible.binding,binding.candidate);assert.equal(compatible.module,attempt.job);assert.equal(compatible.id,attempt.id);assert.equal(compatible.state,'PASS');assert.deepEqual(compatible.host.events,attempt.host.events);assert.deepEqual(compatible.host.observation.validityWindow,window);
 }else if(attempt.job==='lifecycle'){
  assertClosed(result,['type','execution','result']);assert.equal(result.type,'lifecycle');validateLifecycle('lifecycle',result.result);assert.equal(result.result.records.length,30);assert.equal(result.result.staging.distributionManifestSha256,reference('repositories/memoryos-rest/distribution-manifest.json').sha256);
 }else if(attempt.job==='rest-units'){
  assertClosed(result,['type','execution','tests','pass','fail','sources']);assert.equal(result.type,'regression');assert.equal(result.tests,27);assert.equal(result.pass,27);assert.equal(result.fail,0);for(const ref of result.sources)verifyReference(ref);
  const log=verifyReference(result.execution.log).toString().replaceAll('\r\n','\n');for(const value of ['tests 27','pass 27','fail 0','skipped 0'])assert.match(log,new RegExp('^# '+value+'$','m'));
 }else if(['distribution','installation'].includes(attempt.job)){
  assertClosed(result,['type','execution','raw','result']);assert.equal(result.type,attempt.job);assert.deepEqual(parseCanonical(verifyReference(result.raw)),result.result);
  (attempt.job==='distribution'?checkDistribution:checkInstallation)(result.result,binding);
 }else{
  assertClosed(result,['type','execution','original','rebuilt','byteIdentical']);assert.equal(result.type,'reproducibility');assert.equal(result.byteIdentical,true);assert.deepEqual(result.original,binding.archive);assert.notEqual(result.original.path,result.rebuilt.path);assert.deepEqual(verifyReference(result.original),verifyReference(result.rebuilt));
 }
 return attempt;
}
export function checkModule(job,binding=executionBinding()){
 const module=read(directory+'/modules/'+job+'.json');assertClosed(module,['kind','version','job','state','attempts','accepted']);assert.equal(module.kind,'MemoryOSRESTPhase2DModule');assert.equal(module.version,'1.0.0');assert.equal(module.job,job);assert.equal(module.state,'PASS');assert.ok(module.attempts.length>=1&&module.attempts.length<=4);assert.deepEqual(module.accepted,module.attempts.at(-1));
 assert.equal(new Set(module.attempts.map(r=>r.path)).size,module.attempts.length);
 const attempts=module.attempts.map((ref,index)=>{assert.ok(ref.path.startsWith(directory+'/runs/'));const value=checkAttempt(parseCanonical(verifyReference(ref)),binding);assert.equal(value.job,job);assert.equal(value.index,index);assert.equal(value.state,index===module.attempts.length-1?'PASS':'HOST_INTERRUPTED');return value;});
 return attempts.at(-1);
}
export function validateAll(){
 const binding=executionBinding(),accepted=jobs.map(job=>checkModule(job,binding)),pkg=checkPackage();
 assert.deepEqual(pkg.archive,withoutPath(binding.archive));assert.equal(pkg.fileCount,58);assert.equal(pkg.runtimeFileCount,25);
 return {state:'PASS',modules:accepted.length,bindingSha256:sha(canonical(binding)),archive:binding.archive,lifecycle:30,securityRecords:accepted.filter(a=>securityJobs.includes(a.job)).reduce((n,a)=>n+a.result.result.records.length,0),restUnitTests:27,packageAdversarial:142,installedRequests:36,hostInterruptedAttempts:accepted.reduce((n,a)=>n+a.index,0)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(validateAll()));
