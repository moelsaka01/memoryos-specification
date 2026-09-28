import { registerHooks } from 'node:module';

// Fixed, reviewed closure only. These controls restrict product code; they do
// not purport to sandbox a hostile embedding host or already-preloaded code.
export function installWorkerPolicy() {
  const modules = new Set(['canonical.mjs', 'constants.mjs', 'errors.mjs', 'foundation.mjs',
    'schema.mjs', 'schema-data.mjs', 'windows-paths.mjs', 'integration.mjs', 'projections.mjs',
    'evidence-verifier.mjs', 'evidence-graph.mjs', 'evidence-history.mjs', 'readiness-core.mjs', 'readiness-result.mjs']);
  const urls = new Set([...modules].map(name => new URL(name, import.meta.url).href));
  const primitives = new Set(['node:crypto', 'node:path']);
  const deny = () => { throw new Error('MO1307_INTERNAL'); };
  registerHooks({ resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (!primitives.has(resolved.url) && !urls.has(resolved.url)) deny();
    return resolved;
  } });
  Object.defineProperty(process, 'getBuiltinModule', { value: deny, configurable: false, writable: false });
  for (const name of ['fetch', 'WebSocket', 'EventSource']) {
    Object.defineProperty(globalThis, name, { value: deny, configurable: false, writable: false });
  }
}
