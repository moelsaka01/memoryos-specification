/** Recalculate request/native provenance for every preflight/final record. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {validateChunk,validateAdverse} from './sample-proof.mjs';
import {J} from '../../../memoryos-rest/src/serialization.mjs';
const root=resolve(import.meta.dirname,'../../../..'),full=process.argv[2]==='full';
const read=p=>JSON.parse(readFileSync(resolve(root,p)));
const checked=ref=>{const data=readFileSync(resolve(root,ref.path));assert.equal(data.length,ref.byteLength);assert.equal(createHash('sha256').update(data).digest('hex'),ref.sha256);return JSON.parse(data);};
const ordinary=read(full?'repositories/cca-conformance/evidence/mo1305-phase1-resource-r5/progress.json':'.cache/mo1305-resource-review/campaign-smoke-r5/progress.json');
const adversePath=full?'repositories/cca-conformance/evidence/mo1305-phase1-adverse-r5':'.cache/mo1305-resource-review/adverse-smoke-r5',adverse=read(adversePath+'/index.json');
const catalog=read('repositories/cca-conformance/fixtures/mo1305-phase1/measurement/catalog.json').records;
assert.equal(ordinary.state,'PASS');assert.equal(ordinary.completed.length,105);assert.equal(catalog.length,105);assert.equal(ordinary.coldRequired,full?30:1);assert.equal(ordinary.warmRequired,full?100:1);
let samples=0;
for(let i=0;i<catalog.length;i++){const item=catalog[i],entry=ordinary.completed[i];assert.equal(entry.id,item.id);const chunk=checked(entry.samples);assert.equal(chunk.fixtureSha256,item.fixtureSha256);validateChunk(chunk,ordinary,checked);
 for(const phase of ['cold','warm'])assert.deepEqual(chunk.records.filter(r=>r.phase===phase).map(r=>r.index),Array.from({length:phase==='cold'?ordinary.coldRequired:ordinary.warmRequired},(_,n)=>n));
 for(const row of chunk.records){assert.equal(row.state,'PASS');assert.equal(row.status,item.expected.statusCode);assert.equal(row.responseSha256,item.expected.responseSha256);for(const key of ['workers','semanticOwners','connections','requestSlots','writeSlots'])assert.equal(row.parent.cleanup[key],0);samples++;}
}
assert.equal(adverse.state,'PASS');assert.equal(adverse.catalog.length,20);assert.equal(adverse.requiredRepetitions,full?3:1);assert.equal(adverse.requiredMs,full?60000:3000);assert.equal(adverse.completed.length,20*adverse.requiredRepetitions);assert.equal(adverse.binding.sourceTreeSha256,ordinary.binding.sourceTreeSha256);assert.equal(adverse.binding.archive.sha256,ordinary.binding.archive.sha256);
for(const name of adverse.catalog)for(let repeat=0;repeat<adverse.requiredRepetitions;repeat++){const row=read(adversePath+'/'+name+'-'+repeat+'.json');assert.equal(row.state,'PASS');assert.ok(row.adverseElapsedMs>=adverse.requiredMs);validateAdverse(row,adverse,checked);}
const result={state:'PASS',mode:full?'full':'smoke',cases:105,samples,adverseScenarios:20,adverseRepetitions:adverse.completed.length,campaignId:ordinary.campaignId,binding:ordinary.binding};
writeFileSync(resolve(root,process.argv[3]),J(result));console.log(JSON.stringify(result));
