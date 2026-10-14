import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const capabilities=JSON.parse(fs.readFileSync(new URL('../../fixtures/mo1306/phase2b/generation-capabilities.json',import.meta.url)));
const baseline=capabilities.baseline;
const evidencePath='repositories/cca-conformance/evidence/mo1306';
const historicalTest='repositories/cca-conformance/tools/mo1306/contracts.test.mjs';
const packagePath='repositories/memoryos-ci';
function git(args,input) {
  const result=spawnSync('git',args,{cwd:root,input,maxBuffer:128*1024*1024,windowsHide:true});
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr?.toString());return result.stdout;
}
const gitText=args=>git(args).toString('utf8').trim();
const sha256=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const blobId=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function tree(paths) {
  return git(['ls-tree','-r','-z',baseline.revision,'--',...paths]).toString('utf8').split('\0').filter(Boolean).map(line=>{
    const [header,name]=line.split('\t'),[mode,type,object]=header.split(' ');
    assert.equal(type,'blob');assert.equal(mode,'100644');return {path:name,object};
  });
}
function blobs(rows) {
  const output=git(['cat-file','--batch'],Buffer.from(rows.map(row=>row.object+'\n').join(''))),result=new Map();
  let offset=0;
  for(const row of rows) {
    const end=output.indexOf(10,offset);assert.ok(end>offset);
    const [object,type,length]=output.subarray(offset,end).toString('ascii').split(' ');
    assert.equal(object,row.object);assert.equal(type,'blob');assert.match(length,/^[0-9]+$/);
    const size=Number(length),bytes=output.subarray(end+1,end+1+size);
    assert.equal(bytes.length,size);assert.equal(blobId(bytes),object);assert.equal(output[end+1+size],10);
    result.set(row.path,bytes);offset=end+size+2;
  }
  assert.equal(offset,output.length);return result;
}

test('B1 history: pinned revision graph and provider states remain authoritative',()=>{
  assert.equal(baseline.revision,'dbafc0061aa493da2517ee5564f9ea6adb90f52d');
  assert.equal(capabilities.implementationRevision,'1d43584cef532ebcdf1e87b0cba277d2d7180a63');
  assert.equal(gitText(['rev-parse',baseline.revision+'^{tree}']),baseline.tree);
  assert.equal(gitText(['rev-parse',baseline.revision+':'+evidencePath]),baseline.evidenceTree);
  assert.equal(gitText(['rev-parse',baseline.revision+':'+packagePath]),baseline.packageTree);
  assert.equal(gitText(['rev-parse',baseline.revision+':'+historicalTest]),baseline.contractsTestBlob);
  assert.equal(gitText(['rev-parse',capabilities.implementationRevision+'^']),baseline.revision);
  // Constructed integration has B1 as its parent; source branches are evidence.
  git(['merge-base','--is-ancestor',baseline.revision,'HEAD']);
  assert.deepEqual(baseline.providers,{generic:'FOUNDATION_IMPLEMENTED',github:'NOT_IMPLEMENTED',gitlab:'NOT_IMPLEMENTED',jenkins:'NOT_IMPLEMENTED',azure:'NOT_IMPLEMENTED'});
  const inventory=JSON.parse(git(['show',baseline.revision+':repositories/cca-conformance/mo1306-conformance-inventory.json']));
  assert.deepEqual(Object.fromEntries(inventory.providers.map(row=>[row.id,row.status])),baseline.providers);
  const interfaces=JSON.parse(git(['show',baseline.revision+':repositories/cca-conformance/mo1306-phase2-interfaces.json']));
  for(const provider of ['github','gitlab','jenkins','azure'])assert.equal(interfaces.providers[provider],'NOT_IMPLEMENTED');
  assert.deepEqual(Object.keys(capabilities.generation).sort(),['azure','generic','github','gitlab','jenkins']);
  assert.deepEqual(Object.entries(capabilities.generation).filter(([,row])=>row.state==='IMPLEMENTED').map(([provider])=>provider).sort(),['generic','gitlab','jenkins']);
});

test('B1 history: every retained evidence and historical validator byte is unchanged',t=>{
  const rows=tree([
    evidencePath,'repositories/cca-conformance/tools/mo1306',
    'repositories/cca-conformance/mo1306-conformance-inventory.json',
    'repositories/cca-conformance/mo1306-phase2-interfaces.json',
    'repositories/cca-conformance/mo1306-phase1-required-cases.json',
    'docs/mo1306-phase1-foundation.md','docs/mo1306-phase1-supply-chain-review.md',
    'docs/mo1306-phase1-contract-blocker.md','docs/mo1306-contract-freeze-1.md',
    'docs/mo1306-contract-freeze-1-process-correction.md'
  ]).filter(row=>row.path!==historicalTest);
  let bytesChecked=0,evidenceFiles=0;
  for(const row of rows) {
    const bytes=fs.readFileSync(path.join(root,row.path));
    assert.equal(blobId(bytes),row.object,'Historical bytes changed: '+row.path);
    bytesChecked+=bytes.length;if(row.path.startsWith(evidencePath+'/'))evidenceFiles++;
  }
  assert.ok(evidenceFiles>0);
  t.diagnostic(JSON.stringify({baseline:baseline.revision,unchangedFiles:rows.length,evidenceFiles,bytesChecked}));
});

test('B1 history: replay the unmodified B1 cheap suite with its exact B1 package',t=>{
  const fixture='repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json';
  const rows=tree([packagePath,historicalTest,fixture]),saved=blobs(rows);
  // Bind this fresh replay to committed B1 bytes, not to an earlier execution's
  // historical harness identity; those immutable receipts are verified above.
  assert.equal(sha256(saved.get(historicalTest)),baseline.contractsTestSha256);
  const cache=path.join(root,'.cache','mo1306-phase2b');fs.mkdirSync(cache,{recursive:true});
  const replay=fs.mkdtempSync(path.join(cache,'b1-replay-'));
  for(const row of rows) {
    const output=path.resolve(replay,row.path);
    assert.ok(output.startsWith(replay+path.sep));
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,saved.get(row.path),{flag:'wx'});
    assert.equal(blobId(fs.readFileSync(output)),row.object);
  }
  const replayEnvironment={...process.env};delete replayEnvironment.NODE_TEST_CONTEXT;
  const execution=spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(replay,historicalTest)],{
    cwd:replay,env:replayEnvironment,windowsHide:true,timeout:60000,maxBuffer:4*1024*1024
  });
  const stdout=execution.stdout?.toString('utf8')??'',stderr=execution.stderr?.toString('utf8')??'';
  fs.writeFileSync(path.join(replay,'contracts.tap'),stdout,{flag:'wx'});
  assert.equal(execution.error,undefined);assert.equal(execution.status,0,stdout+'\n'+stderr);
  assert.match(stdout,/# tests 152\b/);assert.match(stdout,/# pass 152\b/);assert.match(stdout,/# fail 0\b/);assert.match(stdout,/# skipped 0\b/);
  assert.match(stdout,/ok \d+ - CF-GENERATION golden and deterministic ordering/);
  t.diagnostic(JSON.stringify({baseline:baseline.revision,testBlob:baseline.contractsTestBlob,testSha256:baseline.contractsTestSha256,packageFiles:rows.filter(row=>row.path.startsWith(packagePath+'/')).length,tests:152,passed:152,failed:0,skipped:0,replayDirectory:path.relative(root,replay).replaceAll('\\','/')}));
});
