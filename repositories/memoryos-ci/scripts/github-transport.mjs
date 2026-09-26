import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { installNetworkBoundary } from '../src/worker-boundary.mjs';
import { commonExit,parseSummary,gatePrerequisite,transportInstallation,verifyGitHubRun,outputLines } from '../src/github-transport.mjs';
import { classification,projections,reject,diagnosticWriter } from '../src/errors.mjs';
import { absolutePath } from '../src/filesystem.mjs';

installNetworkBoundary();
const [mode,workspaceRoot,configurationDigest,distributionDigest,captured]=process.argv.slice(2);
const options={deadline:performance.now()+73000};
let result={complete:false,exitCode:commonExit(captured)??16,runId:''};
try {
  if(!['bootstrap','evaluate','gate'].includes(mode)||process.argv.length!==(mode==='evaluate'?7:6))reject('USAGE');
  if(mode==='gate') {
    const preliminary=gatePrerequisite({complete:process.env.COMPLETE,exitCode:process.env.EXIT_CODE,runId:process.env.RUN_ID,evaluateOutcome:process.env.EVALUATE_OUTCOME,uploadOutcome:process.env.UPLOAD_OUTCOME});
    if(preliminary!==null){process.exitCode=preliminary;}else {
      const installation=await transportInstallation(configurationDigest,distributionDigest,options);
      const verified=await verifyGitHubRun(path.join(absolutePath(workspaceRoot),'_memoryos','data'),{runId:process.env.RUN_ID,exitCode:commonExit(process.env.EXIT_CODE),configurationDigest,distributionDigest},installation,options);
      process.exitCode=verified.exitCode;
    }
  } else {
    const installation=await transportInstallation(configurationDigest,distributionDigest,options);
    if(mode==='evaluate') {
      const chunks=[];let size=0;
      for await(const chunk of process.stdin){size+=chunk.length;if(size>4096)reject('BUNDLE_INTEGRITY');chunks.push(chunk);}
      const summary=parseSummary(Buffer.concat(chunks),commonExit(captured));
      result={complete:false,exitCode:summary.exitCode,runId:summary.runId};
      if(summary.publication==='COMPLETE')result=await verifyGitHubRun(path.join(absolutePath(workspaceRoot),'_memoryos','data'),{runId:summary.runId,exitCode:summary.exitCode,configurationDigest,distributionDigest,summary},installation,options);
    }
  }
} catch(error) {
  const code=projections[classification(error)].exitCode;
  diagnosticWriter(text=>process.stderr.write(text))(error);
  if(mode==='evaluate')result={complete:false,exitCode:code,runId:result.runId};else process.exitCode=code;
}
if(mode==='evaluate'){process.stdout.write(outputLines(result));process.exitCode=0;}
