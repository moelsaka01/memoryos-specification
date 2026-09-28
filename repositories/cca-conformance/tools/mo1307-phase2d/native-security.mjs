// Bounded negatives through the actual packaged CLI and native filesystem policy.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,json,write,record,check,hash} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const output=process.argv[3].replaceAll('\\','/');assert.ok([evidence+'/native/','.cache/mo1307/phase2d/post-binding/'].some(p=>path.resolve(root,output).startsWith(path.resolve(root,p)+path.sep)));
assert.equal(json(evidence+'/pre-native-authorization.json').result,'PASS');checkPackage();
assert.equal(fs.existsSync(path.join(root,output)),false);fs.mkdirSync(path.join(root,output),{recursive:true});
const fixture=path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles/ready'),pins=JSON.parse(fs.readFileSync(path.join(fixture,'pins.json')));
const scratch=path.join(root,'.cache','m7d-security-'+process.pid);assert.equal(fs.existsSync(scratch),false);fs.mkdirSync(scratch);
const specs=[['traversal',20,'MO1307_FILESYSTEM_BOUNDARY'],['hardlink',20,'MO1307_FILESYSTEM_BOUNDARY'],['junction',20,'MO1307_FILESYSTEM_BOUNDARY'],
 ['raw-source-tamper',13,'MO1307_INTEGRITY'],['existing-output',21,'MO1307_OUTPUT'],['prototype-command',10,'MO1307_USAGE'],['launch-override',10,'MO1307_USAGE']];
const bindings=packageFiles.map(p=>record('repositories/memoryos-readiness/'+p));bindings.push(record('repositories/cca-conformance/tools/mo1307-phase2d/native-security.mjs'),record('repositories/cca-conformance/tools/mo1307-phase2d/common.mjs'));
const walk=p=>fs.readdirSync(path.join(root,p)).sort().flatMap(n=>{const next=p+'/'+n;return fs.statSync(path.join(root,next)).isDirectory()?walk(next):[next];});
bindings.push(...walk('repositories/cca-conformance/fixtures/mo1307/bundles/ready').map(p=>record(p)));
write(output+'/campaign.json',{kind:'MO1307IntegratedNativeSecurityCampaign',version:'1.0.0',sourceBindings:bindings,specs,retries:0,perChildEngineeringTimeoutMs:45000,
 fixedProductionCli:true,productPolicyWeakened:false,allMutableFixtures:'New engineering-owned scratch copies only'});
const rows=[];let result='PASS',failure=null;
try{
 const cases=specs.map(([name,exit,code])=>{const directory=path.join(scratch,name),input=path.join(directory,'input'),destination=path.join(directory,'output');
  fs.mkdirSync(directory);fs.cpSync(fixture,input,{recursive:true});fs.mkdirSync(path.join(root,output,name));
  if(name==='hardlink'){const leaf=path.join(input,'authority.json');fs.linkSync(leaf,path.join(input,'authority-hardlink.json'));assert.equal(fs.statSync(leaf).nlink,2);}
  if(name==='raw-source-tamper'){const manifest=JSON.parse(fs.readFileSync(path.join(input,'manifest.json'))),source=manifest.entries.find(e=>e.type==='SOURCE');assert.ok(source);
   const p=path.join(input,source.path),bytes=fs.readFileSync(p);bytes[0]^=1;fs.writeFileSync(p,bytes);}
  if(name==='existing-output'){fs.mkdirSync(destination);fs.writeFileSync(path.join(destination,'owned.txt'),'Retain owned pre-existing output.\n');}
  let selectedInput=input;if(name==='junction'){selectedInput=path.join(directory,'input-junction');fs.symlinkSync(input,selectedInput,'junction');assert.equal(fs.lstatSync(selectedInput).isSymbolicLink(),true);}
  return {name,exit,code,input:selectedInput,destination};});
 for(const c of cases){
  const args=[path.join(root,'repositories/memoryos-readiness/bin/memoryos-readiness.mjs'),c.name==='prototype-command'?'__proto__':'evaluate',
   '--input-root',c.input,'--config',c.name==='traversal'?'../configuration.json':'configuration.json','--authority','authority.json',
   '--authority-sha256',pins.trustedAuthorityDigest,'--candidate-sha256',pins.expectedCandidateDigest,'--output-root',c.destination];
  const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',...(c.name==='launch-override'?{NODE_OPTIONS:''}:{})};
  const at=performance.now(),child=spawnSync(process.execPath,args,{cwd:root,env,windowsHide:true,encoding:null,timeout:45000,maxBuffer:1024*1024});
  const stdout=child.stdout??Buffer.alloc(0),stderr=child.stderr??Buffer.alloc(0);
  for(const [n,b] of [['stdout.data',stdout],['stderr.data',stderr]])fs.writeFileSync(path.join(root,output,c.name,n),b,{flag:'wx'});
  const row={name:c.name,exit:child.status,error:child.error?.code??null,elapsedMs:performance.now()-at,expectedExit:c.exit,expectedCode:c.code,
   stdout:record(output+'/'+c.name+'/stdout.data'),stderr:record(output+'/'+c.name+'/stderr.data'),result:'FAIL'};
  rows.push(row);
  try{assert.ifError(child.error);assert.equal(child.status,c.exit,stderr.toString());assert.equal(stdout.length,0);assert.equal(stderr.at(-1),10);
   const diagnostic=JSON.parse(stderr);assert.equal(diagnostic.code,c.code);row.diagnostic=diagnostic;
   if(c.name==='existing-output')assert.deepEqual(fs.readdirSync(c.destination),['owned.txt']);else assert.equal(fs.existsSync(c.destination),false);
   row.noReadinessPublication=true;row.result='PASS';
  }finally{write(output+'/'+c.name+'/receipt.json',row);}
  console.log(JSON.stringify({name:c.name,result:row.result,exit:row.exit}));
 }
 for(const m of bindings)check(m);
}catch(error){result='FAIL';failure={code:error.code??null,message:error.message,stack:error.stack};}
write(output+'/receipt.json',{kind:'MO1307IntegratedNativeSecurity',version:'1.0.0',result,failure,cases:rows,expectedCases:specs.length,sourceBindings:bindings,
 filesystemPolicy:'Unchanged accepted 2C native handles/chains/reparse/hardlink policy',network:false,sourceWorktreeWrites:false});
console.log(JSON.stringify({result,cases:rows.length,failure}));process.exitCode=result==='PASS'?0:1;
