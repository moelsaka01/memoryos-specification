// Engineering only: exact committed snapshots, isolated semantic compatibility.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const B1='3883ca889911fcc5a6f46c24e569478a8c32648e';
const baseline='0d68ac211b3b204635e7af252cd693dce5bd70b1';
const product='repositories/memoryos-readiness/';
const conformance='repositories/cca-conformance/';
const evidenceBase=conformance+'evidence/mo1307/phase2c-finalization-correction/';
const h=raw=>'sha256:'+createHash('sha256').update(raw).digest('hex');
const canonical=value=>Buffer.from(JSON.stringify(sort(value))+'\n');
function sort(value){return Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;}
const identity=(member,raw)=>({path:member,byteLength:raw.length,sha256:h(raw)});
const pin='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(h(fs.readFileSync(process.execPath)),pin);
assert.equal(process.argv[2],'--output');assert.equal(process.argv.length,4);
const outputRelative=process.argv[3].replaceAll('\\','/');
const allowedOutputRoots=[evidenceBase+'compatibility/','.cache/mo1307/phase2c-finalization-correction/compatibility-checks/'];
assert.ok(allowedOutputRoots.some(base=>outputRelative.startsWith(base)));
const output=path.resolve(root,outputRelative);
assert.ok(allowedOutputRoots.some(base=>output.startsWith(path.resolve(root,base)+path.sep)));assert.ok(!fs.existsSync(output));fs.mkdirSync(output,{recursive:true});
const cache=path.resolve(root,'.cache/mo1307/phase2c-finalization-correction/compatibility',path.basename(output));
assert.ok(!fs.existsSync(cache));fs.mkdirSync(cache,{recursive:true});
const write=(member,value)=>fs.writeFileSync(path.join(output,member),JSON.stringify(value,null,2)+'\n');
process.on('uncaughtException',error=>{write('harness-failure.json',{kind:'MO1307CompatibilityHarnessFailure',version:'1.0.0',result:'FAIL',classification:'ENGINEERING_HARNESS_FAILURE_NOT_SEMANTIC_INVALIDATION',name:error.name,message:error.message,stack:error.stack,runner:identity(path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/'),fs.readFileSync(fileURLToPath(import.meta.url)))});process.stderr.write(error.stack+'\n');process.exitCode=1;});
const branches=[
 {id:'2a',commit:'b628349b4e678a8f71086b1b5c807ffe2edf9a5d',worktree:'C:/Users/melsa/Documents/Codex/cca-mo1307-2a',expectedTests:84,seams:['readiness-core.mjs','readiness-result.mjs'],support:'fixture-projection.mjs',accepted:conformance+'evidence/mo1307/phase2a/acceptance/normative-vectors.json'},
 {id:'2b',commit:'b2877ab32c317bb67896414ba9cec64f6f436ca5',worktree:'C:/Users/melsa/Documents/Codex/cca-mo1307-2b',expectedTests:172,seams:['evidence-verifier.mjs','evidence-graph.mjs','evidence-history.mjs'],support:'test-support.mjs',accepted:conformance+'evidence/mo1307/phase2b/acceptance/receipt.json'},
];
function git(branch,args,input){const result=spawnSync('git',['-c','safe.directory='+branch.worktree,'-C',branch.worktree,...args],{windowsHide:true,encoding:null,input,timeout:30000,maxBuffer:64*1024*1024});assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr?.toString());return result.stdout;}
function state(branch){return {head:git(branch,['rev-parse','HEAD']).toString().trim(),parent:git(branch,['rev-parse','HEAD^']).toString().trim(),status:git(branch,['status','--porcelain=v1','--untracked-files=all']).toString()};}
function selected(branch,member){return member.startsWith(product)||member.startsWith(conformance+'fixtures/mo1307/')||new RegExp('^'+conformance+'tests/mo1307_phase'+branch.id+'_.*_test\\.mjs$').test(member)||member===conformance+'tools/mo1307-phase'+branch.id+'/'+branch.support||member===branch.accepted||(branch.id==='2b'&&member===conformance+'evidence/mo1307/phase2b/development/mo1306-source-lineage.json');}
function snapshot(branch,directory){
 const tree=git(branch,['ls-tree','-r','-z','--full-tree',branch.commit,'--',product,conformance+'fixtures/mo1307',conformance+'tests',conformance+'tools/mo1307-phase'+branch.id,conformance+'evidence/mo1307/phase'+branch.id]).toString('utf8');
 const entries=tree.split('\0').filter(Boolean).map(row=>{const match=/^(\d+) (\w+) ([0-9a-f]{40})\t(.+)$/.exec(row);assert.ok(match);return {mode:match[1],type:match[2],blob:match[3],path:match[4]};}).filter(row=>selected(branch,row.path)).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const raw=git(branch,['cat-file','--batch'],Buffer.from(entries.map(row=>row.blob+'\n').join('')));let offset=0;const identities=[];
 for(const entry of entries){assert.ok(['100644','100755'].includes(entry.mode));assert.equal(entry.type,'blob');const end=raw.indexOf(10,offset);assert.ok(end>offset);const header=raw.subarray(offset,end).toString('ascii').split(' ');assert.equal(header[0],entry.blob);assert.equal(header[1],'blob');const size=Number(header[2]);assert.ok(Number.isSafeInteger(size)&&size>=0);offset=end+1;const bytes=raw.subarray(offset,offset+size);assert.equal(bytes.length,size);offset+=size;assert.equal(raw[offset++],10);const destination=path.resolve(directory,entry.path);assert.ok(destination.startsWith(directory+path.sep));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);identities.push({...identity(entry.path,bytes),gitBlob:entry.blob,mode:entry.mode});}
 assert.equal(offset,raw.length);return identities;
}
function changes(left,right,prefix=''){
 if(JSON.stringify(left)===JSON.stringify(right))return [];
 if(left&&right&&typeof left==='object'&&typeof right==='object'&&!Array.isArray(left)&&!Array.isArray(right))return [...new Set([...Object.keys(left),...Object.keys(right)])].sort().flatMap(key=>changes(left[key],right[key],prefix?prefix+'.'+key:key));
 return [{path:prefix,before:left??null,after:right??null}];
}
function semanticDefinitions(original,corrected){
 const delta=changes(original,corrected);
 assert.equal(original.limits.helperRequests,4);assert.equal(corrected.limits.helperRequests,9);
 assert.equal(corrected.limits.helperVerifyRequests,4);assert.equal(corrected.limits.helperAggregateDeadlineMs,20000);assert.equal(corrected.limits.helperChainComponents,120);
 const preservedTopology=['acquisitionStages','concurrentHelpers','evaluationWorkers','helperEnvironment','network','possibleConsoleHosts','supervisors','totalProcesses'];
 for(const key of preservedTopology)assert.deepEqual(corrected.topology[key],original.topology[key]);
 const permittedLimitChanges=new Set(['limits.helperRequests','limits.helperAggregateDeadlineMs','limits.helperVerifyRequests','limits.helperChainComponents']);
 for(const row of delta)assert.ok(row.path.startsWith('topology.')||permittedLimitChanges.has(row.path),'Unexpected semantic definition change: '+row.path);
 const normalize=value=>{const out=structuredClone(value);delete out.topology;for(const key of permittedLimitChanges)delete out.limits[key.slice('limits.'.length)];return out;};
 assert.deepEqual(normalize(original),normalize(corrected));return {changes:delta,unchangedSemanticDefinitionsSha256:h(canonical(normalize(original))),preservedTopology};
}
function closure(directory,seams){const visited=new Set(),pending=[...seams],builtins=new Set(),edges=[];while(pending.length){const member=pending.pop();if(visited.has(member))continue;visited.add(member);const raw=fs.readFileSync(path.join(directory,product+'src/'+member),'utf8');for(const match of raw.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)){const dep=match[1];edges.push({from:member,to:dep});if(dep.startsWith('node:'))builtins.add(dep);else{assert.match(dep,/^\.\/[a-z-]+\.mjs$/);pending.push(dep.slice(2));}}assert.doesNotMatch(raw,/\b(?:import\s*\(|require\s*\(|eval\s*\(|fetch\s*\(|process\s*\.|setTimeout\s*\(|setInterval\s*\(|Date\s*\.\s*now\s*\(|performance\s*\.|new\s+Date\s*\(\s*\))/);if(member!=='constants.mjs')assert.doesNotMatch(raw,/\b(?:helperRequests|helperDeadlineMs|helperAggregateDeadlineMs|helperVerifyRequests|helperAcquisitionRequests|helperPublicationRequests)\b|DEFINITIONS\.topology/);}
 assert.deepEqual([...builtins].sort(),['node:crypto','node:path']);assert.ok(!visited.has('helper-protocol.mjs')&&!visited.has('publication.mjs'));return {members:[...visited].sort(),builtins:[...builtins].sort(),imports:edges.sort((a,b)=>{const left=a.from+'|'+a.to,right=b.from+'|'+b.to;return left<right?-1:left>right?1:0;})};}
async function vectors(branch,directory){
 const module=relative=>import(pathToFileURL(path.join(directory,relative)).href);
 const expected=JSON.parse(fs.readFileSync(path.join(directory,branch.accepted)));
 if(branch.id==='2a'){
  const {computeReadiness}=await module(product+'src/readiness-core.mjs');const {projectReadinessResult}=await module(product+'src/readiness-result.mjs');const {bundleNames,loadProjection}=await module(conformance+'tools/mo1307-phase2a/fixture-projection.mjs');const rows=[];
  for(const name of bundleNames){const fixture=loadProjection(name),out=computeReadiness(fixture.verified),json=projectReadinessResult(out.result,'json'),text=projectReadinessResult(out.result,'text');assert.deepEqual(out.resultBytes,fixture.expectedBytes);assert.deepEqual(json,fixture.summaryBytes);const a=out.result.assessment;rows.push({name,readiness:a.readiness,exit:out.exitCode,gates:a.gates.length,blockers:a.blockers.length,qualifications:a.qualifications.length,cne:a.cneReasons.length,history:a.history.length,providers:a.providers.length,result:{byteLength:out.resultBytes.length,sha256:h(out.resultBytes)},jsonSummary:{byteLength:json.length,sha256:h(json)},text:{byteLength:text.length,sha256:h(text)},readinessDigest:out.readinessDigest,proofBindingDigest:out.proofBindingDigest});}
  assert.deepEqual(rows,expected.vectors);return rows;
 }
 const {verifyEvidence,verifyResultEvidence}=await module(product+'src/evidence-verifier.mjs');const {canonicalBytes,canonicalDigest,proofBindingDigest}=await module(product+'src/canonical.mjs');const {loadBundle,inputOf}=await module(conformance+'tools/mo1307-phase2b/test-support.mjs');const rows=[];
 for(const name of fs.readdirSync(path.join(directory,conformance+'fixtures/mo1307/bundles')).sort()){const bundle=loadBundle(name),verified=verifyEvidence(inputOf(bundle));verifyResultEvidence(inputOf(bundle),canonicalBytes(bundle.result));const p=verified.projection;rows.push({name,candidateDigest:p.candidateDigest,authorityIdentityDigest:p.authorityIdentityDigest,trustedAuthorityDigest:verified.audit.trustedAuthorityDigest,projectionSha256:canonicalDigest(p),graphDigest:p.graphDigest,auditSha256:canonicalDigest(verified.audit),proofBindingDigest:proofBindingDigest(bundle.result.readinessDigest,verified.audit),claims:p.claims.length,nodes:p.graph.nodes.length,edges:p.graph.edges.length,history:p.history.length,qualifications:p.qualifications.length,providers:p.providers,reuse:p.reuse.map(row=>({claimDigest:row.claimDigest,disposition:row.disposition})),result:'PASS'});}
 assert.deepEqual(rows,expected.vectors);return rows;
}
const corrected=['contracts/definitions.json','src/constants.mjs','src/helper-protocol.mjs','src/publication.mjs'];
const sourceBindings=corrected.map(member=>identity(product+member,fs.readFileSync(path.join(root,product+member))));
const acceptedDefinitions=spawnSync('git',['show',baseline+':'+product+'contracts/definitions.json'],{cwd:root,windowsHide:true,encoding:null,timeout:15000,maxBuffer:1024*1024});
assert.ifError(acceptedDefinitions.error);assert.equal(acceptedDefinitions.status,0);
assert.deepEqual(fs.readFileSync(path.join(root,product+'contracts/definitions.json')),acceptedDefinitions.stdout,'Finalization correction must preserve existing compiled semantic definitions and every numeric limit');
const receipts=[];
for(const branch of branches){
 const start=performance.now(),before=state(branch);assert.equal(before.head,branch.commit);assert.equal(before.parent,B1);assert.equal(before.status,'');
 const directory=path.join(cache,branch.id);fs.mkdirSync(directory);const original=snapshot(branch,directory);write(branch.id+'-committed-inputs.json',{kind:'MO1307CompatibilityCommittedInputs',version:'1.0.0',commit:branch.commit,files:original});
 const oldDefinitions=JSON.parse(fs.readFileSync(path.join(directory,product+'contracts/definitions.json'))),newDefinitions=JSON.parse(fs.readFileSync(path.join(root,product+'contracts/definitions.json'))),definitionCheck=semanticDefinitions(oldDefinitions,newDefinitions);
 const preserved=['canonical.mjs','schema.mjs','schema-data.mjs','errors.mjs','projections.mjs','index.mjs','windows-paths.mjs'];
 for(const member of preserved)assert.deepEqual(fs.readFileSync(path.join(directory,product+'src/'+member)),fs.readFileSync(path.join(root,product+'src/'+member)),'Unexpected correction outside helper/publication: '+member);
 const overlay=[];for(const member of corrected){const bytes=fs.readFileSync(path.join(root,product+member)),prior=fs.readFileSync(path.join(directory,product+member));fs.writeFileSync(path.join(directory,product+member),bytes);overlay.push({...identity(product+member,bytes),previousSha256:h(prior),changed:!bytes.equals(prior)});}
 const {DEFINITIONS:compiledDefinitions}=await import(pathToFileURL(path.join(directory,product+'src/constants.mjs')).href);assert.deepEqual(compiledDefinitions,newDefinitions);
 const pureClosure=closure(directory,branch.seams),tests=original.map(row=>row.path).filter(member=>new RegExp('/mo1307_phase'+branch.id+'_.*_test\\.mjs$').test(member));
 const args=['--test','--test-reporter=tap','--test-concurrency=1',...tests],result=spawnSync(process.execPath,args,{cwd:directory,windowsHide:true,encoding:null,timeout:60000,maxBuffer:16*1024*1024});
 const stdout=result.stdout??Buffer.alloc(0),stderr=result.stderr??Buffer.alloc(0);fs.writeFileSync(path.join(output,branch.id+'.stdout.txt'),stdout);fs.writeFileSync(path.join(output,branch.id+'.stderr.txt'),stderr);
 const text=stdout.toString('utf8'),counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>[key,Number(new RegExp('^# '+key+' (\\d+)$','m').exec(text)?.[1]??-1)]));
 let vectorRows=[],error=null;try{assert.equal(result.error,undefined);assert.equal(result.status,0);assert.equal(counts.tests,branch.expectedTests);assert.equal(counts.pass,counts.tests);for(const key of ['fail','cancelled','skipped','todo'])assert.equal(counts[key],0);vectorRows=await vectors(branch,directory);}catch(failure){error={name:failure.name,message:failure.message};}
 const effective=original.map(row=>identity(row.path,fs.readFileSync(path.join(directory,row.path))));
 for(const row of sourceBindings)assert.deepEqual(identity(row.path,fs.readFileSync(path.join(root,row.path))),row);
 for(const row of effective){const over=overlay.find(item=>item.path===row.path),committed=original.find(item=>item.path===row.path);assert.equal(row.sha256,over?over.sha256:committed.sha256);}
 const after=state(branch);assert.deepEqual(after,before);write(branch.id+'-vectors.json',{kind:'MO1307CompatibilityVectors',version:'1.0.0',commit:branch.commit,exactCommittedAcceptanceVectors:error===null,vectors:vectorRows});
 const receipt={kind:'MO1307FinalizationStreamCompatibility',version:'1.0.0',stream:branch.id,baseline,semanticStreamParent:B1,commit:branch.commit,classification:error?'INVALIDATED':'UNCHANGED_REUSABLE',result:error?'FAIL':'PASS',sourceWorktree:{path:branch.worktree,before,after,modified:false},runtime:{node:process.version,platform:process.platform,arch:process.arch,sha256:pin},snapshot:{path:path.relative(root,directory).replaceAll('\\','/'),files:original.length,sha256:h(canonical(original))},overlay,definitionCheck,pureClosure,effectiveSources:effective.filter(row=>row.path.startsWith(product+'src/')),tests:{command:{executable:process.execPath,args},exit:result.status,error:result.error?.code??null,counts,testNames:[...text.matchAll(/^# Subtest: (.+)$/gm)].map(match=>match[1]),stdout:identity(branch.id+'.stdout.txt',stdout),stderr:identity(branch.id+'.stderr.txt',stderr)},exactAcceptedVectors:vectorRows.length,elapsedMs:Math.round(performance.now()-start),preservedBranchFoundation:true,preservedBranchFixtures:true,packageRegenerated:false,phase2DIntegration:false,network:false,predecessorCampaignsRerun:false,error};
 write(branch.id+'-receipt.json',receipt);receipts.push(receipt);process.stdout.write(JSON.stringify({stream:branch.id,result:receipt.result,classification:receipt.classification,tests:counts,vectors:vectorRows.length})+'\n');if(error)break;
}
const runnerPath=fileURLToPath(import.meta.url),runnerBytes=fs.readFileSync(runnerPath);write('matrix.json',{kind:'MO1307FinalizationCompatibilityMatrix',version:'1.0.0',baseline,semanticStreamParent:B1,runner:identity(path.relative(root,runnerPath).replaceAll('\\','/'),runnerBytes),correctedSourceBindings:sourceBindings,streams:receipts.map(row=>({stream:row.stream,commit:row.commit,classification:row.classification,result:row.result,tests:row.tests.counts,exactAcceptedVectors:row.exactAcceptedVectors,receipt:row.stream+'-receipt.json'})),result:receipts.length===2&&receipts.every(row=>row.result==='PASS')?'PASS':'FAIL',scope:'SEPARATE_COMMITTED_STREAM_SEMANTIC_COMPATIBILITY_ONLY',phase2DIntegration:false});process.exitCode=receipts.length===2&&receipts.every(row=>row.result==='PASS')?0:1;
