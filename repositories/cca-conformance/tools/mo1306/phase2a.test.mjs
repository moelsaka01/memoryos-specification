import assert from 'node:assert/strict';
import test from 'node:test';
import { providerIR, providerNames, genericProvider } from '../../../memoryos-ci/src/provider-ir.mjs';
import { equivalentProjection, equivalenceClassifications } from '../../../memoryos-ci/src/equivalence.mjs';
import { projections } from '../../../memoryos-ci/src/errors.mjs';

test('P2A provider IR is closed and generic remains the sole executable reference', () => {
  assert.deepEqual(providerNames, ['generic','github','gitlab','jenkins','azure']);
  for (const name of providerNames) {
    const adapter=providerIR(name);
    assert.equal(adapter.id, `memoryos.cicd.adapter.${name}`);
    assert.equal(adapter.version, '1.0.0');
  }
  assert.equal(genericProvider('generic').id, 'memoryos.cicd.adapter.generic');
  assert.throws(() => genericProvider('gitlab'), /MemoryOS CI operation rejected/);
  assert.throws(() => providerIR('unknown'), /MemoryOS CI operation rejected/);
});

test('P2A equivalence vectors retain fixed exits and common projections', () => {
  for (const classification of equivalenceClassifications) {
    const semantic=['PASS','FAIL','COULD_NOT_EVALUATE'].includes(classification);
    const error=semantic ? null : {code: classification==='CONFIGURATION_ERROR'?'MO1306_CONFIG_INVALID':classification==='INPUT_ERROR'?'MO1306_INPUT_READ':classification==='INTEGRITY_ERROR'?'MO1306_RUNTIME_INTEGRITY':classification==='TIMEOUT'?'MO1306_TIMEOUT':'MO1306_CANCELLED',stage: classification==='CONFIGURATION_ERROR'?'CONFIGURATION':classification==='INPUT_ERROR'?'ACQUISITION':classification==='INTEGRITY_ERROR'?'INTEGRITY':classification==='TIMEOUT'?'SEMANTIC':'CLEANUP',semanticCode:null};
    const result={kind:'MemoryOSCICDResult',version:'1.0.0',runId:'00000000-0000-4000-8000-000000000001',provider:'generic',classification,semantic:semantic?{artifactKind:'policy',documentDigest:'sha256:'+ '0'.repeat(64),semanticDigest:'sha256:'+ '1'.repeat(64),decision:classification,evaluationIdentityDigest:'sha256:'+ '2'.repeat(64),outcomeDigest:'sha256:'+ '3'.repeat(64)}:null,error,process:{exitCode:projections[classification].exitCode,termination:semantic?'NORMAL':classification==='TIMEOUT'?'TIMEOUT':classification==='CANCELLED'?'CANCELLED':'NORMAL'},projection:structuredClone(projections[classification].projection),configurationDigest:'sha256:'+'4'.repeat(64),inputDigest:'sha256:'+'5'.repeat(64),contractDigest:'sha256:'+'6'.repeat(64),limitsDigest:'sha256:'+'7'.repeat(64),adapterDigest:'sha256:'+'8'.repeat(64)};
    assert.equal(equivalentProjection(classification,result),true);
  }
});
