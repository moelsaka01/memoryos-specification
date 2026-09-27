import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const pkg=path.resolve(process.argv[2]),root=path.resolve(process.argv[3]),pin=process.argv[4];
const {generate}=await import(pathToFileURL(path.join(pkg,'src/generator.mjs'))),{verifyDistribution}=await import(pathToFileURL(path.join(pkg,'src/integrity.mjs'))),{providerIR}=await import(pathToFileURL(path.join(pkg,'src/provider-ir.mjs'))),{projections}=await import(pathToFileURL(path.join(pkg,'src/errors.mjs')));
const config=JSON.parse(fs.readFileSync(path.join(root,'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json'))),installation=verifyDistribution(process.argv[5]??pkg);
const options={generic:{},gitlab:{runnerTag:'MemoryOS_Windows'},jenkins:{agentLabel:'MemoryOS_Windows'},azure:{pool:'MemoryOS_Windows'},github:{repository:'moelsaka01/cca-workspace',toolRevision:'0e35ffe70919d77b1db530929093826410b805f9',configPath:'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json'}};
const providers=[];
for(const [provider,settings]of Object.entries(options)){
 const deployment={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider,distributionDigest:pin,options:settings},files=generate(config,deployment,installation.generatorDigest);
 const again=generate(config,deployment,installation.generatorDigest);if(JSON.stringify(files)!==JSON.stringify(again))throw Error('Nondeterministic provider generation');
 providers.push({provider,deployment,files:files.map(f=>({path:f.path,text:f.bytes.toString('utf8')})),projections:Object.fromEntries(Object.keys(projections).map(key=>[key,providerIR(provider).project(key)]))});
}
console.log(JSON.stringify({identities:installation.identities,adapterDigests:installation.adapterDigests,generatorDigest:installation.generatorDigest,providers}));
