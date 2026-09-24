import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {read,ref,put,artifact,unchangedInputs,base,sha} from './mo1305-modular-resource.mjs';
import {modularAggregate,guardedAdverse} from './mo1305-host-proof.mjs';
const inputs=unchangedInputs(),resource=modularAggregate(base+'/resource-aggregate.json'),stress=guardedAdverse(base+'/stress/index.json');assert.equal(resource.extensionRequired,false,'TARGETED_VARIANCE_EXTENSION_REQUIRED');
const external=read('.cache/mo1305-bounded-r6/frozen-measured/external-inputs.json');for(const r of external){const b=readFileSync(r.path);assert.equal(b.length,r.byteLength);assert.equal(sha(b),r.sha256);}
const installedManifest=inputs.binding.distributionManifest,manifestBytes=readFileSync(installedManifest.path);assert.equal(sha(manifestBytes),installedManifest.sha256);const installed=JSON.parse(manifestBytes),installedRoot=installedManifest.path.replace(/distribution-manifest\.json$/u,'');for(const r of installed.files){const b=readFileSync(installedRoot+r.path);assert.equal(b.length,r.byteLength);assert.equal(sha(b),r.sha256);}
const history=read('.cache/mo1305-host-resume/historical-before.json');for(const r of history)assert.deepEqual(ref(r.path),r);
put(base+'/stress-validation.json',stress);
const log='.cache/mo1305-host-resume/guard-tests.tap',tap=readFileSync(log,'utf8');assert.match(tap,/^# tests 21\r?$/mu);assert.match(tap,/^# pass 21\r?$/mu);assert.match(tap,/^# fail 0\r?$/mu);
const files=['tools/mo1305-host-guard.mjs','tools/mo1305-host-guard-policy.json','tools/mo1305-host-events.ps1','tests/mo1305_host_guard_test.mjs'].map(x=>ref('repositories/cca-conformance/'+x));
put(base+'/guard-identity.json',{kind:'MemoryOSRESTHostGuardIdentity',state:'PASS',files,testLog:ref(log),tests:21,positive:5,negative:15,replacementPolicy:1,classificationRevalidatedFromRawEvents:true});
put(base+'/measurement-completion.json',{kind:'MemoryOSRESTModularMeasurementCompletion',state:'PASS',sourceTreeSha256:inputs.binding.sourceTreeSha256,resourceValidation:ref(base+'/resource-aggregate.json'),stressValidation:ref(base+'/stress-validation.json'),reusedR6Observations:resource.reused,freshObservations:resource.fresh,historicalR6State:'FAIL',inputs,external:ref('.cache/mo1305-bounded-r6/frozen-measured/external-inputs.json'),externalCount:external.length,installedFiles:installed.files.length,historicalFiles:history.length,historicalManifest:ref('.cache/mo1305-host-resume/historical-before.json'),guard:ref(base+'/guard-identity.json')});
console.log(JSON.stringify({state:'PASS',resources:resource.samples,stressRepetitions:stress.repetitions,sourceInputs:inputs.count,externalInputs:external.length,historicalFiles:history.length}));
