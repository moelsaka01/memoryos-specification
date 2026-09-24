#!/usr/bin/env node
import { verifyRuntime, verifyDistribution } from '../src/integrity.mjs';
const args=process.argv.slice(2);
let gateway;
try {
  verifyRuntime();const manifest=verifyDistribution();
  const {rejectEnvironment,loadConfig}=await import('../src/config.mjs');
  const {startGateway}=await import('../src/server.mjs');
  rejectEnvironment();
  if(args.length===1 && args[0]==='--help')process.stdout.write('Usage: memoryos-rest --config <absolute-local-path>\n');
  else if(args.length===1 && args[0]==='--version')process.stdout.write('memoryos-rest 0.1.0\n');
  else {
    if(args.length!==2||args[0]!=='--config')throw new Error('INVALID_ARGUMENTS');
    gateway=await startGateway(loadConfig(args[1]),manifest);
    process.once('SIGINT',()=>{void gateway.shutdown(0);});process.once('SIGTERM',()=>{void gateway.shutdown(0);});
    process.stdin.on('data',()=>{void gateway.shutdown(1);});process.stdin.once('end',()=>{void gateway.shutdown(0);});process.stdin.on('error',()=>{void gateway.shutdown(1);});process.stdin.resume();
    process.exitCode=await gateway.closed;process.stdin.pause();
  }
} catch { process.stderr.write('{"code":"MO1305_UNAVAILABLE","event":"fatal","operationId":null,"requestId":null}\n');process.exitCode=2;if(gateway)await gateway.shutdown(1); }
