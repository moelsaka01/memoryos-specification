import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';import http from 'node:http';import https from 'node:https';import tls from 'node:tls';import dns from 'node:dns';import dgram from 'node:dgram';import child from 'node:child_process';
import { resolve,relative,sep,isAbsolute } from 'node:path';import { fileURLToPath,pathToFileURL } from 'node:url';
import { registerHooks,syncBuiltinESMExports } from 'node:module';
export function guards(root,audit) {
 root=resolve(root);const loaded=new Set();
 const within=path=>{const rel=relative(root,resolve(path));return rel===''||(!isAbsolute(rel)&&!rel.startsWith('..'+sep)&&rel!=='..'&&!resolve(rel).startsWith('\\\\'));};
 const reject=kind=>{audit[kind]++;throw Error('TEST_BOUNDARY_REJECTION');};
 const pathOf=p=>p instanceof URL?fileURLToPath(p):typeof p==='string'||Buffer.isBuffer(p)?String(p):null;
 function check(p,metadata=false){const value=pathOf(p);if(!value)return reject('filesystem');const absolute=resolve(value);if(!within(absolute)&&!(metadata&&(root===absolute||root.startsWith(absolute+sep))))reject('filesystem');audit.reads++;}
 for(const object of [fs,fsp]){
  for(const key of ['readFile','readFileSync','open','openSync','createReadStream','access','accessSync','stat','statSync','lstat','lstatSync','realpath','realpathSync','opendir','opendirSync','readdir','readdirSync'])if(typeof object[key]==='function'){
   const original=object[key];object[key]=function(...args){check(args[0],/access|stat|realpath|opendir|readdir/u.test(key));if(/^open(?:Sync)?$/u.test(key)&&args[1]!==undefined&&args[1]!=='r'&&args[1]!==0)reject('writes');return original.apply(this,args);};
  }
  for(const key of ['appendFile','chmod','chown','copyFile','cp','createWriteStream','link','mkdir','mkdtemp','rename','rm','rmdir','symlink','truncate','unlink','write','writeFile'])for(const method of [key,key+'Sync'])if(typeof object[method]==='function')object[method]=()=>reject('writes');
 }
 for(const [object,keys] of [[net,['connect','createConnection','createServer']],[net.Socket.prototype,['connect']],[net.Server.prototype,['listen']],[http,['request','get','createServer']],[https,['request','get','createServer']],[tls,['connect','createServer']],[dgram,['createSocket']],[dns,Object.keys(dns).filter(k=>/^(resolve|lookup)/u.test(k))],[dns.promises,Object.keys(dns.promises).filter(k=>/^(resolve|lookup)/u.test(k))]])for(const key of keys)if(typeof object[key]==='function')object[key]=()=>reject('network');
 globalThis.fetch=()=>reject('network');
 for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])child[key]=()=>reject('shell');
 syncBuiltinESMExports();
 registerHooks({resolve(specifier,context,next){const result=next(specifier,context);if(result.url.startsWith('file:')){const path=fileURLToPath(result.url);if(!within(path))reject('moduleFallback');loaded.add(relative(root,path).replaceAll('\\','/'));if(loaded.size>2000)throw Error('AUDIT_BOUND');audit.modules=[...loaded].sort();}return result;}});
 return async()=>{
  const { AjvJsonSchemaValidator }=await import(pathToFileURL(resolve(root,'node_modules/@modelcontextprotocol/server/dist/validators/ajv.mjs')).href);
  AjvJsonSchemaValidator.prototype.getValidator=()=>reject('validators');Object.defineProperty(AjvJsonSchemaValidator.prototype,'ajv',{get(){return reject('validators');},configurable:true});
 };
}
export const freshAudit=()=>({network:0,filesystem:0,writes:0,shell:0,moduleFallback:0,validators:0,reads:0,modules:[]});
