// Engineering-only filesystem-backed framed double. Node observations below
// are SYNTHETIC identity evidence and explicitly do not certify native checks.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { fixtureInspect, fixtureResponse } from '../mo1307-phase2c-correction/publication-fixture.mjs';
import { decodeHelperRequest, encodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { resolveContained } from '../../../memoryos-readiness/src/windows-paths.mjs';
import { ReadinessError } from '../../../memoryos-readiness/src/errors.mjs';
export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const workerURL = new URL('./fixed-result-worker.mjs', import.meta.url);
export const finalName = 'memoryos-readiness-result.json';
export async function bundle(name = 'ready') {
  const directory = path.join(root, 'repositories/cca-conformance/fixtures/mo1307/bundles', name);
  const read = leaf => fs.readFile(path.join(directory, leaf));
  const pins = JSON.parse(await read('pins.json'));
  const manifestBytes = await read('manifest.json'), manifest = JSON.parse(manifestBytes);
  const input = { configurationBytes: await read('configuration.json'), candidateBytes: await read('candidate.json'),
    authorityBytes: await read('authority.json'), manifestBytes,
    files: await Promise.all(manifest.entries.map(async entry => ({ id: entry.id, bytes: await read(entry.path) }))),
    expectedCandidateDigest: pins.expectedCandidateDigest, trustedAuthorityDigest: pins.trustedAuthorityDigest };
  return { directory, pins, input, resultBytes: await read('expected-result.json') };
}
export function launchFor(data, outputRoot, command = 'evaluate', decision = null, format = 'json') {
  return { command, inputRoot: data.directory, config: 'configuration.json', authority: 'authority.json',
    expectedCandidateDigest: data.pins.expectedCandidateDigest, trustedAuthorityDigest: data.pins.trustedAuthorityDigest,
    outputRoot: command === 'evaluate' ? outputRoot : null, resultRoot: command === 'verify' ? outputRoot : null,
    decision, format };
}
export function capture(failWrite = false) {
  const chunks = [];
  const stream = new Writable({ write(chunk, _encoding, callback) { if (failWrite) callback(new Error('sentinel secret')); else { chunks.push(Buffer.from(chunk)); callback(); } } });
  stream.on('error', () => {});
  return { stream, bytes: () => Buffer.concat(chunks) };
}
export function syntheticExchange(observe = () => {}) {
  return async frame => {
    const request = decodeHelperRequest(frame); observe(request);
    const response = fixtureResponse(request);
    if (request.operation === 'READ_SET') {
      response.roots = await Promise.all(request.roots.map(async r => ({ id: r.id, identity: (await fixtureInspect(r.path)).at(-1) })));
      response.files = await Promise.all(request.files.map(async f => {
        const r = request.roots.find(r => r.id === f.root);
        const bytes = await fs.readFile(resolveContained(r.path, f.path));
        return { id: f.id, identity: (await fixtureInspect(r.path, f.path)).at(-1), bytes: bytes.toString('base64').match(/.{1,4096}/g) ?? [] };
      }));
    } else {
      const destination = request.roots[0].path;
      const pending = ['INSPECT_PENDING', 'CHECK_FINALIZATION'].includes(request.operation);
      if (['CHECK_OUTPUT', 'CHECK_FINALIZATION'].includes(request.operation)) {
        try { await fs.stat(request.operation === 'CHECK_OUTPUT' ? destination : path.join(destination, finalName));
          throw new ReadinessError('OUTPUT', 'PUBLICATION');
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      response.roots[0].chain = await fixtureInspect(request.operation === 'CHECK_OUTPUT' ? path.dirname(destination) : destination, pending ? finalName + '.pending' : null);
    }
    return { responseBytes: encodeHelperResponse(response, request), exitConfirmed: true };
  };
}
