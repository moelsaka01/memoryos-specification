import { performance } from 'node:perf_hooks';
import { parseCanonical } from './canonical.mjs';
import { DEFINITIONS } from './constants.mjs';
import { fail, ReadinessError, operationalError, evaluationExit } from './errors.mjs';
import { parseCliArgs, validateLaunch } from './cli-args.mjs';
import { createHelperSequence, createPublicationInspection } from './helper-protocol.mjs';
import { acquireCliInputs } from './acquisition.mjs';
import { createPublication, stagePublication, finalizePublication, publicationStatus, publicationTransportCheckpoint } from './publication.mjs';
import { createSupervisor } from './runtime.mjs';
import { createHelperTransport } from './helper-transport.mjs';
import { summaryProjection, textProjection } from './projections.mjs';
import { writeSummary, writeDiagnostic } from './output.mjs';

// Private orchestration seam accepts trusted runtime objects for engineering
// doubles. Neither public API nor argv can select these capabilities.
export async function orchestrateCli(launch, { supervisor, exchange, stdout = process.stdout }) {
  const sequence = createHelperSequence(launch.command);
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
    return Object.freeze({ exitCode: launch.command === 'verify' ? 0 : evaluationExit(result.assessment.readiness), committed });
  } catch (error) {
    sequence.abort();
    const admitted = publicationToken && publicationStatus(publicationToken).admitted;
    const safe = admitted && error?.code !== 'MO1307_OUTPUT' ? new ReadinessError('OUTPUT', 'PUBLICATION') : operationalError(error, 'ACQUISITION');
    await supervisor.terminate(safe);
    throw safe;
  }
}

export async function runCli(argv, { signal, started = performance.now(), stdout = process.stdout, stderr } = {}) {
  let supervisor;
  try {
    // LAUNCH refusals precede CONFIGURATION path admission. Dispatch remains
    // own-property-safe in parseCliArgs.
    validateLaunch({ platform: process.platform, arch: process.arch, version: process.version,
      execArgv: process.execArgv, environment: process.env });
    const launch = parseCliArgs(argv);
    supervisor = createSupervisor({ kind: 'cli', signal, started });
    supervisor.checkpoint('LAUNCH');
    const { exchange } = createHelperTransport(supervisor);
    return await orchestrateCli(launch, { supervisor, exchange, stdout });
  } catch (error) {
    const safe = operationalError(error, 'ACQUISITION');
    const cleanupDeadline = supervisor?.snapshot().cleanupDeadline ?? performance.now() + DEFINITIONS.limits.cleanupAllowanceMs;
    if (stderr) await writeDiagnostic(stderr, safe, cleanupDeadline);
    throw safe;
  } finally { if (supervisor) await supervisor.dispose(); }
}
