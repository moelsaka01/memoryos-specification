// Engineering-only stdin bridge: never shipped in the product package.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const stage=process.argv[2],request=JSON.parse(fs.readFileSync(0,'utf8'));
const {generate}=await import(pathToFileURL(path.join(stage,'src/generator.mjs')));
const {verifyDistribution}=await import(pathToFileURL(path.join(stage,'src/integrity.mjs')));
const {configuration,digest}=await import(pathToFileURL(path.join(stage,'src/contracts.mjs')));
const {J}=await import(pathToFileURL(path.join(stage,'src/serialization.mjs')));
const installation=verifyDistribution(stage);
const config=configuration(Buffer.from(J(request.config)));
const deployment={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:request.provider,
  distributionDigest:installation.identities.distributionDigest,
  options:request.provider==='gitlab'?{runnerTag:'windows_2022'}:{agentLabel:'windows_2022'}};
const files=generate(config,deployment,installation.generatorDigest);
const again=generate(Object.fromEntries(Object.entries(config).reverse()),
  Object.fromEntries(Object.entries(deployment).reverse()),installation.generatorDigest);
if(files.some((f,i)=>f.path!==again[i].path||!f.bytes.equals(again[i].bytes)))throw Error('nondeterminism');
console.log(JSON.stringify({files:files.map(f=>({path:f.path,base64:f.bytes.toString('base64')})),
  configurationDigest:digest(J(config)),distributionDigest:installation.identities.distributionDigest,
  deployment,config}));
