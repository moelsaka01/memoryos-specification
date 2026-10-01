import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,E,T,HEAD,authority,json,record,walk,write,identity} from './common.mjs';

// Materialize the independent read-only static audit after all tooling and
// preparation inputs are final, but before any A-O certification execution.
assert.equal(process.argv.length,2);
identity();
assert.equal(fs.existsSync(path.join(E,'harness-review.json')),false);
assert.equal(fs.existsSync(path.join(E,'campaign-seal.json')),false);
assert.equal(fs.existsSync(path.join(E,'campaign-run-start.json')),false);
const inventoryValidation=json(path.join(E,'inventory-validation.json'));
assert.equal(inventoryValidation.result,'PASS');
assert.equal(inventoryValidation.candidate,HEAD);
assert.equal(inventoryValidation.integrationAuthority,authority);
assert.equal(inventoryValidation.totalCases,80);
assert.equal(inventoryValidation.checks.allCasesNotRun,true);
assert.equal(inventoryValidation.checks.historicalOutcomesPromoted,false);
const candidate=json(path.join(E,'candidate-identity.json'));
assert.equal(candidate.C3TB,HEAD);
assert.equal(candidate.members,89);
assert.equal(candidate.packageIdentity,'sha256:2869cc0745fc555d5338f35634e7738b49cb628f6693dd92c5868f36ec113729');
assert.equal(candidate.helperSha256,'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127');

const toolRows=walk(T);
const reviewedModules=toolRows.map(row=>record(path.join(T,row.path)));
const texts=new Map(toolRows.filter(row=>/\.(?:mjs|py|ps1)$/.test(row.path)).map(row=>[row.path,fs.readFileSync(path.join(T,row.path),'utf8')]));
const mustContain=(name,needle)=>assert.ok(texts.get(name)?.includes(needle),name+' missing '+needle);
mustContain('common.mjs','codex/mo1307-phase3ar2-c3tb');
mustContain('campaign.mjs',"helperWholeLifecycleMs:8000");
mustContain('campaign.mjs',"replacementHelperBoundH:'NOT_ESTABLISHED'");
mustContain('campaign.mjs','completedMandatoryCases===80');
mustContain('runtime-controls.mjs',"['strict-before-8000',7999,'PASS']");
mustContain('runtime-controls.mjs',"['equality-8000-timeout',8000,'MO1307_TIMEOUT']");
mustContain('runtime-controls-run.py',"'perHelperMinimum':0,'perHelperMaximum':1");
mustContain('observe-command.py',"'perHelperMinimum':0,'perHelperMaximum':1");
mustContain('cleanup-topology.mjs','pair.consoles.length<=1');
mustContain('core.mjs','q.durationMs<8000');
mustContain('decisions-tags.mjs','q.durationMs<8000');
mustContain('decisions-tags.mjs',"cases.push({name:'pre-tag-absent'");
mustContain('finalization.mjs','entry.elapsedMs<8000');
mustContain('security.mjs','helperDeadlineMs:8000');
for(const [name,text] of texts){
  if(name==='recover-inventory.mjs'||name==='record-harness-review.mjs')continue;
  for(const stale of ['phase3a-c3rb-restart','durationMs<5000','chargedThisExchangeMs<5000','helperDeadlineMs:5000','helperMs:5000','timeout:7000'])assert.equal(text.includes(stale),false,name+' contains stale certification token '+stale);
}

write('harness-review.json',{
  kind:'MO1307Phase3AR2C3TBIndependentStaticHarnessReview',
  version:'1.0.0',
  result:'PASS',
  reviewedAt:new Date().toISOString(),
  reviewer:{role:'INDEPENDENT_READ_ONLY_STATIC_AUDITOR',task:'/root/authority_map',materialization:'The delegated auditor performed the read-only review; this deterministic preparation tool records the final reviewed bytes.'},
  candidate:HEAD,
  authority,
  scope:'Final Phase 3AR2 C3TB harness and sealed-input preparation only; no product, helper, worker, publication, or A-O certification case was executed by this review.',
  reviewedModules,
  findings:[
    'Exact worktree, branch, C3TB head, runtime identity, installed package, 89-member inventory, package identity and helper identity are asserted before execution.',
    'Current prospective helper authority uses strict success below 8000 ms and timeout at or above 8000 ms; historical H remains NOT_ESTABLISHED.',
    'Current final-headless authority permits zero or one observed helper console; exactly one helper and every identified console must be signaled within the unchanged cleanup deadline.',
    'Observer identity/snapshot failures, unexplained descendants, role overlap, late success, retries, replacement execution and historical PASS promotion cannot yield acceptance.',
    'Close rechecks every sealed tool, dependency, fixture, source member, installed member, prepared input and campaign-start seal binding before acceptance.',
  ],
  correctionsAppliedDuringReview:['C3TB/current-authority rebinding','strict 8000-ms boundary','optional 0-or-1 console policy','complete product-object assignment','observer identity/snapshot failure rejection','close seal-chain integrity','truthful derived production-mutation field'],
  inventoryValidation:record(path.join(E,'inventory-validation.json')),
  observationMethod:record(path.join(E,'observation-method.json')),
  installedVerification:record(path.join(E,'installed-before.json')),
  certificationCasesExecuted:0,
  historicalEvidencePromoted:false,
  noRetry:true,
});
console.log(JSON.stringify({result:'PASS',reviewedModules:reviewedModules.length,certificationCasesExecuted:0}));
