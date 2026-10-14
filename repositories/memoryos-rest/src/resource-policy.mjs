import { limits } from './contracts.mjs';
/** Absolute committed/attributable byte samples; equality is permitted. */
export function memoryExceeded(samples){return Object.entries(samples).some(([name,bytes])=>!Number.isSafeInteger(bytes)||bytes<0||!Number.isSafeInteger(limits.measured[name])||bytes>limits.measured[name]*1048576);}
export const withinBytes=(bytes,maximum)=>Number.isSafeInteger(bytes)&&bytes>=0&&bytes<=maximum;
