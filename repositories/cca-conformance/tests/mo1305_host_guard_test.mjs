import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {classify,replacementAllowed} from '../tools/mo1305-host-guard.mjs';
const base=Date.parse('2026-09-24T16:00:00Z');
const stamp=ms=>({domain:'MONOTONIC_ORCHESTRATOR:fixture',ns:String(BigInt(ms)*1000000n),utcMs:base+ms});
const window=(a,b)=>({start:stamp(a),end:stamp(b),attemptId:'fixture',candidateId:'fixture',caseId:'fixture',phase:'warm',index:0,sampleId:'fixture'});
function sleep(a,b,record=1){return [506,507].map((id,i)=>{const utc=new Date(base+(i?b:a)).toISOString(),data={BootId:83,ScenarioInstanceIdV2:record,...(i?{SleepEntered:'true',SleepDurationInUs:(b-a)*1000,DurationInUs:(b-a)*1000}:{})};return {Id:id,RecordId:record+i,utc,xml:`<Event><System><Provider Name='Microsoft-Windows-Kernel-Power'/><EventID>${id}</EventID><TimeCreated SystemTime='${utc}'/><EventRecordID>${record+i}</EventRecordID></System><EventData>${Object.entries(data).map(([k,v])=>`<Data Name='${k}'>${v}</Data>`).join('')}</EventData></Event>`};});}
const source=events=>({state:'AVAILABLE',events});
for(const [name,events] of [['sleep inside',sleep(1100,1900)],['starts before',sleep(500,1500)],['ends after',sleep(1500,2500)],['multiple',[...sleep(900,1300),...sleep(1600,2100,4)]]])test(name,()=>assert.equal(classify(window(1000,2000),source(events)).classification,'HOST_INTERRUPTED'));
for(const name of ['20-second semantic operation','genuine timeout','collector delay','CPU contention','high memory'])test(name+' without sleep',()=>assert.equal(classify(window(0,name==='genuine timeout'?61000:20000),source([])).classification,'NORMAL'));
for(const [name,events] of [['outside',sleep(3000,4000)],['historical',sleep(-100000,-99000)],['touches boundary',sleep(2000,3000)]])test(name,()=>assert.equal(classify(window(1000,2000),source(events)).classification,'NORMAL'));
test('missing evidence',()=>assert.equal(classify(window(0,20000),null).classification,'NORMAL'));
test('unqueryable evidence',()=>assert.equal(classify(window(0,20000),{state:'UNAVAILABLE'}).classification,'NORMAL'));
test('malformed evidence',()=>{assert.equal(classify(window(1000,2000),source([{xml:'bad'}])).classification,'NORMAL');const e=sleep(1100,1900);e[1].xml=e[1].xml.replace('800000','8e5');assert.equal(classify(window(1000,2000),source(e)).classification,'NORMAL');});
test('wrong provider',()=>assert.equal(classify(window(1000,2000),source(sleep(1100,1900).map(r=>({...r,xml:r.xml.replace('Microsoft-Windows-Kernel-Power','Other')})))).classification,'NORMAL'));
test('clock jump cannot excuse timeout',()=>{const w=window(1000,2000);w.end.utcMs+=20000;assert.equal(classify(w,source(sleep(1100,1900))).classification,'NORMAL');});
test('three replacements bounded',()=>{assert.ok(replacementAllowed(3,3));assert.ok(!replacementAllowed(4,3));assert.ok(!replacementAllowed(1,4));});
test('R6 exact Modern Standby pattern',()=>{const events=JSON.parse(readFileSync(new URL('../evidence/mo1305-r6-diagnostic/power-events-raw.json',import.meta.url)));const a=Date.parse('2026-09-24T16:16:58Z')-base,b=Date.parse('2026-09-24T16:18:00Z')-base;const r=classify(window(a,b),source(events));assert.equal(r.classification,'HOST_INTERRUPTED');assert.ok(r.overlaps.some(x=>x.sleepDurationUs===55776717&&x.recordIds.includes(130893)));});

test('malformed nested XML never invalidates',()=>{const e=sleep(1100,1900);e[1].xml=e[1].xml.replace('</Event>','</Broken>');assert.equal(classify(window(1000,2000),source(e)).classification,'NORMAL');});
test('20-second valid operation still breaches frozen 4x deadline ceiling',()=>{const r=classify(window(0,20000),source([]));assert.equal(r.classification,'NORMAL');assert.equal(Math.ceil(Math.max(1000,4*20000)/100)*100,80000);assert.ok(80000>60000);});
