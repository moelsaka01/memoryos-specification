// Exact committed graph and blob verification, preserving historical contexts.
import assert from 'node:assert/strict';
import {evidence,baseline,str,blobs,check,json,write,record} from './common.mjs';
import {checkEvidence} from './check-evidence.mjs';
const binding=json(evidence+'/binding.json'),commit=binding.implementation.commit;
const implementationSubject='feat(memoryos-1.3): integrate MO-1307 release readiness',bindingSubject='conformance(memoryos-1.3): bind MO-1307 phase 2 integration';
assert.equal(binding.implementation.parent,baseline);assert.deepEqual(str('show','-s','--format=%P',commit).split(' '),[baseline]);
assert.equal(str('show','-s','--format=%s',commit),implementationSubject);assert.equal(str('rev-parse',commit+'^{tree}'),binding.implementation.tree);
const graph=[baseline,'a61a8ff6fe01028fd21f8abe7208d5ffbe9c5152','0d68ac211b3b204635e7af252cd693dce5bd70b1','904908245483d3c64fb21d63aa5a6ebfd22102cb','3883ca889911fcc5a6f46c24e569478a8c32648e','7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee','e0cb8e9cc6aa73e26945db30756a6667a8d9e322'];
for(let i=0;i<graph.length-1;i++)assert.deepEqual(str('show','-s','--format=%P',graph[i]).split(' '),[graph[i+1]]);
const names=str('diff-tree','--no-commit-id','--name-only','-r',commit).split('\n').filter(Boolean).sort();assert.deepEqual(binding.members.map(m=>m.path),names);
const bytes=blobs(commit,names);binding.members.forEach((m,i)=>{check(m,bytes[i]);check(m);});
const inventory=json(evidence+'/changed-file-inventory.json');assert.equal(inventory.baseline,baseline);assert.deepEqual(inventory.members.map(m=>m.path),names.filter(p=>p!==evidence+'/changed-file-inventory.json'));for(const m of inventory.members)check(m);
const validation=json(evidence+'/final-validation/receipt.json');assert.equal(validation.result,'PASS');for(const row of validation.commands){assert.equal(row.result,'PASS');check(row.stdout);check(row.stderr);}for(const m of validation.sourceBindings)check(m);
const current=await checkEvidence();assert.equal(current.result,'PASS');
assert.equal(str('rev-parse','memoryos-1.3-mo1306'),'9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8');assert.equal(str('rev-parse','memoryos-1.3-mo1306^{}'),'332ab0d2c35643ea8d155bcbea9c5019b304bbe3');
assert.equal(str('branch','--show-current'),'main');let child=null;
if(process.argv.includes('--bound')){
 child=str('rev-parse','HEAD');assert.deepEqual(str('show','-s','--format=%P',child).split(' '),[commit]);assert.equal(str('show','-s','--format=%s',child),bindingSubject);
 assert.deepEqual(str('diff-tree','--no-commit-id','--name-only','-r',child).split('\n').sort(),[evidence+'/binding.json',evidence+'/binding-verification.json'].sort());
 assert.equal(str('status','--porcelain'),'');
 const verification=json(evidence+'/binding-verification.json');assert.equal(verification.result,'PASS');assert.equal(verification.I2,commit);check(verification.binding);
 const bnames=[evidence+'/binding.json',evidence+'/binding-verification.json'];blobs(child,bnames).forEach((b,i)=>check(record(bnames[i]),b));
}else assert.equal(str('rev-parse','HEAD'),commit);
const result={kind:'MO1307Phase2DBindingVerification',version:'1.0.0',result:'PASS',I2:commit,B2:child,tree:binding.implementation.tree,graph:'PASS',freezeCorrectionAncestry:'PASS',boundBlobs:names.length,
 binding:record(evidence+'/binding.json'),productionChangesInBindingCommit:false,actualTreeBinding:'PASS',evidenceGraph:'PASS',sourceAndHistoricalPreservation:'PASS',selfReference:false};
if(process.argv.includes('--record')){assert.equal(child,null);write(evidence+'/binding-verification.json',result);}
console.log(JSON.stringify(result));
