// Read-only verification of the retained engineering oracle campaign.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';

const prefix='repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction';
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

export function checkEquivalence(base=prefix+'/equivalence/attempt1') {
 const receipt=json(base+'/receipt.json');assert.equal(receipt.result,'PASS');assert.equal(receipt.failure,null);
 assert.equal(receipt.expectedCases,39);assert.equal(receipt.cases.length,39);
 assert.equal(receipt.productDeadlinesChanged,false);assert.equal(receipt.productHooksAdded,false);assert.equal(receipt.performanceAcceptance,false);
 for(const binding of receipt.sourceBindings)check(binding);
 const baseline=json(prefix+'/oracle/baseline.json'),old=read(prefix+'/oracle/b2-windows-inspect.ps1');
 assert.equal(hash(old),'sha256:ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b');
 const retainedCandidate=read(prefix+'/oracle/pass1-windows-inspect.ps1');
 assert.deepEqual(retainedCandidate,check(receipt.sourceBindings.find(p=>p.path==='repositories/memoryos-readiness/helpers/windows-inspect.ps1')));
 const rows=new Map();let comparisons=0,instrumented=0,mutations=0,negative=0;
 for(const c of receipt.cases){
  assert.equal(rows.has(c.name),false);rows.set(c.name,c);assert.equal(c.result,'PASS');assert.equal(c.exactResponseEqual,true);
  check(c.request);assert.deepEqual(c,json(base+'/'+c.name+'/comparison.json'));
  const frames=[];
  for(const side of ['b2','candidate']){
   const r=c[side];assert.deepEqual(r,json(base+'/'+c.name+'/'+side+'.receipt.json'));
   assert.equal(r.code,0);assert.equal(r.signal,null);assert.equal(r.engineeringGuardExpired,false);assert.equal(r.closeObserved,true);assert.equal(r.pipesClosed,true);
   assert.equal(r.stderr.byteLength,0);check(r.stderr);const response=check(r.stdout);frames.push(response);
   assert.equal(response.readUInt32BE(0),response.length-4);const body=JSON.parse(response.subarray(4));assert.deepEqual(response.subarray(4),canonicalBytes(body));
   assert.equal(body.status,c.status);assert.equal(body.code,c.code);check(r.helperSource);
   if(c.telemetry){
    const telemetry=c.telemetry[side];assert.deepEqual({...json(telemetry.source.path),source:telemetry.source},telemetry);check(telemetry.source);
    assert.equal(telemetry.mutations,c.mutation?1:0);assert.ok(telemetry.peakWorkingSet64>0);assert.ok(telemetry.managedBytes>0);
    const source=read(r.helperSource.path).toString('utf8');
    const recovered=source.replace(/# ORACLE-BEGIN-(\d+)\n[\s\S]*?# ORACLE-END-\1\n/g,'');
    assert.equal(recovered,(side==='b2'?old:retainedCandidate).toString('utf8'));
    const description=json(base+'/'+c.name+'/'+side+'-instrumentation.json');check(description.original);check(description.copy);
    assert.equal(description.reversibleAdditions,true);assert.equal(description.productionHooks,false);assert.equal(description.securityObservationCallsRetained,true);
   }
  }
  assert.deepEqual(frames[0],frames[1]);comparisons++;
  if(c.telemetry){instrumented++;assert.equal(c.nativeObservationCountsEqual,true);assert.deepEqual(c.telemetry.b2.counters,c.telemetry.candidate.counters);}
  if(c.mutation)mutations++;if(c.status==='ERROR')negative++;
 }
 const map=(groups)=>groups.map(([category,names])=>({category,result:'PASS',cases:names.map(name=>{const c=rows.get(name);assert.ok(c);return {name,scope:c.scope,comparison:pin(base+'/'+name+'/comparison.json')};})}));
 assert.equal(categoryCases.length,22);assert.equal(freshnessCases.length,6);assert.equal(negative,32);assert.equal(instrumented,19);assert.equal(mutations,17);
 const mo=rows.get('mo1306-native-counters');
 for(const side of ['b2','candidate']) {
  const counts=mo.telemetry[side].counters;
  assert.equal(Object.entries(counts).filter(([k])=>k.endsWith(':Read-Identity')).reduce((n,[,v])=>n+v,0),2172);
  assert.equal(Object.entries(counts).filter(([k])=>k.endsWith(':Open-Native')).reduce((n,[,v])=>n+v,0),1448);
  for(const phase of ['initial','post-read','root-post'])assert.equal(counts[phase+':Read-Identity'],counts[phase+':GetFinalPathNameByHandleW']);
 }
 const memory=['ordinary-native-counters','mo1306-native-counters'].map(name=>{
  const c=rows.get(name),before=c.telemetry.b2,after=c.telemetry.candidate;
  const values=v=>({workingSet64:v.workingSet64,peakWorkingSet64:v.peakWorkingSet64,managedBytes:v.managedBytes});
  return {case:name,b2:values(before),candidate:values(after),observedPeakWorkingSetDelta:after.peakWorkingSet64-before.peakWorkingSet64,observedManagedBytesDelta:after.managedBytes-before.managedBytes,comparison:pin(base+'/'+name+'/comparison.json')};
 });
 return {kind:'MO1307ReadSetSecurityFreshnessSummary',version:'1.0.0',result:'PASS',receipt:pin(base+'/receipt.json'),baseline:pin(prefix+'/oracle/baseline.json'),b2:pin(prefix+'/oracle/b2-windows-inspect.ps1'),candidate:pin(prefix+'/oracle/pass1-windows-inspect.ps1'),
  checker:pin('repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/check-equivalence.mjs'),runtime:{node:pin(process.execPath.replaceAll('\\','/')),nodeVersion:process.version,powershell:pin('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')},
  counts:{cases:comparisons,nativeHelperInvocations:comparisons*2,successCases:comparisons-negative,negativeCases:negative,instrumentedComparisons:instrumented,controlledMutationComparisons:mutations,section14Categories:22,section15Categories:6},
  section14:map(categoryCases),section15:map(freshnessCases),nativeObservations:mo.telemetry,memory,
  memoryInterpretation:'Separate instrumented-process observations include engine, GC and observer overhead; observed deltas are not isolated optimization allocations. The source diff removes pure lexical work and allocates no additional production cache or metadata.',
  limitations:[receipt.freshnessScope,receipt.observationMemoryScope,'The 20-second engineering guard produces exact B2 oracle frames; this corpus does not establish compliance with the unchanged 5-second production deadline.','Controlled native mutation hooks only exist in reversible engineering source copies. Production sharing and observations remain unchanged.'],
  historicalCertification:'BLOCKED; unchanged by this engineering equivalence campaign',network:false,recertification:false};
}

if(path.resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)) {
 const summary=checkEquivalence();
 if(process.argv.length===4&&process.argv[2]==='--output')fs.writeFileSync(process.argv[3],JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 else assert.equal(process.argv.length,2);
 console.log(JSON.stringify({result:summary.result,counts:summary.counts}));
}
