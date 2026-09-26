import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generate } from '../../../memoryos-ci/src/generator.mjs';
import { configuration } from '../../../memoryos-ci/src/contracts.mjs';
import * as azureAdapter from '../../../memoryos-ci/src/providers/azure.mjs';
import * as githubAdapter from '../../../memoryos-ci/src/providers/github.mjs';
import { project } from '../../../memoryos-ci/src/errors.mjs';

const config=configuration(fs.readFileSync(new URL('../../fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',import.meta.url)));
const digest='sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const azure={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'azure',distributionDigest:digest,options:{pool:'MemoryOS_Windows'}};
const github={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'github',distributionDigest:digest,options:{repository:'memoryos/ci-tools',toolRevision:'0123456789abcdef0123456789abcdef01234567',configPath:'configs/memoryos-ci.json'}};
// Fast API/security regression. Full independent YAML/PowerShell grammar and
// retained negative witnesses live in the separate Python contract suites.
let checks=0;
for(const deployment of [azure,github]) {
  const files=generate(config,deployment,digest);
  assert.deepEqual(files,generate(config,deployment,digest));checks++;
  assert.deepEqual(files.map(file=>file.path),deployment.provider==='github'?['.github/workflows/memoryos-ci.yml','memoryos-ci.json','memoryos-ci-generation.json']:['azure-pipelines.yml','memoryos-ci.json','memoryos-ci-generation.json']);checks++;
  for(const file of files) {assert.equal(file.bytes.includes(13),false);assert.equal(file.bytes.includes(0),false);assert.ok(file.bytes.toString('utf8').endsWith('\n'));checks++;}
  for(const outcome of ['PASS','FAIL','COULD_NOT_EVALUATE','CONFIGURATION_ERROR','INPUT_ERROR','INTEGRITY_ERROR','TIMEOUT','CANCELLED','INTERNAL_ERROR','SEMANTIC_ERROR','ARTIFACT_ERROR']) {
    assert.deepEqual((deployment.provider==='github'?githubAdapter:azureAdapter).project(outcome),project(outcome));checks++;
  }
}
for(const value of ['x\n- powershell: evil','x\rfoo','x\u0000','${{ secrets.TOKEN }}','$[foo]','$(whoami)','x;exit 0','../outside']) {
  assert.throws(()=>generate(config,{...azure,options:{pool:value}},digest));checks++;
  assert.throws(()=>generate(config,{...github,options:{...github.options,repository:value}},digest));checks++;
}
assert.throws(()=>azureAdapter.normalizeMetadata({BUILD_REPOSITORY_NAME:'x\n##vso[task.setvariable]'}));checks++;
assert.throws(()=>githubAdapter.normalizeMetadata({GITHUB_REPOSITORY:'x${{ secrets.X }}'}));checks++;
console.log(JSON.stringify({kind:'MemoryOSPhase2CAdapterAPIRegression',checks,status:'PASS'}));
