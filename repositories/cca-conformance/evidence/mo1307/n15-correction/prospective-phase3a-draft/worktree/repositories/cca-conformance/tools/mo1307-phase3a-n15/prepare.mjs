import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {checkPackage,packageFiles} from '../mo1307-phase1/package.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const rel='repositories/cca-conformance/evidence/mo1307/phase3a-n15';
const E=path.join(root,rel),cache=path.join(root,'.cache/m7n1'),source=path.join(root,'repositories/memoryos-readiness');
const installed=path.join(cache,'install/node_modules/memoryos-readiness');
// SCRATCH TEMPLATE: activation.json is created only after every correction validation passes.
const activationPath=path.join(E,'activation.json');
const activation=JSON.parse(fs.readFileSync(activationPath,'utf8'));
assert.equal(activation.kind,'MO1307N15Phase3AActivation');
assert.equal(activation.status,'CANDIDATE_BOUND_AFTER_ALL_VALIDATION_PASS');
assert.match(activation.candidate,/^[0-9a-f]{40}$/u);
assert.match(activation.packageTree,/^[0-9a-f]{40}$/u);
assert.equal(activation.worktree,'C:/m7n1');
assert.equal(activation.branch,'codex/mo1307-phase3a-n15');
const HEAD=activation.candidate,C3RB='defe93989efc6501b1a730b82e79e705884b269b',integration='4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const record=p=>{const b=fs.readFileSync(p);return {path:path.relative(root,p).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const walk=(base,prefix='')=>fs.readdirSync(path.join(base,prefix),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(e=>{const p=prefix?prefix+'/'+e.name:e.name,full=path.join(base,p),s=fs.lstatSync(full);assert.ok(!s.isSymbolicLink(),full);return s.isDirectory()?walk(base,p):[{...record(full),path:p}];});
const put=(name,bytes)=>{const p=path.join(E,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes,{flag:'wx'});return record(p);};
const write=(name,obj)=>put(name,Buffer.from(JSON.stringify(obj,null,2)+'\n'));
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'};
function git(...args){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory=C:/m7n1',...args],{cwd:root,windowsHide:true,encoding:null,maxBuffer:128*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
assert.equal(path.resolve(root).toLowerCase(),'c:\\m7n1');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(git('rev-parse','HEAD').toString().trim(),HEAD);
assert.notEqual(HEAD,C3RB,'A new candidate is mandatory');
assert.equal(git('rev-parse',HEAD+':repositories/memoryos-readiness').toString().trim(),activation.packageTree);
assert.equal(git('branch','--show-current').toString().trim(),'codex/mo1307-phase3a-n15');
assert.equal(fs.existsSync(cache),false,'Fresh explicit installation/cache must not exist');
assert.equal(fs.existsSync(path.join(E,'baseline.json')),false);
// Validate completed correction evidence before creating any preparation outputs/cache.
const validationRoot='C:/m7fix',validationRel='repositories/cca-conformance/evidence/mo1307/n15-correction';
const externalRecord=(base,row)=>{assert.ok(!path.isAbsolute(row.path)&&!row.path.split(/[\\/]/u).includes('..'));const f=path.join(base,row.path),bytes=fs.readFileSync(f);const actual={path:row.path,byteLength:bytes.length,sha256:hash(bytes)};assert.deepEqual(actual,row);return {...actual,absolutePath:f};};
const validationManifestBinding=externalRecord(validationRoot,activation.validationManifest);
assert.equal(activation.validationManifest.path,validationRel+'/validation-source.json');
const validation=JSON.parse(fs.readFileSync(validationManifestBinding.absolutePath,'utf8'));
assert.equal(validation.kind,'MO1307N15CorrectionValidationSource');
assert.equal(validation.status,'VALIDATION_SOURCE_NOT_YET_ACCEPTED_CANDIDATE');
assert.equal(validation.candidate,null);
assert.equal(validation.packageMembers.length,89);
assert.equal(validation.sourceIdentity,hash(Buffer.from(JSON.stringify(validation.packageMembers)+'\n')));
const production=walk(source),packagePrefix='repositories/memoryos-readiness/';
assert.deepEqual(production.map(x=>x.path),[...packageFiles].sort());
assert.equal(production.length,89);
const validatedLocal=validation.packageMembers.map(r=>{assert.ok(r.path.startsWith(packagePrefix));return {...r,path:r.path.slice(packagePrefix.length)};}).sort((a,b)=>a.path<b.path?-1:1);
assert.deepEqual(production,validatedLocal,'Fresh candidate must equal the exact validated 89 bytes');
for(const row of production)assert.equal(row.sha256,hash(git('show',HEAD+':'+packagePrefix+row.path)),row.path);
const sourceCheck=checkPackage(source);assert.equal(sourceCheck.members,89);assert.equal(sourceCheck.contractMembers,53);assert.equal(sourceCheck.externalProductionDependencies,0);
const validationClosure=validation.inputs.map(row=>externalRecord(validationRoot,row));
assert.deepEqual(validation.executionOrder,['n15','native-filesystem','security','regressions','toctou']);
assert.equal(validation.regressionTests,107);assert.equal(validation.remainingSelectedTests,106);
assert.equal(validation.filesystem.expectedCases,35);assert.equal(validation.filesystem.expectedHelperInvocations,39);
assert.equal(fs.existsSync(path.join(validationRoot,validationRel,'generation-stopped.json')),false,'Stopped validation cannot admit a candidate');
const expectedReceipts=validation.executionOrder.map(n=>validationRel+'/'+n+'/receipt.json');
assert.deepEqual(activation.validationReceipts.map(r=>r.path),expectedReceipts);
const receiptsByStage=new Map(),validationReceipts=activation.validationReceipts.map(row=>{
 const binding=externalRecord(validationRoot,row),receipt=JSON.parse(fs.readFileSync(binding.absolutePath,'utf8'));
 assert.equal(receipt.kind,'MO1307N15CorrectionEngineeringReceipt');assert.equal(receipt.result,'PASS');assert.equal(receipt.failure,null);
 assert.equal(receipt.sourcesUnchanged,true);assert.equal(receipt.sourceFailure,null);assert.equal(receipt.sourceIdentity,validation.sourceIdentity);assert.deepEqual(receipt.source,activation.validationManifest);assert.equal(receipt.acceptedCandidate,null);assert.equal(receipt.retries,0);
 const stage=row.path.split('/').at(-2);receiptsByStage.set(stage,receipt);
 if(stage!=='security')assert.deepEqual(receipt.notRun,[]);
 if(stage==='n15'){assert.equal(receipt.expectedTests,1);assert.equal(receipt.selectedTestPasses,1);assert.equal(receipt.freshSelectedTestPasses,1);assert.deepEqual(receipt.completedSelectedIds,['native-foundation-016']);assert.deepEqual(receipt.commands.map(r=>r.id),['native-foundation-016']);assert.ok(receipt.commands.every(r=>r.result==='PASS'));assert.equal(receipt.historicalResultsPromoted,0);}
 if(stage==='native-filesystem'){assert.deepEqual(receipt.rows.map(r=>r.name),validation.filesystem.cases);assert.equal(receipt.rows.length,35);assert.equal(receipt.passed,35);assert.equal(receipt.failed,0);assert.equal(receipt.invocations.length,39);}
 if(stage==='security'){assert.deepEqual(receipt.rows.map(r=>r.id),'ABCDEFGHIJKLMNOPQRS'.split(''));assert.ok(receipt.rows.every(r=>r.result==='PASS'));assert.deepEqual(receipt.packageMembers,validation.packageMembers);assert.equal(receipt.sourceUnchanged,true);}
 if(stage==='regressions'){assert.equal(receipt.expectedTests,107);assert.equal(receipt.freshSelectedTests,106);assert.equal(receipt.freshSelectedTestPasses,106);assert.equal(receipt.selectedTestPasses,107);assert.equal(receipt.commands.length,107);assert.ok(receipt.commands.every(r=>r.result==='PASS'));assert.equal(receipt.historicalResultsPromoted,0);assert.deepEqual(receipt.sameGenerationN15,activation.validationReceipts[0]);assert.equal(receipt.completedSelectedIds.length,107);assert.equal(new Set(receipt.completedSelectedIds).size,107);assert.equal(receipt.completedSelectedIds.filter(id=>id==='native-foundation-016').length,1);assert.equal(receipt.commands.filter(r=>r.id==='native-foundation-016').length,0);}
 if(stage==='toctou'){assert.deepEqual(receipt.rows.map(r=>r.id),validation.toctouCases);assert.equal(receipt.rows.length,2);assert.ok(receipt.rows.every(r=>r.result==='PASS'));}
 return binding;
});
const supportPaths=['correction-decision.json','security-dependency-review.json','native-binding-metadata/receipt.json'].map(n=>validationRel+'/'+n);
assert.deepEqual(activation.validationSupport.map(r=>r.path),supportPaths);
const validationSupport=activation.validationSupport.map(row=>externalRecord(validationRoot,row));
const decision=JSON.parse(fs.readFileSync(validationSupport[0].absolutePath,'utf8'));assert.equal(decision.result,'APPROVED_FOR_N15_VALIDATION');assert.deepEqual(decision.source,validation.packageMembers);assert.ok(Array.isArray(decision.evidence)&&decision.evidence.length>0);assert.equal(new Set(decision.evidence.map(r=>r.path)).size,decision.evidence.length);assert.deepEqual(validation.prerequisites,[activation.validationSupport[0],...decision.evidence]);for(const binding of validation.prerequisites)validationSupport.push(externalRecord(validationRoot,binding));
const securityReview=JSON.parse(fs.readFileSync(validationSupport[1].absolutePath,'utf8'));assert.equal(securityReview.result,'PASS_STATIC');assert.equal(securityReview.sourceIdentity,validation.sourceIdentity);assert.deepEqual(securityReview.historicalRows,[]);assert.deepEqual(securityReview.freshRows.map(r=>r.id),'ABCDEFGHIJKLMNOPQRS'.split(''));for(const row of securityReview.freshRows){assert.equal(row.result,'PASS');assert.equal(row.sourceIdentity,validation.sourceIdentity);validationSupport.push(externalRecord(validationRoot,row.receipt));}for(const binding of securityReview.bindings)validationSupport.push(externalRecord(validationRoot,binding));
const nativeMetadata=JSON.parse(fs.readFileSync(validationSupport[2].absolutePath,'utf8'));assert.equal(nativeMetadata.result,'PASS');assert.equal(nativeMetadata.sourceUnchanged,true);assert.equal(nativeMetadata.nativeApiInvocations,0);assert.equal(nativeMetadata.helperRequests,0);
const n15=receiptsByStage.get('n15'),captureBinding=externalRecord(validationRoot,n15.commands[0].nativeCapture),capture=JSON.parse(fs.readFileSync(captureBinding.absolutePath,'utf8'));validationSupport.push(captureBinding);
assert.deepEqual(capture.frames.map(r=>[r.sequence,r.operation,r.status]),[[1,'READ_SET','OK'],[2,'READ_SET','OK'],[3,'READ_SET','OK'],[4,'READ_SET','OK'],[4,'CHECK_OUTPUT','ABSENT'],[5,'CHECK_OUTPUT','ABSENT'],[6,'INSPECT_OUTPUT_ROOT','OK'],[7,'CHECK_STAGE_ROOT','OK'],[8,'INSPECT_PENDING','OK'],[9,'CHECK_FINALIZATION','FINAL_ABSENT']]);assert.ok(capture.frames.every(r=>!r.decodeFailure&&r.code===null&&r.stderrBytes===0&&r.responseSessionMatches&&r.responseSequence===r.sequence&&r.responseOperation===r.operation));for(const {path:bindingPath,byteLength,sha256} of capture.files)validationSupport.push(externalRecord(validationRoot,{path:bindingPath,byteLength,sha256}));
const authorityPaths=[validationRel+'/authorization.txt','docs/mo1307-n15-correction.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt','docs/mo1307-final-headless-correction-addendum.md'];
assert.deepEqual(activation.authorityBindings.map(r=>r.path),authorityPaths);
const correctionAuthority=activation.authorityBindings.map(row=>{const external=externalRecord(validationRoot,row);assert.deepEqual(record(path.join(root,row.path)),row,'Candidate checkout must carry the same prospective authority bytes');return external;});
const startedAt=new Date().toISOString(),hardStopAt=new Date(Date.now()+90*60000).toISOString();
write('campaign-config.json',{generation:'N15_CORRECTED_NATIVE_INSTALLED_FRESH',startedAt,hardStopAt,engineeringBudgetMinutes:90,productDeadlinesUnchanged:true,candidate:HEAD,productionBaseline:C3RB,integrationAuthority:integration,H:'NOT_ESTABLISHED',nodeExecutable:process.execPath});
put('generation-authorization.txt',fs.readFileSync(correctionAuthority[0].absolutePath));
write('candidate-validation-gate.json',{result:'PASS',candidate:HEAD,packageTree:activation.packageTree,productionBaseline:C3RB,validationSourceIdentity:validation.sourceIdentity,validationManifest:validationManifestBinding,validationReceipts,validationSupport,validationClosure,correctionAuthority,sourceMembers:production,activation:record(activationPath),historicalEvidencePromoted:false});
const historical=[];
for(const historicRoot of ['C:/Users/melsa/Documents/Codex/r3a','C:/Users/melsa/Documents/Codex/cca-mo1307-3a','C:/m7a','C:/m7a2','C:/m7fix']){
  for(const section of ['repositories/cca-conformance/evidence/mo1307','repositories/cca-conformance/tools','docs']){
    const base=path.join(historicRoot,section);assert.ok(fs.existsSync(base),'Historical source missing: '+base);
    for(const name of fs.readdirSync(base).filter(n=>/phase3a|console-correction|wire-repair|startup-exit22|headless-cleanup|startup-resolution|final-headless|n15-correction/u.test(n)).sort()){
      const full=path.join(base,name);
      if(fs.statSync(full).isDirectory())for(const row of walk(full))historical.push({...record(path.join(full,row.path)),absolutePath:path.join(full,row.path)});
      else historical.push({...record(full),absolutePath:full});
    }
  }
}
write('historical-before.json',{result:'PRESERVATION_BASELINE',members:historical,promotion:false,readOnly:true});
write('candidate-before.json',{candidate:HEAD,productionBaseline:C3RB,integrationAuthority:integration,parent:git('show','-s','--format=%P','HEAD').toString().trim(),tree:git('rev-parse','HEAD^{tree}').toString().trim(),members:production,check:sourceCheck,initialStatus:git('status','--porcelain=v1','--untracked-files=all').toString(),productionGitDiff:git('diff','--name-only',HEAD,'--','repositories/memoryos-readiness').toString()});
fs.mkdirSync(cache,{recursive:true});
function command(id,exe,args,cwd=root,extra={}){const start=performance.now();const r=spawnSync(exe,args,{cwd,env:{...env,...extra},windowsHide:true,shell:false,encoding:null,timeout:120000,maxBuffer:16*1024*1024});write(id+'.json',{executable:exe,args,cwd,exit:r.status,error:r.error?.code??null,elapsedMs:performance.now()-start,stdout:put(id+'.stdout.data',r.stdout??Buffer.alloc(0)),stderr:put(id+'.stderr.data',r.stderr??Buffer.alloc(0))});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const script="$os=Get-CimInstance Win32_OperatingSystem; $cs=Get-CimInstance Win32_ComputerSystem; [ordered]@{osCaption=$os.Caption;version=$os.Version;build=$os.BuildNumber;architecture=$os.OSArchitecture;manufacturer=$cs.Manufacturer;model=$cs.Model;powerShellPath=(Get-Process -Id $PID).Path;powerShellVersion=$PSVersionTable.PSVersion.ToString();policy=@(Get-ExecutionPolicy -List | ForEach-Object {[ordered]@{scope=$_.Scope.ToString();policy=$_.ExecutionPolicy.ToString()}})} | ConvertTo-Json -Depth 5 -Compress";
const system=JSON.parse(command('environment-capture',ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',script]));
assert.match(system.powerShellVersion,/^5\.1\./);assert.match(system.osCaption,/Windows 11/);assert.match(system.architecture,/64/);
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
assert.equal(command('npm-version',process.execPath,[npm,'--version']).toString().trim(),'11.19.0');
write('runtime.json',{result:'PASS',node:{executable:process.execPath,version:process.version,arch:process.arch,platform:process.platform,...record(process.execPath)},powershell:{...system,identity:record(ps)},npm:{path:npm,version:'11.19.0',identity:record(npm),engineeringOnly:true},launchEnvironment:env,networkRequired:false,persistentPolicyMutation:false});
for(const n of ['npm-cache','install','cwd'])fs.mkdirSync(path.join(cache,n));
for(const n of ['user.npmrc','global.npmrc'])fs.writeFileSync(path.join(cache,n),'',{flag:'wx'});
const npmArgs=['--offline','--ignore-scripts','--no-audit','--no-fund','--cache',path.join(cache,'npm-cache'),'--userconfig',path.join(cache,'user.npmrc'),'--globalconfig',path.join(cache,'global.npmrc')];
const extra={PATH:path.dirname(process.execPath),TEMP:cache,TMP:cache};
const packed=JSON.parse(command('package-pack',process.execPath,[npm,'pack','--json','--pack-destination',cache,...npmArgs],source,extra));
assert.equal(packed.length,1);assert.deepEqual(packed[0].files.map(r=>r.path).sort(),[...packageFiles]);
const archive=path.join(cache,packed[0].filename),archiveBinding=put('package/memoryos-readiness-0.1.0.tgz',fs.readFileSync(archive));
fs.writeFileSync(path.join(cache,'install/package.json'),JSON.stringify({name:'mo1307-phase3a-n15-offline',version:'1.0.0',private:true})+'\n',{flag:'wx'});
command('offline-install',process.execPath,[npm,'install',archive,...npmArgs],path.join(cache,'install'),extra);
const members=walk(installed);assert.equal(members.length,89);assert.deepEqual(members,production);const installedCheck=checkPackage(installed);
write('installed-before.json',{result:'PASS',members,packageRoot:installed,sourceCandidateAndValidatedMembersEqual:true,check:installedCheck,noScripts:true,offline:true});
write('candidate-identity.json',{result:'PASS',candidate:HEAD,productionBaseline:C3RB,packageTree:activation.packageTree,validationGate:record(path.join(E,'candidate-validation-gate.json')),packageRoot:installed,packageName:'memoryos-readiness',version:'0.1.0',members:89,archive:archiveBinding,npmPack:packed[0],repositoryAuthority:record(path.join(root,'repositories/cca-conformance/tools/mo1307-phase1/package.mjs')),duplicate3B:false});
write('baseline.json',{result:'PASS',startedAt,hardStopAt,HEAD,branch:'codex/mo1307-phase3a-n15',installed:members,source:production,candidate:{name:'memoryos-readiness',version:'0.1.0',members:89,archive:archiveBinding},runtime:record(process.execPath),productionChanges:0});
const names=['mo1306-qualified','ready','not-ready','could-not-evaluate','rest-qualified','qualified','post-tag-ready','pre-tag-present','post-tag-absent','post-tag-lightweight','post-tag-wrong-target'];
const vectors=names.map((name,index)=>{const src=path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles',name),base=path.join(cache,'v'+index),inputRoot=path.join(base,'i'),parent=path.join(base,'p');fs.mkdirSync(parent,{recursive:true});fs.cpSync(src,inputRoot,{recursive:true});fs.writeFileSync(path.join(parent,'owned-parent.txt'),'Private stable parent for fresh N15-corrected candidate certification.\n',{flag:'wx'});return {name,index,inputRoot,parent,source:walk(src),input:walk(inputRoot),expected:record(path.join(src,'expected-result.json'))};});
write('vectors-prepared.json',{vectors});
const {loadBundle,envelopeFor,repin}=await import('../mo1307-phase2b/test-support.mjs');
const bundle=loadBundle('post-tag-ready');envelopeFor(bundle,'TAG_OBSERVATION').claim.detail.name='memoryos-1.3-wrong-tag';const input=repin(bundle);
const inputRoot=path.join(cache,'wrong-name-input');fs.mkdirSync(inputRoot);
for(const [name,b]of [['configuration.json',input.configurationBytes],['candidate.json',input.candidateBytes],['authority.json',input.authorityBytes],['manifest.json',input.manifestBytes]])fs.writeFileSync(path.join(inputRoot,name),b,{flag:'wx'});
for(const entry of bundle.manifest.entries){const file=path.join(inputRoot,entry.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bundle.files.get(entry.id),{flag:'wx'});}
const {assessInWorker}=await import(pathToFileURL(path.join(installed,'src/integration.mjs')).href);
const expected=Buffer.from(assessInWorker(input,false).resultBytes),result=JSON.parse(expected);
assert.equal(result.assessment.readiness,'NOT_READY');assert.ok(result.assessment.blockers.some(x=>x.gateId==='tag'&&x.checkCode==='TAG_NAME'));
const expectedPath=path.join(E,'prepared-wrong-name/expected-result.json');put('prepared-wrong-name/expected-result.json',expected);
write('wrong-name-prepared.json',{inputRoot,expectedPath,pins:{expectedCandidateDigest:input.expectedCandidateDigest,trustedAuthorityDigest:input.trustedAuthorityDigest},result,input:walk(inputRoot),derivation:'Frozen Phase2D D11 wrong-name mutation. One pure installed semantic oracle before sealing, not a CLI/API/helper/worker execution or certification observation.',oracle:record(path.join(installed,'src/integration.mjs')),authority:record(path.join(root,'repositories/cca-conformance/tests/mo1307_phase2d_semantic_test.mjs'))});
console.log(JSON.stringify({result:'PASS',phase:'PREPARATION_ONLY',archive:archiveBinding,installed:members.length,historical:historical.length,runtime:system.powerShellVersion,certificationCasesExecuted:0}));


