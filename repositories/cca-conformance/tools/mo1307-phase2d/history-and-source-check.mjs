// Preserve exact historical evidence while allowing explicit current integration edits.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,evidence,baseline,sources,str,git,blobs,record,check,json,write,sourceState} from './common.mjs';
const names=str('ls-tree','-r','--name-only',baseline,'--','repositories/cca-conformance/evidence/mo1307').split('\n').filter(Boolean).sort();
const bytes=blobs(baseline,names),baselineEvidence=names.map((p,i)=>record(p,bytes[i]));for(const m of baselineEvidence)check(m);
const imported=json(evidence+'/source-import.json').members.filter(m=>m.category==='evidence');
for(const m of imported)check(m);
for(const source of sources){const state=sourceState(source);assert.equal(state.commit,source.commit);assert.deepEqual(state.parents,[source.base]);assert.equal(state.subject,source.subject);assert.equal(state.status,'');}
const blocked='C:/Users/melsa/Documents/Codex/cca-mo1307-2c',args=['-c','safe.directory='+blocked,'-C',blocked];
const captured=json('repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction/history/original-phase2c/changed-file-inventory.json');
assert.equal(git(...args,'status','--porcelain=v1','--untracked-files=all').toString('utf8'),captured.before.status);
assert.equal(str(...args,'rev-parse','HEAD'),captured.before.head);
for(const m of captured.files)check(m,fs.readFileSync(path.join(blocked,m.path)));
const result={kind:'MO1307Phase2DHistoricalPreservation',version:'1.0.0',result:'PASS',baseline,
 baselineEvidenceCount:baselineEvidence.length,importedAcceptedEvidenceCount:imported.length,originalBlockedFiles:captured.files.length,
 baselineEvidence,importedEvidence:imported,sourceWorktrees:sources.map(s=>({id:s.id,path:s.worktree,...sourceState(s)})),
 preservedDispositions:['CONTRACT_INTERFACE_BLOCKER','ENVIRONMENT_BLOCKER','CONTRACT_DEFECT','ALL_RETAINED_FAILED_DEVELOPMENT_ATTEMPTS'],
 rule:'Existing evidence remains byte-identical. Historical source pins are interpreted against their original exact Git commits; current integration acceptance uses new Phase2D receipts.',historicalFailuresRelabeled:false};
if(process.argv[2]==='--record')write(evidence+'/historical-preservation.json',result);
console.log(JSON.stringify({result:'PASS',baselineEvidenceCount:baselineEvidence.length,importedAcceptedEvidenceCount:imported.length,originalBlockedFiles:captured.files.length,sourceWorktrees:'UNCHANGED_CLEAN'}));
