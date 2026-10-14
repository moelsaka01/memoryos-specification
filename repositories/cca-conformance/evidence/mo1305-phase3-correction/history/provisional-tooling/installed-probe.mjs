/** Copied outside the checkout. Imports only Node builtins and verified installed members. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import tls from 'node:tls';
import {networkInterfaces} from 'node:os';

const [packagePath, configPath, fixturePath, manifestSha256, outputPath] = process.argv.slice(2);
assert.equal(process.argv.length, 7);
for (const path of [packagePath, configPath, fixturePath, outputPath]) assert.ok(isAbsolute(path));
assert.match(manifestSha256, /^[a-f0-9]{64}$/u);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const identity = bytes => ({byteLength: bytes.length, sha256: sha256(bytes)});
const load = relative => import(pathToFileURL(resolve(packagePath, relative)).href);
const record = {kind: 'MemoryOSRESTPhase3CorrectionInstalledProbe', version: '1.0.0', state: 'RUNNING', requests: []};
let child = null;
let exitPromise = null;
let stdout = Buffer.alloc(0);
let stderr = Buffer.alloc(0);
let processOverflow = false;
let phase = 'verify-installed-files';

async function bounded(promise, milliseconds, code) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(code)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function request(route, input, configuration, token, ca, api, requestId, {headers: overrides={}, expectedStatus=200}={}) {
  const body = input === null ? '' : JSON.stringify(input);
  const host=configuration.bindAddress??'127.0.0.1';
  const fields = {Host: `${host}:${configuration.port}`, Authorization: `Bearer ${token}`,
    Connection: 'close', 'Accept-Encoding': 'identity', 'X-Request-ID': requestId,...overrides};
  if (route.method === 'POST') {
    fields['Content-Type'] = 'application/json';
    fields['Content-Length'] = String(Buffer.byteLength(body));
  }
  const wire = Buffer.from(`${route.method} ${route.path} HTTP/1.1\r\n` +
    Object.entries(fields).filter(([,value])=>value!==null).map(([key, value]) => `${key}: ${value}`).join('\r\n') + '\r\n\r\n' + body);
  return new Promise((resolveResponse, reject) => {
    const socket = tls.connect({host, port: configuration.port, ca,
      minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', ALPNProtocols: ['http/1.1'], rejectUnauthorized: true});
    let response = Buffer.alloc(0), failure = null, protocol = null, authorized = false, alpn = null;
    const timer = setTimeout(() => {failure = Error('REQUEST_TIMEOUT'); socket.destroy();}, 45000);
    socket.once('error', error => {failure = error;});
    socket.on('data', bytes => {
      response = Buffer.concat([response, bytes]);
      if (response.length > 65536) {failure = Error('RESPONSE_BOUND'); socket.destroy();}
    });
    socket.once('secureConnect', () => {
      protocol = socket.getProtocol(); authorized = socket.authorized; alpn = socket.alpnProtocol;
      socket.write(wire);
    });
    socket.once('close', () => {
      clearTimeout(timer);
      if (failure) return reject(failure);
      try {
        assert.equal(protocol, 'TLSv1.3'); assert.equal(authorized, true); assert.equal(alpn, 'http/1.1');
        const split = response.indexOf('\r\n\r\n'); assert.ok(split >= 0, 'RESPONSE_HEADERS');
        const lines = response.subarray(0, split).toString('ascii').split('\r\n');
        const status = Number(lines.shift().split(' ')[1]), headers = {};
        for (const line of lines) {
          const colon = line.indexOf(':'); assert.ok(colon > 0);
          const name = line.slice(0, colon).toLowerCase(); assert.ok(!Object.hasOwn(headers, name));
          headers[name] = line.slice(colon + 1).trim();
        }
        const responseBody = response.subarray(split + 4);
        assert.equal(status, expectedStatus); assert.equal(Number(headers['content-length']), responseBody.length);
        for (const [name, value] of Object.entries(api.headers.response)) assert.equal(headers[name], value);
        assert.equal(headers['x-request-id'], expectedStatus===401?undefined:requestId);
        for (const name of ['date', 'server', 'transfer-encoding', 'content-encoding']) assert.ok(!Object.hasOwn(headers, name));
        resolveResponse({body: JSON.parse(responseBody), receipt: {operationId: route.operationId, status,
          tlsVersion: protocol, certificateAuthorized: authorized, alpn,
          requestBody: identity(Buffer.from(body)), responseBody: identity(responseBody), responseWire: identity(response),
          requestHeaders: Object.fromEntries(Object.entries(fields).filter(([,value])=>value!==null).map(([key, value]) => [key,
            key === 'Authorization' ? 'Bearer <REDACTED>' : key === 'Host' ? host+':<ISOLATED_PORT>' : value]))}});
      } catch (error) { reject(error); }
    });
  });
}

try {
  const {verifyRuntime, verifyDistribution} = await load('src/integrity.mjs');
  verifyRuntime();
  assert.equal(verifyDistribution(packagePath, manifestSha256), manifestSha256);
  const {verifyContracts} = await load('scripts/verify-contracts.mjs');
  verifyContracts();
  const {api, limits, validate, versionProduct} = await load('src/contracts.mjs');
  assert.equal(limits.state, 'FINAL'); assert.equal(api.routes.length, 9);
  assert.deepEqual(api.deployment,{defaultMode:'local',remoteMode:{mode:'remote',implemented:true,explicitOptIn:true,bindAddressPolicy:'assigned RFC1918 IPv4'}});
  record.deployment=api.deployment;
  record.verification = {runtime: 'PASS', distribution: 'PASS', contracts: 'PASS', schemas: 'PASS',
    openapi: 'PASS', limitsState: limits.state, semanticClosureFileCount: 25, distributionManifestSha256: manifestSha256};
  record.contracts = Object.fromEntries(['api-contract.json', 'limits.json', 'openapi.json',
    'policy-contract-identities-1.0.0.json'].map(name => [name, identity(readFileSync(resolve(packagePath, 'contracts', name)))]));
  const configuration = JSON.parse(readFileSync(configPath));
  const token = readFileSync(configuration.tokenFile, 'ascii');
  const ca = readFileSync(configuration.certificateFile);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(SYSTEMROOT|WINDIR|TEMP|TMP)$/iu.test(name)));
  assert.deepEqual(readdirSync(process.cwd()), []);
  phase = 'entry-point-startup';
  child = spawn(process.execPath, [resolve(packagePath, 'bin/memoryos-rest.mjs'), '--config', configPath],
    {cwd: process.cwd(), env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
  exitPromise = new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveExit({code, signal}));
  });
  const startup = new Promise((resolveStartup, reject) => {
    child.stdout.on('data', bytes => {
      stdout = Buffer.concat([stdout, bytes]);
      if (stdout.length > 16384) {processOverflow = true; child.kill();}
    });
    child.stderr.on('data', bytes => {
      stderr = Buffer.concat([stderr, bytes]);
      if (stderr.length > 65536) {processOverflow = true; child.kill();}
      if (stderr.includes('"event":"startup"')) resolveStartup();
    });
    exitPromise.then(() => reject(Error('EARLY_EXIT')), reject);
  });
  await bounded(startup, 20000, 'STARTUP_TIMEOUT');
  record.entryPoint = 'bin/memoryos-rest.mjs';
  const cases = [{id: 'health', operation: 'getHealth', input: null, expected: {status: 'ok', live: true}},
    {id: 'readiness', operation: 'getReadiness', input: null, expected: {status: 'ok', ready: true}},
    {id: 'version', operation: 'getVersion', input: null, expected: versionProduct}];
  for (const name of readdirSync(fixturePath).sort()) {
    assert.match(name, /^[A-Za-z0-9-]+\.json$/u);
    const bytes = readFileSync(resolve(fixturePath, name));
    const item = JSON.parse(bytes);
    cases.push({...item, fixture: {path: name, ...identity(bytes)}});
  }
  assert.equal(cases.length, 5);
  for (const item of cases) {
    phase = item.id;
    const route = api.routes.find(entry => entry.operationId === item.operation); assert.ok(route);
    const response = await request(route, item.input, configuration, token, ca, api, `correction-${item.id}`);
    assert.deepEqual(response.body, item.expected);
    assert.equal(validate(route.output, response.body), true);
    record.requests.push({case: item.id, ...response.receipt, ...(item.fixture ? {fixture: item.fixture} : {}),
      expectedBodyMatched: true, responseSchemaValidated: true});
  }
  assert.equal(new Set(record.requests.map(item => item.operationId)).size, 5);
  for(const [label,headers,status,code] of [['missing-auth',{Authorization:null},401,'MO1305_UNAUTHENTICATED']]){
    const value=await request(api.routes.find(r=>r.operationId==='getHealth'),null,configuration,token,ca,api,'correction-'+label,{headers,expectedStatus:status});
    assert.equal(value.body.error.code,code);record.requests.push({case:label,...value.receipt,expectedError:code,expectedBodyMatched:true});
  }

  phase = 'orderly-shutdown';
  child.stdin.end();
  const exit = await bounded(exitPromise, 20000, 'SHUTDOWN_TIMEOUT');
  assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.equal(processOverflow, false);
  assert.equal(stdout.length, 0); assert.ok(!stderr.includes(token)); assert.ok(!stderr.includes('Bearer '));
  const logs = stderr.toString('utf8').trim().split('\n').map(line => {
    assert.ok(Buffer.byteLength(line) <= 1024); return JSON.parse(line);
  });
  for (const log of logs) assert.deepEqual(Object.keys(log).sort(), ['code', 'event', 'operationId', 'requestId']);
  assert.ok(logs.some(item => item.event === 'startup'));
  assert.ok(logs.some(item => item.event === 'shutdown'));
  record.process = {exitCode: exit.code, stdout: identity(stdout), stderr: identity(stderr),
    logCount: logs.length, startupObserved: true, orderlyShutdownObserved: true, secretFreeLogs: true};
  verifyRuntime(); assert.equal(verifyDistribution(packagePath, manifestSha256), manifestSha256);
  verifyContracts(); assert.deepEqual(readdirSync(process.cwd()), []);

  phase='installed-remote-startup';
  const {validateBinding}=await load('src/config.mjs');
  const addresses=Object.values(networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address);
  const address=addresses.find(value=>{try{validateBinding('remote',value);return true;}catch{return false;}});
  assert.ok(address,'ASSIGNED_RFC1918_REQUIRED');
  const remoteConfig={...configuration,mode:'remote',bindAddress:address};
  writeFileSync(configPath,JSON.stringify(remoteConfig));
  stdout=Buffer.alloc(0);stderr=Buffer.alloc(0);processOverflow=false;
  child=spawn(process.execPath,[resolve(packagePath,'bin/memoryos-rest.mjs'),'--config',configPath],{cwd:process.cwd(),env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  exitPromise=new Promise((done,fail)=>{child.once('error',fail);child.once('exit',(code,signal)=>done({code,signal}));});
  await bounded(new Promise((done,fail)=>{
    child.stdout.on('data',bytes=>{stdout=Buffer.concat([stdout,bytes]);if(stdout.length>16384){processOverflow=true;child.kill();}});
    child.stderr.on('data',bytes=>{stderr=Buffer.concat([stderr,bytes]);if(stderr.length>65536){processOverflow=true;child.kill();}if(stderr.includes('"event":"startup"'))done();});
    exitPromise.then(()=>fail(Error('REMOTE_EARLY_EXIT')),fail);
  }),20000,'REMOTE_STARTUP_TIMEOUT');
  const remoteRequests=[];
  for(const operation of ['getHealth']){
    const item=cases.find(x=>x.operation===operation);assert.ok(item);
    const value=await request(api.routes.find(r=>r.operationId===operation),item.input,remoteConfig,token,ca,api,'correction-remote-'+operation);
    assert.deepEqual(value.body,item.expected);remoteRequests.push({case:operation,...value.receipt,expectedBodyMatched:true});
  }
  for(const [label,headers,status,code] of [['missing-auth',{Authorization:null},401,'MO1305_UNAUTHENTICATED']]){
    const value=await request(api.routes.find(r=>r.operationId==='getHealth'),null,remoteConfig,token,ca,api,'correction-remote-'+label,{headers,expectedStatus:status});
    assert.equal(value.body.error.code,code);remoteRequests.push({case:label,...value.receipt,expectedError:code,expectedBodyMatched:true});
  }
  child.stdin.end();const remoteExit=await bounded(exitPromise,20000,'REMOTE_SHUTDOWN_TIMEOUT');
  assert.deepEqual(remoteExit,{code:0,signal:null});assert.equal(stdout.length,0);assert.equal(processOverflow,false);
  assert.ok(!stderr.includes(token)&&!stderr.includes('Bearer '));
  const remoteLogs=stderr.toString().trim().split('\n').map(line=>{assert.ok(Buffer.byteLength(line)<=1024);const value=JSON.parse(line);assert.deepEqual(Object.keys(value).sort(),['code','event','operationId','requestId']);return value;});
  assert.ok(remoteLogs.some(x=>x.event==='startup')&&remoteLogs.some(x=>x.event==='shutdown'));
  record.remote={state:'PASS',mode:'remote',address,scope:'same-host assigned RFC1918; not off-host reachability',requests:remoteRequests,exitCode:0,stdout:identity(stdout),stderr:identity(stderr),secretFreeLogs:true};
  writeFileSync(configPath,JSON.stringify(configuration));
  verifyRuntime();assert.equal(verifyDistribution(packagePath,manifestSha256),manifestSha256);verifyContracts();

  record.state = 'PASS';
} catch (error) {
  record.state = 'FAIL';
  record.failure = {phase, type: error.name, code: error.code ?? 'INSTALLED_PROBE_ASSERTION',
    stdout: identity(stdout), stderr: identity(stderr)};
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    try { await bounded(exitPromise, 5000, 'FORCED_CLEANUP_TIMEOUT'); } catch { record.forcedCleanupFailed = true; }
  }
  writeFileSync(outputPath, JSON.stringify(record));
}
