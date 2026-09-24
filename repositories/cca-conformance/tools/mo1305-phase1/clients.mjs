import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,stage,root,api,credentials,vectors,response,delay} from './installed.mjs';
const cases=['identities','prepare-policy-pass','prepare-policySet-pass','evaluate-policy-pass','evaluate-policy-fail','evaluate-policy-cne','verify-identity','verify-outcome','bad-outcome-digest'].map(id=>vectors().find(v=>v.id===id));
for(const [operation,expected] of [['getHealth',{status:'ok',live:true}],['getReadiness',{status:'ok',ready:true}],['getVersion',Object.fromEntries(Object.entries(api.schemas.$defs.Version.properties).map(([k,v])=>[k,v.const]))]])cases.push({id:operation,operation,input:null,expected});
function run(exe,args,input,env){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{cwd:stage+'/empty',env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('exit',code=>{if(code!==0)reject(Error('CLIENT_EXIT '+code+' '+stderr));else resolve(stdout);});child.stdin.end(input);});}
const clean={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP};
const server=await launch({measurement:true,args:[resolve(import.meta.dirname,'capture-server.mjs'),stage]}),records=[];
server.child.on('message',()=>{server.observations.length=0;});
try{
 const fetched=JSON.parse(await run(process.execPath,[resolve(import.meta.dirname,'fetch_client.mjs'),stage],JSON.stringify(cases),{...clean,NODE_EXTRA_CA_CERTS:resolve(stage,'private/cert.pem')}));
 server.observations.length=0;
 for(const [i,result] of fetched.entries()){assert.deepEqual(result.body,cases[i].expected);assert.equal(result.status,cases[i].expected.status==='ok'?200:422);records.push({client:'Node fetch 24.21.0',id:result.id,state:'PASS'});}
 for(const item of cases){
  await delay(60);const route=api.routes.find(r=>r.operationId===item.operation);
  let config='url = "https://127.0.0.1:13050'+route.path+'"\nrequest = "'+route.method+'"\nheader = "Authorization: Bearer '+credentials.token+'"\nheader = "Accept-Encoding: identity"\nheader = "Connection: close"\nheader = "X-Request-ID: client-curl-1"\n';
  if(item.input!==null){const body=resolve(stage,'curl-body.json');writeFileSync(body,JSON.stringify(item.input));config+='header = "Content-Type: application/json"\ndata-binary = "@'+body.replaceAll('\\','/')+'"\n';}
  const raw=await run('C:/Windows/System32/curl.exe',['--config','-','--silent','--show-error','--http1.1','--tlsv1.3','--tls-max','1.3','--cacert',resolve(stage,'private/cert.pem'),'--dump-header','-','--max-time','15'],config,clean);
  const result=response(Buffer.from(raw));assert.deepEqual(result.body,item.expected,item.id);assert.equal(result.status,item.expected.status==='ok'?200:422);records.push({client:'Windows curl TLS1.3 HTTP1.1',id:item.id,state:'PASS'});server.observations.length=0;
 }
}finally{await server.stop();}
assert.equal(server.headers.length,24);for(const capture of server.headers){assert.equal(capture.tlsVersion,'TLSv1.3');assert.equal(capture.headers.authorization,'<REDACTED>');assert.equal(capture.headers['accept-encoding'],'identity');assert.ok(capture.headers['x-request-id']);}
const curlVersion=await run('C:/Windows/System32/curl.exe',['--version'],'',clean);
writeFileSync(resolve(root,'.cache/mo1305-resource-review/clients.json'),JSON.stringify({kind:'MemoryOSRESTClientInteroperability',state:'PASS',curlVersion,curlSha256:createHash('sha256').update(readFileSync('C:/Windows/System32/curl.exe')).digest('hex'),headers:server.headers,records,exitCode:server.child.exitCode}));console.log(JSON.stringify({state:'PASS',cases:records.length,clients:['Node built-in fetch','curl']}));
