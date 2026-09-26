import { metadata } from '../metadata.mjs';
import { project as commonProject } from '../errors.mjs';
import { readFileSync } from 'node:fs';
import { render } from './render.mjs';
export const id='memoryos.cicd.adapter.jenkins';
export const version='1.0.0';
export const normalizeMetadata=environment=>metadata('jenkins',environment);
export const project=commonProject;
const template=readFileSync(new URL('../../templates/jenkins.groovy.tpl',import.meta.url),'utf8');
export function generate(config,deployment) {
  return [{path:'Jenkinsfile',bytes:render(template,'jenkins',config,deployment)}];
}
