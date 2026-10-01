const state=globalThis[Symbol.for('mo1307.final.observer')];
const original=await import(state.urls.errors);
export const errorExit=original.errorExit;
export function operationalError(error,...args){state.errors.push({at:performance.now(),error});return original.operationalError(error,...args);}
