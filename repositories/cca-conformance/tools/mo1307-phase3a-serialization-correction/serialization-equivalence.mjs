// Finite engineering-only serializer oracle. Never executes Initialize-Native,
// request acquisition, console ownership, native calls, or the product helper.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const tool = 'repositories/cca-conformance/tools/mo1307-phase3a-serialization-correction';
const evidence = 'repositories/cca-conformance/evidence/mo1307/phase3a-serialization-correction';
const oraclePath = evidence + '/oracle/c3rb-windows-inspect.ps1';
const candidatePath = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const ps = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const ceiling = 16777216, engineeringGuardMs = 240000, replyGuardMs = 90000;
const hash = b => 'sha256:' + crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.resolve(root, p));
const pin = p => {const b = read(p); return {path:p.replaceAll('\\','/'), byteLength:b.length, sha256:hash(b)};};
const write = (p,v) => fs.writeFileSync(path.resolve(root,p), JSON.stringify(v,null,2)+'\n', {flag:'wx'});
const bodyFrame = body => {const header=Buffer.alloc(4); header.writeUInt32BE(body.length); return Buffer.concat([header,body]);};
const canonicalFrame = value => bodyFrame(canonicalBytes(value,{maxBytes:ceiling+4096,stage:'ACQUISITION'}));
const normalize = text => text.replaceAll('\r\n','\n');
let setupOutput = null;

function functionsOf(source) {
  const map = new Map();
  for (const match of source.matchAll(/^function ([A-Za-z][A-Za-z-]*)[^\n]*\{[\s\S]*?^\}/gm)) {
    assert.ok(!map.has(match[1])); map.set(match[1],match[0]);
  }
  return map;
}
function extract(source, extra) {
  const functions=functionsOf(source), names=['Reject-Protocol','Encode-String','Encode-Value',...extra];
  for(const name of names) assert.ok(functions.has(name),'Missing serializer function '+name);
  const marker='try {\n    $response = [pscustomobject]';
  const start=source.indexOf(marker); assert.ok(start>=0); assert.equal(source.indexOf(marker,start+1),-1);
  const footer=source.slice(start); assert.ok(footer.endsWith('exit 0\n'));
  const executableFooter=footer.slice(0,-'exit 0\n'.length);
  // The exact production final response construction, catch, UTF-8 sizing,
  // big-endian prefix, both writes and flush execute against a MemoryStream.
  const script='param($State)\nSet-StrictMode -Version 2.0\n$ErrorActionPreference = \'Stop\'\n'+names.map(n=>functions.get(n)).join('\n\n')+
    '\n$responseCeiling = 16777216\n$code = $State.code\n$operation = $State.operation\n$sequence = $State.sequence\n$session = $State.session\n$nativeResult = $State.nativeResult\n$savedStdout = [IO.MemoryStream]::new()\n'+executableFooter+
    '\n$completeFrame = $savedStdout.ToArray()\n$savedStdout.Dispose()\nreturn ,$completeFrame\n';
  assert.ok(!script.includes('Initialize-Native')); assert.ok(!script.includes('Open-Native'));
  return {functions,footer,script,names};
}
const pattern=Buffer.from(Array.from({length:256},(_,i)=>i));
const chunksOf = size => {const encoded=Buffer.alloc(size,pattern).toString('base64'), chunks=[]; for(let i=0;i<encoded.length;i+=4096)chunks.push(encoded.slice(i,i+4096));return chunks;};
const identity = (byteLength,isDirectory,finalPath,number=1) => ({attributes:isDirectory?16:32,byteLength,fileId:number.toString(16).padStart(16,'0'),finalPath,isDirectory,linkCount:1,volumeSerial:'00000001'});
function mutationValue(m) {
  if(m.kind==='integer'||m.kind==='double')return Number(m.value);
  if(m.kind==='boolean')return m.value;
  if(m.kind==='null')return null;
  const values={ascii:'ordinary ASCII value',quotes:'C:\\quoted"segment\\leaf',backslashes:'\\\\server\\share\\a\\b',empty:'',
    unicode:'C:\\\u00e9\u03a9\u4e2d\u2028\u2029','paired-surrogate':'C:\\\ud83d\ude00','lone-high':'C:\\\ud83d','lone-low':'C:\\\ude00',
    nul:'C:\\\0',control:'C:\\\u001f',newline:'C:\\\nleaf',del:'C:\\\u007f','length-4096':'x'.repeat(4096),'length-4097':'x'.repeat(4097)};
  assert.ok(Object.hasOwn(values,m.value));return values[m.value];
}
function stateOf(c) {
  const files=[],roots=[];
  if(c.operation==='READ_SET') {
    for(const id of c.rootIds)roots.push({id,identity:identity(0,true,id==='input'?'C:\\root':'D:\\result')});
    c.fileLengths.forEach((size,index)=>files.push({id:'file'+String(index).padStart(3,'0'),identity:identity(size,false,(c.rootIds.length>1&&index%2?'D:\\result':'C:\\root')+'\\f'+index+'.bin',index+16),bytes:chunksOf(size)}));
  } else {
    const pending=['INSPECT_PENDING','CHECK_FINALIZATION'].includes(c.operation),chain=[];
    let current='C:\\';
    for(let i=0;i<c.chainLength;i++) {
      const directory=!(pending&&i===c.chainLength-1);
      if(i)current=current.replace(/\\$/,'')+(directory?'\\a':'\\memoryos-readiness-result.json.pending');
      chain.push(identity(directory?0:17,directory,current,i+1));
    }
    roots.push({id:c.operation==='CHECK_OUTPUT'?'output-parent':pending?'pending':'output',chain});
  }
  if(c.frameFill) {
    files[0].bytes=Array(c.frameFill.fullChunks).fill(Buffer.alloc(3072).toString('base64'));
    if(c.frameFill.tailChars)files[0].bytes.push(Buffer.alloc(c.frameFill.tailChars/4*3).toString('base64'));
    files[0].identity.finalPath+='x'.repeat(c.frameFill.pathPadding);
  }
  const state={code:c.code,operation:c.operation,sequence:c.sequence,session:(c.earlyDefaults?'0':'b').repeat(64),nativeResult:{files,roots,status:c.operation==='CHECK_OUTPUT'?'ABSENT':c.operation==='CHECK_FINALIZATION'?'FINAL_ABSENT':'OK'}};
  if(c.mutation) {
    const m=c.mutation,value=mutationValue(m);
    if(m.target==='fileIdentity')files[0].identity[m.field]=value;
    else if(m.target==='file')files[0][m.field]=value;
    else if(m.target==='root')roots[0][m.field]=value;
    else if(m.target==='outer')state[m.field]=value;
    else if(m.target==='nativeResult')state.nativeResult[m.field]=value;
    else if(m.target==='chunk')files[0].bytes=[value];
    else assert.fail('Unknown mutation target');
  }
  return state;
}
function responseOf(state) {
  return {code:state.code,files:state.code===null?state.nativeResult.files:[],kind:'MemoryOSReadinessHelperResponse',operation:state.operation,
    roots:state.code===null?state.nativeResult.roots:[],sequence:state.sequence,session:state.session,status:state.code===null?state.nativeResult.status:'ERROR',version:'2.0.0'};
}
function expectedFrame(c) {
  const state=stateOf(c),response=responseOf(state);
  let fallback=false,frame;
  try {frame=canonicalFrame(response); if(frame.length>ceiling)fallback=true;}catch{fallback=true;}
  // A nonintegral CLR Double and an integral CLR Double are both rejected by
  // the original PS encoder; JS Number cannot express that CLR type distinction.
  if(c.mutation?.kind==='double')fallback=true;
  assert.equal(fallback,c.expectedFallback,'Independent planned fallback classification '+c.id);
  if(fallback)frame=canonicalFrame({code:'MO1307_RESOURCE_LIMIT',files:[],kind:'MemoryOSReadinessHelperResponse',operation:state.operation,roots:[],sequence:state.sequence,session:state.session,status:'ERROR',version:'2.0.0'});
  return {frame,fallback,response:fallback?JSON.parse(frame.subarray(4).toString('utf8')):response};
}
function protocolRequest(c, response) {
  if(c.mutation||c.frameFill||c.earlyDefaults||c.chainLength===120||c.rootIds.length!==1||c.sequence===1||c.fileLengths.some(n=>n>2097152))return null;
  const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',operation:c.operation,sequence:c.sequence,session:'b'.repeat(64),roots:[],files:[]};
  if(c.operation==='READ_SET') {
    request.roots=[{id:'input',path:'C:\\root'}];
    request.files=c.fileLengths.map((size,index)=>({id:'file'+String(index).padStart(3,'0'),root:'input',path:'f'+index+'.bin',maxBytes:size}));
  } else {
    // Use the independently constructed success shape for ERROR request roots.
    const shape=c.code===null?response:responseOf(stateOf({...c,code:null}));
    const chain=shape.roots[0].chain,pending=['INSPECT_PENDING','CHECK_FINALIZATION'].includes(c.operation);
    let destination=pending?chain.at(-2).finalPath:chain.at(-1).finalPath;
    if(c.operation==='CHECK_OUTPUT')destination=destination.replace(/\\$/,'')+'\\output';
    request.roots=[{id:'output',path:destination}];
  }
  return request;
}
function makeCases() {
  const cases=[];
  const add=(id,changes={})=>{const c={id,operation:'READ_SET',sequence:3,rootIds:['input'],fileLengths:[3],chainLength:3,code:null,earlyDefaults:false,
    mutation:null,frameFill:null,expectedFallback:false,scope:'PURE_CLOSED_RESPONSE_ENCODER',...changes};cases.push(c);return c;};
  const operations=[['READ_SET',3],['CHECK_OUTPUT',4],['INSPECT_OUTPUT_ROOT',6],['CHECK_STAGE_ROOT',7],['INSPECT_PENDING',8],['CHECK_FINALIZATION',9]];
  for(const [operation,sequence] of operations)add('operation-'+operation.toLowerCase().replaceAll('_','-'),{operation,sequence});
  add('read-set-no-files',{fileLengths:[]});add('read-set-two-roots-order',{rootIds:['input','result'],fileLengths:[1,2,3]});
  add('inspection-chain-one',{operation:'INSPECT_OUTPUT_ROOT',sequence:6,chainLength:1});
  add('inspection-chain-120',{operation:'INSPECT_OUTPUT_ROOT',sequence:6,chainLength:120,scope:'SYNTHETIC_ENCODER_BOUNDARY_NOT_NATIVE_ACQUISITION'});
  for(const n of [0,1,2,3,3071,3072,3073,6143,6144,6145,65535,65536,65537,2097151,2097152,4194303,4194304])add('payload-'+n,{fileLengths:[n]});
  add('aggregate-8388608',{fileLengths:[2097152,2097152,2097152,2097152]});
  for(const [operation,sequence] of operations)for(const code of ['MO1307_INPUT','MO1307_FILESYSTEM_BOUNDARY','MO1307_RESOURCE_LIMIT','MO1307_INTERNAL'])add('error-'+operation.toLowerCase().replaceAll('_','-')+'-'+code.slice(7).toLowerCase().replaceAll('_','-'),{operation,sequence,code});
  add('early-default-error',{operation:'READ_SET',sequence:1,code:'MO1307_INPUT',earlyDefaults:true});
  for(const value of ['ascii','quotes','backslashes','empty','unicode','paired-surrogate','lone-high','lone-low','nul','control','newline','del','length-4096','length-4097'])add('dynamic-final-path-'+value,{mutation:{target:'fileIdentity',field:'finalPath',kind:'string',value},expectedFallback:['lone-high','lone-low','nul','control','newline','del','length-4097'].includes(value),scope:'SYNTHETIC_STRING_ENCODER_EDGE_NOT_NATIVE_PATH'});
  for(const [target,field] of [['file','id'],['root','id'],['fileIdentity','fileId'],['fileIdentity','volumeSerial'],['outer','operation'],['outer','session'],['outer','code'],['nativeResult','status']])add('dynamic-'+target.toLowerCase()+'-'+field.toLowerCase(),{mutation:{target,field,kind:'string',value:'quotes'},code:field==='operation'?'MO1307_INPUT':null,scope:'SYNTHETIC_DYNAMIC_STRING_FIELD'});
  for(const value of ['0','2147483647','2147483648','4294967295','9007199254740991','-1','9007199254740992'])add('integer-'+value.replace('-','negative-'),{mutation:{target:'fileIdentity',field:'byteLength',kind:'integer',value},expectedFallback:value==='-1'||value==='9007199254740992',scope:'SYNTHETIC_INTEGER_ENCODER_EDGE'});
  for(const value of ['1','1.5'])add('double-'+value.replace('.','-'),{mutation:{target:'fileIdentity',field:'byteLength',kind:'double',value},expectedFallback:true,scope:'SYNTHETIC_UNSUPPORTED_CLR_TYPE'});
  for(const value of [false,true])add('boolean-'+value,{mutation:{target:'fileIdentity',field:'isDirectory',kind:'boolean',value}});
  add('chunk-length-4097-refusal',{mutation:{target:'chunk',field:'bytes',kind:'string',value:'length-4097'},expectedFallback:true,scope:'SYNTHETIC_INTERNAL_CHUNK_LENGTH_FAILURE'});
  for(const delta of [-1,0,1]) {
    const c=add('frame-ceiling-'+(delta===0?'exact':delta<0?'minus-one':'plus-one'),{fileLengths:[0],expectedFallback:delta>0,scope:'SYNTHETIC_SERIALIZER_SIZE_BOUNDARY_NOT_NATIVE_ADMISSIBLE_PAYLOAD'});
    const target=ceiling+delta,base=canonicalFrame(responseOf(stateOf(c))).length,addition=target-base;
    const fullChunks=Math.floor((addition+1)/4099),remaining=addition-(4099*fullChunks-1);
    const tailChars=remaining>=7?Math.floor((remaining-3)/4)*4:0;
    const pathPadding=remaining-(tailChars?tailChars+3:0);
    c.frameFill={fullChunks,tailChars,pathPadding,targetFrameBytes:target};
    assert.equal(canonicalFrame(responseOf(stateOf(c))).length,target);
  }
  assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);return cases;
}

async function main() {
  assert.ok(process.argv.length===2||(process.argv.length===4&&process.argv[2]==='--output'));
  const output=(process.argv[3]??evidence+'/serialization/attempt1').replaceAll('\\','/');
  assert.ok(output.startsWith(evidence+'/serialization/')&&!output.split('/').includes('..'));
  assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
  assert.equal(pin(process.execPath).sha256,'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
  assert.equal(fs.existsSync(path.resolve(root,output)),false);fs.mkdirSync(path.resolve(root,output),{recursive:true});
  setupOutput=output;
  const scratch='.cache/mo1307/phase3a-serialization-correction/serialization-equivalence/'+path.basename(output);
  assert.equal(fs.existsSync(path.resolve(root,scratch)),false);fs.mkdirSync(path.resolve(root,scratch,'frames'),{recursive:true});
  const oldBytes=read(oraclePath),newBytes=read(candidatePath);
  assert.equal(oldBytes.length,30210);assert.equal(hash(oldBytes),'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8');
  const oldSource=normalize(oldBytes.toString('utf8')),newSource=normalize(newBytes.toString('utf8'));
  const old=extract(oldSource,[]),current=extract(newSource,['Encode-Identity','Encode-Response']);
  const functionRows=[];
  for(const [name,source] of old.functions) {assert.equal(current.functions.get(name),source,'Original function changed: '+name);functionRows.push({name,unchanged:true,sha256:hash(Buffer.from(source))});}
  assert.deepEqual([...current.functions.keys()].filter(n=>!old.functions.has(n)).sort(),['Encode-Identity','Encode-Response']);
  assert.equal(current.footer.replace('(Encode-Response $response)','(Encode-Value $response)'),old.footer,'Unexpected final response/footer edit');
  const stripNew=s=>s.replace(current.functions.get('Encode-Identity'),'').replace(current.functions.get('Encode-Response'),'').replace('(Encode-Response $response)','(Encode-Value $response)').split('\n').filter(l=>l.trim()&&!l.trimStart().startsWith('#')).join('\n');
  assert.equal(stripNew(newSource),oldSource.split('\n').filter(l=>l.trim()&&!l.trimStart().startsWith('#')).join('\n'),'Non-comment source outside allowed serializer additions changed');
  const enginePaths={oracle:scratch+'/oracle-engine.ps1',candidate:scratch+'/candidate-engine.ps1'};
  fs.writeFileSync(path.resolve(root,enginePaths.oracle),old.script,{flag:'wx'});fs.writeFileSync(path.resolve(root,enginePaths.candidate),current.script,{flag:'wx'});
  const cases=makeCases();
  const sourceBindings=[oraclePath,candidatePath,tool+'/serialization-equivalence.mjs',tool+'/serialization-cases.ps1',
    'repositories/memoryos-readiness/src/canonical.mjs','repositories/memoryos-readiness/src/errors.mjs','repositories/memoryos-readiness/src/constants.mjs',
    'repositories/memoryos-readiness/src/helper-protocol.mjs','repositories/memoryos-readiness/src/windows-paths.mjs','repositories/memoryos-readiness/src/foundation.mjs',
    'repositories/memoryos-readiness/src/schema.mjs','repositories/memoryos-readiness/src/schema-data.mjs'].map(pin);
  const runtimeBindings=[pin(process.execPath),pin(ps)];
  write(output+'/campaign.json',{kind:'MO1307C3SSerializerEquivalencePlan',version:'1.0.0',declaredAt:new Date().toISOString(),sourceBindings,runtimeBindings,
    caseCount:cases.length,expectedCases:cases.length,cases,engineSources:{oracle:pin(enginePaths.oracle),candidate:pin(enginePaths.candidate)},engineeringGuardMs,replyGuardMs,
    processCount:1,nativeHelperLaunches:0,productClocksUsed:false,retries:0,stopOnFirstMismatch:true,rawFrames:scratch+'/frames',
    scope:'Actual extracted serializer functions and production response construction/fallback/frame writes, captured only in an engineering MemoryStream. Synthetic encoder cases do not claim native-path admission or runtime certification.'});
  write(output+'/source-equivalence.json',{result:'PASS',sourceBindings,originalFunctions:functionRows,addedFunctions:['Encode-Identity','Encode-Response'],
    originalFunctionsUnchanged:true,requestCanonicalizationUnchanged:true,footerOnlyCallReplacement:true,otherExecutableSourceUnchanged:true,nativeFunctionsExecuted:false});
  const started=performance.now(),rows=[],stdout=[],stderr=[];let result='PASS',failure=null,child=null,exit=null;
  let waiters=[],events=[],ended=false,engineError=null,stdoutBytes=0;
  const publish=e=>{if(waiters.length)waiters.shift().resolve(e);else events.push(e);};
  const next=()=>events.length?Promise.resolve(events.shift()):ended?Promise.reject(engineError??new Error('Engineering process ended before reply')):new Promise((resolve,reject)=>{
    const waiter={resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
    const timer=setTimeout(()=>{waiters=waiters.filter(w=>w!==waiter);reject(new Error('ENGINEERING_REPLY_GUARD'));},replyGuardMs);waiters.push(waiter);
  });
  let guard;
  try {
    child=spawn(ps,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve(root,tool+'/serialization-cases.ps1'),
      '-OracleEngine',path.resolve(root,enginePaths.oracle),'-CandidateEngine',path.resolve(root,enginePaths.candidate),'-FrameDirectory',path.resolve(root,scratch,'frames')],
      {cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true,stdio:['pipe','pipe','pipe']});
    const close=new Promise(resolve=>child.once('close',(code,signal)=>{exit={code,signal};ended=true;for(const w of waiters.splice(0))w.reject(engineError??new Error('ENGINEERING_PROCESS_CLOSED'));resolve(exit);}));
    child.once('error',error=>{engineError=error;for(const w of waiters.splice(0))w.reject(error);});
    child.stdin.on('error',error=>{engineError??=error;for(const w of waiters.splice(0))w.reject(error);});
    child.stderr.on('data',b=>{stderr.push(Buffer.from(b));if(Buffer.concat(stderr).length>65536){engineError=new Error('ENGINEERING_STDERR_LIMIT');child.kill();}});
    const rl=createInterface({input:child.stdout});
    rl.on('line',line=>{stdout.push(line);try{stdoutBytes+=Buffer.byteLength(line)+1;assert.ok(Buffer.byteLength(line)<65536&&stdoutBytes<=524288);publish(JSON.parse(line));}catch(error){engineError=error;child.kill();}});
    guard=setTimeout(()=>{engineError=new Error('ENGINEERING_TOTAL_GUARD');child.kill();},engineeringGuardMs);
    const ready=await next();assert.equal(ready.event,'ready');assert.equal(ready.nativeInitialization,false);assert.equal(ready.is64Bit,true);write(output+'/engine-ready.json',ready);
    for(const spec of cases) {
      const expected=expectedFrame(spec),at=performance.now();
      child.stdin.write(JSON.stringify({command:'case',spec})+'\n');
      const observed=await next();
      let caseFailure=null,oracleFrame,candidateFrame,protocolDecoded=false;
      try {
        assert.equal(observed.event,'case');assert.equal(observed.id,spec.id);
        const allowed=path.resolve(root,scratch,'frames')+path.sep;
        for(const p of [observed.oracle.path,observed.candidate.path])assert.ok(path.resolve(p).startsWith(allowed));
        oracleFrame=fs.readFileSync(observed.oracle.path);candidateFrame=fs.readFileSync(observed.candidate.path);
        for(const [p,b] of [[observed.oracle,oracleFrame],[observed.candidate,candidateFrame]]){assert.equal(b.length,p.byteLength);assert.equal(hash(b),p.sha256);}
        assert.equal(observed.exactEquality,true,'PowerShell complete-byte equality');
        assert.ok(oracleFrame.equals(candidateFrame),'Node complete-byte equality');
        assert.ok(oracleFrame.equals(expected.frame),'Independent canonical complete-frame oracle');
        assert.equal(oracleFrame.readUInt32BE(0),oracleFrame.length-4);assert.equal(oracleFrame.at(-1),10);
        assert.ok(oracleFrame.length<=ceiling);assert.notDeepEqual([...oracleFrame.subarray(4,7)],[239,187,191]);
        const request=protocolRequest(spec,expected.response);
        if(request) {decodeHelperResponse(oracleFrame,request);decodeHelperResponse(candidateFrame,request);protocolDecoded=true;}
      } catch(error) {caseFailure={message:error.message};}
      const row={id:spec.id,result:caseFailure?'FAIL':'PASS',expectedFallback:spec.expectedFallback,scope:spec.scope,elapsedMs:performance.now()-at,
        observed,protocolDecoded,independentExpected:{byteLength:expected.frame.length,sha256:hash(expected.frame),code:expected.response.code,status:expected.response.status},failure:caseFailure};
      if(oracleFrame&&oracleFrame.length<=8192) {
        for(const [label,bytes] of [['oracle',oracleFrame],['candidate',candidateFrame]]) {const p=output+'/'+spec.id+'.'+label+'.bin';fs.writeFileSync(path.resolve(root,p),bytes,{flag:'wx'});row[label+'Retained']=pin(p);}
      }
      rows.push(row);write(output+'/'+spec.id+'.json',row);
      if(caseFailure)throw new Error('SERIALIZATION_EQUIVALENCE_STOP: '+spec.id+': '+caseFailure.message);
    }
    child.stdin.end(JSON.stringify({command:'stop'})+'\n');
    assert.equal((await next()).event,'stopped');await close;assert.equal(exit.code,0);assert.equal(exit.signal,null);assert.equal(Buffer.concat(stderr).length,0);
  } catch(error) {
    result='FAIL';failure={message:error.message,code:error.code??null};
    if(child&&!ended) {
      child.stdin.end(JSON.stringify({command:'stop'})+'\n');
      await Promise.race([new Promise(resolve=>child.once('close',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);
      if(!ended) {child.kill();await Promise.race([new Promise(resolve=>child.once('close',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);}
    }
  } finally {clearTimeout(guard);}
  for(const source of [...sourceBindings,...runtimeBindings]) {try{assert.deepEqual(pin(source.path),source);}catch(error){result='FAIL';failure??={message:'SOURCE_OR_RUNTIME_CHANGED: '+source.path};}}
  fs.writeFileSync(path.resolve(root,output,'engine.stdout.jsonl'),stdout.join('\n')+'\n',{flag:'wx'});
  fs.writeFileSync(path.resolve(root,output,'engine.stderr.data'),Buffer.concat(stderr),{flag:'wx'});
  write(output+'/receipt.json',{kind:'MO1307C3SSerializerEquivalenceReceipt',version:'1.0.0',result,failure,declaredCases:cases.length,expectedCases:cases.length,executedCases:rows.length,
    passedCases:rows.filter(r=>r.result==='PASS').length,failedCases:rows.filter(r=>r.result==='FAIL').length,unexecuted:cases.slice(rows.length).map(c=>c.id),
    elapsedMs:performance.now()-started,sourceBindings,runtimeBindings,exit,cases:rows.map(r=>({id:r.id,result:r.result,protocolDecoded:r.protocolDecoded,receipt:pin(output+'/'+r.id+'.json')})),
    sourceEquivalence:pin(output+'/source-equivalence.json'),campaign:pin(output+'/campaign.json'),stdout:pin(output+'/engine.stdout.jsonl'),stderr:pin(output+'/engine.stderr.data'),
    completeByteComparison:true,independentExpectedFrames:true,nativeHelperLaunches:0,nativeSecurityCertification:false,performanceCertification:false,productLimitsChanged:false,retries:0});
  console.log(JSON.stringify({result,cases:rows.length,declared:cases.length,failure}));process.exitCode=result==='PASS'?0:1;
}
main().catch(error=>{
  const failure={result:'FAIL',stage:'ENGINEERING_SETUP',message:error.message,nativeHelperLaunches:0,executedCases:0,notEquivalenceAcceptance:true};
  if(setupOutput&&!fs.existsSync(path.resolve(root,setupOutput,'receipt.json')))write(setupOutput+'/receipt.json',failure);
  console.error(JSON.stringify(failure));process.exitCode=1;
});
