import test from 'node:test';import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';import { resolve } from 'node:path';
import { official,installArchive } from './phase2-support.mjs';import { fixtures,b64 } from './corpus.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { PACKAGE_ROOT } from '../src/integrity.mjs';import { names } from '../src/contracts.mjs';import { J } from '../src/deterministic.mjs';
test('installed archive denies network, client filesystem, persistence, shell, AJV paths and source fallback',async()=>{
 const installed=await installArchive(),auditPath=resolve(installed.destination,'instrumentation.json');
 const f=await fixtures(),g=f.golden[0];
 const h=await official(installed.root,[resolve(PACKAGE_ROOT,'tests/phase2-process-guard.mjs'),installed.root,auditPath]);
 try{
  await h.client.listTools();
  const calls=[[names[0],{}],[names[2],{policyBase64:b64(f.pass)}],[names[3],{policySetBase64:b64(f.set)}],[names[1],{artifactKind:'policy',artifactBase64:b64(f.pass),candidateMipBase64:b64(f.mip)}],[names[1],{artifactKind:'policySet',artifactBase64:b64(f.set),candidateMipBase64:b64(f.mip)}],[names[4],{evaluationIdentityBase64:b64(g.canonicalIdentityBytes),expectedEvaluationIdentityDigest:g.evaluationIdentityDigest}],[names[5],{outcomeBase64:b64(g.canonicalOutcomeBytes),expectedEvaluationIdentityDigest:g.evaluationIdentityDigest,expectedOutcomeDigest:g.outcomeDigest}]];
  for(const [name,args] of calls)assert.equal((await h.client.callTool({name,arguments:args})).structuredContent.status,'ok');
  const forbidden=['C:/private/secret','../secret','C:/Users/private/Documents','C:/Users/private/.env','file:///C:/private','http://[::not-valid]/private','\\\\server\\share','\\\\?\\C:\\private','C:/private:stream','http://127。0。0。1/','http://host:80@private/'];
  for(const value of forbidden){
   const result=await h.client.callTool({name:names[0],arguments:{path:value,uri:value}});assert.equal(result.structuredContent.error.code,'MO1304_INVALID_TOOL_INPUT');
   const discovery=await h.client.discover();assert.equal(discovery.ttlMs,0);await delay(120);
  }
  assert.equal(h.stderr(),'');
 }finally{await h.close();}
 const audit=JSON.parse(await readFile(auditPath));assert.equal(audit.code,0);assert.equal(audit.workers.length,7);
 for(const entry of [audit.parent,...audit.workers]){for(const key of ['network','filesystem','writes','shell','moduleFallback','validators'])assert.equal(entry[key],0,key);assert.ok(entry.reads>0);assert.ok(entry.modules.length>0);assert.ok(entry.modules.every(x=>!x.startsWith('..')));}
 const receipt={kind:'MemoryOSMCPPhase2OfflineBoundary',version:'1.0.0',status:'PASS',archiveSha256:installed.receipt.archive.sha256,installedOutsideCheckout:true,network:'INSTRUMENTED_REJECTION_PARENT_AND_ALL_SEVEN_WORKER_PATHS',filesystem:'CLOSED_PACKAGE_READS_AND_REQUIRED_ANCESTOR_METADATA_ONLY',sourceCheckoutFallback:false,persistence:false,processesReaped:true,officialClient:true,workerOperations:7,audit,osLevelNetworkDenial:'PENDING_PHASE3',platformCertification:'PENDING_PHASE3',instrumentation:'Explicit trusted test bootstrap imports the unchanged installed entry point; observer receipt writes are outside semantic runtime and use a saved test-owned writer.'};
 await writeFile(resolve(PACKAGE_ROOT,'measurements/phase2-offline.json'),J(receipt)+'\n');
});
