import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generate } from '../../../memoryos-ci/src/generator.mjs';
import { configuration,digest } from '../../../memoryos-ci/src/contracts.mjs';
import { J } from '../../../memoryos-ci/src/serialization.mjs';
import { normalizeMetadata } from '../../../memoryos-ci/src/providers/github.mjs';

// Engineering bridge exposes production output to a separately implemented Python
// validator. It contains no workflow grammar or expected script implementation.
const config=configuration(fs.readFileSync(new URL('../../fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',import.meta.url)));
const distributionDigest='sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const deployment={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'github',distributionDigest,options:{repository:'memoryos/ci-tools',toolRevision:'0123456789abcdef0123456789abcdef01234567',configPath:'configs/memoryos-ci.json'}};
const files=generate(config,deployment,distributionDigest);
const serial=rows=>rows.map(row=>({path:row.path,base64:row.bytes.toString('base64')}));
for(let i=0;i<12;i++) assert.deepEqual(serial(generate(config,deployment,distributionDigest)),serial(files));
const reversed=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reversed(item)])):value;
assert.deepEqual(serial(generate(reversed(config),reversed(deployment),distributionDigest)),serial(files));
const defaults={...config};delete defaults.timeoutMs;delete defaults.providerExtensions;
assert.deepEqual(serial(generate(defaults,deployment,distributionDigest)),serial(files));
const metadataBase={GITHUB_REPOSITORY:'memoryos/ci-tools',GITHUB_SHA:deployment.options.toolRevision,GITHUB_RUN_ID:'101',GITHUB_JOB:'memoryos_ci',GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'workflow_dispatch'};
const metadataA=normalizeMetadata(metadataBase),metadataB=normalizeMetadata({...metadataBase,GITHUB_RUN_ID:'202'});
assert.equal(metadataA.runId,'101');assert.equal(metadataB.runId,'202');
assert.deepEqual({...metadataA,runId:null},{...metadataB,runId:null});
for(const value of ['${{ secrets.TOKEN }}','123\ncomplete=true','../../data','x;Write-Output 1','https://host/run/1'])assert.throws(()=>normalizeMetadata({...metadataBase,GITHUB_RUN_ID:value}));
const originalRevision='e1c990bf65d0c7925a68eea8222cd304f8ce6db6';
const originalSource=execFileSync('git',['show',`${originalRevision}:repositories/memoryos-ci/src/providers/github.mjs`],{cwd:new URL('../../../../',import.meta.url),encoding:'utf8',windowsHide:true});
const originalImportable=originalSource.replace(/from '(\.\.\/[^']+)'/g,(_,relative)=>`from '${new URL(relative,new URL('../../../memoryos-ci/src/providers/github.mjs',import.meta.url)).href}'`);
const original=await import('data:text/javascript;base64,'+Buffer.from(originalImportable).toString('base64'));
const spacedDeployment={...deployment,options:{...deployment.options,configPath:'configs/review config.json'}};
process.stdout.write(JSON.stringify({kind:'MemoryOSPhase2CGitHubBridge',configurationDigest:digest(J(config)),deployment,files:serial(files),spaced:{configurationDigest:digest(J(config)),deployment:spacedDeployment,files:serial(generate(config,spacedDeployment,distributionDigest))},original:{revision:originalRevision,sourceSha256:digest(originalSource),files:serial(original.generate(config,deployment))},determinism:{repetitions:12,keyOrderPermutation:true,normalizedDefaults:true},metadata:{mapping:'GITHUB_RUN_ID -> metadata.runId; core RunId remains core-generated',varyRunId:true,rejected:5}})+'\n');
