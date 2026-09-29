// Declare every production-helper execution before the first sample.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,evidence,baseline,hash,record,write,str} from './common.mjs';
import {encodeHelperRequest} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import {DEFINITIONS} from '../../../memoryos-readiness/src/constants.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(str('branch','--show-current'),'main');
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(fs.existsSync(path.join(root,evidence,'sample-plan.json')),false);checkPackage();
const scratch=path.join(root,'.cache','m7-helper-deadline-characterization');assert.equal(fs.existsSync(scratch),false);
const small=path.join(scratch,'input'),out=path.join(scratch,'output-parent');fs.mkdirSync(small,{recursive:true});fs.mkdirSync(out);
fs.writeFileSync(path.join(small,'leaf.data'),'MO-1307 fixed small READ_SET characterization input.\n',{flag:'wx'});
fs.writeFileSync(path.join(out,'stable-parent.data'),'Engineering-owned stable absent-output parent.\n',{flag:'wx'});
const source='C:/Users/melsa/Documents/Codex/r3a/.cache/m7f';
const authority=JSON.parse(fs.readFileSync(path.join(root,evidence,'authority-binding.json')));
const cases=[];
for(const [id,name,dir] of [['A','small READ_SET',small],['B','READY request-3 workload',source+'/v1/i'],['C','MO-1306 request-3 workload',source+'/v0/i'],['D','post-tag-absent request-3 workload surrogate',source+'/G/post-tag-absent/i'],['E','lightweight CHECK_OUTPUT',path.join(out,'absent')]]){
 const session=hash(Buffer.from('MO1307-DEADLINE-CHARACTERIZATION-'+id)).slice(7);
 const input=path.resolve(dir),isRead=id!=='E';
 const manifest=['B','C','D'].includes(id)?JSON.parse(fs.readFileSync(path.join(input,'manifest.json'))):null;
 const files=id==='E'?[]:id==='A'?[{id:'leaf',root:'input',path:'leaf.data',maxBytes:4096}]:manifest.entries.map(e=>({id:e.id,path:e.path,root:'input',maxBytes:e.type==='ENVELOPE'?DEFINITIONS.limits.envelopeBytes:DEFINITIONS.limits.rawSourceBytes}));
 const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',operation:isRead?'READ_SET':'CHECK_OUTPUT',sequence:isRead?3:4,session,roots:[{id:isRead?'input':'output',path:input}],files};
 const frame=encodeHelperRequest(request),members=files.map(f=>({id:f.id,...record(path.join(input,...f.path.split('/')))}));
 if(manifest){const prior=authority.cases.find(c=>c.case===id),{session:declaredSession,...template}=request;assert.ok(prior);assert.deepEqual(template,prior.requestTemplateWithoutSession);assert.equal(frame.length,prior.reconstructedFrameLengthWith64AsciiSession);
  assert.deepEqual(members.map(({id,path:p,byteLength,sha256})=>({id,path:path.resolve(p),byteLength,sha256})),prior.files.map(f=>({id:f.id,path:path.resolve(f.sourceRoot,f.path),byteLength:f.byteLength,sha256:f.sha256})));}
 const rel=evidence+'/requests/'+id+'.request.bin';fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),frame,{flag:'wx'});
 const aggregateBytes=members.reduce((n,f)=>n+f.byteLength,0);
 if(['B','D'].includes(id)){assert.equal(files.length,19);assert.equal(aggregateBytes,19711);}
 if(id==='C'){assert.equal(files.length,65);assert.equal(aggregateBytes,2004208);}
 cases.push({id,name,request:record(rel),operation:request.operation,sequence:request.sequence,session,root:input,fileCount:files.length,aggregateBytes,requestFrameBytes:frame.length,
  members,manifest:manifest?record(path.join(input,'manifest.json')):null,rootPathParts:input.split('\\').filter(Boolean).length,
  historicalFrameReplay:false,requestAuthority:id==='D'?'Original failed frame/session NOT_RETAINED. This is a declared new-session workload surrogate at the exact original root, not replay of its hashed frame.':manifest?'Reconstructed from retained final-generation manifest/files at original root, with declared new engineering session.':'Engineering-owned fixed representative request.'});
}
assert.deepEqual(cases[1].members.map(({id,byteLength,sha256})=>({id,byteLength,sha256})),cases[3].members.map(({id,byteLength,sha256})=>({id,byteLength,sha256})));
assert.equal(cases[3].rootPathParts,cases[1].rootPathParts+1);
const order=[];for(let round=0;round<5;round++)for(let offset=0;offset<5;offset++){const id=cases[(round+offset)%5].id;order.push({sampleId:String(order.length+1).padStart(2,'0')+'-'+id,case:id,round:round+1});}
for(const row of order)fs.mkdirSync(path.join(root,evidence,'samples',row.sampleId),{recursive:true});
const toolDir='repositories/cca-conformance/tools/mo1307-helper-deadline-characterization';
const sourceBindings=[...packageFiles.map(p=>record('repositories/memoryos-readiness/'+p)),...['common.mjs','plan.mjs','campaign.mjs','observer.py','retained-runtime-controls-observer.py.data'].map(p=>record(toolDir+'/'+p)),
 ...['authority-binding.json','contract-intent.json','deadline-source-analysis.json','runtime-environment.json'].map(p=>record(evidence+'/'+p))];
write(evidence+'/sample-plan.json',{kind:'MO1307HelperDeadlineSamplePlan',version:'1.0.0',createdAtUtc:new Date().toISOString(),baseline,maximumProductionHelperExecutions:25,plannedProductionHelperExecutions:25,observationsPerCase:5,order,cases,sourceBindings,
 actualFixedProductProcess:true,helperSourceModified:false,helperCopy:false,clockOverrides:false,deadlineChanges:false,retries:0,
 limits:{helperMs:5000,aggregateHelperMs:20000,cliMs:30000,cleanupMs:2000},
 marginLabels:{large:'margin >=1500 ms',moderate:'750 <= margin <1500 ms',thin:'0 < margin <750 ms',violation:'margin <=0 ms'},
 marginMetric:'5000 minus whole supervisor clock-origin to transport settlement; failures remain failures. Direct complete-frame and process-exit margins also reported separately.',
 statistics:{raw:'All samples retained, including timeouts/outliers.',min:true,max:true,median:true,p90:'NOT_REPORTED: five observations do not support a meaningful tail estimate.'},
 cache:'Fresh-process observations only. OS cache uncontrolled; no cache flush, restart, Defender/antivirus change, tuning or deliberate warm-up.',
 BvsD:'Identical 19 file descriptors/content bytes; D has one additional ancestor component, so native checked-chain workload differs and is retained separately. Exact failed D frame cannot be replayed because historical session/frame bytes were not retained.',
 observation:{transport:'Unchanged real supervisor and transport with a forwarding real-spawn observation seam; executable/args/options asserted exactly. No helper transform, no synthetic process, no timeout override.',
  observer:'Separate read-only engineering Python monitor; not product architecture. Query-only retained Win32 process handles,50ms polling,measured overhead,300s total guard,2s observation-only settlement. It never terminates product processes.',
  T3:'NOT_OBSERVABLE: pipe write completion does not demonstrate helper read readiness.',bootstrap:'NOT_OBSERVABLE as an isolated duration; lightweight whole-lifecycle comparison is only indirect evidence.',
  privateSequence:'Standalone request samples measure the real supervisor/transport/native lifecycle. They do not execute the surrounding nine-request CLI sequence; its separate earlier clock is source-audited.'},
 earlyStop:['Explicit contract/source contradiction or premature timeout established','Directly established required cleanup violation or owned survivor after bounded cleanup','Unexpected production/protocol/integrity defect requiring correction','Engineering observer/harness failure preventing trustworthy measurement','Overall300s observer guard or user hard stop reached'],
 timeoutPolicy:'Preserve natural timeout and continue only the declared remaining order unless an early-stop condition is established; never retry a sample.',network:false,certification:false});
console.log(JSON.stringify({result:'DECLARED',samples:25,order:order.map(r=>r.sampleId),cases:cases.map(({id,fileCount,aggregateBytes,requestFrameBytes,rootPathParts})=>({id,fileCount,aggregateBytes,requestFrameBytes,rootPathParts}))}));
