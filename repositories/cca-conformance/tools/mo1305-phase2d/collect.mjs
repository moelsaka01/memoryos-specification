/** Generate only pre-I2 identities; never invent future commit hashes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,directory,read,canonical,sha,reference,validateAll} from './evidence.mjs';
import {executionBinding,jobs} from './execution.mjs';
import {B1,git,checkSourceInputs,checkPreservation} from './graph.mjs';
const save=(name,value)=>writeFileSync(resolve(root,directory,name),canonical(value));
if(process.argv[2]!=='refresh-index'){
 save('baseline-preserved.json',JSON.parse(readFileSync(resolve(root,'.cache/mo1305-phase2d/baseline-preserved.json'))));
 writeFileSync(resolve(root,directory,'phase1-inventory.json'),git(['show',B1+':repositories/cca-conformance/mo1305-conformance-inventory.json'],{binary:true}));
 save('predecessor-tags.json',[
 {name:'memoryos-1.3-mo1301',object:'2cda15d8ab056ac8f2971c5cd9a22cb89fc4821e',target:'af6a405b3cd9097ce469b16a854a0568b8acee1f'},
 {name:'memoryos-1.3-mo1302',object:'773dd03829dd6b3632bf43a45578925b1498515d',target:'7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d'},
 {name:'memoryos-1.3-mo1303',object:'f3891cbac8a6ab804887a3d95a595c7bd1523af9',target:'49aa80fa76bffc03e36335be8ab805bb5dc38f9c'},
 {name:'memoryos-1.3-mo1304',object:'6d877151f0857006fcf12958f8b4c5bc662f43d6',target:'ce7b001d911239fa50d904f5f336bb1bd7858ba3'}]);
}
const results=validateAll(),binding=executionBinding(),review=read(directory+'/integration-review.json');
const historical=[...new Set(Object.values(review.inputs).flatMap(input=>input.files.filter(row=>['documentation','evidence'].includes(row.category)).map(row=>row.path)))].sort().map(reference);
save('index.json',{kind:'MemoryOSRESTPhase2DIndex',version:'1.0.0',state:'PASS',baseline:B1,bindingSha256:sha(canonical(binding)),production:binding.candidate.production,productionSha256:sha(canonical(binding.candidate.production)),archive:binding.archive,sourceTree:binding.sourceTree,sourceTreeSha256:read('.cache/mo1305-phase2d/build/source-tree.json').sha256,modules:jobs.map(job=>reference(directory+'/modules/'+job+'.json')),historical,resourcePolicy:{phase1Characterization:'REUSED_UNCHANGED',newCharacterizationObservations:0,limitsState:'FINAL',semanticDeadlineMs:31400,ceilingMs:60000},results});
console.log(JSON.stringify({results,inputs:checkSourceInputs(),preserved:checkPreservation()}));
