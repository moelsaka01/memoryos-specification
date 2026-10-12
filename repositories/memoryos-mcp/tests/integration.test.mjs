import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { MemoryOS } from '../../cca-studio/web/js/memoryos-sdk.js';
import { official,installArchive,workspace,env } from './phase2-support.mjs';
import { fixtures,b64 } from './corpus.mjs';
import { PACKAGE_ROOT,contractIdentityPin } from '../src/integrity.mjs';
import { catalog,names,META } from '../src/contracts.mjs';
import { J } from '../src/deterministic.mjs';
const f=await fixtures(),results=[];
function cli(args){const result=spawnSync(process.execPath,[resolve(workspace,'repositories/memoryos-cli/bin/memoryos.js'),'policy',...args,'--json'],{env:env(),encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:65536});assert.equal(result.error,undefined);return {...result,value:JSON.parse(result.stdout||result.stderr)};}
for(const mode of ['source','installed'])test(`official MCP OS-pipe integration, all six tools, SDK/CLI parity and restart: ${mode}`,async()=>{
 const installed=mode==='installed'?await installArchive():undefined;
 const root=installed?.root??PACKAGE_ROOT,fixtureRoot=await mkdtemp(resolve(tmpdir(),'memoryos-mo1304-phase2-vectors-'));
 for(const key of ['pass','fail','cne','set','mip'])await writeFile(resolve(fixtureRoot,key),f[key]);
 const h=await official(root);const calls=[];
 async function call(name,args={}){const response=await h.client.callTool({name,arguments:args},{timeout:30000});assert.equal(response.content.length,1);assert.equal(response.content[0].type,'text');assert.deepEqual(JSON.parse(response.content[0].text),response.structuredContent);assert.deepEqual(response._meta,META);assert.equal(response.isError,response.structuredContent.status==='error');calls.push(name);return response.structuredContent;}
 const decisions=[];
 try{
  const discover=await h.client.discover();assert.equal(discover.ttlMs,0);assert.equal(discover.cacheScope,'private');assert.deepEqual(discover.supportedVersions,['2026-07-28']);
  const listing=await h.client.listTools();assert.equal(listing.ttlMs,0);assert.equal(listing.cacheScope,'private');assert.deepEqual(listing.tools,catalog(await contractIdentityPin()));
  const identities=await call(names[0]);assert.equal(identities.status,'ok');assert.deepEqual(identities.identities,new MemoryOS().policyContractIdentities());assert.deepEqual(cli(['identities']).value.result,identities.identities);
  for(const isSet of [false,true]){
   const key=isSet?'set':'pass',memory=new MemoryOS(),prepared=isSet?memory.preparePolicySet(f[key]):memory.preparePolicy(f[key]);
   const result=await call(isSet?names[3]:names[2],{[isSet?'policySetBase64':'policyBase64']:b64(f[key])});assert.equal(result.status,'ok');
   assert.deepEqual(Buffer.from(result.canonicalArtifactBase64,'base64'),Buffer.from(prepared.toBytes()));assert.equal(result.documentDigest,prepared.documentDigest);assert.equal(result.semanticDigest,prepared.semanticDigest);
   const canonical=resolve(fixtureRoot,key+'.canonical');const c=cli(['digest',isSet?'--policy-set':'--policy',resolve(fixtureRoot,key),'--canonical-output',canonical]);assert.equal(c.status,0);assert.equal(c.value.result.documentDigest,result.documentDigest);assert.equal(c.value.result.semanticDigest,result.semanticDigest);assert.deepEqual(await readFile(canonical),Buffer.from(result.canonicalArtifactBase64,'base64'));
  }
  for(const [key,decision,exitCode] of [['pass','PASS',0],['fail','FAIL',6],['cne','COULD_NOT_EVALUATE',7],['set','PASS',0]]){
   const memory=new MemoryOS(),set=key==='set',prepared=set?memory.preparePolicySet(f[key]):memory.preparePolicy(f[key]);
   const context=memory.capturePolicyFactContext(memory.importPackage(f.mip,{identifier:'memoryos-policy-evaluation-candidate'}));
   const sdk=set?memory.evaluatePolicySet(prepared,context,{}):memory.evaluatePolicy(prepared,context,{});
   const result=await call(names[1],{artifactKind:set?'policySet':'policy',artifactBase64:b64(f[key]),candidateMipBase64:b64(f.mip)});
   assert.equal(result.status,'ok');assert.equal(result.decision,decision);decisions.push(decision);
   assert.equal(result.semanticDigest,prepared.semanticDigest);assert.equal(result.evaluationIdentityDigest,sdk.evaluationIdentityDigest);assert.equal(result.outcomeDigest,sdk.outcomeDigest);
   assert.deepEqual(Buffer.from(result.evaluationIdentityBase64,'base64'),Buffer.from(sdk.evaluationIdentityBytes()));assert.deepEqual(Buffer.from(result.outcomeBase64,'base64'),Buffer.from(sdk.canonicalOutcomeBytes()));
   const identity=resolve(fixtureRoot,key+'.identity'),outcome=resolve(fixtureRoot,key+'.outcome');
   const c=cli(['evaluate',set?'--policy-set':'--policy',resolve(fixtureRoot,key),'--package',resolve(fixtureRoot,'mip'),'--identity-output',identity,'--outcome',outcome]);
   assert.equal(c.status,exitCode);assert.equal(c.value.result.decision,decision);assert.equal(c.value.result.evaluationIdentityDigest,result.evaluationIdentityDigest);assert.equal(c.value.result.outcomeDigest,result.outcomeDigest);
   assert.deepEqual(await readFile(identity),Buffer.from(result.evaluationIdentityBase64,'base64'));assert.deepEqual(await readFile(outcome),Buffer.from(result.outcomeBase64,'base64'));
   if(key==='pass'){
    const id=await call(names[4],{evaluationIdentityBase64:result.evaluationIdentityBase64,expectedEvaluationIdentityDigest:result.evaluationIdentityDigest});
    const out=await call(names[5],{outcomeBase64:result.outcomeBase64,expectedEvaluationIdentityDigest:result.evaluationIdentityDigest,expectedOutcomeDigest:result.outcomeDigest});
    for(const v of [id,out]){assert.equal(v.verified,true);assert.equal(v.authority,'inspectionOnly');assert.equal(v.verificationScope,'serializedArtifact');}
    const ci=cli(['verify-identity',identity,'--mode','artifact','--expected-evaluation-identity-digest',result.evaluationIdentityDigest]);
    const co=cli(['verify-outcome',outcome,'--mode','artifact','--expected-evaluation-identity-digest',result.evaluationIdentityDigest,'--expected-outcome-digest',result.outcomeDigest]);
    assert.equal(ci.status,0);assert.equal(co.status,0);assert.equal(ci.value.result.evaluationIdentityDigest,id.evaluationIdentityDigest);assert.equal(co.value.result.outcomeDigest,out.outcomeDigest);
   }
  }
  const invalid=await call(names[2],{policyBase64:b64(Buffer.from('{}'))});assert.equal(invalid.error.origin,'memoryos');
  await writeFile(resolve(fixtureRoot,'invalid'),'{}');const ci=cli(['digest','--policy',resolve(fixtureRoot,'invalid')]);assert.notEqual(ci.status,0);assert.equal(ci.value.error.code,invalid.error.code);
  assert.equal((await call(names[0],{extra:true})).error.code,'MO1304_INVALID_TOOL_INPUT');
  const busy=await Promise.all([call(names[0]),call(names[0])]);assert.deepEqual(busy.map(x=>x.status).sort(),['error','ok']);assert.equal(busy.find(x=>x.status==='error').error.code,'MO1304_BUSY');
  const abort=new AbortController(),before=h.transcript.length;
  const cancelled=h.client.callTool({name:names[0],arguments:{}},{signal:abort.signal,timeout:30000});
  const rejection=assert.rejects(cancelled);
  for(let i=0;i<1000&&!h.transcript.slice(before).some(x=>x.method==='tools/call');i++)await delay(1);
  abort.abort();await rejection;await h.client.discover();assert.equal((await call(names[0])).status,'ok');
  assert.ok(h.transcript.slice(before).some(x=>x.method==='notifications/cancelled'));
  for(const message of h.transcript.filter(x=>x.id!==undefined)){assert.equal(message.params._meta['io.modelcontextprotocol/protocolVersion'],'2026-07-28');assert.ok(message.params._meta['io.modelcontextprotocol/clientCapabilities']);assert.notEqual(message.method,'initialize');}
  assert.deepEqual([...new Set(calls)].sort(),[...names].sort());assert.equal(h.stderr(),'');
 }finally{await h.close();}
 const restart=await official(root);try{assert.equal((await restart.client.callTool({name:names[0],arguments:{}})).structuredContent.status,'ok');assert.equal(restart.stderr(),'');assert.notEqual(restart.pid,h.pid);}finally{await restart.close();}
 results.push({mode,status:'PASS',transport:'official Client 2.0.0 and StdioClientTransport over actual OS pipes',tools:[...new Set(calls)].sort(),decisions,canonicalSDKAndCLIParity:true,stableMemoryOSErrorParity:true,busy:true,cancellation:true,restart:true,processesReaped:true,stderrBytes:0,installedOutsideCheckout:Boolean(installed),offlineInstall:installed?{ignoreScripts:true,offline:true,audit:false,fund:false,emptyExplicitCache:true,verifiedFiles:installed.verified.files}:null});
});
after(async()=>{const receipt={kind:'MemoryOSMCPPhase2ClientIntegration',version:'1.0.0',status:results.length===2?'PASS':'FAIL',node:process.versions.node,archiveSha256:JSON.parse(await readFile(resolve(PACKAGE_ROOT,'measurements/phase2-package-receipt.json'))).archive.sha256,results,platformCertification:'PENDING_PHASE3'};await writeFile(resolve(PACKAGE_ROOT,'measurements/phase2-integration.json'),J(receipt)+'\n');});
