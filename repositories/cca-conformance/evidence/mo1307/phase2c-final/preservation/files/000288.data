import { DEFINITIONS } from './constants.mjs';
import { digest, parseCanonical } from './canonical.mjs';
import { fail, ReadinessError } from './errors.mjs';
import { selectPhaseError, validateRecord, validateCandidate, validateManifest } from './foundation.mjs';
import { structurallyEqual } from './schema.mjs';
import { assertDistinctFiles, assertStableIdentity, resolveContained } from './windows-paths.mjs';

const L = DEFINITIONS.limits;
const file = (id, path, maxBytes, root = 'input') => ({ id, path, maxBytes, root });

// Only validated explicit launch/config/manifest paths select snapshots. The
// exchange is the fixed native transport; it cannot select a script or command.
export async function acquireCliInputs(launch, sequence, exchange, checkpoint) {
  const roots = new Map(), identities = new Set();
  async function read(slot, requestRoots, files, operation = 'READ_SET') {
    const stage = slot < 3 ? 'CONFIGURATION' : 'ACQUISITION';
    checkpoint(stage);
    try {
      const frame = sequence.begin({ kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0',
        session: sequence.session, sequence: slot, operation, roots: requestRoots, files });
      const answer = await exchange(frame);
      if (!answer || answer.exitConfirmed !== true || Object.keys(answer).sort().join(',') !== 'exitConfirmed,responseBytes') fail('INTERNAL', stage);
      const response = sequence.complete(answer.responseBytes);
      if (response.status === 'ERROR') {
        if (operation === 'CHECK_OUTPUT') fail('OUTPUT', 'PUBLICATION');
        throw new ReadinessError(response.code, stage);
      }
      sequence.helperExited();
      checkpoint(stage);
      if (operation !== 'READ_SET') return response;
      for (const root of response.roots) {
        if (roots.has(root.id)) assertStableIdentity(roots.get(root.id), root.identity, { directory: true, stage });
        else roots.set(root.id, root.identity);
      }
      const snapshots = Object.create(null);
      for (const entry of response.files) {
        const key = entry.identity.volumeSerial + ':' + entry.identity.fileId;
        if (identities.has(key)) fail('FILESYSTEM_BOUNDARY', stage, entry.id);
        identities.add(key);
        snapshots[entry.id] = Buffer.from(entry.bytes.join(''), 'base64');
      }
      return snapshots;
    } catch (error) { sequence.abort(); throw error; }
  }
  const inputRoot = [{ id: 'input', path: launch.inputRoot }];
  const first = await read(1, inputRoot, [file('authority', launch.authority, L.authorityBytes), file('config', launch.config, L.configurationBytes)]);
  let configuration, authority;
  selectPhaseError([
    () => { if (digest(first.authority) !== launch.trustedAuthorityDigest) fail('EVIDENCE_AUTHORITY', 'CONFIGURATION', 'authority'); },
    () => { configuration = parseCanonical(first.config, { maxBytes: L.configurationBytes, stage: 'CONFIGURATION', reference: 'config' }); },
    () => { authority = parseCanonical(first.authority, { maxBytes: L.authorityBytes, stage: 'CONFIGURATION', reference: 'authority' }); },
  ], 'CONFIGURATION');
  selectPhaseError([
    () => validateRecord('Configuration', configuration, { stage: 'CONFIGURATION', reference: 'config', code: 'CONFIGURATION' }),
    () => validateRecord('Authority', authority, { stage: 'CONFIGURATION', reference: 'authority' }),
  ], 'CONFIGURATION');
  const bootstrapPaths = [launch.config, launch.authority, configuration.candidate, configuration.manifest];
  assertDistinctFiles([...bootstrapPaths, ...(launch.decision === null ? [] : [launch.decision])], { stage: 'CONFIGURATION' });
  for (const relative of bootstrapPaths) resolveContained(launch.inputRoot, relative, { stage: 'CONFIGURATION' });
  const second = await read(2, inputRoot, [file('candidate', configuration.candidate, L.candidateBytes), file('manifest', configuration.manifest, L.manifestBytes)]);
  let candidate, manifest;
  selectPhaseError([
    () => { if (digest(second.candidate) !== launch.expectedCandidateDigest) fail('CANDIDATE_MISMATCH', 'CONFIGURATION', 'candidate'); },
    () => { candidate = parseCanonical(second.candidate, { maxBytes: L.candidateBytes, stage: 'CONFIGURATION', reference: 'candidate' }); },
    () => { manifest = parseCanonical(second.manifest, { maxBytes: L.manifestBytes, stage: 'CONFIGURATION', reference: 'manifest' }); },
    () => { if (authority.manifestSha256 !== digest(second.manifest)) fail('INTEGRITY', 'CONFIGURATION', 'manifest'); },
  ], 'CONFIGURATION');
  selectPhaseError([
    () => validateCandidate(candidate, launch.expectedCandidateDigest),
    () => validateRecord('Manifest', manifest, { stage: 'CONFIGURATION', reference: 'manifest' }),
    () => { if (!structurallyEqual(configuration.profile, candidate.profile) || !structurallyEqual(configuration.profile, authority.assessment.profile)) fail('PROFILE_MISMATCH', 'CONFIGURATION', 'config'); },
    () => { if (configuration.stage !== authority.assessment.stage) fail('CONFIGURATION', 'CONFIGURATION', 'config'); },
  ], 'CONFIGURATION');
  validateManifest(manifest);
  assertDistinctFiles([...bootstrapPaths, ...manifest.entries.map(entry => entry.path), ...(launch.decision === null ? [] : [launch.decision])]);
  for (const entry of manifest.entries) resolveContained(launch.inputRoot, entry.path, { reference: entry.id });
  const third = await read(3, inputRoot, manifest.entries.map(entry => file(entry.id, entry.path, entry.type === 'ENVELOPE' ? L.envelopeBytes : L.rawSourceBytes)));
  const input = { configurationBytes: first.config, authorityBytes: first.authority, candidateBytes: second.candidate,
    manifestBytes: second.manifest, files: manifest.entries.map(entry => ({ id: entry.id, bytes: third[entry.id] })),
    expectedCandidateDigest: launch.expectedCandidateDigest, trustedAuthorityDigest: launch.trustedAuthorityDigest };
  if (launch.command === 'evaluate') await read(4, [{ id: 'output', path: launch.outputRoot }], [], 'CHECK_OUTPUT');
  else {
    const fourth = await read(4, [...(launch.decision === null ? [] : inputRoot), { id: 'result', path: launch.resultRoot }],
      [...(launch.decision === null ? [] : [file('decision', launch.decision, L.decisionBytes)]), file('result', DEFINITIONS.filenames.result, L.resultBytes, 'result')]);
    input.resultBytes = fourth.result;
    input.decisionBytes = launch.decision === null ? null : fourth.decision;
  }
  return input;
}
