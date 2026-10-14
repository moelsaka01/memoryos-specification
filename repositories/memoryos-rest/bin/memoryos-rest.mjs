#!/usr/bin/env node
import { Socket } from 'node:net';
import { verifyRuntime, verifyDistribution } from '../src/integrity.mjs';
const args=process.argv.slice(2),controller=new AbortController();
let gateway,requestedCode=null,controlPipe=false,controlInput=false;
function requestShutdown(code){
  requestedCode=Math.max(requestedCode??0,code);
  if(!controller.signal.aborted)controller.abort(requestedCode);
  if(gateway)void gateway.shutdown(requestedCode);
}
const interrupt=()=>requestShutdown(0),invalidControl=()=>requestShutdown(1);
// Install control handlers before asynchronous module loading/listener startup.
process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
try {
  if(args.length===2&&args[0]==='--config'){
    // On pinned Windows Node, anonymous stdin pipes have no POSIX FIFO mode.
    controlPipe=process.stdin instanceof Socket&&process.stdin.isTTY!==true;
    controlInput=true;process.stdin.on('data',invalidControl);process.stdin.on('error',invalidControl);
    if(controlPipe)process.stdin.once('end',interrupt);
    process.stdin.resume();
  }
  verifyRuntime();const manifest=verifyDistribution();
  const {rejectEnvironment,loadConfig}=await import('../src/config.mjs');
  const {startGateway}=await import('../src/server.mjs');
  rejectEnvironment();
  if(args.length===1 && args[0]==='--help')process.stdout.write('Usage: memoryos-rest --config <absolute-local-path>\n');
  else if(args.length===1 && args[0]==='--version')process.stdout.write('memoryos-rest 0.1.0\n');
  else {
    if(args.length!==2||args[0]!=='--config')throw new Error('INVALID_ARGUMENTS');
    gateway=await startGateway(loadConfig(args[1]),manifest,{signal:controller.signal});
    if(requestedCode!==null)void gateway.shutdown(requestedCode);
    process.exitCode=await gateway.closed;
  }
} catch {
  process.stderr.write('{"code":"MO1305_UNAVAILABLE","event":"fatal","operationId":null,"requestId":null}\n');
  process.exitCode=gateway?await gateway.shutdown(1):2;
} finally {
  process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);
  if(controlInput){process.stdin.off('data',invalidControl);process.stdin.off('end',interrupt);process.stdin.off('error',invalidControl);process.stdin.pause();}
}
