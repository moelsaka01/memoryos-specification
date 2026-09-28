// Final cache-only acceptance after exactly two commits; no new tracked evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root,evidence,str,git,record,write} from './common.mjs';
import {checkCampaign,checkRegression,checkCompatibility,checkSealedEvidence} from './check-evidence.mjs';
const cache='.cache/mo1307/phase2c-finalization-correction/post-binding';
const focused=cache+'/focused-and-queued',regression=cache+'/shared-regression';
const compatibility='.cache/mo1307/phase2c-finalization-correction/compatibility-checks/post-binding-1';
checkSealedEvidence();
const result={...checkCampaign(focused),...checkRegression(regression),...checkCompatibility(compatibility)};
const child=spawnSync(process.execPath,['repositories/cca-conformance/tools/mo1307-phase2c-finalization-correction/verify-binding.mjs','--bound'],
  {cwd:root,encoding:null,timeout:60000,maxBuffer:1024*1024,windowsHide:true});
fs.mkdirSync(path.join(root,cache),{recursive:true});
for(const [name,bytes] of [['binding.stdout.txt',child.stdout??Buffer.alloc(0)],['binding.stderr.txt',child.stderr??Buffer.alloc(0)]])
  fs.writeFileSync(path.join(root,cache,name),bytes,{flag:'wx'});
assert.ifError(child.error);assert.equal(child.status,0,child.stderr.toString());
const binding=JSON.parse(child.stdout.toString());assert.equal(binding.result,'PASS');
git('diff','--check');git('diff','--cached','--check');assert.equal(str('status','--porcelain'),'');
write(cache+'/receipt.json',{kind:'MO1307FinalizationPostBindingAcceptance',version:'1.0.0',result:'PASS',finishedAt:new Date().toISOString(),
  ...result,binding,receipts:[focused+'/receipt.json',regression+'/receipt.json',compatibility+'/matrix.json',cache+'/binding.stdout.txt',cache+'/binding.stderr.txt'].map(p=>record(p)),
  main:str('rev-parse','HEAD'),parent:str('rev-parse','HEAD^'),gitStatus:'CLEAN',diffCheck:'PASS',package:'PASS',workspace:'PASS',
  sourceChangesAfterBinding:false,push:false,tag:false,phase2CComplete:false,phase2DStarted:false});
console.log(JSON.stringify({result:'PASS',...result,...binding,receipt:cache+'/receipt.json',gitStatus:'CLEAN'}));
