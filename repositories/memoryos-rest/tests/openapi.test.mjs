import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedOpenAPI,verifyOpenAPI} from '../scripts/verify-contracts.mjs';
import {J} from '../src/serialization.mjs';
test('full OpenAPI projection rejects drift in routes, fields, headers, errors, media, security and budgets',()=>{
 const bytes=x=>Buffer.from(J(x));assert.equal(verifyOpenAPI(bytes(expectedOpenAPI())).openapi,'3.1.1');
 const mutations=[x=>delete x.paths[Object.keys(x.paths)[0]],x=>x.paths['/v1/health'].get.responses['200'].headers['cache-control'].schema.const='public',x=>x.components.schemas.Identities.additionalProperties=true,x=>delete x.components.securitySchemes.bearerToken,x=>x['x-memoryos-http'].limits.fixed.connections++,x=>delete x['x-memoryos-http'].errors.MO1305_INTERNAL_FAILURE,x=>x.paths['/v1/health'].get.responses['200'].content['application/json'].schema.$ref='https://example.invalid/schema'];
 for(const mutate of mutations){const value=expectedOpenAPI();mutate(value);assert.throws(()=>verifyOpenAPI(bytes(value)));}
});

test('completed opt-in remote mode is projected from the authoritative deployment state; stale pending is rejected',()=>{
 const value=expectedOpenAPI();
 assert.deepEqual(value['x-memoryos-http'].behavior.remoteMode,{mode:'remote',implemented:true,explicitOptIn:true,bindAddressPolicy:'assigned RFC1918 IPv4'});
 assert.equal(verifyOpenAPI(Buffer.from(J(value)))['x-memoryos-http'].behavior.remoteMode.implemented,true);
 value['x-memoryos-http'].behavior.remoteMode='PHASE_2_PENDING';
 assert.throws(()=>verifyOpenAPI(Buffer.from(J(value))),/OPENAPI_RUNTIME_DRIFT/);
});
