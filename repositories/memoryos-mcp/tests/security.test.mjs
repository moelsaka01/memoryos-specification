import test from 'node:test';import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';import { once } from 'node:events';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/server/validators/ajv';
import { harness,meta } from './support.mjs';
import { fixtures,b64 } from './corpus.mjs';
import { readFile } from 'node:fs/promises';
import net from 'node:net';import http from 'node:http';import https from 'node:https';import tls from 'node:tls';import dns from 'node:dns';import dgram from 'node:dgram';import { syncBuiltinESMExports } from 'node:module';
const uris=['http://[::not-valid]/private','%2f%2fevil.example:/pwn','\\\\evil.com/path','http://evil.com\\@allowed.com','http://127。0。0。1/','http://example.com/public/%2e%2e/admin','http://trusted.com%40evil.com/'];
test('embedded fast-uri is affected, but untrusted MO-1304 inputs never invoke its AJV provider or network APIs',async(t)=>{
  const provider=new AjvJsonSchemaValidator();
  const uri=provider.ajv.opts.uriResolver;
  assert.equal(uri.normalize(uris[5]),'http://example.com/admin');
  let validators=0,network=0;
  t.mock.method(AjvJsonSchemaValidator.prototype,'getValidator',()=>{validators++;throw Error('UNEXPECTED_SCHEMA_COMPILATION');});
  t.mock.getter(AjvJsonSchemaValidator.prototype,'ajv',()=>{validators++;throw Error('UNEXPECTED_AJV_ENGINE');});
  const forbidden=()=>{network++;throw Error('UNEXPECTED_NETWORK');};
  for(const [object,keys] of [[net,['connect','createConnection','createServer']],[http,['request','get','createServer']],[https,['request','get','createServer']],[tls,['connect','createServer']],[dns,['lookup','resolve']],[dns.promises,['lookup','resolve']],[dgram,['createSocket']]])for(const key of keys)t.mock.method(object,key,forbidden);
  t.mock.method(globalThis,'fetch',forbidden);syncBuiltinESMExports();
  try{
    for(const value of uris){const h=await harness();try{
      assert.ok((await h.request('server/discover',{_meta:{...meta,'org.example/value':value}})).result);
      assert.ok((await h.request('tools/list')).result);
      assert.equal((await h.request('tools/call',{name:'memoryos_contract_identities',arguments:{uri:value}})).result.isError,true);
      assert.equal((await h.request('resources/read',{uri:value})).error.code,-32601);
      const ack=h.messages.length;h.input.write(JSON.stringify({jsonrpc:'2.0',id:90,method:'subscriptions/listen',params:{_meta:meta,notifications:{resourcesUpdated:[value]}}})+'\n');
      await new Promise(r=>setTimeout(r,20));assert.ok(h.messages.length>=ack);
    }finally{await h.close();}}
    const f=await fixtures(),g=f.golden[0],h=await harness();try{
      const calls=[['memoryos_contract_identities',{}],['memoryos_prepare_policy',{policyBase64:b64(f.pass)}],['memoryos_prepare_policy_set',{policySetBase64:b64(f.set)}],['memoryos_evaluate_policy',{artifactKind:'policy',artifactBase64:b64(f.pass),candidateMipBase64:b64(f.mip)}],['memoryos_verify_evaluation_identity',{evaluationIdentityBase64:b64(g.canonicalIdentityBytes),expectedEvaluationIdentityDigest:g.evaluationIdentityDigest}],['memoryos_verify_policy_outcome',{outcomeBase64:b64(g.canonicalOutcomeBytes),expectedEvaluationIdentityDigest:g.evaluationIdentityDigest,expectedOutcomeDigest:g.outcomeDigest}]];
      for(const [name,args] of calls)assert.equal((await h.request('tools/call',{name,arguments:args})).result.structuredContent.status,'ok');
    }finally{await h.close();}
    assert.equal(validators,0);assert.equal(network,0);
  }finally{t.mock.restoreAll();syncBuiltinESMExports();}
});
test('all semantic delegation paths attempt no network or shell/PATH access inside the worker',async()=>{
  const worker=new Worker(new URL('./network-worker.mjs',import.meta.url),{execArgv:[],env:{},stdout:true,stderr:true});
  let output='';worker.stdout.on('data',x=>output+=x);worker.stderr.on('data',x=>output+=x);
  const timer=setTimeout(()=>void worker.terminate(),30000);
  try{const [result]=await once(worker,'message');assert.deepEqual(result,{attempts:0,statuses:Array(7).fill('ok')});assert.equal(output,'');}
  finally{clearTimeout(timer);await worker.terminate();}
});
test('review sources retain all seven advisories and identify available patch versions',async()=>{
  const sources=JSON.parse(await readFile(new URL('../measurements/advisory-source-review.json',import.meta.url)));
  assert.equal(sources.advisories.length,7);for(const entry of sources.advisories){assert.equal(entry.severity,'high');assert.ok(entry.description);assert.ok(entry.vulnerabilities.some(x=>x.package.name==='fast-uri'));}
  assert.ok(sources.registry.find(x=>x.name==='fast-uri').stableVersions.includes('3.1.6'));
});
