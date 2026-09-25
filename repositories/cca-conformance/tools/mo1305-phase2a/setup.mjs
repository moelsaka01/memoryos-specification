/** Focused Phase 2A staging only. This is not an installed-package receipt. */
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import net from 'node:net';
import {networkInterfaces} from 'node:os';
import {dirname,resolve,relative,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const root=resolve(import.meta.dirname,'../../../..');
export const cache=resolve(root,'.cache/mo1305-phase2a');
export const node=resolve(cache,'toolchain/node.exe');
export const pwsh='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
export const openssl='C:/Program Files/Git/usr/bin/openssl.exe';
export const nodeSha256='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
export const cleanEnvironment=()=>Object.fromEntries(Object.entries(process.env).filter(([k])=>['SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k.toUpperCase())));
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function J(value){if(Array.isArray(value))return '['+value.map(J).join(',')+']';if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+J(value[k])).join(',')+'}';return JSON.stringify(value);}
function within(directory,path){const rel=relative(directory,path);assert.ok(rel!==''&&!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.includes(':'),'PATH_OUTSIDE_STAGE');return path;}
function command(executable,args){const out=spawnSync(executable,args,{encoding:'utf8',env:cleanEnvironment(),windowsHide:true,timeout:20000});assert.equal(out.status,0,'STAGING_COMMAND_FAILED '+(out.error?.code??out.status));return out;}
export function privateAddresses(){return Object.values(networkInterfaces()).flat().filter(x=>{
 if(x.family!=='IPv4'||x.internal||!x.cidr)return false;const a=x.address.split('.').map(Number);
 if(!(a[0]===10||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&a[1]===168)))return false;
 const prefix=Number(x.cidr.split('/')[1]);if(!Number.isInteger(prefix)||prefix<1||prefix>30)return false;
 const n=a.reduce((v,o)=>(v*256+o)>>>0,0),mask=(0xffffffff<<(32-prefix))>>>0,host=(n&(~mask>>>0))>>>0;
 return host!==0&&host!==(~mask>>>0);
}).map(x=>({address:x.address,cidr:x.cidr}));}
export async function unusedPort(host='127.0.0.1'){
 return await new Promise((done,fail)=>{const server=net.createServer();server.once('error',fail);server.listen({host,port:0,exclusive:true},()=>{const port=server.address().port;server.close(error=>error?fail(error):done(port));});});
}
const aclScript=String.raw`param([string]$PathsFile)
$ErrorActionPreference='Stop'
$serviceSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$paths=Get-Content -LiteralPath $PathsFile -Raw | ConvertFrom-Json
foreach($target in $paths) {
 $item=Get-Item -LiteralPath $target
 if($item.PSIsContainer) {
  $acl=[System.Security.AccessControl.DirectorySecurity]::new()
  $acl.SetOwner($serviceSid);$acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($serviceSid.Value,'S-1-5-18','S-1-5-32-544')) {
   $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
  }
 } else {
  $acl=[System.Security.AccessControl.FileSecurity]::new()
  $acl.SetOwner($serviceSid);$acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($serviceSid.Value,'S-1-5-18','S-1-5-32-544')) {
   $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))
  }
 }
 Set-Acl -LiteralPath $target -AclObject $acl
}
`;
export function restrict(stage,paths){
 assert.ok(Array.isArray(paths)&&paths.length>0);
 for(const path of paths)assert.ok(path===stage.privateRoot||within(stage.privateRoot,resolve(path)));
 const list=resolve(stage.directory,'acl-targets.json');writeFileSync(list,JSON.stringify(paths));
 command(pwsh,['-NoLogo','-NoProfile','-NonInteractive','-File',resolve(stage.directory,'set-private-acl.ps1'),'-PathsFile',list]);
}
export function writeConfig(stage,name,config){
 assert.match(name,/^[A-Za-z0-9_-]+(?:\.json)?$/u);
 const path=resolve(stage.privateRoot,name.endsWith('.json')?name:name+'.json');
 // In-place content updates preserve the protected DACL. Reapplying Set-Acl
 // to an already protected file can require SeSecurityPrivilege on this host.
 const existed=existsSync(path);writeFileSync(path,JSON.stringify(config));if(!existed)restrict(stage,[path]);return path;
}
export function trustedValidate(stage,configPath=stage.configPath){
 const result=spawnSync(pwsh,['-NoLogo','-NoProfile','-NonInteractive','-File',resolve(root,'repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1'),'-NodePath',stage.node,'-ConfigPath',configPath],{encoding:'utf8',env:cleanEnvironment(),windowsHide:true,timeout:20000});
 assert.equal(result.status,0,'TRUSTED_LAUNCH_REFUSED '+result.stdout.trim());
 assert.equal(result.stdout.trim(),'MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS');return true;
}
export async function setup({address=null}={}){
 assert.equal(process.platform,'win32');assert.ok(existsSync(node),'PINNED_NODE_MISSING');
 assert.equal(sha256(readFileSync(node)),nodeSha256,'PINNED_NODE_HASH');
 const assigned=privateAddresses();if(address!==null)assert.ok(assigned.some(x=>x.address===address),'REMOTE_ADDRESS_NOT_ASSIGNED');
 address??=assigned[0]?.address??null;
 mkdirSync(cache,{recursive:true});const directory=mkdtempSync(resolve(cache,'session-'));
 const packageRoot=resolve(directory,'package'),privateRoot=resolve(directory,'private');
 mkdirSync(packageRoot);mkdirSync(privateRoot);mkdirSync(resolve(directory,'empty'));
 const stage={directory,packageRoot,privateRoot,node,address,host:'127.0.0.1',interfaces:assigned};
 writeFileSync(resolve(directory,'set-private-acl.ps1'),aclScript);restrict(stage,[privateRoot]);
 const source=resolve(root,'repositories/memoryos-rest'),manifest=JSON.parse(readFileSync(resolve(source,'distribution-manifest.json'),'utf8'));
 const seen=new Set();let prior='';
 for(const row of manifest.files){
  assert.match(row.path,/^[A-Za-z0-9_.\/-]+$/u);assert.ok(row.path>prior&&!seen.has(row.path.toLowerCase()));
  assert.ok(row.path.split('/').every(x=>x&&x!=='.'&&x!=='..'));prior=row.path;seen.add(row.path.toLowerCase());
  const from=within(source,resolve(source,row.path)),to=within(packageRoot,resolve(packageRoot,row.path));
  assert.ok(lstatSync(from).isFile()&&!lstatSync(from).isSymbolicLink());mkdirSync(dirname(to),{recursive:true});
  copyFileSync(from,to);const bytes=readFileSync(to);row.byteLength=bytes.length;row.sha256=sha256(bytes);
 }
 const stagedManifest=Buffer.from(J(manifest));writeFileSync(resolve(packageRoot,'distribution-manifest.json'),stagedManifest);
 stage.manifestSha256=sha256(stagedManifest);stage.stagedFileCount=manifest.files.length+1;
 stage.token=randomBytes(32).toString('hex');writeFileSync(resolve(privateRoot,'token'),stage.token,'ascii');
 command(openssl,['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',resolve(privateRoot,'key.pem'),'-out',resolve(privateRoot,'cert.pem'),'-days','3','-subj','/CN=MO1305 Phase2A ephemeral lifecycle','-addext','subjectAltName=IP:127.0.0.1'+(address?',IP:'+address:''),'-addext','basicConstraints=critical,CA:TRUE']);
 stage.port=await unusedPort(address??'127.0.0.1');assert.ok(stage.port>=1024);
 stage.config={version:'1.0.0',port:stage.port,tokenFile:resolve(privateRoot,'token'),privateKeyFile:resolve(privateRoot,'key.pem'),certificateFile:resolve(privateRoot,'cert.pem')};
 stage.configPath=writeConfig(stage,'config',stage.config);restrict(stage,[resolve(privateRoot,'token'),resolve(privateRoot,'key.pem')]);
 stage.ca=readFileSync(resolve(privateRoot,'cert.pem'));stage.api=JSON.parse(readFileSync(resolve(packageRoot,'contracts/api-contract.json'),'utf8'));
 trustedValidate(stage);
 writeFileSync(resolve(directory,'staging.json'),J({kind:'MemoryOSRESTPhase2AFocusedStaging',source:'repositories/memoryos-rest',distributionManifestSha256:stage.manifestSha256,stagedFileCount:stage.stagedFileCount,nodeSha256,address,interfaces:assigned,port:stage.port,releasePackageEvidence:false}));
 return stage;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const stage=await setup();process.stdout.write(JSON.stringify({directory:stage.directory,address:stage.address,port:stage.port,manifestSha256:stage.manifestSha256})+'\n');
}
