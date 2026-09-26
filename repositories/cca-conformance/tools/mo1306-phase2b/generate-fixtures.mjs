import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [root,stage]=process.argv.slice(2);
const {generate}=await import(pathToFileURL(path.join(stage,'src/generator.mjs')));
const {verifyDistribution}=await import(pathToFileURL(path.join(stage,'src/integrity.mjs')));
const installation=verifyDistribution(stage);
const fix=path.join(root,'repositories/cca-conformance/fixtures/mo1306');
const evidence=path.join(root,'repositories/cca-conformance/evidence/mo1306/phase2b/generated');
fs.mkdirSync(evidence,{recursive:true});
for(const provider of ['gitlab','jenkins']) {
  const config=JSON.parse(fs.readFileSync(path.join(fix,'evaluate-policy-pass/memoryos-ci.json')));
  const deployment={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider,
    distributionDigest:installation.identities.distributionDigest,
    options:provider==='gitlab'?{runnerTag:'windows_2022'}:{agentLabel:'windows_2022'}};
  const files=generate(config,deployment,installation.generatorDigest);
  const target=path.join(evidence,provider);fs.mkdirSync(target,{recursive:true});
  for(const file of files)fs.writeFileSync(path.join(target,file.path),file.bytes);
  fs.writeFileSync(path.join(target,'deployment.json'),JSON.stringify(deployment)+'\n');
}
console.log(JSON.stringify({status:'PASS',providers:['gitlab','jenkins'],identities:installation.identities,
  adapterDigests:installation.adapterDigests,generatorDigest:installation.generatorDigest}));
