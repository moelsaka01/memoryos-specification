import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {stage,credentials,launch,wire,request,response,clean,nodePath,checked,launchHistory} from './common.mjs';

/** Focused startup certificate rejection and restart-only credential loading. */
export async function runStartup(){
  const records=[],configPath=resolve(stage,'private/config.json'),original=readFileSync(configPath),config=JSON.parse(original);
  const openssl='C:/Program Files/Git/usr/bin/openssl.exe';
  function rejected(id,value){
    writeFileSync(configPath,JSON.stringify(value));
    try{
      const child=spawnSync(nodePath,[resolve(stage,'package/bin/memoryos-rest.mjs'),'--config',configPath],{env:clean,windowsHide:true,encoding:'utf8',timeout:45000,maxBuffer:16384});
      assert.equal(child.error,undefined,id);assert.equal(child.status,2,id);assert.equal(child.stdout,'',id);
      launchHistory.push({pid:child.pid,entry:'package/bin/memoryos-rest.mjs',launchMode:'production-entrypoint',started:false,exitCode:child.status,signal:child.signal});
      assert.deepEqual(JSON.parse(child.stderr),{code:'MO1305_UNAVAILABLE',event:'fatal',operationId:null,requestId:null},id);
      assert.ok(!child.stderr.includes(credentials.token));
      records.push({id,category:'tls',state:'PASS',process:'actual-entrypoint-before-listener',pid:child.pid,exitCode:2,gatewayCode:'MO1305_UNAVAILABLE',diagnosticBytes:Buffer.byteLength(child.stderr)});
    }finally{writeFileSync(configPath,original);}
  }
  const wrong=resolve(stage,'private/wrong-ip.pem');checked(openssl,['req','-new','-x509','-key',config.privateKeyFile,'-out',wrong,'-days','1','-subj','/CN=MO1305 negative','-addext','subjectAltName=IP:127.0.0.2']);rejected('STARTUP-TLS-wrong-ip',{...config,certificateFile:wrong});
  const noSAN=resolve(stage,'private/no-san.pem');checked(openssl,['req','-new','-x509','-key',config.privateKeyFile,'-out',noSAN,'-days','1','-subj','/CN=127.0.0.1']);rejected('STARTUP-TLS-no-ip-san',{...config,certificateFile:noSAN});
  const expired=resolve(stage,'private/expired.pem');checked(openssl,['x509','-in',config.certificateFile,'-signkey',config.privateKeyFile,'-not_before','20200101000000Z','-not_after','20210101000000Z','-out',expired]);rejected('STARTUP-TLS-expired',{...config,certificateFile:expired});
  const mismatch=resolve(stage,'private/mismatched-key.pem');checked(openssl,['genpkey','-algorithm','EC','-pkeyopt','ec_paramgen_curve:P-256','-out',mismatch]);rejected('STARTUP-TLS-key-mismatch',{...config,privateKeyFile:mismatch});
  const oldToken=readFileSync(config.tokenFile),replacement=randomBytes(32).toString('hex');assert.notEqual(replacement,credentials.token);
  let running=null;
  try{
    running=await launch();writeFileSync(config.tokenFile,replacement);
    const oldBefore=response(await wire(request('getHealth'))),newBefore=response(await wire(request('getHealth',null,{headers:{Authorization:'Bearer '+replacement}})));
    assert.deepEqual(oldBefore.body,{status:'ok',live:true});assert.equal(oldBefore.status,200);
    assert.equal(newBefore.status,401);assert.deepEqual(newBefore.body,{status:'error',error:{code:'MO1305_UNAUTHENTICATED',semantic:null}});
    await running.stop();running=null;
    running=await launch();
    const oldAfter=response(await wire(request('getHealth'))),newAfter=response(await wire(request('getHealth',null,{headers:{Authorization:'Bearer '+replacement}})));
    assert.equal(oldAfter.status,401);assert.deepEqual(oldAfter.body,{status:'error',error:{code:'MO1305_UNAUTHENTICATED',semantic:null}});
    assert.equal(newAfter.status,200);assert.deepEqual(newAfter.body,{status:'ok',live:true});
    assert.ok(!running.stderr.includes(replacement));assert.ok(!running.stderr.includes(credentials.token));
    records.push({id:'STARTUP-AUTH-restart-only-rotation',category:'authentication',state:'PASS',transport:'actual-entrypoint/TLS1.3/HTTP1.1',oldCredentialBeforeRestart:200,newCredentialBeforeRestart:401,oldCredentialAfterRestart:401,newCredentialAfterRestart:200,persistentEnvironmentModified:false});
  }finally{try{if(running)await running.stop();}finally{writeFileSync(config.tokenFile,oldToken);}}
  return {records,limitations:[]};
}
