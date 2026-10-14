import { J } from './serialization.mjs';
import { reject } from './errors.mjs';

export const mappings = Object.freeze({
  generic:[],
  github:['GITHUB_REPOSITORY','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_JOB','GITHUB_RUN_ATTEMPT','GITHUB_EVENT_NAME',null],
  gitlab:['CI_PROJECT_PATH','CI_COMMIT_SHA','CI_PIPELINE_ID','CI_JOB_ID',null,'CI_PIPELINE_SOURCE','CI_MERGE_REQUEST_IID'],
  jenkins:['JOB_NAME','GIT_COMMIT','BUILD_NUMBER','BUILD_TAG',null,null,'CHANGE_ID'],
  azure:['BUILD_REPOSITORY_NAME','BUILD_SOURCEVERSION','BUILD_BUILDID','SYSTEM_JOBID','SYSTEM_JOBATTEMPT','BUILD_REASON','SYSTEM_PULLREQUEST_PULLREQUESTID'],
});
const fields = ['repository','revision','runId','jobId','attempt','event','changeRequest'];
export function metadata(provider, environment) {
  const mapping = mappings[provider];
  if (!mapping || !environment || ![Object.prototype,null].includes(Object.getPrototypeOf(environment))) reject('METADATA_INVALID');
  if (Object.keys(environment).some(k => !mapping.includes(k))) reject('METADATA_INVALID');
  const result = {provider};
  for (const [index,field] of fields.entries()) {
    const key = mapping[index]; let value = key ? environment[key] : null;
    if (value === undefined || value === '' || value === null) { result[field] = null; continue; }
    if (typeof value !== 'string') reject('METADATA_INVALID');
    if (field === 'revision') {
      if (!/^[0-9A-Fa-f]{40}$/.test(value)) reject('METADATA_INVALID'); value = value.toLowerCase();
    } else if (field === 'attempt') {
      if (!/^[1-9][0-9]{0,3}$/.test(value) || Number(value) > 1000) reject('METADATA_INVALID'); value = Number(value);
    } else if (field === 'changeRequest') {
      if (!/^[0-9]{1,20}$/.test(value)) reject('METADATA_INVALID');
    } else {
      const maximum = field === 'event' ? 64 : ['runId','jobId'].includes(field) ? 128 : 256;
      if (value.length > maximum || !/^[A-Za-z0-9_./:@-]+$/.test(value) || value.includes('://') || value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.split('/').some(p => p === '.' || p === '..')) reject('METADATA_INVALID');
    }
    result[field] = value;
  }
  if (Buffer.byteLength(J(result)) > 4096) reject('METADATA_INVALID');
  return result;
}
export function readMetadataEnvironment(provider) {
  if (!Object.hasOwn(mappings,provider)) reject('PROVIDER_UNSUPPORTED');
  return Object.fromEntries(mappings[provider].filter(Boolean).map(k => [k,process.env[k] ?? null]));
}
