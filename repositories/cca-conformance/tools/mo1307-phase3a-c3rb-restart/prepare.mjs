import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {checkPackage,packageFiles} from '../mo1307-phase1/package.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const rel='repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart';
const E=path.join(root,rel),cache=path.join(root,'.cache/m7a2'),source=path.join(root,'repositories/memoryos-readiness');
const installed=path.join(cache,'install/node_modules/memoryos-readiness');
const C3RB='defe93989efc6501b1a730b82e79e705884b269b',integration='4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const record=p=>{const b=fs.readFileSync(p);return {path:path.relative(root,p).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const walk=(base,prefix='')=>fs.readdirSync(path.join(base,prefix),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(e=>{const p=prefix?prefix+'/'+e.name:e.name,full=path.join(base,p),s=fs.lstatSync(full);assert.ok(!s.isSymbolicLink(),full);return s.isDirectory()?walk(base,p):[{...record(full),path:p}];});
const put=(name,bytes)=>{const p=path.join(E,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes,{flag:'wx'});return record(p);};
const write=(name,obj)=>put(name,Buffer.from(JSON.stringify(obj,null,2)+'\n'));
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'};
function git(...args){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:root,windowsHide:true,encoding:null,maxBuffer:128*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
assert.equal(path.resolve(root).toLowerCase(),'c:\\m7a2');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(git('rev-parse','HEAD').toString().trim(),C3RB);
assert.equal(git('rev-parse',C3RB+'^{tree}').toString().trim(),'54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb');
assert.equal(git('-C','C:/m7a','rev-parse','HEAD').toString().trim(),'7c2882480a4deebf39cae6b8afe42794f000539e');
assert.equal(git('-C','C:/m7a','status','--porcelain=v1','--untracked-files=all').toString(),'');
assert.equal(git('branch','--show-current').toString().trim(),'codex/mo1307-phase3a-c3rb-restart');
assert.equal(fs.existsSync(cache),false,'Fresh explicit installation/cache must not exist');
assert.equal(fs.existsSync(path.join(E,'baseline.json')),false);
const startedAt=new Date().toISOString(),hardStopAt=new Date(Date.now()+90*60000).toISOString();
write('campaign-config.json',{generation:'C3RB_NATIVE_INSTALLED_RESTART_AFTER_J_20260930',startedAt,hardStopAt,engineeringBudgetMinutes:90,productDeadlinesUnchanged:true,candidate:C3RB,integrationAuthority:integration,H:'NOT_ESTABLISHED',nodeExecutable:process.execPath});
put('generation-authorization.txt',fs.readFileSync('C:/Users/melsa/.codex/attachments/bd0f157e-7a34-4375-81c6-9ab578808cff/Pasted text.txt'));
const production=walk(source);
assert.deepEqual(production.map(x=>x.path),[...packageFiles].sort());
for(const row of production)assert.equal(row.sha256,hash(git('show',C3RB+':repositories/memoryos-readiness/'+row.path)),row.path);
const sourceCheck=checkPackage(source);
const historical=[];
for(const historicRoot of ['C:/Users/melsa/Documents/Codex/r3a','C:/Users/melsa/Documents/Codex/cca-mo1307-3a','C:/m7a']){
  for(const section of ['repositories/cca-conformance/evidence/mo1307','repositories/cca-conformance/tools','docs']){
    const base=path.join(historicRoot,section);
    for(const name of fs.readdirSync(base).filter(n=>n.includes('phase3a')).sort()){
      const full=path.join(base,name);
      if(fs.statSync(full).isDirectory())for(const row of walk(full))historical.push({...record(path.join(full,row.path)),absolutePath:path.join(full,row.path)});
      else historical.push({...record(full),absolutePath:full});
    }
  }
}
write('historical-before.json',{result:'PRESERVATION_BASELINE',members:historical,promotion:false,readOnly:true});
write('candidate-before.json',{candidate:C3RB,integrationAuthority:integration,parent:git('show','-s','--format=%P','HEAD').toString().trim(),tree:git('rev-parse','HEAD^{tree}').toString().trim(),members:production,check:sourceCheck,initialStatus:git('status','--porcelain=v1','--untracked-files=all').toString(),productionGitDiff:git('diff','--name-only',C3RB,'--','repositories/memoryos-readiness').toString()});
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
fs.writeFileSync(path.join(cache,'install/package.json'),JSON.stringify({name:'mo1307-phase3a-c3rb-restart-offline',version:'1.0.0',private:true})+'\n',{flag:'wx'});
command('offline-install',process.execPath,[npm,'install',archive,...npmArgs],path.join(cache,'install'),extra);
const members=walk(installed);assert.equal(members.length,89);assert.deepEqual(members,production);const installedCheck=checkPackage(installed);
write('installed-before.json',{result:'PASS',members,packageRoot:installed,sourceAndC3RBEqual:true,check:installedCheck,noScripts:true,offline:true});
write('candidate-identity.json',{result:'PASS',C3RB,packageRoot:installed,packageName:'memoryos-readiness',version:'0.1.0',members:89,archive:archiveBinding,npmPack:packed[0],repositoryAuthority:record(path.join(root,'repositories/cca-conformance/tools/mo1307-phase1/package.mjs')),duplicate3B:false});
write('baseline.json',{result:'PASS',startedAt,hardStopAt,HEAD:C3RB,branch:'codex/mo1307-phase3a-c3rb-restart',installed:members,source:production,candidate:{name:'memoryos-readiness',version:'0.1.0',members:89,archive:archiveBinding},runtime:record(process.execPath),productionChanges:0});
const names=['mo1306-qualified','ready','not-ready','could-not-evaluate','rest-qualified','qualified','post-tag-ready','pre-tag-present','post-tag-absent','post-tag-lightweight','post-tag-wrong-target'];
const vectors=names.map((name,index)=>{const src=path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles',name),base=path.join(cache,'v'+index),inputRoot=path.join(base,'i'),parent=path.join(base,'p');fs.mkdirSync(parent,{recursive:true});fs.cpSync(src,inputRoot,{recursive:true});fs.writeFileSync(path.join(parent,'owned-parent.txt'),'Private stable parent for fresh C3RB certification.\n',{flag:'wx'});return {name,index,inputRoot,parent,source:walk(src),input:walk(inputRoot),expected:record(path.join(src,'expected-result.json'))};});
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
