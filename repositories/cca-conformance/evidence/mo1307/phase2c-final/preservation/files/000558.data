// Read-only dependency audit: no semantic stream is copied or executed here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const output=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase2c-continuation');
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
const historical={kind:'MO1307Phase2CContinuationHistoricalPreservation',version:'1.0.0',result:'PASS',worktree:oldRoot,head:B1,disposition:'STOPPED / CONTRACT_INTERFACE_BLOCKER / NOT_PHASE2C_COMPLETE',modified:false,artifacts,status:git(oldRoot,['status','--porcelain=v1','--untracked-files=all']).toString(),oldProbeCount:12,oldProbeMeaning:'Synthetic protocol witnesses reproduced insufficiency; never native or completed 2C PASS.'};
const compatibility={kind:'MO1307Phase2CContinuationCompatibility',version:'1.0.0',baseline,result:'PASS',authorityMatrix:bound(prior+'matrix.json'),streams,exactHandoff:{phase2B:['verifyEvidence(input)','verifyResultEvidence(input,resultBytes)'],phase2BReturn:['projection','audit','diagnostics'],phase2A:['computeReadiness(verified)','compareReadinessResult(verified,suppliedResultBytes)','projectReadinessResult(result,format)'],adapter:'Select candidate,candidateDigest,profile,stage,authorityIdentityDigest,claims,graph,graphDigest from projection; scopeId=projection.normalizedAuthority.scopeId; slots=projection.normalizedAuthority.slots; audit=returned audit. Do not pass diagnostics or invent authority.'}};
fs.writeFileSync(path.join(output,'compatibility.json'),JSON.stringify(compatibility,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(output,'historical-preservation.json'),JSON.stringify(historical,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({compatibility:'PASS',streams:streams.map(x=>x.classification),historical:'PASS',artifacts:artifacts.length,expensiveCampaignsRerun:false})+'\n');

// Additional read-only continuation review. No product module is imported and
// no helper, worker, test suite or readiness computation is executed.
const continuationMember='repositories/cca-conformance/evidence/mo1307/phase2c-continuation/continuation.json';
const continuation=JSON.parse(read(continuationMember));
assert.equal(git(root,['rev-parse','HEAD']).toString().trim(),baseline);
const snapshots=continuation.files.map(member=>{
 const saved=fs.readFileSync(path.join(output,member.snapshot));
 assert.equal(saved.length,member.byteLength);assert.equal(hash(saved),'sha256:'+member.sha256);
 const immutable=member.path==='docs/mo1307-phase2c-resumed.md'||member.path.startsWith('repositories/cca-conformance/evidence/mo1307/phase2c-resumed/');
 const current=read(member.path);const unchanged=hash(current)==='sha256:'+member.sha256;
 if(immutable)assert.ok(unchanged,'Historical stopped bytes changed: '+member.path);
 return{path:member.path,snapshot:member.snapshot,byteLength:member.byteLength,sha256:'sha256:'+member.sha256,
  snapshotMatches:true,historicalImmutable:immutable,currentMatchesSnapshot:unchanged};
});
const preservation={kind:'MO1307ContinuationStoppedBytesReview',result:'PASS',baseline,
 continuationRecord:row(continuationMember,read(continuationMember)),snapshotsVerified:snapshots.length,
 historicalImmutableVerified:snapshots.filter(x=>x.historicalImmutable).length,
 changedCurrentImplementation:snapshots.filter(x=>!x.currentMatchesSnapshot).map(x=>x.path),
 priorDispositionRetained:'STOPPED / ENVIRONMENT_BLOCKER / NOT_PHASE2C_COMPLETE',
 newDispositionDoesNotRewriteHistory:true,files:snapshots};
fs.writeFileSync(path.join(output,'stopped-preservation-review.json'),JSON.stringify(preservation,null,2)+'\n',{flag:'wx'});
const freeze='docs/mo1307-contract-freeze-1.md',correction='docs/mo1307-phase2c-publication-inspection-correction.md';
function clause(member,startLine,endLine=startLine){return{path:member,startLine,endLine,quote:read(member).toString('utf8').split(/\r?\n/).slice(startLine-1,endLine).join('\n')};}
const nativeTest='repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs';
const nativeBefore=continuation.files.find(x=>x.path===nativeTest);assert.ok(nativeBefore);
assert.equal(hash(read(nativeTest)),'sha256:'+nativeBefore.sha256);
const timer={kind:'MO1307N24TimerAuthorityDisposition',classification:'TEST_OVERCONSTRAINT_NOT_NORMATIVE_CONTRADICTION',
 result:'DOCUMENTARY_REVIEW_COMPLETE_REGRESSION_NOT_RUN',authorities:[row(freeze,read(freeze)),row(correction,read(correction))],
 clauses:[clause(freeze,978),clause(freeze,1019,1020),clause(freeze,1234,1248),clause(correction,131),clause(correction,133)],
 currentN24:clause(nativeTest,308,317),
 mechanicalBasis:'The same frozen architecture expressly requires operational timer initialization, a supervisor timer, and external timer enforcement. It prohibits queue/server/retry/watcher/cross-run cache architecture. Therefore N24 cannot correctly ban every occurrence of setInterval in an operational implementation merely because the API token is present. Invocation-scoped bounded timers are compatible only if absolute limits, terminality and cleanup are enforced; a timer escaping its invocation is not authorized.',
 currentFinding:'The publication polling timer exists only inside writePending and has a finally clearInterval. An indefinitely unsettled write can prevent that finally; cleanup on terminal observation still needs implementation/validation. Permitting bounded timers does not excuse that lifecycle defect.',
 plannedRegression:{cases:['success-a','write-failure','write-cancellation','success-b'],observation:'AsyncLocalStorage-scoped async_hooks observes timers plus server/watcher resources, requires destruction at settlement/disposal, zero later callbacks, and zero timer rearming across sequential invocations.',
  scope:'Actual owned publication file I/O with synthetic framed inspection, not native identity certification.',
  members:['repositories/cca-conformance/tools/mo1307-phase2c-continuation/timer-witness.mjs','repositories/cca-conformance/tests/mo1307_phase2c_timer_lifetime_test.mjs'].map(member=>row(member,read(member))),
  executed:false,reason:'Paused and preserved after separate submitted-rename deadline contract gap was demonstrated.'},
 phase1NativeTestChanged:false,N15N17ChangedByThisReview:false,N24RegexChanged:false,phase1Regression105Executed:false,
 noProductChangesByThisReview:true,noNormativeTextChanged:true};
fs.writeFileSync(path.join(output,'timer-disposition.json'),JSON.stringify(timer,null,2)+'\n',{flag:'wx'});
const diagnosticMember='repositories/cca-conformance/evidence/mo1307/phase2c-continuation/rename-boundary-diagnostic/receipt.json';
const diagnostic=JSON.parse(read(diagnosticMember));
assert.equal(diagnostic.result,'CONFLICT_REPRODUCED');assert.equal(diagnostic.finalAtFailure,false);assert.equal(diagnostic.finalAfter,true);
const rename={kind:'MO1307SubmittedRenameAuthorityReview',classification:'CONTRACT_DEFECT',
 scope:'Gap between non-abortable submitted asynchronous rename and mandatory terminal precommit deadline/publication guarantees; not universal implementation impossibility.',
 diagnostic:row(diagnosticMember,read(diagnosticMember)),
 observation:{mechanism:diagnostic.mechanism,remainingCliBudgetMs:diagnostic.remainingCliBudgetMs,submittedAt:diagnostic.submittedAt,
  atFailure:diagnostic.atFailure,code:diagnostic.observedError.code,finalAtFailure:diagnostic.finalAtFailure,pendingAtFailure:diagnostic.pendingAtFailure,
  nativeCompletedAtFailure:diagnostic.nativeCompletedAtFailure,afterNativeRename:diagnostic.afterNativeRename,finalAfter:diagnostic.finalAfter,pendingAfter:diagnostic.pendingAfter},
 scopeLimitations:['Four finite engineering PBKDF2 jobs supply controlled libuv queue contention. They are not normal production CLI workload or shipped product functionality.',
  'The actual submitted filesystem rename and native path absence/presence were observed on pinned Windows Node. This is not merely a callback delayed after an already committed rename.',
  'The diagnostic is a single classification witness, not a completed production nine-request lifecycle or proof that every alternative implementation is impossible.'],
 clauses:[clause(freeze,1234,1252),clause(freeze,1324,1336),clause(freeze,1376),clause(correction,119,123),clause(correction,131,135),clause(correction,170)],
 rejectedInterpretations:[
  {proposal:'Treat rename submission as the commit point',reason:'The authorities define successful final rename as sole commit. The final path was still absent when TIMEOUT was observed.'},
  {proposal:'Suppress returned success but allow the submitted rename to publish during cleanup',reason:'Freeze says cleanup cannot publish; correction requires rejection of precommit publication after expiry/abort and forbids publication during cleanup.'},
  {proposal:'Await a possibly indefinitely stalled rename, then return OUTPUT after eventual commit',reason:'Direct waiting does not establish the absolute failed-call bound. The already observed terminal timeout cannot revive the sequence, and eventual commit does not retroactively authorize publication during cleanup.'},
  {proposal:'Assume excluded namespace attackers exclude all queue delay',reason:'The immutable-root qualification limits adversarial namespace mutation and kernel nonreplacement claims; it does not create an execution-time or libuv scheduling guarantee.'}],
 compatibleBoundary:'A contract-compatible implementation must preserve the actual rename commit point, prevent precommit mutation after terminal expiry/cancellation, and meet bounded cleanup/topology simultaneously. No demonstrated compatible implementation for the submitted unabortable rename boundary was established here.',
 nextAction:'STOP before dependent acceptance or completion commit for explicit authority resolving the in-flight publication/cancellation boundary or an independently demonstrated compatible implementation; do not silently change commit semantics or time limits.',
 noProductMutationByThisReview:true,noAdditionalDiagnosticExecution:true,noTestExecution:true};
fs.writeFileSync(path.join(output,'rename-authority-review.json'),JSON.stringify(rename,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({stoppedSnapshots:snapshots.length,immutableStoppedFiles:preservation.historicalImmutableVerified,timerReview:timer.result,renameReview:rename.classification})+'\n');
