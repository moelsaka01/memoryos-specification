import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';
const [pkg,node,fixture,mode,work]=process.argv.slice(2),{checkPaths,contained}=await import(pathToFileURL(path.join(pkg,'src/filesystem.mjs')));
const rows=[];const root=path.join(work,'target');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'valid.txt'),'fixture');
const paths=[['contained',contained(root,'valid.txt'),null],['traversal',root+'\\..\\target\\valid.txt','MO1306_FILESYSTEM_BOUNDARY'],['UNC','\\\\localhost\\share\\file','MO1306_FILESYSTEM_BOUNDARY'],['device','\\\\?\\C:\\file','MO1306_FILESYSTEM_BOUNDARY'],['ADS',path.join(root,'valid.txt')+':stream','MO1306_FILESYSTEM_BOUNDARY']];
for(const [type,kind]of [['junction','junction'],['symlink','dir']]){const link=path.join(work,type);fs.symlinkSync(root,link,kind);paths.push([type,path.join(link,'valid.txt'),'MO1306_FILESYSTEM_BOUNDARY']);}
for(const [name,value,expected]of paths){let code=null;try{await checkPaths([{path:value,allowMissingLeaf:false}],{deadline:performance.now()+10000});}catch(e){code=e.code;}assert.equal(code,expected);rows.push({name,code,status:'PASS'});}
for(const name of ['junction','symlink'])fs.unlinkSync(path.join(work,name));fs.unlinkSync(path.join(root,'valid.txt'));fs.rmdirSync(root);
console.log(JSON.stringify({result:{accepted:true,code:null},filesystem:{unchanged:fs.readdirSync(work).length===0,completeMarkerPresent:false},cases:rows,status:'PASS'}));
