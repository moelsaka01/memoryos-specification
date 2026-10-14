import { metadata } from '../metadata.mjs';
import { project as commonProject } from '../errors.mjs';
export const id = 'memoryos.cicd.adapter.generic';
export const version = '1.0.0';
export const normalizeMetadata = environment => metadata('generic',environment);
export const project = commonProject;
export function generate() { return []; }
