import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
const root=process.cwd(),ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert',td='repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const plan=json(ev+'/campaign-plan.json'),seal=json(ev+'/pre-execution-seal.json');
assert.ok(!fs.existsSync(ev+'/execution-ledger.json'),'one current generation execution only');
const ledger={kind:'MO1307Phase3CC3RBExecutionLedger',candidate:plan.candidate,startedAt:new Date().toISOString(),result:'RUNNING',stages:plan.stages.map(s=>({...s,status:'NOT_RUN'})),firstFailure:null};
const save=()=>fs.writeFileSync(ev+'/execution-ledger.json',JSON.stringify(ledger,null,2)+'\n');save();
try {
for(const r of seal.members){const b=read(r.path);assert.equal(b.length,r.byteLength,r.path);assert.equal(hash(b),r.sha256,r.path);}
for(const stage of ledger.stages){
 stage.status='RUNNING';stage.startedAt=new Date().toISOString();save();
 const exe=stage.powershell?'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe':plan.node.absolute;
 const args=stage.powershell?['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve(td,stage.tool)]:[path.resolve(td,stage.tool),...(stage.args??[])];
 stage.command={executable:exe,args,cwd:root};save();
 const out=fs.openSync(ev+'/'+stage.id+'.stdout.txt','wx'),err=fs.openSync(ev+'/'+stage.id+'.stderr.txt','wx');
 const result=await new Promise(resolve=>{let settled=false;const c=spawn(exe,args,{cwd:root,windowsHide:true,shell:false,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:process.env.PATH},stdio:['ignore',out,err]});stage.pid=c.pid;save();c.once('error',e=>{if(!settled){settled=true;resolve({code:null,error:{code:e.code,message:e.message}})}});c.once('close',(code,signal)=>{if(!settled){settled=true;resolve({code,signal})}});});
 fs.closeSync(out);fs.closeSync(err);stage.finishedAt=new Date().toISOString();stage.actual=result;stage.status=result.code===0?'PASS':'FAIL';stage.expected={exitCode:0,allMandatoryCases:'PASS'};save();console.log(JSON.stringify({stage:stage.id,status:stage.status,actual:result}));
 if(stage.status==='FAIL'){ledger.firstFailure={stage:stage.id,actual:result,stdout:ev+'/'+stage.id+'.stdout.txt',stderr:ev+'/'+stage.id+'.stderr.txt'};ledger.result='FAILED/INCOMPLETE';break;}
}
} catch(e) {const stage=ledger.stages.find(s=>s.status==='RUNNING');if(stage)stage.status='FAIL';ledger.firstFailure={stage:stage?.id??'pre-execution-seal',actual:{code:e.code??null,message:e.message,stack:e.stack}};ledger.result='FAILED/INCOMPLETE';save();}
if(!ledger.firstFailure)ledger.result='EXECUTION_PASSED_PENDING_INDEPENDENT_REVIEW_AND_SEAL';ledger.finishedAt=new Date().toISOString();save();process.exitCode=ledger.firstFailure?1:0;
