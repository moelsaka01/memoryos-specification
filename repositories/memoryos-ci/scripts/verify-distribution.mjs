import { verifyNode,verifyDistribution } from '../src/integrity.mjs';
verifyNode(); const result=verifyDistribution(); process.stdout.write(JSON.stringify(result.identities)+'\n');
