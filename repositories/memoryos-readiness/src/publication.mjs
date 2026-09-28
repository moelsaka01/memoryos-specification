import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFINITIONS } from './constants.mjs';
import { fail, ReadinessError } from './errors.mjs';
import { assertComponentChain, assertStableIdentity, resolveContained, validateAbsoluteRoot } from './windows-paths.mjs';

const FINAL = 'memoryos-readiness-result.json';
const PENDING = FINAL + '.pending';
const tokens = new WeakMap();
const limit = DEFINITIONS.limits.resultBytes;
function output() { fail('OUTPUT', 'PUBLICATION', null); }
function stateOf(token) {
  if (!token || typeof token !== 'object' || !tokens.has(token)) output();
  return tokens.get(token);
}
async function guarded(action) {
  try { return await action(); } catch (error) {
    if (error instanceof ReadinessError && ['MO1307_TIMEOUT', 'MO1307_CANCELLED'].includes(error.code)) throw error;
    output();
  }
}
async function chainAt(inspect, root, relative = null) {
  const chain = await inspect(root, relative);
  assertComponentChain(root, relative, chain, { stage: 'PUBLICATION' });
  return structuredClone(chain);
}
function sameChain(before, after) {
  if (before.length !== after.length) output();
  before.forEach((identity, index) => assertStableIdentity(identity, after[index], {
    directory: identity.isDirectory, stage: 'PUBLICATION',
  }));
}
async function absent(file) {
  try { await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  output();
}
function checkpoint(state) {
  // Deadline/cancellation ownership remains the Phase 2C wrapper. Invoking its
  // synchronous checkpoint immediately before commit prevents late success.
  if (state.checkpoint !== null) state.checkpoint();
}

// `inspect(root, relative|null)` is a required trusted native-policy hook and
// returns the complete root/ancestor/descendant identity chain. No Node-only
// fallback pretends lstat proves that every Windows reparse point is absent.
// This primitive deliberately does not launch a helper or acquire evidence.
export async function createPublication(root, { inspect, checkpoint: check = null } = {}) {
  return guarded(async () => {
    root = validateAbsoluteRoot(root, { stage: 'PUBLICATION' });
    resolveContained(root, PENDING, { stage: 'PUBLICATION' });
    if (typeof inspect !== 'function' || (check !== null && typeof check !== 'function')) output();
    const parent = path.win32.dirname(root);
    if (parent === root) output();
    const before = await chainAt(inspect, parent);
    if (check !== null) check();
    // No recursive mkdir and no pre-existing destination is accepted.
    await fs.mkdir(root, { recursive: false, mode: 0o700 });
    const created = await chainAt(inspect, root);
    sameChain(before, created.slice(0, -1));
    const token = Object.freeze(Object.create(null));
    tokens.set(token, { root, inspect, checkpoint: check, chain: created, pendingChain: null,
      bytes: null, staged: false, consumed: false, busy: false });
    return token;
  });
}

export async function stagePublication(token, input) {
  const state = stateOf(token);
  if (state.consumed || state.staged || state.busy) output();
  state.busy = true;
  try {
    return await guarded(async () => {
      if (!(input instanceof Uint8Array) || input.buffer instanceof SharedArrayBuffer
          || input.byteLength === 0 || input.byteLength > limit
          || input.byteLength > DEFINITIONS.limits.temporaryOutputBytes) output();
      const bytes = Buffer.from(input);
      checkpoint(state);
      sameChain(state.chain, await chainAt(state.inspect, state.root));
      const pending = path.win32.join(state.root, PENDING);
      // Exclusive creation prevents replacement even before the commit point.
      const handle = await fs.open(pending, 'wx+', 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || stat.size !== bytes.byteLength) output();
        const verify = Buffer.alloc(bytes.byteLength + 1);
        let used = 0;
        while (used < verify.length) {
          const { bytesRead } = await handle.read(verify, used, verify.length - used, used);
          if (bytesRead === 0) break;
          used += bytesRead;
        }
        if (used !== bytes.byteLength || !verify.subarray(0, used).equals(bytes)) output();
      } finally { await handle.close(); }
      const pendingChain = await chainAt(state.inspect, state.root, PENDING);
      sameChain(state.chain, pendingChain.slice(0, -1));
      if (pendingChain.at(-1).byteLength !== bytes.byteLength) output();
      state.bytes = bytes; state.pendingChain = pendingChain; state.staged = true;
    });
  } catch (error) { state.consumed = true; throw error; }
  finally { state.busy = false; }
}

export async function finalizePublication(token) {
  const state = stateOf(token);
  if (state.consumed || !state.staged || state.busy) output();
  state.consumed = true;
  return guarded(async () => {
    sameChain(state.chain, await chainAt(state.inspect, state.root));
    sameChain(state.pendingChain, await chainAt(state.inspect, state.root, PENDING));
    const pending = path.win32.join(state.root, PENDING);
    const final = path.win32.join(state.root, FINAL);
    const handle = await fs.open(pending, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size !== state.bytes.byteLength) output();
      const verify = Buffer.alloc(state.bytes.byteLength + 1);
      let used = 0;
      while (used < verify.length) {
        const { bytesRead } = await handle.read(verify, used, verify.length - used, used);
        if (bytesRead === 0) break;
        used += bytesRead;
      }
      if (used !== state.bytes.byteLength || !verify.subarray(0, used).equals(state.bytes)) output();
    } finally { await handle.close(); }
    await absent(final);
    checkpoint(state);
    // Windows Node rename has kernel replacement capability. Nonreplacement
    // here depends explicitly on Freeze §17's private/exclusive host roots and
    // exclusion of concurrent adversarial namespace mutation: exact identity
    // and absence are checked, and the single-use token prevents our own retry
    // or overlapping publication. This is not a race-proof syscall guarantee
    // against a concurrent attacker excluded by that frozen precondition.
    await fs.rename(pending, final);
    return Object.freeze({ path: final, byteLength: state.bytes.byteLength });
  });
}
