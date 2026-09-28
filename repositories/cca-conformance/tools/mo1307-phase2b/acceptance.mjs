// Finite Phase 2B verification; native Windows and offline; no predecessor runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { canonicalBytes, digest, canonicalDigest, proofBindingDigest } from '../../../memoryos-readiness/src/canonical.mjs';
import { verifyEvidence, verifyResultEvidence } from '../../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, inputOf } from './test-support.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base='repositories/cca-conformance/evidence/mo1307/phase2b';
const pin='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(digest(fs.readFileSync(process.execPath)),pin);
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');
const out=path.resolve(root,process.argv[3]);assert.ok(out.startsWith(path.join(root,base)+path.sep));assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const testRoot='repositories/cca-conformance/tests/';
const p1=['core','fixtures','package','native'].map(s=>testRoot+`mo1307_phase1_${s}_test.mjs`);
const p2=fs.readdirSync(path.join(root,testRoot)).filter(s=>/^mo1307_phase2b_.*_test\.mjs$/.test(s)).sort().map(s=>testRoot+s);
const rows=[];let okay=true;
function run(id,exe,args){
  const start=performance.now();
  const result=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:null,timeout:60000,maxBuffer:16*1024*1024});
  const stdout=result.stdout??Buffer.alloc(0),stderr=result.stderr??Buffer.alloc(0);
  fs.writeFileSync(path.join(out,id+'.stdout.txt'),stdout);fs.writeFileSync(path.join(out,id+'.stderr.txt'),stderr);
  const row={id,executable:exe,args,exit:result.status,error:result.error?.code??null,durationMs:Math.round((performance.now()-start)*1000)/1000,stdout:{byteLength:stdout.length,sha256:digest(stdout)},stderr:{byteLength:stderr.length,sha256:digest(stderr)},result:result.status===0&&!result.error?'PASS':'FAIL'};
  if(id.endsWith('-tests')){
    const text=stdout.toString('utf8');row.tests=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>[key,Number(new RegExp('^# '+key+' (\\d+)$','m').exec(text)?.[1]??-1)]));
    row.testNames=[...text.matchAll(/^# Subtest: (.+)$/gm)].map(match=>match[1]);
    if(row.tests.tests<1||row.tests.tests!==row.tests.pass||row.tests.fail||row.tests.cancelled||row.tests.skipped||row.tests.todo)row.result='FAIL';
  }
  rows.push(row);okay=okay&&row.result==='PASS';process.stdout.write(JSON.stringify({id,result:row.result,durationMs:row.durationMs,tests:row.tests})+'\n');
}
const sources=['evidence-graph','evidence-history','evidence-verifier','foundation'];
const members=[...sources.map(n=>`repositories/memoryos-readiness/src/${n}.mjs`),...p1,...p2,'repositories/cca-conformance/tools/mo1307-phase2b/acceptance.mjs'];
const identities=members.map(member=>{const raw=fs.readFileSync(path.join(root,member));return {path:member,byteLength:raw.length,sha256:digest(raw)};});
for(const name of sources)run('syntax-'+name,process.execPath,['--check',`repositories/memoryos-readiness/src/${name}.mjs`]);
if(okay)run('phase2b-tests',process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...p2]);
if(okay)run('phase1-tests',process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...p1]);
if(okay)run('fixture-regeneration',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/generate-fixtures.mjs','--check']);
if(okay)run('package',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check']);
if(okay)run('workspace',python,['-B','tools/verify_workspace.py','--root','.']);
if(okay)run('diff-check','git',['diff','--check']);
const vectors=[];
if(okay)for(const name of fs.readdirSync(path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles')).sort()){
  const b=loadBundle(name),verified=verifyEvidence(inputOf(b));verifyResultEvidence(inputOf(b),canonicalBytes(b.result));
  const p=verified.projection;
  vectors.push({name,candidateDigest:p.candidateDigest,authorityIdentityDigest:p.authorityIdentityDigest,trustedAuthorityDigest:verified.audit.trustedAuthorityDigest,projectionSha256:canonicalDigest(p),graphDigest:p.graphDigest,auditSha256:canonicalDigest(verified.audit),proofBindingDigest:proofBindingDigest(b.result.readinessDigest,verified.audit),claims:p.claims.length,nodes:p.graph.nodes.length,edges:p.graph.edges.length,history:p.history.length,qualifications:p.qualifications.length,providers:p.providers,reuse:p.reuse.map(r=>({claimDigest:r.claimDigest,disposition:r.disposition})),result:'PASS'});
}
for(const identity of identities)if(digest(fs.readFileSync(path.join(root,identity.path)))!==identity.sha256)okay=false;
const receipt={kind:'MemoryOSReadinessPhase2BAcceptance',version:'1.0.0',baseline:'3883ca889911fcc5a6f46c24e569478a8c32648e',runtime:{version:process.version,platform:process.platform,arch:process.arch,sha256:pin},sourceIdentities:identities,commands:rows,vectors,result:okay?'PASS':'FAIL',scope:'EVIDENCE_AUTHORITY_ONLY',readinessComputed:false,network:false,predecessorReruns:false,characterizationRerun:false};
fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');process.exitCode=okay?0:1;
