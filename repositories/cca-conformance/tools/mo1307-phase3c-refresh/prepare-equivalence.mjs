// Adapt the frozen correction harness for an independently executed security refresh.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='repositories/cca-conformance/tools/mo1307-phase3c-refresh';
const origin='repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/equivalence.mjs';
let s=fs.readFileSync(origin,'utf8');
function replace(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
replace("const root=process.cwd(), evidence='repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction', tools='repositories/cca-conformance/tools/mo1307-phase3a-readset-correction';", "const root=process.cwd(), correction='repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction', evidence='repositories/cca-conformance/evidence/mo1307/phase3c-refresh', tools='repositories/cca-conformance/tools/mo1307-phase3c-refresh';");
replace("const oldPath=evidence+'/oracle/b2-windows-inspect.ps1'", "const oldPath=correction+'/oracle/b2-windows-inspect.ps1'");
replace("const history='C:/Users/melsa/Documents/Codex/cca-mo1307-3a',ps=", "const ps=");
replace("pin(tools+'/equivalence.mjs')", "pin(tools+'/equivalence.mjs'),pin('"+origin+"')");
replace("fs.mkdirSync(scratch);", "fs.mkdirSync(scratch,{recursive:true});");
const start=s.indexOf("const moRequest=history+");const end=s.indexOf("const change=(name",start);assert.ok(start>0&&end>start);
s=s.slice(0,start)+`// Recreate exact historical contents locally to obey the exclusive r3c workspace.
// Only root changes; session, sequence, descriptors, ordering, limits and bytes stay fixed.
function localReplay(name,bundle){
 const base=correction+'/equivalence/attempt1/'+name;
 const requestSource=base+'/request.bin',responseSource=base+'/candidate.stdout.bin';
 sourceBindings.push(pin(requestSource),pin(responseSource));
 const original=read(requestSource),q=decodeHelperRequest(original),response=decodeHelperResponse(read(responseSource),q);
 const local=safe(path.join(scratch,name,'input'));fs.mkdirSync(local,{recursive:true});
 const inputs=[];
 for(const f of response.files){const d=q.files.find(x=>x.id===f.id),b=Buffer.from(f.bytes.join(''),'base64'),fixture='repositories/cca-conformance/fixtures/mo1307/bundles/'+bundle+'/'+d.path;
  assert.deepEqual(read(fixture),b);sourceBindings.push(pin(fixture));const p=safe(path.join(local,d.path));fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);inputs.push({id:f.id,path:d.path,byteLength:b.length,sha256:hash(b)});
 }
 const before=structuredClone(q);q.roots[0].path=local;
 const withoutRoot=x=>({...x,roots:x.roots.map(r=>({...r,path:'ROOT'}))});assert.deepEqual(withoutRoot(q),withoutRoot(before));
 write(output+'/'+name+'-local-rebinding.json',{historicalRequest:pin(requestSource),historicalRoot:before.roots[0].path,localRoot:local,requestOnlyRootRebound:true,historicalFrameReexecuted:false,inputs,reason:'All execution/fixture writes confined to r3c; compare both exact helper algorithms on identical local request and byte-identical historical file contents, using bounded engineering guard.'});
 return frame(q);
}
const moBytes=localReplay('mo1306-exact','mo1306-qualified'),readyBytes=localReplay('ready-exact','ready');
add('mo1306-exact',moBytes,null,{tags:['MO-1306 exact 65 contents and descriptors; local root rebound']});add('ready-exact',readyBytes,null,{tags:['READY exact contents and descriptors; local root rebound']});
`+s.slice(end);
replace("read(moRequest)","moBytes");
const insertion=`
// Additional refresh controls close alternate entry paths and canonical wire boundaries.
change('reserved-device',q=>q.files[0].path='NUL.txt');
change('dot-path-alias',q=>q.files[0].path='./leaf.data');
change('backslash-relative',q=>q.files[0].path='sub\\\\leaf.data');
add('forward-separator-root',req(ordinary.replaceAll('\\\\','/')),null,{tags:['alternate root separator accepted canonicalization']});
change('wrong-version',q=>q.version='1.0.0','MO1307_INPUT');
change('unknown-field',q=>q.script='C3R_SECRET_SENTINEL','MO1307_INPUT');
change('oversized-file',q=>q.files[0].maxBytes=1,'MO1307_RESOURCE_LIMIT');
const validFrame=frame(req(ordinary));
for(const [name,b,code] of [
 ['truncated-length',validFrame.subarray(0,3),'MO1307_INPUT'],
 ['truncated-frame',validFrame.subarray(0,validFrame.length-1),'MO1307_INPUT'],
 ['extra-frame',Buffer.concat([validFrame,validFrame]),'MO1307_INPUT'],
 ['trailing-bytes',Buffer.concat([validFrame,Buffer.from('x')]),'MO1307_INPUT'],
 ['oversized-length',Buffer.from([0,1,0,0]),'MO1307_RESOURCE_LIMIT'],
 ['debug-prefix',Buffer.concat([Buffer.from('debug'),validFrame]),'MO1307_RESOURCE_LIMIT']])add(name,b,code,{tags:['wire refusal']});
for(const [operation,sequence] of [['CHECK_OUTPUT',4],['CHECK_OUTPUT',5],['INSPECT_OUTPUT_ROOT',6],['CHECK_STAGE_ROOT',7],['INSPECT_PENDING',8],['CHECK_FINALIZATION',9]]){
 const name=operation.toLowerCase()+'-'+sequence,outputRoot=safe(path.join(scratch,'pub-'+name,'output'));
 fs.mkdirSync(path.dirname(outputRoot),{recursive:true});if(operation!=='CHECK_OUTPUT'){fs.mkdirSync(outputRoot);fs.writeFileSync(path.join(outputRoot,'memoryos-readiness-result.json.pending'),'pending boundary bytes');}
 const q={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',operation,sequence,session,roots:[{id:'output',path:outputRoot}],files:[]};
 add('publication-'+name,q,null,{tags:['alternate production acquisition caller success']});
 const bad=structuredClone(q);bad.roots[0].path+='\\\\..\\\\output';add('publication-'+name+'-traversal',bad,'MO1307_FILESYSTEM_BOUNDARY',{tags:['alternate production entry path validation']});
}
`;
replace("const immutableFiles=[];",insertion+"\nconst immutableFiles=[];");
replace("assert.equal(response.status,c.expectedCode?'ERROR':'OK');", "assert.equal(response.status,c.expectedCode?'ERROR':c.request.operation==='CHECK_OUTPUT'?'ABSENT':c.request.operation==='CHECK_FINALIZATION'?'FINAL_ABSENT':'OK');");
// Extra final path values are perturbed before the original native-prefix and full equality checks.
replace("['control','\\u0001']", "['control','\\u0001'],['alternate-root',''],['bad-prefix','']");
replace("'observed-control' { $observed += [char]1 }", "'observed-control' { $observed += [char]1 }\n                'observed-alternate-root' { $observed = $observed.Replace('C:', 'Z:') }\n                'observed-bad-prefix' { $observed = $observed.Substring(4) }");
replace("originalRootsForMO1306AndReady:true", "originalRootsForMO1306AndReady:false,historicalContentsAndDescriptorsPreserved:true,localRootRebinding:true");
replace("requestRootsUnchangedForHistoricalCases:true", "requestRootsUnchangedForHistoricalCases:false,localRootRebinding:true");
fs.writeFileSync(dir+'/equivalence.mjs',s.replaceAll('\r\n','\n'),{flag:'wx'});
console.log('Created independent rerun harness with local historical content rebinding and expanded alternate-flow controls.');
