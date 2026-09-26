import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { configuration } from '../../../memoryos-ci/src/contracts.mjs';
import { generate as azure } from '../../../memoryos-ci/src/providers/azure.mjs';
import { generate as github } from '../../../memoryos-ci/src/providers/github.mjs';
import { validateGeneratedStructure,parseGeneratedYaml } from '../../../memoryos-ci/src/generated-structure.mjs';

const config=configuration(fs.readFileSync(new URL('../../fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',import.meta.url)));
const pin='sha256:'+'1'.repeat(64);
const deployments={
  azure:{kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'azure',distributionDigest:pin,options:{pool:'MemoryOS_Windows'}},
  github:{kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'github',distributionDigest:pin,options:{repository:'memoryos/tools',toolRevision:'a'.repeat(40),configPath:'configs/memoryos-ci.json'}},
  generic:{kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'generic',distributionDigest:pin,options:{}},
};
const outputs={azure:azure(config,deployments.azure),github:github(config,deployments.github),generic:[]};
for(const provider of Object.keys(outputs))test(provider+' accepted closed production grammar',()=>assert.doesNotThrow(()=>validateGeneratedStructure(config,deployments[provider],outputs[provider])));
const mutations=[
  ['duplicate root','azure',"pr: 'none'\n","pr: 'none'\ntrigger: 'none'\n"],
  ['unknown root','azure','pool:\n',"variables: 'unsafe'\npool:\n"],
  ['unknown nested','azure','    steps:\n',"    container: 'evil'\n    steps:\n"],
  ['missing key','azure','        lfs: false\n',''],
  ['wrong scalar type','azure','timeoutInMinutes: 5',"timeoutInMinutes: '5'"],
  ['wrong mapping order','azure',"trigger: 'none'\npr: 'none'", "pr: 'none'\ntrigger: 'none'"],
  ['wrong indentation','azure',"    - 'Agent.OS -equals Windows_NT'", "      - 'Agent.OS -equals Windows_NT'"],
  ['NBSP indentation','azure','  name:', '\u00a0\u00a0name:'],
  ['em-space indentation','azure','  name:', '\u2003\u2003name:'],
  ['anchor','azure','pool:\n','pool: &pool\n'],
  ['alias','azure',"  name: 'MemoryOS_Windows'",'  name: *pool'],
  ['tag','azure',"  name: 'MemoryOS_Windows'", "  name: !!str 'MemoryOS_Windows'"],
  ['flow collection','azure',"  demands:\n    - 'Agent.OS -equals Windows_NT'", "  demands: ['Agent.OS -equals Windows_NT']"],
  ['script injection','azure','          exit $gateExit','          Write-Output evil\n          exit $gateExit'],
  ['wrong distribution pin','azure',pin,'sha256:'+'2'.repeat(64)],
  ['wrong provider','azure',"-Provider 'azure'", "-Provider 'github'"],
  ['unquoted ordinary string','azure',"trigger: 'none'",'trigger: none'],
  ['comment injection','azure','pool:\n','# extra\npool:\n'],
  ['wrong pool OS','azure','Windows_NT','Linux'],
  ['wrong checkout setting','github','persist-credentials: false','persist-credentials: true'],
  ['wrong hosted OS','github','windows-2022','ubuntu-latest'],
  ['wrong permission','github',"contents: 'read'", "contents: 'write'"],
  ['missing bootstrap','github',"id: 'bootstrap'", "id: 'other'"],
  ['unapproved expression','github','${{ github.sha }}','${{ secrets.TOKEN }}'],
  ['expression scalar style','github','ref: ${{ github.sha }}', "ref: '${{ github.sha }}'"],
  ['wrong completion','github',"outputs.complete == 'true'", "outputs.complete == 'false'"],
  ['unbounded upload','github','/evaluation-identity.json','/**'],
  ['wrong run-id binding','github','${{ steps.evaluate.outputs.run-id }}','${{ github.run_id }}'],
];
for(const [name,provider,source,replacement] of mutations)test(name+' rejected',()=>{
  const file=outputs[provider][0],text=file.bytes.toString('utf8');assert.ok(text.includes(source));
  assert.throws(()=>validateGeneratedStructure(config,deployments[provider],[{...file,bytes:Buffer.from(text.replace(source,replacement))}]),error=>error.code==='MO1306_GENERATION_INVALID');
});
for(const [name,mutate] of [
  ['invalid UTF8',bytes=>Buffer.concat([Buffer.from([255]),bytes])],
  ['BOM',bytes=>Buffer.concat([Buffer.from([239,187,191]),bytes])],
  ['CR',bytes=>Buffer.from(bytes.toString().replace('\n','\r\n'))],
  ['NUL',bytes=>Buffer.concat([Buffer.from([0]),bytes])],
  ['extra LF',bytes=>Buffer.concat([bytes,Buffer.from('\n')])],
])test(name+' rejected by byte boundary',()=>assert.throws(()=>parseGeneratedYaml(mutate(outputs.azure[0].bytes)),error=>error.code==='MO1306_GENERATION_INVALID'));
test('wrong path rejected',()=>assert.throws(()=>validateGeneratedStructure(config,deployments.azure,[{...outputs.azure[0],path:'../azure-pipelines.yml'}])));
test('extra artifact rejected',()=>assert.throws(()=>validateGeneratedStructure(config,deployments.azure,[...outputs.azure,...outputs.azure])));
test('generic cannot emit provider artifact',()=>assert.throws(()=>validateGeneratedStructure(config,deployments.generic,outputs.azure)));
