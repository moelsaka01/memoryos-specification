// Finite preparation checks only: does not import product or run source-review certification.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const td='repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert2',ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2',out=ev+'/harness-validation';
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex'),pin=p=>{const b=fs.readFileSync(p);return{path:p,byteLength:b.length,sha256:sha(b)}};
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'}),actual=JSON.parse(fs.readFileSync(td+'/engineering-toolchain.json'));
const poison=path.resolve(out,'poison');fs.mkdirSync(poison);const marker=path.join(poison,'fallback-used.txt');fs.writeFileSync(path.join(poison,'git.cmd'),'@echo fallback>"'+marker+'"\r\n@exit /b 0\r\n');
const bad=path.resolve(out,'not-an-executable.exe');fs.writeFileSync(bad,'MO1307 engineering non-executable fixture\n',{flag:'wx'});
const cases=[{id:'exact',manifest:actual,expectedExit:0,expectedText:'PASS_ENGINEERING_ONLY'},{id:'missing',manifest:{git:{...actual.git,absolute:path.resolve(out,'absent-git.exe')},core:null},expectedExit:1,expectedText:'ENGINEERING_GIT_MISSING'},{id:'wrong-identity',manifest:{git:{...actual.git,sha256:'sha256:'+'0'.repeat(64)},core:actual.core},expectedExit:1,expectedText:'ENGINEERING_GIT_IDENTITY'},{id:'not-executable',manifest:{git:{absolute:bad,byteLength:fs.statSync(bad).size,sha256:sha(fs.readFileSync(bad)),version:'unreachable'},core:null},expectedExit:1,expectedText:'ENGINEERING_GIT_EXECUTION'}];
for(const c of cases){c.manifestPath=path.resolve(out,c.id+'-manifest.json');save(c.manifestPath,c.manifest);}
save(out+'/plan.json',{kind:'EngineeringGitHarnessValidationPlan',frozenAt:new Date().toISOString(),scope:'Engineering-only preparation; not any of551 product security controls',caseCount:8,cases:cases.map(c=>({id:c.id,expectedExit:c.expectedExit,expectedText:c.expectedText,manifest:pin(c.manifestPath)})),implementations:['PowerShell helper-review ValidateOnly','Node git-toolchain validate-only'],sources:['helper-review.ps1','git-toolchain.ps1','git-toolchain.mjs','engineering-toolchain.json'].map(p=>pin(td+'/'+p)),poisonPath:poison,expectedFallbackMarker:false,productCodeImported:false,sourceReviewExecuted:false});
const rows=[];let failure=null;
for(const kind of ['powershell','node']){
 for(const c of cases){
  const exe=kind==='powershell'?'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe':actual.node.absolute;
  const args=kind==='powershell'?['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve(td,'helper-review.ps1'),'-GitExecutable',c.manifest.git.absolute,'-ValidateOnly','-ValidationManifest',c.manifestPath]:[path.resolve(td,'git-toolchain.mjs'),'--validate-only',c.manifestPath];
  const r=spawnSync(exe,args,{cwd:process.cwd(),env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:poison,PATHEXT:'.CMD;.EXE'},shell:false,windowsHide:true,timeout:15000,maxBuffer:65536});
  const id=kind+'-'+c.id;fs.writeFileSync(out+'/'+id+'.stdout.txt',r.stdout??Buffer.alloc(0),{flag:'wx'});fs.writeFileSync(out+'/'+id+'.stderr.txt',r.stderr??Buffer.alloc(0),{flag:'wx'});
  const combined=Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]).toString();const noFallback=!fs.existsSync(marker),noCertification=!fs.existsSync(ev+'/helper-delta-review.json')&&!fs.existsSync(ev+'/execution-ledger.json');
  const pass=!r.error&&r.status===c.expectedExit&&combined.includes(c.expectedText)&&noFallback&&noCertification;
  const row={id,result:pass?'PASS_ENGINEERING_ONLY':'FAIL_ENGINEERING_ONLY',command:{executable:exe,args},expected:{exitCode:c.expectedExit,errorOrResult:c.expectedText,noFallback:true,noCertification:true},actual:{exitCode:r.status,signal:r.signal,error:r.error?.code??null,containsExpectedText:combined.includes(c.expectedText),noFallback,noCertification},stdout:pin(out+'/'+id+'.stdout.txt'),stderr:pin(out+'/'+id+'.stderr.txt')};rows.push(row);save(out+'/'+id+'.json',row);console.log(JSON.stringify({id,result:row.result}));if(!pass){failure=row;break;}
 }
 if(failure)break;
}
save(out+'/receipt.json',{kind:'EngineeringGitHarnessValidation',result:failure?'FAIL_ENGINEERING_ONLY':'PASS_ENGINEERING_ONLY',productCertification:false,cases:rows,failure,negativeCases:rows.filter(r=>r.expected.exitCode===1).length,noAmbientPathFallback:rows.every(r=>r.actual.noFallback),sourceReviewOrProductExecution:false});
process.exitCode=failure?1:0;
