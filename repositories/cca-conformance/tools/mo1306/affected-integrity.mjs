import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {verifyDistribution} from '../../../memoryos-ci/src/integrity.mjs';
import {childEnvironment,packageRoot} from '../../../memoryos-ci/src/filesystem.mjs';
const work=process.argv[2];fs.mkdirSync(work);
for(const [id,mutate] of [
 ['grown-sdk',p=>fs.appendFileSync(path.join(p,'runtime/authoritative/web/js/memoryos-sdk.js'),'\n// replacement\n')],
 ['changed-sdk',p=>{const file=path.join(p,'runtime/authoritative/web/js/memoryos-sdk.js'),b=fs.readFileSync(file);b[10]^=1;fs.writeFileSync(file,b);}],
 ['malformed-manifest',p=>fs.writeFileSync(path.join(p,'distribution-manifest.json'),'{')],
 ['extra-file',p=>fs.writeFileSync(path.join(p,'unexpected.mjs'),'export{}')],
 ['missing-file',p=>fs.unlinkSync(path.join(p,'schemas/result-1.0.0.schema.json'))]
]){
 const p=path.join(work,id);fs.cpSync(packageRoot,p,{recursive:true,errorOnExist:true});mutate(p);
 assert.throws(()=>verifyDistribution(p),e=>e.code==='MO1306_RUNTIME_INTEGRITY');console.log(id+' PASS');
}
const actual=await new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,['-e','console.log(JSON.stringify(Object.keys(process.env).sort()))'],{env:childEnvironment(),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';
 p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code===0?resolve(JSON.parse(out)):reject(new Error(err)));
});assert.deepEqual(actual,['SystemRoot','WINDIR']);console.log('actual-child-environment PASS');
