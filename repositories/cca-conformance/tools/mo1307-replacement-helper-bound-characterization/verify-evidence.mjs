// Read-only post-campaign verifier. Launches zero helpers and zero workers.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root,evidence,tools,json,record,check,str,hash,read,baseline,productionTree,helperSha,capturePathState,checkTree} from './common.mjs';
import {verifyFixtureLedger} from './fixtures.mjs';

const seal=json(evidence+'/plan-seal.json'),campaign=json(evidence+'/campaign.json'),independent=json(evidence+'/independent-recomputation.json'),decision=json(evidence+'/decision.json'),ledger=json(evidence+'/fixture-ledger.json'),sequence=json(evidence+'/sequence-plan.json');
const historical=json(evidence+'/historical-binding.json');assert.equal(str('-C',historical.phase3A.worktree,'rev-parse','HEAD'),historical.phase3A.head);assert.equal(str('-C',historical.phase3A.worktree,'status','--porcelain=v1','--untracked-files=all'),historical.phase3A.statusPorcelain);
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',recompute=spawnSync(python,['-B',tools+'/independent-recompute.py','--verify'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});assert.ifError(recompute.error);assert.equal(recompute.status,0,recompute.stderr);assert.deepEqual(JSON.parse(recompute.stdout.trim()),independent);
assert.equal(seal.result,'SEALED');for(const binding of seal.sourceBindings)check(binding);verifyFixtureLedger(ledger,{includeControlInitial:false});
assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(str('rev-parse','HEAD:repositories/memoryos-readiness'),productionTree);assert.equal(hash(read('repositories/memoryos-readiness/helpers/windows-inspect.ps1')),helperSha);assert.equal(str('diff','--name-only',baseline,'--','repositories/memoryos-readiness'),'');
assert.equal(decision.result,independent.disposition);assert.equal(decision.productionChanges,false);assert.equal(decision.contractChanges,false);assert.equal(decision.phase3AResumed,false);assert.equal(decision.phase3BRerun,false);assert.equal(decision.phase3CRerun,false);assert.equal(decision.phase3D,false);assert.equal(decision.push,false);assert.equal(decision.tag,false);
const derivation=fs.existsSync(path.join(root,evidence,'derivation'))?fs.readdirSync(path.join(root,evidence,'derivation')).filter(x=>x.endsWith('.json')).length:0,
  holdout=fs.existsSync(path.join(root,evidence,'holdout'))?fs.readdirSync(path.join(root,evidence,'holdout')).filter(x=>x.endsWith('.json')).length:0,
  helperReceipts=fs.existsSync(path.join(root,evidence,'sequence-controls'))?fs.readdirSync(path.join(root,evidence,'sequence-controls'),{recursive:true}).filter(x=>String(x).includes('helpers')&&String(x).endsWith('.json')).length:0;
const controlReceipts=new Map(sequence.controls.map(control=>{const p=path.join(root,evidence,'sequence-controls',control.id,'receipt.json');return [control.id,fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null];}));
assert.equal(derivation,campaign.counts.derivation);assert.equal(holdout,campaign.counts.holdout);assert.equal(helperReceipts,campaign.counts.sequenceHelperLaunches);assert.equal(derivation+holdout+helperReceipts,campaign.counts.actualHelperLaunches);
for(const control of sequence.controls){const receipt=controlReceipts.get(control.id);if(control.command==='verify')checkTree(control.initialState.resultTree);else if(receipt?.result==='PASS'){const final=capturePathState(path.join(control.launch.outputRoot,'memoryos-readiness-result.json')),pending=capturePathState(path.join(control.launch.outputRoot,'memoryos-readiness-result.json.pending'));assert.equal(final.sha256,control.expected.result.sha256);assert.equal(final.byteLength,control.expected.result.byteLength);assert.equal(pending.exists,false);}else if(receipt===null)assert.deepEqual(capturePathState(control.launch.outputRoot),control.initialState.output);}
if(decision.result==='H_ESTABLISHED'){
  assert.equal(independent.result,'PASS');assert.equal(campaign.result,'CAMPAIGN_COMPLETE_PENDING_INDEPENDENT_RECOMPUTATION');assert.equal(campaign.counts.actualHelperLaunches,1544);assert.equal(campaign.counts.workerThreads,16);assert.equal(campaign.counts.sequenceControlsPassed,16);assert.equal(decision.Hms,independent.derived.H_ms);assert.ok(decision.Hms>5000&&decision.Hms<=20000);
  for(const control of sequence.controls.filter(c=>c.command==='evaluate')){const final=capturePathState(path.join(control.launch.outputRoot,'memoryos-readiness-result.json')),pending=capturePathState(path.join(control.launch.outputRoot,'memoryos-readiness-result.json.pending'));assert.equal(final.sha256,control.expected.result.sha256);assert.equal(pending.exists,false);}
}else{
  assert.equal(decision.Hms,null);assert.ok(decision.stop||fs.existsSync(path.join(root,evidence,'prelaunch-invalidation.json')));assert.ok(campaign.counts.actualHelperLaunches<=1544);
}
assert.equal(str('cat-file','-t','702c1b6381f6112a50ac844831d195275dac3350'),'commit');assert.equal(str('cat-file','-t','b02fc0226a1a2d800185a02071674ca80bdf4a1d'),'commit');
console.log(JSON.stringify({kind:'MO1307ReplacementBoundReadOnlyVerification',result:'PASS',disposition:decision.result,Hms:decision.Hms,counts:campaign.counts,seal:record(evidence+'/plan-seal.json'),nativeHelperExecutions:0,workerThreads:0}));
