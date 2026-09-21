import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { startServer } from '../src/server.mjs';
export const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}};
export async function harness() {
  const input=new PassThrough(),output=new PassThrough(),messages=[];let buffer='';let fatal=0;let nextId=1;
  output.on('data',chunk=>{buffer+=chunk;let lf;while((lf=buffer.indexOf('\n'))>=0){messages.push(JSON.parse(buffer.slice(0,lf)));buffer=buffer.slice(lf+1);}});
  const flags=process.execArgv;process.execArgv=[];let server;
  try{server=await startServer({input,output,fatal:()=>fatal++});}finally{process.execArgv=flags;}
  return {messages,input,output,server,
    async request(method,params={}){
      const id=nextId++;input.write(JSON.stringify({jsonrpc:'2.0',id,method,params:{_meta:meta,...params}})+'\n');
      const deadline=performance.now()+server.limits.operationMs+1000;
      while(!messages.some(x=>x.id===id)){assert.equal(fatal,0);if(performance.now()>deadline)throw Error('RESPONSE_TIMEOUT');await new Promise(r=>setTimeout(r,5));}
      return messages.find(x=>x.id===id);
    },async close(){await server.close();input.destroy();output.destroy();}};
}
