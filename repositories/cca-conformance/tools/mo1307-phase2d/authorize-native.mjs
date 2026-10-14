// Record completion of the specified cheap-to-expensive acceptance order.
import assert from 'node:assert/strict';
import {evidence,json,record,check,write} from './common.mjs';
const summary=json(evidence+'/regressions/summary.json');assert.equal(summary.result,'PASS');
const receipts=summary.campaigns.map(c=>c.receipt);receipts.push(record(evidence+'/semantics/attempt-1/receipt.json'));
const bindings=[];
for(const m of receipts){check(m);const r=json(m.path);assert.equal(r.result,'PASS');const source=Array.isArray(r.sourceBindings)?r.sourceBindings:json(m.path.replace('/receipt.json','/inputs-before.json'));for(const b of source)check(b);bindings.push(...source);}
assert.equal(json(receipts.at(-1).path).tests.pass,58);
write(evidence+'/pre-native-authorization.json',{kind:'MO1307Phase2DNativeGate',version:'1.0.0',result:'PASS',createdAt:new Date().toISOString(),
 sequence:['cheap','phase1:105','phase2a:84+16','phase2b:172+16','phase2c:219','integrated-semantic:58','selected-native'],
 regressionSummary:record(evidence+'/regressions/summary.json'),receipts,sourceBindings:bindings,
 note:'Native escalation restores required ancestor handle access; product filesystem controls remain unchanged.'});
console.log(JSON.stringify({result:'PASS',next:'selected actual native integration'}));
