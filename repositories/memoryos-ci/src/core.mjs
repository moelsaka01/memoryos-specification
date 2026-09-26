import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { installNetworkBoundary } from './worker-boundary.mjs';
import { configuration,validate,digest,checkResult } from './contracts.mjs';
import { J } from './serialization.mjs';
import { CIError,reject,errorObject,classification,project,projections } from './errors.mjs';
import { absolutePath,contained,checkPaths,readChecked,nodePathCheck,packageRoot } from './filesystem.mjs';
import { verifyInstallation,semanticContractDigest } from './integrity.mjs';
import { supervise } from './supervisor.mjs';
import { prepareOutput,publish } from './publication.mjs';
import { providerIR } from './provider-ir.mjs';
import { readMetadataEnvironment } from './metadata.mjs';

installNetworkBoundary();
export async function run({workspace,config,provider='generic',signal}) {
  const started=performance.now(),runId=randomUUID();
  let deadline=started+73000,installation,normalized=null,configurationDigest=null,inputDigest=null,inputs=[],normative=null,error=null,metadata=null,runDirectory=null,adapter=null;
  let providerTrusted=false;
  const options=()=>({deadline,signal});
  try {
    adapter=providerIR(provider);providerTrusted=true;metadata=adapter.normalizeMetadata(readMetadataEnvironment(provider));
    workspace=absolutePath(workspace);config=absolutePath(config);
    installation=await verifyInstallation(options(),provider);
    if(!fs.lstatSync(workspace).isDirectory())reject('FILESYSTEM_BOUNDARY');
    const output=path.join(workspace,'.memoryos-ci','out').toLowerCase();
    for(const capability of [config,packageRoot,process.execPath]) {
      const relative=path.relative(output,capability.toLowerCase());
      if(!relative||!relative.startsWith('..')&&!path.isAbsolute(relative))reject('FILESYSTEM_BOUNDARY');
    }
    // The config is one explicit file capability, never directory discovery.
    try {nodePathCheck(config);}catch(e){if(e instanceof CIError)throw e;reject('CONFIG_READ');}
    await checkPaths([{path:workspace,allowMissingLeaf:false},{path:config,allowMissingLeaf:false}],options());
    normalized=configuration(readChecked(config,16384,{readCode:'CONFIG_READ',limitCode:'CONFIG_INVALID'}));
    deadline=started+normalized.timeoutMs+15000-2000;
    configurationDigest=digest(J(normalized));
    if(signal?.aborted)reject('CANCELLED');
    if(performance.now()>=deadline)reject('OVERALL_TIMEOUT');
    const set=normalized.operation==='evaluatePolicySet',selected=set?normalized.policySet:normalized.policy;
    const descriptors=[[set?'policySet':'policy',selected.path,set?4096:2048],['candidateMip',normalized.context.candidateMip,524288]];
    if(normalized.context.baselineMip!==undefined)descriptors.push(['baselineMip',normalized.context.baselineMip,524288]);
    const acquired={policy:null,policySet:null,candidateMip:null,baselineMip:null};
    for(const [role,relative,maximum] of descriptors) {
      const full=contained(workspace,relative);
      try {nodePathCheck(full);}catch(e){if(e instanceof CIError)throw e;reject('INPUT_READ');}
      await checkPaths([{path:full,allowMissingLeaf:false}],options());
      const bytes=readChecked(full,maximum);
      acquired[role]=Uint8Array.from(bytes);
      inputs.push({role,byteLength:bytes.length,sha256:digest(bytes)});
    }
    if(inputs.reduce((sum,row)=>sum+row.byteLength,0)>1052672)reject('INPUT_LIMIT');
    inputDigest=digest(J(inputs));
    const invocation={kind:'MemoryOSCICDInvocation',version:'1.0.0',runId,provider,configuration:normalized,configurationDigest,inputs:acquired,metadata,identities:installation.identities};
    validate('Invocation',{...invocation,inputs:Object.fromEntries(Object.entries(acquired).map(([k,v])=>[k,v===null?null:Buffer.from(v).toString('base64')]))});
    const b64=role=>acquired[role]===null?null:Buffer.from(acquired[role]).toString('base64');
    const request={kind:'MemoryOSCICDWorkerRequest',version:'1.0.0',runId,operation:normalized.operation,expectedSemanticDigest:selected.expectedSemanticDigest,policyBase64:b64('policy'),policySetBase64:b64('policySet'),candidateMipBase64:b64('candidateMip'),baselineMipBase64:b64('baselineMip')};
    normative=await supervise(request,{timeoutMs:normalized.timeoutMs,...options()});
  } catch(e) {error=e instanceof CIError?e:new CIError('INTERNAL_FAILURE');}
  let value=error?classification(error):normative.semantic.decision,resultSha256=null,publication='NONE';
  const identitiesTrusted=installation && !['MO1306_RUNTIME_INTEGRITY','MO1306_CLEANUP_FAILED'].includes(error?.code) && providerTrusted;
  if(identitiesTrusted) {
    const ids=installation.identities;
    const termination=['TIMEOUT','CANCELLED'].includes(value)?value:['MO1306_WORKER_EXIT','MO1306_INTERNAL_FAILURE'].includes(error?.code)?'ABNORMAL':'NORMAL';
    const result=checkResult({kind:'MemoryOSCICDResult',version:'1.0.0',runId,provider,classification:value,semantic:error?null:normative.semantic,error:error?errorObject(error):null,process:{exitCode:projections[value].exitCode,termination},projection:project(value),configurationDigest,inputDigest,contractDigest:ids.contractDigest,limitsDigest:ids.limitsDigest,adapterDigest:ids.adapterDigest});
    const evidence=validate('Evidence',{kind:'MemoryOSCICDEvidence',version:'1.0.0',runId,contract:{id:'memoryos.cicd',version:'1.0.0',sha256:ids.contractDigest,limitsSha256:ids.limitsDigest},configurationSha256:configurationDigest,adapter:{id:adapter.id,version:adapter.version,sha256:ids.adapterDigest},distributionSha256:ids.distributionDigest,runtimeClosureSha256:ids.runtimeClosureDigest,semanticContractSha256:semanticContractDigest,inputs,runtime:{nodeVersion:process.versions.node,nodeSha256:ids.nodeDigest,platform:process.platform,architecture:process.arch,osRelease:os.release()},metadata,resultSha256:digest(J(result)),projectionSha256:digest(J(result.projection))});
    try {
      // A terminal timeout/cancel has no further work budget; never manufacture completion.
      if(signal?.aborted || performance.now()>=deadline)throw error ?? new CIError(signal?.aborted?'CANCELLED':'OVERALL_TIMEOUT');
      runDirectory=await prepareOutput(workspace,runId,options());
      resultSha256=await publish(runDirectory,result,evidence,error?null:normative,installation,options());
      publication='COMPLETE';
    } catch(e) {
      error=e instanceof CIError?e:new CIError('ARTIFACT_WRITE');
      if(!['MO1306_CANCELLED','MO1306_OVERALL_TIMEOUT','MO1306_RUNTIME_INTEGRITY','MO1306_CLEANUP_FAILED','MO1306_OUTPUT_LIMIT','MO1306_OUTPUT_EXISTS'].includes(error.code))error=new CIError('ARTIFACT_WRITE');
      value=classification(error);
    }
  }
  return {summary:{kind:'MemoryOSCICDSummary',version:'1.0.0',runId,classification:value,exitCode:projections[value].exitCode,resultSha256,publication},error,runDirectory};
}
