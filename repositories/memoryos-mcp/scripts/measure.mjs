import { Worker } from 'node:worker_threads';
import { Writable } from 'node:stream';
import { strictJson } from '../src/json.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { platform, release, arch } from 'node:os';
import { measurementCorpus } from '../tests/corpus.mjs';
import { J } from '../src/deterministic.mjs';
import { catalog, listingResult, toolResult } from '../src/contracts.mjs';
import { contractIdentityPin, PACKAGE_ROOT, sha256 } from '../src/integrity.mjs';
import { validateLimits } from '../src/limits.mjs';

const mib = 1024 * 1024;
const nextMiB = (value) => Math.floor(2 * value / mib) + 1;
const nextSecond = (value) => (Math.floor(4 * value / 1000) + 1) * 1000;
const ceilKiB = (value) => Math.ceil(value / 1024) * 1024;
function maximum(schema) {
  if ('const' in schema) return schema.const;
  if (schema.type === 'null') return null;
  if (schema.enum) return schema.enum.reduce((a, b) => J(a).length > J(b).length ? a : b);
  if (schema.oneOf || schema.anyOf) return (schema.oneOf ?? schema.anyOf).map(maximum).reduce((a, b) => J(a).length > J(b).length ? a : b);
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, maximum(value)]));
  if (schema.type === 'string') return schema.pattern?.includes('sha256') ? `sha256:${'f'.repeat(64)}`
    : schema.pattern ? 'A'.repeat(schema.maxLength) : '\u202e'.repeat(schema.maxLength);
  if (Array.isArray(schema.type)) return schema.type.includes('boolean') ? false : null;
  throw new Error('UNBOUNDED_SCHEMA');
}
async function observe(entry) {
  const parentBefore = process.memoryUsage();
  const started = performance.now();
  return await new Promise((resolvePromise, reject) => {
    const worker = new Worker(new URL('./measurement-worker.mjs', import.meta.url), {
      workerData: entry, execArgv: [], env: {}, stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 1024, maxYoungGenerationSizeMb: 64, stackSizeMb: 8 },
    });
    let observation; let terminationStarted; let peakHeap = 0; let peakExternal = 0; let heapSamples = 0; let polling = false;
    let peakRSS = parentBefore.rss;
    const sample = setInterval(() => {
      peakRSS = Math.max(peakRSS, process.memoryUsage().rss);
      if (!polling) { polling = true; void worker.getHeapStatistics().then(stats => {
        peakHeap = Math.max(peakHeap, stats.used_heap_size); peakExternal = Math.max(peakExternal, stats.external_memory); heapSamples++;
      }, () => {}).finally(() => { polling = false; }); }
    }, 5);
    const deadline = setTimeout(() => { void worker.terminate(); reject(new Error('MEASUREMENT_TIMEOUT')); }, 60000);
    worker.on('message', (value) => { observation = value; terminationStarted = performance.now(); void worker.terminate(); });
    worker.on('error', reject);
    for (const stream of [worker.stdout, worker.stderr]) stream.on('data', () => reject(new Error('MEASUREMENT_OUTPUT')));
    worker.on('exit', (code) => {
      clearInterval(sample); clearTimeout(deadline);
      if (![0, 1].includes(code) || !observation || observation.status !== 'ok') {
        reject(new Error(`MEASUREMENT_FAILED:${entry.label}:${observation?.errorCode ?? code}`)); return;
      }
      resolvePromise({ ...observation, totalMs: performance.now() - started, parentBefore,
        parentAfter: process.memoryUsage(), peakRSS, peakHeap, peakExternal, heapSamples, terminationMs: performance.now() - terminationStarted });
    });
  });
}
if (process.versions.node !== '24.21.0') throw new Error('WRONG_RUNTIME');
const identities = await contractIdentityPin();
const tools = catalog(identities);
const corpus = await measurementCorpus();
const observations = [];
for (const mode of ['cold', 'warm']) {
  for (const entry of corpus) {
    for (let repetition = 0; repetition < 30; repetition++) observations.push({ mode, label: entry.label, repetition, ...await observe(entry) });
    process.stdout.write(`${mode}: ${entry.label}: 30/30\n`);
  }
}
const maximumArgumentBytes = Math.max(...tools.map((tool) => Buffer.byteLength(J(maximum(tool.inputSchema)))));
const maximumProductBytes = Math.max(...tools.map((tool) => Buffer.byteLength(J(maximum(tool.outputSchema)))));
const maximumCallBytes = Math.max(...tools.map((tool) => Buffer.byteLength(J(toolResult(maximum(tool.outputSchema))))));
const listingBytes = Buffer.byteLength(J(listingResult(tools)));
const transportObservations = [];
const maximalArguments = tools.map((tool) => maximum(tool.inputSchema)).sort((a, b) => J(b).length - J(a).length)[0];
const wire = J({ jsonrpc: '2.0', id: 'r'.repeat(128), method: 'tools/call', params: {
  name: 'memoryos_evaluate_policy', arguments: maximalArguments,
  _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {}, padding: 'x'.repeat(7900) },
} });
// Every string code unit (including member names) uses the six-byte JSON escape.
const input = Buffer.from(wire.replace(/"(?:[^"\\]|\\.)*"/gu, token => '"' + [...JSON.parse(token)].map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('') + '"'));
const response = Buffer.alloc(Math.max(listingBytes, maximumCallBytes) + 1792, 32);
for (const mode of ['cold', 'warm']) for (let repetition = 0; repetition < 30; repetition++) {
  const start = performance.now();
  let assembled = Buffer.alloc(0);
  for (let offset = 0; offset < input.length; offset += 65536) assembled = Buffer.concat([assembled, input.subarray(offset, offset + 65536)]);
  strictJson(assembled, { requestFrameBytes: input.length + 1, jsonDepth: 16, jsonNodes: 1024, jsonMembers: 512, jsonStringCodeUnits: 4 * Math.ceil(524288 / 3) });
  const frameMs = performance.now() - start;
  const writer = new Writable({ highWaterMark: 1, write(chunk, encoding, callback) { setImmediate(callback); } });
  const writeStart = performance.now();
  await new Promise((resolveWrite, rejectWrite) => writer.write(response, (error) => error ? rejectWrite(error) : resolveWrite()));
  const drainMs = performance.now() - writeStart;
  writer.destroy();
  transportObservations.push({ mode, repetition, frameMs, drainMs, memory: process.memoryUsage() });
}
const worstTotalMs = Math.max(...observations.map((item) => item.totalMs), ...transportObservations.flatMap((item) => [item.frameMs, item.drainMs]));
const worstHeap = Math.max(...observations.map((item) => Math.max(item.initial.heapUsed, item.final.heapUsed, item.peakHeap)));
const worstExternal = Math.max(...observations.map((item) => Math.max(item.initial.external + item.initial.arrayBuffers, item.final.external + item.final.arrayBuffers, item.peakExternal)));
const parentAttributable = Math.max(...observations.map((item) => Math.max(0, item.peakRSS - item.parentBefore.rss)),
  ...transportObservations.map(item => Math.max(0, item.memory.rss - observations[0].parentBefore.rss)));
const values = {
  requestFrameBytes: ceilKiB(6 * (maximumArgumentBytes + 8192) + 6 * 128 + 1024),
  responseFrameBytes: ceilKiB(Math.max(listingBytes, maximumCallBytes) + 6 * 128 + 1024),
  argumentsBytes: maximumArgumentBytes, productBytes: maximumProductBytes,
  metadataBytes: 8192, requestIdCodeUnits: 128, jsonStringCodeUnits: 4 * Math.ceil(524288 / 3),
  jsonDepth: 16, jsonNodes: 1024, jsonMembers: 512, inputChunkBytes: 65536, diagnosticBytes: Buffer.byteLength('MO1304_FATAL\n'),
  workerHeapMiB: nextMiB(worstHeap), workerYoungMiB: nextMiB(worstHeap), workerStackMiB: 8,
  workerExternalBytes: nextMiB(worstExternal) * mib, parentAttributableBytes: nextMiB(parentAttributable) * mib,
  requestsPerSecond: Math.max(2 * (tools.length + 4), Math.floor(1000 / Math.max(1, worstTotalMs))),
  controlsPerSecond: Math.max(2 * (tools.length + 4), Math.floor(1000 / Math.max(1, worstTotalMs))),
  partialFrameMs: nextSecond(worstTotalMs), operationMs: nextSecond(worstTotalMs),
  outputDrainMs: nextSecond(worstTotalMs), shutdownMs: nextSecond(worstTotalMs),
};
const limits = { kind: 'MemoryOSMCPResourceLimits', version: '1.0.0', status: 'measured', values };
validateLimits(limits);
const receipt = { kind: 'MemoryOSMCPResourceMeasurement', version: '1.0.0', node: process.versions.node,
  host: { platform: platform(), release: release(), arch: arch() },
  coldDefinition: 'Fresh worker/module graph and SDK owner on every sample; first corpus sweep.',
  warmDefinition: 'Second corpus sweep with warmed parent/filesystem caches; workers and SDK owners remain fresh.',
  repetitionsPerModePerOperation: 30, corpus: corpus.map((entry) => ({ label: entry.label, name: entry.name,
    argumentsByteLength: Buffer.byteLength(J(entry.args)), argumentsSha256: sha256(Buffer.from(J(entry.args))) })),
  analytical: { maximumArgumentBytes, maximumProductBytes, maximumCallBytes, listingBytes,
    requestMetadataBudget: 8192, idWorstEscapeBytes: 768, envelopeBudget: 1024,
    semanticOperations: 1, semanticQueue: 0, subscriptions: 1, controlSlots: 1, outputFrames: 2,
    retainedBufferBoundBytes: 3 * values.requestFrameBytes + values.inputChunkBytes + 2 * values.responseFrameBytes,
    wireInputBytes: input.length, worstEscapingFactor: 6,
    parentRetention: { frameBuffers: 3, inputChunks: 1, utf16FrameCopies: 3, parsedRequestCopies: 2,
      queuedResponseFrames: 2, productCopies: 4, workerInputCloneCopies: 1,
      conservativeByteBound: 9 * values.requestFrameBytes + values.inputChunkBytes + 6 * values.argumentsBytes + 12 * values.productBytes + 2 * values.responseFrameBytes },
    retentionNotes: 'Bounds cover application-owned admission/serialization copies; V8 object overhead, SDK/module memory and GC slack are measured separately. One semantic owner, three correlated IDs and two output frames; stream read highWaterMarks and 64 KiB reads bound producer retention. Worker external memory is monitored, not included as parent-only heap.',
    structuralBudgets: 'Depth 16, nodes 1024, members 512, metadata 8192 are admission policies; tested at their boundaries.' },
  derivation: { worstTotalMs, worstHeap, worstExternal, parentAttributable,
    memoryRule: 'floor(2 * observedPeak / 1048576) + 1 MiB', deadlineRule: '(floor(4 * observedMs / 1000) + 1) * 1000 ms' },
  transportObservations, observations, limits, status: 'MEASURED_NOT_PLATFORM_CERTIFIED' };
await mkdir(resolve(PACKAGE_ROOT, 'measurements'), { recursive: true });
receipt.sampling = { intervalMs: 5, heap: 'Worker.getHeapStatistics used_heap_size plus worker endpoints', external: 'Worker external_memory plus conservative endpoint external+arrayBuffers; endpoints double-count ArrayBuffers deliberately', rss: 'process.memoryUsage sampled in parent; RSS is process-wide, not worker heap', limitation: 'Observed sampled peaks are not instantaneous allocation maxima; finite admission and retention analysis remain necessary.' };
receipt.integritySourceSha256 = sha256(await readFile(new URL('../src/integrity.mjs', import.meta.url)));
receipt.corpusScriptSha256 = sha256(await readFile(new URL('../tests/corpus.mjs', import.meta.url)));
receipt.catalogSha256 = sha256(Buffer.from(J(tools)));
receipt.measurementScriptSha256 = sha256(await readFile(new URL('./measure.mjs', import.meta.url)));
await writeFile(resolve(PACKAGE_ROOT, 'measurements/resource-measurement.json'), `${J(receipt)}\n`);
await writeFile(resolve(PACKAGE_ROOT, 'contracts/limits.json'), `${J(limits)}\n`);
process.stdout.write(`${J(values)}\n`);
