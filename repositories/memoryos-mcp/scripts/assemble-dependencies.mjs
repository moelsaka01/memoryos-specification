import assert from 'node:assert/strict';
import { readFile,unlink,access,writeFile } from 'node:fs/promises';
import { resolve,relative,sep } from 'node:path';
import { PACKAGE_ROOT,regularBytes,sha256,exactFiles } from '../src/integrity.mjs';
import { J } from '../src/deterministic.mjs';
const bytes=await readFile(new URL('./dependency-selection.json',import.meta.url)),selection=JSON.parse(bytes);
assert.equal(selection.excludedFiles.length,198);
const root=resolve(PACKAGE_ROOT,'node_modules/zod');const present=[];
for(const item of selection.excludedFiles){
 assert.ok(item.path.startsWith('node_modules/zod/'));
 const target=resolve(PACKAGE_ROOT,item.path),rel=relative(root,target);
 assert.ok(rel&&!rel.startsWith('..'+sep)&&!rel.startsWith(sep));
 try{await access(target);}catch(error){if(error.code==='ENOENT')continue;throw error;}
 const content=await regularBytes(PACKAGE_ROOT,item.path);assert.equal(content.length,item.byteLength);assert.equal(sha256(content),item.sha256);present.push(target);
}
assert.ok(present.length===0||present.length===selection.excludedFiles.length,'partial unreviewed dependency selection');
for(const path of present)await unlink(path);
const remaining=await exactFiles(root);assert.equal(remaining.length,642);
const receipt={kind:'MemoryOSMCPPhase2DependencyAssembly',version:'1.0.0',selectionSha256:sha256(bytes),sourceClosureSha256:selection.sourceClosureSha256,sourceFileCount:946,retainedFileCount:748,excludedDevelopmentFiles:198,versionsChanged:false,retainedFileBytesChanged:false,status:'ASSEMBLED'};
await writeFile(resolve(PACKAGE_ROOT,'measurements/phase2-dependency-assembly.json'),J(receipt)+'\n');
process.stdout.write(J(receipt)+'\n');
