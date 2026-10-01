import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  evidence, tools, root, writeBytes, record, read, gitBlob, gitObjectRecord,
  deterministicBytes, hash, capturePathState, captureTree, checkPathState,
  checkTree, identityCore, captureChain, responseIdentityCore, nodeExe, powershellExe,
} from './common.mjs';
import {
  encodeHelperRequest, decodeHelperRequest, encodeHelperResponse,
} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import {parseCliArgs} from '../../../memoryos-readiness/src/cli-args.mjs';
import {parseCanonical} from '../../../memoryos-readiness/src/canonical.mjs';
import {summaryProjection} from '../../../memoryos-readiness/src/projections.mjs';
import {DEFINITIONS} from '../../../memoryos-readiness/src/constants.mjs';

export const cache=path.join(root,'.cache','mo1307-replacement-helper-bound-characterization');
export const maximumRoot=path.join(root,'.cache','mo1307','phase1','characterization-inputs','maximum');
const histCommit='6d444e323f8048712908eaff22712eeac8a4e6b3';
const histPlanPath='repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/sample-plan.json';
const pendingName='memoryos-readiness-result.json.pending';
const finalName='memoryos-readiness-result.json';
const session=n=>createHash('sha256').update('MO1307-RHBC-CLASS-'+String(n).padStart(2,'0')).digest('hex');
const controlSession=id=>createHash('sha256').update('MO1307-RHBC-SEQUENCE-'+id).digest('hex');
const request=(n,operation,sequence,roots,files)=>({kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:session(n),operation,sequence,roots,files});
function put(p,bytes){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes,{flag:'wx'});}
function file(rootPath,relative,bytes){const p=path.join(rootPath,...relative.split('/'));put(p,bytes);return p;}
function bindRequest(owner,bytes){
  const p=owner.startsWith('class-')?`${evidence}/requests/${owner}.bin`:`${evidence}/sequence-requests/${owner}.bin`;
  const rec=writeBytes(p,bytes),value=decodeHelperRequest(bytes);
  assert.ok(encodeHelperRequest(value).equals(bytes),owner);
  return {record:rec,value};
}
function countChainComponents(target,leaf=null){const parsed=path.win32.parse(target);return 1+target.slice(parsed.root.length).split(/[\\/]/).filter(Boolean).length+(leaf?1:0);}
function deepestOutput(n){
  let dir=path.join(cache,'publication','c'+String(n).padStart(2,'0')),components=0;
  const admissible=candidate=>path.join(candidate,pendingName).length<=240&&countChainComponents(candidate,pendingName)<=120;
  while(admissible(path.join(dir,'a'))){dir=path.join(dir,'a');components++;}
  assert.ok(admissible(dir));assert.ok(!admissible(path.join(dir,'a')));
  fs.mkdirSync(path.dirname(dir),{recursive:true});
  return {directory:dir,addedOneCharacterComponents:components,pending:path.join(dir,pendingName),final:path.join(dir,finalName),
    pendingFullPathCodeUnits:path.join(dir,pendingName).length,pendingChainComponents:countChainComponents(dir,pendingName)};
}
function makeClass(n,q,semantic,extra={}){
  const frame=encodeHelperRequest(q),bound=bindRequest('class-'+String(n).padStart(2,'0'),frame);
  return {id:n,name:extra.name??`class-${n}`,request:bound.record,operation:q.operation,sequence:q.sequence,semantic,...extra};
}
function materializeHistorical(n,label,plan){
  const sourcePath=`repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/requests/${label}.request.bin`;
  const sourceFrame=gitBlob(histCommit,sourcePath),source=decodeHelperRequest(sourceFrame),historical=plan.cases.find(x=>x.id===label);
  assert.ok(historical);assert.equal(source.operation,'READ_SET');assert.equal(source.sequence,3);
  const originalRoot=source.roots[0].path,newRoot=path.join(cache,'fixtures','class-'+String(n).padStart(2,'0'));
  fs.mkdirSync(newRoot,{recursive:true});
  for(const declared of source.files){
    const member=historical.members.find(x=>x.id===declared.id);assert.ok(member,declared.id);
    const original=path.join(originalRoot,...declared.path.split('/')),bytes=fs.readFileSync(original);
    assert.equal(bytes.length,member.byteLength,declared.id);assert.equal(hash(bytes),member.sha256,declared.id);
    file(newRoot,declared.path,bytes);
  }
  const q={...source,session:session(n),roots:[{id:'input',path:newRoot}]};
  return {q,provenance:{classification:'RETAINED_GIT_CAMPAIGN_MATERIALIZED',commit:histCommit,
    samplePlan:gitObjectRecord(histCommit,histPlanPath),case:historical,sourceRequest:gitObjectRecord(histCommit,sourcePath),
    transformation:{allowed:['session','roots[0].path'],contentMembers:'EXACT_HASH_AND_LENGTH'}}};
}

export function buildFixtures(){
  assert.equal(fs.existsSync(cache),false,'characterization cache must not preexist');
  fs.mkdirSync(cache,{recursive:true});
  const plan=JSON.parse(gitBlob(histCommit,histPlanPath).toString('utf8')),classes=[];
  for(const [n,label,files,total] of [[1,'A',1,53],[2,'B',19,19711],[3,'C',65,2004208]]){
    const {q,provenance}=materializeHistorical(n,label,plan);
    assert.equal(q.files.length,files);assert.equal(q.files.reduce((sum,f)=>sum+fs.statSync(path.join(q.roots[0].path,...f.path.split('/'))).size,0),total);
    classes.push(makeClass(n,q,{status:'OK',code:null},{name:n===1?'read-set-one-53':n===2?'read-set-representative-19':'read-set-retained-65',provenance}));
  }
  {
    const n=4,r=path.join(cache,'fixtures','class-04'),files=[];fs.mkdirSync(r,{recursive:true});
    for(let i=0;i<128;i++){const id='f'+String(i).padStart(3,'0'),rel=id+'.bin',size=i<4?2097152:0;file(r,rel,deterministicBytes(size,'class04-'+id));files.push({id,maxBytes:size,path:rel,root:'input'});}
    classes.push(makeClass(n,request(n,'READ_SET',3,[{id:'input',path:r}],files),{status:'OK',code:null},{name:'read-set-maximum-128-8mib',provenance:{classification:'DETERMINISTIC_GENERATOR',labels:'class04-f000..f127',aggregateBytes:8388608}}));
  }
  {
    const n=5,sourcePath='repositories/cca-conformance/evidence/mo1307/missing-leaf-lifecycle/diagnostic-preparation-2/request.bin',frame=read(sourcePath),q=decodeHelperRequest(frame);
    assert.equal(frame.length,370);assert.equal(hash(frame),'sha256:bc7fc31df72889016b27af48de1693cddadf3181d2f763d78d1ddec73b24c5ee');
    const responsePath='repositories/cca-conformance/evidence/mo1307/missing-leaf-lifecycle/diagnostic-preparation-2/expected-response.bin';
    assert.equal(q.roots.length,1);assert.equal(capturePathState(q.roots[0].path,{content:false}).type,'DIRECTORY');
    assert.equal(capturePathState(path.join(q.roots[0].path,...q.files[0].path.split('/'))).exists,false);
    const bound=bindRequest('class-05',frame);classes.push({id:n,name:'exact-current-missing-leaf',request:bound.record,operation:q.operation,sequence:q.sequence,
      semantic:{status:'ERROR',code:'MO1307_INPUT',exactResponse:record(responsePath)},provenance:{classification:'EXACT_CURRENT_GIT_FRAME',request:record(sourcePath),response:record(responsePath)}});
  }
  {
    const n=6,r=path.join(cache,'fixtures','class-06'),files=[];fs.mkdirSync(r,{recursive:true});
    for(let i=0;i<127;i++){const id='f'+String(i).padStart(3,'0'),rel=id+'.bin';file(r,rel,Buffer.from([i%251]));files.push({id,maxBytes:1,path:rel,root:'input'});}files.push({id:'zmissing',maxBytes:1,path:'zmissing.bin',root:'input'});
    classes.push(makeClass(n,request(n,'READ_SET',3,[{id:'input',path:r}],files),{status:'ERROR',code:'MO1307_INPUT'},{name:'read-set-127-then-missing',provenance:{classification:'DETERMINISTIC_GENERATOR'}}));
  }
  {
    const n=7,r=path.join(cache,'fixtures','class-07'),files=[];fs.mkdirSync(r,{recursive:true});
    for(let i=0;i<127;i++){const id='f'+String(i).padStart(3,'0'),rel=id+'.bin';file(r,rel,Buffer.from([i%251]));files.push({id,maxBytes:1,path:rel,root:'input'});}
    const target=path.join(r,'reparse-target');fs.mkdirSync(target);file(target,'leaf.bin',Buffer.from([7]));
    let parent=r,parts=[];const admissible=more=>{const rel=[...parts,...more,'j','leaf.bin'].join('/'),full=path.join(r,...rel.split('/'));return rel.length<=180&&full.length<=240&&countChainComponents(full)<=120;};
    while(admissible(['a'])){parts.push('a');parent=path.join(parent,'a');fs.mkdirSync(parent);}
    const link=path.join(parent,'j');fs.symlinkSync(target,link,'junction');const rel=[...parts,'j','leaf.bin'].join('/');files.push({id:'zreparse',maxBytes:1,path:rel,root:'input'});
    assert.equal(admissible([]),true);assert.equal(admissible(['a']),false);
    classes.push(makeClass(n,request(n,'READ_SET',3,[{id:'input',path:r}],files),{status:'ERROR',code:'MO1307_FILESYSTEM_BOUNDARY'},{name:'read-set-127-then-deep-reparse',
      reparse:{type:'junction',link,target,linkState:capturePathState(link),targetState:capturePathState(target,{content:false}),relative:rel,relativeChars:rel.length,fullPathCodeUnits:path.join(r,...rel.split('/')).length,chainComponents:countChainComponents(path.join(r,...rel.split('/')))},provenance:{classification:'DETERMINISTIC_GENERATOR'}}));
  }
  {
    const n=8,r=path.join(cache,'fixtures','class-08');fs.mkdirSync(r,{recursive:true});file(r,'authority.bin',deterministicBytes(1048576,'class08-authority'));file(r,'config.bin',deterministicBytes(16384,'class08-config'));
    classes.push(makeClass(n,request(n,'READ_SET',1,[{id:'input',path:r}],[{id:'authority',maxBytes:1048576,path:'authority.bin',root:'input'},{id:'config',maxBytes:16384,path:'config.bin',root:'input'}]),{status:'OK',code:null},{name:'sequence1-exact-caps',provenance:{classification:'DETERMINISTIC_GENERATOR'}}));
  }
  {
    const n=9,r=path.join(cache,'fixtures','class-09');fs.mkdirSync(r,{recursive:true});file(r,'candidate.bin',deterministicBytes(524288,'class09-candidate'));file(r,'manifest.bin',deterministicBytes(262144,'class09-manifest'));
    classes.push(makeClass(n,request(n,'READ_SET',2,[{id:'input',path:r}],[{id:'candidate',maxBytes:524288,path:'candidate.bin',root:'input'},{id:'manifest',maxBytes:262144,path:'manifest.bin',root:'input'}]),{status:'OK',code:null},{name:'sequence2-exact-caps',provenance:{classification:'DETERMINISTIC_GENERATOR'}}));
  }
  {
    const n=10,ri=path.join(cache,'fixtures','class-10-input'),rr=path.join(cache,'fixtures','class-10-result');fs.mkdirSync(ri,{recursive:true});fs.mkdirSync(rr,{recursive:true});file(ri,'decision.bin',deterministicBytes(8192,'class10-decision'));file(rr,'result.bin',deterministicBytes(4194304,'class10-result'));
    classes.push(makeClass(n,request(n,'READ_SET',4,[{id:'input',path:ri},{id:'result',path:rr}],[{id:'decision',maxBytes:8192,path:'decision.bin',root:'input'},{id:'result',maxBytes:4194304,path:'result.bin',root:'result'}]),{status:'OK',code:null},{name:'verify-sequence4-exact-caps',provenance:{classification:'DETERMINISTIC_GENERATOR'}}));
  }
  const slot5Path='repositories/cca-conformance/evidence/mo1307/slot5-deadline-correction/performance/retained-exact-slot5-former-failure/request.bin';
  const slot5Frame=read(slot5Path),slot5=decodeHelperRequest(slot5Frame);assert.equal(slot5Frame.length,294);assert.equal(hash(slot5Frame),'sha256:71a9040815c137ac0980f9e985c1a03e23dfd57873f5940ba393f36d64113dad');
  assert.equal(slot5.kind,'MemoryOSReadinessHelperRequest');assert.equal(slot5.version,'2.0.0');assert.equal(slot5.operation,'CHECK_OUTPUT');assert.equal(slot5.sequence,5);assert.equal(slot5.files.length,0);assert.equal(slot5.roots.length,1);assert.equal(slot5.roots[0].id,'output');
  const pendingPayload=deterministicBytes(4194304,'classes16-18-identical-pending');
  for(const n of [11,12,13,14,15,16,17,18]){
    const deep=deepestOutput(n);let operation,sequence,expected;
    if(n===11){operation='CHECK_OUTPUT';sequence=4;expected={status:'ABSENT',code:null};}
    if(n===12){operation='CHECK_OUTPUT';sequence=5;expected={status:'ABSENT',code:null};}
    if(n===13){operation='CHECK_OUTPUT';sequence=4;fs.mkdirSync(deep.directory);expected={status:'ERROR',code:'MO1307_FILESYSTEM_BOUNDARY'};}
    if(n===14){operation='INSPECT_OUTPUT_ROOT';sequence=6;fs.mkdirSync(deep.directory);expected={status:'OK',code:null};}
    if(n===15){operation='CHECK_STAGE_ROOT';sequence=7;fs.mkdirSync(deep.directory);expected={status:'OK',code:null};}
    if([16,17,18].includes(n)){fs.mkdirSync(deep.directory);file(deep.directory,pendingName,pendingPayload);}
    if(n===16){operation='INSPECT_PENDING';sequence=8;expected={status:'OK',code:null};}
    if(n===17){operation='CHECK_FINALIZATION';sequence=9;expected={status:'FINAL_ABSENT',code:null};}
    if(n===18){file(deep.directory,finalName,Buffer.from('present'));operation='CHECK_FINALIZATION';sequence=9;expected={status:'ERROR',code:'MO1307_FILESYSTEM_BOUNDARY'};}
    const q=request(n,operation,sequence,[{id:'output',path:deep.directory}],[]),provenance=n===12?{classification:'RETAINED_TRANSFORMED',source:record(slot5Path),
      transformation:{allowed:['session','roots[0].path'],unchanged:{operation:slot5.operation,sequence:slot5.sequence,files:slot5.files,status:'ABSENT'}}}:{classification:'DETERMINISTIC_GENERATOR'};
    classes.push(makeClass(n,q,expected,{name:['','','','','','','','','','','check-output-seq4-absent','retained-slot5-workload-deep-root','check-output-existing-refusal','inspect-output-root','check-stage-root','inspect-pending-exact-4mib','check-finalization-same-4mib-final-absent','same-finalization-shape-final-present-refusal'][n],deepestOutput:deep,provenance}));
  }
  classes.sort((a,b)=>a.id-b.id);assert.equal(classes.length,18);classes.forEach((c,i)=>assert.equal(c.id,i+1));
  return {classes,cache,history:{commit:histCommit,samplePlan:gitObjectRecord(histCommit,histPlanPath)},pendingPayload:{byteLength:pendingPayload.length,sha256:hash(pendingPayload)}};
}

function exactError(owner,q,code){
  const value={kind:'MemoryOSReadinessHelperResponse',version:'2.0.0',session:q.session,sequence:q.sequence,operation:q.operation,status:'ERROR',code,roots:[],files:[]};
  const bytes=encodeHelperResponse(value,q),p=`${evidence}/expected-responses/${owner}.bin`,rec=writeBytes(p,bytes);return {mode:'EXACT_FRAME',response:rec};
}
function sealedReadSet(q){
  const roots=q.roots.map(r=>{const state=capturePathState(r.path,{content:false});return {id:r.id,path:r.path,state,identity:identityCore(state,{directory:true})};});
  const rootMap=new Map(q.roots.map(r=>[r.id,r.path]));
  const files=q.files.map(f=>{const p=path.join(rootMap.get(f.root),...f.path.split('/')),state=capturePathState(p);assert.equal(state.exists,true,p);return {id:f.id,root:f.root,relative:f.path,maxBytes:f.maxBytes,path:p,byteLength:state.byteLength,sha256:state.sha256,identity:identityCore(state)};});
  return {mode:'SEALED_READ_SET',roots,files,aggregateBytes:files.reduce((n,f)=>n+f.byteLength,0)};
}
function sealedPublication(q){
  const output=q.roots[0].path;let rootId,chain;
  if(q.operation==='CHECK_OUTPUT'){rootId='output-parent';chain=captureChain(path.win32.dirname(output));}
  else if(['INSPECT_PENDING','CHECK_FINALIZATION'].includes(q.operation)){rootId='pending';chain=captureChain(output,pendingName);}
  else{rootId='output';chain=captureChain(output);}
  return {mode:'SEALED_PUBLICATION_CHAIN',rootId,chain,rule:'Exact sealed native identity for every chain member, including attributes and directory byte length; production decoding also validates component spelling.'};
}
function expectedFor(owner,q,semantic,{dynamic=false}={}){
  const base={status:semantic.status,code:semantic.code,operation:q.operation,sequence:q.sequence,session:q.session,files:q.operation==='READ_SET'?q.files.length:0};
  if(semantic.status==='ERROR'){const exact=exactError(owner,q,semantic.code);if(semantic.exactResponse){assert.equal(exact.response.byteLength,semantic.exactResponse.byteLength);assert.equal(exact.response.sha256,semantic.exactResponse.sha256);}return {...base,...exact};}
  if(q.operation==='READ_SET')return {...base,...sealedReadSet(q)};
  if(dynamic)return {...base,mode:'RELATIONAL_PUBLICATION_CHAIN',rootId:['INSPECT_PENDING','CHECK_FINALIZATION'].includes(q.operation)?'pending':'output',
    rule:q.sequence===6?'Extend the exact sealed sequence-5 parent chain by one newly created output-directory identity.':q.sequence===7?'Exact stable equality with the sequence-6 output chain.':q.sequence===8?'Extend the exact stable output chain by one pending-file identity whose bytes equal the sealed worker result.':'Exact stable equality with the sequence-8 pending chain and final destination absent.'};
  return {...base,...sealedPublication(q)};
}

function generateMaximum(){
  assert.equal(fs.existsSync(maximumRoot),false,'maximum fixture cache must not preexist');
  fs.mkdirSync(path.dirname(maximumRoot),{recursive:true});
  const sourceCommit='7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee',sourcePath='repositories/cca-conformance/tools/mo1307-phase1/generate-fixtures.mjs',
    generator=tools+'/retained-generate-fixtures.mjs',bindingPath='repositories/cca-conformance/evidence/mo1307/phase1/characterization/maximum/input-binding.json',binding=JSON.parse(read(bindingPath)),
    source=gitObjectRecord(sourceCommit,sourcePath),materialized=record(generator);
  assert.equal(source.byteLength,binding.generator.byteLength);assert.equal(source.sha256,binding.generator.sha256);assert.equal(materialized.byteLength,binding.generator.byteLength);assert.equal(materialized.sha256,binding.generator.sha256);
  const relative=path.relative(root,maximumRoot).replaceAll('\\','/');
  const run=spawnSync(nodeExe,[generator,'--maximum-dir',relative],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
  assert.ifError(run.error);assert.equal(run.status,0,run.stderr);
  for(const f of binding.files){const actual=record(path.join(maximumRoot,...f.path.split('/')));assert.equal(actual.byteLength,f.byteLength,f.path);assert.equal(actual.sha256,f.sha256,f.path);}
  return {root:maximumRoot,binding:record(bindingPath),generator:materialized,generatorSource:source,generatorStdout:run.stdout.trim(),tree:captureTree(maximumRoot)};
}
function launchFor(command,inputRoot,otherRoot){
  const pins=JSON.parse(fs.readFileSync(path.join(inputRoot,'pins.json'),'utf8'));
  const argv=[command,'--input-root',inputRoot,'--config','configuration.json','--authority','authority.json','--authority-sha256',pins.trustedAuthorityDigest,'--candidate-sha256',pins.expectedCandidateDigest,command==='evaluate'?'--output-root':'--result-root',otherRoot,'--format','json'];
  return {argv,launch:parseCliArgs(argv),pins};
}
function buildControlRequests(control){
  const {launch,session}=control,config=JSON.parse(fs.readFileSync(path.join(launch.inputRoot,launch.config),'utf8')),
    manifest=JSON.parse(fs.readFileSync(path.join(launch.inputRoot,config.manifest),'utf8')),
    input=[{id:'input',path:launch.inputRoot}];
  const values=[
    {kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence:1,operation:'READ_SET',roots:input,files:[{id:'authority',maxBytes:DEFINITIONS.limits.authorityBytes,path:launch.authority,root:'input'},{id:'config',maxBytes:DEFINITIONS.limits.configurationBytes,path:launch.config,root:'input'}]},
    {kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence:2,operation:'READ_SET',roots:input,files:[{id:'candidate',maxBytes:DEFINITIONS.limits.candidateBytes,path:config.candidate,root:'input'},{id:'manifest',maxBytes:DEFINITIONS.limits.manifestBytes,path:config.manifest,root:'input'}]},
    {kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence:3,operation:'READ_SET',roots:input,files:manifest.entries.map(e=>({id:e.id,maxBytes:e.type==='ENVELOPE'?DEFINITIONS.limits.envelopeBytes:DEFINITIONS.limits.rawSourceBytes,path:e.path,root:'input'}))},
  ];
  if(control.command==='evaluate'){
    values.push({kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence:4,operation:'CHECK_OUTPUT',roots:[{id:'output',path:launch.outputRoot}],files:[]});
    for(const [operation,sequence] of [['CHECK_OUTPUT',5],['INSPECT_OUTPUT_ROOT',6],['CHECK_STAGE_ROOT',7],['INSPECT_PENDING',8],['CHECK_FINALIZATION',9]])values.push({kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence,operation,roots:[{id:'output',path:launch.outputRoot}],files:[]});
  }else values.push({kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence:4,operation:'READ_SET',roots:[{id:'result',path:launch.resultRoot}],files:[{id:'result',maxBytes:DEFINITIONS.limits.resultBytes,path:finalName,root:'result'}]});
  return values;
}

export function buildSequenceControls(){
  const maximum=generateMaximum(),productionRoot=path.join(root,'repositories','cca-conformance','fixtures','mo1307','bundles','ready'),controls=[];
  for(let cycle=1;cycle<=4;cycle++)for(const kind of ['production-evaluate','maximum-evaluate','production-verify','maximum-verify']){
    const ordinal=controls.length+1,id='control-'+String(ordinal).padStart(2,'0'),command=kind.endsWith('evaluate')?'evaluate':'verify',maximumKind=kind.startsWith('maximum'),inputRoot=maximumKind?maximumRoot:productionRoot,
      base=path.join(cache,'sequence-controls',id),otherRoot=path.join(base,command==='evaluate'?'output':'result');
    fs.mkdirSync(base,{recursive:true});
    if(command==='verify'){fs.mkdirSync(otherRoot);fs.copyFileSync(path.join(inputRoot,'expected-result.json'),path.join(otherRoot,finalName));}
    else assert.equal(fs.existsSync(otherRoot),false);
    const parsed=launchFor(command,inputRoot,otherRoot),control={ordinal,id,cycle,kind,command,maximum:maximumKind,session:controlSession(id),...parsed};
    const values=buildControlRequests(control),helpers=[];
    for(const q of values){const owner=`${id}/seq-${String(q.sequence).padStart(2,'0')}`,bound=bindRequest(owner,encodeHelperRequest(q)),dynamic=command==='evaluate'&&q.sequence>=6,
      semantic={status:q.operation==='CHECK_OUTPUT'?'ABSENT':q.operation==='CHECK_FINALIZATION'?'FINAL_ABSENT':'OK',code:null};
      helpers.push({ordinal:helpers.length+1,sequence:q.sequence,operation:q.operation,request:bound.record,expected:expectedFor(id+'-seq-'+String(q.sequence).padStart(2,'0'),q,semantic,{dynamic})});}
    const result=record(path.join(inputRoot,'expected-result.json')),resultValue=parseCanonical(read(result.path),{maxBytes:DEFINITIONS.limits.resultBytes,stage:'EVALUATION'}),stdoutBytes=summaryProjection(resultValue,command,null),stdout=writeBytes(`${evidence}/sequence-stdout/${id}.bin`,stdoutBytes);
    Object.assign(control,{helperLaunches:helpers.length,helpers,expected:{result,stdout,exitCode:command==='evaluate'?parsed.pins.expectedExit:0,committed:command==='evaluate'},
      initialState:command==='evaluate'?{output:capturePathState(otherRoot)}:{resultTree:captureTree(otherRoot)},
      expectedFinal:command==='evaluate'?{final:{byteLength:result.byteLength,sha256:result.sha256},pendingAbsent:true}:null,
      bundle:{root:inputRoot,kind:maximumKind?'MAXIMUM_ADMITTED_VALID':'PRODUCTION_READY'},
      limits:{helperMs:'FROZEN_H',helperAggregateMs:20000,cliAdmissionMs:30000,workerApiMs:10000,cleanupMs:2000},worker:{kind:'REAL_PRODUCTION_WORKER_THREAD',entry:'repositories/memoryos-readiness/src/worker-entry.mjs',oldHeapMiB:128,youngHeapMiB:16}});
    controls.push(control);
  }
  assert.equal(controls.length,16);assert.equal(controls.reduce((n,c)=>n+c.helperLaunches,0),104);
  return {controls,maximum,productionBundle:{root:productionRoot,tree:captureTree(productionRoot)}};
}

export function buildFixtureLedger(classes,sequence){
  const requests=[],treeMap=new Map(),predicates=[];
  const addTree=p=>{const key=path.resolve(p).toLowerCase();if(!treeMap.has(key))treeMap.set(key,captureTree(p));};
  for(const c of classes){
    const q=decodeHelperRequest(read(c.request.path));assert.equal(q.operation,c.operation);assert.equal(q.sequence,c.sequence);
    for(const r of q.roots){const state=capturePathState(r.path,{content:false});if(state.exists)addTree(r.path);else{predicates.push({scope:'IMMUTABLE',state});addTree(path.dirname(r.path));}}
    for(const f of q.files){const rootPath=q.roots.find(r=>r.id===f.root).path,p=path.join(rootPath,...f.path.split('/'));if(!fs.existsSync(p))predicates.push({scope:'IMMUTABLE',state:capturePathState(p)});}
    const expected=expectedFor('class-'+String(c.id).padStart(2,'0'),q,c.semantic);c.expected=expected;
    requests.push({owner:'class-'+String(c.id).padStart(2,'0'),request:c.request,decoded:{operation:q.operation,sequence:q.sequence,session:q.session,roots:q.roots,files:q.files},expected,provenance:c.provenance});
  }
  for(const control of sequence.controls){addTree(control.bundle.root);if(control.command==='verify')addTree(control.launch.resultRoot);else predicates.push({scope:'CONTROL_INITIAL',controlId:control.id,state:control.initialState.output});for(const h of control.helpers)requests.push({owner:`${control.id}/seq-${String(h.sequence).padStart(2,'0')}`,request:h.request,decoded:decodeHelperRequest(read(h.request.path)),expected:h.expected,provenance:{classification:'SEALED_COMPLETE_SEQUENCE_FRAME',control:control.id,kind:control.kind}});}
  assert.equal(requests.length,122);assert.equal(requests.filter(r=>r.owner.startsWith('class-')).length,18);
  return {kind:'MO1307ReplacementBoundFixtureLedger',version:'1.0.0',fixtureSets:[...treeMap.values()],pathPredicates:predicates,
    requests,counts:{classRequests:18,sequenceRequests:104,totalRequests:122,fixtureSets:treeMap.size,pathPredicates:predicates.length},
    maximumBinding:sequence.maximum.binding,maximumGenerator:sequence.maximum.generator,
    maximumGeneratorSource:sequence.maximum.generatorSource,
    expectedIdentityModes:['EXACT_FRAME','FULL_SEALED_NATIVE_IDENTITY','RELATIONAL_FULL_NATIVE_IDENTITY']};
}
function expectedIdentities(ledger){
  const rows=[];const visit=value=>{if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;
    if(typeof value.volumeSerial==='string'&&typeof value.fileId==='string'&&typeof value.finalPath==='string'&&typeof value.isDirectory==='boolean'&&Object.hasOwn(value,'attributes'))rows.push(value);
    else Object.values(value).forEach(visit);};
  for(const item of ledger.requests)visit(item.expected);return rows;
}
function queryAttributes(paths){
  const listBytes=Buffer.from(JSON.stringify(paths)+'\n'),listPath=path.join(cache,'expected-identity-paths.json');
  if(fs.existsSync(listPath))assert.ok(fs.readFileSync(listPath).equals(listBytes),'expected identity path list changed');else fs.writeFileSync(listPath,listBytes,{flag:'wx'});
  const quoted=listPath.replaceAll("'","''"),script=`$ErrorActionPreference='Stop';$paths=Get-Content -LiteralPath '${quoted}' -Raw|ConvertFrom-Json;$rows=@(foreach($p in $paths){$i=Get-Item -LiteralPath $p -Force;[ordered]@{path=$p;attributes=[long]$i.Attributes;byteLength=if($i.PSIsContainer){[long]0}else{[long]$i.Length};isDirectory=[bool]$i.PSIsContainer}});$rows|ConvertTo-Json -Compress`;
  const run=spawnSync(powershellExe,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});assert.ifError(run.error);assert.equal(run.status,0,run.stderr);
  const rows=JSON.parse(run.stdout.trim());assert.equal(rows.length,paths.length);return {rows,pathList:record(listPath)};
}
export function bindFullExpectedIdentities(ledger){
  const identities=expectedIdentities(ledger),paths=[...new Set(identities.map(x=>path.resolve(x.finalPath).toLowerCase()))].sort(),queried=queryAttributes(paths),byPath=new Map(queried.rows.map(x=>[path.resolve(x.path).toLowerCase(),x]));
  for(const identity of identities){const live=byPath.get(path.resolve(identity.finalPath).toLowerCase());assert.ok(live,identity.finalPath);assert.equal(identity.byteLength,live.byteLength,identity.finalPath);assert.equal(identity.isDirectory,live.isDirectory,identity.finalPath);identity.attributes=live.attributes;}
  ledger.expectedIdentityBindings=queried.rows;ledger.counts.expectedIdentityOccurrences=identities.length;ledger.counts.uniqueExpectedIdentities=paths.length;
  return {kind:'MO1307ReplacementBoundExpectedIdentityBinding',version:'1.0.0',result:'BOUND',pathList:queried.pathList,occurrences:identities.length,unique:paths.length,identities:queried.rows};
}
export function verifyFixtureLedger(ledger,{includeControlInitial=true}={}){
  const paths=ledger.expectedIdentityBindings.map(x=>x.path),live=queryAttributes(paths).rows;assert.deepEqual(live,ledger.expectedIdentityBindings,'expected native identity binding changed');
  assert.equal(ledger.requests.length,122);for(const tree of ledger.fixtureSets)checkTree(tree);for(const predicate of ledger.pathPredicates)if(predicate.scope==='IMMUTABLE'||includeControlInitial)checkPathState(predicate.state);
  for(const item of ledger.requests){checkRecord(item.request);const q=decodeHelperRequest(read(item.request.path));assert.equal(q.operation,item.decoded.operation,item.owner);assert.equal(q.sequence,item.decoded.sequence,item.owner);assert.equal(q.session,item.decoded.session,item.owner);assert.ok(encodeHelperRequest(q).equals(read(item.request.path)),item.owner);if(item.expected.mode==='EXACT_FRAME')checkRecord(item.expected.response);}
  return {result:'PASS',fixtureSets:ledger.fixtureSets.length,pathPredicates:ledger.pathPredicates.length,requests:ledger.requests.length};
}
function checkRecord(r){const b=read(r.path);assert.equal(b.length,r.byteLength,r.path);assert.equal(hash(b),r.sha256,r.path);}

export function assertExpectedResponse(response,answerBytes,expected){
  assert.equal(response.status,expected.status);assert.equal(response.code,expected.code);assert.equal(response.operation,expected.operation);assert.equal(response.sequence,expected.sequence);assert.equal(response.session,expected.session);
  if(expected.mode==='EXACT_FRAME'){assert.equal(answerBytes.length,expected.response.byteLength);assert.equal(hash(answerBytes),expected.response.sha256);return;}
  if(expected.mode==='SEALED_READ_SET'){
    assert.equal(response.roots.length,expected.roots.length);assert.equal(response.files.length,expected.files.length);
    response.roots.forEach((r,i)=>{assert.equal(r.id,expected.roots[i].id);assert.deepEqual(responseIdentityCore(r.identity),expected.roots[i].identity);});
    response.files.forEach((f,i)=>{const e=expected.files[i],bytes=Buffer.from(f.bytes.join(''),'base64');assert.equal(f.id,e.id);assert.equal(bytes.length,e.byteLength);assert.equal(hash(bytes),e.sha256);assert.deepEqual(responseIdentityCore(f.identity),e.identity);});return;
  }
  if(expected.mode==='SEALED_PUBLICATION_CHAIN'){
    assert.equal(response.files.length,0);assert.equal(response.roots.length,1);assert.equal(response.roots[0].id,expected.rootId);assert.equal(response.roots[0].chain.length,expected.chain.length);response.roots[0].chain.forEach((x,i)=>assert.deepEqual(responseIdentityCore(x),expected.chain[i]));return;
  }
  assert.equal(expected.mode,'RELATIONAL_PUBLICATION_CHAIN');assert.equal(response.files.length,0);assert.equal(response.roots.length,1);assert.equal(response.roots[0].id,expected.rootId);
}
