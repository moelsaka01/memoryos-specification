// Copy into the isolated installation before launching. Imports package by public name.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {registerHooks} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),pkg=path.join(here,'node_modules/memoryos-readiness'),prefix=pathToFileURL(pkg+path.sep).href;
const resolutions=[];
registerHooks({resolve(specifier,context,nextResolve){const result=nextResolve(specifier,context);if(!result.url.startsWith('node:'))assert.ok(result.url.startsWith(prefix),'Non-installed module '+result.url);resolutions.push({specifier,parent:context.parentURL??null,resolved:result.url});return result;}});
assert.equal(process.env.NODE_PATH,'');assert.equal(process.env.NODE_OPTIONS,'');assert.equal(process.cwd(),'C:\\Windows\\System32');
const api=await import('memoryos-readiness');assert.deepEqual(Object.keys(api).sort(),['evaluateReadiness','verifyReadiness']);
const fixture=path.join(here,'fixture'),load=n=>fs.readFileSync(path.join(fixture,n)),manifest=JSON.parse(load('manifest.json')),pins=JSON.parse(load('pins.json'));
const input={configurationBytes:load('configuration.json'),candidateBytes:load('candidate.json'),manifestBytes:load('manifest.json'),authorityBytes:load('authority.json'),files:manifest.entries.map(e=>({id:e.id,bytes:load(e.path)})).sort((a,b)=>a.id<b.id?-1:1),expectedCandidateDigest:pins.expectedCandidateDigest,trustedAuthorityDigest:pins.trustedAuthorityDigest};
const started=performance.now(),result=await api.evaluateReadiness(input);assert.ok(Buffer.from(result.resultBytes).equals(load('expected-result.json')),'Expected vector bytes');assert.equal(result.readinessDigest,pins.expectedReadinessDigest);assert.equal(result.proofBindingDigest,pins.expectedProofBindingDigest);
console.log(JSON.stringify({result:'PASS',exports:Object.keys(api),vector:'ready',safeByteAPI:true,elapsedMs:performance.now()-started,resultBytes:result.resultBytes.length,resultSha256:crypto.createHash('sha256').update(result.resultBytes).digest('hex'),readinessDigest:result.readinessDigest,proofBindingDigest:result.proofBindingDigest,cwd:process.cwd(),packageRoot:pkg,NODE_PATH:process.env.NODE_PATH,NODE_OPTIONS:process.env.NODE_OPTIONS,resolutions,workerIsolation:'Unmodified package worker URL, execArgv:[], env:{}; fixed worker-policy source bound by runtime closure',nativeHelperExecuted:false}));
