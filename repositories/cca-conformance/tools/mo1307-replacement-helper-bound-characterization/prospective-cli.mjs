// Evidence-only source-derived copy of production orchestrateCli. It selects
// the prospective-H owner and prospective-branded publication module while all
// acquisition, semantic worker, projections and output behavior remain the
// exact bound production modules.
import { parseCanonical } from '../../../memoryos-readiness/src/canonical.mjs';
import { DEFINITIONS } from '../../../memoryos-readiness/src/constants.mjs';
import { fail, ReadinessError, operationalError, evaluationExit } from '../../../memoryos-readiness/src/errors.mjs';
import { acquireCliInputs } from '../../../memoryos-readiness/src/acquisition.mjs';
import { summaryProjection, textProjection } from '../../../memoryos-readiness/src/projections.mjs';
import { writeSummary } from '../../../memoryos-readiness/src/output.mjs';
import { createProspectiveHelperSequence, createPublicationInspection, prospectiveSequenceSnapshot } from './prospective-sequence.mjs';
import { createPublication, stagePublication, finalizePublication, publicationStatus, publicationTransportCheckpoint } from './prospective-publication.mjs';

export async function orchestrateProspectiveCli(launch, {
  supervisor,
  exchange,
  session,
  helperBoundMs,
  afterHelperExited,
  stdout = process.stdout,
}) {
  const sequence = createProspectiveHelperSequence(launch.command, { session, helperBoundMs, afterHelperExited });
  let committed = false, publicationToken = null;
  try {
    const checkpoint = stage => supervisor.checkpoint(stage);
    const input = await acquireCliInputs(launch, sequence, exchange, checkpoint);
    checkpoint('EVALUATION');
    sequence.beginWorker();
    const answer = await supervisor.runWorker(input, { verify: launch.command === 'verify' });
    sequence.endWorker();
    checkpoint('EVALUATION');
    const result = parseCanonical(answer.resultBytes, { maxBytes: DEFINITIONS.limits.resultBytes, stage: 'EVALUATION' });
    if (result.readinessDigest !== answer.readinessDigest || result.proofBindingDigest !== answer.proofBindingDigest) fail('INTERNAL', 'EVALUATION');
    const decision = launch.command === 'verify' ? answer.decision : null;
    const summary = launch.format === 'text' ? textProjection(result, decision) : summaryProjection(result, launch.command, decision);
    if (launch.command === 'evaluate') {
      const inspection = createPublicationInspection(sequence, launch.outputRoot, { exchange, checkpoint: () => checkpoint('PUBLICATION') });
      const token = await supervisor.waitOperation(createPublication(launch.outputRoot, { inspection }));
      publicationToken = token;
      await supervisor.waitOperation(stagePublication(token, answer.resultBytes), { publicationToken: token });
      await supervisor.waitFinalization(token, () => finalizePublication(token));
      committed = publicationStatus(token).phase === 'COMMITTED';
      supervisor.beginPublicationTransport(token);
    }
    const transportCheckpoint = publicationToken ? () => publicationTransportCheckpoint(publicationToken) : () => checkpoint('PUBLICATION');
    await writeSummary(stdout, summary, supervisor, { checkpoint: transportCheckpoint });
    transportCheckpoint();
    return Object.freeze({ exitCode: launch.command === 'verify' ? 0 : evaluationExit(result.assessment.readiness),
      committed, resultBytes: Uint8Array.from(answer.resultBytes), sequence: prospectiveSequenceSnapshot(sequence) });
  } catch (error) {
    sequence.abort();
    const admitted = publicationToken && publicationStatus(publicationToken).admitted;
    const safe = admitted && error?.code !== 'MO1307_OUTPUT' ? new ReadinessError('OUTPUT', 'PUBLICATION') : operationalError(error, 'ACQUISITION');
    await supervisor.terminate(safe);
    safe.prospectiveSequence = prospectiveSequenceSnapshot(sequence);
    throw safe;
  }
}
