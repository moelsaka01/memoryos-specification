// Read only fresh receipts; never adopts prior PASS/NOT_RUN rows as current outcomes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3',j=p=>JSON.parse(fs.readFileSync(ev+'/'+p)),sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex'),pin=p=>{const b=fs.readFileSync(p);return{path:p,byteLength:b.length,sha256:sha(b)}};
const map=j('current-control-map.json'),cache=new Map(),rows=[];let failure=null;
const expectedWitnessCounts={root:157,'trust-graph':96,'governance-primary':97,'governance-supplement':18,'runtime-main':76,'runtime-supplement':15,equivalence:69,protocol:13,toctou:2,'deadline-cleanup':18};
try{
 for(const m of map.rows){
  if(!cache.has(m.newReceipt)){const r=j(m.newReceipt),cases=r.rows??r.cases??r.records;assert.ok(Array.isArray(cases),m.newReceipt);assert.equal(cases.length,expectedWitnessCounts[m.suite],m.suite);assert.ok(cases.every(c=>c.result==='PASS'||c.pass===true),m.newReceipt);if(r.result)assert.equal(r.result,'PASS',m.newReceipt);cache.set(m.newReceipt,{receipt:r,cases});}
  const {cases}=cache.get(m.newReceipt),matches=cases.filter(c=>(c.id??c.name)===m.caseId);assert.equal(matches.length,1,m.id);const c=matches[0];
  let expected=c.expected??m.expectedOriginalTuple??{result:'PASS according to sealed case assertions'},actual=c.actual??c.detail??{result:c.result,code:c.code??null,status:c.status??null};
  if(m.suite==='root'&&m.caseId.startsWith('dispatch-native-')){expected=m.expectedOriginalTuple;actual={accept:false,code:c.detail.observedCode,stage:c.detail.observedStage,exit:c.detail.observedExit,publication:'NONE',stdoutBytes:c.detail.stdoutBytes};}
  rows.push({id:m.id,negative:m.negative,result:'PASS_FRESH',suite:m.suite,caseId:m.caseId,expected,actual,rawWitness:c,receipt:pin(ev+'/'+m.newReceipt),historicalAuthorityOnly:m.authoritativeWitnesses,adoptedHistoricalOutcome:false});
 }
 assert.equal(rows.length,551);assert.equal(rows.filter(r=>r.negative).length,426);assert.equal(new Set(rows.map(r=>r.id)).size,551);
}catch(e){failure={message:e.message,code:e.code??null,stack:e.stack};}
fs.writeFileSync(ev+'/current-control-results.json',JSON.stringify({kind:'MO1307Phase3CC3RBFreshControlResults',candidate:'defe93989efc6501b1a730b82e79e705884b269b',result:failure?'FAIL':'PASS_FRESH_COMPLETE',failure,count:rows.length,negative:rows.filter(r=>r.negative).length,rows,historicalPassReused:false,counting:'551 primary controls; supplementary duplicate/counter/resource witnesses remain in raw receipts and are not extra primary controls.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({result:failure?'FAIL':'PASS_FRESH_COMPLETE',controls:rows.length,negative:rows.filter(r=>r.negative).length,failure}));process.exitCode=failure?1:0;
