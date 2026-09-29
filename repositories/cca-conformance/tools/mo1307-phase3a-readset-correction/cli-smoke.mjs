// Two exact packaged CLI correction smokes. This is not certification.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,hash,record,check,write} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
import {loadBundle} from '../mo1307-phase2b/test-support.mjs';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {summaryProjection} from '../../../memoryos-readiness/src/projections.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(process.argv.length,6);assert.equal(process.argv[2],'--case');assert.equal(process.argv[4],'--output');
const name=process.argv[3],output=process.argv[5];assert.ok(['mo1306','ready'].includes(name));
assert.ok(path.resolve(root,output).startsWith(path.resolve(root,evidence+'/cli-smoke')+path.sep));
assert.equal(fs.existsSync(path.join(root,output)),false);checkPackage();fs.mkdirSync(path.join(root,output),{recursive:true});
const source='C:/Users/melsa/Documents/Codex/cca-mo1307-3a/.cache/';
const input=path.resolve(source,name==='mo1306'?'m7a-d1/i':'s3nat1/n0/i');
const b=loadBundle(name==='mo1306'?'mo1306-qualified':'ready');
const parent=path.join(root,'.cache','m7-readset-smoke-'+name+'-'+process.pid);assert.equal(fs.existsSync(parent),false);fs.mkdirSync(parent);
fs.writeFileSync(path.join(parent,'owned-parent.txt'),'MO-1307 READ_SET correction smoke stable publication parent.\n',{flag:'wx'});
const destination=path.join(parent,'result');
const walk=p=>fs.readdirSync(p).sort().flatMap(n=>{const next=path.join(p,n);return fs.statSync(next).isDirectory()?walk(next):[next];});
const bindings=[...packageFiles.map(p=>record('repositories/memoryos-readiness/'+p)),...walk(input).map(p=>record(p)),
 record('repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/cli-smoke.mjs'),record('repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/common.mjs'),
 record('repositories/cca-conformance/tools/mo1307-phase2b/test-support.mjs'),
 ...['expected-result.json','pins.json'].map(p=>record('repositories/cca-conformance/fixtures/mo1307/bundles/'+(name==='mo1306'?'mo1306-qualified':'ready')+'/'+p))];
const args=[path.join(root,'repositories/memoryos-readiness/bin/memoryos-readiness.mjs'),'evaluate','--input-root',input,'--config','configuration.json','--authority','authority.json',
 '--authority-sha256',b.pins.trustedAuthorityDigest,'--candidate-sha256',b.pins.expectedCandidateDigest,'--output-root',destination];
write(output+'/campaign.json',{kind:'MO1307ReadSetCorrectionCliCampaign',case:name,sourceBindings:bindings,executable:process.execPath,args,
 environment:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},engineeringOuterGuardMs:45000,productAdmissionMs:30000,perHelperMs:5000,aggregateHelperMs:20000,
 exactPackagedCli:true,helperDoubles:false,workerOverrides:false,retries:0,certification:false,originalInputRoot:input});
const at=performance.now(),child=spawn(process.execPath,args,{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
let inputClosed=false,outputClosed=false,errorClosed=false,processClosed=false,guardExpired=false;
const stdout=[],stderr=[];child.stdin.once('close',()=>{inputClosed=true;});child.stdout.once('close',()=>{outputClosed=true;});child.stderr.once('close',()=>{errorClosed=true;});
child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));child.stdin.end();
let launchError=null,cleanupTimer=null,timer=null;
child.once('error',e=>{launchError=e;});
const exit=await new Promise(resolve=>{
 child.once('close',(code,signal)=>{processClosed=true;resolve({code,signal});});
 timer=setTimeout(()=>{guardExpired=true;child.kill();cleanupTimer=setTimeout(()=>{
  child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();child.unref();
  resolve({code:null,signal:null,cleanupUnconfirmed:true});
 },2000);},45000);
});clearTimeout(timer);clearTimeout(cleanupTimer);
const elapsedMs=performance.now()-at,out=Buffer.concat(stdout),err=Buffer.concat(stderr);
fs.writeFileSync(path.join(root,output,'stdout.data'),out,{flag:'wx'});fs.writeFileSync(path.join(root,output,'stderr.data'),err,{flag:'wx'});
let result='PASS',failure=null,published=null;
const observedNamespace=processClosed?{destination,exists:fs.existsSync(destination),members:fs.existsSync(destination)?fs.readdirSync(destination).sort().map(n=>{
 const p=path.join(destination,n),s=fs.lstatSync(p);return {name:n,directory:s.isDirectory(),symlink:s.isSymbolicLink(),byteLength:s.size,
  sha256:s.isFile()&&!s.isSymbolicLink()&&s.size<=16777216?hash(fs.readFileSync(p)):null};}):[]}:null;
try{
 assert.ifError(launchError);assert.equal(guardExpired,false);assert.equal(exit.code,name==='mo1306'?2:0);assert.equal(err.length,0,err.toString());
 assert.deepEqual(out,summaryProjection(b.result,'evaluate',null));
 const bytes=fs.readFileSync(path.join(destination,'memoryos-readiness-result.json'));assert.deepEqual(bytes,canonicalBytes(b.result));assert.deepEqual(fs.readdirSync(destination),['memoryos-readiness-result.json']);
 fs.writeFileSync(path.join(root,output,'result.json'),bytes,{flag:'wx'});published=record(output+'/result.json');
 assert.ok(processClosed&&inputClosed&&outputClosed&&errorClosed);
}catch(error){result='FAIL';failure={code:error.code??null,message:error.message,stack:error.stack};}
let sourceInputsUnchanged=true;for(const m of bindings){try{check(m);}catch(error){sourceInputsUnchanged=false;result='FAIL';failure??={code:error.code??null,message:error.message,stack:error.stack};}}
write(output+'/receipt.json',{kind:'MO1307ReadSetCorrectionCliSmoke',case:name,result,failure,exit,elapsedMs,pid:child.pid,guardExpired,launchError:launchError?.message??null,
 stdout:record(output+'/stdout.data'),stderr:record(output+'/stderr.data'),published,sourceBindings:bindings,
 readiness:b.result.assessment.readiness,readinessDigest:b.result.readinessDigest,proofBindingDigest:b.result.proofBindingDigest,
 processClosed,inputClosed,outputClosed,errorClosed,observedNamespace,sourceInputsUnchanged,cleanupConfirmed:result==='PASS',
 cleanupBasis:'Successful exact packaged run requires all nine unchanged production transport exchanges to confirm helper exit, all pipes closed, and valid native-console-quiescence response; supervisor disposal is in runCli finally. Parent also observed CLI process and three pipes close. No alternative/helper launch injection.',
 helperRequests:result==='PASS'?9:null,workers:result==='PASS'?1:null,unchangedTopology:true,certification:false,historicalReadyFailureResolved:false});
console.log(JSON.stringify({case:name,result,exit:exit.code,elapsedMs,cleanupConfirmed:result==='PASS',failure}));process.exitCode=result==='PASS'?0:1;
