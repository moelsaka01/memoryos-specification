// Phase 3A engineering preparation. Never writes production or historical evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkPackage,packageFiles} from '../mo1307-phase1/package.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)), E=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3a'), cache=path.join(root,'.cache/mo1307-phase3a');
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const row=(file,base=root)=>{const b=fs.readFileSync(file);return {path:path.relative(base,file).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const write=(name,value)=>fs.writeFileSync(path.join(E,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const walk=p=>fs.readdirSync(p).sort().flatMap(n=>{const q=path.join(p,n);return fs.statSync(q).isDirectory()?walk(q):[q]});
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'};
const gitExe='C:\\Program Files\\Git\\cmd\\git.exe';
function command(id,exe,args,cwd=root,extraEnv={}){const start=performance.now();const r=spawnSync(exe,args,{cwd,env:{...env,...extraEnv},windowsHide:true,encoding:null,timeout:120000,maxBuffer:128*1024*1024});fs.writeFileSync(path.join(E,id+'.stdout.txt'),r.stdout??Buffer.alloc(0),{flag:'wx'});fs.writeFileSync(path.join(E,id+'.stderr.txt'),r.stderr??Buffer.alloc(0),{flag:'wx'});write(id+'.json',{executable:exe,args,cwd,exit:r.status,error:r.error?.code??null,elapsedMs:performance.now()-start,stdout:row(path.join(E,id+'.stdout.txt')),stderr:row(path.join(E,id+'.stderr.txt'))});assert.ifError(r.error);assert.equal(r.status,0,(r.stderr??'').toString());return r.stdout;}
function git(...args){const r=spawnSync(gitExe,['-c','safe.directory='+root,...args],{cwd:root,windowsHide:true,encoding:null,maxBuffer:128*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const B2=git('rev-parse','HEAD').toString().trim(), parent=git('show','-s','--format=%P','HEAD').toString().trim();
assert.equal(B2,'976d4a04d75dadc02e30215dd5a8ddeaa2352df8');assert.equal(parent,'198da12a6b67da0104e54f98d2c8fbecbbf4a840');
assert.equal(git('branch','--show-current').toString().trim(),'codex/mo1307-phase3a-runtime');
write('baseline.json',{kind:'MO1307Phase3ABaseline',taskStartedAt:'2026-09-29T09:14:00Z',capturedAt:new Date().toISOString(),root,B2,B2tree:git('rev-parse','HEAD^{tree}').toString().trim(),subject:git('show','-s','--format=%s','HEAD').toString().trim(),I2:parent,I2tree:git('rev-parse',parent+'^{tree}').toString().trim(),initialStatus:'CLEAN',initialStatusSource:'Read-only git status --porcelain=v1 --untracked-files=all before Phase3A writes',branch:'codex/mo1307-phase3a-runtime'});
const pkg=path.join(root,'repositories/memoryos-readiness');
const production=packageFiles.map(p=>row(path.join(pkg,p),pkg));
for(const r of production)assert.equal(hash(git('show',B2+':repositories/memoryos-readiness/'+r.path)),r.sha256,r.path);
assert.equal(git('diff',parent,B2,'--','repositories/memoryos-readiness').length,0);
write('production-before.json',{result:'PASS',B2,packageCheck:checkPackage(pkg),packageRoot:pkg,members:production});
const authorities=['mo1307-contract-freeze-1.md','mo1307-phase1-foundation.md','mo1307-phase2a-readiness-core.md','mo1307-phase2b-evidence-graph.md','mo1307-phase2c-publication-inspection-correction.md','mo1307-phase2c-finalization-boundary-correction.md','mo1307-phase2c-final.md','mo1307-phase2d-integration.md'].map(n=>row(path.join(root,'docs',n)));
write('authority-identities.json',{authorities,correctionPrecedence:'Only explicit targeted supersessions'});
const evidenceRoot=path.join(root,'repositories/cca-conformance/evidence/mo1307');
const historical=fs.readdirSync(evidenceRoot).filter(n=>n!=='phase3a').sort().flatMap(n=>walk(path.join(evidenceRoot,n))).map(p=>row(p));
write('historical-before.json',{members:historical,failedParents:['integration-attempt1','integration-attempt2','mo1306-attempt1','mo1306-attempt2','mo1306-diagnostic-attempt1'].map(n=>row(path.join(evidenceRoot,'phase2d/native',n,'receipt.json'))),rewritten:false});
const ps='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const psScript="$os=Get-CimInstance Win32_OperatingSystem; $cs=Get-CimInstance Win32_ComputerSystem; [ordered]@{osCaption=$os.Caption;version=$os.Version;build=$os.BuildNumber;architecture=$os.OSArchitecture;manufacturer=$cs.Manufacturer;model=$cs.Model;powerShellPath=(Get-Process -Id $PID).Path;powerShellVersion=$PSVersionTable.PSVersion.ToString();policy=@(Get-ExecutionPolicy -List | ForEach-Object {[ordered]@{scope=$_.Scope.ToString();policy=$_.ExecutionPolicy.ToString()}})} | ConvertTo-Json -Depth 5 -Compress";
const system=JSON.parse(command('environment-capture',ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',psScript]));
assert.match(system.powerShellVersion,/^5\.1\./);assert.match(system.osCaption,/Windows 11/);assert.match(system.architecture,/64/);
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'), python='C:\\Users\\melsa\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
const npmVersion=command('npm-version',process.execPath,[npm,'--version']).toString().trim();assert.equal(npmVersion,'11.19.0');
const pythonVersion=command('python-version',python,['-B','--version']).toString().trim();
write('environment.json',{...system,runtime:{path:process.execPath,version:process.version,arch:process.arch,...row(process.execPath,path.dirname(process.execPath))},npm:{path:npm,version:npmVersion,engineeringOnly:true},python:{path:python,version:pythonVersion,engineeringOnly:true},initialToolWrapper:'Initial read-only orchestration used host shell PowerShell 7.6.5. All fixed product helper and recorded environment commands use explicit Windows PowerShell 5.1; no PATH runtime substitution.'});
const blocks=[];
function octal(h,o,n,v){h.write(v.toString(8).padStart(n-1,'0')+'\0',o,n,'ascii');}
for(const r of production){const name='package/'+r.path;assert.ok(Buffer.byteLength(name)<=100);const b=fs.readFileSync(path.join(pkg,r.path)),h=Buffer.alloc(512);h.write(name,0,100,'utf8');octal(h,100,8,r.path.startsWith('bin/')?493:420);octal(h,108,8,0);octal(h,116,8,0);octal(h,124,12,b.length);octal(h,136,12,0);h.fill(32,148,156);h.write('0',156,1,'ascii');h.write('ustar\0',257,6,'ascii');h.write('00',263,2,'ascii');h.write(h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');blocks.push(h,b,Buffer.alloc((512-b.length%512)%512));}
blocks.push(Buffer.alloc(1024));const archive=gzipSync(Buffer.concat(blocks),{level:9,mtime:0});archive[9]=255;
const tgz=path.join(cache,'memoryos-readiness-0.1.0.tgz');fs.writeFileSync(tgz,archive,{flag:'wx'});
const install=path.join(cache,'install'),npmCache=path.join(cache,'npm-cache'),isolated=path.join(cache,'isolated');for(const p of [install,npmCache,isolated])fs.mkdirSync(p);
fs.writeFileSync(path.join(install,'package.json'),JSON.stringify({name:'mo1307-phase3a-offline-witness',version:'1.0.0',private:true,dependencies:{'memoryos-readiness':'file:../memoryos-readiness-0.1.0.tgz'}})+'\n',{flag:'wx'});
for(const n of ['user.npmrc','global.npmrc'])fs.writeFileSync(path.join(cache,n),'',{flag:'wx'});
command('offline-install',process.execPath,[npm,'install','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',npmCache,'--userconfig',path.join(cache,'user.npmrc'),'--globalconfig',path.join(cache,'global.npmrc')],install,{PATH:path.dirname(process.execPath),TEMP:cache,TMP:cache});
const installed=path.join(install,'node_modules/memoryos-readiness'), members=walk(installed).map(p=>row(p,installed)).sort((a,b)=>a.path.localeCompare(b.path,'en'));
assert.deepEqual(members.map(x=>x.path).sort(),production.map(x=>x.path).sort());for(const r of production){assert.deepEqual(members.find(m=>m.path===r.path),r);}
write('installed-before.json',{result:'PASS',packageRoot:installed,members:production,packageCheck:checkPackage(installed)});
write('candidate-identity.json',{B2,I2:parent,I2tree:git('rev-parse',parent+'^{tree}').toString().trim(),name:'memoryos-readiness',version:'0.1.0',contract:'memoryos.readiness@1.0.0',archive:row(tgz),archiveMethod:'Exact established repositories/memoryos-ci/scripts/pack.mjs ustar/gzip algorithm applied to MO1307 explicit 89-member allowlist; source metadata not regenerated',archiveAlgorithm:row(path.join(root,'repositories/memoryos-ci/scripts/pack.mjs')),distribution:production.find(x=>x.path==='distribution-manifest.json'),contractManifest:production.find(x=>x.path==='contracts/contract.json'),helper:production.find(x=>x.path==='helpers/windows-inspect.ps1'),schemas:production.filter(x=>x.path.startsWith('schemas/')),packageRoot:installed,members:production.length,externalProductionDependencies:0,lifecycleScripts:false,offlineInstall:true,installedIndependentCwd:isolated,fullPhase3BCertification:false});
write('campaign-plan.json',{taskStartedAt:'2026-09-29T09:14:00Z',hardStop:'2026-09-29T12:14:00Z',diagnosticAttempts:{initial:1,additionalMaximum:2,additionalOnlyForSpecificMissingObservation:true,retryUntilPass:false},budgets:{helper:5000,helperAggregate:20000,cliAdmission:30000,worker:10000,cleanup:2000},productionEdits:false,stopIfProductChangeNecessary:'PRODUCT_DEFECT',commitOnlyIfAllRequiredGatesPass:true,scope:'Native installed Phase3A; no Phase3B supply-chain or Phase3C adversarial campaign',network:'Offline npm; no product provider/network execution; no OS-wide isolation claim',initialDiagnostic:'Actual unchanged installed orchestrator plus external process counters and held-handle cleanup observations; one MO1306 invocation',remainingGates:'API, native semantic parity, decisions, tag stages, determinism, lifecycle/deadlines/finalization/filesystem/environment/resource/interruption gates only as candidate remains certifiable'});
console.log(JSON.stringify({result:'PASS',packageRoot:installed,archive:row(tgz),members:production.length,historicalFiles:historical.length}));
