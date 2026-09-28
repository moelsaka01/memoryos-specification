// Read-only dependency audit: no semantic stream is copied or executed here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const output=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase2c-resumed');
const baseline='0d68ac211b3b204635e7af252cd693dce5bd70b1',B1='3883ca889911fcc5a6f46c24e569478a8c32648e';
const product='repositories/memoryos-readiness/src/',prior='repositories/cca-conformance/evidence/mo1307/phase2c-correction/compatibility/attempt2/';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const row=(member,b)=>({path:member,byteLength:b.length,sha256:hash(b)});
const read=member=>fs.readFileSync(path.join(root,member));
const git=(directory,args)=>{const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+directory,'-C',directory,...args],{encoding:null,windowsHide:true,timeout:15000,maxBuffer:16*1024*1024});assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr?.toString());return r.stdout;};
const bound=member=>{const b=read(member);assert.deepEqual(b,git(root,['show',baseline+':'+member]));return row(member,b);};
const matrix=JSON.parse(read(prior+'matrix.json'));assert.equal(matrix.result,'PASS');const streams=[];
for(const stream of matrix.streams){
 const directory='C:/Users/melsa/Documents/Codex/cca-mo1307-'+stream.stream;
 const before={head:git(directory,['rev-parse','HEAD']).toString().trim(),status:git(directory,['status','--porcelain=v1','--untracked-files=all']).toString()};
 assert.equal(before.head,stream.commit);assert.equal(before.status,'');assert.equal(git(directory,['rev-parse','HEAD^']).toString().trim(),B1);
 const receiptMember=prior+stream.receipt,receipt=JSON.parse(read(receiptMember));assert.equal(receipt.result,'PASS');assert.equal(receipt.exactAcceptedVectors,16);
 const closure=receipt.pureClosure.members.map(member=>{
  // 2B owns its accepted foundation changes; modules absent from C2CB are read
  // as exact committed bytes. Every other pure dependency remains C2CB bytes.
  const fromCommit=(stream.stream==='2b'&&member==='foundation.mjs')||!fs.existsSync(path.join(root,product+member));
  const bytes=fromCommit?git(directory,['show',stream.commit+':'+product+member]):read(product+member);
  const expected=receipt.effectiveSources.find(item=>item.path===product+member);assert.ok(expected);assert.equal(hash(bytes),expected.sha256);
  return{...row(product+member,bytes),source:fromCommit?stream.commit:'RESUMED_UNCHANGED_SHARED_DEPENDENCY'};
 });
 assert.ok(!receipt.pureClosure.members.includes('helper-protocol.mjs'));assert.ok(!receipt.pureClosure.members.includes('publication.mjs'));assert.ok(!receipt.pureClosure.members.includes('index.mjs'));
 const after={head:git(directory,['rev-parse','HEAD']).toString().trim(),status:git(directory,['status','--porcelain=v1','--untracked-files=all']).toString()};assert.deepEqual(after,before);
 const lineage=stream.stream==='2b'?row('repositories/cca-conformance/evidence/mo1307/phase2b/development/mo1306-source-lineage.json',git(directory,['show',stream.commit+':repositories/cca-conformance/evidence/mo1307/phase2b/development/mo1306-source-lineage.json'])):null;
 streams.push({stream:stream.stream,commit:stream.commit,result:'PASS',classification:'UNCHANGED_REUSABLE',sourceWorktree:{path:directory,before,after,modified:false},priorReceipt:bound(receiptMember),retainedAcceptance:{tests:receipt.tests.counts,exactVectors:16},pureClosure:closure,semanticCampaignRerun:false,reason:'Exact semantic closure bytes match C2CB-bound successful compatibility receipt; 2C changes are outside both pure closures.',acceptedRawSourceLineageCorrection:lineage,phase2DIntegration:false});
}
const oldRoot='C:/Users/melsa/Documents/Codex/cca-mo1307-2c';
const members=[['docs/mo1307-phase2c-acquisition-publication.md','01-mo1307-phase2c-acquisition-publication.md.data'],['repositories/cca-conformance/evidence/mo1307/phase2c/blocker-campaign.json','02-blocker-campaign.json.data'],['repositories/cca-conformance/evidence/mo1307/phase2c/blocker-receipt.json','03-blocker-receipt.json.data'],['repositories/cca-conformance/evidence/mo1307/phase2c/final-checks.json','04-final-checks.json.data'],['repositories/cca-conformance/tools/mo1307-phase2c/blocker-probe.mjs','05-blocker-probe.mjs.data']];
const artifacts=members.map(([original,copy])=>{const bytes=fs.readFileSync(path.join(oldRoot,original)),copyPath='repositories/cca-conformance/evidence/mo1307/phase2c-correction/stopped-2c/'+copy;assert.deepEqual(bytes,read(copyPath));bound(copyPath);return{...row(original,bytes),boundHistoricalCopy:copyPath,result:'PASS'};});
assert.equal(git(oldRoot,['rev-parse','HEAD']).toString().trim(),B1);assert.equal(git(oldRoot,['diff','--name-only','HEAD']).toString(),'');
const historical={kind:'MO1307Phase2CResumedHistoricalPreservation',version:'1.0.0',result:'PASS',worktree:oldRoot,head:B1,disposition:'STOPPED / CONTRACT_INTERFACE_BLOCKER / NOT_PHASE2C_COMPLETE',modified:false,artifacts,status:git(oldRoot,['status','--porcelain=v1','--untracked-files=all']).toString(),oldProbeCount:12,oldProbeMeaning:'Synthetic protocol witnesses reproduced insufficiency; never native or completed 2C PASS.'};
const compatibility={kind:'MO1307Phase2CResumedCompatibility',version:'1.0.0',baseline,result:'PASS',authorityMatrix:bound(prior+'matrix.json'),streams,exactHandoff:{phase2B:['verifyEvidence(input)','verifyResultEvidence(input,resultBytes)'],phase2BReturn:['projection','audit','diagnostics'],phase2A:['computeReadiness(verified)','compareReadinessResult(verified,suppliedResultBytes)','projectReadinessResult(result,format)'],adapter:'Select candidate,candidateDigest,profile,stage,authorityIdentityDigest,claims,graph,graphDigest from projection; scopeId=projection.normalizedAuthority.scopeId; slots=projection.normalizedAuthority.slots; audit=returned audit. Do not pass diagnostics or invent authority.'}};
fs.writeFileSync(path.join(output,'compatibility.json'),JSON.stringify(compatibility,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(output,'historical-preservation.json'),JSON.stringify(historical,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({compatibility:'PASS',streams:streams.map(x=>x.classification),historical:'PASS',artifacts:artifacts.length,expensiveCampaignsRerun:false})+'\n');
