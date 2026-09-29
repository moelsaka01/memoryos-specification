import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {acquireCliInputs} from '../../../../memoryos-readiness/src/acquisition.mjs';
import {createHelperSequence,decodeHelperResponse,decodeHelperRequest} from '../../../../memoryos-readiness/src/helper-protocol.mjs';
import {createHelperTransport} from '../../../../memoryos-readiness/src/helper-transport.mjs';
import {createSupervisor} from '../../../../memoryos-readiness/src/runtime.mjs';
import {errorExit} from '../../../../memoryos-readiness/src/errors.mjs';
const base=fileURLToPath(new URL('../../../evidence/mo1307/phase3c/runtime-boundary/',import.meta.url));const owned=path.join(base,'native-identity'),input=path.join(owned,'input'),prior=path.join(owned,'prior');
const fixture=fileURLToPath(new URL('../../../fixtures/mo1307/bundles/ready/',import.meta.url));
for(const p of [input,prior])if(!path.resolve(p).startsWith(path.resolve(owned)+path.sep))throw new Error('Unsafe move target');
await fs.mkdir(input,{recursive:true});const names=['authority.json','configuration.json','candidate.json','manifest.json'];for(const n of names)await fs.copyFile(path.join(fixture,n),path.join(input,n));
const pins=JSON.parse(await fs.readFile(path.join(fixture,'pins.json'),'utf8'));
const supervisor=createSupervisor({kind:'cli'}),sequence=createHelperSequence('evaluate'),transport=createHelperTransport(supervisor),observations=[];
const exchange=async frame=>{const r=decodeHelperRequest(frame);const answer=await transport.exchange(frame);const response=decodeHelperResponse(answer.responseBytes,r);observations.push({sequence:r.sequence,root:response.roots[0]?.identity??null});if(r.sequence===1){await fs.rename(input,prior);await fs.mkdir(input);for(const n of names)await fs.copyFile(path.join(prior,n),path.join(input,n));}return answer;};
let error;try{await acquireCliInputs({command:'evaluate',inputRoot:input,outputRoot:path.join(owned,'out'),config:'configuration.json',authority:'authority.json',decision:null,...pins},sequence,exchange,stage=>supervisor.checkpoint(stage));}catch(e){error={code:e.code,stage:e.stage,exit:errorExit(e)};}finally{await supervisor.dispose();}
const expected={code:'MO1307_FILESYSTEM_BOUNDARY',stage:'CONFIGURATION',exit:20};let outExists=true;try{await fs.stat(path.join(owned,'out'));}catch(e){if(e.code==='ENOENT')outExists=false;else throw e;}
const receipt={kind:'MO1307Phase3CActualNativeIdentityReplacement',expected,actual:error,observations,noPublication:!outExists,snapshot:supervisor.snapshot(),scope:'Controlled identity replacement between two actual native acquisition phases, within owned fixtures. No privileged concurrent namespace attacker claim.',result:JSON.stringify(error)===JSON.stringify(expected)&&!outExists?'PASS':'FAIL'};
await fs.writeFile(path.join(base,'native-identity.json'),JSON.stringify(receipt,null,2)+'\n');assert.equal(receipt.result,'PASS');assert.notEqual(observations[0].root.fileId,observations[1].root.fileId);console.log(JSON.stringify({result:'PASS',helperCount:observations.length,error}));
