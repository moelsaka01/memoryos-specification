import { configuration,deployment as normalizeDeployment,validate,digest } from './contracts.mjs';
import { J } from './serialization.mjs';
import { reject } from './errors.mjs';
import { providerIR } from './provider-ir.mjs';
import { validateGeneratedStructure } from './generated-structure.mjs';

/** Pure, closed provider generation from one normalized common configuration. */
export function generate(config,deployment,generatorDigest) {
  const normalized=configuration(Buffer.from(J(config)));
  deployment=normalizeDeployment(Buffer.from(J(deployment)));
  const adapter=providerIR(deployment.provider);
  const files=adapter.generate(normalized,deployment);
  validateGeneratedStructure(normalized,deployment,files);
  files.push({path:'memoryos-ci.json',bytes:Buffer.from(J(normalized))});
  files.sort((a,b)=>a.path<b.path?-1:1);
  const manifest={kind:'MemoryOSCICDGeneration',version:'1.0.0',generator:{id:'memoryos.cicd.generator',version:'1.0.0',sha256:generatorDigest},configurationSha256:digest(J(normalized)),deploymentSha256:digest(J(deployment)),provider:deployment.provider,files:files.map(f=>({path:f.path,byteLength:f.bytes.length,sha256:digest(f.bytes)}))};
  validate('Generation',manifest,'GENERATION_INVALID');
  files.push({path:'memoryos-ci-generation.json',bytes:Buffer.from(J(manifest))});
  if(files.length>3||files.some(f=>f.bytes.length>32768)||files.reduce((sum,f)=>sum+f.bytes.length,0)>131072)reject('OUTPUT_LIMIT');
  return files;
}
