import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { schemaValidator } from './schema.mjs';
import { parseJSON } from './json.mjs';
import { J } from './serialization.mjs';
import { reject, catalog, projections, project } from './errors.mjs';

export const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
export const limits = JSON.parse(readFileSync(new URL('../contracts/limits.json', import.meta.url)));
export const semanticIdentities = JSON.parse(readFileSync(new URL('../contracts/policy-contract-identities-1.0.0.json', import.meta.url)));
export const semanticErrorCodes = new Set(JSON.parse(readFileSync(new URL('../contracts/semantic-errors.json', import.meta.url))).codes);
const names = ['Configuration','Deployment','Invocation','Result','Evidence','Artifacts','Complete','Generation','Summary','WorkerRequest','WorkerResponse'];
const validators = new Map(names.map(name => {
  const filename = name.replace(/[A-Z]/g,(letter,index)=>(index?'-':'')+letter.toLowerCase());
  const schema = JSON.parse(readFileSync(new URL('../schemas/'+filename+'-1.0.0.schema.json', import.meta.url)));
  return [name, schemaValidator(schema)];
}));
export function validate(name, value, code = 'CONFIG_INVALID') {
  if (!validators.get(name)?.(name,value)) reject(code);
  return value;
}
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function relativeFile(value, code = 'FILESYSTEM_BOUNDARY') {
  if (typeof value !== 'string' || !value.length || value.length > 240 || !/^[A-Za-z0-9_. /-]+$/.test(value)) reject(code);
  const parts = value.split('/');
  if (parts.some(p => !p.length || p.length > 100 || p === '.' || p === '..' || /^[ ]|[ .]$/.test(p) || reserved.test(p))) reject(code);
  if (parts[0].toLowerCase() === '.memoryos-ci') reject(code);
  return value;
}
export function configuration(bytes) {
  const value = parseJSON(bytes, limits.fixed.configBytes);
  if (value && Object.hasOwn(value,'version') && value.version !== '1.0.0') reject('VERSION_UNSUPPORTED');
  for (const candidate of [value?.policy?.path,value?.policySet?.path,value?.context?.candidateMip,value?.context?.baselineMip]) {
    if (typeof candidate === 'string') relativeFile(candidate);
  }
  validate('Configuration',value);
  const selected = value.operation === 'evaluatePolicy' ? value.policy : value.policySet;
  const paths = [selected.path, value.context.candidateMip, ...(value.context.baselineMip === undefined ? [] : [value.context.baselineMip])];
  paths.forEach(p => relativeFile(p));
  if (new Set(paths.map(p => p.toLowerCase())).size !== paths.length) reject('FILESYSTEM_BOUNDARY');
  return {...value,timeoutMs:value.timeoutMs ?? 60000,providerExtensions:value.providerExtensions ?? {}};
}
export function deployment(bytes) {
  const value = validate('Deployment',parseJSON(bytes,16384,'GENERATION_INVALID'),'GENERATION_INVALID');
  if (value.provider === 'github') {
    relativeFile(value.options.configPath,'GENERATION_INVALID');
    if (value.options.repository.split('/').some(p => p.startsWith('.') || p.includes('..'))) reject('GENERATION_INVALID');
  }
  return value;
}
export function checkResult(value) {
  validate('Result',value,'BUNDLE_INTEGRITY');
  const row = projections[value.classification];
  if (value.process.exitCode !== row.exitCode || J(value.projection) !== J(project(value.classification))) reject('BUNDLE_INTEGRITY');
  if (['PASS','FAIL','COULD_NOT_EVALUATE'].includes(value.classification)) {
    if (!value.semantic || value.semantic.decision !== value.classification || value.error !== null || value.process.termination !== 'NORMAL') reject('BUNDLE_INTEGRITY');
  } else {
    if (value.semantic !== null || !value.error) reject('BUNDLE_INTEGRITY');
    const error = catalog.errors[value.error.code];
    if (error[0] !== value.classification || error[2] !== value.error.stage) reject('BUNDLE_INTEGRITY');
    if (value.error.semanticCode !== null && (value.error.code !== 'MO1306_SEMANTIC_VALIDATION' || !semanticErrorCodes.has(value.error.semanticCode))) reject('BUNDLE_INTEGRITY');
    const terminal = value.classification === 'TIMEOUT' || value.classification === 'CANCELLED' ? value.classification : ['MO1306_WORKER_EXIT','MO1306_INTERNAL_FAILURE'].includes(value.error.code) ? 'ABNORMAL' : 'NORMAL';
    if (value.process.termination !== terminal) reject('BUNDLE_INTEGRITY');
  }
  return value;
}
