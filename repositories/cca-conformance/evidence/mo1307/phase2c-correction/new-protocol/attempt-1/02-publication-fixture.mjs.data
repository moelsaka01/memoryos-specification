// Engineering-only framed transport. Synthetic records for owned ordinary
// fixtures do not certify native Windows identity or process cleanup.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFINITIONS as D } from '../../../memoryos-readiness/src/constants.mjs';
import { ReadinessError } from '../../../memoryos-readiness/src/errors.mjs';
import { resolveContained } from '../../../memoryos-readiness/src/windows-paths.mjs';
import { createHelperSequence, createPublicationInspection, decodeHelperRequest,
  encodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';

export const fixtureSession = '0'.repeat(64);
export const pendingName = 'memoryos-readiness-result.json.pending';
export const finalName = 'memoryos-readiness-result.json';
export const publicationOperations = ['CHECK_OUTPUT', 'INSPECT_OUTPUT_ROOT', 'CHECK_STAGE_ROOT', 'INSPECT_PENDING', 'CHECK_FINALIZATION'];
export function fixtureIdentity(finalPath, directory = false, overrides = {}) {
  return { attributes: directory ? 16 : 32, byteLength: 0, fileId: '0000000000000001',
    finalPath, isDirectory: directory, linkCount: 1, volumeSerial: '00000001', ...overrides };
}
export function syntheticChain(root, relative = null) {
  const full = relative === null ? root : resolveContained(root, relative);
  const drive = path.win32.parse(full).root;
  const paths = [drive];
  for (const part of full.slice(drive.length).split('\\').filter(Boolean)) paths.push(path.win32.join(paths.at(-1), part));
  return paths.map((item, index) => fixtureIdentity(item, relative === null || index < paths.length - 1));
}
export async function fixtureInspect(root, relative = null) {
  const chain = syntheticChain(root, relative);
  for (const item of chain) {
    const stat = await fs.lstat(item.finalPath, { bigint: true });
    assert.equal(stat.isSymbolicLink(), false);
    Object.assign(item, { attributes: stat.isDirectory() ? 16 : 32, isDirectory: stat.isDirectory(),
      fileId: stat.ino.toString(16).padStart(16, '0'), volumeSerial: (stat.dev & 0xffffffffn).toString(16).padStart(8, '0'),
      byteLength: Number(stat.size), linkCount: Number(stat.nlink) });
  }
  return chain;
}
export function fixtureRequest(sequence = 1, command = 'evaluate', root = 'C:\\Output', session = fixtureSession) {
  const file = (id, maxBytes, fileRoot = 'input') => ({ id, maxBytes, path: id + '.json', root: fileRoot });
  return { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session, sequence,
    operation: sequence >= 5 ? publicationOperations[sequence - 5]
      : sequence === 4 && command === 'evaluate' ? 'CHECK_OUTPUT' : 'READ_SET',
    roots: [{ id: sequence < 4 ? 'input' : command === 'verify' ? 'result' : 'output', path: sequence < 4 ? 'C:\\Input' : root }],
    files: sequence === 1 ? [file('authority', D.limits.authorityBytes), file('config', D.limits.configurationBytes)]
      : sequence === 2 ? [file('candidate', D.limits.candidateBytes), file('manifest', D.limits.manifestBytes)]
        : sequence === 3 ? [file('evidence', D.limits.rawSourceBytes)]
          : command === 'verify' && sequence === 4 ? [file('result', D.limits.resultBytes, 'result')] : [] };
}
export function fixtureResponse(request, chain = null) {
  const read = request.operation === 'READ_SET';
  const pending = ['INSPECT_PENDING', 'CHECK_FINALIZATION'].includes(request.operation);
  const absent = request.operation === 'CHECK_OUTPUT';
  return { kind: 'MemoryOSReadinessHelperResponse', version: '2.0.0', session: request.session,
    sequence: request.sequence, operation: request.operation, code: null,
    status: read ? 'OK' : absent ? 'ABSENT' : request.operation === 'CHECK_FINALIZATION' ? 'FINAL_ABSENT' : 'OK',
    roots: read ? request.roots.map(root => ({ id: root.id, identity: fixtureIdentity(root.path, true) }))
      : [{ id: absent ? 'output-parent' : pending ? 'pending' : 'output',
        chain: chain ?? syntheticChain(absent ? path.win32.dirname(request.roots[0].path) : request.roots[0].path, pending ? pendingName : null) }],
    files: request.files.map(file => ({ id: file.id, bytes: [], identity: fixtureIdentity(resolveContained(
      request.roots.find(root => root.id === file.root).path, file.path)) })) };
}
export function completedAcquisition(command = 'evaluate', root = 'C:\\Output', session = fixtureSession, parentChain = null) {
  const sequence = createHelperSequence(command, { session });
  for (let step = 1; step <= 4; step++) {
    const request = fixtureRequest(step, command, root, session);
    sequence.begin(request);
    sequence.complete(encodeHelperResponse(fixtureResponse(request, step === 4 ? parentChain : null), request));
    sequence.helperExited();
  }
  return sequence;
}
async function assertFixtureAbsent(file) {
  try { await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new ReadinessError('OUTPUT', 'PUBLICATION');
}
export async function fixtureInspection(root, { inspect = fixtureInspect, checkpoint = () => {}, observe = () => {} } = {}) {
  const parent = path.win32.dirname(root);
  const sequence = completedAcquisition('evaluate', root, fixtureSession, await inspect(parent, null));
  sequence.beginWorker(); sequence.endWorker();
  const inspection = createPublicationInspection(sequence, root, { checkpoint, exchange: async encoded => {
    const request = decodeHelperRequest(encoded);
    observe(request);
    const pending = ['INSPECT_PENDING', 'CHECK_FINALIZATION'].includes(request.operation);
    if (request.operation === 'CHECK_OUTPUT') await assertFixtureAbsent(root);
    if (request.operation === 'CHECK_FINALIZATION') await assertFixtureAbsent(path.win32.join(root, finalName));
    const chain = await inspect(request.operation === 'CHECK_OUTPUT' ? parent : root, pending ? pendingName : null);
    return { responseBytes: encodeHelperResponse(fixtureResponse(request, chain), request), exitConfirmed: true };
  } });
  return inspection;
}
