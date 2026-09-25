/**
 * Bounded C3/C3B installed refresh; no production imports or resource campaign.
 * SDK projection adapted from historical Phase 3A clients.mjs at
 * 9bb679532b90016b9cc30bf5e1cdb41d376e2ff7. Common harness is byte-exact.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync,cpSync,appendFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {networkInterfaces} from 'node:os';
import {spawn} from 'node:child_process';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import {createContext,canonical,identity,sha,delay,bounded} from './common.mjs';

const [packagePath,configPath,fixturePath,oraclePath,outputDir,curlPath,remoteAddress='',...flags]=process.argv.slice(2);
const selected=flags.find(x=>x.startsWith('--group='))?.slice(8)??null;
const groupNames=['semantic','clients','security','limits','lifecycle','startup','remote'];
assert.ok(flags.length<=1&&flags.every(x=>x.startsWith('--group=')),'ARGUMENTS');
assert.ok(selected===null||groupNames.includes(selected),'GROUP');
const ctx=createContext({packagePath,configPath,fixturePath,oraclePath,outputDir,curlPath});
const output=resolve(outputDir,'probe.json');
const result={
  kind:'MemoryOSRESTPhase3ARefreshProbe',version:'1.0.0',state:'RUNNING',selectedGroup:selected,
  timestampDomain:'MONOTONIC_PROCESS_HRTIME',records:[],groups:[],processes:ctx.processes,
  harness:{historicalCommit:'9bb679532b90016b9cc30bf5e1cdb41d376e2ff7',
    common:identity(readFileSync(resolve(import.meta.dirname,'common.mjs'))),
    oracleProjectionSource:'repositories/cca-conformance/tools/mo1305-phase3a/clients.mjs',
    projectionAdaptation:'Same SDK projection; bounded fixture selection and no historical client matrix.',
    probe:identity(readFileSync(import.meta.filename)),
    fetchHelper:identity(readFileSync(resolve(import.meta.dirname,'bounded-fetch-client.mjs')))},
  limitations:[
    'Bounded refresh reuses unchanged historical resource, full client, and exhaustive security evidence.',
    'No new live 31400 ms semantic deadline or 60000 ms ceiling campaign is claimed.',
    'Remote evidence covers the assigned same-host RFC1918 listener only; no off-host reachability claim.',
    'Filesystem and URL checks cover supplied authority fields and calibrated target, not OS-wide access denial.',
    'Node fetch uses the listener independently observed as TLS 1.3 and HTTP/1.1 by raw TLS.']};
const persist=()=>writeFileSync(output,canonical(result));
const stamp=()=>({utcMs:Date.now(),monotonicNs:process.hrtime.bigint().toString()});
let current='preflight',currentGroup='preflight',oracle,cases;
async function record(id,category,work){
  current=id;const row={id,group:currentGroup,category,state:'RUNNING',start:stamp()};
  result.records.push(row);persist();
  try{Object.assign(row,await work(),{state:'PASS'});}
  catch(error){row.state='FAIL';row.failure={type:error.name,code:error.code??'ASSERTION',messageSha256:sha(String(error.message))};throw error;}
  finally{row.end=stamp();persist();}
  return row;
}
async function listenerAbsent(){
  const socket=net.connect({host:ctx.host,port:ctx.port});let connected=false,errorCode=null;
  socket.on('error',error=>{errorCode=error.code;});const closed=new Promise(done=>socket.once('close',done));
  socket.once('connect',()=>{connected=true;socket.destroy();});
  try{await bounded(closed,2500,'LISTENER_CLEANUP_TIMEOUT');}finally{socket.destroy();}
  assert.equal(connected,false,'LISTENER_REMAINED');assert.equal(errorCode,'ECONNREFUSED');
}
async function stopAndCheck(){
  if(!ctx.active||ctx.active.closed)return null;
  const receipt=await ctx.stop();assert.equal(receipt.exitCode,0);
  assert.equal(receipt.startupObserved,true);assert.equal(receipt.shutdownObserved,true);
  await listenerAbsent();return receipt;
}
async function group(name,running,work){
  if(selected&&selected!==name)return;
  currentGroup=name;current=name+'-startup';
  const row={id:name,state:'RUNNING',start:stamp(),caseIds:[]};result.groups.push(row);persist();
  try{if(running)await ctx.start();await work();row.state='PASS';}
  catch(error){row.state='FAIL';throw error;}
  finally{
    try{if(ctx.active&&!ctx.active.closed)await stopAndCheck();}
    catch(error){row.state='FAIL';throw error;}
    finally{row.end=stamp();row.caseIds=result.records.filter(x=>x.group===name).map(x=>x.id);persist();}
  }
}
const decode=text=>Buffer.from(text,'base64'),base64=bytes=>Buffer.from(bytes).toString('base64');
function verificationProjection(value){
  return Object.fromEntries([['status','ok'],...['artifactKind','artifactVersion','verified','authority','verificationScope',
    'evaluationIdentityDigest','decision','outcomeDigest'].filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]])]);
}
function makeOracle(sdk){
  return(operation,input)=>{
    const owner=new sdk.MemoryOS();
    try{
      if(operation==='getContractIdentities')return{status:'ok',identities:owner.policyContractIdentities()};
      if(operation==='preparePolicy'||operation==='preparePolicySet'){
        const prepared=operation==='preparePolicy'?owner.preparePolicy(decode(input.policyBase64)):owner.preparePolicySet(decode(input.policySetBase64));
        return{status:'ok',artifactKind:prepared.kind,artifactVersion:prepared.version,canonicalArtifactBase64:base64(prepared.toBytes()),
          documentDigest:prepared.documentDigest,semanticDigest:prepared.semanticDigest};
      }
      if(operation==='evaluatePolicy'){
        const isSet=input.artifactKind==='policySet';
        const prepared=isSet?owner.preparePolicySet(decode(input.artifactBase64)):owner.preparePolicy(decode(input.artifactBase64));
        const investigation=owner.importPackage(decode(input.candidateMipBase64),{identifier:'memoryos-policy-evaluation-candidate'});
        const context=owner.capturePolicyFactContext(investigation);
        const value=isSet?owner.evaluatePolicySet(prepared,context,{}):owner.evaluatePolicy(prepared,context,{});
        owner.verifyEvaluationIdentityArtifact(value.evaluationIdentityBytes(),value.evaluationIdentityDigest);
        owner.verifyPolicyEvaluationOutcomeArtifact(value.canonicalOutcomeBytes(),{
          expectedEvaluationIdentityDigest:value.evaluationIdentityDigest,expectedOutcomeDigest:value.outcomeDigest});
        return{status:'ok',artifactKind:prepared.kind,semanticDigest:prepared.semanticDigest,decision:value.decision,
          evaluationIdentityBase64:base64(value.evaluationIdentityBytes()),evaluationIdentityDigest:value.evaluationIdentityDigest,
          outcomeBase64:base64(value.canonicalOutcomeBytes()),outcomeDigest:value.outcomeDigest};
      }
      if(operation==='verifyEvaluationIdentity')return verificationProjection(owner.verifyEvaluationIdentityArtifact(
        decode(input.evaluationIdentityBase64),input.expectedEvaluationIdentityDigest));
      if(operation==='verifyPolicyOutcome')return verificationProjection(owner.verifyPolicyEvaluationOutcomeArtifact(
        decode(input.outcomeBase64),{expectedEvaluationIdentityDigest:input.expectedEvaluationIdentityDigest,expectedOutcomeDigest:input.expectedOutcomeDigest}));
      throw Error('UNKNOWN_ORACLE_OPERATION');
    }catch(error){
      assert.ok(['verifyEvaluationIdentity','verifyPolicyOutcome'].includes(operation),'UNEXPECTED_SDK_FAILURE');
      assert.ok(error instanceof sdk.MemoryOSPolicyOperationalError);assert.equal(error.code,'VERIFICATION_FAILED');
      assert.equal(error.failureClass,'operational');assert.equal(error.verificationFailure,true);
      return{status:'error',error:{code:'MO1305_SEMANTIC_REJECTED',semantic:{origin:'memoryos',code:error.code,
        phase:error.phase??null,artifactKind:error.artifactKind??null,limitIdentifier:error.limitIdentifier??null,
        failureClass:error.failureClass??null,verificationFailure:error.verificationFailure??null}}};
    }
  };
}
async function prepareOracle(){
  const packageRoot=realpathSync(packagePath),oracleRoot=realpathSync(oraclePath),difference=relative(packageRoot,oracleRoot);
  assert.ok(difference&&(difference.startsWith('..')||isAbsolute(difference)),'INDEPENDENT_ORACLE');
  const closureBytes=readFileSync(resolve(packageRoot,'runtime/runtime-closure-manifest.json')),closure=JSON.parse(closureBytes);
  assert.equal(closure.files.length,25);const files=[];
  for(const row of closure.files){
    assert.ok(row.path.startsWith('authoritative/')&&!row.path.split('/').includes('..'));
    const target=resolve(oracleRoot,row.path);assert.equal(lstatSync(target).isSymbolicLink(),false);
    const observed=identity(readFileSync(target));assert.deepEqual(observed,{byteLength:row.byteLength,sha256:row.sha256});
    files.push({path:row.path,source:row.source,...observed});
  }
  const sdk=await import(pathToFileURL(resolve(oracleRoot,'authoritative/web/js/memoryos-sdk.js')).href);
  assert.equal(sdk.MEMORYOS_SDK_VERSION,'1.1.0');oracle=makeOracle(sdk);
  result.oracle={source:'independent authoritative/web/js/memoryos-sdk.js',sdkVersion:sdk.MEMORYOS_SDK_VERSION,
    closureFileCount:files.length,closureManifest:identity(closureBytes),files,freshlyComputed:true,ownerPerOperation:true,
    restAsOracle:false,retainedFixtureExpectedUsedOnlyForDriftCheck:true};
  const indexBytes=readFileSync(resolve(fixturePath,'index.json')),index=JSON.parse(indexBytes);
  const indexed=new Map(index.files.map(row=>[row.path,row]));cases=new Map();
  for(const name of ['identities','prepare-policy-pass','prepare-policySet-pass','evaluate-policy-pass','evaluate-policy-fail',
    'evaluate-policy-cne','evaluate-policySet-pass','verify-identity','verify-outcome']){
    const member=name+'.json',bytes=readFileSync(resolve(fixturePath,member)),row=indexed.get(member);assert.ok(row,'INDEXED_FIXTURE');
    assert.deepEqual(identity(bytes),{byteLength:row.byteLength,sha256:row.sha256});
    const item=JSON.parse(bytes);assert.equal(item.id,name);const expected=oracle(item.operation,item.input);
    assert.deepEqual(expected,item.expected,'ORACLE_FIXTURE_DRIFT:'+name);
    cases.set(name,{...item,expected,fixture:{path:member,...identity(bytes)}});
  }
  result.fixtureIndex=identity(indexBytes);
  result.limits={identity:identity(readFileSync(resolve(packagePath,'contracts/limits.json'))),
    state:ctx.limits.state,operationMs:ctx.limits.measured.operationMs,absoluteCeilingMs:60000,liveDeadlineCampaignRepeated:false};
  assert.equal(result.limits.state,'FINAL');assert.equal(result.limits.operationMs,31400);
  assert.ok(result.limits.operationMs<=result.limits.absoluteCeilingMs);
  assert.equal(ctx.limits.fixed.semanticWorkers,1);assert.equal(ctx.limits.fixed.semanticQueue,0);
}
function checkResponse(response,expected,{requestId=null,raw=false}={}){
  assert.equal(response.status,expected.status==='ok'?200:422);assert.deepEqual(response.json,expected,'SDK_PARITY');
  assert.deepEqual(response.body,canonical(expected),'EXACT_CANONICAL_TRANSPORT');
  for(const[key,value]of Object.entries(ctx.api.headers.response))assert.equal(response.headers[key],value);
  for(const key of ['date','server','transfer-encoding','content-encoding','access-control-allow-origin'])
    assert.ok(!Object.hasOwn(response.headers,key),'FORBIDDEN_HEADER');
  assert.equal(Number(response.headers['content-length']),response.body.length);
  if(requestId)assert.equal(response.headers['x-request-id'],requestId);
  if(raw){assert.equal(response.tlsVersion,'TLSv1.3');assert.equal(response.alpn,'http/1.1');assert.equal(response.authorized,true);}
  const products={};
  for(const key of ['canonicalArtifactBase64','evaluationIdentityBase64','outcomeBase64'])
    if(Object.hasOwn(expected,key)){assert.deepEqual(decode(response.json[key]),decode(expected[key]));products[key.replace('Base64','')]=identity(decode(expected[key]));}
  for(const key of ['documentDigest','semanticDigest','evaluationIdentityDigest','outcomeDigest'])
    if(Object.hasOwn(expected,key))products[key]=expected[key];
  if(expected.verified){assert.equal(expected.authority,'inspectionOnly');assert.equal(expected.verificationScope,'serializedArtifact');}
  return{httpStatus:response.status,responseBody:identity(response.body),expectedBody:identity(canonical(expected)),
    exactCanonicalResponse:true,decision:expected.decision??null,normativeProducts:products,
    ...(raw?{transport:{tlsVersion:response.tlsVersion,alpn:response.alpn,certificateAuthorized:true}}:{})};
}
async function semanticCase(name,prefix='raw'){
  const item=cases.get(name),route=ctx.api.routes.find(row=>row.operationId===item.operation);
  return record(prefix+'-'+name,'semantic-parity',async()=>{
    await delay(70);const requestId='phase3ar-'+name;
    const response=await ctx.request(route.method,route.path,item.input,{headers:{'X-Request-ID':requestId}});
    return{operation:item.operation,artifactKind:item.input?.artifactKind??response.json.artifactKind??null,fixture:item.fixture,
      independentSdkParity:true,requestId,...checkResponse(response,item.expected,{requestId,raw:true})};
  });
}
async function wireCase(id,category,wire,status,code=null,options={}){
  return record(id,category,async()=>{
    await delay(70);const response=await ctx.raw(wire,{timeoutMs:12000,...options});
    assert.equal(response.status,status,id);assert.equal(response.tlsVersion,'TLSv1.3');assert.equal(response.authorized,true);
    if(code)assert.deepEqual(response.json,{status:'error',error:{code:'MO1305_'+code,semantic:null}});
    if(status===401){assert.equal(response.headers['www-authenticate'],'Bearer realm="memoryos-rest"');assert.equal(response.headers['x-request-id'],undefined);}
    return{httpStatus:response.status,code:response.json?.error?.code??null,responseBody:identity(response.body),
      tlsVersion:response.tlsVersion,alpn:response.alpn,certificateAuthorized:response.authorized};
  });
}
async function runChild(executable,args,input,env,cwd,timeoutMs=55000){
  return new Promise((done,fail)=>{
    const child=spawn(executable,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),failure=null;
    const timer=setTimeout(()=>{failure=Error('CLIENT_DEADLINE');child.kill();},timeoutMs);
    for(const[name,stream]of[['stdout',child.stdout],['stderr',child.stderr]])stream.on('data',bytes=>{
      if(name==='stdout')stdout=Buffer.concat([stdout,bytes]);else stderr=Buffer.concat([stderr,bytes]);
      if(stdout.length>262144||stderr.length>65536){failure=Error('CLIENT_OUTPUT_BOUND');child.kill();}
    });
    child.stdin.on('error',()=>{});
    child.once('error',()=>{clearTimeout(timer);fail(Error('CLIENT_SPAWN_FAILED'));});
    child.once('close',(exitCode,signal)=>{
      clearTimeout(timer);const processRecord={pid:child.pid,exitCode,signal,stdout:identity(stdout),stderr:identity(stderr)};
      if(failure||exitCode!==0||signal!==null){const error=failure??Error('CLIENT_NONZERO_EXIT');error.clientProcess=processRecord;fail(error);}
      else done({stdout,stderr,process:processRecord});
    });
    child.stdin.end(input);
  });
}
function parseHttp(bytes){
  const split=bytes.indexOf('\r\n\r\n');assert.ok(split>0);const lines=bytes.subarray(0,split).toString('ascii').split('\r\n');
  const first=lines.shift();assert.match(first,/^HTTP\/1\.1 [0-9]{3} /u);const headers={};
  for(const line of lines){const colon=line.indexOf(':');assert.ok(colon>0);const name=line.slice(0,colon).toLowerCase();
    assert.ok(!Object.hasOwn(headers,name));headers[name]=line.slice(colon+1).trim();}
  const body=bytes.subarray(split+4);assert.ok(body.length<=65536);
  return{status:Number(first.split(' ')[1]),headers,body,json:JSON.parse(body)};
}
async function refused(id,overrides,category='startup-security'){
  return record(id,category,async()=>{
    const state=await ctx.start({...overrides,expectStartup:false,expectedExitCode:2});
    try{
      assert.deepEqual(await bounded(state.exit,12000,'EXPECTED_REFUSAL_TIMEOUT'),{code:2,signal:null});
      assert.deepEqual(JSON.parse(state.stderr),{code:'MO1305_UNAVAILABLE',event:'fatal',operationId:null,requestId:null});
      const receipt=await ctx.stop(state,{expectedCode:2});assert.equal(receipt.startupObserved,false);
      return{exitCode:2,startupObserved:false,secretFreeLogs:true,diagnostic:receipt.stderr};
    }finally{if(!state.closed){state.child.kill();await bounded(state.exit,5000,'REFUSAL_REAP_TIMEOUT');}}
  });
}
async function run(){
  await record('independent-oracle-and-final-limits','preflight',prepareOracle);
  await group('semantic',true,async()=>{
    for(const[name,path,expected]of[
      ['health','/v1/health',{status:'ok',live:true}],['readiness','/v1/readiness',{status:'ok',ready:true}],
      ['version','/v1/version',Object.fromEntries(Object.entries(ctx.api.schemas.$defs.Version.properties).map(([key,value])=>[key,value.const]))]
    ])await record(name,'loopback-metadata',async()=>{
      await delay(70);return checkResponse(await ctx.request('GET',path),expected,{raw:true});
    });
    for(const name of cases.keys())await semanticCase(name);
    const operations=[...new Set([...cases.values()].map(row=>row.operation))].sort();assert.equal(operations.length,6);
    const decisions=['pass','fail','cne'].map(name=>cases.get('evaluate-policy-'+name).expected.decision).sort();
    assert.deepEqual(decisions,['COULD_NOT_EVALUATE','FAIL','PASS']);
    result.semantic={state:'PASS',capabilities:operations,decisions,fixtureCount:cases.size,independentSdkParity:true};
  });
  await group('clients',true,async()=>{
    const clean=Object.fromEntries(Object.entries(ctx.env).filter(([name])=>/^(SYSTEMROOT|WINDIR|TEMP|TMP)$/iu.test(name)));
    const cwd=resolve(outputDir,'client-cwd');mkdirSync(cwd,{recursive:true});
    await record('node-fetch-bounded','clients',async()=>{
      const chosen=['identities','evaluate-policy-pass'].map(name=>cases.get(name));
      const payload=chosen.map((item,index)=>{
        const route=ctx.api.routes.find(row=>row.operationId===item.operation);
        return{id:item.id,method:route.method,path:route.path,body:item.input===null?null:JSON.stringify(item.input),requestId:'phase3ar-fetch-'+index};
      });
      const child=await runChild(process.execPath,[resolve(import.meta.dirname,'bounded-fetch-client.mjs')],
        JSON.stringify({host:ctx.host,port:ctx.port,token:ctx.token,cases:payload}),
        {...clean,NODE_EXTRA_CA_CERTS:ctx.config.certificateFile},cwd,95000);
      assert.equal(child.stderr.length,0);const responses=JSON.parse(child.stdout);assert.equal(responses.length,chosen.length);
      const checks=responses.map((response,index)=>{
        assert.equal(response.id,chosen[index].id);const body=decode(response.bodyBase64);
        return{caseId:response.id,operation:chosen[index].operation,independentSdkParity:true,
          ...checkResponse({...response,body,json:JSON.parse(body)},chosen[index].expected,{requestId:payload[index].requestId})};
      });
      return{client:'node-fetch',process:child.process,checks,certificateVerification:true,customCaConfiguredAtProcessStartup:true};
    });
    await record('curl-bounded','clients',async()=>{
      const version=await runChild(curlPath,['--disable','--version'],'',clean,cwd,10000);
      const item=cases.get('prepare-policySet-pass'),route=ctx.api.routes.find(row=>row.operationId===item.operation);
      const quote=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
      const bodyFile=resolve(outputDir,'curl-request.json');writeFileSync(bodyFile,canonical(item.input));
      const requestId='phase3ar-curl-prepare';
      const config='url = '+quote('https://'+ctx.host+':'+ctx.port+route.path)+'\n'+
        'request = "POST"\nheader = '+quote('Authorization: Bearer '+ctx.token)+'\n'+
        'header = "Accept-Encoding: identity"\nheader = "Connection: close"\n'+
        'header = "Content-Type: application/json"\nheader = '+quote('X-Request-ID: '+requestId)+'\n'+
        'data-binary = '+quote('@'+bodyFile.replaceAll('\\','/'))+'\n';
      const child=await runChild(curlPath,['--disable','--config','-','--silent','--show-error','--noproxy','*',
        '--http1.1','--tlsv1.3','--tls-max','1.3','--cacert',ctx.config.certificateFile,'--dump-header','-',
        '--max-time','45','--write-out','%{stderr}HTTP_VERSION=%{http_version}\nSSL_VERIFY_RESULT=%{ssl_verify_result}\n'],
        config,clean,cwd);
      assert.equal(child.stderr.toString().replaceAll('\r\n','\n'),'HTTP_VERSION=1.1\nSSL_VERIFY_RESULT=0\n');
      return{client:'curl',caseId:item.id,operation:item.operation,version:version.stdout.toString().split(/\r?\n/u)[0],
        executable:identity(readFileSync(curlPath)),process:child.process,independentSdkParity:true,
        transport:{httpVersion:'1.1',minimumTls:'1.3',maximumTls:'1.3',sslVerifyResult:0},
        ...checkResponse(parseHttp(child.stdout),item.expected,{requestId})};
    });
    assert.deepEqual(readdirSync(cwd),[],'CLIENT_PERSISTENCE');
  });
  await group('security',true,async()=>{
    const wrong=(ctx.token[0]==='0'?'1':'0')+ctx.token.slice(1);
    for(const[id,headers,status,code]of[
      ['auth-missing',{Authorization:null},401,'UNAUTHENTICATED'],
      ['auth-wrong',{Authorization:'Bearer '+wrong},401,'UNAUTHENTICATED'],
      ['missing-host',{Host:null},403,'FORBIDDEN'],
      ['missing-host-missing-auth',{Host:null,Authorization:null},401,'UNAUTHENTICATED'],
      ['bad-host-invalid-auth',{Host:'attacker.invalid',Authorization:'Bearer '+wrong,'X-Request-ID':'must_not_echo'},401,'UNAUTHENTICATED'],
      ['host-alias',{Host:'localhost:'+ctx.port},403,'FORBIDDEN']
    ])await wireCase(id,'authentication-host',ctx.wire('GET','/v1/health',null,{headers}),status,code);
    await record('tls12-refused','tls',async()=>{
      await delay(70);const response=await ctx.raw(ctx.wire('GET','/v1/health'),{
        tlsOptions:{minVersion:'TLSv1.2',maxVersion:'TLSv1.2'},allowFailure:true,timeoutMs:12000});
      assert.equal(response.secure,false);assert.equal(response.status,null);assert.equal(response.body.length,0);assert.ok(response.errorCode);
      return{secureConnection:false,httpBytes:0,errorCode:response.errorCode};
    });
    const privateDir=resolve(outputDir,'authority');mkdirSync(privateDir,{recursive:true});
    const policyFile=resolve(privateDir,'inline-policy.json'),markerFile=resolve(privateDir,'must-not-exist.txt');
    const policy=cases.get('prepare-policy-pass');writeFileSync(policyFile,decode(policy.input.policyBase64));
    const before=identity(readFileSync(policyFile));
    for(const[id,extra]of[['filesystem-field',{policyPath:policyFile}],['command-field',{command:'echo unexpected > '+markerFile}]])
      await wireCase(id,'authority',ctx.wire('POST','/v1/policies/prepare',{...policy.input,...extra}),400,'REQUEST_SCHEMA');
    async function opaque(id,value){
      return record(id,'authority',async()=>{
        await delay(70);const response=await ctx.request('POST','/v1/policies/prepare',{policyBase64:base64(value)});
        assert.equal(response.status,422);assert.equal(response.json.error.code,'MO1305_SEMANTIC_REJECTED');
        assert.ok(response.json.error.semantic);assert.equal(response.body.includes(value),false);
        return{httpStatus:422,code:response.json.error.code,responseBody:identity(response.body),inputHandledAsInlineArtifact:true};
      });
    }
    await opaque('opaque-filesystem-path',policyFile);
    await opaque('opaque-file-uri',pathToFileURL(policyFile).href);
    await record('calibrated-url-no-acquisition','authority',async()=>{
      let hits=0,connections=0;
      const sentinel=http.createServer((_request,response)=>{
        hits++;response.writeHead(200,{'Content-Type':'application/json',Connection:'close'});response.end(readFileSync(policyFile));
      });
      sentinel.on('connection',()=>connections++);
      await bounded(new Promise((done,fail)=>{sentinel.once('error',fail);sentinel.listen(0,'127.0.0.1',done);}),5000,'SENTINEL_STARTUP');
      try{
        const url='http://127.0.0.1:'+sentinel.address().port+'/inline-policy.json';
        await bounded(new Promise((done,fail)=>{
          http.get(url,response=>{response.resume();response.once('end',done);}).once('error',fail);
        }),5000,'SENTINEL_CALIBRATION');
        assert.equal(hits,1);assert.equal(connections,1);hits=0;connections=0;
        await wireCase('url-field-no-fetch','authority',ctx.wire('POST','/v1/policies/prepare',{...policy.input,url}),400,'REQUEST_SCHEMA');
        await opaque('opaque-url-no-fetch',url);await semanticCase('prepare-policy-pass','sentinel');
        await delay(150);assert.equal(hits,0);assert.equal(connections,0);
        assert.deepEqual(identity(readFileSync(policyFile)),before);assert.equal(existsSync(markerFile),false);
        return{positiveCalibration:{requests:1,connections:1},attackRequests:hits,attackConnections:connections,
          fileUnchanged:before,commandMarkerCreated:false};
      }finally{sentinel.closeAllConnections();await bounded(new Promise(done=>sentinel.close(done)),5000,'SENTINEL_CLEANUP');}
    });
    const marker='MO1305_PHASE3AR_PRIVATE_INPUT';
    await wireCase('private-input-rejected','diagnostics',ctx.wire('POST','/v1/policies/prepare',{unknown:marker}),400,'REQUEST_SCHEMA');
    await record('secret-safe-diagnostics','diagnostics',async()=>{
      const state=ctx.active,receipt=await stopAndCheck();
      for(const value of [marker,policy.input.policyBase64,policy.expected.canonicalArtifactBase64,policyFile,'must_not_echo'])
        assert.equal(state.stderr.includes(value),false,'PRIVATE_LOG_INPUT_LEAK');
      return{process:receipt,rawLogsPersisted:false,secretFreeLogs:true};
    });
  });
  await group('limits',true,async()=>{
    const policy=cases.get('prepare-policy-pass'),base=JSON.stringify(policy.input);
    const limit=ctx.limits.measured.operations.preparePolicy.requestBytes;
    for(const bytes of [limit,limit+1]){
      const body=base+' '.repeat(bytes-Buffer.byteLength(base));
      await wireCase('body-prepare-'+bytes,'limits',ctx.wire('POST','/v1/policies/prepare',body),
        bytes===limit?200:413,bytes===limit?null:'INPUT_LIMIT');
    }
    const headers=['Host: '+ctx.host+':'+ctx.port,'Authorization: Bearer '+ctx.token];
    const wire=values=>Buffer.from('GET /v1/health HTTP/1.1\r\n'+values.join('\r\n')+'\r\n\r\n');
    await wireCase('header-count-33','limits',wire([...headers,...Array.from({length:31},(_,i)=>'X-Limit-'+i+': a')]),431,'HEADER_LIMIT');
    await wireCase('header-value-1025','limits',wire([...headers,'X-Limit: '+'a'.repeat(1025)]),431,'HEADER_LIMIT');
    await wireCase('target-257','limits',ctx.wire('GET','/'+'a'.repeat(256)),414,'TARGET_LIMIT');
  });
  await group('lifecycle',true,async()=>{
    await record('shutdown-partial-socket-and-rebind','lifecycle',async()=>{
      const socket=tls.connect({host:ctx.host,port:ctx.port,ca:ctx.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
        ALPNProtocols:['http/1.1'],rejectUnauthorized:true});
      let bytes=0,socketError=null;
      socket.on('error',error=>{socketError=error.code;});
      socket.on('data',part=>{bytes+=part.length;if(bytes>4096)socket.destroy();});
      const closed=new Promise(done=>socket.once('close',done));
      try{
        await bounded(new Promise((done,fail)=>{
          socket.once('secureConnect',done);socket.once('error',()=>fail(Error('LIFECYCLE_TLS_CONNECT')));
        }),5000,'LIFECYCLE_CONNECT');
        socket.write('GET /v1/health HTTP/1.1\r\n');await delay(75);
        const started=process.hrtime.bigint(),receipt=await stopAndCheck();
        const shutdownMs=Number(process.hrtime.bigint()-started)/1e6;
        await bounded(closed,2500,'SHUTDOWN_SOCKET_LEAK');assert.equal(bytes,0);
        assert.ok(shutdownMs<ctx.limits.fixed.shutdownMs);
        await ctx.start();const ready=await ctx.request('GET','/v1/readiness');
        assert.equal(ready.status,200);assert.deepEqual(ready.json,{status:'ok',ready:true});
        return{shutdownMs:Math.ceil(shutdownMs),shutdownLimitMs:ctx.limits.fixed.shutdownMs,process:receipt,
          listenerAbsent:true,socketClosed:true,unpublishedResponseBytes:bytes,socketError,
          immediateRebind:true,rebindReadiness:200};
      }finally{socket.destroy();await bounded(closed,2500,'LIFECYCLE_CLIENT_REAP');}
    });
  });
  await group('startup',false,async()=>{
    await refused('remote-without-opt-in',{config:{...ctx.config,mode:'local',bindAddress:remoteAddress||'192.168.1.1'}},'remote-opt-in');
    await refused('remote-wildcard-refused',{config:{...ctx.config,mode:'remote',bindAddress:'0.0.0.0'}},'remote-opt-in');
    await refused('remote-public-refused',{config:{...ctx.config,mode:'remote',bindAddress:'8.8.8.8'}},'remote-opt-in');
    for(const[id,environment]of[
      ['node-options',{NODE_OPTIONS:'--no-warnings'}],['node-path',{NODE_PATH:outputDir}],['http-proxy',{HTTP_PROXY:'http://127.0.0.1:1'}]
    ])await refused('environment-'+id,{environment},'environment');
    await refused('runtime-inspect-argument',{args:['--inspect-port=0',resolve(packagePath,'bin/memoryos-rest.mjs'),'--config',configPath]},'environment');
    const altered=resolve(outputDir,'changed-closure-package');
    cpSync(packagePath,altered,{recursive:true});appendFileSync(resolve(altered,'runtime/authoritative/web/js/memoryos-sdk.js'),'\n');
    await refused('runtime-closure-substitution',{packagePath:altered},'runtime-integrity');
    await record('post-refusal-recovery','startup-readiness',async()=>{
      await ctx.start();const response=await ctx.request('GET','/v1/health');
      return{isolatedAlteredCopy:true,originalInstallationModified:false,...checkResponse(response,{status:'ok',live:true},{raw:true})};
    });
  });
  await group('remote',false,async()=>{
    if(!remoteAddress){
      result.remote={state:'NOT_AVAILABLE',reason:'No eligible assigned RFC1918 IPv4 address supplied by host inventory.'};return;
    }
    assert.match(remoteAddress,/^(?:10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)/u);
    const assigned=Object.values(networkInterfaces()).flat().find(row=>row.family==='IPv4'&&!row.internal&&row.address===remoteAddress);
    assert.ok(assigned?.cidr,'ASSIGNED_REMOTE_ADDRESS_REQUIRED');ctx.host=remoteAddress;
    await record('remote-explicit-opt-in-start','remote',async()=>{
      await ctx.start({config:{...ctx.config,mode:'remote',bindAddress:remoteAddress}});
      const response=await ctx.request('GET','/v1/readiness');
      return{address:remoteAddress,sameHost:true,explicitOptIn:true,...checkResponse(response,{status:'ok',ready:true},{raw:true})};
    });
    await wireCase('remote-auth-required','remote',ctx.wire('GET','/v1/health',null,{headers:{Authorization:null}}),401,'UNAUTHENTICATED');
    await semanticCase('identities','remote');
    await record('remote-shutdown-cleanup','remote',async()=>({process:await stopAndCheck(),listenerAbsent:true}));
    result.remote={state:'PASS',address:remoteAddress,cidr:assigned.cidr,scope:'same-host assigned RFC1918',explicitOptIn:true};
    ctx.host=ctx.config.bindAddress??'127.0.0.1';
  });
  result.coverage={
    loopback:result.groups.some(row=>row.id==='semantic'&&row.state==='PASS'),
    semanticCapabilities:result.semantic?.capabilities??[],decisions:result.semantic?.decisions??[],
    nodeFetch:result.records.some(row=>row.id==='node-fetch-bounded'&&row.state==='PASS'),
    curl:result.records.some(row=>row.id==='curl-bounded'&&row.state==='PASS'),
    rawTls:result.records.some(row=>row.transport?.tlsVersion==='TLSv1.3'),
    groups:result.groups.filter(row=>row.state==='PASS').map(row=>row.id)};
  assert.ok(result.groups.every(row=>row.state==='PASS'));assert.ok(result.records.every(row=>row.state==='PASS'));
  result.state='PASS';persist();
}
try{await run();}
catch(error){
  result.state='FAIL';result.failure={case:current,group:currentGroup,type:error.name,code:error.code??'REFRESH_ASSERTION',
    messageSha256:sha(String(error.message)),...(error.clientProcess?{process:error.clientProcess}:{})};
  try{if(ctx.active&&!ctx.active.closed){ctx.active.child.kill();await bounded(ctx.active.exit,5000,'FAILED_PROBE_REAP');}}
  catch{result.cleanupFailure=true;}
  persist();process.exitCode=1;
}
process.stdout.write(JSON.stringify({state:result.state,evidence:'probe.json',records:result.records.length,groups:result.groups.length})+'\n');
