import path from 'node:path';
import { digest, validate, configuration } from './contracts.mjs';
import { readChecked, absolutePath, checkPaths } from './filesystem.mjs';
import { verifyBundle } from './verification.mjs';
import { verifyInstallation } from './integrity.mjs';
import { metadata, readMetadataEnvironment } from './metadata.mjs';
import { parseJSON } from './json.mjs';
import { J } from './serialization.mjs';
import { projections, reject } from './errors.mjs';

export const runIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const artifactBasenames=Object.freeze(['evaluation-identity.json','memoryos-ci-artifacts.json','memoryos-ci-complete.json','memoryos-ci-evidence.json','memoryos-ci-result.json','policy-outcome.json']);
export function commonExit(value) {
  if(typeof value!=='string'||! /^(?:0|6|7|1[0-7])$/.test(value))return null;
  return Number(value);
}
export function parseSummary(bytes,capturedExit) {
  // PowerShell transports stdout through a text pipeline and appends CRLF.
  const text=bytes.toString('utf8').replace(/\r\n/g,'\n');
  const summary=validate('Summary',parseJSON(Buffer.from(text),4096,'BUNDLE_INTEGRITY'),'BUNDLE_INTEGRITY');
  if(J(summary)!==text||summary.exitCode!==capturedExit||summary.exitCode!==projections[summary.classification].exitCode)reject('BUNDLE_INTEGRITY');
  if((summary.publication==='COMPLETE')!==(summary.resultSha256!==null))reject('BUNDLE_INTEGRITY');
  return summary;
}
export function gatePrerequisite({complete,exitCode,runId,evaluateOutcome,uploadOutcome}) {
  const code=commonExit(exitCode);
  if(complete!=='true'||evaluateOutcome!=='success')return code!==null&&code>=10?code:16;
  if(!runIdPattern.test(runId??'')||code===null)return 16;
  if(uploadOutcome!=='success')return 17;
  return null;
}
export async function transportInstallation(configurationDigest,distributionDigest,options={}) {
  if(!/^sha256:[a-f0-9]{64}$/.test(configurationDigest)||!/^sha256:[a-f0-9]{64}$/.test(distributionDigest))reject('CONFIG_INTEGRITY');
  const installation=await verifyInstallation(options,'github');
  if(installation.identities.distributionDigest!==distributionDigest)reject('RUNTIME_INTEGRITY');
  const config=absolutePath(process.env.MEMORYOS_CI_CONFIG??'');
  await checkPaths([{path:config,allowMissingLeaf:false}],options);
  if(digest(J(configuration(readChecked(config,16384))))!==configurationDigest)reject('CONFIG_INTEGRITY');
  return installation;
}
export function bindVerifiedBundle(bundle,{runId,exitCode,configurationDigest,distributionDigest,providerMetadata,summary=null}) {
  const {result,evidence}=bundle;
  if(!runIdPattern.test(runId)||result.runId!==runId||result.provider!=='github'||result.process.exitCode!==exitCode||result.configurationDigest!==configurationDigest||evidence.distributionSha256!==distributionDigest||J(evidence.metadata)!==J(providerMetadata))reject('BUNDLE_INTEGRITY');
  if(summary&&(summary.publication!=='COMPLETE'||summary.resultSha256!==digest(J(result))||summary.runId!==result.runId||summary.classification!==result.classification||summary.exitCode!==result.process.exitCode))reject('BUNDLE_INTEGRITY');
  return {complete:true,exitCode:result.process.exitCode,runId:result.runId};
}
export async function verifyGitHubRun(workspace,expected,installation,options={}) {
  if(!runIdPattern.test(expected.runId??''))reject('BUNDLE_INTEGRITY');
  const directory=path.join(absolutePath(workspace),'.memoryos-ci','out',expected.runId);
  let bundle;
  try {bundle=await verifyBundle(directory,installation,options);}
  catch {reject('BUNDLE_INTEGRITY');}
  return bindVerifiedBundle(bundle,{...expected,providerMetadata:metadata('github',readMetadataEnvironment('github'))});
}
export function outputLines(value) {
  if(typeof value.complete!=='boolean'||commonExit(String(value.exitCode))===null||value.runId!==''&&!runIdPattern.test(value.runId))reject('BUNDLE_INTEGRITY');
  if(value.complete&&!value.runId)reject('BUNDLE_INTEGRITY');
  return 'complete='+value.complete+'\nexit-code='+value.exitCode+'\nrun-id='+value.runId+'\n';
}
