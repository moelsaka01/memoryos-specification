import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]),work=path.resolve(process.argv[3]),load=p=>import(pathToFileURL(path.join(root,p)));
const {delegate}=await load('repositories/memoryos-ci/src/delegate.mjs'),sdk=await load('repositories/memoryos-ci/runtime/authoritative/web/js/memoryos-sdk.js'),mip=await load('repositories/memoryos-ci/runtime/authoritative/web/js/memory-investigation-package.js');
const config=JSON.parse(fs.readFileSync(path.join(work,'memoryos-ci.json'))),set=config.operation==='evaluatePolicySet',selected=set?config.policySet:config.policy,b64=p=>p?fs.readFileSync(path.join(work,p)).toString('base64'):null;
const request={kind:'MemoryOSCICDWorkerRequest',version:'1.0.0',runId:'11111111-1111-4111-8111-111111111111',operation:config.operation,expectedSemanticDigest:selected.expectedSemanticDigest,policyBase64:set?null:b64(selected.path),policySetBase64:set?b64(selected.path):null,candidateMipBase64:b64(config.context.candidateMip),baselineMipBase64:b64(config.context.baselineMip)};
const result=delegate(request,sdk,mip);
for(const [key,name]of [['evaluationIdentityBase64','oracle-identity.json'],['outcomeBase64','oracle-outcome.json']])if(!Buffer.from(result[key],'base64').equals(fs.readFileSync(path.join(work,name))))throw Error('Normative bytes differ from independently invoked source SDK');
console.log(JSON.stringify({decision:result.decision,evaluationIdentityDigest:result.evaluationIdentityDigest,outcomeDigest:result.outcomeDigest,sourceSDKParity:true}));
