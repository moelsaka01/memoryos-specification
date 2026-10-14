import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configuration,digest } from '../../../memoryos-ci/src/contracts.mjs';
import { J } from '../../../memoryos-ci/src/serialization.mjs';

const root=path.resolve(fileURLToPath(new URL('../../../..',import.meta.url)));
const packageRoot=path.join(root,'repositories/memoryos-ci');
const fixtures=path.join(root,'repositories/cca-conformance/fixtures/mo1306');
const [outputRoot,nodePath]=process.argv.slice(2);
assert(outputRoot&&nodePath,'explicit exclusive output and pinned Node required');
assert.equal(digest(fs.readFileSync(nodePath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(fs.existsSync(outputRoot),false);fs.mkdirSync(outputRoot,{recursive:true});
const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const records=[];
function invoke(wrapper,mode,workspace,configPin,distributionPin,env) {
  // Test-host process-only policy permits this reviewed fixed script. It does
  // not modify machine policy or add flags to generated provider commands.
  return spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',wrapper,'-Mode',mode,'-WorkspaceRoot',workspace,'-ConfigurationDigest',configPin,'-DistributionDigest',distributionPin],{env,cwd:workspace,encoding:'utf8',timeout:90000,windowsHide:true,maxBuffer:65536});
}
for(const [name,fixture,expectedCode] of [['pass','evaluate-policy-pass',0],['fail','evaluate-policy-fail',6],['cne','evaluate-policy-cne',7],['input-error','evaluate-policy-pass',11]]) {
  const workspace=path.join(outputRoot,name),home=path.join(workspace,'_memoryos/tool/repositories/memoryos-ci'),data=path.join(workspace,'_memoryos/data'),runtime=path.join(workspace,'_memoryos/runtime');
  fs.mkdirSync(path.dirname(home),{recursive:true});fs.cpSync(packageRoot,home,{recursive:true,errorOnExist:true,force:false});
  fs.mkdirSync(data,{recursive:true});fs.mkdirSync(runtime);fs.copyFileSync(nodePath,path.join(runtime,'node.exe'));
  const source=path.join(fixtures,fixture);
  for(const name of ['policy.json','candidate.mip'])if(!(expectedCode===11&&name==='candidate.mip'))fs.copyFileSync(path.join(source,name),path.join(data,name));
  const config=configuration(fs.readFileSync(path.join(source,'memoryos-ci.json'))),configPath=path.join(workspace,'_memoryos/tool/config.json');
  fs.writeFileSync(configPath,J(config),{flag:'wx'});
  const configPin=digest(J(config)),distributionPin=digest(fs.readFileSync(path.join(home,'distribution-manifest.json')));
  const output=path.join(workspace,'outputs.txt');fs.writeFileSync(output,'',{flag:'wx'});
  const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,GITHUB_WORKSPACE:workspace,GITHUB_OUTPUT:output,MEMORYOS_CI_HOME:home,MEMORYOS_CI_CONFIG:configPath,GITHUB_REPOSITORY:'memoryos/offline-test',GITHUB_SHA:'e1c990bf65d0c7925a68eea8222cd304f8ce6db6',GITHUB_RUN_ID:'1001',GITHUB_RUN_ATTEMPT:'1',GITHUB_JOB:'memoryos_ci',GITHUB_EVENT_NAME:'workflow_dispatch'};
  const wrapper=path.join(home,'scripts/Invoke-GitHubCI.ps1');
  // Windows PowerShell uses PATHEXT even for an explicit native .exe path.
  // This belongs to the test host, never to the isolated semantic worker.
  env.PATHEXT='.COM;.EXE;.BAT;.CMD';
  if(name==='pass') {
    const bootstrap=spawnSync(path.join(runtime,'node.exe'),['--max-old-space-size=128',path.join(home,'scripts/github-transport.mjs'),'bootstrap',workspace,configPin,distributionPin],{env,encoding:'utf8',timeout:90000,windowsHide:true,maxBuffer:65536});
    assert.equal(bootstrap.status,0,'pinned runtime handoff: '+bootstrap.stderr);
    records.push({id:'pinned-runtime-package-config-handoff',exitCode:0,status:'PASS'});
    env.NODE_OPTIONS='--require C:\\UNTRUSTED_SENTINEL.cjs';env.NODE_PATH='C:\\UNTRUSTED_SENTINEL';env.PATH='C:\\UNTRUSTED_SENTINEL';env.MEMORYOS_CI_NODE='C:\\UNTRUSTED_SENTINEL\\node.exe';
  }
  const evaluated=invoke(wrapper,'Evaluate',workspace,configPin,distributionPin,env);
  fs.writeFileSync(path.join(workspace,'evaluate.stdout.txt'),evaluated.stdout??'',{flag:'wx'});fs.writeFileSync(path.join(workspace,'evaluate.stderr.txt'),evaluated.stderr??'',{flag:'wx'});
  assert.equal(evaluated.status,0,`${name} evaluate: ${evaluated.stderr}`);
  const lines=fs.readFileSync(output,'utf8');
  assert.match(lines,new RegExp('^complete=true\\nexit-code='+expectedCode+'\\nrun-id=[0-9a-f-]{36}\\n$'));
  const runId=lines.split('\n')[2].slice(7),bundle=path.join(data,'.memoryos-ci/out',runId);
  assert.equal(fs.readdirSync(bundle).length,expectedCode===11?4:6);
  const gateEnv={...env,COMPLETE:'true',EXIT_CODE:String(expectedCode),RUN_ID:runId,EVALUATE_OUTCOME:'success',UPLOAD_OUTCOME:'success'};
  const gated=invoke(wrapper,'Gate',workspace,configPin,distributionPin,gateEnv);
  assert.equal(gated.status,expectedCode,`${name} gate: ${gated.stderr}`);
  records.push({id:name,exitCode:expectedCode,complete:true,fileCount:fs.readdirSync(bundle).length,bundle:path.relative(outputRoot,bundle).replaceAll('\\','/'),status:'PASS'});
  if(name==='pass') {
    const negatives=[
      ['wrong-run',{...gateEnv,RUN_ID:'11111111-1111-4111-8111-111111111111'},15],
      ['provider-run-mismatch',{...gateEnv,GITHUB_RUN_ID:'1002'},15],
      ['provider-attempt-mismatch',{...gateEnv,GITHUB_RUN_ATTEMPT:'2'},15],
      ['upload-failed',{...gateEnv,UPLOAD_OUTCOME:'failure'},17],
      ['evaluate-skipped',{...gateEnv,EVALUATE_OUTCOME:'skipped'},16],
      ['incomplete',{...gateEnv,COMPLETE:'false'},16],
      ['traversal-run',{...gateEnv,RUN_ID:'../bad'},16],
      ['injected-exit',{...gateEnv,EXIT_CODE:'0;exit 0'},16],
    ];
    for(const [id,negativeEnv,wanted] of negatives){const result=invoke(wrapper,'Gate',workspace,configPin,distributionPin,negativeEnv);assert.equal(result.status,wanted,id+': '+result.stderr);records.push({id,exitCode:wanted,status:'PASS'});}
    for(const [id,cPin,dPin] of [['config-substitution','sha256:'+'a'.repeat(64),distributionPin],['distribution-substitution',configPin,'sha256:'+'a'.repeat(64)]]){const result=invoke(wrapper,'Gate',workspace,cPin,dPin,gateEnv);assert.equal(result.status,15,id);records.push({id,exitCode:15,status:'PASS'});}
    const clone=path.join(data,'.memoryos-ci','out',runId+'-archive');fs.cpSync(bundle,clone,{recursive:true});
    // Each mutation receives a new workspace path; no successful bundle is erased.
    for(const [id,mutate] of [['extra-basename',d=>fs.writeFileSync(path.join(d,'extra.txt'),'x',{flag:'wx'})],['nested-extra',d=>fs.mkdirSync(path.join(d,'nested'))],['case-confusion',d=>fs.renameSync(path.join(d,'memoryos-ci-result.json'),path.join(d,'MemoryOS-CI-Result.json'))],['missing-marker',d=>fs.renameSync(path.join(d,'memoryos-ci-complete.json'),path.join(path.dirname(d),'saved-marker.json'))],['hardlink-substitution',d=>{const target=path.join(d,'memoryos-ci-result.json'),original=path.join(path.dirname(d),'saved-result.json');fs.renameSync(target,original);fs.linkSync(original,target);} ]]) {
      const mutationWorkspace=path.join(outputRoot,id),mutationData=path.join(mutationWorkspace,'_memoryos','data'),mutationHome=path.join(mutationWorkspace,'_memoryos','tool','repositories','memoryos-ci');
      fs.mkdirSync(path.dirname(mutationHome),{recursive:true});fs.cpSync(home,mutationHome,{recursive:true});
      fs.mkdirSync(path.join(mutationWorkspace,'_memoryos','runtime'));fs.copyFileSync(nodePath,path.join(mutationWorkspace,'_memoryos','runtime','node.exe'));
      fs.copyFileSync(configPath,path.join(mutationWorkspace,'_memoryos','tool','config.json'));
      const mutationBundle=path.join(mutationData,'.memoryos-ci','out',runId);fs.mkdirSync(path.dirname(mutationBundle),{recursive:true});fs.cpSync(clone,mutationBundle,{recursive:true});mutate(mutationBundle);
      const mutationEnv={...gateEnv,GITHUB_WORKSPACE:mutationWorkspace,MEMORYOS_CI_HOME:mutationHome,MEMORYOS_CI_CONFIG:path.join(mutationWorkspace,'_memoryos','tool','config.json')};
      const result=invoke(path.join(mutationHome,'scripts','Invoke-GitHubCI.ps1'),'Gate',mutationWorkspace,configPin,distributionPin,mutationEnv);
      assert.equal(result.status,15,id+': '+result.stderr);records.push({id,exitCode:15,status:'PASS'});
    }
  }
}
const report={kind:'MemoryOSCICDGitHubWrapperOfflineTest',version:'1.0.0',productionDigest:digest(fs.readFileSync(path.join(packageRoot,'distribution-manifest.json'))),networkExecuted:false,hostedExecuted:false,cases:records,passed:records.length};
fs.writeFileSync(path.join(outputRoot,'report.json'),J(report),{flag:'wx'});process.stdout.write(J(report));
