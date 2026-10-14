import { Worker } from 'node:worker_threads';
import { J } from './deterministic.mjs';
import { adapterError } from './errors.mjs';
import { catalog, matches, names, validateInput } from './contracts.mjs';

export const CANCELLED = Symbol('cancelled');
// SDK codecs copy result metadata; the owned transport removes this private
// correlation field before any serialization or publication. It is never wire metadata.
export const PUBLICATION_TOKEN = 'org.memoryos/stdio-generation';
/** One request owner. A ready result still occupies its slot until published/cancelled. */
export class Dispatcher {
  #active;
  #generation = 0;
  #limits;
  #catalog;
  #factory;
  #fatal;
  #poisoned = false;
  constructor(limits, identities, workerFactory = (url, options) => new Worker(url, options), fatal = () => {}) {
    this.#limits = limits; this.#catalog = catalog(identities); this.#factory = workerFactory; this.#fatal = fatal;
  }
  get active() { return this.#active !== undefined; }
  get generation() { return this.#generation; }
  get state() { return this.#active ? { id: this.#active.id, generation: this.#active.generation,
    phase: this.#active.phase } : undefined; }
  token(id) { return this.#active?.id === id ? this.#active.generation : undefined; }
  canPublish(id, generation) {
    const state = this.#active;
    return Boolean(state && state.id === id && state.generation === generation
      && state.phase === 'publication-ready' && !state.cancelled && !this.#poisoned);
  }
  async call(name, args, id, signal) {
    if (!validateInput(name, args) || Buffer.byteLength(J(args)) > this.#limits.argumentsBytes) {
      return adapterError('MO1304_INVALID_TOOL_INPUT', 'input');
    }
    if (this.#active || this.#poisoned) return adapterError('MO1304_BUSY', 'admission');
    if (signal?.aborted) return CANCELLED;
    const generation = ++this.#generation;
    let settle;
    const completion = new Promise((resolve) => { settle = resolve; });
    const state = { id, generation, settle, phase: 'admitted', cancelled: false, ready: false, settled: false,
      worker: undefined, timer: undefined, signal, abort: undefined, reaping: undefined, monitor: undefined };
    this.#active = state;
    state.abort = () => { void this.cancel(id); };
    signal?.addEventListener('abort', state.abort, { once: true });
    try {
      const worker = this.#factory(new URL('./worker.mjs', import.meta.url), {
        workerData: { name, args, generation, outputBytes: this.#limits.productBytes },
        execArgv: [], env: {}, stdout: true, stderr: true,
        resourceLimits: { maxOldGenerationSizeMb: this.#limits.workerHeapMiB,
          maxYoungGenerationSizeMb: this.#limits.workerYoungMiB, stackSizeMb: this.#limits.workerStackMiB },
      });
      state.worker = worker;
      if (state.cancelled) { await this.#reap(state); return completion; }
      state.phase = 'running';
      const finish = async (product) => {
        if (this.#active !== state || state.cancelled || state.ready) return;
        state.ready = true;
        state.phase = 'worker-settled';
        clearTimeout(state.timer); clearInterval(state.monitor);
        await this.#reap(state);
        if (state.cancelled || this.#active !== state) return;
        if (this.#poisoned) {
          state.phase = 'failed'; state.settled = true; state.settle(CANCELLED); return;
        }
        state.phase = 'publication-ready';
        state.settled = true;
        state.settle(product);
      };
      worker.on('message', (message) => {
        if (state.ready || state.cancelled || this.#active !== state) return;
        if (message?.generation !== generation) {
          void finish(adapterError('MO1304_INTERNAL_FAILURE', 'worker')); return;
        }
        let product;
        try {
          if (typeof message.text !== 'string' || Buffer.byteLength(message.text) > this.#limits.productBytes) throw 0;
          product = JSON.parse(message.text);
          if (!matches(this.#catalog[names.indexOf(name)].outputSchema, product)) throw 0;
        } catch { product = adapterError('MO1304_INTERNAL_FAILURE', 'worker'); }
        void finish(product);
      });
      worker.on('error', () => { void finish(adapterError('MO1304_INTERNAL_FAILURE', 'worker')); });
      worker.on('exit', () => {
        if (!state.ready && !state.cancelled) void finish(adapterError('MO1304_INTERNAL_FAILURE', 'worker'));
      });
      for (const stream of [worker.stdout, worker.stderr]) stream?.on('data', () => {
        void finish(adapterError('MO1304_INTERNAL_FAILURE', 'workerOutput'));
      });
      state.timer = setTimeout(() => { void finish(adapterError('MO1304_OPERATION_TIMEOUT', 'worker')); }, this.#limits.operationMs);
      const rssBaseline = process.memoryUsage().rss;
      let sampling = false;
      state.monitor = setInterval(() => {
        if (state.ready || state.cancelled) return;
        if (process.memoryUsage().rss - rssBaseline > this.#limits.parentAttributableBytes) {
          void finish(adapterError('MO1304_OUTPUT_LIMIT', 'memory')); return;
        }
        if (!sampling && typeof worker.getHeapStatistics === 'function') {
          sampling = true;
          void worker.getHeapStatistics().then(stats => {
            if (stats.external_memory > this.#limits.workerExternalBytes) void finish(adapterError('MO1304_OUTPUT_LIMIT', 'memory'));
          }, () => {}).finally(() => { sampling = false; });
        }
      }, 5);

    } catch {
      clearTimeout(state.timer); clearInterval(state.monitor);
      state.ready = true; state.settled = true;
      state.phase = 'publication-ready';
      state.settle(adapterError('MO1304_INTERNAL_FAILURE', 'worker'));
    }
    return completion;
  }
  #reap(state) {
    return state.reaping ??= (async () => {
      if (!state.worker) return;
      let timer;
      try {
        await Promise.race([state.worker.terminate(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('REAP_TIMEOUT')), this.#limits.shutdownMs);
        })]);
      } catch {
        this.#poisoned = true;
        this.#fatal();
      } finally {
        clearTimeout(timer);
        state.worker.removeAllListeners();
        for (const stream of [state.worker.stdout, state.worker.stderr]) {
          stream?.removeAllListeners('data'); stream?.destroy();
        }
        state.worker = undefined;
      }
    })();
  }
  async cancel(id) {
    const state = this.#active;
    if (!state || state.id !== id || state.phase === 'publication-handed-off') return false;
    state.cancelled = true;
    state.phase = 'cancel-requested';
    clearTimeout(state.timer); clearInterval(state.monitor);
    // A synchronous factory/abort race must attach its worker before cleanup settles.
    await Promise.resolve();
    await this.#reap(state);
    state.signal?.removeEventListener('abort', state.abort);
    if (!state.settled) { state.settled = true; state.settle(CANCELLED); }
    state.phase = this.#poisoned ? 'failed' : 'cancelled';
    state.signal = undefined; state.abort = undefined; state.settle = undefined;
    if (this.#active === state) this.#active = undefined;
    return true;
  }
  handoff(id, generation = this.token(id)) {
    if (!this.canPublish(id, generation)) return false;
    this.#active.phase = 'publication-handed-off';
    return true;
  }
  publish(id, generation = this.token(id)) {
    const state = this.#active;
    if (!state || state.id !== id || state.generation !== generation) return;
    if (!state.ready || state.cancelled) throw new Error('PUBLICATION_STATE');
    if (state.phase === 'publication-ready') this.handoff(id, generation);
    if (state.phase !== 'publication-handed-off') throw new Error('PUBLICATION_STATE');
    state.signal?.removeEventListener('abort', state.abort);
    state.phase = 'completed';
    state.signal = undefined; state.abort = undefined; state.settle = undefined;
    this.#active = undefined;
  }
  async close() {
    const state = this.#active;
    if (!state) return;
    if (state.phase === 'publication-handed-off') {
      // Transport has already settled or abandoned its bounded writer on shutdown.
      state.signal?.removeEventListener('abort', state.abort);
      state.phase = 'failed'; this.#active = undefined; return;
    }
    await this.cancel(state.id);
  }
}
