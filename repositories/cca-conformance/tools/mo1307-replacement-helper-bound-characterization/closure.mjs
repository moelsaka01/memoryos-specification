// Post-campaign closure. Launches zero helpers and zero workers.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root,evidence,tools,json,record,writeJson,str,hash,read,baseline,productionTree,helperSha} from './common.mjs';

const campaign=json(evidence+'/campaign.json'),decision=json(evidence+'/decision.json'),independent=json(evidence+'/independent-recomputation.json');assert.equal(decision.result,independent.disposition);
assert.equal(str('rev-parse','HEAD:repositories/memoryos-readiness'),productionTree);assert.equal(hash(read('repositories/memoryos-readiness/helpers/windows-inspect.ps1')),helperSha);assert.equal(str('diff','--name-only',baseline,'--','repositories/memoryos-readiness'),'');
const toolFiles=fs.readdirSync(path.join(root,tools)).filter(x=>x.endsWith('.mjs')||x.endsWith('.py')).sort(),syntax=[];
for(const name of toolFiles.filter(x=>x.endsWith('.mjs'))){const p=tools+'/'+name,r=spawnSync(process.execPath,['--check',p],{cwd:root,windowsHide:true,encoding:'utf8'});assert.equal(r.status,0,r.stderr);syntax.push({path:p,result:'PASS'});}
for(const name of toolFiles.filter(x=>x.endsWith('.py'))){const p=tools+'/'+name,python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',code=`import ast,pathlib;ast.parse(pathlib.Path(${JSON.stringify(path.join(root,p))}).read_text(encoding='utf-8'))`,r=spawnSync(python,['-B','-c',code],{cwd:root,windowsHide:true,encoding:'utf8'});assert.equal(r.status,0,r.stderr);syntax.push({path:p,result:'PASS'});}
const verifier=spawnSync(process.execPath,[tools+'/verify-evidence.mjs'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});assert.equal(verifier.status,0,verifier.stderr);const verifierValue=JSON.parse(verifier.stdout.trim());assert.equal(verifierValue.result,'PASS');
const diff=spawnSync('git',['diff','--check'],{cwd:root,windowsHide:true,encoding:'utf8'});assert.equal(diff.status,0,diff.stderr);
const finalValidation=writeJson(evidence+'/final-validation/attempt-1/receipt.json',{kind:'MO1307ReplacementBoundFinalValidation',result:'PASS',createdAtUtc:new Date().toISOString(),disposition:decision.result,Hms:decision.Hms,
  campaignResult:campaign.result,counts:campaign.counts,independent:record(evidence+'/independent-recomputation.json'),readOnlyEvidenceVerifier:{result:'PASS',stdout:verifierValue},syntax,
  gitDiffCheck:{result:'PASS',stdout:diff.stdout,stderr:diff.stderr},productionTree,helperSha,productionDiffFromBaseline:'',acceptedPhase3BPreserved:str('cat-file','-t','702c1b6381f6112a50ac844831d195275dac3350')==='commit',acceptedPhase3CPreserved:str('cat-file','-t','b02fc0226a1a2d800185a02071674ca80bdf4a1d')==='commit',
  campaignNativeHelperExecutions:campaign.counts.actualHelperLaunches,campaignWorkerThreads:campaign.counts.workerThreads,closureNativeHelperExecutions:0,closureWorkerThreads:0,productionChanges:false,contractChanges:false,certification:false,push:false,tag:false});
const status=str('status','--porcelain=v1','--untracked-files=all').split(/\r?\n/).filter(Boolean),inventoryPath=evidence+'/changed-file-inventory.json';
const entries=status.map(line=>({status:line.slice(0,2),path:line.slice(3).replaceAll('\\','/')}));
const allowed=entries.every(x=>x.path==='.gitattributes'||x.path==='docs/mo1307-replacement-helper-bound-characterization.md'||x.path.startsWith(tools+'/')||x.path.startsWith(evidence+'/'));assert.equal(allowed,true,JSON.stringify(entries.filter(x=>!x.path.startsWith(evidence+'/')).slice(0,20)));
assert.equal(entries.some(x=>x.path===inventoryPath),false);
const recorded=entries.map(entry=>({...entry,...(entry.status.includes('D')?{}:{file:record(entry.path)})}));
const inventory=writeJson(inventoryPath,{kind:'MO1307ReplacementBoundChangedFileInventory',result:'PASS',createdAtUtc:new Date().toISOString(),entries:recorded,
  self:{path:inventoryPath,reason:'Written last and therefore intentionally excluded from its own hash inventory.'},allowedRoots:['.gitattributes','docs/mo1307-replacement-helper-bound-characterization.md',tools+'/',evidence+'/'],productionMembersChanged:0,finalValidation});
const after=str('status','--porcelain=v1','--untracked-files=all').split(/\r?\n/).filter(Boolean).map(line=>line.slice(3).replaceAll('\\','/'));assert.equal(after.length,entries.length+1);assert.equal(after.includes(inventoryPath),true);
console.log(JSON.stringify({result:'PASS',disposition:decision.result,Hms:decision.Hms,inventory,finalValidation,campaignNativeHelperExecutions:campaign.counts.actualHelperLaunches,closureNativeHelperExecutions:0}));
