/** Finite closed-schema compact JSON maximum; independent of measured output. */
import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {api,validate} from '../../../memoryos-rest/src/contracts.mjs';import {J} from '../../../memoryos-rest/src/serialization.mjs';
const length=x=>Buffer.byteLength(J(x));
function longest(values){return values.reduce((a,b)=>length(a)>=length(b)?a:b);}
function largest(s){
 if(s.$ref)return largest(api.schemas.$defs[s.$ref.slice(8)]);
 if(Object.hasOwn(s,'const'))return s.const;if(s.enum)return longest(s.enum);
 if(s.oneOf||s.anyOf)return longest((s.oneOf??s.anyOf).map(largest));
 if(s.type==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,largest(v)]));
 if(s.type==='boolean')return false;if(s.type==='null')return null;if(s.type==='integer')return longest([s.minimum,s.maximum]);
 if(s.type==='string'){
  if(s['x-memoryos-base64-max-bytes'])return Buffer.alloc(s['x-memoryos-base64-max-bytes']).toString('base64');
  if(s.pattern==='^sha256:[0-9a-f]{64}$')return 'sha256:'+'0'.repeat(64);
  if(s.pattern==='^[A-Z][A-Z0-9_]*$')return 'A'.repeat(s.maxLength);
  assert.equal(s.pattern,undefined);return '\u0001'.repeat(s.maxLength);
 }
 throw Error('UNSUPPORTED_ANALYTICAL_SCHEMA');
}
const errors=largest(api.schemas.$defs.Error);assert.ok(validate('Error',errors));const errorBytes=length(errors),operations={};
for(const route of api.routes){const input=route.input?largest(api.schemas.$defs[route.input]):null,output=largest(api.schemas.$defs[route.output]);assert.ok(validate(route.output,output));if(input)assert.ok(validate(route.input,input));operations[route.operationId]={requestSchemaBytes:input?length(input):0,responseSchemaBytes:length(output),largestApplicableErrorBytes:errorBytes,requestKiBCeiling:input?Math.ceil(1.25*length(input)/1024)*1024:0,responseKiBCeiling:Math.ceil(1.25*Math.max(length(output),errorBytes)/1024)*1024};}
const record={kind:'MemoryOSRESTAnalyticalWireBounds',version:'1.0.0',units:'bytes',encoding:'Compact J UTF-8; Base64 standard padded; free text uses six-byte escaped control code points',semanticValidity:'Schema maxima are conservative transport bounds; released SDK input/resource constraints and canonical products can make combined maxima unattainable. SDK fixture results identify those cases.',errorBytes,earlyErrorKiBCeiling:Math.ceil(1.25*errorBytes/1024)*1024,operations};
const root=resolve(import.meta.dirname,'../../../..');writeFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1/analytical-bounds.json'),J(record));console.log(J(record));
