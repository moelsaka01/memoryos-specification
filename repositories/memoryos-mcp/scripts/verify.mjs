import { validateLaunch,verifyRuntime,verifyDependencies,contractIdentityPin } from '../src/integrity.mjs';
import { loadLimits } from '../src/limits.mjs';
import { verifyFoundation } from './inventory.mjs';
validateLaunch();await loadLimits();await verifyRuntime();await verifyDependencies();await contractIdentityPin();
const inventory=await verifyFoundation();process.stdout.write(JSON.stringify({status:'VERIFIED_PHASE1_FOUNDATION',files:inventory.files.length})+'\n');
