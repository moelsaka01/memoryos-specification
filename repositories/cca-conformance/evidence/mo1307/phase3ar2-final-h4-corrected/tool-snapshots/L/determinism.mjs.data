// Stage N compares already executed bytes and API comparison receipts; it performs no semantic evaluation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,packageRoot,identity,record,write,inventory,hash} from './common.mjs';
identity();
const {canonicalBytes,parseCanonical,readinessDigest,proofBindingDigest}=await import(pathToFileURL(path.join(packageRoot,'src/canonical.mjs')));
const {DEFINITIONS}=await import(pathToFileURL(path.join(packageRoot,'src/constants.mjs')));
const manifestPath=process.argv[2];assert.ok(manifestPath);
const manifest=JSON.parse(fs.readFileSync(path.resolve(root,manifestPath),'utf8'));assert.ok(Array.isArray(manifest.vectors));assert.equal(manifest.vectors.length,5);assert.deepEqual(manifest.vectors.map(row=>row.name),['mo1306-qualified','ready','not-ready','could-not-evaluate','rest-qualified']);
const before=inventory(packageRoot),rows=[];
const reverseKeys=value=>Array.isArray(value)?value.map(reverseKeys):value!==null&&typeof value==='object'?Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reverseKeys(value[key])])):value;
const requiredFields=['candidate','candidateDigest','profile','stage','gates','blockers','cneReasons','qualifications','history','providers','readiness','readinessDigest','proofBindingDigest','canonicalResultBytes'];
for(const vector of manifest.vectors){
 assert.ok(vector.name&&vector.cliResult&&vector.apiReceipt&&vector.expectedResult);
 const cli=fs.readFileSync(path.resolve(root,vector.cliResult)),expected=fs.readFileSync(path.resolve(root,vector.expectedResult));
 const api=JSON.parse(fs.readFileSync(path.resolve(root,vector.apiReceipt),'utf8'));
 assert.equal(api.result,'PASS');assert.deepEqual(cli,expected,vector.name+' authoritative bytes');
 const parsed=parseCanonical(cli,{maxBytes:DEFINITIONS.limits.resultBytes,stage:'EVALUATION'});
 assert.deepEqual(canonicalBytes(parsed),cli,vector.name+' canonical roundtrip');
 assert.deepEqual(canonicalBytes(reverseKeys(parsed)),cli,vector.name+' private object insertion order');
 assert.equal(readinessDigest(parsed.assessment),parsed.readinessDigest);
 assert.equal(proofBindingDigest(parsed.readinessDigest,parsed.audit),parsed.proofBindingDigest);
 for(const operation of ['evaluate','verify']){
  const observed=api[operation];assert.equal(observed.canonicalBytes,true);assert.equal(observed.byteLength,cli.length);
  assert.equal(observed.sha256,hash(cli));assert.equal(observed.readinessDigest,parsed.readinessDigest);
  assert.equal(observed.proofBindingDigest,parsed.proofBindingDigest);assert.equal(observed.readiness,parsed.assessment.readiness);
  assert.equal(observed.gates,parsed.assessment.gates.length);assert.equal(observed.qualifications,parsed.assessment.qualifications.length);
  for(const field of requiredFields)assert.ok(observed.fields.includes(field),operation+' '+field);
 }
 rows.push({name:vector.name,result:'PASS',cli:record(vector.cliResult),apiReceipt:record(vector.apiReceipt),expected:record(vector.expectedResult),apiEvidenceScope:'Prior mandatory evaluate/verify receipt records exact live API byte comparison; this step checks its recorded lengths, hashes, fields and digests. API result bytes were not persisted and are not reconstructed or presented as captured bytes.',canonicalRoundtrip:true,reversedPrivateObjectKeyOrderCanonicalEquality:true,readinessDigest:parsed.readinessDigest,proofBindingDigest:parsed.proofBindingDigest});
}
assert.deepEqual(inventory(packageRoot),before);
write('determinism/receipt.json',{kind:'MO1307Phase3AR2FinalByteDeterminism',stage:'N',result:'PASS',manifest:record(manifestPath),vectors:rows,additionalSemanticExecutions:0,additionalNativeExecutions:0,installedUnchanged:true,finalMO1306Confirmation:'Predeclared stage O still required after N; compare its native bytes/digests separately with primary.'});
console.log(JSON.stringify({stage:'N',result:'PASS',vectors:rows.length,additionalExecutions:0}));

