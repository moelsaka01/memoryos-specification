import { configuration,validate,digest } from './contracts.mjs';
import { J } from './serialization.mjs';
import { reject } from './errors.mjs';
import * as generic from './providers/generic.mjs';

/** Pure IR: fixed paths and byte sequences. Provider expansion belongs to Phase 2. */
export function generate(config,deployment,generatorDigest) {
  const normalized=configuration(Buffer.from(J(config)));
  validate('Deployment',deployment,'GENERATION_INVALID');
  if(deployment.provider!=='generic')reject('PROVIDER_UNSUPPORTED');
  const files=generic.generate(normalized,deployment);
  files.push({path:'memoryos-ci.json',bytes:Buffer.from(J(normalized))});
  files.sort((a,b)=>a.path<b.path?-1:1);
  const manifest={kind:'MemoryOSCICDGeneration',version:'1.0.0',generator:{id:'memoryos.cicd.generator',version:'1.0.0',sha256:generatorDigest},configurationSha256:digest(J(normalized)),deploymentSha256:digest(J(deployment)),provider:deployment.provider,files:files.map(f=>({path:f.path,byteLength:f.bytes.length,sha256:digest(f.bytes)}))};
  validate('Generation',manifest,'GENERATION_INVALID');
  files.push({path:'memoryos-ci-generation.json',bytes:Buffer.from(J(manifest))});
  if(files.length>3||files.some(f=>f.bytes.length>32768)||files.reduce((sum,f)=>sum+f.bytes.length,0)>131072)reject('OUTPUT_LIMIT');
  return files;
}
