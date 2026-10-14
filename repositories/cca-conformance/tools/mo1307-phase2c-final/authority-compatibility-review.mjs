// Read-only dependency audit: no semantic stream is copied or executed here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const output=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase2c-final');
const baseline='08de262d1ef3149b6e540bcaea0cf910e02732bd',B1='3883ca889911fcc5a6f46c24e569478a8c32648e';
const product='repositories/memoryos-readiness/src/',prior='repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction/compatibility/attempt1/';
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
 streams.push({stream:stream.stream,commit:stream.commit,result:'PASS',classification:'UNCHANGED_REUSABLE',sourceWorktree:{path:directory,before,after,modified:false},priorReceipt:bound(receiptMember),retainedAcceptance:{tests:receipt.tests.counts,exactVectors:16},pureClosure:closure,semanticCampaignRerun:false,reason:'Exact semantic closure bytes match C2FB-bound successful compatibility receipt; 2C changes are outside both pure closures.',acceptedRawSourceLineageCorrection:lineage,phase2DIntegration:false});
}
const oldRoot='C:/Users/melsa/Documents/Codex/cca-mo1307-2c';
const members=[['docs/mo1307-phase2c-acquisition-publication.md','01-mo1307-phase2c-acquisition-publication.md.data'],['repositories/cca-conformance/evidence/mo1307/phase2c/blocker-campaign.json','02-blocker-campaign.json.data'],['repositories/cca-conformance/evidence/mo1307/phase2c/blocker-receipt.json','03-blocker-receipt.json.data'],['repositories/cca-conformance/evidence/mo1307/phase2c/final-checks.json','04-final-checks.json.data'],['repositories/cca-conformance/tools/mo1307-phase2c/blocker-probe.mjs','05-blocker-probe.mjs.data']];
const artifacts=members.map(([original,copy])=>{const bytes=fs.readFileSync(path.join(oldRoot,original)),copyPath='repositories/cca-conformance/evidence/mo1307/phase2c-correction/stopped-2c/'+copy;assert.deepEqual(bytes,read(copyPath));bound(copyPath);return{...row(original,bytes),boundHistoricalCopy:copyPath,result:'PASS'};});
assert.equal(git(oldRoot,['rev-parse','HEAD']).toString().trim(),B1);assert.equal(git(oldRoot,['diff','--name-only','HEAD']).toString(),'');
const historical={kind:'MO1307Phase2CFinalHistoricalPreservation',version:'1.0.0',result:'PASS',worktree:oldRoot,head:B1,disposition:'STOPPED / CONTRACT_INTERFACE_BLOCKER / NOT_PHASE2C_COMPLETE',modified:false,artifacts,status:git(oldRoot,['status','--porcelain=v1','--untracked-files=all']).toString(),oldProbeCount:12,oldProbeMeaning:'Synthetic protocol witnesses reproduced insufficiency; never native or completed 2C PASS.'};
const compatibility={kind:'MO1307Phase2CFinalCompatibility',version:'1.0.0',baseline,result:'PASS',authorityMatrix:bound(prior+'matrix.json'),streams,exactHandoff:{phase2B:['verifyEvidence(input)','verifyResultEvidence(input,resultBytes)'],phase2BReturn:['projection','audit','diagnostics'],phase2A:['computeReadiness(verified)','compareReadinessResult(verified,suppliedResultBytes)','projectReadinessResult(result,format)'],adapter:'Select candidate,candidateDigest,profile,stage,authorityIdentityDigest,claims,graph,graphDigest from projection; scopeId=projection.normalizedAuthority.scopeId; slots=projection.normalizedAuthority.slots; audit=returned audit. Do not pass diagnostics or invent authority.'}};
writeNewOrVerify(path.join(output,'compatibility.json'),JSON.stringify(compatibility,null,2)+'\n',{flag:'wx'});
writeNewOrVerify(path.join(output,'historical-preservation.json'),JSON.stringify(historical,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({compatibility:'PASS',streams:streams.map(x=>x.classification),historical:'PASS',artifacts:artifacts.length,expensiveCampaignsRerun:false})+'\n');

// Authority proof reads current main and immutable Git only; it never runs a
// product/helper/worker or modifies another worktree.
const main='C:/Users/melsa/Documents/Codex/cca-workspace';
const c2f='a61a8ff6fe01028fd21f8abe7208d5ffbe9c5152',c2cb='0d68ac211b3b204635e7af252cd693dce5bd70b1';
const evidence='repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction';
assert.equal(git(main,['rev-parse','HEAD']).toString().trim(),baseline);
assert.equal(git(main,['rev-parse',baseline+'^']).toString().trim(),c2f);
assert.equal(git(main,['rev-parse',c2f+'^']).toString().trim(),c2cb);
assert.equal(git(main,['branch','--show-current']).toString().trim(),'main');
assert.equal(git(main,['status','--porcelain=v1','--untracked-files=all']).toString(),'');
const binding=JSON.parse(fs.readFileSync(path.join(main,evidence,'binding.json')));
assert.equal(binding.implementation.commit,c2f);assert.equal(binding.implementation.parent,c2cb);
assert.equal(git(main,['rev-parse',c2f+'^{tree}']).toString().trim(),binding.implementation.tree);
assert.equal(git(main,['show','-s','--format=%s',c2f]).toString().trim(),binding.implementation.subject);
assert.equal(git(main,['show','-s','--format=%s',baseline]).toString().trim(),binding.bindingSubject);
const changed=git(main,['diff-tree','--no-commit-id','--name-only','-r',c2f]).toString().trim().split('\n').sort();
assert.deepEqual(changed,binding.members.map(x=>x.path));
const childPaths=git(main,['diff-tree','--no-commit-id','--name-only','-r',baseline]).toString().trim().split('\n').sort();
assert.deepEqual(childPaths,[evidence+'/binding-verification.json',evidence+'/binding.json'].sort());
function batch(revision,members){
 const result=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+main,'-C',main,'cat-file','--batch'],{input:members.map(m=>revision+':'+m+'\n').join(''),encoding:null,windowsHide:true,timeout:60000,maxBuffer:64*1024*1024});
 assert.equal(result.status,0);let offset=0;
 return members.map(member=>{const end=result.stdout.indexOf(10,offset),header=result.stdout.subarray(offset,end).toString();assert.match(header,/^[a-f0-9]{40} blob [0-9]+$/);const size=Number(header.split(' ')[2]);offset=end+1;const bytes=result.stdout.subarray(offset,offset+size);offset+=size;assert.equal(result.stdout[offset++],10);return bytes;});
}
const committed=batch(c2f,changed);
for(let i=0;i<binding.members.length;i++){const member=binding.members[i],bytes=fs.readFileSync(path.join(main,member.path));assert.equal(bytes.length,member.byteLength);assert.equal(hash(bytes),member.sha256);assert.deepEqual(bytes,committed[i]);}
const sealed=await import('file:///C:/Users/melsa/Documents/Codex/cca-workspace/repositories/cca-conformance/tools/mo1307-phase2c-finalization-correction/check-evidence.mjs');
sealed.checkSealedEvidence();
const correctionMembers=git(main,['ls-tree','-r','--name-only',baseline,'--',evidence]).toString().trim().split('\n').filter(Boolean);
const correctionBlobs=batch(baseline,correctionMembers);let jsonDocuments=0,textDocuments=0,binaryDocuments=0,totalBytes=0;
const reviewed=correctionMembers.map((member,i)=>{const bytes=fs.readFileSync(path.join(main,member));assert.deepEqual(bytes,correctionBlobs[i]);totalBytes+=bytes.length;
 const value={...row(member,bytes),classification:'BYTES_READ'};
 if(/\.json(?:\.data)*$/.test(member)){JSON.parse(decodeHistoricalText(bytes));jsonDocuments++;value.classification='JSON_PARSED';}
 else if(/\.(?:mjs|ps1|md|txt)(?:\.data)*$/.test(member)){bytes.toString('utf8');textDocuments++;value.classification='TEXT_READ';}
 else {binaryDocuments++;value.classification='BINARY_HASHED';}return value;});
const preservationMember='repositories/cca-conformance/evidence/mo1307/phase2c-final/preservation/inventory.json';
const preservation=JSON.parse(read(preservationMember));let immutableCount=0;
const preserved=preservation.rows.map(member=>{const bytes=fs.readFileSync(path.join(output,member.snapshot));assert.equal(bytes.length,member.byteLength);assert.equal(hash(bytes),'sha256:'+member.sha256.replace(/^sha256:/,''));
 const immutable=['docs/mo1307-phase2c-resumed.md','docs/mo1307-phase2c-continuation.md'].includes(member.path)||/^repositories\/cca-conformance\/evidence\/mo1307\/phase2c-(?:resumed|continuation)\//.test(member.path);
 if(immutable){assert.deepEqual(read(member.path),bytes);immutableCount++;}
 return{path:member.path,snapshot:member.snapshot,sha256:hash(bytes),byteLength:bytes.length,snapshotVerified:true,currentHistoricalUnchanged:immutable};});
const currentEvidenceRoots=['phase2c-resumed','phase2c-continuation'];let currentJson=0,currentText=0,currentBinary=0,currentBytes=0;
const currentRows=[];
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory())walk(full);else if(entry.isFile()){const member=path.relative(root,full).replaceAll('\\','/'),bytes=fs.readFileSync(full);currentBytes+=bytes.length;
 let classification='BINARY_HASHED';if(/\.json(?:\.data)*$/.test(member)){JSON.parse(decodeHistoricalText(bytes));currentJson++;classification='JSON_PARSED';}else if(/\.(?:mjs|ps1|md|txt)(?:\.data)*$/.test(member)){bytes.toString('utf8');currentText++;classification='TEXT_READ';}else currentBinary++;
 currentRows.push({...row(member,bytes),classification});}}}
for(const name of currentEvidenceRoots)walk(path.join(root,'repositories/cca-conformance/evidence/mo1307',name));
const authority={kind:'MO1307FinalC2FBAuthorityReview',result:'PASS',mainHead:baseline,mainUnchanged:true,C2F:c2f,C2CB:c2cb,
 graph:'PASS',boundC2FBlobs:binding.members.length,bindingOnlyChildPaths:childPaths,exactMainAndGitEquality:true,officialReadOnlySealedEvidenceCheck:'PASS',
 officialWholeStateVerifier:'NOT_RERUN_AFTER_AUTHORIZED_DIRTY_RECONCILIATION',wholeStateVerifierReason:'verify-binding.mjs requires current resumed porcelain and dirty bytes to equal the historical correction capture; authorized final adoption intentionally changes that live state. Commit/blob/current-main/closed acceptance checks are verified directly, and the original dirty bytes are separately revalidated against inert preserved snapshots. No official whole-state PASS is claimed.',
 correctionEvidence:{files:reviewed.length,totalBytes,jsonDocuments,textDocuments,binaryDocuments,members:reviewed},
 currentStoppedEvidence:{files:currentRows.length,totalBytes:currentBytes,jsonDocuments:currentJson,textDocuments:currentText,binaryDocuments:currentBinary,members:currentRows},
 noProductOrTestExecution:true};
fs.writeFileSync(path.join(output,'authority-review.json'),JSON.stringify(authority,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(output,'stopped-preservation-review.json'),JSON.stringify({kind:'MO1307FinalStoppedPreservationReview',result:'PASS',inventory:row(preservationMember,read(preservationMember)),snapshotsVerified:preserved.length,currentImmutableFilesVerified:immutableCount,
 historicalDispositions:['STOPPED / ENVIRONMENT_BLOCKER / NOT_PHASE2C_COMPLETE','STOPPED / CONTRACT_DEFECT / NOT_PHASE2C_COMPLETE'],originalBlocked2CArtifacts:artifacts,rows:preserved},null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({authority:'PASS',boundC2FBlobs:binding.members.length,correctionFiles:reviewed.length,correctionJson:jsonDocuments,currentStoppedEvidenceFiles:currentRows.length,currentStoppedJson:currentJson,preservedSnapshots:preserved.length,immutableCount})+'\n');

function writeNewOrVerify(target,bytes,options){if(fs.existsSync(target))assert.deepEqual(fs.readFileSync(target),Buffer.from(bytes));else fs.writeFileSync(target,bytes,options);}
function decodeHistoricalText(bytes){const text=bytes[0]===255&&bytes[1]===254?bytes.toString('utf16le'):bytes.toString('utf8');return text.replace(/^\uFEFF/,'');}
