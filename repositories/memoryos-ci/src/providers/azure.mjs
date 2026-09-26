import { readFileSync } from 'node:fs';
import { metadata } from '../metadata.mjs';
import { project as commonProject, reject } from '../errors.mjs';
import { configuration, validate, digest } from '../contracts.mjs';
import { J } from '../serialization.mjs';
export const id='memoryos.cicd.adapter.azure';
export const version='1.0.0';
export const normalizeMetadata=environment=>metadata('azure',environment);
export const project=commonProject;
const template=readFileSync(new URL('../../templates/azure.yml.tpl',import.meta.url),'utf8');

/** Closed Azure Pipelines subset: data fields are labels and SHA-256 pins. */
export function generate(config,deployment) {
  config=configuration(Buffer.from(J(config)));
  validate('Deployment',deployment,'GENERATION_INVALID');
  if(deployment.provider!=='azure')reject('GENERATION_INVALID');
  const configurationDigest=digest(J(config)),distributionDigest=deployment.distributionDigest,pool=deployment.options.pool;
  const yaml=template.replace('{{pool}}',pool).replace('{{configurationDigest}}',configurationDigest).replace('{{distributionDigest}}',distributionDigest);
  if(yaml.includes('{{')||yaml.includes('\r')||!yaml.endsWith('\n')||yaml.endsWith('\n\n'))reject('GENERATION_INVALID');
  return [{path:'azure-pipelines.yml',bytes:Buffer.from(yaml,'utf8')}];
}
