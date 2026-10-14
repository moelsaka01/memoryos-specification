/** Interoperability-only capture; credentials replaced before leaving this process. */
import tls from 'node:tls';
import {syncBuiltinESMExports} from 'node:module';
const createServer=tls.createServer;
tls.createServer=function(...args){
 const server=createServer.apply(this,args);
 server.on('secureConnection',socket=>{
  let retained=Buffer.alloc(0);
  function capture(chunk){
   const remaining=16384-retained.length;if(remaining<=0){socket.off('data',capture);return;}
   retained=Buffer.concat([retained,chunk.subarray(0,remaining)]);const end=retained.indexOf('\r\n\r\n');if(end<0)return;
   socket.off('data',capture);const lines=retained.subarray(0,end).toString('ascii').split('\r\n'),line=lines.shift(),headers={};
   for(const text of lines){const colon=text.indexOf(':');const key=text.slice(0,colon).toLowerCase();headers[key]=key==='authorization'?'<REDACTED>':text.slice(colon+1).trim();}
   process.send({type:'headers',record:{line,headers,tlsVersion:socket.getProtocol(),alpn:socket.alpnProtocol,cipher:socket.getCipher().standardName}});retained=null;
  }
  socket.prependListener('data',capture);
 });return server;
};
syncBuiltinESMExports();await import('./measure-server.mjs');
