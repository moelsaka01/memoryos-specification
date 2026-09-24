import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {tmpdir} from 'node:os';import {resolve} from 'node:path';import {syncBuiltinESMExports} from 'node:module';import {readChecked} from '../src/integrity.mjs';
test('checked reads reject a real file growth race between descriptor reads',()=>{
 const directory=fs.mkdtempSync(resolve(tmpdir(),'mo1305-race-')),path=resolve(directory,'input');fs.writeFileSync(path,'a'.repeat(64));
 const read=fs.readSync;let changed=false;
 try{fs.readSync=function(...args){const count=read.apply(this,args);if(!changed){changed=true;fs.appendFileSync(path,'x');}return count;};syncBuiltinESMExports();assert.throws(()=>readChecked(path,1024),e=>e.code==='MO1305_RUNTIME_INTEGRITY');assert.equal(changed,true);}
 finally{fs.readSync=read;syncBuiltinESMExports();fs.unlinkSync(path);fs.rmdirSync(directory);}
});
