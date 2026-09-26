import * as generic from './providers/generic.mjs';
import * as github from './providers/github.mjs';
import * as gitlab from './providers/gitlab.mjs';
import * as jenkins from './providers/jenkins.mjs';
import * as azure from './providers/azure.mjs';
import { reject } from './errors.mjs';

// This is a closed dispatch table, not a plugin mechanism.  It deliberately
// contains no provider launch behavior: provider adapters retain ownership of
// their own frozen pure interface in later phases.
const adapters = Object.freeze({ generic, github, gitlab, jenkins, azure });

export const providerNames = Object.freeze(Object.keys(adapters));

export function providerIR(name) {
  if (typeof name !== 'string' || !Object.hasOwn(adapters, name)) reject('PROVIDER_UNSUPPORTED');
  const adapter = adapters[name];
  if (typeof adapter.id !== 'string' || adapter.version !== '1.0.0' ||
      typeof adapter.normalizeMetadata !== 'function' || typeof adapter.project !== 'function' ||
      typeof adapter.generate !== 'function') reject('RUNTIME_INTEGRITY');
  return adapter;
}

export function genericProvider(name) {
  const adapter = providerIR(name);
  // Phase 2A is the executable generic reference only.  This guard makes the
  // future adapter hand-off explicit without inventing provider semantics.
  if (name !== 'generic') reject('PROVIDER_UNSUPPORTED');
  return adapter;
}
