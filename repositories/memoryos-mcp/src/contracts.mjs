import { z } from 'zod';
import { J } from './deterministic.mjs';

export const PROTOCOL = '2026-07-28';
export const SERVER_INFO = Object.freeze({ name: 'memoryos-mcp', version: '0.1.0' });
export const META = Object.freeze({ 'io.modelcontextprotocol/serverInfo': SERVER_INFO });
export const CACHE_DIRECTIVES = Object.freeze({ ttlMs: 0, cacheScope: 'private' });
export const discoveryResult = () => ({ resultType: 'complete', ...CACHE_DIRECTIVES, supportedVersions: [PROTOCOL],
  capabilities: { tools: { listChanged: false } }, _meta: META });
export const listingResult = (tools) => ({ resultType: 'complete', ...CACHE_DIRECTIVES, tools, _meta: META });
export function exactCacheDirectives(result) {
  return result?.resultType === 'complete' && result.ttlMs === 0 && result.cacheScope === 'private';
}
export const DIGEST_PATTERN = '^sha256:[0-9a-f]{64}$';
export const BASE64_PATTERN = '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=)?$';
export const POLICY_KIND = 'MemoryOSInvestigationPolicy';
export const SET_KIND = 'MemoryOSInvestigationPolicySet';
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties).sort(), additionalProperties: false });
const constant = (value) => ({ const: value });
const digest = { type: 'string', pattern: DIGEST_PATTERN, minLength: 71, maxLength: 71 };
const decisions = { enum: ['PASS', 'FAIL', 'COULD_NOT_EVALUATE'] };
export function base64Schema(maximum) {
  const maxLength = 4 * Math.ceil(maximum / 3);
  return { type: 'string', minLength: 4, maxLength, pattern: BASE64_PATTERN,
    allOf: [{ not: { pattern: '[^A-Za-z0-9+/=]' } },
      ...(maximum % 3 ? [{ if: { minLength: maxLength }, then: { pattern: maximum % 3 === 1 ? '==$' : '=$' } }] : [])] };
}
export function decodeBase64(value, maximum) {
  if (typeof value !== 'string' || value.length < 4 || value.length > 4 * Math.ceil(maximum / 3)
    || !new RegExp(BASE64_PATTERN, 'u').test(value)) throw new TypeError('INVALID_BASE64');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const size = value.length / 4 * 3 - padding;
  if (size === 0 || size > maximum) throw new TypeError('INVALID_BASE64');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== size || bytes.toString('base64') !== value) throw new TypeError('INVALID_BASE64');
  return bytes;
}
const zb = (maximum) => z.string().min(4).max(4 * Math.ceil(maximum / 3)).refine((value) => {
  try { decodeBase64(value, maximum); return true; } catch { return false; }
});
const zd = z.string().regex(new RegExp(DIGEST_PATTERN, 'u')).length(71);
export const names = Object.freeze([
  'memoryos_contract_identities', 'memoryos_evaluate_policy', 'memoryos_prepare_policy',
  'memoryos_prepare_policy_set', 'memoryos_verify_evaluation_identity', 'memoryos_verify_policy_outcome',
]);
const descriptions = [
  'Inspect the authoritative MemoryOS Policy contract identities used by this server.',
  'Evaluate a Policy or Policy Set against an explicitly supplied Memory Investigation Package using authoritative MemoryOS semantics.',
  'Validate and prepare Policy artifact bytes, returning authoritative canonical bytes and digests.',
  'Validate and prepare Policy Set artifact bytes, returning authoritative canonical bytes and digests.',
  'Verify canonical Evaluation Identity bytes against an expected digest without granting evaluation authority.',
  'Verify canonical Policy Outcome bytes against expected identity and outcome digests without granting evaluation authority.',
];
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const inputSchemas = [
  object({}),
  { type: 'object', oneOf: ['policy', 'policySet'].map((kind) => object({ artifactKind: constant(kind),
    artifactBase64: base64Schema(kind === 'policy' ? 2048 : 4096), candidateMipBase64: base64Schema(524288) })) },
  object({ policyBase64: base64Schema(2048) }),
  object({ policySetBase64: base64Schema(4096) }),
  object({ evaluationIdentityBase64: base64Schema(4060), expectedEvaluationIdentityDigest: digest }),
  object({ outcomeBase64: base64Schema(4060), expectedEvaluationIdentityDigest: digest, expectedOutcomeDigest: digest }),
];
const inputValidators = [
  z.strictObject({}),
  z.discriminatedUnion('artifactKind', ['policy', 'policySet'].map((kind) => z.strictObject({
    artifactKind: z.literal(kind), artifactBase64: zb(kind === 'policy' ? 2048 : 4096), candidateMipBase64: zb(524288),
  }))),
  z.strictObject({ policyBase64: zb(2048) }), z.strictObject({ policySetBase64: zb(4096) }),
  z.strictObject({ evaluationIdentityBase64: zb(4060), expectedEvaluationIdentityDigest: zd }),
  z.strictObject({ outcomeBase64: zb(4060), expectedEvaluationIdentityDigest: zd, expectedOutcomeDigest: zd }),
];
export function validateInput(name, args) {
  const index = names.indexOf(name);
  return index >= 0 && inputValidators[index].safeParse(args).success;
}
const nullableText = { anyOf: [{ type: 'string', maxLength: 128 }, { type: 'null' }] };
export const ERROR_SCHEMA = object({ status: constant('error'), error: object({
  origin: { enum: ['adapter', 'memoryos'] }, code: { type: 'string', minLength: 1, maxLength: 128 },
  phase: nullableText, artifactKind: nullableText, limitIdentifier: nullableText,
  failureClass: { enum: ['preparation', 'operational', null] }, verificationFailure: { type: ['boolean', 'null'] },
}) });
const ok = { status: constant('ok') };
const verification = { ...ok, artifactVersion: constant('1.0.0'), verified: constant(true),
  authority: constant('inspectionOnly'), verificationScope: constant('serializedArtifact'), evaluationIdentityDigest: digest };
export function catalog(identities) {
  const outputs = [
    object({ ...ok, identities: constant(identities) }),
    object({ ...ok, artifactKind: { enum: [POLICY_KIND, SET_KIND] }, semanticDigest: digest, decision: decisions,
      evaluationIdentityBase64: base64Schema(4060), evaluationIdentityDigest: digest,
      outcomeBase64: base64Schema(4060), outcomeDigest: digest }),
    ...[[POLICY_KIND, 1024], [SET_KIND, 2048]].map(([kind, size]) => object({ ...ok,
      artifactKind: constant(kind), artifactVersion: constant('1.0.0'), canonicalArtifactBase64: base64Schema(size),
      documentDigest: digest, semanticDigest: digest })),
    object({ ...verification, artifactKind: constant('MemoryOSPolicyEvaluationIdentity') }),
    object({ ...verification, artifactKind: constant('MemoryOSPolicyEvaluationOutcome'), decision: decisions, outcomeDigest: digest }),
  ];
  return names.map((name, index) => ({ name, description: descriptions[index], annotations: { ...annotations },
    inputSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', ...inputSchemas[index] },
    outputSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', oneOf: [outputs[index], ERROR_SCHEMA] } }));
}
/** Closed local-schema evaluator: only the finite schema vocabulary above; no external refs. */
export function matches(schema, value) {
  if (schema.not && matches(schema.not, value)) return false;
  if ('const' in schema && J(schema.const) !== J(value)) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.oneOf && schema.oneOf.filter((entry) => matches(entry, value)).length !== 1) return false;
  if (schema.anyOf && !schema.anyOf.some((entry) => matches(entry, value))) return false;
  if (schema.allOf && !schema.allOf.every((entry) => matches(entry, value))) return false;
  if (schema.if && matches(schema.if, value) && !matches(schema.then, value)) return false;
  if (schema.type) {
    const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (!(Array.isArray(schema.type) ? schema.type : [schema.type]).includes(kind)) return false;
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) return false;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) return false;
  }
  if (schema.properties) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    if (schema.required.some((name) => !Object.hasOwn(value, name))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((name) => !Object.hasOwn(schema.properties, name))) return false;
    if (!Object.entries(schema.properties).every(([name, entry]) => !Object.hasOwn(value, name) || matches(entry, value[name]))) return false;
  }
  return true;
}
export function toolResult(product) {
  return { resultType: 'complete', content: [{ type: 'text', text: J(product) }], structuredContent: product,
    isError: product.status === 'error', _meta: META };
}
