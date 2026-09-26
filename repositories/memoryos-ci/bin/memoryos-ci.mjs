import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { installNetworkBoundary } from '../src/worker-boundary.mjs';
import { CIError,reject,classification,projections,diagnosticWriter } from '../src/errors.mjs';
import { J } from '../src/serialization.mjs';
import { configuration,deployment } from '../src/contracts.mjs';
import { absolutePath,readChecked,checkPaths,createDirectory } from '../src/filesystem.mjs';
import { verifyInstallation } from '../src/integrity.mjs';
import { run } from '../src/generic.mjs';
import { generate } from '../src/generator.mjs';
import { verifyBundle } from '../src/verification.mjs';

installNetworkBoundary();
const diagnostic=diagnosticWriter(text=>process.stderr.write(text));
const controller=new AbortController();
const cancel=()=>controller.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
function argv(args) {
  const command=args[0],allowed={run:['workspace','config','provider'],generate:['config','deployment','output'],verify:['bundle']}[command];
  if(!allowed)reject('USAGE');
  const result={command};
  for(let i=1;i<args.length;i+=2) {
    const flag=args[i];if(!flag.startsWith('--')||!allowed.includes(flag.slice(2))||Object.hasOwn(result,flag.slice(2))||i+1>=args.length)reject('USAGE');
    result[flag.slice(2)]=args[i+1];
  }
  for(const name of allowed.filter(n=>n!=='provider'))if(!result[name])reject('USAGE');
  return result;
}
try {
  const args=argv(process.argv.slice(2));
  if(args.command==='run') {
    const result=await run({...args,signal:controller.signal});
    if(result.error)diagnostic(result.error);
    process.stdout.write(J(result.summary));process.exitCode=result.summary.exitCode;
  } else {
    const options={deadline:performance.now()+73000,signal:controller.signal};
    const installation=await verifyInstallation(options);
    if(args.command==='verify')await verifyBundle(absolutePath(args.bundle),installation,options);
    else {
      for(const input of [args.config,args.deployment])await checkPaths([{path:absolutePath(input),allowMissingLeaf:false}],options);
      const config=configuration(readChecked(args.config,16384,{readCode:'CONFIG_READ',limitCode:'CONFIG_INVALID'}));
      const deploy=deployment(readChecked(args.deployment,16384,{readCode:'GENERATION_INVALID',limitCode:'GENERATION_INVALID'}));
      if(deploy.distributionDigest!==installation.identities.distributionDigest)reject('CONFIG_INTEGRITY');
      const files=generate(config,deploy,installation.generatorDigest),output=absolutePath(args.output);
      if(fs.existsSync(output))reject('OUTPUT_EXISTS');
      await createDirectory(output,options);
      const pending=path.join(output,'.pending');await createDirectory(pending,options);
      // Only generated, fixed relative paths; reserve each nested directory.
      const parents=[...new Set(files.map(f=>path.posix.dirname(f.path)).filter(p=>p!=='.').flatMap(p=>p.split('/').map((_,i,parts)=>parts.slice(0,i+1).join('/'))))].sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b));
      for(const parent of parents)await createDirectory(path.join(pending,parent),options);
      for(const file of files) {
        const target=path.join(pending,file.path);
        await checkPaths([{path:target,allowMissingLeaf:true}],options);
        fs.writeFileSync(target,file.bytes,{flag:'wx'});
        if(!readChecked(target,file.bytes.length).equals(file.bytes))reject('ARTIFACT_WRITE');
      }
      for(const parent of parents)await createDirectory(path.join(output,parent),options);
      for(const file of files) {
        const target=path.join(output,file.path);
        await checkPaths([{path:target,allowMissingLeaf:true},{path:path.join(pending,file.path),allowMissingLeaf:false}],options);
        if(fs.existsSync(target))reject('OUTPUT_EXISTS');
        fs.renameSync(path.join(pending,file.path),target);
      }
      for(const parent of [...parents].reverse()) {
        const directory=path.join(pending,parent);
        await checkPaths([{path:directory,allowMissingLeaf:false}],options);fs.rmdirSync(directory);
      }
      await checkPaths([{path:pending,allowMissingLeaf:false}],options);fs.rmdirSync(pending);
    }
  }
} catch(error) {
  diagnostic(error);process.exitCode=projections[classification(error)].exitCode;
}
finally {process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
