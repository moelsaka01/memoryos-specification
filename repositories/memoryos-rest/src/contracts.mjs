import { readChecked, packageRoot } from './integrity.mjs';
import { resolve } from 'node:path';
import { schemaValidator, decodeBase64 } from './schema.mjs';
import { J } from './serialization.mjs';
import { reject } from './errors.mjs';
function contract(path, maximum) {
  const bytes = readChecked(resolve(packageRoot, 'contracts', path), maximum);
  const value = JSON.parse(bytes);
  if (J(value) !== bytes.toString('utf8')) reject('RUNTIME_INTEGRITY');
  return value;
}
export const api = contract('api-contract.json', 262144);
export const limits = contract('limits.json', 65536);
export const identities = JSON.parse(readChecked(resolve(packageRoot, 'contracts/policy-contract-identities-1.0.0.json'), 933));
export const validate = schemaValidator(api.schemas);
export const routeById = new Map(api.routes.map(route => [route.operationId, route]));
export function validateInput(route, value) {
  // Preserve the specified 413 precedence for canonical, over-bound byte fields.
  const schema = api.schemas.$defs[route.input];
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    let branch = schema;
    if (route.input === 'EvaluationInput') branch = schema.oneOf.find(s => s.properties.artifactKind.const === value.artifactKind);
    if (branch) for (const [key, rule] of Object.entries(branch.properties)) {
      if (Object.hasOwn(value, key) && rule['x-memoryos-base64-max-bytes'] !== undefined)
        decodeBase64(value[key], rule['x-memoryos-base64-max-bytes']);
    }
  }
  if (!validate(route.input, value)) reject('REQUEST_SCHEMA');
  return value;
}
export const versionProduct = Object.fromEntries(Object.entries(api.schemas.$defs.Version.properties).map(([k,v]) => [k,v.const]));
