// Finite fresh Phase 3B campaign. Exactly one attempt; the first failure stops it.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
import {root,E,S,C3RB,node,npm,cache,hash,read,json,rec,write,git,walk,inventory,controlledEnv,command,tarMembers,archiveIdentity,runtimeClosure} from './common.mjs';
const T='repositories/cca-conformance/tools/mo1307-phase3b-c3rb-cert';
const H='5cb213eeab8a6deec39a8f8f93ea13a70e053231';
const integration='4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const historicalRoot='C:/Users/melsa/Documents/Codex/r3b';
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const started=new Date().toISOString(), results=[];
const protocol=json(T+'/protocol.json');
if(fs.existsSync(path.join(root,E,'campaign-start.json')))throw new Error('NO_RERUN: campaign already started');
write(E+'/campaign-start.json',{startedUtc:started,source:C3RB,protocol:rec(T+'/protocol.json'),tooling:walk(path.join(root,T)).map(p=>rec(T+'/'+p)),attempt:1,noRetry:true});
let stage='initialization',sourceRows;
function gitBytes(commit,p){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+root.replaceAll('\\','/'),'show',commit+':'+p],{cwd:root,windowsHide:true,maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr?.toString());return r.stdout;}
function step(name,fn){stage=name;write(E+'/progress.json',{startedUtc:started,active:name,completed:results});const value=fn();results.push({name,result:'PASS',finishedUtc:new Date().toISOString()});write(E+'/progress.json',{startedUtc:started,active:null,completed:results});return value;}
function bindHistorical(p){const b=gitBytes(H,p);return {commit:H,...rec(p,b)};}
try{
step('candidate-toolchain-preflight',()=>{
  assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
  assert.equal(hash(fs.readFileSync(process.execPath)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');assert.equal(fs.statSync(process.execPath).size,93580104);
  assert.equal(git(['rev-parse','HEAD']),C3RB);assert.equal(git(['branch','--show-current']),'codex/mo1307-phase3b-c3rb-cert');
  assert.equal(git(['diff','--name-only',C3RB]),'');assert.equal(git(['diff','--cached','--name-only']),'');
  assert.equal(git(['rev-parse','HEAD'],historicalRoot),H);assert.equal(git(['status','--porcelain=v1'],historicalRoot),'');
  const hp=['docs/mo1307-phase3b-refresh.md',...git(['ls-tree','-r','--name-only',H,'--','repositories/cca-conformance/evidence/mo1307/phase3b-refresh','repositories/cca-conformance/tools/mo1307-phase3b-refresh']).split('\n').filter(Boolean),...packageFiles.map(p=>S+'/'+p)];
  const rows=hp.map(p=>{const b=gitBytes(H,p);assert.ok(b.equals(fs.readFileSync(path.join(historicalRoot,p))),p);return rec(p,b);});
  write(E+'/historical-before.json',{commit:H,root:historicalRoot,gitStatus:'',files:rows,scope:'Accepted Phase 3B-R report, complete evidence/tooling and shipped source; all read-only.'});
  const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  const os=JSON.parse(command('platform',ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',"$v=Get-CimInstance Win32_OperatingSystem; [pscustomobject]@{caption=$v.Caption;version=$v.Version;build=$v.BuildNumber;architecture=$v.OSArchitecture;powershell=$PSVersionTable.PSVersion.ToString()} | ConvertTo-Json -Compress"]).output);
  assert.match(os.caption,/Windows 11/);assert.match(os.architecture,/64/);assert.match(os.powershell,/^5\.1\./);
  write(E+'/baseline.json',{result:'PASS',source:C3RB,sourceTree:git(['rev-parse',C3RB+'^{tree}']),integrationAuthority:integration,acceptedHistorical3BR:H,worktree:root,branch:git(['branch','--show-current']),initialCleanObservation:json(E+'/setup.json').cleanBeforeTooling,platform:os,node:{...rec(node),version:process.version,components:process.versions},git:{...rec('C:/Program Files/Git/cmd/git.exe'),version:git(['--version'])},packageChecker:rec('repositories/cca-conformance/tools/mo1307-phase1/package.mjs'),workspaceChecker:rec('tools/verify_workspace.py'),startedUtc:started,productionChanges:0});
});
step('source-package-contract-distribution-sbom-closure',()=>{
  const check=checkPackage(path.join(root,S));sourceRows=inventory(path.join(root,S));assert.deepEqual(sourceRows.map(r=>r.path),packageFiles);assert.equal(sourceRows.length,89);
  const blobRows=git(['ls-tree','-r',C3RB,'--',S]).split('\n').map(l=>{const [meta,p]=l.split('\t');return {path:p,blob:meta.split(' ')[2]};});assert.equal(blobRows.length,89);
  for(const r of blobRows){const b=read(r.path);assert.equal(hash(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b]),'sha1'),r.blob,r.path);}
  const pkg=json(S+'/package.json');assert.deepEqual(pkg.dependencies,{});assert.ok(!('scripts' in pkg));
  const distribution=json(S+'/distribution-manifest.json'),contract=json(S+'/contracts/contract.json'),sbom=json(S+'/sbom.spdx.json');
  assert.equal(distribution.files.length,88);assert.equal(contract.files.length,53);assert.equal(sbom.files.length,87);assert.equal(sbom.packages.length,1);assert.equal(sbom.relationships.length,88);
  const old=JSON.parse(gitBytes(H,'repositories/cca-conformance/evidence/mo1307/phase3b-refresh/candidate.json'));assert.equal(old.source,C3RB);
  write(E+'/source-inventory.json',{result:'PASS',source:C3RB,check,gitBlobs:blobRows,members:sourceRows});
  write(E+'/distribution.json',{result:'PASS',identity:rec(S+'/distribution-manifest.json'),rows:88,manifest:distribution,canonical:true});
  write(E+'/contract.json',{result:'PASS',identity:rec(S+'/contracts/contract.json'),rows:53,schemas:52,generatedRuntimeTablesMatch:true});
  write(E+'/sbom.json',{result:'PASS',semanticCheck:'Exact frozen generated SPDX document recomputed by checkPackage',identity:rec(S+'/sbom.spdx.json'),packages:1,files:87,relationships:88,verificationCode:sbom.packages[0].packageVerificationCode,fullSchemaValidation:'document-validation.json'});
  write(E+'/runtime-closure.json',runtimeClosure(path.join(root,S)));
});
step('toolchain-schema-reuse-licenses',()=>{command('supply',node,[path.join(root,T,'supply.mjs')],{timeout:240000});});
step('full-pinned-document-validation',()=>{const r=command('documents',python,['-I','-S','-B',path.join(root,T,'validate-documents.py')],{timeout:120000});const v=JSON.parse(r.output);assert.equal(v.result,'PASS');write(E+'/document-validation.json',v);});
step('independent-assemblies',()=>{
  const npmVersion=command('npm-version',node,[npm,'--version']).output.trim();assert.equal(npmVersion,'11.19.0');
  const assemblies=[];
  for(const id of ['a','b']){
    const base=path.join(cache,'assembly-'+id);assert.ok(!fs.existsSync(base),'Fresh assembly required');
    const pkg=path.join(base,'package'),out=path.join(base,'out'),npmCache=path.join(base,'npm-cache');for(const p of [pkg,out,npmCache])fs.mkdirSync(p,{recursive:true});
    for(const member of packageFiles){const dest=path.join(pkg,member);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,read(S+'/'+member));}
    assert.deepEqual(inventory(pkg),sourceRows);checkPackage(pkg);assert.deepEqual(walk(npmCache),[]);
    for(const p of ['user.npmrc','global.npmrc'])fs.writeFileSync(path.join(base,p),'');
    const args=[npm,'pack','--offline','--ignore-scripts','--json','--no-audit','--no-fund','--cache',npmCache,'--userconfig',path.join(base,'user.npmrc'),'--globalconfig',path.join(base,'global.npmrc'),'--pack-destination',out];
    const run=command('assembly-'+id,node,args,{cwd:pkg,env:controlledEnv(path.join(base,'home'))});const metadata=JSON.parse(run.output);assert.equal(metadata.length,1);assert.equal(metadata[0].filename,'memoryos-readiness-0.1.0.tgz');
    const archive=path.join(out,metadata[0].filename),b=fs.readFileSync(archive),members=tarMembers(b);
    for(const m of members)assert.ok(m.data.equals(read(S+'/'+m.path.slice(8))),m.path);assert.deepEqual(inventory(pkg),sourceRows);
    assemblies.push({id,root:base,archive:rec(archive,b),sourceMembers:sourceRows,command:rec(E+'/commands/assembly-'+id+'.json'),npmMetadata:metadata[0],initialCacheEmpty:true,userConfig:rec(path.join(base,'user.npmrc')),globalConfig:rec(path.join(base,'global.npmrc'))});
    write(E+'/assemblies-progress.json',{assemblies});
  }
  const a=fs.readFileSync(assemblies[0].archive.path),b=fs.readFileSync(assemblies[1].archive.path);assert.ok(a.equals(b),'Independent archive bytes differ');
  const selected=E+'/memoryos-readiness-0.1.0.tgz';write(selected,a);const identity=archiveIdentity(selected);
  for(const r of assemblies)assert.equal(r.npmMetadata.integrity,identity.integrity);
  const priorPath='repositories/cca-conformance/evidence/mo1307/phase3b-refresh/memoryos-readiness-0.1.0.tgz',prior=gitBytes(H,priorPath);assert.ok(a.equals(prior),'Exact C3RB archive differs from accepted historical identity');
  write(E+'/candidate.json',{result:'PASS',source:C3RB,package:'memoryos-readiness@0.1.0',contract:'memoryos.readiness@1.0.0',memberCount:89,...identity});
  write(E+'/assemblies.json',{result:'PASS',assemblies,independentFreshRoots:true,archiveBytesEqual:true,selected:identity,historicalExactC3RBComparison:{...bindHistorical(priorPath),equal:true,archiveReused:false}});
  write(E+'/archive-inventory.json',{result:'PASS',archive:identity,members:tarMembers(a).map(({data,...r})=>r),missing:[],unexpected:[],unsafe:[],nonregular:[],sourceBytesEqual:true});
});
step('fresh-offline-install',()=>{
  const install=path.join(cache,'installed'),installCache=path.join(cache,'install-cache');assert.ok(!fs.existsSync(install));assert.ok(!fs.existsSync(installCache));fs.mkdirSync(install,{recursive:true});fs.mkdirSync(installCache,{recursive:true});
  fs.writeFileSync(path.join(install,'package.json'),JSON.stringify({private:true,name:'mo1307-3b-c3rb-install',version:'1.0.0'})+'\n');for(const n of ['user.npmrc','global.npmrc'])fs.writeFileSync(path.join(install,n),'');assert.deepEqual(walk(installCache),[]);
  const args=[npm,'install',path.join(root,E,'memoryos-readiness-0.1.0.tgz'),'--offline','--ignore-scripts','--no-audit','--no-fund','--package-lock=false','--cache',installCache,'--userconfig',path.join(install,'user.npmrc'),'--globalconfig',path.join(install,'global.npmrc')];
  command('offline-install',node,args,{cwd:install,env:controlledEnv(path.join(cache,'install-home'))});const pkg=path.join(install,'node_modules/memoryos-readiness');assert.deepEqual(inventory(pkg),sourceRows);checkPackage(pkg);assert.deepEqual(fs.readdirSync(path.join(install,'node_modules')).filter(n=>!n.startsWith('.')),['memoryos-readiness']);
  write(E+'/offline-install.json',{result:'PASS',archive:json(E+'/candidate.json'),command:rec(E+'/commands/offline-install.json'),packageDirectory:pkg,root:install,emptyCache:true,offline:true,scripts:false,audit:false,fund:false,networkFallback:false,productionDependencies:0});
  write(E+'/installed-inventory-before.json',{result:'PASS',root:pkg,members:inventory(pkg),archiveAndSourceParity:true});
});
step('installed-package-smoke-and-persistence',()=>{command('installed-smoke-driver',node,[path.join(root,T,'smoke.mjs')],{timeout:90000});});
step('tamper-controls',()=>{command('tamper',node,[path.join(root,T,'tamper.mjs')],{timeout:90000});assert.equal(json(E+'/tamper-controls.json').count,22);});
step('bounded-advisory-handoff',()=>{command('advisory',node,[path.join(root,T,'advisory.mjs')]);});
step('workspace-and-preservation',()=>{
  command('workspace-verification',python,['-I','-B',path.join(root,'tools/verify_workspace.py'),'--root',root],{timeout:120000});
  assert.equal(git(['diff',C3RB,'--',S]),'');assert.equal(git(['rev-parse','HEAD'],historicalRoot),H);assert.equal(git(['status','--porcelain=v1'],historicalRoot),'');
  for(const r of json(E+'/historical-before.json').files){const b=fs.readFileSync(path.join(historicalRoot,r.path));assert.equal(b.length,r.byteLength);assert.equal(hash(b),r.sha256,r.path);}
  for(const r of json(E+'/campaign-start.json').tooling){assert.deepEqual(rec(r.path),r,'Campaign tool changed');}
  write(E+'/historical-preservation.json',{result:'PASS',commit:H,before:rec(E+'/historical-before.json'),filesRehashed:json(E+'/historical-before.json').files.length,gitStatus:'',historicalEvidenceRewritten:false});
});
assert.deepEqual(results.map(r=>r.name),protocol.executionStages);
write(E+'/execution.json',{result:'PASS',startedUtc:started,finishedUtc:new Date().toISOString(),source:C3RB,stages:results,mandatoryExecutionComplete:true,acceptancePendingSeal:true,attempt:1});
console.log(JSON.stringify({result:'PASS',candidate:json(E+'/candidate.json'),stages:results.length,pending:'Independent evidence review and immutable seal'}));
}catch(error){
 const failure={result:'FAILED/INCOMPLETE',source:C3RB,stage,startedUtc:started,stoppedUtc:new Date().toISOString(),error:{name:error.name,message:error.message,stack:error.stack,actual:error.actual,expected:error.expected},completed:results,notExecuted:protocol.executionStages.filter(p=>!results.some(r=>r.name===p)&&p!==stage),attempt:1,retry:false,productionRepaired:false,acceptedHandoff:false};
 write(E+'/failure.json',failure);console.error(JSON.stringify(failure,null,2));process.exitCode=1;
}
