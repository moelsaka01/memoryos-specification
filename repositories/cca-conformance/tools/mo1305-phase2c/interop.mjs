/** Phase 2C normal-client parity against a fresh authoritative public SDK oracle.
 * No gateway production semantic imports, mocks, worker substitutions, or SDK client API.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {MemoryOS} from '../../../cca-studio/web/js/memoryos-sdk.js';
import {launch,wire,response,request,vectors,delay,api,credentials,root,stage,clean,nodePath,port} from './common.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const b64=bytes=>Buffer.from(bytes).toString('base64');
const decode=text=>Buffer.from(text,'base64');
// Independent implementation of frozen transport J, never semantic canonicalization.
function ordered(value){
  if(Array.isArray(value))return value.map(ordered);
  if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])]));
  return value;
}
const jsonBytes=value=>Buffer.from(JSON.stringify(ordered(value)));
function verifiedProjection(value){
  return Object.fromEntries([['status','ok'],...['artifactKind','artifactVersion','verified','authority','verificationScope','evaluationIdentityDigest','decision','outcomeDigest'].filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]])]);
}
function oracle(operation,input){
  const owner=new MemoryOS();
  try{
    if(operation==='getContractIdentities')return {status:'ok',identities:owner.policyContractIdentities()};
    if(operation==='preparePolicy'||operation==='preparePolicySet'){
      const prepared=operation==='preparePolicy'?owner.preparePolicy(decode(input.policyBase64)):owner.preparePolicySet(decode(input.policySetBase64));
      return {status:'ok',artifactKind:prepared.kind,artifactVersion:prepared.version,canonicalArtifactBase64:b64(prepared.toBytes()),documentDigest:prepared.documentDigest,semanticDigest:prepared.semanticDigest};
    }
    if(operation==='evaluatePolicy'){
      const set=input.artifactKind==='policySet';
      const prepared=set?owner.preparePolicySet(decode(input.artifactBase64)):owner.preparePolicy(decode(input.artifactBase64));
      const investigation=owner.importPackage(decode(input.candidateMipBase64),{identifier:'memoryos-policy-evaluation-candidate'});
      const context=owner.capturePolicyFactContext(investigation);
      const result=set?owner.evaluatePolicySet(prepared,context,{}):owner.evaluatePolicy(prepared,context,{});
      // Verification of independently produced products uses their existing owner.
      owner.verifyEvaluationIdentityArtifact(result.evaluationIdentityBytes(),result.evaluationIdentityDigest);
      owner.verifyPolicyEvaluationOutcomeArtifact(result.canonicalOutcomeBytes(),{expectedEvaluationIdentityDigest:result.evaluationIdentityDigest,expectedOutcomeDigest:result.outcomeDigest});
      return {status:'ok',artifactKind:prepared.kind,semanticDigest:prepared.semanticDigest,decision:result.decision,evaluationIdentityBase64:b64(result.evaluationIdentityBytes()),evaluationIdentityDigest:result.evaluationIdentityDigest,outcomeBase64:b64(result.canonicalOutcomeBytes()),outcomeDigest:result.outcomeDigest};
    }
    if(operation==='verifyEvaluationIdentity')return verifiedProjection(owner.verifyEvaluationIdentityArtifact(decode(input.evaluationIdentityBase64),input.expectedEvaluationIdentityDigest));
    if(operation==='verifyPolicyOutcome')return verifiedProjection(owner.verifyPolicyEvaluationOutcomeArtifact(decode(input.outcomeBase64),{expectedEvaluationIdentityDigest:input.expectedEvaluationIdentityDigest,expectedOutcomeDigest:input.expectedOutcomeDigest}));
    throw Error('UNKNOWN_ORACLE_OPERATION');
  }catch(error){
    assert.equal(operation,'verifyPolicyOutcome','Unexpected independent SDK failure');
    assert.equal(error.code,'VERIFICATION_FAILED');
    return {status:'error',error:{code:'MO1305_SEMANTIC_REJECTED',semantic:{origin:'memoryos',code:error.code,phase:error.phase??null,artifactKind:error.artifactKind??null,limitIdentifier:error.limitIdentifier??null,failureClass:error.failureClass??null,verificationFailure:error.verificationFailure??null}}};
  }
}
function catalog(){
  const inputs=vectors(),cases=[];
  for(const id of ['identities','prepare-policy-pass','prepare-policySet-pass',...['policy','policySet'].flatMap(kind=>['pass','fail','cne'].map(decision=>`evaluate-${kind}-${decision}`)),'verify-identity','bad-outcome-digest']){
    const fixture=inputs.find(item=>item.id===id);assert.ok(fixture,id);
    const expected=oracle(fixture.operation,fixture.input);
    assert.deepEqual(expected,fixture.expected,`Fresh SDK drift: ${id}`);
    cases.push({id,operation:fixture.operation,input:fixture.input,expected});
  }
  // Verify all three actual SDK outcome decisions: verification grants inspection only.
  for(const name of ['pass','fail','cne']){
    const evaluated=cases.find(item=>item.id===`evaluate-policy-${name}`).expected;
    assert.equal(evaluated.decision,{pass:'PASS',fail:'FAIL',cne:'COULD_NOT_EVALUATE'}[name]);
    const input={outcomeBase64:evaluated.outcomeBase64,expectedEvaluationIdentityDigest:evaluated.evaluationIdentityDigest,expectedOutcomeDigest:evaluated.outcomeDigest};
    cases.push({id:`verify-outcome-${name}`,operation:'verifyPolicyOutcome',input,expected:oracle('verifyPolicyOutcome',input)});
  }
  for(const [operation,expected] of [['getHealth',{status:'ok',live:true}],['getReadiness',{status:'ok',ready:true}],['getVersion',Object.fromEntries(Object.entries(api.schemas.$defs.Version.properties).map(([key,value])=>[key,value.const]))]])cases.push({id:operation,operation,input:null,expected});
  assert.deepEqual([...new Set(cases.map(item=>item.operation))].sort(),api.routes.map(route=>route.operationId).sort());
  return cases;
}
function bodyFor(input,normalized){
  if(input===null)return null;
  if(!normalized)return JSON.stringify(input);
  // Decode-equivalent JSON: reversed fields, surrounding whitespace, escaped decoded
  // keys, escaped value characters. Base64 itself stays byte-for-byte identical.
  const escaped=text=>'"'+[...text].map(character=>'\\u'+character.charCodeAt(0).toString(16).padStart(4,'0')).join('')+'"';
  const body=' \n{\n'+Object.entries(input).reverse().map(([key,value])=>`  ${escaped(key)} : ${JSON.stringify(value).replace(/[A-Za-z]/,character=>'\\u'+character.charCodeAt(0).toString(16).padStart(4,'0'))}`).join(',\n')+'\n}\t ';
  assert.deepEqual(JSON.parse(body),input);assert.notEqual(body,JSON.stringify(input));return body;
}
function runClient(executable,args,input,env=clean,timeoutMs=180000){
  return new Promise((resolveResult,reject)=>{
    const child=spawn(executable,args,{cwd:resolve(stage,'empty'),env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),failure=null;
    const timer=setTimeout(()=>{failure=Error('CLIENT_DEADLINE');child.kill();},timeoutMs);
    function capture(which,bytes){
      if(which==='stdout')stdout=Buffer.concat([stdout,bytes]);else stderr=Buffer.concat([stderr,bytes]);
      if(stdout.length>1048576||stderr.length>65536){failure=Error('CLIENT_OUTPUT_BOUND');child.kill();}
    }
    child.stdout.on('data',bytes=>capture('stdout',bytes));child.stderr.on('data',bytes=>capture('stderr',bytes));
    child.stdin.on('error',()=>{});child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{clearTimeout(timer);if(failure)return reject(failure);if(code!==0)return reject(Error(`CLIENT_EXIT_${code}`));resolveResult({stdout,stderr,pid:child.pid,exitCode:code});});
    child.stdin.end(input);
  });
}
function check(item,result,client,body,processId){
  const expectedStatus=item.expected.status==='ok'?200:422;
  assert.equal(result.status,expectedStatus,`${client}: ${item.id}`);
  assert.deepEqual(result.body,item.expected,`${client}: ${item.id}`);
  assert.deepEqual(result.bytes,jsonBytes(item.expected),`Exact transport J: ${client}: ${item.id}`);
  for(const [name,value] of Object.entries(api.headers.response))assert.equal(result.headers[name],value);
  for(const name of ['server','date','transfer-encoding','content-encoding','access-control-allow-origin'])assert.ok(!Object.hasOwn(result.headers,name),name);
  assert.equal(Number(result.headers['content-length']),result.bytes.length);
  const products={};
  for(const key of ['canonicalArtifactBase64','evaluationIdentityBase64','outcomeBase64'])if(Object.hasOwn(item.expected,key)){
    const expected=decode(item.expected[key]);assert.deepEqual(decode(result.body[key]),expected,key);
    products[key.replace('Base64','')]={byteLength:expected.length,sha256:hash(expected)};
  }
  for(const key of ['documentDigest','semanticDigest','evaluationIdentityDigest','outcomeDigest'])if(Object.hasOwn(item.expected,key))products[key]=result.body[key];
  if(item.operation.startsWith('verify')&&expectedStatus===200){assert.equal(result.body.authority,'inspectionOnly');assert.equal(result.body.verificationScope,'serializedArtifact');}
  return {id:`${client}-${item.id}`,category:'client-interoperability',state:'PASS',client,operation:item.operation,httpStatus:result.status,decision:result.body.decision??null,errorCode:result.body.error?.code??null,requestBody:body===null?null:{byteLength:Buffer.byteLength(body),sha256:hash(body)},responseBody:{byteLength:result.bytes.length,sha256:hash(result.bytes)},normativeProducts:products,gatewayProcessId:processId};
}
export async function runInterop(){
  const closureBytes=readFileSync(resolve(root,'repositories/memoryos-rest/runtime/runtime-closure-manifest.json'));
  const closure=JSON.parse(closureBytes);
  assert.equal(closure.files.length,25);
  for(const row of closure.files){const bytes=readFileSync(resolve(root,row.source));assert.equal(bytes.length,row.byteLength);assert.equal(hash(bytes),row.sha256);}
  const cases=catalog(),records=[],curlPath=resolve(process.env.SystemRoot??'C:/Windows','System32/curl.exe');
  const curlVersion=await runClient(curlPath,['--disable','--version'],'');
  const server=await launch();
  let exit;
  try{
    // Ordinary raw client baseline uses the unchanged installed entry and worker.
    for(const item of cases){
      await delay(60);const body=bodyFor(item.input,false);
      const result=response(await wire(request(item.operation,body,{headers:{'X-Request-ID':`interop-raw-${records.length}`}}),{timeout:45000}));
      records.push(check(item,result,'raw-tls',body,server.child.pid));
    }
    const payload=cases.map(item=>{const route=api.routes.find(route=>route.operationId===item.operation);return {id:item.id,path:route.path,method:route.method,body:bodyFor(item.input,true)};});
    const fetched=await runClient(nodePath,[resolve(import.meta.dirname,'fetch-client.mjs'),stage,String(port)],JSON.stringify(payload),{...clean,NODE_EXTRA_CA_CERTS:resolve(stage,'private/cert.pem')});
    assert.equal(fetched.stderr.toString(),'');const fetchedResults=JSON.parse(fetched.stdout);assert.equal(fetchedResults.length,cases.length);
    for(const [index,actual] of fetchedResults.entries()){
      assert.equal(actual.id,cases[index].id);const bytes=decode(actual.bodyBase64);
      records.push(check(cases[index],{status:actual.status,headers:actual.headers,bytes,body:JSON.parse(bytes)},'node-fetch',payload[index].body,server.child.pid));
    }
    for(const [index,item] of cases.entries()){
      await delay(60);const route=api.routes.find(route=>route.operationId===item.operation),body=bodyFor(item.input,true);
      let config=`url = "https://127.0.0.1:${port}${route.path}"\nrequest = "${route.method}"\nheader = "Authorization: Bearer ${credentials.token}"\nheader = "Accept-Encoding: identity"\nheader = "Connection: close"\nheader = "X-Request-ID: interop-curl-${index}"\n`;
      if(body!==null){const path=resolve(stage,'curl-interop-body.json');writeFileSync(path,body);config+=`header = "Content-Type: Application/JSON; charset=UTF-8"\ndata-binary = "@${path.replaceAll('\\','/')}"\n`;}
      const received=await runClient(curlPath,['--disable','--config','-','--silent','--show-error','--http1.1','--tlsv1.3','--tls-max','1.3','--cacert',resolve(stage,'private/cert.pem'),'--dump-header','-','--max-time','45','--write-out','%{stderr}HTTP_VERSION=%{http_version}\nSSL_VERIFY_RESULT=%{ssl_verify_result}\n'],config,clean,50000);
      assert.equal(received.stderr.toString().replaceAll('\r\n','\n'),'HTTP_VERSION=1.1\nSSL_VERIFY_RESULT=0\n');
      records.push(check(item,response(received.stdout),'curl',body,server.child.pid));
    }
  }finally{exit=await server.stop();}
  assert.equal(server.stdout,'');assert.ok(!server.stderr.includes(credentials.token));
  for(const item of cases)for(const value of Object.values(item.expected))if(typeof value==='string'&&value.length>128)assert.ok(!server.stderr.includes(value),'Normative artifact log leakage');
  const perClient=Object.fromEntries(['raw-tls','node-fetch','curl'].map(client=>[client,records.filter(record=>record.client===client).length]));
  return {records,limitations:['Local IPv4 loopback interoperability; remote deployment and lifecycle integration remain Phase 2A/2D responsibilities.','Node fetch has no stable public negotiated-TLS inspection API; successful handshake is against the unchanged TLS-1.3-only gateway.','No statistical timing or OS-level network denial claim.'],provenance:{gateway:{entry:'package/bin/memoryos-rest.mjs',processId:server.child.pid,exitCode:server.child.exitCode,productionWorker:true,workerSubstitution:false},oracle:{source:'repositories/cca-studio/web/js/memoryos-sdk.js',sdkVersion:'1.1.0',closureFilesChecked:closure.files.length,closureManifestSha256:hash(closureBytes),freshlyComputed:true,restAsOracle:false,retainedFixtureExpectedUsedOnlyForDriftCheck:true},clients:{node:{version:process.versions.node,sha256:hash(readFileSync(nodePath))},curl:{version:curlVersion.stdout.toString().split(/\r?\n/)[0],sha256:hash(readFileSync(curlPath)),certificateVerification:true,httpVersion:'1.1',tlsMinimum:'1.3',tlsMaximum:'1.3'}},perClient,closedOperations:api.routes.map(route=>route.operationId).sort(),transportNormalization:['reversed object keys','JSON whitespace','escaped decoded keys and value characters','Content-Type case and quoted charset'],gatewayDiagnostics:{byteLength:Buffer.byteLength(server.stderr),sha256:hash(server.stderr)},exit}};
}
