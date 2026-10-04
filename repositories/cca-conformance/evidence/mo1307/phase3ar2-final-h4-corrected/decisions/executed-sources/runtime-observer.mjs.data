const state=globalThis[Symbol.for('mo1307.final.observer')];
const original=await import(state.urls.runtime);
export function createSupervisor(options){const supervisor=original.createSupervisor(options);state.supervisors.push({supervisor,started:options.started,kind:options.kind,createdAt:performance.now()});return supervisor;}
