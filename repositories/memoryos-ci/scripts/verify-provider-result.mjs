import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { verifyInstallation } from '../src/integrity.mjs';
import { absolutePath } from '../src/filesystem.mjs';
import { validate,digest } from '../src/contracts.mjs';
import { parseJSON } from '../src/json.mjs';
import { J } from '../src/serialization.mjs';
import { verifyBundle } from '../src/verification.mjs';
import { reject,projections,classification,diagnosticWriter } from '../src/errors.mjs';
import { installNetworkBoundary } from '../src/worker-boundary.mjs';
installNetworkBoundary();
try {
  const [workspace,provider,configPin,distributionPin,exit]=process.argv.slice(2);
  if(process.argv.length!==7||!['generic','gitlab','jenkins','azure','github'].includes(provider)||!/^sha256:[a-f0-9]{64}$/.test(configPin)||!/^sha256:[a-f0-9]{64}$/.test(distributionPin))reject('USAGE');
  const options={deadline:performance.now()+73000};
  const installation=await verifyInstallation(options,provider);
  if(installation.identities.distributionDigest!==distributionPin)reject('RUNTIME_INTEGRITY');
  const chunks=[];let size=0;
  for await(const chunk of process.stdin){size+=chunk.length;if(size>4096)reject('BUNDLE_INTEGRITY');chunks.push(chunk);}
  const input=Buffer.concat(chunks);
  const summary=validate('Summary',parseJSON(input,4096,'BUNDLE_INTEGRITY'),'BUNDLE_INTEGRITY');
  // PowerShell's native pipe adds one host newline. Accept only that transport
  // variation; the JSON record itself must retain its canonical byte ordering.
  const canonical=Buffer.from(J(summary));
  if(canonical.length>1024||!input.equals(canonical)&&!input.equals(Buffer.concat([canonical.subarray(0,-1),Buffer.from('\r\n')])))reject('BUNDLE_INTEGRITY');
  if(!/^(0|6|7|1[0-7])$/.test(exit)||summary.exitCode!==Number(exit)||projections[summary.classification].exitCode!==summary.exitCode)reject('BUNDLE_INTEGRITY');
  if(summary.publication==='COMPLETE') {
    const directory=path.join(absolutePath(workspace),'.memoryos-ci','out',summary.runId);
    const bundle=await verifyBundle(directory,installation,options);
    if(bundle.result.provider!==provider||bundle.result.runId!==summary.runId||bundle.result.classification!==summary.classification||bundle.result.process.exitCode!==summary.exitCode||digest(J(bundle.result))!==summary.resultSha256)reject('BUNDLE_INTEGRITY');
    if(bundle.result.configurationDigest!==null&&bundle.result.configurationDigest!==configPin)reject('CONFIG_INTEGRITY');
  } else if(summary.resultSha256!==null||[0,6,7].includes(summary.exitCode))reject('BUNDLE_INTEGRITY');
  process.stdout.write(J(summary));
} catch(error) {
  diagnosticWriter(s=>process.stderr.write(s))(error);
  process.exitCode=projections[classification(error)].exitCode;
}
