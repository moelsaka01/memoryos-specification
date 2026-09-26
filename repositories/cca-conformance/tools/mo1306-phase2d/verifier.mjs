import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {digest} from '../../../memoryos-ci/src/contracts.mjs';
import {J} from '../../../memoryos-ci/src/serialization.mjs';
const root=path.resolve(fileURLToPath(new URL('../../../../',import.meta.url))),pkg=path.join(root,'repositories/memoryos-ci');
const distribution=digest(fs.readFileSync(path.join(pkg,'distribution-manifest.json'))),pin='sha256:'+'a'.repeat(64);
const base={kind:'MemoryOSCICDSummary',version:'1.0.0',runId:'11111111-1111-4111-8111-111111111111',classification:'TIMEOUT',exitCode:13,resultSha256:null,publication:'NONE'};
const canonical=J(base),args=[root,'generic',pin,distribution,'13'];
const vectors=[...['generic','gitlab','jenkins','azure','github'].map(provider=>({id:provider+'-operational-NONE',args:args.map((x,i)=>i===1?provider:x),input:canonical,accepted:true})),
 {id:'exact-CRLF-transport',input:canonical.slice(0,-1)+'\r\n',accepted:true},
 {id:'malformed-JSON',input:'{',accepted:false},
 {id:'double-final-LF',input:canonical+'\n',accepted:false},
 {id:'noncanonical-order',input:JSON.stringify({...base,kind:undefined}).replace('"version"','"kind":"MemoryOSCICDSummary","version"')+'\n',accepted:false},
 {id:'unknown-summary-key',input:J({...base,extra:true}),accepted:false},
 {id:'oversized',input:' '.repeat(4097),accepted:false},
 {id:'exit-mismatch',input:canonical,args:args.map((x,i)=>i===4?'14':x),accepted:false},
 {id:'exit-injection',input:canonical,args:args.map((x,i)=>i===4?'13;exit 0':x),accepted:false},
 {id:'semantic-NONE',input:J({...base,classification:'PASS',exitCode:0}),args:args.map((x,i)=>i===4?'0':x),accepted:false},
 {id:'unknown-provider',input:canonical,args:args.map((x,i)=>i===1?'hostile':x),accepted:false},
 {id:'invalid-config-pin',input:canonical,args:args.map((x,i)=>i===2?'bad':x),accepted:false},
 {id:'wrong-distribution',input:canonical,args:args.map((x,i)=>i===3?pin:x),accepted:false}];
const cases=[];
for(const v of vectors){const r=spawnSync(process.execPath,['--max-old-space-size=128',path.join(pkg,'scripts/verify-provider-result.mjs'),...(v.args??args)],{cwd:root,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR},input:v.input,windowsHide:true,timeout:15000,maxBuffer:16384});assert.equal(r.error,undefined,v.id);if(v.accepted){assert.equal(r.status,0,v.id+': '+r.stderr);assert.equal(r.stdout.toString(),canonical);}else{assert.notEqual(r.status,0,v.id);assert.equal(r.stdout.length,0);assert.ok(r.stderr.length<=1024);JSON.parse(r.stderr.toString());}cases.push({id:v.id,status:'PASS',accepted:v.accepted});}
process.stdout.write(J({status:'PASS',passed:cases.length,cases,distributionDigest:distribution}));
