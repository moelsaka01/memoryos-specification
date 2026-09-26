// Fixed bootstrap verifier. Provider data is argv data, never executable source.
import path from 'node:path';
import { installNetworkBoundary } from '../src/worker-boundary.mjs';
import { verifyInstallation } from '../src/integrity.mjs';
import { verifyBundle } from '../src/verification.mjs';
import { absolutePath } from '../src/filesystem.mjs';
import { validate,digest } from '../src/contracts.mjs';
import { parseJSON } from '../src/json.mjs';
import { J } from '../src/serialization.mjs';
import { reject,diagnosticWriter,classification,projections } from '../src/errors.mjs';
installNetworkBoundary();
try {
  if(process.argv.length!==7)reject('USAGE');
  const [workspace,configurationDigest,provider,exit,encoded]=process.argv.slice(2);
  absolutePath(workspace);
  if(!['generic','gitlab','jenkins'].includes(provider)||!/^sha256:[a-f0-9]{64}$/.test(configurationDigest))reject('USAGE');
  if(encoded.length>1364||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))reject('BUNDLE_INTEGRITY');
  const bytes=Buffer.from(encoded,'base64'),raw=bytes.toString('utf8');
  if(bytes.length>1023||bytes.toString('base64')!==encoded||!Buffer.from(raw).equals(bytes))reject('BUNDLE_INTEGRITY');
  const summary=validate('Summary',parseJSON(Buffer.from(raw+'\n'),1024,'BUNDLE_INTEGRITY'),'BUNDLE_INTEGRITY');
  if(J(summary)!==raw+'\n'||String(summary.exitCode)!==exit||projections[summary.classification].exitCode!==summary.exitCode)reject('BUNDLE_INTEGRITY');
  const installation=await verifyInstallation();
  if(summary.publication==='COMPLETE') {
    const {result}=await verifyBundle(path.join(workspace,'.memoryos-ci','out',summary.runId),installation);
    if(digest(J(result))!==summary.resultSha256||result.provider!==provider||result.configurationDigest!==configurationDigest||
       result.classification!==summary.classification||result.process.exitCode!==summary.exitCode)reject('BUNDLE_INTEGRITY');
  } else if(summary.resultSha256!==null||['PASS','FAIL','COULD_NOT_EVALUATE'].includes(summary.classification))reject('BUNDLE_INTEGRITY');
} catch(error) {
  diagnosticWriter(text=>process.stderr.write(text))(error);
  process.exitCode=projections[classification(error)].exitCode;
}
