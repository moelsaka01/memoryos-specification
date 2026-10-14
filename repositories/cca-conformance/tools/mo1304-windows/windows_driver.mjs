/** Installed-package Windows certification over actual OS pipes. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve,relative,isAbsolute } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn,spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const [root,tooling,inputPath,evidence]=process.argv.slice(2);
const here=fileURLToPath(new URL('.',import.meta.url));const area=process.env.MO1304_CERT_ROOT;for(const p of [root,tooling,inputPath,evidence]){assert.ok(isAbsolute(p));assert.ok(!relative(area,p).startsWith('..'));}
assert.equal(process.execPath,resolve(area,'runtime/node.exe'));assert.equal(process.versions.node,'24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const sha=x=>createHash('sha256').update(x).digest('hex');
assert.equal(sha(await readFile(process.execPath)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const inputBytes=await readFile(inputPath),input=JSON.parse(inputBytes),L=input.limits;
assert.equal(sha(inputBytes),'43880741e664d70042d5d5b8fe09b7fb25fa0cef0c5bd0b914f86febf20915ae');
const J=x=>JSON.stringify(x===null||typeof x!=='object'?x:Array.isArray(x)?x.map(v=>JSON.parse(J(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(J(x[k]))])));
const pkg=JSON.parse(await readFile(resolve(tooling,'node_modules/@modelcontextprotocol/client/package.json')));assert.equal(pkg.version,'2.0.0');
const {Client}=await import(pathToFileURL(resolve(tooling,'node_modules/@modelcontextprotocol/client/dist/index.mjs')));
const {StdioClientTransport}=await import(pathToFileURL(resolve(tooling,'node_modules/@modelcontextprotocol/client/dist/stdio.mjs')));
const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}};
const request=(id,method,params={})=>({jsonrpc:'2.0',id,method,params:{_meta:meta,...params}});
const {resultType:internalResultType,...wireDiscovery}=input.discovery;
assert.equal(internalResultType,'complete');
const results=[],vectors=[];
const record={kind:'MemoryOSMO1304WindowsExecutionAttempt',version:'1.0.0',status:'RUNNING',implementation:input.implementation,binding:input.binding,inputSha256:sha(inputBytes),node:process.versions.node,nodeExecutableSha256:sha(await readFile(process.execPath)),results,vectors};
async function save(){await writeFile(evidence,J(record)+'\n');}
async function test(id,fn){if(process.env.MO1304_TEST_PATTERN&&!new RegExp(process.env.MO1304_TEST_PATTERN).test(id))return;const start=performance.now();try{const details=await fn();results.push({id,status:'PASS',durationMs:performance.now()-start,details:details??null});await save();process.stdout.write(JSON.stringify({id,status:'PASS'})+'\n');}catch(e){results.push({id,status:'FAIL',durationMs:performance.now()-start,error:String(e.stack).slice(0,5000)});record.status='FAIL';await save();throw e;}}
const metrics=spawn(process.env.MO1304_PYTHON,['-B',resolve(here,'process_metrics.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});let metricBuffer='',metricId=0;const metricPending=new Map();let metricError='';metrics.stderr.on('data',b=>metricError+=b);
metrics.stdout.on('data',b=>{metricBuffer+=b;let at;while((at=metricBuffer.indexOf('\n'))>=0){const r=JSON.parse(metricBuffer.slice(0,at));metricBuffer=metricBuffer.slice(at+1);const entry=metricPending.get(r.id);metricPending.delete(r.id);if(r.error)entry.reject(Error(r.error));else entry.resolve(r);}});
function sample(pid,threads=false){return new Promise((resolve,reject)=>{const id=++metricId;metricPending.set(id,{resolve,reject});metrics.stdin.write(JSON.stringify({id,pid,threads})+'\n');});}
async function rss(pid){return (await sample(pid)).rss;}
async function official(launch,environment={}){
 const transcript=[];let stderr='';const transport=new StdioClientTransport({command:process.execPath,args:launch??[resolve(root,'bin/memoryos-mcp.mjs')],cwd:root,env:environment,stderr:'pipe',maxBufferSize:L.responseFrameBytes});
 transport.stderr.on('data',b=>{stderr+=b;assert.ok(stderr.length<=L.diagnosticBytes);});
 const send=transport.send.bind(transport);transport.send=x=>{assert.ok(transcript.length<500);transcript.push(structuredClone(x));return send(x);};
 const client=new Client({name:'memoryos-windows-certification',version:'1.0.0'},{capabilities:{},versionNegotiation:{mode:{pin:'2026-07-28'}},inputRequired:{autoFulfill:false}});
 client.onerror=()=>{};await client.connect(transport,{timeout:30000});const pid=transport.pid;
 return {client,transport,transcript,pid,stderr:()=>stderr,async close(){await client.close();for(let i=0;i<200;i++){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH'){assert.equal(stderr,'');return;}throw e;}await delay(10);}throw Error('PROCESS_NOT_REAPED');}};
}
async function raw(options={}){
 const child=spawn(process.execPath,[...(options.flags??[]),resolve(root,'bin/memoryos-mcp.mjs')],{cwd:root,env:{...options.env},stdio:['pipe','pipe','pipe']});let pending=Buffer.alloc(0),stderr='',total=0;const frames=[];
 if(!options.unread)child.stdout.on('data',chunk=>{total+=chunk.length;assert.ok(total<=4*1024*1024);pending=Buffer.concat([pending,chunk]);let at;while((at=pending.indexOf(10))>=0){assert.ok(at+1<=L.responseFrameBytes);frames.push(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(pending.subarray(0,at))));pending=Buffer.from(pending.subarray(at+1));}});
 child.stderr.on('data',b=>{stderr+=b;assert.ok(stderr.length<=L.diagnosticBytes);});child.stdin.on('error',()=>{});
 const exited=new Promise((done,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>done({code,signal}));});
 const watchdog=setTimeout(()=>child.kill('SIGKILL'),90000);
 return {child,frames,exited,stderr:()=>stderr,send:x=>child.stdin.write(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)+'\n'),async next(i){for(let n=0;n<6000;n++){if(frames.length>i)return frames[i];if(child.exitCode!==null)throw Error('EARLY_EXIT:'+stderr);await delay(5);}throw Error('RESPONSE_TIMEOUT');},async end(expected=0){child.stdin.end();assert.deepEqual(await exited,{code:expected,signal:null});assert.equal(stderr,expected?'MO1304_FATAL\n':'');assert.equal(pending.length,0);clearTimeout(watchdog);},async close(){if(child.exitCode===null){child.kill();await exited;}child.stdout.destroy();clearTimeout(watchdog);}};
}
try{
 await test('os-tcp-egress-denial',async()=>{const r=spawnSync(process.execPath,[resolve(here,'external_network_probe.mjs')],{encoding:'utf8',env:{},timeout:15000,windowsHide:true});assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');return JSON.parse(r.stdout);});
 await test('network-guard-denial',async()=>{const r=spawnSync(process.execPath,[resolve(here,'network_guard_probe.mjs'),root],{encoding:'utf8',env:{},timeout:30000,windowsHide:true});assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');return JSON.parse(r.stdout);});
 const h=await official();
 try{
  await test('official-protocol-catalog',async()=>{const d=await h.client.discover(),listing=await h.client.listTools();const {resultType,...expectedDiscovery}=input.discovery;assert.equal(resultType,"complete");assert.deepEqual(d,expectedDiscovery);assert.equal(listing.ttlMs,0);assert.equal(listing.cacheScope,'private');assert.deepEqual(listing.tools,input.catalog);assert.equal(listing.tools.length,6);return {protocol:'2026-07-28',catalogSha256:sha(Buffer.from(J(listing.tools))),tools:listing.tools.map(x=>x.name)};});
  for(const vector of input.vectors)await test('semantic-'+vector.id,async()=>{const r=await h.client.callTool({name:vector.name,arguments:vector.arguments},{timeout:30000});assert.deepEqual(r.structuredContent,vector.expected);assert.deepEqual(r._meta,input.discovery._meta);assert.equal(r.content.length,1);assert.deepEqual(JSON.parse(r.content[0].text),r.structuredContent);assert.equal(r.isError,false);vectors.push({id:vector.id,canonicalProduct:J(r.structuredContent),sha256:sha(Buffer.from(J(r.structuredContent)))});return {sdkCLIReferenceParity:true,productSha256:sha(Buffer.from(J(r.structuredContent)))};});
  await test('stable-memoryos-failure',async()=>{const r=await h.client.callTool({name:'memoryos_prepare_policy',arguments:{policyBase64:'e30='}});assert.equal(r.structuredContent.error.origin,'memoryos');assert.equal(r.structuredContent.error.code,input.invalidMemoryOSCode);return r.structuredContent;});
  await test('invalid-tool-input',async()=>{const r=await h.client.callTool({name:'memoryos_contract_identities',arguments:{extra:true}});assert.equal(r.structuredContent.error.code,'MO1304_INVALID_TOOL_INPUT');});
  for(const vector of input.maximal)await test('maximal-'+vector.label,async()=>{const baseline=await rss(h.pid);let peak=baseline;let busy=false;const sampler=setInterval(async()=>{if(busy)return;busy=true;peak=Math.max(peak,await rss(h.pid));busy=false;},5);const start=performance.now();try{const r=await h.client.callTool({name:vector.name,arguments:vector.args},{timeout:30000});assert.equal(r.structuredContent.status,'ok',JSON.stringify(r.structuredContent));assert.ok(performance.now()-start<L.operationMs);assert.ok(peak-baseline<=L.parentAttributableBytes);return {durationMs:performance.now()-start,baselineRss:baseline,peakRss:peak,attributablePeak:peak-baseline,frozenParentBound:L.parentAttributableBytes};}finally{clearInterval(sampler);}});
  await test('official-busy-cancel-reuse',async()=>{
   const args={name:'memoryos_contract_identities',arguments:{}};const pair=await Promise.all([h.client.callTool(args),h.client.callTool(args)]);assert.deepEqual(pair.map(x=>x.structuredContent.status).sort(),['error','ok']);assert.equal(pair.find(x=>x.isError).structuredContent.error.code,'MO1304_BUSY');
   const abort=new AbortController(),at=h.transcript.length,pending=h.client.callTool(args,{signal:abort.signal,timeout:30000});const rejected=assert.rejects(pending);for(let i=0;i<1000&&!h.transcript.slice(at).some(x=>x.method==='tools/call');i++)await delay(1);abort.abort();await rejected;await h.client.discover();assert.equal((await h.client.callTool(args)).structuredContent.status,'ok');assert.ok(h.transcript.slice(at).some(x=>x.method==='notifications/cancelled'));
   for(const x of h.transcript.filter(x=>x.id!==undefined)){assert.equal(x.params._meta['io.modelcontextprotocol/protocolVersion'],'2026-07-28');assert.ok(x.params._meta['io.modelcontextprotocol/clientCapabilities']);assert.notEqual(x.method,'initialize');}
  });
 }finally{await h.close();}
 await test('official-restart-cleanup',async()=>{const r=await official();try{assert.notEqual(r.pid,h.pid);assert.equal((await r.client.callTool({name:'memoryos_contract_identities',arguments:{}})).structuredContent.status,'ok');}finally{await r.close();}});

 // Every case below starts the verified installed entry point through native OS pipes.
 const adversarial=[
  ['malformed-json','{bad}\n',-32700],['invalid-jsonrpc',JSON.stringify({...request(1,'server/discover'),jsonrpc:'1.0'})+'\n',-32600],
  ['batch','[]\n',-32600],['invalid-null-id',JSON.stringify(request(null,'server/discover'))+'\n',-32600],
  ['invalid-fractional-id',JSON.stringify(request(1.5,'server/discover'))+'\n',-32600],
  ['duplicate-keys','{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/list"}\n',-32700],
  ['missing-metadata',JSON.stringify({jsonrpc:'2.0',id:1,method:'server/discover',params:{}})+'\n',-32602],
  ['wrong-version',JSON.stringify(request(1,'server/discover',{_meta:{...meta,'io.modelcontextprotocol/protocolVersion':'2025-11-25'}}))+'\n',-32022],
  ['legacy-initialize',JSON.stringify(request(1,'initialize'))+'\n',-32022],
  ['unknown-method',JSON.stringify(request(1,'resources/read',{uri:'file:///home/mo1304/private'}))+'\n',-32601],
  ['unknown-tool',JSON.stringify(request(1,'tools/call',{name:'seventh_tool',arguments:{}}))+'\n',-32602],
  ['bom','\ufeff{}\n',-32600],['unpaired-surrogate','{"x":"\\ud800"}\n',-32700],
 ];
 for(const [id,bytes,code] of adversarial)await test('raw-'+id,async()=>{const r=await raw();try{r.send(bytes);assert.equal((await r.next(0)).error.code,code);await r.end();return {responseCode:code};}finally{await r.close();}});
 for(const delta of [-1,0,1]){
  await test('boundary-id-'+delta,async()=>{const r=await raw();try{r.send(request('i'.repeat(L.requestIdCodeUnits+delta),'server/discover'));const v=await r.next(0);if(delta>0)assert.equal(v.error.code,-32600);else assert.deepEqual(v.result,input.discovery);await r.end();}finally{await r.close();}});
  await test('boundary-metadata-'+delta,async()=>{const m={...meta,padding:''};m.padding='x'.repeat(L.metadataBytes-Buffer.byteLength(JSON.stringify(m))+delta);assert.equal(Buffer.byteLength(JSON.stringify(m)),L.metadataBytes+delta);const r=await raw();try{r.send(request(1,'server/discover',{_meta:m}));const v=await r.next(0);if(delta>0)assert.equal(v.error.code,-32602);else assert.deepEqual(v.result,input.discovery);await r.end();}finally{await r.close();}});
  for(const [name,render] of [
   ['jsonStringCodeUnits',n=>JSON.stringify('x'.repeat(n))],['jsonDepth',n=>'['.repeat(n-1)+'0'+']'.repeat(n-1)],
   ['jsonMembers',n=>JSON.stringify(Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,0])))],['jsonNodes',n=>JSON.stringify(Array(n-1).fill(0))]
  ])await test('boundary-'+name+'-'+delta,async()=>{const r=await raw();try{r.send(render(L[name]+delta)+'\n');const v=await r.next(0);assert.equal(v.error.code,delta>0?-32700:-32600);await r.end();return {limit:L[name],tested:L[name]+delta,parserAccepted:delta<=0};}finally{await r.close();}});
  for(const name of ['requestFrameBytes','inputChunkBytes'])await test('boundary-'+name+'-'+delta,async()=>{const body=JSON.stringify(request(1,'server/discover')),target=L[name]+delta,bytes=body+' '.repeat(target-body.length-1)+'\n';assert.equal(Buffer.byteLength(bytes),target);const r=await raw();try{r.send(bytes);if(name==='requestFrameBytes'&&delta>0)await r.end(1);else{assert.deepEqual((await r.next(0)).result,input.discovery);await r.end();}return {tested:target};}finally{await r.close();}});
  await test('boundary-arguments-'+delta,async()=>{const args={a:'x'.repeat(400000),b:''};args.b='x'.repeat(L.argumentsBytes-Buffer.byteLength(JSON.stringify(args))+delta);assert.equal(Buffer.byteLength(JSON.stringify(args)),L.argumentsBytes+delta);const r=await raw();try{r.send(request(1,'tools/call',{name:'memoryos_contract_identities',arguments:args}));assert.equal((await r.next(0)).result.structuredContent.error.code,'MO1304_INVALID_TOOL_INPUT');await r.end();return {tested:L.argumentsBytes+delta,rejectedBy:'closed tool schema before semantic admission'};}finally{await r.close();}});
 }
 for(const [id,options,bytes] of [
  ['invalid-utf8',{},Buffer.from([0xc0,0xaf,10])],['partial-eof',{},'{'],
  ['NODE_OPTIONS',{env:{NODE_OPTIONS:'--no-warnings'}},''],['NODE_PATH',{env:{NODE_PATH:'/tmp/unauthorized-module'}},''],
  ['preload',{flags:['--import=data:text/javascript,void%200']},''],['loader',{flags:['--no-warnings','--loader=data:text/javascript,export%20const%20resolve%20%3D%20(s%2Cc%2Cn)%3D%3En(s%2Cc)']},''],
  ['inspect-port',{flags:['--inspect-port=0']},'']
 ])await test('fatal-'+id,async()=>{const r=await raw(options);try{if(bytes.length)r.send(bytes);await r.end(1);assert.equal(r.frames.length,0);}finally{await r.close();}});
 await test('partial-frame-deadline',async()=>{const r=await raw();try{r.send(request(1,'server/discover'));await r.next(0);const start=performance.now();r.send('{');assert.deepEqual(await r.exited,{code:1,signal:null});const elapsed=performance.now()-start;assert.ok(elapsed>=L.partialFrameMs-100&&elapsed<L.partialFrameMs+3000);assert.equal(r.stderr(),'MO1304_FATAL\n');return {elapsedMs:elapsed,frozenMs:L.partialFrameMs};}finally{await r.close();}});
 for(const kind of ['request','control'])await test('flood-'+kind,async()=>{const r=await raw();try{r.send(request(1,'server/discover'));await r.next(0);const value=kind==='control'?{jsonrpc:'2.0',method:'notifications/ignored'}:{jsonrpc:'2.0',method:'tools/call',params:{}};r.send((JSON.stringify(value)+'\n').repeat(100));assert.deepEqual(await r.exited,{code:1,signal:null});assert.equal(r.stderr(),'MO1304_FATAL\n');return {sent:100,frozenRate:20};}finally{await r.close();}});
 for(const state of ['idle','active','cancelled','subscription','complete-error'])await test('eof-'+state,async()=>{const r=await raw();try{if(['active','cancelled'].includes(state))r.send(request('work','tools/call',{name:'memoryos_contract_identities',arguments:{}}));if(state==='cancelled')r.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:'work'}});if(state==='subscription')r.send(request('sub','subscriptions/listen',{notifications:{}}));if(state==='complete-error')r.send('{bad}\n');await r.end();if(['active','cancelled'].includes(state))assert.equal(r.frames.filter(x=>x.id==='work').length,0);}finally{await r.close();}});
 for(const mode of ['clean','subscription','partial-tail','drain-timeout'])await test('unread-pipe-'+mode,async()=>{const r=await raw({unread:true});try{const requests=[];if(mode==='subscription')requests.push(request('sub','subscriptions/listen',{notifications:{}}));for(let i=requests.length;i<20;i++)requests.push(request(i,'tools/list'));r.send(requests.map(x=>JSON.stringify(x)+'\n').join('')+(mode==='partial-tail'?'{':''));for(let i=0;i<6000&&!r.child.stdout.readableLength&&r.child.exitCode===null;i++)await delay(5);assert.ok(r.child.stdout.readableLength>0);const baseline=await rss(r.child.pid);let peak=baseline;const timer=setInterval(async()=>{peak=Math.max(peak,await rss(r.child.pid));},20);const start=performance.now();await delay(200);if(mode!=='drain-timeout')r.child.stdin.end();const fatal=['partial-tail','drain-timeout'].includes(mode);try{assert.deepEqual(await r.exited,{code:fatal?1:0,signal:null});}finally{clearInterval(timer);}assert.equal(r.stderr(),fatal?'MO1304_FATAL\n':'');assert.ok(peak-baseline<L.parentAttributableBytes);assert.ok(performance.now()-start<L.outputDrainMs+3000);return {stdoutUnread:true,peakRss:peak,attributablePeak:peak-baseline,elapsedMs:performance.now()-start};}finally{await r.close();}});
 await test('raw-cancel-id-reuse-subscription',async()=>{const r=await raw();try{r.send(request('work','tools/call',{name:'memoryos_contract_identities',arguments:{}}));r.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:'work'}});await delay(250);assert.equal(r.frames.length,0);r.send(request('work','server/discover'));assert.deepEqual((await r.next(0)).result,input.discovery);r.send(request('sub','subscriptions/listen',{notifications:{}}));assert.equal((await r.next(1)).method,'notifications/subscriptions/acknowledged');r.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:'sub'}});await delay(100);r.send(request('sub','subscriptions/listen',{notifications:{}}));assert.equal((await r.next(2)).method,'notifications/subscriptions/acknowledged');await r.end();}finally{await r.close();}});


 await test('installed-filesystem-and-supply-chain-boundary',async()=>{
  const auditPath=resolve(evidence+'.boundary.json'),bootstrap=resolve(here,'boundary_process.mjs');
  const guarded=await official([bootstrap,root,auditPath]);let operationCount=0;
  try{
   await guarded.client.listTools();
   for(const vector of input.vectors){const r=await guarded.client.callTool({name:vector.name,arguments:vector.arguments});assert.deepEqual(r.structuredContent,vector.expected);operationCount++;}
   for(const path of ['C:\\Windows\\win.ini','..\\secret','C:\\Users\\melsa\\private','C:\\workspace\\private','file:///C:/Windows/win.ini','http://127.0.0.1/private','http://host:80@private/','\\\\server\\share\\private','\\\\.\\PhysicalDrive0','C:\\private:stream']){
    const invalid=await guarded.client.callTool({name:'memoryos_contract_identities',arguments:{path,uri:path}});assert.equal(invalid.structuredContent.error.code,'MO1304_INVALID_TOOL_INPUT');
    const asArtifact=await guarded.client.callTool({name:'memoryos_prepare_policy',arguments:{policyBase64:Buffer.from(path).toString('base64')}});assert.equal(asArtifact.structuredContent.status,'error');assert.equal(asArtifact.structuredContent.error.origin,'memoryos');operationCount++;
   }
  }finally{await guarded.close();}
  const audit=JSON.parse(await readFile(auditPath));assert.equal(audit.code,0);assert.equal(audit.workers.length,operationCount);
  for(const a of [audit.parent,...audit.workers]){for(const key of ['network','filesystem','writes','shell','moduleFallback','validators'])assert.equal(a[key],0,key);assert.ok(a.reads>0);assert.ok(a.modules.length>0);assert.ok(a.modules.every(x=>!x.startsWith('..')));}
  return {instrumentation:'Trusted explicit bootstrap around unchanged installed parent and workers, supplemental to uninstrumented real-pipe semantic runs',osDenial:'External TCP EACCES observed in inherited host-provided process sandbox; loopback allowed; no OS UDP/DNS denial claim',limitation:'Non-elevated host; temporary zero-capability AppContainer denied TCP but could not load unchanged entry point due root metadata EPERM and was removed. No global network or ancestor ACL changes. API denial covers all observed semantic parent/worker network APIs.',workerOperations:operationCount,audit,windowsSpecificTestsClaimed:true};
 });


 await test('environment-selected-modules-executables',async()=>{
  const h=await official(undefined,{PATH:'/nonexistent',HOME:'/nonexistent',MEMORYOS_SDK_MODULE:'/nonexistent/hostile.mjs',MEMORYOS_POLICY_EXECUTABLE:'/nonexistent/hostile',MEMORYOS_EXECUTABLE:'/nonexistent/hostile',SHELL:'/nonexistent/hostile'});
  try{assert.deepEqual((await h.client.callTool({name:'memoryos_contract_identities',arguments:{}})).structuredContent,input.vectors[0].expected);}finally{await h.close();}
  return {absoluteTrustedNode:true,ambientExecutablesNotUsed:true,environmentSelectedModulesNotUsed:true};
 });
 await test('runtime-debug-injection',async()=>{
  const r=spawnSync(process.execPath,['--inspect=127.0.0.1:0',resolve(root,'bin/memoryos-mcp.mjs')],{env:{},cwd:root,input:'',encoding:'utf8',timeout:30000,maxBuffer:8192});
  assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(r.stderr.endsWith('MO1304_FATAL\n'));assert.ok(Buffer.byteLength(r.stderr)<=8192);
  return {exitCode:1,productDiagnosticBytes:13,nodePreEntryDiagnosticBytes:Buffer.byteLength(r.stderr)-13,networkFilterInherited:false,scope:'Unsupported debugger startup is rejected. Node may emit pre-entry diagnostics before the fixed product fatal line; no hostile-administrator protection is claimed.'};
 });


 await test('native-controls-during-active-semantic-operation',async()=>{
  const r=await raw();const waitId=async id=>{for(let i=0;i<6000;i++){const f=r.frames.find(x=>x.id===id);if(f)return f;await delay(5);}throw Error('CONTROL_RESPONSE_TIMEOUT');};
  try{
   r.send(request('sub','subscriptions/listen',{notifications:{}}));await r.next(0);
   const maximal=input.maximal.find(x=>x.label==='evaluate-policy');r.send(request('work','tools/call',{name:maximal.name,arguments:maximal.args}));
   r.send(request('busy','tools/call',{name:'memoryos_contract_identities',arguments:{}}));assert.equal((await waitId('busy')).result.structuredContent.error.code,'MO1304_BUSY');
   r.send(request('discover','server/discover'));assert.deepEqual((await waitId('discover')).result,input.discovery);
   r.send(request('list','tools/list'));assert.deepEqual((await waitId('list')).result.tools,input.catalog);
   assert.equal(r.frames.filter(x=>x.id==='work').length,0,'semantic operation remains pending while controls complete');
   r.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:'sub'}});r.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:'work'}});
   await delay(250);assert.equal(r.frames.filter(x=>x.id==='work').length,0);
   r.send(request('work','server/discover'));assert.deepEqual((await waitId('work')).result,input.discovery);
   r.send(request('sub','subscriptions/listen',{notifications:{}}));for(let i=0;i<1000&&r.frames.filter(x=>x.method==='notifications/subscriptions/acknowledged').length<2;i++)await delay(5);assert.equal(r.frames.filter(x=>x.method==='notifications/subscriptions/acknowledged').length,2);
   await r.end();return {busy:true,discoveryDuringSemantic:true,listingDuringSemantic:true,cancelledBeforePublication:true,semanticAndSubscriptionIdsReused:true};
  }finally{await r.close();}
 });
 await test('native-repeated-worker-cleanup-memory',async()=>{
  const h=await official(),samples=[];const threads=async()=>(await sample(h.pid,true)).threads;
  try{
   await h.client.callTool({name:'memoryos_contract_identities',arguments:{}});await delay(30);const settledThreads=await threads();
   for(let i=0;i<30;i++){const r=await h.client.callTool({name:'memoryos_contract_identities',arguments:{}});assert.deepEqual(r.structuredContent,input.vectors[0].expected);await delay(10);const count=await threads();assert.ok(count<=settledThreads+1);samples.push({rss:await rss(h.pid),threads:count});}
   const early=Math.max(...samples.slice(5,15).map(x=>x.rss)),late=Math.max(...samples.slice(20).map(x=>x.rss));assert.ok(late-early<L.parentAttributableBytes);
   return {operations:30,settledThreads,samples,earlyPeakRss:early,latePeakRss:late,retainedGrowth:late-early,frozenParentBound:L.parentAttributableBytes,allResponsesVerified:true};
  }finally{await h.close();}
 });

 record.status='PASS_EXECUTED_SUBSET';await save();
}catch(e){record.status='FAIL';await save();process.stderr.write(String(e.stack)+'\n');process.exitCode=1;}finally{metrics.stdin.end();assert.equal(metricError,'');}
