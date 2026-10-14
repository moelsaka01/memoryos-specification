import { limits, api } from './contracts.mjs';
import { reject } from './errors.mjs';
const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
export function parseHeader(bytes) {
  const f=limits.fixed;
  if(bytes.length>f.headerBytes)reject('HEADER_LIMIT');
  if(bytes.some(b => b>126 || (b<32 && b!==13 && b!==10)))reject('REQUEST_SYNTAX');
  const text=bytes.toString('ascii');
  if(!text.endsWith('\r\n\r\n') || /(?<!\r)\n|\r(?!\n)/u.test(text))reject('REQUEST_SYNTAX');
  const lines=text.slice(0,-4).split('\r\n'), line=lines.shift();
  if(line.length+2>f.requestLineBytes)reject('HEADER_LIMIT');
  const match=/^([!#$%&'*+.^_`|~0-9A-Z-]+) ([^ ]+) HTTP\/(\d+\.\d+)$/u.exec(line);
  if(!match)reject('REQUEST_SYNTAX');
  const [,method,target,version]=match;
  if(target.length>f.targetBytes)reject('TARGET_LIMIT');
  if(!target.startsWith('/') || /[?#%\\]/u.test(target) || target.includes('//')
      || target.split('/').some(s => s==='.'||s==='..'))reject('REQUEST_SYNTAX');
  if(version!=='1.1')reject('HTTP_VERSION');
  if(lines.length>f.headerCount)reject('HEADER_LIMIT');
  const headers=Object.create(null);
  for(const raw of lines){
    const colon=raw.indexOf(':');
    if(colon<1 || !token.test(raw.slice(0,colon)))reject('REQUEST_SYNTAX');
    const name=raw.slice(0,colon).toLowerCase(), value=raw.slice(colon+1).replace(/^ +| +$/gu,'');
    if(value.length>f.headerValueBytes)reject('HEADER_LIMIT');
    if(Object.hasOwn(headers,name))reject('REQUEST_SYNTAX');
    headers[name]=value;
  }
  if(api.headers.values.forbiddenFraming.some(k => Object.hasOwn(headers,k)))reject('REQUEST_SYNTAX');
  let length=0;
  if(Object.hasOwn(headers,'content-length')){
    if(!/^(0|[1-9][0-9]*)$/u.test(headers['content-length']) || headers['content-length'].length>16)reject('REQUEST_SYNTAX');
    length=Number(headers['content-length']);
    if(!Number.isSafeInteger(length))reject('REQUEST_SYNTAX');
  }
  return {method,target,version,headers,length,headerCount:lines.length,headerBytes:bytes.length};
}
export function parserAgrees(request, gate) {
  const headers=Object.create(null);
  for(let i=0;i<request.rawHeaders.length;i+=2){
    const name=request.rawHeaders[i].toLowerCase();
    if(Object.hasOwn(headers,name))return false;
    headers[name]=request.rawHeaders[i+1];
  }
  return request.method===gate.method && request.url===gate.target && request.httpVersion===gate.version
    && request.rawHeaders.length===gate.headerCount*2 && Object.keys(headers).every(k => headers[k]===gate.headers[k])
    && headers.host===gate.headers.host && Number(headers['content-length']??0)===gate.length;
}
export function headerPolicy(gate, config) {
  const h=gate.headers;
  if(h.host!==config.bindAddress+':'+config.port || Object.keys(h).some(k => !api.headers.allowed.includes(k)))reject('FORBIDDEN');
}
export function mediaPolicy(gate, route) {
  const h=gate.headers, values=api.headers.values;
  for(const [name,code] of [['accept','NOT_ACCEPTABLE'],['accept-encoding','NOT_ACCEPTABLE'],['content-encoding','UNSUPPORTED_MEDIA'],['connection','REQUEST_SCHEMA'],['accept-language','REQUEST_SCHEMA'],['sec-fetch-mode','REQUEST_SCHEMA']]){
    if(h[name]!==undefined && !values[name].includes(name==='sec-fetch-mode'?h[name]:h[name].toLowerCase()))reject(code);
  }
  if(h['content-type']!==undefined && !new RegExp(values.contentTypePattern,'iu').test(h['content-type']))reject('UNSUPPORTED_MEDIA');
  if(route.method==='POST' && h['content-type']===undefined)reject('UNSUPPORTED_MEDIA');
  if(h['user-agent']!==undefined && h['user-agent'].length>limits.fixed.userAgentBytes)reject('REQUEST_SCHEMA');
  if(h['x-request-id']!==undefined && !new RegExp(api.headers.requestIdPattern,'u').test(h['x-request-id']))reject('REQUEST_SCHEMA');
  if(route.method==='POST' && (h['content-length']===undefined||gate.length===0))reject('LENGTH_REQUIRED');
  if(route.method==='GET' && gate.length!==0)reject('REQUEST_SCHEMA');
  if(gate.length>limits.measured.operations[route.operationId].requestBytes)reject('INPUT_LIMIT');
}
