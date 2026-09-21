import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdtemp,mkdir,link,unlink,symlink } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync,gzipSync } from 'node:zlib';
import { ARCHIVE,RECEIPT,MANIFEST,archiveMembers,verifyArchive,verifyInstalled } from '../scripts/distribution.mjs';
import { PACKAGE_ROOT,sha256 } from '../src/integrity.mjs';
const receipt=JSON.parse(await readFile(RECEIPT));
const archive=await readFile(resolve(PACKAGE_ROOT,'out/phase2',ARCHIVE));
const tar=gunzipSync(archive);
function checksum(header){header.fill(32,148,156);let sum=0;for(const x of header)sum+=x;header.write(sum.toString(8).padStart(6,'0')+'\0 ',148,'ascii');}
function records(bytes){const result=[];let at=0;while(!bytes.subarray(at,at+512).every(x=>x===0)){const size=parseInt(bytes.subarray(at+124,at+136).toString().replace(/\0.*$/u,''),8);const end=at+512+Math.ceil(size/512)*512;result.push(Buffer.from(bytes.subarray(at,end)));at=end;}return result;}
function name(record){const read=(start,len)=>record.subarray(start,start+len).toString().replace(/\0.*$/u,'');return (read(345,155)?read(345,155)+'/':'')+read(0,100);}
function rename(record,path){record.fill(0,0,100);record.fill(0,345,500);record.write(path,0,'ascii');checksum(record.subarray(0,512));}
function packageBytes(changes){const entries=records(tar);changes(entries);return gzipSync(Buffer.concat([...entries,Buffer.alloc(1024)]));}
function reject(bytes){const altered={...receipt,archive:{byteLength:bytes.length,sha256:sha256(bytes)}};assert.throws(()=>verifyArchive(bytes,altered));}
test('verified archive has exact closed production members and no source/development/evidence payload',()=>{
 const checked=verifyArchive(archive,receipt);assert.equal(checked.members.size,receipt.archiveFileCount);
 for(const name of checked.members.keys())assert.ok(!/(^|\/)(?:\.git|\.github|tests|measurements|\.cache|fixtures)(\/|$)/u.test(name),name);
 assert.ok(![...checked.members.keys()].some(name=>name.startsWith('node_modules/@modelcontextprotocol/client/')));
 assert.equal(checked.manifest.files.some(x=>x.path===MANIFEST),false);assert.equal(checked.summary.runtimeFiles,25);
});
for(const path of ['package/../escape','/absolute','C:/device','package/CON','package/file:stream','package/./same','package/a//b','package/a\\b','//server/share'])test(`archive path rejection: ${path}`,()=>reject(packageBytes(entries=>rename(entries[0],path))));
for(const type of ['1','2','3','4','5','6','7','x','g'])test(`archive member type ${type} fails closed`,()=>reject(packageBytes(entries=>{entries[0][156]=type.charCodeAt(0);checksum(entries[0].subarray(0,512));})));
for(const mode of [0o777,0o4755,0o600,0o000])test(`archive unexpected mode ${mode.toString(8)} rejected`,()=>reject(packageBytes(entries=>{entries[0].write(mode.toString(8).padStart(7,'0')+'\0',100,'ascii');checksum(entries[0].subarray(0,512));})));
test('duplicate members and case-folding collisions reject before extraction',()=>{
 reject(packageBytes(entries=>entries.push(Buffer.from(entries[0]))));
 reject(packageBytes(entries=>{const duplicate=Buffer.from(entries[0]);rename(duplicate,name(duplicate).toUpperCase().replace('PACKAGE/','package/'));entries.push(duplicate);}));
});
for(const fragment of ['node_modules/zod/','runtime/authoritative/','contracts/policy-contract-identities','contracts/limits','distribution/dependency-lock','distribution/distribution-manifest','package.json','LICENSE','NOTICE.md','THIRD_PARTY_NOTICES'])test(`changed or missing ${fragment} rejected`,()=>{
 reject(packageBytes(entries=>{const index=entries.findIndex(x=>name(x).startsWith('package/'+fragment));assert.ok(index>=0);entries[index][512]^=1;}));
 reject(packageBytes(entries=>{const index=entries.findIndex(x=>name(x).startsWith('package/'+fragment));entries.splice(index,1);}));
});
test('extra production dependency file, package truncation, appended bytes and concatenated gzip reject',()=>{
 reject(packageBytes(entries=>{const extra=Buffer.from(entries[0]);rename(extra,'package/node_modules/zod/unreviewed.js');entries.push(extra);}));
 for(const bytes of [archive.subarray(0,-1),archive.subarray(0,archive.length>>1),Buffer.concat([archive,Buffer.from('extra')]),Buffer.concat([archive,archive])])reject(bytes);
});
test('wrong receipt package identity fails closed',()=>{
 for(const patch of [{packageName:'other'},{packageVersion:'0.2.0'},{archiveFilename:'other.tgz'}])assert.throws(()=>verifyArchive(archive,{...receipt,...patch}));
});
test('installed tree rejects changed, extra, missing, hardlinked, and reparse files',async()=>{
 const destination=await mkdtemp(resolve(tmpdir(),'memoryos-mo1304-phase2-verifier-'));
 const root=resolve(destination,'package');await mkdir(root);
 const checked=verifyArchive(archive,receipt);
 for(const [path,entry] of checked.members){const target=resolve(root,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,entry.bytes);}
 await verifyInstalled(root,receipt);
 const member='contracts/limits.json',target=resolve(root,member),original=checked.members.get(member).bytes;
 await writeFile(target,Buffer.from('changed'));await assert.rejects(verifyInstalled(root,receipt));await writeFile(target,original);
 const extra=resolve(root,'node_modules/unexpected.js');await writeFile(extra,'extra');await assert.rejects(verifyInstalled(root,receipt));await unlink(extra);
 await unlink(target);await assert.rejects(verifyInstalled(root,receipt));await writeFile(target,original);
 const hardlink=resolve(destination,'outside-hardlink');await link(target,hardlink);await assert.rejects(verifyInstalled(root,receipt));await unlink(hardlink);
 const reparse=resolve(root,'unexpected-junction');await symlink(resolve(root,'contracts'),reparse,process.platform==='win32'?'junction':'dir');await assert.rejects(verifyInstalled(root,receipt));await unlink(reparse);
 await verifyInstalled(root,receipt);
});

for(const [label,from,to] of [['name','"name": "memoryos-mcp"','"name": "memoryos-bad"'],['version','"version": "0.1.0"','"version": "0.2.0"'],['entry point','bin/memoryos-mcp.mjs','bin/memoryos-bad.mjs']])test(`archive wrong package ${label} rejected`,()=>{
 reject(packageBytes(entries=>{const entry=entries.find(x=>name(x)==='package/package.json');const at=entry.indexOf(from,512,'utf8');assert.ok(at>=512);assert.equal(Buffer.byteLength(from),Buffer.byteLength(to));entry.write(to,at,'utf8');}));
});
