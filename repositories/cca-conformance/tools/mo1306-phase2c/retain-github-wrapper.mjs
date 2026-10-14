import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../../..',import.meta.url)));
const [attempt,receiptPath]=process.argv.slice(2);
assert(attempt&&receiptPath&&!fs.existsSync(receiptPath));
const report=JSON.parse(fs.readFileSync(path.join(attempt,'report.json'),'utf8'));
assert.equal(report.passed,20);assert.equal(report.cases.length,20);assert(report.cases.every(c=>c.status==='PASS'));
const receiptRoot=path.dirname(receiptPath),artifactRoot=path.join(receiptRoot,'github-wrapper');
assert(!fs.existsSync(artifactRoot));fs.mkdirSync(artifactRoot);
const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
assert.equal(report.productionDigest,digest(fs.readFileSync(path.join(root,'repositories/memoryos-ci/distribution-manifest.json'))));
const artifacts=[];
function copy(relative) {
  assert(!relative.includes('..')&&!path.isAbsolute(relative));
  const bytes=fs.readFileSync(path.join(attempt,relative));assert(bytes.length<65536);
  const target=path.join(artifactRoot,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
  artifacts.push({path:'github-wrapper/'+relative.replaceAll('\\','/'),byteLength:bytes.length,sha256:digest(bytes)});
}
copy('report.json');
for(const row of report.cases.filter(c=>c.bundle)) {
  for(const name of fs.readdirSync(path.join(attempt,row.bundle))) {
    assert(['evaluation-identity.json','memoryos-ci-artifacts.json','memoryos-ci-complete.json','memoryos-ci-evidence.json','memoryos-ci-result.json','policy-outcome.json'].includes(name));
    copy(row.bundle+'/'+name);
  }
  for(const name of ['outputs.txt','evaluate.stdout.txt','evaluate.stderr.txt'])copy(row.id+'/'+name);
}
const harness='repositories/cca-conformance/tools/mo1306-phase2c/github-wrapper.test.mjs';
const retained={...report,status:'PASS',artifactRoot:'github-wrapper',harness:{path:harness,sha256:digest(fs.readFileSync(path.join(root,harness)))},artifacts:artifacts.sort((a,b)=>a.path.localeCompare(b.path,'en'))};
fs.writeFileSync(receiptPath,JSON.stringify(retained,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:'PASS',passed:20,retainedFiles:artifacts.length,receiptPath})+'\n');
