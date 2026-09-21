import { setImmediate as turn } from 'node:timers/promises';
import { ClientCapabilitiesSchema } from '@modelcontextprotocol/core';
import { strictJson } from './json.mjs';
import { J } from './deterministic.mjs';
import { PROTOCOL, names, validateInput, toolResult, exactCacheDirectives } from './contracts.mjs';
import { adapterError } from './errors.mjs';

const messages = new Map([[-32700, 'Parse error'], [-32600, 'Invalid Request'], [-32601, 'Method not found'],
  [-32602, 'Invalid params'], [-32603, 'Internal error'], [-32022, 'Unsupported protocol version']]);
const methods = new Set(['server/discover', 'tools/list', 'tools/call', 'subscriptions/listen', 'initialize']);
const own = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Bounded byte/framing boundary implementing the official SDK Transport interface. */
export class BoundedStdioTransport {
  #input; #output; #limits; #dispatcher; #fatal;
  #buffer = Buffer.alloc(0); #closed = false; #started = false; #pumping = false; #eof = false;
  #control; #partialTimer; #pending = new Map(); #subscription; #writes = 0; #tail = Promise.resolve();
  #window = 0; #requests = 0; #controls = 0;
  constructor(input, output, limits, dispatcher, fatal = () => {}) {
    this.#input = input; this.#output = output; this.#limits = limits;
    this.#dispatcher = dispatcher; this.#fatal = fatal;
  }
  onmessage; onclose; onerror; onend;
  setProtocolVersion() {}
  async start() {
    if (this.#started) throw new Error('ALREADY_STARTED');
    this.#started = true;
    this.#input.on('readable', this.#readable);
    this.#input.on('end', this.#ended);
    this.#input.on('error', this.#ioError);
    this.#output.on('error', this.#ioError);
    void this.#pump();
  }
  #readable = () => { void this.#pump(); };
  #ended = () => { this.#eof = true; void this.#pump(); };
  #ioError = () => { void this.fail('MO1304_TRANSPORT_FAILURE'); };
  async #pump() {
    if (this.#closed || this.#pumping) return;
    this.#pumping = true;
    try {
      while (!this.#closed) {
        if (this.#writes >= 2) await this.#tail;
        const newline = this.#buffer.indexOf(10);
        if (newline >= 0) {
          const frame = this.#buffer.subarray(0, newline);
          this.#buffer = Buffer.from(this.#buffer.subarray(newline + 1));
          clearTimeout(this.#partialTimer); this.#partialTimer = undefined;
          if (frame.length + 1 > this.#limits.requestFrameBytes) throw 0;
          await this.#frame(frame.at(-1) === 13 ? frame.subarray(0, -1) : frame);
          await turn();
          continue;
        }
        if (this.#eof) {
          if (this.#buffer.length) throw 0;
          if (this.onend) await this.onend(); else await this.close();
          return;
        }
        const available = this.#input.readableLength;
        if (!available) break;
        const chunk = this.#input.read(Math.min(available, this.#limits.inputChunkBytes));
        if (!chunk) break;
        if (!Buffer.isBuffer(chunk) || chunk.length > this.#limits.inputChunkBytes
          || this.#buffer.length + chunk.length > this.#limits.requestFrameBytes + this.#limits.inputChunkBytes) throw 0;
        this.#buffer = Buffer.concat([this.#buffer, chunk]);
        if (this.#buffer.indexOf(10) < 0 && this.#buffer.length >= this.#limits.requestFrameBytes) throw 0;
        if (!this.#partialTimer) this.#partialTimer = setTimeout(() => { void this.fail('MO1304_FRAME_TIMEOUT'); }, this.#limits.partialFrameMs);
      }
    } catch { await this.fail('MO1304_TRANSPORT_FAILURE'); }
    finally { this.#pumping = false; }
  }
  #idValid(id) {
    return typeof id === 'string' && id.isWellFormed() && id.length <= this.#limits.requestIdCodeUnits
      || typeof id === 'number' && Number.isSafeInteger(id);
  }
  async #frame(bytes) {
    const second = Math.floor(performance.now() / 1000);
    if (second !== this.#window) { this.#window = second; this.#requests = 0; this.#controls = 0; }
    if (++this.#requests > this.#limits.requestsPerSecond) throw 0;
    // UTF-8 failures are fatal; syntactically malformed complete UTF-8 frames may receive an error.
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw 0; }
    let message;
    try { message = strictJson(bytes, this.#limits); }
    catch (error) { await this.#error(undefined, error.code ?? -32700); return; }
    if (!own(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string'
      || Object.keys(message).some((key) => !['jsonrpc', 'id', 'method', 'params'].includes(key))) {
      await this.#error(own(message) && this.#idValid(message.id) ? message.id : undefined, -32600); return;
    }
    if (message.method !== 'tools/call' && ++this.#controls > this.#limits.controlsPerSecond) throw 0;
    if (!Object.hasOwn(message, 'id')) {
      if (message.method !== 'notifications/cancelled') return;
      if (!own(message.params) || !this.#idValid(message.params.requestId)
        || Object.keys(message.params).some((key) => !['requestId', 'reason', '_meta'].includes(key))
        || message.params.reason !== undefined && typeof message.params.reason !== 'string') return;
      const state = this.#pending.get(message.params.requestId);
      if (!state || state.sent) return;
      state.cancelled = true;
      if (this.#subscription === message.params.requestId) this.#subscription = undefined;
      this.onmessage?.(message);
      await this.#dispatcher.cancel(message.params.requestId);
      await turn(); // Let the SDK abort its handler before an ID can be admitted again.
      if (this.#pending.get(message.params.requestId) === state) this.#pending.delete(message.params.requestId);
      if (this.#control === message.params.requestId) this.#control = undefined;
      return;
    }
    if (!this.#idValid(message.id)) { await this.#error(undefined, -32600); return; }
    if (this.#pending.has(message.id)) throw 0; // Ambiguous correlation: terminate rather than send a duplicate-ID response.
    if (this.#pending.size >= 3) throw 0;
    if (!['tools/call', 'subscriptions/listen'].includes(message.method)) {
      if (this.#control !== undefined) throw 0;
      this.#control = message.id;
    }
    this.#pending.set(message.id, { sent: false, cancelled: false });
    if (!methods.has(message.method)) { await this.#error(message.id, -32601); return; }
    if (message.method === 'initialize') {
      await this.#error(message.id, -32022, { supported: [PROTOCOL], requested: 'legacy' }); return;
    }
    if (!own(message.params) || !own(message.params._meta)) { await this.#error(message.id, -32602); return; }
    const meta = message.params._meta;
    if (Buffer.byteLength(J(meta)) > this.#limits.metadataBytes
      || typeof meta['io.modelcontextprotocol/protocolVersion'] !== 'string'
      || meta['io.modelcontextprotocol/protocolVersion'].length > 128
      || !ClientCapabilitiesSchema.safeParse(meta['io.modelcontextprotocol/clientCapabilities']).success) {
      await this.#error(message.id, -32602); return;
    }
    if (meta['io.modelcontextprotocol/protocolVersion'] !== PROTOCOL) {
      await this.#error(message.id, -32022, { supported: [PROTOCOL], requested: meta['io.modelcontextprotocol/protocolVersion'] }); return;
    }
    const allowed = message.method === 'tools/call' ? ['_meta', 'name', 'arguments']
      : message.method === 'subscriptions/listen' ? ['_meta', 'notifications'] : ['_meta'];
    if (Object.keys(message.params).some((key) => !allowed.includes(key))) {
      await this.#error(message.id, -32602); return;
    }
    if (message.method === 'tools/call' && names.includes(message.params.name)
      && !validateInput(message.params.name, message.params.arguments)) {
      await this.send({ jsonrpc: '2.0', id: message.id,
        result: toolResult(adapterError('MO1304_INVALID_TOOL_INPUT', 'input')) }); return;
    }
    this.onmessage?.(message);
  }
  #error(id, code, data) {
    return this.send({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }),
      error: { code, message: messages.get(code), ...(data ? { data } : {}) } });
  }
  async send(original) {
    if (this.#closed) return;
    if (this.#writes >= 2) { await this.fail('MO1304_OUTPUT_LIMIT'); return; }
    let message = original;
    if (message.result && (Object.hasOwn(message.result, 'tools') || Object.hasOwn(message.result, 'supportedVersions'))
      && !exactCacheDirectives(message.result)) { await this.fail('MO1304_OUTPUT_LIMIT'); return; }
    if (message.error) {
      const code = messages.has(message.error.code) ? message.error.code : -32603;
      message = { jsonrpc: '2.0', ...(this.#idValid(message.id) ? { id: message.id } : {}),
        error: { code, message: messages.get(code), ...(code === -32022 ? {
          data: { supported: [PROTOCOL], requested: typeof message.error.data?.requested === 'string'
            ? message.error.data.requested.slice(0, 128) : 'unknown' },
        } : {}) } };
    }
    const subscriptionId = message.result?._meta?.['io.modelcontextprotocol/subscriptionId'];
    if (subscriptionId !== undefined) {
      message = { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: subscriptionId } };
      this.#subscription = undefined;
    }
    const ackId = message.method === 'notifications/subscriptions/acknowledged'
      ? message.params?._meta?.['io.modelcontextprotocol/subscriptionId'] : undefined;
    if (ackId !== undefined) {
      this.#subscription = ackId;
      message = { jsonrpc: '2.0', method: 'notifications/subscriptions/acknowledged', params: {
        _meta: { 'io.modelcontextprotocol/subscriptionId': ackId }, notifications: {},
      } };
    }
    const state = this.#pending.get(message.id ?? ackId ?? subscriptionId);
    if (state?.cancelled) return;
    const frame = Buffer.from(`${J(message)}\n`);
    if (frame.length > this.#limits.responseFrameBytes) { await this.fail('MO1304_OUTPUT_LIMIT'); return; }
    this.#writes++;
    const write = this.#tail.then(async () => {
      if (this.#closed || state?.cancelled) return;
      if (state && ackId === undefined) state.sent = true;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('OUTPUT_TIMEOUT')), this.#limits.outputDrainMs);
        this.#output.write(frame, (error) => { clearTimeout(timer); error ? reject(error) : resolve(); });
      });
      if (message.id !== undefined) {
        this.#dispatcher.publish(message.id);
        if (this.#control === message.id) this.#control = undefined;
        if (this.#pending.get(message.id) === state) this.#pending.delete(message.id);
      }
      if (subscriptionId !== undefined) this.#pending.delete(subscriptionId);
    }).finally(() => { this.#writes--; });
    this.#tail = write.catch(() => { void this.fail('MO1304_TRANSPORT_FAILURE'); });
    await write;
  }
  async fail(code) {
    if (this.#closed) return;
    this.#fatal(code);
    await this.close();
  }
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    clearTimeout(this.#partialTimer);
    this.#input.off('readable', this.#readable); this.#input.off('end', this.#ended);
    this.#input.off('error', this.#ioError); this.#output.off('error', this.#ioError);
    this.#input.pause(); this.#buffer = Buffer.alloc(0);
    await this.#dispatcher.close();
    this.#pending.clear(); this.#subscription = undefined; this.#control = undefined;
    this.onclose?.();
  }
}
