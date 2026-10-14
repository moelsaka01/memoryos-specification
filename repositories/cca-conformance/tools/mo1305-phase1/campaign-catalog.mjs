import {vectors,api,request,credentials} from './installed.mjs';
import {J} from '../../../memoryos-rest/src/serialization.mjs';
import {createHash} from 'node:crypto';
const error=code=>({status:'error',error:{code:'MO1305_'+code,semantic:null}});
export function catalog(){
 const cases=vectors().map(v=>({id:v.id,operation:v.operation,input:v.input,expected:v.expected,status:v.expected.status==='ok'?200:422,mechanism:'independent released SDK oracle',options:{}}));
 for(const operation of ['getHealth','getReadiness','getVersion'])cases.push({id:operation,operation,input:null,expected:null,status:200,mechanism:'operational contract',options:{}});
 const reject=(id,operation,input,code,options={},rawKind=null)=>cases.push({id,operation,input,expected:error(code),status:api.errors['MO1305_'+code].status,mechanism:'real request rejection',options,rawKind});
 reject('error-request-syntax','preparePolicy','{','REQUEST_SYNTAX');reject('error-request-schema','preparePolicy','{}','REQUEST_SCHEMA');
 reject('error-unsupported-media','preparePolicy','{}','UNSUPPORTED_MEDIA',{headers:{'Content-Type':'text/plain'}});
 reject('error-unauthenticated','getHealth',null,'UNAUTHENTICATED',{headers:{Authorization:null}});
 reject('error-forbidden','getHealth',null,'FORBIDDEN',{headers:{Host:'localhost:13050'}});
 reject('error-not-found','getHealth',null,'NOT_FOUND',{path:'/v2/health'});
 reject('error-method','getHealth',null,'METHOD_NOT_ALLOWED',{method:'OPTIONS'});
 reject('error-not-acceptable','getHealth',null,'NOT_ACCEPTABLE',{headers:{Accept:'text/plain'}});
 reject('error-length-required','preparePolicy','','LENGTH_REQUIRED',{headers:{'Content-Length':null}});
 reject('error-input-limit','preparePolicy','[]','INPUT_LIMIT',{headers:{'Content-Length':'1048577'}});
 reject('error-target-limit','getHealth',null,'TARGET_LIMIT',{path:'/'+'x'.repeat(256)});
 reject('error-header-limit','getHealth',null,'HEADER_LIMIT',{headers:{'User-Agent':'x'.repeat(1025)}});
 reject('error-http-version','getHealth',null,'HTTP_VERSION',{},'http10');
 reject('parser-max-depth','preparePolicy','['.repeat(8)+'0'+']'.repeat(8),'REQUEST_SCHEMA');
 reject('parser-max-nodes','preparePolicy','['+Array(127).fill('0').join(',')+']','REQUEST_SCHEMA');
 reject('parser-max-members','preparePolicy',Object.fromEntries(Array.from({length:32},(_,i)=>['k'+i,0])),'REQUEST_SCHEMA');
 reject('parser-max-strings','evaluatePolicy','["'+'a'.repeat(699052)+'","'+'b'.repeat(10948)+'"]','REQUEST_SCHEMA');
 reject('parser-max-escape-expansion','preparePolicy','"'+'\\u0061'.repeat(174763)+'"','INPUT_LIMIT');
 reject('header-max-bytes','getHealth',null,'FORBIDDEN',{},'max-header');
 // All exceptional wire projections are sampled without falsifying their trigger.
 // Trigger behavior is separately tested by installed fault/deadline/security suites.
 for(const code of ['REQUEST_TIMEOUT','RATE_LIMIT','BUSY','OPERATION_TIMEOUT','OUTPUT_LIMIT','RUNTIME_INTEGRITY','INTERNAL_FAILURE','UNAVAILABLE'])cases.push({id:'projection-'+code.toLowerCase().replaceAll('_','-'),operation:'getContractIdentities',input:null,expected:error(code),status:api.errors['MO1305_'+code].status,mechanism:'controlled worker error projection; trigger covered separately',projection:'MO1305_'+code,options:{}});
 cases.push({id:'projection-maximum-semantic-error',operation:'getContractIdentities',input:null,expected:{status:'error',error:{code:'MO1305_SEMANTIC_REJECTED',semantic:{origin:'memoryos',code:'A'.repeat(128),phase:'\u0001'.repeat(128),artifactKind:'\u0001'.repeat(128),limitIdentifier:'\u0001'.repeat(128),failureClass:'preparation',verificationFailure:false}}},status:422,mechanism:'controlled schema maximum semantic-error projection; not claimed as an SDK-produced error',projection:'MAX_SEMANTIC',options:{}});
 const valid=vectors().find(v=>v.id==='max-mip-policy');cases.push({id:'maximum-permitted-headers',operation:valid.operation,input:valid.input,expected:valid.expected,status:200,mechanism:'all allowed headers at maximum accepted lengths; strict grammar restricts total below syntactic cap',options:{headers:{'User-Agent':'a'.repeat(256),'X-Request-ID':'a'.repeat(64),Accept:'application/json','Accept-Language':'*','Content-Encoding':'identity','Sec-Fetch-Mode':'cors','Content-Type':'application/json'+' '.repeat(991)+'; charset="utf-8"'}}});
 assertUnique(cases);return cases.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
function assertUnique(cases){if(new Set(cases.map(c=>c.id)).size!==cases.length)throw Error('DUPLICATE_CASE');}
export function fixture(item){return createHash('sha256').update(J(item)).digest('hex');}
export function raw(item){let bytes=request(item.operation,item.input,item.options);
 if(item.rawKind==='http10')bytes=Buffer.from(bytes.toString().replace('HTTP/1.1','HTTP/1.0'));
 if(item.rawKind==='max-header'){let text=bytes.toString().slice(0,-2),i=0;while(16384-text.length-2>1035)text+='X-'+i+++': '+'a'.repeat(1000)+'\r\n';const left=16384-text.length-2;text+='Z: '+'z'.repeat(left-5)+'\r\n\r\n';bytes=Buffer.from(text);}
 return bytes;
}
export function secretFreeCatalog(){return catalog().map(c=>({...c,fixtureSha256:fixture(c)}));}
