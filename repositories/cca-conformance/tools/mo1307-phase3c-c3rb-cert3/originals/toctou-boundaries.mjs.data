// Fresh before-read and held-to-reopened mutation controls, engineering copies only.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
const ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2',out=ev+'/toctou-boundaries/attempt1';fs.mkdirSync(out,{recursive:true});
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex'),pin=p=>{const b=fs.readFileSync(p);return{path:p,byteLength:b.length,sha256:hash(b)}};
const old='repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/oracle/b2-windows-inspect.ps1',candidate='repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',rows=[],sourceBindings=[pin(old),pin(candidate),pin('repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert2/toctou-boundaries.mjs')];
const scratch=path.resolve('.cache/c3r-toctou-'+process.pid);fs.mkdirSync(scratch,{recursive:true});
const quote=s=>"'"+s.replaceAll("'","''")+"'",frame=q=>{const b=canonicalBytes(q),h=Buffer.alloc(4);h.writeUInt32BE(b.length);return Buffer.concat([h,b])};
async function run(script,request,prefix){const outputs=[],errors=[];let timedOut=false;const result=await new Promise((resolve,reject)=>{const c=spawn(ps,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve(script)],{windowsHide:true,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},stdio:['pipe','pipe','pipe']});const timer=setTimeout(()=>{timedOut=true;c.kill()},20000);c.on('error',reject);c.stdout.on('data',b=>outputs.push(b));c.stderr.on('data',b=>errors.push(b));c.stdin.on('error',()=>{});c.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,pid:c.pid,closeObserved:true})});c.stdin.end(request)});const stdout=Buffer.concat(outputs),stderr=Buffer.concat(errors);fs.writeFileSync(prefix+'.stdout.bin',stdout);fs.writeFileSync(prefix+'.stderr.bin',stderr);assert.equal(timedOut,false);assert.equal(result.code,0);assert.equal(stderr.length,0);assert.equal(stdout.readUInt32BE(0),stdout.length-4);assert.equal(JSON.parse(stdout.subarray(4)).code,'MO1307_FILESYSTEM_BOUNDARY');return{...result,stdout:pin(prefix+'.stdout.bin'),stderr:pin(prefix+'.stderr.bin'),helper:pin(script),frame:stdout};}
for(const mode of ['before-read-replacement','held-to-fresh-replacement']){
 fs.writeFileSync(out+'/active-case.json',JSON.stringify({id:mode,expectedCode:'MO1307_FILESYSTEM_BOUNDARY'})+'\n');const dir=path.join(scratch,mode);fs.mkdirSync(dir);const leaf=path.join(dir,'leaf.data');
 const request=frame({kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',operation:'READ_SET',sequence:3,session:'e'.repeat(64),roots:[{id:'input',path:dir}],files:[{id:'leaf',root:'input',path:'leaf.data',maxBytes:256}]});
 const folder=out+'/'+mode;fs.mkdirSync(folder);fs.writeFileSync(folder+'/request.bin',request);const pair=[];
 for(const [side,src]of[['b2',old],['candidate',candidate]]){
  if(fs.existsSync(leaf))fs.renameSync(leaf,leaf+'.retained-'+side);fs.writeFileSync(leaf,'same content and length\n');
  let s=fs.readFileSync(src,'utf8');const blocks=[];function insert(anchor,body){assert.equal(s.split(anchor).length,2,anchor);const block='# REFRESH-BEGIN-'+blocks.length+'\n'+body+'\n# REFRESH-END-'+blocks.length+'\n';blocks.push(block);s=s.replace(anchor,block+anchor)}
  insert('function Reject-Protocol','$script:RefreshMutations = 0');
  const replace=(entry)=>`${entry}.handle.Dispose()\n[IO.File]::Move(${entry}.path, ${entry}.path + '.original-${side}')\n[IO.File]::Copy(${entry}.path + '.original-${side}', ${entry}.path)\n$script:RefreshMutations++`;
  if(mode==='before-read-replacement')insert('                $borrowed = [Microsoft.Win32.SafeHandles.SafeFileHandle]::new($leaf.handle.DangerousGetHandle(), $false)',replace('$leaf')+'\n$leaf.handle = Open-Native $leaf.path $false $true');
  else insert('        $fresh = Open-Native $entry.path $entry.directory',`        if (-not $entry.directory -and $script:RefreshMutations -eq 0) {\n${replace('$entry')}\n        }`);
  const telemetry=path.resolve(folder+'/'+side+'-telemetry.json');insert('exit 0',`[IO.File]::WriteAllText(${quote(telemetry)}, ('{"mutations":' + $script:RefreshMutations + '}'), [Text.UTF8Encoding]::new($false))`);
  let recovered=s;for(const b of blocks)recovered=recovered.replace(b,'');assert.equal(recovered,fs.readFileSync(src,'utf8'));
  const helper=folder+'/'+side+'-instrumented.ps1';fs.writeFileSync(helper,s);const r=await run(helper,request,folder+'/'+side);assert.equal(JSON.parse(fs.readFileSync(telemetry)).mutations,1);pair.push(r);
  fs.writeFileSync(folder+'/'+side+'-instrumentation.json',JSON.stringify({original:pin(src),copy:pin(helper),reversibleAdditions:true,telemetry:pin(telemetry),mutationCount:1,sharingRestrictionReleasedOnlyInEngineeringCopy:true,productionHooks:false},null,2)+'\n');
 }
 assert.deepEqual(pair[0].frame,pair[1].frame);rows.push({id:mode,result:'PASS',negative:true,code:'MO1307_FILESYSTEM_BOUNDARY',exactResponseEquivalent:true,scope:'ENGINEERING_CONTROLLED_NATIVE_FILESYSTEM_MUTATION',request:pin(folder+'/request.bin'),runs:pair.map(({frame,...r})=>r)});
}
for(const b of sourceBindings)assert.deepEqual(pin(b.path),b);
fs.writeFileSync(out+'/receipt.json',JSON.stringify({kind:'MO1307Phase3CRefreshAdditionalTOCTOU',result:'PASS',sourceBindings,rows,scope:'Two additional mutation windows. Actual filesystem replacements are performed in reversible engineering copies after releasing the held leaf solely to permit the mutation. Original native calls/checks remain present. No claim that production sharing permits this adversary.'},null,2)+'\n');console.log(JSON.stringify({result:'PASS',cases:rows.length}));
