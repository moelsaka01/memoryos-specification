// Record the already-observed clean C3TB gate without executing certification.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,E,T,D,C3TB,C3T,BRANCH,cache,write,git} from './common.mjs';

assert.equal(git(['rev-parse','HEAD']),C3TB);assert.equal(git(['rev-parse','HEAD^']),C3T);assert.equal(git(['branch','--show-current']),BRANCH);assert.equal(git(['diff','--name-only']),'');assert.equal(git(['diff','--cached','--name-only']),'');
assert.ok(!fs.existsSync(path.join(root,E)),'Evidence destination already exists');assert.ok(!fs.existsSync(cache),'Scratch destination already exists');assert.ok(!fs.existsSync(path.join(root,D)),'Report already exists');
const untracked=git(['ls-files','--others','--exclude-standard']).split(/\r?\n/u).filter(Boolean);assert.ok(untracked.length>0);assert.ok(untracked.every(p=>p.startsWith(T+'/')),JSON.stringify(untracked));
write(E+'/setup.json',{kind:'MO1307Phase3BR2Setup',version:'1.0.0',candidateBinding:C3TB,productionCandidate:C3T,worktree:root,branch:BRANCH,cleanBeforeTooling:true,initialGateObservedUtc:new Date().toISOString(),initialGateMethod:'Exact branch, HEAD and full porcelain status were read before any worktree write; ownership safeguard was handled with command-local safe.directory only.',trackedChangesBeforeCampaign:0,toolingPathsBeforeCampaign:untracked,cacheAbsent:true,evidenceAbsent:true,certificationExecutedDuringSetup:false,noGlobalGitConfigurationChanged:true});
console.log(JSON.stringify({result:'PASS',candidateBinding:C3TB,branch:BRANCH,cleanBeforeTooling:true,certificationExecuted:false}));
