import { reject } from '../errors.mjs';
export const id='memoryos.cicd.adapter.github';
export const version='1.0.0';
export function normalizeMetadata(){reject('PROVIDER_UNSUPPORTED');}
export function project(){reject('PROVIDER_UNSUPPORTED');}
export function generate(){reject('PROVIDER_UNSUPPORTED');}
