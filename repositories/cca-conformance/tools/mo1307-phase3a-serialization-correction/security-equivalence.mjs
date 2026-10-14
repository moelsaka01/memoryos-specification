// Engineering-only exact-frame oracle and controlled freshness experiments.
// No production hook, deadline, native signature or contract is changed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';

const root=process.cwd(), evidence='repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction', tools='repositories/cca-conformance/tools/mo1307-phase3a-serialization-correction';
const oldPath=evidence+'/oracle/c3rb-windows-inspect.ps1',candidatePath='repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const history='C:/Users/melsa/Documents/Codex/cca-mo1307-3a',ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.resolve(root,p));
const pin=p=>{const b=read(p);return{path:p.replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)}};
const write=(p,v)=>fs.writeFileSync(path.resolve(root,p),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const check=b=>assert.deepEqual(pin(b.path),b);
const psString=s=>"'"+s.replaceAll("'","''")+"'";
const frame=v=>{const b=canonicalBytes(v),h=Buffer.alloc(4);h.writeUInt32BE(b.length);return Buffer.concat([h,b]);};
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');
const output=process.argv[3].replaceAll('\\','/');assert.ok(output.startsWith(evidence+'/security/'));assert.ok(!output.split('/').includes('..'));
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');
assert.equal(hash(read(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(fs.existsSync(output),false);fs.mkdirSync(output,{recursive:true});
write(output+'/setup-plan.json',{kind:'MO1307SerializationSecurityEquivalenceSetup',version:'1.0.0',result:'PREPARING',engineeringOnly:true,output,startedAt:new Date().toISOString(),purpose:'Create bounded owned fixtures and retain immutable oracle source; native executions begin only after campaign.json exists.'});
const oldBytes=read(oldPath),newBytes=read(candidatePath);assert.equal(oldBytes.length,30210);assert.equal(hash(oldBytes),'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8');
assert.equal(process.arch,'x64');
fs.writeFileSync(output+'/candidate-windows-inspect.ps1',newBytes,{flag:'wx'});
const sourceBindings=[pin(oldPath),pin(candidatePath),pin(tools+'/security-equivalence.mjs'),pin(tools+'/check-security.mjs'),pin('repositories/memoryos-readiness/src/helper-protocol.mjs'),pin('repositories/memoryos-readiness/src/canonical.mjs'),pin(process.execPath),pin(ps)];
const scratch=path.resolve(root,'.cache','m7-c3s-sec-'+process.pid);assert.equal(fs.existsSync(scratch),false);fs.mkdirSync(scratch);
const safe=p=>{const resolved=path.resolve(p);assert.ok(resolved.startsWith(scratch+path.sep));return resolved;};
const session='b'.repeat(64),req=(input,relative='leaf.data')=>({kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',operation:'READ_SET',sequence:3,session,roots:[{id:'input',path:input}],files:[{id:'leaf',root:'input',path:relative,maxBytes:4096}]});
const cases=[],data=Buffer.from('ReadSet correction oracle; exact stable bytes.\n');
function fixture(name){const p=safe(path.join(scratch,name,'input'));fs.mkdirSync(p,{recursive:true});fs.writeFileSync(path.join(p,'leaf.data'),data);return p;}
function add(name,request,expectedCode=null,{scope='UNMODIFIED_HELPER_EXACT_FRAME',mutation=null,instrument=false,tags=[],expectedStatus=expectedCode?'ERROR':'OK',expectedRootId=null}={}){cases.push({name,request,bytes:Buffer.isBuffer(request)?request:frame(request),expectedCode,expectedStatus,expectedRootId,scope,mutation,instrument,tags});}
const ordinary=fixture('ordinary');add('ordinary',req(ordinary),null,{tags:['ordinary READ_SET success']});
add('mixed-case-root',req(ordinary.replace('m7-c3s-sec','M7-C3S-SEC')),null,{tags:['case-equivalence']});
const unicode=fixture('unicode-\u212a\u017f-\u0131-\u00e9');add('unicode-root',req(unicode),null,{tags:['Unicode lexical-equivalence']});
const moRequest=history+'/repositories/cca-conformance/evidence/mo1307/phase3a/diagnostic/attempt1/03.request.bin';
const readyRequest=history+'/repositories/cca-conformance/evidence/mo1307/phase3a-readset-diagnostic/ready-request.bin';
sourceBindings.push(pin(moRequest),pin(readyRequest));
assert.equal(read(moRequest).length,7579);assert.equal(hash(read(moRequest)),'sha256:f880661fdd2efc69b6aa7c8c1f9d8c48512fc5fb941e672cfb296bd8b2d0e9b8');
add('mo1306-exact',read(moRequest),null,{tags:['MO-1306 65-file READ_SET']});add('ready-exact',read(readyRequest),null,{tags:['READY READ_SET']});
// These five ordinary native successes extend the preserved READ_SET corpus.
// CHECK_OUTPUT is an operation-equivalence case, not the prohibited Control-E
// characterization or an extra environment/performance probe.
for(const [index,operation] of ['CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION'].entries()){
 const parent=safe(path.join(scratch,'publication-'+index));fs.mkdirSync(parent);
 const outputRoot=safe(path.join(parent,'output'));
 if(index!==0)fs.mkdirSync(outputRoot);
 if(index>=3)fs.writeFileSync(path.join(outputRoot,'memoryos-readiness-result.json.pending'),data);
 const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',operation,sequence:index+5,session,roots:[{id:'output',path:outputRoot}],files:[]};
 add('inspection-'+operation.toLowerCase().replaceAll('_','-'),request,null,{tags:['native '+operation+' success'],expectedStatus:index===0?'ABSENT':index===4?'FINAL_ABSENT':'OK',expectedRootId:index===0?'output-parent':index>=3?'pending':'output'});
}
const change=(name,mutate,code='MO1307_FILESYSTEM_BOUNDARY',tags=[name])=>{const q=req(ordinary);mutate(q);add(name,q,code,{tags});};
change('wrong-root',q=>q.roots[0].path=path.join(ordinary,'leaf.data'),undefined,['wrong root']);
change('traversal',q=>q.files[0].path='../leaf.data');change('drive-relative',q=>q.roots[0].path='C:relative');
change('unc',q=>q.roots[0].path='\\\\localhost\\share');change('device',q=>q.roots[0].path='\\\\?\\C:\\unsafe');change('ads',q=>q.files[0].path='leaf.data:secret');
const links=fixture('links');fs.writeFileSync(path.join(links,'target.data'),data);fs.symlinkSync(path.join(links,'target.data'),path.join(links,'symlink.data'),'file');
fs.mkdirSync(path.join(links,'target-dir'));fs.writeFileSync(path.join(links,'target-dir','leaf.data'),data);fs.symlinkSync(path.join(links,'target-dir'),path.join(links,'junction'),'junction');
fs.linkSync(path.join(links,'target.data'),path.join(links,'hardlink.data'));
add('file-symlink',req(links,'symlink.data'),'MO1307_FILESYSTEM_BOUNDARY',{tags:['file symlink']});
add('directory-junction',req(links,'junction/leaf.data'),'MO1307_FILESYSTEM_BOUNDARY',{tags:['directory junction/reparse']});
add('hardlink',req(links,'hardlink.data'),'MO1307_FILESYSTEM_BOUNDARY',{tags:['hardlink']});
add('wrong-type',req(links,'target-dir'),'MO1307_FILESYSTEM_BOUNDARY',{tags:['wrong type']});
add('missing-file',req(ordinary,'missing.data'),'MO1307_INPUT',{tags:['missing file']});
const malformed=frame(req(ordinary));malformed[4]=0x5b;add('malformed-request',malformed,'MO1307_INPUT',{tags:['malformed request']});
change('wrong-session',q=>q.session='G'.repeat(64),'MO1307_INPUT',['wrong session']);change('wrong-sequence',q=>q.sequence=0,'MO1307_INPUT',['wrong sequence']);change('wrong-operation',q=>q.operation='DELETE','MO1307_INPUT',['wrong operation']);
add('ordinary-native-counters',req(ordinary),null,{instrument:true,tags:['fresh native observation counters']});
add('mo1306-native-counters',read(moRequest),null,{instrument:true,tags:['MO-1306 fresh native observation counters']});
for(const [name,mutation,tags] of [
 ['changed-identity','file-id',['changed identity']],['wrong-volume','volume',['wrong volume/identity where safely representable']],
 ['changed-ancestor-identity','ancestor-id',['ancestor identity changes']],['changed-size-observation','size',['size changes']],
 ['changed-link-observation','link',['link/reparse state changes']],['changed-attributes-observation','attributes',['file mutation between observations']],
 ['wrong-final-path','final-path',['wrong final path']],['changed-final-expectation','expected-path',['final-path expectation changes']],
 ['native-file-replacement','replace',['file is replaced']],['native-size-mutation','resize',['file changes between initial and post-read identity']],
 ['native-reparse-mutation','reparse',['link/reparse state changes']],['native-ancestor-replacement','ancestor-replace',['ancestor identity changes where safely testable']],
]){const p=fixture(name);add(name,req(p),'MO1307_FILESYSTEM_BOUNDARY',{instrument:true,mutation,scope:mutation.startsWith('ancestor-replace')||['replace','resize','reparse'].includes(mutation)?'ENGINEERING_CONTROLLED_FILESYSTEM_MUTATION':'ENGINEERING_FRESH_OBSERVATION_OR_EXPECTATION_MUTATION',tags});}
for(const [name,suffix] of [['ads',':ads'],['trailing-dot','.'],['trailing-space',' '],['separator','/'],['control','\u0001']]){
 const p=fixture('observed-final-'+name);add('observed-final-'+name,req(p),'MO1307_FILESYSTEM_BOUNDARY',{instrument:true,mutation:'observed-'+name,scope:'ENGINEERING_NATIVE_FINAL_PATH_VALUE_PERTURBATION',tags:['wrong final path','lexical-equivalence'],});
}
const immutableFiles=[];for(const c of cases){let q;try{q=decodeHelperRequest(c.bytes);}catch{continue;}for(const f of q.files){const rp=q.roots.find(r=>r.id===f.root);const p=path.join(rp.path,f.path);if(fs.existsSync(p)&&fs.statSync(p).isFile()&&!p.startsWith(scratch))immutableFiles.push(pin(p));}}
const dedup=new Map(immutableFiles.map(p=>[p.path,p]));sourceBindings.push(...dedup.values());
assert.equal(cases.length,44);
write(output+'/campaign.json',{kind:'MO1307SerializationSecurityEquivalenceCampaign',version:'1.0.0',sourceBindings,cases:cases.map(c=>({name:c.name,expectedCode:c.expectedCode,expectedStatus:c.expectedStatus,expectedRootId:c.expectedRootId,scope:c.scope,mutation:c.mutation,tags:c.tags,requestSha256:hash(c.bytes)})),
 baselineProductionCommit:'defe93989efc6501b1a730b82e79e705884b269b',plannedNativeHelperInvocations:88,engineeringGuardMs:20000,cleanupAllowanceMs:2000,responseCapBytes:16777216,productDeadlineMs:5000,productAggregateHelperMs:20000,productCliMs:30000,productApiWorkerMs:10000,productDeadlinesChanged:false,notPerformanceAcceptance:true,requestRootsUnchangedForHistoricalCases:true,network:false,retries:0,stopRule:'First unexpected outcome, native observation/count drift, byte mismatch, engineering timeout, or unconfirmed direct-child transport cleanup stops without another helper invocation.',executionContext:'Must be launched by the authorized native-host command; this harness does not measure Windows token parity or alter ACLs/policy.',startedAt:new Date().toISOString()});

function instrument(source,side,c,telemetryPath){
 const blocks=[];let s=source.toString('utf8');const insert=(needle,body)=>{assert.equal(s.split(needle).length,2,'unique instrumentation anchor '+needle);const block='# ORACLE-BEGIN-'+blocks.length+'\n'+body+'\n# ORACLE-END-'+blocks.length+'\n';blocks.push({needle,block});s=s.replace(needle,block+needle);};
 const mutation=c.mutation??'';
 insert('function Reject-Protocol',`$script:OracleCounts = @{}\n$script:OraclePhase = 'initial'\n$script:OracleMutations = 0\n$script:OracleMutation = ${psString(mutation)}\nfunction Oracle-Count([string] $Name) { $key = $script:OraclePhase + ':' + $Name; if (-not $script:OracleCounts.ContainsKey($key)) { $script:OracleCounts[$key] = 0 }; $script:OracleCounts[$key]++ }`);
 insert('    $access = [uint32] 128',"    Oracle-Count 'Open-Native'");
 insert('    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(52)',"    Oracle-Count 'Read-Identity'");
 insert('        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer))',"        Oracle-Count 'GetFileInformationByHandle'");
 insert('        $count = $script:native::GetFinalPathNameByHandleW($Handle, $final, 512, 0)',"        Oracle-Count 'GetFinalPathNameByHandleW'");
 insert('    foreach ($key in @(\'attributes\', \'byteLength\', \'fileId\', \'finalPath\', \'isDirectory\', \'linkCount\', \'volumeSerial\'))',`    Oracle-Count 'Assert-SameIdentity'\n    if ($script:OraclePhase -eq 'post-read' -and $script:OracleMutations -eq 0) {\n        if ($script:OracleMutation -eq 'ancestor-id' -and $After.isDirectory) { $After.fileId = 'ffffffffffffffff'; $script:OracleMutations++ }\n        elseif (-not $After.isDirectory) {\n            switch ($script:OracleMutation) {\n                'file-id' { $After.fileId = 'ffffffffffffffff'; $script:OracleMutations++ }\n                'volume' { $After.volumeSerial = 'ffffffff'; $script:OracleMutations++ }\n                'size' { $After.byteLength++; $script:OracleMutations++ }\n                'link' { $After.linkCount++; $script:OracleMutations++ }\n                'attributes' { $After.attributes = $After.attributes -bxor 2; $script:OracleMutations++ }\n                'final-path' { $After.finalPath += '.wrong'; $script:OracleMutations++ }\n            }\n        }\n    }`);
 // Perturb a newly returned native final path before original validation/equality.
 insert("        if (-not $observed.StartsWith('\\\\?\\', [StringComparison]::Ordinal))",`        if ($script:OraclePhase -eq 'post-read' -and -not $Directory -and $script:OracleMutations -eq 0 -and $script:OracleMutation.StartsWith('observed-')) {\n            switch ($script:OracleMutation) {\n                'observed-ads' { $observed += ':ads' }\n                'observed-trailing-dot' { $observed += '.' }\n                'observed-trailing-space' { $observed += ' ' }\n                'observed-separator' { $observed += '/' }\n                'observed-control' { $observed += [char]1 }\n            }; $script:OracleMutations++\n        }`);
 let mutate=`                $script:OraclePhase = 'post-read'`;
 if(mutation==='expected-path')mutate+=`\n                $leaf.path += '.wrong'; $script:OracleMutations++`;
 if(['replace','resize','reparse','ancestor-replace'].includes(mutation)){
  mutate+=`\n                # Explicit engineering mutation: release the held leaf only to permit a controlled change Windows normally denies.\n                $leaf.handle.Dispose()`;
  if(mutation==='resize')mutate+=`\n                [IO.File]::AppendAllText($leaf.path, 'changed-size')\n                $leaf.handle = Open-Native $leaf.path $false $true`;
  if(mutation==='replace')mutate+=`\n                [IO.File]::Move($leaf.path, $leaf.path + '.old')\n                [IO.File]::Copy($leaf.path + '.replacement', $leaf.path)\n                $leaf.handle = Open-Native $leaf.path $false $true`;
  if(mutation==='reparse')mutate+=`\n                [IO.File]::Move($leaf.path, $leaf.path + '.old')\n                [IO.File]::Move($leaf.path + '.replacement', $leaf.path)\n                $leaf.handle = Open-Native $leaf.path $false $true`;
  if(mutation==='ancestor-replace')mutate+=`\n                $parent = [IO.Path]::GetDirectoryName($leaf.path)\n                [IO.Directory]::Move($parent, $parent + '.old')\n                [IO.Directory]::Move($parent + '.replacement', $parent)`;
  mutate+=`\n                $script:OracleMutations++`;
 }
 insert('                Assert-ChainStable $chain',mutate);
 insert('                $encoded = [Convert]::ToBase64String($data, 0, $used)',"                $script:OraclePhase = 'initial'");
 insert('        foreach ($chain in $rootChains.Values) { Assert-ChainStable $chain }',"        $script:OraclePhase = 'root-post'");
 insert('exit 0',`$oracleProcess = [Diagnostics.Process]::GetCurrentProcess(); $oracleProcess.Refresh()\n$oracleTelemetry = [ordered] @{ phase = $script:OraclePhase; counters = $script:OracleCounts; mutations = $script:OracleMutations; mutation = $script:OracleMutation; workingSet64 = $oracleProcess.WorkingSet64; peakWorkingSet64 = $oracleProcess.PeakWorkingSet64; managedBytes = [GC]::GetTotalMemory($false) }\n[IO.File]::WriteAllText(${psString(path.resolve(telemetryPath))}, ($oracleTelemetry | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))`);
 let recovered=s;for(const b of blocks)recovered=recovered.replace(b.block,'');assert.equal(recovered,source.toString('utf8'));
 const p=output+'/'+c.name+'/'+side+'-instrumented.ps1';fs.writeFileSync(p,s,{flag:'wx'});write(output+'/'+c.name+'/'+side+'-instrumentation.json',{kind:'MO1307SerializationSecurityEngineeringInstrumentation',original:side==='c3rb'?sourceBindings[0]:sourceBindings[1],copy:pin(p),reversibleAdditions:true,blocks:blocks.map(b=>({needle:b.needle,insertedBytes:Buffer.byteLength(b.block),sha256:hash(Buffer.from(b.block))})),productionHooks:false,mutation,securityObservationCallsRetained:true});return p;
}
function resetMutation(c){
 if(!['replace','resize','reparse','ancestor-replace'].includes(c.mutation))return;
 const input=safe(c.request.roots[0].path),leaf=safe(path.join(input,'leaf.data'));
 // No recursive removal/move: exact owned files/directories are retained by rename.
 const previous=input+'.previous-'+crypto.randomBytes(4).toString('hex');
 if(c.mutation==='ancestor-replace'){
  if(fs.existsSync(input)){fs.renameSync(input,safe(previous));}fs.mkdirSync(input);fs.writeFileSync(leaf,data);
  if(fs.existsSync(input+'.old'))fs.renameSync(input+'.old',safe(previous+'-old'));
  if(fs.existsSync(input+'.replacement'))fs.renameSync(input+'.replacement',safe(previous+'-replacement'));
  fs.mkdirSync(input+'.replacement');fs.writeFileSync(input+'.replacement/leaf.data',data);return;
 }
 for(const name of ['leaf.data','leaf.data.old','leaf.data.replacement']){const p=safe(path.join(input,name));if(fs.existsSync(p)||(()=>{try{return fs.lstatSync(p).isSymbolicLink();}catch{return false;}})())fs.renameSync(p,safe(p+'.retained-'+crypto.randomBytes(4).toString('hex')));}
 fs.writeFileSync(leaf,data);
 if(c.mutation==='replace')fs.writeFileSync(leaf+'.replacement',data);
 if(c.mutation==='reparse'){const target=safe(path.join(input,'replacement-target.data'));if(!fs.existsSync(target))fs.writeFileSync(target,data);fs.symlinkSync(target,leaf+'.replacement','file');}
}
let actualHelperInvocations=0,currentCase=null,currentSide=null;
async function launch(script,bytes,prefix){
 const at=performance.now();let timeout=false,exitAt=null,closeAt=null,pid=null,launchError=null,capViolation=null;const out=[],err=[];let total=0,errorTotal=0;const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve(script)];
 const result=await new Promise(resolve=>{const child=spawn(ps,args,{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true,stdio:['pipe','pipe','pipe']});pid=child.pid??null;
  if(pid!==null)actualHelperInvocations++;
  let killTimer=null;const stop=()=>{child.kill();if(killTimer===null)killTimer=setTimeout(()=>{clearTimeout(timer);resolve({code:null,signal:null,cleanupUnconfirmed:true});},2000);};
  const timer=setTimeout(()=>{timeout=true;stop();},20000);
  child.once('error',error=>{launchError={message:error.message,code:error.code??null};stop();});
  child.stdout.on('data',b=>{const remaining=16777216-total;total+=b.length;if(remaining>0)out.push(b.subarray(0,remaining));if(total>16777216){capViolation='stdout';stop();}});
  child.stderr.on('data',b=>{const remaining=4096-errorTotal;errorTotal+=b.length;if(remaining>0)err.push(b.subarray(0,remaining));if(errorTotal>4096){capViolation='stderr';stop();}});child.stdin.on('error',()=>{});
  child.once('exit',()=>{exitAt=performance.now();});child.once('close',(code,signal)=>{closeAt=performance.now();clearTimeout(timer);clearTimeout(killTimer);resolve({code,signal});});
  child.stdin.end(bytes);});
 const stdout=Buffer.concat(out),stderr=Buffer.concat(err);fs.writeFileSync(prefix+'.stdout.bin',stdout,{flag:'wx'});fs.writeFileSync(prefix+'.stderr.bin',stderr,{flag:'wx'});
 const row={...result,pid,elapsedMs:(closeAt??performance.now())-at,exitMs:exitAt===null?null:exitAt-at,closeObserved:closeAt!==null,pipesClosed:closeAt!==null,engineeringGuardExpired:timeout,launchError,capViolation,totalStdoutBytesObserved:total,totalStderrBytesObserved:errorTotal,stdout:pin(prefix+'.stdout.bin'),stderr:pin(prefix+'.stderr.bin'),helperSource:pin(script),launch:{executable:ps,args,environment:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true},timingIsEngineeringOnly:true,cleanupScope:'Direct helper exit and stdio close plus source-bound unchanged console-quiescence prerequisite to valid response emission; no separate native console census or product supervisor timing claim.'};
 write(prefix+'.receipt.json',row);assert.equal(timeout,false,'engineering guard expired');assert.equal(launchError,null,'helper launch error');assert.equal(capViolation,null,'captured stream exceeds cap');assert.equal(result.cleanupUnconfirmed,undefined,'direct-child cleanup unconfirmed');assert.equal(result.code,0,stderr.toString());assert.equal(result.signal,null);assert.equal(stderr.length,0);assert.ok(exitAt!==null&&closeAt!==null);return{row,stdout};
}
let result='PASS',failure=null;const rows=[],started=performance.now();
try{
 for(const c of cases){currentCase=c.name;fs.mkdirSync(output+'/'+c.name);fs.writeFileSync(output+'/'+c.name+'/request.bin',c.bytes,{flag:'wx'});const pair=[];
  for(const [side,script,source] of [['c3rb',oldPath,oldBytes],['candidate',candidatePath,newBytes]]){
   currentSide=side;
   resetMutation(c);const telemetry=output+'/'+c.name+'/'+side+'-telemetry.json';const selected=c.instrument?instrument(source,side,c,telemetry):script;
   const run=await launch(selected,c.bytes,output+'/'+c.name+'/'+side);let response;assert.ok(run.stdout.length>=4);assert.equal(run.stdout.readUInt32BE(0),run.stdout.length-4);response=JSON.parse(run.stdout.subarray(4));assert.deepEqual(run.stdout,frame(response));assert.equal(response.code,c.expectedCode,'STOP: unexpected helper code '+c.name+' '+side);assert.equal(response.status,c.expectedStatus);
   if(c.expectedRootId){assert.equal(response.roots.length,1);assert.equal(response.roots[0].id,c.expectedRootId);assert.equal(response.files.length,0);}
   if(!c.expectedCode){const request=decodeHelperRequest(c.bytes);decodeHelperResponse(run.stdout,request);for(const f of response.files){const descriptor=request.files.find(x=>x.id===f.id),r=request.roots.find(x=>x.id===descriptor.root);assert.deepEqual(Buffer.from(f.bytes.join(''),'base64'),fs.readFileSync(path.join(r.path,descriptor.path)));}}
   pair.push({...run,response,telemetry:c.instrument?JSON.parse(fs.readFileSync(telemetry)):null});
  }
  assert.deepEqual(pair[0].stdout,pair[1].stdout,'STOP: unexpected exact response drift '+c.name);
  if(c.instrument){assert.deepEqual(pair[0].telemetry.counters,pair[1].telemetry.counters,'STOP: native observation count drift '+c.name);assert.equal(pair[0].telemetry.mutations,c.mutation?1:0);assert.equal(pair[1].telemetry.mutations,c.mutation?1:0);}
  const row={name:c.name,result:'PASS',scope:c.scope,tags:c.tags,mutation:c.mutation,expectedCode:c.expectedCode,expectedStatus:c.expectedStatus,expectedRootId:c.expectedRootId,exactResponseEqual:true,code:pair[1].response.code,status:pair[1].response.status,request:pin(output+'/'+c.name+'/request.bin'),c3rb:pair[0].row,candidate:pair[1].row,
   nativeObservationCountsEqual:c.instrument?true:null,telemetry:c.instrument?{c3rb:{...pair[0].telemetry,source:pin(output+'/'+c.name+'/c3rb-telemetry.json')},candidate:{...pair[1].telemetry,source:pin(output+'/'+c.name+'/candidate-telemetry.json')}}:null};rows.push(row);write(output+'/'+c.name+'/comparison.json',row);console.log(JSON.stringify({name:c.name,result:'PASS',scope:c.scope}));
 }
 for(const p of sourceBindings)check(p);
}catch(error){result='FAIL';failure={case:currentCase,side:currentSide,message:error.message,code:error.code??null,stack:error.stack};}
const preservationFailures=[];for(const p of sourceBindings){try{check(p);}catch(error){preservationFailures.push({path:p.path,message:error.message});}}
if(preservationFailures.length){result='FAIL';failure??={case:currentCase,side:currentSide,message:'Source/input preservation failed'};}
write(output+'/receipt.json',{kind:'MO1307SerializationSecurityEquivalence',version:'1.0.0',result,failure,sourceBindings,sourceAndInputBindingsUnchanged:preservationFailures.length===0,preservationFailures,campaign:pin(output+'/campaign.json'),retainedCandidate:pin(output+'/candidate-windows-inspect.ps1'),cases:rows,expectedCases:cases.length,plannedNativeHelperInvocations:88,actualNativeHelperInvocations:actualHelperInvocations,unexecutedNativeHelperInvocations:88-actualHelperInvocations,elapsedMs:performance.now()-started,
 exactFramesCompared:true,productDeadlinesChanged:false,productHooksAdded:false,performanceAcceptance:false,originalRootsForMO1306AndReady:true,
 freshnessScope:'Native observations remain real and counted. Explicit observation-field injections are synthetic and labeled. Controlled filesystem replacement/size/reparse tests release the checked leaf in engineering copies solely to permit mutations that production read-sharing normally blocks; no such hook exists in production. Ancestor replacement preserves held ancestor handles.',
 observationMemoryScope:'Instrumented process current/peak working set and managed bytes are observations including observer overhead; no hard RSS enforcement or isolated allocation attribution claimed.',
 productionAllocationAnalysis:'This corpus compares observed process memory only. It does not isolate closed-writer allocation or claim zero additional allocation; implementation/source analysis is separate.',
 allFailuresRetained:true,noSourceWorktreeWrites:true,network:false});
console.log(JSON.stringify({result,cases:rows.length,expectedCases:cases.length,failure}));process.exitCode=result==='PASS'?0:1;
