import assert from 'node:assert/strict';
import {appendFileSync,copyFileSync,cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import http from 'node:http';
import {launch,wire,response,request,vectors,delay,credentials,root,stage,clean,nodePath,bounded,powershell,launchHistory} from './common.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const b64=value=>Buffer.from(value).toString('base64');
const fatal={code:'MO1305_UNAVAILABLE',event:'fatal',operationId:null,requestId:null};

/** Authenticated requests always pass the real entrypoint, TLS, raw framing gate,
 * Node HTTP parser and closed request schema. Only explicitly labelled launcher
 * probes run before listening; production files and persistent env are untouched. */
export async function runCapabilities({runtimeOnly=false}={}){
  const records=[],limitations=[
    'Network evidence is a calibrated loopback acquisition sentinel, successful actual-worker semantics, and separately retained worker-boundary regression. No OS firewall, kernel isolation, exhaustive packet capture, or hostile-administrator denial is claimed.',
    'A launcher preload/custom loader may execute before the entrypoint refuses its environment or execArgv. This frozen trusted-launcher exclusion is demonstrated, not described as prevention of pre-entry execution.',
    'Filesystem witnesses show request strings are rejected or delegated as opaque inline artifact bytes; they are not an OS-wide file-read audit.',
    'No remote-mode lifecycle or package/distribution certification is added by these Phase 2C isolated copies.'
  ];
  const record=(id,category,details={})=>records.push({id,category,state:'PASS',...details});
  const redactedRequest=raw=>{const split=raw.indexOf('\r\n\r\n')+4;return Buffer.concat([Buffer.from(raw.subarray(0,split).toString('latin1').replaceAll(credentials.token,'<redacted-bearer>'),'latin1'),raw.subarray(split)]);};
  const resultRecord=(id,category,result,raw)=>record(id,category,{transport:'actual-entrypoint/TLS1.3/HTTP1.1',status:result.status,code:result.body.error?.code??null,redactedRequestSha256:digest(redactedRequest(raw)),responseSha256:digest(result.bytes)});
  const postBytes=(operation,bytes)=>{
    const prefix=request(operation,'x').toString();
    return Buffer.concat([Buffer.from(prefix.slice(0,prefix.indexOf('\r\n\r\n')+4).replace('Content-Length: 1\r\n','Content-Length: '+bytes.length+'\r\n')),bytes]);
  };
  async function expect(id,category,raw,code,status){
    await delay(70);
    const result=response(await wire(raw));
    assert.equal(result.status,status,id);
    assert.deepEqual(result.body,{status:'error',error:{code:'MO1305_'+code,semantic:null}},id);
    resultRecord(id,category,result,raw);return result;
  }
  async function semanticReject(id,category,raw,forbiddenText=null){
    await delay(70);const result=response(await wire(raw));
    assert.equal(result.status,422,id);assert.equal(result.body.error.code,'MO1305_SEMANTIC_REJECTED',id);
    assert.ok(result.body.error.semantic,id);assert.deepEqual(Object.keys(result.body).sort(),['error','status']);
    assert.ok(!result.bytes.includes(credentials.token),id+' credential leak');
    if(forbiddenText!==null)assert.ok(!result.bytes.includes(forbiddenText),id+' acquisition-string leak');
    resultRecord(id,category,result,raw);return result;
  }
  const catalog=vectors(),policy=catalog.find(v=>v.id==='prepare-policy-pass');
  assert.ok(policy);const sandbox=resolve(stage,'capability-probes-'+randomUUID());mkdirSync(sandbox,{recursive:true});
  const localPolicy=resolve(sandbox,'inline-policy.json');writeFileSync(localPolicy,Buffer.from(policy.input.policyBase64,'base64'));
  const policyHash=digest(readFileSync(localPolicy));
  if(!runtimeOnly){
  const state=await launch();
  let sentinel;
  try{
    const syntax=[
      ['invalid-utf8-overlong',Buffer.from([0xc0,0xaf])],['invalid-utf8-truncated',Buffer.from([0xe2,0x82])],
      ['bom',Buffer.from([0xef,0xbb,0xbf,123,125])],['duplicate-decoded-key','{"policyBase64":"e30=","policy\\u0042ase64":"e30="}'],
      ['lone-high-surrogate','{"x":"\\ud800"}'],['lone-low-surrogate','{"x":"\\udfff"}'],
      ['negative-zero','{"x":-0}'],['decimal-number','{"x":1.0}'],['exponent-number','{"x":1e0}'],
      ['unsafe-integer','{"x":9007199254740992}'],['leading-zero','{"x":01}'],['nonfinite-number','{"x":NaN}'],
      ['trailing-data','{}true'],['comment','{/*x*/}'],['trailing-comma','{"x":true,}'],['unescaped-control','{"x":"\u0001"}']
    ];
    for(const [id,body] of syntax)await expect('JSON-'+id,'json',postBytes('preparePolicy',Buffer.from(body)),'REQUEST_SYNTAX',400);
    // N reaches schema rejection, N+1 is rejected by the parser before schema.
    const boundary=[
      ['depth',8,n=>'['.repeat(n)+'0'+']'.repeat(n)],
      ['members',32,n=>JSON.stringify(Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,0])))],
      ['nodes',128,n=>'['+Array.from({length:n-1},()=>0).join(',')+']'],
      ['key-units',128,n=>'{'+'"'+'a'.repeat(n)+'":0}'],
      ['string-units',699052,n=>'"'+'a'.repeat(n)+'"'],
      ['total-string-units',710000,n=>'["'+'a'.repeat(699052)+'","'+'b'.repeat(n-699052)+'"]']
    ];
    for(const [id,n,make] of boundary)for(const size of [n,n+1])await expect('JSON-'+id+'-'+size,'json',postBytes('evaluatePolicy',Buffer.from(make(size))),size===n?'REQUEST_SCHEMA':'INPUT_LIMIT',size===n?400:413);
    const schema=[
      ['null',null],['array',[]],['boolean',true],['safe-number',1],['missing',{}],['type-confusion',{policyBase64:{value:'e30='}}],
      ['unknown',{...policy.input,extra:true}],['prototype-name',JSON.parse('{"policyBase64":"e30=","__proto__":{"polluted":true}}')],
      ['constructor-name',{...policy.input,constructor:'polluted'}],['prototype-member',{...policy.input,prototype:'polluted'}]
    ];
    for(const [id,input] of schema)await expect('SCHEMA-'+id,'schema',request('preparePolicy',JSON.stringify(input)),'REQUEST_SCHEMA',400);
    for(const [id,value] of [['empty',''],['unpadded','e30'],['overpadded','e30==='],['padding-bits','e31='],['url-alphabet','e3_='],['whitespace','e30=\n']])await expect('SCHEMA-base64-'+id,'schema',request('preparePolicy',{policyBase64:value}),'REQUEST_SCHEMA',400);
    await expect('SCHEMA-base64-decoded-limit','schema',request('preparePolicy',{policyBase64:Buffer.alloc(2049).toString('base64')}),'INPUT_LIMIT',413);
    const evaluation=catalog.find(v=>v.id==='evaluate-policy-pass');
    for(const [id,input] of [['artifact-kind-confusion',{...evaluation.input,artifactKind:'MemoryOSInvestigationPolicy'}],['regression-authority',{...evaluation.input,regressionSource:{path:localPolicy}}],['candidate-path',{...evaluation.input,candidateMipPath:localPolicy}],['workspace-authority',{...evaluation.input,workspace:root}]])await expect('CAPABILITY-'+id,'authorization',request('evaluatePolicy',input),'REQUEST_SCHEMA',400);
    for(const [id,path] of [['filesystem','/v1/files'],['workspace','/v1/workspace'],['regression','/v1/regression'],['proxy','/v1/proxy'],['fetch','/v1/fetch'],['command','/v1/exec'],['shell','/v1/shell'],['generic-operation','/v1/invoke'],['mcp','/mcp'],['vscode','/vscode']])await expect('CAPABILITY-route-'+id,'authorization',request('getHealth',null,{path}),'NOT_FOUND',404);
    const commandMarker=resolve(sandbox,'command-must-not-run.txt');
    for(const [id,input] of [['command',{...policy.input,command:'echo unexpected > '+commandMarker}],['shell',{...policy.input,shell:'cmd.exe'}],['operation',{...policy.input,operation:'importRegression'}],['mcp',{...policy.input,mcp:{tool:'read_file'}}],['vscode',{...policy.input,vscode:{command:'workbench.action.openSettings'}}]])await expect('CAPABILITY-member-'+id,'authorization',request('preparePolicy',input),'REQUEST_SCHEMA',400);
    assert.equal(existsSync(commandMarker),false);
    const paths=[['absolute-windows',localPolicy],['relative','../capability-probes/inline-policy.json'],['drive-relative','C:inline-policy.json'],['unc','\\\\127.0.0.1\\share\\inline-policy.json'],['device','\\\\?\\C:\\inline-policy.json'],['win32-device','\\\\.\\C:\\inline-policy.json'],['ads',localPolicy+':stream'],['file-uri',pathToFileURL(localPolicy).href],['workspace',resolve(root,'ARCHITECTURE.md')],['home','%USERPROFILE%\\inline-policy.json'],['tilde','~/inline-policy.json'],['junction-like','C:\\junction\\..\\inline-policy.json']];
    for(const [id,value] of paths){
      await expect('FILESYSTEM-field-'+id,'filesystem',request('preparePolicy',{...policy.input,policyPath:value}),'REQUEST_SCHEMA',400);
      await semanticReject('FILESYSTEM-opaque-'+id,'filesystem',request('preparePolicy',{policyBase64:b64(value)}),value);
    }
    assert.equal(digest(readFileSync(localPolicy)),policyHash);record('FILESYSTEM-known-policy-unmodified','filesystem',{contentSha256:policyHash,commandMarkerCreated:false});
    // The target serves valid policy bytes. A fetch-and-prepare implementation
    // would succeed and register a hit; the frozen inline-only API must not fetch.
    let connections=0,hits=0;
    sentinel=http.createServer((_req,res)=>{hits++;res.writeHead(200,{'Content-Type':'application/json','Connection':'close'});res.end(readFileSync(localPolicy));});
    sentinel.on('connection',()=>connections++);
    await new Promise((resolve,reject)=>{sentinel.once('error',reject);sentinel.listen(0,'127.0.0.1',resolve);});
    const address=sentinel.address(),sentinelUrl='http://127.0.0.1:'+address.port+'/inline-policy.json';
    await new Promise((resolve,reject)=>{http.get(sentinelUrl,res=>{res.resume();res.once('end',resolve);}).once('error',reject);});
    assert.equal(hits,1);assert.equal(connections,1);hits=0;connections=0;
    record('NETWORK-sentinel-positive-calibration','network-authority',{calibrationConnections:1,calibrationRequests:1});
    const uris=[['http-sentinel',sentinelUrl],['https','https://127.0.0.1:'+address.port+'/x'],['file','file:///C:/inline-policy.json'],['ftp','ftp://127.0.0.1:'+address.port+'/x'],['localhost','http://localhost:'+address.port+'/x'],['ipv6-loopback','http://[::1]/x'],['ipv6-expanded','http://[0:0:0:0:0:0:0:1]/x'],['private','http://10.0.0.1/x'],['metadata','http://169.254.169.254/latest/meta-data'],['dns','https://memoryos-invalid.example/x'],['encoded','http%3A%2F%2F127.0.0.1%2Fx']];
    for(const [id,value] of uris){
      await expect('SSRF-field-'+id,'uri-ssrf',request('preparePolicy',{...policy.input,url:value}),'REQUEST_SCHEMA',400);
      await semanticReject('SSRF-opaque-'+id,'uri-ssrf',request('preparePolicy',{policyBase64:b64(value)}),value);
    }
    for(const id of ['identities','prepare-policy-pass','prepare-policySet-pass','evaluate-policy-pass','evaluate-policy-fail','evaluate-policy-cne','verify-identity','verify-outcome']){
      const vector=catalog.find(v=>v.id===id);assert.ok(vector,id);await delay(70);
      const raw=request(vector.operation,vector.input),result=response(await wire(raw));assert.equal(result.status,200,id);assert.deepEqual(result.body,vector.expected,id);
      resultRecord('NETWORK-semantic-'+id,'network-authority',result,raw);
    }
    await delay(150);assert.equal(hits,0);assert.equal(connections,0);
    record('NETWORK-zero-client-directed-sentinel-acquisition','network-authority',{gatewayPid:state.child.pid,attackConnections:connections,attackRequests:hits,sentinel:'Windows-loopback-HTTP-positive-calibration',scope:'Observed supplied loopback target; arbitrary external addresses are not packet-captured.'});
    assert.ok(!state.stderr.includes(credentials.token));assert.ok(!state.stderr.includes(localPolicy));assert.ok(!state.stderr.includes('policyBase64'));
  }finally{
    try{if(sentinel){sentinel.closeAllConnections();await bounded(new Promise(resolve=>sentinel.close(resolve)),5000,'SENTINEL_CLOSE_TIMEOUT');}}finally{await state.stop();}
  }

  }
  const entry=resolve(stage,'package/bin/memoryos-rest.mjs'),config=resolve(stage,'private/config.json');
  const launchProbe=(args,environment={},executable=nodePath)=>spawnSync(executable,args,{cwd:resolve(stage,'empty'),windowsHide:true,env:{...clean,...environment},encoding:'utf8',timeout:45000,maxBuffer:65536});
  function startupDenied(id,args,environment={},executable=nodePath,{allowRuntimeDiagnostics=false}={}){
    const run=launchProbe(args,environment,executable);assert.equal(run.error,undefined,id);assert.equal(run.status,2,id);assert.equal(run.stdout,'',id);
    launchHistory.push({pid:run.pid,entry:'package/bin/memoryos-rest.mjs',launchMode:'production-entrypoint',started:false,exitCode:run.status,signal:run.signal});
    const lines=run.stderr.trim().split(/\r?\n/u),gateway=lines.filter(line=>line.startsWith('{"code":'));
    assert.equal(gateway.length,1,id);assert.deepEqual(JSON.parse(gateway[0]),fatal,id);
    if(!allowRuntimeDiagnostics)assert.deepEqual(lines,gateway,id);
    assert.ok(!run.stderr.includes(credentials.token),id+' secret leak');
    record(id,'environment-runtime',{process:'actual-entrypoint-before-listener',pid:run.pid,exitCode:run.status,gatewayDiagnostic:JSON.parse(gateway[0]),runtimeDiagnosticLines:lines.length-gateway.length,executableSha256:digest(readFileSync(executable))});
  }
  for(const [id,environment] of [
    ['node-options',{NODE_OPTIONS:'--no-warnings'}],['node-path',{NODE_PATH:sandbox}],['node-extra-ca',{NODE_EXTRA_CA_CERTS:resolve(stage,'private/cert.pem')}],
    ['node-debug',{NODE_DEBUG:'http'}],['http-proxy',{HTTP_PROXY:'http://127.0.0.1:1'}],['https-proxy',{HTTPS_PROXY:'http://127.0.0.1:1'}],
    ['all-proxy',{ALL_PROXY:'http://127.0.0.1:1'}],['ssl-cert-dir',{SSL_CERT_DIR:sandbox}],['uv-threadpool',{UV_THREADPOOL_SIZE:'2'}]
  ])startupDenied('ENV-'+id,[entry,'--config',config],environment);
  for(const [id,flags] of [['execArgv',['--no-warnings']],['inspect-debug',['--inspect-port=0']]])startupDenied('RUNTIME-'+id,[...flags,entry,'--config',config]);
  // Benign markers make the pre-entry limitation mechanically visible.
  const preMarker=resolve(sandbox,'preload-ran.txt'),preload=resolve(sandbox,'preload.cjs');
  writeFileSync(preload,'require("node:fs").writeFileSync('+JSON.stringify(preMarker)+',"pre-entry");\n');
  startupDenied('ENV-node-options-preload',[entry,'--config',config],{NODE_OPTIONS:'--require '+JSON.stringify(preload)});assert.equal(readFileSync(preMarker,'utf8'),'pre-entry');
  startupDenied('RUNTIME-explicit-preload',['--require',preload,entry,'--config',config]);
  const loaderMarker=resolve(sandbox,'loader-ran.txt'),loader=resolve(sandbox,'loader.mjs');
  writeFileSync(loader,'import{writeFileSync}from"node:fs";writeFileSync('+JSON.stringify(loaderMarker)+',"pre-entry");export async function resolve(s,c,next){return next(s,c);}\n');
  startupDenied('RUNTIME-custom-loader',['--experimental-loader',pathToFileURL(loader).href,entry,'--config',config],{},nodePath,{allowRuntimeDiagnostics:true});assert.equal(readFileSync(loaderMarker,'utf8'),'pre-entry');
  record('RUNTIME-pre-entry-trust-limit-demonstrated','environment-runtime',{preloadExecutedBeforeRefusal:true,loaderExecutedBeforeRefusal:true,persistentEnvironmentModified:false});

  const alteredRuntime=resolve(sandbox,'substituted-node.exe');copyFileSync(nodePath,alteredRuntime);appendFileSync(alteredRuntime,Buffer.from('MO1305_2C_EXECUTABLE_SUBSTITUTION_WITNESS'));
  assert.notEqual(digest(readFileSync(alteredRuntime)),digest(readFileSync(nodePath)));
  const trustedCheck=spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve(root,'repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1'),'-NodePath',alteredRuntime,'-ConfigPath',config],{encoding:'utf8',windowsHide:true,env:clean,timeout:45000,maxBuffer:65536});
  assert.equal(trustedCheck.error,undefined);assert.equal(trustedCheck.status,2);assert.equal(trustedCheck.stdout.trim(),'MO1305_TRUSTED_LAUNCH_REFUSED:RUNTIME');
  record('RUNTIME-modified-executable-trusted-launch-refusal','environment-runtime',{process:'trusted-launch-checker-before-execution',exitCode:2,reason:'RUNTIME',sha256:digest(readFileSync(alteredRuntime)),sourceRuntimeVersion:'24.21.0',mutation:'append PE overlay without changing original executable bytes'});
  const alternateRuntime='C:/Program Files/nodejs/node.exe',alternateVersion=launchProbe(['--version'],{},alternateRuntime);
  assert.equal(alternateVersion.status,0);assert.notEqual(alternateVersion.stdout.trim(),'v24.21.0');
  startupDenied('RUNTIME-unsupported-executable-substitution',[entry,'--config',config],{},alternateRuntime);
  for(const [id,relativePath] of [['semantic-closure','runtime/authoritative/web/js/memoryos-sdk.js'],['contract-pin','contracts/policy-contract-identities-1.0.0.json']]){
    const copy=resolve(sandbox,'changed-'+id);cpSync(resolve(stage,'package'),copy,{recursive:true});appendFileSync(resolve(copy,relativePath),'\n');
    startupDenied('RUNTIME-startup-'+id+'-substitution',[resolve(copy,'bin/memoryos-rest.mjs'),'--config',config]);
  }
  const liveCopy=resolve(sandbox,'changed-after-listen');cpSync(resolve(stage,'package'),liveCopy,{recursive:true});
  const live=await launch({packagePath:liveCopy});
  try{
    appendFileSync(resolve(liveCopy,'runtime/authoritative/web/js/memoryos-sdk.js'),'\n');
    await expect('RUNTIME-live-closure-substitution','environment-runtime',request('getContractIdentities'),'RUNTIME_INTEGRITY',503);
  }finally{
    // The integrity failure intentionally poisons the actual process (exit 1).
    live.child.stdin.end(); let exited;try{exited=await bounded(live.exit,17000,'INTEGRITY_SHUTDOWN_TIMEOUT');}catch(error){live.child.kill();await bounded(live.exit,5000,'INTEGRITY_FORCED_REAP_TIMEOUT');throw error;}assert.equal(exited.code,1);assert.equal(live.stdout,'');
  }
  return {records,limitations};
}
