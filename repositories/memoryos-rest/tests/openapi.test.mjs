import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedOpenAPI,verifyOpenAPI} from '../scripts/verify-contracts.mjs';
import {J} from '../src/serialization.mjs';
test('full OpenAPI projection rejects drift in routes, fields, headers, errors, media, security and budgets',()=>{
 const bytes=x=>Buffer.from(J(x));assert.equal(verifyOpenAPI(bytes(expectedOpenAPI())).openapi,'3.1.1');
 const mutations=[x=>delete x.paths[Object.keys(x.paths)[0]],x=>x.paths['/v1/health'].get.responses['200'].headers['cache-control'].schema.const='public',x=>x.components.schemas.Identities.additionalProperties=true,x=>delete x.components.securitySchemes.bearerToken,x=>x['x-memoryos-http'].limits.fixed.connections++,x=>delete x['x-memoryos-http'].errors.MO1305_INTERNAL_FAILURE,x=>x.paths['/v1/health'].get.responses['200'].content['application/json'].schema.$ref='https://example.invalid/schema'];
 for(const mutate of mutations){const value=expectedOpenAPI();mutate(value);assert.throws(()=>verifyOpenAPI(bytes(value)));}
});
