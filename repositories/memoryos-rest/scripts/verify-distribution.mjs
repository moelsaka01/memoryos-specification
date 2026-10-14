import { verifyRuntime, verifyDistribution } from '../src/integrity.mjs';
verifyRuntime();verifyDistribution();process.stdout.write('Distribution verification passed\n');
