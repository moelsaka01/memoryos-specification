import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dgram from 'node:dgram';
import dns from 'node:dns';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import child from 'node:child_process';
import threads from 'node:worker_threads';
function deny() { throw new Error('MO1305_WORKER_AUTHORITY_DENIED'); }
function patch(object, names) { for(const name of names)if(typeof object[name]==='function')object[name]=deny; }
export function installWorkerBoundary() {
  globalThis.fetch=deny;globalThis.WebSocket=deny;process.dlopen=deny;
  patch(net,['connect','createConnection','createServer']);patch(net.Socket.prototype,['connect']);patch(net.Server.prototype,['listen']);
  patch(tls,['connect','createServer','createSecurePair']);patch(http,['request','get','createServer']);
  patch(https,['request','get','createServer']);
  for(const agent of [http.Agent,https.Agent])patch(agent.prototype,['createConnection','createSocket','addRequest']);patch(http2,['connect','createServer','createSecureServer']);
  patch(dgram,['createSocket']);patch(dgram.Socket.prototype,['connect','send','bind']);
  for(const module of [dns,dns.promises]){
    patch(module,Object.keys(module).filter(k => /^(lookup|resolve|reverse|setServers)/u.test(k)));
    if(module.Resolver)patch(module.Resolver.prototype,Object.getOwnPropertyNames(module.Resolver.prototype).filter(k => /^(resolve|reverse|setServers)/u.test(k)));
  }
  patch(child,['exec','execFile','execSync','execFileSync','fork','spawn','spawnSync']);patch(child.ChildProcess.prototype,['spawn']);patch(threads,['Worker']);
  const write=/^(appendFile|chmod|chown|copyFile|cp|createWriteStream|fchmod|fchown|fdatasync|fsync|ftruncate|futimes|lchmod|lchown|link|lutimes|mkdir|mkdtemp|rename|rm|rmdir|symlink|truncate|unlink|utimes|write)/u;
  patch(fs,Object.keys(fs).filter(k => write.test(k)));patch(fsp,Object.keys(fsp).filter(k => write.test(k)));
  // A writable descriptor is also authority; only fixed read-only opens remain.
  const syncOpen=fs.openSync, callbackOpen=fs.open, promiseOpen=fsp.open;
  fs.openSync=function(path,flags,...rest){if(flags!=='r')deny();return syncOpen.call(fs,path,flags,...rest);};
  fs.open=function(path,flags,...rest){if(flags!=='r')deny();return callbackOpen.call(fs,path,flags,...rest);};
  fsp.open=async function(path,flags,...rest){if(flags!=='r')deny();const handle=await promiseOpen.call(fsp,path,flags,...rest);
    patch(handle,['appendFile','chmod','chown','createWriteStream','datasync','sync','truncate','utimes','write','writeFile','writev']);return handle;};
  syncBuiltinESMExports();
}
