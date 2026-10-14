/** Certification harness: only Node builtins; gateway always uses the installed entrypoint. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import tls from 'node:tls';

export const sha=value=>createHash('sha256').update(value).digest('hex');
export const identity=value=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(value);return {byteLength:bytes.length,sha256:sha(bytes)};};
export const delay=ms=>new Promise(done=>setTimeout(done,ms));
export function bounded(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error(label)),ms);})]).finally(()=>clearTimeout(timer));}
export function canonical(value){const order=x=>Array.isArray(x)?x.map(order):x!==null&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,order(x[k])])):x;return Buffer.from(JSON.stringify(order(value)));}
const nodeSha256='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';

export function createContext({packagePath,configPath,fixturePath,oraclePath,outputDir,curlPath}){
  for(const path of [packagePath,configPath,fixturePath,oraclePath,outputDir,curlPath])assert.ok(isAbsolute(path),'ABSOLUTE_CERTIFICATION_PATH');
  assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.node,'24.21.0');assert.equal(sha(readFileSync(process.execPath)),nodeSha256,'TRUSTED_NODE_IDENTITY');
  const config=JSON.parse(readFileSync(configPath));
  const ctx={packagePath,configPath,fixturePath,oraclePath,outputDir,curlPath,config,
    token:readFileSync(config.tokenFile,'ascii'),ca:readFileSync(config.certificateFile),
    host:config.bindAddress??'127.0.0.1',port:config.port??13050,active:null,processes:[]};
  assert.match(ctx.token,/^[a-f0-9]{64}$/u);
  ctx.api=JSON.parse(readFileSync(resolve(packagePath,'contracts/api-contract.json')));
  ctx.limits=JSON.parse(readFileSync(resolve(packagePath,'contracts/limits.json')));
  assert.equal(ctx.limits.state,'FINAL');assert.equal(ctx.api.routes.length,9);
  mkdirSync(outputDir,{recursive:true});
  ctx.cwd=resolve(outputDir,'empty');mkdirSync(ctx.cwd,{recursive:true});assert.deepEqual(readdirSync(ctx.cwd),[]);
  const temp=resolve(outputDir,'tmp');mkdirSync(temp,{recursive:true});
  ctx.env=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(SYSTEMROOT|WINDIR)$/iu.test(name)));
  Object.assign(ctx.env,{TEMP:temp,TMP:temp,PATH:'C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0'});
  ctx.fixture=id=>JSON.parse(readFileSync(resolve(fixturePath,id+'.json')));
  ctx.wire=(method,path,input=null,{headers={}}={})=>{
    const body=input===null?Buffer.alloc(0):Buffer.isBuffer(input)?input:Buffer.from(typeof input==='string'?input:JSON.stringify(input));
    const fields={Host:ctx.host+':'+ctx.port,Authorization:'Bearer '+ctx.token,Connection:'close','Accept-Encoding':'identity',...headers};
    if(method==='POST'||input!==null){if(!Object.hasOwn(fields,'Content-Type'))fields['Content-Type']='application/json';if(!Object.hasOwn(fields,'Content-Length'))fields['Content-Length']=String(body.length);}
    return Buffer.concat([Buffer.from(`${method} ${path} HTTP/1.1\r\n`+Object.entries(fields).filter(([,value])=>value!==null).map(([key,value])=>key+': '+value).join('\r\n')+'\r\n\r\n'),body]);
  };
  ctx.raw=(wire,{tlsOptions={},timeoutMs=45000,allowFailure=false,end=false}={})=>new Promise((done,fail)=>{
    const socket=tls.connect({host:ctx.host,port:ctx.port,ca:ctx.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],rejectUnauthorized:true,...tlsOptions});
    let bytes=Buffer.alloc(0),errorCode=null,timedOut=false,overflow=false,secure=false,tlsVersion=null,alpn=null,authorized=false;
    const timer=setTimeout(()=>{timedOut=true;socket.destroy();},timeoutMs);
    socket.on('error',error=>{errorCode=error.code??error.name;});
    socket.on('data',part=>{bytes=Buffer.concat([bytes,part]);if(bytes.length>131072){overflow=true;socket.destroy();}});
    socket.once('secureConnect',()=>{secure=true;tlsVersion=socket.getProtocol();alpn=socket.alpnProtocol;authorized=socket.authorized;socket.write(wire);if(end)socket.end();});
    socket.once('close',()=>{
      clearTimeout(timer);
      try{
        assert.equal(timedOut,false,'TLS_REQUEST_TIMEOUT');assert.equal(overflow,false,'TLS_RESPONSE_BOUND');
        if(errorCode&&!allowFailure)throw Error('TLS_REQUEST_FAILED:'+errorCode);
        const result={status:null,headers:{},body:Buffer.alloc(0),json:null,tlsVersion,alpn,authorized,secure,errorCode,wireIdentity:identity(bytes)};
        if(bytes.length){
          const split=bytes.indexOf('\r\n\r\n');assert.ok(split>=0,'RESPONSE_HEADERS');
          const lines=bytes.subarray(0,split).toString('ascii').split('\r\n'),line=lines.shift();assert.match(line,/^HTTP\/1\.1 [0-9]{3} /u);result.status=Number(line.split(' ')[1]);
          for(const field of lines){const colon=field.indexOf(':');assert.ok(colon>0);const name=field.slice(0,colon).toLowerCase();assert.ok(!Object.hasOwn(result.headers,name),'DUPLICATE_RESPONSE_HEADER');result.headers[name]=field.slice(colon+1).trim();}
          result.body=bytes.subarray(split+4);assert.equal(Number(result.headers['content-length']),result.body.length,'RESPONSE_LENGTH');
          for(const [key,value] of Object.entries(ctx.api.headers.response))assert.equal(result.headers[key],value);
          for(const key of ['date','server','transfer-encoding','content-encoding','access-control-allow-origin'])assert.ok(!Object.hasOwn(result.headers,key));
          result.json=JSON.parse(result.body);
        }else if(!allowFailure)throw Error('EMPTY_HTTP_RESPONSE');
        done(result);
      }catch(error){fail(error);}
    });
  });
  ctx.request=async(method,path,input=null,options={})=>{const result=await ctx.raw(ctx.wire(method,path,input,options),options);if(options.expectedStatus!==undefined)assert.equal(result.status,options.expectedStatus);return result;};
  ctx.start=async(overrides={})=>{
    assert.ok(!ctx.active||ctx.active.closed,'ACTIVE_CERTIFICATION_PROCESS');assert.deepEqual(readdirSync(ctx.cwd),[]);
    let selectedConfig=overrides.configPath??configPath;
    if(overrides.config){selectedConfig=resolve(outputDir,'config-'+ctx.processes.length+'.json');writeFileSync(selectedConfig,canonical(overrides.config));}
    const packageRoot=overrides.packagePath??packagePath;
    const args=overrides.args??[resolve(packageRoot,'bin/memoryos-rest.mjs'),'--config',selectedConfig];
    const started=process.hrtime.bigint();
    const child=spawn(process.execPath,args,{cwd:ctx.cwd,env:{...ctx.env,...overrides.environment},windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),overflow=false,launchError=null,startupResolve,startupReject;
    const startup=new Promise((done,fail)=>{startupResolve=done;startupReject=fail;});
    // Rejected-startup probes intentionally do not await startup.
    startup.catch(()=>{});
    const state={child,closed:false,startedNs:started.toString(),get stdout(){return stdout.toString();},get stderr(){return stderr.toString();}};
    child.stdout.on('data',bytes=>{stdout=Buffer.concat([stdout,bytes]);if(stdout.length>16384){overflow=true;child.kill();}});
    child.stderr.on('data',bytes=>{stderr=Buffer.concat([stderr,bytes]);if(stderr.length>262144){overflow=true;child.kill();}if(stderr.includes('"event":"startup"'))startupResolve();});
    child.stdin.on('error',()=>{});
    child.on('error',error=>{launchError=error.code??error.name;startupReject(Error('PROCESS_LAUNCH_FAILED'));});
    state.exit=new Promise(done=>child.once('close',(code,signal)=>{state.closed=true;state.exitCode=code;state.signal=signal;state.elapsedMs=Number(process.hrtime.bigint()-started)/1e6;startupReject(Error('PROCESS_EARLY_EXIT'));done({code,signal});}));
    state.receipt=()=>{
      assert.equal(launchError,null,'PROCESS_LAUNCH_ERROR');assert.equal(overflow,false,'PROCESS_LOG_BOUND');assert.equal(stdout.length,0,'GATEWAY_STDOUT');
      const secretValues=[ctx.token,'Bearer '+ctx.token,'-----BEGIN PRIVATE KEY-----',config.tokenFile,config.privateKeyFile];
      for(const value of secretValues)assert.ok(!stderr.includes(value),'SECRET_IN_GATEWAY_LOG');
      const logs=stderr.toString('utf8').trim().split(/\r?\n/u).filter(Boolean).map(line=>{
        assert.ok(Buffer.byteLength(line+'\n')<=ctx.limits.fixed.logRecordBytes,'LOG_RECORD_BOUND');const row=JSON.parse(line);assert.deepEqual(Object.keys(row).sort(),['code','event','operationId','requestId']);
        assert.ok(['startup','requestCompleted','requestRejected','requestCancelled','shutdown','fatal','logsDropped'].includes(row.event));
        assert.ok(row.code===null||Object.hasOwn(ctx.api.errors,row.code));assert.ok(row.operationId===null||ctx.api.routes.some(route=>route.operationId===row.operationId));
        assert.ok(row.requestId===null||new RegExp(ctx.api.headers.requestIdPattern,'u').test(row.requestId));return row;
      });
      assert.deepEqual(readdirSync(ctx.cwd),[],'GATEWAY_PERSISTENCE');
      return {pid:child.pid,entry:'installed/bin/memoryos-rest.mjs',exitCode:state.exitCode??null,signal:state.signal??null,elapsedMs:Math.ceil(state.elapsedMs??Number(process.hrtime.bigint()-started)/1e6),stdout:identity(stdout),stderr:identity(stderr),logCount:logs.length,startupObserved:logs.some(row=>row.event==='startup'),shutdownObserved:logs.some(row=>row.event==='shutdown'),secretFreeLogs:true,cwdRemainedEmpty:true};
    };
    state.stop=async({expectedCode=overrides.expectedExitCode??0,timeoutMs=17000}={})=>{
      if(!state.closed)child.stdin.end();
      let result;try{result=await bounded(state.exit,timeoutMs,'GATEWAY_SHUTDOWN_TIMEOUT');}catch(error){child.kill();await bounded(state.exit,5000,'GATEWAY_FORCED_REAP_TIMEOUT');throw error;}
      if(expectedCode!==null)assert.equal(result.code,expectedCode,'GATEWAY_EXIT');assert.equal(result.signal,null);
      const receipt=state.receipt();if(!state.recorded){ctx.processes.push(receipt);state.recorded=true;}return receipt;
    };
    ctx.active=state;
    if(overrides.expectStartup!==false){try{await bounded(startup,15000,'GATEWAY_STARTUP_TIMEOUT');}catch(error){if(!state.closed)child.kill();await bounded(state.exit,5000,'FAILED_STARTUP_REAP_TIMEOUT');throw error;}}
    return state;
  };
  ctx.stop=async(state=ctx.active,options={})=>state?state.stop(options):null;
  return ctx;
}
