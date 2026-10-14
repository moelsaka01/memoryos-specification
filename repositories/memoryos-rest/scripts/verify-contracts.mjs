import {api,limits,validate,identities,versionProduct} from '../src/contracts.mjs';
import {readChecked,packageRoot} from '../src/integrity.mjs';
import {J} from '../src/serialization.mjs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
/** Independently reconstruct every published OpenAPI node from the runtime SSOT. */
export function expectedOpenAPI(contract=api,budgets=limits){
 const project=value=>Array.isArray(value)?value.map(project):value!==null&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='$ref'?'#/components/schemas/'+v.slice(8):project(v)])):value;
 const schemas=project(contract.schemas.$defs);delete schemas.Config;const paths={};
 for(const route of contract.routes){
  const responses={'200':{description:'Completed operation, including every evaluation decision',content:{'application/json':{schema:{$ref:'#/components/schemas/'+route.output}}}}};
  for(const rule of Object.values(contract.errors))if(rule.wire)responses[String(rule.status)]={description:'Bounded gateway error',content:{'application/json':{schema:{$ref:'#/components/schemas/Error'}}}};
  for(const [status,response] of Object.entries(responses)){
   const headers=Object.fromEntries(Object.entries(contract.headers.response).filter(([k])=>k!=='content-type').map(([k,v])=>[k,{schema:{type:'string',const:v}}]));
   headers['content-length']={schema:{type:'string',pattern:'^[0-9]+$'}};
   headers['x-request-id']={schema:{type:'string',pattern:contract.headers.requestIdPattern},description:'Only after authentication and valid supplied correlation ID'};
   if(status==='401')headers['www-authenticate']={schema:{const:'Bearer realm="memoryos-rest"'}};
   if(status==='405')headers.allow={schema:{const:route.method}};
   if(status==='429'||status==='503')headers['retry-after']={schema:{const:'1'},description:'429 or MO1305_BUSY only'};
   response.headers=headers;
  }
  const operation={operationId:route.operationId,security:[{bearerToken:[]}],responses,parameters:[{in:'header',name:'X-Request-ID',required:false,schema:{type:'string',pattern:contract.headers.requestIdPattern}}]};
  if(route.input)operation.requestBody={required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/'+route.input}}}};
  paths[route.path]={[route.method.toLowerCase()]:operation};
 }
 return {openapi:'3.1.1',jsonSchemaDialect:'https://json-schema.org/draft/2020-12/schema',info:{title:'MemoryOS REST Gateway',version:contract.apiVersion},security:[{bearerToken:[]}],paths,'x-memoryos-http':{behavior:{"headErrorBody":"A rejected HEAD sends the selected error headers and content-length but no body.","noResponseCodes":["MO1305_CLIENT_CANCELLED"],"successStatus":200,"evaluationDecisions":["PASS","FAIL","COULD_NOT_EVALUATE"],"remoteMode":project(contract.deployment.remoteMode)},headers:project(contract.headers),errors:project(contract.errors),limits:project(budgets)},components:{securitySchemes:{bearerToken:{type:'http',scheme:'bearer',bearerFormat:'64 lowercase hexadecimal characters'}},schemas}};
}
export function verifyOpenAPI(bytes){
 const value=JSON.parse(bytes);if(J(value)!==bytes.toString('utf8')||J(value)!==J(expectedOpenAPI()))throw Error('OPENAPI_RUNTIME_DRIFT');
 function refs(node){if(node===null||typeof node!=='object')return;if(Object.hasOwn(node,'$ref')){const ref=node.$ref;if(typeof ref!=='string'||!ref.startsWith('#/components/schemas/')||!Object.hasOwn(value.components.schemas,ref.slice(21)))throw Error('OPENAPI_REFERENCE');}for(const child of Object.values(node))refs(child);}
 refs(value);return value;
}
export function verifyContracts(){
 if(api.routes.length!==9||Object.keys(api.errors).length!==23||!validate('Identities',{status:'ok',identities})||!validate('Version',versionProduct)||limits.kind!=='MemoryOSRESTResourceLimits')throw Error('CONTRACT');
 verifyOpenAPI(readChecked(resolve(packageRoot,'contracts/openapi.json'),262144));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){verifyContracts();process.stdout.write('Complete runtime/OpenAPI verification passed\n');}
