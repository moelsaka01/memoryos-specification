// Finite synthetic assertion validation only. No product imports, processes or clocks.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
assert.equal(path.resolve(root).toLowerCase(),'c:\\m7a2');
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const E=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart'),T=path.dirname(fileURLToPath(import.meta.url));
const correction=path.join(E,'harness-correction'),checker=path.join(T,'cleanup-topology.mjs');
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const text=fs.readFileSync(checker,'utf8'),begin='/* BEGIN exact cleanup allowance relation */',end='/* END exact cleanup allowance relation */';
assert.equal(text.split(begin).length,2);assert.equal(text.split(end).length,2);
const snippet=text.slice(text.indexOf(begin)+begin.length,text.indexOf(end));
const provenance=JSON.parse(fs.readFileSync(path.join(correction,'provenance-and-correction.json'),'utf8'));
assert.equal(snippet.trim(),provenance.newCheck.slice(provenance.newCheck.indexOf(begin)+begin.length,provenance.newCheck.indexOf(end)).trim());
const raw=JSON.parse(fs.readFileSync(path.join(correction,'previous-H-external-proof.json.data'),'utf8'));
const t=raw.timeoutCleanupTiming.terminalAtMs,d=raw.timeoutCleanupTiming.cleanupDeadlineAtMs;
assert.equal(t,6474.1113);assert.equal(d,8474.1113);assert.equal(d-t,2000.000000000001);assert.equal(d,t+2000);assert.equal(d-t-2000,2**-40);
const bytes=new ArrayBuffer(8),view=new DataView(bytes);
const bits=n=>{view.setFloat64(0,n,false);return view.getBigUint64(0,false);};
const fromBits=n=>{view.setBigUint64(0,n,false);return view.getFloat64(0,false);};
assert.equal(bits(t),0x40b94a1c7e28240bn);assert.equal(bits(d),0x40c08d0e3f141206n);
const nextUp=fromBits(bits(d)+1n),nextDown=fromBits(bits(d)-1n);
const cases=[
 ['zero-terminal-exact',0,2000,true],
 ['integer-exact',100,2100,true],
 ['binary-fraction-exact',0.125,2000.125,true],
 ['historical-represented-forward-relation',t,d,true],
 ['historical-json-roundtrip',JSON.parse(JSON.stringify(t)),JSON.parse(JSON.stringify(d)),true],
 ['actual-over-one-millisecond',t,d+1,false],
 ['actual-under-one-millisecond',t,d-1,false],
 ['actual-over-one-microsecond',t,d+0.001,false],
 ['actual-under-one-microsecond',t,d-0.001,false],
 ['actual-over-one-nanosecond',t,d+0.000001,false],
 ['actual-under-one-nanosecond',t,d-0.000001,false],
 ['next-representable-deadline-over',t,nextUp,false],
 ['next-representable-deadline-under',t,nextDown,false],
 ['non-increasing',t,t,false],
 ['negative-terminal',-1,1999,false],
 ['infinite-terminal',Infinity,Infinity,false],
 ['infinite-deadline',t,Infinity,false],
 ['negative-infinity-terminal',-Infinity,d,false],
 ['nan-terminal',NaN,d,false],
 ['nan-deadline',t,NaN,false],
 ['null-terminal',null,2000,false],
 ['null-deadline',t,null,false],
 ['string-terminal','6474.1113',d,false],
 ['string-deadline',t,'8474.1113',false],
 ['rounded-away-non-increasing',2**64,2**64,false],
];
const describe=n=>({type:typeof n,value:String(n),ieee754Hex:typeof n==='number'?'0x'+bits(n).toString(16).padStart(16,'0'):null});
const invoke=(code,terminalAtMs,cleanupDeadlineAtMs)=>{try{vm.runInNewContext(code,{assert,H:{timeoutCleanupTiming:{terminalAtMs,cleanupDeadlineAtMs}}},{timeout:1000});return {accepted:true,error:null};}catch(e){return {accepted:false,error:{name:e.name,code:e.code??null,message:e.message}};}};
const results=cases.map(([id,a,b,expectedAccepted])=>{const actual=invoke(snippet,a,b);return {id,terminal:describe(a),deadline:describe(b),expectedAccepted,...actual,result:actual.accepted===expectedAccepted?'PASS':'FAIL'};});
const oldHistorical=invoke(provenance.oldCheck,t,d);assert.equal(oldHistorical.accepted,false);
const validation={kind:'MO1307Phase3ACleanupAllowanceSyntheticValidation',version:'1.0.0',result:results.every(r=>r.result==='PASS')?'PASS':'FAIL',createdAt:new Date().toISOString(),purpose:'Before-certification numeric assertion correction validation; separate from A-O runtime evidence',candidate:provenance.candidate,checker:{path:path.relative(root,checker).replaceAll('\\','/'),byteLength:fs.statSync(checker).size,sha256:hash(fs.readFileSync(checker))},validator:{path:path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/'),sha256:hash(fs.readFileSync(fileURLToPath(import.meta.url)))},extractedActualCheckerSnippet:snippet,oldHistoricalFailure:oldHistorical,frozenAllowanceMs:2000,epsilonMs:0,toleranceMs:0,productExecutions:0,helperExecutions:0,caseCount:results.length,cases:results,proof:{historicalTerminal:describe(t),historicalDeadline:describe(d),subtractedDifference:d-t,excessDifferenceMs:d-t-2000,excessExact:'2^-40 ms',deadlineUlpMs:nextUp-d,forwardRelation:d===t+2000,bothAdjacentRepresentableWrongDeadlinesRejected:true,observedEventDeadlineComparisonsUnchanged:true}};
fs.writeFileSync(path.join(correction,'executed-checker-snippet.txt'),snippet,{flag:'wx'});
fs.writeFileSync(path.join(correction,'validation.json'),JSON.stringify(validation,null,2)+'\n',{flag:'wx'});
assert.equal(validation.result,'PASS');console.log(JSON.stringify({result:validation.result,cases:results.length,checkerSha256:validation.checker.sha256,epsilonMs:0,toleranceMs:0,productExecutions:0,historicalDifference:d-t}));
