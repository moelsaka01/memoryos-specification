/** Complete shape/provenance gate for completed preflight or ordinary campaign. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,artifact,validateSample,readCanonical} from './mo1305-evidence.mjs';
import {validateChunk} from './mo1305-phase1/sample-proof.mjs';
const progress=readCanonical(resolve(root,process.argv[2]));assert.equal(progress.state,'PASS');assert.equal(progress.completed.length,105);
const processes=new Set();let count=0;
for(const entry of progress.completed){const chunk=JSON.parse(artifact(entry.samples));validateChunk(chunk,progress,ref=>JSON.parse(artifact(ref)));for(const row of chunk.records){validateSample(row);count++;}for(const run of chunk.runs){const id=run.pid+':'+run.processStartedUtcMs;assert.ok(!processes.has(id),'SERVER_PROCESS_REUSED');processes.add(id);}}
assert.equal(processes.size,105*(progress.coldRequired+1));assert.equal(count,105*(progress.coldRequired+progress.warmRequired));
console.log(JSON.stringify({state:'PASS',mode:progress.mode,cases:105,samples:count,distinctServerProcesses:processes.size,campaignId:progress.campaignId}));
