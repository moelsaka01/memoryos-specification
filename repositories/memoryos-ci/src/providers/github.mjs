import { readFileSync } from 'node:fs';
import { metadata } from '../metadata.mjs';
import { project as commonProject, reject } from '../errors.mjs';
import { digest, deployment as validateDeployment } from '../contracts.mjs';
import { J } from '../serialization.mjs';
export const id='memoryos.cicd.adapter.github';
export const version='1.0.0';
export const normalizeMetadata=environment=>metadata('github',environment);
export const project=commonProject;
const template=readFileSync(new URL('../../templates/github.yml.tpl',import.meta.url),'utf8');
/** The immutable template contains every executable statement/expression. */
export function generate(config,deployment) {
  validateDeployment(Buffer.from(J(deployment)));
  if(deployment.provider!=='github')reject('GENERATION_INVALID');
  const replacements={REPOSITORY:deployment.options.repository,TOOL_REVISION:deployment.options.toolRevision,CONFIG_PATH:deployment.options.configPath.replaceAll('/','\\'),CONFIGURATION_DIGEST:digest(J(config)),DISTRIBUTION_DIGEST:deployment.distributionDigest};
  const yaml=template.replace(/@@([A-Z_]+)@@/g,(_,name)=>{if(!Object.hasOwn(replacements,name))reject('GENERATION_INVALID');return replacements[name];});
  if(yaml.includes('@@')||yaml.includes('\r')||!yaml.endsWith('\n')||yaml.endsWith('\n\n'))reject('GENERATION_INVALID');
  return [{path:'.github/workflows/memoryos-ci.yml',bytes:Buffer.from(yaml,'utf8')}];
}
