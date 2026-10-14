// Read-only verification of the retained engineering oracle campaign.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';

const prefix='repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction';
const root=process.cwd(), hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.resolve(root,p));
const json=p=>JSON.parse(read(p));
const pin=p=>{const b=read(p);return {path:p,byteLength:b.length,sha256:hash(b)};};
const check=p=>{assert.deepEqual(pin(p.path),p);return read(p.path);};
const categoryCases=[
 ['ordinary READ_SET success',['ordinary']],['MO-1306 65-file READ_SET',['mo1306-exact']],['READY READ_SET',['ready-exact']],
 ['wrong root',['wrong-root']],['traversal',['traversal']],['drive-relative',['drive-relative']],['UNC',['unc']],['device path',['device']],['ADS',['ads']],
 ['file symlink',['file-symlink']],['directory junction/reparse',['directory-junction']],['hardlink',['hardlink']],['wrong type',['wrong-type']],
 ['changed identity',['changed-identity','native-file-replacement']],['wrong final path',['wrong-final-path','observed-final-ads','observed-final-trailing-dot','observed-final-trailing-space','observed-final-separator','observed-final-control']],
 ['wrong volume/identity where safely representable',['wrong-volume']],['missing file',['missing-file']],
 ['file mutation between observations',['changed-attributes-observation','native-size-mutation']],['malformed request',['malformed-request']],
 ['wrong session',['wrong-session']],['wrong sequence',['wrong-sequence']],['wrong operation',['wrong-operation']],
];
const freshnessCases=[
 ['file changes between initial and post-read identity',['changed-attributes-observation','native-size-mutation']],
 ['ancestor identity changes where safely testable',['changed-ancestor-identity','native-ancestor-replacement']],
 ['file is replaced',['changed-identity','native-file-replacement']],
 ['link/reparse state changes',['changed-link-observation','native-reparse-mutation']],
 ['size changes',['changed-size-observation','native-size-mutation']],
 ['final-path expectation changes',['changed-final-expectation']],
];

export function checkSecurity(base=prefix+'/security/attempt1') {
 assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
 assert.equal(hash(read(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
 const receipt=json(base+'/receipt.json');assert.equal(receipt.result,'PASS');assert.equal(receipt.failure,null);
 assert.equal(receipt.expectedCases,44);assert.equal(receipt.cases.length,44);
 assert.equal(receipt.plannedNativeHelperInvocations,88);assert.equal(receipt.actualNativeHelperInvocations,88);assert.equal(receipt.unexecutedNativeHelperInvocations,0);
 assert.equal(receipt.sourceAndInputBindingsUnchanged,true);assert.deepEqual(receipt.preservationFailures,[]);
 assert.equal(receipt.productDeadlinesChanged,false);assert.equal(receipt.productHooksAdded,false);assert.equal(receipt.performanceAcceptance,false);
 for(const binding of receipt.sourceBindings)check(binding);
 const campaign=JSON.parse(check(receipt.campaign));assert.equal(campaign.cases.length,44);assert.equal(campaign.plannedNativeHelperInvocations,88);
 assert.equal(campaign.baselineProductionCommit,'defe93989efc6501b1a730b82e79e705884b269b');
 assert.equal(campaign.engineeringGuardMs,20000);assert.equal(campaign.cleanupAllowanceMs,2000);assert.equal(campaign.productDeadlineMs,5000);assert.equal(campaign.productAggregateHelperMs,20000);assert.equal(campaign.productCliMs,30000);assert.equal(campaign.productApiWorkerMs,10000);assert.equal(campaign.notPerformanceAcceptance,true);assert.equal(campaign.retries,0);
 assert.deepEqual(campaign.sourceBindings,receipt.sourceBindings);
 const old=read(prefix+'/oracle/c3rb-windows-inspect.ps1');assert.equal(old.length,30210);
 assert.equal(hash(old),'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8');
 const retainedCandidate=check(receipt.retainedCandidate);
 assert.deepEqual(retainedCandidate,check(receipt.sourceBindings.find(p=>p.path==='repositories/memoryos-readiness/helpers/windows-inspect.ps1')));
 const rows=new Map();let comparisons=0,instrumented=0,mutations=0,negative=0;
 for(const c of receipt.cases){
  assert.equal(rows.has(c.name),false);rows.set(c.name,c);assert.equal(c.result,'PASS');assert.equal(c.exactResponseEqual,true);
  const requestBytes=check(c.request);assert.deepEqual(c,json(base+'/'+c.name+'/comparison.json'));
  const declared=campaign.cases[comparisons];assert.equal(c.name,declared.name);assert.equal(hash(requestBytes),declared.requestSha256);assert.equal(c.expectedCode,declared.expectedCode);assert.equal(c.expectedStatus,declared.expectedStatus);assert.equal(c.expectedRootId,declared.expectedRootId);assert.equal(c.code,c.expectedCode);assert.equal(c.status,c.expectedStatus);
  const frames=[];
  for(const side of ['c3rb','candidate']){
   const r=c[side];assert.deepEqual(r,json(base+'/'+c.name+'/'+side+'.receipt.json'));
   assert.equal(r.code,0);assert.equal(r.signal,null);assert.equal(r.engineeringGuardExpired,false);assert.equal(r.closeObserved,true);assert.equal(r.pipesClosed,true);
   assert.equal(r.launchError,null);assert.equal(r.capViolation,null);assert.equal(r.cleanupUnconfirmed,undefined);assert.ok(Number.isInteger(r.pid)&&r.pid>0);assert.ok(r.exitMs>=0&&r.elapsedMs>=r.exitMs);assert.equal(r.timingIsEngineeringOnly,true);
   assert.equal(r.stderr.byteLength,0);check(r.stderr);const response=check(r.stdout);frames.push(response);
   assert.equal(response.readUInt32BE(0),response.length-4);const body=JSON.parse(response.subarray(4));assert.deepEqual(response.subarray(4),canonicalBytes(body));
   assert.equal(body.status,c.status);assert.equal(body.code,c.code);check(r.helperSource);
   if(c.code===null){const request=decodeHelperRequest(requestBytes);decodeHelperResponse(response,request);for(const f of body.files){const descriptor=request.files.find(x=>x.id===f.id),inputRoot=request.roots.find(x=>x.id===descriptor.root);assert.deepEqual(Buffer.from(f.bytes.join(''),'base64'),read(path.join(inputRoot.path,descriptor.path)));}}
   if(c.expectedRootId){assert.equal(body.roots.length,1);assert.equal(body.roots[0].id,c.expectedRootId);assert.equal(body.files.length,0);}
   if(c.telemetry){
    const telemetry=c.telemetry[side];assert.deepEqual({...json(telemetry.source.path),source:telemetry.source},telemetry);check(telemetry.source);
    assert.equal(telemetry.mutations,c.mutation?1:0);assert.ok(telemetry.peakWorkingSet64>0);assert.ok(telemetry.managedBytes>0);
    const source=read(r.helperSource.path).toString('utf8');
    const recovered=source.replace(/# ORACLE-BEGIN-(\d+)\n[\s\S]*?# ORACLE-END-\1\n/g,'');
    assert.equal(recovered,(side==='c3rb'?old:retainedCandidate).toString('utf8'));
    const description=json(base+'/'+c.name+'/'+side+'-instrumentation.json');check(description.original);check(description.copy);
    assert.equal(description.reversibleAdditions,true);assert.equal(description.productionHooks,false);assert.equal(description.securityObservationCallsRetained,true);
   }
  }
  assert.deepEqual(frames[0],frames[1]);comparisons++;
  if(c.telemetry){instrumented++;assert.equal(c.nativeObservationCountsEqual,true);assert.deepEqual(c.telemetry.c3rb.counters,c.telemetry.candidate.counters);}
  if(c.mutation)mutations++;if(c.status==='ERROR')negative++;
 }
 const map=(groups)=>groups.map(([category,names])=>({category,result:'PASS',cases:names.map(name=>{const c=rows.get(name);assert.ok(c);return {name,scope:c.scope,comparison:pin(base+'/'+name+'/comparison.json')};})}));
 assert.equal(categoryCases.length,22);assert.equal(freshnessCases.length,6);assert.equal(negative,32);assert.equal(instrumented,19);assert.equal(mutations,17);
 const inspections=['CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION'].map((operation,index)=>{
  const name='inspection-'+operation.toLowerCase().replaceAll('_','-'),c=rows.get(name);assert.ok(c);assert.equal(c.code,null);assert.equal(c.status,index===0?'ABSENT':index===4?'FINAL_ABSENT':'OK');
  const request=decodeHelperRequest(check(c.request));assert.equal(request.operation,operation);assert.equal(request.sequence,index+5);assert.deepEqual(request.files,[]);
  return {operation,name,status:c.status,result:'PASS',comparison:pin(base+'/'+name+'/comparison.json')};
 });
 const mo=rows.get('mo1306-native-counters');
 for(const side of ['c3rb','candidate']) {
  const counts=mo.telemetry[side].counters;
  assert.equal(Object.entries(counts).filter(([k])=>k.endsWith(':Read-Identity')).reduce((n,[,v])=>n+v,0),2172);
  assert.equal(Object.entries(counts).filter(([k])=>k.endsWith(':Open-Native')).reduce((n,[,v])=>n+v,0),1448);
  for(const phase of ['initial','post-read','root-post'])assert.equal(counts[phase+':Read-Identity'],counts[phase+':GetFinalPathNameByHandleW']);
 }
 const memory=['ordinary-native-counters','mo1306-native-counters'].map(name=>{
  const c=rows.get(name),before=c.telemetry.c3rb,after=c.telemetry.candidate;
  const values=v=>({workingSet64:v.workingSet64,peakWorkingSet64:v.peakWorkingSet64,managedBytes:v.managedBytes});
  return {case:name,c3rb:values(before),candidate:values(after),observedPeakWorkingSetDelta:after.peakWorkingSet64-before.peakWorkingSet64,observedManagedBytesDelta:after.managedBytes-before.managedBytes,comparison:pin(base+'/'+name+'/comparison.json')};
 });
 return {kind:'MO1307SerializationSecurityFreshnessSummary',version:'1.0.0',result:'PASS',receipt:pin(base+'/receipt.json'),campaign:receipt.campaign,baselineProductionCommit:campaign.baselineProductionCommit,c3rb:pin(prefix+'/oracle/c3rb-windows-inspect.ps1'),candidate:receipt.retainedCandidate,
  checker:pin('repositories/cca-conformance/tools/mo1307-phase3a-serialization-correction/check-security.mjs'),runtime:{node:pin(process.execPath.replaceAll('\\','/')),nodeVersion:process.version,powershell:pin('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')},
  counts:{cases:comparisons,nativeHelperInvocations:comparisons*2,successCases:comparisons-negative,negativeCases:negative,instrumentedComparisons:instrumented,controlledMutationComparisons:mutations,securityCategoryCount:22,freshnessCategoryCount:6},
  securityCategories:map(categoryCases),freshnessCategories:map(freshnessCases),inspections,nativeObservations:mo.telemetry,memory,
  memoryInterpretation:'Separate instrumented-process observations include engine, GC and observer overhead; observed deltas are not isolated optimization allocations. No zero-allocation or isolated serialization-cost conclusion is made.',
  limitations:[receipt.freshnessScope,receipt.observationMemoryScope,'The 20-second engineering guard produces exact C3RB oracle frames; this corpus does not establish compliance with the unchanged 5-second production deadline.','Controlled native mutation hooks only exist in reversible engineering source copies. Production sharing and observations remain unchanged.'],
  historicalCertification:'BLOCKED; unchanged by this engineering equivalence campaign',network:false,recertification:false};
}

if(path.resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)) {
 const summary=checkSecurity();
 if(process.argv.length===4&&process.argv[2]==='--output')fs.writeFileSync(process.argv[3],JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 else assert.equal(process.argv.length,2);
 console.log(JSON.stringify({result:summary.result,counts:summary.counts}));
}
