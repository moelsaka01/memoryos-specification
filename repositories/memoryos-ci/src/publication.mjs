import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { J } from './serialization.mjs';
import { digest,validate } from './contracts.mjs';
import { reject,CIError } from './errors.mjs';
import { absolutePath,checkPaths,createDirectory,readChecked } from './filesystem.mjs';

export async function prepareOutput(workspace,runId,options) {
  const parent=path.join(workspace,'.memoryos-ci'),out=path.join(parent,'out');
  for(const directory of [parent,out]) {
    if(fs.existsSync(directory)) {
      await checkPaths([{path:directory,allowMissingLeaf:false}],options);
      if(!fs.lstatSync(directory).isDirectory())reject('ARTIFACT_WRITE');
    } else await createDirectory(directory,options);
  }
  const run=absolutePath(path.join(out,runId));
  try {await createDirectory(run,options);await createDirectory(path.join(run,'.pending'),options);}
  catch(e){if(e.code==='EEXIST')reject('OUTPUT_EXISTS');throw e;}
  return run;
}
export async function publish(run,result,evidence,normative,installation,{deadline,signal}) {
  const pending=path.join(run,'.pending'),known=[];
  function checkTerminal(){if(signal?.aborted)reject('CANCELLED');if(performance.now()>=deadline)reject('OVERALL_TIMEOUT');}
  const entries=[['memoryos-ci-result.json',Buffer.from(J(result))],['memoryos-ci-evidence.json',Buffer.from(J(evidence))]];
  if(normative)entries.push(['evaluation-identity.json',normative.identity],['policy-outcome.json',normative.outcome]);
  entries.sort((a,b)=>a[0]<b[0]?-1:1);
  const manifest={kind:'MemoryOSCICDArtifacts',version:'1.0.0',runId:result.runId,files:entries.map(([name,bytes])=>({path:name,byteLength:bytes.length,sha256:digest(bytes)}))};
  validate('Artifacts',manifest,'ARTIFACT_WRITE');
  const manifestBytes=Buffer.from(J(manifest));
  entries.push(['memoryos-ci-artifacts.json',manifestBytes]);
  const marker=Buffer.from(J({kind:'MemoryOSCICDComplete',version:'1.0.0',runId:result.runId,manifestSha256:digest(manifestBytes)}));
  const caps={'memoryos-ci-result.json':8192,'memoryos-ci-evidence.json':16384,'evaluation-identity.json':4060,'policy-outcome.json':4060,'memoryos-ci-artifacts.json':8192};
  if(entries.some(([name,b])=>b.length>caps[name])||marker.length>1024||entries.reduce((n,e)=>n+e[1].length,marker.length)>49152)reject('OUTPUT_LIMIT');
  try {
    for(const [name,bytes] of entries) {
      checkTerminal();
      const temporary=path.join(pending,name);
      await checkPaths([{path:temporary,allowMissingLeaf:true}],{deadline,signal});
      fs.writeFileSync(temporary,bytes,{flag:'wx'});known.push(temporary);
      if(!readChecked(temporary,bytes.length).equals(bytes))reject('ARTIFACT_WRITE');
    }
    for(const [name] of entries) {
      checkTerminal();
      const target=path.join(run,name),source=path.join(pending,name);
      await checkPaths([{path:source,allowMissingLeaf:false},{path:target,allowMissingLeaf:true}],{deadline,signal});
      if(fs.existsSync(target))reject('OUTPUT_EXISTS');
      fs.renameSync(source,target);known.splice(known.indexOf(source),1);
    }
    await checkPaths([{path:pending,allowMissingLeaf:false}],{deadline,signal});
    fs.rmdirSync(pending);
    // Import avoids a static cycle and rechecks exactly the already trusted distribution.
    const {verifyDistribution,verifyNode}=await import('./integrity.mjs');
    verifyNode();
    if(verifyDistribution().identities.distributionDigest!==installation.identities.distributionDigest)reject('RUNTIME_INTEGRITY');
    const target=path.join(run,'memoryos-ci-complete.json');
    await checkPaths([{path:target,allowMissingLeaf:true}],{deadline,signal});
    checkTerminal();
    fs.writeFileSync(target,marker,{flag:'wx'}); // Publication linearization point.
    return digest(entries.find(e=>e[0]==='memoryos-ci-result.json')[1]);
  } catch(error) {
    // Only this attempt's known files; leave incomplete final files for diagnosis.
    for(const name of known) {
      try {await checkPaths([{path:name,allowMissingLeaf:false}],{deadline});fs.unlinkSync(name);}
      catch {throw new CIError('CLEANUP_FAILED');}
    }
    if(error instanceof CIError)throw error;
    reject('ARTIFACT_WRITE');
  }
}
